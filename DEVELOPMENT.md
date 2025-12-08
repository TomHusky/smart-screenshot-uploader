# 开发指南

## 🚀 快速开始

### 环境要求
- Chrome 浏览器 88+ (支持Manifest V3)
- 文本编辑器或IDE（推荐VS Code）
- 基础的HTML/CSS/JavaScript知识

### 安装步骤

1. **生成图标文件**
   ```bash
   # 在浏览器中打开图标生成器
   open tools/icon-generator.html
   
   # 或直接在浏览器访问
   file:///path/to/chrome-plug/tools/icon-generator.html
   ```
   - 点击"下载所有图标"按钮
   - 将下载的PNG文件保存到 `icons/` 目录

2. **加载扩展到Chrome**
   - 打开 `chrome://extensions/`
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目根目录 `chrome-plug/`

3. **测试扩展**
   - 在浏览器中打开 `test-page.html`
   - 点击扩展图标测试各项功能

## 📁 项目结构详解

```
chrome-plug/
├── manifest.json              # Manifest V3配置
│   ├── permissions           # 权限声明
│   ├── background            # Service Worker配置
│   ├── action                # 扩展图标和弹出窗口
│   ├── commands              # 快捷键配置
│   └── options_page          # 配置页面
│
├── background.js              # Service Worker (后台脚本)
│   ├── captureVisible()      # 可见区域截图
│   ├── captureCustom()       # 自定义区域截图
│   ├── captureFull()         # 整页截图
│   ├── cropImage()           # 图片裁剪
│   └── uploadImage()         # HTTP上传
│
├── popup.html/js              # 弹出窗口
│   ├── 截图模式选择
│   ├── 截图预览
│   └── 上传触发
│
├── options.html/js            # 配置页面
│   ├── HTTP请求配置
│   ├── cURL导入
│   └── 配置验证
│
├── content_script.js          # 内容脚本
│   ├── 自定义区域选择UI
│   ├── 鼠标事件处理
│   └── 区域坐标计算
│
├── utils/
│   └── curl-parser.js         # cURL解析器
│       ├── parse()           # 解析cURL命令
│       ├── toCurl()          # 生成cURL命令
│       └── validateConfig()  # 验证配置
│
├── styles/
│   ├── popup.css             # 弹出窗口样式
│   └── options.css           # 配置页面样式
│
└── tools/
    └── icon-generator.html    # 图标生成工具
```

## 🔧 核心功能实现

### 1. 截图功能

#### 可见区域截图
```javascript
// background.js
async function captureVisible() {
  const dataUrl = await chrome.tabs.captureVisibleTab(null, {
    format: 'png',
    quality: 100
  });
  return dataUrl;
}
```

#### 自定义区域截图流程
1. **注入内容脚本**
   ```javascript
   await chrome.scripting.executeScript({
     target: { tabId: tab.id },
     files: ['content_script.js']
   });
   ```

2. **显示选择界面**
   - content_script.js 创建遮罩层和选择框
   - 监听鼠标事件获取选择区域

3. **截图并裁剪**
   ```javascript
   // 先截取完整视口
   const fullImage = await captureVisible();
   
   // 使用Canvas裁剪
   const cropped = await cropImage(fullImage, {
     x: selection.x * devicePixelRatio,
     y: selection.y * devicePixelRatio,
     width: selection.width * devicePixelRatio,
     height: selection.height * devicePixelRatio
   });
   ```

#### 整页截图原理
```javascript
async function captureFull() {
  // 1. 获取页面完整尺寸
  const { width, height, viewportWidth, viewportHeight } = 
    await getPageDimensions();
  
  // 2. 计算需要截图的块数
  const cols = Math.ceil(width / viewportWidth);
  const rows = Math.ceil(height / viewportHeight);
  
  // 3. 创建大画布
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // 4. 逐块截图并拼接
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // 滚动到目标位置
      await scrollTo(col * viewportWidth, row * viewportHeight);
      
      // 截图当前视口
      const piece = await captureVisible();
      
      // 绘制到大画布
      ctx.drawImage(piece, col * viewportWidth, row * viewportHeight);
    }
  }
  
  // 5. 导出完整图片
  return canvas.toDataURL();
}
```

### 2. HTTP上传实现

#### 请求构建
```javascript
async function uploadImage(imageData) {
  const { method, url, headers, contentType, bodyParams, imageParamName } = config;
  
  let body;
  
  if (contentType === 'application/json') {
    // JSON格式
    const jsonBody = {};
    bodyParams.forEach(p => jsonBody[p.key] = p.value);
    jsonBody[imageParamName] = imageData; // 添加Base64图片
    body = JSON.stringify(jsonBody);
    
  } else if (contentType === 'multipart/form-data') {
    // FormData格式
    const formData = new FormData();
    bodyParams.forEach(p => formData.append(p.key, p.value));
    
    // 将Base64转为Blob
    const blob = dataUrlToBlob(imageData);
    formData.append(imageParamName, blob, 'screenshot.png');
    body = formData;
  }
  
  const response = await fetch(url, { method, headers, body });
  return await response.json();
}
```

### 3. cURL解析器

#### 支持的cURL参数
```javascript
// -X, --request: 请求方法
curl -X POST 'https://api.example.com'

// -H, --header: 请求头
curl -H 'Authorization: Bearer token'

// -d, --data: 请求体数据
curl -d '{"key": "value"}'
curl -d 'key1=value1&key2=value2'

// --json: JSON数据（新版curl）
curl --json '{"key": "value"}'

// -m, --max-time: 超时
curl -m 30
```

#### 解析流程
```javascript
parse(curlCommand) {
  // 1. 清理命令
  const clean = curlCommand.replace(/\\\n/g, ' ').trim();
  
  // 2. 提取URL
  const url = extractUrl(clean);
  
  // 3. 提取方法
  const method = extractMethod(clean);
  
  // 4. 提取Headers
  const headers = extractHeaders(clean);
  
  // 5. 提取Body数据
  const bodyData = extractBodyData(clean);
  
  // 6. 解析Body格式
  const parsedBody = parseBodyFormat(bodyData);
  
  return { url, method, headers, ...parsedBody };
}
```

## 💡 最佳实践

### 1. 性能优化

#### 图片压缩
```javascript
// 对于大图片，可以降低质量
const dataUrl = await chrome.tabs.captureVisibleTab(null, {
  format: 'jpeg', // 使用JPEG而不是PNG
  quality: 85     // 降低质量以减小文件大小
});
```

#### 分批处理
```javascript
// 整页截图时，避免一次性加载所有图片到内存
async function captureFull() {
  const pieces = [];
  
  // 分批截图
  for (let i = 0; i < totalPieces; i++) {
    const piece = await capturePiece(i);
    pieces.push(piece);
    
    // 每10张清理一次
    if (i % 10 === 0) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  
  return stitchPieces(pieces);
}
```

### 2. 错误处理

#### 网络错误
```javascript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    showError('请求超时');
  } else if (error.name === 'TypeError') {
    showError('网络错误，请检查连接');
  } else {
    showError('上传失败: ' + error.message);
  }
}
```

#### 权限错误
```javascript
try {
  await chrome.tabs.captureVisibleTab();
} catch (error) {
  if (error.message.includes('permission')) {
    showError('缺少必要的权限，请在扩展设置中授权');
  } else {
    showError('截图失败: ' + error.message);
  }
}
```

### 3. 用户体验

#### 加载状态
```javascript
// 显示进度
showProgress(true);

try {
  await performAction();
  showSuccess('操作成功');
} finally {
  showProgress(false);
}
```

#### 即时反馈
```javascript
// 鼠标悬停显示提示
button.addEventListener('mouseenter', () => {
  tooltip.textContent = '点击截取可见区域';
  tooltip.style.display = 'block';
});
```

## 🐛 调试技巧

### 1. Background Script调试
```javascript
// 在 chrome://extensions/ 中点击"检查视图：Service Worker"

// 使用console.log
console.log('Screenshot data:', dataUrl.substring(0, 50) + '...');

// 使用debugger
async function captureVisible() {
  debugger; // 代码会在这里暂停
  const dataUrl = await chrome.tabs.captureVisibleTab();
  return dataUrl;
}
```

### 2. Content Script调试
```javascript
// 打开目标页面，按F12打开开发者工具

// Content Script的日志会显示在Console中
console.log('Selection area:', { x, y, width, height });
```

### 3. Popup/Options调试
```javascript
// 右键点击弹出窗口，选择"检查"

// 或在HTML中添加调试代码
window.addEventListener('error', (e) => {
  console.error('Global error:', e);
});
```

### 4. 消息通信调试
```javascript
// 发送消息时记录
chrome.runtime.sendMessage({ action: 'test' }, response => {
  console.log('Message sent, response:', response);
});

// 接收消息时记录
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request, 'from:', sender);
  sendResponse({ status: 'ok' });
  return true;
});
```

## 🔄 常见问题

### Q1: Service Worker不工作
**A:** Service Worker有生命周期限制，可能会被Chrome自动停止。解决方法：
```javascript
// 保持Service Worker活跃（不推荐长期使用）
setInterval(() => {
  chrome.runtime.getPlatformInfo(() => {});
}, 20000);

// 更好的方法：使用事件驱动架构
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 只在需要时执行
  handleMessage(request).then(sendResponse);
  return true;
});
```

### Q2: Content Script注入失败
**A:** 某些页面（如chrome://）无法注入脚本。解决方法：
```javascript
try {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content_script.js']
  });
} catch (error) {
  if (error.message.includes('Cannot access')) {
    showError('该页面不支持截图功能');
  }
}
```

### Q3: CORS错误
**A:** 某些API可能限制跨域请求。解决方法：
- 使用支持CORS的API
- 或在服务器端添加CORS头
- 或使用代理服务器

## 📚 扩展阅读

- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/reference/)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

## 🤝 贡献代码

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交Pull Request

## 📝 许可证

MIT License - 详见 LICENSE 文件

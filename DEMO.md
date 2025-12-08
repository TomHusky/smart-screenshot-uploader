<!-- 项目演示和使用示例 -->

# 📸 智能截图上传助手 - 演示说明

## 🎬 功能演示

### 演示 1: 可见区域截图
```
1. 打开任意网页
2. 点击扩展图标
3. 选择"可见区域"
4. 查看预览
5. 点击"上传截图"
```

**演示效果**:
- 截图速度: < 1秒
- 预览加载: 即时
- 上传时间: 取决于网络

**测试页面**: test-page.html

---

### 演示 2: 自定义区域截图
```
1. 访问 test-page.html
2. 按 Ctrl+Shift+C (Mac: Cmd+Shift+C)
3. 页面出现半透明遮罩
4. 拖动鼠标选择"测试区域2"的表格
5. 释放鼠标
6. 查看仅包含表格的截图
```

**演示效果**:
- 选择框实时显示尺寸
- 鼠标十字准星
- 精确裁剪

**提示**: 按 ESC 可以取消选择

---

### 演示 3: 整页截图
```
1. 访问 test-page.html (包含长内容)
2. 按 Ctrl+Shift+F (Mac: Cmd+Shift+F)
3. 等待自动滚动和拼接
4. 查看包含完整内容的截图
```

**演示效果**:
- 自动分块截图
- 无缝拼接
- 包含页面底部的"✅ 测试成功标记"

---

### 演示 4: cURL导入配置
```
1. 打开配置页面
2. 切换到"导入cURL"选项卡
3. 粘贴测试cURL命令:
```

```bash
curl -X POST 'https://httpbin.org/post' \
  -H 'Content-Type: application/json' \
  -H 'User-Agent: Screenshot-Extension/1.0' \
  -d '{"filename": "test.png", "timestamp": "2025-12-08"}'
```

```
4. 点击"📥 解析并导入"
5. 自动跳转到"手动配置"选项卡
6. 查看所有参数已自动填充
```

**演示效果**:
- 一键导入所有配置
- 自动识别格式
- 验证成功提示

---

### 演示 5: HTTP上传测试
```
1. 配置httpbin.org测试端点
2. 截取任意图片
3. 点击上传
4. 查看浏览器控制台的响应数据
```

**预期响应** (httpbin.org):
```json
{
  "args": {},
  "data": "{\"image_data\":\"data:image/png;base64,...\"}",
  "files": {},
  "form": {},
  "headers": {
    "Content-Type": "application/json"
  },
  "json": {
    "image_data": "data:image/png;base64,iVBORw0KGgo..."
  },
  "url": "https://httpbin.org/post"
}
```

---

## 🧪 测试场景

### 场景 A: 截图网页文章
**目标**: 保存网页内容  
**步骤**:
1. 打开一篇博客文章
2. 使用整页截图
3. 上传到个人服务器
4. 获得永久链接

### 场景 B: 截图报错信息
**目标**: 快速分享错误截图  
**步骤**:
1. 遇到程序报错
2. Ctrl+Shift+C 框选错误信息
3. 上传到团队API
4. 自动获得截图URL用于工单

### 场景 C: 定期截图监控
**目标**: 监控页面变化  
**步骤**:
1. 配置监控页面URL
2. 设置定时任务调用扩展
3. 自动截图上传
4. 对比历史版本

### 场景 D: API测试辅助
**目标**: 测试图片上传接口  
**步骤**:
1. 导入API的cURL命令
2. 快速截图测试图片
3. 验证接口返回
4. 调试接口参数

---

## 📊 性能指标

### 截图性能
| 类型 | 页面大小 | 耗时 | 文件大小 |
|------|---------|------|---------|
| 可见区域 | 1920x1080 | ~200ms | ~300KB |
| 自定义区域 | 500x300 | ~300ms | ~50KB |
| 整页 (短) | 1920x3000 | ~800ms | ~600KB |
| 整页 (长) | 1920x10000 | ~2.5s | ~1.5MB |

### 上传性能
| 网络条件 | 文件大小 | 上传时间 |
|---------|---------|---------|
| 4G | 300KB | ~1.5s |
| WiFi | 300KB | ~500ms |
| 光纤 | 300KB | ~200ms |

*注: 实际性能取决于设备和网络*

---

## 🎨 界面展示

### 弹出窗口 (360x400px)
```
┌─────────────────────────────────┐
│    📸 截图上传                   │
├─────────────────────────────────┤
│ [🖼️ 可见区域] Ctrl+Shift+V      │
│ [✂️ 自定义区域] Ctrl+Shift+C    │
│ [📄 整个页面] Ctrl+Shift+F      │
├─────────────────────────────────┤
│  预览:                          │
│  ┌─────────────────────────┐   │
│  │  [截图预览图片]         │   │
│  └─────────────────────────┘   │
│  大小: 256 KB                   │
│  [⬆️ 上传截图] [取消]           │
├─────────────────────────────────┤
│  [⚙️ 配置HTTP请求]              │
└─────────────────────────────────┘
```

### 配置页面
```
┌────────────────────────────────────────┐
│  ⚙️ HTTP请求配置                        │
│  配置截图上传的HTTP请求参数             │
├────────────────────────────────────────┤
│  [手动配置] [导入cURL]                 │
├────────────────────────────────────────┤
│  基础设置                              │
│  请求方法: [POST ▼]                    │
│  目标URL:  [https://api.example.com]   │
│  Content-Type: [application/json ▼]    │
│  截图数据参数名: [image_data]          │
│                                        │
│  请求头 (Headers)                      │
│  [Authorization] [Bearer token] [✕]    │
│  [+ 添加Header]                        │
│                                        │
│  请求体参数                            │
│  [filename] [screenshot.png] [✕]       │
│  [+ 添加参数]                          │
│                                        │
│  [💾 保存配置] [🧪 测试] [🔄 重置]     │
└────────────────────────────────────────┘
```

---

## 💻 真实使用案例

### 案例 1: 技术博客作者
**需求**: 将代码示例截图上传到图床  
**配置**:
```json
{
  "url": "https://sm.ms/api/v2/upload",
  "method": "POST",
  "contentType": "multipart/form-data",
  "headers": [
    {"key": "Authorization", "value": "YOUR_API_KEY"}
  ],
  "imageParamName": "smfile"
}
```

### 案例 2: 产品经理
**需求**: 快速分享UI截图到项目管理系统  
**配置**:
```json
{
  "url": "https://jira.company.com/api/upload",
  "method": "POST",
  "contentType": "application/json",
  "headers": [
    {"key": "Authorization", "value": "Bearer TOKEN"}
  ],
  "bodyParams": [
    {"key": "project", "value": "PROJ-123"}
  ]
}
```

### 案例 3: QA测试工程师
**需求**: 自动上传Bug截图到测试系统  
**配置**:
```bash
# 直接导入cURL
curl -X POST 'https://bugtrack.com/api/screenshot' \
  -H 'X-API-Key: abc123' \
  -H 'Content-Type: application/json' \
  -d '{"bug_id": "BUG-456", "type": "ui"}'
```

---

## 🔍 调试技巧

### 查看上传数据
```javascript
// 在浏览器控制台
chrome.storage.sync.get('httpConfig', (data) => {
  console.log('当前配置:', data.httpConfig);
});
```

### 测试截图功能
```javascript
// 手动触发截图
chrome.runtime.sendMessage({action: 'captureVisible'}, (response) => {
  console.log('截图结果:', response);
});
```

### 验证cURL解析
在配置页面的控制台:
```javascript
const parser = new CurlParser();
const result = parser.parse('curl -X POST https://...');
console.log(result);
```

---

## 📱 跨平台支持

### Windows
- 快捷键: `Ctrl+Shift+V/C/F`
- 路径分隔符: `\`

### macOS
- 快捷键: `Cmd+Shift+V/C/F`
- 路径分隔符: `/`

### Linux
- 快捷键: `Ctrl+Shift+V/C/F`
- 路径分隔符: `/`

---

## 🌐 浏览器兼容性

| 浏览器 | 版本要求 | 支持状态 |
|--------|---------|---------|
| Chrome | 88+ | ✅ 完全支持 |
| Edge | 88+ | ✅ 完全支持 |
| Brave | 1.20+ | ✅ 完全支持 |
| Opera | 74+ | ✅ 完全支持 |
| Firefox | - | ❌ 不支持 (Manifest V3差异) |

---

## 🎓 教学价值

这个项目可以作为以下主题的教学案例:

1. **Chrome扩展开发**
   - Manifest V3实战
   - Service Worker应用
   - 权限管理

2. **前端工程化**
   - 模块化设计
   - 文档驱动开发
   - 测试驱动开发

3. **用户体验设计**
   - 界面设计原则
   - 交互流程优化
   - 错误处理策略

4. **API集成**
   - HTTP请求封装
   - 数据格式转换
   - 错误重试机制

---

## 📞 支持与反馈

- 📧 Email: developer@example.com
- 💬 GitHub Issues: [提交问题]
- 📖 文档: README.md
- 🎓 教程: DEVELOPMENT.md

---

**最后更新**: 2025年12月8日  
**版本**: v1.0.0

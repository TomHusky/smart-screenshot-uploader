# DIFY网页助手

一个功能强大、易用且高度定制化的Chrome扩展程序，支持网页截图、图片预览、多图管理和自定义HTTP上传。

## 🎯 核心功能

### 1. 多种截图模式
- **可见区域截图**: 快速截取当前浏览器视口可见区域
- **自定义区域截图**: 拖拽选择页面上的任意区域（页面通知 + 自动保存）
- **整个页面截图**: 自动滚动拼接完整页面内容（智能速率控制）

### 2. 侧边栏模式
- **持久化界面**: 不会自动关闭，可边操作页面边管理截图
- **多图列表管理**: 支持保存多张截图，带缩略图预览
- **单独操作**: 每张截图可单独上传或删除
- **批量操作**: 一键上传全部或清空列表
- 快捷键 `Ctrl+Shift+S` (Mac: `Cmd+Shift+S`) 快速打开/关闭

### 3. 全屏图片预览
- **网页全屏显示**: 点击缩略图在当前网页中全屏预览（非新标签）
- **缩放功能**: 鼠标滚轮缩放（10% - 500%）
- **拖拽移动**: 放大后可拖动查看细节
- **控制按钮**: 放大、缩小、还原、下载
- **实时指示**: 右上角显示当前缩放比例

### 4. HTTP请求配置
- 支持多种请求方法（GET, POST, PUT, PATCH, DELETE）
- 自定义请求头（Headers）
- 支持多种Content-Type（JSON, Form-Data, URL-Encoded）
- **占位符系统**: 在参数中使用占位符自动替换
  - `{{image}}` - 完整Base64图片（含data:前缀）
  - `{{imageBase64}}` - 纯Base64字符串（多图时用逗号连接）
  - `{{imageName}}` - 自动生成文件名
  - `{{timestamp}}` - 当前时间戳
- 导入cURL命令快速配置

### 5. 便捷操作
- 快捷键支持
  - `Ctrl+Shift+V` (Mac: `Cmd+Shift+V`) - 可见区域截图
  - `Ctrl+Shift+C` (Mac: `Cmd+Shift+C`) - 自定义区域截图
  - `Ctrl+Shift+F` (Mac: `Cmd+Shift+F`) - 整页截图
  - `Ctrl+Shift+S` (Mac: `Cmd+Shift+S`) - 打开/关闭侧边栏
- 截图列表实时保存（本地存储）
- 拖拽选择时实时显示尺寸
- 上传进度和结果反馈

## 📦 安装方法

### 开发模式安装

1. **克隆或下载项目**
   ```bash
   git clone <repository-url>
   cd chrome-plug
   ```

2. **生成PNG图标**
   - 在浏览器中打开 `tools/icon-generator.html`
   - 点击"下载所有图标"按钮
   - 将下载的图标文件移动到 `icons/` 目录
   ```bash
   mv ~/Downloads/icon*.png icons/
   ```

3. **在Chrome中加载扩展**
   - 打开Chrome浏览器
   - 访问 `chrome://extensions/`
   - 开启右上角的 "开发者模式"
   - 点击 "加载已解压的扩展程序"
   - 选择项目文件夹

## 🚀 使用指南

### 第一步：配置HTTP请求

1. 点击扩展图标打开侧边栏
2. 点击 "⚙️ 配置HTTP请求"
3. 选择配置方式：

#### 方式A：手动配置
- 填写请求方法、目标URL
- 设置Content-Type
- 添加必要的请求头（如Authorization）
- 添加请求体参数，支持占位符：
  - 在参数值中使用 `{{image}}` 代表完整Base64图片
  - 使用 `{{imageBase64}}` 代表纯Base64字符串
  - 使用 `{{imageName}}` 代表文件名
  - 使用 `{{timestamp}}` 代表时间戳
- 点击"💾 保存配置"

**占位符示例**：
```json
参数key: payload
参数value: {"url": "{{image}}", "name": "{{imageName}}", "time": {{timestamp}}}
```

#### 方式B：导入cURL命令
- 切换到"导入cURL"选项卡
- 粘贴cURL命令，例如：
  ```bash
  curl -X POST 'https://api.example.com/upload' \
    -H 'Authorization: Bearer your-token' \
    -H 'Content-Type: application/json' \
    -d '{"filename": "screenshot.png"}'
  ```
- 点击"📥 解析并导入"
- 配置会自动填充到手动配置表单

### 第二步：截图

1. 浏览到要截图的网页
2. 点击扩展图标打开侧边栏（或使用 `Ctrl+Shift+S`）
3. 使用以下任一方式触发截图：
   - 在侧边栏中选择截图模式
   - 使用快捷键（见上方快捷键列表）

4. **自定义区域截图**特别说明：
   - 触发后页面会显示半透明遮罩和提示
   - 鼠标拖动选择截图区域（实时显示尺寸）
   - 释放鼠标自动完成截图
   - 截图自动保存到侧边栏列表
   - 按ESC取消选择

5. **整页截图**说明：
   - 自动滚动页面分块截图
   - 智能拼接为完整图片
   - 受Chrome API限制，长页面需要等待（每秒最多2次截图）

### 第三步：管理和预览

1. 侧边栏显示所有截图列表（带缩略图、时间、大小）
2. **点击缩略图** → 在网页中全屏预览
   - 鼠标滚轮放大/缩小
   - 拖动查看细节
   - 右上角显示缩放比例
   - 点击"下载"保存本地
3. 每张截图可单独操作：
   - 点击"⬆️ 上传"按钮上传单张
   - 点击"🗑️ 删除"按钮删除

### 第四步：上传

1. **单张上传**: 点击截图的"⬆️ 上传"按钮
2. **批量上传**: 点击"上传全部"按钮
3. 等待上传完成，查看结果提示
4. 成功后可选择保留或清空列表

## 🛠️ 技术架构

### 文件结构
```
chrome-plug/
├── manifest.json              # 扩展配置文件（Manifest V3 + Side Panel）
├── background.js              # Service Worker（后台脚本，占位符处理）
├── sidepanel.html             # 侧边栏UI
├── sidepanel.js               # 侧边栏逻辑（截图列表、全屏预览）
├── options.html               # 配置页面UI（含占位符说明）
├── options.js                 # 配置页面逻辑
├── content_script.js          # 内容脚本（自定义选择 + 页面通知）
├── utils/
│   └── curl-parser.js         # cURL解析器
├── styles/
│   ├── sidepanel.css          # 侧边栏样式
│   └── options.css            # 配置页面样式（含占位符帮助）
├── tools/
│   └── icon-generator.html    # 浏览器端图标生成工具
└── icons/                     # 扩展图标（需手动生成PNG）
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

### 核心API使用

- `chrome.sidePanel.open()` - 打开侧边栏（替代popup，不会自动关闭）
- `chrome.tabs.captureVisibleTab` - 截取可见区域（智能速率控制）
- `chrome.scripting.executeScript` - 注入脚本（自定义选择 + 全屏预览）
- `chrome.storage.sync` - 同步HTTP配置
- `chrome.storage.local` - 本地保存截图列表
- `chrome.runtime.sendMessage` - 组件间消息通信
- `chrome.commands` - 快捷键支持
- `createImageBitmap()` - Service Worker兼容的图片处理
- `OffscreenCanvas` - 离屏Canvas拼接大图

### 截图实现原理

1. **可见区域**: 直接使用 `captureVisibleTab` API
2. **自定义区域**: 
   - 注入content script显示遮罩层和选择框
   - 捕获完整视口
   - 使用OffscreenCanvas裁剪选中区域
   - 保存到chrome.storage.local
   - 页面显示成功通知
3. **整页截图**:
   - 计算页面完整尺寸（scrollWidth/scrollHeight）
   - 分块滚动并截图（每次间隔600ms避免超速率限制）
   - 使用createImageBitmap转换（Service Worker兼容）
   - OffscreenCanvas拼接完整图片

### 全屏预览实现

- 通过`chrome.scripting.executeScript`向页面注入预览层
- 覆盖整个网页（z-index: 2147483647）
- JavaScript实现缩放和拖拽：
  - 鼠标滚轮事件监听
  - transform: scale() + translate()
  - 实时更新缩放指示器

### 占位符替换系统

在上传前自动替换请求体和请求头中的占位符：
```javascript
// 单图片
const placeholders = {
  '{{image}}': 'data:image/png;base64,...',
  '{{imageBase64}}': 'iVBORw0KGgo...',
  '{{imageName}}': 'screenshot-1702012345678.png',
  '{{timestamp}}': '1702012345678'
};

// 多图片（例如选中了 3 张图片）
const placeholders = {
  '{{image}}': 'data:image/png;base64,...',        // 第一张
  '{{imageBase64}}': 'iVBORw0KGgo...,R0lGODlhAQAB...,iVBORw0KGgoAAAANS...',  // 所有图片用逗号连接
  '{{imageName}}': 'screenshots-1702012345678.png',
  '{{timestamp}}': '1702012345678'
};
```

## ⚙️ 配置说明

### HTTP配置参数

| 参数 | 说明 | 示例 |
|------|------|------|
| 请求方法 | HTTP方法 | POST, PUT, GET |
| 目标URL | 上传接口地址 | https://api.example.com/upload |
| Content-Type | 请求内容类型 | application/json |
| 请求头 | 自定义HTTP头（支持占位符） | Authorization: Bearer token |
| 请求体参数 | 参数键值对（支持占位符） | payload: {"url": "{{image}}"} |
| 截图数据参数名 | 传统方式的参数名（可选） | image |
| 请求超时 | 超时时间（秒） | 30 |

### 占位符使用

在请求体参数或请求头的**值**中使用：

| 占位符 | 替换为 | 使用场景 |
|--------|--------|----------|
| `{{image}}` | `data:image/png;base64,iVBORw0...` | 完整Base64图片（含前缀） |
| `{{imageBase64}}` | `iVBORw0KGgo...` | 纯Base64字符串（多图时用逗号连接） |
| `{{imageName}}` | `screenshot-1702012345678.png` | 自动生成的文件名 |
| `{{timestamp}}` | `1702012345678` | 当前时间戳 |

**单图片示例配置**：
```json
参数key: data
参数value: {"screenshot": "{{imageBase64}}", "filename": "{{imageName}}", "uploaded_at": {{timestamp}}}
```

**多图片示例配置**：
```json
参数key: data
参数value: {"images": "{{imageBase64}}", "filename": "{{imageName}}", "timestamp": {{timestamp}}}
```

💡 多图时，`{{imageBase64}}` 会自动将所有图片的 Base64 数据用逗号连接成一个字符串，例如：`"base64_1,base64_2,base64_3"`

### cURL解析支持

解析器支持以下cURL参数：
- `-X, --request` - 请求方法
- `-H, --header` - 请求头
- `-d, --data, --data-raw, --data-binary` - 请求体数据
- `--json` - JSON数据
- `-m, --max-time` - 超时时间

## 🧪 测试用例

### 测试场景1: 侧边栏模式
1. 点击扩展图标
2. 验证侧边栏在浏览器右侧打开
3. 点击页面其他地方，验证侧边栏不会关闭
4. 使用 `Ctrl+Shift+S` 关闭再打开

### 测试场景2: 多图管理
1. 连续截取3张不同区域的图片
2. 验证侧边栏列表显示3张缩略图
3. 验证每张显示时间和大小
4. 删除中间一张，验证列表更新
5. 刷新扩展，验证列表仍然保留

### 测试场景3: 全屏预览和缩放
1. 点击任意缩略图
2. 验证在网页中全屏显示（非新标签）
3. 使用鼠标滚轮放大到200%
4. 拖动图片查看不同区域
5. 点击"1:1还原"恢复
6. 点击"下载"保存到本地
7. 按ESC或点击背景关闭

### 测试场景4: 自定义区域截图流程
1. 使用快捷键 `Ctrl+Shift+C`
2. 验证页面显示遮罩和提示
3. 拖动选择一个区域（验证实时显示尺寸）
4. 释放鼠标
5. 验证页面显示"截图成功"通知
6. 打开侧边栏，验证新截图已添加到列表

### 测试场景5: 整页截图（长页面）
1. 打开一个长页面（需要滚动多屏）
2. 点击"整个页面"
3. 观察页面自动滚动
4. 等待拼接完成（可能需要几秒）
5. 验证截图包含完整页面内容

### 测试场景6: 占位符上传

**单图配置示例**：
```json
Content-Type: application/json
参数key: payload
参数value: {"image_data": "{{imageBase64}}", "filename": "{{imageName}}", "timestamp": {{timestamp}}}
```

**多图配置示例**：
```json
Content-Type: application/json
参数key: payload
参数value: {"images": "{{imageBase64}}", "filename": "{{imageName}}", "timestamp": {{timestamp}}}
```

验证：
1. 选择多张图片上传
2. 检查请求体中 `{{imageBase64}}` 占位符已正确替换为逗号连接的 Base64 字符串
3. 响应包含正确的数据

### 测试场景7: 批量上传
1. 截取5张图片
2. 点击"上传全部"
3. 验证显示上传进度（第x/5张）
4. 全部成功后验证提示信息
5. 验证列表自动清空（可选）

## 🔒 权限说明

- `activeTab` - 访问当前活动标签页（截图）
- `tabs` - 读取标签页信息
- `scripting` - 注入脚本（自定义选择 + 全屏预览）
- `storage` - 保存HTTP配置（sync）和截图列表（local）
- `unlimitedStorage` - 存储多张大图片
- `sidePanel` - 侧边栏功能
- `<all_urls>` - 向任意URL发送上传请求

## 🐛 故障排除

### 问题1: 截图失败
- 检查是否授予了必要的权限
- 某些特殊页面（如chrome://）无法截图
- 刷新页面后重试

### 问题2: 整页截图报错 "exceeds quota"
- 这是Chrome API速率限制（每秒最多2次captureVisibleTab）
- 已自动添加600ms延迟，正常情况不会触发
- 如果仍然失败，页面可能太长，建议使用自定义区域

### 问题3: 上传失败
- 检查HTTP配置是否正确
- 验证URL是否可访问
- 检查占位符语法是否正确
- 检查CORS设置（部分API可能限制）
- 打开开发者工具查看network请求详情

### 问题4: 自定义区域截图未添加到列表
- 检查是否成功完成选择（页面应显示通知）
- 打开侧边栏查看是否已自动加载
- 检查chrome.storage.local是否有权限

### 问题5: 侧边栏不显示
- 确认已点击扩展图标或使用快捷键
- 检查manifest.json中是否有sidePanel权限
- 重新加载扩展

### 问题6: 全屏预览无法缩放
- 确认在预览图片上滚动鼠标滚轮
- 检查浏览器是否禁用了JavaScript
- 尝试使用顶部的放大/缩小按钮

### 问题7: 占位符未替换
- 检查占位符拼写（区分大小写）
- 确认在参数的"值"中使用，不是"键"
- 查看上传后的请求体确认

## 📝 开发说明

### 调试方法
1. 打开 `chrome://extensions/`
2. 找到本扩展，点击"详细信息"
3. 点击"检查视图：Service Worker" 查看background.js日志
4. 点击扩展图标打开侧边栏，右键选择"检查"查看sidepanel日志
5. 在目标页面按F12，Console选项卡可查看content_script日志

### 修改配置
- 修改代码后需要在扩展管理页面点击"刷新"图标
- Service Worker会自动重启
- Content Script需要刷新目标页面才能更新
- 侧边栏需要关闭再打开

### 关键技术点
1. **Service Worker兼容性**: 使用`createImageBitmap`替代`Image`对象
2. **速率限制**: `captureVisibleTab`每次间隔600ms
3. **占位符替换**: 正则表达式全局替换，支持JSON嵌套
4. **存储策略**: sync存配置，local存截图（避免配额限制）
5. **全屏预览**: 动态注入HTML+CSS+JS到页面，最高z-index

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！

---

**开发者**: Chrome Extension Expert  
**版本**: 2.0.0  
**最后更新**: 2025年12月8日  
**Manifest版本**: V3  
**主要技术**: Chrome Side Panel API, OffscreenCanvas, createImageBitmap, 占位符系统

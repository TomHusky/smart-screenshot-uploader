# 项目结构说明

```
chrome-plug/                          # 项目根目录
│
├── 📄 manifest.json                  # Chrome扩展配置文件 (Manifest V3)
│   └── 定义扩展权限、图标、快捷键等
│
├── 🎯 核心文件
│   ├── background.js                 # Service Worker (后台脚本)
│   │   ├── 处理截图请求
│   │   ├── 执行图片裁剪
│   │   ├── 发送HTTP上传请求
│   │   └── 管理消息通信
│   │
│   ├── popup.html                    # 弹出窗口UI
│   ├── popup.js                      # 弹出窗口逻辑
│   │   ├── 截图模式选择
│   │   ├── 截图预览
│   │   └── 上传触发
│   │
│   ├── options.html                  # 配置页面UI
│   ├── options.js                    # 配置页面逻辑
│   │   ├── HTTP请求配置
│   │   ├── cURL命令导入
│   │   └── 配置验证与保存
│   │
│   └── content_script.js             # 内容脚本 (注入到网页)
│       ├── 创建选择遮罩层
│       ├── 处理鼠标拖拽事件
│       └── 计算选择区域坐标
│
├── 🛠️ 工具模块
│   └── utils/
│       └── curl-parser.js            # cURL解析器
│           ├── 解析cURL命令
│           ├── 提取URL、Headers、Body
│           ├── 生成cURL命令
│           └── 验证配置
│
├── 🎨 样式文件
│   └── styles/
│       ├── popup.css                 # 弹出窗口样式
│       └── options.css               # 配置页面样式
│
├── 🖼️ 图标资源
│   └── icons/
│       ├── icon16.svg                # 16x16 SVG源文件
│       ├── icon16.png                # 16x16 PNG (需生成)
│       ├── icon32.png                # 32x32 PNG (需生成)
│       ├── icon48.svg                # 48x48 SVG源文件
│       ├── icon48.png                # 48x48 PNG (需生成)
│       └── icon128.png               # 128x128 PNG (需生成)
│
├── 🔧 开发工具
│   └── tools/
│       ├── icon-generator.html       # 浏览器图标生成器
│       └── generate-icons.sh         # 命令行图标生成脚本
│
├── 🧪 测试文件
│   └── test-page.html                # 功能测试页面
│       ├── 可见区域测试
│       ├── 自定义区域测试
│       ├── 整页截图测试
│       └── 上传配置测试
│
├── 📚 文档
│   ├── README.md                     # 主要文档 (用户指南)
│   ├── QUICKSTART.md                 # 快速开始指南
│   ├── DEVELOPMENT.md                # 开发者文档
│   ├── CHANGELOG.md                  # 更新日志
│   └── PROJECT_STRUCTURE.md          # 本文件
│
├── ⚙️ 配置文件
│   ├── package.json                  # 项目配置
│   ├── .gitignore                    # Git忽略规则
│   └── LICENSE                       # MIT许可证
│
└── 🗂️ 数据流向
    │
    ├── 截图流程:
    │   用户点击 → popup.js
    │   → 发送消息 → background.js
    │   → 调用Chrome API → 获取截图数据
    │   → 返回Base64 → popup.js显示预览
    │
    ├── 自定义截图流程:
    │   用户点击 → popup.js
    │   → 注入脚本 → content_script.js
    │   → 用户拖拽选择区域
    │   → 发送坐标 → background.js
    │   → 截图+裁剪 → 返回结果
    │
    ├── 上传流程:
    │   用户确认 → popup.js
    │   → 发送请求 → background.js
    │   → 读取配置 → chrome.storage
    │   → 构建HTTP请求 → fetch API
    │   → 返回结果 → 显示状态
    │
    └── 配置流程:
        用户输入 → options.js
        → 验证 → curl-parser.js
        → 保存 → chrome.storage.sync
        → 跨设备同步

```

## 📊 文件大小指南

| 文件类型 | 典型大小 | 说明 |
|---------|---------|------|
| manifest.json | ~1KB | 配置文件 |
| background.js | ~10KB | 核心逻辑 |
| popup.js | ~5KB | UI逻辑 |
| options.js | ~8KB | 配置逻辑 |
| content_script.js | ~6KB | 页面交互 |
| curl-parser.js | ~7KB | 解析器 |
| *.css | ~3KB 每个 | 样式文件 |
| icon16.png | ~1KB | 小图标 |
| icon128.png | ~5KB | 大图标 |

## 🔄 关键交互流程

### 消息通信
```
popup.js ←→ background.js
   ↓            ↓
options.js   content_script.js
```

### 数据存储
```
配置数据 → chrome.storage.sync → 云同步
截图数据 → 临时存储 → 上传后清除
```

### API调用
```
chrome.tabs.captureVisibleTab  → 截图
chrome.scripting.executeScript → 注入脚本
chrome.storage.sync            → 配置同步
chrome.runtime.sendMessage     → 消息通信
fetch()                        → HTTP上传
```

## 🎓 学习路径

1. **新手**: 先看 QUICKSTART.md
2. **用户**: 阅读 README.md
3. **开发者**: 学习 DEVELOPMENT.md
4. **贡献者**: 了解本文件和源码

## 💡 提示

- 修改代码后需要在 `chrome://extensions/` 刷新扩展
- Service Worker会自动重启，无需手动
- Content Script需要刷新目标网页才能更新
- 使用浏览器开发者工具调试各个组件

---

**文档版本**: 1.0.0  
**最后更新**: 2025年12月8日

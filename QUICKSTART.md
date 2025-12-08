# 智能截图上传助手 - 快速开始指南

## 🎯 5分钟快速上手

### 步骤1: 生成图标 (1分钟)
1. 在浏览器中打开 `tools/icon-generator.html`
2. 点击"下载所有图标"按钮
3. 将下载的4个PNG文件保存到 `icons/` 文件夹

### 步骤2: 安装扩展 (2分钟)
1. 打开Chrome，访问 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `chrome-plug` 文件夹

### 步骤3: 配置上传 (2分钟)
1. 点击扩展图标
2. 点击"⚙️ 配置HTTP请求"
3. **测试配置**（使用免费API）：
   - 请求方法: `POST`
   - 目标URL: `https://httpbin.org/post`
   - Content-Type: `application/json`
   - 截图数据参数名: `image_data`
4. 点击"💾 保存配置"

### 步骤4: 开始截图 (30秒)
1. 打开测试页面 `test-page.html`
2. 点击扩展图标，选择"可见区域"
3. 预览截图，点击"⬆️ 上传截图"
4. 查看上传成功提示

## ✨ 试试这些功能

### 🖼️ 可见区域截图
- 快捷键: `Ctrl+Shift+V` (Mac: `Cmd+Shift+V`)
- 截取当前屏幕可见内容

### ✂️ 自定义区域截图
- 快捷键: `Ctrl+Shift+C` (Mac: `Cmd+Shift+C`)
- 拖动鼠标选择要截取的区域
- 按ESC取消选择

### 📄 整页截图
- 快捷键: `Ctrl+Shift+F` (Mac: `Cmd+Shift+F`)
- 自动拼接完整页面内容

### 📥 导入cURL
1. 复制这个测试命令:
```bash
curl -X POST 'https://httpbin.org/post' \
  -H 'Content-Type: application/json' \
  -d '{"filename": "test.png"}'
```
2. 打开配置页面，切换到"导入cURL"选项卡
3. 粘贴并点击"📥 解析并导入"

## 🎓 下一步

- 📖 阅读 [README.md](README.md) 了解完整功能
- 🔧 查看 [DEVELOPMENT.md](DEVELOPMENT.md) 学习开发知识
- 🧪 使用 `test-page.html` 测试所有功能
- ⚙️ 配置你自己的上传API

## 💡 提示

- httpbin.org会返回你发送的所有数据，非常适合测试
- 截图大小显示在预览区域下方
- 上传失败时查看错误提示信息
- 可以在配置页面测试配置是否正确

## ❓ 需要帮助？

- 查看 README.md 的"🐛 故障排除"部分
- 检查浏览器控制台的错误信息
- 确保已授予必要的权限

祝您使用愉快！🚀

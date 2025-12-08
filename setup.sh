#!/bin/bash

# 智能截图上传助手 - 一键设置脚本

echo "╔════════════════════════════════════════════════════════╗"
echo "║     📸 智能截图上传助手 - 安装向导                    ║"
echo "║           Chrome Extension Setup Wizard                ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 步骤1: 检查环境
echo -e "${BLUE}[步骤 1/4] 检查环境...${NC}"
if command -v convert &> /dev/null; then
    echo -e "${GREEN}✓ ImageMagick 已安装${NC}"
    HAS_IMAGEMAGICK=true
else
    echo -e "${YELLOW}⚠ ImageMagick 未安装 (可选)${NC}"
    echo "  提示: 安装ImageMagick可以自动生成图标"
    echo "  Mac:    brew install imagemagick"
    echo "  Ubuntu: sudo apt-get install imagemagick"
    HAS_IMAGEMAGICK=false
fi
echo ""

# 步骤2: 生成图标
echo -e "${BLUE}[步骤 2/4] 生成图标...${NC}"
if [ "$HAS_IMAGEMAGICK" = true ]; then
    echo "使用ImageMagick生成PNG图标..."
    bash tools/generate-icons.sh
else
    echo -e "${YELLOW}跳过自动生成，请手动生成图标:${NC}"
    echo "  1. 在浏览器中打开: file://$(pwd)/tools/icon-generator.html"
    echo "  2. 点击 '下载所有图标' 按钮"
    echo "  3. 将PNG文件保存到 icons/ 目录"
    echo ""
    read -p "完成后按回车继续..."
fi
echo ""

# 步骤3: 验证文件
echo -e "${BLUE}[步骤 3/4] 验证文件完整性...${NC}"

REQUIRED_FILES=(
    "manifest.json"
    "background.js"
    "popup.html"
    "popup.js"
    "options.html"
    "options.js"
    "content_script.js"
    "utils/curl-parser.js"
    "styles/popup.css"
    "styles/options.css"
)

ALL_OK=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (缺失)"
        ALL_OK=false
    fi
done

# 检查图标
ICON_COUNT=$(ls icons/*.png 2>/dev/null | wc -l)
if [ "$ICON_COUNT" -ge 4 ]; then
    echo -e "${GREEN}✓${NC} 图标文件 ($ICON_COUNT 个)"
else
    echo -e "${YELLOW}⚠${NC} 图标文件 ($ICON_COUNT/4 个)"
    echo "  提示: 需要生成 icon16.png, icon32.png, icon48.png, icon128.png"
fi
echo ""

# 步骤4: 显示安装说明
echo -e "${BLUE}[步骤 4/4] 加载扩展到Chrome...${NC}"
echo ""
echo "请按照以下步骤操作:"
echo ""
echo "1️⃣  打开Chrome浏览器"
echo "2️⃣  访问: chrome://extensions/"
echo "3️⃣  开启右上角的 '开发者模式' 开关"
echo "4️⃣  点击 '加载已解压的扩展程序'"
echo "5️⃣  选择此目录: $(pwd)"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "✨ 安装完成后，您可以:"
echo ""
echo "📖 查看快速开始指南:"
echo "   cat QUICKSTART.md"
echo ""
echo "🧪 打开测试页面:"
echo "   open test-page.html"
echo ""
echo "⚙️  配置HTTP上传:"
echo "   点击扩展图标 → '⚙️ 配置HTTP请求'"
echo ""
echo "⌨️  使用快捷键:"
echo "   Ctrl+Shift+V  → 可见区域截图"
echo "   Ctrl+Shift+C  → 自定义区域截图"
echo "   Ctrl+Shift+F  → 整页截图"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 打开Chrome扩展页面 (仅macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    read -p "是否现在打开Chrome扩展页面? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open -a "Google Chrome" "chrome://extensions/"
    fi
fi

echo ""
echo -e "${GREEN}🎉 祝您使用愉快！${NC}"
echo ""

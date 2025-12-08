#!/bin/bash

# PNG图标生成脚本
# 使用ImageMagick将SVG转换为PNG
# 安装: brew install imagemagick (Mac) 或 apt-get install imagemagick (Linux)

echo "🎨 开始生成PNG图标..."

# 检查ImageMagick是否安装
if ! command -v convert &> /dev/null; then
    echo "❌ 错误: 未找到ImageMagick"
    echo "请先安装ImageMagick:"
    echo "  Mac: brew install imagemagick"
    echo "  Ubuntu: sudo apt-get install imagemagick"
    echo ""
    echo "或者使用浏览器打开 tools/icon-generator.html 手动生成图标"
    exit 1
fi

# 创建icons目录
mkdir -p icons

# 定义图标尺寸
SIZES=(16 32 48 128)

# 创建临时SVG模板
create_svg() {
    local size=$1
    local output=$2
    
    cat > "$output" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<svg width="$size" height="$size" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad$size" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="$size" height="$size" rx="$(echo "$size * 0.15" | bc)" fill="url(#grad$size)"/>
  <rect x="$(echo "$size * 0.25" | bc)" y="$(echo "$size * 0.3" | bc)" 
        width="$(echo "$size * 0.5" | bc)" height="$(echo "$size * 0.4" | bc)" 
        rx="$(echo "$size * 0.05" | bc)" fill="none" stroke="white" 
        stroke-width="$(echo "$size * 0.05" | bc)"/>
  <circle cx="$(echo "$size / 2" | bc)" cy="$(echo "$size / 2" | bc)" 
          r="$(echo "$size * 0.1" | bc)" fill="white"/>
</svg>
EOF
}

# 生成各尺寸图标
for size in "${SIZES[@]}"; do
    echo "⚙️  生成 ${size}x${size} 图标..."
    
    # 创建临时SVG
    tmp_svg="/tmp/icon${size}.svg"
    create_svg $size "$tmp_svg"
    
    # 转换为PNG
    convert -background none "$tmp_svg" "icons/icon${size}.png"
    
    # 清理临时文件
    rm "$tmp_svg"
    
    if [ -f "icons/icon${size}.png" ]; then
        echo "✅ icons/icon${size}.png 已生成"
    else
        echo "❌ icons/icon${size}.png 生成失败"
    fi
done

echo ""
echo "🎉 图标生成完成！"
echo "📁 生成的文件位于: icons/"
ls -lh icons/*.png 2>/dev/null || echo "未找到PNG文件"

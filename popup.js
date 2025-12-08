// Popup Script - 处理弹出窗口的交互逻辑

let currentImageData = null;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  initializeButtons();
  checkConfiguration();
  
  // 检查是否有待显示的截图
  await checkLatestScreenshot();
  
  // 监听来自background的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showPreview') {
      showPreview(request.imageData);
      sendResponse({ success: true });
    }
    return true;
  });
});

// 检查最新截图
async function checkLatestScreenshot() {
  try {
    const result = await chrome.storage.local.get(['latestScreenshot', 'screenshotTimestamp']);
    
    if (result.latestScreenshot && result.screenshotTimestamp) {
      // 如果截图是最近5分钟内的，自动显示
      const timeDiff = Date.now() - result.screenshotTimestamp;
      if (timeDiff < 5 * 60 * 1000) { // 5分钟
        showPreview(result.latestScreenshot);
        // 清除已显示的截图
        await chrome.storage.local.remove(['latestScreenshot', 'screenshotTimestamp']);
      }
    }
  } catch (error) {
    console.error('Check latest screenshot error:', error);
  }
}

// 初始化按钮
function initializeButtons() {
  // 截图按钮
  document.getElementById('captureVisible').addEventListener('click', () => {
    captureScreenshot('captureVisible');
  });
  
  document.getElementById('captureCustom').addEventListener('click', () => {
    captureScreenshot('captureCustom');
  });
  
  document.getElementById('captureFull').addEventListener('click', () => {
    captureScreenshot('captureFull');
  });
  
  // 预览区域按钮
  document.getElementById('uploadBtn').addEventListener('click', uploadScreenshot);
  document.getElementById('cancelBtn').addEventListener('click', cancelPreview);
  
  // 设置按钮
  document.getElementById('openSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

// 检查配置
async function checkConfiguration() {
  const config = await chrome.storage.sync.get('httpConfig');
  if (!config.httpConfig || !config.httpConfig.url) {
    showStatus('⚠️ 请先配置HTTP请求参数', 'warning');
  }
}

// 截图
async function captureScreenshot(mode) {
  try {
    showStatus('📸 正在截图...', 'info');
    hidePreview();
    
    const response = await chrome.runtime.sendMessage({ action: mode });
    
    if (response.success) {
      if (response.data && !response.data.waiting) {
        showPreview(response.data);
      } else if (mode === 'captureCustom') {
        showStatus('✂️ 请在页面上拖动选择截图区域\n截图完成后会自动显示预览', 'info');
        // 自定义截图需要用户在页面上操作，popup会自动关闭
        // 但截图完成后会保存到storage，重新打开popup时自动显示
      }
    } else {
      showStatus('❌ ' + (response.error || '截图失败'), 'error');
    }
  } catch (error) {
    console.error('Capture error:', error);
    showStatus('❌ 截图失败: ' + error.message, 'error');
  }
}

// 显示预览
function showPreview(imageData) {
  currentImageData = imageData;
  
  const previewSection = document.getElementById('previewSection');
  const previewImage = document.getElementById('previewImage');
  const imageSize = document.getElementById('imageSize');
  
  previewImage.src = imageData;
  
  // 添加点击放大功能
  previewImage.style.cursor = 'zoom-in';
  previewImage.onclick = () => {
    openImageInNewTab(imageData);
  };
  
  // 计算图片大小
  const sizeInBytes = Math.round((imageData.length * 3) / 4);
  const sizeInKB = (sizeInBytes / 1024).toFixed(2);
  imageSize.textContent = `大小: ${sizeInKB} KB (点击图片查看原图)`;
  
  previewSection.style.display = 'block';
  hideStatus();
}

// 在新标签页中打开图片
function openImageInNewTab(imageData) {
  // 创建一个新窗口显示图片
  const newTab = window.open();
  if (newTab) {
    newTab.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>截图预览</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            background: #2c3e50;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          img {
            max-width: 100%;
            max-height: 100vh;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            border-radius: 8px;
          }
          .controls {
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(255,255,255,0.9);
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          }
          button {
            margin: 0 5px;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            background: #667eea;
            color: white;
            cursor: pointer;
            font-size: 14px;
          }
          button:hover {
            background: #5568d3;
          }
        </style>
      </head>
      <body>
        <div class="controls">
          <button onclick="downloadImage()">💾 下载</button>
          <button onclick="window.close()">✕ 关闭</button>
        </div>
        <img src="${imageData}" alt="Screenshot" id="screenshot">
        <script>
          function downloadImage() {
            const link = document.createElement('a');
            link.download = 'screenshot-' + Date.now() + '.png';
            link.href = document.getElementById('screenshot').src;
            link.click();
          }
        </script>
      </body>
      </html>
    `);
  }
}

// 隐藏预览
function hidePreview() {
  document.getElementById('previewSection').style.display = 'none';
  currentImageData = null;
}

// 取消预览
function cancelPreview() {
  hidePreview();
  showStatus('已取消', 'info');
  setTimeout(hideStatus, 2000);
}

// 上传截图
async function uploadScreenshot() {
  if (!currentImageData) {
    showStatus('❌ 没有可上传的截图', 'error');
    return;
  }
  
  try {
    showStatus('⬆️ 正在上传...', 'info');
    showProgress(true);
    
    const response = await chrome.runtime.sendMessage({
      action: 'uploadImage',
      imageData: currentImageData
    });
    
    if (response.success) {
      const result = response.result;
      showStatus(`✅ 上传成功! (${result.status} ${result.statusText})`, 'success');
      
      // 显示响应数据
      if (result.data) {
        console.log('Upload response:', result.data);
      }
      
      // 2秒后关闭popup
      setTimeout(() => {
        window.close();
      }, 2000);
    } else {
      showStatus('❌ ' + (response.error || '上传失败'), 'error');
    }
  } catch (error) {
    console.error('Upload error:', error);
    showStatus('❌ 上传失败: ' + error.message, 'error');
  } finally {
    showProgress(false);
  }
}

// 显示状态消息
function showStatus(message, type = 'info') {
  const statusSection = document.getElementById('statusSection');
  const statusMessage = document.getElementById('statusMessage');
  
  statusMessage.textContent = message;
  statusMessage.className = 'status-message status-' + type;
  statusSection.style.display = 'block';
}

// 隐藏状态消息
function hideStatus() {
  document.getElementById('statusSection').style.display = 'none';
}

// 显示/隐藏进度条
function showProgress(show) {
  const progressBar = document.getElementById('progressBar');
  if (show) {
    progressBar.style.display = 'block';
    // 简单的进度动画
    const progressFill = document.getElementById('progressFill');
    progressFill.style.width = '0%';
    setTimeout(() => {
      progressFill.style.width = '90%';
      progressFill.style.transition = 'width 2s ease-out';
    }, 100);
  } else {
    progressBar.style.display = 'none';
  }
}

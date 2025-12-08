// Side Panel Script - 支持多张截图列表

let screenshots = []; // 存储多张截图
let currentModalImage = null; // 当前弹窗显示的图片

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  initializeButtons();
  checkConfiguration();
  await loadScreenshots();
  await checkLatestScreenshot();
  
  // 监听来自background的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showPreview') {
      addScreenshot(request.imageData);
      sendResponse({ success: true });
    }
    return true;
  });
});

// 初始化按钮
function initializeButtons() {
  document.getElementById('captureVisible').addEventListener('click', () => {
    captureScreenshot('captureVisible');
  });
  
  document.getElementById('captureCustom').addEventListener('click', () => {
    captureScreenshot('captureCustom');
  });
  
  document.getElementById('captureFull').addEventListener('click', () => {
    captureScreenshot('captureFull');
  });
  
  document.getElementById('uploadAllBtn').addEventListener('click', uploadAllScreenshots);
  document.getElementById('clearAllBtn').addEventListener('click', clearAllScreenshots);
  
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

// 加载已保存的截图
async function loadScreenshots() {
  try {
    const result = await chrome.storage.local.get('screenshots');
    if (result.screenshots && Array.isArray(result.screenshots)) {
      screenshots = result.screenshots;
      renderScreenshots();
    }
  } catch (error) {
    console.error('Load screenshots error:', error);
  }
}

// 保存截图到存储
async function saveScreenshots() {
  try {
    await chrome.storage.local.set({ screenshots });
  } catch (error) {
    console.error('Save screenshots error:', error);
  }
}

// 检查最新截图
async function checkLatestScreenshot() {
  try {
    const result = await chrome.storage.local.get(['latestScreenshot', 'screenshotTimestamp']);
    
    if (result.latestScreenshot && result.screenshotTimestamp) {
      const timeDiff = Date.now() - result.screenshotTimestamp;
      if (timeDiff < 5 * 60 * 1000) {
        addScreenshot(result.latestScreenshot);
        await chrome.storage.local.remove(['latestScreenshot', 'screenshotTimestamp']);
      }
    }
  } catch (error) {
    console.error('Check latest screenshot error:', error);
  }
}

// 截图
async function captureScreenshot(mode) {
  try {
    showStatus('📸 正在截图...', 'info');
    
    const response = await chrome.runtime.sendMessage({ action: mode });
    
    if (response.success) {
      if (response.data && !response.data.waiting) {
        addScreenshot(response.data);
        showStatus('✅ 截图完成！', 'success');
        setTimeout(hideStatus, 2000);
      } else if (mode === 'captureCustom') {
        showStatus('✂️ 请在页面上拖动选择截图区域\n完成后会自动添加到列表', 'info');
      }
    } else {
      showStatus('❌ ' + (response.error || '截图失败'), 'error');
    }
  } catch (error) {
    console.error('Capture error:', error);
    showStatus('❌ 截图失败: ' + error.message, 'error');
  }
}

// 添加截图到列表
function addScreenshot(imageData) {
  const screenshot = {
    id: Date.now(),
    data: imageData,
    timestamp: Date.now(),
    size: Math.round((imageData.length * 3) / 4)
  };
  
  screenshots.unshift(screenshot); // 添加到列表开头
  saveScreenshots();
  renderScreenshots();
}

// 渲染截图列表
function renderScreenshots() {
  const screenshotsSection = document.getElementById('screenshotsSection');
  const screenshotsList = document.getElementById('screenshotsList');
  const screenshotCount = document.getElementById('screenshotCount');
  
  if (screenshots.length === 0) {
    screenshotsSection.style.display = 'none';
    return;
  }
  
  screenshotsSection.style.display = 'block';
  screenshotCount.textContent = screenshots.length;
  
  screenshotsList.innerHTML = screenshots.map((screenshot, index) => {
    const date = new Date(screenshot.timestamp);
    const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const sizeKB = (screenshot.size / 1024).toFixed(2);
    
    return `
      <div class="screenshot-item" data-id="${screenshot.id}">
        <div class="screenshot-thumbnail" data-index="${index}">
          <img src="${screenshot.data}" alt="Screenshot ${index + 1}">
        </div>
        <div class="screenshot-info">
          <div class="screenshot-meta">
            <div class="screenshot-time">📸 ${timeStr}</div>
            <div class="screenshot-size">📦 ${sizeKB} KB</div>
          </div>
          <div class="screenshot-actions">
            <button class="btn-small btn-upload" data-index="${index}">
              ⬆️ 上传
            </button>
            <button class="btn-small btn-delete" data-index="${index}">
              🗑️ 删除
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // 绑定事件
  screenshotsList.querySelectorAll('.screenshot-thumbnail').forEach(thumb => {
    thumb.addEventListener('click', (e) => {
      const index = parseInt(e.currentTarget.dataset.index);
      openModal(screenshots[index]);
    });
  });
  
  screenshotsList.querySelectorAll('.btn-upload').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      uploadSingleScreenshot(index);
    });
  });
  
  screenshotsList.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      deleteScreenshot(index);
    });
  });
}

// 删除单张截图
function deleteScreenshot(index) {
  if (confirm('确定要删除这张截图吗？')) {
    screenshots.splice(index, 1);
    saveScreenshots();
    renderScreenshots();
    showStatus('✅ 已删除', 'success');
    setTimeout(hideStatus, 2000);
  }
}

// 清空所有截图
function clearAllScreenshots() {
  if (screenshots.length === 0) return;
  
  if (confirm(`确定要清空全部 ${screenshots.length} 张截图吗？`)) {
    screenshots = [];
    saveScreenshots();
    renderScreenshots();
    showStatus('✅ 已清空全部截图', 'success');
    setTimeout(hideStatus, 2000);
  }
}

// 打开预览弹窗 - 在网页中全屏显示
async function openModal(screenshot) {
  currentModalImage = screenshot;
  
  // 获取当前活动标签
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  
  // 向页面注入预览层
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (imageData, timestamp) => {
      // 移除已存在的预览层
      const existing = document.getElementById('screenshot-preview-overlay');
      if (existing) existing.remove();
      
      // 缩放状态
      let scale = 1;
      let minScale = 0.1;
      let maxScale = 5;
      let translateX = 0;
      let translateY = 0;
      let isDragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let lastTranslateX = 0;
      let lastTranslateY = 0;
      
      // 创建预览层
      const overlay = document.createElement('div');
      overlay.id = 'screenshot-preview-overlay';
      overlay.innerHTML = `
        <style>
          #screenshot-preview-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
            overflow: hidden;
          }
          
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          #screenshot-preview-overlay .preview-header {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%);
            z-index: 10;
          }
          
          #screenshot-preview-overlay .preview-title {
            color: white;
            font-size: 18px;
            font-weight: 600;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          
          #screenshot-preview-overlay .preview-controls {
            display: flex;
            gap: 12px;
          }
          
          #screenshot-preview-overlay .preview-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          
          #screenshot-preview-overlay .btn-zoom {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            backdrop-filter: blur(10px);
            padding: 10px 16px;
          }
          
          #screenshot-preview-overlay .btn-zoom:hover {
            background: rgba(255, 255, 255, 0.3);
          }
          
          #screenshot-preview-overlay .btn-download {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          
          #screenshot-preview-overlay .btn-download:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          }
          
          #screenshot-preview-overlay .btn-close {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            backdrop-filter: blur(10px);
          }
          
          #screenshot-preview-overlay .btn-close:hover {
            background: rgba(255, 255, 255, 0.3);
          }
          
          #screenshot-preview-overlay .preview-image-container {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            cursor: grab;
          }
          
          #screenshot-preview-overlay .preview-image-container.dragging {
            cursor: grabbing;
          }
          
          #screenshot-preview-overlay .preview-image {
            max-width: 95vw;
            max-height: 85vh;
            border-radius: 8px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            animation: zoomIn 0.3s ease;
            transition: transform 0.1s ease-out;
            user-select: none;
            -webkit-user-drag: none;
          }
          
          @keyframes zoomIn {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
          
          #screenshot-preview-overlay .preview-info {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            color: white;
            padding: 12px 24px;
            border-radius: 20px;
            font-size: 13px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            z-index: 10;
          }
          
          #screenshot-preview-overlay .zoom-indicator {
            position: absolute;
            top: 80px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-family: monospace;
            z-index: 10;
          }
        </style>
        
        <div class="preview-header">
          <div class="preview-title">📸 截图预览</div>
          <div class="preview-controls">
            <button class="preview-btn btn-zoom" id="zoom-out">🔍- 缩小</button>
            <button class="preview-btn btn-zoom" id="zoom-reset">1:1 还原</button>
            <button class="preview-btn btn-zoom" id="zoom-in">🔍+ 放大</button>
            <button class="preview-btn btn-download" id="preview-download">💾 下载</button>
            <button class="preview-btn btn-close" id="preview-close">✕ 关闭</button>
          </div>
        </div>
        
        <div class="zoom-indicator" id="zoom-indicator">100%</div>
        
        <div class="preview-image-container" id="image-container">
          <img class="preview-image" id="preview-image" src="${imageData}" alt="Screenshot Preview">
        </div>
        
        <div class="preview-info">
          滚轮缩放 | 拖拽移动 | ESC/点击背景关闭
        </div>
      `;
      
      document.body.appendChild(overlay);
      
      const imageElement = document.getElementById('preview-image');
      const container = document.getElementById('image-container');
      const zoomIndicator = document.getElementById('zoom-indicator');
      
      // 更新图片变换
      function updateTransform() {
        imageElement.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
        zoomIndicator.textContent = Math.round(scale * 100) + '%';
      }
      
      // 缩放函数
      function zoom(delta, centerX, centerY) {
        const oldScale = scale;
        scale = Math.max(minScale, Math.min(maxScale, scale * (1 + delta)));
        
        // 计算缩放中心点的偏移
        if (centerX !== undefined && centerY !== undefined) {
          const rect = imageElement.getBoundingClientRect();
          const offsetX = centerX - rect.left - rect.width / 2;
          const offsetY = centerY - rect.top - rect.height / 2;
          
          translateX -= offsetX * (scale / oldScale - 1) / scale;
          translateY -= offsetY * (scale / oldScale - 1) / scale;
        }
        
        updateTransform();
      }
      
      // 滚轮缩放
      container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        zoom(delta, e.clientX, e.clientY);
      }, { passive: false });
      
      // 鼠标拖拽移动
      container.addEventListener('mousedown', (e) => {
        if (e.target === imageElement) {
          isDragging = true;
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          lastTranslateX = translateX;
          lastTranslateY = translateY;
          container.classList.add('dragging');
          e.preventDefault();
        }
      });
      
      document.addEventListener('mousemove', (e) => {
        if (isDragging) {
          const deltaX = (e.clientX - dragStartX) / scale;
          const deltaY = (e.clientY - dragStartY) / scale;
          translateX = lastTranslateX + deltaX;
          translateY = lastTranslateY + deltaY;
          updateTransform();
        }
      });
      
      document.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          container.classList.remove('dragging');
        }
      });
      
      // 放大按钮
      document.getElementById('zoom-in').addEventListener('click', () => {
        zoom(0.25);
      });
      
      // 缩小按钮
      document.getElementById('zoom-out').addEventListener('click', () => {
        zoom(-0.2);
      });
      
      // 还原按钮
      document.getElementById('zoom-reset').addEventListener('click', () => {
        scale = 1;
        translateX = 0;
        translateY = 0;
        updateTransform();
      });
      
      // 关闭按钮
      document.getElementById('preview-close').addEventListener('click', () => {
        overlay.remove();
      });
      
      // 下载按钮
      document.getElementById('preview-download').addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `screenshot-${timestamp}.png`;
        link.href = imageData;
        link.click();
      });
      
      // 点击背景关闭（但不包括图片本身）
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target === container) {
          overlay.remove();
        }
      });
      
      // ESC键关闭
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          overlay.remove();
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
      
      // 防止页面滚动
      document.body.style.overflow = 'hidden';
      overlay.addEventListener('remove', () => {
        document.body.style.overflow = '';
      });
    },
    args: [screenshot.data, screenshot.timestamp]
  });
}

// 关闭预览弹窗（已不需要，但保留兼容性）
function closeModal() {
  currentModalImage = null;
}

// 上传单张截图
async function uploadSingleScreenshot(index) {
  const screenshot = screenshots[index];
  if (!screenshot) return;
  
  await uploadImage(screenshot.data);
}

// 上传所有截图
async function uploadAllScreenshots() {
  if (screenshots.length === 0) {
    showStatus('❌ 没有可上传的截图', 'error');
    return;
  }
  
  if (!confirm(`确定要上传全部 ${screenshots.length} 张截图吗？`)) {
    return;
  }
  
  showStatus(`⬆️ 正在上传 ${screenshots.length} 张截图...`, 'info');
  showProgress(true);
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < screenshots.length; i++) {
    try {
      showStatus(`⬆️ 正在上传第 ${i + 1}/${screenshots.length} 张...`, 'info');
      
      const response = await chrome.runtime.sendMessage({
        action: 'uploadImage',
        imageData: screenshots[i].data
      });
      
      if (response.success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // 延迟避免请求过快
      if (i < screenshots.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Upload error:', error);
      failCount++;
    }
  }
  
  showProgress(false);
  
  if (failCount === 0) {
    showStatus(`✅ 全部上传成功！(${successCount}/${screenshots.length})`, 'success');
    // 上传成功后清空列表
    setTimeout(() => {
      screenshots = [];
      saveScreenshots();
      renderScreenshots();
    }, 2000);
  } else {
    showStatus(`⚠️ 上传完成：成功 ${successCount} 张，失败 ${failCount} 张`, 'warning');
  }
}

// 上传图片（通用方法）
async function uploadImage(imageData) {
  try {
    showStatus('⬆️ 正在上传...', 'info');
    showProgress(true);
    
    const response = await chrome.runtime.sendMessage({
      action: 'uploadImage',
      imageData: imageData
    });
    
    showProgress(false);
    
    if (response.success) {
      const result = response.result;
      showStatus(`✅ 上传成功! (${result.status} ${result.statusText})`, 'success');
      
      if (result.data) {
        console.log('Upload response:', result.data);
      }
      
      setTimeout(hideStatus, 3000);
    } else {
      showStatus('❌ ' + (response.error || '上传失败'), 'error');
    }
  } catch (error) {
    console.error('Upload error:', error);
    showStatus('❌ 上传失败: ' + error.message, 'error');
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

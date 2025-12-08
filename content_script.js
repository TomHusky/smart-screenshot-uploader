// Content Script - 用于页面内的自定义区域选择

(function() {
  'use strict';
  
  let isSelecting = false;
  let selectionBox = null;
  let overlay = null;
  let startX = 0;
  let startY = 0;
  let endX = 0;
  let endY = 0;
  
  // 监听来自background的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startSelection') {
      startSelectionMode();
      sendResponse({ success: true });
    }
    return true;
  });
  
  // 启动选择模式
  function startSelectionMode() {
    if (isSelecting) return;
    
    isSelecting = true;
    createOverlay();
    createSelectionBox();
    attachEventListeners();
  }
  
  // 创建遮罩层
  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'screenshot-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.3);
      z-index: 2147483646;
      cursor: crosshair;
    `;
    
    // 添加提示文字
    const hint = document.createElement('div');
    hint.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      pointer-events: none;
    `;
    hint.textContent = '拖动鼠标选择截图区域，按 ESC 取消';
    overlay.appendChild(hint);
    
    document.body.appendChild(overlay);
  }
  
  // 创建选择框
  function createSelectionBox() {
    selectionBox = document.createElement('div');
    selectionBox.id = 'screenshot-selection-box';
    selectionBox.style.cssText = `
      position: fixed;
      border: 2px solid #4A90E2;
      background: rgba(74, 144, 226, 0.1);
      z-index: 2147483647;
      pointer-events: none;
      display: none;
    `;
    
    // 添加尺寸显示
    const sizeLabel = document.createElement('div');
    sizeLabel.id = 'selection-size-label';
    sizeLabel.style.cssText = `
      position: absolute;
      bottom: -30px;
      right: 0;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      white-space: nowrap;
    `;
    selectionBox.appendChild(sizeLabel);
    
    document.body.appendChild(selectionBox);
  }
  
  // 附加事件监听器
  function attachEventListeners() {
    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
  }
  
  // 移除事件监听器
  function removeEventListeners() {
    if (overlay) {
      overlay.removeEventListener('mousedown', onMouseDown);
      overlay.removeEventListener('mousemove', onMouseMove);
      overlay.removeEventListener('mouseup', onMouseUp);
    }
    document.removeEventListener('keydown', onKeyDown);
  }
  
  // 鼠标按下
  function onMouseDown(e) {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.display = 'block';
    updateSelectionBox(e.clientX, e.clientY);
  }
  
  // 鼠标移动
  function onMouseMove(e) {
    if (!selectionBox.style.display || selectionBox.style.display === 'none') return;
    e.preventDefault();
    updateSelectionBox(e.clientX, e.clientY);
  }
  
  // 鼠标释放
  async function onMouseUp(e) {
    if (!selectionBox.style.display || selectionBox.style.display === 'none') return;
    
    e.preventDefault();
    endX = e.clientX;
    endY = e.clientY;
    
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    
    // 检查选择区域大小
    if (width < 10 || height < 10) {
      cleanup();
      return;
    }
    
    // 隐藏覆盖层以便截图
    overlay.style.display = 'none';
    selectionBox.style.display = 'none';
    
    // 等待一帧确保DOM更新
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // 发送截图请求
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'captureVisible'
      });
      
      if (response.success) {
        // 获取设备像素比
        const dpr = window.devicePixelRatio || 1;
        
        // 发送裁剪请求
        const cropResponse = await chrome.runtime.sendMessage({
          action: 'cropImage',
          imageData: response.data,
          cropArea: {
            x: x * dpr,
            y: y * dpr,
            width: width * dpr,
            height: height * dpr
          }
        });
        
        if (cropResponse.success) {
          // 保存截图数据到storage，供popup读取
          await chrome.storage.local.set({
            latestScreenshot: cropResponse.data,
            screenshotTimestamp: Date.now()
          });
          
          // 显示成功提示
          showSuccessNotification();
          
          // 通知sidepanel添加截图（使用广播方式）
          try {
            // 先尝试发送给runtime
            await chrome.runtime.sendMessage({
              action: 'showPreview',
              imageData: cropResponse.data
            });
          } catch (error) {
            // 如果sidepanel未打开，数据已保存到storage，下次打开会自动加载
            console.log('Sidepanel not open, screenshot saved to storage');
          }
        }
      }
    } catch (error) {
      console.error('Custom capture error:', error);
      showErrorNotification('截图失败: ' + error.message);
    } finally {
      cleanup();
    }
  }
  
  // 显示成功通知
  function showSuccessNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #4caf50;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideDown 0.3s ease;
    `;
    notification.innerHTML = `
      ✅ 截图成功！请点击扩展图标查看预览
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideUp 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
  
  // 显示错误通知
  function showErrorNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #f44336;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    notification.textContent = '❌ ' + message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
  }
  
  // 按键处理
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
    }
  }
  
  // 更新选择框
  function updateSelectionBox(currentX, currentY) {
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    
    selectionBox.style.left = x + 'px';
    selectionBox.style.top = y + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
    
    // 更新尺寸标签
    const sizeLabel = selectionBox.querySelector('#selection-size-label');
    if (sizeLabel) {
      sizeLabel.textContent = `${width} × ${height}`;
    }
  }
  
  // 清理
  function cleanup() {
    isSelecting = false;
    removeEventListeners();
    
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (selectionBox && selectionBox.parentNode) {
      selectionBox.parentNode.removeChild(selectionBox);
    }
    
    overlay = null;
    selectionBox = null;
  }
})();

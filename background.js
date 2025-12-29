// Background Service Worker - 处理截图和上传逻辑

// 滚动截图状态
const scrollCaptureState = {
  isCapturing: false,
  startY: null,
  tabId: null
};

// 监听扩展图标点击 - 打开侧边栏
chrome.action.onClicked.addListener(async (tab) => {
  // 打开侧边栏
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// 监听快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) return;
  
  switch (command) {
    case 'capture-visible':
      await captureVisible(tab);
      break;
    case 'capture-custom':
      await captureCustom(tab);
      break;
    case 'capture-scroll':
      await captureScroll(tab);
      break;
    case 'toggle-sidepanel':
      // 切换侧边栏
      await chrome.sidePanel.open({ windowId: tab.windowId });
      break;
  }
});

// 监听来自popup和content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'captureVisible':
          const visibleData = await captureVisible();
          sendResponse({ success: true, data: visibleData });
          break;
          
        case 'captureCustom':
          const customData = await captureCustom();
          sendResponse({ success: true, data: customData });
          break;
          
        case 'captureScroll':
          const scrollData = await captureScroll();
          sendResponse({ success: true, data: scrollData });
          break;
        
        case 'markStartPosition':
          await markStartPosition(request.scrollY);
          sendResponse({ success: true });
          break;
        
        case 'finishScrollCapture':
          const finalImage = await finishScrollCapture(request.endScrollY);
          sendResponse({ success: true, data: finalImage });
          break;
        
        case 'cancelScrollCapture':
          await cancelScrollCapture();
          sendResponse({ success: true });
          break;
        
        case 'captureViewportForStitching':
          // 辅助方法:为Canvas拼接提供单屏截图
          const viewportCapture = await chrome.tabs.captureVisibleTab(null, {
            format: 'png',
            quality: 100
          });
          sendResponse({ success: true, imageData: viewportCapture });
          break;
          
        case 'captureFull':
          const fullData = await captureFull();
          sendResponse({ success: true, data: fullData });
          break;
          
        case 'cropImage':
          const croppedData = await cropImage(request.imageData, request.cropArea);
          sendResponse({ success: true, data: croppedData });
          break;
          
        case 'uploadImage':
          const uploadResult = await uploadImage(request.imageData);
          sendResponse({ success: true, result: uploadResult });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true; // 保持消息通道开放
});

// 捕获可见区域
async function captureVisible() {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });
    return dataUrl;
  } catch (error) {
    console.error('Capture visible error:', error);
    throw new Error('截取可见区域失败: ' + error.message);
  }
}

// 捕获自定义区域
async function captureCustom() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 注入选择工具脚本
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content_script.js']
    });
    
    // 发送消息激活选择模式
    await chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
    
    // 立即返回，让popup知道已启动选择模式
    return { waiting: true, message: '选择模式已激活' };
  } catch (error) {
    console.error('Capture custom error:', error);
    throw new Error('启动自定义截图失败: ' + error.message);
  }
}

// 捕获滚动截图
async function captureScroll() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    scrollCaptureState.tabId = tab.id;
    scrollCaptureState.isCapturing = true;
    scrollCaptureState.startY = null;
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const existing = document.getElementById('scroll-capture-control');
        if (existing) existing.remove();
        
        let detectedScrollElement = null;
        
        const detectScrollElement = () => {
          const windowScrollY = window.scrollY || window.pageYOffset || 0;
          if (windowScrollY > 0) {
            detectedScrollElement = window;
            return windowScrollY;
          }
          
          if (document.documentElement.scrollTop > 0) {
            detectedScrollElement = document.documentElement;
            return document.documentElement.scrollTop;
          }
          
          if (document.body && document.body.scrollTop > 0) {
            detectedScrollElement = document.body;
            return document.body.scrollTop;
          }
          
          const allElements = document.querySelectorAll('*');
          for (let el of allElements) {
            const style = window.getComputedStyle(el);
            const isScrollable = (
              style.overflow === 'auto' || style.overflow === 'scroll' || 
              style.overflowY === 'auto' || style.overflowY === 'scroll'
            );
            
            if (isScrollable && el.scrollHeight > el.clientHeight && el.scrollTop > 0) {
              detectedScrollElement = el;
              return el.scrollTop;
            }
          }
          
          if (!detectedScrollElement) {
            if (document.documentElement.scrollHeight > document.documentElement.clientHeight) {
              detectedScrollElement = document.documentElement;
              return 0;
            }
            if (document.body && document.body.scrollHeight > document.body.clientHeight) {
              detectedScrollElement = document.body;
              return 0;
            }
            for (let el of allElements) {
              const style = window.getComputedStyle(el);
              const isScrollable = (
                style.overflow === 'auto' || style.overflow === 'scroll' || 
                style.overflowY === 'auto' || style.overflowY === 'scroll'
              );
              if (isScrollable && el.scrollHeight > el.clientHeight) {
                detectedScrollElement = el;
                return 0;
              }
            }
          }
          
          return 0;
        };
        
        const getScrollPosition = () => {
          if (!detectedScrollElement) {
            detectScrollElement();
          }
          
          if (detectedScrollElement === window) {
            return window.scrollY || window.pageYOffset || 0;
          } else if (detectedScrollElement) {
            return detectedScrollElement.scrollTop || 0;
          }
          return 0;
        };
        
        const getScrollElementDescription = () => {
          if (!detectedScrollElement) return '未检测';
          if (detectedScrollElement === window) return 'window';
          if (detectedScrollElement === document.documentElement) return 'html';
          if (detectedScrollElement === document.body) return 'body';
          if (detectedScrollElement.id) return `#${detectedScrollElement.id}`;
          if (detectedScrollElement.className) {
            const firstClass = detectedScrollElement.className.split(' ')[0];
            return `.${firstClass}`;
          }
          return detectedScrollElement.tagName.toLowerCase();
        };
        
        window.__scrollCaptureElement = detectedScrollElement;
        window.__getScrollPosition = getScrollPosition;
        window.__getScrollElementDescription = getScrollElementDescription;
        
        detectScrollElement();
        
        const control = document.createElement('div');
        control.id = 'scroll-capture-control';
        control.innerHTML = `
          <style>
            #scroll-capture-control {
              position: fixed;
              top: 20px;
              right: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 20px;
              border-radius: 12px;
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
              z-index: 2147483647;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              min-width: 280px;
              backdrop-filter: blur(10px);
            }
            
            #scroll-capture-control .title {
              font-size: 16px;
              font-weight: 700;
              margin-bottom: 12px;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            
            #scroll-capture-control .info {
              font-size: 13px;
              margin-bottom: 12px;
              opacity: 0.95;
              line-height: 1.6;
              white-space: pre-line;
            }
            
            #scroll-capture-control .buttons {
              display: flex;
              gap: 8px;
            }
            
            #scroll-capture-control button {
              flex: 1;
              padding: 10px 16px;
              border: none;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s ease;
              font-family: inherit;
            }
            
            #scroll-capture-control .btn-start {
              background: rgba(255, 255, 255, 0.95);
              color: #667eea;
            }
            
            #scroll-capture-control .btn-start:hover {
              background: white;
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            
            #scroll-capture-control .btn-finish {
              background: rgba(76, 175, 80, 0.95);
              color: white;
              display: none;
            }
            
            #scroll-capture-control .btn-finish:hover {
              background: #4CAF50;
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
            }
            
            #scroll-capture-control .btn-cancel {
              background: rgba(244, 67, 54, 0.95);
              color: white;
            }
            
            #scroll-capture-control .btn-cancel:hover {
              background: #f44336;
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4);
            }
            
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.6; }
            }
            
            #scroll-capture-control .pulse {
              animation: pulse 1.5s ease-in-out infinite;
            }
          </style>
          
          <div class="title">
            <span class="pulse">🔴</span>
            <span>滚动截图</span>
          </div>
          
          <div class="info" id="scroll-info">
📍 请滚动到起始位置
然后点击"开始"按钮

<span id="current-scroll">当前位置: 检测中...</span>
<span id="scroll-element" style="display: block; font-size: 11px; margin-top: 4px; opacity: 0.8;">滚动元素: 检测中...</span>
          </div>
          
          <div class="buttons">
            <button class="btn-start" id="start-mark-btn">📍 开始</button>
            <button class="btn-finish" id="finish-scroll-capture">✅ 结束截图</button>
            <button class="btn-cancel" id="cancel-scroll-capture">❌ 取消</button>
          </div>
        `;
        
        document.body.appendChild(control);
        
        const updateScrollPosition = () => {
          const scrollY = getScrollPosition();
          const elementDesc = getScrollElementDescription();
          
          const currentScrollSpan = document.getElementById('current-scroll');
          const scrollElementSpan = document.getElementById('scroll-element');
          
          if (currentScrollSpan) {
            currentScrollSpan.textContent = `当前位置: ${Math.round(scrollY)}px`;
          }
          if (scrollElementSpan) {
            scrollElementSpan.textContent = `滚动元素: ${elementDesc}`;
          }
        };
        
        const scrollUpdateInterval = setInterval(updateScrollPosition, 500);
        updateScrollPosition();
        
        document.getElementById('start-mark-btn').addEventListener('click', () => {
          detectScrollElement();
          window.__scrollCaptureElement = detectedScrollElement;
          
          const currentScrollY = getScrollPosition();
          const elementDesc = getScrollElementDescription();
          
          console.log('=== 开始记录 ===');
          console.log('检测到的滚动元素:', detectedScrollElement);
          console.log('滚动元素描述:', elementDesc);
          console.log('当前滚动位置:', currentScrollY);
          
          const info = document.getElementById('scroll-info');
          if (info) {
            info.innerHTML = `
✅ 起始位置已记录: ${Math.round(currentScrollY)}px
📍 <span id="current-scroll">当前位置: ${Math.round(currentScrollY)}px</span>
<span id="scroll-element" style="display: block; font-size: 11px; margin-top: 4px; opacity: 0.8;">滚动元素: ${elementDesc}</span>
💡 滚动到结束位置后点击"结束截图"
            `;
          }
          
          chrome.runtime.sendMessage({ 
            action: 'markStartPosition',
            scrollY: currentScrollY
          });
          
          document.getElementById('start-mark-btn').style.display = 'none';
          document.getElementById('finish-scroll-capture').style.display = 'block';
        });
        
        document.getElementById('finish-scroll-capture').addEventListener('click', () => {
          const currentScrollY = getScrollPosition();
          const elementDesc = getScrollElementDescription();
          
          console.log('=== 结束记录 ===');
          console.log('使用的滚动元素:', window.__scrollCaptureElement);
          console.log('滚动元素描述:', elementDesc);
          console.log('结束滚动位置:', currentScrollY);
          
          const info = document.getElementById('scroll-info');
          if (info) {
            info.textContent = `⏳ 正在处理...\n结束位置: ${Math.round(currentScrollY)}px`;
          }
          
          chrome.runtime.sendMessage({ 
            action: 'finishScrollCapture',
            endScrollY: currentScrollY
          });
        });
        
        document.getElementById('cancel-scroll-capture').addEventListener('click', () => {
          clearInterval(scrollUpdateInterval);
          chrome.runtime.sendMessage({ action: 'cancelScrollCapture' });
          control.remove();
        });
      }
    });
    
    return { waiting: true, message: '滚动截图已启动' };
  } catch (error) {
    console.error('Start scroll capture error:', error);
    scrollCaptureState.isCapturing = false;
    throw new Error('启动滚动截图失败: ' + error.message);
  }
}

// 捕获整个页面
async function captureFull() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 获取页面完整尺寸
    const dimensions = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return {
          width: Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth
          ),
          height: Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight
          ),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1
        };
      }
    });
    
    const { width, height, viewportWidth, viewportHeight, devicePixelRatio } = dimensions[0].result;
    
    // 计算需要的截图数量
    const cols = Math.ceil(width / viewportWidth);
    const rows = Math.ceil(height / viewportHeight);
    
    // 创建离屏canvas来拼接图片
    const canvas = new OffscreenCanvas(width * devicePixelRatio, height * devicePixelRatio);
    const ctx = canvas.getContext('2d');
    
    // 保存当前滚动位置
    const scrollPosition = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ x: window.scrollX, y: window.scrollY })
    });
    
    // 逐块截图并拼接
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * viewportWidth;
        const y = row * viewportHeight;
        
        // 滚动到目标位置
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (x, y) => window.scrollTo(x, y),
          args: [x, y]
        });
        
        // 等待渲染和API限速（Chrome限制每秒最多2次captureVisibleTab调用）
        // 使用600ms确保不超过速率限制
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // 截图当前视口
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {
          format: 'png',
          quality: 100
        });
        
        // 将dataUrl转为Blob再转为ImageBitmap（Service Worker兼容）
        const blob = dataUrlToBlob(dataUrl);
        const imageBitmap = await createImageBitmap(blob);
        
        // 绘制到canvas
        ctx.drawImage(imageBitmap, x * devicePixelRatio, y * devicePixelRatio);
      }
    }
    
    // 恢复滚动位置
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (pos) => window.scrollTo(pos.x, pos.y),
      args: [scrollPosition[0].result]
    });
    
    // 转换canvas为dataUrl
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const fullDataUrl = await blobToDataUrl(blob);
    
    return fullDataUrl;
  } catch (error) {
    console.error('Capture full page error:', error);
    throw new Error('截取整个页面失败: ' + error.message);
  }
}

// 裁剪图片
async function cropImage(imageData, cropArea) {
  try {
    // 将dataUrl转为Blob再转为ImageBitmap（Service Worker兼容）
    const imageBlob = dataUrlToBlob(imageData);
    const imageBitmap = await createImageBitmap(imageBlob);
    
    // 创建canvas进行裁剪
    const canvas = new OffscreenCanvas(cropArea.width, cropArea.height);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(
      imageBitmap,
      cropArea.x, cropArea.y, cropArea.width, cropArea.height,
      0, 0, cropArea.width, cropArea.height
    );
    
    const outputBlob = await canvas.convertToBlob({ type: 'image/png' });
    const croppedDataUrl = await blobToDataUrl(outputBlob);
    
    return croppedDataUrl;
  } catch (error) {
    console.error('Crop image error:', error);
    throw new Error('裁剪图片失败: ' + error.message);
  }
}

// 上传图片
async function uploadImage(imageData) {
  try {
    // 获取HTTP配置
    const config = await chrome.storage.sync.get(['httpConfig', 'scenarios', 'currentScenarioId']);
    const httpConfig = config.httpConfig;
    const scenarios = config.scenarios || [];
    const currentScenarioId = config.currentScenarioId;
    
    if (!httpConfig || !httpConfig.url) {
      throw new Error('请先配置HTTP请求参数');
    }
    
    // 构建请求
    const { method, url, headers, timeout, jsonBody } = httpConfig;
    
    // 准备占位符数据
    const timestamp = Date.now();
    
    // 获取当前场景名称
    let currentScenarioName = '';
    if (currentScenarioId && scenarios.length > 0) {
      const scenario = scenarios.find(s => s.id === currentScenarioId);
      if (scenario) {
        currentScenarioName = scenario.name;
      }
    }
    
    // 处理单图或多图
    let imageBase64;
    let imageWithPrefix;
    let imageName;
    
    if (Array.isArray(imageData)) {
      // 多图片：提取所有 base64 数据，用 \n\n 连接
      const base64Array = imageData.map(img => img.split(',')[1]);
      imageBase64 = base64Array.join('\n\n');
      // 为每个 base64 添加前缀后用 \n\n 连接
      imageWithPrefix = base64Array.map(b64 => `data:image/png;base64,${b64}`).join('\n\n');
      imageName = `screenshots-${timestamp}.png`;
    } else {
      // 单图片
      imageBase64 = imageData.split(',')[1];
      imageWithPrefix = imageData;
      imageName = `screenshot-${timestamp}.png`;
    }
    
    // 构建占位符对象
    const placeholders = {
      '{{image}}': imageWithPrefix,
      '{{imageBase64}}': imageBase64,
      '{{imageName}}': imageName,
      '{{timestamp}}': timestamp.toString(),
      '{{scenario}}': currentScenarioName
    };
    
    // 替换字符串中的占位符
    function replacePlaceholders(str) {
      if (typeof str !== 'string') return str;
      let result = str;
      for (const [placeholder, value] of Object.entries(placeholders)) {
        // 如果值为 undefined 或 null，替换为空字符串
        const replaceValue = (value === undefined || value === null) ? '' : value;
        result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), replaceValue);
      }
      return result;
    }
    
    // 准备请求头
    const requestHeaders = {};
    if (headers && Array.isArray(headers)) {
      headers.forEach(header => {
        if (header.key && header.value) {
          requestHeaders[header.key] = replacePlaceholders(header.value);
        }
      });
    }
    
    // 准备请求体 - 使用 jsonBody
    let body;
    if (method === 'GET') {
      body = null;
    } else {
      // 解析 jsonBody 并替换占位符
      let bodyObj = {};
      if (jsonBody) {
        try {
          bodyObj = JSON.parse(jsonBody);
        } catch (e) {
          console.error('Parse jsonBody error:', e);
        }
      }
      
      // 递归替换对象中的占位符
      function replaceInObject(obj) {
        if (typeof obj === 'string') {
          return replacePlaceholders(obj);
        } else if (Array.isArray(obj)) {
          return obj.map(item => replaceInObject(item));
        } else if (obj && typeof obj === 'object') {
          const result = {};
          for (const [key, value] of Object.entries(obj)) {
            result[key] = replaceInObject(value);
          }
          return result;
        }
        return obj;
      }
      
      bodyObj = replaceInObject(bodyObj);
      
      body = JSON.stringify(bodyObj);
      requestHeaders['Content-Type'] = 'application/json';
    }
    
    // 发送请求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), (timeout || 30) * 1000);
    
    const response = await fetch(url, {
      method: method || 'POST',
      headers: requestHeaders,
      body: body,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // 解析响应
    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return {
      status: response.status,
      statusText: response.statusText,
      data: responseData
    };
  } catch (error) {
    console.error('Upload error:', error);
    if (error.name === 'AbortError') {
      throw new Error('请求超时');
    }
    throw new Error('上传失败: ' + error.message);
  }
}

// 辅助函数：Blob转DataUrl
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 辅助函数：DataUrl转Blob
function dataUrlToBlob(dataUrl) {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

// 标记起始位置
async function markStartPosition(scrollY) {
  if (!scrollCaptureState.isCapturing) {
    return;
  }
  
  try {
    scrollCaptureState.startY = scrollY;
    console.log('=== 起始位置已记录 ===');
    console.log('起始 scrollY:', scrollCaptureState.startY);
  } catch (error) {
    console.error('Mark start position error:', error);
  }
}

// 完成滚动截图
async function finishScrollCapture(endScrollY) {
  if (!scrollCaptureState.isCapturing) {
    return null;
  }
  
  try {
    const tabId = scrollCaptureState.tabId;
    
    if (scrollCaptureState.startY === null) {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const info = document.getElementById('scroll-info');
          if (info) {
            info.textContent = '❌ 错误：请先点击"开始"按钮\n标记起始位置';
          }
        }
      });
      return null;
    }
    
    const endY = endScrollY;
    let startY = scrollCaptureState.startY;
    
    console.log('=== 完整滚动信息 ===');
    console.log('起始位置:', startY);
    console.log('结束位置:', endY);
    
    if (startY > endY) {
      [startY, endY] = [endY, startY];
    }
    
    const scrollDistance = endY - startY;
    console.log('滚动距离:', scrollDistance);
    
    if (scrollDistance < 10) {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (start, end, height) => {
          const info = document.getElementById('scroll-info');
          const control = document.getElementById('scroll-capture-control');
          if (info) {
            info.textContent = `❌ 错误：滚动距离太小\n\n起始: ${Math.round(start)}px\n结束: ${Math.round(end)}px\n距离: ${Math.round(height)}px\n\n请滚动更多后再点击"结束截图"`;
          }
          if (control) control.style.display = 'block';
        },
        args: [startY, endY, scrollDistance]
      });
      return null;
    }
    
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const control = document.getElementById('scroll-capture-control');
        if (control) control.style.display = 'none';
      }
    });
    
    const viewportInfo = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return {
          width: window.innerWidth,
          height: document.documentElement.clientHeight, // 使用 clientHeight 排除滚动条
          devicePixelRatio: window.devicePixelRatio || 1,
          documentWidth: Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth
          )
        };
      }
    });
    
    const { width, height: viewportHeight, devicePixelRatio, documentWidth } = viewportInfo[0].result;
    
    // 捕获高度 = 滚动距离 + 最后一个视口的高度
    // 这样可以确保包含结束位置所在的整个屏幕内容
    const captureHeight = scrollDistance + viewportHeight;
    
    // 设置重叠区域以处理固定头部(Fixed Header)和确保拼接平滑
    // 增加重叠高度可以防止因固定头部遮挡导致的内容丢失
    // 如果发现拼接处有重复或丢失，可以调整这个值
    const overlap = 150; 
    
    // 估算步数，考虑重叠部分导致每次实际前进距离变小
    const effectiveAdvance = Math.max(viewportHeight - overlap, 100);
    const estimatedSteps = Math.ceil(captureHeight / effectiveAdvance) + 5;
    
    console.log('截图计划:', {
      captureHeight,
      viewportHeight,
      overlap,
      estimatedSteps,
      devicePixelRatio
    });
    
    const canvasHeight = Math.max(1, captureHeight * devicePixelRatio);
    const canvasWidth = Math.max(1, documentWidth * devicePixelRatio);
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    
    const scrollInfo = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const scrollElement = window.__scrollCaptureElement;
        if (scrollElement === window) {
          return window.scrollY || window.pageYOffset || 0;
        } else if (scrollElement) {
          return scrollElement.scrollTop || 0;
        }
        return 0;
      }
    });
    const originalScrollY = scrollInfo[0].result;
    
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (y) => {
        const scrollElement = window.__scrollCaptureElement;
        if (scrollElement === window) {
          window.scrollTo({ top: y, behavior: 'instant' });
        } else if (scrollElement) {
          scrollElement.scrollTop = y;
        }
      },
      args: [startY]
    });
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    let currentY = startY;
    let canvasOffsetY = 0;
    let step = 0;
    let noProgressCount = 0;
    
    // 使用 while 循环确保填满高度，同时防止死循环
    while (canvasOffsetY < captureHeight * devicePixelRatio - 1 && step < estimatedSteps) {
      step++;
      
      // 1. 滚动到目标位置
      // 如果不是第一屏，我们需要回退一定的 overlap 距离
      // 这样新截图的顶部（可能被固定头部遮挡）会被裁剪掉，从而实现无缝拼接
      let scrollTargetY = currentY;
      if (step > 1) {
        scrollTargetY = Math.max(startY, currentY - overlap);
      }

      await chrome.scripting.executeScript({
        target: { tabId },
        func: (y) => {
          const scrollElement = window.__scrollCaptureElement;
          if (scrollElement === window) {
            window.scrollTo({ top: y, behavior: 'instant' });
          } else if (scrollElement) {
            scrollElement.scrollTop = y;
          }
        },
        args: [scrollTargetY]
      });
      
      // 2. 等待渲染和加载
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // 3. 获取实际滚动位置（处理滚动到底部的情况）
      const currentScrollInfo = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const scrollElement = window.__scrollCaptureElement;
          if (scrollElement === window) {
            return window.scrollY || window.pageYOffset || 0;
          } else if (scrollElement) {
            return scrollElement.scrollTop || 0;
          }
          return 0;
        }
      });
      const actualScrollY = currentScrollInfo[0].result;
      
      // 4. 截图
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png',
        quality: 100
      });
      
      const blob = dataUrlToBlob(dataUrl);
      const bitmap = await createImageBitmap(blob);
      
      // 5. 计算绘制参数
      const remainingHeight = captureHeight - (canvasOffsetY / devicePixelRatio);
      // 使用实际截图高度作为视口高度的参考，更准确
      const effectiveViewportHeight = bitmap.height / devicePixelRatio;
      const drawHeight = Math.min(effectiveViewportHeight, remainingHeight);
      
      // 计算源图像的裁剪偏移量
      // 这里的逻辑会自动处理 overlap：
      // 如果我们滚动到了 currentY - overlap，那么 actualScrollY 就是 currentY - overlap
      // sourceY = (currentY - (currentY - overlap)) * dpr = overlap * dpr
      // 这样就自动跳过了截图顶部的 overlap 区域（通常是固定头部）
      let sourceY = (currentY - actualScrollY) * devicePixelRatio;
      if (sourceY < 0) sourceY = 0;
      
      console.log(`第${step}屏:`, {
        targetY: Math.round(currentY),
        scrollTargetY: Math.round(scrollTargetY),
        actualY: Math.round(actualScrollY),
        sourceY: Math.round(sourceY),
        drawHeight: Math.round(drawHeight),
        remainingHeight: Math.round(remainingHeight),
        bitmapHeight: bitmap.height
      });
      
      const physicalDrawHeight = Math.min(
        drawHeight * devicePixelRatio,
        bitmap.height - sourceY,
        (captureHeight * devicePixelRatio) - canvasOffsetY
      );
      
      if (physicalDrawHeight > 0) {
        ctx.drawImage(
          bitmap,
          0, sourceY, bitmap.width, physicalDrawHeight,
          0, canvasOffsetY, bitmap.width, physicalDrawHeight
        );
        
        canvasOffsetY += physicalDrawHeight;
        currentY += (physicalDrawHeight / devicePixelRatio);
        noProgressCount = 0;
      } else {
        console.warn('本轮未绘制任何内容');
        noProgressCount++;
        if (noProgressCount >= 3) {
          console.warn('连续多次无进展，提前结束截图');
          break;
        }
        // 如果是因为到底部了导致 sourceY 过大，尝试强制结束
        if (sourceY >= bitmap.height) {
           console.warn('已超出图像范围，结束截图');
           break;
        }
      }
      
      if (canvasOffsetY >= captureHeight * devicePixelRatio - 1) {
        console.log('截图完成,已达到目标高度');
        break;
      }
    }
    
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (y) => {
        const scrollElement = window.__scrollCaptureElement;
        if (scrollElement === window) {
          window.scrollTo({ top: y, behavior: 'instant' });
        } else if (scrollElement) {
          scrollElement.scrollTop = y;
        }
      },
      args: [originalScrollY]
    });
    
    const outputBlob = await canvas.convertToBlob({ type: 'image/png' });
    const fullDataUrl = await blobToDataUrl(outputBlob);
    
    scrollCaptureState.isCapturing = false;
    
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const control = document.getElementById('scroll-capture-control');
        if (control) control.remove();
      }
    });
    
    chrome.runtime.sendMessage({
      action: 'scrollCaptureComplete',
      imageData: fullDataUrl
    }).catch(() => {});
    
    return fullDataUrl;
  } catch (error) {
    console.error('Finish scroll capture error:', error);
    scrollCaptureState.isCapturing = false;
    
    try {
      await chrome.scripting.executeScript({
        target: { tabId: scrollCaptureState.tabId },
        func: () => {
          const control = document.getElementById('scroll-capture-control');
          if (control) control.remove();
        }
      });
    } catch (e) {}
    
    throw error;
  }
}

// 取消滚动截图
async function cancelScrollCapture() {
  if (!scrollCaptureState.isCapturing) {
    return;
  }
  
  const tabId = scrollCaptureState.tabId;
  scrollCaptureState.isCapturing = false;
  
  if (tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const control = document.getElementById('scroll-capture-control');
          if (control) control.remove();
        }
      });
    } catch (e) {}
  }
}

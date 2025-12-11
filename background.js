// Background Service Worker - 处理截图和上传逻辑

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
    case 'capture-full':
      await captureFull(tab);
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
    const config = await chrome.storage.sync.get('httpConfig');
    const httpConfig = config.httpConfig;
    
    if (!httpConfig || !httpConfig.url) {
      throw new Error('请先配置HTTP请求参数');
    }
    
    // 构建请求
    const { method, url, headers, timeout, jsonBody } = httpConfig;
    
    // 准备占位符数据
    const timestamp = Date.now();
    
    // 处理单图或多图
    let imageBase64;
    let imageName;
    
    if (Array.isArray(imageData)) {
      // 多图片：提取所有 base64 数据
      imageBase64 = imageData.map(img => img.split(',')[1]);
      imageName = `screenshots-${timestamp}.png`;
    } else {
      // 单图片
      imageBase64 = imageData.split(',')[1];
      imageName = `screenshot-${timestamp}.png`;
    }
    
    const placeholders = {
      '{{image}}': Array.isArray(imageData) ? imageData[0] : imageData,
      '{{imageBase64}}': Array.isArray(imageBase64) ? imageBase64[0] : imageBase64,
      '{{imageName}}': imageName,
      '{{timestamp}}': timestamp.toString()
    };
    
    // 替换字符串中的占位符
    function replacePlaceholders(str) {
      if (typeof str !== 'string') return str;
      let result = str;
      for (const [placeholder, value] of Object.entries(placeholders)) {
        result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
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
          // 特殊处理：如果包含 {{imageBase64}} 且是数组，替换为第一个图片
          let result = replacePlaceholders(obj);
          // 如果是多图且字符串中有 imageBase64，可能需要特殊处理
          if (Array.isArray(imageBase64) && obj.includes('{{imageBase64}}')) {
            // 对于多图，使用第一张图片的 base64
            result = result;
          }
          return result;
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
      
      // 如果是多图，将所有图片的 base64 添加到 files 数组中（如果配置中有这个字段）
      if (Array.isArray(imageBase64) && bodyObj.inputs && bodyObj.inputs.files) {
        bodyObj.inputs.files = imageBase64.map((base64, index) => ({
          type: 'image',
          transfer_method: 'local_file',
          upload_file_id: '',
          url: `data:image/png;base64,${base64}`
        }));
      }
      
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

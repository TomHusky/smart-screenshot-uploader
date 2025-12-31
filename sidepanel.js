// Side Panel Script - 支持多张截图列表

let screenshots = []; // 存储多张截图
let currentModalImage = null; // 当前弹窗显示的图片
let scenes = []; // 存储场景列表

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  initializeButtons();
  checkConfiguration();
  await loadScenes();
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
  
  // 监听storage变化，自动更新场景列表
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.scenarios) {
      console.log('Scenarios updated, reloading...');
      loadScenes();
    }
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
  
  document.getElementById('captureScroll').addEventListener('click', () => {
    startScrollCapture();
  });
  
  document.getElementById('analyzeAllBtn').addEventListener('click', analyzeAllScreenshots);
  document.getElementById('clearAllBtn').addEventListener('click', clearAllScreenshots);
  
  document.getElementById('openSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

// 加载场景列表
async function loadScenes() {
  try {
    const result = await chrome.storage.sync.get(['scenarios', 'currentScenarioId']);
    const scenarios = result.scenarios || [];
    
    const sceneSelect = document.getElementById('scenarioSelect');
    const previousValue = sceneSelect.value;
    
    // 移除旧的事件监听器（通过克隆节点）
    const newSceneSelect = sceneSelect.cloneNode(false);
    sceneSelect.parentNode.replaceChild(newSceneSelect, sceneSelect);
    
    newSceneSelect.innerHTML = '';
    
    if (scenarios.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '🎬 请先在设置中添加场景';
      option.disabled = true;
      option.selected = true;
      newSceneSelect.appendChild(option);
      newSceneSelect.disabled = true;
    } else {
      newSceneSelect.disabled = false;
      
      // 添加占位符选项（可选）
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '🎯 选择场景...';
      placeholder.disabled = true;
      newSceneSelect.appendChild(placeholder);
      
      scenarios.forEach((scenario) => {
        const option = document.createElement('option');
        option.value = scenario.id;
        
        // 美化选项文本，添加emoji和标记
        const prefix = scenario.isDefault ? '⭐ ' : '🎬 ';
        const suffix = scenario.isDefault ? ' (默认)' : '';
        option.textContent = prefix + scenario.name + suffix;
        
        // 选中当前场景或默认场景
        if (scenario.id === result.currentScenarioId || 
            (scenario.id === previousValue && result.currentScenarioId === undefined) ||
            (scenario.isDefault && !result.currentScenarioId)) {
          option.selected = true;
        }
        
        newSceneSelect.appendChild(option);
      });
    }
    
    // 添加场景切换监听器
    newSceneSelect.addEventListener('change', async (e) => {
      const scenarioId = e.target.value;
      if (scenarioId) {
        await chrome.storage.sync.set({ currentScenarioId: scenarioId });
        const scenario = scenarios.find(s => s.id === scenarioId);
        if (scenario) {
          // 切换到新场景的配置
          await chrome.storage.sync.set({ httpConfig: scenario.config });
          console.log('🔄 Switched to scene:', scenario.name);
          console.log('   - Timeout:', scenario.config.timeout, 'seconds');
          showStatus(`✨ 已切换到场景: ${scenario.name}`, 'success');
        }
      }
    });
    
    // 存储场景列表供其他函数使用
    scenes = scenarios;
    
    // 确保当前选中的场景配置已加载到 httpConfig
    if (scenarios.length > 0) {
      const currentScenarioId = result.currentScenarioId;
      let activeScenario = null;
      
      if (currentScenarioId) {
        activeScenario = scenarios.find(s => s.id === currentScenarioId);
      }
      
      // 如果没有找到当前场景，使用默认场景
      if (!activeScenario) {
        activeScenario = scenarios.find(s => s.isDefault) || scenarios[0];
      }
      
      // 加载当前场景的配置到 httpConfig
      if (activeScenario && activeScenario.config) {
        await chrome.storage.sync.set({ 
          httpConfig: activeScenario.config,
          currentScenarioId: activeScenario.id
        });
        console.log('✅ Loaded scene config:', activeScenario.name);
        console.log('   - Timeout:', activeScenario.config.timeout, 'seconds (type:', typeof activeScenario.config.timeout, ')');
        console.log('   - URL:', activeScenario.config.url);
      }
    }
    
  } catch (error) {
    console.error('Load scenes error:', error);
    showStatus('❌ 加载场景列表失败', 'error');
  }
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

// 启动滚动截图
async function startScrollCapture() {
  try {
    showStatus('📜 正在启动滚动截图...', 'info');
    
    const response = await chrome.runtime.sendMessage({ action: 'captureScroll' });
    
    if (response.success) {
      if (response.data && response.data.waiting) {
        showStatus('📸 滚动截图已启动\n请在页面上手动滚动，然后点击"捕获"按钮\n完成后点击"完成"按钮', 'info');
        
        // 监听完成消息
        const messageListener = (request, sender, sendResponse) => {
          if (request.action === 'scrollCaptureComplete' && request.imageData) {
            addScreenshot(request.imageData);
            showStatus('✅ 滚动截图完成！', 'success');
            setTimeout(hideStatus, 2000);
            chrome.runtime.onMessage.removeListener(messageListener);
            sendResponse({ success: true });
          }
        };
        chrome.runtime.onMessage.addListener(messageListener);
      }
    } else {
      showStatus('❌ ' + (response.error || '滚动截图失败'), 'error');
    }
  } catch (error) {
    console.error('Scroll capture error:', error);
    showStatus('❌ 滚动截图失败: ' + error.message, 'error');
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
  if (!tab || !tab.id) {
    showStatus('❌ 无法获取当前标签页', 'error');
    return;
  }
  
  // 检查是否是受限页面（chrome://, edge://, about:, etc.）
  if (tab.url && (tab.url.startsWith('chrome://') || 
                  tab.url.startsWith('edge://') || 
                  tab.url.startsWith('about:') ||
                  tab.url.startsWith('chrome-extension://'))) {
    showStatus('❌ 无法在系统页面中预览，请切换到普通网页', 'error');
    return;
  }
  
  try {
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
  } catch (error) {
    console.error('预览失败:', error);
    showStatus('❌ 预览失败: ' + error.message, 'error');
  }
}

// 关闭预览弹窗（已不需要，但保留兼容性）
function closeModal() {
  currentModalImage = null;
}

// 一键分析所有截图
async function analyzeAllScreenshots() {
  if (screenshots.length === 0) {
    showStatus('❌ 没有可分析的截图', 'error');
    return;
  }
  
  // 清理之前的结果
  try {
    const resultSection = document.getElementById('resultSection');
    if (resultSection) {
      resultSection.style.display = 'none';
    }
    window.fullAnalysisResult = '';
  } catch (e) {
    console.error('清理结果时出错:', e);
  }
  
  showStatus(`🔍 正在分析 ${screenshots.length} 张截图...`, 'info');
  showProgress(true);
  
  // 获取选中的场景
  const sceneSelect = document.getElementById('sceneSelect');
  const selectedScene = sceneSelect ? sceneSelect.value : '';
  
  try {
    // 获取用户输入的 query
    const queryInput = document.getElementById('queryInput');
    const userQuery = queryInput ? queryInput.value.trim() : '';
    
    const response = await chrome.runtime.sendMessage({
      action: 'uploadImage',
      imageData: screenshots.map(s => s.data),
      sceneName: selectedScene,
      userQuery: userQuery
    });
    
    showProgress(false);
    
    if (response && response.success) {
      const result = response.result;
      showStatus(`✅ 分析完成!`, 'success');
      
      // 显示结果
      if (result.data) {
        displayAnalysisResult(result.data);
      }
      
      setTimeout(hideStatus, 3000);
    } else {
      showStatus('❌ ' + (response?.error || '分析失败'), 'error');
    }
  } catch (error) {
    console.error('Analysis error:', error);
    showProgress(false);
    showStatus('❌ 分析失败: ' + error.message, 'error');
  }
}

// 显示分析结果
function displayAnalysisResult(data) {
  // 提取分析结果文本
  let analysisText = '';
  
  // 兼容不同的响应格式
  if (typeof data === 'string') {
    analysisText = data;
  } else if (data.answer) {
    analysisText = data.answer;
  } else if (data.result) {
    analysisText = data.result;
  } else if (data.content) {
    analysisText = data.content;
  } else if (data.text) {
    analysisText = data.text;
  } else {
    analysisText = JSON.stringify(data, null, 2);
  }
  
  // 保存完整结果
  window.fullAnalysisResult = analysisText;
  
  // 显示结果区域
  const resultSection = document.getElementById('resultSection');
  const resultPreview = document.getElementById('resultPreview');
  
  // 渲染预览（只显示前300个字符）
  const previewText = analysisText.length > 300 
    ? analysisText.substring(0, 300) + '...' 
    : analysisText;
  
  resultPreview.innerHTML = markdownToHtml(previewText);
  resultSection.style.display = 'block';
  
  // 绑定弹窗按钮事件
  const showFullResultBtn = document.getElementById('showFullResultBtn');
  showFullResultBtn.onclick = showFullResultModal;
}

// 简单的 Markdown 转 HTML 函数
function markdownToHtml(markdown) {
  if (!markdown) return '';
  
  let html = markdown;
  
  // 转义 HTML 特殊字符（除了我们要处理的 markdown 标记）
  // html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // 代码块（必须先处理，避免其他规则影响）
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.slice(3, -3).trim();
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  });
  
  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // 标题
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // 粗体（斜体之前处理）
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // 斜体
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  // 分割段落
  const paragraphs = html.split('\n\n');
  html = paragraphs.map(para => {
    para = para.trim();
    if (!para) return '';
    
    // 检查是否是特殊元素（标题、列表、代码块等）
    if (para.match(/^<h[1-6]>/) || 
        para.match(/^<pre>/) || 
        para.match(/^<ul>/) || 
        para.match(/^<ol>/)) {
      return para;
    }
    
    // 处理无序列表
    if (para.match(/^[\*\-] /m)) {
      const items = para.split('\n')
        .filter(line => line.match(/^[\*\-] /))
        .map(line => line.replace(/^[\*\-] /, ''))
        .map(item => `<li>${item}</li>`)
        .join('');
      return `<ul>${items}</ul>`;
    }
    
    // 处理有序列表
    if (para.match(/^\d+\. /m)) {
      const items = para.split('\n')
        .filter(line => line.match(/^\d+\. /))
        .map(line => line.replace(/^\d+\. /, ''))
        .map(item => `<li>${item}</li>`)
        .join('');
      return `<ol>${items}</ol>`;
    }
    
    // 处理引用
    if (para.match(/^> /m)) {
      const content = para.split('\n')
        .map(line => line.replace(/^> /, ''))
        .join('<br>');
      return `<blockquote>${content}</blockquote>`;
    }
    
    // 普通段落
    return `<p>${para.replace(/\n/g, '<br>')}</p>`;
  }).join('');
  
  return html;
}

// HTML 转义辅助函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 显示完整结果弹窗 - 在网页中全屏显示（类似图片预览）
async function showFullResultModal() {
  // 获取当前活动标签
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    showStatus('❌ 无法获取当前标签页', 'error');
    return;
  }
  
  // 检查是否是受限页面
  if (tab.url && (tab.url.startsWith('chrome://') || 
                  tab.url.startsWith('edge://') || 
                  tab.url.startsWith('about:') ||
                  tab.url.startsWith('chrome-extension://'))) {
    showStatus('❌ 无法在系统页面中显示结果，请切换到普通网页', 'error');
    return;
  }
  
  const resultText = window.fullAnalysisResult || '';
  
  try {
    // 向页面注入结果显示层
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (analysisResult) => {
        // 移除已存在的结果层
        const existing = document.getElementById('analysis-result-overlay');
        if (existing) existing.remove();
        
        // Markdown 转 HTML 函数
        function markdownToHtml(markdown) {
          if (!markdown) return '';
          
          let html = markdown;
          
          // 代码块（必须先处理）
          html = html.replace(/```[\s\S]*?```/g, (match) => {
            const code = match.slice(3, -3).trim();
            const div = document.createElement('div');
            div.textContent = code;
            return `<pre><code>${div.innerHTML}</code></pre>`;
          });
          
          // 行内代码
          html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
          
          // 标题
          html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
          html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
          html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
          html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
          
          // 粗体(必须在斜体前处理)
          html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
          html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
          html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
          
          // 斜体 - 修复：确保不会误匹配下划线,使用更严格的正则
          // 只匹配前后有空格或行首行尾的情况
          html = html.replace(/(?:^|\s)\*([^*\n]+)\*(?=\s|$)/gm, ' <em>$1</em>');
          html = html.replace(/(?:^|\s)_([^_\n]+)_(?=\s|$)/gm, ' <em>$1</em>');
          
          // 链接
          html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
          
          // 分割段落
          const paragraphs = html.split('\n\n');
          html = paragraphs.map(para => {
            para = para.trim();
            if (!para) return '';
            
            if (para.match(/^<h[1-6]>/) || para.match(/^<pre>/) || para.match(/^<ul>/) || para.match(/^<ol>/)) {
              return para;
            }
            
            // 无序列表
            if (para.match(/^[\*\-] /m)) {
              const items = para.split('\n')
                .filter(line => line.match(/^[\*\-] /))
                .map(line => line.replace(/^[\*\-] /, ''))
                .map(item => `<li>${item}</li>`)
                .join('');
              return `<ul>${items}</ul>`;
            }
            
            // 有序列表
            if (para.match(/^\d+\. /m)) {
              const items = para.split('\n')
                .filter(line => line.match(/^\d+\. /))
                .map(line => line.replace(/^\d+\. /, ''))
                .map(item => `<li>${item}</li>`)
                .join('');
              return `<ol>${items}</ol>`;
            }
            
            // 引用
            if (para.match(/^> /m)) {
              const content = para.split('\n')
                .map(line => line.replace(/^> /, ''))
                .join('<br>');
              return `<blockquote>${content}</blockquote>`;
            }
            
            return `<p>${para.replace(/\n/g, '<br>')}</p>`;
          }).join('');
          
          return html;
        }
        
        // 创建结果显示层
        const overlay = document.createElement('div');
        overlay.id = 'analysis-result-overlay';
        overlay.innerHTML = `
          <style>
            #analysis-result-overlay {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(0, 0, 0, 0.95);
              z-index: 2147483647;
              display: flex;
              flex-direction: column;
              animation: fadeIn 0.3s ease;
              overflow: hidden;
            }
            
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            
            #analysis-result-overlay .result-header {
              position: relative;
              padding: 20px 24px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              z-index: 10;
            }
            
            #analysis-result-overlay .result-title {
              color: white;
              font-size: 20px;
              font-weight: 600;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            
            #analysis-result-overlay .result-controls {
              display: flex;
              gap: 12px;
            }
            
            #analysis-result-overlay .result-btn {
              padding: 10px 20px;
              border: none;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s ease;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            
            #analysis-result-overlay .btn-copy {
              background: rgba(255, 255, 255, 0.2);
              color: white;
              backdrop-filter: blur(10px);
            }
            
            #analysis-result-overlay .btn-copy:hover {
              background: rgba(255, 255, 255, 0.3);
              transform: translateY(-1px);
            }
            
            #analysis-result-overlay .btn-close {
              background: rgba(255, 255, 255, 0.2);
              color: white;
              backdrop-filter: blur(10px);
            }
            
            #analysis-result-overlay .btn-close:hover {
              background: rgba(255, 255, 255, 0.3);
            }
            
            #analysis-result-overlay .result-content-wrapper {
              flex: 1;
              overflow: auto;
              padding: 24px;
              background: #f8f9fa;
            }
            
            #analysis-result-overlay .result-content {
              max-width: 900px;
              margin: 0 auto;
              background: white;
              padding: 32px;
              border-radius: 12px;
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
              animation: slideUp 0.4s ease;
            }
            
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            
            /* Markdown 样式 */
            #analysis-result-overlay .result-content {
              line-height: 1.8;
              color: #333;
              font-size: 15px;
            }
            
            #analysis-result-overlay .result-content h1,
            #analysis-result-overlay .result-content h2,
            #analysis-result-overlay .result-content h3,
            #analysis-result-overlay .result-content h4 {
              margin-top: 24px;
              margin-bottom: 16px;
              font-weight: 600;
              line-height: 1.25;
              color: #2d3748;
            }
            
            #analysis-result-overlay .result-content h1 {
              font-size: 2em;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 0.3em;
            }
            
            #analysis-result-overlay .result-content h2 {
              font-size: 1.5em;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 0.3em;
            }
            
            #analysis-result-overlay .result-content h3 {
              font-size: 1.25em;
            }
            
            #analysis-result-overlay .result-content h4 {
              font-size: 1.1em;
            }
            
            #analysis-result-overlay .result-content p {
              margin-bottom: 16px;
            }
            
            #analysis-result-overlay .result-content ul,
            #analysis-result-overlay .result-content ol {
              padding-left: 2em;
              margin-bottom: 16px;
            }
            
            #analysis-result-overlay .result-content li {
              margin-bottom: 8px;
            }
            
            #analysis-result-overlay .result-content code {
              background: #f1f5f9;
              padding: 0.2em 0.4em;
              border-radius: 3px;
              font-family: 'SF Mono', Monaco, 'Courier New', monospace;
              font-size: 0.9em;
              color: #e74c3c;
            }
            
            #analysis-result-overlay .result-content pre {
              background: #1e293b;
              padding: 16px;
              border-radius: 8px;
              overflow-x: auto;
              margin-bottom: 16px;
            }
            
            #analysis-result-overlay .result-content pre code {
              background: none;
              padding: 0;
              color: #e2e8f0;
              font-size: 0.9em;
            }
            
            #analysis-result-overlay .result-content blockquote {
              border-left: 4px solid #667eea;
              padding-left: 16px;
              color: #64748b;
              margin: 16px 0;
              font-style: italic;
            }
            
            #analysis-result-overlay .result-content a {
              color: #667eea;
              text-decoration: none;
              border-bottom: 1px solid transparent;
              transition: border-color 0.2s;
            }
            
            #analysis-result-overlay .result-content a:hover {
              border-bottom-color: #667eea;
            }
            
            #analysis-result-overlay .result-content strong {
              font-weight: 600;
              color: #1e293b;
            }
            
            #analysis-result-overlay .result-content em {
              font-style: italic;
            }
            
            #analysis-result-overlay .result-info {
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
          </style>
          
          <div class="result-header">
            <div class="result-title">
              <span>📊</span>
              <span>分析结果</span>
            </div>
            <div class="result-controls">
              <button class="result-btn btn-copy" id="copy-result-btn">📋 复制内容</button>
              <button class="result-btn btn-close" id="close-result-btn">✕ 关闭</button>
            </div>
          </div>
          
          <div class="result-content-wrapper">
            <div class="result-content" id="result-content-html"></div>
          </div>
          
          <div class="result-info">
            ESC 键关闭 | 滚动查看完整内容
          </div>
        `;
        
        document.body.appendChild(overlay);
        
        // 渲染 Markdown 内容
        const contentElement = document.getElementById('result-content-html');
        contentElement.innerHTML = markdownToHtml(analysisResult);
        
        // 复制按钮
        document.getElementById('copy-result-btn').addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(analysisResult);
            const btn = document.getElementById('copy-result-btn');
            const originalText = btn.textContent;
            btn.textContent = '✅ 已复制';
            setTimeout(() => {
              btn.textContent = originalText;
            }, 2000);
          } catch (error) {
            console.error('Copy error:', error);
            alert('复制失败，请手动复制');
          }
        });
        
        // 关闭按钮
        document.getElementById('close-result-btn').addEventListener('click', () => {
          overlay.remove();
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
      args: [resultText]
    });
  } catch (error) {
    console.error('显示结果失败:', error);
    showStatus('❌ 显示结果失败: ' + error.message, 'error');
  }
}

// 复制结果到剪贴板（侧边栏内使用）
async function copyResultToClipboard() {
  try {
    await navigator.clipboard.writeText(window.fullAnalysisResult || '');
    showStatus('✅ 已复制到剪贴板', 'success');
    setTimeout(hideStatus, 2000);
  } catch (error) {
    console.error('Copy error:', error);
    showStatus('❌ 复制失败', 'error');
  }
}

// 上传图片（通用方法 - 保留兼容）
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

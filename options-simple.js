// Dify 工作流配置页面脚本

let currentConfig = null;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  setupEventListeners();
});

// 设置事件监听
function setupEventListeners() {
  // 保存配置
  document.getElementById('configForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveConfig();
  });
  
  // 添加按钮
  document.getElementById('addHeader').addEventListener('click', () => addHeaderRow());
  document.getElementById('addInput').addEventListener('click', () => addInputRow());
  
  // 返回按钮
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.close();
      }
    });
  }
  
  // 测试和重置
  document.getElementById('testConfig').addEventListener('click', testConfig);
  document.getElementById('resetConfig').addEventListener('click', resetConfig);
}

// 添加请求头行
function addHeaderRow(key = '', value = '') {
  const container = document.getElementById('headersContainer');
  const row = document.createElement('div');
  row.className = 'header-row';
  
  row.innerHTML = `
    <input type="text" class="header-key" placeholder="请求头名称" value="${escapeHtml(key)}">
    <input type="text" class="header-value" placeholder="请求头值" value="${escapeHtml(value)}">
    <button type="button" class="btn-remove">−</button>
  `;
  
  // 添加删除按钮事件监听
  const removeBtn = row.querySelector('.btn-remove');
  removeBtn.addEventListener('click', () => row.remove());
  
  container.appendChild(row);
}

// 添加 Input 参数行
function addInputRow(key = '', value = '') {
  const container = document.getElementById('inputsContainer');
  const row = document.createElement('div');
  row.className = 'body-row';
  
  row.innerHTML = `
    <input type="text" class="input-key" placeholder="参数名" value="${escapeHtml(key)}">
    <textarea class="input-value" placeholder="参数值（可使用 {{imageBase64}} 等占位符）">${escapeHtml(value)}</textarea>
    <button type="button" class="btn-remove">−</button>
  `;
  
  // 添加删除按钮事件监听
  const removeBtn = row.querySelector('.btn-remove');
  removeBtn.addEventListener('click', () => row.remove());
  
  container.appendChild(row);
}

// HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 加载配置
async function loadConfig() {
  try {
    const result = await chrome.storage.sync.get('httpConfig');
    if (result.httpConfig) {
      currentConfig = result.httpConfig;
      populateForm(currentConfig);
    } else {
      // 设置默认配置
      setDefaultConfig();
    }
  } catch (error) {
    console.error('Load config error:', error);
    showStatus('加载配置失败: ' + error.message, 'error');
  }
}

// 设置默认配置
function setDefaultConfig() {
  document.getElementById('apiUrl').value = 'https://dify-api.duodian.cn/v1/chat-messages';
  document.getElementById('apiKey').value = '';
  document.getElementById('userId').value = 'chrome-extension-user';
  document.getElementById('responseMode').value = 'streaming';
  document.getElementById('timeout').value = 30;
  
  // 默认添加一个 input 参数示例
  addInputRow('image', '{{imageBase64}}');
  addInputRow('query', '请分析这张图片');
}

// 填充表单
function populateForm(config) {
  document.getElementById('apiUrl').value = config.url || '';
  document.getElementById('timeout').value = config.timeout || 30;
  
  // 从 bodyParams 或 jsonBody 中提取配置
  let headers = {};
  let inputs = {};
  let userId = 'chrome-extension-user';
  let responseMode = 'streaming';
  let apiKey = '';
  
  // 解析请求头，提取 API Key
  if (config.headers && Array.isArray(config.headers)) {
    config.headers.forEach(header => {
      if (header.key === 'Authorization' && header.value) {
        // 提取 Bearer token
        apiKey = header.value.replace('Bearer ', '').trim();
      } else if (header.key !== 'Content-Type') {
        headers[header.key] = header.value;
      }
    });
  }
  
  // 解析 JSON Body
  if (config.jsonBody) {
    try {
      const body = JSON.parse(config.jsonBody);
      inputs = body.inputs || {};
      userId = body.user || 'chrome-extension-user';
      responseMode = body.response_mode || 'streaming';
    } catch (e) {
      console.error('Parse jsonBody error:', e);
    }
  }
  
  // 填充表单
  document.getElementById('apiKey').value = apiKey;
  document.getElementById('userId').value = userId;
  document.getElementById('responseMode').value = responseMode;
  
  // 填充请求头
  const headersContainer = document.getElementById('headersContainer');
  headersContainer.innerHTML = '';
  Object.entries(headers).forEach(([key, value]) => {
    addHeaderRow(key, value);
  });
  
  // 填充 inputs
  const inputsContainer = document.getElementById('inputsContainer');
  inputsContainer.innerHTML = '';
  if (Object.keys(inputs).length === 0) {
    addInputRow('image', '{{imageBase64}}');
  } else {
    Object.entries(inputs).forEach(([key, value]) => {
      addInputRow(key, value);
    });
  }
}

// 保存配置
async function saveConfig() {
  try {
    const apiUrl = document.getElementById('apiUrl').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    const userId = document.getElementById('userId').value.trim();
    const responseMode = document.getElementById('responseMode').value;
    const timeout = parseInt(document.getElementById('timeout').value) || 30;
    
    if (!apiUrl) {
      throw new Error('请填写 API 地址');
    }
    
    if (!apiKey) {
      throw new Error('请填写 API Key');
    }
    
    // 收集自定义请求头
    const customHeaders = [];
    document.querySelectorAll('#headersContainer .header-row').forEach(row => {
      const key = row.querySelector('.header-key').value.trim();
      const value = row.querySelector('.header-value').value.trim();
      if (key && value) {
        customHeaders.push({ key, value });
      }
    });
    
    // 收集 inputs 参数
    const inputs = {};
    document.querySelectorAll('#inputsContainer .body-row').forEach(row => {
      const key = row.querySelector('.input-key').value.trim();
      const value = row.querySelector('.input-value').value.trim();
      if (key) {
        inputs[key] = value;
      }
    });
    
    // 构建完整的 HTTP 配置（兼容现有格式）
    const config = {
      method: 'POST',
      url: apiUrl,
      contentType: 'application/json',
      timeout: timeout,
      headers: [
        { key: 'Authorization', value: `Bearer ${apiKey}` },
        { key: 'Content-Type', value: 'application/json' },
        ...customHeaders
      ],
      jsonBody: JSON.stringify({
        inputs: inputs,
        query: "-",
        response_mode: responseMode,
        user: userId
      }, null, 2),
      bodyParams: [] // 保持兼容
    };
    
    // 保存到存储
    await chrome.storage.sync.set({ httpConfig: config });
    currentConfig = config;
    
    showStatus('✅ 配置保存成功！', 'success');
    setTimeout(() => hideStatus(), 3000);
  } catch (error) {
    console.error('Save config error:', error);
    showStatus('❌ ' + error.message, 'error');
  }
}

// 测试配置
async function testConfig() {
  try {
    showStatus('🧪 正在测试配置...', 'info');
    
    // 创建测试图片
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.fillText('TEST', 30, 55);
    
    const testImageData = canvas.toDataURL('image/png');
    
    // 发送测试请求
    const response = await chrome.runtime.sendMessage({
      action: 'uploadImage',
      imageData: testImageData
    });
    
    if (response.success) {
      showStatus('✅ 测试成功！配置正确', 'success');
      console.log('Test response:', response.result);
    } else {
      showStatus('❌ 测试失败: ' + response.error, 'error');
    }
  } catch (error) {
    console.error('Test error:', error);
    showStatus('❌ 测试失败: ' + error.message, 'error');
  }
}

// 重置配置
async function resetConfig() {
  if (confirm('确定要重置为默认配置吗？')) {
    document.getElementById('headersContainer').innerHTML = '';
    document.getElementById('inputsContainer').innerHTML = '';
    setDefaultConfig();
    showStatus('🔄 已重置为默认配置', 'info');
  }
}

// 显示状态消息
function showStatus(message, type = 'info') {
  const statusDiv = document.getElementById('statusMessage');
  statusDiv.textContent = message;
  statusDiv.className = `status-message ${type} show`;
}

// 隐藏状态消息
function hideStatus() {
  const statusDiv = document.getElementById('statusMessage');
  statusDiv.classList.remove('show');
}

// 暴露全局函数
window.removeRow = removeRow;

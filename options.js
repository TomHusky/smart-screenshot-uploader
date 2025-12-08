// Options Page Script - 处理配置页面的交互

const parser = new CurlParser();
let currentConfig = null;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  initializeTabs();
  initializeForm();
  await loadConfig();
  setupEventListeners();
});

// 初始化Tab切换
function initializeTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      
      // 更新按钮状态
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // 切换内容
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(targetTab + 'Tab').classList.add('active');
    });
  });
}

// 初始化表单
function initializeForm() {
  // Content-Type选择
  const contentTypeSelect = document.getElementById('contentType');
  const customContentTypeGroup = document.getElementById('customContentTypeGroup');
  
  contentTypeSelect.addEventListener('change', () => {
    if (contentTypeSelect.value === 'custom') {
      customContentTypeGroup.style.display = 'block';
    } else {
      customContentTypeGroup.style.display = 'none';
    }
  });
  
  // 添加默认的Header行
  addHeaderRow();
  
  // 添加默认的Body参数行
  addBodyParamRow();
}

// 加载配置
async function loadConfig() {
  try {
    const result = await chrome.storage.sync.get('httpConfig');
    if (result.httpConfig) {
      currentConfig = result.httpConfig;
      populateForm(currentConfig);
    } else {
      currentConfig = parser.defaultConfig;
    }
  } catch (error) {
    console.error('Load config error:', error);
    showStatus('加载配置失败: ' + error.message, 'error');
  }
}

// 填充表单
function populateForm(config) {
  document.getElementById('requestMethod').value = config.method || 'POST';
  document.getElementById('requestUrl').value = config.url || '';
  document.getElementById('contentType').value = config.contentType || 'application/json';
  document.getElementById('customContentType').value = config.customContentType || '';
  document.getElementById('imageParamName').value = config.imageParamName || 'image_data';
  document.getElementById('timeout').value = config.timeout || 30;
  
  // 显示/隐藏自定义Content-Type
  if (config.contentType === 'custom') {
    document.getElementById('customContentTypeGroup').style.display = 'block';
  }
  
  // 填充Headers
  const headersContainer = document.getElementById('headersContainer');
  headersContainer.innerHTML = '';
  if (config.headers && config.headers.length > 0) {
    config.headers.forEach(header => {
      addHeaderRow(header.key, header.value);
    });
  } else {
    addHeaderRow();
  }
  
  // 填充Body参数
  const bodyParamsContainer = document.getElementById('bodyParamsContainer');
  bodyParamsContainer.innerHTML = '';
  if (config.bodyParams && config.bodyParams.length > 0) {
    config.bodyParams.forEach(param => {
      addBodyParamRow(param.key, param.value);
    });
  } else {
    addBodyParamRow();
  }
}

// 添加Header行
function addHeaderRow(key = '', value = '') {
  const container = document.getElementById('headersContainer');
  const row = document.createElement('div');
  row.className = 'param-row';
  row.innerHTML = `
    <input type="text" placeholder="Header名称" value="${escapeHtml(key)}" class="param-key">
    <input type="text" placeholder="Header值" value="${escapeHtml(value)}" class="param-value">
    <button type="button" class="btn-remove" title="删除">✕</button>
  `;
  
  row.querySelector('.btn-remove').addEventListener('click', () => {
    row.remove();
  });
  
  container.appendChild(row);
}

// 添加Body参数行
function addBodyParamRow(key = '', value = '') {
  const container = document.getElementById('bodyParamsContainer');
  const row = document.createElement('div');
  row.className = 'param-row';
  row.innerHTML = `
    <input type="text" placeholder="参数名" value="${escapeHtml(key)}" class="param-key">
    <input type="text" placeholder="参数值" value="${escapeHtml(value)}" class="param-value">
    <button type="button" class="btn-remove" title="删除">✕</button>
  `;
  
  row.querySelector('.btn-remove').addEventListener('click', () => {
    row.remove();
  });
  
  container.appendChild(row);
}

// 设置事件监听器
function setupEventListeners() {
  // 添加Header按钮
  document.getElementById('addHeader').addEventListener('click', () => {
    addHeaderRow();
  });
  
  // 添加Body参数按钮
  document.getElementById('addBodyParam').addEventListener('click', () => {
    addBodyParamRow();
  });
  
  // 表单提交
  document.getElementById('httpConfigForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveConfig();
  });
  
  // 测试配置
  document.getElementById('testConfig').addEventListener('click', testConfig);
  
  // 重置配置
  document.getElementById('resetConfig').addEventListener('click', resetConfig);
  
  // 解析cURL
  document.getElementById('parseCurl').addEventListener('click', parseCurl);
}

// 保存配置
async function saveConfig() {
  try {
    const config = getFormData();
    
    // 验证配置
    const validation = parser.validateConfig(config);
    if (!validation.valid) {
      showStatus('配置验证失败:\n' + validation.errors.join('\n'), 'error');
      return;
    }
    
    // 保存到storage
    await chrome.storage.sync.set({ httpConfig: config });
    currentConfig = config;
    
    showStatus('✅ 配置保存成功!', 'success');
    setTimeout(() => {
      hideStatus();
    }, 2000);
  } catch (error) {
    console.error('Save config error:', error);
    showStatus('保存失败: ' + error.message, 'error');
  }
}

// 获取表单数据
function getFormData() {
  const config = {
    method: document.getElementById('requestMethod').value,
    url: document.getElementById('requestUrl').value.trim(),
    contentType: document.getElementById('contentType').value,
    customContentType: document.getElementById('customContentType').value.trim(),
    imageParamName: document.getElementById('imageParamName').value.trim(),
    timeout: parseInt(document.getElementById('timeout').value, 10),
    headers: [],
    bodyParams: []
  };
  
  // 收集Headers
  document.querySelectorAll('#headersContainer .param-row').forEach(row => {
    const key = row.querySelector('.param-key').value.trim();
    const value = row.querySelector('.param-value').value.trim();
    if (key && value) {
      config.headers.push({ key, value });
    }
  });
  
  // 收集Body参数
  document.querySelectorAll('#bodyParamsContainer .param-row').forEach(row => {
    const key = row.querySelector('.param-key').value.trim();
    const value = row.querySelector('.param-value').value.trim();
    if (key) {
      config.bodyParams.push({ key, value });
    }
  });
  
  return config;
}

// 测试配置
async function testConfig() {
  try {
    const config = getFormData();
    
    // 验证配置
    const validation = parser.validateConfig(config);
    if (!validation.valid) {
      showStatus('配置验证失败:\n' + validation.errors.join('\n'), 'error');
      return;
    }
    
    // 生成等效的cURL命令
    const curlCommand = parser.toCurl(config);
    
    showStatus(`✅ 配置验证通过!\n\n等效cURL命令:\n${curlCommand}`, 'success');
  } catch (error) {
    console.error('Test config error:', error);
    showStatus('测试失败: ' + error.message, 'error');
  }
}

// 重置配置
async function resetConfig() {
  if (!confirm('确定要重置为默认配置吗？')) {
    return;
  }
  
  try {
    const defaultConfig = parser.defaultConfig;
    await chrome.storage.sync.set({ httpConfig: defaultConfig });
    currentConfig = defaultConfig;
    populateForm(defaultConfig);
    showStatus('✅ 已重置为默认配置', 'success');
    setTimeout(() => {
      hideStatus();
    }, 2000);
  } catch (error) {
    console.error('Reset config error:', error);
    showStatus('重置失败: ' + error.message, 'error');
  }
}

// 解析cURL命令
function parseCurl() {
  const curlInput = document.getElementById('curlInput').value.trim();
  const resultDiv = document.getElementById('curlParseResult');
  
  if (!curlInput) {
    resultDiv.innerHTML = '<div class="error">请输入cURL命令</div>';
    return;
  }
  
  try {
    const config = parser.parse(curlInput);
    
    // 填充到表单
    populateForm(config);
    
    // 切换到手动配置Tab
    document.querySelector('[data-tab="manual"]').click();
    
    resultDiv.innerHTML = '<div class="success">✅ 解析成功! 配置已导入到手动配置选项卡</div>';
    
    setTimeout(() => {
      resultDiv.innerHTML = '';
    }, 3000);
  } catch (error) {
    console.error('Parse cURL error:', error);
    resultDiv.innerHTML = `<div class="error">❌ 解析失败: ${escapeHtml(error.message)}</div>`;
  }
}

// 显示状态消息
function showStatus(message, type = 'info') {
  const statusDiv = document.getElementById('statusMessage');
  statusDiv.textContent = message;
  statusDiv.className = 'status-message status-' + type;
  statusDiv.style.display = 'block';
}

// 隐藏状态消息
function hideStatus() {
  document.getElementById('statusMessage').style.display = 'none';
}

// HTML转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

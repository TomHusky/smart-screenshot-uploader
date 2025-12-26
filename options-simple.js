// Dify 工作流配置页面脚本 - 支持多场景配置

let currentConfig = null;
let scenarios = [];
let currentScenarioId = null;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadScenarios();
  setupEventListeners();
  setupSidebarNavigation();
  showPanel('scenario');
});

// 设置侧边栏导航
function setupSidebarNavigation() {
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      const panelId = item.dataset.panel;
      showPanel(panelId);
    });
  });
}

// 显示指定面板
function showPanel(panelId) {
  // 更新侧边栏激活状态
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`[data-panel="${panelId}"]`).classList.add('active');
  
  // 显示对应面板
  document.querySelectorAll('.content-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  document.getElementById(`panel-${panelId}`).classList.add('active');
  
  // 控制底部操作栏显示
  const actionsPanel = document.getElementById('globalActions');
  if (actionsPanel) {
    if (panelId === 'scenario') {
      actionsPanel.style.display = 'none';
    } else {
      actionsPanel.style.display = 'flex';
    }
  }
}

// 设置事件监听
function setupEventListeners() {
  // 场景管理
  document.getElementById('addScenarioBtn').addEventListener('click', addScenario);
  document.getElementById('newScenarioName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addScenario();
    }
  });
  
  // 场景列表事件委托
  document.getElementById('scenarioList').addEventListener('click', (e) => {
    const target = e.target;
    
    // 删除场景
    if (target.classList.contains('scenario-btn-delete')) {
      const scenarioId = target.dataset.scenarioId;
      if (scenarioId) {
        deleteScenario(scenarioId);
      }
      return;
    }
    
    // 编辑场景
    if (target.classList.contains('scenario-btn-edit')) {
      const scenarioId = target.dataset.scenarioId;
      if (scenarioId) {
        switchScenario(scenarioId);
        showPanel('basic');
      }
      return;
    }
    
    // 点击卡片切换场景
    const item = target.closest('.scenario-item');
    if (item && !target.closest('.scenario-actions')) {
      const scenarioId = item.dataset.scenarioId;
      if (scenarioId) {
        switchScenario(scenarioId);
      }
    }
  });
  
    // 配置表单
  document.getElementById('configForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveCurrentScenarioConfig();
  });

  // 全局保存按钮
  const saveBtn = document.getElementById('saveConfigBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      await saveCurrentScenarioConfig();
    });
  }
  
  // 场景选择器
  
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
  document.getElementById('resetConfig').addEventListener('click', resetCurrentScenario);
}

// ==================== 场景管理功能 ====================

// 加载所有场景
async function loadScenarios() {
  try {
    const result = await chrome.storage.sync.get(['scenarios', 'currentScenarioId']);
    scenarios = result.scenarios || [];
    
    // 如果没有场景，创建默认场景
    if (scenarios.length === 0) {
      const defaultScenario = {
        id: generateId(),
        name: '默认场景',
        isDefault: true,
        config: createDefaultConfig()
      };
      scenarios.push(defaultScenario);
      await saveScenarios();
    }
    
    // 设置当前场景
    currentScenarioId = result.currentScenarioId || scenarios.find(s => s.isDefault)?.id;
    
    renderScenarios();
    
    // 如果有当前场景，加载其配置
    if (currentScenarioId) {
      loadScenarioConfig(currentScenarioId);
    }
  } catch (error) {
    console.error('Load scenarios error:', error);
    showStatus('加载场景失败: ' + error.message, 'error');
  }
}

// 保存场景列表
async function saveScenarios() {
  try {
    await chrome.storage.sync.set({
      scenarios: scenarios,
      currentScenarioId: currentScenarioId
    });
  } catch (error) {
    console.error('Save scenarios error:', error);
  }
}

// 添加新场景
async function addScenario() {
  const input = document.getElementById('newScenarioName');
  const name = input.value.trim();
  
  if (!name) {
    showStatus('请输入场景名称', 'error');
    return;
  }
  
  if (scenarios.some(s => s.name === name)) {
    showStatus('场景名称已存在', 'error');
    return;
  }
  
  const newScenario = {
    id: generateId(),
    name: name,
    isDefault: false,
    config: createDefaultConfig()
  };
  
  scenarios.push(newScenario);
  await saveScenarios();
  
  input.value = '';
  renderScenarios();
  
  showStatus('场景添加成功', 'success');
}

// 删除场景
async function deleteScenario(scenarioId) {
  if (scenarios.length <= 1) {
    showStatus('至少保留一个场景', 'error');
    return;
  }
  
  if (!confirm('确定要删除这个场景吗？删除后无法恢复。')) {
    return;
  }
  
  const index = scenarios.findIndex(s => s.id === scenarioId);
  if (index === -1) return;
  
  const wasDefault = scenarios[index].isDefault;
  const wasCurrent = currentScenarioId === scenarioId;
  
  scenarios.splice(index, 1);
  
  // 如果删除的是默认场景，将第一个场景设为默认
  if (wasDefault && scenarios.length > 0) {
    scenarios[0].isDefault = true;
  }
  
  // 如果删除的是当前场景，切换到默认场景
  if (wasCurrent) {
    currentScenarioId = scenarios.find(s => s.isDefault)?.id;
    // 重新加载配置
    if (currentScenarioId) {
      loadScenarioConfig(currentScenarioId);
    }
  }
  
  await saveScenarios();
  renderScenarios();
  
  showStatus('场景删除成功', 'success');
}

// 设置默认场景
async function setDefaultScenario(scenarioId) {
  scenarios.forEach(s => s.isDefault = false);
  const scenario = scenarios.find(s => s.id === scenarioId);
  if (scenario) {
    scenario.isDefault = true;
    await saveScenarios();
    renderScenarios();
    showStatus('默认场景设置成功', 'success');
  }
}

// 切换场景
function switchScenario(scenarioId) {
  currentScenarioId = scenarioId;
  loadScenarioConfig(scenarioId);
  renderScenarios(); // 重新渲染以更新选中状态
  showStatus('已切换到场景: ' + scenarios.find(s => s.id === scenarioId)?.name, 'info');
}

// 渲染场景列表
function renderScenarios() {
  const container = document.getElementById('scenarioList');
  container.innerHTML = '';
  
  if (scenarios.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">🎬</div>
        <p>暂无场景，请添加一个场景开始使用</p>
      </div>
    `;
    return;
  }
  
  scenarios.forEach(scenario => {
    const item = document.createElement('div');
    const isActive = scenario.id === currentScenarioId;
    item.className = `scenario-item ${scenario.isDefault ? 'default' : ''} ${isActive ? 'active' : ''}`;
    item.dataset.scenarioId = scenario.id;
    
    item.innerHTML = `
      <div class="scenario-info">
        <div class="scenario-name">
          ${escapeHtml(scenario.name)}
          ${isActive ? '<span class="scenario-active-badge">当前</span>' : ''}
        </div>
      </div>
      <div class="scenario-actions">
        <button class="scenario-btn scenario-btn-edit" data-scenario-id="${scenario.id}">编辑</button>
        ${scenarios.length > 1 ? `<button class="scenario-btn scenario-btn-delete" data-scenario-id="${scenario.id}">删除</button>` : ''}
      </div>
    `;
    
    container.appendChild(item);
  });
}

// ==================== 配置管理功能 ====================

// 创建默认配置
function createDefaultConfig() {
  return {
    method: 'POST',
    url: 'https://dify-api.duodian.cn/v1/chat-messages',
    contentType: 'application/json',
    timeout: 30,
    headers: [
      { key: 'Authorization', value: 'Bearer ' },
      { key: 'Content-Type', value: 'application/json' }
    ],
    jsonBody: JSON.stringify({
      inputs: {
        image: '{{imageBase64}}',
        query: '请分析这张图片'
      },
      response_mode: 'streaming',
      user: 'chrome-extension-user'
    }, null, 2),
    bodyParams: []
  };
}

// 加载场景配置
async function loadScenarioConfig(scenarioId) {
  const scenario = scenarios.find(s => s.id === scenarioId);
  if (!scenario) return;
  
  currentConfig = scenario.config;
  populateForm(currentConfig);
}

// 保存当前场景配置
async function saveCurrentScenarioConfig() {
  if (!currentScenarioId) {
    showStatus('请先选择一个场景', 'error');
    return;
  }
  
  try {
    const config = buildConfigFromForm();
    const scenario = scenarios.find(s => s.id === currentScenarioId);
    if (scenario) {
      scenario.config = config;
      await saveScenarios();
      currentConfig = config;
      
      // 同时保存到全局配置（向后兼容）
      await chrome.storage.sync.set({ httpConfig: config });
      
      showStatus('✅ 配置保存成功！', 'success');
      setTimeout(() => hideStatus(), 3000);
    }
  } catch (error) {
    console.error('Save config error:', error);
    showStatus('❌ ' + error.message, 'error');
  }
}

// 重置当前场景配置
async function resetCurrentScenario() {
  if (!currentScenarioId) return;
  
  if (!confirm('确定要重置当前场景的配置吗？')) return;
  
  const scenario = scenarios.find(s => s.id === currentScenarioId);
  if (scenario) {
    scenario.config = createDefaultConfig();
    await saveScenarios();
    loadScenarioConfig(currentScenarioId);
    showStatus('🔄 已重置为默认配置', 'info');
  }
}

// 构建表单配置
function buildConfigFromForm() {
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
  
  // 构建完整的 HTTP 配置
  return {
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
    bodyParams: []
  };
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

// ==================== 工具函数 ====================

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

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
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
window.setDefaultScenario = setDefaultScenario;
window.deleteScenario = deleteScenario;

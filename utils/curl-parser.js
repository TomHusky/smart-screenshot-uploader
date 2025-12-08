// cURL Parser - 解析cURL命令为HTTP配置

class CurlParser {
  constructor() {
    this.defaultConfig = {
      method: 'GET',
      url: '',
      headers: [],
      contentType: 'application/json',
      customContentType: '',
      bodyParams: [],
      imageParamName: 'image_data',
      timeout: 30
    };
  }

  /**
   * 解析cURL命令
   * @param {string} curlCommand - cURL命令字符串
   * @returns {Object} 解析后的HTTP配置对象
   */
  parse(curlCommand) {
    if (!curlCommand || typeof curlCommand !== 'string') {
      throw new Error('无效的cURL命令');
    }

    const config = { ...this.defaultConfig };
    
    // 清理命令，移除换行和多余空格
    let cleanCommand = curlCommand
      .replace(/\\\n/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 移除开头的curl命令
    cleanCommand = cleanCommand.replace(/^curl\s+/, '');

    // 提取URL (可能在引号中或直接跟在curl后面)
    const urlMatch = cleanCommand.match(/(?:^|\s)(['"]?)((https?:\/\/|\/)[^\s'"]+)\1/);
    if (urlMatch) {
      config.url = urlMatch[2];
      cleanCommand = cleanCommand.replace(urlMatch[0], '');
    }

    // 提取请求方法 (-X 或 --request)
    const methodMatch = cleanCommand.match(/(?:-X|--request)\s+(['"]?)(\w+)\1/i);
    if (methodMatch) {
      config.method = methodMatch[2].toUpperCase();
    }

    // 提取请求头 (-H 或 --header)
    const headerRegex = /(?:-H|--header)\s+(['"])([^'"]+)\1/g;
    let headerMatch;
    while ((headerMatch = headerRegex.exec(cleanCommand)) !== null) {
      const headerLine = headerMatch[2];
      const colonIndex = headerLine.indexOf(':');
      if (colonIndex > 0) {
        const key = headerLine.substring(0, colonIndex).trim();
        const value = headerLine.substring(colonIndex + 1).trim();
        
        // 检查是否是Content-Type
        if (key.toLowerCase() === 'content-type') {
          this.parseContentType(value, config);
        } else {
          config.headers.push({ key, value });
        }
      }
    }

    // 提取请求体数据 (-d, --data, --data-raw, --data-binary, --data-urlencode)
    const dataRegex = /(?:-d|--data|--data-raw|--data-binary|--data-urlencode)\s+(['"])([^'"]*)\1/g;
    let dataMatch;
    let bodyData = '';
    
    while ((dataMatch = dataRegex.exec(cleanCommand)) !== null) {
      if (bodyData) bodyData += '&';
      bodyData += dataMatch[2];
    }

    // 解析--json参数 (较新的curl版本)
    const jsonMatch = cleanCommand.match(/--json\s+(['"])([^'"]+)\1/);
    if (jsonMatch) {
      bodyData = jsonMatch[2];
      config.contentType = 'application/json';
    }

    // 解析请求体数据
    if (bodyData) {
      this.parseBodyData(bodyData, config);
      
      // 如果没有显式的method，且有body数据，默认为POST
      if (!methodMatch && bodyData) {
        config.method = 'POST';
      }
    }

    // 提取超时设置 (--max-time 或 -m)
    const timeoutMatch = cleanCommand.match(/(?:--max-time|-m)\s+(\d+)/);
    if (timeoutMatch) {
      config.timeout = parseInt(timeoutMatch[1], 10);
    }

    // 验证URL
    if (!config.url) {
      throw new Error('未找到有效的URL');
    }

    return config;
  }

  /**
   * 解析Content-Type
   */
  parseContentType(contentTypeValue, config) {
    const contentType = contentTypeValue.toLowerCase().split(';')[0].trim();
    
    if (contentType === 'application/json') {
      config.contentType = 'application/json';
    } else if (contentType === 'multipart/form-data') {
      config.contentType = 'multipart/form-data';
    } else if (contentType === 'application/x-www-form-urlencoded') {
      config.contentType = 'application/x-www-form-urlencoded';
    } else {
      config.contentType = 'custom';
      config.customContentType = contentTypeValue;
    }
  }

  /**
   * 解析请求体数据
   */
  parseBodyData(bodyData, config) {
    try {
      // 尝试解析为JSON
      const jsonData = JSON.parse(bodyData);
      config.contentType = 'application/json';
      
      // 将JSON对象转换为键值对
      if (typeof jsonData === 'object' && jsonData !== null) {
        config.bodyParams = Object.entries(jsonData).map(([key, value]) => ({
          key,
          value: typeof value === 'string' ? value : JSON.stringify(value)
        }));
      }
    } catch {
      // 不是JSON，尝试解析为URL编码或Form数据
      if (bodyData.includes('=')) {
        // URL编码格式: key1=value1&key2=value2
        const params = bodyData.split('&');
        config.bodyParams = params.map(param => {
          const [key, ...valueParts] = param.split('=');
          return {
            key: decodeURIComponent(key),
            value: decodeURIComponent(valueParts.join('='))
          };
        }).filter(p => p.key);
        
        if (!config.contentType || config.contentType === 'application/json') {
          config.contentType = 'application/x-www-form-urlencoded';
        }
      } else {
        // 原始数据
        config.bodyParams = [{ key: 'data', value: bodyData }];
      }
    }
  }

  /**
   * 将配置转换为cURL命令（用于测试和验证）
   */
  toCurl(config) {
    let curl = 'curl';
    
    // 添加方法
    if (config.method && config.method !== 'GET') {
      curl += ` -X ${config.method}`;
    }
    
    // 添加URL
    curl += ` '${config.url}'`;
    
    // 添加请求头
    if (config.headers && config.headers.length > 0) {
      config.headers.forEach(header => {
        if (header.key && header.value) {
          curl += ` \\\n  -H '${header.key}: ${header.value}'`;
        }
      });
    }
    
    // 添加Content-Type
    const contentType = config.contentType === 'custom' 
      ? config.customContentType 
      : config.contentType;
    
    if (contentType && config.method !== 'GET') {
      curl += ` \\\n  -H 'Content-Type: ${contentType}'`;
    }
    
    // 添加请求体
    if (config.bodyParams && config.bodyParams.length > 0 && config.method !== 'GET') {
      if (config.contentType === 'application/json') {
        const jsonBody = {};
        config.bodyParams.forEach(param => {
          if (param.key) {
            try {
              jsonBody[param.key] = JSON.parse(param.value);
            } catch {
              jsonBody[param.key] = param.value;
            }
          }
        });
        curl += ` \\\n  -d '${JSON.stringify(jsonBody)}'`;
      } else {
        const bodyData = config.bodyParams
          .filter(p => p.key)
          .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value || '')}`)
          .join('&');
        curl += ` \\\n  -d '${bodyData}'`;
      }
    }
    
    return curl;
  }

  /**
   * 验证配置
   */
  validateConfig(config) {
    const errors = [];
    
    if (!config.url) {
      errors.push('URL不能为空');
    } else {
      try {
        new URL(config.url);
      } catch {
        errors.push('URL格式不正确');
      }
    }
    
    if (!config.method) {
      errors.push('请求方法不能为空');
    }
    
    if (!config.imageParamName) {
      errors.push('截图数据参数名不能为空');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// 导出供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CurlParser;
}

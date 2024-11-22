chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    proxyHost: 'localhost', 
    proxyPort: '8080',
    useSystemProxy: false,
    proxyDomains: '',
    proxyType: 'http'
  });
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.useSystemProxy || 
      changes.proxyHost || 
      changes.proxyPort || 
      changes.proxyDomains ||
      changes.proxyType) {
    chrome.storage.local.get(
      ['useSystemProxy', 'proxyHost', 'proxyPort', 'proxyDomains', 'proxyType'],
      (data) => {
        updateProxy(data);
        updateAllTabs(data.useSystemProxy);
      }
    );
  }
});

async function loadProxyList() {
  try {
    const response = await fetch(chrome.runtime.getURL('proxy-list.txt'));
    const text = await response.text();
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch (error) {
    console.error('Error loading proxy list:', error);
    return [];
  }
}

function convertToMatchPattern(domain) {
  domain = domain.trim();
  if (!domain) return null;
  
  // 保存代理类型前缀
  let prefix = '';
  if (domain.startsWith('socks5://')) {
    prefix = 'socks5://';
    domain = domain.slice(8);
  } else if (domain.startsWith('http://')) {
    prefix = 'http://';
    domain = domain.slice(7);
  } else if (domain.startsWith('https://')) {
    prefix = 'https://';
    domain = domain.slice(8);
  }
  
  // Remove protocol if present (除了已处理的特殊前缀)
  domain = domain.replace(/^https?:\/\//, '');
  
  // Handle wildcards
  if (domain.startsWith('*.')) {
    return prefix + '*.' + domain.slice(2);
  }
  
  return prefix + domain;
}

function isMatchingDomain(host, pattern) {
  // Remove any protocol
  host = host.replace(/^https?:\/\//, '');
  
  // Handle regexp patterns
  if (pattern.startsWith('regexp:')) {
    const regexStr = pattern.slice(7); // Remove 'regexp:' prefix
    try {
      const regex = new RegExp(regexStr);
      return regex.test(host);
    } catch (e) {
      console.error('Invalid regex pattern:', pattern, e);
      return false;
    }
  }
  
  // Handle wildcard patterns
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2);
    return host === suffix || host.endsWith('.' + suffix);
  }
  
  // Handle exact domain matches (including subdomains)
  return host === pattern || host.endsWith('.' + pattern);
}

async function updateProxy(data) {
  const { useSystemProxy, proxyHost, proxyPort, proxyType } = data;

  console.log('[Proxy Debug] Current settings:', {
    useSystemProxy,
    proxyHost,
    proxyPort,
    proxyType,
  });

  if (!useSystemProxy) {
    console.log('[Proxy] Disabled - clearing settings');
    chrome.proxy.settings.clear({scope: "regular"});
    return;
  }

  // Validate proxy settings
  if (!proxyHost || !proxyPort) {
    console.error('[Proxy] Invalid proxy settings');
    return;
  }

  // Load domains from proxy-list.txt
  const proxyListDomains = await loadProxyList();
  const userDomains = data.proxyDomains
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // 配置代理设置
  const config = {
    value: {
      mode: "pac_script",
      pacScript: {
        data: `
          function FindProxyForURL(url, host) {
            var domains = ${JSON.stringify([...proxyListDomains, ...userDomains.filter(d => !d.startsWith('!'))])};
            var cleanHost = host.replace(/^www\./, '');
            
            console.log('[PAC Debug] Checking host:', host, 'cleaned:', cleanHost);
            
            for (var i = 0; i < domains.length; i++) {
              var pattern = domains[i];
              pattern = pattern.replace(/^www\./, '');
              
              if (cleanHost === pattern || cleanHost.endsWith('.' + pattern)) {
                console.log('[PAC Debug] Match found! Pattern:', pattern);
                return '${data.proxyType.toUpperCase()} ${proxyHost}:${proxyPort}';
              }
            }
            
            console.log('[PAC Debug] No match found, using DIRECT');
            return 'DIRECT';
          }
        `
      }
    },
    scope: "regular"
  };

  // 应用代理设置
  chrome.proxy.settings.set(config, () => {
    if (chrome.runtime.lastError) {
      console.error('[Proxy Error]', chrome.runtime.lastError);
    } else {
      console.log('[Proxy] Settings applied successfully');
      console.log('[Proxy] Active configuration:', config);
    }
  });

  // 获取当前的代理设置以验证
  chrome.proxy.settings.get({}, (details) => {
    console.log('[Proxy] Current settings:', details);
  });
}

function updateAllTabs(useSystemProxy) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      try {
        if (!tab.url || tab.url.startsWith('chrome://')) return;
        
        const url = new URL(tab.url);
        chrome.storage.local.get(['proxyDomains'], async (data) => {
          const proxyListDomains = await loadProxyList();
          const matchedPattern = proxyListDomains.find(pattern => 
            isMatchingDomain(url.hostname, convertToMatchPattern(pattern))
          );

          try {
            chrome.tabs.sendMessage(tab.id, {
              action: useSystemProxy ? 
                (matchedPattern ? 'showProxyIndicator' : 'showDirectIndicator') : 
                'showDirectIndicator'
            });
          } catch (e) {
            console.error('发送消息失败:', e);
          }
        });
      } catch (e) {
        console.error('处理标签页失败:', e);
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getProxyStatus') {
    chrome.storage.local.get(['useSystemProxy'], async (data) => {
      try {
        if (!sender.tab?.url) {
          sendResponse({proxyEnabled: false, proxyType: 'direct'});
          return;
        }

        if (!data.useSystemProxy) {
          sendResponse({proxyEnabled: false, proxyType: 'direct'});
          return;
        }

        const url = new URL(sender.tab.url);
        const proxyListDomains = await loadProxyList();
        const matchedPattern = proxyListDomains.find(pattern => 
          isMatchingDomain(url.hostname, convertToMatchPattern(pattern))
        );

        sendResponse({
          proxyEnabled: matchedPattern ? true : false,
          proxyType: matchedPattern ? 'proxy' : 'direct'
        });
      } catch (e) {
        console.error('检查代理状态失败:', e);
        sendResponse({proxyEnabled: false, proxyType: 'direct'});
      }
    });
    return true;
  }
});

// Enhance request logging
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = new URL(details.url);
    const timestamp = new Date().toLocaleTimeString();
    
    chrome.storage.local.get(['useSystemProxy', 'proxyHost', 'proxyPort'], async (data) => {
      if (!data.useSystemProxy) {
        console.log(`[${timestamp}] DIRECT: ${url.hostname} (${details.type})`);
        return;
      }

      const proxyListDomains = await loadProxyList();
      const matchedPattern = proxyListDomains.find(pattern => 
        isMatchingDomain(url.hostname, pattern)
      );

      if (matchedPattern) {
        console.log(`[${timestamp}] PROXY (${data.proxyHost}:${data.proxyPort}): ${url.hostname} matched ${matchedPattern} (${details.type})`);
      } else {
        console.log(`[${timestamp}] DIRECT: ${url.hostname} (${details.type})`);
      }
    });
  },
  {urls: ["<all_urls>"]},
  []
);
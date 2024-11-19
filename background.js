chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    proxyHost: 'localhost', 
    proxyPort: '8080',
    useSystemProxy: false,
    proxyDomains: ''
  });
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.useSystemProxy || changes.proxyHost || changes.proxyPort || changes.proxyDomains) {
    chrome.storage.local.get(['useSystemProxy', 'proxyHost', 'proxyPort', 'proxyDomains'], (data) => {
      updateProxy(data);
      updateAllTabs(data.useSystemProxy);
    });
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
  
  // Remove protocol if present
  domain = domain.replace(/^https?:\/\//, '');
  
  // Handle wildcards
  if (domain.startsWith('*.')) {
    return '*.' + domain.slice(2);
  }
  
  return domain;
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
  const { useSystemProxy, proxyHost, proxyPort } = data;

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

  console.log('[Proxy] Enabled - configuring settings');
  console.log('[Proxy] Using host:', proxyHost, 'port:', proxyPort);

  // Load domains from proxy-list.txt
  const proxyListDomains = await loadProxyList();
  
  // Get user-defined domains and split into include/exclude lists
  const userDomains = data.proxyDomains
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const includeDomains = userDomains
    .filter(domain => !domain.startsWith('!'))
    .map(convertToMatchPattern)
    .filter(Boolean);

  const excludeDomains = userDomains
    .filter(domain => domain.startsWith('!'))
    .map(domain => convertToMatchPattern(domain.slice(1)))
    .filter(Boolean);

  // Filter out excluded domains from the proxy list
  const filteredProxyList = proxyListDomains
    .filter(domain => {
      const pattern = convertToMatchPattern(domain);
      return !excludeDomains.some(excludePattern => {
        if (excludePattern.startsWith('*.')) {
          const suffix = excludePattern.slice(2);
          return pattern.endsWith(suffix) || pattern === suffix;
        }
        return pattern === excludePattern;
      });
    })
    .map(convertToMatchPattern)
    .filter(Boolean);

  // Combine filtered proxy list with include domains
  const allDomains = [...filteredProxyList, ...includeDomains];

  // Configure proxy settings
  chrome.proxy.settings.set({
    value: {
      mode: "pac_script",
      pacScript: {
        data: `
          function isMatchingDomain(host, pattern) {
            // Handle regexp patterns
            if (pattern.startsWith('regexp:')) {
              const regexStr = pattern.slice(7);
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

          function FindProxyForURL(url, host) {
            // List of domains that should use proxy
            var proxyDomains = ${JSON.stringify(allDomains)};
            
            // 获取URL的协议
            var scheme = url.split(':')[0].toLowerCase();
            
            // Check if the host matches any proxy domain
            for (var i = 0; i < proxyDomains.length; i++) {
              if (isMatchingDomain(host, proxyDomains[i])) {
                // 根据不同协议返回对应的代理字符串
                if (scheme === 'http') {
                  return 'PROXY ${proxyHost}:${proxyPort}';
                } else if (scheme === 'https') {
                  return 'HTTPS ${proxyHost}:${proxyPort}';
                } else {
                  return 'SOCKS5 ${proxyHost}:${proxyPort}';
                }
              }
            }
            
            return 'SYSTEM';
          }
        `
      }
    },
    scope: "regular"
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('[Proxy Error]', chrome.runtime.lastError);
    } else {
      console.log('[Proxy] Settings applied successfully');
    }
  });

  // Log the current proxy configuration
  console.log('[Proxy Config] Total patterns:', allDomains.length);
  console.log('[Proxy Config] Proxy patterns:', allDomains);
  if (excludeDomains.length > 0) {
    console.log('[Proxy Config] Excluded patterns:', excludeDomains);
  }
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
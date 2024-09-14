chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({proxyEnabled: false, proxyHost: 'localhost', proxyPort: '8080'});
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.proxyEnabled) {
    updateProxy(changes.proxyEnabled.newValue);
    updateAllTabs(changes.proxyEnabled.newValue);
  }
});

function updateProxy(enabled) {
  if (enabled) {
    chrome.storage.local.get(['proxyHost', 'proxyPort'], function(data) {
      chrome.proxy.settings.set({
        value: {
          mode: "fixed_servers",
          rules: {
            singleProxy: {
              scheme: "http",
              host: data.proxyHost,
              port: parseInt(data.proxyPort)
            }
          }
        },
        scope: "regular"
      });
    });
  } else {
    chrome.proxy.settings.clear({scope: "regular"});
  }
}

function updateAllTabs(proxyEnabled) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, {
        action: proxyEnabled ? 'showProxyIndicator' : 'hideProxyIndicator'
      });
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getProxyStatus') {
    chrome.storage.local.get('proxyEnabled', (data) => {
      sendResponse({proxyEnabled: data.proxyEnabled});
    });
    return true;  // 保持消息通道打开，直到sendResponse被调用
  }
});
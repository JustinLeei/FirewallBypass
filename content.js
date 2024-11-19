// alert("Content script loaded");
function addStatusIndicator(isProxy) {
    let indicator = document.createElement('div');
    indicator.textContent = isProxy ? 'Using Proxy' : 'Using Direct';
    indicator.style.cssText = `
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      background-color: ${isProxy ? 'red' : 'green'};
      color: white;
      padding: 2px 10px;
      border-bottom-left-radius: 5px;
      border-bottom-right-radius: 5px;
      z-index: 9999;
      font-weight: bold;
      font-size: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(indicator);
}
  
function removeStatusIndicator() {
    let indicator = document.querySelector('div[style*="position: fixed"]');
    if (indicator) {
        indicator.remove();
    }
}
  
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showProxyIndicator') {
        removeStatusIndicator(); // 先移除已存在的指示器
        addStatusIndicator(true);
    } else if (request.action === 'showSystemProxyIndicator') {
        removeStatusIndicator(); // 先移除已存在的指示器
        addStatusIndicator(true);
    } else if (request.action === 'showDirectIndicator') {
        removeStatusIndicator();
    }
});
  
// 页面加载时检查代理状态
chrome.runtime.sendMessage({action: 'getProxyStatus'}, (response) => {
    if (response) {  // 确保response存在
        removeStatusIndicator();  // 先移除已存在的指示器
        addStatusIndicator(response.proxyEnabled);
    }
});
  
// 添加错误处理
window.addEventListener('error', (e) => {
    console.error('Content script error:', e);
});
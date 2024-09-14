// alert("Content script loaded");
function addProxyIndicator() {
    let indicator = document.createElement('div');
    indicator.textContent = 'Using Proxy';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background-color: red;
      color: white;
      padding: 5px 10px;
      border-radius: 5px;
      z-index: 9999;
      font-weight: bold;
    `;
    document.body.appendChild(indicator);
  }
  
  function removeProxyIndicator() {
    let indicator = document.querySelector('div[style*="Using Proxy"]');
    if (indicator) {
      indicator.remove();
    }
  }
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showProxyIndicator') {
        console.log("showProxyIndicator")
      addProxyIndicator();
    } else if (request.action === 'hideProxyIndicator') {
      removeProxyIndicator();
    }
  });
  
  // Check proxy status on page load
  chrome.runtime.sendMessage({action: 'getProxyStatus'}, (response) => {
    if (response.proxyEnabled) {
      addProxyIndicator();
    }
  });
document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.local.get(['proxyEnabled', 'proxyHost', 'proxyPort'], function(data) {
      document.getElementById('enableProxy').checked = data.proxyEnabled;
      document.getElementById('proxyHost').value = data.proxyHost;
      document.getElementById('proxyPort').value = data.proxyPort;
    });
    document.getElementById('saveButton').addEventListener('click', function() {
      const enabled = document.getElementById('enableProxy').checked;
      const host = document.getElementById('proxyHost').value;
      const port = document.getElementById('proxyPort').value
  
      chrome.storage.local.set(
        {
          proxyEnabled: enabled, 
          proxyHost: host, 
          proxyPort: port},
          ()=>{ alert('proxy is already saved');
        }
       );
    });
  });

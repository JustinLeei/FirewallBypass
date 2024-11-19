document.addEventListener('DOMContentLoaded', function() {
    // Load settings
    chrome.storage.local.get(
        ['proxyHost', 'proxyPort', 'useSystemProxy', 'proxyDomains', 'proxyType'],
        function(data) {
            document.getElementById('proxyHost').value = data.proxyHost;
            document.getElementById('proxyPort').value = data.proxyPort;
            document.getElementById('proxyType').value = data.proxyType || 'http';
            document.getElementById('useSystemProxy').checked = data.useSystemProxy;
            document.getElementById('proxyDomains').value = data.proxyDomains || '';
            
            updateControlsState(data.useSystemProxy);
        }
    );

    // Add change event for useSystemProxy checkbox
    document.getElementById('useSystemProxy').addEventListener('change', function(e) {
        updateControlsState(e.target.checked);
    });

    function updateControlsState(proxyEnabled) {
        const manualControls = ['proxyHost', 'proxyPort', 'proxyDomains'];
        manualControls.forEach(id => {
            document.getElementById(id).disabled = !proxyEnabled;
        });
    }

    const modal = document.getElementById('proxyListModal');
    const viewListBtn = document.getElementById('viewProxyList');
    const closeModal = document.getElementById('closeModal');
    const proxyListContent = document.getElementById('proxyListContent');
    const searchBox = document.getElementById('searchBox');
    const resultCount = document.getElementById('resultCount');
    
    let allDomains = []; // Store all domains

    viewListBtn.addEventListener('click', async function() {
        try {
            const response = await fetch(chrome.runtime.getURL('proxy-list.txt'));
            const text = await response.text();
            allDomains = text.split('\n')
                           .map(line => line.trim())
                           .filter(line => line && !line.startsWith('#'));
            
            displayFilteredDomains(allDomains);
            modal.style.display = 'block';
            searchBox.focus(); // Focus search box when modal opens
        } catch (error) {
            console.error('Error loading proxy list:', error);
            proxyListContent.textContent = 'Error loading proxy list';
        }
    });

    // Search functionality
    let searchTimeout;
    searchBox.addEventListener('input', function() {
        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        // Add debounce to prevent too many updates
        searchTimeout = setTimeout(() => {
            const searchTerm = this.value.toLowerCase();
            const filteredDomains = allDomains.filter(domain => 
                domain.toLowerCase().includes(searchTerm)
            );
            displayFilteredDomains(filteredDomains, searchTerm);
        }, 300);
    });

    function displayFilteredDomains(domains, searchTerm = '') {
        // Update count display
        resultCount.textContent = `Showing ${domains.length} of ${allDomains.length} domains`;

        // If there's a search term, highlight it in the results
        if (searchTerm) {
            const highlightedDomains = domains.map(domain => {
                const regex = new RegExp(searchTerm, 'gi');
                return domain.replace(regex, match => `<span style="background-color: yellow">${match}</span>`);
            });
            proxyListContent.innerHTML = highlightedDomains.join('\n');
        } else {
            proxyListContent.textContent = domains.join('\n');
        }
    }

    closeModal.addEventListener('click', function() {
        modal.style.display = 'none';
        searchBox.value = ''; // Clear search when closing
    });

    window.addEventListener('click', function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
            searchBox.value = ''; // Clear search when closing
        }
    });

    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Close modal on Escape
        if (e.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
            searchBox.value = '';
        }
        
        // Focus search box on Ctrl+F or Cmd+F when modal is open
        if ((e.ctrlKey || e.metaKey) && e.key === 'f' && modal.style.display === 'block') {
            e.preventDefault();
            searchBox.focus();
        }
    });

    document.getElementById('saveButton').addEventListener('click', function() {
        const useSystemProxy = document.getElementById('useSystemProxy').checked;
        const host = document.getElementById('proxyHost').value;
        const port = document.getElementById('proxyPort').value;
        const proxyType = document.getElementById('proxyType').value;
        const proxyDomains = document.getElementById('proxyDomains').value;

        // Validate input
        if (useSystemProxy && (!host || !port)) {
            alert('Please enter both host and port');
            return;
        }

        chrome.storage.local.set(
            {
                proxyHost: host,
                proxyPort: port,
                proxyType: proxyType,
                useSystemProxy: useSystemProxy,
                proxyDomains: proxyDomains
            },
            () => {
                alert('Settings saved successfully');
            }
        );
    });
});

document.addEventListener('DOMContentLoaded', function() {
    // 加载已保存的API Key
    chrome.storage.sync.get(['apiKey'], function(result) {
        if (result.apiKey) {
            document.getElementById('apiKey').value = result.apiKey;
        }
    });

    // 保存设置
    document.getElementById('saveButton').addEventListener('click', function() {
        const apiKey = document.getElementById('apiKey').value;
        chrome.storage.sync.set({
            apiKey: apiKey
        }, function() {
            const status = document.getElementById('status');
            status.textContent = 'Settings saved!';
            setTimeout(function() {
                status.textContent = '';
            }, 2000);
        });
    });
});

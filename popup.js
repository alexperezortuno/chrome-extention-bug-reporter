document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['endpoint', 'token', 'upload'], (data = {}) => {
        if (typeof data.endpoint === 'string') {
            document.getElementById('endpoint').value = data.endpoint;
        }
        if (typeof data.token === 'string') {
            document.getElementById('token').value = data.token;
        }
        if (typeof data.upload === 'boolean') {
            document.getElementById('upload').checked = data.upload;
        }
    });
});

document.getElementById('report').addEventListener('click', async () => {
    const upload = document.getElementById('upload').checked;
    const endpoint = document.getElementById('endpoint').value.trim();
    const token = document.getElementById('token').value.trim();

    chrome.storage.local.set({ endpoint, token, upload });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.runtime.sendMessage({ action: "generate_report", options: { upload, endpoint, token } }, (resp) => {
        console.log(resp);
    });
    document.getElementById('status').innerText = 'Generating report...';
});

chrome.runtime.onMessage.addListener((msg) => {
    console.log(msg);
    if (msg.action === 'report_done') {
        document.getElementById('status').innerText = `Report ${msg.status}`;
    } else if (msg.action === 'report_error') {
        document.getElementById('status').innerText = `Error: ${msg.error}`;
    }
});

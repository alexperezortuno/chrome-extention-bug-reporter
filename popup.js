document.getElementById('report').addEventListener('click', async () => {
    const upload = document.getElementById('upload').checked;
    const endpoint = document.getElementById('endpoint').value.trim();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.runtime.sendMessage({action: "generate_report", options: {upload, endpoint}}, (resp) => {
        // handled via messages from service worker (report_done/report_error)
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

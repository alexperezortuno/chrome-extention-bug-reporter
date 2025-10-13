import JSZip from 'jszip';

const CAPTURE_TIME_MS = 5000;
// const ORG_DOMAIN_SUFFIX = '.fbusinesscenter.com'; // puedes reactivar si quieres limitar dominios

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg?.action === 'generate_report') {
        getCurrentTab()
            .then(tab => generateReport(tab?.id, msg.options))
            .catch(err => {
                console.error('Report error:', err);
                safeSendMessage({ action: 'report_error', error: err?.message || String(err) });
            });
    }
});

// 🔹 obtiene la pestaña activa
async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab;
}

async function generateReport(tabId, options = {}) {
    if (!tabId) throw new Error('Tab id not provided');
    const tab = await chrome.tabs.get(tabId);
    const url = tab?.url || '';
    const hostname = safeHostname(url);

    // if (!hostname.endsWith(ORG_DOMAIN_SUFFIX)) throw new Error(`Dominio no permitido: ${hostname}`);

    console.log('Tab ID:', tabId, 'URL:', url, 'Hostname:', hostname);
    const timestamp = new Date().toISOString();

    // 1️⃣ Screenshot visible
    const screenshotDataUrl = await new Promise((resolve, reject) => {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, dataUrl => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            resolve(dataUrl);
        });
    });

    // 2️⃣ Captura unificada de Network + Console + Excepciones
    const { networkEvents, consoleLogs, exceptions } = await captureDevtoolsAll(tabId, CAPTURE_TIME_MS);

    // 3️⃣ Cookies y Storage
    const cookies = await chrome.cookies.getAll({ domain: hostname });
    const storage = await readPageStorage(tabId);

    // 4️⃣ Metadata
    const metadata = {
        url,
        hostname,
        timestamp,
        userAgent: navigator.userAgent,
        platform: navigator.platform
    };

    // 5️⃣ Redacción básica de datos sensibles
    const redacted = redact({ cookies, storage, networkEvents });

    // 6️⃣ Construye ZIP
    const zip = new JSZip();
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));
    zip.file('cookies.json', JSON.stringify(redacted.cookies, null, 2));
    zip.file('storage.json', JSON.stringify(redacted.storage, null, 2));
    zip.file('network.json', JSON.stringify(redacted.networkEvents, null, 2));
    zip.file('console.txt', [...consoleLogs, ...exceptions].join('\n'));
    zip.file('screenshot.png', dataUrlToArrayBuffer(screenshotDataUrl));

    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // 7️⃣ Descargar o subir
    if (options.upload && options.endpoint) {
        await uploadReport(zipBlob, options.endpoint, metadata, options.token);
        safeSendMessage({ action: 'report_done', status: 'uploaded' });
    } else {
        const reader = new FileReader();
        reader.onloadend = async function() {
            const base64data = reader.result;
            await chrome.downloads.download({
                url: base64data,
                filename: `report_${hostname}_${Date.now()}.zip`,
                saveAs: false
            });
            safeSendMessage({ action: 'report_done', status: 'downloaded' });
        };
        reader.readAsDataURL(zipBlob);
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// 🔧 Funciones auxiliares
// ──────────────────────────────────────────────────────────────────────────────

// Consolida Network + Console + Exceptions en una sola sesión debugger
async function captureDevtoolsAll(tabId, ms) {
    const debuggee = { tabId };
    const networkEvents = [];
    const consoleLogs = [];
    const exceptions = [];

    // Liberar sesión previa si existe
    try { await chrome.debugger.detach(debuggee); } catch {}

    await new Promise((resolve, reject) => {
        try {
            chrome.debugger.attach(debuggee, '1.3', () => {
                if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);

                const onEvent = (_, method, params) => {
                    if (method?.startsWith('Network.')) {
                        networkEvents.push({ method, params });
                    } else if (method === 'Runtime.consoleAPICalled') {
                        const type = params.type?.toUpperCase?.() || 'LOG';
                        const text = (params.args || [])
                            .map(a => a?.value ?? a?.description ?? '')
                            .join(' ');
                        const ts = new Date().toISOString();
                        consoleLogs.push(`[${ts}] [${type}] ${text}`);
                    } else if (method === 'Runtime.exceptionThrown') {
                        const ts = new Date().toISOString();
                        const detail = params?.exceptionDetails?.text
                            || params?.exceptionDetails?.exception?.description
                            || 'Unknown exception';
                        exceptions.push(`[${ts}] [EXCEPTION] ${detail}`);
                    }
                };

                chrome.debugger.onEvent.addListener(onEvent);
                chrome.debugger.sendCommand(debuggee, 'Network.enable');
                chrome.debugger.sendCommand(debuggee, 'Runtime.enable');

                setTimeout(() => {
                    chrome.debugger.onEvent.removeListener(onEvent);
                    chrome.debugger.detach(debuggee, () => resolve());
                }, ms);
            });
        } catch (e) {
            reject(e);
        }
    });

    return { networkEvents, consoleLogs, exceptions };
}

// Lectura de localStorage/sessionStorage
async function readPageStorage(tabId) {
    const [{ result } = {}] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            try {
                const toObj = s => Object.fromEntries(Object.entries(s));
                return { localStorage: toObj(localStorage), sessionStorage: toObj(sessionStorage) };
            } catch (e) { return { error: String(e) }; }
        }
    });
    return result || {};
}

// Redacción de información sensible
function redact(payload) {
    const redactKeys = ['authorization', 'token', 'password', 'secret', 'api_key', 'bearer'];
    const redactFn = (k, v) =>
        redactKeys.some(x => k.toLowerCase().includes(x)) ? '***REDACTED***' : v;

    const cookies = (payload.cookies || []).map(c => ({ ...c, value: '***REDACTED***' }));

    const mapObj = (obj = {}) =>
        Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, redactFn(k, v)]));

    const storage = {
        localStorage: mapObj(payload.storage?.localStorage || {}),
        sessionStorage: mapObj(payload.storage?.sessionStorage || {})
    };

    const networkEvents = (payload.networkEvents || []).map(ev => {
        if (ev?.params?.request?.headers) {
            const h = {};
            for (const [k, v] of Object.entries(ev.params.request.headers)) h[k] = redactFn(k, v);
            ev.params.request.headers = h;
        }
        if (ev?.params?.response?.headers) {
            const h = {};
            for (const [k, v] of Object.entries(ev.params.response.headers)) h[k] = redactFn(k, v);
            ev.params.response.headers = h;
        }
        return ev;
    });

    return { cookies, storage, networkEvents };
}

function safeHostname(url) {
    try { return new URL(url).hostname; } catch { return ''; }
}

function dataUrlToArrayBuffer(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

async function uploadReport(zipBlob, endpoint, metadata, token) {
    const form = new FormData();
    form.append('file', zipBlob, `report_${metadata.hostname || 'host'}_${Date.now()}.zip`);
    form.append('metadata', JSON.stringify(metadata));

    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(endpoint, { method: 'POST', body: form, headers, credentials: 'include' });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}

function safeSendMessage(payload) {
    try { chrome.runtime.sendMessage(payload); } catch { /* ignora si el puerto se cerró */ }
}

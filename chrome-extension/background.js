// DeepSeek → FreeDeepseekAPI — intercepts headers of real request.
// token (Authorization: Bearer), cookie (all), hif (x-hif-*) are taken from
// actual request to chat.deepseek.com/api/... — same as HAR/cURL.

const WASM_DEFAULT = 'https://fe-static.deepseek.com/chat/static/sha3_wasm_bg.7b9ca65ddd.wasm';
const KEY = 'deepseek_capture';

// extraHeaders needed for Chrome to access Cookie/Authorization; Firefox provides them without it.
const opts = ['requestHeaders'];
try {
    if (chrome.webRequest.OnBeforeSendHeadersOptions &&
        chrome.webRequest.OnBeforeSendHeadersOptions.EXTRA_HEADERS) {
        opts.push('extraHeaders');
    }
} catch (e) { /* Firefox: option doesn't exist — this is normal */ }

chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        const h = {};
        for (const x of (details.requestHeaders || [])) h[x.name.toLowerCase()] = x.value;
        const auth = h['authorization'] || '';
        const token = /^bearer\s+\S/i.test(auth) ? auth.replace(/^bearer\s+/i, '').trim() : '';
        const cookie = h['cookie'] || '';
        if (token && cookie) {
            const cap = {
                token,
                cookie,
                hif_dliq: h['x-hif-dliq'] || '',
                hif_leim: h['x-hif-leim'] || '',
                wasmUrl: WASM_DEFAULT,
                _t: Date.now(),
            };
            chrome.storage.local.set({ [KEY]: cap });
        }
    },
    { urls: ['https://chat.deepseek.com/api/*'] },
    opts
);

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'get') {
        chrome.storage.local.get(KEY, (r) => sendResponse({ success: true, cap: r[KEY] || null }));
        return true; // async
    }
});

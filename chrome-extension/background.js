// DeepSeek → FreeDeepseekAPI — перехват заголовков реального запроса.
// token (Authorization: Bearer), cookie (все), hif (x-hif-*) берутся из
// настоящего запроса к chat.deepseek.com/api/... — как в HAR/cURL.

const WASM_DEFAULT = 'https://fe-static.deepseek.com/chat/static/sha3_wasm_bg.7b9ca65ddd.wasm';
const KEY = 'deepseek_capture';

// extraHeaders нужен Chrome для доступа к Cookie/Authorization; Firefox даёт их без него.
const opts = ['requestHeaders'];
try {
    if (chrome.webRequest.OnBeforeSendHeadersOptions &&
        chrome.webRequest.OnBeforeSendHeadersOptions.EXTRA_HEADERS) {
        opts.push('extraHeaders');
    }
} catch (e) { /* Firefox: опции нет — это нормально */ }

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

// Prefer the current browser login, retaining request capture as a fallback.
function browserCall(invoke) {
    return new Promise((resolve, reject) => invoke(result => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(result);
    }));
}

function normalizeToken(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return String(parsed.value || parsed.token || parsed.access_token || '').trim();
        if (typeof parsed === 'string') return parsed.trim();
    } catch { /* A raw token is also valid. */ }
    return String(raw || '').trim();
}

async function collectFromTab() {
    const tabs = await browserCall(cb => chrome.tabs.query({ url: 'https://chat.deepseek.com/*' }, cb));
    if (!tabs?.length) return null;
    const cookies = await browserCall(cb => chrome.cookies.getAll({ domain: 'deepseek.com' }, cb));
    const list = (cookies || []).filter(c => /(^|\.)deepseek\.com$/i.test(c.domain));
    const response = await browserCall(cb => chrome.tabs.sendMessage(tabs[0].id, {
        action: 'readLocalStorage', keys: ['userToken', 'hif_dliq', 'hif_leim'],
    }, cb));
    const data = response?.data || {};
    const token = normalizeToken(data.userToken) || list.find(c => c.name === 'token')?.value || '';
    const cookie = list.map(c => `${c.name}=${c.value}`).join('; ');
    if (!token || !cookie) return null;
    const cap = { token, cookie, hif_dliq: data.hif_dliq || '', hif_leim: data.hif_leim || '', wasmUrl: WASM_DEFAULT, _t: Date.now() };
    await browserCall(cb => chrome.storage.local.set({ [KEY]: cap }, cb));
    return cap;
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'get') {
        collectFromTab().catch(() => null).then(cap => {
            if (cap) sendResponse({ success: true, cap });
            else chrome.storage.local.get(KEY, r => sendResponse({ success: true, cap: r[KEY] || null }));
        });
        return true; // async
    }
});

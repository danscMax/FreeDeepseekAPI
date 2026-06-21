/*
  Extract DeepSeek auth from a running Chrome instance via CDP.

  Usage (from auth.js):
    const { extractAuth } = await import('./cdp-extract.js');
    const auth = await extractAuth('http://localhost:9222');

  Returns { token, cookie, hif_dliq, hif_leim, wasmUrl } or null.
*/

class CDP {
    constructor(wsUrl) {
        this.ws = new WebSocket(wsUrl);
        this.id = 0;
        this.pending = new Map();
        this.events = [];
        this.ws.onmessage = (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.id && this.pending.has(msg.id)) {
                const { resolve, reject } = this.pending.get(msg.id);
                this.pending.delete(msg.id);
                msg.error
                    ? reject(new Error(JSON.stringify(msg.error)))
                    : resolve(msg.result);
            } else if (msg.method) {
                this.events.push(msg);
                if (this.events.length > 1000) this.events.shift();
            }
        };
    }
    ready() {
        return new Promise((resolve, reject) => {
            this.ws.onopen = resolve;
            this.ws.onerror = reject;
        });
    }
    send(method, params = {}) {
        const id = ++this.id;
        this.ws.send(JSON.stringify({ id, method, params }));
        return new Promise((resolve, reject) =>
            this.pending.set(id, { resolve, reject }),
        );
    }
    close() {
        try { this.ws.close(); } catch {}
    }
}

function normalizeToken(raw) {
    if (!raw) return '';
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object')
            return parsed.value || parsed.token || parsed.access_token || parsed.accessToken || '';
    } catch {}
    return String(raw).trim();
}

async function readPageAuth(cdp) {
    const evalRes = await cdp.send('Runtime.evaluate', {
        expression: `(() => {
      const out = {href: location.href, localStorage:{}, sessionStorage:{}, resources: []};
      for (let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); out.localStorage[k]=localStorage.getItem(k); }
      for (let i=0;i<sessionStorage.length;i++){ const k=sessionStorage.key(i); out.sessionStorage[k]=sessionStorage.getItem(k); }
      out.resources = performance.getEntriesByType('resource').map(r => r.name).filter(n => /wasm|chat\\/completion|pow|chat_session/.test(n)).slice(-100);
      return out;
    })()`,
        returnByValue: true,
    });
    const pageState = evalRes.result.value || {};
    const stores = [pageState.localStorage || {}, pageState.sessionStorage || {}];

    let token = '';
    for (const store of stores) {
        for (const key of ['userToken', 'token', 'auth_token', 'access_token', 'accessToken']) {
            token = normalizeToken(store[key]);
            if (token) break;
        }
        if (token) break;
    }
    if (!token) {
        for (const store of stores) {
            for (const [k, v] of Object.entries(store)) {
                if (/token/i.test(k)) {
                    token = normalizeToken(v);
                    if (token) break;
                }
            }
            if (token) break;
        }
    }

    const cookieRes = await cdp.send('Network.getAllCookies');
    const cookies = (cookieRes.cookies || []).filter((c) => /deepseek\.com$/.test(c.domain));
    const cookie = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    let hif_dliq = '', hif_leim = '';
    for (const ev of cdp.events) {
        const headers = ev.params?.headers || ev.params?.request?.headers;
        if (!headers) continue;
        for (const [k, v] of Object.entries(headers)) {
            const lk = k.toLowerCase();
            if (lk === 'x-hif-dliq') hif_dliq = String(v);
            if (lk === 'x-hif-leim') hif_leim = String(v);
            if (lk === 'authorization' && !token && /^Bearer\s+/i.test(String(v)))
                token = String(v).replace(/^Bearer\s+/i, '');
        }
    }

    const wasmUrl = (pageState.resources || []).find((u) => /sha3.*\.wasm/.test(u)) ||
        'https://fe-static.deepseek.com/chat/static/sha3_wasm_bg.7b9ca65ddd.wasm';

    return { token, cookie, hif_dliq, hif_leim, wasmUrl };
}

async function getPageTarget(baseUrl) {
    const resp = await fetch(`${baseUrl}/json`);
    const targets = await resp.json();
    return targets.find((t) => /deepseek/i.test(t.url || '') && t.type === 'page') || targets.find((t) => t.type === 'page') || targets[0];
}

export async function extractAuth(cdpBaseUrl = 'http://localhost:9222') {
    try {
        const target = await getPageTarget(cdpBaseUrl);
        if (!target?.webSocketDebuggerUrl) return null;

        const cdp = new CDP(target.webSocketDebuggerUrl);
        await cdp.ready();
        await cdp.send('Runtime.enable');
        await cdp.send('Network.enable');

        let auth = null;
        for (let i = 0; i < 10; i++) {
            auth = await readPageAuth(cdp);
            if (auth.token && auth.cookie) break;
            await new Promise((r) => setTimeout(r, 500));
        }
        cdp.close();

        if (!auth || !auth.token) return null;
        const { href, cookiesCount, ...persisted } = auth;
        return persisted;
    } catch {
        return null;
    }
}

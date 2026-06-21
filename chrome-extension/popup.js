// DeepSeek → FreeDeepseekAPI — Popup
function $(id) { return document.getElementById(id); }
const API_BASE = 'http://localhost:9655';
const PROXY_URL = API_BASE + '/api/accounts/import';

let current = null; // intercepted creds set {token,cookie,hif_*,wasmUrl}

function setStatus(cls, text) { $('status').className = 'status ' + cls; $('status').textContent = text; }
function setSrvDot(online) { const d = $('srvDot'); if (d) { d.className = 'srv-dot ' + (online ? 'online' : 'offline'); d.title = online ? 'Server online (:9655)' : 'Server unavailable (:9655)'; } }
function setCredButtons(has) { for (const id of ['btnAdd', 'btnCopy', 'btnSave']) { const b = $(id); if (b) b.disabled = !has; } }

function render(cap) {
    if (!cap || !cap.token || !cap.cookie) {
        setStatus('warn', '⚠️ Open chat.deepseek.com and SEND any message, then click the button.');
        $('jsonPreview').textContent = '{ }';
        $('detail').textContent = 'Creds will appear after request to DeepSeek';
        setCredButtons(false);
        return null;
    }
    const auth = { token: cap.token, hif_dliq: cap.hif_dliq || '', hif_leim: cap.hif_leim || '', cookie: cap.cookie, wasmUrl: cap.wasmUrl };
    // preview with masked secrets
    $('jsonPreview').textContent = JSON.stringify({
        token: auth.token.slice(0, 6) + '…(' + auth.token.length + ')',
        cookie: auth.cookie.slice(0, 48) + '…',
        hif_leim: auth.hif_leim ? ('…(' + auth.hif_leim.length + ')') : '',
    }, null, 2);
    setStatus('ok', '✅ Captured: token + cookie' + (auth.hif_leim ? ' + hif' : '') + ' — ready');
    $('detail').textContent = cap._t ? ('Updated: ' + new Date(cap._t).toLocaleTimeString()) : '';
    setCredButtons(true);
    return auth;
}

function refresh() {
    chrome.runtime.sendMessage({ action: 'get' }, (r) => { current = (r && r.success) ? render(r.cap) : render(null); });
}

// ── Pool panel (built via DOM API, no innerHTML, to rule out XSS) ──
function mkBtn(act, label, title, cls) {
    const b = document.createElement('button');
    b.className = cls; b.dataset.act = act; b.title = title; b.textContent = label;
    return b;
}

function setEmpty(text) {
    const pool = $('pool'); pool.textContent = '';
    const e = document.createElement('div'); e.className = 'pool-empty'; e.textContent = text;
    pool.appendChild(e);
}

function renderPool(list) {
    $('poolTitle').textContent = `Account pool (${list.length})`;
    if (!list.length) { setEmpty('No accounts'); return; }
    const pool = $('pool'); pool.textContent = '';
    for (const a of list) {
        const row = document.createElement('div');
        row.className = 'pool-row'; row.dataset.id = a.id;

        const idEl = document.createElement('span');
        idEl.className = 'id'; idEl.textContent = a.id;

        const emailEl = document.createElement('span');
        emailEl.className = 'email'; emailEl.textContent = a.label || a.email || '—'; emailEl.title = a.email || a.label || '';

        const badge = document.createElement('span');
        badge.className = 'badge ' + (a.status || '').toLowerCase(); badge.textContent = a.status || '—';

        const actions = document.createElement('span');
        actions.className = 'row-actions';
        actions.append(mkBtn('check', '↻', 'Check', 'acc-btn'), mkBtn('del', '✕', 'Delete', 'acc-btn danger'));

        row.append(idEl, emailEl, badge, actions);
        pool.appendChild(row);
    }
}

async function loadPool() {
    try {
        const r = await fetch(API_BASE + '/api/accounts');
        const j = await r.json();
        setSrvDot(true);
        renderPool(j.accounts || []);
    } catch {
        setSrvDot(false);
        $('poolTitle').textContent = 'Account pool';
        setEmpty('FreeDeepseekAPI unavailable on :9655');
    }
}

async function checkAccount(id) {
    const row = document.querySelector(`.pool-row[data-id="${id}"]`);
    const b = row && row.querySelector('.badge');
    if (b) { b.className = 'badge checking'; b.textContent = '…'; }
    try {
        const r = await fetch(`${API_BASE}/api/accounts/${id}/check`, { method: 'POST' });
        const j = await r.json();
        if (b) { b.className = 'badge ' + (j.status || '').toLowerCase(); b.textContent = j.status || '—'; }
        if (j.email && row) { const em = row.querySelector('.email'); em.textContent = j.email; em.title = j.email; }
        return j.status;
    } catch { if (b) { b.className = 'badge invalid'; b.textContent = 'ERR'; } return 'ERROR'; }
}

async function deleteAccount(id) {
    try { await fetch(`${API_BASE}/api/accounts/${id}`, { method: 'DELETE' }); } catch { /* noop */ }
    loadPool();
}

// click delegation in panel (check / delete with inline confirmation)
$('pool').addEventListener('click', (e) => {
    const emailEl = e.target.closest('.email');
    if (emailEl && emailEl.textContent && emailEl.textContent !== '—') {
        const full = emailEl.title || emailEl.textContent;
        navigator.clipboard.writeText(full).then(() => { const o = emailEl.textContent; emailEl.textContent = '✓ copied'; setTimeout(() => { emailEl.textContent = o; }, 900); });
        return;
    }
    const btn = e.target.closest('.acc-btn'); if (!btn) return;
    const row = btn.closest('.pool-row'); const id = row && row.dataset.id; if (!id) return;
    const act = btn.dataset.act;
    if (act === 'check') { checkAccount(id); return; }
    if (act === 'del') {
        const actions = btn.parentElement; actions.textContent = '';
        actions.append(mkBtn('yes', '✓', 'Delete', 'acc-btn confirm'), mkBtn('no', '✗', 'Cancel', 'acc-btn'));
        return;
    }
    if (act === 'yes') deleteAccount(id);
    else if (act === 'no') loadPool();
});

async function checkAll() {
    $('btnCheckAll').disabled = true;
    const ids = [...document.querySelectorAll('.pool-row')].map(r => r.dataset.id);
    for (const id of ids) await checkAccount(id);
    $('btnCheckAll').disabled = false;
}
$('btnCheckAll').addEventListener('click', checkAll);
$('btnDashboard').addEventListener('click', () => { chrome.tabs.create({ url: API_BASE + '/dashboard' }); });

// ── Main button — add captured creds + auto-validation ──
$('btnAdd').addEventListener('click', async () => {
    if (!current) {
        refresh();
        setStatus('warn', '⏳ No creds. Send a message in DeepSeek and try again.');
        return;
    }
    setStatus('warn', '⏳ Sending to FreeDeepseekAPI…');
    try {
        const r = await fetch(PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) });
        const j = await r.json();
        if (j.ok) {
            const who = j.email ? ` (${j.email})` : '';
            setStatus('ok', `✅ Added as ${j.id}${who} — checking…`);
            await loadPool();
            const st = await checkAccount(j.id);
            if (st === 'OK') setStatus('ok', `🟢 ${j.id}${who} — working`);
            else setStatus('err', `🔴 ${j.id} — status: ${st || 'unknown'}`);
        } else if (j.existingId) {
            setStatus('warn', `⚠️ Already added as ${j.existingId}`);
            loadPool();
        } else {
            setStatus('err', '❌ ' + (j.error || 'Add error'));
        }
    } catch (e) {
        setStatus('err', '❌ FreeDeepseekAPI unavailable on localhost:9655 (running?)');
    }
});

$('btnCollect').addEventListener('click', refresh);

$('btnCopy').addEventListener('click', () => {
    if (!current) return;
    navigator.clipboard.writeText(JSON.stringify(current, null, 2)).then(() => {
        $('btnCopy').textContent = '✅'; setTimeout(() => { $('btnCopy').textContent = '📋 Copy JSON'; }, 1200);
    });
});

$('btnSave').addEventListener('click', () => {
    if (!current) return;
    const blob = new Blob([JSON.stringify(current, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'deepseek-auth.json'; a.click();
    URL.revokeObjectURL(url);
});

refresh();
loadPool();

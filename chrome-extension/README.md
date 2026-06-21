# DeepSeek → FreeDeepseekAPI (extension)

Adds a DeepSeek account to your local FreeDeepseekAPI **with one click**:
intercepts headers from a real request to `chat.deepseek.com/api/...`
(`token` from `Authorization`, all cookies, `hif_*`) and sends them to
`http://localhost:9655/api/accounts/import`.

Works in Firefox and Chrome/Edge (Manifest V3).

Работает в Firefox и Chrome/Edge (Manifest V3).

## Установка

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`
2. "Load Temporary Add-on" → select `manifest.json` from this folder.
   (Temporary add-on: after Firefox restart, install again.)

**Chrome / Edge**
1. Open `chrome://extensions`
2. Enable "Developer mode".
3. "Load unpacked" → select this folder.

## Usage
1. Start FreeDeepseekAPI (port 9655).
2. Open `chat.deepseek.com` and log in to the desired account.
3. **Send any message** (e.g. `ok`) — so the request from which creds are taken occurs.
4. Click extension icon → **"➕ Add to FreeDeepseekAPI"**.

For multiple accounts, repeat from different browser profiles/logins.

Auxiliary buttons: "Collect" (show creds), "Copy JSON",
"Download file" (`deepseek-auth.json`) — for manual import via dashboard.

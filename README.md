# FreeDeepseekAPI

<p align="center">
  <strong>Local OpenAI-compatible API proxy for DeepSeek Web Chat</strong>
</p>

<p align="center">
  <a href="https://github.com/ForgetMeAI/FreeDeepseekAPI/blob/main/LICENSE"><img alt="License MIT" src="https://img.shields.io/badge/license-MIT-green.svg" /></a>
  <img alt="Node.js 18 plus" src="https://img.shields.io/badge/node-18%2B-339933.svg" />
  <img alt="No npm dependencies" src="https://img.shields.io/badge/dependencies-0-blue.svg" />
  <img alt="OpenAI compatible" src="https://img.shields.io/badge/OpenAI-compatible-111111.svg" />
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-examples">Examples</a> •
  <a href="#-models">Models</a> •
  <a href="#-endpoints">Endpoints</a> •
  <a href="#-open-webui">Open WebUI</a>
</p>

FreeDeepseekAPI runs a local API server for **DeepSeek Web Chat** (`chat.deepseek.com`) and lets you connect DeepSeek Web to Open WebUI, LiteLLM, Hermes, Claude Code, OpenAI SDK-style clients, and other OpenAI-compatible tools.

The project works through your regular logged-in DeepSeek account in a separate Chrome profile. The local server accepts API requests and then talks to DeepSeek Web through the saved browser session.

> ⚠️ This is an experimental web-chat proxy. DeepSeek may change the internal Web API without warning. For production use cases, the official paid DeepSeek API is more reliable.

ForgetMeAI: https://t.me/forgetmeai

---

## Navigation

- [What this gives you](#-what-this-gives-you)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [Windows launch](#-windows-launch)
- [Linux / Chromium launch](#-linux--chromium-launch)
- [VPS / headless launch](#-vps--headless-launch)
- [Diagnostics / doctor](#-diagnostics--doctor)
- [Session reuse and chat reset](#-session-reuse-and-chat-reset)
- [Multi-account pool](#-multi-account-pool)
- [Console auth ideas](#-console-auth-ideas)
- [Verify it works](#-verify-it-works)
- [Request examples](#-request-examples)
  - [Chat Completions](#chat-completions)
  - [Reasoning](#reasoning)
  - [Web search](#web-search)
  - [Streaming](#streaming)
  - [Anthropic Messages API](#anthropic-messages-api)
  - [OpenAI Responses API](#openai-responses-api)
  - [Tool calling](#tool-calling)
- [Models](#-models)
- [Endpoints](#-endpoints)
- [Open WebUI](#-open-webui)
- [Chrome Extension](#-chrome-extension)
- [Dashboard Web](#-dashboard-web)
- [Update login](#-update-login)
- [Project status](#-project-status)

---

## ✨ What this gives you

- Use DeepSeek Web as a local API endpoint.
- Connect DeepSeek to Open WebUI and other OpenAI-compatible clients.
- Get regular JSON responses or streaming SSE.
- Use reasoning models with separate `reasoning_content`.
- Work with Anthropic Messages API shim for Claude Code / Anthropic SDK.
- Use OpenAI Responses API shim for new OpenAI/Codex-style clients.
- Keep separate web sessions for different agents/users.

##  Features

- **OpenAI-compatible API:** `POST /v1/chat/completions`
- **Anthropic-compatible shim:** `POST /v1/messages`
- **OpenAI Responses shim:** `POST /v1/responses`
- **Streaming:** SSE chunks and regular non-stream JSON responses
- **Reasoning output:** separate `reasoning_content` for thinking models
- **Tool calling:** parsing OpenAI tools, Anthropic tools, and Responses function tools
- **Model capabilities:** `GET /v1/model-capabilities` with alias → real web mode
- **Agent sessions:** separate DeepSeek session per `user` / agent id
- **Session recovery:** auto-reset of stale chains/sessions
- **Zero dependencies:** Node.js 18+, no npm dependencies
- **Chrome Extension:** Browser extension for session management
- **Dashboard Web:** Administrative web interface with real-time metrics

---

## ⚡ Quick Start

```bash
git clone https://github.com/ForgetMeAI/FreeDeepseekAPI.git
cd FreeDeepseekAPI
npm run auth
npm start
```

`npm run auth` opens the auth menu:

1. select item `1`;
2. log in to DeepSeek in a separate Chrome profile;
3. send a short message like `ok`;
4. return to terminal and press Enter.

`npm start` shows the launch menu:

- `1` — authorize / update DeepSeek login
- `2` — show models and statuses
- `3` — start proxy
- `4` — exit

For headless/CI launch without menu:

```bash
NON_INTERACTIVE=1 npm start
# or
SKIP_ACCOUNT_MENU=1 npm start
```

By default the server listens on:

```text
http://localhost:9655
```

---

##  Windows Launch

```powershell
git clone https://github.com/ForgetMeAI/FreeDeepseekAPI.git
cd FreeDeepseekAPI
npm run auth
npm start
```

If Chrome is installed in a non-standard location, specify the path explicitly:

```powershell
$env:CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run auth
```

If Chrome is not found, `npm run auth` now prints ready-to-use instructions for Windows/macOS/Linux instead of a cryptic stack trace.

---

##  Linux / Chromium Launch

```bash
git clone https://github.com/ForgetMeAI/FreeDeepseekAPI.git
cd FreeDeepseekAPI
CHROME_PATH=$(which chromium) npm run auth
npm start
```

If Chromium has a different name:

```bash
CHROME_PATH=$(which chromium-browser) npm run auth
# or
CHROME_PATH=$(which google-chrome) npm run auth
```

---

##  VPS / Headless Launch

The most reliable flow without Chrome on the server:

1. On your home PC (where you have GUI/Chrome):

```bash
npm run auth
```

2. Copy `deepseek-auth.json` to VPS:

```bash
scp deepseek-auth.json user@your-vps:/opt/FreeDeepseekAPI/deepseek-auth.json
```

3. On VPS import/verify the file and set safe permissions:

```bash
cd /opt/FreeDeepseekAPI
npm run auth:import -- --input ./deepseek-auth.json
npm run doctor -- --offline
```

4. Start proxy without interactive menu:

```bash
NON_INTERACTIVE=1 npm start
```

You can import not only a ready-made `deepseek-auth.json`, but also a browser cookie export:

```bash
DEEPSEEK_TOKEN="<token>" npm run auth:import -- --input ./cookies.json
```

> Important: `deepseek-auth.json` gives access to your DeepSeek Web login. Do not commit, do not publish, store with `0600` permissions.

---

##  Diagnostics / doctor

```bash
npm run doctor
# without network requests to DeepSeek:
npm run doctor -- --offline
```

`doctor` checks:

- whether `deepseek-auth.json` / `DEEPSEEK_AUTH_DIR` is found;
- whether JSON is valid;
- whether `token`, `cookie`, `wasmUrl` exist;
- whether file permissions are safe on macOS/Linux (`0600`);
- on normal run — whether DeepSeek PoW endpoint is reachable.

If you see `data.biz_data is null`, `fetch failed`, `401/403/429` or Hermes/OpenCode doesn't see models — first run `npm run doctor`.

---

## ♻️ Session reuse and chat reset

FreeDeepseekAPI doesn't create a new DeepSeek chat on every HTTP request without reason. The logic is:

- one `x-agent-session`, `session`, or `user` → one DeepSeek chat session;
- if session id already exists — proxy reuses it and continues chain via `parent_message_id`;
- auto-reset happens on TTL, DeepSeek session error, or too long message chain;
- local history is saved as short context so new DeepSeek session can continue the conversation.

Explicitly set agent/session:

```bash
curl -X POST http://localhost:9655/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-agent-session: my-agent" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"Hi"}]}'
```

View active sessions:

```bash
curl http://localhost:9655/v1/sessions
```

Reset a single session:

```bash
curl -X POST "http://localhost:9655/reset-session?agent=my-agent"
```

Reset all sessions:

```bash
curl -X POST "http://localhost:9655/reset-session?agent=all"
```

Why chats still appear in DeepSeek Web: proxy works through internal Web Chat API, and DeepSeek stores real chat sessions on their side. This is normal for web-proxy. The task of session reuse is not to spawn new chats unnecessarily and to reset cleanly only when the chain has gone stale/broken.

---

##  Multi-account pool

You can connect multiple auth files. Correct model: sticky account per agent/session — proxy doesn't switch account inside a live DeepSeek session. If an account gets `401/403/429` and goes into cooldown, the session is safely reset and a new request may switch to another available account.

Option 1 — directory with auth files:

```bash
mkdir -p accounts
cp deepseek-auth-main.json accounts/main.json
cp deepseek-auth-backup.json accounts/backup.json
chmod 600 accounts/*.json
DEEPSEEK_AUTH_DIR=./accounts NON_INTERACTIVE=1 npm start
```

Option 2 — file list:

```bash
DEEPSEEK_AUTH_PATH="./accounts/main.json,./accounts/backup.json" NON_INTERACTIVE=1 npm start
```

How the pool works:

- new agent/session gets an available account round-robin;
- selected account is pinned to session (`sticky`);
- on `401`, `403`, `429` account goes into cooldown;
- if sticky-account session went into cooldown, old DeepSeek session is reset to avoid hammering rate-limited/expired account;
- account status visible in `/health` without auth file paths or file names;
- auth files must be stored with `0600` permissions.

Configure cooldown:

```bash
DEEPSEEK_ACCOUNT_COOLDOWN_MS=600000 npm start
```

---

##  Console auth ideas

Password flow from PR #3 can be done, but safer not to store password and not make it default. Normal implementation:

1. `npm run auth:console` asks for email/phone and password via hidden prompt.
2. Password stays only in process memory, not written to files/logs/history.
3. Script replicates Web login flow via `fetch`/CDP: gets captcha/verify challenge, gives human link/code, waits for confirmation.
4. After successful login, only standard-format `deepseek-auth.json` is saved.
5. If DeepSeek asks for captcha/2FA — script honestly says "open link, pass check, press Enter", doesn't try to bypass protection.
6. For VPS better mode `auth:console --no-save-password --output deepseek-auth.json`.

Minimal safe MVP: console auth only interactive, no env password. Acceptable automation variant: `DEEPSEEK_EMAIL=... npm run auth:console`, but password still entered via hidden prompt.

---

## ✅ Verify it works

```bash
curl http://localhost:9655/
curl http://localhost:9655/v1/models
curl http://localhost:9655/v1/model-capabilities
```

If all good, `/health` returns server status, list of supported aliases, and `config_ready: true`.

---

##  Request examples

### Chat Completions

```bash
curl -X POST http://localhost:9655/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Hi! Reply with one phrase."}],
    "stream": false
  }'
```

### Reasoning

```bash
curl -X POST http://localhost:9655/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-reasoner",
    "messages": [{"role": "user", "content": "Solve briefly: why is the sky blue?"}],
    "stream": false
  }'
```

For reasoning models, API returns the reasoning chain separately from the final answer:

- non-stream: `choices[0].message.reasoning_content`
- stream: `choices[0].delta.reasoning_content`
- usage: `usage.completion_tokens_details.reasoning_tokens`

`reasoning_tokens` — approximate estimate based on extracted DeepSeek Web `THINK` text, because web stream doesn't return official token usage for reasoning separately.

### Web search

```bash
curl -X POST http://localhost:9655/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat-search",
    "messages": [{"role": "user", "content": "Find a fresh fact about DeepSeek and reply briefly."}],
    "stream": false
  }'
```

### Streaming

```bash
curl -N -X POST http://localhost:9655/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Write a short joke."}],
    "stream": true
  }'
```

### Anthropic Messages API

```bash
curl -X POST http://localhost:9655/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "max_tokens": 512,
    "messages": [{"role": "user", "content": "Reply exactly OK"}],
    "stream": false
  }'
```

For Claude Code you can specify backend directly:

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:9655"
export ANTHROPIC_AUTH_TOKEN="dummy-key"
export CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1
claude --model deepseek-chat
```

### OpenAI Responses API

```bash
curl -X POST http://localhost:9655/v1/responses \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "input": "Reply exactly OK",
    "stream": false
  }'
```

### Tool calling

FreeDeepseekAPI accepts:

- OpenAI `tools`;
- Anthropic `tools`;
- Responses API function tools.

Proxy asks DeepSeek to return strict JSON tool call, but also parses fallback formats:

- `TOOL_CALL:`
- fenced JSON
- `<tool_call>...`

---

##  Models

DeepSeek Web supports several model aliases. Use these in the `model` field:

- `deepseek-chat` — standard chat model
- `deepseek-reasoner` — reasoning model with chain-of-thought
- `deepseek-chat-search` — chat with web search enabled

For a full list, run:

```bash
curl http://localhost:9655/v1/models
```

---

##  Endpoints

- `GET /` — server status
- `GET /health` — detailed health check
- `GET /v1/models` — list available models
- `GET /v1/model-capabilities` — model capabilities
- `POST /v1/chat/completions` — OpenAI-compatible chat completions
- `POST /v1/messages` — Anthropic-compatible messages API
- `POST /v1/responses` — OpenAI Responses API
- `GET /v1/sessions` — list active sessions
- `POST /reset-session` — reset a session (query param `agent`)

---

##  Open WebUI

To connect Open WebUI to FreeDeepseekAPI:

1. Start FreeDeepseekAPI: `npm start`
2. In Open WebUI, go to Settings → Connections
3. Set API URL to `http://localhost:9655`
4. Use any dummy API key (e.g., `sk-dummy`)
5. Select `deepseek-chat` or other models

---

##  Chrome Extension

A browser extension is available for session management.

### Installation

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `chrome-extension/` folder

### Features

- Real-time server status
- Session refresh and auto-capture
- Popup interface for quick actions
- Cookie-based session monitoring
- Request interception for DeepSeek API

### Usage

Click the extension icon to view:

- Server connection status (`http://localhost:9655`)
- Active session ID
- Number of configured accounts
- Last activity timestamp

---

##  Dashboard Web

A web dashboard provides advanced administration.

### Access

```
http://localhost:9655/dashboard
```

### Features

- Active session monitoring
- API usage statistics
- Account management
- Real-time metrics

### Development

```bash
cd dashboard
npm install
npm start  # Development server
npm run build  # Production build
```

---

##  Update login

If your DeepSeek session expires, refresh it:

```bash
npm run auth
```

Or use the import command with fresh credentials:

```bash
npm run auth:import -- --input ./new-auth.json
```

---

##  Project status

This project is actively maintained. For updates and support, join the Telegram channel: [ForgetMeAI](https://t.me/forgetmeai).

Contributions are welcome via pull requests.

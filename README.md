# Token Monitor

**One dashboard to track every AI token and dollar across all providers.**

Token Monitor is a privacy-first desktop application that gives you real-time visibility into your AI spending across Anthropic, OpenAI, Google Gemini, OpenRouter, Claude Code, and more — all from a single dashboard. Every byte of data stays on your machine.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Supported Providers](#supported-providers)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Browser Extension](#browser-extension)
- [OpenClaw Skill](#openclaw-skill)
- [Configuration](#configuration)
- [Views & Personas](#views--personas)
- [Database Schema](#database-schema)
- [API & Ports](#api--ports)
- [Building for Production](#building-for-production)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

- **Multi-provider tracking** — Monitor tokens and costs across 10+ AI provider types from one place
- **Real-time updates** — Live token counts, cost tracking, and sparkline charts as you use AI
- **Exact & estimated data** — API-level exact counts from direct integrations; character-based estimates from browser extensions
- **Privacy-first** — All data stored locally in SQLite. API keys encrypted via OS keychain (`safeStorage`). No telemetry, no cloud sync
- **Multiple views** — Widget (casual), Grid (builder), and Command Center (power user) dashboards
- **Budget alerts** — Set spending limits with threshold warnings (75%, 90%, 100%) and optional hard caps
- **Local proxy** — Transparent HTTP proxy that intercepts API calls to capture usage without modifying your workflow
- **Browser extension** — Track consumer usage on claude.ai, chatgpt.com, and gemini.google.com
- **File watcher** — Auto-detect Claude Code sessions by watching `~/.claude/projects/` JSONL logs
- **Export** — CSV and JSON export of all usage data
- **Dark mode** — System-aware theming with manual override

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Desktop App (Electron)                   │
│                                                          │
│  ┌───────────┐  ┌──────────┐  ┌───────────────────────┐  │
│  │  Renderer  │  │   Main   │  │      Services         │  │
│  │  (React)   │◄─┤ Process  │──┤                       │  │
│  │            │  │          │  │  DataEngine            │  │
│  │  Zustand   │  │  IPC     │  │  ├── Adapters          │  │
│  │  Stores    │  │  Tray    │  │  │   ├── Anthropic     │  │
│  │            │  │  Preload │  │  │   ├── OpenAI        │  │
│  │  Views:    │  │          │  │  │   ├── Gemini        │  │
│  │  ▸ Widget  │  │          │  │  │   ├── OpenRouter    │  │
│  │  ▸ Grid    │  │          │  │  │   ├── Claude Code   │  │
│  │  ▸ CmdCtr  │  │          │  │  │   ├── Copilot      │  │
│  │  ▸ Settings│  │          │  │  │   ├── Browser Ext   │  │
│  │  ▸ Onboard │  │          │  │  │   └── OpenClaw      │  │
│  └───────────┘  └──────────┘  │  │                     │  │
│                               │  Database (SQLite)     │  │
│                               │  Proxy (:7878)         │  │
│                               │  WebSocket (:7879)     │  │
│                               └───────────────────────┘  │
└─────────────────┬──────────────────────┬─────────────────┘
                  │                      │
      ┌───────────┘                      └──────────┐
      ▼                                             ▼
┌─────────────┐                              ┌──────────────┐
│  Browser    │  WebSocket :7879             │  OpenClaw    │
│  Extension  │─────────────────────────►    │  Skill       │
│  (MV3)      │                              │  POST :7878  │
│  ▸ claude.ai│                              └──────────────┘
│  ▸ chatgpt  │
│  ▸ gemini   │       ┌───────────────────┐
└─────────────┘       │  AI Provider APIs  │
                      │  (via proxy :7878  │
                      │   or direct)       │
                      └───────────────────┘
```

**Data flows:**

1. **Proxy path** — Point your API base URL to `http://localhost:7878/{provider}/...` → proxy forwards to the real API → captures the response → adapter extracts tokens/cost → engine persists to DB + pushes to renderer
2. **File watcher** — Claude Code writes JSONL to `~/.claude/projects/` → `chokidar` watches for changes → parses usage lines → engine ingests
3. **Browser extension** — Content scripts intercept `fetch` on AI platforms → estimate tokens → send via WebSocket to desktop → engine ingests (quality: `estimated`)
4. **OpenClaw skill** — After each AI response → HTTP POST to `:7878/api/usage` → engine ingests
5. **Polling** — OpenAI and OpenRouter adapters poll provider APIs periodically for backfill data

---

## Supported Providers

| Provider | Type | Connection Method | Data Quality | Notes |
|----------|------|-------------------|--------------|-------|
| Anthropic API | `anthropic_api` | API Key / Proxy | Exact | Reads `usage` from API responses |
| OpenAI API | `openai_api` | API Key / Proxy | Exact | + Usage API polling every 5 min |
| Google Gemini | `gemini_api` | API Key / Proxy | Exact | Reads `usageMetadata` from responses |
| OpenRouter | `openrouter` | API Key / Proxy | Exact | Uses `x-openrouter-cost` header + generation history polling |
| Claude Code | `claude_code` | File Watcher | Exact | Watches `~/.claude/projects/` JSONL — no API key needed |
| OpenClaw | `openclaw` | Skill (HTTP) | Exact | Receives data from OpenClaw skill via HTTP POST |
| Claude.ai (Consumer) | `claude_consumer` | Browser Extension | Estimated | Intercepts fetch, estimates from response text |
| ChatGPT (Consumer) | `chatgpt_consumer` | Browser Extension | Estimated | Intercepts fetch on `/backend-api/conversation` |
| Gemini (Consumer) | `gemini_consumer` | Browser Extension | Estimated | Intercepts fetch, parses nested JSON responses |

---

## Prerequisites

- **Node.js** ≥ 20.0.0
- **pnpm** ≥ 9.0.0
- **macOS** (primary target — uses `hiddenInset` titlebar, macOS tray)

```bash
# Install pnpm if you don't have it
npm install -g pnpm@9

# Verify versions
node -v   # Should be v20+
pnpm -v   # Should be v9+
```

> **Note:** If you use `nvm`, make sure to switch to Node 20+ before running any commands:
> ```bash
> nvm use 20   # or nvm use 22
> ```

---

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/Git-push-01/token-monitor.git
cd token-monitor

# 2. Install dependencies
pnpm install

# 3. Rebuild native modules for Electron
cd apps/desktop
npx @electron/rebuild -f -w better-sqlite3
cd ../..

# 4. Start the development server
pnpm dev
```

This launches:
- **Vite dev server** at `http://localhost:5173` (renderer hot-reload)
- **Electron main process** with the desktop window
- **Local proxy** on port `7878`
- **WebSocket server** on port `7879`

### First Run

On first launch you'll see the **Onboarding** screen where you pick a persona:
- **Casual** 💬 — Simple widget view with a daily spend ring
- **Builder** 🛠 — Grid of provider cards with sparklines
- **Power User** 🦞 — Full command center with tables, analytics, and budgets

Then head to **Settings** to connect your first provider.

---

## Project Structure

```
token-monitor/
├── package.json              # Root workspace config
├── pnpm-workspace.yaml       # pnpm workspace definition
├── tsconfig.json              # Root TypeScript config
│
├── apps/
│   ├── desktop/               # Electron + Vite + React desktop app
│   │   ├── src/
│   │   │   ├── main/          # Electron main process
│   │   │   │   ├── index.ts   # Window creation, service init
│   │   │   │   ├── ipc.ts     # IPC handlers (CRUD, export, pairing)
│   │   │   │   ├── preload.ts # contextBridge API for renderer
│   │   │   │   └── tray.ts    # macOS menu bar tray
│   │   │   ├── renderer/      # React frontend
│   │   │   │   ├── App.tsx    # Root component, routing, real-time events
│   │   │   │   ├── components/
│   │   │   │   │   ├── BudgetBar.tsx    # Budget progress bar
│   │   │   │   │   ├── ProviderCard.tsx # Provider instance card
│   │   │   │   │   ├── Sparkline.tsx    # SVG mini-chart
│   │   │   │   │   └── UsageRing.tsx    # Circular progress ring
│   │   │   │   ├── store/
│   │   │   │   │   ├── useInstances.ts  # Live instance state
│   │   │   │   │   ├── useProviders.ts  # Provider CRUD
│   │   │   │   │   └── useSettings.ts   # User preferences
│   │   │   │   └── views/
│   │   │   │       ├── CommandCenter.tsx # Power user dashboard
│   │   │   │       ├── Grid.tsx         # Builder grid view
│   │   │   │       ├── Onboarding.tsx   # First-run persona picker
│   │   │   │       ├── Settings.tsx     # Provider mgmt, preferences
│   │   │   │       └── Widget.tsx       # Casual daily spend view
│   │   │   └── services/       # Core backend services
│   │   │       ├── database.ts  # SQLite schema, queries, aggregations
│   │   │       ├── engine.ts    # DataEngine: event bus, adapter registry
│   │   │       ├── proxy.ts     # HTTP proxy on :7878
│   │   │       ├── tokenizer.ts # Fallback token estimation
│   │   │       ├── websocket.ts # WS server on :7879
│   │   │       └── adapters/    # Provider-specific adapters
│   │   │           ├── anthropic.ts
│   │   │           ├── openai.ts
│   │   │           ├── gemini.ts
│   │   │           ├── openrouter.ts
│   │   │           ├── claude-code.ts
│   │   │           ├── browser-ext.ts
│   │   │           └── openclaw.ts
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   └── package.json
│   │
│   └── extension/             # Chrome browser extension (MV3)
│       ├── manifest.json
│       ├── background.ts      # WebSocket bridge to desktop
│       ├── content/
│       │   ├── claude.ts      # Intercepts claude.ai fetch
│       │   ├── chatgpt.ts     # Intercepts chatgpt.com fetch
│       │   └── gemini.ts      # Intercepts gemini.google.com fetch
│       └── popup/
│           ├── popup.html     # Extension popup UI
│           └── popup.ts       # Pairing token input, status display
│
└── packages/
    ├── shared/                # Shared types, pricing, constants
    │   └── src/
    │       ├── types.ts       # All TypeScript interfaces
    │       ├── pricing.ts     # Model pricing table + cost calculator
    │       ├── constants.ts   # Provider definitions, ports, tier limits
    │       └── index.ts       # Re-exports
    │
    └── openclaw-skill/        # OpenClaw integration skill
        ├── index.js           # POST usage data to desktop app
        ├── manifest.json      # Skill trigger config
        └── README.md
```

---

## How It Works

### DataEngine (Central Event Bus)

The `DataEngine` is the heart of the application. It:

1. **Ingests events** (`UsageEventV1`) from any adapter or external source
2. **Normalizes** total token counts
3. **Calculates cost** using the shared pricing table (`calculateCost`)
4. **Persists** to SQLite — individual record + hourly/daily aggregates atomically
5. **Updates in-memory state** — instance map with running totals and sparkline data (last 30 points)
6. **Broadcasts** to renderer via IPC (`usage:event`)
7. **Checks budgets** against thresholds, fires `budget:alert` if exceeded

### Provider Adapters

Each adapter implements a common interface:

```typescript
interface ProviderAdapter {
  type: ProviderType;
  start(): void;
  stop(): void;
  testConnection(): Promise<{ valid: boolean; info?: string }>;
}
```

Adapters use different strategies:
- **Proxy intercept** — Anthropic, OpenAI, Gemini, OpenRouter parse response bodies captured by the local proxy
- **File watching** — Claude Code uses `chokidar` to watch JSONL session logs
- **API polling** — OpenAI (Usage API every 5 min), OpenRouter (generation history every 30s)
- **Passive receive** — Browser Extension (via WebSocket) and OpenClaw (via HTTP POST)

### Local Proxy

The proxy on port `7878` acts as a transparent pass-through:

```
Your Code → localhost:7878/anthropic/v1/messages → api.anthropic.com/v1/messages
                                    ↓
                            Capture response
                            Extract usage data
                            Forward to DataEngine
```

To use it, set your API base URL:
```bash
# Anthropic
export ANTHROPIC_BASE_URL=http://localhost:7878/anthropic

# OpenAI
export OPENAI_BASE_URL=http://localhost:7878/openai

# Gemini
export GEMINI_BASE_URL=http://localhost:7878/gemini

# OpenRouter
export OPENROUTER_BASE_URL=http://localhost:7878/openrouter
```

### Pricing Engine

The shared `pricing.ts` contains per-model pricing (USD per 1M tokens) for all supported models:

- **Anthropic:** Claude Opus 4, Sonnet 4, 3.5 Sonnet, Haiku 3.5 (with cache read/write prices)
- **OpenAI:** GPT-4.1, GPT-4.1-mini/nano, GPT-4o/mini, o3/o3-mini/o4-mini
- **Google:** Gemini 2.5 Pro/Flash, 2.0 Flash, 1.5 Pro/Flash
- **OpenRouter:** Uses provider-reported cost from `x-openrouter-cost` header

Cost calculation handles input, output, cache read, cache write, and reasoning tokens with 6-decimal precision. Model name matching is fuzzy (strips date suffixes, tries prefix matching).

### Security

- **API keys** encrypted at rest via Electron `safeStorage` (OS keychain) and stored as base64 in SQLite
- **Proxy & WebSocket** bound to `127.0.0.1` only (loopback — not accessible from network)
- **Electron** uses `contextIsolation: true`, `nodeIntegration: false`, CSP headers
- **WebSocket** requires pairing token authentication with rate limiting (50 msg/sec)
- **No telemetry** — zero external network calls except to the AI providers you configure

---

## Browser Extension

The Chrome extension (Manifest V3) tracks consumer usage on AI web apps.

### How It Works

1. **Content scripts** inject at `document_start` on claude.ai, chatgpt.com, and gemini.google.com
2. Scripts **intercept `window.fetch`** to capture API responses
3. Token counts are **estimated** from response text length (~4 chars per token)
4. Events are sent to the **background service worker** via `chrome.runtime.sendMessage`
5. The background worker maintains a **persistent WebSocket** connection to the desktop app on port `7879`
6. Events are relayed to the DataEngine for ingestion

### Building the Extension

```bash
pnpm build:ext
```

Then load the `apps/extension/dist` folder as an unpacked extension in Chrome.

### Pairing

1. Open Token Monitor desktop → **Settings** → **Show Pairing Token**
2. Click the extension popup icon
3. Paste the token and click **Pair**
4. Badge turns green "ON" when connected

---

## OpenClaw Skill

The `packages/openclaw-skill` package integrates with OpenClaw to automatically report usage after each AI response.

```javascript
// Triggered after each AI response (after_response hook)
// POSTs usage data to http://127.0.0.1:7878/api/usage
```

Install it in your OpenClaw configuration and it will silently send usage data to Token Monitor whenever the desktop app is running.

---

## Configuration

### Environment Variables

No `.env` file is required. All secrets are entered in-app and encrypted via OS keychain.

| Variable | Purpose | Default |
|----------|---------|---------|
| `NODE_ENV` | Development mode detection | Auto-detected via `app.isPackaged` |

### In-App Settings

- **Persona** — Casual / Builder / Power User (changes default view)
- **Theme** — Light / Dark / System
- **Budget alerts** — Per-provider or global, with configurable thresholds
- **Pairing token** — For browser extension WebSocket authentication

---

## Views & Personas

### Widget (Casual) 💬
A single-glance view with a large **UsageRing** showing daily spend vs. budget, aggregate sparkline, and a simple provider status list. Plain language, no jargon.

### Grid (Builder) 🛠
A responsive grid of **ProviderCards**, each showing provider icon, model, status dot, sparkline chart, token counts (input/output/cost), request count, and time since last activity. Summary bar at top.

### Command Center (Power User) 🦞
Full dashboard with 6 stat cards, budget bars, and a tabbed interface:
- **Instances** — Live provider sessions
- **Events** — Scrollable table of recent events with time, provider, model, tokens, cost, quality badge
- **Analytics** — Cost-by-provider horizontal bar chart

---

## Database Schema

SQLite database stored in Electron's `userData` directory as `token-monitor.db`.

| Table | Purpose |
|-------|---------|
| `settings` | Key/value store for preferences, schema version, pairing token |
| `providers` | Provider configs with encrypted API keys, status, timestamps |
| `usage_records` | Individual usage events with full token breakdown |
| `usage_hourly` | Hourly aggregates (upsert on composite PK: provider_id + hour + model) |
| `usage_daily` | Daily aggregates (same pattern) |
| `budgets` | Spending limits with thresholds, notification channels, hard cap option |

WAL mode enabled with 64MB cache and foreign keys.

---

## API & Ports

| Port | Service | Purpose |
|------|---------|---------|
| `5173` | Vite Dev Server | Renderer hot-reload (dev only) |
| `7878` | HTTP Proxy | Transparent API proxy + OpenClaw skill endpoint |
| `7879` | WebSocket | Browser extension communication |
| `7880` | API (reserved) | Future REST API |

All services bind to `127.0.0.1` (localhost only).

---

## Building for Production

```bash
# Build the desktop app (TypeScript → Vite → electron-builder)
pnpm build

# Build the browser extension
pnpm build:ext
```

The desktop build produces platform-specific distributables via `electron-builder`.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev` | Start desktop app in dev mode (Vite + Electron) |
| `pnpm build` | Build desktop app for distribution |
| `pnpm build:ext` | Build browser extension |
| `pnpm lint` | ESLint across all `.ts`/`.tsx` files |
| `pnpm typecheck` | TypeScript type checking |

---

## Troubleshooting

### `better-sqlite3` module version mismatch
```
NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 130.
```
Rebuild the native module for Electron:
```bash
cd apps/desktop
npx @electron/rebuild -f -w better-sqlite3
```

### `__dirname is not defined`
The Electron main process runs as ESM. The codebase uses `import.meta.url` to polyfill `__dirname`:
```typescript
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

### Wrong Node.js version
```bash
nvm use 22  # or nvm use 20
```

### Ports already in use
If ports 7878 or 7879 are occupied, kill the existing process:
```bash
lsof -ti:7878 | xargs kill -9
lsof -ti:7879 | xargs kill -9
```

---

## Tech Stack

- **Runtime:** Electron 33 + Node.js 22
- **Frontend:** React 19, Zustand 5, Recharts, Tailwind CSS 3
- **Build:** Vite 6, vite-plugin-electron, TypeScript 5.7
- **Database:** SQLite via better-sqlite3 (WAL mode)
- **Networking:** Fastify (proxy), ws (WebSocket)
- **Packaging:** electron-builder, pnpm workspaces
- **Extension:** Chrome MV3

---

## License

MIT

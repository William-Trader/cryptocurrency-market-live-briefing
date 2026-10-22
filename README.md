# Crypto Market Live Briefing

Zero-dependency crypto market intelligence for chat platforms: news aggregation,
sentiment scoring, technical context, risk alerts, and one canonical briefing
that renders natively for Telegram, Discord, Slack, Feishu/Lark, WeCom, QQ
(OneBot v11), or any HTTP webhook.

**Version 2.0.0** · Node.js >= 18 · PolyForm Noncommercial 1.0.0

**English** | [简体中文](README.zh-CN.md)

---

## Why this exists

Most "crypto alert" bots are a pile of scripts that print to a terminal, with
platform glue bolted on per chat app. This project separates the two:

1. **Collect** market and news data into a typed briefing object.
2. **Render** that object once per platform (HTML, embeds, blocks, cards, plain text).
3. **Deliver** through small adapters with retries and secret handling.

The result is one pipeline you can point at any group chat, with no duplicated
formatting logic and no vendor lock-in.

---

## Features

- **News intelligence** — Desk3 News and optional CryptoPanic, normalized,
  deduplicated, categorized into 12 classes, scored for sentiment (-1..+1) and
  impact (1..10).
- **Market sentiment index** — 0-100 composite with trend, coin-level
  sentiment, and keyword tracking.
- **Market context** — spot quotes, Fear & Greed, BTC dominance, Puell multiple,
  cycle metrics, RSI/MACD/Bollinger/ATR, regime detection, BTC correlation.
- **Alerts** — breaking news, regulatory action, security incidents, whale flow,
  high-impact headlines, with per-rule cooldown.
- **One briefing schema** — deterministic JSON that every renderer consumes.
- **Multi-platform delivery** — Telegram, Discord, Slack, Feishu/Lark, WeCom,
  QQ via OneBot v11, generic HMAC-signed webhook.
- **Operations-first** — doctor command, structured logs, dry-run, retries,
  rate-limit aware HTTP, no fabricated data.
- **Zero runtime dependencies** — Node built-ins only. WebSocket streaming is
  optional and activates only if the optional ws package is installed.

---

## Quick start

~~~bash
git clone <your-repo> cryptocurrency-market-live-briefing
cd cryptocurrency-market-live-briefing

node bin/crypto-intel.js doctor
node bin/crypto-intel.js news --limit 10
node bin/crypto-intel.js market
node bin/crypto-intel.js brief --format markdown
~~~

No install step is required. If you want the npm scripts and the optional
streaming dependency:

~~~bash
npm install
npm test
~~~

### Publish to a chat platform

~~~bash
cp config/platforms.example.json config/platforms.json
# edit config/platforms.json, or export the referenced environment variables
node bin/crypto-intel.js publish --platform telegram --dry-run
node bin/crypto-intel.js publish --platform telegram
~~~

---

## CLI

| Command | Purpose |
|---------|---------|
| **news** | Aggregated, scored headlines and alerts |
| **market** | Spot quotes, cycle metrics, regime |
| **brief** | Full briefing in markdown, plain, JSON, or a platform payload |
| **publish** | Build a briefing and deliver it to configured platforms |
| **doctor** | Check Node, data endpoints, and delivery configuration |
| **config** | Print effective configuration with secrets masked |

Common flags: **--json**, **--limit N**, **--news N**, **--coins BTC,ETH**,
**--format**, **--out FILE**, **--platform NAME**, **--dry-run**,
**--news-only**, **--market-only**.

See [docs/SCRIPTS.md](docs/SCRIPTS.md) for the full reference.

---

## Output

~~~text
# Crypto Market Briefing

**Wait and see** — No edge from trend or sentiment; favor range tactics and small size.

| Coin | Price | 24h | Trend | RSI | Bias |
|------|-------|-----|-------|-----|------|
| BTC | 82,816.51 | +0.17% | ▲ | 36.84 | bearish |
| ETH | 2,438.54 | -0.02% | ▼ | 37.90 | bearish |

Fear & Greed **53** (Neutral) · BTC dominance **60.1%** · Regime **range**

## News sentiment

Index **56/100** (neutral) · trend flat · 5 positive / 3 negative / 2 neutral
~~~

The same run can be emitted as Telegram HTML, Discord embeds, Slack blocks, or
a Feishu interactive card without refetching data.

---

## Platform support

| Platform | Adapter | Payload | Auth |
|----------|---------|---------|------|
| Telegram | **telegram** | HTML message, auto-chunked at 3800 chars | Bot token + chat id |
| Discord | **discord** | Rich embed | Webhook URL |
| Slack | **slack** | Block Kit | Incoming webhook |
| Feishu / Lark | **feishu** | Interactive card | Webhook URL (+ optional sign secret) |
| WeCom | **wecom** | Markdown message | Group robot webhook |
| QQ | **qq** | Plain text via OneBot v11 | HTTP endpoint + access token |
| Anything else | **webhook** | JSON briefing, optional HMAC-SHA256 | URL (+ optional secret) |

Setup steps and payload details: [docs/PLATFORM-INTEGRATION.md](docs/PLATFORM-INTEGRATION.md).

---

## Repository layout

~~~text
.
├── bin/crypto-intel.js          # CLI entry point
├── src/
│   ├── core/                    # http, logging, config, crypto helpers
│   ├── data/                    # Desk3, Binance, CryptoPanic clients
│   ├── news/                    # normalization, classification, sentiment, alerts
│   ├── market/                  # indicators, regime, correlation, orchestration
│   ├── render/                  # one briefing -> platform payloads
│   ├── delivery/                # transport adapters
│   ├── briefing.js              # canonical schema + verdict
│   └── index.js                 # system facade
├── config/
│   ├── sources.json             # data endpoints (no secrets)
│   └── platforms.example.json   # delivery targets
├── test/                        # node:test suite, offline
└── docs/                        # setup, architecture, handover, changelog
~~~

---

## Data sources

| Source | Used for | Key required |
|--------|----------|--------------|
| Desk3 API | spot quotes, Fear & Greed, Puell, dominance, cycles, news | no |
| Binance | OHLCV candles for technical indicators | no |
| Alternative.me | Fear & Greed fallback | no |
| CryptoPanic | additional news coverage | yes (optional) |

Every briefing carries **asOf**, per-source status, and a disclaimer. A failing
source degrades the briefing instead of fabricating values.

> Research and risk awareness only. Not investment advice. Verify prices on the
> exchange before acting.

---

## Operations

- **Schedule**: run **publish** from cron, systemd, launchd, or an OpenClaw
  automation. Example units are in [docs/SETUP.md](docs/SETUP.md).
- **Health**: **node bin/crypto-intel.js doctor** exits non-zero on failure.
- **Logs**: JSON-friendly key=value metadata, secrets redacted.
- **Dry run**: **--dry-run** renders and validates without network delivery.
- **Retries**: 408/425/429/5xx with exponential backoff and Retry-After support.

---

## Documentation

- [docs/SETUP.md](docs/SETUP.md) — install, configure, schedule
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — modules, data flow, schema
- [docs/PLATFORM-INTEGRATION.md](docs/PLATFORM-INTEGRATION.md) — chat platform matrix and adapter contract
- [docs/HANDOVER.md](docs/HANDOVER.md) — baseline handover: acceptance, runbooks, known limits
- [docs/SCRIPTS.md](docs/SCRIPTS.md) — CLI reference
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — release history

---

## License

PolyForm Noncommercial License 1.0.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE)
for the MIT-licensed upstream component that was merged into v2.

# Changelog

All notable changes to this project are documented here.
Format: Keep a Changelog. Versioning: semantic versioning.

**English** | [简体中文](CHANGELOG.zh-CN.md)

---

## [2.0.0] - 2026-10-22

This release absorbs the supplied **crypto-intelligence v6.0.0** package and
rebuilds it as one English, dependency-free briefing pipeline.

### Added

- **Canonical briefing schema** (crypto.briefing/2) with id, generatedAt,
  asOf timestamps, per-source status, errors, verdict, and disclaimer.
- **Verdict engine** mapping sentiment, Fear & Greed, and regime to a
  risk stance (defensive / cautious / constructive / neutral) with reasoning.
- **Multi-platform delivery**: Telegram, Discord, Slack, Feishu/Lark, WeCom,
  QQ via OneBot v11, and a generic HMAC-signed webhook.
- **Renderers** for markdown, plain text, Telegram HTML, Discord embeds, Slack
  Block Kit, and Feishu interactive cards.
- **Unified CLI**: news, market, brief, publish, doctor, config.
- **Market context**: spot quotes, Fear & Greed, BTC dominance, Puell multiple,
  cycle metrics, regime detection, BTC correlation.
- **Technical indicators**: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, with
  explicit insufficient-data handling.
- **News engine**: 12-category classifier, sentiment scoring, impact scoring,
  coin extraction, language detection, dedupe, keyword tracking, alert rules
  with cooldown.
- **Offline test suite** (26 tests) covering classification, sentiment,
  indicators, renderers, delivery selection, and credential failures.
- **Doctor command** and **lint script**.
- **Documentation set**: README, SETUP, ARCHITECTURE, PLATFORM-INTEGRATION,
  HANDOVER, SCRIPTS, CHANGELOG.
- **NOTICE** recording the MIT-licensed upstream component.

### Changed

- Source layout reorganized into core / data / news / market / render / delivery.
- HTTP layer rewritten on platform fetch with timeouts, bounded retries,
  Retry-After support, and token redaction.
- Configuration split into data sources (committed) and delivery targets
  (gitignored, env-referenced).
- Fear & Greed parsing now accepts both nested Desk3 shapes and the
  Alternative.me shape.
- License metadata corrected to PolyForm Noncommercial 1.0.0 to match LICENSE.

### Removed

- **Simulated on-chain and macro datasets** from the upstream package. Missing
  data is now reported as unavailable instead of fabricated.
- **Hardcoded CryptoPanic auth token.** Replaced by CRYPTOPANIC_TOKEN.
- **Mock news generator** and automatic fallback to fake headlines.
- **Three overlapping monitor modules** (crypto-monitor v3, v4, enhanced) merged
  into one market monitor plus an indicator module.
- **Mandatory ws dependency**; streaming is optional.
- **Interactive stdin REPL** from the upstream entry point; scheduling and
  delivery belong to the CLI and the host scheduler.
- **Legacy v1 mjs scripts and Chinese docs** (archived outside the repository;
  still available in git history).

### Fixed

- Dedupe no longer drops the higher-impact copy of a duplicated headline.
- Alert cooldown is keyed per rule and article, preventing repeat spam.
- Missing candles return available:false instead of zero-filled indicators.
- Telegram messages are chunked below the 4096-character limit.
- Slack webhook responses other than **ok** now fail the send explicitly.
- Feishu signature computed with the documented double-HMAC construction.

### Security

- Secrets resolved from env:NAME at send time; platforms.json gitignored.
- Query-string tokens redacted in HTTP error messages.
- Optional AES-256-GCM key store with scrypt-derived keys, 0600 file mode.
- Webhook payload signing available (HMAC-SHA256 over timestamp.body).

### Migration from 1.0.2

| v1 | v2 |
|----|----|
| scripts/*.mjs | bin/crypto-intel.js + npm scripts |
| terminal-only output | renderers + delivery adapters |
| Chinese documentation | English documentation |
| Desk3-only | Desk3 + Binance + optional CryptoPanic |
| no tests | 26 offline tests |
| no schema | crypto.briefing/2 |

Archived v1 files: the asset library archive, folder **2026-10-22-cryptocurrency-market-live-briefing-v1**.

---

## Upstream history (crypto-intelligence package)

The following versions were shipped by the supplied package and are preserved
here for traceability. They are not separate releases of this repository.

- **6.0.0** — sentiment index, trend, multilingual detection, export, REPL.
- **5.1.0** — news intelligence system, CryptoPanic, 12 categories, alerts.
- **4.0.0** — WebSocket stream, multi-timeframe TA, regime, signals.
- **3.0.0** — price monitor, Fear & Greed, Puell, dominance, Mayer, rainbow.
- **2.0.0** — enhanced monitor, simulated on-chain and macro data.
- **1.0.0** — initial single-source price monitor.

# CLI reference

Entry point: **bin/crypto-intel.js** (npm bin: **crypto-intel**)

All commands print human-readable output by default; machine-readable output is
available with **--json** or **--format json**.

Exit codes: **0** success, **1** runtime/partial failure, **2** usage error.

---

## news

~~~bash
crypto-intel news [--limit N] [--json] [--export FILE] [--force]
~~~

Fetches headlines from enabled sources, deduplicates, classifies, scores, and
prints the top items plus active alerts.

| Flag | Meaning |
|------|---------|
| --limit N | headlines per source |
| --json | full JSON (sentiment, coins, keywords, alerts, items) |
| --export FILE | also write JSON to FILE |
| --force | bypass the 5-minute cache |

Example:

~~~bash
crypto-intel news --limit 10
crypto-intel news --json --export reports/news.json
~~~

---

## market

~~~bash
crypto-intel market [--coins BTC,ETH] [--json]
~~~

Spot quotes, Fear & Greed, BTC dominance, Puell multiple, regime, and technical
bias. Oversized requests are bounded by the configured coin list.

---

## brief

~~~bash
crypto-intel brief [--format FMT] [--out FILE] [--news N]
                   [--coins BTC,ETH] [--limit N]
                   [--news-only] [--market-only]
~~~

Builds the canonical briefing and renders it.

| Format | Output |
|--------|--------|
| markdown (default) | Markdown document |
| plain | Fixed-width text for chat |
| json | Full briefing schema |
| telegram | HTML payload |
| discord | Embed payload |
| slack | Block Kit payload |
| feishu | Interactive card payload |

**--news N** controls how many headlines are rendered (default 5).
**--out FILE** writes instead of printing. Directories are created.

Examples:

~~~bash
crypto-intel brief --format markdown --out reports/latest.md
crypto-intel brief --format json --out reports/brief.json
crypto-intel brief --news-only --format plain
crypto-intel brief --market-only --coins BTC,ETH,SOL
~~~

---

## publish

~~~bash
crypto-intel publish [--platform NAME] [--dry-run] [--news N] [--limit N]
~~~

Builds one briefing, then delivers to every enabled target (or one named target).

- **--dry-run** validates configuration and rendering without a network call.
- The command prints a JSON result array; exit code is 1 if any target failed.
- Targets are isolated: one failure does not stop the others.

---

## doctor

~~~bash
crypto-intel doctor
~~~

Checks Node version, configuration load, Desk3 spot, Binance klines, Desk3 news,
CryptoPanic configuration, and delivery targets. Exit code 1 if a required check
fails.

---

## config

~~~bash
crypto-intel config
~~~

Prints the effective configuration with token/secret/key fields masked.

---

## npm scripts

| Script | Equivalent |
|--------|------------|
| npm start | brief |
| npm run news | news |
| npm run market | market |
| npm run brief | brief |
| npm run publish | publish |
| npm run doctor | doctor |
| npm test | node --test test/*.test.js |
| npm run lint | node scripts/check.js |

---

## Programmatic use

~~~js
const { createSystem } = require('./src');

const system = createSystem();
const briefing = await system.briefing.build({ coins: ['BTC', 'ETH'] });
const markdown = system.render('markdown', briefing);
await system.publishBriefing(briefing, system.config, { platform: 'telegram' });
~~~

The news and market subsystems are available separately
(**system.news.collect()**, **system.market.getOverview()**) when a caller only
needs one section.

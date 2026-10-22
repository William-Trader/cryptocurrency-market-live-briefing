---
name: crypto-market-live-briefing
description: Crypto market intelligence briefing - aggregated news with sentiment and impact scoring, spot quotes, Fear & Greed, dominance, Puell, RSI/MACD/Bollinger, regime detection, alerting, and delivery to Telegram, Discord, Slack, Feishu, WeCom, QQ, or a webhook. Zero runtime dependencies. Research only, not investment advice.
homepage: https://github.com/
readme: README.md
metadata: {"openclaw":{"emoji":"📊","requires":{"bins":["node"]},"primaryEnv":""}}
---

# Crypto Market Live Briefing

One pipeline: collect -> score -> brief -> render -> deliver.

## When to use this skill

- The user asks for a crypto market update, briefing, or news digest.
- A scheduled group-chat post needs prices, sentiment, and headlines.
- The user wants the same content in more than one chat platform.
- The user asks why a coin is moving and wants news plus technical context.

## Commands

~~~bash
node bin/crypto-intel.js news --limit 10
node bin/crypto-intel.js market --coins BTC,ETH,SOL
node bin/crypto-intel.js brief --format markdown --out reports/latest.md
node bin/crypto-intel.js publish --platform telegram --dry-run
node bin/crypto-intel.js doctor
~~~

Paths are relative to the skill directory. Use **{baseDir}** when invoking from
an agent workspace:

~~~bash
node {baseDir}/bin/crypto-intel.js brief --format json
~~~

## What the output guarantees

- **asOf** timestamps for market and news; no undated numbers.
- **sources** with per-provider status; degraded sections are named.
- **verdict** with a stance and a one-line reason.
- **disclaimer** on every rendered format.

## Rules

- Never present the output as investment advice; keep the disclaimer.
- If **doctor** fails a required check, report the failing source instead of
  guessing numbers.
- A failed section is delivered as missing, never filled with mock data.
- Do not commit config/platforms.json; it holds chat credentials.

## Related

- docs/SETUP.md — deployment and scheduling
- docs/PLATFORM-INTEGRATION.md — platform matrix and adapter contract
- docs/HANDOVER.md — acceptance checklist and runbooks

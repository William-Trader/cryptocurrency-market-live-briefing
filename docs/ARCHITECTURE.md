# Architecture

---

## 1. Layers

~~~text
              +-------------------+
              |   CLI (bin/)      |
              +---------+---------+
                        |
              +---------v---------+
              |  src/index.js     |  system facade
              +----+---------+----+
                   |         |
      +------------v--+   +--v--------------+
      | news/         |   | market/         |
      | aggregator    |   | quotes, cycles  |
      | classifier    |   | indicators      |
      | sentiment     |   | regime          |
      | alerts        |   | correlation     |
      +-------+-------+   +--------+--------+
              |                    |
              +---------+----------+
                        |
              +---------v---------+
              |  briefing.js      |  canonical schema + verdict
              +----+---------+----+
                   |         |
        +----------v--+   +--v----------------+
        | render/     |   | delivery/         |
        | markdown    |   | telegram, discord |
        | plain, html |   | slack, feishu,    |
        | embeds      |   | wecom, qq, hook   |
        +-------------+   +-------------------+
~~~

Dependencies point downward only. Renderers and adapters never fetch data;
collectors never format output. This is what makes one briefing portable.

---

## 2. Data flow

1. **Collect** — Desk3 spot and cycle endpoints, Binance candles, optional
   CryptoPanic. Each call is timeout-bounded and independently fallible.
2. **Normalize** — provider rows become NewsItem objects or quote objects with a
   single shape (symbol, price, change24hPct, timestamp).
3. **Score** — keyword sentiment (-1..+1), category (12 classes), impact (1..10),
   coin extraction, language detection.
4. **Aggregate** — deduplicate by normalized title, compute the 0-100 sentiment
   index, coin sentiment, top keywords, and alerts with cooldown.
5. **Build** — assemble the briefing schema with asOf timestamps, source status,
   errors, verdict, and disclaimer.
6. **Render** — map the same object to a platform payload.
7. **Deliver** — POST with retries, Retry-After handling, and secret resolution.

Any stage may degrade. A failed news source removes the news section but still
delivers market context, and vice versa. The builder only throws when every
section failed.

---

## 3. Briefing schema

Schema id: **crypto.briefing/2**

~~~json
{
  "schema": "crypto.briefing/2",
  "id": "brief_20261022T060000Z_653eb4",
  "generatedAt": "2026-10-22T06:00:00.000Z",
  "asOf": { "market": "...", "news": "...", "generated": "..." },
  "window": { "candles": "1h", "newsLimit": 30 },
  "market": {
    "quote": "USDT",
    "prices": [{ "symbol": "BTC", "price": 82816.51, "change24hPct": 0.17, "timestamp": 0 }],
    "fearGreed": { "value": 53, "classification": "Neutral" },
    "puell": { "value": 1.12, "percentile": 0.4 },
    "dominance": { "btc": 60.07, "eth": 8.4, "others": 31.53 },
    "regime": { "regime": "range", "momentum20": -0.73, "confidence": 0.3 },
    "technicals": { "BTC": { "bias": "bearish", "rsi14": 36.84, "trend": "down" } },
    "correlation": { "base": "BTC", "values": { "ETH": 0.91 } }
  },
  "news": {
    "items": [{ "title": "...", "category": "WHALE", "sentiment": 0.6, "impactScore": 9 }],
    "sentiment": { "index": 56, "label": "neutral", "trend": "flat" },
    "coinSentiments": { "ETH": { "count": 1, "trend": "bullish" } },
    "alerts": []
  },
  "verdict": { "stance": "neutral", "label": "Wait and see", "reasoning": "..." },
  "sources": [{ "name": "Desk3 Spot", "status": "ok" }],
  "errors": [],
  "disclaimer": "..."
}
~~~

Rules:

- **asOf** is mandatory; consumers must be able to tell how old a number is.
- **sources** reports per-provider status; a degraded run is visible, not silent.
- **errors** lists failed sections; absence means every requested section loaded.
- **disclaimer** is always present so downstream bots cannot drop it accidentally.

---

## 4. Sentiment model

Keyword lexicon with contrastive counts:

~~~text
score = (bullish_hits - bearish_hits) / max(3, total_hits)
~~~

Range -1..+1. The market index compresses the mean into 0-100:

~~~text
index = clamp(50 + mean_sentiment * 50, 0, 100)
~~~

Labels: 0-24 extreme fear, 25-39 fear, 40-59 neutral, 60-74 greed,
75-100 extreme greed. Trend compares the new index with the previous run
(rising / falling / flat, threshold 2 points).

Limitations: keyword scoring is fast, deterministic, and explainable, but it can
misread sarcasm, negation, and macro headlines that merely mention a coin. The
engine labels every score so a human can override it.

---

## 5. Technical analysis

Candles come from Binance klines and are processed oldest-first.

| Indicator | Parameters | Output |
|-----------|------------|--------|
| SMA | 20, 50 | trend direction |
| EMA | configurable | used by MACD |
| RSI | 14 | overbought / oversold |
| MACD | 12/26/9 | histogram bias |
| Bollinger | 20, 2σ | position vs bands |
| ATR | 14 | volatility |

Insufficient candles return **available: false** and a reason. The system never
invents values to fill a table.

Regime classification uses SMA20 vs SMA50 plus 20-bar momentum:

- **bull**: SMA20 > SMA50 and momentum > 2%
- **bear**: SMA20 < SMA50 and momentum < -2%
- **range**: everything else

---

## 6. Failure model

| Failure | Effect | Recovery |
|---------|--------|----------|
| Desk3 spot down | Market section missing; error recorded | Retry next run |
| Binance blocked | Technicals unavailable; quotes and news still delivered | Automatic |
| News source down | News section missing; market still delivered | Automatic |
| All sources down | Builder throws; CLI exits 1; no empty message sent | Alert the operator |
| Platform rejects payload | Adapter records error; other platforms still receive | Fix config |
| 429 | Backoff, Retry-After honored, limited retries | Automatic |

The guiding rule: **partial data with an explicit marker beats invented data.**

---

## 7. Security

- Secrets are resolved from **env:NAME** references at send time.
- config/platforms.json is gitignored.
- HTTP errors redact token-like query parameters.
- Webhook payloads may be signed with HMAC-SHA256 (timestamp.body).
- The optional KeyStore encrypts API keys with AES-256-GCM (scrypt-derived key).
- Logs never print secret values; mask() is available for diagnostics.

---

## 8. Design decisions

**Zero runtime dependencies.** Node 18+ ships fetch, crypto, and test runner.
Fewer dependencies means fewer supply-chain and upgrade failures for a bot that
must run unattended.

**No simulated data.** The upstream v6 package generated fake on-chain and
macro numbers. That is unacceptable for a research tool: v2 removes every mock
path. If a provider is down, the section is marked unavailable.

**One schema, many renderers.** Platform drift is the main maintenance cost in
multi-chat bots. Renderers are pure functions over the briefing, covered by
offline tests.

**Adapters are dumb.** They translate a payload into a POST request. Business
logic stays upstream, so adding a platform never touches scoring code.

**Scheduling is external.** The process is a one-shot command. cron, systemd,
launchd, or an OpenClaw automation owns timing; the code does not loop or sleep.

---

## 9. Extension points

| Goal | Where |
|------|-------|
| New data provider | src/data/, return normalized rows |
| New indicator | src/market/indicators.js |
| New category | CATEGORIES + keyword lists in src/news/engine.js |
| New output format | src/render/, add a renderer and a dispatcher case |
| New chat platform | src/delivery/, implement send() and register the adapter |
| New score/verdict rule | src/briefing.js verdictFor() |

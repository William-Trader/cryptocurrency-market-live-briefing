# Baseline handover

**Project:** cryptocurrency-market-live-briefing
**Version:** 2.0.0
**Baseline date:** 2026-10-22
**Status:** runnable, offline-tested, network-verified against live endpoints

This is the document to hand to whoever operates or extends the system next. It
states what is in scope, how to prove it works, how to run it, and what is still
open. It is deliberately blunt about limits.

---

## 1. What was delivered

v2.0.0 replaces the v1 script collection with a single briefing pipeline built
around one canonical schema.

| Area | State | Evidence |
|------|-------|----------|
| News aggregation (Desk3) | working | **news** returns 10+ scored items live |
| CryptoPanic | optional | skipped without CRYPTOPANIC_TOKEN; no hardcoded key |
| Classification (12 categories) | working | unit tests |
| Sentiment (-1..+1, 0-100 index) | working | unit tests + live run |
| Impact scoring, coin extraction | working | unit tests + live run |
| Alert rules + cooldown | working | unit test |
| Spot quotes (Desk3) | working | live: BTC/ETH/SOL/BNB |
| Fear & Greed, dominance, Puell, cycles | working | live response parsed |
| Binance candles + RSI/MACD/BB/ATR | working | 200-candle live fetch |
| Regime + correlation | working | live run |
| Canonical briefing + verdict | working | **brief --format json** |
| Renderers: markdown/plain/telegram/discord/slack/feishu | working | 6 offline tests |
| Delivery: telegram/discord/slack/feishu/wecom/qq/webhook | implemented | dry-run + offline tests; real send requires credentials |
| CLI: news/market/brief/publish/doctor/config | working | live commands |
| Tests | 26 passing | **npm test** |
| English-only source and docs | verified | CJK scan returns zero |

### Explicitly removed from the upstream v6 package

- **Simulated on-chain and macro data.** Fake numbers are worse than missing
  numbers in a research tool.
- **Hardcoded CryptoPanic token.** Replaced with CRYPTOPANIC_TOKEN.
- **Three overlapping monitor modules.** Consolidated into one market monitor
  plus an indicator module.
- **Mock news generator.** No silent fallback to invented headlines.
- **Dependency on **ws** for core operation.** Streams are optional.

---

## 2. Acceptance checklist

Run in order on the target host. Do not sign off on a dry run alone.

~~~bash
node --version                  # >= 18
npm test                        # 26 passing
node bin/crypto-intel.js doctor # required checks OK
node bin/crypto-intel.js brief --format json --out /tmp/brief.json
node -e "const b=require('/tmp/brief.json'); console.log(b.schema, b.market.prices.length, b.news.items.length, b.verdict.label)"
node bin/crypto-intel.js publish --platform <name> --dry-run
node bin/crypto-intel.js publish --platform <name>
~~~

Sign-off requires:

- [ ] tests pass on the deployment host;
- [ ] doctor shows desk3.spot, binance.klines, desk3.news OK;
- [ ] the briefing JSON carries schema, asOf, sources, and a disclaimer;
- [ ] one real message is observed in the target group;
- [ ] a second run does not duplicate alerts inside the cooldown window;
- [ ] no secret appears in the repository or in logs.

---

## 3. Configuration inventory

| File | Committed | Contains | Owner action |
|------|-----------|----------|--------------|
| config/sources.json | yes | endpoints, coin lists, limits | edit for defaults |
| config/platforms.example.json | yes | target template | copy to platforms.json |
| config/platforms.json | no | webhook URLs, ids | create on host, 600 perms |
| .env / environment file | no | tokens and secrets | provide via systemd/launchd |

Environment variables are listed in SETUP.md. Every **env:NAME** reference is
resolved at send time; a literal value also works for a private machine.

---

## 4. Runbooks

### Scheduled briefing stops arriving

1. **node bin/crypto-intel.js doctor** — identify the failing layer.
2. Check the scheduler: **systemctl status crypto-briefing.timer** or
   **launchctl print** for the agent.
3. Run **publish** manually and read the exit code and JSON result.
4. If delivery fails, verify the target's credentials and that the bot is still
   in the group.
5. If every data source fails, check outbound HTTPS and DNS; the builder refuses
   to send an empty briefing by design.

### A headline is misclassified

Classification is keyword-driven. Tune CATEGORIES/KEYWORDS in
**src/news/engine.js**, then run **npm test** and a live **news** command.
Do not patch the rendered output; fix the classifier so every platform benefits.

### Sentiment looks wrong

Check whether the headline is macro news that merely mentions a coin. The score
is intentionally simple and explainable. If a systematic miss appears, add the
term to the bullish/bearish lexicon and extend the tests with a real headline.

### A platform rejects the payload

Read the adapter error in the publish result. Common causes: wrong chat id,
webhook revoked, Feishu signature mismatch, OneBot bot not in group. The other
platforms still receive the message; failures are isolated per target.

### Rotating a secret

1. Update the environment file or the secret manager.
2. Restart the scheduler unit if it caches the environment.
3. Run **publish --dry-run**, then a real send.
4. Confirm the old credential is revoked at the provider.

---

## 5. Known limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Keyword sentiment cannot parse negation/sarcasm | occasional mislabels | human review; lexicon tuning |
| Macro headlines that mention a coin can skew coin sentiment | noisy coin scores | weight by category in a future version |
| Binance may be geo-blocked | technicals unavailable | quotes/news still delivered; configure a mirror |
| CryptoPanic needs a paid token | one fewer news source | Desk3 covers the baseline |
| QQ delivery depends on an external OneBot process | extra moving part | monitor the OneBot endpoint |
| No persistence layer | no cross-run alert dedupe after restart | cooldown is in-memory by design; add a store if needed |
| No historical backfill API | briefings are point-in-time | export JSON per run and archive it |

---

## 6. Roadmap (ordered by value)

1. **Persistence** for alert dedupe and 7-day sentiment history (SQLite or JSONL).
2. **Confidence weighting** for macro headlines (down-weight items without a
   crypto-specific entity).
3. **Additional adapters**: DingTalk, Matrix, Zulip, ntfy.
4. **Message threading** for Telegram topics and Slack threads.
5. **Prometheus metrics** endpoint for delivery success and source latency.
6. **Backtest harness** for the verdict rule (hit rate by regime).

---

## 7. Change control

- Every behavioral change updates docs/CHANGELOG.md and the version in
  package.json + _meta.json.
- Schema changes bump **schema** (currently crypto.briefing/2) and must keep
  older fields for one minor release.
- New platform support requires a real-send verification row in this file.
- Security fixes are called out under **Security** in the changelog.

---

## 8. Handover sign-off

| Item | Owner | Date | Note |
|------|-------|------|------|
| Code and tests verified | | | npm test 26/26 |
| Live data verified | | | Desk3 + Binance + news |
| Delivery verified (platform 1) | | | real message observed |
| Delivery verified (platform 2) | | | |
| Secrets stored outside repo | | | 600 perms / env file |
| Scheduler active | | | timer or agent listed |
| Monitoring/alerting assigned | | | who gets paged |

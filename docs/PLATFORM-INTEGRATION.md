# Platform integration baseline

This document is the contract for connecting the briefing pipeline to any group
chat platform. It exists so a new platform can be added without reading the
scoring code, and so an operator can verify a deployment platform by platform.

---

## 1. Adapter contract

Every adapter implements one method:

~~~js
async send({ briefing, target, timeoutMs, retries })
  -> { platform, ok, status, detail }
~~~

- **briefing** — canonical object, schema crypto.briefing/2.
- **target** — the platform block from config/platforms.json, secrets resolved
  through env:NAME references.
- **ok** — false or a thrown error both fail the run; the CLI exits 1.
- Adapters must not mutate the briefing and must not fetch market data.
- Adapters may chunk messages when the platform enforces a size limit.

Registry location: **src/delivery/index.js** (ADAPTERS). Adding an adapter:

1. Implement **send()** with the signature above.
2. Register the class in ADAPTERS under one or more aliases.
3. Add a renderer if the platform needs a structured payload.
4. Add an offline test for payload shape and a dry-run test.
5. Document credentials and limits in this file.

---

## 2. Support matrix

| Platform | adapter | Renderer | Max body | Rate limit (typical) | Auth |
|----------|---------|----------|----------|----------------------|------|
| Telegram | telegram | telegram (HTML) | 4096 chars | ~30 msg/s per bot | Bot token |
| Discord | discord | discord (embed) | 6000 chars / 25 fields | 30 req/min per webhook | Webhook URL |
| Slack | slack | slack (Block Kit) | 50 blocks | 1 msg/s per webhook | Webhook URL |
| Feishu / Lark | feishu | feishu (card) | 30 KB | 100 req/min per bot | Webhook (+ sign) |
| WeCom | wecom | markdown | 4096 bytes | 20 msg/min per bot | Webhook key |
| QQ (OneBot v11) | qq | plain | deployment-defined | deployment-defined | HTTP + token |
| Generic | webhook | markdown + JSON | deployment-defined | deployment-defined | HMAC optional |

The adapter chunks where the platform caps text. If you add a platform with a
hard body limit, chunk in the adapter, not in the renderer.

---

## 3. Per-platform setup

### Telegram

1. Talk to **@BotFather**, create a bot, copy the token.
2. Add the bot to the target group.
3. Get the chat id: send a message in the group, then call
   **https://api.telegram.org/botTOKEN/getUpdates** and read **chat.id**
   (group ids are negative).
4. Configure:

~~~json
{
  "telegram": {
    "enabled": true,
    "adapter": "telegram",
    "botToken": "env:TELEGRAM_BOT_TOKEN",
    "chatId": "env:TELEGRAM_CHAT_ID",
    "messageThreadId": null,
    "news": 5
  }
}
~~~

Notes: HTML parse mode is used, so headlines are escaped. Links are wrapped in
anchors; previews are disabled. Set **messageThreadId** for forum topics.

### Discord

1. Channel settings -> Integrations -> Webhooks -> New webhook.
2. Copy the webhook URL.
3. Configure with **adapter: discord**.

Notes: the payload is a single embed with Market, Context, Sentiment, and Top
headlines fields. Field values are truncated to 1024 characters.

### Slack

1. Create an Incoming Webhook for the channel.
2. Copy the URL.
3. Configure with **adapter: slack**.

Notes: Block Kit header/section/context blocks. Headlines use Slack link syntax.
The webhook responds with the plain string **ok**; any other body fails the send.

### Feishu / Lark

1. Group settings -> Bots -> Add custom bot.
2. Copy the webhook URL. Enable signature verification if required and copy the
   sign secret.
3. Configure:

~~~json
{
  "feishu": {
    "enabled": true,
    "adapter": "feishu",
    "webhookUrl": "env:FEISHU_WEBHOOK_URL",
    "secret": "env:FEISHU_SIGN_SECRET",
    "news": 5
  }
}
~~~

Notes: sends **msg_type: interactive** with a wide-screen card. Header color
maps the verdict: defensive green, cautious orange, otherwise blue. Signature =
base64(HMAC-SHA256(key=HMAC-SHA256(timestamp + "\\n" + secret, ""), data="")).

### WeCom (WeChat Work)

1. Group -> Group robot -> Add robot -> copy the webhook key URL.
2. Configure with **adapter: wecom**.

Notes: markdown message capped at 4096 bytes; long briefings are truncated.
WeCom markdown does not support tables, so the renderer emits lists.

### QQ via OneBot v11

1. Run a OneBot v11 implementation (NapCat, LLOneBot, go-cqhttp) reachable over
   HTTP.
2. Note the HTTP base URL and access token; note the group id.
3. Configure:

~~~json
{
  "qq": {
    "enabled": true,
    "adapter": "qq",
    "baseUrl": "env:ONEBOT_HTTP_URL",
    "accessToken": "env:ONEBOT_ACCESS_TOKEN",
    "groupId": "env:QQ_GROUP_ID",
    "news": 5
  }
}
~~~

Notes: uses **send_group_msg** when groupId is set, otherwise **send_private_msg**.
Messages are plain text, chunked at 2000 characters. QQ clients render links as
text, so the plain renderer keeps URLs on their own line where possible.

### Generic webhook

Best for a relay, an internal bus, or an OpenClaw channel fan-out.

~~~json
{
  "custom": {
    "enabled": true,
    "adapter": "webhook",
    "url": "env:BRIEFING_WEBHOOK_URL",
    "secret": "env:BRIEFING_WEBHOOK_SECRET",
    "payload": "briefing"
  }
}
~~~

- **payload: briefing** sends the canonical schema.
- **payload: text** sends { text, briefing } for simple relays.
- If a secret is set, headers include **X-Crypto-Briefing-Timestamp** and
  **X-Crypto-Briefing-Signature: sha256=HMAC(timestamp + "." + body)**.

---

## 4. Rendering map

| Section | Markdown / plain | Telegram | Discord | Slack | Feishu | WeCom |
|---------|------------------|----------|---------|-------|--------|-------|
| Verdict | bold line | bold | embed title | header | card header | bold |
| Prices | table | one line per coin | field | section | div | list |
| Sentiment | index line | bold line | field | context | div | line |
| Headlines | numbered list | linked list | markdown links | mrkdwn links | lark_md links | list |
| Disclaimer | italic | italic | footer | context | note | line |

Direction convention: round markers are 🔴 for up and 🟢 for down, following the
A-share red-up/green-down convention. Arrows are ▲ / ▼ in text contexts.

---

## 5. Security baseline

- Keep secrets out of the repository: use env: references and a 600-permission
  environment file.
- **config/platforms.json** is gitignored; **config/platforms.example.json** is
  the template.
- Every outbound request is timeout-bounded (default 15 s) and retried at most
  twice.
- Error messages redact token-like query parameters before logging.
- Webhook receivers should verify the HMAC signature and reject stale timestamps
  (more than 5 minutes old).
- Do not log message bodies containing user data; briefings contain public market
  data only.

---

## 6. Verification matrix

Run this for each platform before calling a deployment done.

| Check | Command | Expected |
|-------|---------|----------|
| Config parsed | node bin/crypto-intel.js config | targets listed, secrets masked |
| Render valid | node bin/crypto-intel.js brief --format telegram | non-empty payload |
| Dry run | node bin/crypto-intel.js publish --platform NAME --dry-run | ok: true, dryRun: true |
| Real send | node bin/crypto-intel.js publish --platform NAME | ok: true, status 200 |
| Idempotence | run twice | two messages, no duplicate alerts within cooldown |
| Degraded run | unset a data source | briefing still delivered with an error marker |

A platform is only "supported" after a real message is observed in the target
group, not after a dry run.

---

## 7. Adding a platform (checklist)

1. Create **src/delivery/<name>.js** or add a class in index.js.
2. Implement **send()**; throw a precise error when credentials are missing.
3. Chunk to the platform limit; never split inside a URL if avoidable.
4. Add a renderer if the platform needs structured JSON; otherwise reuse plain.
5. Register in ADAPTERS and add the block to platforms.example.json.
6. Add tests: missing credentials, payload shape, chunking.
7. Update the support matrix and per-platform section above.
8. Record the real-send verification date in HANDOVER.md.

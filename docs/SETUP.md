# Setup

From a clean machine to a scheduled briefing in a group chat.

---

## 1. Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js >= 18 | No npm dependencies are required for core operation |
| Outbound HTTPS | api1.desk3.io, api.binance.com, api.alternative.me |
| Chat credentials | Bot token, webhook URL, or OneBot endpoint for your platform |

Optional: **npm install** adds the optional ws package for WebSocket streaming.
Core commands work without it.

---

## 2. Install

~~~bash
git clone <your-repo> cryptocurrency-market-live-briefing
cd cryptocurrency-market-live-briefing
node bin/crypto-intel.js doctor
~~~

Expected output:

~~~text
DOCTOR
  OK    node             v24.x
  OK    config           /path/to/repo
  OK    desk3.spot       82816.51
  OK    binance.klines   200 candles
  OK    desk3.news       3 items
  OK    cryptopanic      skipped (no token)
  OK    delivery         none configured
~~~

**delivery** is OK when the command runs; the detail lists configured targets.

---

## 3. Configure data sources

Defaults live in **config/sources.json**. Override with environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| DESK3_BASE_URL | https://api1.desk3.io/v1 | Spot, cycle metrics, news |
| BINANCE_BASE_URL | https://api.binance.com | OHLCV candles |
| CRYPTOPANIC_TOKEN | empty | Enables CryptoPanic news |
| WATCH_COINS | BTC,ETH,SOL,... | Coins tracked in news |
| MARKET_COINS | BTC,ETH,SOL,BNB | Coins in the market section |
| NEWS_LIMIT | 30 | Headlines fetched per source |
| KLINE_INTERVAL | 1h | Candle interval for indicators |
| LOG_LEVEL | info | silent, error, warn, info, debug |

---

## 4. Configure delivery

~~~bash
cp config/platforms.example.json config/platforms.json
~~~

Each target supports two forms:

1. **Literal value** — convenient for a private machine.
2. **env:NAME** — resolves at runtime from the environment (recommended).

Example (Telegram):

~~~json
{
  "telegram": {
    "enabled": true,
    "adapter": "telegram",
    "botToken": "env:TELEGRAM_BOT_TOKEN",
    "chatId": "env:TELEGRAM_CHAT_ID",
    "news": 5
  }
}
~~~

Then:

~~~bash
export TELEGRAM_BOT_TOKEN="..."
export TELEGRAM_CHAT_ID="..."
node bin/crypto-intel.js publish --platform telegram --dry-run
node bin/crypto-intel.js publish --platform telegram
~~~

Platform-specific setup (bot creation, webhook URLs, signing) is documented in
[PLATFORM-INTEGRATION.md](PLATFORM-INTEGRATION.md).

**config/platforms.json is gitignored** because it commonly contains secrets.

---

## 5. Schedule it

### cron

~~~cron
# Every 4 hours at minute 5
5 */4 * * * cd /opt/cryptocurrency-market-live-briefing && /usr/bin/node bin/crypto-intel.js publish >> /var/log/crypto-briefing.log 2>&1
~~~

### systemd (Linux)

/etc/systemd/system/crypto-briefing.service

~~~ini
[Unit]
Description=Crypto market briefing
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/cryptocurrency-market-live-briefing
EnvironmentFile=/etc/crypto-briefing.env
ExecStart=/usr/bin/node bin/crypto-intel.js publish

[Install]
WantedBy=multi-user.target
~~~

/etc/systemd/system/crypto-briefing.timer

~~~ini
[Unit]
Description=Run crypto briefing every 4 hours

[Timer]
OnCalendar=*-*-* 00/4:05:00
Persistent=true

[Install]
WantedBy=timers.target
~~~

~~~bash
sudo systemctl daemon-reload
sudo systemctl enable --now crypto-briefing.timer
systemctl list-timers crypto-briefing.timer
~~~

### launchd (macOS)

~/Library/LaunchAgents/com.example.crypto-briefing.plist

~~~xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.example.crypto-briefing</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/opt/cryptocurrency-market-live-briefing/bin/crypto-intel.js</string>
    <string>publish</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>0</integer><key>Minute</key><integer>5</integer></dict>
    <dict><key>Hour</key><integer>4</integer><key>Minute</key><integer>5</integer></dict>
    <dict><key>Hour</key><integer>8</integer><key>Minute</key><integer>5</integer></dict>
    <dict><key>Hour</key><integer>12</integer><key>Minute</key><integer>5</integer></dict>
    <dict><key>Hour</key><integer>16</integer><key>Minute</key><integer>5</integer></dict>
    <dict><key>Hour</key><integer>20</integer><key>Minute</key><integer>5</integer></dict>
  </array>
  <key>StandardOutPath</key><string>/tmp/crypto-briefing.log</string>
  <key>StandardErrorPath</key><string>/tmp/crypto-briefing.err</string>
</dict>
</plist>
~~~

### OpenClaw automation

Use the Gateway scheduler with a shell payload:

~~~bash
cd /opt/cryptocurrency-market-live-briefing && node bin/crypto-intel.js publish
~~~

Do not run a sleep/poll loop; let the scheduler own timing.

---

## 6. Verify

~~~bash
npm test
node bin/crypto-intel.js doctor
node bin/crypto-intel.js brief --format markdown --out reports/latest.md
node bin/crypto-intel.js publish --dry-run
~~~

Acceptance:

- doctor exits 0 and every required check is OK;
- the briefing contains prices, sentiment, headlines, and a verdict;
- a dry run lists every enabled platform;
- one real delivery produces a message in the target chat.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| HTTP 429 from a platform | Sending too often | Increase the interval; the client already honors Retry-After |
| **desk3.spot FAIL** | Network, DNS, or upstream outage | Retry; check connectivity with curl |
| **binance.klines FAIL** | Region block or outage | Indicators degrade gracefully; quotes still work |
| Empty news list | Upstream returning no rows | Check **news --json**, then the Desk3 endpoint directly |
| Telegram 400 | Chat id wrong or bot not in chat | Add the bot to the group; use the negative group id |
| Feishu 19021 | Signature mismatch | Verify the sign secret and system clock |
| QQ retcode 100 | Bot not in group or wrong id | Confirm the OneBot account and group id |
| No platforms enabled | platforms.json missing | Copy platforms.example.json |

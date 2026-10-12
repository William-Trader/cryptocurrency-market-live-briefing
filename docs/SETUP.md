# 🔧 布设指南 — 从零搭建这套监测系统

> 本指南面向 **零基础新手**，手把手教你搭建 William's Research System v2.0（加密货币实时监测 + 品种优选系统）。
> 预计用时：15-30 分钟。

---

## 📋 目录

1. [了解你要搭建的东西](#1-了解你要搭建的东西)
2. [前置准备](#2-前置准备)
3. [安装步骤](#3-安装步骤)
4. [验证安装](#4-验证安装)
5. [配置定时任务](#5-配置定时任务)
6. [接入通知渠道](#6-接入通知渠道)
7. [个性化配置](#7-个性化配置)
8. [常见问题](#8-常见问题)

---

## 1. 了解你要搭建的东西

### 这套系统能做什么？

| 功能 | 说明 |
|------|------|
| 📝 **每日日报** | 一键生成完整市场报告（价格 + 情绪 + 指标 + 新闻） |
| 🎯 **品种优选** | 从全市场筛选做多/做空信号最强的 1-3 个具体币种 |
| 😱 **情绪监测** | 恐惧贪婪指数、山寨季指数实时追踪 |
| 📊 **技术仪表盘** | Puell 倍数、Pi Cycle、BTC 主导率等 30+ 指标 |
| 🔥 **热门币追踪** | 24h 成交额 TOP10，捕捉资金动向 |
| 📰 **新闻聚合** | 加密行业 + 宏观政策新闻，一站式获取 |
| ⏰ **自动推送** | 每 4 小时自动推送，无需人工干预 |

### 系统架构概览

```
你的服务器 / 电脑
    │
    ▼
┌────────────────────────────────────┐
│  Node.js 运行环境                   │
│  ┌──────────────────────────────┐  │
│  │  Desk3 API（REST 调取）      │  │  ← 价格、情绪、周期指标
│  │  Coinglass（浏览器爬取）      │  │  ← RSI、资金费率、多空比、爆仓
│  │  7维评分引擎                  │  │  ← 多指标共振评分
│  │  输出层（文本/推送）          │  │  ← 报告生成
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
    │
    ▼
  OpenClaw Agent（定时触发 + 消息推送）
    │
    ▼
  微信群 / Telegram / 元宝（你的通知渠道）
```

---

## 2. 前置准备

### 必备条件

| 软件 | 检查命令 | 最低版本 |
|------|---------|---------|
| Node.js | `node --version` | v18+ |
| npm | `npm --version` | v8+ |
| Chromium / Chrome | 见下方 | 系统浏览器 |

### 检查你的环境

打开终端，执行：

```bash
# 检查 Node.js
node --version
# 应该看到 v18.x.x 或更高

# 检查 npm
npm --version
# 应该看到 8.x.x 或更高

# 检查 Chrome 路径
which google-chrome-stable
# 应该显示路径，如 /usr/bin/google-chrome-stable
```

### 如果没有 Node.js？

**macOS：**
```bash
brew install node
```

**Ubuntu / Debian：**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows：**
去 [nodejs.org](https://nodejs.org) 下载 LTS 版本安装。

### 如果没有 Chrome？

**Ubuntu / Debian：**
```bash
sudo apt update
sudo apt install -y chromium chromium-driver
# 或安装 Google Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
sudo apt update
sudo apt install -y google-chrome-stable
```

---

## 3. 安装步骤

### Step 1：获取这套系统

**方式 A：复制整个 skill 目录（如果你已有）**
```bash
# 找到系统所在路径（参考）
ls /root/.openclaw/workspace/skills/cryptocurrency-market-live-briefing/
```

**方式 B：从 GitHub 克隆（如已发布）**
```bash
git clone https://github.com/your-username/crypto-research-system.git
cd crypto-research-system
```

**方式 C：手动复制**
把整个 `cryptocurrency-market-live-briefing/` 目录复制到你的 OpenClaw workspace：

```
你的OpenClaw工作区/
└── workspace/
    └── skills/
        └── cryptocurrency-market-live-briefing/
            ├── SKILL.md
            ├── scripts/
            │   ├── crypto-daily-report.mjs
            │   ├── coin-screener.mjs
            │   └── ...（其他脚本）
            └── docs/
                └── ...（文档）
```

### Step 2：安装 Playwright（用于浏览器爬取）

> ⚠️ 注意：纯 API 脚本（`crypto-daily-report.mjs`、`briefing.mjs` 等）不需要 Playwright。只有 `coin-screener.mjs` 和 `crypto-monitor.mjs` 需要。

```bash
# 进入 skill 目录
cd /path/to/cryptocurrency-market-live-briefing

# 安装 playwright-chromium（推荐用这个包）
npm install playwright-chromium

# 安装 Chromium 浏览器（约 150MB）
npx playwright install chromium
```

安装过程中看到类似输出即成功：
```
Downloading Chromium...
Installing Chromium...
```

### Step 3：验证 Node 环境

```bash
node --version
# v18.x.x 或更高 ✅
```

---

## 4. 验证安装

### 快速测试（纯 API，无需浏览器）

```bash
cd /path/to/cryptocurrency-market-live-briefing
node scripts/prices.mjs
```

**预期输出：**
```
📊 BTC/ETH/SOL 实时价格
══════════════════════════════════
  BTC: $64,893.70  (-0.10%)
  ETH: $1,911.16   (-0.30%)
  SOL: $76.31      (+0.37%)
  数据时间: 2026/08/10 08:00
══════════════════════════════════
```

如果看到这个输出，说明 **API 连通正常**，系统可以跑了。

### 完整日报测试

```bash
node scripts/crypto-daily-report.mjs
```

这个命令会并行拉取 13 类数据（约 2-5 秒），你应该看到完整的日报格式输出。

### 浏览器脚本测试（需要 Playwright）

```bash
node scripts/coin-screener.mjs
```

> 如果遇到浏览器报错：`Error: Failed to launch browser`
> → 回到 Step 2，确保 Playwright 和 Chromium 都装好了。

---

## 5. 配置定时任务

### 方案 A：OpenClaw Heartbeat（推荐给 OpenClaw 用户）

编辑你的 `HEARTBEAT.md` 文件：

```markdown
# HEARTBEAT.md

## 定时检查

### 每 4 小时：运行品种优选
- 运行脚本：`node {baseDir}/scripts/coin-screener.mjs`
- 推送结果到当前会话（自动路由到你的元宝/Telegram）
```

### 方案 B：系统 Cron（Linux/macOS）

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每4小时运行一次）：
0 */4 * * * /usr/bin/node /path/to/scripts/coin-screener.mjs >> /var/log/crypto-screener.log 2>&1
```

### 方案 C：PM2 进程管理（适合长期运行）

```bash
# 安装 PM2
npm install -g pm2

# 创建启动脚本
cat > /path/to/run-screener.sh << 'EOF'
#!/bin/bash
node /path/to/scripts/coin-screener.mjs
EOF
chmod +x /path/to/run-screener.sh

# 启动
pm2 start /path/to/run-screener.sh --name crypto-screener

# 设置每4小时重启
pm2 schedule crypto-screener "0 */4 * * *"
```

---

## 6. 接入通知渠道

### OpenClaw 内置推送（推荐）

系统会在 OpenClaw 会话中自动推送结果，无需额外配置。

### Telegram Bot

```javascript
// 在你的脚本最后添加：
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot('YOUR_BOT_TOKEN', { polling: true });

// 发送消息
bot.sendMessage('YOUR_CHAT_ID', reportText, { parse_mode: 'Markdown' });
```

### 飞书 Webhook

```bash
# 直接用 curl 发送
curl -X POST 'YOUR_FEISHU_WEBHOOK_URL' \
  -H 'Content-Type: application/json' \
  -d '{"msg_type": "text", "content": {"text": "'"$reportText"'"}}'
```

---

## 7. 个性化配置

### 修改关注的核心币种

编辑 `scripts/prices.mjs` 或 `scripts/crypto-daily-report.mjs`：

```javascript
// 在 getPrices() 函数中，找到 symbol 参数：
const data = await fetchJSON(`${API1}/market/mini/24hr?symbol=BTCUSDT,ETHUSLT,SOLUSDT,BNBUSDT`);
//                                                    ↑ 加你想加的币
```

### 修改推送频率

| 频率 | Cron 表达式 | 说明 |
|------|-----------|------|
| 每 2 小时 | `0 */2 * * *` | 高频监测 |
| 每 4 小时 | `0 */4 * * *` | **推荐**，平衡及时性与成本 |
| 每 6 小时 | `0 */6 * * *` | 低频监测 |
| 每天 2 次 | `0 8,20 * * *` | 仅重要时段 |

### 修改评分权重

编辑 `scripts/coin-screener.mjs` 中的 `scoreCoin()` 函数：

```javascript
// 想更看重资金费率？调高它的分数：
if (d.funding < -1.0) {
  longScore += 40;  // 原先是 30 → 调高到 40
  longSigs.push(`资金费率极负(${d.funding}%)→空头挤压`);
}

// 想降低 RSI 权重？
// 找 RSI 相关评分行，把 +30/+20/+15 调低
```

---

## 8. 常见问题

### Q1：报错 `Error: Failed to launch browser`

**原因：** Playwright 或 Chromium 未正确安装。

**解决：**
```bash
# 重新安装 Playwright
npm install playwright-chromium
npx playwright install chromium --with-deps
```

### Q2：Coinglass 页面加载不出来

**原因：** Coinglass 是 SPA（单页应用），表格渲染需要时间。

**解决：** 脚本中已内置等待逻辑（`.ant-table-cell` 数量 ≥ 50 后继续）。如果持续超时，可以：
1. 检查网络连通性
2. 加大 `waitTable` 的 `maxMs` 参数

### Q3：Desk3 API 返回 403 或 429

**原因：** 请求频率过高或 API Key 问题。

**解决：**
1. 降低请求频率
2. 检查是否需要 API Key
3. 等待 60 秒后重试

### Q4：脚本运行很慢（>30秒）

**原因：** 浏览器脚本每次都要启动 Chromium，网络慢时更明显。

**解决：**
1. 使用 `crypto-daily-report.mjs`（纯 API，约 2-5 秒）
2. 浏览器脚本设置 `--headless` 已启用，减少资源占用

### Q5：没有看到做多/做空信号

**原因：** 当前市场没有满足评分阈值（≥ 20 分 + 至少 1 个信号）的币种。

**解决：** 这是正常现象，说明市场没有明确的共振信号。建议：
1. 观望等待
2. 降低评分阈值（在 `coin-screener.mjs` 中调整）
3. 单独查看 `crypto-monitor.mjs` 的完整播报

---

## ✅ 下一步

布设完成后，建议按这个顺序探索：

1. **首次运行** → `crypto-daily-report.mjs` 看看全貌
2. **品种筛选** → `coin-screener.mjs` 找交易机会
3. **接入定时任务** → 每 4 小时自动跑
4. **个性化调整** → 按你的偏好改评分权重和关注币种

有问题？查看 [ARCHITECTURE.md](ARCHITECTURE.md) 或翻阅脚本内的注释。

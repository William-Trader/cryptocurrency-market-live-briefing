# 🕵️ Crypto Research System

> 基于 OpenClaw + Desk3 API + Coinglass 的加密货币实时监测与品种优选系统。每 4 小时自动推送，覆盖 BTC/ETH/SOL 核心行情、市场情绪、30+ 技术指标，以及基于 7 维评分的山寨币做多/做空信号。

**适用人群：** 加密货币研究员、量化交易者、被动投资者  
**技术栈：** Node.js + Playwright + Desk3 API + Coinglass Web Scraping  
**运行方式：** OpenClaw Skill（个人部署）/ Cron 定时触发

---

## 📁 项目结构

```
cryptocurrency-market-live-briefing/
├── SKILL.md                          # OpenClaw Skill 入口
├── _meta.json                        # 版本元信息
├── docs/                             # 👈 GitHub 发布文档（你在这里）
│   ├── README.md                     # 主说明文档
│   ├── SETUP.md                      # 布设指南
│   ├── ARCHITECTURE.md               # 系统架构详解
│   ├── SCRIPTS.md                    # 所有脚本用法速查
│   └── INDICATORS.md                 # 指标说明 & 解读指南
└── scripts/                          # 核心脚本
    ├── crypto-daily-report.mjs        # 🏆 每日深度日报（聚合所有数据，AI 报告首选）
    ├── crypto-monitor.mjs             # 综合播报（价格 + 情绪 + Coinglass 数据）
    ├── coin-screener.mjs              # 🎯 品种优选 V2（多指标评分，推荐主力脚本）
    ├── briefing.mjs                   # 🚨 快速行情播报（纯 API，约 3 秒）
    ├── prices.mjs                     # 💰 核心价格
    ├── fear-greed.mjs                 # 😱 恐惧贪婪指数
    ├── altcoin-season.mjs             # 🪙 山寨季指数
    ├── puell.mjs                      # ⛏️ Puell 倍数
    ├── pi-cycle.mjs                   # 🔄 Pi Cycle 顶部指标
    ├── dominance.mjs                  # 📊 BTC 主导地位
    ├── btc-trend.mjs                  # 📈 BTC 网络趋势（算力/难度）
    ├── eth-trend.mjs                  # 📈 ETH 网络趋势（算力/难度）
    ├── cycle-indicators.mjs            # ⛓️ 30+ 周期指标详解
    ├── cycles.mjs                      # 🔬 综合周期分析
    ├── trending.mjs                    # 🔥 热门币 TOP10
    ├── news.mjs                        # 📰 新闻（加密行业 / 宏观政策）
    ├── calendar.mjs                    # 📅 市场日历
    └── exchange-rate.mjs               # 💱 宏观汇率
```

---

## ⚡ 快速开始

### 前置要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| **Node.js** | ≥ 18 | 运行所有脚本 |
| **npm** | 最新 | 安装依赖 |
| **Playwright** | 最新 | 浏览器自动化（用于 Coinglass 爬取） |
| **Chrome/Chromium** | 系统已装 | `/usr/bin/google-chrome-stable` |

### 一键安装

```bash
# 1. 安装 Playwright（如果还没有）
npm install playwright-chromium
npx playwright install chromium

# 2. 克隆或复制整个 skill 目录到你的 OpenClaw workspace/skills/
# 3. 直接运行（纯 API 脚本，无需浏览器）
node scripts/crypto-daily-report.mjs
```

### 运行你的第一条日报

```bash
# 🏆 推荐：生成完整日报（一次性拉取所有数据，约 2-5 秒）
node scripts/crypto-daily-report.mjs

# 🚨 快速行情（约 3 秒）
node scripts/briefing.mjs

# 🎯 品种优选（约 20 秒，含浏览器）
node scripts/coin-screener.mjs
```

---

## 🔄 定时任务设置（推荐）

将以下 cron 表达式加入 OpenClaw 配置，实现每 4 小时自动推送：

```
0 */4 * * *  node /path/to/scripts/coin-screener.mjs
```

或者在 OpenClaw 中配置 Heartbeat 自动触发。

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────┐
│                    数据源层                          │
│                                                      │
│  ┌──────────────┐     ┌──────────────────────────┐  │
│  │  Desk3 API   │     │      Coinglass           │  │
│  │  (REST API)  │     │   (浏览器自动化爬取)      │  │
│  └──────┬───────┘     └──────────┬───────────────┘  │
│         │                        │                   │
│  价格/情绪/周期指标        RSI热力图/资金费率/      │
│  新闻/日历/汇率            多空比/爆仓/OI           │
└─────────┼──────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│                   分析层                              │
│                                                      │
│  7维评分引擎                                          │
│  ┌─────────────────────────────────────────────┐   │
│  │ ① RSI   ② 资金费率  ③ 24h涨幅  ④ OI变化  │   │
│  │ ⑤ 多空比 ⑥ 爆仓热力图  ⑦ 宏观适配        │   │
│  └─────────────────────────────────────────────┘   │
│  互斥逻辑：同一币种只出现在做多 OR 做空              │
│  Price-OI 分歧：价格涨+OI降=假突破⚠️               │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                   输出层                             │
│                                                      │
│  📝 每日深度日报 → AI 报告生成                       │
│  🚨 快速行情播报 → 群推送 / 个人通知                 │
│  🎯 品种优选报告 → 做多/做空信号 + 止损止盈          │
│  📊 技术仪表盘 → Puell/Pi Cycle/Dominance 等        │
└─────────────────────────────────────────────────────┘
```

详见 [ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## 📊 核心功能说明

### 🏆 crypto-daily-report.mjs — 每日日报（首选）

一次性并行拉取 **13 类数据**，耗时约 2-5 秒，专为 AI 报告生成设计：

| 数据类别 | 内容 |
|---------|------|
| 核心行情 | BTC / ETH / SOL 实时价格 + 24h 涨跌 |
| 情绪指标 | 恐惧贪婪指数 + 山寨季指数 |
| 技术仪表盘 | Puell 倍数 + Pi Cycle + BTC 主导率 + BTC/ETH 网络趋势 |
| 周期综合 | 持有信号 vs 卖出信号比率 |
| 热门币 | 24h 成交额 TOP10 |
| 新闻 | 加密行业新闻 + 宏观政策新闻 |
| 市场日历 | 本周重要数据发布日程 |
| 宏观汇率 | 美元指数 / EUR-USD 等 |

### 🎯 coin-screener.mjs — 品种优选 V2（主力脚本）

7 维度多指标共振评分系统，对标专业级 Crypto Screener：

| 评分维度 | 指标 | 权重 |
|---------|------|------|
| RSI | 超卖/超买分级 | 高 |
| 资金费率 | 多空挤压程度（**最核心**）| 最高 |
| 24h 涨幅 | 暴涨暴跌识别 | 中 |
| OI 变化 | 资金真实流向判断 | 高 |
| 多空比 | 大户 vs 散户分歧 | 中 |
| 爆仓热力图 | 多空博弈激烈价位 | 中 |
| 宏观适配 | F&G + Alt Season 共振 | 低 |

**输出格式：**
```
🎯 做多推荐
  📈 BTC/USDT  ⭐⭐⭐  🔴 高风险  [强信号]
     价格: $64,500  |  RSI: 28.5  |  24h: -8.2%
     资金费率: -1.66% → 空头挤压
     做多信号: RSI极端超卖(28.5) + 资金费率极负(-1.66%)→空头挤压
     综合评分: 65分
```

### 📊 crypto-monitor.mjs — 综合播报（含浏览器数据）

完整版播报，包含 Coinglass 的 RSI 热力图、资金费率、多空比、爆仓热力图，适合需要链上数据的深度分析。

---

## 📖 文档目录

| 文档 | 内容 |
|------|------|
| **[SETUP.md](docs/SETUP.md)** | 🔧 从零布设完整系统（适合新手） |
| **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** | 🏗️ 系统架构、模块设计、数据流详解 |
| **[SCRIPTS.md](docs/SCRIPTS.md)** | 📋 所有脚本用法速查表 |
| **[INDICATORS.md](docs/INDICATORS.md)** | 📈 指标说明 & 实战解读指南 |

---

## 🔧 环境变量（可选）

如需自定义，可设置以下环境变量：

```bash
export DESK3_API_KEY=your_api_key    # Desk3 API Key（如需要）
export CHROME_PATH=/usr/bin/google-chrome-stable
export LANGUAGE=zh                   # 输出语言：zh / en
```

---

## ⚠️ 免责声明

本系统数据仅供参考，不构成投资建议。加密货币市场风险极高，请务必做好止损，保护好本金。

---

## 🙏 致谢

- **Desk3** — 提供高质量加密市场 API（[desk3.io](https://www.desk3.io)）
- **CoinGlass** — 提供 RSI 热力图、资金费率、爆仓数据等链上数据
- **OpenClaw** — 提供 Agent 平台支持（[openclaw.ai](https://www.openclaw.ai)）

---

## English

**Crypto Research System** — a real-time cryptocurrency monitoring and coin-selection toolkit. It scrapes and aggregates market data (Desk3 API + CoinGlass web scraping via Playwright), then produces periodic briefings: core BTC/ETH/SOL quotes, market sentiment (Fear & Greed, Altcoin Season), 30+ cycle indicators (Puell, Pi Cycle, dominance, hashrate/difficulty), news and calendar, plus a **7-dimension scoring screener** (RSI, funding rate, 24h change, open interest, long/short ratio, liquidation heatmap, macro fit) that outputs long/short signals.

**Stack:** Node.js + Playwright + Desk3 API + CoinGlass scraping. Runs as an OpenClaw skill or via cron (e.g. every 4h).

> Research only. Not investment advice.

## License

**PolyForm Noncommercial License 1.0.0** —— 仅限**非商业用途**（个人学习、研究、教育、爱好项目、非营利/政府用途）。**未经作者单独授权，禁止任何商业化、盈利性使用或转售**。详见 [LICENSE](LICENSE)。

Required Notice: Copyright (c) 2026 William-Trader (https://github.com/William-Trader)

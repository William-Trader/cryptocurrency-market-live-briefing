---
name: desk3-crypto-briefing
description: Desk3 Crypto Market Real-time Briefing - Provides BTC/ETH/SOL core prices, Fear & Greed Index, Puell/Pi Cycle/Bitcoin Dominance technical indicators, geopolitical and blockchain industry news, and trending coins real-time prices. Based on Desk3 API, direct API calls without MCP installation. Credit: Desk3
homepage: https://www.desk3.io
readme: README.md
metadata: {"openclaw":{"emoji":"📊","requires":{"bins":["node"]},"primaryEnv":""}}
---

# Desk3 Crypto Briefing

> 📖 **完整文档请查看 [docs/](docs/) 目录：**
> - [布设指南 docs/SETUP.md](docs/SETUP.md) — 从零搭建系统（新手友好）
> - [架构详解 docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 模块设计、数据流、技术选型
> - [脚本速查 docs/SCRIPTS.md](docs/SCRIPTS.md) — 所有脚本用法
> - [指标解读 docs/INDICATORS.md](docs/INDICATORS.md) — 指标含义 & 实战指南

Real-time cryptocurrency market briefing tool based on Desk3 API. API sources: `mcp.desk3.io` and `api1.desk3.io`

> **首次使用前**：确保 `node` 已安装。浏览器相关脚本需要 Playwright + Chrome（`/usr/bin/google-chrome-stable`）支持。

## Quick Start（按场景选）

| 场景 | 脚本 | 用途 | 耗时 |
|------|------|------|------|
| 📝 **生成日报**（推荐） | `crypto-daily-report.mjs` | 聚合所有数据，一次拉取完毕 | ~2s |
| 🚨 **快速行情播报** | `briefing.mjs` | 纯API：价格+情绪+热门币+新闻 | ~3s |
| 🔍 **精选交易币种** | `coin-screener.mjs` | 浏览器版：多指标共振评分+做多/做空信号 | ~20s |
| 📊 **全面综合播报** | `crypto-monitor.mjs` | 浏览器版：价格+情绪+Coinglass链上数据 | ~30s |

---

## 纯 API 脚本（快速，无需浏览器）

```bash
# 📝 每日深度日报 - 聚合所有数据，适合AI报告生成（首选）
node {baseDir}/scripts/crypto-daily-report.mjs

# 🚨 快速播报 - 价格+情绪+热门币+新闻
node {baseDir}/scripts/briefing.mjs

# 📊 核心价格 - BTC/ETH/SOL 实时价格+24h涨跌
node {baseDir}/scripts/prices.mjs

# 😱 恐惧贪婪指数
node {baseDir}/scripts/fear-greed.mjs

# 🪙 山寨季指数
node {baseDir}/scripts/altcoin-season.mjs

# 🔍 精选币种 - 多指标共振评分（做多/做空推荐+信号说明）
node {baseDir}/scripts/coin-screener.mjs

# ⛏️ Puell倍数 - 矿工收入模型，衡量估值高低
node {baseDir}/scripts/puell.mjs

# 🔄 Pi Cycle顶部 - 111日MA与2倍350日MA交叉预测周期顶部
node {baseDir}/scripts/pi-cycle.mjs

# 📈 BTC主导地位 - BTC/ETH/others市值占比
node {baseDir}/scripts/dominance.mjs

# 🎯 综合周期分析 - Puell + Pi Cycle + 周期概率（三合一）
node {baseDir}/scripts/cycles.mjs

# 📊 详细周期指标（30+指标）
node {baseDir}/scripts/cycle-indicators.mjs

# 📈 BTC趋势（算力/难度）
node {baseDir}/scripts/btc-trend.mjs

# 📈 ETH趋势（算力/难度）
node {baseDir}/scripts/eth-trend.mjs

# 🔥 热门币 - 成交额排名前10
node {baseDir}/scripts/trending.mjs

# 📰 区块链行业新闻（catid=1）
node {baseDir}/scripts/news.mjs crypto

# 📰 宏观政策新闻（catid=3）
node {baseDir}/scripts/news.mjs policy

# 💱 汇率信息
node {baseDir}/scripts/exchange-rate.mjs

# 📅 市场日历（重要数据发布）
node {baseDir}/scripts/calendar.mjs
```

---

## 浏览器脚本（需要Chrome）

```bash
# 综合播报：价格 + 情绪 + Coinglass资金费率/RSI热力图/山寨季
node {baseDir}/scripts/crypto-monitor.mjs
```

> ⚠️ 浏览器脚本需要 Playwright + Chrome（`/usr/bin/google-chrome-stable`）支持，首次运行约需15-40秒。

---

## API Documentation

- `https://api1.desk3.io/v1/` - Main market data
- `https://mcp.desk3.io/v1/` - MCP service API
- All endpoints use direct HTTP calls, no MCP server installation needed.
- 中文输出：加 `language: zh` header；英文：`language: en`（默认）

| Feature | Endpoint |
|---------|----------|
| Price Ticker | `/v1/market/mini/24hr` |
| Fear & Greed | `/v1/market/fear-greed` |
| Puell Multiple | `/v1/market/puell-multiple` |
| Pi Cycle Top | `/v1/market/pi-cycle-top` |
| Dominance | `/v1/market/bitcoin/dominance` |
| Cycle Composite | `/v1/market/cycles` |
| Cycle Indicators Detail | `/v1/market/cycleIndicators` |
| Altcoin Season | `/v1/market/altcoin/season` |
| BTC Trend | `/v1/market/btc/trend` |
| ETH Trend | `/v1/market/eth/trend` |
| Exchange Rate | `/v1/market/exchangeRate` |
| Calendar | `/v1/market/calendar` |
| News | `/v1/news/list` |

---

> **📝 日报生成提示**：先用 `crypto-daily-report.mjs` 一次性拉取全部结构化数据，再交由 AI 汇总生成日报，避免多次调用消耗过多 token。  
> **Credit**: Desk3 | **文档**: [docs/](docs/) | **问题**: 查看 [docs/SETUP.md](docs/SETUP.md) 常见问题

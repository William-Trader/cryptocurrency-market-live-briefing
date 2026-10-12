# 📋 脚本用法速查表

> 所有脚本的快速参考。`{baseDir}` = skill 目录路径，例如 `/root/.openclaw/workspace/skills/cryptocurrency-market-live-briefing`

---

## 🚀 快速选型

| 你想做什么 | 推荐脚本 | 耗时 | 是否需要浏览器 |
|-----------|---------|------|--------------|
| 生成完整日报给 AI | **`crypto-daily-report.mjs`** | ~2-5s | ❌ |
| 找具体交易机会 | **`coin-screener.mjs`** | ~15-25s | ✅ Playwright |
| 快速了解市场 | `briefing.mjs` | ~3s | ❌ |
| 手动查一个价格 | `prices.mjs` | ~200ms | ❌ |
| 凌晨/无打扰时段 | `crypto-daily-report.mjs` | ~2-5s | ❌ |
| 深度技术分析 | `crypto-monitor.mjs` | ~20-30s | ✅ Playwright |

---

## 🏆 完整脚本列表

### 1. crypto-daily-report.mjs
**每日深度日报（聚合所有数据，AI 报告首选）**

```bash
node {baseDir}/scripts/crypto-daily-report.mjs
```

**输出内容：**
- 核心行情：BTC / ETH / SOL 价格 + 24h 涨跌
- 情绪指标：恐惧贪婪指数 + 山寨季指数
- 技术仪表盘：Puell 倍数 + Pi Cycle + BTC 主导率 + BTC/ETH 网络趋势
- 周期综合分析：持有信号 vs 卖出信号比率
- 热门币 TOP10
- 加密行业新闻（8条）+ 宏观政策新闻（8条）
- 市场日历（本周重要数据）
- 宏观汇率

**适用场景：** 每日生成报告、发送给 AI 汇总、批量数据获取

---

### 2. coin-screener.mjs
**品种优选 V2（多指标共振评分，主力脚本）**

```bash
node {baseDir}/scripts/coin-screener.mjs
```

**输出内容：**
- 宏观背景：恐惧贪婪 + 山寨季
- 市场结构：多空比 + 爆仓情况
- 做多推荐（TOP3）：币种、评分、星标、风险等级、信号说明
- 做空推荐（TOP3）：同上

**评分维度：** RSI + 资金费率 + 24h 涨幅 + OI 变化 + 多空比 + 爆仓热力图 + 宏观适配

**适用场景：** 每 4 小时自动推送、找具体交易机会、品种筛选

---

### 3. crypto-monitor.mjs
**综合播报（浏览器版，含 Coinglass 完整数据）**

```bash
node {baseDir}/scripts/crypto-monitor.mjs
```

**输出内容：** 价格 + 情绪 + Coinglass RSI 热力图 + 资金费率 + 多空比 + 爆仓热力图

**适用场景：** 深度分析、完整视图（比 coin-screener 更详细但更慢）

---

### 4. briefing.mjs
**快速行情播报（纯 API，约 3 秒）**

```bash
node {baseDir}/scripts/briefing.mjs
```

**输出内容：**
- BTC / ETH / SOL 价格 + 24h 涨跌
- 恐惧贪婪指数
- Puell 倍数
- BTC 主导率
- 区块链行业新闻 TOP10
- 热门币 TOP10

**适用场景：** 快速了解市场概况、无需深度分析

---

## 📊 独立指标脚本（可单独使用）

### 价格 & 情绪

```bash
# 核心价格（BTC/ETH/SOL，约 200ms）
node {baseDir}/scripts/prices.mjs

# 恐惧贪婪指数
node {baseDir}/scripts/fear-greed.mjs

# 山寨季指数
node {baseDir}/scripts/altcoin-season.mjs
```

### 技术指标

```bash
# Puell 倍数（矿工收入模型）
node {baseDir}/scripts/puell.mjs

# Pi Cycle 顶部指标（111DMA vs 2×350DMA）
node {baseDir}/scripts/pi-cycle.mjs

# BTC 主导地位（BTC/ETH/Others 占比）
node {baseDir}/scripts/dominance.mjs

# 综合周期分析（Puell + Pi Cycle + 概率）
node {baseDir}/scripts/cycles.mjs

# 详细周期指标（30+ 指标）
node {baseDir}/scripts/cycle-indicators.mjs

# BTC 网络趋势（算力 + 难度）
node {baseDir}/scripts/btc-trend.mjs

# ETH 网络趋势（算力 + 难度）
node {baseDir}/scripts/eth-trend.mjs
```

### 市场 & 新闻

```bash
# 热门币 TOP10（按成交额）
node {baseDir}/scripts/trending.mjs

# 加密行业新闻
node {baseDir}/scripts/news.mjs crypto

# 宏观政策新闻
node {baseDir}/scripts/news.mjs policy

# 市场日历（重要数据发布）
node {baseDir}/scripts/calendar.mjs

# 宏观汇率
node {baseDir}/scripts/exchange-rate.mjs
```

---

## 🔧 常用运行组合

### 组合 1：每日早报（推荐）
```bash
node {baseDir}/scripts/crypto-daily-report.mjs
```
→ 一次性获取所有数据，交给 AI 生成日报

### 组合 2：盘中监测（每 4 小时）
```bash
node {baseDir}/scripts/coin-screener.mjs
```
→ 找具体交易机会

### 组合 3：深夜速查（不打扰）
```bash
node {baseDir}/scripts/prices.mjs && node {baseDir}/scripts/fear-greed.mjs
```
→ 30 秒了解概况

### 组合 4：深度研究
```bash
node {baseDir}/scripts/crypto-daily-report.mjs    # 先拿全量数据
node {baseDir}/scripts/coin-screener.mjs           # 再找具体机会
```

---

## ⚡ Cron 定时任务模板

```bash
# 每天 8:00 / 12:00 / 16:00 / 20:00 自动生成日报
0 8,12,16,20 * * * /usr/bin/node {baseDir}/scripts/crypto-daily-report.mjs >> /var/log/crypto-report.log 2>&1

# 每 4 小时自动品种优选（推荐）
0 */4 * * * /usr/bin/node {baseDir}/scripts/coin-screener.mjs >> /var/log/crypto-screener.log 2>&1
```

---

## 🐛 调试技巧

```bash
# 查看完整错误信息
node {baseDir}/scripts/coin-screener.mjs 2>&1

# 只看前 20 行输出（测试用）
node {baseDir}/scripts/crypto-daily-report.mjs | head -20

# 输出到文件
node {baseDir}/scripts/crypto-daily-report.mjs > ~/crypto-report-$(date +%Y%m%d).txt

# 安静模式（不打印到控制台）
node {baseDir}/scripts/prices.mjs > /dev/null 2>&1 && echo "OK"
```

# 更新日志

本项目的所有重要变更记录于此。
格式参考 Keep a Changelog，版本遵循语义化版本。

[English](CHANGELOG.md) | **简体中文**

---

## [2.0.0] - 2026-10-22

本次发布吸收外部的 **crypto-intelligence v6.0.0** 包，并重建为一条纯英文、零依赖的简报流水线。

### 新增

- **唯一简报结构**（crypto.briefing/2）：包含 id、generatedAt、asOf 时间戳、逐源状态、错误、结论与免责声明。
- **结论引擎**：把情绪、恐惧贪婪与市场状态映射为风险立场（防御 / 谨慎 / 积极 / 中性），并给出一句理由。
- **多平台投递**：Telegram、Discord、Slack、飞书/Lark、企业微信、QQ（OneBot v11），以及通用 HMAC 签名 Webhook。
- **渲染器**：Markdown、纯文本、Telegram HTML、Discord embed、Slack Block Kit、飞书互动卡片。
- **统一命令行**：news、market、brief、publish、doctor、config。
- **市场背景**：现货报价、恐惧贪婪、BTC 占比、Puell 倍数、周期指标、市场状态、BTC 相关性。
- **技术指标**：SMA、EMA、RSI、MACD、布林带、ATR；数据不足时明确返回不可用。
- **新闻引擎**：12 类分类、情绪打分、影响力打分、币种识别、语言识别、去重、关键词追踪、带冷却的预警规则。
- **离线测试套件**（26 项）：覆盖分类、情绪、指标、渲染、投递选择与凭据缺失失败路径。
- **doctor 自检**与**语法检查脚本**。
- **文档集**：README、SETUP、ARCHITECTURE、PLATFORM-INTEGRATION、HANDOVER、SCRIPTS、CHANGELOG，均提供中英双语入口。
- **NOTICE**：记录合并的 MIT 上游组件。

### 变更

- 源码重组为 core / data / news / market / render / delivery。
- HTTP 层基于平台 fetch 重写：超时、有限重试、Retry-After、token 脱敏。
- 配置拆分为数据源（入库）与投递目标（gitignore，环境变量引用）。
- 恐惧贪婪解析同时兼容 Desk3 嵌套结构与 Alternative.me 结构。
- 许可证元数据修正为 PolyForm Noncommercial 1.0.0，与 LICENSE 一致。

### 移除

- 上游包中的**模拟链上与宏观数据**。缺失数据现在标记为不可用，而不是编造。
- **硬编码的 CryptoPanic token**，改为 CRYPTOPANIC_TOKEN。
- **模拟新闻生成器**，以及自动回退到假标题的行为。
- **三套重叠的监控模块**（crypto-monitor v3、v4、enhanced），合并为市场监控 + 指标引擎。
- **强制 ws 依赖**；流式能力改为可选。
- 上游入口的**交互式 stdin REPL**；调度与投递交给命令行与宿主调度器。
- v1 的旧 mjs 脚本与中文文档（已归档到资产库，git 历史仍可追溯）。

### 修复

- 去重不再丢失同一新闻中影响力更高的版本。
- 预警冷却按「规则 + 文章」计键，避免重复刷屏。
- K 线不足时返回 available:false，而不是零值指标。
- Telegram 消息在 4096 字符上限内自动分片。
- Slack Webhook 返回非 ok 时明确失败。
- 飞书签名按官方双重 HMAC 构造计算。

### 安全

- 密钥在发送时通过 env:NAME 解析；platforms.json 已 gitignore。
- HTTP 错误信息中的查询串 token 自动打码。
- 可选 AES-256-GCM 密钥库，scrypt 派生密钥，文件模式 0600。
- 支持 Webhook 载荷签名（对 timestamp.body 做 HMAC-SHA256）。

### 从 1.0.2 迁移

| v1 | v2 |
|----|----|
| scripts/*.mjs | bin/crypto-intel.js + npm scripts |
| 仅终端输出 | 渲染器 + 投递适配器 |
| 中文文档 | 中英双语文档 |
| 仅 Desk3 | Desk3 + Binance + 可选 CryptoPanic |
| 无测试 | 26 项离线测试 |
| 无结构定义 | crypto.briefing/2 |

v1 文件归档在资产库 **05-归档-archive**，目录名 **2026-10-22-cryptocurrency-market-live-briefing-v1**。

---

## 上游历史（crypto-intelligence 包）

以下版本由外部提供的包发布，在此保留以便追溯，不是本仓库的独立发布。

- **6.0.0** — 情绪指数、趋势、多语言识别、导出、REPL。
- **5.1.0** — 新闻情报系统、CryptoPanic、12 分类、预警。
- **4.0.0** — WebSocket 行情流、多周期技术分析、市场状态、信号。
- **3.0.0** — 价格监控、恐惧贪婪、Puell、占比、Mayer、彩虹图。
- **2.0.0** — 增强监控、模拟链上与宏观数据。
- **1.0.0** — 初版单源价格监控。

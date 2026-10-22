# 加密市场实时简报

面向群聊平台的加密市场情报系统：新闻聚合、情绪打分、技术面背景、风险预警，并把**同一份简报**原生渲染到 Telegram、Discord、Slack、飞书/Lark、企业微信、QQ（OneBot v11）或任意 HTTP Webhook。

**版本 2.0.0** · Node.js >= 18 · PolyForm Noncommercial 1.0.0

[English](README.md) | **简体中文**

---

## 为什么做这个项目

大多数「加密提醒机器人」是一堆只会往终端打印的脚本，再给每个聊天软件单独糊一层发送代码。本项目把两件事拆开：

1. **采集**行情与新闻，生成一个结构化的简报对象。
2. **渲染**这份对象，按平台输出 HTML、embed、Block Kit、互动卡片或纯文本。
3. **投递**通过小型适配器完成，带重试与密钥处理。

结果是一条流水线，可以指向任意群聊，不需要重复写格式化逻辑，也不被某个平台绑定。

---

## 功能

- **新闻情报** — Desk3 News 与可选 CryptoPanic，统一清洗、去重，分为 12 类，输出情绪分（-1..+1）与影响力（1..10）。
- **市场情绪指数** — 0-100 综合分，带趋势、币种情绪与关键词追踪。
- **市场背景** — 现货报价、恐惧贪婪、BTC 占比、Puell 倍数、周期指标、RSI/MACD/布林带/ATR、市场状态识别、BTC 相关性。
- **预警** — 突发、监管、安全事件、鲸鱼动向、高影响力标题，按规则冷却，避免刷屏。
- **唯一简报结构** — 确定性 JSON，所有渲染器共用。
- **多平台投递** — Telegram、Discord、Slack、飞书/Lark、企业微信、QQ（OneBot v11）、通用 HMAC 签名 Webhook。
- **运维优先** — doctor 自检、结构化日志、dry-run、重试、限流感知 HTTP、绝不编造数据。
- **零运行时依赖** — 仅用 Node 内建模块；WebSocket 流为可选，安装 ws 才启用。

---

## 快速开始

~~~bash
git clone <your-repo> cryptocurrency-market-live-briefing
cd cryptocurrency-market-live-briefing

node bin/crypto-intel.js doctor
node bin/crypto-intel.js news --limit 10
node bin/crypto-intel.js market
node bin/crypto-intel.js brief --format markdown
~~~

核心功能无需安装依赖。若要用 npm 脚本和可选的流式能力：

~~~bash
npm install
npm test
~~~

### 推送到聊天平台

~~~bash
cp config/platforms.example.json config/platforms.json
# 编辑 config/platforms.json，或导出它引用的环境变量
node bin/crypto-intel.js publish --platform telegram --dry-run
node bin/crypto-intel.js publish --platform telegram
~~~

---

## 命令行

| 命令 | 用途 |
|------|------|
| **news** | 聚合、打分后的新闻与预警 |
| **market** | 现货报价、周期指标、市场状态 |
| **brief** | 生成完整简报，支持 markdown / plain / JSON / 各平台格式 |
| **publish** | 生成简报并投递到已配置平台 |
| **doctor** | 检查 Node、数据端点与投递配置 |
| **config** | 打印生效配置，密钥打码 |

常用参数：**--json**、**--limit N**、**--news N**、**--coins BTC,ETH**、**--format**、**--out FILE**、**--platform NAME**、**--dry-run**、**--news-only**、**--market-only**。

完整说明见 [docs/SCRIPTS.md](docs/SCRIPTS.md)。

---

## 输出示例

~~~text
# Crypto Market Briefing

**Wait and see** — No edge from trend or sentiment; favor range tactics and small size.

| Coin | Price | 24h | Trend | RSI | Bias |
|------|-------|-----|-------|-----|------|
| BTC | 82,816.51 | +0.17% | ▲ | 36.84 | bearish |
| ETH | 2,438.54 | -0.02% | ▼ | 37.90 | bearish |

Fear & Greed **53** (Neutral) · BTC dominance **60.1%** · Regime **range**

## News sentiment

Index **56/100** (neutral) · trend flat · 5 positive / 3 negative / 2 neutral
~~~

同一次运行可以输出 Telegram HTML、Discord embed、Slack Block Kit 或飞书互动卡片，无需重新取数。

---

## 平台支持

| 平台 | 适配器 | 载荷 | 认证 |
|------|--------|------|------|
| Telegram | **telegram** | HTML 消息，超过 3800 字符自动分片 | Bot token + chat id |
| Discord | **discord** | 富文本 embed | Webhook URL |
| Slack | **slack** | Block Kit | Incoming Webhook |
| 飞书 / Lark | **feishu** | 互动卡片 | Webhook URL（可选签名密钥） |
| 企业微信 | **wecom** | Markdown 消息 | 群机器人 Webhook |
| QQ | **qq** | 纯文本，走 OneBot v11 | HTTP 端点 + access token |
| 其他任意平台 | **webhook** | JSON 简报，可选 HMAC-SHA256 | URL（可选密钥） |

各平台配置步骤与载荷细节见 [docs/PLATFORM-INTEGRATION.md](docs/PLATFORM-INTEGRATION.md)。

---

## 目录结构

~~~text
.
├── bin/crypto-intel.js          # CLI 入口
├── src/
│   ├── core/                    # HTTP、日志、配置、加密工具
│   ├── data/                    # Desk3、Binance、CryptoPanic 客户端
│   ├── news/                    # 清洗、分类、情绪、预警
│   ├── market/                  # 指标、状态、相关性、编排
│   ├── render/                  # 一份简报 -> 各平台载荷
│   ├── delivery/                # 传输适配器
│   ├── briefing.js              # 唯一结构 + 结论
│   └── index.js                 # 系统门面
├── config/
│   ├── sources.json             # 数据端点（无密钥）
│   └── platforms.example.json   # 投递目标模板
├── test/                        # node:test 离线测试
└── docs/                        # 部署、架构、交接、更新日志
~~~

---

## 数据来源

| 来源 | 用途 | 是否需要密钥 |
|------|------|--------------|
| Desk3 API | 现货报价、恐惧贪婪、Puell、占比、周期、新闻 | 否 |
| Binance | OHLCV K 线，用于技术指标 | 否 |
| Alternative.me | 恐惧贪婪备用源 | 否 |
| CryptoPanic | 额外新闻覆盖 | 是（可选） |

每份简报都带 **asOf**、逐源状态与免责声明。单个数据源失败只会让对应区块降级，不会编造数值。

> 仅用于研究与风险认知，不构成投资建议。下单前请在交易所复核价格。

---

## 运维

- **调度**：用 cron、systemd、launchd 或 OpenClaw 自动化执行 **publish**。示例单元见 [docs/SETUP.md](docs/SETUP.md)。
- **健康检查**：**node bin/crypto-intel.js doctor**，失败时退出码非 0。
- **日志**：结构化元数据，密钥自动脱敏。
- **演练**：**--dry-run** 完成配置与渲染校验，不发网络请求。
- **重试**：408/425/429/5xx 指数退避，遵守 Retry-After。

---

## 文档

- [docs/SETUP.md](docs/SETUP.md) — 安装、配置、调度
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 模块、数据流、结构定义
- [docs/PLATFORM-INTEGRATION.md](docs/PLATFORM-INTEGRATION.md) — 群聊平台矩阵与适配器契约
- [docs/HANDOVER.md](docs/HANDOVER.md) — 交接基线：验收、运行手册、已知限制
- [docs/SCRIPTS.md](docs/SCRIPTS.md) — 命令行参考
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — 更新日志（English）
- [docs/CHANGELOG.zh-CN.md](docs/CHANGELOG.zh-CN.md) — 更新日志（简体中文）

---

## 许可证

PolyForm Noncommercial License 1.0.0。见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)（v2 合并的 MIT 上游组件说明）。

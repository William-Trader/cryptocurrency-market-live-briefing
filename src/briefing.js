'use strict';

/**
 * Canonical briefing object.
 *
 * Every consumer (CLI, webhook, Telegram, Feishu, QQ) renders this single
 * schema. Keeping one schema is what makes the same run portable across chat
 * platforms and prevents platform-specific drift.
 */

const crypto = require('crypto');

const SCHEMA_VERSION = 'crypto.briefing/2';

function makeId(date) {
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return 'brief_' + stamp + '_' + crypto.randomBytes(3).toString('hex');
}

function verdictFor(market, news) {
  const index = news && news.sentiment ? news.sentiment.index : 50;
  const regime = market && market.regime ? market.regime.regime : 'unknown';
  const fearGreed = market && market.fearGreed ? market.fearGreed.value : null;

  if (index <= 30 || regime === 'bear') {
    return {
      stance: 'defensive',
      label: 'Risk-off',
      reasoning: 'Sentiment or trend is negative; reduce leverage and wait for confirmation.'
    };
  }
  if (index >= 72 || (fearGreed !== null && fearGreed >= 75)) {
    return {
      stance: 'cautious',
      label: 'Overheated',
      reasoning: 'Sentiment is crowded; take profit into strength and tighten stops.'
    };
  }
  if (regime === 'bull' && index >= 55) {
    return {
      stance: 'constructive',
      label: 'Risk-on',
      reasoning: 'Trend and sentiment agree; keep exposure but size positions deliberately.'
    };
  }
  return {
    stance: 'neutral',
    label: 'Wait and see',
    reasoning: 'No edge from trend or sentiment; favor range tactics and small size.'
  };
}

class BriefingBuilder {
  constructor(options) {
    const opts = options || {};
    this.config = opts.config;
    this.marketMonitor = opts.marketMonitor;
    this.newsSystem = opts.newsSystem;
    this.logger = opts.logger;
  }

  async build(options) {
    const opts = options || {};
    const coins = opts.coins || this.config.market.coins;
    const startedAt = Date.now();
    const errors = [];

    let market = null;
    let newsBundle = null;

    const tasks = [];
    if (!opts.newsOnly) {
      tasks.push(this.marketMonitor.getOverview(coins)
        .then((data) => { market = data; })
        .catch((err) => { errors.push({ section: 'market', error: err.message }); }));
    }
    if (!opts.marketOnly) {
      tasks.push(this.newsSystem.collect({ limit: opts.newsLimit })
        .then((data) => { newsBundle = data; })
        .catch((err) => { errors.push({ section: 'news', error: err.message }); }));
    }
    await Promise.all(tasks);

    if (!market && !newsBundle) {
      const error = new Error('No data available: ' + errors.map((e) => e.section + ': ' + e.error).join('; '));
      error.errors = errors;
      throw error;
    }

    const generatedAt = new Date();
    const sources = [];
    if (market) sources.push(...market.sources);
    if (newsBundle) sources.push(...newsBundle.sources);

    const briefing = {
      schema: SCHEMA_VERSION,
      id: makeId(generatedAt),
      generatedAt: generatedAt.toISOString(),
      asOf: {
        market: market ? new Date(market.asOf).toISOString() : null,
        news: newsBundle ? new Date(newsBundle.asOf).toISOString() : null,
        generated: generatedAt.toISOString()
      },
      window: {
        candles: this.config.market.klineInterval,
        newsLimit: opts.newsLimit || this.config.news.limit
      },
      market: market ? {
        quote: market.quote,
        prices: market.prices,
        fearGreed: market.fearGreed,
        puell: market.puell,
        dominance: market.dominance,
        cycles: market.cycles,
        regime: market.regime,
        correlation: market.correlation,
        technicals: mapTechnicals(market.technicals)
      } : null,
      news: newsBundle || null,
      verdict: verdictFor(market, newsBundle),
      alerts: newsBundle ? newsBundle.alerts : [],
      sources,
      errors,
      disclaimer: 'For research and risk awareness only. Not investment advice. Data may be delayed; verify against the exchange before acting.'
    };

    if (this.logger) {
      this.logger.debug('Briefing built', { id: briefing.id, durationMs: Date.now() - startedAt });
    }
    return briefing;
  }
}

function mapTechnicals(technicals) {
  const output = {};
  for (const [symbol, value] of Object.entries(technicals || {})) {
    output[symbol] = {
      bias: value.analyze && value.analyze.bias ? value.analyze.bias : 'unavailable',
      trend: value.analyze && value.analyze.trend ? value.analyze.trend : 'flat',
      rsi14: value.analyze ? value.analyze.rsi14 : null,
      macd: value.analyze ? value.analyze.macd : null,
      bollinger: value.analyze ? value.analyze.bollinger : null,
      atr14: value.analyze ? value.analyze.atr14 : null,
      regime: value.regime,
      candles: value.candles || 0
    };
  }
  return output;
}

module.exports = { BriefingBuilder, SCHEMA_VERSION, verdictFor };

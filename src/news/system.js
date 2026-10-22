'use strict';

const fs = require('fs');
const path = require('path');
const { NewsAggregator, SentimentMonitor, AlertEngine } = require('./engine');

class NewsIntelligenceSystem {
  constructor(options) {
    const opts = options || {};
    this.config = opts.config;
    this.logger = opts.logger;
    this.aggregator = new NewsAggregator({
      desk3: opts.desk3,
      cryptopanic: opts.cryptopanic,
      logger: opts.logger,
      limit: this.config.news.limit,
      cacheTtlMs: this.config.news.cacheTtlMs
    });
    this.sentiment = new SentimentMonitor({ watchCoins: this.config.news.watchCoins });
    this.alerts = new AlertEngine({ cooldownMs: opts.alertCooldownMs || 600000 });
  }

  async collect(options) {
    const opts = options || {};
    const result = await this.aggregator.aggregate(opts.force);
    const items = result.items;
    const sentiment = this.sentiment.compute(items);
    const coinSentiments = this.sentiment.coinSentiments(items);
    const keywords = this.sentiment.topKeywords(items, 12);
    const alerts = this.alerts.evaluate(items);

    return {
      asOf: items.length ? Math.max(...items.map((item) => item.publishedAt)) : Date.now(),
      items,
      sentiment,
      coinSentiments,
      keywords,
      alerts,
      sources: result.sources,
      cached: result.cached
    };
  }

  exportJson(bundle, filePath) {
    const target = path.resolve(filePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify({
      generatedAt: new Date().toISOString(),
      sentiment: bundle.sentiment,
      coinSentiments: bundle.coinSentiments,
      keywords: bundle.keywords,
      alerts: bundle.alerts,
      items: bundle.items.map((item) => item.toJSON())
    }, null, 2));
    return target;
  }

  exportCsv(bundle, filePath) {
    const target = path.resolve(filePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const header = ['publishedAt', 'title', 'source', 'category', 'sentiment', 'impactScore', 'coins', 'url'];
    const rows = [header.join(',')];
    for (const item of bundle.items) {
      const row = [
        new Date(item.publishedAt).toISOString(),
        item.title,
        item.source,
        item.category,
        item.sentiment,
        item.impactScore,
        item.coins.join('|'),
        item.url
      ].map((value) => '"' + String(value).replace(/"/g, '""') + '"');
      rows.push(row.join(','));
    }
    fs.writeFileSync(target, rows.join('\n'));
    return target;
  }
}

module.exports = { NewsIntelligenceSystem };

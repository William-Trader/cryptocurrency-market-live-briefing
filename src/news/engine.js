'use strict';

/**
 * News intelligence engine.
 *
 * Pipeline: fetch -> normalize -> classify -> score -> deduplicate -> aggregate
 * -> alert. The engine is deterministic and side-effect free apart from the
 * injected logger; delivery is handled elsewhere.
 */

const crypto = require('crypto');
const EventEmitter = require('events');

const CATEGORIES = {
  BREAKING: { label: 'Breaking', emoji: '🚨', priority: 10, tone: 'risk' },
  REGULATION: { label: 'Regulation', emoji: '⚖️', priority: 10, tone: 'risk' },
  WHALE: { label: 'Whale', emoji: '🐋', priority: 9, tone: 'watch' },
  LISTING: { label: 'Listing', emoji: '📋', priority: 8, tone: 'positive' },
  PARTNERSHIP: { label: 'Partnership', emoji: '🤝', priority: 7, tone: 'positive' },
  BULLISH: { label: 'Bullish', emoji: '🚀', priority: 8, tone: 'positive' },
  BEARISH: { label: 'Bearish', emoji: '📉', priority: 9, tone: 'risk' },
  FUD: { label: 'FUD', emoji: '😱', priority: 9, tone: 'risk' },
  OFFICIAL: { label: 'Official', emoji: '🏛️', priority: 7, tone: 'neutral' },
  TECHNICAL: { label: 'Technical', emoji: '⚙️', priority: 6, tone: 'neutral' },
  MARKET: { label: 'Market', emoji: '📊', priority: 5, tone: 'neutral' },
  SOCIAL: { label: 'Community', emoji: '💬', priority: 4, tone: 'neutral' }
};

const KEYWORDS = {
  bullish: [
    'announce', 'launch', 'partnership', 'adopt', 'approve', 'upgrade', 'growth',
    'surge', 'rally', 'record', 'breakout', 'bullish', 'positive', 'success',
    'integration', 'expansion', 'funding', 'invest', 'acquisition', 'milestone',
    'airdrop', 'reward', 'all-time high', 'soar', 'jump', 'gain', 'rise',
    'accumulation', 'institutional', 'etf approval', 'spot etf', 'listing'
  ],
  bearish: [
    'crash', 'dump', 'hack', 'scam', 'ban', 'investigate', 'lawsuit', 'warn',
    'fear', 'panic', 'sell', 'downgrade', 'bearish', 'negative', 'loss', 'fail',
    'delay', 'suspend', 'freeze', 'arrest', 'fraud', 'exploit', 'vulnerability',
    'breach', 'liquidate', 'plunge', 'drop', 'fall', 'decline', 'concern',
    'rejection', 'death cross', 'collapse', 'default', 'bankruptcy', 'outflow',
    'redemption', 'theft', 'rug pull'
  ],
  urgent: [
    'breaking', 'urgent', 'alert', 'emergency', 'critical', 'immediate', 'flash',
    'just in', 'developing'
  ],
  whale: [
    'whale', 'institution', 'grayscale', 'blackrock', 'fidelity', 'microstrategy',
    'tesla', 'billionaire', 'fund', 'etf', 'accumulate', 'purchase'
  ],
  coins: {
    BTC: ['bitcoin', 'btc', 'satoshi'],
    ETH: ['ethereum', 'eth', 'ether', 'vitalik'],
    SOL: ['solana', 'sol'],
    BNB: ['binance coin', 'bnb', 'binance'],
    XRP: ['ripple', 'xrp'],
    ADA: ['cardano', 'ada', 'hoskinson'],
    DOGE: ['dogecoin', 'doge'],
    AVAX: ['avalanche', 'avax'],
    LINK: ['chainlink', 'link'],
    DOT: ['polkadot', 'dot'],
    MATIC: ['polygon', 'matic'],
    ARB: ['arbitrum', 'arb'],
    PEPE: ['pepe'],
    SHIB: ['shiba inu', 'shib'],
    TON: ['toncoin', 'ton'],
    LTC: ['litecoin', 'ltc'],
    TRX: ['tron', 'trx']
  }
};

const POSITIVE_HINTS = ['adopt', 'approve', 'partnership', 'launch', 'upgrade', 'surge', 'record', 'gain'];
const NEGATIVE_HINTS = ['ban', 'hack', 'lawsuit', 'crash', 'plunge', 'fraud', 'outflow'];

function normalizeText(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectLanguage(text) {
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
  return 'en';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

class NewsItem {
  constructor(data) {
    const input = data || {};
    this.id = input.id || crypto.randomBytes(6).toString('hex');
    this.title = normalizeText(input.title || 'Untitled');
    this.summary = normalizeText(input.summary || '');
    this.source = input.source || 'Unknown';
    this.url = input.url || '';
    this.publishedAt = this.parseTimestamp(input.publishedAt || input.time || input.created_at || Date.now());
    this.language = input.language && input.language !== 'auto' ? input.language : detectLanguage(this.title);
    this.isBreaking = KEYWORDS.urgent.some((word) => this.title.toLowerCase().includes(word));
    this.sentiment = input.sentiment !== undefined ? Number(input.sentiment) : this.analyzeSentiment();
    this.coins = input.coins || this.extractCoins();
    this.category = input.category || this.detectCategory();
    this.impactScore = input.impactScore !== undefined ? Number(input.impactScore) : this.calculateImpactScore();
    this.keywords = input.keywords || this.extractKeywords();
    this.isImportant = this.impactScore >= 7;
    this.engagement = Number(input.engagement) || 0;
  }

  parseTimestamp(value) {
    if (typeof value === 'number') return value > 1e12 ? value : value * 1000;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  text() {
    return (this.title + ' ' + this.summary).toLowerCase();
  }

  analyzeSentiment() {
    const text = this.text();
    let score = 0;
    let hits = 0;
    for (const word of KEYWORDS.bullish) {
      if (text.includes(word)) { score += 1; hits += 1; }
    }
    for (const word of KEYWORDS.bearish) {
      if (text.includes(word)) { score -= 1; hits += 1; }
    }
    if (hits === 0) return 0;
    return Number((score / Math.max(3, hits)).toFixed(2));
  }

  detectCategory() {
    const text = this.text();
    if (this.isBreaking) return 'BREAKING';
    if (/\b(sec|regulat|cbdc|legal|lawsuit|compliance|policy|govern)\b/.test(text)) return 'REGULATION';
    if (/\b(list|listing|exchange|binance|coinbase|kraken|debut|trading)\b/.test(text)) return 'LISTING';
    if (/\b(partnership|collaborat|strategic)\b/.test(text)) return 'PARTNERSHIP';
    if (/\b(whale|institution|grayscale|blackrock|fidelity|etf|accumulat)\b/.test(text)) return 'WHALE';
    if (/\b(hack|scam|fraud|exploit|breach|vulnerab|theft|rug pull)\b/.test(text)) return 'FUD';
    if (/\b(announce|launch|release|deploy|upgrad)\b/.test(text)) return 'OFFICIAL';
    if (this.sentiment > 0.4) return 'BULLISH';
    if (this.sentiment < -0.4) return 'BEARISH';
    if (/\b(update|develop|progress|roadmap|testnet|mainnet)\b/.test(text)) return 'TECHNICAL';
    return 'MARKET';
  }

  calculateImpactScore() {
    const category = CATEGORIES[this.category] || CATEGORIES.MARKET;
    let score = category.priority;
    if (this.isBreaking) score += 1;
    if (this.coins.length >= 2) score += 1;
    if (Math.abs(this.sentiment) > 0.6) score += 1;
    if (KEYWORDS.whale.some((word) => this.text().includes(word))) score += 1;
    return clamp(score, 1, 10);
  }

  extractCoins() {
    const text = this.text();
    const found = [];
    for (const [coin, words] of Object.entries(KEYWORDS.coins)) {
      if (words.some((word) => text.includes(word))) found.push(coin);
    }
    return found;
  }

  extractKeywords() {
    const counts = new Map();
    for (const word of KEYWORDS.bullish.concat(KEYWORDS.bearish, KEYWORDS.urgent, KEYWORDS.whale)) {
      if (this.text().includes(word)) counts.set(word, (counts.get(word) || 0) + 1);
    }
    return Array.from(counts.keys()).slice(0, 6);
  }

  sentimentLabel() {
    if (this.sentiment >= 0.5) return 'strongly bullish';
    if (this.sentiment >= 0.2) return 'bullish';
    if (this.sentiment <= -0.5) return 'strongly bearish';
    if (this.sentiment <= -0.2) return 'bearish';
    return 'neutral';
  }

  categoryInfo() {
    return CATEGORIES[this.category] || CATEGORIES.MARKET;
  }

  relativeTime(now) {
    const base = now || Date.now();
    const delta = Math.max(0, base - this.publishedAt);
    const minutes = Math.floor(delta / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    return Math.floor(hours / 24) + 'd ago';
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      summary: this.summary,
      source: this.source,
      url: this.url,
      publishedAt: this.publishedAt,
      publishedAtIso: new Date(this.publishedAt).toISOString(),
      language: this.language,
      category: this.category,
      categoryLabel: this.categoryInfo().label,
      sentiment: this.sentiment,
      sentimentLabel: this.sentimentLabel(),
      impactScore: this.impactScore,
      coins: this.coins,
      keywords: this.keywords,
      isBreaking: this.isBreaking,
      isImportant: this.isImportant
    };
  }
}

class NewsAggregator extends EventEmitter {
  constructor(options) {
    super();
    const opts = options || {};
    this.desk3 = opts.desk3;
    this.cryptopanic = opts.cryptopanic;
    this.logger = opts.logger;
    this.limit = opts.limit || 30;
    this.cacheTtlMs = opts.cacheTtlMs || 300000;
    this.cache = { at: 0, items: [] };
    this.sources = [];
  }

  async aggregate(force) {
    if (!force && this.cache.items.length > 0 && Date.now() - this.cache.at < this.cacheTtlMs) {
      return { items: this.cache.items.slice(), cached: true, sources: this.sources.slice() };
    }

    const results = [];
    const sources = [];

    if (this.desk3) {
      const started = Date.now();
      try {
        const rows = await this.desk3.getNews(this.limit);
        rows.forEach((row) => results.push(new NewsItem(row)));
        sources.push({ name: 'Desk3 News', status: 'ok', count: rows.length, latencyMs: Date.now() - started });
      } catch (err) {
        sources.push({ name: 'Desk3 News', status: 'error', count: 0, error: err.message });
        if (this.logger) this.logger.warn('Desk3 news fetch failed', { error: err.message });
      }
    }

    if (this.cryptopanic && this.cryptopanic.enabled) {
      const started = Date.now();
      try {
        const rows = await this.cryptopanic.getNews({ limit: this.limit });
        rows.forEach((row) => results.push(new NewsItem(row)));
        sources.push({ name: 'CryptoPanic', status: 'ok', count: rows.length, latencyMs: Date.now() - started });
      } catch (err) {
        sources.push({ name: 'CryptoPanic', status: 'error', count: 0, error: err.message });
        if (this.logger) this.logger.warn('CryptoPanic fetch failed', { error: err.message });
      }
    }

    const deduped = this.deduplicate(results);
    deduped.sort((a, b) => b.publishedAt - a.publishedAt);
    this.cache = { at: Date.now(), items: deduped };
    this.sources = sources;
    this.emit('aggregated', { items: deduped, sources });
    return { items: deduped.slice(), cached: false, sources };
  }

  deduplicate(items) {
    const seen = new Map();
    for (const item of items) {
      const normalized = item.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff ]/g, '').replace(/\s+/g, ' ').trim();
      const key = normalized.slice(0, 90) || item.id;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, item);
        continue;
      }
      const better = item.impactScore > existing.impactScore ? item : existing;
      const other = better === item ? existing : item;
      better.engagement += other.engagement;
      if (other.summary.length > better.summary.length) better.summary = other.summary;
      seen.set(key, better);
    }
    return Array.from(seen.values());
  }
}

class SentimentMonitor {
  constructor(options) {
    const opts = options || {};
    this.watchCoins = opts.watchCoins || [];
    this.history = [];
    this.maxHistory = opts.maxHistory || 288;
  }

  compute(items) {
    const total = items.length;
    if (total === 0) {
      return {
        index: 50,
        label: 'neutral',
        averageSentiment: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        distribution: {},
        trend: 'flat',
        change: 0
      };
    }

    let sum = 0;
    let positive = 0;
    let negative = 0;
    const distribution = {};

    for (const item of items) {
      sum += item.sentiment;
      if (item.sentiment > 0.15) positive += 1;
      else if (item.sentiment < -0.15) negative += 1;
      distribution[item.category] = (distribution[item.category] || 0) + 1;
    }

    const average = sum / total;
    const index = Math.round(clamp(50 + average * 50, 0, 100));
    const previous = this.history.length > 0 ? this.history[this.history.length - 1].index : index;
    const change = index - previous;

    this.history.push({ index, at: Date.now() });
    if (this.history.length > this.maxHistory) this.history.shift();

    let label = 'neutral';
    if (index >= 75) label = 'extreme greed';
    else if (index >= 60) label = 'greed';
    else if (index <= 24) label = 'extreme fear';
    else if (index <= 39) label = 'fear';

    return {
      index,
      label,
      averageSentiment: Number(average.toFixed(3)),
      positive,
      negative,
      neutral: total - positive - negative,
      distribution,
      trend: change > 2 ? 'rising' : change < -2 ? 'falling' : 'flat',
      change
    };
  }

  coinSentiments(items) {
    const output = {};
    for (const coin of this.watchCoins) {
      const related = items.filter((item) => item.coins.includes(coin));
      if (related.length === 0) {
        output[coin] = { count: 0, trend: 'neutral', score: 0, positive: 0, negative: 0 };
        continue;
      }
      const score = related.reduce((acc, item) => acc + item.sentiment, 0) / related.length;
      output[coin] = {
        count: related.length,
        score: Number(score.toFixed(2)),
        trend: score > 0.2 ? 'bullish' : score < -0.2 ? 'bearish' : 'neutral',
        positive: related.filter((item) => item.sentiment > 0.15).length,
        negative: related.filter((item) => item.sentiment < -0.15).length
      };
    }
    return output;
  }

  topKeywords(items, limit) {
    const counts = new Map();
    for (const item of items) {
      for (const word of item.title.toLowerCase().split(/[^a-z0-9]+/)) {
        if (word.length < 4) continue;
        counts.set(word, (counts.get(word) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit || 12)
      .map(([word, count]) => ({ word, count }));
  }
}

class AlertEngine {
  constructor(options) {
    const opts = options || {};
    this.cooldownMs = opts.cooldownMs || 600000;
    this.lastFired = new Map();
    this.history = [];
  }

  evaluate(items, now) {
    const base = now || Date.now();
    const alerts = [];

    for (const item of items) {
      const rules = [];
      if (item.isBreaking && item.impactScore >= 8) {
        rules.push({ id: 'breaking', priority: 'critical', name: 'Breaking news' });
      }
      if (item.category === 'REGULATION') {
        rules.push({ id: 'regulation', priority: 'critical', name: 'Regulatory action' });
      }
      if (item.category === 'FUD') {
        rules.push({ id: 'security', priority: 'high', name: 'Security incident' });
      }
      if (item.impactScore >= 9 && !rules.some((rule) => rule.priority === 'critical')) {
        rules.push({ id: 'high-impact', priority: 'high', name: 'High-impact headline' });
      }
      if (item.category === 'WHALE' && item.coins.length > 0) {
        rules.push({ id: 'whale', priority: 'medium', name: 'Institutional flow' });
      }

      for (const rule of rules) {
        const key = rule.id + ':' + item.id;
        const last = this.lastFired.get(key) || 0;
        if (base - last < this.cooldownMs) continue;
        this.lastFired.set(key, base);
        const alert = {
          ruleId: rule.id,
          ruleName: rule.name,
          priority: rule.priority,
          newsId: item.id,
          title: item.title,
          category: item.category,
          coins: item.coins,
          impactScore: item.impactScore,
          url: item.url,
          triggeredAt: new Date(base).toISOString(),
          item: item.toJSON()
        };
        this.history.push(alert);
        alerts.push(alert);
      }
    }

    if (this.history.length > 500) this.history = this.history.slice(-500);
    return alerts;
  }

  reset() {
    this.lastFired.clear();
  }
}

module.exports = { NEWS_CATEGORIES: CATEGORIES, CATEGORIES, KEYWORDS, NewsItem, NewsAggregator, SentimentMonitor, AlertEngine, detectLanguage, normalizeText };

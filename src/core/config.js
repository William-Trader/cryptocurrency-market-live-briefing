'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error('Cannot parse ' + filePath + ': ' + err.message);
  }
}

function parseList(value, fallback) {
  if (!value) return fallback;
  return value.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
}

function envBool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(raw);
}

function loadConfig(options) {
  const opts = options || {};
  const env = opts.env || process.env;
  const root = opts.root || ROOT;
  const sources = readJsonIfExists(path.join(root, 'config', 'sources.json')) || {};
  const platforms = readJsonIfExists(path.join(root, 'config', 'platforms.json')) || {};

  const config = {
    root,
    version: require(path.join(root, 'package.json')).version,
    sources: {
      desk3BaseUrl: env.DESK3_BASE_URL || sources.desk3BaseUrl || 'https://api1.desk3.io/v1',
      cryptopanicBaseUrl: env.CRYPTOPANIC_BASE_URL || sources.cryptopanicBaseUrl || 'https://cryptopanic.com/api/v1',
      cryptopanicToken: env.CRYPTOPANIC_TOKEN || '',
      alternativeBaseUrl: env.ALTERNATIVE_BASE_URL || sources.alternativeBaseUrl || 'https://api.alternative.me',
      binanceBaseUrl: env.BINANCE_BASE_URL || sources.binanceBaseUrl || 'https://api.binance.com',
      enabled: sources.enabled || ['desk3', 'alternative', 'binance', 'cryptopanic']
    },
    news: {
      watchCoins: parseList(env.WATCH_COINS, sources.watchCoins || ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'DOT']),
      limit: Number(env.NEWS_LIMIT || sources.newsLimit || 30),
      cacheTtlMs: Number(env.NEWS_CACHE_TTL_MS || 300000),
      dedupeWindowMs: Number(env.NEWS_DEDUPE_WINDOW_MS || 86400000)
    },
    market: {
      coins: parseList(env.MARKET_COINS, sources.marketCoins || ['BTC', 'ETH', 'SOL', 'BNB']),
      quote: env.MARKET_QUOTE || 'USDT',
      klineInterval: env.KLINE_INTERVAL || '1h',
      klineLimit: Number(env.KLINE_LIMIT || 200)
    },
    delivery: {
      timeoutMs: Number(env.DELIVERY_TIMEOUT_MS || 15000),
      retries: Number(env.DELIVERY_RETRIES || 2),
      dryRun: envBool('DRY_RUN', false),
      platforms
    },
    logging: {
      level: env.LOG_LEVEL || 'info'
    }
  };

  return config;
}

function resolveSecret(value, envName) {
  if (value && typeof value === 'string' && value.startsWith('env:')) {
    const name = value.slice(4);
    return process.env[name] || '';
  }
  if (envName && process.env[envName]) return process.env[envName];
  return value || '';
}

function describeConfig(config) {
  const platforms = config.delivery.platforms || {};
  const names = Object.keys(platforms).filter((k) => platforms[k] && platforms[k].enabled);
  return {
    version: config.version,
    desk3BaseUrl: config.sources.desk3BaseUrl,
    cryptopanic: config.sources.cryptopanicToken ? 'configured' : 'disabled',
    watchCoins: config.news.watchCoins,
    marketCoins: config.market.coins,
    platforms: names
  };
}

module.exports = { loadConfig, describeConfig, resolveSecret, ROOT };

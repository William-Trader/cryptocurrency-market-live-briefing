'use strict';

const { analyze } = require('./indicators');

/**
 * Market orchestration: spot quotes, cycle metrics, candle-based technicals,
 * regime classification, and cross-asset correlation.
 */

function returns(series) {
  const output = [];
  for (let i = 1; i < series.length; i += 1) {
    const previous = series[i - 1];
    if (previous === 0) continue;
    output.push((series[i] - previous) / previous);
  }
  return output;
}

function pearson(a, b) {
  const length = Math.min(a.length, b.length);
  if (length < 3) return null;
  const x = a.slice(-length);
  const y = b.slice(-length);
  const meanX = x.reduce((acc, v) => acc + v, 0) / length;
  const meanY = y.reduce((acc, v) => acc + v, 0) / length;
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < length; i += 1) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  if (denomX === 0 || denomY === 0) return null;
  return Number((numerator / Math.sqrt(denomX * denomY)).toFixed(3));
}

function detectRegime(closes) {
  if (!Array.isArray(closes) || closes.length < 50) {
    return { regime: 'unknown', confidence: 0, note: 'insufficient history' };
  }
  const last = closes[closes.length - 1];
  const sma20 = closes.slice(-20).reduce((a, v) => a + v, 0) / 20;
  const sma50 = closes.slice(-50).reduce((a, v) => a + v, 0) / 50;
  const window = closes.slice(-30);
  const mean = window.reduce((a, v) => a + v, 0) / window.length;
  const variance = window.reduce((a, v) => a + (v - mean) * (v - mean), 0) / window.length;
  const volatility = Math.sqrt(variance) / (mean || 1) * 100;
  const momentum = (last - closes[closes.length - 21]) / (closes[closes.length - 21] || 1) * 100;

  let regime;
  if (sma20 > sma50 && momentum > 2) regime = 'bull';
  else if (sma20 < sma50 && momentum < -2) regime = 'bear';
  else regime = 'range';

  const confidence = Math.min(1, Math.abs(momentum) / 10 + (regime === 'range' ? 0 : 0.15));
  return {
    regime,
    confidence: Number(confidence.toFixed(2)),
    trend20: Number(sma20.toFixed(2)),
    trend50: Number(sma50.toFixed(2)),
    momentum20: Number(momentum.toFixed(2)),
    volatility30: Number(volatility.toFixed(2)),
    note: volatility > 4 ? 'high volatility' : 'normal volatility'
  };
}

class MarketMonitor {
  constructor(options) {
    const opts = options || {};
    this.config = opts.config;
    this.desk3 = opts.desk3;
    this.binance = opts.binance;
    this.logger = opts.logger;
  }

  async getOverview(coins) {
    const list = coins || this.config.market.coins;
    const started = Date.now();
    const sources = [];

    let prices = [];
    try {
      prices = await this.desk3.getPrices(list, this.config.market.quote);
      sources.push({ name: 'Desk3 Spot', status: 'ok', count: prices.length, latencyMs: Date.now() - started });
    } catch (err) {
      sources.push({ name: 'Desk3 Spot', status: 'error', error: err.message });
      throw err;
    }

    const extras = await Promise.all([
      this.desk3.getFearGreed().catch((err) => this._fail('Fear & Greed', err, sources)),
      this.desk3.getPuell().catch((err) => this._fail('Puell Multiple', err, sources)),
      this.desk3.getDominance().catch((err) => this._fail('BTC Dominance', err, sources)),
      this.desk3.getCycles().catch((err) => this._fail('Cycle Metrics', err, sources))
    ]);

    const technicals = {};
    if (this.binance) {
      await Promise.all(prices.map(async (quote) => {
        try {
          const candles = await this.binance.getKlines(quote.symbol, this.config.market.klineInterval, this.config.market.klineLimit, this.config.market.quote);
          technicals[quote.symbol] = {
            analyze: analyze(candles),
            regime: detectRegime(candles.map((candle) => candle.close)),
            candles: candles.length,
            series: candles.map((candle) => candle.close)
          };
        } catch (err) {
          technicals[quote.symbol] = { analyze: { available: false, reason: err.message }, regime: { regime: 'unknown' }, series: [] };
        }
      }));
      sources.push({ name: 'Binance Klines', status: 'ok', count: Object.keys(technicals).length });
    }

    const btc = technicals.BTC;
    const correlation = this._correlation(technicals);

    return {
      asOf: Math.max(...prices.map((quote) => quote.timestamp), Date.now()),
      quote: this.config.market.quote,
      prices,
      fearGreed: extras[0],
      puell: extras[1],
      dominance: extras[2],
      cycles: extras[3],
      technicals,
      regime: btc ? btc.regime : { regime: 'unknown' },
      correlation,
      sources
    };
  }

  _fail(name, err, sources) {
    sources.push({ name, status: 'error', error: err.message });
    if (this.logger) this.logger.warn(name + ' unavailable', { error: err.message });
    return null;
  }

  _correlation(technicals) {
    const symbols = Object.keys(technicals).filter((symbol) => technicals[symbol].series.length > 30);
    if (symbols.length < 2) return null;
    const base = symbols[0];
    const baseReturns = returns(technicals[base].series);
    const output = { base, values: {} };
    for (const symbol of symbols.slice(1)) {
      output.values[symbol] = pearson(baseReturns, returns(technicals[symbol].series));
    }
    return output;
  }
}

module.exports = { MarketMonitor, detectRegime, pearson, returns };

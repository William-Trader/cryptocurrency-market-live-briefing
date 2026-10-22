'use strict';

/**
 * Technical indicators. All functions take oldest-first arrays and return the
 * value for the most recent bar. Inputs are validated; insufficient data yields
 * null rather than a fabricated number.
 */

function sma(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((acc, value) => acc + value, 0) / period;
}

function emaSeries(values, period) {
  if (!Array.isArray(values) || values.length < period) return [];
  const k = 2 / (period + 1);
  const output = [];
  let previous = values.slice(0, period).reduce((acc, value) => acc + value, 0) / period;
  output.push(previous);
  for (let i = period; i < values.length; i += 1) {
    previous = values[i] * k + previous * (1 - k);
    output.push(previous);
  }
  return output;
}

function ema(values, period) {
  const series = emaSeries(values, period);
  return series.length ? series[series.length - 1] : null;
}

function rsi(values, period) {
  const span = period || 14;
  if (!Array.isArray(values) || values.length < span + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= span; i += 1) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / span;
  let avgLoss = loss / span;
  for (let i = span + 1; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1];
    const up = diff > 0 ? diff : 0;
    const down = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (span - 1) + up) / span;
    avgLoss = (avgLoss * (span - 1) + down) / span;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

function macd(values, fast, slow, signalPeriod) {
  const fastPeriod = fast || 12;
  const slowPeriod = slow || 26;
  const signalSpan = signalPeriod || 9;
  if (!Array.isArray(values) || values.length < slowPeriod + signalSpan) return null;

  const fastSeries = emaSeries(values, fastPeriod);
  const slowSeries = emaSeries(values, slowPeriod);
  const offset = fastSeries.length - slowSeries.length;
  const macdLine = slowSeries.map((value, index) => fastSeries[index + offset] - value);
  const signalSeries = emaSeries(macdLine, signalSpan);
  const macdValue = macdLine[macdLine.length - 1];
  const signalValue = signalSeries[signalSeries.length - 1];
  const histogram = macdValue - signalValue;

  return {
    macd: Number(macdValue.toFixed(4)),
    signal: Number(signalValue.toFixed(4)),
    histogram: Number(histogram.toFixed(4)),
    trend: histogram > 0 ? 'bullish' : histogram < 0 ? 'bearish' : 'neutral'
  };
}

function standardDeviation(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance = values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function bollinger(values, period, multiplier) {
  const span = period || 20;
  const mult = multiplier || 2;
  if (!Array.isArray(values) || values.length < span) return null;
  const slice = values.slice(-span);
  const middle = slice.reduce((acc, value) => acc + value, 0) / span;
  const deviation = standardDeviation(slice);
  const upper = middle + mult * deviation;
  const lower = middle - mult * deviation;
  const last = values[values.length - 1];
  const width = middle > 0 ? ((upper - lower) / middle) * 100 : 0;
  return {
    upper: Number(upper.toFixed(2)),
    middle: Number(middle.toFixed(2)),
    lower: Number(lower.toFixed(2)),
    widthPct: Number(width.toFixed(2)),
    position: last > upper ? 'above' : last < lower ? 'below' : 'inside'
  };
}

function atr(candles, period) {
  const span = period || 14;
  if (!Array.isArray(candles) || candles.length < span + 1) return null;
  const ranges = [];
  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i];
    const previous = candles[i - 1];
    ranges.push(Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    ));
  }
  const slice = ranges.slice(-span);
  return Number((slice.reduce((acc, value) => acc + value, 0) / span).toFixed(2));
}

function analyze(candles) {
  if (!Array.isArray(candles) || candles.length < 30) {
    return { available: false, reason: 'insufficient candles' };
  }
  const closes = candles.map((candle) => candle.close);
  const last = closes[closes.length - 1];
  const rsiValue = rsi(closes, 14);
  const macdValue = macd(closes);
  const bands = bollinger(closes, 20, 2);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const atrValue = atr(candles, 14);

  const signals = [];
  if (rsiValue !== null) {
    if (rsiValue >= 70) signals.push({ name: 'RSI', bias: 'bearish', note: 'overbought' });
    else if (rsiValue <= 30) signals.push({ name: 'RSI', bias: 'bullish', note: 'oversold' });
    else signals.push({ name: 'RSI', bias: 'neutral', note: 'mid-range' });
  }
  if (macdValue) signals.push({ name: 'MACD', bias: macdValue.trend, note: 'histogram ' + macdValue.histogram });
  if (bands) {
    if (bands.position === 'above') signals.push({ name: 'Bollinger', bias: 'bearish', note: 'above upper band' });
    else if (bands.position === 'below') signals.push({ name: 'Bollinger', bias: 'bullish', note: 'below lower band' });
  }

  const bullish = signals.filter((signal) => signal.bias === 'bullish').length;
  const bearish = signals.filter((signal) => signal.bias === 'bearish').length;

  return {
    available: true,
    last,
    rsi14: rsiValue,
    macd: macdValue,
    bollinger: bands,
    sma20: sma20 === null ? null : Number(sma20.toFixed(2)),
    sma50: sma50 === null ? null : Number(sma50.toFixed(2)),
    atr14: atrValue,
    trend: sma20 !== null && sma50 !== null && sma20 > sma50 ? 'up' : sma20 !== null && sma50 !== null ? 'down' : 'flat',
    signals,
    bias: bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'mixed'
  };
}

module.exports = { sma, ema, emaSeries, rsi, macd, bollinger, atr, analyze };

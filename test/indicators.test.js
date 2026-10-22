'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { sma, ema, rsi, macd, bollinger, atr, analyze } = require('../src/market/indicators');

const ascending = Array.from({ length: 60 }, (_, i) => 100 + i);
const candles = ascending.map((price, i) => ({ open: price - 0.5, high: price + 1, low: price - 1, close: price, volume: 10, openTime: i }));

test('sma returns null on insufficient data', () => {
  assert.strictEqual(sma([1, 2], 5), null);
});

test('sma averages the last period', () => {
  assert.strictEqual(sma([1, 2, 3, 4, 5], 5), 3);
});

test('ema reacts faster than sma to a recent jump', () => {
  const series = Array.from({ length: 40 }, () => 100).concat(Array.from({ length: 5 }, () => 150));
  assert.ok(ema(series, 10) > sma(series, 10));
});

test('rsi is 100 for a monotonic rise', () => {
  assert.strictEqual(rsi(ascending, 14), 100);
});

test('macd returns a trend label', () => {
  const result = macd(ascending);
  assert.ok(result);
  assert.ok(['bullish', 'bearish', 'neutral'].includes(result.trend));
});

test('bollinger positions the latest price', () => {
  const bands = bollinger(ascending, 20, 2);
  assert.ok(bands.upper > bands.middle);
  assert.ok(bands.middle > bands.lower);
  assert.ok(['above', 'below', 'inside'].includes(bands.position));
});

test('atr is positive', () => {
  const value = atr(candles, 14);
  assert.ok(value > 0);
});

test('analyze flags insufficient candles instead of fabricating values', () => {
  const result = analyze(candles.slice(0, 10));
  assert.strictEqual(result.available, false);
  assert.ok(result.reason);
});

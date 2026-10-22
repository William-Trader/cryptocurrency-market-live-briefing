'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { NewsItem, NewsAggregator, SentimentMonitor, AlertEngine } = require('../src/news/engine');

test('classifies regulatory headlines and extracts coins', () => {
  const item = new NewsItem({
    title: 'SEC approves spot Bitcoin ETF after years of review',
    summary: 'The decision was widely expected by institutional investors.',
    publishedAt: Date.now()
  });
  assert.strictEqual(item.category, 'REGULATION');
  assert.ok(item.coins.includes('BTC'));
  assert.ok(item.sentiment > 0);
  assert.ok(item.impactScore >= 7);
});

test('detects security incidents as FUD', () => {
  const item = new NewsItem({
    title: 'Bridge exploit drains $40 million, protocol halts withdrawals',
    publishedAt: Date.now()
  });
  assert.strictEqual(item.category, 'FUD');
  assert.ok(item.sentiment < 0);
});

test('neutral text scores zero', () => {
  const item = new NewsItem({ title: 'Weekly developer call scheduled', publishedAt: Date.now() });
  assert.strictEqual(item.sentiment, 0);
});

test('normalizes HTML entities and strips tags', () => {
  const item = new NewsItem({ title: 'ETF &amp; <b>flows</b> rise', publishedAt: Date.now() });
  assert.strictEqual(item.title, 'ETF & flows rise');
});

test('deduplicates near-identical titles and keeps the higher impact item', () => {
  const aggregator = new NewsAggregator({});
  const a = new NewsItem({ title: 'Bitcoin breaks 100k', source: 'A', impactScore: 9, publishedAt: 1 });
  const b = new NewsItem({ title: 'Bitcoin breaks 100k!', source: 'B', impactScore: 5, publishedAt: 2 });
  const result = aggregator.deduplicate([a, b]);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].impactScore, 9);
});

test('sentiment index stays in range and reports distribution', () => {
  const monitor = new SentimentMonitor({ watchCoins: ['BTC'] });
  const items = [
    new NewsItem({ title: 'Bitcoin surges to record high on ETF approval', publishedAt: Date.now() }),
    new NewsItem({ title: 'Exchange hack triggers panic selling', publishedAt: Date.now() }),
    new NewsItem({ title: 'Network upgrade ships', publishedAt: Date.now() })
  ];
  const result = monitor.compute(items);
  assert.ok(result.index >= 0 && result.index <= 100);
  assert.strictEqual(result.positive + result.negative + result.neutral, items.length);
  assert.ok(result.distribution);
});

test('alert engine applies cooldown per rule and item', () => {
  const engine = new AlertEngine({ cooldownMs: 600000 });
  const item = new NewsItem({
    title: 'Breaking: SEC emergency action on major exchange',
    publishedAt: Date.now(),
    impactScore: 9
  });
  const first = engine.evaluate([item], 1000000);
  const second = engine.evaluate([item], 1000001);
  assert.ok(first.length >= 1);
  assert.strictEqual(second.length, 0);
});

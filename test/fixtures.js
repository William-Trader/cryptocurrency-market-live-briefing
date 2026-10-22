'use strict';

function sampleBriefing() {
  const article = {
    id: 'a1',
    title: 'BlackRock files for spot Ethereum ETF',
    summary: 'Institutional demand grows as the SEC review continues.',
    source: 'Desk3',
    url: 'https://example.com/a1',
    publishedAt: Date.now() - 300000,
    language: 'en',
    category: 'WHALE',
    categoryLabel: 'Whale',
    sentiment: 0.6,
    sentimentLabel: 'strongly bullish',
    impactScore: 9,
    coins: ['ETH'],
    keywords: ['etf', 'institutional'],
    isBreaking: false,
    isImportant: true,
    categoryInfo: () => ({ label: 'Whale', emoji: '🐋' }),
    sentimentLabelFn: null,
    sentimentLabel: 'strongly bullish',
    relativeTime: () => '5m ago'
  };
  article.categoryInfo = () => ({ label: 'Whale', emoji: '🐋' });
  article.sentimentLabel = () => 'strongly bullish';
  article.toJSON = () => article;

  return {
    schema: 'crypto.briefing/2',
    id: 'brief_test_1',
    generatedAt: new Date('2026-10-22T06:00:00Z').toISOString(),
    asOf: {
      market: new Date('2026-10-22T05:59:30Z').toISOString(),
      news: new Date('2026-10-22T05:58:00Z').toISOString(),
      generated: new Date('2026-10-22T06:00:00Z').toISOString()
    },
    window: { candles: '1h', newsLimit: 30 },
    market: {
      quote: 'USDT',
      prices: [
        { symbol: 'BTC', pair: 'BTCUSDT', price: 82816.51, open: 82680, high: 84898, low: 82647, volume: 20000, quoteVolume: 1.6e9, change24hPct: 0.17, timestamp: Date.now() },
        { symbol: 'ETH', pair: 'ETHUSDT', price: 2438.54, open: 2440, high: 2500, low: 2400, volume: 100000, quoteVolume: 2.4e8, change24hPct: -0.02, timestamp: Date.now() }
      ],
      fearGreed: { value: 53, classification: 'Neutral', timestamp: Date.now(), history: [] },
      puell: { value: 1.12, timestamp: Date.now(), percentile: 0.4, history: [] },
      dominance: { btc: 60.07, eth: 8.4, others: 31.53, timestamp: Date.now(), history: [] },
      cycles: null,
      regime: { regime: 'range', confidence: 0.3, trend20: 83000, trend50: 82000, momentum20: -0.73, volatility30: 1.2, note: 'normal volatility' },
      correlation: { base: 'BTC', values: { ETH: 0.91 } },
      technicals: {
        BTC: { bias: 'bearish', trend: 'down', rsi14: 36.84, macd: { macd: -10, signal: -8, histogram: -2, trend: 'bearish' }, bollinger: null, atr14: 400, regime: { regime: 'range' }, candles: 200 },
        ETH: { bias: 'bearish', trend: 'down', rsi14: 37.9, macd: null, bollinger: null, atr14: 30, regime: { regime: 'range' }, candles: 200 }
      },
      sources: [{ name: 'Desk3 Spot', status: 'ok' }]
    },
    news: {
      asOf: Date.now(),
      items: [article],
      sentiment: { index: 56, label: 'neutral', averageSentiment: 0.12, positive: 5, negative: 3, neutral: 2, distribution: { WHALE: 1 }, trend: 'flat', change: 0 },
      coinSentiments: { BTC: { count: 0, trend: 'neutral', score: 0, positive: 0, negative: 0 }, ETH: { count: 1, trend: 'bullish', score: 0.6, positive: 1, negative: 0 } },
      keywords: [{ word: 'ethereum', count: 1 }],
      alerts: [{ priority: 'high', ruleName: 'High-impact headline', title: 'BlackRock files for spot Ethereum ETF' }],
      sources: [{ name: 'Desk3 News', status: 'ok' }],
      cached: false
    },
    verdict: { stance: 'neutral', label: 'Wait and see', reasoning: 'No edge from trend or sentiment; favor range tactics and small size.' },
    alerts: [{ priority: 'high', ruleName: 'High-impact headline', title: 'BlackRock files for spot Ethereum ETF' }],
    sources: [{ name: 'Desk3 Spot', status: 'ok' }, { name: 'Desk3 News', status: 'ok' }],
    errors: [],
    disclaimer: 'For research and risk awareness only. Not investment advice.'
  };
}

module.exports = { sampleBriefing };

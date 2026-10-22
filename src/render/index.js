'use strict';

const { money, pct, arrow, marker, clock, relative } = require('./format');

/**
 * Renderers. Each renderer receives the canonical briefing and returns a
 * platform-ready payload. Nothing here performs network I/O.
 */

function topNews(briefing, limit) {
  const items = (briefing.news && briefing.news.items) || [];
  return items
    .slice()
    .sort((a, b) => b.impactScore - a.impactScore || b.publishedAt - a.publishedAt)
    .slice(0, limit || 5);
}

function renderMarkdown(briefing, options) {
  const opts = options || {};
  const lines = [];
  lines.push('# Crypto Market Briefing');
  lines.push('');
  lines.push('**' + briefing.verdict.label + '** — ' + briefing.verdict.reasoning);
  lines.push('');
  lines.push('id ' + briefing.id + ' · generated ' + clock(briefing.generatedAt));
  lines.push('');
  lines.push('---');

  const market = briefing.market;
  if (market) {
    lines.push('## Market');
    lines.push('');
    lines.push('| Coin | Price | 24h | Trend | RSI | Bias |');
    lines.push('|------|-------|-----|-------|-----|------|');
    for (const quote of market.prices) {
      const tech = market.technicals[quote.symbol] || {};
      lines.push('| ' + quote.symbol + ' | ' + money(quote.price) + ' | ' + pct(quote.change24hPct)
        + ' | ' + arrow(quote.change24hPct) + ' | ' + (tech.rsi14 === null || tech.rsi14 === undefined ? 'n/a' : tech.rsi14)
        + ' | ' + (tech.bias || 'n/a') + ' |');
    }
    lines.push('');
    const facts = [];
    if (market.fearGreed) facts.push('Fear & Greed **' + market.fearGreed.value + '** (' + market.fearGreed.classification + ')');
    if (market.dominance) facts.push('BTC dominance **' + market.dominance.btc.toFixed(1) + '%**');
    if (market.puell) facts.push('Puell multiple **' + market.puell.value.toFixed(2) + '**');
    if (market.regime) facts.push('Regime **' + market.regime.regime + '** (' + market.regime.momentum20 + '% 20-bar momentum)');
    if (facts.length) {
      lines.push(facts.join(' · '));
      lines.push('');
    }
  }

  if (briefing.news && briefing.news.sentiment) {
    const sentiment = briefing.news.sentiment;
    lines.push('## News sentiment');
    lines.push('');
    lines.push('Index **' + sentiment.index + '/100** (' + sentiment.label + ') · trend ' + sentiment.trend
      + ' · ' + sentiment.positive + ' positive / ' + sentiment.negative + ' negative / ' + sentiment.neutral + ' neutral');
    lines.push('');
    const coins = Object.entries(briefing.news.coinSentiments || {})
      .filter((entry) => entry[1].count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6);
    if (coins.length) {
      lines.push(coins.map((entry) => marker(entry[1].score) + ' ' + entry[0] + ' ' + entry[1].trend + ' (' + entry[1].count + ')').join(' · '));
      lines.push('');
    }
  }

  const news = topNews(briefing, opts.news || 5);
  if (news.length) {
    lines.push('## Top headlines');
    lines.push('');
    news.forEach((item, index) => {
      const category = item.categoryInfo ? item.categoryInfo() : { emoji: '📰' };
      lines.push((index + 1) + '. ' + category.emoji + ' **' + item.title + '**');
      lines.push('   ' + item.sentimentLabel() + ' · impact ' + item.impactScore + '/10 · ' + relative(item.publishedAt) + ' · ' + item.source);
    });
    lines.push('');
  }

  if (briefing.alerts && briefing.alerts.length) {
    lines.push('## Active alerts');
    lines.push('');
    for (const alert of briefing.alerts.slice(0, 5)) {
      lines.push('- [' + alert.priority + '] ' + alert.ruleName + ': ' + alert.title);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('Sources: ' + briefing.sources.map((s) => s.name + (s.status === 'ok' ? '' : ' (' + s.status + ')')).join(', '));
  if (briefing.errors && briefing.errors.length) {
    lines.push('Degraded: ' + briefing.errors.map((e) => e.section + ' (' + e.error + ')').join('; '));
  }
  lines.push('');
  lines.push('_' + briefing.disclaimer + '_');
  return lines.join('\n');
}

function renderPlain(briefing, options) {
  const opts = options || {};
  const lines = [];
  lines.push('CRYPTO MARKET BRIEFING');
  lines.push(briefing.verdict.label.toUpperCase() + ' - ' + briefing.verdict.reasoning);
  lines.push('Generated ' + clock(briefing.generatedAt) + ' | ' + briefing.id);
  lines.push('');

  if (briefing.market) {
    lines.push('MARKET');
    for (const quote of briefing.market.prices) {
      lines.push('  ' + quote.symbol.padEnd(5) + money(quote.price).padStart(12) + '  ' + pct(quote.change24hPct).padStart(8) + '  ' + arrow(quote.change24hPct));
    }
    const facts = [];
    if (briefing.market.fearGreed) facts.push('F&G ' + briefing.market.fearGreed.value + ' ' + briefing.market.fearGreed.classification);
    if (briefing.market.dominance) facts.push('BTC.D ' + briefing.market.dominance.btc.toFixed(1) + '%');
    if (briefing.market.regime) facts.push('Regime ' + briefing.market.regime.regime);
    if (facts.length) lines.push('  ' + facts.join(' | '));
    lines.push('');
  }

  if (briefing.news && briefing.news.sentiment) {
    lines.push('SENTIMENT ' + briefing.news.sentiment.index + '/100 (' + briefing.news.sentiment.label + ') trend=' + briefing.news.sentiment.trend);
    lines.push('');
  }

  const news = topNews(briefing, opts.news || 5);
  if (news.length) {
    lines.push('TOP HEADLINES');
    news.forEach((item, index) => {
      lines.push('  ' + (index + 1) + '. ' + item.title);
      lines.push('     ' + item.sentimentLabel() + ' | impact ' + item.impactScore + '/10 | ' + relative(item.publishedAt) + ' | ' + item.source);
    });
    lines.push('');
  }

  if (briefing.alerts && briefing.alerts.length) {
    lines.push('ALERTS');
    for (const alert of briefing.alerts.slice(0, 5)) lines.push('  [' + alert.priority + '] ' + alert.title);
    lines.push('');
  }

  lines.push('Sources: ' + briefing.sources.map((s) => s.name).join(', '));
  lines.push(briefing.disclaimer);
  return lines.join('\n');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderTelegram(briefing, options) {
  const opts = options || {};
  const lines = [];
  lines.push('<b>Crypto Market Briefing</b>');
  lines.push('<b>' + escapeHtml(briefing.verdict.label) + '</b> — ' + escapeHtml(briefing.verdict.reasoning));
  lines.push('<i>' + clock(briefing.generatedAt) + '</i>');
  lines.push('');

  if (briefing.market) {
    lines.push('<b>Market</b>');
    for (const quote of briefing.market.prices) {
      const icon = quote.change24hPct > 0 ? '🔴' : quote.change24hPct < 0 ? '🟢' : '⚪';
      lines.push(icon + ' <b>' + quote.symbol + '</b> ' + money(quote.price) + '  ' + pct(quote.change24hPct));
    }
    const facts = [];
    if (briefing.market.fearGreed) facts.push('F&amp;G ' + briefing.market.fearGreed.value);
    if (briefing.market.dominance) facts.push('BTC.D ' + briefing.market.dominance.btc.toFixed(1) + '%');
    if (briefing.market.regime) facts.push('Regime ' + briefing.market.regime.regime);
    if (facts.length) lines.push('<i>' + facts.join(' · ') + '</i>');
    lines.push('');
  }

  if (briefing.news && briefing.news.sentiment) {
    lines.push('<b>Sentiment</b> ' + briefing.news.sentiment.index + '/100 (' + briefing.news.sentiment.label + ')');
    lines.push('');
  }

  const news = topNews(briefing, opts.news || 5);
  if (news.length) {
    lines.push('<b>Top headlines</b>');
    news.forEach((item, index) => {
      lines.push((index + 1) + '. <a href="' + escapeHtml(item.url || '#') + '">' + escapeHtml(item.title) + '</a>');
      lines.push('   <i>' + item.impactScore + '/10 · ' + relative(item.publishedAt) + '</i>');
    });
    lines.push('');
  }

  lines.push('<i>' + escapeHtml(briefing.disclaimer) + '</i>');
  return { text: lines.join('\n'), parse_mode: 'HTML' };
}

function renderDiscord(briefing, options) {
  const opts = options || {};
  const fields = [];
  if (briefing.market) {
    fields.push({
      name: 'Market',
      value: briefing.market.prices.map((quote) => quote.symbol + ' ' + money(quote.price) + ' (' + pct(quote.change24hPct) + ')').join('\n').slice(0, 1024),
      inline: true
    });
    const facts = [];
    if (briefing.market.fearGreed) facts.push('Fear & Greed: ' + briefing.market.fearGreed.value);
    if (briefing.market.dominance) facts.push('BTC dominance: ' + briefing.market.dominance.btc.toFixed(1) + '%');
    if (briefing.market.regime) facts.push('Regime: ' + briefing.market.regime.regime);
    fields.push({ name: 'Context', value: facts.join('\n') || 'n/a', inline: true });
  }
  if (briefing.news && briefing.news.sentiment) {
    fields.push({
      name: 'Sentiment',
      value: briefing.news.sentiment.index + '/100 (' + briefing.news.sentiment.label + ') · ' + briefing.news.sentiment.trend,
      inline: false
    });
  }
  const news = topNews(briefing, opts.news || 5);
  if (news.length) {
    fields.push({
      name: 'Top headlines',
      value: news.map((item, index) => (index + 1) + '. [' + item.title.slice(0, 120) + '](' + (item.url || '') + ')').join('\n').slice(0, 1024),
      inline: false
    });
  }

  return {
    content: '**Crypto Market Briefing** — ' + briefing.verdict.label,
    embeds: [{
      title: briefing.verdict.label + ' · ' + briefing.verdict.stance,
      description: briefing.verdict.reasoning,
      color: briefing.verdict.stance === 'defensive' ? 0x2ecc71 : briefing.verdict.stance === 'cautious' ? 0xe67e22 : 0x3498db,
      fields,
      footer: { text: briefing.id + ' · ' + briefing.disclaimer.slice(0, 100) },
      timestamp: briefing.generatedAt
    }]
  };
}

function renderSlack(briefing, options) {
  const opts = options || {};
  const blocks = [];
  blocks.push({ type: 'header', text: { type: 'plain_text', text: 'Crypto Market Briefing' } });
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*' + briefing.verdict.label + '* — ' + briefing.verdict.reasoning } });

  if (briefing.market) {
    const rows = briefing.market.prices.map((quote) => '*' + quote.symbol + '* ' + money(quote.price) + ' ' + pct(quote.change24hPct));
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*Market*\n' + rows.join('\n') } });
  }
  if (briefing.news && briefing.news.sentiment) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: 'Sentiment ' + briefing.news.sentiment.index + '/100 (' + briefing.news.sentiment.label + ') · ' + clock(briefing.generatedAt) }]
    });
  }
  const news = topNews(briefing, opts.news || 5);
  if (news.length) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Top headlines*\n' + news.map((item, index) => (index + 1) + '. <' + (item.url || '') + '|' + item.title.replace(/[<>|]/g, '') + '>').join('\n')
      }
    });
  }
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: briefing.disclaimer }] });
  return { text: 'Crypto Market Briefing — ' + briefing.verdict.label, blocks };
}

function renderFeishu(briefing, options) {
  const opts = options || {};
  const elements = [];
  elements.push({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: '**' + briefing.verdict.label + '** — ' + briefing.verdict.reasoning + '\n' + clock(briefing.generatedAt)
    }
  });

  if (briefing.market) {
    const rows = briefing.market.prices.map((quote) => quote.symbol + ': **' + money(quote.price) + '** (' + pct(quote.change24hPct) + ')');
    elements.push({ tag: 'hr' });
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: '**Market**\n' + rows.join('\n') } });
    const facts = [];
    if (briefing.market.fearGreed) facts.push('Fear & Greed ' + briefing.market.fearGreed.value);
    if (briefing.market.dominance) facts.push('BTC dominance ' + briefing.market.dominance.btc.toFixed(1) + '%');
    if (briefing.market.regime) facts.push('Regime ' + briefing.market.regime.regime);
    if (facts.length) elements.push({ tag: 'note', elements: [{ tag: 'plain_text', content: facts.join(' · ') }] });
  }

  if (briefing.news && briefing.news.sentiment) {
    elements.push({ tag: 'hr' });
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: '**Sentiment** ' + briefing.news.sentiment.index + '/100 (' + briefing.news.sentiment.label + ')' } });
  }

  const news = topNews(briefing, opts.news || 5);
  if (news.length) {
    elements.push({ tag: 'hr' });
    const lines = news.map((item, index) => (index + 1) + '. [' + item.title + '](' + (item.url || '') + ')');
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: '**Top headlines**\n' + lines.join('\n') } });
  }

  elements.push({ tag: 'hr' });
  elements.push({ tag: 'note', elements: [{ tag: 'plain_text', content: briefing.disclaimer }] });

  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: briefing.verdict.stance === 'defensive' ? 'green' : briefing.verdict.stance === 'cautious' ? 'orange' : 'blue',
        title: { tag: 'plain_text', content: 'Crypto Market Briefing · ' + briefing.verdict.label }
      },
      elements
    }
  };
}

function render(kind, briefing, options) {
  switch (kind) {
    case 'markdown':
    case 'md':
      return renderMarkdown(briefing, options);
    case 'plain':
    case 'text':
      return renderPlain(briefing, options);
    case 'telegram':
      return renderTelegram(briefing, options);
    case 'discord':
      return renderDiscord(briefing, options);
    case 'slack':
      return renderSlack(briefing, options);
    case 'feishu':
    case 'lark':
      return renderFeishu(briefing, options);
    case 'json':
      return briefing;
    default:
      throw new Error('Unknown renderer: ' + kind);
  }
}

module.exports = {
  render,
  renderMarkdown,
  renderPlain,
  renderTelegram,
  renderDiscord,
  renderSlack,
  renderFeishu,
  topNews
};

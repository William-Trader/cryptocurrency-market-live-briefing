#!/usr/bin/env node
'use strict';

/**
 * crypto-intel CLI
 *
 *   crypto-intel news      [--limit N] [--json] [--export FILE]
 *   crypto-intel market    [--coins BTC,ETH] [--json]
 *   crypto-intel brief     [--format markdown|plain|json|telegram|feishu|discord|slack]
 *                          [--out FILE] [--news-only|--market-only] [--news N]
 *   crypto-intel publish   [--platform NAME] [--dry-run] [--news N]
 *   crypto-intel doctor
 *   crypto-intel config
 */

const fs = require('fs');
const path = require('path');
const { createSystem } = require('../src');
const { render } = require('../src/render');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const name = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[name] = true;
      } else {
        args[name] = next;
        i += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

function print(value) {
  process.stdout.write(value + '\n');
}

async function commandNews(system, args) {
  const bundle = await system.news.collect({ limit: args.limit ? Number(args.limit) : undefined, force: Boolean(args.force) });
  if (args.json) {
    print(JSON.stringify({
      asOf: new Date(bundle.asOf).toISOString(),
      sentiment: bundle.sentiment,
      coinSentiments: bundle.coinSentiments,
      keywords: bundle.keywords,
      alerts: bundle.alerts,
      items: bundle.items.map((item) => item.toJSON()),
      sources: bundle.sources
    }, null, 2));
    return 0;
  }

  print('NEWS INTELLIGENCE · ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
  print('Sentiment ' + bundle.sentiment.index + '/100 (' + bundle.sentiment.label + ') trend=' + bundle.sentiment.trend);
  print('Items ' + bundle.items.length + ' · cache=' + (bundle.cached ? 'hit' : 'miss'));
  print('');
  const top = bundle.items.slice().sort((a, b) => b.impactScore - a.impactScore).slice(0, 10);
  top.forEach((item, index) => {
    print((index + 1) + '. [' + item.category + '] ' + item.title);
    print('   ' + item.sentimentLabel() + ' · impact ' + item.impactScore + '/10 · ' + item.source + ' · ' + item.url);
  });
  if (bundle.alerts.length) {
    print('');
    print('ALERTS');
    bundle.alerts.forEach((alert) => print('  [' + alert.priority + '] ' + alert.ruleName + ': ' + alert.title));
  }
  if (args.export) {
    const target = system.news.exportJson(bundle, args.export);
    print('');
    print('Exported ' + target);
  }
  return 0;
}

async function commandMarket(system, args) {
  const coins = args.coins ? String(args.coins).split(',').map((s) => s.trim().toUpperCase()) : undefined;
  const overview = await system.market.getOverview(coins);
  if (args.json) {
    print(JSON.stringify(overview, null, 2));
    return 0;
  }
  print('MARKET OVERVIEW · ' + new Date(overview.asOf).toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
  for (const quote of overview.prices) {
    print('  ' + quote.symbol.padEnd(5) + String(quote.price).padStart(14) + '  ' + (quote.change24hPct >= 0 ? '+' : '') + quote.change24hPct.toFixed(2) + '%');
  }
  if (overview.fearGreed) print('  Fear & Greed: ' + overview.fearGreed.value + ' (' + overview.fearGreed.classification + ')');
  if (overview.dominance) print('  BTC dominance: ' + overview.dominance.btc.toFixed(2) + '%');
  if (overview.puell) print('  Puell multiple: ' + overview.puell.value.toFixed(2));
  if (overview.regime) print('  Regime: ' + overview.regime.regime + ' · momentum ' + overview.regime.momentum20 + '%');
  print('  Sources: ' + overview.sources.map((s) => s.name + '=' + s.status).join(', '));
  return 0;
}

async function commandBrief(system, args) {
  const briefing = await system.briefing.build({
    coins: args.coins ? String(args.coins).split(',').map((s) => s.trim().toUpperCase()) : undefined,
    newsLimit: args.limit ? Number(args.limit) : undefined,
    newsOnly: Boolean(args['news-only']),
    marketOnly: Boolean(args['market-only'])
  });
  const format = args.format || 'markdown';
  const output = format === 'json' ? JSON.stringify(briefing, null, 2) : render(format, briefing, { news: args.news ? Number(args.news) : undefined });
  if (args.out) {
    const target = path.resolve(args.out);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof output === 'string' ? output : JSON.stringify(output, null, 2));
    print('Wrote ' + target);
  } else {
    print(typeof output === 'string' ? output : JSON.stringify(output, null, 2));
  }
  return 0;
}

async function commandPublish(system, args) {
  const briefing = await system.briefing.build({ newsLimit: args.limit ? Number(args.limit) : undefined });
  const results = await system.publishBriefing(briefing, system.config, {
    platform: args.platform,
    dryRun: Boolean(args['dry-run']),
    logger: system.logger
  });
  print(JSON.stringify(results, null, 2));
  return results.every((result) => result.ok) ? 0 : 1;
}

async function commandDoctor(system) {
  const checks = [];
  const config = system.config;

  checks.push({ name: 'node', ok: Number(process.versions.node.split('.')[0]) >= 18, detail: process.version });
  checks.push({ name: 'config', ok: true, detail: config.root });

  try {
    const quotes = await system.desk3.getPrices(['BTC'], config.market.quote);
    checks.push({ name: 'desk3.spot', ok: quotes.length > 0, detail: quotes.length ? quotes[0].price : 'no rows' });
  } catch (err) {
    checks.push({ name: 'desk3.spot', ok: false, detail: err.message });
  }

  try {
    const candles = await system.binance.getKlines('BTC', '1h', 30, config.market.quote);
    checks.push({ name: 'binance.klines', ok: candles.length >= 30, detail: candles.length + ' candles' });
  } catch (err) {
    checks.push({ name: 'binance.klines', ok: false, detail: err.message });
  }

  try {
    const news = await system.desk3.getNews(3);
    checks.push({ name: 'desk3.news', ok: news.length > 0, detail: news.length + ' items' });
  } catch (err) {
    checks.push({ name: 'desk3.news', ok: false, detail: err.message });
  }

  checks.push({
    name: 'cryptopanic',
    ok: true,
    detail: system.cryptopanic.enabled ? 'token configured' : 'skipped (no token)'
  });

  const targets = system.listTargets(config);
  checks.push({ name: 'delivery', ok: true, detail: targets.map((t) => t.name + (t.enabled ? '' : ' (disabled)')).join(', ') || 'none configured' });

  print('DOCTOR');
  for (const check of checks) {
    print('  ' + (check.ok ? 'OK  ' : 'FAIL') + '  ' + check.name.padEnd(16) + check.detail);
  }
  return checks.every((check) => check.ok) ? 0 : 1;
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const command = args._[0] || 'brief';
  const system = createSystem();

  if (command === 'config') {
    print(JSON.stringify(system.config, (key, value) => {
      if (/token|secret|password|key/i.test(key) && typeof value === 'string' && value.length > 0) return '***';
      return value;
    }, 2));
    return 0;
  }

  switch (command) {
    case 'news':
      return commandNews(system, args);
    case 'market':
      return commandMarket(system, args);
    case 'brief':
      return commandBrief(system, args);
    case 'publish':
      return commandPublish(system, args);
    case 'doctor':
      return commandDoctor(system);
    case 'help':
      print('crypto-intel news|market|brief|publish|doctor|config');
      return 0;
    default:
      process.stderr.write('Unknown command: ' + command + '\n');
      process.stderr.write('Usage: crypto-intel news|market|brief|publish|doctor|config\n');
      return 2;
  }
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((err) => {
    process.stderr.write('ERROR ' + err.message + '\n');
    process.exitCode = 1;
  });
}

module.exports = { main, parseArgs };

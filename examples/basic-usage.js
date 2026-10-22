#!/usr/bin/env node
'use strict';

/**
 * Programmatic example: build one briefing, render it two ways, optionally send.
 *
 *   node examples/basic-usage.js
 *   node examples/basic-usage.js --send telegram
 */

const { createSystem } = require('../src');

async function main() {
  const system = createSystem({ logger: undefined });
  const args = process.argv.slice(2);

  console.log('Building briefing...');
  const briefing = await system.briefing.build({ coins: ['BTC', 'ETH'] });

  console.log('');
  console.log('schema        ', briefing.schema);
  console.log('id            ', briefing.id);
  console.log('verdict       ', briefing.verdict.label, '(' + briefing.verdict.stance + ')');
  console.log('market asOf   ', briefing.asOf.market);
  console.log('news asOf     ', briefing.asOf.news);
  console.log('headlines     ', briefing.news ? briefing.news.items.length : 0);
  console.log('sentiment     ', briefing.news ? briefing.news.sentiment.index + '/100 ' + briefing.news.sentiment.label : 'n/a');
  console.log('sources       ', briefing.sources.map((s) => s.name + '=' + s.status).join(', '));
  console.log('');
  console.log('--- markdown (first 15 lines) ---');
  console.log(system.render('markdown', briefing).split('\n').slice(0, 15).join('\n'));

  const sendIndex = args.indexOf('--send');
  if (sendIndex !== -1) {
    const platform = args[sendIndex + 1];
    const results = await system.publishBriefing(briefing, system.config, { platform });
    console.log('');
    console.log('delivery:', JSON.stringify(results, null, 2));
    process.exitCode = results.every((r) => r.ok) ? 0 : 1;
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exitCode = 1;
});

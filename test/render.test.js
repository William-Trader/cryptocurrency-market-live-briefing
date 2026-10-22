'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { render, renderTelegram, renderDiscord, renderSlack, renderFeishu, renderMarkdown } = require('../src/render');
const { sampleBriefing } = require('./fixtures');

const briefing = sampleBriefing();

test('markdown contains verdict, market and disclaimer', () => {
  const output = renderMarkdown(briefing);
  assert.ok(output.includes('Crypto Market Briefing'));
  assert.ok(output.includes('Wait and see'));
  assert.ok(output.includes('BTC'));
  assert.ok(output.includes('Not investment advice'));
  assert.ok(!output.includes('undefined'));
});

test('telegram returns HTML payload with escaped text', () => {
  const payload = renderTelegram(briefing);
  assert.strictEqual(payload.parse_mode, 'HTML');
  assert.ok(payload.text.includes('<b>'));
  assert.ok(payload.text.length < 4096);
});

test('discord returns one embed with fields', () => {
  const payload = renderDiscord(briefing);
  assert.strictEqual(payload.embeds.length, 1);
  assert.ok(payload.embeds[0].fields.length >= 2);
});

test('slack returns blocks', () => {
  const payload = renderSlack(briefing);
  assert.ok(Array.isArray(payload.blocks));
  assert.ok(payload.blocks.length >= 3);
});

test('feishu returns an interactive card', () => {
  const payload = renderFeishu(briefing);
  assert.strictEqual(payload.msg_type, 'interactive');
  assert.ok(payload.card.elements.length > 2);
});

test('json renderer returns the briefing object', () => {
  assert.strictEqual(render('json', briefing), briefing);
});

test('unknown renderer throws', () => {
  assert.throws(() => render('nope', briefing));
});

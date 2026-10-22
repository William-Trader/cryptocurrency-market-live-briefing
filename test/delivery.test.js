'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { chunkText, createAdapter, listTargets, selectTargets } = require('../src/delivery');
const { sampleBriefing } = require('./fixtures');

test('chunkText respects size and keeps content', () => {
  const text = Array.from({ length: 300 }, (_, i) => 'line ' + i).join('\n');
  const chunks = chunkText(text, 500);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.ok(chunk.length <= 500);
  assert.strictEqual(chunks.join('\n'), text);
});

test('createAdapter resolves known adapters and rejects unknown ones', () => {
  for (const name of ['telegram', 'discord', 'slack', 'feishu', 'qq', 'wecom', 'webhook']) {
    assert.ok(createAdapter(name));
  }
  assert.throws(() => createAdapter('myspace'));
});

test('listTargets and selectTargets respect enabled flags', () => {
  const config = {
    delivery: {
      platforms: {
        one: { enabled: true, adapter: 'telegram' },
        two: { enabled: false, adapter: 'discord' }
      }
    }
  };
  assert.deepStrictEqual(listTargets(config).map((t) => t.name), ['one', 'two']);
  assert.deepStrictEqual(selectTargets(config).map((t) => t.name), ['one']);
  assert.throws(() => selectTargets(config, 'two'));
});

test('telegram adapter fails fast without credentials', async () => {
  const adapter = createAdapter('telegram');
  await assert.rejects(
    () => adapter.send({ briefing: sampleBriefing(), target: {} }),
    /botToken|chatId/
  );
});

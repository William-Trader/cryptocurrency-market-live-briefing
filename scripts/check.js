#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const targets = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(full);
    } else if (entry.name.endsWith('.js')) {
      targets.push(full);
    }
  }
}

walk(path.join(root, 'src'));
walk(path.join(root, 'bin'));
walk(path.join(root, 'test'));
walk(path.join(root, 'examples'));

let failed = 0;
for (const file of targets) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failed += 1;
    process.stderr.write('Syntax error: ' + path.relative(root, file) + '\n' + String(err.stderr) + '\n');
  }
}

process.stdout.write('Checked ' + targets.length + ' files, ' + failed + ' failed\n');
process.exitCode = failed === 0 ? 0 : 1;

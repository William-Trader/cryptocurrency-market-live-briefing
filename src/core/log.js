'use strict';

/**
 * Small leveled logger. Color is enabled only for TTY output and can be forced
 * with FORCE_COLOR=1 or disabled with NO_COLOR=1.
 */

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
const COLORS = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  cyan: '\u001b[36m'
};

function useColor(stream) {
  if (process.env.NO_COLOR === '1') return false;
  if (process.env.FORCE_COLOR === '1') return true;
  return Boolean(stream && stream.isTTY);
}

function createLogger(options) {
  const opts = options || {};
  const stream = opts.stream || process.stdout;
  const color = opts.color === undefined ? useColor(stream) : opts.color;
  const levelName = opts.level || process.env.LOG_LEVEL || 'info';
  const threshold = LEVELS[levelName] === undefined ? LEVELS.info : LEVELS[levelName];
  const context = opts.context || '';

  function paint(text, name) {
    if (!color) return text;
    return (COLORS[name] || '') + text + COLORS.reset;
  }

  function emit(level, message, meta) {
    if (LEVELS[level] > threshold) return;
    const stamp = new Date().toISOString().slice(11, 19);
    const tag = level.toUpperCase().padEnd(5);
    const prefix = paint(stamp + ' ' + tag, level === 'error' ? 'red' : level === 'warn' ? 'yellow' : 'dim');
    const scope = context ? paint(' [' + context + ']', 'cyan') : '';
    let line = prefix + scope + ' ' + message;
    if (meta && Object.keys(meta).length > 0) {
      line += ' ' + JSON.stringify(meta);
    }
    stream.write(line + '\n');
  }

  return {
    level: levelName,
    debug: (msg, meta) => emit('debug', msg, meta),
    info: (msg, meta) => emit('info', msg, meta),
    warn: (msg, meta) => emit('warn', msg, meta),
    error: (msg, meta) => emit('error', msg, meta),
    child: (name) => createLogger(Object.assign({}, opts, { context: context ? context + ':' + name : name }))
  };
}

const defaultLogger = createLogger();

module.exports = { createLogger, defaultLogger, LEVELS, COLORS };

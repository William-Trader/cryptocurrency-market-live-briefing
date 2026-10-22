'use strict';

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'n/a';
  if (number >= 1000) return number.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (number >= 1) return number.toFixed(2);
  if (number >= 0.01) return number.toFixed(4);
  return number.toPrecision(4);
}

function pct(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'n/a';
  return (number >= 0 ? '+' : '') + number.toFixed(2) + '%';
}

function signed(value, digits) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'n/a';
  return (number >= 0 ? '+' : '') + number.toFixed(digits === undefined ? 2 : digits);
}

function arrow(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return '=';
  return number > 0 ? '▲' : '▼';
}

function marker(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return '⚪';
  return number > 0 ? '🔴' : '🟢';
}

function clock(iso) {
  if (!iso) return 'n/a';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function relative(iso, now) {
  if (!iso) return 'n/a';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'n/a';
  const minutes = Math.max(0, Math.floor(((now || Date.now()) - then) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  return Math.floor(hours / 24) + 'd ago';
}

module.exports = { money, pct, signed, arrow, marker, clock, relative };

'use strict';

/**
 * Security helpers carried over from the v6 package:
 * AES-256-GCM secret storage, HMAC request signing, rate limiting, and log sanitizing.
 * Secrets are never written to stdout by these helpers.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SCRYPT_SALT = 'crypto-market-briefing-v2';

const SECRET_PATTERNS = [
  /(api[_-]?key|apikey)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{8,}/gi,
  /(secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{8,}/gi,
  /(authorization:\s*bearer\s+)[A-Za-z0-9_\-.]+/gi,
  /([?&](?:token|apikey|api_key|auth|signature)=)[^&\s]+/gi
];

class CryptoUtils {
  static deriveKey(password, salt) {
    const useSalt = salt || SCRYPT_SALT;
    return crypto.scryptSync(String(password), useSalt, KEY_LENGTH);
  }

  static encrypt(plaintext, password) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = this.deriveKey(password);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  }

  static decrypt(payload, password) {
    const buffer = Buffer.from(payload, 'base64');
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const data = buffer.subarray(IV_LENGTH + TAG_LENGTH);
    const key = this.deriveKey(password);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  static hash(value, algorithm) {
    return crypto.createHash(algorithm || 'sha256').update(String(value)).digest('hex');
  }

  static hmac(payload, secret, algorithm) {
    return crypto.createHmac(algorithm || 'sha256', String(secret)).update(String(payload)).digest('hex');
  }

  static signRequest(params, secret, timestamp) {
    const ts = timestamp || Date.now();
    const sorted = Object.keys(params).sort().map((key) => key + '=' + params[key]).join('&');
    const payload = sorted + '&timestamp=' + ts;
    return { payload, timestamp: ts, signature: this.hmac(payload, secret, 'sha512') };
  }

  static timingSafeEqual(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  static sanitize(text) {
    if (text === undefined || text === null) return '';
    let output = String(text);
    for (const pattern of SECRET_PATTERNS) {
      output = output.replace(pattern, (match, prefix) => (prefix ? prefix : '') + '***');
    }
    return output;
  }

  static mask(value, visible) {
    if (!value) return '';
    const keep = visible === undefined ? 4 : visible;
    const text = String(value);
    if (text.length <= keep * 2) return '***';
    return text.slice(0, keep) + '***' + text.slice(-keep);
  }
}

class KeyStore {
  constructor(filePath) {
    this.filePath = filePath || path.join(process.env.HOME || '.', '.crypto-briefing', 'keys.json');
    this.cache = null;
  }

  _load() {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      this.cache = {};
    }
    return this.cache;
  }

  _save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), { mode: 0o600 });
  }

  set(name, apiKey, apiSecret, masterPassword) {
    this._load();
    this.cache[name] = {
      apiKey: CryptoUtils.encrypt(apiKey, masterPassword),
      apiSecret: apiSecret ? CryptoUtils.encrypt(apiSecret, masterPassword) : '',
      updatedAt: new Date().toISOString()
    };
    this._save();
  }

  get(name, masterPassword) {
    const entry = this._load()[name];
    if (!entry) return null;
    return {
      apiKey: CryptoUtils.decrypt(entry.apiKey, masterPassword),
      apiSecret: entry.apiSecret ? CryptoUtils.decrypt(entry.apiSecret, masterPassword) : ''
    };
  }

  delete(name) {
    this._load();
    delete this.cache[name];
    this._save();
  }

  list() {
    return Object.keys(this._load()).map((name) => ({ name, updatedAt: this._load()[name].updatedAt }));
  }
}

class RateLimiter {
  constructor(options) {
    const opts = options || {};
    this.windowMs = opts.windowMs || 60000;
    this.maxPerWindow = opts.maxPerWindow || 60;
    this.hits = new Map();
  }

  _prune(now) {
    for (const [key, timestamps] of this.hits) {
      const kept = timestamps.filter((ts) => now - ts < this.windowMs);
      if (kept.length === 0) this.hits.delete(key);
      else this.hits.set(key, kept);
    }
  }

  acquire(key, cost) {
    const now = Date.now();
    this._prune(now);
    const bucket = this.hits.get(key) || [];
    const weight = cost === undefined ? 1 : cost;
    if (bucket.length + weight > this.maxPerWindow) {
      const waitMs = this.windowMs - (now - bucket[0]);
      return { allowed: false, waitMs: Math.max(0, waitMs) };
    }
    for (let i = 0; i < weight; i += 1) bucket.push(now);
    this.hits.set(key, bucket);
    return { allowed: true, waitMs: 0 };
  }

  async wait(key, cost) {
    let result = this.acquire(key, cost);
    while (!result.allowed) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(result.waitMs, 1000)));
      result = this.acquire(key, cost);
    }
    return true;
  }

  status() {
    const now = Date.now();
    this._prune(now);
    const output = {};
    for (const [key, timestamps] of this.hits) {
      output[key] = { used: timestamps.length, limit: this.maxPerWindow, windowMs: this.windowMs };
    }
    return output;
  }
}

module.exports = { CryptoUtils, KeyStore, RateLimiter };

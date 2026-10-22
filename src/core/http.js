'use strict';

/**
 * Minimal HTTP client built on the platform fetch implementation.
 * Adds timeouts, bounded retries, Retry-After handling, and redaction-safe errors.
 */

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_RETRIES = 2;
const USER_AGENT = 'crypto-market-briefing/2.0 (+https://github.com/)';

class HttpError extends Error {
  constructor(message, options) {
    super(message);
    this.name = 'HttpError';
    this.status = options && options.status ? options.status : 0;
    this.url = options && options.url ? options.url : '';
    this.retryable = Boolean(options && options.retryable);
  }
}

function redactUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    for (const key of Array.from(u.searchParams.keys())) {
      if (/token|key|secret|auth|signature|password/i.test(key)) {
        u.searchParams.set(key, '***');
      }
    }
    return u.toString();
  } catch (err) {
    return String(rawUrl).replace(/([?&](?:token|key|secret|auth|signature)=)[^&]+/gi, '$1***');
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(value) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return 0;
}

/**
 * Fetch JSON with retries.
 * @param {string} url
 * @param {{timeoutMs?: number, retries?: number, headers?: Record<string,string>, method?: string, body?: string, acceptStatus?: number[]}} options
 * @returns {Promise<{data: any, status: number, headers: Headers, url: string}>}
 */
async function requestJson(url, options) {
  const opts = options || {};
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const retries = opts.retries === undefined ? DEFAULT_RETRIES : opts.retries;
  const retryableStatus = new Set([408, 425, 429, 500, 502, 503, 504]);

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: opts.method || 'GET',
        headers: Object.assign({ 'User-Agent': USER_AGENT, Accept: 'application/json' }, opts.headers || {}),
        body: opts.body,
        signal: controller.signal
      });
      const status = response.status;
      const accepted = opts.acceptStatus || [];
      if (!response.ok && !accepted.includes(status)) {
        const bodyText = await response.text().catch(() => '');
        lastError = new HttpError('HTTP ' + status + ' for ' + redactUrl(url), {
          status,
          url: redactUrl(url),
          retryable: retryableStatus.has(status)
        });
        lastError.bodyPreview = bodyText.slice(0, 200);
        if (retryableStatus.has(status) && attempt < retries) {
          const waitMs = parseRetryAfter(response.headers.get('retry-after')) || Math.min(8000, 400 * Math.pow(2, attempt));
          await sleep(waitMs);
          continue;
        }
        throw lastError;
      }
      const text = await response.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (err) {
          throw new HttpError('Invalid JSON from ' + redactUrl(url), { status, url: redactUrl(url) });
        }
      }
      return { data, status, headers: response.headers, url };
    } catch (err) {
      const isAbort = err && err.name === 'AbortError';
      const wrapped = err instanceof HttpError
        ? err
        : new HttpError((isAbort ? 'Timeout after ' + timeoutMs + 'ms: ' : 'Request failed: ') + redactUrl(url), {
            url: redactUrl(url),
            retryable: true
          });
      lastError = wrapped;
      if (attempt < retries) {
        const backoff = Math.min(8000, 400 * Math.pow(2, attempt));
        await sleep(backoff);
        continue;
      }
      throw wrapped;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new HttpError('Request failed: ' + redactUrl(url), { url: redactUrl(url) });
}

module.exports = { requestJson, redactUrl, HttpError, sleep, DEFAULT_TIMEOUT_MS };

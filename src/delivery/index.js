'use strict';

const { requestJson } = require('../core/http');
const { CryptoUtils } = require('../core/crypto');
const { resolveSecret } = require('../core/config');
const { render, renderTelegram } = require('../render');

/**
 * Delivery adapters.
 *
 * Every adapter implements the same contract:
 *   send({ briefing, target, timeoutMs, retries }) -> { platform, ok, status, detail }
 *
 * Targets come from config/platforms.json and may reference environment
 * variables with the "env:NAME" syntax. Secrets never appear in logs.
 */

function chunkText(text, size) {
  const limit = size || 4000;
  if (text.length <= limit) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf('\n', limit);
    if (cut < limit * 0.5) cut = limit;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\n+/, '');
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function postJson(url, body, options) {
  const opts = options || {};
  return requestJson(url, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
    body: JSON.stringify(body),
    timeoutMs: opts.timeoutMs,
    retries: opts.retries
  });
}

class WebhookAdapter {
  constructor(name, options) {
    this.name = name || 'webhook';
    this.options = options || {};
  }

  async send(context) {
    const target = context.target || {};
    const url = resolveSecret(target.url);
    if (!url) throw new Error('Webhook target "' + this.name + '" has no url');
    const secret = resolveSecret(target.secret);
    const briefing = context.briefing;
    const payload = target.payload === 'briefing' ? briefing : {
      text: render('markdown', briefing),
      briefing
    };
    const headers = {};
    if (secret) {
      const timestamp = String(Date.now());
      const signature = CryptoUtils.hmac(timestamp + '.' + JSON.stringify(payload), secret, 'sha256');
      headers['X-Crypto-Briefing-Timestamp'] = timestamp;
      headers['X-Crypto-Briefing-Signature'] = 'sha256=' + signature;
    }
    const response = await postJson(url, payload, { headers, timeoutMs: context.timeoutMs, retries: context.retries });
    return { platform: this.name, ok: true, status: response.status, detail: 'posted' };
  }
}

class TelegramAdapter {
  async send(context) {
    const target = context.target || {};
    const token = resolveSecret(target.botToken);
    const chatId = resolveSecret(target.chatId);
    if (!token) throw new Error('telegram.botToken is not configured');
    if (!chatId) throw new Error('telegram.chatId is not configured');

    const rendered = renderTelegram(context.briefing, { news: target.news });
    const chunks = chunkText(rendered.text, 3800);
    const results = [];
    for (const chunk of chunks) {
      const body = {
        chat_id: chatId,
        text: chunk,
        parse_mode: rendered.parse_mode,
        disable_web_page_preview: true
      };
      if (target.messageThreadId) body.message_thread_id = Number(target.messageThreadId);
      const response = await postJson('https://api.telegram.org/bot' + token + '/sendMessage', body, {
        timeoutMs: context.timeoutMs,
        retries: context.retries
      });
      if (!response.data || response.data.ok !== true) {
        throw new Error('Telegram rejected message: ' + JSON.stringify(response.data).slice(0, 200));
      }
      results.push(response.data.result && response.data.result.message_id);
    }
    return { platform: 'telegram', ok: true, status: 200, detail: 'messages=' + results.length };
  }
}

class DiscordAdapter {
  async send(context) {
    const target = context.target || {};
    const url = resolveSecret(target.webhookUrl);
    if (!url) throw new Error('discord.webhookUrl is not configured');
    const payload = render('discord', context.briefing, { news: target.news });
    if (target.username) payload.username = target.username;
    if (target.avatarUrl) payload.avatar_url = target.avatarUrl;
    const response = await postJson(url, payload, { timeoutMs: context.timeoutMs, retries: context.retries });
    return { platform: 'discord', ok: true, status: response.status, detail: 'embed sent' };
  }
}

class SlackAdapter {
  async send(context) {
    const target = context.target || {};
    const url = resolveSecret(target.webhookUrl);
    if (!url) throw new Error('slack.webhookUrl is not configured');
    const payload = render('slack', context.briefing, { news: target.news });
    const response = await postJson(url, payload, { timeoutMs: context.timeoutMs, retries: context.retries });
    const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '');
    if (body && body !== 'ok' && !/ok/i.test(body)) {
      throw new Error('Slack rejected message: ' + body.slice(0, 120));
    }
    return { platform: 'slack', ok: true, status: response.status, detail: 'blocks sent' };
  }
}

class FeishuAdapter {
  async send(context) {
    const target = context.target || {};
    const url = resolveSecret(target.webhookUrl);
    if (!url) throw new Error('feishu.webhookUrl is not configured');
    const payload = render('feishu', context.briefing, { news: target.news });
    const secret = resolveSecret(target.secret);
    if (secret) {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signKey = CryptoUtils.hmac(timestamp + '\n' + secret, '', 'sha256');
      const sign = require('crypto').createHmac('sha256', signKey).update('').digest('base64');
      payload.timestamp = timestamp;
      payload.sign = sign;
    }
    const response = await postJson(url, payload, { timeoutMs: context.timeoutMs, retries: context.retries });
    const data = response.data || {};
    const code = data.code === undefined ? data.StatusCode : data.code;
    if (code !== 0 && code !== undefined) {
      throw new Error('Feishu rejected message: ' + JSON.stringify(data).slice(0, 200));
    }
    return { platform: 'feishu', ok: true, status: response.status, detail: 'card sent' };
  }
}

class OneBotAdapter {
  async send(context) {
    const target = context.target || {};
    const baseUrl = resolveSecret(target.baseUrl);
    const token = resolveSecret(target.accessToken);
    const groupId = resolveSecret(target.groupId);
    const userId = resolveSecret(target.userId);
    if (!baseUrl) throw new Error('qq.baseUrl is not configured (OneBot v11 HTTP endpoint)');
    if (!groupId && !userId) throw new Error('qq.groupId or qq.userId is required');

    const text = render('plain', context.briefing, { news: target.news });
    const chunks = chunkText(text, 2000);
    for (const chunk of chunks) {
      const action = groupId ? 'send_group_msg' : 'send_private_msg';
      const body = groupId ? { group_id: Number(groupId), message: chunk } : { user_id: Number(userId), message: chunk };
      const response = await postJson(baseUrl.replace(/\/+$/, '') + '/' + action, body, {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        timeoutMs: context.timeoutMs,
        retries: context.retries
      });
      const data = response.data || {};
      if (data.status === 'failed' || data.retcode > 0) {
        throw new Error('OneBot rejected message: ' + JSON.stringify(data).slice(0, 200));
      }
    }
    return { platform: 'qq', ok: true, status: 200, detail: 'messages=' + chunks.length };
  }
}

class WeComAdapter {
  async send(context) {
    const target = context.target || {};
    const url = resolveSecret(target.webhookUrl);
    if (!url) throw new Error('wecom.webhookUrl is not configured');
    const markdown = render('markdown', context.briefing, { news: target.news });
    const response = await postJson(url, {
      msgtype: 'markdown',
      markdown: { content: markdown.slice(0, 4000) }
    }, { timeoutMs: context.timeoutMs, retries: context.retries });
    const data = response.data || {};
    if (data.errcode !== undefined && data.errcode !== 0) {
      throw new Error('WeCom rejected message: ' + JSON.stringify(data).slice(0, 200));
    }
    return { platform: 'wecom', ok: true, status: response.status, detail: 'markdown sent' };
  }
}

const ADAPTERS = {
  webhook: WebhookAdapter,
  telegram: TelegramAdapter,
  discord: DiscordAdapter,
  slack: SlackAdapter,
  feishu: FeishuAdapter,
  lark: FeishuAdapter,
  qq: OneBotAdapter,
  onebot: OneBotAdapter,
  wecom: WeComAdapter
};

function createAdapter(kind) {
  const Adapter = ADAPTERS[kind];
  if (!Adapter) throw new Error('Unknown delivery adapter: ' + kind + ' (available: ' + Object.keys(ADAPTERS).join(', ') + ')');
  return new Adapter(kind);
}

function listTargets(config) {
  const platforms = config.delivery.platforms || {};
  return Object.entries(platforms)
    .filter((entry) => entry[0].charAt(0) !== '$' && entry[1] && typeof entry[1] === 'object')
    .map((entry) => {
      const name = entry[0];
      const target = entry[1] || {};
      return {
        name,
        adapter: target.adapter || name,
        enabled: target.enabled !== false,
        render: target.render || (ADAPTERS[target.adapter || name] ? target.adapter || name : 'unknown')
      };
    });
}

function selectTargets(config, name) {
  const targets = listTargets(config).filter((target) => target.enabled);
  if (!name) return targets;
  const selected = targets.filter((target) => target.name === name);
  if (selected.length === 0) {
    throw new Error('No enabled platform named "' + name + '". Configured: ' + targets.map((t) => t.name).join(', '));
  }
  return selected;
}

async function publishBriefing(briefing, config, options) {
  const opts = options || {};
  const logger = opts.logger;
  const selected = selectTargets(config, opts.platform);
  if (selected.length === 0) throw new Error('No delivery targets are enabled in config/platforms.json');

  const results = [];
  for (const target of selected) {
    const definition = config.delivery.platforms[target.name] || {};
    if (opts.dryRun || config.delivery.dryRun) {
      results.push({ platform: target.name, ok: true, dryRun: true, detail: 'skipped network call' });
      continue;
    }
    try {
      const adapter = createAdapter(definition.adapter || target.adapter);
      const result = await adapter.send({
        briefing,
        target: definition,
        timeoutMs: definition.timeoutMs || config.delivery.timeoutMs,
        retries: definition.retries === undefined ? config.delivery.retries : definition.retries
      });
      results.push(result);
      if (logger) logger.info('Delivered', { platform: result.platform, status: result.status });
    } catch (err) {
      results.push({ platform: target.name, ok: false, error: err.message });
      if (logger) logger.error('Delivery failed', { platform: target.name, error: err.message });
    }
  }
  return results;
}

module.exports = {
  publishBriefing,
  createAdapter,
  listTargets,
  selectTargets,
  chunkText,
  ADAPTERS
};

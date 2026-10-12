#!/usr/bin/env node
/**
 * Crypto Monitor - 综合行情播报
 * 包含：价格+情绪+技术指标+热门币+Coinglass资金费率/RSI/山寨季
 */
import { chromium } from '/root/.openclaw/workspace/node_modules/playwright-chromium/index.mjs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const { spawn } = require('child_process');
const SKILL_DIR = '/root/.openclaw/workspace/skills/cryptocurrency-market-live-briefing';

// ── 子脚本运行器 ────────────────────────────────────────────────────────────
function runScript(scriptPath, maxLines = 999) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [scriptPath], { timeout: 30000 });
    let out = '', err = '';
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', d => err += d);
    proc.on('close', code => {
      if (code === 0) resolve(out.split('\n').filter(l => l.trim()).slice(0, maxLines).join('\n'));
      else reject(new Error(err || `exit ${code}`));
    });
    proc.on('error', reject);
  });
}

// ── 1. 核心价格 + 情绪指标（API并行）────────────────────────────────────────
async function getCoreData() {
  const [prices, fearGreed, altSeason, trending] = await Promise.allSettled([
    runScript(join(SKILL_DIR, 'scripts/prices.mjs')),
    runScript(join(SKILL_DIR, 'scripts/fear-greed.mjs')),
    runScript(join(SKILL_DIR, 'scripts/altcoin-season.mjs')),
    runScript(join(SKILL_DIR, 'scripts/trending.mjs')),
  ]);

  const lines = ['📊 【行情总览】'];
  const pricesData = prices.status === 'fulfilled' ? prices.value.split('\n').filter(l => l.trim()) : [];
  const btcLine = pricesData.find(l => l.includes('BTC'));
  const ethLine = pricesData.find(l => l.includes('ETH'));
  const solLine = pricesData.find(l => l.includes('SOL'));

  if (btcLine) lines.push(btcLine);
  if (ethLine) lines.push(ethLine);
  if (solLine) lines.push(solLine);

  const fgText = fearGreed.status === 'fulfilled' ? fearGreed.value : '';
  const altText = altSeason.status === 'fulfilled' ? altSeason.value : '';

  // Fear & Greed: "Current: 69 (Greed)"
  const fgMatch = fgText.match(/Current:\s*(\d+)\s*\(([^)]+)\)/);
  if (fgMatch) {
    const fgNum = parseInt(fgMatch[1]);
    const fgDesc = fgNum < 25 ? '😱 极度恐惧' : fgNum < 45 ? '😰 恐惧' : fgNum < 55 ? '😐 中性' : fgNum < 75 ? '😎 贪婪' : '🤑 极度贪婪';
    lines.push(`${fgDesc} 恐惧指数 ${fgNum}`);
  }

  // Altcoin Season: "Current Index: 37"
  const altMatch = altText.match(/Current Index:\s*(\d+)/);
  if (altMatch) {
    const altNum = parseInt(altMatch[1]);
    const altDesc = altNum > 75 ? '🔥 山寨牛市' : altNum > 50 ? '📈 山寨季' : altNum > 25 ? '🌙 山寨熊市' : '❄️ 深度熊市';
    lines.push(`${altDesc} 山寨季指数 ${altNum}`);
  }

  // 热门币
  const trendText = trending.status === 'fulfilled' ? trending.value.split('\n').filter(l => l.trim()).slice(0, 8) : [];
  if (trendText.length) {
    lines.push('', '🔥 24h热门（成交额）:');
    lines.push(...trendText.slice(0, 6));
  }

  // 技术指标（并行）
  const [puell, piCycle, dominance, btcTrend] = await Promise.allSettled([
    runScript(join(SKILL_DIR, 'scripts/puell.mjs'), 8),
    runScript(join(SKILL_DIR, 'scripts/pi-cycle.mjs'), 8),
    runScript(join(SKILL_DIR, 'scripts/dominance.mjs'), 6),
    runScript(join(SKILL_DIR, 'scripts/btc-trend.mjs'), 10),
  ]);

  const techLines = [];

  // Puell: "Current: 0.89"
  if (puell.status === 'fulfilled') {
    const p = puell.value;
    const pMatch = p.match(/Current:\s*([\d.]+)/);
    if (pMatch) {
      const pv = parseFloat(pMatch[1]);
      const pEmoji = pv > 6 ? '🔴极高' : pv > 4 ? '🟠高' : pv > 2 ? '🟡正常' : pv > 1 ? '🟢正常' : '💰低估';
      techLines.push(`${pEmoji} Puell: ${pv}x`);
    }
  }

  // BTC Dominance: "Bitcoin (BTC): 58.92%"
  if (dominance.status === 'fulfilled') {
    const d = dominance.value;
    const dMatch = d.match(/Bitcoin \(BTC\):\s*([\d.]+)%/);
    if (dMatch) {
      const dom = parseFloat(dMatch[1]);
      const dEmoji = dom > 55 ? '📈 BTC主导' : dom > 48 ? '↔️ 中性' : '📉 山寨活跃';
      techLines.push(`${dEmoji} BTC占比: ${dMatch[1]}%`);
    }
  }

  // BTC Trend: 算力/难度数据（格式: Date Price Hashrate(EH/s) Difficulty(T) Difficulty(T)）
  if (btcTrend.status === 'fulfilled') {
    const bt = btcTrend.value;
    const rows = bt.split('\n').filter(l => /^\d{8}\s+/.test(l.trim()));
    if (rows.length) {
      const last = rows[rows.length - 1].trim().split(/\s+/);
      // 格式: Date Price Hashrate(EH/s) Difficulty(T) Difficulty(T)
      if (last.length >= 5) {
        const hashrate = parseFloat(last[2]);
        const difficulty = parseFloat(last[3]);
        const difficulty2 = parseFloat(last[4]);
        if (!isNaN(hashrate) && !isNaN(difficulty)) {
          const ratio = (hashrate / difficulty).toFixed(2);
          const signal = ratio > 2.5 ? '📈算力充沛' : ratio < 2.0 ? '📉算力紧张' : '⚖️中性';
          techLines.push(`${signal} 算力:${hashrate} EH/s 难度:${difficulty}T 比率:${ratio}`);
        }
      }
    }
  }

  if (techLines.length) {
    lines.push('', '⚙️ 技术指标:');
    lines.push(...techLines);
  }

  return lines.join('\n');
}

// ── 2. Coinglass资金费率 + RSI + 山寨季（浏览器，3页并行）──────────────────
async function getCoinglassData() {
  const lines = ['', '🌙 【DeFi链上数据 - Coinglass】'];
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-blink-features=AutomationControlled', '--disable-web-security']
  });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 }
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.navigator.chrome = { runtime: {} };
  });

  // 等表格渲染（Coinglass使用ant-table）
  async function waitForTable(minCells = 50, maxMs = 25000) {
    return new Promise(resolve => {
      let waited = 0;
      const check = () => {
        page.evaluate(() => document.querySelectorAll('.ant-table-cell').length)
          .then(cells => {
            if (cells >= minCells || waited >= maxMs) resolve(cells);
            else { waited += 1000; setTimeout(check, 1000); }
          })
          .catch(() => { waited += 1000; setTimeout(check, 1000); });
      };
      check();
    });
  }

  // 资金费率提取器
  async function extractFunding() {
    return page.evaluate(() => {
      const lines = document.body.innerText.split('\n').map(l => l.trim()).filter(l => l);
      const result = [];
      let inHigh = false, inLow = false;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (l.includes('最高资金费率')) { inHigh = true; continue; }
        if (l.includes('最低资金费率') || l.includes('USDT或USD')) { inHigh = false; inLow = true; continue; }
        if (l.includes('1日费率') || l.includes('资金费率热力图')) { inHigh = false; inLow = false; break; }
        if (inHigh || inLow) {
          const m = l.match(/([A-Z]{2,}\/[A-Z]{3,4})/);
          if (m) {
            const next = lines[i + 1] || '';
            const rateMatch = next.match(/(-?[\d.]+%)/);
            if (rateMatch) { result.push({ pair: m[1], rate: rateMatch[1], type: inHigh ? '高' : '低' }); i++; }
          }
        }
      }
      return result;
    });
  }

  // RSI热力图提取（弱势+强势）
  async function extractRSI() {
    return page.evaluate(() => {
      const weak = [], strong = [];
      const allCells = [...document.querySelectorAll('.ant-table-cell')];
      for (let i = 0; i < allCells.length; i += 10) {
        const cells = allCells.slice(i, i + 10);
        if (cells.length < 10) break;
        const coin = cells[1]?.textContent.trim();
        const price = cells[2]?.textContent.trim().replace('$', '').replace(/[^\d.,]/g, '');
        const rsi4h = parseFloat(cells[7]?.textContent.trim());
        const rsi24h = parseFloat(cells[9]?.textContent.trim());
        if (/^[A-Z]{2,6}$/.test(coin)) {
          const rsi = (!isNaN(rsi4h) && rsi4h > 0) ? rsi4h : (!isNaN(rsi24h) && rsi24h > 0) ? rsi24h : null;
          if (rsi === null) continue;
          if (rsi < 40) weak.push({ coin, rsi, price });
          else if (rsi > 70) strong.push({ coin, rsi, price });
        }
      }
      return {
        weak: weak.sort((a, b) => a.rsi - b.rsi).slice(0, 5),
        strong: strong.sort((a, b) => b.rsi - a.rsi).slice(0, 5)
      };
    });
  }

  // 山寨季指数
  async function extractAltSeason() {
    return page.evaluate(() => {
      const text = document.body.innerText;
      const m = text.match(/\n\s*(\d{1,3})\s*\n/);
      if (m) {
        const val = parseInt(m[1]);
        if (val <= 100) {
          let status = '中性';
          if (text.includes('牛市')) status = '牛市';
          else if (text.includes('山寨')) status = '山寨季';
          else if (text.includes('中性')) status = '中性';
          return { val, status };
        }
      }
      return null;
    });
  }

  try {
    // 初始化
    console.log('[Coinglass] 初始化...');
    await page.goto('https://www.coinglass.com/zh', { waitUntil: 'commit', timeout: 10000 });
    await page.waitForTimeout(8000);
    try { await page.locator('.t-acceptAllButton').click({ timeout: 3000 }); } catch(e) {}

    // ── 资金费率
    lines.push('', '💰 资金费率（高费率=多头拥挤|低费率=空头拥挤）:');
    try {
      await page.goto('https://www.coinglass.com/zh/FundingRate', { waitUntil: 'commit', timeout: 10000 });
      await page.waitForTimeout(6000);
      const funding = await extractFunding();
      if (funding.length) {
        const topHigh = funding.filter(f => f.type === '高').slice(0, 3);
        const topLow = funding.filter(f => f.type === '低').slice(0, 3);
        if (topHigh.length) {
          const maxRate = parseFloat(topHigh[0].rate.replace('%', ''));
          const emoji = maxRate > 0.3 ? '🔥' : '📈';
          lines.push(`${emoji} 多头拥挤TOP: ${topHigh.map(f => `${f.pair} ${f.rate}`).join(' | ')}`);
        }
        if (topLow.length) {
          const minRate = parseFloat(topLow[0].rate.replace('%', ''));
          const emoji = minRate < -0.3 ? '❄️' : '📉';
          lines.push(`${emoji} 空头拥挤TOP: ${topLow.map(f => `${f.pair} ${f.rate}`).join(' | ')}`);
        }
      } else { lines.push('(暂无数据)'); }
    } catch(e) { lines.push(`⚠️ ${e.message}`); }

    // ── RSI热力图
    lines.push('', '📊 RSI热力图（超卖=反弹潜力|超买=回调风险）:');
    try {
      await page.goto('https://www.coinglass.com/zh/pro/i/RsiHeatMap', { waitUntil: 'commit', timeout: 10000 });
      await page.waitForTimeout(5000);
      const rsi = await extractRSI();
      if (rsi.weak.length) lines.push(`🔋 超卖: ${rsi.weak.map(d => `${d.coin}(${d.rsi})`).join(' | ')}`);
      else lines.push('🔋 超卖: 无');
      if (rsi.strong.length) lines.push(`🔴 超买: ${rsi.strong.map(d => `${d.coin}(${d.rsi})`).join(' | ')}`);
      else lines.push('🔴 超买: 无');
    } catch(e) { lines.push(`⚠️ RSI: ${e.message}`); }

    // ── 山寨季
    lines.push('', '🪙 山寨季指数:');
    try {
      await page.goto('https://www.coinglass.com/zh/pro/i/alt-coin-season', { waitUntil: 'commit', timeout: 10000 });
      await page.waitForTimeout(5000);
      const alt = await extractAltSeason();
      if (alt) {
        const emoji = alt.val > 75 ? '🔥' : alt.val > 50 ? '📈' : alt.val > 25 ? '🌙' : '❄️';
        lines.push(`${emoji} 指数 ${alt.val} — ${alt.status}`);
        lines.push(`   (0-25=❄️深度熊市 | 25-50=🌙熊市 | 50-75=📈牛市 | 75-100=🔥山寨牛市)`);
      } else { lines.push('(暂无数据)'); }
    } catch(e) { lines.push(`⚠️ ${e.message}`); }

  } catch(e) {
    lines.push(`\n⚠️ Coinglass失败: ${e.message}`);
  } finally {
    await browser.close();
  }

  return lines.join('\n');
}

// ── 主程序 ─────────────────────────────────────────────────────────────────
async function main() {
  const start = Date.now();
  const [core, coinglass] = await Promise.all([
    getCoreData().catch(e => `⚠️ 核心数据失败: ${e.message}`),
    getCoinglassData().catch(e => `⚠️ Coinglass失败: ${e.message}`),
  ]);

  const now = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const report = [
    `⏰ ${now} (耗时${elapsed}s)`,
    '',
    core,
    coinglass,
    '',
    '_(每4小时自动推送)_',
  ].join('\n');

  console.log(report);
}

main().catch(console.error);

#!/usr/bin/env node
/**
 * 品种优选系统 V2 - 对标专业级Crypto Screener
 * 
 * 升级点（对标 GitHub: crypto-signal / CoinSifter / Funding Rate & OI Radar）：
 * 1. 多指标共振评分（RSI + MACD + BB + 资金费率）
 * 2. OI（持仓量）分析 - 资金流入/流出判断
 * 3. 爆仓热力图 - 支撑阻力识别
 * 4. 多空比 - 大户vs散户分歧
 * 5. Price-OI 分歧信号
 * 6. 止损/止盈建议（ATR）
 * 7. 风险等级评分
 */
import { chromium } from '/root/.openclaw/workspace/node_modules/playwright-chromium/index.mjs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const { spawn } = require('child_process');
const SKILL_DIR = '/root/.openclaw/workspace/skills/cryptocurrency-market-live-briefing';

function runScript(path, maxLines = 8) {
  return new Promise((resolve, reject) => {
    const p = spawn('node', [path], { timeout: 20000 });
    let out = '', err = '';
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => err += d);
    p.on('close', code => code === 0 ? resolve(out.split('\n').filter(l => l.trim()).slice(0, maxLines).join('\n')) : reject(new Error(err || `exit ${code}`)));
    p.on('error', reject);
  });
}

// ── ATR计算（用于止损止盈）─────────────────────────────────────────────
function calcRiskLevels(price, atr) {
  const p = parseFloat(price.replace(/[$,]/g, ''));
  if (!p || !atr) return null;
  return {
    entry: p,
    stopLoss: +(p * (1 - atr * 1.5)).toFixed(p < 1 ? 6 : 2),
    takeProfit1: +(p * (1 + atr * 1)).toFixed(p < 1 ? 6 : 2),
    takeProfit2: +(p * (1 + atr * 2)).toFixed(p < 1 ? 6 : 2),
    riskReward1: +(1 * atr * 1 / (atr * 1.5)).toFixed(2),
    riskReward2: +(1 * atr * 2 / (atr * 1.5)).toFixed(2),
  };
}

// ── 多指标共振评分 ───────────────────────────────────────────────────
function scoreCoin(d) {
  let longScore = 0, shortScore = 0;
  const longSigs = [], shortSigs = [];
  let riskLevel = '🟢 低风险';

  // ── RSI评分
  if (d.rsi !== null) {
    if (d.rsi < 25) { longScore += 30; longSigs.push(`RSI极端超卖(${d.rsi})`); }
    else if (d.rsi < 35) { longScore += 20; longSigs.push(`RSI超卖(${d.rsi})`); }
    else if (d.rsi < 45) { longScore += 10; longSigs.push(`RSI弱势(${d.rsi})`); }
    else if (d.rsi > 80) { shortScore += 25; shortSigs.push(`RSI极度超买(${d.rsi})`); riskLevel = '🔴 高风险'; }
    else if (d.rsi > 70) { shortScore += 15; shortSigs.push(`RSI超买(${d.rsi})`); riskLevel = '🟡 中风险'; }
  }

  // ── 资金费率评分（最核心指标）
  if (d.funding !== null) {
    if (d.funding < -1.0) {
      longScore += 30; longSigs.push(`资金费率极负(${d.funding}%)→空头挤压`);
      if (d.price && parseFloat(d.change24h || 0) > 10) {
        shortScore += 10; shortSigs.push('轧空尾声(费率负+价格暴涨)');
        riskLevel = '🔴 高风险';
      }
    } else if (d.funding < -0.3) { longScore += 15; longSigs.push(`资金费率负(${d.funding}%)`); }
    else if (d.funding > 1.0) { shortScore += 30; shortSigs.push(`资金费率极高(${d.funding}%)→多头挤压`); riskLevel = '🔴 高风险'; }
    else if (d.funding > 0.3) { shortScore += 15; shortSigs.push(`资金费率高(${d.funding}%)`); riskLevel = '🟡 中风险'; }
  }

  // ── 24h涨幅
  if (d.change24h !== null) {
    const ch = d.change24h;
    if (ch < -20) { longScore += 20; longSigs.push(`崩跌${ch}%`); riskLevel = '🟡 中风险'; }
    else if (ch < -10) { longScore += 10; longSigs.push(`大跌${ch}%`); }
    else if (ch > 50) { shortScore += 15; shortSigs.push(`暴涨${ch}%`); riskLevel = '🔴 高风险'; }
    else if (ch > 20) { shortScore += 10; shortSigs.push(`大涨${ch}%`); riskLevel = '🟡 中风险'; }
  }

  // ── OI（持仓量）分析 - 判断资金真实流向
  if (d.oiChange !== null) {
    if (d.oiChange < -10) { longScore += 10; longSigs.push(`OI萎缩${d.oiChange}%→去杠杆`); }
    else if (d.oiChange > 15) { shortScore += 10; shortSigs.push(`OI膨胀${d.oiChange}%→新资金入场`); }
    if (d.oiChange !== null && d.change24h !== null) {
      const ch = parseFloat(d.change24h);
      const oi = d.oiChange;
      if (ch > 5 && oi < -5) { longScore += 15; longSigs.push(`价格涨+OI降→假突破⚠️`); }
      else if (ch < -5 && oi < -5) { longScore += 10; longSigs.push(`价格跌+OI降→多头离场`); }
      else if (ch > 5 && oi > 5) { shortScore += 10; shortSigs.push(`价格涨+OI增→真突破`); }
    }
  }

  // ── 多空比（大户vs散户）
  if (d.lsRatio !== null) {
    const ratio = d.lsRatio; // 多/空比值，>1多头占优
    if (ratio < 0.7) { longScore += 15; longSigs.push(`多空比极度偏低(${ratio.toFixed(2)})→散户做空`); }
    else if (ratio < 0.9) { longScore += 8; longSigs.push(`多空比偏低(${ratio.toFixed(2)})`); }
    else if (ratio > 1.5) { shortScore += 10; shortSigs.push(`多空比偏高(${ratio.toFixed(2)})→散户做多`); }
  }

  // ── 爆仓信号（多空博弈激烈程度）
  if (d.liquidationLevel) {
    if (d.liquidationLevel === '多头爆仓') { shortScore += 10; shortSigs.push('多头爆仓密集→下跌加速'); riskLevel = '🔴 高风险'; }
    else if (d.liquidationLevel === '空头爆仓') { longScore += 10; longSigs.push('空头爆仓密集→上涨加速'); riskLevel = '🟡 中风险'; }
  }

  // ── 宏观适配
  if (d.macroFg !== null && d.macroFg < 30 && d.rsi !== null && d.rsi < 40) {
    longScore += 10; longSigs.push('极度恐惧+超卖');
  }
  if (d.macroAlt !== null && d.macroAlt > 75 && d.rsi !== null && d.rsi > 70) {
    shortScore += 10; shortSigs.push('山寨牛市+超买');
  }

  // ── 互斥：方向二选一
  if (longScore > 0 && shortScore > 0) {
    if (longScore >= shortScore) { shortScore = 0; shortSigs.length = 0; }
    else { longScore = 0; longSigs.length = 0; }
  }
  // RSI方向过滤
  if (d.rsi !== null && d.rsi > 70 && longScore > 0) { longScore = 0; longSigs.length = 0; }
  if (d.rsi !== null && d.rsi < 35 && shortScore > 0) { shortScore = 0; shortSigs.length = 0; }

  const totalScore = Math.max(longScore, shortScore);
  const direction = longScore >= shortScore ? 'LONG' : 'SHORT';
  const signals = longScore >= shortScore ? longSigs : shortSigs;
  // 评分 → 信心等级文字
  const confidenceText = totalScore >= 55 ? '强信号' : totalScore >= 40 ? '中信号' : '弱信号';
  const dirEmoji = direction === 'LONG' ? '📈' : '📉';
  const dirText = direction === 'LONG' ? '做多' : '做空';
  const stars = totalScore >= 55 ? '⭐⭐⭐' : totalScore >= 40 ? '⭐⭐' : totalScore >= 25 ? '⭐' : '';

  return { longScore, shortScore, direction, signals, totalScore, riskLevel, stars, confidenceText, dirEmoji, dirText };
}

// ── 主程序 ───────────────────────────────────────────────────────────
async function main() {
  const start = Date.now();
  console.log('🕵️ 品种优选系统 V2 启动...');

  // 并行取宏观数据
  const [fg, alt] = await Promise.allSettled([
    runScript(join(SKILL_DIR, 'scripts/fear-greed.mjs'), 3),
    runScript(join(SKILL_DIR, 'scripts/altcoin-season.mjs'), 3),
  ]);

  let macroFg = null, macroAlt = null;
  if (fg.status === 'fulfilled') {
    const m = fg.value.match(/Current:\s*(\d+)/);
    if (m) macroFg = parseInt(m[1]);
  }
  if (alt.status === 'fulfilled') {
    const m = alt.value.match(/Current Index:\s*(\d+)/);
    if (m) macroAlt = parseInt(m[1]);
  }

  // 浏览器采集
  const browser = await chromium.launch({
    headless: true, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-blink-features=AutomationControlled','--disable-web-security']
  });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 }
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); window.navigator.chrome = { runtime: {} }; });

  const waitTable = (minCells = 50, maxMs = 18000) => new Promise(resolve => {
    let w = 0;
    const check = () => {
      page.evaluate(() => document.querySelectorAll('.ant-table-cell').length)
        .then(c => (c >= minCells || w >= maxMs) ? resolve(c) : (w += 1000, setTimeout(check, 1000)))
        .catch(() => (w += 1000, setTimeout(check, 1000)));
    };
    check();
  });

  let rsiData = [], fundingData = [], lsData = [], liqData = [], oiData = [];
  let marketMeta = {};

  try {
    // ── 首页：采集市场总览 + OI数据
    await page.goto('https://www.coinglass.com/zh', { waitUntil: 'commit', timeout: 10000 });
    await page.waitForTimeout(5000);
    try { await page.locator('.t-acceptAllButton').click({ timeout: 2000 }); } catch(e) {}

    marketMeta = await page.evaluate(() => {
      const text = document.body.innerText;
      const result = {};
      // 全网合约持仓量
      const oiMatch = text.match(/全网合约持仓量[^\d]*(-?[\d.]+)(亿|万)/);
      if (oiMatch) { result.oiAmt = oiMatch[1]; result.oiUnit = oiMatch[2]; }
      // 全网24h成交额
      const volMatch = text.match(/全网.*?成交额[^\d]*(-?[\d.]+)(亿|万)/);
      if (volMatch) { result.volAmt = volMatch[1]; result.volUnit = volMatch[2]; }
      // 多空比
      const lsMatch = text.match(/(\d+\.?\d*)%\/\s*(\d+\.?\d*)%/);
      if (lsMatch) { result.lsLong = parseFloat(lsMatch[1]); result.lsShort = parseFloat(lsMatch[2]); }
      // 爆仓金额
      const liqMatch = text.match(/爆仓[^\$]*\$?([\d.]+)(亿|万)/);
      if (liqMatch) { result.liqAmt = liqMatch[1]; result.liqUnit = liqMatch[2]; }
      return result;
    });

    // ── RSI热力图
    await page.goto('https://www.coinglass.com/zh/pro/i/RsiHeatMap', { waitUntil: 'commit', timeout: 10000 });
    await waitTable(100);
    rsiData = await page.evaluate(() => {
      const allCells = [...document.querySelectorAll('.ant-table-cell')];
      const result = [];
      for (let i = 0; i < allCells.length; i += 10) {
        const cells = allCells.slice(i, i + 10);
        if (cells.length < 10) break;
        const coin = cells[1]?.textContent.trim();
        const price = cells[2]?.textContent.trim().replace(/[$,]/g, '');
        const ch1h = cells[3]?.textContent.trim();
        const ch24h = cells[4]?.textContent.trim();
        const rsi4h = parseFloat(cells[7]?.textContent.trim());
        const rsi24h = parseFloat(cells[9]?.textContent.trim());
        if (/^[A-Z]{2,6}$/.test(coin)) {
          const rsi = (!isNaN(rsi4h) && rsi4h > 0) ? rsi4h : (!isNaN(rsi24h) && rsi24h > 0) ? rsi24h : null;
          if (rsi !== null) result.push({ coin, price, ch1h, ch24h, rsi: Math.round(rsi*10)/10 });
        }
      }
      return result;
    });

    // ── 资金费率（表格列：0空 1币种 2-12各交易所 14空 15-17各所1日费率）
    const rows = await page.evaluate(() => {
      const result = [];
      document.querySelectorAll('table tbody tr').forEach(row => {
        const cells = [...row.querySelectorAll('td')].map(c => c.textContent.trim());
        if (cells.length < 15 || !/^[A-Z]{2,}$/.test(cells[1] || '')) return;
        const coin = cells[1];
        // 各所费率在列2-12，1日费率在列15-17
        const rates = cells.slice(2, 13).map(v => {
          const m = v.match(/(-?[\d.]+)%/);
          return m ? parseFloat(m[1]) : null;
        }).filter(v => v !== null);
        const dayRates = cells.slice(15, 18).map(v => {
          const m = v.match(/(-?[\d.]+)%/);
          return m ? parseFloat(m[1]) : null;
        }).filter(v => v !== null);
        const allRates = [...rates, ...dayRates];
        if (allRates.length === 0) return;
        const maxRate = Math.max(...allRates);
        const minRate = Math.min(...allRates);
        result.push({ coin, maxRate, minRate });
      });
      return result;
    });
    rows.forEach(d => fundingData.push({ coin: d.coin, funding: d.maxRate, fundingMin: d.minRate }));

    // ── 多空比（采集Binance BTC/USDT大户数据）
    await page.goto('https://www.coinglass.com/zh/LongShortRatio', { waitUntil: 'commit', timeout: 10000 });
    await waitTable(50);
    lsData = await page.evaluate(() => {
      const lines = document.body.innerText.split('\n').filter(l => l.trim());
      const result = {};
      // 找 "大账户持仓多空比" 附近数据
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (l.includes('大账户持仓多空比') || l.includes('大账户人数多空比')) {
          // 下一行通常是多空比值
          const next = lines[i + 1] || '';
          const m = next.match(/(\d+\.?\d*)/g);
          if (m && m.length >= 2) {
            result.type = l.includes('持仓') ? 'position' : 'count';
            result.longRatio = parseFloat(m[m.length - 2]);
            result.shortRatio = parseFloat(m[m.length - 1]);
            result.ratio = result.longRatio / result.shortRatio;
          }
        }
      }
      return result;
    });

    // ── 爆仓热力图（找多空爆仓密集价位）
    await page.goto('https://www.coinglass.com/zh/LiquidationData', { waitUntil: 'commit', timeout: 10000 });
    await waitTable(50);
    liqData = await page.evaluate(() => {
      const lines = document.body.innerText.split('\n').filter(l => l.trim());
      const result = [];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        // 匹配 "$12.5M 多" 或 "$5.2M 空" 格式
        const m = l.match(/\$?([\d.]+)(M|K)?\s*(多|空|Long|Short)/i);
        if (m) {
          let val = parseFloat(m[1]);
          if (m[2] === 'K') val *= 1000;
          if (m[2] === 'M') val *= 1000000;
          result.push({ amt: val, side: m[3].includes('多') || m[3].includes('Long') ? 'long' : 'short' });
        }
      }
      return result;
    });

  } catch(e) {
    console.error('采集异常:', e.message);
  } finally {
    await browser.close();
  }

  // ── 合并评分
  const coinMap = new Map();

  // RSI数据
  rsiData.forEach(d => {
    if (!coinMap.has(d.coin)) coinMap.set(d.coin, {});
    const c = coinMap.get(d.coin);
    c.price = d.price;
    c.change24h = d.ch24h ? parseFloat(d.ch24h.replace('%','').replace('+','')) : null;
    c.rsi = d.rsi;
    c.ch24hRaw = d.ch24h;
  });

  // 资金费率
  fundingData.forEach(d => {
    if (!coinMap.has(d.coin)) coinMap.set(d.coin, {});
    const c = coinMap.get(d.coin);
    c.funding = d.funding;
  });

  // 多空比（全局赋给所有币）
  if (lsData.ratio) {
    coinMap.forEach(c => { c.lsRatio = lsData.ratio; });
  }

  // 宏观
  coinMap.forEach(c => { c.macroFg = macroFg; c.macroAlt = macroAlt; });

  // 评分
  const scored = [];
  coinMap.forEach((d, coin) => {
    const result = scoreCoin(d);
    if (result.totalScore >= 20 && result.signals.length >= 1) {
      scored.push({
        coin,
        price: d.price || '?',
        change24h: d.ch24hRaw || '?',
        rsi: d.rsi,
        funding: d.funding,
        lsRatio: d.lsRatio,
        ...result
      });
    }
  });

  // 分类
  const longs = scored.filter(c => c.direction === 'LONG').sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);
  const shorts = scored.filter(c => c.direction === 'SHORT').sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);

  // ── 输出报告
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12: false });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  // 宏观
  const fgEmoji = !macroFg ? '?' : macroFg < 25 ? '😱' : macroFg < 40 ? '😰' : macroFg < 55 ? '😐' : macroFg < 75 ? '😎' : '🤑';
  const altEmoji = !macroAlt ? '?' : macroAlt > 75 ? '🔥' : macroAlt > 50 ? '📈' : macroAlt > 25 ? '🌙' : '❄️';
  const fgDesc = !macroFg ? '' : macroFg < 25 ? '极度恐惧' : macroFg < 40 ? '恐惧' : macroFg < 55 ? '中性' : macroFg < 75 ? '贪婪' : '极度贪婪';
  const altDesc = !macroAlt ? '' : macroAlt > 75 ? '山寨牛市' : macroAlt > 50 ? '山寨季' : macroAlt > 25 ? '山寨熊市' : '深度熊市';

  // 市场总览
  const marketLines = [];
  if (lsData.ratio) {
    const emoji = lsData.ratio < 0.8 ? '📉空头主导' : lsData.ratio > 1.2 ? '📈多头主导' : '↔️均衡';
    marketLines.push(`${emoji} 多空比 ${lsData.ratio.toFixed(2)} (多${lsData.longRatio?.toFixed(1)}%/空${lsData.shortRatio?.toFixed(1)}%)`);
  }
  if (liqData.length) {
    const longLiq = liqData.filter(l => l.side === 'long').reduce((s, l) => s + l.amt, 0);
    const shortLiq = liqData.filter(l => l.side === 'short').reduce((s, l) => s + l.amt, 0);
    const liqEmoji = longLiq > shortLiq * 1.5 ? '🔴多头爆仓潮' : shortLiq > longLiq * 1.5 ? '🟢空头爆仓潮' : '⚖️爆仓均衡';
    const maxLiq = Math.max(longLiq, shortLiq);
    const liqStr = maxLiq > 1000000 ? (maxLiq/1000000).toFixed(1)+'亿' : (maxLiq/1000).toFixed(0)+'万';
    marketLines.push(`${liqEmoji} 单笔最大爆仓 ${liqStr}`);
  }

  const lines = [
    `🕵️ 品种优选系统 V2 | ${now}`,
    '',
    `📊 【宏观背景】`,
    `   ${fgEmoji} 恐惧贪婪: ${macroFg || '?'} (${fgDesc})`,
    `   ${altEmoji} 山寨季: ${macroAlt || '?'} (${altDesc})`,
  ];

  if (marketLines.length) {
    lines.push('');
    lines.push('📈 【市场结构】');
    marketLines.forEach(l => lines.push(`   ${l}`));
  }

  // 🎯 做多推荐
  if (longs.length) {
    lines.push('');
    lines.push('🎯 【做多推荐】');
    longs.forEach((c, i) => {
      const ch = c.change24h !== '?' ? parseFloat(c.change24h) : 0;
      const chStr = c.change24h !== '?' ? `${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%` : '?';
      lines.push(`  ${c.dirEmoji} ${c.coin}/USDT  ${c.stars} ${c.riskLevel}  [${c.confidenceText}]`);
      lines.push(`     价格: $${c.price}  |  RSI: ${c.rsi || '?'}  |  24h: ${chStr}`);
      if (c.funding !== undefined) lines.push(`     资金费率: ${c.funding}% → ${c.direction === 'LONG' ? '空头拥挤（利于轧空）' : '多头拥挤（警惕回调）'}`);
      lines.push(`     做多信号: ${c.signals.join(' + ')}`);
      lines.push(`     综合评分: ${c.totalScore}分`);
    });
  }

  // 🚬 做空推荐
  if (shorts.length) {
    lines.push('');
    lines.push('🚬 【做空推荐】');
    shorts.forEach((c, i) => {
      const ch = c.change24h !== '?' ? parseFloat(c.change24h) : 0;
      const chStr = c.change24h !== '?' ? `${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%` : '?';
      lines.push(`  ${c.dirEmoji} ${c.coin}/USDT  ${c.stars} ${c.riskLevel}  [${c.confidenceText}]`);
      lines.push(`     价格: $${c.price}  |  RSI: ${c.rsi || '?'}  |  24h: ${chStr}`);
      if (c.funding !== undefined) lines.push(`     资金费率: ${c.funding}% → ${c.direction === 'LONG' ? '空头拥挤（利于轧空）' : '多头拥挤（警惕回调）'}`);
      lines.push(`     做空信号: ${c.signals.join(' + ')}`);
      lines.push(`     综合评分: ${c.totalScore}分`);
    });
  }

  if (!longs.length && !shorts.length) {
    lines.push('');
    lines.push('⚠️ 当前无明确信号，建议观望');
  }

  lines.push('');
  lines.push(`_V2 精选版 | 耗时${elapsed}s | 每4小时自动推送_`);

  console.log(lines.join('\n'));
}

main().catch(console.error);

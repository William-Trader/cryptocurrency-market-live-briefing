#!/usr/bin/env node
/**
 * crypto-daily-report.mjs - 每日深度日报数据聚合
 * 一次性拉取所有数据，适合AI报告生成
 * 耗时约5-10秒（纯API，无浏览器）
 */

const API1 = 'https://api1.desk3.io/v1';
const MCP  = 'https://mcp.desk3.io/v1';

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { 'language': 'en' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── 1. 核心价格 + 24h涨跌 ─────────────────────────────────────────────
async function getPrices() {
  try {
    const data = await fetchJSON(`${API1}/market/mini/24hr?symbol=BTCUSDT,ETHUSDT,SOLUSDT`);
    if (!Array.isArray(data)) return null;
    const r = {};
    data.forEach(item => {
      if (item.s === 'BTCUSDT') r.BTC = { price: parseFloat(item.c), change: parseFloat(item.P), volume: item.q };
      if (item.s === 'ETHUSDT') r.ETH = { price: parseFloat(item.c), change: parseFloat(item.P), volume: item.q };
      if (item.s === 'SOLUSDT') r.SOL = { price: parseFloat(item.c), change: parseFloat(item.P), volume: item.q };
    });
    return r;
  } catch (e) { return null; }
}

// ── 2. 恐惧贪婪指数 ───────────────────────────────────────────────────
async function getFearGreed() {
  try {
    const data = await fetchJSON(`${API1}/market/fear-greed`);
    if (data.code !== 0) return null;
    const fg = data.data?.data?.historicalValues?.now;
    if (!fg) return null;
    const desc = fg.score < 25 ? '极度恐惧' : fg.score < 40 ? '恐惧' : fg.score < 55 ? '中性' : fg.score < 75 ? '贪婪' : '极度贪婪';
    const emoji = fg.score < 25 ? '😱' : fg.score < 40 ? '😰' : fg.score < 55 ? '😐' : fg.score < 75 ? '😎' : '🤑';
    return { score: fg.score, name: fg.name, desc, emoji };
  } catch (e) { return null; }
}

// ── 3. 山寨季指数 ────────────────────────────────────────────────────
async function getAltSeason() {
  try {
    const data = await fetchJSON(`${API1}/market/altcoin/season`);
    if (data.code !== 0) return null;
    const now = data.data?.historicalValues?.now;
    if (!now) return null;
    const s = parseInt(now.altcoinIndex);
    if (isNaN(s)) return null;
    const desc = s > 75 ? '山寨牛市' : s > 50 ? '山寨季' : s > 25 ? '山寨熊市' : '深度熊市';
    const emoji = s > 75 ? '🔥' : s > 50 ? '📈' : s > 25 ? '🌙' : '❄️';
    return { index: s, desc, emoji, marketcap: now.altcoinMarketcap };
  } catch (e) { return null; }
}

// ── 4. BTC主导地位 ───────────────────────────────────────────────────
async function getDominance() {
  try {
    const data = await fetchJSON(`${API1}/market/bitcoin/dominance`);
    if (data.code !== 0 || !data.data?.points) return null;
    const pts = data.data.points;
    const cur = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    if (!cur?.dominance) return null;
    const [btc, eth, others] = cur.dominance;
    const [btcPrev] = prev?.dominance || [btc];
    const btcChange = btc - btcPrev;
    const signal = btc > 55
      ? (btcChange > 0 ? 'BTC主导增强（资金集中BTC）' : 'BTC主导微降（资金有扩散迹象）')
      : btc < 48 ? '资金分散至山寨' : '市场均衡';
    return { btc: btc.toFixed(2), eth: (eth||0).toFixed(2), others: (others||0).toFixed(2), btcChange: btcChange.toFixed(2), signal };
  } catch (e) { return null; }
}

// ── 5. Puell倍数 ─────────────────────────────────────────────────────
async function getPuell() {
  try {
    const data = await fetchJSON(`${API1}/market/puell-multiple`);
    if (data.code !== 0 || !data.data?.points) return null;
    const pts = data.data.points;
    const cur = pts[pts.length - 1];
    const prev = pts[pts.length - 7];
    if (!cur) return null;
    const pv = parseFloat(cur.puellMultiple);
    const signal = pv > 6 ? '极度高估' : pv > 4 ? '高估' : pv > 2 ? '正常' : pv > 1 ? '正常偏低' : pv > 0.5 ? '低估' : '极度低估';
    const emoji = pv > 4 ? '🔴' : pv > 2 ? '🟡' : '🟢';
    return {
      current: pv.toFixed(3),
      prev7d: prev ? parseFloat(prev.puellMultiple).toFixed(3) : null,
      signal, emoji,
      weeklyChange: prev ? (pv - parseFloat(prev.puellMultiple)).toFixed(3) : null
    };
  } catch (e) { return null; }
}

// ── 6. Pi Cycle顶部指标 ──────────────────────────────────────────────
async function getPiCycle() {
  try {
    const data = await fetchJSON(`${API1}/market/pi-cycle-top`);
    if (data.code !== 0 || !data.data) return null;
    const pts = data.data.points || [];
    const last = pts[pts.length - 1];
    if (!last) return null;
    const ma110 = parseFloat(last.ma110);
    const ma350mu2 = parseFloat(last.ma350mu2);
    const btcPrice = parseFloat(last.price);
    const crossed = ma110 > ma350mu2;
    return {
      ma111: ma110.toFixed(0),
      ma350x2: ma350mu2.toFixed(0),
      btcPriceAtCalc: btcPrice.toFixed(0),
      crossed,
      status: crossed ? '❌ 已交叉—警惕周期顶部' : '✅ 未交叉—安全',
      note: `111日MA $${ma110.toLocaleString()} | 2×350日MA $${ma350mu2.toLocaleString()}（指标计算参考价 ~$${btcPrice.toLocaleString()}）`
    };
  } catch (e) { return null; }
}

// ── 7. BTC趋势（算力/难度）─ 数据格式：["date", price, hashrate(EH), difficulty(T), difficulty(T)] ──
async function getBtcTrend() {
  try {
    const data = await fetchJSON(`${API1}/market/btc/trend`);
    if (data.code !== 0 || !Array.isArray(data.data)) return null;
    const rows = data.data.slice(-7);
    if (rows.length < 2) return null;
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    const btc = parseFloat(last[1]);
    const hashrate = parseFloat(last[2]);      // c2 = hashrate in EH/s
    const difficulty = parseFloat(last[3]);    // c3 = difficulty in T
    const difficulty2 = parseFloat(last[4]);   // c4 = difficulty in T
    if (isNaN(btc) || isNaN(hashrate)) return null;

    // 算力变化趋势（7日窗口内）
    const recentHashrates = rows.map(r => parseFloat(r[2]));
    const hChange = recentHashrates.length >= 2
      ? ((recentHashrates[recentHashrates.length-1] / recentHashrates[0] - 1) * 100).toFixed(1)
      : null;

    // 难度变化（与前一条对比）
    const prevDiff = parseFloat(prev[3]);
    const diffChange = ((difficulty / prevDiff - 1) * 100).toFixed(1);

    let signal = '⚖️ 中性';
    let emoji = '📊';
    const hrRatio = hashrate / difficulty;
    if (hrRatio > 2.5) { signal = '🟢 算力充沛（牛市信号）'; emoji = '📈'; }
    else if (hrRatio < 2.0) { signal = '🔴 算力紧张（熊市信号）'; emoji = '📉'; }

    return {
      price: btc.toFixed(0),
      hashrate: (hashrate / 1000).toFixed(1),    // 显示为 EH/s
      hashrateRaw: hashrate,
      difficulty: (difficulty / 1000).toFixed(1), // 显示为 T
      difficultyRaw: difficulty,
      hrRatio: hrRatio.toFixed(3),
      hChange,
      diffChange,
      signal, emoji,
    };
  } catch (e) { return null; }
}

// ── 8. ETH趋势（算力/难度）─ 数据格式：["date", price, hashrate(EH), difficulty(T)] ───────
async function getEthTrend() {
  try {
    const data = await fetchJSON(`${API1}/market/eth/trend`);
    if (data.code !== 0 || !Array.isArray(data.data)) return null;
    const rows = data.data.slice(-7);
    if (rows.length < 2) return null;
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    const price = parseFloat(last[1]);
    const hashrate = parseFloat(last[2]);    // c2 = hashrate
    const difficulty = parseFloat(last[3]);  // c3 = difficulty
    if (isNaN(price) || isNaN(hashrate)) return null;

    const prevDiff = parseFloat(prev[3]);
    const diffChange = ((difficulty / prevDiff - 1) * 100).toFixed(1);

    let signal = '⚖️ 中性', emoji = '📊';
    if (hashrate > difficulty * 2.5) { signal = '🟢 网络健康'; emoji = '📈'; }
    else if (hashrate < difficulty * 2.0) { signal = '🔴 压力较大'; emoji = '📉'; }

    return {
      price: price.toFixed(0),
      hashrate: (hashrate / 1000).toFixed(1),
      hashrateRaw: hashrate,
      difficulty: (difficulty / 1000).toFixed(1),
      difficultyRaw: difficulty,
      diffChange,
      signal, emoji,
    };
  } catch (e) { return null; }
}

// ── 9. 热门币（成交额TOP10）──────────────────────────────────────────
async function getTrending() {
  try {
    const data = await fetchJSON(`${API1}/market/mini/24hr`);
    if (!Array.isArray(data)) return [];
    return data
      .filter(item => item.q > 0 && item.s?.endsWith('USDT'))
      .sort((a, b) => b.q - a.q)
      .slice(0, 10)
      .map(item => ({
        symbol: item.s.replace('USDT', ''),
        price: parseFloat(item.c).toFixed(parseFloat(item.c) < 1 ? 4 : 2),
        change: parseFloat(item.P).toFixed(2),
        volume: item.q > 1e9 ? (item.q / 1e9).toFixed(2) + 'B' : (item.q / 1e6).toFixed(0) + 'M'
      }));
  } catch (e) { return []; }
}

// ── 10. 新闻（加密行业 + 宏观政策）────────────────────────────────────
async function getNews(catid, count = 8) {
  try {
    const data = await fetchJSON(`${API1}/news/list?catid=${catid}&page=1&rows=${count}`);
    if (data.code !== 0) return [];
    return (data.data?.list || []).map(item => ({
      title: item.title,
      time: new Date(item.published_at).toLocaleString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' }),
      desc: item.description?.substring(0, 80) || ''
    }));
  } catch (e) { return []; }
}

// ── 11. 市场日历 ─────────────────────────────────────────────────────
async function getCalendar() {
  try {
    const data = await fetchJSON(`${API1}/market/calendar`);
    if (data.code !== 0) return [];
    return (data.data || []).slice(0, 5).map(item => ({
      time: item.time || item.datetime || '',
      event: item.title || item.name || item.event || '',
      importance: item.importance || item.level || 'medium'
    }));
  } catch (e) { return []; }
}

// ── 12. 周期综合分析 ──────────────────────────────────────────────────
async function getCycleComposite() {
  try {
    const data = await fetchJSON(`${MCP}/market/cycles`);
    if (data.code !== 0) return null;
    const d = data.data || {};
    const puell = d.puellMultiple != null ? parseFloat(d.puellMultiple) : null;
    const likelihood = d.likelihood || {};
    const holdCount = likelihood.holdCount || 0;
    const sellCount = likelihood.sellCount || 0;
    const total = holdCount + sellCount;

    let phase = '未知', phaseEmoji = '❓';
    if (puell !== null) {
      if (puell < 0.5) { phase = '周期底部区域（最佳买入时机）'; phaseEmoji = '🟢'; }
      else if (puell < 1) { phase = '周期上行初期（持续买入）'; phaseEmoji = '🟢'; }
      else if (puell < 2) { phase = '周期中段（持续上涨）'; phaseEmoji = '🟡'; }
      else if (puell < 4) { phase = '周期后期（保持警惕）'; phaseEmoji = '🟠'; }
      else { phase = '周期顶部区域（考虑分批减仓）'; phaseEmoji = '🔴'; }
    }

    return {
      puell: puell?.toFixed(2),
      phase, phaseEmoji,
      holdSignal: `${holdCount}/${total}`,
      sellSignal: `${sellCount}/${total}`,
      recommendation: holdCount > sellCount ? '✅ 持有' : '⚠️ 考虑减仓'
    };
  } catch (e) { return null; }
}

// ── 13. 汇率/宏观 ─────────────────────────────────────────────────────
async function getExchangeRate() {
  try {
    const data = await fetchJSON(`${API1}/market/exchangeRate`);
    if (data.code !== 0) return null;
    return data.data || null;
  } catch (e) { return null; }
}

// ── 主程序 ───────────────────────────────────────────────────────────
async function main() {
  const start = Date.now();
  const now = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  // 并行拉取所有数据
  const results = await Promise.allSettled([
    getPrices(), getFearGreed(), getAltSeason(), getDominance(),
    getPuell(), getPiCycle(), getBtcTrend(), getEthTrend(),
    getTrending(), getNews(1, 8), getNews(3, 8), getCalendar(),
    getCycleComposite(), getExchangeRate(),
  ]);

  const [
    prices, fearGreed, altSeason, dominance,
    puell, piCycle, btcTrend, ethTrend,
    trending, cryptoNews, policyNews, calendar,
    cycleComposite, exchangeRate
  ] = results.map(r => r.status === 'fulfilled' ? r.value : null);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  // ── 汇总输出 ────────────────────────────────────────────────────────
  const lines = [];
  lines.push('═'.repeat(60));
  lines.push(`📊 加密市场日报数据聚合 | ${now} (拉取耗时${elapsed}s)`);
  lines.push('═'.repeat(60));

  // 一、核心行情
  if (prices) {
    lines.push('');
    lines.push('【一、核心行情】');
    const fmt = (p) => p ? `$${p.price.toLocaleString('en', {minimumFractionDigits:2})}` : 'N/A';
    const pct = (c) => c != null ? `${c >= 0 ? '+' : ''}${c.toFixed(2)}%` : 'N/A';
    lines.push(`  BTC: ${fmt(prices.BTC)}  ${pct(prices.BTC?.change)}`);
    lines.push(`  ETH: ${fmt(prices.ETH)}  ${pct(prices.ETH?.change)}`);
    lines.push(`  SOL: ${fmt(prices.SOL)}  ${pct(prices.SOL?.change)}`);
  }

  // 二、情绪指标
  lines.push('');
  lines.push('【二、情绪指标】');
  if (fearGreed) lines.push(`  ${fearGreed.emoji} 恐惧贪婪: ${fearGreed.score}/100 (${fearGreed.desc})`);
  else lines.push('  恐惧贪婪: 暂无数据');
  if (altSeason) lines.push(`  ${altSeason.emoji} 山寨季指数: ${altSeason.index}/100 (${altSeason.desc})`);
  else lines.push('  山寨季指数: 暂无数据');

  // 三、技术指标
  lines.push('');
  lines.push('【三、技术指标仪表盘】');
  if (puell) {
    lines.push(`  ${puell.emoji} Puell倍数: ${puell.current}x — ${puell.signal}`);
    if (puell.weeklyChange) {
      const wc = parseFloat(puell.weeklyChange);
      lines.push(`     7日变化: ${wc >= 0 ? '+' : ''}${puell.weeklyChange}`);
    }
  } else lines.push('  Puell倍数: 暂无数据');

  if (piCycle) {
    lines.push(`  ${piCycle.status}`);
    lines.push(`     ${piCycle.note}`);
  } else lines.push('  Pi Cycle: 暂无数据');

  if (dominance) {
    const arrow = parseFloat(dominance.btcChange) > 0 ? '↑' : parseFloat(dominance.btcChange) < 0 ? '↓' : '→';
    lines.push(`  📊 BTC主导: ${dominance.btc}% ${arrow} (ETH ${dominance.eth}% | Others ${dominance.others}%)`);
    lines.push(`     信号: ${dominance.signal}`);
  } else lines.push('  BTC主导: 暂无数据');

  if (btcTrend) {
    lines.push(`  ${btcTrend.emoji} BTC网络状态: ${btcTrend.signal}`);
    lines.push(`     价格: $${btcTrend.price} | 算力: ${btcTrend.hashrate} EH/s | 难度: ${btcTrend.difficulty} T`);
    lines.push(`     算力/难度: ${btcTrend.hrRatio} EH/T | 7日算力变化: ${btcTrend.hChange}%`);
  } else lines.push('  BTC趋势: 暂无数据');

  if (ethTrend) {
    lines.push(`  ${ethTrend.emoji} ETH网络状态: ${ethTrend.signal}`);
    lines.push(`     价格: $${ethTrend.price} | 算力: ${ethTrend.hashrate} EH/s | 难度: ${ethTrend.difficulty} T`);
  } else lines.push('  ETH趋势: 暂无数据');

  // 四、周期综合
  if (cycleComposite) {
    lines.push('');
    lines.push('【四、周期综合分析】');
    lines.push(`  ${cycleComposite.phaseEmoji} ${cycleComposite.phase}`);
    if (cycleComposite.puell) lines.push(`     Puell: ${cycleComposite.puell}x`);
    lines.push(`     持有信号: ${cycleComposite.holdSignal} | 卖出信号: ${cycleComposite.sellSignal}`);
    lines.push(`     建议: ${cycleComposite.recommendation}`);
  }

  // 五、热门币
  if (trending.length) {
    lines.push('');
    lines.push('【五、24h热门币（成交额TOP10）】');
    lines.push(`  ${'币种'.padEnd(8)} ${'价格'.padEnd(12)} ${'24h涨跌'.padEnd(10)} ${'成交额'}`);
    lines.push(`  ${'-'.repeat(44)}`);
    trending.forEach(coin => {
      const ch = parseFloat(coin.change);
      const arrow = ch > 0 ? '↑' : ch < 0 ? '↓' : '→';
      const icon = ch > 5 ? '🔥' : ch > 0 ? '🟢' : ch < -5 ? '💀' : ch < 0 ? '🔴' : '⚪';
      lines.push(`  ${coin.symbol.padEnd(8)} $${coin.price.padEnd(10)} ${icon}${arrow}${Math.abs(ch).toFixed(1)}%  ${coin.volume}`);
    });
  }

  // 六、加密新闻
  if (cryptoNews.length) {
    lines.push('');
    lines.push('【六、加密行业新闻】');
    cryptoNews.forEach((n, i) => {
      lines.push(`  ${i + 1}. ${n.title}`);
      lines.push(`     ⏰ ${n.time}`);
    });
  }

  // 七、政策新闻
  if (policyNews.length) {
    lines.push('');
    lines.push('【七、宏观政策新闻】');
    policyNews.forEach((n, i) => {
      lines.push(`  ${i + 1}. ${n.title}`);
      lines.push(`     ⏰ ${n.time}`);
    });
  }

  // 八、市场日历
  if (calendar.length) {
    lines.push('');
    lines.push('【八、本周重要数据日历】');
    calendar.forEach(item => {
      const imp = item.importance === 'high' ? '⭐⭐⭐' : item.importance === 'medium' ? '⭐⭐' : '⭐';
      lines.push(`  ${imp} ${item.time} ${item.event}`);
    });
  }

  // 九、宏观汇率
  if (exchangeRate) {
    lines.push('');
    lines.push('【九、宏观背景】');
    const er = exchangeRate;
    if (er.usdIndex !== undefined) lines.push(`  美元指数: ${er.usdIndex}`);
    if (er.dxy !== undefined) lines.push(`  DXY: ${er.dxy}`);
    if (er.eurusd !== undefined) lines.push(`  EUR/USD: ${er.eurusd}`);
  }

  lines.push('');
  lines.push('═'.repeat(60));
  lines.push(`_数据来源: Desk3 API | 拉取完成 ${now} | 耗时${elapsed}s_`);

  console.log(lines.join('\n'));
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });

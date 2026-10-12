#!/usr/bin/env node
/**
 * Get Core Prices - BTC/ETH/SOL prices and percentage changes
 */
const BASE_URL = 'https://api1.desk3.io/v1/market/price';

async function getPrices() {
  try {
    // 获取24h涨跌数据（这个能正常返回数组）
    const miniResponse = await fetch(`https://api1.desk3.io/v1/market/mini/24hr?symbol=BTCUSDT,ETHUSDT,SOLUSDT`, {
      headers: { 'language': 'en' }
    });
    const miniData = await miniResponse.json();

    const prices = {}, changes = {};
    if (Array.isArray(miniData)) {
      miniData.forEach(item => {
        if (item.s === 'BTCUSDT') { prices.BTC = parseFloat(item.c); changes.BTC = parseFloat(item.P); }
        if (item.s === 'ETHUSDT') { prices.ETH = parseFloat(item.c); changes.ETH = parseFloat(item.P); }
        if (item.s === 'SOLUSDT') { prices.SOL = parseFloat(item.c); changes.SOL = parseFloat(item.P); }
      });
    }

    console.log('\n📊 Core Prices\n' + '='.repeat(50));
    const fmt = (n) => n != null ? '$' + n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A';
    const pct = (n) => n != null ? (n >= 0 ? '+' : '') + n.toFixed(2) + '%' : 'N/A';
    console.log(`BTC: ${fmt(prices.BTC)} (${pct(changes.BTC)})`);
    console.log(`ETH: ${fmt(prices.ETH)} (${pct(changes.ETH)})`);
    console.log(`SOL: ${fmt(prices.SOL)} (${pct(changes.SOL)})`);
    console.log('='.repeat(50));
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

getPrices();

#!/usr/bin/env node

/**
 * Get ETH Trend Data
 */

const BASE_URL = 'https://mcp.desk3.io/v1/market/eth/trend';

async function getETHTrend() {
  try {
    const response = await fetch(BASE_URL, {
      headers: { 'language': 'en' }
    });
    const data = await response.json();
    
    if (data.code !== 0 || !data.data) {
      console.error('API returned error');
      return null;
    }
    
    const trends = data.data.slice(-10); // Last 10 entries
    
    console.log('\n📈 ETH Trend Data\n' + '='.repeat(50));
    console.log(`${'Date'.padEnd(10)} ${'Price'.padEnd(14)} ${'Hashrate(EH/s)'.padEnd(18)} ${'Difficulty(T)'}`);
    console.log('-'.repeat(60));
    
    trends.forEach(item => {
      const date = item[0];
      const price = item[1] ? `$${parseFloat(item[1]).toLocaleString()}` : 'N/A';
      const hashrate = item[2] ? `${(parseFloat(item[2])/1000).toFixed(1)} EH/s` : 'N/A';
      const difficulty = item[3] ? `${(parseFloat(item[3])/1000).toFixed(1)} T` : 'N/A';
      
      console.log(`${date.padEnd(10)} ${price.padEnd(14)} ${hashrate.padEnd(18)} ${difficulty}`);
    });
    
    console.log('='.repeat(60));
    return data.data;
  } catch (error) {
    console.error('Failed to fetch ETH trend:', error.message);
    return null;
  }
}

getETHTrend();

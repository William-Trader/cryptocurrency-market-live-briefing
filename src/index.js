'use strict';

const { loadConfig, describeConfig } = require('./core/config');
const { createLogger } = require('./core/log');
const { Desk3Client } = require('./data/desk3');
const { BinanceClient } = require('./data/binance');
const { CryptoPanicClient } = require('./data/cryptopanic');
const { NewsIntelligenceSystem } = require('./news/system');
const { MarketMonitor } = require('./market/monitor');
const { BriefingBuilder } = require('./briefing');
const { publishBriefing, listTargets } = require('./delivery');
const { render } = require('./render');

function createSystem(options) {
  const opts = options || {};
  const config = opts.config || loadConfig();
  const logger = opts.logger || createLogger({ level: config.logging.level });

  const desk3 = new Desk3Client(config, logger);
  const binance = new BinanceClient(config);
  const cryptopanic = new CryptoPanicClient(config);

  const news = new NewsIntelligenceSystem({
    config,
    logger,
    desk3,
    cryptopanic
  });
  const market = new MarketMonitor({ config, logger, desk3, binance });
  const briefing = new BriefingBuilder({ config, logger, marketMonitor: market, newsSystem: news });

  return { config, logger, desk3, binance, cryptopanic, news, market, briefing, publishBriefing, listTargets, render };
}

module.exports = { createSystem, loadConfig, describeConfig, render };

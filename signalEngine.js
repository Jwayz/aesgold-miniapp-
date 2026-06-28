// ============================================================
//  Signal Engine — AI Technical Analysis for XAU/USD
// ============================================================

const https = require('https');
const { RSI, MACD, BollingerBands, EMA, SMA } = require('technicalindicators');

// ── Price Fetcher ─────────────────────────────────────────────
// Uses multiple free fallback sources for XAU/USD price
class GoldSignalEngine {
  constructor() {
    this._priceCache = null;
    this._cacheTime = 0;
    this._historyCache = null;
    this._historyCacheTime = 0;
    this.CACHE_TTL = 30_000;       // 30s price cache
    this.HISTORY_CACHE_TTL = 300_000; // 5min history cache
  }

  // ── Live Price ─────────────────────────────────────────────
  async getLivePrice() {
    if (this._priceCache && Date.now() - this._cacheTime < this.CACHE_TTL) {
      return this._priceCache;
    }

    // Try multiple free APIs in sequence
    const sources = [
      () => this._fetchFromMetalsAPI(),
      () => this._fetchFromExchangeRate(),
      () => this._fetchSimulated(), // final fallback for demo
    ];

    let lastErr;
    for (const source of sources) {
      try {
        const price = await source();
        this._priceCache = price;
        this._cacheTime = Date.now();
        return price;
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(`All price sources failed: ${lastErr.message}`);
  }

  // Primary: metals-api.com (free tier: 50 req/month)
  _fetchFromMetalsAPI() {
    const key = process.env.METALS_API_KEY || '';
    if (!key) throw new Error('No METALS_API_KEY');
    return this._httpGet(`https://metals-api.com/api/latest?access_key=${key}&base=USD&symbols=XAU`)
      .then(data => {
        if (!data.success) throw new Error(data.error?.info || 'Metals API error');
        const xauPerUsd = data.rates.XAU; // oz per dollar
        const price = 1 / xauPerUsd;      // dollars per oz
        return { price, bid: price - 0.50, ask: price + 0.50, change: 0, changePct: 0, high: price * 1.005, low: price * 0.995 };
      });
  }

  // Fallback: exchangerate.host (free, no key needed)
  _fetchFromExchangeRate() {
    return this._httpGet('https://api.exchangerate.host/convert?from=XAU&to=USD&amount=1')
      .then(data => {
        if (!data.success) throw new Error('ExchangeRate error');
        const price = data.result;
        return { price, bid: price - 0.40, ask: price + 0.40, change: 0, changePct: 0, high: price * 1.004, low: price * 0.996 };
      });
  }

  // Demo fallback when no API keys configured
  _fetchSimulated() {
    const BASE = 3241.80;
    const noise = (Math.random() - 0.5) * 8;
    const price = parseFloat((BASE + noise).toFixed(2));
    const change = parseFloat((noise).toFixed(2));
    return Promise.resolve({
      price,
      bid: price - 0.45,
      ask: price + 0.45,
      change,
      changePct: parseFloat((change / BASE * 100).toFixed(3)),
      high: price + Math.abs(noise) * 1.5,
      low: price - Math.abs(noise) * 1.5,
      simulated: true,
    });
  }

  // ── Historical OHLCV ───────────────────────────────────────
  async getHistory(days = 90) {
    if (this._historyCache && Date.now() - this._historyCacheTime < this.HISTORY_CACHE_TTL) {
      return this._historyCache;
    }

    // Try Yahoo Finance (unofficial, free)
    try {
      const end = Math.floor(Date.now() / 1000);
      const start = end - days * 86400;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&period1=${start}&period2=${end}`;
      const data = await this._httpGet(url);
      const result = data.chart.result[0];
      const closes = result.indicators.quote[0].close;
      const highs = result.indicators.quote[0].high;
      const lows = result.indicators.quote[0].low;
      const history = closes.map((c, i) => ({ close: c || closes[i-1] || 3200, high: highs[i], low: lows[i] }))
                           .filter(d => d.close != null);
      this._historyCache = history;
      this._historyCacheTime = Date.now();
      return history;
    } catch (_) {
      // Return simulated history for demo purposes
      return this._simulateHistory(days);
    }
  }

  _simulateHistory(days) {
    const data = [];
    let price = 3100;
    for (let i = 0; i < days; i++) {
      price += (Math.random() - 0.47) * 8;
      data.push({ close: parseFloat(price.toFixed(2)), high: price + 4, low: price - 4 });
    }
    return data;
  }

  // ── Full Signal ────────────────────────────────────────────
  async getSignal() {
    const [priceData, history] = await Promise.all([this.getLivePrice(), this.getHistory()]);
    const closes = history.map(d => d.close);
    const highs = history.map(d => d.high);
    const lows = history.map(d => d.low);
    const current = priceData.price;

    const indicators = [];

    // 1. RSI (14)
    const rsiValues = RSI.calculate({ values: closes, period: 14 });
    const rsi = rsiValues[rsiValues.length - 1];
    const prevRsi = rsiValues[rsiValues.length - 2];
    let rsiSignal, rsiReason;
    if (rsi < 30) { rsiSignal = 'BUY'; rsiReason = `Oversold at ${rsi.toFixed(1)}`; }
    else if (rsi > 70) { rsiSignal = 'SELL'; rsiReason = `Overbought at ${rsi.toFixed(1)}`; }
    else if (rsi < 45 && rsi > prevRsi) { rsiSignal = 'BUY'; rsiReason = `Rising from low zone (${rsi.toFixed(1)})`; }
    else if (rsi > 55 && rsi < prevRsi) { rsiSignal = 'SELL'; rsiReason = `Falling from high zone (${rsi.toFixed(1)})`; }
    else { rsiSignal = 'HOLD'; rsiReason = `Neutral at ${rsi.toFixed(1)}`; }
    indicators.push({ name: 'RSI (14)', signal: rsiSignal, reason: rsiReason, value: rsi });

    // 2. MACD (12,26,9)
    const macdValues = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
    const macd = macdValues[macdValues.length - 1];
    const prevMacd = macdValues[macdValues.length - 2];
    let macdSignal, macdReason;
    if (macd && prevMacd) {
      const crossingUp = macd.MACD > macd.signal && prevMacd.MACD <= prevMacd.signal;
      const crossingDown = macd.MACD < macd.signal && prevMacd.MACD >= prevMacd.signal;
      if (crossingUp) { macdSignal = 'BUY'; macdReason = 'Bullish crossover detected'; }
      else if (crossingDown) { macdSignal = 'SELL'; macdReason = 'Bearish crossover detected'; }
      else if (macd.MACD > macd.signal) { macdSignal = 'BUY'; macdReason = `MACD above signal line (+${(macd.MACD - macd.signal).toFixed(2)})`; }
      else { macdSignal = 'SELL'; macdReason = `MACD below signal line (${(macd.MACD - macd.signal).toFixed(2)})`; }
    } else {
      macdSignal = 'HOLD'; macdReason = 'Insufficient data';
    }
    indicators.push({ name: 'MACD (12/26/9)', signal: macdSignal, reason: macdReason });

    // 3. Bollinger Bands (20, 2)
    const bbValues = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 });
    const bb = bbValues[bbValues.length - 1];
    let bbSignal, bbReason;
    if (bb) {
      const bbPct = (current - bb.lower) / (bb.upper - bb.lower);
      if (current < bb.lower) { bbSignal = 'BUY'; bbReason = `Below lower band — oversold`; }
      else if (current > bb.upper) { bbSignal = 'SELL'; bbReason = `Above upper band — overbought`; }
      else if (bbPct < 0.3) { bbSignal = 'BUY'; bbReason = `Near lower band (${(bbPct * 100).toFixed(0)}% of range)`; }
      else if (bbPct > 0.7) { bbSignal = 'SELL'; bbReason = `Near upper band (${(bbPct * 100).toFixed(0)}% of range)`; }
      else { bbSignal = 'HOLD'; bbReason = `Mid-band, range: $${bb.lower.toFixed(0)}–$${bb.upper.toFixed(0)}`; }
    } else {
      bbSignal = 'HOLD'; bbReason = 'Insufficient data';
    }
    indicators.push({ name: 'Bollinger Bands (20,2)', signal: bbSignal, reason: bbReason });

    // 4. EMA Cross (50/200)
    const ema50 = EMA.calculate({ values: closes, period: 50 });
    const ema200 = EMA.calculate({ values: closes, period: 200 });
    let emaSignal, emaReason;
    if (ema50.length > 0 && ema200.length > 0) {
      const e50 = ema50[ema50.length - 1];
      const e200 = ema200[ema200.length - 1];
      const gap = ((e50 - e200) / e200 * 100).toFixed(2);
      if (e50 > e200) { emaSignal = 'BUY'; emaReason = `Golden cross — EMA50 > EMA200 (+${gap}%)`; }
      else { emaSignal = 'SELL'; emaReason = `Death cross — EMA50 < EMA200 (${gap}%)`; }
    } else {
      emaSignal = 'HOLD'; emaReason = 'Need more data';
    }
    indicators.push({ name: 'EMA Cross (50/200)', signal: emaSignal, reason: emaReason });

    // 5. Price vs SMA20
    const sma20 = SMA.calculate({ values: closes, period: 20 });
    const sma = sma20[sma20.length - 1];
    let smaSignal, smaReason;
    const smaDiff = ((current - sma) / sma * 100).toFixed(2);
    if (current > sma * 1.02) { smaSignal = 'SELL'; smaReason = `Price ${smaDiff}% above SMA20 — extended`; }
    else if (current < sma * 0.98) { smaSignal = 'BUY'; smaReason = `Price ${smaDiff}% below SMA20 — dip`; }
    else if (current > sma) { smaSignal = 'BUY'; smaReason = `Price above SMA20 (+${smaDiff}%)`; }
    else { smaSignal = 'SELL'; smaReason = `Price below SMA20 (${smaDiff}%)`; }
    indicators.push({ name: 'SMA20 Trend', signal: smaSignal, reason: smaReason });

    // ── Consensus ──────────────────────────────────────────────
    const weights = { RSI: 2, MACD: 2.5, Bollinger: 1.5, EMA: 2, SMA20: 1 };
    const wKeys = ['RSI (14)', 'MACD (12/26/9)', 'Bollinger Bands (20,2)', 'EMA Cross (50/200)', 'SMA20 Trend'];
    const wVals = [weights.RSI, weights.MACD, weights.Bollinger, weights.EMA, weights.SMA20];

    let buyScore = 0, sellScore = 0, totalWeight = 0;
    indicators.forEach((ind, i) => {
      const w = wVals[i];
      totalWeight += w;
      if (ind.signal === 'BUY') buyScore += w;
      else if (ind.signal === 'SELL') sellScore += w;
    });

    let consensus, confidence;
    if (buyScore > sellScore) {
      consensus = 'BUY';
      confidence = Math.round((buyScore / totalWeight) * 100);
    } else if (sellScore > buyScore) {
      consensus = 'SELL';
      confidence = Math.round((sellScore / totalWeight) * 100);
    } else {
      consensus = 'HOLD';
      confidence = 50;
    }

    // Suggested levels
    const atr = this._calcATR(highs, lows, closes, 14);
    const entryPrice = priceData.ask;
    const stopLoss = consensus === 'BUY'
      ? parseFloat((entryPrice - atr * 1.5).toFixed(2))
      : parseFloat((entryPrice + atr * 1.5).toFixed(2));
    const target = consensus === 'BUY'
      ? parseFloat((entryPrice + atr * 2.5).toFixed(2))
      : parseFloat((entryPrice - atr * 2.5).toFixed(2));

    return {
      price: current,
      priceData,
      indicators,
      consensus: { signal: consensus, confidence },
      levels: { entry: entryPrice, stopLoss, target, atr: parseFloat(atr.toFixed(2)) },
      timestamp: new Date().toISOString(),
    };
  }

  async getFullAnalysis() {
    const signal = await this.getSignal();
    return { ...signal, price: signal.price };
  }

  // ── ATR (Average True Range) ───────────────────────────────
  _calcATR(highs, lows, closes, period = 14) {
    if (closes.length < period + 1) return 10;
    const trs = [];
    for (let i = 1; i < closes.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trs.push(tr);
    }
    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  // ── HTTP Helper ────────────────────────────────────────────
  _httpGet(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { headers: { 'User-Agent': 'AutoGoldBot/1.0' } }, res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
        });
      });
      req.on('error', reject);
      req.setTimeout(8000, () => { req.destroy(); reject(new Error('Request timeout')); });
    });
  }
}

module.exports = GoldSignalEngine;

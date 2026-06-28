// ============================================================
//  Utilities — Formatting helpers
// ============================================================

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '$–';
  return '$' + Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(pct) {
  if (pct === null || pct === undefined) return '–%';
  return pct.toFixed(2) + '%';
}

function formatSignal(signal, riskLevel = 2) {
  const { consensus, levels, indicators, price, priceData } = signal;
  const icon = consensus.signal === 'BUY' ? '🟢' : consensus.signal === 'SELL' ? '🔴' : '🟡';
  const strengthLabel = consensus.confidence >= 85 ? 'STRONG' : consensus.confidence >= 70 ? 'MODERATE' : 'WEAK';
  const riskPcts = [1, 1.5, 2, 3, 5];
  const riskPct = riskPcts[riskLevel - 1];

  const bullish = indicators.filter(i => i.signal === 'BUY').length;
  const bearish = indicators.filter(i => i.signal === 'SELL').length;
  const neutral = indicators.filter(i => i.signal === 'HOLD').length;

  let text = `${icon} *${strengthLabel} ${consensus.signal} SIGNAL* — ${consensus.confidence}% confidence\n\n`;
  text += `🏅 *XAU/USD:* $${price.toFixed(2)}`;
  if (priceData?.simulated) text += ' _(simulated)_';
  text += '\n\n';

  text += `📊 *Indicators:* ✅ ${bullish} bullish | ❌ ${bearish} bearish | ⚪ ${neutral} neutral\n\n`;

  if (consensus.signal !== 'HOLD') {
    text += `📌 *Trade levels:*\n`;
    text += `Entry: $${levels.entry.toFixed(2)}\n`;
    text += `Stop loss: $${levels.stopLoss.toFixed(2)} (ATR-based)\n`;
    text += `Target: $${levels.target.toFixed(2)}\n`;
    text += `ATR: $${levels.atr}\n\n`;
    text += `⚠️ *Risk at ${riskPct}% of balance:* See /portfolio for your max position size\n`;
  }

  if (consensus.confidence < 70) {
    text += `\n💡 _Low confidence — consider waiting for a stronger signal_`;
  }

  text += `\n\n_${new Date().toLocaleString()} · /analysis for full breakdown_`;
  return text;
}

module.exports = { formatCurrency, formatPercent, formatSignal };

// ============================================================
//  AESGold_bot — Main Entry Point
//  Telegram: https://t.me/AESGold_bot
//  v2.0.0 — rewritten with bot identity & inline keyboards
// ============================================================

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const GoldSignalEngine = require('./signalEngine');
const Portfolio = require('./portfolio');
const { formatCurrency, formatPercent, formatSignal } = require('./utils');

// ── Bot Identity ──────────────────────────────────────────────
const BOT_USERNAME = 'AESGold_bot';
const BOT_LINK     = 'https://t.me/AESGold_bot';
const BOT_NAME     = '🏅 AESGold Bot';

// ── Config from .env ──────────────────────────────────────────
const TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_TELEGRAM_ID);

if (!TOKEN) {
  console.error('❌  Missing TELEGRAM_BOT_TOKEN in .env');
  console.error('    Copy .env.example to .env and add your token.');
  process.exit(1);
}
if (!OWNER_ID) {
  console.error('❌  Missing OWNER_TELEGRAM_ID in .env');
  console.error('    Get your ID from @userinfobot on Telegram.');
  process.exit(1);
}

const bot       = new TelegramBot(TOKEN, { polling: true });
const engine    = new GoldSignalEngine();
const portfolio = new Portfolio();

// ── Security guard — owner-only ───────────────────────────────
function isOwner(msg) {
  return msg.from && msg.from.id === OWNER_ID;
}
function guard(msg, cb) {
  if (!isOwner(msg)) {
    bot.sendMessage(msg.chat.id,
      `🚫 *${BOT_NAME}* is a private bot.\n\n_Access restricted to its owner._`,
      { parse_mode: 'Markdown' });
    return;
  }
  cb();
}

// ── Inline keyboard helpers ───────────────────────────────────
const MAIN_KEYBOARD = {
  inline_keyboard: [
    [
      { text: '📊 Signal',    callback_data: 'cmd_signal'   },
      { text: '💰 Price',     callback_data: 'cmd_price'    },
      { text: '🔍 Analysis',  callback_data: 'cmd_analysis' },
    ],
    [
      { text: '💼 Portfolio', callback_data: 'cmd_portfolio' },
      { text: '📋 History',   callback_data: 'cmd_history'  },
      { text: '📈 Stats',     callback_data: 'cmd_stats'    },
    ],
    [
      { text: '⚙️ Status',   callback_data: 'cmd_status'   },
      { text: '📖 Help',     callback_data: 'cmd_help'     },
    ],
  ],
};

const ALERT_KEYBOARD = (on) => ({
  inline_keyboard: [[
    { text: on ? '🔔 Alerts: ON ✓' : '🔔 Alerts: ON',  callback_data: 'alerts_on'  },
    { text: on ? '🔕 Alerts: OFF'  : '🔕 Alerts: OFF ✓', callback_data: 'alerts_off' },
  ]],
});

const RISK_KEYBOARD = {
  inline_keyboard: [[
    { text: '1 — Safe',   callback_data: 'risk_1' },
    { text: '2 — Low',    callback_data: 'risk_2' },
    { text: '3 — Mid',    callback_data: 'risk_3' },
    { text: '4 — High',   callback_data: 'risk_4' },
    { text: '5 — Max',    callback_data: 'risk_5' },
  ]],
};

// ── /start ────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => guard(msg, () => {
  const name = msg.from.first_name || 'Trader';
  bot.sendMessage(msg.chat.id, `
🏅 *Welcome to ${BOT_NAME}, ${name}!*

Your private AI-powered gold trading assistant.
Bot: @${BOT_USERNAME}

Tap a button below or type a command:
`, {
    parse_mode: 'Markdown',
    reply_markup: MAIN_KEYBOARD,
  });
}));

// ── /help ─────────────────────────────────────────────────────
function sendHelp(chatId) {
  return bot.sendMessage(chatId, `
📖 *${BOT_NAME} — Full Command List*

*Market Data*
/price — Live XAU/USD spot price
/signal — AI consensus (BUY / SELL / HOLD)
/analysis — Full indicator breakdown

*Portfolio*
/portfolio — Balance & P&L summary
/deposit 250 — Log a deposit
/withdraw 100 — Log a withdrawal

*Trades*
/trade buy 250 3241.80 — Log a BUY
/trade sell 250 3270.00 — Log a SELL
/close 1 3270.00 — Close trade #1, calculate P&L
/history — Last 20 trades
/stats — Win rate, drawdown, risk/reward

*Settings*
/setrisk — Set risk level (1–5)
/alerts on|off — Toggle auto-alerts
/status — Bot health check

*Indicators used:*
RSI (14) · MACD (12/26/9) · Bollinger (20,2)
EMA 50/200 · SMA20 — weighted consensus

⚠️ _Personal use only. Not financial advice._
`, {
    parse_mode: 'Markdown',
    reply_markup: MAIN_KEYBOARD,
  });
}
bot.onText(/\/help/, (msg) => guard(msg, () => sendHelp(msg.chat.id)));

// ── /price ────────────────────────────────────────────────────
async function sendPrice(chatId) {
  try {
    const p = await engine.getLivePrice();
    const chSign  = p.change >= 0 ? '+' : '';
    const chIcon  = p.change >= 0 ? '📈' : '📉';
    return bot.sendMessage(chatId, `
🏅 *XAU/USD — Live Price*

💵 *${formatCurrency(p.price)}* per troy oz
${chIcon} *${chSign}${p.change.toFixed(2)}* (${chSign}${p.changePct.toFixed(3)}%) today

📊 Range: ${formatCurrency(p.low)} – ${formatCurrency(p.high)}
🔁 Bid: ${formatCurrency(p.bid)} · Ask: ${formatCurrency(p.ask)}
🕐 ${new Date().toLocaleTimeString('en-GB', { timeZone: 'UTC' })} UTC
${p.simulated ? '\n⚠️ _Simulated — add METALS\\_API\\_KEY to .env for live data_' : '\n_Source: live market feed_'}
`, { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD });
  } catch (e) {
    return bot.sendMessage(chatId,
      `❌ Price fetch failed: ${e.message}\n\nAdd METALS_API_KEY to your .env file.`);
  }
}
bot.onText(/\/price/, (msg) => guard(msg, () => sendPrice(msg.chat.id)));

// ── /signal ───────────────────────────────────────────────────
async function sendSignal(chatId) {
  const wait = await bot.sendMessage(chatId, '⏳ Analyzing XAU/USD market…');
  try {
    const signal = await engine.getSignal();
    const risk   = portfolio.getRiskLevel();
    await bot.deleteMessage(chatId, wait.message_id).catch(() => {});
    return bot.sendMessage(chatId, formatSignal(signal, risk), {
      parse_mode: 'Markdown',
      reply_markup: MAIN_KEYBOARD,
    });
  } catch (e) {
    await bot.deleteMessage(chatId, wait.message_id).catch(() => {});
    return bot.sendMessage(chatId, `❌ Signal error: ${e.message}`);
  }
}
bot.onText(/\/signal/, (msg) => guard(msg, () => sendSignal(msg.chat.id)));

// ── /analysis ─────────────────────────────────────────────────
async function sendAnalysis(chatId) {
  const wait = await bot.sendMessage(chatId, '🔍 Running full technical analysis…');
  try {
    const a = await engine.getFullAnalysis();
    await bot.deleteMessage(chatId, wait.message_id).catch(() => {});

    const bullish = a.indicators.filter(i => i.signal === 'BUY').length;
    const bearish = a.indicators.filter(i => i.signal === 'SELL').length;
    const neutral = a.indicators.filter(i => i.signal === 'HOLD').length;

    let text = `📊 *Full Analysis — XAU/USD*\n`;
    text += `🕐 ${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })} UTC\n`;
    text += `💵 Price: *${formatCurrency(a.price)}*\n\n`;
    text += `*Summary:* ✅ ${bullish} bullish · ❌ ${bearish} bearish · ⚪ ${neutral} neutral\n\n`;
    text += `*Indicators:*\n`;
    for (const ind of a.indicators) {
      const icon = ind.signal === 'BUY' ? '🟢' : ind.signal === 'SELL' ? '🔴' : '🟡';
      text += `${icon} *${ind.name}:* ${ind.signal} — ${ind.reason}\n`;
    }
    text += `\n*AI Consensus:* *${a.consensus.signal}* (${a.consensus.confidence}% confidence)`;
    text += `\n\n_⚠️ Not financial advice. Always use stop-losses._`;

    return bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: MAIN_KEYBOARD,
    });
  } catch (e) {
    await bot.deleteMessage(chatId, wait.message_id).catch(() => {});
    return bot.sendMessage(chatId, `❌ Analysis error: ${e.message}`);
  }
}
bot.onText(/\/analysis/, (msg) => guard(msg, () => sendAnalysis(msg.chat.id)));

// ── /portfolio ────────────────────────────────────────────────
function sendPortfolio(chatId) {
  const p      = portfolio.getSummary();
  const pSign  = p.totalPnL >= 0 ? '+' : '';
  const pIcon  = p.totalPnL >= 0 ? '📈' : '📉';
  const dSign  = p.todayPnL >= 0 ? '+' : '';

  return bot.sendMessage(chatId, `
💼 *AESGold Portfolio*

💰 *Balance:* ${formatCurrency(p.balance)}
💵 *Total deposited:* ${formatCurrency(p.totalDeposited)}
${pIcon} *Total P&L:* ${pSign}${formatCurrency(p.totalPnL)} (${pSign}${formatPercent(p.totalPnLPct)})

📅 *Today:*
Trades: ${p.todayTrades}
P&L today: ${dSign}${formatCurrency(p.todayPnL)}

🎯 *Risk level:* ${p.riskLevel}/5
⚠️ *Max per trade:* ${formatCurrency(p.maxPerTrade)} (${p.riskPct}%)

_${new Date().toLocaleTimeString('en-GB', { timeZone: 'UTC' })} UTC_
`, { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD });
}
bot.onText(/\/portfolio/, (msg) => guard(msg, () => sendPortfolio(msg.chat.id)));

// ── /deposit ──────────────────────────────────────────────────
bot.onText(/\/deposit (.+)/, (msg, match) => guard(msg, () => {
  const amount = parseFloat(match[1]);
  if (isNaN(amount) || amount < 1) {
    return bot.sendMessage(msg.chat.id, '❌ Usage: /deposit 250');
  }
  portfolio.deposit(amount);
  bot.sendMessage(msg.chat.id,
    `✅ *Deposit logged:* ${formatCurrency(amount)}\n\nNew balance: *${formatCurrency(portfolio.getBalance())}*`,
    { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD });
}));

// ── /withdraw ─────────────────────────────────────────────────
bot.onText(/\/withdraw (.+)/, (msg, match) => guard(msg, () => {
  const amount = parseFloat(match[1]);
  if (isNaN(amount) || amount < 1) {
    return bot.sendMessage(msg.chat.id, '❌ Usage: /withdraw 100');
  }
  const result = portfolio.withdraw(amount);
  if (!result.success) {
    return bot.sendMessage(msg.chat.id, `❌ ${result.error}`);
  }
  bot.sendMessage(msg.chat.id,
    `✅ *Withdrawal logged:* ${formatCurrency(amount)}\n\nNew balance: *${formatCurrency(portfolio.getBalance())}*`,
    { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD });
}));

// ── /trade ────────────────────────────────────────────────────
bot.onText(/\/trade (buy|sell) (\d+\.?\d*) (\d+\.?\d*)/, (msg, match) => guard(msg, () => {
  const direction = match[1].toUpperCase();
  const amount    = parseFloat(match[2]);
  const price     = parseFloat(match[3]);

  if (isNaN(amount) || isNaN(price) || amount <= 0 || price <= 0) {
    return bot.sendMessage(msg.chat.id, '❌ Usage: /trade buy 250 3241.80');
  }

  const trade  = portfolio.logTrade(direction, amount, price);
  const oz     = (amount / price).toFixed(4);
  const slPrice = direction === 'BUY'
    ? formatCurrency(price * 0.985)
    : formatCurrency(price * 1.015);

  bot.sendMessage(msg.chat.id, `
✅ *Trade Logged — #${trade.id}*

${direction === 'BUY' ? '🟢 BUY' : '🔴 SELL'} XAU/USD
💵 Amount: ${formatCurrency(amount)}
🏅 Entry price: ${formatCurrency(price)}/oz
⚖️ Size: ${oz} oz
📌 Suggested stop-loss: ${slPrice} (1.5%)
🕐 ${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })} UTC

_Use /close ${trade.id} <exit-price> to close this trade._
`, { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD });
}));

// ── /close ────────────────────────────────────────────────────
bot.onText(/\/close (\d+) (\d+\.?\d*)/, (msg, match) => guard(msg, () => {
  const tradeId    = parseInt(match[1]);
  const closePrice = parseFloat(match[2]);
  const result     = portfolio.closeTrade(tradeId, closePrice);

  if (!result.success) {
    return bot.sendMessage(msg.chat.id, `❌ ${result.error}`);
  }

  const pnlIcon = result.pnl >= 0 ? '🟢' : '🔴';
  const pnlSign = result.pnl >= 0 ? '+' : '';

  bot.sendMessage(msg.chat.id, `
${pnlIcon} *Trade #${tradeId} Closed*

Entry: ${formatCurrency(result.entryPrice)} → Exit: ${formatCurrency(closePrice)}
P&L: *${pnlSign}${formatCurrency(result.pnl)}* (${pnlSign}${formatPercent(result.pnlPct)})
Duration: ${result.duration}

New balance: *${formatCurrency(portfolio.getBalance())}*
`, { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD });
}));

// ── /history ──────────────────────────────────────────────────
function sendHistory(chatId) {
  const trades = portfolio.getHistory(20);
  if (trades.length === 0) {
    return bot.sendMessage(chatId,
      '📋 No trades logged yet.\n\nUse /trade buy|sell <amount> <price>',
      { reply_markup: MAIN_KEYBOARD });
  }

  let text = `📋 *Trade History (${trades.length} most recent)*\n\n`;
  for (const t of trades) {
    const icon    = t.direction === 'BUY' ? '🟢' : '🔴';
    const pnlText = t.pnl !== null
      ? ` — ${t.pnl >= 0 ? '+' : ''}${formatCurrency(t.pnl)}`
      : ' — open';
    text += `${icon} *#${t.id}* ${t.direction} ${formatCurrency(t.amount)} @ ${formatCurrency(t.price)}${pnlText}\n`;
    text += `   📅 ${new Date(t.timestamp).toLocaleDateString('en-GB')}\n`;
  }

  return bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: MAIN_KEYBOARD,
  });
}
bot.onText(/\/history/, (msg) => guard(msg, () => sendHistory(msg.chat.id)));

// ── /stats ────────────────────────────────────────────────────
function sendStats(chatId) {
  const s = portfolio.getStats();
  return bot.sendMessage(chatId, `
📈 *Performance Statistics*

🎯 Win rate: *${formatPercent(s.winRate)}*
📊 Total trades: ${s.totalTrades} (✅ ${s.winners} wins · ❌ ${s.losers} losses)

💰 Total P&L: *${s.totalPnL >= 0 ? '+' : ''}${formatCurrency(s.totalPnL)}*
📈 Avg win: ${formatCurrency(s.avgWin)}
📉 Avg loss: ${formatCurrency(s.avgLoss)}
⚖️ Risk/Reward: 1:${s.riskReward.toFixed(2)}

📉 Max drawdown: ${formatPercent(s.maxDrawdown)}
🏆 Best trade: ${formatCurrency(s.bestTrade)}
💀 Worst trade: ${formatCurrency(s.worstTrade)}
`, { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD });
}
bot.onText(/\/stats/, (msg) => guard(msg, () => sendStats(msg.chat.id)));

// ── /setrisk ──────────────────────────────────────────────────
bot.onText(/\/setrisk/, (msg) => guard(msg, () => {
  bot.sendMessage(msg.chat.id,
    `🎯 *Select your risk level:*\n\n1 = 1% per trade (safest)\n2 = 1.5% per trade\n3 = 2% per trade\n4 = 3% per trade\n5 = 5% per trade (aggressive)`,
    { parse_mode: 'Markdown', reply_markup: RISK_KEYBOARD });
}));

// ── /alerts ───────────────────────────────────────────────────
bot.onText(/\/alerts (on|off)/, (msg, match) => guard(msg, () => {
  const on = match[1] === 'on';
  portfolio.setAlerts(on);
  const text = on
    ? '🔔 *Alerts enabled!*\n\nYou\'ll receive signals every 30 min during market hours (Mon–Fri 08:00–22:00 UTC) + a daily summary at 22:00 UTC.'
    : '🔕 *Alerts disabled.* Send /alerts on to re-enable.';
  bot.sendMessage(msg.chat.id, text, {
    parse_mode: 'Markdown',
    reply_markup: ALERT_KEYBOARD(on),
  });
}));

// ── /status ───────────────────────────────────────────────────
async function sendStatus(chatId) {
  const alertsOn = portfolio.getAlerts();
  const risk     = portfolio.getRiskLevel();
  let priceStatus = '❌ Offline';
  let priceNote   = '(add METALS_API_KEY to .env)';
  try {
    const p = await engine.getLivePrice();
    priceStatus = p.simulated ? '⚠️ Simulated' : '✅ Live';
    priceNote   = p.simulated ? '(demo mode)' : '(live data)';
  } catch (_) {}

  const uptimeMins = Math.floor(process.uptime() / 60);
  const uptimeStr  = uptimeMins >= 60
    ? `${Math.floor(uptimeMins / 60)}h ${uptimeMins % 60}m`
    : `${uptimeMins}m`;

  return bot.sendMessage(chatId, `
⚙️ *${BOT_NAME} — Status*

🤖 Bot: ✅ Running (@${BOT_USERNAME})
📡 Price feed: ${priceStatus} ${priceNote}
🔔 Alerts: ${alertsOn ? '✅ Enabled' : '🔕 Disabled'}
🎯 Risk level: ${risk}/5
📊 Signal engine: ✅ Ready

🕐 Uptime: ${uptimeStr}
💾 Node.js: ${process.version}
📅 ${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
`, { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD });
}
bot.onText(/\/status/, (msg) => guard(msg, () => sendStatus(msg.chat.id)));

// ── Inline keyboard callback handler ─────────────────────────
bot.on('callback_query', async (query) => {
  if (!query.from || query.from.id !== OWNER_ID) {
    return bot.answerCallbackQuery(query.id, { text: '🚫 Private bot' });
  }

  const chatId = query.message.chat.id;
  const data   = query.data;

  await bot.answerCallbackQuery(query.id);

  if (data === 'cmd_signal')    return sendSignal(chatId);
  if (data === 'cmd_price')     return sendPrice(chatId);
  if (data === 'cmd_analysis')  return sendAnalysis(chatId);
  if (data === 'cmd_portfolio') return sendPortfolio(chatId);
  if (data === 'cmd_history')   return sendHistory(chatId);
  if (data === 'cmd_stats')     return sendStats(chatId);
  if (data === 'cmd_status')    return sendStatus(chatId);
  if (data === 'cmd_help')      return sendHelp(chatId);

  if (data === 'alerts_on' || data === 'alerts_off') {
    const on = data === 'alerts_on';
    portfolio.setAlerts(on);
    const text = on
      ? '🔔 *Alerts enabled!* Signals every 30 min (market hours).'
      : '🔕 *Alerts disabled.*';
    return bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: ALERT_KEYBOARD(on),
    });
  }

  if (data.startsWith('risk_')) {
    const level = parseInt(data.split('_')[1]);
    portfolio.setRiskLevel(level);
    const pct = [1, 1.5, 2, 3, 5][level - 1];
    return bot.sendMessage(chatId,
      `✅ *Risk level set to ${level}/5*\nMax risk per trade: *${pct}%* of balance`,
      { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD });
  }
});

// ── Scheduled: Signal alerts every 30 min (market hours) ─────
cron.schedule('*/30 8-22 * * 1-5', async () => {
  if (!portfolio.getAlerts()) return;
  try {
    const signal = await engine.getSignal();
    if (signal.consensus.confidence >= 70) {
      const text = `🔔 *Scheduled Signal — @${BOT_USERNAME}*\n\n` +
                   formatSignal(signal, portfolio.getRiskLevel());
      bot.sendMessage(OWNER_ID, text, { parse_mode: 'Markdown' });
    }
  } catch (e) {
    console.error('[cron] Alert error:', e.message);
  }
});

// ── Scheduled: Daily summary at 22:00 UTC ────────────────────
cron.schedule('0 22 * * 1-5', () => {
  const p     = portfolio.getSummary();
  const dSign = p.todayPnL >= 0 ? '+' : '';
  bot.sendMessage(OWNER_ID, `
📅 *Daily Summary — @${BOT_USERNAME}*

Trades today: ${p.todayTrades}
P&L today: *${dSign}${formatCurrency(p.todayPnL)}*
Balance: *${formatCurrency(p.balance)}*

Good night! 🌙
`, { parse_mode: 'Markdown' });
});

// ── Boot log ──────────────────────────────────────────────────
console.log(`🏅 ${BOT_NAME} started`);
console.log(`   Telegram: ${BOT_LINK}`);
console.log(`   Owner ID: ${OWNER_ID}`);
console.log(`   Polling for messages...`);

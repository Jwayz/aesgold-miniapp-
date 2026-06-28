# aesgold-miniapp-
AI consensus (BUY/SELL/HOLD) from 5 weighted indicators: RSI, MACD, Bollinger Bands, EMA 50/200 cross, and SMA20. 

# 🏅 AutoGold Bot — Personal Gold Trading Telegram Bot

A private, personal Telegram bot that gives you AI-powered XAU/USD trading signals, portfolio tracking, and automated alerts — all through Telegram, like BotFather.

---

## ✨ Features

- 📊 **AI Signal Engine** — RSI, MACD, Bollinger Bands, EMA Cross, SMA20
- 💰 **Portfolio Tracker** — Balance, deposits, P&L, trade history
- 🔔 **Automatic Alerts** — Signals every 30 min during market hours
- 📈 **Trade Logger** — Log every trade, track wins/losses, get stats
- 🛡️ **Private** — Only YOU can use the bot (owner-ID locked)
- 💾 **Persistent** — State saved to JSON file, survives restarts

---

## 🚀 Setup (5 minutes)

### Step 1: Create your Telegram bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Give it a name: e.g. `My Gold Signals`
4. Give it a username: e.g. `mygoldsignals_bot`
5. **Copy the token** (looks like `7123456789:AAH...`)

### Step 2: Get your Telegram user ID

1. Search **@userinfobot** in Telegram
2. Send `/start`
3. **Copy your numeric ID** (e.g. `123456789`)

### Step 3: Install and configure

```bash
# Clone or download this project folder, then:
cd autogold-bot
npm install

# Copy the example config
cp .env.example .env

# Edit .env and fill in:
# TELEGRAM_BOT_TOKEN=your_token_here
# OWNER_TELEGRAM_ID=your_id_here
nano .env
```

### Step 4: Run the bot

```bash
npm start
```

You should see:
```
🏅 AutoGold Bot is running...
👤 Owner ID: 123456789
📡 Polling Telegram for messages...
```

Now open Telegram, find your bot, and send `/start` 🎉

---

## 📱 Commands Reference

### Signals & Analysis
| Command | Description |
|---------|-------------|
| `/price` | Live XAU/USD spot price |
| `/signal` | AI consensus signal (BUY/SELL/HOLD) with levels |
| `/analysis` | Full breakdown of all 5 indicators |

### Portfolio
| Command | Description |
|---------|-------------|
| `/portfolio` | Balance, P&L summary |
| `/deposit 250` | Log a deposit of $250 |
| `/withdraw 100` | Log a withdrawal |

### Trade Logging
| Command | Description |
|---------|-------------|
| `/trade buy 250 3241.80` | Log a BUY of $250 at $3,241.80/oz |
| `/trade sell 250 3270.00` | Log a SELL |
| `/close 1 3270.00` | Close trade #1 at $3,270 (calculates P&L) |
| `/history` | Last 20 trades |
| `/stats` | Win rate, avg return, drawdown, risk/reward |

### Settings
| Command | Description |
|---------|-------------|
| `/setrisk 2` | Risk per trade (1=1%, 2=1.5%, 3=2%, 4=3%, 5=5%) |
| `/alerts on` | Enable 30-min signal alerts (market hours) |
| `/alerts off` | Disable alerts |
| `/status` | Bot health check |

---

## 📊 How the Signal Engine Works

The AI signal engine analyzes **5 indicators** and combines them into a weighted consensus:

| Indicator | Weight | Signal Logic |
|-----------|--------|-------------|
| **RSI (14)** | 2.0 | <30 = oversold BUY, >70 = overbought SELL |
| **MACD (12/26/9)** | 2.5 | Crossovers + line position |
| **Bollinger Bands (20,2)** | 1.5 | Price vs upper/lower bands |
| **EMA Cross (50/200)** | 2.0 | Golden/death cross |
| **SMA20 Trend** | 1.0 | Price vs 20-day average |

- **≥75% confidence** = Strong signal
- **60–74%** = Moderate signal
- **<60%** = Weak (wait for better setup)

Stop-loss and target levels are set using **ATR (Average True Range)** — automatically adapts to current volatility.

---

## 💡 Example Workflow (Starting with €250)

```
1. /deposit 250          → Log your starting capital

2. /signal               → Get today's AI signal
   → "🟢 STRONG BUY — 88% confidence"
   → Entry: $3,241.80
   → Stop loss: $3,220.00
   → Target: $3,275.00

3. Place the trade on your broker (MetaTrader, OANDA, etc.)

4. /trade buy 250 3241.80 → Log it in the bot

5. Price hits target...

6. /close 1 3275.00      → Close and see your P&L
   → "🟢 Trade #1 Closed: +$8.20 (+3.3%)"

7. /portfolio            → See updated balance
8. /stats                → Track your win rate over time
```

---

## 🔄 Running 24/7

To keep the bot running permanently, use **PM2**:

```bash
npm install -g pm2
pm2 start src/bot.js --name autogold-bot
pm2 startup   # auto-start on reboot
pm2 save
```

Or run on a cheap VPS (DigitalOcean, Hetzner ~€4/month).

---

## 🌐 Live Price Data

The bot tries these sources in order:

1. **Metals-API** (free: 50 requests/month) — add key to `.env`
2. **ExchangeRate.host** (free, no key, automatic fallback)
3. **Yahoo Finance** (unofficial, free, used for historical data)
4. **Simulated prices** (demo mode when all APIs fail)

For personal use, the free tiers are more than enough.

---

## ⚠️ Disclaimer

This bot provides technical analysis signals for **personal informational use only**.
It is NOT financial advice. Gold trading involves significant risk of loss.
Always use stop-losses and never risk more than you can afford to lose.
Past signal performance does not guarantee future results.

---

## 📁 Project Structure

```
autogold-bot/
├── src/
│   ├── bot.js           ← Main bot (all Telegram commands)
│   ├── signalEngine.js  ← AI technical analysis engine
│   ├── portfolio.js     ← Portfolio state & persistence
│   └── utils.js         ← Formatting helpers
├── data/
│   └── portfolio.json   ← Your data (auto-created)
├── .env                 ← Your secrets (never commit this!)
├── .env.example         ← Template
├── package.json
└── README.md
```

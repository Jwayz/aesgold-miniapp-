# Changelog — AESGold_bot

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2.0.0] — 2026-06-16

### Identity
- Bot rebranded to **@AESGold_bot** (`https://t.me/AESGold_bot`)
- Bot name, username, and link embedded throughout all messages and logs
- `.env.example` updated with AESGold_bot identity comments

### Added
- **Inline keyboards** on every response — tap buttons instead of typing commands
  - `MAIN_KEYBOARD`: Signal · Price · Analysis · Portfolio · History · Stats · Status · Help
  - `RISK_KEYBOARD`: tap 1–5 to set risk level without typing `/setrisk N`
  - `ALERT_KEYBOARD`: ON/OFF toggle buttons for alerts
- **Callback query handler** — all inline buttons wired to the same functions as text commands
- `/setrisk` now shows an interactive button picker (no argument needed)
- `/alerts` now shows ON/OFF toggle buttons after setting
- Separate named functions (`sendSignal`, `sendPrice`, `sendAnalysis`, etc.) — reused by both text commands and button callbacks, eliminating duplicated logic
- Boot log now prints bot link and username for easy reference
- Uptime displayed as `Xh Ym` instead of raw minutes when ≥ 60 min
- All timestamps now shown in UTC with `en-GB` locale for consistency
- Stop-loss suggestion on `/trade sell` (1.5% above entry, matching BUY logic)
- `/trade` response now includes hint: `_Use /close <id> <price>_`

### Changed
- All `bot.sendMessage` calls now include `reply_markup: MAIN_KEYBOARD` so the menu is always one tap away
- `/status` price-feed line shows "⚠️ Simulated (demo mode)" vs "✅ Live (live data)"
- `/deposit` and `/withdraw` minimum changed from `> 0` to `>= 1` to avoid dust amounts
- Scheduled alert message prefixed with `@AESGold_bot` identifier
- Daily summary prefixed with `@AESGold_bot` identifier
- `console.log` on boot shows full bot link

### Security
- Token and owner ID validation unchanged — bot still strictly owner-only
- `.env.example` clearly warns: "KEEP THIS SECRET — never share or commit this file"
- Token stored only in `.env` (gitignored) — never hardcoded in source files

### Fixed
- `bot.deleteMessage` wrapped in `.catch(() => {})` to silently ignore race conditions
  when the "please wait" message is deleted
- Analysis and signal functions correctly `return` the bot.sendMessage promise

---

## [1.0.0] — 2026-06-16 (initial build)

### Added
- **Signal Engine** (`signalEngine.js`) — 5-indicator weighted AI consensus
  - RSI (14) — weight 2.0
  - MACD (12/26/9) — weight 2.5
  - Bollinger Bands (20, 2) — weight 1.5
  - EMA Cross (50/200) — weight 2.0
  - SMA20 Trend — weight 1.0
- ATR-based stop-loss and take-profit level calculation
- Multi-source price fetching: Metals-API → ExchangeRate.host → Yahoo Finance → Simulated
- **Portfolio Manager** (`portfolio.js`) — persistent JSON state
  - Deposit / withdraw logging
  - Trade logging with direction, amount, entry price
  - Trade closing with automatic P&L calculation and duration
  - Performance stats: win rate, avg win/loss, risk/reward, max drawdown
  - Risk level 1–5 (maps to 1%, 1.5%, 2%, 3%, 5% of balance)
  - Alert toggle state persisted across restarts
- **Bot commands** (`bot.js`)
  - `/start` `/help` `/price` `/signal` `/analysis`
  - `/portfolio` `/deposit` `/withdraw`
  - `/trade` `/close` `/history` `/stats`
  - `/setrisk` `/alerts` `/status`
- **Utility formatters** (`utils.js`) — `formatCurrency`, `formatPercent`, `formatSignal`
- **Scheduled jobs** (`node-cron`)
  - Signal alert every 30 min, Mon–Fri, 08:00–22:00 UTC (only if confidence ≥ 70%)
  - Daily P&L summary at 22:00 UTC, Mon–Fri
- Owner-only security guard on all commands and callbacks
- `.env.example` config template
- `package.json` with all dependencies
- `README.md` with full setup guide and workflow example

---

## Roadmap (planned)

### [2.1.0] — upcoming
- [ ] `/opentrades` — list all currently open positions
- [ ] `/sl <tradeId> <price>` — update stop-loss for an open trade
- [ ] `/tp <tradeId> <price>` — update take-profit target
- [ ] Weekly performance report (Sundays at 20:00 UTC)
- [ ] Confidence threshold configurable via `/setthreshold <50-95>`

### [2.2.0] — future
- [ ] OANDA broker API integration for real order execution
- [ ] Multi-asset support: XAG/USD (silver), XPT/USD (platinum)
- [ ] Telegram Web App mini-dashboard
- [ ] Export trade history to CSV via `/export`

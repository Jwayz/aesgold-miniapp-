// ============================================================
//  Portfolio — State management & persistence
// ============================================================

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/portfolio.json');

const DEFAULT_STATE = {
  balance: 0,
  totalDeposited: 0,
  totalWithdrawn: 0,
  riskLevel: 2,
  alertsEnabled: true,
  trades: [],
  nextTradeId: 1,
  createdAt: new Date().toISOString(),
};

class Portfolio {
  constructor() {
    this._state = this._load();
  }

  // ── Persistence ────────────────────────────────────────────
  _load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return { ...DEFAULT_STATE, ...JSON.parse(raw) };
      }
    } catch (_) {}
    return { ...DEFAULT_STATE };
  }

  _save() {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(this._state, null, 2));
  }

  // ── Balance ────────────────────────────────────────────────
  getBalance() { return this._state.balance; }

  deposit(amount) {
    this._state.balance += amount;
    this._state.totalDeposited += amount;
    this._save();
  }

  withdraw(amount) {
    if (amount > this._state.balance) {
      return { success: false, error: `Insufficient balance. Available: $${this._state.balance.toFixed(2)}` };
    }
    this._state.balance -= amount;
    this._state.totalWithdrawn += amount;
    this._save();
    return { success: true };
  }

  // ── Trade Logging ──────────────────────────────────────────
  logTrade(direction, amount, price) {
    const trade = {
      id: this._state.nextTradeId++,
      direction,
      amount,
      price,
      pnl: null,
      pnlPct: null,
      closed: false,
      closePrice: null,
      timestamp: new Date().toISOString(),
      closedAt: null,
    };
    this._state.trades.push(trade);
    this._save();
    return trade;
  }

  closeTrade(tradeId, closePrice) {
    const trade = this._state.trades.find(t => t.id === tradeId);
    if (!trade) return { success: false, error: `Trade #${tradeId} not found` };
    if (trade.closed) return { success: false, error: `Trade #${tradeId} already closed` };

    const oz = trade.amount / trade.price;
    const closeValue = oz * closePrice;
    const pnl = trade.direction === 'BUY'
      ? closeValue - trade.amount
      : trade.amount - closeValue;
    const pnlPct = (pnl / trade.amount) * 100;

    trade.closed = true;
    trade.closePrice = closePrice;
    trade.pnl = parseFloat(pnl.toFixed(2));
    trade.pnlPct = parseFloat(pnlPct.toFixed(2));
    trade.closedAt = new Date().toISOString();
    this._state.balance += pnl;

    const openMs = new Date(trade.closedAt) - new Date(trade.timestamp);
    const hours = Math.floor(openMs / 3600000);
    const mins = Math.floor((openMs % 3600000) / 60000);
    const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    this._save();
    return { success: true, pnl, pnlPct, entryPrice: trade.price, duration };
  }

  // ── Summary ────────────────────────────────────────────────
  getSummary() {
    const today = new Date().toDateString();
    const todayTrades = this._state.trades.filter(t => new Date(t.timestamp).toDateString() === today);
    const todayPnL = todayTrades.filter(t => t.closed).reduce((s, t) => s + (t.pnl || 0), 0);
    const riskPct = [1, 1.5, 2, 3, 5][this._state.riskLevel - 1];
    const totalPnL = this._state.balance - this._state.totalDeposited + this._state.totalWithdrawn;
    const totalPnLPct = this._state.totalDeposited > 0 ? (totalPnL / this._state.totalDeposited) * 100 : 0;

    return {
      balance: this._state.balance,
      totalDeposited: this._state.totalDeposited,
      totalPnL,
      totalPnLPct,
      todayTrades: todayTrades.length,
      todayPnL,
      riskLevel: this._state.riskLevel,
      riskPct,
      maxPerTrade: this._state.balance * (riskPct / 100),
    };
  }

  // ── History ────────────────────────────────────────────────
  getHistory(limit = 20) {
    return [...this._state.trades].reverse().slice(0, limit);
  }

  // ── Stats ──────────────────────────────────────────────────
  getStats() {
    const closed = this._state.trades.filter(t => t.closed && t.pnl !== null);
    const winners = closed.filter(t => t.pnl > 0);
    const losers = closed.filter(t => t.pnl <= 0);
    const totalPnL = closed.reduce((s, t) => s + t.pnl, 0);
    const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length) : 0;
    const riskReward = avgLoss > 0 ? avgWin / avgLoss : 0;
    const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0;
    const bestTrade = closed.length > 0 ? Math.max(...closed.map(t => t.pnl)) : 0;
    const worstTrade = closed.length > 0 ? Math.min(...closed.map(t => t.pnl)) : 0;

    // Max drawdown
    let peak = this._state.totalDeposited;
    let maxDrawdown = 0;
    let running = this._state.totalDeposited;
    for (const t of closed) {
      running += t.pnl;
      if (running > peak) peak = running;
      const dd = peak > 0 ? ((peak - running) / peak) * 100 : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    return {
      totalTrades: closed.length,
      winners: winners.length,
      losers: losers.length,
      winRate,
      totalPnL,
      avgWin,
      avgLoss,
      riskReward,
      maxDrawdown,
      bestTrade,
      worstTrade,
    };
  }

  // ── Settings ───────────────────────────────────────────────
  getRiskLevel() { return this._state.riskLevel; }
  setRiskLevel(level) { this._state.riskLevel = level; this._save(); }
  getAlerts() { return this._state.alertsEnabled; }
  setAlerts(val) { this._state.alertsEnabled = val; this._save(); }
}

module.exports = Portfolio;

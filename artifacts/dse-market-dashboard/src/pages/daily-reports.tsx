import { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  PieChart,
  Plus,
  Printer,
  RefreshCw,
  Send,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  X,
  Zap,
} from 'lucide-react';
import { Sidebar } from '@/components/sidebar';

interface DailyCard {
  date: string;
  day_name: string;
  formatted_date: string;
  is_today: boolean;
  total_trades: number;
  buys_count: number;
  sells_count: number;
  total_turnover: number;
  total_commissions: number;
  realized_pnl: number;
  unrealized_pnl: number;
  net_pnl: number;
  is_profitable: boolean;
  best_performer: string;
  traded_symbols: string[];
  status: string;
}

interface StatementData {
  date: string;
  is_today: boolean;
  investor_profile: {
    name: string;
    investor_code: string;
    bo_id: string;
    broker: string;
    trec: string;
  };
  financial_summary: {
    gross_turnover: number;
    brokerage_fees: number;
    cdbl_charges: number;
    realized_gain_loss: number;
    unrealized_gain_loss: number;
    net_session_profit: number;
    starting_cash: number;
    cash_balance: number;
    total_account_equity: number;
  };
  executed_orders: any[];
  active_holdings: any[];
  generated_at: string;
}

interface RealHolding {
  symbol: string;
  group: string;
  total_quantity: number;
  saleable_quantity: number;
  avg_cost: number;
  total_cost: number;
  market_rate: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  weight_pct: number;
}

interface RealPortfolio {
  profile: any;
  balance: any;
  summary: {
    mature_balance: number;
    ledger_balance: number;
    purchase_power: number;
    total_cost_basis: number;
    total_market_value: number;
    total_equity: number;
    total_unrealized_pnl: number;
    overall_pnl_pct: number;
    positions_count: number;
  };
  holdings: RealHolding[];
}

export default function DailyReportsPage() {
  const [cards, setCards] = useState<DailyCard[]>([]);
  const [realPortfolio, setRealPortfolio] = useState<RealPortfolio | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dispatchingTg, setDispatchingTg] = useState<boolean>(false);
  const [tgSuccess, setTgSuccess] = useState<string | null>(null);

  // Modal / Drawer state for full info
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [loadingStatement, setLoadingStatement] = useState<boolean>(false);

  // Real Portfolio Add Holding Modal
  const [showAddHolding, setShowAddHolding] = useState<boolean>(false);
  const [newSym, setNewSym] = useState<string>('GP');
  const [newQty, setNewQty] = useState<string>('100');
  const [newCost, setNewCost] = useState<string>('240');
  const [newGroup, setNewGroup] = useState<string>('A');

  // Real Portfolio Balance Modal
  const [showEditBalance, setShowEditBalance] = useState<boolean>(false);
  const [matureBalInput, setMatureBalInput] = useState<string>('0');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cardsRes, realRes] = await Promise.all([
        fetch('/api/reports/daily-cards'),
        fetch('/api/portfolio/real'),
      ]);

      if (cardsRes.ok) {
        const cData = await cardsRes.json();
        setCards(cData);
      }

      if (realRes.ok) {
        const rData = await realRes.json();
        setRealPortfolio(rData);
        if (rData.balance?.mature_balance !== undefined) {
          setMatureBalInput(rData.balance.mature_balance.toString());
        }
      }
    } catch (err) {
      console.error('Failed fetching reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openStatementModal = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setLoadingStatement(true);
    try {
      const res = await fetch(`/api/reports/statement/${encodeURIComponent(dateStr)}`);
      if (res.ok) {
        const data = await res.json();
        setStatement(data);
      }
    } catch (err) {
      console.error('Failed fetching statement:', err);
    } finally {
      setLoadingStatement(false);
    }
  };

  const closeStatementModal = () => {
    setSelectedDate(null);
    setStatement(null);
  };

  const dispatchDailyTelegram = async () => {
    setDispatchingTg(true);
    setTgSuccess(null);
    try {
      const res = await fetch('/api/reports/daily-dispatch', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        setTgSuccess('Daily report dispatched to Telegram successfully!');
        setTimeout(() => setTgSuccess(null), 5000);
      } else {
        alert(data.message || 'Report skipped or error');
      }
    } catch (err) {
      console.error('Telegram dispatch error:', err);
    } finally {
      setDispatchingTg(false);
    }
  };

  const handleAddRealPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const params = new URLSearchParams({
        symbol: newSym.toUpperCase(),
        quantity: newQty,
        avg_cost: newCost,
        group: newGroup,
      });
      const res = await fetch(`/api/portfolio/real/position?${params.toString()}`, { method: 'POST' });
      if (res.ok) {
        setShowAddHolding(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRealPosition = async (sym: string) => {
    if (!confirm(`Delete ${sym} from real portfolio statement?`)) return;
    try {
      const res = await fetch(`/api/portfolio/real/position/${encodeURIComponent(sym)}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveMatureBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const params = new URLSearchParams({
        mature_balance: matureBalInput,
        ledger_balance: matureBalInput,
        purchase_power: matureBalInput,
      });
      const res = await fetch(`/api/portfolio/real/balance?${params.toString()}`, { method: 'POST' });
      if (res.ok) {
        setShowEditBalance(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0c0d10] text-slate-100 font-sans">
      <Sidebar active="reports" />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header Bar */}
        <header className="h-[60px] shrink-0 border-b border-[#222d39] bg-[#12161f] px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-emerald-500/20 grid place-items-center text-emerald-400">
              <FileText size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-white flex items-center gap-2">
                <span>Daily Reports & P&L Statement</span>
                <span className="rounded bg-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[10px] font-mono">
                  LankaBangla & Dhaka Bank Format
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Daily performance cards, itemized P&L analysis statements, and real broker portfolio sync.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={dispatchDailyTelegram}
              disabled={dispatchingTg}
              title="Dispatch Today's Market Close Summary to Telegram Bot"
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 text-xs transition shadow-md disabled:opacity-50"
            >
              <Send size={13} className={dispatchingTg ? 'animate-pulse' : ''} />
              <span>{dispatchingTg ? 'Dispatching...' : 'Telegram Daily Report'}</span>
            </button>

            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              title="Refresh reports"
              className="size-8 rounded-lg bg-[#18212c] hover:bg-[#222d39] grid place-items-center text-slate-400 hover:text-white border border-slate-700 transition"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {tgSuccess && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 text-xs px-6 py-2 flex items-center gap-2">
            <CheckCircle2 size={14} />
            <span>{tgSuccess}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="p-6 space-y-6 max-w-7xl w-full mx-auto">
          {/* SECTION 1: REAL BROKER PORTFOLIO (Dhaka Bank / LankaBangla statement format) */}
          <div className="rounded-xl border border-slate-800 bg-[#12161f] p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#222d39]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">
                    {realPortfolio?.profile?.broker ?? 'Dhaka Bank Securities Limited'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ({realPortfolio?.profile?.trec_no ?? 'TREC DSE-193'})
                  </span>
                </div>
                <h2 className="text-sm font-bold text-white mt-0.5 flex items-center gap-2">
                  <User size={15} className="text-slate-400" />
                  <span>{realPortfolio?.profile?.name ?? 'MD ZAHIRUL ISLAM'}</span>
                  <span className="text-xs text-slate-400 font-mono font-normal">
                    • Code: <strong className="text-white">{realPortfolio?.profile?.investor_code ?? '10171'}</strong>
                  </span>
                  <span className="text-xs text-slate-400 font-mono font-normal">
                    • BO ID: <strong className="text-white">{realPortfolio?.profile?.bo_id ?? '1201630076860712'}</strong>
                  </span>
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditBalance(true)}
                  className="rounded bg-[#1a212d] hover:bg-[#242e3f] text-slate-300 px-3 py-1.5 text-xs font-mono border border-slate-700 transition"
                >
                  Update Cash Balance
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddHolding(true)}
                  className="rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 text-xs flex items-center gap-1 transition"
                >
                  <Plus size={14} />
                  <span>Add Real Stock</span>
                </button>
              </div>
            </div>

            {/* Financial Status Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="rounded-lg bg-[#0c0d10] p-3 border border-slate-800/80">
                <span className="text-slate-400 text-[11px] block mb-1">Mature Balance (Cash)</span>
                <span className="text-base font-bold text-white">
                  ৳{(realPortfolio?.summary?.mature_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">Available purchase power</span>
              </div>

              <div className="rounded-lg bg-[#0c0d10] p-3 border border-slate-800/80">
                <span className="text-slate-400 text-[11px] block mb-1">Total Cost of Securities</span>
                <span className="text-base font-bold text-white">
                  ৳{(realPortfolio?.summary?.total_cost_basis ?? 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">Total invested capital</span>
              </div>

              <div className="rounded-lg bg-[#0c0d10] p-3 border border-slate-800/80">
                <span className="text-slate-400 text-[11px] block mb-1">Live Market Value (DSE)</span>
                <span className="text-base font-bold text-emerald-400">
                  ৳{(realPortfolio?.summary?.total_market_value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </span>
                <span className="text-[10px] text-emerald-500/80 mt-1 block">Synced with real-time LTP</span>
              </div>

              <div className="rounded-lg bg-[#0c0d10] p-3 border border-slate-800/80">
                <span className="text-slate-400 text-[11px] block mb-1">Total Real Equity</span>
                <span className="text-base font-bold text-amber-400">
                  ৳{(realPortfolio?.summary?.total_equity ?? 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">Cash + Market Value</span>
              </div>
            </div>

            {/* Real Holdings Table */}
            <div className="rounded-lg border border-slate-800/80 bg-[#0c0d10] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#161a24] text-slate-400 text-[10px] uppercase">
                      <th className="py-2.5 px-3">Instrument</th>
                      <th className="py-2.5 px-2">Group</th>
                      <th className="py-2.5 px-3 text-right">Total Qty</th>
                      <th className="py-2.5 px-3 text-right">Saleable Qty</th>
                      <th className="py-2.5 px-3 text-right">Avg. Cost (Tk.)</th>
                      <th className="py-2.5 px-3 text-right">Market Rate (Tk.)</th>
                      <th className="py-2.5 px-3 text-right">Total Cost (Tk.)</th>
                      <th className="py-2.5 px-3 text-right">Market Value (Tk.)</th>
                      <th className="py-2.5 px-3 text-right">Unrealized P&L</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {!realPortfolio?.holdings || realPortfolio.holdings.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-500 text-xs">
                          No real stock holdings recorded yet. Click "+ Add Real Stock" above to track your Dhaka Bank / LankaBangla shares with live DSE market rates.
                        </td>
                      </tr>
                    ) : (
                      realPortfolio.holdings.map((h) => {
                        const isGain = h.unrealized_pnl >= 0;
                        return (
                          <tr key={h.symbol} className="hover:bg-[#131722] transition">
                            <td className="py-2.5 px-3 font-bold text-white">{h.symbol}</td>
                            <td className="py-2.5 px-2 text-slate-400">{h.group}</td>
                            <td className="py-2.5 px-3 text-right text-slate-200">{h.total_quantity.toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-right text-slate-300">{h.saleable_quantity.toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-right text-slate-300">৳{h.avg_cost.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-400">৳{h.market_rate.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right text-slate-300">৳{h.total_cost.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-white">৳{h.market_value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`font-bold ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isGain ? `+৳${h.unrealized_pnl.toFixed(1)}` : `-৳${Math.abs(h.unrealized_pnl).toFixed(1)}`}
                                {' '}({isGain ? `+${h.unrealized_pnl_pct.toFixed(1)}` : h.unrealized_pnl_pct.toFixed(1)}%)
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteRealPosition(h.symbol)}
                                className="text-slate-600 hover:text-rose-400 p-1 transition"
                                title="Delete position"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SECTION 2: DAILY PERFORMANCE REPORT CARDS (Card View -> Click for Full Details) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar size={16} className="text-amber-400" />
                  <span>Daily Session Performance Cards</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Click on any day's card to inspect the full itemized LankaBangla P&L Statement and trade list.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {cards.length} Session(s) Recorded
              </span>
            </div>

            {loading ? (
              <div className="p-16 text-center text-slate-500 font-mono">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-amber-400" />
                Loading daily session reports...
              </div>
            ) : cards.length === 0 ? (
              <div className="p-16 text-center text-slate-500 font-mono rounded-xl border border-slate-800 bg-[#12161f]">
                No daily reports generated yet. Trades will be recorded when Auto-Pilot executes.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map((c) => {
                  const isProfitable = c.net_pnl >= 0;
                  return (
                    <div
                      key={c.date}
                      onClick={() => openStatementModal(c.date)}
                      className="rounded-xl border border-slate-800/90 bg-[#12161f] p-4.5 hover:border-amber-400/80 hover:bg-[#161c28] transition-all cursor-pointer shadow-md group flex flex-col justify-between"
                    >
                      {/* Card Header */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <span className="font-bold text-white text-sm">{c.day_name}</span>
                            <span className="text-slate-400">• {c.formatted_date}</span>
                          </div>
                          {c.is_today && (
                            <span className="rounded bg-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[9px] font-mono font-bold animate-pulse">
                              TODAY
                            </span>
                          )}
                        </div>

                        {/* Net Session P&L Highlight */}
                        <div className="rounded-lg bg-[#0c0d10] p-3 border border-slate-800 my-3 font-mono">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                            Session Net Profit / Loss
                          </span>
                          <div className="flex items-baseline justify-between">
                            <span
                              className={`text-xl font-bold ${
                                isProfitable ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {isProfitable ? `+৳${c.net_pnl.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : `-৳${Math.abs(c.net_pnl).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`}
                            </span>
                            {isProfitable ? (
                              <TrendingUp size={18} className="text-emerald-400" />
                            ) : (
                              <TrendingDown size={18} className="text-rose-400" />
                            )}
                          </div>
                        </div>

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 mb-3">
                          <div>
                            <span>Total Executions: </span>
                            <strong className="text-slate-200">{c.total_trades} orders</strong>
                          </div>
                          <div className="text-right">
                            <span>Brokerage Fee: </span>
                            <strong className="text-amber-400">৳{c.total_commissions.toFixed(1)}</strong>
                          </div>
                          <div>
                            <span>Day Turnover: </span>
                            <strong className="text-slate-300">৳{c.total_turnover.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong>
                          </div>
                          <div className="text-right">
                            <span>Top Stock: </span>
                            <strong className="text-emerald-400 truncate max-w-[100px] inline-block align-bottom">{c.best_performer}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Call-to-action */}
                      <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-amber-400/90 group-hover:text-amber-300">
                        <span>Click for Full P&L Statement</span>
                        <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* MODAL / DRAWER: FULL ITEMIZED P&L STATEMENT (LankaBangla & Dhaka Bank Format) */}
        {selectedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-[#12161f] border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-[#222d39] flex items-center justify-between bg-[#151a24]">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileText size={18} className="text-amber-400" />
                    <span>Profit & Loss Analysis Statement</span>
                    <span className="text-xs font-mono font-normal text-slate-400">
                      • {statement?.date ?? selectedDate}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Official automated brokerage statement compliant with LankaBangla iBroker & Dhaka Bank standards.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={triggerPrint}
                    className="flex items-center gap-1.5 rounded-lg bg-[#1a212d] hover:bg-[#222d39] text-slate-300 px-3 py-1.5 text-xs font-mono border border-slate-700 transition"
                  >
                    <Printer size={13} />
                    <span>Print Statement</span>
                  </button>
                  <button
                    type="button"
                    onClick={closeStatementModal}
                    className="text-slate-400 hover:text-white p-1 rounded-lg"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 font-mono text-xs">
                {loadingStatement ? (
                  <div className="py-16 text-center text-slate-500">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-amber-400" />
                    Generating full statement for {selectedDate}...
                  </div>
                ) : statement ? (
                  <>
                    {/* Investor Header */}
                    <div className="rounded-xl bg-[#0c0d10] p-4 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Investor Name</span>
                        <strong className="text-white">{statement.investor_profile.name}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Investor Code</span>
                        <strong className="text-white">{statement.investor_profile.investor_code}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">BO Identification</span>
                        <strong className="text-white">{statement.investor_profile.bo_id}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Broker / TREC</span>
                        <strong className="text-white">{statement.investor_profile.broker}</strong>
                      </div>
                    </div>

                    {/* Detailed P&L Breakdown Table */}
                    <div className="rounded-xl bg-[#0c0d10] p-4 border border-slate-800 space-y-2.5">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
                        Financial Statement Breakdown
                      </h4>

                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">Total Gross Turnover:</span>
                        <strong className="text-white">৳{statement.financial_summary.gross_turnover.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">DSE Brokerage Commission (0.4%):</span>
                        <strong className="text-amber-400">-৳{statement.financial_summary.brokerage_fees.toFixed(2)}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">CDBL & Regulatory Charges:</span>
                        <strong className="text-amber-400">-৳{statement.financial_summary.cdbl_charges.toFixed(2)}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">Gross Realized Gain / (Loss):</span>
                        <strong className={statement.financial_summary.realized_gain_loss >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          ৳{statement.financial_summary.realized_gain_loss.toFixed(2)}
                        </strong>
                      </div>
                      {statement.is_today && (
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400">Active Open Holdings Unrealized P&L:</span>
                          <strong className={statement.financial_summary.unrealized_gain_loss >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            ৳{statement.financial_summary.unrealized_gain_loss.toFixed(2)}
                          </strong>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 text-sm font-bold">
                        <span className="text-slate-200">Net Session Profit / (Loss):</span>
                        <span className={statement.financial_summary.net_session_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {statement.financial_summary.net_session_profit >= 0 ? `+৳${statement.financial_summary.net_session_profit.toFixed(2)}` : `-৳${Math.abs(statement.financial_summary.net_session_profit).toFixed(2)}`}
                        </span>
                      </div>
                    </div>

                    {/* Trades Executed On This Date */}
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                        Trades Executed On {selectedDate} ({statement.executed_orders.length})
                      </h4>
                      <div className="rounded-xl border border-slate-800 bg-[#0c0d10] overflow-hidden">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="border-b border-slate-800 bg-[#161a24] text-slate-400 text-[10px] uppercase">
                              <th className="py-2 px-3">Time</th>
                              <th className="py-2 px-3">Symbol</th>
                              <th className="py-2 px-3">Side</th>
                              <th className="py-2 px-3 text-right">Qty</th>
                              <th className="py-2 px-3 text-right">Price</th>
                              <th className="py-2 px-3 text-right">Value</th>
                              <th className="py-2 px-3 text-right">Fee</th>
                              <th className="py-2 px-3">Strategy</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {statement.executed_orders.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="py-4 text-center text-slate-500">
                                  No trade tickets executed on this calendar date.
                                </td>
                              </tr>
                            ) : (
                              statement.executed_orders.map((t, idx) => (
                                <tr key={idx} className="hover:bg-[#12161f]">
                                  <td className="py-2 px-3 text-slate-400 text-[11px]">
                                    {(t.executed_at || '').slice(11, 19)}
                                  </td>
                                  <td className="py-2 px-3 font-bold text-white">{t.symbol}</td>
                                  <td className="py-2 px-3">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                      {t.side}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right text-slate-200">{t.quantity.toLocaleString()}</td>
                                  <td className="py-2 px-3 text-right text-white">৳{t.price.toFixed(2)}</td>
                                  <td className="py-2 px-3 text-right text-slate-300">৳{(t.order_value || t.quantity * t.price).toFixed(1)}</td>
                                  <td className="py-2 px-3 text-right text-amber-400">৳{(t.commission || 0).toFixed(1)}</td>
                                  <td className="py-2 px-3 text-slate-400 text-[11px] truncate max-w-[140px]">{t.notes || 'Breakout'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD REAL STOCK POSITION */}
        {showAddHolding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-[#12161f] border border-slate-700 rounded-xl max-w-md w-full p-5 space-y-4 font-mono text-xs shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="font-bold text-white text-sm">Add Real Stock Holding</span>
                <button type="button" onClick={() => setShowAddHolding(false)} className="text-slate-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddRealPosition} className="space-y-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Trading Code (Symbol)</label>
                  <input
                    type="text"
                    value={newSym}
                    onChange={(e) => setNewSym(e.target.value.toUpperCase())}
                    placeholder="e.g. GP, BATBC, SQURPHARMA"
                    className="w-full rounded bg-[#0c0d10] px-3 py-2 text-white border border-slate-700 uppercase"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Total Quantity</label>
                    <input
                      type="number"
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                      className="w-full rounded bg-[#0c0d10] px-3 py-2 text-white border border-slate-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Average Cost (৳)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newCost}
                      onChange={(e) => setNewCost(e.target.value)}
                      className="w-full rounded bg-[#0c0d10] px-3 py-2 text-white border border-slate-700"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Instrument Group</label>
                  <select
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value)}
                    className="w-full rounded bg-[#0c0d10] px-3 py-2 text-white border border-slate-700"
                  >
                    <option value="A">Group A (Regular Dividend)</option>
                    <option value="B">Group B</option>
                    <option value="N">Group N (New Listing)</option>
                    <option value="Z">Group Z</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 rounded bg-amber-400 py-2 font-bold text-slate-950 hover:bg-amber-300 transition text-xs"
                >
                  Save to Real Portfolio
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: UPDATE MATURE CASH BALANCE */}
        {showEditBalance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-[#12161f] border border-slate-700 rounded-xl max-w-sm w-full p-5 space-y-4 font-mono text-xs shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="font-bold text-white text-sm">Update Cash Balance</span>
                <button type="button" onClick={() => setShowEditBalance(false)} className="text-slate-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveMatureBalance} className="space-y-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Mature Balance (৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={matureBalInput}
                    onChange={(e) => setMatureBalInput(e.target.value)}
                    className="w-full rounded bg-[#0c0d10] px-3 py-2 text-white border border-slate-700 text-sm font-bold"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Updates your mature cash & purchase power on the Dhaka Bank / LankaBangla statement.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 rounded bg-amber-400 py-2 font-bold text-slate-950 hover:bg-amber-300 transition text-xs"
                >
                  Save Balance
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

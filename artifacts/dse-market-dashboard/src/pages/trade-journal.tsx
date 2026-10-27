import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Sidebar } from '@/components/sidebar';

type DateFilterType = 'today' | 'yesterday' | '7days' | 'all';

interface TradeTicket {
  order_id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  order_type: string;
  quantity: number;
  price: number;
  order_value: number;
  commission: number;
  status: string;
  executed_at: string;
  stop_loss?: number;
  take_profit?: number;
  notes?: string;
  realized_pnl?: number;
  settlement_cycle?: string;
  settlement_date?: string;
}

interface AccountData {
  total_account_equity: number;
  cash_balance: number;
  stock_holdings_value: number;
  net_pnl: number;
}

export default function TradeJournalPage() {
  const [tickets, setTickets] = useState<TradeTicket[]>([]);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningAutopilot, setRunningAutopilot] = useState<boolean>(false);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilterType>('today');
  const [searchSymbol, setSearchSymbol] = useState<string>('');
  const [sideFilter, setSideFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');

  const fetchJournal = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agents/broker/account');
      if (res.ok) {
        const data = await res.json();
        setAccount(data.account || null);
        const blotter: TradeTicket[] = data.order_blotter || [];
        setTickets(blotter);
      }
    } catch (err) {
      console.error('Failed fetching journal:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournal();
  }, []);

  const triggerAutopilot = async () => {
    setRunningAutopilot(true);
    try {
      const res = await fetch('/api/agents/broker/autopilot/run', { method: 'POST' });
      if (res.ok) {
        await fetchJournal();
      }
    } catch (err) {
      console.error('Autopilot run failed:', err);
    } finally {
      setRunningAutopilot(false);
    }
  };

  // Helper date strings
  const { todayStr, yesterdayStr, sevenDaysAgoStr } = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yesterday = y.toISOString().slice(0, 10);

    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 7);
    const sevenDaysAgo = d7.toISOString().slice(0, 10);

    return { todayStr: today, yesterdayStr: yesterday, sevenDaysAgoStr: sevenDaysAgo };
  }, []);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const execDate = (t.executed_at || '').slice(0, 10);

      // Date filtering
      if (dateFilter === 'today' && execDate !== todayStr) return false;
      if (dateFilter === 'yesterday' && execDate !== yesterdayStr) return false;
      if (dateFilter === '7days' && (execDate < sevenDaysAgoStr || execDate > todayStr)) return false;

      // Symbol search
      if (searchSymbol && !t.symbol.toLowerCase().includes(searchSymbol.toLowerCase().trim())) {
        return false;
      }

      // Side filter
      if (sideFilter !== 'ALL' && t.side !== sideFilter) {
        return false;
      }

      return true;
    });
  }, [tickets, dateFilter, todayStr, yesterdayStr, sevenDaysAgoStr, searchSymbol, sideFilter]);

  // Selected period summary stats
  const stats = useMemo(() => {
    let turnover = 0;
    let fees = 0;
    let realizedPnl = 0;
    let buyCount = 0;
    let sellCount = 0;

    for (const t of filteredTickets) {
      turnover += t.order_value || 0;
      fees += t.commission || 0;
      if (t.side === 'BUY') buyCount++;
      if (t.side === 'SELL') {
        sellCount++;
        realizedPnl += t.realized_pnl || 0;
      }
    }

    const netPeriod = realizedPnl - fees;

    return {
      totalTrades: filteredTickets.length,
      buyCount,
      sellCount,
      turnover,
      fees,
      realizedPnl,
      netPeriod,
    };
  }, [filteredTickets]);

  const exportCSV = () => {
    if (filteredTickets.length === 0) return;
    const headers = ['Order ID', 'Date & Time', 'Symbol', 'Side', 'Qty', 'Price', 'Value', 'Fee', 'Stop Loss', 'Take Profit', 'Notes'];
    const rows = filteredTickets.map((t) => [
      t.order_id,
      t.executed_at,
      t.symbol,
      t.side,
      t.quantity,
      t.price,
      t.order_value,
      t.commission,
      t.stop_loss ?? '',
      t.take_profit ?? '',
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dse_trade_journal_${dateFilter}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0c0d10] text-slate-100 font-sans">
      <Sidebar active="journal" />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="h-[60px] shrink-0 border-b border-[#222d39] bg-[#12161f] px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-amber-500/20 grid place-items-center text-amber-400">
              <BookOpen size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-white flex items-center gap-2">
                <span>Trade Journal</span>
                <span className="rounded bg-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[10px] font-mono">
                  Live Execution Log
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Institutional trade blotter tracking autonomous entries, fees, bracket orders, and P&L.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={triggerAutopilot}
              disabled={runningAutopilot}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold px-3 py-1.5 text-xs transition border border-amber-500/30 disabled:opacity-50"
            >
              <Zap size={14} className={runningAutopilot ? 'animate-spin' : 'text-amber-400'} />
              <span>{runningAutopilot ? 'Running Auto-Pilot...' : 'Run Auto-Pilot'}</span>
            </button>

            <button
              type="button"
              onClick={exportCSV}
              disabled={filteredTickets.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[#18212c] hover:bg-[#222d39] text-slate-300 px-3 py-1.5 text-xs font-medium transition border border-slate-700 disabled:opacity-40"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={fetchJournal}
              disabled={loading}
              title="Refresh journal"
              className="size-8 rounded-lg bg-[#18212c] hover:bg-[#222d39] grid place-items-center text-slate-400 hover:text-white border border-slate-700 transition"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6 space-y-5 max-w-7xl w-full mx-auto">
          {/* Top Period Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-[#12161f] p-4 font-mono">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                Selected Period P&L
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-xl font-bold ${
                    stats.netPeriod >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {stats.netPeriod >= 0 ? `+৳${stats.netPeriod.toLocaleString()}` : `-৳${Math.abs(stats.netPeriod).toLocaleString()}`}
                </span>
                {stats.netPeriod >= 0 ? (
                  <TrendingUp size={16} className="text-emerald-400" />
                ) : (
                  <TrendingDown size={16} className="text-rose-400" />
                )}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Net realized after 0.4% fees
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#12161f] p-4 font-mono">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                Total Trades Executed
              </span>
              <span className="text-xl font-bold text-white">{stats.totalTrades}</span>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {stats.buyCount} Buys • {stats.sellCount} Sells
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#12161f] p-4 font-mono">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                DSE Brokerage Fees (0.4%)
              </span>
              <span className="text-xl font-bold text-amber-400">
                ৳{stats.fees.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
              <span className="text-slate-500 text-[10px] mt-1 block">Commission paid to broker</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#12161f] p-4 font-mono">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                Account Total Equity
              </span>
              <span className="text-xl font-bold text-white">
                ৳{(account?.total_account_equity ?? 500000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
              <span className="text-[10px] text-emerald-400 mt-1 block">
                Cash: ৳{(account?.cash_balance ?? 500000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* Interactive Filters Bar */}
          <div className="rounded-xl border border-[#222d39] bg-[#12161f] p-3 flex flex-wrap items-center justify-between gap-3">
            {/* Date Segmented Filter (Today by default) */}
            <div className="flex items-center gap-1.5 bg-[#0c0d10] p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setDateFilter('today')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  dateFilter === 'today'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Today (Default)
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('yesterday')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  dateFilter === 'yesterday'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('7days')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  dateFilter === '7days'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  dateFilter === 'all'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All History
              </button>
            </div>

            {/* Side & Search Filter */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1 bg-[#0c0d10] px-2 py-1 rounded-lg border border-slate-800 text-xs">
                <Filter size={12} className="text-slate-500" />
                <select
                  value={sideFilter}
                  onChange={(e) => setSideFilter(e.target.value as any)}
                  className="bg-transparent text-slate-300 focus:outline-none text-xs font-mono cursor-pointer"
                >
                  <option value="ALL">All Actions</option>
                  <option value="BUY">BUY Only</option>
                  <option value="SELL">SELL Only</option>
                </select>
              </div>

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search Symbol..."
                  value={searchSymbol}
                  onChange={(e) => setSearchSymbol(e.target.value)}
                  className="h-8 pl-8 pr-3 rounded-lg bg-[#0c0d10] border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 w-40 uppercase font-mono"
                />
              </div>
            </div>
          </div>

          {/* Trade Journal Table View */}
          <div className="rounded-xl border border-[#222d39] bg-[#12161f] overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#222d39] bg-[#171c27] text-slate-400 text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Symbol</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4 text-right">Price (৳)</th>
                    <th className="py-3 px-4 text-right">Order Value</th>
                    <th className="py-3 px-4 text-right">Fee (0.4%)</th>
                    <th className="py-3 px-4 text-center">Stop Loss</th>
                    <th className="py-3 px-4 text-center">Take Profit</th>
                    <th className="py-3 px-4 text-center">DSE Settlement</th>
                    <th className="py-3 px-4">Strategy & Notes</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-500 font-mono">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-amber-400" />
                        Loading trade journal records...
                      </td>
                    </tr>
                  ) : filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-16 text-center text-slate-500 font-mono">
                        <Calendar size={32} className="mx-auto mb-2 text-slate-600" />
                        <p className="text-sm font-bold text-slate-300">
                          No trade records found for "{dateFilter === 'today' ? 'Today' : dateFilter}".
                        </p>
                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                          Auto-Pilot scans for breakouts during market hours (10:00 AM - 2:20 PM BST).
                          You can also click "Run Auto-Pilot" above to scan and trade on current data.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((t, idx) => {
                      const isBuy = t.side === 'BUY';
                      return (
                        <tr
                          key={t.order_id || idx}
                          className="hover:bg-[#181e2b] transition-colors"
                        >
                          {/* Date & Time */}
                          <td className="py-3 px-4 text-slate-300 whitespace-nowrap text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <Clock size={12} className="text-slate-500 shrink-0" />
                              <span>{t.executed_at || '-'}</span>
                            </div>
                          </td>

                          {/* Symbol */}
                          <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                            <span className="text-sm">{t.symbol}</span>
                          </td>

                          {/* Side */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold inline-flex items-center gap-1 ${
                                isBuy
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {t.side}
                            </span>
                          </td>

                          {/* Quantity */}
                          <td className="py-3 px-4 text-right font-medium text-slate-200">
                            {t.quantity.toLocaleString()}
                          </td>

                          {/* Price */}
                          <td className="py-3 px-4 text-right font-bold text-white">
                            ৳{t.price.toFixed(2)}
                          </td>

                          {/* Total Value */}
                          <td className="py-3 px-4 text-right text-slate-300 font-medium">
                            ৳{(t.order_value || t.quantity * t.price).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </td>

                          {/* Commission */}
                          <td className="py-3 px-4 text-right text-amber-400/90 font-medium text-[11px]">
                            ৳{(t.commission || 0).toFixed(1)}
                          </td>

                          {/* Stop Loss */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {t.stop_loss ? (
                              <span className="text-rose-400 text-[11px] font-bold">
                                ৳{t.stop_loss.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>

                          {/* Take Profit */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {t.take_profit ? (
                              <span className="text-emerald-400 text-[11px] font-bold">
                                ৳{t.take_profit.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>

                          {/* DSE Settlement */}
                          <td className="py-3 px-4 text-center whitespace-nowrap font-mono text-[11px]">
                            {isBuy ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
                                🔒 T+2 {t.settlement_date ? `(${t.settlement_date.slice(5)})` : ''}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                                ✓ Matured Exit
                              </span>
                            )}
                          </td>

                          {/* Notes / Strategy */}
                          <td className="py-3 px-4 text-slate-400 text-[11px] max-w-[200px] truncate" title={t.notes || ''}>
                            {t.notes || 'Auto-Pilot Breakout Signal'}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              <CheckCircle2 size={11} />
                              FILLED
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary */}
            <div className="border-t border-[#222d39] bg-[#141822] px-6 py-3 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Showing {filteredTickets.length} of {tickets.length} total trade records</span>
              <span className="text-slate-500 text-[11px]">Auto-Pilot DSE Execution Engine • v2.0</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

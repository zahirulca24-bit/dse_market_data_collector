import { useEffect, useMemo, useState } from 'react';
import { Database, RefreshCw, Search } from 'lucide-react';
import { useGetMarketStocks } from '@workspace/api-client-react';
import { Sidebar } from '@/components/sidebar';

type PhaseSummary = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  symbolsWithData: number;
  totalStocks: number;
  remainingStocks: number;
  rows: number;
  coveragePct: number;
  status: string;
};

type CoverageRow = {
  sector: string;
  symbol: string;
  earliestDate: string | null;
  latestDate: string | null;
  rows: number;
  targetPeriod: string;
  coveragePct: number | null;
  status: string;
};

type Monitoring = {
  supabase: { connected: boolean; status: string; error?: string };
  dataSave: { status: string; lastResult: string };
  engine: {
    status: string;
    currentSector: string | null;
    currentStocks: string[];
    currentStockCount: number;
    currentTask: string;
    collectionMode: string;
    intervalSeconds: number;
  };
  universe: {
    totalSectors: number;
    sectorsWithHistory: number;
    remainingSectors: number;
    totalStocks: number;
    stocksWithHistory: number;
    remainingStocks: number;
    historicalCoveragePct: number;
  };
  phases: PhaseSummary[];
  lastRun: { timestamp: string | null; status: string; rowsSaved: number; error?: string | null };
  nextRun: { expectedAt: string | null; intervalSeconds: number; note?: string };
  latestSnapshot: { timestamp: string | null; rows: number };
  dailyHistory: { available: boolean; error?: string | null; rowsLoadedForMonitoring: number };
  coverageRows: CoverageRow[];
};

type DailyPoint = {
  time: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
  valueMn?: number | null;
  source?: string;
};

function fmtTime(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function tone(value: string) {
  const normalized = value.toLowerCase();
  if (['connected', 'success', 'complete', 'saving', 'running'].includes(normalized)) return 'text-emerald-700';
  if (['failed', 'error', 'disconnected'].includes(normalized)) return 'text-rose-700';
  return 'text-amber-700';
}

function SummaryCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="rounded-lg border border-border bg-card p-4">
    <p className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</p>
    <p className="mt-2 text-xl font-semibold">{value}</p>
    {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
  </div>;
}

export default function HistoricalExplorer() {
  const [symbol, setSymbol] = useState('GP');
  const [monitoring, setMonitoring] = useState<Monitoring | null>(null);
  const [monitorError, setMonitorError] = useState('');
  const [history, setHistory] = useState<DailyPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const stocksQuery = useGetMarketStocks();

  const loadMonitoring = async () => {
    try {
      const response = await fetch('/api/market/monitoring');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as Monitoring;
      setMonitoring(data);
      setMonitorError('');
    } catch (error) {
      setMonitorError(error instanceof Error ? error.message : 'Monitoring unavailable');
    }
  };

  useEffect(() => {
    void loadMonitoring();
    const timer = window.setInterval(() => void loadMonitoring(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const tick = () => {
      const next = monitoring?.nextRun.expectedAt;
      if (!next) return setSecondsLeft(null);
      const diff = Math.ceil((new Date(next).getTime() - Date.now()) / 1000);
      setSecondsLeft(Math.max(diff, 0));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [monitoring?.nextRun.expectedAt]);

  useEffect(() => {
    if (!symbol) return;
    setHistoryLoading(true);
    fetch(`/api/market/stocks/${encodeURIComponent(symbol)}/daily-history`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<DailyPoint[]>;
      })
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [symbol]);

  const phaseById = useMemo(() => new Map((monitoring?.phases ?? []).map((phase) => [phase.id, phase])), [monitoring?.phases]);
  const current = phaseById.get('current_period');
  const phase1 = phaseById.get('phase1');
  const phase2 = phaseById.get('phase2');
  const phase3 = phaseById.get('phase3');

  const countdown = secondsLeft === null
    ? 'N/A'
    : secondsLeft === 0
      ? 'Due / overdue'
      : `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return <div className="flex min-h-[100dvh] bg-background text-foreground">
    <Sidebar active="historical" />
    <main className="min-w-0 flex-1 terminal-grid px-5 py-8 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">DSE / Historical explorer</p>
            <h1 className="mt-1 text-3xl font-semibold">Historical data & collector monitor</h1>
            <p className="mt-2 text-sm text-muted-foreground">Verify Supabase storage, collector activity and daily OHLCV coverage.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void loadMonitoring()} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent hover:text-accent-foreground transition-colors">
              <RefreshCw size={14} /> Refresh
            </button>
            <button type="button" onClick={triggerManualScan} disabled={triggering} className="inline-flex items-center gap-2 rounded-md border border-transparent bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
              {triggering ? <RefreshCw size={14} className="animate-spin" /> : <Database size={14} />} Manual Scan
            </button>
          </div>
        </div>

        {monitorError ? <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">Monitoring API error: {monitorError}</div> : null}

        <section className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Supabase" value={monitoring?.supabase.connected ? 'Connected' : 'Disconnected'} note={monitoring?.supabase.status ?? 'Checking…'} />
          <SummaryCard label="Data save status" value={monitoring?.dataSave.status ?? 'Checking…'} note={`Last result: ${monitoring?.dataSave.lastResult ?? 'N/A'}`} />
          <SummaryCard label="Current sector" value={monitoring?.engine.currentSector ?? 'N/A'} note={monitoring?.engine.collectionMode === 'market-wide' ? 'Collector runs market-wide, not sector-by-sector' : monitoring?.engine.currentTask} />
          <SummaryCard label="Current stocks" value={monitoring?.engine.currentStockCount ? String(monitoring.engine.currentStockCount) : 'N/A'} note={monitoring?.engine.currentStocks?.length ? monitoring.engine.currentStocks.join(', ') : monitoring?.engine.currentTask ?? 'Waiting'} />

          <SummaryCard label="Total sectors" value={monitoring ? String(monitoring.universe.totalSectors) : '—'} note={monitoring ? `${monitoring.universe.sectorsWithHistory} with history · ${monitoring.universe.remainingSectors} remaining` : undefined} />
          <SummaryCard label="Total stocks" value={monitoring ? String(monitoring.universe.totalStocks) : '—'} note={monitoring ? `${monitoring.universe.stocksWithHistory} with history · ${monitoring.universe.remainingStocks} remaining` : undefined} />
          <SummaryCard label="Historical coverage" value={monitoring ? `${monitoring.universe.historicalCoveragePct.toFixed(2)}%` : '—'} note="Symbols with any stored daily history" />
          <SummaryCard label="Engine status" value={monitoring?.engine.status ?? 'Checking…'} note={monitoring?.engine.currentTask ?? undefined} />

          <SummaryCard label="Last engine run" value={fmtTime(monitoring?.lastRun.timestamp)} note={monitoring ? `${monitoring.lastRun.status} · ${monitoring.lastRun.rowsSaved} rows` : undefined} />
          <SummaryCard label="Next expected run" value={countdown} note={monitoring?.nextRun.expectedAt ? fmtTime(monitoring.nextRun.expectedAt) : monitoring?.nextRun.note} />
          <SummaryCard label="Latest snapshot" value={fmtTime(monitoring?.latestSnapshot.timestamp)} note={monitoring ? `${monitoring.latestSnapshot.rows} market rows` : undefined} />
          <SummaryCard label="Daily history table" value={monitoring?.dailyHistory.available ? 'Available' : 'Unavailable'} note={monitoring ? `${monitoring.dailyHistory.rowsLoadedForMonitoring.toLocaleString()} rows scanned for coverage` : undefined} />
        </section>

        <section className="mt-5 grid gap-3 lg:grid-cols-4">
          {[current, phase1, phase2, phase3].map((phase, index) => {
            const fallback = ['Current Period', 'Phase 1', 'Phase 2', 'Phase 3'][index];
            return <div key={phase?.id ?? fallback} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{phase?.label ?? fallback}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{phase ? `${phase.startDate} → ${phase.endDate}` : 'Pending'}</p>
                </div>
                <Database size={16} className="text-muted-foreground" />
              </div>
              <p className="mt-4 text-2xl font-semibold">{phase ? `${phase.symbolsWithData} / ${phase.totalStocks}` : 'N/A'}</p>
              <p className="mt-1 text-xs text-muted-foreground">{phase ? `${phase.rows.toLocaleString()} rows · ${phase.coveragePct.toFixed(2)}%` : 'No verified data'}</p>
              <p className={`mt-3 font-mono text-[10px] uppercase ${tone(phase?.status ?? 'pending')}`}>{phase?.status ?? 'pending'}</p>
            </div>;
          })}
        </section>

        <section className="mt-5 rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold">Historical coverage by stock</h2>
          <p className="mt-1 text-xs text-muted-foreground">Only verified rows from dse_daily_history are shown. Missing data is not treated as complete.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="pb-3">Sector</th><th>Symbol</th><th>Earliest</th><th>Latest</th><th>Rows</th><th>Target period</th><th>Coverage</th><th>Status</th></tr>
              </thead>
              <tbody>
                {monitoring?.coverageRows.map((row) => <tr key={`${row.symbol}-${row.targetPeriod}`} className="border-b border-border/60 font-mono text-xs">
                  <td className="py-3">{row.sector}</td><td className="font-semibold">{row.symbol}</td><td>{row.earliestDate ?? 'N/A'}</td><td>{row.latestDate ?? 'N/A'}</td><td>{row.rows}</td><td>{row.targetPeriod}</td><td>{row.coveragePct === null ? 'N/A' : `${row.coveragePct.toFixed(2)}%`}</td><td>{row.status}</td>
                </tr>)}
              </tbody>
            </table>
            {!monitoring?.coverageRows.length ? <p className="py-8 text-sm text-muted-foreground">No verified daily-history coverage rows yet.</p> : null}
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-border bg-card p-5">
          <label className="block text-xs font-semibold" htmlFor="historical-symbol">Daily OHLCV explorer</label>
          <div className="mt-2 flex max-w-md gap-2">
            <div className="relative flex-1"><Search size={14} className="absolute left-3 top-3 text-muted-foreground" /><input id="historical-symbol" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 font-mono text-sm uppercase" /></div>
            <select aria-label="Choose stock" value={symbol} onChange={(event) => setSymbol(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm">{stocksQuery.data?.map((stock) => <option key={stock.symbol} value={stock.symbol}>{stock.symbol}</option>)}</select>
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold">{symbol || 'Select a symbol'} daily history</h2>
          <p className="mt-1 text-xs text-muted-foreground">Stored day candles from dse_daily_history.</p>
          {historyLoading ? <p className="py-12 text-sm text-muted-foreground">Loading saved daily history…</p> : !history.length ? <p className="py-12 text-sm text-muted-foreground">No saved daily OHLCV history for this symbol.</p> : <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="pb-3">Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th><th>Value (Mn)</th></tr></thead>
              <tbody>{history.slice().reverse().map((row) => <tr key={row.time} className="border-b border-border/60 font-mono text-xs"><td className="py-3">{row.time}</td><td>{row.open ?? 'N/A'}</td><td>{row.high ?? 'N/A'}</td><td>{row.low ?? 'N/A'}</td><td>{row.close ?? 'N/A'}</td><td>{row.volume.toLocaleString()}</td><td>{row.valueMn ?? 'N/A'}</td></tr>)}</tbody>
            </table>
          </div>}
        </section>
      </div>
    </main>
  </div>;
}

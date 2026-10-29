import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import {
  Search,
  Heart,
  TrendingUp,
  TrendingDown,
  MousePointer,
  Slash,
  Minus,
  Sliders,
  Ruler,
  Trash2,
  RotateCcw,
  Camera,
  Maximize2,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Type,
  Flame,
  BarChart2,
  Briefcase,
  LayoutGrid,
  ShieldAlert,
  Plus,
  X,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateVolumeMA,
  calculateBollingerBands,
  calculateStochasticRSI,
  calculateVWAP,
  calculateATR,
} from '@/lib/indicators';
import {
  ChartDrawingOverlay,
  type DrawingTool,
  type DrawingItem,
} from '@/components/chart-drawing-overlay';

interface StockSummary {
  symbol: string;
  sector?: string;
  ltp?: number;
  ycp?: number;
  change?: number;
  high?: number;
  low?: number;
  volume?: number;
}

interface RawDailyPoint {
  time: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
}

interface LegendValues {
  time?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  change?: number;
  changePct?: number;
  volume?: number;
  volMA20?: number;
  ema20?: number;
  ema50?: number;
  ma20?: number;
  rsi?: number;
  macd?: number;
  signal?: number;
  hist?: number;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
  vwap?: number;
  atr?: number;
  stoploss?: number;
}

interface PortfolioPosition {
  id: string;
  symbol: string;
  buyPrice: number;
  quantity: number;
  buyDate: string;
}

type RightDockTab = 'favorites' | 'stats' | 'top_shares' | 'portfolio';

export default function AdvancedChartPage() {
  const [stocks, setStocks] = useState<StockSummary[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('GP');
  const [historyData, setHistoryData] = useState<RawDailyPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [stockSearch, setStockSearch] = useState<string>('');

  // UI Panels
  const [showGlobalNav, setShowGlobalNav] = useState<boolean>(true);
  const [showDrawingToolbar, setShowDrawingToolbar] = useState<boolean>(true);
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(true);
  const [activeRightTab, setActiveRightTab] = useState<RightDockTab>('portfolio');

  // Accordion states
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    trade: true,
    trading_stock: false,
    uptrend: false,
    sme: false,
    top_gainers: true,
    top_losers: false,
  });

  // Favorites
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dse_chart_favorites');
      return saved ? JSON.parse(saved) : ['GP', 'BATBC', 'SQURPH', 'RENATA', 'BRACBANK', 'BEXIMCO', 'LOVELLO', 'FEKDIL'];
    } catch {
      return ['GP', 'BATBC', 'SQURPH', 'RENATA', 'BRACBANK', 'BEXIMCO', 'LOVELLO', 'FEKDIL'];
    }
  });

  // Paper Broker Portfolio Management (Direct Agent 8 & Auto-Pilot Sync)
  const [paperAccount, setPaperAccount] = useState<{
    starting_cash: number;
    cash_balance: number;
    stock_holdings_value: number;
    total_account_equity: number;
    total_unrealized_pnl: number;
    total_realized_pnl: number;
    net_pnl: number;
  }>({
    starting_cash: 500000,
    cash_balance: 500000,
    stock_holdings_value: 0,
    total_account_equity: 500000,
    total_unrealized_pnl: 0,
    total_realized_pnl: 0,
    net_pnl: 0,
  });

  const [paperPositions, setPaperPositions] = useState<Array<{
    symbol: string;
    quantity: number;
    average_buy_price: number;
    cost_basis: number;
    current_ltp: number;
    market_value: number;
    unrealized_pnl: number;
    unrealized_pnl_pct: number;
    stop_loss?: number;
    take_profit?: number;
    opened_at?: string;
  }>>([]);

  const [paperLoading, setPaperLoading] = useState<boolean>(false);
  const [runningAutopilot, setRunningAutopilot] = useState<boolean>(false);

  const fetchPaperBroker = useCallback(() => {
    setPaperLoading(true);
    fetch('/api/agents/broker/account')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.status === 'success' && data.account) {
          setPaperAccount(data.account);
          setPaperPositions(data.positions || []);
        }
      })
      .catch((e) => console.error('Error fetching paper broker:', e))
      .finally(() => setPaperLoading(false));
  }, []);

  const triggerAutopilot = async () => {
    setRunningAutopilot(true);
    try {
      const res = await fetch('/api/agents/broker/autopilot/run', { method: 'POST' });
      const data = await res.json();
      if (data && data.status === 'success') {
        fetchPaperBroker();
      }
    } catch (e) {
      console.error('Error running autopilot:', e);
    } finally {
      setRunningAutopilot(false);
    }
  };

  useEffect(() => {
    fetchPaperBroker();
    const iv = setInterval(fetchPaperBroker, 15000);
    return () => clearInterval(iv);
  }, [fetchPaperBroker]);

  // Add stock form state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newSymbol, setNewSymbol] = useState<string>('GP');
  const [newBuyPrice, setNewBuyPrice] = useState<string>('240');
  const [newQuantity, setNewQuantity] = useState<string>('100');

  // 4-Tier Multi-Pane Indicators (Matching TradingView Pro Setup):
  const [showEMA, setShowEMA] = useState<boolean>(true);
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [showRSI, setShowRSI] = useState<boolean>(true);
  const [showMACD, setShowMACD] = useState<boolean>(true);
  const [showMA20, setShowMA20] = useState<boolean>(false);
  const [showBB, setShowBB] = useState<boolean>(false);
  const [showVWAP, setShowVWAP] = useState<boolean>(false);
  const [showATR, setShowATR] = useState<boolean>(true);
  const [activeTimeframe, setActiveTimeframe] = useState<string>('1d');

  // Drawing tools
  const [activeTool, setActiveTool] = useState<DrawingTool>('cursor');
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);

  // Chart Container Refs
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const [chartDimensions, setChartDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });

  // Series refs
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const volMASeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Floating Legend values
  const [legend, setLegend] = useState<LegendValues>({});

  // 1. Fetch all stocks on mount
  useEffect(() => {
    fetch('/api/market/stocks')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: StockSummary[]) => {
        if (Array.isArray(data)) {
          setStocks(data);
          if (data.length > 0 && !data.some((s) => s.symbol === 'GP')) {
            setSelectedSymbol(data[0].symbol);
          }
        }
      })
      .catch((err) => console.error('Error fetching stock list:', err));
  }, []);

  // 2. Fetch daily history for selected symbol
  useEffect(() => {
    if (!selectedSymbol) return;
    setLoading(true);
    fetch(`/api/market/stocks/${encodeURIComponent(selectedSymbol)}/daily-history`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: RawDailyPoint[]) => {
        if (Array.isArray(data)) {
          const sorted = data
            .filter((d) => d.open && d.high && d.low && d.close)
            .sort((a, b) => a.time.localeCompare(b.time));
          setHistoryData(sorted);
        } else {
          setHistoryData([]);
        }
      })
      .catch((err) => {
        console.error('Error loading history:', err);
        setHistoryData([]);
      })
      .finally(() => setLoading(false));
  }, [selectedSymbol]);

  // Persist Favorites
  const toggleFavorite = (symbol: string) => {
    setFavorites((prev) => {
      const next = prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol];
      try {
        localStorage.setItem('dse_chart_favorites', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  // Direct Paper Broker Execution Handlers
  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newBuyPrice);
    const qty = parseInt(newQuantity, 10);
    if (!newSymbol || isNaN(price) || isNaN(qty) || qty <= 0) return;

    const sl = parseFloat((price * 0.95).toFixed(1));
    const tp = parseFloat((price * 1.10).toFixed(1));

    try {
      const res = await fetch('/api/agents/broker/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: newSymbol.toUpperCase(),
          side: 'BUY',
          quantity: qty,
          price,
          order_type: 'LIMIT',
          stop_loss: sl,
          take_profit: tp,
          notes: 'Manual Paper Buy from Advanced Chart',
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchPaperBroker();
        setShowAddForm(false);
      } else {
        alert(data.message || 'Failed to place paper order');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClosePosition = async (sym: string, qty: number, ltp: number) => {
    if (!confirm(`Are you sure you want to sell ${sym} (${qty} shares @ ৳${ltp.toFixed(1)})?`)) return;
    try {
      const res = await fetch('/api/agents/broker/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: sym,
          side: 'SELL',
          quantity: qty,
          price: ltp,
          order_type: 'MARKET',
          notes: 'Manual Paper Exit from Advanced Chart',
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchPaperBroker();
      } else {
        alert(data.message || 'Failed to close position');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 3. Initialize Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    setChartDimensions({ width, height });

    const chart = createChart(container, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0c0d10' },
        textColor: '#848e9c',
      },
      grid: {
        vertLines: { color: 'rgba(30, 35, 45, 0.45)' },
        horzLines: { color: 'rgba(30, 35, 45, 0.45)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#556070',
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: '#556070',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: '#1e222d',
        autoScale: true,
      },
      timeScale: {
        borderColor: '#1e222d',
        timeVisible: true,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
    });

    chartInstanceRef.current = chart;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width: newW, height: newH } = entries[0].contentRect;
      if (newW > 0 && newH > 0) {
        chart.applyOptions({ width: newW, height: newH });
        setChartDimensions({ width: newW, height: newH });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartInstanceRef.current = null;
    };
  }, []);

  // 4. Update Series and Multi-Pane Architecture
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart || historyData.length === 0) return;

    try {
      if (candleSeriesRef.current) chart.removeSeries(candleSeriesRef.current);
      if (ema20SeriesRef.current) chart.removeSeries(ema20SeriesRef.current);
      if (ema50SeriesRef.current) chart.removeSeries(ema50SeriesRef.current);
      if (volumeSeriesRef.current) chart.removeSeries(volumeSeriesRef.current);
      if (volMASeriesRef.current) chart.removeSeries(volMASeriesRef.current);
      if (ma20SeriesRef.current) chart.removeSeries(ma20SeriesRef.current);
      if (bbUpperRef.current) chart.removeSeries(bbUpperRef.current);
      if (bbMiddleRef.current) chart.removeSeries(bbMiddleRef.current);
      if (bbLowerRef.current) chart.removeSeries(bbLowerRef.current);
      if (vwapRef.current) chart.removeSeries(vwapRef.current);
      if (rsiSeriesRef.current) chart.removeSeries(rsiSeriesRef.current);
      if (macdLineRef.current) chart.removeSeries(macdLineRef.current);
      if (signalLineRef.current) chart.removeSeries(signalLineRef.current);
      if (macdHistRef.current) chart.removeSeries(macdHistRef.current);
    } catch (e) {
      console.warn('Series cleanup notice:', e);
    }

    candleSeriesRef.current = null;
    ema20SeriesRef.current = null;
    ema50SeriesRef.current = null;
    volumeSeriesRef.current = null;
    volMASeriesRef.current = null;
    ma20SeriesRef.current = null;
    bbUpperRef.current = null;
    bbMiddleRef.current = null;
    bbLowerRef.current = null;
    vwapRef.current = null;
    rsiSeriesRef.current = null;
    macdLineRef.current = null;
    signalLineRef.current = null;
    macdHistRef.current = null;

    // Multi-Pane Dynamic Indexing
    const candlePane = 0;
    let currentPane = 1;
    const volumePane = showVolume ? currentPane++ : -1;
    const rsiPane = showRSI ? currentPane++ : -1;
    const macdPane = showMACD ? currentPane++ : -1;

    // 1. Candlestick Series (Main Pane 0)
    const candleSeries = chart.addSeries(
      CandlestickSeries,
      {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      },
      candlePane
    );
    candleSeriesRef.current = candleSeries;

    const candleData = historyData.map((d) => ({
      time: d.time,
      open: d.open ?? 0,
      high: d.high ?? 0,
      low: d.low ?? 0,
      close: d.close ?? 0,
    }));
    candleSeries.setData(candleData);

    const closeTimePoints = historyData.map((d) => ({
      time: d.time,
      close: d.close ?? 0,
    }));

    const fullCandles = historyData.map((d) => ({
      time: d.time,
      open: d.open ?? 0,
      high: d.high ?? 0,
      low: d.low ?? 0,
      close: d.close ?? 0,
      volume: d.volume,
    }));

    // EMA 20 & EMA 50 on Main Candlestick Pane
    let ema20Data: { time: string; value: number }[] = [];
    let ema50Data: { time: string; value: number }[] = [];
    if (showEMA) {
      ema20Data = calculateEMA(closeTimePoints, 20);
      const ema20Series = chart.addSeries(
        LineSeries,
        {
          color: '#f59e0b', // Amber / Yellow (TradingView style)
          lineWidth: 2,
          title: 'EMA 20',
        },
        candlePane
      );
      ema20Series.setData(ema20Data);
      ema20SeriesRef.current = ema20Series;

      ema50Data = calculateEMA(closeTimePoints, 50);
      const ema50Series = chart.addSeries(
        LineSeries,
        {
          color: '#38bdf8', // Blue (TradingView style)
          lineWidth: 2,
          title: 'EMA 50',
        },
        candlePane
      );
      ema50Series.setData(ema50Data);
      ema50SeriesRef.current = ema50Series;
    }

    // Support Line on Main Candlestick Pane
    if (fullCandles.length > 5) {
      const recentCandles = fullCandles.slice(-25);
      const supportVal = Math.min(...recentCandles.map((c) => c.low));
      candleSeries.createPriceLine({
        price: supportVal,
        color: '#00e5ff',
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `Support ${supportVal.toFixed(1)}`,
      });
    }

    // Optional Overlays on Main Pane
    let ma20Data: { time: string; value: number }[] = [];
    if (showMA20) {
      ma20Data = calculateSMA(closeTimePoints, 20);
      const ma20Series = chart.addSeries(
        LineSeries,
        { color: '#29b6f6', lineWidth: 1, title: 'MA 20' },
        candlePane
      );
      ma20Series.setData(ma20Data);
      ma20SeriesRef.current = ma20Series;
    }

    let bbResult: ReturnType<typeof calculateBollingerBands> | null = null;
    if (showBB) {
      bbResult = calculateBollingerBands(closeTimePoints, 20, 2);
      const upperSeries = chart.addSeries(LineSeries, { color: 'rgba(56, 189, 248, 0.65)', lineWidth: 1, title: 'BB Upper' }, candlePane);
      upperSeries.setData(bbResult.upper);
      bbUpperRef.current = upperSeries;

      const middleSeries = chart.addSeries(LineSeries, { color: 'rgba(148, 163, 184, 0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB Mid' }, candlePane);
      middleSeries.setData(bbResult.middle);
      bbMiddleRef.current = middleSeries;

      const lowerSeries = chart.addSeries(LineSeries, { color: 'rgba(56, 189, 248, 0.65)', lineWidth: 1, title: 'BB Lower' }, candlePane);
      lowerSeries.setData(bbResult.lower);
      bbLowerRef.current = lowerSeries;
    }

    let vwapData: { time: string; value: number }[] = [];
    if (showVWAP) {
      vwapData = calculateVWAP(fullCandles);
      const vwapSeries = chart.addSeries(LineSeries, { color: '#d946ef', lineWidth: 2, title: 'VWAP' }, candlePane);
      vwapSeries.setData(vwapData);
      vwapRef.current = vwapSeries;
    }

    // 2. Dedicated Volume Pane (Pane 1)
    let volMA20Data: { time: string; value: number }[] = [];
    if (showVolume && volumePane >= 0) {
      const volumeSeries = chart.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: 'volume' },
          title: 'Volume',
        },
        volumePane
      );
      volumeSeriesRef.current = volumeSeries;

      const volumeData = historyData.map((d) => ({
        time: d.time,
        value: d.volume,
        color: (d.close ?? 0) >= (d.open ?? 0) ? 'rgba(38, 166, 154, 0.85)' : 'rgba(239, 83, 80, 0.85)',
      }));
      volumeSeries.setData(volumeData);

      volMA20Data = calculateVolumeMA(volumeData, 20);
      const volMASeries = chart.addSeries(
        LineSeries,
        {
          color: '#f59e0b',
          lineWidth: 1,
          title: 'MA 20',
        },
        volumePane
      );
      volMASeries.setData(volMA20Data);
      volMASeriesRef.current = volMASeries;
    }

    // 3. Dedicated RSI Pane (Pane 2)
    let rsiData: { time: string; value: number }[] = [];
    if (showRSI && rsiPane >= 0) {
      rsiData = calculateRSI(closeTimePoints, 14);
      const rsiSeries = chart.addSeries(
        LineSeries,
        {
          color: '#a855f7', // Purple/Violet
          lineWidth: 2,
          title: 'RSI (14)',
          autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
        },
        rsiPane
      );
      rsiSeries.setData(rsiData);
      rsiSeriesRef.current = rsiSeries;

      rsiSeries.createPriceLine({
        price: 70,
        color: 'rgba(239, 83, 80, 0.65)',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: '70',
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: 'rgba(74, 222, 128, 0.65)',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: '30',
      });
    }

    // 4. Dedicated MACD Pane (Pane 3)
    let macdResult: ReturnType<typeof calculateMACD> | null = null;
    if (showMACD && macdPane >= 0) {
      macdResult = calculateMACD(closeTimePoints, 12, 26, 9);

      const macdHist = chart.addSeries(
        HistogramSeries,
        {
          title: 'Hist',
        },
        macdPane
      );
      const coloredHist = macdResult.histogram.map((h) => ({
        time: h.time,
        value: h.value,
        color: h.value >= 0 ? '#00b0ff' : '#ef5350',
      }));
      macdHist.setData(coloredHist);
      macdHistRef.current = macdHist;

      const macdSeries = chart.addSeries(
        LineSeries,
        { color: '#38bdf8', lineWidth: 2, title: 'MACD' },
        macdPane
      );
      macdSeries.setData(macdResult.macdLine);
      macdLineRef.current = macdSeries;

      const signalSeries = chart.addSeries(
        LineSeries,
        { color: '#f97316', lineWidth: 1.5, lineStyle: LineStyle.Solid, title: 'Signal' },
        macdPane
      );
      signalSeries.setData(macdResult.signalLine);
      signalLineRef.current = signalSeries;
    }

    // Stretch Factors for Multi-Pane Layout
    const panes = chart.panes();
    const count = panes.length;
    if (count === 4) {
      panes[0].setStretchFactor(0.50); // Candlesticks (50%)
      panes[1].setStretchFactor(0.16); // Volume (16%)
      panes[2].setStretchFactor(0.16); // RSI (16%)
      panes[3].setStretchFactor(0.18); // MACD (18%)
    } else if (count === 3) {
      panes[0].setStretchFactor(0.60);
      panes[1].setStretchFactor(0.20);
      panes[2].setStretchFactor(0.20);
    } else if (count === 2) {
      panes[0].setStretchFactor(0.74);
      panes[1].setStretchFactor(0.26);
    } else if (count === 1) {
      panes[0].setStretchFactor(1.0);
    }

    // Maps for Real-time Crosshair Sync
    const atrData = calculateATR(fullCandles, 14);
    const atrMap = new Map(atrData.map((d) => [d.time, d]));
    const ema20Map = new Map(ema20Data.map((d) => [d.time, d.value]));
    const ema50Map = new Map(ema50Data.map((d) => [d.time, d.value]));
    const volMAMap = new Map(volMA20Data.map((d) => [d.time, d.value]));
    const ma20Map = new Map(ma20Data.map((d) => [d.time, d.value]));
    const bbUpMap = new Map(bbResult?.upper.map((d) => [d.time, d.value]) || []);
    const bbMidMap = new Map(bbResult?.middle.map((d) => [d.time, d.value]) || []);
    const bbLowMap = new Map(bbResult?.lower.map((d) => [d.time, d.value]) || []);
    const vwapMap = new Map(vwapData.map((d) => [d.time, d.value]));
    const rsiMap = new Map(rsiData.map((d) => [d.time, d.value]));
    const macdMap = new Map(macdResult?.macdLine.map((d) => [d.time, d.value]) || []);
    const signalMap = new Map(macdResult?.signalLine.map((d) => [d.time, d.value]) || []);
    const histMap = new Map(macdResult?.histogram.map((d) => [d.time, d.value]) || []);

    const lastItem = historyData[historyData.length - 1];
    if (lastItem) {
      const prevItem = historyData.length > 1 ? historyData[historyData.length - 2] : null;
      const ch = prevItem?.close && lastItem.close ? +(lastItem.close - prevItem.close).toFixed(2) : 0;
      const chPct = prevItem?.close && lastItem.close ? +((ch / prevItem.close) * 100).toFixed(2) : 0;
      const atrPoint = atrMap.get(lastItem.time);

      setLegend({
        time: lastItem.time,
        open: lastItem.open ?? undefined,
        high: lastItem.high ?? undefined,
        low: lastItem.low ?? undefined,
        close: lastItem.close ?? undefined,
        change: ch,
        changePct: chPct,
        volume: lastItem.volume,
        volMA20: volMAMap.get(lastItem.time),
        ema20: ema20Map.get(lastItem.time),
        ema50: ema50Map.get(lastItem.time),
        ma20: ma20Map.get(lastItem.time),
        bbUpper: bbUpMap.get(lastItem.time),
        bbMiddle: bbMidMap.get(lastItem.time),
        bbLower: bbLowMap.get(lastItem.time),
        vwap: vwapMap.get(lastItem.time),
        rsi: rsiMap.get(lastItem.time),
        macd: macdMap.get(lastItem.time),
        signal: signalMap.get(lastItem.time),
        hist: histMap.get(lastItem.time),
        atr: atrPoint?.atr,
        stoploss: atrPoint && lastItem.close ? +(lastItem.close - atrPoint.stoplossBuffer).toFixed(2) : undefined,
      });
    }

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || param.point === undefined) return;
      const timeStr = String(param.time);
      const candle = candleSeriesRef.current ? (param.seriesData.get(candleSeriesRef.current) as any) : null;
      const vol = volumeSeriesRef.current ? (param.seriesData.get(volumeSeriesRef.current) as any) : null;
      const atrPoint = atrMap.get(timeStr);

      if (candle && typeof candle.open === 'number') {
        const ch = +(candle.close - candle.open).toFixed(2);
        const chPct = candle.open > 0 ? +((ch / candle.open) * 100).toFixed(2) : 0;

        setLegend({
          time: timeStr,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          change: ch,
          changePct: chPct,
          volume: vol?.value ?? 0,
          volMA20: volMAMap.get(timeStr),
          ema20: ema20Map.get(timeStr),
          ema50: ema50Map.get(timeStr),
          ma20: ma20Map.get(timeStr),
          bbUpper: bbUpMap.get(timeStr),
          bbMiddle: bbMidMap.get(timeStr),
          bbLower: bbLowMap.get(timeStr),
          vwap: vwapMap.get(timeStr),
          rsi: rsiMap.get(timeStr),
          macd: macdMap.get(timeStr),
          signal: signalMap.get(timeStr),
          hist: histMap.get(timeStr),
          atr: atrPoint?.atr,
          stoploss: atrPoint && candle.close ? +(candle.close - atrPoint.stoplossBuffer).toFixed(2) : undefined,
        });
      }
    });

    chart.timeScale().fitContent();
  }, [historyData, showEMA, showVolume, showRSI, showMACD, showMA20, showBB, showVWAP, showATR]);

  // Selected Stock Details from live stock universe
  const currentStock = useMemo(() => {
    return stocks.find((s) => s.symbol === selectedSymbol);
  }, [stocks, selectedSymbol]);

  // Gainers and Losers
  const topGainers = useMemo(() => {
    return [...stocks]
      .filter((s) => (s.change ?? 0) > 0)
      .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
      .slice(0, 30);
  }, [stocks]);

  const topLosers = useMemo(() => {
    return [...stocks]
      .filter((s) => (s.change ?? 0) < 0)
      .sort((a, b) => (a.change ?? 0) - (b.change ?? 0))
      .slice(0, 30);
  }, [stocks]);

  const favoriteStocks = useMemo(() => {
    return stocks.filter((s) => favorites.includes(s.symbol));
  }, [stocks, favorites]);

  // Portfolio Totals Calculation
  const portfolioSummary = useMemo(() => {
    const totalInvested = paperAccount.stock_holdings_value;
    const currentValue = paperAccount.stock_holdings_value + paperAccount.total_unrealized_pnl;
    const totalPL = paperAccount.total_unrealized_pnl;
    const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

    return {
      totalInvested,
      currentValue,
      totalPL,
      totalPLPct,
      cashBalance: paperAccount.cash_balance,
      totalEquity: paperAccount.total_account_equity,
    };
  }, [paperAccount]);

  const filterList = (list: StockSummary[]) => {
    if (!stockSearch.trim()) return list;
    const q = stockSearch.toUpperCase();
    return list.filter((s) => s.symbol.includes(q) || (s.sector && s.sector.toUpperCase().includes(q)));
  };

  const handleTimeframe = (months: number) => {
    if (!chartInstanceRef.current || historyData.length === 0) return;
    const timeScale = chartInstanceRef.current.timeScale();
    if (months === 0) {
      timeScale.fitContent();
      return;
    }

    const latest = new Date(historyData[historyData.length - 1].time);
    const fromDate = new Date(latest);
    fromDate.setMonth(fromDate.getMonth() - months);
    const fromStr = fromDate.toISOString().slice(0, 10);

    timeScale.setVisibleRange({
      from: fromStr,
      to: historyData[historyData.length - 1].time,
    });
  };

  const handleTakeScreenshot = useCallback(() => {
    if (!chartInstanceRef.current) return;
    const canvas = chartInstanceRef.current.takeScreenshot();
    const link = document.createElement('a');
    link.download = `DSE_${selectedSymbol}_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [selectedSymbol]);

  const handleFullscreen = useCallback(() => {
    if (!chartWrapperRef.current) return;
    if (!document.fullscreenElement) {
      chartWrapperRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  }, []);

  const renderStockRow = (stock: StockSummary) => {
    const isSelected = stock.symbol === selectedSymbol;
    const isFav = favorites.includes(stock.symbol);
    const change = stock.change ?? 0;
    const isPositive = change >= 0;

    return (
      <div
        key={stock.symbol}
        onClick={() => setSelectedSymbol(stock.symbol)}
        className={`flex items-center justify-between px-3 py-1.5 cursor-pointer text-xs font-mono transition border-b border-[#1b1e26]/60 ${
          isSelected
            ? 'bg-[#1e2330] text-white border-l-2 border-[#00b0ff]'
            : 'hover:bg-[#151922] text-[#d1d4dc]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-bold text-xs ${isPositive ? 'text-[#089981]' : 'text-[#f23645]'}`}>
            {stock.symbol}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className={`font-semibold ${isPositive ? 'text-[#089981]' : 'text-[#f23645]'}`}>
            {stock.ltp?.toFixed(2) ?? '-'}
          </span>
          <span
            className={`min-w-[44px] text-right font-medium ${
              isPositive ? 'text-[#089981]' : 'text-[#f23645]'
            }`}
          >
            {change > 0 ? `+${change.toFixed(2)}` : change.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(stock.symbol);
            }}
            className="text-slate-500 hover:text-rose-500 transition"
          >
            <Heart
              size={13}
              className={isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-600'}
            />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0c0d10] text-[#d1d4dc]">
      {/* 1. Global Left Sidebar (Collapsible) */}
      {showGlobalNav && <Sidebar active={'prochart' as any} />}

      {/* 2. Main Workspace Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-[#1e222d] bg-[#131722] px-3 py-1.5 text-xs select-none">
          {/* Left Controls: Nav Toggle + Symbol + Stats */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowGlobalNav((v) => !v)}
              title={showGlobalNav ? 'Hide Global Sidebar' : 'Show Global Sidebar'}
              className="flex size-7 items-center justify-center rounded bg-[#1e222d] text-slate-300 hover:bg-[#2a2e39] hover:text-white transition"
            >
              {showGlobalNav ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </button>

            <button
              type="button"
              onClick={() => setShowDrawingToolbar((v) => !v)}
              title={showDrawingToolbar ? 'Hide Drawing Tools' : 'Show Drawing Tools'}
              className={`flex size-7 items-center justify-center rounded transition ${
                showDrawingToolbar ? 'bg-[#1e222d] text-[#00b0ff]' : 'bg-[#1e222d] text-slate-400 hover:text-white'
              }`}
            >
              <Slash size={14} />
            </button>

            <div className="h-4 w-px bg-slate-800" />

            <div className="flex items-center gap-1.5">
              <span className="font-mono text-base font-bold text-white tracking-wider">
                {selectedSymbol}
              </span>
              <button
                type="button"
                onClick={() => toggleFavorite(selectedSymbol)}
                className="text-slate-400 hover:text-rose-500 transition"
                title={favorites.includes(selectedSymbol) ? 'Remove Favorite' : 'Add Favorite'}
              >
                <Heart
                  size={15}
                  className={favorites.includes(selectedSymbol) ? 'fill-rose-500 text-rose-500' : ''}
                />
              </button>
            </div>

            {currentStock && (
              <div className="flex items-center gap-2 font-mono text-[11px] ml-1">
                <span className="text-sm font-bold text-white">
                  ৳{currentStock.ltp?.toFixed(1) ?? 'N/A'}
                </span>
                <span
                  className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 font-bold ${
                    (currentStock.change ?? 0) >= 0
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-rose-500/15 text-rose-400'
                  }`}
                >
                  {(currentStock.change ?? 0) >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {currentStock.change ? (currentStock.change > 0 ? `+${currentStock.change}` : currentStock.change) : '0.0'}
                </span>
                <span className="text-slate-700">|</span>
                <span className="text-slate-400">
                  Vol: <strong className="text-slate-200">{(currentStock.volume ?? 0).toLocaleString()}</strong>
                </span>

                {showATR && legend.stoploss !== undefined && (
                  <>
                    <span className="text-slate-700">|</span>
                    <span
                      title={`Daily Volatility (ATR): ৳${legend.atr ?? '-'} | Recommended 1.5x ATR Stoploss`}
                      className="flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30"
                    >
                      <ShieldAlert size={12} />
                      <span>SL: ৳{legend.stoploss}</span>
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Timeframe & Multi-Pane Indicator Toolbar (Matching TradingView Screenshot) */}
          <div className="flex items-center gap-2">
            {/* Timeframe Selector Pills */}
            <div className="flex items-center rounded bg-[#131722] p-0.5 border border-[#1e222d]">
              {['15m', '1h', '4h', '1d', '1M', 'All'].map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => {
                    setActiveTimeframe(tf);
                    const monthsMap: Record<string, number> = { '15m': 1, '1h': 1, '4h': 3, '1d': 0, '1M': 1, 'All': 0 };
                    handleTimeframe(monthsMap[tf] || 0);
                  }}
                  className={`rounded px-2.5 py-0.5 text-[11px] font-mono font-semibold transition ${
                    activeTimeframe === tf
                      ? 'bg-[#2a2e39] text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-slate-800" />

            {/* Indicator Quick Toggles */}
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <button
                type="button"
                onClick={() => setShowEMA((v) => !v)}
                className={`rounded px-2.5 py-0.5 font-semibold transition border ${
                  showEMA
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'text-slate-400 border-transparent hover:bg-[#1e222d]'
                }`}
              >
                EMA
              </button>

              <button
                type="button"
                onClick={() => setShowVolume((v) => !v)}
                className={`rounded px-2.5 py-0.5 font-semibold transition border ${
                  showVolume
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'text-slate-400 border-transparent hover:bg-[#1e222d]'
                }`}
              >
                Volume
              </button>

              <button
                type="button"
                onClick={() => setShowRSI((v) => !v)}
                className={`rounded px-2.5 py-0.5 font-semibold transition border ${
                  showRSI
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'text-slate-400 border-transparent hover:bg-[#1e222d]'
                }`}
              >
                RSI
              </button>

              <button
                type="button"
                onClick={() => setShowMACD((v) => !v)}
                className={`rounded px-2.5 py-0.5 font-semibold transition border ${
                  showMACD
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'text-slate-400 border-transparent hover:bg-[#1e222d]'
                }`}
              >
                MACD
              </button>
            </div>

            <div className="h-4 w-px bg-slate-800" />

            {/* Live Ticker Indicator Badge */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono font-bold">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </div>

            <div className="h-4 w-px bg-slate-800" />

            <button
              type="button"
              onClick={handleTakeScreenshot}
              title="Save Chart Screenshot (PNG)"
              className="flex size-7 items-center justify-center rounded bg-[#1e222d] text-slate-300 hover:bg-[#2a2e39] hover:text-white transition"
            >
              <Camera size={14} />
            </button>
            <button
              type="button"
              onClick={handleFullscreen}
              title="Fullscreen Mode"
              className="flex size-7 items-center justify-center rounded bg-[#1e222d] text-slate-300 hover:bg-[#2a2e39] hover:text-white transition"
            >
              <Maximize2 size={14} />
            </button>

            <button
              type="button"
              onClick={() => setRightPanelOpen((v) => !v)}
              title={rightPanelOpen ? 'Hide Right Panel' : 'Show Right Panel'}
              className="flex size-7 items-center justify-center rounded bg-[#1e222d] text-slate-300 hover:bg-[#2a2e39] hover:text-white transition"
            >
              {rightPanelOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            </button>
          </div>
        </div>

        {/* Workspace Body */}
        <div ref={chartWrapperRef} className="relative flex flex-1 overflow-hidden bg-[#0c0d10]">
          {/* Left Drawing Toolbar */}
          {showDrawingToolbar && (
            <div className="flex w-10 flex-col items-center gap-1.5 border-r border-[#1e222d] bg-[#131722] py-2 text-slate-400 select-none z-20">
              {[
                { id: 'cursor', label: 'Crosshair', icon: MousePointer },
                { id: 'trendline', label: 'Trendline', icon: Slash },
                { id: 'horizontal', label: 'Horizontal Ray / Level', icon: Minus },
                { id: 'fibonacci', label: 'Fibonacci Retracement', icon: Sliders },
                { id: 'measure', label: 'Measure Range', icon: Ruler },
                { id: 'text', label: 'Text Note', icon: Type },
              ].map(({ id, label, icon: Icon }) => {
                const active = activeTool === id;
                return (
                  <button
                    key={id}
                    type="button"
                    title={label}
                    onClick={() => setActiveTool(id as DrawingTool)}
                    className={`flex size-7 items-center justify-center rounded transition ${
                      active
                        ? 'bg-[#00b0ff]/20 text-[#00b0ff] border border-[#00b0ff]/50'
                        : 'hover:bg-[#1e222d] hover:text-white'
                    }`}
                  >
                    <Icon size={14} />
                  </button>
                );
              })}

              <div className="my-1 h-px w-5 bg-slate-800" />

              <button
                type="button"
                title="Clear all drawings"
                onClick={() => setDrawings([])}
                className="flex size-7 items-center justify-center rounded text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition"
              >
                <Trash2 size={14} />
              </button>
              <button
                type="button"
                title="Reset Zoom / Fit Content"
                onClick={() => chartInstanceRef.current?.timeScale().fitContent()}
                className="flex size-7 items-center justify-center rounded text-slate-400 hover:bg-[#1e222d] hover:text-white transition"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          )}

          {/* Center Chart Container (Clean, Proportional StockNow Style) */}
          <div className="relative flex-1 bg-[#0c0d10] overflow-hidden">
            {/* TradingView-Style Multi-Pane Synchronized Legend */}
            <div className="absolute top-2 left-3 z-20 pointer-events-none flex flex-col gap-1 font-mono text-[11px] select-none">
              {/* Line 1: Symbol, Timeframe, OHLC, Change% */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-white tracking-wide">
                  {selectedSymbol} <span className="text-slate-400 font-normal">· {activeTimeframe.toUpperCase()} ·</span>
                </span>
                {legend.open !== undefined && (
                  <div className="flex flex-wrap items-center gap-2 text-slate-300">
                    <span>O <strong className="text-white">{legend.open.toFixed(2)}</strong></span>
                    <span>H <strong className="text-white">{legend.high.toFixed(2)}</strong></span>
                    <span>L <strong className="text-white">{legend.low.toFixed(2)}</strong></span>
                    <span>C <strong className="text-white">{legend.close.toFixed(2)}</strong></span>
                    <span className={(legend.change ?? 0) >= 0 ? 'text-[#089981] font-bold' : 'text-[#f23645] font-bold'}>
                      {(legend.change ?? 0) >= 0 ? `+${legend.change.toFixed(2)}` : legend.change?.toFixed(2)} ({(legend.changePct ?? 0) >= 0 ? `+${legend.changePct.toFixed(2)}` : legend.changePct?.toFixed(2)}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Line 2: EMA Indicators on Main Pane */}
              {showEMA && (legend.ema20 !== undefined || legend.ema50 !== undefined) && (
                <div className="flex items-center gap-3 text-[10px]">
                  {legend.ema20 !== undefined && (
                    <span className="text-[#f59e0b] font-medium">
                      EMA20 <strong className="font-bold text-amber-300">{legend.ema20.toFixed(2)}</strong>
                    </span>
                  )}
                  {legend.ema50 !== undefined && (
                    <span className="text-[#38bdf8] font-medium">
                      EMA50 <strong className="font-bold text-sky-300">{legend.ema50.toFixed(2)}</strong>
                    </span>
                  )}
                </div>
              )}

              {/* Line 3: Sub-Pane Summaries (Volume, RSI, MACD) */}
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
                {showVolume && legend.volume !== undefined && (
                  <span>
                    Vol <strong className="text-slate-200">{legend.volume.toLocaleString()}</strong>
                    {legend.volMA20 !== undefined && (
                      <span className="text-[#f59e0b] ml-1.5">
                        MA20 <strong className="font-bold">{legend.volMA20.toLocaleString()}</strong>
                      </span>
                    )}
                  </span>
                )}
                {showRSI && legend.rsi !== undefined && (
                  <span className="text-[#a855f7]">
                    RSI <strong className="font-bold text-purple-300">{legend.rsi.toFixed(2)}</strong>
                  </span>
                )}
                {showMACD && legend.macd !== undefined && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-[#38bdf8]">MACD <strong className="text-sky-300">{legend.macd.toFixed(2)}</strong></span>
                    <span className="text-[#f97316]">Sig <strong className="text-orange-300">{legend.signal?.toFixed(2)}</strong></span>
                    <span className={(legend.hist ?? 0) >= 0 ? 'text-[#00b0ff]' : 'text-[#ef5350]'}>
                      Hist <strong className="font-bold">{legend.hist?.toFixed(2)}</strong>
                    </span>
                  </span>
                )}
              </div>
            </div>

            {loading && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0c0d10]/75 backdrop-blur-xs">
                <div className="flex items-center gap-2 rounded bg-[#1e222d] border border-slate-700 px-4 py-2 text-xs text-amber-400 shadow-xl">
                  <div className="size-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                  <span>Loading {selectedSymbol} historical candles...</span>
                </div>
              </div>
            )}

            {/* The Lightweight Chart Canvas */}
            <div ref={chartContainerRef} className="w-full h-full" />

            {/* Interactive Drawing Overlay SVG */}
            <ChartDrawingOverlay
              tool={activeTool}
              width={chartDimensions.width}
              height={chartDimensions.height}
              drawings={drawings}
              onAddDrawing={(item) => setDrawings((prev) => [...prev, item])}
              onClear={() => setDrawings([])}
            />
          </div>

          {/* Right StockNow Style Panel + Dock Strip */}
          <div className="flex z-20">
            {/* Expandable Drawer Panel */}
            {rightPanelOpen && (
              <div className="flex w-72 flex-col border-l border-[#1e222d] bg-[#131722] select-none overflow-hidden">
                {/* Search Bar */}
                <div className="p-2 border-b border-[#1e222d]">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-2 text-slate-500" />
                    <input
                      type="text"
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                      placeholder="Search stocks..."
                      className="w-full rounded bg-[#0c0d10] py-1 pl-8 pr-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#00b0ff]/50"
                    />
                  </div>
                </div>

                {/* Panel Content based on Active Right Dock Tab */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                  {/* TAB 4: PAPER BROKER PORTFOLIO (AGENT 8 & AUTO-PILOT DIRECT SYNC) */}
                  {activeRightTab === 'portfolio' && (
                    <div className="p-3">
                      {/* Portfolio Header & Overall Summary Card */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wider">
                          <Briefcase size={14} className="text-amber-400" />
                          <span>Paper Portfolio ({paperPositions.length})</span>
                          <span className="size-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" title="Auto-Pilot Active & Synced" />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={triggerAutopilot}
                            disabled={runningAutopilot}
                            title="Run Auto-Pilot Breakout Scan & Auto-Trade"
                            className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/30 transition disabled:opacity-50"
                          >
                            <Zap size={11} className={runningAutopilot ? 'animate-spin' : 'text-amber-400'} />
                            <span>{runningAutopilot ? 'Scanning...' : 'Auto-Pilot'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewSymbol(selectedSymbol);
                              const st = stocks.find((s) => s.symbol === selectedSymbol);
                              if (st?.ltp) setNewBuyPrice(st.ltp.toString());
                              setShowAddForm((v) => !v);
                            }}
                            className="flex items-center gap-1 rounded bg-[#00b0ff]/20 px-2 py-1 text-[11px] font-bold text-[#00b0ff] hover:bg-[#00b0ff]/30 transition"
                          >
                            <Plus size={11} />
                            <span>Add</span>
                          </button>
                        </div>
                      </div>

                      {/* Total P/L Summary Card */}
                      <div className="rounded bg-[#1a1f2c] p-2.5 border border-slate-800 font-mono text-xs mb-3 space-y-1.5">
                        <div className="flex justify-between items-center text-slate-400 text-[11px]">
                          <span>Account Equity</span>
                          <strong className="text-amber-300 font-bold">৳{portfolioSummary.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
                        </div>
                        <div className="flex justify-between items-center text-slate-400 text-[11px]">
                          <span>Available Cash</span>
                          <span className="text-white">৳{portfolioSummary.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400 text-[11px]">
                          <span>Stock Holdings</span>
                          <span className="text-white">৳{portfolioSummary.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                        </div>
                        <div className="border-t border-slate-800/80 my-1.5" />
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300 font-bold text-[11px]">Unrealized P&L</span>
                          <span
                            className={`font-bold ${
                              portfolioSummary.totalPL >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
                            }`}
                          >
                            {portfolioSummary.totalPL >= 0 ? `+৳${portfolioSummary.totalPL.toFixed(1)}` : `-৳${Math.abs(portfolioSummary.totalPL).toFixed(1)}`}
                            {' '}({portfolioSummary.totalPLPct >= 0 ? `+${portfolioSummary.totalPLPct.toFixed(2)}` : portfolioSummary.totalPLPct.toFixed(2)}%)
                          </span>
                        </div>
                      </div>

                      {/* Add Stock Form (Collapsible) */}
                      {showAddForm && (
                        <form
                          onSubmit={handleAddPosition}
                          className="rounded bg-[#151922] p-2.5 border border-[#00b0ff]/40 mb-3 text-xs font-mono"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-white text-[11px]">Buy Paper Order</span>
                            <button
                              type="button"
                              onClick={() => setShowAddForm(false)}
                              className="text-slate-500 hover:text-white"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            <div>
                              <label className="text-[10px] text-slate-400">Trading Code (Symbol)</label>
                              <input
                                type="text"
                                value={newSymbol}
                                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                                placeholder="e.g. GP, BATBC, BNICL"
                                className="w-full rounded bg-[#0c0d10] px-2 py-1 text-white border border-slate-700 uppercase text-xs"
                                required
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-400">Buy Price (৳)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={newBuyPrice}
                                  onChange={(e) => setNewBuyPrice(e.target.value)}
                                  className="w-full rounded bg-[#0c0d10] px-2 py-1 text-white border border-slate-700 text-xs"
                                  required
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400">Quantity (Shares)</label>
                                <input
                                  type="number"
                                  value={newQuantity}
                                  onChange={(e) => setNewQuantity(e.target.value)}
                                  className="w-full rounded bg-[#0c0d10] px-2 py-1 text-white border border-slate-700 text-xs"
                                  required
                                />
                              </div>
                            </div>

                            <button
                              type="submit"
                              className="w-full mt-2 rounded bg-amber-400 py-1.5 text-xs font-bold text-black hover:bg-amber-300 transition"
                            >
                              Execute Paper Buy
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Portfolio Holdings List */}
                      <div className="space-y-2">
                        {paperPositions.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-500 font-mono">
                            <Briefcase size={26} className="mx-auto mb-2 text-slate-600" />
                            <p>No open positions in Paper Portfolio.</p>
                            <p className="text-[10px] text-slate-600 mt-1">Auto-Pilot executes automatically on breakout triggers, or click "+ Add" above.</p>
                          </div>
                        ) : (
                          paperPositions.map((pos) => {
                            const invested = pos.average_buy_price * pos.quantity;
                            const pl = pos.unrealized_pnl;
                            const plPct = pos.unrealized_pnl_pct;
                            const isPositive = pl >= 0;

                            return (
                              <div
                                key={pos.symbol}
                                onClick={() => setSelectedSymbol(pos.symbol)}
                                className={`rounded bg-[#1a1f2c] p-2.5 border transition cursor-pointer font-mono text-xs ${
                                  selectedSymbol === pos.symbol ? 'border-amber-400/80 bg-[#1f2533]' : 'border-slate-800/80 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-sm text-white">{pos.symbol}</span>
                                    <span className="text-[10px] text-slate-400">({pos.quantity} shares)</span>
                                    <span className="rounded bg-emerald-500/20 text-emerald-400 px-1 py-0.2 text-[8px]">AUTO / PAPER</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleClosePosition(pos.symbol, pos.quantity, pos.current_ltp);
                                    }}
                                    title="Close / Sell Position"
                                    className="text-slate-500 hover:text-rose-400 p-0.5 text-[10px] flex items-center gap-0.5 rounded bg-rose-500/10 px-1.5 py-0.5"
                                  >
                                    <Trash2 size={11} />
                                    <span>Sell</span>
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-1 text-[11px] mt-1.5 text-slate-400">
                                  <div>
                                    <span>Buy: </span>
                                    <strong className="text-slate-300">৳{pos.average_buy_price.toFixed(1)}</strong>
                                  </div>
                                  <div className="text-right">
                                    <span>LTP: </span>
                                    <strong className="text-white">৳{pos.current_ltp.toFixed(1)}</strong>
                                  </div>
                                </div>

                                {(pos.stop_loss || pos.take_profit) && (
                                  <div className="grid grid-cols-2 gap-1 text-[10px] mt-1 text-slate-500 border-t border-slate-800/40 pt-1">
                                    <div>SL: <span className="text-rose-400">৳{pos.stop_loss?.toFixed(1) ?? '-'}</span></div>
                                    <div className="text-right">TP: <span className="text-emerald-400">৳{pos.take_profit?.toFixed(1) ?? '-'}</span></div>
                                  </div>
                                )}

                                <div className="flex items-center justify-between text-[11px] mt-1.5 pt-1.5 border-t border-slate-800/60">
                                  <span className="text-slate-400">Gain / Loss:</span>
                                  <span className={`font-bold ${isPositive ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                                    {isPositive ? `+৳${pl.toFixed(1)}` : `-৳${Math.abs(pl).toFixed(1)}`}
                                    {' '}({isPositive ? `+${plPct.toFixed(1)}` : plPct.toFixed(1)}%)
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 1: FAVORITES */}
                  {activeRightTab === 'favorites' && (
                    <div>
                      <div>
                        <div
                          onClick={() => toggleAccordion('trade')}
                          className="flex items-center justify-between px-3 py-1.5 bg-[#181c27] text-xs font-semibold text-white cursor-pointer hover:bg-[#1f2432] transition border-b border-[#1e222d]"
                        >
                          <div className="flex items-center gap-1.5">
                            <Heart size={13} className="fill-rose-500 text-rose-500" />
                            <span>Trade ({favorites.length})</span>
                          </div>
                          {openAccordions.trade ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>

                        {openAccordions.trade && (
                          <div>
                            <div className="flex items-center justify-between px-3 py-1 bg-[#10131a] text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                              <span>Code</span>
                              <div className="flex items-center gap-4">
                                <span>Last</span>
                                <span>Ch%</span>
                              </div>
                            </div>
                            {filterList(favoriteStocks).map(renderStockRow)}
                          </div>
                        )}
                      </div>

                      <div>
                        <div
                          onClick={() => toggleAccordion('trading_stock')}
                          className="flex items-center justify-between px-3 py-1.5 bg-[#181c27] text-xs font-semibold text-[#848e9c] cursor-pointer hover:bg-[#1f2432] hover:text-white transition border-b border-[#1e222d]"
                        >
                          <span>trading stock</span>
                          {openAccordions.trading_stock ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                        {openAccordions.trading_stock && (
                          <div>{filterList(stocks.slice(0, 15)).map(renderStockRow)}</div>
                        )}
                      </div>

                      <div>
                        <div
                          onClick={() => toggleAccordion('uptrend')}
                          className="flex items-center justify-between px-3 py-1.5 bg-[#181c27] text-xs font-semibold text-[#848e9c] cursor-pointer hover:bg-[#1f2432] hover:text-white transition border-b border-[#1e222d]"
                        >
                          <span>up trend</span>
                          {openAccordions.uptrend ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                        {openAccordions.uptrend && (
                          <div>{filterList(topGainers.slice(0, 15)).map(renderStockRow)}</div>
                        )}
                      </div>

                      <div>
                        <div
                          onClick={() => toggleAccordion('sme')}
                          className="flex items-center justify-between px-3 py-1.5 bg-[#181c27] text-xs font-semibold text-[#848e9c] cursor-pointer hover:bg-[#1f2432] hover:text-white transition border-b border-[#1e222d]"
                        >
                          <span>SME & All DSE</span>
                          {openAccordions.sme ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                        {openAccordions.sme && (
                          <div>{filterList(stocks.slice(15, 45)).map(renderStockRow)}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: CURRENT STOCK STATS */}
                  {activeRightTab === 'stats' && currentStock && (
                    <div className="p-3 text-xs font-mono">
                      <div className="rounded bg-[#1a1f2c] p-2.5 border border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white">{currentStock.symbol}</span>
                          <span className="text-sm font-bold text-white">৳{currentStock.ltp?.toFixed(2) ?? '-'}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] mt-0.5 text-slate-400">
                          <span className="truncate max-w-[130px]">{currentStock.sector || 'Main Board'}</span>
                          <span className={(currentStock.change ?? 0) >= 0 ? 'text-[#089981] font-bold' : 'text-[#f23645] font-bold'}>
                            {currentStock.change ? (currentStock.change > 0 ? `+${currentStock.change}` : currentStock.change) : '0.00'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">STATS</p>
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          {[
                            { label: 'Open', val: currentStock.ltp?.toFixed(2) ?? '-' },
                            { label: 'High', val: currentStock.high?.toFixed(2) ?? '-' },
                            { label: 'Low', val: currentStock.low?.toFixed(2) ?? '-' },
                            { label: 'YCP', val: currentStock.ycp?.toFixed(2) ?? '-' },
                            { label: 'Volume', val: (currentStock.volume ?? 0).toLocaleString() },
                            {
                              label: 'Value',
                              val: currentStock.volume && currentStock.ltp
                                ? `${((currentStock.volume * currentStock.ltp) / 10000000).toFixed(2)}cr`
                                : '-',
                            },
                            { label: 'ATR', val: legend.atr ? `৳${legend.atr}` : '-' },
                            {
                              label: 'Avg',
                              val: currentStock.high && currentStock.low
                                ? (((currentStock.high + currentStock.low) / 2).toFixed(2))
                                : '-',
                            },
                            {
                              label: 'Stoploss',
                              val: legend.stoploss ? `৳${legend.stoploss}` : '-',
                            },
                          ].map((item) => (
                            <div key={item.label} className="rounded bg-[#1a1f2c] py-2 px-1 border border-slate-800/80">
                              <p className="text-[9px] text-slate-400">{item.label}</p>
                              <p className="text-[11px] font-bold text-white truncate mt-0.5">{item.val}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">MARKET DEPTH</p>
                          <span className="text-[9px] text-[#00b0ff] font-bold">DSE</span>
                        </div>
                        <div className="rounded bg-[#1a1f2c] overflow-hidden border border-slate-800">
                          <div className="grid grid-cols-2 text-center text-[10px] font-bold border-b border-slate-800">
                            <span className="py-1 bg-emerald-950/40 text-emerald-400">Buyer</span>
                            <span className="py-1 bg-rose-950/40 text-rose-400">Seller</span>
                          </div>
                          <div className="grid grid-cols-4 text-center text-[9px] text-slate-400 py-1 border-b border-slate-800/60">
                            <span>Price</span>
                            <span>Vol</span>
                            <span>Price</span>
                            <span>Vol</span>
                          </div>
                          <div className="grid grid-cols-4 text-center text-[10px] font-bold py-1.5 text-white">
                            <span className="text-[#089981]">{currentStock.ltp?.toFixed(1) ?? '18.5'}</span>
                            <span className="text-emerald-400">40</span>
                            <span className="text-[#f23645]">{((currentStock.ltp ?? 18.5) + 0.1).toFixed(1)}</span>
                            <span className="text-rose-400">120</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: TOP SHARES */}
                  {activeRightTab === 'top_shares' && (
                    <div>
                      <div>
                        <div
                          onClick={() => toggleAccordion('top_gainers')}
                          className="flex items-center justify-between px-3 py-1.5 bg-[#181c27] text-xs font-semibold text-emerald-400 cursor-pointer hover:bg-[#1f2432] transition border-b border-[#1e222d]"
                        >
                          <div className="flex items-center gap-1.5">
                            <Flame size={13} className="text-amber-400" />
                            <span>Top Gainers ({topGainers.length})</span>
                          </div>
                          {openAccordions.top_gainers ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>

                        {openAccordions.top_gainers && (
                          <div>
                            <div className="flex items-center justify-between px-3 py-1 bg-[#10131a] text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                              <span>Code</span>
                              <div className="flex items-center gap-4">
                                <span>Last</span>
                                <span>Ch%</span>
                              </div>
                            </div>
                            {filterList(topGainers).map(renderStockRow)}
                          </div>
                        )}
                      </div>

                      <div>
                        <div
                          onClick={() => toggleAccordion('top_losers')}
                          className="flex items-center justify-between px-3 py-1.5 bg-[#181c27] text-xs font-semibold text-rose-400 cursor-pointer hover:bg-[#1f2432] transition border-b border-[#1e222d]"
                        >
                          <div className="flex items-center gap-1.5">
                            <TrendingDown size={13} className="text-rose-400" />
                            <span>Top Losers ({topLosers.length})</span>
                          </div>
                          {openAccordions.top_losers ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>

                        {openAccordions.top_losers && (
                          <div>
                            <div className="flex items-center justify-between px-3 py-1 bg-[#10131a] text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                              <span>Code</span>
                              <div className="flex items-center gap-4">
                                <span>Last</span>
                                <span>Ch%</span>
                              </div>
                            </div>
                            {filterList(topLosers).map(renderStockRow)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Far Right Vertical Icon Dock Strip */}
            <div className="flex w-10 flex-col items-center border-l border-[#1e222d] bg-[#10131a] py-2 text-slate-400 select-none">
              <button
                type="button"
                onClick={() => setRightPanelOpen((v) => !v)}
                title={rightPanelOpen ? 'Collapse Panel' : 'Expand Panel'}
                className="flex size-7 items-center justify-center rounded hover:bg-[#1e222d] hover:text-white transition mb-2"
              >
                <LayoutGrid size={15} />
              </button>

              <div className="mb-2 h-px w-5 bg-slate-800" />

              {/* 1. Portfolio Icon */}
              <button
                type="button"
                title="My Portfolio Holdings"
                onClick={() => {
                  setActiveRightTab('portfolio');
                  setRightPanelOpen(true);
                }}
                className={`flex size-7 items-center justify-center rounded transition mb-1 ${
                  activeRightTab === 'portfolio' && rightPanelOpen
                    ? 'bg-[#00b0ff]/20 text-[#00b0ff]'
                    : 'hover:bg-[#1e222d] hover:text-white'
                }`}
              >
                <Briefcase size={16} />
              </button>

              {/* 2. Current Stock Stats Icon */}
              <button
                type="button"
                title="Current Stock Details"
                onClick={() => {
                  setActiveRightTab('stats');
                  setRightPanelOpen(true);
                }}
                className={`flex size-7 items-center justify-center rounded transition mb-1 ${
                  activeRightTab === 'stats' && rightPanelOpen
                    ? 'bg-[#00b0ff]/20 text-[#00b0ff]'
                    : 'hover:bg-[#1e222d] hover:text-white'
                }`}
              >
                <BarChart2 size={16} />
              </button>

              {/* 3. Top Shares Icon (Flame) */}
              <button
                type="button"
                title="Top Shares / Movers"
                onClick={() => {
                  setActiveRightTab('top_shares');
                  setRightPanelOpen(true);
                }}
                className={`flex size-7 items-center justify-center rounded transition mb-1 ${
                  activeRightTab === 'top_shares' && rightPanelOpen
                    ? 'bg-[#00b0ff]/20 text-[#00b0ff]'
                    : 'hover:bg-[#1e222d] hover:text-white'
                }`}
              >
                <Flame size={16} />
              </button>

              {/* 4. Favorites Icon (Heart) */}
              <button
                type="button"
                title="Favorites & Watchlists"
                onClick={() => {
                  setActiveRightTab('favorites');
                  setRightPanelOpen(true);
                }}
                className={`flex size-7 items-center justify-center rounded transition mb-1 ${
                  activeRightTab === 'favorites' && rightPanelOpen
                    ? 'bg-[#00b0ff]/20 text-[#00b0ff]'
                    : 'hover:bg-[#1e222d] hover:text-white'
                }`}
              >
                <Heart size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

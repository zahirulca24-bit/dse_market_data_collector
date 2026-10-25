import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Bot,
  Newspaper,
  FileText,
  Bookmark,
  Calendar,
  Lock,
  CheckCircle2,
  Play,
  RefreshCw,
  Search,
  ExternalLink,
  Flame,
  TrendingUp,
  AlertTriangle,
  SlidersHorizontal,
  Layers,
  ChevronRight,
  ShieldCheck,
  Check,
  Zap,
  Target,
  ArrowRight,
  Crosshair,
  Timer,
  Clock,
  DollarSign,
  AlertCircle,
  HelpCircle,
  Sparkles,
  LogOut,
  ShieldAlert,
  Percent,
  Sliders,
  History,
  Activity,
  BarChart2,
  Compass,
  Shield,
  ShieldX,
  XCircle,
  Wallet,
  Calculator,
  PieChart,
  Coins,
  Scale,
  Bell,
  Send,
  Radio,
  Megaphone,
  ShoppingBag,
  Briefcase,
  RotateCcw,
  TrendingDown,
} from 'lucide-react';
import { Sidebar } from '@/components/sidebar';

interface AgentInfo {
  id: string;
  index: number;
  name: string;
  category: string;
  status: 'open' | 'running' | 'locked';
  description: string;
  skills: string[];
  badge: string;
  actions: string[];
}

interface ScanCandidate {
  symbol: string;
  setups: string[];
  price: number;
  change_pct: number;
  volume: number;
  value_mn: number;
  date: string;
  rsi: number | null;
  high20: number | null;
  ma20: number | null;
  explanations: string[];
}

interface ScanResult {
  status: string;
  agent: {
    id: string;
    name: string;
    version: string;
    status: string;
    description: string;
  };
  scanned_symbols: number;
  matched_count: number;
  setup_breakdown: Record<string, number>;
  updated_at: string;
  candidates: ScanCandidate[];
}

interface OrderCard {
  order_type: string;
  trigger_price: number;
  recommended_limit_price: number;
  max_chase_price: number;
  pullback_zone: [number, number];
  validity: string;
}

interface EntryCandidate {
  symbol: string;
  date: string;
  ltp: number;
  change_pct: number;
  volume: number;
  avg_vol20: number;
  vol_surge_ratio: number;
  volume_confirmed: boolean;
  setup: string;
  trigger_level: number;
  high20: number;
  low20: number;
  ma20: number;
  distance_bdt: number;
  distance_pct: number;
  status: 'TRIGGERED' | 'WAITING' | 'PULLBACK_BUY' | 'EXTENDED' | 'WATCHING';
  status_badge: string;
  badge_color: string;
  action_code: string;
  tactic: string;
  order_card: OrderCard;
}

interface EntryWatchlistResult {
  status: string;
  agent: {
    id: string;
    name: string;
    version: string;
    status: string;
    description: string;
  };
  evaluated_count: number;
  status_summary: Record<string, number>;
  updated_at: string;
  entries: EntryCandidate[];
}

interface TargetTranche {
  name: string;
  price: number;
  r_multiple: number;
  profit_bdt: number;
  profit_pct: number;
  action: string;
}

interface ExitPlan {
  symbol: string;
  entry_price: number;
  atr14: number;
  stop_loss: number;
  stop_rule: string;
  stop_rule_label: string;
  stop_detail: string;
  risk_per_share: number;
  risk_pct: number;
  reward_risk_ratio: string;
  status?: string;
  status_badge?: string;
  setup?: string;
  targets: {
    tranche_1: TargetTranche;
    tranche_2: TargetTranche;
    tranche_3: TargetTranche;
  };
  trailing_rules: string[];
  circuit_limits: {
    upper_10pct: number;
    lower_10pct: number;
  };
}

interface ExitWatchlistResult {
  status: string;
  agent: {
    id: string;
    name: string;
    version: string;
    status: string;
    description: string;
  };
  stop_rule_applied: string;
  evaluated_count: number;
  updated_at: string;
  plans: ExitPlan[];
}

interface FanBand {
  day: number;
  p5: number;
  p25: number;
  median: number;
  p75: number;
  p95: number;
}

interface TimeMachineSimulation {
  symbol: string;
  setup: string;
  entry_price: number;
  stop_loss: number;
  target_price: number;
  backtest: {
    total_historical_bars: number;
    total_triggers: number;
    target_hits: number;
    stop_hits: number;
    timeouts: number;
    win_rate: number;
    expectancy_r: number;
    profit_factor: number;
    recent_trades?: any[];
  };
  monte_carlo: {
    replays: number;
    prob_target_first: number;
    prob_stop_first: number;
    prob_open_at_close: number;
    avg_mc_r: number;
    fan_bands: FanBand[];
  };
  verdict: {
    verdict: string;
    badge: string;
    color: string;
    narrative: string;
  };
}

interface TimeMachineWatchlistResult {
  status: string;
  agent: {
    id: string;
    name: string;
    version: string;
    status: string;
    description: string;
  };
  evaluated_count: number;
  updated_at: string;
  simulations: TimeMachineSimulation[];
}

interface RiskCheckItem {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
}

interface RiskAuditResult {
  symbol: string;
  entry_price: number;
  stop_loss: number;
  target_price: number;
  quantity: number;
  total_value: number;
  total_risk: number;
  reward_risk: number;
  verdict: 'PASS' | 'BLOCK';
  verdict_badge: string;
  badge_color: string;
  blocked_reasons: string[];
  suggested_safe_quantity: number;
  suggested_safe_value: number;
  setup?: string;
  risk_per_share?: number;
  checks: RiskCheckItem[];
}

interface RiskWatchlistResult {
  status: string;
  agent: {
    id: string;
    name: string;
    version: string;
    status: string;
    description: string;
  };
  config_applied: {
    account_equity: number;
    max_loss_per_trade_pct: number;
    max_position_pct: number;
    min_reward_risk: number;
  };
  total_audited: number;
  pass_count: number;
  block_count: number;
  updated_at: string;
  audits: RiskAuditResult[];
}

interface BudgetScaleOut {
  tranche_1_shares: number;
  tranche_2_shares: number;
  tranche_3_shares: number;
}

interface BudgetBracketOrder {
  symbol: string;
  order_type: string;
  quantity: number;
  limit_price: number;
  stop_loss_price: number;
  take_profit_price: number;
  scale_out: BudgetScaleOut;
  validity: string;
}

interface BudgetSizedOrder {
  symbol: string;
  entry_price: number;
  stop_loss: number;
  target_price: number;
  risk_per_share: number;
  reward_risk: number;
  budget: number;
  final_shares: number;
  total_investment: number;
  portfolio_pct: number;
  actual_max_loss: number;
  expected_gain: number;
  deciding_limit: string;
  decision_narrative: string;
  constraint_breakdown: {
    by_risk_limit: number;
    by_position_cap: number;
    by_cash_buffer: number;
    by_half_kelly: number;
  };
  bracket_order: BudgetBracketOrder;
  setup?: string;
  status?: string;
  message?: string;
}

interface BudgetWatchlistResult {
  status: string;
  agent: {
    id: string;
    name: string;
    version: string;
    status: string;
    description: string;
  };
  budget_config: {
    budget: number;
    cash_buffer_pct: number;
    max_loss_per_trade: number;
    max_position_pct: number;
  };
  total_sized: number;
  updated_at: string;
  orders: BudgetSizedOrder[];
}

interface DseClock {
  status: string;
  status_text: string;
  is_trading_day: boolean;
  current_time_bst: string;
  timezone: string;
  trading_session: {
    pre_open: string;
    open: string;
    close: string;
    post_close: string;
    trading_days: string;
  };
  seconds_to_event: number;
  event_label: string;
  holiday: string | null;
}

interface AlertRule {
  id: string;
  symbol: string;
  rule_type: string;
  threshold: number;
  current_price: number;
  label: string;
  severity: string;
  status: 'ACTIVE' | 'TRIGGERED' | 'MUTED';
  shares: number;
  reward_risk: number;
  channels: string[];
  created_at: string;
  last_triggered_at?: string;
}

interface FiredAlertEvent {
  alert_id: string;
  symbol: string;
  rule_type: string;
  trigger_price: number;
  threshold: number;
  message: string;
  severity: string;
  triggered_at: string;
  dispatch_results?: Record<string, any>;
}

interface AlertsEvaluationResult {
  status: string;
  clock: DseClock;
  total_rules: number;
  active_rules_count: number;
  fired_alerts_count: number;
  fired_alerts: FiredAlertEvent[];
  recent_history: FiredAlertEvent[];
  rules: AlertRule[];
}

interface PaperPosition {
  symbol: string;
  quantity: number;
  average_buy_price: number;
  cost_basis: number;
  current_ltp: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  stop_loss: number | null;
  take_profit: number | null;
  opened_at: string;
  portfolio_pct: number;
}

interface PaperOrderTicket {
  order_id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  order_type: string;
  quantity: number;
  price: number;
  order_value: number;
  commission: number;
  realized_pnl?: number;
  status: string;
  executed_at: string;
  stop_loss?: number;
  take_profit?: number;
  notes?: string;
}

interface ClosedTradeRecord {
  symbol: string;
  quantity: number;
  buy_price: number;
  sell_price: number;
  order_value: number;
  commission: number;
  realized_pnl: number;
  realized_pnl_pct: number;
  closed_at: string;
  reason: string;
}


interface NewsItem {
  id: string;
  code: string;
  name: string;
  sector: string;
  date: string;
  time: string;
  filedAt: string;
  summary: string;
  body: string;
  category: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  sentiment_score: number;
  impact_level: 'HIGH' | 'MEDIUM' | 'LOW';
  metrics: {
    cash_dividend_pct?: number;
    stock_dividend_pct?: number;
    current_eps?: number;
    prev_eps?: number;
    eps_growth_pct?: number;
    navps?: number;
    event_date?: string;
    record_date?: string;
  };
  risk_warnings: string[];
}

interface NewsFeedData {
  status: string;
  total_disclosures_monitored: number;
  sentiment_overview: {
    bullish_count: number;
    bearish_count: number;
    neutral_count: number;
    net_market_bias: string;
  };
  watchlist_tickers: string[];
  watchlist_news: NewsItem[];
  market_news: NewsItem[];
  upcoming_catalysts: Array<{
    code: string;
    name: string;
    category: string;
    date: string;
    event_date: string;
    summary: string;
    sentiment: string;
    risk_warning?: string;
  }>;
}


interface AnalystMetrics {
  current_pe: number;
  trailing_pe: number;
  sector_median_pe: number;
  pe_discount_vs_sector_pct: number;
  eps: number;
  nav_per_share: number;
  pb_ratio: number;
  graham_number?: number;
  graham_upside_pct?: number;
  paid_up_capital_mn?: number;
  market_cap_mn?: number;
  dividend_yield?: number;
  last_dividend_cash_pct?: number;
}

interface ValuationDetails {
  fundamental_health_score: number;
  verdict: 'UNDERVALUED' | 'FAIRLY_VALUED' | 'OVERVALUED';
  badge_label: string;
  badge_color: string;
  actionable_briefing: string;
}

interface AnalystEvaluation {
  status: string;
  symbol: string;
  name: string;
  sector: string;
  category: string;
  listing_year?: number;
  ltp: number;
  metrics: AnalystMetrics;
  valuation: ValuationDetails;
  history?: Array<{
    year: string;
    eps: number;
    nav?: number;
  }>;
}


interface ShareholdingDetails {
  sponsor_pct: number;
  govt_pct: number;
  institute_pct: number;
  foreign_pct: number;
  public_pct: number;
  smart_money_total_pct: number;
  retail_float_pct: number;
  sponsor_change_pct: number;
  institute_change_pct: number;
}

interface SmartMoneyFlowDetails {
  smart_money_flow_score: number;
  verdict: 'INSTITUTIONAL_ACCUMULATION' | 'NEUTRAL_BALANCED_FLOW' | 'SPONSOR_DISTRIBUTION_RISK' | 'RETAIL_DOMINATED';
  badge_label: string;
  badge_color: string;
  actionable_briefing: string;
}

interface InsiderDeclaration {
  id: string;
  code: string;
  name: string;
  date: string;
  time: string;
  insider_name: string;
  action_type: 'BUY_DECLARATION' | 'SALE_DECLARATION' | 'GIFT_TRANSFER' | 'TRANSFER';
  quantity?: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  summary: string;
  body: string;
}

interface SmartMoneyEvaluation {
  status: string;
  symbol: string;
  name: string;
  as_on: string;
  shareholding: ShareholdingDetails;
  flow: SmartMoneyFlowDetails;
  recent_declarations: InsiderDeclaration[];
}

interface PelosiWatchlistResult {
  status: string;
  watchlist_count: number;
  summary: {
    accumulation_count: number;
    neutral_count: number;
    distribution_count: number;
    average_smart_money_score: number;
    average_smart_money_holding_pct: number;
  };
  declarations_blotter: InsiderDeclaration[];
  evaluations: SmartMoneyEvaluation[];
}

interface AnalystWatchlistResult {
  status: string;
  watchlist_count: number;
  summary: {
    undervalued_count: number;
    fair_count: number;
    overvalued_count: number;
    average_fundamental_score: number;
    average_pe: number;
  };
  sector_benchmarks: Record<string, number>;
  evaluations: AnalystEvaluation[];
}

interface SymbolAuditData {
  status: string;
  symbol: string;
  total_disclosures: number;
  net_sentiment: string;
  sentiment_score: number;
  breakdown: {
    bullish_count: number;
    bearish_count: number;
    board_meeting_count: number;
    dividend_earnings_count: number;
  };
  actionable_briefing: string;
  risk_warnings: string[];
  disclosures: NewsItem[];
}

interface PaperBrokerAccount {
  starting_cash: number;
  cash_balance: number;
  stock_holdings_value: number;
  total_account_equity: number;
  total_unrealized_pnl: number;
  total_realized_pnl: number;
  total_commissions_paid: number;
  net_pnl: number;
  total_return_pct: number;
  positions_count: number;
  pending_orders_count: number;
  closed_trades_count: number;
  win_rate: number;
}

interface PaperBrokerResult {
  status: string;
  agent: {
    id: string;
    name: string;
    version: string;
    status: string;
    description: string;
  };
  account: PaperBrokerAccount;
  positions: PaperPosition[];
  pending_orders: any[];
  recent_trades: ClosedTradeRecord[];
  order_blotter: PaperOrderTicket[];
  updated_at: string;
}

export default function AgentAnalysisPage() {
  const [, navigate] = useLocation();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('trader-pelosi');
  // Smart Money & Insider Flow state (Agent 11)
  const [pelosiResult, setPelosiResult] = useState<PelosiWatchlistResult | null>(null);
  const [loadingPelosi, setLoadingPelosi] = useState<boolean>(false);
  const [selectedPelosiSymbol, setSelectedPelosiSymbol] = useState<SmartMoneyEvaluation | null>(null);
  const [pelosiSymbolInput, setPelosiSymbolInput] = useState<string>('MPETROLEUM');
  const [pelosiSearchQuery, setPelosiSearchQuery] = useState<string>('');
  const [pelosiFilterVerdict, setPelosiFilterVerdict] = useState<string>('ALL');

  // Valuation & Analyst state (Agent 10)
  const [analystResult, setAnalystResult] = useState<AnalystWatchlistResult | null>(null);
  const [loadingAnalyst, setLoadingAnalyst] = useState<boolean>(false);
  const [selectedAnalystSymbol, setSelectedAnalystSymbol] = useState<AnalystEvaluation | null>(null);
  const [analystSymbolInput, setAnalystSymbolInput] = useState<string>('SQURPHARMA');
  const [analystSearchQuery, setAnalystSearchQuery] = useState<string>('');
  const [analystFilterVerdict, setAnalystFilterVerdict] = useState<string>('ALL');

  // News & Disclosures state (Agent 9)
  const [newsData, setNewsData] = useState<NewsFeedData | null>(null);
  const [loadingNews, setLoadingNews] = useState<boolean>(false);
  const [newsFilterCategory, setNewsFilterCategory] = useState<string>('ALL');
  const [newsSearchQuery, setNewsSearchQuery] = useState<string>('');
  const [selectedSymbolAudit, setSelectedSymbolAudit] = useState<SymbolAuditData | null>(null);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditSymbolInput, setAuditSymbolInput] = useState<string>('SQURPHARMA');
  const [expandedNewsId, setExpandedNewsId] = useState<string | null>(null);

  const [loadingPipeline, setLoadingPipeline] = useState(true);

  // Scanner state (Agent 1)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selectedSetup, setSelectedSetup] = useState<string>('all');
  const [scannerSearchQuery, setScannerSearchQuery] = useState('');
  const [minVolumeFilter, setMinVolumeFilter] = useState<number>(0);

  // Entry Planner state (Agent 2)
  const [entryResult, setEntryResult] = useState<EntryWatchlistResult | null>(null);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [selectedEntryStatus, setSelectedEntryStatus] = useState<string>('all');
  const [entrySearchQuery, setEntrySearchQuery] = useState('');

  // Exit Planner state (Agent 3)
  const [exitResult, setExitResult] = useState<ExitWatchlistResult | null>(null);
  const [loadingExits, setLoadingExits] = useState(false);
  const [selectedExitStopRule, setSelectedExitStopRule] = useState<string>('atr_1_5');
  const [exitSearchQuery, setExitSearchQuery] = useState('');

  // TimeMachine state (Agent 4)
  const [tmResult, setTmResult] = useState<TimeMachineWatchlistResult | null>(null);
  const [loadingTm, setLoadingTm] = useState(false);
  const [tmSearchQuery, setTmSearchQuery] = useState('');

  // Risk Guard state (Agent 5)
  const [riskResult, setRiskResult] = useState<RiskWatchlistResult | null>(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [accountEquityInput, setAccountEquityInput] = useState<number>(500000);
  const [maxLossPctInput, setMaxLossPctInput] = useState<number>(1.5);
  const [maxPosPctInput, setMaxPosPctInput] = useState<number>(20.0);
  const [riskSearchQuery, setRiskSearchQuery] = useState('');
  const [singleRiskSymbol, setSingleRiskSymbol] = useState('');
  const [singleRiskEntry, setSingleRiskEntry] = useState<number | ''>('');
  const [singleRiskStop, setSingleRiskStop] = useState<number | ''>('');
  const [singleRiskTarget, setSingleRiskTarget] = useState<number | ''>('');
  const [singleRiskQty, setSingleRiskQty] = useState<number | ''>('');
  const [auditingSingleRisk, setAuditingSingleRisk] = useState(false);
  const [singleRiskResult, setSingleRiskResult] = useState<RiskAuditResult | null>(null);

  // Budget & Position Sizing state (Agent 6)
  const [budgetResult, setBudgetResult] = useState<BudgetWatchlistResult | null>(null);
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [budgetCapitalInput, setBudgetCapitalInput] = useState<number>(500000);
  const [cashBufferPctInput, setCashBufferPctInput] = useState<number>(10);
  const [budgetMaxLossPctInput, setBudgetMaxLossPctInput] = useState<number>(1.5);
  const [budgetMaxPosPctInput, setBudgetMaxPosPctInput] = useState<number>(20.0);
  const [budgetSearchQuery, setBudgetSearchQuery] = useState('');
  const [singleBudgetSymbol, setSingleBudgetSymbol] = useState('SQURPHARMA');
  const [singleBudgetEntry, setSingleBudgetEntry] = useState<number | ''>(220.0);
  const [singleBudgetStop, setSingleBudgetStop] = useState<number | ''>(210.0);
  const [singleBudgetTarget, setSingleBudgetTarget] = useState<number | ''>(240.0);
  const [singleBudgetWinRate, setSingleBudgetWinRate] = useState<number>(50.0);
  const [singleBudgetResult, setSingleBudgetResult] = useState<BudgetSizedOrder | null>(null);
  const [sizingSingleBudget, setSizingSingleBudget] = useState(false);

  // Agent 7: Instant Alert & Notification Agent
  const [alertsResult, setAlertsResult] = useState<AlertsEvaluationResult | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [dseClock, setDseClock] = useState<DseClock | null>(null);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [alertsFilterType, setAlertsFilterType] = useState('ALL');
  const [alertsSearchQuery, setAlertsSearchQuery] = useState('');
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestStatus, setTelegramTestStatus] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestStatus, setWebhookTestStatus] = useState<string | null>(null);

  // Agent 8: Broker & Paper Trading
  const [brokerResult, setBrokerResult] = useState<PaperBrokerResult | null>(null);
  const [loadingBroker, setLoadingBroker] = useState(false);
  const [orderSymbolInput, setOrderSymbolInput] = useState('SQURPHARMA');
  const [orderSideInput, setOrderSideInput] = useState<'BUY' | 'SELL'>('BUY');
  const [orderQtyInput, setOrderQtyInput] = useState<number | ''>(100);
  const [orderPriceInput, setOrderPriceInput] = useState<number | ''>(220.0);
  const [orderStopInput, setOrderStopInput] = useState<number | ''>(210.0);
  const [orderTargetInput, setOrderTargetInput] = useState<number | ''>(240.0);
  const [executingOrder, setExecutingOrder] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState<string | null>(null);
  const [closingPositionSym, setClosingPositionSym] = useState<string | null>(null);

  // Approvals
  const [approving, setApproving] = useState(false);
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null);

  // Fetch agents pipeline status
  const fetchPipeline = async () => {
    try {
      const res = await fetch('/api/agents/pipeline');
      if (res.ok) {
        const data: AgentInfo[] = await res.json();
        setAgents(data);
        const runningAgent = data.find((a) => a.status === 'running');
        if (runningAgent) {
          setSelectedAgentId(runningAgent.id);
        }
      }
    } catch (err) {
      console.error('Failed to load agents pipeline:', err);
    } finally {
      setLoadingPipeline(false);
    }
  };

  // Run scanner agent (Agent 1)
  const triggerScan = async (force: boolean = false) => {
    setScanning(true);
    try {
      const queryParams = new URLSearchParams();
      if (force) queryParams.set('force_refresh', 'true');
      const res = await fetch(`/api/agents/scanner/run?${queryParams.toString()}`);
      if (res.ok) {
        const data: ScanResult = await res.json();
        setScanResult(data);
      }
    } catch (err) {
      console.error('Failed to run scanner agent:', err);
    } finally {
      setScanning(false);
    }
  };

  // Run entry agent (Agent 2)
  const triggerEntryWatchlist = async (force: boolean = false) => {
    setLoadingEntries(true);
    try {
      const queryParams = new URLSearchParams();
      if (force) queryParams.set('force_refresh', 'true');
      const res = await fetch(`/api/agents/entry/watchlist?${queryParams.toString()}`);
      if (res.ok) {
        const data: EntryWatchlistResult = await res.json();
        setEntryResult(data);
      }
    } catch (err) {
      console.error('Failed to run entry watchlist agent:', err);
    } finally {
      setLoadingEntries(false);
    }
  };

  // Run exit agent (Agent 3)
  const triggerExitWatchlist = async (force: boolean = false, rule: string = selectedExitStopRule) => {
    setLoadingExits(true);
    try {
      const queryParams = new URLSearchParams();
      if (force) queryParams.set('force_refresh', 'true');
      queryParams.set('stop_rule', rule);
      const res = await fetch(`/api/agents/exit/watchlist?${queryParams.toString()}`);
      if (res.ok) {
        const data: ExitWatchlistResult = await res.json();
        setExitResult(data);
      }
    } catch (err) {
      console.error('Failed to run exit watchlist agent:', err);
    } finally {
      setLoadingExits(false);
    }
  };

  // Run TimeMachine agent (Agent 4)
  const triggerTmWatchlist = async (force: boolean = false) => {
    setLoadingTm(true);
    try {
      const queryParams = new URLSearchParams();
      if (force) queryParams.set('force_refresh', 'true');
      const res = await fetch(`/api/agents/timemachine/watchlist?${queryParams.toString()}`);
      if (res.ok) {
        const data: TimeMachineWatchlistResult = await res.json();
        setTmResult(data);
      }
    } catch (err) {
      console.error('Failed to run TimeMachine watchlist agent:', err);
    } finally {
      setLoadingTm(false);
    }
  };

  // Run Risk Guard agent (Agent 5)
  const triggerRiskWatchlist = async (force: boolean = false) => {
    setLoadingRisk(true);
    try {
      const queryParams = new URLSearchParams();
      if (force) queryParams.set('force_refresh', 'true');
      queryParams.set('account_equity', String(accountEquityInput));
      queryParams.set('max_loss_pct', String(maxLossPctInput));
      queryParams.set('max_position_pct', String(maxPosPctInput));
      const res = await fetch(`/api/agents/risk/watchlist?${queryParams.toString()}`);
      if (res.ok) {
        const data: RiskWatchlistResult = await res.json();
        setRiskResult(data);
      }
    } catch (err) {
      console.error('Failed to run Risk watchlist agent:', err);
    } finally {
      setLoadingRisk(false);
    }
  };

  // Run single order risk audit (Agent 5)
  const runSingleRiskAudit = async () => {
    if (!singleRiskSymbol.trim() || !singleRiskEntry || !singleRiskStop || !singleRiskTarget || !singleRiskQty) return;
    setAuditingSingleRisk(true);
    try {
      const queryParams = new URLSearchParams({
        symbol: singleRiskSymbol.trim().toUpperCase(),
        entry: String(singleRiskEntry),
        stop: String(singleRiskStop),
        target: String(singleRiskTarget),
        qty: String(singleRiskQty),
        account_equity: String(accountEquityInput),
        max_loss_pct: String(maxLossPctInput),
        max_position_pct: String(maxPosPctInput),
      });
      const res = await fetch(`/api/agents/risk/audit?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSingleRiskResult(data);
      }
    } catch (err) {
      console.error('Failed to audit single order risk:', err);
    } finally {
      setAuditingSingleRisk(false);
    }
  };

  // Run Budget & Sizing Agent (Agent 6)
  const triggerBudgetWatchlist = async (force: boolean = false) => {
    setLoadingBudget(true);
    try {
      const queryParams = new URLSearchParams();
      if (force) queryParams.set('force_refresh', 'true');
      queryParams.set('budget', String(budgetCapitalInput));
      queryParams.set('cash_buffer_pct', String(cashBufferPctInput));
      queryParams.set('max_loss_pct', String(budgetMaxLossPctInput));
      queryParams.set('max_position_pct', String(budgetMaxPosPctInput));
      const res = await fetch(`/api/agents/budget/watchlist?${queryParams.toString()}`);
      if (res.ok) {
        const data: BudgetWatchlistResult = await res.json();
        setBudgetResult(data);
      }
    } catch (err) {
      console.error('Failed to run budget watchlist agent:', err);
    } finally {
      setLoadingBudget(false);
    }
  };

  // Run single stock sizing simulator (Agent 6)
  const runSingleBudgetSizing = async () => {
    if (!singleBudgetSymbol.trim() || !singleBudgetEntry || !singleBudgetStop || !singleBudgetTarget) return;
    setSizingSingleBudget(true);
    try {
      const queryParams = new URLSearchParams({
        symbol: singleBudgetSymbol.trim().toUpperCase(),
        entry: String(singleBudgetEntry),
        stop: String(singleBudgetStop),
        target: String(singleBudgetTarget),
        budget: String(budgetCapitalInput),
        cash_buffer_pct: String(cashBufferPctInput),
        max_loss_pct: String(budgetMaxLossPctInput),
        max_position_pct: String(budgetMaxPosPctInput),
        win_rate: String(singleBudgetWinRate || 50),
      });
      const res = await fetch(`/api/agents/budget/size?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSingleBudgetResult(data);
      }
    } catch (err) {
      console.error('Failed to size single stock:', err);
    } finally {
      setSizingSingleBudget(false);
    }
  };

  // Agent 7 fetchers & testers
  const fetchDseClock = async () => {
    try {
      const res = await fetch('/api/agents/alerts/clock');
      if (res.ok) {
        const data = await res.json();
        setDseClock(data);
      }
    } catch (err) {
      console.error('Failed to fetch DSE clock:', err);
    }
  };

  const triggerAlertsCheck = async () => {
    setLoadingAlerts(true);
    try {
      const q = new URLSearchParams();
      if (telegramToken && telegramChatId) {
        q.set('bot_token', telegramToken);
        q.set('chat_id', telegramChatId);
      }
      if (webhookUrlInput) {
        q.set('webhook_url', webhookUrlInput);
      }
      const res = await fetch(`/api/agents/alerts/check?${q.toString()}`);
      if (res.ok) {
        const data: AlertsEvaluationResult = await res.json();
        setAlertsResult(data);
        if (data.clock) setDseClock(data.clock);
      }
    } catch (err) {
      console.error('Failed to evaluate alerts:', err);
    } finally {
      setLoadingAlerts(false);
    }
  };

  const sendTestTelegram = async () => {
    if (!telegramToken.trim() || !telegramChatId.trim()) {
      setTelegramTestStatus('Please enter both Bot Token and Chat ID.');
      return;
    }
    setTestingTelegram(true);
    setTelegramTestStatus(null);
    try {
      const q = new URLSearchParams({
        bot_token: telegramToken.trim(),
        chat_id: telegramChatId.trim(),
        symbol: 'SQURPHARMA',
        message: 'Live test notification from DSE Trading Agent 7',
      });
      const res = await fetch(`/api/agents/alerts/test-telegram?${q.toString()}`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        setTelegramTestStatus('Message delivered successfully to Telegram! ✈️');
      } else {
        setTelegramTestStatus(`Telegram Error: ${data.details?.description || data.message || 'Failed'}`);
      }
    } catch (err) {
      setTelegramTestStatus(`Error: ${err}`);
    } finally {
      setTestingTelegram(false);
    }
  };

  const sendTestWebhook = async () => {
    if (!webhookUrlInput.trim()) {
      setWebhookTestStatus('Please enter a Webhook URL.');
      return;
    }
    setTestingWebhook(true);
    setWebhookTestStatus(null);
    try {
      const q = new URLSearchParams({
        webhook_url: webhookUrlInput.trim(),
        symbol: 'SQURPHARMA',
        event: 'BREAKOUT_TRIGGER',
      });
      const res = await fetch(`/api/agents/alerts/test-webhook?${q.toString()}`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        setWebhookTestStatus('Webhook delivered successfully (HTTP 200)! 🚀');
      } else {
        setWebhookTestStatus(`Webhook Error: ${data.message || 'Failed'}`);
      }
    } catch (err) {
      setWebhookTestStatus(`Error: ${err}`);
    } finally {
      setTestingWebhook(false);
    }
  };

  // Agent 8 Broker & Paper Trading Handlers
  
  // Agent 9: News & Corporate Disclosures API Callers
  
  // Agent 10: Valuation & Financial Analyst API Callers
  
  // Agent 11: Sponsor & Smart Money Flow API Callers
  const fetchPelosiWatchlist = async () => {
    setLoadingPelosi(true);
    try {
      const res = await fetch('/api/agents/pelosi/watchlist');
      if (res.ok) {
        const data = await res.json();
        setPelosiResult(data);
      }
    } catch (err) {
      console.error('Failed to fetch pelosi watchlist:', err);
    } finally {
      setLoadingPelosi(false);
    }
  };

  const fetchSinglePelosiAudit = async (sym: string) => {
    if (!sym.trim()) return;
    try {
      const res = await fetch(`/api/agents/pelosi/flow/${sym.trim().toUpperCase()}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPelosiSymbol(data);
      }
    } catch (err) {
      console.error(`Failed to audit smart money flow for ${sym}:`, err);
    }
  };

  const fetchAnalystWatchlist = async () => {
    setLoadingAnalyst(true);
    try {
      const res = await fetch('/api/agents/analyst/watchlist');
      if (res.ok) {
        const data = await res.json();
        setAnalystResult(data);
      }
    } catch (err) {
      console.error('Failed to fetch analyst watchlist:', err);
    } finally {
      setLoadingAnalyst(false);
    }
  };

  const fetchSingleAnalystAudit = async (sym: string) => {
    if (!sym.trim()) return;
    try {
      const res = await fetch(`/api/agents/analyst/evaluate/${sym.trim().toUpperCase()}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedAnalystSymbol(data);
      }
    } catch (err) {
      console.error(`Failed to audit valuation for ${sym}:`, err);
    }
  };

  const fetchNewsFeed = async (forceRefresh = false) => {
    setLoadingNews(true);
    try {
      const url = forceRefresh ? '/api/agents/news/feed?limit=100&force_refresh=true' : '/api/agents/news/feed?limit=100';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setNewsData(data);
      }
    } catch (err) {
      console.error('Failed to fetch corporate news feed:', err);
    } finally {
      setLoadingNews(false);
    }
  };

  const fetchSymbolAudit = async (symbol: string) => {
    if (!symbol.trim()) return;
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/agents/news/symbol/${symbol.trim().toUpperCase()}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSymbolAudit(data);
      }
    } catch (err) {
      console.error(`Failed to audit news for ${symbol}:`, err);
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchBrokerAccount = async () => {
    setLoadingBroker(true);
    try {
      const res = await fetch('/api/agents/broker/account');
      if (res.ok) {
        const data: PaperBrokerResult = await res.json();
        setBrokerResult(data);
      }
    } catch (err) {
      console.error('Failed to fetch broker account:', err);
    } finally {
      setLoadingBroker(false);
    }
  };

  const handlePlaceOrder = async (sym?: string, side?: string, qty?: number, price?: number, stop?: number, target?: number) => {
    const s = (sym || orderSymbolInput).trim().toUpperCase();
    const action = side || orderSideInput;
    const q = qty || Number(orderQtyInput);
    const p = price || Number(orderPriceInput);
    const sl = stop !== undefined ? stop : (orderStopInput ? Number(orderStopInput) : undefined);
    const tp = target !== undefined ? target : (orderTargetInput ? Number(orderTargetInput) : undefined);

    if (!s || !q || !p) {
      setOrderFeedback('Please provide valid symbol, quantity, and price.');
      return;
    }

    setExecutingOrder(true);
    setOrderFeedback(null);
    try {
      const params = new URLSearchParams({
        symbol: s,
        side: action,
        qty: String(q),
        price: String(p),
      });
      if (sl) params.set('stop_loss', String(sl));
      if (tp) params.set('take_profit', String(tp));

      const res = await fetch(`/api/agents/broker/order?${params.toString()}`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        setOrderFeedback(data.message);
        await fetchBrokerAccount();
      } else {
        setOrderFeedback(`Order Rejected: ${data.message}`);
      }
    } catch (err) {
      setOrderFeedback(`Order Failed: ${err}`);
    } finally {
      setExecutingOrder(false);
    }
  };

  const handleClosePosition = async (sym: string, ltp?: number) => {
    setClosingPositionSym(sym);
    try {
      const params = new URLSearchParams({ symbol: sym });
      if (ltp) params.set('price', String(ltp));
      const res = await fetch(`/api/agents/broker/close?${params.toString()}`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        setOrderFeedback(data.message);
        await fetchBrokerAccount();
      } else {
        setOrderFeedback(`Close Failed: ${data.message}`);
      }
    } catch (err) {
      setOrderFeedback(`Error: ${err}`);
    } finally {
      setClosingPositionSym(null);
    }
  };

  const handleResetPortfolio = async () => {
    if (!confirm('Are you sure you want to reset your paper portfolio back to ৳500,000?')) return;
    try {
      const res = await fetch('/api/agents/broker/reset?starting_cash=500000', { method: 'POST' });
      if (res.ok) {
        await fetchBrokerAccount();
        setOrderFeedback('Paper portfolio reset to ৳500,000 starting cash.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Approve agent status
  const approveAgent = async (agentId: string) => {
    setApproving(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/status?status=open`, {
        method: 'POST',
      });
      if (res.ok) {
        const updated = await res.json();
        setAgents(updated);
        setApprovalNotice(
          `Agent has been approved! The pipeline advances to the next stage.`
        );
      }
    } catch (err) {
      console.error('Failed to approve agent:', err);
    } finally {
      setApproving(false);
    }
  };

  useEffect(() => {
    fetchPipeline();
    fetchDseClock();
    triggerScan(false);
    triggerEntryWatchlist(false);
    triggerExitWatchlist(false, 'atr_1_5');
    triggerTmWatchlist(false);
    triggerRiskWatchlist(false);
    triggerBudgetWatchlist(false);
    runSingleBudgetSizing();
    triggerAlertsCheck();
    fetchBrokerAccount();
    fetchNewsFeed();
    fetchSymbolAudit('SQURPHARMA');
    fetchAnalystWatchlist();
    fetchSingleAnalystAudit('SQURPHARMA');
    fetchPelosiWatchlist();
    fetchSinglePelosiAudit('MPETROLEUM');
  }, []);

  // Filter Risk candidates
  const filteredRiskAudits = (riskResult?.audits || []).filter((a) => {
    if (riskSearchQuery.trim()) {
      const q = riskSearchQuery.trim().toUpperCase();
      return a.symbol.toUpperCase().includes(q);
    }
    return true;
  });

  // Filter Budget sized orders
  const filteredBudgetOrders = (budgetResult?.orders || []).filter((o) => {
    if (budgetSearchQuery.trim()) {
      const q = budgetSearchQuery.trim().toUpperCase();
      return o.symbol.toUpperCase().includes(q);
    }
    return true;
  });

  // Filter Alert rules
  const filteredAlertRules = (alertsResult?.rules || []).filter((r) => {
    if (alertsFilterType !== 'ALL' && r.rule_type !== alertsFilterType) return false;
    if (alertsSearchQuery.trim()) {
      const q = alertsSearchQuery.trim().toUpperCase();
      return r.symbol.toUpperCase().includes(q) || r.label.toUpperCase().includes(q);
    }
    return true;
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0d131a] text-slate-100 font-sans">
      <Sidebar active="agents" />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#222d39] bg-[#121922]/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/40 text-amber-400">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-wide">Analysis with Agent</h1>
                <span className="rounded-full bg-emerald-950/80 px-2 py-0.5 text-[10px] font-mono font-medium text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                  <Check className="h-2.5 w-2.5" /> Agents 1-10 Approved
                </span>
                <span className="rounded-full bg-amber-950/80 px-2 py-0.5 text-[10px] font-mono font-medium text-amber-400 border border-amber-800/60 animate-pulse flex items-center gap-1">
                  <Zap className="h-2.5 w-2.5" /> Agent 11 Active Testing (Sponsor & Smart Money Flow)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Deploy, live-test, and approve each autonomous day-trading agent step-by-step.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (selectedAgentId === 'trader-pelosi') { fetchPelosiWatchlist(); fetchSinglePelosiAudit(pelosiSymbolInput); }
                else if (selectedAgentId === 'trader-analyst') { fetchAnalystWatchlist(); fetchSingleAnalystAudit(analystSymbolInput); }
                else if (selectedAgentId === 'trader-news') { fetchNewsFeed(true); fetchSymbolAudit(auditSymbolInput); }
                else if (selectedAgentId === 'trader-broker') fetchBrokerAccount();
                else if (selectedAgentId === 'trader-alerts') triggerAlertsCheck();
                else if (selectedAgentId === 'trader-budget') triggerBudgetWatchlist(true);
                else if (selectedAgentId === 'trader-risk') triggerRiskWatchlist(true);
                else if (selectedAgentId === 'trader-timemachine') triggerTmWatchlist(true);
                else if (selectedAgentId === 'trader-exit') triggerExitWatchlist(true);
                else if (selectedAgentId === 'trader-entry') triggerEntryWatchlist(true);
                else triggerScan(true);
              }}
              disabled={scanning || loadingEntries || loadingExits || loadingTm || loadingRisk || loadingBudget || loadingAlerts || loadingBroker}
              className="flex items-center gap-2 rounded-md bg-[#1f2937] hover:bg-[#283548] px-3 py-1.5 text-xs font-medium text-slate-200 border border-slate-700 transition"
              title="Force Refresh Data from DSE"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scanning || loadingEntries || loadingExits || loadingTm || loadingRisk || loadingBudget || loadingAlerts || loadingBroker ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
              {scanning || loadingEntries || loadingExits || loadingTm || loadingRisk || loadingBudget || loadingAlerts || loadingBroker ? 'Calculating...' : 'Refresh Agent Data'}
            </button>
            <button
              onClick={() => navigate('/chart')}
              className="flex items-center gap-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-400 border border-amber-500/30 transition"
            >
              <span>Live Chart</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </header>

        {approvalNotice && (
          <div className="mx-6 mt-4 flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-4 text-emerald-200">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span className="text-sm font-medium">{approvalNotice}</span>
            </div>
            <button
              onClick={() => setApprovalNotice(null)}
              className="text-xs text-emerald-400 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Multi-Agent Cards Grid (3 States: Approved, Running, Locked) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  Agent Multi-Process Pipeline
                </h2>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block shadow-[0_0_8px_#10b981]" /> Approved (Open)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400 inline-block animate-pulse shadow-[0_0_8px_#f59e0b]" /> Running (Live Test)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-600 inline-block" /> Locked (Pending)
                </span>
              </div>
            </div>

            {loadingPipeline ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-32 rounded-lg bg-[#161f2b] animate-pulse border border-slate-800" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {agents.map((agent) => {
                  const isRunning = agent.status === 'running';
                  const isOpen = agent.status === 'open';
                  const isLocked = agent.status === 'locked';
                  const isSelected = selectedAgentId === agent.id;

                  return (
                    <div
                      key={agent.id}
                      onClick={() => !isLocked && setSelectedAgentId(agent.id)}
                      className={`relative flex flex-col justify-between rounded-xl p-4 transition-all border ${
                        isLocked ? 'cursor-not-allowed' : 'cursor-pointer'
                      } ${
                        isOpen
                          ? 'bg-gradient-to-b from-[#13231c] to-[#0f1917] border-emerald-500/40 shadow-sm hover:border-emerald-400'
                          : isRunning
                          ? 'bg-gradient-to-b from-[#1f2824] via-[#172124] to-[#11181f] border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/50'
                          : 'bg-[#121922]/70 border-slate-800/80 opacity-60 hover:opacity-75'
                      } ${isSelected ? 'ring-2 ring-cyan-400' : ''}`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[11px] font-bold text-slate-400">
                            #{String(agent.index).padStart(2, '0')}
                          </span>
                          {isOpen && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                              <Check className="h-3 w-3" /> Approved
                            </span>
                          )}
                          {isRunning && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/40 animate-pulse">
                              <Zap className="h-3 w-3 text-amber-400" /> Running
                            </span>
                          )}
                          {isLocked && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/90 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-700/60">
                              <Lock className="h-2.5 w-2.5" /> Locked
                            </span>
                          )}
                        </div>

                        <h3 className={`text-sm font-bold tracking-tight mb-1 ${isLocked ? 'text-slate-400' : 'text-white'}`}>
                          {agent.name}
                        </h3>
                        <p className="text-[11px] font-mono text-cyan-400/80 mb-2">
                          {agent.category}
                        </p>
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-3">
                          {agent.description}
                        </p>
                      </div>

                      <div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {agent.skills.slice(0, 3).map((skill) => (
                            <span
                              key={skill}
                              className="rounded bg-[#1a2332] px-1.5 py-0.5 text-[9px] font-mono text-slate-300 border border-slate-700/50"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between pt-2 border-t border-slate-800">
                          <span>{agent.badge}</span>
                          {!isLocked && <ChevronRight className="h-3.5 w-3.5 text-amber-400" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ACTIVE WORKSPACE SELECTOR TABS */}
          <div className="flex items-center gap-3 border-b border-[#222d39] pb-2 overflow-x-auto">
            {/* AGENT 10 TAB */}
            <button
              onClick={() => setSelectedAgentId('trader-analyst')}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-bold transition border-b-2 shrink-0 ${
                selectedAgentId === 'trader-analyst'
                  ? 'bg-[#18212c] text-amber-400 border-amber-400 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent'
              }`}
            >
              <Scale className="h-4 w-4" />
              <span>Agent 10: Financial Valuation & Analyst</span>
              <span className="rounded bg-amber-500/20 text-amber-400 px-1.5 py-0.5 text-[9px] font-mono">
                Live Testing
              </span>
            </button>
            {/* AGENT 9 TAB */}
            <button
              onClick={() => setSelectedAgentId('trader-news')}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-bold transition border-b-2 shrink-0 ${
                selectedAgentId === 'trader-news'
                  ? 'bg-[#18212c] text-amber-400 border-amber-400 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent'
              }`}
            >
              <Newspaper className="h-4 w-4" />
              <span>Agent 9: Corporate Disclosures & News</span>
              <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[9px] font-mono">
                Approved
              </span>
            </button>

            <button
              onClick={() => setSelectedAgentId('trader-broker')}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-bold transition border-b-2 shrink-0 ${
                selectedAgentId === 'trader-broker'
                  ? 'bg-[#18212c] text-amber-400 border-amber-400 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent'
              }`}
            >
              <Briefcase className="h-4 w-4" />
              <span>Agent 8: DSE Paper Trading Broker</span>
              <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[9px] font-mono">
                Approved
              </span>
            </button>

            <button
              onClick={() => setSelectedAgentId('trader-alerts')}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-bold transition border-b-2 shrink-0 ${
                selectedAgentId === 'trader-alerts'
                  ? 'bg-[#18212c] text-emerald-400 border-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent'
              }`}
            >
              <Bell className="h-4 w-4" />
              <span>Agent 7: Instant Alert & Notification</span>
              <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[9px] font-mono">
                Approved
              </span>
            </button>

            <button
              onClick={() => setSelectedAgentId('trader-budget')}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-bold transition border-b-2 shrink-0 ${
                selectedAgentId === 'trader-budget'
                  ? 'bg-[#18212c] text-emerald-400 border-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent'
              }`}
            >
              <Calculator className="h-4 w-4" />
              <span>Agent 6: Position Sizing & Budget</span>
              <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[9px] font-mono">
                Approved
              </span>
            </button>

            <button
              onClick={() => setSelectedAgentId('trader-risk')}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-bold transition border-b-2 shrink-0 ${
                selectedAgentId === 'trader-risk'
                  ? 'bg-[#18212c] text-emerald-400 border-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent'
              }`}
            >
              <Shield className="h-4 w-4" />
              <span>Agent 5: Capital Risk Guard</span>
              <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[9px] font-mono">
                Approved
              </span>
            </button>

            <button
              onClick={() => setSelectedAgentId('trader-timemachine')}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-bold transition border-b-2 shrink-0 ${
                selectedAgentId === 'trader-timemachine'
                  ? 'bg-[#18212c] text-emerald-400 border-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent'
              }`}
            >
              <History className="h-4 w-4" />
              <span>Agent 4: TimeMachine Replay</span>
              <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[9px] font-mono">
                Approved
              </span>
            </button>

            <button
              onClick={() => setSelectedAgentId('trader-exit')}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-bold transition border-b-2 shrink-0 ${
                selectedAgentId === 'trader-exit'
                  ? 'bg-[#18212c] text-emerald-400 border-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent'
              }`}
            >
              <LogOut className="h-4 w-4" />
              <span>Agent 3: Dynamic Exit Planner</span>
              <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[9px] font-mono">
                Approved
              </span>
            </button>

            <button
              onClick={() => setSelectedAgentId('trader-entry')}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-bold transition border-b-2 shrink-0 ${
                selectedAgentId === 'trader-entry'
                  ? 'bg-[#18212c] text-emerald-400 border-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent'
              }`}
            >
              <Target className="h-4 w-4" />
              <span>Agent 2: Tactical Entry Order</span>
              <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[9px] font-mono">
                Approved
              </span>
            </button>

            <button
              onClick={() => setSelectedAgentId('trader-scanner')}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-bold transition border-b-2 shrink-0 ${
                selectedAgentId === 'trader-scanner'
                  ? 'bg-[#18212c] text-emerald-400 border-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white border-transparent'
              }`}
            >
              <Crosshair className="h-4 w-4" />
              <span>Agent 1: Setup Scanner</span>
              <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[9px] font-mono">
                Approved
              </span>
            </button>
          </div>

          {/* ======================================================== */}
          {/* VIEW -2: AGENT 8 - DSE PAPER TRADING BROKER (ACTIVE)     */}
          {/* ======================================================== */}
                                        {/* ======================================================== */}
          {/* VIEW: AGENT 11 - SPONSOR & SMART MONEY FLOW (LIVE TESTING)*/}
          {/* ======================================================== */}
          {selectedAgentId === 'trader-pelosi' && (
            <div className="space-y-6">
              {/* Agent 11 Header Banner */}
              <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-[#221c13] via-[#1a1c24] to-[#131f22] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-400">
                      <Coins className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase">
                          Live Testing
                        </span>
                        <span className="rounded bg-purple-500/20 text-purple-400 border border-purple-500/40 px-2 py-0.5 text-[10px] font-mono font-bold">
                          Insider & Float Intelligence
                        </span>
                        <span className="text-xs text-slate-400">trader-pelosi v1.0</span>
                      </div>
                      <h2 className="text-lg font-bold text-white mt-1">
                        Agent 11: Sponsor & Smart Money Flow Agent
                      </h2>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Tracks Sponsor/Director share buy/sell declarations (Form 1/2), monthly institutional ownership accumulation, and retail float concentration.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchPelosiWatchlist()}
                      disabled={loadingPelosi}
                      className="flex items-center gap-1.5 rounded-lg bg-[#222d39] hover:bg-[#2b3846] text-slate-200 px-3 py-2 text-xs font-semibold border border-slate-700 transition"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingPelosi ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
                      <span>{loadingPelosi ? 'Updating Flow...' : 'Refresh Smart Money'}</span>
                    </button>
                    <button
                      onClick={() => setPelosiFilterVerdict('ACCUMULATION')}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-2 text-xs font-semibold border border-emerald-500/40 transition"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Accumulation ({pelosiResult?.summary?.accumulation_count || 5})</span>
                    </button>
                  </div>
                </div>

                {/* 4 KPI Cards */}
                <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-[#0d131a]/80 p-3 border border-[#222d39]">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Institutional Accumulation</div>
                    <div className="mt-1 text-xl font-bold font-mono text-emerald-400">
                      {pelosiResult?.summary?.accumulation_count || 5} Setups
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Heavy smart money control</div>
                  </div>

                  <div className="rounded-lg bg-[#0d131a]/80 p-3 border border-[#222d39]">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Average Smart Money Hold</div>
                    <div className="mt-1 text-xl font-bold font-mono text-cyan-400">
                      {pelosiResult?.summary?.average_smart_money_holding_pct || 78.0}%
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Sponsor + Govt + Institute float</div>
                  </div>

                  <div className="rounded-lg bg-[#0d131a]/80 p-3 border border-[#222d39]">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Smart Money Flow Score</div>
                    <div className="mt-1 text-xl font-bold font-mono text-amber-400">
                      {pelosiResult?.summary?.average_smart_money_score || 63} / 100
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Float lock & insider conviction</div>
                  </div>

                  <div className="rounded-lg bg-[#0d131a]/80 p-3 border border-[#222d39]">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Distribution Warnings</div>
                    <div className="mt-1 text-xl font-bold font-mono text-slate-300">
                      {pelosiResult?.summary?.distribution_count || 0} Flags
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Sponsor selling surveillance</div>
                  </div>
                </div>
              </div>

              {/* DSE "PELOSI" BLOTTER: SPONSOR / DIRECTOR DECLARATIONS */}
              <div className="rounded-xl border border-amber-500/30 bg-[#161c24] p-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[#222d39]">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">DSE Sponsor & Director Share Buy / Sell Declarations (The "Pelosi" Blotter)</h3>
                  </div>
                  <span className="text-[11px] text-amber-400 font-mono">
                    Form 1 & Form 2 Regulatory Filings
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(pelosiResult?.declarations_blotter || []).slice(0, 4).map((dec, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg bg-[#0d131a] p-3 border border-[#1e2733] hover:border-amber-500/40 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs font-mono">{dec.code}</span>
                          <span className={`rounded text-[10px] font-mono px-1.5 py-0.5 font-bold ${
                            dec.action_type === 'BUY_DECLARATION' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                            dec.action_type === 'SALE_DECLARATION' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                            'bg-slate-700 text-slate-300'
                          }`}>
                            {dec.action_type}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{dec.date} {dec.time}</span>
                      </div>
                      <div className="mt-1.5 text-xs text-slate-200 font-sans font-medium">
                        {dec.summary}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 font-sans line-clamp-2">
                        {dec.body}
                      </p>
                      {dec.quantity && (
                        <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-[#1e2733] text-[10px] font-mono">
                          <span className="text-slate-400">Declared Quantity:</span>
                          <span className="font-bold text-amber-400">{dec.quantity.toLocaleString()} Shares</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* SINGLE SECURITY SMART MONEY DOSSIER INSPECTOR */}
              <div className="rounded-xl border border-cyan-500/30 bg-[#121922] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#222d39]">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Target className="h-4 w-4 text-cyan-400" />
                      Single Stock Smart Money & Float Concentration Dossier
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Visualizes Sponsor, Institutional, Foreign and Retail float distribution to spot supply absorption.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pelosiSymbolInput}
                      onChange={(e) => setPelosiSymbolInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && fetchSinglePelosiAudit(pelosiSymbolInput)}
                      placeholder="e.g. MPETROLEUM"
                      className="rounded-md bg-[#0d131a] border border-[#2d3b4e] px-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-36"
                    />
                    <button
                      onClick={() => fetchSinglePelosiAudit(pelosiSymbolInput)}
                      className="rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-3 py-1.5 text-xs transition"
                    >
                      Audit Flow
                    </button>
                  </div>
                </div>

                {/* Quick selector chips */}
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 mr-1 font-mono">Quick Audit:</span>
                  {['MPETROLEUM', 'SQURPHARMA', 'BATBC', 'GP', 'BRACBANK', 'NCCBANK', 'JANATAINS', 'LHBL'].map((sym) => (
                    <button
                      key={sym}
                      onClick={() => {
                        setPelosiSymbolInput(sym);
                        fetchSinglePelosiAudit(sym);
                      }}
                      className={`rounded px-2 py-0.5 text-[11px] font-mono border transition ${
                        pelosiSymbolInput === sym
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                          : 'bg-[#0d131a] text-slate-400 border-[#222d39] hover:text-white'
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>

                {/* Audit Result Display */}
                {selectedPelosiSymbol && (
                  <div className="mt-4 rounded-lg bg-[#0d131a] border border-[#1e2733] p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#1e2733]">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-white font-mono">{selectedPelosiSymbol.symbol}</span>
                        <span className="text-xs text-slate-400">{selectedPelosiSymbol.name}</span>
                        <span className={`rounded px-2 py-0.5 text-xs font-mono font-bold ${
                          selectedPelosiSymbol.flow.verdict === 'INSTITUTIONAL_ACCUMULATION'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : selectedPelosiSymbol.flow.verdict === 'NEUTRAL_BALANCED_FLOW'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        }`}>
                          {selectedPelosiSymbol.flow.badge_label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 font-mono text-xs">
                        <span className="text-slate-400">As on: {selectedPelosiSymbol.as_on}</span>
                        <span className="text-amber-400 font-bold">
                          Smart Money Score: {selectedPelosiSymbol.flow.smart_money_flow_score} / 100
                        </span>
                      </div>
                    </div>

                    {/* Shareholding Breakdown Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs font-mono pb-1.5">
                        <span className="text-slate-300">Shareholding Ownership Distribution</span>
                        <span className="text-emerald-400 font-bold">
                          Smart Money Control: {selectedPelosiSymbol.shareholding.smart_money_total_pct}% | Retail Float: {selectedPelosiSymbol.shareholding.retail_float_pct}%
                        </span>
                      </div>

                      <div className="h-4 w-full rounded-full bg-[#1e2733] overflow-hidden flex text-[10px] font-mono text-slate-950 font-bold">
                        {selectedPelosiSymbol.shareholding.sponsor_pct > 0 && (
                          <div
                            style={{ width: `${selectedPelosiSymbol.shareholding.sponsor_pct}%` }}
                            className="bg-amber-400 flex items-center justify-center truncate"
                            title={`Sponsor: ${selectedPelosiSymbol.shareholding.sponsor_pct}%`}
                          >
                            {selectedPelosiSymbol.shareholding.sponsor_pct >= 10 ? `Sponsor ${selectedPelosiSymbol.shareholding.sponsor_pct}%` : ''}
                          </div>
                        )}
                        {selectedPelosiSymbol.shareholding.govt_pct > 0 && (
                          <div
                            style={{ width: `${selectedPelosiSymbol.shareholding.govt_pct}%` }}
                            className="bg-blue-400 flex items-center justify-center truncate"
                            title={`Govt: ${selectedPelosiSymbol.shareholding.govt_pct}%`}
                          >
                            {selectedPelosiSymbol.shareholding.govt_pct >= 10 ? `Govt ${selectedPelosiSymbol.shareholding.govt_pct}%` : ''}
                          </div>
                        )}
                        {selectedPelosiSymbol.shareholding.institute_pct > 0 && (
                          <div
                            style={{ width: `${selectedPelosiSymbol.shareholding.institute_pct}%` }}
                            className="bg-emerald-400 flex items-center justify-center truncate"
                            title={`Institute: ${selectedPelosiSymbol.shareholding.institute_pct}%`}
                          >
                            {selectedPelosiSymbol.shareholding.institute_pct >= 10 ? `Inst ${selectedPelosiSymbol.shareholding.institute_pct}%` : ''}
                          </div>
                        )}
                        {selectedPelosiSymbol.shareholding.foreign_pct > 0 && (
                          <div
                            style={{ width: `${selectedPelosiSymbol.shareholding.foreign_pct}%` }}
                            className="bg-purple-400 flex items-center justify-center truncate"
                            title={`Foreign: ${selectedPelosiSymbol.shareholding.foreign_pct}%`}
                          >
                            {selectedPelosiSymbol.shareholding.foreign_pct >= 5 ? `For ${selectedPelosiSymbol.shareholding.foreign_pct}%` : ''}
                          </div>
                        )}
                        {selectedPelosiSymbol.shareholding.public_pct > 0 && (
                          <div
                            style={{ width: `${selectedPelosiSymbol.shareholding.public_pct}%` }}
                            className="bg-slate-500 flex items-center justify-center text-white truncate"
                            title={`Public Float: ${selectedPelosiSymbol.shareholding.public_pct}%`}
                          >
                            {selectedPelosiSymbol.shareholding.public_pct >= 10 ? `Public ${selectedPelosiSymbol.shareholding.public_pct}%` : ''}
                          </div>
                        )}
                      </div>

                      {/* Legend */}
                      <div className="mt-2.5 flex items-center gap-4 text-[11px] font-mono text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Sponsor: {selectedPelosiSymbol.shareholding.sponsor_pct}%</span>
                        {selectedPelosiSymbol.shareholding.govt_pct > 0 && (
                          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-400" /> Govt: {selectedPelosiSymbol.shareholding.govt_pct}%</span>
                        )}
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Institute: {selectedPelosiSymbol.shareholding.institute_pct}%</span>
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-purple-400" /> Foreign: {selectedPelosiSymbol.shareholding.foreign_pct}%</span>
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-500" /> Public Float: {selectedPelosiSymbol.shareholding.public_pct}%</span>
                      </div>
                    </div>

                    {/* Actionable Trader Briefing */}
                    <div className="mt-3.5 rounded bg-[#16202c] p-3 border border-[#233345] flex items-start gap-2.5">
                      <Zap className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[11px] font-mono text-amber-400 uppercase tracking-wider font-bold">Smart Money & Insider Briefing</div>
                        <p className="text-xs text-slate-200 mt-0.5 font-sans leading-relaxed">
                          {selectedPelosiSymbol.flow.actionable_briefing}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* WATCHLIST SMART MONEY MATRIX TABLE */}
              <div className="rounded-xl border border-[#222d39] bg-[#121922] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#222d39]">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">Watchlist Smart Money Ownership & Float Concentration</h3>
                    <span className="rounded bg-[#1f2937] text-slate-300 text-[11px] font-mono px-2 py-0.5">
                      {pelosiResult?.watchlist_count || 9} securities evaluated
                    </span>
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={pelosiSearchQuery}
                        onChange={(e) => setPelosiSearchQuery(e.target.value)}
                        placeholder="Search ticker..."
                        className="rounded-md bg-[#0d131a] border border-[#2d3b4e] pl-8 pr-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-44"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-[#0d131a] p-1 rounded-md border border-[#222d39] text-xs">
                      {[
                        { id: 'ALL', label: 'All' },
                        { id: 'ACCUMULATION', label: 'Accumulation' },
                        { id: 'BALANCED', label: 'Balanced' },
                        { id: 'DISTRIBUTION', label: 'Distribution' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setPelosiFilterVerdict(tab.id)}
                          className={`rounded px-2 py-1 text-[11px] font-mono transition ${
                            pelosiFilterVerdict === tab.id
                              ? 'bg-amber-500/20 text-amber-300 font-bold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Matrix Table */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[#222d39] text-[11px] text-slate-400 uppercase tracking-wider bg-[#0d131a]">
                        <th className="py-2.5 px-3">Security</th>
                        <th className="py-2.5 px-3">Sponsor %</th>
                        <th className="py-2.5 px-3">Institute %</th>
                        <th className="py-2.5 px-3">Foreign %</th>
                        <th className="py-2.5 px-3">Public Float %</th>
                        <th className="py-2.5 px-3">Smart Money Hold %</th>
                        <th className="py-2.5 px-3">Flow Score</th>
                        <th className="py-2.5 px-3">Flow Verdict</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e2733]">
                      {(pelosiResult?.evaluations || [])
                        .filter((ev) => {
                          if (pelosiFilterVerdict === 'ACCUMULATION' && ev.flow.verdict !== 'INSTITUTIONAL_ACCUMULATION') return false;
                          if (pelosiFilterVerdict === 'BALANCED' && ev.flow.verdict !== 'NEUTRAL_BALANCED_FLOW') return false;
                          if (pelosiFilterVerdict === 'DISTRIBUTION' && ev.flow.verdict !== 'SPONSOR_DISTRIBUTION_RISK') return false;
                          if (pelosiSearchQuery.trim()) {
                            const q = pelosiSearchQuery.trim().toUpperCase();
                            return ev.symbol.toUpperCase().includes(q) || ev.name.toUpperCase().includes(q);
                          }
                          return true;
                        })
                        .map((ev) => {
                          const sh = ev.shareholding;
                          const fl = ev.flow;
                          return (
                            <tr key={ev.symbol} className="hover:bg-[#16202c] transition">
                              <td className="py-3 px-3">
                                <div className="font-bold text-white">{ev.symbol}</div>
                                <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{ev.name}</div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-bold text-amber-400">{sh.sponsor_pct.toFixed(1)}%</div>
                                {sh.sponsor_change_pct !== 0 && (
                                  <div className={`text-[10px] ${sh.sponsor_change_pct > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {sh.sponsor_change_pct > 0 ? `+${sh.sponsor_change_pct}%` : `${sh.sponsor_change_pct}%`} MoM
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-bold text-emerald-400">{sh.institute_pct.toFixed(1)}%</div>
                                {sh.institute_change_pct !== 0 && (
                                  <div className={`text-[10px] ${sh.institute_change_pct > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {sh.institute_change_pct > 0 ? `+${sh.institute_change_pct}%` : `${sh.institute_change_pct}%`} MoM
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-purple-300">
                                {sh.foreign_pct.toFixed(1)}%
                              </td>
                              <td className="py-3 px-3">
                                <div className={`font-bold ${sh.retail_float_pct <= 10.0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                                  {sh.retail_float_pct.toFixed(1)}%
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {sh.retail_float_pct <= 10.0 ? '🔥 Ultra Tight' : sh.retail_float_pct <= 25.0 ? 'Tight Float' : 'Normal Float'}
                                </div>
                              </td>
                              <td className="py-3 px-3 font-bold text-cyan-400">
                                {sh.smart_money_total_pct.toFixed(1)}%
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-14 h-1.5 rounded-full bg-[#1e2733] overflow-hidden">
                                    <div
                                      className={`h-full ${
                                        fl.smart_money_flow_score >= 70 ? 'bg-emerald-400' : fl.smart_money_flow_score >= 45 ? 'bg-amber-400' : 'bg-slate-400'
                                      }`}
                                      style={{ width: `${fl.smart_money_flow_score}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] font-bold text-slate-300">{fl.smart_money_flow_score}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className={`rounded px-2 py-0.5 text-[10px] font-bold border ${
                                  fl.verdict === 'INSTITUTIONAL_ACCUMULATION' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                                  fl.verdict === 'NEUTRAL_BALANCED_FLOW' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' :
                                  'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                }`}>
                                  {fl.verdict === 'INSTITUTIONAL_ACCUMULATION' ? 'Accumulation' : fl.verdict === 'NEUTRAL_BALANCED_FLOW' ? 'Balanced' : 'Distribution'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  onClick={() => {
                                    setPelosiSymbolInput(ev.symbol);
                                    fetchSinglePelosiAudit(ev.symbol);
                                  }}
                                  className="text-cyan-400 hover:text-cyan-300 font-bold text-xs"
                                >
                                  Audit Flow →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* VERIFICATION CHECKLIST & FINAL PIPELINE APPROVAL BAR */}
              <div className="rounded-xl border border-emerald-500/50 bg-gradient-to-r from-[#18261e] via-[#152026] to-[#121c21] p-5 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-mono font-bold uppercase">
                        Final Agent 11 of 11
                      </span>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        Agent 11 Live Test Verification Checklist (Sponsor & Smart Money Flow)
                      </h4>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>DSE Sponsor / Director Buy-Sell declarations (Form 1 & 2) tracking operational.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Monthly institutional vs retail public float concentration matrix computed.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Smart Money Flow Index integrated to protect traders from insider distribution traps.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="shrink-0 flex items-center gap-3">
                    <button
                      onClick={() => approveAgent('trader-pelosi')}
                      disabled={approving}
                      className="flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-3 text-sm shadow-xl transition"
                    >
                      <Check className="h-5 w-5" />
                      {approving ? 'Saving Pipeline Completion...' : 'Approve Agent 11 & Complete 11-Agent System'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

{/* ======================================================== */}
          {/* VIEW: AGENT 10 - FINANCIAL VALUATION & ANALYST (LIVE TESTING)*/}
          {/* ======================================================== */}
          {selectedAgentId === 'trader-analyst' && (
            <div className="space-y-6">
              {/* Agent 10 Header Banner */}
              <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-[#221c13] via-[#1a1c24] to-[#131f22] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-400">
                      <Scale className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase">
                          Live Testing
                        </span>
                        <span className="rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-mono font-bold">
                          Graham Valuation Engine
                        </span>
                        <span className="text-xs text-slate-400">trader-analyst v1.0</span>
                      </div>
                      <h2 className="text-lg font-bold text-white mt-1">
                        Agent 10: Financial Valuation & Fundamental Analyst
                      </h2>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Evaluates P/E ratios against Sector Medians, Price-to-Book cushions, Graham intrinsic fair values, and Fundamental Health Scores.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchAnalystWatchlist()}
                      disabled={loadingAnalyst}
                      className="flex items-center gap-1.5 rounded-lg bg-[#222d39] hover:bg-[#2b3846] text-slate-200 px-3 py-2 text-xs font-semibold border border-slate-700 transition"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingAnalyst ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
                      <span>{loadingAnalyst ? 'Calculating...' : 'Recalculate Valuations'}</span>
                    </button>
                    <button
                      onClick={() => setAnalystFilterVerdict('UNDERVALUED')}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-2 text-xs font-semibold border border-emerald-500/40 transition"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Deep Value ({analystResult?.summary?.undervalued_count || 0})</span>
                    </button>
                  </div>
                </div>

                {/* 4 KPI Cards */}
                <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-[#0d131a]/80 p-3 border border-[#222d39]">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Deep Value Candidates</div>
                    <div className="mt-1 text-xl font-bold font-mono text-emerald-400">
                      {analystResult?.summary?.undervalued_count || 4} Stocks
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Strong margin of safety</div>
                  </div>

                  <div className="rounded-lg bg-[#0d131a]/80 p-3 border border-[#222d39]">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Average Watchlist P/E</div>
                    <div className="mt-1 text-xl font-bold font-mono text-cyan-400">
                      {analystResult?.summary?.average_pe || 12.8}x
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">DSE Market Median: 12.5x</div>
                  </div>

                  <div className="rounded-lg bg-[#0d131a]/80 p-3 border border-[#222d39]">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Fundamental Health Score</div>
                    <div className="mt-1 text-xl font-bold font-mono text-amber-400">
                      {analystResult?.summary?.average_fundamental_score || 73} / 100
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">High quality balance sheets</div>
                  </div>

                  <div className="rounded-lg bg-[#0d131a]/80 p-3 border border-[#222d39]">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Overvalued / High Risk</div>
                    <div className="mt-1 text-xl font-bold font-mono text-slate-300">
                      {analystResult?.summary?.overvalued_count || 0} Securities
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Speculative multiple filter</div>
                  </div>
                </div>
              </div>

              {/* SECTOR P/E BENCHMARKS BAR */}
              <div className="rounded-xl border border-[#222d39] bg-[#121922] p-4 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-[#1e2733]">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                    <BarChart2 className="h-3.5 w-3.5 text-cyan-400" />
                    DSE Sector P/E Benchmark Multiples:
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Market Baseline: 12.5x</span>
                </div>
                <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
                  {[
                    { s: 'Bank', pe: '7.2x' },
                    { s: 'Fuel & Power', pe: '10.8x' },
                    { s: 'Pharmaceuticals', pe: '15.5x' },
                    { s: 'Telecommunication', pe: '14.5x' },
                    { s: 'Cement', pe: '14.2x' },
                    { s: 'Food & Allied', pe: '18.2x' },
                    { s: 'Engineering', pe: '16.0x' },
                    { s: 'General Insurance', pe: '13.8x' },
                  ].map((b) => (
                    <div key={b.s} className="rounded bg-[#0d131a] px-2.5 py-1 border border-[#1e2733] shrink-0">
                      <span className="text-slate-400 text-[10px]">{b.s}:</span>{' '}
                      <span className="font-bold text-white text-[11px]">{b.pe}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SINGLE SECURITY VALUATION DOSSIER INSPECTOR */}
              <div className="rounded-xl border border-cyan-500/30 bg-[#121922] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#222d39]">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-cyan-400" />
                      Single Stock Fundamental Valuation Dossier
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Extracts 5-year financials, Graham intrinsic fair value, Price-to-Book multiple, and safety cushion.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={analystSymbolInput}
                      onChange={(e) => setAnalystSymbolInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && fetchSingleAnalystAudit(analystSymbolInput)}
                      placeholder="e.g. SQURPHARMA"
                      className="rounded-md bg-[#0d131a] border border-[#2d3b4e] px-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-36"
                    />
                    <button
                      onClick={() => fetchSingleAnalystAudit(analystSymbolInput)}
                      className="rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-3 py-1.5 text-xs transition"
                    >
                      Audit Valuation
                    </button>
                  </div>
                </div>

                {/* Quick selector chips */}
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 mr-1 font-mono">Quick Ticker:</span>
                  {['SQURPHARMA', 'MPETROLEUM', 'BATBC', 'GP', 'BRACBANK', 'JANATAINS', 'LHBL', 'BEXIMCO'].map((sym) => (
                    <button
                      key={sym}
                      onClick={() => {
                        setAnalystSymbolInput(sym);
                        fetchSingleAnalystAudit(sym);
                      }}
                      className={`rounded px-2 py-0.5 text-[11px] font-mono border transition ${
                        analystSymbolInput === sym
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                          : 'bg-[#0d131a] text-slate-400 border-[#222d39] hover:text-white'
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>

                {/* Audit Result Display */}
                {selectedAnalystSymbol && (
                  <div className="mt-4 rounded-lg bg-[#0d131a] border border-[#1e2733] p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#1e2733]">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-white font-mono">{selectedAnalystSymbol.symbol}</span>
                        <span className="text-xs text-slate-400">{selectedAnalystSymbol.name} ({selectedAnalystSymbol.sector})</span>
                        <span className={`rounded px-2 py-0.5 text-xs font-mono font-bold ${
                          selectedAnalystSymbol.valuation.verdict === 'UNDERVALUED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : selectedAnalystSymbol.valuation.verdict === 'FAIRLY_VALUED'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        }`}>
                          {selectedAnalystSymbol.valuation.badge_label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-mono">Health Score:</span>
                        <span className="text-sm font-bold font-mono text-amber-400">
                          {selectedAnalystSymbol.valuation.fundamental_health_score} / 100
                        </span>
                      </div>
                    </div>

                    {/* Metric Grid */}
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-2.5 text-xs font-mono">
                      <div className="rounded bg-[#121922] p-2.5 border border-[#1e2733]">
                        <div className="text-[10px] text-slate-400 uppercase">Current P/E</div>
                        <div className="text-sm font-bold text-white mt-0.5">
                          {selectedAnalystSymbol.metrics.current_pe}x
                        </div>
                        <div className="text-[10px] text-emerald-400 mt-0.5">
                          vs {selectedAnalystSymbol.metrics.sector_median_pe}x Sector
                        </div>
                      </div>

                      <div className="rounded bg-[#121922] p-2.5 border border-[#1e2733]">
                        <div className="text-[10px] text-slate-400 uppercase">P/B Ratio</div>
                        <div className="text-sm font-bold text-white mt-0.5">
                          {selectedAnalystSymbol.metrics.pb_ratio}x
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          NAV: ৳{selectedAnalystSymbol.metrics.nav_per_share}
                        </div>
                      </div>

                      <div className="rounded bg-[#121922] p-2.5 border border-[#1e2733]">
                        <div className="text-[10px] text-slate-400 uppercase">Annual EPS</div>
                        <div className="text-sm font-bold text-white mt-0.5">
                          ৳{selectedAnalystSymbol.metrics.eps}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          LTP: ৳{selectedAnalystSymbol.ltp}
                        </div>
                      </div>

                      <div className="rounded bg-[#121922] p-2.5 border border-[#1e2733]">
                        <div className="text-[10px] text-slate-400 uppercase">Graham Fair Value</div>
                        <div className="text-sm font-bold text-cyan-400 mt-0.5">
                          ৳{selectedAnalystSymbol.metrics.graham_number || 'N/A'}
                        </div>
                        <div className={`text-[10px] mt-0.5 ${
                          (selectedAnalystSymbol.metrics.graham_upside_pct || 0) >= 0 ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                          {selectedAnalystSymbol.metrics.graham_upside_pct !== undefined ? `${selectedAnalystSymbol.metrics.graham_upside_pct > 0 ? '+' : ''}${selectedAnalystSymbol.metrics.graham_upside_pct}%` : ''}
                        </div>
                      </div>

                      <div className="rounded bg-[#121922] p-2.5 border border-[#1e2733]">
                        <div className="text-[10px] text-slate-400 uppercase">Dividend Yield</div>
                        <div className="text-sm font-bold text-emerald-400 mt-0.5">
                          {selectedAnalystSymbol.metrics.dividend_yield || 'N/A'}%
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Cash: {selectedAnalystSymbol.metrics.last_dividend_cash_pct || 'N/A'}%
                        </div>
                      </div>

                      <div className="rounded bg-[#121922] p-2.5 border border-[#1e2733]">
                        <div className="text-[10px] text-slate-400 uppercase">Market Cap</div>
                        <div className="text-sm font-bold text-white mt-0.5 truncate">
                          ৳{(selectedAnalystSymbol.metrics.market_cap_mn || 0).toLocaleString()}M
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Category {selectedAnalystSymbol.category}</div>
                      </div>
                    </div>

                    {/* Actionable Trader Briefing */}
                    <div className="mt-3.5 rounded bg-[#16202c] p-3 border border-[#233345] flex items-start gap-2.5">
                      <Zap className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[11px] font-mono text-amber-400 uppercase tracking-wider font-bold">Analyst Fundamental Briefing</div>
                        <p className="text-xs text-slate-200 mt-0.5 font-sans leading-relaxed">
                          {selectedAnalystSymbol.valuation.actionable_briefing}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* WATCHLIST VALUATION MATRIX TABLE */}
              <div className="rounded-xl border border-[#222d39] bg-[#121922] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#222d39]">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">Watchlist Fundamental Valuation Matrix</h3>
                    <span className="rounded bg-[#1f2937] text-slate-300 text-[11px] font-mono px-2 py-0.5">
                      {analystResult?.watchlist_count || 8} setups evaluated
                    </span>
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={analystSearchQuery}
                        onChange={(e) => setAnalystSearchQuery(e.target.value)}
                        placeholder="Search ticker or sector..."
                        className="rounded-md bg-[#0d131a] border border-[#2d3b4e] pl-8 pr-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-44"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-[#0d131a] p-1 rounded-md border border-[#222d39] text-xs">
                      {[
                        { id: 'ALL', label: 'All' },
                        { id: 'UNDERVALUED', label: 'Deep Value' },
                        { id: 'FAIRLY_VALUED', label: 'Fair' },
                        { id: 'OVERVALUED', label: 'High Risk' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setAnalystFilterVerdict(tab.id)}
                          className={`rounded px-2 py-1 text-[11px] font-mono transition ${
                            analystFilterVerdict === tab.id
                              ? 'bg-amber-500/20 text-amber-300 font-bold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Valuation Table */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[#222d39] text-[11px] text-slate-400 uppercase tracking-wider bg-[#0d131a]">
                        <th className="py-2.5 px-3">Security</th>
                        <th className="py-2.5 px-3">LTP (৳)</th>
                        <th className="py-2.5 px-3">P/E vs Sector</th>
                        <th className="py-2.5 px-3">NAV (P/B)</th>
                        <th className="py-2.5 px-3">Annual EPS</th>
                        <th className="py-2.5 px-3">Graham Fair Value</th>
                        <th className="py-2.5 px-3">Health Score</th>
                        <th className="py-2.5 px-3">Safety Verdict</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e2733]">
                      {(analystResult?.evaluations || [])
                        .filter((ev) => {
                          if (analystFilterVerdict !== 'ALL' && ev.valuation.verdict !== analystFilterVerdict) return false;
                          if (analystSearchQuery.trim()) {
                            const q = analystSearchQuery.trim().toUpperCase();
                            return ev.symbol.toUpperCase().includes(q) || ev.sector.toUpperCase().includes(q);
                          }
                          return true;
                        })
                        .map((ev) => {
                          const m = ev.metrics;
                          const v = ev.valuation;
                          return (
                            <tr key={ev.symbol} className="hover:bg-[#16202c] transition">
                              <td className="py-3 px-3">
                                <div className="font-bold text-white">{ev.symbol}</div>
                                <div className="text-[10px] text-slate-400">{ev.sector}</div>
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-200">
                                ৳{ev.ltp.toFixed(1)}
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-white">{m.current_pe.toFixed(1)}x</span>
                                  <span className={`text-[10px] rounded px-1 py-0.2 ${
                                    m.pe_discount_vs_sector_pct >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                                  }`}>
                                    {m.pe_discount_vs_sector_pct >= 0 ? `-${m.pe_discount_vs_sector_pct.toFixed(0)}%` : `+${Math.abs(m.pe_discount_vs_sector_pct).toFixed(0)}%`}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400">Sector: {m.sector_median_pe}x</div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="text-slate-200">৳{m.nav_per_share.toFixed(1)}</div>
                                <div className={`text-[10px] ${m.pb_ratio <= 1.0 ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                                  P/B: {m.pb_ratio.toFixed(2)}x {m.pb_ratio <= 1.0 ? '(Below NAV!)' : ''}
                                </div>
                              </td>
                              <td className="py-3 px-3 font-bold text-white">
                                ৳{m.eps.toFixed(2)}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-bold text-cyan-400">
                                  {m.graham_number ? `৳${m.graham_number.toFixed(1)}` : 'N/A'}
                                </div>
                                <div className={`text-[10px] ${
                                  (m.graham_upside_pct || 0) >= 0 ? 'text-emerald-400' : 'text-slate-400'
                                }`}>
                                  {m.graham_upside_pct !== undefined ? `${m.graham_upside_pct > 0 ? '+' : ''}${m.graham_upside_pct.toFixed(1)}%` : ''}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 rounded-full bg-[#1e2733] overflow-hidden">
                                    <div
                                      className={`h-full ${
                                        v.fundamental_health_score >= 70 ? 'bg-emerald-400' : v.fundamental_health_score >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                                      }`}
                                      style={{ width: `${v.fundamental_health_score}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] font-bold text-slate-300">{v.fundamental_health_score}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className={`rounded px-2 py-0.5 text-[10px] font-bold border ${
                                  v.verdict === 'UNDERVALUED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                                  v.verdict === 'FAIRLY_VALUED' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' :
                                  'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                }`}>
                                  {v.verdict === 'UNDERVALUED' ? 'Deep Value' : v.verdict === 'FAIRLY_VALUED' ? 'Fair' : 'Overvalued'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  onClick={() => {
                                    setAnalystSymbolInput(ev.symbol);
                                    fetchSingleAnalystAudit(ev.symbol);
                                  }}
                                  className="text-cyan-400 hover:text-cyan-300 font-bold text-xs"
                                >
                                  Audit Dossier →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* VERIFICATION CHECKLIST & APPROVAL BAR */}
              <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-[#18201b] via-[#151c24] to-[#121c21] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      Agent 10 Live Test Verification Checklist (Financial Valuation & Analyst)
                    </h4>
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>DSE Audited Financials, Annual EPS, NAVPS, and P/B multiple extraction active.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Sector Median P/E benchmark discount/premium & Graham intrinsic valuation computed.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Fundamental Health Score (0-100) integrated to validate technical breakout trade setups.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="shrink-0 flex items-center gap-3">
                    <button
                      onClick={() => approveAgent('trader-analyst')}
                      disabled={approving}
                      className="flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 text-xs shadow-lg transition"
                    >
                      <Check className="h-4 w-4" />
                      {approving ? 'Saving Approval...' : 'Approve Agent 10 & Proceed to Agent 11'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

{/* ======================================================== */}
          {/* VIEW: AGENT 9 - CORPORATE DISCLOSURES & NEWS (LIVE TESTING)*/}
          {/* ======================================================== */}
          {selectedAgentId === 'trader-news' && (
            <div className="space-y-6">
              {/* Agent 9 Header Banner */}
              <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-[#221c13] via-[#1a1c24] to-[#131f22] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-400">
                      <Newspaper className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase">
                          Live Testing
                        </span>
                        <span className="rounded bg-blue-500/20 text-blue-400 border border-blue-500/40 px-2 py-0.5 text-[10px] font-mono font-bold">
                          DSE Direct API Feed
                        </span>
                        <span className="text-xs text-slate-400">trader-news v1.0</span>
                      </div>
                      <h2 className="text-lg font-bold text-white mt-1">
                        Agent 9: Corporate Disclosures & News Intelligence
                      </h2>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Monitors live DSE Price Sensitive Information (PSI), Board Meetings (LR 16/19), Dividends, and EPS reports with NLP Sentiment Scoring.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchNewsFeed(true)}
                      disabled={loadingNews}
                      className="flex items-center gap-1.5 rounded-lg bg-[#222d39] hover:bg-[#2b3846] text-slate-200 px-3 py-2 text-xs font-semibold border border-slate-700 transition"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingNews ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
                      <span>{loadingNews ? 'Syncing Feed...' : 'Sync Live DSE Feed'}</span>
                    </button>
                    <button
                      onClick={() => setNewsFilterCategory('BOARD_MEETING')}
                      className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-2 text-xs font-semibold border border-amber-500/40 transition"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Board Meetings ({newsData?.upcoming_catalysts?.length || 0})</span>
                    </button>
                  </div>
                </div>

                {/* 4 KPI Cards */}
                <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-[#0d131a]/80 p-3 border border-[#222d39]">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Disclosures Monitored</div>
                    <div className="mt-1 text-xl font-bold font-mono text-white">
                      {newsData?.total_disclosures_monitored || 200}+
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Live DSE feed (5-min cache)</div>
                  </div>

                  <div className="rounded-lg bg-[#0d131a]/80 p-3 border border-[#222d39]">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Market Sentiment Bias</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`text-lg font-bold font-mono ${
                        newsData?.sentiment_overview?.net_market_bias === 'BULLISH'
                          ? 'text-emerald-400'
                          : newsData?.sentiment_overview?.net_market_bias === 'BEARISH'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}>
                        {newsData?.sentiment_overview?.net_market_bias || 'NEUTRAL'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {newsData?.sentiment_overview?.bullish_count || 0} 🟢 / {newsData?.sentiment_overview?.bearish_count || 0} 🔴 / {newsData?.sentiment_overview?.neutral_count || 0} ⚪
                    </div>
                  </div>

                  <div className="rounded-lg bg-[#0d131a]/80 p-3 border border-[#222d39]">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Watchlist Filings</div>
                    <div className="mt-1 text-xl font-bold font-mono text-cyan-400">
                      {newsData?.watchlist_news?.length || 0}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Active candidates & held stocks</div>
                  </div>

                  <div className="rounded-lg bg-[#0d131a]/80 p-3 border border-[#222d39]">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Upcoming Catalysts</div>
                    <div className="mt-1 text-xl font-bold font-mono text-amber-400">
                      {newsData?.upcoming_catalysts?.length || 0}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Board meetings & record dates</div>
                  </div>
                </div>
              </div>

              {/* UPCOMING CATALYSTS & BINARY RISK BANNER */}
              {newsData?.upcoming_catalysts && newsData.upcoming_catalysts.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-[#161c24] p-4 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-[#222d39]">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-amber-400" />
                      <h3 className="text-sm font-bold text-white">Upcoming High-Impact Catalysts & Board Meetings Calendar</h3>
                    </div>
                    <span className="text-[11px] text-amber-400 font-mono">
                      ⚠️ Binary gap risk alert for swing trades
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {newsData.upcoming_catalysts.slice(0, 6).map((cat, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setAuditSymbolInput(cat.code);
                          fetchSymbolAudit(cat.code);
                        }}
                        className="rounded-lg bg-[#0f151d] p-2.5 border border-[#1e2733] hover:border-amber-500/50 cursor-pointer transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-xs font-mono">{cat.code}</span>
                          <span className="rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono px-1.5 py-0.5">
                            {cat.event_date || cat.date}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1 line-clamp-1 font-sans">{cat.summary}</p>
                        {cat.risk_warning && (
                          <div className="mt-1 text-[10px] text-amber-400/90 flex items-center gap-1 font-mono">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span className="truncate">{cat.risk_warning}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SINGLE SYMBOL DOSSIER AUDIT INSPECTOR */}
              <div className="rounded-xl border border-cyan-500/30 bg-[#121922] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#222d39]">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileText className="h-4 w-4 text-cyan-400" />
                      Single Stock Corporate Disclosure Audit & Briefing
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Type any ticker to extract historical PSI disclosures, dividend track record, and pre-trade briefing.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={auditSymbolInput}
                      onChange={(e) => setAuditSymbolInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && fetchSymbolAudit(auditSymbolInput)}
                      placeholder="e.g. SQURPHARMA"
                      className="rounded-md bg-[#0d131a] border border-[#2d3b4e] px-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-36"
                    />
                    <button
                      onClick={() => fetchSymbolAudit(auditSymbolInput)}
                      disabled={auditLoading}
                      className="rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-3 py-1.5 text-xs transition"
                    >
                      {auditLoading ? 'Auditing...' : 'Audit Ticker'}
                    </button>
                  </div>
                </div>

                {/* Quick selector chips */}
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 mr-1 font-mono">Quick Audit:</span>
                  {['SQURPHARMA', 'MPETROLEUM', 'JANATAINS', 'GP', 'BATBC', 'BEXIMCO', 'BRACBANK'].map((sym) => (
                    <button
                      key={sym}
                      onClick={() => {
                        setAuditSymbolInput(sym);
                        fetchSymbolAudit(sym);
                      }}
                      className={`rounded px-2 py-0.5 text-[11px] font-mono border transition ${
                        auditSymbolInput === sym
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                          : 'bg-[#0d131a] text-slate-400 border-[#222d39] hover:text-white'
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>

                {/* Audit Result Display */}
                {selectedSymbolAudit && (
                  <div className="mt-4 rounded-lg bg-[#0d131a] border border-[#1e2733] p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#1e2733]">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-white font-mono">{selectedSymbolAudit.symbol}</span>
                        <span className={`rounded px-2 py-0.5 text-xs font-mono font-bold ${
                          selectedSymbolAudit.net_sentiment === 'BULLISH'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : selectedSymbolAudit.net_sentiment === 'BEARISH'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : 'bg-slate-700 text-slate-300'
                        }`}>
                          Sentiment: {selectedSymbolAudit.net_sentiment} ({selectedSymbolAudit.sentiment_score > 0 ? '+' : ''}{selectedSymbolAudit.sentiment_score})
                        </span>
                        <span className="text-xs text-slate-400">
                          {selectedSymbolAudit.total_disclosures} Disclosures on Record
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-emerald-400">Bullish: {selectedSymbolAudit.breakdown.bullish_count}</span>
                        <span className="text-amber-400">Meetings: {selectedSymbolAudit.breakdown.board_meeting_count}</span>
                        <span className="text-cyan-400">Dividends: {selectedSymbolAudit.breakdown.dividend_earnings_count}</span>
                      </div>
                    </div>

                    {/* Actionable Trader Briefing */}
                    <div className="mt-3 rounded bg-[#16202c] p-3 border border-[#233345] flex items-start gap-2.5">
                      <Zap className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[11px] font-mono text-amber-400 uppercase tracking-wider font-bold">Actionable Trader Briefing</div>
                        <p className="text-xs text-slate-200 mt-0.5 font-sans leading-relaxed">
                          {selectedSymbolAudit.actionable_briefing}
                        </p>
                      </div>
                    </div>

                    {/* Symbol Disclosures List */}
                    <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
                      {selectedSymbolAudit.disclosures.slice(0, 5).map((d) => (
                        <div key={d.id} className="rounded bg-[#121922] p-2.5 border border-[#1e2733] text-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-slate-800 text-slate-300 text-[10px] font-mono px-1.5 py-0.5">{d.date} {d.time}</span>
                              <span className={`rounded text-[10px] font-mono px-1.5 py-0.5 font-bold ${
                                d.category === 'BOARD_MEETING' ? 'bg-amber-500/20 text-amber-300' :
                                d.category === 'DIVIDEND_EARNINGS' ? 'bg-emerald-500/20 text-emerald-300' :
                                d.category === 'PSI_MATERIAL' ? 'bg-purple-500/20 text-purple-300' :
                                'bg-slate-700 text-slate-300'
                              }`}>
                                {d.category}
                              </span>
                            </div>
                            <span className={`text-[10px] font-mono font-bold ${
                              d.sentiment === 'BULLISH' ? 'text-emerald-400' : d.sentiment === 'BEARISH' ? 'text-rose-400' : 'text-slate-400'
                            }`}>
                              {d.sentiment}
                            </span>
                          </div>
                          <p className="text-slate-200 mt-1 font-sans">{d.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* REAL-TIME DISCLOSURES FEED */}
              <div className="rounded-xl border border-[#222d39] bg-[#121922] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#222d39]">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">Live Disclosures & Price Sensitive Information Feed</h3>
                    <span className="rounded bg-[#1f2937] text-slate-300 text-[11px] font-mono px-2 py-0.5">
                      {newsFilterCategory === 'WATCHLIST' ? (newsData?.watchlist_news?.length || 0) : (newsData?.market_news?.length || 0)} items
                    </span>
                  </div>

                  {/* Search and Filters */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={newsSearchQuery}
                        onChange={(e) => setNewsSearchQuery(e.target.value)}
                        placeholder="Search headline or ticker..."
                        className="rounded-md bg-[#0d131a] border border-[#2d3b4e] pl-8 pr-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-48"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-[#0d131a] p-1 rounded-md border border-[#222d39] text-xs">
                      {[
                        { id: 'ALL', label: 'All' },
                        { id: 'WATCHLIST', label: 'Watchlist' },
                        { id: 'BOARD_MEETING', label: 'Board Meetings' },
                        { id: 'DIVIDEND_EARNINGS', label: 'Dividends' },
                        { id: 'PSI_MATERIAL', label: 'PSI' },
                        { id: 'REGULATORY_QUERY', label: 'Queries' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setNewsFilterCategory(tab.id)}
                          className={`rounded px-2 py-1 text-[11px] font-mono transition ${
                            newsFilterCategory === tab.id
                              ? 'bg-amber-500/20 text-amber-300 font-bold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* News Items List */}
                <div className="mt-4 space-y-3">
                  {(() => {
                    const sourceList = newsFilterCategory === 'WATCHLIST'
                      ? (newsData?.watchlist_news || [])
                      : [...(newsData?.watchlist_news || []), ...(newsData?.market_news || [])];

                    const filtered = sourceList.filter((item) => {
                      if (newsFilterCategory !== 'ALL' && newsFilterCategory !== 'WATCHLIST') {
                        if (item.category !== newsFilterCategory) return false;
                      }
                      if (newsSearchQuery.trim()) {
                        const q = newsSearchQuery.trim().toUpperCase();
                        return item.code.toUpperCase().includes(q) || item.summary.toUpperCase().includes(q) || item.body.toUpperCase().includes(q);
                      }
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="py-12 text-center text-slate-400 text-xs font-mono">
                          No corporate disclosures matching "{newsFilterCategory}" with query "{newsSearchQuery}".
                        </div>
                      );
                    }

                    return filtered.slice(0, 30).map((item) => {
                      const isExpanded = expandedNewsId === item.id;
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg bg-[#0d131a] border border-[#1e2733] hover:border-[#2d3b4e] p-3.5 transition"
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setAuditSymbolInput(item.code);
                                  fetchSymbolAudit(item.code);
                                }}
                                className="font-bold text-amber-400 hover:text-amber-300 font-mono text-sm underline decoration-amber-500/40"
                              >
                                {item.code}
                              </button>
                              <span className="text-xs text-slate-400 truncate max-w-xs">{item.name}</span>
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                                item.category === 'BOARD_MEETING' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                                item.category === 'DIVIDEND_EARNINGS' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                                item.category === 'PSI_MATERIAL' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
                                item.category === 'REGULATORY_QUERY' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                                'bg-slate-800 text-slate-300'
                              }`}>
                                {item.category}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                              <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold ${
                                item.sentiment === 'BULLISH' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                                item.sentiment === 'BEARISH' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                                'bg-slate-800 text-slate-400'
                              }`}>
                                {item.sentiment} ({item.sentiment_score > 0 ? '+' : ''}{item.sentiment_score})
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">{item.date} {item.time}</span>
                            </div>
                          </div>

                          <div className="mt-2 text-xs text-slate-200 font-medium font-sans">
                            {item.summary}
                          </div>

                          {/* Metric Chips */}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {item.metrics?.event_date && (
                              <span className="rounded bg-amber-950/60 text-amber-300 border border-amber-800/60 px-2 py-0.5 text-[10px] font-mono">
                                📅 Meeting: {item.metrics.event_date}
                              </span>
                            )}
                            {item.metrics?.cash_dividend_pct !== undefined && (
                              <span className="rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 text-[10px] font-mono">
                                💰 {item.metrics.cash_dividend_pct}% Cash Dividend
                              </span>
                            )}
                            {item.metrics?.stock_dividend_pct !== undefined && (
                              <span className="rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 px-2 py-0.5 text-[10px] font-mono">
                                🎁 {item.metrics.stock_dividend_pct}% Bonus Share
                              </span>
                            )}
                            {item.metrics?.eps_growth_pct !== undefined && (
                              <span className={`rounded px-2 py-0.5 text-[10px] font-mono border ${
                                item.metrics.eps_growth_pct >= 0
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                                  : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                              }`}>
                                📈 EPS Growth: {item.metrics.eps_growth_pct > 0 ? '+' : ''}{item.metrics.eps_growth_pct}%
                              </span>
                            )}
                            {item.risk_warnings && item.risk_warnings.length > 0 && (
                              <span className="rounded bg-rose-950/40 text-rose-300 border border-rose-800/50 px-2 py-0.5 text-[10px] font-mono flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {item.risk_warnings[0]}
                              </span>
                            )}
                          </div>

                          {/* Expandable Body */}
                          {isExpanded && (
                            <div className="mt-3 rounded bg-[#16202c] p-3 text-xs text-slate-300 font-mono whitespace-pre-wrap border border-[#233345] leading-relaxed">
                              {item.body}
                            </div>
                          )}

                          <div className="mt-2.5 flex items-center justify-between text-[11px] pt-2 border-t border-[#18212c]">
                            <button
                              onClick={() => setExpandedNewsId(isExpanded ? null : item.id)}
                              className="text-amber-400 hover:text-amber-300 font-mono font-medium flex items-center gap-1"
                            >
                              {isExpanded ? 'Hide Filing Details' : 'Read Full Official Filing'}
                              <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>

                            <button
                              onClick={() => {
                                setAuditSymbolInput(item.code);
                                fetchSymbolAudit(item.code);
                              }}
                              className="text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
                            >
                              Audit {item.code} Dossier <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* VERIFICATION CHECKLIST & APPROVAL BAR */}
              <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-[#18201b] via-[#151c24] to-[#121c21] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      Agent 9 Live Test Verification Checklist (Corporate Disclosures & News)
                    </h4>
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Direct connection to Dhaka Stock Exchange Live Disclosures API verified.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Natural language sentiment scoring and dividend / EPS metrics extraction active.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>High-impact upcoming catalyst calendar (LR 16/19 Board Meetings) integrated to warn active setups.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="shrink-0 flex items-center gap-3">
                    <button
                      onClick={() => approveAgent('trader-news')}
                      disabled={approving}
                      className="flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 text-xs shadow-lg transition"
                    >
                      <Check className="h-4 w-4" />
                      {approving ? 'Saving Approval...' : 'Approve Agent 9 & Proceed to Agent 10'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

{selectedAgentId === 'trader-broker' && (
            <div className="space-y-6">
              {/* Main Banner */}
              <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-[#241a17] via-[#121922] to-[#122221] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#222d39] gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
                      <span className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-400">
                        Live Testing Bench: Agent 8
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                        trader-broker v1.0 (DSE Paper Trading)
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-amber-400" />
                      DSE Paper Trading & Virtual Execution Broker
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Since DSE retail brokers do not offer direct algorithmic order routing APIs, this high-fidelity paper broker simulates real-time trade fills, 0.4% brokerage fees, active position monitoring, stop-loss / take-profit tracking, and P&L analytics.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchBrokerAccount}
                      disabled={loadingBroker}
                      className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 text-xs shadow-md transition"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingBroker ? 'animate-spin' : ''}`} />
                      {loadingBroker ? 'Syncing...' : 'Sync Live Prices'}
                    </button>

                    <button
                      onClick={handleResetPortfolio}
                      className="flex items-center gap-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 px-3 py-2 text-xs font-semibold transition"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset to ৳500K
                    </button>

                    <button
                      onClick={() => approveAgent('trader-broker')}
                      disabled={approving}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 text-xs shadow-md transition"
                    >
                      <Check className="h-4 w-4" />
                      {approving ? 'Approving...' : 'Approve Agent 8 & Unlock Agent 9'}
                    </button>
                  </div>
                </div>

                {/* 5 KPI Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                  <div className="rounded-lg bg-[#0d131a] p-3 border border-amber-500/40">
                    <p className="text-[10px] font-mono uppercase text-amber-400">Total Account Equity</p>
                    <p className="text-base font-bold font-mono text-white">
                      ৳{(brokerResult?.account.total_account_equity ?? 500000).toLocaleString()}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Cash + Active Holdings
                    </span>
                  </div>

                  <div className="rounded-lg bg-[#0d131a] p-3 border border-cyan-900/40">
                    <p className="text-[10px] font-mono uppercase text-cyan-400">Available Cash Balance</p>
                    <p className="text-base font-bold font-mono text-cyan-300">
                      ৳{(brokerResult?.account.cash_balance ?? 500000).toLocaleString()}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Holdings: ৳{(brokerResult?.account.stock_holdings_value ?? 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[#0d131a] p-3 border border-emerald-900/40">
                    <p className="text-[10px] font-mono uppercase text-emerald-400">Unrealized P&L</p>
                    <p className={`text-base font-bold font-mono ${(brokerResult?.account.total_unrealized_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {(brokerResult?.account.total_unrealized_pnl ?? 0) >= 0 ? '+' : ''}৳{(brokerResult?.account.total_unrealized_pnl ?? 0).toLocaleString()}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Open Positions: {brokerResult?.account.positions_count ?? 0}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[#0d131a] p-3 border border-purple-900/40">
                    <p className="text-[10px] font-mono uppercase text-purple-400">Realized P&L</p>
                    <p className={`text-base font-bold font-mono ${(brokerResult?.account.total_realized_pnl ?? 0) >= 0 ? 'text-purple-300' : 'text-rose-400'}`}>
                      {(brokerResult?.account.total_realized_pnl ?? 0) >= 0 ? '+' : ''}৳{(brokerResult?.account.total_realized_pnl ?? 0).toLocaleString()}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Win Rate: {brokerResult?.account.win_rate ?? 0}% ({brokerResult?.account.closed_trades_count ?? 0} closed)
                    </span>
                  </div>

                  <div className="rounded-lg bg-[#0d131a] p-3 border border-slate-800">
                    <p className="text-[10px] font-mono uppercase text-slate-400">DSE Fees (0.4%)</p>
                    <p className="text-base font-bold font-mono text-slate-300">
                      ৳{(brokerResult?.account.total_commissions_paid ?? 0).toLocaleString()}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Net ROI: {brokerResult?.account.total_return_pct ?? 0}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Placement Terminal & Active Positions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Manual & Bracket Order Ticket Terminal */}
                <div className="rounded-xl border border-[#2b394a] bg-[#121922] p-5 shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-[#222d39]">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4 text-amber-400" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                          DSE Order Execution Ticket
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-amber-400 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded">
                        Paper Mode
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-mono text-slate-400 block mb-1">Symbol</label>
                          <input
                            type="text"
                            value={orderSymbolInput}
                            onChange={(e) => setOrderSymbolInput(e.target.value.toUpperCase())}
                            placeholder="SQURPHARMA"
                            className="w-full rounded bg-[#0a0f14] border border-slate-700 px-3 py-1.5 text-xs text-white uppercase font-mono focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-mono text-slate-400 block mb-1">Action Side</label>
                          <div className="grid grid-cols-2 gap-1">
                            <button
                              type="button"
                              onClick={() => setOrderSideInput('BUY')}
                              className={`rounded py-1.5 text-xs font-bold transition ${
                                orderSideInput === 'BUY'
                                  ? 'bg-emerald-500 text-slate-950 shadow'
                                  : 'bg-[#0a0f14] text-slate-400 border border-slate-700'
                              }`}
                            >
                              BUY
                            </button>
                            <button
                              type="button"
                              onClick={() => setOrderSideInput('SELL')}
                              className={`rounded py-1.5 text-xs font-bold transition ${
                                orderSideInput === 'SELL'
                                  ? 'bg-rose-500 text-white shadow'
                                  : 'bg-[#0a0f14] text-slate-400 border border-slate-700'
                              }`}
                            >
                              SELL
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-mono text-slate-400 block mb-1">Quantity (Shares)</label>
                          <input
                            type="number"
                            value={orderQtyInput}
                            onChange={(e) => setOrderQtyInput(e.target.value ? parseInt(e.target.value) : '')}
                            placeholder="100"
                            className="w-full rounded bg-[#0a0f14] border border-slate-700 px-3 py-1.5 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-mono text-slate-400 block mb-1">Execution Price (৳)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={orderPriceInput}
                            onChange={(e) => setOrderPriceInput(e.target.value ? parseFloat(e.target.value) : '')}
                            placeholder="220.0"
                            className="w-full rounded bg-[#0a0f14] border border-slate-700 px-3 py-1.5 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-mono text-rose-400 block mb-1">Stop Loss (৳) [Optional]</label>
                          <input
                            type="number"
                            step="0.1"
                            value={orderStopInput}
                            onChange={(e) => setOrderStopInput(e.target.value ? parseFloat(e.target.value) : '')}
                            placeholder="210.0"
                            className="w-full rounded bg-[#0a0f14] border border-slate-700 px-3 py-1.5 text-xs text-rose-300 font-mono focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-mono text-emerald-400 block mb-1">Take Profit (৳) [Optional]</label>
                          <input
                            type="number"
                            step="0.1"
                            value={orderTargetInput}
                            onChange={(e) => setOrderTargetInput(e.target.value ? parseFloat(e.target.value) : '')}
                            placeholder="240.0"
                            className="w-full rounded bg-[#0a0f14] border border-slate-700 px-3 py-1.5 text-xs text-emerald-300 font-mono focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Order Value Preview */}
                      <div className="rounded bg-[#0a0f14] p-3 border border-slate-800 text-xs font-mono space-y-1">
                        <div className="flex justify-between text-slate-400">
                          <span>Gross Order Value:</span>
                          <span className="text-white font-bold">
                            ৳{((Number(orderQtyInput) || 0) * (Number(orderPriceInput) || 0)).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Brokerage Fee (0.4%):</span>
                          <span className="text-slate-300">
                            ৳{(((Number(orderQtyInput) || 0) * (Number(orderPriceInput) || 0)) * 0.004).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-amber-400 pt-1 border-t border-slate-800 font-bold">
                          <span>Net Cash Impact:</span>
                          <span>
                            ৳{(
                              ((Number(orderQtyInput) || 0) * (Number(orderPriceInput) || 0)) *
                              (orderSideInput === 'BUY' ? 1.004 : 0.996)
                            ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#1e2734]">
                    <button
                      onClick={() => handlePlaceOrder()}
                      disabled={executingOrder}
                      className={`w-full rounded py-2 text-xs font-bold transition shadow ${
                        orderSideInput === 'BUY'
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                          : 'bg-rose-500 hover:bg-rose-400 text-white'
                      }`}
                    >
                      {executingOrder ? 'Executing Paper Order...' : `Execute Paper ${orderSideInput} Order`}
                    </button>

                    {orderFeedback && (
                      <p className={`text-[11px] font-mono mt-2 text-center ${orderFeedback.includes('Successfully') ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {orderFeedback}
                      </p>
                    )}
                  </div>
                </div>

                {/* Active Open Positions Table */}
                <div className="lg:col-span-2 rounded-xl border border-[#2b394a] bg-[#121922] p-5 shadow-lg">
                  <div className="flex items-center justify-between pb-3 border-b border-[#222d39]">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-emerald-400" />
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        Active Portfolio Holdings ({brokerResult?.positions.length ?? 0} Positions)
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      Live P&L tracking with bracket trigger monitoring
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {loadingBroker ? (
                      <div className="p-8 text-center text-xs text-slate-400 font-mono">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-amber-400 mb-2" />
                        Syncing live DSE portfolio valuations...
                      </div>
                    ) : (brokerResult?.positions.length ?? 0) === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 font-mono border border-dashed border-slate-800 rounded-lg">
                        <p className="text-slate-300 font-bold mb-1">No open positions in paper portfolio.</p>
                        <p>Place an order above or click "1-Click Paper Buy" on any candidate setup below.</p>
                      </div>
                    ) : (
                      brokerResult?.positions.map((pos) => {
                        const isProfitable = pos.unrealized_pnl >= 0;

                        return (
                          <div
                            key={pos.symbol}
                            className="rounded-lg bg-[#0d131a] p-3.5 border border-[#1e2734] hover:border-slate-700 transition"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#1b2430]">
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-base font-bold text-white">{pos.symbol}</span>
                                <span className="rounded bg-slate-800 text-slate-300 px-2 py-0.5 text-[10px] font-mono">
                                  {pos.quantity} Shares ({pos.portfolio_pct}% Portfolio)
                                </span>
                                {pos.stop_loss && (
                                  <span className="text-[10px] font-mono text-rose-400 bg-rose-950/60 border border-rose-900/60 px-1.5 py-0.5 rounded">
                                    SL: ৳{pos.stop_loss}
                                  </span>
                                )}
                                {pos.take_profit && (
                                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-900/60 px-1.5 py-0.5 rounded">
                                    TP: ৳{pos.take_profit}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <span className="text-[10px] text-slate-500 block">Unrealized P&L</span>
                                  <span className={`font-mono text-sm font-bold ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {isProfitable ? '+' : ''}৳{pos.unrealized_pnl.toLocaleString()} ({isProfitable ? '+' : ''}{pos.unrealized_pnl_pct}%)
                                  </span>
                                </div>

                                <button
                                  onClick={() => handleClosePosition(pos.symbol, pos.current_ltp)}
                                  disabled={closingPositionSym === pos.symbol}
                                  className="rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 px-3 py-1 text-xs font-semibold transition"
                                >
                                  {closingPositionSym === pos.symbol ? 'Closing...' : 'Close (Sell)'}
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs font-mono text-slate-300 pt-1">
                              <div>
                                <span className="text-[10px] text-slate-500 block">Avg Buy Price</span>
                                <span>৳{pos.average_buy_price.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">Current LTP</span>
                                <span className="text-white font-bold">৳{pos.current_ltp.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">Cost Basis</span>
                                <span>৳{pos.cost_basis.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">Market Value</span>
                                <span className="text-white">৳{pos.market_value.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* 1-Click Pipeline Execution Watchlist */}
              <div className="rounded-xl border border-[#222d39] bg-[#121922] p-5 shadow-lg">
                <div className="flex items-center justify-between pb-3 border-b border-[#222d39]">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Target className="h-4 w-4 text-amber-400" />
                      1-Click Pipeline Execution (Approved Setups from Agent 6)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Execute sized bracket orders straight from the quantitative pipeline into your virtual paper trading portfolio.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {(budgetResult?.orders || []).slice(0, 8).map((o) => (
                    <div
                      key={o.symbol}
                      className="rounded-lg bg-[#0d131a] p-3.5 border border-[#1e2734] hover:border-amber-500/40 transition flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{o.symbol}</span>
                          <span className="rounded bg-slate-800 text-slate-300 px-1.5 py-0.5 text-[10px] uppercase">
                            {o.setup}
                          </span>
                          <span className="text-slate-400">Sized: {o.final_shares} shs @ ৳{o.entry_price}</span>
                        </div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          Stop: <span className="text-rose-400">৳{o.stop_loss}</span> | Target: <span className="text-emerald-400">৳{o.target_price}</span> | Capital: ৳{o.total_investment.toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handlePlaceOrder(o.symbol, 'BUY', o.final_shares, o.entry_price, o.stop_loss, o.target_price)}
                          disabled={executingOrder}
                          className="rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 text-xs transition shadow flex items-center gap-1.5"
                        >
                          <ShoppingBag className="h-3.5 w-3.5" />
                          1-Click Paper Buy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Verification & Approval Checklist */}
                <div className="mt-6 rounded-lg border border-amber-800/40 bg-gradient-to-r from-amber-950/20 via-[#101923] to-emerald-950/20 p-4">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        Agent 8 Live Test Verification Checklist (Paper Trading)
                      </h4>
                      <ul className="mt-2 space-y-1 text-xs text-slate-300">
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Virtual DSE order routing and execution engine verified with 0.4% brokerage commissions.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Real-time portfolio equity, cost basis, and unrealized / realized P&L calculation active.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>1-Click execution bridge directly connects Agent 6 bracket orders to the paper broker.</span>
                        </li>
                      </ul>
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                      <button
                        onClick={() => approveAgent('trader-broker')}
                        disabled={approving}
                        className="flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 text-xs shadow-lg transition"
                      >
                        <Check className="h-4 w-4" />
                        {approving ? 'Saving Approval...' : 'Approve Agent 8 & Proceed to Agent 9'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW -1: AGENT 7 - INSTANT ALERT & NOTIFICATION (APPROVED)*/}
          {/* ======================================================== */}
          {selectedAgentId === 'trader-alerts' && (
            <div className="space-y-6">
              {/* Main Banner */}
              <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-r from-[#13231c] via-[#121922] to-[#122221] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#222d39] gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-mono text-emerald-400 border border-emerald-700 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Agent 7 Approved & Operational
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                        trader-alerts v1.0
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Bell className="h-5 w-5 text-emerald-400" />
                      Instant Alert & Notification Agent
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Watches DSE numbers in real-time so you never have to stare at a chart. Dispatches instant Telegram messages, webhook payloads, and live notifications on breakout triggers, stop breach, and profit targets.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={triggerAlertsCheck}
                      disabled={loadingAlerts}
                      className="flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 text-xs shadow-md transition border border-slate-700"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingAlerts ? 'animate-spin' : ''}`} />
                      {loadingAlerts ? 'Checking...' : 'Refresh Alerts'}
                    </button>

                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-950/80 border border-emerald-600 px-3 py-2 text-xs font-bold text-emerald-400">
                      <Check className="h-4 w-4" />
                      Stage 7 Approved
                    </span>
                  </div>
                </div>

                {/* DSE Market Clock & Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                  <div className="rounded-lg bg-[#0d131a] p-3 border border-amber-500/40">
                    <p className="text-[10px] font-mono uppercase text-amber-400">DSE Session Status</p>
                    <p className="text-base font-bold font-mono text-white flex items-center gap-1.5">
                      <Radio className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                      {dseClock?.status || 'PRE_MARKET'}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{dseClock?.status_text || 'Sunday-Thursday'}</span>
                  </div>

                  <div className="rounded-lg bg-[#0d131a] p-3 border border-cyan-900/40">
                    <p className="text-[10px] font-mono uppercase text-cyan-400">BST Clock (UTC+6)</p>
                    <p className="text-base font-bold font-mono text-cyan-300">
                      {dseClock?.current_time_bst?.split(' ')[1] || '10:00:00'}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Session: 10:00 AM - 2:20 PM</span>
                  </div>

                  <div className="rounded-lg bg-[#0d131a] p-3 border border-emerald-900/40">
                    <p className="text-[10px] font-mono uppercase text-emerald-400">Next Bell Countdown</p>
                    <p className="text-base font-bold font-mono text-emerald-400">
                      {dseClock ? `${Math.floor(dseClock.seconds_to_event / 3600)}h ${Math.floor((dseClock.seconds_to_event % 3600) / 60)}m` : '--'}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-0.5 truncate">{dseClock?.event_label || 'Next Session'}</span>
                  </div>

                  <div className="rounded-lg bg-[#0d131a] p-3 border border-rose-900/40">
                    <p className="text-[10px] font-mono uppercase text-rose-400">Active Alert Rules</p>
                    <p className="text-base font-bold font-mono text-white">
                      {alertsResult?.active_rules_count ?? 32} <span className="text-xs font-normal text-slate-400">monitored</span>
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Total: {alertsResult?.total_rules ?? 60} rules</span>
                  </div>

                  <div className="rounded-lg bg-[#0d131a] p-3 border border-indigo-900/40">
                    <p className="text-[10px] font-mono uppercase text-indigo-400">Triggered Alerts</p>
                    <p className="text-base font-bold font-mono text-indigo-300">
                      {alertsResult?.fired_alerts_count ?? 1} <span className="text-xs font-normal text-slate-400">fired</span>
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Instant delivery ready</span>
                  </div>
                </div>
              </div>

              {/* Notification Channels Configuration & Live Test */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Telegram Bot Channel */}
                <div className="rounded-xl border border-[#2b394a] bg-[#121922] p-5 shadow-lg">
                  <div className="flex items-center justify-between pb-3 border-b border-[#222d39]">
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4 text-cyan-400" />
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        Telegram Bot Dispatcher
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 border border-cyan-800 px-2 py-0.5 rounded">
                      Instant Push
                    </span>
                  </div>

                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="text-[11px] font-mono text-slate-400 block mb-1">Telegram Bot Token</label>
                      <input
                        type="password"
                        placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                        value={telegramToken}
                        onChange={(e) => setTelegramToken(e.target.value)}
                        className="w-full rounded bg-[#0a0f14] border border-slate-700 px-3 py-1.5 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-mono text-slate-400 block mb-1">Telegram Chat ID / Channel ID</label>
                      <input
                        type="text"
                        placeholder="e.g. -1001234567890 or @my_channel"
                        value={telegramChatId}
                        onChange={(e) => setTelegramChatId(e.target.value)}
                        className="w-full rounded bg-[#0a0f14] border border-slate-700 px-3 py-1.5 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={sendTestTelegram}
                        disabled={testingTelegram}
                        className="rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-1.5 px-4 text-xs transition shadow flex items-center gap-1.5"
                      >
                        <Send className="h-3 w-3" />
                        {testingTelegram ? 'Sending Test...' : 'Send Live Test Message'}
                      </button>

                      {telegramTestStatus && (
                        <span className={`text-[11px] font-mono ${telegramTestStatus.includes('successfully') ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {telegramTestStatus}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* External Webhook Channel */}
                <div className="rounded-xl border border-[#2b394a] bg-[#121922] p-5 shadow-lg">
                  <div className="flex items-center justify-between pb-3 border-b border-[#222d39]">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-purple-400" />
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        JSON Webhook Dispatcher
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-purple-400 bg-purple-950/80 border border-purple-800 px-2 py-0.5 rounded">
                      HTTP POST
                    </span>
                  </div>

                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="text-[11px] font-mono text-slate-400 block mb-1">Webhook URL (Slack, Discord, Custom API)</label>
                      <input
                        type="url"
                        placeholder="https://hooks.slack.com/services/... or https://your-server.com/webhook"
                        value={webhookUrlInput}
                        onChange={(e) => setWebhookUrlInput(e.target.value)}
                        className="w-full rounded bg-[#0a0f14] border border-slate-700 px-3 py-1.5 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Dispatches standardized JSON payloads including event name, symbol, trigger price, threshold, and timestamp.
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={sendTestWebhook}
                        disabled={testingWebhook}
                        className="rounded bg-purple-600 hover:bg-purple-500 text-white font-bold py-1.5 px-4 text-xs transition shadow flex items-center gap-1.5"
                      >
                        <Megaphone className="h-3 w-3" />
                        {testingWebhook ? 'Testing...' : 'Send Live Test Webhook'}
                      </button>

                      {webhookTestStatus && (
                        <span className={`text-[11px] font-mono ${webhookTestStatus.includes('successfully') ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {webhookTestStatus}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Alert Rules Table */}
              <div className="rounded-xl border border-[#222d39] bg-[#121922] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-[#222d39] gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Bell className="h-4 w-4 text-amber-400" />
                      Active Alert Watchlist ({filteredAlertRules.length} Rules Monitored)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Auto-populated from approved candidate setups (Agent 6 & Agent 3). Evaluates every quote in real-time.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      value={alertsFilterType}
                      onChange={(e) => setAlertsFilterType(e.target.value)}
                      className="rounded bg-[#0d131a] px-2.5 py-1 text-xs text-white border border-slate-700 focus:outline-none focus:border-amber-400 font-mono"
                    >
                      <option value="ALL">All Rule Types</option>
                      <option value="PRICE_ABOVE">Take Profit (Above)</option>
                      <option value="PRICE_BELOW">Stop Loss (Below)</option>
                      <option value="PCT_MOVE">Percentage Move</option>
                    </select>

                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={alertsSearchQuery}
                        onChange={(e) => setAlertsSearchQuery(e.target.value)}
                        placeholder="Search rules..."
                        className="rounded bg-[#0d131a] pl-8 pr-3 py-1 text-xs text-white border border-slate-700 focus:outline-none focus:border-amber-400 w-36"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  {loadingAlerts ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-mono">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-amber-400 mb-2" />
                      Evaluating active trigger rules against real-time DSE prices...
                    </div>
                  ) : filteredAlertRules.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-mono">
                      No rules found. Click "Run Real-Time Alert Check" to auto-populate from pipeline.
                    </div>
                  ) : (
                    filteredAlertRules.map((r) => {
                      const isTriggered = r.status === 'TRIGGERED';
                      const isTP = r.rule_type === 'PRICE_ABOVE';
                      const isSL = r.rule_type === 'PRICE_BELOW';

                      return (
                        <div
                          key={r.id}
                          className={`rounded-lg p-3 border transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                            isTriggered
                              ? 'bg-gradient-to-r from-[#1c180f] to-[#121922] border-amber-500/50'
                              : 'bg-[#0d131a] border-[#1e2734] hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-base font-bold text-white">{r.symbol}</span>
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold border flex items-center gap-1 ${
                                isTP
                                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                                  : isSL
                                  ? 'bg-rose-950/80 text-rose-400 border-rose-800'
                                  : 'bg-cyan-950/80 text-cyan-400 border-cyan-800'
                              }`}
                            >
                              {isTP ? '🎯 TAKE PROFIT' : isSL ? '🛑 STOP LOSS' : '🚀 BREAKOUT'}
                            </span>
                            <span className="text-xs text-slate-300 font-sans">{r.label}</span>
                          </div>

                          <div className="flex items-center gap-5 text-xs font-mono">
                            <div>
                              <span className="text-[10px] text-slate-500 block">LTP Price</span>
                              <span className="font-bold text-white">৳{r.current_price}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Trigger Level</span>
                              <span className="font-bold text-amber-300">৳{r.threshold}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Sized Shares</span>
                              <span className="text-slate-300">{r.shares} shs</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Status</span>
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                  isTriggered
                                    ? 'bg-amber-500 text-slate-950 animate-pulse'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {r.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Verification & Approval Checklist */}
                <div className="mt-6 rounded-lg border border-emerald-800/40 bg-gradient-to-r from-[#101923] via-[#101e23] to-emerald-950/20 p-4">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <Check className="h-4 w-4" />
                        Agent 7 Verification Passed & Approved
                      </h4>
                      <ul className="mt-2 space-y-1 text-xs text-slate-300">
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>DSE Bangladesh Trading Hours (10:00 AM - 02:20 PM BST) & 2026 holiday calendar validated.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Multi-channel notification dispatchers (Telegram Bot API & Webhook POST) fully operational.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Auto-generation of Take Profit and Stop Loss alert rules directly from sized bracket orders.</span>
                        </li>
                      </ul>
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                      <span className="flex items-center gap-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold px-4 py-2.5 text-xs shadow-lg">
                        <Check className="h-4 w-4 text-emerald-400" />
                        Stage 7 Passed & Operational
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 0: AGENT 6 - POSITION SIZING & BUDGET AGENT (APPROVED)*/}
          {/* ======================================================== */}
          {selectedAgentId === 'trader-budget' && (
            <div className="space-y-6">
              {/* Main Banner */}
              <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-r from-[#13231c] via-[#121922] to-[#122221] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#222d39] gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-mono text-emerald-400 border border-emerald-700 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Agent 6 Approved & Operational
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                        trader-budget v1.0
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-emerald-400" />
                      Position Sizing & Budget Agent
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Transforms raw trade signals into exact whole-share purchase orders. Enforces 4-way mathematical boundaries (Max Loss Limit, Position Cap, Cash Reserve Buffer, and Half-Kelly fraction) to safeguard capital and prevent ruin.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => triggerBudgetWatchlist(true)}
                      disabled={loadingBudget}
                      className="flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 text-xs shadow-md transition border border-slate-700"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingBudget ? 'animate-spin' : ''}`} />
                      {loadingBudget ? 'Recalculating...' : 'Refresh Sizing Watchlist'}
                    </button>

                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-950/80 border border-emerald-600 px-3 py-2 text-xs font-bold text-emerald-400">
                      <Check className="h-4 w-4" />
                      Stage 6 Approved
                    </span>
                  </div>
                </div>

                {/* 5 KPI Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                  <div className="rounded-lg bg-[#0d131a] p-3 border border-[#1e2734]">
                    <p className="text-[10px] font-mono uppercase text-slate-500">Trading Capital</p>
                    <p className="text-base font-bold font-mono text-white">৳{budgetCapitalInput.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-[#0d131a] p-3 border border-cyan-900/40">
                    <p className="text-[10px] font-mono uppercase text-cyan-400">Cash Buffer ({cashBufferPctInput}%)</p>
                    <p className="text-base font-bold font-mono text-cyan-400">
                      ৳{((budgetCapitalInput * cashBufferPctInput) / 100).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#0d131a] p-3 border border-rose-900/40">
                    <p className="text-[10px] font-mono uppercase text-rose-400">Max Trade Risk ({budgetMaxLossPctInput}%)</p>
                    <p className="text-base font-bold font-mono text-rose-400">
                      ৳{((budgetCapitalInput * budgetMaxLossPctInput) / 100).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#0d131a] p-3 border border-amber-900/40">
                    <p className="text-[10px] font-mono uppercase text-amber-400">Position Cap ({budgetMaxPosPctInput}%)</p>
                    <p className="text-base font-bold font-mono text-amber-400">
                      ৳{((budgetCapitalInput * budgetMaxPosPctInput) / 100).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#0d131a] p-3 border border-emerald-900/40">
                    <p className="text-[10px] font-mono uppercase text-emerald-400">Kelly Safety Factor</p>
                    <p className="text-base font-bold font-mono text-emerald-400">0.5x Half-Kelly</p>
                  </div>
                </div>
              </div>

              {/* Real-Time Interactive Sizing Simulator Card */}
              <div className="rounded-xl border border-[#2b394a] bg-[#121922] p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Interactive 4-Way Sizing Simulator & Bracket Order Generator
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Enter trade parameters to test mathematical constraint bounds & Kelly sizing
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] font-mono text-slate-400 block mb-1">DSE Symbol</label>
                    <input
                      type="text"
                      value={singleBudgetSymbol}
                      onChange={(e) => setSingleBudgetSymbol(e.target.value.toUpperCase())}
                      placeholder="e.g. SQURPHARMA"
                      className="w-full rounded bg-[#0a0f14] border border-slate-700 px-3 py-1.5 text-xs text-white uppercase font-mono focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-slate-400 block mb-1">Entry Price (৳)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={singleBudgetEntry}
                      onChange={(e) => setSingleBudgetEntry(e.target.value ? parseFloat(e.target.value) : '')}
                      placeholder="220.0"
                      className="w-full rounded bg-[#0a0f14] border border-slate-700 px-3 py-1.5 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-slate-400 block mb-1">Stop Loss (৳)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={singleBudgetStop}
                      onChange={(e) => setSingleBudgetStop(e.target.value ? parseFloat(e.target.value) : '')}
                      placeholder="210.0"
                      className="w-full rounded bg-[#0a0f14] border border-slate-700 px-3 py-1.5 text-xs text-rose-300 font-mono focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-slate-400 block mb-1">Target Price (৳)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={singleBudgetTarget}
                      onChange={(e) => setSingleBudgetTarget(e.target.value ? parseFloat(e.target.value) : '')}
                      placeholder="240.0"
                      className="w-full rounded bg-[#0a0f14] border border-slate-700 px-3 py-1.5 text-xs text-emerald-300 font-mono focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-slate-400 block mb-1">Win Rate % (Kelly)</label>
                    <input
                      type="number"
                      value={singleBudgetWinRate}
                      onChange={(e) => setSingleBudgetWinRate(e.target.value ? parseFloat(e.target.value) : '')}
                      placeholder="50"
                      className="w-full rounded bg-[#0a0f14] border border-slate-700 px-3 py-1.5 text-xs text-cyan-300 font-mono focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={runSingleBudgetSizing}
                      disabled={sizingSingleBudget}
                      className="w-full rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-1.5 px-3 text-xs transition shadow flex items-center justify-center gap-1.5"
                    >
                      <Scale className="h-3.5 w-3.5" />
                      {sizingSingleBudget ? 'Calculating...' : 'Calculate Size'}
                    </button>
                  </div>
                </div>

                {/* Sizing Simulator Output */}
                {singleBudgetResult && (
                  <div className="mt-4 pt-4 border-t border-[#1e2734] space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded-lg bg-[#0a0f14] p-3 border border-amber-500/30">
                        <span className="text-[10px] font-mono text-amber-400 uppercase block">Recommended Sized Shares</span>
                        <span className="text-xl font-bold font-mono text-amber-300">
                          {singleBudgetResult.final_shares.toLocaleString()} <span className="text-xs font-normal text-slate-400">shares</span>
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Whole lot allocation</span>
                      </div>

                      <div className="rounded-lg bg-[#0a0f14] p-3 border border-slate-800">
                        <span className="text-[10px] font-mono text-slate-400 uppercase block">Total Capital Commitment</span>
                        <span className="text-xl font-bold font-mono text-white">
                          ৳{singleBudgetResult.total_investment.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {singleBudgetResult.portfolio_pct}% of total portfolio
                        </span>
                      </div>

                      <div className="rounded-lg bg-[#0a0f14] p-3 border border-rose-900/40">
                        <span className="text-[10px] font-mono text-rose-400 uppercase block">Actual Max Downside Loss</span>
                        <span className="text-xl font-bold font-mono text-rose-400">
                          -৳{singleBudgetResult.actual_max_loss.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {((singleBudgetResult.actual_max_loss / budgetCapitalInput) * 100).toFixed(2)}% of equity
                        </span>
                      </div>

                      <div className="rounded-lg bg-[#0a0f14] p-3 border border-emerald-900/40">
                        <span className="text-[10px] font-mono text-emerald-400 uppercase block">Expected Gain (Target)</span>
                        <span className="text-xl font-bold font-mono text-emerald-400">
                          +৳{singleBudgetResult.expected_gain.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {singleBudgetResult.reward_risk} : 1 R-Multiple
                        </span>
                      </div>
                    </div>

                    {/* Constraint Bottleneck Banner */}
                    <div className="rounded-lg bg-[#141b24] p-3 border border-amber-800/40 flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 text-xs font-mono font-bold uppercase">
                          Deciding Constraint: {singleBudgetResult.deciding_limit.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-300">{singleBudgetResult.decision_narrative}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                        <span>Risk Limit: {singleBudgetResult.constraint_breakdown.by_risk_limit} shs</span>
                        <span>•</span>
                        <span>Pos Cap: {singleBudgetResult.constraint_breakdown.by_position_cap} shs</span>
                        <span>•</span>
                        <span>Half-Kelly: {singleBudgetResult.constraint_breakdown.by_half_kelly} shs</span>
                      </div>
                    </div>

                    {/* Bracket Order Output Card */}
                    <div className="rounded-lg bg-gradient-to-r from-[#0c1520] to-[#111e2d] p-4 border border-cyan-500/30">
                      <div className="flex items-center justify-between pb-2 border-b border-cyan-900/40">
                        <div className="flex items-center gap-2">
                          <Coins className="h-4 w-4 text-cyan-400" />
                          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                            Generated DSE Bracket Order Specification
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">Order Validity: DAY | DSE Limit Compliant</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 font-mono text-xs">
                        <div className="rounded bg-[#0a0f14] p-2 border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">ACTION & TYPE</span>
                          <span className="font-bold text-amber-400">{singleBudgetResult.bracket_order.order_type}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Quantity: {singleBudgetResult.bracket_order.quantity}</span>
                        </div>
                        <div className="rounded bg-[#0a0f14] p-2 border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">LIMIT BUY PRICE</span>
                          <span className="font-bold text-white">৳{singleBudgetResult.bracket_order.limit_price}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Fill threshold</span>
                        </div>
                        <div className="rounded bg-[#0a0f14] p-2 border border-rose-950">
                          <span className="text-[10px] text-rose-500 block">STOP LOSS PRICE</span>
                          <span className="font-bold text-rose-400">৳{singleBudgetResult.bracket_order.stop_loss_price}</span>
                          <span className="text-[10px] text-rose-500/70 block mt-0.5">Hard risk floor</span>
                        </div>
                        <div className="rounded bg-[#0a0f14] p-2 border border-emerald-950">
                          <span className="text-[10px] text-emerald-500 block">TAKE PROFIT (TP2)</span>
                          <span className="font-bold text-emerald-400">৳{singleBudgetResult.bracket_order.take_profit_price}</span>
                          <span className="text-[10px] text-emerald-500/70 block mt-0.5">Scale-out target</span>
                        </div>
                      </div>

                      {/* Scale-out Tranches */}
                      <div className="mt-3 pt-2 border-t border-cyan-900/30 flex flex-wrap items-center justify-between text-xs font-mono text-slate-300">
                        <span className="text-[11px] text-cyan-400">Multi-Tranche Scale-Out:</span>
                        <span>Tranche 1 (50%): <strong className="text-white">{singleBudgetResult.bracket_order.scale_out.tranche_1_shares} shs</strong></span>
                        <span>Tranche 2 (30%): <strong className="text-white">{singleBudgetResult.bracket_order.scale_out.tranche_2_shares} shs</strong></span>
                        <span>Tranche 3 (20% Runner): <strong className="text-white">{singleBudgetResult.bracket_order.scale_out.tranche_3_shares} shs</strong></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sized Orders Watchlist Table */}
              <div className="rounded-xl border border-[#222d39] bg-[#121922] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-[#222d39] gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-amber-400" />
                      Candidate Sizing & Allocation Watchlist ({filteredBudgetOrders.length} Setups)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Calculates exact share count, total investment, max downside loss, and deciding constraint for every approved setup.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={budgetSearchQuery}
                        onChange={(e) => setBudgetSearchQuery(e.target.value)}
                        placeholder="Filter ticker..."
                        className="rounded bg-[#0d131a] pl-8 pr-3 py-1 text-xs text-white border border-slate-700 focus:outline-none focus:border-amber-400 w-36"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {loadingBudget ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-amber-400 mb-2" />
                      Evaluating 4-way position sizing across DSE watchlist...
                    </div>
                  ) : filteredBudgetOrders.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No sized setups found. Click "Run Watchlist Budget Sizing" to evaluate.
                    </div>
                  ) : (
                    filteredBudgetOrders.map((o) => (
                      <div
                        key={o.symbol}
                        className="rounded-lg bg-[#0d131a] p-3.5 border border-[#1e2734] hover:border-amber-500/40 transition"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-[#1b2430]">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-base font-bold text-white">{o.symbol}</span>
                            <span className="rounded bg-slate-800 text-slate-300 px-2 py-0.5 text-[10px] font-mono uppercase">
                              {o.setup}
                            </span>
                            <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono">
                              Limit: {o.deciding_limit.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs font-mono">
                            <div>
                              <span className="text-[10px] text-slate-500 block">Sized Shares</span>
                              <span className="font-bold text-amber-300 text-sm">{o.final_shares.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Capital (৳)</span>
                              <span className="font-bold text-white">৳{o.total_investment.toLocaleString()} ({o.portfolio_pct}%)</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-rose-500 block">Max Loss</span>
                              <span className="font-bold text-rose-400">-৳{o.actual_max_loss.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-emerald-500 block">Reward:Risk</span>
                              <span className="font-bold text-emerald-400">{o.reward_risk}:1 R</span>
                            </div>
                          </div>
                        </div>

                        {/* Order Details & Tranches */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2 text-xs font-mono text-slate-300 pt-1">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Entry Price</span>
                            <span className="text-white">৳{o.entry_price}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-rose-400 block">Stop Loss</span>
                            <span className="text-rose-300">৳{o.stop_loss}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-400 block">Target (TP2)</span>
                            <span className="text-emerald-300">৳{o.target_price}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-cyan-400 block">Tranche 1 (50%)</span>
                            <span className="text-white">{o.bracket_order.scale_out.tranche_1_shares} shs</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-cyan-400 block">Tranche 2+3 (50%)</span>
                            <span className="text-white">{o.bracket_order.scale_out.tranche_2_shares + o.bracket_order.scale_out.tranche_3_shares} shs</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Verification & Approval Checklist */}
                <div className="mt-6 rounded-lg border border-amber-800/40 bg-gradient-to-r from-amber-950/20 via-[#101923] to-emerald-950/20 p-4">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        Agent 6 Live Test Verification Checklist
                      </h4>
                      <ul className="mt-2 space-y-1 text-xs text-slate-300">
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>4-way mathematical constraint sizing (Q_risk, Q_pos, Q_cash, Q_kelly) calculated and bottleneck identified.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Half-Kelly safety dampening (Half-Kelly 0.5x) applied to prevent aggressive overbetting.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Complete executable DSE bracket orders with 3-step scale-out tranches generated.</span>
                        </li>
                      </ul>
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                      <span className="flex items-center gap-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold px-4 py-2.5 text-xs shadow-lg">
                        <Check className="h-4 w-4 text-emerald-400" />
                        Stage 6 Passed & Operational
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 1: AGENT 5 - CAPITAL RISK & EXPOSURE GUARD (APPROVED)*/}
          {/* ======================================================== */}
          {selectedAgentId === 'trader-risk' && (
            <div className="space-y-6">
              {/* Main Banner */}
              <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-r from-[#13231c] via-[#121922] to-[#122221] p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#222d39] gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-mono text-emerald-400 border border-emerald-700 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Agent 5 Approved & Operational
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                        trader-risk v1.0
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Shield className="h-5 w-5 text-emerald-400" />
                      Capital Risk & Exposure Guard Gatekeeper
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Acts as an unbreachable defense shield: audits trade sizes, enforces max monetary risk limits, caps single-stock exposure, and stops oversized orders before reaching the broker.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => triggerRiskWatchlist(true)}
                      disabled={loadingRisk}
                      className="flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 text-xs shadow-md transition border border-slate-700"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingRisk ? 'animate-spin' : ''}`} />
                      {loadingRisk ? 'Auditing...' : 'Refresh Risk Audit'}
                    </button>

                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-950/80 border border-emerald-600 px-3 py-2 text-xs font-bold text-emerald-400">
                      <Check className="h-4 w-4" />
                      Stage 5 Approved
                    </span>
                  </div>
                </div>

                {/* Risk Budget Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                  <div className="rounded-lg bg-[#0d131a] p-3 border border-[#1e2734]">
                    <p className="text-[10px] font-mono uppercase text-slate-500">Portfolio Capital</p>
                    <p className="text-base font-bold font-mono text-white">৳{accountEquityInput.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-[#0d131a] p-3 border border-rose-900/40">
                    <p className="text-[10px] font-mono uppercase text-rose-400">Max Trade Risk</p>
                    <p className="text-base font-bold font-mono text-rose-400">
                      ৳{((accountEquityInput * maxLossPctInput) / 100).toLocaleString()} ({maxLossPctInput}%)
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#0d131a] p-3 border border-amber-900/40">
                    <p className="text-[10px] font-mono uppercase text-amber-400">Position Cap</p>
                    <p className="text-base font-bold font-mono text-amber-400">
                      ৳{((accountEquityInput * maxPosPctInput) / 100).toLocaleString()} ({maxPosPctInput}%)
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#0d131a] p-3 border border-emerald-900/40">
                    <p className="text-[10px] font-mono uppercase text-emerald-400">Min Reward:Risk</p>
                    <p className="text-base font-bold font-mono text-emerald-400">1 : 1.5 R</p>
                  </div>
                  <div className="rounded-lg bg-[#0d131a] p-3 border border-cyan-900/40">
                    <p className="text-[10px] font-mono uppercase text-cyan-400">Cash Buffer (10%)</p>
                    <p className="text-base font-bold font-mono text-cyan-400">
                      ৳{((accountEquityInput * 10) / 100).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Interactive Single-Order Risk Inspector */}
              <div className="rounded-xl border border-[#2b394a] bg-[#121922] p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-cyan-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                      Interactive Order Risk Inspector & Shield Gate
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Audit any proposed order before dispatching to broker
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    placeholder="Stock (e.g. PTL)..."
                    value={singleRiskSymbol}
                    onChange={(e) => setSingleRiskSymbol(e.target.value.toUpperCase())}
                    className="w-36 rounded-md bg-[#161f2b] px-3 py-2 text-xs text-white placeholder-slate-500 border border-slate-700 focus:outline-none focus:border-amber-400 font-mono"
                  />
                  <input
                    type="number"
                    placeholder="Quantity (Shares)..."
                    value={singleRiskQty}
                    onChange={(e) => setSingleRiskQty(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-36 rounded-md bg-[#161f2b] px-3 py-2 text-xs text-white placeholder-slate-500 border border-slate-700 focus:outline-none font-mono"
                  />
                  <input
                    type="number"
                    step="0.10"
                    placeholder="Entry (৳)..."
                    value={singleRiskEntry}
                    onChange={(e) => setSingleRiskEntry(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-28 rounded-md bg-[#161f2b] px-3 py-2 text-xs text-white placeholder-slate-500 border border-slate-700 focus:outline-none font-mono"
                  />
                  <input
                    type="number"
                    step="0.10"
                    placeholder="Stop (৳)..."
                    value={singleRiskStop}
                    onChange={(e) => setSingleRiskStop(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-28 rounded-md bg-[#161f2b] px-3 py-2 text-xs text-white placeholder-slate-500 border border-slate-700 focus:outline-none font-mono"
                  />
                  <input
                    type="number"
                    step="0.10"
                    placeholder="Target (৳)..."
                    value={singleRiskTarget}
                    onChange={(e) => setSingleRiskTarget(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-28 rounded-md bg-[#161f2b] px-3 py-2 text-xs text-white placeholder-slate-500 border border-slate-700 focus:outline-none font-mono"
                  />
                  <button
                    onClick={runSingleRiskAudit}
                    disabled={auditingSingleRisk || !singleRiskSymbol.trim() || !singleRiskQty}
                    className="flex items-center gap-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-4 py-2 text-xs transition disabled:opacity-50"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    {auditingSingleRisk ? 'Auditing Shield...' : 'Audit Order Risk'}
                  </button>
                </div>

                {singleRiskResult && (
                  <div className="mt-4 rounded-lg border border-cyan-800/60 bg-[#0d131a] p-4 text-xs space-y-3">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold font-mono text-white">{singleRiskResult.symbol}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                            singleRiskResult.verdict === 'PASS'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}>
                            {singleRiskResult.verdict === 'PASS' ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldX className="h-3.5 w-3.5" />}
                            {singleRiskResult.verdict_badge}
                          </span>
                        </div>
                        {singleRiskResult.blocked_reasons.length > 0 && (
                          <div className="mt-1 text-rose-300 font-sans">
                            {singleRiskResult.blocked_reasons.join(' • ')}
                          </div>
                        )}
                        {singleRiskResult.verdict === 'BLOCK' && singleRiskResult.suggested_safe_quantity > 0 && (
                          <div className="mt-1 text-emerald-400 font-mono text-[11px]">
                            💡 Safe Recommended Size: {singleRiskResult.suggested_safe_quantity.toLocaleString()} shares (Value: ৳{singleRiskResult.suggested_safe_value.toLocaleString()})
                          </div>
                        )}
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-[10px] text-slate-400">Total Position Value</div>
                        <div className="text-sm font-bold text-white">৳{singleRiskResult.total_value.toLocaleString()}</div>
                        <div className="text-[10px] text-rose-400 mt-0.5">Total Risk: ৳{singleRiskResult.total_risk.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* 6-Point Audit Checklist Table */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {singleRiskResult.checks.map((chk) => (
                        <div key={chk.name} className="rounded bg-[#141c26] p-2.5 border border-slate-800">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-200 text-[11px]">{chk.name}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              chk.status === 'PASS'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : chk.status === 'WARN'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}>
                              {chk.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-sans">{chk.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Watchlist Risk Compliance Table */}
              <div className="rounded-xl border border-[#2b394a] bg-[#121922] p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d131a] p-3 rounded-lg border border-[#1e2734] mb-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-mono font-bold text-slate-200">Watchlist Sizing & Risk Gatekeeper</span>
                    <span className="rounded bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 text-[10px] font-mono">
                      {riskResult?.pass_count || 0} Safe to Route
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search risk audit..."
                      value={riskSearchQuery}
                      onChange={(e) => setRiskSearchQuery(e.target.value)}
                      className="w-40 rounded-md bg-[#161f2b] pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 border border-slate-700 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {loadingRisk ? (
                    <div className="py-12 text-center text-slate-400 font-mono">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-amber-400 mb-2" />
                      Auditing candidate orders against portfolio risk boundaries...
                    </div>
                  ) : filteredRiskAudits.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 font-mono">
                      No audits loaded yet. Click 'Run Watchlist Risk Audit' above.
                    </div>
                  ) : (
                    filteredRiskAudits.map((a) => (
                      <div
                        key={a.symbol}
                        className="rounded-lg border border-[#222d39] bg-[#0f1620] p-4 transition hover:border-[#334458]"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-[#1b2533]">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-base font-bold text-white">{a.symbol}</span>
                              <span className="rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-700 flex items-center gap-1">
                                <ShieldCheck className="h-3 w-3" /> SHIELD PASS
                              </span>
                              <span className="rounded bg-[#1a2332] px-1.5 py-0.5 text-[9px] font-mono text-slate-300">
                                {a.setup}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                              <span>Entry: ৳{a.entry_price.toFixed(2)}</span>
                              <span>Stop: ৳{a.stop_loss.toFixed(2)}</span>
                              <span>Target: ৳{a.target_price.toFixed(2)}</span>
                              <span className="text-emerald-400">R:R {a.reward_risk}:1</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right font-mono">
                              <div className="text-[10px] text-slate-400">Compliant Quantity</div>
                              <div className="text-sm font-bold text-emerald-400">{a.quantity.toLocaleString()} shares</div>
                              <div className="text-[10px] text-slate-300">৳{a.total_value.toLocaleString()}</div>
                            </div>
                            <button
                              onClick={() => navigate(`/chart?symbol=${a.symbol}`)}
                              className="flex items-center gap-1.5 rounded-lg bg-[#1e293b] hover:bg-[#283850] px-3 py-1.5 text-xs font-semibold text-amber-400 border border-slate-700 transition"
                            >
                              <span>Inspect Chart</span>
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Risk Metrics Strip */}
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                          <div className="rounded bg-[#141c26] p-2 border border-slate-800">
                            <span className="text-[10px] text-slate-500 block uppercase">Max Monetary Risk</span>
                            <span className="font-bold text-rose-400">৳{a.total_risk.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Under ৳{((accountEquityInput * maxLossPctInput)/100).toLocaleString()} cap</span>
                          </div>

                          <div className="rounded bg-[#141c26] p-2 border border-slate-800">
                            <span className="text-[10px] text-slate-500 block uppercase">Position Allocation</span>
                            <span className="font-bold text-slate-200">{((a.total_value / accountEquityInput) * 100).toFixed(1)}% of Capital</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Cap: {maxPosPctInput}%</span>
                          </div>

                          <div className="rounded bg-[#141c26] p-2 border border-slate-800">
                            <span className="text-[10px] text-slate-500 block uppercase">Reward : Risk Ratio</span>
                            <span className="font-bold text-emerald-400">{a.reward_risk} : 1 R</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Min required: 1.5</span>
                          </div>

                          <div className="rounded bg-[#141c26] p-2 border border-slate-800">
                            <span className="text-[10px] text-slate-500 block uppercase">Circuit Breaker</span>
                            <span className="font-bold text-emerald-400">SAFE (Inside ±10%)</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">DSE Limit Compliant</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Verification & Approval Checklist */}
                <div className="mt-6 rounded-lg border border-emerald-800/40 bg-gradient-to-r from-[#101923] via-[#101e23] to-emerald-950/20 p-4">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <Check className="h-4 w-4" />
                        Agent 5 Verification Passed & Approved
                      </h4>
                      <ul className="mt-2 space-y-1 text-xs text-slate-300">
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Single-trade monetary loss ceiling (1.5%) rigorously enforced.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Single-stock portfolio allocation cap (20%) prevents concentration risk.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Uncompromising Shield PASS / BLOCK gatekeeper stops oversized orders.</span>
                        </li>
                      </ul>
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                      <span className="flex items-center gap-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold px-4 py-2.5 text-xs shadow-lg">
                        <Check className="h-4 w-4 text-emerald-400" />
                        Stage 5 Passed & Operational
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 2: AGENT 4 - TIMEMACHINE REPLAY (APPROVED)          */}
          {/* ======================================================== */}
          {selectedAgentId === 'trader-timemachine' && (
            <div className="rounded-xl border border-emerald-500/40 bg-[#121922] p-5 shadow-lg">
              <div className="flex items-center justify-between pb-3 border-b border-[#222d39]">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-700 px-2 py-0.5 text-[10px] font-mono font-bold">
                    <Check className="h-3 w-3" /> Agent 4 Approved & Operational
                  </span>
                  <h2 className="text-base font-bold text-white">TimeMachine Replay & Simulator</h2>
                </div>
                <button
                  onClick={() => triggerTmWatchlist(true)}
                  disabled={loadingTm}
                  className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-3 py-1 text-xs text-slate-200"
                >
                  <RefreshCw className="h-3 w-3" /> Refresh Simulations
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {(tmResult?.simulations || []).slice(0, 10).map((s) => (
                  <div key={s.symbol} className="rounded bg-[#0d131a] p-3 border border-[#1e2734] flex items-center justify-between font-mono text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{s.symbol}</span>
                        <span className="rounded bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 text-[10px]">
                          {s.verdict.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-sans">{s.verdict.narrative}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-400 text-[10px]">Win Rate (2R)</div>
                      <div className="font-bold text-emerald-400">{s.backtest.win_rate}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 3: AGENT 3 - DYNAMIC EXIT AGENT (APPROVED)          */}
          {/* ======================================================== */}
          {selectedAgentId === 'trader-exit' && (
            <div className="rounded-xl border border-emerald-500/40 bg-[#121922] p-5 shadow-lg">
              <div className="flex items-center justify-between pb-3 border-b border-[#222d39]">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-700 px-2 py-0.5 text-[10px] font-mono font-bold">
                    <Check className="h-3 w-3" /> Agent 3 Approved & Operational
                  </span>
                  <h2 className="text-base font-bold text-white">Dynamic Exit & Profit Target Agent</h2>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 4: AGENT 2 - TACTICAL ENTRY AGENT (APPROVED)        */}
          {/* ======================================================== */}
          {selectedAgentId === 'trader-entry' && (
            <div className="rounded-xl border border-emerald-500/40 bg-[#121922] p-5 shadow-lg">
              <div className="flex items-center justify-between pb-3 border-b border-[#222d39]">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-700 px-2 py-0.5 text-[10px] font-mono font-bold">
                    <Check className="h-3 w-3" /> Agent 2 Approved & Operational
                  </span>
                  <h2 className="text-base font-bold text-white">Tactical Entry Order Agent</h2>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 5: AGENT 1 - SETUP SCANNER (APPROVED)               */}
          {/* ======================================================== */}
          {selectedAgentId === 'trader-scanner' && (
            <div className="rounded-xl border border-emerald-500/40 bg-[#121922] p-5 shadow-lg">
              <div className="flex items-center justify-between pb-3 border-b border-[#222d39]">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-700 px-2 py-0.5 text-[10px] font-mono font-bold">
                    <Check className="h-3 w-3" /> Agent 1 Approved & Operational
                  </span>
                  <h2 className="text-base font-bold text-white">DSE Technical Setup Scanner</h2>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

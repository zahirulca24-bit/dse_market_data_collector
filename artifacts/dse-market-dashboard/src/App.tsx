import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import AdminGate from '@/components/admin-gate';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import MarketDashboard from '@/pages/market-dashboard';
import HistoricalExplorer from '@/pages/historical-explorer';
import IngestionMonitor from '@/pages/ingestion-monitor';
import SectorMapping from '@/pages/sector-mapping';
import AdvancedChartPage from '@/pages/advanced-chart';
import AgentAnalysisPage from '@/pages/agent-analysis';
import TradeJournalPage from '@/pages/trade-journal';
import DailyReportsPage from '@/pages/daily-reports';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
         <Route path="/" component={MarketDashboard} />
         <Route path="/chart" component={AdvancedChartPage} />
         <Route path="/agents" component={AgentAnalysisPage} />
         <Route path="/journal" component={TradeJournalPage} />
         <Route path="/reports" component={DailyReportsPage} />
         <Route path="/historical" component={HistoricalExplorer} />
         <Route path="/sectors" component={SectorMapping} />
         <Route path="/ingestion" component={IngestionMonitor} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AdminGate><Router /></AdminGate>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

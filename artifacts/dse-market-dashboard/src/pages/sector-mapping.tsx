import { useGetMarketStocks } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Sidebar } from '@/components/sidebar';
import { useMemo } from 'react';
import type { MarketStock } from '@workspace/api-zod';

export default function SectorMapping() {
  const { data: stocks, isLoading } = useGetMarketStocks();

  const groupedStocks = useMemo(() => {
    if (!stocks) return {};
    return stocks.reduce((acc: Record<string, MarketStock[]>, stock) => {
      const sector = stock.sector || 'Unclassified';
      if (!acc[sector]) {
        acc[sector] = [];
      }
      acc[sector].push(stock);
      return acc;
    }, {});
  }, [stocks]);

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground">
      <Sidebar active="sectors" />
      <main className="min-w-0 flex-1 terminal-grid px-5 py-8 md:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">
                DSE / Sector mapping
              </p>
              <h1 className="mt-1 text-3xl font-semibold">
                Sector mapping
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                View all market stocks grouped by their respective sectors.
              </p>
            </div>
          </div>

      <section className="mt-7">
        <div className="space-y-8">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full rounded-xl bg-muted" />
              <Skeleton className="h-48 w-full rounded-xl bg-muted" />
            </div>
          ) : (
            Object.entries(groupedStocks).sort().map(([sector, sectorStocks]) => (
              <Card key={sector} className="rounded-lg border border-border bg-card shadow-sm">
                <CardHeader className="border-b border-border/60 pb-4">
                  <CardTitle className="flex items-center justify-between text-lg font-semibold">
                    <span>{sector}</span>
                    <Badge variant="secondary" className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {sectorStocks.length} STOCKS
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-2 gap-px bg-border/40 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {sectorStocks.map((stock) => (
                      <div
                        key={stock.symbol}
                        className="flex flex-col items-center justify-center bg-card p-4 transition-colors hover:bg-muted/50"
                      >
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {stock.symbol}
                        </span>
                        <span className="mt-1 font-mono text-xs text-muted-foreground">
                          {stock.ltp.toFixed(2)}
                        </span>
                        <span className={`mt-1 font-mono text-xs ${stock.change > 0 ? 'text-emerald-500' : stock.change < 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                          {stock.change > 0 ? '+' : ''}{stock.change.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
        </div>
      </main>
    </div>
  );
}

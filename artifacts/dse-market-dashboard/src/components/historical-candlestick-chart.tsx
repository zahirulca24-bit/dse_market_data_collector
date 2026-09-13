import { useMemo, useState } from 'react';

export type DailyPoint = {
  time: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
  valueMn?: number | null;
  source?: string;
};

export type ValidationIssue = {
  key: string;
  label: string;
  severity: 'warning' | 'error';
};

export type ValidatedPoint = DailyPoint & {
  issues: ValidationIssue[];
};

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateDailyHistory(points: DailyPoint[]): ValidatedPoint[] {
  const dateCounts = new Map<string, number>();
  for (const point of points) {
    dateCounts.set(point.time, (dateCounts.get(point.time) || 0) + 1);
  }

  return points.map((point) => {
    const issues: ValidationIssue[] = [];
    const values = [point.open, point.high, point.low, point.close];
    const hasMissing = values.some((value) => !finite(value));

    if (hasMissing) {
      issues.push({ key: 'missing', label: 'Missing OHLC', severity: 'error' });
    }

    if (finite(point.high) && finite(point.low) && point.high < point.low) {
      issues.push({ key: 'high-low', label: 'High < Low', severity: 'error' });
    }

    if (
      finite(point.open) &&
      finite(point.high) &&
      finite(point.low) &&
      (point.open > point.high || point.open < point.low)
    ) {
      issues.push({ key: 'open-range', label: 'Open outside range', severity: 'error' });
    }

    if (
      finite(point.close) &&
      finite(point.high) &&
      finite(point.low) &&
      (point.close > point.high || point.close < point.low)
    ) {
      issues.push({ key: 'close-range', label: 'Close outside range', severity: 'error' });
    }

    if (
      finite(point.open) &&
      finite(point.high) &&
      finite(point.low) &&
      finite(point.close) &&
      point.open === point.high &&
      point.high === point.low &&
      point.low === point.close
    ) {
      issues.push({ key: 'flat', label: 'Flat candle', severity: 'warning' });
    }

    if ((dateCounts.get(point.time) || 0) > 1) {
      issues.push({ key: 'duplicate', label: 'Duplicate date', severity: 'error' });
    }

    return { ...point, issues };
  });
}

function formatNumber(value: number | null | undefined) {
  if (!finite(value)) return 'N/A';
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function HistoricalCandlestickChart({
  points,
  mode,
}: {
  points: DailyPoint[];
  mode: 'candles' | 'line';
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const validated = useMemo(
    () => validateDailyHistory(points).slice().sort((a, b) => a.time.localeCompare(b.time)),
    [points],
  );

  const drawable = validated.filter(
    (point) =>
      finite(point.open) &&
      finite(point.high) &&
      finite(point.low) &&
      finite(point.close),
  );

  if (!drawable.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        No complete OHLC candles available for this range.
      </div>
    );
  }

  const width = Math.max(920, drawable.length * 12 + 100);
  const height = 430;
  const left = 58;
  const right = 24;
  const top = 24;
  const priceBottom = 320;
  const volumeTop = 342;
  const volumeBottom = 400;
  const chartWidth = width - left - right;
  const priceHeight = priceBottom - top;

  const lows = drawable.map((point) => point.low as number);
  const highs = drawable.map((point) => point.high as number);
  const minRaw = Math.min(...lows);
  const maxRaw = Math.max(...highs);
  const range = Math.max(maxRaw - minRaw, Math.abs(maxRaw || 1) * 0.01, 0.01);
  const minPrice = minRaw - range * 0.06;
  const maxPrice = maxRaw + range * 0.06;
  const maxVolume = Math.max(...drawable.map((point) => point.volume || 0), 1);

  const x = (index: number) => left + ((index + 0.5) / drawable.length) * chartWidth;
  const y = (value: number) =>
    top + ((maxPrice - value) / (maxPrice - minPrice)) * priceHeight;
  const candleWidth = Math.max(3, Math.min(8, chartWidth / drawable.length * 0.58));

  const active = hovered === null ? null : drawable[hovered];
  const linePoints = drawable
    .map((point, index) => `${x(index)},${y(point.close as number)}`)
    .join(' ');

  return (
    <div className="relative overflow-x-auto rounded-md border border-border bg-background">
      {active ? (
        <div className="pointer-events-none sticky left-3 top-3 z-10 inline-flex gap-3 rounded-md border border-border bg-card/95 px-3 py-2 font-mono text-[10px] shadow-sm">
          <span className="font-semibold">{active.time}</span>
          <span>O {formatNumber(active.open)}</span>
          <span>H {formatNumber(active.high)}</span>
          <span>L {formatNumber(active.low)}</span>
          <span>C {formatNumber(active.close)}</span>
          <span>V {active.volume.toLocaleString()}</span>
          {active.issues.length ? (
            <span className={active.issues.some((issue) => issue.severity === 'error') ? 'text-rose-700' : 'text-amber-700'}>
              {active.issues.map((issue) => issue.label).join(', ')}
            </span>
          ) : null}
        </div>
      ) : null}

      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Historical OHLCV chart">
        {Array.from({ length: 6 }).map((_, index) => {
          const value = minPrice + ((5 - index) / 5) * (maxPrice - minPrice);
          const yy = top + (index / 5) * priceHeight;
          return (
            <g key={index}>
              <line x1={left} x2={width - right} y1={yy} y2={yy} className="stroke-border" strokeWidth="1" />
              <text x={8} y={yy + 4} className="fill-muted-foreground font-mono text-[10px]">
                {formatNumber(value)}
              </text>
            </g>
          );
        })}

        {mode === 'line' ? (
          <polyline
            points={linePoints}
            fill="none"
            className="stroke-emerald-600"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : (
          drawable.map((point, index) => {
            const xx = x(index);
            const openY = y(point.open as number);
            const closeY = y(point.close as number);
            const highY = y(point.high as number);
            const lowY = y(point.low as number);
            const rising = (point.close as number) >= (point.open as number);
            const hasError = point.issues.some((issue) => issue.severity === 'error');
            const hasWarning = point.issues.some((issue) => issue.severity === 'warning');
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));
            const candleClass = hasError
              ? 'stroke-rose-700 fill-rose-600'
              : hasWarning
                ? 'stroke-amber-700 fill-amber-500'
                : rising
                  ? 'stroke-emerald-700 fill-emerald-600'
                  : 'stroke-rose-600 fill-rose-500';

            return (
              <g key={`${point.time}-${index}`}>
                <line x1={xx} x2={xx} y1={highY} y2={lowY} className={candleClass} strokeWidth="1.2" />
                <rect
                  x={xx - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  className={candleClass}
                  strokeWidth="1"
                />
              </g>
            );
          })
        )}

        {drawable.map((point, index) => {
          const xx = x(index);
          const volumeHeight = ((point.volume || 0) / maxVolume) * (volumeBottom - volumeTop);
          const hasIssue = point.issues.length > 0;
          return (
            <g key={`volume-${point.time}-${index}`}>
              <rect
                x={xx - candleWidth / 2}
                y={volumeBottom - volumeHeight}
                width={candleWidth}
                height={Math.max(volumeHeight, 1)}
                className={hasIssue ? 'fill-amber-500/70' : 'fill-slate-400/60'}
              />
              <rect
                x={xx - Math.max(candleWidth, 10) / 2}
                y={top}
                width={Math.max(candleWidth, 10)}
                height={volumeBottom - top}
                fill="transparent"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              />
            </g>
          );
        })}

        <line x1={left} x2={width - right} y1={volumeTop - 8} y2={volumeTop - 8} className="stroke-border" strokeWidth="1" />
        <text x={8} y={volumeTop + 8} className="fill-muted-foreground font-mono text-[10px]">VOL</text>

        {drawable.map((point, index) => {
          if (index !== 0 && index !== drawable.length - 1 && index % Math.max(1, Math.floor(drawable.length / 6)) !== 0) return null;
          return (
            <text key={`label-${point.time}-${index}`} x={x(index)} y={422} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
              {point.time}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

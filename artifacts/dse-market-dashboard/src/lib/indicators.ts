export type TimePoint = {
  time: string;
  close: number;
};

export type FullCandlePoint = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type IndicatorResult = {
  time: string;
  value: number;
};

export type MACDPoint = {
  time: string;
  macd: number;
  signal: number;
  hist: number;
  color: string;
};

export type BollingerBandsResult = {
  upper: IndicatorResult[];
  middle: IndicatorResult[];
  lower: IndicatorResult[];
};

export type StochRSIResult = {
  kLine: IndicatorResult[];
  dLine: IndicatorResult[];
};

export type ATRResult = {
  time: string;
  atr: number;
  stoplossBuffer: number; // 1.5x ATR
};

/**
 * Simple Moving Average (SMA)
 */
export function calculateSMA(data: TimePoint[], period: number): IndicatorResult[] {
  const result: IndicatorResult[] = [];
  if (data.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  result.push({ time: data[period - 1].time, value: +(sum / period).toFixed(2) });

  for (let i = period; i < data.length; i++) {
    sum += data[i].close - data[i - period].close;
    result.push({ time: data[i].time, value: +(sum / period).toFixed(2) });
  }

  return result;
}

/**
 * Exponential Moving Average (EMA)
 */
export function calculateEMA(data: TimePoint[], period: number): IndicatorResult[] {
  const result: IndicatorResult[] = [];
  if (data.length < period) return result;

  const multiplier = 2 / (period + 1);

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let prevEMA = sum / period;
  result.push({ time: data[period - 1].time, value: +prevEMA.toFixed(2) });

  for (let i = period; i < data.length; i++) {
    const currentClose = data[i].close;
    prevEMA = (currentClose - prevEMA) * multiplier + prevEMA;
    result.push({ time: data[i].time, value: +prevEMA.toFixed(2) });
  }

  return result;
}

/**
 * Relative Strength Index (RSI)
 */
export function calculateRSI(data: TimePoint[], period: number = 14): IndicatorResult[] {
  const result: IndicatorResult[] = [];
  if (data.length <= period) return result;

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - 100 / (1 + rs);
  result.push({ time: data[period].time, value: +rsi.toFixed(2) });

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);
    result.push({ time: data[i].time, value: +rsi.toFixed(2) });
  }

  return result;
}

/**
 * 1. Bollinger Bands (BB) with Standard Deviation
 * Default: Period 20, Multiplier 2
 */
export function calculateBollingerBands(
  data: TimePoint[],
  period: number = 20,
  multiplier: number = 2
): BollingerBandsResult {
  const upper: IndicatorResult[] = [];
  const middle: IndicatorResult[] = [];
  const lower: IndicatorResult[] = [];

  if (data.length < period) return { upper, middle, lower };

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const mean = slice.reduce((acc, curr) => acc + curr.close, 0) / period;

    // Variance & StdDev
    const variance =
      slice.reduce((acc, curr) => acc + Math.pow(curr.close - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const time = data[i].time;
    const upVal = +(mean + multiplier * stdDev).toFixed(2);
    const midVal = +mean.toFixed(2);
    const lowVal = +(mean - multiplier * stdDev).toFixed(2);

    upper.push({ time, value: upVal });
    middle.push({ time, value: midVal });
    lower.push({ time, value: lowVal });
  }

  return { upper, middle, lower };
}

/**
 * 2. Stochastic RSI (Momentum & Swing Indicator)
 * Fast %K and %D lines with 80/20 overbought/oversold levels
 */
export function calculateStochasticRSI(
  data: TimePoint[],
  rsiPeriod: number = 14,
  stochPeriod: number = 14,
  kSmooth: number = 3,
  dSmooth: number = 3
): StochRSIResult {
  const rsi = calculateRSI(data, rsiPeriod);
  if (rsi.length < stochPeriod) return { kLine: [], dLine: [] };

  const rawStoch: IndicatorResult[] = [];

  for (let i = stochPeriod - 1; i < rsi.length; i++) {
    const window = rsi.slice(i - stochPeriod + 1, i + 1);
    const values = window.map((w) => w.value);
    const minRSI = Math.min(...values);
    const maxRSI = Math.max(...values);

    const currentRSI = rsi[i].value;
    const range = maxRSI - minRSI;
    const stochVal = range === 0 ? 50 : ((currentRSI - minRSI) / range) * 100;

    rawStoch.push({ time: rsi[i].time, value: +stochVal.toFixed(2) });
  }

  // Smooth %K
  const kRaw: IndicatorResult[] = [];
  for (let i = kSmooth - 1; i < rawStoch.length; i++) {
    const slice = rawStoch.slice(i - kSmooth + 1, i + 1);
    const kVal = slice.reduce((acc, c) => acc + c.value, 0) / kSmooth;
    kRaw.push({ time: rawStoch[i].time, value: +kVal.toFixed(2) });
  }

  // Smooth %D (SMA of %K)
  const dLine: IndicatorResult[] = [];
  for (let i = dSmooth - 1; i < kRaw.length; i++) {
    const slice = kRaw.slice(i - dSmooth + 1, i + 1);
    const dVal = slice.reduce((acc, c) => acc + c.value, 0) / dSmooth;
    dLine.push({ time: kRaw[i].time, value: +dVal.toFixed(2) });
  }

  return { kLine: kRaw, dLine };
}

/**
 * 3. VWAP (Volume Weighted Average Price)
 * Measures average price weighted by volume: Cumulative(TypicalPrice * Vol) / Cumulative(Vol)
 */
export function calculateVWAP(
  data: { time: string; high: number; low: number; close: number; volume: number }[]
): IndicatorResult[] {
  const result: IndicatorResult[] = [];
  if (data.length === 0) return result;

  let cumTypicalVolume = 0;
  let cumVolume = 0;

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const vol = candle.volume > 0 ? candle.volume : 1;

    cumTypicalVolume += typicalPrice * vol;
    cumVolume += vol;

    const vwapVal = +(cumTypicalVolume / cumVolume).toFixed(2);
    result.push({ time: candle.time, value: vwapVal });
  }

  return result;
}

/**
 * 4. ATR (Average True Range) - Volatility, Risk & Stoploss Calculator
 * Recommended Stoploss = 1.5 * ATR below current price
 */
export function calculateATR(
  data: { time: string; high: number; low: number; close: number }[],
  period: number = 14
): ATRResult[] {
  const result: ATRResult[] = [];
  if (data.length <= period) return result;

  const trueRanges: { time: string; tr: number }[] = [];

  for (let i = 1; i < data.length; i++) {
    const current = data[i];
    const prev = data[i - 1];

    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    trueRanges.push({ time: current.time, tr });
  }

  if (trueRanges.length < period) return result;

  // Initial SMA of TR
  let sumTR = 0;
  for (let i = 0; i < period; i++) {
    sumTR += trueRanges[i].tr;
  }
  let currentATR = sumTR / period;
  result.push({
    time: trueRanges[period - 1].time,
    atr: +currentATR.toFixed(2),
    stoplossBuffer: +(currentATR * 1.5).toFixed(2),
  });

  // Wilder's Smoothing for ATR
  for (let i = period; i < trueRanges.length; i++) {
    currentATR = (currentATR * (period - 1) + trueRanges[i].tr) / period;
    result.push({
      time: trueRanges[i].time,
      atr: +currentATR.toFixed(2),
      stoplossBuffer: +(currentATR * 1.5).toFixed(2),
    });
  }

  return result;
}

/**
 * Moving Average Convergence Divergence (MACD)
 */
export function calculateMACD(
  data: TimePoint[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macdLine: IndicatorResult[];
  signalLine: IndicatorResult[];
  histogram: { time: string; value: number; color: string }[];
} {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  const fastMap = new Map<string, number>(fastEMA.map((item) => [item.time, item.value]));

  const rawMACD: IndicatorResult[] = [];
  for (const slowItem of slowEMA) {
    const fastVal = fastMap.get(slowItem.time);
    if (fastVal !== undefined) {
      const macdVal = +(fastVal - slowItem.value).toFixed(2);
      rawMACD.push({ time: slowItem.time, value: macdVal });
    }
  }

  const signalInput: TimePoint[] = rawMACD.map((m) => ({ time: m.time, close: m.value }));
  const signalEMA = calculateEMA(signalInput, signalPeriod);
  const signalMap = new Map<string, number>(signalEMA.map((s) => [s.time, s.value]));

  const macdLine: IndicatorResult[] = [];
  const signalLine: IndicatorResult[] = [];
  const histogram: { time: string; value: number; color: string }[] = [];

  for (const m of rawMACD) {
    const sigVal = signalMap.get(m.time);
    if (sigVal !== undefined) {
      const hist = +(m.value - sigVal).toFixed(2);
      macdLine.push(m);
      signalLine.push({ time: m.time, value: sigVal });
      histogram.push({
        time: m.time,
        value: hist,
        color: hist >= 0 ? '#089981' : '#f23645',
      });
    }
  }

  return { macdLine, signalLine, histogram };
}


/**
 * Volume Moving Average (MA)
 */
export function calculateVolumeMA(
  data: { time: string; value: number }[],
  period: number = 20
): IndicatorResult[] {
  const result: IndicatorResult[] = [];
  if (data.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].value;
  }
  result.push({ time: data[period - 1].time, value: Math.round(sum / period) });

  for (let i = period; i < data.length; i++) {
    sum += data[i].value - data[i - period].value;
    result.push({ time: data[i].time, value: Math.round(sum / period) });
  }

  return result;
}

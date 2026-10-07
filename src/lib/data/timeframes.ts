import type { Candle } from '@/lib/chart';

export interface Timeframe {
  id: string;
  label: string;
  seconds: number;
}

/** Intervals shown in the timeframe bar (Angel One style). */
export const TIMEFRAMES: Timeframe[] = [
  { id: '1m', label: '1m', seconds: 60 },
  { id: '5m', label: '5m', seconds: 300 },
  { id: '15m', label: '15m', seconds: 900 },
  { id: '30m', label: '30m', seconds: 1800 },
  { id: '1h', label: '1h', seconds: 3600 },
  { id: '4h', label: '4h', seconds: 14400 },
  { id: '1D', label: '1D', seconds: 86400 },
];

/**
 * Aggregate a base candle series (typically 1-minute) into the requested
 * interval by bucketing on `floor(time / seconds)`. Volume is summed while the
 * first open, last close and aggregated high/low are preserved.
 */
export function resample(candles: Candle[], seconds: number): Candle[] {
  if (seconds <= 0) return candles;
  const out: Candle[] = [];
  let bucketStart = -1;
  let current: Candle | null = null;

  for (const candle of candles) {
    const start = Math.floor(candle.time / seconds) * seconds;
    if (start !== bucketStart || current === null) {
      if (current) out.push(current);
      bucketStart = start;
      current = {
        time: start,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume ?? 0,
      };
    } else {
      current.high = Math.max(current.high, candle.high);
      current.low = Math.min(current.low, candle.low);
      current.close = candle.close;
      current.volume = (current.volume ?? 0) + (candle.volume ?? 0);
    }
  }
  if (current) out.push(current);
  return out;
}

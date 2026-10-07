import type { Candle } from '../chart/types';

/** Deterministic PRNG so server and client render identical demo data. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GenerateOptions {
  count?: number;
  seed?: number;
  startPrice?: number;
  /** Bar interval in seconds (default 1h). */
  interval?: number;
  /** Start time in UNIX seconds (default: aligned to now - count*interval). */
  startTime?: number;
}

/**
 * Generates a realistic-looking OHLCV series via a bounded random walk with
 * mild mean reversion and volatility clustering.
 */
export function generateCandles(options: GenerateOptions = {}): Candle[] {
  const count = options.count ?? 600;
  const interval = options.interval ?? 3600;
  const random = mulberry32(options.seed ?? 1337);
  const end = Math.floor(Date.now() / 1000 / interval) * interval;
  const start = options.startTime ?? end - count * interval;

  let price = options.startPrice ?? 100;
  let volatility = 0.012;
  const candles: Candle[] = [];

  for (let i = 0; i < count; i += 1) {
    const drift = (100 - price) * 0.0004;
    const shock = (random() - 0.5) * 2 * volatility * price;
    const open = price;
    const close = Math.max(1, open + shock + drift);
    volatility = Math.max(0.004, Math.min(0.03, volatility * 0.97 + Math.abs(shock / price) * 0.03));
    const wick = Math.max(0.001, volatility * price * random());
    const high = Math.max(open, close) + wick;
    const low = Math.min(open, close) - wick;
    const volume = Math.round(5000 + random() * 20000 + Math.abs(shock) * 5000);

    candles.push({
      time: start + i * interval,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });
    price = close;
  }

  return candles;
}

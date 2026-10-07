import type { Candle } from '../types';
import type { IndicatorUtils } from './types';

type Maybe = number | undefined;

function sma(values: number[], period: number): Maybe[] {
  const out: Maybe[] = new Array(values.length).fill(undefined);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function ema(values: number[], period: number): Maybe[] {
  const out: Maybe[] = new Array(values.length).fill(undefined);
  if (period <= 0) return out;
  const k = 2 / (period + 1);
  let prev: number | undefined;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (prev === undefined) {
      if (i === period - 1) {
        let sum = 0;
        for (let j = 0; j < period; j += 1) sum += values[j];
        prev = sum / period;
        out[i] = prev;
      }
    } else {
      prev = value * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

function wma(values: number[], period: number): Maybe[] {
  const out: Maybe[] = new Array(values.length).fill(undefined);
  const denominator = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i += 1) {
    let sum = 0;
    for (let j = 0; j < period; j += 1) sum += values[i - j] * (period - j);
    out[i] = sum / denominator;
  }
  return out;
}

/** Wilder's smoothing (used by RSI/ATR). */
function rma(values: number[], period: number): Maybe[] {
  const out: Maybe[] = new Array(values.length).fill(undefined);
  let prev: number | undefined;
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    if (i < period) {
      sum += values[i];
      if (i === period - 1) {
        prev = sum / period;
        out[i] = prev;
      }
    } else if (prev !== undefined) {
      prev = (prev * (period - 1) + values[i]) / period;
      out[i] = prev;
    }
  }
  return out;
}

function stdev(values: number[], period: number): Maybe[] {
  const out: Maybe[] = new Array(values.length).fill(undefined);
  const means = sma(values, period);
  for (let i = period - 1; i < values.length; i += 1) {
    const mean = means[i];
    if (mean === undefined) continue;
    let acc = 0;
    for (let j = i - period + 1; j <= i; j += 1) acc += (values[j] - mean) ** 2;
    out[i] = Math.sqrt(acc / period);
  }
  return out;
}

function rollingExtreme(values: number[], period: number, pick: 'max' | 'min'): Maybe[] {
  const out: Maybe[] = new Array(values.length).fill(undefined);
  for (let i = period - 1; i < values.length; i += 1) {
    let result = pick === 'max' ? -Infinity : Infinity;
    for (let j = i - period + 1; j <= i; j += 1) {
      result = pick === 'max' ? Math.max(result, values[j]) : Math.min(result, values[j]);
    }
    out[i] = result;
  }
  return out;
}

function rsi(values: number[], period: number): Maybe[] {
  const gains: number[] = new Array(values.length).fill(0);
  const losses: number[] = new Array(values.length).fill(0);
  for (let i = 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    gains[i] = Math.max(change, 0);
    losses[i] = Math.max(-change, 0);
  }
  const avgGain = rma(gains, period);
  const avgLoss = rma(losses, period);
  const out: Maybe[] = new Array(values.length).fill(undefined);
  for (let i = 0; i < values.length; i += 1) {
    const gain = avgGain[i];
    const loss = avgLoss[i];
    if (gain === undefined || loss === undefined) continue;
    if (loss === 0) out[i] = 100;
    else {
      const rs = gain / loss;
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

function trueRange(candles: Candle[]): number[] {
  const out: number[] = new Array(candles.length).fill(0);
  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i];
    if (i === 0) {
      out[i] = candle.high - candle.low;
      continue;
    }
    const previousClose = candles[i - 1].close;
    out[i] = Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  }
  return out;
}

function atr(candles: Candle[], period: number): Maybe[] {
  return rma(trueRange(candles), period);
}

function crossover(fast: Maybe[], slow: Maybe[]): boolean[] {
  const out: boolean[] = new Array(fast.length).fill(false);
  for (let i = 1; i < fast.length; i += 1) {
    const f0 = fast[i - 1];
    const s0 = slow[i - 1];
    const f1 = fast[i];
    const s1 = slow[i];
    if (f0 === undefined || s0 === undefined || f1 === undefined || s1 === undefined) continue;
    out[i] = f0 <= s0 && f1 > s1;
  }
  return out;
}

export const indicatorUtils: IndicatorUtils = {
  sma,
  ema,
  wma,
  rma,
  stdev,
  highest: (values, period) => rollingExtreme(values, period, 'max'),
  lowest: (values, period) => rollingExtreme(values, period, 'min'),
  rsi,
  atr,
  crossover,
};

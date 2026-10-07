import type { Candle } from '../../types';
import type { PlotPoint } from '../types';

/** Zip a per-candle numeric series (with gaps) into plot points. */
export function toPlot(
  candles: Candle[],
  values: Array<number | undefined>,
  color?: string,
): PlotPoint[] {
  const points: PlotPoint[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const value = values[i];
    if (value === undefined || !Number.isFinite(value)) continue;
    points.push(color ? { time: candles[i].time, value, color } : { time: candles[i].time, value });
  }
  return points;
}

export function optionColor(condition: boolean, positive: string, negative: string): string {
  return condition ? positive : negative;
}

import type { IndicatorDefinition, PlotPoint } from '../types';
import { toPlot } from './helpers';

export const macdIndicator: IndicatorDefinition = {
  id: 'macd',
  name: 'MACD',
  description: 'Moving Average Convergence Divergence',
  overlay: false,
  params: [
    { name: 'fast', label: 'Fast', type: 'number', default: 12, min: 1, max: 100, step: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 26, min: 2, max: 200, step: 1 },
    { name: 'signal', label: 'Signal', type: 'number', default: 9, min: 1, max: 100, step: 1 },
  ],
  compute({ candles, params, utils }) {
    const closes = candles.map((candle) => candle.close);
    const fast = utils.ema(closes, Number(params.fast));
    const slow = utils.ema(closes, Number(params.slow));
    const macd = fast.map((value, i) =>
      value === undefined || slow[i] === undefined ? undefined : value - slow[i]!,
    );

    const definedMacd = macd.map((value) => value ?? 0);
    const signalRaw = utils.ema(definedMacd, Number(params.signal));
    const signal = macd.map((value, i) => (value === undefined ? undefined : signalRaw[i]));

    const histogram: PlotPoint[] = [];
    for (let i = 0; i < candles.length; i += 1) {
      const m = macd[i];
      const s = signal[i];
      if (m === undefined || s === undefined) continue;
      histogram.push({
        time: candles[i].time,
        value: m - s,
        color: m - s >= 0 ? 'rgba(38,166,154,0.7)' : 'rgba(239,83,80,0.7)',
      });
    }

    return {
      plots: [
        { id: 'macd-hist', type: 'histogram', data: histogram, options: { priceLineVisible: false, lastValueVisible: false } },
        { id: 'macd-line', type: 'line', data: toPlot(candles, macd, '#2962ff'), options: { lineWidth: 2, priceLineVisible: false, lastValueVisible: false } },
        { id: 'macd-signal', type: 'line', data: toPlot(candles, signal, '#ff6d00'), options: { lineWidth: 1, priceLineVisible: false, lastValueVisible: false } },
      ],
      priceLines: [{ price: 0, color: 'rgba(154,164,178,0.4)', title: '', lineStyle: 1, lineWidth: 1 }],
    };
  },
};

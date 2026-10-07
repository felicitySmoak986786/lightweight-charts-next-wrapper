import type { IndicatorDefinition } from '../types';
import { toPlot } from './helpers';

export const bollingerIndicator: IndicatorDefinition = {
  id: 'bollinger',
  name: 'Bollinger Bands',
  description: 'SMA with standard-deviation bands',
  overlay: true,
  params: [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 2, max: 500, step: 1 },
    { name: 'multiplier', label: 'Std Dev', type: 'number', default: 2, min: 0.5, max: 5, step: 0.5 },
    { name: 'color', label: 'Color', type: 'string', default: '#787b86' },
  ],
  compute({ candles, params, utils }) {
    const closes = candles.map((candle) => candle.close);
    const period = Number(params.period);
    const multiplier = Number(params.multiplier);
    const middle = utils.sma(closes, period);
    const deviation = utils.stdev(closes, period);
    const upper = middle.map((value, i) => (value === undefined || deviation[i] === undefined ? undefined : value + deviation[i]! * multiplier));
    const lower = middle.map((value, i) => (value === undefined || deviation[i] === undefined ? undefined : value - deviation[i]! * multiplier));
    const color = String(params.color);

    return {
      plots: [
        { id: 'bb-upper', type: 'line', data: toPlot(candles, upper, color), options: { lineWidth: 1, priceLineVisible: false, lastValueVisible: false } },
        { id: 'bb-middle', type: 'line', data: toPlot(candles, middle, color), options: { lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false } },
        { id: 'bb-lower', type: 'line', data: toPlot(candles, lower, color), options: { lineWidth: 1, priceLineVisible: false, lastValueVisible: false } },
      ],
    };
  },
};

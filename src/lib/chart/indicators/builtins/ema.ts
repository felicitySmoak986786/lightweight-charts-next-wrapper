import type { IndicatorDefinition } from '../types';
import { toPlot } from './helpers';

export const emaIndicator: IndicatorDefinition = {
  id: 'ema',
  name: 'EMA',
  description: 'Exponential Moving Average',
  overlay: true,
  params: [
    { name: 'period', label: 'Period', type: 'number', default: 21, min: 1, max: 500, step: 1 },
    { name: 'color', label: 'Color', type: 'string', default: '#ff9800' },
  ],
  compute({ candles, params, utils }) {
    const values = utils.ema(
      candles.map((candle) => candle.close),
      Number(params.period),
    );
    return {
      plots: [
        {
          id: 'ema',
          type: 'line',
          data: toPlot(candles, values, String(params.color)),
          options: { lineWidth: 2, priceLineVisible: false, lastValueVisible: true },
        },
      ],
    };
  },
};

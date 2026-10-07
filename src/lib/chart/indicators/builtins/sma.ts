import type { IndicatorDefinition } from '../types';
import { toPlot } from './helpers';

export const smaIndicator: IndicatorDefinition = {
  id: 'sma',
  name: 'SMA',
  description: 'Simple Moving Average',
  overlay: true,
  params: [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 },
    { name: 'color', label: 'Color', type: 'string', default: '#2962ff' },
  ],
  compute({ candles, params, utils }) {
    const values = utils.sma(
      candles.map((candle) => candle.close),
      Number(params.period),
    );
    return {
      plots: [
        {
          id: 'sma',
          type: 'line',
          data: toPlot(candles, values, String(params.color)),
          options: { lineWidth: 2, priceLineVisible: false, lastValueVisible: true },
        },
      ],
    };
  },
};

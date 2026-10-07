import type { IndicatorDefinition } from '../types';
import { toPlot } from './helpers';

export const rsiIndicator: IndicatorDefinition = {
  id: 'rsi',
  name: 'RSI',
  description: 'Relative Strength Index',
  overlay: false,
  params: [
    { name: 'period', label: 'Period', type: 'number', default: 14, min: 2, max: 200, step: 1 },
    { name: 'overbought', label: 'Overbought', type: 'number', default: 70, min: 50, max: 100, step: 1 },
    { name: 'oversold', label: 'Oversold', type: 'number', default: 30, min: 0, max: 50, step: 1 },
    { name: 'color', label: 'Color', type: 'string', default: '#7e57c2' },
  ],
  compute({ candles, params, utils }) {
    const values = utils.rsi(
      candles.map((candle) => candle.close),
      Number(params.period),
    );
    const overbought = Number(params.overbought);
    const oversold = Number(params.oversold);

    return {
      plots: [
        {
          id: 'rsi',
          type: 'line',
          data: toPlot(candles, values, String(params.color)),
          options: {
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
          },
        },
      ],
      priceLines: [
        { price: overbought, color: 'rgba(239,83,80,0.6)', title: 'OB', lineStyle: 2, lineWidth: 1 },
        { price: 50, color: 'rgba(154,164,178,0.4)', title: '', lineStyle: 1, lineWidth: 1 },
        { price: oversold, color: 'rgba(38,166,154,0.6)', title: 'OS', lineStyle: 2, lineWidth: 1 },
      ],
    };
  },
};

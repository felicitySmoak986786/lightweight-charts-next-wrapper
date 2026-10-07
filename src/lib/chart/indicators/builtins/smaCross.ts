import type { IndicatorDefinition, IndicatorSignal } from '../types';
import { toPlot } from './helpers';

/**
 * Example signal indicator: fast/slow SMA crossover that also emits buy/sell
 * markers. Demonstrates how an indicator can drive chart markers.
 */
export const smaCrossIndicator: IndicatorDefinition = {
  id: 'smaCross',
  name: 'SMA Cross Signals',
  description: 'Fast/slow SMA crossover with buy & sell markers',
  overlay: true,
  params: [
    { name: 'fast', label: 'Fast', type: 'number', default: 9, min: 1, max: 200, step: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 21, min: 2, max: 400, step: 1 },
  ],
  compute({ candles, params, utils }) {
    const closes = candles.map((candle) => candle.close);
    const fast = utils.sma(closes, Number(params.fast));
    const slow = utils.sma(closes, Number(params.slow));

    const crossUp = utils.crossover(fast, slow);
    const crossDown = utils.crossover(slow, fast);

    const signals: IndicatorSignal[] = [];
    for (let i = 0; i < candles.length; i += 1) {
      if (crossUp[i]) signals.push({ time: candles[i].time, kind: 'buy', price: candles[i].low, text: 'Buy' });
      else if (crossDown[i]) signals.push({ time: candles[i].time, kind: 'sell', price: candles[i].high, text: 'Sell' });
    }

    return {
      plots: [
        { id: 'fast', type: 'line', data: toPlot(candles, fast, '#26a69a'), options: { lineWidth: 1, priceLineVisible: false, lastValueVisible: false } },
        { id: 'slow', type: 'line', data: toPlot(candles, slow, '#ef5350'), options: { lineWidth: 1, priceLineVisible: false, lastValueVisible: false } },
      ],
      signals,
    };
  },
};

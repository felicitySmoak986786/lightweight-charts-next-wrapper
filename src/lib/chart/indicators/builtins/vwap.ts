import type { IndicatorDefinition } from '../types';
import type { Candle } from '../../types';
import { toPlot } from './helpers';

/**
 * Volume Weighted Average Price, anchored to each UTC session and reset at the
 * start of a new day.
 */
export const vwapIndicator: IndicatorDefinition = {
  id: 'vwap',
  name: 'VWAP',
  description: 'Session-anchored Volume Weighted Average Price',
  overlay: true,
  params: [{ name: 'color', label: 'Color', type: 'string', default: '#e91e63' }],
  compute({ candles, params }) {
    const values: Array<number | undefined> = new Array(candles.length).fill(undefined);
    let sessionKey = '';
    let cumulativePV = 0;
    let cumulativeVolume = 0;

    candles.forEach((candle: Candle, index: number) => {
      const key = new Date(candle.time * 1000).toISOString().slice(0, 10);
      if (key !== sessionKey) {
        sessionKey = key;
        cumulativePV = 0;
        cumulativeVolume = 0;
      }
      const volume = candle.volume ?? 1;
      const typical = (candle.high + candle.low + candle.close) / 3;
      cumulativePV += typical * volume;
      cumulativeVolume += volume;
      values[index] = cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : undefined;
    });

    return {
      plots: [
        {
          id: 'vwap',
          type: 'line',
          data: toPlot(candles, values, String(params.color)),
          options: { lineWidth: 2, priceLineVisible: false, lastValueVisible: true },
        },
      ],
    };
  },
};

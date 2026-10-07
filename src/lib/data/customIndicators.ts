import { defineIndicator, type IndicatorDefinition } from '@/lib/chart';

/**
 * Example custom TypeScript indicator authored against the public API.
 *
 * This is exactly the shape that `TsIndicatorRuntime.loadFromUrl` expects: an
 * ES module whose default export (or `indicator` named export) is an
 * `IndicatorDefinition` created with `defineIndicator`.
 */
export const donchianIndicator: IndicatorDefinition = defineIndicator({
  id: 'donchian',
  name: 'Donchian Channel',
  description: 'Highest high / lowest low channel over N bars',
  overlay: true,
  params: [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 2, max: 400, step: 1 },
    { name: 'color', label: 'Color', type: 'string', default: '#00bcd4' },
  ],
  compute({ candles, params, utils }) {
    const highs = candles.map((candle) => candle.high);
    const lows = candles.map((candle) => candle.low);
    const upper = utils.highest(highs, Number(params.period));
    const lower = utils.lowest(lows, Number(params.period));
    const middle = candles.map((_, index) => {
      const u = upper[index];
      const l = lower[index];
      return u === undefined || l === undefined ? undefined : (u + l) / 2;
    });

    const points = (values: Array<number | undefined>) =>
      candles
        .map((candle, index) => ({ time: candle.time, value: values[index] }))
        .filter((point): point is { time: number; value: number } => point.value !== undefined);

    const color = String(params.color);
    return {
      plots: [
        { id: 'upper', type: 'line', data: points(upper), options: { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false } },
        { id: 'middle', type: 'line', data: points(middle), options: { color, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false } },
        { id: 'lower', type: 'line', data: points(lower), options: { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false } },
      ],
    };
  },
});

export const customIndicators: IndicatorDefinition[] = [donchianIndicator];

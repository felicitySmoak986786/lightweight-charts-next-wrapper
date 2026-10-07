import type { IndicatorDefinition } from './types';
import { smaIndicator } from './builtins/sma';
import { emaIndicator } from './builtins/ema';
import { bollingerIndicator } from './builtins/bollinger';
import { vwapIndicator } from './builtins/vwap';
import { rsiIndicator } from './builtins/rsi';
import { macdIndicator } from './builtins/macd';
import { smaCrossIndicator } from './builtins/smaCross';

export const builtinIndicators: IndicatorDefinition[] = [
  smaIndicator,
  emaIndicator,
  bollingerIndicator,
  vwapIndicator,
  rsiIndicator,
  macdIndicator,
  smaCrossIndicator,
];

export function createIndicatorRegistry(): Map<string, IndicatorDefinition> {
  const registry = new Map<string, IndicatorDefinition>();
  for (const indicator of builtinIndicators) registry.set(indicator.id, indicator);
  return registry;
}

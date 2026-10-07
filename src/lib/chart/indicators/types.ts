import type { Candle, UnixTime } from '../types';

export type IndicatorParamType = 'number' | 'string' | 'boolean' | 'select';
export type IndicatorParamValue = number | string | boolean;

export interface IndicatorParamSpec {
  name: string;
  label: string;
  type: IndicatorParamType;
  default: IndicatorParamValue;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string }>;
}

export interface PlotPoint {
  time: UnixTime;
  value: number;
  color?: string;
}

export type PlotType = 'line' | 'histogram' | 'area' | 'baseline';

export interface IndicatorPlot {
  id: string;
  type: PlotType;
  data: PlotPoint[];
  options?: Record<string, unknown>;
}

export interface PriceLineSpec {
  price: number;
  color: string;
  title: string;
  lineStyle?: number;
  lineWidth?: number;
}

export type SignalKind = 'buy' | 'sell' | 'neutral';

export interface IndicatorSignal {
  time: UnixTime;
  kind: SignalKind;
  text?: string;
  price?: number;
}

export interface IndicatorResult {
  plots: IndicatorPlot[];
  signals?: IndicatorSignal[];
  priceLines?: PriceLineSpec[];
}

/** Indicator math helpers injected into every `compute` call. */
export interface IndicatorUtils {
  sma(values: number[], period: number): Array<number | undefined>;
  ema(values: number[], period: number): Array<number | undefined>;
  wma(values: number[], period: number): Array<number | undefined>;
  rma(values: number[], period: number): Array<number | undefined>;
  stdev(values: number[], period: number): Array<number | undefined>;
  highest(values: number[], period: number): Array<number | undefined>;
  lowest(values: number[], period: number): Array<number | undefined>;
  rsi(values: number[], period: number): Array<number | undefined>;
  atr(candles: Candle[], period: number): Array<number | undefined>;
  crossover(fast: Array<number | undefined>, slow: Array<number | undefined>): boolean[];
}

export interface IndicatorContext {
  candles: Candle[];
  params: Record<string, IndicatorParamValue>;
  utils: IndicatorUtils;
}

export interface IndicatorDefinition {
  /** Stable unique id, e.g. `sma`, `smaCross`. */
  id: string;
  name: string;
  description?: string;
  /** Overlay on the main pane (true) or render in a dedicated pane (false). */
  overlay: boolean;
  params: IndicatorParamSpec[];
  compute(context: IndicatorContext): IndicatorResult;
}

export interface IndicatorInstance {
  instanceId: string;
  definitionId: string;
  name: string;
  overlay: boolean;
  params: Record<string, IndicatorParamValue>;
  paneIndex: number;
}

export function paramDefaults(params: IndicatorParamSpec[]): Record<string, IndicatorParamValue> {
  const result: Record<string, IndicatorParamValue> = {};
  for (const param of params) result[param.name] = param.default;
  return result;
}

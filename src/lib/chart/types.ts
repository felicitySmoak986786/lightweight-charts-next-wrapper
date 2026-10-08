/**
 * Public type definitions for the lightweight-charts wrapper.
 *
 * The public API deliberately treats time as a UNIX timestamp in **seconds**
 * (`number`) to keep the surface simple. Values are cast to lightweight-charts'
 * branded `UTCTimestamp` internally.
 */
import type {
  CandlestickData,
  CrosshairMode,
  DeepPartial,
  LineData,
  HistogramData,
  SeriesMarker,
  Time,
} from 'lightweight-charts';

/** Canonical time used across the public API: UNIX timestamp in seconds. */
export type UnixTime = number;

export interface Candle {
  time: UnixTime;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Optional volume, used by the default volume histogram. */
  volume?: number;
}

/** A point in chart data-space (used by drawings and markers). */
export interface DataPoint {
  time: UnixTime;
  price: number;
  /**
   * Fractional bar (logical) index. When present it is the source of truth for
   * the horizontal position, enabling smooth, bar-snapping-free placement. When
   * absent the renderer falls back to `time`.
   */
  logical?: number;
}

export interface ThemeOptions {
  background?: string;
  textColor?: string;
  gridColor?: string;
  borderColor?: string;
  upColor?: string;
  downColor?: string;
  crosshairColor?: string;
}

export interface ChartWrapperOptions {
  /** Initial candle data. Ignored when data is supplied later via the API. */
  data?: Candle[];
  theme?: ThemeOptions;
  /** Show the volume histogram under the candles (default true). */
  showVolume?: boolean;
  /** Default price format configuration. */
  priceFormat?: { precision?: number; minMove?: number };
  /** Enable price/time axis auto-sizing (default true). */
  autoSize?: boolean;
  /** lightweight-charts crosshair mode. */
  crosshairMode?: CrosshairMode;
  /** Locale used by the built-in axis formatters. */
  locale?: string;
  /** Extra chart options merged last (escape hatch). */
  chartOptions?: DeepPartial<import('lightweight-charts').ChartOptions>;
}

export type {
  CandlestickData,
  LineData,
  HistogramData,
  SeriesMarker,
  Time,
};

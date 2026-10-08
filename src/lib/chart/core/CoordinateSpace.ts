import type { IChartApi, ISeriesApi, SeriesType, Time, UTCTimestamp } from 'lightweight-charts';
import type { DataPoint, UnixTime } from '../types';

/**
 * Translates between drawing data-space (`{ time, price }`) and pixel-space
 * coordinates relative to the chart container.
 *
 * The overlay canvas is positioned at the top-left of the chart container, so
 * pixel-x maps directly to the time-scale coordinate and pixel-y maps to the
 * main pane's price coordinate. The series reference is resolved lazily so it
 * keeps working when the primary series is swapped (chart type changes).
 */
export class CoordinateSpace {
  constructor(
    private readonly chart: IChartApi,
    private readonly getSeries: () => ISeriesApi<SeriesType>,
    private readonly container: HTMLElement,
  ) {}

  get width(): number {
    return this.container.clientWidth;
  }

  get height(): number {
    return this.container.clientHeight;
  }

  /** Data-space -> pixel X. Returns null while the time is outside the scale. */
  timeToX(time: UnixTime): number | null {
    const coordinate = this.chart.timeScale().timeToCoordinate(time as UTCTimestamp);
    return coordinate === null ? null : (coordinate as number);
  }

  /** Fractional bar index -> pixel X (continuous, works between/outside bars). */
  logicalToX(logical: number): number | null {
    const coordinate = this.chart.timeScale().logicalToCoordinate(logical as never);
    return coordinate === null ? null : (coordinate as number);
  }

  /** Pixel X -> fractional bar index. Continuous, unlike `xToTime`. */
  xToLogical(x: number): number | null {
    const logical = this.chart.timeScale().coordinateToLogical(x as never);
    return logical === null ? null : (logical as number);
  }

  /** Pixel X -> data-space time (seconds). */
  xToTime(x: number): UnixTime | null {
    const time = this.chart.timeScale().coordinateToTime(x as never);
    if (time === null || time === undefined) return null;
    if (typeof time === 'number') return time;
    if (typeof time === 'string') {
      const parsed = Date.parse(time);
      return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
    }
    // BusinessDay object.
    const { year, month, day } = time as { year: number; month: number; day: number };
    return Math.floor(Date.UTC(year, month - 1, day) / 1000);
  }

  /** Data-space price -> pixel Y. */
  priceToY(price: number): number | null {
    const coordinate = this.getSeries().priceToCoordinate(price);
    return coordinate === null ? null : (coordinate as number);
  }

  /** Pixel Y -> data-space price. */
  yToPrice(y: number): number | null {
    const price = this.getSeries().coordinateToPrice(y as never);
    return price === null ? null : (price as number);
  }

  /** Convert a pixel coordinate into a data point. Returns null for gaps. */
  pixelToData(x: number, y: number): DataPoint | null {
    const time = this.xToTime(x);
    const price = this.yToPrice(y);
    const logical = this.xToLogical(x);
    if (time === null || price === null) return null;
    return { time, price, logical: logical ?? undefined };
  }

  /** Snap an arbitrary bar-space time to the nearest data timestamp. */
  snapTime(time: UnixTime, candles: readonly { time: UnixTime }[]): UnixTime {
    if (candles.length === 0) return time;
    let closest = candles[0].time;
    let best = Math.abs(closest - time);
    for (let i = 1; i < candles.length; i += 1) {
      const diff = Math.abs(candles[i].time - time);
      if (diff < best) {
        best = diff;
        closest = candles[i].time;
      }
    }
    return closest;
  }

  toChartTime(time: UnixTime): Time {
    return time as UTCTimestamp;
  }
}

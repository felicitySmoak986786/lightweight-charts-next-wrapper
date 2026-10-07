import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type AreaData,
  type BarData,
  type CandlestickData,
  type DeepPartial,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type MouseEventParams,
  type SeriesType,
  type TimeChartOptions,
  type UTCTimestamp,
} from 'lightweight-charts';
import { EventBus } from './EventBus';
import type { Candle, ChartWrapperOptions } from '../types';

export type ChartType = 'candlestick' | 'bar' | 'line' | 'area';

export interface ChartEngineEvents {
  resize: { width: number; height: number };
  visibleRangeChange: void;
  crosshairMove: MouseEventParams<unknown>;
  click: MouseEventParams<unknown>;
  /** Emitted when the primary series is replaced (chart type change). */
  mainSeries: ISeriesApi<SeriesType>;
}

export const DEFAULT_THEME = {
  background: '#ffffff',
  textColor: '#5d606b',
  gridColor: '#f0f3fa',
  borderColor: '#e0e3eb',
  upColor: '#089981',
  downColor: '#f23645',
  crosshairColor: '#9598a1',
};

export type EngineTheme = typeof DEFAULT_THEME;

/**
 * Owns the lightweight-charts instance and the primary series (candles + optional
 * volume). The primary series can be swapped between candlestick, bar, line and
 * area without tearing down the chart.
 */
export class ChartEngine extends EventBus<ChartEngineEvents> {
  readonly chart: IChartApi;
  private series: ISeriesApi<SeriesType>;
  private volumeSeries?: ISeriesApi<'Histogram'>;
  private lastPriceLine: IPriceLine;
  private chartType: ChartType = 'candlestick';
  private theme: EngineTheme;
  private readonly options: ChartWrapperOptions;
  private lastPrice = 0;
  private lastCandle: Candle | null = null;
  private readonly resizeObserver: ResizeObserver;
  private disposed = false;

  constructor(
    readonly container: HTMLElement,
    options: ChartWrapperOptions = {},
  ) {
    super();
    this.options = options;
    this.theme = { ...DEFAULT_THEME, ...(options.theme ?? {}) };

    const chartOptions: DeepPartial<TimeChartOptions> = {
      autoSize: options.autoSize ?? true,
      layout: {
        background: { type: ColorType.Solid, color: this.theme.background },
        textColor: this.theme.textColor,
        attributionLogo: false,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: this.theme.gridColor },
        horzLines: { color: this.theme.gridColor },
      },
      rightPriceScale: { borderColor: this.theme.borderColor, entireTextOnly: true },
      timeScale: {
        borderColor: this.theme.borderColor,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 8,
      },
      crosshair: {
        mode: options.crosshairMode ?? CrosshairMode.Magnet,
        vertLine: { color: this.theme.crosshairColor, width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#363a45' },
        horzLine: { color: this.theme.crosshairColor, width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#363a45' },
      },
      localization: options.locale ? { locale: options.locale } : undefined,
      ...(options.chartOptions ?? {}),
    };

    this.chart = createChart(container, chartOptions);
    this.series = this.createMainSeries(this.chartType);
    this.resizeObserver = new ResizeObserver(() => {
      this.emit('resize', { width: this.container.clientWidth, height: this.container.clientHeight });
    });

    if (options.showVolume ?? true) {
      this.volumeSeries = this.chart.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
          color: 'rgba(8, 153, 129, 0.35)',
          lastValueVisible: false,
          priceLineVisible: false,
        },
        0,
      );
      this.chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    }

    this.lastPriceLine = this.createLastPriceLine();
    this.bindChartEvents();
    this.resizeObserver.observe(container);
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  /** The current primary price series (any supported type). */
  get mainSeries(): ISeriesApi<SeriesType> {
    return this.series;
  }

  /** Backwards-compatible alias used by the coordinate space. */
  get candles(): ISeriesApi<SeriesType> {
    return this.series;
  }

  get volume(): ISeriesApi<'Histogram'> | undefined {
    return this.volumeSeries;
  }

  get type(): ChartType {
    return this.chartType;
  }

  // ---------------------------------------------------------------------------
  // Series lifecycle
  // ---------------------------------------------------------------------------

  private seriesOptions(type: ChartType): Record<string, unknown> {
    const priceFormat = {
      type: 'price' as const,
      precision: this.options.priceFormat?.precision ?? 2,
      minMove: this.options.priceFormat?.minMove ?? 0.01,
    };
    switch (type) {
      case 'bar':
        return { upColor: this.theme.upColor, downColor: this.theme.downColor, priceFormat, thinBars: false };
      case 'line':
        return { color: '#1677ff', lineWidth: 2, priceFormat, priceLineVisible: true, lastValueVisible: true };
      case 'area':
        return {
          lineColor: '#1677ff',
          topColor: 'rgba(22, 119, 255, 0.35)',
          bottomColor: 'rgba(22, 119, 255, 0.02)',
          lineWidth: 2,
          priceFormat,
          priceLineVisible: true,
          lastValueVisible: true,
        };
      case 'candlestick':
      default:
        return {
          upColor: this.theme.upColor,
          downColor: this.theme.downColor,
          borderVisible: false,
          wickUpColor: this.theme.upColor,
          wickDownColor: this.theme.downColor,
          priceFormat,
        };
    }
  }

  private createMainSeries(type: ChartType): ISeriesApi<SeriesType> {
    const seriesOptions = this.seriesOptions(type) as never;
    switch (type) {
      case 'bar':
        return this.chart.addSeries(BarSeries, seriesOptions) as ISeriesApi<SeriesType>;
      case 'line':
        return this.chart.addSeries(LineSeries, seriesOptions) as ISeriesApi<SeriesType>;
      case 'area':
        return this.chart.addSeries(AreaSeries, seriesOptions) as ISeriesApi<SeriesType>;
      case 'candlestick':
      default:
        return this.chart.addSeries(CandlestickSeries, seriesOptions) as ISeriesApi<SeriesType>;
    }
  }

  private createLastPriceLine(): IPriceLine {
    return this.series.createPriceLine({
      price: this.lastPrice,
      color: this.theme.textColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: 'last',
      lineVisible: this.lastCandle !== null,
    });
  }

  /**
   * Swap the primary series type. Callers are expected to re-apply data through
   * `setCandleData` (the facade does this automatically).
   */
  setChartType(type: ChartType): void {
    if (type === this.chartType) return;
    this.chartType = type;
    try {
      this.chart.removeSeries(this.series);
    } catch {
      // Ignore if the series was already detached.
    }
    this.series = this.createMainSeries(type);
    this.lastPriceLine = this.createLastPriceLine();
    this.emit('mainSeries', this.series);
  }

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  setCandleData(candles: Candle[]): void {
    if (this.chartType === 'line' || this.chartType === 'area') {
      const data = candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        value: candle.close,
      })) as Array<LineData | AreaData>;
      this.series.setData(data as never);
    } else if (this.chartType === 'bar') {
      const data: BarData[] = candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));
      this.series.setData(data as never);
    } else {
      const data: CandlestickData[] = candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));
      this.series.setData(data as never);
    }

    if (this.volumeSeries) {
      this.volumeSeries.setData(
        candles
          .filter((candle) => candle.volume !== undefined)
          .map((candle) => ({
            time: candle.time as UTCTimestamp,
            value: candle.volume ?? 0,
            color: candle.close >= candle.open ? 'rgba(8, 153, 129, 0.35)' : 'rgba(242, 54, 69, 0.35)',
          })),
      );
    }
  }

  updateCandle(candle: Candle): void {
    this.lastCandle = candle;
    if (this.chartType === 'line' || this.chartType === 'area') {
      this.series.update({ time: candle.time as UTCTimestamp, value: candle.close } as never);
    } else if (this.chartType === 'bar') {
      this.series.update({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      } as never);
    } else {
      this.series.update({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      } as never);
    }
    if (this.volumeSeries && candle.volume !== undefined) {
      this.volumeSeries.update({
        time: candle.time as UTCTimestamp,
        value: candle.volume,
        color: candle.close >= candle.open ? 'rgba(8, 153, 129, 0.35)' : 'rgba(242, 54, 69, 0.35)',
      });
    }
  }

  updateLastPrice(price: number): void {
    this.lastPrice = price;
    this.lastPriceLine.applyOptions({ price, lineVisible: true });
  }

  setLastPriceVisible(visible: boolean): void {
    this.lastPriceLine.applyOptions({ lineVisible: visible });
  }

  fitContent(): void {
    this.chart.timeScale().fitContent();
  }

  // ---------------------------------------------------------------------------
  // Theming
  // ---------------------------------------------------------------------------

  applyTheme(theme: Partial<EngineTheme>): void {
    this.theme = { ...this.theme, ...theme };
    this.chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: this.theme.background },
        textColor: this.theme.textColor,
      },
      grid: {
        vertLines: { color: this.theme.gridColor },
        horzLines: { color: this.theme.gridColor },
      },
      rightPriceScale: { borderColor: this.theme.borderColor },
      timeScale: { borderColor: this.theme.borderColor },
      crosshair: {
        vertLine: { color: this.theme.crosshairColor },
        horzLine: { color: this.theme.crosshairColor },
      },
    });

    if (this.chartType === 'candlestick' || this.chartType === 'bar') {
      this.series.applyOptions({
        upColor: this.theme.upColor,
        downColor: this.theme.downColor,
        wickUpColor: this.theme.upColor,
        wickDownColor: this.theme.downColor,
        borderUpColor: this.theme.upColor,
        borderDownColor: this.theme.downColor,
      } as never);
    }
    this.lastPriceLine.applyOptions({ color: this.theme.textColor });
  }

  priceToY(price: number): number | null {
    const y = this.series.priceToCoordinate(price);
    return y === null ? null : (y as number);
  }

  getTheme(): EngineTheme {
    return { ...this.theme };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private bindChartEvents(): void {
    const onRange = () => this.emit('visibleRangeChange', undefined);
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);

    const onCrosshair = (param: MouseEventParams<unknown>) => this.emit('crosshairMove', param);
    this.chart.subscribeCrosshairMove(onCrosshair);

    const onClick = (param: MouseEventParams<unknown>) => this.emit('click', param);
    this.chart.subscribeClick(onClick);
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver.disconnect();
    this.clear();
    this.chart.remove();
  }
}

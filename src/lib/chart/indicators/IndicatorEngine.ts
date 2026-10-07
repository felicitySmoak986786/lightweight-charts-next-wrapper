import {
  AreaSeries,
  BaselineSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type IPaneApi,
  type IPriceLine,
  type ISeriesApi,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { EventBus } from '../core/EventBus';
import { indicatorUtils } from './math';
import { createIndicatorRegistry } from './registry';
import type {
  IndicatorDefinition,
  IndicatorInstance,
  IndicatorParamValue,
  IndicatorResult,
  IndicatorSignal,
  PlotPoint,
  IndicatorPlot,
} from './types';
import { paramDefaults } from './types';
import type { Candle } from '../types';

export interface IndicatorEngineEvents {
  change: IndicatorInstance[];
  signals: IndicatorSignal[];
}

interface InstanceRecord {
  definition: IndicatorDefinition;
  params: Record<string, IndicatorParamValue>;
  /** Dedicated pane for non-overlay indicators; null for overlays. */
  pane: IPaneApi<Time> | null;
  series: Map<string, ISeriesApi<SeriesType>>;
  priceLines: IPriceLine[];
  signals: IndicatorSignal[];
}

let instanceCounter = 0;

/**
 * Computes and renders indicators. Overlay indicators share the price pane;
 * non-overlay indicators are placed in dedicated panes. Recomputes
 * automatically as data (including replay cursor) changes.
 */
export class IndicatorEngine extends EventBus<IndicatorEngineEvents> {
  private readonly registry: Map<string, IndicatorDefinition>;
  private readonly records = new Map<string, InstanceRecord>();
  private lastSignals: IndicatorSignal[] = [];

  constructor(
    private readonly chart: IChartApi,
    private readonly getCandles: () => Candle[],
  ) {
    super();
    this.registry = createIndicatorRegistry();
  }

  /** Register a custom indicator (TypeScript or loaded from C#/WASM). */
  register(definition: IndicatorDefinition): void {
    if (!definition?.id) throw new Error('Indicator definition requires an id');
    this.registry.set(definition.id, definition);
  }

  has(definitionId: string): boolean {
    return this.registry.has(definitionId);
  }

  listDefinitions(): IndicatorDefinition[] {
    return Array.from(this.registry.values());
  }

  getDefinition(definitionId: string): IndicatorDefinition | undefined {
    return this.registry.get(definitionId);
  }

  list(): IndicatorInstance[] {
    return Array.from(this.records.entries()).map(([instanceId, record]) => ({
      instanceId,
      definitionId: record.definition.id,
      name: record.definition.name,
      overlay: record.definition.overlay,
      params: { ...record.params },
      paneIndex: record.pane?.paneIndex() ?? 0,
    }));
  }

  create(definitionId: string, params: Record<string, IndicatorParamValue> = {}): IndicatorInstance {
    const definition = this.registry.get(definitionId);
    if (!definition) throw new Error(`Unknown indicator: ${definitionId}`);

    instanceCounter += 1;
    const instanceId = `ind_${definitionId}_${instanceCounter}`;
    const merged = { ...paramDefaults(definition.params), ...params };

    const pane = definition.overlay ? null : this.chart.addPane();
    const paneIndex = pane?.paneIndex() ?? 0;
    const record: InstanceRecord = {
      definition,
      params: merged,
      pane,
      series: new Map(),
      priceLines: [],
      signals: [],
    };
    this.records.set(instanceId, record);
    this.recompute(instanceId);
    this.emitChange();
    return {
      instanceId,
      definitionId: definition.id,
      name: definition.name,
      overlay: definition.overlay,
      params: merged,
      paneIndex,
    };
  }

  remove(instanceId: string): boolean {
    const record = this.records.get(instanceId);
    if (!record) return false;
    this.disposeRecord(record);
    this.records.delete(instanceId);
    this.recomputeSignals();
    this.emitChange();
    return true;
  }

  removeAll(): void {
    for (const [, record] of this.records) this.disposeRecord(record);
    this.records.clear();
    this.recomputeSignals();
    this.emitChange();
  }

  setParams(instanceId: string, params: Record<string, IndicatorParamValue>): void {
    const record = this.records.get(instanceId);
    if (!record) return;
    record.params = { ...record.params, ...params };
    this.recompute(instanceId);
    this.emitChange();
  }

  /** Recompute every instance. Call after data or replay-cursor changes. */
  update(): void {
    for (const instanceId of this.records.keys()) this.recompute(instanceId);
  }

  private recompute(instanceId: string): void {
    const record = this.records.get(instanceId);
    if (!record) return;
    const candles = this.getCandles();
    if (candles.length === 0) return;

    const result: IndicatorResult = record.definition.compute({
      candles,
      params: record.params,
      utils: indicatorUtils,
    });

    // Remove series that no longer exist in the result.
    const nextIds = new Set(result.plots.map((plot) => plot.id));
    for (const [plotId, series] of record.series) {
      if (!nextIds.has(plotId)) {
        this.chart.removeSeries(series);
        record.series.delete(plotId);
      }
    }

    for (const plot of result.plots) {
      let series = record.series.get(plot.id);
      if (!series) {
        series = this.createSeries(plot, record.pane?.paneIndex() ?? 0);
        record.series.set(plot.id, series);
      }
      series.setData(plot.data.map((point) => this.toSeriesPoint(point)) as never);
    }

    // Price lines (levels) are recreated when the result changes.
    for (const line of record.priceLines) {
      // Remove from any series that owns it; lightweight-charts exposes no owner
      // so we walk the series map.
      for (const series of record.series.values()) {
        try {
          series.removePriceLine(line);
        } catch {
          // Line already detached.
        }
      }
    }
    record.priceLines = (result.priceLines ?? []).map((spec) => {
      const target = record.series.values().next().value as ISeriesApi<SeriesType> | undefined;
      if (!target) throw new Error('No series to attach price line');
      return target.createPriceLine({
        price: spec.price,
        color: spec.color,
        title: spec.title,
        lineWidth: (spec.lineWidth ?? 1) as never,
        lineStyle: (spec.lineStyle ?? LineStyle.Dashed) as never,
      });
    });

    record.signals = result.signals ?? [];
    this.recomputeSignals();
  }

  private recomputeSignals(): void {
    const signals: IndicatorSignal[] = [];
    for (const record of this.records.values()) signals.push(...record.signals);
    this.lastSignals = signals;
    this.emit('signals', signals);
  }

  get signals(): IndicatorSignal[] {
    return this.lastSignals;
  }

  private createSeries(plot: IndicatorPlot, paneIndex: number): ISeriesApi<SeriesType> {
    const options = { ...(plot.options ?? {}) } as Record<string, unknown>;
    switch (plot.type) {
      case 'histogram':
        return this.chart.addSeries(HistogramSeries, options as never, paneIndex) as ISeriesApi<SeriesType>;
      case 'area':
        return this.chart.addSeries(AreaSeries, options as never, paneIndex) as ISeriesApi<SeriesType>;
      case 'baseline':
        return this.chart.addSeries(BaselineSeries, options as never, paneIndex) as ISeriesApi<SeriesType>;
      case 'line':
      default:
        return this.chart.addSeries(LineSeries, options as never, paneIndex) as ISeriesApi<SeriesType>;
    }
  }

  private toSeriesPoint(point: PlotPoint): { time: UTCTimestamp; value: number; color?: string } {
    return { time: point.time as UTCTimestamp, value: point.value, color: point.color };
  }

  private disposeRecord(record: InstanceRecord): void {
    const paneIndex = record.pane?.paneIndex() ?? 0;
    for (const series of record.series.values()) {
      this.chart.removeSeries(series);
    }
    record.series.clear();
    if (record.pane) {
      try {
        this.chart.removePane(paneIndex);
      } catch {
        // Pane may already be gone; ignore.
      }
    }
  }

  private emitChange(): void {
    this.emit('change', this.list());
  }

  destroy(): void {
    this.removeAll();
    this.clear();
  }
}

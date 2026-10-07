import {
  LineStyle,
  createSeriesMarkers,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type IPriceLine,
  type SeriesMarker,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { EventBus } from '../core/EventBus';
import type { UnixTime } from '../types';
import type { IndicatorSignal, SignalKind } from '../indicators/types';

export interface SignalMarker {
  time: UnixTime;
  kind: SignalKind;
  text?: string;
  color?: string;
  shape?: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  size?: number;
}

export interface PriceMarker {
  id: string;
  price: number;
  color: string;
  title: string;
  lineStyle?: number;
  lineWidth?: number;
  axisLabelVisible?: boolean;
  lineVisible?: boolean;
}

export interface OrderLine extends PriceMarker {
  /** e.g. `BUY 2.5 @ 100.25` */
  label?: string;
}

export interface MarkerEvents {
  change: void;
}

const SIGNAL_STYLE: Record<
  SignalKind,
  { color: string; position: 'aboveBar' | 'belowBar'; shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square' }
> = {
  buy: { color: '#089981', position: 'belowBar', shape: 'arrowUp' },
  sell: { color: '#f23645', position: 'aboveBar', shape: 'arrowDown' },
  neutral: { color: '#787b86', position: 'aboveBar', shape: 'circle' },
};

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

/**
 * Central place for everything drawn on top of the candles: buy/sell signal
 * markers, persistent price markers and order/position lines. The manager can
 * re-bind to a new series (chart type switch) and reapply its state.
 */
export class MarkerManager extends EventBus<MarkerEvents> {
  private plugin: ISeriesMarkersPluginApi<Time>;
  private readonly priceLines = new Map<string, IPriceLine>();
  private readonly priceSpecs = new Map<string, PriceMarker & { label?: string; order?: boolean }>();
  private readonly signalSources = new Map<string, SignalMarker[]>();
  private userSignals: SignalMarker[] = [];

  constructor(private series: ISeriesApi<SeriesType>) {
    super();
    this.plugin = createSeriesMarkers(this.series, []);
  }

  /** Attach to a new primary series and restore all markers/price lines. */
  rebind(series: ISeriesApi<SeriesType>): void {
    this.plugin.setMarkers([]);
    this.priceLines.clear();
    this.series = series;
    this.plugin = createSeriesMarkers(this.series, []);

    for (const [id, spec] of this.priceSpecs) {
      const line = this.series.createPriceLine({
        price: spec.price,
        color: spec.color,
        title: spec.title,
        lineWidth: (spec.lineWidth ?? 1) as never,
        lineStyle: (spec.lineStyle ?? LineStyle.Solid) as never,
        axisLabelVisible: spec.axisLabelVisible ?? true,
        lineVisible: spec.lineVisible ?? true,
      });
      this.priceLines.set(id, line);
    }
    this.refreshMarkers();
  }

  /** Replace the buy/sell markers owned by a named source (e.g. an indicator). */
  setSignals(source: string, signals: SignalMarker[]): void {
    this.signalSources.set(source, signals);
    this.refreshMarkers();
  }

  clearSignals(source: string): void {
    this.signalSources.delete(source);
    this.refreshMarkers();
  }

  /** Replace user-authored buy/sell markers. */
  setUserSignals(signals: SignalMarker[]): void {
    this.userSignals = signals;
    this.refreshMarkers();
  }

  /** Append a single user-authored marker, leaving indicator signals untouched. */
  addUserSignal(signal: SignalMarker): void {
    this.userSignals = [...this.userSignals, signal];
    this.refreshMarkers();
  }

  getSignals(): SignalMarker[] {
    const all = [...this.userSignals];
    for (const list of this.signalSources.values()) all.push(...list);
    return all.sort((a, b) => a.time - b.time);
  }

  /** Direct access to the lightweight-charts markers plugin. */
  setRawMarkers(markers: SeriesMarker<Time>[]): void {
    this.plugin.setMarkers(markers);
    this.emit('change', undefined);
  }

  // ---------------------------------------------------------------------------
  // Price lines / order lines
  // ---------------------------------------------------------------------------

  addPriceMarker(
    marker: Omit<Partial<PriceMarker>, 'id'> & { price: number; color: string; title: string } & { id?: string },
  ): string {
    const id = marker.id ?? nextId('pm');
    this.priceSpecs.set(id, { ...marker, id } as PriceMarker);
    this.upsertPriceLine(id, this.priceSpecs.get(id)!);
    return id;
  }

  addOrderLine(order: Omit<OrderLine, 'id'> & { id?: string }): string {
    const id = order.id ?? nextId('order');
    const title = order.label ? `${order.label} ${order.title ?? ''}`.trim() : order.title;
    this.priceSpecs.set(id, {
      ...order,
      id,
      title,
      order: true,
      lineWidth: order.lineWidth ?? 2,
      lineStyle: order.lineStyle ?? LineStyle.Dashed,
      axisLabelVisible: order.axisLabelVisible ?? true,
    });
    this.upsertPriceLine(id, this.priceSpecs.get(id)!);
    return id;
  }

  updatePriceMarker(id: string, patch: Partial<PriceMarker>): void {
    const spec = this.priceSpecs.get(id);
    if (!spec) return;
    const next = { ...spec, ...patch };
    this.priceSpecs.set(id, next);
    this.upsertPriceLine(id, next);
  }

  removeMarker(id: string): boolean {
    const line = this.priceLines.get(id);
    if (line) {
      this.series.removePriceLine(line);
      this.priceLines.delete(id);
    }
    const existed = this.priceSpecs.delete(id);
    if (existed) this.emit('change', undefined);
    return existed;
  }

  clearMarkers(): void {
    for (const line of this.priceLines.values()) this.series.removePriceLine(line);
    this.priceLines.clear();
    this.priceSpecs.clear();
    this.emit('change', undefined);
  }

  listMarkers(): string[] {
    return Array.from(this.priceSpecs.keys());
  }

  getPriceSpecs(): PriceMarker[] {
    return Array.from(this.priceSpecs.values());
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private upsertPriceLine(id: string, marker: PriceMarker & { label?: string }): void {
    const existing = this.priceLines.get(id);
    if (existing) {
      existing.applyOptions({
        price: marker.price,
        color: marker.color,
        title: marker.title,
        lineWidth: marker.lineWidth as never,
        lineStyle: marker.lineStyle as never,
        axisLabelVisible: marker.axisLabelVisible,
        lineVisible: marker.lineVisible,
      });
    } else {
      const line = this.series.createPriceLine({
        price: marker.price,
        color: marker.color,
        title: marker.title,
        lineWidth: (marker.lineWidth ?? 1) as never,
        lineStyle: (marker.lineStyle ?? LineStyle.Solid) as never,
        axisLabelVisible: marker.axisLabelVisible ?? true,
        lineVisible: marker.lineVisible ?? true,
      });
      this.priceLines.set(id, line);
    }
    this.emit('change', undefined);
  }

  private refreshMarkers(): void {
    const markers = this.getSignals().map((signal) => this.toSeriesMarker(signal));
    this.plugin.setMarkers(markers as never);
    this.emit('change', undefined);
  }

  private toSeriesMarker(signal: SignalMarker): SeriesMarker<Time> {
    const style = SIGNAL_STYLE[signal.kind];
    return {
      time: signal.time as UTCTimestamp,
      position: style.position,
      shape: signal.shape ?? style.shape,
      color: signal.color ?? style.color,
      text: signal.text,
      size: signal.size ?? 1,
    } as SeriesMarker<Time>;
  }

  /** Convert indicator signals into marker inputs for `setSignals`. */
  static fromIndicatorSignals(signals: IndicatorSignal[]): SignalMarker[] {
    return signals.map((signal) => ({
      time: signal.time,
      kind: signal.kind,
      text: signal.text,
    }));
  }

  destroy(): void {
    this.clearMarkers();
    this.plugin.setMarkers([]);
    this.clear();
  }
}

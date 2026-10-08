import { EventBus } from './core/EventBus';
import { ChartEngine, type ChartType } from './core/ChartEngine';
import { CoordinateSpace } from './core/CoordinateSpace';
import { DataStore } from './core/DataStore';
import type { MouseEventParams } from 'lightweight-charts';
import { DrawingManager } from './drawings/DrawingManager';
import { DrawingLayer, type DrawingLayerOptions } from './drawings/DrawingLayer';
import type { Drawing, DrawingStyle, DrawingTool, DrawingType } from './drawings/types';
import { IndicatorEngine } from './indicators/IndicatorEngine';
import type { IndicatorDefinition, IndicatorInstance, IndicatorParamValue } from './indicators/types';
import { TsIndicatorRuntime } from './indicators/runtime/TsIndicatorRuntime';
import { CsIndicatorBridge, type CsIndicatorMetadata } from './indicators/runtime/CsIndicatorBridge';
import { MarkerManager, type OrderLine, type PriceMarker, type SignalMarker } from './markers/MarkerManager';
import { ReplayController, type ReplayState } from './replay/ReplayController';
import type { Candle, ChartWrapperOptions, DataPoint } from './types';

export interface ChartClientEvents {
  ready: void;
  data: Candle[];
  drawings: Drawing[];
  selection: Drawing | null;
  tool: DrawingType | 'select' | null;
  replay: ReplayState;
  indicators: IndicatorInstance[];
  markers: void;
  chartType: ChartType;
  crosshair: MouseEventParams<unknown>;
  destroyed: void;
}

export interface SignalInput {
  time: number;
  kind: 'buy' | 'sell' | 'neutral';
  text?: string;
  color?: string;
  shape?: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  size?: number;
}

/**
 * High-level, framework-agnostic facade. A single `ChartClient` owns the chart,
 * drawings, indicators, markers and replay controller and exposes a small,
 * composable API that is easy to embed in any UI.
 */
export class ChartClient extends EventBus<ChartClientEvents> {
  readonly engine: ChartEngine;
  readonly store: DataStore;
  readonly space: CoordinateSpace;
  readonly drawings: DrawingManager;
  readonly drawingLayer: DrawingLayer;
  readonly indicators: IndicatorEngine;
  readonly markers: MarkerManager;
  readonly replay: ReplayController;
  readonly tsIndicators = new TsIndicatorRuntime();
  readonly csIndicators = new CsIndicatorBridge();

  private readonly teardown: Array<() => void> = [];
  private destroyed = false;

  constructor(container: HTMLElement, options: ChartWrapperOptions & DrawingLayerOptions = {}) {
    super();
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    this.engine = new ChartEngine(container, options);
    this.store = new DataStore();
    this.space = new CoordinateSpace(this.engine.chart, () => this.engine.mainSeries, container);
    this.drawings = new DrawingManager();
    this.indicators = new IndicatorEngine(this.engine.chart, () => this.store.revealed());
    this.markers = new MarkerManager(this.engine.candles);
    this.replay = new ReplayController(this.engine, this.store);
    this.drawingLayer = new DrawingLayer(container, this.space, this.engine, this.store, this.drawings, options);

    this.wire();
    if (options.data) this.setData(options.data);
    queueMicrotask(() => this.emit('ready', undefined));
  }

  private wire(): void {
    this.teardown.push(
      this.store.on('data', () => {
        const candles = [...this.store.all()];
        this.engine.setCandleData(candles);
        const last = candles[candles.length - 1];
        if (last) this.engine.updateLastPrice(last.close);
        this.indicators.update();
        this.emit('data', candles);
      }),
      this.store.on('cursor', () => {
        this.indicators.update();
      }),
      this.indicators.on('change', (instances) => this.emit('indicators', instances)),
      this.indicators.on('signals', (signals) => {
        this.markers.setSignals('__indicators__', MarkerManager.fromIndicatorSignals(signals));
      }),
      this.drawings.on('change', (drawings) => this.emit('drawings', drawings)),
      this.drawings.on('selection', (drawing) => this.emit('selection', drawing)),
      this.drawings.on('tool', (tool) => this.emit('tool', tool)),
      this.markers.on('change', () => this.emit('markers', undefined)),
      this.replay.on('state', (state) => this.emit('replay', state)),
      this.engine.on('mainSeries', (series) => this.markers.rebind(series)),
      this.engine.on('crosshairMove', (param) => this.emit('crosshair', param)),
    );
  }

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  setData(candles: Candle[]): void {
    this.store.setData(candles);
    this.engine.fitContent();
  }

  /** Stream a single bar; replaces the current bar if the time matches. */
  update(candle: Candle): void {
    this.store.upsert(candle);
  }

  fitContent(): void {
    this.engine.fitContent();
  }

  get chartType(): ChartType {
    return this.engine.type;
  }

  /** Switch the primary series type and re-apply the current dataset. */
  setChartType(type: ChartType): void {
    if (type === this.engine.type) return;
    this.engine.setChartType(type);
    const candles = this.replay.isActive ? this.store.revealed() : [...this.store.all()];
    this.engine.setCandleData(candles);
    const last = candles[candles.length - 1];
    if (last) this.engine.updateLastPrice(last.close);
    this.indicators.update();
    this.emit('chartType', type);
  }

  // ---------------------------------------------------------------------------
  // Drawings
  // ---------------------------------------------------------------------------

  setTool(tool: DrawingType | 'select' | null): void {
    this.drawings.setTool(tool);
  }

  /** Toggle magnet snapping for drawing anchors. */
  setMagnet(enabled: boolean): void {
    this.drawingLayer.setMagnet(enabled);
  }

  get magnet(): boolean {
    return this.drawingLayer.magnet;
  }

  registerDrawingTool(tool: DrawingTool): void {
    this.drawings.registerTool(tool);
  }

  addDrawing(type: DrawingType, points: DataPoint[], style?: Partial<DrawingStyle>, label?: string): Drawing {
    return this.drawings.add({ type, points, style, label });
  }

  removeDrawing(id: string): boolean {
    return this.drawings.remove(id);
  }

  clearDrawings(): void {
    this.drawings.clear();
  }

  undo(): void {
    this.drawings.undo();
  }

  redo(): void {
    this.drawings.redo();
  }

  serializeDrawings(): string {
    return this.drawings.serialize();
  }

  loadDrawings(json: string): void {
    this.drawings.deserialize(json);
  }

  // ---------------------------------------------------------------------------
  // Indicators
  // ---------------------------------------------------------------------------

  registerIndicator(definition: IndicatorDefinition): void {
    this.tsIndicators.validate(definition);
    this.indicators.register(definition);
  }

  createIndicator(definitionId: string, params?: Record<string, IndicatorParamValue>): IndicatorInstance {
    return this.indicators.create(definitionId, params);
  }

  removeIndicator(instanceId: string): boolean {
    return this.indicators.remove(instanceId);
  }

  updateIndicator(instanceId: string, params: Record<string, IndicatorParamValue>): void {
    this.indicators.setParams(instanceId, params);
  }

  listIndicators(): IndicatorInstance[] {
    return this.indicators.list();
  }

  listIndicatorDefinitions(): IndicatorDefinition[] {
    return this.indicators.listDefinitions();
  }

  /** Load and register a custom TypeScript indicator from a module URL. */
  async loadTsIndicator(url: string): Promise<IndicatorDefinition> {
    const definition = await this.tsIndicators.loadFromUrl(url);
    this.registerIndicator(definition);
    return definition;
  }

  /** Compile a C# indicator and register it. */
  async loadCSharpIndicator(source: string, metadata: CsIndicatorMetadata): Promise<IndicatorDefinition> {
    const definition = await this.csIndicators.compileAndLoad(source, metadata);
    this.registerIndicator(definition);
    return definition;
  }

  // ---------------------------------------------------------------------------
  // Markers / signals / order lines
  // ---------------------------------------------------------------------------

  setSignals(signals: SignalInput[]): void {
    this.markers.setUserSignals(signals);
  }

  addSignal(signal: SignalInput): void {
    this.markers.addUserSignal(signal);
  }

  addOrderLine(order: Omit<OrderLine, 'id'> & { id?: string }): string {
    return this.markers.addOrderLine(order);
  }

  addPriceMarker(marker: Omit<PriceMarker, 'id'> & { id?: string }): string {
    return this.markers.addPriceMarker(marker);
  }

  removeMarker(id: string): boolean {
    return this.markers.removeMarker(id);
  }

  clearMarkers(): void {
    this.markers.clearMarkers();
  }

  // ---------------------------------------------------------------------------
  // Replay
  // ---------------------------------------------------------------------------

  get replayState(): ReplayState {
    return this.replay.state;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const dispose of this.teardown) dispose();
    this.replay.destroy();
    this.drawingLayer.destroy();
    this.indicators.destroy();
    this.markers.destroy();
    this.engine.destroy();
    this.emit('destroyed', undefined);
    this.clear();
  }
}

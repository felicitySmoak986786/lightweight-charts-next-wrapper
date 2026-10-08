import type { CoordinateSpace } from '../core/CoordinateSpace';
import type { DataStore } from '../core/DataStore';
import type { ChartEngine } from '../core/ChartEngine';
import type { DataPoint } from '../types';
import { DrawingManager } from './DrawingManager';
import type { Drawing, DrawingType, DrawingView, HitZone, PixelPoint } from './types';

export interface DrawingLayerOptions {
  /** Snap anchor time to the nearest bar (default false: free placement). */
  snapToBar?: boolean;
  /** Keep the tool armed after finishing a drawing (default false). */
  keepToolActive?: boolean;
  /**
   * Magnet mode: snap anchors to the nearest bar's time and to the closest of
   * that bar's OHLC values (default false).
   */
  magnet?: boolean;
  /** Auto-scroll the chart when dragging near the left/right edge (default true). */
  autoScroll?: boolean;
}

interface DragState {
  id: string;
  kind: 'handle' | 'body';
  handleIndex: number;
  startLogical: number;
  startPrice: number;
  originalPoints: DataPoint[];
}

const MIN_MOVE = 3;
const EDGE = 56;
const AUTOSCROLL_STEP = 0.35;

const CURSOR_STYLES = `
.lwc-draw-crosshair canvas { cursor: crosshair !important; }
.lwc-draw-move canvas { cursor: move !important; }
.lwc-draw-grab canvas { cursor: grab !important; }
.lwc-draw-grabbing canvas { cursor: grabbing !important; }
.lwc-draw-nwse canvas { cursor: nwse-resize !important; }
`;

function ensureCursorStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('lwc-draw-cursor-styles')) return;
  const style = document.createElement('style');
  style.id = 'lwc-draw-cursor-styles';
  style.textContent = CURSOR_STYLES;
  document.head.appendChild(style);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Imperative canvas overlay that renders drawings and handles all pointer
 * interaction: free-form creation (drag or click-click), selection, handle
 * resizing, body dragging, edge auto-scroll and deletion.
 *
 * Anchors are stored in fractional bar-index (`logical`) + price space so they
 * move continuously with the cursor instead of snapping to bar centres, which
 * matches the TradingView/Angel One drawing feel. The canvas is
 * `pointer-events: none`; pointer events are intercepted on the container in the
 * capture phase only when the layer needs to consume them.
 */
export class DrawingLayer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly container: HTMLElement;
  private options: Required<DrawingLayerOptions>;
  private readonly disposers: Array<() => void> = [];

  private previewPoints: DataPoint[] = [];
  private cursor: PixelPoint | null = null;
  private lastPixel: PixelPoint | null = null;
  private hoveredId: string | null = null;
  private hoveredZone: HitZone = null;
  private drag: DragState | null = null;

  private pointerDown = false;
  private downPixel: PixelPoint | null = null;
  private movedSinceDown = false;

  private autoscrollDir = 0;
  private autoscrollRaf = 0;

  private rafId = 0;
  private destroyed = false;

  constructor(
    container: HTMLElement,
    private readonly space: CoordinateSpace,
    private readonly engine: ChartEngine,
    private readonly store: DataStore,
    private readonly manager: DrawingManager,
    options: DrawingLayerOptions = {},
  ) {
    this.container = container;
    this.options = {
      snapToBar: options.snapToBar ?? false,
      keepToolActive: options.keepToolActive ?? false,
      magnet: options.magnet ?? false,
      autoScroll: options.autoScroll ?? true,
    };
    ensureCursorStyles();

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'lwc-drawing-layer';
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '3',
    });
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to acquire 2D context for the drawing layer');
    this.ctx = ctx;

    this.attach();
    this.resize();
    this.requestRedraw();
  }

  private attach(): void {
    const container = this.container;

    const onPointerDown = (event: PointerEvent) => this.handlePointerDown(event);
    const onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);
    const onPointerUp = (event: PointerEvent) => this.handlePointerUp(event);
    const onDoubleClick = (event: MouseEvent) => this.handleDoubleClick(event);
    const onKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);

    // Capture phase so we run before lightweight-charts' own handlers.
    container.addEventListener('pointerdown', onPointerDown, true);
    container.addEventListener('pointermove', onPointerMove, true);
    container.addEventListener('pointerup', onPointerUp, true);
    container.addEventListener('pointercancel', onPointerUp, true);
    container.addEventListener('dblclick', onDoubleClick, true);
    container.addEventListener('keydown', onKeyDown);
    container.setAttribute('tabindex', container.getAttribute('tabindex') ?? '0');

    this.disposers.push(
      () => container.removeEventListener('pointerdown', onPointerDown, true),
      () => container.removeEventListener('pointermove', onPointerMove, true),
      () => container.removeEventListener('pointerup', onPointerUp, true),
      () => container.removeEventListener('pointercancel', onPointerUp, true),
      () => container.removeEventListener('dblclick', onDoubleClick, true),
      () => container.removeEventListener('keydown', onKeyDown),
    );

    this.disposers.push(
      this.engine.on('visibleRangeChange', () => this.requestRedraw()),
      this.engine.on('resize', () => {
        this.resize();
        this.requestRedraw();
      }),
      this.manager.on('change', () => this.requestRedraw()),
      this.manager.on('selection', () => this.requestRedraw()),
      this.manager.on('tool', () => {
        this.cancelPreview();
        this.applyCursor();
        this.requestRedraw();
      }),
      this.store.on('cursor', () => this.requestRedraw()),
    );
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  cancelPreview(): void {
    this.previewPoints = [];
    this.drag = null;
    this.pointerDown = false;
    this.downPixel = null;
    this.movedSinceDown = false;
    this.hoveredId = null;
    this.hoveredZone = null;
    this.stopAutoScroll();
    this.applyCursor();
  }

  setMagnet(enabled: boolean): void {
    this.options.magnet = enabled;
  }

  get magnet(): boolean {
    return this.options.magnet;
  }

  requestRedraw(): void {
    if (this.destroyed || this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.render();
    });
  }

  destroy(): void {
    this.destroyed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.stopAutoScroll();
    for (const dispose of this.disposers) dispose();
    this.canvas.remove();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private resize(): void {
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private get view(): DrawingView {
    return {
      timeToX: (time) => this.space.timeToX(time),
      logicalToX: (logical) => this.space.logicalToX(logical),
      priceToY: (price) => this.space.priceToY(price),
      xToTime: (x) => this.space.xToTime(x),
      yToPrice: (y) => this.space.yToPrice(y),
      width: this.space.width,
      height: this.space.height,
    };
  }

  private render(): void {
    const { ctx, view } = this;
    ctx.clearRect(0, 0, view.width, view.height);

    const selected = this.manager.getSelected();
    for (const drawing of this.manager.list()) {
      if (!drawing.visible) continue;
      const tool = this.manager.getTool(drawing.type);
      if (!tool) continue;
      tool.render(ctx, drawing, view, {
        selected: selected?.id === drawing.id,
        hovered: this.hoveredId === drawing.id,
        activeHandle: this.drag?.id === drawing.id && this.drag.kind === 'handle' ? this.drag.handleIndex : null,
        preview: false,
        barsBetween: (a, b) => this.barsBetween(a, b),
      });
    }

    if (this.previewPoints.length > 0) {
      const tool = this.manager.getTool(this.previewType ?? 'trendline');
      if (tool) {
        const points = [...this.previewPoints];
        if (this.cursor) {
          const point = this.pointFromPixel(this.cursor.x, this.cursor.y);
          if (point) points.push(point);
        }
        const previewDrawing: Drawing = {
          id: '__preview__',
          type: tool.type,
          points,
          style: { ...tool.defaultStyle(), lineStyle: 'dashed' },
          locked: false,
          visible: true,
        };
        tool.render(ctx, previewDrawing, view, {
          selected: false,
          hovered: false,
          activeHandle: null,
          preview: true,
          barsBetween: (a, b) => this.barsBetween(a, b),
        });
      }
    }
  }

  private get previewType(): DrawingType | null {
    const tool = this.manager.activeTool;
    if (tool && tool !== 'select') return tool;
    return null;
  }

  private barsBetween(a: number, b: number): number {
    const candles = this.store.revealed();
    if (candles.length === 0) return 0;
    const from = this.nearestIndex(candles, a);
    const to = this.nearestIndex(candles, b);
    return Math.abs(to - from);
  }

  private nearestIndex(candles: readonly { time: number }[], time: number): number {
    let bestIndex = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < candles.length; i += 1) {
      const diff = Math.abs(candles[i].time - time);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------

  private handlePointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const pixel = this.pixelFromEvent(event);
    const tool = this.manager.activeTool;

    if (tool && tool !== 'select') {
      event.preventDefault();
      event.stopPropagation();
      this.container.focus({ preventScroll: true });
      const point = this.pointFromPixel(pixel.x, pixel.y);
      if (!point) return;
      this.capture(event);

      this.pointerDown = true;
      this.downPixel = pixel;
      this.lastPixel = pixel;
      this.movedSinceDown = false;
      this.cursor = pixel;
      this.previewPoints.push(point);

      const required = this.manager.getTool(tool)?.requiredPoints ?? 2;
      if (this.previewPoints.length >= required) this.finishPreview();
      this.requestRedraw();
      return;
    }

    // Select mode: hit test topmost drawing.
    const hit = this.hitTest(pixel);
    if (hit) {
      event.preventDefault();
      event.stopPropagation();
      this.container.focus({ preventScroll: true });
      this.manager.select(hit.drawing.id);
      const data = this.pointFromPixel(pixel.x, pixel.y);
      if (data && !hit.drawing.locked) {
        this.capture(event);
        this.manager.beginHistory();
        this.pointerDown = true;
        this.downPixel = pixel;
        this.lastPixel = pixel;
        this.movedSinceDown = false;
        this.drag = {
          id: hit.drawing.id,
          kind: hit.zone?.kind === 'handle' ? 'handle' : 'body',
          handleIndex: hit.zone?.kind === 'handle' ? hit.zone.index : -1,
          startLogical: data.logical ?? this.logicalFromTime(data.time),
          startPrice: data.price,
          originalPoints: hit.drawing.points.map((p) => ({ ...p })),
        };
        this.setCursorMode('grabbing');
      }
      this.requestRedraw();
      return;
    }

    // Empty click: deselect but let the chart pan.
    this.manager.select(null);
  }

  private handlePointerMove(event: PointerEvent): void {
    const pixel = this.pixelFromEvent(event);
    this.lastPixel = pixel;
    this.cursor = pixel;

    if (this.pointerDown && this.downPixel && !this.movedSinceDown) {
      if (Math.hypot(pixel.x - this.downPixel.x, pixel.y - this.downPixel.y) > MIN_MOVE) {
        this.movedSinceDown = true;
      }
    }

    if (this.drag) {
      event.preventDefault();
      event.stopPropagation();
      if (this.movedSinceDown) this.applyDrag(pixel);
      this.updateAutoScroll(pixel);
      return;
    }

    if (this.previewType) {
      // Only intercept while a drawing gesture is in progress; otherwise let the
      // chart's own crosshair/pan behaviour work while the tool is merely armed.
      if (this.previewPoints.length > 0 || this.pointerDown) {
        event.preventDefault();
        event.stopPropagation();
        this.updateAutoScroll(pixel);
        this.requestRedraw();
      }
      return;
    }

    // Hover feedback in select mode.
    const hit = this.hitTest(pixel);
    this.hoveredId = hit?.drawing.id ?? null;
    this.hoveredZone = hit?.zone ?? null;
    if (this.hoveredId) {
      this.setCursorMode(hit?.zone?.kind === 'handle' ? 'nwse' : 'move');
    } else {
      this.clearCursorMode();
    }
    this.requestRedraw();
  }

  private handlePointerUp(event: PointerEvent): void {
    if (!this.pointerDown && !this.drag) return;
    event.preventDefault();
    event.stopPropagation();
    this.release(event);
    this.stopAutoScroll();

    if (this.drag) {
      this.drag = null;
    } else if (this.previewType) {
      const required = this.manager.getTool(this.previewType)?.requiredPoints ?? 2;
      // Drag-to-draw: a 2-point tool finishes on release when the pointer moved.
      if (required === 2 && this.movedSinceDown && this.previewPoints.length === 1 && this.lastPixel) {
        const point = this.pointFromPixel(this.lastPixel.x, this.lastPixel.y);
        if (point) this.previewPoints.push(point);
        this.finishPreview();
      }
    }

    this.pointerDown = false;
    this.downPixel = null;
    this.movedSinceDown = false;
    this.applyCursor();
    this.requestRedraw();
  }

  private handleDoubleClick(event: MouseEvent): void {
    if (this.previewPoints.length >= 2 && this.manager.activeTool !== 'select') {
      event.preventDefault();
      event.stopPropagation();
      this.finishPreview();
      this.requestRedraw();
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const isMeta = event.ctrlKey || event.metaKey;
    if ((event.key === 'Delete' || event.key === 'Backspace') && this.manager.getSelected()) {
      event.preventDefault();
      this.manager.removeSelected();
      return;
    }
    if (event.key === 'Escape') {
      if (this.previewPoints.length > 0) {
        this.cancelPreview();
      } else {
        this.manager.setTool('select');
      }
      this.requestRedraw();
      return;
    }
    if (isMeta && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.manager.redo();
      else this.manager.undo();
      this.requestRedraw();
    }
  }

  private applyDrag(pixel: PixelPoint): void {
    if (!this.drag) return;
    const current = this.pointFromPixel(pixel.x, pixel.y, this.drag.kind === 'handle');
    if (!current) return;
    const drawing = this.manager.get(this.drag.id);
    const tool = drawing ? this.manager.getTool(drawing.type) : undefined;
    if (!drawing || !tool) return;

    if (this.drag.kind === 'handle') {
      this.manager.mutate(drawing.id, (target) => {
        tool.moveHandle(target, this.drag!.handleIndex, current);
      });
    } else {
      const deltaLogical = (current.logical ?? this.logicalFromTime(current.time)) - this.drag.startLogical;
      const deltaPrice = current.price - this.drag.startPrice;
      this.manager.mutate(drawing.id, (target) => {
        target.points = this.drag!.originalPoints.map((point) => {
          const logical = (point.logical ?? this.logicalFromTime(point.time)) + deltaLogical;
          return {
            time: this.timeFromLogical(logical),
            price: point.price + deltaPrice,
            logical,
          };
        });
      });
    }
  }

  private finishPreview(): void {
    const tool = this.previewType;
    if (!tool) return;
    const points = [...this.previewPoints];
    const drawingTool = this.manager.getTool(tool);
    this.previewPoints = [];
    if (!drawingTool || points.length === 0) return;

    const required = drawingTool.requiredPoints;
    const finalPoints = points.slice(0, required);
    const drawing = this.manager.add({ type: tool, points: finalPoints });
    if (!this.options.keepToolActive) this.manager.setTool('select');
    this.manager.select(drawing.id);
    this.applyCursor();
  }

  // ---------------------------------------------------------------------------
  // Edge auto-scroll
  // ---------------------------------------------------------------------------

  private updateAutoScroll(pixel: PixelPoint): void {
    if (!this.options.autoScroll) return;
    const width = this.view.width;
    let dir = 0;
    if (pixel.x < EDGE) dir = -1;
    else if (pixel.x > width - EDGE) dir = 1;
    this.autoscrollDir = dir;
    if (dir !== 0) this.startAutoScroll();
    else this.stopAutoScroll();
  }

  private startAutoScroll(): void {
    if (this.autoscrollRaf || this.destroyed) return;
    const step = () => {
      this.autoscrollRaf = 0;
      if (this.autoscrollDir === 0 || this.destroyed) return;
      const timeScale = this.engine.chart.timeScale();
      const range = timeScale.getVisibleLogicalRange();
      if (range) {
        const delta = this.autoscrollDir * AUTOSCROLL_STEP;
        timeScale.setVisibleLogicalRange({ from: range.from + delta, to: range.to + delta });
      }
      if (this.drag && this.lastPixel) this.applyDrag(this.lastPixel);
      this.requestRedraw();
      this.autoscrollRaf = requestAnimationFrame(step);
    };
    this.autoscrollRaf = requestAnimationFrame(step);
  }

  private stopAutoScroll(): void {
    this.autoscrollDir = 0;
    if (this.autoscrollRaf) {
      cancelAnimationFrame(this.autoscrollRaf);
      this.autoscrollRaf = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Coordinate helpers
  // ---------------------------------------------------------------------------

  private hitTest(pixel: PixelPoint): { drawing: Drawing; zone: HitZone } | null {
    const drawings = this.manager.list();
    const view = this.view;
    for (let i = drawings.length - 1; i >= 0; i -= 1) {
      const drawing = drawings[i];
      if (!drawing.visible || drawing.locked) continue;
      const tool = this.manager.getTool(drawing.type);
      if (!tool) continue;
      const zone = tool.hitTest(drawing, pixel, view);
      if (zone) return { drawing, zone };
    }
    return null;
  }

  private pixelFromEvent(event: PointerEvent): PixelPoint {
    const rect = this.container.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  /** Build a data-space point from a pixel, applying magnet/snap if enabled. */
  private pointFromPixel(x: number, y: number, snap = true): DataPoint | null {
    const logical = this.space.xToLogical(x);
    const price = this.space.yToPrice(y);
    if (logical === null || price === null) return null;
    const time = this.space.xToTime(x) ?? this.timeFromLogical(logical);
    const point: DataPoint = { time, price, logical };
    return snap ? this.applySnap(point) : point;
  }

  private applySnap(point: DataPoint): DataPoint {
    const candles = this.store.revealed();
    if (candles.length === 0) return point;
    const logical = point.logical ?? this.logicalFromTime(point.time);
    const index = clamp(Math.round(logical), 0, candles.length - 1);
    const candle = candles[index];

    if (this.options.magnet) {
      const candidates = [candle.open, candle.high, candle.low, candle.close];
      let best = candidates[0];
      let bestDiff = Infinity;
      for (const value of candidates) {
        const diff = Math.abs(value - point.price);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = value;
        }
      }
      return { time: candle.time, price: best, logical: index };
    }

    if (this.options.snapToBar) {
      return { time: candle.time, price: point.price, logical: index };
    }

    return point;
  }

  /** Best-effort UNIX time for a fractional bar index (extrapolates past the ends). */
  private timeFromLogical(logical: number): number {
    const candles = this.store.all();
    if (candles.length === 0) return Math.floor(Date.now() / 1000);
    const index = Math.round(logical);
    if (index >= 0 && index < candles.length) return candles[index].time;
    const last = candles[candles.length - 1];
    const first = candles[0];
    const interval = candles.length > 1 ? last.time - candles[candles.length - 2].time : 60;
    if (index >= candles.length) return last.time + (index - (candles.length - 1)) * interval;
    return first.time + index * interval;
  }

  private logicalFromTime(time: number): number {
    const candles = this.store.all();
    if (candles.length === 0) return 0;
    let bestIndex = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < candles.length; i += 1) {
      const diff = Math.abs(candles[i].time - time);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  // ---------------------------------------------------------------------------
  // Pointer capture / cursor
  // ---------------------------------------------------------------------------

  private capture(event: PointerEvent): void {
    try {
      this.container.setPointerCapture(event.pointerId);
    } catch {
      // Capture is best-effort.
    }
  }

  private release(event: PointerEvent): void {
    try {
      if (this.container.hasPointerCapture(event.pointerId)) {
        this.container.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore.
    }
  }

  private setCursorMode(mode: 'crosshair' | 'move' | 'grab' | 'grabbing' | 'nwse'): void {
    this.clearCursorMode();
    this.container.classList.add(`lwc-draw-${mode}`);
  }

  private clearCursorMode(): void {
    this.container.classList.remove(
      'lwc-draw-crosshair',
      'lwc-draw-move',
      'lwc-draw-grab',
      'lwc-draw-grabbing',
      'lwc-draw-nwse',
    );
  }

  private applyCursor(): void {
    const tool = this.manager.activeTool;
    if (tool && tool !== 'select') {
      this.setCursorMode('crosshair');
    } else {
      this.clearCursorMode();
    }
  }
}

import type { CoordinateSpace } from '../core/CoordinateSpace';
import type { DataStore } from '../core/DataStore';
import type { ChartEngine } from '../core/ChartEngine';
import { DrawingManager } from './DrawingManager';
import type { Drawing, DrawingType, DrawingView, HitZone, PixelPoint } from './types';

export interface DrawingLayerOptions {
  /** Snap anchors to the nearest bar (default true). */
  snapToBar?: boolean;
  /** Keep the tool armed after finishing a drawing (default true). */
  keepToolActive?: boolean;
}

interface DragState {
  id: string;
  kind: 'handle' | 'body';
  handleIndex: number;
  startTime: number;
  startPrice: number;
  originalPoints: Drawing['points'];
}

const CURSOR_STYLES = `
.lwc-draw-crosshair canvas { cursor: crosshair !important; }
.lwc-draw-move canvas { cursor: move !important; }
.lwc-draw-grabbing canvas { cursor: grabbing !important; }
`;

function ensureCursorStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('lwc-draw-cursor-styles')) return;
  const style = document.createElement('style');
  style.id = 'lwc-draw-cursor-styles';
  style.textContent = CURSOR_STYLES;
  document.head.appendChild(style);
}

/**
 * Imperative canvas overlay that renders drawings and handles all pointer
 * interaction: creation, selection, handle resizing, body dragging and deletion.
 *
 * The canvas is `pointer-events: none` so the chart remains pannable; pointer
 * events are intercepted on the container in the capture phase only when the
 * layer needs to consume them.
 */
export class DrawingLayer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly container: HTMLElement;
  private readonly options: Required<DrawingLayerOptions>;
  private readonly disposers: Array<() => void> = [];

  private previewPoints: Array<{ time: number; price: number }> = [];
  private cursor: PixelPoint | null = null;
  private hoveredId: string | null = null;
  private hoveredZone: HitZone = null;
  private drag: DragState | null = null;
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
      snapToBar: options.snapToBar ?? true,
      keepToolActive: options.keepToolActive ?? true,
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
    container.addEventListener('dblclick', onDoubleClick, true);
    container.addEventListener('keydown', onKeyDown);
    container.setAttribute('tabindex', container.getAttribute('tabindex') ?? '0');

    this.disposers.push(
      () => container.removeEventListener('pointerdown', onPointerDown, true),
      () => container.removeEventListener('pointermove', onPointerMove, true),
      () => container.removeEventListener('pointerup', onPointerUp, true),
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
    this.applyCursor();
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
          const snapped = this.snapToBar(this.dataFromPixel(this.cursor.x, this.cursor.y));
          if (snapped) points.push(snapped);
        }
        const previewDrawing: Drawing = {
          id: '__preview__',
          type: tool.type,
          points,
          style: tool.defaultStyle(),
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
    if (event.button !== 0) return;
    const pixel = this.pixelFromEvent(event);
    const tool = this.manager.activeTool;

    if (tool && tool !== 'select') {
      event.preventDefault();
      event.stopPropagation();
      this.container.focus({ preventScroll: true });
      const point = this.snapToBar(this.dataFromPixel(pixel.x, pixel.y));
      if (!point) return;
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
      const data = this.dataFromPixel(pixel.x, pixel.y);
      if (data && !hit.drawing.locked) {
        this.manager.beginHistory();
        this.drag = {
          id: hit.drawing.id,
          kind: hit.zone?.kind === 'handle' ? 'handle' : 'body',
          handleIndex: hit.zone?.kind === 'handle' ? hit.zone.index : -1,
          startTime: data.time,
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

    if (this.drag) {
      event.preventDefault();
      event.stopPropagation();
      this.applyDrag(pixel);
      return;
    }

    if (this.previewType) {
      event.preventDefault();
      event.stopPropagation();
      this.cursor = pixel;
      this.requestRedraw();
      return;
    }

    // Hover feedback in select mode.
    const hit = this.hitTest(pixel);
    this.hoveredId = hit?.drawing.id ?? null;
    this.hoveredZone = hit?.zone ?? null;
    if (this.hoveredId) {
      this.setCursorMode(hit?.zone?.kind === 'handle' ? 'grabbing' : 'move');
    } else {
      this.clearCursorMode();
    }
    this.requestRedraw();
  }

  private handlePointerUp(event: PointerEvent): void {
    if (!this.drag) return;
    event.preventDefault();
    event.stopPropagation();
    this.drag = null;
    this.applyCursor();
    this.requestRedraw();
  }

  private handleDoubleClick(event: MouseEvent): void {
    if (this.previewPoints.length > 0 && this.manager.activeTool !== 'select') {
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
    const current = this.dataFromPixel(pixel.x, pixel.y);
    if (!current) return;
    const drawing = this.manager.get(this.drag.id);
    const tool = drawing ? this.manager.getTool(drawing.type) : undefined;
    if (!drawing || !tool) return;

    if (this.drag.kind === 'handle') {
      const snapped = this.snapToBar(current);
      if (!snapped) return;
      this.manager.mutate(drawing.id, (target) => {
        tool.moveHandle(target, this.drag!.handleIndex, snapped);
      });
    } else {
      const deltaTime = current.time - this.drag.startTime;
      const deltaPrice = current.price - this.drag.startPrice;
      this.manager.mutate(drawing.id, (target) => {
        target.points = this.drag!.originalPoints.map((point) => ({
          time: point.time + deltaTime,
          price: point.price + deltaPrice,
        }));
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

    const needsSnap = this.options.snapToBar;
    const finalPoints = needsSnap ? points.map((p) => this.snapToBar(p) ?? p) : points;
    const drawing = this.manager.add({ type: tool, points: finalPoints });
    if (!this.options.keepToolActive) this.manager.setTool('select');
    this.manager.select(drawing.id);
    this.applyCursor();
  }

  // ---------------------------------------------------------------------------
  // Helpers
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

  private dataFromPixel(x: number, y: number): { time: number; price: number } | null {
    const time = this.space.xToTime(x);
    const price = this.space.yToPrice(y);
    if (time === null || price === null) return null;
    return { time, price };
  }

  private snapToBar(point: { time: number; price: number } | null): { time: number; price: number } | null {
    if (!point) return null;
    if (!this.options.snapToBar) return point;
    return { time: this.space.snapTime(point.time, this.store.revealed()), price: point.price };
  }

  private setCursorMode(mode: 'crosshair' | 'move' | 'grabbing'): void {
    this.clearCursorMode();
    this.container.classList.add(`lwc-draw-${mode}`);
  }

  private clearCursorMode(): void {
    this.container.classList.remove('lwc-draw-crosshair', 'lwc-draw-move', 'lwc-draw-grabbing');
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

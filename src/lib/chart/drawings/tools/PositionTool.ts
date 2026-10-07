import type { Drawing, DrawingStyle, DrawingTool, DrawingView, HitZone, PixelPoint, RenderOptions } from '../types';
import { DEFAULT_STYLE } from '../types';
import type { DataPoint } from '../../types';
import { formatPercent, formatPrice, pointInRect, toPixels } from '../geometry';
import { drawHandle, drawLabel, HIT_TOLERANCE } from './shared';
export type PositionDirection = 'long' | 'short';

const PROFIT_COLOR = '#26a69a';
const LOSS_COLOR = '#ef5350';
const PROFIT_FILL = 'rgba(38, 166, 154, 0.28)';
const LOSS_FILL = 'rgba(239, 83, 80, 0.28)';

function paintZone(
  ctx: CanvasRenderingContext2D,
  a: PixelPoint,
  b: PixelPoint,
  fill: string,
  stroke: string,
): void {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const width = Math.abs(b.x - a.x);
  const height = Math.abs(b.y - a.y);
  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

/**
 * Long / short position tool defined by three anchors:
 * `[entry, target, stop]`. Renders the profit zone (entry->target) and the
 * loss zone (entry->stop) with labels and the reward/risk ratio.
 */
export class PositionTool implements DrawingTool {
  readonly type: 'longPosition' | 'shortPosition';
  readonly requiredPoints = 3;
  readonly cursor = 'crosshair';

  constructor(private readonly direction: PositionDirection) {
    this.type = direction === 'long' ? 'longPosition' : 'shortPosition';
  }

  defaultStyle(): DrawingStyle {
    return {
      ...DEFAULT_STYLE,
      lineColor: this.direction === 'long' ? PROFIT_COLOR : LOSS_COLOR,
      fillColor: 'transparent',
      lineStyle: 'solid',
    };
  }

  render(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    view: DrawingView,
    options: RenderOptions,
  ): void {
    const [entry, target, stop] = drawing.points;
    const pixels = toPixels(drawing.points, view);
    const [entryPx, targetPx, stopPx] = pixels;
    if (!entry || !entryPx) return;

    ctx.save();
    if (target && targetPx) paintZone(ctx, entryPx, targetPx, PROFIT_FILL, PROFIT_COLOR);
    if (stop && stopPx) paintZone(ctx, entryPx, stopPx, LOSS_FILL, LOSS_COLOR);

    // Entry baseline.
    const maxX = Math.max(entryPx.x, targetPx?.x ?? entryPx.x, stopPx?.x ?? entryPx.x);
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = drawing.style.lineWidth;
    ctx.strokeStyle = '#c7ccd1';
    ctx.beginPath();
    ctx.moveTo(Math.min(entryPx.x, maxX), entryPx.y);
    ctx.lineTo(maxX, entryPx.y);
    ctx.stroke();

    if (drawing.style.showLabels !== false) {
      const isLong = this.direction === 'long';
      if (target && targetPx) {
        const pct = entry.price !== 0 ? ((target.price - entry.price) / entry.price) * 100 : 0;
        drawLabel(
          ctx,
          { x: targetPx.x + 8, y: Math.min(entryPx.y, targetPx.y) },
          [`${isLong ? 'Target' : 'Take profit'} ${formatPercent(pct)}`, formatPrice(target.price)],
          view.width,
          view.height,
          { align: 'left', background: 'rgba(38, 166, 154, 0.95)', color: '#fff', border: PROFIT_COLOR },
        );
      }
      if (stop && stopPx) {
        const pct = entry.price !== 0 ? ((stop.price - entry.price) / entry.price) * 100 : 0;
        drawLabel(
          ctx,
          { x: stopPx.x + 8, y: Math.min(entryPx.y, stopPx.y) },
          [`Stop ${formatPercent(pct)}`, formatPrice(stop.price)],
          view.width,
          view.height,
          { align: 'left', background: 'rgba(239, 83, 80, 0.95)', color: '#fff', border: LOSS_COLOR },
        );
      }

      const reward = target ? Math.abs(target.price - entry.price) : 0;
      const risk = stop ? Math.abs(stop.price - entry.price) : 0;
      const rr = risk > 0 ? reward / risk : 0;
      drawLabel(
        ctx,
        { x: entryPx.x - 8, y: entryPx.y - 10 },
        [`${isLong ? 'LONG' : 'SHORT'} @ ${formatPrice(entry.price)}`, `R/R ${rr.toFixed(2)}`],
        view.width,
        view.height,
        { align: 'right', background: 'rgba(30, 34, 45, 0.95)', color: '#e0e3eb' },
      );
    }

    if (options.selected || options.hovered || options.preview) {
      const label = ['entry', 'target', 'stop'];
      pixels.forEach((point, index) => {
        if (!point) return;
        drawHandle(ctx, point, index === 0 ? '#f0b90b' : index === 1 ? PROFIT_COLOR : LOSS_COLOR, options.activeHandle === index);
        if (options.selected) {
          ctx.setLineDash([]);
          ctx.font = '10px sans-serif';
          ctx.fillStyle = '#9aa4b2';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(label[index], point.x + 8, point.y + 6);
        }
      });
    }
    ctx.restore();
  }

  hitTest(drawing: Drawing, point: PixelPoint, view: DrawingView): HitZone {
    const pixels = toPixels(drawing.points, view);
    for (let i = 0; i < pixels.length; i += 1) {
      const handle = pixels[i];
      if (handle && Math.hypot(handle.x - point.x, handle.y - point.y) <= HIT_TOLERANCE + 3) {
        return { kind: 'handle', index: i };
      }
    }
    const [entryPx, targetPx, stopPx] = pixels;
    if (entryPx && targetPx && pointInRect(point, entryPx, targetPx)) return { kind: 'body' };
    if (entryPx && stopPx && pointInRect(point, entryPx, stopPx)) return { kind: 'body' };
    return null;
  }

  handles(drawing: Drawing, view: DrawingView): PixelPoint[] {
    return toPixels(drawing.points, view).filter((point): point is PixelPoint => point !== null);
  }

  moveHandle(drawing: Drawing, index: number, point: DataPoint): void {
    if (index >= 0 && index < drawing.points.length) drawing.points[index] = { ...point };
  }

  translate(drawing: Drawing, deltaTime: number, deltaPrice: number): void {
    drawing.points = drawing.points.map((p) => ({
      time: p.time + deltaTime,
      price: p.price + deltaPrice,
    }));
  }
}

import type { Drawing, DrawingStyle, DrawingTool, DrawingView, HitZone, PixelPoint, RenderOptions } from '../types';
import { DEFAULT_STYLE } from '../types';
import type { DataPoint } from '../../types';
import {
  distanceToSegment,
  formatPercent,
  formatPrice,
  formatSigned,
  timeDeltaLabel,
  toPixels,
} from '../geometry';
import { applyLineStyle, drawHandle, drawLabel, HIT_TOLERANCE } from './shared';

/**
 * Ruler / measurement tool. Draws the measured box between two anchors and a
 * floating label describing the price move, percentage change, bar count and
 * elapsed time.
 */
export class RulerTool implements DrawingTool {
  readonly type = 'ruler' as const;
  readonly requiredPoints = 2;
  readonly cursor = 'crosshair';

  defaultStyle(): DrawingStyle {
    return {
      ...DEFAULT_STYLE,
      lineColor: '#787b86',
      fillColor: 'rgba(120, 123, 134, 0.18)',
      lineStyle: 'dashed',
    };
  }

  render(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    view: DrawingView,
    options: RenderOptions,
  ): void {
    const [start, end] = drawing.points;
    const pixels = toPixels(drawing.points, view);
    const [a, b] = pixels;
    if (!a || !b || !start || !end) return;

    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const width = Math.abs(b.x - a.x);
    const height = Math.abs(b.y - a.y);

    ctx.save();
    if (drawing.style.fillColor) {
      ctx.fillStyle = drawing.style.fillColor;
      ctx.fillRect(x, y, width, height);
    }
    applyLineStyle(ctx, drawing.style);
    ctx.strokeStyle = drawing.style.lineColor;
    ctx.strokeRect(x, y, width, height);

    // Crosshair guide line between the anchors.
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    if (drawing.style.showLabels !== false) {
      const priceDelta = end.price - start.price;
      const percent = start.price !== 0 ? (priceDelta / start.price) * 100 : 0;
      const positive = priceDelta >= 0;
      const bars = options.barsBetween?.(start.time, end.time);
      const lines = [
        `${formatSigned(priceDelta)} (${formatPercent(percent)})`,
        `${formatPrice(start.price)} -> ${formatPrice(end.price)}`,
      ];
      if (bars !== undefined) lines.push(`${bars} bars, ${timeDeltaLabel(start.time, end.time)}`);
      drawLabel(ctx, { x: b.x + 10, y: b.y + 10 }, lines, view.width, view.height, {
        align: 'left',
        background: positive ? 'rgba(38, 166, 154, 0.95)' : 'rgba(239, 83, 80, 0.95)',
        color: '#ffffff',
        border: positive ? '#26a69a' : '#ef5350',
      });
    }

    if (options.selected || options.hovered || options.preview) {
      drawHandle(ctx, a, drawing.style.lineColor, options.activeHandle === 0);
      drawHandle(ctx, b, drawing.style.lineColor, options.activeHandle === 1);
    }
    ctx.restore();
  }

  hitTest(drawing: Drawing, point: PixelPoint, view: DrawingView): HitZone {
    const pixels = toPixels(drawing.points, view);
    for (let i = 0; i < pixels.length; i += 1) {
      const handle = pixels[i];
      if (handle && Math.hypot(handle.x - point.x, handle.y - point.y) <= HIT_TOLERANCE + 2) {
        return { kind: 'handle', index: i };
      }
    }
    const [a, b] = pixels;
    if (a && b) {
      if (
        distanceToSegment(point, a, b) <= HIT_TOLERANCE ||
        distanceToSegment(point, a, { x: b.x, y: a.y }) <= HIT_TOLERANCE ||
        distanceToSegment(point, { x: a.x, y: b.y }, b) <= HIT_TOLERANCE
      ) {
        return { kind: 'body' };
      }
    }
    return null;
  }

  handles(drawing: Drawing, view: DrawingView): PixelPoint[] {
    return toPixels(drawing.points, view).filter((p): p is PixelPoint => p !== null);
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

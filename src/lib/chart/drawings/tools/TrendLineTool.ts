import type { Drawing, DrawingStyle, DrawingTool, DrawingView, HitZone, PixelPoint, RenderOptions } from '../types';
import { DEFAULT_STYLE } from '../types';
import { distanceToSegment, toPixels } from '../geometry';
import { applyLineStyle, drawHandle, HIT_TOLERANCE } from './shared';
import type { DataPoint } from '../../types';

export class TrendLineTool implements DrawingTool {
  readonly type = 'trendline' as const;
  readonly requiredPoints = 2;
  readonly cursor = 'crosshair';

  defaultStyle(): DrawingStyle {
    return { ...DEFAULT_STYLE, lineColor: '#2962ff' };
  }

  render(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    view: DrawingView,
    options: RenderOptions,
  ): void {
    const [a, b] = toPixels(drawing.points, view);
    ctx.save();
    applyLineStyle(ctx, drawing.style);
    ctx.strokeStyle = drawing.style.lineColor;

    if (a && b) {
      // Extend the line slightly past both ends for a classic trendline feel.
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      if (drawing.style.showLabels && drawing.label) {
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        ctx.font = `500 ${drawing.style.fontSize ?? 12}px sans-serif`;
        ctx.fillStyle = drawing.style.textColor ?? '#e0e3eb';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(drawing.label, mid.x, mid.y - 8);
      }
    }

    if (options.selected || options.hovered || options.preview) {
      for (const [index, point] of [a, b].entries()) {
        if (point) drawHandle(ctx, point, drawing.style.lineColor, options.activeHandle === index);
      }
    }
    ctx.restore();
  }

  hitTest(drawing: Drawing, point: PixelPoint, view: DrawingView): HitZone {
    const pixels = toPixels(drawing.points, view);
    const [a, b] = pixels;
    for (let i = 0; i < pixels.length; i += 1) {
      const handle = pixels[i];
      if (handle && Math.hypot(handle.x - point.x, handle.y - point.y) <= HIT_TOLERANCE + 2) {
        return { kind: 'handle', index: i };
      }
    }
    if (a && b && distanceToSegment(point, a, b) <= HIT_TOLERANCE) {
      return { kind: 'body' };
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

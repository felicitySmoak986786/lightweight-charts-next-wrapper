import type { Drawing, DrawingStyle, DrawingTool, DrawingView, HitZone, PixelPoint, RenderOptions } from '../types';
import { DEFAULT_STYLE } from '../types';
import type { DataPoint } from '../../types';
import { pointInRect, toPixels } from '../geometry';
import { applyLineStyle, drawHandle, HIT_TOLERANCE } from './shared';

/**
 * Rectangle / square tool defined by two opposite corners.
 * Exposes four corner handles; the two extra corners map back onto the two
 * stored data points.
 */
export class RectangleTool implements DrawingTool {
  readonly type = 'rectangle' as const;
  readonly requiredPoints = 2;
  readonly cursor = 'crosshair';

  defaultStyle(): DrawingStyle {
    return {
      ...DEFAULT_STYLE,
      lineColor: '#26a69a',
      fillColor: 'rgba(38, 166, 154, 0.15)',
      lineStyle: 'solid',
    };
  }

  render(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    view: DrawingView,
    options: RenderOptions,
  ): void {
    const [a, b] = toPixels(drawing.points, view);
    if (!a || !b) return;
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

    if (drawing.style.showLabels && drawing.label) {
      ctx.setLineDash([]);
      ctx.font = `600 ${drawing.style.fontSize ?? 12}px sans-serif`;
      const textWidth = ctx.measureText(drawing.label).width;
      const labelX = x + width / 2 - textWidth / 2;
      const labelY = y - 6;
      ctx.fillStyle = drawing.style.textColor ?? '#e0e3eb';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(drawing.label, labelX, labelY);
    }

    if (options.selected || options.hovered || options.preview) {
      this.handles(drawing, view).forEach((point, index) => {
        drawHandle(ctx, point, drawing.style.lineColor, options.activeHandle === index);
      });
    }
    ctx.restore();
  }

  hitTest(drawing: Drawing, point: PixelPoint, view: DrawingView): HitZone {
    const pixels = this.handles(drawing, view);
    for (let i = 0; i < pixels.length; i += 1) {
      if (Math.hypot(pixels[i].x - point.x, pixels[i].y - point.y) <= HIT_TOLERANCE + 3) {
        return { kind: 'handle', index: i };
      }
    }
    const [a, b] = toPixels(drawing.points, view);
    if (a && b && pointInRect(point, a, b)) return { kind: 'body' };
    return null;
  }

  handles(drawing: Drawing, view: DrawingView): PixelPoint[] {
    const [a, b] = toPixels(drawing.points, view);
    if (!a || !b) return [];
    // index 0 -> p0, index 1 -> p1, index 2 -> (p0.time, p1.price), index 3 -> (p1.time, p0.price)
    return [a, b, { x: a.x, y: b.y }, { x: b.x, y: a.y }];
  }

  moveHandle(drawing: Drawing, index: number, point: DataPoint): void {
    const [p0, p1] = drawing.points;
    if (!p0 || !p1) return;
    switch (index) {
      case 0:
        drawing.points[0] = { ...point };
        break;
      case 1:
        drawing.points[1] = { ...point };
        break;
      case 2:
        drawing.points[0] = { time: point.time, price: p0.price, logical: point.logical };
        drawing.points[1] = { time: p1.time, price: point.price, logical: p1.logical };
        break;
      case 3:
        drawing.points[1] = { time: point.time, price: p1.price, logical: point.logical };
        drawing.points[0] = { time: p0.time, price: point.price, logical: p0.logical };
        break;
      default:
        break;
    }
  }

  translate(drawing: Drawing, deltaTime: number, deltaPrice: number): void {
    drawing.points = drawing.points.map((p) => ({
      time: p.time + deltaTime,
      price: p.price + deltaPrice,
    }));
  }
}

import type { DrawingStyle, LineStyleName, PixelPoint, RenderOptions } from '../types';
import { roundRect } from '../geometry';

export const HANDLE_RADIUS = 5;
export const HIT_TOLERANCE = 7;

export function applyLineStyle(ctx: CanvasRenderingContext2D, style: DrawingStyle): void {
  ctx.lineWidth = style.lineWidth;
  const dash: Record<LineStyleName, number[]> = {
    solid: [],
    dashed: [8, 5],
    dotted: [2, 4],
  };
  ctx.setLineDash(dash[style.lineStyle]);
}

export function drawHandle(
  ctx: CanvasRenderingContext2D,
  point: PixelPoint,
  color: string,
  active = false,
  radius = HANDLE_RADIUS,
): void {
  ctx.save();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = active ? '#ffffff' : '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}

export interface LabelOptions {
  background?: string;
  color?: string;
  border?: string;
  align?: 'left' | 'right' | 'center';
  fontSize?: number;
  paddingX?: number;
  paddingY?: number;
}

/**
 * Draws a small floating label box anchored at `anchor`. `align` controls which
 * side of the anchor the box grows toward (right by default).
 */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  anchor: PixelPoint,
  lines: string[],
  viewWidth: number,
  viewHeight: number,
  options: LabelOptions = {},
): void {
  if (lines.length === 0) return;
  const fontSize = options.fontSize ?? 12;
  const paddingX = options.paddingX ?? 8;
  const paddingY = options.paddingY ?? 6;
  const lineHeight = fontSize + 4;

  ctx.save();
  ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = lines.length * lineHeight + paddingY * 2;

  let x = anchor.x;
  if (options.align === 'right') x -= boxWidth;
  else if (options.align === 'center') x -= boxWidth / 2;

  let y = anchor.y;
  // Keep the label inside the viewport.
  x = Math.max(2, Math.min(viewWidth - boxWidth - 2, x));
  y = Math.max(2, Math.min(viewHeight - boxHeight - 2, y));

  ctx.fillStyle = options.background ?? 'rgba(30, 34, 45, 0.95)';
  roundRect(ctx, x, y, boxWidth, boxHeight, 6);
  ctx.fill();
  if (options.border) {
    ctx.strokeStyle = options.border;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = options.color ?? '#e0e3eb';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((line, index) => {
    ctx.fillText(line, x + paddingX, y + paddingY + index * lineHeight);
  });
  ctx.restore();
}

export function isActive(options: RenderOptions, handleIndex: number): boolean {
  return options.activeHandle === handleIndex;
}

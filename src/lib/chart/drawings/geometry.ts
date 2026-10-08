import type { DrawingView, PixelPoint } from './types';
import type { DataPoint, UnixTime } from '../types';

export function distance(a: PixelPoint, b: PixelPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Shortest distance from point `p` to segment `a`-`b`. */
export function distanceToSegment(p: PixelPoint, a: PixelPoint, b: PixelPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Distance from a point to an infinite line through a-b. */
export function distanceToLine(p: PixelPoint, a: PixelPoint, b: PixelPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return distance(p, a);
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / length;
}

export function pointInRect(p: PixelPoint, a: PixelPoint, b: PixelPoint, tolerance = 0): boolean {
  const minX = Math.min(a.x, b.x) - tolerance;
  const maxX = Math.max(a.x, b.x) + tolerance;
  const minY = Math.min(a.y, b.y) - tolerance;
  const maxY = Math.max(a.y, b.y) + tolerance;
  return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
}

export function pointInPolygon(p: PixelPoint, polygon: PixelPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function midpoint(a: PixelPoint, b: PixelPoint): PixelPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Map a list of data points to pixels, skipping any that fall outside data. */
export function toPixels(points: DataPoint[], view: DrawingView): (PixelPoint | null)[] {
  return points.map((point) => {
    const x = point.logical !== undefined ? view.logicalToX(point.logical) : view.timeToX(point.time);
    const y = view.priceToY(point.price);
    if (x === null || y === null) return null;
    return { x, y };
  });
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export function formatPrice(value: number, precision = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

export function formatSigned(value: number, precision = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatPrice(Math.abs(value), precision)}`;
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

export function formatDuration(seconds: number): string {
  const abs = Math.abs(seconds);
  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes && !days) parts.push(`${minutes}m`);
  return parts.length ? parts.join(' ') : '<1m';
}

export function timeDeltaLabel(from: UnixTime, to: UnixTime): string {
  return formatDuration(to - from);
}

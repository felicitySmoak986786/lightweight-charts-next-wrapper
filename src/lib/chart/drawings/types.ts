import type { DataPoint, UnixTime } from '../types';

export type DrawingType =
  | 'trendline'
  | 'rectangle'
  | 'ruler'
  | 'longPosition'
  | 'shortPosition';

export type LineStyleName = 'solid' | 'dashed' | 'dotted';

export interface DrawingStyle {
  lineColor: string;
  lineWidth: number;
  lineStyle: LineStyleName;
  fillColor?: string;
  textColor?: string;
  fontSize?: number;
  showLabels?: boolean;
}

export interface Drawing {
  id: string;
  type: DrawingType;
  points: DataPoint[];
  style: DrawingStyle;
  locked: boolean;
  visible: boolean;
  label?: string;
  meta?: Record<string, unknown>;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export interface DrawingView {
  timeToX(time: UnixTime): number | null;
  /** Fractional bar index -> pixel X (continuous free placement). */
  logicalToX(logical: number): number | null;
  priceToY(price: number): number | null;
  xToTime(x: number): number | null;
  yToPrice(y: number): number | null;
  width: number;
  height: number;
}

export type HitZone =
  | { kind: 'handle'; index: number }
  | { kind: 'body' }
  | null;

export interface RenderOptions {
  selected: boolean;
  hovered: boolean;
  activeHandle: number | null;
  preview: boolean;
  /** Lightweight-charts time formatter for ruler labels. */
  formatTime?: (time: UnixTime) => string;
  /** Number of bars between two timestamps (ruler bar count). */
  barsBetween?: (from: UnixTime, to: UnixTime) => number;
}

export interface DrawingTool {
  type: DrawingType;
  /** Number of anchor points the user must place to finish the drawing. */
  requiredPoints: number;
  /** CSS cursor while the tool is armed. */
  cursor: string;
  /** When true, the 3rd point is optional and the drawing closes on double click. */
  allowEarlyFinish?: boolean;
  defaultStyle(): DrawingStyle;
  render(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    view: DrawingView,
    options: RenderOptions,
  ): void;
  hitTest(drawing: Drawing, point: PixelPoint, view: DrawingView): HitZone;
  handles(drawing: Drawing, view: DrawingView): PixelPoint[];
  /** Move a single anchor handle to a new data-space point. */
  moveHandle(drawing: Drawing, index: number, point: DataPoint): void;
  /** Translate the whole drawing by a data-space delta. */
  translate(drawing: Drawing, deltaTime: number, deltaPrice: number): void;
}

export interface DrawingManagerEvents {
  created: Drawing;
  updated: Drawing;
  removed: Drawing;
  /** Any change to the collection (add/update/remove/clear). */
  change: Drawing[];
  selection: Drawing | null;
  tool: DrawingType | 'select' | null;
}

export const DEFAULT_STYLE: DrawingStyle = {
  lineColor: '#2962ff',
  lineWidth: 2,
  lineStyle: 'solid',
  fillColor: 'rgba(41, 98, 255, 0.12)',
  textColor: '#e0e3eb',
  fontSize: 12,
  showLabels: true,
};

/**
 * Public entry point for the lightweight-charts Next.js wrapper.
 *
 * ```ts
 * import { ChartClient } from '@/lib/chart';
 * ```
 */
export { ChartClient } from './ChartClient';
export type { ChartClientEvents, SignalInput } from './ChartClient';

export { ChartEngine } from './core/ChartEngine';
export type { ChartEngineEvents, ChartType } from './core/ChartEngine';
export { DataStore } from './core/DataStore';
export { CoordinateSpace } from './core/CoordinateSpace';
export { EventBus } from './core/EventBus';

export { DrawingManager } from './drawings/DrawingManager';
export type { AddDrawingInput } from './drawings/DrawingManager';
export { DrawingLayer } from './drawings/DrawingLayer';
export type { DrawingLayerOptions } from './drawings/DrawingLayer';
export { DRAWING_TOOLS, TOOL_LABELS } from './drawings/tools/registry';
export type {
  Drawing,
  DrawingStyle,
  DrawingTool,
  DrawingType,
  DrawingView,
  HitZone,
  PixelPoint,
} from './drawings/types';
export { TrendLineTool } from './drawings/tools/TrendLineTool';
export { RectangleTool } from './drawings/tools/RectangleTool';
export { RulerTool } from './drawings/tools/RulerTool';
export { PositionTool } from './drawings/tools/PositionTool';

export { IndicatorEngine } from './indicators/IndicatorEngine';
export { defineIndicator } from './indicators/runtime/TsIndicatorRuntime';
export { TsIndicatorRuntime } from './indicators/runtime/TsIndicatorRuntime';
export { CsIndicatorBridge } from './indicators/runtime/CsIndicatorBridge';
export type { CsIndicatorMetadata } from './indicators/runtime/CsIndicatorBridge';
export { indicatorUtils } from './indicators/math';
export { builtinIndicators } from './indicators/registry';
export type {
  IndicatorContext,
  IndicatorDefinition,
  IndicatorInstance,
  IndicatorParamSpec,
  IndicatorParamValue,
  IndicatorPlot,
  IndicatorResult,
  IndicatorSignal,
  IndicatorUtils,
  PlotPoint,
  SignalKind,
} from './indicators/types';

export { MarkerManager } from './markers/MarkerManager';
export type { OrderLine, PriceMarker, SignalMarker } from './markers/MarkerManager';

export { ReplayController } from './replay/ReplayController';
export type { ReplayState } from './replay/ReplayController';

export type {
  Candle,
  ChartWrapperOptions,
  DataPoint,
  ThemeOptions,
  UnixTime,
} from './types';

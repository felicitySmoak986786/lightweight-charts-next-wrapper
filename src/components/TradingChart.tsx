'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ChartClient } from '@/lib/chart';
import type {
  Candle,
  Drawing,
  DrawingLayerOptions,
  DrawingType,
  IndicatorInstance,
  IndicatorParamValue,
  ReplayState,
  ThemeOptions,
} from '@/lib/chart';
import { useTradingChart } from '@/hooks/useTradingChart';

export interface TradingChartHandle {
  /** The underlying facade. Null until the chart has mounted. */
  client: ChartClient | null;
}

export interface TradingChartProps {
  data?: Candle[];
  theme?: ThemeOptions;
  showVolume?: boolean;
  height?: number | string;
  width?: number | string;
  className?: string;
  style?: CSSProperties;
  /** Controlled active drawing tool. */
  activeTool?: DrawingType | 'select' | null;
  /** Drawing interaction tuning (magnet, snap, auto-scroll, tool persistence). */
  drawingOptions?: DrawingLayerOptions;
  /** Indicators created on mount, e.g. `[{ id: 'sma', params: { period: 50 } }]`. */
  initialIndicators?: Array<{ id: string; params?: Record<string, IndicatorParamValue> }>;
  onReady?: (client: ChartClient) => void;
  onSelectionChange?: (drawing: Drawing | null) => void;
  onDrawingsChange?: (drawings: Drawing[]) => void;
  onIndicatorsChange?: (instances: IndicatorInstance[]) => void;
  onReplayChange?: (state: ReplayState) => void;
  children?: ReactNode;
}

/**
 * Drop-in Next.js component wrapping the chart facade. Provides a simple
 * declarative surface (`data`, `theme`, `activeTool`, `initialIndicators`) plus
 * callbacks, while the imperative `ChartClient` is available through the ref.
 */
export const TradingChart = forwardRef<TradingChartHandle, TradingChartProps>(function TradingChart(
  {
    data,
    theme,
    showVolume = true,
    height = 520,
    width = '100%',
    className,
    style,
    activeTool,
    drawingOptions,
    initialIndicators,
    onReady,
    onSelectionChange,
    onDrawingsChange,
    onIndicatorsChange,
    onReplayChange,
    children,
  },
  ref,
) {
  const { containerRef, client } = useTradingChart({ showVolume, ...drawingOptions });
  const initializedRef = useRef(false);

  useImperativeHandle(ref, () => ({ client }), [client]);

  // Initialise data, theme and indicators once the client exists.
  useEffect(() => {
    if (!client || initializedRef.current) return;
    initializedRef.current = true;
    if (theme) client.engine.applyTheme(theme);
    if (data) client.setData(data);
    if (initialIndicators) {
      for (const indicator of initialIndicators) {
        try {
          client.createIndicator(indicator.id, indicator.params);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`Failed to create indicator "${indicator.id}"`, error);
        }
      }
    }
    onReady?.(client);
    // Only run once for the initial configuration; later props are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  useEffect(() => {
    if (!client || !initializedRef.current) return;
    if (data) client.setData(data);
  }, [client, data]);

  useEffect(() => {
    if (!client || !initializedRef.current) return;
    if (theme) client.engine.applyTheme(theme);
  }, [client, theme]);

  useEffect(() => {
    if (!client || !initializedRef.current) return;
    if (activeTool !== undefined) client.setTool(activeTool);
  }, [client, activeTool]);

  useEffect(() => {
    if (!client) return undefined;
    const offSelection = onSelectionChange ? client.on('selection', onSelectionChange) : undefined;
    const offDrawings = onDrawingsChange ? client.on('drawings', onDrawingsChange) : undefined;
    const offIndicators = onIndicatorsChange ? client.on('indicators', onIndicatorsChange) : undefined;
    const offReplay = onReplayChange ? client.on('replay', onReplayChange) : undefined;

    // Push the current state so subscribers start in sync (events emitted during
    // initial setup, before these handlers were attached, would otherwise be lost).
    if (onIndicatorsChange) onIndicatorsChange(client.listIndicators());
    if (onDrawingsChange) onDrawingsChange(client.drawings.list());
    if (onReplayChange) onReplayChange(client.replayState);

    return () => {
      offSelection?.();
      offDrawings?.();
      offIndicators?.();
      offReplay?.();
    };
  }, [client, onSelectionChange, onDrawingsChange, onIndicatorsChange, onReplayChange]);

  return (
    <div
      className={className}
      style={{ position: 'relative', width, height, ...style }}
    >
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {children}
    </div>
  );
});

'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { ChartClient, type ChartClientEvents } from '@/lib/chart';
import type { ChartWrapperOptions } from '@/lib/chart';
import type { DrawingLayerOptions } from '@/lib/chart';

export type UseTradingChartOptions = ChartWrapperOptions & DrawingLayerOptions;

export interface UseTradingChartResult {
  containerRef: RefObject<HTMLDivElement | null>;
  client: ChartClient | null;
  ready: boolean;
}

/**
 * Creates and owns a {@link ChartClient} for the lifetime of the component.
 * The returned container ref must be attached to the chart host element.
 */
export function useTradingChart(options: UseTradingChartOptions = {}): UseTradingChartResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [client, setClient] = useState<ChartClient | null>(null);
  const [ready, setReady] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const instance = new ChartClient(container, optionsRef.current);
    setClient(instance);
    setReady(true);

    return () => {
      setReady(false);
      setClient(null);
      instance.destroy();
    };
  }, []);

  return { containerRef, client, ready };
}

/** Subscribe to a typed ChartClient event for the component lifetime. */
export function useChartEvent<K extends keyof ChartClientEvents>(
  client: ChartClient | null,
  event: K,
  handler: (payload: ChartClientEvents[K]) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!client) return undefined;
    return client.on(event, (payload) => handlerRef.current(payload));
  }, [client, event]);
}

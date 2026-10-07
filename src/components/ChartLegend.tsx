'use client';

import { useEffect, useRef } from 'react';
import type { ChartClient } from '@/lib/chart';

export interface ChartLegendProps {
  client: ChartClient | null;
  symbol: string;
}

const FIELDS = ['O', 'H', 'L', 'C'] as const;

/**
 * Angel One / TradingView style OHLC readout overlaid on the chart. Updates via
 * direct DOM writes (no React re-render) on crosshair movement for performance.
 */
export function ChartLegend({ client, symbol }: ChartLegendProps) {
  const refs = useRef<Record<string, HTMLSpanElement | null>>({});
  const changeRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!client) return undefined;

    const set = (key: string, text: string, className = '') => {
      const el = refs.current[key];
      if (!el) return;
      el.textContent = text;
      el.className = className;
    };

    const update = (time?: number) => {
      const candles = client.store.revealed();
      if (candles.length === 0) return;
      let index = candles.length - 1;
      if (time !== undefined) {
        const found = candles.findIndex((candle) => candle.time === time);
        if (found >= 0) index = found;
      }
      const candle = candles[index];
      const previous = candles[index - 1] ?? candle;
      const up = candle.close >= candle.open;
      const color = up ? 'up' : 'down';
      const decimals = 2;

      set('O', candle.open.toFixed(decimals), `ao-field ${color}`);
      set('H', candle.high.toFixed(decimals), `ao-field ${color}`);
      set('L', candle.low.toFixed(decimals), `ao-field ${color}`);
      set('C', candle.close.toFixed(decimals), `ao-field ${color}`);
      set('V', (candle.volume ?? 0).toLocaleString());

      const change = candle.close - previous.close;
      const percent = previous.close !== 0 ? (change / previous.close) * 100 : 0;
      if (changeRef.current) {
        changeRef.current.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(decimals)} (${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%)`;
        changeRef.current.className = change >= 0 ? 'up' : 'down';
      }
    };

    const offCrosshair = client.on('crosshair', (param) => {
      const time = typeof param.time === 'number' ? param.time : undefined;
      update(time);
    });
    const offData = client.on('data', () => update());
    const offChartType = client.on('chartType', () => update());
    const offReplay = client.on('replay', () => update());

    update();

    return () => {
      offCrosshair();
      offData();
      offChartType();
      offReplay();
    };
  }, [client]);

  return (
    <div className="ao-legend">
      <span className="legend-symbol">{symbol}</span>
      {FIELDS.map((field) => (
        <span key={field} className="legend-item">
          {field} <span ref={(el) => { refs.current[field] = el; }} className="ao-field">--</span>
        </span>
      ))}
      <span className="legend-item">
        Chg <span ref={changeRef} className="ao-field">--</span>
      </span>
      <span className="legend-item">
        Vol <span ref={(el) => { refs.current.V = el; }} className="ao-field">--</span>
      </span>
    </div>
  );
}

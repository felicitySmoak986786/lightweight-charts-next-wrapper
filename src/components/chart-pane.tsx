"use client";

import { useEffect, useRef } from "react";
import { createChart, darkTheme, type Chart } from "openalgo-charts";
import { createSampleSeries, type PaneSpec } from "@/lib/sample-data";

export function ChartPane({ spec }: { spec: PaneSpec }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, { theme: darkTheme });
    chartRef.current = chart;
    const series = chart.addSeries(spec.kind);
    series.setData(createSampleSeries(spec));
    chart.fitContent();

    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, [spec]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#0d1117]">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <span className="text-sm font-semibold tracking-tight text-zinc-100">
          {spec.symbol}
        </span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-zinc-300">
          {spec.interval} · {spec.kind}
        </span>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  );
}

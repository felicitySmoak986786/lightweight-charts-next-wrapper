'use client';

import type { ChartType } from '@/lib/chart';
import type { Timeframe } from '@/lib/data/timeframes';
import { AreaIcon, BarIcon, CandleIcon, IndicatorsIcon, LineIcon, ReplayIcon } from './icons';

export interface ChartToolbarProps {
  timeframes: Timeframe[];
  activeTimeframe: string;
  onTimeframe: (id: string) => void;
  chartType: ChartType;
  onChartType: (type: ChartType) => void;
  onOpenIndicators: () => void;
  indicatorCount: number;
  onToggleReplay: () => void;
  replayActive: boolean;
}

const CHART_TYPES: Array<{ type: ChartType; label: string; Icon: typeof CandleIcon }> = [
  { type: 'candlestick', label: 'Candles', Icon: CandleIcon },
  { type: 'bar', label: 'Bars', Icon: BarIcon },
  { type: 'line', label: 'Line', Icon: LineIcon },
  { type: 'area', label: 'Area', Icon: AreaIcon },
];

export function ChartToolbar({
  timeframes,
  activeTimeframe,
  onTimeframe,
  chartType,
  onChartType,
  onOpenIndicators,
  indicatorCount,
  onToggleReplay,
  replayActive,
}: ChartToolbarProps) {
  return (
    <div className="ao-toolbar">
      <div className="ao-seg" role="tablist" aria-label="Timeframe">
        {timeframes.map((timeframe) => (
          <button
            key={timeframe.id}
            type="button"
            className={activeTimeframe === timeframe.id ? 'active' : ''}
            onClick={() => onTimeframe(timeframe.id)}
          >
            {timeframe.label}
          </button>
        ))}
      </div>

      <div className="ao-divider-v" />

      <div className="ao-seg" aria-label="Chart type">
        {CHART_TYPES.map(({ type, label, Icon }) => (
          <button
            key={type}
            type="button"
            className={chartType === type ? 'active' : ''}
            title={label}
            onClick={() => onChartType(type)}
          >
            <Icon width={15} height={15} />
          </button>
        ))}
      </div>

      <div className="ao-spacer" />

      <button type="button" className="ao-btn" onClick={onOpenIndicators}>
        <IndicatorsIcon width={15} height={15} />
        Indicators
        {indicatorCount > 0 && <span className="ao-badge">{indicatorCount}</span>}
      </button>

      <button
        type="button"
        className={`ao-btn ${replayActive ? 'active' : ''}`}
        onClick={onToggleReplay}
        title="Toggle replay mode"
      >
        <ReplayIcon width={15} height={15} />
        Replay
      </button>
    </div>
  );
}

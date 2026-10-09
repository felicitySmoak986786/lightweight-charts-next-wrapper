import { generateBars, type Bar } from "openalgo-charts";

export type SeriesKind =
  | "candlestick"
  | "hollow-candle"
  | "bar"
  | "line"
  | "area"
  | "baseline"
  | "step"
  | "column"
  | "high-low";

export type PaneSpec = {
  symbol: string;
  interval: string;
  kind: SeriesKind;
  intervalSec: number;
  count: number;
  startTime: number;
  scale: number;
  drift: number;
  wave: number;
  freq: number;
};

const DAY = 86_400;

export const PANES: PaneSpec[] = [
  {
    symbol: "NIFTY 50",
    interval: "1D",
    kind: "candlestick",
    intervalSec: DAY,
    count: 220,
    startTime: 1_704_067_200,
    scale: 210,
    drift: 0.35,
    wave: 40,
    freq: 1,
  },
  {
    symbol: "BANKNIFTY",
    interval: "4H",
    kind: "hollow-candle",
    intervalSec: 4 * 3_600,
    count: 220,
    startTime: 1_704_067_200,
    scale: 95,
    drift: -0.22,
    wave: 30,
    freq: 2,
  },
  {
    symbol: "RELIANCE",
    interval: "1D",
    kind: "area",
    intervalSec: DAY,
    count: 220,
    startTime: 1_704_067_200,
    scale: 2.6,
    drift: 0.05,
    wave: 6,
    freq: 1.5,
  },
  {
    symbol: "TATAMOTORS",
    interval: "1H",
    kind: "column",
    intervalSec: 3_600,
    count: 220,
    startTime: 1_704_067_200,
    scale: 8.5,
    drift: 0.02,
    wave: 3,
    freq: 3,
  },
];

export function createSampleSeries(spec: PaneSpec): Bar[] {
  const base = generateBars(spec.startTime, spec.count, spec.intervalSec);
  const n = Math.max(1, base.length - 1);
  return base.map((bar, i) => {
    const t = i / n;
    const wave = Math.sin(t * Math.PI * 2 * spec.freq) * spec.wave;
    const drift = i * spec.drift;
    const project = (value: number) => (value + wave + drift) * spec.scale - 50;
    const open = project(bar.open);
    const close = project(bar.close);
    const high = project(bar.high);
    const low = project(bar.low);
    return {
      time: bar.time,
      open,
      close,
      high: Math.max(open, close, high),
      low: Math.min(open, close, low),
      volume: bar.volume,
    };
  });
}

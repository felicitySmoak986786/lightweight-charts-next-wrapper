# lightweight-charts Next.js Wrapper

A modular, high-performance Next.js wrapper around
[TradingView lightweight-charts](https://github.com/tradingview/lightweight-charts)
built for finance trading platforms. It layers interactive drawing tools, a
pluggable indicator engine (TypeScript **and** C#), replay mode, order lines and
buy/sell signal markers on top of lightweight-charts behind a small, composable
API.

```
+-----------------------------------------------------------+
|                         ChartClient                        |
|                                                            |
|  ChartEngine      candles + volume + theme + resize        |
|  DataStore        full dataset + replay cursor             |
|  DrawingManager   drawings CRUD + undo/redo                |
|  DrawingLayer     canvas overlay: create/select/modify/del |
|  IndicatorEngine  TS/C# indicators + panes + signals       |
|  MarkerManager    signals + price/order lines              |
|  ReplayController bar-by-bar playback                      |
+-----------------------------------------------------------+
```

## Features

- **Drawing tools** - trend line, rectangle/square, ruler and long/short
  position tools. All drawings support selection, handle resizing, body drag,
  restyling and deletion with full undo/redo.
- **Custom indicators** - author in TypeScript via `defineIndicator`, load
  dynamically from a module URL, or compile C# (`.cs`) to WebAssembly and load
  it through the same pipeline.
- **Replay mode** - reveal bars one at a time with play/pause, step and speed
  controls.
- **Markers & order lines** - buy/sell signal markers at candle points,
  persistent price markers and labelled order lines.
- **Performance** - single `requestAnimationFrame` redraw batching, canvas
  overlay isolated from React renders, incremental bar updates during replay,
  and pointer events intercepted in the capture phase so the chart stays
  pannable.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run typecheck
```

## Demo UI

The bundled demo (`src/app/page.tsx`) reproduces an Angel One style trading
terminal on top of the library:

- **Top bar** - symbol/exchange, live LTP with change and %, theme switch, and
  BUY/SELL buttons that drop an order line plus a signal marker at the last bar.
- **Toolbar** - timeframe switcher (`1m`..`1D`, resampled from a 1-minute base
  series) and a candlestick/bar/line/area chart-type switcher.
- **OHLC legend** - crosshair-driven readout (O/H/L/C, change, volume) updated
  via direct DOM writes so it never re-renders React.
- **Drawing rail** - floating select/trendline/rectangle/ruler/position tools
  with undo/redo/delete/clear.
- **Indicator modal** - add/remove built-ins, load the custom TypeScript
  Donchian channel, or attempt the C# compile flow.
- **Replay bar** - enter replay, play/pause, step, seek and adjust speed.

## Quick start

### Declarative component

```tsx
'use client';

import { TradingChart } from '@/components/TradingChart';

export function PricePanel({ candles }) {
  return (
    <TradingChart
      data={candles}
      height={520}
      activeTool="trendline"
      initialIndicators={[
        { id: 'sma', params: { period: 50 } },
        { id: 'rsi', params: { period: 14 } },
      ]}
      onReady={(client) => {
        client.addOrderLine({ price: 105.5, color: '#26a69a', title: 'TP', label: 'TAKE PROFIT' });
      }}
    />
  );
}
```

### Imperative facade

```ts
import { ChartClient } from '@/lib/chart';

const client = new ChartClient(container, { showVolume: true });
client.setData(candles);

client.setTool('longPosition');          // arm a drawing tool
client.createIndicator('macd');          // built-in indicator
client.addOrderLine({ price: 100, color: '#ef5350', title: 'SL', label: 'STOP LOSS' });
client.setSignals([{ time: candles[10].time, kind: 'buy', text: 'BUY' }]);
client.replay.start();                    // enter replay mode
```

### React hook

```ts
const { containerRef, client } = useTradingChart({ showVolume: true });
```

## Drawing tools

| Tool | Points | Description |
| --- | --- | --- |
| `trendline` | 2 | Line segment with draggable endpoints |
| `rectangle` | 2 | Filled box with four corner handles |
| `ruler` | 2 | Measures price change, %, bars and duration |
| `longPosition` | 3 | Entry / target / stop with profit & loss zones + R/R |
| `shortPosition` | 3 | Short variant of the position tool |

Interaction model: click to place anchor points, `Esc` to cancel, drag handles
to modify, drag the body to move, `Delete` to remove, `Ctrl+Z` / `Ctrl+Shift+Z`
to undo/redo. Drawings can be exported/imported as JSON via
`serializeDrawings()` / `loadDrawings()`.

### Custom drawing tools

Implement the `DrawingTool` interface and register it:

```ts
client.registerDrawingTool(new MyTool());
client.setTool('myTool' as never);
```

## Indicators

Built-ins: `sma`, `ema`, `bollinger`, `vwap`, `rsi`, `macd`, `smaCross`
(the last also emits buy/sell signals).

### TypeScript indicators

```ts
import { defineIndicator } from '@/lib/chart';

const momentum = defineIndicator({
  id: 'momentum',
  name: 'Momentum',
  overlay: false,
  params: [{ name: 'period', label: 'Period', type: 'number', default: 10 }],
  compute({ candles, params, utils }) {
    const closes = candles.map((c) => c.close);
    const roc = closes.map((close, i) =>
      i < Number(params.period) ? undefined : close - closes[i - Number(params.period)],
    );
    return {
      plots: [
        {
          id: 'roc',
          type: 'line',
          data: candles
            .map((c, i) => ({ time: c.time, value: roc[i] }))
            .filter((p): p is { time: number; value: number } => p.value !== undefined),
        },
      ],
    };
  },
});

client.registerIndicator(momentum);
client.createIndicator('momentum', { period: 14 });
```

Load a third-party indicator module at runtime:

```ts
await client.loadTsIndicator('https://cdn.example.com/indicators/ichimoku.js');
```

### C# indicators

C# indicators are compiled to WebAssembly and bridged through an ABI that
exposes `alloc`, `free`, `compute` and `result_len`. The bridge serialises
`{ candles, params }` as JSON, calls into the module, and parses the returned
JSON `IndicatorResult`.

```ts
await client.loadCSharpIndicator(source, {
  id: 'cs_sma',
  name: 'C# SMA',
  overlay: true,
  params: [{ name: 'period', label: 'Period', type: 'number', default: 20 }],
});
```

Precompiled modules can be loaded directly:

```ts
const definition = await client.csIndicators.loadFromUrl('/indicators/sma.wasm', metadata);
client.registerIndicator(definition);
```

Compilation has two paths:

1. **On the server** - `POST /api/indicators/cs/compile` with `{ source }`.
   The route shells out to `cs-indicators/build.sh`, which requires the .NET SDK
   with the `wasm-tools` workload:
   ```bash
   dotnet workload install wasm-tools
   ```
   The route returns `501` with instructions when the SDK is missing.
2. **Ahead of time** - build with `cs-indicators/build.sh` (or your own
   pipeline) and load the `.wasm` with `loadFromUrl`.

A sample indicator lives in `cs-indicators/SmaIndicator.cs`. The in-app
"Compile C# sample" button demonstrates the full flow and degrades gracefully
with a helpful message when the SDK is unavailable.

## Markers, order lines and signals

```ts
client.addOrderLine({ price: 101.5, color: '#26a69a', title: 'TP', label: 'TAKE PROFIT' });
client.addPriceMarker({ price: 100, color: '#f0b90b', title: 'entry' });
client.setSignals([
  { time: t1, kind: 'buy', text: 'BUY' },
  { time: t2, kind: 'sell', text: 'SELL' },
]);
client.removeMarker(id);
client.clearMarkers();
```

Indicator-emitted signals are routed to `MarkerManager` automatically under the
`__indicators__` source, so signal indicators and manual markers coexist.

## Replay

```ts
client.replay.start(400);     // enter replay at bar 400
client.replay.play();
client.replay.pause();
client.replay.step(-1);
client.replay.setSpeed(8);    // bars per second
client.replay.seek(500);
client.replay.stop();         // reveal full dataset
```

## Public API

Everything is re-exported from `src/lib/chart/index.ts`:

- `ChartClient` - facade composing all modules
- `TradingChart` - React component (`src/components/TradingChart.tsx`)
- `useTradingChart` / `useChartEvent` - hooks
- `ChartEngine`, `DataStore`, `CoordinateSpace`, `EventBus`
- `DrawingManager`, `DrawingLayer`, `TrendLineTool`, `RectangleTool`,
  `RulerTool`, `PositionTool`, `DrawingTool`
- `IndicatorEngine`, `defineIndicator`, `TsIndicatorRuntime`,
  `CsIndicatorBridge`, `indicatorUtils`, `builtinIndicators`
- `MarkerManager`, `ReplayController`

## Notes on the WASI runtime

`CsIndicators.csproj` targets `wasi-wasm`, which emits a WASI module. Browsers
need a small WASI shim (`wasi_snapshot_preview1`) when instantiating such
modules. If you prefer a pure `env` ABI, build with a NativeAOT-LLVM browser
target and the existing `CsIndicatorBridge` will instantiate it without changes.

## Project layout

```
src/
  app/                       Next.js App Router demo + compile API
  components/                TradingChart, toolbar, indicator panel, replay bar
  hooks/                     useTradingChart, useChartEvent
  lib/chart/                 the wrapper library
    core/                    engine, data store, coordinates, event bus
    drawings/                manager, canvas layer, tools
    indicators/              types, math, builtins, engine, runtimes
    markers/                 signal & order-line manager
    replay/                  replay controller
  lib/data/                  demo data, custom indicator, C# sample
cs-indicators/               C# sample + build script
```

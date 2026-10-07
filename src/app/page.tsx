'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TradingChart, type TradingChartHandle } from '@/components/TradingChart';
import { TopBar } from '@/components/TopBar';
import { ChartToolbar } from '@/components/ChartToolbar';
import { DrawingRail } from '@/components/DrawingRail';
import { ChartLegend } from '@/components/ChartLegend';
import { IndicatorPanel } from '@/components/IndicatorPanel';
import { ReplayBar } from '@/components/ReplayBar';
import { generateCandles } from '@/lib/data/sampleData';
import { TIMEFRAMES, resample } from '@/lib/data/timeframes';
import { customIndicators } from '@/lib/data/customIndicators';
import { csSampleSource, csSampleMetadata } from '@/lib/data/csSample';
import type {
  Candle,
  ChartClient,
  ChartType,
  Drawing,
  DrawingType,
  IndicatorDefinition,
  IndicatorInstance,
  ReplayState,
  ThemeOptions,
} from '@/lib/chart';

const SYMBOL = 'RELIANCE';
const EXCHANGE = 'NSE';

const DARK_THEME: ThemeOptions = {
  background: '#131722',
  textColor: '#b2b5be',
  gridColor: '#1e222d',
  borderColor: '#2a2e39',
  upColor: '#089981',
  downColor: '#f23645',
  crosshairColor: '#758696',
};

const LIGHT_THEME: ThemeOptions = {
  background: '#ffffff',
  textColor: '#5d606b',
  gridColor: '#f0f3fa',
  borderColor: '#e0e3eb',
  upColor: '#089981',
  downColor: '#f23645',
  crosshairColor: '#9598a1',
};

interface PriceInfo {
  price: number;
  change: number;
  changePercent: number;
}

export default function HomePage() {
  const chartRef = useRef<TradingChartHandle>(null);
  const clientRef = useRef<ChartClient | null>(null);

  const [client, setClient] = useState<ChartClient | null>(null);
  const [tool, setTool] = useState<DrawingType | 'select'>('select');
  const [selection, setSelection] = useState<Drawing | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [definitions, setDefinitions] = useState<IndicatorDefinition[]>([]);
  const [indicators, setIndicators] = useState<IndicatorInstance[]>([]);
  const [replay, setReplay] = useState<ReplayState | null>(null);
  const [replayActive, setReplayActive] = useState(false);
  const [timeframe, setTimeframe] = useState('15m');
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [priceInfo, setPriceInfo] = useState<PriceInfo>({ price: 0, change: 0, changePercent: 0 });

  // Base dataset at 1-minute resolution; other timeframes are aggregated from it.
  const baseData = useMemo(() => generateCandles({ count: 60 * 24 * 5, interval: 60, seed: 20240517 }), []);
  const data = useMemo(() => {
    const timeframeDef = TIMEFRAMES.find((item) => item.id === timeframe) ?? TIMEFRAMES[2];
    return resample(baseData, timeframeDef.seconds);
  }, [baseData, timeframe]);

  const theme = dark ? DARK_THEME : LIGHT_THEME;

  const refreshPrice = useCallback(() => {
    const c = clientRef.current;
    if (!c) return;
    const candles = [...c.store.revealed()];
    if (candles.length === 0) return;
    const last = candles[candles.length - 1];
    const previous = candles[candles.length - 2] ?? last;
    const change = last.close - previous.close;
    setPriceInfo({
      price: last.close,
      change,
      changePercent: previous.close !== 0 ? (change / previous.close) * 100 : 0,
    });
  }, []);

  const handleReady = useCallback(
    (c: ChartClient) => {
      clientRef.current = c;
      setClient(c);
      for (const definition of customIndicators) c.registerIndicator(definition);
      setDefinitions(c.listIndicatorDefinitions());
      refreshPrice();
      setStatus('Chart ready. Use the timeframe bar, indicator menu and the drawing rail on the left.');
    },
    [refreshPrice],
  );

  useEffect(() => {
    if (!client) return undefined;
    const offTool = client.on('tool', (next) => setTool(next ?? 'select'));
    const offData = client.on('data', refreshPrice);
    const offReplay = client.on('replay', refreshPrice);
    return () => {
      offTool();
      offData();
      offReplay();
    };
  }, [client, refreshPrice]);

  const handleTool = useCallback((next: DrawingType | 'select') => setTool(next), []);

  const handleTimeframe = useCallback((id: string) => setTimeframe(id), []);

  const handleChartType = useCallback((type: ChartType) => {
    setChartType(type);
    clientRef.current?.setChartType(type);
  }, []);

  const handleDelete = useCallback(() => clientRef.current?.drawings.removeSelected(), []);
  const handleClear = useCallback(() => clientRef.current?.clearDrawings(), []);
  const handleUndo = useCallback(() => clientRef.current?.undo(), []);
  const handleRedo = useCallback(() => clientRef.current?.redo(), []);

  const handleBuy = useCallback(() => {
    const c = clientRef.current;
    if (!c) return;
    const candles = [...c.store.revealed()];
    const last = candles[candles.length - 1];
    if (!last) return;
    c.addOrderLine({ price: last.close, color: '#089981', title: 'BUY', label: `BUY @ ${last.close.toFixed(2)}` });
    c.addSignal({ time: last.time, kind: 'buy', text: 'BUY', size: 1.3 });
    setStatus(`Buy order placed at ${last.close.toFixed(2)} on ${SYMBOL}.`);
  }, []);

  const handleSell = useCallback(() => {
    const c = clientRef.current;
    if (!c) return;
    const candles = [...c.store.revealed()];
    const last = candles[candles.length - 1];
    if (!last) return;
    c.addOrderLine({ price: last.close, color: '#f23645', title: 'SELL', label: `SELL @ ${last.close.toFixed(2)}` });
    c.addSignal({ time: last.time, kind: 'sell', text: 'SELL', size: 1.3 });
    setStatus(`Sell order placed at ${last.close.toFixed(2)} on ${SYMBOL}.`);
  }, []);

  const handleAddIndicator = useCallback((definitionId: string) => {
    clientRef.current?.createIndicator(definitionId);
  }, []);

  const handleRemoveIndicator = useCallback((instanceId: string) => {
    clientRef.current?.removeIndicator(instanceId);
  }, []);

  const handleLoadTsDemo = useCallback(() => {
    const c = clientRef.current;
    if (!c) return;
    c.registerIndicator(customIndicators[0]);
    c.createIndicator('donchian');
    setStatus('Custom TypeScript indicator "Donchian Channel" loaded on the main pane.');
  }, []);

  const handleCompileCsharp = useCallback(async () => {
    const c = clientRef.current;
    if (!c) return;
    setBusy(true);
    setStatus('Compiling C# indicator...');
    try {
      await c.loadCSharpIndicator(csSampleSource, csSampleMetadata);
      c.createIndicator(csSampleMetadata.id);
      setStatus('C# indicator compiled and loaded.');
    } catch (error) {
      setStatus(
        `C# compilation unavailable: ${error instanceof Error ? error.message : String(error)}. ` +
          'Install the .NET SDK with the wasm-tools workload, or precompile and use CsIndicatorBridge.loadFromUrl().',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const handleStartReplay = useCallback(() => {
    clientRef.current?.replay.start();
    setReplayActive(true);
  }, []);
  const handleStopReplay = useCallback(() => {
    clientRef.current?.replay.stop();
    setReplayActive(false);
  }, []);
  const handleReplayToggle = useCallback(() => clientRef.current?.replay.toggle(), []);
  const handleReplayStep = useCallback((amount: number) => {
    const c = clientRef.current;
    if (!c) return;
    if (!c.replay.isActive) {
      c.replay.start();
      setReplayActive(true);
    }
    c.replay.step(amount);
  }, []);
  const handleReplaySpeed = useCallback((speed: number) => clientRef.current?.replay.setSpeed(speed), []);
  const handleReplaySeek = useCallback((index: number) => clientRef.current?.replay.seek(index), []);

  const toolbarReplay = useCallback(() => {
    if (replayActive) {
      handleStopReplay();
    } else {
      handleStartReplay();
    }
  }, [replayActive, handleStartReplay, handleStopReplay]);

  return (
    <main className="ao-app" data-theme={dark ? 'dark' : 'light'}>
      <TopBar
        symbol={SYMBOL}
        exchange={EXCHANGE}
        price={priceInfo.price}
        change={priceInfo.change}
        changePercent={priceInfo.changePercent}
        dark={dark}
        onToggleTheme={() => setDark((value) => !value)}
        onBuy={handleBuy}
        onSell={handleSell}
      />

      <ChartToolbar
        timeframes={TIMEFRAMES}
        activeTimeframe={timeframe}
        onTimeframe={handleTimeframe}
        chartType={chartType}
        onChartType={handleChartType}
        onOpenIndicators={() => setMenuOpen(true)}
        indicatorCount={indicators.length}
        onToggleReplay={toolbarReplay}
        replayActive={replayActive}
      />

      <div className="ao-chart-wrap">
        <TradingChart
          ref={chartRef}
          data={data as Candle[]}
          theme={theme}
          activeTool={tool}
          height="100%"
          initialIndicators={[
            { id: 'sma', params: { period: 50, color: '#1677ff' } },
            { id: 'rsi', params: { period: 14 } },
          ]}
          onReady={handleReady}
          onSelectionChange={setSelection}
          onDrawingsChange={setDrawings}
          onIndicatorsChange={setIndicators}
          onReplayChange={setReplay}
        >
          <DrawingRail
            activeTool={tool}
            onTool={handleTool}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={client?.drawings.canUndo ?? false}
            canRedo={client?.drawings.canRedo ?? false}
            onDelete={handleDelete}
            canDelete={Boolean(selection)}
            onClear={handleClear}
            canClear={drawings.length > 0}
          />
          <ChartLegend client={client} symbol={SYMBOL} />
        </TradingChart>
      </div>

      <ReplayBar
        state={replay}
        active={replayActive}
        onStart={handleStartReplay}
        onStop={handleStopReplay}
        onToggle={handleReplayToggle}
        onStep={handleReplayStep}
        onSpeed={handleReplaySpeed}
        onSeek={handleReplaySeek}
      />

      <IndicatorPanel
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        definitions={definitions}
        instances={indicators}
        onAdd={handleAddIndicator}
        onRemove={handleRemoveIndicator}
        onLoadTsDemo={handleLoadTsDemo}
        onCompileCsharp={handleCompileCsharp}
        status={status}
        busy={busy}
      />
    </main>
  );
}

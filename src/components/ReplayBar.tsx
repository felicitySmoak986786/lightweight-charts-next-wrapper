'use client';

import type { ReplayState } from '@/lib/chart';

export interface ReplayBarProps {
  state: ReplayState | null;
  active: boolean;
  onStart: () => void;
  onStop: () => void;
  onToggle: () => void;
  onStep: (amount: number) => void;
  onSpeed: (barsPerSecond: number) => void;
  onSeek: (index: number) => void;
}

export function ReplayBar({ state, active, onStart, onStop, onToggle, onStep, onSpeed, onSeek }: ReplayBarProps) {
  const index = state?.index ?? 0;
  const total = state?.total ?? 0;

  return (
    <div className="ao-replay">
      <span className="replay-title">Replay</span>
      {!active ? (
        <button type="button" className="ao-btn" onClick={onStart}>
          Enter replay
        </button>
      ) : (
        <>
          <button type="button" className="ao-btn" onClick={onToggle}>
            {state?.playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" className="ao-btn icon" onClick={() => onStep(-1)} title="Step back">
            &minus;1
          </button>
          <button type="button" className="ao-btn icon" onClick={() => onStep(1)} title="Step forward">
            +1
          </button>
          <button type="button" className="ao-btn" onClick={onStop}>
            Exit
          </button>
        </>
      )}

      <input
        className="ao-range"
        type="range"
        min={1}
        max={Math.max(2, total)}
        value={index}
        onChange={(event) => onSeek(Number(event.target.value))}
        disabled={total === 0}
      />
      <span className="ao-muted">
        {index}/{total}
      </span>
      <label className="ao-muted" title="Playback speed (bars/sec)">
        speed
        <input
          type="range"
          min={1}
          max={30}
          value={state?.speed ?? 2}
          style={{ marginLeft: 8, accentColor: 'var(--brand)' }}
          onChange={(event) => onSpeed(Number(event.target.value))}
        />
        <span> {state?.speed ?? 2}/s</span>
      </label>
    </div>
  );
}

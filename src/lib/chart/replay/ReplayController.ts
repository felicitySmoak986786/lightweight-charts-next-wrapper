import { EventBus } from '../core/EventBus';
import type { ChartEngine } from '../core/ChartEngine';
import type { DataStore } from '../core/DataStore';
import type { Candle } from '../types';

export interface ReplayState {
  playing: boolean;
  index: number;
  total: number;
  speed: number;
}

export interface ReplayEvents {
  state: ReplayState;
  /** Emitted whenever the visible window changes (seek/step/play). */
  tick: Candle;
  finished: void;
}

/**
 * Bar-by-bar market replay. Moves the `DataStore` cursor and keeps the chart in
 * sync (incrementally when possible, full reset when seeking backwards).
 */
export class ReplayController extends EventBus<ReplayEvents> {
  private playing = false;
  private speed = 2; // bars per second
  private timer: ReturnType<typeof setInterval> | null = null;
  private active = false;

  constructor(
    private readonly engine: ChartEngine,
    private readonly store: DataStore,
  ) {
    super();
    this.store.on('cursor', () => this.emitState());
  }

  get isActive(): boolean {
    return this.active;
  }

  get state(): ReplayState {
    return {
      playing: this.playing,
      index: this.store.revealedCount,
      total: this.store.length,
      speed: this.speed,
    };
  }

  /** Enter replay mode, optionally rewinding to a given bar index. */
  start(fromIndex?: number): void {
    this.active = true;
    const target = fromIndex ?? Math.max(1, Math.floor(this.store.length * 0.6));
    this.store.setCursor(target);
    this.applyReveal(0, this.store.revealedCount, true);
    this.engine.setLastPriceVisible(true);
    this.emitState();
  }

  /** Leave replay mode and reveal the full dataset again. */
  stop(): void {
    this.pause();
    this.active = false;
    this.applyReveal(this.store.revealedCount, this.store.length, true);
    this.emitState();
  }

  play(): void {
    if (this.playing) return;
    if (!this.active) this.start();
    if (this.store.isAtEnd) this.seek(Math.max(1, this.store.length - 10));
    this.playing = true;
    this.restartTimer();
    this.emitState();
  }

  pause(): void {
    this.playing = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.emitState();
  }

  toggle(): void {
    this.playing ? this.pause() : this.play();
  }

  setSpeed(barsPerSecond: number): void {
    this.speed = Math.max(0.25, Math.min(60, barsPerSecond));
    if (this.playing) this.restartTimer();
    this.emitState();
  }

  step(amount = 1): void {
    this.pause();
    this.seek(this.store.revealedCount + amount);
  }

  seek(index: number): void {
    const previous = this.store.revealedCount;
    this.store.setCursor(index);
    this.applyReveal(previous, this.store.revealedCount);
    if (this.store.isAtEnd && this.playing) {
      this.pause();
      this.emit('finished', undefined);
    }
  }

  private restartTimer(): void {
    if (this.timer) clearInterval(this.timer);
    const interval = Math.max(16, 1000 / this.speed);
    this.timer = setInterval(() => {
      if (this.store.isAtEnd) {
        this.pause();
        this.emit('finished', undefined);
        return;
      }
      this.seek(this.store.revealedCount + 1);
    }, interval);
  }

  private applyReveal(previousCount: number, nextCount: number, force = false): void {
    const revealed = this.store.revealed();
    if (revealed.length === 0) return;

    if (!force && nextCount === previousCount + 1) {
      // Fast path: reveal a single new bar.
      const next = revealed[revealed.length - 1];
      this.engine.updateCandle(next);
    } else {
      this.engine.setCandleData(revealed);
    }

    const last = revealed[revealed.length - 1];
    this.engine.updateLastPrice(last.close);
    this.emit('tick', last);
  }

  private emitState(): void {
    this.emit('state', this.state);
  }

  destroy(): void {
    this.pause();
  }
}

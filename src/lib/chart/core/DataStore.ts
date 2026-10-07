import { EventBus } from './EventBus';
import type { Candle, UnixTime } from '../types';

export interface DataStoreEvents {
  data: Candle[];
  cursor: number;
}

/**
 * Holds the immutable full dataset plus a "cursor" describing how many bars are
 * currently revealed. Replay mode simply moves the cursor; live mode keeps it at
 * the end.
 */
export class DataStore extends EventBus<DataStoreEvents> {
  private candles: Candle[] = [];
  private cursor = 0;

  setData(candles: Candle[]): void {
    this.candles = [...candles].sort((a, b) => a.time - b.time);
    this.cursor = this.candles.length;
    this.emit('data', this.candles);
    this.emit('cursor', this.cursor);
  }

  /** Append or replace the latest bar (live streaming). */
  upsert(candle: Candle): void {
    const last = this.candles[this.candles.length - 1];
    if (last && candle.time === last.time) {
      this.candles[this.candles.length - 1] = candle;
    } else if (!last || candle.time > last.time) {
      this.candles.push(candle);
      if (this.cursor === this.candles.length - 1) this.cursor = this.candles.length;
    } else {
      const index = this.candles.findIndex((c) => c.time === candle.time);
      if (index >= 0) this.candles[index] = candle;
    }
    this.emit('data', this.candles);
    this.emit('cursor', this.cursor);
  }

  getAt(index: number): Candle | undefined {
    return this.candles[index];
  }

  timeAt(index: number): UnixTime | undefined {
    return this.candles[index]?.time;
  }

  indexOfTime(time: UnixTime): number {
    return this.candles.findIndex((c) => c.time === time);
  }

  /** Full dataset. */
  all(): readonly Candle[] {
    return this.candles;
  }

  /** Bars currently revealed by the cursor. */
  revealed(): Candle[] {
    return this.candles.slice(0, this.cursor);
  }

  get length(): number {
    return this.candles.length;
  }

  get revealedCount(): number {
    return this.cursor;
  }

  get isAtEnd(): boolean {
    return this.cursor >= this.candles.length;
  }

  setCursor(count: number): void {
    const next = Math.max(1, Math.min(this.candles.length, Math.floor(count)));
    if (next === this.cursor) return;
    this.cursor = next;
    this.emit('cursor', this.cursor);
  }
}

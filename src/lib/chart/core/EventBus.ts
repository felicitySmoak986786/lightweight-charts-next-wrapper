/**
 * Minimal, dependency-free, strongly typed event bus.
 * Used to decouple the chart modules (drawings, replay, indicators, markers).
 */
export type Listener<T> = (payload: T) => void;

type AnyListener = (payload: unknown) => void;

export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<AnyListener>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as AnyListener);
    return () => this.off(event, listener);
  }

  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    this.listeners.get(event)?.delete(listener as AnyListener);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    // Copy to allow listeners to unsubscribe during dispatch.
    for (const listener of Array.from(set)) {
      try {
        listener(payload);
      } catch (error) {
        // Never let one bad listener break the dispatch loop.
        // eslint-disable-next-line no-console
        console.error(`[chart] listener for "${String(event)}" threw`, error);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

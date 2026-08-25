import type { Scheduler } from '../src/controller/Scheduler.js';

interface Repeating {
  handler: () => void;
  everyMs: number;
  nextAt: number;
}

/** A Scheduler whose clock only moves when a test tells it to. */
export class FakeScheduler implements Scheduler {
  private time = 0;
  private nextId = 1;
  private readonly repeating = new Map<number, Repeating>();

  now(): number {
    return this.time;
  }

  setInterval(handler: () => void, ms: number): number {
    const id = this.nextId;
    this.nextId += 1;
    this.repeating.set(id, { handler, everyMs: ms, nextAt: this.time + ms });
    return id;
  }

  clearInterval(id: number): void {
    this.repeating.delete(id);
  }

  /** Runs every handler due within the window, in order, then parks the clock. */
  advance(ms: number): void {
    const end = this.time + ms;

    for (;;) {
      let dueId: number | null = null;
      let dueAt = Number.POSITIVE_INFINITY;

      for (const [id, entry] of this.repeating) {
        if (entry.nextAt <= end && entry.nextAt < dueAt) {
          dueId = id;
          dueAt = entry.nextAt;
        }
      }

      if (dueId === null) break;

      const entry = this.repeating.get(dueId);
      if (!entry) break;

      this.time = entry.nextAt;
      entry.nextAt += entry.everyMs;
      entry.handler();
    }

    this.time = end;
  }

  get activeTimers(): number {
    return this.repeating.size;
  }
}

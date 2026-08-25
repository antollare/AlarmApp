/**
 * The timer the alarm countdown runs on, injected so tests can drive time
 * directly instead of waiting on the clock.
 */
export interface Scheduler {
  now(): number;
  setInterval(handler: () => void, ms: number): number;
  clearInterval(id: number): void;
}

export const systemScheduler: Scheduler = {
  now: () => Date.now(),
  setInterval: (handler, ms) => globalThis.setInterval(handler, ms) as unknown as number,
  clearInterval: (id) => globalThis.clearInterval(id as unknown as ReturnType<typeof setInterval>),
};

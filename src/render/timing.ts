/**
 * The clock of the view's short animations: counter splits, merges and folds, the T0 ↔ T1
 * handover, a capital flag making way. `now` is the frame's time in ms. Tests draw at made-up
 * times, earlier ones too, so every animation reads the clock through these.
 */

/** How long past its end an animation still counts as running: the view draws its end state. */
export const ANIM_TAIL_MS = 50;

/**
 * Progress in [0, 1] at `now` of an animation of `ms` that began at `start`. A clock that ran
 * backwards leaves it done, not undone.
 */
export function progress(now: number, start: number, ms: number): number {
  return now < start ? 1 : Math.min(1, (now - start) / ms);
}

/** True while an animation of `ms` that began at `start` runs, its tail included. */
export function running(now: number, start: number, ms: number): boolean {
  return now >= start && now - start < ms + ANIM_TAIL_MS;
}

/** Smoothstep on [0, 1]: symmetric, so a fade turned in mid-way continues from where it is. */
export function smooth(p: number): number {
  return p * p * (3 - 2 * p);
}

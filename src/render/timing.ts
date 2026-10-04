/**
 * The clock of the view's short animations: counter splits, merges and folds, the T0 ↔ T1
 * handover, a capital flag making way. `now` is the frame's time in ms. Tests draw at made-up
 * times, earlier ones too, so every animation reads the clock through these.
 */

/** How long past its end an animation still counts as running: the view draws its end state. */
export const ANIM_TAIL_MS = 50;
/** A layer, a label or a flag coming in or going out (PLAN 2.7): long enough to follow, short enough not to wait for. */
export const FADE_MS = 250;

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

/**
 * A switch that takes time: what it stands for is on or off, and a change is a fade of `ms`.
 * The first answer sets it without a fade; a turn in mid-fade goes on from the value reached.
 * The tier handovers, the capital flags and each city label are such switches (PLAN 2.7).
 */
export class TimedSwitch {
  /** The state held, or fading in. Null before the first answer. */
  on: boolean | null = null;
  /** When the state held began (ms on the clock of `now`). */
  private start = -Infinity;

  constructor(readonly ms: number) {}

  /** Progress toward "on" at `now`, in [0, 1], linear in time. */
  linear(want: boolean, now: number): number {
    if (this.on === null) this.on = want;
    else if (want !== this.on) {
      const reached = progress(now, this.start, this.ms);
      this.on = want;
      this.start = now - (1 - reached) * this.ms;
    }
    const p = progress(now, this.start, this.ms);
    return this.on ? p : 1 - p;
  }

  /** The same, eased: an opacity. */
  value(want: boolean, now: number): number {
    return smooth(this.linear(want, now));
  }

  /** True while a fade runs, its tail included. */
  animating(now: number): boolean {
    return running(now, this.start, this.ms);
  }
}

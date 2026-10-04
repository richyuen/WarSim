/**
 * The clock of the view's short animations: counter splits, merges and folds, the handovers
 * between tiers, flags, labels. `now` is the frame's time in ms. Tests draw at made-up times,
 * earlier ones too, so every animation reads the clock through these.
 *
 * What shows at a zoom is a state and not a function of the zoom (PLAN 2.7): a thing comes in
 * at its threshold, stays until the zoom is ZOOM_HYSTERESIS beyond it, and a change is a fade of
 * FADE_MS of real time. `TimedSwitch` is one such thing, `SwitchBank` a layer's worth of them.
 */

/** How long past its end an animation still counts as running: the view draws its end state. */
export const ANIM_TAIL_MS = 50;
/** A layer, a label or a flag coming in or going out: long enough to follow, short enough not to wait for. */
export const FADE_MS = 250;
/** What is on stays on until the zoom has gone this factor beyond the threshold at which it came in. */
export const ZOOM_HYSTERESIS = 1.15;

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

/**
 * What a layout is told of the things it places, from the frames before: it stays a pure
 * function of this and the camera. `K` names a thing (a city's index, a nation name's key).
 */
export interface SwitchState<K> {
  /** The thing is on now: shown, or fading in. */
  held(key: K): boolean;
  /** Something of it is still on screen (on, or a fade out runs): it is placed though not wanted. */
  visible(key: K): boolean;
  /** Called for a thing that is in view and not placed. */
  hidden?(key: K): void;
}

/**
 * The switches of a layer's things. In a frame the layer asks `frame(now)` for the state to
 * give its layout, takes each placed thing's opacity with `value`, and calls `end`.
 * - A thing new to the bank is set at once: a pan brings it into view as it is.
 * - A thing in view with nothing to show (`hidden`) is off: it fades in when the zoom brings it.
 * - A thing neither placed nor hidden in a frame is out of view and loses its state.
 */
export class SwitchBank<K> {
  private readonly switches = new Map<K, { s: TimedSwitch; frame: number }>();
  private frames = 0;
  private now = 0;
  /** When a thing last changed. */
  private changed = -Infinity;

  constructor(readonly ms = FADE_MS) {}

  frame(now: number): SwitchState<K> {
    this.now = now;
    this.frames++;
    return {
      held: (key) => this.switches.get(key)?.s.on === true,
      visible: (key) => {
        const e = this.switches.get(key);
        return e !== undefined && (e.s.on === true || e.s.animating(now));
      },
      hidden: (key) => void this.value(key, false),
    };
  }

  /** The opacity in this frame of `key`, which should be `want`. */
  value(key: K, want: boolean): number {
    let e = this.switches.get(key);
    if (!e) this.switches.set(key, (e = { s: new TimedSwitch(this.ms), frame: 0 }));
    e.frame = this.frames;
    const was = e.s.on;
    const v = e.s.value(want, this.now);
    if (was !== null && e.s.on !== was) this.changed = this.now;
    return v;
  }

  /**
   * `key` starts again from nothing: off at once, so that it fades in when it is next wanted.
   * For a thing that is another thing now under the same key (a name that has taken another
   * place: what shows of it at the old place is the caller's to fade out).
   */
  restart(key: K): void {
    const s = new TimedSwitch(this.ms);
    s.value(false, this.now);
    this.switches.set(key, { s, frame: this.frames });
    this.changed = this.now;
  }

  end(): void {
    for (const [key, e] of this.switches) if (e.frame !== this.frames) this.switches.delete(key);
  }

  /** True while a thing fades (the view keeps redrawing). */
  animating(now: number): boolean {
    return running(now, this.changed, this.ms);
  }

  clear(): void {
    this.switches.clear();
  }
}
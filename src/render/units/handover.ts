/**
 * A handover between two unit layers at a zoom threshold (SPEC §8, PLAN 1.45a and 2.7b): which
 * of the two shows is a state and not a function of the zoom. The nearer layer comes in when
 * the zoom reaches the threshold and goes out when it passes above the threshold ×
 * HANDOVER_HYSTERESIS, and a change is a cross-fade over HANDOVER_MS of real time. Wherever the
 * camera stops, one layer is drawn at full opacity and the other not at all.
 *
 * The view has three: T0 counters ↔ T1 markers at 2000 m/px, T1 markers ↔ T2 element sprites at
 * 300, T2 sprites ↔ T3 individuals at 30.
 */
import { progress, running, smooth } from '../timing';

export const HANDOVER_MS = 250;
/** Zooming out, the nearer layer stays until this factor above the threshold (as the counters' levels: ±0.15). */
export const HANDOVER_HYSTERESIS = 1.15;

export class TierHandover {
  /** The layer shown, or fading in: true = the nearer one. Null before the first frame. */
  near: boolean | null = null;
  /** When the layer shown began to fade in (ms on the clock of `now`). */
  private start = -Infinity;

  /**
   * `thresholdM`: the nearer layer's tier reaches up to this many m/px, inclusive, as `tierOf`
   * has it. `ms`: how long a change takes.
   */
  constructor(
    readonly thresholdM: number,
    readonly ms = HANDOVER_MS,
  ) {}

  /** The nearer layer's share of the two at `now`, in [0, 1], eased; the farther one has the rest. */
  share(mPerPx: number, now: number): number {
    return smooth(this.linear(mPerPx, now));
  }

  /**
   * The change's progress toward the nearer layer at `now`, in [0, 1], linear in time. For a
   * change in several parts (the T1 → T2 morph, PLAN 2.7c); `share` is this, eased.
   */
  linear(mPerPx: number, now: number): number {
    const want = mPerPx <= (this.near ? this.thresholdM * HANDOVER_HYSTERESIS : this.thresholdM);
    if (this.near === null) this.near = want;
    else if (want !== this.near) {
      // A turn in mid-change goes on from the progress reached (and the share: the smoothstep is symmetric).
      const reached = progress(now, this.start, this.ms);
      this.near = want;
      this.start = now - (1 - reached) * this.ms;
    }
    const p = progress(now, this.start, this.ms);
    return this.near ? p : 1 - p;
  }

  /** True while a cross-fade runs (the view keeps redrawing). */
  animating(now: number): boolean {
    return running(now, this.start, this.ms);
  }
}

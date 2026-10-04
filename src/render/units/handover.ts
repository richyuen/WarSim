/**
 * A handover between two unit layers at a zoom threshold (SPEC §8, PLAN 1.45a and 2.7b): which
 * of the two shows is a state and not a function of the zoom. The nearer layer comes in when
 * the zoom reaches the threshold and goes out when it passes above the threshold ×
 * ZOOM_HYSTERESIS, and a change is a cross-fade over FADE_MS of real time. Wherever the
 * camera stops, one layer is drawn at full opacity and the other not at all.
 *
 * The view has three: T0 counters ↔ T1 markers at 2000 m/px, T1 markers ↔ T2 element sprites at
 * 300, T2 sprites ↔ T3 individuals at 30.
 */
import { FADE_MS, TimedSwitch, ZOOM_HYSTERESIS } from '../timing';

export class TierHandover {
  private readonly state: TimedSwitch;

  /**
   * `thresholdM`: the nearer layer's tier reaches up to this many m/px, inclusive, as `tierOf`
   * has it. `ms`: how long a change takes.
   */
  constructor(
    readonly thresholdM: number,
    readonly ms = FADE_MS,
  ) {
    this.state = new TimedSwitch(ms);
  }

  /** The layer shown, or fading in: true = the nearer one. Null before the first frame. */
  get near(): boolean | null {
    return this.state.on;
  }

  /** The nearer layer's share of the two at `now`, in [0, 1], eased; the farther one has the rest. */
  share(mPerPx: number, now: number): number {
    return this.state.value(this.wants(mPerPx), now);
  }

  /**
   * The change's progress toward the nearer layer at `now`, in [0, 1], linear in time. For a
   * change in several parts (the T1 → T2 morph, PLAN 2.7c); `share` is this, eased.
   */
  linear(mPerPx: number, now: number): number {
    return this.state.linear(this.wants(mPerPx), now);
  }

  private wants(mPerPx: number): boolean {
    return mPerPx <= (this.state.on ? this.thresholdM * ZOOM_HYSTERESIS : this.thresholdM);
  }

  /** True while a cross-fade runs (the view keeps redrawing). */
  animating(now: number): boolean {
    return this.state.animating(now);
  }
}

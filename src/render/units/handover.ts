/**
 * The T0 ↔ T1 handover (SPEC §8, PLAN 1.45a): which unit layer shows, the T0 counters or the T1
 * markers, is a state and not a function of the zoom. The markers come in when the zoom reaches
 * T1_MAX_M and go out when it passes above T1_MAX_M × HANDOVER_HYSTERESIS, and a change is
 * a cross-fade over HANDOVER_MS of real time. Wherever the camera stops, one layer is drawn at
 * full opacity and the other not at all.
 */
import { T1_MAX_M } from './markers';

export const HANDOVER_MS = 250;
/** Zooming out, the markers stay until this factor above T1_MAX_M (as the counters' levels: ±0.15). */
export const HANDOVER_HYSTERESIS = 1.15;

export class TierHandover {
  /** The layer shown, or fading in: true = T1 markers, false = T0 counters. Null before the first frame. */
  markers: boolean | null = null;
  /** When the layer shown began to fade in (ms on the clock of `now`). */
  private start = -Infinity;

  /** Progress of the running fade in [0, 1]. A clock that ran backwards counts as a fade done. */
  private progress(now: number): number {
    return now < this.start ? 1 : Math.min(1, (now - this.start) / HANDOVER_MS);
  }

  /** The markers' share of the two layers at `now`, in [0, 1]; the counters have the rest. */
  share(mPerPx: number, now: number): number {
    // T1 reaches up to T1_MAX_M inclusive, as `tierOf` has it.
    const want = mPerPx <= (this.markers ? T1_MAX_M * HANDOVER_HYSTERESIS : T1_MAX_M);
    if (this.markers === null) this.markers = want;
    else if (want !== this.markers) {
      // A turn in mid-fade goes on from the share reached: the smoothstep is symmetric.
      const reached = this.progress(now);
      this.markers = want;
      this.start = now - (1 - reached) * HANDOVER_MS;
    }
    const p = this.progress(now);
    const s = p * p * (3 - 2 * p);
    return this.markers ? s : 1 - s;
  }

  /** True while a cross-fade runs (the view keeps redrawing). */
  animating(now: number): boolean {
    return now >= this.start && now - this.start < HANDOVER_MS + 50;
  }
}

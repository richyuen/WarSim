import type { Camera } from '../render/camera';
import { tierOf, type Subscription } from '../shared/protocol';

/** The subscribed box is the view and this much more, each way. */
export const SUBSCRIPTION_PAD = 1.25;

/**
 * Interest management (SPEC §8): what a view of `viewW` × `viewH` CSS px asks the worker for (its
 * box padded by 25%, its tier, whether it draws elements), and a key that says when to ask again:
 * the view asks when the key has changed.
 *
 * The key is the box rounded to a step that is a part of the box: a power of two of cells
 * between a 32nd and a 16th of the box's smaller half-size (about 14 to 28 px on a view 720 px
 * high), and the step itself. The pad is a fifth of the box's half-size, more than three steps.
 * So of two cameras with one key, the view of each is inside the box of the other: the worker,
 * which has the box it was last told, has the view.
 *
 * (PLAN 2.7n2: the step was a quarter cell at every zoom. That is a pixel at the world view and
 * 4,892 px at 1 m/px: there a pan of two screens asked nothing, and the worker went on sending
 * the elements of a box the view had left.)
 */
export function viewSubscription(cam: Camera, viewW: number, viewH: number, kmPerCell: number): { sub: Subscription; key: string } {
  const hw = (viewW / 2 / cam.scale) * SUBSCRIPTION_PAD;
  const hh = (viewH / 2 / cam.scale) * SUBSCRIPTION_PAD;
  const tier = tierOf((kmPerCell * 1000) / cam.scale);
  const sub: Subscription = { bbox: [cam.cx - hw, cam.cy - hh, cam.cx + hw, cam.cy + hh], z: Math.log2(cam.scale), tier, wantsElements: tier >= 1.5 };
  const exp = Math.floor(Math.log2(Math.min(hw, hh) / 16));
  const step = 2 ** exp;
  return { sub, key: `${tier}|${exp}|${sub.bbox.map((v) => Math.round(v / step)).join(',')}` };
}

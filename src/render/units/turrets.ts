/**
 * A tank's turret as a sprite of its own (PLAN 3.6a): the hull is one instance of the proxy
 * renderer and its turret another at the same place, after all the hulls, so that it is drawn
 * over them and can be turned without the hull.
 *
 * Pure functions on the renderer's instance arrays: nothing here is sim state.
 */
import { turretOf } from '../../shared/unitLooks';
import { PROXY_STRIDE } from './ProxyRenderer';

/**
 * Writes a turret after the first `count` instances for each of them that is a hull: the hull's
 * places, facing, size, opacity and tint, with the turret's frame (and the hull's half for
 * "moving": it shakes with its hull). `owner[k]` is the instance turret `k` stands on. Returns
 * the number of instances there are now; the arrays must hold as many.
 */
export function appendTurrets(data: Float32Array, colors: Uint8Array, count: number, owner?: Uint32Array): number {
  let j = count;
  for (let i = 0; i < count; i++) {
    const o = i * PROXY_STRIDE;
    const frame = Math.floor(data[o + 6]!);
    const turret = turretOf(frame);
    if (turret < 0) continue;
    const t = j * PROXY_STRIDE;
    data.copyWithin(t, o, o + PROXY_STRIDE);
    data[t + 6] = turret + (data[o + 6]! - frame);
    colors.copyWithin(j * 4, i * 4, i * 4 + 4);
    if (owner) owner[j - count] = i;
    j++;
  }
  return j;
}

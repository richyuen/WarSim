/**
 * The wake behind a ship under way (PLAN 4.7b): for each ship sprite among the first `count`
 * instances that is on the march (its frame's fraction: `marchFraction`), an instance of the
 * wake's frame, white and paler, a sprite's length astern along its facing. Written after the
 * instances already there (the turrets'); nothing here is sim state.
 */
import { Frame, isShipFrame } from '../../shared/unitLooks';
import { PROXY_STRIDE } from './ProxyRenderer';

/** The wake's opacity, and how far astern of its ship it is drawn, in the ship's sprite sizes. */
export const WAKE_ALPHA = 0.7;
export const WAKE_ASTERN = 0.95;
const WHITE = [255, 255, 255, 255] as const;

/** The number of wakes the first `count` instances call for. */
export function wakesFor(data: Float32Array, count: number): number {
  let n = 0;
  for (let i = 0; i < count; i++) {
    const f = data[i * PROXY_STRIDE + 6]!;
    if (isShipFrame(Math.floor(f)) && f % 1 > 0.25) n++;
  }
  return n;
}

/** Writes the wakes of the first `count` instances from instance `at` on; returns the number there are then. */
export function appendWakes(data: Float32Array, colors: Uint8Array, count: number, at: number): number {
  let j = at;
  for (let i = 0; i < count; i++) {
    const o = i * PROXY_STRIDE;
    const f = data[o + 6]!;
    if (!isShipFrame(Math.floor(f)) || f % 1 <= 0.25) continue;
    const t = j * PROXY_STRIDE;
    const back = WAKE_ASTERN * data[o + 5]!;
    const dx = -Math.cos(data[o + 4]!) * back;
    const dy = -Math.sin(data[o + 4]!) * back;
    data[t] = data[o]! + dx;
    data[t + 1] = data[o + 1]! + dy;
    data[t + 2] = data[o + 2]! + dx;
    data[t + 3] = data[o + 3]! + dy;
    data[t + 4] = data[o + 4]!;
    data[t + 5] = data[o + 5]!;
    data[t + 6] = Frame.wake;
    data[t + 7] = WAKE_ALPHA * data[o + 7]!;
    colors.set(WHITE, j * 4);
    j++;
  }
  return j;
}

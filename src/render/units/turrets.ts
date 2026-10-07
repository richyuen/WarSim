/**
 * A tank's turret as a sprite of its own (PLAN 3.6a): the hull is one instance of the proxy
 * renderer and its turret another at the same place, after all the hulls, so that it is drawn
 * over them and can be turned without the hull.
 *
 * Functions on the renderer's instance arrays, and where each turret points on the render clock
 * (PLAN 3.6b): nothing here is sim state.
 */
import { turretOf, Weapon } from '../../shared/unitLooks';
import type { Shot } from '../fx/fire';
import { ANIM_TAIL_MS, smooth } from '../timing';
import { PROXY_STRIDE } from './ProxyRenderer';

const TAU = Math.PI * 2;

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

/** ms: a turret's turn onto its target, how long it stays there after its shot, and its turn back. */
export const TURN_MS = 180;
export const HOLD_MS = 1500;
export const RETURN_MS = 600;
/** A turret stays on its target for this many ticks' wall time, when that is longer than HOLD_MS. */
const HOLD_TICKS = 1.5;

interface Aim {
  /** Where the gun points, radians, and the render-clock span it does: the turn begins at `t0`, the way back at `until`. */
  to: number;
  t0: number;
  until: number;
  /** The aim before this one, if its turret had not come all the way back at `t0`. */
  before: { to: number; until: number } | null;
}

/** From `a` to `b` by the shorter way round, `p` of the way (0–1). */
export function turnBetween(a: number, b: number, p: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d <= -Math.PI) d += TAU;
  return a + d * p;
}

/**
 * A turret that was on `to` until `until`, at `t`: there, or on its way back to the hull's
 * facing. Back, it has the hull's own number, not the same direction a turn further on.
 */
function held(to: number, until: number, hull: number, t: number): number {
  if (t < until) return to;
  return t >= until + RETURN_MS ? hull : turnBetween(to, hull, smooth((t - until) / RETURN_MS));
}

/**
 * Where the turrets point (PLAN 3.6b): a tank that fires has its turret on its target as its shot
 * leaves, and back at the hull's facing when it has been silent for a while. From the shots the
 * view draws (`FireFx`), on the render clock: nothing here is sim state, and a reload starts
 * with every turret at its hull's facing.
 *
 * One aim for an element: its tanks' guns are parallel, along the line from the element's slot
 * to its target's.
 */
export class TurretAims {
  private readonly aims = new Map<number, Aim>();
  /** When the last turret is back at its hull's facing. */
  until = -Infinity;

  /**
   * Takes the shots of a snapshot that arrived at `now`, the tick being `tickMs` long (0: none).
   * A turret begins its turn TURN_MS before its shot starts, or now. A shooter's shots are a
   * shot's life apart (`FireFx`: one on screen at a time), which is longer than a turn: a new
   * turn begins from a turret at rest on its last target, or on its way back.
   */
  add(shots: readonly Shot[], now: number, tickMs: number): void {
    for (const [id, a] of this.aims) if (now >= a.until + RETURN_MS) this.aims.delete(id);
    const hold = Math.max(HOLD_MS, HOLD_TICKS * tickMs);
    for (const s of shots) {
      if (s.weapon !== Weapon.cannon || (s.x1 === s.x0 && s.y1 === s.y0)) continue;
      const t0 = Math.max(now, s.start - TURN_MS);
      const last = this.aims.get(s.shooter);
      const until = s.start + hold;
      this.aims.set(s.shooter, { to: Math.atan2(s.y1 - s.y0, s.x1 - s.x0), t0, until, before: last && t0 < last.until + RETURN_MS ? { to: last.to, until: last.until } : null });
      this.until = Math.max(this.until, until + RETURN_MS);
    }
  }

  /**
   * The facing at `now` of the turrets of element `id`, whose hulls face `hull` (radians; the
   * hull's facing of this frame: a formation may have turned since the shot). Pure in `now`, an
   * earlier one too: before a turn begins the turret is where the aim before left it.
   */
  angleAt(id: number, hull: number, now: number): number {
    const a = this.aims.get(id);
    if (!a) return hull;
    const from = (t: number): number => (a.before ? held(a.before.to, a.before.until, hull, t) : hull);
    if (now < a.t0) return from(now);
    if (now < a.t0 + TURN_MS) return turnBetween(from(a.t0), a.to, smooth((now - a.t0) / TURN_MS));
    return held(a.to, a.until, hull, now);
  }

  /** Whether a turret is off its hull's facing at `now`, or still to turn. */
  animating(now: number): boolean {
    return now < this.until + ANIM_TAIL_MS;
  }
}

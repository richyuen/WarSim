/**
 * Buff expiry (PLAN 1.21): runs first in every tick, so a buff is never seen on its expiry tick.
 */
import { EventKind } from '../../shared/events';
import type { World } from '../world';

export function buffSystem(world: World): void {
  for (const b of world.buffs.expire(world.tick)) world.out.emit(world.tick, EventKind.BuffExpired, b.id, b.target, NaN, NaN);
}

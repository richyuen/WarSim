/**
 * The air wings at their bases (PLAN 5.1d). A wing's base is state (`world.wingBase`): an airbase
 * (its index + 1) or a carrier's fleet (the fleet's id, negative). Hourly after the movement, a
 * wing on a carrier is where its fleet is; one whose carrier is gone (`destroyFormation` sets its
 * base to 0) is lost with it. No other rule reads a wing yet (`World.offLand`).
 */
import { destroyFormation } from './elements';
import type { World } from '../world';

export function airSystem(world: World): void {
  if (world.wingBase.size === 0) return;
  const f = world.formations;
  const c = f.cols;
  for (const [id, base] of [...world.wingBase].sort((a, b) => a[0] - b[0])) {
    if (!f.has(id)) {
      world.wingBase.delete(id);
      continue;
    }
    if (base === 0) {
      // Its carrier is gone: lost with it.
      destroyFormation(world, id);
      continue;
    }
    if (base < 0) {
      c.x[id] = c.x[-base]!;
      c.y[id] = c.y[-base]!;
    }
  }
}

/**
 * A carrier's strikes out of a sea battle, for the ticker (PLAN 7.154a). Since ADR-738 a carrier's wings, their
 * fleet in no sea battle, fly a naval bomber's missions from the deck: at the enemy's fleet nearest in range, else
 * at its land forces. Critic run 17 found such a strike ashore drawn as land-based planes with no row in the ticker
 * (seed 99, hour 3); a strike in a sea battle had its row (PLAN 7.35a). Derived from the state, never stored.
 *
 * A row a carrier fleet, while a wing of it on a strike mission is in the air (the hour before the tick or at it, as
 * the snapshot's sorties are): of its wings in the air, the lowest id's. Its target is the formation of a nation at
 * war with the carrier's nearest the mission's point within the reach of a strike's bombs (`AA_CELLS`), a fleet or
 * the land's; with none there, the holder of the point's cell, ashore when the cell is land. A fleet in a sea battle
 * has no row here: its strikes are its battle's row. Each row RAID_STRIDE numbers (`shared/protocol`).
 */
import { AA_CELLS } from '../sim/systems/airCombat';
import { inSeaBattle } from '../sim/systems/air';
import { wrapDx } from '../sim/systems/elements';
import { sortieEnd } from '../shared/sorties';
import { isLand } from '../shared/terrain';
import type { World } from '../sim/world';

export function carrierRaids(world: World): number[] {
  const out: number[] = [];
  if (world.sorties.size === 0 || world.wingBase.size === 0) return out;
  const c = world.formations.cols;
  const battling = inSeaBattle(world);
  const done = new Set<number>();
  const reach = world.atSizeWhole(AA_CELLS);
  const { w, h } = world.cells;
  for (const [wing, base] of [...world.wingBase].sort((a, b) => a[0] - b[0])) {
    const fleet = -base;
    if (base >= 0 || done.has(fleet) || battling.has(fleet) || !world.formations.has(fleet) || !world.formations.has(wing)) continue;
    const m = world.wingMission.get(wing);
    const s = world.sorties.get(wing);
    if (!m || m.kind !== 'strike' || !s || s.tx !== m.x || s.ty !== m.y) continue;
    if (sortieEnd(s) <= world.tick - 1 || s.launch > world.tick) continue;
    const by = c.nation[wing]!;
    const [tx, ty] = [Math.floor(s.tx), Math.min(h - 1, Math.floor(s.ty))];
    let on = 0;
    let ashore = 0;
    let best = Infinity;
    world.formations.forEach((g) => {
      if (world.isWing(g) || world.embarked.has(g) || !world.wars.atWar(by, c.nation[g]!)) return;
      const dx = Math.abs(wrapDx(world, tx, Math.floor(c.x[g]!)));
      const dy = Math.abs(Math.min(h - 1, Math.floor(c.y[g]!)) - ty);
      if (dx > reach || dy > reach) return;
      const d = Math.hypot(wrapDx(world, s.tx, c.x[g]!), c.y[g]! - s.ty);
      if (d >= best) return;
      best = d;
      on = c.nation[g]!;
      ashore = world.isFleet(g) ? 0 : 1;
    });
    if (on === 0) {
      const cell = ty * w + ((tx % w) + w) % w;
      on = world.cells.controller[cell]!;
      ashore = isLand(world.cells.terrain[cell]!) ? 1 : 0;
    }
    if (on === 0) continue;
    done.add(fleet);
    // The frame of its row: the middle of the fleet and the target, and the cells between them.
    const dx = wrapDx(world, c.x[fleet]!, s.tx);
    out.push(c.x[fleet]!, c.y[fleet]!, s.tx, s.ty, by, on, ashore, fleet, (((c.x[fleet]! + dx / 2) % w) + w) % w, (c.y[fleet]! + s.ty) / 2, Math.abs(dx), Math.abs(s.ty - c.y[fleet]!));
  }
  return out;
}

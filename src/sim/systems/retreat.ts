/**
 * Org and the retreat (SPEC §5.2 step 4, PLAN 3.5a).
 *
 * Org (`orgLossSystem`, hourly, after combat): a formation loses ORG_PER_LOSS × the share of
 * its strength that the hour's battle took (`world.battleLosses`, left by `combatSystem`). It
 * gets none back while it is in contact (`supply.ts`).
 *
 * The retreat (`retreatSystem`, hourly, after movement and before combat).
 * A formation in contact (`engaged`, of the hour before) whose org is under RETREAT_ORG breaks
 * off. Its enemies are the formations of nations it is at war with that are not themselves on
 * the retreat; the nearest of them within CONTACT_CELLS (the lower id on a tie) is the one it
 * goes from. It is ordered to the cell nearest the point RETREAT_CELLS away from that enemy, on
 * the far side of itself, among the cells within RETREAT_SNAP of that point that its side
 * holds (its nation, its supply bloc, a nation fighting beside it), that are on its landmass
 * and that are out of the contact of every enemy about it; with no such cell there (the enemy
 * has taken the ground behind it), to the nearest such cell within RETREAT_REACH of itself.
 * With the order taken it is on the
 * retreat for RETREAT_HOURS (`formations.retreat`, counted down here): `findBattles` leaves it
 * out, so it does not fire and is not fired on, and the march is not held, by contact or by
 * ground the enemy holds on its way (`movement.ts`); it presses no cell
 * (`territory.ts`); the operational AI gives it no order, and a `moveFormation` command to it is
 * refused (`tick.ts`, PLAN 3.7m, ADR-173). Off its battle and on its network it gets its org back
 * (`supply.ts`).
 *
 * A formation with no such cell, or no route to it, holds and fights as before, and tries
 * again when (tick + id) mod RETREAT_RETRY_HOURS = 0: the first try waits for that hour too,
 * so the formations of a battle do not all look for a route in one tick. The encircled do not
 * surrender (not modelled), and nothing fires on a formation that retreats.
 *
 * All of it is read from the state of the hour (no cache of contacts), so a loaded game takes
 * the same retreats as the game that was saved.
 */
import combatJson from '../../../data/combat.json' with { type: 'json' };
import { EventKind } from '../../shared/events';
import { sqrt } from '../core/dmath';
import { nearestCellWhere } from '../data/ownership';
import { navOf, type World } from '../world';
import { cellDist, CONTACT_CELLS } from './elements';
import { orderMove } from './movement';
import { blocOf } from './supply';

/** In contact with less org than this a formation breaks off. */
export const RETREAT_ORG = combatJson.retreat.below;
/** How long it is out of battles and of the AI's orders: a day, in which a formation on its network has 0.75 of its org back. */
export const RETREAT_HOURS = combatJson.retreat.hours;
/** How far from its nearest enemy the point it makes for lies: twice the reach of contact. */
export const RETREAT_CELLS = combatJson.retreat.cells;
/** The ground of its side is looked for within this many cells of that point. */
export const RETREAT_SNAP = combatJson.retreat.snap;
/** With none there (the enemy has taken the ground behind it): within this many cells of the formation. */
export const RETREAT_REACH = combatJson.retreat.reach;
export const RETREAT_RETRY_HOURS = combatJson.retreat.retryHours;

/**
 * Org lost per share of its strength that a formation loses in an hour of battle
 * (`retreat.lossToBreak` of `data/combat.json`): a battle that takes that share takes all of it.
 */
export const ORG_PER_LOSS = 1 / combatJson.retreat.lossToBreak;

/** Hourly, after combat: a formation's order goes with what the hour's battle took of it. */
export function orgLossSystem(world: World): void {
  const c = world.formations.cols;
  const l = world.battleLosses;
  for (let i = 0; i < l.length; i += 3) {
    const id = l[i]!;
    c.org[id] = Math.max(0, c.org[id]! - (ORG_PER_LOSS * (l[i + 1]! - l[i + 2]!)) / l[i + 1]!);
  }
  l.length = 0;
}

export function retreatSystem(world: World): void {
  const f = world.formations;
  const c = f.cols;
  const { w, h, controller } = world.cells;
  // The enemies that may be in the contact of a cell within RETREAT_SNAP of the point.
  const about = Math.max(RETREAT_CELLS + RETREAT_SNAP, RETREAT_REACH) + 1 + CONTACT_CELLS;
  f.forEach((id) => {
    if (c.retreat[id]! > 0) {
      c.retreat[id] = c.retreat[id]! - 1;
      return;
    }
    if (c.engaged[id] !== 1 || c.org[id]! >= RETREAT_ORG || (world.tick + id) % RETREAT_RETRY_HOURS !== 0) return;
    const nation = c.nation[id]!;
    const x = c.x[id]!;
    const y = c.y[id]!;
    let nearest = 0;
    let nd = Infinity;
    const enemies: number[] = [];
    f.forEach((o) => {
      if (c.retreat[o]! > 0 || !world.wars.atWar(nation, c.nation[o]!)) return;
      const d = cellDist(world, x, y, c.x[o]!, c.y[o]!);
      if (d > about) return;
      enemies.push(o);
      if (d <= CONTACT_CELLS && d < nd) {
        nd = d;
        nearest = o;
      }
    });
    if (nearest === 0) return;
    let dx = x - c.x[nearest]!;
    if (dx > w / 2) dx -= w;
    else if (dx < -w / 2) dx += w;
    const dy = y - c.y[nearest]!;
    const d = sqrt(dx * dx + dy * dy);
    const px = d > 0 ? x + (dx / d) * RETREAT_CELLS : x;
    const py = d > 0 ? y + (dy / d) * RETREAT_CELLS : y;
    const bloc = blocOf(world, nation);
    const comp = navOf(world).grid.component;
    const here = Math.floor(y) * w + Math.floor(x);
    const safe = (k: number): boolean => {
      const holder = controller[k]!;
      if (holder === 0 || k === here || comp[k] !== comp[here]) return false;
      if (holder !== nation && blocOf(world, holder) !== bloc && !world.wars.sameSide(holder, nation)) return false;
      const kx = (k % w) + 0.5;
      const ky = Math.floor(k / w) + 0.5;
      for (const o of enemies) if (cellDist(world, kx, ky, c.x[o]!, c.y[o]!) <= CONTACT_CELLS) return false;
      return true;
    };
    let target = nearestCellWhere(safe, px, py, w, h, RETREAT_SNAP);
    if (target < 0) target = nearestCellWhere(safe, x, y, w, h, RETREAT_REACH);
    if (target < 0 || !orderMove(world, id, (target % w) + 0.5, Math.floor(target / w) + 0.5)) return;
    c.retreat[id] = RETREAT_HOURS;
    world.out.emit(world.tick, EventKind.FormationRetreated, id, nation, x, y);
  });
}

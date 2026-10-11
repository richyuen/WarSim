/**
 * Naval bombardment (PLAN 4.5c, SPEC §6.2): a fleet off a coast adds its guns to a land fight
 * there.
 *
 * Hourly after the land's and the sea's fights. A fleet that stands (not under way, not in a sea
 * battle) fires each of its live ships with a gun (`hard` > 0; not a submarine's) at the nearest land formation of
 * a nation at war with the fleet's that is in a land fight (`engaged`) within the ship's reach
 * (`rangeKm`, from the fleet's place to the formation's, `seaKm`): a battleship's 32 km reach
 * inland, a destroyer's 12 km hardly past the beach. The ship fires at the element of that
 * formation with the most hit points left (the lower id on a tie), with the land's volley
 * (`effectiveness`, `FIRE_SCALE`) times `BOMBARD_FIRE`: a ship is many guns, a land element's
 * attack is that of one battalion. Losses apply after every fleet has fired,
 * in id order, with the land's rules (`applyLoss`, `settleFormation`), and count in the org the
 * hour's fights take (`battleLosses`).
 */
import { hash32 } from '../core/hash';
import { navOf, seaRangeOf, type World } from '../world';
import { effectiveness, FIRE_SCALE } from './combat';
import { applyLoss, elementIndex, settleFormation } from './elements';
import { seaKm } from './navalCombat';

/**
 * What a ship's volley ashore is of a land element's with its soft attack: one ship is many
 * guns (a heavy cruiser's 2.5 × 10 = 25, an artillery battalion's 12 guns; a battleship's 35),
 * less what a ship does not see of what it fires at.
 */
export const BOMBARD_FIRE = 2.5;

/** The side, in cells, of the squares the fights are kept in. */
const BUCKET = 4;

export function bombardmentSystem(world: World): void {
  if (!world.rules) return;
  const f = world.formations;
  const c = f.cols;
  const idx = elementIndex(world);
  const ec = world.elements.cols;
  const units = world.rules.units;
  // The land formations in a fight, by square of BUCKET cells (a fleet looks at those about it).
  const w = world.cells.w;
  const grid = navOf(world).grid;
  const bw = Math.ceil(w / BUCKET);
  const buckets = new Map<number, number[]>();
  f.forEach((id) => {
    if (c.engaged[id] !== 1 || world.afloat(id)) return;
    const k = Math.floor(c.y[id]! / BUCKET) * bw + Math.floor(c.x[id]! / BUCKET);
    let list = buckets.get(k);
    if (!list) buckets.set(k, (list = []));
    list.push(id);
  });
  if (buckets.size === 0) return;
  const pending = new Map<number, number>();
  const hit = new Set<number>();
  const fires = world.out.fires;
  f.forEach((fleet) => {
    if (!world.isFleet(fleet) || c.moving[fleet] === 1 || seaRangeOf(world, fleet) !== undefined) return;
    // Its longest gun's reach: no enemy beyond it is fired at.
    let reach = 0;
    for (const s of idx.get(fleet) ?? []) if (ec.strength[s]! > 0 && units[ec.unit[s]!]!.hard > 0 && units[ec.unit[s]!]!.cls !== 'ss') reach = Math.max(reach, units[ec.unit[s]!]!.rangeKm);
    if (reach === 0) return;
    const n = c.nation[fleet]!;
    const x = c.x[fleet]!;
    const y = c.y[fleet]!;
    // The enemies in a fight by their distance, nearest first.
    const near: [number, number][] = [];
    const bx = Math.floor(x / BUCKET);
    const by = Math.floor(y / BUCKET);
    // The squares within its reach: by the km of a cell at its row.
    const row = Math.min(grid.h - 1, Math.max(0, Math.floor(y)));
    const r = Math.ceil(Math.ceil(reach / Math.min(grid.kx[row]!, grid.ky[row]!)) / BUCKET);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        let kx = bx + dx;
        if (world.settings.loopingMap) kx = (kx + bw) % bw;
        for (const t of buckets.get((by + dy) * bw + kx) ?? []) {
          if (!world.wars.atWar(n, c.nation[t]!)) continue;
          const km = seaKm(world, x, y, c.x[t]!, c.y[t]!);
          if (km <= reach) near.push([km, t]);
        }
      }
    }
    if (near.length === 0) return;
    near.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const s of idx.get(fleet) ?? []) {
      const us = units[ec.unit[s]!]!;
      if (ec.strength[s]! <= 0 || us.hard <= 0 || us.cls === 'ss') continue;
      const target = near.find(([km]) => km <= us.rangeKm);
      if (!target) continue;
      const tf = target[1];
      let t = 0;
      let most = 0;
      for (const e of idx.get(tf) ?? []) {
        const hp = ec.strength[e]! * units[ec.unit[e]!]!.hpPerUnit;
        if (hp > most) [t, most] = [e, hp];
      }
      if (t === 0) continue;
      const ut = units[ec.unit[t]!]!;
      const dmg = (effectiveness(us, ut) * (ec.strength[s]! / us.size) * FIRE_SCALE * BOMBARD_FIRE) / ut.hpPerUnit;
      if (dmg <= 0) continue;
      pending.set(t, (pending.get(t) ?? 0) + dmg);
      hit.add(tf);
      fires.push(world.tick, hash32(world.seed, world.tick, s, 0x5b8) % 60, s, t, ec.unit[s]!, dmg, x, y, c.x[tf]!, c.y[tf]!);
    }
  });
  for (const t of [...pending.keys()].sort((p, q) => p - q)) applyLoss(world, t, pending.get(t)!);
  for (const tf of [...hit].sort((p, q) => p - q)) {
    if (!f.has(tf)) continue;
    const before = c.strength[tf]!;
    settleFormation(world, tf);
    if (f.has(tf) && c.strength[tf]! < before) world.battleLosses.push(tf, before, c.strength[tf]!);
  }
}

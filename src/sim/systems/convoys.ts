/**
 * Convoys and submarine raiding (PLAN 4.4d, SPEC §6.2): the income of a bloc's lands joined to
 * home by sea goes home by convoy, and enemy submarines on its way take a share of it.
 *
 * A land's convoy sails the way of `convoyWays` (from a home port's zone to the land's port, by
 * zones no enemy holds; a submarine holds none, PLAN 4.4a). In each zone of it, the submarines
 * of the nations at war with the bloc (S, the live boats of their fleets in the zone) take
 * min(1, RAID_PER_BOAT × S) of what passes, less the screen of the bloc's destroyers there
 * (D): × (1 − SCREEN × min(1, D / S)), as in a sea battle (PLAN 4.3b). What reaches home is the
 * product of what each zone leaves. The economy's month reads it (`monthlyAccounts`: a land's
 * cells pay that share of their income) and logs each raid (`ConvoyRaided`: the raiders'
 * nation, the bloc, the zone's middle), once a month per zone and nation.
 */
import { navOf, seaOf, type World } from '../world';
import { elementIndex } from './elements';
import { SCREEN } from './navalCombat';
import { convoyWays } from './seaSupply';
import { blocOf } from './supply';

/** The share of a convoy's cargo one enemy boat in a zone of its way takes, before the screen. */
export const RAID_PER_BOAT = 0.05;

export interface ConvoyLosses {
  /** Per bloc, per land (component): the share of its income that reaches home. */
  kept: Map<number, Map<number, number>>;
  /** Each raid: the raiders' nation, the bloc raided, the zone. */
  raids: { raider: number; bloc: number; zone: number }[];
}

/** What the enemy's submarines take of each bloc's convoys now; null where no submarine is at sea in a war. */
export function convoyLosses(world: World): ConvoyLosses | null {
  if (!world.rules || world.wars.list.length === 0) return null;
  const z = seaOf(world);
  const f = world.formations;
  const c = f.cols;
  const idx = elementIndex(world);
  const ec = world.elements.cols;
  const units = world.rules.units;
  const w = world.cells.w;
  const atWar = world.wars.nations();
  /** Per zone: boats by nation; destroyers by bloc. */
  const boats = new Map<number, Map<number, number>>();
  const screens = new Map<number, Map<number, number>>();
  f.forEach((id) => {
    if (!world.afloat(id)) return;
    const zone = z.zoneOf[Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!)]!;
    if (zone === 0) return;
    let ss = 0;
    let dd = 0;
    for (const e of idx.get(id) ?? []) {
      const cls = units[ec.unit[e]!]!.cls;
      if (cls === 'ss') ss += ec.strength[e]!;
      else if (cls === 'dd') dd += ec.strength[e]!;
    }
    const n = c.nation[id]!;
    if (ss > 0 && atWar.has(n)) {
      let m = boats.get(zone);
      if (!m) boats.set(zone, (m = new Map()));
      m.set(n, (m.get(n) ?? 0) + ss);
    }
    if (dd > 0) {
      const b = blocOf(world, n);
      let m = screens.get(zone);
      if (!m) screens.set(zone, (m = new Map()));
      m.set(b, (m.get(b) ?? 0) + dd);
    }
  });
  if (boats.size === 0) return null;
  const kept = new Map<number, Map<number, number>>();
  const raids: ConvoyLosses['raids'] = [];
  const seenRaid = new Set<string>();
  for (const [b, lands] of convoyWays(world)) {
    for (const [land, way] of lands) {
      let share = 1;
      for (const zone of way) {
        const m = boats.get(zone);
        if (!m) continue;
        let s = 0;
        const raiders: number[] = [];
        for (const [n, k] of m) {
          if (!world.wars.atWar(n, b)) continue;
          s += k;
          raiders.push(n);
        }
        if (s === 0) continue;
        const d = screens.get(zone)?.get(b) ?? 0;
        share *= 1 - Math.min(1, RAID_PER_BOAT * s) * (1 - SCREEN * Math.min(1, d / s));
        for (const n of raiders.sort((p, q) => p - q)) {
          const key = `${n},${b},${zone}`;
          if (seenRaid.has(key)) continue;
          seenRaid.add(key);
          raids.push({ raider: n, bloc: b, zone });
        }
      }
      if (share < 1) {
        let m = kept.get(b);
        if (!m) kept.set(b, (m = new Map()));
        m.set(land, share);
      }
    }
  }
  return kept.size === 0 ? null : { kept, raids };
}

/** The share of cell `cell`'s income, held by `nation`, that reaches home past the raiders (`convoyLosses`). */
export function convoyShare(world: World, losses: ConvoyLosses | null, nation: number, cell: number): number {
  if (!losses) return 1;
  return losses.kept.get(blocOf(world, nation))?.get(navOf(world).grid.component[cell]!) ?? 1;
}

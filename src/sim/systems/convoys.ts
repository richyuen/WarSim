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
 * cells pay that share of their income) and logs the month's raids (`convoyRaids` in
 * economy.ts, PLAN 7.33a): what each raiding nation took of a bloc's convoys, from the share
 * each zone's boats take of what passes (`takes`).
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
  /**
   * Per bloc, per land: who took its cargo, where, and the share of it each took (PLAN 7.33a); a
   * zone's take is split among its raiders by their boats. A land's shares sum to 1 − its kept.
   */
  takes: Map<number, Map<number, ConvoyTake[]>>;
}

/** A raider's share of a land's cargo, taken in a zone of its way. */
export interface ConvoyTake {
  raider: number;
  zone: number;
  share: number;
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
    if (!world.isFleet(id)) return;
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
  const takes: ConvoyLosses['takes'] = new Map();
  for (const [b, lands] of convoyWays(world)) {
    for (const [land, way] of lands) {
      let share = 1;
      const taken: ConvoyTake[] = [];
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
        const t = Math.min(1, RAID_PER_BOAT * s) * (1 - SCREEN * Math.min(1, d / s));
        for (const n of raiders.sort((p, q) => p - q)) taken.push({ raider: n, zone, share: (share * t * m.get(n)!) / s });
        share *= 1 - t;
      }
      if (share < 1) {
        let m = kept.get(b);
        if (!m) kept.set(b, (m = new Map()));
        m.set(land, share);
        let tm = takes.get(b);
        if (!tm) takes.set(b, (tm = new Map()));
        tm.set(land, taken);
      }
    }
  }
  return kept.size === 0 ? null : { kept, takes };
}

/** The share of cell `cell`'s income, held by `nation`, that reaches home past the raiders (`convoyLosses`). */
export function convoyShare(world: World, losses: ConvoyLosses | null, nation: number, cell: number): number {
  if (!losses) return 1;
  return losses.kept.get(blocOf(world, nation))?.get(navOf(world).grid.component[cell]!) ?? 1;
}

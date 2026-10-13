/**
 * Air superiority (PLAN 5.3c, SPEC §6.3): per air zone, the air power each nation flew there,
 * hour by hour, a sortie's aircraft × their air attack (`aa`), with a half-life of a day
 * (`world.airPower`, state, saved while not empty). A nation's superiority in a zone is its
 * side's share of the power of its side and its enemies there: 0 to 1, a half where neither
 * flew. Read by the rules of PLAN 5.4 and 5.5.
 */
import type { World } from '../world';
import { elementIndex } from './elements';

/** What is left of an hour's air power after an hour: a half-life of 24 hours (0.5^(1/24)). */
export const AIR_POWER_DECAY = 0.97153;
/** Air power under this is forgotten, so that a zone no one flies over leaves the state. */
export const AIR_POWER_FLOOR = 0.5;

/** The hour's air power: the old fades, the sorties in the air (`airborne`'s zones) add theirs. */
export function airPowerSystem(world: World, byZone: Map<number, number[]>): void {
  const power = world.airPower;
  for (const [zone, byNation] of [...power]) {
    for (const [n, p] of [...byNation]) {
      const q = p * AIR_POWER_DECAY;
      if (q < AIR_POWER_FLOOR) byNation.delete(n);
      else byNation.set(n, q);
    }
    if (byNation.size === 0) power.delete(zone);
  }
  if (byZone.size === 0) return;
  const rules = world.rules!;
  const ec = world.elements.cols;
  const index = elementIndex(world);
  for (const [zone, wings] of [...byZone].sort((a, b) => a[0] - b[0])) {
    if (zone === 0) continue;
    for (const id of wings) {
      let p = 0;
      for (const e of index.get(id) ?? []) p += ec.strength[e]! * rules.units[ec.unit[e]!]!.aa;
      if (p === 0) continue;
      const n = world.formations.cols.nation[id]!;
      let byNation = power.get(zone);
      if (!byNation) power.set(zone, (byNation = new Map()));
      byNation.set(n, (byNation.get(n) ?? 0) + p);
    }
  }
}

/**
 * Nation `n`'s air superiority in air zone `zone`, 0 to 1: the air power there of `n` and the
 * nations fighting on its side, over that and its enemies' (nations at war with it); a half
 * where neither side flew.
 */
export function airSuperiority(world: World, n: number, zone: number): number {
  const byNation = world.airPower.get(zone);
  if (!byNation) return 0.5;
  let own = 0;
  let enemy = 0;
  // By nation, not by the map's order: that is the order of first flight in a running game and
  // by id after a load, and a float sum is its order's (PLAN 5.8i).
  for (const [m, p] of [...byNation].sort((a, b) => a[0] - b[0])) {
    if (m === n || world.wars.sameSide(n, m)) own += p;
    else if (world.wars.atWar(n, m)) enemy += p;
  }
  return own + enemy === 0 ? 0.5 : own / (own + enemy);
}

/** An air zone's holder in `airHolders` where two sides at war fly and neither holds it. */
export const AIR_CONTESTED = 0xffff;
/** A nation holds the air of a zone where its superiority is this or more (the strategic bombers' bar, PLAN 5.6). */
export const AIR_HELD = 0.6;

/**
 * Per air zone (index 0 unused), who holds its air (PLAN 5.7c, the map mode): the nation that
 * flew the most there where its superiority is `AIR_HELD` or more; `AIR_CONTESTED` where it is
 * less (its enemies flew there too); 0 where no one flew. Derived from `world.airPower`.
 */
export function airHolders(world: World, count: number): Uint16Array {
  const out = new Uint16Array(count + 1);
  for (const [z, byNation] of world.airPower) {
    if (z <= 0 || z > count) continue;
    let top = 0;
    let most = -1;
    for (const [n, p] of [...byNation].sort((a, b) => a[0] - b[0])) {
      if (p > most) {
        most = p;
        top = n;
      }
    }
    if (top === 0) continue;
    out[z] = airSuperiority(world, top, z) >= AIR_HELD ? top : AIR_CONTESTED;
  }
  return out;
}

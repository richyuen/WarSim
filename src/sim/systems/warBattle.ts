/**
 * The largest battle of a war, and where to look at it (PLAN 2.14e): what a click on the war's
 * banner brings into view.
 *
 * Battles are derived each hour and not kept (`findBattles`): here they are worked out again
 * for one war from the state, the formations' `engaged` flags and places. A battle of the war
 * is a set of formations of its two sides joined by contacts between the sides (within
 * CONTACT_CELLS); a battle of the war's two leaders comes before one of a leader, before one of
 * allies alone (ADR-95), and of those the largest is the one whose smaller side has the most men
 * (ADR-94). Reads only: nothing of the state
 * and nothing of the hour's deployments changes (`deployOf` fills its cache, as the snapshot
 * does).
 */
import type { WarBattle } from '../../shared/protocol';
import type { World } from '../world';
import { cellDist, CONTACT_CELLS, contactsOf, deployOf, elementIndex, slotCount, wrapDx } from './elements';

export type WarBattleSite = Omit<WarBattle, 'tick'>;

/** The largest battle of war `warId` (the leaders' before their allies'; then by the men of its smaller side, then of both; of equals, the one with the lowest formation id), or null when none of its formations are in contact across its sides. */
export function largestBattle(world: World, warId: number): WarBattleSite | null {
  const all = battlesOf(world, warId);
  if (all === null) return null;
  const { battles, members, pairs, find, sideOf, leads, facing } = all;
  const c = world.formations.cols;
  const w = world.cells.w;
  const larger = (x: WarBattleGroup, than: WarBattleGroup): boolean => {
    const l = x.led - than.led;
    if (l !== 0) return l > 0;
    const [a, b] = [x.men, than.men];
    const d = Math.min(a[0], a[1]) - Math.min(b[0], b[1]) || a[0] + a[1] - b[0] - b[1];
    return d > 0 || (d === 0 && x.root < than.root);
  };
  let top: WarBattleGroup | null = null;
  for (const g of battles) if (top === null || larger(g, top)) top = g;
  const root = top!.root;
  const count: [number, number] = [0, 0];
  const strength: [number, number] = [0, 0];
  for (const f of members) {
    if (find(f) !== root) continue;
    const s = sideOf(c.nation[f]!);
    count[s]!++;
    strength[s]! += c.strength[f]!;
  }
  // The pair to look at: each other's nearest before one's nearest before any in contact, then the leaders' formations (ADR-95), then by men, then by ids.
  let best: [number, number] | null = null;
  let bestRank = -1;
  let bestMen = -1;
  for (const [a, b] of pairs) {
    if (find(a) !== root) continue;
    const rank = facing(a, b) * 3 + leads(a) + leads(b);
    const m = c.strength[a]! + c.strength[b]!;
    if (rank > bestRank || (rank === bestRank && m > bestMen)) {
      best = [a, b];
      bestRank = rank;
      bestMen = m;
    }
  }
  const [a, b] = best!;
  const idx = elementIndex(world);
  const place = (f: number): [number, number] => {
    const d = deployOf(world, f, slotCount(world, f, idx.get(f)?.length ?? 0));
    return d ? [d.x, d.y] : [c.x[f]!, c.y[f]!];
  };
  const pa = place(a);
  const pb = place(b);
  // Brought back onto a map that loops, where a block may stand over the seam with its x
  // unfolded (`slotPlace`). On a map with edges both blocks are on it and the fold does nothing.
  const dx = wrapDx(world, pa[0], pb[0]);
  return { war: warId, x: (((pa[0] + dx / 2) % w) + w) % w, y: (pa[1] + pb[1]) / 2, span: [Math.abs(dx), Math.abs(pb[1] - pa[1])], formations: [a, b], count, men: strength };
}

/**
 * The wars that have a battle now: those `largestBattle` answers for (PLAN 2.14f5b3, ADR-96).
 * What the banner of a war shows before the click. One pass over the hour's contacts finds
 * the wars with a formation whose nearest enemy is on the other side; a war not found so is
 * looked at pair by pair, its formations in contact only, to the first pair within
 * CONTACT_CELLS (a formation's nearest enemy may be of another war). Reads only (`contactsOf`
 * fills its cache).
 */
export function warsWithBattle(world: World): Set<number> {
  const out = new Set<number>();
  const wars = world.wars.list;
  if (wars.length === 0) return out;
  const c = world.formations.cols;
  // Per nation, the wars it is in and on which side.
  const warsOf = new Map<number, [number, number][]>();
  wars.forEach((war, i) => {
    for (const s of [0, 1] as const) {
      for (const n of war.sides[s]) {
        const list = warsOf.get(n);
        if (list) list.push([i, s]);
        else warsOf.set(n, [[i, s]]);
      }
    }
  });
  for (const [f, enemy] of contactsOf(world)) {
    const theirs = warsOf.get(c.nation[enemy]!);
    if (!theirs) continue;
    for (const [i, s] of warsOf.get(c.nation[f]!) ?? []) if (theirs.some(([j, t]) => j === i && t !== s)) out.add(wars[i]!.id);
  }
  if (out.size === wars.length) return out;
  const engaged = new Map<number, number[]>();
  world.formations.forEach((id) => {
    if (c.engaged[id] !== 1 || world.offLand(id)) return;
    const list = engaged.get(c.nation[id]!);
    if (list) list.push(id);
    else engaged.set(c.nation[id]!, [id]);
  });
  for (const war of wars) {
    if (out.has(war.id)) continue;
    const [attackers, defenders] = war.sides.map((side) => side.flatMap((n) => engaged.get(n) ?? []));
    if (attackers!.some((a) => defenders!.some((b) => cellDist(world, c.x[a]!, c.y[a]!, c.x[b]!, c.y[b]!) <= world.atSize(CONTACT_CELLS)))) out.add(war.id);
  }
  return out;
}

/** One battle of a war (`battlesOf`): its root (its lowest formation id), its men by side, and its leaders' formations in a pair of each other's nearest enemy (two, one, none; ADR-95). */
export interface WarBattleGroup {
  root: number;
  men: [number, number];
  led: number;
}

/**
 * The battles of war `warId` now (see the head of the file), with what `largestBattle` picks
 * from them: the formations in them, the pairs in contact across its sides, a pair's battle (`find`), a nation's side, and
 * whether a formation is a leader's and two face each other. Null with no war or no pair. Reads only.
 */
export function battlesOf(world: World, warId: number): { battles: WarBattleGroup[]; members: number[]; pairs: [number, number][]; find: (f: number) => number; sideOf: (nation: number) => number; leads: (f: number) => number; facing: (a: number, b: number) => number } | null {
  const war = world.wars.list.find((w) => w.id === warId);
  if (!war) return null;
  const c = world.formations.cols;
  const sideOf = (nation: number): number => (war.sides[0].includes(nation) ? 0 : war.sides[1].includes(nation) ? 1 : -1);
  const sides: [number[], number[]] = [[], []];
  world.formations.forEach((id) => {
    // A fleet in a sea battle is engaged too: no battle of the land (ADR-337).
    const s = c.engaged[id] === 1 && !world.offLand(id) ? sideOf(c.nation[id]!) : -1;
    if (s >= 0) sides[s]!.push(id);
  });
  const parent = new Map<number, number>();
  const find = (a: number): number => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(a, r);
    return r;
  };
  const pairs: [number, number][] = [];
  for (const a of sides[0]) {
    for (const b of sides[1]) {
      if (cellDist(world, c.x[a]!, c.y[a]!, c.x[b]!, c.y[b]!) > world.atSize(CONTACT_CELLS)) continue;
      pairs.push([a, b]);
      if (!parent.has(a)) parent.set(a, a);
      if (!parent.has(b)) parent.set(b, b);
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb));
    }
  }
  if (pairs.length === 0) return null;
  // Men by battle and side (a battle's root is its lowest formation id). A battle is as large as its smaller side (ADR-94).
  const men = new Map<number, [number, number]>();
  for (const f of parent.keys()) {
    const m = men.get(find(f)) ?? [0, 0];
    m[sideOf(c.nation[f]!)]! += c.strength[f]!;
    men.set(find(f), m);
  }
  // The battles of the war's leaders, whom its banner names (ADR-95): by the leaders' formations (two, one, none) in a pair of each other's nearest enemy.
  const contacts = contactsOf(world);
  const leads = (f: number): number => (c.nation[f] === war.sides[0][0] || c.nation[f] === war.sides[1][0] ? 1 : 0);
  const facing = (a: number, b: number): number => (contacts.get(a) === b ? 1 : 0) + (contacts.get(b) === a ? 1 : 0);
  const led = new Map<number, number>();
  for (const [a, b] of pairs) if (facing(a, b) === 2) led.set(find(a), Math.max(led.get(find(a)) ?? 0, leads(a) + leads(b)));
  const battles: WarBattleGroup[] = [];
  for (const [root, m] of men) battles.push({ root, men: m, led: led.get(root) ?? 0 });
  return { battles, members: [...parent.keys()], pairs, find, sideOf, leads, facing };
}

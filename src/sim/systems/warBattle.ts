/**
 * The largest battle of a war, and where to look at it (PLAN 2.14e): what a click on the war's
 * banner brings into view.
 *
 * Battles are derived each hour and not kept (`findBattles`): here they are worked out again
 * for one war from the state, the formations' `engaged` flags and places. A battle of the war
 * is a set of formations of its two sides joined by contacts between the sides (within
 * CONTACT_CELLS); the largest is the one with the most men. Reads only: nothing of the state
 * and nothing of the hour's deployments changes (`deployOf` fills its cache, as the snapshot
 * does).
 */
import type { WarBattle } from '../../shared/protocol';
import type { World } from '../world';
import { cellDist, CONTACT_CELLS, contactsOf, deployOf, elementIndex, slotCount } from './elements';

export type WarBattleSite = Omit<WarBattle, 'tick'>;

/** The largest battle of war `warId` (by men; of equals, the one with the lowest formation id), or null when none of its formations are in contact across its sides. */
export function largestBattle(world: World, warId: number): WarBattleSite | null {
  const war = world.wars.list.find((w) => w.id === warId);
  if (!war) return null;
  const c = world.formations.cols;
  const w = world.cells.w;
  const sideOf = (nation: number): number => (war.sides[0].includes(nation) ? 0 : war.sides[1].includes(nation) ? 1 : -1);
  const sides: [number[], number[]] = [[], []];
  world.formations.forEach((id) => {
    const s = c.engaged[id] === 1 ? sideOf(c.nation[id]!) : -1;
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
      if (cellDist(world, c.x[a]!, c.y[a]!, c.x[b]!, c.y[b]!) > CONTACT_CELLS) continue;
      pairs.push([a, b]);
      if (!parent.has(a)) parent.set(a, a);
      if (!parent.has(b)) parent.set(b, b);
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb));
    }
  }
  if (pairs.length === 0) return null;
  // Men by battle (its root is its lowest formation id).
  const men = new Map<number, number>();
  for (const f of parent.keys()) men.set(find(f), (men.get(find(f)) ?? 0) + c.strength[f]!);
  let root = -1;
  for (const [r, m] of men) if (root < 0 || m > men.get(root)! || (m === men.get(root)! && r < root)) root = r;
  const count: [number, number] = [0, 0];
  const strength: [number, number] = [0, 0];
  for (const f of parent.keys()) {
    if (find(f) !== root) continue;
    const s = sideOf(c.nation[f]!);
    count[s]!++;
    strength[s]! += c.strength[f]!;
  }
  // The pair to look at: each other's nearest before one's nearest before any in contact, then by men, then by ids.
  const contacts = contactsOf(world);
  let best: [number, number] | null = null;
  let bestRank = -1;
  let bestMen = -1;
  for (const [a, b] of pairs) {
    if (find(a) !== root) continue;
    const rank = (contacts.get(a) === b ? 1 : 0) + (contacts.get(b) === a ? 1 : 0);
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
  let dx = pb[0] - pa[0];
  if (dx > w / 2) dx -= w;
  else if (dx < -w / 2) dx += w;
  return { war: warId, x: (((pa[0] + dx / 2) % w) + w) % w, y: (pa[1] + pb[1]) / 2, formations: [a, b], count, men: strength };
}

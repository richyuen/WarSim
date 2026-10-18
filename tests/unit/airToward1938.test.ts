import { describe, expect, it } from 'vitest';
import { airAi } from '../../src/sim/ai/air';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { basePlace, FERRY_RANGE, ofSide, wingRange } from '../../src/sim/systems/air';
import { seaKm } from '../../src/sim/systems/navalCombat';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 5.12a (the critic's R5-B2): on seed 7321 most of the AI's wings at war sat at bases out of
// range of every front, the median front two ranges off, and were given no mission. A wing with a
// front to serve and none of it in range now rebases toward it, a hop a day, until it is in range
// and is tasked.

const [SOV, POL, ENG, BRA] = ['SOV', 'POL', 'ENG', 'BRA'].map(nationId) as [number, number, number, number];

describe('a wing out of range of its front (PLAN 5.12a)', () => {
  it('rebases toward it a hop a day, each hop within its range and nearer, and is tasked there', () => {
    const w: World = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
    const c = w.formations.cols;
    w.wars.start([SOV], [POL], 0);
    // The front, on the Polish border: a Polish formation and the Soviet one nearest it, in contact.
    // (In the far east no Soviet airbase is within 5,000 km of the front: a wing there stays.)
    let pol = -1;
    w.formations.forEach((id) => {
      if (!w.isFleet(id) && !w.offLand(id) && c.nation[id] === POL && pol < 0) pol = id;
    });
    let ger = -1;
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.offLand(id) || c.nation[id] !== SOV) return;
      if (ger < 0 || seaKm(w, c.x[id]!, c.y[id]!, c.x[pol]!, c.y[pol]!) < seaKm(w, c.x[ger]!, c.y[ger]!, c.x[pol]!, c.y[pol]!)) ger = id;
    });
    c.engaged[ger] = 1;
    c.engaged[pol] = 1;
    // A Soviet fighter wing at the Soviet airbase furthest from that front.
    const fighter = [...w.wingBase].find(([id, b]) => b > 0 && c.nation[id] === SOV && w.rules!.units[w.rules!.templates[c.template[id]!]!.elements[0]!.unit]!.cls === 'fighter')![0];
    const fromFront = (base: number): number => {
      const p = basePlace(w, base)!;
      return seaKm(w, p[0], p[1], c.x[ger]!, c.y[ger]!);
    };
    const range = wingRange(w, fighter);
    // Its base: the Soviet airbase furthest from the front that is out of range of it and has
    // another, nearer it, within a ferry flight (1938's are few: the furthest has none).
    const soviet = w.airbases.map((_, i) => i + 1).filter((b) => w.cells.controller[w.airbases[b - 1]!.cell] === SOV);
    const hop = (a: number, b: number): number => {
      const [p, q] = [basePlace(w, a)!, basePlace(w, b)!];
      return seaKm(w, p[0], p[1], q[0], q[1]);
    };
    const far = soviet.filter((b) => fromFront(b) > range && soviet.some((o) => fromFront(o) < fromFront(b) && hop(b, o) <= FERRY_RANGE * range)).sort((a, b) => fromFront(b) - fromFront(a))[0];
    expect(far, 'a Soviet airbase out of range with a hop toward the front').toBeDefined();
    w.wingBase.set(fighter, far!);
    w.wingMission.delete(fighter);
    [c.x[fighter], c.y[fighter]] = basePlace(w, far!)!;
    expect(fromFront(far!), 'out of range of the front').toBeGreaterThan(range);

    const hops: number[] = [fromFront(far!)];
    for (let day = 0; day < 30 && !w.wingMission.has(fighter); day++) {
      const was = w.wingBase.get(fighter)!;
      airAi(w);
      const now = w.wingBase.get(fighter)!;
      if (now === was) continue;
      // Each hop a ferry's reach (FERRY_RANGE ranges) from the base before, and nearer the front.
      const [a, b] = [basePlace(w, was)!, basePlace(w, now)!];
      expect(seaKm(w, a[0], a[1], b[0], b[1])).toBeLessThanOrEqual(FERRY_RANGE * range);
      expect(fromFront(now)).toBeLessThan(hops.at(-1)!);
      hops.push(fromFront(now));
    }
    expect(hops.length, 'a hop at least').toBeGreaterThan(1);
    expect(w.wingMission.get(fighter)?.kind, 'tasked once in range').toBe('patrol');
    expect(hops.at(-1)!).toBeLessThanOrEqual(range);
    process.stderr.write(`fighter ${fighter}: range ${range.toFixed(0)} km; from the front ${hops.map((d) => d.toFixed(0)).join(' → ')} km\n`);
  });

  // PLAN 7.26b: the hops aimed at the front's formation nearest the base; where no airbase of the
  // side had that one in range (across the sea, beyond the last base), they stopped short of it,
  // and the wing sat out the war, while bases in range of the rest of the front stood free.
  it('aims at a formation of the front an airbase of its side has in range, not the nearest of all', () => {
    const w: World = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
    const c = w.formations.cols;
    w.wars.start([SOV], [POL], 0);
    let pol = -1;
    w.formations.forEach((id) => {
      if (!w.isFleet(id) && !w.offLand(id) && c.nation[id] === POL && pol < 0) pol = id;
    });
    const soviet = (id: number): boolean => !w.isFleet(id) && !w.offLand(id) && c.nation[id] === SOV;
    let ger = -1;
    w.formations.forEach((id) => {
      if (!soviet(id)) return;
      if (ger < 0 || seaKm(w, c.x[id]!, c.y[id]!, c.x[pol]!, c.y[pol]!) < seaKm(w, c.x[ger]!, c.y[ger]!, c.x[pol]!, c.y[pol]!)) ger = id;
    });
    c.engaged[ger] = 1;
    c.engaged[pol] = 1;
    const fighter = [...w.wingBase].find(([id, b]) => b > 0 && c.nation[id] === SOV && w.rules!.units[w.rules!.templates[c.template[id]!]!.elements[0]!.unit]!.cls === 'fighter')![0];
    const range = wingRange(w, fighter);
    const bases = w.airbases.map((_, i) => i + 1).filter((b) => w.cells.controller[w.airbases[b - 1]!.cell] === SOV);
    const km = (b: number, x: number, y: number): number => {
      const p = basePlace(w, b)!;
      return seaKm(w, p[0], p[1], x, y);
    };
    const fromFront = (b: number): number => km(b, c.x[ger]!, c.y[ger]!);
    const hop = (a: number, b: number): number => km(a, ...basePlace(w, b)!);
    // The base: the furthest from the front out of range of it with a hop toward it (as above).
    const far = bases.filter((b) => fromFront(b) > range && bases.some((o) => fromFront(o) < fromFront(b) && hop(b, o) <= FERRY_RANGE * range)).sort((a, b) => fromFront(b) - fromFront(a))[0]!;
    expect(far, 'a Soviet airbase out of range with a hop toward the front').toBeDefined();
    // A second engaged Soviet formation, nearer that base than the first, out of range of every
    // Soviet airbase (`unreach`): the place nearest the base on a grid of the map that is so.
    let unreach: [number, number] | null = null;
    let ud = fromFront(far);
    for (let y = 2; y < w.cells.h - 2; y += 4)
      for (let x = 2; x < w.cells.w - 2; x += 4) {
        const d = km(far, x, y);
        if (d < ud && bases.every((b) => km(b, x, y) > range)) [unreach, ud] = [[x, y], d];
      }
    expect(unreach, 'a place nearer the base than the front, in range of no Soviet airbase').not.toBeNull();
    let other = -1;
    w.formations.forEach((id) => {
      if (soviet(id) && id !== ger && other < 0) other = id;
    });
    [c.x[other], c.y[other]] = unreach!;
    c.engaged[other] = 1;
    w.wingBase.set(fighter, far);
    w.wingMission.delete(fighter);
    [c.x[fighter], c.y[fighter]] = basePlace(w, far)!;

    const hops: number[] = [fromFront(far)];
    for (let day = 0; day < 30 && !w.wingMission.has(fighter); day++) {
      const was = w.wingBase.get(fighter)!;
      airAi(w);
      const now = w.wingBase.get(fighter)!;
      if (now !== was) {
        // Each hop nearer the formation in reach, not the one nearer the base.
        expect(fromFront(now)).toBeLessThan(hops.at(-1)!);
        hops.push(fromFront(now));
      }
    }
    expect(w.wingMission.get(fighter)?.kind, 'tasked once in range of the front it can reach').toBe('patrol');
    expect(fromFront(w.wingBase.get(fighter)!)).toBeLessThanOrEqual(range);
    process.stderr.write(`fighter ${fighter}: the unreachable formation ${ud.toFixed(0)} km from its base; from the front ${hops.map((d) => d.toFixed(0)).join(' → ')} km\n`);
  });

  // PLAN 7.26c4: a hop went only to a base nearer the goal than the wing's own. Where the chain of
  // bases bends (round a sea, along a coast), every base within a ferry's reach was further, and
  // the wing sat (17 of 23 such wings on six states of seeds 2843 and 7919, measure-c4.md).
  it('follows a chain of bases to the front though the first hop is no nearer it', () => {
    const w: World = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
    const c = w.formations.cols;
    w.wars.start([ENG], [BRA], 0);
    const fighter = [...w.wingBase].find(([id, b]) => b > 0 && c.nation[id] === ENG && w.rules!.units[w.rules!.templates[c.template[id]!]!.elements[0]!.unit]!.cls === 'fighter')![0];
    const range = wingRange(w, fighter);
    const ferry = FERRY_RANGE * range;
    const bases = w.airbases.map((_, i) => i + 1).filter((b) => ofSide(w, ENG, w.cells.controller[w.airbases[b - 1]!.cell]!));
    const km = (b: number, x: number, y: number): number => {
      const p = basePlace(w, b)!;
      return seaKm(w, p[0], p[1], x, y);
    };
    const hop = (a: number, b: number): number => km(a, ...basePlace(w, b)!);
    const enemy: number[] = [];
    w.formations.forEach((id) => {
      if (!w.isFleet(id) && !w.offLand(id) && c.nation[id] === BRA) enemy.push(id);
    });
    const outOfEnemy = (b: number): boolean => enemy.every((p) => km(b, c.x[p]!, c.y[p]!) > range);
    // The hops left from each base to one within range of (x, y), over the bases of Britain's side.
    const left = (x: number, y: number): Map<number, number> => {
      const h = new Map<number, number>();
      const q = bases.filter((b) => km(b, x, y) <= range);
      for (const b of q) h.set(b, 0);
      for (let k = 0; k < q.length; k++)
        for (const o of bases) {
          if (h.has(o) || hop(q[k]!, o) > ferry) continue;
          h.set(o, h.get(q[k]!)! + 1);
          q.push(o);
        }
      return h;
    };
    // The place of the front and the wing's base: the base two hops or more from a base in range
    // of the place, out of range of every Brazilian formation, whose every base within a ferry's reach
    // is further from the place than it.
    let found: { x: number; y: number; base: number } | null = null;
    for (let y = 2; y < w.cells.h - 2 && !found; y += 6)
      for (let x = 2; x < w.cells.w - 2 && !found; x += 6) {
        if (!bases.some((b) => km(b, x, y) <= range)) continue;
        const h = left(x, y);
        for (const b of bases) {
          if ((h.get(b) ?? 0) < 2 || !outOfEnemy(b)) continue;
          if (bases.some((o) => o !== b && hop(b, o) <= ferry && km(o, x, y) < km(b, x, y))) continue;
          found = { x, y, base: b };
          break;
        }
      }
    expect(found, 'a British base whose chain to a place bends away from it first').not.toBeNull();
    const { x, y, base } = found!;
    // The British front: one British formation, engaged, at that place.
    let own = -1;
    w.formations.forEach((id) => {
      if (own < 0 && !w.isFleet(id) && !w.offLand(id) && c.nation[id] === ENG) own = id;
    });
    [c.x[own], c.y[own]] = [x, y];
    c.engaged[own] = 1;
    w.wingBase.set(fighter, base);
    w.wingMission.delete(fighter);
    [c.x[fighter], c.y[fighter]] = basePlace(w, base)!;
    const h = left(x, y);

    const path: number[] = [base];
    for (let day = 0; day < 30 && !w.wingMission.has(fighter); day++) {
      const was = w.wingBase.get(fighter)!;
      airAi(w);
      const now = w.wingBase.get(fighter)!;
      if (now === was) continue;
      // Each hop within a ferry's reach and fewer hops from the front.
      expect(hop(was, now)).toBeLessThanOrEqual(ferry);
      expect(h.get(now)!).toBeLessThan(h.get(was)!);
      path.push(now);
    }
    expect(km(path[1] ?? base, x, y), 'the first hop no nearer the front').toBeGreaterThan(km(base, x, y));
    expect(w.wingMission.get(fighter)?.kind, 'tasked once in range of the front').toBe('patrol');
    expect(km(w.wingBase.get(fighter)!, x, y)).toBeLessThanOrEqual(range);
    process.stderr.write(`fighter ${fighter}: from the front ${path.map((b) => `${km(b, x, y).toFixed(0)} (${h.get(b)})`).join(' → ')} km\n`);
  });
});

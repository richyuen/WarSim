import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { kinUnion, spawnRebels } from '../../src/sim/systems/revolts';
import { navOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { eventKinds as ofKind, nationId, runEvents as events } from '../helpers/sim1938';

// PLAN 7.106 (ADR-681): statelets of one people come together again. On 911–920 at year 30, 204
// of the 426 founded nations alive had a living people, most of them beside it: Free X of the
// Polish people next to Poland, at peace with it, for good. At a month's start a free founded
// nation joins its people's nation, free and living, that its land borders, with no war and no
// truce between them; not one risen on its people's own land against it, nor one God Mode set down.

const POL = nationId('POL');
const GER = nationId('GER');

/** A 1938 world, the AI off, and a German province next to Poland. */
function world(): { s: Sim; w: World; p: number } {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  w.settings.aiEnabled = false;
  const g = navOf(w).graph;
  const owns = (q: number, n: number): boolean => w.cells.owner[g.centre[q] ?? -1] === n;
  let p = 1;
  while (p < w.provinces.count && !(owns(p, GER) && (g.adj[p] ?? []).some((q) => owns(q, POL)))) p++;
  expect(p).toBeLessThan(w.provinces.count);
  return { s, w, p };
}

/** A nation founded on province p from Germany, at peace with it, of the Polish people (its land's core). */
function polishStatelet(w: World, p: number): number {
  w.provinces.core[p] = POL;
  const f = spawnRebels(w, [p], GER, 0, false);
  expect(w.nations.cols.people[f]).toBe(POL);
  return f;
}

describe('statelets of one people come together again (PLAN 7.106)', () => {
  it('a free statelet of a living people beside it joins that nation, its land and formations with it', () => {
    const { w, p } = world();
    const f = polishStatelet(w, p);
    let formations = 0;
    w.formations.forEach((id) => {
      if (w.formations.cols.nation[id] === f) formations++;
    });
    expect(formations).toBeGreaterThan(0);
    const cells: number[] = [];
    w.cells.owner.forEach((o, c) => o === f && cells.push(c));
    kinUnion(w);
    expect(w.nations.cols.living[f]).toBe(0);
    expect(cells.every((c) => w.cells.owner[c] === POL)).toBe(true);
    let moved = 0;
    w.formations.forEach((id) => {
      if (w.formations.cols.nation[id] === POL && cells.includes(Math.floor(w.formations.cols.y[id]!) * w.cells.w + Math.floor(w.formations.cols.x[id]!))) moved++;
    });
    expect(moved).toBeGreaterThan(0);
  });

  it('a statelet of a dead founded people joins the living people that one rose from', () => {
    const { w, p } = world();
    const f = polishStatelet(w, p);
    // Its people becomes a dead founded nation of the Polish people (as a statelet's land is the
    // core of the one before it).
    const d = w.nations.create();
    const nc = w.nations.cols;
    nc.origin[d] = p;
    nc.people[d] = POL;
    nc.living[d] = 0;
    nc.people[f] = d;
    kinUnion(w);
    expect(w.nations.cols.living[f]).toBe(0);
  });

  it('at a month start, in the sim: the union is told as an annexation', () => {
    const { s, w, p } = world();
    const f = polishStatelet(w, p);
    const ev = events(s, 24 * 32);
    expect(ofKind(ev, EventKind.NationAnnexed)).toContainEqual([f, POL]);
  });

  it('not while at war or in a truce, not a puppet, not one barred, not apart from its people', () => {
    const { w, p } = world();
    // At war with its people.
    const a = polishStatelet(w, p);
    w.wars.set(a, POL, true);
    kinUnion(w);
    expect(w.nations.cols.living[a]).toBe(1);
    w.wars.set(a, POL, false);
    // In a truce.
    w.wars.truces.push({ a: POL, b: a, untilTick: w.tick + 24 });
    kinUnion(w);
    expect(w.nations.cols.living[a]).toBe(1);
    w.wars.truces = [];
    // A puppet.
    w.nations.cols.overlord[a] = GER;
    kinUnion(w);
    expect(w.nations.cols.living[a]).toBe(1);
    w.nations.cols.overlord[a] = 0;
    // Barred.
    w.unionBarred.add(a);
    kinUnion(w);
    expect(w.nations.cols.living[a]).toBe(1);
    w.unionBarred.delete(a);
    // Apart: a people with no land beside it.
    w.nations.cols.people[a] = nationId('BRA');
    kinUnion(w);
    expect(w.nations.cols.living[a]).toBe(1);
    w.nations.cols.people[a] = POL;
    kinUnion(w);
    expect(w.nations.cols.living[a]).toBe(0);
  });

  it('a rising on its people\'s own land against it is barred, and so is a nation God Mode sets down', () => {
    const { w, p } = world();
    // German land of the German people: a rising against Germany, of the German people.
    const f = spawnRebels(w, [p], GER, 0, false);
    expect(w.nations.cols.people[f]).toBe(GER);
    expect(w.unionBarred.has(f)).toBe(true);
    kinUnion(w);
    expect(w.nations.cols.living[f]).toBe(1);
  });

  it('the bar is saved and loaded', () => {
    const { s, w, p } = world();
    const f = spawnRebels(w, [p], GER, 0, false);
    const t = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    t.load(s.save());
    expect(t.world.unionBarred.has(f)).toBe(true);
  });
});

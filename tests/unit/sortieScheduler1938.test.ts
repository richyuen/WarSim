import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { airborne, basePlace, orderMission, TURNAROUND_HOURS, wingRange } from '../../src/sim/systems/air';
import { Leg, PATROL_MAX_HOURS, sortieAt, sortieEnd } from '../../src/sim/systems/sorties';
import { airOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 5.2b, the AT of 5.2: each hour a wing with a mission and none in the air launches a
// sortie, and home it turns round; the hour's sorties by air zone are the sortie function's
// places (the points of PLAN 5.3's interception); saved mid-flight, the same game.

const GER = nationId('GER');
const at = (lon: number, lat: number): [number, number] => cellOf(lon, lat, SIZE_1938.w, SIZE_1938.h);
const byId = (w: World): [number, unknown][] => [...w.sorties].sort((a, b) => a[0] - b[0]);
/** The 1938 world with the AI off: the missions here are the test's, not the air AI's (PLAN 5.6). */
const sim = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  s.world.settings.aiEnabled = false;
  return s;
};
const germanWing = (w: World, t: string): number =>
  [...w.wingBase].find(([id, b]) => w.formations.cols.nation[id] === GER && b > 0 && TEMPLATES_1938[w.formations.cols.template[id]!]!.id === t)![0];

describe('the sortie scheduler (PLAN 5.2b)', () => {
  it('a wing with no mission never flies; one with a strike flies out, back, turns round and flies again', () => {
    const s = sim();
    const w = s.world;
    s.step(3);
    expect(w.sorties.size).toBe(0);
    const wing = germanWing(w, 'tactical_bomber_group');
    const warsaw = at(21.0, 52.2);
    expect(orderMission(w, wing, 'strike', ...warsaw)).toBe(0);
    s.step(1);
    const first = w.sorties.get(wing)!;
    expect(first).toBeDefined();
    expect(first.launch).toBe(w.tick - 1);
    expect([first.bx, first.by]).toEqual(basePlace(w, w.wingBase.get(wing)!));
    expect([first.tx, first.ty]).toEqual(warsaw);
    expect(first.over).toBe(0);
    expect(first.kmh).toBe(400);
    expect(first.km).toBeGreaterThan(300);
    expect(first.km).toBeLessThan(wingRange(w, wing));
    // The wing itself stays at its base: the sortie's place is derived.
    const c = w.formations.cols;
    const base = [c.x[wing], c.y[wing]];
    const ready = sortieEnd(first) + TURNAROUND_HOURS;
    while (w.tick < ready) {
      s.step(1);
      expect(w.sorties.get(wing)).toBe(first);
      expect([c.x[wing], c.y[wing]]).toEqual(base);
    }
    s.step(1);
    const second = w.sorties.get(wing)!;
    expect(second).not.toBe(first);
    expect(second.launch).toBe(w.tick - 1);
    expect(second.launch).toBeGreaterThanOrEqual(sortieEnd(first) + TURNAROUND_HOURS);
  });

  it('a patrol stays over its zone; a carrier\'s sortie flies from where the fleet was at its launch', () => {
    const s = sim();
    const w = s.world;
    const fighter = germanWing(w, 'fighter_group');
    const prague = at(14.4, 50.1);
    orderMission(w, fighter, 'patrol', ...prague);
    const [cwing, cbase] = [...w.wingBase].find(([, b]) => b < 0)!;
    const c = w.formations.cols;
    const fleet = -cbase;
    const near: [number, number] = [c.x[fleet]!, c.y[fleet]! + 3];
    orderMission(w, cwing, 'patrol', ...near);
    s.step(1);
    const p = w.sorties.get(fighter)!;
    expect(p.over).toBeGreaterThan(0);
    expect(p.over).toBeLessThanOrEqual(PATROL_MAX_HOURS);
    const q = w.sorties.get(cwing)!;
    expect(q).toBeDefined();
    expect(q.over).toBe(PATROL_MAX_HOURS);
    const [lx, ly] = [q.bx, q.by];
    s.step(2);
    expect([q.bx, q.by]).toEqual([lx, ly]);
  });

  it('the AT: the hour\'s sorties by zone are the function\'s places, every hour of a day of 30 wings; saved mid-flight, the same game', () => {
    const s = sim();
    const w = s.world;
    const c = w.formations.cols;
    const zones = airOf(w).zoneOf;
    const wings = [...w.wingBase].filter(([id, b]) => b > 0 && c.nation[id] === GER).map(([id]) => id).slice(0, 30);
    const targets = [at(14.4, 50.1), at(21.0, 52.2), at(16.4, 48.2), at(4.9, 52.4), at(2.35, 48.85)];
    let ordered = 0;
    wings.forEach((id, k) => {
      const [tx, ty] = targets[k % targets.length]!;
      if (orderMission(w, id, k % 2 ? 'patrol' : 'strike', tx, ty) === 0) ordered++;
    });
    expect(ordered).toBeGreaterThan(20);
    let seen = 0;
    for (let hour = 0; hour < 24; hour++) {
      s.step(1);
      for (const t of [w.tick, w.tick + 0.5]) {
        const want = new Map<number, number[]>();
        for (const id of [...w.sorties.keys()].sort((a, b) => a - b)) {
          const p = sortieAt(w.sorties.get(id)!, t, w.cells.w);
          if (p.leg === Leg.Home) continue;
          const z = zones[Math.floor(p.y) * w.cells.w + Math.floor(p.x)]!;
          want.set(z, [...(want.get(z) ?? []), id]);
          seen++;
        }
        expect(airborne(w, t)).toEqual(want);
      }
      if (hour === 4) {
        const u = sim();
        u.load(s.save());
        expect(byId(u.world)).toEqual(byId(w));
        expect(u.hash()).toBe(s.hash());
        u.step(10);
        s.step(10);
        expect(u.hash()).toBe(s.hash());
        expect(byId(u.world)).toEqual(byId(w));
        hour += 10;
      }
    }
    expect(seen).toBeGreaterThan(100);
    // Every zone named is a zone, every sortie's land zone or sea zone where it flies.
    for (const z of airborne(w, w.tick).keys()) expect(z).toBeLessThanOrEqual(airOf(w).count);
  });

  it('patrols of one nation over one place take off in turn, and the place has one over it at every hour once the first is there (PLAN 7.36a)', () => {
    const s = sim();
    const w = s.world;
    const prague = at(14.4, 50.1);
    const wings = [...w.wingBase]
      .filter(([id, b]) => b > 0 && w.formations.cols.nation[id] === GER && TEMPLATES_1938[w.formations.cols.template[id]!]!.id === 'fighter_group')
      .map(([id]) => id)
      .filter((id) => orderMission(w, id, 'patrol', ...prague) === 0)
      .slice(0, 4);
    for (const id of [...w.wingMission.keys()]) if (!wings.includes(id)) w.wingMission.delete(id);
    expect(wings.length).toBe(4);
    // Each wing's launches over two days, and whether one is over Prague at each half hour.
    const launches = new Map<number, number[]>(wings.map((id) => [id, []]));
    const covered: boolean[] = [];
    for (let hour = 0; hour < 48; hour++) {
      s.step(1);
      for (const id of wings) {
        const q = w.sorties.get(id);
        const list = launches.get(id)!;
        if (q && list.at(-1) !== q.launch) list.push(q.launch);
      }
      for (const t of [w.tick, w.tick + 0.5]) covered.push(wings.some((id) => w.sorties.has(id) && sortieAt(w.sorties.get(id)!, t, w.cells.w).leg === Leg.Over));
    }
    // They did not all go at once: the first launches are a quarter of a cycle apart, or more.
    const firsts = wings.map((id) => launches.get(id)![0]!).sort((a, b) => a - b);
    for (let k = 1; k < firsts.length; k++) expect(firsts[k]! - firsts[k - 1]!).toBeGreaterThanOrEqual(1);
    // Over Prague at every half hour from the first's arrival on (before the rule: none over it
    // for hours of each cycle, the four of them home together).
    const first = covered.indexOf(true);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(6);
    expect(covered.slice(first).every(Boolean)).toBe(true);
    // None held back once the relay turns: each launch after a wing's first is within the hour it is ready.
    for (const id of wings) {
      const list = launches.get(id)!;
      expect(list.length).toBeGreaterThanOrEqual(7);
      for (let k = 1; k < list.length; k++) {
        // Every sortie of a wing from one base to one place has the same flight: the last one's.
        const flight = w.sorties.get(id)!;
        const ready = Math.ceil(list[k - 1]! + 2 * (flight.km / flight.kmh) + flight.over + TURNAROUND_HOURS);
        expect(list[k]!).toBeLessThan(ready + 1);
      }
    }
    // Saved mid-relay, the same game.
    const u = sim();
    u.load(s.save());
    expect(byId(u.world)).toEqual(byId(w));
    u.step(12);
    s.step(12);
    expect(u.hash()).toBe(s.hash());
  });
});

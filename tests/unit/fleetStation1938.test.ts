import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { AT_PORT_CELLS } from '../../src/sim/systems/navalCombat';
import { declareWar } from '../../src/sim/systems/war';
import { assets1938 } from '../helpers/earth';
import { nationId, runEvents } from '../helpers/sim1938';

// PLAN 7.22c (critic run 8, naval 6: "placed fleets wander away at once: the North Sea point was
// empty on day 3"): the critic placed two German and two British battle squadrons face to face in
// the North Sea, then Germany declared war on Britain. The naval AI sent every fleet away from its
// nation's ports home at peace (the British pair sailed 28 and 30 cells on the first day, before the
// war), and at war home from a zone where the enemy was 1.5 times stronger. A fleet the editor
// places now holds its place (`World.station`) until a player orders it away or it breaks off beaten.

const { w: W } = SIZE_1938;
const [ENG, GER] = ['ENG', 'GER'].map(nationId) as [number, number];
const SQUADRON = TEMPLATES_1938.findIndex((t) => t.id === 'battle_squadron');
/** The critic's North Sea point (`critic/c6_cells.json`) and its four places about it. */
const [NX, NY] = [1046.76, 248.13];
const PLACES = [
  [GER, NX + 8, NY + 2],
  [GER, NX + 6, NY + 4],
  [ENG, NX - 2, NY],
  [ENG, NX, NY - 3],
] as const;

/** A game of seed 5591 with the critic's four squadrons placed: the sim and their ids, in PLACES' order. */
function placed(): { s: Sim; fleets: number[] } {
  const s = new Sim({ scenario: '1938', seed: 5591, assets: assets1938(W) });
  const before = new Set<number>();
  s.world.formations.forEach((id) => before.add(id));
  for (const [n, x, y] of PLACES) s.command({ kind: 'spawnFleet', nation: n, x, y, template: SQUADRON });
  s.step(1);
  const fleets: number[] = [];
  s.world.formations.forEach((id) => {
    if (!before.has(id)) fleets.push(id);
  });
  fleets.sort((a, b) => a - b);
  return { s, fleets };
}

const off = (s: Sim, f: number): number => {
  const c = s.world.formations.cols;
  const [x, y] = s.world.station.get(f) ?? [NaN, NaN];
  return Math.max(Math.abs(c.x[f]! - x), Math.abs(c.y[f]! - y));
};

describe('a fleet placed by the editor holds its sea (PLAN 7.22c)', () => {
  it("the critic's North Sea: each holds its place until it is driven off; Britain's pair stands there for 10 days of the war", () => {
    const { s, fleets } = placed();
    const w = s.world;
    expect(fleets).toHaveLength(4);
    for (const f of fleets) expect(w.station.has(f), `fleet ${f} has its place`).toBe(true);
    const at = fleets.map((f) => [...w.station.get(f)!]);
    expect(declareWar(w, GER, ENG, true)).not.toBeNull();
    const brokeOff = new Set<number>();
    const c = w.formations.cols;
    for (let d = 1; d <= 10; d++) {
      const ev = runEvents(s, 24);
      for (const e of ev) if (e[1] === EventKind.FormationRetreated && fleets.includes(e[2]!)) brokeOff.add(e[2]!);
      for (const [i, f] of fleets.entries()) {
        if (!w.formations.has(f)) continue;
        if (w.station.has(f)) {
          // Its place is where it was put; it is there, or in a battle there, or on its way back.
          expect(w.station.get(f), `fleet ${f}'s place`).toEqual(at[i]);
          expect(off(s, f) <= AT_PORT_CELLS || c.engaged[f] === 1 || c.moving[f] === 1, `fleet ${f} on day ${d}: ${off(s, f).toFixed(1)} cells off`).toBe(true);
        } else expect(brokeOff.has(f), `fleet ${f} let go of its place only on breaking off`).toBe(true);
      }
    }
    // Britain's pair: no battle came to it, and it never left.
    for (const f of fleets.filter((f) => c.nation[f] === ENG)) {
      expect(w.formations.has(f)).toBe(true);
      expect(off(s, f), `British fleet ${f}`).toBeLessThanOrEqual(AT_PORT_CELLS);
    }
  }, 300_000);

  it('without its place it sails home at peace, as before (what the critic saw)', () => {
    const { s, fleets } = placed();
    const w = s.world;
    const c = w.formations.cols;
    const at = fleets.map((f) => [c.x[f]!, c.y[f]!]);
    w.station.clear();
    s.step(3 * 24);
    const far = fleets.filter((f, i) => w.formations.has(f) && Math.hypot(c.x[f]! - at[i]![0]!, c.y[f]! - at[i]![1]!) > 10);
    expect(far.length, 'fleets gone from the point in three days').toBeGreaterThan(0);
  }, 300_000);

  it("a player's order sends it away and its place is let go; an order refused lets go of nothing", () => {
    const { s, fleets } = placed();
    const w = s.world;
    const c = w.formations.cols;
    const f = fleets.find((f) => c.nation[f] === ENG)!;
    // Ordered 12 cells west, towards the English coast (water there).
    s.command({ kind: 'moveFormation', id: f, x: NX - 12, y: NY, nation: ENG });
    s.step(1);
    expect(w.station.has(f), 'its place let go').toBe(false);
    expect(c.moving[f], 'under way').toBe(1);
    // Another, ordered nowhere it can sail (inland, Berlin), keeps its place.
    const g = fleets.find((g) => c.nation[g] === GER)!;
    s.command({ kind: 'moveFormation', id: g, x: 1100.2, y: 267.4, nation: GER });
    s.step(1);
    expect(c.moving[g], 'refused: not under way').toBe(0);
    expect(w.station.has(g), 'a refused order lets go of nothing').toBe(true);
  }, 300_000);

  it('a game with placed fleets saved and loaded keeps their places and plays on as the one left running', () => {
    const { s, fleets } = placed();
    declareWar(s.world, GER, ENG, true);
    s.step(30);
    const u = new Sim({ scenario: '1938', seed: 5591, assets: assets1938(W) });
    u.load(s.save());
    expect(u.hash()).toBe(s.hash());
    expect([...u.world.station].sort((a, b) => a[0] - b[0])).toEqual([...s.world.station].sort((a, b) => a[0] - b[0]));
    expect(u.world.station.size).toBeGreaterThan(0);
    for (let d = 0; d < 3; d++) {
      s.step(24);
      u.step(24);
      expect(u.hash(), `day ${d + 1}`).toBe(s.hash());
    }
    expect(fleets.some((f) => s.world.station.has(f))).toBe(true);
  }, 300_000);
});

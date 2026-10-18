import { describe, expect, it } from 'vitest';
import { SLOT_SPACING, slotGrid } from '../../src/sim/core/pose';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { cellDist, deployOf, elementIndex, elementPlace, slotCount, withFreshDeployments } from '../../src/sim/systems/elements';
import { seaKm } from '../../src/sim/systems/navalCombat';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.24d: the air AI's patrol was set on its formation's place, which at T3 is some kilometres
// from the block deployed toward the contact (seed 6047 day 10: about 6 km,
// docs/evidence/7.24/c-patrol-day10-025m.png). It is set on the block's middle, worked out from
// the state as it stands, so that a loaded game sets the same.

const GER = nationId('GER');

function war(): Sim {
  const sim = new Sim({ scenario: '1938', seed: 6047, assets: assets1938(SIZE_1938.w) });
  sim.command({ kind: 'declareWar', attacker: GER, defender: nationId('POL') });
  sim.command({ kind: 'declareWar', attacker: GER, defender: nationId('FRA') });
  return sim;
}

/** Of formation `f`: its block's middle as the state stands, its depth (cells) and its elements' places. */
function blockOf(w: World, f: number): { x: number; y: number; depth: number; men: [number, number][] } | null {
  return withFreshDeployments(w, () => {
    const ids = elementIndex(w).get(f) ?? [];
    const count = slotCount(w, f, ids.length);
    const d = deployOf(w, f, count);
    if (!d) return null;
    const slots = w.elements.cols.slot;
    return { x: d.x, y: d.y, depth: slotGrid(count).rows * w.atSize(SLOT_SPACING), men: ids.map((e) => elementPlace(w, f, slots[e]!, count, e)) };
  });
}

describe("the air AI's patrols over their formation's men (PLAN 7.24d, seed 6047, Germany on Poland and France)", () => {
  it("on days 3 and 10 each patrol over a formation in contact is set on its block's middle, within a block's depth of its men", () => {
    const sim = war();
    const w = sim.world;
    const c = w.formations.cols;
    const rules = w.rules!;
    let over = 0;
    let aside = 0;
    const before: number[] = [];
    const after: number[] = [];
    for (const day of [3, 10]) {
      // The AI decides first in a tick, on the state the hour before left (airSpread.test.ts).
      sim.step(day * 24 - w.tick);
      const blocks = new Map<number, NonNullable<ReturnType<typeof blockOf>>>();
      const places = new Map<number, [number, number]>();
      w.formations.forEach((f) => {
        if (c.nation[f] !== GER || c.engaged[f] !== 1 || w.offLand(f) || w.isFleet(f)) return;
        places.set(f, [c.x[f]!, c.y[f]!]);
        const b = blockOf(w, f);
        if (b) blocks.set(f, b);
      });
      const fighters = [...w.wingBase]
        .filter(([id, base]) => base > 0 && c.nation[id] === GER && rules.units[rules.templates[c.template[id]!]!.elements[0]!.unit]!.cls === 'fighter')
        .map(([id]) => id);
      sim.step(1);
      for (const id of fighters) {
        const m = w.wingMission.get(id);
        if (m?.kind !== 'patrol') continue;
        const f = [...blocks].find(([, b]) => b.x === m.x && b.y === m.y)?.[0];
        // Not on a block: on a formation's place (its block out of range, or no formation of its own in contact in range).
        if (f === undefined) {
          aside++;
          continue;
        }
        over++;
        const b = blocks.get(f)!;
        const nearMen = Math.min(...b.men.map(([x, y]) => cellDist(w, m.x, m.y, x, y)));
        expect(nearMen, `wing ${id} over formation ${f}: from its men, cells`).toBeLessThanOrEqual(b.depth);
        after.push(Math.min(...b.men.map(([x, y]) => seaKm(w, m.x, m.y, x, y))));
        const [px, py] = places.get(f)!;
        before.push(Math.min(...b.men.map(([x, y]) => seaKm(w, px, py, x, y))));
      }
    }
    const mean = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;
    process.stderr.write(`patrols over a block ${over}, elsewhere ${aside}; from the place to its nearest man, mean ${mean(before).toFixed(2)} km, max ${Math.max(...before).toFixed(2)}; from the patrol, mean ${mean(after).toFixed(2)} km, max ${Math.max(...after).toFixed(2)}\n`);
    expect(over).toBeGreaterThanOrEqual(8);
    expect(aside).toBeLessThanOrEqual(2);
    // Before, about the place: some of them kilometres from the formation's men.
    expect(Math.max(...before)).toBeGreaterThan(2);
  });

  it('a game saved on day 9 at 23:00 and loaded sets the same missions on day 10 as the game left running', () => {
    const s = war();
    s.step(10 * 24 - 1);
    const u = new Sim({ scenario: '1938', seed: 6047, assets: assets1938(SIZE_1938.w) });
    u.load(s.save());
    s.step(2);
    u.step(2);
    const missions = (sim: Sim): string => JSON.stringify([...sim.world.wingMission].sort((a, b) => a[0] - b[0]));
    expect(s.world.wingMission.size).toBeGreaterThan(0);
    expect(missions(u)).toBe(missions(s));
    expect(u.hash()).toBe(s.hash());
  });
});

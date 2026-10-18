import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { basePlace, wingRange } from '../../src/sim/systems/air';
import { deployOf, elementIndex, slotCount, withFreshDeployments } from '../../src/sim/systems/elements';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.24a: the air AI spreads a nation's wings over its front. Each wing, by id, takes of the
// formations its role picks from and its range reaches the one with the fewest of the nation's
// wings of its kind sent there that day, the nearest of equals. Before, each took the nearest to
// its base, and a nation's wings piled on a few places: in the critic's game (seed 6047, Germany
// on Poland and France) 6.4 % of the formations in contact had a sortie in a T2 view about them.

describe("the air AI's patrols over the front (seed 6047, Germany on Poland and France)", () => {
  it('each fighter wing of the day, by id, takes the least covered of its own formations in contact within its range', () => {
    const sim = new Sim({ scenario: '1938', seed: 6047, assets: assets1938(SIZE_1938.w) });
    const GER = nationId('GER');
    sim.command({ kind: 'declareWar', attacker: GER, defender: nationId('POL') });
    sim.command({ kind: 'declareWar', attacker: GER, defender: nationId('FRA') });
    const w = sim.world;
    const c = w.formations.cols;
    const rules = w.rules!;
    // The AI decides first in a tick, on the state the hour before left; the systems of a step see
    // its tick before it is counted, so day 4's missions are given in the step from hour 96.
    sim.step(96);
    // Each with where its patrol is set (PLAN 7.24d): its block's middle, as the state stands.
    const own: { id: number; x: number; y: number; px: number; py: number }[] = [];
    withFreshDeployments(w, () =>
      w.formations.forEach((f) => {
        if (c.nation[f] !== GER || c.engaged[f] !== 1 || w.offLand(f) || w.isFleet(f) || w.embarked.has(f)) return;
        const d = deployOf(w, f, slotCount(w, f, elementIndex(w).get(f)?.length ?? 0));
        own.push({ id: f, x: c.x[f]!, y: c.y[f]!, px: d?.x ?? c.x[f]!, py: d?.y ?? c.y[f]! });
      }),
    );
    const fighters = [...w.wingBase]
      .filter(([id, base]) => base > 0 && c.nation[id] === GER && rules.units[rules.templates[c.template[id]!]!.elements[0]!.unit]!.cls === 'fighter')
      .map(([id]) => id)
      .sort((a, b) => a - b);
    sim.step(1);
    expect(own.length).toBeGreaterThanOrEqual(4);
    expect(fighters.length).toBeGreaterThanOrEqual(4);
    const sent = new Map<number, number>();
    const places = new Set<string>();
    for (const id of fighters) {
      const m = w.wingMission.get(id);
      expect(m?.kind, `wing ${id}'s mission`).toBe('patrol');
      const at = basePlace(w, w.wingBase.get(id)!)!;
      const range = wingRange(w, id);
      const reach = own.filter((f) => seaKm(w, at[0], at[1], f.x, f.y) <= range);
      const to = reach.find((f) => f.px === m!.x && f.py === m!.y);
      expect(to, `wing ${id}'s patrol is over a formation of its own in contact in its range`).toBeDefined();
      const least = Math.min(...reach.map((f) => sent.get(f.id) ?? 0));
      expect(sent.get(to!.id) ?? 0, `wing ${id} takes the least covered`).toBe(least);
      // The nearest of the least covered.
      const km = (f: { x: number; y: number }): number => seaKm(w, at[0], at[1], f.x, f.y);
      const nearestLeast = Math.min(...reach.filter((f) => (sent.get(f.id) ?? 0) === least).map(km));
      expect(km(to!)).toBeCloseTo(nearestLeast, 6);
      sent.set(to!.id, least + 1);
      places.add(`${m!.x},${m!.y}`);
    }
    // Spread: as many places as wings, while there are formations enough in reach.
    expect(places.size).toBe(Math.min(fighters.length, own.length));
  });
});

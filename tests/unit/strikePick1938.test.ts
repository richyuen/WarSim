import { describe, expect, it } from 'vitest';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex } from '../../src/sim/systems/elements';
import { EventKind } from '../../src/shared/events';
import { Domain, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.61 (ADR-606): a land-based wing's strike on a fleet (`strikes`, PLAN 5.4c) spread its fire
// over every ship in reach by hit points, as the carriers' did before ADR-605: alike ships took the
// same wound and the fleet went down whole (seed 8693, Japan on the United States: 3 land-based
// strikes in 20 days, each 8 of 8). Each squadron's share on the ships now goes on one ship, picked
// by hit points: the first strike that sinks a ship leaves its fleet afloat.

const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;

/** Each fleet's ships afloat. */
const ships = (w: World): Map<number, number> => {
  const m = new Map<number, number>();
  const ec = w.elements.cols;
  for (const [f, els] of elementIndex(w)) for (const e of els) if (w.rules!.units[ec.unit[e]!]!.domain === Domain.sea) m.set(f, (m.get(f) ?? 0) + ec.strength[e]!);
  return m;
};

describe('a land-based wing\'s strike sinks ship by ship (PLAN 7.61)', () => {
  it('the first land-based strike that sinks a ship of a fleet leaves the fleet afloat', () => {
    const sim = new Sim({ scenario: '1938', seed: 8693, assets: assets1938(SIZE_1938.w) });
    sim.command({ kind: 'declareWar', attacker: id('JAP'), defender: id('USA') });
    let before = ships(sim.world);
    let found: { hour: number; fleet: number; had: number; lost: number } | undefined;
    for (let hour = 0; hour < 24 * 20 && !found; hour++) {
      sim.step(1, (w) => {
        const now = ships(w);
        const ev = w.out.events;
        for (let i = 0; i < ev.length && !found; i += 6) {
          if (ev[i + 1] !== EventKind.StrikeHit) continue;
          const g = ev[i + 2]!;
          // A land-based wing (its base an airbase, >= 0) on a fleet.
          if ((w.wingBase.get(ev[i + 3]!) ?? -1) < 0 || !before.has(g)) continue;
          const had = before.get(g)!;
          const lost = had - (now.get(g) ?? 0);
          if (lost > 0) found = { hour: w.tick, fleet: g, had, lost };
        }
        before = now;
      });
    }
    expect(found, 'a land-based strike sinks a ship in 20 days').toBeDefined();
    console.log(`hour ${found!.hour}: fleet ${found!.fleet} lost ${found!.lost} of ${found!.had}`);
    expect(found!.lost, 'ships sunk by the first land-based strike that sinks any').toBeLessThan(found!.had);
  });
});

import { describe, expect, it } from 'vitest';
import { deliveryWing } from '../../src/sim/ai/economic';
import { BUILD_MIX_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { canDeliver } from '../../src/sim/systems/nuclear';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.6b (critic R7-B1): the economic AI ordered fighters and tactical bombers (ADR-344), never
// a strategic bomber, and a nation's warheads went only by the 1938 start's strategic wings or by
// missiles. Seed 1's Soviet Union lost its last strategic wing in 1948 and in 1950, in extreme
// desperation with 7 warheads, could carry none for 296 days. A nation with warheads and no means
// of delivery orders a strategic bomber group.

const { w: W } = SIZE_1938;
const SOV = nationId('SOV');
const STRATEGIC = BUILD_MIX_1938.wings.strategic;

/** The Soviet Union's strategic wings. */
function strategicWings(world: World): number[] {
  const out: number[] = [];
  const rules = world.rules!;
  for (const [id] of world.wingBase) {
    if (world.formations.cols.nation[id] !== SOV || !world.formations.has(id)) continue;
    const first = rules.templates[world.formations.cols.template[id]!]!.elements[0]!;
    if (rules.units[first.unit]!.cls === 'bomber_str') out.push(id);
  }
  return out;
}

/** The Soviet Union's orders in training of `template`. */
function orders(world: World, template: number): number {
  let n = 0;
  world.production.forEach((id) => {
    if (world.production.cols.nation[id] === SOV && world.production.cols.template[id] === template) n++;
  });
  return n;
}

function setup(warheads: number): Sim {
  const sim = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  if (warheads > 0) sim.command({ kind: 'grantWarheads', nation: SOV, count: warheads });
  sim.step(1);
  for (const id of strategicWings(sim.world)) destroyFormation(sim.world, id);
  // Money for any order: the test is of what it orders, not of its budget.
  sim.world.nations.cols.gold[SOV] = 1e6;
  sim.world.nations.cols.manpower[SOV] = 1e7;
  return sim;
}

describe('a nuclear power keeps a means of delivery (PLAN 7.6b)', () => {
  it('the strategic bomber group is in the 1938 build mix', () => {
    expect(STRATEGIC).toBeGreaterThanOrEqual(0);
  });

  it('with warheads and no delivery it is the wing to order; with a strategic wing or missiles, none', () => {
    const sim = setup(5);
    const world = sim.world;
    expect(strategicWings(world)).toHaveLength(0);
    expect(canDeliver(world, SOV)).toBe(false);
    expect(deliveryWing(world, SOV, BUILD_MIX_1938.wings)).toBe(STRATEGIC);
    // Missiles deliver: no wing.
    sim.command({ kind: 'grantTech', nation: SOV, tech: 'ballistic_missiles' });
    sim.step(1);
    expect(canDeliver(world, SOV)).toBe(true);
    expect(deliveryWing(world, SOV, BUILD_MIX_1938.wings)).toBe(-1);
  });

  it('a nation with a strategic wing, or with no warhead, orders none for delivery', () => {
    const start = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    start.command({ kind: 'grantWarheads', nation: SOV, count: 5 });
    start.step(1);
    expect(strategicWings(start.world).length).toBeGreaterThan(0);
    expect(deliveryWing(start.world, SOV, BUILD_MIX_1938.wings)).toBe(-1);
    expect(deliveryWing(setup(0).world, SOV, BUILD_MIX_1938.wings)).toBe(-1);
  });

  it("the month's economic AI orders it: with warheads, one strategic group; without, none", () => {
    const counts: number[] = [];
    for (const warheads of [5, 0]) {
      const sim = setup(warheads);
      // To the first month's start and its orders.
      sim.step(24 * 31);
      counts.push(orders(sim.world, STRATEGIC));
    }
    process.stderr.write(`strategic groups ordered in the first month: with warheads ${counts[0]}, without ${counts[1]}\n`);
    expect(counts).toEqual([1, 0]);
  });
});

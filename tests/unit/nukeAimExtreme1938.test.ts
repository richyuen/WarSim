import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { aimOf, desperationOf, nukeTargets } from '../../src/sim/systems/nuclear';
import { menOf } from '../../src/sim/systems/war';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.6c (critic R7-B1): a nation weighs places within FRONT_KM of its side (PLAN 6.11a). Seed
// 4's Soviet Union, its army gone and its capital moved east, had China's capital 2,043 km off and
// the Chinese armies near it on its own land (never a fair place), and weighed nothing for a year
// at desperation 2. In extreme desperation it weighs the enemy's places from any distance, as a
// nation striking back does (PLAN 6.12b). The United States at war with Germany in 1938 is that
// shape: no American land force or capital within 1,000 km of Germany's land.

const { w: W } = SIZE_1938;
const [USA, GER] = ['USA', 'GER'].map(nationId) as [number, number];

describe('in extreme desperation, the enemy\'s places from any distance (PLAN 7.6c)', () => {
  const sim = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  const world = sim.world;
  sim.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
  sim.command({ kind: 'grantWarheads', nation: USA, count: 3 });
  sim.command({ kind: 'declareWar', attacker: USA, defender: GER });
  sim.step(48);
  const war = world.wars.list.find((w) => w.sides[0].includes(USA) && w.sides[1].includes(GER))!;

  it('not extreme: Germany in its aim, no place within FRONT_KM of its side', () => {
    expect(war).toBeDefined();
    expect(desperationOf(world, USA, war, 0).extreme).toBe(false);
    const aim = aimOf(world, USA, war, 0);
    expect(aim.at.has(GER)).toBe(true);
    expect(aim.anywhere).toBe(false);
    expect(nukeTargets(world, USA, war, 0)).toEqual([]);
  });

  it('fighting to the death with half its men lost: extreme, and Berlin and Germany\'s armies weighed', () => {
    const start = war.startMen[0];
    const now = war.sides[0].reduce((t, n) => t + (menOf(world).get(n) ?? 0), 0);
    war.fightToDeath[0] = true;
    war.startMen[0] = 2 * now;
    try {
      const d = desperationOf(world, USA, war, 0);
      expect(d.desperation).toBeGreaterThanOrEqual(1);
      expect(d.extreme).toBe(true);
      const aim = aimOf(world, USA, war, 0);
      expect(aim.anywhere).toBe(true);
      const places = nukeTargets(world, USA, war, 0, aim);
      const nc = world.nations.cols;
      process.stderr.write(`the United States in extreme desperation weighs ${places.length} places of Germany's\n`);
      expect(places.length).toBeGreaterThan(1);
      // Germany's capital first (its capitals are weighed before its massed armies).
      expect(places[0]).toEqual([nc.capitalX[GER]!, nc.capitalY[GER]!]);
      // All on land Germany owns and holds: never the striker's own nor a neutral's.
      for (const [x, y] of places) {
        const cell = Math.floor(y) * world.cells.w + Math.floor(x);
        expect(world.cells.owner[cell]).toBe(GER);
        expect(world.cells.controller[cell]).toBe(GER);
      }
    } finally {
      war.fightToDeath[0] = false;
      war.startMen[0] = start;
    }
  });
});

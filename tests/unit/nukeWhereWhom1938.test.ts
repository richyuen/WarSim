import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { aimOf, CAPITAL_RESTRIKE_DAYS, detonate, nukeTargets, RESTRIKE_DAYS } from '../../src/sim/systems/nuclear';
import { menOf } from '../../src/sim/systems/war';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.6e (critic R7-B1): the Soviet Union struck one Dutch point a year apart (seed 4 of the
// builder's run: 400 days), and seed 5's struck one capital three times and another four in 40 days:
// a capital was weighed again once RESTRIKE_DAYS (7) were past. Now a capital a burst fell on in
// the last CAPITAL_RESTRIKE_DAYS is not weighed (a place of massed men there still is). And no
// strike was answered: a nuclear power under aggression 20 (the United States 15, the Netherlands
// 10, Switzerland 5) weighed the striker's second strike and the MAD bar as for a first use. Every
// nuclear power struck now strikes back, one for one.

const { w: W } = SIZE_1938;
const [USA, GER] = ['USA', 'GER'].map(nationId) as [number, number];

describe('where and at whom (PLAN 7.6e)', () => {
  it('a capital struck within the year is not weighed again; after it, it is', () => {
    const sim = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const world = sim.world;
    sim.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    sim.command({ kind: 'grantWarheads', nation: USA, count: 3 });
    sim.command({ kind: 'declareWar', attacker: USA, defender: GER });
    sim.step(48);
    const war = world.wars.list.find((w) => w.sides[0].includes(USA) && w.sides[1].includes(GER))!;
    // In extreme desperation (PLAN 7.6c), so Germany's places are weighed from America.
    war.fightToDeath[0] = true;
    war.startMen[0] = 2 * war.sides[0].reduce((t, n) => t + (menOf(world).get(n) ?? 0), 0);
    const nc = world.nations.cols;
    const berlin: [number, number] = [nc.capitalX[GER]!, nc.capitalY[GER]!];
    const places = (): [number, number][] => nukeTargets(world, USA, war, 0, aimOf(world, USA, war, 0));
    expect(places()[0]).toEqual(berlin);
    // A burst on Berlin past RESTRIKE_DAYS: Berlin, the capital, is not weighed.
    world.nukeBursts.push({ x: berlin[0], y: berlin[1], tick: world.tick - (RESTRIKE_DAYS + 1) * 24 });
    const after = places();
    process.stderr.write(`places after a burst on Berlin ${RESTRIKE_DAYS + 1} days ago: ${after.length}\n`);
    expect(after.some(([x, y]) => x === berlin[0] && y === berlin[1])).toBe(false);
    // A year and a day on: weighed again.
    world.nukeBursts[world.nukeBursts.length - 1]!.tick = world.tick - (CAPITAL_RESTRIKE_DAYS + 1) * 24;
    expect(places()[0]).toEqual(berlin);
  });

  it('the United States (aggression 15), struck at home by Germany, both armed, strikes back at Germany', () => {
    const sim = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const world = sim.world;
    const nc = world.nations.cols;
    expect(nc.aggression[USA]!).toBeLessThan(20);
    for (const n of [USA, GER]) {
      sim.command({ kind: 'grantWarheads', nation: n, count: 5 });
      sim.command({ kind: 'grantTech', nation: n, tech: 'ballistic_missiles' });
    }
    sim.command({ kind: 'declareWar', attacker: GER, defender: USA });
    sim.step(48);
    expect(world.wars.atWar(USA, GER)).toBe(true);
    // Germany's warhead on Washington.
    detonate(world, GER, 1, nc.capitalX[USA]!, nc.capitalY[USA]!);
    const answers: [number, number][] = [];
    const watch = (w: typeof world): void => {
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.NukeDecided && ev[i + 2] === USA) answers.push([ev[i + 4]!, ev[i + 5]!]);
      w.out.events.length = 0;
      w.out.fires.length = 0;
    };
    sim.step(24 * 3, watch);
    process.stderr.write(`the United States' answers: ${answers.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}\n`);
    expect(answers.length).toBe(1);
    const [x, y] = answers[0]!;
    expect(world.cells.owner[Math.floor(y) * world.cells.w + Math.floor(x)]).toBe(GER);
  });
});

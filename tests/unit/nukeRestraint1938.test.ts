import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { canDeliver, nukeInputs, nuclearUtility, NUKE_FLOOR, restraintOf } from '../../src/sim/systems/nuclear';
import { makePuppet } from '../../src/sim/systems/puppets';
import { declareWar } from '../../src/sim/systems/war';
import type { War } from '../../src/sim/wars';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.37e (critic run 10: three of fourteen worlds never saw a burst while four to six nations
// held 145 to 164 warheads; the user's of 2026-10-20: restraint is believable, and the game says why):
// `restraintOf` names the gate of the day's decision that holds a holder at war, by the decision's
// own reckoning, with the best place's utility and its parts.

const { w: W, h: H } = SIZE_1938;
const [GER, POL, BOL, ITA] = ['GER', 'POL', 'BOL', 'ITA'].map(nationId) as [number, number, number, number];

/** Germany with 20 warheads (and missiles unless `german` is false) at war with Poland, which holds `polish` warheads (and missiles when `missiles`). */
function germanyOnPoland(polish: number, missiles: boolean, german = true): { s: Sim; war: War; side: number } {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  s.world.settings.nukesEnabled = true;
  s.command({ kind: 'grantWarheads', nation: GER, count: 20 });
  if (german) s.command({ kind: 'grantTech', nation: GER, tech: 'ballistic_missiles' });
  if (polish > 0) s.command({ kind: 'grantWarheads', nation: POL, count: polish });
  if (missiles) s.command({ kind: 'grantTech', nation: POL, tech: 'ballistic_missiles' });
  s.step(1);
  const war = declareWar(s.world, GER, POL, true)!;
  return { s, war, side: war.sides[0].includes(GER) ? 0 : 1 };
}

/** `n`'s strategic bomber groups with a base. */
function strategicWings(s: Sim, n: number): number[] {
  const c = s.world.formations.cols;
  const rules = s.world.rules!;
  return [...s.world.wingBase].filter(([id, base]) => base > 0 && c.nation[id] === n && rules.units[rules.templates[c.template[id]!]!.elements[0]!.unit]!.cls === 'bomber_str').map(([id]) => id).sort((a, b) => a - b);
}

/** The km from airbase `base` to Warsaw. */
function kmTo(s: Sim, base: number): number {
  const [x, y] = s.world.cellPoint(s.world.airbases[base - 1]!.cell);
  const nc = s.world.nations.cols;
  return Math.hypot(x - nc.capitalX[POL]!, y - nc.capitalY[POL]!);
}

/** Germany losing the war outright (the score all the other side's). */
function losing(war: War, side: number): void {
  war.score = side === 0 ? -100 : 100;
}

describe('why a holder at war does not strike (PLAN 7.37e)', () => {
  it('winning or even, its gain is nothing: not desperate', () => {
    const { s, war, side } = germanyOnPoland(10, true);
    const r = restraintOf(s.world, GER, war, side);
    expect(r.reason).toBe('notDesperate');
    expect(r.desperation).toBeLessThan(0.1);
    expect(r.gain).toBeLessThanOrEqual(NUKE_FLOOR);
  });

  it("losing, held by Poland's strike back: deterred, by Poland; its utility the decision's", () => {
    const { s, war, side } = germanyOnPoland(10, true);
    losing(war, side);
    const r = restraintOf(s.world, GER, war, side);
    expect(r.reason).toBe('deterred');
    expect(r.by).toBe(POL);
    expect(r.gain).toBeGreaterThan(NUKE_FLOOR);
    expect(r.u).toBeLessThanOrEqual(NUKE_FLOOR);
    // The utility is the decision's at that place, and the parts add up to it.
    expect(r.u).toBeCloseTo(nuclearUtility(nukeInputs(s.world, GER, war, side, r.x, r.y)), 9);
    expect(r.u).toBeCloseTo(Math.min(0, r.gain - r.retaliation - r.alliance - r.outrage - r.taboo), 9);
    expect(r.retaliation).toBeGreaterThan(Math.max(r.alliance, r.outrage, r.taboo));
  });

  it('losing, against a Poland with a warhead and no means to deliver it: strikes, and the day decides it', () => {
    const { s, war, side } = germanyOnPoland(1, false);
    losing(war, side);
    const r = restraintOf(s.world, GER, war, side);
    expect(r.reason).toBe('strikes');
    expect(r.u).toBeGreaterThan(NUKE_FLOOR);
    let decided = 0;
    s.step(24, (w) => {
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.NukeDecided && ev[i + 2] === GER) decided++;
      w.out.events.length = 0;
    });
    expect(decided).toBe(1);
  });

  // PLAN 7.37f: a strike over NUKE_FLOOR it cannot put down is intent without means, not restraint.
  it('losing, without missiles and with no strategic bomber: no means', () => {
    const { s, war, side } = germanyOnPoland(1, false, false);
    losing(war, side);
    for (const id of strategicWings(s, GER)) s.command({ kind: 'removeFormation', id });
    expect(canDeliver(s.world, GER)).toBe(false);
    const r = restraintOf(s.world, GER, war, side);
    expect(r.reason).toBe('noMeans');
    expect(r.u).toBeGreaterThan(NUKE_FLOOR);
  });

  it('losing, its one strategic bomber group based out of range of every place: out of range', () => {
    const { s, war, side } = germanyOnPoland(1, false, false);
    losing(war, side);
    for (const id of strategicWings(s, GER)) s.command({ kind: 'removeFormation', id });
    const [bx, by] = cellOf(13.4, 52.52, W, H);
    s.command({ kind: 'spawnWing', nation: GER, x: bx + 0.5, y: by + 0.5, template: TEMPLATES_1938.findIndex((t) => t.id === 'strategic_bomber_group') });
    s.step(1);
    const [keep] = strategicWings(s, GER);
    expect(keep).toBeDefined();
    expect(restraintOf(s.world, GER, war, side).reason).toBe('strikes');
    // Its base moved to the airbase farthest from Warsaw (a set-up: the wing's base is not checked for its owner).
    const far = s.world.airbases.map((_, i) => i + 1).sort((a, b) => kmTo(s, b) - kmTo(s, a))[0]!;
    s.world.wingBase.set(keep!, far);
    expect(canDeliver(s.world, GER)).toBe(true);
    const r = restraintOf(s.world, GER, war, side);
    expect(r.reason).toBe('outOfRange');
    expect(r.u).toBeGreaterThan(NUKE_FLOOR);
  });

  it('asked every day, it changes nothing of the state (the worker asks it for the panel)', () => {
    const run = (ask: boolean): number => {
      const { s, war, side } = germanyOnPoland(10, true);
      losing(war, side);
      for (let d = 0; d < 20; d++) {
        s.step(24);
        if (ask) for (const n of [GER, POL]) restraintOf(s.world, n, war, war.sides[0].includes(n) ? 0 : 1);
      }
      return s.hash();
    };
    expect(run(true)).toBe(run(false));
  });

  it('against a Poland with no warhead, nor the income or the men to threaten it: no threat', () => {
    const { s, war, side } = germanyOnPoland(0, false);
    losing(war, side);
    expect(restraintOf(s.world, GER, war, side).reason).toBe('noThreat');
    const bolivia = declareWar(s.world, GER, BOL, true)!;
    expect(restraintOf(s.world, GER, bolivia, bolivia.sides[0].includes(GER) ? 0 : 1).reason).toBe('noThreat');
  });

  it('a puppet, its AI off, or nukes barred to it weighs no strike', () => {
    for (const [why, set] of [
      ['puppet', (s: Sim) => expect(makePuppet(s.world, ITA, GER, 20)).toBe(true)],
      ['aiOff', (s: Sim) => s.command({ kind: 'setAi', nation: GER, enabled: false })],
      ['nukesOff', (s: Sim) => s.command({ kind: 'setNukes', nation: GER, allowed: false })],
    ] as const) {
      const { s, war, side } = germanyOnPoland(10, true);
      losing(war, side);
      set(s);
      s.step(1);
      expect(restraintOf(s.world, GER, war, side).reason, why).toBe(why);
    }
  });

  it('a nation at peace or without a warhead has nothing to tell', () => {
    const { s, war } = germanyOnPoland(0, false);
    expect(restraintOf(s.world, GER, war, -1).reason).toBe('none');
    expect(restraintOf(s.world, POL, war, war.sides[0].includes(POL) ? 0 : 1).reason).toBe('none');
  });
});

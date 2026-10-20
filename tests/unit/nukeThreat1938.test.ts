import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { strengths } from '../../src/sim/ai/strategic';
import { THREAT_SHARE, threatens, warheadsOf } from '../../src/sim/systems/nuclear';
import { spawnRebels } from '../../src/sim/systems/revolts';
import { declareWar } from '../../src/sim/systems/war';
import type { War } from '../../src/sim/wars';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.12a (critic R6-B2): no first use on a nation that cannot threaten the striker. The first
// strikes in the critic's history were the Soviet Union's, three on a revolt statelet of its own
// land at utility 0.01 to 0.39. A nation threatens when it (or its overlord) has a warhead, its
// income is THREAT_SHARE of the striker's (PLAN 6.12f; first its strength, which a collapsed army
// made of no use: seed 6619's Soviet Union fell to 22,000 men, as many as a statelet's), or its land
// forces stand near the striker's capital.
// The Soviet Union, armed, losing and fighting to the death: no strike on a revolt of Soviet
// Armenia in thirty days; the same Soviet Union at war with Germany strikes twelve German divisions
// massed in East Prussia. Both by missile, that no bomber's range or interception decides it.

const { w: W, h: H } = SIZE_1938;
const [SOV, GER] = ['SOV', 'GER'].map(nationId) as [number, number];
const yerevan = cellOf(44.51, 40.18, W, H);
const prussia = cellOf(21.5, 54.4, W, H);
const inf = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');

/** The Soviet Union's `NukeDecided` events over `hours`, [nation, utility, x, y], `war` held lost and to the death on its side. */
function decisions(s: Sim, war: War, hours: number): number[][] {
  const side = war.sides[0].includes(SOV) ? 0 : 1;
  const out: number[][] = [];
  for (let h = 0; h < hours; h++) {
    war.fightToDeath[side] = true;
    war.score = side === 0 ? -100 : 100;
    s.step(1, (w: World) => {
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.NukeDecided) out.push([ev[i + 2]!, ev[i + 3]!, ev[i + 4]!, ev[i + 5]!]);
      ev.length = 0;
      w.out.fires.length = 0;
    });
  }
  return out;
}

/** The side of `war` nation `m` fights on. */
function sideOf(war: War, m: number): readonly number[] {
  return war.sides[war.sides[0].includes(m) ? 0 : 1]!;
}

function armedSoviets(): Sim {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  s.world.settings.nukesEnabled = true;
  s.command({ kind: 'grantWarheads', nation: SOV, count: 5 });
  s.command({ kind: 'grantTech', nation: SOV, tech: 'ballistic_missiles' });
  s.step(1);
  return s;
}

describe('no first use on a nation that cannot threaten the striker (PLAN 6.12a)', () => {
  it('the Soviet Union, armed and desperate, does not strike a revolt of Soviet Armenia', () => {
    const s = armedSoviets();
    const w = s.world;
    const cell = Math.floor(yerevan[1]) * W + Math.floor(yerevan[0]);
    expect(w.cells.owner[cell]).toBe(SOV);
    const rebels = spawnRebels(w, [w.cells.province[cell]!], SOV);
    const war = w.wars.between(SOV, rebels)?.war;
    expect(war).toBeTruthy();
    const nc = w.nations.cols;
    process.stderr.write(`income: Soviet Union ${nc.income[SOV]!.toFixed(0)}, the revolt ${nc.income[rebels]!.toFixed(0)}\n`);
    expect(nc.income[rebels]!).toBeLessThan(THREAT_SHARE * nc.income[SOV]!);
    expect(threatens(w, rebels, SOV, sideOf(war!, rebels))).toBe(false);
    expect(decisions(s, war!, 24 * 30)).toEqual([]);
    expect(warheadsOf(w, SOV)).toBe(5);
    // A warhead of its own: the revolt threatens.
    s.command({ kind: 'grantWarheads', nation: rebels, count: 1 });
    s.step(1);
    expect(threatens(w, rebels, SOV, sideOf(war!, rebels))).toBe(true);
  });

  it('a revolt a third as strong as the Soviet Union but poor (PLAN 6.12f) is not struck either', () => {
    const s = armedSoviets();
    const w = s.world;
    const cell = Math.floor(yerevan[1]) * W + Math.floor(yerevan[0]);
    const rebels = spawnRebels(w, [w.cells.province[cell]!], SOV);
    const war = w.wars.between(SOV, rebels)!.war;
    // Seed 6619: the Soviet Union fell to 22,000 men, statelets had 6,000 to 38,000. Here the revolt
    // grows to more than a quarter of the Soviet strength instead, as poor as before.
    w.formations.forEach((id) => {
      const c = w.formations.cols;
      if (c.nation[id] === rebels) c.strength[id] = c.strength[id]! * 40;
    });
    const str = strengths(w);
    process.stderr.write(`strength: Soviet Union ${str[SOV]!.toFixed(0)}, the revolt ${str[rebels]!.toFixed(0)}\n`);
    expect(str[rebels]!).toBeGreaterThan(THREAT_SHARE * str[SOV]!);
    expect(threatens(w, rebels, SOV, sideOf(war, rebels))).toBe(false);
    expect(decisions(s, war, 24 * 10)).toEqual([]);
  });

  it('the same Soviet Union at war with Germany strikes it: twelve divisions massed in East Prussia', () => {
    const s = armedSoviets();
    const w = s.world;
    const war = declareWar(w, GER, SOV, true)!;
    expect(war).toBeTruthy();
    expect(w.cells.owner[Math.floor(prussia[1]) * W + Math.floor(prussia[0])]).toBe(GER);
    for (let k = 0; k < 12; k++) s.command({ kind: 'spawnFormation', nation: GER, x: prussia[0] + (k % 4) * 0.3, y: prussia[1] + Math.floor(k / 4) * 0.3, strength: 0, template: inf });
    s.step(1);
    const nc = w.nations.cols;
    process.stderr.write(`income: Soviet Union ${nc.income[SOV]!.toFixed(0)}, Germany ${nc.income[GER]!.toFixed(0)}\n`);
    expect(threatens(w, GER, SOV, sideOf(war, GER))).toBe(true);
    const decided = decisions(s, war, 24 * 30);
    process.stderr.write(`the Soviet Union decided: ${JSON.stringify(decided)}\n`);
    expect(decided.length).toBeGreaterThan(0);
    const [, , x, y] = decided[0]!;
    expect(war.sides[1 - (war.sides[0].includes(SOV) ? 0 : 1)]!.includes(w.cells.owner[Math.floor(y!) * W + Math.floor(x!)]!)).toBe(true);
  });
});

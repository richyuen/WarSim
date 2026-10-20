import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { aimOf, nukeTargets, threatens } from '../../src/sim/systems/nuclear';
import { makePuppet } from '../../src/sim/systems/puppets';
import { declareWar } from '../../src/sim/systems/war';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.37d (ADR-564; critic run 9, "single bombs on small states"): Nepal (seed 2609, 1,656,090
// dead), Sweden (1129, 1,050,000) and Afghanistan (2609, 3,328,000) were each struck as a puppet of
// a nuclear power that stood out of the war: they threatened the striker only by their overlord's
// warheads and income, while the strike back the striker weighed never counted that overlord. An
// overlord's warheads and income make its puppet a threat only while the overlord fights beside it.

const { w: W } = SIZE_1938;
const [SOV, GER, NEP] = ['SOV', 'GER', 'NEP'].map(nationId) as [number, number, number];

function armed(): Sim {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  s.world.settings.nukesEnabled = true;
  s.command({ kind: 'grantWarheads', nation: SOV, count: 5 });
  s.command({ kind: 'grantTech', nation: SOV, tech: 'ballistic_missiles' });
  s.command({ kind: 'grantWarheads', nation: GER, count: 50 });
  s.step(1);
  return s;
}

describe('a puppet threatens by its overlord only while the overlord fights beside it (PLAN 7.37d)', () => {
  it('Nepal, made a German puppet in its war with the Soviet Union, is not aimed at; its capital is not a target', () => {
    const s = armed();
    const w = s.world;
    const war = declareWar(w, SOV, NEP, true)!;
    expect(war).toBeTruthy();
    expect(makePuppet(w, GER, NEP, 20)).toBe(true);
    const side = war.sides[0].includes(SOV) ? 0 : 1;
    expect(war.sides[1 - side]).toContain(NEP);
    expect(war.sides[1 - side]).not.toContain(GER);
    // Germany holds warheads and is far the richer, but it is not in this war.
    expect(threatens(w, NEP, SOV, war.sides[1 - side]!)).toBe(false);
    expect(aimOf(w, SOV, war, side).at.has(NEP)).toBe(false);
    const nc = w.nations.cols;
    const capital: [number, number] = [nc.capitalX[NEP]!, nc.capitalY[NEP]!];
    expect(nukeTargets(w, SOV, war, side)).not.toContainEqual(capital);
  });

  it('with its overlord on its side, the same puppet threatens and is aimed at', () => {
    const s = armed();
    const w = s.world;
    expect(makePuppet(w, GER, NEP, 20)).toBe(true);
    // A declaration on a puppet is one on its overlord (PLAN 3.8e): Germany leads Nepal's side.
    const war = declareWar(w, SOV, NEP, false)!;
    expect(war).toBeTruthy();
    const side = war.sides[0].includes(SOV) ? 0 : 1;
    expect(war.sides[1 - side]).toContain(GER);
    expect(war.sides[1 - side]).toContain(NEP);
    expect(threatens(w, NEP, SOV, war.sides[1 - side]!)).toBe(true);
    expect(aimOf(w, SOV, war, side).at.has(NEP)).toBe(true);
  });
});

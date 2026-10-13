import { describe, expect, it } from 'vitest';
import { strengths } from '../../src/sim/ai/strategic';
import { NATIONS_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { fleetMen, fleetPower, NAVY_WEIGHT } from '../../src/sim/systems/seaControl';
import { assets1938 } from '../helpers/earth';

// PLAN 4.6e2: a navy's weight in the strategic AI. A fleet weighs NAVY_WEIGHT × its armed ships'
// hit points in men: in a nation's strength (a declaration on it, an alliance against it) and
// in a war's reckoning of each side's men (ships lost at sea weigh in its exhaustion, and so in
// a peace). A transport's or a submarine's none.

const { w: W } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const ENG = id('ENG');
const ITA = id('ITA');

describe('a navy\'s weight (PLAN 4.6e2)', () => {
  it('the United Kingdom\'s strength is its army\'s men and half its warships\' hit points; a transport group weighs nothing', () => {
    const s = new Sim({ scenario: '1938', seed: 4607, assets: assets1938(W) });
    const w = s.world;
    let army = 0;
    let navy = 0;
    w.formations.forEach((f) => {
      if (w.formations.cols.nation[f] !== ENG) return;
      if (w.isFleet(f)) navy += fleetPower(w, f);
      else if (!w.isWing(f)) army += w.formations.cols.strength[f]!; // a wing weighs nothing yet (PLAN 5.1d)
    });
    // Its puppets' forces with it.
    let puppets = 0;
    w.formations.forEach((f) => {
      const n = w.formations.cols.nation[f]!;
      if (n !== ENG && w.nations.cols.overlord[n] === ENG && !w.isWing(f)) puppets += w.isFleet(f) ? fleetMen(w, f) : w.formations.cols.strength[f]!;
    });
    expect(navy).toBeGreaterThan(50_000);
    expect(strengths(w)[ENG]).toBeCloseTo(army + NAVY_WEIGHT * navy + puppets, 6);
    const tp = w.formations.ids().find((f) => w.formations.cols.nation[f] === ENG && TEMPLATES_1938[w.formations.cols.template[f]!]!.id === 'transport_group')!;
    expect(fleetMen(w, tp)).toBe(0);
  });

  it('a battle squadron lost at sea raises its side\'s war exhaustion', () => {
    const run = (sink: boolean): number => {
      const s = new Sim({ scenario: '1938', seed: 4607, assets: assets1938(W) });
      const w = s.world;
      w.settings.aiEnabled = false;
      const war = w.wars.start([ENG], [ITA], w.tick);
      s.step(24 * 2); // the war's baseline men taken at its first day
      if (sink) {
        const bs = w.formations.ids().find((f) => w.formations.cols.nation[f] === ENG && TEMPLATES_1938[w.formations.cols.template[f]!]!.id === 'battle_squadron')!;
        destroyFormation(w, bs);
      }
      s.step(24 * 2);
      return war.exhaustion[0];
    };
    const kept = run(false);
    const sunk = run(true);
    expect(sunk).toBeGreaterThan(kept);
    process.stderr.write(`ENG–ITA: British exhaustion ${kept.toFixed(2)} with its fleets, ${sunk.toFixed(2)} with a battle squadron lost\n`);
  });
});

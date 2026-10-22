import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { CAPITAL_THREAT_KM, DESPERATION_CAPITAL, desperationOf } from '../../src/sim/systems/nuclear';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.76 (ADR-631, the user's decision): a capital taken in the war counts in a nation's
// desperation as one threatened, DESPERATION_CAPITAL. Before, it counted only for the extreme
// (PLAN 7.18a), and the capital, moved after its fall, has no enemy near it: the critic's France
// (seed 7127) read 1.15 with the Germans before Paris and 0.92 once they had taken it (under
// PLAN 7.75's beach supply), not extreme.

const { w: W } = SIZE_1938;
const [FRA, GER] = ['FRA', 'GER'].map(nationId) as [number, number];

describe('a capital taken counts in the desperation (PLAN 7.76)', () => {
  it('France at war with Germany, no German near Paris: its capital taken adds DESPERATION_CAPITAL', () => {
    const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    const w = s.world;
    const war = w.wars.start([GER], [FRA], 0);
    const nc = w.nations.cols;
    const c = w.formations.cols;
    // No German land formation within CAPITAL_THREAT_KM of Paris.
    let near = 0;
    w.formations.forEach((id) => {
      if (c.nation[id] === GER && !w.isFleet(id) && !w.isWing(id) && !w.offLand(id) && seaKm(w, nc.capitalX[FRA]!, nc.capitalY[FRA]!, c.x[id]!, c.y[id]!) <= CAPITAL_THREAT_KM) near++;
    });
    expect(near).toBe(0);
    const before = desperationOf(w, FRA, war, 1);
    war.capitalsLost = [...(war.capitalsLost ?? []), FRA];
    const after = desperationOf(w, FRA, war, 1);
    process.stderr.write(`France's desperation: ${before.desperation.toFixed(3)} → ${after.desperation.toFixed(3)} with its capital taken\n`);
    expect(after.desperation).toBeCloseTo(before.desperation + DESPERATION_CAPITAL, 9);
  });
});

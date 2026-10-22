import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { blastRadius, CAPITAL_MEN_MIN, placeParts, TARGET_CAPITAL } from '../../src/sim/systems/nuclear';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { grantTechs, techMask } from '../../src/sim/tech';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 7.62 (ADR-629, the user's decision; critic run 11's design objection): the editor-armed Poland
// of seed 9437 bombed Berlin, 334,000 civilians and 379 men, on the capital's TARGET_CAPITAL alone.
// A capital counts on a first strike only with CAPITAL_MEN_MIN of the theatre's men in the blast; on a
// strike back it counts as before.

const { w: W, h: H } = SIZE_1938;
const [FRA, GER] = ['FRA', 'GER'].map(nationId) as [number, number];

describe('an empty capital is no first-strike target (PLAN 7.62)', () => {
  it('Paris with no army: no capital on a first strike; with an army, or on a strike back, the capital whole', () => {
    const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    const w = s.world;
    // Missiles: every warhead gets there.
    grantTechs(w, GER, techMask([w.rules!.techs.findIndex((t) => t.id === 'ballistic_missiles')]));
    const war = w.wars.start([GER], [FRA], 0);
    const [px, py] = cellOf(2.35, 48.86, W, H).map((v) => Math.floor(v) + 0.5) as [number, number];
    const c = w.formations.cols;
    // Paris emptied: no French formation within two blast radii.
    const reach = 2 * blastRadius(1);
    w.formations.ids().forEach((id) => {
      if (c.nation[id] === FRA && seaKm(w, px, py, c.x[id]!, c.y[id]!) < reach) destroyFormation(w, id);
    });

    const empty = placeParts(w, GER, war, 0, px, py);
    process.stderr.write(`empty Paris, first strike: men share ${empty.menShare.toFixed(4)}, capital ${empty.capital}, value ${empty.value.toFixed(3)}\n`);
    expect(empty.menShare).toBeLessThan(CAPITAL_MEN_MIN);
    expect(empty.capital).toBe(0);

    // A strike back (a grievance against France, the doctrine to answer it): the capital whole.
    w.nations.cols.aggression[GER] = Math.max(0, w.nations.cols.aggression[GER]!);
    w.nukeGrievance.set(GER, { by: FRA, until: w.tick + 24 * 365 });
    const back = placeParts(w, GER, war, 0, px, py);
    process.stderr.write(`empty Paris, strike back: capital ${back.capital}, value ${back.value.toFixed(3)}\n`);
    // (Paris's output alone fills the value to 1 here: the capital's part is read, not the value.)
    expect(back.capital).toBe(TARGET_CAPITAL);
    w.nukeGrievance.delete(GER);

    // An army in Paris (three divisions): a first strike weighs the capital whole.
    for (let k = 0; k < 3; k++) addDivision(w, FRA, px, py);
    const held = placeParts(w, GER, war, 0, px, py);
    process.stderr.write(`Paris with an army, first strike: men share ${held.menShare.toFixed(4)}, capital ${held.capital}, value ${held.value.toFixed(3)}\n`);
    expect(held.menShare).toBeGreaterThanOrEqual(CAPITAL_MEN_MIN);
    expect(held.capital).toBe(TARGET_CAPITAL);
  }, 300_000);
});

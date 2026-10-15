import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { spawnRebels } from '../../src/sim/systems/revolts';
import { knowsTechs, techMask } from '../../src/sim/tech';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.12c (critic R6-B2): a nation founded in play knew every tech of the nation it left, the
// bomb too ("Free Liège II", holding Berlin, built warheads from its first days). It keeps the
// others (PLAN 3.1a), not those of the nuclear category.

const { w: W, h: H } = SIZE_1938;
const GER = nationId('GER');
const munich = cellOf(11.58, 48.14, W, H);

describe('a revolt does not inherit the bomb (PLAN 6.12c)', () => {
  it('a revolt from a Germany that knows the bomb knows Germany\'s other techs, not the nuclear ones', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.step(1);
    for (const tech of ['atomic_bomb', 'ballistic_missiles', 'thermonuclear', 'jet_engines']) s.command({ kind: 'grantTech', nation: GER, tech });
    s.step(1);
    const w = s.world;
    const techs = w.rules!.techs;
    const idx = (id: string): number => techs.findIndex((t) => t.id === id);
    const nuclear = techs.flatMap((t, i) => (t.category === 'nuclear' ? [i] : []));
    const other = techs.flatMap((t, i) => (t.category !== 'nuclear' && knowsTechs(w, GER, techMask([i])) ? [i] : []));
    expect(knowsTechs(w, GER, techMask([idx('atomic_bomb')]))).toBe(true);
    expect(other).toContain(idx('jet_engines'));
    const cell = Math.floor(munich[1]) * W + Math.floor(munich[0]);
    expect(w.cells.owner[cell]).toBe(GER);
    const rebels = spawnRebels(w, [w.cells.province[cell]!], GER);
    for (const i of other) expect(knowsTechs(w, rebels, techMask([i])), techs[i]!.id).toBe(true);
    for (const i of nuclear) expect(knowsTechs(w, rebels, techMask([i])), techs[i]!.id).toBe(false);
  });
});

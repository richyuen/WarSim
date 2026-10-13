import { describe, expect, it } from 'vitest';
import { RejectReason } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, PORTS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { tryLanding } from '../../src/sim/systems/amphibious';
import { assets1938 } from '../helpers/earth';
import { addDivision } from '../helpers/sim1938';

// PLAN 5.8o: transports carry the land's formations alone. An air wing at a port with
// transports is refused (`NotLand`), as a fleet is refused; a division there embarks.

const { w: W, h: H } = SIZE_1938;
const ENG = NATIONS_1938.findIndex((n) => n.tag === 'ENG') + 1;
const calais = cellOf(1.86, 50.95, W, H).map((v) => Math.floor(v) + 0.5) as [number, number];

describe('no wing aboard transports (PLAN 5.8o)', () => {
  it('a British wing at Portsmouth is refused a landing at Calais and stays at its base; a division there embarks', () => {
    const s = new Sim({ scenario: '1938', seed: 4501, assets: assets1938(W) });
    const w = s.world;
    w.settings.aiEnabled = false;
    const port = w.ports.findIndex((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === 'Portsmouth');
    const [x, y] = w.cellPoint(w.ports[port]!.cell);
    const c = w.formations.cols;
    const [wing, base] = [...w.wingBase].find(([g, b]) => c.nation[g] === ENG && b > 0)!;
    [c.x[wing], c.y[wing]] = [x, y];
    expect(tryLanding(w, wing, ...calais)).toBe(RejectReason.NotLand);
    expect(w.embarked.has(wing)).toBe(false);
    expect(w.wingBase.get(wing)).toBe(base);
    const div = addDivision(w, ENG, x, y);
    expect(tryLanding(w, div, ...calais)).toBe(0);
  });
});

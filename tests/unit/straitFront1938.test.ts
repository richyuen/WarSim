import { describe, expect, it } from 'vitest';
import { acrossOf } from '../../src/sim/nav/crossings';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { frontierOf, holdHours } from '../../src/sim/systems/territory';
import { navOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 7.49b1 (ADR-588): the front steps over a strait. The crossing at Gibraltar (992,383 at M)
// has no province and no holder; the shores of one crossing count as neighbours of each other.
// Before, an army on the crossing waited before the far shore's cell for a flip that no held
// cell next to it could make (6421 year 10: 162 divisions there for good).

const W = SIZE_1938.w;
const GER = nationId('GER');
const POL = nationId('POL');
const at = (x: number, y: number): number => y * W + x;
const CROSSING = at(992, 383);
const NORTH = [at(991, 382), at(992, 382), at(993, 382)];
/** The land south of the crossing, Spanish Morocco's in 1938: Poland's here. */
const SOUTH: number[] = [];
for (let y = 384; y <= 386; y++) for (let x = 990; x <= 993; x++) SOUTH.push(at(x, y));

/** The 1938 world with no formations and the AI off: the north shore Germany's, the south Poland's, the two at war. */
function strait(): Sim {
  const s = new Sim({ scenario: '1938', seed: 3, assets: assets1938(W) });
  const w = s.world;
  w.settings.aiEnabled = false;
  w.formations.ids().forEach((id) => destroyFormation(w, id));
  for (const c of NORTH) {
    w.setOwner(c, GER);
    w.setController(c, GER);
  }
  for (const c of SOUTH) {
    w.setOwner(c, POL);
    w.setController(c, POL);
  }
  w.wars.set(GER, POL, true);
  return s;
}

const quiet = (w: Sim['world']): void => {
  w.out.events.length = 0;
  w.out.fires.length = 0;
};

describe('the front over a strait (PLAN 7.49b1)', () => {
  it('the shores of the Gibraltar crossing are neighbours', () => {
    const s = strait();
    const across = acrossOf(navOf(s.world).grid);
    expect(s.world.cells.controller[CROSSING]).toBe(0);
    for (const n of NORTH) expect([...across.get(n)!]).toContain(at(992, 384));
    expect([...across.get(at(992, 384))!]).toContain(at(992, 382));
  });

  it('a shore whose enemy is over the crossing alone is on the frontier', () => {
    const s = strait();
    const front = frontierOf(s.world);
    expect(front.has(at(992, 382))).toBe(true);
    expect(front.has(at(992, 384))).toBe(true);
  });

  it('an army on the crossing takes the far shore', () => {
    const s = strait();
    const w = s.world;
    for (let i = 0; i < 4; i++) addDivision(w, GER, 992.5, 383.5);
    s.step(4 * holdHours(w), quiet);
    expect(w.cells.controller[at(992, 384)]).toBe(GER);
  });

  it('a march over the strait to the enemy land behind the shore arrives', () => {
    const s = strait();
    const w = s.world;
    const ids = [0, 1, 2, 3].map(() => addDivision(w, GER, 992.5, 382.5));
    for (const id of ids) s.command({ kind: 'moveFormation', id, x: 992.5, y: 386.5 });
    s.step(24 * 10, quiet);
    const f = w.formations.cols;
    for (const id of ids) {
      expect(w.cells.controller[Math.floor(f.y[id]!) * W + Math.floor(f.x[id]!)]).not.toBe(0);
      expect(f.moving[id]).toBe(0);
    }
    expect(w.cells.controller[at(992, 386)]).toBe(GER);
  });
});

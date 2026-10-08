import { describe, expect, it } from 'vitest';
import { SLOT_SPACING, slotGrid } from '../../src/sim/core/pose';
import { SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { cellDist, DEPLOY_GAP, DEPLOY_REACH, deployOf, slotCount } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, INF_DIV, nationId } from '../helpers/sim1938';

// PLAN 3.11c1 (critic R3-B3, "five tank formations share one cell as interleaved diamonds"):
// the lines of a stack that goes to one enemy's block stood a block of their own apart, in depth
// and in width. A tank corps is 11 by 5 elements and a tank brigade 7 by 4: the brigade a line
// behind the corps stood in its rear rows, and the one abreast in its flank (seed 1212, the
// Soviet Union on Poland, day 6: corps 181 and 182 on brigades 199, 202, 203 and 204).

const W = SIZE_1938.w;
const GER = nationId('GER');
const POL = nationId('POL');
const template = (id: string): number => TEMPLATES_LAND.findIndex((t) => t.id === id);

/** A German cell with a Polish one east of it: [x, y] of the German cell's middle. */
function border(w: World): [number, number] {
  const { owner, w: cw, h: ch } = w.cells;
  for (let y = 1; y < ch - 1; y++) for (let x = 1; x < cw - 2; x++) if (owner[y * cw + x] === GER && owner[y * cw + x + 1] === POL && w.onLand(x + 0.5, y + 0.5) && w.onLand(x + 1.5, y + 0.5) && w.onLand(x + 1, y + 0.5)) return [x + 0.5, y + 0.5];
  throw new Error('no German cell with a Polish one east of it, land between');
}

describe('blocks of unequal size that go to one enemy do not stand in one another (PLAN 3.11c1)', () => {
  it('a tank corps, four tank brigades, a cavalry brigade and two divisions on one cell: each a gap clear of every other', () => {
    const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    const w = s.world;
    w.settings.aiEnabled = false;
    const site = border(w);
    // The corps first: the lowest id is the one the enemy faces.
    const kinds = ['tank_corps', 'tank_brigade', 'cavalry_brigade', 'tank_brigade', 'infantry_div', 'tank_brigade', 'tank_corps', 'tank_brigade', 'infantry_div'];
    const stack = kinds.map((k) => addDivision(w, GER, site[0], site[1], template(k)));
    const enemy = addDivision(w, POL, site[0] + 1, site[1], INF_DIV);
    s.command({ kind: 'declareWar', attacker: GER, defender: POL });
    s.step(2);
    const block = (f: number): { x: number; y: number; facing: number; width: number; depth: number } => {
      const n = slotCount(w, f, 0);
      const g = slotGrid(n);
      return { ...deployOf(w, f, n)!, width: g.cols * SLOT_SPACING, depth: g.rows * SLOT_SPACING };
    };
    const blocks = stack.map(block);
    const theirs = block(enemy);
    expect(new Set(blocks.map((b) => `${b.width.toFixed(2)}x${b.depth.toFixed(2)}`)).size).toBeGreaterThan(2);
    // All face east, so a block is `depth` along x and `width` along y.
    for (const b of blocks) expect(Math.cos(b.facing)).toBeCloseTo(1, 9);
    const clear = (p: (typeof blocks)[number], q: (typeof blocks)[number]): boolean =>
      Math.abs(p.x - q.x) > (p.depth + q.depth) / 2 + DEPLOY_GAP - 1e-9 || Math.abs(p.y - q.y) > (p.width + q.width) / 2 + DEPLOY_GAP - 1e-9;
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) expect(clear(blocks[i]!, blocks[j]!), `${kinds[i]} ${i} and ${kinds[j]} ${j}`).toBe(true);
      expect(clear(blocks[i]!, theirs), `${kinds[i]} ${i} and the enemy`).toBe(true);
    }
    // The corps faces the enemy across the gap; no block stands behind the stack's place, off the land or out of reach.
    expect(theirs.x - theirs.depth / 2 - (blocks[0]!.x + blocks[0]!.depth / 2)).toBeCloseTo(DEPLOY_GAP, 9);
    for (const b of blocks) {
      expect(b.x).toBeGreaterThanOrEqual(site[0]);
      expect(w.onLand(b.x, b.y)).toBe(true);
      expect(cellDist(w, b.x, b.y, site[0], site[1])).toBeLessThanOrEqual(DEPLOY_REACH);
    }
  });
});

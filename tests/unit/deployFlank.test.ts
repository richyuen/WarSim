import { describe, expect, it } from 'vitest';
import { SLOT_SPACING, slotGrid } from '../../src/sim/core/pose';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { contactsOf, DEPLOY_GAP, DEPLOY_LINES, DEPLOY_REACH, deployOf, slotCount } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 3.11c2 (critic R3-B3): a formation whose nearest enemy is deployed against a nearer one
// comes up to that enemy's block. It stopped a block's depth and the gap from the block's middle
// whatever side it came from, and a block is twice as wide as deep: from the flank it stood in
// the enemy's block, and in the block of the one that enemy faces (seed 4242, Germany on Poland,
// day 21: 9 pairs of enemies in one another, their middles 0.155 to 0.185 cells apart). Two that
// came to one block from bearings 47° apart stood on each other (formations 222 and 237 on 310).

const W = SIZE_1938.w;
const GER = nationId('GER');
const POL = nationId('POL');
const RAD = Math.PI / 180;

/** The places of the test's formations, from the German cell's middle: all must be land. */
const AROUND: [number, number][] = [];
for (let dy = -1.25; dy <= 1.25; dy += 0.25) for (let dx = -0.5; dx <= 2.25; dx += 0.25) AROUND.push([dx, dy]);

/** A German cell with a Polish one east of it and land all around: [x, y] of the German cell's middle. */
function border(w: World): [number, number] {
  const { owner, w: cw, h: ch } = w.cells;
  for (let y = 2; y < ch - 2; y++) for (let x = 2; x < cw - 4; x++) if (owner[y * cw + x] === GER && owner[y * cw + x + 1] === POL && AROUND.every(([dx, dy]) => w.onLand(x + 0.5 + dx, y + 0.5 + dy))) return [x + 0.5, y + 0.5];
  throw new Error('no German cell with a Polish one east of it, land all around');
}

interface Block {
  x: number;
  y: number;
  facing: number;
  width: number;
  depth: number;
}

function block(w: World, f: number): Block {
  const n = slotCount(w, f, 0);
  const g = slotGrid(n);
  return { ...deployOf(w, f, n)!, width: g.cols * SLOT_SPACING, depth: g.rows * SLOT_SPACING };
}

/** How far apart two blocks stand along the best of their own four axes (negative: in one another). */
function apart(p: Block, q: Block): number {
  const corners = (b: Block): [number, number][] => {
    const [fx, fy] = [Math.cos(b.facing), Math.sin(b.facing)];
    return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => [b.x + (fx * b.depth * i!) / 2 - (fy * b.width * j!) / 2, b.y + (fy * b.depth * i!) / 2 + (fx * b.width * j!) / 2]);
  };
  const [cp, cq] = [corners(p), corners(q)];
  let best = -Infinity;
  for (const b of [p, q]) for (const ang of [b.facing, b.facing + Math.PI / 2]) {
    const pr = cp.map(([x, y]) => x * Math.cos(ang) + y * Math.sin(ang));
    const qr = cq.map(([x, y]) => x * Math.cos(ang) + y * Math.sin(ang));
    best = Math.max(best, Math.min(...qr) - Math.max(...pr), Math.min(...pr) - Math.max(...qr));
  }
  return best;
}

/**
 * A German division at the border and a Polish one a cell east of it, each other's nearest, and
 * more German divisions that come to the Pole's block: each `[bearing, distance]` from that
 * block, the bearing in degrees off the way the block faces (0: from where its enemy stands, 90:
 * its flank, 180: behind it).
 */
function game(comers: [number, number][]): { w: World; faced: number; pole: number; came: number[] } {
  const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
  const w = s.world;
  w.settings.aiEnabled = false;
  const site = border(w);
  const faced = addDivision(w, GER, site[0], site[1]);
  const pole = addDivision(w, POL, site[0] + 1, site[1]);
  // The Pole's block will face west, its middle half the gap and half its depth east of the middle between the two.
  const bx = site[0] + 0.5 + DEPLOY_GAP / 2 + (slotGrid(slotCount(w, pole, 0)).rows * SLOT_SPACING) / 2;
  const came = comers.map(([deg, far]) => addDivision(w, GER, bx - Math.cos(deg * RAD) * far, site[1] - Math.sin(deg * RAD) * far));
  s.command({ kind: 'declareWar', attacker: GER, defender: POL });
  s.step(2);
  const contacts = contactsOf(w);
  expect(contacts.get(pole), 'the Pole faces the division at the border').toBe(faced);
  expect(contacts.get(faced)).toBe(pole);
  for (const f of came) expect(contacts.get(f), 'a comer goes to the Pole').toBe(pole);
  const theirs = block(w, pole);
  expect(theirs.x).toBeCloseTo(bx, 9);
  expect(Math.cos(theirs.facing)).toBeCloseTo(-1, 9);
  return { w, faced, pole, came };
}

/** Every block a gap clear of every other. */
function expectClear(w: World, ids: number[], names: string[]): void {
  const blocks = ids.map((f) => block(w, f));
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) expect(apart(blocks[i]!, blocks[j]!), `${names[i]} and ${names[j]}`).toBeGreaterThan(DEPLOY_GAP - 1e-9);
}

describe('a block that comes up to an enemy block from its flank or its rear stands clear of it (PLAN 3.11c2)', () => {
  it('from the flank (90° off the way the block faces): a gap clear of the block and of the one it faces', () => {
    const { w, faced, pole, came } = game([[90, 1.2]]);
    expectClear(w, [faced, pole, ...came], ['the faced', 'the enemy', 'the comer']);
    // It faces the block it came to, and stands no further from it than the gap.
    const [b, theirs] = [block(w, came[0]!), block(w, pole)];
    expect(Math.sin(b.facing)).toBeCloseTo(1, 9);
    expect(apart(b, theirs)).toBeCloseTo(DEPLOY_GAP, 9);
  });

  it('obliquely (65° and 115°): a gap clear of both', () => {
    for (const [deg, far] of [[65, 1.1], [115, 1.3]] as [number, number][]) {
      const { w, faced, pole, came } = game([[deg, far]]);
      expectClear(w, [faced, pole, ...came], ['the faced', 'the enemy', `the comer from ${deg}°`]);
    }
  });

  it('from behind (180°): the gap from the block\'s rear row', () => {
    const { w, faced, pole, came } = game([[180, 1.5]]);
    expectClear(w, [faced, pole, ...came], ['the faced', 'the enemy', 'the comer']);
    const [b, theirs] = [block(w, came[0]!), block(w, pole)];
    expect(b.x - theirs.x).toBeCloseTo(theirs.depth / 2 + DEPLOY_GAP + b.depth / 2, 9);
  });

  it('two that come from bearings 45° apart do not stand on each other', () => {
    const { w, faced, pole, came } = game([[0, 1], [45, 1], [45, 1]]);
    expectClear(w, [faced, pole, ...came], ['the faced', 'the enemy', 'the comer from 0°', 'the first from 45°', 'the second from 45°']);
  });
});

// PLAN 3.11c3a (critic R3-B3): seven divisions that came to one enemy's block from the side its
// own foe stands on stood behind that foe in one file, six lines deep and 20 km
// (`docs/evidence/3.11/b-furthest-at-its-fight.png`); the fourth to sixth had no enemy in the
// battle's view. A file now holds `DEPLOY_LINES` lines, the faced one among them.
describe('seven divisions on one enemy are files abreast, not a column (PLAN 3.11c3a)', () => {
  /** Half of the battle's view at 20 m/px, 1400 by 800 px, in cells (a cell is 19.57 km): its short side. */
  const HALF_VIEW = (800 * 20) / 19_570 / 2;

  it("a cell and a half from it: no file deeper than the limit, none on another, each with the enemy's block in a view on its own", () => {
    // 0.45 cells west of the division at the border, 1.45 from the Pole: `game` takes the distance from the Pole's block.
    const far = 0.45 + 0.5 + DEPLOY_GAP / 2 + (slotGrid(28).rows * SLOT_SPACING) / 2;
    const { w, faced, pole, came } = game(Array.from({ length: 7 }, () => [0, far] as [number, number]));
    const names = ['the faced', 'the enemy', ...came.map((_, i) => `comer ${i + 1}`)];
    expectClear(w, [faced, pole, ...came], names);
    const theirs = block(w, pole);
    const ids = [faced, ...came];
    const own = ids.map((f) => block(w, f));
    // The files, by where a block stands across the line (north to south here).
    const files = new Map<number, number>();
    for (const b of own) files.set(Math.round(b.y * 1000), (files.get(Math.round(b.y * 1000)) ?? 0) + 1);
    expect(files.size).toBe(Math.ceil(own.length / DEPLOY_LINES));
    expect(Math.max(...files.values()), 'lines in the deepest file').toBeLessThanOrEqual(DEPLOY_LINES);
    const place = w.formations.cols;
    for (const [i, b] of own.entries()) {
      const what = names[i === 0 ? 0 : i + 1]!;
      const f = ids[i]!;
      expect(Math.cos(b.facing), `${what} faces east`).toBeCloseTo(1, 9);
      // No deeper than the limit's lines of blocks before the enemy's.
      expect(theirs.x - b.x, `${what}: from the enemy's block`).toBeLessThan(theirs.depth / 2 + DEPLOY_LINES * (b.depth + DEPLOY_GAP) + 1e-9);
      // The enemy's block, to its far side, in the battle's view on this one's own block, were the fight to lie along the view's short side.
      expect(theirs.x + theirs.depth / 2 - b.x, `${what}: to the far side of the enemy's block`).toBeLessThan(HALF_VIEW);
      // Not behind its own place, nor further from it than a block goes.
      expect(b.x, `${what}: not behind its place`).toBeGreaterThanOrEqual(place.x[f]! - 1e-9);
      expect(Math.hypot(b.x - place.x[f]!, b.y - place.y[f]!), `${what}: from its place`).toBeLessThanOrEqual(DEPLOY_REACH + 1e-9);
      expect(w.onLand(b.x, b.y), `${what}: on land`).toBe(true);
    }
  });
});

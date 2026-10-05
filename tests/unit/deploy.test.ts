import { describe, expect, it } from 'vitest';
import { FIRE_STRIDE, FireField } from '../../src/shared/events';
import { SLOT_SPACING, slotGrid } from '../../src/sim/core/pose';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { contactsOf, DEPLOY_GAP, deployOf, elementIndex, elementPlace, slotCount, slotPlace } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 2.14c1 (the critic's R2-B2, "no battle in a T3 view"): formations in contact stand a cell
// or more apart (up to 1.5: 29 km) and a view at 20 m/px is 28 km wide: it showed one side, and
// shots leaving the screen. The blocks of formations in contact are now deployed against each
// other: on the line to the nearest enemy, front rows a kilometre apart, facing it.

const W = SIZE_1938.w;
const GER = nationId('GER');
const POL = nationId('POL');
/** A view at 20 m/px, 1400 × 800 px, in cells (a cell is 19.6 km). */
const VIEW = { w: (1400 * 20) / 19_570, h: (800 * 20) / 19_570 };

/** A German cell with a Polish one east of it: [x, y] of the German cell's middle. */
function border(w: World): [number, number] {
  const { owner, w: cw, h: ch } = w.cells;
  for (let y = 1; y < ch - 1; y++) for (let x = 1; x < cw - 2; x++) if (owner[y * cw + x] === GER && owner[y * cw + x + 1] === POL && w.onLand(x + 0.5, y + 0.5) && w.onLand(x + 1.5, y + 0.5) && w.onLand(x + 1, y + 0.5)) return [x + 0.5, y + 0.5];
  throw new Error('no German cell with a Polish one east of it, land between');
}

function places(w: World, f: number): [number, number][] {
  const list = elementIndex(w).get(f) ?? [];
  const slots = slotCount(w, f, list.length);
  return list.map((e) => elementPlace(w, f, w.elements.cols.slot[e]!, slots));
}

const mean = (ps: [number, number][]): [number, number] => [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length];

/** A game with a German and a Polish division a cell apart across the border, at war, the AI off. */
function pair(): { s: Sim; a: number; b: number; site: [number, number] } {
  const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
  const w = s.world;
  w.settings.aiEnabled = false;
  const site = border(w);
  const a = addDivision(w, GER, site[0], site[1]);
  const b = addDivision(w, POL, site[0] + 1, site[1]);
  s.command({ kind: 'declareWar', attacker: GER, defender: POL });
  return { s, a, b, site };
}

describe('the blocks of formations in contact are deployed against each other (PLAN 2.14c1)', () => {
  it('two divisions a cell apart stand front to front a kilometre apart and face each other; the formations stay where they are', () => {
    const { s, a, b, site } = pair();
    const w = s.world;
    const fc = w.formations.cols;
    // Before the contact: each block at its formation's place.
    expect(deployOf(w, a, 28)).toBeNull();
    expect(Math.abs(mean(places(w, a))[0] - site[0])).toBeLessThan(0.02); // 28 slots in 8 by 4: the back row is half full
    s.step(2);
    expect([fc.engaged[a], fc.engaged[b]]).toEqual([1, 1]);
    // The formations hold their places: what moved is where their elements are drawn.
    expect([fc.x[a], fc.y[a], fc.x[b], fc.y[b]]).toEqual([site[0], site[1], site[0] + 1, site[1]]);
    expect(contactsOf(w).get(a)).toBe(b);
    expect(contactsOf(w).get(b)).toBe(a);
    const da = deployOf(w, a, 28)!;
    const db = deployOf(w, b, 28)!;
    const depth = slotGrid(28).rows * SLOT_SPACING;
    // On the line between the two, each as far from the middle as half the gap and half its depth.
    expect(da.y).toBeCloseTo(site[1], 9);
    expect(db.y).toBeCloseTo(site[1], 9);
    expect(db.x - da.x).toBeCloseTo(DEPLOY_GAP + depth, 9);
    expect((da.x + db.x) / 2).toBeCloseTo(site[0] + 0.5, 9);
    // Facing each other: the German east, the Pole west.
    expect(Math.cos(da.facing)).toBeCloseTo(1, 9);
    expect(Math.cos(db.facing)).toBeCloseTo(-1, 9);
    // Every element of both in one view at 20 m/px, with room: the two blocks span a third of a cell.
    const all = [...places(w, a), ...places(w, b)];
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.3);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.3);
    expect(VIEW.w).toBeGreaterThan(1.4);
    // No German element east of a Polish one: the front rows do not cross.
    expect(Math.max(...places(w, a).map((p) => p[0]))).toBeLessThan(Math.min(...places(w, b).map((p) => p[0])));
    // The front row is the row nearest the enemy: the batteries (the last slots) are at the back.
    const pa = places(w, a);
    expect(pa[0]![0]).toBeGreaterThan(pa.at(-1)![0]);
    for (const p of all) expect(w.onLand(p[0], p[1])).toBe(true);
  });

  it('the shots of an hour are between the deployed blocks: a tracer is a kilometre or three long, not a cell', () => {
    const { s } = pair();
    s.step(2);
    let longest = 0;
    let shots = 0;
    s.step(1, (w) => {
      const f = w.out.fires;
      for (let i = 0; i < f.length; i += FIRE_STRIDE) {
        shots++;
        longest = Math.max(longest, Math.hypot(f[i + FireField.x1]! - f[i + FireField.x0]!, f[i + FireField.y1]! - f[i + FireField.y0]!));
      }
      f.length = 0;
      w.out.events.length = 0;
    });
    expect(shots).toBeGreaterThan(20);
    // Front row to the far corner of the other block's back row; a cell before.
    expect(longest).toBeLessThan(0.32);
    expect(longest).toBeGreaterThan(DEPLOY_GAP);
  });

  it('where a block stands is not state: worked out anew after a load it is the same, and the hash never knew', () => {
    const { s, a, b } = pair();
    s.step(30);
    const w = s.world;
    const before = [places(w, a), places(w, b)];
    const hash = s.hash();
    // What `findBattles` left, thrown away: `contactsOf` and `deployOf` get it from the state.
    w.contacts = null;
    w.deployed = null;
    expect([places(w, a), places(w, b)]).toEqual(before);
    expect(s.hash()).toBe(hash);
    const loaded = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    loaded.load(s.save());
    expect(loaded.world.contacts).toBeNull();
    expect([places(loaded.world, a), places(loaded.world, b)]).toEqual(before);
    expect(loaded.hash()).toBe(hash);
  });

  it('a formation that is not in contact, and one whose enemy is across water, stand as before', () => {
    const { s, a } = pair();
    const w = s.world;
    const fc = w.formations.cols;
    // Every formation of the start that is not engaged: its elements at its own place.
    s.step(2);
    let checked = 0;
    w.formations.forEach((f) => {
      if (fc.engaged[f] === 1 || checked >= 50) return;
      const list = elementIndex(w).get(f);
      if (!list) return;
      const slots = slotCount(w, f, list.length);
      expect(elementPlace(w, f, w.elements.cols.slot[list[0]!]!, slots)).toEqual(slotPlace(w, fc.x[f]!, fc.y[f]!, fc.facing[f]!, w.elements.cols.slot[list[0]!]!, slots));
      checked++;
    });
    expect(checked).toBe(50);
    // And no block of an engaged one stands on water, anywhere in the world.
    w.formations.forEach((f) => {
      if (fc.engaged[f] !== 1 || !w.onLand(fc.x[f]!, fc.y[f]!)) return;
      const d = deployOf(w, f, slotCount(w, f, elementIndex(w).get(f)?.length ?? 0));
      if (d) expect(w.onLand(d.x, d.y), `formation ${f}`).toBe(true);
    });
    expect(deployOf(w, a, 28)).not.toBeNull();
  });

  it('after 60 days of Germany against Poland most formations in contact have their enemy\'s elements in one view at 20 m/px', () => {
    const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    s.command({ kind: 'declareWar', attacker: GER, defender: POL });
    s.step(24 * 60);
    const w = s.world;
    const fc = w.formations.cols;
    let engaged = 0;
    let both = 0;
    let before = 0;
    w.formations.forEach((f) => {
      if (fc.engaged[f] !== 1 || !elementIndex(w).has(f)) return;
      const enemy = contactsOf(w).get(f);
      if (enemy === undefined) return;
      engaged++;
      const mine = places(w, f);
      const theirs = places(w, enemy);
      // In one view, 50 px clear of its edges: the view centred between the two blocks holds
      // half or more of the elements of each.
      const inView = (a: [number, number][], b: [number, number][]): boolean => {
        const [ma, mb] = [mean(a), mean(b)];
        const cx = (ma[0] + mb[0]) / 2;
        const cy = (ma[1] + mb[1]) / 2;
        const seen = (ps: [number, number][]): number => ps.filter((p) => Math.abs(p[0] - cx) < VIEW.w / 2 - 0.05 && Math.abs(p[1] - cy) < VIEW.h / 2 - 0.05).length;
        return seen(a) * 2 >= a.length && seen(b) * 2 >= b.length;
      };
      if (inView(mine, theirs)) both++;
      // As it was: each block at its formation's place.
      const at = (g: number): [number, number][] => (elementIndex(w).get(g) ?? []).map((e) => slotPlace(w, fc.x[g]!, fc.y[g]!, fc.facing[g]!, w.elements.cols.slot[e]!, slotCount(w, g, 0)));
      if (inView(at(f), at(enemy))) before++;
    });
    console.log(`day 60 of Germany against Poland (seed 99): ${engaged} formations in contact; ${both} of them (${((100 * both) / engaged).toFixed(0)}%) share a view at 20 m/px with their nearest enemy, half or more of each side's elements in it; with the blocks at the formations' places ${before} (${((100 * before) / engaged).toFixed(0)}%)`);
    // Blocks on one another: two deployed blocks whose middles are less than a block's depth apart.
    const blocks: [number, number, number][] = [];
    w.formations.forEach((f) => {
      const d = fc.engaged[f] === 1 ? deployOf(w, f, slotCount(w, f, elementIndex(w).get(f)?.length ?? 0)) : null;
      if (d) blocks.push([f, d.x, d.y]);
    });
    let onAnother = 0;
    for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) if (Math.hypot(blocks[i]![1] - blocks[j]![1], blocks[i]![2] - blocks[j]![2]) < 0.1) onAnother++;
    console.log(`day 60: ${blocks.length} deployed blocks, ${onAnother} pairs of them with their middles under 0.1 cells apart`);
    expect(onAnother / blocks.length).toBeLessThan(0.1);
    expect(engaged).toBeGreaterThan(10);
    expect(both / engaged).toBeGreaterThan(0.9);
    expect(before / engaged).toBeLessThan(0.5);
  });
});

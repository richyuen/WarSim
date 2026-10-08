import { describe, expect, it } from 'vitest';
import { EventKind, FIRE_STRIDE, FireField } from '../../src/shared/events';
import { SLOT_SPACING, slotGrid } from '../../src/sim/core/pose';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { cellDist, CONTACT_CELLS, contactsOf, DEPLOY_GAP, DEPLOY_REACH, deployOf, elementIndex, elementPlace, recomputeStrength, slotCount, slotPlace } from '../../src/sim/systems/elements';
import { orderMove } from '../../src/sim/systems/movement';
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
  return list.map((e) => elementPlace(w, f, w.elements.cols.slot[e]!, slots, e));
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

  it('two divisions on one point stand front to front too: the lower id faces east, the gap between their front rows (PLAN 3.5a)', () => {
    const { s, a, b, site } = pair();
    const w = s.world;
    const fc = w.formations.cols;
    fc.x[b] = site[0]; // a formation on the retreat is in no contact, and may halt where an enemy stands
    s.step(2);
    expect([fc.engaged[a], fc.engaged[b]]).toEqual([1, 1]);
    const da = deployOf(w, a, 28)!;
    const db = deployOf(w, b, 28)!;
    expect(da).not.toBeNull();
    expect(db).not.toBeNull();
    const depth = slotGrid(28).rows * SLOT_SPACING;
    expect(a).toBeLessThan(b);
    expect(da.facing).toBe(0);
    expect(Math.abs(db.facing)).toBeCloseTo(Math.PI, 12);
    expect(db.x - da.x).toBeCloseTo(DEPLOY_GAP + depth, 12);
    expect([da.y, db.y]).toEqual([site[1], site[1]]);
  });

  it('an element that dies in the hour its formation marched into contact leaves its event where it stood the hour before (PLAN 3.5a)', () => {
    const { s, a, b, site } = pair();
    const w = s.world;
    const fc = w.formations.cols;
    const ec = w.elements.cols;
    // The German division a cell back, worn to a man an element, on the march to the cell beside the Polish one.
    // (Not the Polish one on the march: the cell before it turns German, and a march waits before the enemy's cell.)
    fc.x[a] = site[0] - 1;
    for (const e of elementIndex(w).get(a)!) ec.strength[e] = 1;
    recomputeStrength(w, a);
    expect(orderMove(w, a, site[0], site[1])).toBe(true);
    expect(cellDist(w, fc.x[a]!, fc.y[a]!, fc.x[b]!, fc.y[b]!)).toBeGreaterThan(CONTACT_CELLS);
    const mine = new Set(elementIndex(w).get(a)!);
    let deaths = 0;
    let onTheMarch = 0;
    for (let hour = 0; hour < 24 * 5 && deaths === 0; hour++) {
      const list = elementIndex(w).get(a)!;
      const slots = slotCount(w, a, list.length);
      const stood = new Map(list.map((e) => [e, elementPlace(w, a, ec.slot[e]!, slots, e)] as const));
      const from = fc.x[a]!;
      const inContact = fc.engaged[a] === 1;
      s.step(1, (world) => {
        const ev = world.out.events;
        for (let i = 0; i < ev.length; i += 6) {
          if (ev[i + 1] !== EventKind.ElementDestroyed || !mine.has(ev[i + 2]!)) continue;
          deaths++;
          if (!inContact && world.formations.has(a) && fc.x[a] !== from) onTheMarch++;
          const [x, y] = stood.get(ev[i + 2]!)!;
          expect(ev[i + 4]).toBeCloseTo(x, 9);
          expect(ev[i + 5]).toBeCloseTo(y, 9);
        }
        ev.length = 0;
        world.out.fires.length = 0;
      });
    }
    expect(deaths).toBeGreaterThan(0);
    // The case: not in contact the hour before, and moved in the hour of its first losses.
    expect(onTheMarch).toBeGreaterThan(0);
    expect(w.formations.has(b)).toBe(true);
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
      expect(elementPlace(w, f, w.elements.cols.slot[list[0]!]!, slots, list[0]!)).toEqual(slotPlace(w, fc.x[f]!, fc.y[f]!, fc.facing[f]!, w.elements.cols.slot[list[0]!]!, slots));
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

  it('ten divisions on one cell against one enemy stand in lines abreast: none on another, all near the block of the enemy', () => {
    const { s, a, b, site } = pair();
    const w = s.world;
    const stack = [a, ...Array.from({ length: 9 }, () => addDivision(w, GER, site[0], site[1]))];
    s.step(2);
    const blocks = stack.map((f) => deployOf(w, f, 28)!);
    const theirs = deployOf(w, b, 28)!;
    const grid = slotGrid(28);
    const [width, depth] = [grid.cols * SLOT_SPACING, grid.rows * SLOT_SPACING];
    // None on another: a block's depth and the gap apart in a file, its width and the gap in a line.
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const [dx, dy] = [Math.abs(blocks[i]!.x - blocks[j]!.x), Math.abs(blocks[i]!.y - blocks[j]!.y)];
        expect(dx > depth + DEPLOY_GAP - 1e-9 || dy > width + DEPLOY_GAP - 1e-9).toBe(true);
      }
    }
    // The first faces the Pole across the gap; no line stands behind the stack's place.
    const xs = blocks.map((d) => d.x);
    expect(theirs.x - Math.max(...xs)).toBeCloseTo(DEPLOY_GAP + depth, 9);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(site[0]);
    for (const d of blocks) {
      expect(Math.cos(d.facing)).toBeCloseTo(1, 9);
      expect(cellDist(w, d.x, d.y, site[0], site[1])).toBeLessThanOrEqual(DEPLOY_REACH);
      // Every block and the enemy's in one view at 20 m/px, centred between the two, 50 px clear of its edges.
      expect(theirs.x - d.x).toBeLessThan(VIEW.w - 0.1);
      expect(Math.abs(theirs.y - d.y)).toBeLessThan(VIEW.h - 0.1);
      expect(w.onLand(d.x, d.y)).toBe(true);
    }
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

  // PLAN 2.14f4: how often a block changes its line. Where a block stands follows from who the
  // formation's nearest enemy is and where the two stand, hour by hour, and the worker shows
  // each change as one hour's move of the elements. Counted here over the 60 days, for every
  // hour a formation is in contact and was in contact the hour before (a "block-hour"):
  // - *a hop:* the block's middle is more than a block's depth (0.12 cells, 2.3 km) from where
  //   it stood the hour before. Less than that is the front creeping, which reads as a move.
  // - of the hops, those with another nearest enemy than the hour before, and those of a
  //   formation that itself stood still (the line changed under it).
  // The first and last hours of a contact (to the line, and back) are counted apart.
  //
  // PLAN 2.14f5c, in the same hours: how far a block stands from its own formation. A block that
  // comes up to the block of an enemy deployed the other way stood up to 44 km from the formation
  // (80 km on seed 7), further than contact reaches (29 km). It now stops at `DEPLOY_REACH`.
  it('over 60 days of Germany against Poland a block in contact seldom changes its line, and none stands further from its formation than contact reaches', () => {
    const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    s.command({ kind: 'declareWar', attacker: GER, defender: POL });
    const HOP = slotGrid(28).rows * SLOT_SPACING;
    let was = new Map<number, { x: number; y: number; enemy: number; fx: number; fy: number }>();
    const n = { hours: 0, begun: 0, ended: 0, moved: 0, hops: 0, otherEnemy: 0, stoodStill: 0, far: 0 };
    const sizes: number[] = [];
    const perFormation = new Map<number, number>();
    const reach = { blockHours: 0, furthest: 0, atLimit: 0, mutualAtLimit: 0, gap: 0 };
    s.step(24 * 60, (w) => {
      const fc = w.formations.cols;
      const now = new Map<number, { x: number; y: number; enemy: number; fx: number; fy: number }>();
      for (const [f, d] of w.deployed ?? []) {
        const enemy = contactsOf(w).get(f);
        if (!d || enemy === undefined || !w.formations.has(f)) continue;
        now.set(f, { x: d.x, y: d.y, enemy, fx: fc.x[f]!, fy: fc.y[f]! });
      }
      for (const [f, d] of now) {
        const from = cellDist(w, d.fx, d.fy, d.x, d.y);
        reach.blockHours++;
        reach.furthest = Math.max(reach.furthest, from);
        if (from > DEPLOY_REACH - 1e-6) {
          // Held back: it stands short of the block it was going to.
          reach.atLimit++;
          if (contactsOf(w).get(d.enemy) === f) reach.mutualAtLimit++;
          const theirs = now.get(d.enemy);
          if (theirs) reach.gap = Math.max(reach.gap, cellDist(w, d.x, d.y, theirs.x, theirs.y));
        }
        const b = was.get(f);
        if (!b) {
          n.begun++;
          continue;
        }
        n.hours++;
        let dx = Math.abs(d.x - b.x);
        if (dx > W / 2) dx = W - dx;
        const moved = Math.hypot(dx, d.y - b.y);
        if (moved > 1e-9) n.moved++;
        if (moved <= HOP) continue;
        n.hops++;
        sizes.push(moved);
        perFormation.set(f, (perFormation.get(f) ?? 0) + 1);
        if (d.enemy !== b.enemy) n.otherEnemy++;
        if (d.fx === b.fx && d.fy === b.fy) n.stoodStill++;
        if (moved > 0.5) n.far++;
      }
      for (const f of was.keys()) if (!now.has(f)) n.ended++;
      was = now;
      w.out.events.length = 0;
      w.out.fires.length = 0;
    });
    sizes.sort((a, b) => a - b);
    const km = (cells: number): string => (cells * 19.57).toFixed(1);
    const most = Math.max(0, ...perFormation.values());
    console.log(
      `60 days of Germany against Poland (seed 99), hour by hour: ${n.hours} block-hours in contact; the block moved at all in ${n.moved} (${((100 * n.moved) / n.hours).toFixed(1)}%); ` +
        `${n.hops} hops of more than a block's depth (${((100 * n.hops) / n.hours).toFixed(2)}%, one in ${(n.hours / Math.max(1, n.hops)).toFixed(0)} hours a block): ` +
        `${n.otherEnemy} with another nearest enemy, ${n.stoodStill} of a formation that stood still, ${n.far} of more than half a cell; ` +
        `median ${km(sizes[sizes.length >> 1] ?? 0)} km, longest ${km(sizes.at(-1) ?? 0)} km; ${perFormation.size} formations hopped, the most ${most} times; ` +
        `${n.begun} contacts begun, ${n.ended} ended`,
    );
    console.log(
      `the same hours: ${reach.blockHours} block-hours; the furthest block ${km(reach.furthest)} km from its formation; at the limit of ${km(DEPLOY_REACH)} km in ${reach.atLimit} (${((100 * reach.atLimit) / reach.blockHours).toFixed(1)}%), ` +
        `${reach.mutualAtLimit} of them each other's nearest; a block at the limit is at most ${km(reach.gap)} km from its enemy's block`,
    );
    // No block further from its formation than an enemy in contact can be (the sums of the way
    // there leave a rounding). The limit is met on this front, and never by two that are each
    // other's nearest: they go half the way between them.
    expect(reach.furthest).toBeLessThanOrEqual(CONTACT_CELLS + 1e-9);
    expect(reach.atLimit).toBeGreaterThan(100);
    expect(reach.mutualAtLimit).toBe(0);
    // A block held back is still nearer its enemy's block than contact reaches.
    expect(reach.gap).toBeLessThan(DEPLOY_REACH);
    expect(n.hours).toBeGreaterThan(1000);
    // A block stands still in most of its hours, and a hop is rare: the picture at T2 and T3 is
    // of lines that hold, not of blocks changing places.
    expect(n.hops / n.hours).toBeLessThan(0.05);
  });
});

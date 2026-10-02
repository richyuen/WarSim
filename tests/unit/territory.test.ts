import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Terrain } from '../../src/shared/terrain';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { frontierOf, HOLD_TICKS, territorySystem } from '../../src/sim/systems/territory';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 1.14 territory pressure + frontier-set flips + connectivity rule. AT: a front advances
// like a wave (cells flipped per day within a band); no "teleport" flips behind a defended line;
// the frontier set stays bounded (perf).

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const GER = nationId('GER');
const POL = nationId('POL');
const [X0, Y0] = cellOf(30.0, 50.0, W, H).map(Math.floor) as [number, number];
const BW = 40; // block: x in [X0, X0+BW), y in [Y0, Y0+BH); GER west of X0+20, POL east
const BH = 12;
const SPLIT = X0 + 20;

/** A sim with no formations and a GER|POL test block on plains, the two at war. */
function block(seed = 1): Sim {
  const s = new Sim({ scenario: '1938', seed, assets: assets1938(W) });
  s.world.settings.aiEnabled = false; // isolate the mechanism from the AI (PLAN 1.24–1.25)
  const w = s.world;
  w.formations.ids().forEach((id) => destroyFormation(w, id));
  for (let y = Y0; y < Y0 + BH; y++) {
    for (let x = X0; x < X0 + BW; x++) {
      w.cells.terrain[y * W + x] = Terrain.Plains;
      w.setController(y * W + x, x < SPLIT ? GER : POL);
    }
  }
  w.wars.set(GER, POL, true);
  return s;
}

/** A division centred in cell (x, y). */
const spawn = (world: World, nation: number, x: number, y: number): number => addDivision(world, nation, x + 0.5, y + 0.5);

const gerCells = (w: World): number => {
  let n = 0;
  for (let y = Y0; y < Y0 + BH; y++) for (let x = X0; x < X0 + BW; x++) if (w.cells.controller[y * W + x] === GER) n++;
  return n;
};

/** Every cell that changed controller in a tick had a 4-neighbour held by its new controller. */
function checkConnected(before: Uint16Array, after: Uint16Array): number {
  let flips = 0;
  for (let c = 0; c < after.length; c++) {
    if (before[c] === after[c]) continue;
    flips++;
    const x = c % W;
    const ns = [c - W, c + W, x > 0 ? c - 1 : c + W - 1, x < W - 1 ? c + 1 : c - W + 1];
    expect(ns.some((n) => before[n] === after[c])).toBe(true);
  }
  return flips;
}

describe('territory pressure and fronts (PLAN 1.14)', () => {
  it('an advancing army pushes the front forward like a wave, one cell at a time', () => {
    const s = block(2);
    const w = s.world;
    const divs = [Y0 + 2, Y0 + 6, Y0 + 9].map((y) => spawn(w, GER, SPLIT - 1, y));
    for (const id of divs) s.command({ kind: 'moveFormation', id, x: X0 + BW - 3, y: w.formations.cols.y[id]! });
    const perDay: number[] = [];
    let prev = new Uint16Array(w.cells.controller);
    let dayFlips = 0;
    for (let hour = 1; hour <= 24 * 8; hour++) {
      s.step(1);
      dayFlips += checkConnected(prev, w.cells.controller);
      prev = new Uint16Array(w.cells.controller);
      if (hour % 24 === 0) {
        perDay.push(dayFlips);
        dayFlips = 0;
      }
    }
    const log = process.env['TERRITORY_LOG'];
    if (log) writeFileSync(log, JSON.stringify({ perDay, ger: gerCells(w) }));
    // Within a band: steady progress every day, never more than the hold time allows
    // (BH rows × 24/HOLD_TICKS cells per row per day).
    for (const n of perDay.slice(1)) {
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThanOrEqual(BH * Math.ceil(24 / HOLD_TICKS));
    }
    expect(gerCells(w)).toBeGreaterThan(BH * 20 + 30);
  });

  it('no teleport: a strong army behind a defended line flips nothing until the line falls', () => {
    const s = block(3);
    const w = s.world;
    // A Polish line two cells east of the border, one division per row pair.
    for (let y = Y0; y < Y0 + BH; y += 2) spawn(w, POL, SPLIT + 2, y);
    // Three German divisions deep behind it (no German-held neighbour there).
    for (const y of [Y0 + 3, Y0 + 6, Y0 + 9]) spawn(w, GER, SPLIT + 10, y);
    const before = new Uint16Array(w.cells.controller);
    for (let h = 0; h < 24 * 4; h++) {
      const prev = new Uint16Array(w.cells.controller);
      territorySystem(w);
      w.tick++;
      checkConnected(prev, w.cells.controller);
    }
    for (let y = Y0; y < Y0 + BH; y++) for (let x = SPLIT + 3; x < X0 + BW; x++) expect(w.cells.controller[y * W + x]).toBe(before[y * W + x]);
  });

  it('a defended line holds against equal pressure', () => {
    const s = block(4);
    const w = s.world;
    for (let y = Y0; y < Y0 + BH; y += 2) {
      spawn(w, POL, SPLIT, y);
      spawn(w, GER, SPLIT - 1, y);
    }
    const before = gerCells(w);
    for (let h = 0; h < 24 * 3; h++) {
      territorySystem(w);
      w.tick++;
    }
    expect(gerCells(w)).toBe(before); // equal forces: the border does not move
  });

  it('the frontier set is the border, stays consistent under flips and costs little per tick', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.wars.set(GER, POL, true);
    const f0 = frontierOf(w);
    // Bounded: border cells only (GER-POL plus the Spanish and Chinese fronts), not the map.
    expect(f0.size).toBeGreaterThan(50);
    expect(f0.size).toBeLessThan(6000);
    const t0 = performance.now();
    s.step(24 * 3);
    const perTick = (performance.now() - t0) / 72;
    // Incremental upkeep equals a full rebuild.
    const incremental = [...frontierOf(w)].sort((a, b) => a - b);
    w.frontier = null;
    const rebuilt = [...frontierOf(w)].sort((a, b) => a - b);
    expect(incremental).toEqual(rebuilt);
    expect(perTick).toBeLessThan(25);
  });

  it('a front is deterministic across save/load into a live sim', () => {
    const run = (split: boolean): number => {
      const s = block(6);
      for (const y of [Y0 + 3, Y0 + 8]) spawn(s.world, GER, SPLIT - 1, y);
      s.step(20); // mid hold
      if (!split) {
        s.step(40);
        return s.hash();
      }
      const t = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
      t.step(2);
      t.load(s.save());
      t.step(40);
      return t.hash();
    };
    expect(run(true)).toBe(run(false));
    expect(H).toBe(SIZE_1938.h);
  });
});

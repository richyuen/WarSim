import { describe, expect, it } from 'vitest';
import { Terrain } from '../../src/shared/terrain';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { SUPPLY_REACH, blocOf, refreshSupplyNetwork } from '../../src/sim/systems/supply';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { PZ } from '../helpers/pocket';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 1.12 supply v1. AT: an encircled formation's supply → 0 within a day and it attrits.

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const INF = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
const cellAt = (lon: number, lat: number): number => {
  const [x, y] = cellOf(lon, lat, W, H);
  return Math.floor(y) * W + Math.floor(x);
};

function spawnAt(world: World, tag: string, cell: number): number {
  const f = world.formations;
  const id = f.create();
  f.cols.nation[id] = nationId(tag);
  f.cols.template[id] = INF;
  f.cols.x[id] = (cell % W) + 0.5;
  f.cols.y[id] = Math.floor(cell / W) + 0.5;
  f.cols.strength[id] = 10_000;
  f.cols.supply[id] = 1;
  f.cols.org[id] = 1;
  return id;
}
const spawn = (world: World, tag: string, lon: number, lat: number): number => spawnAt(world, tag, cellAt(lon, lat));

/** A cell of `tag` near (lon, lat) with no city within `r` cells and all land within `r`. */
function quietCell(world: World, tag: string, lon: number, lat: number, r: number): number {
  const cityCells = new Set<number>();
  world.cities.forEach((id) => void cityCells.add(world.cities.cols.cell[id]!));
  const c0 = cellAt(lon, lat);
  for (let d = 0; d < 30; d++) {
    for (let k = -d; k <= d; k++) {
      for (const c of [c0 + k + d * W, c0 + k - d * W, c0 + d + k * W, c0 - d + k * W]) {
        let ok = world.cells.controller[c] === nationId(tag);
        for (let dy = -r; ok && dy <= r; dy++) {
          for (let dx = -r; ok && dx <= r; dx++) {
            const n = c + dy * W + dx;
            if (cityCells.has(n) || world.cells.controller[n] === 0) ok = false;
          }
        }
        if (ok) return c;
      }
    }
  }
  throw new Error('no quiet cell');
}

/** Hands a ring (radius r0..r1 cells, Chebyshev) around `centre` to `tag`: a pocket inside. */
function encircle(world: World, centre: number, tag: string, r0: number, r1: number): void {
  const cx = centre % W;
  const cy = (centre - cx) / W;
  for (let dy = -r1; dy <= r1; dy++) {
    for (let dx = -r1; dx <= r1; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < r0) continue;
      const c = (cy + dy) * W + cx + dx;
      if (world.cells.controller[c] !== 0) world.cells.controller[c] = nationId(tag);
    }
  }
}

/**
 * The network rule, cell by cell (the flood before PLAN 1.42a): blocs in ascending order, each
 * spreading 4-connected (wrapping x) from its sources over cells it holds and free crossing lanes.
 * `layer` is the network so far; with `only`, just those blocs are cleared and flooded again.
 */
function referenceNetwork(world: World, layer: Uint16Array, only?: Set<number>): Uint16Array {
  const { controller, owner, terrain } = world.cells;
  const out = only ? layer.map((b) => (only.has(b) ? 0 : b)) : new Uint16Array(layer.length);
  const sources = new Map<number, number[]>();
  world.cities.forEach((id) => {
    const cell = world.cities.cols.cell[id]!;
    const ctl = controller[cell]!;
    if (ctl === 0 || owner[cell] !== ctl) return;
    const b = blocOf(world, ctl);
    if (only && !only.has(b)) return;
    sources.set(b, [...(sources.get(b) ?? []), cell]);
  });
  for (const b of [...sources.keys()].sort((p, q) => p - q)) {
    const queue = sources.get(b)!.filter((s) => out[s] === 0);
    for (const s of queue) out[s] = b;
    for (let head = 0; head < queue.length; head++) {
      const c = queue[head]!;
      const x = c % W;
      const y = (c - x) / W;
      for (const n of [y > 0 ? c - W : -1, y < H - 1 ? c + W : -1, x > 0 ? c - 1 : c + W - 1, x < W - 1 ? c + 1 : c - W + 1]) {
        if (n < 0 || out[n] !== 0) continue;
        const ctl = controller[n]!;
        if (ctl !== 0 ? blocOf(world, ctl) !== b : terrain[n] !== Terrain.Crossing) continue;
        out[n] = b;
        queue.push(n);
      }
    }
  }
  return out;
}

describe('supply v1 (PLAN 1.12)', () => {
  it('a nation supplies its own territory; Germany and Poland have separate networks', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    refreshSupplyNetwork(s.world);
    expect(s.world.cells.supply[cellAt(10.0, 51.0)]).toBe(nationId('GER'));
    expect(s.world.cells.supply[cellAt(20.0, 52.0)]).toBe(nationId('POL'));
    expect(s.world.cells.supply[cellAt(-30.0, 40.0)]).toBe(0); // Atlantic
  });

  it('puppets share their overlord’s supply bloc', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const puppet = NATIONS_1938.find((n) => n.overlord);
    expect(puppet).toBeDefined();
    expect(blocOf(s.world, nationId(puppet!.tag))).toBe(nationId(puppet!.overlord!.tag));
  });

  it('an encircled formation runs out of supply within a day and attrits; a supplied one does not', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const pocket = quietCell(s.world, 'SOV', 45.0, 62.0, 4); // Russian north, no city in the pocket
    const cut = spawnAt(s.world, 'SOV', pocket);
    const free = spawn(s.world, 'POL', 20.0, 52.0);
    encircle(s.world, pocket, 'GER', 2, 4);
    s.step(24);
    const f = s.world.formations.cols;
    expect(s.world.cells.supply[pocket]).toBe(0);
    expect(f.supply[cut]).toBe(0);
    expect(f.strength[cut]).toBeLessThan(10_000);
    expect(f.supply[free]).toBe(1);
    expect(f.strength[free]).toBe(10_000);
    // Attrition continues: about 2%+ per day out of supply.
    const after1 = f.strength[cut]!;
    s.step(24 * 5);
    expect(f.strength[cut]!).toBeLessThan(after1 * 0.92);
  });

  it('a formation on ground that is not its side’s is fed within SUPPLY_REACH cells of its network (PLAN 3.4Rf)', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.aiEnabled = false;
    w.wars.start([nationId('GER')], [nationId('SOV')], 0);
    // Seven cells square of German-held ground in the Soviet north: the Soviet network begins at 4.
    const centre = quietCell(w, 'SOV', 45.0, 62.0, 7);
    encircle(w, centre, 'GER', 0, 3);
    w.supplyDirty = true;
    const [beside, two, three, deep] = [3, 2, 1, 0].map((dx) => spawnAt(w, 'SOV', centre + dx)) as [number, number, number, number];
    const pz = addDivision(w, nationId('SOV'), (centre % W) + 2.5, Math.floor(centre / W) + 0.5, PZ);
    const pzDeep = addDivision(w, nationId('SOV'), (centre % W) + 0.5, Math.floor(centre / W) + 0.5, PZ);
    s.step(12); // dry in 8 h off the network; no cell turns before its 16th hour
    const f = w.formations.cols;
    for (const dx of [0, 1, 2, 3]) expect(w.cells.controller[centre + dx]).toBe(nationId('GER'));
    expect(f.supply[beside]).toBe(1);
    expect(f.supply[two]).toBe(1);
    expect(f.strength[two]).toBe(10_000);
    expect(f.supply[three]).toBe(0);
    expect(f.supply[deep]).toBe(0);
    expect(f.strength[deep]!).toBeLessThan(10_000);
    // What moves on engines keeps its order there, and loses it where the network is out of reach.
    expect(f.supply[pz]).toBe(1);
    expect(f.org[pz]).toBe(1);
    expect(f.supply[pzDeep]).toBe(0);
    expect(f.org[pzDeep]!).toBeLessThan(1);
    expect(SUPPLY_REACH).toBe(2);
  });

  it('a pocket is not fed across the ring, however thin: its own ground with no network is dry (PLAN 3.4Rf)', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.aiEnabled = false;
    const pocket = quietCell(w, 'SOV', 45.0, 62.0, 5);
    encircle(w, pocket, 'GER', 2, 2); // one cell of ring: the Soviet network is two cells from the pocket's edge
    w.supplyDirty = true;
    const edge = spawnAt(w, 'SOV', pocket + 1);
    s.step(12);
    expect(w.cells.controller[pocket + 1]).toBe(nationId('SOV'));
    expect(w.cells.supply[pocket + 1]).toBe(0);
    expect(w.cells.supply[pocket + 3]).toBe(nationId('SOV'));
    expect(w.formations.cols.supply[edge]).toBe(0);
  });

  it('supply is restored when the pocket is relieved', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const pocket = quietCell(s.world, 'SOV', 45.0, 62.0, 4);
    const id = spawnAt(s.world, 'SOV', pocket);
    const before = new Uint16Array(s.world.cells.controller);
    encircle(s.world, pocket, 'GER', 2, 4);
    s.step(24);
    expect(s.world.formations.cols.supply[id]).toBe(0);
    s.world.cells.controller.set(before);
    s.world.supplyDirty = true; // raw layer writes must notify (setController does)
    s.step(24);
    expect(s.world.formations.cols.supply[id]).toBe(1);
  });

  it('supply state survives save/load (network layer and formation supply are state)', () => {
    const run = (split: boolean): number => {
      const s = new Sim({ scenario: '1938', seed: 3, assets: assets1938(W) });
      const pocket = quietCell(s.world, 'SOV', 45.0, 62.0, 4);
      spawnAt(s.world, 'SOV', pocket);
      encircle(s.world, pocket, 'GER', 2, 4);
      s.step(9); // mid refresh interval
      if (!split) {
        s.step(40);
        return s.hash();
      }
      const t = new Sim({ scenario: '1938', seed: 4, assets: assets1938(W) });
      t.load(s.save());
      t.step(40);
      return t.hash();
    };
    expect(run(true)).toBe(run(false));
  });

  it('an army on the soil of a nation it fights beside is fed and stays; otherwise it starves and is sent home (PLAN 1.42b)', () => {
    const run = (together: boolean): { supply: number; moving: number } => {
      const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
      const w = s.world;
      w.settings.aiEnabled = false;
      if (together) w.wars.start([nationId('GER'), nationId('ITA')], [nationId('POL')], 0);
      const id = spawn(w, 'ITA', 10.0, 51.0); // central Germany
      s.step(20);
      return { supply: w.formations.cols.supply[id]!, moving: w.formations.cols.moving[id]! };
    };
    expect(run(true)).toEqual({ supply: 1, moving: 0 });
    expect(run(false)).toEqual({ supply: 0, moving: 1 }); // repatriation: marching home
  });

  it('the span flood equals the cell-by-cell rule, for a full and for a partial refresh (PLAN 1.42a)', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    refreshSupplyNetwork(w);
    expect(w.cells.supply).toEqual(referenceNetwork(w, w.cells.supply));
    // Partial: Germany takes a ring out of the Soviet north (a pocket) and a ring out of Poland,
    // and the Soviet cells at the date line (both map edges) go to Japan.
    const before = new Uint16Array(w.cells.supply);
    const pocket = quietCell(w, 'SOV', 45.0, 62.0, 4);
    const ring = (centre: number, tag: string, r0: number, r1: number): void => {
      for (let dy = -r1; dy <= r1; dy++) {
        for (let dx = -r1; dx <= r1; dx++) {
          const c = centre + dy * W + dx;
          if (Math.max(Math.abs(dx), Math.abs(dy)) >= r0 && w.cells.controller[c] !== 0) w.setController(c, nationId(tag));
        }
      }
    };
    ring(pocket, 'GER', 2, 4);
    ring(cellAt(20.0, 52.0), 'GER', 3, 9);
    let edge = 0;
    for (let c = 0; c < W * H; c++) {
      if ((c % W >= 6 && c % W < W - 6) || w.cells.controller[c] !== nationId('SOV')) continue;
      w.setController(c, nationId('JAP'));
      edge++;
    }
    expect(edge).toBeGreaterThan(0);
    expect(w.supplyDirty).toBe(false);
    const dirty = new Set([...w.supplyDirtyNations].filter((n) => n !== 0).map((n) => blocOf(w, n)));
    expect(dirty.size).toBeGreaterThanOrEqual(4);
    refreshSupplyNetwork(w);
    expect(w.cells.supply[pocket]).toBe(0);
    expect(w.cells.supply).toEqual(referenceNetwork(w, before, dirty));
    // A second partial refresh of the same blocs clears exactly what the first one filled.
    for (const n of dirty) w.supplyDirtyNations.add(n);
    const again = new Uint16Array(w.cells.supply);
    refreshSupplyNetwork(w);
    expect(w.cells.supply).toEqual(again);
  });

  it('the network refresh is fast enough to run every 6 hours', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    refreshSupplyNetwork(s.world);
    // Fastest of 5: the code's cost, robust to a loaded machine descheduling one run (a mean of
    // 5 once read 60.3 ms under a parallel gate run; the refresh alone takes ~10 ms).
    let best = Infinity;
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      refreshSupplyNetwork(s.world);
      best = Math.min(best, performance.now() - t0);
    }
    expect(best).toBeLessThan(60);
  });
});

// PLAN 2.11j (the fifth independent read, finding 2). The network was said to be derived from
// the cities and the control of the cells, and a partial refresh to be a full one done cheaply.
// It was not, where a crossing lane is in play: a lane that a refreshed bloc no longer reaches
// stayed unclaimed though a neighbour reaches it, and a lane held by a higher bloc stayed with
// it though a lower one now reaches it. A load refreshes in full, so a loaded game went on
// otherwise than the game that was saved (I2).
describe('a partial refresh gives what a full one gives (PLAN 2.11j)', () => {
  /** The network a full refresh makes of the world as it is; the world's own layer is put back. */
  const differs = (a: Uint16Array, b: Uint16Array): number => {
    let n = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
    return n;
  };

  it('a lane that its bloc no longer reaches goes to the neighbour that does, though the neighbour is not refreshed', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    refreshSupplyNetwork(w);
    const { supply, controller, terrain } = w.cells;
    const bloc = (c: number): number => (controller[c] === 0 ? 0 : blocOf(w, controller[c]!));
    // A lane cell held by one bloc with land of another bloc beside it.
    let lane = -1;
    let other = 0;
    for (let c = W; c < W * (H - 1) && lane < 0; c++) {
      if (terrain[c] !== Terrain.Crossing || controller[c] !== 0 || supply[c] === 0) continue;
      for (const n of [c - 1, c + 1, c - W, c + W]) {
        const b = bloc(n);
        if (b !== 0 && b !== supply[c] && supply[n] === b && b > supply[c]!) {
          lane = c;
          other = b;
        }
      }
    }
    expect(lane).toBeGreaterThan(0);
    const holder = supply[lane]!;
    // The holder's land within 8 cells of the lane goes to a third nation, far from here: the
    // holder and that nation are refreshed, the neighbour is not.
    const third = nationId('BRA');
    expect(blocOf(w, third)).not.toBe(other);
    const [lx, ly] = [lane % W, Math.floor(lane / W)];
    let given = 0;
    for (let dy = -8; dy <= 8; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        const c = (ly + dy) * W + ((lx + dx + W) % W);
        if (controller[c] !== 0 && bloc(c) === holder) {
          w.setController(c, third);
          given++;
        }
      }
    }
    expect(given).toBeGreaterThan(0);
    expect(w.supplyDirty).toBe(false);
    expect([...w.supplyDirtyNations].map((n) => (n === 0 ? 0 : blocOf(w, n)))).not.toContain(other);
    refreshSupplyNetwork(w);
    // What the cell-by-cell rule makes of the whole world: the neighbour has the lane.
    const whole = referenceNetwork(w, w.cells.supply);
    expect(whole[lane]).toBe(other);
    expect(w.cells.supply[lane]).toBe(other);
    expect(differs(w.cells.supply, whole)).toBe(0);
  });

  it('the cells of a puppet that is annexed leave the network of its overlord at the next refresh', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    const [ALB, GRE, YUG] = [nationId('ALB'), nationId('GRE'), nationId('YUG')];
    // Albania a puppet of Greece: its cells are in Greece's network.
    w.nations.cols.overlord[ALB] = GRE;
    w.supplyDirty = true;
    refreshSupplyNetwork(w);
    const cells: number[] = [];
    for (let c = 0; c < W * H; c++) if (w.cells.controller[c] === ALB) cells.push(c);
    expect(cells.length).toBeGreaterThan(20);
    expect(cells.filter((c) => w.cells.supply[c] === GRE).length).toBeGreaterThan(20);
    // Annexed by Yugoslavia: its cells change hands, and it is no one's puppet any more. Greece
    // lost and won no cell, and Albania's bloc is now its own.
    for (const c of cells) {
      w.setController(c, YUG);
      w.setOwner(c, YUG);
    }
    w.nations.cols.overlord[ALB] = 0;
    expect(w.supplyDirty).toBe(false);
    expect(w.supplyDirtyNations.has(GRE)).toBe(false);
    refreshSupplyNetwork(w);
    expect(cells.filter((c) => w.cells.supply[c] === GRE)).toEqual([]);
    expect(cells.filter((c) => w.cells.supply[c] === blocOf(w, YUG)).length).toBeGreaterThan(20);
    expect(differs(w.cells.supply, referenceNetwork(w, w.cells.supply))).toBe(0);
  });
});

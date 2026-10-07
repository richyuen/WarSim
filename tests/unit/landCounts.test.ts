import { expect, it } from 'vitest';
import { landStandings } from '../../src/sim/landArea';
import { cellKm2ByRow, LandCounts } from '../../src/sim/landCounts';
import { cellOf } from '../../src/sim/data/terrain';
import { cellAreaByRow } from '../../src/sim/nav/grid';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// The land tallies kept by setOwner/setController (PLAN 1.42f) equal a fresh scan of the map
// after months of war, after editor edits and their undo, and after a load. They are km² (ADR-57),
// whole per cell, so "equal" is exact: a load rebuilds them by the scan.
const same = (world: World): void => {
  const kept = world.landCounts();
  const scan = LandCounts.scan(world.cells.owner, world.cells.controller, world.cells.w, world.cells.h);
  expect(kept.owned).toEqual(scan.owned);
  expect(kept.lost).toEqual(scan.lost);
  const sorted = (m: Map<number, number>): [number, number][] => [...m].sort((a, b) => a[0] - b[0]);
  expect(sorted(kept.occupied)).toEqual(sorted(scan.occupied));
  // The cells by province node and holder (PLAN 3.4Rl: which provinces a march may be planned
  // over), kept by setController, equal a count of the map.
  const count = new Map<number, number>();
  const nodeOf = navOf(world).graph.nodeOf;
  for (let i = 0; i < nodeOf.length; i++) if (nodeOf[i] !== 0) count.set(nodeOf[i]! * 65536 + world.cells.controller[i]!, (count.get(nodeOf[i]! * 65536 + world.cells.controller[i]!) ?? 0) + 1);
  expect(sorted(world.heldByNode())).toEqual(sorted(count));
};

it('a cell counts the whole km² of its row: within half a km² of the true area, never zero', () => {
  const { w, h } = SIZE_1938;
  const km2 = cellKm2ByRow(w, h);
  const exact = cellAreaByRow(w, h);
  for (let y = 0; y < h; y++) {
    expect(Number.isInteger(km2[y])).toBe(true);
    expect(Math.abs(km2[y]! - exact[y]!)).toBeLessThanOrEqual(0.5);
    expect(km2[y]!).toBeGreaterThan(20);
  }
});

it('the tallies are the owned areas of the 1938 start, to 0.1% per nation', () => {
  const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(SIZE_1938.w) });
  const land = landStandings(s.world);
  const kept = s.world.landCounts();
  // The Soviet Union by area, not by cells (it holds 26.8% of the owned cells).
  expect(kept.owned[nationId('SOV')]! / land.owned).toBeGreaterThan(0.155);
  expect(kept.owned[nationId('SOV')]! / land.owned).toBeLessThan(0.163);
  for (const n of land.ranked.slice(0, 40)) expect(Math.abs(kept.owned[n]! / land.area[n]! - 1)).toBeLessThan(0.001);
});

it('kept land tallies equal a scan through war, edits, undo and load', () => {
  const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(SIZE_1938.w) });
  s.world.landCounts();
  s.world.heldByNode();
  s.step(24 * 240);
  expect([...s.world.landCounts().occupied.values()].reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  same(s.world);
  // A Brazilian disc painted near Paris, then undone (the editor's own commands). Brazil, because
  // it holds nothing there whoever is winning the war: on day 240 of this seed Germany may
  // already occupy Paris, and a German disc would then change no controller.
  const [x, y] = cellOf(2.35, 48.85, SIZE_1938.w, SIZE_1938.h);
  const before = s.world.controlChanges;
  s.command({ kind: 'editPaint', layer: 'nation', tool: 'brush', x, y, x2: 0, y2: 0, r: 6, value: nationId('BRA'), mask: null });
  s.applyNow();
  expect(s.world.controlChanges).toBeGreaterThan(before);
  same(s.world);
  s.command({ kind: 'editUndo' });
  s.applyNow();
  same(s.world);
  const bytes = s.save();
  s.step(24 * 60);
  s.load(bytes);
  same(s.world);
  s.step(24 * 60);
  same(s.world);
}, 600_000);

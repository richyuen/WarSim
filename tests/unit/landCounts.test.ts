import { expect, it } from 'vitest';
import { LandCounts } from '../../src/sim/landCounts';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// The land tallies kept by setOwner/setController (PLAN 1.42f) equal a fresh scan of the map
// after months of war, after editor edits and their undo, and after a load.
const same = (world: World): void => {
  const kept = world.landCounts();
  const scan = LandCounts.scan(world.cells.owner, world.cells.controller);
  expect(kept.owned).toEqual(scan.owned);
  expect(kept.lost).toEqual(scan.lost);
  const sorted = (m: Map<number, number>): [number, number][] => [...m].sort((a, b) => a[0] - b[0]);
  expect(sorted(kept.occupied)).toEqual(sorted(scan.occupied));
};

it('kept land tallies equal a scan through war, edits, undo and load', () => {
  const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(SIZE_1938.w) });
  s.world.landCounts();
  s.step(24 * 240);
  expect([...s.world.landCounts().occupied.values()].reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  same(s.world);
  // A German disc painted near Paris, then undone (the editor's own commands).
  const [x, y] = cellOf(2.35, 48.85, SIZE_1938.w, SIZE_1938.h);
  const before = s.world.controlChanges;
  s.command({ kind: 'editPaint', layer: 'nation', tool: 'brush', x, y, x2: 0, y2: 0, r: 6, value: nationId('GER'), mask: null });
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

import { describe, expect, it } from 'vitest';
import earthMap from '../../data/maps/earth/map.json';
import { DEPLOY_RANGE_CELLS, SECTOR_CELLS } from '../../src/sim/ai/operational';
import { atWidth, DEFAULT_W, kmPerCell } from '../../src/sim/data/projection';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { AA_CELLS } from '../../src/sim/systems/airCombat';
import { BOMB_CELLS } from '../../src/sim/systems/bombing';
import { CONTACT_CELLS, DEPLOY_GAP } from '../../src/sim/systems/elements';
import { END_CELLS, MATCH_CELLS } from '../../src/sim/systems/majorBattles';
import { REPATRIATE_CELLS, TARGET_SNAP_CELLS } from '../../src/sim/systems/movement';
import { AT_PORT_CELLS } from '../../src/sim/systems/navalCombat';
import { RETREAT_CELLS, RETREAT_REACH } from '../../src/sim/systems/retreat';
import { GARRISON_CELLS, MILITIA_PER_CELLS, OVEREXT_CELLS } from '../../src/sim/systems/revolts';
import { KILL_CELLS_PER_STATE } from '../../src/sim/systems/revival';
import { SUPPLY_REACH } from '../../src/sim/systems/supply';
import { HOLD_TICKS, holdHours, PRESSURE_RADIUS } from '../../src/sim/systems/territory';
import { World } from '../../src/sim/world';

// PLAN 7.1b2 (ADR-416): the reaches the sim counted in cells are cells of the map's default size,
// `World.atSize` in a game's own. So a reach is the same km at S, M, L and XL, and at M (the
// 1938 world's size) the same cells as before, which the pin holds.

const REACHES: Record<string, number> = { OVEREXT_CELLS, SECTOR_CELLS, DEPLOY_RANGE_CELLS, REPATRIATE_CELLS, CONTACT_CELLS, DEPLOY_GAP, MATCH_CELLS, END_CELLS, TARGET_SNAP_CELLS, AT_PORT_CELLS, RETREAT_CELLS, RETREAT_REACH };
const WHOLE: Record<string, number> = { AA_CELLS, BOMB_CELLS, PRESSURE_RADIUS, SUPPLY_REACH, GARRISON_CELLS };

describe('reaches by the map size (PLAN 7.1b2)', () => {
  it('the data are given at the earth map\'s default size, and the 1938 world is at it', () => {
    expect(DEFAULT_W).toBe(earthMap.sizes.find((s) => s.id === earthMap.defaultSize)!.w);
    expect(SIZE_1938.scale).toBe(1);
    expect(new World(1, SIZE_1938.w, SIZE_1938.h, SIZE_1938.scale).sizeScale).toBe(1);
  });

  it('a reach is the same km at every size, and the same cells at M', () => {
    const km = (w: number, cells: number): number => cells * kmPerCell(w);
    for (const size of earthMap.sizes) {
      const world = new World(1, size.w, size.h, size.w / DEFAULT_W);
      for (const [name, cells] of Object.entries(REACHES)) {
        expect(km(size.w, world.atSize(cells)), `${name} at ${size.id}`).toBeCloseTo(km(DEFAULT_W, cells), 9);
        expect(world.atSize(cells), `${name} at ${size.id}, by the width`).toBe(atWidth(size.w, cells));
        if (size.w === DEFAULT_W) expect(world.atSize(cells), `${name} at M`).toBe(cells);
      }
    }
  });

  it('a radius walked cell by cell is whole: as many km as it can be, at least a cell, the same cells at M', () => {
    for (const size of earthMap.sizes) {
      const scale = size.w / DEFAULT_W;
      const world = new World(1, size.w, size.h, scale);
      for (const [name, cells] of Object.entries(WHOLE)) {
        const r = world.atSizeWhole(cells);
        expect(Number.isInteger(r), `${name} at ${size.id}`).toBe(true);
        expect(r, `${name} at ${size.id}`).toBeGreaterThanOrEqual(1);
        // Within half a cell of the km, unless held at one cell.
        if (r > 1) expect(Math.abs(r - cells * scale), `${name} at ${size.id}`).toBeLessThanOrEqual(0.5);
        if (scale >= 1) expect(r, `${name} at ${size.id}`).toBe(cells * scale);
      }
    }
  });
});

describe('areas by the map size (PLAN 7.1b3)', () => {
  it('an area of cells is the same km² at every size, and the same cells at M', () => {
    const km2 = (w: number, cells: number): number => cells * kmPerCell(w) * kmPerCell(w);
    for (const size of earthMap.sizes) {
      const world = new World(1, size.w, size.h, size.w / DEFAULT_W);
      for (const [name, cells] of Object.entries({ MILITIA_PER_CELLS, KILL_CELLS_PER_STATE })) {
        expect(km2(size.w, world.atSizeArea(cells)), `${name} at ${size.id}`).toBeCloseTo(km2(DEFAULT_W, cells), 6);
        if (size.w === DEFAULT_W) expect(world.atSizeArea(cells), `${name} at M`).toBe(cells);
      }
    }
  });
});

describe('territory by the map size (PLAN 7.1b4)', () => {
  it('a front moves as many km a day at every size: one cell a hold, the hold as many hours fewer as the cells are narrower', () => {
    const kmPerDay = (w: number, hold: number): number => (kmPerCell(w) * 24) / hold;
    const atM = kmPerDay(DEFAULT_W, HOLD_TICKS);
    for (const size of earthMap.sizes) {
      const world = new World(1, size.w, size.h, size.w / DEFAULT_W);
      const hold = holdHours(world);
      expect(Number.isInteger(hold) && hold >= 1, `${size.id}`).toBe(true);
      // Exact where the scale divides the hold (S, M, L); within the rounding of an hour at XL.
      if (HOLD_TICKS % world.sizeScale === 0 || world.sizeScale < 1) expect(kmPerDay(size.w, hold), `${size.id}`).toBeCloseTo(atM, 9);
      else expect(Math.abs(kmPerDay(size.w, hold) / atM - 1), `${size.id}: ${hold} h`).toBeLessThan(0.1);
      if (size.w === DEFAULT_W) expect(hold).toBe(HOLD_TICKS);
    }
  });
});

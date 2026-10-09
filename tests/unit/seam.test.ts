import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { Terrain } from '../../src/shared/terrain';
import { DEPLOY_RANGE_CELLS, MARCH_DAYS, SECTOR_CELLS, STAGGER, operationalAi } from '../../src/sim/ai/operational';
import { nearestCellWhere } from '../../src/sim/data/ownership';
import { importLayer } from '../../src/sim/editor';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { capitalsSystem } from '../../src/sim/systems/capitals';
import { combatSystem, findBattles } from '../../src/sim/systems/combat';
import { cellDist, destroyFormation } from '../../src/sim/systems/elements';
import { addCorridor, inCorridor } from '../../src/sim/systems/majorBattles';
import { TARGET_SNAP_CELLS, snapTarget } from '../../src/sim/systems/movement';
import { spawnPoint } from '../../src/sim/systems/production';
import { RETREAT_CELLS, RETREAT_HOURS, RETREAT_ORG, RETREAT_REACH, RETREAT_RETRY_HOURS, RETREAT_SNAP, retreatSystem } from '../../src/sim/systems/retreat';
import { SUPPLY_RATE, SUPPLY_REACH, blocOf, refreshSupplyNetwork, supplySystem } from '../../src/sim/systems/supply';
import { PRESSURE_RADIUS, frontierOf, territorySystem } from '../../src/sim/systems/territory';
import { navOf } from '../../src/sim/world';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 3.12Rs. Nothing of the sim joins the two edges of a map that does not loop
// (`settings.loopingMap` off, the new game's option): what measured from one place to another
// took the short way over the seam whatever the setting said. Each scene is asked both ways:
// on the map that loops the two edges are neighbours as before.

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const GER = nationId('GER');
const POL = nationId('POL');
/** A row of the made ground. */
const Y = Math.floor(H / 2);

/**
 * The 1938 world with no formation in it, Germany and Poland at war, and plains four cells deep
 * at each edge of the map, seven rows about `Y`.
 */
function edges(loop: boolean): World {
  const world = new Sim({ scenario: '1938', seed: 5, assets: assets1938(W) }).world;
  world.formations.ids().forEach((id) => destroyFormation(world, id));
  world.wars.set(GER, POL, true);
  for (let dy = -3; dy <= 3; dy++) for (const x of [0, 1, 2, 3, W - 4, W - 3, W - 2, W - 1]) world.cells.terrain[(Y + dy) * W + x] = Terrain.Plains;
  world.settings.loopingMap = loop;
  return world;
}

describe('nothing of the sim joins the two edges of a map that does not loop (PLAN 3.12Rs)', () => {
  describe('the measure of contact (3.12Rsa)', () => {
    it('two enemies at the two edges are a map apart and fire at nothing; on a map that loops they fight', () => {
      for (const loop of [false, true]) {
        const world = edges(loop);
        const a = addDivision(world, GER, 0.4, Y + 0.5);
        const b = addDivision(world, POL, W - 0.4, Y + 0.5);
        expect(cellDist(world, 0.4, Y + 0.5, W - 0.4, Y + 0.5)).toBeCloseTo(loop ? 0.8 : W - 0.8, 9);
        expect(findBattles(world).map((g) => [...g].sort((p, q) => p - q))).toEqual(loop ? [[a, b].sort((p, q) => p - q)] : []);
        combatSystem(world);
        expect([world.formations.cols.engaged[a], world.formations.cols.engaged[b]]).toEqual(loop ? [1, 1] : [0, 0]);
        expect(world.out.fires.length > 0).toBe(loop);
      }
    });

    it('a breakthrough corridor at one edge does not go on at the other', () => {
      for (const loop of [false, true]) {
        const world = edges(loop);
        // From the first column westwards: over the seam where there is one.
        addCorridor(world, GER, 0.5, Y + 0.5, -1, 0);
        expect(inCorridor(world, GER, Y * W)).toBe(true);
        expect(inCorridor(world, GER, Y * W + W - 2)).toBe(loop);
      }
    });
  });

  describe('the reach of supplySystem (3.12Rsb)', () => {
    /**
     * A German division on Polish-held ground in the first column, and Germany's network in the
     * cells of column `x`, five rows about `Y`. Whether the hour fed it.
     */
    function fedFrom(loop: boolean, x: number): boolean {
      const world = edges(loop);
      // The refresh the system would run in this hour, before the network is made by hand.
      refreshSupplyNetwork(world);
      world.tick = 1;
      const { supply, controller } = world.cells;
      const net = blocOf(world, GER);
      // Nothing of the 1938 world feeds it from either side.
      for (let dy = -SUPPLY_REACH; dy <= SUPPLY_REACH; dy++) {
        for (const cx of [0, 1, 2, 3, W - 4, W - 3, W - 2, W - 1]) supply[(Y + dy) * W + cx] = 0;
      }
      controller[Y * W] = POL;
      for (let dy = -SUPPLY_REACH; dy <= SUPPLY_REACH; dy++) supply[(Y + dy) * W + x] = net;
      const id = addDivision(world, GER, 0.4, Y + 0.5);
      world.formations.cols.supply[id] = 0.5;
      supplySystem(world);
      // The network is as it was made: no refresh took it away.
      expect(supply[Y * W + x]).toBe(net);
      expect(supply[Y * W]).toBe(0);
      const s = world.formations.cols.supply[id]!;
      expect([0.5 - SUPPLY_RATE, 0.5 + SUPPLY_RATE]).toContain(s);
      return s > 0.5;
    }

    it("a formation on ground not its side's in the first column is not fed by a network in the last; on a map that loops it is", () => {
      for (const loop of [false, true]) {
        expect(fedFrom(loop, W - 1)).toBe(loop);
        expect(fedFrom(loop, W - SUPPLY_REACH)).toBe(loop);
        // Beyond the reach over the seam, and within it on the formation's own side.
        expect(fedFrom(loop, W - SUPPLY_REACH - 1)).toBe(false);
        expect(fedFrom(loop, SUPPLY_REACH)).toBe(true);
        expect(fedFrom(loop, SUPPLY_REACH + 1)).toBe(false);
      }
    });
  });

  describe('the pressure of territorySystem (3.12Rsc)', () => {
    /**
     * A Polish cell in column `cell` of row `Y` with a German cell beside it in column `beside`
     * (the connectivity rule is met on the cell's own side of the seam), and one German division
     * in column `at`. The cell's hold progress after one hour: 1 where the division presses on it.
     */
    function pressed(loop: boolean, at: number, cell: number, beside: number): number {
      const world = edges(loop);
      const { controller, flip } = world.cells;
      for (let dy = -3; dy <= 3; dy++) for (const x of [0, 1, 2, 3, W - 4, W - 3, W - 2, W - 1]) controller[(Y + dy) * W + x] = GER;
      controller[Y * W + cell] = POL;
      addDivision(world, GER, at + 0.4, Y + 0.5);
      territorySystem(world);
      // The cell can be taken whatever the map: a German cell is beside it on its own side.
      expect(controller[Y * W + beside]).toBe(GER);
      expect(frontierOf(world).has(Y * W + cell)).toBe(true);
      return flip[Y * W + cell]!;
    }

    it('a formation in the first column presses on no frontier cell of the last, nor one in the last on a cell of the first; on a map that loops they do', () => {
      for (const loop of [false, true]) {
        expect(pressed(loop, 0, W - 1, W - 2)).toBe(loop ? 1 : 0);
        expect(pressed(loop, 0, W - PRESSURE_RADIUS, W - PRESSURE_RADIUS - 1)).toBe(loop ? 1 : 0);
        expect(pressed(loop, W - 1, 0, 1)).toBe(loop ? 1 : 0);
        expect(pressed(loop, W - 1, PRESSURE_RADIUS - 1, PRESSURE_RADIUS)).toBe(loop ? 1 : 0);
        // Beyond the radius over the seam, and within it on the formation's own side.
        expect(pressed(loop, 0, W - PRESSURE_RADIUS - 1, W - PRESSURE_RADIUS - 2)).toBe(0);
        expect(pressed(loop, 0, PRESSURE_RADIUS, PRESSURE_RADIUS + 1)).toBe(1);
        expect(pressed(loop, 0, PRESSURE_RADIUS + 1, PRESSURE_RADIUS)).toBe(0);
      }
    });
  });

  describe('the distances of the operational AI (3.12Rsd)', () => {
    /** The cells of German ground west of the last column that the scenes below are made on. */
    const STRIP = 110;
    /**
     * The Polish cell of the front at the last columns, and the two a German plan sends to: the
     * enemy's, and the front cell it holds. A row below `Y`: the four German cells about it are
     * of one sector.
     */
    const FOE = (Y + 1) * W + W - 2;
    const HOLD = FOE - W;
    /**
     * `edges`, with the ground German: the four columns at the first edge and `STRIP` at the last,
     * one landmass where the map loops and two where it does not. One Polish cell in the last
     * columns but one: Germany's front there is one sector, on its own side of the seam.
     */
    function front(loop: boolean): World {
      expect(Y % SECTOR_CELLS).toBe(0);
      const world = edges(loop);
      const { terrain, controller } = world.cells;
      for (let dy = -3; dy <= 3; dy++) {
        for (let x = -STRIP; x < 4; x++) {
          const c = (Y + dy) * W + ((x + W) % W);
          terrain[c] = Terrain.Plains;
          controller[c] = GER;
        }
      }
      controller[FOE] = POL;
      // The ground is made, and the map loops or not: the routes are of this ground.
      world.nav = null;
      return world;
    }
    /** Germany's plan on a day when formation `idle` (if any) is one that a far front may take. */
    function plan(world: World, idle = -1): void {
      const day = idle < 0 ? 0 : (MARCH_DAYS - (idle % MARCH_DAYS)) % MARCH_DAYS;
      world.tick = 24 * day + 6 * ((2 * STAGGER - (GER % STAGGER)) % STAGGER);
      expect((world.tick / 6 + GER) % STAGGER).toBe(0);
      operationalAi(world);
      // No order was refused (an event is six numbers, its kind the second).
      expect(world.out.events.filter((e, i) => i % 6 === 1 && e === EventKind.MoveRejected)).toEqual([]);
    }
    /** Where the formation is ordered to: a cell, or -1 for no order. */
    const sentTo = (world: World, id: number): number => (world.formations.cols.moving[id] === 1 ? world.formations.cols.targetCell[id]! : -1);

    it('a formation at one edge is in range of no sector at the other and is sent to none; on a map that loops it is', () => {
      expect(W - 4).toBeGreaterThan(DEPLOY_RANGE_CELLS);
      for (const loop of [false, true]) {
        const world = front(loop);
        const id = addDivision(world, GER, 0.4, Y + 0.5);
        plan(world);
        expect(sentTo(world, id)).toBe(loop ? FOE : -1);
        // On the front's own side of the seam it is sent both ways.
        const near = front(loop);
        const there = addDivision(near, GER, W - 9.6, Y + 0.5);
        plan(near);
        expect(sentTo(near, there)).toBe(FOE);
      }
    });

    it("an enemy at one edge is no threat to a sector at the other: the sector's formation attacks; on a map that loops it holds", () => {
      for (const loop of [false, true]) {
        const world = front(loop);
        const id = addDivision(world, GER, W - 9.6, Y + 0.5);
        // In the first sector bucket of the row, the one beside the last over the seam.
        addDivision(world, POL, SECTOR_CELLS - 0.6, Y + 0.5);
        plan(world);
        expect(sentTo(world, id)).toBe(loop ? HOLD : FOE);
      }
    });

    it('a march to a cell at one edge is not a march to the front at the other: it is given the order; on a map that loops it is kept', () => {
      for (const loop of [false, true]) {
        const world = front(loop);
        const id = addDivision(world, GER, W - 9.6, Y + 0.5);
        const f = world.formations.cols;
        // On the march to the first column, two columns from the enemy's cell over the seam.
        f.moving[id] = 1;
        f.targetCell[id] = Y * W;
        plan(world);
        expect(sentTo(world, id)).toBe(loop ? Y * W : FOE);
      }
    });

    it('a formation that stands at one edge does not man a sector at the other: the sector takes one from afar; on a map that loops it is manned', () => {
      for (const loop of [false, true]) {
        const world = front(loop);
        const stands = addDivision(world, GER, 0.4, Y + 0.5);
        // Beyond the range of the front, on its landmass.
        const far = addDivision(world, GER, W - STRIP + 10.5, Y + 0.5);
        expect(STRIP - 12).toBeGreaterThan(DEPLOY_RANGE_CELLS + SECTOR_CELLS);
        plan(world, far);
        expect(sentTo(world, far)).toBe(loop ? -1 : HOLD);
        expect(sentTo(world, stands)).toBe(loop ? FOE : -1);
      }
    });

    it('a formation on the march to the other edge is on an errand, and another is the one to spare; on a map that loops it is the one', () => {
      /** A second Polish cell, beyond the range of the formations at the first front and within three ranges. */
      const second = (Y + 1) * W + W - STRIP + 8;
      for (const loop of [false, true]) {
        const world = front(loop);
        world.cells.controller[second] = POL;
        const nearer = addDivision(world, GER, W - 6.6, Y + 0.5);
        const farther = addDivision(world, GER, W - 12.6, Y + 0.5);
        const f = world.formations.cols;
        // On the march to the first edge: 16 cells over the seam, a map's width without it.
        f.moving[farther] = 1;
        f.targetCell[farther] = Y * W + 3;
        // The nation's day in `MARCH_DAYS`: what the front can spare is asked.
        world.tick = 24 * ((MARCH_DAYS - (GER % MARCH_DAYS)) % MARCH_DAYS) - 6 * (GER % STAGGER) + 6 * STAGGER;
        expect((world.tick / 6 + GER) % STAGGER).toBe(0);
        expect((Math.floor(world.tick / 24) + GER) % MARCH_DAYS).toBe(0);
        operationalAi(world);
        const far = (id: number): boolean => Math.abs((sentTo(world, id) % W) - (second % W)) <= 1 && sentTo(world, id) >= 0;
        expect([far(nearer), far(farther)]).toEqual(loop ? [false, true] : [true, false]);
      }
    });
  });

  describe('the nearest cell (3.12Rse1)', () => {
    it('the search does not look over an edge of a map that does not loop; on a map that loops it does', () => {
      const last = (c: number): boolean => c === Y * W + W - 1;
      const first = (c: number): boolean => c === Y * W;
      for (const loop of [false, true]) {
        expect(nearestCellWhere(last, 0.5, Y + 0.5, W, H, 3, loop)).toBe(loop ? Y * W + W - 1 : -1);
        expect(nearestCellWhere(first, W - 0.5, Y + 0.5, W, H, 3, loop)).toBe(loop ? Y * W : -1);
        // A point beyond an edge (a retreat's, three cells behind a formation in the first column).
        expect(nearestCellWhere(last, -2.6, Y + 0.5, W, H, 3, loop)).toBe(loop ? Y * W + W - 1 : -1);
        expect(nearestCellWhere(first, -2.6, Y + 0.5, W, H, 3, loop)).toBe(Y * W);
        // On the point's own side of the seam, both ways.
        expect(nearestCellWhere((c) => c === Y * W + 3, 0.5, Y + 0.5, W, H, 3, loop)).toBe(Y * W + 3);
      }
    });

    it("an order to a cell of another landmass at one edge is not snapped to the formation's own at the other", () => {
      for (const loop of [false, true]) {
        const world = edges(loop);
        world.nav = null;
        const comp = navOf(world).grid.component;
        // The two strips are one landmass where the map loops.
        expect(comp[Y * W] === comp[Y * W + W - 1]).toBe(loop);
        expect(TARGET_SNAP_CELLS).toBeGreaterThanOrEqual(1);
        expect(snapTarget(world, Y * W + W - 1, 0, Y)).toBe(loop ? Y * W : -1);
        expect(snapTarget(world, Y * W, W - 1, Y)).toBe(loop ? Y * W + W - 1 : -1);
      }
    });

    it("a capital in the field moves to the nation's nearest cell on its side of the seam", () => {
      for (const loop of [false, true]) {
        const world = edges(loop);
        const cc = world.cities.cols;
        const nc = world.nations.cols;
        world.cities.forEach((city) => {
          if (cc.capitalOf[city] === GER) cc.capitalOf[city] = 0;
        });
        // In the field, in the first column, on a cell that is not Germany's.
        nc.capitalX[GER] = 0.5;
        nc.capitalY[GER] = Y + 0.5;
        expect(world.cells.controller[Y * W]).not.toBe(GER);
        world.cells.controller[Y * W + W - 1] = GER;
        world.cells.controller[Y * W + 3] = GER;
        capitalsSystem(world);
        expect([nc.capitalX[GER], nc.capitalY[GER]]).toEqual([loop ? W - 0.5 : 3.5, Y + 0.5]);
      }
    });

    it("a new formation appears on the nation's cell nearest its capital on the capital's side of the seam", () => {
      for (const loop of [false, true]) {
        const world = edges(loop);
        const nc = world.nations.cols;
        nc.capitalX[GER] = 0.5;
        nc.capitalY[GER] = Y + 0.5;
        world.cells.controller[Y * W + W - 1] = GER;
        world.cells.controller[Y * W + 3] = GER;
        expect(spawnPoint(world, GER)!.map(Math.floor)).toEqual([loop ? W - 1 : 3, Y]);
      }
    });

    it('a formation left on water by an import of terrain goes to the nearest land on its side of the seam', () => {
      for (const loop of [false, true]) {
        const world = edges(loop);
        const id = addDivision(world, GER, 0.4, Y + 0.5);
        const values = Uint16Array.from(world.cells.terrain);
        // The first three columns go under: land is a cell away over the seam, three on this side.
        for (let dy = -3; dy <= 3; dy++) for (const x of [0, 1, 2]) values[(Y + dy) * W + x] = Terrain.Water;
        expect(importLayer(world, 'terrain', values)).toBe(21);
        const f = world.formations.cols;
        expect([Math.floor(f.x[id]!), Math.floor(f.y[id]!)]).toEqual([loop ? W - 1 : 3, Y]);
      }
    });

    it('a retreat from the first column falls back to no cell of the last; on a map that loops it does', () => {
      for (const loop of [false, true]) {
        const world = edges(loop);
        const { terrain, controller } = world.cells;
        // One landmass the width of the map, both ways: the cells of the last columns are of the
        // formation's own, and a route to them goes the long way round where the map has edges.
        for (let dy = -3; dy <= 3; dy++) for (let x = 0; x < W; x++) terrain[(Y + dy) * W + x] = Terrain.Plains;
        for (let dy = -3; dy <= 3; dy++) for (const x of [0, 1, 2, 3, W - 6, W - 5, W - 4, W - 3, W - 2, W - 1]) controller[(Y + dy) * W + x] = GER;
        world.nav = null;
        const id = addDivision(world, GER, 0.4, Y + 0.5);
        addDivision(world, POL, 1.6, Y + 0.5);
        const f = world.formations.cols;
        f.engaged[id] = 1;
        f.org[id] = RETREAT_ORG / 2;
        world.tick = (RETREAT_RETRY_HOURS - (id % RETREAT_RETRY_HOURS)) % RETREAT_RETRY_HOURS;
        retreatSystem(world);
        expect(f.retreat[id]).toBe(RETREAT_HOURS);
        expect(f.moving[id]).toBe(1);
        const x = f.targetCell[id]! % W;
        // Looping: the cell nearest the point `RETREAT_CELLS` behind it, over the seam. With
        // edges: no cell is about that point, and it goes to the nearest of its own about itself.
        if (loop) expect(x).toBeGreaterThanOrEqual(W - Math.ceil(RETREAT_CELLS) - RETREAT_SNAP);
        else expect(x).toBeLessThanOrEqual(RETREAT_REACH);
      }
    });
  });
});

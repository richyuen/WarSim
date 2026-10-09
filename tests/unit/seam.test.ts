import { describe, expect, it } from 'vitest';
import { Terrain } from '../../src/shared/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { combatSystem, findBattles } from '../../src/sim/systems/combat';
import { cellDist, destroyFormation } from '../../src/sim/systems/elements';
import { addCorridor, inCorridor } from '../../src/sim/systems/majorBattles';
import { SUPPLY_RATE, SUPPLY_REACH, blocOf, refreshSupplyNetwork, supplySystem } from '../../src/sim/systems/supply';
import { PRESSURE_RADIUS, frontierOf, territorySystem } from '../../src/sim/systems/territory';
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
});

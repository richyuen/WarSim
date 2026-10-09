import { describe, expect, it } from 'vitest';
import { Terrain } from '../../src/shared/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { combatSystem, findBattles } from '../../src/sim/systems/combat';
import { cellDist, destroyFormation } from '../../src/sim/systems/elements';
import { addCorridor, inCorridor } from '../../src/sim/systems/majorBattles';
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
});

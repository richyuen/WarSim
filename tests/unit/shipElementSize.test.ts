import { describe, expect, it } from 'vitest';
import { Frame, isShipFrame } from '../../src/shared/unitLooks';
import { shipHullShare } from '../../src/render/units/atlas';
import { SHIP_ELEMENT_MIN_HULL_PX, SHIP_FRAME_MIN_PX, shipElementMinPx } from '../../src/render/units/ships';

// PLAN 7.132 (critic run 15, naval 7: "a sea battle at 15–150 m/px is a few small hulls far apart"): at
// T2 a ship was an element sprite of 0.026 cells, at least 5 px, like any other; at a sea battle row's
// 47–69 m/px its hull was 5–8 px. Now every ship's hull is at least SHIP_ELEMENT_MIN_HULL_PX there.

const ELEMENT_CELLS = 0.026; // `MapView`'s element sprite
const ELEMENT_MIN_PX = 5;
const KM = 19.57; // a cell of the 1938 map at M, at the equator
const SHIPS = [Frame.battleship, Frame.carrier, Frame.ship, Frame.transport, Frame.destroyer, Frame.submarine];

/** A ship's hull on the screen at T2 at `m` metres a pixel, as the shader draws its element sprite. */
const hullAt = (frame: number, m: number): number => Math.max((ELEMENT_CELLS * KM * 1000) / m, ELEMENT_MIN_PX, shipElementMinPx(frame)) * shipHullShare(frame);

describe("a ship's hull at T2 (PLAN 7.132)", () => {
  it('every class at least 12 px from stern to bow at the rows of the critic and of 3613, and further out', () => {
    for (const f of SHIPS) for (const m of [31, 46.8, 58.9, 69.1, 150, 250]) expect(hullAt(f, m), `frame ${f} at ${m} m/px`).toBeGreaterThanOrEqual(12);
  });
  it('the same hull for every class at the least size: no class longer than it must be', () => {
    for (const f of SHIPS) expect(shipElementMinPx(f) * shipHullShare(f)).toBeCloseTo(SHIP_ELEMENT_MIN_HULL_PX, 9);
  });
  it("under T3's least size, which laid a fleet's ships over each other at T2", () => {
    for (const f of SHIPS) expect(shipElementMinPx(f)).toBeLessThan(SHIP_FRAME_MIN_PX[f]!);
  });
  it('what is no ship has no least size of a ship', () => {
    for (const f of [Frame.infantry, Frame.tank, Frame.gun, Frame.wake]) {
      expect(isShipFrame(f)).toBe(false);
      expect(shipElementMinPx(f)).toBe(0);
    }
  });
});

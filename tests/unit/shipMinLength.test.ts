import { describe, expect, it } from 'vitest';
import { ATLAS_FRAMES } from '../../src/render/units/atlas';
import { battleshipMinPx, SHIP_FRAME_MIN_PX, SHIP_MIN_PX, SHIP_ROOM_MAX_PX, shipFrameMinPx, shipMinShare, shipSideCells, SLOT_GAP_CELLS } from '../../src/render/units/ships';
import { SLOT_SPACING } from '../../src/sim/core/pose';
import { Frame, isShipFrame } from '../../src/shared/unitLooks';

// PLAN 4.12c (the critic's R5-B4): at 20 m/px a carrier group was seven small pills. A ship is
// drawn at least SHIP_MIN_PX long for a battleship, the others in proportion to their length.

const KM_PER_CELL = 19.57;

describe('a ship\'s least length on the screen (PLAN 4.12c)', () => {
  it('a ship\'s frame has one, at least in proportion to its length (PLAN 7.35c: its class\'s share where more), and no other frame has', () => {
    expect(SHIP_FRAME_MIN_PX.length).toBe(ATLAS_FRAMES);
    for (let f = 0; f < ATLAS_FRAMES; f++) {
      if (!isShipFrame(f)) {
        expect(SHIP_FRAME_MIN_PX[f], `frame ${f}`).toBe(0);
        continue;
      }
      expect(SHIP_FRAME_MIN_PX[f]! / SHIP_MIN_PX).toBeCloseTo(shipMinShare(f), 9);
      expect(shipMinShare(f) + 1e-12).toBeGreaterThanOrEqual(shipSideCells(f, KM_PER_CELL) / shipSideCells(Frame.battleship, KM_PER_CELL));
    }
    // The battleship and the carrier as their lengths have them.
    expect(shipMinShare(Frame.battleship)).toBe(1);
    expect(shipMinShare(Frame.carrier)).toBeCloseTo(260 / 250, 9);
  });

  // PLAN 7.35c (critic run 9, naval 6: "at 20 m/px destroyers are about 10 × 3 px and submarines
  // about 5 px"): the smaller classes at their class's share of a battleship's, in their order.
  it('the smaller classes are drawn at their share of a battleship, in the order of their lengths (PLAN 7.35c)', () => {
    expect(shipMinShare(Frame.ship)).toBeCloseTo(0.88, 9);
    expect(shipMinShare(Frame.transport)).toBeCloseTo(0.85, 9);
    expect(shipMinShare(Frame.destroyer)).toBeCloseTo(0.8, 9);
    expect(shipMinShare(Frame.submarine)).toBeCloseTo(0.65, 9);
    const order = [Frame.submarine, Frame.destroyer, Frame.transport, Frame.ship, Frame.battleship, Frame.carrier];
    for (let k = 1; k < order.length; k++) expect(SHIP_FRAME_MIN_PX[order[k]!]!, `frame ${order[k]}`).toBeGreaterThan(SHIP_FRAME_MIN_PX[order[k - 1]!]!);
    // At 20 m/px a destroyer's sprite is about 21 px (15.8 before), a submarine's about 17 (10).
    const at20 = shipFrameMinPx((SLOT_GAP_CELLS * KM_PER_CELL * 1000) / 20);
    expect(at20[Frame.destroyer]!).toBeGreaterThan(20.5);
    expect(at20[Frame.submarine]!).toBeGreaterThan(16.5);
  });

  it('at 20 m/px a ship is drawn twice its length or more, and less than a slot apart from the next', () => {
    const pxPerCell = (KM_PER_CELL * 1000) / 20;
    for (const f of [Frame.battleship, Frame.carrier, Frame.ship, Frame.destroyer, Frame.submarine, Frame.transport]) {
      const own = shipSideCells(f, KM_PER_CELL) * pxPerCell;
      expect(SHIP_FRAME_MIN_PX[f]!, `frame ${f}`).toBeGreaterThan(2 * own);
    }
    expect(Math.max(...SHIP_FRAME_MIN_PX)).toBeLessThan(SLOT_SPACING * pxPerCell);
  });
});

// PLAN 7.22b (critic run 8, naval 6: "at 1× a ship is about 20 to 30 px long at 15 m/px"): closer
// in, the least length grows with the gap between two slots on the screen, up to SHIP_ROOM_MAX_PX.
describe("a ship's least length grows with the room between ships (PLAN 7.22b)", () => {
  const slotPxAt = (m: number): number => (SLOT_GAP_CELLS * KM_PER_CELL * 1000) / m;
  const bbAt = (m: number): number => shipFrameMinPx(slotPxAt(m))[Frame.battleship]!;

  it("the render's slot gap is the sim's", () => {
    expect(SLOT_GAP_CELLS).toBe(SLOT_SPACING);
  });

  it('from 30 to 20.4 m/px it is what it was; 26.4 px at 20 m/px; 35 px at 15 m/px; 40 px from about 13 m/px in', () => {
    for (const m of [30, 25, 20.4]) expect(shipFrameMinPx(slotPxAt(m))).toEqual(SHIP_FRAME_MIN_PX);
    expect(bbAt(20)).toBeCloseTo(26.4, 1);
    expect(bbAt(15)).toBeCloseTo(35.2, 1);
    expect(bbAt(13)).toBe(SHIP_ROOM_MAX_PX);
    expect(bbAt(5)).toBe(SHIP_ROOM_MAX_PX);
    // Never less than before, at any gap.
    for (let px = 0; px < 200; px += 0.5) expect(battleshipMinPx(px)).toBeGreaterThanOrEqual(SHIP_MIN_PX);
  });

  it('from 20 m/px in, every ship is shorter than the gap to the next slot, and the classes keep their shares (PLAN 7.35c)', () => {
    for (let m = 20; m >= 1; m -= 0.25) {
      const floors = shipFrameMinPx(slotPxAt(m));
      expect(Math.max(...floors), `${m} m/px`).toBeLessThan(slotPxAt(m));
      for (let f = 0; f < ATLAS_FRAMES; f++) {
        if (!isShipFrame(f)) expect(floors[f]).toBe(0);
        else expect(floors[f]! / floors[Frame.battleship]!).toBeCloseTo(shipMinShare(f), 9);
      }
    }
  });

  it('every class is drawn its own length, in true proportion, from 3.5 m/px in (PLAN 7.35c)', () => {
    // The least size gives way to the own length a class at a time (a battleship at 6.25 m/px, a submarine at 3.65).
    const pxPerCell = (m: number): number => (KM_PER_CELL * 1000) / m;
    for (const f of [Frame.battleship, Frame.carrier, Frame.ship, Frame.destroyer, Frame.submarine, Frame.transport]) {
      expect(shipSideCells(f, KM_PER_CELL) * pxPerCell(3.5), `frame ${f}`).toBeGreaterThan(shipFrameMinPx(slotPxAt(3.5))[f]!);
    }
  });

  it('a battleship is drawn its own length from 6.25 m/px in', () => {
    const own = (m: number): number => shipSideCells(Frame.battleship, KM_PER_CELL) * ((KM_PER_CELL * 1000) / m);
    expect(own(6.25)).toBeCloseTo(bbAt(6.25), 6);
    expect(own(6)).toBeGreaterThan(bbAt(6));
    expect(own(7)).toBeLessThan(bbAt(7));
  });
});

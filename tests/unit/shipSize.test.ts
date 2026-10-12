import { describe, expect, it } from 'vitest';
import { Frame } from '../../src/shared/unitLooks';
import { shipSideCells } from '../../src/render/units/ships';

// PLAN 4.7b (ADR-276): a ship at T3 is drawn its own length, not a battalion grid's place.

describe('a ship\'s length at T3 (PLAN 4.7b)', () => {
  const km = 19.53; // a cell of the 1938 map at M, at the equator
  it('each class its length in cells: a battleship 250 m, a destroyer 150, a submarine 95', () => {
    expect(shipSideCells(Frame.battleship, km)).toBeCloseTo(0.25 / km, 12);
    expect(shipSideCells(Frame.destroyer, km)).toBeCloseTo(0.15 / km, 12);
    expect(shipSideCells(Frame.submarine, km)).toBeCloseTo(0.095 / km, 12);
    const order = [Frame.carrier, Frame.battleship, Frame.ship, Frame.transport, Frame.destroyer, Frame.submarine].map((f) => shipSideCells(f, km));
    expect([...order].sort((a, b) => b - a)).toEqual(order);
  });
  it('what is no ship has no ship\'s length; a coarser map, a smaller share of a cell', () => {
    for (const f of [Frame.infantry, Frame.tank, Frame.gun]) expect(shipSideCells(f, km)).toBe(0);
    expect(shipSideCells(Frame.battleship, 2 * km)).toBeCloseTo(shipSideCells(Frame.battleship, km) / 2, 12);
  });
});

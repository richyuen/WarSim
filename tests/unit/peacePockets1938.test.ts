import { describe, expect, it } from 'vitest';
import { Terrain } from '../../src/shared/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { capitalCell } from '../../src/sim/systems/capitals';
import { declareWar, makePeace } from '../../src/sim/systems/war';
import { ATTACKERS, type War } from '../../src/sim/wars';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.80b (the user's ADR-639 a; ADR-644): at a decisive peace, a small piece of one side's land
// left wholly inside the other side's goes with the land round it. Until then the treaty kept the
// occupation's pattern cell by cell, and the late map was cut into enclaves at peace (R12-B2).

const GER = nationId('GER');
const POL = nationId('POL');

/** Germany at war with Poland alone; the Polish cells, Warsaw's cell, and a pocket's centre. */
function setup(): { w: World; polish: number[]; cap: number; q: number } {
  const w = new Sim({ scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) }).world;
  expect(declareWar(w, GER, POL, true)).not.toBeNull();
  const { owner, terrain } = w.cells;
  const W = w.cells.w;
  const polish: number[] = [];
  owner.forEach((o, c) => {
    if (o === POL) polish.push(c);
  });
  const cap = capitalCell(w, POL);
  expect(owner[cap]).toBe(POL);
  // The pocket's centre: the Polish cell farthest from Warsaw whose 7 × 7 box is Polish land.
  let q = -1;
  let far = 0;
  for (const c of polish) {
    let inside = true;
    for (let dy = -3; dy <= 3 && inside; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const n = c + dy * W + dx;
        if (owner[n] !== POL || terrain[n] === Terrain.Water) inside = false;
      }
    const d = cheb(W, c, cap);
    if (inside && d > far) [q, far] = [c, d];
  }
  expect(far).toBeGreaterThanOrEqual(25);
  return { w, polish, cap, q };
}

const cheb = (W: number, a: number, b: number): number => Math.max(Math.abs((a % W) - (b % W)), Math.abs(Math.floor(a / W) - Math.floor(b / W)));

function warOf(w: World, winner: number, by: number): War {
  const war = w.wars.list.find((x) => x.sides.flat().includes(GER) && x.sides.flat().includes(POL))!;
  expect(war).toBeDefined();
  war.score = war.sides[ATTACKERS].includes(winner) ? by : -by;
  return war;
}

describe('the settlement\'s pockets go with the land round them (PLAN 7.80b)', () => {
  it('a Polish pocket left inside the land Germany takes goes to Germany; Warsaw\'s land stays', () => {
    const { w, polish, cap, q } = setup();
    const W = w.cells.w;
    const pocket = polish.filter((c) => cheb(W, c, q) <= 1);
    const kept = polish.filter((c) => cheb(W, c, cap) <= 15);
    expect(pocket).toHaveLength(9);
    for (const c of polish) if (cheb(W, c, q) > 1 && cheb(W, c, cap) > 15) w.setController(c, GER);
    makePeace(w, warOf(w, GER, 50));
    expect(w.nations.cols.living[POL]).toBe(1);
    expect(pocket.filter((c) => w.cells.owner[c] === GER && w.cells.controller[c] === GER)).toHaveLength(9);
    expect(kept.filter((c) => w.cells.owner[c] !== POL)).toHaveLength(0);
  });

  it('a lone conquest inside Poland goes back to Poland', () => {
    const { w, polish, q } = setup();
    const W = w.cells.w;
    const block = polish.filter((c) => cheb(W, c, q) <= 1);
    for (const c of block) w.setController(c, GER);
    makePeace(w, warOf(w, GER, 50));
    expect(block.filter((c) => w.cells.owner[c] === POL && w.cells.controller[c] === POL)).toHaveLength(9);
  });

  it('a ring won round a Polish pocket is kept, and the pocket goes with it (no swap)', () => {
    const { w, polish, q } = setup();
    const W = w.cells.w;
    const ring = polish.filter((c) => cheb(W, c, q) === 2);
    const inner = polish.filter((c) => cheb(W, c, q) <= 1);
    expect(ring).toHaveLength(16);
    for (const c of ring) w.setController(c, GER);
    makePeace(w, warOf(w, GER, 50));
    // Each is the other's pocket: handed over at once, the ring went back and the centre to Germany.
    expect([...ring, ...inner].filter((c) => w.cells.owner[c] !== GER)).toHaveLength(0);
  });

  it('a white peace hands nothing over', () => {
    const { w, polish, cap, q } = setup();
    const W = w.cells.w;
    for (const c of polish) if (cheb(W, c, q) > 1 && cheb(W, c, cap) > 15) w.setController(c, GER);
    makePeace(w, warOf(w, GER, 0));
    expect(polish.filter((c) => w.cells.owner[c] !== POL || w.cells.controller[c] !== POL)).toHaveLength(0);
  });
});

import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SECTOR_CELLS } from '../../src/sim/ai/operational';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import { neighbours4 } from '../../src/sim/nav/grid';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId, runEvents } from '../helpers/sim1938';

// PLAN 1.25 operational AI v1. AT: in a scripted 2-nation war the larger nation advances;
// formations are spread along the front (coverage metric).

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const [GER, POL] = ['GER', 'POL'].map(nationId) as [number, number];

/** GER vs POL alone: no alliances or guarantees, every other AI off, no new declarations. */
function duel(): Sim {
  const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  const w = s.world;
  for (const n of [GER, POL]) {
    w.alliances.leave(n);
    w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
  }
  w.nations.forEach((n) => {
    if (n !== GER && n !== POL) w.nations.cols.aiOff[n] = 1;
  });
  w.nations.cols.aggression[GER] = 0; // operational AI only: no new wars
  w.nations.cols.aggression[POL] = 0;
  s.command({ kind: 'declareWar', attacker: GER, defender: POL });
  return s;
}

/** Share of `n`'s front sectors with one of its formations within 2 sectors of the centre. */
function coverage(w: World, n: number): number {
  const { w: mw, h, controller } = w.cells;
  const nb: number[] = [];
  const bw = Math.ceil(mw / SECTOR_CELLS);
  const sectors = new Map<number, [number, number, number]>();
  for (const c of frontierOf(w)) {
    if (controller[c] !== n) continue;
    if (!neighbours4(c, mw, h, true, nb).some((k) => controller[k] !== 0 && w.wars.atWar(n, controller[k]!))) continue;
    const x = c % mw;
    const y = (c - x) / mw;
    const key = Math.floor(y / SECTOR_CELLS) * bw + Math.floor(x / SECTOR_CELLS);
    const s = sectors.get(key) ?? [0, 0, 0];
    sectors.set(key, [s[0] + x + 0.5, s[1] + y + 0.5, s[2] + 1]);
  }
  const f = w.formations.cols;
  const own = w.formations.ids().filter((id) => f.nation[id] === n);
  let covered = 0;
  for (const [sx, sy, k] of sectors.values()) {
    const cx = sx / k;
    const cy = sy / k;
    if (own.some((id) => (f.x[id]! - cx) * (f.x[id]! - cx) + (f.y[id]! - cy) * (f.y[id]! - cy) <= (2 * SECTOR_CELLS) * (2 * SECTOR_CELLS))) covered++;
  }
  return sectors.size === 0 ? 1 : covered / sectors.size;
}

/** Cells first owned by `victim` and now controlled by `taker`. */
function taken(w: World, owner0: Uint16Array, victim: number, taker: number): number {
  let n = 0;
  for (let c = 0; c < owner0.length; c++) if (owner0[c] === victim && w.cells.controller[c] === taker) n++;
  return n;
}

describe('operational AI (PLAN 1.25)', () => {
  it('the larger nation advances, and both sides spread along the front', () => {
    const s = duel();
    const w = s.world;
    const owner0 = new Uint16Array(w.cells.owner);
    runEvents(s, 1); // the declaration applies at tick 0
    // A sustained war: neither side may sue (an early exhaustion peace would end the test).
    const war = w.wars.between(GER, POL)!.war;
    war.fightToDeath = [true, true];
    runEvents(s, 24 * 10 - 1);
    const cov10 = [coverage(w, GER), coverage(w, POL)];
    runEvents(s, 24 * 20);
    const cov30 = [coverage(w, GER), coverage(w, POL)];
    runEvents(s, 24 * 30);
    const gerGain = taken(w, owner0, POL, GER);
    const polGain = taken(w, owner0, GER, POL);
    const log = process.env['OPAI_LOG'];
    if (log) writeFileSync(log, JSON.stringify({ cov10, cov30, gerGain, polGain, score: war.score }));
    // The larger nation advances (and the smaller one's early raids are pushed back).
    expect(gerGain).toBeGreaterThan(300);
    expect(gerGain).toBeGreaterThan(4 * polGain);
    // Formations are spread along the front: most front sectors have a division within 2 sectors.
    for (const c of [...cov10, ...cov30]) expect(c).toBeGreaterThanOrEqual(0.6);
    expect(H).toBe(SIZE_1938.h);
  }, 180_000);
});

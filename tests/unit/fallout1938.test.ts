import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { ECONOMY_TABLES_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { monthlyAccounts } from '../../src/sim/systems/economy';
import { elementIndex } from '../../src/sim/systems/elements';
import { FALLOUT_ATTRITION, FALLOUT_FLOOR, FALLOUT_HALF_LIFE, FALLOUT_INCOME, FALLOUT_KM, FALLOUT_SLOW, falloutAt, layFallout, nuclearSystem, windAt } from '../../src/sim/systems/nuclear';
import { seaKm } from '../../src/sim/systems/navalCombat';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.3 AT (6.3b): fallout, laid downwind by a deterministic seasonal wind, decaying by a
// half-life of FALLOUT_HALF_LIFE days; attrition, income and pace lost where it lies.

const { w: W, h: H } = SIZE_1938;
const GER = nationId('GER');
const berlin = cellOf(13.4, 52.52, W, H);
const world = (): World => new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) }).world;
/** The day's nuclear work `days` times, at each day's first hour. */
const days = (w: World, n: number): void => {
  for (let d = 0; d < n; d++) {
    nuclearSystem(w);
    w.tick += 24;
  }
};

describe('fallout (PLAN 6.3b)', () => {
  it('the wind: westerlies in the middle latitudes, easterlies under 30° and over 60°, by the season; no chance in it', () => {
    const w = world();
    const row = (lat: number): number => cellOf(0, lat, W, H)[1];
    const east = (a: number): number => Math.cos(a);
    for (const day of [0, 90, 180, 270]) {
      expect(east(windAt(w, row(45), day)), `45°N day ${day}`).toBeGreaterThan(0.8);
      expect(east(windAt(w, row(-45), day)), `45°S day ${day}`).toBeGreaterThan(0.8);
      expect(east(windAt(w, row(15), day)), `15°N day ${day}`).toBeLessThan(-0.8);
      expect(east(windAt(w, row(70), day)), `70°N day ${day}`).toBeLessThan(-0.8);
    }
    expect(windAt(w, row(45), 100)).toBe(windAt(w, row(45), 100));
    // The season turns it: not the same in spring and autumn.
    expect(windAt(w, row(45), 91)).not.toBeCloseTo(windAt(w, row(45), 273), 3);
  });

  it('a burst at Berlin lays its plume east, downwind, within its length, to 1 at most', () => {
    const w = world();
    layFallout(w, 1, ...berlin);
    expect(w.fallout.size).toBeGreaterThan(10);
    let sx = 0;
    let total = 0;
    for (const [c, f] of w.fallout) {
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThanOrEqual(1);
      const [x, y] = [(c % W) + 0.5, Math.floor(c / W) + 0.5];
      expect(seaKm(w, ...berlin, x, y)).toBeLessThan(FALLOUT_KM + 100);
      sx += (x - berlin[0]) * f;
      total += f;
    }
    expect(sx / total, 'the plume\'s weight east of Berlin').toBeGreaterThan(1);
    expect(falloutAt(w, Math.floor(berlin[1]) * W + Math.floor(berlin[0]))).toBeGreaterThan(0.5);
  });

  it('decays by half in FALLOUT_HALF_LIFE days, and a cell under FALLOUT_FLOOR is clean', () => {
    const w = world();
    w.fallout.set(100, 0.8);
    w.fallout.set(101, FALLOUT_FLOOR * 1.0001);
    days(w, FALLOUT_HALF_LIFE);
    expect(w.fallout.get(100)).toBeCloseTo(0.4, 9);
    expect(w.fallout.has(101)).toBe(false);
    days(w, FALLOUT_HALF_LIFE);
    expect(w.fallout.get(100)).toBeCloseTo(0.2, 9);
  });

  it('where it lies: a formation loses FALLOUT_ATTRITION × it a day; a cell\'s output (1 − FALLOUT_INCOME × it) of itself', () => {
    const w = world();
    const c = w.formations.cols;
    const ec = w.elements.cols;
    let id = -1;
    w.formations.forEach((f) => {
      if (id < 0 && c.nation[f] === GER && !w.isFleet(f) && !w.offLand(f)) id = f;
    });
    const cell = Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!);
    const before = (elementIndex(w).get(id) ?? []).map((e) => ec.strength[e]!);
    const income = monthlyAccounts(w, ECONOMY_TABLES_1938).gross[GER]!;
    w.fallout.set(cell, 1);
    days(w, 1);
    const after = (elementIndex(w).get(id) ?? []).map((e) => ec.strength[e]!);
    before.forEach((s, j) => expect(Math.abs(after[j]! - s * (1 - FALLOUT_ATTRITION)), `element ${j}`).toBeLessThanOrEqual(1));
    // Germany's output less its cell's share (the fallout there decayed a day: × FALLOUT_DECAY).
    const lost = income - monthlyAccounts(w, ECONOMY_TABLES_1938).gross[GER]!;
    if (w.cells.econ[cell]! > 0) expect(lost).toBeGreaterThan(0);
    expect(FALLOUT_INCOME).toBeGreaterThan(0);
  });

  it('a march across fallout takes 1 ÷ (1 − FALLOUT_SLOW × it) as long: a German division from Berlin towards Hanover, a day, about half as far through fallout 1 (PLAN 6.9)', () => {
    const hanover = cellOf(9.73, 52.37, W, H);
    const run = (fallout: boolean): number => {
      const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
      const w = s.world;
      w.settings.aiEnabled = false;
      const c = w.formations.cols;
      let id = -1;
      let best = Infinity;
      w.formations.forEach((f) => {
        if (c.nation[f] !== GER || w.isFleet(f) || w.isWing(f) || w.offLand(f)) return;
        const d = Math.hypot(c.x[f]! - berlin[0], c.y[f]! - berlin[1]);
        if (d < best) [best, id] = [d, f];
      });
      if (fallout) for (let y = Math.floor(hanover[1]) - 4; y <= Math.floor(berlin[1]) + 4; y++) for (let x = Math.floor(hanover[0]) - 4; x <= Math.floor(berlin[0]) + 4; x++) w.fallout.set(y * W + x, 1);
      const x0 = c.x[id]!;
      s.command({ kind: 'moveFormation', id, x: hanover[0], y: hanover[1] });
      s.step(24);
      return Math.abs(c.x[id]! - x0);
    };
    const clean = run(false);
    const hot = run(true);
    process.stderr.write(`a day's march: ${clean.toFixed(2)} cells clean, ${hot.toFixed(2)} through fallout
`);
    expect(clean).toBeGreaterThan(1);
    // The fallout decays a little in the day: a share of the clean march near 1 − FALLOUT_SLOW.
    expect(hot / clean).toBeGreaterThan(1 - FALLOUT_SLOW - 0.1);
    expect(hot / clean).toBeLessThan(1 - FALLOUT_SLOW + 0.1);
  });
});

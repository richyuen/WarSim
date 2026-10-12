import { describe, expect, it } from 'vitest';
import { isLand } from '../../src/shared/terrain';
import { WAY_TOLERANCE, wayLine } from '../../src/shared/wayLine';
import { sailRoute } from '../../src/sim/nav/sailRoute';
import { PORTS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { laneOf, navOf, seaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 4.7d: a fleet's order line goes along its way, cut down to the points it turns at, and
// not straight to its target over the land between.

const W = 100;
const cell = (x: number, y: number): number => y * W + x;
const pairs = (pts: number[]): [number, number][] => Array.from({ length: pts.length / 2 }, (_, i) => [pts[2 * i]!, pts[2 * i + 1]!]);

/** The distance from (px, py) to the line through `pts`. */
function fromLine(pts: number[], px: number, py: number): number {
  let best = Infinity;
  for (let i = 2; i < pts.length; i += 2) {
    const [ax, ay, bx, by] = [pts[i - 2]!, pts[i - 1]!, pts[i]!, pts[i + 1]!];
    const [dx, dy] = [bx - ax, by - ay];
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + t * dx - px, ay + t * dy - py));
  }
  return best;
}

describe('the order line of a fleet (PLAN 4.7d)', () => {
  it('a straight walk is one segment; a corner is kept; the cells walked are on the line', () => {
    const straight = Array.from({ length: 20 }, (_, i) => cell(10 + i, 5));
    expect(pairs(wayLine(10.5, 5.5, straight, 0, W, false))).toEqual([[10.5, 5.5], [29.5, 5.5]]);
    const corner = [...Array.from({ length: 10 }, (_, i) => cell(10 + i, 5)), ...Array.from({ length: 10 }, (_, i) => cell(19, 6 + i))];
    const line = wayLine(10.5, 5.5, corner, 0, W, false);
    expect(pairs(line)).toEqual([[10.5, 5.5], [19.5, 5.5], [19.5, 15.5]]);
    // Stairs (a diagonal of neighbours four ways) are one line, every cell within the tolerance.
    const stairs: number[] = [];
    for (let i = 0; i < 15; i++) stairs.push(cell(10 + i, 5 + i), cell(11 + i, 5 + i));
    const s = wayLine(10.5, 5.5, stairs, 0, W, false);
    expect(s.length / 2).toBeLessThanOrEqual(3);
    for (const c of stairs) expect(fromLine(s, (c % W) + 0.5, Math.floor(c / W) + 0.5)).toBeLessThanOrEqual(WAY_TOLERANCE + 1e-9);
  });

  it('from where the fleet stands, by the cells after the step it is on', () => {
    const path = Array.from({ length: 20 }, (_, i) => cell(10 + i, 5));
    expect(pairs(wayLine(15.2, 5.5, path, 5, W, false))).toEqual([[15.2, 5.5], [29.5, 5.5]]);
  });

  it('over the seam of a map that loops the line goes on, beyond the edge', () => {
    const path = [cell(97, 8), cell(98, 8), cell(99, 8), cell(0, 8), cell(1, 8)];
    expect(pairs(wayLine(97.5, 8.5, path, 0, W, true))).toEqual([[97.5, 8.5], [101.5, 8.5]]);
    // On one that does not, the cells are where they are: the line ends in column 1.
    expect(wayLine(97.5, 8.5, path, 0, W, false).slice(-2)).toEqual([1.5, 8.5]);
  });

  it('the ways of 1938: along the sea, where the line straight to the port crosses the land', () => {
    const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
    const lanes = laneOf(w);
    const cw = w.cells.w;
    const water = (name: string): number => lanes.cell[lanes.portNode[w.ports.findIndex((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === name)]!]!;
    /** Of points a quarter of a cell apart along the line, those on land and all. */
    const onLand = (pts: number[]): [number, number] => {
      let [n, l] = [0, 0];
      for (let i = 2; i < pts.length; i += 2) {
        const [ax, ay, bx, by] = [pts[i - 2]!, pts[i - 1]!, pts[i]!, pts[i + 1]!];
        const k = Math.ceil(Math.hypot(bx - ax, by - ay) * 4);
        for (let s = 0; s <= k; s++) {
          const [x, y] = [ax + ((bx - ax) * s) / k, ay + ((by - ay) * s) / k];
          n++;
          if (isLand(w.cells.terrain[Math.floor(y) * cw + ((Math.floor(x) % cw) + cw) % cw]!)) l++;
        }
      }
      return [l, n];
    };
    for (const [a, b] of [['Gibraltar', 'Alexandria'], ['Scapa Flow', 'Pearl Harbor'], ['Gibraltar', 'Singapore']] as const) {
      const r = sailRoute(navOf(w).grid, seaOf(w), lanes, water(a), water(b))!;
      const c0 = r.cells[0]!;
      const line = wayLine((c0 % cw) + 0.5, Math.floor(c0 / cw) + 0.5, r.cells, 0, cw, true);
      const straight = [line[0]!, line[1]!, line[line.length - 2]!, line[line.length - 1]!];
      const [l, n] = onLand(line);
      const [sl, sn] = onLand(straight);
      console.log(`${a} to ${b}: ${r.cells.length} cells, ${line.length / 2} points; on land ${l} of ${n} along the line, ${sl} of ${sn} straight`);
      expect(sl / sn, `${a} to ${b}: the premise, the straight line over the land`).toBeGreaterThan(0.3);
      expect(l / n, `${a} to ${b}`).toBeLessThan(0.02);
      expect(line.length / 2).toBeLessThan(30);
      expect(line.length / 2).toBeLessThan(r.cells.length / 10);
    }
  });
});

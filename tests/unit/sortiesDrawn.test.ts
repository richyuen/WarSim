import { describe, expect, it } from 'vitest';
import { SORTIE_STRIDE, SortieRole } from '../../src/shared/protocol';
import { Leg, sortieAt } from '../../src/shared/sorties';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { orderMission } from '../../src/sim/systems/air';
import { aircraftOf } from '../../src/sim/systems/airCombat';
import { drawSorties, ORBIT_CELLS, ORBIT_VIEW, planesOf, sortiePlace } from '../../src/render/units/sorties';
import { sortieSection } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 5.7a: the snapshot carries the sorties in the air, and the page places each where the
// sim's own function has it at the frame's time.

const GER = nationId('GER');
const W = SIZE_1938.w;

/** A 2D context that draws nothing: what `drawSorties` places is all a test reads. */
const blank = (): CanvasRenderingContext2D => new Proxy({}, { get: (_, k) => (k === 'canvas' ? {} : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;

describe("a patrol's circle at T3 (PLAN 7.24c)", () => {
  it('a patrol over the middle of the view is drawn on the screen all round its circle, at 25 m/px as at 80', () => {
    const [vw, vh] = [1600, 900];
    const geo = { w: 2048, h: 1024, kmPerCell: 19.57, wrapX: true };
    // The widest circle a sortie has (1.3 of ORBIT_CELLS): its own phase by base and launch.
    const rows: number[] = [];
    for (let k = 0; k < 40; k++) rows.push(10 + k * 0.137, 12, 20, 10, 0, 100, 1000, 3, 1, 36, SortieRole.fighter);
    for (const m of [80, 25]) {
      const cam = { cx: 20, cy: 10, scale: (19.57 * 1000) / m };
      let drawn = 0;
      // Round the circle: 24 times in its half hour.
      for (let t = 10; t < 10.5; t += 0.5 / 24) {
        const placed = drawSorties(blank(), rows, t, cam, geo, vw, vh, 1, () => '#fff');
        drawn += placed.length;
        for (const p of placed) {
          expect(p.leg).toBe(Leg.Over);
          expect(Math.abs(p.x - vw / 2), `at ${m} m/px, hour ${t.toFixed(3)}`).toBeLessThan(vw / 2);
          expect(Math.abs(p.y - vh / 2), `at ${m} m/px, hour ${t.toFixed(3)}`).toBeLessThan(vh / 2);
        }
      }
      // Every sortie at every moment: none off the screen.
      expect(drawn, `at ${m} m/px`).toBe(40 * 24);
    }
    // At T3 the circle is the view's, at most ORBIT_VIEW × 1.3 of its smaller half side.
    expect(ORBIT_VIEW * 1.3).toBeLessThan(1);
  });
});

describe('sorties drawn (PLAN 5.7a)', () => {
  it('the snapshot\'s rows: a sortie in the air, its launch from the tick, nation, aircraft, role; none at home', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.aiEnabled = false;
    expect(sortieSection(w)).toHaveLength(0);
    const wing = [...w.wingBase].find(([id, b]) => b > 0 && w.formations.cols.nation[id] === GER && TEMPLATES_1938[w.formations.cols.template[id]!]!.id === 'fighter_group')![0];
    const prague = cellOf(14.4, 50.1, W, SIZE_1938.h);
    orderMission(w, wing, 'patrol', ...prague);
    s.step(2);
    const rows = sortieSection(w);
    expect(rows).toHaveLength(SORTIE_STRIDE);
    const o = w.sorties.get(wing)!;
    expect(Array.from(rows)).toEqual(Array.from(Float32Array.from([o.bx, o.by, o.tx, o.ty, o.launch - w.tick, o.kmh, o.km, o.over, GER, aircraftOf(w, wing), SortieRole.fighter])));
    // The page's place is the sim's, at the tick and between ticks.
    for (const t of [0, 0.25, 0.5, 0.99]) {
      const p = sortiePlace(rows, 0, t, W)!;
      const q = sortieAt({ ...o, launch: o.launch - w.tick }, t, W);
      if (q.leg === Leg.Over) expect(Math.abs(Math.hypot(p.x - q.x, p.y - q.y) / ORBIT_CELLS - 1)).toBeLessThanOrEqual(0.3 + 1e-6);
      else expect([p.x, p.y].map((v) => v.toFixed(3))).toEqual([q.x, q.y].map((v) => v.toFixed(3)));
    }
  });

  it('out it heads for its target, back for its base; over its target it circles; home, it is not drawn', () => {
    const row = [10, 10, 20, 10, 0, 100, 1000, 2, 1, 36, SortieRole.fighter];
    const out = sortiePlace(row, 0, 5, 2048)!;
    expect(out.leg).toBe(Leg.Out);
    expect(out.heading).toBeCloseTo(0, 9);
    const over = [11, 11.125].map((t) => sortiePlace(row, 0, t, 2048)!);
    expect(over.every((p) => p.leg === Leg.Over)).toBe(true);
    // One sortie's circle: the same radius all round, 0.7 to 1.3 of ORBIT_CELLS.
    const r = over.map((p) => Math.hypot(p.x - 20, p.y - 10));
    expect(r[0]).toBeCloseTo(r[1]!, 9);
    expect(r[0]! / ORBIT_CELLS).toBeGreaterThanOrEqual(0.7);
    expect(r[0]! / ORBIT_CELLS).toBeLessThanOrEqual(1.3);
    // Two sorties over one target from other bases: elsewhere on the circle.
    const other = sortiePlace([12, 14, 20, 10, 0, 100, 1000, 2, 1, 36, SortieRole.fighter], 0, 11, 2048)!;
    expect(Math.hypot(other.x - over[0]!.x, other.y - over[0]!.y)).toBeGreaterThan(0.05);
    expect(over[0]!.x).not.toBeCloseTo(over[1]!.x, 3);
    const back = sortiePlace(row, 0, 15, 2048)!;
    expect(back.leg).toBe(Leg.Back);
    expect(Math.cos(back.heading)).toBeCloseTo(-1, 9);
    expect(sortiePlace(row, 0, -1, 2048)).toBeNull();
    expect(sortiePlace(row, 0, 23, 2048)).toBeNull();
    // Over the seam, the short way.
    const seam = [2040, 10, 6, 10, 0, 100, 1000, 0, 1, 36, SortieRole.fighter];
    const p = sortiePlace(seam, 0, 5, 2048)!;
    expect(p.x).toBeCloseTo(2047, 6);
    expect(p.heading).toBeCloseTo(0, 9);
    expect([planesOf(6), planesOf(12), planesOf(36)]).toEqual([1, 2, 3]);
  });
});

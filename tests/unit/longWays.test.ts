import { describe, expect, it } from 'vitest';
import { askMove } from '../../src/sim/ai/operational';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { LONG_WAY, LONG_WAY_FLOOR_CELLS, orderMove, passageOf } from '../../src/sim/systems/movement';
import { EventKind, RejectReason } from '../../src/shared/events';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 1.42h (the user's decision of 2026-10-15, rule b): the operational AI gives no order whose
// way is several times the straight line (LONG_WAY): from Stockholm to Turku the Gulf of Bothnia is
// gone round by Tornio.

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const [SWE, FIN] = ['SWE', 'FIN'].map(nationId) as [number, number];

/** The reasons of formation `id`'s refusals among the events since the last call. */
function refusals(w: World, id: number): number[] {
  const ev = w.out.events;
  const why: number[] = [];
  for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.MoveRejected && ev[i + 2] === id) why.push(ev[i + 4]!);
  ev.length = 0;
  return why;
}

/** A cell of `nation` with its eight neighbours its own, nearest (lon, lat). */
function inner(w: World, nation: number, lon: number, lat: number): number {
  const [x0, y0] = cellOf(lon, lat, W, H).map(Math.floor) as [number, number];
  const own = (x: number, y: number): boolean => w.cells.controller[y * W + x] === nation;
  for (let r = 0; r < 20; r++) {
    for (let y = y0 - r; y <= y0 + r; y++) {
      for (let x = x0 - r; x <= x0 + r; x++) {
        let all = true;
        for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1 && all; dx++) all = own(x + dx, y + dy);
        if (all) return y * W + x;
      }
    }
  }
  throw new Error(`no inner cell of ${nation}`);
}

const steps = (a: number, b: number): number => Math.max(Math.abs((a % W) - (b % W)), Math.abs(Math.floor(a / W) - Math.floor(b / W)));

describe('long ways (PLAN 1.42h)', () => {
  it("the AI's order by a way several times the straight line is refused; a player's is not", () => {
    const s = new Sim({ scenario: '1938', seed: 1942, assets: assets1938(W) });
    const w = s.world;
    const f = w.formations.cols;
    w.wars.start([SWE], [FIN], w.tick);
    w.wars.changed();
    const stockholm = inner(w, SWE, 17.9, 59.4);
    const turku = inner(w, FIN, 22.4, 60.5);
    const id = addDivision(w, SWE, (stockholm % W) + 0.5, Math.floor(stockholm / W) + 0.5);
    const longest = LONG_WAY * Math.max(steps(stockholm, turku), w.atSize(LONG_WAY_FLOOR_CELLS));
    refusals(w, id);
    expect(askMove(w, id, turku, passageOf(w, SWE))).toBe('long');
    expect(refusals(w, id)).toEqual([RejectReason.LongWay]);
    expect(f.moving[id]).toBe(0);
    // Asked again on the same ground: the answer kept, no search (PLAN 1.42g).
    expect(askMove(w, id, turku, passageOf(w, SWE))).toBe('long');
    expect(refusals(w, id)).toEqual([]);
    // A player's order has no such limit: the way round is found, and it is that long.
    expect(orderMove(w, id, (turku % W) + 0.5, Math.floor(turku / W) + 0.5)).toBe(true);
    expect(w.paths.get(id)!.length - 1).toBeGreaterThan(longest);
  }, 120_000);

  it('a way near the straight line is given', () => {
    const s = new Sim({ scenario: '1938', seed: 1942, assets: assets1938(W) });
    const w = s.world;
    const f = w.formations.cols;
    w.wars.start([SWE], [FIN], w.tick);
    w.wars.changed();
    // From Luleå round the head of the gulf to Oulu.
    const lulea = inner(w, SWE, 22.0, 65.7);
    const oulu = inner(w, FIN, 25.6, 65.0);
    const id = addDivision(w, SWE, (lulea % W) + 0.5, Math.floor(lulea / W) + 0.5);
    refusals(w, id);
    expect(askMove(w, id, oulu, passageOf(w, SWE))).toBe('ok');
    expect(refusals(w, id)).toEqual([]);
    expect(f.moving[id]).toBe(1);
    expect(w.paths.get(id)!.length - 1).toBeLessThanOrEqual(LONG_WAY * Math.max(steps(lulea, oulu), w.atSize(LONG_WAY_FLOOR_CELLS)));
  }, 120_000);
});

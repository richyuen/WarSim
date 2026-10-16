import { describe, expect, it } from 'vitest';
import { askMove } from '../../src/sim/ai/operational';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { passageOf } from '../../src/sim/systems/movement';
import { EventKind } from '../../src/shared/events';
import { navOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 1.42g (the user's decision of 2026-10-15, rule a): the operational AI does not give again an
// order that was refused for want of a way while nothing the refused search read has changed.

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const [GER, POL, SWI, FRA] = ['GER', 'POL', 'SWI', 'FRA'].map(nationId) as [number, number, number, number];

/** The refusals of formation `id` among the events since the last call. */
function refusals(w: World, id: number): number {
  const ev = w.out.events;
  let n = 0;
  for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.MoveRejected && ev[i + 2] === id) n++;
  ev.length = 0;
  return n;
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

describe('refused orders (PLAN 1.42g)', () => {
  it('a refused order is not given again until the ground open to it changes', () => {
    const s = new Sim({ scenario: '1938', seed: 1942, assets: assets1938(W) });
    const w = s.world;
    const f = w.formations.cols;
    w.wars.start([GER], [POL], w.tick);
    w.wars.changed();
    // A German division in Bavaria, sent into Switzerland, with which Germany is at peace.
    const home = inner(w, GER, 11.5, 48.5);
    const id = addDivision(w, GER, (home % W) + 0.5, Math.floor(home / W) + 0.5);
    const swiss = inner(w, SWI, 8.2, 46.8);
    expect(navOf(w).grid.component[home]).toBe(navOf(w).grid.component[swiss]);
    refusals(w, id);
    askMove(w, id, swiss, passageOf(w, GER));
    expect(refusals(w, id)).toBe(1);
    expect(f.moving[id]).toBe(0);
    expect(w.refusedOrders.has(id)).toBe(true);
    // Nothing changed: not asked again.
    askMove(w, id, swiss, passageOf(w, GER));
    expect(refusals(w, id)).toBe(0);
    // A cell between two holders open to Germany (Poland's, taken by Germany): not asked again.
    w.setController(inner(w, POL, 21.0, 52.2), GER);
    askMove(w, id, swiss, passageOf(w, GER));
    expect(refusals(w, id)).toBe(0);
    // A cell from a closed holder to an open one (France's, taken by Germany): asked again.
    w.setController(inner(w, FRA, 2.5, 47.0), GER);
    askMove(w, id, swiss, passageOf(w, GER));
    expect(refusals(w, id)).toBe(1);
    askMove(w, id, swiss, passageOf(w, GER));
    expect(refusals(w, id)).toBe(0);
    // Another order is asked.
    const other = inner(w, SWI, 7.4, 46.9);
    askMove(w, id, other, passageOf(w, GER));
    expect(refusals(w, id)).toBe(1);
    // The land counts dropped (an edit, a load): the memo with them.
    w.dropLandCounts();
    expect(w.refusedOrders.size).toBe(0);
    askMove(w, id, other, passageOf(w, GER));
    expect(refusals(w, id)).toBe(1);
    // A war with Switzerland opens its ground: asked again, and the way is found.
    w.wars.start([GER], [SWI], w.tick);
    w.wars.changed();
    askMove(w, id, other, passageOf(w, GER));
    expect(refusals(w, id)).toBe(0);
    expect(f.moving[id]).toBe(1);
    expect(w.refusedOrders.has(id)).toBe(false);
  }, 120_000);

  it('a formation on the march is asked each time', () => {
    const s = new Sim({ scenario: '1938', seed: 1942, assets: assets1938(W) });
    const w = s.world;
    const f = w.formations.cols;
    const home = inner(w, GER, 11.5, 48.5);
    const id = addDivision(w, GER, (home % W) + 0.5, Math.floor(home / W) + 0.5);
    askMove(w, id, inner(w, GER, 9.0, 51.0), passageOf(w, GER));
    expect(f.moving[id]).toBe(1);
    refusals(w, id);
    const swiss = inner(w, SWI, 8.2, 46.8);
    for (let k = 0; k < 2; k++) {
      askMove(w, id, swiss, passageOf(w, GER));
      expect(refusals(w, id)).toBe(1);
    }
    expect(w.refusedOrders.has(id)).toBe(false);
  }, 120_000);
});

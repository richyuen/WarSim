import { describe, expect, it } from 'vitest';
import type { FromWorker, Snapshot } from '../../src/shared/protocol';
import { SEA_STRIDE } from '../../src/shared/protocol';
import { cellOf } from '../../src/sim/data/terrain';
import { isLand } from '../../src/shared/terrain';
import { NATIONS_1938, SIZE_1938, TEMPLATES_1938, UNIT_IDS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex, equipFormation, settleFormation } from '../../src/sim/systems/elements';
import { inShipReach, seaKm } from '../../src/sim/systems/navalCombat';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, type World } from '../../src/sim/world';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';

// PLAN 7.19b (critic run 8, R8-B2): a sea battle's row framed a British carrier group and a German
// battle squadron 279 km apart, joined by the carrier's wings, and its middle was on dry land. The
// row's pair is now two fleets at war within reach of a ship's weapon of either (not the carriers'
// wings), its middle on the water; a battle with none has no pair (the ticker lists no row for it).

const { w: W } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const template = (t: string): number => TEMPLATES_1938.findIndex((x) => x.id === t);
const unit = (u: string): number => UNIT_IDS_1938.indexOf(u);
const GER = id('GER');
const ENG = id('ENG');

function atWar(): Sim {
  const s = new Sim({ scenario: '1938', seed: 4302, assets: assets1938(W) });
  s.world.settings.aiEnabled = false;
  expect(declareWar(s.world, GER, ENG, true)).not.toBeNull();
  return s;
}

function fleet(world: World, nation: number, tpl: string, x: number, y: number, drop?: string): number {
  const f = world.formations;
  const fid = f.create();
  f.cols.nation[fid] = nation;
  f.cols.x[fid] = x;
  f.cols.y[fid] = y;
  f.cols.template[fid] = template(tpl);
  f.cols.supply[fid] = 1;
  f.cols.org[fid] = 1;
  equipFormation(world, fid, template(tpl));
  if (drop !== undefined) {
    for (const e of elementIndex(world).get(fid)!) if (world.elements.cols.unit[e] === unit(drop)) world.elements.cols.strength[e] = 0;
    settleFormation(world, fid);
  }
  expect(world.afloat(fid)).toBe(true);
  return fid;
}

/** Open water in the North Atlantic, and the x of the point `km` east of it on its row. */
function openSea(world: World): { x: number; y: number; east: (km: number) => number } {
  const [cx, cy] = cellOf(-32, 47, W, SIZE_1938.h).map(Math.floor) as [number, number];
  const x = cx + 0.5;
  const y = cy + 0.5;
  const kx = navOf(world).grid.kx[cy]!;
  return { x, y, east: (km) => x + km / kx };
}

describe("a sea battle's pair within reach of a ship's weapon (PLAN 7.19b)", () => {
  it("guns and torpedoes count, a carrier's wings do not; depth charges count on a submarine", () => {
    const s = atWar();
    const w = s.world;
    const sea = openSea(w);
    const bb = fleet(w, GER, 'battle_squadron', sea.x, sea.y);
    // A destroyer flotilla 30 km off: within the battleships' 32 km.
    const dd = fleet(w, ENG, 'destroyer_flotilla', sea.east(30), sea.y);
    expect(seaKm(w, sea.x, sea.y, sea.east(30), sea.y)).toBeCloseTo(30, 6);
    expect(inShipReach(w, bb, dd)).toBe(true);
    expect(inShipReach(w, dd, bb)).toBe(true);
    // 34 km: beyond every gun of either.
    w.formations.cols.x[dd] = sea.east(34);
    expect(inShipReach(w, bb, dd)).toBe(false);
    // A carrier group 150 km off: its wings reach (250 km), no ship's weapon does.
    w.formations.cols.x[dd] = sea.east(2000);
    const cv = fleet(w, ENG, 'carrier_group', sea.east(150), sea.y);
    expect(inShipReach(w, bb, cv)).toBe(false);
    // A submarine flotilla 10 km off a battle squadron without its destroyers: its torpedoes
    // reach 6 km, and nothing of the squadron's hits a submarine; with them, depth charges at 12.
    const bare = fleet(w, GER, 'battle_squadron', sea.x, sea.y + 40, 'destroyer');
    const ss = fleet(w, ENG, 'submarine_flotilla', sea.east(10), sea.y + 40);
    expect(inShipReach(w, bare, ss)).toBe(false);
    w.formations.cols.x[ss] = sea.east(5);
    expect(inShipReach(w, bare, ss)).toBe(true);
    w.formations.cols.x[ss] = sea.east(10);
    const screened = fleet(w, GER, 'battle_squadron', sea.x, sea.y + 40);
    expect(inShipReach(w, screened, ss)).toBe(true);
  });

  it("the worker's snapshot: no pair for a battle of a carrier's wings alone; the pair within reach, its middle on the water", () => {
    // PLAN 5.4d's set-up: Japan and the United States at war, a Japanese carrier group of the start
    // (its wings aboard) and an American battle squadron 150 km apart in the open Pacific.
    const sim = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = sim.world;
    w.settings.aiEnabled = false;
    const [JAP, USA] = [id('JAP'), id('USA')];
    w.wars.start([JAP], [USA], 0);
    const c = w.formations.cols;
    const tmpl = (f: number): string => TEMPLATES_1938[c.template[f]!]!.id;
    const of = (n: number, t: string): number => [...w.formations.ids()].find((f) => w.isFleet(f) && c.nation[f] === n && tmpl(f) === t)!;
    const cv = of(JAP, 'carrier_group');
    const bb = of(USA, 'battle_squadron');
    for (const f of w.formations.ids()) if (w.isFleet(f) && f !== cv && f !== bb) [c.x[f], c.y[f]] = [5.5, 5.5];
    const [sx, sy] = cellOf(-170, 20, W, SIZE_1938.h);
    const kx = navOf(w).grid.kx[Math.floor(sy)]!;
    [c.x[cv], c.y[cv]] = [sx, sy];
    [c.x[bb], c.y[bb]] = [sx + 150 / kx, sy];
    sim.step(1);
    expect(w.seaBattles.some((b) => b.fleets.includes(cv) && b.fleets.includes(bb))).toBe(true);
    let last: Snapshot | null = null;
    const server = new SimServer((m: FromWorker) => {
      if (m.type === 'snapshot') last = m.snap;
    });
    server.sim = sim;
    const sub = { bbox: [sx - 4, sy - 4, sx + 14, sy + 4] as [number, number, number, number], z: 0, tier: 1 as const, wantsElements: false };
    // Its battle's record in the snapshot: the one whose fleets' box is about the carrier (the
    // fleets set aside have battles of their own).
    const seas = (): Float32Array => {
      if (last) server.handle({ type: 'ack', seq: last.seq, buffers: last.buffers }, 0);
      server.handle({ type: 'subscribe', sub }, 0);
      const all = last!.seas;
      const mine: number[] = [];
      for (let i = 0; i < all.length; i += SEA_STRIDE) if (Math.abs(all[i + 5]! - sx) < 20 && Math.abs(all[i + 6]! - sy) < 20) mine.push(i);
      expect(mine).toHaveLength(1);
      return all.subarray(mine[0]!, mine[0]! + SEA_STRIDE);
    };
    let got = seas();
    expect(got[11], "no pair: the carrier's wings alone reach").toBe(-1);
    // An American destroyer flotilla 20 km off the carrier group: the pair is the two, on the water.
    const dd = of(USA, 'destroyer_flotilla');
    [c.x[dd], c.y[dd]] = [sx + 20 / kx, sy];
    sim.step(1);
    expect(w.seaBattles.flatMap((b) => b.fleets)).toContain(dd);
    got = seas();
    expect(got[11]).toBeGreaterThan(0);
    expect(got[9]!).toBeGreaterThan(c.x[cv]! - 1e-6);
    expect(got[9]!).toBeLessThan(c.x[dd]! + 1e-6);
    const cell = Math.floor(got[10]!) * W + Math.floor(got[9]!);
    expect(isLand(w.cells.terrain[cell]!)).toBe(false);
  });
});

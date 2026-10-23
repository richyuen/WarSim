/**
 * PLAN 7.90h: a nation's ferry turns with a sail to the army refused while a free formation that
 * marches to a port of its land was not tried. From a saved state, for `days` days (`FERRY_PROBE`):
 * on each turn of the nation with a `sail` that gave no order, the free army still standing that
 * no sail of the turn tried (`FerryTry.tried`) whose march to one of the SAIL_TRIES ports of the
 * nation nearest it on its land is open (as `sailToArmy` asks), and those the sails tried. Prints
 * the state hash at the end, to compare with a run without the probe. Read only.
 *
 * Usage: npx tsx tools/diag/sailCut.ts <seed> <state.bin> <TAG> <days> [out.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { FERRY_PROBE, SAIL_TRIES, type FerryTurn } from '../../src/sim/ai/invasion';
import type { MobilityId } from '../../src/sim/nav/grid';
import { findRoute } from '../../src/sim/nav/provinceGraph';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { passageOf, snapTarget } from '../../src/sim/systems/movement';
import { navOf, portSeaOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const [seedS, bin, tag, daysS, out] = process.argv.slice(2);
const days = Number(daysS);
const probe = process.env.NOPROBE !== '1';
const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin!)));
const w = s.world;
const W = w.cells.w;
const c = w.formations.cols;
const n = TAGS_1938.indexOf(tag!) + 1;
const cellOf = (id: number): number => Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!);
const steps = (a: number, b: number): number => {
  let dx = Math.abs((a % W) - (b % W));
  if (w.settings.loopingMap && dx > W / 2) dx = W - dx;
  return dx + Math.abs(Math.floor(a / W) - Math.floor(b / W));
};
const standing = (id: number): boolean =>
  !w.offLand(id) && c.nation[id] === n && c.moving[id] !== 1 && c.engaged[id] !== 1 && c.retreat[id] === 0 && c.home[id] === 0;
/** The port of n's it marches to among the SAIL_TRIES nearest on its land, or undefined. */
const marchPort = (id: number): string | undefined => {
  const nav = navOf(w);
  const comp = nav.grid.component;
  const water = portSeaOf(w);
  const ctl = w.cells.controller;
  const pass = passageOf(w, n);
  const k = cellOf(id);
  const ports: [number, number][] = [];
  w.ports.forEach((p, i) => {
    if (water[i]! >= 0 && ctl[p.cell] === n && comp[p.cell] === comp[k]) ports.push([steps(p.cell, k), i]);
  });
  ports.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const rule = w.rules!.templates[c.template[id]!]!;
  for (const [d, i] of ports.slice(0, SAIL_TRIES)) {
    const cell = w.ports[i]!.cell;
    const goal = snapTarget(w, k, cell % W, Math.floor(cell / W));
    if (goal >= 0 && findRoute(nav.grid, nav.graph, rule.mobility as MobilityId, k, goal, pass) !== null) return `${w.ports[i]!.name} ${d}`;
  }
  return undefined;
};
interface Row {
  day: number;
  free: number;
  sails: number;
  refused: number;
  tried: string[];
  missed: string[];
}
const rows: Row[] = [];
if (probe) {
  FERRY_PROBE.turn = (t: FerryTurn): void => {
    if (t.nation !== n) return;
    const sails = t.tries.filter((x) => x.way === 'sail');
    const refused = sails.filter((x) => !x.acted);
    if (refused.length === 0) return;
    const comp = navOf(w).grid.component;
    const tried = new Set<number>();
    for (const x of sails) for (const id of x.tried ?? []) tried.add(id);
    const missed: string[] = [];
    for (const id of t.island) {
      if (tried.has(id) || !standing(id)) continue;
      const p = marchPort(id);
      const k = cellOf(id);
      if (p !== undefined) missed.push(`${id} (${k % W},${Math.floor(k / W)}) land ${comp[k]} ${Math.round(c.strength[id]!)} -> ${p}`);
    }
    const desc = [...tried].map((id) => {
      const k = cellOf(id);
      return `${id} (${k % W},${Math.floor(k / W)}) land ${comp[k]} ${Math.round(c.strength[id]!)}`;
    });
    rows.push({ day: w.tick / 24, free: t.island.length, sails: sails.length, refused: refused.length, tried: desc, missed });
  };
}
const quiet = (ww: typeof w): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
for (let d = 0; d < days; d++) s.step(24, quiet);
delete FERRY_PROBE.turn;
const bad = rows.filter((r) => r.missed.length > 0);
for (const r of rows) {
  console.log(`day ${r.day} free ${r.free} sails ${r.sails} refused ${r.refused}; missed ${r.missed.length}`);
  console.log(`  tried: ${r.tried.join('; ')}`);
  for (const m of r.missed.slice(0, 8)) console.log(`  missed ${m}`);
}
console.log(`${tag} ${days} days: turns with a sail refused ${rows.length}, with a marching free formation not tried ${bad.length}${bad.length ? ` (days ${bad.map((r) => r.day).join(', ')})` : ''}`);
console.log(`hash ${s.hash().toString(16)}`);
if (out) writeFileSync(out, JSON.stringify(rows, null, 1));

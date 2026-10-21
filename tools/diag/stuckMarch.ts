/**
 * PLAN 7.49: a nation's land formations day by day from a saved state: where each stands, whether
 * it moves, its order's target cell and who holds it, how far along its path it is, and the km it
 * went since the day before. Then the places where most of them stand (by cell), and for the
 * formations that moved on most days and went least: their target's distance and their path.
 *
 * Usage: npx tsx tools/diag/stuckMarch.ts <seed> <state.bin> <TAG> [days = 14] [out.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { formationPath } from '../../src/sim/systems/movement';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const bin = process.argv[3]!;
const who = TAGS_1938.indexOf(process.argv[4]!) + 1;
const days = Number(process.argv[5] ?? 14);
const out = process.argv[6] ?? `.cache/749/stuck_${seed}_${process.argv[4]}.json`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin)));
const w = s.world;
const quiet = (ww: typeof w): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
const tag = (n: number): string => (n === 0 ? '-' : (TAGS_1938[n - 1] ?? `#${n}`));
const cw = w.cells.w;
type Day = { x: number; y: number; moving: number; target: number; holder: string; step: number; path: number; km: number; retreat: number; home: number; engaged: number };
const track = new Map<number, Day[]>();
for (let d = 0; d <= days; d++) {
  if (d > 0) s.step(24, quiet);
  const c = w.formations.cols;
  w.formations.forEach((id) => {
    if (c.nation[id] !== who || w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
    let t = track.get(id);
    if (!t) track.set(id, (t = []));
    const p = formationPath(w, id);
    const last = t[t.length - 1];
    const x = c.x[id]!;
    const y = c.y[id]!;
    t.push({
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      moving: c.moving[id]!,
      target: c.targetCell[id]!,
      holder: tag(w.cells.controller[c.targetCell[id]!]!),
      step: c.pathStep[id]!,
      path: p ? p.length : -1,
      km: last ? Math.round(seaKm(w, last.x, last.y, x, y)) : 0,
      retreat: c.retreat[id]!,
      home: c.home[id]!,
      engaged: c.engaged[id]!,
    });
  });
}
// Where they stand at the end, by cell.
const at = new Map<number, number>();
for (const t of track.values()) {
  const e = t[t.length - 1]!;
  const cell = Math.floor(e.y) * cw + Math.floor(e.x);
  at.set(cell, (at.get(cell) ?? 0) + 1);
}
const piles = [...at.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([cell, n]) => ({ cell, x: cell % cw, y: Math.floor(cell / cw), n, holder: tag(w.cells.controller[cell]!) }));
const summary = [...track.entries()].map(([id, t]) => ({
  id,
  movingDays: t.filter((e) => e.moving === 1).length,
  km: t.reduce((k, e) => k + e.km, 0),
  targets: new Set(t.map((e) => e.target)).size,
  first: t[0],
  last: t[t.length - 1],
}));
summary.sort((a, b) => b.movingDays - a.movingDays || a.km - b.km);
writeFileSync(out, JSON.stringify({ seed, bin, nation: process.argv[4], formations: track.size, piles, stuck: summary.slice(0, 20), tracks: Object.fromEntries([...track.entries()].slice(0, 400)) }, null, 1));
console.log(`formations ${track.size}; piles ${JSON.stringify(piles)}`);
for (const r of summary.slice(0, 12)) console.log(JSON.stringify({ id: r.id, movingDays: r.movingDays, km: r.km, targets: r.targets, first: r.first, last: r.last }));

/**
 * PLAN 7.116b's measure: the nations at war with free land formations within 12 cells of an enemy
 * land formation and none engaged (`warContact.ts`'s `near`). From a saved state after `days` days
 * (default 1), per such nation: its tag, AI on, its free formations near (within 12 cells of an
 * enemy one on the same landmass) by what they do (marching on an enemy cell, marching to an own
 * cell, standing) and by the nearest enemy's distance (1.5, 3, 6, 12), the enemies near and whether
 * those are engaged, standing or marching; and whether the nation planned in the last day
 * (`aiOff`, `settings.aiEnabled`).
 *
 * Usage: npx tsx tools/diag/nearIdle.ts <seed> <state.bin> [days = 1]
 */
import { readFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const src = process.argv[3]!;
const days = Number(process.argv[4] ?? 1);
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
s.load(new Uint8Array(readFileSync(src)));
for (let d = 0; d < days; d++)
  s.step(24, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
const c = w.formations.cols;
const nat = w.nations.cols;
const cw = w.cells.w;
const loop = w.settings.loopingMap;
const comp = navOf(w).grid.component;
const ctl = w.cells.controller;
const scale = w.atSize(1);
type F = { id: number; n: number; x: number; y: number; m: number; land: number };
const all: F[] = [];
w.formations.forEach((id) => {
  if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
  const n = c.nation[id]!;
  if (nat.living[n] !== 1) return;
  all.push({ id, n, x: c.x[id]!, y: c.y[id]!, m: c.strength[id]!, land: comp[Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!)]! });
});
const dist = (p: F, q: F): number => {
  let dx = Math.abs(p.x - q.x);
  if (loop && dx > cw / 2) dx = cw - dx;
  return Math.hypot(dx, p.y - q.y) / scale;
};
const doing = (id: number): string => {
  if (c.engaged[id] === 1) return 'engaged';
  if (c.retreat[id]! > 0) return 'retreat';
  if (c.moving[id] !== 1) return 'stand';
  const n = c.nation[id]!;
  const t = ctl[c.targetCell[id]!]!;
  return w.wars.atWar(n, t) ? 'attack' : 'march';
};
const R = [1.5, 3, 6, 12];
console.log(`seed ${seed} ${src} day ${Math.floor(w.tick / 24)}; ai ${w.settings.aiEnabled}`);
for (const n of w.wars.nations()) {
  if (nat.living[n] !== 1) continue;
  const mine = all.filter((f) => f.n === n);
  if (mine.some((f) => c.engaged[f.id] === 1)) continue;
  const enemies = all.filter((g) => w.wars.atWar(n, g.n));
  const near: { f: F; g: F; d: number }[] = [];
  for (const f of mine) {
    if (c.retreat[f.id]! > 0) continue;
    let best: F | null = null;
    let bd = Infinity;
    for (const g of enemies)
      if (g.land === f.land) {
        const d = dist(f, g);
        if (d < bd) {
          bd = d;
          best = g;
        }
      }
    if (best && bd <= 12) near.push({ f, g: best, d: bd });
  }
  if (near.length === 0) continue;
  const what: Record<string, number> = {};
  const bins = [0, 0, 0, 0];
  const foe: Record<string, number> = {};
  const foeN = new Set<number>();
  for (const { f, g, d } of near) {
    const k = doing(f.id);
    what[k] = (what[k] ?? 0) + 1;
    bins[R.findIndex((r) => d <= r)]!++;
    const gk = doing(g.id);
    foe[gk] = (foe[gk] ?? 0) + 1;
    foeN.add(g.n);
  }
  const men = Math.round(near.reduce((t, x) => t + x.f.m, 0));
  const ex = near.sort((p, q) => p.d - q.d)[0]!;
  console.log(
    `${tag(n)} aiOff ${nat.aiOff[n]} formations ${mine.length}, near ${near.length} (${men} men): ${JSON.stringify(what)}; nearest ${JSON.stringify(Object.fromEntries(R.map((r, i) => [r, bins[i]])))}; ` +
      `foes ${[...foeN].map(tag).join(',')} doing ${JSON.stringify(foe)}; closest ${ex.f.id}@(${ex.f.x.toFixed(1)},${ex.f.y.toFixed(1)}) ${doing(ex.f.id)} ${Math.round(ex.f.m)} vs ${ex.g.id} ${tag(ex.g.n)} ${doing(ex.g.id)} ${Math.round(ex.g.m)} at ${ex.d.toFixed(2)}`,
  );
}
console.log('done:');

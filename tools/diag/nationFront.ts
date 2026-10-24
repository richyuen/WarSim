/**
 * PLAN 7.104a: one nation's war on the land, from a saved state after one day. Its enemies (each
 * with its land formations, men, and the cells of the nation's front against it: the frontier
 * cells it or a nation on its side holds beside the enemy's, their centroid and box), and its own
 * land formations by place (rounded cell) with what each does (engaged, marching on an enemy
 * cell, marching to hold, standing) and the straight cells to the nearest front cell and to the
 * nearest enemy land formation. Then, over `days` more days, the daily count of its engaged
 * formations and of its formations within 12 cells of an enemy one.
 *
 * Usage: npx tsx tools/diag/nationFront.ts <seed> <state.bin> <nation tag or #id> [days = 30]
 */
import { readFileSync } from 'node:fs';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const src = process.argv[3]!;
const who = process.argv[4]!;
const days = Number(process.argv[5] ?? 30);
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const quiet = (ww: typeof w): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
s.load(new Uint8Array(readFileSync(src)));
s.step(24, quiet);
const N = who.startsWith('#') ? Number(who.slice(1)) : TAGS_1938.indexOf(who) + 1;
const c = w.formations.cols;
const { w: cw, h: ch, controller: ctl } = w.cells;
const loop = w.settings.loopingMap;
const scale = w.atSize(1);
const d2 = (x: number, y: number, p: number, q: number): number => {
  let dx = Math.abs(x - p);
  if (loop && dx > cw / 2) dx = cw - dx;
  return Math.hypot(dx, y - q) / scale;
};
const land = (): { id: number; n: number; x: number; y: number }[] => {
  const r: { id: number; n: number; x: number; y: number }[] = [];
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
    if (w.nations.cols.living[c.nation[id]!] !== 1) return;
    r.push({ id, n: c.nation[id]!, x: c.x[id]!, y: c.y[id]! });
  });
  return r;
};
const L = land();
const enemies = [...w.wars.nations()].filter((e) => w.wars.atWar(N, e) && w.nations.cols.living[e] === 1);
const nb: number[] = [];
const front = new Map<number, number[]>();
for (const cell of frontierOf(w)) {
  const h = ctl[cell]!;
  if (h !== N && !w.wars.sameSide(h, N)) continue;
  for (const k of neighbours4(cell, cw, ch, loop, nb)) {
    const e = ctl[k]!;
    if (w.wars.atWar(N, e) && (h === N || w.wars.atWar(h, e))) {
      let a = front.get(e);
      if (!a) front.set(e, (a = []));
      a.push(cell);
      break;
    }
  }
}
console.log(`${tag(N)} at war with ${enemies.length}; day ${Math.floor(w.tick / 24)}`);
for (const e of enemies) {
  const F = L.filter((f) => f.n === e);
  const men = F.reduce((t, f) => t + c.strength[f.id]!, 0);
  const cells = front.get(e) ?? [];
  const xs = cells.map((k) => k % cw);
  const ys = cells.map((k) => Math.floor(k / cw));
  const box = cells.length ? `x ${Math.min(...xs)}-${Math.max(...xs)} y ${Math.min(...ys)}-${Math.max(...ys)}` : '-';
  console.log(`  vs ${tag(e)}: ${F.length} formations ${men} men; front cells ${cells.length} ${box}`);
}
const allFront = [...front.values()].flat();
const mine = L.filter((f) => f.n === N);
const foes = L.filter((f) => w.wars.atWar(N, f.n));
const groups = new Map<string, { n: number; men: number; what: Map<string, number>; front: number; foe: number }>();
for (const f of mine) {
  const k = `${Math.round(f.x / 5) * 5},${Math.round(f.y / 5) * 5}`;
  const what = c.engaged[f.id] === 1 ? 'engaged' : c.moving[f.id] === 1 ? (w.wars.atWar(N, ctl[c.targetCell[f.id]!]!) ? 'attack' : 'hold') : 'stand';
  let fr = Infinity;
  for (const k2 of allFront) fr = Math.min(fr, d2(f.x, f.y, (k2 % cw) + 0.5, Math.floor(k2 / cw) + 0.5));
  let fo = Infinity;
  for (const g of foes) fo = Math.min(fo, d2(f.x, f.y, g.x, g.y));
  const gr = groups.get(k) ?? { n: 0, men: 0, what: new Map(), front: fr, foe: fo };
  gr.n++;
  gr.men += c.strength[f.id]!;
  gr.what.set(what, (gr.what.get(what) ?? 0) + 1);
  groups.set(k, gr);
}
for (const [k, g] of [...groups].sort((a, b) => b[1].n - a[1].n))
  console.log(`  at ${k}: ${g.n} (${g.men} men) ${JSON.stringify(Object.fromEntries(g.what))} front ${g.front.toFixed(0)} foe ${g.foe.toFixed(0)}`);
const daily: string[] = [];
for (let d = 0; d < days; d++) {
  s.step(24, quiet);
  const now = land();
  const fz = now.filter((f) => w.wars.atWar(N, f.n));
  let eng = 0;
  let near = 0;
  let n = 0;
  for (const f of now) {
    if (f.n !== N) continue;
    n++;
    if (c.engaged[f.id] === 1) eng++;
    if (fz.some((g) => d2(f.x, f.y, g.x, g.y) <= 12)) near++;
  }
  daily.push(`${eng}/${near}/${n}`);
}
console.log(`daily engaged/near12/formations: ${daily.join(' ')}`);

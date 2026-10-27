/**
 * PLAN 7.140, from a save: at each peace with a score of WHITE_PEACE or more (a decisive one), each
 * loser's land on landmasses other than its capital's (`grid.component`) held by it and with no land
 * formation of its own on that landmass, in cells, read the day the peace is signed. What a treaty
 * that took a beaten nation's undefended overseas land would move. Also, per year, the top five.
 * Each such piece (a landmass's part) is given, as a trial, to the winner holding a cell within
 * REACH cells of it (the nearest by 16-cell blocks, the lower id on a tie) that holds under CAP of
 * the land; none so, it stays. Whether the top five by cells would then differ from the day's.
 *
 * Usage: npx tsx tools/diag/peaceOverseas.ts <save.bin> <years> [out.json] [reach = 64] [cap = 0.25]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { WHITE_PEACE } from '../../src/sim/systems/war';
import { capitalCell } from '../../src/sim/systems/capitals';
import { navOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const bin = process.argv[2]!;
const years = Number(process.argv[3] ?? 10);
const out = process.argv[4];
const REACH = Number(process.argv[5] ?? 64);
const CAP = Number(process.argv[6] ?? 0.25);
const B = 16;
const s = new Sim({ scenario: '1938', seed: 1, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin)));
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? w.names.get(n) ?? `#${n}`;
const comp = navOf(w).grid.component;
const W = w.cells.w;

/** n's held cells by landmass off its capital's, with no land formation of n on that landmass. */
const overseas = (n: number): { cells: number; masses: number; by: Map<number, number> } => {
  const cap = capitalCell(w, n);
  const home = cap >= 0 ? comp[cap]! : 0;
  const by = new Map<number, number>();
  const { owner, controller } = w.cells;
  for (let i = 0; i < owner.length; i++) {
    if (controller[i] !== n || owner[i] !== n) continue;
    const k = comp[i]!;
    if (k === 0 || k === home) continue;
    by.set(k, (by.get(k) ?? 0) + 1);
  }
  const fc = w.formations.cols;
  w.formations.forEach((id) => {
    if (fc.nation[id] !== n || w.isFleet(id) || w.isWing(id) || w.embarked.has(id)) return;
    by.delete(comp[Math.floor(fc.y[id]!) * W + Math.floor(fc.x[id]!)]!);
  });
  let cells = 0;
  for (const v of by.values()) cells += v;
  return { cells, masses: by.size, by };
};
const top5 = (held: Map<number, number>): string =>
  [...held].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 5).map((e) => e[0]).sort((a, b) => a - b).join();
/** The trial's transfer at a peace: receiver per piece, and whether the five change. */
const trial = (winners: number[], losers: { n: number; by: Map<number, number> }[]): { gives: string[]; changes: boolean; moved: number } => {
  const { controller } = w.cells;
  const bw = Math.ceil(W / B);
  const bh = Math.ceil(w.cells.h / B);
  const held = new Map<number, number>();
  for (let i = 0; i < controller.length; i++) if (controller[i]) held.set(controller[i]!, (held.get(controller[i]!) ?? 0) + 1);
  const land = 627843;
  const inW = new Set(winners.filter((m) => w.nations.cols.living[m] === 1 && (held.get(m) ?? 0) < CAP * land));
  // Blocks: which winners hold a cell there; which loser masses touch it.
  const wb = new Map<number, Set<number>>();
  const mb = new Map<string, Set<number>>();
  const lset = new Map(losers.map((l) => [l.n, l.by]));
  for (let i = 0; i < controller.length; i++) {
    const k = controller[i]!;
    const blk = Math.floor(Math.floor(i / W) / B) * bw + Math.floor((i % W) / B);
    if (inW.has(k)) (wb.get(blk) ?? wb.set(blk, new Set()).get(blk)!).add(k);
    const by = lset.get(k);
    if (by && w.cells.owner[i] === k && by.has(comp[i]!)) {
      const key = `${k}:${comp[i]}`;
      (mb.get(key) ?? mb.set(key, new Set()).get(key)!).add(blk);
    }
  }
  const R = Math.ceil(REACH / B);
  const gives: string[] = [];
  let moved = 0;
  for (const [key, blks] of mb) {
    let best = 0;
    let bestD = Infinity;
    for (const blk of blks) {
      const bx = blk % bw;
      const by = Math.floor(blk / bw);
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const x = (bx + dx + bw) % bw;
          const y = by + dy;
          if (y < 0 || y >= bh) continue;
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          for (const m of wb.get(y * bw + x) ?? []) if (d < bestD || (d === bestD && m < best)) [best, bestD] = [m, d];
        }
      }
    }
    if (best === 0) continue;
    const [ln, mass] = key.split(':').map(Number) as [number, number];
    const cells = lset.get(ln)!.get(mass)!;
    held.set(ln, held.get(ln)! - cells);
    held.set(best, (held.get(best) ?? 0) + cells);
    moved += cells;
    gives.push(`${tag(ln)}->${tag(best)} ${cells}`);
  }
  const now = new Map<number, number>();
  for (let i = 0; i < controller.length; i++) if (controller[i]) now.set(controller[i]!, (now.get(controller[i]!) ?? 0) + 1);
  return { gives, changes: top5(now) !== top5(held), moved };
};

type Peace = { day: number; score: number; winners: string[]; losers: { n: string; cells: number; masses: number }[]; gives: string[]; changes: boolean; moved: number };
const peaces: Peace[] = [];
const tops: string[][] = [];
for (let d = 0; d < 365 * years; d++) {
  const before = w.wars.list.map((war) => ({ war, score: war.score, sides: [war.sides[0].slice(), war.sides[1].slice()] }));
  s.step(24, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  for (const b of before) {
    if (w.wars.list.includes(b.war)) continue;
    const score = Math.abs(b.war.score);
    if (score < WHITE_PEACE) continue;
    const win = b.war.score >= 0 ? 0 : 1;
    const ls = b.sides[1 - win]!.filter((n) => w.nations.cols.living[n] === 1).map((n) => ({ n, ...overseas(n) })).filter((l) => l.cells > 0);
    const t = ls.length > 0 ? trial(b.sides[win]!, ls) : { gives: [], changes: false, moved: 0 };
    const losers = ls.map((l) => ({ n: tag(l.n), cells: l.cells, masses: l.masses }));
    peaces.push({ day: Math.floor(w.tick / 24), score: Math.round(score), winners: b.sides[win]!.map(tag), losers, ...t });
  }
  if ((d + 1) % 365 === 0) {
    const held = new Map<number, number>();
    const ctl = w.cells.controller;
    for (let i = 0; i < ctl.length; i++) if (ctl[i]) held.set(ctl[i]!, (held.get(ctl[i]!) ?? 0) + 1);
    tops.push([...held].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 6).map(([n, c]) => `${tag(n)} ${c}`));
  }
}
const decisive = peaces.length;
const withLand = peaces.filter((p) => p.losers.length > 0);
const cells = withLand.reduce((a, p) => a + p.losers.reduce((b, l) => b + l.cells, 0), 0);
const moved = withLand.reduce((a, p) => a + p.moved, 0);
const changes = withLand.filter((p) => p.changes).length;
const text = JSON.stringify({ bin, years, REACH, CAP, decisive, withLand: withLand.length, cells, moved, changes, peaces: withLand, tops }, null, 1);
if (out) writeFileSync(out, text);
process.stdout.write(`done: ${bin} decisive ${decisive} withOverseas ${withLand.length} cells ${cells} moved ${moved} fiveChanges ${changes}\n`);

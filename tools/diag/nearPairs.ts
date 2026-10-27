/**
 * PLAN 7.138: the pairs of a long-front war that stand near and do not fight. For each war with a
 * land front of at least MIN_FRONT cells, hour 12 of each day read: each land formation of its weak
 * side (by the side's men on land) within NEAR cells (4-neighbour steps) of the front, not engaged,
 * and the nearest formation of the strong side (straight cells) within PAIR cells, not engaged; the
 * pair classified:
 * - `retreat`: one of them on the retreat;
 * - `water`: on two landmasses;
 * - `bothStill`: neither under way (a standoff: each holds);
 * - `strongCloses` / `strongAway`: the strong one under way to a cell nearer the weak one than it
 *   stands, or not (to an enemy cell: `strongAttack…`, to its side's: `strongShift…`);
 * - `weakMoves`: the strong one still, the weak one under way.
 * Per class a war-day, the pairs' mean gap and the strong one's org; of the strong ones under way,
 * by the march's length (6 cells or less: short), the sector buckets from its target to the weak
 * one (0–3+) and the men's ratio strong ÷ weak. The gaps are straight (no looping map), and a pair
 * across a strait with one on the retreat counts as `retreat`.
 *
 * Usage: npx tsx tools/diag/nearPairs.ts <out.json> <days> <seed:state.bin|seed:1938:skipDays> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SECTOR_CELLS } from '../../src/sim/ai/operational';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import { navOf, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const MIN_FRONT = 100;
const NEAR = 10;
const PAIR = 12;

const out = process.argv[2]!;
const days = Number(process.argv[3]);
const cases = process.argv.slice(4).map((a) => {
  const [seed, bin, skip] = a.split(':');
  return { seed: Number(seed), bin: bin!, skip: Number(skip ?? 0) };
});

function frontCells(w: World): Map<number, number[]> {
  const { w: W, h, controller } = w.cells;
  const nb: number[] = [];
  const list = w.wars.list;
  const cells = new Map<number, number[]>();
  for (const c of frontierOf(w)) {
    const a = controller[c]!;
    if (a === 0) continue;
    const hit = new Set<number>();
    for (const q of neighbours4(c, W, h, w.settings.loopingMap, nb)) {
      const b = controller[q]!;
      if (b === 0 || b === a || !w.wars.atWar(a, b)) continue;
      for (let i = 0; i < list.length; i++) {
        const s = list[i]!.sides;
        if ((s[0].includes(a) && s[1].includes(b)) || (s[1].includes(a) && s[0].includes(b))) hit.add(i);
      }
    }
    for (const i of hit) (cells.get(i) ?? cells.set(i, []).get(i)!).push(c);
  }
  return cells;
}

function distance(w: World, src: readonly number[], d: Uint8Array, far: number): void {
  d.fill(255);
  const { w: W, h } = w.cells;
  const nb: number[] = [];
  let q = src.slice();
  for (const c of q) d[c] = 0;
  for (let k = 1; k <= far && q.length > 0; k++) {
    const next: number[] = [];
    for (const c of q)
      for (const n of neighbours4(c, W, h, w.settings.loopingMap, nb))
        if (d[n] === 255) {
          d[n] = k;
          next.push(n);
        }
    q = next;
  }
}

const result: unknown[] = [];
for (const { seed, bin, skip } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  if (bin !== '1938') s.load(new Uint8Array(readFileSync(bin)));
  const w = s.world;
  const quiet = (ww: World): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  for (let d = 0; d < skip; d++) s.step(24, quiet);
  const dist = new Uint8Array(w.cells.w * w.cells.h);
  const count: Record<string, number> = {};
  const gap: Record<string, number> = {};
  const org: Record<string, number> = {};
  const detail: Record<string, number> = {};
  let warDays = 0;
  let weakNear = 0;
  for (let day = 0; day < days; day++) {
    s.step(12, quiet);
    const c = w.formations.cols;
    const comp = navOf(w).grid.component;
    const { w: W, controller } = w.cells;
    for (const [i, cells] of frontCells(w)) {
      if (cells.length < MIN_FRONT) continue;
      const war = w.wars.list[i]!;
      warDays++;
      distance(w, cells, dist, NEAR);
      const sideOf = (n: number): number => (war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1);
      const ids: number[] = [];
      const men = [0, 0];
      w.formations.forEach((id) => {
        if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id) || w.offLand(id)) return;
        const sd = sideOf(c.nation[id]!);
        if (sd < 0) return;
        ids.push(id);
        men[sd]! += c.strength[id]!;
      });
      const weak = men[0]! <= men[1]! ? 0 : 1;
      const cellOf = (id: number): number => Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!);
      for (const id of ids) {
        if (sideOf(c.nation[id]!) !== weak || c.engaged[id] === 1 || dist[cellOf(id)]! > NEAR) continue;
        weakNear++;
        let best = -1;
        let bd = Infinity;
        for (const o of ids) {
          if (sideOf(c.nation[o]!) === weak || c.engaged[o] === 1) continue;
          const d = Math.hypot(c.x[o]! - c.x[id]!, c.y[o]! - c.y[id]!);
          if (d < bd) {
            bd = d;
            best = o;
          }
        }
        if (best < 0 || bd > PAIR) continue;
        let k: string;
        if (c.retreat[id] !== 0 || c.retreat[best] !== 0) k = 'retreat';
        else if (comp[cellOf(id)] !== comp[cellOf(best)]) k = 'water';
        else if (c.moving[best] === 1) {
          const t = c.targetCell[best]!;
          const td = Math.hypot((t % W) + 0.5 - c.x[id]!, Math.floor(t / W) + 0.5 - c.y[id]!);
          const enemyCell = sideOf(controller[t]!) === weak;
          k = `strong${enemyCell ? 'Attack' : 'Shift'}${td < bd ? 'Closes' : 'Away'}`;
          // The strong one's march: its length, the sector buckets between its target and the weak
          // one, and the men's ratio (PLAN 7.138's standoff read).
          const sx = Math.round(w.atSize(SECTOR_CELLS));
          const len = Math.hypot((t % W) + 0.5 - c.x[best]!, Math.floor(t / W) + 0.5 - c.y[best]!);
          const buckets = Math.max(Math.abs(Math.floor((t % W) / sx) - Math.floor(c.x[id]! / sx)), Math.abs(Math.floor(Math.floor(t / W) / sx) - Math.floor(c.y[id]! / sx)));
          const ratio = c.strength[best]! / Math.max(1, c.strength[id]!);
          const sub = `${k} ${len <= 6 ? 'short' : 'long'} b${Math.min(buckets, 3)} r${ratio < 1 / 1.5 ? '<0.67' : ratio <= 1.5 ? '0.67-1.5' : '>1.5'}`;
          detail[sub] = (detail[sub] ?? 0) + 1;
        } else k = c.moving[id] === 1 ? 'weakMoves' : 'bothStill';
        count[k] = (count[k] ?? 0) + 1;
        gap[k] = (gap[k] ?? 0) + bd;
        org[k] = (org[k] ?? 0) + c.org[best]!;
      }
    }
    s.step(12, quiet);
  }
  const r = (x: number): number => Math.round(x * 100) / 100;
  const wd = Math.max(1, warDays);
  const row = {
    seed,
    bin,
    warsADay: r(warDays / days),
    weakNearFree: r(weakNear / wd),
    detail: Object.fromEntries(Object.entries(detail).sort().map(([k, v]) => [k, r(v / wd)])),
    pairs: Object.fromEntries(Object.entries(count).sort().map(([k, v]) => [k, { aWar: r(v / wd), gap: r(gap[k]! / v), strongOrg: r(org[k]! / v) }])),
  };
  result.push(row);
  process.stderr.write(JSON.stringify(row) + '\n');
}
writeFileSync(out, JSON.stringify(result, null, 1));

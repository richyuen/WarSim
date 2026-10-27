/**
 * PLAN 7.138: where the land army of a war with a long front stands, side by side. For each war
 * with a land front of at least MIN_FRONT cells (the cells of either side next to a cell of the
 * other's), hour 12 of each day read, each land formation of a nation of either side (not a fleet,
 * a wing, aboard), its side weak or strong by the side's men on land, in one bucket:
 * - `engaged`: in a battle (this war's or another's);
 * - `near`: within NEAR cells (4-neighbour steps) of the war's front; `mid`: within DEPLOY_RANGE_CELLS;
 * - beyond, its nation holding front cells of the war (`fronted`) and a cell of them on its
 *   landmass: `cutStill` / `cutMoving` where it reaches none of its nation's front cells nor its
 *   side's beside an enemy (`frontReach`: another group of provinces, a pocket), else `farStill` /
 *   `farMoving` (it reaches one and stands beyond the range);
 * - beyond, its nation holding no front cell of the war: `allyLand` on a landmass with a front cell
 *   of its side, else `allyAway`;
 * - `away`: a fronted nation's, on a landmass with no front cell of its own.
 * Per case the buckets a war-day by side; and of the `near`, by the straight cells to the nearest
 * formation of the other side (GAPS bands, then beyond), a war-day by side.
 *
 * Usage: npx tsx tools/diag/warArmy.ts <out.json> <days> <seed:state.bin|seed:1938:skipDays> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { frontReach } from '../../src/sim/ai/invasion';
import { DEPLOY_RANGE_CELLS } from '../../src/sim/ai/operational';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { passageOf } from '../../src/sim/systems/movement';
import { frontierOf } from '../../src/sim/systems/territory';
import { navOf, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const MIN_FRONT = 100;
const NEAR = 10;
/** The straight cells from a near formation not engaged to the nearest of the other side's, by band. */
const GAPS = [3, 6, 12, 30, 60] as const;
const BUCKETS = ['engaged', 'near', 'mid', 'cutStill', 'cutMoving', 'farStill', 'farMoving', 'allyLand', 'allyAway', 'away'] as const;
type Bucket = (typeof BUCKETS)[number];

const out = process.argv[2]!;
const days = Number(process.argv[3]);
const cases = process.argv.slice(4).map((a) => {
  const [seed, bin, skip] = a.split(':');
  return { seed: Number(seed), bin: bin!, skip: Number(skip ?? 0) };
});

/** Each war's front cells today, by index into `wars.list`. */
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

/** Steps from the nearest of `src`, up to `far` (255 beyond). */
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
  const range = Math.round(w.atSize(DEPLOY_RANGE_CELLS));
  const sum = { weak: Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, number>, strong: Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, number> };
  const gaps = { weak: GAPS.map(() => 0).concat([0]), strong: GAPS.map(() => 0).concat([0]) };
  let warDays = 0;
  let front = 0;
  for (let day = 0; day < days; day++) {
    s.step(12, quiet);
    const c = w.formations.cols;
    const comp = navOf(w).grid.component;
    const { w: W, controller } = w.cells;
    for (const [i, cells] of frontCells(w)) {
      if (cells.length < MIN_FRONT) continue;
      const war = w.wars.list[i]!;
      warDays++;
      front += cells.length;
      distance(w, cells, dist, range);
      const sideOf = (n: number): number => (war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1);
      // By nation: its front cells of this war; by side: the landmasses of its front cells.
      const own = new Map<number, number[]>();
      const sideLands = [new Set<number>(), new Set<number>()];
      for (const k of cells) {
        const o = controller[k]!;
        (own.get(o) ?? own.set(o, []).get(o)!).push(k);
        sideLands[sideOf(o)]!.add(comp[k]!);
      }
      const reach = new Map<number, (cell: number) => boolean>();
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
      for (const id of ids) {
        const n = c.nation[id]!;
        const sd = sideOf(n);
        const cell = Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!);
        const d = dist[cell]!;
        let b: Bucket;
        if (c.engaged[id] === 1) b = 'engaged';
        else if (d <= NEAR) b = 'near';
        else if (d <= range) b = 'mid';
        else if (!own.has(n)) b = sideLands[sd]!.has(comp[cell]!) ? 'allyLand' : 'allyAway';
        else if (!own.get(n)!.some((k) => comp[k] === comp[cell])) b = 'away';
        else {
          let r = reach.get(n);
          if (!r) reach.set(n, (r = frontReach(w, n, own.get(n)!, passageOf(w, n))));
          const moving = c.moving[id] === 1;
          b = r(cell) ? (moving ? 'farMoving' : 'farStill') : moving ? 'cutMoving' : 'cutStill';
        }
        sum[sd === weak ? 'weak' : 'strong'][b]++;
        if (b !== 'near') continue;
        let best = Infinity;
        for (const o of ids) if (sideOf(c.nation[o]!) !== sd) best = Math.min(best, Math.hypot(c.x[o]! - c.x[id]!, c.y[o]! - c.y[id]!));
        const k = GAPS.findIndex((g) => best <= g);
        gaps[sd === weak ? 'weak' : 'strong'][k < 0 ? GAPS.length : k]!++;
      }
    }
    s.step(12, quiet);
  }
  const r = (x: number): number => Math.round(x * 100) / 100;
  const per = (o: Record<Bucket, number>): Record<string, number> => Object.fromEntries(BUCKETS.map((b) => [b, r(o[b] / Math.max(1, warDays))]));
  const row = { seed, bin, day: Math.floor(w.tick / 24), warsADay: r(warDays / days), frontAWar: Math.round(front / Math.max(1, warDays)), weak: per(sum.weak), strong: per(sum.strong), gapWeak: gaps.weak.map((x) => r(x / Math.max(1, warDays))), gapStrong: gaps.strong.map((x) => r(x / Math.max(1, warDays))) };
  result.push(row);
  process.stderr.write(JSON.stringify(row) + '\n');
}
writeFileSync(out, JSON.stringify(result, null, 1));

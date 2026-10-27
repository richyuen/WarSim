/**
 * PLAN 7.138: where the land army at war stands. From a saved state (or 1938 after `skip` days), per
 * land formation of a nation at war (not a fleet, a wing or aboard): whether an enemy of its nation
 * controls a cell on its landmass (the nav grid's component), and its distance on that landmass to the
 * nearest such cell (4-connected steps over passable cells, cut at 400): within the deploy range
 * (`DEPLOY_RANGE_CELLS` at the map's size), 1–3 ranges, farther. Per nation at war: its formations so,
 * whether it fights a war where it has any enemy on its landmasses, and engaged.
 *
 * Usage: npx tsx tools/diag/farArmy.ts <out.json> <seed:state.bin|seed:1938:skipDays> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { DEPLOY_RANGE_CELLS } from '../../src/sim/ai/operational';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const cases = process.argv.slice(3).map((a) => {
  const [seed, bin, skip] = a.split(':');
  return { seed: Number(seed), bin: bin!, skip: Number(skip ?? 0) };
});
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const res: unknown[] = [];
for (const k of cases) {
  const s = new Sim({ scenario: '1938', seed: k.seed, assets: loadAssets1938(SIZE_1938.w) });
  const w = s.world;
  if (k.bin !== '1938') s.load(new Uint8Array(readFileSync(k.bin)));
  for (let d = 0; d < k.skip; d++) s.step(24, (ww) => ((ww.out.events.length = 0), (ww.out.fires.length = 0)));
  const nav = navOf(w).grid;
  const comp = nav.component;
  const W = w.cells.w;
  const H = w.cells.h;
  const range = w.atSize(DEPLOY_RANGE_CELLS);
  const ctl = w.cells.controller;
  const c = w.formations.cols;
  const fighting = w.wars.nations();
  const byNation = new Map<number, number[]>();
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id) || w.offLand(id)) return;
    const n = c.nation[id]!;
    if (!fighting.has(n)) return;
    (byNation.get(n) ?? byNation.set(n, []).get(n)!).push(id);
  });
  const dist = new Int32Array(W * H);
  const q = new Int32Array(W * H);
  const tot = { formations: 0, men: 0, noEnemyLand: 0, noEnemyLandMen: 0, inRange: 0, r1to3: 0, farther: 0, engaged: 0, inRangeEngaged: 0 };
  const nations: unknown[] = [];
  for (const [n, ids] of byNation) {
    const foes = new Set<number>();
    w.wars.list.forEach((war) => {
      const side = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
      if (side >= 0) war.sides[1 - side]!.forEach((e) => foes.add(e));
    });
    // Multi-source BFS from enemy-held passable cells.
    dist.fill(-1);
    let qh = 0;
    let qt = 0;
    const foeComps = new Set<number>();
    for (let i = 0; i < ctl.length; i++)
      if (comp[i] !== 0 && foes.has(ctl[i]!)) {
        dist[i] = 0;
        q[qt++] = i;
        foeComps.add(comp[i]!);
      }
    while (qh < qt) {
      const i = q[qh++]!;
      if (dist[i]! >= 400) continue;
      const y = Math.floor(i / W);
      const x = i - y * W;
      const nb = [y > 0 ? i - W : -1, y < H - 1 ? i + W : -1, x > 0 ? i - 1 : w.settings.loopingMap ? i + W - 1 : -1, x < W - 1 ? i + 1 : w.settings.loopingMap ? i - W + 1 : -1];
      for (const j of nb) {
        if (j < 0 || comp[j] === 0 || dist[j] !== -1) continue;
        dist[j] = dist[i]! + 1;
        q[qt++] = j;
      }
    }
    const row = { tag: tag(n), n, formations: ids.length, men: 0, noEnemyLand: 0, inRange: 0, r1to3: 0, farther: 0, engaged: 0 };
    for (const id of ids) {
      const cell = Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!);
      const men = c.strength[id]!;
      row.men += men;
      tot.formations++;
      tot.men += men;
      if (c.engaged[id]) {
        row.engaged++;
        tot.engaged++;
      }
      if (!foeComps.has(comp[cell]!)) {
        row.noEnemyLand++;
        tot.noEnemyLand++;
        tot.noEnemyLandMen += men;
        continue;
      }
      const d = dist[cell]!;
      if (d >= 0 && d <= range) {
        row.inRange++;
        tot.inRange++;
        if (c.engaged[id]) tot.inRangeEngaged++;
      } else if (d >= 0 && d <= 3 * range) {
        row.r1to3++;
        tot.r1to3++;
      } else {
        row.farther++;
        tot.farther++;
      }
    }
    nations.push(row);
  }
  nations.sort((a, b) => (b as { formations: number }).formations - (a as { formations: number }).formations);
  const r = { seed: k.seed, bin: k.bin, skip: k.skip, day: Math.floor(w.tick / 24), range, wars: w.wars.list.length, tot, nations: nations.slice(0, 25) };
  res.push(r);
  process.stdout.write(JSON.stringify({ seed: k.seed, bin: k.bin, skip: k.skip, range, wars: r.wars, tot }) + '\n');
}
writeFileSync(out, JSON.stringify(res, null, 1));

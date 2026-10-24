/**
 * PLAN 7.104a: what a threatened sector short of OFFENSIVE_RATIO × its threat could draw from the
 * spare range (SPARE_RANGES × DEPLOY_RANGE_CELLS). From saved states, over some days, at each plan
 * (`OP_PROBE.sectors`): the threatened sectors, those short (strength under OFFENSIVE_RATIO ×
 * threat), and the planner's land formations (not engaged, not aboard) by the straight cells to the
 * nearest short sector's centre: within the range, beyond it within the spare range, beyond that;
 * and of those within the spare range, the ones standing or holding a sector with no threat (not on
 * the march to an enemy cell). Summed per save, and per plan with a short sector.
 *
 * Usage: npx tsx tools/diag/spareHot.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { DEPLOY_RANGE_CELLS, OFFENSIVE_RATIO, OP_PROBE, SPARE_RANGES, type SectorsSeen } from '../../src/sim/ai/operational';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3]);
const rows: unknown[] = [];
for (const a of process.argv.slice(4)) {
  const seed = Number(a.slice(0, a.indexOf(':')));
  const src = a.slice(a.indexOf(':') + 1);
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  if (src !== '1938') s.load(new Uint8Array(readFileSync(src)));
  const w: World = s.world;
  const t = { plans: 0, withShort: 0, hot: 0, short: 0, inRange: 0, inSpare: 0, inSpareFree: 0, beyond: 0, formations: 0 };
  OP_PROBE.sectors = (p: SectorsSeen) => {
    t.plans++;
    const hot = p.sectors.filter((x) => x.threat > 0);
    const short = hot.filter((x) => x.strength < OFFENSIVE_RATIO * x.threat);
    t.hot += hot.length;
    t.short += short.length;
    if (short.length === 0) return;
    t.withShort++;
    const c = w.formations.cols;
    const cw = w.cells.w;
    const loop = w.settings.loopingMap;
    const range = w.atSize(DEPLOY_RANGE_CELLS);
    w.formations.forEach((id) => {
      if (c.nation[id] !== p.nation || w.isFleet(id) || w.isWing(id) || w.offLand(id) || c.engaged[id] === 1) return;
      t.formations++;
      let best = Infinity;
      for (const x of short) {
        let dx = Math.abs(c.x[id]! - x.cx);
        if (loop && dx > cw / 2) dx = cw - dx;
        best = Math.min(best, Math.hypot(dx, c.y[id]! - x.cy));
      }
      if (best <= range) t.inRange++;
      else if (best <= SPARE_RANGES * range) {
        t.inSpare++;
        const attacking = c.moving[id] === 1 && w.wars.atWar(p.nation, w.cells.controller[c.targetCell[id]!]!);
        if (!attacking) t.inSpareFree++;
      } else t.beyond++;
    });
  };
  for (let d = 0; d < days; d++)
    s.step(24, (ww) => {
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
  const per = (v: number): number => (t.withShort > 0 ? Math.round((v / t.withShort) * 100) / 100 : 0);
  const row = { seed, src, days, ...t, perShortPlan: { short: per(t.short), inRange: per(t.inRange), inSpare: per(t.inSpare), inSpareFree: per(t.inSpareFree), beyond: per(t.beyond) } };
  rows.push(row);
  process.stderr.write(`${seed} ${src}: plans ${t.plans} with short ${t.withShort}; a short plan: ${JSON.stringify(row.perShortPlan)}\n`);
}
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`done: ${rows.length} -> ${out}`);

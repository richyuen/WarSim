/**
 * PLAN 7.79a: how a nation at war spreads its army over its front's sectors. From a saved state
 * (or `1938`, with `--skip` days first), for `days` days, every plan's sectors at its orders
 * (`OP_PROBE.sectors`): per plan the sectors, those with a threat (enemy formations in the 3 × 3
 * sector neighbourhood), the formations allotted, and of them in threatened sectors before and
 * after "every sector gets one"; the threatened sectors manned and attacking. Summed per save,
 * with the engaged land formations and the wars a day.
 *
 * Usage: npx tsx tools/diag/frontSpread.ts <out.json> <days> <seed:state.bin|seed:1938:skipDays> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { OP_PROBE, type SectorsSeen } from '../../src/sim/ai/operational';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3]);
const cases = process.argv.slice(4).map((a) => {
  const [seed, bin, skip] = a.split(':');
  return { seed: Number(seed), bin: bin!, skip: Number(skip ?? 0) };
});
let plans: SectorsSeen[] = [];
OP_PROBE.sectors = (p) => plans.push(p);
const result: unknown[] = [];
for (const { seed, bin, skip } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  if (bin !== '1938') s.load(new Uint8Array(readFileSync(bin)));
  const w = s.world;
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  for (let d = 0; d < skip; d++) s.step(24, quiet);
  const t = {
    plans: 0,
    sectors: 0,
    threatened: 0,
    formations: 0,
    inThreatened: 0,
    threatenedManned: 0,
    threatenedAttack: 0,
    attackAll: 0,
    classes: 0,
    thin: 0,
    before: 0,
    after: 0,
    classIds: 0,
    engaged: 0,
    wars: 0,
    landAtWar: 0,
  };
  for (let d = 0; d < days; d++) {
    plans = [];
    s.step(24, quiet);
    for (const p of plans) {
      t.plans++;
      t.sectors += p.sectors.length;
      for (const x of p.sectors) {
        t.formations += x.n;
        if (x.attack) t.attackAll++;
        if (x.threat <= 0) continue;
        t.threatened++;
        t.inThreatened += x.n;
        if (x.n > 0) t.threatenedManned++;
        if (x.attack) t.threatenedAttack++;
      }
      for (const c of p.classes) {
        t.classes++;
        t.classIds += c.ids;
        if (c.ids < c.front) t.thin++;
        t.before += c.before;
        t.after += c.after;
      }
    }
    const fighting = w.wars.nations();
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
      if (!fighting.has(w.formations.cols.nation[id]!)) return;
      t.landAtWar++;
      if (w.formations.cols.engaged[id] === 1) t.engaged++;
    });
    t.wars += w.wars.list.length;
  }
  const r = (x: number): number => Math.round(x * 1000) / 1000;
  const row = {
    seed,
    bin,
    skip,
    day: Math.floor(w.tick / 24),
    plansADay: r(t.plans / days),
    sectorsAPlan: r(t.sectors / t.plans),
    threatenedAPlan: r(t.threatened / t.plans),
    formationsAPlan: r(t.formations / t.plans),
    shareInThreatened: r(t.inThreatened / t.formations),
    threatenedManned: r(t.threatenedManned / t.threatened),
    threatenedAttack: r(t.threatenedAttack / t.threatened),
    classesThin: r(t.thin / t.classes),
    allottedThreatenedBefore: r(t.before / t.classIds),
    allottedThreatenedAfter: r(t.after / t.classIds),
    engagedADay: r(t.engaged / days),
    warsADay: r(t.wars / days),
    engagedAWar: r(t.engaged / Math.max(1, t.wars)),
    landAtWarADay: r(t.landAtWar / days),
  };
  result.push(row);
  process.stderr.write(`${JSON.stringify(row)}\n`);
}
writeFileSync(out, JSON.stringify(result, null, 1));
console.log(`done: ${result.length} saves -> ${out}`);

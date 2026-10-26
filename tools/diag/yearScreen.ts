/**
 * PLAN 7.129's AT screen: a 1938 run of `years` years from the start, each year's mean tick (ms, each
 * hour timed as `tools/headless/runner.ts` times it) and its land contact as `contactYears.ts`
 * counts it (engaged land formations at hour 12 of each day, the year's mean); the state saved at
 * the end of each year from `saveFrom` on (`<dir>/<seed>_y<year>.bin`), so that a year over the
 * budget is read again alone from the year before (`npm run sim -- --load … --years 1`). The
 * contact read sits between two timed hours, outside them. Writes `<dir>/<seed>.json`.
 *
 * Usage: npx tsx tools/diag/yearScreen.ts <seed> <years> <dir> [affinity mask] [saveFrom = 1]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import { parseAffinity, pinProcess } from '../headless/affinity';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3]);
const dir = process.argv[4]!;
const mask = process.argv[5];
const saveFrom = Number(process.argv[6] ?? 1);
if (mask !== undefined && mask !== '-') pinProcess(parseAffinity(mask));
mkdirSync(dir, { recursive: true });
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(size1938(undefined).w) });
const w = sim.world;
const clear = (ww: World): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
const engagedNow = (ww: World): number => {
  let e = 0;
  const c = ww.formations.cols;
  ww.formations.forEach((id) => {
    if (!ww.isFleet(id) && !ww.isWing(id) && !ww.embarked.has(id) && c.engaged[id]) e++;
  });
  return e;
};
const rows: { year: number; tickMs: number; engaged: number; hash: string }[] = [];
for (let y = 1; y <= years; y++) {
  let ms = 0;
  let eng = 0;
  for (let d = 0; d < 365; d++) {
    for (let h = 0; h < 24; h++) {
      const t0 = performance.now();
      sim.step(1, clear);
      ms += performance.now() - t0;
      if (h === 11) eng += engagedNow(w);
    }
  }
  const row = { year: y, tickMs: ms / (365 * 24), engaged: eng / 365, hash: (sim.hash() >>> 0).toString(16).padStart(8, '0') };
  rows.push(row);
  console.log(`${seed} year ${y}: tick ms ${row.tickMs.toFixed(3)}, engaged ${row.engaged.toFixed(2)}, hash ${row.hash}`);
  if (y >= saveFrom) writeFileSync(path.join(dir, `${seed}_y${y}.bin`), sim.save());
}
writeFileSync(path.join(dir, `${seed}.json`), JSON.stringify({ seed, years, rows }, null, 1));
console.log(`done: ${seed}`);

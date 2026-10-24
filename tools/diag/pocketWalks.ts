/**
 * PLAN 7.112's measure and AT: what `pocketOf` walks in a year from a saved state, and the land war
 * of that year. The cells walked a tick (`POCKET_PROBE`: calls, walks, cells over the year's ticks),
 * and daily after each day's 24 hours, as `armyAtWarAt.ts` samples: the wars running and the land
 * formations engaged of living nations at war; `perWar` = engaged over wars (a ratio of sums). The
 * state's hash at the end. (PLAN 7.112's rule, `docs/evidence/7.112/rule.patch`, adds `NOKEEP=1`:
 * every start walked afresh, the kept walks' check.)
 *
 * Usage: npx tsx tools/diag/pocketWalks.ts <state file> [days = 365] [out.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { POCKET_PROBE } from '../../src/sim/nav/grid';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const from = process.argv[2]!;
const days = Number(process.argv[3] ?? 365);
const out = process.argv[4];
const s = new Sim({ scenario: '1938', seed: 1, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(from)));
const w = s.world;
const quiet = (ww: World): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
POCKET_PROBE.calls = POCKET_PROBE.walks = POCKET_PROBE.cells = 0;
let wars = 0;
let engaged = 0;
const t0 = performance.now();
for (let d = 0; d < days; d++) {
  s.step(24, quiet);
  const atWar = w.wars.nations();
  const c = w.formations.cols;
  const nat = w.nations.cols;
  wars += w.wars.list.length;
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id)) return;
    const n = c.nation[id]!;
    if (w.offLand(id) || nat.living[n] !== 1 || !atWar.has(n)) return;
    if (c.engaged[id] === 1) engaged++;
  });
  if ((d + 1) % 30 === 0) process.stderr.write(`day ${d + 1}: cells a tick ${(POCKET_PROBE.cells / ((d + 1) * 24)).toFixed(1)}, engaged per war ${(wars > 0 ? engaged / wars : 0).toFixed(3)}\n`);
}
const ticks = days * 24;
const r = {
  from,
  days,
  calls: POCKET_PROBE.calls,
  walks: POCKET_PROBE.walks,
  cells: POCKET_PROBE.cells,
  cellsPerTick: POCKET_PROBE.cells / ticks,
  wars: wars / days,
  engagedPerWar: wars > 0 ? engaged / wars : 0,
  hash: (s.hash() >>> 0).toString(16).padStart(8, '0'),
  seconds: (performance.now() - t0) / 1000,
};
process.stdout.write(`${JSON.stringify(r)}\n`);
if (out) writeFileSync(out, `${JSON.stringify(r, null, 2)}\n`);

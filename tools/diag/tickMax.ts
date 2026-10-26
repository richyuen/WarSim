/**
 * PLAN 7.119: the longest single ticks of a stretch, headless, from a saved state: each hour stepped
 * and timed alone; the 12 longest with their hour of the day, day of the stretch and three costliest
 * systems (`Sim.profile`), and how many
 * ticks took over 50, 100 and 200 ms. Run pinned and alone (`start /affinity` or `--affinity` is not
 * here: run it with nothing else running).
 *
 * With `warm` the save is first stepped 10 days and loaded again: the engine's compiled code kept, the
 * world's as saved (to tell the engine's warm-up from the world's own).
 *
 * Usage: npx tsx tools/diag/tickMax.ts <seed> <state.bin> [hours = 8760] [warm]
 */
import { readFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const src = process.argv[3]!;
const hours = Number(process.argv[4] ?? 8760);
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(src)));
if (process.argv[5] === 'warm') {
  s.step(240, (w) => {
    w.out.events.length = 0;
    w.out.fires.length = 0;
  });
  s.load(new Uint8Array(readFileSync(src)));
}
const prof = s.profile(() => performance.now());
const t0 = s.world.tick;
const ticks: { ms: number; tick: number; by: string }[] = [];
for (let h = 0; h < hours; h++) {
  const before = prof.ms.slice();
  const a = performance.now();
  s.step(1, (w) => {
    w.out.events.length = 0;
    w.out.fires.length = 0;
  });
  const ms = performance.now() - a;
  const by =
    ms < 50
      ? ''
      : [...prof.ms]
          .map((v, i) => [prof.names[i]!, v - before[i]!] as const)
          .sort((x, y) => y[1] - x[1])
          .slice(0, 3)
          .map(([k, v]) => `${k} ${v.toFixed(1)}`)
          .join(', ');
  ticks.push({ ms, tick: s.world.tick - 1, by });
}
const over = (x: number): number => ticks.filter((t) => t.ms > x).length;
const mean = ticks.reduce((a, t) => a + t.ms, 0) / ticks.length;
ticks.sort((a, b) => b.ms - a.ms);
console.log(`seed ${seed} ${src}, ${hours} h: mean ${mean.toFixed(3)} ms, over 50 ms ${over(50)}, over 100 ms ${over(100)}, over 200 ms ${over(200)}`);
for (const t of ticks.slice(0, 12)) console.log(`  ${t.ms.toFixed(1)} ms  day ${Math.floor((t.tick - t0) / 24)} hour ${t.tick % 24}  ${t.by}`);
console.log('done:');

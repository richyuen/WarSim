/**
 * One formation, day by day from a saved state (PLAN 7.54's follow): its cell and holder, whether
 * it is under way, its path's step and length, the holder and terrain of the next cells of its
 * path, its supply, engaged, retreat and home, and the MoveRejected events it drew that day.
 *
 * Usage: npx tsx tools/diag/followFormation.ts <seed:state.bin> <id> <days>
 */
import { readFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const [seed, src] = process.argv[2]!.split(':');
const id = Number(process.argv[3]);
const days = Number(process.argv[4]);
const tag = (n: number): string => (n === 0 ? '-' : (TAGS_1938[n - 1] ?? `#${n}`));
const s = new Sim({ scenario: '1938', seed: Number(seed), assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
s.load(new Uint8Array(readFileSync(src!)));
const c = w.formations.cols;
const cw = w.cells.w;
for (let d = 0; d < days; d++) {
  const rejects: number[] = [];
  s.step(24, (ww) => {
    const ev = ww.out.events;
    for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.MoveRejected && ev[i + 2] === id) rejects.push(ev[i + 4]!);
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  if (!w.formations.has(id)) {
    console.log(`day ${d}: gone`);
    break;
  }
  const at = Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!);
  const p = w.paths.get(id);
  const step = c.pathStep[id]!;
  const next = p ? [...p.slice(step, step + 4)].map((k) => `${tag(w.cells.controller[k]!)}/${w.cells.terrain?.[k] ?? '?'}`).join(' ') : '';
  const end = p ? p[p.length - 1]! : -1;
  console.log(
    `day ${d}: at ${at % cw},${Math.floor(at / cw)} ${tag(w.cells.controller[at]!)} moving ${c.moving[id]} step ${step}/${p?.length ?? 0} frac ${c.stepFrac[id]!.toFixed(2)} end ${end % cw},${Math.floor(end / cw)} next ${next} supply ${c.supply[id]} eng ${c.engaged[id]} ret ${c.retreat[id]} home ${c.home[id]} rejects ${rejects.join(',')}`,
  );
}

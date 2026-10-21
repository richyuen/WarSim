/**
 * Which system re-orders a formation (PLAN 7.56's trace): from a saved state, the day and the
 * system after which formation `id`'s march target changes, over `days`.
 *
 * Usage: npx tsx tools/diag/whoOrders.ts <seed:state.bin> <id> <days>
 */
import { readFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const [seed, src] = process.argv[2]!.split(':');
const id = Number(process.argv[3]);
const days = Number(process.argv[4]);
const s = new Sim({ scenario: '1938', seed: Number(seed), assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
s.load(new Uint8Array(readFileSync(src!)));
const c = w.formations.cols;
const cw = w.cells.w;
const inner = s as unknown as { systems: ((world: World) => void)[]; systemNames: string[] };
let target = c.moving[id] === 1 ? c.targetCell[id]! : -1;
inner.systems = inner.systems.map((sys, i) => (world: World) => {
  sys(world);
  const t = world.formations.has(id) && c.moving[id] === 1 ? c.targetCell[id]! : -1;
  if (t !== target) {
    const at = Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!);
    console.log(`day ${(world.tick / 24).toFixed(2)} ${inner.systemNames[i]}: target ${target < 0 ? '-' : `${target % cw},${Math.floor(target / cw)}`} -> ${t < 0 ? '-' : `${t % cw},${Math.floor(t / cw)}`} at ${at % cw},${Math.floor(at / cw)} seaBound ${w.seaBound.has(id)}`);
    target = t;
  }
});
s.step(24 * days);
console.log('done:');

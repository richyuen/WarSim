/**
 * PLAN 7.129: one CPU profile over a span of hours after a load (`tickProf.ts` profiles single
 * ticks): the save is loaded, the hours before `from` stepped unprofiled, then `hours` hours stepped
 * under the inspector's profiler. Prints the top functions by self time and by total time.
 *
 * Usage: npx tsx tools/diag/spanProf.ts <seed> <state.bin> <from hour> <hours> [top = 40]
 */
import { readFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

interface Node {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  children?: number[];
}
interface Profile {
  nodes: Node[];
  samples: number[];
  timeDeltas: number[];
}

const seed = Number(process.argv[2]);
const src = process.argv[3]!;
const from = Number(process.argv[4]);
const hours = Number(process.argv[5]);
const top = Number(process.argv[6] ?? 40);
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(src)));
const clear = (w: typeof s.world): void => {
  w.out.events.length = 0;
  w.out.fires.length = 0;
};
if (from > 0) s.step(from, clear);
const session = new Session();
session.connect();
await session.post('Profiler.enable');
await session.post('Profiler.setSamplingInterval', { interval: 200 });
await session.post('Profiler.start');
const a = performance.now();
s.step(hours, clear);
const ms = performance.now() - a;
const { profile } = (await session.post('Profiler.stop')) as unknown as { profile: Profile };
session.disconnect();
report(ms, profile);

function report(ms: number, p: Profile): void {
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const parent = new Map<number, number>();
  for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const self = new Map<string, number>();
  const total = new Map<string, number>();
  const key = (n: Node): string => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.replace(/^.*\/src\//, 'src/')}:${n.callFrame.lineNumber + 1}`;
  for (let i = 0; i < p.samples.length; i++) {
    const dt = (p.timeDeltas[i + 1] ?? 0) / 1000;
    let n = byId.get(p.samples[i]!)!;
    self.set(key(n), (self.get(key(n)) ?? 0) + dt);
    const seen = new Set<string>();
    for (;;) {
      const k = key(n);
      if (!seen.has(k)) {
        seen.add(k);
        total.set(k, (total.get(k) ?? 0) + dt);
      }
      const up = parent.get(n.id);
      if (up === undefined) break;
      n = byId.get(up)!;
    }
  }
  const show = (m: Map<string, number>): string =>
    [...m]
      .filter(([k]) => !k.startsWith('(root)') && !k.startsWith('(program)'))
      .sort((x, y) => y[1] - x[1])
      .slice(0, top)
      .map(([k, v]) => `    ${v.toFixed(0).padStart(7)} ms  ${k}`)
      .join('\n');
  console.log(`hours ${from}–${from + hours}: ${ms.toFixed(0)} ms (${(ms / hours).toFixed(3)} a tick)`);
  console.log('  self:\n' + show(self));
  console.log('  total:\n' + show(total));
}

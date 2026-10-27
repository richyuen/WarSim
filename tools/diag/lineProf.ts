/**
 * PLAN 7.139: a CPU profile over a span of hours after a load, by source line (`spanProf.ts` gives
 * functions): V8's per-line ticks mapped back to the `.ts` line through the script's inline source
 * map. Prints the costliest lines of the files whose path has `file part`. Not run by tsx (it puts
 * a module on one line): bundled, two folders under the repo's root (the assets are read from
 * there), and run from the root:
 *
 *   npx esbuild tools/diag/lineProf.ts --bundle --platform=node --format=esm --sourcemap=inline --outfile=.cache/lp/lineProf.mjs
 *   node .cache/lp/lineProf.mjs <seed> <state.bin> <hours> <file part> [top = 40]
 */
import { readFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import { SourceMap } from 'node:module';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

interface Node {
  id: number;
  callFrame: { functionName: string; scriptId: string; url: string; lineNumber: number };
  positionTicks?: { line: number; ticks: number }[];
}
interface Profile {
  nodes: Node[];
  samples: number[];
  timeDeltas: number[];
}

const seed = Number(process.argv[2]);
const src = process.argv[3]!;
const hours = Number(process.argv[4]);
const part = process.argv[5]!;
const top = Number(process.argv[6] ?? 40);
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(src)));
const clear = (w: typeof s.world): void => {
  w.out.events.length = 0;
  w.out.fires.length = 0;
};
const session = new Session();
session.connect();
await session.post('Debugger.enable');
await session.post('Profiler.enable');
await session.post('Profiler.setSamplingInterval', { interval: 200 });
await session.post('Profiler.start');
const a = performance.now();
s.step(hours, clear);
const ms = performance.now() - a;
const { profile } = (await session.post('Profiler.stop')) as unknown as { profile: Profile };
let samples = 0;
for (const n of profile.nodes) for (const t of n.positionTicks ?? []) samples += t.ticks;
const perTick = ms / Math.max(1, profile.samples.length);
const byLine = new Map<string, number>();
const maps = new Map<string, SourceMap | null>();
for (const n of profile.nodes) {
  if (!n.positionTicks || n.callFrame.scriptId === '0') continue;
  let m = maps.get(n.callFrame.scriptId);
  if (m === undefined) {
    const { scriptSource } = (await session.post('Debugger.getScriptSource', { scriptId: n.callFrame.scriptId })) as { scriptSource: string };
    const at = scriptSource.lastIndexOf('sourceMappingURL=data:application/json;base64,');
    m = at < 0 ? null : new SourceMap(JSON.parse(Buffer.from(scriptSource.slice(at + 46).trim(), 'base64').toString('utf8')));
    maps.set(n.callFrame.scriptId, m);
  }
  for (const t of n.positionTicks) {
    // The line's last mapping (a tick has a line and no column; the bundle keeps a statement a line).
    const e = m?.findEntry(t.line - 1, 1e6);
    const o = e && 'originalSource' in e ? { source: e.originalSource, line: e.originalLine + 1 } : null;
    if (!(o?.source ?? n.callFrame.url).includes(part)) continue;
    const k = `${o?.line ?? `js${t.line}`} ${n.callFrame.functionName || '(anon)'}`;
    byLine.set(k, (byLine.get(k) ?? 0) + t.ticks * perTick);
  }
}
session.disconnect();
console.log(`hours ${hours}: ${ms.toFixed(0)} ms (${(ms / hours).toFixed(3)} a tick), ${samples} line samples`);
for (const [k, v] of [...byLine].sort((x, y) => y[1] - x[1]).slice(0, top)) console.log(`  ${v.toFixed(0).padStart(6)} ms  ${part}:${k}`);

/* global process, console */
// node lines.mjs <profile> <bundle> <fn...>: self ticks by source line of the named functions (PLAN 7.105)
import { readFileSync } from 'fs';
const [file, bundle, ...fns] = process.argv.slice(2);
const p = JSON.parse(readFileSync(file, 'utf8'));
const src = readFileSync(bundle, 'utf8').split('\n');
const ticks = new Map();
for (const n of p.nodes) {
  if (!fns.includes(n.callFrame.functionName)) continue;
  for (const pt of n.positionTicks ?? []) { const k = `${n.callFrame.functionName}:${pt.line}`; ticks.set(k, (ticks.get(k) ?? 0) + pt.ticks); }
}
for (const [k, t] of [...ticks].sort((a, b) => b[1] - a[1]).slice(0, 30)) { const line = +k.split(':')[1]; console.log(String(t).padStart(6), k.padEnd(22), src[line - 1].trim().slice(0, 130)); }

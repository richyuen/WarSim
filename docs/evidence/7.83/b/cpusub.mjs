/* global process, console */
// node cpusub.mjs <profile> <rootFnName>: self and total time by function within the subtree of rootFnName
import { readFileSync } from 'fs';
const [file, root] = process.argv.slice(2);
const p = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const self = new Map();
const dts = p.timeDeltas;
for (let i = 0; i < p.samples.length; i++) self.set(p.samples[i], (self.get(p.samples[i]) ?? 0) + (dts[i] ?? 0));
const key = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`;
const selfBy = new Map(), totBy = new Map();
let rootTot = 0;
for (const [id, t] of self) {
  // walk up; is it under root?
  let cur = id, under = false; const chain = [];
  while (cur !== undefined) { const n = byId.get(cur); chain.push(n); if (n.callFrame.functionName === root) { under = true; break; } cur = parent.get(cur); }
  if (!under) continue;
  rootTot += t;
  const k = key(byId.get(id)); selfBy.set(k, (selfBy.get(k) ?? 0) + t);
  const seen = new Set();
  for (const n of chain) { const kk = key(n); if (seen.has(kk)) continue; seen.add(kk); totBy.set(kk, (totBy.get(kk) ?? 0) + t); }
}
console.log(`root ${root} total ${(rootTot / 1000).toFixed(0)} ms`);
console.log('--- total (inclusive)');
for (const [k, t] of [...totBy].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log((t / 1000).toFixed(0).padStart(7), (100 * t / rootTot).toFixed(1).padStart(5) + '%', k);
console.log('--- self');
for (const [k, t] of [...selfBy].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log((t / 1000).toFixed(0).padStart(7), (100 * t / rootTot).toFixed(1).padStart(5) + '%', k);

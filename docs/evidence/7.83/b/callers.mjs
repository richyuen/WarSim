/* global process, console */
import { readFileSync } from 'fs';
const [file, root, target] = process.argv.slice(2);
const p = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const self = new Map();
for (let i = 0; i < p.samples.length; i++) self.set(p.samples[i], (self.get(p.samples[i]) ?? 0) + (p.timeDeltas[i] ?? 0));
const by = new Map();
for (const [id, t] of self) {
  let cur = id; const chain = [];
  while (cur !== undefined) { const n = byId.get(cur); chain.push(n); cur = parent.get(cur); }
  if (!chain.some((n) => n.callFrame.functionName === root)) continue;
  const i = chain.findIndex((n) => n.callFrame.functionName === target);
  if (i < 0) continue;
  const caller = chain.slice(i + 1, i + 3).map((n) => `${n.callFrame.functionName || 'anon'}:${n.callFrame.lineNumber + 1}`).join('<');
  by.set(caller, (by.get(caller) ?? 0) + t);
}
for (const [k, t] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log((t / 1000).toFixed(0).padStart(6), k);

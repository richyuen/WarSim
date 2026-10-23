/* global process, console */
import { readFileSync } from 'fs';
const [file, fnLine] = process.argv.slice(2); // e.g. 24672 (1-based)
const p = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const self = new Map();
for (let i = 0; i < p.samples.length; i++) self.set(p.samples[i], (self.get(p.samples[i]) ?? 0) + (p.timeDeltas[i] ?? 0));
const by = new Map(); let tot = 0;
for (const [id, t] of self) {
  let cur = id; const chain = [];
  while (cur !== undefined) { const n = byId.get(cur); chain.push(n); cur = parent.get(cur); }
  const i = chain.findIndex((n) => n.callFrame.lineNumber + 1 === Number(fnLine));
  if (i < 0) continue;
  tot += t;
  const child = i === 0 ? '(self)' : `${chain[i - 1].callFrame.functionName || 'anon'}:${chain[i - 1].callFrame.lineNumber + 1}`;
  by.set(child, (by.get(child) ?? 0) + t);
}
console.log('total', (tot / 1000).toFixed(0));
for (const [k, t] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log((t / 1000).toFixed(0).padStart(6), k);
const lines = new Map();
for (const m of byId.values()) if (m.callFrame.lineNumber + 1 === Number(fnLine)) for (const pt of m.positionTicks ?? []) lines.set(pt.line, (lines.get(pt.line) ?? 0) + pt.ticks);
console.log([...lines].sort((a, b) => b[1] - a[1]).slice(0, 8));

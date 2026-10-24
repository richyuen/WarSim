/* global process, console */
// node top.mjs <profile> [rows]: inclusive ms by function over the whole run (PLAN 7.105)
import { readFileSync } from 'fs';
const p = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map(); for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const self = new Map(); for (let i = 0; i < p.samples.length; i++) self.set(p.samples[i], (self.get(p.samples[i]) ?? 0) + (p.timeDeltas[i] ?? 0));
// inclusive by function under the "step" frame's children: find nearest ancestor whose parent is the systems loop; print by top-level system fn
const key = (n) => `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber + 1}`;
const tot = new Map(); let all = 0;
for (const [id, t] of self) { all += t; const seen = new Set(); let x = id; while (x !== undefined) { const k = key(byId.get(x)); if (!seen.has(k)) { seen.add(k); tot.set(k, (tot.get(k) ?? 0) + t); } x = parent.get(x); } }
console.log('all', (all / 1000).toFixed(0));
for (const [k, t] of [...tot].sort((a, b) => b[1] - a[1]).slice(0, Number(process.argv[3] ?? 60))) console.log((t / 1000).toFixed(0).padStart(7), k);

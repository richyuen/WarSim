/* global process, console */
import { readFileSync } from 'fs';
const [file, fn, mapFile] = process.argv.slice(2);
const p = JSON.parse(readFileSync(file, 'utf8'));
const lines = new Map(); let tot=0;
for (const n of p.nodes) if (n.callFrame.functionName === fn) for (const t of n.positionTicks ?? []) { lines.set(t.line, (lines.get(t.line) ?? 0) + t.ticks); tot+=t.ticks; }
const src = readFileSync(mapFile, 'utf8').split('\n');
for (const [l, t] of [...lines].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(t, (100*t/tot).toFixed(0)+'%', l, src[l - 1].trim().slice(0, 140));

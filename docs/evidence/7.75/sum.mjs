// Sums newFronts.ts's four batches each side (PLAN 7.75): node docs/evidence/7.75/sum.mjs
/* global console, process, URL */
import { readFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url);
for (const tag of ['before', 'after']) {
  const t = {};
  for (const b of ['y10a', 'y10b', 'y20a', 'y20b']) {
    const s = JSON.parse(readFileSync(new URL(`${tag}_${b}.json`, dir))).summary;
    for (const [k, v] of Object.entries(s)) if (typeof v === 'number') t[k] = (t[k] ?? 0) + v;
    process.stdout.write(`${tag} ${b}: engaged/war-day ${s.engagedPerWar.toFixed(4)}\n`);
  }
  console.log(`${tag}: engaged per war-day ${(t.engaged / t.warDays).toFixed(4)}, opened ${t.opened} (fronted ${t.openedFronted}, ${((100 * t.openedFronted) / t.open).toFixed(1)} %) of ${t.open}, landings ${t.landed}, far ${t.far} (held ${t.held}), beachheads ${t.beachheads}, embarked ${t.embarked} in ${t.trips} (${t.grouped})`);
}

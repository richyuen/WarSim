// Nearest 1938 city to each nuclear toll of the headless logs.
import { readFileSync, writeFileSync } from 'node:fs';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
const cities = (JSON.parse(readFileSync('data/scenarios/1938/cities.json', 'utf8')) as { cities: { name: string; lonLat: [number, number]; size: number }[] }).cities.map((c) => ({ ...c, cell: cellOf(c.lonLat[0], c.lonLat[1], SIZE_1938.w, SIZE_1938.h) }));
const out: Record<string, unknown[]> = {};
for (const f of process.argv.slice(2)) {
  const o = JSON.parse(readFileSync(f, 'utf8')) as { nukeLog: { k: string; at: [number, number]; [k: string]: unknown }[] };
  out[f] = o.nukeLog.filter((e) => e.k === 'toll').map((e) => {
    let best = cities[0]!;
    let d = Infinity;
    for (const c of cities) {
      const dd = Math.hypot(c.cell[0] - e.at[0], c.cell[1] - e.at[1]);
      if (dd < d) { d = dd; best = c; }
    }
    return { year: e.year, tick: e.tick, by: e.by, struck: e.struck, dead: e.dead, near: best.name, cells: +d.toFixed(1) };
  });
}
writeFileSync('critic/c6_nuke_where.json', JSON.stringify(out, null, 1));
for (const [f, rows] of Object.entries(out)) { console.log(f); for (const r of rows as Record<string, unknown>[]) console.log(Object.values(r).join(' | ')); }

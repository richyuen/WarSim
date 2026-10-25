/**
 * PLAN 7.116a's measure: the land formations under HOLLOW men (500) on a save, and what they are
 * doing. Per save: land formations of living nations (not fleets or wings, not off land), those
 * under 500 men, and of those: engaged, retreating, on a march home, short of supply (under 0.5),
 * on a cell their nation does not control, of a nation at war; by template (index, its men);
 * and the nearest other land formation of their nation (km, as the crow flies on the map) and
 * whether it has the hollow one's men of room below its template.
 *
 * Usage: npx tsx tools/diag/hollowWhy.ts <save.bin>...
 */
import { readFileSync } from 'node:fs';
import { kmPerCell } from '../../src/sim/data/projection';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { cellX, wrapDx } from '../../src/sim/systems/elements';
import { loadAssets1938 } from '../headless/assets';

const HOLLOW = 500;
const assets = loadAssets1938(SIZE_1938.w);
for (const bin of process.argv.slice(2)) {
  const s = new Sim({ scenario: '1938', seed: 1, assets });
  s.load(new Uint8Array(readFileSync(bin)));
  const w = s.world;
  const c = w.formations.cols;
  const nat = w.nations.cols;
  const rules = w.rules!;
  const atWar = w.wars.nations();
  const km = kmPerCell(w.cells.w);
  const land: number[] = [];
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.offLand(id) || nat.living[c.nation[id]!] !== 1) return;
    land.push(id);
  });
  const t = { land: land.length, hollow: 0, engaged: 0, retreat: 0, home: 0, lowSupply: 0, foreign: 0, atWar: 0, near25: 0, near50: 0, near100: 0, room25: 0, room50: 0, none: 0 };
  const byTemplate = new Map<number, number>();
  const menHist = [0, 0, 0, 0, 0];
  for (const id of land) {
    if (c.strength[id]! >= HOLLOW) continue;
    t.hollow++;
    const n = c.nation[id]!;
    if (c.engaged[id] === 1) t.engaged++;
    if (c.retreat[id] !== 0) t.retreat++;
    if (c.home[id] !== 0) t.home++;
    if (c.supply[id]! < 0.5) t.lowSupply++;
    if (atWar.has(n)) t.atWar++;
    const cx = cellX(w, Math.floor(c.x[id]!));
    const cy = Math.floor(c.y[id]!);
    if (cx === null || w.cells.controller[cy * w.cells.w + cx] !== n) t.foreign++;
    byTemplate.set(c.template[id]!, (byTemplate.get(c.template[id]!) ?? 0) + 1);
    menHist[Math.min(4, Math.floor(c.strength[id]! / 100))]!++;
    let best = Infinity;
    let bestRoom = Infinity;
    for (const o of land) {
      if (o === id || c.nation[o] !== n) continue;
      const d = Math.hypot(wrapDx(w, c.x[id]!, c.x[o]!), c.y[o]! - c.y[id]!) * km;
      if (d < best) best = d;
      const room = rules.templates[c.template[o]!]!.manpower - c.strength[o]!;
      if (room >= c.strength[id]! && d < bestRoom) bestRoom = d;
    }
    if (best <= 25) t.near25++;
    if (best <= 50) t.near50++;
    if (best <= 100) t.near100++;
    if (bestRoom <= 25) t.room25++;
    if (bestRoom <= 50) t.room50++;
    if (best === Infinity) t.none++;
  }
  const tpl = [...byTemplate].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${rules.templates[k]!.manpower}):${v}`);
  console.log(`${bin}: ${JSON.stringify(t)} men/100 ${menHist.join(',')} templates ${tpl.join(' ')}`);
}

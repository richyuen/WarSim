/**
 * PLAN 7.173: from a save, each living nation over OVEREXT_SHARE of the owned land: its tag, share,
 * capital cell, how much of its own core land lies beyond OVEREXT_CELLS of the capital (the land the
 * overextension's strain falls on), and how much of that land has one of its land formations in its
 * garrison buckets' reach.
 *
 * Usage: npx tsx tools/diag/capitalFar.ts <seed> <save.bin>
 */
import { readFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { Terrain } from '../../src/shared/terrain';
import { GARRISON_CELLS, OVEREXT_CELLS, OVEREXT_SHARE } from '../../src/sim/systems/revolts';
import { TAGS_1938 } from '../../src/sim/scenario1938';
import { loadAssets1938 } from '../headless/assets';

const [seedS, bin] = process.argv.slice(2);
const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin!)));
const w = s.world;
const nc = w.nations.cols;
const { owner, controller, province, terrain } = w.cells;
const W = w.cells.w;
const km2 = w.landCounts().owned;
let owned = 0;
w.nations.forEach((n) => {
  if (nc.living[n] === 1) owned += km2[n]!;
});
const far = w.atSize(OVEREXT_CELLS);
const g = w.atSizeWhole(GARRISON_CELLS);
const fc = w.formations.cols;
w.nations.forEach((n) => {
  if (nc.living[n] !== 1 || km2[n]! / owned <= OVEREXT_SHARE) return;
  let core = 0;
  let farCore = 0;
  let farGuarded = 0;
  let farUnrest = 0;
  let farHot = 0;
  const near: Set<number> = new Set();
  w.formations.forEach((f) => {
    if (fc.nation[f] !== n || w.isFleet(f) || w.isWing(f) || w.offLand(f)) return;
    near.add(Math.floor(fc.y[f]! / g) * 100000 + Math.floor(fc.x[f]! / g));
  });
  let forms = 0;
  w.formations.forEach((f) => {
    if (fc.nation[f] === n && !w.isFleet(f) && !w.isWing(f) && !w.offLand(f)) forms++;
  });
  for (let c = 0; c < owner.length; c++) {
    if (owner[c] !== n || controller[c] !== n || terrain[c] === Terrain.Water) continue;
    if (w.provinces.core[province[c]!] !== n) continue;
    core++;
    let dx = Math.abs((c % W) + 0.5 - nc.capitalX[n]!);
    if (w.settings.loopingMap && dx > W / 2) dx = W - dx;
    const dy = Math.floor(c / W) + 0.5 - nc.capitalY[n]!;
    if (dx * dx + dy * dy <= far * far) continue;
    farCore++;
    const u = w.provinces.unrest[province[c]!]!;
    farUnrest += u;
    if (u >= 50) farHot++;
    const bx = Math.floor((c % W) / g);
    const by = Math.floor(Math.floor(c / W) / g);
    let guard = false;
    for (let a = -1; a <= 1 && !guard; a++) for (let b = -1; b <= 1; b++) if (near.has((by + a) * 100000 + bx + b)) guard = true;
    if (guard) farGuarded++;
  }
  console.log(`${n} ${TAGS_1938[n - 1] ?? 'new'} share ${((100 * km2[n]!) / owned).toFixed(1)} % capital (${nc.capitalX[n]!.toFixed(0)}, ${nc.capitalY[n]!.toFixed(0)}) core ${core} far ${farCore} far guarded ${farGuarded} land formations ${forms} suppression ${nc.suppression[n]!.toFixed(2)} gold ${nc.gold[n]!.toFixed(0)} income ${nc.income[n]!.toFixed(0)} far unrest mean ${(farUnrest / Math.max(1, farCore)).toFixed(1)} far at 50+ ${farHot}`);
});

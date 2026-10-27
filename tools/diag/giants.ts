/**
 * PLAN 7.140, from a save: the seven nations holding the most cells, each with its land by terrain
 * (ice, tundra, the rest), its people and output, its capital's cell, its land formations and where
 * they stand (on its own cells or not), its wars' enemies, and the enemy land formations standing on
 * its cells. What holds a giant's land still.
 *
 * Usage: npx tsx tools/diag/giants.ts <save.bin> [out.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const bin = process.argv[2]!;
const out = process.argv[3];
const s = new Sim({ scenario: '1938', seed: 1, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin)));
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? w.names.get(n) ?? `#${n}`;
const cl = w.cells;
const W = cl.w;
const held = new Map<number, number>();
for (let i = 0; i < cl.controller.length; i++) if (cl.controller[i]) held.set(cl.controller[i]!, (held.get(cl.controller[i]!) ?? 0) + 1);
const ranked = [...held].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 7);
const land = [...held.values()].reduce((a, b) => a + b, 0);
const enemies = (n: number): Set<number> => {
  const e = new Set<number>();
  for (const war of w.wars.list) {
    for (let side = 0; side < 2; side++) if (war.sides[side]!.includes(n)) for (const m of war.sides[1 - side]!) e.add(m);
  }
  return e;
};
const fc = w.formations.cols;
const rows = ranked.map(([n, cells]) => {
  let ice = 0;
  let tundra = 0;
  let pop = 0;
  let econ = 0;
  let owned = 0;
  for (let i = 0; i < cl.controller.length; i++) {
    if (cl.controller[i] !== n) continue;
    if (cl.terrain[i] === 11) ice++;
    else if (cl.terrain[i] === 8) tundra++;
    pop += cl.pop[i]!;
    econ += cl.econ[i]!;
    if (cl.owner[i] === n) owned++;
  }
  const foes = enemies(n);
  let mine = 0;
  let mineAway = 0;
  let foesOn = 0;
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id)) return;
    const c = Math.floor(fc.y[id]!) * W + Math.floor(fc.x[id]!);
    const at = cl.controller[c]!;
    if (fc.nation[id] === n) {
      if (at === n) mine++;
      else mineAway++;
    } else if (foes.has(fc.nation[id]!) && at === n) foesOn++;
  });
  const nc = w.nations.cols;
  return {
    nation: tag(n),
    share: +((100 * cells) / land).toFixed(2),
    cells,
    icePct: +((100 * ice) / cells).toFixed(1),
    tundraPct: +((100 * tundra) / cells).toFixed(1),
    ownedPct: +((100 * owned) / cells).toFixed(1),
    popK: pop,
    econ,
    capital: [Math.round(nc.capitalX[n]!), Math.round(nc.capitalY[n]!)],
    overlord: nc.overlord[n] ? tag(nc.overlord[n]!) : '',
    aggression: nc.aggression[n],
    formationsHome: mine,
    formationsAway: mineAway,
    enemies: [...foes].map(tag),
    enemyFormationsOnIt: foesOn,
  };
});
const text = JSON.stringify({ bin, day: Math.floor(w.tick / 24), rows }, null, 1);
if (out) writeFileSync(out, text);
process.stdout.write(`${text}\n`);

/**
 * PLAN 7.80a: the map's pieces by kind. A piece is a 4-connected run of land cells of one holder
 * (controller), as the critic counts it (run 12, `pieces2to400`). Each piece of 2–400 cells is put
 * in one kind: occupied (most of its cells owned by another nation), a founded nation's own (origin
 * ≠ 0: revolts, statelets, released), or an original nation's own; and coastal or not (a cell of it
 * next to water); an enclave when its land rim is one other holder's alone, and whether its holder is
 * at war with that one.
 *
 * Usage: npx tsx tools/diag/fragKinds.ts <seed:bin | seed:start | seed:run:5,10>...   (OUT env: a json
 * file). `seed:run:Y,…` steps from 1938 and counts at the end of each year listed (the bisection of
 * PLAN 7.80a: copied into a worktree of each commit).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { Terrain } from '../../src/shared/terrain';
import { loadAssets1938 } from '../headless/assets';
import { laneOf } from '../../src/sim/world';

const TICKS_PER_YEAR = 24 * 365;

const assets = loadAssets1938(size1938(undefined).w);
const rows: unknown[] = [];
for (const arg of process.argv.slice(2)) {
  const [seedS, bin, yearsS] = arg.split(':');
  const sim = new Sim({ scenario: '1938', seed: Number(seedS), assets });
  if (bin === 'run') {
    // From 1938, the counts at the end of each year listed (`seed:run:5,10`), as `npm run sim` steps.
    const world = sim.world;
    if (world.ports.length > 0 && world.seaSeeds.length > 0) laneOf(world);
    for (const y of yearsS!.split(',').map(Number)) {
      while (world.tick < y * TICKS_PER_YEAR)
        sim.step(1, (w) => {
          w.out.events.length = 0;
          w.out.fires.length = 0;
        });
      rows.push({ seed: Number(seedS), year: y, ...fragKinds(sim) });
      console.log(JSON.stringify(rows[rows.length - 1]));
    }
    continue;
  }
  if (bin !== 'start') sim.load(new Uint8Array(readFileSync(bin!)));
  rows.push({ seed: Number(seedS), bin, ...fragKinds(sim) });
  console.log(JSON.stringify(rows[rows.length - 1]));
}
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(rows, null, 1));
process.stderr.write('done:\n');

function fragKinds(sim: Sim) {
  const w = sim.world;
  const C = w.cells.controller;
  const O = w.cells.owner;
  const T = w.cells.terrain;
  const W = w.cells.w;
  const N = C.length;
  const H = N / W;
  const origin = w.nations.cols.origin;
  const seen = new Uint8Array(N);
  const stack = new Int32Array(N);
  const piece: number[] = [];
  const k = { pieces: 0, mid: 0, occ: 0, occCoast: 0, founded: 0, foundedCoast: 0, own: 0, ownCoast: 0, mid2to10: 0, enclave: 0, enclaveAtWar: 0 };
  for (let i = 0; i < N; i++) {
    const o = C[i]!;
    if (!o || seen[i]) continue;
    let sp = 0;
    piece.length = 0;
    stack[sp++] = i;
    seen[i] = 1;
    let coast = false;
    let other = 0;
    let rim = -1; // the one other holder on its land rim, -2 when two or more (or unheld land)
    while (sp) {
      const c = stack[--sp]!;
      piece.push(c);
      if (O[c] !== o) other++;
      const x = c % W;
      const y = (c - x) / W;
      const nb = [x > 0 ? c - 1 : c + W - 1, x < W - 1 ? c + 1 : c - W + 1, y > 0 ? c - W : -1, y < H - 1 ? c + W : -1];
      for (const n of nb) {
        if (n < 0) continue;
        if (T[n] === Terrain.Water) coast = true;
        else if (C[n] !== o) rim = rim === -1 ? C[n]! : rim === C[n] ? rim : -2;
        if (!seen[n] && C[n] === o) {
          seen[n] = 1;
          stack[sp++] = n;
        }
      }
    }
    k.pieces++;
    const size = piece.length;
    if (size < 2 || size > 400) continue;
    k.mid++;
    if (size <= 10) k.mid2to10++;
    if (rim > 0) {
      k.enclave++;
      if (w.wars.atWar(o, rim)) k.enclaveAtWar++;
    }
    if (other * 2 > size) {
      k.occ++;
      if (coast) k.occCoast++;
    } else if ((origin[o] ?? 0) !== 0) {
      k.founded++;
      if (coast) k.foundedCoast++;
    } else {
      k.own++;
      if (coast) k.ownCoast++;
    }
  }
  let living = 0;
  let foundedLiving = 0;
  for (let id = 1; id < w.nations.cols.living.length; id++) {
    if (w.nations.cols.living[id] !== 1) continue;
    living++;
    if ((origin[id] ?? 0) !== 0) foundedLiving++;
  }
  return { ...k, living, foundedLiving };
}

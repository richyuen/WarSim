/**
 * PLAN 7.138's filter: the same saved worlds stepped by the rules of the tree this runs in (and its
 * environment's knobs). Per save, hour 12 of each of `days` days: the wars with a land front of at
 * least 100 cells (`designBars.ts`' `fronts`, its last threshold) and the engaged land formations of
 * their members per such war; the wars running; the land formations ended a day (on land the day
 * before, gone the day after) and those of them of the weaker side of a long-front war (by the side's
 * men on land); cells taken in front battles. One line per save and the means.
 *
 * Usage: npx tsx tools/diag/heldAb.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import { FlipCause, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const MIN_FRONT = 100;
const out = process.argv[2]!;
const days = Number(process.argv[3] ?? 60);
const assets = loadAssets1938(SIZE_1938.w);

/** The wars with a front of at least MIN_FRONT cells: their indices, their members, and of each member whether its side is the weaker. */
function longWars(w: World): { wars: number; members: Set<number>; weak: Set<number> } {
  const { w: W, h, controller } = w.cells;
  const nb: number[] = [];
  const list = w.wars.list;
  const len = new Array<number>(list.length).fill(0);
  for (const c of frontierOf(w)) {
    const a = controller[c]!;
    if (a === 0) continue;
    const hit = new Set<number>();
    for (const q of neighbours4(c, W, h, w.settings.loopingMap, nb)) {
      const b = controller[q]!;
      if (b === 0 || b === a || !w.wars.atWar(a, b)) continue;
      for (let i = 0; i < list.length; i++) {
        const s = list[i]!.sides;
        if ((s[0].includes(a) && s[1].includes(b)) || (s[1].includes(a) && s[0].includes(b))) hit.add(i);
      }
    }
    for (const i of hit) len[i]!++;
  }
  const men = new Map<number, number>();
  const c = w.formations.cols;
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
    men.set(c.nation[id]!, (men.get(c.nation[id]!) ?? 0) + c.strength[id]!);
  });
  let wars = 0;
  const members = new Set<number>();
  const weak = new Set<number>();
  for (let i = 0; i < list.length; i++) {
    if (len[i]! < MIN_FRONT) continue;
    wars++;
    const sides = list[i]!.sides;
    const sum = sides.map((s) => s.reduce((t, n) => t + (men.get(n) ?? 0), 0));
    for (const n of sides[0]) members.add(n);
    for (const n of sides[1]) members.add(n);
    for (const n of sides[sum[0]! <= sum[1]! ? 0 : 1]) weak.add(n);
  }
  return { wars, members, weak };
}

type Row = { seed: number; per: number; wars: number; running: number; ended: number; weakEnded: number; battleCells: number };
const rows: Row[] = [];
for (const a of process.argv.slice(4)) {
  const at = a.indexOf(':');
  const seed = Number(a.slice(0, at));
  const s = new Sim({ scenario: '1938', seed, assets });
  const w = s.world;
  const quiet = (ww: World): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  s.load(new Uint8Array(readFileSync(a.slice(at + 1))));
  const c = w.formations.cols;
  let per = 0;
  let wars = 0;
  let running = 0;
  let ended = 0;
  let weakEnded = 0;
  const battle0 = w.flipsBy[FlipCause.battle]!;
  for (let d = 0; d < days; d++) {
    s.step(12, quiet);
    const lw = longWars(w);
    let e = 0;
    const before = new Map<number, number>();
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
      before.set(id, c.nation[id]!);
      if (c.engaged[id] === 1 && lw.members.has(c.nation[id]!)) e++;
    });
    if (lw.wars > 0) per += e / lw.wars;
    wars += lw.wars;
    running += w.wars.list.length;
    s.step(12, quiet);
    for (const [id, n] of before)
      if (!w.formations.has(id)) {
        ended++;
        if (lw.weak.has(n)) weakEnded++;
      }
  }
  const r = (x: number): number => Math.round(x * 1000) / 1000;
  const row = { seed, per: r(per / days), wars: r(wars / days), running: r(running / days), ended: r(ended / days), weakEnded: r(weakEnded / days), battleCells: r((w.flipsBy[FlipCause.battle]! - battle0) / days) };
  rows.push(row);
  process.stderr.write(JSON.stringify(row) + '\n');
}
const mean = (k: keyof Row): number => Math.round((rows.reduce((t, x) => t + x[k], 0) / Math.max(1, rows.length)) * 1000) / 1000;
const summary = { per: mean('per'), wars: mean('wars'), running: mean('running'), ended: mean('ended'), weakEnded: mean('weakEnded'), battleCells: mean('battleCells') };
process.stderr.write(`mean ${JSON.stringify(summary)}\n`);
writeFileSync(out, JSON.stringify({ rows, summary }, null, 1));

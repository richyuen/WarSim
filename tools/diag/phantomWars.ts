/**
 * PLAN 7.150's read: the late wars with a land front that nobody fights. Per save, loaded and stepped
 * `days` days, at hour 12 of each day: each war's land front (the cells of either side next to a cell
 * of the other's, `frontierOf`), the engaged land formations of its members (not a fleet, a wing nor
 * aboard), its age, score and exhaustion. Per war: days seen, mean front, days with a front of 100+
 * cells and none of its members engaged, the longest such run, and at the last day its age, score,
 * exhaustion, and whether the stalemate peace (`strategicAi`) would take it. Per world: the critic's
 * seven samples (days 0, 10, …, 60): engaged land formations, and whether some war had a land front;
 * and each day's engaged and whether a war had a land front (`daily`, `landDaily`). Per war also each
 * side's land formations, cells held and manpower (its members', a day's mean).
 *
 * Usage: npx tsx tools/diag/phantomWars.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { STALEMATE_DAYS, STALEMATE_EXHAUSTION, STALEMATE_SCORE } from '../../src/sim/ai/strategic';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import type { World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3] ?? 70);
const assets = loadAssets1938(SIZE_1938.w);
const worlds: unknown[] = [];
const quiet = (ww: World): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
interface Row {
  id: number;
  a: string;
  b: string;
  seen: number;
  front: number;
  engaged: number;
  quiet100: number;
  run: number;
  longest: number;
  age: number;
  score: number;
  ex: [number, number];
  stalemate: boolean;
  frontless: number;
  forms: [number, number];
  cells: [number, number];
  mp: [number, number];
}
for (const arg of process.argv.slice(4)) {
  const at = arg.indexOf(':');
  const seed = Number(arg.slice(0, at));
  const s = new Sim({ scenario: '1938', seed, assets });
  const w = s.world;
  s.load(new Uint8Array(readFileSync(arg.slice(at + 1))));
  const tag = (n: number): string => TAGS_1938[n - 1] ?? w.names.get(n) ?? `#${n}`;
  s.step(12, quiet);
  const rows = new Map<number, Row>();
  const samples: { day: number; engaged: number; landWar: boolean }[] = [];
  const daily: number[] = [];
  const landDaily: boolean[] = [];
  for (let d = 0; d < days; d++) {
    if (d > 0) s.step(24, quiet);
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
          const sd = list[i]!.sides;
          if ((sd[0].includes(a) && sd[1].includes(b)) || (sd[1].includes(a) && sd[0].includes(b))) hit.add(i);
        }
      }
      for (const i of hit) len[i]!++;
    }
    const cellsOf = new Map<number, number>();
    for (let c = 0; c < W * h; c++) if (controller[c]! !== 0) cellsOf.set(controller[c]!, (cellsOf.get(controller[c]!) ?? 0) + 1);
    const engagedOf = new Map<number, number>();
    const formsOf = new Map<number, number>();
    let engaged = 0;
    const fc = w.formations.cols;
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
      formsOf.set(fc.nation[id]!, (formsOf.get(fc.nation[id]!) ?? 0) + 1);
      if (fc.engaged[id] !== 1) return;
      engaged++;
      engagedOf.set(fc.nation[id]!, (engagedOf.get(fc.nation[id]!) ?? 0) + 1);
    });
    daily.push(engaged);
    landDaily.push(len.some((x) => x > 0));
    if (d % 10 === 0) samples.push({ day: d, engaged, landWar: len.some((x) => x > 0) });
    list.forEach((war, i) => {
      let r = rows.get(war.id);
      if (!r) {
        r = { id: war.id, a: tag(war.sides[0][0]!), b: tag(war.sides[1][0]!), seen: 0, front: 0, engaged: 0, quiet100: 0, run: 0, longest: 0, age: 0, score: 0, ex: [0, 0], stalemate: false, frontless: 0, forms: [0, 0], cells: [0, 0], mp: [0, 0] };
        rows.set(war.id, r);
      }
      let e = 0;
      for (const m of [...war.sides[0], ...war.sides[1]]) e += engagedOf.get(m) ?? 0;
      r.seen++;
      for (const k of [0, 1] as const) {
        for (const m of war.sides[k]) {
          r.forms[k] += formsOf.get(m) ?? 0;
          r.cells[k] += cellsOf.get(m) ?? 0;
          r.mp[k] += w.nations.cols.manpower[m]!;
        }
      }
      r.front += len[i]!;
      r.engaged += e;
      if (len[i]! >= 100 && e === 0) {
        r.quiet100++;
        r.run++;
        r.longest = Math.max(r.longest, r.run);
      } else r.run = 0;
      r.age = Math.round((w.tick - war.startTick) / 24);
      r.score = Math.round(war.score);
      r.ex = [Math.round(war.exhaustion[0]), Math.round(war.exhaustion[1])];
      r.stalemate = !war.fightToDeath[0] && !war.fightToDeath[1] && r.age >= STALEMATE_DAYS && Math.abs(war.score) < STALEMATE_SCORE && war.exhaustion[0] > STALEMATE_EXHAUSTION && war.exhaustion[1] > STALEMATE_EXHAUSTION;
      r.frontless = war.frontless ?? 0;
    });
  }
  const wars = [...rows.values()].map((r) => ({ ...r, front: Math.round(r.front / r.seen), engaged: +(r.engaged / r.seen).toFixed(2), forms: [Math.round(r.forms[0] / r.seen), Math.round(r.forms[1] / r.seen)], cells: [Math.round(r.cells[0] / r.seen), Math.round(r.cells[1] / r.seen)], mp: [Math.round(r.mp[0] / r.seen), Math.round(r.mp[1] / r.seen)] }));
  const zeroSamples = samples.filter((x) => x.landWar && x.engaged === 0).length;
  worlds.push({ seed, samples, zeroSamples, daily, landDaily, wars });
  process.stderr.write(`${seed}: samples ${samples.map((x) => (x.landWar ? x.engaged : '-')).join(',')} zero ${zeroSamples}\n`);
  for (const r of wars) if (r.front >= 100) process.stderr.write(`  war ${r.id} ${r.a}-${r.b} seen ${r.seen} front ${r.front} eng ${r.engaged} quiet100 ${r.quiet100} longest ${r.longest} age ${r.age} score ${r.score} ex ${r.ex} forms ${r.forms} cells ${r.cells} mp ${r.mp} stal ${r.stalemate}\n`);
}
writeFileSync(out, JSON.stringify(worlds, null, 1));

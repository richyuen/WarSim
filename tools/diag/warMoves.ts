/**
 * PLAN 7.118: which wars move land late. From a saved state, for `days` days, the cells whose
 * controller changed each day, put to the war that has the old and new controller (or their overlords)
 * on opposite sides, else to "no war" (peace terms, revolts, annexations, unions); per war its sides'
 * leaders, its age, the land its sides hold, the cells moved and the formations engaged. And the
 * declarations of the window.
 *
 * Usage: npx tsx tools/diag/warMoves.ts <seed> <state.bin> [days = 365]
 */
import { readFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { War } from '../../src/sim/wars';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const src = process.argv[3]!;
const days = Number(process.argv[4] ?? 365);
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(src)));
const w = s.world;
const nc = w.nations.cols;
const tag = (n: number): string => ((nc.origin[n] ?? 0) === 0 ? (TAGS_1938[n - 1] ?? `#${n}`) : `f${n}`);
const realm = (n: number): number => (nc.overlord[n] !== 0 ? nc.overlord[n]! : n);
type Row = { name: string; start: number; days: number; moved: number; engagedDays: number; landDays: number };
const rows = new Map<War, Row>();
let noWar = 0;
let declared = 0;
let moved = 0;
let prev = w.cells.controller.slice();
const sideOf = (war: War, n: number): number => (war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1);
for (let d = 0; d < days; d++) {
  s.step(24, (ww) => {
    const e = ww.out.events;
    for (let i = 0; i < e.length; i += 6) if (e[i + 1] === EventKind.WarDeclared) declared++;
    e.length = 0;
    ww.out.fires.length = 0;
  });
  const wars = w.wars.list;
  for (const war of wars) {
    if (!rows.has(war)) {
      const lead = (k: number): string => war.sides[k]!.slice(0, 3).map(tag).join('+') + (war.sides[k]!.length > 3 ? `+${war.sides[k]!.length - 3}` : '');
      rows.set(war, { name: `${lead(0)} v ${lead(1)}`, start: Math.round(war.startTick / 24), days: 0, moved: 0, engagedDays: 0, landDays: 0 });
    }
    rows.get(war)!.days++;
  }
  const c = w.cells.controller;
  const held = new Map<number, number>();
  for (let i = 0; i < c.length; i++) {
    if (c[i] !== 0) held.set(c[i]!, (held.get(c[i]!) ?? 0) + 1);
    if (c[i] === prev[i]) continue;
    moved++;
    const a = prev[i]!;
    const b = c[i]!;
    const war = wars.find((x) => {
      const sa = Math.max(sideOf(x, a), sideOf(x, realm(a)));
      const sb = Math.max(sideOf(x, b), sideOf(x, realm(b)));
      return sa >= 0 && sb >= 0 && sa !== sb;
    });
    if (war) rows.get(war)!.moved++;
    else noWar++;
  }
  prev = c.slice();
  const eng = new Map<number, number>();
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id)) return;
    if (w.formations.cols.engaged[id]) eng.set(w.formations.cols.nation[id]!, (eng.get(w.formations.cols.nation[id]!) ?? 0) + 1);
  });
  for (const war of wars) {
    const r = rows.get(war)!;
    for (const sd of war.sides)
      for (const n of sd) {
        r.engagedDays += eng.get(n) ?? 0;
        r.landDays += held.get(n) ?? 0;
      }
  }
}
const day0 = Math.round(w.tick / 24) - days;
console.log(`seed ${seed} ${src}, ${days} days: cells moved ${moved}, in no war ${noWar}, declarations ${declared}, wars seen ${rows.size}`);
for (const r of [...rows.values()].sort((a, b) => b.landDays - a.landDays))
  console.log(`  ${r.name}: age at start ${Math.max(0, day0 - r.start)} d, days ${r.days}, land held ${Math.round(r.landDays / Math.max(1, r.days))}, moved ${r.moved}, engaged a day ${(r.engagedDays / Math.max(1, r.days)).toFixed(1)}`);
console.log('done:');

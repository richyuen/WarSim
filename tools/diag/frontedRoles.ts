/**
 * PLAN 7.146: at each of `months` month starts (as `armyGatesNow.ts` steps them), the members of
 * long-front wars (a front of at least MIN_FRONT cells) by role, weak or strong by the side's men on
 * land (a nation in several such wars takes its longest front's), and whether each is `fronted`: it
 * holds front cells of that war, or stands on its landmass (a land formation of it on a landmass with
 * a front cell of the war). For `longWarGates.ts`: which of the weak side can add contact.
 *
 * Usage: npx tsx tools/diag/frontedRoles.ts <out.json> <months> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { isMonthStart } from '../../src/shared/calendar';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import { navOf, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const MIN_FRONT = 100;
const out = process.argv[2]!;
const months = Number(process.argv[3]);
const quiet = (ww: World): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
const rows: { seed: number; roles: { day: number; weak: string[]; strong: string[]; weakFronted: string[]; strongFronted: string[]; weakMen: number; strongMen: number }[] }[] = [];
for (const a of process.argv.slice(4)) {
  const [seedS, bin] = a.split(':');
  const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
  s.load(new Uint8Array(readFileSync(bin!)));
  const w = s.world;
  const tag = (n: number): string => TAGS_1938[n - 1] ?? w.names.get(n) ?? `#${n}`;
  const out1: (typeof rows)[number]['roles'] = [];
  for (let m = 0; m < months; m++) {
    s.step(1, quiet);
    while (!isMonthStart(w.startDay, w.tick)) s.step(1, quiet);
    const { w: W, h, controller } = w.cells;
    const comp = navOf(w).grid.component;
    const nb: number[] = [];
    const list = w.wars.list;
    const cells = new Map<number, number[]>();
    for (const c of frontierOf(w)) {
      const x = controller[c]!;
      if (x === 0) continue;
      const hit = new Set<number>();
      for (const q of neighbours4(c, W, h, w.settings.loopingMap, nb)) {
        const y = controller[q]!;
        if (y === 0 || y === x || !w.wars.atWar(x, y)) continue;
        for (let i = 0; i < list.length; i++) {
          const sd = list[i]!.sides;
          if ((sd[0].includes(x) && sd[1].includes(y)) || (sd[1].includes(x) && sd[0].includes(y))) hit.add(i);
        }
      }
      for (const i of hit) (cells.get(i) ?? cells.set(i, []).get(i)!).push(c);
    }
    const f = w.formations.cols;
    const men = new Map<number, number>();
    const lands = new Map<number, Set<number>>();
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id) || w.offLand(id)) return;
      const n = f.nation[id]!;
      men.set(n, (men.get(n) ?? 0) + f.strength[id]!);
      const cell = Math.floor(f.y[id]!) * W + Math.floor(f.x[id]!);
      (lands.get(n) ?? lands.set(n, new Set()).get(n)!).add(comp[cell]!);
    });
    const best = new Map<number, number>();
    const role = new Map<number, { r: 'weak' | 'strong'; fronted: boolean }>();
    let weakMen = 0;
    let strongMen = 0;
    for (const [i, cs] of cells) {
      if (cs.length < MIN_FRONT) continue;
      const sd = list[i]!.sides;
      const m = sd.map((x) => x.reduce((t, n) => t + (men.get(n) ?? 0), 0));
      const weak = m[0]! <= m[1]! ? 0 : 1;
      weakMen += m[weak]!;
      strongMen += m[1 - weak]!;
      const holders = new Set(cs.map((c) => controller[c]!));
      const frontLands = new Set(cs.map((c) => comp[c]!));
      for (let k = 0; k < 2; k++)
        for (const n of sd[k]!) {
          if (w.nations.cols.living[n] !== 1 || (best.get(n) ?? -1) >= cs.length) continue;
          best.set(n, cs.length);
          const fronted = holders.has(n) || [...(lands.get(n) ?? [])].some((l) => frontLands.has(l));
          role.set(n, { r: k === weak ? 'weak' : 'strong', fronted });
        }
    }
    const pick = (r: string, fr?: boolean): string[] => [...role].filter(([, v]) => v.r === r && (fr === undefined || v.fronted === fr)).map(([n]) => tag(n));
    out1.push({ day: Math.floor(w.tick / 24), weak: pick('weak'), strong: pick('strong'), weakFronted: pick('weak', true), strongFronted: pick('strong', true), weakMen, strongMen });
    s.step(1, quiet);
  }
  rows.push({ seed: Number(seedS), roles: out1 });
  process.stderr.write(`${seedS}: ${out1.map((r) => `${r.weakFronted.length}/${r.weak.length}`).join(' ')}\n`);
}
writeFileSync(out, JSON.stringify({ rows }, null, 1));
console.log('done');

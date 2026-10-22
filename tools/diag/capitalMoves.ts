/**
 * PLAN 7.68's measure: where a lost capital goes. From each saved state, for `days` days, every
 * `CapitalMoved` to a city (not a field capital) is read after its hour: the landmass of the city
 * (`navOf(world).grid.component`) against the landmass where its nation owns and controls the most
 * cells. `onMost`: the moves that land on that landmass; `possible`: the moves whose nation owned
 * and controlled a city on it then (a move that could have landed there).
 *
 * Usage: npx tsx tools/diag/capitalMoves.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3]);
const cases = process.argv.slice(4).map((a) => {
  const [seed, src] = a.split(':');
  return { seed: Number(seed), src: src! };
});
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;

type Move = { seed: number; day: number; nation: string; city: number; land: number; landCells: number; most: number; mostCells: number; onMost: boolean; possible: boolean };
const moves: Move[] = [];
for (const { seed, src } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  s.load(new Uint8Array(readFileSync(src)));
  let day = 0;
  const read = (w: World): void => {
    const ev = w.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      if (ev[i + 1] !== EventKind.CapitalMoved || ev[i + 3] === 0) continue;
      const n = ev[i + 2]!;
      const city = ev[i + 3]!;
      const comp = navOf(w).grid.component;
      const { owner, controller } = w.cells;
      const count = new Map<number, number>();
      for (let c = 0; c < owner.length; c++) if (owner[c] === n && controller[c] === n) count.set(comp[c]!, (count.get(comp[c]!) ?? 0) + 1);
      let most = -1;
      let mostCells = 0;
      for (const [l, k] of count) if (k > mostCells || (k === mostCells && l < most)) [most, mostCells] = [l, k];
      const cc = w.cities.cols;
      const land = comp[cc.cell[city]!]!;
      let possible = false;
      w.cities.forEach((id) => {
        const cell = cc.cell[id]!;
        if (owner[cell] === n && controller[cell] === n && comp[cell] === most) possible = true;
      });
      moves.push({ seed, day, nation: tag(n), city, land, landCells: count.get(land) ?? 0, most, mostCells, onMost: land === most, possible });
    }
    ev.length = 0;
    w.out.fires.length = 0;
  };
  for (day = 1; day <= days; day++) s.step(24, read);
  const mine = moves.filter((m) => m.seed === seed);
  console.log(`${seed} ${src}: moves ${mine.length}, on the most-held land ${mine.filter((m) => m.onMost).length}, possible ${mine.filter((m) => m.possible).length}; ${mine.filter((m) => !m.onMost).map((m) => `${m.nation} d${m.day} land ${m.land} (${m.landCells}) not ${m.most} (${m.mostCells})${m.possible ? '' : ' no city there'}`).join('; ')}`);
}
const total = { moves: moves.length, onMost: moves.filter((m) => m.onMost).length, possible: moves.filter((m) => m.possible).length, onMostOfPossible: moves.filter((m) => m.possible && m.onMost).length };
console.log(`total: ${JSON.stringify(total)}`);
writeFileSync(out, JSON.stringify({ days, total, moves }, null, 1));

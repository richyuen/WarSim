/**
 * PLAN 7.15 (critic run 7, dynamics 6: "Canada and Greenland stay whole for 30 years on 3 of 4
 * seeds"): yearly, the share of Canada's and Greenland's 1938 land (by cells) still owned by their
 * 1938 owner and held by it; who else owns or holds any; and every landing on their 1938 land.
 *
 * Usage: npx tsx tools/diag/northAmerica.ts <seed> [years = 30] [out = .cache/northAmerica_<seed>.json]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/sim';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { assets1938 } from '../../tests/helpers/earth';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const out = process.argv[4] ?? `.cache/northAmerica_${seed}.json`;
const { w: W, h: H } = SIZE_1938;
const s = new Sim({ scenario: '1938', seed, assets: assets1938(W) });
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const id = (t: string): number => TAGS_1938.indexOf(t) + 1;
const CAN = id('CAN');
const DEN = id('DEN');
// Greenland: Denmark's cells west of -10° and north of 59°N (Iceland is its own nation in 1938).
const [gx0] = cellOf(-75, 60, W, H);
const [gx1, gy1] = cellOf(-10, 59, W, H);
const lands: Record<string, number[]> = { CAN: [], GRL: [] };
for (let c = 0; c < W * H; c++) {
  const o = w.cells.owner[c]!;
  if (o === CAN) lands.CAN!.push(c);
  else if (o === DEN) {
    const x = c % W;
    const y = Math.floor(c / W);
    if (x >= gx0 && x <= gx1 && y <= gy1) lands.GRL!.push(c);
  }
}
const first: Record<string, number> = { CAN, GRL: DEN };
const isLand: Record<string, Set<number>> = { CAN: new Set(lands.CAN), GRL: new Set(lands.GRL) };
const landings: { day: number; on: string; nation: string }[] = [];
const yearly: Record<string, unknown>[] = [];
let day = 0;
for (let y = 0; y < years; y++) {
  for (let d = 0; d < 365; d++, day++) {
    s.step(24, (ww) => {
      const ev = ww.out.events;
      for (let i = 0; i < ev.length; i += 6) {
        if (ev[i + 1] !== EventKind.FormationLanded) continue;
        const c = Math.floor(ev[i + 5]!) * W + Math.floor(ev[i + 4]!);
        for (const k of ['CAN', 'GRL']) if (isLand[k]!.has(c)) landings.push({ day, on: k, nation: tag(ev[i + 3]!) });
      }
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
  }
  const row: Record<string, unknown> = { year: y + 1 };
  for (const k of ['CAN', 'GRL']) {
    const cells = lands[k]!;
    const owners = new Map<string, number>();
    const holders = new Map<string, number>();
    for (const c of cells) {
      const o = tag(w.cells.owner[c]!);
      const h = tag(w.cells.controller[c]!);
      owners.set(o, (owners.get(o) ?? 0) + 1);
      holders.set(h, (holders.get(h) ?? 0) + 1);
    }
    const own = (owners.get(tag(first[k]!)) ?? 0) / cells.length;
    row[k] = { owned: Math.round(own * 1000) / 1000, owners: Object.fromEntries(owners), holders: Object.fromEntries(holders), overlord: tag(w.nations.cols.overlord[first[k]!]!) };
  }
  yearly.push(row);
}
mkdirSync('.cache', { recursive: true });
writeFileSync(out, JSON.stringify({ seed, years, cells: { CAN: lands.CAN!.length, GRL: lands.GRL!.length }, landings, yearly }, null, 1));
process.stderr.write(`done: seed ${seed}; landings ${landings.length}; CAN owned at end ${JSON.stringify((yearly.at(-1) as Record<string, { owned: number }>).CAN!.owned)}, GRL ${JSON.stringify((yearly.at(-1) as Record<string, { owned: number }>).GRL!.owned)}\n`);

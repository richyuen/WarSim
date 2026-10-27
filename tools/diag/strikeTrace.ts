/**
 * PLAN 7.144's trace: one save stepped `days` days by the tree this runs in (and `AB`, the
 * temporary switches of the read), printing each day at hour 12: the land formations engaged by
 * nation tag, and, for the nations at war, their land formations, men, those moving to enemy-held
 * land, and the hour's strikes on their land formations (in contact / out of it).
 *
 * Usage: npx tsx tools/diag/strikeTrace.ts <seed> <state.bin> <days>
 */
import { readFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { EventKind } from '../../src/shared/events';
import { type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const days = Number(process.argv[4] ?? 20);
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(process.argv[3]!)));
const w = s.world;
const c = w.formations.cols;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const hits = new Map<number, [number, number]>();
const count = (ww: World): void => {
  const ev = ww.out.events;
  for (let i = 0; i < ev.length; i += 6) {
    if (ev[i + 1] !== EventKind.StrikeHit) continue;
    const g = ev[i + 2]!;
    if (!ww.formations.has(g) || ww.isFleet(g)) continue;
    const n = ww.formations.cols.nation[g]!;
    const h = hits.get(n) ?? [0, 0];
    h[ww.formations.cols.engaged[g] === 1 ? 0 : 1]++;
    hits.set(n, h);
  }
  ev.length = 0;
  ww.out.fires.length = 0;
};
const ctl = w.cells.controller;
for (let d = 0; d < days; d++) {
  hits.clear();
  s.step(12, count);
  const by = new Map<number, { eng: number; land: number; men: number; att: number }>();
  const atWar = new Set(w.wars.nations());
  w.formations.forEach((id) => {
    const n = c.nation[id]!;
    if (!atWar.has(n) || w.nations.cols.living[n] !== 1 || w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
    const b = by.get(n) ?? { eng: 0, land: 0, men: 0, att: 0 };
    b.land++;
    b.men += c.strength[id]!;
    if (c.engaged[id] === 1) b.eng++;
    if (c.moving[id] === 1 && w.wars.atWar(n, ctl[c.targetCell[id]!]!)) b.att++;
    by.set(n, b);
  });
  const parts = [...by].filter(([n, b]) => b.eng > 0 || (hits.get(n)?.[1] ?? 0) > 0).sort((a, b) => b[1].men - a[1].men).map(([n, b]) => `${tag(n)} e${b.eng} f${b.land} m${Math.round(b.men / 1000)}k a${b.att} h${(hits.get(n) ?? [0, 0]).join('/')}`);
  process.stdout.write(`day ${d}: ${parts.join(' | ')}\n`);
  s.step(12, count);
}

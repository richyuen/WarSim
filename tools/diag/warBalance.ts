/**
 * PLAN 7.138: how even the wars are. From a saved state (or 1938 after `skip` days), per war: each
 * side's land formations (not fleets, wings or aboard) and men, engaged, and the weaker side's share
 * of the two; summed per case: the land formations at war, those of the weaker sides (the most a war
 * can bring to contact on both sides is twice its weaker side), engaged.
 *
 * Usage: npx tsx tools/diag/warBalance.ts <out.json> <seed:state.bin|seed:1938:skipDays> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const cases = process.argv.slice(3).map((a) => {
  const [seed, bin, skip] = a.split(':');
  return { seed: Number(seed), bin: bin!, skip: Number(skip ?? 0) };
});
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const res: unknown[] = [];
for (const k of cases) {
  const s = new Sim({ scenario: '1938', seed: k.seed, assets: loadAssets1938(SIZE_1938.w) });
  const w = s.world;
  if (k.bin !== '1938') s.load(new Uint8Array(readFileSync(k.bin)));
  for (let d = 0; d < k.skip; d++) s.step(24, (ww) => ((ww.out.events.length = 0), (ww.out.fires.length = 0)));
  const c = w.formations.cols;
  const land = new Map<number, { f: number; men: number; eng: number }>();
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id) || w.offLand(id)) return;
    const n = c.nation[id]!;
    const r = land.get(n) ?? land.set(n, { f: 0, men: 0, eng: 0 }).get(n)!;
    r.f++;
    r.men += c.strength[id]!;
    if (c.engaged[id]) r.eng++;
  });
  const wars = w.wars.list.map((war) => {
    const side = (ns: number[]) => ns.reduce((a, n) => ({ f: a.f + (land.get(n)?.f ?? 0), men: a.men + (land.get(n)?.men ?? 0), eng: a.eng + (land.get(n)?.eng ?? 0) }), { f: 0, men: 0, eng: 0 });
    const a = side(war.sides[0]);
    const b = side(war.sides[1]);
    return { id: war.id, days: Math.floor((w.tick - war.startTick) / 24), a: war.sides[0].map(tag).join(' '), b: war.sides[1].map(tag).join(' '), af: a.f, bf: b.f, amen: a.men, bmen: b.men, eng: a.eng + b.eng, weakShare: Math.min(a.men, b.men) / Math.max(1, a.men + b.men) };
  });
  const tot = wars.reduce((t, x) => ({ f: t.f + x.af + x.bf, weak: t.weak + Math.min(x.af, x.bf), eng: t.eng + x.eng, even: t.even + (x.weakShare >= 0.25 ? 1 : 0) }), { f: 0, weak: 0, eng: 0, even: 0 });
  res.push({ seed: k.seed, bin: k.bin, skip: k.skip, wars, tot });
  process.stdout.write(`${k.seed} ${k.bin}:${k.skip} wars ${wars.length} even(>=25% men) ${tot.even}; formations ${tot.f}, weaker sides ${tot.weak}, engaged ${tot.eng}\n`);
  for (const x of wars) process.stdout.write(`  war ${x.id} ${x.days}d [${x.a}] ${x.af}f ${Math.round(x.amen / 1000)}k vs [${x.b}] ${x.bf}f ${Math.round(x.bmen / 1000)}k  eng ${x.eng} weak ${(x.weakShare * 100).toFixed(0)}%\n`);
}
writeFileSync(out, JSON.stringify(res, null, 1));

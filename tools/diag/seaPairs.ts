/**
 * PLAN 7.132: the sea battles of a game with a ticker row (a pair of fleets at war within a ship's
 * reach, `inShipReach`), from 1938 as it plays (no war declared), every hour for `days`: per battle,
 * its two sides, the hour its row first stood two hours running (a fight under way, as `seaRow1938`'s
 * Speed x1 test takes it), the pair's distance then and its least over the battle, and the two fleets'
 * kits. The cases of the AT are picked from here.
 *
 * Usage: npx tsx tools/diag/seaPairs.ts <seed> [days = 60] [wars, e.g. GER:POL,GER:ENG, declared at once]
 */
import { size1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { elementIndex } from '../../src/sim/systems/elements';
import { inShipReach, seaKm } from '../../src/sim/systems/navalCombat';
import type { SeaBattle, World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const days = Number(process.argv[3] ?? 60);
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
for (const war of (process.argv[4] ?? '').split(',').filter(Boolean)) {
  const [a, d] = war.split(':');
  sim.command({ kind: 'declareWar', attacker: TAGS_1938.indexOf(a!) + 1, defender: TAGS_1938.indexOf(d!) + 1 });
}

const kit = (w: World, f: number): string => {
  const units = w.rules!.units;
  const ec = w.elements.cols;
  const cls: Record<string, number> = {};
  for (const e of elementIndex(w).get(f) ?? []) if (ec.strength[e]! > 0) cls[units[ec.unit[e]!]!.cls] = (cls[units[ec.unit[e]!]!.cls] ?? 0) + 1;
  return `${tag(w.formations.cols.nation[f]!)}${JSON.stringify(cls)}`;
};

type Track = { a: string; b: string; rowRun: number; firstHour: number; firstKm: number; minKm: number; pair: string; hours: number };
const tracks = new Map<SeaBattle, Track>();
const done: Track[] = [];
for (let t = 0; t < days * 24; t++) {
  sim.step(1, (w) => {
    const c = w.formations.cols;
    for (const rec of w.seaBattles) {
      let tr = tracks.get(rec);
      if (!tr) tracks.set(rec, (tr = { a: tag(rec.a), b: tag(rec.b), rowRun: 0, firstHour: -1, firstKm: 0, minKm: Infinity, pair: '', hours: 0 }));
      tr.hours++;
      const live = rec.fleets.filter((f) => w.formations.has(f));
      let best = Infinity;
      let bp: [number, number] | null = null;
      for (let i = 0; i < live.length; i++)
        for (let j = i + 1; j < live.length; j++) {
          const [f, g] = [live[i]!, live[j]!];
          if (!w.wars.atWar(c.nation[f]!, c.nation[g]!) || !inShipReach(w, f, g)) continue;
          const km = seaKm(w, c.x[f]!, c.y[f]!, c.x[g]!, c.y[g]!);
          if (km < best) [best, bp] = [km, [f, g]];
        }
      tr.rowRun = bp ? tr.rowRun + 1 : 0;
      if (bp) tr.minKm = Math.min(tr.minKm, best);
      if (bp && tr.rowRun === 2 && tr.firstHour < 0) {
        tr.firstHour = w.tick;
        tr.firstKm = Math.round(best * 10) / 10;
        tr.pair = `${kit(w, bp[0])} | ${kit(w, bp[1])}`;
      }
    }
    for (const [rec, tr] of tracks) {
      if (w.seaBattles.includes(rec)) continue;
      done.push(tr);
      tracks.delete(rec);
    }
    w.out.events.length = 0;
    w.out.fires.length = 0;
  });
}
done.push(...tracks.values());
for (const tr of done) {
  if (tr.firstHour < 0) continue;
  console.log(`seed ${seed} h${tr.firstHour} (day ${Math.floor(tr.firstHour / 24)}) ${tr.a}/${tr.b}: ${tr.hours} h, pair ${tr.firstKm} km (least ${tr.minKm.toFixed(1)}): ${tr.pair}`);
}
console.log(`done: seed ${seed}`);

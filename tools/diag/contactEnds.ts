/**
 * PLAN 7.113's read of how land contact ends: from 1938, hour by hour in years 2–`years`, each land
 * formation of a living nation engaged in the hour before is followed into the next. Its contact ends
 * as: destroyed with a strike on it (`StrikeHit`) in the last 24 hours (`destroyedStruck`), destroyed
 * without (`destroyedLand`), retreating (`retreat`), or otherwise out of contact (`disengaged`). Also
 * counted: strikes on land formations engaged and not engaged (`struckEngaged`, `struckRear`), land
 * formations destroyed by cause (struck in the last 24 hours or not) whether engaged or not, and air
 * battles. Per year.
 *
 * Usage: npx tsx tools/diag/contactEnds.ts <seed> [years = 8] [out = .cache/contactEnds_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { EventKind } from '../../src/shared/events';
import { loadAssets1938 } from '../headless/assets';
import type { World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 8);
const out = process.argv[4] ?? `.cache/contactEnds_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });

const isLand = (ww: World, id: number): boolean => ww.formations.has(id) && !ww.isWing(id) && !ww.isFleet(id) && !ww.offLand(id) && ww.nations.cols.living[ww.formations.cols.nation[id]!] === 1;
let engagedBefore = new Set<number>();
const lastStruck = new Map<number, number>();
const rows: Record<string, number>[] = [];
for (let y = 1; y <= years; y++) {
  const r: Record<string, number> = { year: y };
  const add = (k: string, v = 1): void => {
    r[k] = (r[k] ?? 0) + v;
  };
  for (let d = 0; d < 365; d++) {
    s.step(24, (ww) => {
      const ev = ww.out.events;
      const c = ww.formations.cols;
      const destroyed = new Set<number>();
      for (let i = 0; i < ev.length; i += 6) {
        const kind = ev[i + 1];
        const g = ev[i + 2]!;
        if (kind === EventKind.StrikeHit) {
          lastStruck.set(g, ww.tick);
          if (y >= 2) add(engagedBefore.has(g) ? 'struckEngaged' : 'struckRear');
        } else if (kind === EventKind.FormationDestroyed) destroyed.add(g);
        else if (kind === EventKind.AirBattle && y >= 2) add('airBattles');
      }
      ev.length = 0;
      ww.out.fires.length = 0;
      const struckRecently = (g: number): boolean => ww.tick - (lastStruck.get(g) ?? -Infinity) <= 24;
      if (y >= 2) {
        for (const g of engagedBefore) {
          if (destroyed.has(g) || !ww.formations.has(g)) add(struckRecently(g) ? 'end.destroyedStruck' : 'end.destroyedLand');
          else if (c.engaged[g] === 1) continue;
          else if (c.retreat[g] !== 0) add('end.retreat');
          else add('end.disengaged');
          add('end');
        }
        for (const g of destroyed) if (!engagedBefore.has(g) && lastStruck.has(g)) add(struckRecently(g) ? 'rearDestroyedStruck' : 'rearDestroyedOther');
      }
      for (const g of destroyed) lastStruck.delete(g);
      const now = new Set<number>();
      ww.formations.forEach((id) => {
        if (c.engaged[id] === 1 && isLand(ww, id)) now.add(id);
      });
      if (y >= 2) add('engagedHours', now.size);
      engagedBefore = now;
    });
  }
  rows.push(r);
  process.stderr.write(`${seed} year ${y}: ${JSON.stringify(r)}\n`);
}
writeFileSync(out, JSON.stringify({ seed, years, rows, hash: s.hash().toString(16) }, null, 1));
console.log(`done: ${seed}`);

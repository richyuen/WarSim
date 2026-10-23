/**
 * PLAN 7.99's check: whether the missions at the enemy's air and ships meet anything. A wing's
 * mission is PLAN 7.99's when its role is a fighter's or a striker's and its target is an airbase
 * held by a nation at war with it, or a fleet afloat of such a nation with the wing not a naval
 * bomber. Hourly: each `AirBattle` is counted, and as one of 7.99's where such a sortie aloft is within
 * `INTERCEPT_KM` of its place; each such sortie (by wing and launch) is counted once, and as one that
 * fought where it was within `INTERCEPT_KM` of a battle in its hour.
 *
 * Usage: npx tsx tools/diag/airSweeps.ts <seed> [years = 10] [out = .cache/airSweeps_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { EventKind } from '../../src/shared/events';
import { loadAssets1938 } from '../headless/assets';
import { roleOf } from '../../src/sim/ai/air';
import { INTERCEPT_KM } from '../../src/sim/systems/airCombat';
import { loopW } from '../../src/sim/systems/elements';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { sortieAt } from '../../src/sim/systems/sorties';
import type { World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 10);
const out = process.argv[4] ?? `.cache/airSweeps_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });

/** Whether wing `id`'s mission is PLAN 7.99's, and at what. */
function sweep(w: World, id: number): 'base' | 'fleet' | null {
  const m = w.wingMission.get(id);
  const role = roleOf(w, id);
  if (!m || (role !== 'patrol' && role !== 'front' && role !== 'naval')) return null;
  const n = w.formations.cols.nation[id]!;
  for (const b of w.airbases) {
    const [x, y] = w.cellPoint(b.cell);
    if (x === m.x && y === m.y && w.wars.atWar(n, w.cells.controller[b.cell]!)) return 'base';
  }
  if (role === 'naval') return null;
  const c = w.formations.cols;
  let fleet = false;
  w.formations.forEach((g) => {
    if (!fleet && w.isFleet(g) && c.x[g] === m.x && c.y[g] === m.y && w.wars.atWar(n, c.nation[g]!)) fleet = true;
  });
  return fleet ? 'fleet' : null;
}

const rows: Record<string, number>[] = [];
for (let y = 1; y <= years; y++) {
  const r: Record<string, number> = { year: y, battles: 0, battlesWithSweep: 0, sorties: 0, sortiesBase: 0, sortiesFleet: 0, fought: 0, foughtBase: 0, foughtFleet: 0 };
  const seen = new Map<string, { kind: 'base' | 'fleet'; fought: boolean }>();
  for (let h = 0; h < 365 * 24; h++) {
    s.step(1, (w) => {
      const ev = w.out.events;
      const places: [number, number][] = [];
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.AirBattle) places.push([ev[i + 4]!, ev[i + 5]!]);
      ev.length = 0;
      w.out.fires.length = 0;
      r.battles! += places.length;
      const near = new Array<boolean>(places.length).fill(false);
      for (const [id, so] of w.sorties) {
        const k = sweep(w, id);
        if (!k) continue;
        const key = `${id}:${so.launch}`;
        let e = seen.get(key);
        if (!e) seen.set(key, (e = { kind: k, fought: false }));
        const at = sortieAt(so, w.tick, loopW(w));
        places.forEach(([x, yy], i) => {
          if (seaKm(w, at.x, at.y, x, yy) <= INTERCEPT_KM) {
            near[i] = true;
            e.fought = true;
          }
        });
      }
      r.battlesWithSweep! += near.filter(Boolean).length;
    });
  }
  for (const e of seen.values()) {
    r.sorties!++;
    r[e.kind === 'base' ? 'sortiesBase' : 'sortiesFleet']!++;
    if (e.fought) {
      r.fought!++;
      r[e.kind === 'base' ? 'foughtBase' : 'foughtFleet']!++;
    }
  }
  rows.push(r);
  process.stderr.write(`${seed} year ${y}: ${JSON.stringify(r)}\n`);
}
writeFileSync(out, JSON.stringify({ seed, years, rows }, null, 1));
console.log(`done: ${seed} ${years} years`);

/**
 * PLAN 7.141's AT read: from 1938 (or `LOAD`), for `years` years, one row a year:
 * - `strikeH`: hours with a carrier strike in the air (`carrierStrikes`, the critic's `c16_cvworld.ts` count; the AT's figure);
 * - `cvBattleH`: hours with a carrier's fleet in a sea battle;
 * - `cvMissionH`: hours with a wing based on a carrier (`wingBase` < 0) holding a mission of its own (`wingMission`);
 * - `battles`, `sunk`: sea battles fought (`SeaBattle` rows) and ships sunk in them;
 * and at the year's end: `transports` (transport ships afloat), `carriers` (carriers afloat) and `manned` (of them with
 * a wing aboard), `warships` (armed ships afloat: a gun or torpedoes, no submarine), `training` (fleets in training by
 * template id).
 *
 * Usage: npx tsx tools/diag/carrierAt.ts <seed> [years = 20] [out = .cache/carrierAt_<seed>.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { seaSide } from '../../src/shared/history';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { elementIndex } from '../../src/sim/systems/elements';
import { liveCarriers } from '../../src/sim/systems/air';
import { carrierStrikes } from '../../src/sim/systems/navalCombat';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 20);
const out = process.argv[4] ?? `.cache/carrierAt_${seed}.json`;
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(size1938(undefined).w) });
if (process.env.LOAD) sim.load(new Uint8Array(readFileSync(process.env.LOAD)));
const rows: Record<string, unknown>[] = [];
const t0 = Date.now();
for (let year = 1; year <= years; year++) {
  const y = { year, strikeH: 0, cvBattleH: 0, cvMissionH: 0, battles: 0, sunk: 0 };
  sim.step(24 * 365, (w) => {
    const ev = w.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      if (ev[i + 1] !== EventKind.SeaBattle) continue;
      y.battles++;
      y.sunk += seaSide(ev[i + 2]!).ships + seaSide(ev[i + 3]!).ships;
    }
    ev.length = 0;
    w.out.fires.length = 0;
    if (w.seaBattles.length > 0) {
      if (carrierStrikes(w).length > 0) y.strikeH++;
      if (w.seaBattles.some((r) => r.fleets.some((f) => w.formations.has(f) && liveCarriers(w, f) > 0))) y.cvBattleH++;
    }
    for (const [id, base] of w.wingBase) {
      if (base < 0 && w.wingMission.get(id)?.kind === 'strike') {
        y.cvMissionH++;
        break;
      }
    }
  });
  const w = sim.world;
  const units = w.rules!.units;
  const ec = w.elements.cols;
  const idx = elementIndex(w);
  let transports = 0;
  let carriers = 0;
  let manned = 0;
  let warships = 0;
  const aboard = new Map<number, number>();
  for (const [id, base] of w.wingBase) if (base < 0 && w.formations.has(id)) aboard.set(-base, (aboard.get(-base) ?? 0) + 1);
  w.formations.forEach((id) => {
    if (!w.isFleet(id)) return;
    for (const e of idx.get(id) ?? []) {
      if (ec.strength[e]! <= 0) continue;
      const u = units[ec.unit[e]!]!;
      if (u.cls === 'tp') transports++;
      if (u.cls !== 'ss' && (u.hard > 0 || u.torpedo > 0)) warships++;
    }
    const k = liveCarriers(w, id);
    carriers += k;
    manned += Math.min(k, aboard.get(id) ?? 0);
  });
  const training: Record<string, number> = {};
  const pc = w.production.cols;
  w.production.forEach((p) => {
    const t = w.rules!.templates[pc.template[p]!]!;
    if (t.domain === 1) training[pc.template[p]!] = (training[pc.template[p]!] ?? 0) + 1;
  });
  const row = { ...y, transports, carriers, manned, warships, training };
  rows.push(row);
  console.log(JSON.stringify(row), `${Math.round((Date.now() - t0) / 1000)} s`);
}
writeFileSync(out, JSON.stringify({ seed, years, rows }, null, 1));
console.log('done:');

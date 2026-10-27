/**
 * PLAN 7.148's read: why fewer sea battles under ADR-738 (carrier wings fly their own missions). From 1938 (or
 * `LOAD`, a checkpoint), for `years` years, one row a year:
 * - `battles`, `sunk`: sea battles fought (`SeaBattle` rows) and ships sunk in them (the AT's figures);
 * - ships lost by fleets each hour, by what struck them: `lostBattle` (the fleet in a sea battle that hour),
 *   `lostCv` (out of a battle, struck by a carrier's wing: `StrikeHit`, the wing's base < 0), `lostLand` (out of a
 *   battle, struck by a land-based wing), `lostOther` (anything else: supply, the end of a fleet at a merge);
 * - `cvOwnH`: hours with a carrier wing's own strike sortie aloft (as `carrierAt.ts`);
 * and at the year's end `warships` (armed ships afloat: a gun or torpedoes, no submarine) and `carriers`.
 *
 * The read's arms were environment switches in the sim, removed after it (`docs/evidence/7.148/read.md`): `NOCV=1`
 * (no carrier wing takes a mission, as before ADR-738), `CVSEE=1` (a fleet finds sea battles by its carriers' wings
 * aloft too). On HEAD the tool runs HEAD's rule whatever is set; the arm in its file is the switch's name only.
 *
 * Usage: npx tsx tools/diag/seaChannels.ts <seed> [years = 5] [out = .cache/seaChannels_<seed>.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { seaSide } from '../../src/shared/history';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { elementIndex, loopW } from '../../src/sim/systems/elements';
import { Leg, sortieAt } from '../../src/sim/systems/sorties';
import { liveCarriers } from '../../src/sim/systems/air';
import { Domain, type World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 5);
const out = process.argv[4] ?? `.cache/seaChannels_${seed}.json`;
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(size1938(undefined).w) });
if (process.env.LOAD) sim.load(new Uint8Array(readFileSync(process.env.LOAD)));

/** Each fleet's live ships. */
function shipsByFleet(w: World): Map<number, number> {
  const m = new Map<number, number>();
  const ec = w.elements.cols;
  const units = w.rules!.units;
  for (const [f, els] of elementIndex(w)) {
    if (!w.formations.has(f) || !w.isFleet(f)) continue;
    let n = 0;
    for (const e of els) if (ec.strength[e]! > 0 && units[ec.unit[e]!]!.domain === Domain.sea) n += ec.strength[e]!;
    m.set(f, n);
  }
  return m;
}

const rows: Record<string, unknown>[] = [];
const t0 = Date.now();
let prev = shipsByFleet(sim.world);
for (let year = 1; year <= years; year++) {
  const y = { year, battles: 0, sunk: 0, lostBattle: 0, lostCv: 0, lostLand: 0, lostOther: 0, cvOwnH: 0 };
  sim.step(24 * 365, (w) => {
    const ev = w.out.events;
    const inBattle = new Set<number>();
    for (const r of w.seaBattles) for (const f of r.fleets) inBattle.add(f);
    const cvHit = new Set<number>();
    const landHit = new Set<number>();
    for (let i = 0; i < ev.length; i += 6) {
      const kind = ev[i + 1];
      if (kind === EventKind.SeaBattle) {
        y.battles++;
        y.sunk += seaSide(ev[i + 2]!).ships + seaSide(ev[i + 3]!).ships;
      } else if (kind === EventKind.StrikeHit) {
        const g = ev[i + 2]!;
        if (!prev.has(g)) continue; // a land formation
        if ((w.wingBase.get(ev[i + 3]!) ?? 0) < 0) cvHit.add(g);
        else landHit.add(g);
      }
    }
    ev.length = 0;
    w.out.fires.length = 0;
    const now = shipsByFleet(w);
    for (const [f, before] of prev) {
      const lost = before - (now.get(f) ?? 0);
      if (lost <= 0) continue;
      if (inBattle.has(f)) y.lostBattle += lost;
      else if (cvHit.has(f)) y.lostCv += lost;
      else if (landHit.has(f)) y.lostLand += lost;
      else y.lostOther += lost;
    }
    prev = now;
    for (const [id, base] of w.wingBase) {
      const s = base < 0 && w.wingMission.get(id)?.kind === 'strike' ? w.sorties.get(id) : undefined;
      if (s && w.tick >= s.launch && sortieAt(s, w.tick, loopW(w)).leg !== Leg.Home) {
        y.cvOwnH++;
        break;
      }
    }
  });
  const w = sim.world;
  const units = w.rules!.units;
  const ec = w.elements.cols;
  const idx = elementIndex(w);
  let warships = 0;
  let carriers = 0;
  w.formations.forEach((id) => {
    if (!w.isFleet(id)) return;
    for (const e of idx.get(id) ?? []) {
      if (ec.strength[e]! <= 0) continue;
      const u = units[ec.unit[e]!]!;
      if (u.cls !== 'ss' && (u.hard > 0 || u.torpedo > 0)) warships++;
    }
    carriers += liveCarriers(w, id);
  });
  const row = { ...y, warships, carriers };
  rows.push(row);
  console.log(JSON.stringify(row), `${Math.round((Date.now() - t0) / 1000)} s`);
}
writeFileSync(out, JSON.stringify({ seed, years, arm: process.env.NOCV === '1' ? 'nocv' : process.env.CVSEE === '1' ? 'cvsee' : 'head', load: process.env.LOAD ?? null, rows }, null, 1));
console.log('done:');

/**
 * PLAN 7.155's AT read: from 1938, for `years` years, one row a year:
 * - `refused`: fleet sailings `orderSail` refused for no sea way (`MoveRejected`, `RejectReason.NoSeaWay`, by a fleet);
 * - `landed`, `repulsed`: formations landed from the sea (`FormationLanded`) and landings thrown back (`LandingRepulsed`);
 * and at the year's end `transports` (transport ships afloat, as `carrierAt.ts` counts them).
 * PLAN 7.156's: `standNoZone`, fleet-hours standing (not under way) on a cell of no sea zone; `refusedNoZone`, the
 * refusals of a fleet that stands on one at the hour's end.
 *
 * Usage: npx tsx tools/diag/seaWayAt.ts <seed> [years = 20] [out = .cache/seaWayAt_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { EventKind, RejectReason } from '../../src/shared/events';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { elementIndex } from '../../src/sim/systems/elements';
import { seaOf } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 20);
const out = process.argv[4] ?? `.cache/seaWayAt_${seed}.json`;
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(size1938(undefined).w) });
const rows: Record<string, number>[] = [];
for (let year = 1; year <= years; year++) {
  const y = { year, refused: 0, landed: 0, repulsed: 0, transports: 0, standNoZone: 0, refusedNoZone: 0 };
  sim.step(24 * 365, (w) => {
    const ev = w.out.events;
    const zoneOf = seaOf(w).zoneOf;
    const cw = w.cells.w;
    const fc = w.formations.cols;
    const noZone = (id: number): boolean => zoneOf[Math.floor(fc.y[id]!) * cw + Math.floor(fc.x[id]!)] === 0;
    w.formations.forEach((id) => {
      if (fc.moving[id] === 0 && w.isFleet(id) && noZone(id)) y.standNoZone++;
    });
    for (let i = 0; i < ev.length; i += 6) {
      const kind = ev[i + 1];
      if (kind === EventKind.MoveRejected && ev[i + 4] === RejectReason.NoSeaWay && w.formations.has(ev[i + 2]!) && w.isFleet(ev[i + 2]!)) {
        y.refused++;
        if (noZone(ev[i + 2]!)) y.refusedNoZone++;
      } else if (kind === EventKind.FormationLanded) y.landed++;
      else if (kind === EventKind.LandingRepulsed) y.repulsed++;
    }
    ev.length = 0;
    w.out.fires.length = 0;
  });
  const w = sim.world;
  const units = w.rules!.units;
  const ec = w.elements.cols;
  const idx = elementIndex(w);
  w.formations.forEach((id) => {
    if (!w.isFleet(id)) return;
    for (const e of idx.get(id) ?? []) if (ec.strength[e]! > 0 && units[ec.unit[e]!]!.cls === 'tp') y.transports++;
  });
  rows.push(y);
  console.log(JSON.stringify(y));
}
writeFileSync(out, JSON.stringify({ seed, years, rows }, null, 1));
console.log(`done: ${out}`);

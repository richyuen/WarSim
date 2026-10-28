/**
 * PLAN 7.154b's read: who orders the fleet sailings `orderSail` refuses for no sea way (`RejectReason.NoSeaWay`;
 * on 1411–1416 × 20 years 3 × as many on HEAD `87c93a6b` as on `7b883084`, `seaWars.ts`). From 1938, for `years`
 * years: each refusal by its caller (the first stack frame outside `sail.ts`), the fleet's kind (warfleet with power,
 * carrier group, transports, submarines), whether it is under way, its nation; and how many distinct fleets, and how
 * many fleet-days refused more than once (a fleet that asks every day).
 *
 * Usage: npx tsx tools/diag/noSeaWay.ts <seed> [years = 5] [out = .cache/noSeaWay_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { EventKind, RejectReason } from '../../src/shared/events';
import { size1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { liveCarriers } from '../../src/sim/systems/air';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { fleetPower } from '../../src/sim/systems/seaControl';
import type { World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 5);
const out = process.argv[4] ?? `.cache/noSeaWay_${seed}.json`;
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(size1938(undefined).w) });
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;

const inc = (m: Record<string, number>, k: string): void => {
  m[k] = (m[k] ?? 0) + 1;
};
const kindOf = (w: World, id: number): string => {
  if (!w.formations.has(id)) return 'gone';
  if (liveCarriers(w, id) > 0) return 'carrier';
  if (fleetPower(w, id) > 0) return 'warfleet';
  if (transportRoom(w, id) > 0) return 'transports';
  return 'other';
};
const caller = (): string => {
  const lines = (new Error().stack ?? '').split('\n').slice(1);
  const frames = lines.filter((l) => !l.includes('noSeaWay.ts') && !l.includes('world.ts') && !l.includes('sail.ts'));
  return frames
    .slice(0, 2)
    .map((l) => l.trim().replace(/^at /, '').replace(/\(.*[\\/]src[\\/]/, '(').replace(/:\d+\)$/, ')'))
    .join(' < ');
};

type Year = { year: number; refused: number; byCaller: Record<string, number>; byKind: Record<string, number>; byNation: Record<string, number>; moving: number; fleets: number; repeatDays: number };
const rows: Year[] = [];
let world: World | undefined;
let y: Year | undefined;
const perFleetDay = new Map<string, number>();
const fleets = new Set<number>();
let patched = false;
for (let year = 1; year <= years; year++) {
  y = { year, refused: 0, byCaller: {}, byKind: {}, byNation: {}, moving: 0, fleets: 0, repeatDays: 0 };
  perFleetDay.clear();
  fleets.clear();
  sim.step(24 * 365, (w) => {
    if (!patched) {
      world = w;
      const out = w.out;
      const emit = out.emit.bind(out);
      out.emit = (tick: number, kind: EventKind, a: number, b: number, x: number, yy: number): void => {
        if (kind === EventKind.MoveRejected && x === RejectReason.NoSeaWay && world!.formations.has(a) && world!.isFleet(a) && y) {
          y.refused++;
          inc(y.byCaller, caller());
          inc(y.byKind, kindOf(world!, a));
          inc(y.byNation, tag(world!.formations.cols.nation[a]!));
          if (world!.formations.cols.moving[a] === 1) y.moving++;
          fleets.add(a);
          const k = `${a}@${Math.floor(tick / 24)}`;
          perFleetDay.set(k, (perFleetDay.get(k) ?? 0) + 1);
        }
        emit(tick, kind, a, b, x, yy);
      };
      patched = true;
    }
    w.out.events.length = 0;
    w.out.fires.length = 0;
  });
  y.fleets = fleets.size;
  y.repeatDays = [...perFleetDay.values()].filter((v) => v > 1).length;
  y.byNation = Object.fromEntries(Object.entries(y.byNation).sort((p, q) => q[1] - p[1]).slice(0, 8));
  rows.push(y);
  console.log(JSON.stringify(y));
}
writeFileSync(out, JSON.stringify({ seed, years, rows }, null, 1));
console.log(`done: ${out}`);

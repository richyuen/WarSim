/**
 * PLAN 7.39a: why the war at sea stops after year 1 (critic R10-B2: a mean of 38 sea battles a world
 * in year 1, 2.7 a world-year in years 2–30, `critic/c10_summary.txt`).
 *
 * From 1938, for `years` years, per year:
 * - the sea battles (`SeaBattle` rows): all, those that sank nothing, the ships sunk;
 * - the fleets' orders refused (`MoveRejected` of a fleet), by reason;
 * - weekly at 01:00 (an hour after the naval AI), each war's sides by navy (a side has one when a
 *   nation of it has a fleet with power, `fleetPower`): `both`, `coast` (one side's navy against a
 *   side that holds a port on open water of a key the navy's fleets stand on, `waterKeys`), `land`
 *   (against a side with no such port), `neither`;
 * - weekly, every armed fleet of a nation at war: under way, in a sea battle, or what the naval AI's
 *   `plan` does with it (`sortieWhy`, `tools/diag/seaWhy.ts`), split by whether its nation is at
 *   war with a navy; the nations most often in each; for those on station at war with a navy, why
 *   the nearest enemy fleet is not hunted (`preyWhy`).
 * Counts are week-samples (a fleet-week, a war-week).
 *
 * Usage: npx tsx tools/diag/seaWars.ts <seed> [years = 30] [out = .cache/seaWars_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { EventKind, RejectReason } from '../../src/shared/events';
import { seaSide } from '../../src/shared/history';
import { size1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { fleetPower } from '../../src/sim/systems/seaControl';
import { keyAt, waterKeys } from '../../src/sim/ai/naval';
import { portSeaOf, seaOf, type World } from '../../src/sim/world';
import { farBase, preyWhy, sortieWhy, whyCtx, type Prey, type Why } from './seaWhy';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const out = process.argv[4] ?? `.cache/seaWars_${seed}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const reason = Object.fromEntries(Object.entries(RejectReason).map(([k, v]) => [v, k]));

type Bucket = Why | 'moving' | 'engaged';
type Year = {
  year: number;
  battles: number;
  zero: number;
  shipsSunk: number;
  rejected: Record<string, number>;
  weeks: number;
  wars: { both: number; coast: number; land: number; neither: number };
  /** Fleet-weeks of nations at war with a navy, and of those at war with none. */
  vsNavy: Partial<Record<Bucket, number>>;
  vsNone: Partial<Record<Bucket, number>>;
  who: Partial<Record<Bucket, Record<string, number>>>;
  /** Fleet-weeks on station (`awayStation`) at war with a navy, by why the nearest enemy fleet is not hunted (`preyWhy`). */
  prey: Partial<Record<Prey, number>>;
  /** Of those `far` (PLAN 7.39b): a bloc port with the enemy fleet in reach (`farBase`), none, or that fleet's zone over the navy. */
  far: Record<string, number>;
};
const rows: Year[] = [];
const t0 = Date.now();

const sample = (w: World, y: Year): void => {
  const c = w.formations.cols;
  const z = seaOf(w);
  const water = portSeaOf(w);
  const armed = new Map<number, number[]>();
  w.formations.forEach((id) => {
    if (!w.isFleet(id) || fleetPower(w, id) <= 0) return;
    const n = c.nation[id]!;
    let l = armed.get(n);
    if (!l) armed.set(n, (l = []));
    l.push(id);
  });
  const keys = new Map<number, Int32Array>();
  const keysOf = (n: number): Int32Array => {
    let k = keys.get(n);
    if (!k) keys.set(n, (k = waterKeys(w, n)));
    return k;
  };
  // Each war's sides by navy.
  for (const war of w.wars.list) {
    const [s0, s1] = war.sides;
    const navy0 = s0.some((n) => armed.has(n));
    const navy1 = s1.some((n) => armed.has(n));
    if (navy0 && navy1) y.wars.both++;
    else if (!navy0 && !navy1) y.wars.neither++;
    else {
      const [navy, other] = navy0 ? [s0, s1] : [s1, s0];
      // The keys the navy's fleets stand on, each by its nation's waters.
      const on = new Set<number>();
      for (const n of navy) for (const f of armed.get(n) ?? []) on.add(keyAt(w, keysOf(n), c.x[f]!, c.y[f]!));
      const holders = new Set(other);
      const coast = w.ports.some((p, i) => {
        const at = water[i]!;
        if (at < 0 || !holders.has(w.cells.controller[p.cell]!)) return false;
        const zone = z.zoneOf[at]!;
        if (zone === 0 || z.closed[zone] === 1) return false;
        return navy.some((n) => on.has(keysOf(n)[zone]!));
      });
      if (coast) y.wars.coast++;
      else y.wars.land++;
    }
  }
  // Every armed fleet of a nation at war.
  const ctx = whyCtx(w);
  for (const [n, list] of [...armed].sort((a, b) => a[0] - b[0])) {
    if (!w.wars.list.some((war) => war.sides[0].includes(n) || war.sides[1].includes(n))) continue;
    const vsNavy = [...armed.keys()].some((m) => w.wars.atWar(n, m));
    const into = vsNavy ? y.vsNavy : y.vsNone;
    for (const f of list) {
      const b: Bucket = c.engaged[f] === 1 ? 'engaged' : c.moving[f] === 1 ? 'moving' : sortieWhy(ctx, f).why;
      into[b] = (into[b] ?? 0) + 1;
      if (vsNavy && b === 'awayStation') {
        const q = preyWhy(ctx, f);
        y.prey[q] = (y.prey[q] ?? 0) + 1;
        if (q === 'far') {
          const b = farBase(ctx, f);
          y.far[b] = (y.far[b] ?? 0) + 1;
        }
      }
      const who = (y.who[b] ??= {});
      const k = `${tag(n)}${vsNavy ? '' : '*'}`;
      who[k] = (who[k] ?? 0) + 1;
    }
  }
  y.weeks++;
};

for (let year = 1; year <= years; year++) {
  const y: Year = { year, battles: 0, zero: 0, shipsSunk: 0, rejected: {}, weeks: 0, wars: { both: 0, coast: 0, land: 0, neither: 0 }, vsNavy: {}, vsNone: {}, who: {}, prey: {}, far: {} };
  sim.step(24 * 365, (w) => {
    const ev = w.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      const k = ev[i + 1];
      if (k === EventKind.SeaBattle) {
        const a = seaSide(ev[i + 2]!);
        const b = seaSide(ev[i + 3]!);
        y.battles++;
        if (a.ships + b.ships === 0) y.zero++;
        y.shipsSunk += a.ships + b.ships;
      } else if (k === EventKind.MoveRejected && w.isFleet(ev[i + 2]!)) {
        const r = reason[ev[i + 4]!] ?? String(ev[i + 4]);
        y.rejected[r] = (y.rejected[r] ?? 0) + 1;
      }
    }
    ev.length = 0;
    w.out.fires.length = 0;
    if (w.tick % (24 * 7) === 1) sample(w, y);
  });
  for (const b of Object.keys(y.who) as Bucket[]) y.who[b] = Object.fromEntries(Object.entries(y.who[b]!).sort((p, q) => q[1] - p[1]).slice(0, 6));
  rows.push(y);
  const { who: _who, ...rest } = y;
  console.log(JSON.stringify(rest));
}
writeFileSync(out, JSON.stringify({ seed, years, wallS: Math.round((Date.now() - t0) / 1000), rows }, null, 1));
console.log(`done: ${out}`);

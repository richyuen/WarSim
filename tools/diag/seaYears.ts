/**
 * PLAN 7.35d1: why the sea battles fall after year 1 (critic R9, naval 6: on its 14 headless seeds,
 * 36 `SeaBattle` rows in year 1 against 13 a world-year after, `critic/c9_headless_*.json`).
 *
 * From 1938, for `years` years, per year:
 * - the sea battles ended (`SeaBattle` rows): all, those that sank a ship, the ships sunk, and the
 *   nation pairs with the most;
 * - each day at 01:00 (an hour after the naval AI), the armed fleets (`fleetPower` > 0) and their
 *   power; the nations with one; the pairs of nations at war that both have an armed fleet in one
 *   basin (`basinAt`), their fleets' power, and how many of those fleets are under way. Means per day.
 * The figures tell where the fall is: the navies gone (power), no two navies at war (pairs), or
 * navies at war that stay in port (under way).
 *
 * Usage: npx tsx tools/diag/seaYears.ts <seed> <years> [out = .cache/seaYears_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { seaSide } from '../../src/shared/history';
import { size1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { basinAt } from '../../src/sim/systems/navalCombat';
import { fleetPower } from '../../src/sim/systems/seaControl';
import type { World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const out = process.argv[4] ?? `.cache/seaYears_${seed}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;

type Year = {
  year: number;
  battles: number;
  sinking: number;
  shipsSunk: number;
  pairs: Record<string, { battles: number; ships: number }>;
  fleets: number;
  power: number;
  navies: number;
  warPairs: number;
  seaPairs: number;
  seaPairFleets: number;
  seaPairPower: number;
  underWay: number;
};
const rows: Year[] = [];
const t0 = Date.now();

/** The day's sample: armed fleets, navies, and the pairs at war with an armed fleet each in one basin. */
const sample = (w: World, y: Year): void => {
  const c = w.formations.cols;
  const byNation = new Map<number, { id: number; power: number; basin: number; moving: boolean }[]>();
  w.formations.forEach((id) => {
    if (!w.isFleet(id)) return;
    const p = fleetPower(w, id);
    if (p <= 0) return;
    y.fleets++;
    y.power += p;
    const n = c.nation[id]!;
    let l = byNation.get(n);
    if (!l) byNation.set(n, (l = []));
    l.push({ id, power: p, basin: basinAt(w, c.x[id]!, c.y[id]!), moving: c.moving[id] === 1 });
  });
  y.navies += byNation.size;
  const atWar = [...w.wars.nations()].sort((a, b) => a - b);
  const counted = new Set<number>();
  for (let i = 0; i < atWar.length; i++) {
    for (let j = i + 1; j < atWar.length; j++) {
      const a = atWar[i]!;
      const b = atWar[j]!;
      if (!w.wars.atWar(a, b)) continue;
      y.warPairs++;
      const fa = byNation.get(a);
      const fb = byNation.get(b);
      if (!fa || !fb) continue;
      const shared = new Set(fa.map((f) => f.basin).filter((k) => fb.some((g) => g.basin === k)));
      if (shared.size === 0) continue;
      y.seaPairs++;
      for (const f of [...fa, ...fb]) {
        if (!shared.has(f.basin) || counted.has(f.id)) continue;
        counted.add(f.id);
        y.seaPairFleets++;
        y.seaPairPower += f.power;
        if (f.moving) y.underWay++;
      }
    }
  }
};

for (let year = 1; year <= years; year++) {
  const y: Year = { year, battles: 0, sinking: 0, shipsSunk: 0, pairs: {}, fleets: 0, power: 0, navies: 0, warPairs: 0, seaPairs: 0, seaPairFleets: 0, seaPairPower: 0, underWay: 0 };
  let days = 0;
  sim.step(24 * 365, (w) => {
    const ev = w.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      if (ev[i + 1] !== EventKind.SeaBattle) continue;
      const a = seaSide(ev[i + 2]!);
      const b = seaSide(ev[i + 3]!);
      const ships = a.ships + b.ships;
      y.battles++;
      if (ships > 0) y.sinking++;
      y.shipsSunk += ships;
      const key = [tag(a.nation), tag(b.nation)].sort().join('-');
      const p = (y.pairs[key] ??= { battles: 0, ships: 0 });
      p.battles++;
      p.ships += ships;
    }
    ev.length = 0;
    w.out.fires.length = 0;
    if (w.tick % 24 === 1) {
      sample(w, y);
      days++;
    }
  });
  for (const k of ['fleets', 'power', 'navies', 'warPairs', 'seaPairs', 'seaPairFleets', 'seaPairPower', 'underWay'] as const) y[k] = Math.round((y[k] / Math.max(1, days)) * 10) / 10;
  y.pairs = Object.fromEntries(Object.entries(y.pairs).sort((p, q) => q[1].battles - p[1].battles).slice(0, 5));
  rows.push(y);
  const { pairs, ...rest } = y;
  console.log(JSON.stringify({ ...rest, top: Object.keys(pairs).slice(0, 3) }));
}
writeFileSync(out, JSON.stringify({ seed, years, wallS: Math.round((Date.now() - t0) / 1000), rows }, null, 1));
console.log(`done: ${out}`);

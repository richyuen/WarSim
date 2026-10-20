/**
 * PLAN 7.36b's measure: what the air map reads on day `days` of Germany's war on Poland (the
 * critic's run-10 case, seed 8217, `c10h_8217_air_hover.png`), headless.
 *
 * Germany declares war on Poland by God command; after `days` days, for London, Paris, Warsaw
 * and Kiev: the air zone, its holder (`airHolders`, what the hover and the hatch read), its
 * area and span. Then every zone held by a nation (not contested): its span, the longest
 * straight km between two of its cells (sampled), and the 1938 map's land zones' sizes.
 *
 * Usage: `npx tsx tools/diag/airMapRead.ts [seed] [days] [out.json]`.
 */
import { writeFileSync } from 'node:fs';
import { unproject } from '../../src/sim/data/projection';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { AIR_CONTESTED } from '../../src/shared/mapModes';
import { airHolders } from '../../src/sim/systems/airSuperiority';
import { airOf, navOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2] ?? 8217);
const days = Number(process.argv[3] ?? 10);
const outFile = process.argv[4] ?? `.cache/airMapRead_${seed}_${days}.json`;
const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const tagOf = (n: number): string => (n === AIR_CONTESTED ? 'contested' : n === 0 ? 'none' : NATIONS_1938[n - 1]?.tag ?? `#${n}`);

const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(W) });
const world = sim.world;
sim.command({ kind: 'declareWar', attacker: id('GER'), defender: id('POL') });
sim.step(24 * days);
const air = airOf(world);
const { grid } = navOf(world);
const holders = airHolders(world, air.count);

// Each zone's cells, sampled, as km on a sphere (the map is Miller's: until PLAN 7.36b2 this read
// the latitude as linear in the row, and a span far from the equator as more than it is).
const R = 6371;
const lonLat = (c: number): [number, number] => unproject(((c % W) + 0.5) / W, (Math.floor(c / W) + 0.5) / H);
const gc = (a: [number, number], b: [number, number]): number => {
  const r = Math.PI / 180;
  const s = Math.sin(((b[1] - a[1]) * r) / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(((b[0] - a[0]) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
};
const cellsOf = new Map<number, number[]>();
for (let c = 0; c < air.zoneOf.length; c += 7) {
  const z = air.zoneOf[c]!;
  if (z === 0) continue;
  let a = cellsOf.get(z);
  if (!a) cellsOf.set(z, (a = []));
  a.push(c);
}
const span = (z: number): number => {
  const cs = cellsOf.get(z) ?? [];
  const step = Math.max(1, Math.floor(cs.length / 300));
  const pts = cs.filter((_, i) => i % step === 0).map(lonLat);
  let m = 0;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.max(m, gc(pts[i]!, pts[j]!));
  return Math.round(m);
};

const cities: Record<string, [number, number]> = { london: [-0.13, 51.51], paris: [2.35, 48.86], warsaw: [21.01, 52.23], kiev: [30.52, 50.45], berlin: [13.4, 52.52] };
const at = Object.entries(cities).map(([name, [lon, lat]]) => {
  const [x, y] = cellOf(lon, lat, W, H);
  const z = air.zoneOf[Math.floor(y) * W + Math.floor(x)]!;
  const flown = [...(world.airPower.get(z) ?? [])].sort((a, b) => b[1] - a[1]).map(([n, p]) => `${tagOf(n)} ${Math.round(p)}`);
  return { name, zone: z, sea: z > air.land, holder: tagOf(holders[z]!), areaKkm2: Math.round(air.areaKm2[z]! / 1000), spanKm: span(z), flown };
});
const held: { zone: number; holder: string; sea: boolean; areaKkm2: number; spanKm: number }[] = [];
for (let z = 1; z <= air.count; z++) {
  const h = holders[z]!;
  if (h === 0 || h === AIR_CONTESTED) continue;
  held.push({ zone: z, holder: tagOf(h), sea: z > air.land, areaKkm2: Math.round(air.areaKm2[z]! / 1000), spanKm: span(z) });
}
const contested = [...holders].filter((h) => h === AIR_CONTESTED).length;
const landAreas = [...air.areaKm2.slice(1, air.land + 1)].sort((a, b) => a - b);
const landSpans = Array.from({ length: air.land }, (_, i) => span(i + 1)).sort((a, b) => a - b);
const q = (a: number[], p: number): number => Math.round(a[Math.min(a.length - 1, Math.floor(p * a.length))]!);
const out = {
  seed, days, zones: air.count, land: air.land, sea: air.count - air.land, contested, grid: { w: grid.w, h: grid.h },
  landAreaKkm2: { min: q(landAreas, 0) / 1000, median: q(landAreas, 0.5) / 1000, max: q(landAreas, 1) / 1000 },
  landSpanKm: { min: q(landSpans, 0), median: q(landSpans, 0.5), p90: q(landSpans, 0.9), max: q(landSpans, 1), over1500: landSpans.filter((s) => s > 1500).length },
  at, held, heldOver1500: held.filter((h) => h.spanKm > 1500).length,
};
writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ ...out, held: `${held.length} zones` }, null, 1));

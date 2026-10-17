// Critic run 7: a headless long run of the 1938 world, nuclear age, statelets, borders.
// Usage: npx tsx critic/scripts/c7_headless.ts <seed> <years> <out.json> [saveAtYear] [save.bin] [size]
import { writeFileSync, readFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { nukeStrike, SIDE_SHIPS } from '../../src/shared/history';
import { size1938, NATIONS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { laneOf } from '../../src/sim/world';
import { loadAssets1938 } from '../../tools/headless/assets';
import en from '../../src/ui/i18n/en.json' with { type: 'json' };

const seed = Number(process.argv[2] ?? 4711);
const years = Number(process.argv[3] ?? 20);
const out = process.argv[4] ?? `critic/c7_headless_${seed}.json`;
const saveAt = Number(process.argv[5] ?? 0);
const saveFile = process.argv[6] ?? '';
const sizeId = process.argv[7];
const SZ = size1938(sizeId);
const T = 24 * 365;
const EV: Record<number, string> = Object.fromEntries(Object.entries(EventKind).map(([k, v]) => [v, k]));
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w), ...(sizeId ? { options: { size: sizeId } } : {}) });
const world = sim.world;
if (world.ports.length > 0 && world.seaSeeds.length > 0) laneOf(world);
const nm = (id: number): string => {
  if (id === 0) return 'none';
  const d = NATIONS_1938[id - 1];
  if (d && (world.nations.cols.origin[id] ?? 0) === 0) return (en as Record<string, string>)[d.nameKey] ?? d.tag;
  return `founded#${id}`;
};
const ownerAt = (x: number, y: number): number => world.cells.controller[Math.floor(y) * world.cells.w + Math.floor(x)] ?? 0;
const rows: unknown[] = [];
const nukeLog: unknown[] = [];
let prevCtrl = world.cells.controller.slice();
const t0 = performance.now();
for (let y = 1; y <= years; y++) {
  const ev: Record<string, number> = {};
  let tickMs = 0;
  let sortieHours = 0;
  const all: number[] = [];
  const y0 = performance.now();
  for (let t = 0; t < T; t++) {
    const a = performance.now();
    sim.step(1, (w) => {
      const e = w.out.events;
      for (let i = 0; i < e.length; i += 6) {
        const kind = e[i + 1]!;
        const k = EV[kind] ?? `k${kind}`;
        ev[k] = (ev[k] ?? 0) + 1;
        const A = e[i + 2]!;
        const B = e[i + 3]!;
        const X = e[i + 4]!;
        const Y = e[i + 5]!;
        if (kind === EventKind.NukeDecided) nukeLog.push({ year: y, tick: w.tick, k: 'decided', by: nm(A), utility: B / 1000, at: [X, Y], targetOwner: nm(ownerAt(X, Y)) });
        if (kind === EventKind.NukeLaunched) nukeLog.push({ year: y, tick: w.tick, k: 'launched', by: nm(A), missile: B, at: [X, Y] });
        if (kind === EventKind.NukeIntercepted) nukeLog.push({ year: y, tick: w.tick, k: 'intercepted', by: nm(A), at: [X, Y] });
        if (kind === EventKind.NukeDetonated) nukeLog.push({ year: y, tick: w.tick, k: 'burst', by: nm(A), yieldN: B, at: [X, Y] });
        if (kind === EventKind.NukeCasualties) {
          const s = nukeStrike(B);
          nukeLog.push({ year: y, tick: w.tick, k: 'toll', by: nm(A), struck: nm(s.nation), yieldN: s.yieldN, dead: s.dead, at: [X, Y] });
        }
      }
      e.length = 0;
      w.out.fires.length = 0;
    });
    const dt = performance.now() - a;
    tickMs += dt;
    all.push(dt);
    sortieHours += world.sorties.size;
  }
  const ctrl = new Map<number, number>();
  let flipped = 0;
  { const cc = world.cells.controller; for (let i = 0; i < cc.length; i++) if (cc[i] !== prevCtrl[i]) flipped++; prevCtrl = cc.slice(); }
  let land = 0;
  const c = world.cells.controller;
  for (let i = 0; i < c.length; i++) {
    if (c[i] === 0) continue;
    land++;
    ctrl.set(c[i]!, (ctrl.get(c[i]!) ?? 0) + 1);
  }
  let living = 0;
  let founded = 0;
  let tiny = 0;
  world.nations.forEach((id) => {
    if (world.nations.cols.living[id] !== 1) return;
    living++;
    if ((world.nations.cols.origin[id] ?? 0) !== 0) founded++;
    if ((ctrl.get(id) ?? 0) < 0.0005 * land) tiny++;
  });
  const top = [...ctrl].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => `${nm(id)} ${((100 * n) / land).toFixed(1)}%`);
  let wings = 0;
  world.formations.forEach((id) => {
    if (world.isWing(id)) wings++;
  });
  all.sort((a, b) => a - b);
  const warheads = Object.fromEntries([...world.warheads].filter(([, h]) => h.stock > 0).map(([n, h]) => [nm(n), h.stock]));
  let falloutCells = 0;
  for (const [, v] of world.fallout) if (v > 0.01) falloutCells++;
  const outrage = Object.fromEntries([...world.nukeOutrage].map(([n, v]) => [nm(n), +v.toFixed(2)]));
  const row = {
    year: y,
    wallS: +((performance.now() - y0) / 1000).toFixed(1),
    tickMs: +(tickMs / T).toFixed(3),
    p95ms: +all[Math.floor(all.length * 0.95)]!.toFixed(2),
    maxMs: +all[all.length - 1]!.toFixed(1),
    living,
    founded,
    tiny,
    flipped,
    wars: world.wars.list.length,
    top,
    wings,
    missions: world.wingMission.size,
    meanSortiesAloft: +(sortieHours / T).toFixed(1),
    warheads,
    falloutCells,
    landCells: land,
    taboo: +world.nukeTaboo.toFixed(3),
    outrage,
    ev,
    hash: sim.hash().toString(16),
  };
  rows.push(row);
  const nk = (k: string): number => ev[k] ?? 0;
  console.log(JSON.stringify({ year: y, wallS: row.wallS, tickMs: row.tickMs, maxMs: row.maxMs, living, founded, tiny, flipped, wars: row.wars, wings, aloft: row.meanSortiesAloft, airBattles: nk('AirBattle'), decided: nk('NukeDecided'), launched: nk('NukeLaunched'), intercepted: nk('NukeIntercepted'), burst: nk('NukeDetonated'), warheads, falloutCells, taboo: row.taboo, top: top.slice(0, 4) }));
  if (saveAt === y && saveFile) writeFileSync(saveFile, sim.save());
  writeFileSync(out, JSON.stringify({ seed, size: sizeId ?? 'default', years: y, totalS: (performance.now() - t0) / 1000, rows, nukeLog }, null, 1));
}
void SIDE_SHIPS;
void readFileSync;

// Critic run 4: a headless long run of the 1938 world with what a watcher would want to know each year.
// Usage: npx tsx critic/scripts/c4_headless.ts <seed> <years> <out.json>
import { writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938, NATIONS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { laneOf } from '../../src/sim/world';
import { loadAssets1938 } from '../../tools/headless/assets';
import en from '../../src/ui/i18n/en.json' with { type: 'json' };

const seed = Number(process.argv[2] ?? 4711);
const years = Number(process.argv[3] ?? 20);
const out = process.argv[4] ?? `critic/c4_headless_${seed}.json`;
const T = 24 * 365;
const EV: Record<number, string> = Object.fromEntries(Object.entries(EventKind).map(([k, v]) => [v, k]));
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const world = sim.world;
if (world.ports.length > 0 && world.seaSeeds.length > 0) laneOf(world);
const tags = NATIONS_1938.map((n) => n.tag);
const nm = (id: number): string => {
  const d = NATIONS_1938[id - 1];
  if (d && (world.nations.cols.origin[id] ?? 0) === 0) return (en as Record<string, string>)[d.nameKey] ?? d.tag;
  return `founded#${id}(origin ${world.nations.cols.origin[id]})`;
};
const idOf = (tag: string): number => tags.indexOf(tag) + 1;
const watch = ['USA', 'CAN', 'ENG', 'JAP', 'GER', 'SOV', 'FRA', 'ITA', 'BRA', 'MEX', 'ARG', 'AST', 'CHI'].map((t) => [t, idOf(t)] as const);
const rows: unknown[] = [];
const t0 = performance.now();
for (let y = 1; y <= years; y++) {
  const ev: Record<string, number> = {};
  const seaBattles: unknown[] = [];
  const landings: unknown[] = [];
  let tickMs = 0;
  const y0 = performance.now();
  for (let t = 0; t < T; t++) {
    const a = performance.now();
    sim.step(1, (w) => {
      const e = w.out.events;
      for (let i = 0; i < e.length; i += 6) {
        const k = EV[e[i + 1]!] ?? `k${e[i + 1]}`;
        ev[k] = (ev[k] ?? 0) + 1;
        if (e[i + 1] === EventKind.SeaBattle && seaBattles.length < 30) seaBattles.push({ tick: w.tick, a: e[i + 2], b: e[i + 3], x: e[i + 4], y: e[i + 5] });
        if (e[i + 1] === EventKind.FormationLanded && landings.length < 30) landings.push({ tick: w.tick, f: e[i + 2], n: nm(e[i + 3]!), x: e[i + 4], y: e[i + 5] });
      }
      e.length = 0;
      w.out.fires.length = 0;
    });
    tickMs += performance.now() - a;
  }
  const ctrl = new Map<number, number>();
  let land = 0;
  const c = world.cells.controller;
  for (let i = 0; i < c.length; i++) {
    if (c[i] === 0) continue;
    land++;
    ctrl.set(c[i]!, (ctrl.get(c[i]!) ?? 0) + 1);
  }
  let living = 0;
  let founded = 0;
  let foundedAll = 0;
  world.nations.forEach((id) => {
    if ((world.nations.cols.origin[id] ?? 0) !== 0) foundedAll++;
    if (world.nations.cols.living[id] !== 1) return;
    living++;
    if ((world.nations.cols.origin[id] ?? 0) !== 0) founded++;
  });
  const top = [...ctrl].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => `${nm(id)} ${((100 * n) / land).toFixed(1)}%`);
  const watched = Object.fromEntries(watch.map(([t, id]) => [t, +((100 * (ctrl.get(id) ?? 0)) / land).toFixed(2)]));
  // Fleets alive and where.
  let fleets = 0;
  let fleetsMoving = 0;
  const fleetBy: Record<string, number> = {};
  world.formations.forEach((id) => {
    if (!world.isFleet(id)) return;
    fleets++;
    if (world.formations.cols.moving[id] === 1) fleetsMoving++;
    const n = nm(world.formations.cols.nation[id]!);
    fleetBy[n] = (fleetBy[n] ?? 0) + 1;
  });
  // Wars with friends: two sides sharing an alliance or an overlord.
  const friendly: string[] = [];
  for (const w of world.wars.list) {
    for (const a of w.sides[0])
      for (const b of w.sides[1]) {
        const oa = world.nations.cols.overlord[a] ?? 0;
        const ob = world.nations.cols.overlord[b] ?? 0;
        const sameOver = (oa !== 0 && (oa === ob || oa === b)) || (ob !== 0 && ob === a);
        if (world.alliances.allied(a, b) || sameOver) friendly.push(`${nm(a)} vs ${nm(b)}${sameOver ? ' (overlord)' : ' (allied)'}`);
      }
  }
  const row = {
    year: y,
    wallS: +((performance.now() - y0) / 1000).toFixed(1),
    tickMs: +(tickMs / T).toFixed(3),
    living,
    founded,
    foundedAll,
    wars: world.wars.list.length,
    top,
    watched,
    fleets,
    fleetsMoving,
    fleetBy,
    ev,
    seaBattles,
    landings,
    friendly: friendly.slice(0, 20),
    friendlyCount: friendly.length,
    hash: sim.hash().toString(16),
  };
  rows.push(row);
  console.log(JSON.stringify({ year: y, wallS: row.wallS, tickMs: row.tickMs, living, founded, wars: row.wars, fleets, seaBattles: ev['SeaBattle'] ?? 0, landed: ev['FormationLanded'] ?? 0, embarked: ev['FormationEmbarked'] ?? 0, friendly: friendly.length, top: top.slice(0, 5), watched }));
  writeFileSync(out, JSON.stringify({ seed, years: y, totalS: (performance.now() - t0) / 1000, rows }, null, 1));
}

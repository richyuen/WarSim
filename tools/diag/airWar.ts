/**
 * PLAN 7.26: why the air war falls after year 1 while wars run. Per year of a 1938 run:
 * - `aloft`: mean `world.sorties.size` an hour (the critic's `meanSortiesAloft`: wings in the air
 *   and those home turning round); `flying`: mean sorties not home (`airborne`);
 * - a day's count at its end, the means over the year's days: wings; wings of nations at war;
 *   of those with a mission (by kind); without one, split: no enemy land formation at all,
 *   every enemy land formation out of range of its base, or one in range (a role with no target
 *   there: strategic bombers, transports); the wings' aircraft (`aircraftOf`) against their
 *   templates' (`wingAircraft`), and the wings under a quarter of theirs; land formations in
 *   contact; wars; nations at war, and of them with wings;
 * - `holders`: the eight nations with the most wings on the year's last day, with the share of
 *   the year's days each was at war.
 *
 * Usage: npx tsx tools/diag/airWar.ts <seed> [years = 30] [out = .cache/airWar_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/sim';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { assets1938 } from '../../tests/helpers/earth';
import { EventKind } from '../../src/shared/events';
import { airborne, basePlace, FERRY_RANGE, kmFromBase, ofSide, wingAircraft, wingRange } from '../../src/sim/systems/air';
import { aircraftOf } from '../../src/sim/systems/airCombat';
import { airbaseRoom } from '../../src/sim/data/airbases';
import { seaKm } from '../../src/sim/systems/navalCombat';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;

const DAY_KEYS = ['wings', 'atWar', 'mission', 'patrol', 'strike', 'supply', 'noEnemy', 'outOfRange', 'inRange', 'aircraft', 'template', 'atWarAircraft', 'hollow', 'engaged', 'wars', 'nationsAtWar', 'atWarWithWings'] as const;
type Day = Record<(typeof DAY_KEYS)[number], number>;
const rows: unknown[] = [];
for (let y = 0; y < years; y++) {
  let size = 0;
  let flying = 0;
  let airBattles = 0;
  let hours = 0;
  const sum = Object.fromEntries(DAY_KEYS.map((k) => [k, 0])) as Day;
  const daysAtWar = new Map<number, number>();
  /** Out-of-range wings, sampled weekly: why they do not rebase toward the enemy. */
  const why = { n: 0, noBaseNear: 0, baseFull: 0, baseFree: 0, freeInFerry: 0, goalReach: 0, rangesOff: [] as number[], byNation: {} as Record<string, number>, enemies: {} as Record<string, number> };
  /** Wing `id` of nation `n` (range `range`) with every enemy land formation out of range. */
  const outWhy = (n: number, id: number, range: number, land: readonly number[]): void => {
    const c = w.formations.cols;
    const enemy = land.filter((g) => w.wars.atWar(n, c.nation[g]!));
    let nearest = Infinity;
    for (const g of enemy) nearest = Math.min(nearest, kmFromBase(w, id, c.x[g]!, c.y[g]!));
    why.n++;
    why.rangesOff.push(nearest / range);
    why.byNation[tag(n)] = (why.byNation[tag(n)] ?? 0) + 1;
    for (const g of enemy) why.enemies[tag(c.nation[g]!)] = (why.enemies[tag(c.nation[g]!)] ?? 0) + 1;
    const used = new Map<number, number>();
    for (const [o, b] of w.wingBase) if (b > 0 && w.formations.has(o)) used.set(b, (used.get(b) ?? 0) + wingAircraft(w, c.template[o]!));
    const need = wingAircraft(w, c.template[id]!);
    let near = false;
    let free = false;
    let freeInFerry = false;
    // `toward`'s goal: the enemy formation nearest the base.
    const at = basePlace(w, w.wingBase.get(id)!)!;
    let goal = -1;
    let gd = Infinity;
    for (const g of enemy) {
      const k = seaKm(w, at[0], at[1], c.x[g]!, c.y[g]!);
      if (k < gd) [goal, gd] = [g, k];
    }
    let goalReach = false;
    w.airbases.forEach((b, i) => {
      if (!ofSide(w, n, w.cells.controller[b.cell]!)) return;
      const [px, py] = w.cellPoint(b.cell);
      if (goal >= 0 && seaKm(w, px, py, c.x[goal]!, c.y[goal]!) <= range) goalReach = true;
      if (!enemy.some((g) => seaKm(w, px, py, c.x[g]!, c.y[g]!) <= range)) return;
      near = true;
      if (w.wingBase.get(id) === i + 1 || (used.get(i + 1) ?? 0) + need <= airbaseRoom(b)) {
        free = true;
        if (seaKm(w, at[0], at[1], px, py) <= FERRY_RANGE * range) freeInFerry = true;
      }
    });
    if (!near) why.noBaseNear++;
    else if (free) why.baseFree++;
    else why.baseFull++;
    if (freeInFerry) why.freeInFerry++;
    if (goalReach) why.goalReach++;
  };
  for (let d = 0; d < 365; d++) {
    s.step(24, (ww) => {
      hours++;
      size += ww.sorties.size;
      if (ww.sorties.size > 0) for (const list of airborne(ww, ww.tick).values()) flying += list.length;
      const ev = ww.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.AirBattle) airBattles++;
      ev.length = 0;
      ww.out.fires.length = 0;
    });
    const c = w.formations.cols;
    const atWar = w.wars.nations();
    const day = Object.fromEntries(DAY_KEYS.map((k) => [k, 0])) as Day;
    const land: number[] = [];
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id) || w.embarked.has(id)) return;
      land.push(id);
      if (c.engaged[id] === 1) day.engaged++;
    });
    const withWings = new Set<number>();
    for (const [id, base] of w.wingBase) {
      if (base === 0 || !w.formations.has(id)) continue;
      const n = c.nation[id]!;
      const have = aircraftOf(w, id);
      const full = wingAircraft(w, c.template[id]!);
      day.wings++;
      day.aircraft += have;
      day.template += full;
      if (have < 0.25 * full) day.hollow++;
      if (!atWar.has(n)) continue;
      withWings.add(n);
      day.atWar++;
      day.atWarAircraft += have;
      const m = w.wingMission.get(id);
      if (m) {
        day.mission++;
        day[m.kind]++;
        continue;
      }
      const range = wingRange(w, id);
      let enemy = 0;
      let reach = false;
      for (const g of land) {
        if (!w.wars.atWar(n, c.nation[g]!)) continue;
        enemy++;
        if (kmFromBase(w, id, c.x[g]!, c.y[g]!) <= range) {
          reach = true;
          break;
        }
      }
      if (enemy === 0) day.noEnemy++;
      else if (reach) day.inRange++;
      else {
        day.outOfRange++;
        if (d % 7 === 0) outWhy(n, id, range, land);
      }
    }
    day.wars = w.wars.list.length;
    day.nationsAtWar = atWar.size;
    day.atWarWithWings = withWings.size;
    for (const n of atWar) daysAtWar.set(n, (daysAtWar.get(n) ?? 0) + 1);
    for (const k of DAY_KEYS) sum[k] += day[k];
  }
  const byNation = new Map<number, number>();
  for (const [id, base] of w.wingBase) if (base !== 0 && w.formations.has(id)) byNation.set(w.formations.cols.nation[id]!, (byNation.get(w.formations.cols.nation[id]!) ?? 0) + 1);
  const holders = [...byNation].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 8).map(([n, k]) => `${tag(n)} ${k} (war ${((100 * (daysAtWar.get(n) ?? 0)) / 365).toFixed(0)}%)`);
  const off = why.rangesOff.sort((a, b) => a - b);
  const top = (o: Record<string, number>): string[] => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`);
  const out = { sampled: why.n, noBaseNear: why.noBaseNear, baseFull: why.baseFull, baseFree: why.baseFree, freeInFerry: why.freeInFerry, goalReach: why.goalReach, rangesOffMedian: off.length ? +off[off.length >> 1]!.toFixed(1) : null, byNation: top(why.byNation), enemies: top(why.enemies) };
  const row = { year: y + 1, aloft: +(size / hours).toFixed(1), flying: +(flying / hours).toFixed(1), airBattles, ...Object.fromEntries(DAY_KEYS.map((k) => [k, +(sum[k] / 365).toFixed(1)])), holders, out };
  rows.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync(process.argv[4] ?? `.cache/airWar_${seed}.json`, JSON.stringify({ seed, years, rows }, null, 1));
console.log(`done: seed ${seed}`);

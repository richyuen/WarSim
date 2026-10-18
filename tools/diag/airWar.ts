/**
 * PLAN 7.26: why the air war falls after year 1 while wars run. Per year of a 1938 run:
 * - `aloft`: mean `world.sorties.size` an hour (the critic's `meanSortiesAloft`: wings in the air
 *   and those home turning round); `flying`: mean sorties not home (`airborne`);
 * - a day's count at its end, the means over the year's days: wings; wings of nations at war;
 *   of those with a mission (by kind); without one, split: no enemy land formation at all,
 *   every enemy land formation out of range of its base, or one in range (a role with no target
 *   there: strategic bombers, transports); the wings' aircraft (`aircraftOf`) against their
 *   templates' (`wingAircraft`), and the wings under a quarter of theirs; land formations in
 *   contact; wars; nations at war, and of them with wings; wings whose base changed since the
 *   day before (`rebased`, PLAN 7.26c);
 * - `holders`: the eight nations with the most wings on the year's last day, with the share of
 *   the year's days each was at war;
 * - `warDays`: days that ended with a war running (PLAN 7.26d: "a year with a war"); `hash`: the
 *   state hash at the year's end.
 * - PLAN 7.26i, the share of ADR-519 and the idle wings:
 *   - `enemyNear`: wings at war with an enemy land formation in range of their base, mission or
 *     not; `enemyNearTasked`: of those, with a mission. ADR-519's share is
 *     `enemyNearTasked ÷ enemyNear` (`airAt.ts`). The old `mission ÷ (mission + inRange)` counted
 *     too the missions of bombers and transports whose targets need no enemy land formation in
 *     range: both are printed by `airAt.ts` on these files.
 *   - `homePatrol`: patrol missions at wings with no enemy land formation in range (a patrol over
 *     home, PLAN 7.26i). Never in the share: those wings are outside its denominator. Not 0 without
 *     such a rule (0.1–0.3 a day on seed 10's first years): the missions are given at 00:00 and
 *     counted at the day's end, when a formation tasked on may have moved out of range.
 *   - The idle wings (at war, no mission, no enemy land formation in range: `noEnemy` +
 *     `outOfRange`): `idleFighter`, the fighters among them; of those, `fighterBaseNear` with an
 *     airbase holding wings of a nation at war with theirs within range, `fighterFleetNear` with
 *     an enemy fleet within range, `fighterAirNear` the fighter-days that saw an hour with an
 *     enemy sortie aloft (not on its way home) within range of their base, `fighterAirOwn` those
 *     where such a sortie was over a cell of their side (`ofSide`): what a patrol over home could
 *     meet at most. `fighterAirHours`: such hours summed. Hourly, against the day before's idle set.
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
import { Leg, sortieAt } from '../../src/sim/systems/sorties';
import { loopW } from '../../src/sim/systems/elements';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;

const DAY_KEYS = ['wings', 'atWar', 'mission', 'patrol', 'strike', 'supply', 'noEnemy', 'outOfRange', 'inRange', 'aircraft', 'template', 'atWarAircraft', 'hollow', 'engaged', 'wars', 'nationsAtWar', 'atWarWithWings', 'rebased', 'enemyNear', 'enemyNearTasked', 'homePatrol', 'idleFighter', 'fighterBaseNear', 'fighterFleetNear', 'fighterAirNear', 'fighterAirOwn', 'fighterAirHours'] as const;
type Day = Record<(typeof DAY_KEYS)[number], number>;
const rows: unknown[] = [];
/** Each wing's base at the end of the day before (PLAN 7.26c: the wings that rebased). */
const lastBase = new Map<number, number>();
const isFighter = (id: number): boolean => {
  const r = w.rules!;
  const first = r.templates[w.formations.cols.template[id]!]?.elements[0];
  return first !== undefined && r.units[first.unit]!.cls === 'fighter';
};
/** The idle fighters of the day before (PLAN 7.26i): id, nation, base place, range; and what each saw this day. */
let idle: { id: number; n: number; x: number; y: number; range: number }[] = [];
const sawAir = new Set<number>();
const sawOwn = new Set<number>();
for (let y = 0; y < years; y++) {
  let size = 0;
  let flying = 0;
  let airBattles = 0;
  let hours = 0;
  let warDays = 0;
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
      if (ww.sorties.size > 0 && idle.length > 0) {
        const fc = ww.formations.cols;
        const aloft: { n: number; x: number; y: number }[] = [];
        for (const [sid, so] of ww.sorties) {
          const p = sortieAt(so, ww.tick, loopW(ww));
          if (p.leg !== Leg.Home && ww.formations.has(sid)) aloft.push({ n: fc.nation[sid]!, x: p.x, y: p.y });
        }
        for (const f of idle) {
          let near = false;
          let own = false;
          for (const a of aloft) {
            if (!ww.wars.atWar(f.n, a.n) || seaKm(ww, f.x, f.y, a.x, a.y) > f.range) continue;
            near = true;
            const cell = Math.min(ww.cells.h - 1, Math.floor(a.y)) * ww.cells.w + Math.min(ww.cells.w - 1, Math.floor(a.x));
            if (ofSide(ww, f.n, ww.cells.controller[cell]!)) own = true;
          }
          if (near) {
            sum.fighterAirHours++;
            sawAir.add(f.id);
          }
          if (own) sawOwn.add(f.id);
        }
      }
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
    // What the day before's idle fighters saw this day (PLAN 7.26i).
    day.fighterAirNear = sawAir.size;
    day.fighterAirOwn = sawOwn.size;
    sawAir.clear();
    sawOwn.clear();
    idle = [];
    // The airbases holding wings, with their nations; the fleets afloat (PLAN 7.26i).
    const baseNations = new Map<number, Set<number>>();
    for (const [o, b] of w.wingBase) {
      if (b <= 0 || !w.formations.has(o)) continue;
      let s = baseNations.get(b);
      if (!s) baseNations.set(b, (s = new Set()));
      s.add(c.nation[o]!);
    }
    const fleets: number[] = [];
    w.formations.forEach((id) => {
      if (w.isFleet(id) && !w.embarked.has(id)) fleets.push(id);
    });
    for (const [id, base] of w.wingBase) {
      if (base === 0 || !w.formations.has(id)) continue;
      const was = lastBase.get(id);
      if (was !== undefined && was !== base) day.rebased++;
      lastBase.set(id, base);
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
      if (reach) {
        day.enemyNear++;
        if (m) day.enemyNearTasked++;
      } else if (m?.kind === 'patrol') day.homePatrol++;
      if (m) {
        day.mission++;
        day[m.kind]++;
        continue;
      }
      if (enemy === 0) day.noEnemy++;
      else if (reach) {
        day.inRange++;
        continue;
      } else {
        day.outOfRange++;
        if (d % 7 === 0) outWhy(n, id, range, land);
      }
      // An idle wing (PLAN 7.26i): what a fighter of them could meet over home.
      if (!isFighter(id)) continue;
      day.idleFighter++;
      const at = basePlace(w, base);
      if (!at) continue;
      idle.push({ id, n, x: at[0], y: at[1], range });
      let baseNear = false;
      for (const [b, ns] of baseNations) {
        if (![...ns].some((o) => w.wars.atWar(n, o))) continue;
        const [px, py] = w.cellPoint(w.airbases[b - 1]!.cell);
        if (seaKm(w, at[0], at[1], px, py) <= range) {
          baseNear = true;
          break;
        }
      }
      if (baseNear) day.fighterBaseNear++;
      if (fleets.some((g) => w.wars.atWar(n, c.nation[g]!) && kmFromBase(w, id, c.x[g]!, c.y[g]!) <= range)) day.fighterFleetNear++;
    }
    day.wars = w.wars.list.length;
    if (day.wars > 0) warDays++;
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
  const row = { year: y + 1, aloft: +(size / hours).toFixed(1), flying: +(flying / hours).toFixed(1), airBattles, warDays, ...Object.fromEntries(DAY_KEYS.map((k) => [k, +(sum[k] / 365).toFixed(1)])), holders, out, hash: s.hash().toString(16) };
  rows.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync(process.argv[4] ?? `.cache/airWar_${seed}.json`, JSON.stringify({ seed, years, rows }, null, 1));
console.log(`done: seed ${seed}`);

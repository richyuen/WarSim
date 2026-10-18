/**
 * PLAN 7.26h: where the great powers' own transports are on the days the invasion AI stops them
 * at `noTransport` (no transport group of their own standing at a port they hold; `landWar.ts`'s
 * gate). For Germany, Britain, the Netherlands, the US and Japan, daily (after the day's 24 hours),
 * on each day the nation is in a war in which it has no land front, has no formation aboard, and
 * meets that gate: the state of each of its transport groups (template `transport_group`), in this
 * order, the first that holds:
 * - `aboard`: men embarked on it (the gate would then read `aboard`: a non-zero count is a bug);
 * - `underWay`, by where it sails (`targetCell`): the water of a port the nation holds (`toOwn`),
 *   its bloc holds (`toBloc`), an enemy holds (`toEnemy`), else `toOther`;
 * - `inBattle`: in a sea battle or engaged;
 * - `noRoom`: standing, its transports all sunk (`transportRoom` 0);
 * - `atOwnLand`: within `AT_PORT_CELLS` of an own port's land cell, not of its water (`tryLanding`
 *   takes either, the gate only the water);
 * - `atBloc`: at the water of a port its bloc holds, not the nation (the naval AI's home is the
 *   bloc's, `invasion.ts`'s the nation's);
 * - `atLost`: at a base it has lost (`atLostBase`);
 * - `awayHome`: standing away from every port of its bloc, a port of its own reachable
 *   (`nearestOwnPort`); with how long it has stood (days since it was last under way), and its cell;
 * - `awayNoHome`: the same with no own port in its basin.
 * Per nation and year also: groups seen for the first time (built, or at the start on day 1),
 * groups gone (sunk), days with no group at all, and its free land formations (the gate's
 * `free`) by land: on a land with a port it holds, or not.
 *
 * PLAN 7.26h2: on each month's start (the economic AI's day; read at the end of the tick before
 * it, so the systems that run before the AI in that tick are not seen), for each of them in a war
 * with no front of its own and with no transport group: the fleet slot's conditions as they were
 * before ADR-518 (`economic.ts` 3b, `pickFleet`; the transport is step 2c's since) in their order, the first that fails (`slotFirst`) and each that
 * fails (`slotEach`): `shipInYards` (a fleet in training, its template counted in `yards`),
 * `navyShare` (the navy's upkeep at NAVY_SHARE of income or more; the ratio in `navyRatio`),
 * `poor`, `frontAny` (a land front in any war: `hasFront`), `price` (gold under the price and
 * RESERVE_MONTHS of income), `noShipyard`; when none fails, `ordered` if a transport order of its
 * own is in the yards the next day, else `balanceOrMen` (the army's orders, the refills and
 * research left the balance at the need, or no manpower).
 *
 * Usage: npx tsx tools/diag/transports.ts <seed> [years = 8] [out = .cache/transports_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/sim';
import { SIZE_1938, TAGS_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { assets1938 } from '../../tests/helpers/earth';
import { neighbours4 } from '../../src/sim/nav/grid';
import { frontierOf } from '../../src/sim/systems/territory';
import { AT_PORT_CELLS, atLostBase, nearestOwnPort } from '../../src/sim/systems/navalCombat';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { blocOf } from '../../src/sim/systems/supply';
import { navOf, portSeaOf, seaRangeOf } from '../../src/sim/world';
import { isMonthStart } from '../../src/shared/calendar';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938 } from '../../src/sim/scenario1938';
import { budgetOf, NAVY_SHARE, POOR_INCOME, RESERVE_MONTHS } from '../../src/sim/ai/economic';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { shipyard } from '../../src/sim/systems/production';
import { Domain } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 8);
const out = process.argv[4] ?? `.cache/transports_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const WATCH = ['GER', 'ENG', 'NED', 'USA', 'JAP'];
const watched = new Map(WATCH.map((t) => [TAGS_1938.indexOf(t) + 1, t]));
const TRANSPORT = TEMPLATES_1938.findIndex((t) => t.id === 'transport_group');
const STATES = ['aboard', 'toOwn', 'toBloc', 'toEnemy', 'toOther', 'inBattle', 'noRoom', 'atOwnLand', 'atBloc', 'atLost', 'awayHome', 'awayNoHome'] as const;
type State = (typeof STATES)[number];

const cellOf = (id: number): number => Math.floor(w.formations.cols.y[id]!) * w.cells.w + Math.floor(w.formations.cols.x[id]!);
const near = (a: number, b: number, r: number): boolean => {
  const ww = w.cells.w;
  let dx = Math.abs((a % ww) - (b % ww));
  if (w.settings.loopingMap && dx > ww / 2) dx = ww - dx;
  return dx <= r && Math.abs(Math.floor(a / ww) - Math.floor(b / ww)) <= r;
};
const med = (a: number[]): number | null => (a.length === 0 ? null : [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!);

type NationYear = {
  days: number; noneDays: number; noneFrontElsewhere: number; noneGold: number[]; groupDays: Record<State, number>; built: number; sunk: number;
  awayHomeDaysStood: number[]; awayCells: Record<string, number>; toCells: Record<string, number>;
  freeOnPortLand: number[]; freeElsewhere: number[]; menOnPortLand: number[]; groupsAlive: number[];
  slotMonths: number; slotFirst: Record<string, number>; slotEach: Record<string, number>; yards: Record<string, number>; navyRatio: number[]; slotGold: number[];
};
const newYear = (): NationYear => ({ days: 0, noneDays: 0, noneFrontElsewhere: 0, noneGold: [], groupDays: Object.fromEntries(STATES.map((k) => [k, 0])) as Record<State, number>, built: 0, sunk: 0, awayHomeDaysStood: [], awayCells: {}, toCells: {}, freeOnPortLand: [], freeElsewhere: [], menOnPortLand: [], groupsAlive: [], slotMonths: 0, slotFirst: {}, slotEach: {}, yards: {}, navyRatio: [], slotGold: [] });

const T = ECONOMY_TABLES_1938;
const upkeepOf = (id: number): number => {
  const t = w.formations.cols.template[id]!;
  const full = T.templateStrength[t] ?? 0;
  return full > 0 ? (UPKEEP_SCALE * (T.templateUpkeep[t] ?? 0) * w.formations.cols.strength[id]!) / full : 0;
};
const hasFrontAny = (n: number): boolean => {
  const { w: cw, h: ch, controller } = w.cells;
  const nb: number[] = [];
  for (const cell of frontierOf(w)) {
    if (controller[cell] !== n) continue;
    for (const k of neighbours4(cell, cw, ch, w.settings.loopingMap, nb)) {
      const m = controller[k]!;
      if (m !== 0 && m !== n && w.wars.atWar(n, m)) return true;
    }
  }
  return false;
};
const transportOrders = (n: number): Set<number> => {
  const ids = new Set<number>();
  w.production.forEach((id) => {
    if (w.production.cols.nation[id] === n && w.production.cols.template[id] === TRANSPORT) ids.add(id);
  });
  return ids;
};
/** The month's slot reads waiting for the next day's look at the yards: nation → its transport orders then. */
let slotPending = new Map<number, { t: string; before: Set<number> }>();

/** Each transport group ever seen, its nation, and the last day it was under way. */
const seen = new Map<number, { n: number; lastMoved: number; gone: boolean }>();
const years_: unknown[] = [];
let day = 0;
const t0 = Date.now();
for (let y = 0; y < years; y++) {
  const yr = new Map(WATCH.map((t) => [t, newYear()]));
  for (let d = 0; d < 365; d++, day++) {
    s.step(24, (ww) => {
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    const f = w.formations;
    const c = f.cols;
    const ctl = w.cells.controller;
    const water = portSeaOf(w);
    const portR = w.atSize(AT_PORT_CELLS);
    // Groups: built and sunk.
    f.forEach((id) => {
      if (!w.isFleet(id) || c.template[id] !== TRANSPORT) return;
      const r = seen.get(id);
      if (!r) {
        seen.set(id, { n: c.nation[id]!, lastMoved: day, gone: false });
        const t = watched.get(c.nation[id]!);
        if (t) yr.get(t)!.built++;
      }
      if (c.moving[id] === 1) seen.get(id)!.lastMoved = day;
    });
    for (const [id, r] of seen) {
      if (r.gone || (f.has(id) && w.isFleet(id) && c.template[id] === TRANSPORT)) continue;
      r.gone = true;
      const t = watched.get(r.n);
      if (t) yr.get(t)!.sunk++;
    }
    // PLAN 7.26h2: last month-start's reads that passed every condition: ordered or not.
    for (const [n, p] of slotPending) {
      const r = yr.get(p.t)!;
      const k = [...transportOrders(n)].some((id) => !p.before.has(id)) ? 'ordered' : 'balanceOrMen';
      r.slotFirst[k] = (r.slotFirst[k] ?? 0) + 1;
    }
    slotPending = new Map();
    // The pairs of nations beside each other (a land front where they are at war).
    const pair = new Set<number>();
    const { w: cw, h: ch } = w.cells;
    const nb: number[] = [];
    for (const cell of frontierOf(w)) {
      const a = ctl[cell]!;
      for (const k of neighbours4(cell, cw, ch, w.settings.loopingMap, nb)) {
        const b = ctl[k]!;
        if (b !== 0 && b !== a) pair.add(a * 65536 + b);
      }
    }
    const aboardBy = new Set<number>();
    const carrying = new Set<number>();
    for (const [id, e] of w.embarked) {
      aboardBy.add(c.nation[id]!);
      carrying.add(e.fleet);
    }
    const comp = navOf(w).grid.component;
    // PLAN 7.26h2: the fleet slot's conditions, read before the month's economic AI.
    if (isMonthStart(w.startDay, w.tick)) {
      const acc = monthlyAccounts(w, T);
      const navy = new Map<number, number>();
      const yards = new Map<number, number[]>();
      f.forEach((id) => {
        if (w.isFleet(id)) navy.set(c.nation[id]!, (navy.get(c.nation[id]!) ?? 0) + upkeepOf(id));
      });
      w.production.forEach((id) => {
        const tt = w.production.cols.template[id]!;
        if (w.rules?.templates[tt]?.domain !== Domain.sea) return;
        const n = w.production.cols.nation[id]!;
        yards.set(n, [...(yards.get(n) ?? []), tt]);
      });
      for (const [n, t] of watched) {
        if (w.nations.cols.living[n] !== 1) continue;
        let frontless = false;
        for (const war of w.wars.list) {
          const i = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
          if (i < 0) continue;
          if (!war.sides[1 - i]!.some((e) => w.wars.atWar(n, e) && (pair.has(n * 65536 + e) || pair.has(e * 65536 + n)))) frontless = true;
        }
        let has = false;
        f.forEach((id) => {
          if (w.isFleet(id) && c.template[id] === TRANSPORT && c.nation[id] === n) has = true;
        });
        if (!frontless || has) continue;
        const r = yr.get(t)!;
        r.slotMonths++;
        const { income } = budgetOf(w, n, acc);
        const gold = w.nations.cols.gold[n]!;
        const price = w.rules!.templates[BUILD_MIX_1938.fleets.transport]!.gold;
        r.navyRatio.push(+((navy.get(n) ?? 0) / Math.max(1e-9, income)).toFixed(3));
        r.slotGold.push(Math.round(gold));
        for (const tt of yards.get(n) ?? []) {
          const id = TEMPLATES_1938[tt]?.id ?? `#${tt}`;
          r.yards[id] = (r.yards[id] ?? 0) + 1;
        }
        const fails: string[] = [];
        if ((yards.get(n)?.length ?? 0) > 0) fails.push('shipInYards');
        if ((navy.get(n) ?? 0) >= NAVY_SHARE * income) fails.push('navyShare');
        if (income < POOR_INCOME) fails.push('poor');
        if (hasFrontAny(n)) fails.push('frontAny');
        if (gold < price + RESERVE_MONTHS * income) fails.push('price');
        if (shipyard(w, n) < 0) fails.push('noShipyard');
        for (const k of fails) r.slotEach[k] = (r.slotEach[k] ?? 0) + 1;
        if (fails.length > 0) r.slotFirst[fails[0]!] = (r.slotFirst[fails[0]!] ?? 0) + 1;
        else slotPending.set(n, { t, before: transportOrders(n) });
      }
    }
    for (const [n, t] of watched) {
      if (w.nations.cols.living[n] !== 1 || aboardBy.has(n)) continue;
      // In a war with no front of its own.
      let frontless = false;
      for (const war of w.wars.list) {
        const i = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
        if (i < 0) continue;
        if (!war.sides[1 - i]!.some((e) => w.wars.atWar(n, e) && (pair.has(n * 65536 + e) || pair.has(e * 65536 + n)))) frontless = true;
      }
      if (!frontless) continue;
      const mine: number[] = [];
      f.forEach((id) => {
        if (w.isFleet(id) && c.template[id] === TRANSPORT && c.nation[id] === n) mine.push(id);
      });
      // The gate: a group of its own standing at the water of a port it holds, with room.
      const ready = mine.some((id) => c.moving[id] !== 1 && c.engaged[id] !== 1 && seaRangeOf(w, id) === undefined && transportRoom(w, id) > 0 && w.ports.some((p, k) => water[k]! >= 0 && ctl[p.cell] === n && near(cellOf(id), water[k]!, portR)));
      if (ready) continue;
      const r = yr.get(t)!;
      r.days++;
      r.groupsAlive.push(mine.length);
      if (mine.length === 0) {
        r.noneDays++;
        // Why none is built (`economic.ts`'s `pickFleet`): a land front in any war bars it.
        let anyFront = false;
        for (const war of w.wars.list) {
          const i = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
          if (i >= 0 && war.sides[1 - i]!.some((e) => pair.has(n * 65536 + e) || pair.has(e * 65536 + n))) anyFront = true;
        }
        if (anyFront) r.noneFrontElsewhere++;
        r.noneGold.push(Math.round(w.nations.cols.gold[n]!));
      }
      const bloc = blocOf(w, n);
      const holderAt = (cell: number, byLand: boolean): number[] => {
        const hs: number[] = [];
        w.ports.forEach((p, k) => {
          if (water[k]! < 0) return;
          if (near(cell, water[k]!, portR) || (byLand && near(cell, p.cell, portR))) hs.push(ctl[p.cell]!);
        });
        return hs;
      };
      for (const id of mine) {
        const here = cellOf(id);
        let st: State;
        if (carrying.has(id)) st = 'aboard';
        else if (c.moving[id] === 1) {
          const to = holderAt(c.targetCell[id]!, false);
          st = to.includes(n) ? 'toOwn' : to.some((h) => h !== 0 && blocOf(w, h) === bloc) ? 'toBloc' : to.some((h) => h !== 0 && w.wars.atWar(n, h)) ? 'toEnemy' : 'toOther';
          const k = `${c.targetCell[id]! % cw},${Math.floor(c.targetCell[id]! / cw)}`;
          r.toCells[`${st} ${k}`] = (r.toCells[`${st} ${k}`] ?? 0) + 1;
        } else if (c.engaged[id] === 1 || seaRangeOf(w, id) !== undefined) st = 'inBattle';
        else if (transportRoom(w, id) === 0) st = 'noRoom';
        else {
          const byWater = holderAt(here, false);
          const byLand = holderAt(here, true);
          if (byLand.includes(n)) st = 'atOwnLand';
          else if (byWater.some((h) => h !== 0 && blocOf(w, h) === bloc)) st = 'atBloc';
          else if (atLostBase(w, id)) st = 'atLost';
          else if (nearestOwnPort(w, id) >= 0) {
            st = 'awayHome';
            r.awayHomeDaysStood.push(day - seen.get(id)!.lastMoved);
            const k = `${here % cw},${Math.floor(here / cw)}`;
            r.awayCells[k] = (r.awayCells[k] ?? 0) + 1;
          } else st = 'awayNoHome';
        }
        r.groupDays[st]++;
      }
      // Its free land formations, by land: on a land with a port it holds, or not.
      const portLands = new Set<number>();
      w.ports.forEach((p, k) => {
        if (water[k]! >= 0 && ctl[p.cell] === n) portLands.add(comp[p.cell]!);
      });
      let onPort = 0;
      let elsewhere = 0;
      let men = 0;
      f.forEach((id) => {
        if (w.isFleet(id) || w.isWing(id) || w.offLand(id) || c.nation[id] !== n || c.moving[id] === 1 || c.engaged[id] === 1 || c.retreat[id] !== 0 || c.home[id] !== 0) return;
        if (portLands.has(comp[cellOf(id)]!)) {
          onPort++;
          men += c.strength[id]!;
        } else elsewhere++;
      });
      r.freeOnPortLand.push(onPort);
      r.freeElsewhere.push(elsewhere);
      r.menOnPortLand.push(men);
    }
  }
  const top = (o: Record<string, number>, k = 6): Record<string, number> => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k));
  const row = {
    year: y + 1,
    nations: Object.fromEntries([...yr].map(([t, r]) => [t, {
      noTransportDays: r.days, noneDays: r.noneDays, noneFrontElsewhere: r.noneFrontElsewhere, noneMedianGold: med(r.noneGold), groupDays: Object.fromEntries(Object.entries(r.groupDays).filter(([, v]) => v > 0)), built: r.built, sunk: r.sunk,
      medianGroups: med(r.groupsAlive), awayHomeMedianDaysStood: med(r.awayHomeDaysStood), awayHomeMaxDaysStood: r.awayHomeDaysStood.length ? Math.max(...r.awayHomeDaysStood) : null,
      awayCells: top(r.awayCells), toCells: top(r.toCells), medianFreeOnPortLand: med(r.freeOnPortLand), medianFreeElsewhere: med(r.freeElsewhere), medianMenOnPortLand: med(r.menOnPortLand),
      slotMonths: r.slotMonths, slotFirst: r.slotFirst, slotEach: r.slotEach, yards: r.yards, medianNavyRatio: med(r.navyRatio), maxNavyRatio: r.navyRatio.length ? Math.max(...r.navyRatio) : null, slotMedianGold: med(r.slotGold),
    }])),
  };
  years_.push(row);
  process.stderr.write(`year ${y + 1} ${((Date.now() - t0) / 1000).toFixed(0)} s ${JSON.stringify(row)}\n`);
}
writeFileSync(out, JSON.stringify({ seed, years, transportsSeen: [...seen].filter(([, r]) => watched.has(r.n)).map(([id, r]) => ({ id, n: tag(r.n), gone: r.gone })), years_ }, null, 1));
process.stderr.write(`done: ${out}\n`);

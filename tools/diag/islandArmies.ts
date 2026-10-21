/**
 * PLAN 7.49d's measure: the armies of nations at war that stand on a landmass with no front of
 * their nation (`landStates.ts`'s `island`), and what the invasion AI (`ai/invasion.ts`) does
 * with them. From each saved state, for `days` days (after each day's 24 hours):
 * - the island share: of the land formations of living nations at war, those standing (not on
 *   the march, engaged, retreating, going home or aboard) on a landmass with none of their
 *   nation's front cells, while it has one (`landStates.ts`'s classification), on day 1 and on
 *   the last day (the AT's figure);
 * - per nation with `MIN_ISLAND` or more island formations on day 1, daily: `planLanding`'s gate
 *   (read only, as `landWar.ts`: `fronted` a front in each of its wars, `aboard`, `noTransport`,
 *   `noTarget`, `atPort`, `send`, `noneFree`) and whether the day is its actor day (`STAGGER`);
 *   its transport groups and their room (`transportRoom`, men), the room of the one at a port of
 *   its own; the formations that went aboard (new in `world.embarked`), the men; those landed
 *   (left `embarked` alive, on another landmass than they boarded); its island formations and
 *   their men on day 1 and on the last day;
 * - why a nation has no front on its island: the wars it is in, and whether each has a land front
 *   anywhere (the enemy's land is overseas), from `muster`, where `musterPoint` raises its new
 *   formations (home or the theatre).
 *
 * - `carry`: the best a ferry could carry in the days (no rule does), per watched nation: the straight
 *   km from its port on its island army's land to its nearest port on a land of its front (or an
 *   enemy's in a war with no front), round trips at its transports' pace with STAGGER days to load
 *   each, all their room each trip; and the island share at day 1 less those (`bestPct`).
 *
 * Usage: npx tsx tools/diag/islandArmies.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { DEPLOY_RANGE_CELLS } from '../../src/sim/ai/operational';
import { STAGGER } from '../../src/sim/ai/strategic';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { AT_PORT_CELLS, seaKm } from '../../src/sim/systems/navalCombat';
import { sailKmh } from '../../src/sim/systems/sail';
import { musterPoint, spawnPoint } from '../../src/sim/systems/production';
import { seaHolder } from '../../src/sim/systems/seaControl';
import { frontierOf } from '../../src/sim/systems/territory';
import { navOf, portSeaOf, seaOf, seaRangeOf, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const MIN_ISLAND = 5;
const out = process.argv[2]!;
const days = Number(process.argv[3]);
const cases = process.argv.slice(4).map((a) => {
  const [seed, src] = a.split(':');
  return { seed: Number(seed), src: src! };
});
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const GATES = ['fronted', 'aboard', 'noTransport', 'noTarget', 'atPort', 'send', 'noneFree'] as const;
type Gate = (typeof GATES)[number];

const near = (world: World, a: number, b: number, r: number): boolean => {
  const ww = world.cells.w;
  let dx = Math.abs((a % ww) - (b % ww));
  if (world.settings.loopingMap && dx > ww / 2) dx = ww - dx;
  return dx <= r && Math.abs(Math.floor(a / ww) - Math.floor(b / ww)) <= r;
};

const rows: unknown[] = [];
const totals = { first: { island: 0, atWar: 0 }, last: { island: 0, atWar: 0 } };
const carry: { seed: number; nation: string; km: number; oneWayDays: number; trips: number; room: number; islandMen: number; island: number; carryMen: number; carryFormations: number }[] = [];
for (const { seed, src } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  const w = s.world;
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  s.load(new Uint8Array(readFileSync(src)));
  const c = w.formations.cols;
  const nat = w.nations.cols;
  const cw = w.cells.w;
  const cellOf = (id: number): number => Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!);
  const comp = navOf(w).grid.component;
  const nb: number[] = [];

  /** Each living nation at war: its front cells (landStates' way) and the cells it holds itself on the front (invasion's). */
  const fronts = (): Map<number, { lands: Set<number>; cells: number; own: number[]; faced: Set<number> }> => {
    const { w: fw, h: fh, controller: ctl } = w.cells;
    const m = new Map<number, { lands: Set<number>; cells: number; own: number[]; faced: Set<number> }>();
    for (const n of w.wars.nations()) if (nat.living[n] === 1) m.set(n, { lands: new Set(), cells: 0, own: [], faced: new Set() });
    for (const cell of frontierOf(w)) {
      const h = ctl[cell]!;
      for (const [n, fr] of m) {
        if (h !== n && !w.wars.sameSide(h, n)) continue;
        let on = false;
        for (const k of neighbours4(cell, fw, fh, w.settings.loopingMap, nb)) {
          const e = ctl[k]!;
          if (w.wars.atWar(n, e) && (h === n || w.wars.atWar(h, e))) on = true;
          if (h === n && e !== 0 && e !== n && w.wars.atWar(n, e)) fr.faced.add(e);
        }
        if (!on) continue;
        fr.cells++;
        fr.lands.add(comp[cell]!);
        if (h === n) fr.own.push(cell);
      }
    }
    return m;
  };
  const isLandF = (id: number): boolean => !w.isFleet(id) && !w.isWing(id);
  const islandOf = (fr: ReturnType<typeof fronts>): { share: { island: number; atWar: number }; by: Map<number, { n: number; men: number }> } => {
    let island = 0;
    let atWar = 0;
    const by = new Map<number, { n: number; men: number }>();
    w.formations.forEach((id) => {
      if (!isLandF(id)) return;
      const n = c.nation[id]!;
      const f = fr.get(n);
      if (!f) return;
      atWar++;
      if (w.offLand(id) || c.engaged[id] === 1 || c.retreat[id] !== 0 || c.home[id] !== 0 || c.moving[id] === 1) return;
      if (f.cells === 0 || f.lands.has(comp[cellOf(id)]!)) return;
      island++;
      const b = by.get(n) ?? { n: 0, men: 0 };
      b.n++;
      b.men += c.strength[id]!;
      by.set(n, b);
    });
    return { share: { island, atWar }, by };
  };

  /** `planLanding`'s gates, read only, with its foes (the wars with no front of its own) and its front. */
  const gate = (n: number, fr: ReturnType<typeof fronts>, aboardBy: Set<number>): { g: Gate; roomAtPort: number } => {
    const f = fr.get(n)!;
    const foes = new Set<number>();
    for (const war of w.wars.list) {
      const i = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
      if (i < 0) continue;
      const other = war.sides[1 - i]!;
      if (other.some((e) => f.faced.has(e))) continue;
      for (const e of other) if (e !== n) foes.add(e);
    }
    if (foes.size === 0) return { g: 'fronted', roomAtPort: 0 };
    if (aboardBy.has(n)) return { g: 'aboard', roomAtPort: 0 };
    const water = portSeaOf(w);
    const ctl = w.cells.controller;
    let fleet = 0;
    let room = 0;
    let port = -1;
    w.formations.forEach((id) => {
      if (!w.isFleet(id) || c.nation[id] !== n || c.moving[id] === 1 || c.engaged[id] === 1 || seaRangeOf(w, id) !== undefined) return;
      const r = transportRoom(w, id);
      if (r <= room) return;
      const at = cellOf(id);
      const i = w.ports.findIndex((p, k) => water[k]! >= 0 && ctl[p.cell] === n && near(w, at, water[k]!, w.atSize(AT_PORT_CELLS)));
      if (i < 0) return;
      [fleet, room, port] = [id, r, i];
    });
    if (fleet === 0) return { g: 'noTransport', roomAtPort: 0 };
    const z = seaOf(w);
    let target = -1;
    w.ports.forEach((p, i) => {
      const holder = ctl[p.cell]!;
      const at = water[i]!;
      if (holder === 0 || at < 0 || !foes.has(holder)) return;
      const zone = z.zoneOf[at]!;
      if (zone === 0 || z.closed[zone] === 1) return;
      const sea = seaHolder(w, zone);
      if (sea !== 0 && w.wars.atWar(sea, n)) return;
      target = i;
    });
    if (target < 0) return { g: 'noTarget', roomAtPort: room };
    const rr = w.atSize(DEPLOY_RANGE_CELLS);
    const nearFront = (id: number): boolean =>
      f.own.some((k) => {
        if (comp[k] !== comp[cellOf(id)]) return false;
        let dx = Math.abs(c.x[id]! - ((k % cw) + 0.5));
        if (w.settings.loopingMap && dx > cw / 2) dx = cw - dx;
        const dy = c.y[id]! - (Math.floor(k / cw) + 0.5);
        return dx * dx + dy * dy <= rr * rr;
      });
    const free = (id: number): boolean => !w.offLand(id) && c.nation[id] === n && c.moving[id] !== 1 && c.engaged[id] !== 1 && c.retreat[id] === 0 && c.home[id] === 0 && (f.own.length === 0 || !nearFront(id));
    let atPort = false;
    let onLand = false;
    const land = comp[w.ports[port]!.cell]!;
    w.formations.forEach((id) => {
      if (!isLandF(id) || !free(id)) return;
      if (near(w, cellOf(id), water[port]!, w.atSize(AT_PORT_CELLS))) atPort = true;
      else if (comp[cellOf(id)] === land) onLand = true;
    });
    return { g: atPort ? 'atPort' : onLand ? 'send' : 'noneFree', roomAtPort: room };
  };

  type NRow = {
    nation: string;
    island0: number;
    islandMen0: number;
    island1: number;
    islandMen1: number;
    gates: Record<string, number>;
    actorGates: Record<string, number>;
    transportGroups: number[];
    roomAll: number[];
    roomAtPort: number[];
    boarded: number;
    boardedMen: number;
    landed: number;
    landedMen: number;
    wars: { foes: string[]; landFront: boolean }[];
    muster: string;
  };
  const s1 = (() => {
    s.step(24, quiet);
    return fronts();
  })();
  const first = islandOf(s1);
  const watched = new Map<number, NRow>();
  for (const [n, b] of first.by) {
    if (b.n < MIN_ISLAND) continue;
    const home = spawnPoint(w, n);
    const m = musterPoint(w, n);
    const wars = w.wars.list
      .filter((war) => war.sides[0].includes(n) || war.sides[1].includes(n))
      .map((war) => {
        const i = war.sides[0].includes(n) ? 0 : 1;
        const other = war.sides[1 - i]!;
        const fr = s1.get(n)!;
        return { foes: other.map(tag), landFront: other.some((e) => fr.faced.has(e)) };
      });
    // The best a ferry could carry in `days` (no rule does): from the ports it holds on the land of
    // most of its island army to the nearest port it holds on a land of its front, or an enemy's
    // port in a war with no front, the straight km (`seaKm`, under the way by sea); round trips at
    // its transports' pace with a week to load each (the AI's STAGGER), each carrying all their room.
    const water = portSeaOf(w);
    const ctl = w.cells.controller;
    const lands = new Map<number, number>();
    w.formations.forEach((id) => {
      if (!isLandF(id) || c.nation[id] !== n || w.offLand(id)) return;
      const l = comp[cellOf(id)]!;
      if (!s1.get(n)!.lands.has(l)) lands.set(l, (lands.get(l) ?? 0) + 1);
    });
    const homeLand = [...lands].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
    const noFrontFoes = new Set<number>();
    for (const war of wars) if (!war.landFront) for (const t of war.foes) noFrontFoes.add(TAGS_1938.indexOf(t) + 1);
    let km = Infinity;
    w.ports.forEach((p, i) => {
      if (water[i]! < 0 || ctl[p.cell] !== n || comp[p.cell] !== homeLand) return;
      w.ports.forEach((q, k) => {
        if (water[k]! < 0) return;
        const hq = ctl[q.cell]!;
        if (!((hq === n && s1.get(n)!.lands.has(comp[q.cell]!)) || noFrontFoes.has(hq))) return;
        const a = water[i]!;
        const b = water[k]!;
        km = Math.min(km, seaKm(w, (a % cw) + 0.5, Math.floor(a / cw) + 0.5, (b % cw) + 0.5, Math.floor(b / cw) + 0.5));
      });
    });
    let kmh = 0;
    let room = 0;
    w.formations.forEach((id) => {
      if (!w.isFleet(id) || c.nation[id] !== n) return;
      const r = transportRoom(w, id);
      if (r > 0) {
        room += r;
        kmh = kmh === 0 ? sailKmh(w, id) : Math.min(kmh, sailKmh(w, id));
      }
    });
    const oneWay = kmh > 0 && Number.isFinite(km) ? km / (kmh * 24) : Infinity;
    const trips = oneWay > days ? 0 : 1 + Math.floor((days - oneWay) / (2 * oneWay + STAGGER));
    const carryMen = Math.min(b.men, trips * room);
    carry.push({ seed, nation: tag(n), km: Math.round(km), oneWayDays: Math.round(oneWay * 10) / 10, trips, room, islandMen: b.men, island: b.n, carryMen, carryFormations: Math.round((b.n * carryMen) / Math.max(1, b.men)) });
    watched.set(n, {
      nation: tag(n),
      island0: b.n,
      islandMen0: b.men,
      island1: 0,
      islandMen1: 0,
      gates: Object.fromEntries(GATES.map((k) => [k, 0])),
      actorGates: Object.fromEntries(GATES.map((k) => [k, 0])),
      transportGroups: [],
      roomAll: [],
      roomAtPort: [],
      boarded: 0,
      boardedMen: 0,
      landed: 0,
      landedMen: 0,
      wars,
      muster: !m || !home ? 'none' : m[0] === home[0] && m[1] === home[1] ? 'home' : 'theatre',
    });
  }
  const boardedOn = new Map<number, number>();
  for (const [id] of w.embarked) boardedOn.set(id, -1);
  let fr = s1;
  let last = first;
  for (let d = 1; d <= days; d++) {
    // The gate as the AI reads it at the day's start: the state after the day before.
    const aboardBy = new Set<number>();
    for (const id of w.embarked.keys()) aboardBy.add(c.nation[id]!);
    const day = w.tick / 24;
    const read = new Map<number, Gate>();
    for (const [n, row] of watched) {
      if (nat.living[n] !== 1 || !fr.has(n)) continue;
      const { g, roomAtPort } = gate(n, fr, aboardBy);
      read.set(n, g);
      row.gates[g]!++;
      if ((day + n) % STAGGER === 0) row.actorGates[g]!++;
      let groups = 0;
      let roomAll = 0;
      w.formations.forEach((id) => {
        if (!w.isFleet(id) || c.nation[id] !== n) return;
        const r = transportRoom(w, id);
        if (r > 0) {
          groups++;
          roomAll += r;
        }
      });
      row.transportGroups.push(groups);
      row.roomAll.push(roomAll);
      row.roomAtPort.push(roomAtPort);
    }
    s.step(24, quiet);
    for (const [id] of w.embarked) {
      if (boardedOn.has(id)) continue;
      boardedOn.set(id, comp[cellOf(id)] ?? -1);
      const row = watched.get(c.nation[id]!);
      if (row) {
        row.boarded++;
        row.boardedMen += c.strength[id]!;
      }
    }
    for (const [id, land] of [...boardedOn]) {
      if (w.embarked.has(id)) continue;
      boardedOn.delete(id);
      if (!w.formations.has(id) || w.offLand(id)) continue;
      const row = watched.get(c.nation[id]!);
      if (row && comp[cellOf(id)] !== land) {
        row.landed++;
        row.landedMen += c.strength[id]!;
      }
    }
    fr = fronts();
    if (d === days) last = islandOf(fr);
  }
  for (const [n, row] of watched) {
    const b = last.by.get(n);
    row.island1 = b?.n ?? 0;
    row.islandMen1 = b?.men ?? 0;
  }
  totals.first.island += first.share.island;
  totals.first.atWar += first.share.atWar;
  totals.last.island += last.share.island;
  totals.last.atWar += last.share.atWar;
  const nations = [...watched.values()].map((r) => ({
    ...r,
    transportGroups: Math.max(0, ...r.transportGroups),
    roomAll: Math.round(r.roomAll.reduce((a, b) => a + b, 0) / Math.max(1, r.roomAll.length)),
    roomAtPort: Math.round(r.roomAtPort.reduce((a, b) => a + b, 0) / Math.max(1, r.roomAtPort.length)),
  }));
  rows.push({ seed, src, first: first.share, last: last.share, nations });
  process.stderr.write(
    `${seed} ${src}: island ${first.share.island}/${first.share.atWar} -> ${last.share.island}/${last.share.atWar}; ` +
      nations.map((r) => `${r.nation} ${r.island0}->${r.island1} board ${r.boarded} land ${r.landed} room ${r.roomAll} ${JSON.stringify(r.gates)}`).join('; ') +
      '\n',
  );
}
const pct = (a: { island: number; atWar: number }): string => ((100 * a.island) / Math.max(1, a.atWar)).toFixed(1);
const carried = carry.reduce((a, r) => a + r.carryFormations, 0);
const best = { island: totals.first.island - carried, atWar: totals.first.atWar };
writeFileSync(out, JSON.stringify({ totals, firstPct: pct(totals.first), lastPct: pct(totals.last), carried, bestPct: pct(best), carry, rows }, null, 1));
console.error(`carry: ${carried} of ${totals.first.island} island formations at best; island ${pct(best)} % at best`);
console.log(`done: ${rows.length} -> ${out}; island ${pct(totals.first)} % -> ${pct(totals.last)} % after ${days} days`);

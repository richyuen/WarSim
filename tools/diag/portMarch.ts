/**
 * PLAN 7.56's measure: on the first day the invasion AI sails a nation's transports to its army
 * (`sailToArmy`, ai/invasion.ts: the nearest free formation's march to the transports' port is
 * refused), the march days from each free formation on the port's land to each port of the nation
 * on that land with water by it, and the transports' sail days to each.
 *
 * The plan is read as `planLanding` reads it (as `sendTrace.ts` does). For each (formation, port):
 * - `march`: the days of its route under the nation's passage (`findRoute`, as `orderMove` asks),
 *   walked step by step as `movementSystem` walks it (`stepKm × MOVE_COST / (km/h × terrainSpeed)`),
 *   with the fuel the formation has today (`now`) and with full supply (`fed`); a template on foot
 *   goes at its pace either way (DRY_SPEED bites engines only);
 * - per port, the transports' way by sea (`sailRoute`, as `orderSail` routes it) and its days
 *   (`km / sailKmh`).
 * Then per case: for each pair, the sail and the march in series (today: nobody is sent until the
 * transports stand there) and side by side (`max`); the least of each and its pair; and the pair
 * `sailToArmy` picks today (the SAIL_TRIES nearest formations by cells to the transports' port, of
 * the SAIL_TRIES ports nearest each by cells, the first it may march to with a way by sea).
 *
 * Usage: npx tsx tools/diag/portMarch.ts <out.json> <days> <seed:state.bin:TAG> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { DEPLOY_RANGE_CELLS } from '../../src/sim/ai/operational';
import { SAIL_TRIES } from '../../src/sim/ai/invasion';
import { MOVE_COST, Mobility, neighbours4, stepKm, type MobilityId } from '../../src/sim/nav/grid';
import { findRoute } from '../../src/sim/nav/provinceGraph';
import { sailRoute } from '../../src/sim/nav/sailRoute';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { DRY_SPEED, MARCH_DUTY, passageOf, snapTarget } from '../../src/sim/systems/movement';
import { AT_PORT_CELLS, seaKm } from '../../src/sim/systems/navalCombat';
import { sailKmh, sailTarget } from '../../src/sim/systems/sail';
import { passageShut } from '../../src/sim/systems/seaSupply';
import { seaHolder } from '../../src/sim/systems/seaControl';
import { frontierOf } from '../../src/sim/systems/territory';
import { laneOf, navOf, portSeaOf, seaOf, seaRangeOf, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3]);
const cases = process.argv.slice(4).map((a) => {
  const [seed, src, t] = a.split(':');
  return { seed: Number(seed), src: src!, n: TAGS_1938.indexOf(t!) + 1 };
});
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const near = (world: World, a: number, b: number, r: number): boolean => {
  const ww = world.cells.w;
  let dx = Math.abs((a % ww) - (b % ww));
  if (world.settings.loopingMap && dx > ww / 2) dx = ww - dx;
  return dx <= r && Math.abs(Math.floor(a / ww) - Math.floor(b / ww)) <= r;
};
const manhattan = (world: World, a: number, b: number): number => {
  const ww = world.cells.w;
  let dx = Math.abs((a % ww) - (b % ww));
  if (world.settings.loopingMap && dx > ww / 2) dx = ww - dx;
  return dx + Math.abs(Math.floor(a / ww) - Math.floor(b / ww));
};
const r1 = (x: number): number => Math.round(x * 10) / 10;

const rows: unknown[] = [];
for (const { seed, src, n } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  const w = s.world;
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  s.load(new Uint8Array(readFileSync(src)));
  const c = w.formations.cols;
  const cw = w.cells.w;
  const cellOf = (id: number): number => Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!);
  const comp = navOf(w).grid.component;
  const water = portSeaOf(w);
  const ctl = w.cells.controller;
  const nb: number[] = [];
  let row: unknown = { seed, nation: tag(n), found: false };
  for (let d = 0; d < days; d++) {
    s.step(24, quiet);
    if (w.nations.cols.living[n] !== 1) break;
    const faced = new Set<number>();
    const front: number[] = [];
    for (const cell of frontierOf(w)) {
      if (ctl[cell] !== n) continue;
      let on = false;
      for (const q of neighbours4(cell, cw, w.cells.h, w.settings.loopingMap, nb)) {
        const b = ctl[q]!;
        if (b !== 0 && b !== n && w.wars.atWar(n, b)) {
          faced.add(b);
          on = true;
        }
      }
      if (on) front.push(cell);
    }
    const foes = new Set<number>();
    for (const war of w.wars.list) {
      const i = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
      if (i < 0) continue;
      const other = war.sides[1 - i]!;
      if (other.some((e) => faced.has(e))) continue;
      for (const e of other) if (e !== n) foes.add(e);
    }
    if (foes.size === 0) continue;
    let aboard = false;
    for (const id of w.embarked.keys()) if (c.nation[id] === n) aboard = true;
    if (aboard) continue;
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
    if (fleet === 0) continue;
    const z = seaOf(w);
    let target = -1;
    let best = Infinity;
    w.ports.forEach((p, i) => {
      const holder = ctl[p.cell]!;
      const at = water[i]!;
      if (holder === 0 || at < 0 || !foes.has(holder)) return;
      const zone = z.zoneOf[at]!;
      if (zone === 0 || z.closed[zone] === 1) return;
      const sea = seaHolder(w, zone);
      if (sea !== 0 && w.wars.atWar(sea, n)) return;
      const dd = seaKm(w, c.x[fleet]!, c.y[fleet]!, (at % cw) + 0.5, Math.floor(at / cw) + 0.5);
      if (dd < best) [best, target] = [dd, i];
    });
    if (target < 0) continue;
    const rr = w.atSize(DEPLOY_RANGE_CELLS);
    const nearFront = (id: number): boolean =>
      front.some((k) => {
        if (comp[k] !== comp[cellOf(id)]) return false;
        let dx = Math.abs(c.x[id]! - ((k % cw) + 0.5));
        if (w.settings.loopingMap && dx > cw / 2) dx = cw - dx;
        const dy = c.y[id]! - (Math.floor(k / cw) + 0.5);
        return dx * dx + dy * dy <= rr * rr;
      });
    const free = (id: number): boolean => !w.offLand(id) && c.nation[id] === n && c.moving[id] !== 1 && c.engaged[id] !== 1 && c.retreat[id] === 0 && c.home[id] === 0 && (front.length === 0 || !nearFront(id));
    const home = w.ports[port]!.cell;
    let atPort = 0;
    w.formations.forEach((id) => {
      if (free(id) && (near(w, cellOf(id), home, w.atSize(AT_PORT_CELLS)) || near(w, cellOf(id), water[port]!, w.atSize(AT_PORT_CELLS)))) atPort++;
    });
    if (atPort > 0) continue;
    const land = comp[home]!;
    const by: [number, number][] = [];
    w.formations.forEach((id) => {
      if (!free(id) || comp[cellOf(id)] !== land) return;
      by.push([manhattan(w, cellOf(id), home), id]);
    });
    if (by.length === 0) continue;
    by.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const pass = passageOf(w, n);
    const nav = navOf(w);
    const rule = (id: number) => w.rules!.templates[c.template[id]!]!;
    const route = (id: number, cell: number): number[] | null => {
      const t = snapTarget(w, cellOf(id), cell % cw, Math.floor(cell / cw));
      if (t < 0) return null;
      return findRoute(nav.grid, nav.graph, rule(id).mobility as MobilityId, cellOf(id), t, pass)?.cells ?? null;
    };
    // Its march nearest the port refused: the day `sailToArmy` runs.
    if (route(by[0]![1], home) !== null) continue;
    // The days of a route, walked as movementSystem walks it, at `fuelled`.
    const marchDays = (id: number, cells: readonly number[], fuelled: number): number => {
      const ru = rule(id);
      const row = MOVE_COST[ru.mobility]!;
      const kmh = ru.speedKmh * MARCH_DUTY * fuelled;
      let hours = 0;
      for (let i = 0; i + 1 < cells.length; i++) {
        const a = cells[i]!;
        const b = cells[i + 1]!;
        const ay = Math.floor(a / cw);
        const by2 = Math.floor(b / cw);
        let dx = (b % cw) - (a % cw);
        if (dx > 1) dx -= cw;
        if (dx < -1) dx += cw;
        const g = w.cells.terrain[b]!;
        hours += (stepKm(nav.grid, by2 > ay ? ay : by2, dx, by2 - ay) * row[g]!) / (kmh * ru.terrainSpeed[g]!);
      }
      return hours / 24;
    };
    // The transports' way by sea to each port (as orderSail routes it).
    const lanes = laneOf(w);
    const shut = (e: number): boolean => lanes.edges[e]!.passage >= 0 && passageShut(w, lanes.edges[e]!.passage, n);
    const from = cellOf(fleet);
    const sail = (k: number): number | null => {
      const sea = water[k]!;
      const t = sailTarget(w, sea % cw, Math.floor(sea / cw));
      if (t < 0) return null;
      const way = sailRoute(nav.grid, seaOf(w), lanes, from, t, shut);
      return way ? way.km / sailKmh(w, fleet) / 24 : null;
    };
    const ports: { k: number; name: string; cell: number; sail: number | null }[] = [];
    w.ports.forEach((p, k) => {
      if (k === port || water[k]! < 0 || ctl[p.cell] !== n || comp[p.cell] !== land) return;
      ports.push({ k, name: p.name, cell: p.cell, sail: sail(k) });
    });
    const forms = by.map(([dist, id]) => {
      const ru = rule(id);
      const onFoot = ru.mobility === Mobility.foot;
      const now = onFoot ? 1 : DRY_SPEED + (1 - DRY_SPEED) * c.supply[id]!;
      return { id, dist, men: c.strength[id]!, template: c.template[id]!, foot: onFoot, kmh: ru.speedKmh, supply: c.supply[id]!, terrain: w.cells.terrain[cellOf(id)]!, at: cellOf(id), now };
    });
    type Pair = { id: number; port: string; sail: number; marchNow: number; marchFed: number; steps: number; series: number; side: number };
    const pairs: Pair[] = [];
    const t0 = performance.now();
    let searches = 0;
    for (const f of forms) {
      for (const p of ports) {
        searches++;
        const cells = route(f.id, p.cell);
        if (!cells || p.sail === null) continue;
        const marchNow = marchDays(f.id, cells, f.now);
        const marchFed = marchDays(f.id, cells, 1);
        pairs.push({ id: f.id, port: p.name, sail: r1(p.sail), marchNow: r1(marchNow), marchFed: r1(marchFed), steps: cells.length - 1, series: r1(p.sail + marchNow), side: r1(Math.max(p.sail, marchNow)) });
      }
    }
    const ms = Math.round(performance.now() - t0);
    // The pair sailToArmy picks today.
    let picked: { id: number; port: string } | null = null;
    for (const [, id] of by.slice(0, SAIL_TRIES)) {
      const at = cellOf(id);
      const near4 = ports.map((p) => [manhattan(w, p.cell, at), p] as const).sort((a, b) => a[0] - b[0] || a[1].k - b[1].k);
      for (const [, p] of near4.slice(0, SAIL_TRIES)) {
        if (route(id, p.cell) && p.sail !== null) {
          picked = { id, port: p.name };
          break;
        }
      }
      if (picked) break;
    }
    const least = (key: 'series' | 'side'): Pair | undefined => pairs.reduce<Pair | undefined>((m, p) => (!m || p[key] < m[key] ? p : m), undefined);
    const pickedPair = picked ? pairs.find((p) => p.id === picked!.id && p.port === picked!.port) : undefined;
    row = {
      seed,
      src,
      nation: tag(n),
      found: true,
      day: w.tick / 24,
      transportsAt: w.ports[port]!.name,
      room,
      target: w.ports[target]!.name,
      formations: forms.length,
      ports: ports.map((p) => ({ name: p.name, sail: p.sail === null ? null : r1(p.sail) })),
      searches,
      searchMs: ms,
      picked: pickedPair ?? picked,
      leastSeries: least('series'),
      leastSide: least('side'),
      underSixty: { series: pairs.filter((p) => p.series <= 60).length, side: pairs.filter((p) => p.side <= 60).length, of: pairs.length },
      forms,
      // Per formation, its quickest port by march (today's fuel).
      quickest: forms.map((f) => {
        const mine = pairs.filter((p) => p.id === f.id);
        const q = mine.reduce<Pair | undefined>((m, p) => (!m || p.marchNow < m.marchNow ? p : m), undefined);
        return { id: f.id, dist: f.dist, reachable: mine.length, quickest: q ? { port: q.port, marchNow: q.marchNow, marchFed: q.marchFed, sail: q.sail } : null };
      }),
      pairs,
    };
    // The follow: the days after it as the sim runs them, to the first day formations are sent to
    // the port the transports stand at (a march begun that ends by the port): who stood nearest it
    // the day before (by cells, as `planLanding` ranks them), their march days, and who was sent.
    const sends: unknown[] = [];
    for (let e = d + 1; e < d + 1 + 70 && sends.length < 2; e++) {
      // The front and the free formations of today, before the day is run.
      const fr: number[] = [];
      for (const cell of frontierOf(w)) {
        if (ctl[cell] !== n) continue;
        for (const q of neighbours4(cell, cw, w.cells.h, w.settings.loopingMap, nb)) {
          const b = ctl[q]!;
          if (b !== 0 && b !== n && w.wars.atWar(n, b)) {
            fr.push(cell);
            break;
          }
        }
      }
      const nearFr = (id: number): boolean =>
        fr.some((k) => {
          if (comp[k] !== comp[cellOf(id)]) return false;
          let dx = Math.abs(c.x[id]! - ((k % cw) + 0.5));
          if (w.settings.loopingMap && dx > cw / 2) dx = cw - dx;
          const dy = c.y[id]! - (Math.floor(k / cw) + 0.5);
          return dx * dx + dy * dy <= rr * rr;
        });
      const freeNow = (id: number): boolean => !w.offLand(id) && c.nation[id] === n && c.moving[id] !== 1 && c.engaged[id] !== 1 && c.retreat[id] === 0 && c.home[id] === 0 && (fr.length === 0 || !nearFr(id));
      let at = -1;
      if (w.formations.has(fleet) && c.moving[fleet] !== 1) at = w.ports.findIndex((p, k) => water[k]! >= 0 && ctl[p.cell] === n && near(w, cellOf(fleet), water[k]!, w.atSize(AT_PORT_CELLS)));
      const before: [number, number][] = [];
      const allFree: number[] = [];
      const movingBefore = new Set<number>();
      w.formations.forEach((id) => {
        if (c.nation[id] === n && c.moving[id] === 1) movingBefore.add(id);
      });
      if (at >= 0) {
        const pc = w.ports[at]!.cell;
        w.formations.forEach((id) => {
          if (!w.isFleet(id) && freeNow(id) && comp[cellOf(id)] === comp[pc]) {
            before.push([manhattan(w, cellOf(id), pc), id]);
            allFree.push(id);
          }
        });
        before.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      }
      // The land formations of n on that land, and what holds those not free.
      const held = new Map<string, number>();
      if (at >= 0) {
        const pc = w.ports[at]!.cell;
        w.formations.forEach((id) => {
          if (w.isFleet(id) || c.nation[id] !== n || w.offLand(id) || comp[cellOf(id)] !== comp[pc]) return;
          const why = c.moving[id] === 1 ? 'moving' : c.engaged[id] === 1 ? 'engaged' : c.retreat[id] !== 0 ? 'retreat' : c.home[id] !== 0 ? 'home' : fr.length > 0 && nearFr(id) ? 'nearFront' : 'free';
          held.set(why, (held.get(why) ?? 0) + 1);
        });
      }
      s.step(24, quiet);
      if (at < 0) continue;
      const pc = w.ports[at]!.cell;
      const sent: number[] = [];
      w.formations.forEach((id) => {
        if (c.nation[id] !== n || w.isFleet(id) || movingBefore.has(id) || c.moving[id] !== 1) return;
        const p = w.paths.get(id);
        if (p && near(w, p[p.length - 1]!, pc, w.atSize(AT_PORT_CELLS) + 1)) sent.push(id);
      });
      if (sent.length === 0) continue;
      const days = (id: number): number | null => {
        const p = w.paths.get(id);
        return p ? r1(marchDays(id, [...p], rule(id).mobility === Mobility.foot ? 1 : DRY_SPEED + (1 - DRY_SPEED) * c.supply[id]!)) : null;
      };
      const rank = new Map(before.map(([dd, id], i) => [id, [i, dd]] as const));
      sends.push({
        day: e,
        port: w.ports[at]!.name,
        held: Object.fromEntries(held),
        free: before.length,
        sent: sent.map((id) => ({ id, rank: rank.get(id)?.[0] ?? null, cells: rank.get(id)?.[1] ?? null, men: c.strength[id]!, steps: (w.paths.get(id)?.length ?? 1) - 1, days: days(id) })),
        nearestFree: before.slice(0, 12).map(([dd, id]) => ({ id, cells: dd, men: c.strength[id]!, terrain: w.cells.terrain[cellOf(id)]!, sent: sent.includes(id) })),
        allFree: allFree.length,
      });
    }
    (row as { sends?: unknown }).sends = sends;
    break;
  }
  rows.push(row);
  const { pairs: _p, forms: _f, ...head } = row as { pairs?: unknown; forms?: unknown };
  process.stderr.write(`${JSON.stringify(head).slice(0, 1500)}\n`);
}
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`done: ${rows.length} -> ${out}`);

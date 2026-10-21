/**
 * PLAN 7.54's trace: why `sendToPort` (ai/invasion.ts) sends nobody. From each saved state, day by
 * day (up to `days`), the named nation's landing plan is read as `planLanding` reads it; on the
 * first day it would send formations to its port (none at the port, free ones on its land), for
 * each of those formations, nearest first:
 * - its march to the port under the nation's passage (`findRoute` with `passageOf`, as
 *   `orderMove` asks; `ok`), and with no passage (`free`): the holders on that free way that the
 *   nation may not cross (`foreignTo`), by tag, and the way's cells;
 * - for each other port the nation holds on that land with water by it: how many of them reach it
 *   under the passage, and whether its transports stand there.
 *
 * Each candidate's `ms` (the restricted search's time) and `grouped` (refused by `mayReach`, no search).
 *
 * With FOLLOW=1, the days after it as the sim runs them: the candidates under way to the port.
 *
 * Usage: npx tsx tools/diag/sendTrace.ts <out.json> <days> <seed:state.bin:TAG> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { DEPLOY_RANGE_CELLS } from '../../src/sim/ai/operational';
import { neighbours4 } from '../../src/sim/nav/grid';
import { findRoute, mayReach } from '../../src/sim/nav/provinceGraph';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { foreignTo, passageOf, snapTarget } from '../../src/sim/systems/movement';
import { AT_PORT_CELLS, seaKm } from '../../src/sim/systems/navalCombat';
import { seaHolder } from '../../src/sim/systems/seaControl';
import { frontierOf } from '../../src/sim/systems/territory';
import { navOf, portSeaOf, seaOf, seaRangeOf, type World } from '../../src/sim/world';
import type { MobilityId } from '../../src/sim/nav/grid';
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
    // Its front and the enemies of its wars with no front (invasionAi's).
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
      const k = cellOf(id);
      let dx = Math.abs((k % cw) - (home % cw));
      if (w.settings.loopingMap && dx > cw / 2) dx = cw - dx;
      by.push([dx + Math.abs(Math.floor(k / cw) - Math.floor(home / cw)), id]);
    });
    if (by.length === 0) continue;
    by.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    // The trace: each candidate's march to the port, and to each other port of its own on the land.
    const pass = passageOf(w, n);
    const nav = navOf(w);
    const mob = (id: number): MobilityId => w.rules!.templates[c.template[id]!]!.mobility as MobilityId;
    const reach = (id: number, cell: number, p?: typeof pass): number[] | null => {
      const t = snapTarget(w, cellOf(id), cell % cw, Math.floor(cell / cw));
      if (t < 0) return null;
      return findRoute(nav.grid, nav.graph, mob(id), cellOf(id), t, p)?.cells ?? null;
    };
    const cands = by.map(([dist, id]) => {
      const t0 = performance.now();
      const ok = reach(id, home, pass) !== null;
      const ms = Math.round((performance.now() - t0) * 1000) / 1000;
      const t = snapTarget(w, cellOf(id), home % cw, Math.floor(home / cw));
      const grouped = t >= 0 && !mayReach(nav.grid, nav.graph, cellOf(id), t, pass);
      const way = ok ? null : reach(id, home);
      const blockers = new Map<string, number>();
      if (way) for (const k of way) if (foreignTo(w, n, ctl[k]!)) blockers.set(tag(ctl[k]!), (blockers.get(tag(ctl[k]!)) ?? 0) + 1);
      return { id, dist, men: c.strength[id]!, at: cellOf(id), holder: tag(ctl[cellOf(id)]!), ok, ms, grouped, freeWay: way ? way.length : null, blockers: Object.fromEntries(blockers) };
    });
    const others: unknown[] = [];
    w.ports.forEach((p, k) => {
      if (k === port || water[k]! < 0 || ctl[p.cell] !== n || comp[p.cell] !== land) return;
      let reached = 0;
      let men = 0;
      for (const [, id] of by) if (reach(id, p.cell, pass)) [reached, men] = [reached + 1, men + c.strength[id]!];
      let transports = 0;
      w.formations.forEach((id) => {
        if (w.isFleet(id) && c.nation[id] === n && transportRoom(w, id) > 0 && near(w, cellOf(id), water[k]!, w.atSize(AT_PORT_CELLS))) transports += transportRoom(w, id);
      });
      others.push({ port: p.name, cell: p.cell, reached, men, transportsRoom: transports });
    });
    const foreignOnLand = new Set<string>();
    for (const cnd of cands) for (const b of Object.keys(cnd.blockers)) foreignOnLand.add(b);
    row = {
      seed,
      src,
      nation: tag(n),
      found: true,
      day: w.tick / 24,
      port: w.ports[port]!.name,
      portCell: home,
      portHolderNeighbours: [...new Set(neighbours4(home, cw, w.cells.h, false, []).map((q) => tag(ctl[q]!)))],
      target: w.ports[target]!.name,
      targetHolder: tag(ctl[w.ports[target]!.cell]!),
      room,
      candidates: cands.length,
      reachable: cands.filter((x) => x.ok).length,
      firstOk: cands.findIndex((x) => x.ok),
      noWayAtAll: cands.filter((x) => !x.ok && x.freeWay === null).length,
      blockers: [...foreignOnLand],
      wars: w.wars.list.filter((war) => war.sides[0].includes(n) || war.sides[1].includes(n)).map((war) => war.sides.map((sd) => sd.map(tag))),
      head: cands.slice(0, 12),
      otherPorts: others,
    };
    // The follow (FOLLOW=1): the rest of the days as the sim runs them; each day, the candidates
    // under way whose path ends within AT_PORT_CELLS of the port, the nearest of them (cells), the
    // nation's formations aboard, and its transport groups (id@cell, `>` under way, the port by).
    if (process.env.FOLLOW === '1') {
      const follow: { day: number; toPort: number; nearest: number; aboard: number; groups: string[] }[] = [];
      const ids = by.map(([, id]) => id);
      for (let e = d + 1; e < days; e++) {
        s.step(24, quiet);
        let toPort = 0;
        let nearest = Infinity;
        for (const id of ids) {
          if (!w.formations.has(id) || c.moving[id] !== 1) continue;
          const p = w.paths.get(id);
          if (!p || !near(w, p[p.length - 1]!, home, w.atSize(AT_PORT_CELLS) + 1)) continue;
          toPort++;
          const k = cellOf(id);
          nearest = Math.min(nearest, Math.max(Math.abs((k % cw) - (home % cw)), Math.abs(Math.floor(k / cw) - Math.floor(home / cw))));
        }
        let aboardN = 0;
        for (const id of w.embarked.keys()) if (c.nation[id] === n) aboardN++;
        const groups: string[] = [];
        w.formations.forEach((g) => {
          if (!w.isFleet(g) || c.nation[g] !== n || transportRoom(w, g) <= 0) return;
          const k = cellOf(g);
          const pi = w.ports.findIndex((_p, q) => water[q]! >= 0 && near(w, k, water[q]!, w.atSize(AT_PORT_CELLS)));
          groups.push(`${g}@${k % cw},${Math.floor(k / cw)}${c.moving[g] === 1 ? '>' : ''}${pi >= 0 ? `(${w.ports[pi]!.name})` : ''}`);
        });
        if (e % 5 === 0 || aboardN > 0) follow.push({ day: e, toPort, nearest: Number.isFinite(nearest) ? nearest : -1, aboard: aboardN, groups });
      }
      (row as { follow?: unknown }).follow = follow;
    }
    break;
  }
  rows.push(row);
  process.stderr.write(`${JSON.stringify(row).slice(0, 600)}\n`);
}
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`done: ${rows.length} -> ${out}`);

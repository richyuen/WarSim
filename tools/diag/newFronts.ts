/**
 * PLAN 7.70's measure: the AI's invasions that open a new front (a Normandy). From each saved state,
 * for `days` days:
 *
 * - `open`: the wars in which, on some day, a side has a nation with a transport group of a
 *   division's room (`transportRoom` at least the 1938 infantry division's men) and an enemy coast
 *   it reaches by sea: a land cell controlled by a nation of the war's other side beside a water cell
 *   whose zone is not iced, is in the waters that group sails (`waterKeys`, the group's own key), and
 *   is held by no nation at war with it (`seaHolder`). Read daily, once a war is open it stays so.
 * - `opened`: of those, the wars with a new front: a `FormationLanded` of a nation of a side, on one
 *   of the first `days − HOLD_DAYS` days, at a cell (1) with a cell of the other side's within
 *   NEAR_CELLS (an enemy's coast, not a walk ashore at home) and (2) more than DEPLOY_RANGE_CELLS
 *   (this map's) from every front cell of the lander's own (a cell it controls beside one of a
 *   nation at war with it), the cells within NEAR_CELLS of the landing left out (the beachhead's
 *   own front); (3) HOLD_DAYS days on, a cell within NEAR_CELLS of it on its landmass controlled
 *   by a nation of the lander's side. Counted by war.
 * - `engagedPerWar`: the land formations in a fight (`engaged`) of nations at war, summed over the
 *   days, over the wars summed over the days (`warSides.ts`' engaged ÷ wars).
 * - `openedFronted`: of `opened`, the wars whose landing was by a nation with a front cell of its own (beyond
 *   the beachhead's): a Normandy proper, beside or behind its front; a lander with none counts in `opened`
 *   alone (the landings of a war with no front, PLAN 4.6b).
 * - `debt`: the landers of (1) and (2) whose gold went under 0 on a day after their landing.
 * - `reinforced` (PLAN 7.70c): the far landings of (1) and (2) (beachheads) that a later landing
 *   reached: a `FormationLanded` on a later day by the lander or a nation of its side, on the
 *   beachhead's landmass within DEPLOY_RANGE_CELLS of it (the ferry's trip to the beachhead); and
 *   `reinforcements`, those landings. `cellsHeld`: the cells within NEAR_CELLS held 30 days on,
 *   summed over the far landings that held.
 * - `embarked`, `trips`, `grouped` (PLAN 7.72): the `FormationEmbarked` events, the trips they make
 *   (one a nation an hour: the AI boards once a day), and the trips of two formations or more.
 *
 * Usage: npx tsx tools/diag/newFronts.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { isLand } from '../../src/shared/terrain';
import { DEPLOY_RANGE_CELLS } from '../../src/sim/ai/operational';
import { neighbours4 } from '../../src/sim/nav/grid';
import { ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { keyAt, waterKeys } from '../../src/sim/systems/navalCombat';
import { seaHolder } from '../../src/sim/systems/seaControl';
import { frontierOf } from '../../src/sim/systems/territory';
import { navOf, seaOf, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const HOLD_DAYS = 30;
const NEAR_CELLS = 3;
const DIVISION = ECONOMY_TABLES_1938.templateStrength[TEMPLATES_1938.findIndex((t) => t.id === 'infantry_div')]!;
const out = process.argv[2]!;
const days = Number(process.argv[3]);
const cases = process.argv.slice(4).map((a) => {
  const [seed, src] = a.split(':');
  return { seed: Number(seed), src: src! };
});
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;

type Landing = { war: number; side: number; nation: number; at: number; land: number; day: number; far: number; fronted: boolean };
type Row = { seed: number; embarked: number; trips: number; grouped: number; open: number; opened: number; openedFronted: number; wars: number; engagedPerWar: number; landed: number; reinforced: number; reinforcedFronted: number; reinforcements: number; far: { war: string; by: string; day: number; held: boolean; cells: number; fronted: boolean }[]; debt: string[] };
const rows: Row[] = [];
const totals = { open: 0, opened: 0, openedFronted: 0, wars: 0, engaged: 0, warDays: 0, landed: 0, far: 0, held: 0, cellsHeld: 0, beachheads: 0, beachheadsFronted: 0, reinforced: 0, reinforcedFronted: 0, reinforcements: 0, embarked: 0, trips: 0, grouped: 0 };
for (const { seed, src } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  s.load(new Uint8Array(readFileSync(src)));
  const world = s.world;
  const { w, h, terrain } = world.cells;
  const loop = world.settings.loopingMap;
  const comp = navOf(world).grid.component;
  const z = seaOf(world);
  const range = world.atSize(DEPLOY_RANGE_CELLS);
  const near = Math.max(1, Math.round(world.atSize(NEAR_CELLS)));
  const nb: number[] = [];
  // The coast: land cells beside a zoned water cell, with those zones.
  const coast: number[] = [];
  const coastZones: number[][] = [];
  for (let c = 0; c < terrain.length; c++) {
    if (!isLand(terrain[c]!) || comp[c] === 0) continue;
    const zs: number[] = [];
    for (const q of neighbours4(c, w, h, loop, nb)) if (z.zoneOf[q] !== 0 && !zs.includes(z.zoneOf[q]!)) zs.push(z.zoneOf[q]!);
    if (zs.length > 0) {
      coast.push(c);
      coastZones.push(zs);
    }
  }
  const dist2 = (a: number, b: number): number => {
    let dx = Math.abs((a % w) - (b % w));
    if (loop && dx > w / 2) dx = w - dx;
    const dy = Math.floor(a / w) - Math.floor(b / w);
    return dx * dx + dy * dy;
  };
  /** Whether a cell within `near` of `at` on its land is controlled by a nation of `side`. */
  const holdsNear = (at: number, side: ReadonlySet<number>): number => {
    const ctl = world.cells.controller;
    let n = 0;
    const x0 = at % w;
    const y0 = Math.floor(at / w);
    for (let dy = -near; dy <= near; dy++) {
      const y = y0 + dy;
      if (y < 0 || y >= h) continue;
      for (let dx = -near; dx <= near; dx++) {
        let x = x0 + dx;
        if (x < 0 || x >= w) {
          if (!loop) continue;
          x = (x + w) % w;
        }
        const k = y * w + x;
        if (comp[k] === comp[at] && side.has(ctl[k]!)) n++;
      }
    }
    return n;
  };
  const open = new Set<number>();
  const opened = new Map<number, { by: string; day: number; cells: number }>();
  const openedFronted = new Set<number>();
  const warsSeen = new Set<number>();
  const pending: Landing[] = [];
  const farRows: Row['far'] = [];
  const landers = new Set<number>();
  const owing = new Set<number>();
  let landed = 0;
  // The beachheads (far landings, any day) and the later landings that reached them (PLAN 7.70c).
  const beachheads: { nation: number; at: number; day: number; fronted: boolean; hits: number }[] = [];
  let reinforcements = 0;
  // The trips (PLAN 7.72): formations embarked by a nation in an hour.
  const trips = new Map<string, number>();
  let embarked = 0;
  let engaged = 0;
  let warDays = 0;
  let day = 0;
  const read = (wd: World): void => {
    const ev = wd.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      if (ev[i + 1] === EventKind.FormationEmbarked) {
        embarked++;
        const key = `${ev[i]}:${ev[i + 3]}`;
        trips.set(key, (trips.get(key) ?? 0) + 1);
      }
      if (ev[i + 1] !== EventKind.FormationLanded) continue;
      landed++;
      const n = ev[i + 3]!;
      const at = Math.floor(ev[i + 5]!) * w + Math.floor(ev[i + 4]!);
      const ctl = wd.cells.controller;
      let hit = false;
      for (const b of beachheads) {
        if (b.day >= day || comp[b.at] !== comp[at] || dist2(b.at, at) > range * range) continue;
        if (b.nation !== n && !wd.wars.sameSide(n, b.nation)) continue;
        b.hits++;
        hit = true;
      }
      if (hit) reinforcements++;
      // n's own front cells, beyond the beachhead's.
      let far = Infinity;
      let fronted = false;
      for (const c of frontierOf(wd)) {
        if (ctl[c] !== n || dist2(c, at) <= near * near) continue;
        if (!neighbours4(c, w, h, loop, nb).some((q) => ctl[q] !== 0 && ctl[q] !== n && wd.wars.atWar(n, ctl[q]!))) continue;
        fronted = true;
        far = Math.min(far, dist2(c, at));
      }
      if (far <= range * range) continue;
      if (!beachheads.some((b) => b.nation === n && b.day === day && dist2(b.at, at) <= range * range)) beachheads.push({ nation: n, at, day, fronted, hits: 0 });
      if (day > days - HOLD_DAYS) continue;
      for (const war of wd.wars.list) {
        const si = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
        if (si < 0) continue;
        if (holdsNear(at, new Set(war.sides[1 - si])) === 0) continue;
        pending.push({ war: war.id, side: si, nation: n, at, land: comp[at]!, day, far: Math.sqrt(far), fronted });
        landers.add(n);
      }
    }
    ev.length = 0;
    wd.out.fires.length = 0;
  };
  for (day = 1; day <= days; day++) {
    s.step(24, read);
    const c = world.formations.cols;
    const nat = world.nations.cols;
    const ctl = world.cells.controller;
    // Engaged per war (warSides.ts' measure).
    const fighting = world.wars.nations();
    world.formations.forEach((id) => {
      if (!world.isFleet(id) && !world.isWing(id) && !world.offLand(id) && fighting.has(c.nation[id]!) && c.engaged[id] === 1) engaged++;
    });
    warDays += world.wars.list.length;
    // The open wars.
    const groups = new Map<number, number[]>();
    world.formations.forEach((id) => {
      if (!world.isFleet(id) || transportRoom(world, id) < DIVISION) return;
      const n = c.nation[id]!;
      (groups.get(n) ?? groups.set(n, []).get(n)!).push(id);
    });
    for (const war of world.wars.list) {
      warsSeen.add(war.id);
      if (open.has(war.id)) continue;
      sides: for (let si = 0; si < 2; si++) {
        const other = new Set(war.sides[1 - si]!.filter((e) => nat.living[e] === 1));
        for (const n of war.sides[si]!) {
          const gs = groups.get(n);
          if (nat.living[n] !== 1 || !gs) continue;
          const keys = waterKeys(world, n);
          const mine = new Set(gs.map((g) => keyAt(world, keys, c.x[g]!, c.y[g]!)));
          for (let k = 0; k < coast.length; k++) {
            if (!other.has(ctl[coast[k]!]!)) continue;
            for (const zone of coastZones[k]!) {
              if (z.closed[zone] === 1 || !mine.has(keys[zone]!)) continue;
              const sea = seaHolder(world, zone);
              if (sea !== 0 && world.wars.atWar(sea, n)) continue;
              open.add(war.id);
              break sides;
            }
          }
        }
      }
    }
    // The holds due.
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i]!;
      if (day < p.day + HOLD_DAYS) continue;
      pending.splice(i, 1);
      const war = world.wars.list.find((x) => x.id === p.war);
      const side = new Set(war ? war.sides[p.side] : [p.nation]);
      const cells = holdsNear(p.at, side);
      farRows.push({ war: `${p.war}`, by: tag(p.nation), day: p.day, held: cells > 0, cells, fronted: p.fronted });
      if (cells > 0 && p.fronted) openedFronted.add(p.war);
      if (cells > 0 && !opened.has(p.war)) opened.set(p.war, { by: tag(p.nation), day: p.day, cells });
    }
    for (const n of landers) if (nat.gold[n]! < 0) owing.add(n);
  }
  const openedOpen = [...opened.keys()].filter((k) => open.has(k)).length;
  const reinforced = beachheads.filter((b) => b.hits > 0).length;
  const reinforcedFronted = beachheads.filter((b) => b.hits > 0 && b.fronted).length;
  const grouped = [...trips.values()].filter((k) => k >= 2).length;
  const row: Row = { seed, embarked, trips: trips.size, grouped, open: open.size, opened: openedOpen, openedFronted: [...openedFronted].filter((k) => open.has(k)).length, wars: warsSeen.size, engagedPerWar: warDays > 0 ? engaged / warDays : 0, landed, reinforced, reinforcedFronted, reinforcements, far: farRows, debt: [...owing].map(tag) };
  rows.push(row);
  totals.open += row.open;
  totals.opened += row.opened;
  totals.openedFronted += row.openedFronted;
  totals.wars += row.wars;
  totals.engaged += engaged;
  totals.warDays += warDays;
  totals.landed += landed;
  totals.far += farRows.length;
  totals.held += farRows.filter((r) => r.held).length;
  totals.cellsHeld += farRows.reduce((a, r) => a + r.cells, 0);
  totals.beachheads += beachheads.length;
  totals.beachheadsFronted += beachheads.filter((b) => b.fronted).length;
  totals.reinforced += reinforced;
  totals.reinforcedFronted += reinforcedFronted;
  totals.reinforcements += reinforcements;
  totals.embarked += embarked;
  totals.trips += trips.size;
  totals.grouped += grouped;
  console.log(`${seed} ${src}: wars ${row.wars}, open ${row.open}, opened ${row.opened} (by a side with a front ${row.openedFronted}); landed ${landed}, far ${farRows.length} (held ${farRows.filter((r) => r.held).length}); beachheads ${beachheads.length} (reinforced ${reinforced}, by ${reinforcements} landings); embarked ${embarked} in ${trips.size} trips (${grouped} of 2+); engaged/war ${row.engagedPerWar.toFixed(2)}; ${farRows.map((r) => `${r.by} w${r.war} d${r.day}${r.held ? ' held' : ''}${r.fronted ? ' fronted' : ''}`).join(', ')}${row.debt.length ? `; debt ${row.debt.join('/')}` : ''}`);
}
const summary = { ...totals, share: totals.open > 0 ? totals.opened / totals.open : 0, shareFronted: totals.open > 0 ? totals.openedFronted / totals.open : 0, engagedPerWar: totals.warDays > 0 ? totals.engaged / totals.warDays : 0 };
console.log(`total: ${JSON.stringify(summary)}`);
writeFileSync(out, JSON.stringify({ days, holdDays: HOLD_DAYS, nearCells: NEAR_CELLS, division: DIVISION, summary, rows }, null, 1));

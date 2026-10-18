/**
 * PLAN 7.26c1: where the moving land formations of the big wars' sides march to. From a saved
 * state (`sim.save()`, e.g. `.cache/tmp/ab.ts save`), or from 1938 to the day given, day by day:
 * - the wars with a side of BIG or more land formations (the side's formations: of its nations,
 *   on land, not aboard);
 * - each of those formations: engaged, moving or standing; a moving one's order: its target an
 *   enemy cell (an attack) or one of its side's (a hold), the threat of the target's sector (the
 *   enemy side's men in the 3 × 3 sector buckets about it, as `operationalAi` sums a sector's), km
 *   to go along its path, km from the target to the nearest enemy formation, and the march: days
 *   since it set out on this order, how many times its target moved more than a sector (re-plans);
 * - weekly: how far each side's formations stand from the war's front (the nearest front cell of
 *   the pair) and from the nearest enemy formation, and how many enemy men stand within a sector
 *   of the front at all, of all the enemy side's men on land, of those on a landmass the front is on, of each side's men those within DEPLOY_RANGE_CELLS of it, and of those beyond, by own front or none and by state;
 * - each march that ends: days, re-plans, whether it ended on its target (within a sector) and
 *   whether in contact (engaged) then.
 *
 * Usage: npx tsx tools/diag/marches.ts <seed> <state file | day> [days = 60] [out = .cache/marches_<seed>.json]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/sim';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { assets1938 } from '../../tests/helpers/earth';
import { neighbours4 } from '../../src/sim/nav/grid';
import { frontierOf } from '../../src/sim/systems/territory';
import { formationPath } from '../../src/sim/systems/movement';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { DEPLOY_RANGE_CELLS, SECTOR_CELLS } from '../../src/sim/ai/operational';
import { navOf } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const from = process.argv[3]!;
const days = Number(process.argv[4] ?? 60);
const out = process.argv[5] ?? `.cache/marches_${seed}.json`;
const BIG = 50;
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
const w = s.world;
const quiet = (ww: typeof w): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
if (existsSync(from)) s.load(new Uint8Array(readFileSync(from)));
else for (let d = 0; d < Number(from); d++) s.step(24, quiet);
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const { w: cw, h: ch } = w.cells;
const sector = w.atSize(SECTOR_CELLS);
const range = w.atSize(DEPLOY_RANGE_CELLS);
const bw = Math.ceil(cw / sector);
const kmCell = seaKm(w, 0, ch / 2, 1, ch / 2);
const isLand = (id: number): boolean => !w.isFleet(id) && !w.isWing(id) && !w.offLand(id) && !w.embarked.has(id);
const bucketOf = (x: number, y: number): number => Math.floor(y / sector) * bw + Math.floor(x / sector);
const cx = (c: number): number => (c % cw) + 0.5;
const cy = (c: number): number => Math.floor(c / cw) + 0.5;
const cellGap = (a: number, b: number): number => {
  let dx = Math.abs((a % cw) - (b % cw));
  if (w.settings.loopingMap && dx > cw / 2) dx = cw - dx;
  return Math.max(dx, Math.abs(Math.floor(a / cw) - Math.floor(b / cw)));
};

/** A march: an order followed from the day it was first seen. */
type March = { start: number; target: number; first: number; replans: number; side: string };
const marches = new Map<number, March>();
type Ended = { days: number; replans: number; onTarget: boolean; engaged: boolean; side: string };
const ended: Ended[] = [];
type SideDay = {
  formations: number; engaged: number; moving: number; standing: number;
  attack: number; hold: number; threat0: number; threatLow: number; threatHigh: number; offFront: number;
  toGoKm: number[]; targetEnemyKm: number[]; marchDays: number[];
};
const sideStats = new Map<string, SideDay & { days: number }>();
type Week = { day: number; war: string; side: string; formations: number; men: number; frontCells: number; frontKm: number[]; enemyKm: number[]; menNearFront: number; enemyFormations: number; enemyMen: number; enemyMenOnFrontLand: number; enemyMenInRange: number; menInRange: number; beyond: Record<string, number> };
const weeks: Week[] = [];
const med = (a: number[]): number | null => (a.length ? [...a].sort((x, z) => x - z)[a.length >> 1]! : null);
const pct = (a: number[], q: number): number | null => (a.length ? [...a].sort((x, z) => x - z)[Math.min(a.length - 1, Math.floor(a.length * q))]! : null);

const t0 = Date.now();
for (let d = 0; d < days; d++) {
  s.step(24, quiet);
  const day = Math.floor(w.tick / 24);
  const c = w.formations.cols;
  const nat = w.nations.cols;
  const land: number[] = [];
  const byNation = new Map<number, number[]>();
  const enemyMen = new Map<string, Float64Array>();
  w.formations.forEach((id) => {
    if (!isLand(id)) return;
    land.push(id);
    const n = c.nation[id]!;
    let ids = byNation.get(n);
    if (!ids) byNation.set(n, (ids = []));
    ids.push(id);
  });
  const seenSide = new Set<string>();
  const frontier = frontierOf(w);
  for (const war of w.wars.list) {
    const sides = war.sides.map((side) => side.filter((n) => nat.living[n] === 1));
    const counts = sides.map((side) => side.reduce((k, n) => k + (byNation.get(n)?.length ?? 0), 0));
    if (counts[0]! < BIG && counts[1]! < BIG) continue;
    const name = `${war.id} ${tag(war.sides[0][0]!)}–${tag(war.sides[1][0]!)}`;
    for (let si = 0; si < 2; si++) {
      if (counts[si]! < BIG) continue;
      const mine = new Set(sides[si]!);
      const theirs = new Set(sides[1 - si]!);
      const key = `${name} ${si === 0 ? 'A' : 'D'}`;
      // A nation on two big sides is counted on each; a formation's march once, by its first side.
      seenSide.add(key);
      // The enemy side's men by sector bucket.
      let men = enemyMen.get(key);
      if (!men) {
        men = new Float64Array(bw * Math.ceil(ch / sector));
        for (const id of land) if (theirs.has(c.nation[id]!)) men[bucketOf(c.x[id]!, c.y[id]!)]! += c.strength[id]!;
        enemyMen.set(key, men);
      }
      const threatAt = (cell: number): number => {
        const bx = Math.floor((cell % cw) / sector);
        const by = Math.floor(Math.floor(cell / cw) / sector);
        let t = 0;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          let x = bx + dx;
          if (x < 0 || x >= bw) {
            if (!w.settings.loopingMap) continue;
            x = (x + bw) % bw;
          }
          const k = (by + dy) * bw + x;
          if (k >= 0 && k < men.length) t += men[k]!;
        }
        return t;
      };
      const ours = land.filter((id) => mine.has(c.nation[id]!));
      const foes = land.filter((id) => theirs.has(c.nation[id]!));
      const nearestFoeKm = (x: number, y: number): number => {
        let m = Infinity;
        for (const h of foes) m = Math.min(m, seaKm(w, x, y, c.x[h]!, c.y[h]!));
        return m;
      };
      let st = sideStats.get(key);
      if (!st) sideStats.set(key, (st = { days: 0, formations: 0, engaged: 0, moving: 0, standing: 0, attack: 0, hold: 0, threat0: 0, threatLow: 0, threatHigh: 0, offFront: 0, toGoKm: [], targetEnemyKm: [], marchDays: [] }));
      st.days++;
      for (const id of ours) {
        st.formations++;
        if (c.engaged[id] === 1) st.engaged++;
        if (c.moving[id] !== 1) {
          if (c.engaged[id] !== 1) st.standing++;
          continue;
        }
        st.moving++;
        const to = c.targetCell[id]!;
        const holder = w.cells.controller[to]!;
        if (theirs.has(holder)) st.attack++;
        else if (mine.has(holder)) st.hold++;
        else st.offFront++;
        const t = threatAt(to);
        if (t === 0) st.threat0++;
        else if (t < 10_000) st.threatLow++;
        else st.threatHigh++;
        const p = formationPath(w, id);
        const left = p ? Math.max(0, p.length - 1 - c.pathStep[id]!) : 0;
        if (d % 7 === 0) {
          st.toGoKm.push(Math.round(left * kmCell));
          const e = nearestFoeKm(cx(to), cy(to));
          st.targetEnemyKm.push(Number.isFinite(e) ? Math.round(e) : -1);
        }
        let m = marches.get(id);
        if (m && cellGap(m.target, to) > sector) {
          m.replans++;
          m.target = to;
        }
        if (!m) marches.set(id, (m = { start: day, target: to, first: to, replans: 0, side: key }));
        if (d % 7 === 0) st.marchDays.push(day - m.start);
      }
      if (d % 7 === 0) {
        // The front of this pair of sides: cells of `mine` beside one of `theirs`.
        const front: number[] = [];
        const nb: number[] = [];
        for (const cell of frontier) {
          if (!mine.has(w.cells.controller[cell]!)) continue;
          for (const k of neighbours4(cell, cw, ch, w.settings.loopingMap, nb)) {
            if (theirs.has(w.cells.controller[k]!)) {
              front.push(cell);
              break;
            }
          }
        }
        const fbuck = new Map<number, number[]>();
        const cb = Math.max(1, range);
        const cbw = Math.ceil(cw / cb);
        for (const cell of front) {
          const k = Math.floor(Math.floor(cell / cw) / cb) * cbw + Math.floor((cell % cw) / cb);
          let a = fbuck.get(k);
          if (!a) fbuck.set(k, (a = []));
          a.push(cell);
        }
        const frontKm = (x: number, y: number): number => {
          let m = Infinity;
          for (const cell of front) m = Math.min(m, seaKm(w, x, y, cx(cell), cy(cell)));
          return m;
        };
        const wk: Week = { day, war: name, side: si === 0 ? 'A' : 'D', formations: ours.length, men: ours.reduce((k, id) => k + c.strength[id]!, 0), frontCells: front.length, frontKm: [], enemyKm: [], menNearFront: 0, enemyFormations: foes.length, enemyMen: foes.reduce((k, id) => k + c.strength[id]!, 0), enemyMenOnFrontLand: 0, enemyMenInRange: 0, menInRange: 0, beyond: {} };
        // Of the enemy's men, those on a landmass that a cell of the front is on (reachable on foot).
        const comp = navOf(w).grid.component;
        const lands = new Set(front.map((cell) => comp[cell]!));
        // Within the allotment's range of the front (DEPLOY_RANGE_CELLS), of each side.
        const rangeKm = range * kmCell;
        if (front.length > 0) {
          for (const h of foes) if (frontKm(c.x[h]!, c.y[h]!) <= rangeKm) wk.enemyMenInRange += c.strength[h]!;
          for (const g of ours) if (frontKm(c.x[g]!, c.y[g]!) <= rangeKm) wk.menInRange += c.strength[g]!;
          // Of each side's men beyond the range: whether their nation holds a cell of this front
          // (its own front) or not, and standing, moving or engaged.
          const fronted = new Set<number>();
          const nb2: number[] = [];
          for (const cell of front) {
            fronted.add(w.cells.controller[cell]!);
            for (const k of neighbours4(cell, cw, ch, w.settings.loopingMap, nb2)) if (theirs.has(w.cells.controller[k]!)) fronted.add(w.cells.controller[k]!);
          }
          const put = (who: string, id: number): void => {
            const key = `${who} ${fronted.has(c.nation[id]!) ? 'ownFront' : 'noOwnFront'} ${c.engaged[id] === 1 ? 'engaged' : c.moving[id] === 1 ? 'moving' : 'standing'}`;
            wk.beyond[key] = (wk.beyond[key] ?? 0) + c.strength[id]!;
          };
          for (const g of ours) if (frontKm(c.x[g]!, c.y[g]!) > rangeKm) put('ours', g);
          for (const h of foes) if (frontKm(c.x[h]!, c.y[h]!) > rangeKm) put('theirs', h);
        }
        for (const h of foes) if (lands.has(comp[Math.floor(c.y[h]!) * cw + Math.floor(c.x[h]!)]!)) wk.enemyMenOnFrontLand += c.strength[h]!;
        if (front.length > 0) for (const id of ours) wk.frontKm.push(Math.round(frontKm(c.x[id]!, c.y[id]!)));
        for (const id of ours) {
          const e = nearestFoeKm(c.x[id]!, c.y[id]!);
          wk.enemyKm.push(Number.isFinite(e) ? Math.round(e) : -1);
        }
        // Enemy men within a sector of the front, as the threat of a sector sees them.
        const sectorKm = sector * kmCell * 1.5;
        if (front.length > 0) for (const h of foes) if (frontKm(c.x[h]!, c.y[h]!) <= sectorKm) wk.menNearFront += c.strength[h]!;
        weeks.push(wk);
      }
    }
  }
  // Marches that ended today (or whose formation is gone).
  for (const [id, m] of marches) {
    if (w.formations.has(id) && c.moving[id] === 1 && isLand(id)) continue;
    marches.delete(id);
    if (!w.formations.has(id)) continue;
    const here = Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!);
    ended.push({ days: day - m.start, replans: m.replans, onTarget: cellGap(here, m.target) <= sector, engaged: c.engaged[id] === 1, side: m.side });
  }
  if (d % 10 === 9) process.stderr.write(`day ${day}: ${((Date.now() - t0) / 60000).toFixed(1)} min\n`);
}

const sidesOut = [...sideStats.entries()].map(([key, st]) => ({
  side: key,
  days: st.days,
  perDay: {
    formations: +(st.formations / st.days).toFixed(1), engaged: +(st.engaged / st.days).toFixed(1), moving: +(st.moving / st.days).toFixed(1), standing: +(st.standing / st.days).toFixed(1),
  },
  movingTo: {
    attack: +(st.attack / Math.max(1, st.moving)).toFixed(2), hold: +(st.hold / Math.max(1, st.moving)).toFixed(2), elsewhere: +(st.offFront / Math.max(1, st.moving)).toFixed(2),
    threat0: +(st.threat0 / Math.max(1, st.moving)).toFixed(2), threatUnder10k: +(st.threatLow / Math.max(1, st.moving)).toFixed(2), threat10kUp: +(st.threatHigh / Math.max(1, st.moving)).toFixed(2),
  },
  toGoKm: { p25: pct(st.toGoKm, 0.25), med: med(st.toGoKm), p75: pct(st.toGoKm, 0.75), p90: pct(st.toGoKm, 0.9) },
  targetToEnemyKm: { p25: pct(st.targetEnemyKm, 0.25), med: med(st.targetEnemyKm), p75: pct(st.targetEnemyKm, 0.75) },
  daysOnMarch: { med: med(st.marchDays), p75: pct(st.marchDays, 0.75), p90: pct(st.marchDays, 0.9) },
}));
const endedBySide = [...new Set(ended.map((e) => e.side))].map((side) => {
  const e = ended.filter((x) => x.side === side);
  return { side, ended: e.length, days: { med: med(e.map((x) => x.days)), p90: pct(e.map((x) => x.days), 0.9) }, replans: { med: med(e.map((x) => x.replans)), p90: pct(e.map((x) => x.replans), 0.9) }, onTarget: +(e.filter((x) => x.onTarget).length / e.length).toFixed(2), engaged: +(e.filter((x) => x.engaged).length / e.length).toFixed(2) };
});
const weeksOut = weeks.map((k) => ({ ...k, frontKm: { p25: pct(k.frontKm, 0.25), med: med(k.frontKm), p75: pct(k.frontKm, 0.75), within150: k.frontKm.filter((x) => x <= 150).length }, enemyKm: { p25: pct(k.enemyKm, 0.25), med: med(k.enemyKm), p75: pct(k.enemyKm, 0.75), within150: k.enemyKm.filter((x) => x >= 0 && x <= 150).length } }));
writeFileSync(out, JSON.stringify({ seed, from, days, big: BIG, kmCell: +kmCell.toFixed(2), sectorKm: +(sector * kmCell).toFixed(0), rangeKm: +(range * kmCell).toFixed(0), sides: sidesOut, ended: endedBySide, weeks: weeksOut }, null, 1));
process.stderr.write(`done: seed ${seed}, ${sidesOut.length} big sides, ${ended.length} marches ended\n`);

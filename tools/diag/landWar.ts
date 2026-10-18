/**
 * PLAN 7.26c: why the land war leaves the wings no enemy in reach after year 1. Per war of a 1938
 * run, day by day (after the day's 24 hours):
 * - its state: no land front (`warsWithFront`), a front and contact (an engaged land formation of
 *   one side within `CONTACT_CELLS` of an engaged one of the other), or a front and no contact;
 *   the front's length (cells of one side beside the other's), `War.frontless`, its score and
 *   exhaustions, its age;
 * - weekly, for a war with a front: the nearest pair of its sides' land formations (km), and how
 *   many of each side's land formations stand within NEAR_KM of an enemy one, and how many are
 *   moving;
 * - per year, of the big wars (a weekly sample with a side of BIG or more land formations), the
 *   share of their front days with contact (PLAN 7.26c1's AT);
 * - how it ended, read from its last day (capitulation at ±100, MAX_WAR_DAYS, FRONTLESS_DAYS,
 *   exhaustion, crushed, or a peace of another war's terms).
 * Per nation at war, daily: the gate of the invasion AI (`ai/invasion.ts`'s `planLanding`) that
 * stops it, whether or not it is an actor of the day: a land front in any of its wars, a formation
 * aboard, no transport group at a port of its own, no enemy port it may land at, formations at the
 * port (it would load), free formations on the port's land (it would send them), none.
 *
 * Usage: npx tsx tools/diag/landWar.ts <seed> [years = 8] [out = .cache/landWar_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/sim';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { assets1938 } from '../../tests/helpers/earth';
import { neighbours4 } from '../../src/sim/nav/grid';
import { frontierOf } from '../../src/sim/systems/territory';
import { warsWithFront } from '../../src/sim/systems/warFront';
import { CONTACT_CELLS } from '../../src/sim/systems/elements';
import { AT_PORT_CELLS, seaKm } from '../../src/sim/systems/navalCombat';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { seaHolder } from '../../src/sim/systems/seaControl';
import { CRUSHED, EXHAUSTED, FRONTLESS_DAYS, MAX_WAR_DAYS } from '../../src/sim/systems/war';
import { navOf, portSeaOf, seaOf, seaRangeOf, type World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 8);
const out = process.argv[4] ?? `.cache/landWar_${seed}.json`;
const NEAR_KM = 150;
/** A war is big in a year when a weekly sample has a side of this many land formations or more (PLAN 7.26c1). */
const BIG = 50;
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;

type WarRow = {
  id: number; a: string; d: string; sideA: string[]; sideD: string[]; start: number; end: number | null; how: string;
  frontless: number; contact: number; noContact: number; longestNoContact: number; run: number;
  frontCells: number[]; nearestKm: number[]; nearA: number[]; nearD: number[]; landA: number[]; landD: number[]; movingA: number[]; movingD: number[];
  last: { score: number; exA: number; exD: number; frontless: number; days: number; ftd: boolean };
};
const wars = new Map<number, WarRow>();
const GATES = ['fronted', 'aboard', 'noTransport', 'noTarget', 'atPort', 'send', 'noneFree'] as const;
type Gate = (typeof GATES)[number];

const isLand = (id: number): boolean => !w.isFleet(id) && !w.isWing(id) && !w.offLand(id) && !w.embarked.has(id);
const cellOf = (id: number): number => Math.floor(w.formations.cols.y[id]!) * w.cells.w + Math.floor(w.formations.cols.x[id]!);
const near = (world: World, a: number, b: number, r: number): boolean => {
  const ww = world.cells.w;
  let dx = Math.abs((a % ww) - (b % ww));
  if (world.settings.loopingMap && dx > ww / 2) dx = ww - dx;
  return dx <= r && Math.abs(Math.floor(a / ww) - Math.floor(b / ww)) <= r;
};

/** `planLanding`'s gates, read only, for a nation without a front or a formation aboard. */
function landingGate(n: number): Gate {
  const f = w.formations;
  const c = f.cols;
  const water = portSeaOf(w);
  const ctl = w.cells.controller;
  let fleet = 0;
  let room = 0;
  let port = -1;
  f.forEach((id) => {
    if (!w.isFleet(id) || c.nation[id] !== n || c.moving[id] === 1 || c.engaged[id] === 1 || seaRangeOf(w, id) !== undefined) return;
    const r = transportRoom(w, id);
    if (r <= room) return;
    const at = cellOf(id);
    const i = w.ports.findIndex((p, k) => water[k]! >= 0 && ctl[p.cell] === n && near(w, at, water[k]!, w.atSize(AT_PORT_CELLS)));
    if (i < 0) return;
    [fleet, room, port] = [id, r, i];
  });
  if (fleet === 0) return 'noTransport';
  const z = seaOf(w);
  let target = -1;
  w.ports.forEach((p, i) => {
    const holder = ctl[p.cell]!;
    const at = water[i]!;
    if (holder === 0 || at < 0 || !w.wars.atWar(n, holder)) return;
    const zone = z.zoneOf[at]!;
    if (zone === 0 || z.closed[zone] === 1) return;
    const sea = seaHolder(w, zone);
    if (sea !== 0 && w.wars.atWar(sea, n)) return;
    target = i;
  });
  if (target < 0) return 'noTarget';
  const free = (id: number): boolean => !w.offLand(id) && c.nation[id] === n && c.moving[id] !== 1 && c.engaged[id] !== 1 && c.retreat[id] === 0 && c.home[id] === 0;
  let atPort = false;
  let onLand = false;
  const comp = navOf(w).grid.component;
  const land = comp[w.ports[port]!.cell]!;
  f.forEach((id) => {
    if (!free(id)) return;
    if (near(w, cellOf(id), water[port]!, w.atSize(AT_PORT_CELLS))) atPort = true;
    else if (comp[cellOf(id)] === land) onLand = true;
  });
  return atPort ? 'atPort' : onLand ? 'send' : 'noneFree';
}

const years_: unknown[] = [];
let day = 0;
const t0 = Date.now();
for (let y = 0; y < years; y++) {
  const yr = { year: y + 1, warDays: 0, frontless: 0, contact: 0, noContact: 0, engaged: 0, gates: Object.fromEntries(GATES.map((g) => [g, 0])) as Record<Gate, number>, gateNations: {} as Record<string, Record<string, number>>, nearestKmNoContact: [] as number[], nearestKmContact: [] as number[], byWar: new Map<number, { contact: number; noContact: number; big: boolean }>() };
  for (let d = 0; d < 365; d++, day++) {
    s.step(24, (ww) => {
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    const c = w.formations.cols;
    const fronts = warsWithFront(w);
    // Front cells by pair of nations.
    const pairCells = new Map<number, number>();
    const { w: cw, h: ch, controller } = w.cells;
    const nb: number[] = [];
    for (const cell of frontierOf(w)) {
      const a = controller[cell]!;
      const seen = new Set<number>();
      for (const k of neighbours4(cell, cw, ch, w.settings.loopingMap, nb)) {
        const b = controller[k]!;
        if (b === 0 || b === a || seen.has(b)) continue;
        seen.add(b);
        pairCells.set(a * 65536 + b, (pairCells.get(a * 65536 + b) ?? 0) + 1);
      }
    }
    const land: number[] = [];
    const engaged: number[] = [];
    w.formations.forEach((id) => {
      if (!isLand(id)) return;
      land.push(id);
      if (c.engaged[id] === 1) engaged.push(id);
    });
    yr.engaged += engaged.length;
    const reach = w.atSize(CONTACT_CELLS) * 1.5;
    for (const war of w.wars.list) {
      const [A, D] = war.sides;
      let r = wars.get(war.id);
      if (!r) {
        r = { id: war.id, a: tag(A[0]!), d: tag(D[0]!), sideA: [], sideD: [], start: day, end: null, how: '', frontless: 0, contact: 0, noContact: 0, longestNoContact: 0, run: 0, frontCells: [], nearestKm: [], nearA: [], nearD: [], landA: [], landD: [], movingA: [], movingD: [], last: { score: 0, exA: 0, exD: 0, frontless: 0, days: 0, ftd: false } };
        wars.set(war.id, r);
      }
      for (const n of A) if (!r.sideA.includes(tag(n))) r.sideA.push(tag(n));
      for (const n of D) if (!r.sideD.includes(tag(n))) r.sideD.push(tag(n));
      r.last = { score: war.score, exA: Math.round(war.exhaustion[0]!), exD: Math.round(war.exhaustion[1]!), frontless: war.frontless ?? 0, days: (w.tick - war.startTick) / 24, ftd: war.fightToDeath[0]! || war.fightToDeath[1]! };
      yr.warDays++;
      if (!fronts.has(war.id)) {
        r.frontless++;
        yr.frontless++;
        continue;
      }
      const inA = new Set(A);
      const inD = new Set(D);
      let contact = false;
      for (const g of engaged) {
        if (!inA.has(c.nation[g]!)) continue;
        for (const h of engaged) {
          if (!inD.has(c.nation[h]!)) continue;
          if (Math.hypot(c.x[g]! - c.x[h]!, c.y[g]! - c.y[h]!) <= reach) {
            contact = true;
            break;
          }
        }
        if (contact) break;
      }
      let bw = yr.byWar.get(war.id);
      if (!bw) yr.byWar.set(war.id, (bw = { contact: 0, noContact: 0, big: false }));
      if (contact) bw.contact++;
      else bw.noContact++;
      if (contact) {
        r.contact++;
        yr.contact++;
        r.run = 0;
      } else {
        r.noContact++;
        yr.noContact++;
        r.run++;
        r.longestNoContact = Math.max(r.longestNoContact, r.run);
      }
      if (d % 7 === 0) {
        let cells = 0;
        for (const a of A) for (const b of D) cells += (pairCells.get(a * 65536 + b) ?? 0) + (pairCells.get(b * 65536 + a) ?? 0);
        const la = land.filter((g) => inA.has(c.nation[g]!));
        const ld = land.filter((g) => inD.has(c.nation[g]!));
        let best = Infinity;
        const nearOf = (mine: number[], theirs: number[]): number => {
          let k = 0;
          for (const g of mine) {
            let m = Infinity;
            for (const h of theirs) m = Math.min(m, seaKm(w, c.x[g]!, c.y[g]!, c.x[h]!, c.y[h]!));
            best = Math.min(best, m);
            if (m <= NEAR_KM) k++;
          }
          return k;
        };
        r.frontCells.push(cells);
        r.nearA.push(nearOf(la, ld));
        r.nearD.push(nearOf(ld, la));
        r.nearestKm.push(Number.isFinite(best) ? Math.round(best) : -1);
        if (la.length >= BIG || ld.length >= BIG) bw.big = true;
        r.landA.push(la.length);
        r.landD.push(ld.length);
        r.movingA.push(la.filter((g) => c.moving[g] === 1).length);
        r.movingD.push(ld.filter((g) => c.moving[g] === 1).length);
        if (Number.isFinite(best)) (contact ? yr.nearestKmContact : yr.nearestKmNoContact).push(Math.round(best));
      }
    }
    const live = new Set(w.wars.list.map((x) => x.id));
    for (const r of wars.values()) {
      if (r.end !== null || live.has(r.id)) continue;
      r.end = day;
      const l = r.last;
      r.how = Math.abs(l.score) >= 100 ? 'capitulation' : l.days >= MAX_WAR_DAYS - 1 ? 'maxDays' : l.frontless >= FRONTLESS_DAYS - 1 ? 'frontless' : l.ftd ? 'otherTerms' : l.exA >= EXHAUSTED - 1 || l.exD >= EXHAUSTED - 1 ? 'exhausted' : Math.abs(l.score) >= CRUSHED - 2 ? 'crushed' : 'brokeOrOther';
    }
    // The invasion AI's gates, for every nation at war.
    const fronted = new Set<number>();
    for (const war of w.wars.list) {
      if (!fronts.has(war.id)) continue;
      const [A, D] = war.sides;
      for (const a of A) for (const b of D) if (pairCells.has(a * 65536 + b) || pairCells.has(b * 65536 + a)) fronted.add(a).add(b);
    }
    const aboard = new Set<number>();
    for (const id of w.embarked.keys()) aboard.add(c.nation[id]!);
    for (const n of w.wars.nations()) {
      if (w.nations.cols.living[n] !== 1) continue;
      const g: Gate = fronted.has(n) ? 'fronted' : aboard.has(n) ? 'aboard' : landingGate(n);
      yr.gates[g]++;
      if (g !== 'fronted') (yr.gateNations[tag(n)] ??= {})[g] = ((yr.gateNations[tag(n)] ?? {})[g] ?? 0) + 1;
    }
  }
  const med = (a: number[]): number | null => (a.length ? [...a].sort((x, z) => x - z)[a.length >> 1]! : null);
  let bigC = 0;
  let bigN = 0;
  for (const v of yr.byWar.values()) if (v.big) [bigC, bigN] = [bigC + v.contact, bigN + v.noContact];
  const row = { year: yr.year, bigWarContactShare: bigC + bigN > 0 ? +(bigC / (bigC + bigN)).toFixed(3) : null, bigWarFrontDays: bigC + bigN, warDays: yr.warDays, frontless: yr.frontless, contact: yr.contact, noContact: yr.noContact, engagedPerDay: +(yr.engaged / 365).toFixed(1), medianNearestKmNoContact: med(yr.nearestKmNoContact), medianNearestKmContact: med(yr.nearestKmContact), gates: yr.gates, gateNations: Object.fromEntries(Object.entries(yr.gateNations).sort((a, b) => Object.values(b[1]).reduce((x, z) => x + z, 0) - Object.values(a[1]).reduce((x, z) => x + z, 0)).slice(0, 10)) };
  years_.push(row);
  process.stderr.write(`${JSON.stringify(row)}\n${((Date.now() - t0) / 60000).toFixed(1)} min\n`);
}
writeFileSync(out, JSON.stringify({ seed, years, nearKm: NEAR_KM, years_, wars: [...wars.values()] }, null, 1));
process.stderr.write(`done: seed ${seed}, ${wars.size} wars\n`);

/**
 * PLAN 7.35d2a: why navies at war stand in port (7.35d1, `docs/evidence/7.35/measure-d.md` §2: after
 * year 1 the navies keep their power and the pairs at war in one basin hold, but their fleets under
 * way fall 4.6 % → 1.2 %).
 *
 * On each nation's naval AI day (`navalAi`: day start, `(day + n) % STAGGER === 0`), read just before
 * that tick, each of its warfleets (`fleetPower` > 0) is put under the one test of `plan` that decides
 * it, the tests read as `plan` reads them (its exported parts: `forwardBases`, `stageTo`,
 * `navalBombers`, `SORTIE_KM`, `AVOID_RATIO`):
 * - not standing: `moving`, `engaged`; placed by the editor: `station`;
 * - away from its bloc's ports: `awayHome` (sent home: the enemy far the stronger, or empty water
 *   under naval bombers); else by what it stands at: `awayEnemyPort` (an enemy-held port's water:
 *   on station), `awayLostPartner` (such a port whose rightful owner, `owner`, is at war with its
 *   holder and not with n: PLAN 7.35d's third hole, a partner's port the enemy holds),
 *   `awayPartnerPort` (a port of a nation on n's side of a war, not its bloc), `awayNeutralPort`
 *   (of a nation at war with neither), `awayOpen` (no port within `AT_PORT_CELLS`). For each of
 *   these of `sea`, what a sortie from where it stands would find (`away`: a winnable target with
 *   enemy ships, only empty ones, none), its own power the test's. Since PLAN 7.35d2b `plan` gives
 *   such a fleet a new order (`awayOrder`): it is noted under its place only when it stands
 *   (escorting a landing, or on station by an enemy port with no battle to seek), else under
 *   `awayBattle`, `awayStation` or `awayBack`. Since PLAN 7.35d2c a standing enemy warfleet in reach
 *   (`standingWarfleets`), of its basin, whose zone its fleets together can win, is a battle too:
 *   `awayHunt` (sails for it), `awayBeside` (stands by one);
 * - at a port of its bloc's: `escort`; `sortie` (a target with enemy ships), `sortieEmpty` (a target
 *   with none), `hunt` (a standing enemy warfleet, PLAN 7.35d2c), `atTarget` (stands within
 *   `AT_PORT_CELLS` of its target already); with ports in reach
 *   and none taken, `heldStronger` (every one the enemy's power there over its fleets' together),
 *   `heldBombed` (every one empty water under naval bombers), `heldBoth`; with none in reach,
 *   `stage`, `atBase`, `noBaseInBasin` (forward bases, none in its basin), `noBase` (no forward base:
 *   their zones the enemy's, or no bloc port within reach of a target), `noEnemyPort` (no enemy port
 *   with open water at all).
 * The three holes PLAN 7.35b4 left are counted on the orders: a sortie's or a stage's target in
 * another basin than the fleet's (`otherBasin`; `orderSail` refuses it, `MoveRejected`), and a way
 * whose sea route is over 1.5 times the straight line and longer than `SORTIE_KM` (`farWay`).
 * Each fleet is tagged `sea` when its nation is at war with a nation that has an armed fleet in the
 * fleet's basin (7.35d1's "sea pairs").
 * Checked against the tick: of the fleets read as ordered, how many are under way or refused after it
 * (`agree`), and of those read as held, how many are under way after it (`stray`).
 *
 * Usage: npx tsx tools/diag/seaHold.ts <seed> <years> [out = .cache/seaHold_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { EventKind, RejectReason } from '../../src/shared/events';
import { isDayStart } from '../../src/shared/calendar';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { AT_PORT_CELLS, basinAt, seaKm } from '../../src/sim/systems/navalCombat';
import { fleetPower, navalPower } from '../../src/sim/systems/seaControl';
import { blocOf } from '../../src/sim/systems/supply';
import { AVOID_RATIO, forwardBases, navalBombers, SORTIE_KM, stageTo, standingWarfleets } from '../../src/sim/ai/naval';
import { STAGGER } from '../../src/sim/ai/strategic';
import { basinOf, portSeaOf, seaOf, seaRangeOf, type World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 6);
const out = process.argv[4] ?? `.cache/seaHold_${seed}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });

type Why =
  | 'moving' | 'engaged' | 'station'
  | 'awayHome' | 'awayEnemyPort' | 'awayLostPartner' | 'awayPartnerPort' | 'awayNeutralPort' | 'awayOpen'
  | 'awayBattle' | 'awayHunt' | 'awayBeside' | 'awayStation' | 'awayBack'
  | 'escort' | 'sortie' | 'sortieEmpty' | 'hunt' | 'atTarget'
  | 'heldStronger' | 'heldBombed' | 'heldBoth'
  | 'stage' | 'atBase' | 'noBaseInBasin' | 'noBase' | 'noEnemyPort';
type Tally = Record<string, number>;
type Year = {
  year: number;
  sea: Tally;
  other: Tally;
  holes: { otherBasin: number; farWay: number; rejected: number };
  /** Away fleets not sent home, of `sea`, by bucket: a sortie from where they stand (their own power the test's) would find a winnable target with enemy ships (`battle`), only empty ones (`empty`), or none (`none`). */
  away: Record<string, { battle: number; empty: number; none: number }>;
  /** `sortieEmpty` orders of `sea`: a winnable target with enemy ships was in reach too, farther (`defended`), or not (`none`). */
  emptyPick: { defended: number; none: number };
  /** Of those `away` with no battle to seek: where the nearest enemy warfleet of their basin stands (under way; beyond `SORTIE_KM`; within it at an enemy port, too strong for the fleet alone; within it at no port of n's enemies, so no target; none). */
  enemyAt: { moving: number; far: number; targetStronger: number; notTarget: number; none: number };
  check: { ordered: number; agree: number; held: number; stray: number; miss: Tally; pingPong: number };
  /** `awayNeutralPort` fleet-days of `sea` (PLAN 7.35d2b's trace): the port's holder was at war with the fleet's nation earlier in the run (`wasEnemy`: a station whose war ended), or never (`never`). */
  neutralWas: { wasEnemy: number; never: number };
  /** The orders of those `awayNeutralPort` fleet-days (PLAN 7.35d2b's rule): a battle, a new station, home. */
  neutralOrder: { battle: number; station: number; home: number };
  /** For `heldStronger` fleet-days of `sea`: the enemy's power at the nearest target over its fleets' together (median). */
  strongerRatio: number[];
};

/** The pending reads of the day: fleet → (why, ordered, target). */
let pending: { id: number; why: Why; ordered: boolean; sea: boolean; target: number }[] = [];
/** The pairs of nations at war on some day read so far (`a * 65536 + b`, both orders). */
const everWar = new Set<number>();
/** Per fleet, the targets of its last two away orders (`awayBattle`, `awayStation`). */
const lastTargets = new Map<number, number[]>();

function read(w: World, y: Year): void {
  const c = w.formations.cols;
  const nc = w.nations.cols;
  const W = w.cells.w;
  const day = w.tick / 24;
  const z = seaOf(w);
  const water = portSeaOf(w);
  const ctl = w.cells.controller;
  const { basin, ocean } = basinOf(w);
  const power = navalPower(w);
  // The standing warfleets the naval AI hunts (PLAN 7.35d2c), read as `navalAi` reads them.
  const prey = standingWarfleets(w);
  for (const war of w.wars.list) for (const a of war.sides[0]) for (const b of war.sides[1]) everWar.add(a * 65536 + b).add(b * 65536 + a);
  // Armed fleets' basins by nation, for the `sea` tag.
  const armed = new Map<number, Set<number>>();
  const fleets: number[] = [];
  w.formations.forEach((id) => {
    if (!w.isFleet(id) || fleetPower(w, id) <= 0) return;
    fleets.push(id);
    const n = c.nation[id]!;
    let s = armed.get(n);
    if (!s) armed.set(n, (s = new Set()));
    s.add(basinAt(w, c.x[id]!, c.y[id]!));
  });
  const cellOf = (id: number): number => Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!);
  const near = (a: number, b: number): boolean => {
    let dx = Math.abs((a % W) - (b % W));
    if (w.settings.loopingMap && dx > W / 2) dx = W - dx;
    return dx <= w.atSize(AT_PORT_CELLS) && Math.abs(Math.floor(a / W) - Math.floor(b / W)) <= w.atSize(AT_PORT_CELLS);
  };
  const km = (id: number, cell: number): number => seaKm(w, c.x[id]!, c.y[id]!, (cell % W) + 0.5, Math.floor(cell / W) + 0.5);
  const byNation = new Map<number, number[]>();
  for (const id of fleets) {
    const n = c.nation[id]!;
    if (nc.living[n] !== 1 || nc.aiOff[n] === 1 || (day + n) % STAGGER !== 0) continue;
    if (!w.wars.list.some((war) => war.sides[0].includes(n) || war.sides[1].includes(n))) continue;
    let l = byNation.get(n);
    if (!l) byNation.set(n, (l = []));
    l.push(id);
  }
  for (const n of [...byNation.keys()].sort((a, b) => a - b)) {
    const bloc = blocOf(w, n);
    const enemyIn = (zone: number): number => {
      let e = 0;
      for (const [b, p] of power.get(zone) ?? []) if (b !== bloc && w.wars.atWar(b, n)) e += p;
      return e;
    };
    let bombers: { x: number; y: number; r: number }[] | undefined;
    const bombed = (x: number, yy: number): boolean => (bombers ??= navalBombers(w, n)).some((b) => seaKm(w, b.x, b.y, x, yy) <= b.r);
    const atOwnPort = (id: number): boolean => w.ports.some((p, i) => water[i]! >= 0 && ctl[p.cell] !== 0 && blocOf(w, ctl[p.cell]!) === bloc && near(cellOf(id), water[i]!));
    const escorting = (id: number): boolean => {
      for (const [fid, e] of w.embarked) if (c.nation[fid] === n && e.water >= 0 && near(cellOf(id), e.water)) return true;
      return false;
    };
    const seaOfFleet = (id: number): boolean => {
      const b = basinAt(w, c.x[id]!, c.y[id]!);
      for (const [m, s] of armed) if (m !== n && w.wars.atWar(n, m) && s.has(b)) return true;
      return false;
    };
    const war: { id: number; p: number }[] = [];
    const awayStanding: { id: number; p: number; e: number; why: Why }[] = [];
    const note = (id: number, why: Why, ordered = false, target = -1): void => {
      const sea = seaOfFleet(id);
      const t = sea ? y.sea : y.other;
      t[why] = (t[why] ?? 0) + 1;
      pending.push({ id, why, ordered, sea, target });
    };
    for (const id of byNation.get(n)!) {
      if (c.moving[id] === 1) { note(id, 'moving'); continue; }
      if (c.engaged[id] === 1 || seaRangeOf(w, id) !== undefined) { note(id, 'engaged'); continue; }
      if (w.station.has(id)) { note(id, 'station'); continue; }
      const p = fleetPower(w, id);
      if (!atOwnPort(id)) {
        const e = enemyIn(z.zoneOf[cellOf(id)]!);
        if (e > AVOID_RATIO * p || (e === 0 && bombed(c.x[id]!, c.y[id]!) && !escorting(id))) { note(id, 'awayHome', true); continue; }
        let held = -1;
        w.ports.forEach((port, i) => {
          if (held < 0 && water[i]! >= 0 && ctl[port.cell] !== 0 && w.wars.atWar(n, ctl[port.cell]!) && near(cellOf(id), water[i]!)) held = port.cell;
        });
        let why: Why;
        if (held >= 0) {
          const owner = w.cells.owner[held]!;
          why = owner !== 0 && owner !== n && !w.wars.atWar(n, owner) && w.wars.atWar(owner, ctl[held]!) ? 'awayLostPartner' : 'awayEnemyPort';
        } else {
          // A port held by a nation not at war with n, not of its bloc: a partner's (on n's side of a war) or a neutral's; else open water.
          let other = -1;
          w.ports.forEach((port, i) => {
            if (other < 0 && water[i]! >= 0 && ctl[port.cell] !== 0 && near(cellOf(id), water[i]!)) other = ctl[port.cell]!;
          });
          const partner = other >= 0 && w.wars.list.some((war) => war.sides.some((s) => s.includes(n) && s.includes(other)));
          why = other < 0 ? 'awayOpen' : partner ? 'awayPartnerPort' : 'awayNeutralPort';
          if (why === 'awayNeutralPort' && seaOfFleet(id)) y.neutralWas[everWar.has(n * 65536 + other) ? 'wasEnemy' : 'never']++;
        }
        // Noted below, by `awayOrder`'s test (PLAN 7.35d2b), once the targets are known.
        awayStanding.push({ id, p, e, why });
        continue;
      }
      war.push({ id, p });
    }
    let escort = -1;
    for (const [fid, e] of [...w.embarked].sort((a, b) => a[0] - b[0])) if (c.nation[fid] === n && e.water >= 0) { escort = e.water; break; }
    // In port and away together (PLAN 7.35d2b).
    const together = (cell: number): number => war.reduce((s, x) => s + (km(x.id, cell) <= SORTIE_KM ? x.p : 0), 0) + awayStanding.reduce((s, x) => s + (km(x.id, cell) <= SORTIE_KM ? x.p : 0), 0);
    const targets: { at: number; enemy: number }[] = [];
    w.ports.forEach((p, i) => {
      const holder = ctl[p.cell]!;
      const at = water[i]!;
      if (holder === 0 || at < 0 || !w.wars.atWar(n, holder)) return;
      const zone = z.zoneOf[at]!;
      if (zone !== 0 && z.closed[zone] !== 1) targets.push({ at, enemy: enemyIn(zone) });
    });
    const hunts = prey.filter((q) => w.wars.atWar(n, q.nation)).map((q) => ({ at: q.at, enemy: enemyIn(q.zone), basin: basin[q.zone] || ocean }));
    const empty = (t: { at: number; enemy: number }): boolean => t.enemy === 0 && bombed((t.at % W) + 0.5, Math.floor(t.at / W) + 0.5);
    // Away and not sent home: `awayOrder`'s test (PLAN 7.35d2b). Noted under its place (`why`) when
    // it stands (escorting, or on station by an enemy port); else `awayBattle` (a winnable target with
    // enemy ships), `awayStation` (a new station at an empty one), `awayBack` (home).
    for (const a of awayStanding) {
      if (escorting(a.id)) { note(a.id, a.why); continue; }
      let battle = -1;
      let station = -1;
      let bestB = Infinity;
      let bestS = Infinity;
      let onStation = false;
      let hunt = false;
      let beside = false;
      const mineB = basinAt(w, c.x[a.id]!, c.y[a.id]!);
      for (const t of hunts) {
        if (t.basin !== mineB || t.enemy > together(t.at)) continue;
        if (near(cellOf(a.id), t.at)) { beside = true; continue; }
        const d = km(a.id, t.at);
        if (d <= SORTIE_KM && d < bestB) [bestB, battle, hunt] = [d, t.at, true];
      }
      if (beside) { note(a.id, 'awayBeside'); continue; }
      for (const t of targets) {
        if (near(cellOf(a.id), t.at)) { onStation = true; continue; }
        const d = km(a.id, t.at);
        if (d > SORTIE_KM || t.enemy > together(t.at) || empty(t)) continue;
        if (a.e === 0 && t.enemy > 0 && d < bestB) [bestB, battle, hunt] = [d, t.at, false];
        if (d < bestS) [bestS, station] = [d, t.at];
      }
      if (battle >= 0) note(a.id, hunt ? 'awayHunt' : 'awayBattle', true, battle);
      else if (onStation) note(a.id, a.why);
      else if (station >= 0) note(a.id, 'awayStation', true, station);
      else note(a.id, 'awayBack', true);
      if (a.why === 'awayNeutralPort' && seaOfFleet(a.id)) y.neutralOrder[battle >= 0 ? 'battle' : station >= 0 ? 'station' : 'home']++;
    }
    // Away and not sent home: what a sortie from where it stands would find.
    for (const a of awayStanding) {
      if (!seaOfFleet(a.id)) continue;
      let battle = false;
      let anyT = false;
      const mineB = basinAt(w, c.x[a.id]!, c.y[a.id]!);
      for (const t of hunts) if (t.basin === mineB && km(a.id, t.at) <= SORTIE_KM && !near(cellOf(a.id), t.at) && t.enemy <= a.p) battle = anyT = true;
      for (const t of targets) {
        if (km(a.id, t.at) > SORTIE_KM || near(cellOf(a.id), t.at) || t.enemy > a.p || empty(t)) continue;
        anyT = true;
        if (t.enemy > 0) battle = true;
      }
      const b = (y.away[a.why] ??= { battle: 0, empty: 0, none: 0 });
      if (battle) b.battle++;
      else if (anyT) b.empty++;
      else b.none++;
      if (!battle) {
        // No battle to seek: where the nearest enemy warfleet of its basin stands.
        const mine = basinAt(w, c.x[a.id]!, c.y[a.id]!);
        let d = Infinity;
        let e = -1;
        for (const f of fleets) {
          if (!w.wars.atWar(n, c.nation[f]!) || basinAt(w, c.x[f]!, c.y[f]!) !== mine) continue;
          const k = seaKm(w, c.x[a.id]!, c.y[a.id]!, c.x[f]!, c.y[f]!);
          if (k < d) [d, e] = [k, f];
        }
        let where: keyof Year['enemyAt'] = 'none';
        if (e >= 0) {
          const atTarget = targets.some((t) => near(cellOf(e), t.at));
          if (c.moving[e] === 1) where = 'moving';
          else if (d > SORTIE_KM) where = 'far';
          else if (atTarget) where = 'targetStronger';
          else where = 'notTarget';
        }
        y.enemyAt[where]++;
      }
    }
    if (war.length === 0) continue;
    let bases: number[] | undefined;
    for (const { id } of war) {
      const mine = basinAt(w, c.x[id]!, c.y[id]!);
      if (escort >= 0 && km(id, escort) <= SORTIE_KM) { note(id, near(cellOf(id), escort) ? 'atTarget' : 'escort', !near(cellOf(id), escort), escort); continue; }
      let best = Infinity;
      let target = -1;
      let enemyAt = 0;
      let isHunt = false;
      let stronger = 0;
      let bombedN = 0;
      let inReach = 0;
      let nearest: { at: number; enemy: number } | undefined;
      let nearestD = Infinity;
      for (const t of targets) {
        const d = km(id, t.at);
        if (d > SORTIE_KM) continue;
        inReach++;
        if (d < nearestD) [nearestD, nearest] = [d, t];
        const tooStrong = t.enemy > together(t.at);
        const isEmpty = empty(t);
        if (tooStrong) stronger++;
        if (isEmpty) bombedN++;
        if (d < best && !tooStrong && !isEmpty) [best, target, enemyAt] = [d, t.at, t.enemy];
      }
      for (const t of hunts) {
        if (t.basin !== mine) continue;
        const d = km(id, t.at);
        if (d <= SORTIE_KM && d < best && t.enemy <= together(t.at)) [best, target, enemyAt, isHunt] = [d, t.at, t.enemy, true];
      }
      if (target >= 0) {
        if (!isHunt && basin[z.zoneOf[target]!] !== mine) y.holes.otherBasin++;
        if (near(cellOf(id), target)) note(id, 'atTarget');
        else note(id, isHunt ? 'hunt' : enemyAt > 0 ? 'sortie' : 'sortieEmpty', true, target);
        if (enemyAt === 0 && seaOfFleet(id)) {
          if (targets.some((t) => t.enemy > 0 && km(id, t.at) <= SORTIE_KM && t.enemy <= together(t.at))) y.emptyPick.defended++;
          else y.emptyPick.none++;
        }
        continue;
      }
      if (inReach > 0) {
        if (stronger > 0 && bombedN === 0) {
          note(id, 'heldStronger');
          if (seaOfFleet(id) && nearest) y.strongerRatio.push(nearest.enemy / Math.max(1, together(nearest.at)));
        } else if (bombedN > 0 && stronger === 0) note(id, 'heldBombed');
        else note(id, 'heldBoth');
        continue;
      }
      if (targets.length === 0) { note(id, 'noEnemyPort'); continue; }
      bases ??= forwardBases(w, bloc, targets.filter((t) => !empty(t)), war, enemyIn);
      if (bases.length === 0) { note(id, 'noBase'); continue; }
      const at = stageTo(w, id, bases);
      if (at < 0) { note(id, 'noBaseInBasin'); continue; }
      if (near(cellOf(id), at)) { note(id, 'atBase'); continue; }
      note(id, 'stage', true, at);
    }
  }
}

/** After the AI's tick: the reads checked, and the ways' lengths against the straight line. */
function check(w: World, y: Year, rejected: Set<number>): void {
  const c = w.formations.cols;
  const W = w.cells.w;
  for (const r of pending) {
    if (!w.formations.has(r.id)) continue;
    const moving = c.moving[r.id] === 1;
    if (r.ordered) {
      y.check.ordered++;
      if (moving || rejected.has(r.id)) y.check.agree++;
      else y.check.miss[r.why] = (y.check.miss[r.why] ?? 0) + 1;
      if (r.target >= 0 && (r.why === 'awayBattle' || r.why === 'awayHunt' || r.why === 'awayStation')) {
        // A fleet sent back to where it was ordered two orders before (PLAN 7.35d2b: the hop between ports).
        const was = lastTargets.get(r.id) ?? [-1, -1];
        if (was[0] === r.target) y.check.pingPong++;
        lastTargets.set(r.id, [was[1]!, r.target]);
      }
      if (rejected.has(r.id)) y.holes.rejected++;
      const path = w.paths.get(r.id);
      if (moving && path && r.target >= 0 && (r.why === 'sortie' || r.why === 'sortieEmpty' || r.why === 'stage')) {
        let way = 0;
        for (let i = 1; i < path.length; i++) way += seaKm(w, (path[i - 1]! % W) + 0.5, Math.floor(path[i - 1]! / W) + 0.5, (path[i]! % W) + 0.5, Math.floor(path[i]! / W) + 0.5);
        const line = seaKm(w, (path[0]! % W) + 0.5, Math.floor(path[0]! / W) + 0.5, (r.target % W) + 0.5, Math.floor(r.target / W) + 0.5);
        if (way > 1.5 * line && way > SORTIE_KM) y.holes.farWay++;
      }
    } else if (r.why !== 'moving' && r.why !== 'engaged') {
      y.check.held++;
      if (moving) y.check.stray++;
    }
  }
  pending = [];
}

const rows: Year[] = [];
const t0 = Date.now();
for (let year = 1; year <= years; year++) {
  const y: Year = { year, sea: {}, other: {}, holes: { otherBasin: 0, farWay: 0, rejected: 0 }, away: {}, emptyPick: { defended: 0, none: 0 }, neutralWas: { wasEnemy: 0, never: 0 }, neutralOrder: { battle: 0, station: 0, home: 0 }, enemyAt: { moving: 0, far: 0, targetStronger: 0, notTarget: 0, none: 0 }, check: { ordered: 0, agree: 0, held: 0, stray: 0, miss: {}, pingPong: 0 }, strongerRatio: [] };
  const rejected = new Set<number>();
  sim.step(24 * 365, (w) => {
    const ev = w.out.events;
    if (pending.length > 0) {
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.MoveRejected && ev[i + 4] === RejectReason.NoSeaWay) rejected.add(ev[i + 2]!);
      check(w, y, rejected);
      rejected.clear();
    }
    ev.length = 0;
    w.out.fires.length = 0;
    // The next tick is a day's start: read the state its naval AI will read.
    if (isDayStart(w.tick) && w.settings.aiEnabled && w.rules) read(w, y);
  });
  y.strongerRatio.sort((a, b) => a - b);
  const r = y.strongerRatio;
  const med = r.length > 0 ? Math.round(r[Math.floor(r.length / 2)]! * 100) / 100 : 0;
  rows.push({ ...y, strongerRatio: [med, r.length] });
  console.log(JSON.stringify({ year, sea: y.sea, away: y.away, emptyPick: y.emptyPick, neutralWas: y.neutralWas, neutralOrder: y.neutralOrder, enemyAt: y.enemyAt, holes: y.holes, check: y.check, stronger: [med, r.length] }));
}
writeFileSync(out, JSON.stringify({ seed, years, wallS: Math.round((Date.now() - t0) / 1000), rows }, null, 1));
console.log(`done: ${out}`);

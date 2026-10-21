/**
 * PLAN 7.39a: why a warfleet at war stands, as the naval AI's `plan` (`src/sim/ai/naval.ts`) would
 * read it on its day. Shared by `seaMeet` (one pair of nations) and `seaWars` (every war, years).
 *
 * `whyCtx(w)` caches per nation, for one sample: its bloc, its waters' keys (`waterKeys`), the
 * enemy's naval bombers (`navalBombers`), its standing warfleets at its bloc's ports and away (the
 * `together` of `plan`), the enemy ports and standing enemy warfleets. `sortieWhy(ctx, f)` then says
 * for warfleet `f` what `plan` does: a bucket (`Why`) and, for a print, the target or the reason.
 */
import { AT_PORT_CELLS, seaKm } from '../../src/sim/systems/navalCombat';
import { fleetPower, navalPower } from '../../src/sim/systems/seaControl';
import { blocOf } from '../../src/sim/systems/supply';
import { AVOID_RATIO, forwardBases, keyAt, navalBombers, SORTIE_KM, stageTo, standingWarfleets, waterKeys } from '../../src/sim/ai/naval';
import { portSeaOf, seaOf, seaRangeOf, type World } from '../../src/sim/world';

/**
 * What `plan` does with a warfleet that stands (not under way, not in a sea battle), at war:
 * - `take`: a target in reach that its warfleets together can win (it sails on its AI day, or it is there);
 * - `stage` / `stageThere`: no enemy port of its waters within `SORTIE_KM`, a forward base to sail to (or it is at it);
 * - `noBase`: none in reach and no forward base (it stands);
 * - `noTarget`: no enemy port anywhere in reach of any water (the enemy holds no open port), no enemy fleet in reach;
 * - `tooStrong`: enemy ports in reach, each zone's enemy over its warfleets there together;
 * - `emptyBombed`: in reach, each fightable one empty water under the enemy's naval bombers;
 * - away from its bloc's ports, as `awayOrder`: `awayBeside` (by a standing enemy warfleet it can
 *   win: it stays), `awayHunt` (such a fleet in reach: it sails), `awayStation` (by an enemy port:
 *   it stays, the blockade), `awayNewStation` (an enemy port in reach: it sails there), `awayHome`
 *   (sent home: the enemy's power, the bombers, or no station).
 */
export type Why = 'take' | 'stage' | 'stageThere' | 'noBase' | 'noTarget' | 'tooStrong' | 'emptyBombed' | 'awayBeside' | 'awayHunt' | 'awayChase' | 'awayStation' | 'awayNewStation' | 'awayHome';

/**
 * For a fleet on station (`awayStation`), why the nearest armed enemy fleet is not hunted: none at
 * all, of other waters (`waterKeys`), beyond `SORTIE_KM`, under way or in a battle (not prey), or its
 * zone's enemy power over its warfleets there together.
 */
export type Prey = 'none' | 'otherWater' | 'far' | 'underWay' | 'strong' | 'huntable';

export interface WhyCtx {
  w: World;
  power: Map<number, Map<number, number>>;
  nation: Map<number, NationCtx>;
}

interface NationCtx {
  bloc: number;
  keys: Int32Array;
  bombers: { x: number; y: number; r: number }[];
  /** Its standing warfleets at its bloc's ports and away (not sent home), with their power. */
  together: { id: number; p: number; port: boolean }[];
  /** Enemy ports with open water: cell, zone's enemy power, key; and whether empty under bombers. */
  targets: { at: number; enemy: number; basin: number; name: string; emptyBombed: boolean }[];
  /** Standing enemy warfleets: cell, zone's enemy power, key. */
  hunts: { at: number; enemy: number; basin: number }[];
  enemyIn: (zone: number) => number;
}

export const whyCtx = (w: World): WhyCtx => ({ w, power: navalPower(w), nation: new Map() });

const cellOf = (w: World, g: number): number => Math.floor(w.formations.cols.y[g]!) * w.cells.w + Math.floor(w.formations.cols.x[g]!);

/** Within `AT_PORT_CELLS` of a cell, as `plan`'s `near`. */
const near = (w: World, a: number, b: number): boolean => {
  const ww = w.cells.w;
  let dx = Math.abs((a % ww) - (b % ww));
  if (w.settings.loopingMap && dx > ww / 2) dx = ww - dx;
  return dx <= w.atSize(AT_PORT_CELLS) && Math.abs(Math.floor(a / ww) - Math.floor(b / ww)) <= w.atSize(AT_PORT_CELLS);
};

/** Whether fleet `g` stands at a port of bloc `bloc`, as `plan`'s `atOwnPort`. */
export const atBlocPort = (w: World, g: number, bloc: number): boolean => {
  const water = portSeaOf(w);
  const ctl = w.cells.controller;
  return w.ports.some((p, i) => water[i]! >= 0 && ctl[p.cell] !== 0 && blocOf(w, ctl[p.cell]!) === bloc && near(w, cellOf(w, g), water[i]!));
};

let prey: ReturnType<typeof standingWarfleets> | undefined;
let preyTick = -1;

function nationCtx(ctx: WhyCtx, n: number): NationCtx {
  let nc = ctx.nation.get(n);
  if (nc) return nc;
  const w = ctx.w;
  const c = w.formations.cols;
  const ww = w.cells.w;
  const z = seaOf(w);
  const water = portSeaOf(w);
  const bloc = blocOf(w, n);
  const enemyIn = (zone: number): number => {
    let e = 0;
    for (const [b, p] of ctx.power.get(zone) ?? []) if (b !== bloc && w.wars.atWar(b, n)) e += p;
    return e;
  };
  const bombers = navalBombers(w, n);
  const bombed = (x: number, y: number): boolean => bombers.some((b) => seaKm(w, b.x, b.y, x, y) <= b.r);
  const keys = waterKeys(w, n);
  const together: NationCtx['together'] = [];
  w.formations.forEach((g) => {
    if (!w.isFleet(g) || c.nation[g] !== n || c.moving[g] === 1 || c.engaged[g] === 1 || seaRangeOf(w, g) !== undefined) return;
    const p = fleetPower(w, g);
    if (p <= 0) return;
    const port = atBlocPort(w, g, bloc);
    // Away and sent home by the enemy's power (`plan`'s first test) it is not in `away`; the
    // bombers' test is left out here.
    if (!port && enemyIn(z.zoneOf[cellOf(w, g)]!) > AVOID_RATIO * p) return;
    together.push({ id: g, p, port });
  });
  const targets: NationCtx['targets'] = [];
  w.ports.forEach((p, i) => {
    const holder = w.cells.controller[p.cell]!;
    const at = water[i]!;
    if (holder === 0 || at < 0 || !w.wars.atWar(n, holder)) return;
    const zone = z.zoneOf[at]!;
    if (zone === 0 || z.closed[zone] === 1) return;
    const enemy = enemyIn(zone);
    targets.push({ at, enemy, basin: keys[zone]!, name: p.name, emptyBombed: enemy === 0 && bombed((at % ww) + 0.5, Math.floor(at / ww) + 0.5) });
  });
  if (preyTick !== w.tick) [prey, preyTick] = [standingWarfleets(w), w.tick];
  const hunts = prey!.filter((q) => w.wars.atWar(n, q.nation)).map((q) => ({ at: q.at, enemy: enemyIn(q.zone), basin: keys[q.zone]! }));
  nc = { bloc, keys, bombers, together, targets, hunts, enemyIn };
  ctx.nation.set(n, nc);
  return nc;
}

/** What `plan` does with standing warfleet `f` of a nation at war, and a line for a print. */
export function sortieWhy(ctx: WhyCtx, f: number): { why: Why; text: string; inReach: number } {
  const w = ctx.w;
  const c = w.formations.cols;
  const ww = w.cells.w;
  const z = seaOf(w);
  const n = c.nation[f]!;
  const nc = nationCtx(ctx, n);
  const km = (cell: number): number => seaKm(w, c.x[f]!, c.y[f]!, (cell % ww) + 0.5, Math.floor(cell / ww) + 0.5);
  const together = (cell: number): number => nc.together.reduce((s, g) => s + (seaKm(w, c.x[g.id]!, c.y[g.id]!, (cell % ww) + 0.5, Math.floor(cell / ww) + 0.5) <= SORTIE_KM ? g.p : 0), 0);
  const p = fleetPower(w, f);
  const mine = keyAt(w, nc.keys, c.x[f]!, c.y[f]!);
  if (!atBlocPort(w, f, nc.bloc)) {
    const here = nc.enemyIn(z.zoneOf[cellOf(w, f)]!);
    const escort = [...w.embarked].some(([g, x]) => c.nation[g] === n && x.water >= 0 && near(w, cellOf(w, f), x.water));
    const air = here === 0 && nc.bombers.some((b) => seaKm(w, b.x, b.y, c.x[f]!, c.y[f]!) <= b.r) && !escort;
    if (here > AVOID_RATIO * p || air) return { why: 'awayHome', text: `away: zone's enemy ${Math.round(here)}${air ? ', empty under naval bombers' : ''} → home`, inReach: 0 };
    if (escort) return { why: 'awayStation', text: 'escorts a landing', inReach: 0 };
    // `awayOrder`, in its order.
    let beside = false;
    let hunt = Infinity;
    let chase = Infinity;
    const navy = nc.together.reduce((s, g) => s + (keyAt(w, nc.keys, c.x[g.id]!, c.y[g.id]!) === mine ? g.p : 0), 0);
    for (const t of nc.hunts) {
      if (t.basin !== mine) continue;
      if (km(t.at) > SORTIE_KM) {
        if (here === 0 && t.enemy <= navy) chase = Math.min(chase, km(t.at));
        continue;
      }
      if (t.enemy > together(t.at)) continue;
      if (near(w, cellOf(w, f), t.at)) beside = true;
      else hunt = Math.min(hunt, km(t.at));
    }
    if (beside) return { why: 'awayBeside', text: 'by an enemy fleet', inReach: 0 };
    let onStation = '';
    let station = Infinity;
    for (const t of nc.targets) {
      if (t.basin !== mine) continue;
      if (near(w, cellOf(w, f), t.at)) {
        onStation ||= t.name;
        continue;
      }
      const d = km(t.at);
      if (d > SORTIE_KM || t.enemy > together(t.at) || t.emptyBombed) continue;
      if (here === 0 && t.enemy > 0) hunt = Math.min(hunt, d);
      station = Math.min(station, d);
    }
    if (hunt < Infinity) return { why: 'awayHunt', text: `a battle ${Math.round(hunt)} km`, inReach: 0 };
    if (chase < Infinity) return { why: 'awayChase', text: `a chase ${Math.round(chase)} km`, inReach: 0 };
    if (onStation) return { why: 'awayStation', text: `on station at ${onStation}`, inReach: 0 };
    if (station < Infinity) return { why: 'awayNewStation', text: `a station ${Math.round(station)} km`, inReach: 0 };
    return { why: 'awayHome', text: 'no station', inReach: 0 };
  }
  let inReach = 0;
  let best = Infinity;
  let take = '';
  let strong = '';
  let empty = '';
  for (const t of nc.targets) {
    if (t.basin !== mine) continue;
    const d = km(t.at);
    if (d > SORTIE_KM) continue;
    inReach++;
    if (t.emptyBombed) {
      empty ||= `${t.name} ${Math.round(d)} km: empty, under naval bombers`;
      continue;
    }
    const tg = together(t.at);
    if (t.enemy > tg) {
      strong ||= `${t.name} ${Math.round(d)} km: enemy ${Math.round(t.enemy)} > together ${Math.round(tg)}`;
      continue;
    }
    if (d < best) [best, take] = [d, `${t.name} ${Math.round(d)} km, enemy ${Math.round(t.enemy)} ≤ ${Math.round(tg)}${near(w, cellOf(w, f), t.at) ? ' (there)' : ''}`];
  }
  for (const t of nc.hunts) {
    if (t.basin !== mine) continue;
    const d = km(t.at);
    if (d <= SORTIE_KM && d < best && t.enemy <= together(t.at)) [best, take] = [d, `enemy fleet ${Math.round(d)} km, enemy ${Math.round(t.enemy)}`];
  }
  if (take) return { why: 'take', text: take, inReach };
  if (inReach > 0) return strong ? { why: 'tooStrong', text: strong, inReach } : { why: 'emptyBombed', text: empty, inReach };
  const fightable = nc.targets.filter((t) => !t.emptyBombed);
  if (nc.targets.length === 0) return { why: 'noTarget', text: 'no open enemy port', inReach };
  const base = stageTo(w, f, forwardBases(w, nc.bloc, fightable, nc.together.filter((g) => g.port), nc.enemyIn, nc.keys), nc.keys);
  if (base < 0) return { why: 'noBase', text: `no enemy port within ${SORTIE_KM} km; no forward base`, inReach };
  const water = portSeaOf(w);
  const port = w.ports[water.indexOf(base)];
  const there = near(w, cellOf(w, f), base);
  return { why: there ? 'stageThere' : 'stage', text: `stage ${port?.name ?? base} ${Math.round(km(base))} km${there ? ' (there)' : ''}`, inReach };
}

/** Why the nearest armed enemy fleet of fleet `f`'s nation is not hunted from where `f` stands (`Prey`). */
export function preyWhy(ctx: WhyCtx, f: number): Prey {
  const w = ctx.w;
  const c = w.formations.cols;
  const ww = w.cells.w;
  const z = seaOf(w);
  const n = c.nation[f]!;
  const nc = nationCtx(ctx, n);
  const mine = keyAt(w, nc.keys, c.x[f]!, c.y[f]!);
  let best = Infinity;
  let g = -1;
  let sameBest = Infinity;
  let gs = -1;
  w.formations.forEach((e) => {
    if (!w.isFleet(e) || !w.wars.atWar(n, c.nation[e]!) || fleetPower(w, e) <= 0) return;
    const d = seaKm(w, c.x[f]!, c.y[f]!, c.x[e]!, c.y[e]!);
    if (d < best) [best, g] = [d, e];
    if (keyAt(w, nc.keys, c.x[e]!, c.y[e]!) === mine && d < sameBest) [sameBest, gs] = [d, e];
  });
  if (g < 0) return 'none';
  if (gs < 0) return 'otherWater';
  if (sameBest > SORTIE_KM) return 'far';
  if (c.moving[gs] === 1 || c.engaged[gs] === 1) return 'underWay';
  const at = Math.floor(c.y[gs]!) * ww + Math.floor(c.x[gs]!);
  const tg = nc.together.reduce((s, x) => s + (seaKm(w, c.x[x.id]!, c.y[x.id]!, (at % ww) + 0.5, Math.floor(at / ww) + 0.5) <= SORTIE_KM ? x.p : 0), 0);
  return nc.enemyIn(z.zoneOf[at]!) > tg ? 'strong' : 'huntable';
}

/**
 * PLAN 7.39b: for a fleet whose nearest enemy fleet of its waters is beyond `SORTIE_KM` (`preyWhy`'s
 * `far`), whether its bloc holds a port from which that enemy fleet is in reach: the port's water
 * open, of the fleet's waters, within `SORTIE_KM` of the enemy fleet, its zone's enemy power no more
 * than the power of the nation's standing warfleets of those waters. `base` / `noBase`; and whether
 * that enemy fleet's zone's power is over the navy's (`strong`, the base not counted then).
 */
export function farBase(ctx: WhyCtx, f: number): 'base' | 'noBase' | 'strong' | 'notFar' {
  const w = ctx.w;
  const c = w.formations.cols;
  const ww = w.cells.w;
  const z = seaOf(w);
  const n = c.nation[f]!;
  const nc = nationCtx(ctx, n);
  const mine = keyAt(w, nc.keys, c.x[f]!, c.y[f]!);
  let best = Infinity;
  let gs = -1;
  w.formations.forEach((e) => {
    if (!w.isFleet(e) || !w.wars.atWar(n, c.nation[e]!) || fleetPower(w, e) <= 0) return;
    if (keyAt(w, nc.keys, c.x[e]!, c.y[e]!) !== mine) return;
    const d = seaKm(w, c.x[f]!, c.y[f]!, c.x[e]!, c.y[e]!);
    if (d < best) [best, gs] = [d, e];
  });
  if (gs < 0 || best <= SORTIE_KM) return 'notFar';
  const navy = nc.together.reduce((s, g) => s + (keyAt(w, nc.keys, c.x[g.id]!, c.y[g.id]!) === mine ? g.p : 0), 0);
  const ex = c.x[gs]!;
  const ey = c.y[gs]!;
  if (nc.enemyIn(z.zoneOf[Math.floor(ey) * ww + Math.floor(ex)]!) > navy) return 'strong';
  const water = portSeaOf(w);
  const ctl = w.cells.controller;
  const has = w.ports.some((p, i) => {
    const at = water[i]!;
    const holder = ctl[p.cell]!;
    if (at < 0 || holder === 0 || blocOf(w, holder) !== nc.bloc) return false;
    const zone = z.zoneOf[at]!;
    if (zone === 0 || z.closed[zone] === 1 || nc.keys[zone] !== mine || nc.enemyIn(zone) > navy) return false;
    return seaKm(w, (at % ww) + 0.5, Math.floor(at / ww) + 0.5, ex, ey) <= SORTIE_KM;
  });
  return has ? 'base' : 'noBase';
}

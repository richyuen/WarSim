/**
 * Collapse and revival from cores (SPEC §4, PLAN 1.20).
 *
 * Revival: a dead nation can return at most `revivalsLeft` times (REVIVALS at the start), and
 * never before `revivalAt` (set to death + REVIVAL_COOLDOWN; 0 for nations dead at the start).
 * It returns on provinces where it holds a core (core or claim) through a revolt (the revolt
 * area goes to the eligible dead claimant with the lowest id instead of a new rebel nation),
 * through a collapse of the holder, or by God Mode (`reviveNation`: all its core provinces).
 *
 * Collapse: a nation bankrupt for COLLAPSE_MONTHS consecutive months (counted monthly), or by
 * God Mode (`collapseNation`), fragments: its puppets go free; each province it holds with an
 * eligible dead claimant goes to that nation (one revival per claimant); held provinces with
 * unrest ≥ REVOLT_FROM revolt (one rebel nation per connected group). `NationCollapsed` event.
 *
 * God Mode Kill (the forced collapse, ADR-99): the nation ends, and nobody declares war over it.
 * Its puppets go free and its dead claimants revive as above. Then, in this order:
 *   1. A province whose core nation is alive, or else one with a living claimant (lowest id),
 *      goes to that nation.
 *   2. The rest founds at most min(KILL_STATES, cells held / KILL_CELLS_PER_STATE rounded, at
 *      least 1) nations. A connected piece of the land takes as many of them as its cities weigh
 *      (the sum of their sizes; highest averages), no more than it has provinces with a city.
 *      A piece that founds several is divided among provinces with a city, each taking the
 *      provinces nearest to it: the first is the capital's (else the largest city's), each
 *      further one a large city's far from those already chosen (`spread`). The capital's
 *      province is that of its city's cell, as the Kill began (`capitalCell`, ADR-114).
 *   3. A piece that founds none goes to the living nation with the most provinces next to it
 *      (lowest id on a tie); one with no neighbour (an island) and the cells outside any
 *      province go to the heir: the nation founded on the old capital, else the largest
 *      founded, else whoever received the most land. A cell outside those provinces that a
 *      living nation occupies is that nation's (ADR-112's rule for every death, ADR-119).
 *   4. With no heir (the nation owns the centre of no province) its land goes to the living
 *      nation with the most cells beside it (`leaveToNeighbour`, ADR-113).
 * The Kill of the only living nation is refused if it has no province to found a nation in
 * (`whyNotKill`, ADR-119).
 *
 * Capital loss without cores (AoC's death rule, deferred in ADR-28): a nation that loses its
 * capital while holding no province it has a core on dies; the capturer annexes what it held.
 */
import { isMonthStart } from '../../shared/calendar';
import { Refusal } from '../../shared/commands';
import { EventKind } from '../../shared/events';
import { nearestCellWhere } from '../data/ownership';
import { navOf, type World } from '../world';
import { releasePuppet } from './puppets';
import { defect, REVOLT_FROM, spawnRebels } from './revolts';
import { capitalCell, eliminateNation } from './capitals';

export const REVIVALS = 2;
export const REVIVAL_COOLDOWN = 24 * 730;
export const COLLAPSE_MONTHS = 6;
/** The most nations a God Mode Kill founds (ADR-99). */
export const KILL_STATES = 5;
/** A Kill founds one nation for every KILL_CELLS_PER_STATE cells the nation held (at least one). */
export const KILL_CELLS_PER_STATE = 200;

/** Whether dead nation n may revive now. */
export function canRevive(world: World, n: number): boolean {
  const nc = world.nations.cols;
  return world.nations.has(n) && nc.living[n] === 0 && nc.revivalsLeft[n]! > 0 && world.tick >= nc.revivalAt[n]!;
}

/** The eligible dead claimant of province p (lowest id), or 0. */
export function deadClaimant(world: World, p: number): number {
  let best = 0;
  for (const n of world.provinces.coresOf(p)) if (canRevive(world, n) && (best === 0 || n < best)) best = n;
  return best;
}

/** Brings dead nation n back on `area` (province ids, taken from their holders); see `spawnRebels` for `war`. */
export function reviveNation(world: World, n: number, area: number[], war = true): boolean {
  if (!canRevive(world, n) || area.length === 0) return false;
  const g = navOf(world).graph;
  // Group by holder (each holder loses its share); the revived nation is created once.
  const byHolder = new Map<number, number[]>();
  for (const p of area) {
    const c = g.centre[p] ?? -1;
    const h = c >= 0 ? world.cells.owner[c]! : 0;
    if (h === 0 || h === n) continue;
    const l = byHolder.get(h) ?? [];
    l.push(p);
    byHolder.set(h, l);
  }
  if (byHolder.size === 0) return false;
  world.nations.cols.revivalsLeft[n] = world.nations.cols.revivalsLeft[n]! - 1;
  for (const [h, ps] of [...byHolder].sort((a, b) => a[0] - b[0])) spawnRebels(world, ps, h, n, war);
  const nc = world.nations.cols; // after the rebels: see `Table.create` (PLAN 2.12)
  world.out.emit(world.tick, EventKind.NationRevived, n, nc.revivalsLeft[n]!, nc.capitalX[n]!, nc.capitalY[n]!);
  return true;
}

/** God Mode revival: all provinces where n has a core and someone else holds the land. */
export function reviveOnCores(world: World, n: number): boolean {
  return reviveNation(world, n, world.provinces.provincesOf(n));
}

/**
 * Why God Mode may not kill living nation c (PLAN 2.17c, ADR-119): it is the only one alive and
 * owns the centre of no province. Nothing would be founded and nobody revived, its land would go
 * to nobody (`leaveToNeighbour`), and a dead nation holds none (ADR-112). With a province of its
 * own the last nation can be killed: its land founds the nations that follow it.
 */
export function whyNotKill(world: World, c: number): Refusal {
  const nc = world.nations.cols;
  let others = false;
  world.nations.forEach((n) => {
    if (n !== c && nc.living[n] === 1) others = true;
  });
  if (others) return Refusal.None;
  const centre = navOf(world).graph.centre;
  for (let p = 1; p < world.provinces.count; p++) {
    const cell = centre[p] ?? -1;
    if (cell >= 0 && world.cells.owner[cell] === c) return Refusal.None;
  }
  return Refusal.LastNation;
}

/**
 * Fragments nation c (see the module comment). `forced` (God Mode Kill, PLAN 1.32): every
 * province it holds goes, calm or not, and c dies (`killNation`).
 */
export function collapseNation(world: World, c: number, forced = false): void {
  // Taken anew after every revival and every founding below: a new nation's row may move the
  // table to new arrays (PLAN 2.12).
  let nc = world.nations.cols;
  if (!world.nations.has(c) || nc.living[c] !== 1) return;
  // A collapse is a default: debts are void afterwards (PLAN 1.24 review: without it a broke
  // nation re-collapsed every COLLAPSE_MONTHS forever).
  nc.gold[c] = Math.max(0, nc.gold[c]!);
  nc.bankrupt[c] = 0;
  nc.brokeMonths[c] = 0;
  const pv = world.provinces;
  const g = navOf(world).graph;
  const held: number[] = [];
  for (let p = 1; p < pv.count; p++) {
    const cell = g.centre[p] ?? -1;
    if (cell >= 0 && world.cells.owner[cell] === c) held.push(p);
  }
  // Nothing to fragment (no puppets, dead claimants or restless provinces): the default alone.
  let puppets = false;
  world.nations.forEach((p) => {
    if (nc.overlord[p] === c && nc.living[p] === 1) puppets = true;
  });
  if (!forced && !puppets && !held.some((p) => deadClaimant(world, p) !== 0 || pv.unrest[p]! >= REVOLT_FROM)) return;
  world.out.emit(world.tick, EventKind.NationCollapsed, c, 0, NaN, NaN);
  world.nations.forEach((p) => {
    if (nc.overlord[p] === c && nc.living[p] === 1) releasePuppet(world, p);
  });
  // The capital's province, for the Kill: read before the revivals, one of which may take the
  // capital and so move it (PLAN 2.16Rh).
  const capitalProvince = world.cells.province[capitalCell(world, c)] ?? 0;
  // 1. Dead claimants revive on their provinces.
  const byClaimant = new Map<number, number[]>();
  for (const p of held) {
    const d = deadClaimant(world, p);
    if (d === 0) continue;
    const l = byClaimant.get(d) ?? [];
    l.push(p);
    byClaimant.set(d, l);
  }
  const taken = new Set<number>();
  for (const [d, ps] of [...byClaimant].sort((a, b) => a[0] - b[0])) {
    if (!forced && nc.living[c] !== 1) break;
    if (reviveNation(world, d, ps, !forced)) for (const p of ps) taken.add(p);
    nc = world.nations.cols;
  }
  if (forced) {
    killNation(world, c, held.filter((p) => !taken.has(p)), capitalProvince);
    return;
  }
  // 2. Restless provinces revolt, one rebel nation per connected group.
  const restless = new Set(held.filter((p) => !taken.has(p) && pv.unrest[p]! >= REVOLT_FROM));
  for (const start of [...restless].sort((a, b) => a - b)) {
    if (!restless.has(start) || nc.living[c] !== 1) continue;
    const group = [start];
    restless.delete(start);
    for (let i = 0; i < group.length; i++) {
      for (const q of g.adj[group[i]!] ?? []) {
        if (!restless.has(q)) continue;
        restless.delete(q);
        group.push(q);
      }
    }
    spawnRebels(world, group, c);
    nc = world.nations.cols;
  }
}

interface Piece {
  provinces: number[];
  cells: number;
  /** The sum of its cities' sizes. */
  weight: number;
  /** Where its nations can be founded: its provinces with a city, the largest city first. */
  seeds: number[];
  states: number;
}

/**
 * The end of a God Mode Kill (module comment): `rest` is what c still holds, ascending;
 * `capitalProvince` is the province of its capital's cell as the Kill began.
 */
function killNation(world: World, c: number, rest: number[], capitalProvince: number): void {
  const pv = world.provinces;
  const g = navOf(world).graph;
  const { owner, controller, province } = world.cells;
  const living = (n: number): boolean => n !== 0 && n !== c && world.nations.has(n) && world.nations.cols.living[n] === 1;
  const cellsIn = new Map<number, number>();
  let held = 0;
  for (let cell = 0; cell < owner.length; cell++) {
    if (owner[cell] !== c) continue;
    held++;
    cellsIn.set(province[cell]!, (cellsIn.get(province[cell]!) ?? 0) + 1);
  }
  const cellsOf = (ps: number[]): number => ps.reduce((a, p) => a + (cellsIn.get(p) ?? 0), 0);
  const received = new Map<number, number>();
  const give = (area: number[], to: number): void => {
    defect(world, area, c, to);
    received.set(to, (received.get(to) ?? 0) + cellsOf(area));
  };
  // 1. Back to a living core nation, or else to a living claimant.
  const back = new Map<number, number[]>();
  const left = new Set<number>();
  for (const p of rest) {
    const core = pv.core[p]!;
    const to = living(core) ? core : (pv.coresOf(p).filter(living).sort((a, b) => a - b)[0] ?? 0);
    if (to === 0) left.add(p);
    else back.set(to, [...(back.get(to) ?? []), p]);
  }
  for (const [to, ps] of [...back].sort((a, b) => a[0] - b[0])) give(ps, to);
  // 2. The connected pieces of the rest, and the weight of each one's cities.
  const cc = world.cities.cols;
  const cityOf = new Map<number, number>(); // province → its largest city
  const weightOf = new Map<number, number>();
  world.cities.forEach((ci) => {
    const p = province[cc.cell[ci]!]!;
    if (owner[cc.cell[ci]!] !== c || !left.has(p)) return;
    weightOf.set(p, (weightOf.get(p) ?? 0) + cc.size[ci]!);
    const best = cityOf.get(p) ?? 0;
    if (best === 0 || cc.size[ci]! > cc.size[best]!) cityOf.set(p, ci);
  });
  const pieces: Piece[] = [];
  for (const start of rest) {
    if (!left.has(start)) continue;
    const ps = [start];
    left.delete(start);
    for (let i = 0; i < ps.length; i++) {
      for (const q of g.adj[ps[i]!] ?? []) {
        if (!left.has(q)) continue;
        left.delete(q);
        ps.push(q);
      }
    }
    const seeds = ps.filter((p) => cityOf.has(p)).sort((a, b) => cc.size[cityOf.get(b)!]! - cc.size[cityOf.get(a)!]! || a - b);
    pieces.push({ provinces: ps, cells: cellsOf(ps), weight: ps.reduce((a, p) => a + (weightOf.get(p) ?? 0), 0), seeds, states: 0 });
  }
  // Highest averages (D'Hondt) over the cities' weight.
  const states = Math.max(1, Math.min(KILL_STATES, Math.round(held / KILL_CELLS_PER_STATE)));
  for (let k = 0; k < states; k++) {
    let best: Piece | null = null;
    for (const pc of pieces) {
      if (pc.states >= pc.seeds.length) continue;
      if (best === null || pc.weight / (pc.states + 1) > best.weight / (best.states + 1)) best = pc;
    }
    if (best === null) break;
    best.states++;
  }
  // No city anywhere and nobody the land could go to: the largest piece founds the one nation.
  if (pieces.length > 0 && received.size === 0 && pieces.every((pc) => pc.states === 0 && neighbourOf(world, pc.provinces, c) === 0)) {
    const largest = pieces.reduce((a, b) => (b.cells > a.cells ? b : a));
    largest.seeds = [largest.provinces.reduce((a, p) => ((cellsIn.get(p) ?? 0) > (cellsIn.get(a) ?? 0) ? p : a))];
    largest.states = 1;
  }
  let heir = 0;
  let largest = 0;
  for (const pc of pieces) {
    if (pc.states === 0) continue;
    // Each of the piece's nations takes the provinces nearest to its seed: breadth-first, the
    // seeds in turn, a layer at a time.
    const areas = spread(g.adj, pc, pc.states, (p) => cc.size[cityOf.get(p)!]!, capitalProvince).map((p) => [p]);
    const free = new Set(pc.provinces);
    for (const area of areas) free.delete(area[0]!);
    const at = areas.map(() => 0);
    for (let grew = true; grew && free.size > 0; ) {
      grew = false;
      for (let k = 0; k < areas.length; k++) {
        const area = areas[k]!;
        const end = area.length;
        for (let i = at[k]!; i < end; i++) {
          for (const q of g.adj[area[i]!] ?? []) {
            if (!free.has(q)) continue;
            free.delete(q);
            area.push(q);
            grew = true;
          }
        }
        at[k] = end;
      }
    }
    for (const area of areas) {
      const r = spawnRebels(world, area, c, 0, false);
      const cells = world.nations.cols.cells[r]!;
      received.set(r, cells);
      if (area.includes(capitalProvince)) heir = r;
      if (largest === 0 || cells > received.get(largest)!) largest = r;
    }
  }
  if (heir === 0) heir = largest;
  // 3. The pieces that found nothing: to the neighbour, else to the heir.
  const islands: number[] = [];
  for (const pc of pieces) {
    if (pc.states > 0) continue;
    const neighbour = neighbourOf(world, pc.provinces, c);
    if (neighbour !== 0) give(pc.provinces, neighbour);
    else islands.push(...pc.provinces);
  }
  if (heir === 0) for (const [n, cells] of [...received].sort((a, b) => a[0] - b[0])) if (heir === 0 || cells > received.get(heir)!) heir = n;
  if (heir !== 0 && islands.length > 0) give(islands, heir);
  // Cells outside any province (slivers) that c still holds go to the heir; then c is gone. One
  // that another nation occupies is left for `eliminateNation`, which gives it to the occupier
  // (ADR-112): given to the heir, it stayed occupied with no war behind it (ADR-119).
  for (let cell = 0; cell < owner.length; cell++) {
    if (heir === 0 || owner[cell] !== c || living(controller[cell]!)) continue;
    world.setOwner(cell, heir);
    if (controller[cell] === c) world.setController(cell, heir);
  }
  if (heir === 0) leaveToNeighbour(world, c);
  eliminateNation(world, c);
}

/**
 * A Kill that found no heir (PLAN 2.16Rg, ADR-113): c owns the centre of no province (a city
 * inside another's province, a nation of a world without provinces), so nothing was founded and
 * nobody received anything. The cells c owns and controls go to the living nation that owns the
 * most cells beside them (lowest id on a tie), else to the one whose land is nearest their
 * middle: one `LandCeded`. What others occupy of c is theirs by `eliminateNation`. With no
 * other nation alive nothing moves.
 */
function leaveToNeighbour(world: World, c: number): void {
  const { owner, controller, w } = world.cells;
  const h = owner.length / w;
  const nc = world.nations.cols;
  const living = (n: number): boolean => n !== 0 && n !== c && world.nations.has(n) && nc.living[n] === 1;
  const wrap = world.settings.loopingMap;
  const beside = new Map<number, number>();
  const mine: number[] = [];
  let sx = 0;
  let sy = 0;
  for (let cell = 0; cell < owner.length; cell++) {
    if (owner[cell] !== c || controller[cell] !== c) continue;
    mine.push(cell);
    const x = cell % w;
    sx += x + 0.5;
    sy += Math.floor(cell / w) + 0.5;
    const west = x > 0 ? cell - 1 : wrap ? cell + w - 1 : -1;
    const east = x < w - 1 ? cell + 1 : wrap ? cell - w + 1 : -1;
    for (const q of [cell - w, west, east, cell + w]) {
      if (q < 0 || q >= owner.length || !living(owner[q]!)) continue;
      beside.set(owner[q]!, (beside.get(owner[q]!) ?? 0) + 1);
    }
  }
  if (mine.length === 0) return;
  sx /= mine.length;
  sy /= mine.length;
  let to = 0;
  for (const [n, k] of [...beside].sort((a, b) => a[0] - b[0])) if (to === 0 || k > beside.get(to)!) to = n;
  if (to === 0) {
    const near = nearestCellWhere((q) => living(owner[q]!), sx, sy, w, h, Math.max(w, h));
    if (near < 0) return;
    to = owner[near]!;
  }
  for (const cell of mine) {
    world.setOwner(cell, to);
    world.setController(cell, to);
  }
  world.out.emit(world.tick, EventKind.LandCeded, to, c, sx, sy);
}

/**
 * `n` of the piece's seeds: `first` if it is one of them, else the first; then each time the one
 * with the highest product of its city's `size` and its distance (in provinces crossed) from
 * the seeds taken (the earlier seed on a tie).
 */
function spread(adj: readonly (readonly number[])[], pc: Piece, n: number, size: (p: number) => number, first: number): number[] {
  const inPiece = new Set(pc.provinces);
  const dist = new Map<number, number>();
  const taken: number[] = [];
  for (let next = pc.seeds.includes(first) ? first : pc.seeds[0]; next !== undefined && taken.length < n; ) {
    taken.push(next);
    dist.set(next, 0);
    const queue = [next];
    for (let i = 0; i < queue.length; i++) {
      const d = dist.get(queue[i]!)! + 1;
      for (const q of adj[queue[i]!] ?? []) {
        if (!inPiece.has(q) || (dist.get(q) ?? Infinity) <= d) continue;
        dist.set(q, d);
        queue.push(q);
      }
    }
    next = undefined;
    for (const p of pc.seeds) {
      if (dist.get(p) === 0) continue;
      if (next === undefined || size(p) * dist.get(p)! > size(next) * dist.get(next)!) next = p;
    }
  }
  return taken;
}

/** The living nation other than c that holds the most provinces next to `area` (lowest id on a tie), or 0. */
function neighbourOf(world: World, area: number[], c: number): number {
  const g = navOf(world).graph;
  const nc = world.nations.cols;
  const count = new Map<number, number>();
  for (const p of area) {
    for (const q of g.adj[p] ?? []) {
      const cell = g.centre[q] ?? -1;
      const n = cell >= 0 ? world.cells.owner[cell]! : 0;
      if (n !== 0 && n !== c && nc.living[n] === 1) count.set(n, (count.get(n) ?? 0) + 1);
    }
  }
  let best = 0;
  for (const [n, k] of [...count].sort((a, b) => a[0] - b[0])) if (best === 0 || k > count.get(best)!) best = n;
  return best;
}

/** Monthly: bankruptcy streaks and collapse. */
export function collapseSystem(world: World): void {
  if (world.provinces.count === 0 || !isMonthStart(world.startDay, world.tick)) return;
  world.nations.forEach((n) => {
    const nc = world.nations.cols; // anew for each nation: a collapse founds nations (PLAN 2.12)
    if (nc.living[n] !== 1) return;
    nc.brokeMonths[n] = nc.bankrupt[n] === 1 ? nc.brokeMonths[n]! + 1 : 0;
    if (nc.brokeMonths[n]! >= COLLAPSE_MONTHS) {
      nc.brokeMonths[n] = 0;
      collapseNation(world, n);
    }
  });
}

/** Whether nation n holds (owns and controls the centre of) a province it has a core on. */
export function holdsCore(world: World, n: number): boolean {
  const g = navOf(world).graph;
  const pv = world.provinces;
  if (pv.count === 0) return true; // no core model (toy): never applies the death rule
  for (const p of pv.provincesOf(n)) {
    const c = g.centre[p] ?? -1;
    if (c >= 0 && world.cells.owner[c] === n && world.cells.controller[c] === n) return true;
  }
  return false;
}

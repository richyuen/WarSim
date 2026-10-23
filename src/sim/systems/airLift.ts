/**
 * The transports' missions (SPEC §6.3).
 *
 * Air supply (PLAN 5.8u1): a transport wing's sortie on a `supply` mission, at its target in the
 * hour it arrives, lifts `AIR_LIFT` of a formation's supply an aircraft to the formations of its
 * side on the land within `AA_CELLS` of the target that are short of it, the same share each (no
 * more than each lacks), by ascending id. A formation cut off is fed so between the hours its
 * network cannot.
 *
 * The paradrop (PLAN 5.8u2, `orderParadrop`): a formation of infantry alone (every element of
 * class `inf`), not in contact, standing within `BASE_PICK_CELLS` of an airbase its nation holds,
 * is flown by its nation's transport wings based there and on the ground (no sortie), the
 * fewest by ascending id whose `PARA_MEN` a plane lift its men, to a land cell within their
 * range held by its side, an enemy or no one. It stands there at once (the flight is the wings'
 * sortie, out and home, flown and fought as any), its org at most `PARA_ORG`; an enemy's cell it
 * lands on is taken as a landing's beachhead is (PLAN 4.5b). The wings' missions end.
 */
import { EventKind, RejectReason } from '../../shared/events';
import { isLand } from '../../shared/terrain';
import { FlipCause, type World } from '../world';
import { BASE_PICK_CELLS, isTransport, wingRange } from './air';
import { AA_CELLS } from './airCombat';
import { elementIndex, wrapDx } from './elements';
import { seaKm } from './navalCombat';
import { legHours } from './sorties';

/** A formation's supply an aircraft of a transport wing lifts (a group of 24: a half). */
export const AIR_LIFT = 1 / 48;

export function airLift(world: World): void {
  const aaCells = world.atSizeWhole(AA_CELLS);
  if (world.sorties.size === 0) return;
  const fc = world.formations.cols;
  const ec = world.elements.cols;
  const h = world.cells.h;
  for (const [id, s] of [...world.sorties].sort((a, b) => a[0] - b[0])) {
    const m = world.wingMission.get(id);
    if (!m || m.kind !== 'supply' || s.tx !== m.x || s.ty !== m.y || !world.formations.has(id)) continue;
    const arrive = s.launch + legHours(s);
    if (!(arrive > world.tick - 1 && arrive <= world.tick)) continue;
    const nation = fc.nation[id]!;
    const tx = Math.floor(s.tx);
    const ty = Math.floor(s.ty);
    const short: number[] = [];
    world.formations.forEach((g) => {
      if (world.offLand(g) || fc.supply[g]! >= 1) return;
      if (fc.nation[g] !== nation && !world.wars.sameSide(nation, fc.nation[g]!)) return;
      if (Math.abs(wrapDx(world, tx, Math.floor(fc.x[g]!))) > aaCells || Math.abs(Math.min(h - 1, Math.floor(fc.y[g]!)) - ty) > aaCells) return;
      short.push(g);
    });
    if (short.length === 0) continue;
    let aircraft = 0;
    for (const e of elementIndex(world).get(id) ?? []) aircraft += ec.strength[e]!;
    const each = (aircraft * AIR_LIFT) / short.length;
    for (const g of short.sort((a, b) => a - b)) fc.supply[g] = Math.min(1, fc.supply[g]! + each);
  }
}

/** The men an aircraft of a transport wing drops (a wing's aircraft each stand for about three of the record's: a group of 24 lifts 1,536). */
export const PARA_MEN = 64;
/** A formation's org on landing from the air, at most (a landing's from the sea, PLAN 4.5b). */
export const PARA_ORG = 0.5;

/** The wings that would drop formation `id` at (x, y), and the airbase they fly from; or why not (no event). */
function paradropPlan(world: World, id: number, x: number, y: number): { wings: number[]; base: number; cell: number } | RejectReason {
  const f = world.formations;
  const c = f.cols;
  const rules = world.rules;
  if (!f.has(id) || !rules) return RejectReason.NotLand;
  if (world.embarked.has(id)) return RejectReason.Aboard;
  const t = rules.templates[c.template[id]!];
  if (world.offLand(id) || !t || t.elements.some((e) => rules.units[e.unit]!.cls !== 'inf')) return RejectReason.NotLand;
  const { w, h, terrain, controller } = world.cells;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || tx >= w || ty < 0 || ty >= h || !isLand(terrain[ty * w + tx]!)) return RejectReason.NoLanding;
  const cell = ty * w + tx;
  const nation = c.nation[id]!;
  const held = controller[cell]!;
  if (held !== 0 && held !== nation && !world.wars.sameSide(nation, held) && !world.wars.atWar(nation, held)) return RejectReason.NoRoute;
  // The airbase it stands at.
  const base = world.airbases.findIndex((b) => {
    const [bx, by] = world.cellPoint(b.cell);
    return controller[b.cell] === nation && Math.abs(wrapDx(world, c.x[id]!, bx)) <= world.atSize(BASE_PICK_CELLS) && Math.abs(c.y[id]! - by) <= world.atSize(BASE_PICK_CELLS);
  });
  if (base < 0 || c.engaged[id] === 1) return RejectReason.NoAirlift;
  const [bx, by] = world.cellPoint(world.airbases[base]!.cell);
  const [px, py] = world.cellPoint(cell);
  const km = seaKm(world, bx, by, px, py);
  const ec = world.elements.cols;
  const men = c.strength[id]!;
  const wings: number[] = [];
  let lift = 0;
  let far = false;
  for (const [g, b] of [...world.wingBase].sort((p, q) => p[0] - q[0])) {
    if (lift >= men) break;
    if (b !== base + 1 || c.nation[g] !== nation || world.sorties.has(g) || !isTransport(world, g)) continue;
    if (km > wingRange(world, g)) {
      far = true;
      continue;
    }
    wings.push(g);
    for (const e of elementIndex(world).get(g) ?? []) lift += ec.strength[e]! * PARA_MEN;
  }
  if (lift < men) return far ? RejectReason.OutOfRange : RejectReason.NoAirlift;
  return { wings, base, cell };
}

/** Whether formation `id` can be dropped at (x, y) now (`orderParadrop`'s checks; no event): 0, or why not. */
export function canParadrop(world: World, id: number, x: number, y: number): 0 | RejectReason {
  const plan = paradropPlan(world, id, x, y);
  return typeof plan === 'number' ? plan : 0;
}

/** Orders formation `id` dropped at (x, y) (see the head of the file); 0 when done, else why not (`MoveRejected`). */
export function orderParadrop(world: World, id: number, x: number, y: number): 0 | RejectReason {
  const c = world.formations.cols;
  const plan = paradropPlan(world, id, x, y);
  if (typeof plan === 'number') {
    world.out.emit(world.tick, EventKind.MoveRejected, id, world.formations.has(id) ? c.nation[id]! : 0, plan, NaN);
    return plan;
  }
  const { wings, base, cell } = plan;
  const nation = c.nation[id]!;
  const held = world.cells.controller[cell]!;
  const [bx, by] = world.cellPoint(world.airbases[base]!.cell);
  const [px, py] = world.cellPoint(cell);
  const km = seaKm(world, bx, by, px, py);
  for (const g of wings) {
    world.wingMission.delete(g);
    const kmh = world.rules!.templates[c.template[g]!]!.speedKmh;
    world.sorties.set(g, { bx, by, tx: px, ty: py, launch: world.tick, kmh, km, over: 0 });
  }
  c.moving[id] = 0;
  c.home[id] = 0;
  world.paths.delete(id);
  [c.x[id], c.y[id]] = [px, py];
  c.org[id] = Math.min(c.org[id]!, PARA_ORG);
  // An airhead, as a beachhead (PLAN 4.5b): an enemy's cell is its nation's, or its owner's where that is a living nation not at war with it.
  if (held !== 0 && world.wars.atWar(held, nation)) {
    const o = world.cells.owner[cell]!;
    const freed = o !== 0 && o !== nation && world.nations.cols.living[o] === 1 && !world.wars.atWar(nation, o);
    world.setController(cell, freed ? o : nation, false, FlipCause.landing);
  }
  world.out.emit(world.tick, EventKind.FormationLanded, id, nation, px, py);
  return 0;
}

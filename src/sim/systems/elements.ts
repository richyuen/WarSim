/**
 * Elements: the authoritative unit proxies of land formations (SPEC §3.6, PLAN 1.13).
 *
 * A formation built from a scenario template gets one element per template unit (e.g. 18
 * infantry elements of 500 men, 3 artillery elements of 12 guns). Losses land on elements; the
 * formation's `strength` (men) is their sum, so the strategic number always equals what the
 * tactical view shows. Formations without elements (toy scenario, tests) keep a bare strength.
 */
import { EventKind } from '../../shared/events';
import { atan2, cos, sin, sqrt } from '../core/dmath';
import { SLOT_SPACING, slotGrid, slotPose } from '../core/pose';
import type { World } from '../world';

/**
 * Where element `slot` of a formation at (`fx`, `fy`) stands: its slot in the block (`slotPose`);
 * or, where the fine mask has that on water, the first land on the way from the slot to the
 * formation's place (PLAN 2.9a, ADR-79). A block is 0.24 by 0.12 cells, and a spit can be
 * narrower: the formation stands on land, and what of its block would stand in the sea draws
 * in towards it.
 *
 * Not state: an element's place is worked out from its formation's. The snapshot, the fire
 * events and the event of an element's end all ask here, so they have one place for it.
 * Where the formation's own place is on the mask's water (on the march across a bay, on a
 * crossing, on land painted in the editor) the slot is left as it is.
 */
export function slotPlace(world: World, fx: number, fy: number, facing: number, slot: number, count: number): [number, number] {
  const p = slotPose(fx, fy, facing, slot, count, SLOT_SPACING);
  if (!world.landMask || world.onLand(p[0], p[1]) || !world.onLand(fx, fy)) return p;
  // In eighths of the way: the block's far corner is 0.134 cells out, a mask pixel is 0.125 wide.
  for (let k = 1; k < 8; k++) {
    const x = p[0] + ((fx - p[0]) * k) / 8;
    const y = p[1] + ((fy - p[1]) * k) / 8;
    if (world.onLand(x, y)) return [x, y];
  }
  return [fx, fy];
}

/** Enemy formations within this many cells of each other are in contact (`findBattles`). */
export const CONTACT_CELLS = 1.5;
/** Between the front rows of two formations deployed against each other, cells (a kilometre). */
export const DEPLOY_GAP = 0.05;

/** Where the block of a formation in contact stands, and what it faces (`deployOf`). */
export interface Deployment {
  x: number;
  y: number;
  facing: number;
}

/** East-west distance from a to b on the map's own side of the seam. */
function wrapDx(world: World, ax: number, bx: number): number {
  const w = world.cells.w;
  let dx = bx - ax;
  if (dx > w / 2) dx -= w;
  else if (dx < -w / 2) dx += w;
  return dx;
}

/** Distance in cells between two points, wrapping east-west: the one measure of contact (`CONTACT_CELLS`). */
export function cellDist(world: World, ax: number, ay: number, bx: number, by: number): number {
  const w = world.cells.w;
  let dx = Math.abs(ax - bx);
  if (dx > w / 2) dx = w - dx;
  const dy = ay - by;
  return sqrt(dx * dx + dy * dy);
}

/**
 * For each formation in contact, the nearest enemy formation it is in contact with (the lower
 * id on a tie). Derived: `findBattles` sets it as it pairs them each hour; where it is not set
 * (a loaded game before its first hour) it is worked out here from the same state, the
 * formations' `engaged` flags and places, and comes out the same.
 */
export function contactsOf(world: World): Map<number, number> {
  if (world.contacts) return world.contacts;
  const c = world.formations.cols;
  const engaged: number[] = [];
  world.formations.forEach((id) => {
    if (c.engaged[id] === 1) engaged.push(id);
  });
  const near = new Map<number, [number, number]>();
  const note = (a: number, b: number, d: number): void => {
    const n = near.get(a);
    if (!n || d < n[1] || (d === n[1] && b < n[0])) near.set(a, [b, d]);
  };
  for (let i = 0; i < engaged.length; i++) {
    const a = engaged[i]!;
    for (let j = i + 1; j < engaged.length; j++) {
      const b = engaged[j]!;
      if (!world.wars.atWar(c.nation[a]!, c.nation[b]!)) continue;
      const d = cellDist(world, c.x[a]!, c.y[a]!, c.x[b]!, c.y[b]!);
      if (d > CONTACT_CELLS) continue;
      note(a, b, d);
      note(b, a, d);
    }
  }
  world.contacts = new Map([...near].map(([f, [enemy]]) => [f, enemy]));
  return world.contacts;
}

/**
 * Where the block of formation `f` (of `count` slots) is deployed, or null when it is not in
 * contact (PLAN 2.14c1). A formation holds its place while it fights, and two that fight stand
 * a cell or more apart (up to `CONTACT_CELLS`: 29 km): a close view showed one side and its
 * shots leaving the screen. So the elements of a formation in contact go forward to meet the
 * enemy: the block stands on the line to the nearest enemy it is in contact with, its front
 * row half of `DEPLOY_GAP` short of the middle between the two, and faces that enemy. Two that
 * are each other's nearest stand front to front, a kilometre apart. One whose nearest enemy is
 * deployed against a nearer formation comes up to that enemy's block from its own side (see
 * below): after 60 days of Germany against Poland 72% of the formations in contact were in
 * pairs of each other's nearest, and the rest had no enemy near their block without it.
 *
 * Not state, as an element's place is not (`slotPlace`): worked out from the formations'
 * places and `engaged` flags. The formation itself, its marker and its part in the rules stay
 * where the sim has it. A block does not go into the sea: on the fine mask's water it stands
 * as far forward as there is land (across a strait the two sides stay on their shores).
 */
export function deployOf(world: World, f: number, count: number, chain = 0): Deployment | null {
  const c = world.formations.cols;
  if (c.engaged[f] !== 1) return null;
  const cache = (world.deployed ??= new Map<number, Deployment | null>());
  const held = cache.get(f);
  if (held !== undefined) return held;
  const contacts = contactsOf(world);
  const enemy = contacts.get(f);
  let out: Deployment | null = null;
  if (enemy !== undefined && world.formations.has(enemy)) {
    const fx = c.x[f]!;
    const fy = c.y[f]!;
    const depth = slotGrid(count).rows * SLOT_SPACING;
    // What it goes towards, and how far short of it its block's middle stops.
    let tx = c.x[enemy]!;
    let ty = c.y[enemy]!;
    let short = -1;
    if (contacts.get(enemy) !== f) {
      // Its nearest enemy has a nearer one of its own and is deployed against that. This one
      // comes up to where that enemy's block stands, as near as a formation it faced would
      // stand; the next such formation (by distance from that enemy, then id) a line further
      // back, and so on.
      const others: [number, number][] = [];
      for (const [g, e] of contacts) {
        if (e !== enemy || contacts.get(enemy) === g || !world.formations.has(g)) continue;
        const gx = wrapDx(world, c.x[enemy]!, c.x[g]!);
        const gy = c.y[g]! - c.y[enemy]!;
        others.push([g, sqrt(gx * gx + gy * gy)]);
      }
      others.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
      let line = Math.max(0, others.findIndex((o) => o[0] === f));
      const enemySlots = slotCount(world, enemy, elementIndex(world).get(enemy)?.length ?? 0);
      const theirs = chain < 4 ? deployOf(world, enemy, enemySlots, chain + 1) : null;
      if (theirs) {
        tx = theirs.x;
        ty = theirs.y;
        // From much the same side as the one that enemy faces (within 60°): a line further
        // back, behind it. From another side it stands as near as that one does.
        const ax = wrapDx(world, tx, fx);
        const ay = fy - ty;
        const al = sqrt(ax * ax + ay * ay);
        if (al > 1e-9 && (ax * cos(theirs.facing) + ay * sin(theirs.facing)) / al > 0.5) line++;
      }
      short = (slotGrid(enemySlots).rows * SLOT_SPACING) / 2 + DEPLOY_GAP + depth / 2 + line * (depth + DEPLOY_GAP);
    }
    const dx = wrapDx(world, fx, tx);
    const dy = ty - fy;
    const d = sqrt(dx * dx + dy * dy);
    if (d > 1e-9) {
      // Each other's nearest: to the middle between the two, less half the gap and half its depth.
      const shift = Math.max(0, short < 0 ? d / 2 - DEPLOY_GAP / 2 - depth / 2 : d - short);
      const ux = dx / d;
      const uy = dy / d;
      out = { x: fx, y: fy, facing: atan2(dy, dx) };
      // As far forward as the block's middle has land under it, in eighths of the way.
      for (let k = 8; k >= 1; k--) {
        const x = fx + (ux * shift * k) / 8;
        const y = fy + (uy * shift * k) / 8;
        if (!world.landMask || world.onLand(x, y)) {
          out = { x, y, facing: out.facing };
          break;
        }
      }
    }
  }
  cache.set(f, out);
  return out;
}

/**
 * Where element `slot` of formation `f` stands: in its block at the formation's place, or, for
 * a formation in contact, in its block deployed against the enemy (`deployOf`), on land either
 * way (`slotPlace`). The one place of an element for the snapshot, the fire events and the
 * event of its end.
 */
export function elementPlace(world: World, f: number, slot: number, count: number): [number, number] {
  const c = world.formations.cols;
  const d = deployOf(world, f, count);
  return d ? slotPlace(world, d.x, d.y, d.facing, slot, count) : slotPlace(world, c.x[f]!, c.y[f]!, c.facing[f]!, slot, count);
}

/**
 * Where element `slot` of formation `f` stood in the hour before this one's contacts were
 * found: where its sprite was last shown. For the event of its end, which comes in the hour
 * the blocks may be deployed anew (a nearer enemy, a first contact): the wreck lies where the
 * element stood, not where its block is going. Where the hour before is not known (a loaded
 * game's first hour, after a command) it is the place of now.
 */
export function elementPlaceBefore(world: World, f: number, slot: number, count: number): [number, number] {
  const before = world.deployedBefore;
  if (!before) return elementPlace(world, f, slot, count);
  const c = world.formations.cols;
  const d = before.get(f);
  return d ? slotPlace(world, d.x, d.y, d.facing, slot, count) : slotPlace(world, c.x[f]!, c.y[f]!, c.facing[f]!, slot, count);
}

/**
 * The hour's deployments, all of them, as `findBattles` has paired the formations (PLAN
 * 2.14c1): worked out for every formation in contact at once, so that what the hour before
 * left (`deployedBefore`) does not depend on who asked for which.
 */
export function deployAll(world: World, contacts: Map<number, number>): void {
  world.deployedBefore = world.deployed;
  world.contacts = contacts;
  world.deployed = new Map();
  const idx = elementIndex(world);
  for (const f of [...contacts.keys()].sort((a, b) => a - b)) deployOf(world, f, slotCount(world, f, idx.get(f)?.length ?? 0));
}

/** Live element ids per formation, ascending (derived; rebuilt after creates/removes or a load). */
export function elementIndex(world: World): Map<number, number[]> {
  if (world.elementIndex) return world.elementIndex;
  const idx = new Map<number, number[]>();
  const e = world.elements;
  e.forEach((id) => {
    const f = e.cols.formation[id]!;
    let list = idx.get(f);
    if (!list) idx.set(f, (list = []));
    list.push(id);
  });
  world.elementIndex = idx;
  return idx;
}

/** Creates the elements of formation `fid` from its template; sets its strength. */
export function equipFormation(world: World, fid: number, template: number): void {
  const rule = world.rules?.templates[template];
  if (!rule) return;
  const e = world.elements;
  e.reserve(rule.elements.reduce((s, x) => s + x.count, 0));
  let slot = 0;
  for (const { unit, count } of rule.elements) {
    const size = world.rules!.units[unit]!.size;
    for (let k = 0; k < count; k++) {
      const id = e.create();
      e.cols.formation[id] = fid;
      e.cols.slot[id] = slot++;
      e.cols.unit[id] = unit;
      e.cols.strength[id] = size;
    }
  }
  world.elementIndex = null;
  recomputeStrength(world, fid);
}

/**
 * Slots of formation `fid`'s block: the elements its template gave it. Slots are numbered when
 * the formation is equipped and never reassigned, so an element keeps its place when others die
 * and the block shows the gaps (SPEC §3.6, PLAN 2.7a). `fallback` for a formation whose template
 * the scenario does not have.
 */
export function slotCount(world: World, fid: number, fallback: number): number {
  const rule = world.rules?.templates[world.formations.cols.template[fid]!];
  if (!rule) return fallback;
  let n = 0;
  for (const e of rule.elements) n += e.count;
  return Math.max(n, fallback);
}

/** Formation strength in men from its elements (no-op for element-less formations). */
export function recomputeStrength(world: World, fid: number): void {
  const list = elementIndex(world).get(fid);
  if (!list) return;
  const units = world.rules!.units;
  const ec = world.elements.cols;
  let men = 0;
  for (const id of list) men += ec.strength[id]! * units[ec.unit[id]!]!.menPerUnit;
  world.formations.cols.strength[fid] = Math.round(men);
}

/** Removes `units` (fractional) from an element, carrying the remainder; returns units lost. */
export function applyLoss(world: World, id: number, units: number): number {
  const ec = world.elements.cols;
  const w = ec.wound[id]! + units;
  const whole = Math.min(Math.floor(w), ec.strength[id]!);
  ec.strength[id] = ec.strength[id]! - whole;
  ec.wound[id] = ec.strength[id] === 0 ? 0 : w - Math.floor(w);
  return whole;
}

/**
 * Removes the share `fraction` of a formation's strength: from every element (with carried
 * fractions) when it has elements, else from its bare strength. Used by attrition and desertion,
 * so strength stays the sum of the elements.
 */
export function bleedFormation(world: World, fid: number, fraction: number): void {
  const els = elementIndex(world).get(fid);
  if (!els) {
    const c = world.formations.cols;
    const before = c.strength[fid]!;
    c.strength[fid] = Math.floor(before * (1 - fraction));
    const n = c.nation[fid]!;
    if (world.nations.has(n)) world.nations.cols.casualties[n] = world.nations.cols.casualties[n]! + (before - c.strength[fid]!);
    return;
  }
  for (const e of els) applyLoss(world, e, world.elements.cols.strength[e]! * fraction);
  settleFormation(world, fid);
}

/** Removes dead elements of `fid`, recomputes strength; destroys the formation if none remain. */
export function settleFormation(world: World, fid: number): void {
  const list = elementIndex(world).get(fid);
  if (!list) return;
  const fc = world.formations.cols;
  const nation = fc.nation[fid]!;
  const before = fc.strength[fid]!;
  settleElements(world, fid, list);
  // Men lost since the last settle count as casualties (PLAN 1.34b statistics).
  const after = world.formations.has(fid) ? fc.strength[fid]! : 0;
  if (before > after && world.nations.has(nation)) world.nations.cols.casualties[nation] = world.nations.cols.casualties[nation]! + (before - after);
}

function settleElements(world: World, fid: number, list: number[]): void {
  const e = world.elements;
  const slots = slotCount(world, fid, list.length);
  const live = list.filter((id) => {
    if (e.cols.strength[id]! > 0) return true;
    // Its end is an event, not state (PLAN 2.4b): at the slot it stood in. Elements that go
    // with a disbanded or removed formation have none.
    const [x, y] = elementPlaceBefore(world, fid, e.cols.slot[id]!, slots);
    world.out.emit(world.tick, EventKind.ElementDestroyed, id, e.cols.unit[id]!, x, y);
    e.remove(id);
    return false;
  });
  if (live.length === list.length) {
    recomputeStrength(world, fid);
    return;
  }
  world.elementIndex!.set(fid, live);
  if (live.length > 0) {
    recomputeStrength(world, fid);
    return;
  }
  world.elementIndex!.delete(fid);
  destroyFormation(world, fid);
}

/** Removes a formation, its elements and derived caches; emits FormationDestroyed. */
export function destroyFormation(world: World, fid: number): void {
  const f = world.formations;
  if (!f.has(fid)) return;
  const list = elementIndex(world).get(fid) ?? [];
  for (const id of list) world.elements.remove(id);
  world.elementIndex!.delete(fid);
  world.out.emit(world.tick, EventKind.FormationDestroyed, fid, f.cols.nation[fid]!, f.cols.x[fid]!, f.cols.y[fid]!);
  f.remove(fid);
  world.paths.delete(fid);
}

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
import { hash32 } from '../core/hash';
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
 *
 * `element`, for a deployed block only (PLAN 3.11c4): the element in the slot, which stands off
 * it by its id (`DEPLOY_SCATTER`), on land as the slot would. A block at rest stands on its slots.
 */
export function slotPlace(world: World, fx: number, fy: number, facing: number, slot: number, count: number, element?: number): [number, number] {
  const p =
    element === undefined
      ? slotPose(fx, fy, facing, slot, count, SLOT_SPACING)
      : slotPose(fx, fy, facing, slot, count, SLOT_SPACING, shareOf(element, 1) * DEPLOY_SCATTER * SLOT_SPACING, shareOf(element, 2) * DEPLOY_SCATTER * SLOT_SPACING);
  if (!world.landMask || world.onLand(p[0], p[1]) || !world.onLand(fx, fy)) return p;
  // In eighths of the way: the block's far corner is 0.134 cells out, a mask pixel is 0.125 wide.
  for (let k = 1; k < 8; k++) {
    const x = p[0] + ((fx - p[0]) * k) / 8;
    const y = p[1] + ((fy - p[1]) * k) / 8;
    if (world.onLand(x, y)) return [x, y];
  }
  return [fx, fy];
}

/**
 * How far off its slot an element of a deployed block stands at most, forward or back and to
 * either side, in slot spacings (PLAN 3.11c4: 180 m of the 600 between slots). Under a half: the
 * block keeps its rectangle, so the gaps between blocks hold, and no two elements change places.
 */
export const DEPLOY_SCATTER = 0.3;
/** How far off its block's facing an element of a deployed block is turned at most, radians (17°). */
export const DEPLOY_TURN = 0.3;

/** A share of -1 to 1 for element `element`, by its id alone: the same every hour, in every game. */
function shareOf(element: number, salt: number): number {
  return (hash32(0x3b11c4, element, salt) >>> 0) / 0x80000000 - 1;
}

/**
 * What element `element` of a block that faces `facing` faces. In a deployed block it is turned
 * off its block's facing by its id, `DEPLOY_TURN` at most (PLAN 3.11c4: the elements of a block
 * in contact all faced one way); in a block at rest it faces as the block does.
 */
export function elementFacing(facing: number, deployed: boolean, element: number): number {
  return deployed ? facing + shareOf(element, 3) * DEPLOY_TURN : facing;
}

/** Enemy formations within this many cells of each other are in contact (`findBattles`). */
export const CONTACT_CELLS = 1.5;
/** Between the front rows of two formations deployed against each other, cells (a kilometre). */
export const DEPLOY_GAP = 0.05;
/**
 * The furthest a deployed block stands from its formation's place, cells: as far as an enemy in
 * contact can be (PLAN 2.14f5c). Two that are each other's nearest go 0.67 cells at most.
 */
export const DEPLOY_REACH = CONTACT_CELLS;
/** The furthest a block stands to the side of its formation's line to the enemy, cells (ADR-133). */
export const DEPLOY_ABREAST = 1;
/**
 * The most lines of one file on the way to an enemy's block, the one that enemy faces among
 * them (PLAN 3.11c3a). The second line's middle is two depths and two gaps (6.7 km for
 * divisions) from that block's middle, and the block's far side 7.8 km: within the 8 km from
 * the middle of the battle's view (20 m/px, 16 km high) to its edge, whichever way the fight
 * lies. A third line is 10 km off.
 */
export const DEPLOY_LINES = 2;

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

/** More than the furthest a block's corner lies from its middle, cells (a tank corps of 11 by 5 slots: 0.18). */
const BLOCK_REACH = 0.5;

/** Of an hour's contacts: each formation's turn, and those on the way to each enemy's block (`orderOf`). */
interface Order {
  turns: Map<number, number>;
  /** By the enemy they go to: formation and distance from that enemy, nearest first, then the lower id. */
  comers: Map<number, [number, number][]>;
}

const orders = new WeakMap<Map<number, number>, Order>();

/**
 * The one order the blocks of an hour are worked out in (PLAN 3.11c3b), for each formation in
 * contact its turn: 0 for two that are each other's nearest, and for one on the way to an
 * enemy's block that enemy's turn and one more for itself and for each formation that goes to
 * the same enemy and is nearer it (then the lower id: the lines of ADR-89). Equal turns go by
 * id. A block asks only for blocks before it in this order, whatever side they are of, so
 * where it stands does not hang on which block was asked for first. Derived from the hour's
 * contacts and kept with them, as are the lists it is made from: `deployOf` reads the lines
 * before a block from them (PLAN 3.12Rd1a: each block on the way went through every contact
 * of the hour for them).
 */
function orderOf(world: World, contacts: Map<number, number>): Order {
  const held = orders.get(contacts);
  if (held) return held;
  const c = world.formations.cols;
  // Those on the way to each enemy's block, nearest it first.
  const comers = new Map<number, [number, number][]>();
  for (const [g, e] of contacts) {
    if (contacts.get(e) === g || !world.formations.has(g) || !world.formations.has(e)) continue;
    const gx = wrapDx(world, c.x[e]!, c.x[g]!);
    const gy = c.y[g]! - c.y[e]!;
    let list = comers.get(e);
    if (!list) comers.set(e, (list = []));
    list.push([g, sqrt(gx * gx + gy * gy)]);
  }
  for (const list of comers.values()) list.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  const out = new Map<number, number>();
  const place = (e: number, from: number): void => {
    const list = comers.get(e);
    if (!list) return;
    for (const [k, [g]] of list.entries()) {
      if (out.has(g)) continue;
      out.set(g, from + k + 1);
      place(g, from + k + 1);
    }
  };
  for (const [g, e] of contacts) {
    if (contacts.get(e) !== g && world.formations.has(e)) continue;
    out.set(g, 0);
  }
  for (const g of [...out.keys()]) place(g, 0);
  // None is left but in a ring of nearest enemies, which a tie's lower id rules out.
  for (const g of contacts.keys()) if (!out.has(g)) out.set(g, 0);
  const order = { turns: out, comers };
  orders.set(contacts, order);
  return order;
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
 * pairs of each other's nearest, and the rest had no enemy near their block without it. That
 * enemy's block may stand on its far side, and its own enemy's further still: such a block goes
 * `DEPLOY_REACH` from its formation at most and stops there, short of the block it was going to
 * (without the limit one stood 80 km, four cells, from the formation the rules know). A line
 * with no room before its formation's place stands abreast of the lines that have (ADR-133).
 * It stops short of every enemy's block in its way that is before it in the hour's one order
 * (`orderOf`), whatever that block goes to (PLAN 3.11c3b).
 *
 * Not state, as an element's place is not (`slotPlace`): worked out from the formations'
 * places and `engaged` flags. The formation's part in the rules and its T1 marker stay where
 * the sim has it; where the view has the formation at the close tiers, for a click, for the
 * camera and in its panel is where the block stands (PLAN 3.11a, `blockPose` in
 * worker/server.ts). A block does not go into the sea: on the fine mask's water it stands
 * as far forward as there is land (across a strait the two sides stay on their shores).
 */
export function deployOf(world: World, f: number, count: number): Deployment | null {
  const c = world.formations.cols;
  if (c.engaged[f] !== 1) return null;
  const cache = (world.deployed ??= new Map<number, Deployment | null>());
  const held = cache.get(f);
  if (held !== undefined) return held;
  const contacts = contactsOf(world);
  // Every block it asks for is before it in one order (`orderOf`), so none asks for this one.
  // Were one to (a ring of nearest enemies, which the lower id on a tie rules out), it has no block.
  cache.set(f, null);
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
    // Its file of the stack (0: on its line to the block; then right and left by turns), and how far apart files stand.
    let file = 0;
    let apart = 0;
    // The blocks it comes up to: that enemy's, the block of the one that enemy faces, and those
    // of the lines before it (PLAN 3.11c2).
    const stand: [Deployment, number][] = [];
    if (contacts.get(enemy) !== f) {
      // Its nearest enemy has a nearer one of its own and is deployed against that. This one
      // comes up to where that enemy's block stands, as near as a formation it faced would
      // stand; the next such formation (by distance from that enemy, then id) a line further
      // back, and so on.
      const { turns, comers } = orderOf(world, contacts);
      const others = comers.get(enemy) ?? [];
      // The lines before this one, nearest that enemy first.
      const ahead = others.slice(0, Math.max(0, others.findIndex((o) => o[0] === f))).map((o) => o[0]);
      const idx = elementIndex(world);
      const enemySlots = slotCount(world, enemy, idx.get(enemy)?.length ?? 0);
      const theirs = deployOf(world, enemy, enemySlots);
      if (theirs) {
        tx = theirs.x;
        ty = theirs.y;
        stand.push([theirs, enemySlots]);
        const faced = contacts.get(enemy)!;
        for (const g of [faced, ...ahead]) {
          const slots = slotCount(world, g, idx.get(g)?.length ?? 0);
          const at = world.formations.has(g) ? deployOf(world, g, slots) : null;
          if (at) stand.push([at, slots]);
        }
        // And the blocks of its enemies that go elsewhere and are before it in the order
        // (PLAN 3.11c3b: a German division came to a Polish block and stood in a line of that
        // block's stack which faced another German). Those that can reach where it can: a
        // block goes `DEPLOY_REACH` from its formation's place at most.
        // The distance is asked first: most of an hour's contacts are in other wars.
        const mine = turns.get(f)!;
        const known = new Set<number>([enemy, faced, ...ahead]);
        for (const h of contacts.keys()) {
          if (h === f || !world.formations.has(h) || cellDist(world, fx, fy, c.x[h]!, c.y[h]!) > 2 * DEPLOY_REACH + BLOCK_REACH) continue;
          if (known.has(h) || !world.wars.atWar(c.nation[f]!, c.nation[h]!)) continue;
          const its = turns.get(h)!;
          if (its > mine || (its === mine && h > f)) continue;
          const slots = slotCount(world, h, idx.get(h)?.length ?? 0);
          const at = deployOf(world, h, slots);
          if (at) stand.push([at, slots]);
        }
        // From much the same side as the one that enemy faces (within 60°): a line further
        // back, behind it. From another side it stands as near as that one does.
        const ax = wrapDx(world, tx, fx);
        const ay = fy - ty;
        const al = sqrt(ax * ax + ay * ay);
        if (al > 1e-9 && (ax * cos(theirs.facing) + ay * sin(theirs.facing)) / al > 0.5) ahead.unshift(contacts.get(enemy)!);
      }
      // On the way to a block: as many lines as have room before its own place, `DEPLOY_LINES`
      // at most (PLAN 3.11c3a: seven divisions on one enemy stood six lines deep, 20 km), one
      // behind another, each by the depth of those before it (PLAN 3.11c1: a tank brigade behind a
      // tank corps stood in the corps' rear rows). A line with no room begins a file abreast
      // of those, right and left by turns, the widest block's width and the gap out (ten
      // divisions on one cell against one enemy are two lines of five, not ten blocks in one,
      // nor a column of thirty km).
      const dx = wrapDx(world, fx, tx);
      const dy = ty - fy;
      const room = sqrt(dx * dx + dy * dy) - (slotGrid(enemySlots).rows * SLOT_SPACING) / 2 - DEPLOY_GAP;
      let taken = 0;
      let lines = 0;
      let widest = slotGrid(count).cols;
      for (const [g] of others) widest = Math.max(widest, slotGrid(slotCount(world, g, idx.get(g)?.length ?? 0)).cols);
      for (const g of [...ahead, f]) {
        const grid = g === f ? slotGrid(count) : slotGrid(slotCount(world, g, idx.get(g)?.length ?? 0));
        // The one that enemy faces is a line of the stack too.
        widest = Math.max(widest, grid.cols);
        const deep = grid.rows * SLOT_SPACING;
        if (taken > 0 && (lines >= DEPLOY_LINES || taken + deep / 2 > room)) {
          file++;
          taken = 0;
          lines = 0;
        }
        lines++;
        if (g !== f) taken += deep + DEPLOY_GAP;
      }
      short = (slotGrid(enemySlots).rows * SLOT_SPACING) / 2 + DEPLOY_GAP + taken + depth / 2;
      apart = widest * SLOT_SPACING + DEPLOY_GAP;
    }
    const dx = wrapDx(world, fx, tx);
    const dy = ty - fy;
    const d = sqrt(dx * dx + dy * dy);
    if (d > 1e-9) {
      // Each other's nearest: to the middle between the two, less half the gap and half its depth.
      // No further from its own place than `DEPLOY_REACH` (it binds only on the way to a block).
      const ux = dx / d;
      const uy = dy / d;
      const sideOf = (k: number): number => Math.min(DEPLOY_ABREAST, Math.ceil(k / 2) * apart) * (k % 2 === 1 ? 1 : -1);
      // How far forward a file is free: the gap short of each block that stands in its way,
      // whatever side of that block it comes to. A block is twice as wide as deep, and one that
      // came to a flank stood in it (PLAN 3.11c2). In its way: across the file's width and the
      // gap, before the formation's place.
      const half = (slotGrid(count).cols * SLOT_SPACING) / 2 + DEPLOY_GAP - 1e-9;
      // Of each such block: where its near side is along this one's line, and its middle and its reach across it.
      const inWay: [number, number, number][] = [];
      for (const [b, slots] of stand) {
        const grid = slotGrid(slots);
        const bx = wrapDx(world, fx, b.x);
        const by = b.y - fy;
        if (bx * ux + by * uy <= 0) continue;
        // Its depth and its width, turned to this one's line.
        const bc = cos(b.facing);
        const bs = sin(b.facing);
        const turnedAlong = Math.abs(bc * ux + bs * uy);
        const turnedAcross = Math.abs(bs * ux - bc * uy);
        const along = ((turnedAlong * grid.rows + turnedAcross * grid.cols) * SLOT_SPACING) / 2;
        const across = ((turnedAcross * grid.rows + turnedAlong * grid.cols) * SLOT_SPACING) / 2;
        inWay.push([bx * ux + by * uy - along, by * ux - bx * uy, across + half]);
      }
      const free = (at: number): number => {
        let least = Infinity;
        for (const [near, middle, reach] of inWay) if (Math.abs(middle - at) < reach) least = Math.min(least, near - DEPLOY_GAP - depth / 2);
        return least;
      };
      // A file with no room before the formation's place (a block of another bearing stands in
      // it): the next file out that has room, as a line with no room does (ADR-133).
      let side = sideOf(file);
      let room = free(side);
      for (let k = file + 1; room < -1e-9 && Math.ceil(k / 2) * apart <= DEPLOY_ABREAST; k++) {
        const there = free(sideOf(k));
        if (there < -1e-9) continue;
        side = sideOf(k);
        room = there;
      }
      // Each other's nearest: to the middle between the two, less half the gap and half its depth.
      // No further from its own place than `DEPLOY_REACH` (it binds only on the way to a block).
      let shift = Math.min(DEPLOY_REACH, Math.max(0, d / 2 - DEPLOY_GAP / 2 - depth / 2));
      if (short >= 0) shift = Math.min(sqrt(DEPLOY_REACH * DEPLOY_REACH - side * side), Math.max(0, d - short), Math.max(0, room));
      out = { x: fx, y: fy, facing: atan2(dy, dx) };
      // As far forward as the block's middle has land under it, in eighths of the way.
      for (let k = 8; k >= (side === 0 ? 1 : 0); k--) {
        const x = fx + (ux * shift * k) / 8 - uy * side;
        const y = fy + (uy * shift * k) / 8 + ux * side;
        if (!world.landMask || world.onLand(x, y)) {
          out = { x, y, facing: out.facing };
          break;
        }
      }
    } else {
      // On the very point it goes towards (PLAN 3.5a: a formation on the retreat is in no
      // contact and may halt where an enemy stands, and the two are in contact a day later).
      // The lower id faces east and the other west, each half the gap and half its depth back
      // from the point, where that is land.
      const ux = f < enemy ? 1 : -1;
      const back = DEPLOY_GAP / 2 + depth / 2;
      const x = fx - ux * back;
      out = { x: !world.landMask || world.onLand(x, fy) ? x : fx, y: fy, facing: atan2(0, ux) };
    }
  }
  cache.set(f, out);
  return out;
}

/**
 * Where element `slot` of formation `f` stands: in its block at the formation's place, or, for
 * a formation in contact, in its block deployed against the enemy (`deployOf`), on land either
 * way (`slotPlace`). The one place of an element for the snapshot, the fire events and the
 * event of its end. `element` is the element in the slot: in a deployed block it stands off its
 * slot by its id (PLAN 3.11c4).
 */
export function elementPlace(world: World, f: number, slot: number, count: number, element: number): [number, number] {
  const c = world.formations.cols;
  const d = deployOf(world, f, count);
  return d ? slotPlace(world, d.x, d.y, d.facing, slot, count, element) : slotPlace(world, c.x[f]!, c.y[f]!, c.facing[f]!, slot, count);
}

/**
 * Where element `slot` of formation `f` stood in the hour before this one's contacts were
 * found: where its sprite was last shown. For the event of its end, which comes in the hour
 * the blocks may be deployed anew (a nearer enemy, a first contact): the wreck lies where the
 * element stood, not where its block is going. A formation that was not in contact then and
 * has marched in this hour before it met the enemy stood where `noteMove` has it (PLAN 3.5a:
 * the wreck of an element that died in its first hour of contact lay an hour's march from its
 * sprite). Where the hour before is not known (a loaded game's first hour, after a command) it
 * is the place of now.
 */
export function elementPlaceBefore(world: World, f: number, slot: number, count: number, element: number): [number, number] {
  const before = world.deployedBefore;
  if (!before) return elementPlace(world, f, slot, count, element);
  const c = world.formations.cols;
  const d = before.get(f);
  if (d) return slotPlace(world, d.x, d.y, d.facing, slot, count, element);
  const m = world.movedTick === world.tick ? world.movedFrom.get(f) : undefined;
  return m ? slotPlace(world, m[0], m[1], m[2], slot, count) : slotPlace(world, c.x[f]!, c.y[f]!, c.facing[f]!, slot, count);
}

/** Before an order or the march moves formation `f` in this tick: where it stands (`elementPlaceBefore`). The first of a tick counts. */
export function noteMove(world: World, f: number): void {
  if (world.movedTick !== world.tick) {
    world.movedFrom.clear();
    world.movedTick = world.tick;
  }
  if (world.movedFrom.has(f)) return;
  const c = world.formations.cols;
  world.movedFrom.set(f, [c.x[f]!, c.y[f]!, c.facing[f]!]);
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

/**
 * Breakdowns (PLAN 3.2d): removes the share `fraction` of what formation `fid` has in vehicles
 * and towed guns, which are its elements that burn fuel and are not counted in men. The caller
 * settles the formation (`bleedFormation` of the same hour does).
 */
export function breakDown(world: World, fid: number, fraction: number): void {
  const els = elementIndex(world).get(fid);
  if (!els) return;
  const units = world.rules!.units;
  const ec = world.elements.cols;
  for (const e of els) {
    const u = units[ec.unit[e]!]!;
    if (u.fuel > 0 && u.menPerUnit > 1) applyLoss(world, e, ec.strength[e]! * fraction);
  }
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
    const [x, y] = elementPlaceBefore(world, fid, e.cols.slot[id]!, slots, id);
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

/**
 * Air combat (PLAN 5.3a, SPEC §6.3): each hour, the sorties of nations at war in one air zone fire
 * on each other, at element level: a squadron's fire is its aircraft × its air attack (`aa`) ×
 * `AIR_FIRE`, over the target's defence (`defense`), in hit points; the target's squadrons lose
 * that ÷ their `hpPerUnit` in aircraft, carried as on the land (`applyLoss`). All fire of the
 * hour is reckoned before any loss. A wing with no aircraft left is lost; a sortie that lost a
 * quarter of its aircraft in the hour turns home from where it is. Then AA (PLAN 5.3b,
 * `antiAir`): what is below a sortie of an enemy's fires on it.
 */
import { EventKind } from '../../shared/events';
import { addAirTotal, Domain, tallyAir, type UnitRule, type World } from '../world';
import { applyLoss, cellX, elementIndex, loopW, settleFormation, wrapDx } from './elements';
import { seaKm } from './navalCombat';
import { bombIndustry } from './bombing';
import { ARMOR_PEN, effectiveness } from './combat';
import { Leg, legHours, sortieAt, type Sortie } from './sorties';
import { strikeFactor } from './airSuperiority';
import { pickByHealth, type HealthTable } from './pickByHealth';

/** The share of an aircraft's air attack that is hit points on a target of defence 1 in an hour. */
export const AIR_FIRE = 0.05;
/** The share of its aircraft a sortie loses in an hour's fight that turns it home. */
export const BREAK_OFF = 0.25;
/**
 * How far, km, a sortie meets the enemy's in an hour (PLAN 5.7d): an air zone is up to some
 * million km² wide, and its sorties far apart do not fight. About the ground a patrol watches.
 */
export const INTERCEPT_KM = 150;

/** The aircraft of wing `id` (its squadrons' strength). */
export function aircraftOf(world: World, id: number): number {
  const ec = world.elements.cols;
  return (elementIndex(world).get(id) ?? []).reduce((s, e) => s + ec.strength[e]!, 0);
}

/**
 * The hour's air fights, over the sorties in the air by zone (`airborne`). A wing fights the
 * wings of nations at war with its own in its zone within `INTERCEPT_KM` of it (PLAN 5.7d: the
 * whole zone's, once); its fire is spread over those by their aircraft, and within a wing over
 * its squadrons by theirs. The wings joined by such meetings are one fight: an `AirBattle` each,
 * with its aircraft lost, at the middle of its nearest two sorties of foes (`fightPlace`).
 */
export function airCombat(world: World, byZone: Map<number, number[]>): void {
  const rules = world.rules!;
  const ec = world.elements.cols;
  const fc = world.formations.cols;
  const index = elementIndex(world);
  const loss = new Map<number, number>(); // element → aircraft lost this hour
  const before = new Map<number, number>();
  const fought: { zone: number; wings: number[] }[] = [];
  for (const [zone, wings] of [...byZone].sort((a, b) => a[0] - b[0])) {
    if (wings.length < 2) continue;
    // Who meets whom (PLAN 5.7d): a zone is wide, and a sortie fights only the enemy's sorties
    // within `INTERCEPT_KM` of it this hour.
    const at = wings.map((id) => sortieAt(world.sorties.get(id)!, world.tick, loopW(world)));
    const foesOf = wings.map((a, i) => wings.filter((b, j) => world.wars.atWar(fc.nation[a]!, fc.nation[b]!) && seaKm(world, at[i]!.x, at[i]!.y, at[j]!.x, at[j]!.y) <= INTERCEPT_KM));
    // The fights: wings joined by such meetings (each its lowest id's).
    const root = new Map<number, number>();
    const find = (a: number): number => {
      let r = a;
      while (root.get(r) !== r) r = root.get(r)!;
      return r;
    };
    wings.forEach((a, i) => {
      for (const b of foesOf[i]!) {
        if (!root.has(a)) root.set(a, a);
        if (!root.has(b)) root.set(b, b);
        const [ra, rb] = [find(a), find(b)];
        if (ra !== rb) root.set(Math.max(ra, rb), Math.min(ra, rb));
      }
    });
    if (root.size === 0) continue;
    wings.forEach((a, i) => {
      const foes = foesOf[i]!;
      if (foes.length === 0) return;
      const foeAircraft = foes.map((b) => aircraftOf(world, b));
      const total = foeAircraft.reduce((s, n) => s + n, 0);
      if (total === 0) return;
      for (const e of index.get(a) ?? []) {
        const fire = ec.strength[e]! * rules.units[ec.unit[e]!]!.aa * AIR_FIRE;
        if (fire === 0) continue;
        foes.forEach((b, k) => {
          const share = (fire * foeAircraft[k]!) / total;
          for (const t of index.get(b) ?? []) {
            if (ec.strength[t] === 0) continue;
            const u = rules.units[ec.unit[t]!]!;
            const hp = (share * ec.strength[t]!) / foeAircraft[k]! / Math.max(1, u.defense);
            loss.set(t, (loss.get(t) ?? 0) + hp / u.hpPerUnit);
          }
        });
      }
    });
    const groups = new Map<number, number[]>();
    for (const id of [...root.keys()].sort((a, b) => a - b)) {
      before.set(id, aircraftOf(world, id));
      const r = find(id);
      const g = groups.get(r);
      if (g) g.push(id);
      else groups.set(r, [id]);
    }
    for (const g of [...groups.keys()].sort((a, b) => a - b)) fought.push({ zone, wings: groups.get(g)! });
  }
  if (loss.size === 0 && fought.length === 0) return;
  // Where each fight is told, before any loss or turn home.
  const places = fought.map((f) => fightPlace(world, f.wings));
  for (const [e, units] of [...loss].sort((a, b) => a[0] - b[0])) applyLoss(world, e, units);
  fought.forEach(({ zone, wings }, k) => {
    let lost = 0;
    // The month's tally (PLAN 5.11a): each side's aircraft and losses by nation, the side of the
    // fight's first wing and the other.
    const first = fc.nation[wings[0]!]!;
    const sides = [new Map<number, number>(), new Map<number, number>()];
    const lostBy = [0, 0];
    for (const id of wings) {
      const was = before.get(id)!;
      const now = aircraftOf(world, id);
      lost += was - now;
      const side = world.wars.atWar(first, fc.nation[id]!) ? 1 : 0;
      sides[side]!.set(fc.nation[id]!, (sides[side]!.get(fc.nation[id]!) ?? 0) + was);
      lostBy[side] = lostBy[side]! + was - now;
      addAirTotal(world, fc.nation[id]!, was - now, 0);
      const s = world.sorties.get(id);
      const p = s && sortieAt(s, world.tick, loopW(world));
      settleFormation(world, id);
      if (!world.formations.has(id) || now === 0) continue;
      if (p && p.leg !== Leg.Back && was - now >= BREAK_OFF * was) turnHome(world, id);
    }
    world.out.emit(world.tick, EventKind.AirBattle, zone, lost, places[k]!.x, places[k]!.y);
    if (lost > 0 && sides[1]!.size > 0) {
      // Each side's leader: the nation with the most aircraft in the fight (of equals, the lowest id).
      const lead = sides.map((m) => [...m].sort((p, q) => q[1] - p[1] || p[0] - q[0])[0]![0]);
      const swap = lead[0]! > lead[1]!;
      tallyAir(world, 1, swap ? lead[1]! : lead[0]!, swap ? lead[0]! : lead[1]!, swap ? lostBy[1]! : lostBy[0]!, swap ? lostBy[0]! : lostBy[1]!, places[k]!.x, places[k]!.y);
    }
  });
}

/**
 * Where an hour's fight among `wings` (the sorties of one zone) is told (PLAN 5.7d): a zone is
 * wide (1.5 M km²), so at the middle of the two sorties of foes nearest each other, the short way
 * round the map; of equals, the pair of the lowest ids. Before any loss or turn home.
 */
export function fightPlace(world: World, wings: readonly number[]): { x: number; y: number } {
  const fc = world.formations.cols;
  const lw = loopW(world);
  const at = wings.map((id) => sortieAt(world.sorties.get(id)!, world.tick, lw));
  let best = { x: at[0]!.x, y: at[0]!.y };
  let bd = Infinity;
  for (let i = 0; i < wings.length; i++) {
    for (let j = i + 1; j < wings.length; j++) {
      if (!world.wars.atWar(fc.nation[wings[i]!]!, fc.nation[wings[j]!]!)) continue;
      const dx = wrapDx(world, at[i]!.x, at[j]!.x);
      const dy = at[j]!.y - at[i]!.y;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        const x = at[i]!.x + dx / 2;
        best = { x: lw > 0 ? ((x % lw) + lw) % lw : x, y: at[i]!.y + dy / 2 };
      }
    }
  }
  return best;
}

/**
 * Sortie of wing `id` turns home from where it is now: a sortie of its own to here, with no time
 * over it, launched so that now is its turn (its flight stays a function of its launch).
 */
function turnHome(world: World, id: number): void {
  const s = world.sorties.get(id)!;
  const p = sortieAt(s, world.tick, loopW(world));
  const km = seaKm(world, s.bx, s.by, p.x, p.y);
  world.sorties.set(id, { bx: s.bx, by: s.by, tx: p.x, ty: p.y, launch: world.tick - (s.kmh > 0 ? km / s.kmh : 0), kmh: s.kmh, km, over: 0 });
}

/**
 * AA hit points an hour of a full land or sea element per point of its `aa` (PLAN 5.3b), on a
 * target of defence 1. Its fire is `aa` × its strength ÷ its size × this, as a land element's
 * fire is (combat.ts): per full element, where an aircraft's is per aircraft.
 */
export const AA_FIRE = 0.2;
/** How far, cells, the AA of a formation reaches a sortie overhead (each way, a square). */
export const AA_CELLS = 1;

/**
 * The hour's AA (PLAN 5.3b): each sortie in the air (out, over its target or back) is fired on by
 * the elements of the formations of nations at war with its own within `AA_CELLS` of its place,
 * land and fleets alike (not other wings, not what is aboard a fleet). A formation's fire is
 * spread over the sorties it reaches by their aircraft, and within a wing over its squadrons, as
 * in the air. Losses carried; a wing with none left is lost.
 */
export function antiAir(world: World): void {
  const aaCells = world.atSizeWhole(AA_CELLS);
  if (world.sorties.size === 0) return;
  const rules = world.rules!;
  const ec = world.elements.cols;
  const fc = world.formations.cols;
  const w = world.cells.w;
  const h = world.cells.h;
  const index = elementIndex(world);
  // The sorties overhead by cell.
  const above = new Map<number, number[]>();
  for (const [id, s] of [...world.sorties].sort((a, b) => a[0] - b[0])) {
    if (!world.formations.has(id)) continue;
    const p = sortieAt(s, world.tick, loopW(world));
    if (p.leg === Leg.Home) continue;
    const cell = Math.min(h - 1, Math.floor(p.y)) * w + Math.floor(p.x);
    const list = above.get(cell);
    if (list) list.push(id);
    else above.set(cell, [id]);
  }
  if (above.size === 0) return;
  const near = markNear(world, above);
  const loss = new Map<number, number>();
  world.formations.forEach((g) => {
    const gx = Math.floor(fc.x[g]!);
    const gy = Math.floor(fc.y[g]!);
    // No sortie in its reach: the walk below would find none (a place off the grid walks it).
    if (gx >= 0 && gx < w && gy >= 0 && gy < h && near.mark[gy * w + gx] === 0) return;
    if (world.isWing(g) || world.embarked.has(g)) return;
    const targets: number[] = [];
    for (let dy = -aaCells; dy <= aaCells; dy++) {
      const y = gy + dy;
      if (y < 0 || y >= h) continue;
      for (let dx = -aaCells; dx <= aaCells; dx++) {
        const x = cellX(world, gx + dx);
        if (x === null) continue;
        for (const id of above.get(y * w + x) ?? []) if (world.wars.atWar(fc.nation[g]!, fc.nation[id]!)) targets.push(id);
      }
    }
    if (targets.length === 0) return;
    let fire = 0;
    for (const e of index.get(g) ?? []) {
      const u = rules.units[ec.unit[e]!]!;
      fire += (u.aa * ec.strength[e]! * AA_FIRE) / u.size;
    }
    if (fire === 0) return;
    targets.sort((a, b) => a - b);
    const total = targets.reduce((s, id) => s + aircraftOf(world, id), 0);
    if (total === 0) return;
    targets.forEach((id) => {
      for (const t of index.get(id) ?? []) {
        if (ec.strength[t] === 0) continue;
        const u = rules.units[ec.unit[t]!]!;
        const hp = (fire * ec.strength[t]!) / total / Math.max(1, u.defense);
        loss.set(t, (loss.get(t) ?? 0) + hp / u.hpPerUnit);
      }
    });
  });
  clearMarks();
  if (loss.size === 0) return;
  const hit = new Set<number>();
  // The aircraft each wing fired on had (PLAN 5.11b: what the flak took counted).
  const had = new Map<number, number>();
  for (const e of loss.keys()) if (!had.has(ec.formation[e]!)) had.set(ec.formation[e]!, aircraftOf(world, ec.formation[e]!));
  for (const [e, units] of [...loss].sort((a, b) => a[0] - b[0])) {
    applyLoss(world, e, units);
    hit.add(ec.formation[e]!);
  }
  for (const [id, n] of [...had].sort((a, b) => a[0] - b[0])) addAirTotal(world, fc.nation[id]!, n - aircraftOf(world, id), 0);
  for (const id of [...hit].sort((a, b) => a - b)) {
    // Its flak, where it flies (PLAN 5.7b: a picture, not state).
    const p = sortieAt(world.sorties.get(id)!, world.tick, loopW(world));
    world.out.emit(world.tick, EventKind.FlakFired, id, fc.nation[id]!, p.x, p.y);
    settleFormation(world, id);
  }
}

/**
 * Cells marked for a call of `antiAir` or `strikes` (PLAN 7.1f), kept between calls (not state)
 * and cleared by the caller before it returns (`clearMarks`): a byte a cell, and the cells marked.
 */
const marks = { mark: new Uint8Array(0), cells: new Int32Array(0), count: 0 };

/** Ready `marks` for a world of its size and up to `most` cells. */
function startMarks(world: World, most: number): typeof marks {
  const n = world.cells.w * world.cells.h;
  if (marks.mark.length !== n) marks.mark = new Uint8Array(n);
  if (marks.cells.length < most) marks.cells = new Int32Array(Math.max(most, 2 * marks.cells.length));
  marks.count = 0;
  return marks;
}

function markCell(c: number): void {
  if (marks.mark[c] === 1) return;
  marks.mark[c] = 1;
  marks.cells[marks.count++] = c;
}

function clearMarks(): void {
  for (let i = 0; i < marks.count; i++) marks.mark[marks.cells[i]!] = 0;
  marks.count = 0;
}

/**
 * Marks the cells from which `antiAir`'s walk of `AA_CELLS` meets a cell of `above`. A key of
 * `above` is matched as the walk matches it, by its row and column in the grid.
 */
function markNear(world: World, above: Map<number, number[]>): typeof marks {
  const aaCells = world.atSizeWhole(AA_CELLS);
  const w = world.cells.w;
  const h = world.cells.h;
  const side = 2 * aaCells + 1;
  const s = startMarks(world, above.size * side * side);
  for (const key of above.keys()) {
    if (key < 0 || key >= w * h) continue;
    const sy = Math.floor(key / w);
    const sx = key - sy * w;
    for (let dy = -aaCells; dy <= aaCells; dy++) {
      const gy = sy - dy;
      if (gy < 0 || gy >= h) continue;
      for (let dx = -aaCells; dx <= aaCells; dx++) {
        const gx = world.settings.loopingMap ? (((sx - dx) % w) + w) % w : sx - dx;
        if (gx < 0 || gx >= w) continue;
        markCell(gy * w + gx);
      }
    }
  }
  return s;
}

/**
 * Target units an hour of an aircraft per point of its soft or hard attack, a strike's fire
 * (PLAN 5.4b), before the target's `hpPerUnit`: per aircraft, as its air attack is.
 */
export const STRIKE_FIRE = 0.2;
/**
 * The share of `STRIKE_FIRE` a strike puts on a land formation that is not in contact (`engaged`
 * unset; PLAN 7.110b): its men are spread out and under cover, not packed in the line. The air AI
 * strikes the enemy's land forces out of contact where no front is in its reach (PLAN 5.12b), and late
 * in a game, with few fronts, those strikes took more of the armies at war than their battles (on
 * five year-10 saves of 901–909, 648,000 men in 60 days against combat's 536,000, 88 % of it of
 * formations in no contact; `docs/evidence/7.110/measure.md`).
 */
export const DISPERSED_STRIKE = 0.25;
/**
 * Hit points an hour of an aircraft per point of its hard attack on a ship, a naval strike's
 * fire (PLAN 5.4c): a bomb or torpedo on a ship counts in full, where on the land the fire is
 * spread over men in cover (`STRIKE_FIRE`).
 */
export const NAVAL_STRIKE_FIRE = 1;
/** A land-based squadron's pick of the ship it strikes (PLAN 7.61; the carriers' is `SALT_CARRIER`). */
export const SALT_STRIKE_SHIP = 0x5e4b;

/** An aircraft's fire on a ship, per point of `NAVAL_STRIKE_FIRE`: its hard attack, halved where the ship's armour beats its piercing. */
export function shipEffectiveness(us: UnitRule, ut: UnitRule): number {
  return ut.armor > us.piercing ? us.hard * ARMOR_PEN : us.hard;
}

/**
 * The formations that are not wings nor aboard within reach of the hour's strikes (`aims`, their
 * targets' cells), by the cell of `strikes`' test (PLAN 7.1f): the column of their x, the row of
 * their y up to the last. `near(tx, ty)` gives, in ascending id and once each, those whose cell is
 * within `AA_CELLS` of (tx, ty) as that test reckons it, and those off the grid; the caller makes
 * the whole test of each.
 */
function formationsByCell(world: World, aims: readonly { tx: number; ty: number }[]): { near(tx: number, ty: number): number[] } {
  const aaCells = world.atSizeWhole(AA_CELLS);
  const fc = world.formations.cols;
  const w = world.cells.w;
  const h = world.cells.h;
  const side = 2 * aaCells + 1;
  const reach = startMarks(world, aims.length * side * side);
  for (const { tx, ty } of aims) {
    for (let y = ty - aaCells; y <= ty + aaCells; y++) {
      if (y < 0 || y >= h) continue;
      for (let d = -aaCells; d <= aaCells; d++) {
        const x = cellX(world, tx + d);
        if (x !== null) markCell(y * w + x);
      }
    }
  }
  const at = new Map<number, number[]>();
  const off: number[] = [];
  world.formations.forEach((g) => {
    const x = Math.floor(fc.x[g]!);
    const y = Math.min(h - 1, Math.floor(fc.y[g]!));
    const onGrid = x >= 0 && x < w && y >= 0;
    if (onGrid && reach.mark[y * w + x] === 0) return;
    if (world.isWing(g) || world.embarked.has(g)) return;
    if (!onGrid) {
      off.push(g);
      return;
    }
    const list = at.get(y * w + x);
    if (list) list.push(g);
    else at.set(y * w + x, [g]);
  });
  clearMarks();
  return {
    near(tx, ty) {
      const out = off.slice();
      for (let y = ty - aaCells; y <= ty + aaCells; y++) {
        if (y < 0 || y >= h) continue;
        for (let d = -aaCells; d <= aaCells; d++) {
          const x = cellX(world, tx + d);
          if (x === null) continue;
          for (const g of at.get(y * w + x) ?? []) if (!out.includes(g)) out.push(g);
        }
      }
      return out.sort((a, b) => a - b);
    },
  };
}

/**
 * The hour's strikes (PLAN 5.4b, CAS and tactical bombing): a wing on a strike mission whose
 * sortie reaches its target in this hour (it is there in (tick − 1, tick]) fires once on the
 * elements of the formations of nations at war with its own within `AA_CELLS` of the target:
 * the land's and fleets' (PLAN 5.4c), not wings, nor what is aboard. Each squadron's fire is its aircraft × its
 * `effectiveness` on the target (soft, or hard on armour, halved where armour beats piercing)
 * × `STRIKE_FIRE` (× `DISPERSED_STRIKE` on a land formation not in contact, PLAN 7.110b), spread over the elements by their health (strength × hp, as a land element
 * picks its targets); its share on the ships (their health of the whole) × `shipEffectiveness` ×
 * `NAVAL_STRIKE_FIRE` goes on one ship, picked by hit points (PLAN 7.61); in units lost: ÷ the target's `hpPerUnit`; carried as on the land. Run
 * before the hour's air fights, so a sortie turned home in them strikes nothing. Emits
 * `AirStrike` per strike that found a target.
 */
export function strikes(world: World): void {
  const aaCells = world.atSizeWhole(AA_CELLS);
  if (world.sorties.size === 0) return;
  const rules = world.rules!;
  const ec = world.elements.cols;
  const fc = world.formations.cols;
  const h = world.cells.h;
  const index = elementIndex(world);
  const sorties = [...world.sorties].sort((a, b) => a[0] - b[0]);
  const arrives = ([id, s]: [number, Sortie]): boolean => {
    const m = world.wingMission.get(id);
    if (!m || m.kind !== 'strike' || s.tx !== m.x || s.ty !== m.y || !world.formations.has(id)) return false;
    const arrive = s.launch + legHours(s);
    return arrive > world.tick - 1 && arrive <= world.tick;
  };
  // The formations by cell within reach of the hour's strikes, once a call (PLAN 7.1f): the places
  // do not change in this system; the rest of the test is made at each strike, in ascending id.
  const aims = sorties.filter(arrives).map(([, s]) => ({ tx: Math.floor(s.tx), ty: Math.floor(s.ty) }));
  if (aims.length === 0) return;
  const groundAt = formationsByCell(world, aims);
  for (const [id, s] of sorties) {
    if (!arrives([id, s])) continue;
    const tx = Math.floor(s.tx);
    const ty = Math.floor(s.ty);
    const targets: number[] = [];
    for (const g of groundAt.near(tx, ty)) {
      // The land's formations, and fleets (PLAN 5.4c); not wings, nor what is aboard a fleet.
      if (!world.formations.has(g) || world.isWing(g) || world.embarked.has(g) || !world.wars.atWar(fc.nation[id]!, fc.nation[g]!)) continue;
      const dx = Math.abs(wrapDx(world, tx, Math.floor(fc.x[g]!)));
      const dy = Math.abs(Math.min(h - 1, Math.floor(fc.y[g]!)) - ty);
      if (dx > aaCells || dy > aaCells) continue;
      // A submarine is under water: no strike's target, as no gun's (PLAN 5.6 found it sunk from the air).
      for (const e of index.get(g) ?? []) if (ec.strength[e]! > 0 && rules.units[ec.unit[e]!]!.cls !== 'ss') targets.push(e);
    }
    // Its bombs on the industry there (PLAN 5.5a), whether or not an enemy's formation is.
    const tons = bombIndustry(world, id, s.tx, s.ty);
    if (targets.length === 0) {
      if (tons > 0) world.out.emit(world.tick, EventKind.AirStrike, id, 0, s.tx, s.ty);
      continue;
    }
    targets.sort((a, b) => a - b);
    const health = targets.map((t) => ec.strength[t]! * rules.units[ec.unit[t]!]!.hpPerUnit);
    const total = health.reduce((a, b) => a + b, 0);
    const loss = new Map<number, number>();
    const air = strikeFactor(world, id, s.tx, s.ty);
    // The ships among the targets by health (PLAN 7.61, ADR-606): a squadron's share of its fire on
    // ships (their health of the whole) goes on one ship, picked by hit points as a gun picks; spread
    // over every ship, alike ships took the same wound and a fleet went down whole in one strike.
    // The land's targets keep their spread.
    const ships: HealthTable = { cand: [], cum: [], total: 0 };
    targets.forEach((t, k) => {
      if (rules.units[ec.unit[t]!]!.domain !== Domain.sea) return;
      ships.total += health[k]!;
      ships.cand.push(t);
      ships.cum.push(ships.total);
    });
    for (const e of index.get(id) ?? []) {
      const us = rules.units[ec.unit[e]!]!;
      targets.forEach((t, k) => {
        const ut = rules.units[ec.unit[t]!]!;
        if (ut.domain === Domain.sea) return;
        const fire = effectiveness(us, ut) * STRIKE_FIRE * (fc.engaged[ec.formation[t]!] === 1 ? 1 : DISPERSED_STRIKE);
        const units = (ec.strength[e]! * fire * air * health[k]!) / total / ut.hpPerUnit;
        if (units > 0) loss.set(t, (loss.get(t) ?? 0) + units);
      });
      if (ships.total <= 0) continue;
      const t = pickByHealth(ships, world.seed, world.tick, e, SALT_STRIKE_SHIP);
      const ut = rules.units[ec.unit[t]!]!;
      const units = (ec.strength[e]! * shipEffectiveness(us, ut) * NAVAL_STRIKE_FIRE * air * ships.total) / total / ut.hpPerUnit;
      if (units > 0) loss.set(t, (loss.get(t) ?? 0) + units);
    }
    let took = 0;
    const hit = new Set<number>();
    // What it took of each nation (PLAN 5.11a: the month's tally).
    const tookOf = new Map<number, number>();
    for (const [t, units] of loss) {
      const lost = applyLoss(world, t, units);
      took += lost;
      hit.add(ec.formation[t]!);
      const struck = fc.nation[ec.formation[t]!]!;
      tookOf.set(struck, (tookOf.get(struck) ?? 0) + lost);
    }
    for (const [struck, n] of [...tookOf].sort((a, b) => a[0] - b[0])) {
      tallyAir(world, 0, fc.nation[id]!, struck, 1, n, s.tx, s.ty);
      addAirTotal(world, struck, 0, n);
    }
    for (const g of [...hit].sort((a, b) => a - b)) {
      // Where its bombs fell, for the view at T3 (PLAN 5.9): the formation, before it may go.
      world.out.emit(world.tick, EventKind.StrikeHit, g, id, fc.x[g]!, fc.y[g]!);
      settleFormation(world, g);
    }
    world.out.emit(world.tick, EventKind.AirStrike, id, took, s.tx, s.ty);
  }
}

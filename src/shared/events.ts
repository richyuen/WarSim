/**
 * Sim events (SPEC §2.3/§2.4): emitted by systems, never part of authoritative state or the
 * hash. Packed as fixed-width f64 records so they travel in pooled transferable buffers.
 */

export const EventKind = {
  /** a = formation id, b = nation, (x, y) = position. */
  FormationSpawned: 1,
  /** a = formation id, b = nation, (x, y) = last position. */
  FormationDestroyed: 2,
  /** a = command seq, b = 0, x = y = NaN (global): the command was carried out. */
  CommandApplied: 3,
  /** a = nation, b = 1 when it goes bankrupt / 0 when it recovers (global). */
  Bankruptcy: 4,
  /** a = production row, b = nation; (x, y) = NaN (global). */
  ProductionQueued: 5,
  /** a = template index, b = nation: not enough gold or manpower, or no such template (global). */
  ProductionRejected: 6,
  /** a = formation id, b = nation (0 where none is known), x = why (`RejectReason`, PLAN 4.9a), y = NaN (global). */
  MoveRejected: 7,
  /** a = formation id, b = nation, (x, y) = arrival position. */
  FormationArrived: 8,
  /** a = losing nation, b = capturer, (x, y) = the captured capital (PLAN 1.15). */
  CapitalCaptured: 9,
  /** a = nation, b = new capital city row (0 = a plain cell), (x, y) = new capital. */
  CapitalMoved: 10,
  /** a = nation (global). */
  NationEliminated: 11,
  /** a = attacker, b = defender (global; PLAN 1.16). */
  WarDeclared: 12,
  /** a = attacker, b = defender: dead, self, already at war, truce or puppet pair (global). */
  WarRejected: 13,
  /** a = winning leader, b = losing leader (global). */
  PeaceSigned: 14,
  /** a = nation, b = alliance id (global; PLAN 1.17). */
  AllianceLeft: 15,
  /** a = alliance id, b = last leader (global). */
  AllianceDissolved: 16,
  /** a = alliance id, b = leader (global). */
  UnionFormed: 17,
  /** a = nation, b = alliance id (global). */
  AllianceJoined: 18,
  /** a = puppet, b = overlord (global; PLAN 1.18). */
  PuppetCreated: 19,
  /** a = puppet, b = former overlord: released or left freely (global). */
  PuppetReleased: 20,
  /** a = puppet, b = overlord: loyalty broke, war of independence (global). */
  PuppetRevolt: 21,
  /** a = puppet, b = overlord: annexed by integration (global). */
  PuppetIntegrated: 22,
  /** a = rebel nation, b = former holder, (x, y) = rebel capital (PLAN 1.19). */
  RevoltSpawned: 23,
  /** a = nation, b = revivals left, (x, y) = its new capital (PLAN 1.20). */
  NationRevived: 24,
  /** a = nation (global). */
  NationCollapsed: 25,
  /** a = buff id, b = target (global; PLAN 1.21). */
  BuffGranted: 26,
  /** a = buff id, b = target: expired or removed (global). */
  BuffExpired: 27,
  /** a = Major Battle id, b = nearest city row, (x, y) = battle centre (PLAN 1.23). */
  MajorBattleStarted: 28,
  /** a = Major Battle id, b = winning nation (0 = none), (x, y) = battle centre. */
  MajorBattleEnded: 29,
  /** a = war id, b = the nation whose peace offer was refused (PLAN 1.33b). */
  PeaceRejected: 30,
  /** a = proposer, b = the nation that refused the alliance (PLAN 1.33b). */
  AllianceRejected: 31,
  /** a = annexed nation, b = annexer (global; PLAN 1.36 editor / God). */
  NationAnnexed: 32,
  /** a = city row, b = nation holding it, (x, y) = city (PLAN 1.36 editor). */
  CitySpawned: 33,
  /**
   * An element's strength reached 0 (combat, attrition, desertion; PLAN 2.4b): a = element id,
   * b = its unit index, (x, y) = the slot it stood in. In a snapshot b is the `Wreck` its class
   * leaves (`shared/unitLooks`; the view has no unit rules), and only a view that draws elements
   * gets the event.
   */
  ElementDestroyed: 34,
  /**
   * a = nation, b = how many of its formations the economic AI disbanded this month because the
   * treasury could not carry them (global; PLAN 2.13). Each of them also has its
   * `FormationDestroyed`.
   */
  FormationsDisbanded: 35,
  /**
   * Land changed hands without a war and without a new state (PLAN 2.15d): a restless conquest
   * went back to its living core nation, or a God Mode Kill handed land to a core nation, a
   * claimant, a neighbour or the heir. Or a nation died, and what a living nation occupied of
   * its land became that nation's (PLAN 2.16Rf). a = who received it, b = who held it, (x, y) =
   * its middle.
   */
  LandCeded: 36,
  /** a = command seq, b = why (`Refusal`, shared/commands), x = y = NaN (global): the command was not carried out (PLAN 2.17a). */
  CommandRefused: 37,
  /** a = nation, b = tech (index into the scenario's techs): it knows the tech now (global; PLAN 3.1b). */
  TechResearched: 38,
  /** a = formation id, b = nation, (x, y) = where it broke off: with little org it leaves its battle (PLAN 3.5a). */
  FormationRetreated: 39,
  /**
   * A war ended with no peace signed (PLAN 3.12Rn): b, the last of its side, got a bond with a
   * nation of the other side (an overlord at a peace, or a new one when its overlord was annexed)
   * and left it. a = the leader of the side that stayed, b = the nation that left (global).
   */
  WarEnded: 40,
  /**
   * A sea battle ended (PLAN 4.3c): a and b are its two sides, each its first nation and the
   * ships the side lost, as nation + SIDE_SHIPS × ships (`seaSide`, shared/history); (x, y) =
   * where it began.
   */
  SeaBattle: 41,
  /** A nation's submarines raided a bloc's convoys in a month (PLAN 4.4d): a = the raiders' nation, b = the bloc raided; (x, y) = the middle of the zone. */
  ConvoyRaided: 42,
  /** A land formation went aboard its nation's transports (PLAN 4.5a): a = formation, b = nation, (x, y) = the port. */
  FormationEmbarked: 43,
  /** An embarked formation landed (PLAN 4.5a): a = formation, b = nation, (x, y) = where. */
  FormationLanded: 44,
  /** A landing was thrown back (PLAN 4.5b): the sea about it held by an enemy; a = formation, b = the zone's holder, (x, y) = the landing water. */
  LandingRepulsed: 45,
  /** A nation short of money laid up fleets in a month (PLAN 4.6e1): a = nation, b = how many. */
  FleetsLaidUp: 46,
  /** An hour's air fight in an air zone (PLAN 5.3a): a = the zone, b = the aircraft lost in it, both sides; (x, y) = a sortie's place in it. */
  AirBattle: 47,
  /** A strike sortie hit its target (PLAN 5.4b): a = the wing, b = the men, guns and vehicles it took; (x, y) = its target. */
  AirStrike: 48,
  /** A sortie fired on by AA in an hour (PLAN 5.7b): a = the wing, b = its nation; (x, y) = its place. Drawn as flak. */
  FlakFired: 49,
  /** A strike's bombs on a formation (PLAN 5.9): a = the formation hit, b = the wing; (x, y) = the formation's place. Drawn at T3 over its men. */
  StrikeHit: 50,
  /**
   * A month's air war of two nations (PLAN 5.11a, `airMonth`): their fights with losses, each the
   * leader of its side in them; a and b each its nation and the aircraft it lost, as nation +
   * SIDE_SHIPS × aircraft (`seaSide`); (x, y) = its first such fight of the month. Global.
   */
  AirWar: 51,
  /**
   * A month's strikes of a nation on another (PLAN 5.11a): a = the striker; b = the nation struck
   * and the men, guns and vehicles it lost, as nation + SIDE_SHIPS × them; (x, y) = the first.
   */
  AirRaids: 52,
  /** A warhead launched (PLAN 6.2): a = the nation, b = 1 by missile, 0 by bomber; (x, y) = its target. */
  NukeLaunched: 53,
  /** A warhead's bomber stopped short of its target (PLAN 6.2): a = the nation, b = the launch's id; (x, y) = the target. */
  NukeIntercepted: 54,
  /** A warhead burst at its target (PLAN 6.2; its effects PLAN 6.3): a = the nation, b = its yield (1, 2 thermonuclear); (x, y) = where. */
  NukeDetonated: 55,
  /**
   * A warhead's toll (PLAN 6.3a), the strike's history entry (PLAN 6.5a): a = the striker, b = the
   * nation whose land it burst on, its yield and the dead (men and people), packed (`nukeStrike`
   * in shared/history.ts); (x, y) = where it burst.
   */
  NukeCasualties: 56,
  /** An AI's decision to strike (PLAN 6.4b), in the history (PLAN 6.7): a = the nation, b = round(its utility × 1000); (x, y) = the target. */
  NukeDecided: 57,
  /**
   * What a burst destroyed of the forces there (PLAN 7.32b), logged right after its
   * `NukeCasualties`: a = the striker, b = the men, guns and tanks, packed (`nukeToll` in
   * shared/history.ts); (x, y) = where it burst. The history reads it into the strike's row.
   */
  NukeToll: 58,
} as const;
export type EventKind = (typeof EventKind)[keyof typeof EventKind];

/** Why a formation's order was refused (`MoveRejected`'s x, PLAN 4.9a). */
export const RejectReason = {
  /** Aboard transports: it takes no order until it lands. */
  Aboard: 1,
  /** No formation of the order's kind (none, a fleet ordered to march, an army to sail), or a target off the map. */
  NotLand: 2,
  /** No way by land that keeps off the ground of nations outside its wars. */
  NoRoute: 3,
  /** A march barred on its way: the next cell became ground closed to it. */
  Barred: 4,
  /** Over the sea: it stands at no port its nation holds. */
  NoPort: 5,
  /** Over the sea: no transports of its nation at that port, standing, with room for it. */
  NoTransports: 6,
  /** Over the sea: no water near the target, or no land of the target's by it. */
  NoLanding: 7,
  /** Over the sea, or a fleet's order: no way over the water (the ice, a shut passage, no lane). */
  NoSeaWay: 8,
  /** A fleet's order to a place that is no water and no port. */
  NotWater: 9,
  /** An air wing's order beyond its range from its base (PLAN 5.1e). */
  OutOfRange: 10,
  /** An air wing's rebase: no airbase of its side and no carrier of its nation there with room for it (PLAN 5.1e). */
  NoBase: 11,
  /** A paradrop (PLAN 5.8u2): no transport wings of its nation, on the ground at an airbase it stands at, can lift it now (or it is in contact). */
  NoAirlift: 12,
  /** The AI's order (PLAN 1.42h, ADR-422): the way there is several times the straight line (`LONG_WAY`). */
  LongWay: 13,
} as const;
export type RejectReason = (typeof RejectReason)[keyof typeof RejectReason];

/** Record layout: [seq, tick, kind, a, b, x, y]. */
export const EVENT_STRIDE = 7;

export interface SimEvent {
  seq: number;
  tick: number;
  kind: EventKind;
  a: number;
  b: number;
  /** NaN for global (non-spatial) events, which are always delivered. */
  x: number;
  y: number;
}

/**
 * Fire events (SPEC §5.2 step 5): one record per volley, emitted by combat into
 * `TickOutputs.fires`. Like the events above they are never state and never hashed.
 * Record layout: [tick, subtick, shooter, target, unit, dmg, x0, y0, x1, y1], shooter and target
 * being element ids and the points their slot poses. In a snapshot the `unit` slot carries the
 * `Weapon` of the shooter's class (`shared/unitLooks`; the view has no unit rules).
 */
/** A fire record (`World.out.fires`): FIRE_STRIDE numbers, by `FireField`. In the sim's records the weapon field is the shooter's unit type, −1 − the type for a torpedo (PLAN 4.7c); the worker sends a `Weapon` there. */
export const FIRE_STRIDE = 10;
export const FireField = { tick: 0, subtick: 1, shooter: 2, target: 3, weapon: 4, dmg: 5, x0: 6, y0: 7, x1: 8, y1: 9 } as const;

/**
 * The fire records of the sim (`World.out.fires`): `length` numbers in `data`, FIRE_STRIDE a
 * record; `length = 0` empties it and keeps the buffer. PLAN 7.1e: a `number[]` emptied each
 * hour gave its buffer back and grew it again from nothing, 0.5 s of combat's 6 in a year of
 * seed 99. Read `data` below `length`, or a copy (`slice`).
 */
export class FireLog {
  data = new Float64Array(FIRE_STRIDE * 256);
  length = 0;

  push(tick: number, subtick: number, shooter: number, target: number, weapon: number, dmg: number, x0: number, y0: number, x1: number, y1: number): void {
    let d = this.data;
    const i = this.length;
    if (i + FIRE_STRIDE > d.length) {
      d = new Float64Array(2 * d.length);
      d.set(this.data);
      this.data = d;
    }
    d[i] = tick;
    d[i + 1] = subtick;
    d[i + 2] = shooter;
    d[i + 3] = target;
    d[i + 4] = weapon;
    d[i + 5] = dmg;
    d[i + 6] = x0;
    d[i + 7] = y0;
    d[i + 8] = x1;
    d[i + 9] = y1;
    this.length = i + FIRE_STRIDE;
  }

  /** The records as numbers, a copy. */
  slice(): number[] {
    return Array.from(this.data.subarray(0, this.length));
  }
}

export function readEvent(buf: Float64Array, i: number): SimEvent {
  const o = i * EVENT_STRIDE;
  return {
    seq: buf[o]!,
    tick: buf[o + 1]!,
    kind: buf[o + 2]! as EventKind,
    a: buf[o + 3]!,
    b: buf[o + 4]!,
    x: buf[o + 5]!,
    y: buf[o + 6]!,
  };
}

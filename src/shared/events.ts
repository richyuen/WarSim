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
  /** a = formation id, b = nation: no land route to the ordered target (global). */
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
} as const;
export type EventKind = (typeof EventKind)[keyof typeof EventKind];

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
export const FIRE_STRIDE = 10;
export const FireField = { tick: 0, subtick: 1, shooter: 2, target: 3, weapon: 4, dmg: 5, x0: 6, y0: 7, x1: 8, y1: 9 } as const;

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

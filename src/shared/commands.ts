/**
 * Commands: the only way anything outside the sim changes sim state (SPEC §2.3).
 * A command is queued, applied at the next tick boundary in arrival order, stamped with that
 * tick and appended to the command log, so a save + log replays bit-identically.
 */

export type Command =
  /**
   * Place a formation at (x, y). With `template` (an index of the scenario's templates) it has
   * that template's elements, is in supply, and its strength is theirs: `strength` is then
   * ignored (PLAN 2.5). Without it, or in a scenario without unit rules, a bare formation of
   * `strength` men that has no elements and does not fight.
   */
  | { kind: 'spawnFormation'; nation: number; x: number; y: number; strength: number; template?: number }
  | { kind: 'removeFormation'; id: number }
  /** Queue a formation of scenario template `template` (index) for `nation` (PLAN 1.10). */
  | { kind: 'queueFormation'; nation: number; template: number }
  /**
   * Order formation `id` to march to cell (x, y) over land (PLAN 1.11). With `nation`: only
   * when the formation is that nation's (a player's order; an id is given out again, PLAN 2.16Rk).
   */
  | { kind: 'moveFormation'; id: number; x: number; y: number; nation?: number }
  /** Global sim setting (PLAN 1.15): capturing a capital annexes the loser's territory. */
  | { kind: 'setSetting'; key: 'winnerTakesAll'; value: boolean }
  /** PLAN 1.19: revolts take one province or a restless region. */
  | { kind: 'setSetting'; key: 'revoltMode'; value: 'province' | 'region' }
  /** PLAN 1.22: combat-efficiency mode. */
  | { kind: 'setSetting'; key: 'ceMode'; value: 'dynamic' | 'progressive' | 'static' | 'locked' | 'random' }
  /** PLAN 1.24 God Mode: the strategic AI for all nations. */
  | { kind: 'setSetting'; key: 'aiEnabled'; value: boolean }
  /** God Mode: set a nation's CE; lock or unlock it (a locked CE never changes). */
  | { kind: 'setEfficiency'; nation: number; value: number }
  | { kind: 'lockEfficiency'; nation: number; locked: boolean }
  /** PLAN 1.19: revolt suppression level 0..1 (God Mode / AI budget). */
  | { kind: 'setSuppression'; nation: number; level: number }
  /** God Mode: set a province's unrest 0..100. */
  | { kind: 'setUnrest'; province: number; value: number }
  /** PLAN 1.20 God Mode: revive a dead nation on its cores; collapse ("Kill") a living one. */
  | { kind: 'reviveNation'; nation: number }
  /** PLAN 1.21 (God Mode, events): a timed buff/debuff lasting `hours` from the tick applied. */
  | { kind: 'grantBuff'; targetKind: 'nation' | 'formation' | 'province'; target: number; buff: 'income' | 'manpower' | 'attack' | 'defense' | 'speed' | 'unrest'; magnitude: number; hours: number; nameKey: string }
  | { kind: 'removeBuff'; id: number }
  /** PLAN 1.24 God Mode: switch a nation's AI on or off. */
  | { kind: 'setAi'; nation: number; enabled: boolean }
  /** PLAN 1.23 God Mode: a custom Major Battle won by `nation`: a corridor from (x, y) to (toX, toY). */
  | { kind: 'forceBreakthrough'; nation: number; x: number; y: number; toX: number; toY: number }
  | { kind: 'collapseNation'; nation: number }
  /**
   * God Mode territory brush (PLAN 1.15): `nation` controls land cells within r of (x, y); with
   * `x2, y2`, within r of the segment to that point (the brush dragged, PLAN 1.44b).
   */
  | { kind: 'paintControl'; nation: number; x: number; y: number; r: number; x2?: number; y2?: number }
  /** PLAN 1.16: `attacker` declares war on `defender` (each brings its puppets). */
  | { kind: 'declareWar'; attacker: number; defender: number }
  /** God Mode: conclude war `war` now on its current score. */
  | { kind: 'forcePeace'; war: number }
  /** God Mode "To Death": side 0 = attackers, 1 = defenders. */
  | { kind: 'setWarFightToDeath'; war: number; side: 0 | 1; value: boolean }
  /** PLAN 1.17: a new alliance led by `leader` with `members` (none may already be allied). */
  | { kind: 'createAlliance'; leader: number; members: number[]; nameKey: string }
  | { kind: 'joinAlliance'; nation: number; alliance: number }
  | { kind: 'leaveAlliance'; nation: number }
  /** God Mode edits. */
  | { kind: 'setUnity'; alliance: number; value: number }
  | { kind: 'setLoyalty'; nation: number; value: number }
  /** PLAN 1.18 (God Mode / AI): puppets. */
  | { kind: 'createPuppet'; overlord: number; subject: number; autonomy: number }
  | { kind: 'releasePuppet'; subject: number }
  | { kind: 'setAutonomy'; subject: number; value: number }
  | { kind: 'setPuppetLoyalty'; subject: number; value: number }
  /** PLAN 1.32 God Mode: rename a nation ('' restores its scenario name, or that of the province it was founded in; refused for a nation with neither). */
  | { kind: 'renameNation'; nation: number; name: string }
  /** PLAN 1.32 God Mode: province `province` revolts now (its area per `revoltMode`). */
  | { kind: 'spawnRevolt'; province: number }
  /** PLAN 1.32 God Mode: AoC-style income bonus, percent −100..100. */
  | { kind: 'setIncomeBonus'; nation: number; value: number }
  /** PLAN 1.33b player diplomacy: offers that the other side may refuse. */
  | { kind: 'offerPeace'; war: number; from: number }
  | { kind: 'proposeAlliance'; from: number; to: number }
  /** PLAN 1.33: the player takes control of `nation` (0 = release): its AI goes off, the previous one's back on. */
  | { kind: 'setPlayer'; nation: number }
  /**
   * PLAN 1.35 editor: paint `value` (nation id, 0 = unowned; or a land terrain class) with a tool;
   * `x2, y2` end a line; `mask` limits it to cells of one terrain or nation. Undoable.
   * `stroke` (PLAN 1.44, a brush dragged over the map): `start` opens a stroke and `more`
   * continues it, and the whole stroke is one undo step.
   */
  | {
      kind: 'editPaint';
      layer: 'nation' | 'terrain';
      tool: 'brush' | 'line' | 'bucket';
      x: number;
      y: number;
      x2: number;
      y2: number;
      r: number;
      value: number;
      mask: { kind: 'terrain' | 'nation'; value: number } | null;
      stroke?: 'start' | 'more';
    }
  /** PLAN 1.37a map import: a whole layer as runs [value, count, …] covering every cell. */
  | { kind: 'importLayer'; layer: 'nation' | 'terrain'; runs: number[] }
  | { kind: 'editUndo' }
  | { kind: 'editRedo' }
  /** PLAN 1.36 scenario editing. */
  | { kind: 'spawnCity'; x: number; y: number; name: string; size: number }
  | { kind: 'removeCity'; city: number }
  | { kind: 'setCapital'; nation: number; city: number }
  | { kind: 'setGold'; nation: number; value: number }
  /** Core (or claim) of `nation` on `province`; a dead nation's claim presets a revolt. */
  | { kind: 'setCore'; province: number; nation: number; on: boolean }
  | { kind: 'annexNation'; annexer: number; target: number }
  /** PLAN 1.37b: a 36×24 pixel flag as runs [rgb, count, …]; empty runs restore the scenario flag. */
  | { kind: 'setFlag'; nation: number; runs: number[] };

/**
 * Every kind of command, held to the `Command` type by the compiler: a kind added to the type
 * without a line here does not compile, nor does a line here without a kind (PLAN 2.12b).
 */
export const COMMAND_KINDS: Record<Command['kind'], true> = {
  spawnFormation: true,
  removeFormation: true,
  queueFormation: true,
  moveFormation: true,
  setSetting: true,
  setEfficiency: true,
  lockEfficiency: true,
  setSuppression: true,
  setUnrest: true,
  reviveNation: true,
  grantBuff: true,
  removeBuff: true,
  setAi: true,
  forceBreakthrough: true,
  collapseNation: true,
  paintControl: true,
  declareWar: true,
  forcePeace: true,
  setWarFightToDeath: true,
  createAlliance: true,
  joinAlliance: true,
  leaveAlliance: true,
  setUnity: true,
  setLoyalty: true,
  createPuppet: true,
  releasePuppet: true,
  setAutonomy: true,
  setPuppetLoyalty: true,
  renameNation: true,
  spawnRevolt: true,
  setIncomeBonus: true,
  offerPeace: true,
  proposeAlliance: true,
  setPlayer: true,
  editPaint: true,
  importLayer: true,
  editUndo: true,
  editRedo: true,
  spawnCity: true,
  removeCity: true,
  setCapital: true,
  setGold: true,
  setCore: true,
  annexNation: true,
  setFlag: true,
};

/**
 * Whether `cmd` is a command of a kind the sim knows. What comes from outside the types (a
 * worker message, a page's test API) is asked this before it is queued: a command of another
 * kind was applied as nothing, and its sequence number and its line in the command log are
 * state (PLAN 2.12b). Its fields are not looked at: each kind's handler checks its own.
 */
export function isCommand(cmd: unknown): cmd is Command {
  if (typeof cmd !== 'object' || cmd === null) return false;
  const kind = (cmd as { kind?: unknown }).kind;
  return typeof kind === 'string' && Object.hasOwn(COMMAND_KINDS, kind);
}

/**
 * Why a command was not carried out (PLAN 2.17a): the `b` of `EventKind.CommandRefused`. 0 is
 * "carried out". A refused command changes nothing but the command log, which has its line.
 */
export const Refusal = {
  None: 0,
  /** A number in the command is NaN or infinite. */
  NotANumber: 1,
  /** A nation the command names is not in the world. */
  NoNation: 2,
  /** A nation the command names is dead. */
  DeadNation: 3,
  /** Both sides of the command are the same nation. */
  SameNation: 4,
  /** The two are at war, or the nation is at war with a member of the alliance. */
  AtWar: 5,
  Truce: 6,
  /** One is the other's puppet. */
  Subject: 7,
  /** Allies do not go to war. */
  Allied: 8,
  /** A nation the command would ally is in an alliance already. */
  InAlliance: 9,
  /** The nation is in no alliance. */
  NoAlliance: 10,
  /** No such war, alliance, province, formation, city or buff. */
  NoSuch: 11,
  /** Nothing to do it with: a revolt of a province that has no holder. */
  NoEffect: 12,
  /** A Kill of the only living nation, which owns the centre of no province: nobody its land could go to. */
  LastNation: 13,
  /** A revival of a nation that lives. */
  Alive: 14,
  /** A revival of a nation that has returned as often as one may. */
  NoRevivals: 15,
  /** A revival before the cooldown after the nation's death is over. */
  Cooldown: 16,
  /** A revival of a nation with a core on no province that another nation holds. */
  NoCoreLand: 17,
  /** An empty rename of a nation that has no name but the one it would lose (a world without a nation table). */
  NoOtherName: 18,
  /** An order to a formation on the retreat: it takes none until the retreat is over (PLAN 3.7m, ADR-173). */
  OnRetreat: 19,
  /** Both are puppets of one overlord (PLAN 3.8). */
  SameOverlord: 20,
  /** One, or its overlord, is the ally of the other or of its overlord (PLAN 3.8). */
  AlliedRealm: 21,
  /** A formation spawned on a cell that is water, or off the map: no route begins there (PLAN 3.12Rq, ADR-228). */
  AtSea: 22,
  /** A war by or on a nation with 75% of its land under occupiers: it would be over at once (PLAN 3.12Rr1, ADR-229). */
  Overrun: 23,
  /** A spawn of a fleet's template: the command puts a formation on land (PLAN 4.2a). */
  NotOfLand: 24,
} as const;
export type Refusal = (typeof Refusal)[keyof typeof Refusal];

/** Whether every number in `cmd` is finite: a NaN is not state, and JSON writes it as null (the command log). */
export function finiteCommand(cmd: Command): boolean {
  const ok = (v: unknown): boolean => {
    if (typeof v === 'number') return Number.isFinite(v);
    if (Array.isArray(v)) return v.every(ok);
    if (typeof v === 'object' && v !== null) return Object.values(v).every(ok);
    return true;
  };
  return ok(cmd);
}

export interface LoggedCommand {
  /** Tick at which the command was applied. */
  tick: number;
  /** Arrival sequence number (global, monotonic). */
  seq: number;
  cmd: Command;
}

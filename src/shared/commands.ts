/**
 * Commands: the only way anything outside the sim changes sim state (SPEC §2.3).
 * A command is queued, applied at the next tick boundary in arrival order, stamped with that
 * tick and appended to the command log, so a save + log replays bit-identically.
 */

export type Command =
  | { kind: 'spawnFormation'; nation: number; x: number; y: number; strength: number }
  | { kind: 'removeFormation'; id: number }
  /** Queue a formation of scenario template `template` (index) for `nation` (PLAN 1.10). */
  | { kind: 'queueFormation'; nation: number; template: number }
  /** Order formation `id` to march to cell (x, y) over land (PLAN 1.11). */
  | { kind: 'moveFormation'; id: number; x: number; y: number }
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
  /** God Mode territory brush (PLAN 1.15): `nation` controls land cells within r of (x, y). */
  | { kind: 'paintControl'; nation: number; x: number; y: number; r: number }
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
  /** PLAN 1.32 God Mode: rename a nation ('' restores its scenario name). */
  | { kind: 'renameNation'; nation: number; name: string }
  /** PLAN 1.32 God Mode: province `province` revolts now (its area per `revoltMode`). */
  | { kind: 'spawnRevolt'; province: number }
  /** PLAN 1.32 God Mode: AoC-style income bonus, percent −100..100. */
  | { kind: 'setIncomeBonus'; nation: number; value: number }
  /** PLAN 1.33b player diplomacy: offers that the other side may refuse. */
  | { kind: 'offerPeace'; war: number; from: number }
  | { kind: 'proposeAlliance'; from: number; to: number };

export interface LoggedCommand {
  /** Tick at which the command was applied. */
  tick: number;
  /** Arrival sequence number (global, monotonic). */
  seq: number;
  cmd: Command;
}

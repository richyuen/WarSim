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
  /** God Mode territory brush (PLAN 1.15): `nation` controls land cells within r of (x, y). */
  | { kind: 'paintControl'; nation: number; x: number; y: number; r: number };

export interface LoggedCommand {
  /** Tick at which the command was applied. */
  tick: number;
  /** Arrival sequence number (global, monotonic). */
  seq: number;
  cmd: Command;
}

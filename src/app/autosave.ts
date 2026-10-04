/**
 * Autosave to IndexedDB (PLAN 1.27). The app asks the sim worker for its save bytes, gzips them
 * and keeps one record per slot in database `warsim`, store `saves`. Autosaves run every
 * AUTOSAVE_SECONDS of real time while the game is running, and when the page is hidden. Booting
 * with `?continue=1` restores the autosave of the same scenario; the title screen offers it as
 * Continue (PLAN 1.43b).
 */
import type { GameOptions } from '../shared/gameOptions';
import { packSave, unpackSave } from '../shared/saveCodec';
import type { ScenarioId } from '../shared/protocol';
import { getRecord, putRecord } from './saveDb';
import type { SimClient } from './simClient';

export const AUTOSAVE_SECONDS = 60;
const SLOT = 'autosave';

/** The seed and new-game options of a game: with its scenario, what its URL carries. */
export interface GameSetup {
  seed: number;
  options: GameOptions;
}

export interface SaveRecord extends Partial<GameSetup> {
  slot: string;
  scenario: ScenarioId;
  tick: number;
  /** Wall-clock time of the save (app side; never enters the sim). */
  savedAt: number;
  bytes: Uint8Array;
}

/** The stored autosave, if any. It needs no running game (the title screen reads it). */
export function readAutosave(): Promise<SaveRecord | undefined> {
  return getRecord<SaveRecord>(SLOT);
}

export class Autosave {
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Last successful autosave (for tests and the UI). */
  last: { tick: number; bytes: number } | null = null;

  /** `setup` gives the game's seed and options at the time of a save (they go into the record). */
  constructor(
    private readonly sim: SimClient,
    private readonly scenario: ScenarioId,
    private readonly setup: () => GameSetup,
  ) {}

  /** Saves now; resolves with the record's tick. */
  async saveNow(): Promise<number> {
    const { bytes: raw, status } = await this.sim.saveWithStatus();
    const bytes = await packSave(raw);
    const rec: SaveRecord = { slot: SLOT, scenario: this.scenario, tick: status.tick, savedAt: Date.now(), bytes, ...this.setup() };
    await putRecord(rec);
    this.last = { tick: status.tick, bytes: bytes.length };
    return status.tick;
  }

  /** The stored autosave, if any. */
  read(): Promise<SaveRecord | undefined> {
    return readAutosave();
  }

  /** Loads the stored autosave into the sim if it belongs to this scenario; returns its tick. */
  async restore(): Promise<number | null> {
    const rec = await this.read();
    if (!rec || rec.scenario !== this.scenario) return null;
    await this.sim.load(await unpackSave(rec.bytes));
    return rec.tick;
  }

  /** Periodic autosaves while `running()` is true, plus one when the page is hidden. */
  start(running: () => boolean): void {
    this.timer ??= setInterval(() => {
      if (running()) void this.saveNow().catch(() => {});
    }, AUTOSAVE_SECONDS * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.saveNow().catch(() => {});
    });
  }
}

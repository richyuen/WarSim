/**
 * Autosave to IndexedDB (PLAN 1.27). The app asks the sim worker for its save bytes, gzips them
 * and keeps one record per slot in database `warsim`, store `saves`. Autosaves run every
 * AUTOSAVE_SECONDS of real time while the game is running, and when the page is hidden. Booting
 * with `?continue=1` restores the autosave of the same scenario.
 */
import { packSave, unpackSave } from '../shared/saveCodec';
import type { ScenarioId } from '../shared/protocol';
import type { SimClient } from './simClient';

export const AUTOSAVE_SECONDS = 60;
const DB = 'warsim';
const STORE = 'saves';
const SLOT = 'autosave';

export interface SaveRecord {
  slot: string;
  scenario: ScenarioId;
  tick: number;
  /** Wall-clock time of the save (app side; never enters the sim). */
  savedAt: number;
  bytes: Uint8Array;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'slot' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('indexedDB request failed'));
    });
  } finally {
    db.close();
  }
}

export class Autosave {
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Last successful autosave (for tests and the UI). */
  last: { tick: number; bytes: number } | null = null;

  constructor(
    private readonly sim: SimClient,
    private readonly scenario: ScenarioId,
  ) {}

  /** Saves now; resolves with the record's tick. */
  async saveNow(): Promise<number> {
    const { bytes: raw, status } = await this.sim.saveWithStatus();
    const bytes = await packSave(raw);
    const rec: SaveRecord = { slot: SLOT, scenario: this.scenario, tick: status.tick, savedAt: Date.now(), bytes };
    await tx('readwrite', (s) => s.put(rec));
    this.last = { tick: status.tick, bytes: bytes.length };
    return status.tick;
  }

  /** The stored autosave, if any. */
  async read(): Promise<SaveRecord | undefined> {
    return tx<SaveRecord | undefined>('readonly', (s) => s.get(SLOT) as IDBRequest<SaveRecord | undefined>);
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

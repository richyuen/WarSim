/**
 * The app's IndexedDB store (PLAN 1.27): database `warsim`, store `saves`, one record per slot.
 * Slots: `autosave` (autosave.ts) and `scenario` (a scenario file on its way from the title
 * screen into its game, scenarioFiles.ts).
 */
const DB = 'warsim';
const STORE = 'saves';

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

/** The record in `slot`, if any. */
export function getRecord<T extends { slot: string }>(slot: string): Promise<T | undefined> {
  return tx<T | undefined>('readonly', (s) => s.get(slot) as IDBRequest<T | undefined>);
}

/** Stores `rec` in its slot, replacing what was there. */
export async function putRecord(rec: { slot: string }): Promise<void> {
  await tx('readwrite', (s) => s.put(rec));
}

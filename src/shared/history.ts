/**
 * History log rows for the UI and exports (PLAN 1.34a): what `a` and `b` mean per event kind,
 * the i18n message per kind, and the row shape the worker sends (names already resolved to
 * i18n keys or '=' + literal).
 */
import { dateOfTick } from './calendar';
import { EventKind } from './events';

export type HistoryRole = 'nation' | 'alliance' | 'battle' | 'city' | 'number';

/** Roles of a and b per historic kind. */
export const HISTORY_ROLES: Readonly<Record<number, readonly [HistoryRole, HistoryRole]>> = {
  [EventKind.Bankruptcy]: ['nation', 'number'],
  [EventKind.CapitalCaptured]: ['nation', 'nation'],
  [EventKind.NationEliminated]: ['nation', 'number'],
  [EventKind.WarDeclared]: ['nation', 'nation'],
  [EventKind.PeaceSigned]: ['nation', 'nation'],
  [EventKind.AllianceLeft]: ['nation', 'alliance'],
  [EventKind.AllianceDissolved]: ['alliance', 'nation'],
  [EventKind.UnionFormed]: ['alliance', 'nation'],
  [EventKind.AllianceJoined]: ['nation', 'alliance'],
  [EventKind.PuppetCreated]: ['nation', 'nation'],
  [EventKind.PuppetReleased]: ['nation', 'nation'],
  [EventKind.PuppetRevolt]: ['nation', 'nation'],
  [EventKind.PuppetIntegrated]: ['nation', 'nation'],
  [EventKind.RevoltSpawned]: ['nation', 'nation'],
  [EventKind.NationRevived]: ['nation', 'number'],
  [EventKind.NationCollapsed]: ['nation', 'number'],
  [EventKind.MajorBattleStarted]: ['battle', 'city'],
  [EventKind.MajorBattleEnded]: ['battle', 'nation'],
  [EventKind.NationAnnexed]: ['nation', 'nation'],
};

/** Stable English type name of a kind (filters, CSV/JSON `type`). */
export function kindName(kind: number): string {
  for (const [k, v] of Object.entries(EventKind)) if (v === kind) return k;
  return `Kind${kind}`;
}

/** A history row as sent by the worker: names of a and b resolved (i18n key or '=' + literal; '' if none). */
export interface HistoryRow {
  tick: number;
  kind: number;
  a: number;
  b: number;
  x: number | null;
  y: number | null;
  an: string;
  bn: string;
}

export interface HistoryFilter {
  /** Event kind (null = all). */
  kind: number | null;
  /** Nation id appearing as a or b in a nation role (null = all). */
  nation: number | null;
  /** Inclusive year range (null = open). */
  fromYear: number | null;
  toYear: number | null;
}

export const NO_FILTER: HistoryFilter = { kind: null, nation: null, fromYear: null, toYear: null };

/** Rows matching `f`; `startDay` dates the ticks. Order is kept. */
export function filterHistory(rows: readonly HistoryRow[], f: HistoryFilter, startDay: number): HistoryRow[] {
  return rows.filter((r) => {
    if (f.kind !== null && r.kind !== f.kind) return false;
    if (f.nation !== null) {
      const [ra, rb] = HISTORY_ROLES[r.kind] ?? ['number', 'number'];
      if (!((ra === 'nation' && r.a === f.nation) || (rb === 'nation' && r.b === f.nation))) return false;
    }
    if (f.fromYear !== null || f.toYear !== null) {
      const y = dateOfTick(startDay, r.tick).year;
      if (f.fromYear !== null && y < f.fromYear) return false;
      if (f.toYear !== null && y > f.toYear) return false;
    }
    return true;
  });
}

/** ISO date (YYYY-MM-DD) of a tick. */
export function isoDate(startDay: number, tick: number): string {
  const d = dateOfTick(startDay, tick);
  const p = (n: number, w: number): string => String(n).padStart(w, '0');
  return `${p(d.year, 4)}-${p(d.month, 2)}-${p(d.day, 2)}`;
}

/** Export record: date, tick, type name, a/b ids and display names, and the rendered text. */
export interface HistoryExport {
  date: string;
  tick: number;
  type: string;
  a: number;
  aName: string;
  b: number;
  bName: string;
  text: string;
}

export function toExport(rows: readonly HistoryRow[], startDay: number, display: (key: string) => string, text: (r: HistoryRow) => string): HistoryExport[] {
  return rows.map((r) => ({ date: isoDate(startDay, r.tick), tick: r.tick, type: kindName(r.kind), a: r.a, aName: r.an ? display(r.an) : '', b: r.b, bName: r.bn ? display(r.bn) : '', text: text(r) }));
}

const CSV_COLUMNS = ['date', 'tick', 'type', 'a', 'aName', 'b', 'bName', 'text'] as const;

/** RFC 4180 CSV with a header row (fields quoted when they contain `"`, `,` or a newline). */
export function toCsv(records: readonly HistoryExport[]): string {
  const q = (v: string | number): string => {
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [CSV_COLUMNS.join(','), ...records.map((r) => CSV_COLUMNS.map((c) => q(r[c])).join(','))].join('\r\n') + '\r\n';
}

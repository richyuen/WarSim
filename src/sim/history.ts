/**
 * History log (SPEC §9, PLAN 1.34a): every event of a historic kind (wars, peace, battles,
 * capital captures, revolts, collapses, revivals, alliances, puppets, bankruptcies) as it is
 * emitted, stored as flat HISTORY_STRIDE records [tick, kind, a, b, x, y]. Emission order is
 * deterministic, so the log is state: saved and hashed like any other part. Saves from before
 * it have no section and start with an empty log.
 */
import { EventKind } from '../shared/events';
import type { Section } from './core/sections';
import type { Stateful } from './core/state';

export const HISTORY_STRIDE = 6;

/** Event kinds kept in the history log. */
export const HISTORY_KINDS: ReadonlySet<number> = new Set<number>([
  EventKind.Bankruptcy,
  EventKind.CapitalCaptured,
  EventKind.NationEliminated,
  EventKind.WarDeclared,
  EventKind.PeaceSigned,
  EventKind.AllianceLeft,
  EventKind.AllianceDissolved,
  EventKind.UnionFormed,
  EventKind.AllianceJoined,
  EventKind.PuppetCreated,
  EventKind.PuppetReleased,
  EventKind.PuppetRevolt,
  EventKind.PuppetIntegrated,
  EventKind.RevoltSpawned,
  EventKind.NationRevived,
  EventKind.NationCollapsed,
  EventKind.MajorBattleStarted,
  EventKind.MajorBattleEnded,
  EventKind.NationAnnexed,
]);

export class History implements Stateful {
  rows: number[] = [];

  get length(): number {
    return this.rows.length / HISTORY_STRIDE;
  }

  record(tick: number, kind: number, a: number, b: number, x: number, y: number): void {
    if (HISTORY_KINDS.has(kind)) this.rows.push(tick, kind, a, b, x, y);
  }

  serialize(): Section[] {
    return [{ name: 'history.rows', dtype: 'f64', data: Float64Array.from(this.rows) }];
  }

  deserialize(sections: readonly Section[]): void {
    const s = sections.find((x) => x.name === 'history.rows');
    this.rows = s ? Array.from(s.data as Float64Array) : [];
  }
}

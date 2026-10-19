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
  EventKind.FormationsDisbanded,
  EventKind.LandCeded,
  EventKind.WarEnded,
  EventKind.SeaBattle,
  EventKind.ConvoyRaided,
  EventKind.AirWar,
  EventKind.AirRaids,
  EventKind.NukeCasualties,
  EventKind.NukeDecided,
  EventKind.NukeToll,
  // God Mode's acts (PLAN 7.33b): a nation set down, a city founded or razed.
  EventKind.NationSpawned,
  EventKind.CitySpawned,
  EventKind.CityRazed,
]);

export class History implements Stateful {
  rows: number[] = [];
  /**
   * The names of the towns the log tells of (PLAN 7.33b), by row number: a city founded, and a
   * city placed in the game and razed. Kept here because the city's row and name go when it is
   * razed, and the row is reused. A razed city of the scenario is named by its definition (the
   * row's a). Saved only when it has a name, so a game without one hashes as before.
   */
  towns = new Map<number, string>();

  get length(): number {
    return this.rows.length / HISTORY_STRIDE;
  }

  record(tick: number, kind: number, a: number, b: number, x: number, y: number): void {
    if (HISTORY_KINDS.has(kind)) this.rows.push(tick, kind, a, b, x, y);
  }

  /** Names the town of the last row (`towns`) when it is of `kind`; called right after its event is emitted. */
  nameLast(kind: number, name: string): void {
    if (this.rows.length > 0 && this.rows[this.rows.length - HISTORY_STRIDE + 1] === kind) this.towns.set(this.length - 1, name);
  }

  serialize(): Section[] {
    const out: Section[] = [{ name: 'history.rows', dtype: 'f64', data: Float64Array.from(this.rows) }];
    if (this.towns.size > 0) {
      const towns = [...this.towns].sort((a, b) => a[0] - b[0]);
      out.push({ name: 'history.towns', dtype: 'u8', data: new TextEncoder().encode(JSON.stringify(towns)) });
    }
    return out;
  }

  deserialize(sections: readonly Section[]): void {
    const s = sections.find((x) => x.name === 'history.rows');
    this.rows = s ? Array.from(s.data as Float64Array) : [];
    const t = sections.find((x) => x.name === 'history.towns');
    this.towns = new Map(t ? (JSON.parse(new TextDecoder().decode(t.data as Uint8Array)) as [number, string][]) : []);
  }
}

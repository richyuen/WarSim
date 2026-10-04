/**
 * Scenario files in the app (PLAN 1.38): export the running world as a `.warsim-scenario`
 * download, and import one into the running sim after checking its base scenario, map size and
 * state hash. A file chosen on the title screen (PLAN 1.43b) is checked there, staged in
 * IndexedDB and loaded by the game that the title screen then navigates to.
 */
import type { ScenarioId } from '../shared/protocol';
import { decodeScenarioFile, encodeScenarioFile, SCENARIO_EXT, SCENARIO_FORMAT, type ScenarioHeader } from '../shared/scenarioFile';
import { SCENARIO_GEOMETRY, scenarioIdOf } from '../shared/scenarios';
import { getRecord, putRecord } from './saveDb';
import type { SimClient } from './simClient';

export async function exportScenarioFile(sim: SimClient, name: string, base: string, w: number, h: number): Promise<{ file: Uint8Array; header: ScenarioHeader }> {
  const { bytes, hash, tick } = await sim.exportScenario();
  const header: ScenarioHeader = { format: SCENARIO_FORMAT, name: name.trim() || 'Untitled', base, w, h, tick, hash };
  return { file: await encodeScenarioFile(header, bytes), header };
}

export function downloadBytes(bytes: Uint8Array, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A file name from the scenario name (letters, digits, dashes). */
export function scenarioFileName(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scenario';
  return `${slug}${SCENARIO_EXT}`;
}

/** Loads a scenario file into the running sim; throws a readable error when it does not fit. */
export async function importScenarioFile(sim: SimClient, file: Uint8Array, base: string, w: number, h: number): Promise<ScenarioHeader> {
  const { header, bytes } = await decodeScenarioFile(file);
  if (header.base !== base || header.w !== w || header.h !== h) throw new Error(`scenario for ${header.base} ${header.w}×${header.h}; this game is ${base} ${w}×${h}`);
  const status = await sim.load(bytes);
  if (status.hash !== header.hash) throw new Error('scenario file damaged: state hash mismatch');
  return header;
}

/** A scenario file between the title screen and its game: the file as chosen, and its base scenario. */
export interface StagedScenario {
  slot: string;
  scenario: ScenarioId;
  name: string;
  bytes: Uint8Array;
}
const STAGED_SLOT = 'scenario';

/**
 * What can be checked of a scenario file without a sim: it unpacks, it is a scenario file of this
 * format, and its base scenario exists here at the file's map size. Throws a readable error
 * otherwise. The state hash is checked when the game loads it (`importScenarioFile`).
 */
export async function checkScenarioFile(file: Uint8Array): Promise<{ header: ScenarioHeader; scenario: ScenarioId }> {
  const { header } = await decodeScenarioFile(file);
  const scenario = scenarioIdOf(header.base);
  if (scenario === null) throw new Error(`scenario for ${header.base}, which this version does not have`);
  const { w, h } = SCENARIO_GEOMETRY[scenario];
  if (header.w !== w || header.h !== h) throw new Error(`scenario for ${header.base} ${header.w}×${header.h}; here ${header.base} is ${w}×${h}`);
  return { header, scenario };
}

/**
 * Checks `file` and keeps it for the game that loads it; returns its base scenario. It stays
 * stored until another file replaces it, so reloading that game starts the scenario again.
 */
export async function stageScenarioFile(file: Uint8Array): Promise<ScenarioId> {
  const { header, scenario } = await checkScenarioFile(file);
  const rec: StagedScenario = { slot: STAGED_SLOT, scenario, name: header.name, bytes: file };
  await putRecord(rec);
  return scenario;
}

/** The staged scenario file, if any. */
export function readStagedScenario(): Promise<StagedScenario | undefined> {
  return getRecord<StagedScenario>(STAGED_SLOT);
}

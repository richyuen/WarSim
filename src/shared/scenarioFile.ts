/**
 * Scenario files (PLAN 1.38, `.warsim-scenario`): shareable starting points. Layout before gzip:
 * the magic line, a JSON header line, then the world's state bytes (`Sim.exportScenario`):
 *
 *   WARSIM-SCENARIO\n{"format":1,"name":…,"base":"1938","w":2048,"h":1024,"tick":…,"hash":…}\n<bytes>
 *
 * `base` and the map size must match the running scenario (its map assets); `hash` is the state
 * hash of the bytes, checked after loading.
 */
import { packSave, unpackSave } from './saveCodec';

export const SCENARIO_MAGIC = 'WARSIM-SCENARIO\n';
export const SCENARIO_FORMAT = 1;
export const SCENARIO_EXT = '.warsim-scenario';

export interface ScenarioHeader {
  format: number;
  name: string;
  /** The base scenario whose map the state uses ('1938'). */
  base: string;
  w: number;
  h: number;
  tick: number;
  /** State hash of the bytes (Sim.hash after loading them). */
  hash: number;
}

export async function encodeScenarioFile(header: ScenarioHeader, bytes: Uint8Array): Promise<Uint8Array> {
  const head = new TextEncoder().encode(`${SCENARIO_MAGIC}${JSON.stringify(header)}\n`);
  const raw = new Uint8Array(head.length + bytes.length);
  raw.set(head, 0);
  raw.set(bytes, head.length);
  return packSave(raw);
}

/** Parses a scenario file; throws a readable error on anything else. */
export async function decodeScenarioFile(file: Uint8Array): Promise<{ header: ScenarioHeader; bytes: Uint8Array }> {
  const raw = await unpackSave(file);
  const magic = new TextEncoder().encode(SCENARIO_MAGIC);
  for (let i = 0; i < magic.length; i++) if (raw[i] !== magic[i]) throw new Error('not a WarSim scenario file');
  let nl = magic.length;
  while (nl < raw.length && raw[nl] !== 10) nl++;
  if (nl >= raw.length) throw new Error('scenario file: missing header');
  const header = JSON.parse(new TextDecoder().decode(raw.subarray(magic.length, nl))) as ScenarioHeader;
  if (header.format !== SCENARIO_FORMAT) throw new Error(`scenario file format ${header.format} (this version reads ${SCENARIO_FORMAT})`);
  return { header, bytes: raw.slice(nl + 1) };
}

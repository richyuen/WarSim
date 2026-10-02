/**
 * Whole-state serialization and hashing over sections (SPEC §2.6 "State hash").
 * A `Stateful` contributes its authoritative arrays as sections; events and derived data are excluded.
 */
import { decodeSections, encodeSections, hashSections, type Section } from './sections';

export interface Stateful {
  serialize(): Section[];
  deserialize(sections: readonly Section[]): void;
}

/** Concatenated sections of the parts, in the given (fixed) order. */
export function collectSections(parts: readonly Stateful[]): Section[] {
  const out: Section[] = [];
  for (const p of parts) for (const s of p.serialize()) out.push(s);
  return out;
}

/** xxHash32 over every authoritative section of `parts`. */
export function stateHash(parts: readonly Stateful[]): number {
  return hashSections(collectSections(parts));
}

export function saveBytes(parts: readonly Stateful[]): Uint8Array {
  return encodeSections(collectSections(parts));
}

export function loadBytes(parts: readonly Stateful[], bytes: Uint8Array): void {
  const sections = decodeSections(bytes);
  for (const p of parts) p.deserialize(sections);
}

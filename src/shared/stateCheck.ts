import { STATE_FORMAT } from './saveFormat';
import { sectionNames } from './sectionNames';
import STATE_REQUIRED from './stateRequired.json' with { type: 'json' };

/**
 * The sections a load cannot do without (`tests/unit/saveFormat.test.ts` finds and pins them per
 * state format) that the state `bytes` (unpacked) lack, as "name:dtype"; [] when it loads here. What the
 * title screen asks of a save or a scenario file before it offers to start it (PLAN 7.168; critic
 * runs 19–21: a run 10 save and scenario file were offered, and failed only once started). Bytes
 * that do not decode lack them all.
 */
export function missingSections(bytes: Uint8Array): string[] {
  const need = (STATE_REQUIRED as Record<string, string[]>)[String(STATE_FORMAT)] ?? [];
  let have: Set<string>;
  try {
    have = new Set(sectionNames(bytes));
  } catch {
    return need;
  }
  return need.filter((s) => !have.has(s));
}

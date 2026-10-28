/**
 * The format of a saved game's state (PLAN 7.152a, ADR-747). A save holds the sim's sections
 * (SPEC §2.6); a version that adds, drops or retypes a section read on every load (each table
 * column, the world's core sections) cannot load the saves of the one before it (critic run 17:
 * ADR-737's `formations.struck`). The autosave record carries the format it was written in, and
 * the title screen reads it before it offers Continue: a save of another format is shown as from
 * an older version, not as a game to continue. A record without one is from before this field.
 *
 * Raise STATE_FORMAT with any such change of the sections; `tests/unit/saveFormat.test.ts` pins
 * the sections of each format and fails when they change under the same number. The sections that
 * come only with play (the world's optional ones, read with a fallback) load when absent and do
 * not count. The section bytes' own layout version (`sections.ts`) is another matter: it changes
 * with the codec, not with the state.
 */
export const STATE_FORMAT = 1;

/** Whether a save written in `format` (absent: before the field) loads in this version. */
export function sameStateFormat(format: number | undefined): boolean {
  return format === STATE_FORMAT;
}

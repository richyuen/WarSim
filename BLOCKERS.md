# BLOCKERS

Tasks that failed 3 attempts or cannot proceed, with what was tried. Resolved
entries are kept and marked **RESOLVED** with the date and fix.

## Open

_None._

## Watch list (not blocking)

- `reference/NOTES.md` (the user's taste notes, highest-priority reference) does not exist
  (checked 2026-10-02). Visual/feel decisions rely on `reference/screens/`, the trailer and
  itch/Steam/devlog text, and are marked lower confidence until notes appear.
- Map import (PLAN 1.37a) leaves cities and formations where they were, so some can end up on new
  water. Not addressed in 1.38: scenario files store the world as it is. Decide in the Phase 1
  review (1.41) whether an import also removes cities and formations from water cells.
- The e2e stage depends on machine load: on 2026-10-03 another project's dev server held ~2.5
  cores and the stage took 2.9 min instead of 1.4. The expect timeout is now 15 s.
- `data/scenarios/1938/scenario.json` settings are mostly not applied by `createWorld1938`. Only
  `revoltMode` is read (PLAN 1.40). For example, `revival.maxPerNation: 3` / `cooldownDays: 1825`
  differ from the code's REVIVALS 2 / 730 days. Settle in the Phase 1 review (1.41): apply the
  settings or remove them.

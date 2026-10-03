# BLOCKERS

Tasks that failed 3 attempts or cannot proceed, with what was tried. Resolved
entries are kept and marked **RESOLVED** with the date and fix.

## Open

_None._

## Watch list (not blocking)

- `reference/NOTES.md` (the user's taste notes, highest-priority reference) does not exist
  (checked 2026-10-02). Visual/feel decisions rely on `reference/screens/`, the trailer and
  itch/Steam/devlog text, and are marked lower confidence until notes appear.
- The e2e stage depends on machine load: on 2026-10-03 another project's dev server held ~2.5
  cores and the stage took 2.9 min instead of 1.4. The expect timeout is now 15 s.
- Tick time after ADR-47 (2026-10-03): year-1 mean 4.6–5.9 ms on seed 99 against the 1.5 ms
  budget (PLAN 7.1). Hot spots: supply reflood, pathfinding, combat.
  **Eased 2026-10-03 (PLAN 1.42a):** 5-year mean 1.04 ms, year 1 1.92 ms on seed 99. The first
  year of a war-heavy seed is still above 1.5 ms: combat 0.67 ms, AI pathfinding 0.54 ms (long
  marches: a Soviet division sent to the Far East expands ~54,000 cells), supply 0.29 ms.
- Cell A* is not exactly optimal (found 2026-10-03, PLAN 1.42a; SPEC §4 routes): its bound is
  not a strict lower bound across rows of different width. Routes can be ~0.1% longer than the
  cheapest. Not fixed: it would change routes (and the sweep baselines) and slow every search.
- e2e flake (2026-10-03): `speed.spec.ts` once did not find the speed label within 15 s on `/`
  in a full e2e run; it passed alone and in the next full run (61 passed). No source change was
  involved. If it recurs, look at the page boot under 4 parallel workers.

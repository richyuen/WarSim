# BLOCKERS

Tasks that failed 3 attempts or cannot proceed, with what was tried. Resolved
entries are kept and marked **RESOLVED** with the date and fix.

## Open

_None._

## Watch list (not blocking)

- `reference/NOTES.md` (the user's taste notes, highest-priority reference) does not exist
  (checked 2026-10-02). Visual/feel decisions rely on `reference/screens/`, the trailer and
  itch/Steam/devlog text, and are marked lower confidence until notes appear.
- Fully zoomed out on the 1938 map, grey vertical stripes show along the north and south map
  edges (seen in `docs/evidence/1.31/ui-shell.png`, 2026-10-02). Not caused by the UI; look at
  the polar rows / edge clamping in the map shader in the next review pass.

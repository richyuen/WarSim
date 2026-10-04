# BLOCKERS

Tasks that failed 3 attempts or cannot proceed, with what was tried. Resolved
entries are kept and marked **RESOLVED** with the date and fix.

## Open

### PLAN 1.42 / critic B1: the leader-share and top-ten criteria do not hold on every unseen seed (2026-10-03)
Three attempts, each judged by one sweep of 10 unseen seeds × 50 years. The thresholds
(≥ 2 newcomers in the top ten by land, leader-share range ≥ 3 points) were never moved.

| Attempt | Changes | Seeds | Result | Failures |
|---|---|---|---|---|
| 1 | ADR-47 (wars resolve, armies recover, overextension) | 101–110 | 9 of 10, `docs/sweeps/2026-10-03-sweep-b1.md` | 109: range 2.7 |
| 2 | ADR-50 (partners' fronts) + PLAN 1.42c (build queue) | 201–210 | 7 of 10, `docs/sweeps/2026-10-03-sweep-b1c.md` | 204: 1 newcomer; 208: 1 newcomer, range 2.4; 209: range 2.6 |
| 3 | ADR-51 (the winner keeps what it occupies) | 301–310 | 8 of 10, `docs/sweeps/2026-10-03-sweep-b1d.md` | 304: range 2.6; 306: range 1.6 |

- **The pattern:** the Soviet Union is the largest nation in every year of every run (27% at
  the start). The range criterion passes when revolts and lost wars carve it down (to 12–24%)
  and fails when they do not (304 and 306 end at 25.2% and 27.5%). Nothing in the sim makes
  that happen on every seed, and no other nation ever grows towards it. The newcomer criterion
  passed on all ten seeds in attempt 3, with five other criteria.
- **Checks on seen seeds do not predict the sweep:** attempt 2 passed 4 of 4 seen seeds and
  attempt 3 passed 10 of 10 (seeds 101–110) before failing on unseen ones. One seed's 50-year
  range moves by several points between versions of the code.
- **Not tried:**
  1. Measure how fast a front advances against an almost undefended giant (seed 109, year 25:
     78k Soviet men, 170,000 cells, wars at score 0). The checkpoint `.cache/ck/s109-y25.bin`
     was written before ADR-50; rewrite it first.
  2. Rivals that grow: the United States holds 7–9% with aggression 15 and 876k gold unspent
     at year 25; no great power other than the Soviet Union is ever near the top share.
  3. Where Soviet formations die (13 lost in 30 months on seed 109, several out of supply on
     land that flipped back under them).
- **Found afterwards (2026-10-03, the user's question "is the Soviet Union just too big at the
  start?"):** the criteria count cells of a Miller map. The Soviet Union is 26.8% of the owned
  cells and 15.9% of the owned area; Denmark is in the top ten by cells because of Greenland.
  PLAN 1.42d changes the measure to area (ADR-52), with the thresholds as they are. **Retry
  1.42 after 1.42d, judged by area.** This does not explain everything: the leader still only
  shrinks and no rival grows (the items under "Not tried" stand).
- **Criteria rewritten (2026-10-03, ADR-54, the user's decision):** the every-seed rule on
  top-ten churn and leader-share range is replaced by a riser and a faller, each needed in 8
  of 10 seeds. Under an 80% quorum the old two criteria would have passed all three failed
  sweeps, so the quorum alone would have been a relaxation: the measures were replaced by
  ones that need larger changes (a realm × 1.5 up, a top-ten realm a third down; a realm is
  a nation with its puppets). No 50-year run has been judged by them.
  The mechanism is still missing: the leader only shrinks and no rival grows.
- **Seen seeds:** 1–10, 99, 101–110, 201–210, 301–310. The next sweep starts at 401. Do not
  re-run seen seeds under the new measure to claim a pass.
- **Kept anyway:** ADR-47, ADR-50, PLAN 1.42c and ADR-51 each remove a defect found in the
  diagnosis; none of them is a tuning constant chosen to pass a seed.
- **Deferred to Phase 7 (2026-10-03, ADR-58, the user's decision):** balance sweeps are
  suspended until phases 2–6 are complete, and PLAN 1.42 has moved to Phase 7. Not retried
  before then. The critic will go on listing B1 as blocking: PROMPT step 2b says to log it
  and take the next issue. State when parked: 1.42d, 1.42e and 1.42f are done; the last five
  quick sweeps (20 years, seen seeds) show a riser in 6–8 of 10 seeds and a faller in 10 of
  10; no 50-year run has been judged by the criteria of ADR-54.

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
  **Measured again 2026-10-03 (ADR-56):** on random grids of 16–64 rows a quarter of routes are
  dearer than Dijkstra's, by up to 15%, with the old and with the octile bound alike; the 0.1%
  above was not a maximum. The map's rows change slowly, so it matters far less there.
- Unit flake (2026-10-03): `tests/unit/scenarioFile.test.ts` ("export: no run history in the
  scenario") failed once in a full `npm test` with a gunzip "incorrect data check" after 43 s;
  alone it passes in 8.5 s, and it passed in every gate run of the day. Not investigated. If it
  recurs, look at the gzip stream round trip under CPU load.
  **Recurred 2026-10-04** (PLAN 1.43c, the third record of this error; the first is the retry in
  `tests/helpers/earth.ts`): `tests/unit/provinces.test.ts` failed to load in one gate run with
  "incorrect data check" from `gunzipSync(readFileSync(admin1-geometry.wsz))`. The file was
  intact (the manifest test checked its sha256 in the same run), no test writes the assets, and
  the file passed alone and in the next gate run. Looked at, not explained: the same read and
  gunzip in a loop gave no error in 72,000 runs over 24 processes (56 s) nor in 36,000 runs over
  24 worker threads of one process (28 s), so it is not zlib or the machine under plain load.
  It has only been seen inside a full vitest run. `provinces.test.ts`, `terrain.test.ts` and
  `data-manifest.test.ts` read the assets without the helper's retry.
  **Review pass 2026-10-04:** there is one loader now (`tools/headless/assets.ts`: `earthFile`
  and `earthAsset`, read again up to three times when the gunzip fails), used by the test
  helper, the headless tools, the preview tool and those three tests. The cause is still not
  known; if the error shows again it is no longer a first read that failed.
- Unit failure, once (2026-10-04, in the gate of PLAN 2.4b): `tests/unit/determinism.test.ts`
  "I5: save bytes → load → save bytes are identical" failed in one full `npm test`: two saves of
  the toy world, 601,576 bytes each, not equal. It passed alone and in the next two full runs.
  - It is not the change under test (the toy world has no elements) and not the gunzip flake
    above (saves are raw sections; nothing is compressed or read from disk).
  - Ruled out: a NaN whose bits differ between interpreted and compiled code (the save has no
    NaN in any float section); a defect that shows in repetition (40 save → load → save round
    trips in one process were identical).
  - The same pattern as the gunzip flake: bytes that are wrong, seen only inside a full vitest
    run. Two readings, neither tested: a real nondeterminism that needs the load of a full run
    to show, or memory that is not reliable on this machine under that load (the gunzip check
    and a byte comparison are both checksums of a large buffer).
  - The test now reports which sections differ, the first differing element and its bytes on
    both sides. **If it fails again, read that message before anything else:** one flipped bit
    in one section points at the machine; a whole section or a value that makes sense points
    at the sim.
- e2e flake (2026-10-03): `speed.spec.ts` once did not find the speed label within 15 s on `/`
  in a full e2e run; it passed alone and in the next full run (61 passed). No source change was
  involved. If it recurs, look at the page boot under 4 parallel workers.
  **Recurred 2026-10-03** on a 4-core machine in every gate run, with `precision` and `camera`:
  workers now scale to the cores and the spec has a 90 s timeout (PROGRESS of that date).
- Tick timings on the budget machine come in two speeds (2026-10-03, PLAN 1.42e1): the same
  commit measured 1.68 ms and, minutes later with the machine idle, 2.76 ms for year 1 of seed
  99. The processor has 8 performance and 8 efficiency cores, and the slow figure (× 1.65) fits
  a run on an efficiency core (not observed directly). Confined to the performance cores at high priority
  (`.cache/pin.ps1`, a scratch script: affinity mask 0xFFFF) the figure is 1.671 ms twice. A
  tick measurement for a budget is taken that way. Not yet a tool in the repo.
  **A tool since PLAN 1.42e3:** `npm run sim -- … --affinity 0xFFFF` (`tools/headless/affinity.ts`).
  The gate and the sweeps run unpinned: their wall times vary with it, their results do not.
- e2e boot stall (2026-10-03, 4-core machine, 2 workers): `coast1938.spec.ts:91` and
  `nationPanel1938.spec.ts:15` waited more than 60 s for the first frame of
  `/?scenario=1938&paused=1` in one gate run; alone they pass in 5.5 s and 11.6 s, and the gate
  before and after passed all 61. Paused pages run no tick, so the A* change under test was not
  involved. Contention does not explain 10×: if it recurs, keep the trace
  (`test-results/…/trace.zip`) and look at the worker boot handshake.
- Found by the independent read of 2026-10-04 (ADR-74), not tasks; look again at the phase review (PLAN 2.11):
  - `counters.ts` `foldOverlaps` works in unwrapped px: counters either side of the seam of a
    looping map (the 180° meridian in 1938) are not folded into each other and can overlap.
  - `cityLabels.ts`: the wrap copies of a city share one name switch. When one copy collides
    and the other does not, the switch turns twice a frame and the layer never rests. Both
    copies are laid out only when the world is narrower than the view + 400 px at a zoom that
    shows names: a view of 6,570 px or more on the shipped maps.
  - `cityLabels.ts` `wanted` uses `<` where the tiers use `<=`: at exactly 2000 m/px the
    names of size 4 are off while the T1 markers are on.
  - `flagStore.ts` maps nation ids to 1938 tags in every scenario: the toy world's two
    nations wear the first two 1938 flags.
  - `markers.ts` `boxSprite`: at a fractional device pixel ratio the picture is rounded up
    and drawn into the unrounded rectangle (38 px into 37.5 at 1.25). Not traced.

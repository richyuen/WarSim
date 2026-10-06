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

### PLAN 2.12a is in the working tree and not committed: the gate was stopped for want of memory (2026-10-05, 05:29)

- **What happened:** the full gate for PLAN 2.12a was started at 05:29:06 with the CPU sampler
  beside it. In the unit stage, 41.7 s in, test workers died as they started ("Worker exited
  unexpectedly with exit code 3221225794 during starting state", 31 files and 209 tests done),
  and the gate said "FAILED at test". The harness then stopped both jobs: the system was
  critically low on memory. It says not to start them again unasked. Nothing was started
  again.
- **The machine a minute later:** 12.7 GB of 31.8 GB free; 23.1 GB committed of a limit of
  42.3 GB, with nothing of the gate left running. All processes together hold 8.5 GB of
  private memory and the kernel's pools 2.5 GB: some 12 GB of the commit is with nothing this
  account can see. The unit stage starts 24 workers; it has fitted in every gate until now.
- **Not this task's tests, as far as measured:** the new twin test's two games take 452 MB at
  their peak with the moving tables and 425 MB without (one 1938 game is some 80 MB).
- **State of the work:** the fix, its tests and its documents are in the working tree, with
  PLAN 2.12a ticked and a PROGRESS entry that gives test counts (647 unit, 117 e2e) no gate
  has confirmed yet. Run by hand before the gate and green: typecheck, lint of the changed
  files, the three unit tests, the e2e, the pin; the three ten-year games ran with the new
  check only on the code of before (seed 1 failing, as it should). **Not run on the fix: the
  sweep stage and the e2e suite as a whole.**
- **To go on:** `npm run check` (the full gate), then the commit of PLAN 2.12a with explicit
  paths. Then PLAN 2.12b: its change and its test are set aside in `.cache/p212/`
  (`p212b-commands.patch`, to `git apply`; `commandKinds.test.ts`, to `tests/unit/`).
- **A lead for the slow half hours below:** a machine at its commit limit pages and
  compresses, and is slow in every stage alike. The sampler has not recorded memory; it
  should.

## Watch list (not blocking)

- Seen 2026-10-05 with PLAN 2.16Rg, not looked into: **land occupied with no war behind it in
  a game without commands.** 1938, seed 99, tick 2000: 45 cells whose controller is not their
  owner and is not at war with it (a scratch count over the grid; which nations, and by which
  peace or death, is not known). Nothing takes such a cell back. A defect if a peace or a
  death leaves them; to be asked with PLAN 2.17's "a dead nation holds nothing".
- Seen 2026-10-05 with PLAN 2.16Rg: the toy world's `nations.cols.cells` is the daily count of
  cells *controlled* (`toyCount`), 0 before the first day, while `World.setOwner` keeps the
  same column as cells *owned*. Two writers of one column.

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
- Unit failure, once, its message lost (2026-10-04, the gate of the review pass after PLAN 2.7f–m):
  `npm run check` stopped at the unit stage with 75 of 76 files and 563 of 565 tests passing. The
  run's output had been cut down to its summary lines, so which two tests of which file failed is
  not known. The full `vitest run` straight after passed 565 of 565, and the gate after that was
  green. Nothing else ran on the machine (the reader of the review had finished).
  - Two tests in one file fits neither of the two entries above as written (a file that fails to
    load fails all its tests; I5 is one test). It may be either of them, or a third.
  - **A gate run keeps its whole output from now on** (`npm run check > <log> 2>&1`, then read the
    log). If a unit test fails in a gate run, the message is the first thing to keep.
- **Half an hour in which the browser's sim ran up to 200 times slower (2026-10-04, about 17:07 to
  17:39; the gate of the review pass after PLAN 2.7v–u). Not explained.**
  - *What was seen:* two gate runs in a row failed at e2e, in 11.8 and 11.7 minutes for a stage
    that takes 5.5: four and five tests, all on time. `cityNames1938` had 49 and 7 ticks in
    its four seconds at top speed (every gate of the day before: 590 to 700), and its T1 part
    149 and 49; `handover1938` and `labelFades1938` ran into their timeouts; `tickClock` had no
    pause answered in its tick in twelve tries.
  - *Not the change under test:* with the tree at the commit before (gated green an hour
    earlier, `f5a7083`) the same test had 25 ticks.
  - *Not the machine, as far as could be seen:* no process used a hundredth of a core over three
    seconds, no battery, the High performance plan, nothing listening on the test port, no
    file changed on disk but the pass's own. Looked at between the runs, not during one.
  - *Not the sim:* in Node 2.28 ms a tick over a year of seed 1938; in the browser, stepped,
    1.2 to 2.4 ms a tick.
  - *Then it was gone:* from 17:40 the same test, three times in a row, had 347, 349 and 1,474
    ticks, and the third gate run was green in 5.5 minutes with 348.
  - *One thing measured that may be its ground:* at top speed from the 1938 start, the page's
    own thread is held for about 600 ms by each frame (a 4 ms timer of the page comes 540 to
    620 ms late in every half second), with two frames in a half second and half seconds with
    no tick at all; 271 ticks in the first half second, 30 to 90 in those after. That was
    measured in the healthy time. Whether a frame at top speed always cost that much has not
    been looked at, nor what in it does (the labels, the tiles of a changed map, the counters).
  - *And the spread in the healthy time is wide by itself:* 347 to 1,474 ticks in four seconds
    for one test.
  - **If it comes back:** look while it runs (`Get-Process` by CPU over a few seconds; the
    timeline of ticks, snapshots and frames by half seconds, as above), before running it
    again.
  - **It came back (2026-10-04, about 21:32 to 22:12; the gate of PLAN 2.9b1, twice), and it is
    the whole machine, not the browser.** Still not explained.
    - *What was seen:* two gate runs in a row failed at e2e (13.6 and 14.7 minutes for a stage
      of 7; three and six tests, all on time: 25, 25 and 19 ticks in four seconds at top speed).
    - *The stages that open no browser were slow by the same measure:* the unit stage 92.5 and
      92.8 s (43 to 45 in the gates before and after), the sweep stage 183 and 182 s (115 and
      117; 108 after). The logs of the first time say the same, and it was not read then: the
      unit stage of the two failed runs 88 s, of the green third run 41 s, one tree.
    - *So the browser's hundredfold is the machine's half speed made worse by the pages
      starving each other:* four pages at once at top speed gave 247 to 385 ticks each in four
      seconds where one alone gave 1,411, measured at 22:11, each page with its software
      renderer on some six cores.
    - *Not the change under test, measured:* at 22:25 the first five spec files of the gate, four
      workers, on the tree and on the code of the commit before: 1,012 and 1,175 ticks against
      896 and 1,104, the same test durations.
    - *A guess of mine withdrawn:* that the worker's timer was held back as a hidden page's is.
      A page asked during the slow time's end said visible and in focus, and Node was slow too.
    - *Looked for and not found:* a virus scan (the day's one ran 18:07 to 18:10), an update, a
      processor-power or other event in the system log, a process other than the gate's own
      over a third of a core at 21:50 (three seconds between the runs), a leftover process of
      mine, low memory (16 of 32 GB free).
    - *The healthy gate, sampled every 14 s for comparison* (`gate-29b1c`, 22:18 to 22:28,
      green): the processor at 128 to 158 % of its nominal clock throughout (138 on average),
      about 20 cores' worth used by the browsers in the e2e stage, no other process over one core.
    - *Not sampled: a slow gate.* **From now on a sampler runs beside every gate** (a scratch
      script: `% Processor Performance`, and the processes by CPU, every 14 s). A slow gate then
      shows one of three things: the clock held down (heat, or a limit), another program on the
      cores, or neither with the cores not full (the work kept off the fast cores; then look at
      the load by core).
    - *The entry below on a slow machine is the same picture* (the unit stage 72 s for 40, with
      another project's server known to be busy). Whether another project was busy this time is
      not known; it was not seen at 21:50.
    - *What a red gate of this kind means:* nothing about the tree. The rule stands: no commit
      on red, no limit or worker count changed for it. Run again when the unit stage of a gate
      reads 45 s or less; if it reads 90, the run will fail and the sampler has the reason.
- e2e, once (2026-10-04, the second gate run of PLAN 2.8c2): `markers1938` waited 60 s for the
  page and it did not come. Its trace has one console error: "Failed to load resource:
  net::ERR_NO_BUFFER_SPACE". The page loaded nothing of the game.
  - Two full gate runs and some thirty runs of single specs had gone before it within the
    hour, each page a dozen requests to the preview server; 153 sockets were in TIME_WAIT just
    before the third run, which was green. That many runs back to back is my guess at the
    cause; not shown.
  - If it comes back in a single gate run on a rested machine, look at the server's and the
    browser's connections (keep-alive of `vite preview`) before running again.
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
- **From the sixth read (PLAN 2.16Ra, 2026-10-05), for the review of Phase 3.** None is a
  task: what a player can meet of the read is PLAN 2.16Rf to 2.16Ri.
  - *Run by the reader, low:*
    - `editPaint` with the tool `line` and a coordinate of 1e9 takes 13 s, with Infinity it
      does not end (`lineCells`, `src/sim/editor.ts`). Only a worker message or the page's
      test API can send it: `isCommand` looks at the kind, each handler at its own fields,
      and this one not at these. The editor's own inputs are guarded.
    - For the hour after a load, or after any command, the blocks of formations in contact
      can stand elsewhere than in the game that ran on (seed 99, 2,500 ticks: 975
      formation-hours, 1.4 cells at most): `findBattles` fills the contacts before combat
      destroys formations in the tick, and what is asked after a load is worked out from
      the state after. A picture only; the hashes were equal.
    - In a Kill the dying nation emits `CapitalMoved` up to five times (89 of 102), and for
      20 to 33 its `NationEliminated` comes before the last `RevoltSpawned` or `LandCeded`.
      `CapitalMoved` is not in the history. No state was found lost by it.
  - *Suspicions, not settled:*
    - After a command `world.deployed` is filled again by whoever asks (the view's box),
      and the next hour's `deployedBefore` is that part: a wreck or an hour's slide could
      start from the formation's place and not its block. Wants a snapshot test with a
      command between two hours.
    - The toy world: `nations.cells` is 0 at the start and drifts from the count of owned
      cells; a formation of strength 0 was alive at tick 500. A fixture.
    - The random world grows its nations over the graph that wraps at the seam also when
      `loopingMap` is off (the option is applied after the build).
- **The watch lists of Phase 2 after its review (PLAN 2.11c, 2026-10-05).** Sixteen lists stood
  here, from four independent reads and twelve tasks, each "for the phase review". Every item of
  theirs is now one of four things. What became a task or a line under a later task is in
  PLAN.md and no longer here: nothing waits on this file staying read.
  - **Tasks before Phase 3:** PLAN 2.11e (a formation in contact is drawn walking in place),
    2.11f (occupied land's hatching lies over the ground at T2 and T3), 2.11g (a sprite at T2
    shows nothing of its element's losses).
  - **Lines under later tasks:** PLAN 4.1 (a march across a bay); 4.7 (the sea floor; lakes
    that are there at T2 and not at T1); 7.1 (the instances' cap above 1920 × 1080; the land
    mask held twice; a GPU without textures of 8192 px; fractional pixel ratios; the ground's
    cost without a GPU); 7.4 (the seam of the looping map, seven items; the declutter in a
    crowd and in flight; names and arrows at T1; the ground's look; what T3 shows of a battle;
    picking in a stack; flags by scenario).
  - **Carried here, each with why it waits:**
    - *Tests that hang on something outside them.* None is a defect of the game; each says
      what it lacks when it fails.
      - The zoom demo's battle is found by rule (a division that fires, has stood a day, has
        every battalion above 64 men and under half its strength, a battery with losses, and
        more than 10 shots by or at it in each stepped hour). A pin move can make day 30 find
        another division, or none. "Under half" stays: the close pictures are the evidence
        that losses show at T3, and they show it only on a division that has lost.
      - `coastPicture1938`: two of its nine views have little of one kind to compare (456
        places surely land, 641 surely water; the floor is 300). Its "surely" (3 × 3 mask
        pixels) is stricter than `maskSure`: the band between the two rests on the unit test
        of the two constants and on the 202 elements looked at.
      - `coastElements1938` looks at the 20 formations nearest the water, of 35 within half a
        cell of it, on seed 99 at the start.
      - Bench A's coast is made of blobs: no real coast was timed on a GPU.
      - The demo's frames cost 100 to 200 ms each in the tests' rasteriser: a minute alone,
        1.4 minutes in the gate, a timeout of 300 s.
    - *Every unit test file that builds the 1938 world unpacks the land mask* (once to a
      process). The unpacking that failed three times in parallel vitest runs (above) has one
      more file to fail on. Not seen since PLAN 2.9a.
    - *Close pictures differ from run to run where a formation walks* (the walk's phase is
      the clock's). Since PLAN 2.11e the demo's division stands, and the demo's eight pictures
      of two runs are the same pixel for pixel; a picture with a formation on the march in it,
      close enough for the sway to be a pixel, would still differ.
    - *Land and water painted in the editor are not in the fine mask.* A cell without land in
      the mask keeps its middle, its elements their slots, and the coast there is the cells'.
      By design until an editor paints the mask.
    - *From the fifth read (PLAN 2.11b), not established or not reached:* a figure at the
      edge of an element's footprint, 0.096 mask px from
      its element, can stand where the field is 0.75 and the shore's noise makes sea of it;
      `World.inland` and `cellPoints` do not record `loopingMap`, so a change of that option
      after cells were asked leaves the seam's columns with the old answer;
      `World.standPoint` clamps an x under 0 to column 0 on a looping map instead of wrapping
      (no caller gave one in a year). Each a line to look at when its code is next touched.
    - *Suspicions of the readers, neither established nor met:* a frame later than 1.5 ticks
      after a snapshot, with none following, leaves the sprites short of the tick's end;
      `drawUnitLayers` without `pixels` draws on an overlay that is not cleared (a test hook);
      `FlagStore.pixelsOf` keeps a plain flag in the first colour it saw for an id.
  - **Closed, each with its reason:**
    - *The worker's start with the mask* (PLAN 2.9a, not measured then): measured now. Five starts of the 1938 page, alone, in the tests' rasteriser: the first frame 0.22 s after navigation, the map layers and the page's copy of the mask at 0.95 to 1.09 s, the first snapshot at 1.1 to 1.4 s. Reading and unpacking the mask takes 15 ms in Node. It is not what a start waits for.
    - *The tick's time with the mask* (two unpinned readings then): pinned in PLAN 2.9b1, 1.45
      and 1.44 ms over five years, under the code before the mask (1.50 and 1.49).
    - *The demo stops at 3 m/px and only zooms in:* 1 m/px is `closeZoom1938`'s and
      `ground1938`'s; the way out, at each boundary, `fades1938`'s.
    - *Figures fading out after a flick past 60 m/px are of the tick before:* a quarter of a
      second of a layer that is going.
    - *`nudgeApart` gives other moves for another order of the list:* snapshots list
      formations by ascending id.
    - *The order arrows of markers in a stack are drawn from their own formations:* meant so.
    - *`inBbox` wraps on a map that does not loop:* a view at one edge is sent the formations
      within the pad of the other; they are not in the view and are not drawn.
    - *`snapshotPrev` keeps rows after a second `init` on one worker:* the app inits once.
    - *The toy world has no ground texture and wears 1938 flags:* a fixture; no player is
      offered it. (Flags by scenario: PLAN 7.4.)
    - *Names by counters and by marching armies come and go at top speed* (51 fades begun in
      four seconds at 4000 m/px): at one tick a second it is one in some 40 seconds.
    - *The six pictures of PLAN 2.6 were older than the ground:* shot again in PLAN 2.10b; the
      phase's other pictures are shot again at the end of this review.
- `fire1938.spec.ts`, the running part, under load (2026-10-04, gate run with another job on the
  machine, the e2e stage at twice its usual time): 6,614 fires dropped (expected 0). The worker's
  fire queue is capped at 8,192 and drops the oldest when the view takes snapshots more slowly
  than the sim makes fire. The drop is by design (the view says how many: `firesDropped`); the
  spec's "none dropped" holds on an idle machine only. If it recurs on an idle machine, look at
  the snapshot rate at T2 while the game runs at ×5. The counters' case of the same run is PLAN 2.7l.
- For PLAN 7.1 (2026-10-05, PLAN 2.13): the mean tick of five pinned years of seed 99 is 1.502 ms, at
  the budget of 1.5 (1.203 before). The armies of the start are no longer cut in the first hour: years
  1 and 2 have some 200 formations more and take 2.11 and 1.97 ms a tick. Not tuned (ADR-58).
- **Answered in part by PLAN 2.13 (ADR-86):** the entry below. The 228 are no longer disbanded in the
  first tick; the nations whose income does not carry their army cut it as their gold runs out
  (seed 99: 846 formations after a year, 687 after two). Which budgets are off is still open.
- For Phase 7 (balance; seen 2026-10-04 while writing the test of PLAN 2.7o, not looked into): in the
  first tick of the 1938 world the economic AI disbands 228 of the 1,054 formations (seed 99; the
  same with and without commands), all in `economicAi` step 1, "disband until the books balance".
  That it disbands is decided (the ADR on the economic AI: the order of battle gives some nations
  armies they cannot pay for). How much is not on record: a player who opens 1938 sees, after one
  hour of the game, 78% of the armies the scenario's data gives. Which nations, and whether their
  income or their order of battle is off, is a question for the balance work.
- For Phase 7 (seen 2026-10-05, PLAN 2.16Rg and 2.17c, not looked into): 1938, seed 99, tick
  2000, no command: 45 cells are controlled by a nation other than their owner with no war
  between the two. A Kill no longer adds to them (ADR-119). Where the 45 come from (a war
  that ends for one side, a peace that leaves cells, an alliance joined) is not known.
- For Phase 7 (measured 2026-10-06, PLAN 2.17d2; left as it is by PLAN 2.17d3, ADR-123): a
  province split by a peace stays split through every transfer. A peace moves cells; a
  defection, a revolt, a collapse, a Kill and a revival move the cells of a province that the
  owner of its centre owns (`defect`, `spawnRebels`), and no others. 1938, seed 99: France
  killed at tick 0 and revived two years on holds 8,963 of its 10,473 cells; 1,253 cells of
  provinces whose centre is France's again are Nationalist Spain's (608), three nations' the
  Kill founded (627) and nobody's (18): patches inside France. To be decided with the
  balance: every transfer takes the province whole (and what war, if any, stands behind the
  cells taken from a third nation), or a peace keeps provinces whole, or the patches are left
  to the wars that follow. Not measured: how many provinces a game without commands has split
  after 10 and 50 years.
- Specs that measure time and fail on a slow machine (2026-10-04, gate runs with another project's
  dev server busy on the machine, the e2e stage at 2 to 2.4 times its usual 4.1 min). None was
  changed. If one fails on an idle machine it is a finding.
  - `individuals1938`: a frame under 25 ms (170 ms).
    2026-10-06 (the gate of PLAN 3.1d, two runs of the suite, 9.8 and 10.1 min): in the first its
    wait of 60 s for the first frame and the map layers of a paused 1938 page ran out; alone
    (40 s) and in the second run it passed. The load of the machine in the first run is not known.
  - `fire1938`: more than 10 of something drawn in a window of frames (9), and no fire dropped (6,614).
  - `handover1938`: a wait of 120 s. `labelFades1938`: the test's 240 s. `title`: 15 s for the
    title screen, and an autosave read before it was written.
  - `declutter1938`: PLAN 2.7l, done 2026-10-04 (it was not time that it measured: ADR-75).
  - `cityNames1938`, the running part (added 2026-10-04 with PLAN 2.7r): four seconds at top speed
    must hold more than 8 frames, more than 50 ticks and at least one fade of a name. Gate runs
    on the idle machine gave 20 to 44 frames, 235 to 1,561 ticks and 6 to 51 fades.
    2026-10-05 (the gate of PLAN 2.16d): 39 and 31 ticks in one run of the suite that took
    15.6 min, 577 and 330 in the next (9.8 min), 673 and 757 alone. The load of the machine in
    the first run is not known.
    2026-10-05 (PLAN 2.16Rd): five runs of the suite on the idle machine, 9.7 to 10.2 min:
    275 to 617 ticks. The random world's spec is not what slowed the run of 15.6 min.
  - A way to tell: `npm run test` takes 40 s on the idle machine and took 72 s then.
  - `closeZoom1938`, the pan at T3 (2026-10-05, the gate on PLAN 2.12a, the machine idle in the
    second of two runs): 4 and 3 frames in half a second inside the suite, 19 alone. The spec now
    waits for six frames. Not looked into: whether a frame at 5 m/px on 1,584 figures has become
    slower beside other pages since PLAN 2.11g (the unit stage took 47.9 s in that run, 41 at its
    best).

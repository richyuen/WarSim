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
- `fire1938.spec.ts`, the running part, under load (2026-10-04, gate run with another job on the
  machine, the e2e stage at twice its usual time): 6,614 fires dropped (expected 0). The worker's
  fire queue is capped at 8,192 and drops the oldest when the view takes snapshots more slowly
  than the sim makes fire. The drop is by design (the view says how many: `firesDropped`); the
  spec's "none dropped" holds on an idle machine only. If it recurs on an idle machine, look at
  the snapshot rate at T2 while the game runs at ×5. The counters' case of the same run is PLAN 2.7l.
- More for the phase review (PLAN 2.11), seen while fixing PLAN 2.7j and 2.7k (2026-10-04):
  - Figures fading out of T3 are rebuilt from each snapshot (PLAN 2.7j) only while the view
    keeps the element section, below 60 m/px (`T3_KEEP_M`). A flick of three wheel notches
    from the edge of T3 (34.5 × 1.25³ ≈ 67 m/px) passes that before a tick lands; the figures
    of those 250 ms are then of the tick before.
  - `MapView.flagPlace` keeps a capital flag's rise by nation and wrap offset: at the seam of
    a looping map the state is lost and a rise of 150 ms is cut short.
- For Phase 7 (balance; seen 2026-10-04 while writing the test of PLAN 2.7o, not looked into): in the
  first tick of the 1938 world the economic AI disbands 228 of the 1,054 formations (seed 99; the
  same with and without commands), all in `economicAi` step 1, "disband until the books balance".
  That it disbands is decided (the ADR on the economic AI: the order of battle gives some nations
  armies they cannot pay for). How much is not on record: a player who opens 1938 sees, after one
  hour of the game, 78% of the armies the scenario's data gives. Which nations, and whether their
  income or their order of battle is off, is a question for the balance work.
- Found by the fourth independent read (2026-10-04, ADR-74 addendum; narrowed to PLAN 2.7w and 2.7u),
  not tasks; for the phase review (PLAN 2.11):
  - The parting moves of the T1 markers can put a pair more on each other than it stood (finding
    2, run by the reader): in a crowd, parting one pair pushes a box onto a neighbour, and the
    6 px and the 8 rounds leave it there. 44 of 5,249 made-up clusters of four markers; the worst
    pair from 0.20 to 0.42 under each other. The passes are those of PLAN 2.7s2; since 2.7v
    what they end on is what stays on screen.
  - Not established by the reader, one line each:
    - T1 → T0: the counters change what they show in their second frame with nothing moving
      (68 of 300 made-up worlds), and a name then changes place in mid-handover. The reader
      points at the hold of `CounterLayer.fold`; outside what it was given.
    - T2 → T1: the names give way from the first frame to markers that show at 2% (the rule of
      2.7u: the layer that is coming in); a name with no free place goes out some 250 ms before
      the boxes show.
    - In 1.2 to 1.6% of made-up clusters of 3 to 5 markers, more than 8 rounds of the same passes
      would part every pair (the reader's copy visits the pairs in another order: indicative).
    - `nudgeApart` gives other moves for the same markers in another order of the list. Not
      reachable: snapshots list formations by ascending id.
    - The zoom into T2: the first frame of the morph has scale 1, so a move to the new zoom's
      places starts, and the boxes ease a few px in the first 150 ms of the shrink.
    - (The two copies of a city on a looping map share one place: already above, PLAN 2.7r.)
- Found by the third independent read (2026-10-04, ADR-74 addendum), not tasks; for the phase review
  (PLAN 2.11):
  - T1 markers either side of the seam of a looping map are neither stacked nor moved apart
    (their places are cells × scale, unwrapped): the markers' twin of the counters' entry above.
    No formation of the 1938 start stands near the seam.
  - Not established by the reader, one line each: the order arrows of markers that are in a
    stack are drawn in full from their own formations (meant so: an arrow is its formation's);
    `server.ts` `inBbox` wraps modulo the map's width on a map that does not loop, so a view at
    the west edge is sent formations within the pad of the east edge; a formation that takes a
    freed id takes over the dead one's place in a stack for one fade, and a selection ring
    stays on a reused id; `snapshotPrev` keeps rows above the high water after a second `init`
    on one worker (the app inits once).
- Left by PLAN 2.7s (2026-10-04, ADR-77), for the phase review (PLAN 2.11):
  - "No box more than a quarter under another" is a rule about area. The number is the lower
    12 px of a marker's 29: at 1800 m/px on Spain's front some numbers are partly under a
    neighbour's box (`docs/evidence/2.7/markers-apart-spain-1800m.png`). Not measured.
  - What a stack's lead shows of its own (symbol, bar) is the strongest formation's; the others'
    kinds are not shown until the zoom parts them.
  - A marker in a stack cannot be picked by a click on the map: the lead is what is there. Not
    looked at (`player1938` selects a formation that stands alone).
- Left by PLAN 2.7r (2026-10-04, ADR-76), for the phase review (PLAN 2.11):
  - With the game at top speed the city names near counters come and go often (51 fades begun in
    four seconds at 4000 m/px over Europe). Not looked at at the speeds a player watches at.
  - A name's place is one for the city: on a looping map its two copies either side of the seam
    share it, and what is in the way of one copy moves both.
  - (Done, PLAN 2.7u: at T1 the markers stood on the city names.)
- Left by PLAN 2.8a (2026-10-04, ADR-78 addendum), for the phase review (PLAN 2.11):
  - The sea floor is not shaded, though the elevation carries it (quantised to 10 m for that).
  - The shading takes one cell size for the whole map: far from the equator a slope to the
    east is shaded less steep than it is, against one to the south.
  - The cost of the ground in the tests' software rasteriser is not known per frame (what was
    read varied by a quarter from run to run); the e2e stage's length is watched instead.
- Left by PLAN 2.8c (2026-10-04, ADR-78 third and fourth addenda), for the phase review (PLAN 2.11):
  - The cap of 12,000 instances can be reached: a full view of forest has up to 10,900 at
    1920 × 1080, so a larger view goes past it. What is cut is the finest level, row by row
    from the top: on such a view the trees would thin out below a line. The e2e looks at
    1400 × 800, where nothing is cut.
  - Buildings stand along two directions from a hash: there are no streets, and a city's
    buildings do not know its river or its coast beyond "not on water".
  - A city's buildings reach to the seam of a looping map and not across it.
  - The roads near cities of SPEC's tier table are not in PLAN 2.8 and are not drawn.
  - The instances are drawn in every map mode in the same natural colours.
- Left by PLAN 2.8b (2026-10-04, ADR-78 second addendum), for the phase review (PLAN 2.11):
  - The texture's octaves are measured in screen px and cells: like the hillshade, it does
    not know that a cell is fewer km wide than high away from the equator.
  - The toy world has no ground texture (one switch for the ground, the elevation's arrival).
  - Every ground is the fill's colour: at T3 a forest floor, a field and a street differ by
    roughness and a few hundredths of brightness only. What stands on it is PLAN 2.8c.
- Left by PLAN 2.7u (2026-10-04, ADR-76 addendum), for the phase review (PLAN 2.11):
  - Capitals whose names are left out at T1 because their garrisons stand on every place by
    the dot: Prague at 1800 m/px, Warsaw at 1000 (with Turin, Kiev and Kraków, at the 1938
    start). Prague's place below its dot is short of the clearance by half a pixel. The places
    are eleven fixed ones.
  - The order arrows are not kept clear of, by decision. In a war they are many: two months
    into a game of seed 1938 the picture over Austria is mostly arrows
    (`docs/evidence/2.7/city-names-t1-central-europe-1000m-after-running.png`). Whether every
    marker's arrow should show at T1 has not been asked.
  - At top speed the names by marching armies come and go: 30 and 37 fades begun in four
    seconds (1,400 ticks) at 1000 m/px over central Europe. At one tick a second that is one
    in some 40 seconds.
  - T1 → T2, not looked at: the markers stop counting when the sprites are wanted, and the
    morph keeps their bars and numbers in full for a while (PLAN 2.7c). A name can take a place
    under a number that still shows. The same choice as at T0 → T1, without a picture.
- Found by the second independent read (2026-10-04, ADR-74 addendum), not tasks; for the phase review
  (PLAN 2.11):
  - `nationLabels.ts` `fadeNationLabels`: on a looping map with two copies of a name in view, the
    copy that alone is in a larger name's way goes from 1 to 0 in one frame when the larger name
    comes, while the other copy stays (run by the reader on two made-up labels; not met in 720
    random zoom steps). Two copies are in view when the window is wider than about 1.8 × its
    height at the furthest zoom.
  - `camera.ts` `wrapOffsets` has no margin: a counter, marker, flag or name within its own
    half-width of the seam is drawn only once the view's edge has crossed the seam. Half a
    counter (about 24 px) then appears at once (run by the reader). Not the seam entry above,
    which is about folding.
  - Not established by the reader, one line each: a frame later than 1.5 ticks after a snapshot,
    with none following, leaves the sprites short of the tick's end; figures drawn through a wrap
    offset are 2,047 cells from the origin of their f32 offsets, where a step is 2.4 m;
    `drawUnitLayers` without `pixels` draws on an overlay that is not cleared (a test hook);
    `FlagStore.pixelsOf` keeps a plain flag in the first colour it saw for an id.
  - The "few counters turn the frame after a merge lands" of the entry below is, by the reader's
    run, the second frame of any counter layer newly shown: 1.33% of the counters, at worst 9.1%
    of a view.
- Left by PLAN 2.7l (2026-10-04, ADR-75; measured on 400 synthetic formations in a scratch test, not
  in the repo). For the phase review (PLAN 2.11):
  - An eased zoom (a wheel notch closes on its target over about 0.4 s) still ends with other
    counters when its frames fall otherwise: 62 of 192 cases at spacings of 16 to 200 ms (136
    before). The hold written at rest between two level changes of one zoom is the cause (158 runs
    end at the same level with other counters; 413 before). Tried and rejected: no hold whenever
    the zoom changes. It ends every case alike, and a pinch that wobbles then makes 1% of the
    counters flicker. A spec that needs the same counters steps the camera.
  - At a spacing of 200 ms, 12 of those runs end at another cluster level (the same before):
    `clusterLevel` rounds to the nearest level from wherever a frame finds the zoom, so frames
    far apart can skip the level a close sequence would stop at. A level judged by its band from
    the level held (the next level up or down whose band has the zoom) would not, for a zoom
    that goes one way. Not tried: it changes where a step lands (world → 1.5 px per cell: level
    6, not 5).
  - In flight more counters turn twice (begin to fade in, fold again): 56 of 7,394 on a wheel
    notch in (28 before), 484 of 9,560 on three notches out (325). The numbers on their
    neighbours change with each turn. If it shows in the zoom demo (PLAN 2.10): fold a flight by
    where its counters land, the children fading in as they fly.
  - The frame after a merge lands, a few counters turn (4 of 162 and 7 of 50 keys; 1 and 2
    before): the hold widens the reach of a folded counter, which can then find a nearer
    neighbour and take its box's width with it. One fade at the landing.
- Specs that measure time and fail on a slow machine (2026-10-04, gate runs with another project's
  dev server busy on the machine, the e2e stage at 2 to 2.4 times its usual 4.1 min). None was
  changed. If one fails on an idle machine it is a finding.
  - `individuals1938`: a frame under 25 ms (170 ms).
  - `fire1938`: more than 10 of something drawn in a window of frames (9), and no fire dropped (6,614).
  - `handover1938`: a wait of 120 s. `labelFades1938`: the test's 240 s. `title`: 15 s for the
    title screen, and an autosave read before it was written.
  - `declutter1938`: PLAN 2.7l, done 2026-10-04 (it was not time that it measured: ADR-75).
  - `cityNames1938`, the running part (added 2026-10-04 with PLAN 2.7r): four seconds at top speed
    must hold more than 8 frames, more than 50 ticks and at least one fade of a name. Gate runs
    on the idle machine gave 20 to 44 frames, 235 to 1,561 ticks and 6 to 51 fades.
  - A way to tell: `npm run test` takes 40 s on the idle machine and took 72 s then.

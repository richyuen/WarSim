# WarSim — Phased Plan

Rules: each task is small and verifiable. `AT:` is the acceptance test that must
pass before ticking. Work top-down, and split a task if it grows past one iteration.
"Gate" = the full suite (tsc, eslint, vitest, build, parity) passes.
Balance sweeps are suspended until phases 2–6 are complete (ADR-58, PROMPT "KEEPING ITERATIONS
SHORT"): no sweep after a rule change. Each of those phases ends with a review that runs one
quick sweep as a smoke test.

## Phase 0 — Foundations & benchmarks

- [x] 0.1 git repo + `.gitignore` (reference/, .cache/, build outputs).
  AT: `git status --ignored` lists `reference/` as ignored; `git ls-files` has no `reference/` path.
- [x] 0.2 Vite + TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) + Preact; `npm run dev/build/preview`.
  AT: `npm run build` succeeds; the preview serves a page with a canvas and the title "WarSim".
- [x] 0.3 ESLint flat config incl. sim purity rules (§2.1 SPEC) and module-boundary rule (local `warsim/module-boundaries`, see ADR-12).
  AT: a fixture file in `tests/lint-fixtures/` using `Math.random` inside `src/sim` fails lint (vitest runs ESLint API on fixtures).
- [x] 0.4 vitest + Playwright installed; `npm test`, `npm run e2e`, `npm run check` (= tsc + eslint + vitest + build + parity).
  AT: `npm run check` is green; one Playwright smoke test loads the page and finds the canvas.
- [x] 0.5 Iteration docs: PROGRESS.md, BLOCKERS.md, DATA_SOURCES.md (stub entries), note in PROGRESS that `reference/NOTES.md` is missing.
  AT: the files exist; PROGRESS has a dated entry.
- [x] 0.6 Extract trailer frames: `ffmpeg -i reference/video/*.mp4 -vf fps=0.5 reference/frames/%04d.png` (+ scene-change frames `scene_%03d.png`, since the only clip is 42 s); view a sample and record observations.
  AT: `reference/frames/` has ≥ 30 PNGs; PROGRESS logs observations (VISUAL, dated).
- [x] 0.7 Fetch itch page, devlog index + all posts, Steam page; write `docs/PARITY.md` Table 1 (numbered AoC rows, TEXT/VISUAL source, all `not started`) + Table 2 (our additions).
  AT: every PROMPT.md baseline bullet maps to ≥ 1 row; each row has a source tag and an observation date.
- [x] 0.8 `npm run parity` (tools/parity): parse the tables, compute the score, check evidence paths for `verified` rows, compare against the header score.
  AT: vitest on fixtures: a header mismatch fails, a missing evidence path fails, a valid file passes.
- [x] 0.9 `sim/core/dmath`: sin, cos, atan2, exp, log, pow via tables + polynomials.
  AT: max abs error < 1e-9 vs Math on 1e5 samples; golden-value test (exact bit patterns hard-coded) passes in Node and in Chromium (Playwright).
- [x] 0.10 `sim/core/rng` (PCG32 + streams) and `hash32/xxhash32`.
  AT: known-answer vectors; stream independence (adding a stream doesn't change other streams' sequences).
- [x] 0.11 `sim/core/tables`: SoA growable tables with free lists, id-ordered iteration, serialize/deserialize to sections, `stateHash()`.
  AT: round trip yields identical bytes; hash changes on any single-byte mutation.
- [x] 0.12 Toy world + tick loop (grid 256×128, two nations, random-walk formations) running in Node and in the worker.
  AT: determinism invariants I1, I2, I3, I5 pass on the toy world.
- [x] 0.13 Worker protocol: commands, subscribe, rAF-acked snapshots, buffer pool, coalescing of dirty tiles + event ring cursor.
  AT: I4 (random subscription churn → same hash); a stress test sends no snapshot without an ack; no buffer leaks after 10k frames (pool size stable).
- [x] 0.14 Render benchmark A: raw WebGL2 (twgl) id-map renderer with smooth-border shader at 2048×1024, 150 nations.
  AT: `npm run bench` records fps at T0; screenshot at 3 zooms shows smooth, non-blocky borders (viewed + logged).
- [x] 0.15 Render benchmark B: instanced proxies with GPU interpolation, 10k / 30k sprites; same scene in PixiJS v8.
  AT: bench JSON for both stacks; decision + numbers recorded in DECISIONS (ADR-4 finalised).
- [x] 0.16 Camera-relative precision test at close zoom (1 m/px) at lon 179°.
  AT: a Playwright screenshot sequence while panning shows no jitter (sprite positions stable to ≤ 0.5 px across frames, measured via readPixels).
- [x] 0.17 Camera controller: wheel/drag/keyboard/touch pinch, continuous z, looping-x wrap rendering.
  AT: e2e drives keys/drag/wheel and asserts camera state; panning past the dateline shows a seamless wrap (screenshot).
- [x] 0.18 Data pipeline v0 (`tools/data`): download NE 10m land, admin-0, admin-1, populated places, marine polys, and ETOPO into `.cache/`; produce the fine land mask, elevation pyramid and `manifest.json` with sha256; DATA_SOURCES updated.
  AT: `npm run data` is idempotent (second run makes no changes); the manifest is verified by a test.
- [x] 0.19 Load-time vector rasterizer (admin-1 → province raster) at S/M sizes in the worker.
  AT: the M raster builds in < 1.5 s in Chromium; the province count matches source minus water; visual check screenshot.
- [x] 0.20 Headless runner `npm run sim` (Node) with per-year metrics JSON.
  AT: toy world 10 years runs and writes metrics; tick ms is reported.
- [x] 0.21 i18n skeleton: `t()`, `en.json`, locale picker, ESLint no-literal-string on `src/ui`.
  AT: a lint fixture with a literal UI string fails; the UI renders keys from en.json.
- [x] 0.22 Phase 0 review: re-read SPEC for drift, update DECISIONS with the benchmark outcomes.
  AT: Gate green; DECISIONS has ADR-4 final status.

## Phase 1 — Baseline parity

### 1A Data & scenario
- [x] 1.1 zod schemas for terrain, unit types, tech, traits, buildings, scenario, map meta; validate all `data/**`.
  AT: `npm test` validates every JSON file; an invalid fixture fails with a readable path.
- [x] 1.2 Terrain derivation (elevation + latitude/biome from NE raster) → terrain classes; CROSSING lanes data (straits list).
  AT: golden counts per class within ±10% of expected; screenshot of terrain mode compared to reference editor shot (logged).
- [x] 1.3 1938 ownership: admin-1 → nation table + split polylines for interwar borders; colonies; mandates.
  AT: tests on known points (Danzig = Free City, Lwów = Poland, Königsberg = Germany, Manchukuo exists, Ethiopia = Italy); screenshot of the political map vs a historical atlas description logged.
- [x] 1.4 Nations data (≥ 100 incl. colonies/dominions as puppets): colours, names, traits, aggression, cores, capitals, alliances (Axis-precursor, Allied guarantees, Comintern), puppets.
  AT: schema pass; every nation has a capital in owned territory; colour contrast check between neighbours (ΔE > 15).
- [x] 1.5 Cities (NE populated places, filtered and named) with capitals.
  AT: every capital is a city; city names render at T1 (screenshot).
- [x] 1.6 Flags: SVG flag spec + preset renderer; 1938 flags for all nations (own designs); flag atlas generation.
  AT: the atlas builds; screenshot of a flag grid reviewed; DATA_SOURCES/DECISIONS note the German flag choice.
- [x] 1.7 Starting OOB per nation (formations of unit templates at historical-ish locations, scaled).
  AT: total strengths per major power within the documented ranges in SPEC/DECISIONS; all formations on owned land.

### 1B Core sim
- [x] 1.8 Calendar/time (1938-01-01, hourly ticks), scheduler (speed, pause, max).
  AT: 1 sim year = 8760 ticks; speed setting persists across reload (e2e).
- [x] 1.9a Boot the 1938 scenario as sim state (split out of 1.9: the economy needs the real world): cells incl. province layer, nations, cities, OOB formations; worker loads the map assets; `?scenario=1938` in the app.
  AT: Node build == political map; worker hash == Node hash; save/load round trip bit-identical; e2e boot screenshot.
- [x] 1.9 Economy: per-cell income weight × terrain × development, monthly tick, gold, expenses (upkeep, admin cost superlinear), incomeBonus −100..100, bankruptcy.
  AT: unit tests per rule; 1938 income ranking plausible (USA, UK, Germany, USSR, France top 5).
- [x] 1.10 Production & recruitment queue; manpower.
  AT: a queued division appears after N days at the capital with cost deducted.
- [x] 1.11 Land movement: coarse nav graph (province adjacency + CROSSING) + cell-level A*, mobility × terrain costs, slotted poses.
  AT: a path test across the Alps is slower than across the plains; a formation never enters water except via crossing.
- [x] 1.12 Supply v1: from capital/cities through the controlled network; attrition when cut.
  AT: an encircled formation's supply → 0 within a day and it attrits.
- [x] 1.13 Engagement + element combat v1 (§5.2) for inf/art/AT/AA.
  AT: Lanchester sanity tests (2:1 force wins with expected loss ratio ±20%); terrain defence matters; FireEvents emitted with valid ids.
- [x] 1.14 Territory pressure + frontier-set flips + connectivity rule.
  AT: a front advances like a wave (cells flipped/day within band); no "teleport" flips behind a defended line; frontier-set size bounded (perf test).
- [x] 1.15 Occupation vs owner, capital capture/relocation, winner-takes-all option.
  AT: unit tests; e2e map shows the occupation tint.
- [x] 1.16 Wars: declaration, war score, exhaustion, peace settlement, broke/exhausted sue for peace, fightToDeath.
  AT: scripted scenarios end in peace with expected terms; fightToDeath never accepts peace.
- [x] 1.17 Alliances/unions with unity & loyalty; join/leave/dissolve.
  AT: low unity → member leaves (test); alliance mode screenshot.
- [x] 1.18 Puppets with autonomy: create/release/integrate/revolt.
  AT: tests per transition; puppet map mode screenshot.
- [x] 1.19 Revolts (per province/per region setting), suppression spending, rebel nation spawn.
  AT: high unrest → revolt within the expected window; suppression lowers probability (statistical test with fixed seeds).
- [x] 1.20 Collapse & revival (finite, cooldown) from cores.
  AT: a dead nation revives at most N times, never before cooldown.
- [x] 1.21 Buffs/debuffs with timers.
  AT: the buff applies and expires exactly at expiresTick.
- [x] 1.22 Combat-efficiency modes (dynamic/progressive/static/locked/random).
  AT: unit test per mode's evolution.
- [x] 1.23 Major Battles + breakthrough corridor.
  AT: a concentration test triggers a Major Battle; the corridor flips cells faster for D days; history entry.
- [x] 1.24 Strategic AI v1 (war/peace/alliance/puppets/coalitions), traits/aggression.
  AT: 10-year headless runs on 3 seeds produce ≥ 3 wars, ≥ 1 peace, ≥ 1 alliance change each.
- [x] 1.25 Operational AI v1 (front allocation, offensives, reserves).
  AT: in a scripted 2-nation war, the larger nation advances; formations are spread along the front (coverage metric).
- [x] 1.26 Economic AI v1 (budget split, build mix).
  AT: no AI nation goes bankrupt in 10 peaceful years on 3 seeds.
- [x] 1.27 Save/load full state + command log, gzip; autosave to IndexedDB.
  AT: I2/I5 pass on the full 1938 world after 1 year; e2e autosave → reload → continue.

### 1C Presentation & tools
- [x] 1.28a T0 renderer: borders without artefacts (analytic border gradient), occupation hatch,
  constant-width borders and coasts; evidence shots of Europe and the world compared to the
  reference; GPU bench within budget. (Split from 1.28, 2026-10-02.)
  AT: e2e finds no border-coloured pixels inside nations (fails on the old shader); bench A T0 ≤ 1.0 ms.
- [x] 1.28b T0 renderer: coastline from the fine land-mask pyramid; terrain map mode.
  AT: screenshots of coasts at T0 zooms viewed (no cell stairs); terrain mode e2e shot.
- [x] 1.29 Curved nation labels (worker derive + MSDF).
  AT: screenshot shows curved, area-sized names for ≥ 20 nations, no overlaps on major ones.
- [x] 1.30a Map modes political, terrain, wars, diplomacy, alliances, puppets, income + legends,
  click to select a nation. (Split from 1.30, 2026-10-02.)
  AT: e2e screenshot of each mode with its legend; wars, diplomacy and income colours checked.
- [x] 1.30b Revolts map mode (per-province unrest choropleth: province raster + unrest texture).
  AT: e2e screenshot with legend; a province set to high unrest renders in the hot colour.
- [x] 1.31a Nation panel (Overview and Economy tabs; chips select nations); worker `nationStats`.
  (Split from 1.31, 2026-10-02.)
  AT: e2e clicks a nation, reads both tabs, follows a chip; screenshots logged.
- [x] 1.31b Statistics ranking (right panel, metric dropdown) and war banners strip.
  AT: e2e ranks by each metric (sorted), banner per active war selects its leader; screenshot vs
  reference layout logged. (Bottom bar, date and speed exist since PLAN 1.8/1.17.)
- [x] 1.32a God Mode commands in SPEC §9 (rename, war, peace, alliance, collapse, spawn
  nation/revolt/battle, buffs, AI) + `sim.inspect()`. Nukes go with PLAN 6.1, control with 1.33.
  (Split from 1.32, 2026-10-02.)
  AT: an e2e test per command asserts the sim effect via `__warsim`.
- [x] 1.32b God Mode UI: a God panel (bottom bar toggle) issuing those commands on the selected
  nation (and map picks for revolt/battle/brush).
  AT: e2e drives each God action through the UI and sees its effect via `sim.inspect()`.
- [x] 1.33a Take control of a nation; select own formations; move/attack orders by map clicks.
  (Split from 1.33, 2026-10-02.)
  AT: e2e takes control of Poland, orders a move, and the formation moves.
- [x] 1.33b Player Actions tab for the controlled nation: diplomacy (declare war, offer peace,
  ally) and production (queue templates with cost and time; see the queue).
  AT: e2e as Poland queues a formation (gold drops, it appears when ready) and declares war.
- [x] 1.34a History log (saved), History panel with filters + CSV/JSON export.
  (Split from 1.34, 2026-10-02.)
  AT: export file contents validated in e2e; filters reduce rows correctly.
- [x] 1.34b Statistics: per-nation series (land, income, gold, military size by domain,
  casualties) sampled monthly + charts.
  AT: series match the sim at sampled months (unit); e2e chart renders the selected nations.
- [x] 1.35 Editor: brush/bucket/line, undo/redo, target mask.
  AT: unit tests on the undo stack; e2e paints, undoes and redoes, with identical raster hashes.
- [x] 1.36 Editor: cities, gold & core costs, alliances, puppets, annex, preset revolts.
  AT: e2e builds a mini scenario using each tool, saves it, loads it and verifies.
- [x] 1.37a Editor: map import (image → terrain/owner palette mapping). (Split from 1.37, 2026-10-03.)
  AT: importing a fixture PNG yields expected cell counts.
- [x] 1.37b Flag editor with presets.
  AT: a flag edited in the editor is shown on the map.
- [x] 1.38 Scenario files save/load (shareable `.warsim-scenario`).
  AT: round trip yields an identical scenario hash.
- [x] 1.39a Settings panel: UI size, unit size, screenshot key (F2), seed + new game; speed/pause
  persistence (since 1.8). (Split from 1.39, 2026-10-03.)
  AT: e2e toggles each and verifies the effect; F2 downloads a PNG.
- [x] 1.39b1 New-game options: looping map, randomisation (aggression, traits, starting gold,
  efficiency mode). (Split from 1.39b, 2026-10-03.)
  AT: e2e starts games with each option and verifies the effect in the sim.
  (1.39b2, map size S–XL: moved to PLAN 7.1b on 2026-10-03, ADR-43. The sim is tuned in cells
  for the M map; sizes need km-based distances, re-tuning, L/XL assets and XL performance.)
- [x] 1.40 Dynamism tuning: `npm run sweep` (10 seeds × 50 years) passes the SPEC §10 criteria.
  AT: sweep report committed in `docs/sweeps/` with all criteria green.
- [x] 1.41 Phase 1 review + PARITY rows updated with evidence.
  AT: Gate green; parity score recomputed.
- [x] 1.42a Tick time back under control before the next full sweep (ADR-48). Profile of year 1,
  seed 99: supply reflood 20%, pathfinding 23%, combat 13%; mean 4.6–5.9 ms after ADR-47 (2.4 ms
  before).
  AT: `npm run sim -- --scenario 1938 --seed 99 --years 5` reports a 5-year mean tick ≤ 1.5 ms and
  a year-1 mean ≤ 2.4 ms on this machine, with the same final hash as before the change
  (5d08e5dd) unless a rule change is logged in DECISIONS.
  Done 2026-10-03: 5-year mean 1.04 ms (was 1.59), year 1 1.92 ms (was 2.74), hash 5d08e5dd, no
  rule change.
- [x] 1.42b Critic B1: coalition armies fight on their partners' fronts (ADR-50). Seed 109
  showed a 28-member coalition at war with a Soviet Union of 78k men for 557 days at score 0:
  only the armies of the nation holding a front counted on it. (Split from 1.42, 2026-10-03.)
  AT: unit tests (an ally's army pushes and defends a partner's front, is supplied there, is not
  sent home; the AI sends an army with no front of its own to its partner's); seed 109 × 50
  years passes the leader-share range (4.4 points; was 2.7).
- [x] 1.42c Critic B1: the build queue of a rich nation at war no longer waits for months for a
  panzer division it cannot afford (seed 109: the Soviet Union built 9 formations in 30 months
  and lost 13, with idle slots and 5 M men in the pool). (Split from 1.42, 2026-10-03.)
  AT: a unit test (when the next order is not affordable the cheaper infantry order is placed);
  the 4-seed check (99, 105, 108, 109 × 50 years) is not worse on any criterion.
  Done 2026-10-03: all four seeds pass all seven criteria (seed 108's newcomers 1 → 3). No
  criterion went from pass to fail; individual numbers moved both ways (PROGRESS).
- [x] 1.42d Critic B1: land is measured by true area, not by cell count (ADR-52; the user's
  decision, 2026-10-03). The map is a Miller projection, so a cell near the poles covers far less
  ground than one at the equator. By cells the Soviet Union starts at 26.8% of the owned land
  and Denmark (Greenland) is in the top ten; by area they are 15.9% and 1.5% (PROGRESS
  2026-10-03 has the table).
  Scope: (a) one shared helper for the area of a cell row, `kx[y] × ky[y]` km² from the nav
  grid's row scales; (b) every land criterion in `tools/sweep` (land moving, largest land, top
  ten by land, leader-share range) uses area, with the thresholds unchanged; (c) the land
  numbers a player sees (statistics series, ranking, nation panel share) use area.
  Out of scope: sim rules that count cells (overextension share, admin cost, war score,
  capitulation, SMALL_STATE_CELLS). That is PLAN 1.42e.
  AT: a unit test on the 1938 start: Soviet Union 21.2 M km² and 15.9% of owned land, USA 9.3,
  Canada 9.1, Denmark 2.0, Australia 8.1, Brazil 8.5 M km², each within ± 3%; total owned land
  133 M km² ± 2%; the criteria fixtures in `tests/unit/sweepCriteria.test.ts` cover the area
  measure; `npm run sim -- --scenario 1938 --seed 99 --years 5` still ends at hash 5d08e5dd (no
  sim rule changed). No sweep is run for this task: the sweep belongs to 1.42.
  Done 2026-10-03 for the helper, the sweep criteria, the ranking and the nation panel: 133.3 M
  km² owned, Soviet Union 21.19 M km² (15.9%), `tests/unit/landArea.test.ts`. The hash named
  above was stale: it dates from 1.42a, before the rule changes of ADR-50, 1.42c and ADR-51.
  Seed 99 × 5 years ends at ac517acf at HEAD (85c2e35) and at ac517acf with this change. The
  statistics series is split off as 1.42d2: it is saved and hashed state, so recording km²
  there moves the hash, which this task must not.
- [x] 1.42d2 Critic B1: the monthly statistics series records land in km² (the land chart).
  The series is part of the state (`World.parts()`), so the hash moves although no rule does.
  Decide what an older save's cell counts show in the chart (reset the land column, or mark
  the series version).
  AT: `tests/unit/stats.test.ts` asserts the land column equals `landStandings` at the sampled
  months; the state hash with the `stats` part left out is identical before and after on seed
  99 × 5 years; the new full hash is logged in DECISIONS (ADR-52 addendum); e2e chart renders.
  Done 2026-10-03: without the stats part dd414d91 before and after; full hash ac517acf →
  93effc58. The section is renamed `stats.km2`, so a save with the old `stats.rows` (cells)
  starts an empty series.
- [x] 1.42f Tick time is over budget again after ADR-50 and ADR-51: seed 99 × 5 years, mean
  1.69 ms (budget 1.5), year 1 3.34 ms (budget 2.4), measured at 85c2e35 on 2026-10-03. PROMPT
  "KEEPING ITERATIONS SHORT": fixed before the next task that needs a full sweep, which is
  the retry of 1.42.
  AT: as 1.42a (5-year mean ≤ 1.5 ms, year 1 ≤ 2.4 ms), final hash 93effc58 (since 1.42d2;
  ac517acf before it) unless a rule change is logged.
  Done before 1.42e (2026-10-03): every sweep that 1.42e and 1.42 need is paid in tick time.
  Step 1, no behaviour change (hash 93effc58): the operational AI skips nations with no free
  formation and reads the frontier by holder. Mean 1.69 → 1.54 ms, year 1 3.36 → 3.15 ms.
  Step 2, a rule (ADR-53, hash f57f70ac): a marching formation keeps its sector. Year 1
  1.95 ms (met); mean 1.56 ms (**not met**, 0.06 ms over, in a world with more wars).
  Left: marches whose sector has gone are re-planned (about 2,000 long searches in year 1),
  0.3–0.4 ms a tick of route searches in all.
  Step 3, no behaviour change (hash 2cb270e6): the corridor and stamps of cell A* are typed
  arrays; replay of year 1's routes −5%, mean −1.0%. Step 4, a rule (ADR-56, hash e5741d70): an
  octile A* bound; replay −17%, year 1 −10%, mean −1.9%. Measured on a machine 1.9× slower; in
  the budget machine's terms the mean is about 1.52 ms (**not met**, 0.02 ms over).
  Step 5, no behaviour change (hash 7a8e5c27 after 5 years): the war pass's land tallies are
  kept by the cell setters instead of a daily scan of the map; 5-year mean −5.8% (interleaved
  runs). In the budget machine's terms 1.43–1.51 ms depending on the baseline (this machine
  drifts ±5% between runs): **not proven here**. Measure on the budget machine, or cut more.
  Done 2026-10-03, measured on the budget machine (the one of `.cache/base5.log`, 1.42a's
  1.59 ms) at 9c6ac4d, idle, after the gate. Rule set before the runs: three runs back to back,
  met only if all three keep both limits. 5-year mean 1.4317, 1.4334, 1.4324 ms (≤ 1.5); year 1
  1.6807, 1.6869, 1.6859 ms (≤ 2.4); hashes e5741d70 after year 1 and 7a8e5c27 after year 5 in
  all three, as steps 4 and 5 logged them. Year 4 is the dearest year now (1.76 ms).
- [x] 1.42e Critic B1: sim rules that count land in cells count area instead (overextension
  share and distance, admin cost, war score and capitulation shares, SMALL_STATE_CELLS), so
  Siberia and northern Canada stop weighing like twice their land. This overlaps the km
  conversion of PLAN 7.1b: do the land-share part here, leave distances and map sizes there.
  Rule changes: an ADR, and tune only on `npm run sweep:quick`.
  AT: unit tests per converted rule; hash change logged in DECISIONS; gate green.
  Split 2026-10-03 into one rule per commit (1.42e1–1.42e3 below); tick this line with the
  last of them. Not converted, left to 7.1b: the overextension distance (`OVEREXT_CELLS`),
  `MILITIA_PER_CELLS` and the largest fragment of a collapse (ADR-57).
  Done 2026-10-03 with 1.42e3.
- [x] 1.42e1 The land rules of a war count km² (ADR-57): score, true share, capitulation, puppet
  share, small-state limit (`SMALL_STATE_KM2` 8,500 = 40 mean owned cells). `LandCounts`
  tallies whole km² per cell, so the kept tallies equal a scan exactly.
  AT: unit tests on cases where cells and km² disagree; kept tallies equal a scan; the pin
  moved with the hashes in DECISIONS; gate green; quick sweep keeps the limits.
  Done 2026-10-03: four new tests in `war.test.ts` (all fail with the tallies counting cells);
  seed 99 after one year e5741d70 → 23734db3, after five 7a8e5c27 → 6738d695; tick, on the
  performance cores: year 1 2.05 ms, 5-year mean 1.37 ms (both in budget).
  Quick sweep (1–10 × 20 years, scratch): limits 10/10, riser 7/10, faller 10/10.
- [x] 1.42e2 Overextension counts km²: a holder's share of the world's owned land
  (`revolts.ts`, `OVEREXT_SHARE` 4% unchanged) is a share of area, read from `LandCounts`.
  By cells the Soviet Union is at 26.8% and Canada at 12.3%; by area 15.9% and 6.8%, and
  Australia (6.1%) and Brazil (6.4%) come above the 4% they were under.
  AT: a unit test where the two measures disagree; pin and hashes in DECISIONS (ADR-57
  addendum); gate green; quick sweep keeps the limits.
  Done 2026-10-03: one new test (Canada's far north stays calm, Brazil's far provinces feel
  the strain; it fails under the cells rule); seed 99 after one year 23734db3 → 6569bc8e,
  after five 6738d695 → 7f1ffbfb; tick, pinned: year 1 2.06 ms, 5-year mean 1.42 ms.
  Quick sweep (seeds 1–10 × 20 years, scratch): limits 10 of 10, riser 8 of 10, faller 10 of 10
  (7 and 10 after 1.42e1); largest nation 12.6–17.1% of the land; wall time 5.9 min.
- [x] 1.42e3 The admin cost counts km² held (`economy.ts`): `adminCost` per 212,000 km² (1,000
  mean owned cells) instead of per 1,000 cells. Measured at the 1938 start, uncapped, summed
  over all nations: 568 gold a month by cells, 470 by mean cells (Soviet Union 253 → 125,
  Canada 89 → 40, Brazil 18 → 37, Australia 20 → 34), 212 by equatorial cells. The mean-cell
  reference keeps the world's total nearest; decide in the ADR, with the quick sweep.
  AT: unit tests (`economy.test.ts` in km²); pin and hashes in DECISIONS; gate green; quick
  sweep keeps the limits; then the tick measured by the three-run rule of 1.42f, pinned to
  the performance cores (PROGRESS 2026-10-03).
  Done 2026-10-03 with the mean-cell reference (`ADMIN_KM2` 212,000; ADR-57 has the table and
  the reason). Charged at the 1938 start, after the cap: the world 554.6 → 461.2 gold a month,
  the Soviet Union 252.7 → 125.3. Seed 99 after one year 6569bc8e → f93cb674, after five
  7f1ffbfb → 6b84c48c. Tick, three pinned runs: 5-year mean 1.4648, 1.4612, 1.4563 ms; year 1
  2.2729, 2.2615, 2.2457 ms: met. The pin is a tool now (`npm run sim -- … --affinity 0xFFFF`).
  Quick sweep (seeds 1–10 × 20 years, scratch): limits 10 of 10, riser 6 of 10, faller 10 of 10
  (8 and 10 after 1.42e2); largest nation 12.2–16.4% of the land and 28.4–29.5% of the income.
  (1.42, critic B1 continued, the dynamism of the long run: moved to Phase 7 on 2026-10-03,
  ADR-58. Balance sweeps are suspended until phases 2–6 are complete.)
- [x] 1.43a Critic B5: a way into the game. `/` opens a title screen, not the two-nation toy
  world: a scenario list with the 1938 world first and the new-game options of 1.39b1. The toy
  world moves behind its own URL (`?scenario=toy`); the tests that open `/` for it move to that
  URL, unchanged otherwise. The settings panel leads back to the title screen and saves first.
  AT: e2e: `/` shows the title screen and no world; choosing 1938 starts it on 1 January 1938
  with the chosen seed and options; the toy world opens by its URL; screenshots viewed.
  (1.43 was split on 2026-10-03 into a, b and c: one cause per commit.)
  Done 2026-10-03 (ADR-60; `tests/e2e/title.spec.ts`, `docs/evidence/1.43/`): the started game
  has the state hash of a Node sim with the same seed and options.
- [x] 1.43b The title screen loads a game: Continue (the autosave, with the seed and options of
  the game that wrote it) and a `.warsim-scenario` file.
  AT: e2e: after Main menu, Continue resumes the autosave at its tick, and a game started
  without a looping map resumes without one; with no autosave there is no Continue; a scenario
  file chosen on the title screen starts its base scenario with the file's state hash; a
  damaged file is refused on the title screen; screenshots viewed.
  Done 2026-10-03 (ADR-61; `tests/e2e/title.spec.ts`, `tests/unit/gameUrl.test.ts`). Found on
  the way and fixed: a continue URL without `looping=0` drew wrap copies of a world that has no
  looping map, and showed seed 1938 for any save. A loaded world now gives the game its looping
  setting (the URL is corrected) and its seed.
- [x] 1.43c The title screen shows the chosen scenario: a political map of its start and its
  number of nations, drawn from the scenario's own data (AoC shows a map preview beside its
  scenario list).
  AT: e2e: the preview shows the scenario's nations in their colours (pixel check against the
  nation colours at known places) and the count equals the sim's; screenshots viewed and
  compared with the trailer frame of AoC's menu.
  Done 2026-10-04 (ADR-62): `public/data/scenarios/1938/preview.png` (1024 × 512, 33 KB), made
  by `npm run data -- --previews` from the shipped assets and the scenario data; a unit test
  fails when it no longer is the map the data gives. 102 nations, equal to the sim's living
  nations. Compared with `reference/frames/scene_006.png` (AoC's Scenarios screen).
- [x] 1.44 Critic B6: the editor's brush and line paint on a left-drag. While a paint tool is
  active the camera pans on a right- or middle-drag and with the keys, not on a left-drag.
  AT: an e2e that drags: a brush stroke across ≥ 20 cells paints every cell under its path,
  the camera does not move, and one undo removes the whole stroke; a right-drag pans and
  paints nothing; with no paint tool active a left-drag pans as before.
  Done 2026-10-04 (ADR-63; `tests/e2e/editorDrag1938.spec.ts`, `tests/unit/editor.test.ts`,
  `docs/evidence/1.44/`): a stroke grows one undo edit; one finger paints and two move the map.
  The pinned hash did not move.
- [x] 1.44b The God Mode territory brush paints on a left-drag too (it is click-only, and a
  drag with it pans the map: the same complaint as B6, in the game instead of the editor).
  AT: e2e: with the God territory tool, a left-drag across ≥ 20 cells gives every cell under
  its path to the selected nation's control and the camera does not move; a right-drag pans.
  Done 2026-10-04 (ADR-63, addendum; `tests/e2e/editorDrag1938.spec.ts`,
  `tests/unit/paintControl.test.ts`): `paintControl` takes a segment (`x2, y2`). The pinned
  hash did not move.
- [x] 1.45a Critic B7, the ghost counters: no half-faded unit layer is left standing. (1.45 was
  split on 2026-10-04 into a and b: two causes. Its text blamed split and merge fades that do
  not finish while paused; measured, they do finish. The ghosts are the T0 ↔ T1 cross-fade,
  which went by zoom over 2000–2600 m/px: a camera resting at 2446 m/px showed the counters at
  0.84 and 356 markers at 0.16 behind them, paused or not.) The handover between the T0
  counters and the T1 markers becomes a state with hysteresis and a cross-fade in time.
  AT: e2e on the 1938 start over Europe, paused and running: at rest anywhere in that band,
  from either side, one unit layer is drawn at full opacity and the other not at all; the
  cross-fade takes 250 ms and never pops; PLAN 2.2's continuity test passes unchanged;
  screenshots viewed.
  Done 2026-10-04 (ADR-64; `tests/e2e/handover1938.spec.ts`, `tests/unit/handover.test.ts`,
  `docs/evidence/1.45/`).
- [x] 1.45b Critic B7, the wall of counters: Europe readable at world zoom. T0 counters are
  decluttered in screen space (no two overlap; what does not fit is aggregated into its
  neighbour, never hidden).
  AT: e2e on the 1938 start and after one year, at world zoom over Europe, paused and running:
  no two counter boxes overlap; the sum of the counters still equals the sim's strength
  (PLAN 2.2); screenshots compared with `reference/` frames and viewed.
  Done 2026-10-04 (ADR-65; `tests/e2e/declutter1938.spec.ts`, `tests/unit/counters.test.ts`,
  `docs/evidence/1.45/declutter-*.png`): a counter that would touch a stronger one folds into
  it, across nations too; the stronger shows the sum and "+n" nations. PLAN 2.2's continuity
  test passes unchanged. "No two overlap" is asserted for counters drawn in full: one fading
  into a neighbour overlaps it for the 250 ms of its fade. AoC has no counters to compare with
  (it prints a strength beside each nation's name); compared with the critic's own crop.
- [x] 1.45c Capital flags do not hide unit counters. The flags are drawn above the unit layers
  (PLAN 2.1, so that capitals stay readable), and at 3 px per cell over Europe they cover the
  numbers of counters standing at a capital (Rome, Helsinki, Lisbon in
  `docs/evidence/1.45/declutter-europe-start.png`).
  AT: e2e at 3 and 6 px per cell over Europe, at the 1938 start: no capital flag covers any
  part of a counter's box (the counter is drawn above it, or one of the two makes way);
  screenshots viewed.
  Done 2026-10-04 (ADR-65, addendum; `tests/e2e/flagsClear1938.spec.ts`,
  `docs/evidence/1.45/flags-clear-*.png`): the flag makes way. It stands just above the
  counter it would cover, up to 40 px from its usual place, and is left out beyond that.

## Phase 2 — Semantic zoom

- [x] 2.1 T1 operational markers (symbol, flag chip, strength bar + number, order arrows, battle markers).
  AT: the strength number equals the sim Σ element strength (e2e reads both).
- [x] 2.2 T0 aggregated counters with stable multi-level clustering + split/merge animation.
  AT: zooming T0↔T1 shows no frame where a counter vanishes without a matching animation (frame-diff check on a recorded sequence).
- [x] 2.3 Element snapshot path (interest-managed) + GPU-interpolated element sprites at T2 (facing, walk/drive anim).
  AT: 10k visible proxies ≥ 30 fps (bench); I4 still passes.
- [x] 2.4a FireEvent visuals: tracers, muzzle flashes, impacts (ADR-66; first answer to critic B2).
  AT: e2e counts tracers in the viewport against FireEvents in the same window (equal).
  The window is one tick: `tests/e2e/fire1938.spec.ts` takes the events from the sim in Node.
- [x] 2.4b Casualty removal and wrecks (ADR-67; split from 2.4, as it needs an event of its own): an
  element that dies emits `ElementDestroyed` (not state); its sprite goes with a visible end and
  a wreck stays where it stood for a while, on the render clock.
  AT: e2e at T2 over a battle: every `ElementDestroyed` in the window has one wreck at its
  position, no sprite of a dead element is drawn, and the pinned hash does not move.
- [x] 2.5 Casualty consistency across tiers (ADR-68: `spawnFormation` takes a template, so that
  God can spawn a battle).
  AT: e2e kills elements at T2 (God-spawned battle) → T0 counter strength drops by exactly the same amount.
- [x] 2.6 T3 close expansion (vehicles exact, infantry ≤ 64 sprites, count = strength).
  AT: e2e compares the individual count to the sim strength for 20 random elements.
  The rule (ADR-69): `min(strength, 64)` figures. `tests/e2e/individuals1938.spec.ts` checks every
  element of three divisions, and names 20 by a seeded draw.
- [x] 2.7a Slots stay: an element keeps its place in its formation's block when others die (ADR-70; split
  from 2.7: the sprites of a block re-formed in one frame when deaths took its count across a step of the grid).
  AT: after such deaths the snapshot draws every survivor where it stood (unit, and e2e over an hour of
  battle); the pinned hash does not move.
- [x] 2.7b Fade curves & hysteresis for all layers: T1 ↔ T2 and T2 ↔ T3 are states with hysteresis and a
  cross-fade in time, as T0 ↔ T1 is (ADR-64).
  AT: scripted zoom recording: max per-pixel luminance jump between consecutive frames below threshold in unit areas (no popping).
  Read as: the luminance is compared over the frames of each tier change at a fixed camera (16 ms apart,
  the unit layers alone); a zoom moves every edge by pixels a frame, which is not popping. Between camera
  steps the layers' opacities are compared instead.
- [x] 2.7c The marker → elements morph: the box shrinks into the group and fades, the strength bar lingers (ADR-72).
  AT: the frames of the T1 → T2 change keep the luminance limit of 2.7b; a marker's box is smaller in each
  frame of the change and its strength bar is still in full at half of it.
- [x] 2.7d The layers that are not units (ADR-73): the capital flags switch at 3 px per cell in one frame, and the
  city labels fade by a curve of the zoom (a resting camera can show them half-faded).
  AT: the luminance limit of 2.7b over the flags' and labels' areas when the camera steps across their
  thresholds; at rest every label and flag is in full or absent.
  A flag that moves to keep clear of a counter while the camera steps is left out of the comparison:
  that is motion, with its own spec (`flagsClear1938`).
- [x] 2.7e The curved nation names (ADR-73, addendum): a name appears in one frame when its size reaches 9 px or a
  collision with another name ends, and goes the same way.
  AT: the luminance limit of 2.7b over the names when the camera steps across such a zoom; at rest
  every name is in full or absent.
- [x] 2.7f The counters' cluster level comes to rest (ADR-74, finding 1). `CounterLayer.layout` judges the
  level wanted against the level a finished split or merge has just left. Where the bands of two
  levels overlap it starts the way back, and that one's end does the same: at a resting camera
  the counters split and merge every 250 ms, for ever.
  AT: unit: (a) level 3, zoom to 3.7 levels, back to 3.5 within 100 ms; (b) an eased burst of 4–6
  wheel notches from each of 129 starting zooms. Each ends with one level and `animating` false
  within a second of the camera resting.
  Done 2026-10-04: the level wanted is judged after a finished change is taken over. Before: 69 of
  516 eased bursts never rested. Also `tests/e2e/countersRest1938.spec.ts`: four notches of one
  flick at T0; two seconds at rest draw no frame.
- [x] 2.7g A destroyed nation's capital flag goes with it (ADR-74, finding 2). The view only ever adds to
  its capitals; the snapshot has every nation's row, dead ones too, with the last capital.
  AT: e2e: a nation is annexed; no flag of it is placed after the next snapshot, at a zoom where it
  was placed before.
  Done 2026-10-04: the snapshot says whether a nation lives (`NationField.living`); the view drops
  the capital of one that does not. `tests/e2e/flagGone1938.spec.ts` (Poland annexed by Germany),
  `tests/unit/serverNations.test.ts`.
- [x] 2.7h The sprites keep their clock when a snapshot repeats a tick (ADR-74, finding 3). A new subscription
  (a pan), a pause or a change of speed sends the same tick again, and the element sprites and
  figures start their walk through the tick again from where it began.
  AT: at T2 with the game running slowly, a pan in the middle of a tick moves no sprite backwards.
  Done 2026-10-04: the clock starts with a new tick only; the same tick at another length goes on from
  the progress reached. `tests/e2e/tickClock.spec.ts` reads the sprites' progress through the tick
  (`MapView.tickProgress`) across a pan, a change of speed and a pause: before, 0.38 → 0.00 on a pan.
- [x] 2.7i Sprites and figures wear the nation's own colour in every map mode, as the markers and counters do
  (ADR-74, finding 4). They take the map mode's palette, when they are uploaded: in the wars
  mode both sides are one red, and a change of mode while paused leaves the old tints.
  AT: e2e: in the wars mode two belligerents' element sprites at T2 have the tints of their T1
  markers; a change of mode while paused changes no sprite.
  (Made exact, 2026-10-04: "the tints of their markers" meant made from the nation's own colour as
  the markers are, not from the mode's palette. A sprite's tint is that colour lightened, by design,
  so it is not the marker's colour itself. The test: every nation's sprites have one tint, the same
  in all eight map modes, before and after a tick in each.)
  Done 2026-10-04: `nationColor` reads the own colour. `tests/e2e/spriteColours1938.spec.ts`: before,
  in the wars mode Japan's and Manchukuo's sprites were both 236,195,191; now 248,247,241 and
  238,227,201 in every mode.
- [x] 2.7j Figures that fade out are of the snapshot in hand (ADR-74, finding 5). Leaving T3, a tick that
  arrives during the 250 ms leaves the figures of the tick before, drawn with the new tick's clock.
  AT: the figures drawn while the close handover runs are built from the element section last received.
  Done 2026-10-04: the figures are built for as long as they are drawn (the close tier on, or its fade
  running). `tests/e2e/figuresFadeOut1938.spec.ts`: a division removed during the fade has no figures in
  a frame of it. Before: 1,584 of the 3,168 figures drawn were of elements no longer in the snapshot.
- [x] 2.7k A nation's name keeps its state when the camera crosses the seam of a looping map (ADR-74, finding 6).
  The state's key holds the absolute wrap offset, which changes there.
  AT: unit: a name held at 8.2 px is still placed, in full, after a pan across x = 0.
  Done 2026-10-04: a name's state is kept by nation; the copies near the seam share it
  (`fadeNationLabels`). `tests/unit/nationLabelLayout.test.ts`, "a name on a looping map". The key
  in three older tests of that file changed from '7:0' to 7 with the format: the same assertions.
- [x] 2.7l What the counters show at rest does not depend on the frames drawn on the way there. Seen
  2026-10-04 in a gate run under load: `declutter1938`, "start, 1.5 px per cell", central Europe had 2
  counters where every other run has 3 (the step before has 2; the spec wants more). All were in full
  and none overlapped: one counter was folded into a neighbour, or not, by how the frames of the split
  fell. A fold holds until the counter clears its neighbour by the hold distance (PLAN 1.45b), so the
  state at rest remembers the animation. Find out whether that is all of it.
  AT: unit: from the same camera step, frames 16 ms apart and frames 200 ms apart end with the same
  counters shown. If the hysteresis must stay path-dependent, the spec's step is changed to one that
  does not sit on it, and the reason is in DECISIONS.
  Measured 2026-10-04, before the task (a scratch script, not in the repo: `CounterLayer.layout` and
  `fold` on the formations of the 1938 start, a glyph taken as 6.2 px wide, the camera stepped from the
  world view): it does depend on the frames.
  - To 1.5 px per cell: 102 counters shown at rest with frames 16–60 ms apart, 101 at 120–200 ms, 100 at
    400–1000 ms; central Europe 4, 4 and 3.
  - To 3 px per cell: 161, 161, 160, 161, 160, 158, 158, 158 for 16, 25, 33, 60, 120, 200, 400, 1000 ms,
    and not the same counters at 16 and 25 ms.
  So the fold state at rest remembers the split's frames. A direction to try: decide the folds on where
  the counters of a split are going, not on where they are in flight.
  Done 2026-10-04 (ADR-75): the hold is a memory of the layer at rest. A split or merge on its way is
  folded without it and leaves none (`CounterLayer.hold`, `fold(…, flying)`, `declutter`).
  `tests/unit/counters.test.ts`, "the counters at rest after a step of the camera": the same keys with
  frames 16 to 1000 ms apart, after splits and merges; the same from any level; the same as a view
  opened at that zoom. `tests/e2e/declutter1938.spec.ts`, the second test: the frames drawn by the
  test, 16, 60, 200 and 1000 ms apart, over the five stops of the first test. Both fail on the code
  before. Central Europe at the stops: 2, 5, 17, 56, 58 (before 2, 3, 17, 45, 58).
  - Not the direction above: with the children born held it lands on 2, 3 for ever (ADR-75, rejected).
  - "Whether that is all of it": for a step, yes. An eased zoom still ends with other counters in 62
    of 192 cases (136 before): BLOCKERS watch list.
  - `flagsClear1938` asserted a count of one of the pictures this zoom had (41 of 41 flags); it asserts
    the rule now, for each capital. ADR-75 has why that is not a weaker test.
- [x] 2.7m The view draws again after a frame that started an animation, however late the next frame
  comes. `MapView.frame` asks "is anything animating?" before it draws. A frame that starts a split
  (or any timed change) and is followed by a gap longer than the animation is followed by no draw at
  all: the counters stay on their parents' centroids, at the first frame of the split, until
  something else redraws. Found while doing 2.7l; `settle` in the specs draws by itself, so no spec
  sees it.
  AT: with the frames driven at times the test gives, a camera step and then one frame 400 ms later:
  the view has drawn the end of the split (the counters at rest, in full, at the new level).
  (Made exact, 2026-10-04: one late frame lands the split and starts the fades of the counters that
  come out there, so "in full" is not after one frame. The test: a step, then turns of the loop 400 ms
  apart until one draws nothing; the view then rests on the picture that frames 16 ms apart end with.)
  Done 2026-10-04: the loop asks after the draw, at the draw's own time, whether a unit animation is
  unfinished, and draws the next frame if so (`MapView.frameAt`, the loop's turn at a given time).
  `tests/e2e/lateFrame1938.spec.ts`: five steps over Europe (a split, T0 → T1, T1 → T0, a merge), 400 ms
  between frames. Before: one draw a step and no more; the level and the markers' share were those of
  the stop before (the markers' share 0 at the T1 stop, 1 back at T0).
- [x] 2.7n At the closest zooms the figures of a formation are there wherever the camera looks at it
  (ADR-74, second read, finding 1). Three causes, split 2026-10-04 when the task was taken: 2.7n1–n3,
  one commit each. Ticked when the three are.
  - [x] 2.7n1 The worker sends a formation's elements when its block reaches into the subscribed box,
    not when its centre is in it (`elementSection`). Below about 5 m/px the box is smaller than a
    division (28 elements stand ±2,055 m by ±880 m): with the camera on a flank the snapshot had none
    of it.
    AT: unit, the worker: for a view of 1280×720 and of 1920×1080 at 1, 2, 3 and 5 m/px centred on any
    element of a division, the snapshot has every element of that division that is in the view.
    Done 2026-10-04: `blockReach` (the far corner's slot and half a slot more) widens the box for a
    formation's centre; a formation is sent whole or not at all. `tests/unit/serverElements.test.ts`,
    three divisions (blocks of 28, 53 and 6 slots), the camera on each of their elements. Before: the
    28-slot division had an element in view and not in the snapshot in 24 of its 28 views at 1 m/px on
    1280×720 (21 on 1920×1080), 14 and 14 at 2 m/px, 14 and 7 at 3 m/px; the 53-slot one in 50 of 53 at
    1 m/px and still in 18 at 5 m/px.
  - [x] 2.7n2 The view subscribes again when its box has moved by a part of itself, at every zoom
    (`maybeSubscribe`). It subscribes again only when the box, rounded to quarter cells, has changed.
    At 1 m/px a quarter cell is 4,892 px, two and a half screens: a pan onto a formation can leave the
    old box, which does not hold it. Run by the reader: 271 of the 1,054 formations of the 1938 start
    can be reached by a 1280×720 view at 1 m/px from 0.1 cells (1,957 px) to the west without a new
    subscription.
    AT: unit: for cameras from the world view down to 1 m/px, two cameras with the same subscription
    key: the view of the second is inside the box subscribed by the first.
    Done 2026-10-04: the key is the box rounded to a step that is a part of the box (a power of two
    of cells between a 32nd and a 16th of its smaller half-size: 14 to 28 px on a view 720 px high),
    and the step. `viewSubscription` in `src/app/subscription.ts`, out of `MapView`.
    `tests/unit/subscription.test.ts`: 39,600 pairs of cameras from 0.35 px per cell to 1 m/px on
    three view sizes; a pan of a quarter of the view asks again at every zoom; a pan of 2 px mostly
    does not. Before: of the pairs with one key the second view was outside the first box in 2,115 of
    11,053, and a pan of a quarter of the view asked nothing from 10 m/px down.
  - [x] 2.7n3 A formation's stand-in sprite is never larger than a marker. With no elements in the
    snapshot every formation is drawn as a stand-in of 0.9 cells (`drawSprites`): 147 px at 120 m/px,
    17,611 px at 1 m/px, which covers the view in the nation's tint when a formation's centre is a few
    kilometres away (traced by the reader, not run).
    AT: e2e, 1938, paused: at 1 m/px with the camera 5 km from the nearest formation's centre, no sprite
    drawn is wider than 48 px; a pan of a screen onto a division's flank shows its figures.
    (Made exact, 2026-10-04: the camera is 3.2 km from the division's centre, the nearest place from
    which nothing of the division is sent; there no pixel of the sprite layers is lit. The size of a
    stand-in is read where one is drawn at rest, in the toy world, whose formations have no elements.)
    Done 2026-10-04: a stand-in is at most 48 px (`STAND_IN_MAX_PX`; `ProxyRenderer.draw` takes a
    largest size). `tests/e2e/closeZoom1938.spec.ts` reads the sprite layers alone, drawn on cleared
    canvases. Before: 3.2 km from a division at 1 m/px all 921,600 px of the view were lit, and the
    toy world's stand-in was 485 px across at 200 m/px. Now: none lit; 32 px at 200, 30, 5 and 1 m/px.
    On the division's flank, 2,235 m from its centre: 28 elements, 1,584 figures, and the same after
    a pan away and back. `docs/evidence/2.7/close-on-a-flank-1m.png`.
- [x] 2.7o A formation that takes the id of one destroyed in the same step does not arrive from where
  that one stood (ADR-74, second read, finding 3). The worker judges "new this tick" by whether the id
  was alive before; freed ids are reused last-in-first-out, and revolts create formations after combat
  has destroyed some. The snapshot then carries the dead formation's place as the new one's previous
  place: its sprite crosses the map in one tick.
  Run by the reader: toy world, a remove and a spawn in one step: the new formation at (157.79, 20.00)
  has the previous place (57.37, 67.78), where the removed one stood. 1938, seed 99, three years: once
  in 26,280 ticks, 18.5 cells (362 km).
  AT: unit, the worker: a formation removed and one created in the same step, the new one with the
  freed id: its previous place in the snapshot is its own place. Elements likewise.
  Done 2026-10-04: a table counts how often each id has been given out (`Table.generation`: not
  serialized, not hashed, read by nothing in the sim), and the worker takes a formation for new when
  the count under its id has changed since the step began. `tests/unit/serverElements.test.ts`,
  "previous places in snapshots": in the 1938 world a formation is removed and a division spawned in
  one step; the division has the removed one's id. Before: its previous place was (1100.2, 267.2),
  where the removed one stood, 480 cells from its own. Every other formation still comes from where it
  was before the step. The pinned hash of seed 99 is unchanged.
- [x] 2.7p A pan at T3 from empty ground onto a formation shows its figures, not its T2 sprites first
  (ADR-74, second read, finding 2; traced by the reader, not run). A snapshot with no elements turns
  the close tier off (`tierShares`: no figures built, so `share(Infinity)`); the next one, with
  elements, turns it on from 0. For the 250 ms of that fade the element sprites are drawn in full, at
  0.026 cells: 102 px each at 5 m/px, 509 px at 1 m/px.
  AT: e2e, paused, at 5 m/px: the camera steps from ground with no formation onto a division; in the
  first frame that has its elements the figures' share is 1 and no element sprite is drawn.
  Done 2026-10-04: with no elements at all the close tier stays as the zoom has it; only elements
  whose figures cannot be drawn keep their sprites (`tierShares`). `tests/e2e/closeZoom1938.spec.ts`,
  the third test: the view's own frames read as they are drawn, for half a second from the first
  that has the division's elements. Before: the figures' share in that first frame was 0.00 (the
  reader had traced this; here it ran). Now 1.00 in every frame, 1,584 figures. A share of 1 is no
  element sprite drawn: `drawSprites` draws them only below 0.99.
- [x] 2.7q A world loaded into a running game takes the place of everything of the old one in the view
  (ADR-74, second read, finding 4; traced by the reader, not run). `MapView.apply` sets a nation's
  capital and colour for each row of the snapshot and removes none: after a scenario file is imported
  into a game in which a revolt made a nation, the loaded world has no row for it and its flag stays
  at its last capital.
  AT: e2e: a nation is spawned by God, a scenario file exported before that is imported; no flag is
  placed for an id the loaded world does not have.
  Done 2026-10-04: what the view keeps by nation (colour, capital, alliance leader, overlord, income)
  is emptied and filled from each snapshot, which has a row for every nation of its world.
  `tests/e2e/loadedWorld1938.spec.ts`: the start of 1938 exported, a revolt in Masovia (nation 104, a
  new row), the export loaded. Before: the flag of 104 was still placed (the reader had traced it;
  the test ran it). Now no flag of an id the loaded world lacks.
- [x] 2.7r City names stay readable among the T0 counters and the capital flags. The counters are drawn
  over the city names, and a capital's name stands beside the dot its nation's army often stands on.
  Seen in the review pass of 2026-10-04, in the evidence shots made again
  (`docs/evidence/2.2/counters-europe-4000m.png`, `counters-europe-2300m.png`): Paris, Berlin, Prague,
  Budapest, Danzig, Brussels and Luxembourg read as fragments.
  Measured over Europe at the 1938 start (a scratch spec; boxes that touch, which counts a little too
  much): of the city names shown, a counter's box is on 18 of 31 at 4000 m/px, 18 of 27 at 3000,
  11 of 18 at 2300; a capital flag on 23, 8 and 7.
  AT: e2e over Europe at 4000, 3000 and 2300 m/px, at the 1938 start: no city name that is shown has a
  counter's box or a capital flag on it; at least 25, 22 and 14 names are shown (four in five of
  today's), so that the names are not simply left out; screenshots viewed.
  (Made exact, 2026-10-04: "on it" is on the name's letters, not on its box with the padding and
  the line spacing. A capital's own flag touches that box by a pixel for 19 of the 22 names the first
  measure counted, and covers nothing. By the letters, before: a counter on 17 of 31 at 4000 m/px, a
  flag on 3.)
  Done 2026-10-04 (ADR-76): a name takes the first place by its dot that is clear of the frame's
  counters and flags: beside the dot, or past the counter that stands there, or above. It keeps its
  place to the pixel while nothing stands on it, and takes another by a cross-fade.
  `tests/e2e/cityNames1938.spec.ts`: no name under a counter or a flag at the three zooms, and 30, 27
  and 18 names shown (of 31, 27 and 18: Luxembourg has no place at 4000 m/px); four seconds at top
  speed, no name's box moves while it shows. `tests/unit/cities.test.ts`, 8 new.
  `docs/evidence/2.7/city-names-*.png`.
- [x] 2.7s T1 markers of a dense group do not stand on each other. Seen in PLAN 1.45a and left without a
  task (ADR-65, "not solved here"). Measured in the review pass of 2026-10-04 on Spain's front after
  two weeks (a scratch spec): at 1800 m/px 60 markers, 97 pairs overlap and 10 markers are more than
  half under another; at 1200 m/px 48, 39 and 7; at 600 m/px 40, 10 and 5. The number of a marker
  underneath cannot be read.
  AT: e2e, Spain's front after two weeks, at 1800, 1200 and 600 m/px: no marker's box is more than a
  quarter under another's; the numbers on the map still add up to the strength of the formations in
  view (PLAN 2.1); screenshots viewed.
  Split 2026-10-04, when the task was taken, by a second measurement (a scratch spec; "deep": one box
  more than a quarter under another; a marker is 26 × 29 px). Ticked when both parts are.
  - Deep pairs of one nation and of two nations: Spain 29 and 19 at 1900 m/px, 24 and 19 at 1800, 13
    and 0 at 1200, 7 and 0 at 600, 6 and 0 at 340, 5 and 0 at 310. North China 10 and 4 at 1900, 4
    and 2 at 1800, 1 and 0 at 1200, none closer.
  - *Pushing the boxes apart, each at most 13 px from its formation,* does not come to rest on
    Spain's front at any zoom and leaves 2 to 8 deep pairs: formations of one nation that stand on
    one spot cannot be parted within half a marker.
  - *Stacking by nation* (a marker more than a quarter under a stronger one of its nation goes into
    it) leaves no deep pair at 1200 m/px and closer; at 1800 and 1900 it leaves 9 and 8 pairs of two
    nations on Spain's front, 2 in north China.
  - *Stacked, then pushed apart:* rests after one round on Spain's front (16 markers moved, by 3 px at
    most), after four in north China (5 px): nothing left.
  - [x] 2.7s1 Markers of one nation that stand on each other are one marker: the strongest, with the
    men of all of them as its number and how many it stands for. The others go into it by a fade,
    and come out by one; a marker in a stack stays there until it is well clear (no flicker while
    the armies move).
    AT: e2e, Spain's front after two weeks at 1200 and 600 m/px: no marker's box is more than a
    quarter under another's; every formation in view is stood for by exactly one marker, and a
    marker's number is the men of the formations it stands for. Unit: the stacking as a pure
    function (the strongest leads; the hold). `counters1938` (no popping through T0 ↔ T1) passes.
    - `markers1938` asserts for every marker that its number is its own formation's men. With
      stacks that becomes the sentence of the AT above, which says more (every formation is
      counted once). The ADR of the task argues it, as ADR-75 did for `flagsClear1938`.
    Done 2026-10-04 (ADR-77): `stackMarkers` and `MarkerStacks` (`src/render/units/markerStacks.ts`).
    A marker more than a quarter under a stronger one of its nation goes into it and stays until it
    is under it by less than a tenth; the lead shows the men of all and a tag "×n", drawn above
    every box. `tests/e2e/markerStacks1938.spec.ts`: Spain's front after two weeks, at 1200 m/px 37
    markers for 48 formations (stacks of 4, 3, 3, 2, 2, 2, 2), at 600 m/px 33 for 40; no pair of one
    nation more than a quarter under each other (before: 13 and 7). `tests/unit/markerStacks.test.ts`,
    11. `counters1938`, `fades1938`, `morphNations1938` pass unchanged.
    - Two existing specs say for stacks what they said for single markers: `markers1938` (a
      marker's number is the element sum of the formations it stands for, each formation in one
      marker) and `handover1938` (while the game runs the marker layer is in full when its most
      opaque marker is, as it already said of the counters). ADR-77.
  - [x] 2.7s2 What is left at the far end of T1, markers of two nations on each other across a front,
    is cleared by moving the boxes apart by a few px (by an ease, kept while the quarter rule holds,
    never during the morph into T2).
    AT: e2e, Spain's front after two weeks at 1800 and 1900 m/px: no marker's box is more than a
    quarter under another's; no box is more than 6 px from its formation.
    Done 2026-10-04 (ADR-77, addendum): `nudgeApart` moves the shown boxes of a pair that is too
    much on each other apart by half each, along the shorter way, at most 6 px from the formation.
    A box keeps its move while the armies move under a camera at rest, eases to a new one over
    150 ms, and does not move during the morph into T2. `tests/e2e/markerStacks1938.spec.ts`, the
    second test: at 1900 and 1800 m/px no pair more than a quarter under each other (7 at 1900
    before), 12 boxes moved, by 3.2 px at most; at 1200 m/px none moved.
    `tests/unit/markerStacks.test.ts`, 6 new.
- [x] 2.7t A city's name is readable where a nation's name crosses it. The curved nation names are drawn
  above the city names: at T0 a capital's name is often under the letters of its own nation. Seen in
  the pictures of PLAN 2.7r (`docs/evidence/2.7/city-names-4000m.png`, `city-names-3000m.png`): Berlin
  under the "y" of Germany, Warsaw under Poland, Budapest under Hungary, Rome under Italy, Brussels
  under Belgium. Not measured yet.
  AT: e2e over Europe at 4000, 3000 and 2300 m/px, at the 1938 start: no letter of a nation's name is
  drawn over the letters of a city name that is shown (the order of the layers, or the city names keep
  clear of the nation names' glyphs, or the nation names of them); the nation names of `labels1938`
  are still placed; screenshots viewed.
  Done 2026-10-04 (ADR-76, addendum): the order of the layers. The nation names are drawn on the
  city layer's canvas, under its dots and names; the overlay above keeps the units and the flags.
  `tests/e2e/cityNames1938.spec.ts`, the second test, reads the overlay's pixels inside the letters
  of every city name shown: none drawn at the three zooms. Before, measured by that test at
  4000 m/px: something over the letters of 11 of 30 names (Berlin 505 px, Rome 442, Riga 355,
  Budapest 326, Warsaw 282, Lisbon 179, Tirana 141, Ankara 90, Bern 76). `labels1938`,
  `labelFades1938`, `flags1938` and `mapModes1938` pass unchanged.
- [x] 2.7v The T1 markers come to rest (ADR-74, third read, finding 1; a defect of PLAN 2.7s2). `nudgeApart`
  starts from the moves of the frame before. Where three or more shown markers are crowded beyond
  what 6 px can part, its result fed back to it goes round a cycle: the targets change by more than
  0.01 px a frame, and the layer says for ever that it animates. A paused view at T1 then draws every
  frame, and `settle` in a spec would throw.
  - Run by the reader on 1938, seed 99, sampled every 10 days for 540 days at six zooms from 2000 to
    500 m/px: 29 of 324 samples never rest, the first at day 90. At ticks 0, 1 and 336, where the specs
    look, all rest.
  - Run here: three markers at px (18.57, 16.65) of nation 2, (10.4, 1.19) of nation 1 and (11.66,
    14.84) of nation 4. Fed its own output 40 times `nudgeApart` gives 31 different results; the
    layer, given those three every 16 ms, still animates after 4,000 frames.
  AT: unit: those three markers, and 3,000 random clusters of 2 to 8 markers: the layer, given the
  same markers every 16 ms, is at rest within 20 frames. e2e: 1938, seed 99, paused at day 90, at
  2000 m/px over cell (1080, 306): the view comes to rest.
  Done 2026-10-04 (ADR-77, second addendum): `nudgeApart` starts every box on its formation in every
  call: where the boxes stand is a function of where the formations stand. `tests/unit/markerStacks.test.ts`,
  "the moves come to rest": both failed before (the three markers never rested; of the 3,000 clusters,
  the first three that never rested are in the failure). `tests/e2e/markerStacks1938.spec.ts`, the
  third test, at six zooms over (1080, 306) at day 90. Before: 400 frames, the test's limit, at 1950,
  1700 and 1100 m/px. Now 21 to 35 frames at every zoom.
- [x] 2.7w A marker that goes into a stack fades where it stands (ADR-74, third read, finding 3; a defect of
  PLAN 2.7s2). A box that was moved apart from another nation's marker loses its move in the frame
  it goes into a stack: it jumps back onto its formation, up to 6 px, in full, and then fades.
  Run here, the reader's case (a of nation 7 at px (0, 0), b of nation 7 at (19.6, 0), c of nation 8 at
  (19.6, 12); b's army moves 0.2 px towards a): b is drawn at (19.60, −5.02), and in the next frame
  at (19.40, 0.00), both at opacity 1.
  AT: unit: in that case b is drawn, in the frame it goes into the stack and in every frame of its
  fade, where it was drawn the frame before (but for the 0.2 px its army moved).
  Done 2026-10-04 (ADR-77, third addendum): a box on its way into a stack keeps the place it is
  drawn at until nothing of it shows; one that comes out before then eases from there.
  `tests/unit/markerStacks.test.ts`, "a marker that goes into a stack fades where it stands", 4 tests,
  3 of them failed before: the reader's case (b drawn at (0, 0) from its formation, not (0, −5.02));
  one that comes out in mid-fade; armies moving at random, 40 games of 150 ticks (before: steps of
  3.6 to 4.7 px at full opacity in the first three found; now none over a step of the ease, 1.9 px).
- [x] 2.7x A table loaded larger than it was still tells its rows apart (ADR-74, third read, finding 2; a
  defect of PLAN 2.7o). `Table.deserialize` makes `alive` and the columns anew at the loaded size and
  leaves `generation` at its old length. For ids beyond it the count is not a number: the worker
  takes every such formation for new in every tick, and its sprites jump from tick to tick.
  Run by the reader: a toy game with 141 formation ids saved and loaded into a fresh one (capacity
  128): over 48 ticks the 624 moves of ids 128 to 140 were all sent with the previous place equal to
  the place. It needs a save with more ids than a fresh world has room for (toy 128, 1938 2,048): no
  shipped path makes one yet.
  AT: unit, the worker: that case; every formation that moved is sent with the place it had before
  the tick. And the snapshot that follows a load sends every formation from its own place: the
  places of the world before the load are not its previous places.
  Done 2026-10-04: `Table.deserialize` keeps `generation` as long as the table (ADR-74, the entry of
  2.7o). `tests/unit/table.test.ts` (1 new) and `tests/unit/serverElements.test.ts`, "previous places
  after a load" (2 new): the first of each failed before (the count array 4 long for a table of 41;
  formation 128 sent in tick 0 as coming from where it stood after it). The third held before too:
  the worker takes the places anew after a load.
- [x] 2.7y Decide what a pause in mid-tick does to the sprites, and make it so (ADR-74, third read,
  finding 4; traced by the reader). `tickProgress` is 1 when the game is paused (SPEC, PLAN 2.7h:
  "the sprites stand where the tick has them"), so a pause at progress p of a tick moves every
  marching sprite by the rest of its step in one frame. Measured by the reader on 1938, seed 99
  (2,271 moves of a tick): the median step is 0.073 cells and the largest 0.277: 14 px (54) at
  100 m/px, 48 px (181) at 30 m/px.
  AT: e2e at T2, the game running slowly: a pause in the middle of a tick; no sprite's place changes
  by more than a frame's share of its step between two frames, and the sprites are at the tick's end
  once the tick's time has run. Or, if the jump is kept: the reason in DECISIONS.
  Done 2026-10-04 (ADR-74, the entry of 2.7h): decided for the first. On a pause the sprites finish
  the step they are on at the length the tick had, and then stand where the tick has them.
  `tests/e2e/tickClock.spec.ts`, its third and fourth parts, restated: it had "paused: 1". It reads
  the sprites' progress, the one number that places every sprite at every tier, at each reading and in
  each frame drawn. Before: a pause at 0.31 of a tick put the progress 0.50 ahead of the clock
  between two readings and 0.60 between two frames; no frame drawn on the way. Now never ahead of
  the clock nor behind it (0.000 and 0.000, in three runs); a frame asked for straight after the
  pause's own is drawn; 3 or 4 frames drawn on the way, the last at 1.
- [x] 2.7u City names keep clear of the T1 markers, as they do of the T0 counters (PLAN 2.7r left it; it
  was on the watch list). Seen in the review pass of 2026-10-04 in the T1 evidence made again
  (`docs/evidence/2.1/markers-poland-1000m.png`: Warsaw and Poznań under markers).
  Measured at the 1938 start by the pixel check of PLAN 2.7t (the overlay inside the letters of each
  city name shown; a scratch spec): over central Europe something is drawn over 12 of 30 names at
  1800 m/px (Berlin 70% of its letters, Bern and Turin all of them), 8 of 25 at 1000 m/px, 1 of 13 at
  500; over Poland 7 of 23, 5 of 16 and 1 of 9; over Spain 5 of 14, 2 of 13 and none of 7.
  AT: e2e, 1938 start, over central Europe and Poland at 1800, 1000 and 500 m/px: the overlay has no
  pixel drawn inside the letters of a city name that is shown; at least four in five of today's names
  are shown (24, 20 and 10 over central Europe); with the game running, no name's box moves while
  it shows; screenshots viewed.
  Done 2026-10-04 (ADR-76, addendum): the names' obstacles are the unit layer that is shown or coming
  in: the T1 markers (box, bar and number, a stack's tag) and the Major Battles as the T0 counters
  were. `tests/e2e/cityNames1938.spec.ts`, the third test. Nothing drawn over the letters of a name
  at any of the six views; names shown over central Europe 28 of 30, 23 of 25, 13 of 13, over Poland
  21 of 23, 14 of 16, 9 of 9. Running at top speed at 1000 m/px for four seconds: no jump, 18 to 25
  names shown. Left out: Prague at 1800 m/px and Warsaw at 1000, with Turin, Kiev and Kraków
  (BLOCKERS). `docs/evidence/2.7/city-names-t1-*.png`, viewed.
- [x] 2.7z On the way back from T2 the T1 markers stand where they will rest (ADR-74, fourth read, finding 1).
  At T2 no markers are drawn and the layer forgets its moves (`markerStacks.clear()`). On the way
  back the boxes "do not move while they grow" (`still`, ADR-72), and `still` takes each box's place
  from the moves in hand: there are none, so every box stands on its formation for the 470 ms of the
  morph, and markers of two nations that rest parted are on each other meanwhile. When the morph ends
  they ease apart over 150 ms. The city names (PLAN 2.7u) take their places against the boxes not yet
  parted, and some change place again 530 to 620 ms after the zoom.
  - Run here, the layer: two markers of two nations 16 px apart rest parted by 1.88 px each, a quarter
    under each other. After `clear()`, in every frame of the way back they are 0.38 under each other,
    with no move; then 0.35, 0.28, 0.24 as they ease.
  - Run by the reader, made-up armies and cities: three markers of three nations up to 0.44 under each
    other for the whole morph; in 13 of 40 runs a name in full took another place after the morph
    (14 names, 33 to 39 frames after the zoom).
  AT: unit: a layer that has been cleared, drawn `still`: each lead stands, from the first frame,
  where `nudgeApart` puts it, and nothing moves when `still` ends. Markers that had moves before
  `still` keep them (the way into T2: as now). e2e, 1938 start, over a front where boxes are parted
  (Spain, as `markerStacks1938`): a zoom from T2 back to 1800 m/px: no pair of shown boxes of two
  nations is more than a quarter on each other in any frame in which the boxes show in full, and no
  box's place from its formation changes after its first frame.
  Done 2026-10-04 (ADR-77, fourth addendum): in `still`, a box with no move to keep stands where
  `nudgeApart` puts it. `tests/unit/markerStacks.test.ts`, "back from T2", 2 tests, both failed
  before. `tests/e2e/markerStacks1938.spec.ts`, the fourth test, Spain's front after two weeks, from
  250 m/px to 1800: 40 markers, 14 of them parted at rest. Before: boxes moved by up to 2.71 px
  after their first frame, 5 pairs and more over a quarter with the boxes in full, at rest after 46
  frames. Now none moves, no pair, at rest after 36.
- [x] 2.8 Procedural detail tiles (ground texture, trees, rocks, buildings near cities) by world-seeded noise, plus hillshade from the elevation pyramid.
  AT: screenshots at 4 zooms show increasing detail; the same location renders identically across reloads (image hash).
  Done 2026-10-04 in its parts, 2.8a to 2.8c2. Its own AT: four zooms with more detail at each
  (`ground1938`: 0.00, 1.2, 2.0 and 4.3 of 255 from a pixel to the next at 1000, 250, 60 and 5 m/px;
  `docs/evidence/2.8/ground-alps-*.png`, viewed); the same place the same after a reload (`ground1938`,
  `hillshade1938`, `groundThings1938`: hashes equal on two loads at T2 and T3).
  Split 2026-10-04 (ADR-78) by the way each part is drawn: each has its own cost, test and way to
  fail. What all three keep to:
  - *Nothing pops:* the detail comes in by the share of the T1 → T2 handover, as the sprites do
    (`fades1938` measures it), not at a threshold of the zoom.
  - *The same on every reload:* a function of where on the map and of nothing else; no clock.
  - *No cost where it does not show:* at T0 and T1 the map pass does what it does today (bench A on
    the clean tree, RTX 4070 Ti at 1080p: 0.51, 0.48 and 0.45 ms of GPU a frame; budget 1.0), and
    the e2e stage, on a software rasteriser, stays near its 5.5 minutes.
  - *Every map mode:* the detail is laid on the fill, whatever the fill shows.
  - [x] 2.8a Hillshade. The elevation level of the map's size reaches the renderer (the worker loads
    it with the land mask; one sample a cell), and the map pass shades the land by its slope, the
    light from the north-west.
    AT: e2e, 1938: at T2 over the Alps the land's brightness varies with the relief (a measure of
    spread inside one nation's fill, against the same view without the layer); at T0 and T1 the map
    canvas is pixel for pixel what it was before the task; the picture of one T2 view is the same
    after a reload (hash); `fades1938` passes unchanged; the toy world, which has no elevation,
    draws as before; bench A within the budget; screenshots viewed.
    Done 2026-10-04 (ADR-78, addendum). `tests/e2e/hillshade1938.spec.ts`, 3 tests; with the data
    reaching the renderer and no shading yet, two of them failed (the picture with the layer was
    the picture without it).
    - Over the Alps at 250 and 100 m/px the largest fill's brightness varies by 23 of 255, and
      its slopes that face the light are brighter than those that face away by 44 and 45.
    - At 8000, 4000, 1000 and 400 m/px the map's hash is what it was before the task, with the
      layer and without it; at 250, 100 and 20 m/px the picture without the layer is the old one.
    - The Rockies at 150 m/px, two loads: one hash.
    - Bench A (RTX 4070 Ti, 1080p), GPU ms a frame: the world 0.51, 4 px a cell 0.48, 48 px a
      cell 0.45, as before; with the ground at 48 px a cell 0.53, at 400 px a cell 0.52.
    - `docs/evidence/2.8/hillshade-alps-250m.png`, `-100m.png`, viewed: broad, soft relief, no
      cell shows; at 100 m/px it is a slow wash of light and dark (one sample in 20 km: 2.8b).
  - [x] 2.8b Ground texture. Noise seeded by the place modulates the fill by terrain class, with finer
    octaves coming in from T2 to T3, and gives the hillshade the small relief the data has not (one
    sample of elevation in 20 km): bumps by terrain class, large in mountains, faint on plains.
    AT: e2e: screenshots at 4 zooms from T1 to T3 show more detail at each (a measure of local
    contrast that rises from one to the next), viewed; at 1 m/px no streaks and no repeat in the view
    (the finest octave is built so that f32 holds: looked at for that); the hash of one T2 and one
    T3 view is the same after a reload; the seam of the looping map shows no line; `fades1938`
    passes; bench A within the budget.
    Done 2026-10-04 (ADR-78, second addendum). `tests/e2e/ground1938.spec.ts`, 3 tests (two failed
    on the hillshade alone: its detail fell with the zoom, 0.26, 0.05, 0.00), and
    `tests/unit/ground.test.ts`, 3 tests of the table of grounds.
    - Over the Alps a pixel differs from the next by 0.00 of 255 at 1000 m/px, 1.2 at 250, 2.0 at
      60 and 4.3 at 5; the Hungarian plain at 60 m/px: 0.5.
    - The Rockies at 1 m/px: 2.2 across and 2.1 down; 252 blocks of 64 px, 252 different. At 150,
      5 and 1 m/px, two loads: the same three hashes.
    - The seam at 150 and 10 m/px: across it 0.13 and 0.64, elsewhere 0.20 and 0.71.
    - `fades1938`: the T1 → T2 change 43.1 of 255, as before. T0 and T1: the hashes of before 2.8.
    - Bench A, GPU ms a frame at 1080p: T0 and T1 0.52, 0.48, 0.46 (as before 2.8); with the
      ground 0.82 at 48 px a cell and 0.88 at 400 (the hillshade alone: 0.53 and 0.52). This is
      the number before 2.8c's instances; SPEC's budget at T2 is 2.0 with 10,000 sprites.
    - `docs/evidence/2.8/ground-*.png`, viewed: the Alps read as a shaded relief, the plain as
      faint mottling, the Rockies at 1 m/px as rough ground with a fine grain; the fills keep
      their colours.
  - [x] 2.8c Instances: trees in forest cells, rocks on mountain cells, buildings around cities. A
    scatter seeded by the place, drawn as instanced quads, capped.
    AT: unit: the scatter is a pure function of the cell and its class (the same twice; none on
    water; denser in forest than on plains; buildings fall off with distance from a city by its
    size). e2e: at T2 and T3 over a forest, a mountain range and a metropolis the instances show,
    viewed; the hash is the same after a reload; they come and go with the handover; frame cost
    measured at T2 with the cap reached.
    Split 2026-10-04 (ADR-78, third addendum): where they stand, then how they are drawn.
    - [x] 2.8c1 The scatter (`src/render/map/scatter.ts`): the instances of a view, a pure
      function. A nested lattice, 2^l points to a cell at level l: an instance stands at one
      place whatever the zoom, a nearer view adds instances between those that are there, and
      the next finer level comes in by its opacity. Trees and rocks by terrain class, buildings
      by how near a city is and how large; nothing on water, by the cell and by the fine coast.
      A symbol of a few px at T2, the thing's own size once that is larger.
      AT: unit: the first AT above, and: a pan shows the same instances where two views
      overlap; every instance of a view is in the view at twice and four times the zoom; a
      step of 1% of zoom changes no opacity by more than a tenth; the cap; the seam.
      Done 2026-10-04: `tests/unit/scatter.test.ts`, 10 tests. Each of three faults put in on
      purpose is caught (the finer level in at once; a place that depends on the level shown;
      the seam not wrapped). Cost in Node, 1920 × 1080, all forest: 0.4 to 1.2 ms a scatter
      for 4,400 to 10,900 instances.
    - [x] 2.8c2 The draw: the scatter's instances as instanced quads over the map, under the
      units; a tree, a rock and a building each drawn by the fragment shader, lit from the
      north-west as the ground is; by the handover's share.
      AT: the e2e AT above (a forest, a mountain range, a metropolis at T2 and T3, viewed; the
      hash after a reload; with the handover; the frame's cost with the cap reached, on the
      bench and in the e2e stage's length).
      Done 2026-10-04 (ADR-78, fourth addendum): `GroundInstances.ts`, drawn by `MapView` between
      the map and the sprites. `tests/e2e/groundThings1938.spec.ts`, 3 tests.
      - A forest at 150, 20 and 3 m/px: 3,230, 3,800 and 5,434 trees; mountains: 1,666, 2,152 and
        3,053 rocks (383 to 568 trees); Berlin: 39, 1,871 and 5,661 buildings. Of the instances
        looked at (91 to 419 a view) every one is drawn where the scatter put it. None truncated.
      - A forest at 150 and 5 m/px on two loads: the same counts and hashes.
      - 320 → 280 m/px: none at T1; then 16 frames of change, no pixel by more than 7.9 of 255
        from one frame to the next; the whole change 71.
      - Bench A (1080p, RTX 4070 Ti), 8,685 instances scattered, uploaded and drawn in every
        frame: 0.84 ms of GPU a frame (the ground without them: 0.86), 0.5 ms of CPU. The e2e
        stage's length is in the commit.
      - `docs/evidence/2.8/things-*.png`, viewed: a wood of dots, rocks on a mountainside, a
        town of red and slate roofs along two streets' directions around Berlin's dot.
- [x] 2.9 Coastline from the fine mask at T2/T3; elements never rendered on water.
  AT: e2e samples element positions at T3 near coasts against the mask (0 violations).
  Done 2026-10-04 in three parts (2.9a, 2.9b1, 2.9b2). The AT: `coastElements1938` (360 elements
  of 20 formations at T3 by a coast, 0 on the mask's water) and `coastPicture1938` (202 elements,
  0 with the drawn sea under them).
  Split 2026-10-04 (ADR-79). Measured first, 1938, seed 99, by the nearest bit of the fine mask
  (16384 × 8192, 8 px to a cell): at the start 200 of 23,210 elements stand on its water, in 18
  formations, 11 of them wholly (their formation's own place is on water: a cell is land when half of
  it is, and its middle need not be); 162, 353 and 124 after 30, 90 and 365 days. None is more than
  half a cell from land.
  - [x] 2.9a Formations stand on land by the fine mask, and so do their elements (the sim). The sim
    has the mask (it had only the cells' terrain). Where a formation takes a place that the mask
    calls water (the middle of a coastal cell, a place by a city on the shore), it takes the cell's
    land point instead: the point of the cell that is furthest from water. An element whose slot is
    on water all the same (a spit narrower than the block) stands on the nearest land towards its
    formation. One predicate, in `src/shared`, for the sim, the renderer and the tests.
    Not in it: a formation on the march between two cells' land points can cross a bay (routing;
    watch list).
    AT: unit, 1938: at the start and after 30 and 90 days no formation at rest has its place on the
    mask's water, and no element of a formation at rest stands on it (today: 200 at the start);
    the place of an element in a snapshot, in a fire event and in the event of its end is one
    place. e2e, 1938 at T3 near coasts: the element places the view holds, against the mask the
    worker sent: 0 on water. The pinned hash of seed 99 moves (formations' places are state):
    logged in DECISIONS; no sweep (ADR-58).
    Done 2026-10-04 (ADR-79, addendum). `src/shared/landMask.ts` (the predicate and a cell's land
    point), `World.onLand`, `cellPoint`, `standPoint`, `slotPlace` in `systems/elements.ts`.
    - `tests/unit/coast1938.test.ts` (3) and `tests/unit/landMask.test.ts` (4). Seed 99 at the
      start, after 30 and 90 days: of 1,054, 677 and 294 formations at rest none is on the mask's
      water, and none of their 23,210, 15,587 and 5,915 elements; 8, 6 and 6 elements are drawn in
      from a slot on water. On the march: 0, 0 of 134 and 1 of 430 formations over water.
    - What was seen first is the measurement above the split (200 elements on water at the
      start): the committed tests use what the task added and cannot run on the code before.
    - `tests/e2e/coastElements1938.spec.ts`: the 20 formations nearest the mask's water at 5 m/px,
      360 elements in the view: 0 on water. `elements1938` (the browser's world has the Node hash),
      `wrecks1938`, `fire1938`: unchanged.
    - The pin: seed 99 after one year f93cb674 → f5725b37, after five 6b84c48c → 68e0a69e. A
      world built without the mask still gives f93cb674.
  - [x] 2.9b1 A place to stand on is surely land: in a land pixel of the mask, and land in any
    picture drawn from the mask (the sim; split out of 2.9b on 2026-10-04, ADR-79's second
    addendum). 2.9b's shore wanders inside a mask pixel, as it must to be a shore. With the rule
    of 2.9a (the pixel's bit) an element could then stand in the drawn sea: with the coast drawn
    from the mask and that rule, 5 of 193 elements of the 12 formations nearest the water (14
    with the coverage's coast); with this rule, none. The pin moves a second time.
    AT: unit: `maskField` and `maskSure` (a pixel's bit at its middle, a half on a straight
    coast, never surely land in a water pixel; safe for the shore's noise at its largest);
    1938: at the start and after 30 and 90 days every formation at rest and every one of its
    elements is surely land.
    Done 2026-10-04: `src/shared/landMask.ts` (`maskField`, `maskSure`, `SURE_LAND` 0.85,
    `SHORE_NOISE` 0.35, `cellInland`), `World.onLand`. `tests/unit/landMask.test.ts` (6) and
    `coast1938.test.ts`, which with the stronger reading fails on 2.9a's rule (elements of
    formation 367 at the start). 16, 8 and 8 elements are drawn in from their slots now (8, 6, 6).
    - The pin: seed 99 after one year f5725b37 → 99c1a04e, after five 68e0a69e → b203bc49; a world
      without the mask still f93cb674.
    - The tick: combat asks for every shot's place, and asking the mask each time doubled the
      tick (4.92 ms for 2.45, a year unpinned). A cell's answer is kept once it is known to be
      inland. Pinned, five years: 1.45 and 1.44 ms; on the code before 2.9a 1.50 and 1.49.
  - [x] 2.9b2 The coast is drawn from the fine mask at T2 and T3 (the renderer; 2.9b as it was
    written, less the sim's rule above). Today the coast at
    every zoom is the 4096 × 2048 coverage (2 texels to a cell); the mask has 8. The pass with the
    ground reads the mask's bits (packed, eight to a texel, if a texture as wide as the mask does
    not fit) and draws the coast where they say; inside a mask px, 2.4 km, the line is moved by
    the ground's noise by less than half a px, so that a coast at 1 m/px is not a ruler's edge and
    never says other than the bit. From T1 the coast changes to it with the handover's share. The
    scatter of 2.8c keeps off the water by the same predicate.
    AT: e2e: at T2 and T3 on a coast, land and water in the picture agree with the mask's bit
    at sampled places further than half a mask px from the coast (0 against); no element sprite's
    middle is on a water pixel of the picture; the coast at T1 is as it was (hash); `fades1938`
    passes; screenshots viewed; bench A within the budget.
    Done 2026-10-04 (ADR-79, third addendum). The mask's bits as a texture of 2048 × 8192
    (`MapRenderer.setLandMask`); in the pass with the ground the four mask pixels round a
    fragment, blended (the rule of `maskField`), with a noise of at most `SHORE_NOISE` where they
    differ; land over a half. The scatter asks `maskSure`.
    `tests/e2e/coastPicture1938.spec.ts` (3 tests); pictures in `docs/evidence/2.9/`, looked at.
    - Land and water against the mask, nine views (Dover, the Aegean, a fjord of Norway; 150, 40
      and 10 m/px), at places 6 px apart whose 3 × 3 mask pixels are all the one: 0 against. On
      the commit before: 2 places of the mask's land drawn as sea at Dover, 150 m/px.
    - Elements: 202 of the 12 formations nearest the water, 0 with the drawn sea under their
      middle. 0 on the commit before as well: 2.9b1's rule had cleared the 14. A guard.
    - T0 and T1: the Strait of Dover at 4000, 1000 and 400 m/px is the same picture with the
      ground and without it, and has the same three hashes on the commit before.
    - The handover: the two coasts cross-fade. A first version blended the two fields; the shore
      then moved across the pixels between the coasts, each from sea to land in one frame, and
      `groundThings1938` failed on it (51.3 of 255 in a frame; its limit is 48). `fades1938`:
      T1 → T2 43.1, as before.
    - Lakes that the coverage is too coarse for are in the picture at T2 now. Two pictures of
      2.8 are shot again for it (a lake in the mountains' view; in the Alps' at 250 m/px the
      coast line of a lake's shore at the frame's lower edge, 154 px).
    - Bench A (1080p, RTX 4070 Ti), two new views with a coast through them, the ground in
      full: 0.748 and 0.705 ms with the coverage's coast, 0.775 and 0.735 ms with the mask's.
      T0 0.52 ms (0.51).
- [x] 2.10 Scripted seamless zoom demo (world → close on an active battle), 8 stops, screenshots.
  Also decide ADR-69's open choice at the close stops: how a battalion's losses show at T3 (ADR-71).
  AT: Playwright test passes; screenshots viewed; PARITY row for semantic zoom gets evidence.
  Split 2026-10-04: the demo and the choice are two causes, and the choice is to be made from
  the demo's pictures (ADR-71 hands it on that way).
  - [x] 2.10a The demo: one camera path from the whole world down to 1 m/px on a battle of the
    1938 scenario's own (a front that fights, found by a run in Node, not a battle God made),
    in eight stops that cross all three tier boundaries, each tier at rest at least once, the
    two closest on the battle. The game is paused and stepped between stops; the path is drawn
    frame by frame on a clock of the test's own, so that a loaded machine changes how long the
    test takes and not what it sees.
    AT: e2e: in every frame of every leg no unit layer's share moves by more than a fade's
    step (seamless is measured on the shares: while the camera moves, pixels move); at each
    stop, at rest, the one layer of that tier is there in full and the subscription is that
    tier's; the battle is in the picture at every stop (its counter, its marker, its elements,
    its figures) and it fights at the close stops (fire or wrecks drawn); the sim's hash is
    what the same steps give in Node. Eight screenshots in `docs/evidence/2.10/`, looked at.
    The PARITY row of the semantic zoom gets them as evidence.
    Done 2026-10-04 (ADR-71, addendum). `tests/e2e/zoomDemo1938.spec.ts`: seed 1938, day 30, a
    Japanese division in the pocket by Nanking (6,594 men; its 40 battalions at 123 to 197 of
    500, its 5 batteries at 3 to 5 of 12 guns), found by rule. Stops at 27,830 (the world),
    6000, 1500, 500, 150, 50, 12 and 3 m/px, 328 frames in all, a minute alone.
    - The closest stop is 3 m/px, not 1: at 1 m/px one battalion fills the view, and 2.10b
      needs battalions and batteries in one picture. 1 m/px has `closeZoom1938` and `ground1938`.
    - Every leg: the largest step of a share 0.096 (the limit 0.12), none back, the battle
      never 1 px from its place on the screen (700, 326).
    - Each stop at rest in its tier. The battle's counter ("457.1k", then "14.7k"), its marker
      (in a stack of two, then alone: "6.6k"), its 45 elements with Node's strengths and
      places, its figures (2,579 at 12 m/px). The hash is Node's after the month and after
      each of the four hours stepped at the close stops; 57 to 60 shots by or at it an hour.
    - Not test first: no older code fails it. That the measure sees a jump was tried: with a
      fade of 20 ms it fails at the first boundary (a step of 0.896).
    - The eight pictures were looked at. The two closest show what 2.10b decides: every
      battalion draws its 64 figures at a third of its strength; the batteries beside them
      show 3 to 5 guns of 12.
  - [x] 2.10b How a battalion's losses show at T3: ADR-69's open choice (the cap of 64 figures
    hides them until the battalion is nearly gone), decided from 2.10a's two closest pictures,
    where a battalion that has lost men stands by one that has not. The candidates of ADR-69:
    the strength as a number under each element, or figures by the share of the element's full
    size (which the snapshot would have to carry). Recorded in DECISIONS either way.
    AT: written when the choice is made; if the look changes, the two pictures are shot again.
    **The choice (2026-10-04, ADR-80, in place of ADR-69's count): by the share.** A battalion
    has 64 figures when whole and its share of them while it loses men, rounded up. Guns,
    tanks, planes and ships stay a figure each. A number under the block would have captioned
    a picture that still said 500 men.
    AT, as written then: unit: the count for every strength of a battalion (a man lost takes a
    figure or none, a battalion with men has a figure, the share to within a figure) and the
    exact kinds; a mechanised battalion keeps its grid as it loses; the worker sends every
    element's size. e2e: `individuals1938` and the demo, to the figure, against the sim in
    Node. The demo's two closest pictures shot again and looked at.
    Done 2026-10-04. The snapshot's element section has `size` (the unit type's element size);
    `figureCount(strength, size)`; the grid is the whole element's (`gridSide(frame, whole)`).
    - Seen first: on the code before, `individuals1938` (restated) has 1,584 figures where the
      rule gives 1,580, and the demo 64 figures for a battalion of 142 where the rule gives 19.
    - The demo's division: 861 figures where it had 2,579; its battalions 16 to 26 each.
    - Restated, for the user to overrule: `tests/unit/individuals.test.ts` (the count, and the
      grid by the whole element) and `tests/e2e/individuals1938.spec.ts` (each element's
      figures). Both asserted ADR-69's cap.
    - The demo's pictures now come out the same on every run for the four far stops (a second
      of rest before each picture: a capital's flag and a nation's name were mid-fade at the
      first). The four close ones differ by the walk animation's phase, which is the clock's.
    - Pictures: `docs/evidence/2.10/stop-7-battalions.png` and `stop-8-men.png` shot again and
      looked at; the six of `docs/evidence/2.6/` shot again (they were from before the ground
      of 2.8).
- [x] 2.11 Phase 2 review: re-read SPEC for drift, PARITY rows updated with evidence, and the
  smoke run of ADR-58: one `npm run sweep:quick`, not a balance verdict.
  AT: the five limits of the quick sweep are in PROGRESS; a limit that fails is in BLOCKERS,
  or fixed if a defect of this phase's feature caused it. No constant is tuned for it.
  Split 2026-10-05: the review is several causes. It is a review pass (PROMPT step 9): the
  count of numbered tasks starts again with it.
  - [x] 2.11a The smoke run: one `npm run sweep:quick`, on the phase's code as gated
    (`29053c1`). Its five limits in PROGRESS; a limit that fails in BLOCKERS, or a task if a
    defect of this phase's feature caused it. Run once, not again after the tasks below.
    Done 2026-10-05: seeds 1 to 10, 20 years, 4.3 minutes. The five limits hold on all ten
    seeds; no run stopped. Not a verdict on the balance (ADR-58); the numbers are in PROGRESS.
    **Found the same day to have run on a world with the defect of PLAN 2.11i** (formations
    walking round the map). "Run once" was written before that was known: it is run once
    more on the code after 2.11k, as PLAN 2.11n.
  - [x] 2.11b The independent read (ADR-74) of everything written since the last one
    (`ece4b2f`: PLAN 2.7z to 2.10b, 23 source files, 1,261 lines added). The whole of it: the
    last read was narrowed, and this is the phase's. Each finding is checked against the code
    here before it is anything; those a player can meet become tasks 2.11e and on, each with
    a test that fails first; the rest go on the watch list.
    Done 2026-10-05 (ADR-74, addendum: the fifth read). Five findings, every one run by the
    reader in Node; 356,000 tokens, 33 minutes. Checked here: four run again with the
    reader's scripts, one read against the code; all hold. A suspicion of the reader's was
    settled here in the browser and is a sixth.
    - Tasks, most severe first: 2.11i (a march between two neighbouring cells is taken for
      the seam and flies round the world: a regression of PLAN 2.9a), 2.11j (a loaded game
      does not go on as the game that was saved: older than this phase), 2.11k (a formation
      mustered in a theatre does not stand on sure land), 2.11l (the trees of T2 are scattered
      for a far zoom during the fade out), 2.11m (the map's canvas is not opaque where sprites
      and trees blend: the page's colour shows through).
    - A line under PLAN 7.4, not a task: back from T2 with the camera still zooming, the T1
      boxes are up to 6 px from where they rest and ease there in 150 ms.
    - The rest: BLOCKERS, in the block of the watch lists.
  - [x] 2.11c The watch lists of the phase: 17 blocks in BLOCKERS wait for this review. Each
    item becomes a task, a line under the later phase that covers it, a carry with the reason
    it waits, or is closed. Two are looked at now and not carried: the division that stands
    and is flagged as moving (PLAN 2.10b), and how long the worker's start takes with the land
    mask (PLAN 2.9a).
    Done 2026-10-05. Sixteen lists, some ninety items (the seventeenth match was a line inside
    one). Three tasks before Phase 3 (2.11e, f, g below); lines under PLAN 4.1, 4.7, 7.1 and
    7.4; the rest carried with a reason or closed, in one block in BLOCKERS that names where
    everything went.
    - The division that stands: `moving` means "has a march", and `movementSystem` holds a
      formation that is `engaged` where it is. The view walks whatever is `moving`. PLAN 2.11e.
    - The start with the mask: the first frame 0.22 s after navigation, the map layers and the
      mask at 0.95 to 1.09 s, the first snapshot at 1.1 to 1.4 s (five starts, alone, the
      tests' rasteriser); the mask is read and unpacked in 15 ms in Node. Closed.
  - [x] 2.11d SPEC re-read for drift (§3.1, §8, the map's rendering); the PARITY rows of the
    phase with their evidence; code that nothing uses since the last pass deleted (a commit of
    its own, gated).
    Done 2026-10-05, but for PARITY, which goes last (2.11h): its evidence is the pictures,
    and the tasks below change what T2 and T3 look like.
    - SPEC, five passages that no longer said what is built: the tier table's T2 row (the
      coast from the fine mask; roads near cities are not built: a line under PLAN 7.4) and T3
      row ("full-res procedural detail tiles": the same ground for each pixel, finer; no tiles,
      ADR-78); the snapshot table's elements row (the fields as built, with `size`); where the
      ground's instances stand (sure land by the mask, not the coverage); and a sentence that
      still promised the coastline from a "land-mask pyramid".
    - Dead code: none found. Every export of the phase's new modules is used by another
      source file, inside its own, or by a test. Two that look unused and are not:
      `maskLand` (the tests' own reading of the mask since the sim asks `maskSure`) and
      `MapView.hasFineCoast` (five specs wait on it).
  Tasks that come out of 2.11b and 2.11c follow as 2.11e and on. 2.11 is ticked when they
  are done; then the critic runs (PROMPT step 2a).
  The order below is the order of work: the sim's three first (a regression of this phase,
  a broken invariant, a rule that missed a path), then what is drawn.
  - [x] 2.11i A march between two neighbouring cells is not a crossing of the seam. (The fifth
    read, finding 1; a regression of PLAN 2.9a.) `movementSystem` takes a step whose two ends
    are more than 1 apart in x for a step across the map's seam and turns it round. That was
    the seam's mark while every place was a cell's middle. Since 2.9a a cell's place can be
    its land point, and two neighbours' points are up to 1.9 apart: the step is then walked
    the long way round the map, some 100 cells an hour, facing along it.
    - Seed 99, the first year: 90 formations, 1,587 formation-hours more than 3 cells off
      their march, the furthest 1,024 cells (seed 1938: 56 and 909). 10,393 of 1,839,530
      pairs of walkable neighbouring cells can do it; lakes too (Constance, Geneva).
    - A formation that is engaged on its way stays there: a Polish division fought the French
      for 30 hours 15 cells off its march; 942 shots in the year were by or at formations that
      were off. A new order in flight starts from where the formation is: two Soviet
      divisions ended 347 cells away (seed 1938, tick 8341).
    - Nothing saw it: `coast1938.test.ts` skips formations on the march; `movement.test.ts`
      has one march, over no such pair; the pinned hash holds whatever the code does; the
      smoke sweep's limits were green with it.
    AT: unit, failing first: on the 1938 map, a march over a pair of neighbouring cells whose
    points are more than 1 apart in x (the test finds one by the mask) stays within a cell
    and a half of both cells at every tick and faces along the step; a march across the true
    seam still goes the short way. 1938, seed 99, the first 60 days: no formation's place
    changes by more than its speed allows in an hour. The pinned hash moves: old and new in
    DECISIONS (ADR-55). No sweep (ADR-58; the phase's one is run).
    Done 2026-10-05 (ADR-79, fourth addendum). `movementSystem` turns a step round when its
    ends are more than half the map apart in x, as the rest of the sim measures across the
    seam. Three tests in `tests/unit/movement.test.ts`:
    - 80 marches over 40 pairs of neighbouring cells whose points are more than 1 apart in x
      (the map has more than 1,000 such pairs of one nation's land): never more than 3 cells
      from the start, facing along the step. Failed first: in the first hour formations were
      190, 366 and 73 cells from their cells.
    - A march across the true seam (Chukotka) stays within 2 cells of it. Passed before and
      passes now: a guard for the new test of the seam.
    - Seed 99, 60 days, every formation on the march, every hour: none more than a cell from
      where it was. Failed first at hour 112 (formation 494, 66 and then 99.9 cells an hour).
    - The pin: seed 99 after one year 99c1a04e → 4aafc3eb, after five b203bc49 → daffda22. A
      world without the mask: f93cb674 still (there every place is a middle, and the old
      test and the new agree).
    - The tick, pinned, five years: 1.164 ms twice (1.45 before: another world, with fewer
      battles in wrong places; not faster code).
    - The zoom demo finds the same division; a month in it now has 4,948 men (6,594 with the
      flights: the Chinese division that flew, 494, is one it fights).
    - The first gate failed on `declutter1938.spec.ts`: one of its assertions was of where
      formations stood a year into seed 1938. Restated to what the fold guarantees and
      flagged (ADR-79, fourth addendum).
  - [x] 2.11j A game loaded from a save goes on as the game that was saved. (The fifth read,
    finding 2; older than this phase.) SPEC §2.6 has it as I2, "must always pass". On the 1938
    world it does not hold for every save: a load forces a full refresh of the supply network
    (`World.load`: `supplyDirty = true`), while the game that goes on refreshes only the blocs
    whose cells changed, and the two can give a crossing lane to different blocs
    (`supply.ts` says so itself). Seed 99 saved at tick 2400: one tick later 3 cells of
    Bab-el-Mandeb differ, by tick 3120 strengths and gold, and the year ends on another hash.
    Saves at ticks 100, 700 and 1500 go on alike. The tests of I2 are on the toy world or 49
    ticks from the start.
    AT: unit, failing first: seed 99 saved at a tick where the two refreshes differ, loaded
    into a fresh world: the same hash and the same sections as the game that went on, a tick,
    a day and a month later. How (the load keeps what a partial refresh needs, or a partial
    refresh is made to give what a full one gives) is the task's decision, in DECISIONS, with
    SPEC §2.6 and the line on loading brought to agree. The pinned hash: unmoved if the load
    is made to follow the game; moved and logged if the game's own refresh changes.
    Done 2026-10-05 (ADR-81). The choice: a refresh of some blocs is made to give what a full
    one gives, so the marks stay "not state" as the code always said, and the save does not
    change. Two things were in the way, and the reader's lane was only one:
    - *Lanes.* A lane that a refreshed bloc no longer reached stayed unclaimed though a
      neighbour reaches it; a lane held by a higher bloc stayed with it though a lower one now
      reaches it. Now such a refresh is done again in full.
    - *A puppet that is annexed.* Its cells lay in its overlord's network, and the refresh
      looked up its bloc when it ran, by when it had none: the cells stayed in the overlord's
      network under their new holder (seed 3, tick 1885: 28 Albanian cells in Greece's network,
      held by Yugoslavia). Now a changed cell marks the bloc in whose network it lay.
    - Tests, all failing first: unit, two directed (a lane released: 0 where the rule gives the
      neighbour; the annexed puppet: 114 cells left in the overlord's network). In the year
      file of the gate: seed 3 beside a game that refreshes in full every time, a hundred days
      (parted at tick 1885 before); seed 3 saved at tick 1890 and loaded (another hash a day
      later, before).
    - Beyond the tests: the two games side by side for a year on seeds 3, 7 and 1938: the
      networks never differ and the hashes are equal.
    - The pin did not move (seed 99's first year meets neither case): 4aafc3eb. After five
      years daffda22 → 9e83b0a7 (it meets one later). The tick, pinned, five years: 1.200 ms
      twice (1.164 before).
    - In the world of before PLAN 2.11i the reader's case (seed 99, tick 2400) was the lane at
      Bab-el-Mandeb; in today's world seed 99 has no such case in a year, and seed 3's is the
      puppet. Both are tested directly.
    - **2026-10-05, the critic's second report (PLAN 2.12): the claim in this task's title
      was wider than its tests.** They held for the supply network. A loaded game still
      differed late in a long game, from another cause (how long a table is: PLAN 2.12a),
      which no test here could meet: no table grows in a first year.
  - [x] 2.11k A formation mustered in a theatre stands on sure land. (The fifth read, finding
    3; PLAN 2.9a missed this path.) `musterPoint` returns a city's own place or a front
    cell's bare middle, and `productionSystem` writes it as it is. Seed 99, the first year: 13
    of 101 musters not on sure land (9 British divisions at Gibraltar, in a water pixel, all
    28 elements of each in the drawn sea for up to a day; 4 Japanese at Dalian). The test of
    2.9a looks at days 0, 30 and 90; the first such muster is at tick 4321.
    AT: unit, failing first: a muster at a city that is not on sure land (Gibraltar) stands on
    sure land, and its elements too; 1938, seed 99, a year: no formation at rest off sure
    land on any day (the reader's count: 119,112 looks, 13 off). The pinned hash moves: logged.
    Done 2026-10-05 (ADR-79, fifth addendum). `musterPoint` returns `standPoint` of the city,
    or the front cell's `cellPoint`.
    - Unit, failing first (`production.test.ts`): Japan's muster on the mainland at the start
      (Dalian's own place: a land pixel, not sure land); Britain's at Gibraltar when at war
      with Nationalist Spain (the city's place is in a water pixel); the division raised there
      and its 28 elements, none in the sea.
    - The year, in the gate's sweep stage (`tests/sweep/standYear.test.ts`): every formation at
      rest, every day. **Seed 1, not 99:** in the world since PLAN 2.11i seed 99 has no such
      muster in its first year (nor seed 1938); seed 1 has four British divisions at Gibraltar
      on day 91, seeds 3 and 7 Japanese ones at Dalian. It failed on seed 1 before the fix.
    - **The pin did not move** (the AT expected it to): 4aafc3eb, for the reason above. After
      five years 9e83b0a7 → 49389306. The tick, pinned: 1.199 ms.
  - [x] 2.11n The smoke run once more, on the sim as the review leaves it (after 2.11i, j
    and k). The first (2.11a) was of a world in which 90 formations a year walked round the
    map. One `npm run sweep:quick`; the five limits in PROGRESS beside the first run's.
    AT: as 2.11a. No constant is tuned for it.
    Done 2026-10-05, on `0819b6d`: seeds 1 to 10, 20 years, 4.9 minutes, every run finished.
    The five limits hold on all ten seeds, by about the margins of the first run. Numbers in
    PROGRESS. Not a verdict on the balance (ADR-58).
  - [x] 2.11e A formation in contact holds, and is drawn holding. The sim sets `moving` for a
    formation that has a march, and keeps it where it stands while it is `engaged`
    (`movement.ts`: "in contact: holds and fights"). The view plays the walk for `moving`
    alone: the zoom demo's division has not left its place in a month and its sprites and
    figures walk in place. Differentiator 1: no animation that disagrees with the sim.
    (From the watch list of PLAN 2.10b.)
    AT: unit: the walk is for an element whose formation has a march and is not in contact.
    e2e: the demo's division, flagged moving and engaged, is drawn standing at T2 and at T3,
    and a formation on the march is drawn walking. Then the demo's four close pictures of two
    runs are compared: the walk's phase was what made them differ.
    Done 2026-10-05. `marching(flags)` in `src/shared/protocol.ts` (a march, and not in
    contact); the element sprites and the figures walk by it. The T1 order arrow still shows
    for a formation that has a march and is held: the order stands.
    - Unit: the rule (`tests/unit/marching.test.ts`).
    - e2e, failing first, in the zoom demo: the division has a march and is in contact (by the
      sim in Node) and none of its sprites or figures is drawn walking; every sprite in the
      four close views walks when its formation is on the march and only then; 23 do. Before:
      "element 10476 of formation 385 (flags 3) drawn walking".
    - The demo's eight pictures of two runs: the same, pixel for pixel (the four close ones
      differed by 4,500 to 56,000 px before).
    - The snapshot is as it was: the two flags travel, and the view makes the walk of them.
  - [x] 2.11l The ground and what stands on it do not outlive their zoom. (The fifth read,
    finding 4.) Leaving T2, the ground's share is a matter of time (full for 220 ms, then a
    fade of 250 ms) while the camera closes on its target at 18 a second. `scatter` has no
    floor: below its coarsest spacing it still gives every lattice point of level 0 at full
    opacity. A hard spin of the wheel out of T2 then shows, for half a second, tree symbols
    denser than their spacing, cut off at a line that climbs the screen (at 5000 m/px 20,502
    wanted, 12,000 given, the last 303 px from the top of 1080); and the ground's pass reads
    the fine mask at a zoom it was not made for.
    AT: unit, failing first: `scatter` gives nothing at full opacity below its coarsest
    spacing, and nothing at all an octave below it; it is never cut short at 1920 × 1080
    above T2. e2e: a jump from T2 to 5000 m/px draws no instance and no ground from the first
    frame the camera is there. `fades1938` and `groundThings1938` pass. Bench A.
    Done 2026-10-05 (ADR-78, fifth addendum). Two things, each needed:
    - *The view:* the ground's share is the sprites' share times `groundReach`: all of it up
      to 345 m/px (where T2 is left), none from 690 m/px, smoothly between. e2e, in
      `groundThings1938`: a jump from T2 to 5000 m/px has the sprites still in full by the
      clock and no ground and no instance from the first frame; out by the wheel to 1500 m/px
      the ground is the sprites' share up to 345, less beyond, nothing from 690, never more
      than the frame before, the scatter never cut short (4,390 instances at most). With the
      reach taken out of the view the test fails ("the ground far out: 1").
    - *The scatter:* below level 0 the levels go on, coarser (level −k is every 2^k-th point
      of level 0 each way), so the pure function is as dense on the screen at any zoom as an
      octave nearer. **Not the floor the AT asked for** ("nothing an octave below"): a floor
      by opacity still gives every point until it is at zero, and is cut off at the cap on
      the way. Unit, failing first: at 13 px a cell 9,578 instances in full where the view an
      octave nearer has 2,389; now the two agree within 8% at seven zooms down to 1 px a
      cell, and a far view shows nothing the view at the spacing does not have. On the real
      map, the reader's view at 5000 m/px: 1,292 instances in 1.1 ms (20,502 wanted, 12,000
      given, 5.0 ms).
    - T2 and T3 are as they were: `fades1938` T2 → T1 42.0, bench A's view with instances
      8,685 and 0.5 ms of CPU, as before.
  - [x] 2.11m The map's canvas stays opaque. (A suspicion of the fifth read, settled here.)
    The sprites, the figures and the ground's instances blend with (SRC_ALPHA,
    ONE_MINUS_SRC_ALPHA) for alpha as for colour, into a canvas that has alpha: under a
    shadow or a soft edge the canvas ends at an alpha of 0.54 to 0.78, and the page's
    background (#1b2a3a) shows through there. Read at T2 over a forest: 254,968 of 1,120,000
    px under 255, the least 138. What `readPixels` gives a test is not what the page shows.
    AT: e2e, failing first: at T2 and T3, over a forest and over a division, every pixel of
    the map canvas has alpha 255; a screenshot of the page has the canvas's colours at the
    places sampled. The specs that read colours pass.
    Done 2026-10-05. `blendFuncSeparate` in `ProxyRenderer` and `GroundInstances`: colour by
    the source's alpha as before, the canvas's own alpha kept at 1.
    - `tests/e2e/canvasOpaque1938.spec.ts`, failing first: four views (a forest at T2 and T3,
      two divisions at T2 and T3). With everything but the map's canvas hidden, a screenshot
      of the page is compared with the canvas's own pixels, every one of 1,120,000. Before, at
      the first view: 254,968 px of the canvas under an alpha of 255 (the least 138), and
      227,136 px of the page not the canvas's colour, by up to 26 of 255. Now 0 and 0 in all
      four.
    - The context still has alpha, so that the first of the two assertions can fail: a blend
      state that leaves the canvas translucent would show there.
    - The benches use the same two renderers and are right with them.
    - Every picture of T2 and T3 taken so far was of the page, so each has the background
      showing through under trees and sprites, by up to 26 of 255. They are shot again in
      PLAN 2.11h.
  - [x] 2.11f Occupied land at T2 and T3: the hatching gives way to the ground. The hatch is
    in screen px and lies over the hillshade, the texture and what stands on the ground,
    across the whole view: the four close pictures of the zoom demo are of an occupied pocket
    and show stripes. Every war has occupied land, and it is where a player zooms in. How
    the occupation still reads at T2 and T3 (a tint, the line of the front, a wider and
    fainter hatch) is this task's decision, recorded in DECISIONS. (From the watch list of
    PLAN 2.10a.)
    AT: e2e: on occupied land at T2 and T3 the ground shows as on the same land unoccupied
    (the measure of `ground1938`, within a stated share); occupied and unoccupied land still
    differ in the picture; at T0 and T1 the picture is as it was (hash); the change comes with
    the T1 ↔ T2 handover's share (`fades1938` passes). Pictures looked at; bench A.
    Done 2026-10-05 (ADR-82). **The decision: with the ground, an eighth of the hatching
    stays** (`HATCH_AT_GROUND` 0.12). The two stripes close on the tint between them by the
    ground's share: occupied land at T2 and T3 is told by that tint (the occupier's colour,
    darker, a sixth of the owner's in it), with a weave no stronger than the ground's own
    variation on a plain.
    - `tests/e2e/occupiedGround1938.spec.ts`, failing first, on Japan's land in north China at
      the start. The stripes are known, so their contrast is measured: the mean brightness on
      a stripe less that between two. At T1 50.7 of 255. At 150 and 20 m/px with the ground
      6.0 (50.3 before: nine times the ground's own variation, 5.1 and 6.0); without the
      ground (the tests' switch) 50.7, as at T1.
    - At T1 the picture is the same with the ground and without it. Occupied land against
      the occupier's own at 150 m/px: (196, 189, 155) against (229, 226, 207), and no stripes
      at home.
    - Not as the AT had it in one point: "the ground shows as on the same land unoccupied,
      within a stated share" became the stripes against the ground's variation. The same
      land is not to be had unoccupied, and the ground was always under the stripes.
    - The handover: `fades1938` T1 → T2 43.1, T2 → T1 42.0, as before.
    - Bench A not run for it: one `mix` on occupied pixels in the ground's program.
    - Pictures: `docs/evidence/2.11/occupied-150m.png` and `occupied-20m.png`, looked at.
    - Left: the legend still says "Hatched: occupied land" at every zoom (a line under 7.4).
  - [x] 2.11g At T2 a sprite shows what is left of its element. A battalion at a third of its
    men is drawn as a whole one (a sprite dims only below 8 units), and then at T3 has a third
    of its figures (ADR-80). The snapshot carries the element's size since PLAN 2.10b. How it
    shows (dimmer, smaller, a mark) is this task's decision, recorded in DECISIONS. (From the
    watch lists of PLAN 2.10a and 2.10b.)
    AT: unit: the sprite's look as a function of strength and size, whole at full strength,
    never gone while the element has units. e2e: in the demo's division the sprites of
    battalions under half strength differ from those of a whole division's in the same view.
    Pictures looked at; `spriteColours1938` and `fades1938` pass.
    Done 2026-10-05 (ADR-80, addendum). **The decision: the sprite's opacity is the element's
    share of its size,** in a straight line from 0.45 (all but nothing left) to 1 (whole).
    `spriteAlpha` in `src/render/units/elementSprite.ts`.
    - Unit (`elementSprite.test.ts`): whole at full strength, paler with every loss, never
      under 0.45; a battalion and a battery at a third look alike.
    - e2e, failing first, in the zoom demo's close stops: every sprite in the view has the
      opacity of its share (before: "the sprite of element 10476, 101 of 500: expected 0.56,
      received 1"); the division's battalions 0.53 to 0.62, the strongest sprite in the same
      view 1.00.
    - Not smaller sprites (at T2 they are 5 px and up: the least size would hide it), not a
      mark under each (a second layer of 500 marks), not darker (the tint is the nation's).
    - The picture of the demo at 50 m/px was looked at: the worn division is paler than the
      one east of it. On the light tint of Japan over China's yellow the difference is small
      to the eye: a line under PLAN 7.4.
  - [x] 2.11h Last: the phase's pictures on the final code, and PARITY. One run of the e2e
    suite with `EVIDENCE=1`; the pictures of T2 and T3 that changed are looked at and kept
    (many are from before the ground of PLAN 2.8); the PARITY rows that Phase 2 touched (the
    semantic zoom, the real-geography map, the political and terrain modes, the map's polish)
    get their evidence and a dated note of what the phase built and what its review left.
    Then 2.11 is ticked.
    AT: `npm run parity` passes; every picture a row names exists and was looked at.
    Done 2026-10-05. One run of the suite with `EVIDENCE=1` on `31b0259` (116 passed) re-shot
    132 pictures. Each was compared with its committed one, pixel by pixel.
    - Kept, 55 pictures of Phase 2: the eight of the zoom demo (the world since PLAN 2.11i:
      the division has 4,948 men at day 30); those of `2.3/` to `2.7/` that show T2 or T3
      (most were older than the ground of PLAN 2.8); those of `2.6/`, `2.8/` and `2.9/`, where
      no pixel differs by more than 24 of 255: the opacity fix of PLAN 2.11m under trees and
      sprites.
    - Put back, 77: the 65 of Phase 1 (not this phase's; they differ by a running game's
      timing or by the corrected world), and 12 of Phase 2 that differ by 0 to 1,400 px of
      1,120,000 in nothing this phase changed.
    - **Looked at, 12 of the 55, not all:** the demo's stops 4 to 8; fire at 45 m/px; a forest
      at 20 m/px; figures at 1 m/px; Warsaw at 40 m/px; the spawned battle at T2; central
      Europe at T1 after a running game; sprites in the wars mode. (And the two of `2.11/`,
      with their task.) The other 43 are of the same views at other zooms or moments and were
      compared, not viewed.
      The AT asked for every one.
    - PARITY: the rows of the semantic zoom, of the real-geography map and of the political
      mode have a dated note of what the phase built, what its review fixed and what is left,
      with the new specs and pictures. `npm run parity`: 46.3%, as before (no status changed:
      the zoom is partial until fleets and air wings have tiers).
  **PLAN 2.11 done 2026-10-05.** The review took 15 commits: its split, four parts of review (a smoke
  sweep, an independent read, the watch lists, SPEC), eight fixes that came out of them, a
  second smoke sweep, and this. The count of numbered tasks for the next review pass starts
  again here. Next by PROMPT step 2a: the critic.
- [x] 2.12 Critic R2-B4 (report of 2026-10-05 on `3d6a2b2`): a loaded game goes on as the game
  that was saved, on any seed and in any year; and the worker's state hash is Node's.
  **The report says that what PLAN 2.11j claimed is false** beyond that task's own tests
  (seed 99 in its first year; a twin game of seed 3 for 100 days). Its cases, to be run
  first:
  - Node, seed 2718: `npm run sim -- --scenario 1938 --seed 2718 --years 10 --save <file>`,
    then `--load <file> --years 1`, ends year 11 at hash `931f19ad` with 694 formations,
    5,865,965 men and 110 living nations. Eleven years straight end at `33ca7b81` with 695
    formations, 5,872,955 men and 109 living nations, one more war declared and an
    annexation that the loaded run never has.
  - Browser, the same seed: Continue gives the save's world at years 1 to 8. At years 10, 12
    and 14 the loaded world has another state hash from its first moment, and another again
    30 days on. Side by side for two years: 5,865,965 men after one year against 5,872,955
    (Node's two figures), and 105 living nations after two against 106.
  - A sim that is loaded more than once: monthly saves through year 9, each loaded into one
    second sim that is used again and again. Every load had the save's hash; one of eleven
    (day 150) had another hash 30 days later. A `load` may leave something of the old game.
  - Worker against Node with no save in it: seed 2718, equal through tick 70,128, different
    from tick 70,152 (2 January 1946, the first step after nation 128 is created) and never
    equal again; formations, total strength and nations the same on each of the next 363
    days.
  - Small, and of the same instrument: the worker took seven commands of made-up kinds and
    its state hash changed (only the test API can send them).
  - A lead, not a finding: nation 128 is in two of the report's findings (the hash parts
    where it is created; a Kill founded a nation that the game named "Free state 128").
    Look at what is sized, signed or keyed at 128: a table, a typed array, a store of names
    or of flags.
  What the fix also sets right: the claims of PLAN 2.11j, of PARITY ("bit-identical
  save/load") and of the header of `tools/headless/cli.ts`.
  AT: tests that fail first on these cases: (a) seed 2718, saved at year 10 and loaded into
  a fresh sim, ends year 11 at the straight run's hash; (b) the same at the end of each year
  of a long run on seeds no test has seen (how many seeds and years the sweep stage affords
  is decided when the task is taken up, and said); (c) a sim loaded a second time goes on as
  a fresh one; (d) a real browser worker and Node have one hash on every day of year 9 of
  seed 2718; (e) a command of an unknown kind is refused and changes nothing. What steered
  the sim and was in neither the save nor the hash is named in DECISIONS.
  - [x] 2.12a The cause, and its fix. Done 2026-10-05 (ADR-84). **What steered the sim and
    was in no save and no hash: how long a table is.**
    - *The cause.* A table of the state grows by doubling, and a growth moves it to new
      arrays. `spawnRebels` took the nations' columns, created the nation's row, and wrote
      the nation into the columns it had taken. When that row made the table grow, every
      write fell outside the old arrays and was lost. In a 1938 game that is the nation with
      id 128: founded dead, without origin, colour, gold or capital, at war with its holder,
      its militia (up to four formations) at (NaN, NaN). It is the critic's "Free state 128"
      (a line under PLAN 2.15).
    - *Why a loaded game differed.* A loaded table is as long as its save (131 rows at seed
      2718's year 10), where the table of the game that went on has doubled (256). The loaded
      table grows at its next nation: the two games lose different nations.
    - *Why the worker's hash left Node's.* On the code of before, in a real browser, the two
      part in the tick in which the table grows and not before
      (`tests/e2e/workerNodeGrowth1938.spec.ts`: tick 6, "nations up to 130, the table
      grew"). What differs is not known to the bit: a NaN out of arithmetic has bits of its
      own, and they were in the state.
    - *The critic's case, run first:* straight `33ca7b81`, 695 formations; loaded
      `931f19ad`, 694. As reported.
    - *Fixed, seven places:* `spawnRebels`; the editor's `spawnCity` (the same mistake; the
      cities table of a 1938 game is far from its next growth); the month's revolt loop,
      which held the columns across every revolt (after a growth it read the old arrays: a
      nation founded since was not living there, and its provinces were passed over);
      `collapseNation` and `collapseSystem`, the same; `reviveNation`, made alike though it
      founds nothing; and `Table.forEach`, which held the table's `alive` across what its
      callback creates.
    - *How the others were found:* a switch on the table for tests (`volatile`): every create
      moves the table and spoils the arrays it left. A game with the switch on must go as the
      game without it. It found the city on its first day and the revolt loop only in a
      three-year game (seed 2718 on day 305, seed 99 on day 609); the collapse code and
      `forEach` were read from there.
    - *Tests, each failing first:*
      - unit (`tableGrowth.test.ts`, 3): the nation founded as the table grows is whole
        ("nation 128, whose row made the table grow from 128 to 256: living: expected 0 to be
        1"), and no number of the state is NaN but the history's "no place"; a loaded world
        goes on as the saved one across a growth, also loaded into a sim another game has
        used ("nation 130 of the loaded world: living: expected 0"); 45 days of a game with
        revolts by command and by the month's system, a Kill, a revival, production and a
        city, beside the same game with moving tables (parted on day 1).
      - e2e (`workerNodeGrowth1938.spec.ts`): revolts by command in a browser worker and in
        Node across the growth; then saved, continued on a fresh page, and on as Node's.
      - the sweep stage's three ten-year games (seeds 1 to 3): the game saved at the end of
        year 9 and loaded ends year 10 as the game that went on (seed 1 failed first: its
        table grows in year 8; seeds 2 and 3 had not grown by then), and after ten years no
        number of the state is a stray NaN.
    - *The AT's five cases:*
      - (a) and (b) by hand, not in the gate (21 sim-years a seed): seeds 2718 and 31337
        (the critic's, in no test) and 1, 2, 3, saved at the end of each of ten years, each
        save loaded into a fresh sim and run a year: **50 of 50 end their year at the hash of
        the game that went on.** Seed 2718 from the save of year 10: `72214edc`, both. In the
        gate: the year 9 check above, 12 s more on the stage.
      - (c) in the unit test.
      - (d) the e2e above in the gate; and by hand in a real browser: seed 2718, the worker
        against Node at the end of each of years 1 to 8 and **on each of the 365 days of year
        9 (in which the table grows): equal.** 3.2 minutes; not kept.
      - (e) is PLAN 2.12b.
    - *Beyond the tests:* four years of the twin game with moving tables on seeds 1, 99, 2718
      and 31337: equal on every day (13,000 creates of elements, 470 of formations, 9 to 15
      of nations in each).
    - *Hashes (ADR-55):* the pin did not move, `4aafc3eb`: no table grows in seed 99's first
      year. Nor in its first five: `49389306`. Seed 2718 is as before through year 8 and
      another game from year 9. The tick, pinned, five years: 1.203 ms (1.199).
    - *Set right:* PLAN 2.11j's claim (a note there), PARITY's row, the CLI's header.
    - *Found on the way, not this task's:* a rebel nation with no city in its area takes the
      middle of the area as its capital, and that can be sea (lines under PLAN 2.15).
  - [x] 2.12b A command of a kind the sim does not know is refused (the AT's (e); the
    critic's N20). It was applied as nothing and written into the command log, which is
    state: seven made-up kinds changed the hash.
    AT: failing first: such a command is not queued, logged or counted, and the hash is that
    of a game that never got it; the list of kinds is held to the `Command` type by the
    compiler.
    Done 2026-10-05.
    - *Where:* `World.enqueue`, before the sequence number is taken: the number is in the
      save's meta, so a refusal at apply time would still have moved the hash. `Sim.command`
      says whether it was taken; the worker warns on its console and, for a `now` command,
      does not apply or send anything.
    - *The list:* `COMMAND_KINDS` in `src/shared/commands.ts`, a `Record<Command['kind'],
      true>`. Tried: a line taken out and a line added each fail `tsc` (TS2741, TS2353). The
      switch of `applyCommand` ends in a `never`, so a kind without a case fails too.
    - *Tests, failing first* (`unknownCommand.test.ts`, 3: "expected undefined to be false";
      the worker's log had 17 lines for 18 made-up commands): nine made-up commands (a kind
      nobody has, a known one in other case, `toString`, `__proto__`, a number, none, null, a
      string, an array) into a sim and into the worker, plain and `now`: nothing pending, no
      number taken, the log, the hash and the save bytes those of a twin that never got them.
    - *Not done:* a known kind with wrong fields is still each handler's to check (most do:
      `has(nation)`, `isFinite`). And a save written before this may hold such a command in
      its log; it is loaded as it is.
    - *The pin:* not moved (`4aafc3eb`): no command in that game.
  **PLAN 2.12 done 2026-10-05:** the AT's (a) to (d) in 2.12a, (e) in 2.12b.
- [x] 2.13 Critic R2-B3, the first part: the 1938 order of battle is still there after the
  first tick. The critic's count, the same on seeds 1212 and 4242: at tick 0 there are 1,054
  formations, 72 of them armour, 34 of those Soviet. At tick 1 there are 826 and 33, and the
  Soviet Union has no armour: its army falls by the 74,400 men of its 30 tank brigades and 4
  tank corps, its monthly expenses from 1,210 to 853 (its income is 1,156). Poland's three
  tank brigades go the same way. No line in the history says so: the world a player looks
  at while the new game is paused is not the one that plays. The cause the critic names: the
  economic AI disbands idle formations while its budget is short
  (`src/sim/ai/economic.ts`), and the 1938 budgets are short from the first hour.
  - The decision is made when the task is taken up: budgets that carry the armies of the
    start, or a floor and a time of grace for disbanding. And a line in the history when a
    formation is disbanded.
  - **It will move the pin** (seed 99, one year; an ADR-55 log), and with it the world of
    every picture and of every test that names a formation (the zoom demo's division). The
    limits of the two Phase 2 smoke sweeps were measured on the world after the disbanding.
  - Phase 3 builds on it: of 72 armour formations 33 are there to give armour rules to.
  AT: failing first, on three seeds: at tick 1 a 1938 game has its 1,054 formations (72
  armour, 34 of them Soviet), and in its first month none is disbanded for want of money; a
  formation that is disbanded has its line in the history. The pin and the tick time logged.
  **Done 2026-10-05 (ADR-86).**
  - *Run first, seed 99:* 1,054 → 826, as reported. 30 nations disband: China 70 of 140, the
    Soviet Union 34 of 162 (its 34 armour formations: the weakest go first, and a tank
    brigade is small), Nationalist Spain 22, Turkey 14, Mongolia 4 of 4. The Soviet Union was
    short 112 a month and its margin, and had 6,936 in gold. The AI did not look at gold.
  - *The decision: a floor and a grace, the grace in gold.* A nation short by S a month
    disbands only while its gold is below 3 × S; and a nation starts with six months of
    income or, where that is more, twelve months of S (16 nations). Not the budgets: incomes
    and upkeeps are balance (ADR-58).
  - *The line:* `FormationsDisbanded` (nation, how many), one per nation and month, in the
    history: "X could not pay its army and disbanded formations: N".
  - *Tests, failing first* (`startArmies.test.ts`, 5; "expected [826, 33, 0] to deeply equal
    [1054, 72, 34]"): seeds 99, 1212 and 4242 have 1,054 formations, 72 armour and 34 Soviet
    at tick 0 and at tick 1, every nation its own count; through 1 February none is
    disbanded and none is bankrupt; Mongolia with an empty treasury disbands and the history
    has the line with the count; China with a month of its deficit cuts a part (under 60;
    70 before).
  - *Three older tests said what the old rule did;* each now says the new one, in its place
    and in ADR-86: Mongolia disbands with its treasury empty (`economicAi`); the treasury
    of the start (`economy`); and "fighting together raises unity" (`alliances`), whose
    twin "at peace" was taken to war by the AI: the AI is off in both games now.
  - *The zoom demo* (`zoomDemo1938`): its battle is now a Romanian division's (formation
    658; before, another world). At the two stops of T0 Romania's counter is folded into a
    Soviet one ("1.10M", with two other nations; PLAN 1.45b). The stop's check takes the
    nation's counter or, with none shown, the nearest counter that stands for other nations
    too. The other six stops passed as they were.
  - *The pin:* `4aafc3eb` → `324bc358`. *The tick,* pinned, five years of seed 99: mean
    1.502 ms (1.203; the budget is 1.5), the first two years 2.11 and 1.97 with some 200
    formations more: BLOCKERS, for PLAN 7.1.
  - *The ten-year tests of the gate* (three games at peace with no bankruptcy; three with
    wars, a peace and an alliance change; the year 9 save): green without a change.
  - *Not done, and said:*
    - **The pictures.** Every committed picture of a running 1938 game is of the world
      before (the demo's eight of PLAN 2.10 among them: another battle). Not shot again in
      this task; they are shot at the Phase 3 review with that phase's, unless a task
      before it needs one.
    - **Not seen in a browser:** the history panel with the new line. Its text is held by
      the unit test of the history's strings; no page was opened.
    - The armies the incomes do not carry are still cut, later: 846 formations after a
      year, 687 after two, 658 after five (seed 99). Whose budget is wrong is Phase 7's.
    - The weakest still goes first, so armour goes before infantry: a line under PLAN 3.1.
- [x] 2.14 Critic R2-B2: the close zoom shows a battle, and says who is in it. The
  differentiator scored 5 and needs 8. What the critic saw (Germany against Poland by God
  Mode, 60 days; a ladder of 15 zooms from 12 km/px to 1 m/px; live frames):
  - **Who is who.** At T2 and T3 the marker boxes are gone and nothing is in their place: no
    flag, no strength, no name. German and Polish elements are the same grey dots at T2 and
    the same white figures at T3. A click on one opens its nation's panel: there is no
    formation panel and no tooltip anywhere, so a formation's name, kind and composition
    cannot be read at any zoom. The closer the look, the less there is to find out.
  - **No battle in a T3 view.** Enemy formations stand a cell or more apart, and a cell is
    19.6 km: the closest pair after 60 days was 1.46 cells, 29 km, apart. At 20 m/px a view
    is 32 by 18 km: centred between that pair it shows a border and trees and no unit. Both
    are in one frame only at 40 m/px, at T2, as two specks. So a close view is one side's
    battalions in ruled rectangles, with shots leaving the screen; figures in contact stand
    in their grid and face one way, and but for the dashes a battalion under fire looks like
    one at rest. (PLAN 7.4 had this as "What T3 shows of a battle".)
  - **The ground is the nation's colour.** Berlin at 20 m/px is grey noise with specks, no
    streets, no river; the Alps are salmon pink for being Swiss; Chad at 1 m/px is sky blue
    for being French Equatorial Africa, and could be shallow sea. (PLAN 7.4 had this as
    "Every ground is the fill's colour". ADR-82's tint for occupied land is part of it.)
  - **Nothing leads to a battle.** At T2 a division is a 30 px grid in a view of 1,600 px;
    most T3 views are empty ground. There is no way from a war's banner, a marker or the
    history to where the fighting is.
  The critic's fixes, each a decision when its part is taken up (the task is split then):
  flag, strength and name on a formation at T2 and T3, and a formation panel; the two sides
  of an engagement within one T3 view (the engaged elements drawn at the cell edge they
  fight across); posture and facing for figures in contact; at T2 and T3 the ground's colour
  from the terrain, with the nation as a tint at the border; a jump to the battle from the
  war's banner.
  AT: e2e in a war made by God Mode, failing first, pictures looked at: every formation in a
  T2 or T3 view is told by flag, strength and name, and the two sides differ in the picture;
  a click on a formation opens its panel (name, kind, elements, strength); two formations in
  contact are both in one view at 20 m/px and face each other; the ground of one terrain on
  two nations' land differs by less than a stated share away from the border; a click on a
  war's banner brings its largest battle into view. `zoomDemo1938` passes, or is restated
  with the reason.
  **Split 2026-10-05,** one cause a commit, in the order a player meets them. Each part
  takes its decision when it is taken up and has its own e2e, failing first, in a war made
  by God Mode, with pictures looked at:
  - [x] 2.14a Who is who at T2 and T3. Every formation in the view has its flag, its
    strength and its name by it (the marker's box gave way to nothing), and the elements and
    figures of two nations differ in the picture.
    AT: in a view at 150 m/px and at 12 m/px on a German and a Polish division, each has a
    label with flag, strength and name within a stated distance of its elements, none over
    another; the two sides' sprites and figures differ in colour by a stated measure.
    Done 2026-10-05 (ADR-88).
    - *The tags* (`src/render/units/tags.ts`, drawn by `MapView.drawFormationTags`): a small
      dark label above the part of a formation that is in the view: flag, strength, and a
      name, "Infantry division 1055" (its kind and its number; the flag says whose). It
      comes in with the sprites as the marker's box goes, has the marker's red edge in
      contact, gives way upward and then downward to a stronger formation's tag, and stays
      in the view when its formation reaches out of it. City names keep clear of the tags.
    - *The name is the view's, not the sim's:* no formation has a name in the state. The
      kind is the template's, the number the formation's id. A numbering by nation ("3rd
      Polish infantry division") would be a column of the state and a moved pin: a line
      under 2.14b, where the panel shows the same name.
    - *The colour:* sprites and figures wear `nationColor` as the stand-in sprites do. The
      second lift toward white is gone: Germany (166, 166, 166) and Poland (226, 157, 169)
      are 61 apart in RGB, where they were (206, 206, 206) and (239, 201, 208), 33 apart.
    - *Tests:* e2e `tags1938.spec.ts`, on a German and a Polish division at war across their
      border (at HEAD the view has no tags, and the tints are 33 apart where the spec asks
      for more than 50): none at T1; at 150 m/px and at 12 m/px on each division, every
      formation with an element on the screen has one tag, with its nation's flag drawn,
      the strength the sim has and its name, at most 8 px from its elements (3.8), whole in
      the view, none on another. Unit `tags.test.ts` (4): the layout.
    - *Pictures looked at* (`docs/evidence/2.14/`): at 150 m/px the two tags stand over the
      two divisions either side of the border, flags right (Germany's is the black, white
      and red of the scenario's data); at 12 m/px the tag stands at the head of the
      division's battalions.
    - **What the pictures also show, and is not done:** at 12 m/px a figure is a few dark
      pixels, on Poland's pink as on Germany's grey: the tint cannot be read at that size,
      and it was no better before (`docs/evidence/2.10/stop-7-battalions.png`). The tag
      says whose the figures are; the figures themselves do not. With the ground of 2.14d
      (terrain, not the nation's fill) a nation-coloured figure has something to stand
      against: looked at again there.
    - *Run by hand* (ADR-87: this part's gate runs only the changed spec): `markerStacks`,
      `fades`, `handover`, `cityNames`, `closeZoom`, `spriteColours`, `zoomDemo`,
      `individuals`, `labelFades`, `fire`, `morphNations`, `canvasOpaque`: 20 of 20 green.
    - *The pin:* not moved; nothing of the sim changed.
  - [x] 2.14b A formation panel. A click on a formation (its marker, its label, one of its
    elements) opens it: name, kind, nation, strength, its elements with theirs, supply,
    whether it is engaged. No click at any zoom opened anything but the nation's panel.
    AT: a click at T1, T2 and T3 opens the panel of that formation; its numbers are the
    sim's; a click on ground closes it.
    - From 2.14a: the name is `MapView.formationName` (kind and id). Decide here whether a
      formation gets a number of its nation's own in the state ("3rd infantry division"):
      a new column, a moved pin, and a rule for what a new or a revived formation is called.
    - From 2.14a, to do here: `drawFormationTags` builds a map keyed by a string for every
      element in every frame. Fine for the 1,100 of the test's view; the section holds up to
      40,000. A numeric key, and a frame time measured on a dense T2 front (PROMPT step 6:
      not measured in 2.14a).
    - After 2.14a's commit, also run by hand and green (13 tests): `coastPicture`, `ground`,
      `groundThings`, `coastElements`, `declutter`.
    Done 2026-10-05.
    - *The panel* (`src/ui/FormationPanel.tsx`), in the nation panel's place while a
      formation is picked: flag and name, kind, the nation as a chip that leads to the
      nation panel, men now of a whole one's, supply, status (in contact, on the march,
      holding), and its elements by unit type ("24× Infantry 11,985 of 12,000").
    - *The numbers are the sim's:* a request to the worker (`formation`, answered with
      `FormationDetail`), since the view has a formation's elements only at close zoom. It
      is asked again with every snapshot of a new tick, one request at a time; a formation
      that is gone closes its panel.
    - *The click* (`MapView.formationPick`), of any nation: its tag (T2, T3), its marker
      (T1; of a stack, the one on top), else the nearest of its elements within reach, or
      its stand-in sprite. At T0 the counters are nations'. A click elsewhere closes the
      panel and goes on to the player's order or to the nation of the ground, as before. A
      click on one of the player's own formations opens the panel and selects it for orders.
    - *The name:* stays the view's (kind and id). No column, no pin.
    - *Tests:* e2e `formationPanel1938.spec.ts` on the two divisions of `tags1938` (before:
      no click opened anything but the nation's panel): a click on the marker at T1, on the
      tag and on an element at T2, on a battalion and on the tag at T3 opens that formation's
      panel, with the sim's men, 100% supply, a row a unit type of the template and the
      template's count of elements; ground closes it and the nation's opens; the chip and
      the close button; a day on, the panel's men are the sim's of that day (11,926, "In
      contact"). Unit `formationDetail.test.ts`: the worker's answer, null for no such
      formation, and no change of the hash.
    - *Pictures looked at* (`docs/evidence/2.14/formation-panel-t2.png`, `-t3.png`).
    - *The tags' frame cost, from 2.14a:* the boxes are keyed by a number now. On the
      densest place of the start (Kiev: 866 elements, 28 tags at 290 m/px) the tags take
      0.37 ms of a frame's 0.82 ms on the CPU (0.16 of 0.66 at 150 m/px). Looked at that
      view: 28 tags, none on another, all read.
    - *Run by hand* (ADR-87): the eleven spec files that click on the map, with `tags`,
      `individuals` and `markerStacks`: 22 tests green.
    - *Not done:* the picked formation is not marked on the map (no ring, no lit tag); and
      a tag can stand under the war banners at the bottom of the screen. Lines for 2.14f.
  - [x] 2.14c A battle fits a close view. Two formations in contact are both in one view at
    20 m/px and face each other (the critic: the closest pair stood 29 km apart, a view is
    32 km wide). The decision is of where engaged elements are drawn, or stand: at the cell
    edge they fight across. Posture and facing for figures in contact.
    AT: after 60 days of Germany against Poland, for every pair of formations in contact
    there is a view at 20 m/px with elements of both; their figures face the enemy; a
    battalion under fire differs from one at rest in the picture. If where elements stand
    changes in the sim, the pin moves (ADR-55).
    **Split 2026-10-05:** where the blocks stand (c1) and how a battalion in contact looks
    (c2) are two causes; the second needs a frame the atlas does not have.
    - [x] 2.14c1 The blocks of formations in contact are deployed against each other. Done
      2026-10-05 (ADR-89).
      - *What it was:* a formation holds its place while it fights, and contact is 1.5
        cells between formations (29 km); nothing brought the elements nearer. Nor did
        anything turn a formation to its enemy: `facing` is the last march's heading.
      - *The decision: derived, not state.* An element's place was already worked out from
        its formation's (`slotPlace`), read by the snapshot, the fire events and the event
        of an element's end, and by no rule. For a formation in contact the block now
        stands on the line to its nearest enemy in contact, its front row half a kilometre
        short of the middle between the two, facing it (`deployOf`, `elementPlace`). Two
        that are each other's nearest stand front to front, a kilometre apart. One whose
        nearest enemy faces a nearer formation comes up to that enemy's block from its own
        side (a line further back when it comes from the side that enemy faces). A block
        does not go onto the mask's water. **The formations, their markers and every rule
        are where they were: the pin did not move** (`324bc358`).
      - *Moving the formations themselves* (the other way) would be state: contact
        distances, the choice of targets and the pressure on territory all read a
        formation's place. Not taken.
      - *The worker* sends a deployed block where it stands, and as its place of an hour
        ago where the sim had it the hour before (`deployedBefore`): in the hour a contact
        begins the elements go to the line, when the enemy changes to the new line, when
        it ends back, each as one hour's move. The wreck of an element lies where it
        stood, not where its block is going.
      - *Measured (unit, `deploy.test.ts`):* after 60 days of Germany against Poland on
        seed 99, 96 formations are in contact. **93 of them (97%) share a view at 20 m/px
        with their nearest enemy, half or more of each side's elements in it; with the
        blocks at the formations' places it was 2 (2%).** 3 pairs of the 96 blocks stand
        with their middles under 0.1 cells apart (on one another). A shot is at most 0.32
        cells long where it was a cell or more.
      - *The AT restated:* "for every pair in contact" is not met and cannot be by blocks
        that stand in one place: a formation in contact with three enemies faces one. The
        measure is the nearest enemy, and 97%.
      - *Tests:* unit `deploy.test.ts` (5: the pair front to front, a kilometre apart,
        facing, on land, the formations unmoved; the shots; not state: thrown away and
        after a load the same, the hash the same; formations not in contact as before;
        the 60 days) and `deploySnapshot.test.ts` (the worker's places of now and of an
        hour ago in a contact's first and second hour). e2e `battleView1938.spec.ts`: at
        20 m/px on the point between a German and a Polish division a cell apart, 28 of
        28 elements of each on the screen, facing east and west, 78 px between the front
        rows, each with its tag. Picture looked at (`docs/evidence/2.14/battle-20m.png`).
      - *Specs restated, each with the reason in its place:* `zoomDemo1938` (its expected
        places are the sim's `elementPlace`), `individuals1938` (its views are on the
        blocks; of what a view holds, the formation's own; a figure's bound is the
        footprint's corner, since a block now faces at any angle), `tags1938` and
        `formationPanel1938` (T3 on the blocks), `tags.test.ts` (a tag that gives way
        stands below its block before it goes a place higher: two blocks front to front
        have one tag above and one below).
      - *Run by hand* (ADR-87): thirteen spec files of the close zoom, 19 tests green
        (`zoomDemo`, `tags`, `formationPanel`, `fire`, `elements`, `wrecks`,
        `coastElements`, `coastPicture`, `individuals`, `closeZoom`, `handover`,
        `morphNations`, `fades`).
      - **Not done, and said:**
        - *The seam at 300 m/px.* The T1 marker stands at the formation's place and the
          T2 block up to 0.45 cells from it (28 px there): the box that shrinks into its
          elements (ADR-72) now shrinks beside them for a formation in contact. The
          specs of the handover pass; the picture of it on an engaged pair was not looked
          at. A line under 2.14f.
        - *Hops.* When a formation's nearest enemy changes, its block goes to another
          line in an hour. How often in a running war was not counted.
        - 3% of the formations in contact, and the 3 pairs of blocks on one another.
    - [x] 2.14c2 A battalion in contact looks like one: posture and spread of its figures
      at T3 (they stand in the parade grid of a battalion at rest), and its sprite at T2.
      AT: e2e, pictures looked at: the figures of a battalion in contact differ from those
      of one at rest by a stated measure (their spread across the front, a frame of their
      own), and go back when the contact ends.
      Done 2026-10-05.
      - *A frame of their own:* the atlas has a sixth frame, a soldier lying prone seen from
        above (`Frame.prone`). Infantry of a formation in contact is drawn with it, as a
        battalion's sprite at T2 and as its figures at T3 (`shownFrame`). Guns and tanks
        are as they are. The snapshot still carries the class's frame: the view decides.
      - *Their ground:* in contact the ranks of a battalion close up to the front half of
        its footprint and each man lies further off his place in them (`figureOffsets`
        with `firingLine`). The same man in the same file: a loss still takes the last
        figure of the element's order.
      - *Tests:* unit `individuals.test.ts` (2 more: the line is at most 0.6 as deep as the
        grid, forward of the middle, inside the footprint, less regular across, turns with
        the block, losses the same) and `unitLooks.test.ts` (six frames; no class has the
        prone one of itself). e2e, in `battleView1938.spec.ts`: at 5 m/px between the two
        divisions 2,955 figures are prone and none stands, the guns are guns, a battalion's
        figures are 226 m deep; after peace by God Mode the blocks are back at the
        formations' places, 1,476 stand and none is prone, 427 m deep (0.53).
      - *Pictures looked at* (`docs/evidence/2.14/contact-5m.png`, `rest-5m.png`): in
        contact two sides of lines of men lying towards each other across a gap, the
        batteries behind; at rest the squares of standing men. They differ at a glance.
      - *Run by hand* (ADR-87): twelve spec files of the close zoom, 18 tests green.
      - *Not done:* no muzzle flash or movement on a prone figure beyond the shots already
        drawn between the blocks; tanks and guns in contact look as at rest.
  - [x] 2.14d The ground at T2 and T3 is the terrain's. Its colour comes from the terrain,
    the nation is a tint at the border (ADR-82's tint for occupied land with it).
    AT: the ground of one terrain on two nations' land differs by less than a stated share
    away from the border, and by more at it; Berlin, the Alps and Chad looked at.
    Done 2026-10-05 (ADR-90).
    - *What it was:* the ground of T2 and T3 was a multiplier on the fill (relief, grain, a
      shade by terrain class): its colour was the nation's everywhere.
    - *Now:* with the ground's share the fill gives way to the terrain's colour (the
      smooth blend the terrain mode has), and stays as a cast on it: 0.14 of the fill away
      from borders, 0.62 at a border (fading over about half a cell), 0.42 on occupied
      land. In the ground's program only, and only where the land is coloured by a nation
      or a map mode's palette: the terrain and unrest modes are as they were; T0 and T1
      are untouched; with relief off (the setting) the fills stay.
    - *Occupied land (ADR-82)* is told by its cast, and an eighth of the hatching is still
      what the picture has: the stripes keep 0.12 / 0.42 of themselves in the fill, of
      which 0.42 shows (`occupiedGround1938` as it was: contrast 6.0 of 50.7).
    - *Measured* (e2e `groundColour1938.spec.ts`, the ground alone, mean of 300 px
      square): plains deep in Germany and deep in the Soviet Union. The fills are (93,
      93, 93) and (143, 29, 29), 103 apart in RGB. The grounds are (146, 162, 104) and
      (154, 153, 96), **14 apart: 0.14 of the fills' difference**, each nearer the plains'
      colour (156, 174, 107) than its nation's; the same at 150 and at 20 m/px. Either
      side of the German-Polish border, 0.15 to 0.45 cells from the cells' edge: 44 apart.
    - *Looked at* (`docs/evidence/2.14/ground-*.png`): Berlin at 20 m/px is green plain
      with its houses, where it was grey; the Alps at 60 m/px are rock, with a pink cast
      towards the Italian border at the bottom of the view; Chad at 5 m/px is sand, where
      it was sky blue; the German-Polish border at 150 m/px has a grey band on one side
      and a pink one on the other, on green. Coasts have the cast too (the sea counts as
      another id): a band of the nation's colour along the shore.
    - *The figures of 2.14a, looked at again* (`contact-5m.png`, shot again): on the
      terrain's ground the German figures are grey and the Polish ones pink, told apart
      at 5 m/px. At 12 m/px a figure is still a few dark pixels.
    - *Tests:* e2e `groundColour1938`; unit `ground.test.ts` (the casts' order). Run by
      hand (ADR-87), 15 spec files that read the ground or a fill, 27 tests green:
      `occupiedGround`, `ground`, `hillshade`, `groundThings`, `coastPicture`, `coast`,
      `canvasOpaque`, `mapModes`, `occupation`, `terrain`, `zoomDemo`, `fades`,
      `closeZoom`, `handover`, `coastElements`.
    - *Not done:* a small nation is all border: Switzerland's Alps keep a cast across the
      country. Terrain is one class to a cell of 19.6 km, blended: no rivers, no streets
      (the critic's "no streets, no river" of Berlin stands). The handover at 300 m/px now
      changes the land's colour from the fill to the terrain over its 250 ms; its specs
      pass and it was not looked at as a sequence.
  - [x] 2.14e A way to the battle. A click on a war's banner brings its largest battle into
    view, at a zoom that shows it.
    AT: the click moves the camera onto elements of both sides of that war in contact.
    Done 2026-10-05 (ADR-91).
    - *Which battle* (`largestBattle`, `src/sim/systems/warBattle.ts`; the worker's request
      `warBattle`): the war's formations in contact across its two sides, joined into
      battles; the one with the most men. Worked out on the click from the state, read-only.
    - *Where:* between the blocks of an attacker's and a defender's formation that are each
      other's nearest enemy, the pair with the most men. *The zoom:* 20 m/px, or as many
      metres a pixel as keep 28 km across a smaller view (at most 250). A jump
      (`MapView.showBattle`).
    - *The click* still selects the attackers' leader. A war with no contact: the camera
      stays. The banner's tooltip says where a click leads.
    - *Tests:* e2e `toBattle1938.spec.ts` (at HEAD the camera stays on the world: the wait
      for it ran out): Germany against Poland by God Mode, a division of each a cell apart,
      a day; from the whole world the click puts the camera on the sim's answer at 20.0
      m/px, 28 of 28 elements of each of the two formations on the screen, all in contact,
      each with its tag; Germany's panel is open. Unit `warBattle.test.ts` (3): no contact
      and no such war are null; of two battles the one with more men, and the other when it
      has grown; the pair that are each other's nearest; the hash and the hour's
      deployments (with the hour before's) are as they were; the worker's answer.
    - *Picture looked at* (`docs/evidence/2.14/to-battle.png`): the two divisions front to
      front in the middle of the view, their tags over them, the border beside them.
    - *Run by hand* (ADR-87): `ranking`, `battleView`, `formationPanel`, `tags`, `toBattle`:
      5 green.
    - *The pin:* not moved; no rule changed.
    - *Not done:* the jump is not a flight; no way to a war's other battles, nor from the
      history or a marker; a banner does not say whether its war has a battle. In the
      test's war the largest battle is the pair put down for it: a battle of a real front
      (dozens of formations, the pair chosen among them) was tested in the unit test's
      two-against-one only. Lines for 2.14f.
  - [x] 2.14f The whole: `zoomDemo1938` passes or is restated with the reason; the phase's
    close pictures shot again on the final code and looked at; PARITY.
    **Split 2026-10-05,** one cause a commit (the lines came from 2.14b, 2.14c1 and 2.14e).
    The last part ticks 2.14f and 2.14 and so runs the whole e2e suite (ADR-87):
    - [x] 2.14f1 One distance for contact. `largestBattle` and `contactsOf` each repeated
      the distance of `combat.ts` by hand. Done 2026-10-05: `cellDist` in
      `src/sim/systems/elements.ts`, read by `findBattles`, `contactsOf` and
      `largestBattle`. The same arithmetic (the absolute east-west difference, wrapped,
      and `dmath.sqrt`): the pin did not move.
    - [x] 2.14f2 A tag does not stand under the war banners or the bottom bar (from 2.14b).
      AT: e2e, in `tags1938`: with a formation at the bottom edge of the view and a war's
      banner shown, no tag's box overlaps the banners or the bar; picture looked at.
      Done 2026-10-05: `layoutTags` takes the boxes of each banner and of the bar
      (`MapView.tagObstacles`, wired in `game.tsx`) and treats them as it treats another
      tag: the next free place, a gap of 4 px clear; none free, left out and counted. Seen
      to fail first (10 overlaps at three of the four heights); 4 unit tests; pictures
      looked at. *Not done:* the figures themselves still stand under the bar (the map does
      not end above it), and a tag may then be 60 px from its block; the other panels
      (nation, formation, statistics) are not obstacles.
    - [x] 2.14f3 The formation whose panel is open is marked on the map (from 2.14b).
      AT: e2e, in `formationPanel1938`, failing first: at T1, T2 and T3 the picked
      formation's marker or tag differs from the others by a stated measure, and no longer
      when the panel is closed; pictures looked at.
      Done 2026-10-05: a frame of light blue (`PICKED_EDGE`, `#6fe3ff`), 2 px, around the
      marker's box at T1 (of its stack, when it is in one) and around the tag at T2 and T3,
      whose fill is also lighter. Out of the box: the red edge of a formation in contact
      stays; not the gold of the player's selection for orders. The picked formation's tag
      takes its place before the stronger ones, so it is not the one left out. The view
      follows `hud.formation` (an effect in `game.tsx`): the mark goes however the panel
      closes. *The measure:* pixels of the frame's colour within 6 px of the box, against
      the length of the box's edge: 220 of 110 px at T1, 508 of 248 at T2 and T3; 0 around
      the other formation and with the panel closed (by ground, the chip, the button). Seen
      to fail first without the wiring (0 of 110). 1 unit test (the layout's order).
      Pictures looked at (`formation-panel-t1.png`, `-t2`, `-t3`). *Not done:* the
      formation's elements and figures themselves have no mark, only its tag; at T0 there
      is none (the counters are nations'); in the morph at 300 m/px the frame fades with
      the box and does not shrink with it, not looked at as a sequence; the frame's cost
      in a frame was not measured (two strokes).
    - [x] 2.14f4 The handover at 300 m/px on a pair in contact (from 2.14c1): the marker
      stands at the formation's place, the block up to 28 px from it. Shoot the sequence
      of the morph, look at it, and decide whether the marker of a formation in contact is
      drawn at its block (an ADR either way). Count how often a block changes its line in
      a running war (60 days of Germany against Poland, hour by hour; a number for
      PROGRESS.md).
      Done 2026-10-05 (ADR-92). *Measured:* 27 px for a pair a cell apart, 43 px at 1.48
      cells (the 28 was the first). *Decided:* the marker stays on the formation (two
      enemies' boxes of 26 px would stand 10 px apart at their blocks, 1.7 at 2,000 m/px;
      the rules read the formation's place) and does not slide there in the morph (2.7 px a
      frame). *Changed:* the bar and the number of a formation in contact no longer linger
      for 220 ms beside the group; they go with the box. e2e, the second test of
      `battleView1938`, seen to fail first; pictures looked at
      (`handover-contact-t1.png`, `-96ms`, `-352ms`). *The count* (unit, `deploy.test.ts`):
      169,565 block-hours in contact, 511 hops of more than a block's depth (one in 332
      hours of a block), 81 of them with another nearest enemy, 109 of more than half a
      cell, the longest 50 km. *Not done:* a hop of 10 km in an hour not looked at on the
      screen; `deployOf` has no limit to how far a block stands from its formation (to
      2.14f5, below).
    - [x] 2.14f5 The banner of a war with a real front (from 2.14e); how far a block stands
      from its formation (from 2.14f4). **Split 2026-10-05** in three, one cause a commit:
      - [x] 2.14f5a Where the banner lands on a real front. After 60 days of Germany against
        Poland, click the banner and look at where it lands; log how the pair was chosen.
        The fear: when no two of the battle are each other's nearest, the two picked can
        stand 29 km apart with their blocks towards others, wider than the view of 28 km.
        AT: unit, on the 60-day front: both blocks of the chosen pair are in the view the
        camera takes; e2e picture looked at.
        Done 2026-10-05 (ADR-93). *Measured* (seed 99, every six hours of the 60 days, every
        war): 752 battles, 237 of them of Germany against Poland; the two named were each
        other's nearest enemy in all 752, their blocks at most 3.6 km apart, every element
        of both in the view less 50 px. Seed 7, by a probe not kept: 1,025 battles, 1,024
        each other's nearest and one where one was the other's; at most 5.8 km; all whole.
        *Decided:* the rule of 2.14e stays; the case feared did not occur in 1,777 battles.
        *Tests:* unit, `warBattle.test.ts` (the fourth): a pin of what is, not a test that
        failed first; with the pair chosen by men alone it fails (136 of 752 not whole, the
        blocks up to 31.9 km apart). e2e, the second test of `toBattle1938`: seed 99, no
        division put down, 60 days; the click lands at 20.0 m/px on formations 287 and 260
        (the same two as the unit run), 28 of 28 and 20 of 20 elements on the screen, the
        blocks' middles 144 px apart. *Picture looked at*
        (`docs/evidence/2.14/to-battle-front.png`): an Italian infantry division facing a
        French tank brigade in the middle, seven more formations' elements around them.
        *Seen, not changed:* the banner reads "Germany +5 against Poland +9" and its
        largest battle is Italians against the French; 67,984 men against 472. *Not done:*
        a battle with no two that are each other's nearest has no test of its own and the
        camera does not widen for it; a pair across a strait (blocks on their shores) was
        not looked for.
      - [x] 2.14f5b Four decisions, each with an ADR. **Split 2026-10-05** in four, one cause
        a commit (done 2026-10-05: ADR-94 to ADR-97):
        - [x] 2.14f5b1 What "largest" means: 67,984 against 472 was the largest battle by
          men. Decide whether the smaller side's men count instead, or say why not.
          Done 2026-10-05 (ADR-94). *Measured* (a probe not kept; seeds 99 and 7, 752 and
          1,025 answers): by the men of both, one side was under a tenth of the other in 212
          and 358 answers, under a hundredth in 53 and 103. *Decided and built:* the largest
          battle is the one whose smaller side has the most men, then by the men of both,
          then the lowest id. Under a tenth now: 36 and 33. *Tests:* unit, the second of
          `warBattle.test.ts` restated (four against one with more men does not beat two
          against two; four against three does), seen to fail with the old rule; the 60-day
          test asks for under a tenth of the answers so uneven (36 of 752). e2e, the second
          of `toBattle1938`: day 60 lands on 36,135 against 18,109, German motorised
          division 45 and Polish infantry division 563. Picture looked at. The pin did not
          move.
        - [x] 2.14f5b2 Whose battle the banner leads to. The banner names the two leaders
          and the click may land on their allies. *Measured 2026-10-05 with 2.14f5b1* (the
          rule of ADR-94; seed 99 and seed 7): neither of the two formations is a leader's
          in 46 of 752 and 41 of 1,025 landings, one of them in 96 and 349, both in 610 and
          635. In every one of the 1,777 answers the war had, somewhere, a pair of each
          other's nearest with a leader's formation in it. Decide whether a leader's battle
          or a leader's pair comes first, or the banner says whose battle it leads to.
          AT: unit, on the 60-day front: the count of landings with no leader's formation,
          at the limit decided; failing first if the rule changes.
          Done 2026-10-05 (ADR-95). *Decided and built:* a battle with the two leaders'
          formations front to front (each other's nearest) comes first, then one with one
          leader's, then the rest; then ADR-94. In the pair, each other's nearest first, then
          the leaders', then men. An order, not a filter: a war whose leaders are not in
          contact gets its largest battle. *Tried first and dropped:* "either leader" (every
          battle against Poland has Poles; 129 of 752 with one leader only). *After* (seed 99;
          seed 7 once, not kept): neither 0 and 0, one 6 and 187, both 746 and 838; each
          other's nearest and whole in the view in all; under a tenth 38 and 49 (36 and 33).
          *Tests:* unit, a new one in `warBattle.test.ts` (Germany and Czechoslovakia against
          Poland: one against one on the German border wins over two against two on the
          Czechoslovak; the German division gone, the other), seen to fail with the old rule;
          the 60-day test asks for no landing without a leader's formation (46 before). e2e,
          the second of `toBattle1938`: a German and a Polish formation. The pin did not
          move. *Not done:* a war whose leaders never meet leads to allies and does not say
          so; the leader changing during a war has no test.
        - [x] 2.14f5b3 Whether a banner shows that its war has a battle (ADR-91: not sent
          with the statistics; `contactsOf` is kept for the hour, so one pass over it may
          do). *Measured 2026-10-05:* one pass over `contactsOf` (a formation and its
          nearest enemy on the two sides of the war) agreed with "`largestBattle` is not
          null" in all 1,708 and 1,796 askings. Built or "not now, because".
          Done 2026-10-05 (ADR-96): built. *What:* each war row of the statistics has
          `battle` (`warsWithBattle`: the pass over the contacts, and for a war it does not
          mark, its formations in contact pair by pair, so that it is the condition of
          `largestBattle` and not a measure near it). On the banner: gold swords with a
          battle, dim swords and a dimmer frame without; the tooltip says "No battle now".
          *Tests:* unit, three new in `warBattle.test.ts` (two wars, one with a battle; a war
          none of whose formations has its nearest enemy in it; the worker's war rows against
          `warBattle` over three days of 1938), and the 60-day test asks that the wars marked
          are those with an answer (1,708 of 1,708); each seen to fail with the code broken
          (the flag false, the second step off, nothing marked). e2e, `toBattle1938`: Brazil
          against Mexico is dim, says so, and its click leaves the camera; on day 60 every
          banner shown says what its click finds (3 of 8 lit). Pictures looked at
          (`to-battle-banners.png`, `to-battle.png`, `to-battle-front.png`). The pin did not
          move. *Not done:* the flag is a second old at top speed; it does not say whose
          battle; wars past the eighth have no sign.
        - [x] 2.14f5b4 Whether the jump becomes a flight (the camera has an eased zoom and
          no eased pan, ADR-91). Built or "not now, because".
          Done 2026-10-05 (ADR-97): built. *What:* `flight` in `render/camera.ts` (van Wijk
          and Nuij's path: pan and zoom in one movement, eased; 0.25 to 1.6 s) and
          `CameraController.flyTo`, called by `MapView.showBattle`; a key, the wheel, a press
          or a touch ends it where it is. *Measured* (a probe not kept, day 60 of seed 99,
          frames 16.7 ms apart): from the world view 89 frames, 21 px of ground a frame at
          most; from 20 m/px 5,900 km away 90 frames, out to 4,276 m/px, 248 px a frame at
          most; from 117 km away 78 frames, out to 91 m/px. 13 to 16 subscriptions a flight
          (the jump: one). *Tests:* unit, six in `camera.test.ts`; e2e, the first of
          `toBattle1938` (the frames of the flight, seen to fail with the jump; the left
          arrow ends it on the way). Pictures of the three flights looked at. The pin did
          not move. *Not done:* not seen at 60 frames a second on a graphics card;
          `prefers-reduced-motion`; no unit test of the controller.
      - [x] 2.14f5c How far a block stands from its own formation. From 2.14f4: the longest
        hop of a block in the 60 days was 50 km, more than contact (29 km). Decide, with an
        ADR, whether `deployOf` limits it. *Measured 2026-10-05 with 2.14f5a* (seed 99, days
        10, 20, 30, 45 and 60; 96 to 177 formations in contact): median 12.3 to 12.6 km,
        the ninth tenth 19.4 to 27.8 km, the most 33.1 to 42.0 km; 1, 9, 3, 5 and 7 of them
        beyond 29 km, every one a formation whose nearest enemy is deployed against another
        (the worst: 29.3 km from its enemy, its block 42.0 km from itself). To try first: a
        limit at `CONTACT_CELLS`, and what it does to the share of formations that have
        their enemy in one view (`deploy.test.ts`: over 90% asked) and to the longest hop.
        AT: unit, on the 60-day front: no block further from its formation than the limit
        decided, or the reason there is none; the pin as the gate finds it.
        Done 2026-10-05 (ADR-98): a limit at the contact distance (`DEPLOY_REACH`, 1.5
        cells, 29.4 km). *Without it* (60 days hour by hour, seeds 99 and 7): the furthest
        block 44.3 and 79.8 km from its formation, 3.4% and 5.1% of the block-hours beyond
        contact, none of a pair of each other's nearest. *With it:* the share in one view
        loses 1.7 points at most (94.2% on the worst day changed; 93.0% the lowest, as
        before); the longest hop 40.0 km (50.0) and 34.9 (37.6); 489 hops (511). *The cost:*
        a block held back is 7.8 to 10.1 km from its enemy's block in the median (3.3
        before), 28.7 at most; over half a view in 0.2% and 0.8% of all block-hours.
        Limits of 1.25, 1.0 and 0.75 were tried: 0.75 fails the 90%. *Tests:* unit, in the
        hour-by-hour test of `deploy.test.ts`, seen to fail with the limit off (2.26
        cells). `toBattle1938` by hand: the same pair, the same place. *Not done:* hops of
        40 km remain; no picture of a held-back block.
    - [x] 2.14f6 The whole: `zoomDemo1938` passes or is restated with the reason; the
      pictures of `docs/evidence/2.14/` shot again on the final code and looked at;
      PARITY rows with their evidence. Ticks 2.14f and 2.14: the whole e2e suite.
      Done 2026-10-05. No code changed.
      - *`zoomDemo1938`:* passes as it was written, not restated (Romanian division 658 on
        day 30 of seed 1938; the eight stops, the largest step of a share 0.096). It asks
        nothing of 2.14: the tags, the two sides and the ground's colour are in the
        pictures of its close stops, held by the five specs below and not by the demo.
      - *The pictures:* the 19 of `docs/evidence/2.14/` shot again by `battleView`,
        `formationPanel`, `groundColour`, `tags` and `toBattle` with `EVIDENCE` set (7
        tests green), and each looked at. Six came out byte for byte as they were
        (`tags-t2-150m`, the three of the handover, `to-battle`, `to-battle-front`); the
        other 13 differ by a few bytes and show what they showed. Nothing found wrong.
        The four `tags-bottom-*.png` the run also writes are not kept, as before.
      - *Seen in them, not changed:* in `contact-5m.png` the German division's tag is at
        the view's top edge, under the top bar (2.14f2's "the other panels are not
        obstacles"). In `to-battle-front.png` the figures at 20 m/px are faint on the
        plain. In `to-battle-banners.png` a dim banner differs from a lit one by its
        swords and frame only, little at a glance. Lines for PLAN 7.4.
      - *PARITY:* no row had a word of 2.14. Appended, with evidence: Table 1 row 74 (unit
        visuals: the tags and the formation panel), Table 2 row 1 (semantic zoom: all of
        2.14) and row 10 (the ground's colour). The statuses stay partial; the score did
        not move (46.3%).
      - *Not done:* the eight pictures of `docs/evidence/2.10/` are still of the world
        before PLAN 2.13 (the Phase 3 review, as 2.13 said); the critic's score of the
        differentiator is the critic's to give, at the Phase 3 review or when asked.
- [x] 2.15 Critic R2-B6, the part that is not balance: a nation's end does not found dozens of
  states, and every nation has a name and a flag.
  - God Mode's Kill on France: 103 → 139 living nations at once, among them "Free Clipperton
    Island", "Free Kerguelen Islands", "Free Saint Barthélemy" and one that the game could
    not name, "Free state 128"; the war banners three rows deep and "+32"; 43 wars a month
    later.
  - After 14 years of seed 2718, 25 of 109 living nations are "Free <province>", each with a
    blank flag.
  - The history calls land that goes back to a living nation a revolt ("France broke away
    from Italy").
  - The critic's fix: a Kill hands land to neighbours and to claimants before it founds
    anything. To whom, and how many new states at most, is a decision when the task is taken
    up. Where a plain game's rule changes, the pin moves.
  - Not here, by ADR-58: how often land breaks away in a plain game (a line under PLAN 1.42).
  - From PLAN 2.12a (2026-10-05): "Free state 128" was the nation whose row made the nations
    table grow; it lost its origin with everything else, and the name is made from the
    origin. That is fixed. Whether a nation can still be founded without a name is to be
    looked at here (the name falls back to "Free state N" when the origin has no name).
  - Found in PLAN 2.12a, not fixed there: a rebel nation with no city in its area takes the
    middle of the area as its capital, and its militia stand there. Of 406 nations founded by
    a revolt forced in every province of the 1938 start, 74 had their capital on a cell that
    is not theirs, 71 of them on a sea cell; 110 of their 577 militia formations were not on
    sure land. (PLAN 2.11k set this right for what production raises.)
  AT: failing first: a Kill of France through the God UI founds no more than a stated few
  nations and starts no war by itself; no nation is named "Free state N"; every nation
  founded in 15 years of a game has a flag that is not blank (a test, and a picture looked
  at); land that returns to its owner is not logged as a revolt.
  Split 2026-10-05 (one cause per commit):
  - [x] 2.15a A Kill founds a stated few nations and starts no war. Done 2026-10-05 (ADR-99).
    - *The causes:* the forced collapse cut the land into groups of 8 provinces and every
      island into its own nation; and the dying holder declared war on each nation founded,
      which brought in its allies, whose wars outlived it.
    - *The rule:* land goes back to a living core nation or claimant; the rest founds at
      most `KILL_STATES` (5) nations, one for every 200 cells, shared among the connected
      pieces by their cities; a piece that founds nothing goes to its neighbour, an island
      to the heir. Nobody declares war.
    - *Measured* (seed 99, one tick after): France 102 → 106 living and 2 → 2 wars (139 and
      40 before); Yugoslavia 106 and 2 (149 and 50).
    - *Tests:* unit in `godMode.test.ts` (four nations; seen to fail: 38 founded); e2e in
      `godUi1938.spec.ts` through the God tab; `docs/evidence/2.15/kill-france-*.png`,
      looked at. The pin did not move.
    - *Not done:* see ADR-99, "what it does not give".
  - [x] 2.15b No nation without a name: where "Free state N" can still come from (a
    province with no name; the origin), and the origin on the province of the capital.
    AT: every province of the 1938 data has a name or the name has another source; every
    nation founded has an origin; unit. Done 2026-10-05 (ADR-100).
    - *The causes:* seven provinces of the earth data have no name and hold cells (one each,
      Antarctica's 18); and the origin was the area's first province, not the capital's.
    - *The rule:* a province without a name is called by its country (`provinceLabel`); the
      origin is the province of the capital where that is in the area. "Free state N" is
      left for a state without an origin only (`foundedName`, `src/shared/nationNames.ts`).
    - *Tests:* `tests/unit/nationNames.test.ts` (4): the data; the number only without an
      origin; the origin on the capital's province (seen to fail: 446 for 445); a revolt
      forced in every province founds 406 nations, each with an origin and a name. The pin
      did not move.
    - *Not done:* 66 of the 406 have their capital outside the origin (no city: the middle
      of the area, 2.15e); two nations of one name (a line under PLAN 7.4).
  - [x] 2.15c A flag for every founded nation, made from its id and colour by a function any
    scenario can use (PLAN 2.16 needs it). Look first at whether the plain flag is the
    cause or a colour not yet known when the flag is first asked for; a reused id must not
    show the flag of the nation before it.
    AT: every nation founded in 15 years of a game has a flag of two colours or more, the
    same for the same id and colour; a picture looked at.
    Done 2026-10-05 (ADR-101).
    - *The causes:* both. A nation without a scenario flag flew a plain one by design; and
      the view kept a flag by the id for good, so one asked for before the first snapshot
      stayed grey. A third by reading: the scenario flag was found by the id alone.
    - *The rule:* `foundedFlag(id, colour)` (`src/shared/flagPixels.ts`): one of the editor's
      11 presets, the nation's colour, a dark or pale second, an accent. The view's, not in
      the state. `FlagStore` makes a flag again when its colour changes; the snapshot's
      nation row says `founded`; a painted flag does not pass to a nation on a reused id.
    - *Tests:* `tests/unit/foundedFlags.test.ts` (6, seen to fail): 406 nations of a revolt
      forced in every province, each a flag of two colours or more with its own on it, all
      406 different; 3,000 flags of any colour; the early grey; the id of a scenario nation;
      the reused id; the snapshot. e2e in `godUi1938.spec.ts` (the Kill of France). The pin
      did not move.
    - *15 years of a game,* by hand (seed 2718, not a test: three minutes): 56 founded, 30
      of them living, 56 flags of two colours or more, 56 different.
    - *Pictures:* `docs/evidence/2.15/kill-france-europe.png` (a Nordic cross over Paris, a
      tricolour over Geneva, a canton with a star in Gironde) and `founded-flag-panel.png`.
    - *Not done:* see ADR-101, "what it does not give" (flags by scenario: PLAN 2.16).
  - [x] 2.15d Land that returns to a living nation, or goes to a neighbour in a Kill, is not
    logged as a revolt: an event of its own, with its line in the history and its filter.
    AT: unit on the events of a defection and of a Kill; the history's text in e2e.
    Done 2026-10-05 (ADR-102).
    - *The cause:* `defect` emitted `RevoltSpawned` for all three of its callers.
    - *The rule:* `LandCeded` (36), "Land of {b} went over to {a}", type "Land handed
      over", for land that goes back to its core nation and for every handover of a Kill. An
      area that joins rebels next to it stays a revolt.
    - *Tests:* unit in `revolts.test.ts` and `godMode.test.ts` (seen to fail); e2e in
      `godUi1938.spec.ts`; `docs/evidence/2.15/kill-france-history.png`, looked at. The pin
      did not move.
    - *Not done:* see ADR-102, "what it does not change" (a revived nation still logs a
      revolt beside its "returned").
  - [x] 2.15e A rebel nation's capital and militia stand on its own land (the 74 of 406
    from PLAN 2.12a). Done 2026-10-05 in four parts (ADR-103 to ADR-106).
    AT: the forced revolt in every province of the 1938 start: no capital on a cell that is
    not the nation's, no militia off sure land.
    Split 2026-10-05 (the 74 are two things: ADR-103):
    - [x] 2.15e1 A nation without a city takes its own cell nearest the middle of its area.
      Done 2026-10-05 (ADR-103).
      - *The cause:* the middle of an area need not be in it. 11 of the 406 (196 have no
        city). The other 63 of the 74 have a city on the shore as capital: its coordinates
        are in a sea cell, its cell is the nation's. No defect of the capital.
      - *Tests:* `tests/unit/rebelCapitals.test.ts` (seen to fail: 11). The pin did not move.
    - [x] 2.15e2 The militia stand on the nation's land: at a capital on the shore they
      stand at the city's coordinates, in a sea cell (106 of 577 on a cell that is not
      their nation's, 12 off sure land, before 2.15e1; 95 and 9 after). Raise them where
      production raises a formation (`spawnPoint`).
      AT: the forced revolt: every militia formation on a cell of its nation, on sure land.
      Done 2026-10-05 (ADR-104), but for the 8 of 2.15e2b.
      - *The cause:* `spawnRebels` put the militia at the capital's coordinates.
      - *Measured:* 95 → 0 on a cell that is not theirs; 8 left off sure land, each the
        militia of a nation of one cell that has no sure land in the fine mask.
      - *Tests:* `tests/unit/rebelCapitals.test.ts`, the second (seen to fail: 95). The pin
        did not move. By hand: `godUi1938` (2), green.
    - [x] 2.15e2b A cell that is owned and has no sure land in the fine mask (an islet
      smaller than a pixel of it): `cellPoint` keeps its middle, in the water. 8 nations of
      one cell among the 406 (cells 283,742; 1985,553; 59,501; 1432,627; 2047,650; 1868,698;
      402,538; 1727,668). Look first at how many owned cells of the 1938 start are of this
      kind and what the picture draws there, then decide: the best pixel of the cell, or
      land the mask does not have.
      AT: the forced revolt: no militia formation off sure land (the test's `islets` at 0).
      Done 2026-10-05 (ADR-105).
      - *Found:* 8 of the 627,829 owned cells of the start, and no more: eight atolls
        (Pitcairn, Ralik, Johnston, Chagos, Tuvalu, Coral Sea, Clipperton, Ashmore), land by
        `reconcileIslands`, without one land pixel in the mask. The picture drew sea there
        at every zoom.
      - *The rule:* land the mask does not have. The world's build gives such a cell an
        islet in the mask (`addIslet`: the cell without its corners), so the sim stands on
        it and both coasts draw it. Nine islets: the 8 and the Spratly Islands, unowned.
      - *Tests:* `rebelCapitals.test.ts` (seen to fail: 8), `coast1938.test.ts` (seen to
        fail: the 8), e2e in `coast1938.spec.ts`; `docs/evidence/2.15/atoll-clipperton-*.png`,
        looked at. The pin did not move.
      - *Not done:* land painted in the editor on the mask's water (ADR-105).
    - [x] 2.15e3 The origin is the province of the capital's cell, not of its coordinates
      (the 66 of PLAN 2.15b with the capital outside the origin: a city on the shore names
      its nation after the area's first province).
      AT: the forced revolt: the capital's cell is in the origin for all 406.
      Done 2026-10-05 (ADR-106).
      - *The cause:* `spawnRebels` read the province at the capital's coordinates; those of
        a shore city are in a sea cell, and the origin fell back to the area's first.
      - *Found:* the AT as written passed before the fix (0 of 406: the forced revolt's
        areas have their city in the first province). The 66 were a count by coordinates.
        The defect shows in an area of several provinces whose shore city is not in the
        first; the test that was seen to fail is of that (origin 504 for 1676).
      - *Tests:* `tests/unit/nationNames.test.ts` (1 new; the forced revolt now asserts
        it). The pin did not move. By hand: `godUi1938` (2), green.
  - [x] 2.15f The whole: the AT above read line by line, the pictures shot again, PARITY.
    Ticks 2.15: the whole e2e suite. Done 2026-10-05.
    - *The AT, line by line:*
      - a Kill founds a stated few and starts no war: `godUi1938.spec.ts` (five; 2 → 2 wars);
      - no "Free state N": `nationNames.test.ts` for the 406 of the forced revolt, and now
        for the nations of a game (below);
      - a flag for every nation founded in a game: this was a run by hand in 2.15c, not a
        test. The three ten-year runs of the gate (`tests/helpers/aiSweep.ts`) now assert,
        for every nation founded, an origin, a name that is not the number, and a flag of
        two colours or more with its own colour on it: 43, 51 and 56 nations (seeds 1, 2,
        3). Ten years, not the AT's 15: the runs the gate already makes, at no cost in time;
        the 15 years of seed 2718 stay the run by hand of 2.15c (56 of 56);
      - land that returns is no revolt: `revolts.test.ts`, `godMode.test.ts`,
        `godUi1938.spec.ts`.
    - *Pictures:* the four of the Kill shot again after 2.15e and looked at: the same to
      the byte. The two of the atoll are of 2.15e2b; 2.15e3 changes nothing they show.
    - *PARITY:* rows 16, 20 and 61, a line each. The score did not move (46.3%).
    - *Not seen to fail:* the new assertions of the ten-year runs. The defects they guard
      were fixed in 2.15b and 2.15c, and each has a unit test that was seen to fail.
- [x] 2.16 Critic R2-B7: more than one way to start. The title screen lists "World, 1938" and
  nothing else: no other year, no other map, no random world with a number of nations. AoC
  has world scenarios for 1914, 1938, 1956 and today, regional maps, and a random simulation
  as its usual way to play (text; PARITY rows 75 and 78, both partial).
  - What comes first is a decision when the task is taken up. A random world needs no new
    data (nations grown from seeded cities on the map there is; names and flags made);
    another year needs its borders; a regional map is a part of the world's.
  - PLAN 7.4's "Flags by scenario" (flags are keyed to 1938 tags in every scenario) comes
    with it, and the flags that PLAN 2.15 makes.
  AT: from the title screen a game starts on a random world with a chosen number of nations:
  the same seed gives the same world (hash); every nation has a name, a flag and a capital;
  a year of it runs within the tick budget. And the title screen offers one scenario more
  besides "World, 1938". e2e from the title screen; pictures looked at.
  - **Decided (2026-10-05, ADR-108):** the random world comes first, and it is the "one
    scenario more" of the AT: it needs no new data. Another year (1914, 1956) needs a border
    dataset and stays a line of PLAN 7.4.
  - [x] 2.16a The sim: a scenario `random` on the earth map. N capitals drawn from the map's
    cities by the seed, kept apart; each nation takes the provinces nearest its capital over
    the province graph, at a speed of its own; a name (the province of its capital), a colour
    and an army in proportion to its income. `--scenario random --nations N` in the headless
    runner.
    AT: unit: the same seed and count give the same hash, another seed another world; every
    nation lives, has cells, a capital on its own land, a name and formations; no land
    province is left without an owner; a year of 60 nations runs (the mean tick logged).
    The pin does not move.
    Done 2026-10-05 (ADR-108).
    - *Tests:* `tests/unit/randomWorld.test.ts` (7): three worlds (60, 200 and 2 nations),
      the hash, the sizes, a month with a save and a load.
    - *Measured:* a world is built in 0.35 s; a year of 60 nations (seed 99, pinned): mean
      tick 1.47 ms, 511 formations after the year (seed 7 starts with 565).
    - *Not seen to fail:* the tests are of new code. The rule against a capital on an islet
      has no test: before it, a world of 200 had nations of one cell (La Digue).
  - [x] 2.16b Flags and names by scenario: `FlagStore` and the worker's `nameOf` read the
    1938 table only in the 1938 world (PLAN 7.4 "Flags by scenario"); a nation of the random
    world, and of the toy world, flies a made flag.
    Done 2026-10-05 (ADR-109).
    - *Tests:* `tests/unit/flagsByScenario.test.ts` (7); four seen to fail before the change
      (the made flag in the toy and the random world, the toy world's names, the tags).
    - *Looked at in the page* (a scratch script, three pictures not kept): the toy world's
      two flags and the random world's are made flags; 1938 flies its own. No console error.
    - *The pin did not move.* The toy world's hash did (its two names are state).
  - [x] 2.16c The title screen: the random world on the list with its picture, a field for
    the number of nations, `?nations=N` in the URL and in the autosave.
    Done 2026-10-05 (ADR-110).
    - *Tests:* `tests/unit/gameUrl.test.ts` (one more; seen to fail), `scenarioPreview.test.ts`
      (one more; it and "every listed scenario has a preview image" seen to fail before the
      picture was written), `tests/e2e/title.spec.ts` (one more: the list, the picture, the
      field, a world of 24 with Node's hash, Continue).
    - *Pictures looked at* (not kept; 2.16d keeps its own): the preview, the title screen with
      the random world chosen, the world of 24 nations started from it.
    - *The pin did not move.*
  - [x] 2.16d The whole: e2e from the title screen (count, names, flags, the same seed the
    same hash), the tick of a year measured, pictures looked at, PARITY rows 75 and 78.
    Ticks 2.16: the whole e2e suite.
    - Not tried in 2.16a: a scenario file exported from a random world, loaded again (the
      editor is reachable there).
    - From 2.16c (ADR-110): a continue URL without `nations` leaves the settings panel's form
      at 60 whatever the loaded world has; and the title screen says "2 to 200" twice (the
      facts and the hint beside the field).
    Done 2026-10-05 (ADR-111).
    - *Tests:* `tests/e2e/randomWorld.spec.ts` (3). From the title screen, 40 nations of seed
      11: a name each (40 that differ), a capital each on ground it holds, a flag each (the
      made flag of its id and colour; 40 that differ), its name on the map; the page's hash is
      Node's at the start and after a month; the same seed again the same hash, seed 12
      another world. A scenario file of a world of 24, exported after ten days and a rename,
      loaded from the title screen: the file's hash, its names, its flags.
    - *Seen to fail:* two. The range stood twice on the title screen; the form of a game
      continued by a URL without the number read 60 for a world of 24. Both fixed here: the
      hint beside the field is the settings panel's only, and the form (and the autosave's
      record) takes the number of living nations of a loaded world.
    - *Tried, and it worked:* the scenario file. Nothing changed for it.
    - *Measured* (pinned, seed 99, 60 nations, one year): mean tick 1.446 ms (budget 1.5),
      p95 6.35 ms, 511 formations.
    - *Pictures* (`docs/evidence/2.16/`, looked at): the title screen with the random world
      chosen; the world of 40 at the start, at 6 and at 24 px per cell over its largest
      nation's capital; the world of 24 from its file.
    - *PARITY:* rows 75 and 78, a line each; both stay partial.
    - *Seen, not changed:* a nation called "Central" (the province of its capital), and
      "Formosa" in South America, "Gao" over half of Africa: the name is the capital's
      province whatever the nation's size. The name along Chile is cut at the coast
      ("Formos"). For PLAN 7.4.
  **PLAN 2.16 done 2026-10-05.** It is the fifth numbered task since the Phase 2 review
  (2.12 to 2.16): the review pass of PROMPT step 9 is due, and comes before 2.17.
- [x] 2.16R Review pass (PROMPT step 9) over PLAN 2.12 to 2.16: refactor debt, dead code,
  SPEC re-read for drift (the random world, flags and names by scenario, the title screen),
  missing tests. It belongs to the tasks it follows (ADR-74) and starts the count again.
  AT: what the pass finds is fixed or is a line of PLAN; SPEC says what the code does; the
  gate is green.
  Split 2026-10-05, as PLAN 2.11 was: the pass is several causes. No part is a numbered
  task: the gate runs the specs a part changes (ADR-87). No sweep: this is a pass of step 9,
  not a phase review (ADR-58).
  - [x] 2.16Ra The independent read (ADR-74), the sixth: the 51 files of `src/` and the four
    of `tools/` changed since the fifth (`3d6a2b2`: PLAN 2.12 to 2.16, 2,506 lines added in
    `src/`), the new lines first. The same brief: defects only, nothing of what changed or
    why. Each finding is checked against the code here before it is anything; those a
    player can meet become tasks 2.16Rf and on, before 2.17, each with a test that fails
    first, most severe first; the rest go on the watch list.
    Done 2026-10-05 (ADR-74, addendum: the sixth read). Nine findings, eight run by the
    reader in Node (`.cache/read6/`, not kept in the repo), five suspicions it could not
    settle; 259,000 tokens, 32 minutes. Checked here by reading the lines it names: findings
    1 to 3 and 6 hold as far as reading shows; each is run again as the failing test of its
    task. Determinism held wherever it tried (a save in mid-month with Kills before and
    after it; a random save loaded into a Sim of another seed and count).
    - Tasks, most severe first: 2.16Rf (a nation eliminated in a plain game keeps its land),
      2.16Rg (a Kill that leaves the dead nation's land or its occupations), 2.16Rh (a Kill
      reads the capital's province at the capital's coordinates), 2.16Ri (the formation
      panel follows an id that another formation has taken).
    - Lines under later tasks: PLAN 2.17 (commands that name a dead nation), PLAN 7.4 (the
      random world's names).
    - Already a line of PLAN 2.17: the empty rename in a world without a table (finding 5).
    - The rest: BLOCKERS, the watch list.
  - [x] 2.16Rb SPEC re-read for drift: the random world (§2.2, §3.4), flags and names by
    scenario, the title screen and the URL options (`?scenario=1938|toy` in two places,
    `?nations=N`), the protocol fields new since 2.11.
    Done 2026-10-05. Each decision since the Phase 2 review (ADR-84 to ADR-111) was looked
    for in SPEC; nine were not there, or only in part. Written in, each checked against the
    code and not against its ADR alone:
    - §2.2: `randomWorld.ts`, `tags`, `FormationPanel`, the shared modules new since;
      `?scenario=1938|random|toy`.
    - §2.3: `init` with `options` and `assets`; the request `warBattle` and the wars'
      `battle` (ADR-91, 94, 95, 96).
    - §3.4: the random world (ADR-108); a nation's name and flag by scenario
      (`nationTags`, ADR-109; `foundedName`, ADR-100).
    - §4: a rebel nation's capital without a city (ADR-103), its origin (ADR-106), where its
      militia are raised (ADR-104); `LandCeded` (ADR-102).
    - §8: the formation tags of T2 and T3 (ADR-88), which SPEC did not have at all.
    - §9: the formation panel; a loaded world's number of nations (ADR-111); `nations`
      among the new-game options. §10: the URL options.
    - *Not in SPEC and left out:* ADR-83, 85, 87, 107 (how the work is done, not what the
      game does); ADR-93 (no rule changed).
  - [x] 2.16Rc Dead code and refactor debt in the same 55 files.
    Done 2026-10-05.
    - *Looked for:* exports of the 55 files that no other source file uses (a scratch
      script: 140 names, all of them constants a test reads, types, or names of before the
      Phase 2 review; none is dead code of 2.12 to 2.16); i18n keys without a use (none new;
      `map.tick` is the i18n test's, six `government.*` wait for a panel that shows the
      government); TODO and FIXME (none).
    - *Fixed:* the two builders of a world on the earth map wrote the cities, the
      formations and the settings each in its own loop. They are `addCities`,
      `addFormations` and `applyScenarioSettings` of `scenario1938.ts` now, used by both.
      The pin holds (the gate), and four random worlds have the hash they had (seeds 7, 11,
      3 and 5 with 60, 40, 200 and 2 nations; seed 11 after a month too: a scratch script
      run before and after).
    - *Fixed:* the head of `revolts.ts` said the holder declares war on rebels "with
      probability 1/2". It has been every time since PLAN 1.40 (ADR-44).
  - [x] 2.16Rd The e2e suite's time. From the gate of 2.16d: one run of the suite took 15.6
    min and `cityNames1938` counted 39 and 31 ticks in four seconds; the next took 9.8. Do
    the three tests of `randomWorld.spec.ts` slow their neighbours? Measured by the tests'
    own times in the suite against their times alone, not reasoned. If they do, the spec's
    place in the run changes; no assertion does.
    Done 2026-10-05: **they do not.** Nothing changed.
    - *Measured* on the machine with nothing else running, each test's time from
      Playwright's JSON report: the whole suite four times (130 tests; 10.2, 10.0, 10.0 and
      10.0 min with the build, all green), and once the `chromium` project without
      `randomWorld.spec.ts` (126 tests, 9.7 min).
    - The three tests take 17.6, 10.5 and 7.1 s: 35 s of the 36.1 minutes of test time.
    - The five tests that ran beside one of them took 77 s with and 76 s without; the 121
      others 2,052 s and 2,022 s. Two runs of the same suite differ by as much (2%).
    - `cityNames1938`, the running part, in the five runs: 597 to 617 ticks at 4000 m/px
      and 275 to 422 at 1000 m/px (more than 50 are asked).
    - *So the 15.6 minutes of the gate of 2.16d were the machine's,* not the suite's: what
      ran beside it then is not known. The line in BLOCKERS (specs that measure time) stays.
    - *A filter that does not filter:* `--grep-invert`, and spec files named on the command
      line, leave nothing out while the `perf` project runs: it depends on `chromium` and
      brings the whole of it. Three runs meant to be without the spec had it. With
      `--project chromium` the filter holds.
    - *Seen in the run without the spec:* `loadedWorld1938.spec.ts` failed once (PLAN 2.16Rj).
  - [x] 2.16Re Missing tests: what a to d find without one (2.16a: the rule against a
    capital on an islet has no test).
    - Done 2026-10-05, the islet: `randomWorld.test.ts` asks of each of its three worlds
      that every capital's piece of land has 12 cells. Seen to fail with the rule switched
      off (`HOME_CELLS` 0): a piece of 3 cells in the world of 60, of 4 in that of 200.
    - Done with a and d (2026-10-05): each finding of the read brings its failing test
      with its task (2.16Rf to 2.16Ri); d found no test missing.
  - [x] 2.16Rf From the sixth read, finding 1a: **a nation eliminated in a plain game keeps
    its land.** `eliminateNation` (`systems/capitals.ts`) hands over no cell. Seed 99 of
    1938, no command: nation 72 is eliminated at tick 4006 (`relocateToField` finds it no
    cell it controls) with 1,389 cells still owned by it, all held by nation 69; so at tick
    8760. Older than 2.12: the file is not among the 55.
    - What becomes of the land is decided when the task is taken up (to who holds it, by
      the look of it: the nation is dead, and its cores and its revival are the provinces').
      A rule of the sim: the pin may move.
    AT: failing first: over a run of 1938 with no command, at every month's end no cell has
    a dead nation as its owner or as its controller. The same asked of the gate's three
    ten-year runs (`tests/helpers/aiSweep.ts`).
    - Done 2026-10-05 (ADR-112): `eliminateNation` hands the land over (`leaveLand`): what
      the dead occupied goes back to its owner, what a living nation occupied of it becomes
      that nation's, with a `LandCeded` for each. Also the capital taken with no core left,
      where a third nation's occupation stayed the dead nation's. The pin moved (7fc8e685).
  - [x] 2.16Rg Findings 1b and 2: **a God Mode Kill that leaves land with the dead.**
    - A nation that owns the centre cell of no province (Danzig with 7 cells and the
      Chinese Communists with 226 in 1938; either nation of the toy world) is killed with
      every cell still its own: `held` is empty, no heir is found, and the last sweep of
      `killNation` asks for an heir.
    - The cells the dead nation controlled and did not own keep it as controller: 16 of
      the 102 nations of 1938 killed at tick 2000 leave some (Germany 73, the Soviet Union
      350), 21 of 60 in a random world. No war with the dead, so nothing takes them back.
      2026-10-05: 2.16Rf gives these back to their owners in `eliminateNation` (ADR-112);
      not counted again since. The test asked for below stays this task's.
    - This is a cause of what the critic saw as "a killed nation stays on the map" (PLAN
      2.17, its third point): that point's test is here, its name on the map stays there.
    AT: failing first: every living nation of 1938 at tick 0 and at tick 2000, and of a
    random world, killed in a copy of the world: afterwards no cell has it as owner or as
    controller.
    - Done 2026-10-05 (ADR-113): a Kill that finds no heir gives the land the nation owns and
      controls to the living nation with the most cells beside it, else to the nearest
      (`leaveToNeighbour`), with one `LandCeded`. Danzig goes to Poland, the Chinese
      Communists' land to China. `tests/unit/killLand.test.ts`: failed for nations 5 and 70
      of 1938 at both ticks and for both toy nations; the random world was green already
      (2.16Rf). The pin did not move.
  - [x] 2.16Rh Finding 3: **a Kill reads the capital's province at the capital's
    coordinates**, which for a city on the shore lie in a sea cell or in another province
    (ADR-103, ADR-106: the same defect `spawnRebels` had). 8 of the 102 nations of 1938, 9
    of 60 in a random world. The heir ("the nation founded on the old capital") and the
    first seed of `spread` then fall back to the largest. And the province is read after
    the revivals of step 1, which may have moved the capital.
    AT: failing first: the Kill of one of the eight (Iceland): the nation founded on its
    capital's cell is the heir.
    - Done 2026-10-05 (ADR-114): `capitalCell` gives the capital city's cell, and
      `collapseNation` reads its province before the revivals. Iceland's 25 cells outside
      any province went to the largest nation founded (468 cells) and go to the one on
      Reykjavík (8 cells). The test failed first; the read before the revivals has no test
      (no such case in 1938 at the start). The pin did not move.
  - [x] 2.16Ri Finding 6: **the formation panel follows an id that another formation has
    taken.** A table gives a freed id to the next row made (`Table.create`); the panel and
    the frame on the map know the id only. The formation whose panel is open is destroyed,
    another nation raises one, and the panel shows that one. How often in a game: not
    measured.
    - A suspicion of the reader's, traced only, to be tried in the page here: the panel
      goes while its formation is outside the subscribed view and comes back on the pan
      back (`MapView.formationTitle` reads the last snapshot's ids).
    AT: failing first: the worker's answer for a formation removed and its id taken again
    says so (unit), and the panel closes (e2e, `formationPanel1938`).
    - Done 2026-10-05 (ADR-115): the answer has the id's count (`generation`); the HUD asks
      with it, and the worker answers `null` for a count that is another. A load closes the
      panel too. Both tests failed first. The suspicion did not hold: a snapshot has every
      formation, and the panel of one 300 cells outside the view stayed.
    - Not closed: the first ask is by the id alone (one tick wide; ADR-115).
  - [x] 2.16Rk From 2.16Ri: **the player's selection follows a taken id too.**
    `MapView.selectedFormations` is a set of ids, kept while the id is in the snapshot. A
    selected formation is destroyed, another nation's takes its id, and the next click on
    ground sends `moveFormation` for it; `orderMove` asks nothing of whose it is. Read, not
    run.
    AT: failing first (e2e, `player1938`): the player's selected formation removed and one of
    another nation spawned in the same tick: nothing is selected, and a click on ground
    orders nothing.
    - Done 2026-10-05 (ADR-116): run, and so it was (the German division marched). The view
      drops from the selection an id that is another nation's, and the bar's count follows
      (it did not, for any selected formation that was destroyed). The player's order names
      its nation and the sim refuses it for another's formation. A load empties the
      selection. The e2e test and a unit test failed first.
    - Not closed: the player's own next formation with the id of the player's own destroyed
      one stays selected (ADR-116).
  - [x] 2.16Rj From 2.16Rd: **`loadedWorld1938.spec.ts` failed once in a run of the suite**
    (one of five suite runs; twelve runs of the spec alone, four at a time, were green).
    After the forced revolt in Masovia, with the camera on the rebels' capital at 6 px a
    cell and the view at rest (`settle`), `flagRects` was empty: no flag of any nation, where
    the rebels' is asked for. A view at rest that draws no capital flag is either a wait the
    spec lacks or a defect of the view after a revolt; which, is not known. The spec was not
    changed.
    AT: the cause named. A defect: a test that fails first, and the fix. A wait: the spec
    waits for what it reads, with no assertion changed.
    - Done 2026-10-05: **a wait, in `settle`.** It drew a frame and then asked whether
      anything animates, at the time after the draw. The frame that takes the camera to 6 px
      a cell starts the flags' fade (250 ms and a tail of 50) at opacity 0; if that frame
      takes longer than the fade, the answer is "no" and `settle` returns with no flag. The
      view's own loop asks at the frame's time (PLAN 2.7m); `settle` does now, and the same
      loop in `closeZoom1938.spec.ts`. No assertion changed, and nothing of `src/`.
    - *Shown* in a scratch spec (not kept): the camera step and a first frame made to take
      350 ms in one task: `settle` as it was, 1 draw and 0 flags; at the frame's time, 3
      draws and 22 flags.
    - *Not shown:* that this is what happened in the run that failed. It needs a frame of
      more than 300 ms where the idle machine takes 26 ms, drawn by `settle` before the
      view's loop draws one. Frames of 170 ms for 25 are on record for a busy machine
      (BLOCKERS). The other ways to an empty `flagRects` were read and are closed: the
      capitals are refilled in the same call that clears them, a snapshot has every
      nation's row, and `controller.set` does not ease.
    - *No test kept:* a spec that makes `settle`'s own draw the slow one has to keep the
      view's loop from drawing first, and the ways tried to do that test the patch more
      than the helper.
    - *Seen, not changed:* `battleView1938.spec.ts` waits "until nothing animates, then
      draws" (the other fault `settle`'s head describes). It has not failed.
  **2.16R done 2026-10-05** with 2.16Rf to 2.16Rk: they are what the pass found. The count of
  numbered tasks starts again with 2.17.
- [ ] 2.17 Critic R2-B8: a God Mode action does what it says, or says why not. Seen through
  the God tab on France:
  - From PLAN 2.16b (ADR-109): a rename to the empty name in the random or the toy world
    deletes the nation's only name; it then reads "Free state N".
  - From the sixth read (PLAN 2.16Ra), not settled there: commands that name a dead nation
    are taken (`spawnFormation`, `paintControl`, `joinAlliance`, `editPaint` gave a dead
    nation a formation, control, a membership, land); `paintControl` for nation 0 leaves
    owned cells without a controller; a NaN in `setEfficiency`, `setSuppression`,
    `setUnrest` or a formation's place goes into the state. Which of these the God tab can
    send (a panel left open on a nation that has just died) is to be looked at here.
  - From PLAN 2.16Rg (ADR-113): the Kill of the last living nation moves nothing and says
    nothing; the dead nation keeps its land.
  - From PLAN 2.16Rg, measured and not looked into: a Kill with an heir gives the heir the
    cells outside the provinces shared out and leaves a third nation's occupation of them,
    with no war behind it. 1938, seed 99, tick 2000, cells occupied by a nation not at war
    with their owner: 45 before any Kill; 7, 2 and 3 more after the Kills of nations 6, 7 and
    11, fewer after five others.
  - **Ally** with a nation that is in another alliance (France of the Anglo-French, Italy of
    the Anti-Comintern): nothing changes and nothing is said.
  - **The Territory brush gives no territory.** A drag of 250 px from France across the Alps
    left a hatched band, and the nation's cells rose by 0: by the look of it the brush
    paints the controller and not the owner. Its hint says "paint territory for this
    nation", and the editor's brush changes the count. This is not the drag (PLAN 1.44b).
  - **A killed nation stays on the map.** France, renamed "Gaul" and killed, is dead; its
    name still stands on that band 30 days later, with Italian counters on it.
  - **Revive** 30 days after a Kill does nothing and says nothing; the button is still
    offered.
  The critic's fix: every command that is refused says why; the brush paints owner and
  controller as the editor's does; a dead nation holds nothing and has no name on the map.
  AT: e2e through the God UI, failing first, one for each of the four: the action has its
  effect, or the panel says in words why not; a dead nation has no cell and no name on the
  map.
  **PLAN 2.12 to 2.17 are the critic's second report (ADR-83).** They are numbered tasks and
  count toward the next review pass. Their order is not the critic's (R2-B2, B3, B4, B6, B7,
  B8): the two that change or question the world's state come before the one whose tests and
  pictures are of that world.

## Phase 3 — Armour

- [ ] 3.1 Armour unit types L/M/H + mech/mot, tech generations, production cost/time, upkeep.
  AT: schema + production test; tech gates the heavy tank until 1942+ research.
  - From PLAN 2.13 (ADR-86): a nation short of money disbands its weakest idle formation
    first, by men. A tank brigade is small, so armour goes before rifle divisions (all 34
    Soviet armour formations went first, before 2.13 in the first hour, since then as the
    gold runs low). Decide here what an armour formation is worth to the AI that cuts.
- [ ] 3.2 Fuel/supply consumption and breakdown effects.
  AT: unsupplied armour slows, then loses org, then strength (test).
- [ ] 3.3 Terrain modifiers for tracked mobility and combat.
  AT: identical battles on plains vs forest yield the expected outcome swing.
- [ ] 3.4 Combined arms (inf + art + armour bonus; AT vs armour; armour vs infantry in the open).
  AT: matrix test of unit-mix outcomes matches the design table in SPEC.
- [ ] 3.5 AI uses armour as spearheads; the economic AI adapts the mix.
  AT: headless 1938 run: armour share rises for industrial powers; spearhead formations lead offensives (metric).
- [ ] 3.6 Tank visuals: sprites, turret facing, muzzle flash, burning wrecks at T2/T3.
  From the critic's report of 2026-10-05 (R2-B3, the second part; the first is PLAN 2.13):
  tanks scored 2. At T2 a panzer division is a grey grid of dots like any other. At T3 its
  tanks are rows of one white box with a circle and a bar, all pointing east, in the white
  of riflemen; in contact they stand in their grid with other formations' figures drawn
  through them. No turret turns, nothing drives, nothing burns. Of fuel, breakdown, tracked
  terrain, combined arms and spearheads (PLAN 3.2 to 3.5) nothing is there to see.
  AT: tank battle demo e2e + screenshots viewed.
- [ ] 3.7 Phase 3 review: re-read SPEC for drift, PARITY rows updated with evidence, and the
  smoke run of ADR-58: one `npm run sweep:quick`, not a balance verdict.
  AT: the five limits of the quick sweep are in PROGRESS; a limit that fails is in BLOCKERS,
  or fixed if a defect of this phase's feature caused it. No constant is tuned for it.

## Phase 4 — Naval

- [ ] 4.1 Sea zones (Voronoi + named seas) + lane graph + straits/crossings; ports & naval bases.
  From the Phase 2 review (PLAN 2.11c, 2026-10-05): a march goes straight from one cell's land
  point to the next and can cross a bay (1 of 430 formations on the march was over the fine
  mask's water at day 90 of seed 99, none of 134 at day 30). It needs routing below the cell
  or along the coast, and belongs with the crossings.
  AT: every coastal province with a port connects to the lane graph; zone count within range.
- [ ] 4.2 Fleets & ship element types (DD, CL, CA, BB, CV, SS, TP) + movement along lanes.
  AT: a fleet route test Gibraltar → Suez takes the expected time; never crosses land (fine mask).
- [ ] 4.3 Detection + fleet battles at ship-element level (gunnery ranges, torpedoes, screening).
  AT: outcome tests (BB line beats CL line at range; DD screen reduces sub hits).
- [ ] 4.4 Sea control per zone; sea supply; convoys; blockade; submarine raiding.
  AT: a blockaded port's income drops by the expected factor; an overseas formation loses supply when the lane is cut.
- [ ] 4.5 Amphibious invasion (embark, escort, land, penalties, bombardment).
  From the critic's report of 2026-10-05 (R2-B1: naval, air and nuclear scored 0; Phases 4,
  5 and 6 are their tasks): without transport by sea the sea powers are out of every war.
  The United Kingdom had 3,390,436 men in 317 formations and the same 17,000 cells for 20
  years of seed 31337. A British division ordered to Calais walked to the coast of Kent and
  stood there. The same holds for Japan's home army, for the United States and for every
  colony. All 15 templates that can be built are land formations.
  AT: a scripted invasion lands and takes the coastal cells; it fails without sea control (test).
- [ ] 4.6 Naval AI (sea control, escort, raiding, invasion planning).
  AT: headless 1938 run: ≥ 1 fleet battle and ≥ 1 amphibious landing per 10 years on 3/3 seeds.
- [ ] 4.7 Naval visuals: ship sprites, wakes, gunfire, torpedo tracks, sinking; sea-control map mode.
  From the Phase 2 review (PLAN 2.11c, 2026-10-05): the sea is one flat colour at T2 and T3,
  though the elevation carries the sea floor (quantised to 10 m for this). A lake that the
  fine mask has and the coarser coverage has not is drawn at T2 and T3 and not at T1.
  AT: naval battle demo e2e + screenshots at T1/T2/T3 viewed.
- [ ] 4.8 Phase 4 review: re-read SPEC for drift, PARITY rows updated with evidence, and the
  smoke run of ADR-58: one `npm run sweep:quick`, not a balance verdict.
  AT: the five limits of the quick sweep are in PROGRESS; a limit that fails is in BLOCKERS,
  or fixed if a defect of this phase's feature caused it. No constant is tuned for it.

## Phase 5 — Air

- [ ] 5.1 Air wings, airbases, carriers, range; air zones.
  AT: a wing cannot be assigned a mission outside its range (test).
- [ ] 5.2 Mission scheduler + sorties as derived kinematics.
  AT: the sortie position function is pure (same inputs → same output, property test) and matches the sim's interception points.
- [ ] 5.3 Air combat, interception, AA; air superiority per zone.
  AT: outcome tests (fighters beat bombers; AA attrition rate).
- [ ] 5.4 CAS + tactical bombing effects on ground battles; naval strike; carrier air groups in fleet battles.
  AT: a battle with air superiority has a better outcome by the expected margin.
- [ ] 5.5 Strategic bombing of industry, ports and cities (income/production damage, repair).
  AT: bombed industry produces less until repaired (test).
- [ ] 5.6 Air AI tasking.
  AT: headless run: air superiority contested over active fronts; strategic bombing appears when superiority is high.
- [ ] 5.7 Air visuals: planes along sortie paths, dogfight tracers, flak, bomb impacts; air superiority map mode.
  AT: air battle demo e2e + screenshots viewed.
- [ ] 5.8 Phase 5 review: re-read SPEC for drift, PARITY rows updated with evidence, and the
  smoke run of ADR-58: one `npm run sweep:quick`, not a balance verdict.
  AT: the five limits of the quick sweep are in PROGRESS; a limit that fails is in BLOCKERS,
  or fixed if a defect of this phase's feature caused it. No constant is tuned for it.

## Phase 6 — Nuclear AI

- [ ] 6.1 Nuclear tech chain, warhead production, stockpile, upkeep; global and per-nation toggles.
  AT: with nukes disabled, the warhead count is always 0; enabled, a test nation builds warheads.
- [ ] 6.2 Delivery: bombers (interceptable) and missiles (later tech).
  AT: bomber strikes are intercepted at the expected rate under air superiority.
- [ ] 6.3 Blast + fallout (deterministic wind drift, decay) on cells, elements, cities.
  AT: unit tests on casualty falloff and fallout decay half-life; fallout map mode screenshot.
- [ ] 6.4 Nuclear decision utility (target value, desperation, retaliation incl. allies, taboo, MAD, doctrine).
  AT: table-driven tests: MAD pair → no first use; desperate fightToDeath nation vs non-nuclear enemy → use; post-first-use taboo drop raises others' propensity.
- [ ] 6.5 Consequences: relations, alliance unity, outrage, economic shock, peace/retaliation responses.
  AT: tests per consequence; the history log has a nuke entry with yield and casualties.
- [ ] 6.6 Nuke FX at every tier (flash, shockwave, mushroom cloud, fallout overlay), alert banner, auto-pause option, go-to button.
  AT: screenshots at T0/T1/T2 viewed.
- [ ] 6.7 Scripted AI nuclear strike demo (seeded scenario where the AI *decides* to strike, not God Mode).
  AT: e2e passes and asserts that the decision record came from AI utility.
- [ ] 6.8 Multi-decade sweep with nukes on: no runaway extinction; MAD dynamics observed.
  AT: sweep report: in ≥ 1 seed nukes are used; in no seed does > 50% of land carry fallout.
- [ ] 6.9 Phase 6 review: re-read SPEC for drift, PARITY rows updated with evidence. The sweep
  of 6.8 is this phase's smoke run (ADR-58); the features are in, so sweeps judge again from
  here.
  AT: the five limits of the 6.8 sweep are in PROGRESS, with what fails listed for Phase 7.

## Phase 7 — Balance, polish, soak

- [ ] 7.1 Performance pass against all budgets (T0 60 fps, T2 30 fps @10k, tick ≤ 1.5 ms).
  AT: `docs/bench/` report green on the reference machine.
  From the Phase 2 review (PLAN 2.11c, 2026-10-05), to settle in this pass:
  - The ground's instances are capped at 12,000. A view of forest has up to 10,900 at
    1920 × 1080, so a larger view passes the cap, and what is cut is the finest level, row by
    row from the top: the trees thin out below a line. The cap by the view's size; beyond
    what a frame affords, an even thinning. (The tests look at 1400 × 800.)
  - The page holds the land mask twice (16.8 MB for the scatter, as much on the GPU) and the
    worker once.
  - A GPU that takes no texture of 8192 px (WebGL2 promises 2048) draws the coarse coast at
    T2 and T3, where the fine mask's land can be sea, and nothing says so.
  - Fractional device pixel ratios (Windows at 125% and 150%): a marker's box picture is
    rounded up and drawn into the unrounded rectangle (38 px into 37.5 at 1.25). Not traced;
    no layer has been looked at at such a ratio.
  - What the ground costs a frame where there is no GPU (the tests' rasteriser: readings
    varied by a quarter).
  - From PLAN 2.11j (ADR-81): a supply refresh of some blocs is done again in full when a lane
    one of them held is not its own afterwards, also when a lower bloc refreshed with it took
    the lane, where the first result was right. How often a refresh goes full was not
    counted; the tick rose by 0.036 ms.
  From the critic's report of 2026-10-05 (the pace in R2-B5; its N9 and N19):
  - **The top speed.** At Max the game makes 885 ticks a second at the start and 794 after
    ten years: 33 to 37 days a second, 10 to 12 s a year. AoC's text gives a month in 0.5 s
    at 1× and 5× at most, so its usual speed is about twice this game's fastest (text only).
    A tick of 1.5 ms, the budget, allows no more on one thread: a faster top speed needs
    another budget or another way (the critic: leave out element-level work where nothing is
    watched). It is here and not before Phase 3 because each of Phases 3 to 6 adds to the
    tick (ADR-83).
  - One zoom without a stop from the world to 1 m/px froze for 2,878 ms, after every tier
    had been seen once (so not a first compile). At Max with the camera at 400 m/px the
    frame gaps were 113 ms at p95 and 452 ms at worst, 14 over 100 ms in four seconds; at ×5
    the close tiers drop a frame of 124 to 146 ms every few seconds.
  - Headless, 40 years of seed 31337: a mean tick of 1.14 ms, p95 up to 8.6 ms.
  - T0 unthrottled at 1920 × 1080 on an RTX 4070 Ti: 116 to 144 fps (a draw of 4.4 to 5.7
    ms). No weak GPU has been measured.
- [ ] 7.1b Map sizes S–XL (ADR-43): convert the audited cell constants to km (identical at M,
  hash-checked); per-km territory hold rates and garrisons; L/XL terrain assets (revisit
  ADR-13); per-game geometry instead of SIZE_1938; a size picker in the new-game options.
  The shares of land are km² since PLAN 1.42e (ADR-57: a war's shares, overextension, the
  admin cost). Left in cells for this task: `OVEREXT_CELLS`,
  `MILITIA_PER_CELLS`, the largest fragment of a collapse (`revival.ts`).
  AT: S and L games start from the picker; the sweep criteria hold at S and L; XL meets its
  tick and memory budgets.
- [ ] 1.42 **Moved here from Phase 1 on 2026-10-03 (ADR-58, the user's decision): balance is
  judged when the features are in. Blocked after three attempts before that (BLOCKERS.md);
  its prerequisites 1.42d, 1.42e and 1.42f are done. Judged by area, on seeds from 401.**
  Critic B1 (static world), continued: every seed passes the two criteria added on
  2026-10-03 (≥ 2 new nations in the top ten by land; leader share range ≥ 3 points). State after
  ADR-47: 9 of 10 unseen seeds green (`docs/sweeps/2026-10-03-sweep-b1.md`); seed 109 fails
  the leader-share range (2.7 points). Do not move the thresholds. (The tick time that
  ADR-47 raised is back under budget since PLAN 1.42a.)
  Second attempt, 2026-10-03, after 1.42b and 1.42c: seeds 201–210, **7 of 10 green**
  (`docs/sweeps/2026-10-03-sweep-b1c.md`, FAILING): 204 and 208 have one newcomer in the top
  ten, 208 and 209 a leader-share range of 2.4 and 2.6 points. Seeds 201–210 are now seen.
  The leader is the Soviet Union in every year of all 24 runs to date and it only shrinks, by
  an amount that depends on the seed's luck with revolts: the next attempt needs a mechanism
  that acts on every seed (see PROGRESS 2026-10-03 for candidates), not more tuning. A third
  failed attempt goes to BLOCKERS (PROMPT step 8).
  Third attempt, 2026-10-03 (ADR-51): the winner of a peace keeps all the land it occupies.
  Scratch sweep on the seen seeds 101–110: 10 of 10 (leader range 4.1–16.1, 2–4 newcomers).
  Unseen seeds 301–310: **8 of 10** (`docs/sweeps/2026-10-03-sweep-b1d.md`, FAILING): 304 and
  306 fail the leader-share range (2.6 and 1.6 points); every seed has 2–3 newcomers.
  **Criteria changed 2026-10-03 (ADR-54, the user's decision), before any 50-year run by
  area:** the two criteria above are reported and no longer judged. A sweep passes when every
  seed keeps the five limits and at least 8 of 10 seeds have a riser and at least 8 of 10 a
  faller, both measured on realms (SPEC §10). The three FAILING reports stand as they are and are not re-judged; only
  seeds from 401 judge this task. The quick sweep (10 seeds × 20 years) comes first: run
  the deciding sweep when it shows risers and fallers on most seeds, not to find out.
  From the critic's report of 2026-10-05 (R2-B5, and the rate in R2-B6; deferred by ADR-58,
  not disputed, logged once in PROGRESS):
  - Seed 31337, 40 years headless: the top five by cells are the Soviet Union, Canada, the
    United States, Denmark (Greenland) and France in every year from 8 to 40. Australia has
    25,987 cells from year 5 to year 40. The Soviet share is 26.5 to 28.3% for 33 years and
    falls to 17.8% in the last seven. Men 4.76 M → 9.74 M. Nations 101 → 136 living, 180
    ever founded.
  - Seed 2718, 14 years in the browser: Europe changes; Brazil has 6.38 to 6.39% and
    Australia 6.11% of the land in every yearly sample; the leader 15.9 to 16.8%.
  - Land breaks away often: 396 of 1,226 events in those 14 years (32%) are "broke away".
  - Of the same kind and not blocking: armies lose 61% and 87% of their men in 60 days of a
    war that moves the front by a border strip (N1); a war takes in half the world ("United
    Kingdom +33 ⚔ Angola", Poland against Xinjiang; N2).
  - What the critic asks of the sweep: a run whose top five are the same for 20 years fails.
  AT: `npm run sweep -- --first 401 --tag <name>` (seeds no tuning has seen) all green.
- [ ] 7.2 30-minute soak with save/load twin comparison.
  AT: `npm run soak` passes with no crash and no desync.
- [ ] 7.3 Final multi-decade sweep (≥ 10 seeds) — borders moving, no hegemon.
  AT: sweep report green.
- [ ] 7.4 Visual polish vs reference (borders, labels, UI frames, flags, fonts).
  AT: side-by-side screenshots vs reference frames logged in PROGRESS.
  From the Phase 2 review (PLAN 2.11c, 2026-10-05). Each group is one look at one thing; split
  when taken up.
  - **The seam of the looping map** (the 180° meridian in 1938). What is drawn knows the seam
    one layer at a time, and most layers do not:
    - `wrapOffsets` has no margin: a counter, marker, flag or name within its own half-width
      of the seam is drawn only once the view's edge has crossed the seam, and half of it
      (about 24 px of a counter) then appears at once;
    - counters either side of the seam are not folded into each other, and T1 markers there
      are neither stacked nor moved apart;
    - the two copies of a city share one name switch and one place (what is in the way of one
      copy moves both; with both laid out, a view 6,570 px wide, the layer never rests);
    - a nation name's copy that alone is in a larger name's way goes out in one frame;
    - a capital flag's rise is cut short at the seam (its state is kept by wrap offset);
    - a city's buildings reach to the seam and not across it;
    - figures drawn through a wrap offset are 2,047 cells from the origin of their f32
      offsets, where a step is 2.4 m.
  - **The declutter in a crowd and in flight.**
    - Counters: an eased zoom can end with other counters than a stepped one (62 of 192 cases
      of made-up frame spacings), and at 200 ms a frame at another cluster level; in flight
      some counters turn twice (56 of 7,394 on a wheel notch in); the second frame of a
      counter layer newly shown turns 1.3% of them (the frame after a merge lands, and the
      second frame of T1 → T0).
    - Within one level of clusters a larger scale can fold a counter into another neighbour
      than a smaller one did (a year into seed 1938 over central Europe, 6 to 8 px a cell:
      12.1k of one nation's go from a counter of its own to another nation's, and a counter
      takes in a nation it had not). Seen in the gate of PLAN 2.11i.
    - T1 markers: parting one pair can push a box onto a neighbour and leave it there (44 of
      5,249 made-up clusters of four); in 1.2 to 1.6% of clusters of 3 to 5 more than the 8
      rounds would part every pair; "no box more than a quarter under another" is about area,
      and at 1800 m/px on Spain's front some numbers are partly under a neighbour's box; the
      first frame of the zoom into T2 starts a move of a few px.
  - **Names and arrows at T1.**
    - Capitals whose names are left out because garrisons stand on every place by the dot:
      Prague at 1800 m/px, Warsaw at 1000, with Turin, Kiev and Kraków, at the 1938 start.
      The places are eleven fixed ones.
    - Order arrows are not kept clear of, by decision; in a war they are many (two months
      into seed 1938 the picture over Austria is mostly arrows). Whether every marker's
      arrow should show at T1 has not been asked.
    - T2 → T1: names give way from the first frame to markers that show at 2%. T1 → T2: a
      name can take a place under a number that still shows.
    - `cityLabels` `wanted` is exclusive where the tiers are inclusive: at exactly 2000 m/px
      the names of size 4 are off while the T1 markers are on.
  - **The ground's look.**
    - No roads near cities (SPEC's tier table had them; not built in PLAN 2.8); buildings
      stand along two directions from a hash, with no streets, and know of their city's
      coast and river only "not on water".
    - Shading and texture take one cell size for the whole map: away from the equator a cell
      is fewer km wide than high.
    - Every ground is the fill's colour: at T3 a forest floor, a field and a street differ by
      roughness and a few hundredths of brightness (now in PLAN 2.14, critic R2-B2). The
      instances keep their natural colours in every map mode.
  - **What T3 shows of a battle.** Shots fly 30 to 60 km (the range is in cells) and a view at
    T3 is 4 to 17 km wide: one tracer in the demo's picture at 12 m/px, none at 3 (now in
    PLAN 2.14, critic R2-B2). A battalion
    at a third of its men is a scatter over its footprint, not a smaller block (ADR-69's
    order of losses). A stack's lead at T1 shows the strongest formation's kind only.
  - **From the fifth independent read (PLAN 2.11b):**
    - Back from T2 with the camera still zooming (the only way a wheel leaves T2), the T1
      boxes take the rest places of the first frame's zoom and keep them for the morph: up to
      6 px off, then an ease of 150 ms. PLAN 2.7z holds for a camera that has stopped.
    - Cities by the fine mask: 140 of 5,757 are in a water pixel of it and 387 not on sure
      land (Gibraltar, Kalemie, Geneva, Amoy, Buffalo, Cochin; one capital in water, four not
      on sure land). At T2 and T3 their dots stand in the drawn sea and no building stands at
      their middle.
    - Nine land cells have no land pixel in the mask (atolls, e.g. 169.5°W 16.7°N): a
      formation there keeps a middle on the mask's water and T2 draws no island.
    - The T1 order arrow ends at the target cell's middle; the formation will stand at the
      cell's land point, up to 0.6 cells from it on a coastal cell.
  - **Picking.** A marker in a stack cannot be picked by a click on the map (the lead is what
    is there). A selection ring stays on an id that a new formation has taken, and such a
    formation takes the dead one's place in a stack for one fade.
  - **A worn element at T2** is a paler sprite (PLAN 2.11g). On a light nation colour over a
    light fill (Japan's on China's) a sprite at 0.55 and one at 1 are close to the eye.
  - **The legend at T2 and T3.** It says "Hatched: occupied land" at every zoom; since PLAN
    2.11f occupied land is a tint with an eighth of the hatching there.
  - **Flags by scenario.** Done in PLAN 2.16b (ADR-109) for the worlds without a nation
    table. Left: a second table (another year) brings its own flags file; the worker and
    `ScenarioInfo.nationTags` know only that of 1938.
  - **From the pictures of PLAN 2.14, shot again (2.14f6, 2026-10-05):** a tag at the view's
    top edge stands under the top bar (`contact-5m.png`; the nation, formation and ranking
    panels are no obstacles to a tag either); figures at 20 m/px are faint on a plain
    (`to-battle-front.png`); a war banner without a battle differs from one with a battle by
    its swords and frame only (`to-battle-banners.png`).
  - **The random world's names** (the sixth read, PLAN 2.16Ra, 2026-10-05): with 150 and 200
    nations most seeds have several of one name (seed 7 with 200: four called "Eastern";
    seed 1 three "Central"); none seen at 60 or fewer on ten seeds. One capital to a
    province, but the provinces' names repeat across countries. With the line below.
  - **Two nations of one name** (PLAN 2.15b, ADR-100, 2026-10-05). A founded nation is
    "Free <province>", and 114 names are held by more than one province ("Valmiera" 21,
    "Central" 10, "Northern" 8, "Saint George" 7); a province without a name gives its
    country's, so "Free Colombia" can stand beside Colombia. Not seen in a game yet.
  - **Land painted on the mask's water** (PLAN 2.15e2b, ADR-105, 2026-10-05). The editor can
    paint land on a cell the fine mask has no land pixel for: the map draws sea there and a
    formation raised on it stands off sure land, as the eight atolls did. The world's build
    gives an islet to the cells of the scenario only.
  - **The Spratly Islands are nobody's in 1938** (PLAN 2.15e2b): unowned land in the
    scenario's data (France and Japan both claimed them). Not looked into.
  From the critic's report of 2026-10-05, not blocking and in no task above (its numbers):
  - N3: occupied land stays hatched for years after a peace (Europe after 14 years of seed
    2718). A rule to look at, not a look: what a peace does with land that is held.
  - N4, N5: T1 in a war is a web of order arrows from formations off the screen; markers
    overlap round Warsaw at the start, one under the capital's flag.
  - N6: no city panel (the formation panel and the tooltips are PLAN 2.14).
  - N7: Escape closes neither the nation panel nor the history; F1 to F6 and the number keys
    do not change the map mode (eight modes behind one button that cycles); a double click
    does not zoom.
  - N8: at 1024 × 600, playing a nation, the pause button and the date are off the screen;
    at a phone's width the ranking lies on the nation panel.
  - N10: seven alliances are all named "Defensive Pact"; the history shows "#24" for one.
  - N12, N13: choosing the editor's terrain layer leaves the map in the political mode (a
    stroke changed 508 cells and nothing on screen); the flag editor has no undo, line or
    circle.
  - N14: ranking rows have no flags and five metrics (AoC: nine lists, the dead marked);
    charts have no axis ticks and no value under the cursor; the economy tab is six numbers.
  - N15, N16: map names and counters show through the Ranking panel; war banners stand three
    rows deep over the map.
  - N17: a black smear under a counter near Bern in 1952 of seed 2718.
  - N18: no sound; one language.
  - N21: while the game runs, half-faded counters are on screen all the time as the clusters
    regroup ("432", "29.6k" at part opacity, 60 days into a war at 2500 m/px).
  - Against AoC's God panel: the World AI settings (one checkbox stands for about fifteen),
    a nation spawned with a size, cities made and removed in the game, gold, CE, colour and
    unity edited from the God tab, donations (PARITY has the rows).
- [ ] 7.5 Run the critic (`CRITIC_PROMPT.md`), fix blocking issues, repeat until the DONE condition.
  AT: `critic/CRITIC_REPORT.json` for HEAD: parity dims ≥ 7, differentiators ≥ 8, zero blocking.

---

## Cross-reference: PROMPT.md requirement → SPEC § / PLAN task

| Requirement | SPEC | PLAN |
|---|---|---|
| AI free-for-all: expand, war, peace, ally, unions (unity), puppets (autonomy), revolt, collapse | §3.5, §4, §7 | 1.16–1.20, 1.24 |
| Cores, revolts per province/region, revival (finite, cooldown), suppression, winner-takes-all, occupation layers | §4 | 1.15, 1.19, 1.20 |
| Sue for peace when broke/exhausted, fight to the death, aggression/traits, income bonus | §3.4, §7 | 1.9, 1.16, 1.24 |
| Economy tick | §3.7, §7 | 1.9, 1.10, 1.26 |
| Terrain types, cities/capitals | §3.2, §3.3 | 1.2, 1.5, 1.11 |
| Major Battles, efficiency modes, buffs | §5.3, §5.4, §3.5 | 1.21–1.23 |
| Long-run dynamism | §7, §10 | 1.40, 7.3 |
| God Mode (all tools) | §9 | 1.32, 1.33, 6.1 |
| Editor (paint, undo, mask, cities, costs, alliances, puppets, annex, revolts, import, flags, files) | §9, §2.7 | 1.35–1.38 |
| Map modes | §9 | 1.30 |
| Stats + history log (filter, export) | §9 | 1.34 |
| QoL (pan/zoom/touch, speeds, autosave, screenshot, UI size, i18n, looping, map sizes, unit size, polish) | §9, §8 | 0.17, 0.21, 1.27–1.31, 1.39 |
| Seeded deterministic runs, randomisation | §2.6, §9 | 0.10–0.13, 1.39 |
| 1938 scenario, data-driven | §3, §2.7 | 1.1–1.7 |
| Semantic zoom (4 tiers, one truth, no popping) | §8, §3.6 | 0.14–0.17, 2.1–2.10 |
| Naval | §6.2 | 4.1–4.7 |
| Armour | §6.1 | 3.1–3.6 |
| Aircraft | §6.3 | 5.1–5.7 |
| AI nukes | §6.4 | 6.1–6.8 |
| Worker sim, fixed timestep, spatial index, perf budget, bit-identical save, tooling | §2, §8, §10 | 0.2–0.4, 0.12–0.13, 1.27, 7.1 |
| Iteration files (PROGRESS, BLOCKERS, DECISIONS, DATA_SOURCES, PARITY, parity script) | — | 0.5, 0.7, 0.8 |
| Soak, sweep, scripted demos, critic | §10 | 2.10, 3.6, 4.7, 5.7, 6.7, 7.2–7.5 |

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
- [ ] 2.7t A city's name is readable where a nation's name crosses it. The curved nation names are drawn
  above the city names: at T0 a capital's name is often under the letters of its own nation. Seen in
  the pictures of PLAN 2.7r (`docs/evidence/2.7/city-names-4000m.png`, `city-names-3000m.png`): Berlin
  under the "y" of Germany, Warsaw under Poland, Budapest under Hungary, Rome under Italy, Brussels
  under Belgium. Not measured yet.
  AT: e2e over Europe at 4000, 3000 and 2300 m/px, at the 1938 start: no letter of a nation's name is
  drawn over the letters of a city name that is shown (the order of the layers, or the city names keep
  clear of the nation names' glyphs, or the nation names of them); the nation names of `labels1938`
  are still placed; screenshots viewed.
- [ ] 2.8 Procedural detail tiles (ground texture, trees, rocks, buildings near cities) by world-seeded noise, plus hillshade from the elevation pyramid.
  AT: screenshots at 4 zooms show increasing detail; the same location renders identically across reloads (image hash).
- [ ] 2.9 Coastline from the fine mask at T2/T3; elements never rendered on water.
  AT: e2e samples element positions at T3 near coasts against the mask (0 violations).
- [ ] 2.10 Scripted seamless zoom demo (world → close on an active battle), 8 stops, screenshots.
  Also decide ADR-69's open choice at the close stops: how a battalion's losses show at T3 (ADR-71).
  AT: Playwright test passes; screenshots viewed; PARITY row for semantic zoom gets evidence.
- [ ] 2.11 Phase 2 review: re-read SPEC for drift, PARITY rows updated with evidence, and the
  smoke run of ADR-58: one `npm run sweep:quick`, not a balance verdict.
  AT: the five limits of the quick sweep are in PROGRESS; a limit that fails is in BLOCKERS,
  or fixed if a defect of this phase's feature caused it. No constant is tuned for it.

## Phase 3 — Armour

- [ ] 3.1 Armour unit types L/M/H + mech/mot, tech generations, production cost/time, upkeep.
  AT: schema + production test; tech gates the heavy tank until 1942+ research.
- [ ] 3.2 Fuel/supply consumption and breakdown effects.
  AT: unsupplied armour slows, then loses org, then strength (test).
- [ ] 3.3 Terrain modifiers for tracked mobility and combat.
  AT: identical battles on plains vs forest yield the expected outcome swing.
- [ ] 3.4 Combined arms (inf + art + armour bonus; AT vs armour; armour vs infantry in the open).
  AT: matrix test of unit-mix outcomes matches the design table in SPEC.
- [ ] 3.5 AI uses armour as spearheads; the economic AI adapts the mix.
  AT: headless 1938 run: armour share rises for industrial powers; spearhead formations lead offensives (metric).
- [ ] 3.6 Tank visuals: sprites, turret facing, muzzle flash, burning wrecks at T2/T3.
  AT: tank battle demo e2e + screenshots viewed.
- [ ] 3.7 Phase 3 review: re-read SPEC for drift, PARITY rows updated with evidence, and the
  smoke run of ADR-58: one `npm run sweep:quick`, not a balance verdict.
  AT: the five limits of the quick sweep are in PROGRESS; a limit that fails is in BLOCKERS,
  or fixed if a defect of this phase's feature caused it. No constant is tuned for it.

## Phase 4 — Naval

- [ ] 4.1 Sea zones (Voronoi + named seas) + lane graph + straits/crossings; ports & naval bases.
  AT: every coastal province with a port connects to the lane graph; zone count within range.
- [ ] 4.2 Fleets & ship element types (DD, CL, CA, BB, CV, SS, TP) + movement along lanes.
  AT: a fleet route test Gibraltar → Suez takes the expected time; never crosses land (fine mask).
- [ ] 4.3 Detection + fleet battles at ship-element level (gunnery ranges, torpedoes, screening).
  AT: outcome tests (BB line beats CL line at range; DD screen reduces sub hits).
- [ ] 4.4 Sea control per zone; sea supply; convoys; blockade; submarine raiding.
  AT: a blockaded port's income drops by the expected factor; an overseas formation loses supply when the lane is cut.
- [ ] 4.5 Amphibious invasion (embark, escort, land, penalties, bombardment).
  AT: a scripted invasion lands and takes the coastal cells; it fails without sea control (test).
- [ ] 4.6 Naval AI (sea control, escort, raiding, invasion planning).
  AT: headless 1938 run: ≥ 1 fleet battle and ≥ 1 amphibious landing per 10 years on 3/3 seeds.
- [ ] 4.7 Naval visuals: ship sprites, wakes, gunfire, torpedo tracks, sinking; sea-control map mode.
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
  AT: `npm run sweep -- --first 401 --tag <name>` (seeds no tuning has seen) all green.
- [ ] 7.2 30-minute soak with save/load twin comparison.
  AT: `npm run soak` passes with no crash and no desync.
- [ ] 7.3 Final multi-decade sweep (≥ 10 seeds) — borders moving, no hegemon.
  AT: sweep report green.
- [ ] 7.4 Visual polish vs reference (borders, labels, UI frames, flags, fonts).
  AT: side-by-side screenshots vs reference frames logged in PROGRESS.
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

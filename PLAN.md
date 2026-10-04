# WarSim — Phased Plan

Rules: each task is small and verifiable. `AT:` is the acceptance test that must
pass before ticking. Work top-down, and split a task if it grows past one iteration.
"Gate" = the full suite (tsc, eslint, vitest, build, parity) passes.

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
- [ ] 1.42f Tick time is over budget again after ADR-50 and ADR-51: seed 99 × 5 years, mean
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
- [ ] 1.42e Critic B1: sim rules that count land in cells count area instead (overextension
  share and distance, admin cost, war score and capitulation shares, SMALL_STATE_CELLS), so
  Siberia and northern Canada stop weighing like twice their land. This overlaps the km
  conversion of PLAN 7.1b: do the land-share part here, leave distances and map sizes there.
  Rule changes: an ADR, and tune only on `npm run sweep:quick`.
  AT: unit tests per converted rule; hash change logged in DECISIONS; gate green.
- [ ] 1.42 **Blocked after three attempts: see BLOCKERS.md (2026-10-03). Retry after 1.42d
  and 1.42f (and 1.42e if that is done), judged by area, on seeds from 401.** Critic B1 (static world), continued: every seed passes the two criteria added on
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

## Phase 2 — Semantic zoom

- [x] 2.1 T1 operational markers (symbol, flag chip, strength bar + number, order arrows, battle markers).
  AT: the strength number equals the sim Σ element strength (e2e reads both).
- [x] 2.2 T0 aggregated counters with stable multi-level clustering + split/merge animation.
  AT: zooming T0↔T1 shows no frame where a counter vanishes without a matching animation (frame-diff check on a recorded sequence).
- [x] 2.3 Element snapshot path (interest-managed) + GPU-interpolated element sprites at T2 (facing, walk/drive anim).
  AT: 10k visible proxies ≥ 30 fps (bench); I4 still passes.
- [ ] 2.4 FireEvent visuals: tracers, muzzle flashes, impacts; casualty removal; wrecks.
  AT: e2e counts tracers in the viewport against FireEvents in the same window (equal).
- [ ] 2.5 Casualty consistency across tiers.
  AT: e2e kills elements at T2 (God-spawned battle) → T0 counter strength drops by exactly the same amount.
- [ ] 2.6 T3 close expansion (vehicles exact, infantry ≤ 64 sprites, count = strength).
  AT: e2e compares the individual count to the sim strength for 20 random elements.
- [ ] 2.7 Fade curves & hysteresis for all layers; marker→elements morph.
  AT: scripted zoom recording: max per-pixel luminance jump between consecutive frames below threshold in unit areas (no popping).
- [ ] 2.8 Procedural detail tiles (ground texture, trees, rocks, buildings near cities) by world-seeded noise, plus hillshade from the elevation pyramid.
  AT: screenshots at 4 zooms show increasing detail; the same location renders identically across reloads (image hash).
- [ ] 2.9 Coastline from the fine mask at T2/T3; elements never rendered on water.
  AT: e2e samples element positions at T3 near coasts against the mask (0 violations).
- [ ] 2.10 Scripted seamless zoom demo (world → close on an active battle), 8 stops, screenshots.
  AT: Playwright test passes; screenshots viewed; PARITY row for semantic zoom gets evidence.

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

## Phase 7 — Balance, polish, soak

- [ ] 7.1 Performance pass against all budgets (T0 60 fps, T2 30 fps @10k, tick ≤ 1.5 ms).
  AT: `docs/bench/` report green on the reference machine.
- [ ] 7.1b Map sizes S–XL (ADR-43): convert the audited cell constants to km (identical at M,
  hash-checked); per-km territory hold rates and garrisons; L/XL terrain assets (revisit
  ADR-13); per-game geometry instead of SIZE_1938; a size picker in the new-game options.
  AT: S and L games start from the picker; the sweep criteria hold at S and L; XL meets its
  tick and memory budgets.
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

# Decisions (ADR log)

Format: ID · date · status · decision · why · consequences. Deliberate deviations
from AoC are tagged **[AoC-DEVIATION]**.

---

### ADR-1 · 2026-10-02 · accepted — Territory = authoritative cell raster + resolution-independent rendering
**Decision.** The sim owns a cell grid (owner, controller, terrain, province, flags). Rendering
draws it with smooth shader borders, a fine coastline mask and procedural detail tiles.
It never shows blocky cells.
**Why.** AoC's charm comes from per-pixel fronts (VISUAL: reference screenshots), and a
raster keeps the editor (brush/bucket/line), map import and frontier processing simple and
fast. Vector provinces would lose the organic fronts. A pure raster would fail the
"no blocky zoom" rule, so the render layer adds resolution independence.
**Consequences.** Cosmetic border displacement is bounded below 0.5 cell, so render
and sim never disagree on ownership. Sim cost scales with the frontier, not grid
area. The default size is M (2048×1024), which is about 20× AoC's land tile count.

### ADR-2 · 2026-10-02 · accepted — Worker-authoritative sim; snapshots with interest management
**Decision.** The pure `src/sim` runs in a Web Worker (and in Node). Main sends commands and
viewport subscriptions and gets rAF-acked transferable snapshots. Subscriptions change only
what is sent.
**Why.** Keeps the UI at 60 fps regardless of sim load, gives one code path for tests,
soak and critic runs, and lets the tactical tier get rich element data without paying for the
whole world.
**Consequences.** Invariant I4 (hash unchanged under viewport churn) is a permanent
test. Lint rules forbid render/ui imports in sim.

### ADR-3 · 2026-10-02 · accepted — Formations → elements → individuals, combat at element level everywhere
**Decision.** Elements (unit proxies of N men, vehicles, ships or planes) are authoritative sim
entities, and combat resolves per element in every battle whether viewed or not. Slotted
element poses and sortie paths are "derived kinematics" (pure functions of state).
The close tier expands elements into individuals, with the count equal to strength.
**Why.** This is the only way to satisfy "same state drives every tier" and "casualties at
tactical zoom change strength at strategic zoom" without view-dependent simulation,
which would break determinism.
**Consequences.** Bounded cost: element combat only inside battles (about 20–40k engaged
elements worst case). Individual positions within an element footprint are
presentational, and this is documented in SPEC §8.

### ADR-4 · 2026-10-02 · accepted (finalised in PLAN 0.15) — LOD tiers & render stack: raw WebGL2 + twgl.js
**Decision.**
- Four tiers T0–T3 over continuous zoom, with opacity curves and hysteresis.
- Render stack: **raw WebGL2 + twgl.js** (MIT); PixiJS is not used at runtime.
- Map: one full-screen pass over R16UI owner/controller textures with cubic B-spline indicator
  smoothing (`src/render/map`).
- Units: one instanced draw per atlas with GPU prev→cur interpolation (`src/render/units`).
- Camera-relative f32 coordinates: integer origin + f32 offsets, with the camera offset computed in f64.

**Why.** Measured with `npm run bench` on 2026-10-02 (`docs/bench/*.json`). Setup: RTX 4070 Ti, ANGLE/D3D11,
1920×1080, vsync off, GPU time from EXT_disjoint_timer_query_webgl2. Pixi rows use a ParticleContainer
(Pixi's fastest path) with CPU interpolation; the map in the Pixi scene is a pre-rendered texture.

| case | stack | uncapped fps | CPU ms/frame p50 / p95 | GPU ms/frame | GPU ms units only |
|---|---|---|---|---|---|
| T0 map, 150 nations | raw | ~5000 | ≈0 | 0.43–0.46 | — |
| 10k proxies + map | raw | 2957 | 0.00 / 0.10 | 0.41 | 0.016 |
| 30k proxies + map | raw | 2487 | 0.00 / 0.10 | 0.47 | 0.059 |
| 10k proxies + map sprite | Pixi 8.22 | 2336 | 0.20 / 1.10 | 0.12 | ≈0.07 (frame − sprite) |
| 30k proxies + map sprite | Pixi 8.22 | 1412 | 0.40 / 1.40 | 0.32 | ≈0.27 (frame − sprite) |

- Raw instancing with GPU interpolation draws 30k proxies in about 0.06 ms GPU and ~0 ms per-frame CPU.
  Pixi needs CPU interpolation every frame: 0.4–1.4 ms at 30k on this CPU, likely 1–4 ms on a laptop, which
  is a large part of the 6 ms main-thread budget. It also spends about 4× more GPU time on the same sprites.
- The map must use custom integer-texture shaders anyway. In Pixi that means custom Mesh/Shader code with no
  benefit from the library.
- twgl adds only thin helpers (uniform setting, program and texture creation), so we keep full control.

**Budget translation (mid-range laptop).** A mid-range laptop iGPU (e.g. Iris Xe) is roughly 15–20× slower
than the dev GPU. Dev-GPU guards, checked by `npm run bench` in Phase 7:
- T0 full frame ≤ 1.0 ms GPU at 1080p (now 0.46);
- T2 frame with 10k proxies ≤ 2.0 ms GPU (now 0.41);
- per-frame main-thread CPU ≤ 1 ms with 30k proxies (now ≈ 0.1 p95).

Uncapped fps on the dev machine is recorded but is not the budget metric.

**Consequences.**
- Map modes, occupation hatching and borders live in GLSL.
- Instance buffers are refilled once per snapshot: 1.2 ms for 30k proxies on the main thread. Phase 2 moves
  the fill into the worker's snapshot builder (the instance layout becomes part of `shared/protocol`).
- `pixi.js` stays a devDependency only for the BP benchmark page.

### ADR-5 · 2026-10-02 · accepted — 1 tick = 1 sim hour; f64 + dmath + PCG32 determinism
**Decision.** Fixed 1 h tick with staggered AI and daily/monthly subsystems. Fire events carry
a subtick for smooth tactical animation. f64 using only exactly-specified ops,
custom trig/exp, per-subsystem RNG streams and a counter-based hash for order-independent draws.
**Why.** An hour is fine enough for movement and combat to look continuous when
interpolated, yet coarse enough that 30 sim-years (263k ticks) fit the soak and sweep
budget. `Math.sin` etc. are not guaranteed bit-identical across engines. Fixed-point
was considered and rejected as slower to write, with no benefit given the restricted op set.
**Consequences.** ESLint bans nondeterministic APIs in `src/sim`. Golden-value tests run
in both Node and Chromium.

### ADR-6 · 2026-10-02 · accepted — No SharedArrayBuffer
**Why.** Static hosts (itch.io, GitHub Pages) cannot reliably set COOP/COEP headers.
Transferable buffers with a recycled pool give equivalent throughput at our snapshot
sizes.

### ADR-7 · 2026-10-02 · accepted (crop refined in PLAN 0.18) — Miller cylindrical projection, cropped 80°N–64.165°S, per-row scale tables **[AoC-DEVIATION]**
**Refinement (PLAN 0.18).** The southern crop is 64.165°S instead of ~60°S. This makes the projected extent
exactly 2π × π, so every map size is W = 2H with square cells (`src/sim/data/projection.ts`). It also keeps
the tip of the Antarctic Peninsula at the bottom edge.
**Why.** A familiar world shape, a simple wrap for the looping map, and correct km-based
speeds and blast radii via `kx/ky[y]`. Antarctica is excluded by default (it adds no
gameplay). AoC appears to use an equirectangular-like stretch (VISUAL, low confidence).

### ADR-8 · 2026-10-02 · accepted — 1938 borders from Natural Earth admin-0/1 + hand assignment
**Why.** No permissive 1938 dataset was found: CShapes 2.0 is CC BY-NC-SA (non-commercial),
and aourednik/historical-basemaps is GPL-3.0 (copyleft would spread to the project's data).
Natural Earth is public domain. Admin-1 is assigned to 1938 owners, with hand-drawn
polylines where interwar borders split admin-1 units.
**Consequences.** Some border segments are approximations. The polylines are listed in
DATA_SOURCES as our own work.

### ADR-9 · 2026-10-02 · accepted — Binary gzip saves; JSON+RLE scenario files; IndexedDB autosave
**Why.** Typed-array sections give a bit-identical round trip and fast load.
`CompressionStream` exists in both browsers and Node 18+. Scenario files stay
human-inspectable and shareable.

### ADR-10 · 2026-10-02 · accepted — Own flag artwork; 1938 Germany uses the black-white-red tricolour **[AoC-DEVIATION]**
**Why.** All flags are drawn as our own SVG specs, so no third-party art is used. A
swastika flag is legally restricted in several jurisdictions (e.g. §86a StGB) and would
complicate static hosting and storefronts. The 1933–35 state tricolour is historically
grounded and recognisable. The flag editor lets users change it in their scenarios.

### ADR-11 · 2026-10-02 · accepted — DOM UI with Preact + signals over the canvas
**Why.** Built-in i18n, text layout, accessibility and UI-size scaling (`rem`) come for
free. Panels update at low frequency, so DOM cost is negligible. The canvas is reserved
for the map and units.

### ADR-12 · 2026-10-02 · accepted — TypeScript pinned to 6.0; local module-boundary lint rule
**Decision.** Pin `typescript` to `~6.0` (was 7.0.2). Enforce SPEC §2.1 layers with a local
ESLint rule (`warsim/module-boundaries`) instead of `import-x/no-restricted-paths`.
**Why.** TypeScript 7 is the native (Go) compiler and ships no JS API; typescript-eslint
8.71 requires `typescript >=4.8.4 <6.1.0`. 6.0 is the last JS-API release with the same
language semantics, so `tsc -b` and ESLint share one compiler. `import-x` resolves imports
through the filesystem, so it cannot check fixture files linted at virtual paths or imports
of modules that don't exist yet; a lexical resolver is about 100 lines, has no native
dependency (`unrs-resolver`) and also lets the sim have a package allowlist (`zod` only).
**Consequences.** Revisit when typescript-eslint supports TS 7 (it can then move to the
native compiler). The rule does not follow path aliases; none are used (relative imports only).

### ADR-13 · 2026-10-02 · accepted — Shipped map-asset budget and elevation codec
**Decision.**
- `npm run data` produces assets that are committed under `public/data/earth/`, so a fresh clone builds and
  runs offline: the 16384×8192 land mask (0.38 MB), elevation at 2048×1024, 1024×512 and 512×256
  (2.9 MB total), and admin-1 geometry (3.1 MB, exact NE vertices quantised to 2⁻²⁰) + metadata (0.13 MB).
  Total ≈ 6.5 MB.
- Shipped files use a neutral `.wsz` extension (gzip payload): static servers, including `vite preview`,
  add `Content-Encoding: gzip` to `.gz` files, so `fetch` would return decompressed bytes and the sha256
  check would fail.
- Admin-1 geometry is not simplified: independent per-polygon simplification would open gaps and overlaps
  along shared borders, while exact shared vertices rasterize gap-free.
- The 4096×2048 elevation level is a local derived product only (`.cache/data/derived/`, ~8 MB), for
  offline scenario and terrain tools.
- Elevation encoding: gzip(byte-planes(row-delta(int16 m))), with ocean depths quantised to 10 m.
- gzip headers are normalised (mtime 0, OS byte 255) so outputs are byte-identical across platforms. Raw
  sources are pinned by URL tag and sha256 (`tools/data/sources.json`).

**Why.** Raw int16 + gzip was 13.8 MB at 4096 and 3.5 MB at 2048. Delta + byte-planes halves that: elevation
is smooth along rows, and the high byte is almost constant. Coarse bathymetry is enough for sea shading.
A shipped budget of ~5 MB keeps the static site and the repo light. M-size maps (2048×1024) use the 2048
level directly; hillshade at higher zoom adds procedural detail (SPEC §8 T2/T3), so a 4096 level adds little.

**Consequences.** L/XL maps derive terrain from the cached 4096 level offline (scenario build), never at
runtime. Regenerating assets is idempotent (`npm run data -- --check` fails on drift), and
`tests/unit/data-manifest.test.ts` verifies sha256, sizes, known places and pyramid consistency.

### ADR-52 · 2026-10-03 · accepted — Land is measured by area, not by cells (the user's decision; PLAN 1.42d)

- **Context:** the map grid is a Miller projection: a cell covers `kx[y] × ky[y]` km², which
  shrinks towards the poles. Every land figure so far is a cell count. Measured at the 1938
  start (seed 1; owned land 133 M km²):

  | Nation | Share of cells | Share of area | Area |
  |---|---|---|---|
  | Soviet Union | 26.8% | 15.9% | 21.2 M km² |
  | Canada | 12.3% | 6.8% | 9.1 M km² |
  | USA | 7.3% | 7.0% | 9.3 M km² |
  | Denmark (Greenland) | 5.4% | 1.5% | 2.0 M km² |
  | Australia | 4.0% | 6.1% | 8.1 M km² |
  | Brazil | 3.7% | 6.4% | 8.5 M km² |

  By cells Denmark is the fourth-largest nation in the world and the Soviet Union holds more
  than a quarter of it. Both are artefacts of the projection.
- **Decision:** land is measured in km² wherever a share or a ranking of land is reported.
  One rule for all the land criteria of the sweep (SPEC §10): land moving in the last 5 years,
  largest land share, the ten largest land holders, and the leader-share range all use area.
  The same for the statistics, the ranking and the nation panel. The thresholds keep their
  numbers (1% moving, < 35% land, ≥ 2 newcomers, ≥ 3 points of range); the income and war
  criteria are untouched.
- **This is a change of what the criteria measure, decided before any run with it.** The case
  for it is the table above, not a sweep outcome: no run has been judged by area. Only unseen
  seeds (401 and up) judge PLAN 1.42 under it; the seen seeds (1–10, 99, 101–110, 201–210,
  301–310) are not re-run or re-judged to claim a pass, and the three FAILING reports stand
  as they are.
- **Implemented 2026-10-03 (PLAN 1.42d):** `cellAreaByRow` (`src/sim/nav/grid.ts`, the row
  scales the nav grid already used) and `src/sim/landArea.ts` (`ownedAreas`, `landStandings`),
  derived from the owner raster on demand and never state. Used by `tools/sweep`, the ranking,
  the nation panel (km² and share of owned land) and `npm run diag`. The sweep result fields
  are now `changedKm2` and `landKm2`; the reports already in `docs/sweeps/` keep their cell
  counts. Measured: 133.3 M km² owned, Soviet Union 21.19 M km².
- **Split off (PLAN 1.42d2):** the monthly statistics series (the land chart) still records
  cells. It is saved and hashed state, so changing what it records moves the state hash
  without any rule changing; that gets its own commit with the hash evidence.
- **Series in km² (PLAN 1.42d2, 2026-10-03):** the land column of the statistics series is
  `ownedAreas` at each month start (one scan of the owner raster a month). The series is
  hashed state, so the hash of seed 99 × 5 years moves from ac517acf to 93effc58; the hash of
  every part except the series is dd414d91 before and after, so no rule changed. The section
  is renamed from `stats.rows` to `stats.km2`: a save written before this loads with an
  empty series (as saves from before PLAN 1.34b do) instead of a land column in mixed units.
  Everything else in such a save loads as before. Checkpoints in `.cache/ck/` keep working
  but hash differently from here on.
- **The hash in the 1.42d acceptance test was stale.** 5d08e5dd is the seed-99 5-year hash
  of PLAN 1.42a; ADR-50, PLAN 1.42c and ADR-51 changed rules after it. The check that was
  meant is "unchanged from HEAD": ac517acf at 85c2e35 and ac517acf with 1.42d.
- **Not in this decision:** sim rules that count cells (overextension, admin cost, war score,
  capitulation, small-state annexation). They are PLAN 1.42e, with their own ADR, because they
  change behaviour and the state hash; 1.42d must not (seed 99, 5 years: 5d08e5dd).

### ADR-51 · 2026-10-03 · accepted — The winner of a peace keeps all the land it occupies (critic B1, PLAN 1.42)

- **Context:** after ADR-47 and ADR-50 two sweeps on unseen seeds failed (9 of 10, then 7 of
  10). In every 50-year run the Soviet Union stayed the largest nation and shrank only as far
  as revolts happened to take it. Wars did not move it: the winner annexed
  round(|score|/100 × occupied), and the score is itself proportional to the occupied land, so
  the land that changed owner went with the square of the conquest. A coalition holding 4,000
  Soviet cells at score 20 kept 800 of 170,000.
- **Decision:** at a peace with |score| ≥ 10 the winner annexes every cell of the losers that
  it occupies. Below 10 it is still a white peace, and the losers' occupations of the winners
  still revert. The puppet rule (≥ 90, ≥ 30% of the losers' land) is unchanged. The
  nearest-first selection of annexed cells is gone with the quota.
- **Why:** the critic's report asks for "occupation that converts to ownership at peace", and
  it is what an observer expects of the map: ground taken in a won war stays taken.
- **Tests changed with the rule** (not weakened: they assert the new terms): the score-40
  peace now annexes all occupied cells (it asserted 40%, nearest first); the relative-score
  test's last lines assert that Germany keeps what it took (was: about half). New: the losers'
  occupations revert at a dictated peace.
- **Result on seen seeds 101–110** (scratch sweep, `.cache/sweep/reports`): 10 of 10 pass.
  Leader-share range 4.1–16.1 points (was 2.7–8.6 under ADR-47), 2–4 newcomers in the top
  ten, land moving in the last 5 years 4.8–23.0%, largest nation 12–26% at the end. The
  leader is still the Soviet Union in every year of every seed.
- **Result on unseen seeds 301–310** (`docs/sweeps/2026-10-03-sweep-b1d.md`): **8 of 10**.
  Every seed has 2–3 newcomers in the top ten (two seeds failed that in the sweep before);
  seeds 304 and 306 fail the leader-share range (2.6 and 1.6 points: the Soviet Union ends at
  25.2% and 27.5%). The rule stays: it is what the critic asked for and the three sweeps (9,
  7 and 8 of 10, each on other seeds) do not show it doing harm. B1 is not closed: BLOCKERS.

### ADR-50 · 2026-10-03 · accepted — Partners in a war fight on each other's fronts (critic B1, PLAN 1.42b)

- **Context:** seed 109 failed the leader-share range (2.7 points). A dump at year 25 showed the
  Soviet Union with 78k men and 27% of the land, at war with a coalition of 28 for 557 days at
  score 0, and with Japan (442k men) for 317 days at score 0. Pressure on a cell counted only
  for the nation holding the neighbouring cell, a formation was supplied only on its own bloc's
  network, the operational AI saw only fronts its own nation held, and idle formations on a
  partner's land were sent home. A coalition therefore fought with its border states alone.
- **Decision:** nations on the same side of a war are partners (`Wars.sameSide`; not if they
  are also at war with each other).
  1. *Territory:* attack pressure on a cell = the neighbouring holder's plus its partners' at
     war with the defender; defence = the defender's bloc plus its partners. The cell goes to
     the neighbouring holder, so the connectivity rule is unchanged.
  2. *Supply:* a partner's network feeds a formation.
  3. *Repatriation* skips formations standing on a partner's land.
  4. *Operational AI:* a partner's front cells against a common enemy are front cells.
- **Why this way:** land taken goes to the member that holds the front, so no new rule is
  needed for who owns a conquest, and peace terms work as before.
- **Result:** 50-year runs of seeds 99, 105, 108 and 109 (all seen before; a check, not the
  sweep): leader-share range 5.4, 8.5, 10.0 and 4.4 points (seed 109 was 2.7). Seed 108 has
  only 1 new nation in the top ten (was 3), so the full criteria are still not met on every
  seed: PLAN 1.42 stays open.
- **Follow-up, PLAN 1.42c (same day):** the economic AI replaces an order it cannot pay for by
  the infantry division when that one is affordable. Before, the build loop returned and every
  slot stayed empty until the treasury covered a panzer division (3,829 gold against 1,001)
  plus three months of income: 9 Soviet formations in 30 months of war on seed 109. Same four
  seeds: all pass all seven criteria (leader-share range 4.6–14.7 points, 2–4 newcomers).
- **Sweep on unseen seeds 201–210** (`docs/sweeps/2026-10-03-sweep-b1c.md`): **7 of 10** pass;
  three fail churn or the leader-share range. The four-seed check was noise: these two rules
  are kept because they remove real defects (coalitions that could not fight, an idle build
  queue), not because they close B1. They do not.

### ADR-49 · 2026-10-03 · accepted — Parity-only gate for document commits; critic remediation restarts the critic count (user request)

- **Gate:** nothing but `npm run parity` reads Markdown or `docs/`, so a working tree that
  differs from HEAD only in documents runs parity alone (about a second instead of ~5 minutes).
  `npm run check` is now `tools/gate/check.ts`, which plans the stages from `git status`: it
  replaces the separate sweep-stage script of ADR-48. `critic/` is ignored. A clean tree still
  checks the code. `package.json` no longer triggers the sweep tests (script edits); a
  dependency change shows in `package-lock.json`, which does.
- **Critic cadence:** PROMPT step 2a ran the critic once HEAD was 5 commits past the report.
  Step 2b puts critic findings first, so those 5 commits were all remediation and the critic
  came straight back with new findings: the PLAN phases would never be reached. Now the 5
  commits are counted from the last remediation commit after the report. A remediation commit
  is one whose subject starts with "Critic ". `npm run critic:due` computes it.
- **Consequence to watch:** step 2b still applies while the report is within the last 10
  commits. So after a report: up to 10 commits of remediation, then other work, and the critic
  5 commits after the last remediation. Step 2a's other triggers (phase review, DONE believed)
  are unchanged.

### ADR-48 · 2026-10-03 · accepted — Shorter iterations: conditional sweep tests, checkpoints, quick sweeps (user request)

- **Context:** the ADR-47 iteration took almost three hours. About 95 minutes were three full
  sweeps, 35 the gate (three runs), 35 diagnostic runs that each re-simulated from 1938. One
  sweep was repeated because the gate ran after it and found a bug. The user asked for all the
  remedies proposed.
- **Decision:**
  1. `npm run check` runs the 10-year sweep tests only when the working tree differs from HEAD
     under `src/sim`, `src/shared`, `data`, `public/data`, `tests/sweep`, `tests/helpers`,
     `tools/headless`, the sweep vitest config or the package files. `npm run check:full` always
     runs them. The user approved this change to the gate. It relies on every commit being
     gated; after a pull or rebase, and for the DONE condition, use `check:full`.
  2. Checkpoints: `npm run sim -- --save / --load`; `npm run diag` (the B1 diagnostic, now a
     tool) takes `--load` and `--save`.
  3. `npm run sweep:quick` (3 seeds × 20 years) writes to `.cache/`; only final sweeps go to
     `docs/sweeps/`.
  4. Working rules in PROMPT.md "KEEPING ITERATIONS SHORT": one cause per commit, tune on quick
     sweeps, gate before the final sweep, diagnose from checkpoints, fix an over-budget tick
     before the next task that needs a full sweep.
  5. PLAN 1.42a (tick time) goes before 1.42 (the rest of critic B1), because 1.42 needs full
     sweeps and each now takes 36 minutes. This puts a non-blocking critic finding (N2) ahead of
     a blocking one for one iteration, as its means.
- **Not changed:** the sweep criteria, the test assertions, and what `check:full` covers.

### ADR-47 · 2026-10-03 · accepted — Wars that resolve, armies that recover, empires that strain (critic B1)

- **Context:** the critic (report at bb1dd4f) found the world static: on an unseen seed the ten
  largest land holders were the same from year 9 to year 40 and the leader's share stayed at
  27%. A diagnostic run on that seed showed why:
  - fight-to-the-death wars never ended (Japan–China and France–Nationalist Spain ran 14+
    years at exhaustion 100), pinning their members' war slots and exhaustion;
  - the war score was the occupied share of the *victim's* land, so nothing taken from a large
    nation ever scored above a white peace;
  - a target counted its whole alliance and its guarantors in full and the attacker counted
    nobody, so after a few years of alliance-building no attack had positive utility;
  - one production order at a time meant ~36 new divisions a year worldwide, while wars killed
    60–95% of the armies in them, and winners' formations left on returned land starved there;
  - new formations appeared at the capital, so Japan's sat on the home islands.
- **Decision:**
  1. *Relative score:* occupied land counts against min(victim's land, 2 × occupiers' land).
     Puppets still need 30% of the losers' land in true share.
  2. *Capitulation:* a side 75% occupied (or a leader 75% occupied by anyone) loses at once.
  3. *Deadlock:* any war ends on its score after 5 years. **Deviation from AoC** ("To Death"
     lasts until one side dies): without sea transport many of our to-the-death wars cannot be
     finished by either side; revisit after PLAN 4.5. PLAN 1.16's AT (never accepts peace,
     however crushed or broke) still holds within those 5 years and below capitulation.
  4. *Capital bonus* capped at ± 50 per war (field capitals fell repeatedly: 178 captures).
  5. *Strength comparison:* both sides add 40% of their partners.
  6. *Parallel production:* 1 + income/400 orders at once, at most 6; the peacetime army cap
     scales with aggression (35% × (0.3 + 0.7 × aggression/100) of income).
  7. *Repatriation* of idle formations on foreign land they are not at war with.
  8. *Overseas muster:* reinforcements for an overseas front are raised in the theatre. An
     abstraction of sealift, to be replaced by transports in PLAN 4.5.
  9. *Defection and spreading revolts:* a revolt returns land to its living core nation, or
     joins a neighbouring rebel state, before it founds a new nation (also part of critic B4).
  10. *Overextension:* far provinces of nations above 4% of the land gain unrest (SPEC §4).
      Tried at 3 and 2 per month first: the Soviet Union lost three quarters of its land within
      5 years on seed 99, too fast for a 1938 start. At 1.25, with the war term tied to
      exhaustion ≥ 60, it shrinks over decades.
- **Sweep criteria:** two new ones, fixed before the first run with them: ≥ 2 new nations in
  the top ten by land at the end, and a leader-share range ≥ 3 points. Tuning used seeds 1–10
  and 99; the report is on seeds 101–110, which the tuning never saw.
- **Bug found by the gate:** `declareWar` kept a nation off a side only when it was allied to
  the enemy *leader*. A puppet sitting in another alliance than its overlord could be pulled in
  against its own ally (10-year AI sweep, seed 1: "allies 11 and 14 at war"). More puppets exist
  now, so it surfaced. Nobody joins against an ally on the other side any more (unit test).
- **Result** (`docs/sweeps/2026-10-03-sweep-b1.md`, seeds 101–110 × 50 years, final code): 9 of
  10 seeds pass all seven criteria. Land moving in the last 5 years 3.6–15.9% (was 1.1–6.7% on
  seeds 1–10), 2–4 new nations in the top ten, leader share range 4.9–8.6 points on nine seeds
  and 2.7 on seed 109 (**fails** the 3-point bar), nations alive 95–146 (was 97–231). The
  report is marked FAILING and PLAN 1.42 stays open; the thresholds were not moved.
- **Cost:** more wars, moves and flips. The tick mean in year 1 of seed 99 rose from 2.4 ms to
  4.6–5.9 ms (a profile shows supply reflood 20%, pathfinding 23%, combat 13%; the new systems
  are under 2%). The 1.5 ms budget is PLAN 7.1.
- **Tests isolated from the AI** (assertions unchanged): the speed-buff march (a war now
  reaches Poland within the march) and the region-revolt test (the AI now suppresses core
  unrest, which calmed the neighbours before the revolt fired).

### ADR-46 · 2026-10-03 · accepted — Element snapshots from slot poses; procedural walk/drive animation (PLAN 2.3)

**Context.** T2 needs element sprites at real positions, interest-managed, interpolated on the
GPU, with facing and a walk or drive animation. Elements have no stored position: the sim
places them by `slotPose` from their formation.

**Decision.**
- The snapshot's `elements` section lists the elements of the formations whose position is
  inside the subscribed bbox. It is built only when the subscription wants elements at tier
  ≥ 1.5, and is capped at 40k (whole formations; `truncated` reports a cut).
- Positions are `slotPose` of the current and previous formation positions, the same function
  the sim uses. An empty section uses static empty arrays, so no pooled buffers are taken.
- The view subscribes from the frame loop: the bbox padded by 25%, `tierOf(m/px)`, at most
  10 Hz, and only when the quantised bbox or tier changes.
- The animation is procedural in the proxy shader, because the atlas has no walk frames. A
  frame value of `frame + 0.5` marks a moving element: infantry sway at walking cadence,
  vehicles judder, each with a per-instance phase.
- Elements fade in as the T1 markers fade out (`1 − α_markers` below 300 m/px). Formation
  sprites stand in only while no elements have arrived. Sprites are lightened 45% toward white
  so they read on their own nation's fill.

**Consequences.** A T2 snapshot carries about 11 more buffers. PLAN 2.4–2.6 add fire events,
casualties and T3 expansion on top of this section. A real atlas with walk frames can replace
the shader animation later.

### ADR-45 · 2026-10-03 · accepted — T0 counters: nested 2^L grids, child-level animation, key-tracked continuity check (PLAN 2.2)

**Context.** SPEC §8 asks for stable multi-level clustering with split/merge animation, and the AT
asks for a frame-diff check that no counter vanishes without an animation.

**Decision.**
- Clusters are per nation per cell of a world-aligned 2^L-cell grid. The grids nest, so a parent
  is exactly the union of its children and Σ strength is conserved at every level.
- L is chosen so that a grid cell is about 64 CSS px on screen, with ±0.15 hysteresis.
- On a level change, the finer level's counters animate for 250 ms: from the parent centroid when
  splitting, to it when merging. The target level then replaces them at the same positions. One
  transition at a time; a multi-level jump is a single transition.
- T0↔T1 is a cross-fade (counters `1 − α_markers` above 2000 m/px). Clusters near T1 are already
  small, so the split-to-members animation of SPEC §8 is approximated by the fade.
- The AT check uses the drawn item lists (counters and markers, world position, key, opacity)
  per 16 ms frame of a scripted zoom, not pixels. Map pixels change with every zoom step, so a
  pixel diff cannot separate a pop from camera motion.
  - An item must continue under the same key (≤ 80 px per frame, i.e. an animation) or be
    replaced in place (same nation, ≤ 12 px).
  - Opacity may drop at most 0.3 per frame, in both directions.
  - Verified by mutation: with the animation disabled, the check fails.
- The recording draws only the unit layers (`MapView.drawUnitLayers`). Software-rendering the
  map for 250 frames starved parallel e2e workers: one editor `inspect` took 19 s instead of 15 ms.
- The unit-size setting now scales counters and markers. The settings e2e reads map + overlay.

**Consequences.** Formation sprites draw only below T1 until element sprites (PLAN 2.3).
Counters overlap where nations' clusters are adjacent; decluttering can come with 2.7 if needed.

### ADR-44 · 2026-10-03 · accepted — Dynamism tuning for the 50-year sweep (PLAN 1.40)

- **Context:** the first 10-seed × 50-year sweep (SPEC §10) failed. Every seed ended with
  300–600 nations, and two seeds had frozen fronts. Ledgers showed revolts (30–80 a year) far
  outpacing deaths:
  - half the revolts started in peace and stayed independent;
  - losing rebels survived as rumps or puppets;
  - conquered land stayed non-core forever, so it kept revolting;
  - fight-to-death passed from any side member to whole alliance blocs, so wars never ended.
- **Decision** (each change measured with 10 × 20-year sweeps, then the full 10 × 50):
  1. A revolt always starts a war of independence (was 50%).
  2. A peace in which the winner scores ≥ WHITE_PEACE annexes a losing leader smaller than
     SMALL_STATE_CELLS (40 cells ≈ 15,000 km²), instead of leaving a rump or a puppet.
  3. Coring: a province held (owned and controlled) by one nation for CORE_YEARS (10) becomes
     its core; the former rightful owner keeps a claim.
  4. Garrison (SPEC §4, now implemented): a holder's formation within GARRISON_CELLS (3) of a
     province centre lowers its unrest by 3 a month and its revolt chance by 70%.
  5. Fight-to-death passes to a war side only from its leader (it was any member).
  6. The 1938 scenario sets `revoltMode: "region"` (new scenario setting): a restless region
     of up to 8 provinces revolts as one nation.
- **Criteria threshold:** SPEC gives "> threshold" for border movement; set before tuning to 1% of
  land cells over the last 5 years and not changed afterwards.
- **Result:** docs/sweeps/2026-10-03-sweep.md: all 10 seeds green. Nations 97–231; largest land 24–27%; largest income
  28–29%; land moving 1.1–6.7%; wars in every year.
- **Not done:** fight-to-death sides still never surrender (PLAN 1.16's AT keeps it so), so the
  scenario's to-the-death wars can run all 50 years.

### ADR-43 · 2026-10-03 · accepted — Map sizes S–XL move to Phase 7 (after km-based sim distances)

- **Context:** PLAN 1.39b2 asked for a map-size picker (S–XL) for the 1938 world. An audit found
  the sim tuned for the M map (2048×1024, ~19.6 km per cell). Movement is km-based, but much
  else is counted in cells:
  - operational AI sectors (4) and deploy range (60);
  - combat contact (1.5) and buckets (2);
  - Major Battle match/end radii (3/5) and corridor length/width (8/2);
  - movement target snap (3), production spawn reach (40), militia per 40 cells;
  - city snapping (2), OOB anchor reach (12), strait extension (4);
  - territory pressure radius (2), and cell-by-cell flips with fixed hold time and garrison.
    At L, fronts would advance at half the speed in km, and AI/battle reach would halve.
  - `kmPerCell` exists but no system uses it.
- **Further costs:** L/XL terrain is not shipped (ADR-13 budget: terrain derives offline from
  the 4096 elevation level). Ticks already exceed the budget at M (2.6 ms vs 1.5 ms, PLAN 7.1).
- **Decision:** the 1938 world stays M-sized in Phase 1. Map sizes become PLAN 7.1b, after the
  performance pass. It covers:
  - converting every audited cell constant to km (identical at M, hash-checked);
  - per-km territory hold rates and garrisons, re-checked by the dynamism sweeps;
  - shipped L/XL terrain (revisiting ADR-13's budget) and XL tick and memory budgets.
- **Consequences:** PARITY row 70 stays "not started". The settings panel offers no size
  picker. Looping map and the randomisation options shipped in 1.39b1.

### ADR-42 · 2026-10-02 · accepted — Editor edits are commands; the undo stack is world state

- **Context:** the editor needs undo/redo (SPEC §9). Edits change state the sim hashes.
- **Decision:**
  - Paint, undo and redo are commands. The diff stack (cells with values before and after; the
    nation layer also keeps controllers) is a saved world part.
  - The stack is capped at 50 edits / 500 k cells (2 M at first; lowered in the review after PLAN 1.36 to keep saves small), oldest dropped. A new edit clears redo.
- **Why not in the UI:** a UI-side stack would need CPU copies of every layer. Worse, a save
  plus a later command log containing undos would not replay.
- **Consequences:** saves carry up to the capped diffs. Water ↔ land edits wait for map import
  (the fine coastline comes from the 16k land mask).

### ADR-41 · 2026-10-02 · accepted — God Kill is a forced collapse; God revival keeps the revival rules

- **Context:** the God `collapseNation` reused the bankruptcy collapse, which fragments only
  restless land. On a calm nation it was a silent default, so AoC's "Kill a nation with a click"
  did nothing visible (found by the PLAN 1.32 e2e).
- **Decision:**
  - The God command forces the collapse. Dead claimants revive, every other province splits into
    rebel nations of at most REGION_MAX (8) connected provinces, and the nation is eliminated.
    Province-less slivers go to the largest fragment. The bankruptcy collapse is unchanged.
  - God revival (`reviveNation`) still obeys the revival count and cooldown. The PLAN 1.20
    acceptance test exercises those limits through it.
- **Consequences:** Kill always visibly ends a nation. A God-killed nation can come back by God
  only after the cooldown, like a natural death.

### ADR-40 · 2026-10-02 · accepted — Curved nation names on a Canvas2D overlay, not an MSDF atlas
**Decision.**
- Nation names are drawn glyph by glyph along the worker's Bézier on a 2D canvas overlay. SPEC §8
  planned an MSDF font atlas.
- The labelled territory is the capital's component, else the largest.

**Why.**
- The repo has no MSDF tooling (msdfgen), and city names already use Canvas2D for crisp text in
  any script.
- About 100 curved labels of ~10 glyphs each draw in well under a millisecond, and only on
  redraws. MSDF can return if T1–T3 label counts grow by orders of magnitude.
- Using the largest component put "France" in Algeria and "Italy" in Libya. The first evidence
  shot caught it.

### ADR-39 · 2026-10-02 · accepted — Border distance from analytic gradients, not fwidth
**Decision.**
- The T0 border distance uses the analytic derivative of the B-spline indicator fields.
- It is computed in a second 4×4 pass only for pixels that can be within a line width of the
  border.

**Why.**
- The dashed stair lines inside nations (noted since PLAN 1.3) came from `fwidth(d)` evaluated
  inside the `n > 1` branch. Within a 2×2 pixel quad some pixels skip that branch, which leaves
  derivatives undefined. Where the second id switches, fwidth spikes.
- Analytic derivatives are exact per pixel.
- Carrying gradients for all 16 ids cost 1.30 ms per frame. The bounded |∇d| lets most pixels
  skip the pass: 0.54 ms, within the 1.0 ms T0 budget.
- An e2e regression check samples the band 2–4 cells inside Poland. The old shader leaves 14 dark
  pixels there, the new one none.
- Compared with the AoC reference (pixel-art fills and thick black stair borders, `reference/`
  crops), ours keeps the same reading (flat fills, dark borders, lighter coasts) at any zoom,
  without stairs (additions row 10).

### ADR-38 · 2026-10-02 · accepted — Economic AI on projected accounts; admin cost capped at half of gross
**Decision.**
- The economic AI runs before the economy, on projected accounts for the coming month. It
  disbands to balance, sets suppression, and builds within upkeep shares and reserves.
- Admin cost is capped at 50% of gross income.

**Why.**
- The 1938 order of battle gives some nations armies they cannot pay for: Mongolia's upkeep is
  ~10× its income. Run after the economy, the AI disbanded only after the first month had already
  bankrupted them. Projecting the month fixes that by construction.
- Barren giants (Mongolia: 7,488 cells, 0.7 gold income, 3.8 admin) were insolvent with no army
  at all. The superlinear admin is anti-hegemon pressure on large empires, not a tax on steppe.
  The cap only binds where admin exceeds half of income; majors (SOV 22%, CHI 4%) are unaffected.
- Results: 10 peaceful years with no bankruptcy on 3 seeds (the AT). In the war-world sweeps,
  bankruptcies fall from 121–304 to 0, and wars from ~1,000 to 261–383 per decade.

### ADR-37 · 2026-10-02 · accepted — Operational AI v1: sector allotment with sticky orders; supply refresh 12 h
**Decision.**
- Fronts are cut into 4×4-cell sectors and formations are allotted by threat. Every sector gets
  at least one formation while they last. Sectors with ≥ 1.5× superiority attack; the rest hold.
- Formations keep their sector while marching into it, are not re-routed for target shifts under
  a sector, and are not deployed from beyond 60 cells.
- The supply network refreshes every 12 h, not 6.

**Why.**
- The AT: in an isolated, sustained GER–POL war, Germany takes 763 Polish cells to Poland's 4 by
  day 60, and front coverage is 73–88%.
- The first version re-routed every formation daily, including Siberian divisions sent to Europe.
  It averaged 32.5 ms per tick in year 1. Sticky assignment, the re-route threshold and the
  deployment range cut that to 1.2 ms.
- With armies in motion the supply layer is always dirty, so a 6 h refresh cost 1.7 ms per tick.
  At 12 h an encircled division is still dry within 12 + 8 h (the 1.12 AT holds).
- Without forced fight-to-the-death, Poland sues by exhaustion around day 39, while Germany is
  still catching up from its western deployment. The AT therefore measures a sustained war.

### ADR-36 · 2026-10-02 · accepted — Strategic AI v1 and the long-run stability fixes it forced
**Decision.**
- Utility-based weekly AI with hash draws, a pacifist floor (aggression < 15) and a capped
  strength ratio.
- Long runs exposed a cascade. Fixed by:
  1. Core provinces feel war and bankruptcy as no unrest (only occupation).
  2. Integration passes the puppet's cores to the overlord.
  3. A collapse voids debt and fires only when something fragments.
  4. Rebels get 1 militia division per 40 cells and 150 gold.
  5. Expired truces are pruned.
  6. `nearestCellWhere` scans ring perimeters only. It was O(r³): 12 s whenever a nation without
     land relocated its capital.
- The 3-seed 10-year sweep is its own stage of the gate.

**Why.**
- The first 10-year runs reached 850 wars, 1,000 collapses and 700 nations. Bankrupt empires at
  war revolted everywhere; integrated colonies were non-core and revolted together; broke rebels
  re-collapsed every 6 months.
- Each fix restores the intended rule rather than tuning a constant. Cores are loyal. Integration
  makes land rightful, as in AoC. A default clears debt.
- After the fixes: ~85 wars, ~67 peaces, 30–40 alliance joins, 2 collapses and 2–3 revolts per
  10 years, at a steady ~11–15 s per simulated year.
- Running the sweep alongside the unit tests made timing-sensitive tests fail from CPU
  contention, so it runs as a separate stage.

### ADR-35 · 2026-10-02 · accepted — Major Battles by absolute concentration; winner by men still standing
**Decision.**
- A battle becomes Major at a fixed 120,000 committed men, rather than "relative to the local
  front" as SPEC says.
- The winner is decided by the men still standing near the battle when it ends.
- The corridor speeds up flips (×4) and doubles pressure along a fixed strip for 10 days.

**Why.**
- There is no front-strength model yet to define "relative to the local front". An absolute
  threshold is deterministic and testable, and a relative one can replace it with the fronts
  layer.
- The first rule, using the last observation, named the side that had just been wiped out as the
  winner: its strength was still on record from the hour before. The test caught it.
- Flip speed is how AoC's Major Battles "pierce the frontline". Speed, not reach, is the effect,
  so the AT measures time to the first flip (16 h vs 4 h).

### ADR-34 · 2026-10-02 · accepted — CE re-evaluated monthly; static CE from aggression; cost from gross income
**Decision.**
- Combat efficiency updates at our economic tick, which is monthly; AoC's economic tick is every
  5 real seconds.
- Static mode uses 0.8 + aggression/250, because the scenario data has no CE field.
- The cost is a share of gross income, proportional to CE above the peace level.

**Why.**
- The economy is monthly (ADR-22), and CE is part of the same budget, so the two tick together.
- Deriving static CE from aggression is deterministic and makes the mode meaningful without
  inventing a new data field. One can be added to `nations.json` later without changing the
  mode logic.
- Scaling the cost with income ("cost scales with nation size", SPEC §5.3) keeps war expensive
  for large and small nations alike.

### ADR-33 · 2026-10-02 · accepted — Finite revival with cooldown; collapse by bankruptcy; AoC's core death rule restored
**Decision.**
- Each nation can revive at most 2 times, each no sooner than 2 years after its death, and only on
  land it has a core or claim on.
- Bankruptcy for 6 straight months collapses a nation into revived claimants, rebels and freed
  puppets.
- A nation that loses its capital while holding no core land dies.

**Why.**
- PROMPT asks for finite revival with a cooldown. AoC remembers dead nations without a stated
  limit. That deviation (PARITY row 19) keeps long runs from oscillating forever.
- Routing revolts on claimed land to the dead claimant makes history visible: Ethiopia returns
  on Italian East Africa instead of an anonymous rebel state.
- ADR-28 deferred AoC's death rule until cores existed. With cores it applies as AoC states it:
  "a nation with cores left moves its capital, otherwise it dies".
- Stability (SPEC §4) is not modelled yet. Collapse uses the bankruptcy streak alone until it is.

### ADR-32 · 2026-10-02 · accepted — Province unrest with a monthly revolt chance; rebels as new nations
**Decision.**
- Unrest lives per admin-1 province with a saved core nation. Revolts are a monthly hash draw
  above unrest 50, scaled by unrest and suppression.
- A revolt creates a new nation with militia; with 50% the old holder declares war.
- Region mode follows province adjacency.

**Why.**
- AoC tracks revolt progress per city and fires when the owner ends a war. Provinces are our
  territorial unit (fronts, peace, cores), and a monthly chance keeps revolts in peacetime
  empires too. Both are deviations, noted in PARITY row 16.
- Hash draws make the statistical AT reproducible: 40 provinces in one sim, 35 vs 11 revolts in
  3 months without and with suppression, against 84% and 29% expected.
- Province cores are the seed of PLAN 1.20 (revival from cores), which will route revolts on
  land with a dead rightful owner to that nation's revival.

### ADR-31 · 2026-10-02 · accepted — Puppet loyalty rises with autonomy; revolts need a push
**Decision.**
- Loyalty relaxes toward 40 + 0.6 × autonomy, minus 25 while the overlord is losing a war.
- Revolt needs loyalty < 20 and autonomy ≥ 10. Above 90 a puppet leaves freely.
- Autonomy drifts up 0.25 a month, and integration runs below 50.
- Tiers are named satellite, puppet and vassal from low to high autonomy.

**Why.**
- The first model (loyalty → 100 − autonomy) made the freest subjects (Ireland, Iceland at 90)
  the least loyal. Seven 1938 puppets revolted on the first tick; the suite caught it through the
  1.16 declaration test.
- Content, autonomous vassals and restless satellites matches AoC v4.4's tiers (low autonomy
  "cannot protest", high autonomy "leaves freely").
- The upward drift is the anti-hegemon pressure from SPEC §7. Integration offers a counter-path
  for overlords who keep autonomy low.
- AoC's tier names are not ordered in the text; we order them by control. This deviation is
  noted in PARITY row 10.

### ADR-30 · 2026-10-02 · accepted — Alliances join wars on declaration; unity and loyalty drift monthly
**Decision.**
- When war is declared, each leader's alliance joins its side and the defender's guarantors join
  the defence. Joining is not chained beyond that in v1: a guarantor's own allies stay out.
- Unity is a monthly drift: shared wars, size and decay. Loyalty relaxes toward unity, and
  members below 25 leave.
- Map modes are palette swaps driven by a nation → alliance-leader field in the snapshot.

**Why.**
- In AoC alliances fight together, which is what makes the bloc map matter. Chained joining
  would turn every 1938 war into a world war on day one; the AI and coalition logic (1.24) will
  decide escalation instead.
- A simple, legible drift makes the AT ("low unity → a member leaves") predictable. Donations,
  revolts and disloyalty events plug into the same unity and loyalty values later.
- SPEC §8 forbids re-uploading the grid for map modes. The palette swap costs one 256-entry
  upload.

### ADR-29 · 2026-10-02 · accepted — War score from occupation; peace terms by score share
**Decision.**
- War score is territorial: the occupied-share difference × 200 plus capital-capture swings.
  It is recomputed daily from one grid pass, so it can't drift.
- Exhaustion is time, men lost and land lost.
- Peace terms annex a score-proportional share of the winner's occupation, nearest its own land
  first; the rest reverts. A puppet at ≥ 90.
- Fight to the death (per side) blocks peace both ways.
- `Wars` keeps the hot-path `atWar` as a derived pair set over JSON war records.

**Why.**
- AoC peace is driven by broke or exhausted nations with land kept as occupied. A score made
  from the map is legible (it is what the player sees) and deterministic. Score-share annexation
  gives graded outcomes without per-province bargaining, which the AI will add later.
- Nearest-first keeps annexed land contiguous with the winner instead of leaving islands.
- The derived pair set keeps combat, territory and movement lookups O(1).
- Test-design note: front flips need 16 h, so scripted occupations are applied right before a
  00:00 assessment. A first attempt painted them a day earlier, and Polish divisions retook some
  cells before the assessment.

### ADR-28 · 2026-10-02 · accepted — Capital loss without cores: relocate, field capital, eliminate on no land
**Decision.**
- Until cores exist (PLAN 1.21), a nation that loses its capital city moves it to its largest
  city it owns and controls. Failing that, it moves to a field capital on the nearest held cell.
- A nation dies only when it holds no land, or under winner-takes-all.
- Winner-takes-all also transfers the loser's land that the capturer occupies.

**Why.**
- AoC kills a nation without cores on capital loss. Without cores, that would kill most minors
  at the first lost city, which is too brittle for the sim's fronts.
- The AoC death rule returns with cores and collapse (1.21), recorded as a deviation in PARITY
  rows 14 and 20.
- Annexing only the loser's still-controlled land would leave the capturer's own occupied
  districts owned by a dead nation. The first test run found exactly that: 5 cells around Warsaw.

### ADR-27 · 2026-10-02 · accepted — Fronts: adjacency-only flips with a hold time; advance gated by control
**Decision.**
- A cell can flip only to a nation at war with its holder that holds a 4-neighbour.
- The attacker's pressure must beat the holder's plus a garrison for 16 consecutive hours.
- All flips in a tick are decided on start-of-tick control.
- Land formations cannot enter an enemy-held cell until it flips.
- The frontier set is a derived cache with local upkeep.

**Why.**
- Adjacency is the simplest exact connectivity rule: no flip can jump a line, and a defended
  cell blocks everything behind it (AT).
- The hold time turns pressure into AoC's pixel-by-pixel wave, with a hard speed bound.
- Without the movement gate, the first test run showed infantry (2.3 cells/day) outrunning its
  own front (1.5 cells/day) until its pressure no longer reached the line, and the wave stalled
  on day 5. HOI-style gating makes armies advance with their front.
- Two-phase decisions make the result independent of frontier iteration order. Incremental
  frontier upkeep is checked against a full rebuild in tests.

### ADR-26 · 2026-10-02 · accepted — Element combat v1: simultaneous volleys, health-weighted targeting, derived battles
**Decision.**
- Elements are saved rows. Formation strength is derived from them.
- Each hour every element fires once at a target drawn by hash (no RNG stream).
- Losses are applied after all volleys.
- Targets are weighted by health (strength × hpPerUnit).
- Battles are recomputed each tick from contacts; no battle table yet.
- War state is a saved pair set.

**Why.**
- Simultaneous fire makes results independent of element order, and total fire ∝ surviving
  strength gives Lanchester's square law. That is the AT, and it measures within 2%.
- Health weighting: by element count, a 12-gun battery would draw as much fire as a 500-man
  battalion and die 7× faster.
- Hash draws keep combat order-independent and replayable.
- A persistent battle record matters only for names, history and major battles (§5.4), so it
  waits for them.
- Bug found on the way: `Sim.load` kept derived caches (paths) from the previous state. Load now
  clears paths, the element index and nav.

### ADR-25 · 2026-10-02 · accepted — Supply v1: city-sourced flood over controlled land, 6-hourly
**Decision.**
- Supply is a reachability question: can a formation trace controlled land (or a strait lane) to a
  city its bloc owns and controls?
- The network is recomputed every 6 game hours and stored as a cell layer.
- Formation supply moves by 1/8 per hour, an exact binary step. Attrition at 0 is 2%/day plus
  terrain.
- No throughput, depots or consumption yet.

**Why.**
- AoC has no logistics. Its armies simply cannot hold land beyond the front. WarSim needs
  encirclement to matter (PLAN 1.12 AT) before combat (1.13) and fronts (1.14) exist, and a
  reachability flood is the minimum that gives pockets meaning.
- Six hours keeps cut-off detection inside a day (AT) at a quarter of the hourly cost.
- Storing the layer makes save/load between refreshes exact without replaying.
- The 1/12 rate first used left formations at 0.9999… after a refill (float accumulation), which a
  test caught; 1/8 is exact.

### ADR-24 · 2026-10-02 · accepted — Hierarchical land navigation; march duty; manoeuvre-element mobility
**Decision.**
- Routes are planned on the admin-1 province graph (crossing groups are nodes), then refined by
  cell A* inside that corridor. Short trips use cell A* alone.
- Reachability is precomputed as 4-connected land components.
- Paths are a derived cache, recomputed from (origin, target) after a load, so saves stay small
  and deterministic.
- Speed: the slowest manoeuvre element's km/h × 0.3 march duty ÷ terrain cost.

**Why.**
- Flat A* across Eurasia is fine for one order but not for an AI issuing hundreds. The province
  corridor cuts the search to the relevant strip.
- The component check turns "no land route" (the Channel, coastal specks at 20 km cells) from a
  half-second flood into an O(1) answer.
- March duty turns unit road speeds into realistic daily advances (infantry ~30 km, panzers ~115 km).
- Support guns must not slow a motorised or panzer division to walking pace; the first test run
  caught exactly that.

### ADR-23 · 2026-10-02 · accepted — Pay-on-order parallel production; manpower from 1938 population **[AoC-DEVIATION]**
**Decision.**
- Formations are bought, not grown:
  - an order pays the template's gold and manpower immediately;
  - it trains for 3× its slowest element's build days, with no cap on parallel orders;
  - it appears at the capital;
  - bankruptcy stalls training.
- Manpower comes from owned, controlled population: 0.05%/month, cap 3%, start 1%.
  Populations are 1938 GDP ÷ GDP per head, spread with the economy, so China and India have deep
  pools and small budgets.

**Why.** PROMPT asks for production and recruitment. Paying up front makes the AI's choice a
budget decision, and makes the "queued division appears after N days with cost deducted" AT
exact. Storing a ready day rather than a countdown makes N days exact whatever the tick order.
Gold and manpower as separate constraints give rich-small and poor-populous nations different
strategies.

**Deviation from AoC.** In AoC armies grow on their own with land, cores and gold (TEXT). There
is no production queue or manpower pool. Ours adds both, because tanks, ships, aircraft and nukes
(the differentiators) must be built, and starting forces must be replenished from somewhere.

### ADR-22 · 2026-10-02 · accepted — Economy calibrated to 1938 GDP; monthly tick; superlinear admin **[AoC-DEVIATION]**
**Decision.** Income comes from land the nation controls, valued from history:
- Each modern country's 1938 industrial capacity (GDP × (GDP per head / US)^0.5;
  `economy.json`, Maddison-style rounded figures) is spread over its cells by city size plus a
  small land base.
- A monthly tick pays gross income × trait multipliers × (1 + incomeBonus). Occupied land pays
  the occupier 50%.
- Upkeep scales with formation strength; admin cost grows with land held to the 1.35 power.
- Bankruptcy at −3 months of income causes 5%-per-month desertion until gold is back to 0.
- Nations start with 6 months of income.

**Why.**
- The first model (terrain × per-capita development × area + modern city sizes) ranked Australia
  2nd and Canada 4th. Land area and modern populations swamped 1938 reality.
- Calibrating country totals to 1938 GDP makes the start state plausible by construction:
  USA ≫ UK ≈ Germany > USSR > France > Japan > Italy > British India. Conquest still moves value,
  because it moves cells and cities.
- The ^0.5 industrial weighting turns raw GDP into war-making capacity. It keeps populous agrarian
  China and India below the industrial powers, and gives the PLAN AT's top five.
- Superlinear admin is the brake on runaway empires (PROMPT: no hegemon).

**Deviation from AoC.** AoC ticks the economy every 5 s of real time from land, cores and cities,
with flat costs (TEXT). Ours is monthly sim time (≈ 30 s at ×5) and GDP-calibrated, with
superlinear admin. The faster, flatter AoC loop would ignore our hourly combat economy and
make large empires snowball. Numbers are first-pass and get tuned in Phase 7 (sweep: no
hegemon, borders keep moving).

### ADR-21 · 2026-10-02 · accepted — Gregorian hourly calendar; speed ladder to Max **[AoC-DEVIATION]**
**Decision.**
- 1 tick = 1 hour of the real (proleptic Gregorian) calendar from the scenario start, with leap
  years: 1940 has 8784 ticks. Integer day arithmetic is shared by the sim and the UI.
- Speed levels: ×1…×8 = 1, 3, 6, 12, 24, 48, 96, 256 sim-hours per second, plus Max (as fast as
  the machine allows, in 12 ms slices).
  - The default is ×5 (1 day/s).
  - Level and pause persist in localStorage; `?paused=1` forces a paused start.
  - Keys: Space = pause, `,` / `.` = slower/faster (+/− already zoom the camera).

**Deviation from AoC.** AoC's 1× is about 1 month per 0.5 s (≈ 1,440 h/s; TEXT), and it tops
out at 5×. Our hourly tick drives battles, element combat and semantic zoom (ADR-3, ADR-5), so
the fixed levels are slower and finer. AoC's pace is reachable at Max on the 1938 world once the
sim meets its tick budget (SPEC §8; checked in Phase 7).

**Why.** Real dates read naturally (1 September 1939) and leap years cost nothing with integer
day numbers. A day per second at the default lets the tactical zoom show battles moving.

### ADR-20 · 2026-10-02 · accepted — 1938 land OOB: one formation ≈ one division, strengths in documented ranges
**Decision.**
- A formation is one division or brigade of a data template. Strength is the sum of its elements
  (SPEC §3.6), and the model counts *divisional* manpower; rear services and depots are abstracted
  into economy and supply.
- The 1938 OOB (`data/scenarios/1938/oob.json`) places 1054 formations at their peacetime or front
  locations of January 1938:
  - Germany: 39 inf + 3 panzer + 1 light + 4 mot + 1 mountain + tank units;
  - USSR: 96 rifle + 32 cavalry + 4 tank corps + 30 tank brigades, West and Far East;
  - France: metropole + Algeria; Italy: incl. Libya and East Africa;
  - Japan: square divisions in Japan, Korea, Manchukuo and occupied China;
  - China: ~140 weak NRA divisions on the free side of the front;
  - Poland, Czechoslovakia, the US and every other living nation.
- Units may deploy on land the nation controls, or on land its puppets own and control. So the
  Kwantung Army stands in Manchukuo, Japanese divisions in occupied China, and Chinese divisions
  only on Chinese-held land.

**Documented ranges** (AT for PLAN 1.7; checked by `tests/unit/oob.test.ts`). Rounded spans around
standard histories of the peacetime and early-1938 armies, in model units:

| Nation | Formations | Divisional men | Tanks |
|---|---|---|---|
| Germany | 45–60 | 0.45–0.8 M | 1,000–3,500 |
| Soviet Union | 140–200 | 1.2–2.0 M | 8,000–20,000 |
| France | 50–80 | 0.45–0.9 M | 1,500–3,500 |
| United Kingdom | 8–16 | 60–200 k | 200–700 |
| Italy | 70–95 | 0.7–1.2 M | 500–1,800 |
| Japan | 28–40 | 0.45–0.9 M | 500–2,000 |
| United States | 10–18 | 60–200 k | 100–400 |
| China | 120–200 | 0.8–1.6 M | 0–200 |
| Poland | 35–50 | 0.3–0.5 M | 400–900 |
| Czechoslovakia | 20–40 | 0.2–0.45 M | 300–700 |

Current values: GER 50 / 563 k / 1,570; SOV 162 / 1.52 M / 10,680; FRA 57 / 528 k / 2,300;
ENG 12 / 90 k / 400; ITA 82 / 926 k / 750; JAP 33 / 604 k / 800; USA 14 / 82 k / 200;
CHI 140 / 997 k / 0; POL 44 / 419 k / 600; CZS 24 / 269 k / 600.

**Why.** PROMPT asks for historically plausible starting forces. Division-sized formations keep
~1000 units worldwide (manageable for the AI and markers) while letting elements carry the
semantic-zoom detail (ADR-3). Ranges, not single numbers, reflect real uncertainty: tank counts
depend on whether tankettes count.

### ADR-19 · 2026-10-02 · accepted — Flags as layered data → polygons → SVG and a CPU-rasterized atlas
**Decision.**
- Flags are data, not images: a `FlagSpec` of 11 layer types plus presets. Presets cover the Union
  Jack, the blue and red ensigns, the French and Portuguese colonial patterns, and Nordic crosses.
- One expander (`flagShapes`) feeds both the SVG writer and a deterministic supersampled
  rasterizer. The GPU atlas is built at load from data (Node and browser give identical bytes), so
  the flag editor (PLAN 1.6 baseline, editor UI later) edits data rather than pixels.
- All 103 designs are our own simplifications at AoC's 36×24 scale. Complex arms and scripts
  become symbols:
  - Albania's eagle and the Soviet hammer and sickle are polygons, Saudi Arabia's shahada is bars;
  - Tibet's snow lions are omitted; Mongolia's soyombo is a stylised column.
- Germany uses the 1933–35 black-white-red tricolour (ADR-10).

**Why.** PROMPT asks for a flag editor with presets and our own art. A layered spec gives presets,
random flags and editing for free, renders crisply at any size, and needs no image assets or
licences. The supersampled CPU rasterizer keeps the atlas byte-identical across platforms (unlike
browser SVG rasterization) and builds in 20 ms.

### ADR-18 · 2026-10-02 · accepted — 1938 cities from Natural Earth; point labels on a Canvas2D overlay
**Decision.**
- Cities are generated from NE populated places, with 1938 names. The rename table covers 89
  places, e.g. Stalingrad, Königsberg, Danzig, Breslau, Lwów, Wilno, Peiping, Hsinking, Mukden,
  Batavia, Bombay, Saigon, Léopoldville, Keijō.
- Places founded or made capitals after 1938 are excluded (Brasília, Islamabad, Abuja,
  Naypyidaw, Shenzhen …).
- NE scalerank is relative within each country (most German cities rank 7–8, the same as small
  towns elsewhere). So the cut-off is scalerank ≤ 8, and size takes the larger of the rank and
  modern-population tiers. A greedy 2.5-cell (~50 km) spacing thins the list to 5,774 cities.
  Cities that mattered more in 1938 than today are force-included: Breslau, Stettin, Trieste,
  Memel, Fiume, Czernowitz, Grodno, Pinsk, Viipuri.
- Every living nation's capital is bound to the nearest NE place within 40 km under the nation's
  capital name. Yan'an has no NE place, so it is created at the given coordinates.
- City names render as point labels on a Canvas2D overlay, not as MSDF glyphs:
  - any script renders crisply with system fonts;
  - the visible count is small after culling, so the cost is well under 1 ms;
  - MSDF stays the plan for curved nation names (PLAN 1.29).

**Why.** PROMPT asks for named cities and capitals readable when zoomed in. AoC shows names when
zoomed in (TEXT). Modern populations misjudge 1938 importance, and the forced includes and size
tiers correct the worst cases.

**Consequences.**
- Population and industry per city are not 1938 figures; the economy (PLAN 1.9) derives
  them from size and province.
- Modern spellings remain where no 1938 exonym is in the table (e.g. Katowice rather than
  Kattowitz, which is correct for Polish 1938 anyway).

### ADR-17 · 2026-10-02 · accepted — 1938 nations: puppets for dominions and colonial blocs, one alliance each
**Decision.**
- 102 living nations + Ethiopia (dead; cores on its 1935 territory, revivable).
- 40 are puppets with autonomy, set by real 1938 status:
  - dominions 85–90: Canada, Australia, New Zealand, South Africa, Ireland; Iceland under Denmark;
  - protectorates and treaty states 50–70: Egypt, Transjordan, Oman, Sarawak, Albania under Italy,
    Southern Rhodesia, the Levant mandates, the Philippines Commonwealth, Xinjiang under the USSR;
  - Japanese puppet states 20: Manchukuo, Mengjiang;
  - crown colonies and colonial federations 20–40.
- Gold Coast, Ceylon and Sarawak were split out of direct UK ownership to reach ≥ 100 nations
  with real 1938 polities. They were distinct administrations.
- Alliances (AoC allows one per nation):
  - Anti-Comintern Pact (GER, ITA, JAP);
  - Anglo-French Entente (not a formal alliance until 1939, but Locarno and staff talks made it the
    de facto bloc);
  - Little, Balkan and Baltic Ententes;
  - Comintern (SOV + Mongolia, Tuva);
  - Second United Front (CHI + CCP).
- Romania and Yugoslavia also belonged to the Balkan Entente. They stay in the Little Entente, and
  the Balkan Entente keeps Turkey and Greece.
- Guarantees model the French treaty system (CZS, POL, BEL), the Soviet–Czech pact, Anglo–Portugal,
  Anglo–Iraq and Soviet aid to China.
- Wars in progress: the Spanish Civil War and the Second Sino-Japanese War (with Manchukuo and
  Mengjiang).
- Aggression, traits and income bonus are first-pass values, tuned in Phase 7. Colours are
  historical where conventional (German grey, Soviet dark red, British pink-red, French blue,
  Italian green). Seven conflicting neighbour pairs were recoloured to meet ΔE > 15.

### ADR-16 · 2026-10-02 · accepted — 1938 start state: 1 January 1938, colonies split by role, Spain divided
**Decision.**
- The scenario starts on **1 January 1938**: after Italy's conquest of Ethiopia and the fall of
  Nanjing, before the Anschluss, Munich, the First Vienna Award, the Memel ultimatum and the Hatay
  State.
- Ownership data (`data/scenarios/1938/ownership.json`, our own work) maps NE admin-0 → owner, with
  admin-1 overrides and 25 polygon regions for borders that cut modern provinces:
  - the 1937 German–Polish line, East Prussia, Danzig, Riga-line Poland;
  - Finnish Karelia, Salla and Petsamo; Petseri, Narva-east and Abrene;
  - Budjak and Transnistria; Rapallo Italy and the Dodecanese;
  - Spanish Morocco, Ifni and Cape Juby; Manchukuo/Jehol, Kwantung, Mengjiang, Shaan-Gan-Ning,
    Karafuto and the Kurils.
- **Spain** is two nations at war:
  - The *Spanish Republic* holds Catalonia, Valencia, Murcia, Madrid, New Castile, Almería,
    Jaén and Menorca.
  - *Nationalist Spain* holds the rest plus Spanish Morocco, Ifni, Sahara and Guinea.
  - The split is at province level, so the Teruel salient and the La Serena pocket are not modelled.
- **China**: the Japanese-held North China and Yangtze delta are *occupation* (owner China,
  controller Japan), not new owners. Mengjiang and Manchukuo are separate states. So are Tibet
  and Xinjiang (de facto independent) and the Communist border region.
- **Colonies**: settler-style or legally integral territories are owned by the metropole:
  - Algeria → France; Libya and Italian East Africa → Italy, which satisfies "Ethiopia = Italy";
  - Korea, Taiwan, Karafuto and the South Seas → Japan;
  - small islands → their metropole.
  Large colonial blocs and dominions are their own nations (puppets with autonomy in PLAN 1.4):
  British India, Burma, Malaya, the Dutch East Indies, French Indochina, the French West and
  Equatorial Africa federations, Madagascar, the Belgian Congo, Angola, Mozambique, the dominions,
  Egypt, the mandates, Manchukuo, Mongolia and Tannu Tuva. This gives revolts and independence
  something to work with.
- **Simplifications.**
  - Micro-states are folded into neighbours: Andorra and Monaco → France, San Marino and Vatican →
    Italy, Liechtenstein → Switzerland.
  - Tangier is part of the Spanish zone; Lastovo and Zara are sub-cell at M.
  - Each landless island territory gets exactly one land cell (`reconcileIslands`). Force-placed
    province cells alone would inflate Malta to 68 cells.

**Why.** No permissive 1938 dataset exists (ADR-8). Start-of-year avoids mid-year transfers. The
AT anchors (Danzig, Lwów, Königsberg, Manchukuo, Ethiopia) and 76 other places are tested.

### ADR-15 · 2026-10-02 · accepted — Terrain derived from land cover + relief; crossings as data
**Decision.**
- Terrain is derived per cell offline (SPEC §3.2). Sources:
  - land-cover colour from Natural Earth I (NE1_HR_LC, public domain), matched to labelled reference
    sites sampled from the raster itself, so there are no hand-picked RGB values;
  - relief from the ETOPO standard deviation within the cell;
  - marsh from NE wetlands/deltas plus our own outlines of 10 missing major wetlands.
- The land mask now excludes natural lakes (Great Lakes, Ladoga, Victoria, Baikal …).
- Crossings are a data list of 24 real straits (`data/maps/earth/straits.json`), applied at load.

**Deviations from AoC (logged per PROMPT).**
- *Colour terrain view instead of AoC's greyscale editor code.* AoC's editor palette (VISUAL,
  trailer "Create your own"/"Paint scenarios", 2026-10-02): Basic Land, Desert/Tundra, Hills,
  Mountains, Crossing, Water in grey shades. Ours has 12 classes in natural colours. A derived world
  needs more classes (forest, grassland, marsh, ice) to drive SPEC §5 combat and §6 armour, and
  natural colours read better in a terrain mode.
- *Mountains are passable* (move ×2.5 foot / ×4 motor / ×5 tracked, defence ×1.6, armour attack
  ×0.4–0.5), while AoC mountains are impassable (TEXT). The 1938 world's decisive mountain fronts
  (Alps, Caucasus, Apennines, Burma) were fought through. Chokepoints still emerge from the cost.
- *Crossings are real narrow straits only.* AoC's painted crossings can be long bands across seas
  (VISUAL). Longer gaps are for naval transport and amphibious invasion (Phase 4), which AoC lacks.
  The straits list is editable data, so a scenario can add AoC-style lanes.

**Known limits.**
- NE lakes are modern: the Aral Sea and Lake Chad are their shrunken outlines. Reservoirs are
  excluded (mostly post-1938).
- Hand-drawn wetland outlines are coarse, so the Pripyat, Vasyugan and Hudson Bay marshes show
  rounded-box shapes. They can be refined in `tools/data/wetlands.json` without code changes.
- Paris and other large cities read as grassland/plains until PLAN 1.5 makes city cells URBAN.

### ADR-14 · 2026-10-02 · accepted — Data schemas: zod v4, strict objects, one validator for every `data/` file
**Decision.**
- Every JSON file under `data/` has a zod schema in `src/sim/data/schemas.ts`. `DATA_FILES` maps
  path patterns to schemas, and a file under an unknown path fails validation. The sim may import
  `zod` (ADR-2 allowlist).
- Objects are `strictObject`: an unknown key is an error, which catches typos such as `speed` vs `speed_kmh`.
- The cross-file checks that one schema cannot express live in `validateDataSet`:
  - unique ids;
  - references: techReq, prereqs, trait excludes (both ways), scenario map and size;
  - the tech graph is acyclic and prereqs are not later than the tech;
  - the terrain table is in cell-enum order.
- The i18n catalog check (every nameKey/descKey in `en.json`) runs in the test, because the sim may
  not import UI code.
- Errors read `<file>: <path>: <message>`, using zod's own messages.
- Map geometry is data: `data/maps/<id>/map.json` + `data/scenarios/<id>/scenario.json` drive
  `SCENARIO_GEOMETRY` (toy today, earth/1938 from PLAN 1.3). JSON imports in `src/` carry
  `with { type: 'json' }`, because Playwright loads `src/` in plain Node ESM.
- The unit `sprite` field (SPEC §3.6) is deferred to the Phase 2 unit atlas. Under strict schemas it
  must be added to schema and data together.

**Why.** Data-driven design (PROMPT) only works if bad data fails loudly and points at the field. zod
v4 gives typed inference from the same schema, and is pure and deterministic (allowed in the sim).

**Consequences.** All stats in `data/units`, `data/tech` and `data/terrain.json` are first-pass values,
original to this project. Balance is tuned in Phase 3–7 against the SPEC §5 combat model. Starting
tech per nation arrives with the nations file (PLAN 1.4).

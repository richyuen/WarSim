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

# PROGRESS (append-only)

## 2026-10-02 — PLAN 0.2: Vite + TypeScript strict + Preact
- Scaffolded `package.json` (scripts `dev`, `build` = `tsc -b && vite build`, `preview`, `typecheck`),
  `index.html` (title "WarSim", `#map` canvas + `#ui` overlay), `src/app/{main.tsx,App.tsx,style.css}`.
- Toolchain resolved to: Vite 8.3, TypeScript 7.0 (`tsc -b` works unchanged), Preact 11, @preact/signals 2.11,
  @preact/preset-vite 2.10, Node 24.21.
- tsconfig: solution-style (`tsconfig.app.json` for `src/`, `tsconfig.node.json` for `vite.config.ts`, shared
  `tsconfig.base.json`) with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, unused-locals/params checks. Verified that the flags apply: a probe file indexing
  `number[]` into `number` fails `tsc -b` with TS2322.
- Vite `base: './'` so the build runs from any static-host subpath; workers emit as ES modules.
- Verified: `npm run build` green; `vite preview` serves `index.html` with `<title>WarSim</title>` and the
  canvas; JS asset returns 200; headless Chrome `--dump-dom` shows the canvas resized by the script
  (764×485), so the bundle executes without errors.
- Gotcha: `npm run parity` does not exist yet (PLAN 0.8); PARITY.md is created in 0.7. No critic report yet.
- PROGRESS.md was created here (ahead of 0.5) because every iteration must log; 0.5 still owns
  BLOCKERS.md / DATA_SOURCES.md and the `reference/NOTES.md`-missing note.

## 2026-10-02 — PLAN 0.3: ESLint flat config + sim purity + module boundaries
- ESLint 10.11 + typescript-eslint 8.71 (recommended, non-type-checked) + `globals`; `npm run lint`, `npm test`
  (vitest 5.0.3, installed now because the AT needs it; 0.4 still owns Playwright and `npm run check`).
- TypeScript downgraded 7.0.2 → 6.0.3: TS 7 has no JS API, typescript-eslint needs `<6.1` (ADR-12).
- `tools/eslint/warsim-plugin.js`: `warsim/module-boundaries` (layer table + sim/shared package allowlist,
  lexical resolution). SPEC §2.1 table updated (app may import editor; ui/editor/app rows split).
- Sim rules: forbidden globals (Date, performance, window, self, timers, Intl, WeakRef, ...), `Math.random` +
  non-exact `Math.*`, `localeCompare`/`toLocaleString`, `for-in`, `**`, Math destructuring/computed access.
- `tests/lint-fixtures/` (ignored by `eslint .` and tsc) linted via the ESLint API at virtual `src/<layer>/` paths:
  16 must-fail + 3 must-pass cases, 20 tests green. Also checked the CLI: a real `src/sim/probe.ts` with
  `Math.random() ** 2` fails `eslint src` with exit 1 (probe deleted).
- `tsconfig.node.json` now type-checks `tools/`, `tests/unit/`, `vitest.config.ts`, `eslint.config.js` (checkJs).
- Gotcha: no-undef is off for TS files (typescript-eslint), but `no-restricted-globals` still reports implicit
  global references, so `window` in sim is caught even though the app tsconfig includes DOM libs.

## 2026-10-02 — PLAN 0.4: Playwright + `npm run check`
- `@playwright/test` 1.63 (Chromium already in the local ms-playwright cache). `playwright.config.ts` runs
  `tests/e2e` against `vite preview` of a fresh build on 127.0.0.1:4173 (tests see what ships).
- `tests/e2e/smoke.spec.ts`: title "WarSim", visible `canvas#map` with a non-trivial backing size, and zero
  page errors / console errors (catches bundle crashes, not just DOM presence).
- Scripts: `e2e` = `playwright test`; `check` = typecheck → lint → vitest → build → e2e. Parity joins `check`
  in PLAN 0.8 (the script does not exist yet). SPEC §10 documents the gate.
- `tsconfig.node.json` now covers `playwright.config.ts` + `tests/e2e` and adds the DOM lib (for
  `evaluate` callbacks); `src/sim` is type-checked by the app config, so this doesn't loosen sim purity.
- Verified: `npm run check` green (tsc, eslint, 20 vitest, build, 1 e2e).

## 2026-10-02 — PLAN 0.5: iteration docs
- Created `BLOCKERS.md` (open list empty; watch list) and `DATA_SOURCES.md` (Natural Earth + ETOPO planned,
  own-work flags/sprites/1938 split lines planned, CShapes and historical-basemaps recorded as rejected with
  reasons, shipped npm deps with licenses).
- **`reference/NOTES.md` is missing** (checked 2026-10-02: `reference/` has only `screens/` and `video/`).
  Per PROMPT.md, visual/feel claims rely on screenshots, the trailer and text sources, and are marked lower
  confidence; also noted in SPEC §1 and the BLOCKERS watch list.

## 2026-10-02 — PLAN 0.6: trailer frames + VISUAL observations
- Only clip: `reference/video/steam-trailer-2024.mp4` (42.0 s, 1920×1080). `fps=0.5` gives 21 frames
  (`0001–0021.png`), short of the AT's 30, because the trailer is short and fast-cut. Added scene-change frames
  (`select='gt(scene,0.25)'` → `scene_001–018.png`) so each distinct shot is captured: 39 PNGs total. Contact
  sheets `reference/sheet_fixed.png`, `reference/sheet_scene.png` and two full-res crops were viewed.
  All of this is under ignored `reference/` and is never committed.
- Observations (VISUAL, 2026-10-02, trailer 2024; confidence medium, no NOTES.md):
  - **Map is an unapologetic pixel raster.** Zoomed into Central Europe, each tile is ~12 screen px and borders
    are stair-stepped. Nation borders are drawn as a 1–2 tile dark (near-black) outline *inside* the owner's
    edge; coasts have no outline. Zoom only enlarges pixels: this is exactly the "blocky" failure mode our
    ADR-1 render layer must beat.
  - **Occupation**: occupied land keeps the occupier's colour but with a darker/desaturated variant blended
    in (Netherlands frame: dark-red ring of occupied cells along the front; Denmark: purple occupier cells in a
    red nation). A white/black checker strip marks an active front line (Germany–Netherlands).
  - **Labels at close zoom**: country name in a dark sans font, under it a red capital dot + gold coin icon +
    number (army/strength value, e.g. "Germany 786", "Poland 526"), on a dark pill. Small coloured dots
    (green/white/red) are cities. A translucent dark circle with red dots = battle; a yellow glow = selected or
    recently captured capital.
  - **Battle marker**: a large pixel-art sword icon on the frontline (Italy frame); war banners at the bottom.
  - **Terrain** shows as grey shades (mountains/hills) where land is unowned; editor palette: Basic Land,
    Desert/Tundra, Hills, Mountains, Crossing, Water; tools Brush/Bucket with "use terrain mask".
  - **Crossings**: wide pale-grey/blue translucent bands across seas link continents (world shots).
  - **UI**: dark-brown framed panels with gold trim; bottom bar (Display Options, Text Popups, Pause, God Mode,
    Statistics, Speed ×N, date "Month, Year N", Nations count, Menu); left nation panel (flag, war/peace/
    alliance buttons, Statistics icons, Diplomacy row, "Disable Nation AI"); right God Mode panel (Spawn Nations,
    Edit Territory brush size, Spawn Cities, Edit Terrain, World AI Settings); a right-side ranked bar chart
    (nation colour bars with land counts); bottom-left event log with coloured nation chips ("X was conquered by
    Y", "X formed an alliance", "joined ... Commonwealth").
  - **Scenarios**: main menu with scenario list + preview ("World Map 750×400, Nations 167"), also US states,
    China, fantasy maps; Workshop sharing. Statistics: per-nation ranked bars.
  - Takeaways for us: (1) match the readable dark border outline and occupation tint, but render it smoothly
    (SPEC §8 T0); (2) per-nation strength number next to the name at operational zoom; (3) the bar-chart
    statistics panel and colour-chipped event log are core to the "feel"; (4) crossings must be visible bands.

## 2026-10-02 — PLAN 0.7: AoC text research + docs/PARITY.md
- A research subagent fetched the itch page, the devlog index (89 posts, no pagination, all read), the Steam store
  page (age gate passed), the appdetails API and the Steam news feed (98 items; patch notes mirror the devlog).
  Paraphrased notes (79 KB, with a sources table, feature catalogue, version history and limitations) are in
  `reference/text/AOC_TEXT_NOTES.md`, which is private and ignored.
- Key TEXT facts (2026-10-02):
  - AoC is AI-only ("not a strategy game"). The map is a per-pixel tile grid.
  - Economy ticks every 5 s at 1×; the clock runs 1 month per 0.5 s; speed goes up to 5×.
  - Income bonus is −100..100. "Broke" means < 20 gold.
  - Capital capture takes 25% of the target's gold (50% on a kill); capitals are razed 33% of the time.
  - Combat efficiency (CE) modes: Random, Progressive, Static, Dynamic.
  - Major Battles (v4.3) and per-city revolt progress (v4.0).
  - Unity, Union and Loyalty (v4.2); Vassal, Puppet and Satellite autonomy tiers (v4.4); rightful territory and
    integration (v4.4).
  - The nuke is a God tool only: CE −2 and −10% gold. There is no naval, air or real unit combat; unit visuals
    are cosmetic.
  - No revival limit or cooldown is stated, and no per-nation aggression trait.
- `docs/PARITY.md`:
  - Table 1 has 80 scored rows. Each has a dated TEXT, VISUAL or TEXT+VISUAL tag and a planned PLAN reference,
    and all are `not started`.
  - Table 2 has 11 additions (the 5 differentiators, element combat, supply, production/tech, the deterministic
    worker sim, the real-geography smooth map, and headless tooling).
  - I checked every PROMPT baseline bullet against the rows; each maps to at least one row. Where PROMPT goes
    beyond AoC (traits, take control, finite revival, military-size stats, revolts map mode), the notes say so.
- The header score was generated by the new tool (`--write`), not typed by hand.

## 2026-10-02 — PLAN 0.8: `npm run parity`
- `tools/parity/parity.ts` (pure, testable) + `tools/parity/cli.ts`. Score = (verified + 0.5·partial)/rows,
  1 decimal. The checker validates:
  - the columns of both tables and consecutive `#` numbering;
  - each status is one of verified / partial / not started;
  - every Table 1 AoC behaviour has a dated TEXT/VISUAL/TEXT+VISUAL tag;
  - every verified row has at least one backticked evidence path, and each path exists;
  - the header score line matches the computed one exactly (counts included, not just the percentage).
- Escaped pipes (`\|`) inside cells are supported. `--write` regenerates the header line, which is how the
  score is set (never by hand).
- 11 vitest fixture tests cover: a valid file passes; header % or counts mismatch fails; a missing score line
  fails; a missing evidence path or no evidence on a verified row fails; out-of-order numbers, unknown status,
  missing source tag and wrong columns fail; `writeScore` repairs a file.
- Tools now run TypeScript through `tsx` (4.23); later tools also need it to import the extensionless sim
  sources in Node. `check` = typecheck → lint → vitest → build → e2e → parity. SPEC §10 updated.
- Verified: the CLI fails on the freshly generated PARITY.md (header 0/0 vs 80 rows), and passes after `--write`.

## 2026-10-02 — PLAN 0.9: `sim/core/dmath`
- `src/sim/core/dmath.ts` provides sin, cos, tan, atan, atan2, asin, acos, exp, log, log2, log10, pow, ldexp,
  sqrt and hypot.
  - Ports of the fdlibm algorithms: Cody–Waite π/2 reduction (33+33-bit split plus tail), the k_sin/k_cos
    minimax kernels, the s_atan table plus polynomial, the e_exp and e_log rational kernels, and integer-power
    squaring.
  - Bits are read and written through a little-endian DataView, and only exact IEEE ops are used. JS never fuses
    multiply-add, so the results are engine-independent.
- Accuracy (1e5 samples per case, `tests/unit/dmath.test.ts`): max abs error < 1e-9 for sin/cos (|x| ≤ 1e6),
  atan, atan2 (all quadrants), asin, acos, log, log2 and log10; relative error < 1e-9 for tan, exp (±700) and pow.
  Measured: ≤ 1 ulp. V8's own Math uses fdlibm ports, so exp, log and atan2 match it bit-for-bit; sin differs from
  V8 in about 1% of inputs by 1 ulp.
- ECMAScript special cases are covered: signed zeros in atan2, infinities, NaN, subnormal log/exp, negative bases
  in pow.
- Golden values: `tools/dmath/gen-golden.ts` wrote 138 hex bit patterns to `tests/unit/dmath-golden.json`.
  - `tests/unit/dmath.test.ts` (Node) and `tests/e2e/dmath.spec.ts` (Chromium) must reproduce them exactly. The
    e2e test transpiles `dmath.ts` with the TS API and imports it into the page from a data: URL.
  - Mutation check: flipping one golden value made both runners fail.
- `tsconfig.node.json` now includes `src/sim` and `src/shared`, so Node-side tools can type-check their imports
  of sim code.

## 2026-10-02 — PLAN 0.10: `sim/core/rng` (PCG32 + streams) and `sim/core/hash` (xxHash32)
- PCG32 XSH-RR with 64-bit state held in u32 halves. The 64×64 multiply uses 16-bit limbs in f64 (exact) plus
  `Math.imul` for the cross terms.
  - Helpers: `nextU32`, `nextFloat` (53 bits), unbiased `nextInt` (rejection), `range`, `chance`, `nextNormal`
    (Box–Muller via dmath), and save/load of state.
  - Verified against the pcg32-demo vector (42/54 → a15c02b7 7b47f409 …) and an independent BigInt
    transcription of pcg32_random_r over 4 seeds × 2000 draws, including all-ones 64-bit seeds.
- `RngStreams`: named subsystem streams (`STREAM_NAMES`). Each is seeded only from `xxhash32(name, worldSeed ^ k)`.
  Tests: adding a new stream leaves existing sequences unchanged; draws on one stream don't affect another;
  save/load round trip.
- xxHash32 over bytes and typed-array views, `hashString`, and an allocation-free `hash32(seed, a, b, c[, d])`
  for order-independent draws. Known vectors pass: "" → 02cc5d05, "a", "abc", "Nobody inspects…" (39 bytes,
  stripe path). `hash32` is tested equal to xxHash32 of the LE words.
  - Gotcha found by that test: 4 words = 16 bytes takes the stripe path, not the short path. Fixed.
  - Avalanche: ~16 of 32 output bits flip per input-bit change.

## 2026-10-02 — PLAN 0.11: SoA tables, sections, state hash
- `sim/core/sections.ts`: a named typed-array `Section` (8 dtypes) and the binary codec.
  - Layout: 'WSEC' magic, version, then per section: name, dtype, length, data padded to 8 bytes.
  - The codec rejects bad magic, versions, dtypes, truncation and trailing bytes.
  - `hashSections` chains name, dtype, length and xxHash32(data) per section, so it is order- and name-sensitive.
- `sim/core/table.ts`: `Table<Schema>` is a growable SoA.
  - Ids start at 1 (0 = none). The free list is LIFO and is serialized, so allocation after a load matches an
    uninterrupted run.
  - Rows are zeroed on create/remove (canonical bytes). `forEach` iterates in ascending id order.
  - Serialization covers rows [0, highWater): meta, alive, free, plus one section per column (sorted names).
- `sim/core/state.ts`: `Stateful` interface, `collectSections`, `stateHash`, `saveBytes`, `loadBytes`.
- Tests (8):
  - id allocation and reuse order;
  - zeroing; growth;
  - serialize→bytes→deserialize→serialize gives identical bytes;
  - load-then-continue equals an uninterrupted run over 3000 churn ops (free list included);
  - flipping one bit in each of 2000+ bytes, across every column, alive map and free list, changes the hash;
  - name/order/dtype sensitivity;
  - codec round trip of all dtypes incl. -0 and NaN.

## 2026-10-02 — PLAN 0.12: toy world + tick loop in Node and in the worker
- `sim/world.ts`: `World` holds the seed, tick, `RngStreams`, `CellLayers` (owner, controller, terrain), the
  `nations` and `formations` tables, the command log and pending commands.
  - `parts()` fixes the save/hash layout: core (meta, rng, JSON log + pending), cells, nations, formations.
  - Pending commands are serialized, so a save taken between enqueue and the next tick loses nothing.
- `sim/tick.ts`: `step` applies pending commands in seq order (stamped with the tick into the log), runs the
  systems in order, then increments the tick.
- `sim/sim.ts`: the `Sim` facade (init/step/command/hash/save/load), shared by the worker, Node and tests.
- `Command` and the protocol types live in `src/shared` (commands.ts, protocol.ts), so app/render can use them
  without importing sim.
- `sim/toy.ts` (256×128):
  - lakes from the `scenario` stream; two nations split the map;
  - 60 formations each random-walk via dmath cos/sin and the `toy` stream, bounce off water, capture crossed
    cells and lose strength on captures;
  - daily: dead formations disband and are replaced (free-list churn), and cell counts update.
- `src/worker/entry.ts` hosts `Sim`. `src/app/simClient.ts` provides promise request/reply with transferable
  saves. `window.__warsim.sim` is the test API (`src/app/testApi.ts`).
- Tests:
  - `tests/unit/determinism.test.ts`: the toy world evolves (≥ 200 cells flipped, formations die and respawn).
    I1: same seed + commands → same hash/bytes; a different seed or missing command → a different hash.
    I2: save at ticks 1/99/100/101/777, load into a different-seed Sim and continue = uninterrupted bytes, plus
    a save with a queued command. I5: save → load → save bytes identical.
  - `tests/e2e/worker.spec.ts`, I3: the worker run in Chromium (init, 300 ticks, command, 780 ticks) matches
    Node's hash at both points and its save bytes exactly; worker bytes loaded in Node continue identically.
    Worker errors reject the promise.
- Gotchas:
  - LIFO id reuse keeps `highWater` flat even with churn, so test churn with spies, not highWater.
  - TS 6 typed arrays are generic: fields that go into sections must be typed `Uint16Array<ArrayBuffer>`.

## 2026-10-02 — PLAN 0.13: worker protocol (subscribe, rAF-acked snapshots, pool, coalescing, events)
- Protocol (`src/shared/protocol.ts`):
  - New messages: speed (ticks/s or 'max'), pause, subscribe (bbox, z, tier, wantsElements), ack (seq + returned
    buffers), and snapshot. A snapshot carries header, dirty tiles, nations, formations with prev positions, events
    and its buffer list.
  - `src/shared/events.ts` holds the event kinds and the f64 record layout.
- Sim side: `World.out` (`TickOutputs`) holds the dirty-tile bitmap and the event sink. These are derived: not
  serialized, not hashed, and all tiles are marked dirty on load. `World.setController` marks tiles; the toy
  emits spawn/destroy events and command application emits a global event.
  - `Sim.step(n, afterTick)` lets the host drain outputs each tick. Without a hook, events are discarded so
    headless runs stay bounded.
- `SimServer` (`src/worker/server.ts`):
  - scheduler with owed-tick accumulation at fixed speeds and 12 ms wall-clock slices at max;
  - a send happens only when no snapshot is in flight and something is due (tick moved, events, forced);
  - ack seq is validated; prevX/prevY/prevAlive are captured before every tick;
  - `BufferPool` (`src/worker/pool.ts`) recycles buffers by power-of-two size class.
- `src/worker/entry.ts` uses a timer loop. `SimClient` acks on rAF and adds `onSnapshotReceived`, `setSpeed`,
  `setPaused` and `subscribe`.
- Tests (`tests/unit/server.test.ts`, 7):
  - I4: 4000 random ops (subscribe churn, acks, pumps, commands) end with a hash and command log identical to a
    plain Sim replaying the same commands at the same ticks.
  - Flow control: no snapshot without an ack, over 10k frames.
  - Pool: pooled + outstanding = allocated; at most 4 allocations after warm-up. Mutation check: a no-op
    `release` makes it fail with 117k extra allocations.
  - Coalescing: 1000 unacked ticks give exactly one snapshot afterwards; a main-side tile mirror equals the sim
    layers exactly; event seqs are contiguous.
  - Wrap-aware bbox event filtering, with global events always delivered.
  - prevX is exactly one tick behind; error replies for unknown state and stale acks; bounded max-speed slices.
- e2e (`tests/e2e/snapshots.spec.ts`): in Chromium, subscription churn while stepping gives Node's hash at tick
  700. At max speed for 1.5 s, snapshots arrive with seq strictly +1 and monotonic ticks, and the final hash
  equals Node's at the same tick.
- Gotcha: a payload can legitimately outgrow its size class, so the leak check asserts accounting plus flat
  allocation rather than "zero new buffers".

## 2026-10-02 — PLAN 0.14: render benchmark A (raw WebGL2 + twgl id-map renderer)
- `src/render/map/MapRenderer.ts` + `mapShader.ts`:
  - Owner and controller grids are R16UI textures; the palette is a 256×256 RGBA8 texture.
  - One full-screen-triangle pass. Dirty 64×64 tiles upload with `texSubImage2D` (UNPACK_ROW_LENGTH).
  - Camera precision: the integer centre cell and an f32 fraction are uniforms, and noise coordinates are
    periodic. This is the SPEC §8 camera-relative scheme; `src/render/camera.ts` has the split.
- Smooth borders:
  - Each distinct controller id in the 4×4 neighbourhood accumulates cubic B-spline weight, and the max wins.
    Contours are C2-smooth curves at any zoom.
  - A ≤ 0.32-cell value-noise domain warp keeps the drawn owner within half a cell of the sim.
  - Border width is constant in CSS px (d / fwidth(d)) and fades out below ~1.5 px per cell. Coasts are softer.
  - Occupation is the same weighted indicator (controller ≠ owner) with screen-space diagonal hatching.
- First version used a 3×3 quadratic B-spline and nearest-cell occupation. The close-zoom screenshot showed
  hatched squares at cell corners along borders, from a mismatch between the smooth winner and the
  nearest-cell owner. Fixed by smoothing occupation with the same weights; I moved to cubic for smoother
  mid-zoom borders at the same time.
- `bench.html?b=A` + `src/app/bench/` (synthetic world: fBm continents, 150 nations from a noise-warped
  jittered Voronoi, occupation strips). `npm run bench` (`tools/bench/run.ts`) builds, serves, launches
  Chromium with `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist` (headless gets the real GPU this way;
  without the flags it is SwiftShader), and writes `docs/bench/A-webgl2-map.json` + 3 screenshots.
- Gotcha: `gl.finish()` does not wait for the GPU under ANGLE (it measured 0.003 ms per full-screen draw).
  GPU time now uses EXT_disjoint_timer_query_webgl2 (`src/render/gl/gpuTimer.ts`).
- Results (RTX 4070 Ti, 1920×1080, 2048×1024 map, 150 nations):
  - 0.43–0.46 ms GPU per full map draw (0.22 ms with the 3×3 variant).
  - Uncapped rAF over 3 s: about 5000 fps, and about 1160 fps while uploading 32 dirty tiles per frame.
  - Grid upload 2 ms; synthetic generation 430 ms (bench only).
  - Budget translation: a mid-range laptop iGPU is ~15–20× slower, so ≈ 9 ms, which is within the 16.7 ms
    T0 frame. A dev-GPU guard of ≤ 1 ms per map draw at 1080p is recorded for ADR-4.
- Screenshots viewed (`docs/bench/A-webgl2-map-z0-world.png`, `-z1-region.png` at 6 px/cell, `-z2-close.png`
  at 48 px/cell):
  - No cell stairs at any zoom. At 48 px/cell the borders are smooth curves (data steps show as gentle waves).
  - Occupation hatching has smooth edges; x-wrap shows land past the map edges.
- `tests/e2e/bench-pages.spec.ts` keeps the bench page compiling and drawing in the normal gate (SwiftShader).

## 2026-10-02 — PLAN 0.15: render benchmark B (instanced proxies) vs PixiJS v8; ADR-4 finalised
- `src/render/units/ProxyRenderer.ts`:
  - One instanced TRIANGLE_STRIP draw per atlas.
  - Per-instance prev/cur positions (f32 offsets from an integer origin), facing, size, frame, alpha, plus
    a u8 tint.
  - The vertex shader interpolates prev→cur with a uniform `uT` and rotates the quad, with a minimum on-screen
    size.
- `src/render/units/atlas.ts`: procedural 4-frame atlas (infantry, tank, ship, aircraft) of white silhouettes
  with dark outlines, mipmapped and tinted per nation.
- Shared scene: `src/app/bench/proxyScene.ts` (N proxies walking in the tactical view, 10 Hz ticks).
  - B (`benchB.ts`) draws it with our map + proxies.
  - BP (`benchBP.ts`) draws it with Pixi 8.22 ParticleContainer + CPU interpolation over a pre-rendered map
    texture.
- Frame helpers were factored into `benchUtil.ts`; bench A now uses them too.
- Results (RTX 4070 Ti, 1080p):
  - Raw, 30k proxies: 0.059 ms GPU for units, 0.47 ms per full frame, ~0 ms per-frame CPU, 1.2 ms per tick
    to refill and upload the instance buffer.
  - Pixi, 30k: ~0.27 ms GPU for units, 0.4/1.4 ms CPU per frame (p50/p95).
  - Decision: raw WebGL2 + twgl. ADR-4 is accepted, with the table and the dev-GPU budget guards.
- Screenshots viewed: `docs/bench/B-webgl2-proxies-tactical.png` (30k proxies over the map),
  `-close.png` (rotated, tinted, outlined sprites, smooth borders beneath) and `BP-pixi-proxies-tactical.png`
  (same scene). Visually equivalent; B's mipmapped atlas looks cleaner at small sizes.
- e2e guards for the B and BP pages run in the gate.
- Follow-up recorded in ADR-4: move the instance-buffer fill into the worker snapshot builder in Phase 2.

## 2026-10-02 — PLAN 0.16: camera-relative precision at 1 m/px, lon 179°
- `bench.html?b=P` (`src/app/bench/precision.ts`): the M map (19.57 km per cell) viewed at 1 m/px (19 568 px
  per cell), with a 40 px red tank sprite at lon 179° (x = 2042.31 cells), drawn by the production
  `ProxyRenderer` over the `MapRenderer`.
  - `window.__precision.frame(cx, cy)` renders one frame and returns the f64-expected and measured screen
    positions. The measurement is a coverage-weighted centroid from `readPixels`.
  - Two modes: 'relative' (production: integer origin + f32 offsets) and 'naive' (origin 0, absolute f32).
- `tests/e2e/precision.spec.ts`: 60-frame pan in 0.37 m × 0.21 m steps. Stability = max deviation of
  (actual − expected) from its mean. Measured: **camera-relative 0.161 px** (≤ 0.5 required) vs naive
  absolute-f32 1.25 px. The test also requires naive > 4× relative, proving the probe detects f32 loss
  (ulp at x ≈ 2042 is 2.4 m).
  - Screenshots `docs/evidence/0.16/precision-relative-{0,40}.png` (viewed: sprite 150 px right of centre as
    expected).
- Gotcha: the first probe (thresholded centroid) had ±0.5 px quantisation noise of its own. The weighted
  centroid then counted the orange map as "red" (0.68 px). Thresholding redness above every map colour fixed
  it.

## 2026-10-02 — PLAN 0.17: camera controller + looping-x wrap; the game page now shows the live map
- `src/render/camera.ts`: pure camera math, unit-tested in `tests/unit/camera.test.ts`.
  - `zoomLevel`, i.e. z = log2(px per km), and `scaleForZoom`.
  - min/max scale: the map height fits at the low end; 1 m/px at the high end.
  - `normalize`: wraps x on looping maps, clamps y and zoom, clamps x on non-looping maps.
  - `zoomAt` keeps the point under the cursor fixed; `panBy`; screen/world transforms.
  - `wrapOffsets`: the map copies that intersect the view.
- `src/app/input/CameraController.ts`:
  - mouse drag (left/middle) with pointer capture, and wheel zoom anchored at the cursor;
  - continuous zoom via exponential easing toward a target scale;
  - held-key pan (arrows/WASD, 900 px/s) and zoom (E/+/numpad+, Q/−/numpad−), ignored while typing;
  - touch: one-finger pan, two-finger pinch about the midpoint; `touch-action: none`.
- `ProxyRenderer.draw` takes wrap offsets and draws extra copies, so sprites near the seam show on both
  sides. The map shader already wraps cells.
- `src/app/MapView.ts`: the real game view.
  - Snapshots map to dirty-tile texture uploads, nation colours to the palette and formations to instanced
    markers; markers unwrap across the seam so interpolation never sweeps the map.
  - The rAF loop runs camera update → draw with t = (now − arrival)/tickMs.
- `main.tsx` boots the toy world (`?seed=`, `?paused=1`, `?view=0`) at 12 ticks/s. `window.__warsim` now
  has `view` (camera, controller, frames, draw).
- Worker `init` now always starts paused, so an auto-running app can't interfere with a test's init.
- `tests/e2e/camera.spec.ts` (5 tests):
  - keyboard pan and zoom;
  - a drag moves exactly the pointer delta;
  - wheel ×1.25³ with ≥ 1 intermediate frame (continuity), and the world point under the cursor stays fixed
    (1e-4 cells);
  - synthetic touch pinch ×2 about the midpoint, then a one-finger pan;
  - a drag from cx 250 past the dateline gives cx 14 (wrapped). The border pixel profile at the seam matches
    an ordinary border (same two fills, dark-line width within 2 px).
- Evidence: `docs/evidence/0.17/dateline-seam.png`. Viewed: a lake crossing the seam continues smoothly.
  SwiftShader showed a few 1-px dark specks near borders; the same view on the real GPU (close-up comparison
  of the seam vs the x=128 border) is clean and identical, so this is a SwiftShader derivative artifact.
- Test-suite hygiene: sim-only e2e tests open `/?paused=1&view=0` (no rendering, no auto-run). The worker
  error test now uses a corrupt load. The snapshot-count floor was lowered to 5, because rAF slows under
  parallel SwiftShader load.

## 2026-10-02 — PLAN 0.18: data pipeline v0 (`npm run data`)
- Sources pinned in `tools/data/sources.json` (URL + sha256 written on first download, verified afterwards)
  and cached in `.cache/data/`:
  - Natural Earth 10m land, admin-0, admin-1, populated places and marine polys (GeoJSON, nvkelso tag v5.1.2);
  - ETOPO 2022 60″ surface GeoTIFF (466 MB; the old THREDDS GeoTIFF URL is a 404, the `/mgg/global/relief/`
    path works).
- `src/sim/data/projection.ts` (dmath, deterministic):
  - Miller cropped at 80°N…64.165°S, so the projection is exactly 2:1 (ADR-7 refined);
  - `project`/`unproject`, `kmPerCell`, and per-row kx = cos φ, ky = cos 0.8φ.
- `src/sim/data/rasterize.ts`: deterministic even-odd scanline fill over cell centres with an active edge
  list; LSB-first bitset helpers. Shared by the tools and (next) the worker.
- Products in `public/data/earth/` (committed, 3.3 MB total; ADR-13):
  - `landmask-16384x8192.bits.gz`: 6837 polygons, 0.38 MB;
  - elevation 2048/1024/512 `.i16d.gz` (2.18 / 0.58 / 0.16 MB), box-averaged from ETOPO into Miller cells.
    Codec `src/shared/elevation.ts`: row-delta + byte planes + gzip, ocean quantised to 10 m. Raw int16 was
    13.8 MB at 4096; the 4096 level is now a local derived product;
  - `manifest.json`: projection, assets (dims, encoding, bytes, sha256), sources (url, license, sha256).
  - gzip OS byte normalised for cross-platform byte identity.
- Idempotency verified: a second `npm run data` → "data: no changes"; `npm run data -- --check` exits 0. A full
  run takes ~2 min, mostly reading ETOPO.
- Visual check (scratch renders, viewed): the land mask is a clean Miller world; elevation shows the Andes,
  Himalaya/Tibet, Alps, Scandinavia and ocean ridges/trenches, aligned with the mask.
- `tests/unit/data-manifest.test.ts`:
  - sha256 and sizes of every asset; sources pinned and public domain;
  - land fraction (0.3–0.45, Miller inflates high latitudes);
  - 8 known land points and 6 known sea points;
  - Tibet > 4000 m, Atlantic < −3000 m, Mariana < −6000 m, Alps > 1000 m;
  - land mask vs elevation sign agreement > 93%;
  - each pyramid level equals `halveElevation` of the level above;
  - codec round trip.
  `tests/unit/rasterize.test.ts` covers the rasterizer (squares, holes, orientation, clipping, triangle area)
  and the projection (2:1 crop, round trip, row scales).

## 2026-10-02 — PLAN 0.19: load-time admin-1 → province raster in the worker
- New assets from `npm run data`:
  - `admin1-geometry.wsz`: 4596 NE admin-1 provinces, 1.29M exact vertices, Miller-projected and
    quantised to 2⁻²⁰, delta varints (`src/shared/admin1.ts` codec), 3.1 MB;
  - `admin1-meta.json.wsz`: adm1 code, name, adm0, type, label point, area.
  - No simplification: independent simplification of neighbours would open gaps or overlaps along shared
    borders (ADR-13).
- Shipped files are renamed `.gz` → `.wsz`. `vite preview` (sirv) serves `.gz` with
  `Content-Encoding: gzip`, so the browser fetched already-decompressed bytes and the sha256 check failed.
  Found by the first bench run.
- `src/sim/data/provinces.ts` `buildProvinceRaster`:
  - scanline-fills every province (exact float ops);
  - force-places sub-cell provinces, by decreasing area, near the label point. Order: free water at the
    label cell; then a same-country donor keeping ≥ 1 cell; then free water (island growth); then any
    donor.
  - Island-growth fix: the first version left 64 provinces unplaced at M. These were multi-parish
    micro-islands (Bermuda, Dominica, Anguilla), where every neighbour was a locked one-cell parish in open
    sea.
- `src/worker/assets.ts` `AssetStore`: fetch → size + sha256 check (WebCrypto) → DecompressionStream.
  New protocol request `buildProvinces {assetBase, w, h, withIds}` → reply `provinces` with timings, counts
  and xxHash of the raster. `SimClient.buildProvinces`.
- Results (Chromium worker, real GPU machine): M raster 67–69 ms + decode 43–56 ms (total with fetch
  133–207 ms) vs the 1.5 s budget. All 4596/4596 provinces are present at S and M (forced 1202 / 724, missing
  0); NE admin-1 has no water features. The Chromium raster hash equals Node's at both sizes
  (`tests/e2e/provinces.spec.ts`).
- `tests/unit/provinces.test.ts`: codec round trip; every province present at S and M (cell sums = W·H);
  known places (Berlin, Polish Warsaw, Kaliningrad, Ukrainian Lviv, French Paris, New York at Albany,
  Japanese Tokyo, Atlantic = none); deterministic rebuild.
- Visual check: `bench.html?b=R` draws the worker-built raster with the production MapRenderer (each
  province coloured). `npm run bench -- R` → `docs/bench/R-provinces-M-{world,europe,britain}.png`, viewed.
  Provinces are clean with smooth borders. Dense micro-province clusters (London's 33 boroughs, Slovenian
  and Macedonian municipalities, Malta) become small grids of 1-cell provinces at 19.6 km cells. This is
  acceptable because PLAN 1.3 merges provinces into 1938 nations; 1.3 should also consider grouping
  sub-cell provinces into a parent district.
- Test-suite stability (the gate timed out once):
  - stale `vite preview` servers from manual checks were killed;
  - Playwright `workers: 4` (parallel SwiftShader renders starved each other);
  - `MapView` now redraws only on snapshot, camera change, resize or active interpolation, so an idle map
    costs nothing;
  - e2e time fell from ~1 min to ~20 s.

## 2026-10-02 — PLAN 0.20: headless runner `npm run sim`
- `tools/headless/runner.ts` `runHeadless({scenario, seed, years})` drives the same `Sim` facade as the
  worker. Per year it records: tick, state hash, per-nation controlled/owned cells, formation count and
  strength, cells flipped during the year, event counts by kind, and tick ms (mean/p95/max) plus wall ms.
- `tools/headless/cli.ts`: `npm run sim -- --scenario toy --seed 7 --years 10 [--out file]`, default
  `.cache/runs/<scenario>-seed<seed>-<years>y.json`.
- Verified: toy, seed 7, 10 years = 87 600 ticks in 2.9 s wall. Mean tick 0.033 ms, p95 ≈ 0.075 ms;
  ~2.7–4.3k cells flipped per year, 120 formations steady, final hash 04c3638d. Metrics JSON written.
- `tests/unit/headless.test.ts`: 2-year run has the expected structure, and its final hash equals a plain
  `Sim` stepped the same number of ticks.

## 2026-10-02 — PLAN 0.21: i18n skeleton
- `src/ui/i18n/index.ts`:
  - `t(key, params)` over flat JSON catalogs with `{name}` interpolation. `MessageKey = keyof en.json`, so
    an unknown key is a type error.
  - `locale` is a Preact signal, so components re-render on change. `setLocale` persists to localStorage
    and sets `<html lang>`; the first visit follows `navigator.language`.
  - `qps` is a generated pseudo-locale (accented, padded ~30%, bracketed ⟦…⟧, placeholders kept). It
    exposes hard-coded strings and truncation without a translator.
- `src/ui/i18n/en.json` (English first). `src/ui/TopBar.tsx` shows the title, a tagline and the language
  picker; `App` renders it. Styled as a dark, gold-trimmed panel (AoC-like palette).
- Lint: local rule `warsim/no-literal-ui-string` (`tools/eslint/warsim-plugin.js`) on `src/{ui,editor,app}`
  `.tsx`, excluding bench pages.
  - It flags JSX text with letters, string/template literals as JSX children (including both branches of
    ternaries and the right side of `&&`), and user-facing attributes (title, alt, placeholder, label,
    aria-*).
  - Fixtures: `ui-literal-string.tsx` must fail, with all 4 literals reported; `ui-translated.tsx` must pass.
    Mutation check: a literal tagline in the real TopBar is reported.
- Tests:
  - `tests/unit/i18n.test.ts`: interpolation, pseudo-locale and reactivity, catalog sanity.
  - `tests/e2e/i18n.spec.ts`: the UI shows en.json strings with no raw keys. Switching to qps changes the
    label, title and `<html lang>`, and the choice survives a reload.
- Screenshots `docs/evidence/0.21/i18n-{en,qps}.png` viewed: the top bar renders over the live toy map in
  both locales.
- Gotcha: Playwright's ESM loader needs `with { type: 'json' }` for JSON imports, so the e2e test reads the
  catalog with fs.

## 2026-10-02 — PLAN 0.22: Phase 0 review (Phase 0 complete)
- Re-read SPEC in full. Fixed drift (SPEC v0.2):
  - §2.2 layout matches the real files;
  - §2.3 message shapes as implemented (init/reqId/reply/provinces/error, `ack {seq, buffers}`,
    `buildProvinces`);
  - §2.5 systems are `(world) => void` with `world.rng`/`world.out`;
  - §2.6 stream seeding by name, fdlibm dmath, section-chain state hash;
  - §2.7 Phase-0 save = raw WSEC sections (gzip container in 1.27);
  - §5.3 CE modes aligned with AoC's documented v4.3 behaviour (dynamic cheap-in-peace/costly-in-war,
    progressive one step per tick, static, locked, random per tick);
  - §8 border technique is now the 4×4 cubic B-spline, plus dev-GPU budget guards and redraw-on-change;
  - §9 Q/E zoom keys (AoC parity);
  - §10 headless metrics, test API surface and URL options, bench on headless GPU with timer queries.
- DECISIONS: ADR-4 is final (raw WebGL2 + twgl, numbers table, budget translation). ADR-7 crop refined;
  ADR-12 and ADR-13 added during the phase.
- Dead code: `SimServer.snapshotsSent` (never read) removed. All other exported helpers are referenced.
- Missing test added: `tests/e2e/mapview.spec.ts`.
  - It covers the end-to-end "one truth" path: worker sim → snapshot dirty tiles → R16UI texture → pixel.
    An occupied 3×3 block (found by stepping the same seed in Node) renders in the occupier's colour family.
  - Mutation check: uploading tiles only at tick 0 makes it fail.
- PARITY: 7 Table 1 rows → partial with evidence (camera controls, looping map, localisation, seeded runs,
  political map mode, borders/polish, scale/performance). Two Table 2 additions → partial. The score is
  regenerated by the tool: 4.4%.
- Gate green: tsc, eslint, 117 vitest, build, 18 e2e, parity.
- Phase 0 summary:
  - Foundations: deterministic core (dmath, PCG32, xxHash, SoA tables, sections, I1–I5).
  - Runtime: worker protocol with acked snapshots; WebGL2 map and instanced-proxy renderers (benchmarked
    against Pixi); camera with wrap.
  - Data: pipeline (NE + ETOPO, Miller) and load-time province raster.
  - Tooling and docs: headless runner, i18n, parity tooling and docs.
  - Next: Phase 1 (1.1 zod schemas).

## 2026-10-02 — Phase 0 process audit against PROMPT.md "EVERY ITERATION"
How each step was applied to tasks 0.4–0.22 (0.1–0.3 were done in an earlier session), with the gaps.

| Step | How it was applied | Gaps |
|---|---|---|
| 1 Read SPEC, PLAN, PROGRESS tail, BLOCKERS, critic report | Read at session start. `critic/` does not exist; BLOCKERS had no open items. SPEC sections were re-read before the tasks that depend on them: §2 for 0.12/0.13, §3 for 0.18/0.19, §8 for 0.14–0.17, §10 for 0.20; full re-read at 0.22. | One continuous session, so the files were not re-read from scratch before every task. |
| 2 Full suite first | Ran tsc, eslint, vitest and build at session start (green). `npm run check` before task commits. | — |
| 2b Critic findings | Not applicable: no `critic/CRITIC_REPORT.json` exists. | — |
| 3 First unchecked task | Tasks were taken strictly in order, 0.4 → 0.22. One deviation, AT adjusted not split: 0.6's frame-count AT was met with scene-change frames (logged). | — |
| 4 Implement fully | No stubs or TODOs (grep for TODO/FIXME in src and tools is empty). | — |
| 5 Verify for real | Every task has tests. Screenshots were viewed for every visual task: 0.6 trailer frames, 0.14 map at 3 zooms, 0.15 proxies, 0.16 precision, 0.17 live map and dateline seam, 0.18 mask/elevation renders, 0.19 province raster at 3 zooms, 0.21 UI in 2 locales. Fixed what they exposed: corner-hatch artifacts (0.14), the `.gz` content-encoding issue (0.19), invisible markers (0.17). | `reference/` frames were compared in 0.6 only; later visuals were not compared side by side with AoC frames (nothing comparable to the 1938 map exists yet). |
| 6 Performance | Rendering tasks were benchmarked on the GPU (0.14, 0.15, 0.19); sim tick timing in 0.20; snapshot path timing in 0.13. | Snapshot build time (budget ≤ 2 ms) was not measured separately. |
| 7 Commit, tick, PROGRESS, parity | Every task: one commit, PLAN tick and a PROGRESS entry. `npm run parity` ran in every `check` from 0.8 on. | PARITY rows touched by 0.17, 0.20 and 0.21 were updated in the 0.22 review, not at each task. 0.5/0.6/0.7 were docs-only commits made without a full `check`. 0.16 was committed with a lint error, fixed in the next commit; since then commits are gated on the `check` exit code. |
| 8 Blockers after 3 failed attempts | Never triggered; no task needed 3 attempts. | — |
| 9 Review every ~5 iterations | Full review at 0.22: SPEC drift fixes (v0.2), dead code removed, missing end-to-end test added. Lighter refactors happened during tasks (bench helpers deduplicated in 0.15, `halveElevation` shared in 0.18). | Only one formal review over 19 tasks; the cadence asks for ~4. Phase 1 will hold a review every 5 tasks (after 1.5, 1.10, …). |

## 2026-10-02 — Phase 0 audit remediation (gaps closed where they can still be acted on)
- **Step 1:** re-read PROMPT.md EVERY ITERATION, the PLAN status (all 0.x ticked), the PROGRESS tail,
  BLOCKERS (no open items) and `critic/` (absent) before this pass.
- **Step 7 (ungated docs commits):** `git diff-tree` shows b0ab326 (0.5), 0aba4cb (0.6) and e2bc184
  (0.7) changed only `.md` files. Their code is byte-identical to 3ba274f (0.4), which passed
  `npm run check`. The 0.16 lint slip was fixed in ec41751. PARITY rows for 0.17/0.20/0.21 were updated
  in 0.22.
- **Step 6 (snapshot build ≤ 2 ms not measured):** `tests/unit/snapshot-perf.test.ts` measures it at M
  size (2048×1024, 150 nations, 4000 formations, 32 dirty tiles + 200 events per snapshot): steady median
  **0.32 ms**, p95 0.62 ms. The one-off full sync of 512 tiles takes 8.1 ms (load/save only). The test
  asserts median < 2 ms.
- **Step 5 (no reference comparison after 0.6):** compared AoC trailer frame `0014` (Central Europe)
  side by side with our `A-webgl2-map-z1-region` render. The composite stays in the scratchpad because
  it contains AoC material.
  - AoC's ~2-tile dark outlines make nations read instantly; our constant 1.25 px line read weakly at
    operational zoom.
  - Fixed: `borderWidthPx` (`src/render/map/MapRenderer.ts`) grows border width with sqrt(px per
    cell) from 1.25 px to a 3.5 px cap. Re-benched (GPU 0.41–0.47 ms, unchanged) and re-viewed
    `docs/bench/A-webgl2-map-z{1,2}`: borders are now clearly legible and still smooth. A faint
    anti-aliasing speckle inside the line at 48 px/cell is noted for 1.28.
  - Other differences belong to later tasks: AoC occupation is a darker occupier tint with its own
    outline (ours: hatching; to revisit in 1.15/1.28 against TEXT "stripes"); name labels + strength
    numbers + city dots (1.5, 1.29, Phase 2 T1 markers).
- **Step 9 (one review instead of ~4):** an additional review pass.
  - Removed duplicated resize detection in `MapView.frame` (`resize()` now reports changes).
  - Added a unit test for the border width.
  - Re-checked exported helpers for dead code (none besides the stat removed in 0.22).
  - From Phase 1 on, a review pass runs every 5 tasks.

## 2026-10-02 — Phase 0 per-task verification iteration + boundary reviews
- Ran an EVERY ITERATION pass over each Phase 0 task at HEAD:
  - steps 1/2: state re-read, suite run;
  - steps 3–5: the task's acceptance test re-executed via `npm run verify:phase0`
    (`tools/verify-phase0.sh`, one AT command per task);
  - step 7: this entry.
- Result: **22/22 PASS**. Included:
  - lint fixtures, the Playwright smoke test, ≥ 30 frames, parity validity, dmath golden bits in Node and
    Chromium, PCG/xxHash vectors;
  - table round trip and mutation hashing, I1–I5, the snapshot flow and pool, bench artefacts and ADR-4;
  - precision ≤ 0.5 px, camera and wrap, data `--check` and manifest, province raster in Chromium == Node;
  - the 10-year headless run, i18n, and the full gate.
- Step 9 review passes at the 5-task boundaries, each over the code that group produced:
  - 0.1–0.5 (config/tooling) and 0.6–0.10 (dmath/rng/hash): no debt found.
  - 0.11–0.15: `Table` called `Object.keys(schema)` on every create/remove/zero-row (an allocation on a
    hot path); the key list is now cached.
  - 0.16–0.20: the bench runner triggered Node DEP0190 (`spawn` with `shell: true` + an args array);
    it now passes one command string, and the warning count is 0.
  - 0.21–0.22: covered by the 0.22 review and the audit remediation.

## 2026-10-02 — Gate repair: province-raster timing budget measured under contention
- **Step 2:** `npm run check` failed on `tests/e2e/provinces.spec.ts`: the M raster decode+raster took
  3926 ms against the 1.5 s budget (PLAN 0.19).
- **Diagnosis:** this is contention, not a regression.
  - Run alone: 120–125 ms.
  - Inside the 4-worker parallel suite: 600–900 ms, and once 3.9 s. The other workers' SwiftShader
    pages starve its worker. On contended runs the 1024 fetch also stretched to 4–5 s.
- **Fix:** the budget is unchanged. Timing specs now use the `*.perf.spec.ts` naming and run in a
  Playwright `perf` project with `dependencies: ['chromium']`, so they start only after the parallel
  suite has finished. The spec was renamed to `provinces.perf.spec.ts`, and `tools/verify-phase0.sh` was
  updated to match.
- **Result:** gate green, 18/18 e2e. The perf run measured M at 131 ms (decode 55 + raster 67, plus
  fetch 8).
- **Gotcha:** any future e2e timing assertion must go in a `.perf.spec.ts` file, or it will flake
  under parallel SwiftShader load.

## 2026-10-02 — PLAN 1.1: zod schemas + first `data/` tree
- **Steps 1/2:** state re-read; gate green at ed5f6b9. `critic/` is absent.
- **Built:**
  - `src/sim/data/schemas.ts` (zod 4.6, ADR-14) defines the schemas, the `DATA_FILES` path table,
    `validateFile`, `validateDataSet` (cross-file checks) and `collectKeys`. Schemas cover:
    terrain, unit types, tech, traits, buildings, map meta and scenario meta.
  - Data, all our own (DATA_SOURCES "Game data"):
    - `data/terrain.json`: 12 classes in enum order;
    - `data/units/{land,sea,air}.json`: 28 types covering all 23 SPEC classes;
    - `data/tech/*.json`: 43 techs, 1936–1952, including the nuclear chain atomic_research → … →
      ballistic_missiles/thermonuclear;
    - `data/traits/traits.json`: 14 traits; `data/buildings/buildings.json`: 6 buildings;
    - `data/maps/{earth,toy}/map.json` and `data/scenarios/{1938,toy}/scenario.json`.
  - `SCENARIO_GEOMETRY.toy` is now derived from the toy map and scenario JSON. Determinism hashes are
    unchanged (same numbers).
  - en.json gains 122 data keys.
- **AT:** `tests/unit/data-schemas.test.ts` (29 tests) passes.
  - Positive: every `data/**` file validates, the set passes the cross-file checks, and every
    nameKey/descKey is in en.json. Every unit class has a type, the heavy tank is gated at ≥ 1942, and
    the earth map matches the `projection.ts` constants.
  - Negative fixtures (`tests/fixtures/data-invalid/`) assert exact readable errors, e.g.
    `units/bad.json: types[1].stats.speed_kmh: Invalid input: expected number, received string`, and
    `tech: prerequisite cycle tech_a → tech_b → tech_a`.
- **Step 5:** there is no visual change (data/validation only), so no screenshots. The e2e suite is
  green at 18/18.
- **Gotchas:**
  - Playwright loads `src/` as plain Node ESM, so JSON imports need `with { type: 'json' }`. Without it
    every e2e test died at import time.
  - `latBottomDeg` is derived (`-64.16507274496172`): data must carry the exact double for the
    equality check.
  - Python on Windows writes CRLF unless `newline='\n'` is passed (git normalises on commit).
- **Parity:** row 78 (data-driven maps/years) and additions row 8 (tech) → partial. Score 4.4% → 5.0%
  via `npm run parity -- --write`.

## 2026-10-02 — PLAN 1.2: terrain derivation + strait crossings
- **Sources:** added three pinned sources and our own wetland outlines (DATA_SOURCES).
  - NE1_HR_LC (Natural Earth I land cover, 21600×10800). `tools/data/zip.ts` extracts it into `.cache/`.
  - NE 10m lakes and NE 10m geography regions.
  - `tools/data/wetlands.json` (ours).
- **Pipeline (`tools/data/terrain.ts`, ADR-15):** one pass over NE1 + ETOPO, which share the 1′
  grid. Per-cell inputs are:
  - mean land-cover colour, matched to 30 labelled reference sites sampled from NE1 (no
    hand-picked RGB);
  - forest-pixel share;
  - elevation standard deviation, giving mountains (≥ 280 m) and hills (≥ 110 m, or mean ≥ 3000 m);
  - wetland polygons → marsh, on flat ground only.

  Plausibility rules: no desert poleward of 52° (Arctic browns), ice only poleward of 58° (salt
  flats, glaciers). S is the 2×2 mode of M. Shipped: `terrain-2048x1024.u8.wsz` (0.12 MB) and
  `terrain-1024x512.u8.wsz` (0.04 MB). Natural lakes are now cut from the land mask.
- **Crossings:** `data/maps/earth/straits.json` holds 24 straits (Bosporus, Dardanelles, Gibraltar,
  Øresund, Belts, Kerch, Messina, Bab-el-Mandeb, Palk, Japan's straits, Sunda, Cook, …) with
  schema + en.json names. `applyCrossings` (`src/sim/data/terrain.ts`) extends each segment 4 cells past
  both shores and paints the water between the first and last land cell. All 24 link land at both M
  and S. Crossings stay data and are applied in the worker (`buildTerrain` request).
- **Terrain ids** moved to `src/shared/terrain.ts` (the renderer needs them). The toy world now uses
  Terrain.Plains/Water instead of ad-hoc 1/0.
- **AT:**
  - `tests/unit/terrain.test.ts` (11 tests, both sizes):
    - 22 known places (Sahara/Gobi desert, Amazon/Congo/taiga forest, Everest/Alps/Caucasus mountains,
      Pripyat/Sudd marsh, Taymyr tundra, Greenland ice, Lake Superior water, …);
    - golden class counts ±10% (`tests/unit/terrain-golden.json`);
    - area-weighted shares within literature bounds. M: forest 17.4% (FAO 31%, forested relief counts
      as hills), hills+mountains 20.9% (UNEP-WCMC ~24%), desert 11.6% (arid+hyper-arid ~19%, steppe =
      grassland), ice 1.3% (Greenland), tundra 6.0%;
    - straits linked; date-line and 4-connectivity of the segment walker.
  - `tests/e2e/terrain.spec.ts`: Chromium worker load == Node (xxHash), class colours read back at
    7 uniform sites, and screenshots `docs/evidence/1.2/terrain-{world,europe,straits-turkey}.png`
    (`EVIDENCE=1` writes them there).
- **Viewed screenshots:**
  - World: biomes, lakes and mountain chains read correctly.
  - Europe: Alps, Carpathians, Pripyat marsh, taiga/plains split.
  - Turkey close-up: the Dardanelles crossing lane; the Bosporus is land-bridged at M.
  - Iterated once on the previews: Arctic desert speckles, Saharan "ice" and Everest-as-ice were
    fixed with the plausibility rules.
- **Reference comparison** (logged; composite not saved, AoC material): trailer frames "Create your
  own"/"Paint scenarios" show AoC's greyscale editor code. The palette is Basic Land, Desert/Tundra,
  Hills, Mountains, Crossing, Water; long crossing bands span seas. Ours: 12 natural-colour classes,
  passable mountains, straits-only crossings. These are deliberate deviations, recorded in ADR-15.
- **Test change, logged:** the `data-manifest` land-fraction floor moved 0.30 → 0.29, because lakes
  are now water (0.3015 → 0.2990, −0.83% of land). The test gained lake-is-water points (Superior,
  Ladoga, Victoria, Baikal, Huron, Titicaca) and a lake-island check (Isle Royale).
- **Known limits (ADR-15):** modern Aral/Chad outlines; boxy hand-drawn marshes; city cells
  become URBAN in 1.5.
- **Parity:** row 25 (terrain) → partial. Score 5.0% → 5.6%.

## 2026-10-02 — PLAN 1.3: 1938 ownership (admin-1 → nations, interwar border regions, colonies, occupation)
- **Data (ADR-16):**
  - `data/scenarios/1938/nations.json` lists 99 owner nations (tag, name key, colour; PLAN 1.4 adds
    traits, cores, puppets and alliances).
  - `ownership.json` holds:
    - `byCountry` for all 251 NE admin-0 units;
    - 55 `byProvince` overrides;
    - 25 polygon `regions`, each guarded by `onlyFrom` (so a coarse ring changes only one side of a
      border);
    - 2 `occupation` rings (Japanese-held North China and the Yangtze delta: owner China, controller
      Japan).
  - Zod schemas and cross-checks cover both files, and nation names are in en.json.
- **Code:** `src/sim/data/ownership.ts` adds two functions.
  - `reconcileIslands` gives each landless island territory one land cell. Malta's 68 force-placed
    province cells would otherwise inflate it.
  - `buildOwnership` applies province owners, a neighbour fill for province-less land, the guarded
    regions, then occupation.

  The worker gained a `buildPolitical` request and the bench view `bench.html?b=W`. Builds in
  229 ms at M in Chromium (province raster included).
- **AT (`tests/unit/ownership.test.ts`, 6 tests, M and S):**
  - Danzig = DAN, Lwów = POL, Königsberg = GER, Harbin = MAN and Addis Ababa = ITA, plus 76 more
    places, all checked as of 1938-01-01. Examples: Vienna AUT, Uzhhorod CZS, Gleiwitz GER,
    Kattowitz POL, Wilno POL, Memel LIT, Viipuri/Petsamo FIN, Kishinev/Izmail ROM, Camenca SOV,
    Dobrich ROM, Pazin/Rhodes ITA, Antioch SYR, Barcelona/Madrid/Valencia REP, Seville/Burgos/Tétouan
    NSP, Peking/Nanking CHI under JAP, Hankou CHI, Yan'an CCP, Kalgan MEN, Chengde MAN, Dairen and
    Toyohara JAP, Buea NIG, Windhoek SAF, Valletta ENG.
  - Every adm0 and override key is mapped; every nation owns land at both sizes; water is unowned;
    every region changes cells; occupation touches only China; deterministic.
  - e2e `tests/e2e/political.spec.ts`: worker owner and controller hashes == Node; screenshots in
    `docs/evidence/1.3/`.
- **Viewed vs an atlas description of 1 Jan 1938:**
  - **Europe:** Germany within its 1937 borders, East Prussia cut off by the Corridor, Danzig Free
    City at the Vistula mouth. Austria and the whole of Czechoslovakia (incl. Carpathian Ruthenia)
    are independent. Poland reaches past Wilno, Pinsk and Równe. Lithuania holds Memel but not
    Wilno. Greater Romania has Bessarabia, N. Bukovina and S. Dobruja. Italy has Istria, Fiume and
    the Dodecanese. Finland has Karelia to the Sestra. Spain is split, with the Republic holding the
    east and Madrid.
  - **Asia:** Manchukuo with Jehol and Hsingan, Mengjiang, Korea, Taiwan and Karafuto Japanese.
    Hatched occupation over Hebei, northern Shanxi, northern Shandong and the Shanghai–Nanking–Hangzhou
    triangle. Tibet, Xinjiang, the Mongolian PR and Tuva are separate.
  - **Empires:** British India incl. Pakistan and Bangladesh, Burma separate, French West and
    Equatorial Africa as blocs, Italian East Africa, South West Africa under South Africa, the Belgian
    Congo with Ruanda-Urundi.
  - All match. One fix from viewing: the Shaan-Gan-Ning ring was redrawn from a box to its outline.
- **Renderer note:** at 22 px/cell, faint dashed stair lines show inside nations, parallel to borders
  (`political-danzig-corridor.png`). This is the speckle already noted for PLAN 1.28, now more
  visible; the cause is not ownership.
- **Parity:** row 13 (rightful vs occupation) → partial; row 50 gains 1938 evidence. Score 5.6% → 6.3%.

## 2026-10-02 — PLAN 1.4: 1938 nations data (traits, capitals, puppets, alliances, cores)
- **Data:**
  - `data/scenarios/1938/nations.json` now holds 103 nations: 102 alive, plus Ethiopia as a dead
    nation with cores on ETH.
  - Each nation has adjective, government, traits, aggression, incomeBonus, fightToDeath, capital
    {name, lonLat}, overlord {tag, autonomy} and extraCores.
  - 40 puppets: dominions, protectorates, mandates and colonial blocs; Manchukuo and Mengjiang under
    Japan; Mongolia, Tuva and Xinjiang under the USSR; Albania under Italy.
  - New ownership units: Gold Coast (GHA), Ceylon (LKA), Sarawak (MYS-1187).
  - `diplomacy.json` holds 7 alliances (Anti-Comintern, Anglo-French, Little/Balkan/Baltic Ententes,
    Comintern, United Front), 8 guarantees, and 2 wars in progress (Spain, China).
  - en.json gains nation adjectives, governments, alliance and war names.
- **Schema cross-checks:**
  - traits exist and don't exclude each other;
  - puppet chains are one level deep; dead nations have no relations;
  - one alliance per nation, and the leader is a member;
  - war sides are disjoint, and every diplomacy tag is a living nation.
- **Code:**
  - `src/shared/color.ts` (sRGB → CIELAB, ΔE76);
  - `nearestOwnedCell` in `ownership.ts`: coastal capitals sit in sea cells at M, so a capital snaps
    to its nation's nearest cell within 2.
- **AT (`tests/unit/nations.test.ts`):**
  - schema pass;
  - ≥ 100 living nations, ≥ 35 puppets;
  - every capital lies in its own territory: 87 exact, 15 coastal ones 1–2 cells off;
  - all 206 neighbour pairs at M have ΔE > 15. Seven pairs were recoloured to get there:
    AOF/FMO, AOF/AEF, PAL/TRJ, RAJ/BUR, HON/ELS, MON/TAN, PRU/CHL;
  - extraCores resolve to real admin units; diplomacy anchors; CIELAB reference values.
- **Test update:** the ownership tests (unit "every nation owns land", e2e cells check) now apply to
  living nations. Each also asserts that dead nations own nothing, so coverage is stricter, not looser.
- **Evidence:** `docs/evidence/1.3/political-*.png` regenerated with the new colours.
- **Parity:** row 21 (aggression and traits) → partial. Score 6.3% → 6.9%.

## 2026-10-02 — PLAN 1.5: 1938 cities with capitals, names rendered at T1
- **Data:** `npm run data` now also writes `data/scenarios/1938/cities.json`: 5774 cities, 102 of
  them capitals. The generator is `tools/data/cities.ts`, fed by NE populated places +
  `city-rules.json`:
  - 89 renames to 1938 names, 14 post-1938 exclusions, 9 forced includes;
  - stale rule keys fail the build;
  - capitals are bound from nations.json.
  Zod schemas cover city-rules/cities, plus cross-checks: one capital per living nation, named as
  its capital. `--check` covers the generated file.
- **First pass was too sparse:** scalerank ≤ 6 dropped Leipzig, Hanover, the Ruhr, Breslau and
  Mukden ("Shenyeng" in NE). NE scalerank is per-country relative, so the fix was:
  - scalerank ≤ 8 + 2.5-cell spacing;
  - size = max(rank tier, population tier);
  - forced includes for cities that mattered more in 1938;
  - an added "Shenyeng" rename.
- **Sim:** `placeCities` (`src/sim/data/cities.ts`) gives each city its land cell (capitals snap to
  their own nation, others to any owned land within 2 cells) and owner. `nearestCellWhere`
  generalises the nearest-cell search (`nearestOwnedCell` is now a wrapper).
- **Render:** `src/render/labels/cityLabels.ts`.
  - A pure `layoutCityLabels` decides zoom fades per size, greedy collision in priority order
    (capitals → size) and wrap copies.
  - `CityLabelLayer` draws on a Canvas2D overlay: haloed text, gold capital dots.
  - Layout costs ≤ 0.19 ms per frame at any zoom (5774 cities, Node).
  - Wired into `bench.html?b=W` via the worker's `buildPolitical` (now returns placed cities).
- **AT:**
  - `tests/unit/cities.test.ts`: every living nation has exactly one capital city, on its own land,
    with the capital's name. 1938 names are present (Stalingrad, Königsberg, Danzig, Breslau, Lwów,
    Wilno, Peiping, Hsinking, Mukden, Batavia, …) and modern ones absent. Owners are right (Breslau
    GER, Lwów/Wilno POL, Danzig DAN, Hsinking MAN). Layout: no names at T0; names at T1 without
    overlap; closer zoom names smaller cities.
  - e2e: at T1 (16 px/cell ≈ 1.2 km/px) the page renders Berlin, Warsaw, Prague, Danzig, Königsberg,
    Breslau, Peiping, Tientsin and Kalgan. Screenshots are in `docs/evidence/1.5/`.
- **Viewed:** Central Europe (German grid of Hamburg/Hanover/Essen/Leipzig/Dresden/Breslau; Polish
  Poznań/Łódź/Kraków; gold capital dots) and North China (Peiping/Tientsin under occupation hatch,
  Kalgan, Kweisui, Yan'an, Mukden, Dairen). Readable and uncluttered.
- **Renderer artifact:** dashed stair-step lines inside nations are clearly visible in these shots,
  even far from borders. This is the Phase 0 issue queued for PLAN 1.28; it is not label-related.
- **Parity:** row 27 (cities and capitals with names) → partial. Score 6.9% → 7.5%.

## 2026-10-02 — Step 9 review pass after PLAN 1.1–1.5
- **Duplication removed:**
  - The map build chain (province raster → terrain + crossings → islands → ownership → cities)
    was copy-pasted in the worker, three unit tests and one e2e spec. It is now one pure
    `buildPoliticalMap` (`src/sim/data/politicalMap.ts`), used by all of them.
  - The manifest/gunzip helper was duplicated in 7 test files. New `tests/helpers/earth.ts` has
    `earthAsset`, `earthAdmin1`, `politicalMap1938` (memoised per file) and the typed 1938 data;
    `tsconfig.node.json` includes `tests/helpers`. The ownership determinism test compares the
    memoised map with a fresh `buildPoliticalMap` call, so it still checks two independent builds.
- **Missing tests added:** the PLAN 1.3–1.5 cross-checks had no failing fixtures. `data-schemas.test.ts`
  gains 5 negative cases (mutated copies of the real data), each asserting its exact message:
  - mutually exclusive traits;
  - a puppet of a puppet;
  - a nation in two alliances or on both sides of a war, and a dead nation in a guarantee;
  - a capital city with the wrong name, and a living nation without a capital;
  - ownership naming an unknown tag.
- **Dead code scan:** no value export in `src/` is referenced nowhere. The exports used only in
  their own module are documented constants or helpers (`STRAIT_EXTEND_CELLS`, `CITY_SNAP_CELLS`,
  `forEachCellInRing`), kept as API.
- **SPEC drift fixed:** the §2.2 layout now lists terrain/ownership/cities/politicalMap, the test
  layout (perf specs, helpers, fixtures) and the §2.3 protocol (`buildTerrain`, `buildPolitical`
  and their replies).
- **Open item, unchanged:** the renderer's dashed stair-line artifact (PLAN 1.28).
- **Flake found during the review gate:** `precision.spec.ts` timed out once at the 30 s default.
  It normally takes 25.5 s under SwiftShader, and parallel load pushed it over. Its time budget is
  now 90 s (`test.setTimeout`); the ≤ 0.5 px assertions are unchanged. Two clean reruns of the
  full e2e suite took ~36 s.

## 2026-10-02 — PLAN 1.6: flags (FlagSpec data, presets, 103 own-design 1938 flags, atlas)
- **`src/shared/flags.ts`:**
  - `FlagSpec` = aspect + layers. Layer types: stripes, rect, Nordic/Greek cross, saltire, hoist
    triangle, disc, star, crescent, poly, canton (nested) and preset (`$n` colour params).
  - `flagShapes` → polygons; `flagSvg` → SVG; `rasterizeFlag` → 4×4 supersampled, deterministic,
    aspect kept in the cell with a transparent letterbox; `buildFlagAtlas` → 48×32 grid with
    1 px gutters.
  - `rasterize.ts` moved from `src/sim/data/` to `src/shared/` so flags can use the same
    scanline fill (shared may not import the sim); importers updated.
- **Data:**
  - `data/flags/presets.json`: Union Jack, blue/red ensign, French tricolour, French and
    Portuguese colony patterns, Nordic crosses.
  - `data/scenarios/1938/flags.json`: one flag per nation, Germany per ADR-10.
  - Zod schemas: a recursive layer union; cross-checks for every nation having a flag, unknown tags
    and preset references.
- **AT:**
  - The atlas builds: `tests/unit/flags.test.ts`, deterministic, one cell per nation, every flag
    fills its fitted area, no two nations share a flag. Colour probes check GER, FRA, JAP, the
    St George centre and SWI's letterbox. SVG polygon count equals the shapes; preset parameters
    and errors are covered.
  - Grid reviewed: `bench.html?b=F` draws the atlas 2× with names, and
    `docs/evidence/1.6/flag-grid-1938.png` was viewed. The first view caught the 10th column off
    screen (viewport widened) and an unreadable Soviet emblem (redrawn: crescent sickle, hammer,
    star).
  - DATA_SOURCES and DECISIONS note the German flag choice (ADR-10, ADR-19).
- **Perf:** the atlas builds in 20 ms in Chromium and 21 ms in Node.
- **Parity:** row 48 (flag editor with presets) → partial; editor UI and random flags are still to
  come. Score 7.5% → 8.1%.
- **Gotcha:** commit 34e314b left `tools/data/{run,terrain}.ts` unstaged (their rasterize imports),
  because the stage list named `src tests docs …` but not `tools`; fixed in 6960cdd. Commits now
  stage with `git add -A` minus `CLAUDE.md`, and check `git status` is clean except `CLAUDE.md`.

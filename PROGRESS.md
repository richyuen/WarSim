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

## 2026-10-02 — PLAN 1.7: starting land order of battle
- **Data:**
  - `data/templates/land.json` (15 templates) and a new `cavalry` unit type;
  - `data/scenarios/1938/oob.json`: 225 groups, 1054 formations for every living nation, at
    January 1938 peacetime or front locations;
  - schemas + cross-checks for template unit types, OOB nations and templates; en.json names.
- **Code:** `src/sim/data/oob.ts`.
  - `templateStrength`: men = Σ element manpower; tanks/guns from armour and gun classes.
  - `placeOob`: nearest allowed cell to the anchor, then a 4-way flood over allowed land, keeping
    used cells 8-apart and stacking only if the area runs out. Allowed land is land the nation
    controls, or land its puppets own and control.
  - It runs inside `buildPoliticalMap` (so worker == Node). `nearestCellWhere` now takes a cell
    predicate, so the OOB search reuses it.
- **Correction from the first probe:** Japan's 1938 divisions were square (~20–25k men), double the
  standard template. Added `infantry_div_square` for Japan (JAP 368k → 604k men).
- **AT (`tests/unit/oob.test.ts`):**
  - every group placed;
  - all 10 major powers within the ADR-20 ranges (formations / divisional men / tanks);
  - every formation on land its nation controls or its puppet holds;
  - Japanese divisions in occupied China (≥ 15) and Manchukuo (≥ 6), Chinese ones only on
    Chinese-held land;
  - deterministic with zero stacking; template maths.
- **Visual:** `FormationDotLayer` (stand-in for the Phase 2 counters) draws on `bench.html?b=W`;
  `docs/evidence/1.7/oob-1938-{europe,china}.png` were viewed. Deployments look right:
  - Germany's Wehrkreise; Polish and Soviet concentrations along their border; the Soviet Far East
    group;
  - Chinese armies along the Xuzhou–Wuhan front, and Japanese divisions inside the occupation hatch.
- **Perf:** placement takes 8 ms at M.
- **Parity:** row 78 note updated (the scenario is fully data-driven except the ScenarioId registry).
  Score unchanged at 8.1%.

## 2026-10-02 — PLAN 1.8: calendar, speed levels, bottom bar (persisted)
- **Calendar (`src/shared/calendar.ts`):** integer Gregorian (Hinnant's days↔civil), with
  `dateOfTick`, `tickOfDate`, `isDayStart`, `isMonthStart` and `ticksInYear`.
  - `World.startDay` is set from scenario.json (toy: 1938-01-01) and saved in `world.meta`.
  - `SCENARIO_INFO` gives the main thread the start day.
- **Speed (`src/shared/speed.ts`):** 8 levels (1–256 h/s) + Max; default ×5 = 24 h/s (was a
  hard-coded 12).
- **UI:**
  - `src/ui/BottomBar.tsx`: Pause/Resume, −, "Speed ×N"/"Speed Max", +, and a localised date
    ("5 January 1938"; month names in en.json), with a Paused marker.
  - `src/app/hud.ts`: signals fed by snapshots; persists level and pause in localStorage; applies
    them to the worker at start (`?paused=1` still forces pause); keys Space and `,`/`.` (+/−
    zoom). It also records the worker-reported speed/pause so tests check the worker, not only the
    label.
- **AT:**
  - `tests/unit/calendar.test.ts`: 1938 = 8760 ticks; 1938-12-31 23:00 → 1939-01-01 00:00; 1940 =
    8784 with 29 February; known day numbers; round trip over ±164 years; 12 month starts and 365
    day starts in 1938; startDay survives save/load; speed clamping.
  - `tests/e2e/speed.spec.ts`: speed changed by buttons and keyboard and paused → reload → same
    level, the worker reports 48 h/s and paused, Space resumes, and the date advances.
  - Screenshot `docs/evidence/1.8/bottom-bar-paused.png` viewed.
- **Deviation (ADR-21):** AoC's 1× ≈ 1 month per 0.5 s. Our fixed levels are finer and slower
  because of the hourly tick, and AoC pace needs Max (Phase 7 check). Parity row 64 → partial.

## 2026-10-02 — PLAN 1.9a (split from 1.9): the 1938 world boots as sim state
- **Why the split:** 1.9's AT (a plausible 1938 income ranking) needs the real world in the sim, and
  no PLAN task booted it (1.27 already assumes it exists). 1.9a is recorded in PLAN; the economy
  stays 1.9.
- **World:**
  - province cell layer;
  - nations `living`, formations `template`, a new `cities` table (`def` index into cities.json);
  - all saved and hashed;
  - `Table.reserve` added, because growth replaces `cols`.
- **Scenario:** `src/sim/scenario1938.ts` `createWorld1938(seed, assets)` runs `buildPoliticalMap`.
  `placeCities` now returns each city's `def` index, since names are not unique.
  `Sim({scenario: '1938', assets})` starts with no systems yet.
- **Protocol / worker / app:**
  - `ScenarioId` adds '1938'; `SimInit.assets`; `init {assetBase}`;
  - the worker loads and verifies the assets, then builds;
  - `SCENARIO_INFO['1938']` (geometry M, start day); the app takes `?scenario=1938` (default
    stays toy: the determinism e2e suites use it).
- **Bugs found and fixed while testing:**
  1. The builder cached `table.cols` before creating rows. Growth swapped the arrays, so only 15 of
     102 capitals were recorded. Fixed with `Table.reserve`, with a unit test that `cols` stays
     stable.
  2. vitest `toEqual` on 2–15 MB typed arrays took 10–30 s, and timed out once. The tests now compare
     xxHash / `Buffer.equals`. The sim itself: build 192 ms, hash 10 ms, save 2 ms, load 5 ms.
- **AT:**
  - `tests/unit/scenario1938.test.ts`: layers == political map; nations, colours, living flags and
    capitals; cities and formations from data; deterministic; save/load bit-identical; assets
    required.
  - `tests/e2e/boot1938.spec.ts`: worker hash == Node hash; date label 1 January 1938.
  - Screenshot `docs/evidence/1.9a/app-1938-boot.png` viewed: the full 1938 world in the real app,
    with the starting armies drawn by the proxy renderer.

## 2026-10-02 — PLAN 1.9: economy (monthly gold, upkeep, superlinear admin, bankruptcy)
- **System:** `src/sim/systems/economy.ts`, registered for '1938'.
  - Pure `monthlyAccounts` and `runEconomyMonth`, run at `isMonthStart` (tick 0 included).
  - Nation fields: gold, income, expenses, incomeBonus, incomeMult (traits), bankrupt.
  - The cell layer `econ` is u32 ($M), saved. New event: `Bankruptcy`.
- **Calibration, two failed attempts first:**
  1. Terrain × per-capita development × area put Australia 2nd and Canada 4th; land swamped
     everything.
  2. A small land weight + city sizes still favoured the USA/Australia 13:1 over Germany, because
     city sizes come from modern populations.
  - **Final:** `data/scenarios/1938/economy.json` (1938 GDP + GDP per head per NE country,
    Maddison-style rounded). Each country's industrial capacity, GDP × (pc/US)^0.5, is spread
    over its cells by city weight + a 0.05 land base.
  - Result, gross gold/month: USA 5538, UK 2412, GER 2178, USSR 1156, FRA 1074, JAP 837,
    ITA 654, RAJ 385, NED 322, CHI 270.
  - Starting deficits: USSR −181, CHI −113, NSP −87 (large armies or at war); treasuries of 6
    months cover them.
- **AT:** `tests/unit/economy.test.ts` (10 tests).
  - One per rule: controller pays, occupied 50%; bonus and traits; upkeep ∝ strength; admin
    superlinear; exactly 12 payments a year; bankruptcy enter/desert/recover with events;
    weights and capacity.
  - 1938: top 5 = {USA, UK, Germany, USSR, France} with the USA first; every living nation earns;
    start gold = 6 months; after one simulated year the majors are solvent.
- **Perf:** an economic month costs 2.4 ms at M; one simulated year (1938 world, economy only)
  takes 29 ms, 3.3 µs/tick.
- **Step 5:** no economy UI yet (the nation/economy panel is a later task), so verification is
  headless: unit tests + a full-year run.
- **Parity:** rows 22 (income bonus) and 23 (economy tick) → partial. Score 8.8% → 10.0%.
- **Next:** a step 9 review pass is due (5 tasks since the last: 1.6, 1.7, 1.8, 1.9a, 1.9).

## 2026-10-02 — Step 9 review pass after PLAN 1.6–1.9
- **Duplication:** the 1938 map inputs (straits, nations, ownership, cities, OOB, overlords) were
  hand-assembled in three places: `createWorld1938`, the worker's `buildPolitical`, and the test
  helper/ownership test. Now there is one `politicalMapInput1938(assets, w, h)` in
  `src/sim/scenario1938.ts` (+ `TAGS_1938`).
  - The worker drops eight imports.
  - The test helper gains `assets1938(w)`, used by four tests in place of inline asset objects,
    and re-exports NATIONS/TAGS from the sim. The dead `STRAITS` and `RULES_1938` were removed.
  - The ownership determinism check still runs a fresh, independent build against the memoised one.
- **SPEC drift fixed in §2.2:** systems/economy, scenario1938/toy, data/oob, shared
  calendar/speed/scenarios, ui BottomBar, app hud and bench pages, the data tree (templates,
  flags, straits, scenario files).
- **Tests:** coverage for 1.6–1.9 is complete (flags, OOB, calendar/speed + e2e, boot e2e,
  economy rules + AT); no gaps found.
- **Open items, unchanged:** renderer dashed-stair artifact (PLAN 1.28); OOB dots blend into nation
  fills (Phase 2 counters).

## 2026-10-02 — PLAN 1.10: production queue, recruitment, manpower
- **Sim:**
  - `src/sim/systems/production.ts`: `queueFormation` (command `queueFormation {nation, template}`:
    pays gold + manpower at once, rejects with `ProductionRejected` otherwise); daily
    `productionSystem`; `spawnPoint` (capital, else nearest held cell ≤ 40).
  - New `production` table (nation, template, readyDay); nation manpower and manpowerMult;
    `cells.pop` layer (thousands); events `ProductionQueued` and `ProductionRejected`.
  - `world.rules` (template cost and time) set by the Sim; `RULES_1938` derives it from unit data.
    Cost scale 3.5 → infantry division 1001 gold / 12,460 men / 90 days.
  - Systems for '1938': production, then economy.
- **Manpower:** owned, controlled population × 0.05%/month × trait multiplier, cap 3%, start 1%.
  Population is 1938 GDP ÷ GDP per head, spread like the economy (Germany ≈ 68 M).
- **Design note:** a countdown lost a day, because commands apply before systems on the queue
  tick. Rows now store an absolute `readyDay`, so "after N days" is exact.
- **AT (`tests/unit/production.test.ts`, real 1938 world):**
  - GER orders an infantry division at 00:00 on 1 January. Against a twin sim without the order,
    gold and manpower differ by exactly the cost. No spawn before day 90; at 00:00 on day 90
    (1 April) it appears at Berlin's capital position, at full strength, with the right template.
  - That day it already pays its first upkeep: the twin is richer by exactly cost + one month's
    upkeep.
  - Also covered: rejection without gold or manpower or for an unknown template; bankruptcy stall;
    spawn moves when the capital is lost; manpower growth and cap; queued orders survive
    save/load deterministically.
- **Step 5:** no production UI yet, so verification is headless on the real 1938 sim.
- **Parity:** additions row 8 updated.

## 2026-10-02 — PLAN 1.11: land movement (province graph + cell A*), terrain costs, slotted poses
- **Nav** (`src/sim/nav/grid.ts`, `provinceGraph.ts`):
  - true-km row scales and MOVE_COST[mobility][terrain];
  - deterministic heap A* (8-connected, no corner cutting, admissible heuristic);
  - 4-connected land components;
  - a province graph with crossing groups as virtual nodes;
  - hierarchical `findRoute` (coarse above 500 km, corridor-restricted cell A*, flat fallback).
  - The nav cache is built lazily per world (80–100 ms at M) and never saved.
- **Movement** (`src/sim/systems/movement.ts`):
  - `moveFormation` command, with targets snapped to reachable land within 3 cells, else
    `MoveRejected`;
  - hourly `movementSystem` (speed × 0.3 march duty ÷ terrain cost, facing, `FormationArrived`);
  - order state saved, path cache recomputed from origin and target.
- **Rules:** per-template mobility and speed from the manoeuvre elements; slotted poses in
  `src/sim/core/pose.ts`.
- **Bugs found by the tests:**
  1. Panzer and motorised divisions marched at foot speed, because the towed artillery and AT were
     foot units. Fixed twice over: those templates now use motorised artillery, and support guns no
     longer set the pace.
  2. Lisbon → Vladivostok took 373–480 ms to fail. Vladivostok's cell is an isolated speck at M,
     and the province graph thought it was reachable. Added land components (O(1) reject) and
     target snapping.
- **AT (`tests/unit/movement.test.ts`, 8 tests):**
  - Munich → Milan costs more per km than Warsaw → Poznań, and the Alps penalty is larger for
    tracked units;
  - a Danish division marches Jutland → Zealand over the belts, never standing on water and using
    crossing cells;
  - no route France → Britain (rejected);
  - infantry ≈ 18–29 km/day across Poland, with armour arriving first;
  - a march is deterministic across save/load;
  - the coarse graph links Sicily to Italy, but not to Britain;
  - unreachable pairs are rejected in < 5 ms; coastal-speck targets snap;
  - slotted poses: layout, rotation and determinism.
- **e2e:** a Berlin → Munich order run in the worker for 5 days equals the same run in Node (hash).
- **Perf:** Berlin → Moscow 9 ms, Paris → Rome 1 ms, Lisbon → Khabarovsk 83 ms.
- **Parity:** row 26 (crossings) → partial; row 25 note updated.

## 2026-10-02 — PLAN 1.12: supply v1 (city-sourced network, encirclement attrition)
- `src/sim/systems/supply.ts`:
  - supply blocs (nation + puppets via the new `nations.overlord`, set from the scenario);
  - a 6-hourly multi-source flood from owned+controlled cities over the bloc's controlled cells and
    unclaimed crossing lanes, stored in the saved `cells.supply` layer;
  - hourly formation supply ±1/8 with attrition at 0 (2%/day + terrain `supplyAttrition`).
- New and spawned formations start at supply 1. System order is now production, economy, supply,
  movement (SPEC §2.5).
- Bug found by the tests: a 1/12 hourly rate summed to 0.9999… after a refill. Switched to an
  exact 1/8.
- **AT (`tests/unit/supply.test.ts`, 6 tests):**
  - separate GER and POL networks, with sea unsupplied;
  - puppets share the overlord's bloc;
  - an encircled Soviet division (city-free pocket) is at 0 supply within 24 h and attrits (> 8%
    over 5 more days), while a supplied Polish one is untouched;
  - relieving the pocket restores supply;
  - save/load mid-interval is deterministic;
  - a refresh takes < 60 ms.
- Parity: additions row 7 (supply and attrition) → partial.

## 2026-10-02 — PLAN 1.13: engagement + element combat v1
- **Elements** (`src/sim/systems/elements.ts`, saved table):
  - every 1938 and produced formation is equipped from its template (infantry division =
    24 inf + 3 art + 1 AT);
  - strength (men) = Σ elements;
  - losses go through `applyLoss` (wound carry), dead elements are removed, and an empty
    formation is destroyed with `FormationDestroyed`;
  - `removeFormation` and supply attrition now go through elements.
- **Wars** (saved pair set): seeded from `diplomacy.json` (Spanish Civil War, Sino-Japanese War).
- **Combat** (`src/sim/systems/combat.ts`):
  - contact within 1.5 cells between nations at war, using a spatial hash;
  - battles are the connected contacts, and engaged formations pause movement;
  - hourly simultaneous element volleys with health-weighted, hash-drawn targets held 4 h, and
    terrain attack/defence and supply factors;
  - FireEvents go to `TickOutputs.fires` (drained by the Sim and the worker).
- **System order:** production, economy, supply, combat, movement.
- **Bugs found:**
  1. `Sim.load` kept derived caches from the previous state (stale paths could steer reused
     formation ids). Load now clears them, covered by a load-into-a-live-sim test.
  2. A first damage rule let batteries die 7× faster than battalions; switched to health-weighted
     targeting.
- **Perf:** a naive targeting scan cost 9.6 ms per tick in an 80-division battle. Per (formation,
  unit) weight tables with binary search bring it to 3.2 ms, with an identical result.
- **AT (`tests/unit/combat.test.ts`, 6 tests):**
  - 2:1 Lanchester: loss ratio 0.263 vs 0.268 expected (±20% allowed), 300 h battle;
  - hills ÷1.3 and mountains defend better than plains;
  - 56 FireEvents per hour for two divisions, all with live, hostile ids and positions at the
    battle;
  - neutrals don't engage, and contact pauses a march in the full sim;
  - save/load into a live sim is deterministic;
  - the 1938 wars are seeded and every division is equipped.
- No battles at the 1938 start: the starting armies are not placed in contact. Fronts come with
  1.14 and the AI.
- Parity: additions row 2 (element combat) → partial.

## 2026-10-02 — PLAN 1.14: territory pressure, frontier-set flips, connectivity rule
- **Territory system** (`src/sim/systems/territory.ts`):
  - pressure stamped by formations of nations at war (radius 2, linear falloff, supply-scaled);
  - a derived frontier set (rebuilt only when invalidated, with local upkeep after flips);
  - adjacency-only flips after 16 h of attacker pressure ÷ terrain defence > holder bloc +
    garrison;
  - two-phase decisions.
- **State and cache changes:** new saved `cells.flip` layer; `Wars.version`/`nations()`;
  `World.setController(…, keepFrontier)`; load clears the frontier.
- **Movement:** formations wait at enemy-held cells until they flip.
- **Bug found by the wave test:** the front stalled on day 5 because divisions outran it (ADR-27).
  Fixed by the movement gate.
- **AT (`tests/unit/territory.test.ts`, 5 tests):**
  - three divisions advance through a 12-row test block at 12 then 24 cells on alternating days
    (1.5 cells per row per day), every flip adjacent to German-held land;
  - an army behind a Polish line flips nothing beyond it in 4 days;
  - equal forces hold the border;
  - the 1938 GER–POL frontier is bounded (50–6000 cells), incremental upkeep equals a rebuild
    after 3 days, and the cost per tick is small;
  - a front survives save/load into a live sim.
- Parity: row 1 (AI expansion and conquest) → partial.

## 2026-10-02 — Review pass after PLAN 1.10–1.14
- **Bug fixed:** bankruptcy desertion (PLAN 1.9) still cut formation strength directly, bypassing
  the elements added in 1.13, so strength and Σ elements drifted apart for bankrupt nations from
  tick 0. Desertion and supply attrition now share `bleedFormation`. Found by the new element
  invariant test.
- **Perf:**
  - the supply network refresh is skipped when control, cities and overlords are unchanged
    (`World.supplyDirty`, derived; skipping writes the same layer), cutting a 1938 tick from
    3.07 to 1.61 ms;
  - routing the supply flood through a shared neighbour helper made it 3.3× slower (33 vs
    9.6 ms), so it stays inline, with a comment explaining why.
- **SPEC drift:** the system order now follows SPEC §2.5 (production/economy, supply, movement,
  combat, territory). Before, movement ran last.
- **Debt:**
  - dead `TemplateRule.strength` removed (the production test now asserts the template's men total
    and the produced division's elements);
  - one `neighbours4` helper in nav/grid replaces copies in the province graph, territory and
    component labelling;
  - shared test helpers `tests/helpers/sim1938.ts` (`nationId`, `addDivision`) replace copies in
    the combat, territory, supply and movement tests.
- **Missing tests added** (`tests/unit/elements.test.ts`):
  - strength = Σ elements, no orphans, the derived index equals the table, through battle,
    attrition, removal and load into a live sim;
  - destroying a formation removes its elements and emits one event.

## 2026-10-02 — PLAN 1.15: occupation vs owner, capital capture and relocation, winner-takes-all
- **Capitals system** (`src/sim/systems/capitals.ts`, runs after territory):
  - capture by an enemy at war → relocation to the largest held city, a field capital, or
    elimination;
  - field capitals are checked hourly;
  - `eliminateNation` clears formations, production, capital flags and wars.
- **Commands:** `setSetting {winnerTakesAll}` (saved in `world.meta`) and the God brush
  `paintControl`. New events: CapitalCaptured, CapitalMoved, NationEliminated.
  `Wars.endAllOf`.
- **Bugs found by the tests:**
  1. Winner-takes-all left the capturer's own occupied cells owned by the dead loser.
  2. A nation reduced to a field capital could lose every cell and stay alive.
- **AT (unit, `tests/unit/capitals.test.ts`, 7 tests):**
  - a 4-day front flips only controllers (owner layer unchanged, 28+ occupied cells);
  - Warsaw captured → capital to the largest held Polish city;
  - no capture without war;
  - winner-takes-all annexes all of Poland and ends its wars;
  - Luxembourg: field capital, then eliminated;
  - the setting survives save/load;
  - every living 1938 nation starts with a held capital city (no moves on day 1).
- **AT (e2e, `tests/e2e/occupation1938.spec.ts`):** German control painted over central Poland
  renders hatched in the occupier's colour family (≥ 80% of sampled pixels, two shades), while
  untouched Poland keeps its fill. Evidence: `docs/evidence/1.15/occupation-poland.png`, viewed.
- **Parity:** rows 13 (occupation), 14 (capital capture) and 15 (winner-takes-all) → partial.
  The deviation from AoC's death rule is in ADR-28.

## 2026-10-02 — PLAN 1.16: wars, war score, exhaustion, peace, fightToDeath
- **War records** (`src/sim/wars.ts`, saved): sides with leaders, score, capital bonus,
  exhaustion, per-side fightToDeath, truces. `atWar` is a derived pair set (the old API is kept,
  so combat, territory and movement are unchanged).
- **War system** (`src/sim/systems/war.ts`, daily, runs last in the tick):
  - score and exhaustion;
  - broke, exhausted or crushed sides sue;
  - terms: white peace, nearest-first share annexation, puppet at ≥ 90;
  - a 2-year truce.
- **Commands:** `declareWar` (puppets join, invalid ones emit WarRejected), `forcePeace`,
  `setWarFightToDeath`.
- **Other changes:**
  - `nations.fightToDeath` comes from the scenario;
  - the 1938 wars start as records (both are fight-to-the-death on at least one side);
  - capital captures add ±25 to the war score;
  - `World.setOwner` marks dirty tiles. This also fixes winner-takes-all owner changes not
    reaching the renderer.
- **AT (`tests/unit/war.test.ts`, 8 tests):**
  - declaration with puppets and rejections;
  - crushed (60% occupied) → full annexation, Poland a German puppet, truce blocks redeclaring;
  - broke at score 40 → exactly round(0.4 × occupied) annexed, west (nearest) first, the rest
    reverted;
  - white peace at score 4 restores everything;
  - fightToDeath: 60 days crushed and broke without peace;
  - Warsaw capture gives +25 and God forcePeace works;
  - save/load into a live sim is deterministic;
  - 1938 war records are seeded.
- **1938 check:** after 180 days both starting wars continue (fight to the death). Spain's score
  is +4 and Japan–China's +16, with exhaustion rising.
- Parity: rows 4 (peace and truces) and 5 (fight to the death) → partial.

## 2026-10-02 — PLAN 1.17: alliances and unions with unity and loyalty; join, leave, dissolve
- **Alliances** (`src/sim/alliances.ts`, saved): seeded from `diplomacy.json` (7 alliances,
  guarantees).
- **Monthly dynamics** (`src/sim/systems/alliances.ts`):
  - unity and loyalty drift;
  - disloyal members leave (lead passes on when the leader leaves);
  - an alliance under two members dissolves;
  - union at ≥ 80.
- **Commands:** createAlliance, joinAlliance, leaveAlliance, setUnity, setLoyalty. New events:
  AllianceJoined, AllianceLeft, AllianceDissolved, UnionFormed.
- **Wars:**
  - declarations bring each side's alliance and the defender's guarantors;
  - allies can't declare on each other;
  - elimination drops a nation from its alliance and guarantees;
  - the 1.16 terms tests isolate the GER–POL pair from alliances and guarantees in setup.
- **Alliance map mode:** snapshot `NationField.alliance` (stride 6), `MapView.setMapMode` palette
  swap, persisted `hud.mapMode`, and a bottom-bar "Map: …" button.
- **AT (`tests/unit/alliances.test.ts`, 7 tests):**
  - seeded alliances;
  - unity 5 → Italy and Japan leave by 1 July and the Anti-Comintern dissolves;
  - a disloyal Japan leaves alone;
  - Germany's war on Poland brings Italy, Japan and France (guarantor), not Britain, and raises
    unity over a peace twin;
  - allies can't fight each other;
  - create, join and leader-leave;
  - union at 95;
  - save/load.
- **e2e (`tests/e2e/alliances1938.spec.ts`):** the button switches to alliances. Germany and
  Italy show Germany's colour, France shows Britain's, Switzerland is non-aligned grey, and the
  mode persists. Evidence: `docs/evidence/1.17/alliances-europe.png`, viewed.
- Parity: rows 6 (alliances) and 7 (unions, unity, loyalty) → partial.

## 2026-10-02 — PLAN 1.18: puppets with autonomy; create, release, integrate, revolt
- **Puppet system** (`src/sim/systems/puppets.ts`, monthly):
  - leave freely above autonomy 90;
  - revolt (loyalty < 20, autonomy ≥ 10) → war of independence;
  - tribute;
  - integration (annex land and army at 100);
  - autonomy drift and loyalty relaxation.
- **State:** nation columns autonomy, loyalty, integration (from scenario overlord autonomy).
  Peace terms ≥ 90 now create the puppet through `makePuppet` (autonomy 30).
- **Commands:** createPuppet, releasePuppet, setAutonomy, setPuppetLoyalty. Events
  PuppetCreated/Released/Revolt/Integrated.
- **Bug found:** loyalty = 100 − autonomy made seven 1938 puppets revolt on tick 0. Replaced by
  ADR-31.
- **Puppet map mode:** snapshot `NationField.overlord` (stride 7), a `modeColor` refactor, and
  `lighten`. The alliance e2e now cycles back to political through three modes.
- **AT (`tests/unit/puppets.test.ts`, 9 tests):**
  - 1938 autonomy and tiers;
  - create plus exact tribute;
  - release is free (the tribute stays home);
  - leave above 90;
  - integration of Hungary (land, army, nation ends);
  - Albania's revolt declares war on Italy;
  - a voiceless satellite can't revolt;
  - a crushing peace creates a puppet;
  - no revolts in the first months of 1938.
- **e2e (`tests/e2e/puppets1938.spec.ts`):** Italy in its colour, Albania in lightened Italian
  green, Switzerland grey. Evidence: `docs/evidence/1.18/puppets-world.png`, viewed (French and
  British colonial blocs read clearly).
- Parity: rows 9, 10 and 11 → partial.

## 2026-10-02 — PLAN 1.19: revolts (province/region), suppression, rebel nation spawn
- **Province state** (`src/sim/provinces.ts`, saved): unrest and core per admin-1 province;
  cores are initialised from the 1938 owners (`initProvinceCores`, which builds the nav graph at
  creation).
- **Revolt system** (`src/sim/systems/revolts.ts`, monthly):
  - unrest drift;
  - suppression cost and effect;
  - a hash-drawn revolt chance;
  - province or region area;
  - `spawnRebels`: a new nation with land, core, capital, militia and gold, plus a 50% war.
- **Capitals:** `relocateCapital` is factored out of `captureCapital`. Rebels taking a holder's
  capital relocate the holder.
- **State, commands and events:** `nations.suppression`/`origin`; setting `revoltMode` (saved in
  `world.meta`); commands setSuppression, setUnrest, setSetting revoltMode; event RevoltSpawned.
- **AT (`tests/unit/revolts.test.ts`, 6 tests):**
  - calm 1938 start with cores;
  - statistical: 40 non-adjacent Soviet provinces at unrest 100 → 35/40 revolt by 1 March
    (84% expected), 11/40 under full suppression (29% expected);
  - a rebel nation spawns with land, core, militia, and a consistent war state;
  - region mode carries restless neighbours;
  - non-core unrest +2 net and an exact suppression cost;
  - save/load.
- Parity: rows 16, 17 and 18 → partial.

## 2026-10-02 — Review pass after PLAN 1.15–1.19
- **Perf** (1938, two months, per system):
  - the average tick is 0.72 ms, inside the 1.5 ms SPEC budget;
  - the war system's daily land count used Map operations per land cell (11 ms spike). It now
    uses typed arrays: 4.8 ms, and the average tick fell from 0.88 to 0.72 ms.
- **Missing tests added:** `tests/unit/replay1938.test.ts`.
  - Every command kind added in 1.15–1.19 is logged, and replaying the log on a fresh 1938 world
    reproduces the hash.
  - Save → load → save is byte-identical with the JSON sections (wars, alliances) and province
    state.
- **Debt:** shared `runEvents`/`eventKinds` test helpers replace four copies (war, alliances,
  puppets, revolts tests).
- **SPEC drift:** §2.5 now lists the implemented system order, including capitals, wars,
  alliances, puppets and revolts, with timings.
- Noted, not changed: the systems war ↔ puppets ↔ capitals ↔ revolts import each other in a
  cycle. They only reference functions at call time (safe in ESM). A shared diplomacy module
  would remove the cycle when the AI (1.24) adds more callers.

## 2026-10-02 — PLAN 1.20: collapse and revival (finite, cooldown) from cores
- **Cores:** `Provinces.claims` resolves scenario `extraCores` (admin-0/admin-1 codes) at
  creation; saved. Helpers `coresOf`/`provincesOf`.
- **Revival** (`src/sim/systems/revival.ts`):
  - `canRevive` (`revivalsLeft` > 0 and the cooldown passed);
  - `reviveNation` reuses `spawnRebels` with an existing id;
  - revolts route to dead claimants;
  - God `reviveNation` uses all of the nation's cores;
  - `eliminateNation` starts the 2-year cooldown.
- **Collapse:** a monthly bankruptcy streak (6 months) or God `collapseNation` frees puppets,
  revives claimants and turns restless provinces into rebel groups.
- **Death rule:** capital loss without core land is death (ADR-28's deferral resolved).
- **New events:** NationRevived, NationCollapsed.
- **AT (`tests/unit/revival.test.ts`, 7 tests):**
  - claims resolved (Ethiopia on 6+ Italian provinces, the Soviets on Bessarabia);
  - Ethiopia revives 2 times. It is rejected right after each death and one hour before the
    cooldown ends, and accepted exactly at it. The 3rd death is final;
  - a revolt on Ethiopian land revives Ethiopia;
  - God collapse of Italy frees Albania, revives Ethiopia and spawns rebels;
  - 6 bankrupt months collapse Poland;
  - capital loss with no cores kills Poland;
  - save/load.
- Two test-setup mistakes fixed on the way: a missing first command, and a shortcut death that
  left Ethiopia owning its land.
- Parity: rows 19 and 20 → partial; row 14 note updated.

## 2026-10-02 — PLAN 1.21: buffs and debuffs with timers
- **Buff records** (`src/sim/buffs.ts`, saved JSON, cached sums) with six kinds, applied in
  economy (income, manpower), combat (attack, defense), movement (speed) and revolts (unrest).
- **Expiry system** first in the tick. Commands grantBuff and removeBuff; events BuffGranted and
  BuffExpired.
- **AT (`tests/unit/buffs.test.ts`, 4 tests):**
  - a +50% income buff granted on 1 January gives exactly 1.5× the twin's income. It is still
    summed after tick 743, expires with its event at tick 744 (1 February 00:00), and February
    income equals the twin's;
  - attack +25% → damage dealt exactly ×1.25, and defense +25% → exactly ÷1.25;
  - double speed halves a march (0.45–0.55×);
  - a province unrest buff adds 10m;
  - removeBuff and save/load.
- Parity: row 24 → partial.

## 2026-10-02 — PLAN 1.22: combat-efficiency modes
- **Efficiency system** (`src/sim/systems/efficiency.ts`, monthly after the economy):
  - dynamic target (peace or war, war score, supply);
  - modes dynamic, progressive, static (0.8 + aggression/250), locked and random;
  - God `setEfficiency`/`lockEfficiency`;
  - cost by the dynamic formula, added to expenses.
- **Wiring:** CE multiplies damage dealt in combat. `settings.ceMode` is saved in `world.meta`;
  nation columns efficiency, ceStatic, ceLocked.
- **AT (`tests/unit/efficiency.test.ts`, 7 tests):**
  - dynamic: Sweden 0.7 in peace, Germany ≈ 1.0 at war;
  - progressive: 0.95, 0.90, 0.85, 0.80 over four months;
  - static: constant scenario values;
  - locked: all 1.0;
  - random: within 0.6–1.4, changing, deterministic, per nation;
  - a God lock holds;
  - war costs more than peace, and CE 1.2 vs 0.6 deals exactly 2× the damage.
- **Test budget:** the Hungary integration test (≈ 25 simulated months) ran 23 s alone and timed
  out at 31 s under parallel load. It now has an explicit 90 s budget, assertions unchanged. The
  tick profile is unchanged (0.74 ms).
- Parity: row 30 → partial.

## 2026-10-02 — PLAN 1.23: Major Battles and the breakthrough corridor
- **Saved Battles part** (`src/sim/battles.ts`): Major Battles, corridors and the history log.
- **`updateMajorBattles`** (`src/sim/systems/majorBattles.ts`, called by combat):
  - promotion at ≥ 120k men with 1.5× losses;
  - ending by men still standing;
  - a corridor for the winner;
  - history and events.
- **Territory:** corridor pressure ×2 and flip progress ×4.
- **God `forceBreakthrough`.**
- **Bug found:** winning by the last observation awarded the battle to a side that had just been
  destroyed. The winner is now decided by men still standing near the battle.
- **AT (`tests/unit/majorBattles.test.ts`, 4 tests):**
  - 5 vs 5 divisions (132k men) start a Major Battle named after a city, with German infantry
    shots exactly 1.5× those of a 1 vs 1;
  - after Poland's army is destroyed it ends with Germany winning, and the history shows
    start and end;
  - the corridor points east for 10 days;
  - a corridor makes the first flip happen at least 3× sooner, and 3+ flips in 12 hours where
    the plain front has none;
  - it is active at untilTick − 1 and gone at untilTick;
  - save/load.
- **Infra:** a parallel run once read an earth asset as corrupted ("incorrect data check",
  unchanged file; two reruns clean). `tests/helpers/earth.ts` now retries the read up to 3 times.
- Parity: row 29 → partial.
- **Gate flakes under machine load** (e2e at 50–53 s against the usual 25 s):
  1. The camera e2e page setup timed out once and passed on rerun.
  2. The supply refresh perf test read a 60.3 ms mean against its 60 ms limit; the refresh takes
     ~10 ms alone. It now asserts the fastest of 5 runs against the same 60 ms limit, measuring
     the code rather than contention.

## 2026-10-02 — PLAN 1.24: strategic AI v1 (war, peace, alliances, coalitions), aggression
- **Strategic AI** (`src/sim/ai/strategic.ts`, first in the tick):
  - weekly, staggered;
  - war utility from strength (target with allies and guarantors), aggression, claims,
    opportunity, exhaustion and wars;
  - pacifist floor and capped strength ratio;
  - stalemate peace;
  - alliance joining and forming against threats;
  - monthly coalitions against a hegemon (> 25% of world income);
  - `setAi` and the `aiEnabled` setting.
- **State:** nation columns aggression and aiOff.
- **Headless runner:** now runs `--scenario 1938` (`tools/headless/assets.ts`) and records events
  by EventKind name.
- **Perf:**
  - territory restricted to frontier cells under pressure or holding progress, with identical
    outcomes: tick 2.58 → 1.40 ms;
  - `nearestCellWhere` scans ring perimeters only: O(r³) took 12 s per relocation of a landless
    nation;
  - expired truces are pruned.
- **Long-run fixes (ADR-36):**
  1. cores are loyal through war and bankruptcy;
  2. integration passes cores;
  3. collapse voids debt and fires only when something fragments;
  4. rebel militia and gold resized.
  Before: 850 wars, 1,000 collapses and 700 nations per 10 years. After: ~85 wars, ~67 peaces,
  30–40 alliance joins, 2 collapses.
- **AT (`tests/sweep/aiSweep{1,2,3}.test.ts`, own gate stage `npm run test:sweep`):** 10 years
  each, all well above the AT minimums:

  | seed | wars | peaces | alliance changes |
  |---|---|---|---|
  | 1 | 83 | 65 | 44 |
  | 2 | 87 | 69 | 41 |
  | 3 | 84 | 66 | 63 |

  Evidence: `docs/evidence/1.24/sweep-seed{1,2,3}.json` (per-year counts).
- **Unit tests (`tests/unit/strategicAi.test.ts`, 6 tests):**
  - neighbours;
  - aggressors declare and pacifists never do;
  - the global and per-nation AI switches;
  - a coalition against a buffed Germany;
  - stalemate peace.
- **Test adjustments for the AI:**
  - the alliance-unity test and the bankruptcy-collapse test switch the AI off (isolation);
  - the collapse test keeps provinces restless (collapse needs something to fragment);
  - the one-year economy test gets a 120 s budget;
  - the headless test reads `FormationDestroyed`.
- Parity: row 3 (AI war declaration) → partial; rows 1 and 21 notes updated.

## 2026-10-02 — PLAN 1.25: operational AI v1 (front allocation, offensives, reserves)
- **Operational AI** (`src/sim/ai/operational.ts`, every 6 h, staggered daily per nation):
  - front sectors with threat;
  - a 15% reserve;
  - allotment by largest remainders with every sector covered;
  - sticky assignment;
  - attack at ≥ 1.5× local superiority, else hold;
  - re-route threshold and deployment range.
- **Perf:**
  - the first version took 32.5 ms per tick (daily re-routing, transcontinental orders). Sticky
    orders and range bring it to 1.2 ms;
  - supply refresh every 12 h (1.7 → 0.8 ms per tick).
- **AT (`tests/unit/operationalAi.test.ts`):** an isolated GER–POL war (no alliances or
  guarantees, other AIs off, no new wars), sustained (fight to the death):
  - Poland raids early (East Prussia, Silesia) while Germany redeploys from the west;
  - by day 60 Germany holds 763 Polish cells to Poland's 4;
  - front coverage (sectors with a division within 2 sectors) is 0.73/0.85 at day 10 and
    0.88/0.73 at day 30, all ≥ 0.6.
- **Isolation:** six pre-AI mechanism tests now run with the AI off (`settings.aiEnabled = false`
  in setup): the production, territory wave, war terms, capitals front, puppet integration and
  revolt spawn tests. The AI was moving their scripted armies.
- **10-year sweeps** (3 seeds, now with moving armies): 912–1,150 wars, 787–973 peaces,
  162–390 alliance joins, 491–697 revolts, 128–207 capital captures, 8–16 Major Battles; ~4 min
  per seed. AT minimums met.
- **Perf debt:** with AI wars the average tick is 2–3 ms (SPEC budget 1.5 ms); the main costs are
  supply, operational AI and combat.
- **Observation:** the churn is high (~100 wars a year, mostly involving rebel states). Long-run
  tuning belongs to the Phase 7 sweep (SPEC §10).

## 2026-10-02 — Review pass after PLAN 1.20–1.25 (performance)
- **Profiled** a war-heavy 200-day 1938 run (`node --cpu-prof`). Supply refresh was 31%, A* about
  24% and `findBattles` 7.5%.
- **Optimisations**, all with an identical state hash after 200 days (`bd8c8d13`):
  - A* uses generation-stamped typed scratch instead of Map/Set;
  - `boundKm` reads endpoint minima, since row scales are unimodal (checked at grid build, with
    a loop fallback);
  - a reused 8 MB supply flood queue;
  - partial supply refresh, reflooding only the blocs of nations whose cells changed (full
    refresh on load, overlord changes and raw writes);
  - `findBattles` only buckets formations of nations at war;
  - the combat effectiveness closure is hoisted.
- **Result:** 3.50 → 2.60 ms per tick in a war-heavy run.
- **Perf debt (PLAN 7.1, budget 1.5 ms):**
  - the supply flood over large warring blocs (~20%);
  - A* for operational-AI orders (~22%);
  - combat (~16%).
  - Ideas: route caching per (origin sector, target sector), a coarser supply graph for
    connectivity with cell refinement only near fronts, and staggering the operational AI over
    two days.
- **SPEC drift fixed:** §2.5 implemented order (buffs, both AIs first, efficiency) with costs;
  supply refresh period and partial refresh.

## 2026-10-02 — PLAN 1.26: economic AI v1 (budget split, build mix)
- **Economic AI** (`src/sim/ai/economic.ts`, monthly, before the economy, on projected
  accounts):
  - disbands weakest idle divisions to balance (half their men return);
  - suppression when held non-core land is restless;
  - one build a month within army-upkeep shares (35% peace, 60% war) and a 3-month reserve;
  - build mix: cadre (poor), motorised (vs armour), panzer every third order (rich, at war),
    infantry.
  - Nation column `builds`; `BUILD_MIX_1938`.
- **Economy:** admin cost capped at 50% of gross (ADR-38).
- **Bugs found:**
  1. Mongolia's 1938 army costs ~10× its income, and the AI first ran after the economy had
     already charged the month. Fixed by running before the economy on projected accounts.
  2. Barren Mongolia was insolvent even with no army (admin 3.8 vs income 0.7). Fixed by the
     admin cap.
- **AT (`tests/sweep/econSweep{1,2,3}.test.ts`):** 10 peaceful years (aggression 0, the 1938 wars
  ended) with no bankruptcy on any seed: 361 orders, 263 disbands, 1,148 formations at the end.
  ~4 s each, since peace leaves combat, territory and supply idle. The seeds give identical
  results, because without wars or revolts no seeded draw is taken. Evidence:
  `docs/evidence/1.26/`.
- **Unit tests (`tests/unit/economicAi.test.ts`, 5 tests):**
  - Mongolia disbands before its first month;
  - infantry vs cadre orders;
  - motorised against a panzer army;
  - suppression on restless non-core land;
  - no actions with the AI off.
- **War-world sweeps with the economic AI** (10 years, 3 seeds): 0 bankruptcies (was 121–304),
  261–383 wars, 238–351 peaces, 215–387 revolts, 40–91 capital captures, ~450 production
  orders; 100–130 s per seed.
- **Test isolation:**
  - the economic AI was disbanding test divisions and resetting suppression, so four more
    pre-AI tests run with the AI off: movement speed, revolt statistics, suppression cost (and
    its twin), and the earlier three;
  - the three files that `prettier --write` had reformatted in PLAN 1.25 (no prettier config in
    the repo: double quotes) are restored to the house style.

## 2026-10-02 — PLAN 1.27: save/load full state + command log, gzip; autosave to IndexedDB
- **Save codec** (`src/shared/saveCodec.ts`): gzip via CompressionStream; raw saves pass through.
- **Autosave** (`src/app/autosave.ts`):
  - IndexedDB slot with scenario, tick and bytes;
  - every 60 s of real time while running, and on page hide;
  - `?continue=1` resumes;
  - exposed on `__warsim.autosave`.
  - `SimClient.saveWithStatus` returns bytes and tick from one worker reply, so a running game
    cannot skew them.
- **AT:**
  - `tests/sweep/saveYear.test.ts`: after one year of 1938 AI play (seed 3), save → load into a
    live sim → save is byte-identical (I5), and both continue 40 days to the same hash (I2,
    across the 1 February economy month). Raw 38.6 MB → gzip 0.79 MB. Evidence:
    `docs/evidence/1.27/save-1939.json`.
  - `tests/e2e/autosave1938.spec.ts`: 72 ticks, `saveNow` (gzip record at tick 72), then a reload
    with `?continue=1` in a new worker resumes at tick 72 with the same hash. 48 more ticks equal
    a Node run of 120 ticks.
  - `tests/unit/saveCodec.test.ts`: round trip, compression, raw passthrough.
- **Test budgets:** the unit suite's default timeout is raised to 90 s. Multi-day 1938 sims with
  three AIs reached 30 s under parallel load: replay, AI 6-month and capitals front tests timed
  out one after another. No assertions changed.
- **Observation:** after a year of AI play the world has 603 divisions (from 1,054): war losses
  plus deficit disbanding. Army size will be balanced with the Phase 7 sweep.
- Parity: rows 49 (save/load) and 38 (AI switches and persisted settings) → partial.

## 2026-10-02 — PLAN 1.28a: T0 renderer without border artefacts (1.28 split into a/b)
- **Root cause of the dashed stair lines inside nations** (open since PLAN 1.3): the border
  distance used `fwidth(d)` inside the `n > 1` branch.
  - Derivatives are undefined when pixels in a 2×2 quad diverge.
  - fwidth also spikes where the second-strongest id switches.
  - The lines sat about 2 cells inside every border, where a neighbour's cells enter the 4×4
    window.
- **Fix** (`src/render/map/mapShader.ts`):
  - d/|∇d| from the analytic B-spline derivatives;
  - a second 4×4 pass only where d·scale < (halfW + 1)·2√2.
  - GPU (bench A, 1080p): T0 world 0.54 ms, Europe 0.50, close 0.46. The first full-gradient
    version cost 1.30 ms; it was 0.47 before.
- **AT (`tests/e2e/t0map.spec.ts`):** samples 21×21 px patches at 10 px/cell over the band 2–4
  cells inside Poland, away from formation markers. No border-coloured pixels with the new shader;
  the old shader gives 14 (checked by stashing it). Evidence shots `docs/evidence/1.28/` (Poland,
  Europe, world), viewed.
- **Compared with the AoC reference** (`reference/crop_0005.png`, `crop_0014.png`): AoC draws
  pixel-art fills with thick black stair borders. Ours keeps the same reading (flat fills, dark
  borders, lighter coasts) without stairs.
- **Still to do (1.28b):** the world-zoom coastline is still cell-blocky (fine land-mask pyramid
  pending), and the terrain map mode.
- Plan change: 1.28 split into 1.28a (done) and 1.28b (coast, terrain mode), per PROMPT ("split
  tasks that are too large").

## 2026-10-02 — PLAN 1.28b: fine coastline from the land mask; terrain map mode
- **Coverage texture:** the worker reduces the 16384 × 8192 land mask to a 4096 × 2048 land
  coverage texture (`buildLandCoverage`, shared) and posts it once with the terrain layer and
  terrain colours (`mapLayers` message; `SimClient.onMapLayers`, `MapView.hasFineCoast`).
- **Shader:**
  - land/water from the bilinear coverage (≤ 0.5 = water);
  - cell-water on fine land takes the strongest land id nearby;
  - the coast line from the coverage gradient;
  - cell-based coast lines are off when the fine layer is present.
- **Terrain map mode** (4th map mode): bilinear blend of terrain colours, national borders kept.
- **AT (`tests/e2e/coast1938.spec.ts`):**
  - over Europe, texels where the mask and the cell grid disagree render by the mask: 12 fine-land
    texels on water cells are drawn as land, and 12 fine-water texels on owned land cells as sea;
  - terrain mode shows the desert colour over the Sahara.
  - My first sampler found no disagreements: it required a whole uniform cell. It now samples
    texel centres.
- **Evidence** (`docs/evidence/1.28/`), viewed: Norway's fjords and skerries, the Greek islands,
  the world coastline, and the terrain world map.
- **Known:** islets more than ~2 cells from owned land show neutral grey (no owned cell in the 4×4
  window). GPU cost on the real 1938 map is not benched; bench A uses a synthetic map without the
  land layer.

## 2026-10-02 — PLAN 1.29: curved nation labels (worker derive + Canvas2D overlay)
- **Worker** (`src/worker/deriveLabels.ts`): per nation, the capital's component (else the
  largest; x unwrapped at the date line), the PCA axis, and a mid-line Bézier through
  10/50/90% of the robust extent, with half-thickness and area. `labels` messages carry i18n keys
  (or "Free <province>" for spawned nations), sent at most every 2 s when control changed
  (`World.controlChanges`, derived), and again after init or load.
- **App** (`src/render/labels/nationLabels.ts`, `MapView`):
  - a Canvas2D overlay with glyphs placed by arc length along the curve;
  - font fitted to thickness and length (9–64 px);
  - greedy glyph-circle collision, largest first;
  - hidden in terrain mode;
  - the layout is exposed as `view.nationLabels`.
- **Bug found by the evidence shot:** the largest component put France's name in Algeria and
  Italy's in Libya. Fixed by preferring the capital's component.
- **AT (`tests/e2e/labels1938.spec.ts`):**
  - ≥ 20 distinct names across the Europe and world views;
  - ≥ 3 curved;
  - bigger nations have bigger names;
  - no glyph overlaps among the 10 largest in either view;
  - the overlay has ink.
  - Evidence `docs/evidence/1.29/` viewed: Soviet Union, China, Brazil and Turkey large and
    curved; the small Baltic and Balkan names fit their borders.
- **Unit tests (`tests/unit/nationLabels.test.ts`):** axis and direction, capital preference,
  date-line component, too-small territories.
- **Parity:** row 50 (political map mode) evidence and notes updated. Row 54 (alliances map mode)
  corrected to partial: it was built in 1.17 and the row had been left stale.

## 2026-10-02 — Review pass after PLAN 1.26–1.29
- **Gap fixed:** city dots and names (PLAN 1.5) were only wired into the bench view; the game itself
  showed none, yet PARITY row 27 counted them. The worker now sends the city list in `mapLayers`,
  and `MapView` draws a `CityLabelLayer` overlay under the nation names. e2e: ≥ 5 named cities
  around Berlin at T1. Evidence `docs/evidence/1.29/cities-berlin.png`, viewed: Berlin (capital,
  gold), Hamburg, Leipzig, Dresden, Poznań, Breslau.
- **Missing test added:** `tests/unit/workerLabels.test.ts` drives the worker in Node. Labels
  follow init, are not re-derived without change, wait out the 2 s throttle after a God brush,
  and follow a load. The worker now takes province names from `init.assets`, so Node-initialised
  servers derive labels too.
- **SPEC drift:** §2.3 lists the `mapLayers` and `labels` messages.
- **Test hygiene:** the nation-label overlay has its own class (`map-nations`), so the ink check no
  longer matches the city canvas.

## 2026-10-02 — PLAN 1.30a: map modes with legends (1.30 split into a/b)
- **New modes:**
  - wars (red at war, grey at peace);
  - diplomacy (relations to the selected nation: self yellow, allies green, enemies red,
    overlord/puppets light green, others grey);
  - income (log-scaled pale-to-green ramp).
  - Seven modes in all, cycled by the bottom-bar button.
- **Snapshot:** `NationField.income` (stride 8) and `wars` pairs.
- **App:** a CPU copy of the controller grid from tiles for picking; a click selects
  (`MapView.select`, `hud.selected`); `MapView.nationName`.
- **UI:** a `MapLegend` per mode (with the selected nation's name in diplomacy).
- **Sim:** 1938 nations record their gross income at creation. It was 0 until the first economy
  month, so the income map was blank on a paused start; the e2e caught it.
- **AT (`tests/e2e/mapModes1938.spec.ts`):**
  - all 7 modes render with legend rows (screenshots in `docs/evidence/1.30/`, viewed);
  - Spain red and Sweden grey in wars mode;
  - a real mouse click selects France, and the legend names it;
  - with Germany selected: Germany yellow, Italy green (ally), Poland grey;
  - the Soviet Union is darker than Albania in income.
- **Fixed along the way:** the alliance e2e's cycle-back loop now bounds by `MAP_MODES.length`.
- **Parity:** rows 51, 52, 53, 55 and 56 → partial. Deviations: one war colour rather than one
  per war; monthly income rather than a 7-tick average.
- **Plan change:** 1.30 split. 1.30b is the revolts mode, a per-province choropleth that needs a
  province raster plus an unrest texture (not a palette swap).

## 2026-10-02 — PLAN 1.30b: revolts map mode (per-province unrest choropleth)
- **Worker:** sends the province raster in `mapLayers`, and per-province unrest as bytes
  (`provinceStats`) whenever `Provinces.version` (derived) changes. That happens after the monthly
  revolt pass, a God `setUnrest`, a load or an init.
- **Renderer:** R16UI province texture and a 128-wide unrest lookup. Fill mode 2 colours land by
  province unrest: calm → orange (50, may revolt) → dark red (100). Borders and city names stay;
  nation names are hidden in this mode.
- **Mode:** the 8th map mode, `revolts`, with legend.
- **AT** (`tests/e2e/mapModes1938.spec.ts`):
  - Warsaw's province set to 100 by God command renders dark red; central Germany is calm.
  - The step lands on 1 January, so the value seen is 98 after the monthly −2 decay.
  - Berlin was a poor calm sample: its lakes draw fine coast lines.
  - Evidence `docs/evidence/1.30/mode-revolts-warsaw.png`, viewed.
- **Known:** province edges are cell-blocky (nearest-cell province lookup).
- Parity: row 57 → partial (goes beyond AoC, which has no dedicated revolts mode).

## 2026-10-02 — PLAN 1.31a: nation panel (1.31 split into a/b)
- **Worker:** new `nationStats` message (`NationStat` per living nation + `WarStat` per war), at
  most once a second while the tick moves, plus after init/load. Fields: name key, colour, land,
  gold, income, expenses, bonus, bankrupt, manpower, men/formations, CE, alliance (name, leader,
  unity, member loyalty), overlord, autonomy/loyalty/integration, puppets, enemies, AI off.
- **App:** `hud.stats` signal; `hud.onSelectNation` → `MapView.select`.
- **UI:** `NationPanel` on the left: Overview and Economy tabs, nation chips (overlord, puppets,
  enemies) select that nation, × closes. Actions wait for God Mode / player control (1.32/1.33).
- **Sim:** 1938 nations also record day-one expenses (they read 0 until the first economy month;
  seen in the evidence screenshot).
- **AT** (`tests/e2e/nationPanel1938.spec.ts`): real click on Germany → panel with land > 1000,
  army > 100k, Anti-Comintern Pact, at peace; Economy shows income, expenses > 0, treasury and a
  consistent balance; Nationalist Spain's enemy chip selects its enemy; stats refresh after
  stepping; close. Screenshots `docs/evidence/1.31/`, viewed.
- **Plan change:** 1.31 split; 1.31b is the statistics ranking and war banners.
- Parity: row 60 → partial.

## 2026-10-02 — PLAN 1.31b: statistics ranking and war banners
- **Ranking** (`StatsRanking`, logic in `src/shared/ranking.ts`): top 15 by land, army, income,
  treasury or manpower, on the right; rows select nations; the bottom bar's Statistics button
  toggles it; metric and visibility persist.
- **War banners** (`WarBanners`): one per active war above the bottom bar (side leaders with
  colours, ally counts, a score bar); clicking selects the attacker leader; at most 8 + "+N".
- **Worker fix:** nation stats are throttled to 1 Hz, and while paused nothing pumped again, so
  a single step inside the window never reached the UI (the e2e caught it: the new war's
  banner never appeared). The server now reports `running` while a throttled derived message
  is owed and only flushes (no ticks) when paused; `ticking` keeps 'max' from busy-looping.
- **Tests:** `tests/unit/ranking.test.ts` (sort order, fields); `tests/unit/workerLabels.test.ts`
  (stats after init, throttled step flushed by pumping without advancing);
  `tests/e2e/ranking1938.spec.ts` (sorted by every metric, Soviet Union first by land, row
  selects, a declared war adds a banner that selects Germany, Statistics toggle).
- Evidence `docs/evidence/1.31/ui-shell.png` (viewed): nation panel, ranking, three banners,
  bottom bar. The first shot showed list numbering starting at "3."; rows now carry explicit
  ranks. Grey stripes at the map's polar edges when fully zoomed out logged in BLOCKERS.
- Parity: row 59 → partial.

## 2026-10-02 — Review pass after PLAN 1.30a–1.31b
- **Bug (from BLOCKERS):** fully zoomed out, the map is shorter than the viewport, and the
  off-map bands above and below it showed grey vertical stripes. The shader sampled clamped
  land coverage there, stretching the polar rows. Off-map rows are now sea. The new e2e
  (`coast1938.spec.ts`, "off-map rows…") samples both bands at minimum zoom; it fails on the old
  shader (grey 158,158,148) and passes now. A first version of the test sampled at a zoom the
  camera clamps away and proved nothing; probe screenshots found the real band.
- **Missing tests:** `tests/unit/mapModes.test.ts` covers every `modeColor` rule (alliances,
  puppets, wars, diplomacy relations, clamped income ramp) and checks every mode's legend and
  name keys exist in en.json.
- **SPEC drift:** the map-modes entry lists revolts and off-map sea; the duplicate "planned" list
  is now the four modes still to come.
- BLOCKERS: stripes entry removed (fixed). Evidence regenerated (`docs/evidence/1.31/ui-shell.png`
  no longer shows the stripes).

## 2026-10-02 — PLAN 1.32a: God Mode commands (1.32 split into a/b)
- **New commands:**
  - `renameNation`: state in `world.names`, saved as an optional `world.names` section; the
    worker shows '=' + name.
  - `spawnRevolt`: `forceRevolt`, shared with the monthly revolt pass.
  - `setIncomeBonus`: clamped to ±100.
- **God Kill** (`collapseNation`) is now a forced collapse (ADR-41). It used to be a silent
  default on calm nations.
- **`sim.inspect()`:** a new `inspect` request returns a JSON world summary (nations incl. dead,
  wars, alliances, buffs, majors, corridors, unrest, settings) for tests and the critic. The
  stats builder is shared with `nationStats`.
- **Bug found by the e2e:**
  - `nations.cells` was set at scenario creation and never maintained, so the 1.31 panel's land
    and the land ranking never moved.
  - `World.setOwner` now keeps it exact. A unit test checks it against a recount after 2 months
    of AI wars.
  - `spawnRebels` overwrote a multi-holder revival's count with the last holder's share; fixed.
- **Kept:** God revival still obeys the revival count/cooldown (PLAN 1.20 AT). The e2e revives
  Ethiopia, dead at the start.
- **AT** (`tests/e2e/godMode1938.spec.ts`), one e2e per command, effects read via
  `sim.inspect()`:
  - rename (also in the nation panel; '' restores);
  - war, peace, alliance;
  - Kill (Yugoslavia gone, ≥ 2 fragments holding its land);
  - spawn nation, spawn revolt (Warsaw's province; Poland loses exactly its cells);
  - spawn battle (corridor);
  - buff, AI per nation/global, income bonus.
- **Unit:** `tests/unit/godMode.test.ts`.
- **Parity:** rows 20, 33–36 and 38 updated.
- **Plan change:** 1.32 split; 1.32b is the God Mode UI.

## 2026-10-02 — PLAN 1.32b: God Mode UI
- **Bottom bar:** God Mode button (a nowrap fix keeps the bar on one line).
- **God tab** in the nation panel (`GodTab`): rename, income bonus ±10, nation/world AI, war/
  ally/puppet on a target, peace per war, buffs, revive a dead nation, Kill (two-click confirm,
  no dialog).
- **Map tools** (`hud.pick` via `MapView.onPick`; `cellAt`, `provinceAt` from the province
  raster): revolt (one shot), breakthrough (two clicks), territory brush (until toggled off). A
  tool click does not change the selection.
- **Immediate God actions:** `cmd` gains `now` (God UI only). The worker applies it between ticks
  (`Sim.applyNow`, stamped like the next step) and sends a snapshot and stats at once.
  - My first version applied every paused command at once. It broke I3: the worker e2e checks
    that a paused command is still pending at the mid-point, the same as in Node. Plain
    commands keep that.
  - Unit test: applyNow then stepping hashes equal to applying at the next step.
  - Stats skip their throttle for God clicks; labels keep theirs (an existing unit test pins
    it; a rename's label follows within 2 s).
- **Labels follow renames:** `world.namesVersion`, derived.
- **Stats:** gain `dead` nations and `aiEnabled`; `NationStat.alliance` gains `id`.
- **AT** (`tests/e2e/godUi1938.spec.ts`): every action driven through the UI, effects via
  `sim.inspect()`:
  - rename (also the curved map label);
  - bonus, AI switches;
  - war then peace (the row disappears at once);
  - ally, puppet, buff;
  - revolt by map click in Bavaria;
  - breakthrough by two clicks;
  - brush on Poland;
  - revive Ethiopia;
  - Kill Yugoslavia (the first click only arms);
  - God Mode off hides the tab.
- **Evidence:** `docs/evidence/1.32/god-tab.png`, viewed. The first shot showed the stale label,
  stale war row and wrapped bar fixed above.

## 2026-10-02 — PLAN 1.33a: take control of a nation (1.33 split into a/b)
- **`PlayerControl`** (`src/app/player.ts`): take/release control via `setAi` (now-commands).
  Map clicks via `MapView.onPick` (God tools first): own formation → select (Shift toggles);
  elsewhere with a selection → `moveFormation` per selected formation. Esc clears.
- **`MapView`:** keeps copies of snapshot formation ids/positions for `formationAt` (screen-space
  hit test, wrap-aware), `formationPos`, `formationsOf`; selection rings on the overlay.
- **UI:** Take/Release control button in the nation panel; "Playing X · N selected" in the bar.
- **AT** (`tests/e2e/player1938.spec.ts`):
  - take control of Poland (AI off via inspect);
  - a real click selects a formation, a real click 10 cells west orders it;
  - after 2 days it is > 2 cells closer and the other Polish formations have not moved;
  - Esc clears; release turns the AI back on.
  - Evidence `docs/evidence/1.33/`, viewed.
- **Flake:** the first gate run timed out once in `camera.spec.ts` beforeEach (toy map's first
  frame > 30 s while 1938 suites ran in parallel). It passed alone (7 s) and in a full rerun.
  Watching it; if it recurs, give that beforeEach a budget like the 1938 suites.
- **Plan change:** 1.33 split; 1.33b is player diplomacy + production.

## 2026-10-02 — PLAN 1.33b: player diplomacy and production
- **Commands:**
  - `offerPeace` (`war.ts`): accepted when the offering side leads by ≥ PEACE_ACCEPT_SCORE 25
    or the other side's exhaustion is > 40; never against fight-to-death; otherwise the event
    `PeaceRejected`.
  - `proposeAlliance` (`alliances.ts`): accepted when the target is unallied, not a puppet and
    at peace with the proposer; the target joins the proposer's alliance or they found a
    defensive pact; otherwise the event `AllianceRejected`.
- **Worker:** `mapLayers.templates` (name, gold, manpower, days, men per template);
  `NationStat.queue`.
- **UI:** Actions tab for the controlled nation only: target picker, Declare war, Propose
  alliance, Offer peace per war (with my score), Build per template (disabled when
  unaffordable), training queue with days left.
- **Tests:**
  - Unit (`tests/unit/godMode.test.ts`): refused at an even score, accepted when leading, never
    against fight-to-death; alliance accepted by Switzerland, refused by an enemy.
  - e2e (`tests/e2e/playerActions1938.spec.ts`), as Poland:
    - build: gold drops by the cost, a queue row "ready in 90 days", then one more formation;
    - war on Lithuania; a peace offer at an even score is refused;
    - an alliance with an unallied nation is accepted. The partner is picked at that moment:
      the first version used Switzerland, which the AI had allied with someone else while the
      build's days ran.
- **Evidence:** `docs/evidence/1.33/player-actions.png`, viewed.
- **Known gaps:** every template is offered to every nation (no national template lists); the
  Actions list is long and scrolls.

## 2026-10-02 — Review pass after PLAN 1.32a–1.33b
- **Bug:** player control lived only in the UI, while its AI-off flag was sim state. After a load
  or a resumed autosave, the nation stayed AI-less with nobody controlling it.
  - The controlled nation is now sim state: `setPlayer` command, `settings.player` saved in
    `world.meta` (older saves default to 0).
  - Switching players restores the previous nation's AI. `PlayerControl` follows
    `nationStats.player`.
  - Tests: unit (switch, save/load, release). The player e2e now reloads the page with
    `?continue=1` from the autosave and still controls Poland.
- **Perf check:** building and serialising `nationStats` on the 1938 world (2 months in) costs
  0.16 ms median and ~42 KB, once a second. No action.
- **Flake from 1.33a:** `camera.spec.ts` beforeEach gets a 90 s budget (60 s for the first
  frame) like the 1938 suites; assertions unchanged.
- **SPEC drift:** §2.3 lists `cmd now`, `inspect`, `nationStats`, `provinceStats` and the
  `mapLayers` province/templates fields.
- **Dead code:** none left from the God tab iterations (checked).

## 2026-10-02 — PLAN 1.34a: history log with filters and export (1.34 split into a/b)
- **Sim:** `History` (`src/sim/history.ts`) is a new world part, saved as `history.rows`; older
  saves start empty. `TickOutputs.emit` records every event of a `HISTORY_KINDS` kind (18
  kinds). Emission is deterministic, so the log replays identically.
- **Worker:** a `history` request returns `HistoryRow[]` with a/b names resolved by role
  (`src/shared/history.ts`: roles, kind names).
- **Shared logic:** `filterHistory` (kind; nation in nation roles only; year range), `isoDate`,
  `toExport`, `toCsv` (RFC 4180).
- **UI:** `HistoryPanel` (bottom-bar History button): newest 400 shown, type/nation/year
  filters, a count, Export CSV/JSON of the filtered rows. Each kind has its own sentence
  (i18n `history.<Kind>`).
- **AT** (`tests/e2e/history1938.spec.ts`): a God war plus 2 AI months.
  - The type filter leaves only war declarations, as many as in the log; nation + type
    narrows further; a 1950+ year range empties the list.
  - The downloaded CSV (header, row count, first row's date/tick/type/a) and JSON (every
    record matches the filtered rows; "Germany declared war on Poland") are validated.
- **Unit tests:** `tests/unit/history.test.ts` (state, save/load replay, filters, CSV quoting).
- **Sim bug found in the evidence log:** "Poland joined Anti-Comintern Pact" while at war with
  Germany. The AI's threat-alliance join checked only for the threat, not for members it
  fought.
  - New `canJoin` / `noWarAmong` (`systems/alliances.ts`), used by AI joins, coalition joins
    and creation, God join/create, and player proposals.
  - The 10-year AI sweeps now assert, at every year end, that no two allies are at war. Seed
    1 failed in year 0 without the fix; all three pass with it.
- **Parity:** row 61 → partial.
- **Plan change:** 1.34 split; 1.34b is statistics series + charts.

## 2026-10-02 — PLAN 1.34b: statistics series and charts
- **Sim:** `StatSeries` (`src/sim/stats.ts`) is a new world part. `statsSystem` runs last in
  the tick and samples every living nation at each month start: land, income, gold, men,
  casualties. Saved as f32, with values f32-rounded in memory too, so load equals memory
  exactly.
- **Casualties:** new nation column `casualties`, counted in `settleFormation` and in the bare
  `bleedFormation` path. Disbanding is not counted.
- **Worker:** `stats` request returns raw f32 bytes; `SimClient.statSeries()`.
- **Shared:** `seriesOf`, `topNations` (`src/shared/statSeries.ts`).
- **UI:** `StatsChart` (Charts button in the ranking): metric picker (land, income, treasury,
  army, casualties), SVG lines in the nations' colours for the top 5 at the latest sample plus
  the selected nation (thicker), legend, month-year axis labels; an empty note before the
  first sample.
- **AT:**
  - Unit (`tests/unit/stats.test.ts`): every month start of a 92-day run with a God
    Germany–Poland war holds one sample per living nation equal to the sim at that tick;
    casualties > 0 and non-decreasing; save/load exact and replay identical; helpers.
  - e2e (`tests/e2e/charts1938.spec.ts`): empty before a month; after 92 days, 6 lines (top 5
    by land = the worker rows' top 5, plus Poland highlighted), 4 points each (1 Jan to 1 Apr);
    every metric renders.
  - My first expectation of 3 points forgot the 1 January sample.
- **Evidence:** `docs/evidence/1.34/charts.png`, viewed. Both axis labels read "1938" on short
  runs, so they now show month and year.

## 2026-10-02 — PLAN 1.35: editor (brush, line, bucket, undo/redo, target mask)
- **Sim** (`src/sim/editor.ts`, ADR-42):
  - Commands `editPaint` (nation or terrain layer; brush, line, bucket; radius; mask by terrain
    or nation), `editUndo` and `editRedo`.
  - The `EditStack` (diffs, ≤ 50 edits / 2 M cells) is a saved world part.
  - Land cells only (terrain land ↔ land; water ↔ land waits for 1.37). Terrain edits drop
    nav/paths/frontier and bump `terrainVersion`; the worker resends `terrainLayer`.
- **Inspect / stats:** `inspect()` gains `rasters` (xxhash of owner/controller/terrain) and stack
  depths; `nationStats.edits`.
- **UI:** `EditorPanel` (bottom-bar Editor): tools, radius, layer and value, mask, Undo/Redo with
  counts, hints. Map clicks paint (editor first, then God tools, then player). Ctrl+Z,
  Ctrl+Y / Ctrl+Shift+Z.
- **AT:**
  - Unit (`tests/unit/editor.test.ts`): shapes (disc, wrap, clip, line, bucket over connected
    Polish land); paint/undo/redo restore exact rasters and a new edit clears redo; the mask
    limits the paint; terrain edits invalidate nav; depth cap; save/load keeps the stack and
    undo after load replays.
  - e2e (`tests/e2e/editor1938.spec.ts`): a click paints Germany into Poland. Ctrl+Z, Ctrl+Y and
    the buttons return identical owner/controller/terrain hashes. A two-click line, then a
    plains-masked bucket erase of Polish land; terrain mountains plus four undos restore the
    start.
  - The first bucket assertion assumed Poland was one connected piece; 5 cells lie apart.
- **Evidence:** `docs/evidence/1.35/editor.png`, viewed.
- **Parity:** rows 40–42 → partial.

## 2026-10-02 — PLAN 1.36: scenario editor (cities, capital, gold, cores and preset revolts, annex)
- **Sim** (`src/sim/scenarioEdit.ts`, `systems/puppets.ts`):
  - Commands `spawnCity` (economy bonus stored on the city row and removed exactly),
    `removeCity`, `setCapital`, `setGold` and `setCore` (core or claim on; off removes both).
  - `annexNation`: shares `annexInto` with puppet integration; passes puppets; `NationAnnexed`
    is in the history.
  - `world.cityNames` is saved in the names section; PLAN 1.32 saves' bare arrays still load.
- **Worker:** city list with editor names (map layer, `cityLayer` resend, history, inspect);
  `inspect` gains `cities` and `cores`.
- **UI:** the editor panel's Scenario section (place city with name and size, remove city, make
  capital, add/remove core, gold, annex). Dead nations are listed in the editor's nation
  pickers (preset revolts). `MapView.cityNear`.
- **Bugs found by the unit tests:** the city economy bonus was truncated by the u32 economy
  layer, so removal took back more than was added (the added amount is now stored). Removing a
  core left a matching claim behind.
- **AT** (`tests/e2e/scenarioEditor1938.spec.ts`): a mini scenario through the UI.
  - Steps: place "Nowe Miasto" and make it Poland's capital, set gold, preset Ethiopia's revolt
    with a core near Kraków, remove Breslau, annex Austria into Germany (the map shows Vienna
    German and the label goes), Sweden–Norway alliance and Lithuania as Hungary's puppet (God
    tab).
  - Then autosave, reload with `?continue=1` and verify all of it: equal rasters, cities and
    cores; the city layer has the new city and not Breslau.
- **Unit tests:** `tests/unit/scenarioEdit.test.ts`. `tests/unit/server.test.ts` adds: a paused
  now-command during an unacked snapshot is drawn right after the ack.
- **Misdiagnosis:** I read one evidence shot as showing Austria still drawn after the annexation
  and blamed an owed-snapshot race. The worker already sends after every message, the shot was
  overwritten before I could recheck, and the new e2e and unit assertions pass with or without
  my change. So I reverted the change and kept the assertions.
- **Parity:** rows 43–46 → partial.

## 2026-10-02 — Review pass after PLAN 1.34a–1.36
- **Bug:** `NationAnnexed` joined the history kinds without its sentence and type name (the log
  would show a raw key). Added; a new unit test requires roles and both i18n keys for every
  `HISTORY_KINDS` kind.
- **Save size:** the undo cap was 2 M cells (up to ~20 MB of diffs in a save); it is now 500 k.
  A 1-year 1938 save with history (109 rows) and stats (1,207 rows) is 818 KB gzipped, against
  807 KB before both: +1%. (The sweep stage did not refresh `docs/evidence/1.27/save-1939.json`,
  so I measured directly.)
- **UX:** the editor, charts and history panels share the top centre and overlapped; opening one
  now closes the others (the charts e2e checks it).
- **SPEC drift:** §2.3 lists `history`, `stats`, `terrainLayer` and `cityLayer`; §2.5's
  implemented order ends with statistics sampling, and history is recorded on emit.

## 2026-10-03 — PLAN 1.37a: map import (1.37 split into a/b)
- **Shared** (`src/shared/mapImport.ts`): `paletteMap` (nearest-neighbour resample to the map,
  nearest palette colour within a distance, else a fallback), `encodeRuns` / `decodeRuns`.
- **Sim** (`editor.ts`):
  - Command `importLayer {layer, runs}`. Terrain may go water ↔ land; owners on new water are
    cleared in a linked edit. `Edit.linked`: undo/redo take linked edits together, saves keep
    the flag, and the cap never splits a group.
  - The cap never evicts the two newest groups (a terrain import followed by a nation import
    stays undoable).
- **Worker/renderer:** `terrainLayer.landChanged` against the initial land mask. `MapRenderer`
  `useLand(false)` and `uHasTerrain`: without the fine coastline, water comes from the terrain
  layer (unowned land stays land); the toy map keeps the controller rule.
- **UI:** the editor's Import section (layer + file input); `src/app/importImage.ts` decodes
  with `createImageBitmap` and an OffscreenCanvas.
- **AT:** a 64×32 fixture is generated at test time (`tests/helpers/importFixture.ts`, PNG via
  `tools/data/png.ts`): each pixel is exactly 32×32 cells.
  - Unit: exact terrain counts, fallback, runs, linked undo/redo, save/load.
  - e2e: real file-input uploads give exact water/plains/forest/mountains counts and exactly
    32,768 cells each for Germany and Poland. The fine coastline goes, and two undos restore
    the starting rasters and the coastline.
- **Along the way:**
  - My first unit run hung: the import was evicted from the undo stack (hence the
    two-group rule), and `toEqual` on two unequal 2 M-cell arrays built a diff for minutes. The
    test now compares hashes. Its stopped vitest worker kept running and slowed the next gates,
    so I killed it (PID 132272, WarSim's own).
  - Another project's Vite dev server (not ours, left running) held ~2.5 cores. E2E polls after
    UI commands missed the 5 s window run after run while passing alone. `inspect` heavy parts
    (cities, cores, unrest, ~600 KB) are now opt-in (`inspect(true)`), and the Playwright
    expect timeout is 15 s (assertions unchanged).
  - Real bug: with focus on a dropdown, editor Ctrl+Z/Ctrl+Y were ignored. The shortcut now
    skips text fields only. The editor e2e focuses the dropdown first; it fails on the old
    handler and passes now.
  - The editor e2e's line clicks now go below the editor panel's measured bottom: the Import
    section made the panel taller.
- **Evidence:** `docs/evidence/1.37/imported.png`, viewed. Known gap (BLOCKERS): cities and
  formations stay on new water.
- **Parity:** row 47 → partial.

## 2026-10-03 — PLAN 1.37b: flag editor with presets; flags on the map
- **Shared** (`flagPixels.ts`): 36×24 `specToPixels` (stretched to 3:2), `plainFlag`, 11 editor
  presets (`presetSpec`), `fillFlag`; `decodeRunsU32`.
- **Sim:** command `setFlag {nation, runs}` (empty runs restore). `world.flags` is saved in the
  names section; `flagsVersion` is derived.
- **Worker:** `flags` message after init/load and on change. Init now also resets the
  terrain/city/flag send markers.
- **App:**
  - `FlagStore`: custom, else the 1938 FlagSpec, else plain colour; canvases and data URLs.
  - `MapView` keeps capitals from snapshots and draws flags there from 3 px per cell
    (`flagRects` for tests).
  - The nation panel shows the flag. `FlagEditor` lives in the editor panel for the chosen
    nation.
- **UX fix:** the editor panel grew tall enough to cover the map centre; the scenario-editor e2e
  "lost" its city click to it. The panel now docks right (hiding the ranking while open).
- **AT:**
  - Unit (`tests/unit/flagPixels.test.ts`): German stripes, every preset, the vertical
    tricolour's columns, bucket fill, custom flags saved/loaded/reset, bad runs ignored.
  - e2e (`tests/e2e/flags1938.spec.ts`): Poland's flag at Warsaw on the map is first
    white/red. A preset tricolour plus one blue pencil pixel is saved through the UI, and the
    overlay pixels at Warsaw are green/white/red with the blue pixel; the panel image matches;
    restore brings the scenario flag back.
  - My first test version raced: after the restore it polled a pixel that is white in both
    flags.
- **Evidence:** `docs/evidence/1.37/flag-editor.png`, viewed.
- **Parity:** row 48 → partial.

## 2026-10-03 — PLAN 1.38: shareable scenario files
- **Sim:** `Sim.exportScenario()` returns the state without run history (command log, pending,
  history log, stats, undo stack) and its hash, then restores the running game.
- **Worker/client:** `exportScenario` request; replies may carry `scenarioHash`.
- **Shared:** `scenarioFile.ts`: magic, JSON header (format 1, name, base, w, h, tick, hash), the
  state bytes, gzip; readable errors for other files and future formats.
- **App:** `scenarioFiles.ts`: export to a download named from the scenario; import validates
  base, size and state hash. The editor's "Scenario file" section has a name, Export and Load,
  and a status line (errors are shown, not swallowed).
- **AT:**
  - Unit: export leaves the running game intact; the scenario has no run history yet keeps the
    world (rename, war, tick); the file round trip and a load in a fresh sim give the
    identical hash; bad files are rejected.
  - e2e (`tests/e2e/scenarioFile1938.spec.ts`): edit (rename, war, paint), play a month, export
    through the UI, open a fresh game, load the file through the input. Equal state hash,
    tick and rasters; the edits are there with an empty history. A damaged file and a non-file
    are refused with messages.
- **Bug found by the e2e:** the client dropped extra reply fields (`scenarioHash`), so the
  export failed silently. Fixed, and export errors now reach the status line.
- **Parity:** row 49 → partial.

## 2026-10-03 — PLAN 1.39a: settings panel (1.39 split into a/b)
- **`Settings`** (`src/app/settings.ts`), persisted:
  - interface size 85/100/115/130% (root font size; the UI is in rem);
  - unit size 50–200%, a new `uSizeMul` in the formation marker shader (`MapView.unitScale`).
- **Screenshot:** `captureMap` draws, then composes the WebGL map with the label/flag overlays into
  a PNG named by the in-game date (`warsim-1938-01-01.png`). F2 or the panel button. F2 rather
  than AoC's F11, which browsers reserve for fullscreen.
- **`SettingsPanel`** (bottom-bar Settings; exclusive with the other centre panels): sizes,
  screenshot, the current seed, seed input + Random + New game (`?scenario=…&seed=…`).
  `inspect` gains `seed`.
- **AT** (`tests/e2e/settings1938.spec.ts`):
  - UI 130% → root 20.8 px and a ≥ 1.2× taller bar;
  - unit size: the screen around a Polish formation is unchanged at the same setting and
    differs at 50% vs 200%;
  - F2 → a PNG whose header size equals the canvas, and the button downloads one too;
  - speed level, UI and unit sizes survive a reload;
  - New game with seed 4242 → `inspect().seed` is 4242. The test resets the sizes afterwards.
- **Parity:** rows 66, 67 and 71 → partial (appended).
- **Plan change:** 1.39b is the new-game options (looping map, map size, randomisation).

## 2026-10-03 — Review pass after PLAN 1.37a–1.39a
- **Perf:** every worker reply computed the full state hash (12 ms on the 1938 map), including
  `inspect`, `history` and `stats`, which tests poll constantly. Those read-only replies now
  skip it and report `status.hash` NaN. Hash, step, save, load, init and exportScenario still
  hash.
- **SPEC drift:** §2.3 lists `inspect {full}` and its fields, `exportScenario`,
  `terrainLayer.landChanged` and `flags`.
- **Process slip found and fixed in 1.37b:** parity row updates had overwritten evidence and
  baseline markers. Restored; updates now append (also in this pass's rows).
- **Still open (BLOCKERS):** imports leave cities and formations on new water (decide in 1.41).
  The e2e stage's length depends on machine load.

## 2026-10-03 — PLAN 1.39b1: new-game options (1.39b split into b1/b2)
- **Sim:** `applyGameOptions` (`src/sim/gameOptions.ts`), applied at init from `SimInit.options`
  and hashed from the seed:
  - looping map (`settings.loopingMap`, saved in meta; replaces the hardcoded `true` wraps in
    nav, territory, war and the operational AI);
  - random aggression;
  - random traits (multipliers + aggression bias);
  - gold random/equal;
  - CE mode.
- **App:** `optionsFromUrl` / `newGameUrl`; the map geometry's wrap follows the option
  (`MapView.wrapsX`). The settings panel's "New game options" starts from the current game's
  options. New games start paused.
- **`NationStat`:** gains `aggression`, `incomeMult`; `Inspection.settings` gains `loopingMap`.
- **Bugs found by the tests:**
  - The scenario build caches a wrapping nav grid before the options apply. Turning looping off
    now drops it.
  - The new-game URL dropped `paused`, so the economy ran before the e2e could look. New games
    start paused now (also better: you see the new world first).
- **AT:**
  - Unit: per-seed determinism and distinct seeds, ranges and effects, no-wrap nav, save/load +
    replay.
  - e2e: all options chosen in the panel → URL params, seed kept, and in the sim: no looping,
    static CE, equal gold, aggression and income multipliers differ from the plain game on >10
    nations, no wrap rendering. Switching back restores the scenario's values.
- **Parity:** rows 69 and 75 → partial (appended).
- **Plan change:** 1.39b2 is map size S–XL (needs L/XL assets and per-game geometry).

## 2026-10-03 — PLAN 1.39b2: map sizes deferred to 7.1b (ADR-43)
- **Audit:** the sim is tuned in cells for the M map: AI sector/deploy, combat
  contact/buckets, battle radii, corridor, spawn and snap reaches, militia density, territory
  pressure radius and cell-by-cell flips. Movement is km-based; `kmPerCell` exists but is
  unused.
- **Costs:** L/XL terrain isn't shipped (ADR-13). The tick is already over budget at M.
- **Decision (ADR-43):** M only in Phase 1. Map sizes become PLAN 7.1b, after the performance
  pass, with the audit list as its starting point.
- PLAN, SPEC and PARITY row 70 updated. No code change in this iteration.

## 2026-10-03 — PLAN 1.40: dynamism tuning; 10 seeds × 50 years all green
- **Tool:** `npm run sweep` (`tools/sweep/run.ts`, `seed.ts`, `criteria.ts`): parallel child
  processes, daily war sampling, yearly metrics; report `docs/sweeps/2026-10-03-sweep.{md,json}`.
  Unit tests for the criteria.
- **First sweep failed:** 300–600 nations by year 50 on every seed; two seeds with frozen fronts.
- **Diagnosis** by ledgers and per-war dumps:
  - revolts outpaced deaths;
  - half the revolts started in peace;
  - losing rebels survived as rumps or puppets;
  - conquered land never became core;
  - fight-to-death spread to whole alliance blocs (18-year wars at exhaustion 100/100);
  - the year-8 burst of land changes is the colonial puppets' integration, which is legitimate.
- **Changes (ADR-44),** each measured by 10 × 20-year sweeps:
  - revolts are always wars;
  - decisive peace annexes small losing leaders;
  - coring after 10 years;
  - garrison effect (SPEC §4);
  - fight-to-death only from the leader;
  - 1938 revolts by region (new scenario setting `revoltMode`; toy keeps "province").
- **Result:** all 10 seeds green over 50 years. Nations 97–231, largest land 24–27%, largest
  income 28–29%, land moving 1.1–6.7% in the last 5 years, wars every year. 16.8 min with 10
  processes.
- **Kept, not weakened:**
  - I tried making fight-to-death sides surrender when crushed. It contradicted PLAN 1.16's AT
    ("never accepts peace, however crushed"), so I reverted it.
  - Two existing tests had setups tied to the old behaviour; their assertions are unchanged:
    - the bankruptcy-collapse test now sets `revoltMode: 'province'`, which it was written for;
    - the unrest-buff test picks an ungarrisoned core province (province 200 now has a
      garrison).
- **Logged (BLOCKERS):** most scenario settings in `scenario.json` aren't applied by the code.

## 2026-10-03 — PLAN 1.41: Phase 1 review
- **Scenario settings applied** (BLOCKERS item): `createWorld1938` now reads combat efficiency,
  winner-takes-all, looping map, AI, revolt mode and the revival count from `scenario.json`.
  - The file's revival block (3 / 1,825 days) never matched the code's tuned values (2 /
    730 days); corrected to the code's values.
  - A unit test pins the world's settings, revival count and cooldown to the file.
  - The applied values equal the previous defaults, so the 1.40 sweep result stands.
- **Map import and water** (BLOCKERS item): city cells keep their land (islands, so undo stays
  consistent). Formations left on water move to the nearest land within 64 cells, or are
  removed.
  - The 1.37a import tests now expect exact counts including the city islands
    (`importedCounts`), still exact.
  - An all-water import test checks cities and formations stay on land.
- **Parity:** nine implemented features were still "not started": rows 2, 12, 28, 31, 32, 65, 72,
  74, 77. They are now partial, with evidence appended. Parity 40.6% → 46.3%; 6 rows remain
  "not started": donations, God nuke, map-mode hotkeys, event popups, map sizes (7.1b), audio.
- **Gate:** green (391 unit, 7 sweep, 57 e2e). BLOCKERS: both review items closed.
- **Phase 1 complete.** Next: Phase 2 (semantic zoom).

## 2026-10-03 — PLAN 2.1: T1 operational markers
- **Snapshot:** per formation `template`, `flags` (moving, engaged) and `target`; `majors`
  positions. Templates carry a marker `symbol` (infantry, armour, motorised, cavalry,
  mountain, garrison) from their elements.
- **Render** (`src/render/units/markers.ts`): Canvas2D boxes in the nation's own colour, a NATO-style
  symbol, a flag chip (FlagStore), a strength bar and number, dashed order arrows, a red outline
  while engaged, crossed swords at Major Battles.
  - Opacity `markerAlpha(m/px)`: full in 300–2000 m/px with 30% smooth fades.
  - The T0 sprites stop when markers are fully in.
  - Capital flags draw above the markers. The flag e2e caught markers covering Warsaw's flag.
- **Inspect** (full): per formation strength and the men summed independently over its elements.
- **AT** (`tests/e2e/markers1938.spec.ts`):
  - none at T0, more than 20 at T1 over Poland;
  - for every drawn marker the formation's strength equals its element sum and the label equals
    `strengthText(elementMen)`, also on the Spanish front after two weeks of fighting;
  - a move order produces an arrow;
  - none at T2.
- **Unit:** fade and text formatting. Evidence `docs/evidence/2.1/`, viewed: Poland with an order
  arrow; Spain with engaged outlines and many arrows. Markers stack where units cluster; T0
  clustering is PLAN 2.2.

## 2026-10-03 — PLAN 2.2: T0 counters with stable clustering and split/merge animation
- **Counters** (`src/render/units/counters.ts`, ADR-45): per nation per cell of a world-aligned
  2^L grid, sized to ~64 px with ±0.15 hysteresis.
  - Each counter shows a flag chip and Σ strength. Parents equal the union of their children
    (unit test).
  - A level change animates the finer level's counters from or to their parent centroid over
    250 ms.
  - T0↔T1 cross-fades with the markers. The unit-size setting scales counters and markers.
- **AT** (`tests/e2e/counters1938.spec.ts`):
  - with the whole world in view, Σ drawn counters equals Σ formation strength;
  - a scripted zoom of 30 km/px → 700 m/px → 30 km/px (3% per 16 ms frame, ≥ 8 level changes)
    records every counter and marker per frame;
  - every item continues under its key or is replaced in place, and opacity steps are ≤ 0.3, in
    both directions.
  - With the animation disabled (mutation) the check fails, so it detects popping.
- **Gate fixes:**
  - The settings e2e reads map + overlay, since units moved to the overlay. It also waits for the
    camera-jump animation to finish before "same setting, same picture". That was a real race:
    the test drew mid-animation.
  - The gate failed three times on the editor e2e. One `inspect` took 19 s, because the counter
    recording software-rendered the map for 250 frames and starved the parallel workers. The
    recording now draws only the unit layers.
- Formation sprites now draw only below T1, until element sprites (2.3).
- Evidence `docs/evidence/2.2/`, viewed: the world with counters, and Europe at 12 km, 4 km and
  2.3 km/px.

## 2026-10-03 — PLAN 2.3: interest-managed element snapshots and T2 element sprites
- **Snapshot `elements`** (ADR-46): the elements of the formations inside the subscribed bbox,
  only when the subscription wants elements at tier ≥ 1.5, capped at 40k.
  - Each has id, formation, nation, atlas frame, strength, current and previous slot pose,
    facing and flags.
  - An empty section takes no pooled buffers. The first version took 11 per snapshot, which
    the pool-stability unit test caught.
- **View:** subscribes from the frame loop (padded bbox, `tierOf`, ≤ 10 Hz, only on change).
  Element sprites use a second ProxyRenderer, fade in as the markers fade out, and are tinted
  lighter for contrast.
  - Proxy shader: `uTime` and a procedural walk/drive animation (`frame + 0.5` = moving), plus a
    layer `uAlpha`.
- **AT:**
  - Bench B (real GPU, every proxy animated): 10k at 2,562 fps, 30k at 1,923 fps, against a
    30 fps bar.
  - I4: new e2e with 1938 subscription churn at tiers 1–3 with elements while stepping 240
    ticks gives the Node hash. The toy I4 tests also pass.
  - `tests/e2e/elements1938.spec.ts`: no elements at T1. At T2 over Warsaw the set of formations
    equals those inside the bbox, each with all its elements, each element within 0.18 cells of
    its formation. Back at T1, none.
- **Evidence:** `docs/evidence/2.3/` (Warsaw at 120 and 40 m/px), viewed. Infantry blocks stand
  by their formations.
- A unit timing budget (`territory.test.ts`) exceeded 25 ms once under load and passed alone and
  on the rerun gate.
- **The user asked to stop the loop after this task.**

## 2026-10-03 — Critic B1 (static world), part 1: wars resolve, armies recover, empires strain
- **Loop restarted by the user.** Gate green at the start. The critic report (bb1dd4f) was 1 commit
  old with 7 blocking issues, so this iteration took B1, the highest (PROMPT step 2b).
- **Diagnosis** (seed 99, state dumps at years 4, 9, 14; a scripted Germany–Poland war):
  - Fight-to-the-death wars ran forever (Japan–China 14 years at exhaustion 100/100).
  - The score divided by the victim's land, so nothing taken from a large nation beat a white
    peace.
  - Targets counted their whole alliance in full, attackers nobody: no attack had utility.
  - One production order at a time: ~36 divisions a year worldwide. Germany sat on 238k gold
    with 135k men; the USA on 860k gold with 24k men.
  - After a peace, the winner's formations stood on returned land out of supply and starved.
  - New formations appeared at the capital: Japan's never reached China.
- **Changes (ADR-47):** relative war score; capitulation at 75% occupied; 5-year deadlock end;
  capital bonus cap; 40% ally weight on both sides; parallel production; peace army cap by
  aggression; repatriation; overseas muster; revolts defect to the living core nation or join a
  neighbouring rebel state; overextension unrest for nations above 4% of the land.
- **Bug found by the gate:** allies could be pulled onto opposite war sides through puppets
  (`aiSweep1` invariant). Fixed in `declareWar`, with a unit test.
- **Sweep criteria:** two added before any run with them (≥ 2 new in the top ten by land;
  leader share range ≥ 3 points). `npm run sweep` takes `--tag` so a report does not overwrite
  the day's earlier one.
- **Result, seeds 101–110 (never used for tuning), final code:** 9 of 10 green. Seed 109 fails
  the leader-share range (2.7 points). Land moving 3.6–15.9%, nations 95–146. Report:
  `docs/sweeps/2026-10-03-sweep-b1.md` (marked FAILING). **B1 is not closed**: PLAN 1.42.
- **Tuning notes:** overextension at 3 and at 2 unrest a month broke the Soviet Union to a
  quarter of its land within 5 years; with a plain at-war term Canada collapsed over a phoney
  war with Newfoundland. Now 1.25, and the war term needs exhaustion ≥ 60.
- **Performance got worse:** year-1 tick mean 4.6–5.9 ms on seed 99 (was 2.4), 5-year mean
  2.5 ms (was ~1.5). The sweep takes 36 min (was 17). Profile: supply reflood 20%, pathfinding
  23%, combat 13%. Budget 1.5 ms (PLAN 7.1); the critic's N2 will get worse until then.
- **Tests:** 10 new unit tests (score, capitulation, deadlock, capital cap, ally sides, parallel
  orders, overseas muster, defection, overextension, repatriation). Two existing tests now switch
  the AI off to isolate their mechanism (assertions unchanged). Gate green (407 unit, 7 sweep,
  61 e2e).
- **Not verified in the browser:** no screenshots this iteration; the changes are sim rules and
  the evidence is the sweep and the tests.
- **Next for B1:** seed 109's leader (the Soviet Union) keeps ~25–27%: check why it affords
  suppression through its wars. Japan and Britain still cannot move armies overseas (PLAN 4.5).
- `critic/` is still untracked (30 MB of screenshots); left as found.

## 2026-10-03 — Shorter iterations (user request, ADR-48)
- The user stopped the loop, asked why the iteration took three hours, and asked for all the
  proposed remedies.
- **Gate:** `npm run check` skips the 10-year sweep tests when no sim input changed since HEAD;
  `npm run check:full` always runs them.
- **Tools:** `npm run sim -- --save / --load` (checkpoints; unit-tested on the toy world),
  `npm run diag` (wars and great-power dumps, from 1938 or a checkpoint), `npm run sweep:quick`
  (3 × 20, report in `.cache/`).
- **Rules:** PROMPT.md has a new section "KEEPING ITERATIONS SHORT"; CLAUDE.md lists the commands.
- **PLAN:** 1.42a (tick time ≤ 1.5 ms mean over 5 years, seed 99) now comes before 1.42.
- No sim rule changed in this commit.

## 2026-10-03 — Parity-only gate for document commits; critic count restarts on remediation (user request, ADR-49)
- **Gate:** `npm run check` is now `tools/gate/check.ts`. Documents only (Markdown, `docs/`) →
  parity. Code → everything, with the 10-year sweep tests only when a sim input changed.
  `npm run check:full` runs every stage.
- **Critic:** PROMPT step 2a counts its 5 commits from the last commit whose subject starts with
  "Critic " (a remediation commit), not from the report. `npm run critic:due` reports the state.
  Name every commit that fixes a critic finding "Critic <id>: ...".
- State now: the report is at bb1dd4f; the last remediation commit is f6d2381 ("Critic B1 part
  1"); PLAN 1.42a and 1.42 are both critic remediation and should be named so.


## 2026-10-03 — PLAN 1.42a: tick time back under budget, with no change in behaviour
- **Start:** gate green; critic not due (2 commits since the last remediation commit).
- **Baseline today** (seed 99, 5 years, `npm run sim`): mean 1.59 ms, year 1 2.74 ms, final hash
  5d08e5dd. (The 4.6–5.9 ms logged after ADR-47 was measured with other work running.)
- **Profile of year 1** (per system, then `node --cpu-prof` on an unminified esbuild bundle, which
  gives usable line numbers; under tsx every function reports line 1): operational AI 0.89 ms
  (all of it `findPath` for its orders), combat 0.66, supply 0.57, territory 0.38, wars 0.13.
- **Changes, each checked against the yearly hashes (all five identical to the baseline):**
  - *Pathfinding:* the open list is a typed-array heap reused across searches (the old one kept
    three `number[]` and swapped by destructuring); steps, diagonal km per row (`NavGrid.kd`) and
    the bound to the goal are inlined. Same pop order, same routes. 0.89 → 0.54 ms.
  - *Supply:* the flood fills row spans instead of visiting cells one by one, and each bloc's
    spans are kept, so a partial refresh no longer scans 2 M cells to clear a bloc. A full
    refresh 9.2 → 5.7 ms; the system 0.57 → 0.29 ms.
  - *Territory:* the frontier rebuild inlines its neighbour test and skips nations at peace; the
    pressure loop tests a byte mask instead of `Set.has` (12,500 lookups a tick). 0.38 → 0.19 ms.
  - *Wars:* the daily land count adds runs of occupied cells to its map once per run (small).
- **Result (AT):** 5-year mean **1.04 ms** (≤ 1.5), year 1 **1.92 ms** (≤ 2.4), final hash
  **5d08e5dd**. 5 years take 46 s of wall time instead of 70 s.
- **Tests:** 2 new and 1 extended. The span flood equals a cell-by-cell reference of the rule, for
  a full refresh and for a partial one (pocket, ring, cells across the date line). Cell A* gives
  the same route and cost as a plain open list popped by (f, insertion order) on 20 random
  grids. The frontier rebuild equals its definition and the mask equals the set, also after flips.
- **Found, not fixed:** cell A* is not exactly optimal. My first version of the A* test compared
  it with Dijkstra and failed by 0.1% on a 16-row grid: the bound uses the narrower of the two
  rows' cells, but a route may pass through narrower rows still. SPEC said "admissible"; it now
  says what is true. On the watch list in BLOCKERS.
- **What is left in year 1:** combat 0.67 ms (target tables per formation and unit type are
  rebuilt most hours; slot poses and fire events per volley), long AI marches 0.54 ms, supply
  0.29 ms. PLAN 7.1 owns the rest of the budget.
- **Not verified in the browser:** nothing visible changed; the e2e stage of the gate ran.
- **Gate:** green (420 unit, 7 sweep, 61 e2e).
- **Next:** PLAN 1.42 (seed 109's leader-share range), then Phase 2.4.

## 2026-10-03 — PLAN 1.42b (critic B1): partners fight on each other's fronts (ADR-50)
- **Start:** gate green, critic not due. PLAN 1.42 split into 1.42b, 1.42c and the final sweep.
- **Diagnosis of seed 109** (`npm run diag`, checkpoint at year 25 in `.cache/ck/`): the Soviet
  Union keeps 27% of the land with 78k men (792k in year 3). A coalition of 28 has been at war
  with it for 557 days, Japan for 317, both at score 0.
  - *Cause 1 (fixed here):* only the armies of the nation holding a front count on it. Belgium,
    Britain or Japan (behind Manchukuo) contribute nothing to a war against the Soviet Union.
  - *Cause 2 (PLAN 1.42c, not fixed yet):* every third order of a rich nation at war is a panzer
    division (3,829 gold against 1,001 for infantry). The economic AI returns from its build
    loop when it cannot pay, so the other slots stay empty for months: 9 Soviet formations
    built in 30 months, 13 lost, 5 M men unused in the pool.
- **Change:** `Wars.sameSide` / `together`; territory pressure and defence pooled over
  partners; a partner's supply network feeds a formation; no repatriation from a partner's land;
  the operational AI treats a partner's front against a common enemy as a front.
- **Tests:** 6 new (pair lookups; an ally's army pushes a partner's front and the ground goes
  to the partner; an uninvolved army moves nothing; an ally defends; supply and repatriation on
  a partner's soil; the AI marches Italian divisions from Brandenburg to the Polish front).
- **Check on four seen seeds, 50 years** (`tools/sweep/seed.ts`, results in `.cache/t1/`):
  | seed | leader range | new in top ten | alive | land moving, last 5 y |
  |---|---|---|---|---|
  | 99 | 5.4 | 2 | 94–114 | 4.2% |
  | 105 | 8.5 | 4 | 100–136 | 5.7% |
  | 108 | 10.0 | **1 (fails)** | 95–128 | 5.5% |
  | 109 | 4.4 (was 2.7) | 3 | 99–132 | 4.3% |
  Seed 109 now passes; seed 108 lost two of its three newcomers. The leader is still the Soviet
  Union in every year of every seed, and it only ever shrinks. Not enough for a clean sweep.
- **Speed:** a 50-year run takes 11–12 min alone-ish (4 in parallel); the sweep took 30–36 min
  per seed before PLAN 1.42a.
- **Not verified in the browser:** sim rules only. Gate green (426 unit, 7 sweep, 61 e2e).
- **Next:** PLAN 1.42c (build queue), the same four seeds again, then the unseen-seed sweep.

## 2026-10-03 — PLAN 1.42c (critic B1): the build queue no longer waits for a division it cannot pay for
- **Change:** `economicAi` build step: when the picked template costs more than the treasury
  covers (order + 3 months of income) and the infantry division is cheaper, infantry is
  ordered. One unit test (panzer when affordable, infantry when only that is, nothing otherwise).
- **Check, same four seen seeds × 50 years** (`.cache/t2/`; 1.42b alone in brackets):
  | seed | leader range | new in top ten | alive | land moving, last 5 y | leader at the end |
  |---|---|---|---|---|---|
  | 99 | 14.7 (5.4) | 4 (2) | 95–137 | 11.0% | 15% |
  | 105 | 6.2 (8.5) | 2 (4) | 100–122 | 4.8% | 22% |
  | 108 | 4.6 (10.0) | 3 (1) | 100–129 | 4.8% | 23% |
  | 109 | 10.7 (4.4) | 4 (3) | 99–130 | 4.4% | 17% |
  All four pass all seven criteria. The numbers move both ways between runs: 50 years of this
  world are chaotic, so a single seed's value is not evidence of much; the unseen-seed sweep is.
- **Still true:** the leader is the Soviet Union in every year of every run and it only
  shrinks (27% → 15–23%). Nobody else grows into a rival.
- **Speed:** 13–17 min per 50-year run with four in parallel (11–12 before this change: more
  formations alive).
- **Gate:** green (427 unit, 7 sweep, 61 e2e). Not verified in the browser: sim rule only.
- **Next:** PLAN 1.42: `npm run sweep -- --first 201 --tag b1c` on the final code.

## 2026-10-03 — PLAN 1.42, second sweep on unseen seeds: 7 of 10, B1 still open
- **Sweep** (`npm run sweep -- --first 201 --tag b1c`, code of d5bd6ea, 20 min for 10 seeds ×
  50 years; it took 36 min before PLAN 1.42a): seeds 204, 208 and 209 fail.
  - 204: 1 newcomer in the top ten. 208: 1 newcomer, leader range 2.4. 209: leader range 2.6.
  - The other five criteria pass on every seed (land moving 3.8–9.8%, 93–145 nations alive).
- **This is not better than the first attempt** (9 of 10 on seeds 101–110). The four seen seeds
  all passed before this sweep, and that told me nothing: one seed's 50-year numbers swing by
  more than the margins I was tuning for (seed 108's leader range was 4.9, 10.0 and 4.6 in
  three versions of the code).
- **What every run has in common** (24 runs of 50 years so far): the largest nation is the
  Soviet Union in every year. It starts at 27% and ends between 14% and 26%. It never grows,
  and nobody grows towards it: the United States (7–9%, 876k gold unspent at year 25 on seed
  109, aggression 15) and Canada sit still. The criteria pass when revolts happen to chip
  enough off the Soviet Union and fail when they do not.
- **Candidates for the third attempt** (not tried; each acts on every seed):
  1. *Peace terms that move land.* Wars against the Soviet Union end at score 0–30 and the
     winner annexes round(|score|/100 × occupied): almost nothing. Check what a won war
     actually transfers, and whether the 5-year deadlock end returns all occupied land.
  2. *A giant with no army should fall apart or be carved up.* 21k men holding 170,000 cells:
     the abstract garrison of 1 per frontier cell and the 16-hour hold are the only defence, and
     attackers still do not get through. Measure the front's advance against an undefended
     Soviet border from the year-25 checkpoint of seed 109.
  3. *Rivals that grow:* aggression and war utility of the other great powers (the USA never
     acts), so that the top of the table can change hands at all.
- **Report committed** as FAILING. PLAN 1.42 stays unchecked, with the seeds for the next sweep
  moved to 301+ (201–210 are seen now).
- **Next iteration:** PLAN 1.42, third attempt, starting with the measurement in candidate 2.

## 2026-10-03 — PLAN 1.42, third attempt: the winner of a peace keeps what it occupies (ADR-51)
- **Start:** gate green, critic not due.
- **Cause:** peace terms. The winner annexed round(|score|/100 × occupied) and the score is
  proportional to the occupied land, so the land changing owner went with the square of a
  conquest. Wars against the Soviet Union ended at score 0–30 and moved almost nothing.
- **Change:** at |score| ≥ 10 the winner annexes all the losers' land it occupies. White peace
  and the puppet rule are unchanged; `nearestFirst` is deleted with the quota.
- **Tests:** two war tests assert the new terms instead of the old quota (listed in ADR-51);
  one new (the losers' occupations revert).
- **Scratch sweep, seen seeds 101–110 × 50 years:** 10 of 10. Leader range 4.1–16.1 points,
  2–4 newcomers, land moving 4.8–23.0% in the last 5 years, largest nation 12–26% at the end.
  Ten seeds this time, not four: the four-seed check before the last sweep was noise.
- **Still true:** the leader is the Soviet Union in every year of every seed.
- **Gate:** green (428 unit, 7 sweep, 61 e2e). Not verified in the browser: sim rule only.
- **Next:** the deciding sweep on unseen seeds 301–310.

## 2026-10-03 — PLAN 1.42, third sweep on unseen seeds: 8 of 10. Blocked (PROMPT step 8)
- **Sweep** (`npm run sweep -- --first 301 --tag b1d`, code of b0218f0, 25.5 min): seeds 304 and
  306 fail the leader-share range (2.6 and 1.6 points). All ten have 2–3 newcomers in the top
  ten; the other five criteria pass everywhere (land moving 5.1–15.1%, 88–140 nations alive).
- **Three attempts, three failures** (9, 7 and 8 of 10, on different seeds each time). Written
  up in BLOCKERS.md with what was not tried. PLAN 1.42 stays unchecked and marked blocked; the
  next sweep starts at seed 401. No threshold was moved and nothing was tuned on a failing seed.
- **Lesson:** a pass on seen seeds says little (4 of 4, then 10 of 10, before failing). With
  ten seeds and a pass rate near 80–90% per sweep, this criterion needs a mechanism that
  reaches the largest nation on every seed, or it will keep failing one or two.
- **Today's B1 work that stays:** tick time back under budget (1.42a), partners' fronts
  (ADR-50), the build queue (1.42c), peace terms (ADR-51).
- **Next:** PLAN 2.4 (FireEvent visuals), the first unchecked task that is not blocked and part
  of critic B2. It is a rendering task: screenshots viewed, and the 30 fps budget at T2 checked.

## 2026-10-03 — Loop stopped by the user; next task prepared: land by area (PLAN 1.42d, ADR-52)
- **The user stopped the loop** after the third sweep and asked whether the Soviet Union is
  simply too big at the start.
- **Measured** (scratch script; area of a cell in row y = `kx[y] × ky[y]` km² from
  `navOf(world).grid`; 1938 start, seed 1; owned land 133 M km²):
  | Nation | Cells | Area | km² |
  |---|---|---|---|
  | SOV | 26.8% | 15.9% | 21.2 M |
  | CAN | 12.3% | 6.8% | 9.1 M |
  | USA | 7.3% | 7.0% | 9.3 M |
  | DEN | 5.4% | 1.5% | 2.0 M |
  | AST | 4.0% | 6.1% | 8.1 M |
  | BRA | 3.7% | 6.4% | 8.5 M |
  | CHI | 2.7% | 3.7% | 4.9 M |
  | AOF | 2.1% | 3.5% | 4.7 M |
  The Soviet Union's size is right (21.2 M km²); the count of cells is what is wrong. Moving
  the leader's share by 3 points of cells means about 19,000 cells, most of them Siberian.
- **The user decided** to measure land by area in the sweep criteria and the statistics.
  Written up before any run with it: ADR-52, PLAN 1.42d (measure; no sim rule, hash must stay
  5d08e5dd) and 1.42e (sim rules that count cells; changes behaviour). PLAN 1.42 is retried
  after 1.42d on seeds from 401.
- **Where the cell counts are** (to convert in 1.42d): `tools/sweep/seed.ts` (`nc.cells` for
  topLand and top10, `changed` as a count over land cells, `landCells`),
  `tools/sweep/criteria.ts` (moving ÷ landCells), `src/sim/stats.ts` and the ranking / nation
  panel land figures (check what they read). `nations.cells` is state and is used by sim rules:
  leave it; add an area figure beside it (derived, or computed where needed).
- **Not the whole answer:** by area the USA, Canada, Brazil and Australia start within a
  factor of 2.5 of the Soviet Union and still do nothing for 50 years. The "Not tried" list in
  BLOCKERS stands.
- **Critic:** not run since bb1dd4f (11 commits back). Every commit since was a "Critic B1"
  remediation commit, which restarts the count (ADR-49), and 1.42d will be one too. Whether
  to run the critic anyway is the user's call.
- **Next (`continue`):** PLAN 1.42d.

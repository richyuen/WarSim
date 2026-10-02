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

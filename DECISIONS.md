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

### ADR-7 · 2026-10-02 · accepted — Miller cylindrical projection, cropped 80°N–60°S, per-row scale tables **[AoC-DEVIATION]**
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

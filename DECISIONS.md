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

### ADR-100 · 2026-10-05 · accepted — A founded nation is named after the province of its capital, and a province without a name after its country (PLAN 2.15b)

- **Context:** the critic's R2-B6 saw "Free state 128". PLAN 2.12a took away its cause there
  (a nation that lost its origin as the table grew). Two more ways to the number were left.
  - *Seven provinces of the earth data have no name* (`adm1` ending `+99?`, area 0: 2550
    Antarctica, 2966 Kiribati, 3115 Colombia, 3123 Venezuela, 3124 Anguilla, 3142 Mexico,
    3155 Russia). They are not empty: at the 1938 size six hold one cell and Antarctica's
    18. A revolt there founded "Free state N".
  - *The origin was the first province of the area*, where the revolt began or a Kill's seed
    stood. The capital is the largest city of the area, which may be in another province.
- **Decision.**
  - `provinceLabel` (`src/shared/nationNames.ts`): a province is called by its name, else by
    its country's (`admin`). The data is not changed: Natural Earth gives no name there, and
    a made-up one would be ours.
  - `foundedName`: "Free <label of the origin>". "Free state N" stays as the last resort for
    a state without an origin (a save from before PLAN 2.12a); nothing founded now comes to
    it.
  - `spawnRebels` sets the origin after the capital: the province of the capital's cell
    where that is in the area, else the area's first as before (an area without a city has
    its capital in its middle, which may be the sea: PLAN 2.15e).
- **The pin did not move** (324bc358): `origin` is in the state, but a plain game revolts by
  province, where the area is one province. In region mode and in a Kill the origin of a
  nation can now differ from before; nothing reads it but the name and `risingNeighbour`,
  which asks only whether it is 0.
- **What it does not give.**
  - Two nations of one name. 114 names are held by more than one province ("Valmiera" 21,
    "Central" 10, "Northern" 8), and "Free Colombia" can stand beside Colombia. A line under
    PLAN 7.4.
  - A name that follows the capital when it moves: the origin is where the nation was
    founded.
  - Names in a scenario that is not on the earth map: the labels are the earth data's.

### ADR-99 · 2026-10-05 · accepted — A God Mode Kill hands land back, founds five nations at most and starts no war (PLAN 2.15a)

- **Context:** the critic's R2-B6. A Kill of France made 103 living nations 139 and left 43
  wars a month later. Measured here at the 1938 start, seed 99, one tick after the Kill:
  France 102 → 139 living and 2 → 40 wars; Yugoslavia 102 → 149 and 2 → 50.
- **Two causes.**
  - *The count:* the forced collapse cut the land into groups of at most `REGION_MAX` (8)
    provinces, one nation each, and every island was a group of its own (France is 20
    connected pieces, 13 of them of one cell).
  - *The wars:* `spawnRebels` ends with the holder declaring war on the nation it founds,
    and a declaration brings in the holder's allies and puppets. The holder died in the same
    tick; `endAllOf` took it out of each war, and each war went on between its allies and
    one new nation.
- **Decision** (`killNation` in `systems/revival.ts`; the order is the rule):
  1. Puppets go free and dead claimants revive, as before.
  2. A province whose core nation is alive goes to it; else to its living claimant with the
     lowest id.
  3. The rest founds at most `KILL_STATES` = 5 nations, and no more than one for every
     `KILL_CELLS_PER_STATE` = 200 cells the nation held (rounded, at least one). The
     connected pieces share them by the weight of their cities (the sum of the sizes;
     highest averages), no piece more than it has provinces with a city.
  4. A piece with several is divided among seed provinces, each taking the provinces
     nearest to it. The first seed is the capital's province, else the largest city's; each
     further one has the highest product of its city's size and its distance from the seeds
     taken.
  5. A piece that founds nothing goes to the living nation with the most provinces next to
     it. One with no neighbour, and the cells outside any province, go to the heir: the
     nation founded on the old capital, else the largest founded, else whoever received the
     most.
  6. Nobody declares war: `spawnRebels` and `reviveNation` take `war = false`.
- **Why five.** The critic asked for "a stated few". Five lets a large nation come apart
  into pieces a viewer can count and name, and the war banners do not grow. One for every 200
  cells keeps Luxembourg (14 cells) one nation.
- **Why the cities weigh and not the land.** By cells France's Algeria is three times
  metropolitan France (7,470 against 2,568) and would take four of the five.
- **Why no war.** The nation that would declare it is dead before the tick ends. A new
  nation that wants its neighbour's land declares its own war by the usual rules.
- **Seeds, tried:** the largest cities in order gave two neighbouring provinces in France
  (Ain and Rhône), and "Free Rhône" was the south-west with Lyon at its edge. The furthest
  apart alone gave Finistère and Andorra's La Massana, and 1,800 / 553 / 373 cells. Size
  times distance gives Paris, Ain and Haute-Garonne: 1,095 / 944 / 687.
- **Measured with it** (seed 99, one tick after):

  | Kill of | living | founded | their cells | wars |
  |---|---|---|---|---|
  | France | 102 → 106 | 5 | 1,095, 944, 687, 7,267, 203 | 2 → 2 |
  | Yugoslavia | 102 → 106 | 5 | 535, 138, 50, 301, 72 | 2 → 2 |
  | Italy | 102 → 107 | 5 | 1,263, 2,627, 2,516, 1,161, 191 | 2 → 2 |
  | Luxembourg | 102 → 102 | 1 | 14 | 2 → 2 |

  France's count is 106 and not 107 because France itself is gone; Italy's has Ethiopia back.
- **A test restated, not weakened:** `godMode.test.ts`, the Kill of Yugoslavia, asked that
  the new nations hold every cell Yugoslavia held. One cell of an island with Italy next to
  it now goes to Italy (step 5). The test asks that the new nations and the neighbours'
  gains together are every cell, and that the new nations hold over 99%.
- **The plain game:** a collapse by bankruptcy is as it was (`forced` false: the restless
  provinces revolt in connected groups, and the holder declares war on each). **The pin:**
  not moved.
- **Tests:** unit (`godMode.test.ts`): France, Yugoslavia, Italy and Luxembourg: one to five
  founded, no `WarDeclared`, no new war, no cell left with the dead nation, the world's owned
  land the same. Seen to fail before (38 founded for France). e2e (`godUi1938.spec.ts`): the
  Kill of France by two clicks in the God tab. Pictures: `docs/evidence/2.15/`.
- **What it does not give.**
  - The dying nation's capital still moves once for each nation that takes it, with a
    `CapitalMoved` event each time.
  - Land that goes to a neighbour or back to a core nation is logged "broke away" (PLAN
    2.15d).
  - Algeria comes out as a coast of 203 cells and a desert of 7,267: provinces crossed, not
    kilometres, decide who is nearest, and one desert province is most of the land.
  - Indochina and Madagascar, with one or two cities, found nothing and go to a neighbour.
  - The new nations are still "Free <province>" with plain flags (PLAN 2.15b, 2.15c).
  - The dead nation keeps no claim on the land of the nations founded on it, so Revive
    finds nothing there (PLAN 2.17).

### ADR-98 · 2026-10-05 · accepted — A deployed block stands no further from its formation than contact reaches (PLAN 2.14f5c)

- **Context:** ADR-92, under "not done": "How far a block may stand from its formation has
  no limit in `deployOf`." Two that are each other's nearest go half the way between them,
  0.67 cells (13 km) at most. One whose nearest enemy is deployed against another comes up to
  that enemy's block (ADR-89), which may stand on the enemy's far side, and that enemy's own
  enemy's further still.
- **Measured without a limit** (60 days of Germany against Poland, hour by hour; seed 99 in
  `deploy.test.ts`, seed 7 by a probe not kept): the furthest block 44.3 and 79.8 km from its
  formation; further than contact reaches (1.5 cells, 29.4 km) in 5,705 of 169,800 and 10,707
  of 210,800 block-hours (3.4% and 5.1%). None of them of a pair of each other's nearest.
- **Decision: a limit, at the contact distance** (`DEPLOY_REACH = CONTACT_CELLS`). The block
  goes that far along its line and stops, facing as before.
- **Why a limit.** The T1 marker stands on the formation and the T2 block at its deployment
  (ADR-89 said "up to 0.45 cells away"; ADR-92 let the marker stay for that reason). At four
  cells the block stands among formations the rules do not have it near: the two tiers then
  show different places for one division. Now the two are never further apart than the
  enemy it fights can be.
- **Why this number.** Tried on both seeds (days 10, 20, 30, 45 and 60; the share of
  formations in contact that have their nearest enemy in one view at 20 m/px):

  | limit, cells | share in one view, the worst day | blocks on one another, the most | block-hours at the limit |
  |---|---|---|---|
  | none | 94.3% and 93.0% | 3 and 20 | 0 |
  | 1.5 | 94.3% and 93.0% | 5 and 20 | 3.4% and 5.0% |
  | 1.25 | 94.3% and 93.0% | 8 and 22 | 8.0% and 8.7% |
  | 1.0 | 92.7% and 91.5% | 14 and 23 | 11.5% and 11.7% |
  | 0.75 | 86.2% and 86.7% | 22 and 28 | 16.7% and 15.4% |

  At 1.5 no day lost more than 1.7 points (95.9% to 94.2%, seed 7, day 45) and the test's
  90% holds. At 0.75 it does not. 1.5 is also a number the rules already have.
- **What it costs.** A block held back stops short of the block it was going to. In the
  block-hours the limit holds (seed 99 and seed 7), from the block to its enemy's block:
  median 3.3 km without the limit, at most 11.3 and 13.6; with it median 7.8 and 10.1 km, at
  most 17.2 and 28.7. Over 14 km, half a view at 20 m/px: 323 and 1,678 block-hours, 0.2% and
  0.8% of all, and none before. The shots of those hours are that long. They were the hours
  in which the block was 29 to 80 km from its own formation.
- **What cannot change:** a pair of each other's nearest (0.67 cells at most). So the pair a
  war's banner leads to (ADR-93, ADR-95), the pair of `battleView1938` and every built pair
  of the tests stand where they stood. `toBattle1938`, day 60: formations 45 and 563 as
  before, the camera at the same place.
- **Hops** (ADR-92's count; seed 99): 489 of more than a block's depth (511), 108 of more
  than half a cell (109), the longest 40.0 km (50.0). Seed 7: the longest 34.9 km (37.6). The
  limit is not what makes a hop rare: a block changes sides when its enemy's line does.
- **Tests:** unit, in the hour-by-hour test of `deploy.test.ts`: no block further from its
  formation than `CONTACT_CELLS` (the furthest 29.4 km, at the limit in 5,733 block-hours,
  none of them each other's nearest; a block at the limit is nearer its enemy's block than
  contact reaches, 17.2 km at most). Seen to fail with the limit off (2.26 cells).
- **The pin:** not moved (a block's place is not state).
- **What it does not give.**
  - Hops of up to 40 km in an hour remain, and were not looked at on the screen.
  - The chain of "its enemy's block" is followed four deep, as before.
  - A block held back faces the block it does not reach; nothing on the screen says so.
  - No picture of a held-back block was taken: the day-60 view of `toBattle1938` has none.

### ADR-97 · 2026-10-05 · accepted — The click on a war's banner flies to the battle (PLAN 2.14f5b4)

- **Context:** ADR-91 made it a jump: "the camera has an eased zoom and no eased pan, and a
  flight from the world to 20 m/px passes four tiers in a second". A jump from the world view
  to 28 km of ground does not say where on the map the battle is.
- **Decision: built.** `flight` in `render/camera.ts` (pure): the path of van Wijk and Nuij
  (2003) between two cameras, pan and zoom in one movement, with ρ = √2 and a cubic ease at
  both ends. 320 ms for each zoom by 4.1 times along the path, 250 ms at least and 1.6 s at
  most. `CameraController.flyTo` flies it and ends on the target exactly;
  `MapView.showBattle` is its one caller. `set` stays a jump (tests, God tools).
- **The three starts** (a probe not kept: seed 99, day 60, a view of 1400 × 800, the view's
  turns given times 16.7 ms apart; a picture every eighth frame, looked at):
  - *The world view:* 89 frames (1.48 s). A zoom towards the place: the world, Europe,
    Germany and Poland with their names, the markers of the front at 231 m/px, the elements
    at 73, the figures from 24. The ground moves 21 px a frame at most.
  - *20 m/px on another front, 5,900 km away* (the case a joint ease of pan and zoom smears):
    90 frames. It zooms out to 4,276 m/px (Central Asia with its markers), crosses, and zooms
    in on the border. 248 px a frame at most, under a fifth of the view.
  - *20 m/px, 117 km away:* 78 frames; out to 91 m/px and in; 107 px a frame at most.
- **ADR-91's reason, measured.** The wheel's ease passes the same four tiers in 0.6 s, and
  `zoomDemo1938` holds it to be seamless; the flight takes 1.5 s over them. What it costs:
  the view asks the worker for its box every 100 ms, so 13 to 16 subscriptions in a flight
  where the jump has one, and the worker sends elements on the way (736 held at 93 m/px, 163
  at the end). The view's turn took 1 to 6 ms in the mean in those frames (the script's side;
  the browser of the tests draws on the processor).
- **The user's hand ends it.** A key of the camera, the wheel, a press on the map or a touch
  ends the flight where it is; it does not go on once the key is up.
- **On a looping map** it goes the short way round.
- **Tests:** unit, six in `camera.test.ts` (the ends exact; from the world the place stays in
  the view and the zoom only grows; far apart at 20 m/px it zooms out to under three views
  between the two, never moves away, under half a view a frame; the short way round; a zoom
  on the spot; the limits of its time, and no step that is not a camera). e2e, the first of
  `toBattle1938`: the frames of the view's own loop from the flight's first to its last (15
  in 3.4 s in the tests' browser, 7 of them between the world and 40 m/px; the zoom only
  grows), seen to fail with the jump ("no flight began"); and a second click with the left
  arrow pressed on the way: the camera stays above 100 m/px. Both tests of the spec wait for
  the flight's end before they ask where the camera is; what they ask is as it was (the
  place to six decimals).
- **The pin:** not moved (the view only).
- **What it does not give.**
  - How it looks at 60 frames a second on a graphics card was not seen: the tests' browser
    draws 4 to 8 frames a second while the camera moves, and the pictures are of frames
    stepped one by one, with the worker's answers arriving sooner, counted in frames, than
    they would.
  - The counters' splits (300 ms) and the handover's fade (250 ms) are passed while they
    run; no measure of what is half shown on the way was taken.
  - `prefers-reduced-motion` is not read: nothing in the game reads it yet.
  - A flight is not held to the map's edge on its way out (it is normalized frame by frame,
    so on a map that does not loop it slides along the edge).
  - `CameraController` has no unit test of its own (it needs an element); the flight's end
    by the user's hand is tested in the browser, by a key only.
  - A drag begun before the flight does not end it (the flight starts when the worker has
    answered, some milliseconds after the click): the press is what lands it, not the move.
  - "The wheel's ease passes the four tiers in 0.6 s" is worked out from its rate (18 a
    second), not measured, and it is the eased zoom of `zoomTo`: one notch of the wheel does
    not ask for that span.

### ADR-96 · 2026-10-05 · accepted — A war's banner shows whether the war has a battle (PLAN 2.14f5b3)

- **Context:** ADR-91, under "what it does not give": "nothing on the banner says whether
  there is a battle to go to". A click on a war with none selected the leader and left the
  camera where it was, and nothing said why. ADR-91 did not send it with the statistics
  because it took the flag for "a grouping of every war's formations with each statistics
  message".
- **Decision: built.** Each war row of the statistics (`WarStat`, at most once a second, and
  in `inspect`) has `battle`: whether formations of its two sides are in contact, which is
  where `largestBattle` has an answer. On the banner the swords are gold with a battle and
  dim without, the frame is dimmer without, and the tooltip's second line reads "Click: to
  its largest battle" or "No battle now". The click does what it did.
- **How it is known** (`warsWithBattle`, `sim/systems/warBattle.ts`), without the grouping:
  one pass over the hour's contacts (`contactsOf`: each formation in contact and its nearest
  enemy) marks every war that has the two on opposite sides. A formation's nearest enemy may
  be of another war, so a war not marked is looked at pair by pair, its formations in contact
  only, to the first pair within the contact distance. The two steps together are the
  condition of `largestBattle` (a pair of the two sides, both `engaged`, within
  `CONTACT_CELLS`), not a measure near it.
- **Measured** (the kept 60-day test, seed 99, every six hours, every war): the wars marked
  are those with an answer in 1,708 of 1,708 askings; the pass over the contacts found all
  752 with a battle by itself. The second step is seen to be needed in a built case only
  (three wars at one place: the German's and the Pole's nearest enemy is the Czechoslovak
  between them). Cost on day 60 (11 wars, 909 formations, 96 in contact): 0.019 ms with the
  hour's contacts kept, 0.076 ms when they are worked out again (after a command).
- **Reads only:** no state and no hash changes; the pin did not move.
- **What it does not give.** The flag is as old as the statistics message, a second at top
  speed; the click asks anew, so for that second a lit banner may lead nowhere and a dim one
  to a battle. It says *a* battle, not the leaders' (ADR-95: a war whose leaders are not in
  contact leads to allies). The sign is a 10 px glyph and a frame: seen at a look in a row of
  banners, not from across the room. The wars past the eighth have no banner and no sign.
  No count of battles, and no way to a war's second battle.

### ADR-95 · 2026-10-05 · accepted — A war's banner leads to a battle of the two leaders it names, when there is one (PLAN 2.14f5b2)

- **Context:** the banner of a war names its two leaders ("Germany +5 against Poland +9",
  `sides[s][0]`; when a leader leaves the war the next member leads, on the banner and
  here). The click went to the war's largest battle (ADR-94), whoever fought it. ADR-93 saw
  it land on Italians against the French.
- **Measured** (the kept 60-day test for seed 99; the same with seed 7 in its place, once):
  with the rule of ADR-94, of the two formations the camera lands between, neither was a
  leader's in 46 of 752 and 41 of 1,025 landings, one in 96 and 349, both in 610 and 635.
- **Decision:** `largestBattle` ranks a war's battles first by the leaders' formations in a
  pair of each other's nearest enemy: a battle with the two leaders front to front, before
  one with a leader's formation front to front with an ally's, before the rest. Then as
  ADR-94. Inside the battle the pair is chosen as before, each other's nearest first, and
  among those the leaders' formations before men. A war with no leader's formation in
  contact gets its largest battle as before: the rule is an order, not a filter.
- **Why not "a leader's formation, either of them":** tried first. In "Germany +1 against
  Poland" every battle has Poles in it, so a Czechoslovak battle counted as a leader's and
  won by size (the built test failed on it). On the front it left 129 of 752 landings with
  one leader only.
- **Why the leaders come after "each other's nearest" in the pair:** ADR-93's finding (both
  blocks whole in the view) rests on the pair being each other's nearest. A leader's
  formation that is nobody's nearest can stand 29 km from its enemy.
- **Not chosen:** the banner saying whose battle it leads to (the mismatch would stay; the
  sim can answer the question the banner asks).
- **After** (seed 99 and seed 7): neither 0 and 0, one 6 and 187, both 746 and 838. Each
  other's nearest in all 752 and 1,025; blocks at most 3.6 km apart in both runs; whole in
  the view every time. One side under a tenth of the other: 38 and 49 (36 and 33 with
  ADR-94 alone): a leaders' battle is sometimes a less even one than the allies'.
- **Tests:** unit, `warBattle.test.ts`. A new one: Germany and Czechoslovakia against
  Poland, one division against one on the German border and two against two on the
  Czechoslovak; the answer is the German pair; with the German division gone, the other.
  Seen to fail with the rule of ADR-94 (two against two) and with "either leader". The
  60-day test asks for no landing without a leader's formation (46 with the old rule, seen
  to fail). e2e, the second of `toBattle1938`: the two on day 60 are a German and a Polish
  formation.
- **On the screen** (seed 99, day 60): as under ADR-94, German motorised division 45
  against Polish infantry division 563, 36,135 men against 18,109. The picture shot again
  came out the same file.
- **The pin:** not moved; the answer reads the state and writes none of it.
- **Not done:**
  - A war whose leaders never meet (an ocean between them) leads to its allies' battles
    and the banner does not say so.
  - "One" in 187 of 1,025 on seed 7: which wars, not looked at.
  - A test where the leader changes during the war (the first member leaves): none.
  - The tooltip still says "to its largest battle".

### ADR-94 · 2026-10-05 · accepted — A war's largest battle is the one whose smaller side has the most men (PLAN 2.14f5b1)

- **Context:** ADR-91 sends a click on a war's banner to its largest battle, "by men": the
  men of both sides. ADR-93 saw where that leads on day 60 of seed 99: 67,984 men against
  472, eleven formations against three nearly spent ones.
- **Measured** (a probe not kept; 60 days of Germany against Poland and the wars the AI
  declares, every six hours, every war; seed 99: 752 answers, seed 7: 1,025): by the men of
  both, one side had under a tenth of the other in 212 and 358 answers (28% and 35%), under
  a hundredth in 53 and 103. The median of smaller to larger was 0.28 and 0.19. A war had 8
  battles at a time in the mean (6,314 and 7,988 in all). Ranked by the smaller side, another
  battle comes first in 319 and 545 answers, and under a tenth are 36 and 33 (5% and 3%),
  under a hundredth 3 and 0.
- **Decision:** the largest battle is the one whose smaller side has the most men; of
  equals, the one with more men on both sides; of equals, the lowest formation id
  (`largestBattle`). A battle is a fight of two sides, and what the click should show is
  where both stand in strength: a large army over a remnant shows one side's figures and a
  few of the other's. The pair inside the battle is chosen as before (ADR-91, ADR-93).
- **Not chosen:** the most even battle (two battalions of equal strength would win over two
  armies); the product of the sides (it says the same as the smaller side where it matters
  and needs a second sentence to explain).
- **Tests:** unit, `warBattle.test.ts`. The second test is restated: two against two in the
  south stays the largest when four stand against one in the north with more men in all,
  and gives way when the north is four against three. Seen to fail with the old rule at
  the four against one. The 60-day test counts the answers with one side under a tenth: 36
  of 752, and asks for under a tenth of them (212 before). With seed 7 in its place, once,
  it passes too. e2e, the second test of `toBattle1938`: the landing of day 60 has no side
  under a tenth of the other.
- **On the screen** (seed 99, day 60): 6 formations against 6, 36,135 men against 18,109;
  the camera lands between the German motorised division 45 and the Polish infantry
  division 563. Picture: `docs/evidence/2.14/to-battle-front.png` (shot again).
- **The pin:** not moved; the answer reads the state and writes none of it.
- **Not done:**
  - Of the 752 the pair is still each other's nearest in all, and whole in the view; that
    was measured again. The widest pair of blocks reads 3.6 km as before; whether it is
    the same pair was not checked.
  - Whose battle it is, when neither of the two formations is a leader's: 46 of 752 and 41
    of 1,025 with this rule (38 and 3 before). PLAN 2.14f5b2.
  - The banner's tooltip still says "to its largest battle" and does not say what largest
    means.

### ADR-93 · 2026-10-05 · accepted — On a real front the banner's pair is front to front: the rule of ADR-91 stays (PLAN 2.14f5a)

- **Context:** ADR-91 sends the camera between the blocks of two formations of the war's
  largest battle: those that are each other's nearest enemy before those where one is the
  other's, before any two in contact; then by men. Its tests put the pair down. The fear
  (PLAN 2.14e, "not done"): in a battle with no two that are each other's nearest, the two
  picked stand up to 29 km apart with their blocks towards others, and the view is 28 km.
- **Measured** (`warBattle.test.ts`, seed 99, Germany at war with Poland by command and the
  wars the AI declares, 60 days, every six hours, every war): asked 1,708 times, a battle
  752 times, 237 of them of Germany against Poland. The two named were each other's nearest
  in all 752. Their blocks stood at most 3.6 km apart. Every element of both stood in the
  view of 28 by 16 km less 50 px at its edges, every time. Seed 7, by a probe not kept: 1,025
  battles, 1,024 each other's nearest and 1 where one was the other's; at most 5.8 km; all
  whole.
- **Decision:** nothing changes in `largestBattle` or `showBattle`. The case feared did not
  occur: 1,776 of 1,777 battles had a pair that are each other's nearest, and the other one
  was whole in the view too.
- **The test is a pin,** not one that failed first. That it can fail: with the pair chosen by
  men alone, 136 of the 752 are not whole in the view (92 each other's nearest, 516 one the
  other's, 144 neither; blocks up to 31.9 km apart).
- **On the screen** (`toBattle1938.spec.ts`, the second test; seed 99, no division put down):
  the click after 60 days lands at 20.0 m/px between formations 287 and 260, the two of the
  unit run on that day; all of their elements on the screen, the blocks' middles 144 px
  apart; nine formations have elements in the view. Picture:
  `docs/evidence/2.14/to-battle-front.png`.
- **Seen, not changed:**
  - The banner reads "Germany +5 against Poland +9" and the battle it leads to is an Italian
    division against a French brigade. The war is theirs too; the banner names leaders only.
  - "Largest by men" was 67,984 against 472 on that day: 11 formations against 3 nearly
    spent ones. Largest is not the most even.
- **Not done:**
  - No test builds a battle with no two that are each other's nearest (it needs three wars
    in one place), and the camera does not widen for one.
  - A pair across a strait stands on its two shores (ADR-89) and may be wider than the view.
    Not looked for; none was among the 1,777.
  - Two seeds, one scenario, 60 days.

### ADR-92 · 2026-10-05 · accepted — The marker of a formation in contact stays on the formation, not on its block; its bar goes with its box (PLAN 2.14f4)

- **Context:** since ADR-89 the block of a formation in contact stands between it and its
  nearest enemy, and the marker stands on the formation. At the boundary of 300 m/px the box
  fades where the formation is and the elements come in elsewhere. Measured
  (`battleView1938.spec.ts`): 27 px apart for a pair a cell apart. The most is 43 px, from
  the constants: a block goes forward by `d/2 - DEPLOY_GAP/2 - depth/2`, which at the 1.5
  cells where contact ends is 0.665 cells, 13 km. A probe spec with a pair at 1.48 cells
  showed 43 px; it was not kept. PLAN 2.14c1 had "up to 28 px": that is the pair a cell apart.
- **Looked at:** the morph in ten frames, for both distances. It reads as two boxes fading
  while one fight appears between them, on the line that joins them. Nothing jumps: no pixel
  is moved, the two layers cross-fade (ADR-71).
- **Decision 1: the marker is not drawn at the block.**
  - The blocks of a pair stand 10 px apart at 300 m/px and 1.7 px at 2,000 (0.17 cells: the
    gap and a block's depth). A box is 26 px wide. Two enemies' boxes at their blocks would
    overlap by 16 px or more at every zoom of T1, and `markerStacks` moves markers of two
    nations apart by a few px, not by a box.
  - The marker is the formation of the rules: contact, targets and pressure on territory read
    that place (ADR-89). A click on it and the order arrow start there.
  - A formation 1.5 cells from its enemy would be shown 0.67 cells (13 km) from where it is.
- **Decision 2: the box does not slide to the block during the morph.** 43 px in 250 ms is
  2.7 px a frame of a box with a white flag chip on a dark outline. ADR-72 kept the shrink to
  13%, a corner moving by under 0.2 px a frame, because that was already 43 of the 48 allowed.
- **Decision 3: the bar and the number of a formation in contact go with the box.** ADR-72
  lets them linger for 220 ms so that the number stays with the group. Here they lingered
  beside it: two stubs reading "11.9k" 27 to 43 px from the blocks, under or beside the tags
  that carry the same number (ADR-88). `drawMarkers` gives an engaged marker's bar the box's
  opacity. Out of T2 the same by the code, bar and box come in together; the test runs
  T1 to T2 only.
- **Tests:** e2e, the second test of `battleView1938.spec.ts`: a German division not in
  contact, and a German and a Polish one a cell apart. The offsets above; no box travels; in
  every frame of the morph the bar of each of the pair has its box's opacity, and at 256 ms
  nothing is left of them, while the bar of the one behind is in full. Seen to fail first
  (16 ms: bar 1 against 0.988). Pictures: `docs/evidence/2.14/handover-contact-t1.png`,
  `-96ms`, `-352ms`.
- **How often a block changes its line** (`deploy.test.ts`, the world of seed 99 with Germany
  at war with Poland, 60 days, hour by hour): 169,565 block-hours in contact. The block moved
  at all in 598 (0.4%). 511 were hops of more than a block's depth (2.3 km): one in 332 hours
  of a block. All 511 were of formations that stood still; 81 came with another nearest
  enemy, the other 430 with the same one. Of those the cause was not looked into: that
  enemy's own block went elsewhere, or the formation's row behind it changed (the median hop
  is 3.3 km, which is a row). 109 were of more than half a cell, the longest 50 km.
  231 formations hopped, the most 8 times. 701 contacts began and 605 ended, each one move
  to the line or back.
- **Not done:**
  - A hop is drawn as one hour's move of the elements. 109 of them in 60 days are 10 km or
    more in that hour: not looked at on the screen.
  - The longest hop is longer than contact (29 km): a formation that comes up to the block of
    an enemy deployed the other way can stand further from its own place than its enemy is.
    How far a block may stand from its formation has no limit in `deployOf`. For PLAN 2.14f5,
    which looks at the same pairs.
  - A stack is drawn as its lead: the bar follows whether the lead is in contact.
  - `fades1938.spec.ts` asserts a bar in full when the box is half gone, on the first marker
    of its frame. That marker is not in contact. If the order of the markers changes and it
    is one in contact, that assertion fails for this reason.

### ADR-91 · 2026-10-05 · accepted — A click on a war's banner goes to its largest battle: by men, a jump, at 20 m/px (PLAN 2.14e, the critic's R2-B2)

- **Context:** the critic: "Nothing leads to a battle. At T2 a division is a 30 px grid in a
  view of 1,600 px; most T3 views are empty ground. There is no way from a war's banner, a
  marker or the history to where the fighting is."
- **Decision.**
  - *Which battle.* Battles are derived each hour and not kept. For the click they are worked
    out again for the one war, from the state (`largestBattle`, `sim/systems/warBattle.ts`):
    formations of its two sides that are `engaged` and within the contact distance of one of
    the other side, joined into battles; the largest is the one with the most men (of equals,
    the lowest formation id). Read-only: no flag, no deployment and no hash changes.
  - *Where in it.* A battle of a front is hundreds of kilometres long, and a view that shows
    elements is 28 km wide. The camera goes between the blocks of one attacker's and one
    defender's formation: of those that are each other's nearest enemy (they stand front to
    front, ADR-89) the pair with the most men.
  - *The zoom.* 20 m/px: the zoom at which the two blocks are whole in the view, with their
    tags (PLAN 2.14c1's picture). A view smaller than 1400 px keeps 28 km across at more
    metres a pixel, up to 250, where elements are still what is drawn.
  - *A jump,* not a flight: the camera has an eased zoom and no eased pan, and a flight from
    the world to 20 m/px passes four tiers in a second.
  - *The click keeps what it did:* it selects the attackers' leader (PLAN 1.31b). A war with
    no formations in contact leaves the camera where it is.
- **Asked on the click, not sent with the statistics:** a flag "has a battle" on every banner
  would be a grouping of every war's formations with each statistics message.
- **What it does not give.** No way to the war's second battle, none from the history or from
  a marker, and nothing on the banner says whether there is a battle to go to.

### ADR-90 · 2026-10-05 · accepted — At T2 and T3 the ground has the terrain's colour, and the fill is a cast on it (PLAN 2.14d, the critic's R2-B2)

- **Context:** the critic: "The ground is the nation's colour. Berlin at 20 m/px is grey noise
  with specks; the Alps are salmon pink for being Swiss; Chad at 1 m/px is sky blue for being
  French Equatorial Africa, and could be shallow sea." PLAN 2.8b had decided it so ("the fill
  keeps its colour: it says whose the land is"), and ADR-82 had built the tint of occupied
  land on it.
- **Decision.** In the ground's program, where the land is coloured by a palette (the
  political mode and the modes that recolour nations), the colour is
  `mix(terrain, fill, share)`, by the ground's share of the handover. `share` is 0.14 away
  from borders, 0.62 on a border, falling over about half a cell, and at least 0.42 on
  occupied land. The terrain's colour is the terrain mode's blend of the four cells around.
- **Why a cast everywhere, and not none.** A view at 20 m/px seldom has a border in it. With
  no cast a formation's tag would be all that says whose land it is; with 0.14, plains in
  Germany and in the Soviet Union are 14 apart in RGB where the fills are 103 apart: one
  terrain, seen to be two countries when put side by side.
- **ADR-82 stands,** restated on the new ground: occupied land has more of the (occupied)
  fill than land at home, and an eighth of the hatching is left in the picture.
- **[AoC-DEVIATION]:** AoC's map is the nation's colour at every zoom; it has no close zoom.
- **What it does not give.** Terrain is a class to a cell of 19.6 km: the ground of Berlin is
  the plain's green with houses on it, not a city with streets and a river. A nation a few
  cells across is border all over. Finer ground is PLAN 7.4's.
### ADR-89 · 2026-10-05 · accepted — The blocks of formations in contact are deployed against each other; it is derived, not state (PLAN 2.14c1, the critic's R2-B2)

- **Context:** the critic: "Enemy formations stand a cell or more apart, and a cell is 19.6
  km: the closest pair after 60 days was 29 km apart. At 20 m/px a view is 32 by 18 km:
  centred between that pair it shows a border and trees and no unit." Its fix: "the engaged
  elements drawn at the cell edge they fight across".
- **What the code had.** Contact is 1.5 cells between formations' places; a formation in
  contact holds where it is; nothing turns it to the enemy. An element's place is not state:
  `slotPlace` works it out from the formation's place and facing, for the snapshot, the fire
  events and the event of an element's end. No rule reads it.
- **Decision.** For a formation in contact the block is deployed (`deployOf` in
  `systems/elements.ts`): on the line to its nearest enemy in contact, facing it, the front
  row half of `DEPLOY_GAP` (0.05 cells, a kilometre) short of the middle between the two.
  One whose nearest enemy faces a nearer formation comes up to that enemy's block instead.
  Not onto the mask's water. `findBattles` already walks every pair in contact: it notes
  each formation's nearest enemy and works out the hour's deployments (`deployAll`), and
  keeps the hour before's for the places of an hour ago. All of it is derived: null after a
  load or a command, and then worked out again from `engaged` and the places, the same.
- **Why not move the formations.** That is state, and the place of a formation feeds the
  contact rule, the choice of targets (`prox`), the pressure on territory and the march. It
  would move the pin and the balance for a matter of what a close view shows.
- **Is it a picture that disagrees with the sim?** (PROMPT: "no fake per-zoom animation that
  disagrees with the sim".) The place is the sim's own: one function, in the sim, gives it to
  the worker, to the fire events and to the wrecks, in Node as in the browser, and a test
  holds the page's elements to it to 1e-6 (`zoomDemo1938`). What differs between tiers is
  that the T1 marker stands at the formation's place and the T2 block at its deployment, up
  to 0.45 cells away: a division's place and its line. Said under PLAN 2.14c1 and taken up
  in 2.14f.
- **Measured:** 97% of the formations in contact after 60 days of a war share a view at
  20 m/px with their nearest enemy (2% before). The pin did not move.
- **Alternatives rejected:** the centroid of the enemies in contact (a formation between
  two enemies would stand before neither); a matching of pairs (leaves the odd ones out).

### ADR-88 · 2026-10-05 · accepted — At T2 and T3 a formation has a tag: flag, strength, name; sprites wear the nation's sprite colour (PLAN 2.14a, the critic's R2-B2)

- **Context:** the critic: "At T2 and T3 the marker boxes are gone and nothing is in their
  place: no flag, no strength, no name. German and Polish elements are the same grey dots."
  The marker's box morphs into the elements (ADR-72) and its bar and number go 220 ms later.
- **Decision:**
  - *A layer of its own, not the marker's lower row kept.* A tag is anchored on the part of
    its formation that is on the screen, so a division wider than the view (T3) or half out
    of it keeps one. The marker's stacks are laid out in the world's px and do not know the
    screen's edges; and the marker's morph, its early return and the specs built on them
    (`markerStacks1938`, `fades1938`) stay as they are.
  - *Layout:* stronger formations first; above the formation, else up to four places
    higher, else below; one that finds no place is left out and counted (`tagsLeft`).
  - *The name* is derived in the view from the template's name and the formation's id. No
    state, no pin.
  - *The colour:* one lift (`v × 0.55 + 115`), as the stand-in sprites. The second lift
    (45% toward white, "so that it stands out on the nation's own fill") put every nation
    between 178 and 255 a channel. The outline of the atlas is what sets a sprite off.
- **[AoC-DEVIATION]:** AoC has no formations to name; this is ours.
- **Consequences:** `spriteColours1938` holds as before (one tint a nation in every mode).
  At 12 m/px a figure is too small for its tint to be read on any fill: said under PLAN
  2.14a and taken up with the ground of 2.14d. With many formations on one spot (a stack of
  eleven or more) some have no tag; the formation panel of 2.14b is the way to them.

### ADR-87 · 2026-10-05 · accepted — The e2e suite runs in full when a numbered task is ticked, not for its parts (the user's decision)

- **Context:** a gate with code in it takes 13 minutes, 7 to 9 of them the e2e stage (117
  specs in a real Chromium). On 2026-10-05 seven gate runs spent about an hour there. What
  the stage found that day: one spec that measured the machine twice (ADR-85's commit), and
  one spec whose battle a rule change had moved (PLAN 2.13). The user: "this cadence is
  still a bit too high, let's do e2e after only numbered tasks, not split tasks".
- **Decision:** `npm run check` runs the whole e2e stage when the change ticks a numbered
  task of PLAN.md (`- [x] 2.14`), when git cannot tell what changed, when a helper under
  `tests/e2e` or the Playwright config changed, and under `check:full`. For anything else
  with code in it, only the spec files that changed (a new spec is never committed unrun),
  or no e2e at all. Typecheck, lint, the unit tests, the build, parity and, for a sim input,
  the ten-year tests run as before.
- **What it costs:** `main` can hold a part's commit that breaks a spec nobody ran. It is
  found when the task is ticked, at most a task's parts later, and fixed there. PROMPT.md
  asks a part that touches what is drawn to run that feature's specs by hand.
- **PROMPT.md's "all must pass before any commit"** now reads, for the e2e suite, "before a
  numbered task is ticked". CLAUDE.md and PROMPT.md say so.

### ADR-86 · 2026-10-05 · accepted — A treasury is spent before an army is sent home; the treasury of the start carries the army of the start for a year (PLAN 2.13, the critic's R2-B3)

- **Context:** the critic's second report: at tick 1 of every 1938 game 228 of the 1,054
  formations were gone, 39 of the 72 armour formations, all 34 Soviet ones, and no line of
  the history said so. Run here first (seed 99): 30 nations disband, China 70 of 140, the
  Soviet Union 34 of 162, Nationalist Spain 22 of 40, Mongolia 4 of 4.
- **What it was.** Step 1 of the economic AI disbanded until the month's books balanced with
  a margin. It never looked at the treasury (but for a debt). The Soviet Union was short 112
  a month plus its margin, with 6,936 in gold: five years of it. And the weakest formation
  goes first, by men: a tank brigade is small, so the armour went before the rifle divisions.
- **Decision, two rules and a line:**
  - *The AI:* a nation short by S a month disbands only while its gold is below
    `RUNWAY_MONTHS` (3) × S. It runs the deficit from the treasury first. As the gold runs
    out it cuts as much as brings S down to a third of the gold, not the whole deficit at once.
  - *The start:* a nation begins with six months of income (ADR-22) or, where that is more,
    `START_ARMY_MONTHS` (12) of what its budget is short with the army the order of battle
    gives it. 16 nations get more by it (Mongolia 4 → 98). Without it the AT ("none
    disbanded in the first month", on three seeds) cannot be met by the first rule alone:
    Mongolia's gold was half a month of its deficit, and a nation that neither disbands nor
    has gold is bankrupt in its second month.
  - *The line:* `FormationsDisbanded` (nation, how many), one event per nation and month,
    kept in the history: "X could not pay its army and disbanded formations: N".
- **Which of the task's two ways this is.** Not "budgets that carry the armies": that is the
  1938 incomes and upkeeps, balance data, deferred by ADR-58. It is "a floor and a time of
  grace", with the grace counted in gold, not in months: a clock would have ended on one day
  for every nation, and would have had to be told from the bankruptcy it leads to.
- **What it does not do.** The armies the incomes do not carry are still cut, later and
  line by line: seed 99 has 846 formations after a year (826 after an hour, before), 687
  after two, 658 after five. Whose budget is wrong, the income's or the order of battle's,
  stays with Phase 7 (BLOCKERS). And the weakest still goes first: when the Soviet gold runs
  low, its tank brigades are the first to go. A line under PLAN 3.1.
- **The pin (ADR-55):** `4aafc3eb` → `324bc358`. Five years of seed 99: `5377e4c5`.
- **The tick, pinned, five years of seed 99:** mean 1.502 ms (1.203 before; the budget is
  1.5): the first two years have some 200 formations more (2.11 and 1.97 ms). Logged in
  BLOCKERS for PLAN 7.1; not tuned now (ADR-58).
- **Tests whose expectation the rule changed, each said in its place:**
  - `economicAi.test.ts`: "a nation whose army costs more than it earns disbands": Mongolia
    now does so with its treasury empty, not with the money of the start unspent.
  - `economy.test.ts`: "starts with six months of income": or a year of its shortfall.
  - `alliances.test.ts`: "fighting together raises unity" compared a game at war with a twin
    "at peace" that the AI was free to take to war. With Poland's army whole, Poland joined
    the Axis in the twin's first month and the Axis was in two wars there (unity 60.25
    against 60). The AI is now off in both: the declared war is all that differs.
- **Alternatives rejected:** a grace of N months with no rule after it (the 228 go on the
  first day after, and the small nations are bankrupt before); starting gold alone (the AI
  would still disband on day one: it did not read gold); raising incomes (ADR-58).

### ADR-85 · 2026-10-05 · accepted — The test that reads PLAN.md follows the plan: a ticked phase review does not break the gate

- **Context:** `tests/unit/gate.test.ts` held PLAN.md to "the reviews of phases 0 and 1 are
  ticked, those of phases 2 to 6 are open". PLAN 2.11 was ticked in `3d6a2b2`, a commit of
  documents: its gate is parity alone (ADR-55), and so was that of the commit after. The first
  gate of code since (PLAN 2.12a) failed at this test, on a PLAN.md that was right.
- **Decision:** the test is changed, not the plan. It now says what it was there for (the
  parser finds the real plan's reviews, by their names): all seven exist, the ticked ones are
  the first ones in the order of the phases, the rest are open, and those of phases 0 to 2
  are ticked. It needs no edit at the reviews of phases 3 to 6.
- **Is it weaker?** It no longer fails when a later review is ticked in its turn, which was
  never a fault. It still fails for a review ticked out of turn, renamed, or lost, and for
  one of phases 0 to 2 unticked.
- **Not done:** the gate of a commit of documents still runs no unit test, so a test that
  reads a document can go red in such a commit and be seen only at the next gate of code.
  This is the one test of that kind (`gate.test.ts` reads PLAN.md; the parity script reads
  PARITY.md and is in every gate).

### ADR-84 · 2026-10-05 · accepted — How long a table is, is no part of the game: no reference to its columns is held across a create (PLAN 2.12a, the critic's R2-B4)

- **Context:** the critic's second report: on seed 2718 a game saved at year 10 and loaded
  ends year 11 as another game than the one that went on (Node: `931f19ad` against
  `33ca7b81`, 694 formations against 695; the browser's Continue the same), and the worker's
  hash leaves Node's with the step after nation 128 is founded. Run here first: as reported.
  PLAN 2.11j had claimed the first could not happen; its tests looked at the cause that task
  had found (the supply network), in a first year.
- **What it was.** `Table` grows by doubling, and a growth replaces its arrays (`cols`,
  `alive`, `generation`). `Table.create` says so in its comment. `spawnRebels` took
  `nations.cols`, then created the row, then wrote the nation into what it had taken. A
  write past the end of a typed array does nothing, and a read there gives `undefined`.
  - *In every 1938 game that went on long enough,* the nation with id 128 (the table has
    128 rows after the scenario's 103) was founded with nothing: not living, no origin, no
    colour, no gold, capital at (0, 0); it owned its land and its holder was at war with it;
    its militia, up to four formations, stood at (NaN, NaN). All of it in the save and in
    the hash.
  - *A loaded game:* `Table.deserialize` makes a table as long as the save's rows (130),
    where the table of the game that went on is 256 long. The loaded one grows at its next
    nation. How long a table is was in no save and no hash, and it decided which nation was
    lost: that is what steered the sim.
  - *The worker against Node:* on the code of before, in a real browser, they part in the
    tick in which the table grows and in no tick before. Why to the bit is not known. A NaN
    out of arithmetic has bits of its own and the hash is over bytes; that is the likely
    part. With the fix they are equal on every day of the year in which the table grows.
- **Decision:** the rule the table's comment had is kept and is now held by a test: **a
  reference to a table's columns is taken after a create, and again after any call that may
  create a row of that table.** How long a table is can then have no effect.
  - *Six places broke it:* `spawnRebels`; `spawnCity`; the month's revolt loop;
    `collapseNation`; `collapseSystem`; and `Table.forEach`, which held `alive` across its
    callback. (`reviveNation` founds no nation and is made alike for the next change.)
  - *The test's instrument:* `Table.volatile`. With it every create moves the table to new
    arrays and fills the old ones with 0x5a. A reference held across a create then reads
    rubbish and writes nowhere at every create, where otherwise only at a growth. A game
    with it on must go as the game without it. It found `spawnCity` on the first day and the
    revolt loop only in a three-year game; the rest were read from there.
- **Not chosen:**
  - *A loaded table as long as the doubling would have made it.* The loaded game would then
    lose the same nation as the game that went on: the test of save and load would pass and
    nation 128 would still be founded dead.
  - *Tables of a fixed length* (65,536 nations, as the land tallies have). It would do for
    nations; formations and elements have no such bound.
  - *All NaN made alike in the hash.* The state has no NaN now but the history's "no place",
    which the language writes one way; tests say so (after forced revolts, and after ten
    years in the sweep stage's three games). A NaN that appears is a defect to be found, as
    this one was.
- **Tests:** in PLAN 2.12a, with what each said when it failed first.
- **What the gate now holds of "a loaded game goes on as the saved one":** the saves of year
  9 of three ten-year games (12 s on the sweep stage). By hand: every year-end of ten years
  on five seeds, 50 of 50. **Not in the gate:** such a check on a seed and in a year nobody
  has run, which is where the critic found this one.
- **Hashes (ADR-55):** the pin `4aafc3eb` did not move, nor seed 99's five years
  (`49389306`): no table grows in them. A game is another one from the tick in which its
  nations table first grows (seed 2718: year 9).
- **Depends on this:** PLAN 2.15's "Free state 128" (the lost origin was its name).

### ADR-83 · 2026-10-05 · accepted — The critic's second run: who ran it, where its findings went, in what order (PROMPT step 2a)

- **Context:** PLAN 2.11 was ticked, so the critic was due (ADR-59: one run a phase). PROMPT
  step 2a says to spawn the `critic` subagent. This session does not have that agent type
  (`.claude/agents/critic.md` is in the repository; the session offers claude,
  general-purpose, Explore, Plan and two helpers): "Agent type 'critic' not found".
- **Decision 1: a general-purpose agent in the critic's place.** Its brief was the role text
  of `.claude/agents/critic.md` with `CRITIC_PROMPT.md` as the whole of its task, and not a
  word about what to look at. "Never act as the critic yourself" holds: the builder wrote no
  part of the report.
  - *What was missing:* the guard hook of the `critic` type (`critic-guard.mjs`: file tools
    write under `critic/` only, no git write). In its place: the two rules, stated in the
    brief, and a check after the run. HEAD was still `3d6a2b2`; `git status` showed the two
    report files changed and new files under `critic/` only; no server was left listening.
  - *Cost:* 50 minutes, 492,000 tokens, 246 tool calls.
  - *The two report files are committed as the critic wrote them.* They are tracked (the
    last report's commit, `23a990a`, is the user's), and left uncommitted a checkout or a
    stash would lose them. The run's other files (`critic/c2_*`, its scripts and shots) stay
    untracked like those of the first run: a PLAN task carries what it needs of them in its
    own text, numbers and all.
- **Decision 2: where the eight blocking findings went.**
  - R2-B1, no naval, air or nuclear: Phases 4 to 6 are its tasks. A line under PLAN 4.5.
    **The phases keep their order.** The critic ranks this first, and naval before armour
    would answer it sooner; the order of the phases is the brief's, and I have not changed
    it. The user can.
  - R2-B4, a loaded game differs: PLAN 2.12. R2-B3: PLAN 2.13 for the formations disbanded
    at tick 1; its second part (tanks that neither behave nor look like tanks) is Phase 3,
    with a line under PLAN 3.6. R2-B2, the close zoom: PLAN 2.14, with the two lines PLAN
    7.4 had on it. R2-B7, one scenario: PLAN 2.16. R2-B8, God actions: PLAN 2.17.
  - R2-B6 is two things. A Kill that founds 36 states and 43 wars, a nation without a name,
    blank flags and a return of land logged as a revolt are mechanisms that do not work:
    PLAN 2.15. How often land breaks away in a plain game is balance: PLAN 1.42 (ADR-58).
  - R2-B5 is two things. A world that does not change outside Europe is balance: PLAN 1.42
    (ADR-58), logged once in PROGRESS, not disputed. A top speed of 10 to 12 s a year is
    performance: a line under PLAN 7.1 and no task before Phase 3, because the top speed is
    what the whole tick allows, and each of Phases 3 to 6 adds to the tick. Mine to answer
    for: the critic holds that the pace matters more than the frame rate.
  - The 21 findings that do not block: under PLAN 1.42, 7.1 and 7.4, a line each.
- **Decision 3: the order of the new tasks.** Step 2b says highest severity first, and the
  critic's order is R2-B2, B3, B4, B6, B7, B8. PLAN has B4, B3, B2, B6, B7, B8.
  - *B4 first:* the state hash is what every other fix is measured with (the pin, the logs
    of ADR-55, the twin games), and by the critic's case it parts between Node and the
    worker, and a loaded game from a saved one.
  - *B3 before B2:* it changes the 1938 world at its first tick (228 formations more are in it), and
    the tests and pictures of B2 are of formations in that world. After B2 they would be
    made twice.
  - This is an order of work, not another judgement of severity. The user can overrule it.
- **Not disputed:** none of the eight. R2-B4 says that a claim of PLAN 2.11j is false, with
  a case that can be run; its task starts by running it.

### ADR-82 · 2026-10-05 · accepted — Occupied land at T2 and T3 is a tint, with an eighth of the hatching (PLAN 2.11f)

- **Context:** occupied land (controller ≠ owner) is hatched: stripes of 7 screen px, the
  occupier's colour darkened against a third of the owner's colour mixed in. That is the
  picture of T0 and T1, and the legend's word for it. PLAN 2.8 put a ground under T2 and T3
  (hillshade, texture, trees, buildings) and the hatching stayed on top of it at full
  strength: 50 of 255 between two stripes where the ground varies by 5. The zoom demo's four
  close pictures, of a pocket in China, are stripes. Every war makes occupied land, and it is
  where a player zooms in.
- **Decision:** with the ground the hatching gives way to it. By the ground's share the two
  stripes close on the tint between them, and an eighth of the hatching stays.
  - *The tint* is what tells occupied land at T2 and T3: the occupier's colour, darker, with
    a sixth of the owner's colour in it. Japan's land in north China is (196, 189, 155)
    where Japan's own is (229, 226, 207).
  - *An eighth, and not none:* the hatching is the map's word for occupation at every other
    zoom, and a weave of 6 of 255 is about what the ground itself varies by on a plain (5 to
    6), so it does not lie over anything.
  - *An eighth, and not a quarter* (tried first, as the task was first written): 13 of 255
    is still more than twice the ground's variation on a plain.
  - *By the ground's share,* so it comes and goes with the T1 ↔ T2 handover like the ground,
    and not at all without the ground (a world without elevation, the tests' switch).
- **Not chosen:** stripes that widen with the zoom (at T3 they would be bands across the
  view); hatching only along the edge of occupied land (the edge is the front, which has its
  border already); no change at T2 and less at T3 (T2 is where the pocket is seen whole).
- **Tests:** the stripes are known, so their contrast is measured against whatever else is
  in the picture (`occupiedGround1938.spec.ts`): 50.7 at T1; 6.0 at 150 and at 20 m/px with
  the ground (50.3 before); 50.7 there without the ground.
- **Left:** the legend says "Hatched: occupied land" at every zoom. A line under PLAN 7.4.

### ADR-81 · 2026-10-05 · accepted — The supply network is a function of the world: a refresh of some blocs gives what a full one gives (PLAN 2.11j)

- **Context:** the fifth independent read (ADR-74) saved seed 99 at tick 2400, loaded it, and
  got another game: I2 of SPEC §2.6 did not hold. A load refreshes the supply network in full;
  the game that goes on refreshes the blocs whose cells changed; and `supply.ts` said itself
  that the two "can resolve a crossing lane differently". The marks of what to refresh are
  "derived (not state)" in `world.ts` and are not saved. So two worlds with one hash could go
  on differently. The year-long test of I2 (PLAN 1.27) saves seed 3 at a tick where they do not.
- **Decision:** make the statement true. The network is a function of the cities, the
  control of the cells and the blocs. A refresh of some blocs gives what a full one gives; the
  marks are not state; the save is as it was.
- **What stood in the way:**
  1. *Lanes.* Blocs meet at the crossing lanes, which go to the lowest bloc that reaches
     them. A refresh of bloc b alone left a lane unclaimed that b no longer reached, though a
     neighbour reaches it; and left a lane with a higher bloc that b now reaches. Now: the
     lanes a bloc holds are remembered with its spans, and the refresh is done again in full
     when one of them is not the bloc's own afterwards, or when the flood comes to a lane in
     a higher bloc's network.
  2. *A bloc looked up too late.* A changed cell marked its old and new nation, and the
     refresh looked up their blocs when it ran. A puppet annexed in between has no overlord
     by then: its cells, flooded as its overlord's, stayed in the overlord's network under
     their new holder. Not in the reader's finding; found here by running two games side by
     side (seed 3, tick 1885: 28 cells). Now: a changed cell also marks the bloc in whose
     network it lay, read from the layer. And as a net under it, a flood that comes to a cell
     its bloc controls in another network makes the refresh full.
- **Why not save the marks** (the load would then follow the game): the network would stay a
  matter of the order things happened in. A full refresh from anywhere else (the editor, a
  game option, a puppet made or freed) would then change lanes that nothing had touched. And
  the hash would have to cover the marks, or two worlds with one hash would still part.
- **Why not always a full refresh:** 6 ms every 12 hours of a war is 0.5 ms a tick, of 1.5.
- **Cost:** pinned, five years of seed 99: 1.200 ms a tick twice (1.164 before). That is
  0.036 ms a tick, some 7% of what always refreshing in full would cost. How many refreshes
  were done again in full was not counted.
  - One kind is done again for nothing: a lane that bloc b held and a lower refreshed bloc
    takes in the same refresh. The result was right already. A line under PLAN 7.1.
- **The pin (ADR-55):** unmoved. Seed 99's first year meets neither case and has 4aafc3eb
  still. After five years daffda22 → 9e83b0a7: it meets one later.
- **Tests:** two directed unit tests (the lane; the annexed puppet), and in the gate's year
  file a game beside one that refreshes in full every time (seed 3, a hundred days) and a
  load from the middle of a war (seed 3, tick 1890). All four fail on the code before.
  Beyond them: the two games for a year on seeds 3, 7 and 1938, never apart.
- **What it says about the invariant:** I2 was tested where it held. A test of "the loaded
  game is the game" needs a save from a state the game is in only sometimes; the side-by-side
  run finds such states without knowing them.

### ADR-80 · 2026-10-04 · accepted — T3: a battalion is drawn by its share of 64 figures (PLAN 2.10b; in place of ADR-69's count)

- **Context:** ADR-69 made an element `min(strength, 64)` figures and named the cost: "at T3 a
  battalion of 500 and one of 100 look alike, and a battalion's losses show only when it is
  nearly gone". It left two candidates. ADR-71 handed the choice to the zoom demo's close stops.
  PLAN 2.10a's two closest pictures are of a Japanese division by Nanking with its 40
  battalions at 123 to 197 of 500 men: each a full block of 64 figures. The batteries beside
  them, at 3 to 5 of 12 guns, show every loss.
- **Decision:** figures by the share. Where an element has up to 64 units when whole (guns,
  tanks, planes, ships), a figure for each unit it has, as before. Above that (a battalion of
  500, on foot, motorised or mechanised), 64 figures when whole and
  `ceil(64 × strength ÷ size)` while it loses men. **This takes the place of ADR-69's
  "Decision, the count".** The rest of ADR-69 (the place, the drawing) stands.
- **Why the share and not a number under each element:** the task is how losses *show*. A
  number captions the picture, and the picture still says 500 men at 142. It would also be a
  new layer of text at T3: 45 numbers under a division's blocks, to place, to fade with the
  T2 ↔ T3 handover, to keep clear of names. The share changes what the picture says, with
  what is already drawn.
- **What ADR-69 held against it, answered:**
  - *"It needs the element's full size in the snapshot."* It does: `size`, 2 bytes an
    element, from the unit type's element size, which the worker has in hand where it reads
    the type's look. The atlas frame cannot stand in for it: a mechanised battalion is 500 men
    with the vehicle's frame.
  - *"It makes no figure a man."* For a battalion no figure was a man above 64 men either: 64
    stood for 500. Under the cap a figure meant 8 men until the battalion was nearly gone and
    one man after. Now it means the same throughout: a 64th of the battalion.
- **Rounded up:** figure k stands while more than k − 1 figures' worth of men are left. So an
  element with men has a figure (rounded to the nearest, a battalion of 1 to 3 men would have
  none), a man lost takes a figure or none, and the block is whole only when it lacks less than
  one figure's worth (493 of 500 and more).
- **The grid is the whole element's:** `gridSide` chose 8 × 8 or 4 × 4 by the figures an
  element *has* (more than 16: 8 × 8). A mechanised battalion down to 16 figures would have
  changed to 4 × 4 in one frame, its figures twice the size and elsewhere. Under the cap that
  took a battalion of fewer than 17 men; under the share it is a quarter of its strength. The
  grid is now chosen by the figures of the whole element.
- **Not changed:** T2. A sprite dims only below 8 units, so a battalion at a third looks whole
  at T2 still (BLOCKERS, for the review). Nor the order in which figures go: gaps open across
  the block, as ADR-69 decided, so a battalion at a third is a scatter in its footprint and
  not a smaller block.
- **Measured** (the demo, seed 1938, day 30): the division has 861 figures where it had
  2,579; its battalions 16 to 26 each. Nothing costs more: fewer instances, and a count that
  is one division and one rounding an element.
- **Tests restated, for the user to overrule** (both asserted the cap): the unit test of the
  count and of the grid, and `individuals1938`'s figures of each element. Seen first on the
  code before: 1,584 figures against 1,580 there, and 64 against 19 for a battalion of 142 in
  the demo.

- **Addendum, PLAN 2.11g (2026-10-05): at T2 the sprite's opacity is the element's share.**
  - *What was left open above:* "Not changed: T2. A sprite dims only below 8 units." A
    battalion at a third of its men was a whole sprite at T2 and a third of its figures at
    T3: the zoom across 30 m/px showed a loss that the view before it had not.
  - *Decision:* opacity = 0.45 + 0.55 × strength ÷ size. Whole at full strength, never under
    0.45 while a unit is left (the sim removes an empty element). The same rule for every
    kind: a battery with 4 of 12 guns is as pale as a battalion with 167 of 500 men.
  - *Not smaller* (a sprite is 5 px at the far end of T2, and its least size would hide the
    change), *not a bar or a number under each* (a second layer, of some 500 marks in a view of
    a front), *not darker* (the colour is the nation's).
  - *What it does not do:* on a light nation colour over a light fill the difference between
    0.55 and 1 is small to the eye. A line under PLAN 7.4.
  - *Tests:* the rule (unit); in the zoom demo, every sprite of the close views against its
    share, failing first.

### ADR-79 · 2026-10-04 · accepted — Formations stand on land by the fine mask; the coast of T2 and T3 is drawn from it (PLAN 2.9)

- **Context:** SPEC has the fine land mask "used by the sim for element placement ... and by
  the renderer for coastlines. Both read the same bytes, so they never disagree." Neither is
  so. The sim knows only the cells' terrain, and a cell is land when half of it is: its
  middle, where a formation stands, need not be. The renderer draws every coast from a
  coverage a quarter as fine as the mask.
- **Measured** (1938, seed 99, by the mask's nearest bit): 200 of 23,210 elements on water
  at the start, in 18 formations, 11 of them wholly; between 124 and 353 through a year. The
  furthest is half a cell out.
- **Decision 1: the fix is in the sim.** A formation that would take a place on the mask's
  water takes its cell's land point, the point of the cell furthest from water. Its place is
  state, so the pinned hash of seed 99 moves; logged when it does. No sweep follows (ADR-58:
  one `sweep:quick` at the phase review).
  - *Why not a correction of what is shown:* 11 of the 18 formations are wholly on water
    because the formation is. Moving their elements to land one by one heaps 28 sprites on a
    shore; moving the block by half a cell puts it 10 km from its own marker (ADR-70 has the
    block about the formation's place at every tier).
  - *An element on water all the same* (the block is 0.24 by 0.12 cells; a spit can be
    narrower) stands on the nearest land towards its formation's place. That is not state:
    an element's place is worked out from its formation's, and the snapshot, the fire events
    and the event of its end use one function.
  - *Not in it:* a march between two cells' land points is a straight line and can cross a
    bay. That needs routing below the cell; on the watch list, and the test is of formations
    at rest.
- **Decision 2: one predicate.** "Land at (x, y)" is the mask's bit of the px that holds the
  point, written once in `src/shared` and used by the sim's rule, the renderer's threshold
  and the tests. (The renderer thresholds a bilinear coverage at a half today: that and the
  bit differ by up to half a px.)
- **Decision 3: the coast of T2 and T3 from the mask,** in the pass with the ground. A mask px
  is 2.4 km, 2,400 px at 1 m/px: inside it the coast is moved by the ground's noise, by less
  than half a px, so that it is a shore and not a ruler's edge, and never says other than
  the bit further than that from the line. The coast of T0 and T1 stays the coverage's.
- **The order:** 2.9a first (the task's own test, and the pin), then 2.9b.
- **Cost known beforehand:** the mask is 16.8 MB of bits in the sim's process (the budget at
  XL is 160 MB); the worker loads it already for the coverage and will load it before the
  world is built instead of after.

- **Addendum, PLAN 2.9a (2026-10-04): done; the pin moved.**
  - *The pin (ADR-55's pattern):* seed 99 after one year **f93cb674 → f5725b37**; after five
    years 6b84c48c → 68e0a69e. The reason: a formation's place is state, and where it would
    have been on the fine mask's water it is the cell's land point now. For what is drawn,
    not for balance; balance was not measured again (ADR-58).
  - *The control:* a world built without the mask still has f93cb674 after the year. The
    rule is all that moved the hash.
  - *After:* at the start and after 30 and 90 days no formation at rest and no element of one
    is on the mask's water (200 elements at the start before). 8, 6 and 6 elements are drawn
    in from a slot on water.
  - *A cell's middle is land when the four mask pixels round it are.* The first version asked
    the mask at the middle itself, which is a corner of four pixels and reads as one of them.
    A formation on such a corner had its block in the other three: 33 elements were drawn in
    at the start, 25 of them all the way to the formation's own place, in a heap. With four
    pixels: 8 drawn in, none all the way.
  - *One function for an element's place* (`slotPlace`): the snapshot, the fire events and the
    event of an element's end. `wrecks1938` and `fire1938` hold unchanged.
  - *Every way of building the 1938 world has the mask* (looked for): the worker's init, and
    the Node loader that the tests, the sweeps, the runner and the diagnosis use. The runner
    prints the new pin.
  - *What was seen first* is the measurement in the context above, by a scratch script; the
    committed tests need the task's own code and cannot run on the code before it.

- **Second addendum, PLAN 2.9b1 (2026-10-04): the standing rule is "surely land"; the pin moved again.**
  - *The pin:* seed 99 after one year **f5725b37 → 99c1a04e**; after five years 68e0a69e →
    b203bc49. A world without the mask still has f93cb674. Balance not measured (ADR-58).
  - *Why a task that was to be the renderer's changed the sim.* This ADR had 2.9b draw the
    coast "moved by the ground's noise by less than half a px, so that it ... never says other
    than the bit further than that from the line". A shore that wanders inside a pixel is land
    by the bit and sea in the picture in places, and an element can stand there. Measured on
    the 12 formations nearest the water (193 elements): 14 with the drawn sea under them with
    the coverage's coast, 5 with the mask's coast and 2.9a's rule, none with the rule below.
    So the rule moved, in a commit of its own (one cause to a commit), before the coast.
  - *The rule:* the four mask pixels round a place, blended by nearness, make a field from 0
    to 1 with the coast at a half. A place is surely land at 0.85 or more: then its own pixel
    is land (with it water the field is 0.75 at most), and the shore's noise, which is at most
    0.35 × 4f(1 − f), leaves it land (0.67 at 0.85). Formations and elements stand on sure
    land; trees will (2.9b2).
  - *One number in one place:* `SHORE_NOISE` is the module's, the shader takes it from there,
    and a unit test holds it and `SURE_LAND` together. A shader with a larger noise of its own
    would put elements in the drawn sea and nothing would say so.
  - *Not the other way round* (the picture never draws sea in a land pixel): the shore then
    has every convex corner of the pixels as a right angle, and an islet of one pixel is a
    square.
  - *The cost found by the runner:* combat asks for a place with every shot. Asking the mask
    each time made a year's mean tick 4.92 ms for 2.45. A cell's answer is kept once the cell
    is known to be inland (its pixels and the ring round them all land); then the mask is
    asked for coastal cells only. Pinned to the performance cores, five years: 1.45 and
    1.44 ms; the code before 2.9a: 1.50 and 1.49.
  - *Seen first:* `coast1938.test.ts` reading the mask this way fails on 2.9a's rule (five
    elements of formation 367 at the start).

- **Third addendum, PLAN 2.9b2 (2026-10-04): the coast of T2 and T3 is drawn from the mask. PLAN 2.9 is done.**
  - *The texture:* the mask's bits as they are, a byte to a texel: R8UI, 2048 × 8192, 16.8 MB.
    A texture as wide as the mask (16384) is more than many a GPU takes; this one needs 8192.
    No smaller levels: the pass that reads it runs under 300 m/px, where a mask pixel is 8 px
    of the screen or more.
  - *The line:* four fetches and a blend, the rule of `maskField` on the CPU. Where the four
    agree the answer is the bit and nothing more is computed. Where they differ a noise moves
    the line, by `SHORE_NOISE` at most, by nothing at 0 and at 1. So the picture and the bit
    can differ only in the squares between four pixel middles that differ. The e2e compares at
    places whose 3 × 3 pixels agree and finds none against in nine views.
  - *The handover is a cross-fade of two coasts, not a blend of two fields.* The first version
    mixed the coverage and the mask's field by the share. The shore then travelled from the one
    coast to the other, and every pixel on its way went from sea to land in one frame.
    `groundThings1938` caught it (51.3 of 255 in a frame; its limit is 48). Now each coast says
    land or sea, the pixel is land by the two shares, and each has its coast line by its share.
  - *T0 and T1 are untouched:* the program without the ground has none of this (`#ifdef`). The
    Strait of Dover at 4000, 1000 and 400 m/px has the same hashes on this commit and on the
    one before (9f48d9a8, 937c10bf, c1e5e771, the tests' rasteriser).
  - *Lakes:* the mask has lakes that the coverage (the share of a block of 4 × 4, land over a
    half) has not. They are in the picture at T2 and come in with the handover. No formation
    stood in them since 2.9a; no tree does now. A lake that is not there at T1: watch list.
  - *The scatter* asks `maskSure` on the CPU, whatever the GPU took. The coverage is no longer
    its water.
  - *Cost* (bench A, 1080p, RTX 4070 Ti, the ground in full; two new views with a coast through
    them, 47 % and 31 % land): 0.748 → 0.775 ms and 0.705 → 0.735 ms with the mask in the
    coverage's place. T0 0.52 ms (0.51). The page holds the mask twice, 16.8 MB on the CPU
    (the scatter) and as much on the GPU.
  - *Test first, and one test that was not:* the first test of `coastPicture1938` fails on the
    commit before (2 places of the mask's land drawn as sea at Dover, 150 m/px). Its test of
    the elements passes there too: the 14 in the drawn sea were cleared by 2.9b1's rule, with
    either coast, in the 12 formations looked at. It stands as a guard.

- **Fourth addendum, PLAN 2.11i (2026-10-05): the land points broke the march at the seam's test. The pin moved.**
  - *The pin:* seed 99 after one year **99c1a04e → 4aafc3eb**; after five years b203bc49 →
    daffda22. A world without the mask still has f93cb674. Balance not measured (ADR-58).
  - *The defect, found by the fifth independent read (ADR-74):* `movementSystem` knew a step
    across the seam of a looping map by its ends being "more than 1 apart in x", and turned
    it round. True while every place was a cell's middle. This ADR gave coastal cells a land
    point, and two neighbours' points are up to 1.9 apart: such a step was walked the long
    way round the world, 100 cells an hour, the formation facing along it, fighting where it
    passed, and taking a new order from where it was. Seed 99, the first year: 90 formations,
    1,587 formation-hours more than 3 cells off their march.
  - *The fix:* a step is across the seam when its ends are more than half the map apart, as
    `combat.ts`, `production.ts`, `revolts.ts` and `majorBattles.ts` measure it.
  - *Why nothing of this ADR's saw it,* and what is there now:
    - its tests are of formations at rest (`coast1938.test.ts` skips those on the march, by
      design: a march may cross a bay);
    - "0 of 134 marches over water at day 30" was a count at one tick, of water, not of where
      a march should be;
    - the pin holds whatever the code does;
    - now: a year-free bound, in the unit suite. Seed 99, 60 days: no formation on the march
      is more than a cell from where it was an hour before (it failed at hour 112).
  - *The tick,* pinned, five years: 1.164 ms twice; 1.45 with the flights. Another world (the
    flights made battles), not faster code.
  - *Both hashes of this ADR's earlier addenda were of a world with the defect:* f5725b37
    (2.9a) and 99c1a04e (2.9b1). So was the smoke sweep of the phase review (PLAN 2.11a).
    ADR-58 means one smoke run of the phase's code: it is run once more, after PLAN 2.11k,
    the last change of the sim in this review (PLAN 2.11n). Nothing is tuned for either.
  - *An assertion restated with it, for the user to overrule:* `declutter1938.spec.ts` (PLAN
    1.45b) asserted that central Europe shows more T0 counters at each of four steps of zoom,
    at the start and a year into seed 1938. Two of the steps stay within one level of
    clusters, where the count grows only if a folded counter finds room. A year in, one did
    between 6 and 8 px a cell in the world with the flights; in this one none does (24 and
    24; no overlap, nothing at less than full, as before). It now asserts: more where the
    level changes, never fewer within a level, at least two finer levels on the way, and more
    than twice the counters at the end. Passes on both trees: not a test of the fix.
  - *Not the same thing, for the next reader:* `movement.ts` also has `if (dx > 1) dx -= w` a
    few lines up. That one is on cell columns, whole numbers: neighbours differ by 0 or 1 and
    the seam by the map's width less one. It is right as it stands.

- **Fifth addendum, PLAN 2.11k (2026-10-05): a muster in a theatre was the one place 2.9a missed.**
  - *The defect, found by the fifth independent read (finding 3):* a division raised in an
    overseas theatre appears by the bloc's city nearest the front, and `musterPoint` returned
    that city's own place, or a front cell's bare middle. Gibraltar's place is in a water
    pixel of the mask: a British division raised there stood in the sea, all 28 elements of
    it (`slotPlace` leaves the slots alone when the formation itself is not on land).
  - *The fix:* `standPoint` of the city, `cellPoint` of the front cell.
  - *The pin (ADR-55):* unmoved, 4aafc3eb. In the world since PLAN 2.11i seed 99 raises no
    division at such a place in its first year. After five years 9e83b0a7 → 49389306.
  - *The test this ADR lacked:* `coast1938.test.ts` looks at three days of one seed. The year
    file of the gate now looks at every formation at rest on every day of a year, on seed 1,
    where four divisions stood in the sea at Gibraltar on day 91.
  - *Left as it is, on the list under PLAN 7.4:* the cities themselves. 140 of 5,757 have
    their place in a water pixel of the mask and 387 not on sure land; their dots are drawn
    there.

### ADR-78 · 2026-10-04 · accepted — The ground at T2 and T3: hillshade and texture in the map pass, instances over it (PLAN 2.8)

- **Context:** PLAN 2.8 asks for hillshade from the elevation pyramid and procedural detail
  (ground texture, trees, rocks, buildings near cities) at T2 and T3. What there is:
  - The map is one full-screen pass (`mapShader.ts`): fills from a palette, smooth borders,
    the fine coast. It knows the terrain class of each cell and nothing of height.
  - Elevation ships at 2048, 1024 and 512 wide (`elev-*.i16d.wsz`, int16 metres) and is not
    loaded by the app. At the map's size that is one sample a cell, some 20 km: at T2 a cell
    is 65 to 650 px wide, at T3 more than the screen.
  - The e2e suite draws on a software rasteriser: what the pass costs there, every spec pays.
- **Decision: three parts, by the way they are drawn** (PLAN 2.8a to 2.8c).
  1. *Hillshade, in the map pass.* The slope of the elevation, smoothed over the cells so
     that no cell shows as a facet, lit from the north-west, laid on the fill.
  2. *Ground texture, in the map pass.* Noise by terrain class on the fill, and small relief
     added to the slope: the data's relief is smooth at these zooms, and without it the
     close view is flat. Finer octaves come in as the zoom nears.
  3. *Instances, over the map.* Trees, rocks and buildings as instanced quads from a scatter
     seeded by the place, as the element sprites are drawn.
- **Not tiles kept in textures,** though PLAN's word is "tiles": a pass that works out the
  ground for each pixel has no seams, no cache to manage and no step between zoom levels.
  What a cache would save is cost per frame. If the pass proves too dear on the bench or in
  the e2e stage, the texture part moves into tiles; measured after each part.
- **The detail comes in with the T1 → T2 handover's share** (ADR-71): the ground arrives with
  the sprites, by a fade of real time, not at a threshold of the zoom. Inside a branch on that
  share the pass does the new work; outside it, T0 and T1 cost what they cost.
- **Seeded by the place and nothing else.** No clock. The game's seed is not in it: two games
  on one Earth have the same ground. (Only real maps have these layers; the toy world has no
  terrain raster and draws as before.)
- **In every map mode:** SPEC's table gives the ground to the tier, not to a mode. It is laid
  on whatever the fill shows.
- **Noise that holds at 1 m/px:** a pixel there is 5 × 10⁻⁵ of a cell, and the pass's own
  noise coordinates (a cell number modulo 256 plus a fraction) resolve 3 × 10⁻⁵: the finest
  octaves are built on integers (the cell and the lattice point within it), hashed as
  integers, with the fraction kept small. Periods divide the map's width, so the seam of a
  looping map has no line.
- **Before:** bench A on the clean tree (RTX 4070 Ti, 1080p): 0.51, 0.48 and 0.45 ms of GPU a
  frame at the world, at 4 px a cell and at 48 px a cell; budget 1.0 at T0. The e2e stage:
  5.5 minutes.

- **Addendum, PLAN 2.8a (2026-10-04): the hillshade as built.**
  - *The data's path:* a message of its own after `mapLayers`, so the map and its coast do
    not wait for 2 MB of elevation; an integer texture (R16I), one texel a cell, read with
    `texelFetch`.
  - *Smoothed by the borders' spline, the slope from its derivative:* sixteen fetches for a
    slope that is continuous from cell to cell. Two bilinear taps would show each cell as a
    facet, at 65 px a cell and more.
  - *Steepened 12 times:* a cell is some 20 km, and the slope from one cell's mean height to
    the next is a few hundredths even in the Alps. Chosen by the picture: the relief reads and
    the fills keep their colours. The limits (0.6 to 1.25 of the fill) keep a nation's colour
    its own on the darkest slope and a pale fill from going white on the brightest.
  - *The sea is level:* its floor would put a bright and a dark band along every coast.
  - *One cell size for the whole map:* in Miller's projection a cell is fewer km wide than
    high away from the equator; the shading takes one figure. The relief is a picture of the
    ground, not a measure of it.
  - *Seen first:* with the data in the renderer and no shading, the test's two pictures were
    one. *T0 and T1 are the old pass:* hashes at four zooms equal before and after, with the
    layer and without it.
  - *Cost:* 0.08 ms of GPU a frame at 1080p where the ground shows (0.53 against 0.45); nothing
    where it does not. In the tests' software rasteriser a frame and its read were between 95
    and 155 ms with the layer and between 95 and 129 without, from one run to the next: the
    e2e stage's length is the measure there.
  - *What the picture is:* broad, soft relief. At 100 m/px one sample in 20 km is a slow wash
    of light and dark. The small relief is PLAN 2.8b's.

- **Second addendum, PLAN 2.8b (2026-10-04): the ground texture as built, and two things of 2.8a set right.**
  - *Set right, the cost at T0 and T1.* This ADR had "inside a branch on that share the pass
    does the new work; outside it, T0 and T1 cost what they cost". With the texture's loop of
    octaves inside the branch, bench A measured the map of T0 at 0.77 ms where it had been
    0.51, the branch never taken: the compiler does not leave a loop of that size behind a
    branch. The ground has a program of its own now (the same source with GROUND defined),
    used while any of the ground shows; the pass of T0 and T1 is compiled without it and is
    back at 0.52.
  - *Set right, the shading's limit.* 2.8a cut a slope's shade off at 0.6 and 1.25 of the
    fill. With the small relief added that made two tones of a mountainside. The limit is
    soft now (0.58 to 1.28, approached by a tanh), and the hillshade's own numbers moved with
    it: over the Alps the fill's brightness varies by 18 of 255 (it was 23), and slopes facing
    the light are brighter by 24 and 21 (44 and 45). Its test holds unchanged.
  - *Gradient noise, not value noise.* The first version used value noise with its slope.
    That slope is nought along every lattice line, and the shading showed the lattice as a
    grid (seen in the picture at 250 m/px).
  - *Integers name the lattice.* Octave k has 2^k points to a cell; a point is the centre
    cell times 2^k plus a small whole number, hashed as integers. Only the place between two
    points is a float. At 1 m/px: no streaks (as much change across as down), no block of
    64 px twice among 252.
  - *An octave counts by its wavelength on screen,* from 256 px to the finest drawn: 16 px at
    the far end of T2, 2.5 px from 20 m/px in. A function of the zoom, continuous: an octave
    comes and goes by its weight. The detail measured rises at each of four zooms.
  - *The class of the ground, not its colour.* The fill says whose the land is and keeps its
    hue; the terrain class sets how rough the ground is (mountains 1, hills 0.55, forest 0.34,
    plains 0.14) and shifts its brightness a little. Terrain colours stay the terrain mode's.
  - *The toy world has no ground,* though the texture needs no elevation: one switch for the
    ground as a whole (the elevation's arrival), by decision. It has no terrain raster either.
  - *Cost where it shows:* 0.82 and 0.88 ms of GPU a frame at 1080p (the hillshade alone:
    0.53). SPEC's budget at T2 is 2.0 with 10,000 sprites; 2.8c's instances come on top.

- **Third addendum, PLAN 2.8c1 (2026-10-04): where the instances stand.**
  - *What a tree is at T2:* a crown of 9 m is a thirtieth of a px at 300 m/px. Drawn to
    scale, nothing would show before the last of T3. So an instance is a symbol at T2 (a few
    px: "wood here", "town here"), as the units' sprites are, and the thing itself once the
    zoom shows it larger than its symbol.
  - *One place whatever the zoom: a nested lattice.* Level l has 2^l points to a cell; a
    point of a level is a point of every finer one; an instance belongs to the coarsest level
    its point is on. Zooming in adds instances between those that are there and moves none.
    A lattice chosen afresh for each zoom would put every tree elsewhere at each step.
  - *The next level comes in by its opacity,* through the upper half of the octave of zoom
    before its points are 14 px apart: a function of the zoom, as the texture's octaves are.
    A step of 1% of zoom changes no opacity by more than a tenth (tested).
  - *On the CPU, not in the vertex shader.* The shader could find each instance from its
    number with no buffer at all, but the scatter is what the task's unit test is of: one
    function, tested, and drawn from its output. It costs 0.4 to 1.2 ms for a full view of
    forest at 1080p (Node), and only when the camera moves.
  - *Buildings by the cities, not by the urban terrain class:* a city's cell is 20 km wide
    and urban all over; its buildings reach 3 to 18 km from its dot by its size.
  - *Water by two rules:* the cell's class, and the fine coast's coverage where it is known
    (with a margin: nothing stands on the coast line). PLAN 2.9 is of the same coast.
  - *Not done here:* the cities near the seam of a looping map reach only to it.

- **Fourth addendum, PLAN 2.8c2 (2026-10-04): the instances drawn; and what goes on the GPU.**
  - *Drawn by the fragment shader, not from an atlas:* three things, each a few lines of
    shape and light. No picture to make, ship or keep in step with the light's direction.
  - *Natural colours on the nation's fill:* green crowns on a blue Finland. The other way,
    tones of the fill, would read as texture and say nothing of what stands there; at T2 that
    is what a player looks for (cover, a town).
  - *Under the ground's one switch and its share:* nothing of T2 shows without the rest.
  - *The user's question, while this was built (2026-10-04): "should we move things to the GPU
    where possible even if we cannot unit test them?"* Answered then, and kept to unless the
    user says otherwise:
    - What is paid for each pixel or each instance in each frame is on the GPU already: the
      hillshade, the texture, the drawing of every tree. It is tested in the browser, by the
      pixels: "cannot be unit tested" is not "cannot be tested".
    - What is left on the CPU is where the instances stand. Measured in Chrome on the bench:
      0.5 ms a frame for 8,685 instances, while the camera moves and not at rest; the main
      thread's budget is 6 ms. On the GPU's side the instances cost nothing that can be read
      (0.84 ms a frame with them, 0.86 without).
    - Its rules (one place whatever the zoom; no opacity moves by more than a tenth in a step
      of 1%; the seam; water) are tested in milliseconds, and three faults put in on purpose
      were caught. A test by pixels looks at one view in seconds and would not see a tree
      half a pixel off.
    - *So: by measurement, not as a rule.* The scatter stays on the CPU. If a frame's CPU at T2
      or T3 goes past its budget on the bench, or the cap begins to cut views that players
      have, it moves to the vertex shader (the terrain and the coast are textures already;
      the cities need a small one), and `scatter.ts` stays as what the shader is checked
      against. The worker is the other place for it, and keeps the tests as they are.

- **Fifth addendum, PLAN 2.11l (2026-10-05): the ground does not outlive its zoom.**
  - *The defect, found by the fifth independent read (finding 4):* leaving T2 the element
    sprites go by the clock (in full for 220 ms, then a fade), and this ADR tied the ground
    and its instances to their share. The camera closes on its target at 18 a second: after a
    spin of the wheel it is at 4000 m/px in a tenth of a second, with the ground's share
    still 1. The scatter had no rule for zooms further out than its level 0 and gave every
    lattice point of it: 20,502 trees for a view of 1920 × 1080 at 5000 m/px, cut off at the
    cap of 12,000, at a line. And the ground's pass read the fine mask at half a screen pixel
    to a pixel of it.
  - *Decision, the view:* the ground's share is the sprites' share times a reach by zoom: 1
    up to 345 m/px (T1's lower limit × the hysteresis: where T2 is left), 0 from an octave
    beyond, smooth in the logarithm between. Inside T2 nothing changes. A camera that stops
    between the two zooms sees the clock finish the fade as before.
  - *Decision, the scatter:* further out than level 0 the levels go on, coarser, by leaving
    out points of level 0 (every 2^k-th each way is level −k). The identity of a point is
    the one it has at level 0, so nothing moves and no picture of T2 changes.
    - *Not a floor by opacity,* which PLAN 2.11l's acceptance test had asked for: a level
      that fades out over an octave is still given whole until its opacity is zero, four
      times as many points at the end as at the start, and is cut off at the cap on the way.
    - The view never asks the scatter for such a zoom now (the reach is 0 there). The scatter
      is right there all the same: it is a function of a view, and tested as one.
  - *Measured:* the reader's view at 5000 m/px, real map: 1,292 instances in 1.1 ms (5.0 ms
    for the 12,000 before). Out by the wheel from 250 to 1500 m/px: two frames with ground
    beyond 345 m/px, at most 4,390 instances in a frame. Bench A's view with instances: 8,685
    and 0.5 ms of CPU, as before.
  - *Not changed:* the element sprites themselves still go by the clock at whatever zoom
    (at their least size of 5 px, a few blocks for half a second). The handover of ADR-71.

- **Sixth addendum, PLAN 2.11m (2026-10-05): the map's canvas is opaque.**
  - *The defect* (a suspicion of the fifth independent read, settled in the browser): the
    instanced renderers of PLAN 2.3 and 2.8c2 blended with one function for colour and alpha,
    (SRC_ALPHA, ONE_MINUS_SRC_ALPHA), into a canvas that has alpha. Over an opaque map that
    leaves the colour right and the canvas's alpha at 1 − a(1 − a): 0.75 under a shadow at
    half opacity, less where layers lie on each other (0.54 read). The browser then lets that
    share of the page's background through. Over a forest at T2: 227,136 px of the page not
    the canvas's colour, by up to 26 of 255.
  - *The fix:* the alpha is blended (ONE, ONE_MINUS_SRC_ALPHA): over an alpha of 1 it stays 1.
  - *Why no test saw it:* every test that reads colours reads the canvas (`readPixels`), where
    the colour was right. Every picture looked at was a screenshot of the page, where the
    error was a quarter of a dark blue under things that are dark already.
  - *The test:* the page against the canvas, pixel for pixel, with the rest of the page
    hidden. It is the only spec that compares the two.
  - *Not done:* a context without alpha. It would make the page right whatever the blend
    state, and it would make the canvas's alpha read 255 whatever is drawn: the test's first
    assertion could then never fail.

### ADR-77 · 2026-10-04 · accepted — T1 markers of one nation that stand on each other are one marker (PLAN 2.7s1)

- **Context:** a T1 marker stands on its formation's centre, and formations of one nation often
  stand on one spot. On Spain's front after two weeks, at 1200 m/px, 13 pairs of markers of one
  nation were more than a quarter under each other (7 at 600 m/px, 5 at 310): the number of the
  one underneath could not be read. ADR-65 had left it "not solved here".
- **Measured before the design** (PLAN 2.7s has the table): pushing the boxes apart, each kept
  within half a marker of its formation, does not come to rest on that front at any zoom.
  Stacking by nation leaves no such pair at 1200 m/px and closer.
- **Decision:**
  - A marker that is more than a quarter of its box under a stronger marker of its nation goes
    into that one (the one it is most under, when several). The strongest first, so a stack is
    what stands on its lead and no chain.
  - The lead keeps its own symbol, flag and bar. Its number is the men of all it stands for,
    and a tag "×n" on its corner says how many. The tag is drawn after all the boxes: on the
    first try it stood beside the number and neighbours' boxes hid it.
  - A marker in a stack stays there until it is under its lead by less than a tenth. A change
    is a fade in place over 250 ms; the lead shows the sum at once. A marker new to the view
    takes its place at once.
  - Markers of two nations are never one marker: who faces whom is what this tier shows.
- **The men of all, not the lead's own.** SPEC's "one truth": the numbers on the map add up to
  the formations in view. A stack that showed its lead's men would hide the others'.
- **Two specs restated.**
  - `markers1938` asserted, marker by marker, "its number is its formation's element sum". For a
    stack that sentence has no single formation. It reads now: a marker's number is the element
    sum of the formations it stands for, itself first, and no formation is stood for twice. For
    a marker alone that is the old sentence, word for word in the test; for all markers
    together it says more than the old one did (every formation is counted, once).
  - `handover1938`, running: "every marker is at opacity 1" became "the layer's most opaque
    marker is at 1", which the spec already said of the counters for the same reason (ADR-65):
    while the armies move, markers go into stacks and come out, each by its own fade. Paused,
    every marker is still asserted at 1.
- **Rejected:**
  - *Pushing boxes apart only:* does not rest (above).
  - *Folding across nations as the T0 counters do* ("+n"): at T1 the enemy's marker is the
    information.
  - *The tag inside the box:* the morph into T2 keeps a picture of the box by nation, symbol
    and state; a count in it would make a picture for every count.
- **Cost:** every formation of the world is stacked in every frame at T1: 0.4 to 0.5 ms for the
  1,054 formations of the 1938 start (a grid of boxes, so that it grows with their number and
  not its square).
- **Not solved here:** markers of two nations on each other across a front at the far end of T1
  (PLAN 2.7s2). At T1 the markers stand on city names (BLOCKERS, with PLAN 2.7r).
- **Tests:** `tests/unit/markerStacks.test.ts` (11); `tests/e2e/markerStacks1938.spec.ts`;
  `counters1938`, `fades1938`, `morphNations1938`, `tiers1938`, `player1938` unchanged and
  passing.

- **Addendum, PLAN 2.7s2 (2026-10-04): markers of two nations move apart.**
  - *What was left* after the stacks: on Spain's front at 1900 m/px, 7 pairs of markers of two
    nations more than a quarter on each other (a cell is 10 px there, a marker 26).
  - *Decision:* the two boxes of such a pair move apart by half each, along the axis that needs
    the shorter move, until neither is under the other by more than a quarter; no box further
    than 6 px from its formation. The order arrow still starts at the formation.
  - *Over time:* a box keeps its move from frame to frame while the armies move under a camera
    at rest, and goes back when it touches no other box where its formation stands. It eases to
    a new move over 150 ms (the capital flags' time). At another zoom the moves are found
    afresh: what stands at rest after a zoom does not depend on the frames of the way there
    (ADR-75's lesson; the first version kept the moves of 1800 m/px at 1200, where none is
    needed).
  - *ADR-72 stands:* "the box does not move" during the morph into T2. The moves are frozen
    while a box shrinks; and at 310 and 340 m/px no pair of two nations was more than a quarter
    on each other in either region measured, so no box is off its formation there.
  - *Measured:* at 1900 and 1800 m/px 12 boxes move, by 3.2 and 2.7 px at most; at 1200 none.
  - *What it does not do:* a quarter of a box can be the number. At 1800 m/px the front is
    still a band of boxes that touch, and some numbers are partly covered. BLOCKERS watch list.

- **Second addendum, PLAN 2.7v (2026-10-04): the moves have no memory.**
  - *What was wrong:* the first addendum has "a box keeps its move from frame to frame while
    the armies move under a camera at rest". The moves of a frame started from those of the
    frame before. Where three markers of more than one nation are crowded beyond what 6 px can
    part, no set of moves satisfies the rule; each frame's passes ended somewhere else on a
    cycle, every target changed by more than a hundredth of a px, and the layer said for ever
    that it animated. Found by the third independent read (ADR-74): 29 of 324 samples of a 1938
    game, the first at day 90. The specs of 2.7s2 looked at day 14.
  - *Decision:* every box starts on its formation in every frame. The same formations give
    the same boxes; a view at rest has nothing to change.
  - *What is given up:* the memory was there so that a pair whose formations move a little
    keeps the axis it parted along. Without it a pair can part along x in one tick and along y
    in the next; the ease of 150 ms carries the box over. The markers stand at the places of
    the tick (they are not eased between ticks), so that can happen once in a tick and no
    oftener. Not seen in a picture yet.
  - *Tests:* the unit test of the memory ("a box keeps its move while it serves") is replaced
    by one of what holds now, and the three assertions of "at another zoom the moves are found
    afresh" by one of the ease that gives a move up. Restated, not weakened: the thing they
    pinned is the defect's cause.
  - *What the first addendum's "at another zoom the moves are found afresh" was for* is now
    true of every frame.
  - *The lesson, in ADR-74's third addendum:* a layer with a memory of the frame before is run
    on one input until it rests, on random inputs, in a unit test.

- **Third addendum, PLAN 2.7w (2026-10-04): a box that goes into a stack fades where it is.**
  - *What was wrong:* a marker in a stack had no move: in the frame it went in, its box stood
    on its formation. One that had been moved apart from another nation's marker jumped back,
    up to 6 px, at full opacity, and faded there (ADR-74, third read, finding 3).
  - *Decision:* while anything of it shows, a box on its way in keeps the place it is drawn at
    (where its ease had brought it, not where the ease was going). One that comes out again
    before its fade has ended eases from that place to where it should stand.
  - *When nothing of it shows, it keeps nothing:* one that comes out later is new among the
    shown and stands where it should at once, as before. What stands at rest does not depend
    on what faded there (ADR-75's lesson).
  - *This is the animation's own state, not the memory 2.7v removed:* it is read only while the
    fade runs, and where the leads stand is still a function of where the formations stand.
  - *Tested as the third read's addendum asks:* armies moving at random, 40 games of 150
    ticks; no box that shows moves off its formation by more than a step of the ease.

- **Fourth addendum, PLAN 2.7z (2026-10-04): on the way back from T2 a box grows where it will rest.**
  - *What was wrong:* ADR-72 has the boxes stand still while the morph into T2 shrinks them, and
    the layer kept each box's move for that. At T2 nothing is drawn and the layer is cleared;
    on the way back there was no move to keep, and "still" then meant "on the formation". The
    boxes grew there for 470 ms, markers of two nations on each other, and eased apart when
    the morph ended (ADR-74, fourth read, finding 1).
  - *Decision:* while the boxes stand still, one with no move to keep stands where the parting
    puts it. On the way back that is every box, from its first frame; on the way in, a marker
    new among the others. Boxes that have moves keep them, as before.
  - *What is not changed:* the first frame of the way into T2 still starts a move to the new
    zoom's places (the reader's suspicion; on the watch list).
  - *A camera that eases through the way back* (the wheel): each box takes its place at the
    zoom of its first frame and keeps it until the morph ends; then it eases to the place of
    the zoom reached. Small, and by the ease. Not measured.

### ADR-76 · 2026-10-04 · accepted — A city's name takes the first free place by its dot, keeps it, and moves by a cross-fade (PLAN 2.7r)

- **Context:** the T0 counters are drawn over the city names, and a capital's name stood to the
  right of the dot its nation's army often stands on. Over Europe at the 1938 start, at
  4000 m/px, a counter was on the letters of 17 of the 31 names shown and a flag on 3.
- **Decision:**
  - *Places.* A name takes the first of these where nothing is on its letters: beside the dot
    (right, left, below right, below left, below); past the counter or flag that stands there (to
    its right, its left or below it, no further from the dot than 40 px to the side and 26 px
    down); above (right, left, centred). With none, it is left out.
  - *What is in the way:* names placed before it (by their boxes, as before), the T0 counters
    that are at least half visible (the flags' rule) and the capital flags with their frames.
    The names are laid out after both; they have a canvas of their own, so the order of the
    layers does not change.
  - *It keeps its place,* to the pixel, as an offset from its dot, while nothing stands on it.
    A place it would prefer coming free does not move it, and it does not follow a counter.
  - *It moves by a cross-fade.* When something comes to stand on it, it takes the first free
    place in that frame: what showed at the old place goes out there over 250 ms while the name
    comes in at the new one.
  - *Clearance.* A new place must be clear of a counter by 2 px; a place held only has to be
    untouched. A counter's box moves by a pixel with its number and with the camera.
- **By the letters, not by the box.** A name's box has the padding and the line spacing that
  keep two names apart. A capital's own flag, 8 px above its dot, touches that box by a pixel:
  of the 22 names whose box a flag touched at 4000 m/px, 19 were that. Judged by the box, no
  capital's name could stand beside its dot. For the same reason the flags get no clearance.
- **What the measurements decided:**
  - *Eight places beside the dot were not enough:* 21 of 31 names found one at 4000 m/px (the
    acceptance test wants 25). Each of the other ten had a counter on its dot, clear of every
    place beside the dot by less than the name needs. With the places past the counter: 30 of
    31, 27 of 27 at 3000 m/px, 18 of 18 at 2300.
  - *Rejected: a name past a counter follows the counter.* The first version computed that
    place anew in every frame. With the game at top speed: 125 jumps of a name in full in 12 s
    (up to 28 px, as counters folded and came out).
  - *Rejected: go out, then come in elsewhere* (one box a name, the second fade starting when
    the first has ended). No jump, but a change took 550 ms, and `labelFades1938`, which gives
    a change one fade and its tail (352 ms), found two names still on their way. A cross-fade
    is one fade.
  - *Rejected: leave a covered name out.* 13 of 31 would be left at 4000 m/px.
  - *Rejected: the counter or the flag makes way.* ADR-65: a counter stands on its armies; a
    flag makes way for counters only.
- **What it costs:**
  - With the game at top speed (65 days in four seconds) 51 fades of names began in those four
    seconds at 4000 m/px: where counters change in every frame, the names near them come and go.
  - A name past a counter stays where it is when the counter has gone: 20 to 40 px from its
    dot with nothing between, until something stands on it.
  - One name of 31 is left out at 4000 m/px (Luxembourg: counters on every side).
- **Not solved here:** the nation names are drawn over the city names (Berlin under the "y" of
  Germany). PLAN 2.7t. At T1 the markers stand on city names as the counters did at T0: with
  PLAN 2.7s.
- **Tests:** `tests/e2e/cityNames1938.spec.ts` (the three zooms at rest; four seconds running: no
  name's box moves while it shows); `tests/unit/cities.test.ts`, 8 new (the order of the places,
  past a counter, the reach, the place kept, the move, the clearance, the flag by a pixel).
  `labelFades1938`, `labels1938`, `flagsClear1938` unchanged and passing.

- **Addendum to ADR-76, PLAN 2.7t (2026-10-04): the city names are above the nation names.**
  - *Context:* the curved nation names were drawn on the overlay, the canvas above the city
    names. With the counters and the flags out of the way, they were what still stood on city
    names: at 4000 m/px over Europe something was drawn over the letters of 11 of the 30 names
    shown (Berlin 505 px of them, under the "y" of Germany).
  - *Decision:* the order of the layers. The nation names are laid out as before and drawn on
    the city layer's canvas, under its dots and names. The overlay keeps the unit layers and
    the flags, above both, as they were above the nation names before.
  - *Why the order and not room:* a nation's name fills its nation, and a capital stands in
    it. Keeping the city names clear of those glyphs would move most of them off their dots or
    leave them out; the other way round the nation names would break up. A small name with its
    dark outline reads over a large pale one; the large one loses a few px of a letter.
  - *How it is tested:* by pixels. Inside the letters of every city name that is shown, the
    overlay has nothing drawn. That holds for a nation name, a counter and a flag alike, so it
    is also the check of ADR-76 read from the picture and not from the layout's boxes.

- **Addendum to ADR-76, PLAN 2.7u (2026-10-04): the names keep clear of the T1 markers.**
  - *Context:* ADR-76 gave the names the T0 counters and the flags to keep clear of. At T1 the
    markers stood on them: over central Europe at the 1938 start something was drawn over the
    letters of 12 of the 30 names shown at 1800 m/px, of 8 of 25 at 1000, of 1 of 13 at 500.
  - *Decision:* the same rule with other obstacles. A marker's box with its backing, the bar
    and the number under it; the tag of a stack, which reaches out of the box; the Major
    Battles. With the counters' clearance of 2 px for a place to be taken: a marker moves
    with its army every tick.
  - *Not the order arrows.* A dashed line 1.5 px wide across a name leaves it to be read.
    Arrows are long, and in a war there are hundreds: names that gave way to them would leave
    a front without names.
  - *Which layer counts: the one that is shown or coming in,* from the first frame of a
    handover. First it was judged by opacity, as the counters were in 2.7r (half and more).
    The names then changed places in the middle of the handover and were still fading when it
    was over: `labelFades1938` at 2000 m/px, 23 opacities not at rest after 352 ms. Now the
    names cross-fade with the layers. A counter or a marker that is itself on its way out (a
    fold, a stack) counts by its own part, as before.
  - *To be exact about "the first frame":* in the frame of the camera's step the coming layer
    has no share yet and draws nothing, so it has no boxes, and the going layer no longer
    counts: that one frame has no unit obstacles. The coming layer counts from the frame it
    is first drawn in, 16 ms later. A name with no place under either layer can begin to
    fade in during that frame and begin again in the next; not seen, and left so.
  - *What it costs:* names. Of those shown before, covered or not, 28 of 30, 23 of 25 and 13
    of 13 over central Europe; a capital among those left out at two of the zooms (Prague at
    1800 m/px, Warsaw at 1000: their garrisons stand on every place by the dot). On the
    watch list: the places are eleven fixed ones, and one a pixel to the side would do.
  - *How it is tested:* by pixels, as 2.7t; and while the game runs, by the names' boxes in the
    view's own frames.

### ADR-75 · 2026-10-04 · accepted — The counters' hold is a memory of the layer at rest; a split or merge on its way is folded without it (PLAN 2.7l)

- **Context:** a gate run under load saw 2 counters over central Europe at 1.5 px per cell where
  every other run has 3 (`declutter1938`). The hold of ADR-65 (a folded counter comes out only
  once it clears its neighbour by 6 px more) was read and written by every frame, those of a
  split or merge in flight too. In flight a counter passes others. Whether it lands held was
  decided by the moments of the flight that happened to be drawn.
- **Measured before, a step of the camera, the frames after it 16 to 1000 ms apart:**
  - Unit, 400 synthetic formations, counters shown at rest (and keys that differ from the 16 ms
    run): level 7 → 6: 286 at 16–60 ms, 285 (3), 284 (2), 283 (3) at 120, 200, 400 ms. Level
    8 → 6: 291, 290, 291, 290, 284, 289, 282, 282. A merge, 5 → 7: 157, then 156 (5), 157 (8),
    160 (11). Only a step inside one level's band gave one answer.
  - Browser, the 1938 start, the stops of `declutter1938` (the world, then 1.5, 3, 6, 8 px per
    cell over Europe), the frames drawn by the test: the world view reached again by a merge
    differs by 3 counters with frames 60 ms apart.
- **Decision:** the hold is a memory of the layer at rest. A frame of a split or merge on its way
  is folded without the hold and leaves none: the counters land free and are folded there by
  where they stand. `CounterLayer.hold`; `fold(…, flying)`; `declutter()` is the layout and the
  fold as `draw` does them, for the tests.
- **What it gives:** after a step the counters at rest are
  - the same at every spacing of the frames (16, 25, 33, 60, 120, 200, 400, 1000 ms; unit and
    browser);
  - the same from whichever level the camera came;
  - the same as in a view opened at that zoom. Before, a view opened at a zoom was folded
    without a hold and a step to it with the hold of its flight: one zoom, two pictures.
- **What it changes in the picture:** after a zoom in more counters stand. The children of a
  split come out at the gap (2 px), as counters do everywhere else, not at the hold distance.
  - The stops of `declutter1938`, counters in view and over central Europe: the world 65 and 2;
    1.5 px 57 and 5 (before 48 and 3); 3 px 61 and 17 (the same); 6 px 104 and 56 (85 and 45);
    8 px 87 and 58 (86 and 58). The spec's "more over central Europe at each closer stop" had a
    margin of one at the first step and has three; at the last step it has two (had thirteen).
  - At 3 px per cell from the opening view: 79 counters. Before: 73 with frames exactly 16 ms
    apart, 65 with frames 1000 ms apart.
  - Pictures: `docs/evidence/1.45/declutter-*.png` and `flags-clear-*.png`, made again and
    looked at. No counter overlaps another; the numbers read; Germany and Poland carry more
    counters on their names than before.
- **What it costs:**
  - In flight more counters turn twice (begin to fade in, then fold again), because nothing
    holds them: on a wheel notch in, eased, 56 of 7,394 counters (28 before); three notches out,
    484 of 9,560 (325); a step 7 → 6, 28 (17). A turn goes on from the opacity reached; the
    number on the neighbour changes with it.
  - The frame after a merge lands, a few counters turn: 4 of 162 keys at 5 → 7, 7 of 50 at
    6 → 8 (before 1 and 2). The landing is folded free; the next frame has its hold, which
    widens the reach of a folded counter, and it can find a nearer neighbour. One fade.
- **`flagsClear1938` restated.** The spec asserted that every capital in view has its flag at 3
  and 6 px per cell (41 of 41 and 22 of 22). At 3 px per cell two flags are left out now: Vienna
  and Prague, each with three counters in the column above it, so that the first free place is
  more than 40 px up (the rule of ADR-65's addendum).
  - *Why this is not a test made weaker to pass:* the 41 was a count of one of the pictures that
    zoom had. The code before this change, the frames drawn by the test exactly 16 ms apart:
    73 counters and 40 flags, Prague left out. Frames 1000 ms apart: 65 and 41. The gate saw 41
    because `settle` draws every 25 ms with the view's own loop in between. The assertion held
    by the defect this task removes.
  - *What it asserts now,* for each capital in view: its flag is there (and stands as before:
    at its usual place or just above a counter, at most 40 px up), or the test does the view's
    climb again over the counters drawn and finds no free place within 40 px. One flag a
    nation. So a flag cannot be dropped without cause; how many are left out is printed, not
    asserted.
  - Now: 3 px, 39 of 41, 15 raised by up to 36 px; 6 px, 22 of 22, 7 raised by up to 33 px.
- **Rejected:**
  - *No hold whenever the zoom changes* (tried). An eased zoom then ends alike at every
    spacing too. But the hold at rest is the hysteresis: a pinch that wobbles by ±1% at 12 Hz
    for a second turned 62 of 5,848 counters about 16 times each (998 turns; with the hold kept
    17 turns, no counter twice).
  - *The folds of a flight decided on where its counters land, the children born held* (PLAN's
    first direction; not built: its picture is that of the old code with frames 1000 ms apart,
    which was measured). It keeps 41 flags and the old look, and no counter would turn in
    flight. It also keeps two pictures for one zoom, and central Europe goes 2 → 3 at the first
    step for good: zooming in by a factor of four shows one counter more. It needs the hold
    carried across levels by ancestry and a second set of positions in the fold.
  - *The same, the children born free:* the picture of this decision with nothing turning in
    flight. More machinery for the flight alone; on the watch list, to be judged on the zoom
    demo (PLAN 2.10).
- **Not solved, on the watch list.** The acceptance test is a step of the camera. An eased zoom
  still ends with other counters when its frames fall otherwise, in 62 of 192 cases at spacings
  of 16 to 200 ms (136 before):
  - by the hold written at rest between two level changes of one zoom (158 runs at the same
    level with other counters; 413 before);
  - at 200 ms, by the level itself (12 runs, as before): `clusterLevel` rounds to the nearest
    level from wherever a frame finds the zoom.
- **Tests:** `tests/unit/counters.test.ts`, 5 new ("the counters at rest after a step of the
  camera"); `tests/e2e/declutter1938.spec.ts`, 1 new, which fails on the code before with
  "stop 0, frames 60 ms apart: 3 keys"; `tests/e2e/flagsClear1938.spec.ts`, restated as above.
  PLAN 2.2's continuity test (`counters1938`) passes unchanged.

### ADR-74 · 2026-10-04 · accepted — An independent read finds what the author no longer sees; its findings are tasks before the next feature

- **Context:** the review pass after PLAN 2.7 found, by reading, a bug of PLAN 2.7c that five
  gated commits had carried (ADR-72, addendum). A second reader with no part in the code was
  then given the unit and label drawing code (`src/render/units`, `fx`, `labels`,
  `timing.ts`, the unit layers of `MapView`) and asked for defects only: an input or a state
  that gives a wrong picture, a wrong value, or a view that never comes to rest.
- **It found the 2.7c bug by itself**, before the fix landed, and eight more. Three it ran
  (the pure modules, in scratch scripts); five it traced by reading. Finding 1 was checked
  here against the code and holds; the others are checked by the failing test of their task.
- **Decision:** the six that a player can meet are PLAN 2.7f–k, before 2.8, each with a test
  that fails first. Most severe first.
  1. 2.7f: the counters' level can go back and forth for ever at a resting camera.
  2. 2.7g: a destroyed nation's capital flag stays.
  3. 2.7h: a repeated tick restarts the sprites' walk.
  4. 2.7i: sprites take the map mode's colours, and keep stale ones.
  5. 2.7j: figures fading out are of the tick before.
  6. 2.7k: a nation name's state is lost at the seam.
- **Not tasks, on the watch list in BLOCKERS.md:** the counters' declutter does not see across
  the seam (the 180° meridian: rare); the two wrap copies of a city share one name switch (needs
  a view 6,570 px wide on the shipped maps); a city's limit is exclusive where the tiers' are
  inclusive (one zoom value); the toy world's two nations wear 1938 flags; the morph's box
  picture is rounded up at a fractional device pixel ratio (not traced).
- **Why before 2.8:** 2.8 adds a layer to a view that does not come to rest. A view that keeps
  drawing hides the cost of what is added, and `settle` in the specs waits on it.
- **Why not all in one commit:** one cause, one test, one commit.
- **For the reviews to come:** a review pass (PROMPT step 9) includes one such read of the code
  written since the last pass. This one found nine defects.

- **Addendum 2026-10-04, the second read (review pass after PLAN 2.7f–m).** A reader with no part
  in the code was given `counters.ts`, `nationLabels.ts`, `timing.ts`, `handover.ts`, the unit
  layers and the frame loop of `MapView`, and `protocol.ts` and `server.ts` for the snapshot
  fields; the lines new since the first read first; the same definition of a defect; the watch
  list as known. It was told nothing of what had changed or why.
  - **Six findings.** Three it ran in scratch tests (worker side and pure modules), three it
    traced. Each was checked here against the code it names, by reading: all six hold as far as
    reading shows. None is in the lines of PLAN 2.7f–m: the read went further than the diff.
  - **Tasks, before 2.8, most severe first:** PLAN 2.7n (at the closest zooms a formation's
    figures are missing when the camera is off its centre: the worker sends by the formation's
    centre, and the view's subscription is rounded to quarter cells), 2.7o (a formation that
    takes a freed id arrives from where the dead one stood), 2.7p (a pan at T3 shows T2 sprites
    for 250 ms), 2.7q (a world loaded into a running game leaves the old world's flags).
  - **Watch list:** one copy of a name going out in one frame (needs two copies in view and a
    larger name arriving); no margin at the seam for what is drawn across it.
  - **What it found correct** is in PROGRESS of this date: among it the hold of PLAN 2.7l and
    the loop of 2.7m, run over 840 zoom steps and 540 static views.
  - **The two reads together:** fifteen findings, ten of them tasks, in code that passed its
    gate every time. The second cost 325,000 tokens and 45 minutes.

- **Addendum 2026-10-04, the third read (review pass after PLAN 2.7n1–t).** The same brief, on
  the ten files changed since the second read: the marker stacks, the markers, the city labels,
  the timing, the sprite renderer, the subscription, `MapView`, the worker's snapshots, the
  table and the slot poses.
  - **Five findings, three run by the reader, all in code written since the second read.** Two
    were run again here before anything else and hold; one was read against the code.
  - **Three are defects of tasks done hours before, each gated green:** the moves of PLAN 2.7s2
    never come to rest where three markers are crowded (a view that draws for ever: 29 of 324
    samples of a 1938 game, none of them at a tick a spec looks at); a marker moved by 2.7s2
    jumps when it goes into a stack of 2.7s1; the count of PLAN 2.7o is not resized by a load.
  - **Tasks, before the rest:** PLAN 2.7v, 2.7w, 2.7x; and 2.7y, a decision (a pause in mid-tick
    moves every marching sprite to its tick's end in one frame, which SPEC has as intended).
  - **Watch list:** markers at the seam; four suspicions.
  - **What it ran and found correct:** the city names of 2.7r (2,707 moves of a name among 25
    moving obstacles: no jump, none without its fade, all at rest 3.2 s after the obstacles
    stopped); the subscription key of 2.7n2 (14,802 pairs of cameras with one key); the stacks
    of 2.7s1 on the 1938 world at three ticks and eighteen zooms.
  - **The three reads together:** twenty findings, fourteen of them tasks. The first two found
    theirs in code older than the lines they were pointed at; this one in the newest. What
    separates the two kinds: 2.7r was measured while the game ran, in four versions; 2.7s2 was
    measured at one tick, paused.
  - **For the tasks to come:** a layer with a memory of the frame before is run, in a unit
    test, on the same input until it rests, on random inputs. The spec of one tick does not
    see a cycle.

- **Addendum 2026-10-05, the fifth read (the Phase 2 review, PLAN 2.11b).** The same brief, on
  the 23 source files changed since the fourth read (`ece4b2f`: PLAN 2.7z to 2.10b, 1,261
  lines), at full width: the fourth was narrowed, and this is the phase's. Node only (a sweep
  was running); nothing of what changed or why.
  - **Five findings, each run by the reader; four run again here with its scripts, the fifth
    read against the code. All hold.** 356,000 tokens, 33 minutes.
    1. A march between two neighbouring cells is taken for the seam and walked round the
       world (`movement.ts`: "more than 1 apart in x"). **A regression of PLAN 2.9a**, in
       four gated commits since: 90 formations in seed 99's first year.
    2. A game loaded from a save does not go on as the game that was saved (the supply
       network is refreshed in full on a load, in part otherwise). Older than the phase and
       outside the lines the reader was pointed at; I2 of SPEC §2.6.
    3. A formation mustered in a theatre is placed raw: 9 British divisions in the sea at
       Gibraltar. A path PLAN 2.9a missed.
    4. `scatter` has no floor of zoom, and the ground's share is a matter of time: a fast zoom
       out of T2 shows trees for the far zoom, cut off at a line.
    5. Back from T2 with the camera still zooming, the T1 boxes are up to 6 px from their rest.
  - **A sixth from a suspicion, settled here in the browser:** the map's canvas is not opaque
    where sprites and trees blend (254,968 of 1,120,000 px at T2 over a forest, the least at
    an alpha of 138 of 255): the page's background shows through.
  - **Tasks before Phase 3:** PLAN 2.11i, j, k (the sim's, first), l, m. Finding 5 is a line
    under PLAN 7.4: nothing is wrong at rest, and what is off is an ease of 6 px.
  - **What finding 1 says about the phase's own checks.** Every one of them passed with it:
    - the test of 2.9a looked at formations at rest and skipped those on the march, by design;
    - the count "0 of 134 marches over water at day 30" was a count at one tick;
    - the pinned hash holds whatever the code does: it moved with 2.9a and was logged as "formations stand on land";
    - the smoke sweep's five limits were green: formations that fly for some hours do not move a border by a percent;
    - the zoom demo closes in on a division that fights a Chinese division (494) which, in seed 99, is the first to fly.
    A change of where things stand is a change of how they move between those places. The
    task that fixes it adds the test that was missing: a bound on how far anything moves in
    an hour, over a run.
  - **What finding 2 says:** the invariant most relied on (a checkpoint is the run it was
    taken from) was tested on the toy world and near the start. The reader found it by
    running a save from the middle of a year.
  - **The five reads together:** twenty-six findings, twenty of them tasks.

- **Addendum 2026-10-04: the review pass is counted by numbered tasks (the user's decision).**
  - *What the user said,* when a pass was proposed after PLAN 2.8c2: "Let's clarify the
    5-iteration rule for review pass to proper numbered iterations (e.g., 2.7, etc.) instead of
    all these subiterations 2.8a, 2.8b, 2.8c1, etc." PROMPT.md's step 9 says so now.
  - *What it had been:* every part of a split task had counted as an iteration. From the
    review after PLAN 2.7 to this day that made four passes inside one numbered task and a
    fifth proposed one task later; each brought an independent read.
  - *What follows now:* since the last pass one numbered task is done (2.8). No pass is due.
  - *Two readings of mine, told to the user and confirmed by the user the same day ("Yes,
    those readings of the rule are correct"); in PROMPT.md's step 9 since:*
    - A task that comes out of a review belongs to the task it follows up (2.7f to 2.7z were
      all of 2.7).
    - A phase review is a review pass and starts the count again. The next is PLAN 2.11.
  - *The independent read* still comes with a pass, its width chosen for each (the addendum
    below).

- **Addendum 2026-10-04, the fourth read (review pass after PLAN 2.7v–u), narrowed by the user.**
  - *The user's decision:* asked why another pass came before PLAN 2.8, the user was given three
    ways (the read as before; no read until the phase review; a read of the two changes with
    the most new logic) and chose the third. The read was of PLAN 2.7w (a box that fades into
    a stack keeps its place) and PLAN 2.7u (the names keep clear of the T1 markers). The pass
    itself is PROMPT.md's (step 9); the read is this ADR's, and its width is now a choice made
    for each pass.
  - *What the earlier statuses got wrong:* they said PLAN 2.8 came after the five tasks of the
    third read. Five tasks are five iterations, and bring the next pass due.
  - *Two findings, both run by the reader; neither in the two changes themselves.* 2.7w held
    under 1,600 made-up games (no step over the ease's, no opacity step, every formation in
    one marker, every game at rest within 19 frames), and the names of 2.7u under 160 runs
    through marches and handovers (never fail to rest; nothing partly faded at rest; no name
    under a marker, a tag, a counter or a name).
  - *Finding 1, a task (PLAN 2.7z):* on the way back from T2 the markers stand un-parted for
    the whole morph and then spring apart; with 2.7u the names shuffle a second time. The rule
    it comes from (`still`) is of 2.7s2; the test of it has moves in hand, and none enters it
    after `clear()`. Run here at the layer before anything else: it holds.
  - *Finding 2 and six suspicions:* the watch list.
  - *The four reads together:* twenty-two findings, fifteen of them tasks. The yield falls: 9,
    6, 5, 2; and this one found nothing in the code it was pointed at.

- **2.7n, done 2026-10-04 (second read, finding 1): what was chosen in its three parts.**
  - *2.7n1, whole formations by the reach of their block.* The worker widens the box, for a
    formation's centre, by the distance to the far corner's slot and half a slot more, and
    sends the formation whole.
    - Rejected: elements one by one, by their own places. Fewer are sent at the closest
      zooms, but the strength of a formation would no longer be the sum of the elements the
      view has, which the T2 specs and the "one truth" check read.
    - Rejected: one margin for all. Blocks are 6 to 53 slots: 0.05 to 0.17 cells.
  - *2.7n2, the step of the subscription key: a power of two of cells between a 32nd and a
    16th of the box's smaller half-size.*
    - The pad is a fifth of the half-size. For the view of one camera to lie in the box of
      another with the same key the step must not be more than the pad. A 16th is a third of
      it: the rest is for the 100 ms between two subscriptions, in which a fast pan goes on.
    - A power of two, and in the key: two cameras with one key then have one step, and
      zooms near each other round to the same grid.
    - It asks every 14 to 28 px of pan on a view 720 px high. Before: every pixel at T0 and
      T1, every 41 px at 120 m/px, every 4,892 px at 1 m/px. At most 10 times a second, as
      before.
  - *2.7n3, 48 px.* A stand-in stands for a formation, as a marker does, so it has a size on
    screen and not on the map. The silhouette fills two thirds of its square: 32 px lit, a
    little more than a marker's box (26 × 17) and less than a counter.
    - Rejected: no stand-ins in a world that has elements. The view cannot tell a formation
      without elements from one whose elements are not in its box, and the toy world, where
      every formation is a stand-in, would need the limit all the same.

- **2.7o, done 2026-10-04 (second read, finding 3): how the worker knows a formation is new.**
  By the id alone it cannot: freed ids are given out again, the last freed first.
  - *Decision:* the table counts how often each id has been given out (`Table.generation`), and
    the worker compares the count before and after the step.
  - *Why it is not sim state:* nothing in the sim reads it, and it is not serialized or hashed.
    A column would change the save bytes and the pinned hash for a thing only the view needs;
    the pin of seed 99 is unchanged (ADR-55: it moves with rules only).
  - *Rejected:* the events of the step (not every way a formation goes emits one: disbanded,
    annexed, removed by God or the editor); a guess from how far the formation moved in a tick
    (a threshold, and a recycled id next door would pass it).
  - *PLAN 2.7x, 2026-10-04 (third read, finding 2): the count through a load.* `deserialize`
    made the columns anew at the loaded size and left the counts at the old length; ids beyond
    it had none, and the worker took their formations for new in every tick. The counts are
    now as long as the table. A load does not raise them: that every row is another row after a
    load is the observer's to know (the worker takes the places anew in `resetStreams`, and
    the snapshot that follows sends every formation from its own place: tested). Raising them
    all in `deserialize` would say the same twice, and was left.

- **2.7f, done 2026-10-04: finding 1 reproduced and fixed.** `CounterLayer.layout` now takes
  over the level of a finished change first and judges the level wanted against that.
  - Before, in the unit test: a zoom to 3.7 levels and back to 3.5 within 100 ms left the level
    changing 8 times in the two seconds that were counted, for ever; of 516 eased bursts of
    wheel notches (4, 5 and 6 out, 4 in, from 129 zooms each) 69 never rested. The reader had
    counted 68.
  - In the browser the bug needs the notches of one flick between two frames. Sent one by one
    through Playwright they are 50 ms apart and the old code rested too; the spec dispatches
    them together. Before the fix: levels 6 and 5 in turn at a resting camera, a frame drawn on
    every tick of the loop. After: one level, no frame in two seconds.

- **2.7g, done 2026-10-04: finding 2 reproduced and fixed.** Poland annexed by Germany: its
  flag stood over Warsaw afterwards. The snapshot's nation row has a ninth field, `living`,
  and the view drops the capital of a nation that does not live.
  - *Why a field and not a missing row:* the row's colour is still needed (the charts and the
    list of the dead draw destroyed nations).
  - *Why not a capital of NaN:* the view's cull of flags outside the picture compares
    coordinates, and every comparison with NaN is false; it would have needed its own test
    there anyway.
  - A nation that is dead from the start (Ethiopia in 1938) is treated the same: it has no
    capital in the view. (The reader reports that its flag was kept off the picture before only
    by where its unset capital lies, cell (0, 0); not checked here.)
  - Not hashed: a snapshot is a view of the state. The pinned hash did not move.
  - The flag goes in one frame, without a fade. So does a name when land changes hands (ADR-73,
    addendum): an event of the game, not a matter of zoom. Left.

- **2.7h, done 2026-10-04: finding 3 reproduced and fixed.** The view restarted the sprites'
  clock on every snapshot. Measured in the browser at one tick a second: a pan 0.38 of the
  way through a tick sent the progress to 0.00; the end of a pause sent it from 1.00 to 0.00.
  - The test reads the progress, not pixels. The progress is the sprites' only motion between
    ticks: the GPU draws each at `prev + t × (cur − prev)` with `t` one uniform for all. A `t`
    that does not go back moves no sprite back.
  - The clock starts with a new tick only.
  - The same tick at another tick length (another speed, a pause and its end) keeps the
    progress reached: the clock is set back by that progress × the new length. Without this a
    change from one tick a second to three would jump from 0.38 to 1.
  - **PLAN 2.7y, 2026-10-04 (third read, finding 4): a pause lets the sprites finish their
    step.** 2.7h had "paused, the progress is 1: the sprites stand where the tick has them",
    and its test said so. A pause at progress p of a tick then moved every marching sprite by
    (1 − p) of its step in one frame: by the reader's numbers 14 px for the median step at
    100 m/px and 54 for the largest, 48 and 181 at 30 m/px. The phase's rule is that nothing
    pops.
    - *Decision:* a snapshot of the tick in hand without a tick length (a pause) leaves the
      clock and the length as they are. The sprites reach the tick's end when the tick's time
      has run, at most one tick length after the pause, and the view draws the way there.
    - *What a paused view shows* is the sim's state, as before, from then on. The date stops
      at once; the sprites are the only thing that goes on, for under a second at one tick a
      second.
    - *Rejected: to hold them at p until the game goes on.* Every sprite would stand, for as
      long as the pause lasts, at a place no state of the sim has: a formation moved or made by
      God Mode or the editor while paused would be drawn between its old place and its new.
    - *Unchanged:* a tick that comes while paused (a single step) or at full speed has no
      length, and its progress is 1 at once.
    - *The test restated:* `tickClock.spec.ts` had `paused: 1` and `resumed: 1`. It now has:
      the progress is never ahead of the clock, between readings and between frames drawn
      (before: 0.50 and 0.60 of a step), nor behind it; the view draws on the way; the last
      frame drawn is at 1 and the progress stays 1; a pause and its end at once leave the
      clock running. For the user to overrule.
  - Paused, the progress is 1, as before: the sprites stand where the tick has them, which is
    what the sim holds. Going there from the middle of a step is a jump forward of less than
    one tick's march. Left.
  - Fire and wrecks are stamped with the time the snapshot arrived, not with the sprites'
    clock, which no longer is that time. The worker sends each fire once
    (`serverFires.test.ts`), so a repeated tick brings none again.

- **2.7i, done 2026-10-04: finding 4 reproduced and fixed.** The sprites' colour was read from
  the map's palette, which holds the colours of the map mode, at the moment of upload.
  - Measured: in the wars mode, after a tick, the element sprites of Japan and of Manchukuo
    were both 236,195,191. In the political mode they are 248,247,241 and 238,227,201.
  - Decided: units wear their nation's own colour in every map mode, at every tier. The T0
    counters and T1 markers already did; a unit that changes colour at 300 m/px is a bug
    whichever colour is right, and the mode's colours answer a question about the land.
  - `nationColor` reads the own colour. The second half of the finding (tints left over after
    a change of mode while paused) cannot happen any more; the test still asserts it.
  - The task's acceptance line said the sprites "have the tints of their T1 markers". A
    sprite's tint is the own colour lightened, by design (to read against the nation's fill),
    so it never was the marker's colour itself. The line is made exact in PLAN, not weakened:
    one tint a nation, the same in all eight modes, before and after a tick in each.

- **2.7j, done 2026-10-04: finding 5 reproduced and fixed.** Leaving T3, the figures are drawn
  for the 250 ms of the fade. They were built only while the close tier wanted them, so a
  snapshot that arrived during the fade was not turned into figures.
  - Measured: two divisions, the camera steps out of T3, one division is removed and a tick
    is stepped, a frame 100 ms into the fade is drawn. Before: 3,168 figures, 1,584 of them of
    elements no longer in the snapshot. After: 1,584, all of the division that stays.
  - The figures are now built whenever they are drawn: the close tier on, or its fade running.
  - Cost: a build of 1,584 figures took 0.6 ms. At 24 ticks a second a fade sees six or seven
    snapshots. Not worth avoiding.

- **2.7k, done 2026-10-04: finding 6 reproduced and fixed.** A name's state was kept by nation
  and wrap offset. The camera's x wraps at the seam of a looping map, and the copy of the name
  on screen is then another offset's: a name held on by the hysteresis (8.2 px, under the 9 px
  at which it comes in) was placed with the camera at x = 390 of 400 and not at x = 5.
  - **Decision: a nation's name is one thing, with one switch**, whichever copies of it are on
    screen. Its state survives the seam because nothing in its key changes there.
  - *Considered: a switch for each copy, re-keyed when the camera wraps.* Each copy would keep
    its own fade. It needs the view to notice the wrap (a jump of the camera's x by more than
    half the world) and to rename the bank's keys; a jump of the camera for another reason
    would look the same. More parts for a difference nobody can see: the copies of a name are
    the same name at the same size.
  - *Two copies, one switch:* near the seam at world zoom both copies of a name can be on
    screen, and one of them alone can be in a larger name's way (the larger name's other copy
    is off the picture). Asked twice a frame for two answers, one switch would turn twice a
    frame and never rest: the shape of the city labels' case on the watch list. So the name is
    on when either copy is wanted, and a copy that alone is in the way is not drawn
    (`fadeNationLabels`; a unit test holds both).
  - The capital flags' places (`flagPlace` in `MapView`) are still kept by nation and wrap
    offset. There the worst is a rise of 150 ms cut short at the seam. Left; on the watch list.

### ADR-73 · 2026-10-04 · accepted — Capital flags and city labels are timed switches too (PLAN 2.7d)

- **Context:** after ADR-71 the unit tiers no longer popped, but two layers above them did.
  The capital flags appeared at 3 px per cell in one frame. A city's dot and its name faded by
  a curve of the zoom over 0.7–1 × a limit, so a resting camera could show them half there,
  and a name hidden by a collision appeared in full in the frame its neighbour made room.
- **Decision:** `TimedSwitch` (`src/render/timing.ts`): something is on or off, the first
  answer sets it, every later change is a fade of 250 ms, and a turn in mid-fade goes on from
  the value reached. `TierHandover` is built on it.
  - *Flags:* one switch for the layer: in at 3 px per cell, out below 3 ÷ 1.15. Each flag's
    own move away from a counter (PLAN 1.45c) is as it was.
  - *City labels:* two switches for each city, its dot and its name. Wanted is "the zoom is
    below the limit, or below the limit × 1.15 if it is on", and for a name also "no name of
    higher priority is in its box". The layout stays a pure function: it is told what is on
    and what is still fading out, and says what is wanted and where.
  - A city out of view has no state: a pan brings it in at once. A city in view with nothing
    to show is off, so that it fades in when the zoom brings it.
- **Where a label comes in:** at its old limit, where its fade by zoom used to begin, not in
  the middle of the old band. The unit test of the layout counts a name as shown from that
  zoom on; moving the threshold would have meant changing what the test expects.
  Consequence: in the band 0.7–1 × the limit a label is in full where it was faint.
- **The acceptance test** (`tests/e2e/labelFades1938.spec.ts`): the measure of ADR-71 over the
  city labels and the flags alone (`drawLabelLayers`), across 22 thresholds over Europe: the
  flags', six for names and four for dots, each in and out. Largest jump between two frames:
  23–30 of 255 (limit 48); the whole change 242–255. At nine zooms inside the old bands every
  opacity at rest is 0 or 1.
- **Moving flags are left out of the comparison, and counted.** A flag stands clear of the
  counters. The camera's step of 0.04% can move a counter's box by a pixel, and at 2000 m/px
  the counters go altogether: the flags above them come down. A flag moves in whole pixels,
  which is a full-contrast change of the pixels at its edges (measured with them: up to 255).
  That is motion, covered by `flagsClear1938` (at most 8 px a frame). The spec records where
  each flag stood in each frame and leaves the places of those that moved out of the
  comparison: at most 8 flags, under 10% of the picture.
- **Not done:** the curved nation names (`nationLabels.ts`) appear in one frame when their
  size reaches 9 px or a collision ends. PLAN 2.7e.
- **Addendum 2026-10-04, PLAN 2.7e: the curved nation names.** The same pattern.
  - A name has a switch, keyed by nation and by the copy of the world it is drawn in. It
    comes in when its size reaches 9 px and no name of a larger area is in its way, and goes out
    below 9 ÷ 1.15 px or when one is. The layout stays pure (`NameState`: what is on, what
    still fades out, and a call for each name in view with nothing to show).
  - A name that goes out because it became too small is drawn at the size it has while it
    fades. Its size follows the zoom, so it has no last size to keep.
  - *Checked* in `labelFades1938.spec.ts`: the zooms at which two names come and go are found
    by bisection (they depend on a nation's shape): United Kingdom in at 11,405 m/px and out at
    13,115, Nationalist Spain at 7,374 and 8,480, each out 1.15 × in. Largest jump between two
    frames: 21–24 of 255.
  - *Out of scope:* a change of map mode takes all names away in one frame, with the map's
    colours: a user's action, not a zoom. New label curves from the worker (territory changed
    hands) move a name at once.
### ADR-72 · 2026-10-04 · accepted — The marker → elements morph: a shrink of 13%, and a bar that lingers (PLAN 2.7c)

- **Context:** SPEC §8 asks that at T1 → T2 "the marker scales down and fades into the
  formation centroid while elements fade in at their real positions. The strength bar lingers
  above the group until T2 is fully in." Since PLAN 2.7b the change was a plain cross-fade.
- **Decision:** the T1 ↔ T2 handover takes 470 ms and has two parts (`markerMorph`).
  - *First 250 ms:* the box (frame, fill, symbol, flag chip) fades out and shrinks about its
    centre to 0.87 of its size; the sprites fade in. The strength bar and the number stay in
    full.
  - *Next 220 ms:* the bar and the number fade out.
  - Out of T2 it runs backwards: the bar comes first, then the box grows in as the sprites go.
  - The marker does not travel: it stands on the formation's centre already.
- **Why only 13%.** A moving edge changes a pixel by its speed × its contrast, and the limit
  for a change without popping is 48 of 255 (ADR-71). It was not raised.
  - Shrinking to 0.6 was the first plan. At a corner of the box the motions of the two edges
    add (13 and 8.5 px from the centre), and the white of a flag chip against the dark outline
    is nearly full contrast.
  - Measured at a shrink of 20%: 67 of 255 at that corner pixel in the first frame. At 13%:
    43 into T2 and 42 out of it.
  - The shrink is linear in time. An eased one moves one and a half times as fast in the
    middle, where it would have to be half as deep to keep the limit.
- **Why the box is a picture of itself while it shrinks.** Scaling its parts made the pixels
  of the flag chip (drawn without smoothing) and of the hairlines snap from frame to frame:
  188 of 255. During the morph the box is drawn once to a small canvas, as at rest, and that is
  scaled with smoothing. At rest it is drawn directly, as before: the pixels at T1 did not
  change.
- **Why the bar has its own 220 ms.** Faded over the second half of a 250 ms change it would
  move by 0.25 a frame. With 220 ms of its own: 0.11.
- **Found by the evidence run:** the spec waited for "the view has elements" before each
  crossing. Elements from the crossing before satisfied that at once; near T3 the view then had
  no element section kept and no figures to fade to, and the T2 → T3 share never moved. The
  spec waits for a section that arrived at the zoom it is at (`elementsZoom`).
- **Not done:** the bar does not move "above the group"; it stays where it is at T1, under
  where the box was. The order arrows and the battle swords fade with the box.
- **Addendum, 2026-10-04 (review pass after PLAN 2.7): the pictures are kept by nation too.**
  The box's picture was kept by symbol and state alone. Of two nations' markers in view, the
  second was drawn with the first one's picture: another nation's colour and flag from the
  first frame of the morph to the last, 250 ms. That is a pop of the kind this ADR is about
  (measured: a box's mean colour off by 102 of 255 in the frame after the step).
  - The acceptance test spawned two divisions of one nation and could not see it. The lesson
    for a test of pictures: two things under test must differ in everything the code could
    confuse.
  - `tests/e2e/morphNations1938.spec.ts`: a division of Japan and one of Manchukuo side by
    side; each box, 16 ms into the morph, is within 12 of 255 of its mean colour at rest
    (measured 4.8 and 4.5). It fails on the code before the fix (102 for Manchukuo's).
  - The pictures are still made anew in every frame of a morph, one for each nation, symbol
    and state in view. Measured in `fades1938`: the slowest frame of the unit layers at
    T1 ↔ T2 is 2.2 ms of CPU. A cache across frames would have to follow flags and colours
    that change; not worth it at that cost.
### ADR-71 · 2026-10-04 · accepted — Every tier boundary is a timed handover; "no popping" is measured at a fixed camera (PLAN 2.7b)

- **Context:** of the three boundaries between the unit tiers only T0 ↔ T1 was a state with a
  cross-fade in time (ADR-64). The T1 markers faded toward T2 by a curve of the zoom over
  210–300 m/px, so a camera resting there showed markers and sprites both half-faded (the
  defect ADR-64 removed at the other edge). T2 → T3 switched the sprite for its figures in one
  frame.
- **Decision:** one mechanism, `TierHandover(threshold)`, three times: 2000, 300 and 30 m/px,
  each in at its threshold and out above it × 1.15, each a cross-fade over 250 ms.
  - The view asks each handover once a frame and keeps the three shares. The markers have
    what the counters and the sprites leave them; the sprites and the figures divide the
    sprites' share; fire and wrecks are drawn with the sprites' share at T2 and T3 alike.
  - `markerLowFade` is gone, with the unit test that checked its curve. The handover's test
    has the three thresholds and the old band at rest.
- **The figures are built when the close tier wants them, not when a snapshot arrives at T3.**
  The state flips in the frame the camera crosses 30 m/px; the snapshot subscribed at T3 is a
  frame or two away. Built on arrival, the sprites would fade out with nothing fading in, and
  the figures would pop. The view keeps a copy of the last element section while the camera
  is below 60 m/px and expands it in that frame. With no elements at hand (a jump from far
  away) the close handover waits: the sprites stay until there are figures to fade to.
- **The acceptance test, read.** "Max per-pixel luminance jump between consecutive frames …
  in unit areas" cannot be measured while the camera moves: at 3% a frame a sprite 300 px
  from the centre moves 9 px, and its edge sweeping over a pixel is a full-contrast jump with
  nothing popping. So:
  - the camera steps across a boundary once (0.04%) and stays; the frames of the change that
    follows are drawn 16 ms apart, the unit layers alone on black (`drawUnitLayers(now, true)`
    clears both canvases and draws the sprite layers without the map), and consecutive frames
    are compared pixel by pixel;
  - that the step itself changes nothing at once is in the shares: the first frame after it
    has the old layer in full, and the share then moves by less than 0.12 a frame.
- **The limit, 48 of 255.** A smooth cross-fade over 250 ms moves a share by at most 0.096 in
  16 ms (1.5 × the linear step): 25 of 255 for a white figure on black. Where the outgoing
  layer covers the same pixel its change adds. 48 is twice the single step. Measured over the
  six crossings: 31–39. A change done in one frame measures 247–255 here, and the test asserts
  that too, so the measure is known to see a pop.
- **Cost:** the slowest frame of the unit layers during a change takes 1.6–6.2 ms of CPU; the
  larger figures are T0 ↔ T1, where the counters are clustered. T2 ↔ T3 with both sprite
  layers and the build of 3,000 figures in its first frame: 2.7 ms. These are from the spec
  run alone. In the gate, with four specs running at once, the same frames took up to 36 ms:
  the figure is a wall-clock time and not a budget check.
- **Handed on, not dropped:**
  - PLAN 2.7c: the morph of SPEC §8 (the marker shrinks into the group, the strength bar
    lingers). T1 ↔ T2 is a plain cross-fade until then.
  - PLAN 2.7d: the layers that are not units. Capital flags switch at 3 px per cell in one
    frame; city labels fade by a curve of the zoom.
  - PLAN 2.10: ADR-69's open choice, how a battalion's losses show at T3. It is a matter of
    the look at the demo's close stops, not of fades.
- **Addendum, PLAN 2.10a (2026-10-04): the zoom demo; along a path, seamless is measured on the shares.**
  - *The measure:* this ADR measures popping in pixels, at a camera that has stepped and
    stays. A demo zooms, and while the camera moves every edge moves. Along the path the
    measure is the layers' shares: in every frame of every leg none moves by more than 0.12 (a
    fade of 250 ms moves 0.096 in a frame of 16 ms), none goes back, and at each stop the
    tier's layers are there in full. The pixels of each boundary stay with `fades1938`. With
    a fade of 20 ms the demo fails at the first boundary (a step of 0.896).
  - *The clock is the test's:* the view's loop is stopped and its turns are given times 16 ms
    apart (`frameAt`, there since PLAN 2.7y), with a pause for the worker between two. The
    camera's own eased zoom (`zoomTo`, what the wheel does) runs on that clock. Every spec
    that measures wall time failed twice on this night's slow machine. This one takes longer
    there and sees the same, except that a snapshot can come some frames later, which delays
    a fade and does not make it a jump.
  - *One eased zoom a leg, not a held key:* a key's zoom (× 3 a second) took 130 frames for
    the leg to 6000 m/px, at 120 ms a frame in the tests' rasteriser. The eased zoom takes 35
    to 55 a leg.
    The measure does not depend on the camera's speed.
  - *The battle is the scenario's, not God's* (SPEC §10 said "a spawned battle"): PLAN 2.5 has
    the spawned one, alone in western China, for numbers to the man. A demo of the scenario
    closes in on its own front. It is found by rule in Node, not by an id: of the divisions
    that fired in the last hour and have stood for a day, the one whose battalions kept least
    while each still has more than 64 men, with a battery that has lost guns. Seed 1938, day
    30: a Japanese division in the pocket by Nanking, 6,594 men, battalions at 123 to 197 of
    500, batteries at 3 to 5 of 12 guns. If a rule change leaves no such division, the test
    says that, and not that the zoom is broken.
  - *Eight stops, two a tier, the closest at 3 m/px:* at 1 m/px one battalion fills the view.
    PLAN 2.10b needs battalions and batteries in one picture.
  - *The same world:* the page's hash is Node's after the month and after each of the four
    hours stepped at the close stops; the elements in the view have Node's strengths and
    places.
  - *Seen in the pictures, for the review (BLOCKERS):* the hatching of occupied land lies over
    the ground at T2 and T3; shots fly 30 to 60 km, so at 3 m/px a battle shows little of its
    fire.

### ADR-70 · 2026-10-04 · accepted — A slot is a place in the block the template made (PLAN 2.7a)

- **Context:** an element's place was `slotPose(formation, slot, count)` with `count` the
  number of elements alive. The block is a grid whose width follows the count (8 columns for
  28 elements, 7 for 24). So when deaths took the count across a step, every surviving sprite
  of the division took a new place in one frame, and with each single death the block's rows
  re-centred. SPEC §3.6 had it otherwise from the start: `slotPose(formation, slot, aliveMask)`.
- **Decision:** the count is the element count of the formation's template, which is what the
  slots were numbered for when the formation was equipped (`slotCount` in
  `sim/systems/elements.ts`). An element keeps its place for as long as it lives; the block
  keeps its shape and shows gaps where elements died.
  - The three users of a slot's place take it: the fire records of combat, the
    `ElementDestroyed` event and the snapshot's element section. They agree, as before.
  - No column was added. The template index is in the formation table already; a new section
    would have moved the pinned hash.
- **The pinned hash did not move,** and could not: all three users are tick outputs or the
  snapshot. Nothing in the sim's state reads a slot's place (formations fight from their
  centres). The sweep stage of the gate confirms it.
- **What the player sees:** a division that has lost a third of its elements is a block with
  holes, of the size it had. Before, it closed up into a smaller block, which read as a fresh
  small formation.
- **Tests:** `tests/unit/elements.test.ts` (deaths that take the count across a step of the
  grid: the snapshot draws every survivor where it stood, and the next death is reported at its
  slot in the same block); `tests/e2e/individuals1938.spec.ts` (an hour of battle in which a
  division goes from 22 elements to 17: every element that lives keeps its place).

### ADR-69 · 2026-10-04 · accepted — T3: an element is `min(strength, 64)` figures in its footprint (PLAN 2.6, critic B2)

- **Context:** SPEC §8 said of T3 "element → individuals (exact for vehicles, ships and planes;
  ≤ 64 sprites per infantry element, count = strength)". For a battalion of 500 that sentence
  can be read two ways: a cap, or 64 figures that each stand for eight men.
- **Superseded in the count (2026-10-04, PLAN 2.10b): see ADR-80.** A battalion is drawn by
  its share of 64 figures. What follows under "the count" is how it was until then.
- **Decision, the count:** a cap. One figure for each unit of strength, at most 64 to an
  element. Tanks (10 to an element) and guns (12) are exact; a battalion shows 64 until fewer
  than 64 men are left, and is exact from there. SPEC's T3 row now says so.
  - **Why the cap and not a share:** it is what the sentence says ("count = strength" is true
    wherever the cap does not bind), and it needs nothing new in the snapshot: strength and
    frame already travel. A share (figures = strength × 64 ÷ full size) needs the element's
    full size in the snapshot and makes no figure a man.
  - **What it costs:** at T3 a battalion of 500 and one of 100 look alike, and a battalion's
    losses show only when it is nearly gone. T2 has the same blind spot (a sprite dims only
    below 8 units). Not solved here. Candidates for PLAN 2.7: the strength as a number under
    each element at T3, or the share after all, with the size sent.
- **Decision, the place** (`src/render/units/individuals.ts`, pure functions of the element's
  id, frame, strength and facing):
  - The footprint is a square of 0.024 cells around the slot pose, turned with the formation.
    Slots are 0.03 apart, so the elements of a division stay apart as blocks.
  - It is a grid of sub-slots, 8 × 8 for men, 4 × 4 for vehicles and guns (8 × 8 when there
    are more than 16 of them: a mechanised battalion). A figure fills 92% of its sub-slot.
  - Figures take sub-slots in an order of the element's own, a shuffle by its id, each up to
    18% of a sub-slot off its centre. A loss takes the last figure of that order: the others
    do not move, and the gaps open across the block instead of from one edge.
  - This is the "presentational freedom inside an element footprint" of SPEC §8. A figure's
    place is not sim state.
- **Decision, the drawing:**
  - The view expands the elements when a snapshot arrives at T3, into a third instanced
    renderer with the same atlas. Previous and current place get the same offset, so the GPU's
    interpolation holds.
  - The origin of the instances is the camera's cell. Offsets from the middle of the map in
    f32 step by 2.4 m, which is 2.4 px at the closest zoom.
  - A plain switch at 30 m/px, as soon as a snapshot subscribed at T3 has arrived (one or two
    frames after the zoom crosses). The cross-fade of SPEC §8 is PLAN 2.7.
  - At most 60,000 figures in a build; beyond that the element sprites stay. A view at T3
    holds a few formations: three divisions are 3,345.
  - A wreck is drawn at most 30 px wide: the element sprite's size, which it used, is hundreds
    of px at T3.
- **A gun frame:** artillery, anti-tank and anti-air elements were drawn with the infantry
  frame, so a battery at T3 would have been twelve soldiers. The procedural atlas has a fifth
  frame, a field gun, used at T2 and T3.
- **One hash for placement** (`src/render/hash.ts`): where a shot lands, how a wreck lies and
  where a figure stands used three copies of one integer mix. The view's code may not import
  the sim's hash (module boundaries), and should not: this is presentation.
- **Measured** (three divisions in one view at 28 m/px, 3,345 figures of 89 elements): 0.7 ms
  to build per snapshot, 0.5 ms of CPU to issue the frame. The GPU's time is not in that
  figure; the bench of PLAN 2.3 has 10,000 instances at ≥ 30 fps.
- **Not done:** figures face where the formation faces, which is east for a formation that
  never marched (the sim does not turn a formation toward its enemy); no terrain under them
  (PLAN 2.8); no cross-fade (PLAN 2.7).

### ADR-68 · 2026-10-04 · accepted — `spawnFormation` takes a template: God can spawn a formation that fights (PLAN 2.5)

- **Context:** the acceptance test of PLAN 2.5 asks for a God-spawned battle. The only command
  that places a formation, `spawnFormation`, set a bare strength and made no elements. In a
  scenario with unit rules such a formation has no sprites at T2 and is skipped by the
  engagement (combat is between elements), so it cannot fight. The command was used by the toy
  world's tests only; the God tab builds through `queueFormation`, which delivers at the
  capital after the build time.
- **Why a spawned battle and not one of the scenario's:** the test compares a T0 counter with
  the elements under it, to the man. A counter is a cluster of a nation's formations, folded
  with its neighbours' (ADR-65), so its number is only "these formations" where nothing else
  stands. Every battle of the 1938 start is in a crowded front.
- **Decision:** `spawnFormation` has an optional `template`. With a template of the scenario
  the formation gets that template's elements, is in supply, and its strength is theirs (the
  command's `strength` is ignored), exactly as production delivers one. Without a template, with
  one the scenario does not have, or in a scenario without unit rules, the command does what it
  did.
- **The pinned hash did not move:** the baseline run issues no commands, and the optional field
  changes nothing for a command without it. The sweep stage of the gate confirms it.
- **Not added:** a button for it in the God tab. Two things to settle first: where the click
  goes while the territory brush is the map tool, and that the economic AI disbands idle
  divisions of a nation in deficit at the start of the month (a spawned division of an AI
  nation may not last; the test turns the AI of both nations off).
- **The test's battle:** two Japanese divisions against a Chinese one in western China, 55 cells
  from any other formation, the Japanese with God's attack buff (× 21). Without the buff the
  same fight shows no dead element in 12 days: losses are spread over all elements of a
  division, and they die together at the end.
- **What PLAN 2.5 found:** nothing to fix. The counter, the marker and the sprites agree
  because each is the formation's strength, recomputed from the elements at every settle.

### ADR-67 · 2026-10-04 · accepted — An element's end is an event; its wreck lives in the view (PLAN 2.4b, critic B2)

- **Context:** an element whose strength reached 0 was removed from the table when its
  formation settled, and its sprite was simply missing from the next snapshot. SPEC §5.2 step 3
  asks for a wreck event; SPEC §8 lists wrecks and casualties at T2.
- **Decision, the sim:** `ElementDestroyed` (element, unit, the slot it stood in) is emitted in
  `settleElements`, the one place where an element at 0 is removed.
  - The slot is computed in the block as it was before the settle, which is where the last
    snapshot drew the sprite and where the hour's fire was aimed. Measured in the acceptance
    test: 30 wrecks, each 0 cells from its sprite's last position.
  - Deaths by attrition and desertion emit it too. They pass through the same settle, the sim
    does not record the cause there, and a battalion that starved is as gone as one shot.
  - Elements that go with a formation removed whole (`destroyFormation`: disbanded by the AI,
    annexed, removed by God or the editor) emit none. That is not a death, and
    `FormationDestroyed` already says it. A formation wiped out in battle is covered: its last
    elements are removed by the settle, each with its event, before the formation goes.
  - The event is a tick output and is not in the history log's kinds, so it is neither saved
    nor hashed. The pinned hash did not move.
- **Decision, the worker:** the event goes only to a view that draws elements (as the fire
  does), and carries what the unit's class leaves in place of the unit index: the fallen (inf),
  a broken gun (art, at, aa), a burnt-out vehicle (the rest). Other events go to every view as
  before.
- **Decision, the view** (`src/render/fx/wrecks.ts`, Canvas2D on the overlay, under the fire):
  - *The visible end:* the snapshot that no longer has the sprite is the one that brings the
    event. In that frame a burst (a flash and an expanding ring, 400 ms) is drawn where the
    sprite stood, and the wreck comes in under it. No sprite is held back or faded: the sprites
    are what the sim has.
  - *The wreck* stays 12 s and fades over 3 s, on the render clock. Guns and vehicles smoke.
    It lies at an angle taken from the element id. At most 1,500 are held; the oldest go.
  - *Why real time and not sim time:* at the default speed a day is a second. A wreck that
    lasted a sim day would be gone in a second at ×5 and never while paused. As with the shots,
    the picture is paced for the eye and is lost on a reload.
  - `unitsAnimating` (what tests wait for) covers the burst only; the frame loop keeps drawing
    while a wreck smokes or fades.
- **Not seen yet:** in the first 40 days of seed 1938, 799 elements die: 704 infantry, 77
  artillery, 18 anti-tank; no vehicle. The vehicle wreck is drawn by the same code but no run
  has shown one. SPEC §6.1 "burning wrecks" for armour is PLAN 3.6.
- **Noticed, not changed:** a block's layout depends on its element count. When deaths take
  the count across a step of the grid (for example 25 to 24), the survivors' sprites take new
  places in one frame. PLAN 2.7 (no popping) owns it. **Changed since: ADR-70.**

### ADR-66 · 2026-10-04 · accepted — Fire at T2: a FireEvent is a shot, and a shooter shows one at a time (PLAN 2.4a, critic B2)

- **Context:** combat has emitted one FireEvent per volley since PLAN 1.13 (shooter, target,
  their slot poses, the minute of the hour), and the worker threw them away. At close zoom the
  element sprites of a battle stood still (critic B2: "no terrain, combat or motion").
- **Decision, transport:** the snapshot has a `fires` section.
  - Only a subscription that gets elements (tier ≥ 1.5) gets fire. At any other zoom the
    events are cleared after the tick as before and nothing is queued.
  - The filter is applied when the event happens, not when the snapshot is built: an event is
    kept when its shooter or its target is inside the subscribed box. A queue of the whole
    world's fire would be about 1,000–2,000 events a tick in 1938.
  - The worker sends the weapon kind of the shooter's class in place of the unit index (the
    view has no unit rules): small arms (inf, mot, mech), cannon (at, aa, armour), shell (art).
  - The queue holds 8,192 events; beyond that the oldest are dropped and counted
    (`fires.dropped`). A snapshot without fire takes no pooled buffer for it.
  - Fire events are tick outputs, not state: the sim is not touched and the pinned hash did not
    move. PLAN 2.4a changed no file under `src/sim/`.
- **Decision, drawing:** `src/render/fx/fire.ts`, Canvas2D on the overlay, above the sprites.
  - A shot is a muzzle flash, a tracer and an impact, timed on the render clock with
    `render/timing.ts`. Three looks: a thin pale tracer and a puff of dust; a thicker orange one
    with a burst and smoke; a shell on an arc with a larger burst.
  - The shots of a tick start spread over the tick's wall time by their minute: at least 250 ms
    (so that a fast game does not fire in salvoes), at most 1 s, and 400 ms for a tick stepped
    while paused.
  - Drawing is pure: the same time draws the same frame. Shots leave the list only when a
    snapshot arrives. Tests draw every frame of a burst at made-up times.
  - A shot lands up to 0.012 cells from its target's slot, by a hash of shooter and tick.
    This is the presentational freedom SPEC §8 allows; the points the sim gave are kept as they
    are and are what the test compares.
- **Decision, one shot per shooter at a time:** an event whose shooter still has a shot on
  screen when it would start is not drawn, and is counted (`skipped`).
  - **Why:** a tick is an hour, and the default speed is 24 ticks a second. Drawn one to one,
    every element fires 24 tracers a second: measured at ×5 over three divisions, 810 tracers
    in flight and 3,000 shots alive (the cap), a solid orange beam that hides the units. With
    the rule the same battle shows 63–125 tracers in flight, and each can be followed.
  - **What stays true:** within one tick every FireEvent is a shot, because an element fires
    once an hour. That is the window of the acceptance test: the tracers drawn are the sim's
    events, compared one by one with a run of the same sim in Node.
  - **What does not:** from tick to tick events are skipped at every speed, also at ×1 (a
    shell is on screen for 880 ms and two starts can be closer than that). The tracers are a
    picture of who fires at whom, not a count of volleys. Losses come from the sim alone.
- **A defect found on the way:** the frame clock (the rAF time) can be earlier than the arrival
  time of the snapshot the frame draws. A guard "nothing to draw before the batch arrived"
  drew no fire at all while the game ran, because every frame had a newer batch. The layer has
  no lower bound on the time; the unit test names the case.
- **Measured:** the fire layer costs 0.12–0.22 ms a frame at ×5 with 426–512 shots held
  (software GL, 1400 × 800).
- **Deferred:**
  - casualty removal and wrecks (PLAN 2.4b): they need an event when an element dies;
  - the GPU particle pools of SPEC §8: Canvas2D is cheap at this count. To look at again when
    air and naval fire or T3 add effects;
  - impacts are small at 120 m/px. They read at 45 m/px. PLAN 2.7 and 2.10 judge the look
    across zooms.

### ADR-65 · 2026-10-04 · accepted — T0 counters fold into their stronger neighbour instead of overlapping, across nations too (PLAN 1.45b, critic B7)

- **Context:** counters are one per nation per grid cell of about 64 px, so the counters of
  different nations in the same or the next cell stood on top of each other. At world zoom
  Europe was "a wall of overlapping counters" with cut-off numbers
  (`critic/shots/s1_01_crop_europe_counters.png`). AoC has no counters to copy: it prints a
  strength beside each nation's name.
- **Decision:** a declutter pass in screen space after the clustering (`foldOverlaps`).
  - A counter whose box would come within 2 px of a stronger counter's box is *folded* into
    it (the nearest, when several). The stronger one shows the sum of everything folded in,
    and "+n" for the n other nations among it. Nothing is hidden: the shown counters add up to
    the strength of every formation, as PLAN 2.2 requires.
  - Two passes: a nation's own counters fold into each other first, then the counters left
    fold across nations, strongest total first. A box grows with its text, so each pass repeats
    until no box touches another.
  - Positions are cells × scale, without the camera's place: panning never reshuffles the
    counters, zooming does.
  - A fold or its reverse is a fade in place over 250 ms. At rest a counter is drawn in full or
    not at all. A folded counter comes out only once it would clear its neighbour by 6 px more,
    so a counter at the edge does not flicker while the armies move.
- **Why fold across nations, and not move the boxes apart:** at world zoom Europe has some
  thirty nations in about 200 × 180 px. Their boxes fit only if pushed far from their armies,
  over the sea and over other countries. A counter that says "1.54M +7" over Germany is true
  at that zoom (that many men stand there, of eight nations) and the detail returns by zooming
  in, which is what semantic zoom is for. The flag on a folded counter is the strongest
  holder's; the "+n" says it is not alone.
- **What the continuity test taught (PLAN 2.2's frame-by-frame zoom test, unchanged):**
  - The first version slid a folding counter into its neighbour. A split or merge swaps every
    cluster key, and a slide that straddled the swap lost its neighbour's key and jumped.
    Several attempts to remap keys each fixed one case and opened another. The slide is gone: a
    fade in place needs no neighbour.
  - The order of folding must not change when a cluster is replaced by its children on its
    centroid (or the reverse). Hence the first pass by nation: the children then count exactly
    as the cluster, and the same counters stay shown through the swap.
  - A fade must go on through the swap: a counter with a new key takes over the fold state of
    the most visible counter of its nation that stood on that spot.
- **"No two overlap" is about counters drawn in full.** One fading into a neighbour stands on
  it for the 250 ms of its fade, and during that time the neighbour's number already includes
  it. The e2e asserts the rule for opacity 1, paused (where every counter is at 1) and running.
- **Strength text:** from 999,950 men on, millions with two decimals ("1.54M"); "1535.7k" was
  what the sums first read.
- **Not solved here:** capital flags are drawn above the unit layers and cover counters that
  stand at a capital (PLAN 1.45c, added). T1 markers of a dense group still stand on each other
  (seen in 1.45a; no task yet).
- **Addendum, PLAN 1.45c (2026-10-04): the capital flag makes way for a counter.** The flags
  stay above the unit layers (PLAN 2.1's order is kept: a capital must stay readable among the
  T1 markers). At T0 a flag whose place, with its frame, would touch a counter's box stands
  3 px above that counter instead, and above the next one if another is there. More than 40 px
  from its usual place it no longer reads as its capital's flag, so it is left out (the capital
  keeps its dot and name, and the counter there carries the nation's flag chip). A move is an
  ease over 150 ms, a flag left out or coming back a fade of the same length.
  - *Rejected: counters above flags.* Most nations keep an army at their capital, so most
    flags would show as a strip behind a counter.
  - *Rejected: counters make way.* A counter can only fold into another counter; moving it
    off its armies is what the declutter avoids.
  - Measured at the 1938 start over Europe: at 3 px per cell 14 of 41 flags stand higher, by 3
    to 36 px; at 6 px per cell 6 of 22, by 5 to 33 px; none is left out at either.
  - Tests: `tests/e2e/flagsClear1938.spec.ts` (no flag with its frame touches a counter box at
    3 and 6 px per cell; every capital in view has its flag, at most 40 px above its usual
    place; a raised flag was in the way and stands just above a counter; after a zoom the flags
    move at most 8 px per 16 ms frame).
- **Tests:** `tests/unit/counters.test.ts` (the sum and the nations of a fold; 300 random
  counters with no two shown boxes within the gap and the sum kept; the same picture under a
  shift of every position; children on a centroid count as their cluster; the hold distance;
  the fade in place and a turn in mid-fade; the fade through a key swap),
  `tests/e2e/declutter1938.spec.ts` (world view and four zooms over Europe, at the start and
  after one year: no overlap, every counter at opacity 1, the sum equal to the sim's, more
  counters in central Europe at each closer zoom; twelve samples with the game running).
- **Addendum 2026-10-04, the running check restated (found in the gate of PLAN 2.4b):** the
  check read "among the counters at opacity 1 no two overlap" on one frame per sample. A fade
  starts at opacity 1, so in the one frame in which a counter begins to fold into its
  neighbour it stands in full on that neighbour, and a sample can be that frame.
  - *Seen:* one gate run failed there. A probe of 283 samples at top speed hit it in 2, and
    each of its 6 pairs had one counter "folded since 0.0 ms" and the other shown. The
    declutter was right; the check raced it, at roughly 1 run in 12.
  - *The check now:* a sample is two frames 17 ms apart with no snapshot between them. In the
    first, the counters that are shown (not on their way out) do not overlap, whatever their
    opacity. In the second, every counter on its way out has begun to fade, and the counters
    at opacity 1 do not overlap, which is the old sentence one frame on.
  - *What it took:* `DrawnCounter.folded`, so that a test can tell a counter on its way out
    from a shown one. No behaviour changed.
  - *Not weakened:* the first frame now checks more counters than before (those fading in,
    too) and leaves out only the counter that the declutter has already folded.

### ADR-64 · 2026-10-04 · accepted — The T0 ↔ T1 handover is a state and a cross-fade in time, not a fade by zoom (PLAN 1.45a, critic B7)

- **Context:** the critic saw "translucent duplicate counters persist behind real ones when
  paused" (`critic/shots/s4_07_crop_ghost_counters.png`). PLAN 1.45 blamed split and merge
  fades that do not finish while the game is paused.
- **Measured, 1938 start, paused, the camera at rest 1.5 s at each zoom** (px per cell → m/px:
  counters drawn at their opacity, markers drawn at theirs; a split or merge still running?):
  - 4 → 4892: 107 counters at 1; no markers; no.
  - 7.6 → 2575: 111 at 0.995; none (0.005 is not drawn); no.
  - 8 → 2446: 104 at 0.836; 356 at 0.164; no.
  - 9 → 2174: 83 at 0.204; 268 at 0.796; no.
  - 9.7 → 2017: none; 243 at 0.998; no.
  - 10 → 1957: none; 237 at 1; no.
  The split and merge animations do finish while paused. The ghosts are the cross-fade between
  the two unit layers, which `markerAlpha` made a function of the zoom over 2000–2600 m/px: the
  two opacities add up to one, and a camera that stops in that band shows both layers
  half-faded for as long as it stays, paused or running. SPEC §8 promised hysteresis for every
  layer; this one had none.
- **Decision:** which layer shows is a state (`TierHandover`). The markers come in when the
  zoom reaches T1_MAX_M (2000 m/px) and go out above T1_MAX_M × 1.15 (2300 m/px). A change of
  state is a cross-fade over 250 ms of real time, the markers' share easing from 0 to 1 and the
  counters having the rest. At rest the share is exactly 0 or 1: one layer in full, the other
  not drawn. A turn in mid-fade continues from the share reached. The view keeps drawing while
  the fade runs, paused or not, and draws one more frame after any unit animation ends, so the
  end state is what stays on screen.
- **Why 1.15 and not the old band's 1.3:** the hysteresis only has to keep a camera that
  hovers at the threshold from flickering. The counters' cluster levels use ±0.15 for the same
  purpose. A wider band would keep the markers on screen further out, where their boxes of a
  fixed 26 px are closest together.
- **What it replaces:** `markerAlpha(mPerPx)` and `counterAlpha` are gone; `markerLowFade` is
  the markers' fade toward T2 only. The unit test of the old fade by zoom is replaced by tests
  of the new rule (`tests/unit/handover.test.ts`); it tested a rule that no longer exists.
- **Not changed:** the T1 → T2 fade (markers out, element sprites in, 210–300 m/px) still goes
  by zoom and has the same flaw at rest. PLAN 2.7 is "fade curves and hysteresis for all
  layers" and takes it, with the marker → elements morph.
- **Tests:** `tests/e2e/handover1938.spec.ts` (at rest at 2575, 2446, 2174 and 2017 m/px from
  T0: counters only, all at opacity 1; from T1 at 2017 and 2174: markers only, at 1; at 2446:
  counters again; the 250 ms cross-fade frame by frame; the same with the game running),
  `tests/unit/handover.test.ts`. PLAN 2.2's frame-by-frame continuity test
  (`tests/e2e/counters1938.spec.ts`) passes unchanged.

### ADR-63 · 2026-10-04 · accepted — A dragged brush is a stroke: many commands, one undo step (PLAN 1.44, critic B6)

- **Context:** in the editor a left-drag panned the map and only a click painted (critic B6:
  after a click 49 cells changed, after a drag none). AoC's editors paint with a held brush
  (VISUAL: `reference/frames/scene_007.png`, a brushed outline in its map painter).
- **Decision:**
  - *Who gets the left button.* While the editor's tool is the brush or the line, a primary
    press on the map belongs to the tool and the camera ignores it. The camera pans with the
    right button (new) and the middle button, with two fingers, and with the keys. With any
    other tool, or the editor closed, a left-drag pans as before. A click is now a click of
    the primary button only: a right-click neither paints nor selects.
  - *Brush.* The press stamps the brush (`editPaint`, `stroke: 'start'`); each further cell the
    pointer enters paints a line from the last point (`stroke: 'more'`), so no cell under the
    path is skipped however fast the pointer moves. Positions are world cells with x not
    wrapped, so a stroke crosses the map's seam.
  - *One undo step.* A `more` segment grows the stack's top edit instead of pushing one. The
    stack knows whether its top edit is the stroke in progress (`EditStack.stroke`); a `start`,
    any other paint, an import, an undo or a redo ends the stroke. A `start` that changes
    nothing pushes nothing, and the stroke then begins with its first change.
  - *Line.* Press at the start, release at the end: one `editPaint` of the line tool. Released
    in the cell of the press it is a click, and the two-click line works as before.
  - *Touch.* One finger paints; a second finger ends the stroke and the two move the map.
- **Why many commands and not one command with the stroke's points:** the map has to show the
  paint while the pointer moves, so the cells must change during the drag. One command at the
  release would paint nothing until then.
- **Why grow one edit and not link the segments** (as the import links its two edits): the
  stack keeps 50 edits, and a stroke of 51 segments would evict its own beginning. One edit per
  stroke also keeps the Undo count meaning strokes.
- **State and hash:** the stroke flag is world state (a save in mid-stroke must continue the
  same), written into `edits.json` only while a stroke is open, so a world without one has the
  bytes it had: the pinned hash of seed 99 did not move.
- **Undo runs backward through an edit's cells.** If the running game changes a cell under an
  open stroke and the stroke passes over it again, the cell is listed twice; the earlier entry
  holds what the cell was before the stroke and must be applied last. Edits without repeats
  undo exactly as before.
- **Not in this task:** the God Mode territory brush (`paintControl`) is still click-only and a
  drag with it pans. It is PLAN 1.44b. Bucket and the scenario tools (cities, capitals, cores)
  stay click tools by design.
- **Addendum, PLAN 1.44b (2026-10-04): the God territory brush follows.** With the tool on and a
  nation selected, the left button paints and the camera leaves it alone, through the same
  drag path of the map view. `paintControl` gained an optional end point (`x2, y2`): the brush
  is stamped at every cell step of the segment, one command per pointer move, so a fast drag
  skips no cell. Without the end point the command is the disc it was (the pin did not move).
  No stroke and no undo here: the God brush sets control only and never was on the edit stack.
  While the editor is open its tools take the map, as its clicks already did. The other God
  tools (revolt, breakthrough) stay click tools. Tests: `tests/unit/paintControl.test.ts`,
  the God Mode case of `tests/e2e/editorDrag1938.spec.ts`.
- **Tests:** `tests/unit/editor.test.ts` (a stroke paints its path and is one step; what ends a
  stroke; no empty step; 70 segments are one step; a cell changed under the stroke; a save in
  mid-stroke; an empty stack has its old bytes), `tests/e2e/editorDrag1938.spec.ts` (30 cells by
  mouse, the camera still, one Ctrl+Z; right- and middle-drag pan; a right-click paints
  nothing; the line by a drag; the bucket pans; one finger paints, two move the map).

### ADR-62 · 2026-10-04 · accepted — The title screen's scenario map is a generated image, checked against the data (PLAN 1.43c)

- **Context:** AoC's Scenarios screen shows a map of the chosen scenario with its size, nations,
  cities and date (VISUAL 2026-10-04: `reference/frames/scene_006.png`). Ours had the list and
  the form, and text where AoC has the map.
- **Decision:** the map is an image, `public/data/scenarios/<id>/preview.png`, 1024 × 512: each
  land cell in the colour of the nation that holds it at the start, the game's sea colour, a
  dark line where the holder changes, a darker coast. `tools/data/preview.ts` builds it from
  the shipped map assets and the scenario data with the sim's own `buildPoliticalMap`;
  `npm run data` writes it, and `npm run data -- --previews` writes only it (no downloads).
  The title screen shows it with the start date, the map and its size, and the number of
  nations alive at the start (`SCENARIO_INFO[id].nations`, from `nations.json`).
- **Rejected: building the map on the title screen.** It needs the sim worker and 3.2 MB of
  map assets to draw one picture, and the title screen would no longer be free of a worker
  (ADR-60). The image is 33 KB.
- **The risk of an image is drift,** so the gate rebuilds it: `tests/unit/scenarioPreview.test.ts`
  compares the committed image's pixels with what the data gives today and names the command
  to run. Pixels, not file bytes: a PNG's bytes depend on the zlib that packed it.
- **Not shown:** the number of cities (AoC shows it). The city list is 350 KB and belongs to
  the worker's bundle; a count in the main bundle is not worth that, and can come with a
  scenario registry read from `data/` (PARITY row 78).
- **Layout:** the title screen is wider (74 rem), and the chosen scenario's card holds the map
  and facts beside the form, so Start is on the screen without scrolling at 1400 × 800 (the
  spec asserts it). Below 960 px the form goes under the map.

### ADR-61 · 2026-10-03 · accepted — Loading from the title screen: the URL names the game, the loaded world corrects it (PLAN 1.43b)

- **Context:** ADR-60 made a game its URL. A loaded game does not fit that at once: the bytes
  of a scenario file do not survive a navigation, and a loaded world has a seed and a looping
  setting of its own, while the map view is built from the URL before the world exists.
  Measured before the change: a game started with `looping=0` and resumed by
  `?scenario=1938&continue=1` drew wrap copies of the map (`view.wrapsX` true) over a world
  without a looping map, and the settings panel showed seed 1938 for a world of seed 77.
- **Decision:**
  - *Continue.* The autosave record keeps the seed and options of the game that wrote it
    (app side: nothing enters the sim). Continue opens that game's URL plus `continue=1`.
  - *Scenario file.* The title screen checks what needs no sim (the file unpacks, its format,
    its base scenario exists here at the file's map size) and refuses the rest with the reason.
    A file that passes is stored in IndexedDB (slot `scenario`) and the title screen navigates
    to `?scenario=<base>&paused=1&load=scenario`. The game loads it through
    `importScenarioFile`, which checks the state hash as the editor's import does.
  - *The file stays stored* until another replaces it, so reloading that game starts the
    scenario again, as reloading a seed URL starts that game again.
  - *The loaded world wins.* After a load (autosave or scenario file) the game reads the
    world's seed and looping setting. The seed is shown. A looping setting that differs from
    the URL's corrects the URL (`location.replace`) and the game boots again: one more boot,
    only in that case, and it cannot repeat (the corrected URL agrees with the world).
  - *A load that fails in the game* (nothing staged, or a state that is not the one the header
    names) returns to `/?failed=scenario`, and the title screen says the file could not be
    loaded. A game that silently started a new 1938 world instead would be the wrong game.
- **Rejected:**
  - Booting the game in the page with the file's bytes in memory: `/` would stay in the
    address bar and a reload would lose the game (ADR-60).
  - The looping setting and the seed in the scenario file's header: files already exported
    lack them, and a continue URL typed by hand or from an older autosave has the same
    problem. Reading them from the loaded world covers all three.
  - Rebuilding the map view in place when the looping setting differs: the renderer, the
    labels and the unit layers each take the wrap at construction.
- **Known limit:** the editor's import into a running game (PLAN 1.38) still keeps the running
  game's wrap: a scenario without a looping map imported there is drawn with wrap copies. It
  now shows the right seed. Loading the file from the title screen is the way that is right.
- **Tests:** `tests/e2e/title.spec.ts` (Continue: tick, state hash equal to a Node sim, no
  wrap, seed and options in the panel; a bare continue URL is corrected; a scenario file of a
  non-looping world of seed 5 starts with its hash, without wrap, showing seed 5, and again
  after a reload; four files refused on the title screen; a forged hash refused by the game;
  nothing staged), `tests/unit/gameUrl.test.ts` (the URLs; `checkScenarioFile`).

### ADR-60 · 2026-10-03 · accepted — `/` is a title screen; a game is its URL (PLAN 1.43, critic B5)

- **Context:** `/` booted the two-nation toy world, a test fixture, and the 1938 world could be
  reached only by typing `?scenario=1938` (critic B5). AoC opens on a main menu: New game, Load
  game, Scenarios, Settings, Credits and Quit along the top, a scenario list on the left, a map
  preview with Play and Edit on the right (VISUAL 2026-10-03:
  `reference/screens/steam-trailer-contact-sheet.png`, second row, last tile), and a search
  field in the menu since v3.1.1 (TEXT).
- **Decision:**
  - A URL without `?scenario=`, or with an unknown one, is the title screen
    (`src/ui/TitleScreen.tsx`): the scenario list, the chosen scenario's name, description, start
    date and map, and the new-game form of PLAN 1.39b1 (seed and options) with Start. Nothing of
    a game exists behind it: no sim worker, no map canvas, no `window.__warsim`.
  - Start navigates to the game's URL (`newGameUrl`), exactly as New game in the settings panel
    already did. `src/app/main.tsx` chooses between the title screen and `src/app/game.tsx`
    (the former `main.tsx`, unchanged but for being a function).
  - Which scenarios are offered is data: `"hidden": true` in a `scenario.json` keeps a scenario
    off the list. The toy world is hidden and opens by `?scenario=toy`.
  - The seed field starts with a random seed on each visit. Without `seed=` in a game URL the
    seed is still 1938, as before.
  - Settings → Main menu autosaves the game, then goes to `/`.
- **Why a navigation and not a boot in the page:** a game that is its URL restarts on reload,
  can be shared by its seed, and is what the e2e specs of the 1938 world and the critic's
  scripts already open. Booting in the page would leave `/` in the address bar for every game.
- **Why the toy world is not listed:** it is two rectangles for the tests of the worker, the
  camera and the map view. A player who picks it has found a test fixture, not a scenario. The
  critic asked for it behind a flag; its URL is that flag.
- **Deviations from AoC [AoC-DEVIATION]:**
  - One screen instead of a menu bar with sub-screens: there is one listed scenario today, and
    the settings live in the game's own panel. No Quit (a browser tab) and no Credits screen
    (`DATA_SOURCES.md` holds the sources; a credits view can come with the polish of Phase 7).
  - The interface size setting applies to the title screen; in AoC it does not affect the main
    menu (TEXT, v3.2.3). A player who needs a larger interface needs it there too.
  - No search field: it would search a list of one.
- **Split:** PLAN 1.43a is this ADR. Continue (the autosave) and loading a `.warsim-scenario`
  file from the title screen are PLAN 1.43b; a map preview of the chosen scenario, as AoC has,
  is PLAN 1.43c.
- **Tests:** `tests/e2e/title.spec.ts` (no worker and no canvas at `/`; the game started from
  the screen has the state hash of a Node sim with the same seed and options; Main menu leaves
  an autosave at the tick it left; the toy world by its URL), `tests/unit/scenarios.test.ts`
  (the list; unknown ids). Ten specs that opened `/` for the toy world now open
  `/?scenario=toy`; nothing else in them changed.

### ADR-59 · 2026-10-03 · accepted — The critic runs once per phase, not every five commits (the user's decision)

- **Context:** since ADR-49 the critic was due 5 commits after the later of its report and
  the last commit that fixed one of its findings (subject starting "Critic "). In the feature
  phases nearly every commit answers a finding (B2 is semantic zoom, B3 the missing naval, air
  and nuclear rules), so the count kept restarting: the report of bb1dd4f was 28 commits old
  and the critic would have returned whenever five housekeeping commits happened to pile up.
  With ADR-58 a part of every run (multi-decade dynamics) also judges what is now deferred.
- **Decision (the user's, 2026-10-03):** keep the critic and run it at fixed points: after each
  phase review (PLAN 2.11, 3.7, 4.8, 5.8, 6.9), which is also where the smoke run of ADR-58
  is, and for the DONE condition. The 5-commit rule and the meaning of the "Critic " prefix
  are gone. `npm run critic:due` reports due when there is no report or when a phase review
  has been ticked in PLAN.md since the commit the report names. The user can ask for a run at
  any time.
- **Why keep it at all:** it is the only part of the process that looks at the game as a
  player does. Four of its seven blocking issues were plain defects that every test had
  passed: nothing to see at close zoom (B2), no way into the game from `/` (B5), an editor
  brush that does not paint on a drag (B6), Europe unreadable at world zoom (B7). It is also
  the judge the DONE condition names. Its prompt is unchanged: it goes on scoring long-run
  dynamics, and the builder defers that one kind of finding (ADR-58).
- **Findings become PLAN tasks.** Step 2b follows a report only while it is within the last 10
  commits. After that nothing scheduled B5, B6 and B7: no PLAN task named them. They are now
  PLAN 1.43, 1.44 and 1.45, ahead of the Phase 2 tasks, and step 2a says to add a task for
  every blocking issue of a new report that has none.
- **Not added:** B4 (revolt fragmentation; flagless "Free <village>" states). ADR-47 answered
  part of it (defection and spreading) and its remaining count of nations is balance (ADR-58).
  Whether rebel states still lack flags and regional names has not been checked; the next
  critic run will say.
- **Tests:** the cases of the 5-commit rule in `tests/unit/gate.test.ts` are replaced by cases
  of the new rule (no report; nothing ticked; a review ticked; what counts as a review; the
  review tasks of PLAN.md itself). The old cases tested a rule that no longer exists.

### ADR-58 · 2026-10-03 · accepted — Balance sweeps are suspended until the features are in (the user's decision)

- **Context:** since critic B1 ("the world is static over decades") the loop has spent most of
  its time on balance: PLAN 1.42 failed three deciding sweeps (9, 7 and 8 of 10 unseen seeds),
  its criteria were rewritten (ADR-54), and six sub-tasks (1.42a–1.42f) were done to prepare a
  fourth. All of it tunes a world of land armies only. The critic scores naval warfare, tanks,
  aircraft and nuclear weapons at 0 and semantic zoom at 3; every one of those features will
  move the balance more than a constant can. Sea transport alone decides whether an overseas
  empire can be held or attacked. The three quick sweeps of PLAN 1.42e (one per rule) all kept
  the limits and found nothing.
- **Decision (the user's, 2026-10-03):**
  1. No `npm run sweep` and no `npm run sweep:quick` after a rule change until phases 2–6
     are complete. PLAN 1.42 moves to Phase 7.
  2. The 10-year tests of the gate stay (`tests/sweep/`: the pinned state hash, save and load
     after a year, allies never at war with each other, no bankruptcy in ten peaceful years).
     They test that the sim is correct and deterministic, not that it is balanced.
  3. One quick sweep at each phase review (PLAN 2.11, 3.7, 4.8, 5.8; the sweep of 6.8 for
     Phase 6) is a smoke test: its five limits are reported in PROGRESS. A limit that fails
     is logged in BLOCKERS and waits for Phase 7, unless a defect of that phase's feature
     caused it (a crash, a desync, a mechanism that does not work). No constant is tuned in
     answer to it.
  4. Critic findings about long-run balance and dynamics (B1 and its kind) are logged once
     per report and not acted on before Phase 7 (PROMPT step 2b). They are not disputed: the
     critic is right that the world is too static, and stays free to say so.
- **Why keep the smoke run:** without any long run, gross breakage builds up over four phases
  and surfaces at once in Phase 7, where it cannot be traced to the feature that caused it.
  PLAN 1.40 found 300–600 nations after 50 years that way. One run per phase costs 5–9 minutes.
- **What does not change:** the DONE condition (the critic's dimensions, zero blocking issues,
  a multi-decade sweep with borders moving and no hegemon). PLAN 6.8, 7.3 and 1.42 run when
  the features are in. The rules made for B1 so far stay (ADR-47, ADR-50, ADR-51, ADR-53,
  ADR-57): each removed a defect, none is a constant chosen to pass a seed.
- **Consequence to watch:** the balance debt is paid in Phase 7 in one piece, with every
  system interacting. That is the only time tuning it can last, and it will take longer than
  one task: 1.42 is the place for it.

### ADR-57 · 2026-10-03 · accepted — The land rules of a war count km², not cells (PLAN 1.42e1)

- **Context:** ADR-52 made every reported land figure an area and left the sim's rules on
  cells. On the Miller map a cell covers 382 km² at the equator, 128 km² at 60°N, 63 km² at 72°N
  and 29 km² at 80°N; the mean owned cell of the 1938 start is 212 km² (133.2 M km² over 627,829
  cells). A war's shares were shares of cells, so land at 60°N weighed 1.7 times its area and
  land at 72°N 3.4 times: a km² of the Arctic coast scored three times a km² of the Ukraine,
  and the Soviet Union was "75% overrun" with the northern 61% of its land held.
- **Decision:** every land figure in `src/sim/systems/war.ts` is km²: the score (`occ`, the
  smaller-party cap), the true share behind exhaustion, capitulation (both tests), the puppet
  share of a peace, and the small-state limit. The shares keep their numbers (REL_CAP 2,
  CAPITULATE 0.75, PUPPET_SHARE 0.3).
- **Whole km² per cell.** `LandCounts` is kept by the cell setters and rebuilt by a scan on a
  load. Sums of the exact areas (floats) depend on the order of the additions, so a kept tally
  and a scanned one would differ in their last bits, and a loaded game could settle a peace
  differently from the game that saved it. A cell therefore counts the area of its row rounded
  to a whole km² (`cellKm2ByRow`): the tallies are integers, exact in any order. The rounding is
  at most 0.5 km² a cell; the tallies of the 40 largest nations of 1938 are within 0.1% of
  their exact areas (`tests/unit/landCounts.test.ts`). The sim's rules measure whole km² per
  cell; the reports (`landArea.ts`: statistics, ranking, panel, sweep) keep the exact areas.
- **The one absolute number.** `SMALL_STATE_CELLS = 40` becomes `SMALL_STATE_KM2 = 8500`: 40
  cells of the mean owned cell (40 × 212.2 = 8,487). The old comment said "≈ 15,000 km²", which
  is 40 cells at the equator (15,282 km²); between 35°N and 55°N 40 cells were 11,000–6,300
  km². The mean keeps the limit where it was for the world as a whole and only moves it by
  latitude. At the 1938 start Danzig (7 cells, 1,135 km²) and Luxembourg (14 cells, 2,654
  km²) are below it either way; Lebanon (35 cells, 9,874 km² on the map) was below 40 cells and
  is above 8,500 km².
- **Not converted here:** overextension (PLAN 1.42e2) and the admin cost (PLAN 1.42e3), each
  its own commit. Left to PLAN 7.1b, because they are distances or per-cell mechanics and not
  shares of land: `OVEREXT_CELLS` (distance to the capital), `MILITIA_PER_CELLS`, and the
  largest fragment of a collapse (`revival.ts`, by cells). `nations.cells` stays a saved column
  (the save layout does not change).
- **Tests:** four new ones in `tests/unit/war.test.ts`, each on a case where cells and km²
  disagree: Arctic Soviet cells numbering half of the German cells score 10, not 50; the
  northern 78% of the Soviet cells are 65% of its land and it does not capitulate, and does
  at 80% of the land; 33% of its cells in the north are 19.5% of its land and a dictated
  peace makes no puppet of it; 48 cells around Helsinki are a small state and 32
  cells around Rio de Janeiro are not. The older test "half of Germany's size taken from the
  Soviet Union scores 50" now takes half of Germany's km². With the tallies counting 1 per cell
  again, all of these fail.
- **Hash:** seed 99 after one year e5741d70 → 23734db3; after five years 7a8e5c27 → 6738d695.
- **Tick time** (seed 99, performance cores, see PROGRESS): year 1 1.67 → 2.05 ms (budget 2.4);
  5-year mean 1.43 → 1.37 ms (budget 1.5). Year 1 has 29 major battles instead of 8. The tallies
  themselves cost nothing measurable (the war system: 0.07 ms a tick before, 0.06 after).
- **Quick sweep** (seeds 1–10 × 20 years, seen seeds, no verdict at 20 years): limits 10 of 10,
  riser 7 of 10, faller 10 of 10 (7 and 10 after ADR-56). Largest nation 12.7–16.2% of the land,
  92–139 nations alive, land moving in the last five years 7.8–16.6%. Largest faller by seed:
  the British realm in 1, 4, 5 and 9, China (no land left) in 2 and 10, Italy (no land left)
  in 3, 7 and 8, the Belgian realm in 6. Wall time 4.5 min.
- **Overextension (PLAN 1.42e2, 2026-10-03):** a holder's share of the world's owned land
  (`revolts.ts`) is read from the same km² tallies, summed over the living nations as before.
  `OVEREXT_SHARE` stays 4%. At the 1938 start, share and monthly strain in far provinces:

  | Nation | By cells | Strain | By km² | Strain |
  |---|---|---|---|---|
  | Soviet Union | 26.8% | 2.50 | 15.9% | 2.50 |
  | United States | 7.3% | 1.03 | 7.0% | 0.93 |
  | Canada | 12.3% | 2.50 | 6.8% | 0.89 |
  | Brazil | 3.7% | 0 | 6.4% | 0.75 |
  | Australia | 4.0% | 0.01 | 6.1% | 0.66 |
  | Denmark (Greenland) | 5.4% | 0.45 | 1.5% | 0 |

  Unrest decays by 2 a month, so the strain alone raises unrest only above 10.4% of the
  land. By cells that was the Soviet Union and Canada; by km² it is the Soviet Union alone,
  still at the cap. Below that the strain slows the decay of unrest that has another cause
  (occupation, non-core land, war): by km² that now applies to Brazil and Australia and no
  longer to Greenland.
  Test: `revolts.test.ts`, Canada's far provinces stay at 0 through March (1.5 by cells) and
  Brazil's far provinces lose unrest more slowly than Argentina's by exactly the strain.
  Hash: seed 99 after one year 23734db3 → 6569bc8e; after five years 6738d695 → 7f1ffbfb.
  Tick, pinned: year 1 2.06 ms, 5-year mean 1.42 ms (one run; budgets 2.4 and 1.5).
  Quick sweep (seeds 1–10 × 20 years, scratch): limits 10 of 10, riser 8 of 10, faller 10 of 10
  (7 and 10 after 1.42e1); largest nation 12.6–17.1% of the land; wall time 5.9 min.
- **Admin cost (PLAN 1.42e3, 2026-10-03):** admin = min(0.25 × (km² held ÷ `ADMIN_KM2`)^1.35,
  50% of gross), with `ADMIN_KM2` = 212,000: the 1,000 cells of the old rule at the mean owned
  cell of 1938 (212.2 km²). `monthlyAccounts` sums the whole km² of the cells a nation controls.
  Charged at the 1938 start (after the cap), gold a month and share of the nation's gross:

  | Nation | By cells | Of its gross | By km² | Of its gross |
  |---|---|---|---|---|
  | Soviet Union | 252.7 | 21.9% | 125.3 | 10.8% |
  | Canada | 79.0 (at the cap) | 50.0% | 40.1 | 25.4% |
  | United States | 43.6 | 0.8% | 41.1 | 0.7% |
  | Denmark (Greenland) | 29.4 | 18.8% | 5.1 | 3.2% |
  | Australia | 19.6 | 7.8% | 34.4 | 13.6% |
  | Brazil | 17.5 | 13.8% | 36.5 | 28.6% |
  | French West Africa | 8.1 | 9.4% | 16.4 | 18.8% |
  | China | 10.4 | 3.9% | 15.8 | 5.9% |

  The world pays 554.6 gold a month by cells and 461.2 by km² (2.85% and 2.37% of its gross of
  19,443); 4 nations are at the cap by cells, 6 by km².
- **Why the mean cell, and what it costs.** Two other references were on the table. A cell at
  the equator (382,000 km²) leaves the tropics as they were and cuts everyone else: the world
  would pay 211.0. A constant fitted to keep the world's total (about 184,000 km²) is a number
  chosen for an outcome. The mean cell is the unit conversion of "1,000 cells" and nothing
  else. The total still falls by 17%, because the cost is superlinear and the cells measure had
  made its two largest payers larger than they are. **The Soviet Union pays 127 gold a month
  less, 11% of its income:** the anti-hegemon cost on the largest nation is halved by measuring
  it correctly. Whether it then grows too strong is for the sweeps of PLAN 1.42 to show, not
  for this constant to prevent.
  Tests: `economy.test.ts` (the cost in units of `ADMIN_KM2`; on the 1938 map Canada pays less
  than the United States, having less land and more cells, and Greenland costs Denmark under
  5% of its income). The tiny 4×1 test world has cells a quarter of the map each, so its
  admin cost is now at the cap, and that test says so.
  Hash: seed 99 after one year 6569bc8e → f93cb674; after five years 7f1ffbfb → 6b84c48c.
  Tick, three runs pinned (`--affinity 0xFFFF`), the rule of PLAN 1.42f: 5-year mean 1.4648,
  1.4612, 1.4563 ms (budget 1.5); year 1 2.2729, 2.2615, 2.2457 ms (budget 2.4). Met, with
  0.04 ms to spare on the mean.
  Quick sweep (seeds 1–10 × 20 years, scratch): limits 10 of 10, riser 6 of 10, faller 10 of 10
  (8 and 10 after 1.42e2); largest nation 12.2–16.4% of the land and 28.4–29.5% of the income.

### ADR-56 · 2026-10-03 · accepted — Cell A* uses an octile bound (PLAN 1.42f, step 4)

- **Context:** the 5-year mean tick of seed 99 was still over budget after ADR-53 and PLAN 1.42f
  step 3. A profile of year 1 put 19% of the tick in route searches, nearly all in the cell A*
  loop. Its heuristic was the straight-line km between two cells at the smaller endpoint row
  scales. On an 8-connected grid a walk is diagonal steps plus straight ones, which is up to
  about 8% longer than the straight line, so A* expanded a wide fan of nearly tied cells.
- **Decision:** the heuristic is the octile walk with the same row scales: min(dx, dy) diagonal
  steps of √(kx² + ky²) and the rest straight (`octileKm`). It is never below the straight-line
  bound (a unit test checks 6,000 pairs on three grids). `boundKm` stays the distance of the
  province graph and of the 500 km switch, which this does not change.
- **Why it is a rule change:** the search is the same, but a tighter bound pops cells in another
  order, so ties between equal routes can break differently. The reference search in
  `movement.test.ts` now uses the octile bound, and its pop order and tie-break are unchanged.
- **Result:** replaying year 1's 5,868 route requests on the 1938 map: 5.86–6.11 s → 4.75–5.23 s
  (−17%). No route is dearer, 221 are cheaper (by ≤ 1.4%), and 112 paths differ. Seed 99 × 5
  years on a 4-core machine about 1.9× slower than the one of the budget: year 1 3.66 → 3.30 ms
  (−10%); 5-year mean 2.985 → 2.928 ms (−1.9%; the world differs from year 1 on, and year 4 flips
  twice as many cells). In the budget machine's terms that is a mean of about 1.52 ms.
- **Hash:** seed 99 after one year 2cb270e6 → e5741d70; after five years f57f70ac → 7a8e5c27.
- **Quick sweep** (seeds 1–10 × 20 years, seen seeds, no verdict at 20 years): limits 10 of 10,
  riser 7 of 10, faller 10 of 10 (6, 10 and 10 before, ADR-54). Wall time 20.4 min on this machine.
- **Not solved:** neither bound is a strict lower bound when a route swings poleward of both its
  ends. Against Dijkstra on 30 random grids of 16–64 rows, 21,042 of 84,575 routes were dearer,
  by up to 15.1%, with the octile bound, and 22,037, by up to 15.2%, with the old one. SPEC §4
  had called this 0.1%, which was not a maximum.

### ADR-55 · 2026-10-03 · accepted — The gate skips a tree it has passed; the baseline hash is a test (the user's request)

- **Context:** the user asked what slows the iterations. Measured on 2026-10-03: the gate on
  a sim change takes about 6 minutes (10-year sweep tests 171–193 s, e2e about 100 s, unit
  43–77 s). Step 2 of every iteration ran it on the commit that the previous iteration had
  just gated (about 3 minutes for nothing). Every claim of "no behaviour change" was a pair
  of 5-year runs by hand (75 s each), and the hash written into PLAN 1.42d as the baseline
  was two rule changes old.
- **Decision 1:** a green gate records the tree it passed, taken before its stages run
  (`.cache/gate/green.json`; the tree a commit of everything but `critic/` would have, written
  through a scratch index). On a clean working tree whose HEAD has one of the recorded trees,
  `npm run check` runs nothing. A HEAD the gate has not seen (a pull, a rebase, a fresh clone,
  a commit of files edited while the gate ran) gets the code stages, as before.
- **Decision 2:** `tests/sweep/baselineHash.test.ts` pins the state hash of seed 99 after one
  year. It runs with the 10-year sweep tests, in parallel with them, so the gate is no slower.
  A change of rules, data or recorded state updates the pin in its own commit and logs the old
  and new hash here; that is a new baseline, not a weakened test.
- **Not changed: the 10-year sweep tests.** They are seven files run in parallel, so the stage
  lasts as long as its slowest run, a 10-year AI war run. Cutting years would drop years 6–10
  of the alliance invariant and of the bankruptcy check. The stage got shorter with the tick
  instead (PLAN 1.42f): 193 s before, 119 s after.
- **Limits:** the record is local to the machine and trusts the same thing ADR-48 trusts: that
  commits are made from the tree the gate saw. `npm run check:full` ignores it.

### ADR-54 · 2026-10-03 · accepted — Sweep dynamism: a riser and a faller, judged over the seeds (the user's decision; PLAN 1.42)

- **Context:** critic B1 (static world) added two criteria on 2026-10-03, required of every
  seed: ≥ 2 new nations among the ten largest by land, and a range of ≥ 3 points in the
  largest nation's land share. Three full sweeps on unseen seeds ended at 9, 7 and 8 of 10
  (25 minutes each) and PLAN 1.42 was blocked. The user asked whether the criteria are valid.
- **What was wrong with them as gates:**
  1. *Every seed must pass.* With a pass rate of 80–90% per seed, ten of ten happens in
     11–35% of sweeps. Results of 9, 7 and 8 are what one unchanged world produces; they did
     not tell the three versions of the code apart.
  2. *The leader-share range looks at one nation.* By area all of Europe west of the Soviet
     Union is about 4% of the owned land, so redrawing it leaves the leader's share alone.
     Three points is 4 M km², a fifth of the Soviet Union (it was a ninth by cells). The
     real world from 1938 to 1988 moves it by about one point (21.2 → 22.4 M km²; my
     figures, not measured here) and would fail.
  3. *Top-ten churn counts swaps at tenth place.* At the 1938 start France is tenth with
     3.00 M km² and the next three are within 7% of it; an empire cut in half inside the
     top ten does not register.
- **What they were right about:** the Soviet Union leads in every year of every run to date,
  it only shrinks, and no rival grows. The rewrite keeps that question and asks it directly.
- **Decision.** The five older criteria stay as limits that every seed must keep. Dynamism is
  two per-seed measures, by area, between the end of year 1 and the end of the run. The unit
  is the realm: a living nation with no overlord, with the land of its puppets.
  - *Riser:* some realm that ends with ≥ 1% of the owned land holds ≥ 1.5 × the land it
    held after year 1. The 1% floor keeps a city state that doubles from counting. A realm
    that did not exist after year 1 (a revolt, a released puppet) is not a riser: the
    question is whether a rival grows, and its land already shows as someone's loss.
  - *Faller:* some realm among the ten largest after year 1 ends with ≤ 2/3 of its land
    of then. One that is dead or a puppet by the end counts.
  A sweep passes when every seed keeps the limits and each of riser and faller holds in
  ≥ 80% of the seeds (8 of 10). Only runs of ≥ 50 years are judged by riser and faller;
  shorter runs (the quick sweep) report the numbers and are judged by the limits.
- **Where the numbers come from** (fixed here, before any run): a factor of 1.5 either way.
  Checked against the real world of 1938–1988 in this game's partition of 1938 (my figures):
  China grows from 4.9 to 9.6 M km² (× 1.96), so there is a riser; the French, British and
  Italian realms each lose over 80% of their land, so there is a faller. A threshold that history
  itself failed would be the wrong one; these are well inside it, and Ages of Conflict is
  livelier than history. They were not chosen from any run of this simulation.
- **This relaxes one thing and tightens another, and both are stated.** Under an 80% quorum
  the old two criteria would have passed all three failed sweeps (9 and 10, 8 and 8, 8 and 10
  seeds of 10). That is why the measures are replaced and not only the quorum: a riser and a
  faller need changes several times larger than a swap at tenth place or three points of
  leader share. The old two stay in every report as columns, so the reports before and
  after can be compared.
- **Corrected the same day, before any deciding run.** The first version measured nations, not
  realms, and counted new states as risers. The first quick sweep with it (seen seeds 1–10 ×
  20 years, `.cache/sweep/reports/2026-10-03-sweep-adr54.md`) showed a riser and a faller in
  10 of 10 seeds for a reason that is no dynamism at all: overlords integrate their puppets.
  France alone goes from 3.0 to 12 M km² and French West Africa from 4.8 to 0 in every seed;
  the Netherlands take in the East Indies (× 10). The measure was made stricter (realms; new
  realms are no risers); the thresholds and the quorum were not touched. This is a change
  made after seeing a run, in the direction of failing more, on seeds already seen.
- **The same quick sweep by realm** (`2026-10-03-sweep-adr54b.md`, seeds 1–10 × 20 years,
  5.2 min; reported, not judged, and no pass claim): limits 10 of 10; a riser in 6 of 10
  (the United States × 1.55–2.07 in three seeds, Germany × 4.3, Poland × 5.1, Iraq × 4.7;
  the best in the other four is × 1.20–1.47); a faller in 10 of 10. **The faller will not
  decide a sweep:** the British realm, the largest after year 1 with 35 M km², ends at
  8.6–12.1 M km² in every one of the ten seeds, and the Belgian realm loses the Congo in
  seven. Colonial realms come apart in every seed within 20 years. The faller measures what
  it says, but it will not tell a lively seed from a quiet one; the riser will. It was left
  as decided: tightening it would be a second change made after looking at seen seeds, and
  is the user's call.
- **What the realm figures show that the old two criteria did not:** on the same ten runs
  the old measures read 1–2 new nations in the top ten and a leader-share range of 0.3–4.2
  points, while the British realm lost two thirds to three quarters of its land and the
  realm of the United States grew in all ten (× 1.07–2.07). The largest single nation is
  the Soviet Union in every year of all ten.
- **Not re-judged:** the seen seeds (1–10, 99, 101–110, 201–210, 301–310) and the three
  FAILING reports stand as they are. Only seeds from 401 judge PLAN 1.42, and no 50-year run
  has been judged by area or by these criteria at the time of writing.
- **Quick sweep:** 10 seeds × 20 years (was 3): the seeds run side by side, and three seeds
  could not tell ADR-53 from noise. The sweep result records each realm's land after year 1
  and at the end (`realmStart`, `realmEnd`).
- **Not changed:** the limit on the largest land share stays per nation, as do the two
  reported columns.
- **Tests changed with the rule** (not weakened: they assert the new terms): the criteria
  test no longer fails a seed for churn or swing; it checks that both are still computed, and
  adds the riser, the faller, the quorum and the 50-year horizon.

### ADR-53 · 2026-10-03 · accepted — A marching formation keeps its front sector (PLAN 1.42f)

- **Context:** tick time on seed 99 was over budget again after ADR-50 and ADR-51 (5-year mean
  1.69 ms against 1.5; year 1 3.36 ms against 2.4). In year 1 the operational AI ran 15,900
  route searches. The 6,030 longer than 60 cells took 13.5 of 13.9 s (about 20,000 cells
  expanded each), and 5,584 of those were for formations already on the march, which had
  walked 8.5 cells of a 220-cell route on average before being sent elsewhere. A march of
  weeks was re-planned almost every day and seldom arrived.
- **Cause:** the planner kept a marching formation in its sector only while the sector's
  allotment of that day was not yet full. The allotment follows the threat and moves daily, so
  the formation was freed and given to another sector, often a far one. SPEC §7 and the file's
  own header already said "formations already marching into a sector keep it": the code
  disagreed with the stated rule.
- **Decision:** a formation marching into a sector that is still a front sector keeps it,
  whatever the allotment is today. It counts towards the allotment, so fewer others are sent
  there, and towards the sector's strength when it decides to attack or hold.
- **Result, seed 99** (`npm run sim`, with step 1 of PLAN 1.42f, which changed no behaviour):
  year 1 3.15 → 1.95 ms; cells expanded by route searches in year 1 120 M → 31 M. The
  5-year mean is 1.56 ms (1.54 before the rule): the world is a different one from year 2
  on (19 wars at the end of year 5 instead of 13). State hash after 5 years 93effc58 →
  f57f70ac; after 1 year dd3096af → 2cb270e6.
- **Check on dynamics** (scratch quick sweep, seen seeds 1–3 × 20 years, before and after;
  not a pass claim): wall time 6.5 → 4.6 min; no limit changed between pass and fail; land
  moving in the last 5 years 9.7–14.5% → 11.0–13.4%; the leader-share range moved both ways
  (2.1 → 0.5, 2.9 → 2.4, 0.5 → 1.2 points), which three seeds cannot tell from noise.
- **Test:** in the Germany–Poland duel no march into a sector that still exists is
  countermanded at the next plan (29 were under the old rule in 14 days).
- **Not solved:** a march whose sector is gone (the front moved) is still re-planned, about
  2,000 times in year 1 with the new target more than 12 cells from the old one, and those
  searches are most of what the planner still costs (0.3–0.4 ms a tick). The mean stays
  0.06 ms over budget: PLAN 1.42f is not closed.

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

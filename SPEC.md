# WarSim — Specification & Architecture

Status: v0.2 (2026-10-02, Phase 0 review: §2, §5.3, §8, §9, §10 synced with the implementation). Living document: update when decisions change and
record the *why* in `DECISIONS.md` (ADR numbers referenced as `[ADR-n]`).

---

## 1. Goals, non-goals, confidence

**Goal.** A browser grand-strategy world-war simulator that matches or beats
*Ages of Conflict: World War Simulator* (AoC) in capability and feel, starting
from a 1938 world, plus five differentiators: true semantic zoom, naval
warfare, armour, aircraft, AI nuclear weapons. Everything is original or permissively licensed.

**Non-goals.** Multiplayer networking (although deterministic replay makes lockstep
possible later). A server. Historical railroading (the 1938 start is plausible, and history
then diverges freely). Copying AoC assets, code or data.

**Reference confidence.** Every AoC claim is tagged **TEXT** (itch, devlog or
Steam text) or **VISUAL** (`reference/screens`, trailer frames). `reference/NOTES.md`
(the user's taste notes) **does not exist** as of 2026-10-02, so taste-sensitive
claims are lower confidence. Observations from the screenshots (VISUAL, 2026-10-02):
- The map is a per-pixel raster (the editor shot shows about 100k land tiles). Terrain classes:
  Basic Land, Forest, Hills, Grassland, Desert, Tundra, Mountains, **Crossing**
  (painted pale-blue sea lanes that land units can walk), Water.
- Flat nation fills with a slightly lighter or desaturated tint over occupied land.
  Diagonal hatching shows a selected nation's alliance or puppets. Large semi-transparent
  nation names are curved along the territory and sized by area.
- Units are dots of a few pixels with small gold numbers. Fronts read as dotted
  clusters along borders. Battles show crossed-swords war banners at the bottom.
- UI: a nation panel (flag, alliance with unity/loyalty, puppet master and integration,
  statistics, diplomacy icons), an Actions/Economy tabbed panel (income/expenses,
  bonus −/+), a Statistics ranking list with a dropdown, and a bottom bar with map-mode
  toggles, PAUSE, God Mode, Statistics, speed `1x` with arrows, date, and event count.

---

## 2. Architecture overview

```
 ┌──────────────── main thread ─────────────────┐        ┌────────── sim worker ──────────┐
 │ app/ (bootstrap, input, settings, autosave)  │ cmds → │ worker/ (protocol, scheduler)  │
 │ ui/ (Preact + signals, i18n)                 │ subs → │   ├─ sim/  (pure engine)       │
 │ editor/                                      │        │   ├─ snapshot builder +        │
 │ render/ (WebGL2: map, units, fx, labels, lod)│ ← snap │   │   interest management      │
 │   ↑ interpolates prev/cur snapshot on GPU    │ ← evts │   └─ derive/ (labels, modes;   │
 └──────────────────────────────────────────────┘        │       non-authoritative)       │
                                                         └────────────────────────────────┘
 Node (vitest, tools/headless, soak, sweep, critic) runs the same sim/ directly.
```

### 2.1 Module rules (enforced by ESLint) [ADR-2]
| Module | May import | Forbidden |
|---|---|---|
| `src/sim/**` | `src/sim/**`, `src/shared/**`, `data/**` (JSON), package `zod` | other packages, Node builtins, DOM, `window`, `self`, `Math.random`, `Date`, `performance`, `Math.sin/cos/tan/exp/log/pow/atan2/...` (use `sim/core/dmath`), `setTimeout`, iteration over unordered keys |
| `src/shared/**` | itself, `data/**` | everything else (incl. all packages) |
| `src/worker/**` | sim, shared | render, ui |
| `src/render/**` | shared | sim internals (types come via `shared/protocol`) |
| `src/ui/**` | shared, render | sim, worker, editor, app |
| `src/editor/**` | shared, render, ui | sim, worker, app |
| `src/app/**` | shared, render, ui, editor (worker only via `new Worker(new URL(...))`) | sim |

Enforcement (`eslint.config.js`): the layer table is the local rule `warsim/module-boundaries`
(`tools/eslint/warsim-plugin.js`, lexical path resolution, so it also works on virtual
fixture paths). Sim purity uses `no-restricted-globals`, `no-restricted-properties`
(`Math.random`, non-exact `Math.*`, `localeCompare`, `toLocaleString`) and
`no-restricted-syntax` (`for-in`, `**`, Math destructuring/computed access). Fixtures in
`tests/lint-fixtures/` are linted by `tests/unit/lint-rules.test.ts`.

### 2.2 Repo layout
```
src/sim/core/      table.ts (SoA + free lists), sections.ts (typed-array sections codec), state.ts
                   (save/hash over sections), rng.ts (PCG32 streams), hash.ts (xxHash32), dmath.ts
src/sim/systems/   economy.ts (PLAN 1.9); later production, supply, movement, engagement, combat,
                   territory, diplomacy, revolts, naval, air, nuclear, buffs, history
src/sim/ai/        strategic, operational, economic, nuclear
src/sim/data/      projection.ts (Miller), provinces.ts, schemas.ts (zod, DATA_FILES, validateDataSet),
                   terrain.ts (crossings), ownership.ts, cities.ts, oob.ts, politicalMap.ts (the whole map build chain)
src/sim/scenario1938.ts  the 1938 world builder (map inputs, cells, nations, cities, OOB, economy values)
src/sim/toy.ts     the Phase 0 toy world (determinism suites)
src/sim/tick.ts    tick orchestration (fixed order, §2.5)
src/sim/sim.ts     Sim facade (init/step/command/hash/save/load) used by worker, Node and tests
src/sim/world.ts   World: cell layers, entity tables, RNG, command log (all serialized)
src/shared/        protocol.ts (messages, snapshot layout), commands.ts (Command union), constants, enums,
                   rasterize.ts (scanline fill, shared by sim, tools and flags), terrain.ts, color.ts, flags.ts,
                   calendar.ts (Gregorian hourly), speed.ts (speed levels), scenarios.ts (geometry + start day)
src/worker/        entry.ts, server.ts (scheduler, requests, snapshot builder), pool.ts, assets.ts, derive/
src/render/        camera.ts, gl/ (gpuTimer), map/ (MapRenderer), units/ (ProxyRenderer, atlas), fx/, labels/, lod/
src/ui/            TopBar, BottomBar (date/pause/speed), i18n/{index.ts: t(), locale signal, pseudo-locale 'qps';
                   en.json = source of truth}; later panels, theme
src/editor/        paint tools, undo stack, flag editor, scenario IO
src/app/           main.tsx (?scenario=toy|1938), MapView.ts, simClient.ts, hud.ts (persisted speed/pause), input/
                   (CameraController), testApi.ts (__warsim), bench/ (bench.html pages: A B BP P R T W F);
                   later settings, autosave, screenshot
tools/             data/, headless/, parity/, bench/, dmath/, eslint/; later soak/, sweep/
data/              terrain.json, units/, templates/, tech/, traits/, buildings/, flags/presets.json, maps/<id>/{map,straits}.json,
                   scenarios/<id>/{scenario,nations,ownership,diplomacy,cities,city-rules,flags,oob,economy}.json
                   (every file validated by tests/unit/data-schemas.test.ts; unknown paths are rejected)
public/data/       generated map assets + manifest.json (sha256)
tests/unit, tests/e2e (timing specs: *.perf.spec.ts, run after the parallel suite), tests/helpers (shared Node asset/map access), tests/fixtures
```

### 2.3 Worker protocol (`src/shared/protocol.ts`) [ADR-2]
Main → worker (implemented: init, step, cmd, hash, save, load, speed, pause, subscribe, ack,
buildProvinces, buildTerrain, buildPolitical; requests carry a `reqId` and get a `reply`, `provinces`,
`terrain`, `political` or `error` back):
- `init {init: {scenario, seed}}` (later: scenario bytes/URL, map size, settings). A fresh sim starts paused.
- `cmd {cmd: Command}`: applied at the next tick boundary, stamped with that tick,
  and appended to `commandLog`.
- `speed {ticksPerSecond | 'max'}`, `pause {paused}`, `step {n}`
- `subscribe {bbox: [x0,y0,x1,y1] (world units, wrap-aware), z, tier, wantsElements}`
- `ack {seq, buffers: ArrayBuffer[]}`: rAF handshake + buffer pool return
- `buildProvinces {assetBase, w, h, withIds}`: load-time province raster (PLAN 0.19)
- `buildTerrain {assetBase, w, h}`: terrain raster with crossings (PLAN 1.2)
- `buildPolitical {assetBase, w, h}`: the 1938 political map via `buildPoliticalMap`: owner,
  controller, placed cities (PLAN 1.3–1.5). Bench views `?b=T` and `?b=W` use these until the
  1938 scenario boots in the app.
- `save`, `load {bytes}`, `requestHistory {filter}`, `requestStats {kind}`

Worker → main:
- `snapshot {snap}` (transferable; layout in §2.4), `reply {reqId, status: {tick, hash}, bytes?}`,
  `provinces | terrain | political {reqId, result}`, `error {reqId, message, stack}`; later `history {rows}`, `stats {series}`

The worker sends **at most one snapshot per ack**. When main is slow, intermediate
ticks are coalesced: dirty tiles accumulate, and events stay in a ring with a
sequence cursor, so they are never lost. **No SharedArrayBuffer** [ADR-6].

Implementation (PLAN 0.13):
- `src/worker/server.ts` `SimServer` is environment-agnostic (injected `post`, driven by `pump(now, clock)`).
  `src/worker/entry.ts` wires it to `postMessage` and a timer (4 ms pacing at a fixed speed, 12 ms
  slices at `'max'`). `src/app/simClient.ts` acks from `requestAnimationFrame` and transfers the
  snapshot's `buffers` back.
- Dirty tiles: the sim marks 64×64 tiles through `World.setController` into `World.out`
  (`TickOutputs`, derived and never hashed). The server clears them when it sends.
- Events: systems call `World.out.emit`. After every tick the server moves them into an unsent queue
  with a global `seq`; spatial events outside the subscription bbox are skipped, and global ones (x = NaN)
  are always sent. Queue hard cap 2^20 records; overflow is counted in `events.dropped`.
- Buffer pool: power-of-two size classes. Leak test: 10k frames, allocation stays flat.

### 2.4 Snapshot layout
| Section | Content | Size bound |
|---|---|---|
| header | seq, tick, date, speed, paused, globals (nuclear taboo, etc.) | 64 B |
| dirtyTiles | list of 64×64 tiles: `owner u16[]`, `controller u16[]`, `flags u8[]` | changed tiles only |
| nations | per nation: color, stats row (gold, income, mil size, land, …), flags | 100s × 64 B, when changed |
| formations | all land formations, fleets, air wings: id, nation, kind, x, y (f64), prevX, prevY, facing, strength, maxStrength, org, state bits | ~4k × 48 B |
| elements | **only** for formations intersecting the subscribed bbox when tier ≥ T1.5: type, strength, x, y, prevX, prevY, facing, state | ≤ 40k × 32 B |
| events | ring slice since the last ack, filtered by bbox/tier for spatial events (fire, death, explosion), global events always included | bounded ring |
| derived | label curves, map-mode textures (throttled, optional) | when changed |

_As of PLAN 0.13 the snapshot carries `tiles` (ids + owner/controller u16 per tile), `nations` (f64 stride 5:
id, color, cells, capitalX, capitalY), `formations` (id, nation, x, y, prevX, prevY, facing, strength) and
`events` (f64 stride 7: seq, tick, kind, a, b, x, y); see `src/shared/protocol.ts`. Other rows arrive with their systems._

### 2.5 Tick order (1 tick = 1 sim hour) [ADR-5]
Calendar (PLAN 1.8, ADR-21): tick 0 = 00:00 of the scenario start date (`World.startDay`, saved);
proleptic Gregorian, so 1938 = 8760 ticks and 1940 = 8784 (`src/shared/calendar.ts`, integer-only;
`isDayStart` and `isMonthStart` gate the daily and monthly systems). Speed levels
(`src/shared/speed.ts`): 1, 3, 6, 12, 24 (default, 1 day/s), 48, 96, 256 h/s and Max. The bottom bar
(`src/ui/BottomBar.tsx`, app `hud.ts`) shows the date and has Pause, −/+ and Speed ×N. Space pauses,
`,`/`.` change speed. Speed level and pause persist in localStorage.
```
 1. apply queued commands (sorted by arrival seq)
 2. AI: operational (every 6h, staggered by nation id), strategic & nuclear (daily, staggered)
 3. production / research (daily) · economy (monthly on day 1, 00:00)
 4. supply network refresh (every 6 h) · supply consumption (hourly)
 5. air: mission scheduling, sorties, air combat, bombing
 6. naval: movement, detection, fleet battles, blockade/convoy/raid
 7. land movement (formations along paths; slotted element poses implied)
 8. engagement detection (spatial hash) → battles; element combat; retreats
 9. territory control: pressure → cell flips (frontier set only); city/capital capture
10. diplomacy (daily): war score, peace, alliances/unity, puppets/autonomy
    revolts / collapse / revival (daily)
11. nuclear: launches in flight, impacts, fallout decay (hourly)
12. buff/debuff timers · history events · stats sampling (daily)
```
Implemented order for the 1938 world (`src/sim/sim.ts`, review after PLAN 1.25):
buff expiry → strategic AI (weekly per nation) → operational AI (6-hourly, daily per nation) →
production (daily) → economy (monthly) → combat efficiency (monthly) → supply (12-hourly
network, hourly use) → movement → engagement and combat (incl. Major Battles) → territory →
capitals → wars (daily) → alliances, puppets, revolts, collapse (monthly). The average tick is
2.6 ms in a war-heavy 200-day run (Node, M; budget 1.5 ms, PLAN 7.1). The main costs are the
supply flood over warring blocs (~20%), A* for AI orders (~22%) and combat (~16%).

**Save files and autosave (PLAN 1.27).**
- *Format:* a save is the sim's section bytes (all of `World.parts()`, the command log included),
  gzipped (`src/shared/saveCodec.ts`; raw bytes still load). A 1938 world after one year of AI
  play is 38.6 MB raw and 0.79 MB gzipped.
- *Autosave* (`src/app/autosave.ts`): IndexedDB `warsim`/`saves`, slot `autosave`, holding
  {scenario, tick, savedAt, bytes}. It runs every 60 s of real time while the game runs, and when
  the page is hidden.
- *Resume:* `?continue=1` restores the slot for the same scenario after init.
- *Status:* the worker's save reply carries the status taken at the same tick.

### 2.6 Determinism [ADR-5]
- Numbers: f64 using only `+ − × ÷`, `Math.sqrt`, `Math.floor/ceil/round/abs/min/max/
  trunc/imul/fround` (all exactly specified by ECMAScript). Trig, exp, log and pow come from
  `dmath` (table + polynomial, identical in every engine).
- RNG: PCG32 implemented with `Math.imul` and 32-bit ops. One stream per subsystem
  (`scenario`, `combat`, `ai`, `diplomacy`, `revolt`, `weather`, `nuclear`, `naval`, `air`,
  `toy`) is seeded from `xxhash32(name, worldSeed ^ k)` only, so a new subsystem doesn't perturb
  existing ones. Order-independent draws use `hash32(seed, tick, entityId, salt)`.
  `dmath` = fdlibm ports (polynomial kernels + atan table), golden bits pinned in Node and Chromium.
- Iteration is always in ascending id order. Entity ids come from free lists in
  deterministic order. `Map`/`Set` are allowed only with insertion order derived from id order.
- **State hash**: `hashSections` chains (name, dtype, length, xxhash32(data)) over every
  authoritative section (`World.parts()`: meta incl. tick and seed, RNG states, command log and
  pending commands, cell layers, entity tables). Events and derived outputs are excluded.
- **Invariant tests** (must always pass): (I1) same seed + commands → same hash
  at N ticks; (I2) save → load → continue == uninterrupted, bit-identical bytes;
  (I3) Node run == worker run; (I4) random viewport/subscription churn leaves the hash
  unchanged; (I5) save bytes → load → save bytes are identical.

### 2.7 Persistence [ADR-9]
- **Save** (`.warsim-save`): `gzip( header{magic 'WSIM', version, scenarioHash, seed,
  tick, mapW, mapH} + sections[{name, dtype, length, bytes}] + json{strings,
  commandLog} )` via `CompressionStream`/`DecompressionStream` (browser + Node 18+).
- **Scenario** (`.warsim-scenario`): `gzip(JSON meta + RLE rasters (terrain, owner,
  controller, province) + flags SVG)`. Shareable.
- **Autosave**: IndexedDB, 3 rotating slots, every N sim months (setting) and on page hide.
- _Phase 0 state:_ `Sim.save()` returns the raw WSEC section stream (`src/sim/core/sections.ts`);
  the gzip container and header above arrive with PLAN 1.27.
- Settings (speed, paused, UI size, locale, unit size, map mode, etc.): localStorage.

---

## 3. World model & data schemas

### 3.1 Coordinates & map [ADR-1, ADR-7]
- Projection: **Miller cylindrical**, latitude cropped to 80°N … 64.165°S (exactly 2:1, square cells;
  `src/sim/data/projection.ts`, ADR-7). World units
  are projected km at the equator (`W_km ≈ 40 075`). `x` wraps when `loopingMap` is on.
- The grid has `W×H` cells. Sizes: S 1024×512, **M 2048×1024 (default)**, L 4096×2048,
  XL 6144×3072. Sim memory budget at XL is ≤ 160 MB.
- Per-row scale table `kx[y]` and `ky[y]` (projected → true km) is used for movement speed,
  ranges, blast radii and per-cell area (economy weight).
- **Fine land mask** (static): 1-bit 16384×8192 from Natural Earth 10m land, minus natural lakes
  (NE 10m lakes, scalerank ≤ 7, no reservoirs; PLAN 1.2). It is used by
  the sim for element placement and naval passability at sub-cell scale, and by the
  renderer for coastlines. Both read the same bytes, so they never disagree.
- Elevation: ETOPO 2022 60″ box-averaged into Miller cells. The 4096×2048 int16 level is a derived
  product for offline tools. 2048/1024/512 levels ship in `public/data/earth/` (ADR-13 codec), and
  `manifest.json` lists sizes and sha256 for all assets and sources (`npm run data`).

### 3.2 Cell layer (SoA, length W·H)
| field | type | meaning |
|---|---|---|
| owner | u16 | rightful owner (nation id, 0 = none/water) |
| controller | u16 | current controller (occupation when ≠ owner) |
| terrain | u8 | enum: WATER, CROSSING, PLAINS(basic), GRASSLAND, FOREST, HILLS, MOUNTAINS, DESERT, TUNDRA, MARSH, URBAN, ICE |
| province | u16 | province id (0 = water) |
| flags | u8 | COAST, RIVER, FALLOUT(level 0–3 in 2 bits), FORT, ... |
| pressure | i16 | transient, frontier cells only (stored in a sparse frontier table, not a full array) |

**Terrain raster (PLAN 1.2, ADR-15).** `terrain-<w>x<h>.u8.wsz` (M and S shipped) is derived
offline by `tools/data/terrain.ts`:
- land/water from land-mask coverage ≥ 50%;
- biome from the cell's mean Natural Earth I land-cover colour, matched to the nearest of 30
  labelled reference sites (forest, plains, grassland, desert, tundra, ice), with plausibility rules
  (no desert poleward of 52°, ice only poleward of 58°) and a forest-pixel-majority override;
- relief from the ETOPO elevation standard deviation inside the cell (mountains ≥ 280 m,
  hills ≥ 110 m or mean ≥ 3000 m);
- marsh from NE wetland/delta polygons plus `tools/data/wetlands.json`, on flat ground only;
- priority: ice > mountains > hills > marsh > biome; S is the 2×2 mode of M.

URBAN is assigned to city cells in PLAN 1.5. Crossings are not baked in: `data/maps/<map>/straits.json`
lists land-to-land segments, and `applyCrossings` (`src/sim/data/terrain.ts`) paints the water cells
between the first and last land cell of each segment (extended 4 cells past both shores) at load time.
Cells that have a province but water terrain (or the reverse) are reconciled when ownership is built
(PLAN 1.3).

Terrain table (`data/terrain.json`, in enum order): moveCost per mobility class (foot, motor,
tracked; null = impassable), defence modifier, attack modifiers per unit class, supply attrition,
econ weight, colour.

**Data files (PLAN 1.1).** zod schemas in `src/sim/data/schemas.ts`, strict objects (unknown keys
are errors). Cross-file checks: unique ids per kind, `techReq`/`prereqs`/`excludes` references,
prereq years ≤ tech year, acyclic tech graph, scenario → map/size, `loopingMap` only on wrapping maps,
and every `nameKey`/`descKey` present in `en.json`. Map meta: `data/maps/<id>/map.json` (projection,
widthKm, sizes, defaultSize, wrapX, assets manifest). Scenario meta: `data/scenarios/<id>/scenario.json`
(map, size, startDate, settings). Nations, ownership, cities and OOB files join the scenario in
PLAN 1.3–1.7. Errors read `<file>: <path>: <message>`.

### 3.3 Provinces, cities, sea zones, air zones
- **Province raster** (PLAN 0.19): built at load time in the worker from `admin1-geometry.wsz` +
  `admin1-meta.json.wsz` (`src/sim/data/provinces.ts`). Every NE admin-1 province gets ≥ 1 cell: sub-cell
  provinces are force-placed near their label point (same-country donor cell, else free water as an
  island, else any donor). Province id = NE feature index + 1. Builds in ~70 ms at M in Chromium.
- **Province** (`data/maps/earth/provinces.json` + raster): id, name key, admin-1
  source id, centroid, cell count, area km², terrain mix, `cores: nationId[]`,
  `buildings {industry, fort, airbase, port, navalBase, aa}`, population, unrest,
  revolt state, devastation.
- **City**: id, name key, province, position, size, `isCapitalOf`, industry,
  population. It counts as a victory point, and capture events are logged.
  1938 list (PLAN 1.5, ADR-18): `data/scenarios/1938/cities.json` (5774 cities) is generated by
  `npm run data` (`tools/data/cities.ts`) from NE populated places + `city-rules.json`.
  The rules hold 1938 renames, post-1938 exclusions and forced includes; capitals are bound from
  nations.json. Size 1–5 = max(scalerank tier, population tier). At load, `placeCities`
  (`src/sim/data/cities.ts`) gives each city its land cell (a coastal city snaps ≤ 2 cells; a
  capital snaps to its own nation) and owner. Rendering: `src/render/labels/cityLabels.ts` on a
  Canvas2D overlay. Dots appear from T0 (capitals and size ≥ 4); names fade in by size through
  T1 (capitals at 5 km/px, size 4 at 2 km/px, size 3 at 1.4 km/px, size 2 at 800 m/px, size 1 at
  450 m/px); greedy collision runs in priority order.
- **Sea zone**: id, name key, polygon (cells), lane graph nodes, adjacency, control per side.
  Built as a Voronoi over water seeded by named seas (Natural Earth marine
  polygons) and then subdivided.
- **Lane graph**: nodes at sea-zone centres, ports and straits. Edges carry distance and
  `crossing` (AoC-style land-unit-walkable lanes, editable).
- **Air zone**: a cluster of about 8–20 provinces. Air superiority is tracked per side per zone.

**Sim boot (PLAN 1.9a).** `Sim({scenario: '1938', seed, assets})` builds the world with
`createWorld1938` (`src/sim/scenario1938.ts`), which runs `buildPoliticalMap`:
- cells: owner, controller, terrain and province (saved);
- nations: id = index + 1, with colour, cells, capital and `living`;
- cities: `def` → cities.json, plus position, cell, size and capitalOf;
- formations: from the OOB, with template index and divisional strength.

Static facts (names, traits, templates) are looked up by id from scenario data and are not state.
The worker fetches and sha256-checks the assets before constructing the Sim (`init {assetBase}`),
and the app boots it with `?scenario=1938`. The world builds in ~0.2 s at M, saves in 2 ms
(14.9 MB raw; gzip in PLAN 1.27) and loads in 5 ms.

**Scenario ownership (PLAN 1.3, ADR-16).** `data/scenarios/1938/nations.json` (id = index + 1)
and `ownership.json` drive `buildOwnership` (`src/sim/data/ownership.ts`), run at load in the worker:
- each province takes `byProvince[adm1] ?? byCountry[adm0]`;
- land cells (terrain ≥ Plains) take their province's owner, and province-less land takes its
  neighbours' majority;
- polygon `regions` are applied in order, each only to cells owned by its `onlyFrom` tags;
- `occupation` rings set the controller.

`reconcileIslands` first gives each landless island territory one land cell (Malta, Bermuda, …).
Builds in ~230 ms at M in Chromium (province raster included).

### 3.4 Nations
```ts
Nation {
  id u16; tag string; nameKey; adjectiveKey; color rgb; flag FlagSpec;
  government enum; traits TraitId[]; aggression 0..100; incomeBonus -100..100;
  fightToDeath bool; aiEnabled bool; nukesAllowed bool; alive bool;
  capitalCity; gold f64; income f64; expenses f64; manpower; industry;
  warExhaustion 0..100; stability 0..100; tech {[techId]: researched};
  doctrine {nuclear: 'none'|'retaliation'|'flexible'|'first-use', ...};
  revival {remaining u8, cooldownUntilTick}; overlord?; autonomy 0..100;
  allianceId?; relations i8[nations] (−100..100); opinionModifiers[]
}
```
**Scenario nation data (PLAN 1.4, ADR-17).** `data/scenarios/1938/nations.json` holds 103 nations
(102 alive, plus Ethiopia as a dead nation with cores). Fields: tag, name/adjective keys, colour,
government, traits, aggression, incomeBonus, fightToDeath, capital {name, lonLat}, optional
overlord {tag, autonomy}, extraCores {countries, provinces} and alive. Cores = start territory +
extraCores. The capital snaps to the nearest owned cell within 2 cells (coastal capitals);
PLAN 1.5 binds it to a city. `diplomacy.json` holds alliances (one per nation, unity), guarantees
and wars in progress. Neighbouring nations differ in colour by ΔE*ab > 15 (`src/shared/color.ts`).

**Flags (PLAN 1.6, ADR-19).** `FlagSpec = {aspect, layers}` (`src/shared/flags.ts`), with layers:
stripes, rect, cross (Nordic/Greek), saltire, hoist triangle, disc, star, crescent, poly, canton
(nested layers) and preset (`data/flags/presets.json`, `$n` colour parameters). `flagShapes`
expands a spec into coloured polygons, which feed `flagSvg` (UI) and `rasterizeFlag` (4×4
supersampled scanline fill, deterministic). `buildFlagAtlas` packs 48×32 cells (1 px gutter,
aspect kept, transparent letterbox): 103 flags in 20 ms. `data/scenarios/1938/flags.json` maps
tag → spec.

**Economy (PLAN 1.9, ADR-22; `src/sim/systems/economy.ts`).**
- *Cell values* (`cells.econ`, u32, $M/yr, saved): each NE admin-0 unit's industrial capacity is
  spread over its land cells by weight. Capacity = GDP × (GDP per head / US)^0.5, from
  `data/scenarios/1938/economy.json`. Weight = size-1..5 city weight 1/2.5/6/15/35 + 0.05 ×
  terrain econWeight × true area.
- *Monthly* (00:00 of day 1):
  - gross = Σ controlled cells (occupied at 50%) / 1000 × 6 gold per bn × trait income ×
    (1 + incomeBonus %);
  - upkeep = 0.35 × template unit upkeep × strength / full strength;
  - admin = 0.25 × (cells / 1000)^1.35, capped at 50% of gross (since PLAN 1.26);
  - gold += gross − upkeep − admin.
- *Bankruptcy*: gold < −3 × gross. Formations then lose 5% strength per month; recovery at gold
  ≥ 0. Both transitions emit a `Bankruptcy` event.
- Nations start with 6 months of gross. One economic month costs 2.4 ms at M (Node).

### 3.5 Diplomacy
- **War** {id, attackers[], defenders[], leaders, goal, startTick, warScore,
  exhaustion per side, fightToDeath per side}
  *Implemented v1 (PLAN 1.16, ADR-29; `src/sim/wars.ts`, `src/sim/systems/war.ts`):*
  - *Records:* war records are saved as JSON. `atWar` is a derived pair set.
  - *Declaration* (`declareWar`): each leader brings its puppets. It is rejected for self, dead
    nations, an existing war, a truce, or an overlord–puppet pair.
  - *Daily score:* 200 × (occupied share of the enemy's land − occupied share of own land) ±
    25 per capital capture, clamped to ±100.
  - *Exhaustion:* 0.1 per day + 80 × share of men lost since the war's first assessment +
    60 × occupied share of own land.
  - *Suing:* a side sues when broke (gold < 0 or bankrupt), exhausted (≥ 80) or crushed
    (≤ −90). Neither side sues if either fights to the death.
  - *Terms by |score|:* below 10 a white peace (all occupation reverts). Otherwise the winner
    annexes round(|score|% of the loser's land it occupies), nearest its own land first (BFS),
    and the rest reverts. At ≥ 90 it annexes all of it, and the loser's leader becomes a puppet.
  - *After peace:* a 2-year truce between the leaders.
  - *God commands:* `forcePeace`, `setWarFightToDeath`.
- **Alliance / union** {id, nameKey, members[], leader, unity 0..100, loyalty per
  member}. Low unity → members leave and the alliance can dissolve.
  *Implemented v1 (PLAN 1.17, ADR-30; `src/sim/alliances.ts`, `src/sim/systems/alliances.ts`):*
  - *Records:* alliances and guarantees are saved as JSON, seeded from `diplomacy.json`.
  - *Monthly:* unity += 3 × (wars with ≥ 2 members on one side) + 0.25 × (members − 1) − 1, and
    loyalty += 0.25 × (unity − loyalty).
  - *Leaving:* a non-leader below loyalty 25 leaves; under two members, the alliance dissolves.
    When the leader leaves, the lead passes on.
  - *Union:* at unity ≥ 80, kept until it drops below 70.
  - *Wars:* a declaration brings each leader's alliance and puppets, and the defender's
    guarantors (not chained further). Allies cannot declare on each other.
  - *Commands:* create, join and leave alliances; setUnity, setLoyalty.
  - *Alliance map mode:* a palette swap in the bottom bar, persisted. Members take their leader's
    colour; non-aligned nations are grey.
- **Puppet** relation {overlord, subject, autonomy 0..100, integration progress}.
  Puppets can be created (peace term or God Mode), released, integrated, or revolt.
  *Implemented v1 (PLAN 1.18, ADR-31; `src/sim/systems/puppets.ts`):*
  - *State:* nation columns autonomy, loyalty and integration. Tiers: satellite < 30 ≤ puppet
    < 70 ≤ vassal.
  - *Monthly, in this order:*
    1. A puppet above autonomy 90 leaves freely.
    2. Loyalty < 20 with autonomy ≥ 10 means a revolt and a war of independence.
    3. Tribute: 25% × (1 − autonomy/100) × gross income goes to the overlord.
    4. Below autonomy 50, integration grows by 4 × (50 − autonomy)/50 a month; at 100 the
       overlord annexes the puppet's land and formations.
    5. Autonomy drifts up 0.25, and loyalty relaxes toward 40 + 0.6 × autonomy, or 25 lower while
       the overlord is losing a war (side score ≤ −30).
  - *Peace:* a crushing peace creates a puppet at autonomy 30.
  - *Commands:* createPuppet, releasePuppet, setAutonomy, setPuppetLoyalty.
  - *Puppet map mode:* overlords keep their colour, puppets take it lightened 45%, others are
    grey.
- **Buff** {id, target (nation|formation|province), kind, magnitude, expiresTick}.
  *Implemented v1 (PLAN 1.21; `src/sim/buffs.ts`, `src/sim/systems/buffs.ts`):*
  - *Timing:* active on ticks [grant, expiresTick). The expiry system runs first in each tick.
  - *Kinds and effects* (m is the magnitude, a fraction):
    - income: gross × (1 + m);
    - manpower: growth × (1 + m);
    - attack: damage dealt × (1 + m);
    - defense: damage taken ÷ (1 + m);
    - speed: march speed × (1 + m);
    - unrest: +10m per month.
  - *Targets and storage:* nation and formation (attack, defense, speed), nation or province
    (unrest). Saved as JSON; per-target sums are cached.
  - *Commands:* `grantBuff {targetKind, target, buff, magnitude, hours, nameKey}`, `removeBuff`.

### 3.6 Military
```ts
UnitType (data/units/*.json) {
  id; class: 'inf'|'art'|'at'|'aa'|'armor_l'|'armor_m'|'armor_h'|'mech'|'mot'
       |'dd'|'cl'|'ca'|'bb'|'cv'|'ss'|'tp'|'fighter'|'bomber_tac'|'bomber_str'
       |'cas'|'naval_bomber'|'transport_air'|'nuke_missile';
  domain: 'land'|'sea'|'air'; elementSize: int (men/vehicles/ships/planes per element);
  mobility: 'foot'|'motor'|'tracked'|'ship'|'air';
  stats {soft, hard, defense, breakthrough, armor, piercing, aa, range_km,
         speed_kmh, org, hpPerUnit, detection, stealth, fuelPerHour, supplyPerHour};
  cost {gold, industry, manpower, days}; upkeep {gold, supply};
  terrainMods {[terrain]: {atk, def, speed}}; techReq?
  // sprite {atlas, frames} is added with the unit atlas (Phase 2); schemas are strict, so the
  // field must land in schemas.ts and the data together.
}
Formation {
  id u32; nation; kind: 'land'|'fleet'|'airwing'; templateId; x,y f64; facing f32;
  order {type, target, path[]}; posture: 'hold'|'attack'|'move'|'retreat'|'embarked';
  org 0..1; supply 0..1; entrench 0..1; experience 0..1; efficiency f32;
  elementStart u32; elementCount u16; baseId? (airwing/fleet home); battleId?
}
Element (authoritative unit proxy) {
  id u32; formation u32; slot u16; type u16; strength u16; hp f32 (of current
  strength's top unit); x,y f64 (valid only when posed='engaged'); facing f32;
  posed: 'slotted'|'engaged'|'dead'; target u32?; cooldown u8
}
```
- Element sizes (initial): infantry/mot/mech 500 men, artillery/AT/AA 12 guns,
  armour 10 tanks, each ship 1, air 4–12 planes. Typical division: 20–30 elements.
- **Templates and starting OOB (PLAN 1.7, ADR-20).**
  - `data/templates/land.json`: 15 land templates, from infantry (12.5k men) and square (20.9k)
    divisions to panzer (340 tanks), Soviet tank corps (450), cavalry and garrison units.
  - `data/scenarios/1938/oob.json`: 225 groups, 1054 formations.
  - `placeOob` (`src/sim/data/oob.ts`, part of `buildPoliticalMap`) floods each group out from its
    anchor over land the nation controls, or that its puppets own and control, keeping formations
    one cell apart; it places all of them in 8 ms at M.
  - Strength = Σ element manpower / tanks / guns (`templateStrength`). Fleets and air wings start in
    Phases 4–5.
- **Slotted pose** is `slotPose(formation, slot, aliveMask)`, a pure function. It is the same
  code in the sim (for engagement start positions) and in the snapshot builder.
- **Engaged pose** is integrated per tick inside a battle (advance or withdraw toward
  a target or cover, clamped to passable fine-mask terrain).

### 3.7 Tech & production
`data/tech/*.json`: tree with eras 1936–1990+. Research is per nation, daily, funded
by gold and industry. Tech gates unit types (tank generations, jets, radar, missiles,
nuclear programme stages). Production queue per nation (AI-managed or player):
items take days and draw gold, industry and manpower. Upkeep runs monthly.

**Implemented (PLAN 1.10, ADR-23; `src/sim/systems/production.ts`).**
- Command `queueFormation {nation, template}`: pays the template's gold
  (3.5 × Σ element unit gold) and manpower (Σ element manpower) at once. It is rejected (event
  `ProductionRejected`) without funds.
- Rows (`world.production`: nation, template, readyDay) are ready 3 × the slowest element's days
  later (infantry division 90 days, panzer division 225). All orders train in parallel.
- Daily at 00:00: bankrupt nations' orders slip a day. Ready ones appear at full strength at the
  capital, or the nearest held cell within 40 if it is lost (`FormationSpawned`).
- Manpower: `cells.pop` (thousands) is each country's 1938 population (GDP ÷ GDP per head),
  spread like the economy. Monthly gain = 0.05% × trait manpower multiplier × owned and
  controlled population, capped at 3% of it. Nations start with 1%.
- Command rules (template cost and time) reach the sim as `world.rules`, set by the Sim and not
  state. Industry as a production input arrives with tech/research.

---

## 4. Territory, fronts and the strategic layer

**Supply v1 (PLAN 1.12, ADR-25; `src/sim/systems/supply.ts`; refresh 12 h since PLAN 1.25).**
- *Blocs:* a nation and its puppets (`nations.overlord`) share one supply bloc, the overlord's id.
- *Network* (every 12 h since PLAN 1.25): sources are cities a bloc member owns and controls.
  Since the review after 1.25, a refresh after cell-level changes refloods only the blocs of the
  nations whose cells changed. Load, overlord changes and raw layer writes force a full refresh. A 4-connected flood
  spreads over cells the bloc controls and over unclaimed crossing lanes. `cells.supply` holds the
  bloc that reached each cell. The layer is state, so a load between refreshes is exact. A refresh
  takes well under 60 ms at M.
- *Formations* (hourly): on their own bloc's network, supply rises by 1/8 per hour towards 1;
  off it, it falls by 1/8 towards 0. At 0 a formation loses (2% + terrain `supplyAttrition`) of its
  strength per day, applied hourly. An encircled division is dry within 8–14 h.

**Land movement (PLAN 1.11, ADR-24; `src/sim/nav/`, `src/sim/systems/movement.ts`).**
- *Grid:* the true km per cell row comes from the Miller geometry. Move cost per [mobility][terrain]
  comes from `terrain.json` (water = ∞; crossings walkable).
- *Components:* 4-connected land components make unreachable targets an O(1) reject.
- *Province graph:* admin-1 provinces plus one virtual node per crossing group, built in 80 ms at
  M. It is derived, never saved.
- *Routes:* `findRoute` uses straight cell A* below 500 km. Above that, it runs coarse A* on the
  province graph, then cell A* inside the corridor of route provinces and their neighbours, with a
  flat fallback. Cell A* is 8-connected with no corner cutting, and its heuristic (straight km ×
  min cost) is admissible. Berlin → Moscow takes 9 ms, Lisbon → Khabarovsk (840 cells) 83 ms.
- *Orders:* `moveFormation {id, x, y}`.
  - A target unreachable from the formation snaps to the nearest reachable cell within 3;
    otherwise the order is rejected (`MoveRejected`).
  - Order state is moving, originCell, targetCell, pathStep and stepFrac. The path is a cache,
    recomputed from origin and target after a load.
- *Hourly:* a formation advances along cell centres. Entering a cell costs step km × move cost ÷
  (speed × 0.3 march duty). It faces its travel direction, and emits `FormationArrived` at the end.
- *Mobility:* a template moves like its slowest manoeuvre element (inf, cav, mot, mech, armour);
  support guns are towed. Infantry marches ≈ 29 km/day on plains.
- *Slotted poses:* `slotPose` (`src/sim/core/pose.ts`) places elements in a ≈ 2:1 block, front row
  first, rotated to the facing; it is shared by the sim and the snapshot builder.

*Implemented v1 (PLAN 1.14, ADR-27; `src/sim/systems/territory.ts`):*
- *Pressure:* each formation of a nation at war projects strength/1000 × (0.5 + 0.5 supply) ×
  (1 − d/3) into cells within 2 cells.
- *Frontier:* the frontier set is derived. It is rebuilt by one scan only when invalidated (load,
  a war change, or an outside controller change); flips maintain it locally.
- *Flips:* a frontier cell flips to the strongest adjacent enemy holder when that enemy's pressure
  ÷ terrain defence beats the holder bloc's pressure + garrison 1 for 16 consecutive hours
  (`cells.flip`, saved). Decisions use start-of-tick control and are applied together.
- *Advance:* formations wait at enemy-held cells until those flip, so a front advances at most
  1.5 cells per row per day.
- *Not yet modelled:* org and terrain-dependent radius, garrison from spending, unrest.

- **Pressure field.** Each land formation projects control pressure into cells within
  `r = f(type, strength, org)` km. Pressure is weighted by strength × org × terrain-defence
  inverse × supply. Only cells in the **frontier set** are updated: cells whose
  controller differs from a 4-neighbour at war with it, plus cells inside the radius of
  formations not at peace. Full-grid scans are forbidden in the hot loop.
- A cell flips to the attacker when the attacker's pressure exceeds the defender's
  pressure + garrison for `holdTicks`. Flips spread like AoC fronts, pixel by pixel, but
  can never jump past a connected defended line (connectivity check on flip).
- **Garrison**: each province has an abstract garrison from the owner's spending,
  so nations without formations aren't free real estate. It feeds revolts too.
- **Occupation vs owner**: `controller` changes on flip and `owner` changes only through peace
  terms, annexation, integration or God Mode. Occupied cells give the occupier
  reduced income and raise unrest.
- *Implemented v1 (PLAN 1.15; `src/sim/systems/capitals.ts`):*
  - Capture: an enemy at war holding a capital city → `CapitalCaptured`. The capital relocates to
    the largest owned and controlled city (`CapitalMoved`); without one it becomes a field capital
    on the nearest held cell. A nation with no land left is eliminated (formations, production
    and wars removed).
  - `winnerTakesAll` (a saved setting; command `setSetting`) annexes everything the loser
    controls, plus the loser's land the capturer already occupies.
  - God brush `paintControl {nation, x, y, r}` sets control on land cells.
  - The war-score jump comes with 1.16.
- **Capital capture**: the war score jumps, the capital relocates to the largest owned city, and with
  the `winnerTakesAll` setting the capturer annexes all of the loser's controlled territory.
- *Cores, collapse and revival implemented v1 (PLAN 1.20, ADR-33; `src/sim/systems/revival.ts`):*
  - *Cores:* each province has a core (its 1938 owner) plus claims resolved from the scenario's
    `extraCores` (admin-0 or admin-1 codes), saved.
  - *Revival:* a dead nation keeps `revivalsLeft` (2 at the start) and `revivalAt`
    (death + 2 years; 0 for nations dead at the start). It returns through a revolt on a
    province it has a core on (instead of new rebels), through its holder's collapse, or by God
    `reviveNation`.
  - *Collapse:* 6 consecutive bankrupt months, or God `collapseNation`. Puppets go free, dead
    claimants revive on their provinces, and restless (≥ 50) provinces revolt in connected
    groups.
  - *Death rule:* losing the capital while holding no core land is death; the capturer annexes
    the rest.
- **Cores**: provinces list core nations. Revival spawns a dead nation from its cores
  (finite `revival.remaining`, `cooldownUntilTick`), seeded with garrison and
  militia formations.
- *Revolts implemented v1 (PLAN 1.19, ADR-32; `src/sim/systems/revolts.ts`, `src/sim/provinces.ts`):*
  - *State:* per-province unrest and core (rightful owner = the 1938 owner of the province's
    centre cell), saved.
  - *Monthly unrest:* += non-core 4, occupied 6, war 2, bankrupt 3; −2 decay; −5 × suppression.
  - *Revolt chance:* a province its holder also controls revolts with p = 0.5 × (unrest − 50)/50 ×
    (1 − 0.7 × suppression), drawn by hash.
  - *Suppression:* costs 15% × level of gross income.
  - *Revolt area:* one province, or (`revoltMode` 'region') adjacent provinces of the same holder
    and core with unrest ≥ 40, up to 8.
  - *Rebels:* a new nation (origin province) takes the land and becomes its core. Its capital is
    the area's largest city; if that was the holder's capital, the holder relocates. It gets 1–4
    militia divisions and 50 gold. There is a 50% (hash) chance the holder declares war.
- **Revolts**: per province or per region (setting). Unrest comes from non-core
  occupation, low stability, war exhaustion, bankruptcy and nukes. It is reduced by
  suppression spending and garrison. A revolt spawns a rebel nation (a revived core nation
  if one exists, or a new generated nation) with formations.
- **Collapse**: when broke for N months, or the capital is lost with stability < threshold, a nation can
  fragment into its core nations, revolting provinces and puppets.

---

## 5. Combat model

### 5.1 Engagement
Engagement detection runs each tick over a spatial hash (cell size = 50 km): opposing land
formations within contact range form or join a **Battle** {id, cells, sides,
participants, startTick, kind: normal|major}. Air (CAS) and naval (shore
bombardment) participants join through their missions.

### 5.2 Element combat (per tick = 1 h, per battle)
*Implemented v1 (PLAN 1.13, ADR-26; `src/sim/systems/{elements,combat}.ts`):*
- *Elements and engagement:*
  - Elements are a saved table: formation, slot, unit, strength, wound carry, target, cooldown.
  - Formation strength (men) is Σ element strength × men per unit.
  - Engagement: formations of nations at war within 1.5 cells are in contact. Contacts are joined
    into battles each tick (derived), and engaged formations pause their march.
  - Wars are a saved pair set, seeded from `diplomacy.json`.
- *Targeting:*
  - Weight = eff × target health (strength × hpPerUnit) × proximity, drawn by
    `hash32(seed, tick, element)` and held for 4 h.
  - Weighting by health makes every element type bleed at the same rate.
  - Weights are tabled per (formation, unit type), and the draw is a binary search.
- *Damage* (target units) = eff × fullness × 0.1 × terrain attack × (0.5 + 0.5 supply) ÷ terrain
  defence (when the target holds) ÷ hpPerUnit. Losses apply after all of the hour's volleys.
- *Measured:*
  - A 2:1 fight ends in 12.5 days, with the winner losing 0.263 of the loser's strength
    (square law: 0.268).
  - An 80-division battle costs 3.2 ms per tick.
- *Deferred:* org and retreat (step 4), combined arms, entrenchment, experience, night and
  weather, and persistent or major battles (§5.4).
1. **Target selection** (deterministic): each element scores enemy elements in range
   by `typeMatch(weapon, targetArmor) × proximity × threat` and picks a target with
   `hash32(seed, tick, element.id)` (weighted). Targets are cached for `cooldown` ticks.
2. **Fire**: shots per hour = `rate(type) × strength`. Damage =
   `(target.armor > shooter.piercing ? hard·armorPen : soft|hard) × mods`.
   Modifiers: terrain (attacker and defender), entrenchment, river crossing, supply,
   org, experience, air superiority in the zone, **combined arms** (inf + art + armour
   present on the same side), night/weather (deterministic seasonal), buffs,
   efficiency.
3. **Casualties** reduce `target.strength` (integer, with hp carry-over for partial
   units). An element at 0 becomes `dead`, a wreck event is emitted, and the formation's strength is recomputed.
4. **Org** drains with damage taken. At org < 0.15 the formation retreats (posture
   → retreat, path away from the enemy). Encircled formations (no path to friendly
   supply) surrender over time.
5. Each fire volley emits `FireEvent {tick, subtick u8, shooter, target, weapon,
   dmg, x0,y0,x1,y1}` into the events ring (not sim state).

### 5.3 Combat-efficiency modes (global setting, AoC parity; TEXT 2026-10-02, AoC v4.3)
- **dynamic** (default, as in AoC): low and cheap in peace, high and costly at war (cost
  scales with nation size), plus drift from experience, supply and recent wins/losses.
- **progressive** (as AoC v4.3): moves toward the dynamic target by one step per economic
  tick instead of jumping.
- **static**: per-nation value from the scenario, constant (cost still follows the
  dynamic formula, as in AoC).
- **locked**: all nations at 1.0. Separately, any nation's efficiency can be locked in God
  Mode (the AoC per-nation CE lock).
- **random**: per-nation value re-rolled (hash-seeded) every economic tick, the original AoC
  behaviour.

*Implemented v1 (PLAN 1.22, ADR-34; `src/sim/systems/efficiency.ts`):*
- *Effect and timing:* CE multiplies damage dealt and is re-evaluated monthly after the economy.
- *Dynamic target:* 0.7 in peace, 1.0 at war, + 0.15 × mean war score/100 − 0.1 × (1 − mean
  supply), clamped to 0.5–1.5.
- *Modes:* progressive steps 0.05 a month toward the target; static = 0.8 + aggression/250 (the
  scenario has no CE field); random re-rolls 0.6–1.4 by hash; locked = 1.
- *Commands:* God `setEfficiency`/`lockEfficiency`; setting `ceMode` is saved.
- *Cost:* in every mode, 20% × (CE − 0.7)/0.3 of gross income per month.

### 5.4 Major Battles
When total committed strength in a battle exceeds a threshold (relative to the
local front), the battle becomes **Major**. It gets a name (nearest city), a war-banner UI entry
and a history-log entry. The winner gets a **breakthrough corridor**: a temporary pressure
multiplier along the attack axis for D days that pierces the front. Losses on both sides
are amplified. At strategic zoom this shows as a pulsing marker with crossed swords.

*Implemented v1 (PLAN 1.23, ADR-35; `src/sim/systems/majorBattles.ts`, `src/sim/battles.ts`):*
- *Trigger:* a derived battle group with ≥ 120,000 men becomes a saved Major Battle, named after
  the nearest city. Later groups within 3 cells continue it, and its losses are amplified 1.5×.
- *End:* when no group matches, it ends. The winner is the camp with more men still within 5 cells
  (ties use the last observation); its strongest nation gets a corridor.
- *Corridor:* from the battle toward the loser's centroid, 10 days, cells −1…8 along the axis and
  ±2.5 across. Inside it the winner's pressure is ×2 and flip progress ×4.
- *History:* start and end entries go to the saved history log. God `forceBreakthrough` creates a
  won battle and its corridor.
- *Absolute threshold:* the trigger is a fixed men count for now; the "relative to the local
  front" refinement waits for the front model.

---

## 6. Differentiators

### 6.1 Armour
- Classes light/medium/heavy (+ mechanised/motorised infantry). Generations are gated by tech
  (1938 light/medium → 1943 heavy → post-war MBT).
- Production cost and time (industry heavy), monthly upkeep, and **fuel per hour moving**.
  Unsupplied armour loses speed, then org, then strength (breakdowns).
- Terrain: big bonus on plains/grassland/desert, heavy penalties in forest, marsh, mountains
  and urban. Tracked mobility costs from the terrain table.
- Combined arms: armour is vulnerable to AT guns, CAS and heavy armour, and is strong vs
  infantry in the open. Infantry screens armour in urban/forest terrain. Artillery suppresses AT.
  Bonuses apply only when the elements are actually present in the battle.
- Tactical view: tank sprites with turret facing their target, muzzle flash, burning wrecks.

### 6.2 Naval
- Sea zones + lane graph (§3.3). Ports and naval bases are province buildings that
  repair, rebase and enable supply.
- Fleets are formations of ship elements: DD, CL, CA, BB, CV, SS, TP. Movement runs along
  lanes with continuous positions. Detection uses zone-level search plus element-level
  range.
- **Fleet battles** at element level: gunnery ranges (BB > CA > CL > DD), torpedoes
  (DD and SS, short range, high damage), carrier air groups (strikes from the CV's air
  wing at long range), screening (DDs protect capitals from subs and torpedoes).
- **Sea control** per zone per side = Σ naval power present and recent wins. It decays.
  It controls **supply over sea** (overseas formations and colonies), **convoys**
  (income from overseas provinces and trade), and **blockade** (an enemy-controlled
  zone adjacent to a port reduces its income and supply). **Submarines** raid convoys
  (sinkings logged).
- **Amphibious invasion**: formations embark on transports at a port, move with an
  escorting fleet, land on a coast cell (landing penalty, needs sea control or
  surprise), and receive naval bombardment support. **Crossings** remain for AoC-parity
  walkable straits.

### 6.3 Aircraft
- Air wings of fighter, tactical bomber, strategic bomber, CAS, naval bomber and transport,
  based at airbases (province building) or carriers. Range is limited from the base.
- Missions (per wing, set by AI or player): air superiority (zone patrol),
  interception, CAS, tactical bombing, **strategic bombing** (industry, ports, cities,
  then income and production), naval strike, paradrop/air supply.
- Each hour per zone: the scheduler launches **sorties**. A sortie flight path is
  derived kinematics `(base, target, launchTick, speed)`, so its position is never stored.
  Air combat is at element level between sorties in the same zone. AA from ground
  elements, buildings and ships shoots down planes.
- **Air superiority** per zone per side (0–1) modifies ground combat, supply,
  naval detection and bombing accuracy.
- Tactical view: plane sprites flying sortie paths, dogfight tracers, bomb impacts,
  flak.

### 6.4 AI nuclear weapons
- **Programme**: tech chain (fission research → enrichment → bomb → thermonuclear →
  ballistic missiles → SLBM). It is expensive in industry and gold, and gated by
  `nukesAllowed` (global and per nation).
- **Stockpile**: warheads are built over time with upkeep. **Delivery**: bombers (can be
  intercepted by fighters and AA, need range) or missiles (later tech, hard to stop).
- **Use decision** (nuclear AI, daily, at war only). Utility:
  `U = targetValue·desperation·doctrine − retaliationRisk − allianceCost −
  globalOutrage − tabooBarrier`.
  - targetValue: enemy capital, industry, fleets in port, massed formations, Major-Battle
    fronts. Uses expected damage from blast radius × local value.
  - desperation: rises with losing war score, capital threatened, core loss, and
    fightToDeath.
  - retaliationRisk: the enemy's *and its allies'* deliverable second-strike capacity ×
    their doctrine, plus survivable assets (subs, dispersed bombers).
  - taboo: a global value that starts high, drops sharply after the first use worldwide,
    and recovers slowly. When both sides have assured second strike (**MAD**), the
    utility of first use is ≤ 0 unless desperation is extreme (fightToDeath or capital falling).
  - doctrine and aggression come from traits. Retaliation-doctrine nations strike back after
    being hit.
- **Effects**: blast radius (by yield) kills elements by distance falloff and
  destroys city industry and population. Cells get FALLOUT (attrition, income loss,
  movement penalty) that drifts with a deterministic seasonal wind field and decays over
  years. Plus a stability shock and a war-exhaustion jump.
- **Consequences**: relations hit with every nation (scaled by distance and alliance),
  the striker's alliance unity drops, the target may sue for peace or retaliate, global
  outrage persists, and economic shocks follow.
- **Presentation**: flash, shockwave ring and mushroom cloud at every tier (scaled), an
  alert banner, an auto-pause option, a camera "go to" button, a history-log entry and a
  fallout map mode.
- **God Mode**: toggle nukes globally and per nation, grant warheads, force a strike.

---

## 7. AI

- **Strategic AI** (daily, staggered): utility scoring over candidate actions
  (declare war, sue for peace, accept peace, join or leave an alliance, form a coalition, create or
  release a puppet, guarantee, integrate). Inputs: relative strength (incl. allies),
  opportunity (the target is at war elsewhere or weak), aggression and traits, war exhaustion,
  gold (broke → peace), core claims, threat from the largest nation (coalition),
  fightToDeath.
  *Implemented v1 (PLAN 1.24, ADR-36; `src/sim/ai/strategic.ts`), runs first in the tick:*
  - *Cadence:* each nation acts weekly (staggered by id), with hash-seeded draws.
  - *War:* a nation needs aggression ≥ 15, must not be a puppet or broke, and may have at most
    2 wars. utility = aggression/100 × (min(3, own strength/target defence incl. allies and
    guarantors) − 1) + 0.3 if the target is at war + 0.3 for claims − exhaustion/100 − 0.4 ×
    wars. It declares on the best target with utility > 0.5, with probability 0.25 ×
    aggression/100.
  - *Stalemate peace:* a war older than 720 days, with |score| < 15 and both sides' exhaustion
    above 40, ends in peace.
  - *Alliances:* an unaligned nation bordering an aggressive neighbour more than 1.5× stronger
    joins a neighbour's alliance or forms one (30%).
  - *Coalitions:* monthly, the unaligned neighbours of a nation earning > 25% of world income
    form or join a coalition.
  - *Switches:* `setAi` per nation; setting `aiEnabled`.
  - *10-year AT:* `tests/sweep/` runs 3 seeds as its own `npm run check` stage.
- **Operational AI** (every 6 h): assigns formations to fronts proportionally to
  threat, keeps reserves, launches offensives at local superiority ≥ k (with armour
  spearheads), sets defensive postures, tasks fleets (sea control around coasts, convoy
  escort, raiding, invasion), tasks air wings (superiority over active fronts, CAS on
  Major Battles, strategic bombing when superiority is high).
  *Implemented v1 (PLAN 1.25, ADR-37; `src/sim/ai/operational.ts`):*
  - *Cadence:* each 6 h, a nation at war plans once a day (staggered).
  - *Front sectors:* its front cells form 4×4-cell sectors. Threat is the enemy strength in a
    sector's 3×3 neighbourhood.
  - *Who deploys:* free (not engaged) formations within 60 cells of the front. The farthest 15%
    stay in reserve.
  - *Allotment:* the rest go to sectors by largest remainders over 1 + threat/10,000, with every
    sector getting one while formations last. Formations already marching into a sector keep it;
    the rest fill nearest-first.
  - *Orders:* a sector at ≥ 1.5× local superiority attacks the enemy cell next to its centre;
    otherwise it holds its front cell. A formation is not re-ordered if its target is within a
    sector of the current one.
  - *Tick cost* with 10-year AI wars: 2–3 ms (above the 1.5 ms budget); see PROGRESS perf debt.
- **Economic AI** (daily): a budget split between army, navy, air, industry, research, nukes,
  revolt suppression and reserve gold. The production mix is adapted to enemies (AT vs armour-heavy
  enemies, fighters when bombed).
  *Implemented v1 (PLAN 1.26, ADR-38; `src/sim/ai/economic.ts`), monthly, just before the economy
  charges the month, on projected accounts (gross − upkeep − admin − CE cost − suppression −
  tribute):*
  - *Disbanding:* idle divisions go, weakest first, until the balance covers a 5% margin plus
    debt repaid within a year. Half their men return to the manpower pool.
  - *Suppression:* 0.5 while held non-core land has unrest ≥ 40 and the budget has room.
  - *Building:* at most one order a month, none while one is pending. It needs army upkeep under
    35% of income (60% at war), a positive balance after the new upkeep, and 3 months of income
    in reserve.
  - *Build mix:* cadre divisions if income < 20; motorised divisions against armour-heavy
    enemies (≥ 20% tanks); a panzer division every third order for rich nations (≥ 200) at war;
    infantry otherwise.
- **Peace**: settlement by war score. Terms are cells/provinces up to score, puppet creation,
  and white peace. Broke or exhausted nations sue for peace.
- **Anti-hegemon dynamics** (long-run requirement): administrative cost rises
  superlinearly with non-core territory, unrest is high in non-core occupied land,
  coalitions form against nations above X% of world industry, puppets drift toward
  independence, revival brings back dead nations, and collapse on bankruptcy or capital loss.
  Tuned by sweep (§10).

---

## 8. Semantic zoom / LOD design [ADR-3, ADR-4]

Continuous zoom `z = log2(screen px per world km)`. Tiers are bands with overlap.
Every layer has an opacity curve `α_layer(z)` (smoothstep in and out, hysteresis
±0.15 for discrete decisions such as clustering level).

| Tier | m/px | Map | Forces |
|---|---|---|---|
| **T0 Strategic** | > 2000 | fills, smooth borders, occupation tint/hatch, fronts glow, curved names, cities as dots | aggregated counters per nation per screen cluster (stable multi-level grid clustering), strength numbers |
| **T1 Operational** | 300–2000 | + province borders, city names, sea-zone and air-zone overlays, supply/convoy lanes | formation/fleet/wing markers: type symbol, flag chip, strength bar + number, order arrows, battle markers |
| **T2 Tactical** | 30–300 | + hillshade, procedural ground texture, tree, rock and building instances, roads near cities | element sprites (facing, walk/drive animation, firing, tracers, impacts, wrecks, casualties), sorties in flight, ships with wakes |
| **T3 Close** | < 30 | full-res procedural detail tiles | element → individuals (exact for vehicles, ships and planes; ≤ 64 sprites per infantry element, count = strength) |

**One truth.** Every number or sprite derives from sim state: counter strength =
Σ formation strength = Σ element strength. Sprites are at element positions, and tracers
come from FireEvents. Close-tier positions inside an element footprint are the only
presentational freedom, and the count is always exact.

**Transitions without popping.**
- T0→T1: clusters split by animating from the cluster centroid to member positions
  over 250 ms (positions are real). They merge in reverse.
- T1→T2: the marker scales down and fades into the formation centroid while elements fade
  in at their real positions. The strength bar lingers above the group until T2 is fully in.
- T2→T3: an element sprite cross-fades into its individual expansion, which is laid out inside
  the element footprint.
- The map shader blends the detail layers by `z`, and border width is constant in screen px.

**Interest management.** Main sends `subscribe` whenever the camera moves (throttled to
10 Hz) with the bbox padded by 25%. The worker only includes elements/events inside it.
This never affects sim state (invariant I4).

**Precision.** The CPU camera is in f64. Per frame (or per tile batch), choose an origin
and upload f32 positions relative to it. The vertex shader never sees absolute world coordinates.

**Rendering techniques.**
- Ownership: `R16UI` textures (owner, controller; tiled only if a size exceeds
  MAX_TEXTURE_SIZE) + a 256×256 palette `RGBA8` texture (nation and map-mode colours).
  Smooth borders (`src/render/map/mapShader.ts`): every distinct id in the 4×4 cell
  neighbourhood accumulates cubic B-spline weight (a C2-smooth indicator field). The max
  wins; the border is where the best and second weights meet, at a constant screen-px width
  (d / fwidth(d)). A bounded value-noise domain warp (≤ 0.32 cell) makes borders organic.
  Occupation hatching uses the same weights. The coastline will come from the fine land-mask
  pyramid.
  Since PLAN 1.28b the coastline comes from the 16384 × 8192 land mask:
  - The worker reduces it once to a 4096 × 2048 coverage texture (land fraction of each 4×4-bit
    block; `src/shared/landCoverage.ts`) and posts it with the terrain layer (`mapLayers`).
  - The shader samples coverage bilinearly: water at ≤ 0.5. Land the cell rule called water takes
    the strongest land id nearby (unclaimed land is neutral grey).
  - The coast line uses the coverage gradient; the cell-based coast lines are off once the fine
    layer is present.
  - Terrain map mode (`fillMode` 1) bilinearly blends the terrain colours of the 4 nearest cells
    and keeps national borders.
  Since PLAN 1.28a the border distance is d/|∇d| with the gradient from the analytic B-spline
  derivatives, not d/fwidth(d). fwidth spiked where the second-strongest id changed between
  pixels, and is undefined inside the n > 1 branch; that drew dashed stair lines about 2 cells
  inside every border. The gradient pass runs only where d·scale < (halfW + 1)·2√2
  (|∇d| ≤ 2√2 per cell).
  GPU at 1080p on the bench machine: 0.54 ms T0 world, 0.50 Europe, 0.46 close (was 0.47; a
  full per-id gradient cost 1.30 ms).
- Map modes are palette swaps or derived per-province textures (no reupload of the cell grid).
- Labels (implemented PLAN 1.29, ADR-40):
  - *Derivation:* the worker derives a quadratic Bézier per nation from control
    (`src/worker/deriveLabels.ts`). It takes the capital's 4-connected component (else the
    largest), with x unwrapped at the date line; finds the PCA axis; takes the mid-line at
    10/50/90% of the robust extent; and records half-thickness = 1.2σ.
  - *Delivery:* it posts `labels` (with i18n keys, or literal names for spawned nations) at most
    every 2 s, when control changed.
  - *Drawing:* the app lays the glyphs out along the curve on a Canvas2D overlay
    (`src/render/labels/nationLabels.ts`). Font ≤ 2 × half-thickness and fits the curve length,
    9–64 px; greedy glyph-circle collision runs largest first; dark text with a light halo.
- Labels (original plan): MSDF font atlas. The curve comes from the worker's `derive/labels` (largest
  connected component → skeleton/PCA → quadratic Bézier, size by area), throttled
  and cross-faded on change.
- Units: one instanced draw per sprite atlas. Instance attributes are prev/cur pos,
  facing, frame, tint and alpha. The interpolation alpha is a uniform.
- Effects: GPU particle pools (muzzle, impacts, smoke, explosions, nukes).

**Performance budgets.** T0 ≥ 60 fps with 100+ nations at M size. T2 ≥ 30 fps with
10 000 visible proxies. Snapshot build ≤ 2 ms. Main-thread frame CPU ≤ 6 ms.
Sim tick ≤ 1.5 ms average (Node, M, 1938). Dev-GPU translation (ADR-4): T0 frame ≤ 1.0 ms
GPU and T2 frame with 10k proxies ≤ 2.0 ms GPU at 1080p on the bench machine (Phase 0:
0.46 and 0.41 ms). The map view redraws only when the camera, a snapshot or an
interpolation changes something.

---

## 9. UI / UX

- **Layout** (parity with the VISUAL reference): left nation panel, Actions/Economy tab panel,
  right Statistics ranking, bottom bar (map modes, pause, God Mode, Statistics, speed,
  date, events counter, history log), and a war-banner strip of active wars.
- **Map modes**: political, terrain, wars, diplomacy, alliances, puppets, income,
  revolts, + sea control, air superiority, fallout, supply.
- **God Mode**: rename; force war, peace, alliance or collapse; spawn a nation, revolt or battle;
  grant buffs; take control of a nation; disable AI globally or per nation; toggle nukes
  globally or per nation; grant warheads; force a strike. All of these are Commands.
- **Editor**: brush, bucket, line; undo/redo (command-pattern diff stack); target
  mask (paint only over a selected terrain or nation); cities; gold and core costs; alliances;
  puppets; annex; preset revolts; map import (image → terrain/owner via palette
  mapping); flag editor with presets (tricolours, crosses, cantons, emblems from
  our own SVG set); save/load scenario files.
- **Stats**: per-nation series (land, income, gold, military size by domain,
  casualties, warheads), ranking list, charts.
- **History log**: wars, peace, battles, Major Battles, city captures, revolts,
  collapses, revivals, nukes. Filterable by type, nation and date, and exportable to CSV/JSON.
- **QoL**: keyboard (WASD/arrows pan; +/-, numpad ± and Q/E zoom as in AoC; space pause, 1–5 speed), drag,
  wheel and touch pinch. Speed and pause persist. Autosave. Screenshot key (F2 → PNG).
  UI size (rem scale). Unit-size setting. Looping map. Map size picker. Locale
  picker (en first; all strings through `t()`).
- **Seeds & randomisation**: seed field (shareable), random-seed button, options
  (randomise aggression, traits, starting gold, efficiency mode).

---

## 10. Testing & verification

- **Unit (vitest)**: dmath accuracy and determinism, RNG, hash, every system's rules,
  data schema validation of all JSON, save/load round trip, determinism invariants
  I1–I5.
- **Headless runner** (`tools/headless`): `npm run sim -- --scenario <id> --seed 7
  --years 30 --out run.json` (metrics per year: hash, per-nation controlled/owned cells,
  formations, flipped cells, events, tick ms mean/p95/max). Phase 0 scenario: `toy`.
- **Soak** (`npm run soak`): 30 min wall-clock at max speed with save/load every
  5 min, comparing hashes against an uninterrupted twin. Fails on any exception or desync.
- **Sweep** (`npm run sweep`): ≥ 10 seeds × ≥ 50 sim-years. Pass when, for every seed:
  cells changing controller in the last 5 years > threshold, largest nation < 35% of
  land and < 40% of income, alive nations stay in [20, 250], and no permanent freeze
  (≥ 1 war active in ≥ 80% of the years).
- **Playwright e2e**: boot, start 1938, run 1 year, screenshot every map mode;
  scripted seamless zoom world → close (8 stops) on a spawned battle; tank, naval and air
  battle scenes; AI nuclear strike scene (seeded scenario with forced escalation
  conditions, AI-decided rather than God-forced); editor round trip; save/load.
  The test API is `window.__warsim`: now `sim` (SimClient: init/step/command/hash/save/load/
  speed/pause/subscribe/buildProvinces) and `view` (camera, controller.set/zoomTo, frames,
  draw); later `god(cmd)`, `fps()`. URL options: `?seed=`, `?paused=1`, `?view=0`.
- **Bench** (`npm run bench [-- A B BP R]`): Chromium on the real GPU (headless with
  `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`; without them it is SwiftShader).
  GPU time comes from EXT_disjoint_timer_query_webgl2 (gl.finish does not block under ANGLE).
  Pages: `bench.html?b=A` (map), `B`/`BP` (proxies raw/Pixi), `P` (precision probe, e2e),
  `R` (province raster). Results and screenshots go to `docs/bench/`.
- **Gate** (`npm run check`): `tsc -b` → `eslint .` → `vitest run` → `vite build` →
  `playwright test` (against `vite preview` of the build) → `npm run parity`.
  Must be green before every commit.
- **Parity** (`npm run parity`, `tools/parity`): parses `docs/PARITY.md` (Table 1 scored: verified 1,
  partial 0.5; Table 2 validated), checks the column layout, consecutive row numbers, a dated
  `[TEXT|VISUAL|TEXT+VISUAL YYYY-MM-DD]` tag on every AoC behaviour, and that every backticked
  evidence path of a verified row exists. Fails if the generated header score line disagrees;
  `npm run parity -- --write` regenerates it. Tools run TypeScript through `tsx`.

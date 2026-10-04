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
src/worker/        entry.ts, server.ts (scheduler, requests, snapshot builder), pool.ts, assets.ts, deriveLabels.ts
src/render/        camera.ts, timing.ts (the animations' clock), gl/ (gpuTimer), map/ (MapRenderer), labels/,
                   units/ (ProxyRenderer, atlas, counters, markers, handover, formationDots),
                   fx/ (fire: tracers, flashes, impacts); later lod/
src/ui/            TitleScreen, NewGameForm, TopBar, BottomBar (date/pause/speed), the panels (NationPanel with
                   Actions and God tabs, StatsRanking, StatsChart, HistoryPanel, SettingsPanel, EditorPanel,
                   FlagEditor, WarBanners, MapLegend), i18n/{index.ts: t(), locale signal, pseudo-locale 'qps';
                   en.json = source of truth}
                   (no src/editor/: the editor is src/sim/editor.ts and scenarioEdit.ts, src/ui/EditorPanel.tsx
                   and FlagEditor.tsx, and src/app/scenarioFiles.ts)
src/app/           main.tsx (no ?scenario → title screen; ?scenario=1938|toy → game.tsx), MapView.ts, simClient.ts,
                   hud.ts (persisted speed/pause, editor and God tools, drag painting), input/ (CameraController),
                   settings.ts, autosave.ts and saveDb.ts (IndexedDB), scenarioFiles.ts, gameUrl.ts, player.ts,
                   flagStore.ts, testApi.ts (__warsim), bench/ (bench.html pages: A B BP P R T W F)
tools/             data/ (pipeline, scenario previews), headless/ (runner, asset loader), sweep/, diag/, gate/,
                   parity/, bench/, dmath/, eslint/; later soak/
data/              terrain.json, units/, templates/, tech/, traits/, buildings/, flags/presets.json, maps/<id>/{map,straits}.json,
                   scenarios/<id>/{scenario,nations,ownership,diplomacy,cities,city-rules,flags,oob,economy}.json
                   (every file validated by tests/unit/data-schemas.test.ts; unknown paths are rejected)
public/data/       generated map assets + manifest.json (sha256)
tests/unit, tests/e2e (timing specs: *.perf.spec.ts, run after the parallel suite), tests/helpers (shared Node asset/map access), tests/fixtures
```

### 2.3 Worker protocol (`src/shared/protocol.ts`) [ADR-2]
Main → worker (implemented: init, step, cmd, hash, inspect, save, load, speed, pause, subscribe,
ack, buildProvinces, buildTerrain, buildPolitical; requests carry a `reqId` and get a `reply`,
`provinces`, `terrain`, `political` or `error` back):
- `init {init: {scenario, seed}}` (later: scenario bytes/URL, map size, settings). A fresh sim starts paused.
- `cmd {cmd: Command, now?}`: applied at the next tick boundary, stamped with that tick,
  and appended to `commandLog`. `now` (God Mode and player UI, PLAN 1.32b) applies it at once
  between ticks with the same stamp (`Sim.applyNow`); plain commands stay pending (I3).
- `inspect {full?}`: a JSON world summary (`Inspection`: seed, nations incl. dead, wars,
  alliances, buffs, majors, corridors, settings, terrain counts, raster hashes, editor stack
  depths; with `full` also cities, cores and unrest, ~600 KB) for tests and the critic (PLAN
  1.32a). Read-only replies (inspect, history, stats) report `status.hash` NaN: not computed.
- `exportScenario`: the world without run history as state bytes + `scenarioHash` (PLAN 1.38).
- `speed {ticksPerSecond | 'max'}`, `pause {paused}`, `step {n}`
- `subscribe {bbox: [x0,y0,x1,y1] (world units, wrap-aware), z, tier, wantsElements}`
- `ack {seq, buffers: ArrayBuffer[]}`: rAF handshake + buffer pool return
- `buildProvinces {assetBase, w, h, withIds}`: load-time province raster (PLAN 0.19)
- `buildTerrain {assetBase, w, h}`: terrain raster with crossings (PLAN 1.2)
- `buildPolitical {assetBase, w, h}`: the 1938 political map via `buildPoliticalMap`: owner,
  controller, placed cities (PLAN 1.3–1.5). Bench views `?b=T` and `?b=W` use these until the
  1938 scenario boots in the app.
- `save`, `load {bytes}`, `history` (the log as JSON rows, PLAN 1.34a; filtered in the UI),
  `stats` (the monthly series as raw f32 bytes, PLAN 1.34b)

Worker → main:
- `snapshot {snap}` (transferable; layout in §2.4), `reply {reqId, status: {tick, hash}, bytes?}`,
  `provinces | terrain | political {reqId, result}`, `error {reqId, message, stack}`
- `terrainLayer {data, landChanged}` / `cityLayer {cities}`: the terrain layer and the city list
  again after editor edits (PLAN 1.35/1.36/1.37a)
- `flags {custom}`: custom pixel flags, after init/load and on change (PLAN 1.37b)
- `mapLayers {land, terrain, terrainColors, cities, province, templates}` once after a
  real-geography init (PLAN 1.28b): the fine land coverage, the terrain layer, city dots and
  names, the province raster (revolts mode, picking) and the buildable templates (PLAN 1.33b).
- `provinceStats {unrest}`: per-province unrest bytes when `Provinces.version` changes (1.30b).
- `nationStats {tick, nations, wars, dead, aiEnabled}`: panel, ranking, banner and God/player
  data (PLAN 1.31–1.33), at most 1 Hz while ticks advance, at once after a `now` command. While
  paused the worker keeps pumping (without ticking) until owed derived messages are sent.
- `labels {data, names}`: nation label curves (PLAN 1.29), after init or load and when control
  changed, at most every 2 s of wall time.

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

_As of PLAN 2.4a fire events travel in a section of their own, `fires` (f64 stride 10: tick, subtick, shooter,
target, weapon, dmg, x0, y0, x1, y1; `src/shared/events.ts`), not in `events`: only for a subscription that
gets elements, filtered when they happen to those with an end in the subscribed bbox, queue cap 2^13 with
`fires.dropped`._

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
capitals → wars (daily) → alliances, puppets, revolts, collapse (monthly) → statistics sampling
(monthly, last, PLAN 1.34b). History events are recorded as they are emitted (PLAN 1.34a). The average tick is
1.0 ms over the first 5 years of seed 99 and 1.9 ms in its war-heavy first year (Node, M; budget
1.5 ms, PLAN 7.1; measured after PLAN 1.42a). The main costs in that first year are combat
(~35%), A* for AI orders (~28%), the supply flood over warring blocs (~15%) and territory (~10%).

**Save files and autosave (PLAN 1.27).**
- *Format:* a save is the sim's section bytes (all of `World.parts()`, the command log included),
  gzipped (`src/shared/saveCodec.ts`; raw bytes still load). A 1938 world after one year of AI
  play is 38.6 MB raw and 0.79 MB gzipped.
- *Autosave* (`src/app/autosave.ts`; the store is `src/app/saveDb.ts`): IndexedDB
  `warsim`/`saves`, slot `autosave`, holding {scenario, tick, savedAt, bytes, seed, options}. It
  runs every 60 s of real time while the game runs, when the page is hidden, and on Main menu.
- *Resume:* `?continue=1` restores the slot for the same scenario after init; the title screen
  offers it as Continue (§9).
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
As built (reviewed 2026-10-04; §2.5 has the details of saves and autosave):
- **Save**: the sim's WSEC section stream (`src/sim/core/sections.ts`: every section of
  `World.parts()`, the command log included), gzipped with `CompressionStream` (browser and
  Node 18+; `src/shared/saveCodec.ts`). No header of its own: the seed and the tick are in the
  `meta` section.
- **Scenario** (`.warsim-scenario`, `src/shared/scenarioFile.ts`): gzip of a magic line, a JSON
  header line (name, base scenario, map size, tick, state hash) and the state bytes without run
  history (`Sim.exportScenario`). Shareable; loaded in the editor or from the title screen.
- **IndexedDB** (`src/app/saveDb.ts`, database `warsim`, store `saves`): slot `autosave` (one
  slot; every 60 s of real time while running, on page hide and on Main menu) and slot
  `scenario` (the scenario file on its way from the title screen into its game).
- Settings (speed, paused, UI size, locale, unit size, map mode, etc.): localStorage.
- **Designed, not built:** a `.warsim-save` file on disk with its own header (magic, version,
  scenario hash), several rotating autosave slots, an autosave interval in sim months as a
  setting (PARITY row 65).

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
  - admin = 0.25 × (km² held / 212,000)^1.35, capped at 50% of gross (since PLAN 1.26). The
    land is km², not cells (ADR-57); 212,000 km² is 1,000 cells of the mean owned cell of 1938;
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
  - *Daily score:* 200 × (occ(attackers→defenders) − occ(defenders→attackers)) ± 25 per capital
    capture (at most ± 50 per war), clamped to ±100. occ(X→Y) = Y's land held by X ÷ min(Y's
    land, 2 × X's land), at most 1: the score is relative to the smaller party, so a war against
    a much larger nation can be won (ADR-47). The true share (÷ Y's land) drives exhaustion,
    puppets and capitulation.
  - *Land is km², not cells (ADR-57):* every land figure of a war (the score, the true share,
    capitulation, the puppet share, the small-state limit) is an area. A cell counts the true
    area of its row rounded to a whole km² (29 km² at 80°N, 382 km² at the equator), so the
    tallies (`src/sim/landCounts.ts`) are integers: the ones the cell setters keep equal the
    scan a load makes. By cells land at 60°N weighed 1.7 times its area against the mean owned
    cell (212 km²), and land at 72°N 3.4 times.
  - *Exhaustion:* 0.1 per day + 80 × share of men lost since the war's first assessment +
    60 × occupied true share of own land.
  - *Suing:* a side sues when broke (gold < 0 or bankrupt), exhausted (≥ 80) or crushed
    (≤ −90). Neither side sues if either fights to the death.
  - *Terms by |score|:* below 10 a white peace (all occupation reverts). Otherwise the winner
    annexes all of the losers' land it occupies, and the losers' occupations of the winners
    revert (ADR-51; until then round(|score|% of the occupied land), nearest first). At ≥ 90
    the loser's leader also becomes a puppet when the annexed land is ≥ 30% of the losers' land.
    A losing leader left with less than 8,500 km² is annexed whole instead (PLAN 1.40; 40 cells
    until ADR-57).
  - *Capitulation (ADR-47):* a side that has lost ≥ 75% of its land to the other side, or whose
    leader has lost ≥ 75% of its own land to occupiers of any war, loses at ±100 at once, fight
    to the death or not.
  - *Deadlock (ADR-47):* a war older than 5 years ends on its score, fight to the death or not.
  - *After peace:* a 2-year truce between the leaders. Idle formations left on land of a nation
    they are not at war with march home (`repatriationSystem`, daily), or are moved to the
    spawn point when no route exists.
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
  Since PLAN 1.42a the flood fills row spans (a scanline fill: same network, about twice as fast)
  and remembers each bloc's spans (`World.supplySpans`, derived), so a partial refresh clears a
  bloc without scanning the grid. A full refresh takes 6 ms at M.
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
  flat fallback. Cell A* is 8-connected with no corner cutting. Its heuristic is the octile walk
  (min(dx, dy) diagonal steps, the rest straight) × min cost, with the km scales of the smaller of
  the two rows' cell sizes (ADR-56; straight km before, which is never larger). That is not a
  strict lower bound (a route may swing poleward of both ends, where cells are narrower) and the
  search closes a cell when it first pops it, so a route can be longer than the cheapest one.
  Measured 2026-10-03 against Dijkstra on 30 random grids of 16–64 rows, where rows differ far
  more than on the map: 21,042 of 84,575 routes dearer, by up to 15.1% (straight km: 22,037, up
  to 15.2%). On the 1938 map the octile bound made 221 of year 1's 5,868 routes cheaper and none
  dearer. Left as it is, because a strict bound would widen every search. Berlin → Moscow takes 9 ms, Lisbon → Khabarovsk (840 cells)
  83 ms (before PLAN 1.42a, which made the same search about 40% faster: a typed-array heap
  reused across searches, the step and bound arithmetic inlined).
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
  `World.frontierMask` is the same set as a byte per cell, for the pressure loop (PLAN 1.42a).
- *Flips:* a frontier cell flips to the strongest adjacent enemy holder when that enemy's pressure
  ÷ terrain defence beats the holder bloc's pressure + garrison 1 for 16 consecutive hours
  (`cells.flip`, saved). Decisions use start-of-tick control and are applied together.
- *Advance:* formations wait at enemy-held cells until those flip, so a front advances at most
  1.5 cells per row per day.
- *Partners* (PLAN 1.42b, ADR-50): nations on the same side of a war (`Wars.sameSide`) fight on
  each other's fronts. An attacker's pressure on a cell includes that of its partners at war
  with the holder, and the holder's defence that of its partners; the cell flips to the member
  that holds the neighbouring cell. A formation on a partner's supply network is in supply, and
  repatriation leaves it there while the shared war lasts. The operational AI counts a partner's
  front cells against a common enemy as its own front (within its deploy range).
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
  - God brush `paintControl {nation, x, y, r}` sets control on land cells; with `x2, y2`, on the
    cells within r of the segment to that point (the brush dragged, PLAN 1.44b).
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
    militia divisions and 50 gold. The holder always declares war on them (PLAN 1.40, ADR-44;
    it was a 50% chance).
  - *Defection and spreading (ADR-47):* a revolt on land whose core nation is alive (and not
    bound to the holder) returns the area to that nation. Otherwise, next to a rebel state it
    joins that state. Only otherwise does it found a new nation.
  - *Overextension (ADR-47):* a holder above 4% of the world's owned land gains, in provinces
    more than 80 cells from its capital, 1.25 × min(2, share/4% − 1) unrest a month, plus 2 on
    core land while one of its wars has exhausted its side to ≥ 60. The share is of km², not
    of cells (ADR-57): in 1938 the Soviet Union (15.9%), the United States (7.0%), Canada
    (6.8%), Brazil (6.4%) and Australia (6.1%) are above 4%. The strain outruns the monthly
    decay of 2 only above 10.4% of the land.
  - *Tuning (PLAN 1.40, ADR-44):*
    - The 1938 scenario revolts by region (`revoltMode`).
    - A province held for 10 years becomes its holder's core (the old owner keeps a claim).
    - A garrison within 3 cells gives −3 unrest a month and −70% revolt chance.
    - A decisive peace annexes a losing leader under 40 cells.
    - Fight-to-death passes only from a side's leader.
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
    2 wars. utility = aggression/100 × (min(3, attack/defence) − 1) + 0.3 if the target is at
    war + 0.3 for claims − exhaustion/100 − 0.4 × wars. Attack = own strength + 0.4 × alliance
    partners; defence = the target's strength + 0.4 × (partners + guarantors) (ADR-47). It declares on the best target with utility > 0.5, with probability 0.25 ×
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
    sector getting one while formations last. Formations already marching into a sector keep it,
    also beyond the sector's allotment of the day [ADR-53]; the rest fill what is left
    nearest-first.
  - *Orders:* a sector at ≥ 1.5× local superiority attacks the enemy cell next to its centre;
    otherwise it holds its front cell. A formation is not re-ordered if its target is within a
    sector of the current one.
  - *Tick cost* with 10-year AI wars: 2–3 ms (above the 1.5 ms budget) until PLAN 1.42a; since
    then 1.0 ms over 5 years of seed 99 (§2.5).
- **Economic AI** (daily): a budget split between army, navy, air, industry, research, nukes,
  revolt suppression and reserve gold. The production mix is adapted to enemies (AT vs armour-heavy
  enemies, fighters when bombed).
  *Implemented v1 (PLAN 1.26, ADR-38; `src/sim/ai/economic.ts`), monthly, just before the economy
  charges the month, on projected accounts (gross − upkeep − admin − CE cost − suppression −
  tribute):*
  - *Disbanding:* idle divisions go, weakest first, until the balance covers a 5% margin plus
    debt repaid within a year. Half their men return to the manpower pool.
  - *Suppression:* 0.5 while a held province has unrest ≥ 40 and the budget has room.
  - *Building:* up to 1 + income/400 orders in training at once (at most 6; ADR-47). It needs
    army upkeep, counting the orders in training, under 35% × (0.3 + 0.7 × aggression/100) of
    income in peace (60% at war), a positive balance after the new upkeep, and 3 months of
    income in reserve.
  - *Overseas muster (ADR-47):* a nation whose fronts all lie on other landmasses than its
    capital raises new formations in the theatre (nearest own city to the front), an abstraction
    of sealift until PLAN 4.5.
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
±0.15 for discrete decisions such as clustering level). As built (2026-10-04): the counters'
cluster level and the T0 ↔ T1 handover are states with hysteresis and a timed change
[ADR-64]; the T1 → T2 fade is still a curve of the zoom alone, without hysteresis, until
PLAN 2.7. The short animations share one clock (`src/render/timing.ts`).

| Tier | m/px | Map | Forces |
|---|---|---|---|
| **T0 Strategic** | > 2000 | fills, smooth borders, occupation tint/hatch, fronts glow, curved names, cities as dots | aggregated counters per nation per screen cluster (stable multi-level grid clustering), strength numbers |
| **T1 Operational** | 300–2000 | + province borders, city names, sea-zone and air-zone overlays, supply/convoy lanes | formation/fleet/wing markers: type symbol, flag chip, strength bar + number, order arrows, battle markers |
| **T2 Tactical** | 30–300 | + hillshade, procedural ground texture, tree, rock and building instances, roads near cities | element sprites (facing, walk/drive animation, firing, tracers, impacts, wrecks, casualties), sorties in flight, ships with wakes |
| **T3 Close** | < 30 | full-res procedural detail tiles | element → individuals (exact for vehicles, ships and planes; ≤ 64 sprites per infantry element, count = strength) |

*T1 implemented (PLAN 2.1, `src/render/units/markers.ts`):* Canvas2D markers, the unit layer
from 2000 m/px down (see the handover below), fading out over 210–300 m/px toward T2. Each
shows a type symbol (from the template's
elements), a flag chip, a strength bar (strength / template men), the strength number, a dashed
order arrow to the target, and a red outline while engaged; Major Battles get crossed swords.
The snapshot carries template, flags and target per formation, plus Major Battle positions. T0
sprites stop once markers are fully in; capital flags draw above the markers. At T0 a capital
flag that would cover a counter stands just above it instead (up to 40 px from its usual place,
else it is left out), so no counter's number is hidden (PLAN 1.45c).

*T0 implemented (PLAN 2.2, `src/render/units/counters.ts`, ADR-45):* counters per nation per
cell of a nested 2^L-cell grid (~64 px), showing Σ strength. Splits and merges animate the child
level for 250 ms. The unit-size setting scales counters and markers.

*T0 declutter (PLAN 1.45b, `foldOverlaps` in `counters.ts`, ADR-65):* no two counter boxes
overlap. In screen space, a counter whose box would come within 2 px of a stronger one's is
folded into it: first a nation's own counters into each other, then across nations in the
order of what they hold. The stronger counter shows the sum and "+n" for the other nations
folded in; nothing is dropped, so the shown counters still add up to every formation's
strength. A change is a fade in place over 250 ms; a folded counter comes out only once it
clears its neighbour by 6 px more. The result depends on the zoom, not on where the camera
is. Strengths from a million on read "1.54M".

*T0 ↔ T1 handover (PLAN 1.45a, `src/render/units/handover.ts`, ADR-64):* which of the two
layers shows is a state. The markers come in when the zoom reaches 2000 m/px and go out above
2300 m/px (hysteresis × 1.15); a change is a cross-fade over 250 ms of real time. At rest one
layer is drawn at full opacity and the other not at all, wherever the camera stops. (Until
1.45a the cross-fade went by zoom over 2000–2600 m/px, and a camera resting there showed both
layers half-faded.) The T1 → T2 fade still goes by zoom, until PLAN 2.7.

*T2 elements implemented (PLAN 2.3, ADR-46):* the view subscribes with its padded bbox
and tier at most 10 Hz. The worker sends the elements of the formations inside, at their slot
poses (`sim/core/pose`, shared with the sim). They are drawn as instanced sprites, interpolated
on the GPU, with facing and a procedural walk/drive animation, fading in as the markers fade out.

*T2 fire implemented (PLAN 2.4a, `src/render/fx/fire.ts`, ADR-66):*
- *Transport:* a view that draws elements also gets the FireEvents (§5.2 step 5) with an end
  inside its subscribed box, in the snapshot's `fires` section (shooter, target, the two slot
  poses, the minute of the hour, and the weapon kind of the shooter's class: small arms, cannon
  or shell). Any other view gets none. The queue is capped at 8,192 events; the oldest are
  dropped and counted.
- *A shot* is a muzzle flash at the shooter, a tracer that flies to the target (shells on an arc)
  and an impact there, 310–880 ms in all, on the render clock. The shots of a tick start spread
  over its wall time by their minute (250–1000 ms; 400 ms for a tick stepped while paused).
- *One at a time:* a shooter shows one shot at a time. Within a tick every FireEvent is a shot
  (an element fires once an hour); from tick to tick the events that find their shooter's shot
  still on screen are not drawn, and are counted. So the fire on screen grows with the elements
  that fight, not with the game speed.
- *Presentational freedom:* a shot lands up to 0.012 cells from its target's slot. Nothing of
  it is sim state; a reload starts with no shots.
- *Not built:* casualty removal and wrecks (PLAN 2.4b), GPU particle pools (the layer is
  Canvas2D: 0.12–0.22 ms a frame for the fire of three divisions).

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
- Effects: GPU particle pools (muzzle, impacts, smoke, explosions, nukes). *As built (PLAN
  2.4a):* tracers, muzzle flashes and impacts are drawn with Canvas2D on the overlay; no pools yet.

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
- **Nation panel** (implemented PLAN 1.31a, `src/ui/NationPanel.tsx`): opens on the nation
  selected by a map click. Overview and Economy tabs; nation chips select. Data comes from the
  worker's `nationStats` message (every living nation + active wars, at most 1 Hz while ticks
  advance, and after init/load); real-map scenarios only.
- **Statistics ranking and war banners** (implemented PLAN 1.31b, `src/ui/StatsRanking.tsx`,
  `src/ui/WarBanners.tsx`, `src/shared/ranking.ts`): top-15 ranking (land, army, income,
  treasury, manpower) on the right, toggled by the bottom bar's Statistics button; one banner
  per active war (side leaders, ally counts, score bar) above the bottom bar, at most 8 + "+N".
  While paused, the worker keeps pumping (without ticking) until throttled derived messages are
  flushed, so a single step still updates the UI.
- **Map modes** (implemented PLAN 1.17–1.30a, `src/shared/mapModes.ts`):
  - *Implemented:* political, alliances, puppets, terrain, wars (red at war), diplomacy (relations
    to the nation selected by clicking the map), income (log ramp) and revolts.
  - *Off-map rows* (above/below the map when fully zoomed out) render as sea.
  - *How:* palette swaps from snapshot fields (alliance leader, overlord, income, war pairs);
    terrain uses the shader's terrain layer. Each mode has a legend (`src/ui/MapLegend.tsx`).
  - *Revolts* (1.30b): a per-province unrest choropleth. The worker sends the province raster
    in `mapLayers` and per-province unrest bytes (`provinceStats`) when `Provinces.version`
    changes; the shader colours land by its province's unrest (fill mode 2).
- **Map modes still planned**: sea control, air superiority, fallout, supply (with their
  phases).
- **God Mode commands** (implemented PLAN 1.32a): `renameNation` (saved in `world.names`,
  section `world.names`), `declareWar`, `forcePeace`, `createAlliance`, `collapseNation` (God
  Kill: forced, everything fragments and the nation dies), `reviveNation` (within the revival
  rules), `spawnRevolt`, `forceBreakthrough`, `grantBuff`, `setAi` / `aiEnabled`,
  `setIncomeBonus`, plus the edits from 1.17–1.24. `sim.inspect()` returns a JSON world summary
  (tests, critic). Owned-cell counts (`nations.cells`) are maintained by `World.setOwner`.
- **Player control** (PLAN 1.33a, `src/app/player.ts`): "Take control" in the nation panel
  (`setPlayer`, saved as `settings.player`, so loads and resumed autosaves keep it) turns that
  nation's AI off (strategic, operational and economic AI all skip it) and makes map
  clicks player orders. A click on an own formation selects it (Shift toggles, Esc clears;
  rings on the overlay); a click elsewhere orders the selection to march there (into enemy land
  = attack). "Release control" turns the AI back on. The bottom bar shows the nation and count.
  The controlled nation gets an Actions tab (PLAN 1.33b, `src/ui/ActionsTab.tsx`):
  - `declareWar`, `offerPeace` and `proposeAlliance` (refusable, unlike God commands):
    - peace is accepted when the offering side leads by ≥ 25 or the other side's exhaustion is
      > 40, never against a side fighting to the death;
    - an alliance is accepted when the target is unallied, not a puppet and not at war with
      the proposer.
  - Production: every template with gold, manpower and training days (`mapLayers.templates`),
    Build when affordable, and the training queue (`NationStat.queue`).
- **God Mode UI** (PLAN 1.32b, `src/ui/GodTab.tsx`): the bottom bar's God Mode button adds a God
  tab to the nation panel. It has rename, income bonus ±10, AI switches (nation and world), war/
  ally/puppet on a chosen target, peace per war, buffs, revive (dead nations), Kill (two clicks).
  Map tools (revolt, breakthrough from two clicks, territory brush) take the next map clicks.
  The territory brush also paints on a left-drag (PLAN 1.44b): a disc at the press, then
  `paintControl` with `x2, y2` to every further cell the pointer enters; the right or middle
  button pans meanwhile. It sets control, not ownership, and has no undo.
  God commands are sent with `now`: applied at once between ticks with the next step's tick
  stamp (`Sim.applyNow`), so they show while paused and replay identically.
- **God Mode**: rename; force war, peace, alliance or collapse; spawn a nation, revolt or battle;
  grant buffs; take control of a nation; disable AI globally or per nation; toggle nukes
  globally or per nation; grant warheads; force a strike. All of these are Commands.
- **Editor** (paint tools implemented PLAN 1.35, `src/sim/editor.ts`, `src/ui/EditorPanel.tsx`):
  - Commands `editPaint` (layer nation = owner + controller, or terrain; tool brush / line /
    bucket; radius ≤ 32; mask by terrain or nation), `editUndo` and `editRedo`.
  - The diff stack is world state (`edits.*` sections, ≤ 50 edits and 500 k cells), so a save
    plus a log with undos replays exactly.
  - Land cells only: terrain edits are land ↔ land until map import (1.37) can regenerate the
    fine coastline. Terrain edits drop nav and paths; the worker resends `terrainLayer`.
  - UI: the bottom bar's Editor button; map clicks paint; Ctrl+Z / Ctrl+Y.
  - Painting by dragging (PLAN 1.44) [ADR-63]: while the brush or the line is the editor's tool,
    the primary button (and one finger) paints and does not pan; the camera pans with the right
    or middle button, two fingers and the keys. The brush stamps at the press (`editPaint` with
    `stroke: 'start'`) and paints a line to every further cell the pointer enters (`stroke:
    'more'`). A stroke is one undo step: `more` grows the top edit instead of pushing one
    (`EditStack.stroke`, saved only while a stroke is open). The line paints from the press to
    the release; released in the cell of the press it is a click of the two-click line. The
    bucket and the scenario tools are click tools: with them a left-drag pans.
- **Map import** (PLAN 1.37a):
  - `src/shared/mapImport.ts` maps an image to the map: nearest-neighbour resample, then the
    nearest palette colour (terrain colours, or nation colours within 40, else unowned). The
    result travels as runs in the `importLayer` command.
  - `importLayer` lets terrain change water ↔ land; owners of new water are cleared in a linked
    edit, so undo/redo act on the pair. The undo cap never evicts the two newest edit groups.
  - The worker reports `terrainLayer.landChanged` (land/water differs from the start); the
    renderer then draws cell coasts with water taken from the terrain layer.
  - City cells keep their land (a city becomes an island). Formations left on water move to the
    nearest land within 64 cells, or are removed (PLAN 1.41).
- **Scenario files** (PLAN 1.38, `src/shared/scenarioFile.ts`, `src/app/scenarioFiles.ts`):
  - A `.warsim-scenario` file is gzip of the magic line, a JSON header (format, name, base,
    w, h, tick, hash) and the state bytes.
  - `Sim.exportScenario` saves the world without its run history (command log, pending,
    history log, statistics, undo stack) and leaves the running game untouched.
  - Import checks the base and map size, loads the bytes, and compares the state hash with
    the header. The editor's "Scenario file" section exports a download and loads files.
- **Flags in play** (PLAN 1.37b, `src/shared/flagPixels.ts`, `src/app/flagStore.ts`,
  `src/ui/FlagEditor.tsx`):
  - `setFlag {nation, runs}` stores a 36×24 pixel flag in the world, saved with the names;
    empty runs restore the scenario flag.
  - The app resolves each nation's flag: custom, else its scenario FlagSpec rasterized to 36×24
    (stretched to 3:2), else plain colour. Flags are drawn at capitals from 3 px per cell, and
    in the nation panel.
  - The editor's flag tool offers pencil, bucket, colour picker and 11 presets. The editor
    panel docks right, hiding the ranking, so the map centre stays free.
- **Scenario editing** (PLAN 1.36, `src/sim/scenarioEdit.ts`):
  - Commands `spawnCity` (a named city on land; adds 20 × size × mean land-cell economy to its
    cell, stored on the row and taken back by `removeCity`), `removeCity` (a capital
    relocates), `setCapital`, `setGold`, `setCore` (core or claim; a dead nation's claim is a
    preset revolt) and `annexNation` (land, formations, cores and puppets pass; `NationAnnexed`).
  - Editor city names are saved with the nation names. The worker resends the city layer
    (`cityLayer`) when cities change. Alliances and puppets use the God tab's commands.
  - The core-cost rule waits for a core economy.
- **Editor**: brush, bucket, line; undo/redo (command-pattern diff stack); target
  mask (paint only over a selected terrain or nation); cities; gold and core costs; alliances;
  puppets; annex; preset revolts; map import (image → terrain/owner via palette
  mapping); flag editor with presets (tricolours, crosses, cantons, emblems from
  our own SVG set); save/load scenario files.
- **Stats** (implemented PLAN 1.34b):
  - `src/sim/stats.ts`: a monthly sample per living nation [tick, nation, land, income, gold,
    men, casualties], saved as f32 `stats.rows`. It is the last system of the tick.
  - Casualties are counted in `settleFormation` as men lost since the last settle (combat,
    attrition, desertion).
  - The worker serves the rows raw (`stats` request); `StatsChart` (Charts button in the
    ranking) draws SVG lines for the top 5 at the latest sample + the selected nation.
  - Naval/air military sizes join with their phases.
- **Stats**: per-nation series (land in km² [ADR-52], income, gold, military size by domain,
  casualties, warheads), ranking list, charts.
- **History log** (implemented PLAN 1.34a):
  - `src/sim/history.ts`: state, saved as `history.rows`. Every emitted event of a
    `HISTORY_KINDS` kind is recorded on emit.
  - The worker resolves names per `HISTORY_ROLES` (`history` request).
  - `src/ui/HistoryPanel.tsx`: newest first, filters by type, nation and years; CSV
    (RFC 4180) and JSON export of the filtered rows.
- **History log**: wars, peace, battles, Major Battles, city captures, revolts,
  collapses, revivals, nukes. Filterable by type, nation and date, and exportable to CSV/JSON.
- **Title screen** (implemented PLAN 1.43a, `src/ui/TitleScreen.tsx`, `src/app/main.tsx`) [ADR-60]:
  - `/` (no `?scenario=`, or an unknown one) is the title screen: the scenario list (the
    scenarios whose `scenario.json` is not `hidden`, the 1938 world first), the chosen scenario's
    name, description, start date and map, and the new-game form (`src/ui/NewGameForm.tsx`: a
    seed, random per visit, and the options below). No sim worker and no map exist behind it.
  - A game is its URL. Start navigates to `?scenario=<id>&seed=<n>&paused=1` plus the options,
    as New game in the settings panel does; a reload restarts that game and the URL can be shared.
  - The toy world is a test world (`hidden`): it opens by `?scenario=toy` only.
  - Settings → Main menu autosaves the game and returns to `/`.
  - Loading a game (PLAN 1.43b) [ADR-61]:
    - *Continue:* shown when there is an autosave, with its scenario, in-game date and the time
      of the save. It opens the URL of the game that wrote it plus `continue=1` (the record keeps
      that game's seed and options).
    - *Scenario file:* a `.warsim-scenario` file is checked on the title screen (it unpacks, its
      format, its base scenario exists here at that map size), kept in IndexedDB (slot
      `scenario`) and loaded by `?scenario=<base>&load=scenario`. The game checks the state hash.
      The file stays stored, so a reload starts the scenario again. A file the game cannot load
      leads back to `/?failed=scenario`, which says so.
    - *The loaded world wins:* after a load the game shows the world's own seed, and when the
      world's looping setting differs from the URL's the URL is corrected and the game boots
      again (the map view is built from the URL before the world is there).
  - The chosen scenario's map (PLAN 1.43c) [ADR-62]: an image of the political map of its start,
    `public/data/scenarios/<id>/preview.png` (1024 × 512; nations in their colours, the game's
    sea colour, dark borders where the holder changes), beside the start date, the map with its
    size and the number of nations alive at the start. The image is made by
    `npm run data -- --previews` (`tools/data/preview.ts`) from the shipped map assets and the
    scenario data; `tests/unit/scenarioPreview.test.ts` rebuilds it and fails when the committed
    image differs.
- **Settings** (implemented PLAN 1.39a, `src/app/settings.ts`, `src/ui/SettingsPanel.tsx`):
  interface size 85–130% (root font size, also on the title screen), unit size 50–200% (marker
  size multiplier), both persisted; F2 or the panel saves a PNG of the map with its overlays;
  Main menu; seed field, random seed and New game (reloads with `?seed=`, paused).
- **New-game options** (PLAN 1.39b1, `src/sim/gameOptions.ts`, `src/app/gameUrl.ts`): looping map
  (`settings.loopingMap`, saved; off = no wrap in pathing, territory, operational AI or
  rendering), aggression (random 0..100), traits (1–3 random, exclusions respected → income and
  manpower multipliers and aggression bias), starting gold (random 0.25–2× or equal = median),
  CE mode. Applied once at init from the seed; carried in the URL
  (`looping=0&aggr=random&traits=random&gold=random|equal&ce=…`).
- **QoL**: keyboard (WASD/arrows pan; +/-, numpad ± and Q/E zoom as in AoC; space pause, 1–5 speed), drag,
  wheel and touch pinch. Speed and pause persist. Autosave. Screenshot key (F2 → PNG).
  UI size (rem scale). Unit-size setting. Looping map. Map size picker (PLAN 7.1b, ADR-43: the
  sim is tuned in cells for M until its distances are km-based). Locale
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
- **Sweep** (`npm run sweep`): ≥ 10 seeds × ≥ 50 sim-years, on seeds the tuning never saw
  (`--first <unseen> --tag <name>`). Criteria since 2026-10-03 [ADR-54]:
  - *Limits, every seed:* land changing controller in the last 5 years ≥ 1%, largest nation
    < 35% of land and < 40% of income, alive nations stay in [20, 250], no permanent freeze
    (≥ 1 war active in ≥ 80% of the years).
  - *Dynamism, each in ≥ 80% of the seeds,* measured on realms (a nation with no overlord,
    with its puppets' land, so integrating a colony is not growth): a riser (a realm that
    ends with ≥ 1% of the owned land and ≥ 1.5 × the land it held after year 1; a realm
    that did not exist then does not count) and a faller (one of the ten largest realms
    after year 1 that ends with ≤ 2/3 of its land of then; dead or a puppet counts). Only
    runs of ≥ 50 years are judged by these two.
  - *Reported, not judged:* new nations in the top ten and the leader's share range (the
    two criteria of critic B1 that riser and faller replace).
  - *Suspended until phases 2–6 are complete* [ADR-58]: no sweep after a rule change, since
    every feature still to come moves the balance. One quick sweep at each phase review is a
    smoke test (its five limits are reported; nothing is tuned for it). The criteria judge
    again from PLAN 6.8 and in Phase 7. The 10-year tests of the gate are not sweeps in this
    sense: they test correctness and stay.
  Implemented as `npm run sweep` (PLAN 1.40, `tools/sweep/`): the movement threshold is 1% of the land
  over the last 5 years. Land is measured in km² of true area in all four land criteria, in the
  ranking and in the nation panel, never in cells: the map is a Miller projection
  (`src/sim/landArea.ts`, [ADR-52]); reports in `docs/sweeps/` (docs/sweeps/2026-10-03-sweep.md all green).
- **Playwright e2e**: boot, start 1938, run 1 year, screenshot every map mode;
  scripted seamless zoom world → close (8 stops) on a spawned battle; tank, naval and air
  battle scenes; AI nuclear strike scene (seeded scenario with forced escalation
  conditions, AI-decided rather than God-forced); editor round trip; save/load.
  The test API is `window.__warsim`: now `sim` (SimClient: init/step/command/hash/save/load/
  speed/pause/subscribe/buildProvinces) and `view` (camera, controller.set/zoomTo, frames,
  draw); later `god(cmd)`, `fps()`. It exists only in a game, not on the title screen. URL
  options: `?scenario=1938|toy` (none = the title screen), `?seed=`, `?paused=1`, `?view=0`,
  `?continue=1`, `?load=scenario`.
- **Bench** (`npm run bench [-- A B BP R]`): Chromium on the real GPU (headless with
  `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`; without them it is SwiftShader).
  GPU time comes from EXT_disjoint_timer_query_webgl2 (gl.finish does not block under ANGLE).
  Pages: `bench.html?b=A` (map), `B`/`BP` (proxies raw/Pixi), `P` (precision probe, e2e),
  `R` (province raster). Results and screenshots go to `docs/bench/`.
- **Gate** (`npm run check`, `tools/gate/check.ts`): `tsc -b` → `eslint .` → `vitest run` → the
  10-year sweep tests (`tests/sweep/`) → `vite build` → `playwright test` (against
  `vite preview` of the build) → `npm run parity`. Must be green before every commit. It is
  sized to what changed since HEAD (ADR-48, ADR-49): documents only (Markdown, `docs/`) run
  parity alone; the sweep tests run only when a sim input changed; a clean tree that the gate
  has already passed runs nothing (the passed trees are recorded in `.cache/gate/`, ADR-55).
  `npm run check:full` runs every stage. The sweep tests include the pinned state hash of
  seed 99 after one year (`tests/sweep/baselineHash.test.ts`): a change of rules moves the pin
  and logs it in DECISIONS.
- **Critic cadence** (`npm run critic:due`, `tools/gate/criticDue.ts`, ADR-59): due when there
  is no report, or when a phase review has been ticked in PLAN.md since the commit the report
  names. One run per phase, and one for the DONE condition. Each blocking issue of a report
  becomes a PLAN task. (Until ADR-59: every 5 commits that fixed no critic finding, ADR-49.)
- **Checkpoints and diagnostics** (ADR-48): `npm run sim -- --save f` writes the final state and
  `--load f` continues from it (bit-identical saves: tested on the toy world). `npm run diag`
  prints wars and great-power state at chosen years, from 1938 or from a checkpoint.
  `npm run sweep:quick` (10 seeds × 20 years, report in `.cache/sweep/reports`) is for tuning:
  it is judged by the limits and reports riser and faller without a verdict (ADR-54).
- **Parity** (`npm run parity`, `tools/parity`): parses `docs/PARITY.md` (Table 1 scored: verified 1,
  partial 0.5; Table 2 validated), checks the column layout, consecutive row numbers, a dated
  `[TEXT|VISUAL|TEXT+VISUAL YYYY-MM-DD]` tag on every AoC behaviour, and that every backticked
  evidence path of a verified row exists. Fails if the generated header score line disagrees;
  `npm run parity -- --write` regenerates it. Tools run TypeScript through `tsx`.

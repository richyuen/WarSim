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
src/sim/randomWorld.ts   the random world builder (the earth map shared out by the seed, §3.4)
src/sim/toy.ts     the Phase 0 toy world (determinism suites)
src/sim/tick.ts    tick orchestration (fixed order, §2.5)
src/sim/sim.ts     Sim facade (init/step/command/hash/save/load) used by worker, Node and tests
src/sim/world.ts   World: cell layers, entity tables, RNG, command log (all serialized)
src/shared/        protocol.ts (messages, snapshot layout), commands.ts (Command union), events.ts (event kinds,
                   fire records), unitLooks.ts (a unit class's sprite, fire and wreck), constants, enums,
                   rasterize.ts (scanline fill, shared by sim, tools and flags), terrain.ts, color.ts, flags.ts,
                   calendar.ts (Gregorian hourly), speed.ts (speed levels), scenarios.ts (geometry, start day,
                   the scenario list, a scenario's nation tags), nationNames.ts (the names of founded nations),
                   gameOptions.ts (the new-game options), landMask.ts (sure land)
src/worker/        entry.ts, server.ts (scheduler, requests, snapshot builder), pool.ts, assets.ts, deriveLabels.ts
src/render/        camera.ts, timing.ts (the animations' clock; TimedSwitch and SwitchBank: what shows at a
                   zoom as states with timed fades), gl/ (gpuTimer), map/ (MapRenderer), labels/,
                   hash.ts (placement noise), units/ (ProxyRenderer, atlas, counters, markers, handover,
                   individuals, turrets, formationDots, tags), fx/ (fire: tracers, flashes, impacts; wrecks: the
                   ends of elements; hulls: the tanks an element loses at T3); later lod/
src/ui/            TitleScreen, NewGameForm, TopBar, BottomBar (date/pause/speed), the panels (NationPanel with
                   Actions and God tabs, FormationPanel, StatsRanking, StatsChart, HistoryPanel, SettingsPanel, EditorPanel,
                   FlagEditor, WarBanners, MapLegend), i18n/{index.ts: t(), locale signal, pseudo-locale 'qps';
                   en.json = source of truth}
                   (no src/editor/: the editor is src/sim/editor.ts and scenarioEdit.ts, src/ui/EditorPanel.tsx
                   and FlagEditor.tsx, and src/app/scenarioFiles.ts)
src/app/           main.tsx (no ?scenario → title screen; ?scenario=1938|random|toy → game.tsx), MapView.ts, simClient.ts,
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
- `init {init: {scenario, seed, options?, assets?}}`: `scenario` is `'1938' | 'random' | 'toy'`,
  `options` the new-game options (`GameOptions`, §9), `assets` the map assets of the two worlds
  on the earth map (the worker loads them when absent). A fresh sim starts paused.
- `cmd {cmd: Command, now?}`: applied at the next tick boundary, stamped with that tick,
  and appended to `commandLog`. `now` (God Mode and player UI, PLAN 1.32b) applies it at once
  between ticks with the same stamp (`Sim.applyNow`); plain commands stay pending (I3).
  A command of a kind that is not in the `Command` type is refused at `World.enqueue`: not
  queued, no sequence number, no line in the log, so the hash is that of a sim that never got
  it (PLAN 2.12b). `COMMAND_KINDS` is held to the type by the compiler. A kind's fields are
  checked by its handler, as before.
- `inspect {full?}`: a JSON world summary (`Inspection`: seed, nations incl. dead, wars,
  alliances, buffs, majors, corridors, settings, terrain counts, raster hashes, editor stack
  depths; with `full` also cities, cores and unrest, ~600 KB) for tests and the critic (PLAN
  1.32a). Read-only replies (inspect, history, stats) report `status.hash` NaN: not computed.
- `formation {id, generation?}`: one formation as JSON (`FormationDetail`: the count of its id
  (`Table.generation`), nation, template, men now and when whole, supply, engaged, moving, its
  elements by unit type) for the formation panel, or `null` (PLAN 2.14b). With `generation`,
  `null` also when the id's count is another: ids are given out again, and the formation asked
  for is gone (ADR-115). Read-only, as `inspect`.
- `warBattle {war}`: the largest battle of a war as JSON (`WarBattle`: where to look, the pair
  of formations there, formations and men of each side), or `null` when the war has none (PLAN
  2.14e; `largestBattle`, `src/sim/systems/warBattle.ts`). Worked out from the state when
  asked; read-only. A battle of the war's two leaders comes before one of a leader, before one
  of allies alone (ADR-95); of those, the one whose smaller side has the most men (ADR-94).
  Each war of `nationStats` says whether it has one (`battle`, ADR-96).
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
| nations | per nation: color, stats row (gold, income, mil size, land, …), flags. As built: a row for every nation, the destroyed ones too, with `living` (a destroyed nation has no capital flag) and `founded` (a nation founded in the game: its flag is made, PLAN 2.15c). The view keeps of the nations what the last snapshot says and nothing else: a world loaded into a running game can have fewer nations (PLAN 2.7q) | 100s × 64 B, when changed |
| formations | all land formations, fleets, air wings: id, nation, kind, x, y (f64), prevX, prevY, facing, strength, maxStrength, org, state bits | ~4k × 48 B |
| elements | **only** for formations intersecting the subscribed bbox when tier ≥ T1.5: type, strength, x, y, prevX, prevY, facing, state. As built (`SnapshotElements`): id, formation, nation, the atlas frame of the unit's class, strength, size (the units of the element when whole, since PLAN 2.10b), x, y, prevX, prevY, facing, the formation's flags (moving, engaged), and `hit`: fired at since the snapshot before, by anything, from anywhere (PLAN 3.6e5, ADR-167; §8) | ≤ 40k × 32 B |
| events | ring slice since the last ack, filtered by bbox/tier for spatial events (fire, death, explosion), global events always included | bounded ring |
| derived | label curves, map-mode textures (throttled, optional) | when changed |

_As of PLAN 0.13 the snapshot carries `tiles` (ids + owner/controller u16 per tile), `nations` (f64 stride 5:
id, color, cells, capitalX, capitalY), `formations` (id, nation, x, y, prevX, prevY, facing, strength) and
`events` (f64 stride 7: seq, tick, kind, a, b, x, y); see `src/shared/protocol.ts`. Other rows arrive with their systems._

_`prevX`, `prevY` are where the formation stood before the last step. A formation created in that step has none
and is sent with its own place: it was not alive before, or the count of its id (`Table.generation`) has changed
(PLAN 2.7o)._

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
 8. the retreat (formations with little org break off; before the engagement, so that one
    on the retreat is in no battle); engagement detection (spatial hash) → battles; element
    combat; org lost to the hour's losses
 9. territory control: pressure → cell flips (frontier set only); city/capital capture
10. diplomacy (daily): war score, peace, alliances/unity, puppets/autonomy
    revolts / collapse / revival (daily)
11. nuclear: launches in flight, impacts, fallout decay (hourly)
12. buff/debuff timers · history events · stats sampling (daily)
```
Implemented order for the 1938 world (`src/sim/sim.ts`, review after PLAN 1.25):
buff expiry → strategic AI (weekly per nation) → operational AI (6-hourly, daily per nation) →
production (daily) → research (daily) → economic AI (monthly, before the economy charges the
month) → economy (monthly) → combat efficiency (monthly) → supply (12-hourly network, hourly
use) → repatriation (daily) → movement → the retreat → engagement and combat (incl. Major
Battles) → org lost to the hour's losses → territory → capitals → wars (daily) → alliances,
puppets, revolts, collapse (monthly) → statistics sampling (monthly, last, PLAN 1.34b). (Research,
the economic AI, repatriation, the retreat and the org loss were missing from this line until
the review of Phase 3, PLAN 3.7b.) History events are recorded as they are emitted (PLAN 1.34a). The average tick is
1.0 ms over the first 5 years of seed 99 and 1.9 ms in its war-heavy first year (Node, M; budget
1.5 ms, PLAN 7.1; measured after PLAN 1.42a). The main costs in that first year are combat
(~35%), A* for AI orders (~28%), the supply flood over warring blocs (~15%) and territory (~10%).
Since the rules of Phase 3 the tick is over both budgets: 1.67 ms over the five years and 2.44 ms
in the first (PLAN 3.5e, 2026-10-07; the budget of the first year is 2.4 ms); PLAN 7.1 has what
it is spent on.

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
  An id is therefore not an identity over time: a row created in a step can have the id of a row
  destroyed in that step. A table counts how often each id has been given out
  (`Table.generation`), for an observer that remembers something by id. The count is not state:
  it is not serialized or hashed, and the sim does not read it (PLAN 2.7o). A load leaves the
  counts as they are, for a table as large as the loaded one (PLAN 2.7x).
- **State hash**: `hashSections` chains (name, dtype, length, xxhash32(data)) over every
  authoritative section (`World.parts()`: meta incl. tick and seed, RNG states, command log and
  pending commands, cell layers, entity tables). Events and derived outputs are excluded.
- **How long a table is, is no part of the state** (PLAN 2.12, ADR-84). A table grows by
  doubling, and a growth moves it to new arrays; a loaded table is as long as its save. So no
  reference to a table's columns is held across a create (`Table.create`): it would read the
  old arrays and write nowhere, at a size nobody chose and at another one after a load.
  `tests/unit/tableGrowth.test.ts` runs a game whose tables move at every create beside the
  same game without (`Table.volatile`). And no number of the state is a NaN out of
  arithmetic: its bits are in the hash and need not be the same in two engines. Nor an
  `undefined` where a number is kept: a typed array takes it as a NaN, with bits of the engine's
  own (PLAN 3.5f: a peace signed by nobody, in the history).
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
  *Islets (PLAN 2.15e2b, ADR-105):* a territory smaller than a cell is given a land cell
  (`reconcileIslands`); where the mask has no land pixel in that cell (9 of the 44 in 1938), the
  world's build sets one in the mask, the cell without its corners (`addIslet`).
  *As built (PLAN 2.9a and 2.9b1, ADR-79; `src/shared/landMask.ts`):* a point is on land when
  the bit of the mask pixel that holds it is set (`maskLand`). A place to stand on is *surely
  land* (`maskSure`): the four mask pixels round it, blended by how near each one's middle is
  (`maskField`, 0–1, a half on a straight coast), make 0.85 or more. Such a place is in a land
  pixel, and is land in the picture drawn from the mask, whose shore is moved inside a pixel
  by a noise of at most 0.35 × 4f(1 − f) (`SHORE_NOISE`; the shader takes it from the module).
  The world has the mask as static data (`World.landMask`: not saved, not hashed; from
  `ScenarioAssets.landMask`, which the worker and the Node loader both give). A formation at
  rest stands on sure land by it:
  - *In a cell* (a path's cells, a spawn, a move by the editor) it stands at the middle when
    that is surely land (the four mask pixels round the middle are land), and else at the
    cell's land point: the middle of the cell's pixel furthest from water (`World.cellPoint`).
  - *At a given place* (the order of battle's, a capital's, a command's, the city a division
    is mustered by in a theatre: PLAN 2.11k) it stands there when that is surely land, and
    else at its cell's point (`World.standPoint`).
  - *An element* stands at its slot in the block; where that is not surely land, at the first
    sure land on the way from the slot to its formation (`slotPlace`: the snapshot, the fire
    events and the event of its end ask there). Not state.
  - *Asked often:* a cell whose pixels and the ring round them are all land is inland, every
    place in it is surely land, and the world keeps that answer (`World.onLand`).
  - A cell with no land in the mask (a crossing, land painted in the editor) keeps its middle.
    A march goes straight from one cell's point to the next and can cross a bay. Two
    neighbouring cells' points can be up to 1.9 apart in x; a step is across the map's seam
    when its ends are more than half the map apart, and then goes the short way (PLAN
    2.11i). The coast of T2 and T3 is drawn from the same mask (§ the map's coastline, PLAN
    2.9b2).
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
  *Where a name stands (PLAN 2.7r, ADR-76):* at the first place by its dot where no name placed
  before it, no T0 counter and no capital flag is on its letters: to the right, to the left, below
  right, below left, below; then past the counter or flag that stands beside the dot (to the right,
  to the left or below it, at most 40 px to the side and 26 px down); then above. With no place it
  is left out. It keeps its place to the pixel, as an offset from its dot, for as long as nothing
  stands on it; when something does, it takes the first free place at once and cross-fades from
  the old one over 250 ms. A new place must be clear of a counter by 2 px; a place held only has
  to be untouched. The names are laid out after the frame's counters and flags.
  *At T1 (PLAN 2.7u):* the names keep clear of the markers in the same way: of each marker's box
  with the bar and the number under it, of a stack's tag, and of the Major Battles; not of the
  order arrows. Which unit layer counts is the one that is shown or coming in, from the first
  frame in which the coming layer is drawn (one frame after the camera's step: in that of the
  step neither layer counts), so that the names change places with the handover and not after
  it.
  *The order of the label layers (PLAN 2.7t):* on one canvas under the overlay, the curved
  nation names and over them the city dots and names: a small name over a large one reads. On
  the overlay above: the unit layers, then the capital flags.
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

**The random world (PLAN 2.16a, ADR-108; `src/sim/randomWorld.ts`).** Scenario `random`: the
earth map, terrain, cities, economy tables, units, templates, rules and start date of the 1938
world, with nations made by the seed. Its data is `data/scenarios/random/scenario.json` alone.
- *Count:* the new-game option `nations`, brought into 2 to 200, 60 when none is asked for
  (`RANDOM_NATIONS`, `src/shared/scenarios.ts`).
- *Capitals:* drawn from the map's cities: of 12 cities drawn, the one farthest from the
  capitals there are. One to a province, none on a piece of land under 12 cells.
- *Land:* a province goes to the nation that reaches it first over the province graph (the
  crossings are nodes); a nation's kilometre costs 0.6 to 1.8 by the seed, so the nations
  differ in size. A province no road reaches goes to the nearest capital by the same measure.
- *Nations:* named after the province of the capital (`provinceLabel`), the name in
  `world.names` (state, saved); no `origin` (that marks a nation founded in a game); a colour by
  golden-angle hue; aggression 15 to 85; no traits, alliances, wars or puppets.
- *Armies:* infantry divisions for half the income, one in eight armoured and one in eight
  motorised where there are eight, round the nation's six largest cities; 900 at most.
- *Seeded* by `hash32(seed, …)`, not by the world's streams. The same seed and count give the
  same world (`tests/unit/randomWorld.test.ts`).

**A nation's name and flag by scenario (PLAN 2.16b, ADR-109).** `ScenarioInfo.nationTags`
(`src/shared/scenarios.ts`) holds the tags of a scenario's nation table by nation id: the 103
of 1938, none for the random and the toy world. A nation's name is, in this order: its entry in
`world.names` (a God Mode rename, the names of the random and the toy world), the name key of
its tag, the name of a founded nation (`foundedName`, `src/shared/nationNames.ts`: "Free
<province>", the province being its `origin`, called by its own name or else its country's;
PLAN 2.15b, ADR-100). The worker's `nameOf` resolves it; a literal name travels with a leading
`=`. The flag follows the same rule (below).

**Flags (PLAN 1.6, ADR-19).** `FlagSpec = {aspect, layers}` (`src/shared/flags.ts`), with layers:
stripes, rect, cross (Nordic/Greek), saltire, hoist triangle, disc, star, crescent, poly, canton
(nested layers) and preset (`data/flags/presets.json`, `$n` colour parameters). `flagShapes`
expands a spec into coloured polygons, which feed `flagSvg` (UI) and `rasterizeFlag` (4×4
supersampled scanline fill, deterministic). `buildFlagAtlas` packs 48×32 cells (1 px gutter,
aspect kept, transparent letterbox): 103 flags in 20 ms. `data/scenarios/1938/flags.json` maps
tag → spec.

**Flags of founded nations (PLAN 2.15c, ADR-101).** A nation no scenario gives a flag flies
`foundedFlag(id, colour)` (`src/shared/flagPixels.ts`): one of the editor's 11 presets by a hash
of the two, in the nation's colour, a dark or pale second and an accent. It is the view's and
not in the state. `FlagStore` (`src/app/flagStore.ts`) gives, in this order: the painted flag
(`world.flags`), the scenario's (for a nation with a tag in `nationTags` whose snapshot row does
not say `founded`), the made one; a cached flag is made again when what it was made from changes (the colour, `founded`).

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
  - *No war inside a realm (PLAN 3.8b, ADR-178):* nor for a `bond` between the two: allies, two
    puppets of one overlord, or one of them (or its overlord) the ally of the other (or of its
    overlord). The AI's choice of a target and the neighbour a revolt rises with use the same
    test. Who *joins* a war is held to it too (PLAN 3.8c, ADR-179): of the nations a
    declaration calls, those torn between the sides stay out, each with its puppets. First who
    has a bond with the enemy's leader (a guarantor of the defender that is the attacker's
    ally), then the puppets with a bond to anyone of the other side (a puppet in another
    alliance than its overlord; its overlord fights on), then the other nations with one.
    Within a step they are asked in the order of the call, against those of the other side
    let stand so far: of two torn by each other alone, the one called first fights. The two
    leaders always stand. A nation that gets an overlord while at war leaves the wars against
    its new realm (ADR-180, ADR-181); nobody joins or founds an alliance while it or a puppet of it is at war with a member or a member's puppet (`realmsAtWar`, ADR-182).
  - *A puppet is defended (PLAN 3.8e, ADR-183):* a declaration on a puppet is one on its
    overlord, which leads the defenders; the event names it. The puppet's own allies and
    guarantors are called too. What refuses a war with the overlord (a war, a truce, a bond)
    refuses the declaration on the puppet. One level: an overlord's own overlord is not asked.
    The puppet named stands as the leaders do: it is never struck as torn.
  - *A war of independence (PLAN 3.8f, ADR-184):* the holder's declaration on the rebels of a
    revolt (a new nation, a revived one, the rebel state an area joins) and a risen puppet's on
    its overlord call no alliance and no guarantor: each leader comes with its puppets only.
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
    A nation made a puppet leaves, with its own puppets, every other war in which it stands
    against a nation it now has a bond with; the land held between them goes back (ADR-180).
    A losing leader left with less than 8,500 km² is annexed whole instead (PLAN 1.40; 40 cells
    until ADR-57). Its puppets become the winner's, and each leaves its wars in the same way
    (ADR-181).
  - *Capitulation (ADR-47):* a side that has lost ≥ 75% of its land to the other side, or whose
    leader has lost ≥ 75% of its own land to occupiers of any war, loses at ±100 at once, fight
    to the death or not.
  - *Deadlock (ADR-47):* a war older than 5 years ends on its score, fight to the death or not.
  - *After peace:* a 2-year truce between the leaders. Idle formations left on land of a nation
    they are not at war with march home (`repatriationSystem`, daily): to the nearest cell of
    their nation within 80 cells, or to its spawn point. The march home, and no other order,
    crosses the ground of any nation (`formations.home`, ADR-169); it is not fed there, it
    waits before an enemy's cell, and the operational AI leaves it alone until it arrives.
    A formation is set on the spawn point only where no land leads there.
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
    guarantors (not chained further). Allies cannot declare on each other. A nation with a
    bond to the other side stays out (§3.5, PLAN 3.8c).
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
    2. Loyalty < 20 with autonomy ≥ 10 means a revolt and a war of independence (the two realms', ADR-184).
    3. Tribute: 25% × (1 − autonomy/100) × gross income goes to the overlord.
    4. Below autonomy 50, integration grows by 4 × (50 − autonomy)/50 a month; at 100 the
       overlord annexes the puppet's land and formations.
    5. Autonomy drifts up 0.25, and loyalty relaxes toward 40 + 0.6 × autonomy, or 25 lower while
       the overlord is losing a war (side score ≤ −30).
  - *Peace:* a crushing peace creates a puppet at autonomy 30.
  - *Death:* a nation that dies is nobody's puppet (`eliminateNation`, ADR-148). It returns
    free, and a revival on its old overlord's land is at war with it as with any holder. Its
    own puppets are free in the tick of its death, however it dies (`PuppetReleased`, ADR-174).
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
  - `data/templates/land.json`: 15 land templates of 1938, from infantry (12.5k men) and square (20.9k)
    divisions to panzer (340 tanks), Soviet tank corps (450), cavalry and garrison units.
    Four more that no 1938 army fields and the tech gate holds back (PLAN 3.1c, ADR-129): the
    medium armoured division (`armor_medium_2`, 1941), the heavy armoured division
    (`armor_heavy_1`, 1942, and `mechanisation`), the mechanised division (`mechanisation`,
    1940) and the main battle tank division (`armor_mbt`, 1950). A formation is saved with
    the index of its template: a new template goes at the end.
  - `data/scenarios/1938/oob.json`: 225 groups, 1054 formations.
  - `placeOob` (`src/sim/data/oob.ts`, part of `buildPoliticalMap`) floods each group out from its
    anchor over land the nation controls, or that its puppets own and control, keeping formations
    one cell apart; it places all of them in 8 ms at M.
  - Strength = Σ element manpower / tanks / guns (`templateStrength`). Fleets and air wings start in
    Phases 4–5.
- **Slotted pose** is `slotPose(formation, slot, aliveMask)`, a pure function. It is the same
  code in the sim (for engagement start positions) and in the snapshot builder.
  *As built (`sim/core/pose`, PLAN 2.7a, ADR-70):* `slotPose(x, y, facing, slot, slots, spacing)`, where
  `slots` is the element count of the formation's template. Slots are numbered when the formation is
  equipped and never reassigned, so an element's place does not depend on which others are alive: the
  block keeps its shape and shows the gaps. Fire records, `ElementDestroyed` and the snapshot use it.
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

**Techs v1: what a nation knows, and the gate (PLAN 3.1a, ADR-127; `src/sim/tech.ts`).**
- *The tree* reaches the sim as `ScenarioRules.techs` (id, year, prerequisites), the tech files
  in the order of the schema's categories. A tech's index is its bit.
- *State:* the nation columns `tech0` and `tech1` (bits 0..31 and 32..63; 43 techs today, 64 at
  most). Saved and hashed with the nation table.
- *A template's techs* (`TemplateRule.techs`): the `techReq` of its unit types and all their
  prerequisites.
- *The gate:* `queueFormation` rejects (`ProductionRejected`) a template whose techs the nation
  does not know. The economic AI then orders the infantry division, or the cadre division,
  which asks for none. The build list shows such a template as "not researched", its button
  off.
- *The start* (`grantStartTechs`): every nation knows the techs dated before the scenario's
  first year; the techs of the templates its own formations have; and the `techs` of its row
  in `nations.json` (1938: the medium tank for SOV, FRA, ENG and JAP; Germany fields it).
- *A nation founded in a revolt or by a Kill* knows what the nation it left knew. A nation
  that returns knows what it knew.
- *Not yet:* tech modifiers (`armorAttack` and the others) are not read.

**Research v1 (PLAN 3.1b, ADR-128; `src/sim/systems/research.ts`).**
- *The budget:* `nations.research`, gold per day. A rule of the economy, not a choice of the
  AI (`researchBudget`; PLAN 3.4Rg, ADR-144): it is set monthly, in the economic AI's system,
  for every living nation, with AI or without (a played nation, one whose AI is off, every
  nation when the AI is off for the world):
  RESEARCH_SHARE (5%) of the month's income, at most `researchCap` (MAX_LINES lines of the
  dearest tech by the day, 2.44 gold a day); 0 for a nation in debt, and for one short of
  money whose treasury holds less than RUNWAY_MONTHS of what is short (it would disband:
  research is cut before the army). The month's research counts against the balance the build
  step works with. For a nation without AI nothing is disbanded first, so it has no budget
  while it is short with a treasury below RUNWAY_MONTHS of what is short, and has one again
  the month after that ends.
- *Lines:* `world.research` (nation, tech, gold paid), saved and hashed; at most MAX_LINES (3) a
  nation. Daily at 00:00, line by line in the order opened: pay min(the tech's gold ÷ its
  days, what is left to pay, what is left of the day's budget) from the treasury. A paid tech
  is known (`TechResearched`) and its line closed. A line is opened only with budget left.
  So a tech takes its days at least; a nation with a tenth of the pace takes ten times as long.
- *Never into debt:* a bankrupt nation pays nothing, and nothing is paid out of a treasury that
  does not hold the day's payment.
- *What is next* (`nextTech`): not known, not in a line, prerequisites known, year come; the
  earliest, the first in the scenario's order on ties. **The year is a floor**: nobody
  researches ahead of the calendar (the schema's comment once said "costs extra").
- *Held back:* the `nuclear` category is nobody's next tech. Who goes for the bomb is decided
  in Phase 6.
- *A dead nation's* lines are dropped. A founded nation starts with no budget until the
  next month's start.
- *Not yet:* `cost.industry` is read by nothing (industry is not a sim input). No command sets
  a budget or picks a tech: a player's nation researches on the rule's budget and takes its
  techs in the rule's order (ADR-144).
- *On the page* (PLAN 3.1e, ADR-130): the Economy tab of the nation panel has a Research block:
  the budget per month (the day's budget × 365 ÷ 12, like the income above it) and one row per
  line, in the order the lines were opened: the tech's name (`tech.<id>` of the i18n catalog)
  and the share of its gold that is paid, rounded down. The worker sends the scenario's techs
  once (`mapLayers.techs`: name key, gold, days) and each nation's budget and lines with the
  nation statistics (`NationStat.research`, `.lines`).

---

## 4. Territory, fronts and the strategic layer

**Supply v1 (PLAN 1.12, ADR-25; `src/sim/systems/supply.ts`; refresh 12 h since PLAN 1.25).**
- *Blocs:* a nation and its puppets (`nations.overlord`) share one supply bloc, the overlord's id.
- *Network* (every 12 h since PLAN 1.25): sources are cities a bloc member owns and controls.
  Since the review after 1.25, a refresh after cell-level changes refloods only the blocs of the
  nations whose cells changed. Load, overlord changes and raw layer writes force a full refresh.
  A refresh of some blocs gives the network a full one gives (PLAN 2.11j, ADR-81): the layer is
  a function of the cities, the control of the cells and the blocs, the marks of what to
  refresh are not state, and a loaded game, which refreshes in full, goes on as the game that
  was saved (I2). For that, a changed cell marks its old and new nation and the bloc in whose
  network it lay; and a refresh is done again in full when a lane that a refreshed bloc held
  is no longer its own, or when its flood comes to a cell that is its own to take and lies in
  another network (a cell it controls; a lane a higher bloc holds). A 4-connected flood
  spreads over cells the bloc controls and over unclaimed crossing lanes. `cells.supply` holds the
  bloc that reached each cell. The layer is state, so a load between refreshes is exact. A refresh
  takes well under 60 ms at M.
  Since PLAN 1.42a the flood fills row spans (a scanline fill: same network, about twice as fast)
  and remembers each bloc's spans (`World.supplySpans`, derived), so a partial refresh clears a
  bloc without scanning the grid. A full refresh takes 6 ms at M.
- *Formations* (hourly): on their own bloc's network, supply rises by 1/8 per hour towards 1;
  off it, it falls by 1/8 towards 0. At 0 a formation loses (2% + terrain `supplyAttrition`) of its
  strength per day, applied hourly. An encircled division is dry within 8–14 h.
- *Reach* (PLAN 3.4Rf, ADR-143): a formation on a cell that is not its side's (an enemy's, a
  third nation's, nobody's) is fed as on its network when a cell of a network that feeds it
  lies within `SUPPLY_REACH` = 2 cells (Chebyshev, the distance of the pressure below): the
  cell under an attacker is the enemy's until it turns. On its own side's ground with no
  network (a pocket) nothing reaches it. Measured over the first year of seeds 99 and 7: a
  formation on engines in contact has no supply for 12 % of its hours (47 % and 41 % before
  the rule), one on foot for 12 % and 10 % (22 % and 27 %).
- *Fuel* (PLAN 3.2b, ADR-134): a template's fuel is Σ `fuelPerHour` × count of its elements (0 on
  foot, 38 for the panzer division of 1938). Off the network a formation on the march loses
  fuel/320 an hour more: that panzer division is dry in 4.1 h. On the network nothing changes.
  A formation with no manoeuvre element on foot moves at 0.25 + 0.75 × supply of its speed.
- *Org* (PLAN 3.2c, ADR-135): a formation column, 0 to 1, 1 when made. A formation with no
  manoeuvre element on foot loses 1/32 an hour while its supply is 0; every formation on a
  network that feeds it gains 1/32 an hour while it is not in contact (PLAN 3.5a). Its fire
  is × (0.25 + 0.75 × org). Org is also lost to the losses of a battle, and a formation with
  little of it retreats: §5.2 step 4.

**Land movement (PLAN 1.11, ADR-24; `src/sim/nav/`, `src/sim/systems/movement.ts`).**
- *Grid:* the true km per cell row comes from the Miller geometry. Move cost per [mobility][terrain]
  comes from `terrain.json` (water = ∞; crossings walkable).
- *Components:* 4-connected land components make unreachable targets an O(1) reject.
- *Province graph:* admin-1 provinces plus one virtual node per crossing group and one per
  connected run of walkable land that no province has (2,310 on the 1938 map, of 1 to 9 cells:
  PLAN 3.7j, ADR-170), so every walkable cell has a node; the ids of both kinds begin above the
  highest province of any cell. Built in 80 ms at M (measured before
  ADR-170, not again). It is derived, never saved.
- *Routes:* `findRoute` uses straight cell A* below 500 km (not from open ground under a `Passage`: there every route is as one above 500 km, PLAN 3.10c1c, ADR-189). Above that, it runs coarse A* on the
  province graph, then cell A* inside the corridor of route provinces and their neighbours, with a
  flat fallback (none for a march: see *No march across a third nation* below). Cell A* is 8-connected with no corner cutting. Its heuristic is the octile walk
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
- *Orders:* `moveFormation {id, x, y, nation?}`. With `nation` the order is refused (`NoSuch`) when
  the formation is gone or is not that nation's (ADR-116): a player's click names the nation it plays, and
  a freed id that another nation's formation has taken is not ordered by it.
  - A target unreachable from the formation snaps to the nearest reachable cell within 3;
    otherwise the order is rejected (`MoveRejected`).
  - An order to a formation in the middle of a step leaves it where it stands (PLAN 3.5a1,
    ADR-151): the route begins at the nearer of the step's two cells, and the path with the
    step itself, on along it or back.
  - Order state is moving, originCell, targetCell, pathStep and stepFrac, and the path
    (`world.paths`, saved with the core since PLAN 3.4Rl: it is found on the holders of the
    hour of the order). A save from before has no paths; each is found again at the next
    step, from the cell the formation stands in, and its steps are counted anew.
  - A path outlives a change of the ground (PLAN 3.7k, ADR-171): a paint of terrain, a map
    import and a change of `loopingMap` drop the navigation graph and no path. A step that
    the ground of now does not allow (water, a corner cut past water, the seam of a map
    with edges) is not taken: the formation is ordered to its target again from the cell
    behind it, and halts there if no way is left.
  - *No march across a third nation* (PLAN 3.4Rl, ADR-149). A formation is routed over the
    ground of its supply bloc, of a nation it is at war with, of a nation on its side of a
    war, and over nobody's (`foreignTo`); a `Passage` carries that to the search. A cell of
    any other holder is entered only from a cell of the same holder (who stands there walks
    on it and out). With no way round, `MoveRejected`. Before any search the two ends must
    lie in one group of neighbouring province nodes that have open ground
    (`World.heldByNode`, cells by node and holder, kept by `setController`); a route, of
    any length since PLAN 3.10c1c (ADR-189; before it one over 500 km), is planned over such
    nodes and, when it is not found in their corridor, refused. In that plan a node that has
    closed ground too costs `SHUT_PRICE` (8) times its own cost (PLAN 3.10c2b3b, ADR-194):
    it need not be open from side to side, and the way by the cells went round it through
    provinces that the corridor did not hold.
    A march whose next cell has become a third nation's ends before it (`MoveRejected`).
- *Hourly:* a formation advances along cell centres. Entering a cell costs step km × move cost ÷
  (speed × 0.3 march duty × the template's share of its speed on that ground: the least
  `terrainMods.speed` of its manoeuvre elements, PLAN 3.3b, ADR-138; the route is found by the
  move cost alone). It faces its travel direction, and emits `FormationArrived` at the end.
- *Mobility:* a template moves like its slowest manoeuvre element (inf, cav, mot, mech, armour);
  support guns are towed. Infantry marches ≈ 29 km/day on plains.
- *Slotted poses:* `slotPose` (`src/sim/core/pose.ts`) places elements in a ≈ 2:1 block, front row
  first, rotated to the facing; it is shared by the sim and the snapshot builder.
- *Deployment (PLAN 2.14c1, ADR-89; `deployOf`, `elementPlace` in `systems/elements.ts`):* a
  formation in contact holds its place (formations in contact stand up to 1.5 cells apart), but
  its block of elements is deployed: on the line to its nearest enemy in contact, facing it,
  its front row half a kilometre short of the middle between the two; one whose nearest enemy
  faces a nearer formation comes up to that enemy's block, and no block goes further from its
  formation than contact reaches (`DEPLOY_REACH`, 1.5 cells; ADR-98); a line of a stack with no
  room before its formation's place stands abreast of the lines that have, a block's width out
  to the right and left by turns (ADR-133). Derived from the formations' places
  and `engaged` flags, not state: the snapshot, the fire events and the wrecks read it, no
  rule does. So a view at 20 m/px holds both sides of a fight (97% of the formations in
  contact after 60 days of a war, with their nearest enemy), and the T1 marker stays at the
  formation's place.

*Implemented v1 (PLAN 1.14, ADR-27; `src/sim/systems/territory.ts`):*
- *Pressure:* each formation of a nation at war, but one on the retreat (§5.2 step 4), projects strength/1000 × (0.5 + 0.5 supply) ×
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
- *Liberation* (PLAN 3.4Rj, ADR-147): a cell that flips to a nation not at war with its owner
  is controlled by that owner, if it lives: a partner's land, a puppet's or a stranger's goes
  back to it at the flip. So no land is held without a war, and a nation that frees a
  stranger's land does not advance through it (the next cell wants a neighbour it controls).
  Nobody's land and an enemy's are the taker's.
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
  - Given away (PLAN 3.4Rh, ADR-145): a capital city on a cell its nation no longer owns (the
    editor's paint, the God brush, an import, land ceded) moves the same way, hourly, with
    `CapitalMoved` alone: no `CapitalCaptured`, no war score, and no annexation under either
    setting or the death rule. A nation painted away whole has no cell to move to and is
    eliminated. Occupation with no war (the controller differs, the owner does not) moves
    nothing.
  - The dead hold no land (PLAN 2.16Rf, ADR-112; `leaveLand`): when a nation is eliminated, the
    cells it occupied go back to their owners, and the cells of its own that a living nation
    occupies become that nation's (`LandCeded`, one event for each receiver). Its cores stay
    the provinces', so it can revive there.
  - `winnerTakesAll` (a saved setting; command `setSetting`) annexes everything the loser
    controls, plus the loser's land the capturer already occupies.
  - `paintControl {nation, x, y, r}` sets control on land cells; with `x2, y2`, on the
    cells within r of the segment to that point. It is the command of occupation (tests, a
    replay). The God Mode territory brush sent it until PLAN 2.17b and sends the editor's
    nation paint since (ADR-118).
  - The war-score jump comes with 1.16.
- **Capital capture**: the war score jumps, the capital relocates to the largest owned city, and with
  the `winnerTakesAll` setting the capturer annexes all of the loser's controlled territory.
- *Cores, collapse and revival implemented v1 (PLAN 1.20, ADR-33; `src/sim/systems/revival.ts`):*
  - *Cores:* each province has a core (its 1938 owner) plus claims resolved from the scenario's
    `extraCores` (admin-0 or admin-1 codes), saved.
  - *Revival:* a dead nation keeps `revivalsLeft` (2 at the start) and `revivalAt`
    (death + 2 years; 0 for nations dead at the start). It returns through a revolt on a
    province it has a core on (instead of new rebels), through its holder's collapse, or by God
    `reviveNation`. It takes each province from the owner of its centre: what a third nation
    owns of that province stays with it (ADR-123: as in every transfer by province). A holder left without the centre of any province
    also gives up the cells it owns and controls outside any province, and is eliminated at
    once if it then controls no cell (ADR-122).
  - *Collapse:* 6 consecutive bankrupt months. Puppets go free, dead claimants revive on
    their provinces, and restless (≥ 50) provinces revolt in connected groups.
  - *God Kill* (`collapseNation`, PLAN 2.15a, ADR-99): the nation dies and nobody declares
    war over it. Puppets go free and dead claimants revive; land with a living core nation or
    claimant goes to it; the rest founds at most 5 nations (one for every 200 cells), shared
    among its connected pieces by their cities; a piece that founds nothing goes to its
    neighbour, an island to the heir. The heir is the nation founded on the province of the
    capital's cell (its city's cell, read as the Kill begins: ADR-114), else the largest
    founded, else whoever received the most. A nation that owns the centre of no province (Danzig, a
    nation of the toy world) has no heir: its land goes to the living nation with the most
    cells beside it, else to the nearest (ADR-113). No dead nation owns or controls a cell.
    A cell outside the provinces shared out that a living nation occupies becomes that
    nation's, not the heir's (ADR-119). One in a province whose centre a living nation owns
    goes to that nation (ADR-120); the heir takes those outside any province. The Kill of the only living nation is carried out if
    it owns a province's centre (its land founds what follows) and refused if it owns none.
    The dead nation keeps a claim on each province it was the core nation of and a founded
    nation took (the founded nation is the core there): it returns on them as any dead
    claimant does, by a revolt or by God `reviveNation` once its cooldown is over (ADR-121).
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
    and core with unrest ≥ 40, up to 8 provinces and 1,000,000 km² of the holder's land
    (`REGION_KM2`, PLAN 3.9, ADR-186): a neighbour that would take the area past that land
    stays. The province that revolts goes whole, whatever its size.
  - *Rebels:* a new nation takes the land and becomes its core. Its capital is the area's
    largest city; without a city, its own cell nearest the middle of the area (PLAN 2.15e1,
    ADR-103). If the city was the holder's capital, the holder relocates. Its `origin`, which
    names it (§3.4), is the province of its capital's cell (ADR-100, ADR-106). It gets 1–4
    militia divisions, raised where production raises a formation (`spawnPoint`: ADR-104), and
    50 gold. The holder always declares war on them (PLAN 1.40, ADR-44; it was a 50% chance),
    with its puppets and without its allies (ADR-184).
    Event `RevoltSpawned`.
  - *Defection and spreading (ADR-47):* a revolt on land whose core nation is alive (and not
    bound to the holder) returns the area to that nation. Otherwise, next to a rebel state it
    joins that state. Only otherwise does it found a new nation.
  - *Land handed over (PLAN 2.15d, ADR-102):* a defection, and each handover of a God Kill, is
    the event `LandCeded` (a = who received the land, b = who held it), as is the land of a
    dead nation that goes to its occupier (ADR-112), not a revolt: "Land of
    {b} went over to {a}" in the history. An area that joins a rebel state stays a
    `RevoltSpawned`.
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
- *Damage* (target units) = eff × fullness × 0.1 × terrain attack × (0.5 + 0.5 supply) ×
  (0.25 + 0.75 org) (PLAN 3.2c, ADR-135; §4, Supply v1) ÷ terrain defence (when the target
  holds) ÷ hpPerUnit. Losses apply after all of the hour's volleys. Besides: × the shooter's
  nation's combat efficiency (§5.3) and its attack buffs, ÷ the target's defence buffs, × 1.5
  in a Major Battle (§5.4).
  The terrain is the target's cell. Attack is the shooter's class figure of `terrain.json` ×
  its unit type's `terrainMods.atk`; defence is the ground's figure × the target's unit
  type's `terrainMods.def` (PLAN 3.3a, ADR-137). × 1.15 for a shooter whose side has
  infantry, artillery and armour alive in the battle (PLAN 3.4a, ADR-139; the table of §6.1).
  × 1.3 on a volley at armour on forest or urban ground whose side has no infantry alive in
  the battle (PLAN 3.4b, ADR-140). × 0.7 for an AT gun whose enemy has artillery alive in the
  battle (PLAN 3.4c, ADR-141). × 1.25 for armour at a target with no armour on plains,
  grassland or desert whose side has no AT gun alive in the battle (PLAN 3.4d, ADR-142).
- *Death:* an element at 0 is removed when its formation settles, and emits `ElementDestroyed`
  (element, unit, the slot it stood in; PLAN 2.4b). The event is a tick output, not state.
- *Measured:*
  - A 2:1 fight ends in 12.5 days, with the winner losing 0.263 of the loser's strength
    (square law: 0.268).
  - An 80-division battle costs 3.2 ms per tick.
- *Org and the retreat* (step 4; PLAN 3.5a, ADR-150; `systems/retreat.ts`,
  `retreat` of `data/combat.json`):
  - *Org:* after the hour's volleys a formation loses (1 ÷ 0.3) × the share of its strength
    that the hour took: a battle that takes three tenths of it takes all its org. In contact
    it gets none back (§4).
  - *The retreat:* a formation in contact with org under 0.15 breaks off. It is ordered to
    the ground of its side (its nation, its supply bloc, a nation fighting beside it) nearest
    the point 3 cells from its nearest enemy on its own far side, within 2 cells of that
    point, on its landmass and out of the contact of every enemy about; with none there, to
    the nearest such ground within 8 cells of itself. For 24 hours (`formations.retreat`,
    state) it is in no contact and no battle: it does not fire and is not fired on, its march
    is held neither by contact nor by cells the enemy holds, it presses no cell (§5.1), and
    the operational AI gives it no order. On its network it has 0.75 of its org back by then.
    A `moveFormation` command to it (a player's click, God Mode) is refused for those hours
    (`Refusal.OnRetreat`; PLAN 3.7m, ADR-173): with its march held by no enemy's ground and
    no battle to stop it, an order sent a broken division over the enemy's cells and past his
    formations. The formation panel's status says "On the retreat: no orders for N h".
    `FormationRetreated` is the event (not in the history).
  - *No ground within reach:* it holds and fights, with a quarter of its fire, and tries
    again every 6 hours (when (tick + id) mod 6 = 0; the first try waits for that hour too).
    The surrender of the encircled is not modelled.
  - *Where two enemies stand on one point* (a formation on the retreat is in no contact, and
    may halt where an enemy stands or be marched over): their blocks stand front to front,
    the lower id facing east (`deployOf`).
  - *Measured* (the first 360 days, every hour; seed 99 and seed 7; before → after):
    retreats 0 → 2,318 and 2,720, by 336 and 367 formations; formations destroyed 337 → 105
    and 312 → 123; elements destroyed 7,904 → 2,975 and 7,196 → 3,361; formation-hours in
    contact 384,187 → 249,559 and 339,910 → 265,924, of them with org under 0.15: 2,185 →
    15,731 and 2,929 → 17,151 (the wait for the sixth hour, and those with no ground within
    reach: the longest 423 and 537 h); formations at the year's end 798 → 1,026 and 823 →
    1,010. Armour with no infantry alive: 38 → 13 and 34 → 13 formations, in contact for
    12,511 → 3,235 and 6,973 → 2,720 hours. Cells flipped in each of five years of seed 99:
    25,592, 28,368, 20,856, 17,270, 15,644 → 22,767, 22,016, 15,720, 13,776, 25,834.
  - *Not done:* nothing fires on a formation that retreats; no surrender; nothing of it on
    the map (a retreat looks like a march; the formation panel says it, PLAN 3.7m); the 2:1 fight below is the fire's alone (`combatSystem`
    without the org's system), and what a 2:1 fight is with the retreat was not measured.
- *Deferred:* entrenchment, experience, night and weather. Of the modifiers of step 2
  below, entrenchment, river crossing, experience, air superiority and night/weather are
  read by nothing yet.
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
  *Implemented (PLAN 3.2b, ADR-134):* the fuel figure, the burn on the march off the network and
  the speed (§4, Supply v1). *(PLAN 3.2c, ADR-135):* the org, lost with no supply and read by
  combat. *(PLAN 3.2d, ADR-136):* breakdowns. With no supply and no org a formation on engines
  loses a tenth a day of its vehicles and towed guns (the elements that burn fuel and are not
  counted in men), besides the attrition of every formation without supply; its men go at
  that attrition alone. The formation panel has the org and the fuel the template burns.
- Terrain: a small bonus on grassland and in the desert, heavy penalties in forest, marsh,
  mountains and urban. Tracked mobility costs from the terrain table.
  *Implemented:* the move cost by mobility class (PLAN 1.11) and the fire by unit class
  (PLAN 1.13), both of `data/terrain.json`: a light tank's fire is × 1.1 on grassland, 0.8 in
  forest, 0.65 in a city, 0.55 in a marsh, 0.5 in mountains, and tracks cross a forest at
  half their pace. *(PLAN 3.3a, ADR-137):* a unit type's own `terrainMods.atk` and `.def`
  multiply those in a volley (infantry holding a forest takes ÷ 1.1 more, the heavy tank's
  fire in a marsh is × 0.8 more). *(PLAN 3.3b, ADR-138):* a template crosses a cell at the
  least `terrainMods.speed` of its manoeuvre elements for that ground, × the pace the move
  cost gives (cavalry in a forest 0.8, the heavy tank in a marsh 0.7, motorised infantry in
  a marsh or mountains 0.6, and with it every division that has some).
- Combined arms: armour is vulnerable to AT guns, CAS and heavy armour, and is strong vs
  infantry in the open. Infantry screens armour in urban/forest terrain. Artillery suppresses AT.
  Bonuses apply only when the elements are actually present in the battle.
  *The design table (PLAN 3.4, ADR-139).* Each rule is a factor on a volley's damage and
  never on the choice of target. A formation's *side* is the formations of its battle that
  its nation is not at war with, itself among them; an arm is *present* on a side while an
  element of it there has strength left. The classes of an arm and the figures are in
  `data/combat.json` from the part that reads them.

  | # | rule | when | factor | part |
  |---|------|------|--------|------|
  | 1 | The three arms | the shooter's side has infantry (`inf`, `mot`, `mech`), artillery (`art`) and armour (`armor_l/m/h`) present | fire × 1.15 | 3.4a, implemented |
  | 2 | The screen | the target is armour (by its arm, not its `armor` figure) on forest or urban ground and its side has no infantry present; holding or moving | damage taken × 1.3 | 3.4b, implemented (ADR-140) |
  | 3 | Guns on guns | the shooter is an AT gun (class `at`) and its enemy (the battle's formations its nation is at war with) has artillery present | fire × 0.7 | 3.4c, implemented (ADR-141) |
  | 4 | The open | the shooter is armour (by its arm), the target has no armour (its `armor` figure is 0: not a tank, not mechanised infantry) and stands on plains, grassland or desert, and the target's side has no AT gun (class `at`) present | fire × 1.25 | 3.4d, implemented (ADR-142) |

  Beside the table, in since PLAN 1.13 (§5.2): a shooter's `hard` against an armoured target
  and its `soft` against another, × 0.5 when the armour beats its piercing. That is "AT vs
  armour": the AT gun of 1938 (hard 18, piercing 45) hits every tank of 1938 in full.
  Measured before rule 3 (PLAN 3.4c; 48 hours on plains, three seeds): of the tanks an
  infantry division (24 battalions, 3 batteries, 1 AT battery) takes from a tank brigade,
  its one AT battery takes 73 to 76 % (75 to 77 % in a forest), its battalions 21 to 22 %,
  its howitzers 3 to 5 %; from a panzer division 85 to 89 %.
  Measured before rule 4 (PLAN 3.4d; one volley of a light tank company at a holding
  battalion, plains = 1): grassland 1.16 (the tank's 1.1 ÷ the ground's 0.95), desert 1.05,
  forest 0.58 (0.8 ÷ 1.25 ÷ the battalion's own 1.1). So the terrain table already tells
  open ground from close, for every target and whoever is beside it. What it did not do:
  a division's AT gun changed what it took from the tanks (3.5 to 3.8 tanks in 48 hours
  against 0.5 for a division with none) and nothing of what the tanks took from it
  (1,312 men from either). Rule 4 is that.

  *The matrix* (`tests/unit/combinedArmsMatrix.test.ts`, the AT of PLAN 3.4; seed 5, 48
  hours, both holding, an attacker against an `infantry_div`; "men" are the battalions' men
  lost, "to tanks" those the tanks' fire took, "by AT" the tanks the AT battery took):

  | ground | attacker | defender | men | to tanks | tanks lost | by AT |
  |--------|----------|----------|-----|----------|------------|-------|
  | plains | tank brigade | the division | 1,356 | 1,319 | 3.76 | 2.73 |
  | plains | tank brigade | no AT gun | 1,685 | 1,649 | 1.01 | 0 |
  | plains | tank brigade | no howitzers | 1,372 | 1,326 | 3.48 | 2.73 |
  | plains | tank brigade | rifles alone | 1,727 | 1,680 | 0.74 | 0 |
  | plains | panzer division | the division | 3,261 | 2,684 | 1.96 | 1.63 |
  | plains | panzer division | no AT gun | 3,944 | 3,363 | 0.30 | 0 |
  | plains | panzer division | no howitzers | 3,330 | 2,739 | 1.89 | 1.63 |
  | plains | panzer division | rifles alone | 4,041 | 3,450 | 0.25 | 0 |
  | plains | tank brigade, its infantry destroyed | the division | 1,319 | 1,319 | 5.26 | 2.73 |
  | plains | panzer division, its howitzers destroyed | the division | 2,538 | 2,334 | 2.70 | 2.34 |
  | forest | tank brigade | the division | 797 | 767 | 3.17 | 2.39 |
  | forest | tank brigade | no AT gun | 797 | 767 | 0.78 | 0 |
  | forest | tank brigade | no howitzers | 807 | 771 | 3.00 | 2.39 |
  | forest | tank brigade | rifles alone | 817 | 782 | 0.60 | 0 |
  | forest | panzer division | the division | 1,952 | 1,546 | 1.70 | 1.43 |
  | forest | panzer division | no AT gun | 1,952 | 1,546 | 0.26 | 0 |
  | forest | panzer division | no howitzers | 1,992 | 1,578 | 1.66 | 1.43 |
  | forest | panzer division | rifles alone | 2,004 | 1,590 | 0.22 | 0 |
  | forest | tank brigade, its infantry destroyed | the division | 767 | 767 | 5.72 | 3.11 |
  | forest | panzer division, its howitzers destroyed | the division | 1,496 | 1,344 | 2.35 | 2.06 |

  What the test asks of it, each ratio to 3 % (48 hours cost a formation so little that the
  dead hardly move it). Rule 1: the panzer division's tanks take × 1.15 of what they take
  with its howitzers destroyed. Rule 2: in a forest the AT battery takes × 1.3 of tanks from
  the brigade with no infantry (3.11 for 2.39), on plains × 1. Rule 3: the health the AT
  battery takes off the panzer division's tanks is × 0.7 of that with the division's
  howitzers destroyed. Rule 4: on plains the tanks take × 1.25 of men from the division with
  no AT gun, in a forest × 1. "AT vs armour": the battery takes over 0.7 of the tanks lost,
  and a division without it under 0.3 of what the whole one takes.
- Tactical view: tank sprites with turret facing their target, muzzle flash, burning wrecks.
  *As built so far (PLAN 3.6a to 3.6c):* the hulls and the turrets, a turret that turns
  to its target as its shot leaves, and the shot from its muzzle (§8, "Tanks").

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
    partners; defence = the target's strength + 0.4 × (partners + guarantors) (ADR-47); a puppet is read as its realm, the overlord's strength with the partners and guarantors of both (ADR-183). It declares on the best target with utility > 0.5, with probability 0.25 ×
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
  - *Who deploys:* free (not engaged, not on the retreat: §5.2 step 4) formations within 60 cells of the front. The farthest 15%
    stay in reserve. The range is to each sector (PLAN 3.10c1, ADR-187): a sector is allotted no
    more than the formations within 60 cells of it and takes only those; what the allotments
    leave over joins its nearest sector.
  - *Marches from afar* (PLAN 3.10c1a, ADR-190): a sector of the nation's own front (not an
    ally's) that has nobody takes one formation from beyond the range. Nobody: no formation
    of the nation stands in the sector or in one next to it, the allotment gave it none and
    none is on the march into it. The formation: free, standing still, on the sector's
    landmass, more than 60 cells from every sector it reaches; the nearest first. It is
    ordered to the sector's front cell and not planned again before the march ends or
    comes within the range (then it is a march into a sector, kept as below). A formation
    is looked at for this on one day in eight (`MARCH_DAYS`, by its id).
  - *To spare* (PLAN 3.10c1d, ADR-191): such a sector that no formation of the nation is
    within 60 cells of also takes one of the formations near the front. On the nation's day
    in eight, of the free formations within the range of a sector that are not on an errand
    (below), the farthest from the front, as many as the reserve's share (one at least), may
    go: each to
    the nearest such sector within 180 cells (`SPARE_RANGES` × the range) on its landmass,
    one a sector. No more go than the front can spare: the formations near it, less the
    share of them that the other sectors weigh among all (1 + threat/10,000 each, as in the
    allotment). On an errand (PLAN 3.10c1d2) is a formation on the march to a cell more than
    60 cells from it (no allotment orders that far), or into a sector that would have nobody
    without it: no other formation of the nation stands in it or next to it, and none other
    marches into it. So a march this rule gave is kept, and a formation that marches to its
    sector's cell as the others of a front that fights do is to spare as one that stands.
  - *Reach* (PLAN 3.5b, ADR-152): those formations are classes by where they stand (the
    landmass; on it the group of provinces joined by ground open to the nation, §4, or
    closed ground). A class reaches a sector when an order to the sector's front cell would
    not be refused before its search. Range and reserve count the sectors a formation
    reaches; each class is allotted to the sectors it reaches and to no other.
  - *Pockets* (PLAN 3.10c2b1, ADR-192): the provinces are kinder than the cells (two
    neighbours with open ground each are one group, whether or not their open cells meet).
    So formations that stand in a pocket of open ground are a class of their own, which
    reaches the sectors whose front cell lies in the pocket and no other. A pocket: the cells
    a route comes to from the formation's cell over ground open to the nation, when they are
    no more than `POCKET_CELLS` (4,096). It is walked once a passage (`pocketOf`,
    nav/grid.ts). Wider ground is not walked to its end and is judged by the provinces, as
    before; a formation in a province with no closed ground that is joined to such
    provinces of more than 4,096 cells is not walked at all (`wideNode`). And the other way
    (PLAN 3.10c2b2): a sector whose front cell lies in a pocket is reached by the class of
    that pocket and by no other on open ground; the cells are walked from the sector's cell
    as from a formation's, once a cell and passage. A class on closed ground is not asked
    (it walks out of it, into a pocket too). An order's own test (`mayReach`) does not ask
    this: the order's search finds it.
  - *Wide grounds* (PLAN 3.10c2b3a, ADR-193): wide ground is not one. The provinces with no
    closed ground that neighbours join, when they have more than 4,096 cells, are a wide
    ground with a number (`wideNode`), and a walk that ends at a cell of one says which
    (`pocketOf`). Formations are classes by the wide ground they stand in or come to, and a
    class reaches a sector whose front cell is in another wide ground, or comes to another,
    only when the cells join the two (`wideJoined`, nav/provinceGraph.ts): the open cells of
    the provinces that have closed ground are walked, once a passage and only when two wide
    grounds are asked for, and two wide grounds that a run of such cells touches are joined.
    Ground that was walked 4,096 cells and came to no wide ground is taken to reach any.
  - *Allotment:* the rest go to sectors by largest remainders over 1 + threat/10,000, with every
    sector getting one while formations last. Formations already marching into a sector keep it,
    also beyond the sector's allotment of the day [ADR-53]; the rest fill what is left
    nearest-first.
  - *Orders:* a sector at ≥ 1.5× local superiority attacks the enemy cell next to its centre;
    otherwise it holds its front cell. A formation is not re-ordered if its target is within a
    sector of the current one.
  - *Spearheads* (PLAN 3.5c, ADR-153): a formation is armour when half of its upkeep or more
    is in tanks (`SPEARHEAD_ARMOUR` against `EconomyTables.templateArmour`: 0.66 to 0.93 for
    the armour formations, 0.20 at most for the others; the planner looks at no element).
    Where a sector that attacks has armour, the armour marches on the enemy's cell and the
    rest are sent to the front cell, as in a sector that holds. A sector with no armour
    attacks with all it has. The rest follow by the plans of the days after: the front cell
    is then where the armour has taken ground.
  - *The spearhead metric* (PLAN 3.5c and 3.5e; `tools/diag/spearheads.ts`, read from the
    run with no hook in the planner). An *attack* is the formations of one nation ordered to
    one cell that an enemy of the nation holds at the hour of the order, from the first such
    order until the first of them is in contact within a sector (4 cells) of the cell; a later
    order to that cell opens another attack. The metric is the share of the attacks that came
    to contact whose first formation in contact is armour, read beside armour's share of
    the formations sent, over all attacks and over those armour was sent to.
  - *Tick cost* with 10-year AI wars: 2–3 ms (above the 1.5 ms budget) until PLAN 1.42a; since
    then 1.0 ms over 5 years of seed 99 (§2.5).
- **Economic AI** (daily): a budget split between army, navy, air, industry, research, nukes,
  revolt suppression and reserve gold. The production mix is adapted to enemies (AT vs armour-heavy
  enemies, fighters when bombed).
  *Implemented v1 (PLAN 1.26, ADR-38; `src/sim/ai/economic.ts`), monthly, just before the economy
  charges the month, on projected accounts (gross − upkeep − admin − CE cost − suppression −
  tribute):*
  - *Disbanding:* a nation whose balance does not cover a 5% margin plus debt repaid within a
    year is short by S a month. While its gold is below 3 × S (`RUNWAY_MONTHS`), idle
    formations go; a nation with gold enough runs the deficit (PLAN 2.13, ADR-86). The order:
    the least of its upkeep in tanks first (`EconomyTables.templateArmour`: 0 for a division
    on foot, on horse or in lorries, 0.14 for the mechanised division, 0.20 for the Soviet
    rifle division, 0.66 to 0.93 for the armour formations), among those the weakest by men,
    then the lowest id (PLAN 3.1d, ADR-131: by men alone the tank brigades went before every
    rifle division). Half their men return to the manpower pool. One `FormationsDisbanded` event per
    nation and month, kept in the history.
  - *The treasury of the start* is six months of income, or twelve months of S with the army
    of the order of battle where that is more (`START_ARMY_MONTHS`; 16 nations of 1938): no
    army of the start is disbanded in the first hour.
  - *Suppression:* 0.5 while a held province has unrest ≥ 40 and the budget has room.
  - *Building:* up to 1 + income/400 orders in training at once (at most 6; ADR-47). It needs
    army upkeep, counting the orders in training, under 35% × (0.3 + 0.7 × aggression/100) of
    income in peace (60% at war), a positive balance after the new upkeep, and 3 months of
    income in reserve.
  - *Overseas muster (ADR-47):* a nation whose fronts all lie on other landmasses than its
    capital raises new formations in the theatre (nearest own city to the front), an abstraction
    of sealift until PLAN 4.5.
  - *Build mix* (PLAN 3.5d, ADR-154): cadre divisions if income < 20. A nation wants a share
    of its army's upkeep in tanks (`armourWanted`): none up to an income of 200, rising in a
    line to 0.3 at 1,000 (`ARMOUR_SHARE_MAX`, `ARMOUR_FULL_INCOME`). While its army, with the
    orders in training and each order as it is made, has less (`EconomyTables.templateArmour`
    of each template, by strength), its order is the best armoured division it knows the
    techs of (MBT, heavy, medium of 1941, the division of 1938; PLAN 3.1c), in peace as at
    war. Short of that one's price with the reserve it *saves*: with an order in training
    it orders nothing more that month; with none it orders the best it has the gold for,
    infantry at the least (PLAN 1.42c). Its other orders are motorised divisions at war
    against armour-heavy enemies (≥ 20% tanks) and infantry otherwise; a nation that knows
    no armoured division orders as one with armour enough.
    Measured over ten years (`tools/diag/armourMix.ts`; seed 99, seed 7), the tanks' share
    of the army's upkeep at the end, before → after: GER 3.9 → 29.5 % and 0 → 28.4 %, ENG
    7.5 → 28.1 and 5.2 → 25.1, USA 30.7 → 31.2 and 20.9 → 27.6, JAP 0 → 13.8 and 0 → 14.7,
    SOV 28.0 → 22.3 and 15.1 → 14.8, ITA 0.1 → 1.6 and 0.5 → 21.5, FRA 0 → 0 and 3.7 → 10.9.
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

**What shows at a zoom is a state, not a function of the zoom** (as built, PLAN 1.45a and
2.7; ADR-64, ADR-71, ADR-73). The first design gave every layer an opacity curve `α_layer(z)`.
It was dropped: a camera resting on a curve showed two layers half there.
- A thing (a tier's unit layer, the capital flags, a city's dot, a city's name, a nation's name)
  comes in when the zoom reaches its threshold and stays until the zoom is 1.15 × beyond it.
- A change is a fade of 250 ms of real time, the same when a name finds room because its
  neighbour went. At rest everything is in full or absent.
- `src/render/timing.ts` has the pieces: `TimedSwitch` (one thing), `SwitchBank` (a layer's
  things, by key), `ZOOM_HYSTERESIS`, `FADE_MS`. Layouts stay pure functions: they are told what
  is on and what still fades out (`SwitchState`).
- Not zoom, and at once: a change of map mode takes the nation names away with the mode; new
  label curves from the worker move a name. The counters' cluster level has its own hysteresis
  (± 0.15 of a level) and a split or merge of 250 ms.

| Tier | m/px | Map | Forces |
|---|---|---|---|
| **T0 Strategic** | > 2000 | fills, smooth borders, occupation tint/hatch, fronts glow, curved names, cities as dots | aggregated counters per nation per screen cluster (stable multi-level grid clustering), strength numbers |
| **T1 Operational** | 300–2000 | + province borders, city names, sea-zone and air-zone overlays, supply/convoy lanes | formation/fleet/wing markers: type symbol, flag chip, strength bar + number, order arrows, battle markers |
| **T2 Tactical** | 30–300 | + hillshade, procedural ground texture, tree, rock and building instances, the coast from the fine land mask (roads near cities: not built, a line under PLAN 7.4) | element sprites (facing, walk/drive animation, firing, tracers, impacts, wrecks, casualties), sorties in flight, ships with wakes |
| **T3 Close** | < 30 | the same ground, worked out for each pixel with finer octaves down to 1 m/px, and the things on it at their own size (not tiles kept in textures: ADR-78) | element → individuals: where an element holds up to 64 units (vehicles, guns, ships and planes: 1 to 12), one figure for each unit it has; a battalion of 500 has 64 figures when whole and its share of them while it loses men, rounded up [ADR-80, in place of ADR-69's cap] |

*How far out the ground reaches (PLAN 2.11l):* the ground and what stands on it come and go
with the element sprites' share of the T1 ↔ T2 handover, which is a matter of time. Beyond
the zoom at which T2 is left (345 m/px) they also go with the zoom: all of the share up to
there, none of it from 690 m/px, smoothly between (`groundReach`). A camera that is far out
before the handover's clock has run shows no ground made for T2.

*The ground of T2 and T3, as built so far (PLAN 2.8a, ADR-78):* hillshade in the map pass
(`mapShader.ts`). The worker sends the elevation level of the map's size after the map layers
(`elevation`: int16 metres, one value a cell); the pass smooths it over the 4×4 cells around by
the borders' cubic B-spline, takes the slope from the spline's derivative, steepens it 12
times, and lights it from the north-west, 41° up: level ground is unchanged, a slope is from
0.58 to 1.28 of its fill, by a soft limit. The sea is level. It comes in by the sprites' share
of the T1 → T2 handover and shows in every map mode. A map without elevation of its size (the
toy world) is drawn flat: the one switch is for the ground as a whole.
*The ground's colour (PLAN 2.14d, ADR-90):* with the ground's share the fill gives way to the
terrain's colour (the terrain mode's blend of the four cells around) and stays as a cast on
it: 0.14 of the fill away from borders, 0.62 on a border falling over about half a cell, at
least 0.42 on occupied land (ADR-82's tint; an eighth of the hatching is left in the picture).
Only where the land is coloured by a palette (not in the terrain and unrest modes), and not
at T0 and T1. Plains in two nations are 14 apart in RGB where the fills are 103 apart.

*Ground texture (PLAN 2.8b):* the same pass adds small relief and grain from noise seeded by
the place. Gradient noise in octaves, 2^k lattice points to a cell, the lattice points named
and hashed as integers (a float that held the cell and the place in it is too coarse at 1 m/px)
and periodic over the map's width (no line at the seam). An octave counts by its wavelength on
screen: from 256 px down to 16 px at the far end of T2 and to 2.5 px from 20 m/px in, so the
ground is finer the nearer the camera. The slope of the octaves is added to the data's slope
before the lighting, by the terrain class of the four cells around (`ground.ts`: 1 for
mountains, 0.55 hills, 0.14 plains); their value varies the fill's brightness by a few
hundredths, and woods are a little darker, sand and ice a little lighter. The fill keeps its
colour.
*Two programs:* the pass of T0 and T1 is compiled without any of this, and the pass with the
ground is used while any of it shows (PLAN 2.8b: a branch in one program made T0 half as dear
again).
*Trees, rocks and buildings, drawn (PLAN 2.8c2, `GroundInstances.ts`):* one instanced draw
between the map and the unit sprites, of at most 12,000 instances, by the same share of the
handover as the ground and under its one switch. The fragment shader draws each in its square:
a crown with a lobed edge, a block of rock with cut corners, a roof of two slopes (tile or
slate, along one of two directions that cross), each lit from the north-west with its shadow to
the south-east. In natural colours on the nation's fill. The view scatters again only when the
camera, its size, or the world's terrain or cities change.
*Where they stand (PLAN 2.8c1, `scatter.ts`):* a
nested lattice, 2^l points to a cell at level l, each point of a level a point of every finer
one. An instance belongs to the coarsest level its point is on and stands near it, moved by a
hash of the point: one place whatever the zoom. A view shows the levels whose points are 14 px
apart or more, and the next finer level comes in by its opacity through the upper half of the
octave of zoom before that. Further out than level 0 the levels go on, coarser: level −k is
every 2^k-th point of level 0 each way (PLAN 2.11l), so a view is never denser than that. At a point: a building by how near a city is and how large (reach
3 to 18 km by size, densest at the middle); else a tree or a rock by the terrain class of the
cell (forest 0.75 trees; mountains 0.42 rocks; plains 0.05 trees; ice nothing). Nothing on
water: by the cell's class, and where the fine land mask is there only on sure land
(`maskSure`, since PLAN 2.9b2; the coverage before). Size: a symbol of 6 or 7 px at
T2, the thing's own (a crown of 9 m, a house of 14 m) once the zoom shows it larger.

*T1 implemented (PLAN 2.1, `src/render/units/markers.ts`):* Canvas2D markers, the unit layer
from 2000 m/px down to 300 (see the handovers below). Each
shows a type symbol (from the template's
elements), a flag chip, a strength bar (strength / template men), the strength number, a dashed
order arrow to the target, and a red outline while engaged; Major Battles get crossed swords.
*Stacks (PLAN 2.7s1, `markerStacks.ts`, ADR-77):* a marker that is more than a quarter of its
box under a stronger marker of its own nation goes into that one, which then shows the men of
all it stands for and "×n". It stays in until it is under its lead by less than a tenth; a
change is a fade in place over 250 ms. Markers of two nations are never one marker: where two
shown boxes are still more than a quarter on each other (across a front at the far end of T1)
they move apart by half each, at most 6 px from their formations, by an ease of 150 ms (PLAN
2.7s2). Where the boxes stand is a function of where the formations stand, with no memory of
the frame before (PLAN 2.7v); where the 6 px cannot part them they are left on each other. A
pair moves apart along x or y, whichever is the shorter way; where that leaves boxes on each
other, the group of markers within reach of each other is parted along the lines between the
centres instead, if that leaves less on each other (PLAN 3.5h, ADR-157). A
box that goes into a stack fades at the place it is drawn at, and one that comes out again in
mid-fade eases from there (PLAN 2.7w). The order arrow starts at the formation. The boxes do
not move during the morph into T2; on the way back from T2 they grow where they will rest
(PLAN 2.7z).
The snapshot carries template, flags and target per formation, plus Major Battle positions. T0
sprites stop once markers are fully in; capital flags draw above the markers. At T0 a capital
flag that would cover a counter stands just above it instead (up to 40 px from its usual place,
else it is left out), so no counter's number is hidden (PLAN 1.45c). A destroyed nation has no
flag: the snapshot says which nations live (PLAN 2.7g).

*T0 implemented (PLAN 2.2, `src/render/units/counters.ts`, ADR-45):* counters per nation per
cell of a nested 2^L-cell grid (~64 px), showing Σ strength. Splits and merges animate the child
level for 250 ms. The level wanted is judged against the level held, and a change that has
finished is taken over first: a camera at rest holds one level (PLAN 2.7f). The unit-size
setting scales counters and markers.

*T0 declutter (PLAN 1.45b, `foldOverlaps` in `counters.ts`, ADR-65):* no two counter boxes
overlap. In screen space, a counter whose box would come within 2 px of a stronger one's is
folded into it: first a nation's own counters into each other, then across nations in the
order of what they hold. The stronger counter shows the sum and "+n" for the other nations
folded in; nothing is dropped, so the shown counters still add up to every formation's
strength. A change is a fade in place over 250 ms; a folded counter comes out only once it
clears its neighbour by 6 px more. That hold is a memory of the layer at rest: a split or merge
on its way is folded without it and leaves none, so the counters land as a view opened at that
zoom shows them, whatever frames were drawn on the way (PLAN 2.7l, ADR-75). It is a memory of
one zoom too: the first frame at another zoom is folded without it, and folds on with the hold
of each fold until the fold stands, so a step of the zoom inside a level also ends as a view
opened there, in the frame of the step (PLAN 3.5i, ADR-158). The result depends
on the zoom, not on where the camera is. Strengths from a million on read "1.54M".

*Tier handovers (PLAN 1.45a and 2.7b, `src/render/units/handover.ts`, ADR-64, ADR-71):* at each
of the three boundaries which of the two unit layers shows is a state. The nearer layer comes
in when the zoom reaches the boundary and goes out above it by the hysteresis (× 1.15); a
change is a cross-fade over 250 ms of real time. At rest one layer is drawn at full opacity and
the other not at all, wherever the camera stops.

| Boundary | Nearer layer in at | out above |
|---|---|---|
| T0 counters ↔ T1 markers | 2000 m/px | 2300 |
| T1 markers ↔ T2 element sprites (470 ms: see the morph below) | 300 | 345 |
| T2 sprites ↔ T3 individuals | 30 | 34.5 |

- The elements are in the view before the sprites come in: they are sent from 450 m/px.
- The figures of T3 are built in the frame the close tier comes in, from a copy of the last
  element section that the view keeps below 60 m/px. A snapshot subscribed at T3 is a frame or
  two away, and the cross-fade needs both layers. They are built from each snapshot for as long
  as they are drawn: while the close tier is on, and while its fade out runs (PLAN 2.7j).
- Elements whose figures cannot be drawn keep their sprites at T3 (their section not kept yet,
  or more figures than the renderer's cap). A view with no elements at all keeps the close
  tier as the zoom has it, so that the figures of a formation panned to are there in its first
  frame (PLAN 2.7p).
- Fire and wrecks are drawn with the sprites' share, at T2 and T3 alike.
- *Before:* T0 ↔ T1 cross-faded by zoom over 2000–2600 m/px and T1 → T2 over 210–300 m/px, so
  a camera resting in either band showed two layers half-faded; T2 → T3 was a switch in one
  frame.
- *Checked (PLAN 2.7b, `tests/e2e/fades1938.spec.ts`):* the camera steps across each boundary
  in both directions and stays; of the frames that follow, 16 ms apart, no pixel of the unit
  layers changes by more than 48 of 255 between two frames (measured: 31–39; the whole change
  is about 250).

*T2 elements implemented (PLAN 2.3, ADR-46):* the view subscribes with its padded bbox
and tier at most 10 Hz. The worker sends the elements of the formations whose block reaches
into the box (by the block, not the centre: at the closest zooms the box is smaller than a
division; PLAN 2.7n1), a formation whole or not at all, at their slot
poses (`sim/core/pose`, shared with the sim). They are drawn as instanced sprites, interpolated
on the GPU, with facing and a procedural walk/drive animation, fading in as the markers fade out.
The walk is for a formation on the march: one that has a march and holds in contact stands, as
the sim holds it (`marching` in `src/shared/protocol.ts`, PLAN 2.11e). A sprite's opacity is
what is left of its element: its share of its size, from 0.45 to 1 (`spriteAlpha`, PLAN 2.11g).
Where a snapshot has no elements, each formation is one stand-in sprite of 0.9 cells and at most
48 px (PLAN 2.7n3): the toy world's formations, which have no elements, and any world for the
moment before its first elements arrive.

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
- *Not built:* GPU particle pools (the layer is Canvas2D: 0.12–0.22 ms a frame for the fire of
  three divisions).

*T2 casualty removal and wrecks implemented (PLAN 2.4b, `src/render/fx/wrecks.ts`, ADR-67):*
- *The event:* an element whose strength reaches 0 (combat, attrition, desertion) is removed
  and emits `ElementDestroyed` with the slot it stood in (§5.2 step 3). It is a tick output,
  not state. Elements that go with a formation removed whole (disbanded, annexed, by God or the
  editor) emit none. Only a view that draws elements gets the event, with what the unit's class
  leaves in place of the unit: the fallen, a broken gun, a burnt-out vehicle.
- *The visible end:* the snapshot that no longer has the sprite brings the event. In that frame
  a burst (a flash and an expanding ring, 400 ms) is drawn where the sprite stood, and the
  wreck comes in under it.
- *The wreck* stays for 12 s of real time and fades over 3 s; guns and vehicles smoke. It stays
  where the element died while its formation moves on. At most 1,500 are held.
- Nothing of it is sim state; a reload starts with no wrecks.

*T3 individuals implemented (PLAN 2.6 and 2.10b, `src/render/units/individuals.ts`, ADR-69 and ADR-80):*
- *Count:* an element whose unit type has up to 64 units to an element (guns 12, tanks 10,
  planes 6 to 12, ships 1) has a figure for each unit it has. A battalion (500) has 64 when
  whole and `ceil(64 × strength ÷ size)` while it loses men: 20 figures at 150 men. An element
  with men has a figure, and all 64 only when it lacks less than a figure's worth. The
  snapshot's element section carries the element's size besides its strength and atlas frame
  (PLAN 2.10b; until then the count was `min(strength, 64)`, and a battalion showed its losses
  only when fewer than 64 men were left).
- *Place:* the footprint is a square of 0.024 cells around the element's slot pose (slots are
  0.03 apart), turned with the formation and divided into sub-slots: 8 × 8 for men and for
  anything that has more than 16 figures when whole, 4 × 4 for vehicles and guns. The grid is
  the whole element's and does not change as it loses. An element's figures take the sub-slots
  in an order of its own (a shuffle by its id), each a little off its sub-slot's centre.
- *Casualties:* a loss takes the last figure of that order away; the others stand where they
  stood. So a battalion thins out across its block as it loses men (ADR-80).
- *Drawing:* the view expands the elements of a snapshot that arrives at T3 into instances of
  the same instanced renderer as the element sprites, previous and current place alike, so the
  GPU still interpolates. The origin is the camera's cell (f32 offsets from the middle of the
  map would step by 2.4 m). A figure is at least 2.5 px.
- *Guns* have a frame of their own in the procedural atlas (artillery, anti-tank, anti-air), at
  T2 and T3; they were drawn as infantry.
- *Tanks* (PLAN 3.6a, ADR-159) are two sprites: a hull frame for each weight (light, medium,
  heavy) and its turret with the gun as a frame of its own, a second instance at the hull's
  place written after all the others of the layer (`render/units/turrets.ts`), at T2 and T3.
  The turret's ring is the middle of both frames. Mechanised infantry is a half-track, with no
  turret. The snapshot carries the hull's frame alone.
  *The small mark* (PLAN 3.6e3b, ADR-165): where an element sprite is drawn 5.5 px wide or
  less (from about 92 m/px outward at the default size setting; the least size is 5 px, from
  102), a hull of any weight is one frame made for that size, a solid slab along the facing
  (`Frame.tankSmall`, `smallFrameOf`), and its turret is not drawn. From 5.5 to 8 px (92 to
  64 m/px) the shader mixes the two frames by `smallShare` of the sprite's size and fades the
  turret in: a matter of the zoom alone, with no clock. From 8 px in a tank is hull and turret.
  No other class has a small frame.
  *The turret turns* (PLAN 3.6b, ADR-160): `TurretAims` has an aim for every element whose
  cannon shot the view draws, the angle of the fire record's line. The turret turns there in
  180 ms before the shot starts (a cannon's shot starts 180 ms after its minute of the tick,
  so the turn is over as it leaves: PLAN 3.6e1, ADR-163), stays for 1.5 s (or 1.5 ticks), and turns back to its hull's
  facing in 0.6 s. View state on the render clock; while an aim is live the turrets' facings
  are written and uploaded again each frame. The tanks of an element have one angle.
  *The shot leaves a barrel* (PLAN 3.6c, ADR-161): at T3 a shot starts at the muzzle of one
  of its shooter's figures (`firingFigure`: by the element and the tick; `originOf`), a
  tank's along its turret of the frame, a gun's and a rifle's along the figure's facing, and
  a cannon's flash is a tongue along the barrel. From the slot to the muzzle with the close
  tier's share. A shooter outside the view's box fires from its slot.
  *A tank that is lost leaves its hull* (PLAN 3.6d, ADR-162, `render/fx/hulls.ts`): the view
  compares the elements of a snapshot with those of the snapshot before, and a figure that an
  element of tanks had and has no more leaves a hull on its place, at the old pose. If the
  snapshot says the element was fired at since the one before (`SnapshotElements.hit`: by
  anything, from anywhere; not the fire records, which are only of the shots with an end in
  the view's box, while a formation is sent whole: PLAN 3.6e5, ADR-167), the hull burns:
  flame for 6 s of real time, smoke for 9 s more, a fade of 2.5 s. If not (a breakdown,
  attrition: PLAN 3.2d),
  the tank was left behind: a grey hull with its gun in line, for as long, without flame or
  smoke. None for an element first seen, and none for one that is gone: the last tank of an
  element ends with it and leaves the element's wreck (PLAN 2.4b). Drawn with the figures'
  share, at a figure's size; at T2 a loss is the sprite's opacity, as for every element. At
  most 2,000 are held. View state on the render clock: a reload starts with none.
  A game loaded into a running one (PLAN 3.7n, ADR-175) takes the hulls, the wrecks, the shots
  and the turrets' aims of the game before with it, and its first snapshot makes no hull: the
  view is told of the load (`SimClient.onLoad`), it does not read it off the clock.
- *The T2 ↔ T3 change* is a handover like the others (see above), since PLAN 2.7b.
- *Measured:* 3,345 figures of 89 elements (three divisions at 28 m/px): 0.7 ms to build per
  snapshot, 0.5 ms of CPU to draw a frame.

**One truth.** Every number or sprite derives from sim state: counter strength =
Σ formation strength = Σ element strength. Sprites are at element positions, and tracers
come from FireEvents. Close-tier positions inside an element footprint are the only
presentational freedom, and the count is always exact.

*Checked (PLAN 2.5, `tests/e2e/tiers1938.spec.ts`):* in a battle spawned by God where nothing
else stands, the element sprites read at T2 and the counter read at T0 give the same men before
the fight, when the first elements have died and when one division is gone: what the counter
loses is what the elements lost, to the man. Men are units × the men per unit of the element's
type, summed over a formation's elements and rounded, as the sim does: a gun crew is not a whole
number of men (12.5 or 8.33 per gun). No mechanism was needed for it: the number at every tier
is the formation's strength, which the sim recomputes from its elements at each settle.

**Transitions without popping.**
- T0→T1: clusters split by animating from the cluster centroid to member positions
  over 250 ms (positions are real). They merge in reverse.
  (As built: that is the change between two cluster levels inside T0, PLAN 2.2. T0 ↔ T1
  itself is a handover, a cross-fade of counters and markers over 250 ms: see the table above.)
- T1→T2: the marker scales down and fades into the formation centroid while elements fade
  in at their real positions. The strength bar lingers above the group until T2 is fully in.
  (As built, PLAN 2.7c, ADR-72: over 250 ms the box fades and shrinks by 13% about its centre
  while the sprites fade in; the strength bar and the number stay for that time and fade over
  the 220 ms after it. Out of T2 the same, backwards: the bar first, then the box. Of a
  formation in contact the bar goes and comes with the box, PLAN 2.14f4, ADR-92: its elements
  stand at the block deployed against the enemy, up to 43 px from the marker. The box does
  not move: a marker stands on its formation's centre already. It shrinks by 13% and no more:
  see the ADR.)
- T2→T3: an element sprite cross-fades into its individual expansion, which is laid out inside
  the element footprint. (As built, PLAN 2.7b: a cross-fade over 250 ms.)
- *Formation tags at T2 and T3 (PLAN 2.14a, ADR-88; `src/render/units/tags.ts`, drawn on the
  overlay by `MapView`):* where the marker's box has given way to the elements, every formation
  with something in the view has a tag: its nation's flag, its strength, its name ("Infantry
  division 658": the template's name and the formation's id, derived in the view, not state).
  A tag stands above the part of its formation that is on the screen. Stronger formations are
  placed first; one that finds no place above, further out or below is left out and counted
  (`tagsLeft`). It does not stand under the war banners or the bottom bar (PLAN 2.14f2). The
  tag of the formation whose panel is open is framed and placed before any other (PLAN
  2.14f3). A click on a tag or on a formation opens the formation panel (§9).
- The map shader blends the detail layers by `z`, and border width is constant in screen px.

**Interest management.** Main sends `subscribe` whenever the camera moves (throttled to
10 Hz) with the bbox padded by 25%. The worker only includes elements/events inside it.
This never affects sim state (invariant I4).
*As built (`src/app/subscription.ts`, PLAN 2.7n2):* "moves" is judged by a key: the box rounded
to a step that is a part of the box itself (a 32nd to a 16th of its smaller half-size, less
than a third of the pad). While the key stands, the view is inside the box the worker has. The
step was a quarter cell at every zoom, which at 1 m/px is two and a half screens.

**Precision.** The CPU camera is in f64. Per frame (or per tile batch), choose an origin
and upload f32 positions relative to it. The vertex shader never sees absolute world coordinates.

**Rendering techniques.**
- Ownership: `R16UI` textures (owner, controller; tiled only if a size exceeds
  MAX_TEXTURE_SIZE) + a 256×256 palette `RGBA8` texture (nation and map-mode colours).
  Smooth borders (`src/render/map/mapShader.ts`): every distinct id in the 4×4 cell
  neighbourhood accumulates cubic B-spline weight (a C2-smooth indicator field). The max
  wins; the border is where the best and second weights meet, at a constant screen-px width
  (d / fwidth(d)). A bounded value-noise domain warp (≤ 0.32 cell) makes borders organic.
  Occupation hatching uses the same weights. With the ground of T2 and T3 the hatching gives
  way to it (PLAN 2.11f, ADR-82): by the ground's share the two stripes close on the tint
  between them, and an eighth of the hatching stays (`HATCH_AT_GROUND`).
  Since PLAN 1.28b the coastline comes from the 16384 × 8192 land mask:
  - The worker reduces it once to a 4096 × 2048 coverage texture (land fraction of each 4×4-bit
    block; `src/shared/landCoverage.ts`) and posts it with the terrain layer (`mapLayers`).
  - The shader samples coverage bilinearly: water at ≤ 0.5. Land the cell rule called water takes
    the strongest land id nearby (unclaimed land is neutral grey).
  - The coast line uses the coverage gradient; the cell-based coast lines are off once the fine
    layer is present.
  - *The coast of T2 and T3 (PLAN 2.9b2, ADR-79)* is the mask's own, four times as fine as the
    coverage. The mask's bits are a texture (R8UI, 2048 × 8192, eight pixels to a texel). The
    pass with the ground blends the four mask pixels round a fragment (the rule of
    `maskField`, `src/shared/landMask.ts`) and draws land over a half. Where the four differ, a
    noise of at most 0.35 × 4f(1 − f) moves the line (`SHORE_NOISE`; the ground's noise from
    its third octave down to a wavelength of 4 px): a shore at 1 m/px is not a ruler's edge.
    The picture can differ from the mask's bit only between four pixels that differ.
    - The two coasts cross-fade with the T1 ↔ T2 handover: each says land or sea, a pixel is
      land by as much as the two say by their shares, and each has its coast line by its share.
    - At T0 and T1 the coast is the coverage's, pixel for pixel as before.
    - The mask has lakes that the coverage has not; they are drawn at T2 and T3.
    - What stands on the ground (PLAN 2.8c) stands on sure land (`maskSure`), read on the CPU.
    - Without the texture (a GPU that takes none of 8192 px; land painted in the editor) the
      coast stays the coverage's, or the cells'.
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
  - *Coming and going:* a name is a switch like the others (the list at the head of this
    section), one for each nation. On a looping map the copies of a name either side of the
    seam share it: it is on when any copy is wanted (PLAN 2.7k, `fadeNationLabels`).
- Labels (original plan): MSDF font atlas. The curve comes from the worker's `derive/labels` (largest
  connected component → skeleton/PCA → quadratic Bézier, size by area), throttled
  and cross-faded on change.
- Units: one instanced draw per sprite atlas. Instance attributes are prev/cur pos,
  facing, frame, tint and alpha. The interpolation alpha is a uniform.
  *As built (PLAN 2.7h):* it is the time since the tick in hand arrived over the tick length,
  0–1 (`MapView.tickProgress`). Its clock starts with a new tick only: a snapshot that repeats
  the tick (a new subscription, a pause, another speed) goes on from the progress reached.
  A pause in a tick lets the sprites finish the step they are on, at the length the tick had,
  and then they stand where the tick has them (PLAN 2.7y: put there at once, every marching
  sprite jumped by the rest of its step). A tick that comes while the game is paused (a single
  step) or at full speed has no length: its progress is 1.
  The tint is the nation's own colour, lightened, in every map mode (PLAN 2.7i): the map's
  palette carries the mode's colours, the units do not, at any tier.
- Effects: GPU particle pools (muzzle, impacts, smoke, explosions, nukes). *As built (PLAN
  2.4a):* tracers, muzzle flashes and impacts are drawn with Canvas2D on the overlay; no pools yet.

**Performance budgets.** T0 ≥ 60 fps with 100+ nations at M size. T2 ≥ 30 fps with
10 000 visible proxies. Snapshot build ≤ 2 ms. Main-thread frame CPU ≤ 6 ms.
Sim tick ≤ 1.5 ms average (Node, M, 1938). Dev-GPU translation (ADR-4): T0 frame ≤ 1.0 ms
GPU and T2 frame with 10k proxies ≤ 2.0 ms GPU at 1080p on the bench machine (Phase 0:
0.46 and 0.41 ms). The map view redraws only when the camera, a snapshot or an
interpolation changes something, and once more after any frame that left a unit animation
unfinished, however late that frame comes (PLAN 2.7m): the end of an animation is what stays
on screen.

---

## 9. UI / UX

- **Layout** (parity with the VISUAL reference): left nation panel, Actions/Economy tab panel,
  right Statistics ranking, bottom bar (map modes, pause, God Mode, Statistics, speed,
  date, events counter, history log), and a war-banner strip of active wars.
- **Nation panel** (implemented PLAN 1.31a, `src/ui/NationPanel.tsx`): opens on the nation
  selected by a map click. Overview and Economy tabs; nation chips select. Data comes from the
  worker's `nationStats` message (every living nation + active wars, at most 1 Hz while ticks
  advance, and after init/load); real-map scenarios only.
- **Formation panel** (PLAN 2.14b, `src/ui/FormationPanel.tsx`): opens on a click on a
  formation, at any zoom that shows formations, where the nation panel stands. Its name and
  kind, whose it is (the chip leads to the nation panel), its men against a whole one's, its
  supply, whether it is in contact or on the march, its elements by unit type. The numbers are
  the sim's (`formation {id}`, §2.3), asked for again as ticks advance with the count of the
  first answer; the panel closes when the formation is gone, whether or not another has taken
  its id, and at a load (ADR-115). The formation is marked on the map while the panel is open.
- **Statistics ranking and war banners** (implemented PLAN 1.31b, `src/ui/StatsRanking.tsx`,
  `src/ui/WarBanners.tsx`, `src/shared/ranking.ts`): top-15 ranking (land, army, income,
  treasury, manpower) on the right, toggled by the bottom bar's Statistics button; one banner
  per active war (side leaders, ally counts, score bar) above the bottom bar, at most 8 + "+N".
  A click on a banner selects the attackers' leader and, when the war has a battle (gold
  swords; ADR-96), flies the camera to it at 20 m/px (`flight` in `render/camera.ts`: pan and
  zoom in one eased movement, ended by any camera input; ADR-91, ADR-94, ADR-95, ADR-97).
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
  section `world.names`; the empty name gives back the scenario's name or the founding
  province's, and is refused for a nation with neither: ADR-124), `declareWar`, `forcePeace`, `createAlliance`, `collapseNation` (God
  Kill: the nation dies, its land goes back to claimants or founds at most five nations, and
  no war starts: ADR-99), `reviveNation` (within the revival
  rules; refused with the reason: it lives, no other nation holds land it has a core on, no
  revival left, the cooldown: ADR-121), `spawnRevolt`, `forceBreakthrough`, `grantBuff`, `setAi` / `aiEnabled`,
  `setIncomeBonus`, plus the edits from 1.17–1.24. `sim.inspect()` returns a JSON world summary
  (tests, critic). Owned-cell counts (`nations.cells`) are maintained by `World.setOwner`.
  `spawnFormation {nation, x, y, strength, template?}` (PLAN 2.5, ADR-68): with a template of
  the scenario the formation has its elements and fights, as one from production does; without
  one it is a bare strength with no elements (the toy world). It has no button in the God tab.
  **A command that is not carried out says why** (PLAN 2.17a, ADR-117): `applyCommand` returns a
  `Refusal` (`shared/commands`), the tick emits `CommandApplied` or `CommandRefused` (b = the
  reason) after the command, the worker posts `{type: 'refused', reason}` to the page, and the
  God tab says it in words. Refused: a NaN or an infinity anywhere in a command; a dead nation
  where a living state is needed (a formation, control, land, an alliance, a puppet, a war); a
  nation that is not there. Ally with a nation in an alliance is refused; "Leave alliance" is
  the button for that.
- **Player control** (PLAN 1.33a, `src/app/player.ts`): "Take control" in the nation panel
  (`setPlayer`, saved as `settings.player`, so loads and resumed autosaves keep it) turns that
  nation's AI off (strategic, operational and economic AI all skip it) and makes map
  clicks player orders. A click on an own formation selects it (Shift toggles, Esc clears;
  rings on the overlay); a click elsewhere orders the selection to march there (into enemy land
  = attack). "Release control" turns the AI back on. The bottom bar shows the nation and count.
  The selection is of the played nation (ADR-116): each snapshot takes out of it an id that
  is gone or is another nation's by now (`MapView.selectionNation`), the bar's count
  follows, and a load empties it.
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
  The territory brush also paints on a left-drag (PLAN 1.44b): a disc at the press, then the
  way to every further cell the pointer enters; the right or middle button pans meanwhile.
  It gives the land to the selected nation, owner and controller (PLAN 2.17b, ADR-118): it
  sends the editor's `editPaint` on the nation layer (radius 5, no mask; `brush` with
  `stroke: 'start'` at the press, `line` with `stroke: 'more'` after). A stroke is one step
  of the editor's undo history; the keys of undo and redo work while the editor is open.
  God commands are sent with `now`: applied at once between ticks with the next step's tick
  stamp (`Sim.applyNow`), so they show while paused and replay identically.
  What the tab holds is its nation's (`src/app/hud.ts`, `GodTab.tsx`): the words of a refusal
  are shown only while the selection is the one the command was sent under, and go with any
  change of the selection or of God Mode (ADR-125); an armed Kill and a typed name are
  nothing on another nation's tab; a selected nation that the statistics list among the dead
  is deselected, and with no nation selected an armed territory brush is switched off
  (ADR-126).
- **God Mode**: rename; force war, peace, alliance or collapse; spawn a nation, revolt or battle;
  grant buffs; take control of a nation; disable AI globally or per nation; toggle nukes
  globally or per nation; grant warheads; force a strike. All of these are Commands.
- **Editor** (paint tools implemented PLAN 1.35, `src/sim/editor.ts`, `src/ui/EditorPanel.tsx`):
  - Commands `editPaint` (layer nation = owner + controller, or terrain; tool brush / line /
    bucket; radius ≤ 32; mask by terrain or nation), `editUndo` and `editRedo`.
  - The diff stack is world state (`edits.*` sections, ≤ 50 edits and 500 k cells), so a save
    plus a log with undos replays exactly.
  - A dead nation gets no cell from the history or an import (PLAN 3.4Ri) [ADR-146]: an undo or
    a redo that would write one writes the living nation the step says held the cell, else
    nobody; a controller that is dead becomes the owner. The step is kept as it was made.
    `importLayer` reads a dead nation's id as unowned, as an unknown one.
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
  - The random world (PLAN 2.16c) [ADR-110] is second on the list. Its picture is one random
    world (seed 7, 60 nations: `previewRandom`, `tools/data/preview.ts`), and the text says so.
    Its new-game form has a field for the number of nations (`ScenarioInfo.nationsRange`, 2 to
    200, 60 at first; Start only for a whole number in the range). The number is the game
    option `nations`, `?nations=N` in the URL, so it is in the autosave's record and in
    Continue, and the game's own new-game form starts from it. A world loaded without the
    number in its URL (a scenario file; a continue URL typed without it) gives the form its
    number of living nations, brought into the range (`setup` in `src/app/game.tsx`; ADR-111).
    The range is said once on the title screen, among the scenario's facts; the hint beside
    the field is the settings panel's.
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
  CE mode, and for the random world the number of nations (`nations`, §3.4). Applied once at
  init from the seed; carried in the URL
  (`looping=0&aggr=random&traits=random&gold=random|equal&ce=…&nations=N`). The type is
  `GameOptions` (`src/shared/gameOptions.ts`).
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
  scripted seamless zoom world → close (8 stops) on a battle of the scenario's own
  (`zoomDemo1938.spec.ts`, PLAN 2.10a; the spawned battle is `tiers1938.spec.ts`); tank, naval and air
  battle scenes; AI nuclear strike scene (seeded scenario with forced escalation
  conditions, AI-decided rather than God-forced); editor round trip; save/load.
  The test API is `window.__warsim`: now `sim` (SimClient: init/step/command/hash/save/load/
  speed/pause/subscribe/buildProvinces) and `view` (camera, controller.set/zoomTo, frames,
  draw); later `god(cmd)`, `fps()`. It exists only in a game, not on the title screen. URL
  options: `?scenario=1938|random|toy` (none = the title screen), `?seed=`, `?paused=1`,
  `?view=0`, `?continue=1`, `?load=scenario`, and the new-game options of §9 (`?looping=0`,
  `?aggr=`, `?traits=`, `?gold=`, `?ce=`, `?nations=N` for the random world).
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
  `--load f` continues from it (bit-identical saves: tested on the toy world, and late in 1938 games: PLAN 2.12). `npm run diag`
  prints wars and great-power state at chosen years, from 1938 or from a checkpoint.
  `npm run sweep:quick` (10 seeds × 20 years, report in `.cache/sweep/reports`) is for tuning:
  it is judged by the limits and reports riser and faller without a verdict (ADR-54).
- **Parity** (`npm run parity`, `tools/parity`): parses `docs/PARITY.md` (Table 1 scored: verified 1,
  partial 0.5; Table 2 validated), checks the column layout, consecutive row numbers, a dated
  `[TEXT|VISUAL|TEXT+VISUAL YYYY-MM-DD]` tag on every AoC behaviour, and that every backticked
  evidence path of a verified row exists. Fails if the generated header score line disagrees;
  `npm run parity -- --write` regenerates it. Tools run TypeScript through `tsx`.

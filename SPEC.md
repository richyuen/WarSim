# WarSim — Specification & Architecture

Status: v0.1 (2026-10-02). Living document: update when decisions change and
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
src/sim/core/      world tables (SoA), ids, rng, dmath, hash, serialize, time
src/sim/systems/   economy, production, supply, movement, engagement, combat,
                   territory, diplomacy, revolts, naval, air, nuclear, buffs, history
src/sim/ai/        strategic, operational, economic, nuclear
src/sim/data/      zod schemas + loaders + map rasterizer
src/sim/tick.ts    tick orchestration (fixed order, §2.5)
src/sim/sim.ts     Sim facade (init/step/command/hash/save/load) used by worker, Node and tests
src/sim/world.ts   World: cell layers, entity tables, RNG, command log (all serialized)
src/shared/        protocol.ts (messages, snapshot layout), commands.ts (Command union), constants, enums
src/worker/        entry, scheduler (speed/pause), snapshot builder, pools, derive/
src/render/        gl helpers, camera, map/, units/, fx/, labels/, lod/
src/ui/            panels, i18n/{en.json}, theme
src/editor/        paint tools, undo stack, flag editor, scenario IO
src/app/           bootstrap, input, settings, autosave, screenshot, __warsim test API
tools/             data/, headless/, soak/, sweep/, parity/, bench/
data/              units/, tech/, traits/, buildings/, scenarios/1938/, maps/earth/
public/data/       generated map assets + manifest.json (sha256)
tests/unit, tests/e2e
```

### 2.3 Worker protocol (`src/shared/protocol.ts`) [ADR-2]
Main → worker:
- `init {scenarioUrl | scenarioBytes, mapSize, seed, settings}`
- `cmd {cmd: Command}`: applied at the next tick boundary, stamped with that tick,
  and appended to `commandLog`.
- `speed {ticksPerSecond | 'max'}`, `pause {paused}`, `step {n}`
- `subscribe {bbox: [x0,y0,x1,y1] (world units, wrap-aware), z, tier, wantsElements}`
- `ack {snapshotSeq, returnedBuffers: ArrayBuffer[]}`: rAF handshake + buffer pool return
- `save`, `load {bytes}`, `requestHistory {filter}`, `requestStats {kind}`

Worker → main:
- `snapshot {seq, tick, tickFrac, buffers}` (transferable; layout in §2.4)
- `saved {bytes}`, `history {rows}`, `stats {series}`, `error {msg, stack}`

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
```
 1. apply queued commands (sorted by arrival seq)
 2. AI: operational (every 6h, staggered by nation id), strategic & nuclear (daily, staggered)
 3. production / research (daily) · economy (monthly on day 1, 00:00)
 4. supply network refresh (daily) · supply consumption (hourly)
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
Every system is a function `(world, ctx) => void`. `ctx` holds RNG streams and the
event sink. Systems never read wall-clock time, render state or subscriptions.

### 2.6 Determinism [ADR-5]
- Numbers: f64 using only `+ − × ÷`, `Math.sqrt`, `Math.floor/ceil/round/abs/min/max/
  trunc/imul/fround` (all exactly specified by ECMAScript). Trig, exp, log and pow come from
  `dmath` (table + polynomial, identical in every engine).
- RNG: PCG32 implemented with `Math.imul` and 32-bit ops. One stream per subsystem
  (`combat`, `ai`, `diplomacy`, `revolt`, `weather`, `nuclear`, `naval`, `air`,
  `scenario`) is seeded by `hash(seed, streamId)`, so a new subsystem doesn't perturb
  existing ones. Order-independent draws use `hash32(seed, tick, entityId, salt)`.
- Iteration is always in ascending id order. Entity ids come from free lists in
  deterministic order. `Map`/`Set` are allowed only with insertion order derived from id order.
- **State hash**: xxhash32 over every authoritative typed array, scalar globals,
  RNG states and the tick. Events and derived outputs are excluded.
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
- Settings (speed, paused, UI size, locale, unit size, map mode, etc.): localStorage.

---

## 3. World model & data schemas

### 3.1 Coordinates & map [ADR-1, ADR-7]
- Projection: **Miller cylindrical**, latitude cropped to about 80°N … 60°S. World units
  are projected km at the equator (`W_km ≈ 40 075`). `x` wraps when `loopingMap` is on.
- The grid has `W×H` cells. Sizes: S 1024×512, **M 2048×1024 (default)**, L 4096×2048,
  XL 6144×3072. Sim memory budget at XL is ≤ 160 MB.
- Per-row scale table `kx[y]` and `ky[y]` (projected → true km) is used for movement speed,
  ranges, blast radii and per-cell area (economy weight).
- **Fine land mask** (static): 1-bit 16384×8192 from Natural Earth 10m land. It is used by
  the sim for element placement and naval passability at sub-cell scale, and by the
  renderer for coastlines. Both read the same bytes, so they never disagree.
- Elevation: ETOPO 2022 downsampled to a 4096×2048 u16 pyramid for hillshade and
  terrain derivation.

### 3.2 Cell layer (SoA, length W·H)
| field | type | meaning |
|---|---|---|
| owner | u16 | rightful owner (nation id, 0 = none/water) |
| controller | u16 | current controller (occupation when ≠ owner) |
| terrain | u8 | enum: WATER, CROSSING, PLAINS(basic), GRASSLAND, FOREST, HILLS, MOUNTAINS, DESERT, TUNDRA, MARSH, URBAN, ICE |
| province | u16 | province id (0 = water) |
| flags | u8 | COAST, RIVER, FALLOUT(level 0–3 in 2 bits), FORT, ... |
| pressure | i16 | transient, frontier cells only (stored in a sparse frontier table, not a full array) |

Terrain table (`data/terrain.json`): moveCost per mobility class (foot, motor,
tracked), defence modifier, attack modifiers per unit class, supply attrition,
econ weight, colour.

### 3.3 Provinces, cities, sea zones, air zones
- **Province** (`data/maps/earth/provinces.json` + raster): id, name key, admin-1
  source id, centroid, cell count, area km², terrain mix, `cores: nationId[]`,
  `buildings {industry, fort, airbase, port, navalBase, aa}`, population, unrest,
  revolt state, devastation.
- **City**: id, name key, province, position, size, `isCapitalOf`, industry,
  population. It counts as a victory point, and capture events are logged.
- **Sea zone**: id, name key, polygon (cells), lane graph nodes, adjacency, control per side.
  Built as a Voronoi over water seeded by named seas (Natural Earth marine
  polygons) and then subdivided.
- **Lane graph**: nodes at sea-zone centres, ports and straits. Edges carry distance and
  `crossing` (AoC-style land-unit-walkable lanes, editable).
- **Air zone**: a cluster of about 8–20 provinces. Air superiority is tracked per side per zone.

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
### 3.5 Diplomacy
- **War** {id, attackers[], defenders[], leaders, goal, startTick, warScore,
  exhaustion per side, fightToDeath per side}
- **Alliance / union** {id, nameKey, members[], leader, unity 0..100, loyalty per
  member}. Low unity → members leave and the alliance can dissolve.
- **Puppet** relation {overlord, subject, autonomy 0..100, integration progress}.
  Puppets can be created (peace term or God Mode), released, integrated, or revolt.
- **Buff** {id, target (nation|formation|province), kind, magnitude, expiresTick}.

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
  terrainMods {[terrain]: {atk, def, speed}}; techReq?; sprite {atlas, frames}
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
- **Slotted pose** is `slotPose(formation, slot, aliveMask)`, a pure function. It is the same
  code in the sim (for engagement start positions) and in the snapshot builder.
- **Engaged pose** is integrated per tick inside a battle (advance or withdraw toward
  a target or cover, clamped to passable fine-mask terrain).

### 3.7 Tech & production
`data/tech/*.json`: tree with eras 1936–1990+. Research is per nation, daily, funded
by gold and industry. Tech gates unit types (tank generations, jets, radar, missiles,
nuclear programme stages). Production queue per nation (AI-managed or player):
items take days and draw gold, industry and manpower. Upkeep runs monthly.

---

## 4. Territory, fronts and the strategic layer

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
- **Capital capture**: the war score jumps, the capital relocates to the largest owned city, and with
  the `winnerTakesAll` setting the capturer annexes all of the loser's controlled territory.
- **Cores**: provinces list core nations. Revival spawns a dead nation from its cores
  (finite `revival.remaining`, `cooldownUntilTick`), seeded with garrison and
  militia formations.
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

### 5.3 Combat-efficiency modes (global setting, AoC parity)
- **dynamic**: efficiency drifts with experience, supply and recent wins/losses.
- **progressive**: efficiency grows slowly over time for every nation.
- **static**: per-nation value from the scenario, constant.
- **locked**: all nations at 1.0.
- **random**: per-nation random walk (hash-seeded), re-rolled yearly.

### 5.4 Major Battles
When total committed strength in a battle exceeds a threshold (relative to the
local front), the battle becomes **Major**. It gets a name (nearest city), a war-banner UI entry
and a history-log entry. The winner gets a **breakthrough corridor**: a temporary pressure
multiplier along the attack axis for D days that pierces the front. Losses on both sides
are amplified. At strategic zoom this shows as a pulsing marker with crossed swords.

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
- **Operational AI** (every 6 h): assigns formations to fronts proportionally to
  threat, keeps reserves, launches offensives at local superiority ≥ k (with armour
  spearheads), sets defensive postures, tasks fleets (sea control around coasts, convoy
  escort, raiding, invasion), tasks air wings (superiority over active fronts, CAS on
  Major Battles, strategic bombing when superiority is high).
- **Economic AI** (daily): a budget split between army, navy, air, industry, research, nukes,
  revolt suppression and reserve gold. The production mix is adapted to enemies (AT vs armour-heavy
  enemies, fighters when bombed).
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
- Ownership: tiled `R16UI` textures (owner, controller) + palette `RGBA8` texture
  (nation colours, map-mode colours). Smooth borders come from sampling a 3×3 neighbourhood
  and computing a signed distance to the same-owner boundary with bilinear
  interpolation of indicator fields, plus bounded domain-warp noise (< 0.5 cell).
  The coastline comes from the fine land-mask pyramid.
- Map modes are palette swaps or derived per-province textures (no reupload of the cell grid).
- Labels: MSDF font atlas. The curve comes from the worker's `derive/labels` (largest
  connected component → skeleton/PCA → quadratic Bézier, size by area), throttled
  and cross-faded on change.
- Units: one instanced draw per sprite atlas. Instance attributes are prev/cur pos,
  facing, frame, tint and alpha. The interpolation alpha is a uniform.
- Effects: GPU particle pools (muzzle, impacts, smoke, explosions, nukes).

**Performance budgets.** T0 ≥ 60 fps with 100+ nations at M size. T2 ≥ 30 fps with
10 000 visible proxies. Snapshot build ≤ 2 ms. Main-thread frame CPU ≤ 6 ms.
Sim tick ≤ 1.5 ms average (Node, M, 1938).

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
- **QoL**: keyboard (WASD/arrows pan, +/- zoom, space pause, 1–5 speed), drag,
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
- **Headless runner** (`tools/headless`): `npm run sim -- --scenario 1938 --seed 7
  --years 30 --out run.json` (metrics per year).
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
  The test API is `window.__warsim` (`seed`, `pause`, `step(n)`, `camera.zoomTo(x,y,z)`,
  `god(cmd)`, `hash()`, `fps()`).
- **Bench** (`npm run bench`): headed Chromium with GPU. T0 and T2 fps, tick ms,
  snapshot ms. Results go to `docs/bench/*.json`.
- **Gate** (`npm run check`): `tsc -b` → `eslint .` → `vitest run` → `vite build` →
  `playwright test` (against `vite preview` of the build) → `npm run parity`.
  Must be green before every commit.
- **Parity** (`npm run parity`, `tools/parity`): parses `docs/PARITY.md` (Table 1 scored: verified 1,
  partial 0.5; Table 2 validated), checks the column layout, consecutive row numbers, a dated
  `[TEXT|VISUAL|TEXT+VISUAL YYYY-MM-DD]` tag on every AoC behaviour, and that every backticked
  evidence path of a verified row exists. Fails if the generated header score line disagrees;
  `npm run parity -- --write` regenerates it. Tools run TypeScript through `tsx`.

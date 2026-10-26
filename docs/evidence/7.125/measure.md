# PLAN 7.125: a load's first ticks — measured and fixed

2026-10-26, HEAD `e84bbde2` (pin 3a90f72d). The save remade on HEAD: `npm run sim -- --scenario 1938 --seed 8167
--years 18 --save .cache/7125/s8167_y18.bin` (final hash 7a7c5698). Every read alone, in a new process. Tools:
`tools/diag/tickMax.ts` (each hour timed alone; now also the load's own ms), `tools/diag/tickProf.ts` (new: the
inspector's CPU profile of chosen ticks after a load), `tools/diag/simInitMs.ts` (new: a new 1938 `Sim`, timed).

## 1. HEAD, cold (`tickMax.ts 8167 <save> 240`)

Over 200 ms **2**: day 2 hour 0 **460 ms** (invasion AI 437), day 0 hour 0 **305 ms** (operational AI 169, nuclear 37,
supply 37); then day 4 hour 0 155 ms (the month's economy).

## 2. What they build (`tickProf.ts 8167 <save> 0,48`)

- **Day 2 (482 ms profiled):** `invasionAi → planNormandy → orderLanding → orderSail → laneOf → buildLaneGraph`
  436 ms, of it `seedDistances` 405 ms: the lane graph's search over every sea cell from the zones' seeds. Built of
  the static layers alone, cached on the world and kept across loads of the same map (ADR-279), so it is built once a
  process, at its first sail order: in a load's day 2, and in a new game's mid-play.
- **Day 0 (318 ms profiled):** `operationalAi → frontierOf → borderBits → scanBorder` 137 ms (the border index, not
  saved, made again by a scan of the 2,097,152 cells; the cell's test a closure made per cell, and under tsx each
  wrapped by `__name`: 68 ms self, and a 52 ms `TextDecoder` frame gone with it); the air zones' first build 25 ms
  (`nuclear → bomberIntercept → airOf`), the coasts 9, crossings 8, sea basins 7.

## 3. The change (pin and hash kept)

- `scanBorder` / `onBorder` (`src/sim/border.ts`): the cell's test inline, the scan row by row. Day 0's scan
  137 → 6.7 ms (profiled).
- `buildMapCaches` (`src/sim/world.ts`): the lane graph, air zones, basins and ports' waters built by `Sim.load` (a
  cache of the same map is kept: a load after a new game in the same process builds nothing), on a world
  `createWorld1938` keeps as a template (the unit tests: once a file, not once a checkpoint load), and by the worker
  after it answers an init (`warmLanes`, PLAN 4.8e / ADR-288, which built the lanes alone there: so in the page a new
  game had no lane stall, and its reply still comes first). Not in `Sim`'s constructor: that would hold the page's
  reply 0.45 s. Each is of the static layers alone (ice from `ice.json`, not seasonal), so its content does not
  depend on when it is built: `mapCaches1938.test.ts` (red on HEAD: the lanes null after a load) holds the graph a
  load builds equal to one built at first use.

## 4. After, cold (the AT: every tick of the first 10 days at most 200 ms)

| read | load ms | over 200 ms | over 100 ms | longest (ms) |
|---|---|---|---|---|
| cold, 1 | 501 | **0** | 2 | 150.1 (day 4, economy), 133.1 (day 0), 58.8 |
| cold, 2 | 495 | **0** | 2 | 151.1 (day 4), 133.3 (day 0), 59.3 |

Day 2 hour 0: 460 → 33 ms. The AT is met: the worst tick of the first 10 days 151.1 ms (bar 200). (A first try
built the caches in `Sim`'s constructor: load 44 ms, the same ticks, 141–148 ms worst over three reads; `new Sim`
680 → 1,135 ms by `tools/diag/simInitMs.ts`. Dropped for the page's reply, above.)

## 5. Where the cost went

Into the load: 44 → ~500 ms in a new process, once (the page's worker has them built after its init's reply). A
headless new game with no load still builds the lanes at its first sail, as before (the worker's does not).

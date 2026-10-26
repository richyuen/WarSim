# PLAN 7.119: the stalls at Max — measured on HEAD

2026-10-26, HEAD `d826e6fd` (sim code of `c95202e7`, pin 3a90f72d). The critic's save (`critic/c14_seed8167_y18.bin`)
is of `311988d7`'s rules; remade from seed 8167 (`npm run sim -- --seed 8167 --years 18 --save`). New tools:
`tools/diag/maxStalls.ts` (the page at Max from a save, the critic's gap measure) and `tools/diag/tickMax.ts`
(headless, each hour timed alone, the costliest systems of the slow ones; `warm`: the engine warmed first).
Every read alone.

## 1. The page (8167's year 19 at Max, the production build)

| read | wall s | fps | gaps over 500 ms | over 250 ms | longest 4 (ms) |
|---|---|---|---|---|---|
| the critic (`311988d7`) | 141.8 | 58.2 | **40** | — | 702, 701, 701, 700 |
| HEAD, first | 31.2 | 59.7 | **0** | 0 | 158, 142, 141, 139 |
| HEAD, again | 31.2 | 59.7 | **0** | 0 | 162, 161, 140, 139 |

## 2. Headless (8167's year 19 from the save)

- `npm run sim -- --profile` (the critic's measure: the longest call of a system): operational AI **166.3 ms**
  (the critic's 610.9), every other system at most 66.8; mean tick 2.61 ms (13.3).
- Whole ticks, `tickMax.ts`, a new process: over 200 ms **2**, both just after the load: day 2 hour 0
  **426 ms** (the invasion AI 404: its first run in the process; with the engine warmed it is not there) and
  day 0 hour 0 295 ms (the operational AI 166: the first tick after a load, its route refusals and frontier not
  saved). Then 143 ms at most (day 4, the month's economy).
- Warmed (`warm`: 10 days stepped, the save loaded again): over 200 ms **1**, the first tick after the load
  (231 ms, the operational AI 160); every other tick of the year at most 122 ms.

## 3. The Large map, read alone

Seed 3001, `size=L`, 1938 from its start, year 1 at Max: **59.5 s** (the critic's 2.5 min was read beside a
batch), 59.5 fps, 2 gaps over 500 ms (608, 519), 35 over 250.

## 4. Reading

In the page the bar (at most 4 stalls over 500 ms) is met with none. Headless, the critic's own measure reads
166 ms (bar 200); whole ticks over 200 ms are only the first after a load (231 ms) and, in a new process, the
invasion AI's first run (426 ms). In play no tick passes 143 ms.

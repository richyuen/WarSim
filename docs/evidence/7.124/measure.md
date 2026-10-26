# PLAN 7.124: the orders' refused searches — measured, the change, the AT

2026-10-26, HEAD `3c579e67` (sim code of `c95202e7`: ADR-703's far-march wait committed, pin 3a90f72d). Timings
`npm run sim -- --profile`; "alone" pinned (`--affinity 0xFFFF`) with nothing else running; "screen" eight at once,
one P-core each (≈ 1.13 × a paired read). New tool `tools/diag/asksWhy.ts` (every ask that searched and was not
'ok', by its answer, its ground, and why the refusal kept did not answer it; `EXAMPLES=n`, `WHY=`).

## 1. The case

1021's year 6 from a year-5 save: **9.33 ms** a tick alone (hash 81b7a22e), the operational AI 7.13. `asksWhy.ts`
over the year: 34,280 asks, 47.2 s timed, of which:

| refused, open ground to an open goal | asks | s |
|---|---|---|
| a corridor's refusal kept, voided by a province's `open` changed (anywhere) | 3,904 | 22.8 |
| the same, by a province's `shut` changed outside the corridor | 1,438 | 8.5 |
| a corridor's refusal kept for another goal (`other cell`) | 1,061 | 6.3 |
| none kept | 796 | 4.4 |

Each a search of 5.6–6.0 ms that is refused again. The 'other cell' ones: formations in one large province on an
ally's ground (node 2368, Finnish cells), each plan sent to a slightly other cell of the enemy's in the same province,
~35 cells off, which the cells do not reach.

## 2. The change (`change.patch`, not committed; the rules kept: the pin and 1021's hash unchanged)

1. A corridor's refusal (PLAN 7.30b) whose passage's `open` or `shut` changed: the route over the provinces is planned
   again (`openRoute`, the route `searchRoute` would take); while it is the same, the corridor and the cells searched
   are the same, and the refusal holds (the flips that open a corridor cell are read as before).
2. Within the operational AI's run (no cell changes hands), the cells a refused corridor search reached are kept
   (`keepRegions`, at most 16): from a cell of such a region to a goal outside it, with the same ends' provinces,
   mobility and passage, the search would reach the same cells and is refused with none. A search from open ground
   reaches open cells only, and a step between them goes both ways.

Unit case `tests/unit/refusedRegions1938.test.ts` (in the patch): red on HEAD (a search made again; no
`keepRegions`), green with the change. The pin test green; the unit suite by hand 1,913 of 1,914 (the 1938 world's
build-time test read 2,005 ms against 2,000 beside the suite, green alone).

1021's year 6 alone: 9.33 → 5.66 ms (part 1) → **4.85 ms** (both), hash 81b7a22e each time; the asks' timed
seconds 47.2 → 15.5 (part 1).

## 3. The AT (1031–1040 × 25 years)

Clause 1: 1021's year 6 alone **4.85 ms** (met). Clause 2: the screen, then each year over 5.0 alone:

| seed | screen over 5.0 | alone |
|---|---|---|
| 1038 | y25 6.11, y21 5.98, y23 5.38 | y25 **5.43**, y21 **5.07**, y23 4.64 |
| 1037 | y17 5.87, y20 5.35, y22 5.29 | y17 **5.02**, y20 4.62, y22 4.55 |
| 1034 | y16 5.31, y20 5.02 | y16 4.61, y20 4.39 |
| 1031 | y24 5.18 | y24 4.61 |

The other six seeds at most 4.93 on the screen. **Missed** by three world-years of 250 (5.02–5.43). 1038's year 25 on
HEAD's code alone: 5.41 ms (the same history): those years are not the refused searches' (the operational AI 3.0 ms
of plans at large); the change neither helps nor costs there.

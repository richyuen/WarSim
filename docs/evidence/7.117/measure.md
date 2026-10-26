# PLAN 7.117: the late tick over its budget — measured, and the rule

2026-10-25, HEAD `ba5d78c3` (sim code of `1cbc0bf3`, pin e28dbfa1). Budget (ADR-698): at most 5.0 ms a tick in any year.
Timings `npm run sim -- --profile`; "alone" = pinned (`--affinity 0xFFFF`) with nothing else running; "paired" = two
runs at once on separate P-cores (0x00FF, 0xFF00); "screen" = eight at once, one P-core each (0x3 … 0xC000).

## 1. The critic's case on HEAD's rules

The critic's saves (`critic/c14_seed8167_y18.bin`) are of `311988d7`'s rules; ADR-701 a's fold moved the history.
Remade from seed 8167 (`npm run sim -- --seed 8167 --years 18 --save`), then year by year, alone:

| 8167 year | 19 | 20 | 21 | 22 | 23 | 24 | 25 |
|---|---|---|---|---|---|---|---|
| tick ms (HEAD) | 4.75 | 4.68 | 4.19 | 3.04 | 3.01 | 4.68 | 5.03 |
| operational AI | 2.78 | 2.63 | 2.07 | 1.14 | 1.31 | 2.18 | 2.68 |

The critic's 13.3 ms (year 19) is not HEAD's: under the budget there, 5.03 at year 25.

## 2. Fresh seeds on HEAD (1011–1020 × 25 years; these seeds went to the screen, not the AT)

Screen, the worst year a seed: 1011 y23 5.19, 1012 y15 4.15, 1013 y16 5.26, **1014 y22 8.05**, 1015 y19 4.94,
**1016 y24 7.62**, 1017 y22 4.29, 1018 y17 5.16, 1019 y18 5.68, 1020 y5 5.15. Paired re-reads (the same histories): 1014
y22 **7.04**, y23 5.61, y24 6.34; 1016 y23 5.09, y24 6.61, y25 4.94 (the screen reads ≈ 1.13 × paired). Alone from a save
of 1014 year 21: year 22 **6.86 ms**, the operational AI 4.92 of it.

## 3. Where the operational AI's time goes (`tools/diag/opCalls.ts`)

1014 year 22, all 365 days from the year-21 save: 5.13 ms a tick (the probe's clock on); by part fromAfar 60.4 %,
classes 21.0 % (`groundOf` 3.9 M calls, 8.4 s), reserveThreat 7.7 %, sectors 5.6 %. The marches from afar's asks:
**4,432 refused of 4,711**, each a search of the whole way that fails, 5.0–5.9 ms (mean 250–350 cells apart), 24.8 s
of the year's 44.9 s. The refusal kept (`World.refusedOrders`) is voided by any open/closed flip on the map ("mixed
flips", "other cell"), so each far formation's search is made again on its day in MARCH_DAYS. `farAsks.ts`: in every
plan with far formations (98 of 98 in 20 days) the empty sectors outnumber them, so a formation held back is an ask
saved, not one handed to the next formation.

8167 year 25 (60 days): classes 47 % (`groundOf`); of its ground reads in a tick, 38 % repeat one of the same tick and
passage (a cache within the tick would save ≤ 0.25 ms a tick: not taken).

## 4. The rule (ADR-703)

A formation whose march from afar or to spare is refused is given none so again for FAR_RETRY_DAYS (40) days, saved
as `World.farWait` (an optional section; an entry goes with its formation in `destroyFormation`, and when read past
its day). The allotment, the orders and the marches of formations near the front are as before.

From the save of 1014 year 21, year 22 alone: HEAD **6.86 ms** (operational AI 4.92) → rule **4.63 ms** (2.61).
Pin e28dbfa1 → 3a90f72d. Unit case `tests/unit/farWait1938.test.ts` (seed 99: the first formation refused, day 117,
waits 40 days with no order refused; saved and loaded; gone with its formation): red on HEAD, green with the rule.
The unit suite by hand: 1,912 green.

# PLAN 7.61: a land-based wing's strike sinks a whole fleet at once (found at 7.60)

Before: HEAD `1fe30f82` (ADR-605 in: the carriers pick, the land-based wings spread). After: the rule
(ADR-606). Read by `tools/diag/carrierSink.ts` (its `land` block: strikes of wings based on land,
`strikes`, PLAN 5.4c). The before figures are `docs/evidence/7.60/y1-summaries.json`'s `after-*` and
`war-8693-after.json`'s `land`, taken on `1fe30f82`'s code; PLAN 7.61's "478 of 575" and "24 of 24"
were read at `f8a8c44f`, before ADR-605 (the worlds differ once carriers sink otherwise).

## 1. The rule

`strikes` spread each squadron's fire over every target element in reach by health (strength × hit
points), ships and the land's alike. Now the ships among the targets make a table by health, and a
squadron's share of its fire on them (their health of the whole) × `shipEffectiveness` ×
`NAVAL_STRIKE_FIRE` goes on one ship, picked by hit points with a seeded draw (`pickByHealth`, salt
`SALT_STRIKE_SHIP`; the carriers' pick and the guns' use the same function, moved out of
`navalCombatSystem`). The land's targets take the same share as before, by the same arithmetic: a
strike on land alone is bit for bit as it was; on a cell of ships and the land both, the land's
elements take what they took. What a squadron puts on a ship beyond what it has left is lost
(`applyLoss`), as a gun's. The bombs on the page (`StrikeHit`) fall on the formations hit, so on the
fleets of the picked ships.

## 2. The AT's figures

| figure | bar | before | after | |
|---|---|---|---|---|
| 4 seeds × 1 year: ships land-based strikes sank with their whole fleet in one strike, of theirs | under 25 % | 390 of 431 (90 %) | **90 of 586 (15 %)** | met |
| 8693 JAP → USA, 20 days: land-based strikes that sank over half of a fleet with none lost before | 1 or fewer | 3 | **0** | met |
| a land target's spread | as before | | `airStrike1938.test.ts` (exact, unchanged) passes | met |

| seed | land-based strikes, before → after | sunk | whole-fleet ships | over half, untouched |
|---|---|---|---|---|
| 1129 | 437 → 438 | 47 → 120 | 43 → 21 | 3 → 0 |
| 2081 | 1,633 → 695 | 183 → 177 | 170 → 24 | 15 → 0 |
| 7019 | 180 → 256 | 61 → 125 | 61 → 14 | 6 → 0 |
| 8693 | 858 → 572 | 140 → 164 | 116 → 31 | 7 → 0 |
| all | 3,108 → 1,961 | 431 → 586 | 390 → 90 | 31 → 0 |

A "strike" is a fleet struck in an hour: before, every fleet in the cell; after, those the picks hit,
so the counts are not of the same thing. The worlds drift apart after the first strike.

8693's war, after (hour: fleet, ships before → sunk): 76: 1239 8 → 3; 84: 5 → 2; 92: 3 → 3; 100:
1126 8 → 1, 1127 8 → 2; 108: 7 → 1, 6 → 2; 116: 6 → 2, 4 → 1; 124: 4 → 3, 3 → 2; 132: 1 → 1, 1 → 1.
The same 24 ships, sunk over 56 hours in 13 strikes; before, 3 strikes sank, each 8 of 8 (hours 84 and 124), after seven that sank nothing.
Carriers there unchanged (66 sunk, 1 over half: ADR-605's lone flotilla).

`war-8693-after.json`, `y1-summaries.json`.

## 3. Tests

- `strikePick1938.test.ts` (new): 8693 JAP → USA, the first land-based strike that sinks a ship of a
  fleet leaves it afloat. Red without the rule (hour 84: 8 of 8), green with (hour 76: 3 of 8).
- `navalStrike1938.test.ts`: the Italian naval bomber group's exact damage on a British fleet
  restated for the pick (it was the spread), as ADR-605 restated `carrierAir1938.test.ts`.
- `airStrike1938.test.ts`: the land's exact spread, unchanged, passes.
- Pin 076aae87 → a2ae195b.

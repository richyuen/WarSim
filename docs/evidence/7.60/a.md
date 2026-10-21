# PLAN 7.60: a carrier's strike sinks a whole fleet at once (found at 7.57)

Before: HEAD `f8a8c44f`. After: the rule (ADR-605). Read by `tools/diag/carrierSink.ts`, which now
also counts the strikes that sank the whole fleet they struck (`wholeFleetStrikes`, its ships
`wholeFleetShips`) and the strikes that sank more than half of a fleet with none of its ships lost
before (`overHalfUntouched`; a fleet's ships when the tool first saw it).

## 1. The rule

A carrier's wings strike once in `CARRIER_CYCLE` (4) hours (PLAN 5.4d). Before, each squadron's fire
(its aircraft × `shipEffectiveness` × `NAVAL_STRIKE_FIRE`) was spread over every enemy surface ship
in reach by hit points: alike ships took the same wound, carried, and reached a whole ship in the
same hour. Now each squadron puts its whole fire on one ship, picked by hit points as a ship's gun
picks its target (`pick`, a seeded draw, its own salt). The mean damage is the same (the pick's
weights are the spread's shares); what a squadron puts on a ship beyond it is lost, as a gun's.
The bombs on the page (`StrikeHit`, `AirStrike`) fall on the fleets the picks struck, not on every
fleet in reach.

## 2. The AT's figures

| figure | bar | before | after | |
|---|---|---|---|---|
| 8693 JAP → USA, 20 days: carrier strikes that sank over half of a fleet with none lost before | 0 | 8 | **1** | missed |
| 8693 JAP → USA, 20 days: ships carriers sank | 48–80 (64 ± 25 %) | 64 | **66** | met |
| 4 seeds × 1 year: ships sunk with their whole fleet in one strike, of the carriers' | under 25 % | 594 of 853 (70 %) | **126 of 1,083 (12 %)** | met |

`war-8693-before.json`, `war-8693-after.json`, `y1-summaries.json`.

The one strike over half (hour 449): American flotilla 1101, eight destroyers, the only fleet in
reach of Japan's group 1130's two wings: six squadrons put 6.4 ships of fire on it (before: 0.8 on
each ship, none sunk; four hours later all eight). Six picks, one on a ship already picked: 5 of 8
sunk. Any rule that keeps the strike's fire sinks 5 or more of a lone flotilla under 6.4 ships of
it; under the bar only by less fire, which is tuning (ADR-554: not done; BLOCKERS, the user's).

The war's sinkings, strike by strike (hour: ships of the fleet, sunk), after: 329: 8 → 2 and 8 → 3;
333: 5 → 4, 6 → 1; 337: 5 → 3; ... ; before: three strikes of nothing on each flotilla, then 8 of 8.
The war now has 9 sea battles (6 before): a flotilla under half its ships breaks off (PLAN 7.31) and
meets the enemy again; before, none lived to break off.

## 3. 4 seeds × 1 year (`carrierSink.ts <seed> - - 365`, no declared war)

| seed | carrier strikes, before → after | sunk | whole-fleet ships | over half, untouched |
|---|---|---|---|---|
| 1129 | 154 → 95 | 95 → 185 | 26 → 24 | 1 → 7 |
| 2081 | 392 → 311 | 364 → 376 | 237 → 49 | 26 → 6 |
| 7019 | 242 → 513 | 232 → 309 | 195 → 24 | 19 → 5 |
| 8693 | 93 → 136 | 162 → 213 | 136 → 29 | 11 → 4 |
| all | 881 → 1,055 | 853 → 1,083 | 594 → 126 | 57 → 22 |

A "strike" is a fleet struck in an hour: before, every fleet in the wings' reach; after, those the
picks hit, so the counts are not of the same thing. The worlds drift apart after the first strike (the
fleets that live sail and fight on), so a seed's year is not the same war before and after; 1129's
over-half count rose (1 → 7) with its carriers' sinkings (95 → 185).

## 4. Found: a land-based wing's strike on a fleet (PLAN 7.61)

`strikes` (PLAN 5.4c) spreads a land-based wing's fire on a fleet the same way. On the same runs,
before: of the ships it sank, those with their whole fleet in one strike 43 of 75, 149 of 167, 109
of 134, 177 of 199 (478 of 575, 83 %); the 8693 war 24 of 24 (3 strikes, all 8 of 8). Not changed
here (one cause a commit).

# PLAN 7.89: a formation aboard no longer holds the ferry's turn

Run 12's saves (`critic/c12_seed*.bin`), HEAD `704b44a5` against the rule (ADR-643). Closed not
done: the piles 2 → 2; the lift is too small for 1129's army (PLAN 7.90).

## 1. The rule

`invasionAi` (`ai/invasion.ts`): PLAN 4.6b's lock skipped a nation's whole turn (landing,
Normandy, ferry) while any formation of its was aboard. Now it holds the landing and the Normandy
only while a landing is at sea (a formation aboard for a cell held by a nation at war with it),
and the ferry takes its turn in any case. A transport group that gave an order is under way, so
the next turn's groups are others (`transportGroupsAtPort` takes none that moves).

## 2. The piles (`tools/diag/piles.ts`, 30 days; `piles_*.json`)

| save | HEAD (`docs/evidence/7.88/b.md`) | rule |
|---|---|---|
| 1129 year 10 | USA 60 at 625163, 49 at 746057 | USA 60 at 625163, 53 at 746057 (41 on day 30) |
| 6421 year 20 | none in 30 days (the 74 marched to Norfolk and stood there; aboard after day 30) | none (74 boarded from day 4) |
| 7019 year 10 | none | none |

**The AT's bar** (2 → 0): 2 → 2. Missed.

## 3. The ferry's turns and the lift

`ferryTurns.ts` (`turns_1129.json`), the USA on 1129 year 10, 30 days: ferry turns 1 → 4 (actor days
skipped for someone aboard 3 → 0). Each turn the four groups at Norfolk give an order; the free army
157 → 151 → 150 → 148.

`pileDaily.ts` (`daily_1129.log`): every turn 4–5 divisions leave 746057 (12 cells from Norfolk) for
the port, and go aboard on the next turn, 7 days later (day 3671: 4 from Norfolk's cell); the voyage
then takes the groups away about 20 days. The 53 fall to 41 in 30 days. The 60 at 625163 (by
Chicago, about 120 cells from Norfolk) are never the nearest the port, and none of them moves.

**The lift is short of the army:** the USA's 12 transport groups hold 24,000 men each, 288,000 in
all, against about 1.35 million men in the two piles (113 divisions of about 11,900). With every
group at Norfolk boarding at once, a round trip of send, board and voyage (about 4 weeks) carries 8
divisions of Norfolk's four. Under 30 in 30 days is out of reach for the 53 and the 60 alike by
this fleet. PLAN 7.90.

`ferryLift.ts` (`lift_*.json`), means of the daily counts, the nations at war (the world) and the USA:

| save | | world at sea | world aboard | USA at sea | USA aboard | USA island |
|---|---|---|---|---|---|---|
| 1129 year 10 | HEAD | 5.9 | 2.0 | 1.5 | 1.5 | 20 |
| | rule | 7.3 | 3.3 | 2.8 | 2.8 | 20 |
| 6421 year 20 | HEAD | 4.8 | 1.4 | 0.9 | 0.9 | 15.1 |
| | rule | 14.8 | 31.2 | 10.7 | 30.7 | 15.1 |
| 7019 year 10 | HEAD | 3.7 | 1.8 | 0 | 0 | 166 |
| | rule | 4.8 | 2.1 | 0 | 0 | 166 |

## 4. The landings (`tools/diag/boardKinds.ts`, 30 days; `boardKinds.log`)

Formations put aboard, the world, by trip (a landing: for a cell of a nation at war with them):

| save | HEAD landing / ferry | rule landing / ferry |
|---|---|---|
| 1129 year 10 | 0 / 3 | 0 / 7 |
| 6421 year 20 | 3 / 3 | 3 / 78 |
| 7019 year 10 | 5 / 0 | 5 / 1 |

The landings are the same: the narrower lock does not cost them.

## 5. The test

`tests/unit/strandedFerry1938.test.ts`, "a formation aboard does not hold the ferry's turn": on 7.79c's
case a second German group at the home port takes a second division aboard, once for a German port
(a ferry) and once for a Lithuanian one (a landing); the ferry's turn still puts the first division
aboard the other group. Both red on HEAD (the turn skipped).

## 6. The pin and the cost

b7653c3c → 0b3aea1f. The profile: see PROGRESS (`.cache/prof89/`).

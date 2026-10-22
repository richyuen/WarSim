# PLAN 7.88b: every transport group with an army to carry acts in the ferry's turn

The user's ADR-637 a. Run 12's saves (`critic/c12_seed*.bin`), HEAD `04a06669` against the rule
(ADR-642). Closed not done: the piles 3 → 2.

## 1. The rule

`planFerry` (`ai/invasion.ts`): the groups in 7.88a's order (on the army's land first, the most
room, the lower id) each take the turn in turn, until the room of those that gave an order covers
the men of the army free for the ferry, or SAIL_TRIES (4) of them gave none. A formation ordered
is no longer standing, so the next group takes others. Before, the first that gave an order ended
the turn.

## 2. The ferry turns (`tools/diag/ferryTurns.ts`, 30 days, the USA; `b_turns.log`)

| save | | actor days skipped (someone aboard) | ferry turns | groups that gave an order |
|---|---|---|---|---|
| 1129 year 10 | 7.88a | 1 | 3 | 1 a turn (Norfolk's) |
| | rule | **3** | 1 | 6 (Norfolk ×4, Kuujjuarapik, Corpus Christi); Nuuk ×2, San Juan, Bissau none |
| 6421 year 20 | 7.88a | 1 | 3 | 1 a turn (Norfolk's) |
| | rule | **3** | 1 | 26 (Norfolk ×24, Corpus Christi, Hilo); Port-of-Spain, Freetown, Dakar, San Juan none |

The first turn now gives an order with every group that can; then the three actor days after it
are skipped, because a formation of the USA's is aboard (the invasion AI's lock, PLAN 4.6b: a
nation plans no landing nor ferry while one of its formations is aboard).

## 3. The piles (`tools/diag/piles.ts --days 30`; `b_piles.json`)

| save | 7.88a (`piles_rule.json`) | rule |
|---|---|---|
| 1129 year 10 | USA 60 at 625163, 53 at 746057 | USA 60 at 625163, 49 at 746057 |
| 6421 year 20 | USA 75 at 746057 | **none** |
| 7019 year 10 | none | none |

**The AT's bar** (3 → 0): 3 → 2. Missed.

- **6421**: the 24 Norfolk groups sent the pile (17 cells from Norfolk) to their port; it marched
  there as one stack (74 at 772686 from day 4) and stood 23 days waiting to board, then went
  (`b_piles6421_60d.json`, 60 days: no pile of 30 days).
- **1129** (`tools/diag/pileDaily.ts`, `b_1129_daily.log`): four groups stand at Norfolk and take
  two divisions each (24,000 men; the divisions about 11,900). On day 3657, 4 left 746057 and 2 went
  aboard; those 2 stayed aboard until day 3679, and the USA's actor days of 3663, 3670 and 3677 were
  skipped. The pile at 625163 (60, by Chicago: 31 cells from Milwaukee, about 120 from Norfolk) is
  never the nearest to a group's port.

The cause left is the lock: one formation aboard holds every group of the nation for its voyage
(21 days on 1129). PLAN 7.89.

## 4. The lift (`tools/diag/ferryLift.ts`, 30 days; `b_lift_head.json`, `b_lift_rule.json`)

Means of the daily counts, the nations at war (the world) and the USA: transport groups at sea,
land formations aboard, island garrisons (land formations on a landmass with no front cell of
their nation's).

| save | | world at sea | world aboard | world island | USA at sea | USA aboard | USA island |
|---|---|---|---|---|---|---|---|
| 1129 year 10 | HEAD | 3.9 | 0.8 | 88.5 | 0.3 | 0.3 | 20 |
| | rule | 5.9 | 2.0 | 88.5 | 1.5 | 1.5 | 20 |
| 6421 year 20 | HEAD | 4.3 | 1.3 | 54.2 | 0.4 | 0.8 | 16 |
| | rule | 4.8 | 1.4 | 53.3 | 0.9 | 0.9 | 15.1 |
| 7019 year 10 | HEAD | 3.3 | 1.8 | 221.4 | 0 | 0 | 166 |
| | rule | 3.7 | 1.8 | 221.4 | 0 | 0 | 166 |

The island garrisons are about the same: the piles of 7.79c are on a front's land (the ferry's by
ADR-636, not islands). 7019's USA ferries nobody on either (no front of its own nor of an ally's).

## 5. The test

`tests/unit/strandedFerry1938.test.ts`, "two groups at two ports each take their division aboard":
on 7.79c's case a second German group at a second home port (more than 12 cells from the first,
neither reaching the front), with a division of its own there; both go aboard in the one turn,
each for a cell from which the front is reached. Red with the turn ended at the first group that
gave an order. `stranded()` gains `spare`: divisions kept from the near-front clearing for the
caller (0 for the other two cases, unchanged).

## 6. The pin and the cost

dc72fc97 → b7653c3c.

Both bundles at once on separate P-cores, then swapped (`.cache/prof88b/`, `--profile`), invasion
AI mean a tick by core, HEAD → rule:

| run | HEAD | rule | longest call |
|---|---|---|---|
| seed 99, 5 years | 0.203 / 0.194 ms | 0.109 / 0.120 | 21–31 → 30–32 ms |
| 1129 year 10, + 1 year | 0.270 / 0.249 | 0.248 / 0.278 | 55–64 → 50–58 |
| 6421 year 20, + 1 year | 0.421 / 0.364 | 0.363 / 0.406 | 61–63 → 87–93 |

Within the noise; seed 99's world differs from the first ferry turn on (mean tick 2.15 / 2.08 →
1.76 / 1.86 ms, another history). The longest call from 6421 is not traced; the turn of 26 groups is
the likely one. The seed-99 pair ran while an unpinned 30-day read of 1129 (`pileDaily.ts`)
ran too, on both bundles alike.

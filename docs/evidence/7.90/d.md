# PLAN 7.90d: two divisions a transport group

The rule (ADR-647, `systems/amphibious.ts`): `TRANSPORT_MEN` 2,000 → **2,100**, so a transport group's 12
carry 25,200 men: two infantry divisions of 1938 at full strength (12,460 each) with 280 to spare.
Before, the group's 24,000 took one such division a trip (`a.md` §4). On both saves read no land
formation is over 12,600 (two of 12,600 fit exactly); the room is checked against a formation's
strength (`tryLanding`, `sendToPort`), and a formation does not grow past its template.

Read with `tools/diag/ferryTrip.ts` over 90 days from critic run 12's saves, the commands of 7.90c:
`d_trip_1129.*` (`… 90 1129 critic/c12_seed1129_y10.bin USA 625163 746057`) and `d_trip_6421.*`
(`… 90 6421 critic/c12_seed6421_y20.bin USA`). HEAD's are 7.90c's `c_trip_*.*`. A trip is a
transport group and the day it sailed (`landed[].fleet`, `landed[].sailed`).

## The AT: divisions a group carries a trip (1129 year 10)

| 1129 year 10 | trips | landed | a trip | trips of 1 / of 2 | from the Baltimore pile | piles day 30 | piles day 90 |
|---|---|---|---|---|---|---|---|
| HEAD (7.90c) | 17 | 19 | 1.12 | 15 / 2 | 15 | 60/38 | 60/17 |
| rule | 15 | **28** | **1.87** | **2 / 13** | 22 | 60/31 | **60/7** |

Every trip but two carries two (HEAD: group 549's two trips alone). The two of one (568 and 571, sailed day 3713) are the last
four of the Baltimore pile at Norfolk on the turn of day 3712, split 2 / 1 / 1 over three groups
(365, 568, 571): each group took the turn in its order and sent or boarded the nearest left, so the
third group sailed with one where two groups would have carried the four. That is the split of a
port's army over its groups, not the room: PLAN 7.90g. The mode is 2, the bar's figure.

## Beside it: 6421 year 20

| 6421 year 20 | trips | landed | a trip | trips of 1 |
|---|---|---|---|---|
| HEAD (7.90c) | 33 | 87 | 2.64 | 28 |
| rule | 32 | 87 | 2.72 | 27 |

Little moved: 6421's US groups stand at Dakar refusing a `board` (PLAN 7.90f), and its trips of one
were not read here (7.90g reads them first).

## The test

`amphibious1938.test.ts`, "a transport group takes two full infantry divisions on one trip, the second
on the group already under way": two British divisions of 12,460 at Portsmouth, the second ordered on
the first's group; red without (the second goes on Portsmouth's other group). The test beside it
("… marches as before") keeps its count of two aboard Portsmouth's two groups: a player's order sets
a group sailing with its first division, and only the AI names a group already under way (`via`,
ADR-625). Its comment now says why.

## The pin

8a571863 → 5ea2c9d8: seed 99's first year has landings.

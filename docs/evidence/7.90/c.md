# PLAN 7.90c: the ferry's way back

The rule (ADR-646, `ai/invasion.ts`, `planFerry`'s `ferryGroup`): a transport group away from the army
sails for it by the SAIL_TRIES (4) free formations nearest it **on a land with a port of the nation's
other than the group's** (`sailToArmy` takes no other). Before, the four nearest were taken whatever
their land, and from the far ports they were garrisons on Caribbean islands with no US port, so the
sail was refused every week (`a.md` §2).

Read with `tools/diag/ferryTrip.ts` over 90 days from critic run 12's saves, the commands of 7.90a/b:
`c_trip_1129.*` (`… 90 1129 critic/c12_seed1129_y10.bin USA 625163 746057`) and `c_trip_6421.*`
(`… 90 6421 critic/c12_seed6421_y20.bin USA`). HEAD's are 7.90b's `b_trip_*.*`. The probe's "sail
refused" lines now take the four as the rule does (none was printed on 1129: no sail was refused).

## The AT: the groups that land at Bathurst (1129 year 10)

| group | first day standing at Bathurst | standing there | under way again | HEAD |
|---|---|---|---|---|
| 365, 568, 571, 1015 (from Norfolk) | 3689 | 3 days | 3692 (ordered 3691), sail to Norfolk (3709), then St. John's, Boston | standing 52–62 days, to day 90 |
| 549 (from Kuujjuarapik) | 3679 | 6 days | 3685 (ordered 3684), sail to Norfolk (3702) | the same |
| 574 (San Juan → Norfolk → Baltimore) | 3682 | 3 days | 3685 | stood at San Juan 90 days |
| 1120 (Roseau → Baltimore) | 3689 | 3 days | 3692 | stood at Roseau 90 days |
| 1119 (Bissau → Baltimore) | 3696 | 3 days | 3699 | stood at Bissau 90 days |
| 1123 (Pearl Harbor → Hilo) | 3704 | 2 days | 3706 | – |

Every group that lands at Bathurst is under way within 2–6 days of landing (bar: 14). San Juan's, Roseau's and
Bissau's groups, which stood the 90 days on HEAD, sail to the mainland on the first turn.

## What moved (90 days)

| save | landed | of them from the piles | ferry orders | group-days at a port (P) / under way (L + E) | piles day 0 → 30 → 90 |
|---|---|---|---|---|---|
| 1129 year 10, HEAD | 8 | 4 (Baltimore) | 23 | 807 / 173 | 60/49 → 60/41 → 60/43 |
| 1129 year 10, rule | **19** | **15** (Baltimore) | **69** | 313 / 521 | 60/49 → 60/38 → **60/17** |
| 6421 year 20, HEAD | 78 | – | 80 | 2,198 / 472 | – |
| 6421 year 20, rule | **87** | – | 89 | 1,265 / 739 | – |

On 6421 the ferry has 8 turns, not 13: 5 of the USA's actor days went to Normandy landings and 6 to a
landing aboard, the ferry following (`c_turns_6421.json`, `ferryTurns.ts`), the groups free for them
now home. Left on 6421: 20–26 groups at Dakar, and later Bathurst's, refuse a `board` every turn (on
the African front's land, the army by them not sent to the port); 7.90b's read had those refusals
too. 1129's 60 by Chicago do not move (7.90's bar on them, `a.md` §6).

Timing (`.cache/prof90c/`, pairs on separate P-cores, swapped, a year from each save): invasion AI a
tick, HEAD → rule, 1129 year 10 0.312 / 0.279 → 0.296 / 0.343 ms (longest 58 / 53 → 51 / 95 ms), 6421
year 20 0.462 / 0.380 → 0.374 / 0.454 ms (longest 65 / 71 → 68 / 72 ms).

The pin is unchanged (8a571863).

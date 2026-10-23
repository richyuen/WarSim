# PLAN 7.90b: the ferry turn's refusals

The rule (ADR-645, `ai/invasion.ts`, `planFerry`): the turn's bound is the route searches its refusals
made (`FERRY_SEARCHES`, 68: ADR-642's four groups' worst), not the number of groups that refused. A
group at a port where one refused since the turn's last order takes that refusal (`same`) with no
search. Before (ADR-642), the turn ended at `SAIL_TRIES` (4) groups that gave no order, and the same
ones refused first every week, most of them with no search at all.

Read with `tools/diag/ferryTrip.ts` (each try now carries its searches, `#n`) over 90 days from critic
run 12's saves, the same commands as 7.90a: `b_trip_1129.*` (`… 90 1129 critic/c12_seed1129_y10.bin USA
625163 746057`) and `b_trip_6421.*` (`… 90 6421 critic/c12_seed6421_y20.bin USA`). HEAD's are 7.90a's
`trip_*.*` (the same sim code: 7.90a's commits changed a probe and documents). Never tried = the groups at
a port less the tries, a turn (`turns[]`).

| save | turns | groups at a port a turn | never tried a turn, days 30–90 | never tried, all turns | orders a turn | refusals' searches a turn (most) |
|---|---|---|---|---|---|---|
| 1129 year 10, HEAD | 12 | 10.8 | 6.5 | 5.0 | 1.75 | – |
| 1129 year 10, rule | 12 | 10.3 | **0** | **0** | 1.92 | 1.0 (1) |
| 6421 year 20, HEAD | 13 | 29.5 | 26.3 | 19.4 | 6.08 | – |
| 6421 year 20, rule | 13 | 29.4 | **0** | **0** | 6.15 | 13.8 (18) |

The bound never ends a turn on these saves: the most a turn's refusals searched is 18 of 68 (6421:
Freetown's and Dakar's boards, 9 each, which HEAD's turns searched too). The groups now tried refuse:
on 1129 Bathurst's, San Juan's, Bissau's and Roseau's sails to the army (no port of the USA on their
four nearest formations' islands, no search), on 6421 Port-of-Spain's 25 (now there: the Norfolk groups'
first trip landed them) and Roseau's, San Juan's and Guantánamo Bay's the same way. That refusal is
PLAN 7.90c's (the way back); so orders a turn and the landed barely move (1129 7 → 8, 6421 77 → 78) and
the piles are as before (1129's 60 / 43 on day 90).

Timing: ADR-645 (`.cache/prof90b/`). The pin is unchanged: seed 99 is hash for hash HEAD's over five years.

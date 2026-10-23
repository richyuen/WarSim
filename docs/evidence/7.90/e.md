# PLAN 7.90e: the ferry's transports bought for the army that reaches no front

The rule (ADR-648, `ai/economic.ts` `wantsFerry`): on a land of the nation's front cells (its own, else
its allies' beside the enemies it fights with them) with a port of its own, its standing land
formations that reach none of those cells, nor of its side's beside its enemies (`frontReach`, the
ferry's own test since PLAN 7.79c, ADR-636, now exported from `ai/invasion.ts`), count as island army
against its transports' room. Before, only the army on a land with a port of its own and no front cell
counted (`a.md` §5).

Read with `tools/diag/ferryTrip.ts` over 30 days from critic run 12's save: `e_trip_1129.*`
(`… 30 1129 critic/c12_seed1129_y10.bin USA 625163 746057`). HEAD's is 7.90d's `d_trip_1129.*`.

## The AT (1129 year 10, the USA)

| 1129 year 10 | `wantsFerry` day 0 | groups in training, days 0 / 10 / 20 / 30 | gold day 10 | piles day 30 |
|---|---|---|---|---|
| HEAD (7.90d) | false (every day of 90) | 0 / 0 / 0 / 0 | 115,757 | 60/31 |
| rule | **true** | 0 / **1 / 1 / 1** | 115,127 | 60/31 |

The group is ordered at the first month's start (day 3650), day 10's gold 630 under HEAD's (the order's
price and upkeep). One in training at a time (ADR-614); the 12 afloat are unchanged in 30 days, so the piles
are as on HEAD. The want holds every day read: the mainland's free army (~150 formations) outnumbers
the 12 groups' 302,400 men of room.

## Cost

`wantsFerry` runs at a month's start for a nation at war with a fleet mix and income over POOR_INCOME;
the reach is made only at the first standing formation on a fronted land with a port of the nation's,
and kept per class of cells (landmass, group of provinces, ground). Seed 99's 5-year `--profile` is in
PROGRESS.md.

## Test

`strandedFerry1938.test.ts`, "a nation whose army on a front's land reaches no front cell wants a
transport group": Germany at war with Lithuania, three divisions at a home port west of Poland that
reach no front cell, its one group afloat (25,200 men of room): true; red without (false).

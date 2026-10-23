# PLAN 7.80b: the settlement's pockets go with the land round them (ADR-644)

Read on 2026-10-22. Tool: `tools/diag/fragKinds.ts` (`<seed>:run:10,20`, read only), the critic's piece
count (4-connected runs of one holder; small pieces 2–400 cells). Trees side by side: `dd3b730`
(the critic's base; the tool copied into a worktree), HEAD `367a7705`, HEAD with the rule's first
version ("rule"), and the rule as committed, with the no-swap clause ("fix"). Seeds
801–810, unseen by any tuning. The rows are in `b/<tree>_<seed>.json`, the table in `b/summary.txt`.

## Small pieces a world (enclaves, founded nations living)

| seed | y20 dd3b730 | y20 HEAD | y20 rule (first) | y20 fix (committed) |
|---|---|---|---|---|
| 801 | 911 (376, 4) | 1276 (405, 38) | 960 (278, 33) | 784 (150, 35) |
| 802 | 658 (188, 4) | 1335 (478, 13) | 918 (200, 16) | 850 (180, 22) |
| 803 | 937 (329, 9) | 1204 (460, 12) | 869 (224, 28) | 614 (111, 3) |
| 804 | 878 (310, 7) | 1444 (448, 24) | 997 (250, 22) | 767 (151, 17) |
| 805 | 870 (319, 10) | 1445 (515, 16) | 851 (190, 14) | 1016 (247, 20) |
| 806 | 963 (341, 7) | 1261 (383, 18) | 830 (134, 25) | 981 (169, 43) |
| 807 | 910 (325, 8) | 1417 (546, 27) | 884 (227, 22) | 857 (221, 24) |
| 808 | 824 (221, 11) | 1130 (351, 11) | 910 (202, 23) | 853 (204, 14) |
| 809 | 850 (271, 1) | 1081 (309, 15) | 750 (143, 6) | 886 (196, 12) |
| 810 | 833 (252, 11) | 1285 (371, 28) | 909 (217, 14) | 787 (196, 10) |
| **mean** | **863.4** (293.2, 7.2) | **1,287.8** (426.6, 20.2) | **887.8** (206.5, 20.3) | **839.5** (182.5, 20.0) |

At year 10: 722.8, 915.7, 718.4, and the fix in `b/summary.txt`.

## The AT

- Small pieces at year 20 not above `dd3b730`'s: the rule as committed 839.5 against 863.4, met (under on 5
  of 10 seeds; HEAD 1,287.8). The first version, 887.8, handed a winner's piece back while the loser's
  pocket beside it went to the winner: the two swapped and left two pockets. The gate found it
  (`war.test.ts`, "the score is relative to the smaller party": 39 of the 2,525 cells Germany took at the
  map's seam went back, the Soviet sliver beyond them to Germany); the committed rule keeps such a piece. The two
  reads' gap (48) is mostly the seeds' histories, not the clause: one seed moves by up to 230 between them
  (803: 869 → 614; 805: 851 → 1,016), and the margin over the bar (24) is within that noise.
- Founded statelets living at year 20 (read): 7.2, HEAD 20.2, the rule 20.0: untouched (revolts and
  statelets are 7.80a's founded +42, not a treaty's pockets); the reserve cut's war, ADR-639 (b).
- Unit test `tests/unit/peacePockets1938.test.ts`: a Polish pocket inside the land Germany takes goes to
  Germany (Warsaw's land stays); a lone conquest inside Poland goes back; a ring won round a Polish
  pocket is kept and the pocket goes with it; a white peace hands nothing over. The first two red without
  the rule, the third without the no-swap clause.
- Pin 0b3aea1f → 8a571863 (the same with and without the clause). Timing in ADR-644.

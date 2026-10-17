# PLAN 7.18e: a winner's resolve (measure)

`tools/diag/nukeGates.ts <seed> 30`, seeds 1–10, now also counting the days of holders not losing
(desperation under 0.5) by the war's length (`winning`), the bursts (`bursts`) and each holder's
first warhead year (`firstWarhead`: 8.7 for the first holders on every seed).

## Before (`8792e25`, the rules of 7.18a–d)

Bursts decided in 4 of 10 seeds (1, 5, 8, 10). On the days of holders not losing in wars of one to
two years, the best place weighed was worth 0.34 to 0.92 (often an enemy capital), its gain
(value × desperation × doctrine) 0.04 to 0.19, its costs 0.70 where the enemy could not strike back
(taboo 0.6, outrage 0.1) and 1.2 to 1.6 where it could. Far wars had no place: seed 4's France,
Britain and Switzerland a year into a war on Japan, every Japanese place beyond FRONT_KM of them.

## After (resolve to 2 at two years; places anywhere while resolved)

| Seed | Rules | Decisions | Years | Bursts | Median utility |
|---|---|---|---|---|---|
| 1 | before | 29 | 14, 15, 16 | — | 0.246 |
| 1 | after | 41 | 14, 15, 16, 19, 27, 28, 29 | 41 | 0.423 |
| 2 | before | 0 | — | — | — |
| 2 | after | 4 | 20 | 4 | 0.463 |
| 3 | before | 0 | — | — | — |
| 3 | after | 1 | 30 | 1 | 0.010 |
| 4 | before | 0 | — | — | — |
| 4 | after | 7 | 15, 26, 27, 28 | 7 | 0.577 |
| 5 | before | 14 | 27, 28 | — | 0.414 |
| 5 | after | 4 | 15, 18, 22, 25 | 4 | 0.001 |
| 6 | before | 0 | — | — | — |
| 6 | after | 0 | — | 0 | — |
| 7 | before | 0 | — | — | — |
| 7 | after | 7 | 13, 14, 15, 18, 25 | 7 | 0.395 |
| 8 | before | 85 | 22, 23, 25, 27, 28, 29 | — | 0.349 |
| 8 | after | 7 | 14, 16, 19, 21, 28 | 7 | 0.588 |
| 9 | before | 0 | — | — | — |
| 9 | after | 0 | — | 0 | — |
| 10 | before | 4 | 10, 13 | — | 0.033 |
| 10 | after | 11 | 10, 13, 19, 20, 21, 26, 29 | 11 | 0.445 |

Bursts in 8 of 10 seeds, in 6 before year 20. Where none: seed 6's Britain a year into a war on
Sweden and Norway, its best place worth 0.02; seed 9's Britain on Japan and China, utility −0.03 at
resolve 1.5 and its places of worth 1 out of its bombers' range. Intermediate steps: resolve 1.5 with
places within FRONT_KM, 6 of 10 (the far wars of seeds 4 and 9 placeless); resolve 1.5 anywhere,
7 of 10.

Still for 7.18g and 7.25: tolls of a few thousand at strikes on armies (seed 1's Britain on a
statelet #114: 168 to 11,703), decisions at utilities of 0.001 on the desperate paths (seed 5).
Intermediate runs: `.cache/nukeGates718e_{base,r1,r2,r3}_<seed>.json`.

## The resolve's own strikes (after the commit, for 7.18h)

The bursts 90 days apart are the resolve's. Seed 2: the Netherlands on the Soviet Union (339,120),
Manchukuo (140,600), Japan (22,366) and China (614,183), one each 90 days in year 20, not one day's
spasm. Seed 1: Italy ten times from day 9,744 to 10,554 (64,391 to 339,247 and down to 11,751; Nepal
17,443, Mongolia 18,705). Seed 4: Britain on Japan 65,183, 56,071, 2,305, 935; Switzerland 939,
31,751, 14,986. Strikes for under 20,000 dead on the older, desperate paths come days apart (seed 1,
the Soviet Union and Britain in years 14–16), as before 7.18e. PLAN 7.18h.

# PLAN 7.108b: the late air war, the read first (2026-10-24)

HEAD `2b7f2474` (the pin c848f884). The saves are critic run 13's (`critic/c13_seed*_y10.bin`,
`_y20.bin`, written on `0c80db1e`), stepped under HEAD's rules: a snapshot of why wings sit late,
not HEAD's own history. The AT itself is read from 1938 on 931–940 (`at.md`).

## 1. Why the wings at war sit (`tools/diag/airWhy.ts`, new)

Each day in the hour `airAi` gave its missions, every wing of a living AI nation at war on an
airbase; one idle of a fighter's or striker's role, by why. Wing-days (a wing idle all the read
counts each day). 60 days from each save (`4877_y10.json`, `4877_y20.json`, `7019_y20.json`).

| save | fighters idle | of them: a base of the side in reach of the enemy, past a ferry flight (`baseFar`) | the enemy with air, so | no base of the side in reach (`beyondBases`) | the enemy with no air | strikers idle | `baseFar` |
|---|---|---|---|---|---|---|---|
| 4877 y10 | 1,161 | 899 | 756 | 202 | 342 | 912 | 566 |
| 4877 y20 | 1,246 | 563 | 563 | 680 | 0 | 967 | 714 |
| 7019 y20 | 816 | 681 | 681 | 132 | 132 | 812 | 674 |

A base of the side in reach of the front within one ferry flight (`baseInFerry`, where the daily hop
of PLAN 5.12a would fail) is 0–22 wing-days on each: the hop does not fail; there is nowhere to hop.

## 2. A chain round, or the sea? (`b_*.json`, 30 days; `c_*.json`, 12 days)

For a `baseFar` wing whose enemy has air, every 6th day: is there a chain of the side's airbases,
hops of a ferry flight each (room not weighed), from its base to one in reach of the front?

| save | reads | a chain | no chain |
|---|---|---|---|
| 4877 y20 | 92 + 42 | 0 | all |
| 7019 y20 | 51 | 0 | all |
| 5861 y20 | 264 + 108 | 0 | all |
| 6421 y10 | 225 + 90 | 0 | all |

Every one is across the sea. The destination (the side's base in reach of the nearest enemy
formation) lies 4,400–8,800 km off on the mean (`dest.km` ÷ reads). Cases (wing-days, `c_*.json`): the
USA's (#82) to a founded nation's (#206) base against #95 (5861, 42), to its own overseas base against
Germany (5861, 16) and against Japan (6421, 46); Japan's (#75) to Yemen's against Australia (#78; 5861,
4 + 2 + 2); the Netherlands' (#28) to its own against #80 and #201 (4877, 14 + 8).

At the destination an enemy wing is based within range + `INTERCEPT_KM` in 30 of 108, 15 of 42 and 18
of 90 reads: a quarter. Per hour the pairs of nations at war with sorties of both aloft come within
150 km of each other in 11 of 2,042 pair-hours (5861, 4877, 7019 y20): their air forces are elsewhere.

4877 y20's `beyondBases` (680 + 234 wing-days: no base of the side in reach of the enemy at all) is
out of reach of any basing rule (carriers aside) and left.

## 3. The rule, A/B from one save (`tools/diag/airAb.ts`, new; 90 days from each)

Three arms: HEAD; every fighter's and striker's sea hop (`hop_*`: no hop nearer, a base of the side
in reach of the front, rebase there however far); fighters' only (`fhop_*`). Battles, sortie-hours
aloft, battles per thousand of them, land formations engaged a day.

| save | HEAD | all roles | fighters |
|---|---|---|---|
| 4877 y10 | 80 / 20,314 / 3.94 / 3.01 | 95 / 49,497 / 1.92 / 1.90 | 137 / 49,362 / 2.78 / 3.19 |
| 4877 y20 | 5 / 17,763 / 0.28 / 1.77 | 55 / 37,730 / 1.46 / 1.67 | 138 / 33,011 / 4.18 / 1.99 |
| 5861 y10 | 0 / 12,037 / 0 / 6.74 | 14 / 44,179 / 0.32 / 3.70 | 12 / 45,004 / 0.27 / 6.64 |
| 5861 y20 | 7 / 3,513 / 1.99 / 3.01 | 105 / 44,794 / 2.34 / 0.42 | 7 / 29,730 / 0.24 / 3.01 |
| 6421 y10 | 0 / 18,998 / 0 / 4.37 | 116 / 41,446 / 2.80 / 1.53 | 43 / 45,528 / 0.94 / 2.99 |
| 7019 y20 | 0 / 5,046 / 0 / 1.20 | 4 / 18,511 / 0.22 / 0.79 | 4 / 21,659 / 0.18 / 1.10 |
| **pooled** | **92 / 77,671 / 1.18 / 20.1** | **389 / 236,157 / 1.65 / 10.0** | **341 / 224,294 / 1.52 / 18.9** |

Both lift the battles (× 4.2, × 3.7) and the battles per sortie-hour (1.18 → 1.65, 1.52 a thousand:
the new sorties meet more, not less, than HEAD's; ADR-520). The strikers carried over wear the land
war down on all six (engaged 20.1 → 10.0 a day, R13-B1's figure); the fighters' alone keep it
(18.9; 6421 4.37 → 2.99, the rest level or up). The rule tried for the AT is the fighters' alone, with
ADR-515's case kept (where a chain of bases leads to the front round a bend, the wing stays): read the
same on all six saves (`rule_*.json`). It and its unit test are `rule.patch`; it missed the AT (`at.md`)
and is not committed (ADR-685).

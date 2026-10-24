# PLAN 7.107: the late war at sea, measured (naval 7, critic run 13)

HEAD `49c0064f`, the unseen seeds 921–930 × 20 years. Raw files in `.cache/7107/` (not committed):
`head/sea_<seed>.json` (`tools/diag/seaYears.ts`, with `SAVE_AT=10,20` checkpoints `s<seed>_y<year>.bin`),
`head/wars_<seed>_<y1|y10|y20>.json` (`tools/diag/seaWars.ts`, one year from 1938 or `LOAD=` a save),
`head/ph_<seed>_<y1|y10|y20>.json` (`tools/diag/seaPhantom.ts`, 365 days; y1 on 921–926).

## 1. The two bars on HEAD

| | HEAD | bar |
|---|---|---|
| sea battles, year 1, a world | 40.8 | — |
| sea battles a world-year, years 2–20 | 10.37 | ≥ 13.5 (1.3 ×) |
| battles that sink nothing, years 1–20 | 7.28 % | ≤ 4 % |

By seed (year 1; a world-year after; late zero %): 921 42, 14.95, 13.0 · 922 44, 9.58, 13.7 · 923 16, 13.47, 10.5 ·
924 61, 8.42, 7.5 · 925 68, 7.89, 6.0 · 926 65, 8.05, 5.2 · 927 19, 12.42, 3.4 · 928 39, 10.26, 1.5 · 929 16, 10.21, 6.7 ·
930 38, 8.42, 3.7.

## 2. Where the fleets of nations at war are (`seaWars`, weekly, mean of the 10 seeds)

| | year 1 | year 11 (from y10) | year 21 (from y20) |
|---|---|---|---|
| sea battles | 40.8 | 6.9 | 7.9 |
| wars of two navies (`both`), war-weeks | 36.6 | 16.8 | 24.3 |
| armed fleets at war with a navy, a world (fleet-weeks ÷ 52) | 14.0 | 2.8 | 4.6 |
| armed fleet-weeks at war with no navy (on station, blockading: `awayStation`) | 2,198 (1,442) | 1,177 (924) | 748 (597) |
| battles per armed fleet-year at war with a navy | 2.91 | 2.43 | 1.71 (3.1 without 924) |

The fleet at war with a navy meets the enemy about as often late as in year 1. What fell is how many there are:
the armed fleets about halve (94 → 32–57 a world on 921–925's saves), and the share of them whose nation is at war
with another navy halves too. That is the navies' size (ADR-667 a: the smaller late navies accepted) and the
strategic AI's choice of wars, not the naval AI's search: no rule of `src/sim/ai/naval.ts` lifts it to 1.3 ×.

Seed 924, year 21: 665 US fleet-weeks on station by enemy fleets `preyWhy` calls huntable, never hunted. Those
enemy fleets (Denmark, Germany, Mexico, the Soviet Union, Japan; 7 armed fleets, 4 % of the world's armed power)
stand on cells of zone 0 ((608,928), (1208,414)): no sea zone, so `standingWarfleets` skips them, and each of their
ways home is refused (`NoSeaWay`, 570 in the year). Only on that save of the 20 (a stranded-fleet count on
921–925's saves found none elsewhere).

## 3. The battles that sink nothing (`seaPhantom`)

| | rows | sank nothing | cause | hours |
|---|---|---|---|---|
| year 1 (921–926) | 296 | 18 (6.1 %) | all `weaponlessBroke`, a transport group | 1 h: 10, 2 h: 1, unread: 7 |
| year 11 | 69 | 4 (5.8 %) | all `weaponlessBroke`, a transport group | 1 h: 4 |
| year 21 | 79 | 8 (10.1 %) | all `weaponlessBroke`, a transport group | 1 h: 1, unread: 7 |

One cause: a warfleet sights a transport group (no weapon), hits it in the battle's first hour, and it breaks off
(PLAN 7.31, ADR-526: a fleet with no weapon breaks off once under fire), out of every battle for `BREAK_HOURS`.
The hour's damage is carried as a wound (`applyLoss` keeps the fraction): on 921's year 21 the four single
transports that slipped away carried 0.30, 0.56, 0.69 and 0.80 of a ship. Nothing is sunk, and the row says so.
Nothing in the sim takes a wound away except a loss, so a roll whose chance is the wound keeps the mean.

## 4. Verdict of the measure

- Bar 2 has a rule: a fleet that breaks off is not let carry its wound out (ADR-682).
- Bar 1 is the navies' count, not the meeting (ADR-683, to the user).

## 5. The AT's run (ADR-682's rule; `.cache/7107/rule/sea_<seed>.json`, the same seeds × 20 years)

| | HEAD | rule | bar |
|---|---|---|---|
| sea battles, year 1 | 40.8 | 36.1 | — |
| sea battles a world-year, years 2–20 | 10.37 | 9.83 (0.95 ×) | ≥ 13.5: missed |
| battles that sink nothing, years 1–20 | 7.28 % | 2.56 % | ≤ 4 %: met |
| armed fleets, years 2–20 (daily mean) | 43.7 | 41.0 | — |
| ships sunk a year, years 2–20 | 93.3 | 101.8 | — |

The mechanism check (`seaPhantom` on 921's year-20 save, 365 days): rows sinking nothing 6 of 16 → 3 of 15, the
three left transports whose roll healed them.

## 6. Bar 1 re-scoped (ADR-683 a, the user's decision), read on ADR-682's code

`9b6a2734` (the sim as `0f8678e8`), the same seeds; raw files in `.cache/7107/at/` (`seaWars` one year from 1938 and
from each seed's year-10 and year-20 saves written by `seaYears` with `SAVE_AT=10,20`). Battles per armed fleet-year
of a nation at war with a navy: the year's sea battles ÷ (`vsNavy` fleet-weeks ÷ 52), pooled over the seeds.

| | year 1 | year 11 | year 21 |
|---|---|---|---|
| sea battles, a world | 36.1 | 12.7 | 9.3 |
| armed fleets at war with a navy, a world | 13.1 | 2.0 | 2.7 |
| battles per such fleet-year | 2.75 | **6.34** | **3.45** (4.29 without 924) |
| bar (0.8 × year 1's) | — | 2.20 | 2.20 |

Met on both late reads (pooled 4.69). As in §2 the battles are all of the world's, so with few such fleets late the
ratio runs high: what the naval AI owns, a fleet at war with a navy meeting it, holds; their count (13.1 → 2.0–2.7)
is the navies' size (ADR-667 a) and the war choice, which the user's option a leaves as they are.

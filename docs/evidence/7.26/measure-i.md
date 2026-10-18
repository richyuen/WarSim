# PLAN 7.26i: patrols over home, measured first (2026-10-18)

Code: `a75e6c6` (HEAD after 7.26h2, ADR-518; `tools/diag/airWar.ts` with 7.26i's columns, no sim
change). Seeds 1, 3, 4, 6 and 10 (the seeds with war-years under 3 aloft on `6d1f727`, 7.26g)
× 30 years, five side by side (about 18 minutes), `.cache/726i/airWar_<seed>.json`. Summary
script: `.cache/tmp/idle726i.cjs` (sums the columns below over war-years 2–30).

## The question

A wing of a nation at war with no enemy land formation in range flies nothing (ADR-377). PLAN
7.26i: would a patrol over its own land meet anything? The patrol must meet enemies the sim has,
not fly for the count (AoC has no air war). A patrol circles one point and fights only sorties
within `INTERCEPT_KM` (150 km) of it, so "an enemy sortie aloft within the fighter's range of its
base" is an upper bound on what it could meet.

## The columns (`airWar.ts`, means a day over the year)

- `idleFighter`: fighters at war with no mission and no enemy land formation in range.
- `fighterBaseNear`: of those, with an airbase holding wings of a nation at war with theirs in
  range; `fighterFleetNear`: an enemy fleet in range.
- `fighterAirNear`: fighter-days that saw an hour with an enemy sortie aloft (not on its way home)
  within range of their base; `fighterAirOwn`: such a sortie over a cell of their side.
- `fighterAirHours`: such hours summed over the idle fighters.

## The figures

| war-years | idle fighters a day | enemy base in range | enemy fleet in range | enemy sortie in range (a day) | over own land | hours a day |
|---|---|---|---|---|---|---|
| all, years 2–30 (145) | 30.5 | 1.01 (3.3 %) | 2.18 (7.1 %) | 1.41 (4.6 %) | 1.08 (3.6 %) | 15.1 |
| years 21–30 (50) | 38.3 | 1.30 (3.4 %) | 1.46 (3.8 %) | 1.16 (3.0 %) | 0.92 (2.4 %) | 11.7 |
| under 3 aloft (10) | 30.6 | 0.12 (0.4 %) | 0.22 (0.7 %) | 0.13 (0.4 %) | 0.11 (0.4 %) | 1.5 |

By seed (years 2–30, a day): idle fighters 19–44; an enemy sortie in range 0.6–2.7, over own land
0.4–2.1; an enemy base in range 0.4–1.4; an enemy fleet 1.3–3.5.

## The verdict: no rule

Of the idle fighters, one in twenty-two at most has an enemy sortie anywhere in its range on a
day, and in the years the AT finds short (under 3 aloft) one in 240. The bound counts any point of
the range; a patrol sees 150 km about one point, so it would meet less. A patrol over home in
the short years would add some 30 sorties aloft a day that meet nothing: the count of ADR-519's
second bar met by flying for it, which PLAN 7.26i rules out. Not built (ADR-520).

The short years are short because nothing of the enemy is near: in them 1.3 wings a day of 67 at
war have an enemy land formation in range, and the enemy's air, bases and fleets are as far
away. That is the land and naval war's reach (PLAN 7.29), not the air AI's.

## For 7.26j: the share on HEAD

`airAt.ts` on these five files (ADR-519's share, `enemyNearTasked ÷ enemyNear`; the old
`mission ÷ (mission + inRange)` beside it):

| seed | share: lowest, war-years at half or more | old share | under 3 aloft |
|---|---|---|---|
| 1 | 0.63, 29 of 29 | 0.66, 29 of 29 | 0 |
| 3 | 0.48, 28 of 29 | 0.50, 29 of 29 | 0 |
| 4 | 0.40, 24 of 29 | 0.46, 24 of 29 | 0 |
| 6 | 0.35, 27 of 29 | 0.39, 28 of 29 | 2 |
| 10 | 0.45, 27 of 29 | 0.58, 29 of 29 | 8 |

On 7.26g's files the old share held on 8 of 10 seeds; here 4 of these 5 have a war-year under half
(on the old share 3). The years under half have 8 to 23 wings a day with an enemy in range, about
half untasked: not small counts. The two definitions differ by the missions of wings with no enemy
land formation in range (strikes on fleets and industry, supply, and `homePatrol`, 0.03–0.08 a
day: the missions are given at 00:00 and counted at the day's end). One run a seed after
ADR-517 and ADR-518, diverging from the first months; 7.26j's ten seeds read it, and which roles
stand untasked in range is its first question if the share is short there.

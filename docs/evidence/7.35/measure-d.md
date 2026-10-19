# PLAN 7.35d: why the sea battles fall after year 1, measured

The critic (run 9, at `f0be88c`, `critic/c9_headless_*.json`): on its 14 headless seeds, 36.1
`SeaBattle` rows in year 1 against 13.1 a world-year in years 2 to 30 (median 2; the mean carried by
a few years of hundreds, the phantom battles of R9-B1, PLAN 7.31).

## 1. Before (7.35d1, at `10aecbe`)

`npx tsx tools/diag/seaYears.ts <seed> 30` on the critic's 14 seeds (1129, 1471, 2251, 2609, 3407,
3793, 4483, 4957, 5527, 6113, 6653, 7741, 8821, 9901), 30 years each from 1938 with no command; the
runs' JSON in `d1/before_<seed>.json`. Per year: the sea battles ended (all; those that sank a ship;
the ships sunk; the pairs with most), and each day at 01:00 the armed fleets (`fleetPower` > 0),
their power, the nations with one, the pairs at war, the pairs at war with an armed fleet each in
one basin (`basinAt`; "sea pairs"), those fleets and how many are under way. Daily figures are
means over the year.

| all 14 seeds, mean (median) | year 1 | years 2–30 | 2–5 | 6–10 | 11–30 |
| --- | --- | --- | --- | --- | --- |
| sea battles | 20 (22) | 1.9 (1) | 3.3 | 2.4 | 1.4 |
| that sank a ship | 19.4 (22) | 1.7 (1) | 3.1 | 2.3 | 1.3 |
| ships sunk | 193 (207) | 24.8 (12) | 42.1 | 28.6 | 20.3 |
| armed fleets | 106.8 | 99.6 | 96.5 | 97.2 | 100.8 |
| their power (hp) | 325,000 | 296,800 | 294,100 | 283,300 | 300,800 |
| nations with a navy | 19.3 | 17.3 | 16.3 | 17.5 | 17.5 |
| pairs at war | 172 | 214 | 306 | 284 | 178 |
| sea pairs | 9.1 | 7.7 | 9.9 | 9.4 | 6.8 |
| their fleets | 45.3 | 43.0 | 56.4 | 52.7 | 37.9 |
| their fleets' power (hp) | 139,100 | 129,600 | 173,800 | 160,700 | 113,000 |
| their fleets under way | 2.1 | 0.5 | 0.7 | 0.7 | 0.4 |

Per seed (sea battles; the critic's in its runs at `f0be88c`):

| seed | year 1 | sank a ship | years 2–30, mean | sank a ship | late years with none sinking (of 29) | critic year 1 | critic 2–30 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1129 | 23 | 22 | 1.6 | 1.6 | 11 | 68 | 64.5 |
| 1471 | 17 | 17 | 1.8 | 1.7 | 11 | 56 | 25 |
| 2251 | 31 | 28 | 1.5 | 1.4 | 11 | 122 | 1.4 |
| 2609 | 22 | 22 | 1.7 | 1.6 | 10 | 20 | 15.1 |
| 3407 | 6 | 6 | 2.2 | 2.2 | 6 | 9 | 2.7 |
| 3793 | 19 | 19 | 1.2 | 1.2 | 12 | 16 | 11.8 |
| 4483 | 26 | 26 | 4.1 | 3.0 | 5 | 36 | 3.8 |
| 4957 | 24 | 24 | 1.8 | 1.8 | 9 | 30 | 6.5 |
| 5527 | 16 | 14 | 2.0 | 1.9 | 10 | 22 | 4.6 |
| 6113 | 13 | 11 | 1.0 | 1.0 | 14 | 18 | 29.3 |
| 6653 | 29 | 29 | 2.1 | 2.1 | 9 | 43 | 11.6 |
| 7741 | 19 | 19 | 1.6 | 1.5 | 13 | 25 | 1.6 |
| 8821 | 6 | 6 | 1.9 | 1.9 | 9 | 16 | 2.3 |
| 9901 | 29 | 29 | 1.6 | 1.6 | 11 | 24 | 2.6 |

## 2. What it says

- **No phantoms left.** 97 % of year 1's battles and 89 % of the later ones sink a ship (the
  critic's late figure was mostly battles that sank nothing: R9-B1, fixed by PLAN 7.31). No late
  year has 50 battles or more (the critic's had 373, 294, 509). So the critic's 36 → 13 is now
  20 → 1.9: the fall is steeper, not gone.
- **Not the navies gone.** After year 1 the armed fleets keep 93 % of their number and 91 % of
  their power; the nations with a navy 19.3 → 17.3.
- **Not the wars.** Pairs at war rise (172 → 214). Pairs at war with a navy each in one basin hold
  (9.1 → 7.7 a day; 9.9 in years 2–5), with about as many fleets (45 → 43) and power. 362 of the
  406 late seed-years have such a pair on an average day; 123 of those see no battle that sinks a
  ship.
- **The navies at war stand in port.** Of the sea pairs' fleets, 4.6 % are under way on a day in
  year 1, 1.2 % after (2.1 → 0.5 fleets); battles that sink a ship per sea pair-year 2.1 → 0.2.
  Years 2–5 have more sea pairs and power than year 1 and a third of its fleets under way.

The fall is the third case: navies at war in one basin that do not sail. Which test of the naval
AI's `plan` holds them (no enemy port within `SORTIE_KM`, no forward base, the enemy's power in the
target's zone, the enemy's naval bombers over it, a fleet's own state) is PLAN 7.35d2's measure,
with the three holes 7.35b4 left (a line across land, a sortie's target in another basin, a
partner's port held by the enemy).

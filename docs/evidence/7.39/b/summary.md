# PLAN 7.39b: how a war of two navies begins (14 seeds, 30 years)

Seeds: 1307, 2081, 2953, 3613, 4219, 4877, 5309, 5861, 6421, 7019, 7583, 8167, 8693, 9437. Year 1 is a mean a world; years 2–30 a mean a world-year (406 world-years).

## 1. Wars of two navies begun, and their sea battles between their sides

| | year 1: wars | battles in 30 d / war | in 90 d / war | no battle in 90 d | years 2–30: wars a world-year | in 30 d / war | in 90 d / war | no battle in 90 d |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| all | 9.6 | 2.53 | 2.91 | 25 % | 2.4 | 0.70 | 0.87 | 54 % |
| initial (1938) | 1.1 | 1.56 | 1.56 | 19 % | 0.0 | – | – | – |
| fresh (both navies on day 1) | 8.3 | 2.72 | 3.16 | 26 % | 2.1 | 0.70 | 0.87 | 55 % |
| a navy later (`late` > 0) | 0.2 | 0.33 | 0.67 | 33 % | 0.3 | 0.67 | 0.82 | 53 % |
| nearest fleets of the same waters ≤ 2500 km | 7.1 | 3.14 | 3.49 | 17 % | 0.8 | 1.41 | 1.62 | 21 % |
| nearest fleets of the same waters > 2500 km | 2.4 | 0.94 | 1.42 | 42 % | 1.6 | 0.37 | 0.52 | 70 % |
| nearest fleets of the same waters other waters | 0.2 | 0.00 | 0.00 | 100 % | 0.0 | 0.15 | 0.38 | 77 % |

## 2. Each side's armed fleets on the day the war is first one of two navies (fleets, summed over both sides)

| | home | stThis | stOther | stPeace | sea | moving | engaged |
| --- | --- | --- | --- | --- | --- | --- | --- |
| year 1, ≤ 2500 km (99 wars) | 743 (30 %) | 23 (1 %) | 1003 (41 %) | 30 (1 %) | 5 (0 %) | 649 (26 %) | 10 (0 %) |
| year 1, > 2500 km or other waters (36 wars) | 209 (18 %) | 25 (2 %) | 696 (60 %) | 4 (0 %) | 0 (0 %) | 233 (20 %) | 0 (0 %) |
| years 2–30, ≤ 2500 km (306 wars) | 1151 (22 %) | 366 (7 %) | 1810 (35 %) | 33 (1 %) | 2 (0 %) | 1705 (33 %) | 93 (2 %) |
| years 2–30, > 2500 km or other waters (652 wars) | 2525 (23 %) | 520 (5 %) | 5232 (47 %) | 125 (1 %) | 3 (0 %) | 2756 (25 %) | 11 (0 %) |

What the naval AI does with the standing ones that day (`sortieWhy`), fleets:

| | awayBeside | awayHome | awayHunt | awayNewStation | awayStation | emptyBombed | noBase | noTarget | stage | take | tooStrong |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| year 1 | 0 | 59 | 383 | 1 | 1343 | 0 | 2 | 0 | 224 | 726 | 0 |
| years 2–30 | 2 | 53 | 1100 | 98 | 6756 | 8 | 574 | 7 | 848 | 2299 | 22 |

## 3. The km between the two sides' nearest armed fleets of the same waters, on that day

| | wars | other waters | quartile 1 | median | quartile 3 |
| --- | --- | --- | --- | --- | --- |
| year 1 | 135 | 3 | 350 | 909 | 2234 |
| years 2–30 | 958 | 13 | 1972 | 4423 | 7895 |

## 4. Sea battles: where they begin and who sailed to them

A fleet "moved" was under way the hour before the battle began (the hunter); one that "stood" was not (the prey). Side a and b are the battle's two nations; a port is one whose water is within `AT_PORT_CELLS`.

| | battles | by a port of a side | by another's port | at sea | war age ≤ 30 d | one side all stood | both moved |
| --- | --- | --- | --- | --- | --- | --- | --- |
| year 1 (a world) | 29.6 | 56 % | 17 % | 27 % | 85 % | 88 % | 12 % |
| years 2–30 (a world-year) | 3.4 | 68 % | 15 % | 17 % | 48 % | 93 % | 7 % |

## 5. Per seed, years 2–30: wars of two navies begun, with no battle in 90 days, and the late battles

| seed | wars | none in 90 d | far (> SORTIE_KM or other waters) | late battles |
| --- | --- | --- | --- | --- |
| 1307 | 79 | 47 | 55 | 113 |
| 2081 | 65 | 36 | 39 | 77 |
| 2953 | 63 | 37 | 50 | 83 |
| 3613 | 81 | 57 | 62 | 81 |
| 4219 | 43 | 10 | 21 | 119 |
| 4877 | 71 | 35 | 48 | 128 |
| 5309 | 63 | 38 | 50 | 96 |
| 5861 | 79 | 39 | 56 | 94 |
| 6421 | 61 | 27 | 33 | 97 |
| 7019 | 68 | 34 | 44 | 121 |
| 7583 | 71 | 43 | 55 | 83 |
| 8167 | 74 | 40 | 43 | 96 |
| 8693 | 71 | 42 | 44 | 93 |
| 9437 | 69 | 37 | 52 | 97 |

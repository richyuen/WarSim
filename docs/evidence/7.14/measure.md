# PLAN 7.14: wars without a land front, and late causes of war (measures)

Probes: `tools/diag/warFronts.ts <seed> 50` (each war's days with and without a land front, `warsWithFront`, sampled at the end of each day; declarations a year) and `tools/diag/warGates.ts <seed> 50` (which gate of the strategic AI's declaration stops each actor's turn). Before: HEAD `f5822cd`. After: FRONTLESS_DAYS 365 (ADR-480) and RESTLESS 0.3 over RESTLESS_YEARS 10 (ADR-481).

## Before

| Seed | Wars | Longest run with no land front (days, end-of-day sample) | Declared y1–10 | y21–30 | y41–50 | Years 41–50 ending with no war |
|---|---|---|---|---|---|---|
| 1 | 403 | 1352 | 99 | 94 | 70 | 2 |
| 2 | 310 | 951 | 93 | 71 | 33 | 4 |
| 3 | 443 | 645 | 111 | 93 | 77 | 0 |
| 4 | 337 | 1474 | 124 | 66 | 36 | 1 |
| 5 | 343 | 1767 | 123 | 63 | 54 | 0 |
| 6 | 428 | 1136 | 116 | 93 | 81 | 0 |
| 7 | 314 | 587 | 100 | 57 | 53 | 2 |
| 8 | 352 | 828 | 113 | 69 | 53 | 2 |
| 9 | 398 | 720 | 121 | 63 | 95 | 0 |
| 10 | 389 | 719 | 101 | 75 | 59 | 1 |
| all | | | 1101 | 744 | 611 | |

3717 wars. Longest run with no land front: 95th percentile 120 days, 99th 635, most 1767. Runs of 365 days or more: 89 wars; 730 or more: 9. A war with no front and no fight to the death ran to the 720 days of the stalemate peace (STALEMATE_DAYS), nobody fighting anybody (the critic's "two years"); a fight to the death to its five years (1,767 days of no front, China on Malaya, seed 5).

## Declaration gates before (seeds 1, 3, 5; actors' turns by decade)

| Seed | Decade | Turns | Pacifist | At MAX_WARS | No neighbour it may declare on | Best utility ≤ DECLARE_AT | Passed (then the draw) | Mean best utility of those stopped | its OPPORTUNITY part | its ratio part |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 29056 | 7612 | 4153 | 1705 | 14861 | 725 | 0.029 | 0.14 | 0.013 |
| 1 | 2 | 28781 | 8627 | 3557 | 3152 | 12883 | 562 | 0.068 | 0.104 | 0.052 |
| 1 | 3 | 26390 | 7994 | 1759 | 3699 | 12271 | 667 | 0.09 | 0.073 | 0.035 |
| 1 | 4 | 24886 | 8122 | 956 | 3467 | 11952 | 389 | 0.06 | 0.053 | 0.025 |
| 1 | 5 | 25601 | 7066 | 1717 | 2974 | 13249 | 595 | 0.04 | 0.063 | -0.04 |
| 3 | 1 | 28877 | 7558 | 1649 | 1902 | 16837 | 931 | 0.025 | 0.133 | -0.003 |
| 3 | 2 | 29137 | 9054 | 1841 | 2795 | 14491 | 956 | 0.025 | 0.115 | 0.025 |
| 3 | 3 | 29741 | 10716 | 2840 | 2913 | 12304 | 968 | 0.039 | 0.13 | 0.011 |
| 3 | 4 | 24940 | 9925 | 1206 | 1872 | 11405 | 532 | 0.075 | 0.052 | 0.037 |
| 3 | 5 | 24336 | 9429 | 667 | 2358 | 11346 | 536 | 0.095 | 0.071 | -0.011 |
| 5 | 1 | 28610 | 7820 | 1425 | 2554 | 15796 | 1015 | 0.051 | 0.101 | 0.018 |
| 5 | 2 | 27020 | 8354 | 972 | 3173 | 13925 | 596 | 0.082 | 0.121 | -0.006 |
| 5 | 3 | 31470 | 9028 | 3989 | 2319 | 15031 | 1103 | 0.014 | 0.138 | -0.054 |
| 5 | 4 | 35994 | 10208 | 4579 | 2984 | 17643 | 580 | -0.02 | 0.147 | -0.069 |
| 5 | 5 | 35601 | 10657 | 3144 | 3477 | 17366 | 957 | 0.021 | 0.12 | -0.086 |

The draw then declares with probability DECLARE_P × aggression/100 (mean aggression 18–25). A turn stopped below DECLARE_AT (0.5) has a best utility of 0.01–0.10, most of it OPPORTUNITY (the target is at war already): wars came of wars, and fewer wars made fewer.

## After

| Seed | Wars | Longest run with no land front (days, end-of-day sample) | Declared y1–10 | y21–30 | y41–50 | Years 41–50 ending with no war |
|---|---|---|---|---|---|---|
| 1 | 541 | 365 | 152 | 83 | 88 | 0 |
| 2 | 345 | 365 | 121 | 55 | 37 | 0 |
| 3 | 465 | 423 | 120 | 79 | 90 | 0 |
| 4 | 405 | 365 | 118 | 81 | 61 | 0 |
| 5 | 476 | 365 | 119 | 118 | 67 | 1 |
| 6 | 526 | 365 | 146 | 84 | 74 | 0 |
| 7 | 610 | 365 | 116 | 136 | 121 | 0 |
| 8 | 565 | 365 | 131 | 107 | 115 | 0 |
| 9 | 430 | 365 | 109 | 94 | 59 | 0 |
| 10 | 555 | 365 | 132 | 103 | 97 | 0 |
| all | | | 1264 | 940 | 809 | |

The end-of-day sample of seed 3 joins three runs of China's fight to the death with France (war 60) across days 1440, 1710 and 1912, on which the rule's own sample at 00:00 found a front (a day-by-day check of the two samples on seed 3: those three days are the only ones on which they disagree); by the rule's count (`War.frontless`) no war of the ten seeds went past 365 days, and war 60 ended 365 days after its last front (day 2192 to 2557).


## The 50-year sweep after

`npm run sweep -- --first 1 --tag 714`: `docs/sweeps/2026-10-17-sweep-714.md`, seeds 1–10 × 50 years, ALL GREEN:
limits 10 of 10, riser 10 of 10, faller 10 of 10, no stasis 9 of 10, no break-up 10 of 10; a war active in 100 % of the
years of every seed. Wall time 16.8 min.

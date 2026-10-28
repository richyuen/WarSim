# PLAN 7.150's AT (2026-10-28)

Rule: ADR-745, committed `02d1b1cd`. HEAD: `d457d0fe` (in `WarSim_base`). Seeds 1401–1410, unseen.
Tools: `tools/diag/contactYears.ts` (`SAVE_DIR` writes the year-10 and year-20 worlds),
`tools/diag/phantomWars.ts` (61 days from each year-20 save, the seven 10-day samples).

## Clause 1: engaged land formations a day, years 2–30 against year 1 (bar 0.2 ×), year 1 against HEAD (bar 0.95 ×)

| seed | HEAD year 1 | rule year 1 | rule years 2–30 | ratio |
|---|---|---|---|---|
| 1401 | 28.43 | 33.51 | 13.66 | 0.408 |
| 1402 | 36.15 | 48.85 | 16.59 | 0.340 |
| 1403 | 36.66 | 48.40 | 13.11 | 0.271 |
| 1404 | 34.49 | 36.82 | 14.35 | 0.390 |
| 1405 | 33.52 | 34.56 | 12.44 | 0.360 |
| 1406 | 36.56 | 49.22 | 13.55 | 0.275 |
| 1407 | 37.00 | 45.88 | 14.03 | 0.306 |
| 1408 | 33.56 | 41.68 | 10.30 | 0.247 |
| 1409 | 34.18 | 51.52 | 11.68 | 0.227 |
| 1410 | 29.41 | 41.62 | 13.69 | 0.329 |
| mean | 34.00 | 43.21 (1.27 ×) | 13.34 | 0.309 |

Met. (HEAD × 20 years on the same seeds: years 2–20 6.09 a day, 0.179 × its year 1.)

## Clause 2: no world with a war on land showing nobody in contact on more than two of seven samples (year 20)

| seed | rule: engaged at days 0, 10, …, 60 | empty | HEAD | empty |
|---|---|---|---|---|
| 1401 | 2, 6, 14, 18, 8, 7, 9 | 0 | 4, 3, 6, 5, 4, 2, 2 | 0 |
| 1402 | 10, 19, 11, 12, 9, 27, 33 | 0 | 0, 0, 2, 6, 3, 0, 7 | **3** |
| 1403 | 8, 16, 10, 14, 6, 13, 16 | 0 | 2, 7, 4, 12, 11, 9, 5 | 0 |
| 1404 | 11, 6, 13, 8, 14, 9, 5 | 0 | 7, 0, 0, 2, 2, 2, 0 | **3** |
| 1405 | 5, 2, 7, 10, 23, 20, 19 | 0 | 2, 2, 4, 0, 5, 9, 3 | 1 |
| 1406 | 0, 0, 0, 2, 4, 18, 2 | **3** | 2, 0, 2, 4, 6, 2, 3 | 1 |
| 1407 | 16, 19, 16, 11, 17, 17, 17 | 0 | 3, 0, 0, 2, 6, 3, 9 | 2 |
| 1408 | 0, 0, 0, –, 0, 0, 2 | **5** | 9, 9, 17, 9, 3, 6, 6 | 0 |
| 1409 | 5, 12, 11, 8, 2, 4, 13 | 0 | 2, 0, 0, 4, 0, 0, 0 | **5** |
| 1410 | 13, 7, 21, 40, 28, 21, 18 | 0 | 6, 0, 0, 4, 0, 0, 0 | **5** |

Missed: 2 worlds of 10 (HEAD 4); empty samples 8 against 20; mean engaged at the samples 11.0 against 3.6.
- 1408 at year 20: the United States against Colombia (9 formations), a new nation (4, no manpower) and Cuba (3),
  and a Soviet war on Siam 14 days old: the weak sides have no men left to levy, or the war is days old.
- 1406: Poland against Denmark (38 against 28 formations, 889 cells) and Germany against Albania (110 against 54,
  5,470 cells), armed on both sides and quiet for the window's first 30 days.

## Run time (seed 1408 × 30 years, both arms at once on separate cores, `--affinity` 0x00FF / 0xFF00)

Mean tick 2.94 → 3.13 ms (1.065 ×); the worst year 3.88 (year 12) → 4.75 ms (year 28); formations (all kinds) at years 10,
20, 30: 666, 787, 683 → 1,022, 1,293, 1,099.

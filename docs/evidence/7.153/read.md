# PLAN 7.153's read on HEAD (2026-10-28)

HEAD `f1515d37` (in `WarSim_base`), seeds 1421–1430 × 30 years, the AT's own seeds, no rule run on them.
Tools: `tools/diag/contactYears.ts` (checkpoints at years 10 and 20: the save stepped 7 days, engaged read at day 0
and after each day, "nobody in contact" when all 8 are 0; the five largest at each year's end by land cells
controlled, as the critic's `c17_headless.ts` counts them, and by km², `orderedRun` / `orderedRunKm2` the longest
run of one order), `tools/diag/phantomWars.ts` (61 days from each year-20 save, the seven 10-day samples, 7.150's
measure).

| seed | engaged year 1 | years 2–30 | checkpoints y10 / y20 (daily engaged) | empty | ordered five (cells) | (km²) | y20 10-day samples | empty samples |
|---|---|---|---|---|---|---|---|---|
| 1421 | 38.2 | 16.06 | 10,2,6,16,14,17,35,4 / 5,8,4,7,3,0,2,2 | 0 | 3 | 2 | 5,2,8,0,7,0,3 | 2 |
| 1422 | 35.6 | 7.96 | 9,3,3,7,7,17,17,16 / 3,2,7,3,18,5,16,20 | 0 | 3 | 3 | 5,9,9,7,13,0,3 | 1 |
| 1423 | 55.2 | 12.14 | 14,15,9,10,12,18,13,5 / 19,18,14,20,16,21,19,22 | 0 | 3 | 2 | 21,31,22,7,14,19,11 | 0 |
| 1424 | 53.7 | 14.88 | 6,7,4,6,7,4,0,2 / 43,30,23,15,20,31,29,25 | 0 | 7 | 2 | 25,34,16,24,20,13,6 | 0 |
| 1425 | 34.4 | 14.68 | 4,0,4,5,2,2,3,0 / 8,4,6,8,11,0,11,42 | 0 | 4 | 3 | 7,46,16,4,10,2,8 | 0 |
| 1426 | 50.7 | 11.82 | 0,0,0,0,0,0,0,0 / 4,2,6,5,5,3,7,3 | 1 | 6 | 3 | 2,0,0,13,4,5,4 | 2 |
| 1427 | 50.9 | 15.60 | 9,17,22,19,24,20,17,13 / 5,0,8,4,2,7,2,4 | 0 | 5 | 3 | 5,2,14,11,8,0,12 | 1 |
| 1428 | 45.7 | 8.98 | 23,17,15,11,14,13,19,13 / 2,9,3,0,3,3,3,0 | 0 | 6 | 3 | 0,0,0,0,2,0,3 | 5 |
| 1429 | 42.3 | 12.97 | 6,5,8,7,7,13,12,10 / 29,28,9,15,9,14,12,14 | 0 | 4 | 3 | 33,10,26,14,11,8,13 | 0 |
| 1430 | 43.1 | 12.47 | 9,6,5,2,13,0,7,6 / 3,3,0,2,3,7,4,5 | 0 | 10 | 7 | 6,6,10,0,5,6,11 | 1 |

- **Clause 1** (checkpoints with nobody in contact at most half HEAD's, and at least one fewer): HEAD **1 of 20**
  (1426 year 10). The critic's 17 of 128 is of `cfedb50a`, before the levy (ADR-745); 7.150's levy arm read 0 of 20
  on 1401–1410. The bar asks 0 of 20: one checkpoint, inside a ten-seed run's noise.
- **Clause 2** (the same five largest in the same order at most 12 years in every world): HEAD **met** in all ten,
  longest 10 years by cells (1430), 7 by km². The critic's failing worlds (5521 18 years, 7901 14) are 2 of 64.
- **7.150's measure** (year-20 worlds with nobody in contact on more than two of seven 10-day samples): HEAD **1 of
  10** (1428: 5), empty samples 12 of 70. 7.150's levy arm read 2 of 10 on 1401–1410.
- **1428's quiet wars:** China against Japan 1,531 days old at score −100, both sides at exhaustion 100, China
  fighting to the death (the stance, PROMPT's baseline; MAX_WAR_DAYS ends it at five years); the others won wars
  (score 64–82) against beaten sides with 7–10 formations. 1406's China–France the same (fight to the death, score
  100). No defect found: the stance and the five-year cap work as specified.

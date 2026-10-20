# PLAN 7.45b — PLAN 7.38's three bars, second read

HEAD `7f87eb8` (7.38b–d, 7.44 and 7.45a on it), `tools/diag/nukeToll.ts <seed> 30 new`, each seed
from 1938 to year 30. The critic's 14 seeds (run 10's), then 10 unseen ones, 761–770: no sweep,
report or tuning had used them (`docs/sweeps/` ends at 741–750; 7.38e's first read took 751–760,
and 756 and 758 became 7.45a's tuning cases). Rows: `b-toll-<seed>.json`.

Bars (PLAN 7.38's AT): no burst with a utility under 0.1 that kills a million; no city struck twice
in one war (the tool counts every decided burst within a hydrogen bomb's blast radius of an earlier
burst of its war); no hydrogen bomb where a fission bomb's place is worth as much.

| Seed | Decided | Bursts | Hydrogen | ≥ 1 M dead | Under 0.1, ≥ 1 M | Restruck in a war | Hydrogen where fission covers |
|---|---|---|---|---|---|---|---|
| 1307 | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| 2081 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 2953 | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| 3613 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 4219 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 4877 | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| 5309 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 5861 | 5 | 5 | 2 | 0 | 0 | 0 | 0 |
| 6421 | 11 | 11 | 5 | 0 | 0 | 0 | 0 |
| 7019 | 5 | 4 | 0 | 0 | 0 | 0 | 0 |
| 7583 | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| 8167 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 8693 | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| 9437 | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| **critic's 14** | 53 | 52 | 8 | 0 | **0** | **0** | **0** |
| 761 | 11 | 8 | 2 | 0 | 0 | 0 | 0 |
| 762 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 763 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 764 | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| 765 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 766 | 6 | 6 | 2 | 0 | 0 | 0 | 0 |
| 767 | 10 | 10 | 0 | 0 | 0 | 0 | 0 |
| 768 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 769 | 3 | 3 | 1 | 0 | 0 | 0 | 0 |
| 770 | 8 | 8 | 5 | 0 | 0 | 0 | 0 |
| **unseen 10** | 45 | 42 | 10 | 0 | **0** | **0** | **0** |

**Verdict: the three bars hold on all 24 seeds.** No burst killed a million on any seed: the most
was 754,042 (767, day 10024, the Soviet Union's fission strike on the United Kingdom at 1.296, under MAD in extreme desperation).
The first read had 20 bursts of a million or more on 24 seeds, 4 of them under 0.1. 22 of the 24
worlds still see a burst (all but 5309 and 762), 98 decisions in all (the first read: 178).

## The tool read the strikes of the resolve without the resolve (corrected)

The first runs of 5861, 6421 and 761 read 1, 1 and 2 hydrogen bursts "where fission covers". Each
was a strike of the resolve, and each row's people were 0 while the burst killed 99,126, 46,544,
32,809 and 335,967. The tool weighs the place after the hour of the decision. By then the war's
`lastStrike` is set, `resolveOf` is 0 and the desperation is the side's own (5861's Italy: 0.026
against the resolve's 1.551). With the gain so small, the tool's own choice of yield went to fission
(no people), so "fission covers" was true by construction. The tool now puts back the war's
`lastStrike` and `resolveStrikes` from before the hour while it weighs the place. The three seeds
were re-run (runs are deterministic: the same decisions and tolls). Every such hydrogen burst then
reads a value above fission's:

| Seed, day | Strike | Value hydrogen / fission | People expected | Utility sim / tool |
|---|---|---|---|---|
| 5861, 6845 | Italy → Soviet Union | 0.446 / 0.434 | 0 | 0.242 / 0.236 |
| 5861, 6935 | Italy → Soviet Union | 0.453 / 0.434 | 88,000 | 0.279 / 0.271 |
| 6421, 10231 | Soviet Union → Latvia | 0.423 / 0.366 | 37,000 | 0.184 / 0.173 |
| 6421, 10321 | Soviet Union → Hungary | 0.520 / 0.381 | 14,000 | 0.320 / 0.311 |
| 761, 8484 | Japan → Netherlands | 0.995 / 0.449 | 8,000 | 0.592 / 0.593 |
| 761, 8889 | Poland → Soviet Union | 0.790 / 0.430 | 325,000 | 0.129 / 0.125 |

The tool's recomputed utility is now within 0.011 of the sim's (it was 0.04 to 0.09 low on these
rows). The other 21 seeds had no hydrogen strike of the resolve, so the fix cannot change their rows.

## Places struck in more than one war (ADR-566, for the user; not counted)

| Seed, day | Strike | Earlier bursts within a blast radius (day, by, dead) | Dead |
|---|---|---|---|
| 5861, 6755 | Italy → Soviet Union | 5380 UK 85,456 | 57,273 |
| 5861, 7639 | UK → Soviet Union | 5380 UK 85,456; 6755 Italy 57,273 | 76,768 |
| 9437, 6724 | Italy → Soviet Union | 6358 Poland 183,183 | 178,111 |
| 761, 8889 | Poland → Soviet Union | 8519 Italy 46,366 | 335,967 |
| 767, 10024 | Soviet Union → UK | 4394 Soviet Union 577,911 | 754,042 |
| 767, 10417 | UK → Soviet Union | 10025 UK 182,000 | 176,000 |
| 767, 10480 | Soviet Union → UK | 4394 Soviet Union 577,911; 10024 Soviet Union 754,042 | 264,602 |

The first read's seed 9437 Soviet capital, struck in three wars for 2.58 M, 1.70 M and 0.77 M dead,
is now struck twice, for 183,183 and 178,111. Under ADR-566's option a these are not misses; b or c
would count them.

## The critic's named places

At the places 7.38a measured (`docs/evidence/7.38/a-toll-*.json`): no burst at Shanghai (1714.8, 413.8),
Paris (1037.3, 294.8), Tashkent (1418.2, 348.0) or Banda Aceh (1566.3, 565.7) on any of the 24 seeds.
Rome (1095.0, 344.0) is struck once, on seed 1307 (day 4177, Germany at war with Italy, a fission
burst, 183,183 dead; the critic's case was the United States' hydrogen bomb on seed 8693, 3,720,550
dead). On the critic's seeds of those cases: 4877's one burst is France's on Tunisia (70,000 dead);
8693's three are the Soviet Union's on Italy and Poland (18,010 to 75,702); 9437's are the Soviet
capital twice and a Chinese place (183,000).

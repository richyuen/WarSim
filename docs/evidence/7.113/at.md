# PLAN 7.113a: the AT (2026-10-24)

Seeds 951–960 × 20 years from 1938, `tools/diag/airLate.ts`. HEAD `d1a69e1e` in a worktree (`head/`); the rule of
`income.patch` (ADR-686, the user's: the air force under 0.1 of its nation's income with its wings in training, as
many in training as the army's order slots) in the tree (`rule/`; its pin would be 3a38b3bf). Years 2–20, a world.

| seed | wings HEAD | rule | engaged per war HEAD | rule | land formations engaged HEAD | rule | air battles a year HEAD | rule |
|---|---|---|---|---|---|---|---|---|
| 951 | 87.7 | 214.7 | 0.557 | 0.384 | 5.02 | 3.28 | 113.0 | 215.2 |
| 952 | 98.1 | 225.5 | 0.509 | 0.381 | 3.95 | 2.56 | 220.8 | 328.5 |
| 953 | 91.2 | 216.9 | 0.415 | 0.305 | 3.42 | 2.19 | 113.8 | 329.9 |
| 954 | 88.0 | 213.3 | 1.360 | 0.490 | 5.42 | 2.68 | 198.7 | 375.2 |
| 955 | 94.7 | 230.7 | 0.505 | 0.402 | 3.28 | 2.40 | 200.1 | 375.2 |
| 956 | 85.9 | 183.1 | 0.703 | 0.558 | 5.52 | 4.50 | 124.0 | 164.5 |
| 957 | 70.0 | 224.7 | 0.574 | 0.280 | 5.11 | 2.43 | 102.8 | 203.9 |
| 958 | 97.8 | 261.8 | 0.534 | 0.393 | 3.95 | 2.71 | 262.1 | 436.5 |
| 959 | 91.9 | 193.4 | 0.531 | 0.420 | 3.04 | 2.88 | 217.8 | 244.9 |
| 960 | 102.7 | 219.1 | 0.296 | 0.336 | 2.32 | 2.79 | 156.9 | 253.0 |
| **mean** | **90.8** | **218.3** | **0.598** | **0.395** | **4.10** | **2.84** | **171.0** | **292.7** |

- **Wings** (bar 1.25 × HEAD's): 2.40 ×. **Met.** Year 1's 165.5 → 172.4: the air force late is larger than 1938's.
- **Engaged per war** (bar not below HEAD's): 0.66 ×, lower on 9 of 10. **Missed.**
- Air battles (7.113b's bar, 1.25 ×): 1.71 ×; per thousand sortie-hours 1.62 → 1.89; sorties aloft 12.05 → 17.66; wars
  7.57 → 7.49.

At 0.1 of income the air force costs some six times the 1938 world's share of income (0.016), and the money it takes
from month to month is the army's: land formations engaged 4.10 → 2.84 a world.

## The share at 0.035 (ADR-687 a, the user's; `income035.patch`, `r035/`; its pin would be 604f65f2)

| | HEAD | 0.1 | 0.035 |
|---|---|---|---|
| wings, years 2–20 | 90.8 | 218.3 | 210.0 (2.31 ×: met) |
| engaged per war | 0.598 | 0.395 | **0.369 (0.62 ×: missed)** |
| land formations engaged | 4.10 | 2.84 | 2.47 |
| air battles a world-year | 171.0 | 292.7 | 263.8 (1.54 ×) |
| battles per thousand sortie-hours | 1.62 | 1.89 | 2.04 |

By year (ten worlds' mean):

| year | wings HEAD | 0.035 | engaged per war HEAD | 0.035 | wars HEAD | 0.035 |
|---|---|---|---|---|---|---|
| 1 | 166 | 171 | 5.031 | 5.155 | 7.37 | 7.34 |
| 2 | 123 | 153 | 0.794 | 1.236 | 7.65 | 7.05 |
| 3 | 107 | 152 | 0.583 | 0.805 | 7.82 | 6.70 |
| 4 | 99 | 160 | 0.605 | 0.500 | 7.72 | 6.98 |
| 5 | 91 | 163 | 0.617 | 0.303 | 9.00 | 8.66 |
| 10 | 85 | 200 | 0.644 | 0.326 | 7.40 | 6.96 |
| 13 | 86 | 230 | 0.671 | 0.224 | 7.09 | 6.90 |
| 20 | 91 | 265 | 0.388 | 0.353 | 6.67 | 5.58 |

The land war is better than HEAD's while the air forces rebuild (years 2–3), and worse from year 4 as they grow
past it, to 1.6 × 1938's by year 20: the share at either size is not what stops them (0.1 and 0.035 give the same
count); the air force grows while the money lasts. From run 13's six saves over 90 days (`ab035/`) the rule builds
the same wings as HEAD and the land armies at war are the same: its effect is the years' growth, not a month's.

## Whose wings (`tools/diag/airNations.ts`, `nations/`; 951 and 952 at year 20, HEAD and 0.035)

| | 1938 | HEAD 951 | 0.035 951 | HEAD 952 | 0.035 952 |
|---|---|---|---|---|---|
| world's wings | 216 | 92 | 266 | 79 | 303 |
| the USA's | 21 (0.006 of income) | 44 (0.006) | **165 (0.025)** | 32 (0.004) | **172 (0.034)** |
| the Soviet Union's | 30 (0.040) | 4 | 5 (0.004, income 1,389) | 2 | — |
| Italy's | 17 (0.034) | 2 | 7 (0.003, income 2,420) | 2 | — |
| Japan's | 22 (0.036) | 7 | 6 (0.011) | 2 | 3 (0.011) |
| Britain's | 26 (0.018) | 2 | — | 10 | 13 (0.034) |

The growth is the USA's (and rich nations of small 1938 air forces: the Netherlands 2 → 25, Australia 1 → 9): 62 % and
57 % of the world's wings at year 20. The great powers whose air forces year 1 destroyed do not rebuild under 0.035
either: Italy at 0.003 of an income of 2,420, the Soviet Union at 0.004 of 1,389, far under the share. Their gate is
not the share.

## Why the great powers do not rebuild under 0.035 (`gates_951.txt`; an uncommitted counter in step 3c, 951, years 2–20)

Each month, each of seven powers, the first gate that stops its first wing:

| | months stopped by the reserve (price + RESERVE_MONTHS of income) | under the price itself | ordered | gold, mean | income a month |
|---|---|---|---|---|---|
| the Soviet Union | 167 | 49 | 6 | 3,257 | 2,649 |
| Italy | 131 | 48 | 16 | 1,108 | 728 |
| Japan | 131 | 42 | 19 | 1,250 | 933 |
| Britain | 116 | 73 | 4 | 902 | 1,323 |
| France | 95 | 49 | 11 | 717 | 517 |
| Germany (58 months alive) | 39 | 8 | 3 | 2,057 | 1,941 |
| the USA | 5 | 0 | 79 | 70,234 | 5,981 |

Their books are in surplus (the Soviet Union's balance over its need +798 a month) and their treasuries hold about
a month's income: the army at war spends with no reserve (ADR-615) before the wings' turn, and the wings' three
months are never there. The USA, hoarding a year's income, is stopped by the share and its slots alone.

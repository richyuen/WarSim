# PLAN 7.81b: the moving capital captured again and again

Tool: `tools/diag/capitalChurn.ts` (read only). Every `CapitalCaptured` and `CapitalMoved`; per move its
kind (`capture`: a capture of the same nation that hour; `field`: to a plain cell; `other`), the steps
from the new capital to the nearest cell held by a nation at war with its own (`enemyGap`, 4-neighbour
breadth first over land and sea), and the best a candidate had: the cities the nation owns and
controls on the landmass it holds most of (`bestCityMost`), anywhere (`bestCity`), and the cells it
controls (`bestCell`). `saferPassed`: moves where a candidate stood more than 5 steps farther from the
enemy than the pick.

## 1. The cause, on the critic's cases (HEAD `682637b1`)

| case | captures | moves | to a field | moved again within 30 days | median gap (capture, field) | safer passed (capture, field) |
|---|---|---|---|---|---|---|
| 6421, year 10 save + 365 days | 8 | 42 | 37 | 32 (31 field) | 3, 1 | 2 of 3, 38 of 39 |
| 3301, 1938 + 10 years | 275 | 347 | 100 | 158 (79 capture, 79 field) | 6, 1 | 113 of 230, 32 of 117 |

Two causes, one a part:

- **b1, the field capital.** `relocateToField` took the controlled cell nearest the old capital. After a
  capture that is a front cell (gap 1 in every case), and a field capital is lost by any change of
  control, so it fell back one cell with each day's advance: on 6421 the Netherlands' moved 26 times
  between days 38 and 78 of year 11 while it held 5,497 → 5,219 cells; Oman 5 times in 4 days; on 3301
  Sudan 24 moves, Latvia 18.
- **b2, the city.** `relocateCapital` took the largest city on the landmass the nation holds most of
  (ADR-620), wherever the enemy stood: median 5–6 steps from it. On 3301 113 of 230 such moves passed
  over a city of the same land more than 5 steps safer. The thrice-in-30-days cases: Saudi Arabia (day
  1461: Riyadh's successor 4 steps from the enemy, a city 43 steps away passed over), Latvia (3 vs 13),
  the Raj (2 vs 21), French Morocco (3 vs 15), Ceylon (2 vs 6). Small nations overrun (Belgium on day
  1963: 3 vs 6, then 4 cities in 5 days; Palestine: no city farther than 3) lose every city within days
  whatever the order; the farthest first makes their capital the last city to fall.

## 2. The base, `dd3b730`, on unseen seeds 791–800 × 30 years

The tool copied into a worktree of `dd3b730` (it reads the Sim API only).

| seed | captures | moves | to a field | most captures of one nation in 30 days | cases of 3+ in 30 days |
|---|---|---|---|---|---|
| 791 | 125 | 374 | 259 | 4 | 6 |
| 792 | 268 | 442 | 199 | 4 | 13 |
| 793 | 267 | 419 | 191 | 6 | 12 |
| 794 | 141 | 222 | 95 | 3 | 4 |
| 795 | 308 | 520 | 254 | 6 | 15 |
| 796 | 235 | 535 | 316 | 4 | 12 |
| 797 | 229 | 370 | 174 | 4 | 13 |
| 798 | 165 | 276 | 135 | 4 | 9 |
| 799 | 255 | 472 | 253 | 5 | 19 |
| 800 | 195 | 298 | 127 | 5 | 9 |
| **a world** | **218.8** | **392.8** | **200.3** | | **112 in all** |

The critic's 405 a world on `dd3b730` (its own seeds) agrees. `dd3b730` itself has 112 cases of a
capital captured three times in 30 days: the AT's "none" is a bar the old code is far from too.

## 3. b1: a field capital at war goes to the controlled cell farthest from the enemy (ADR-640)

| case | moves | to a field | moved again within 30 days | median field gap |
|---|---|---|---|---|
| 6421, year 10 save + 365 days | 42 → 8 | 37 → 3 | 32 → 0 | 1 → 82 |
| 3301, 1938 + 10 years | 347 → 274 | 100 → 27 | 158 → 86 | 1 → 1 (*) |

(*) 3301's few field moves left are of nations down to a handful of cells. Captures unchanged on both
(275, 8): b1 moves no city capital.

`enemyDistance`, the grid pass, 14 ms a call on the 2048 × 1024 map (88 ms with `neighbours4`'s array:
inlined).

## 4. b2: a lost capital goes to the safest city on its main land (ADR-641)

`CAPITAL_SAFE_STEPS` = 20: the city farthest from the enemy's land up to 20 steps, then the largest.

| case | captures | moves | cases of 3+ captures in 30 days | median gap of a capture's new city |
|---|---|---|---|---|
| 3301, 1938 + 10 years (b1 → b2) | 275 → 181 | 274 → 212 | 13 → 6 | 6 → 13 |
| 6421, year 10 save + 365 days | 8 → 8 | 8 → 8 | 0 → 0 | 20 → 39 |

The six left on 3301 (Nationalist Spain, the Republic, Romania, Czechoslovakia, the Raj, Indochina): the
pick was the safest city on the main land each time (`bestCityMost` = the pick's gap); overrun nations.
The Raj and Nationalist Spain had safer cities on other lands (33, 23 steps), which ADR-620 leaves out.
The bounded pass (out to the safe steps) gives the same picks: 3301 the same counts.

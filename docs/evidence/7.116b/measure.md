# PLAN 7.116b: why a nation at war late with free formations has none in contact

2026-10-25, on HEAD `1cbc0bf3` (the fold of ADR-701 a; pin e28dbfa1). Saves made on HEAD's code
(`tools/diag/armyAtWarAt.ts 6421 20`, `1129 20`: their `_y10.bin` and `_y20.bin`, `.cache/b116/`, not
committed). Year 1 from 1938 (days 120–150). Tools (new): `tools/diag/warContact.ts`, `nearIdle.ts`,
`contactSpells.ts`, `hoverers.ts`; and `frontSpread.ts`, `contactGap.ts` (PLAN 7.79a, 7.104a). Read only.

## 1. The wars and the weaker side

`warContact.ts`, 20 days, daily: each war running by its land formations (on land, of living members).

| case | wars a day | engaged a day | a war | weaker side's formations a war | of them engaged |
|---|---|---|---|---|---|
| 1129 year 1 (day 120–140) | 7.50 | 97.1 | 12.9 | 8.2 | 0.228 |
| 6421 year 1 (day 120–140) | 7.55 | 100.7 | 13.3 | 19.6 | 0.252 |
| 1129 year 10 | 4.95 | 13.5 | 2.7 | 28.1 | **0.046** |
| 6421 year 20 | 6.60 | 9.4 | 1.4 | 6.1 | **0.071** |

- The weaker side is armed late (28 formations a war on 1129's year 10, more than year 1's 8): what fell is the share
  of it in contact, 3–5 × down. Lopsided wars are many late (6421 year 20: a coalition of ~45 nations on the Soviet
  Union's 5 formations; the Netherlands' 35 on Finland's 1), but they are not the cap: the share engaged is.
- 6421 year 20: 4.3 of 6.6 wars a day have both sides armed on a shared landmass with the nearest pair over 12 cells
  apart (4.0 over 60); 1129 year 10: 3.0 of 4.95 wars engaged, 1.0 with no shared landmass.
- Nations at war with a free formation and none engaged: 6421 year 20 36.6 of 38.2 a day, 1129 year 10 24.6 of 28.1
  (year 1: 23.6 of 33.5, 42.9 of 49.7). Most of them stand in a war a partner fights (`*InEngagedWar`), or have no
  enemy formation within 12 cells (`far`).

## 2. Not the retreat

`contactSpells.ts`, 30 days hour by hour (a spell: a formation's run of engaged hours):

| case | engaged an hour | on the retreat an hour | spells begun a war-day | mean spell (h) | retreats a war-day | ended by a retreat |
|---|---|---|---|---|---|---|
| 1129 year 1 | 50.8 | 6.7 | 3.44 | 41.5 | 0.85 | 24 % |
| 1129 year 10 | 7.7 | 2.1 | 1.13 | 30.4 | 0.43 | 37 % |
| 6421 year 20 | 7.5 | 1.4 | 0.95 | 23.9 | 0.21 | 22 % |

Contact begins 3–3.6 × less often a war late; once begun it lasts about as long, and it is broken by a retreat no more
often. Re-entry after a retreat: median 0 h in year 1, 0–24 h late. The lever is contact begun, not contact kept.

## 3. The formations near an enemy and not in contact

`hoverers.ts`, 15 days, daily: free land formations of nations at war 1.5–12 cells from an enemy land formation.

| case | a day | attacking (to an enemy cell) | of them aimed away from that enemy | marching (own side) | standing |
|---|---|---|---|---|---|
| 1129 year 1 | 89.1 | 26.3 | 19.4 (74 %) | 58.5 | 4.2 |
| 6421 year 1 | 141.6 | 49.4 | 33.4 (68 %) | 84.4 | 7.8 |
| 1129 year 10 | 75.0 | 30.5 | 21.5 (70 %) | 37.8 | 6.7 |
| 6421 year 20 | 35.8 | 10.1 | 6.0 (59 %) | 23.8 | 1.8 |

("aimed away": the order's cell farther from that enemy than the formation; within 2 cells of it: 2.5, 7.3, 5.3, 1.1.)
Few stand: the near formations are on the move, and most attacks march on the enemy cell nearest their sector's
centre, past the enemy formation. In year 1 the enemy near is engaged already for 34–56 of them (the fronts are a
line of formations on both sides, and one that walks past meets the next); late for 7–17.

`contactGap.ts` (one day): attacking and holding formations within 4 cells of an enemy, 1129 year 1 127 of 431, year 10
36 of 249; `frontSpread.ts` (20 days): 1129's plans see 536 sectors a plan late (138 in year 1), 62 of them threatened
(8), 3.6 % of the threatened manned (20.7 %), with the formations a plan the same (9.4, 6.7). The fronts are 4 × longer
with the same army: the enemy formation a threatened sector counts stands 4–12 cells behind its front.

## 4. What a rule could move

Not the allotment or the front cells (7.104's rules, `docs/evidence/7.104/rule.patch`; ADR-679) and not the spread
(ADR-693). The attacks that walk past an enemy formation within their sector's reach: about 20 a day on each case, the
same in year 1 and late, so a rule that turns some of them into contact adds about as many engaged in both, which is a
larger share of the late figure (8–13 a day) than of year 1's (56–100).

HEAD on the AT's seeds (1001–1010 × 20, `armyAtWarAt.ts`, the tree at `1cbc0bf3`): engaged a war year 1 6.004, years
2–20 0.666: **0.111** of year 1 (per seed 0.092–0.142). The bar 0.15 is × 1.35 of it.

## 5. The rule, A/B from saves

The rule (`rule.patch`): a sector that attacks (strength ≥ OFFENSIVE_RATIO × threat) with an enemy land formation among
those its threat counts marches on the cell of the one nearest its centre (on the landmass of its hold cell, on an
enemy's cell), not on the enemy cell by its front nearest its centre. Unit case `tests/unit/pursuit1938.test.ts`: red
on HEAD, green with it. `tools/diag/engagedWindow.ts`, both trees from the same saves: late, 60 days from HEAD's year-10
and year-20 saves of 1129 and 6421; year 1, 120 days from 1938 on 1129, 6421, 4877, 7019. Pooled engaged ÷ wars:

| variant | late a war (HEAD 1.155) | × | saves up | year 1 a war (HEAD 11.61) | × | late ÷ year 1, × of HEAD's |
|---|---|---|---|---|---|---|
| any foe | 1.331 | 1.15 | 4 of 4 | 8.88 (2 seeds; HEAD 10.55) | 0.84 | 1.37 |
| not on the retreat | 1.323 | 1.15 | 4 of 4 | 10.47 | 0.90 | 1.27 |
| **in no battle** (not engaged, not on the retreat) | **1.328** | **1.15** | 4 of 4 | **10.84** | **0.93** | **1.23** |
| in no battle, and a holding sector with OFFENSIVE_RATIO over that one foe attacks it | 1.325 | 1.15 | 3 of 4 | 9.76 | 0.84 | 1.37 |

The third is the one taken to the AT: the same late gain, the least taken from year 1 (32,149 engaged formation-days
against HEAD's 33,388, −3.7 %; its wars +3 %). The fourth's late gain is no larger and it costs year 1 most.

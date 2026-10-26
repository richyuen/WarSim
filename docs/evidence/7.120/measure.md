# PLAN 7.120: the late sea war — measured, the rule, the AT

2026-10-26, HEAD `7529e94b` (sim code of `c95202e7`, pin 3a90f72d). Tool `tools/diag/seaYears.ts` (now with
`LOAD=`): per year the sea battles, those that sank a ship, and daily the armed fleets (`fleetPower` > 0), the
nations with one, the pairs at war, those pairs with armed fleets in one basin (`basinAt`) and their fleets.

## 1. Where the fall is (1061–1065 × 20 years, HEAD)

| per world-year (pairs and fleets a day) | year 1 | years 2–20 |
|---|---|---|
| sea battles | 46.6 | 8.08 (0.17 ×) |
| armed fleets | 85.1 | 43.1 (0.51 ×) |
| nations with a navy | 15.8 | 11.1 (0.70 ×) |
| pairs at war with navies in one basin | 2.42 | **0.37 (0.15 ×)** |
| fleets in those pairs | 13.6 | 2.7 |

Battles per fleet of such a pair: 3.4 in year 1, 3.0 late. As ADR-683 found: the navies at war meet as often
once at war; the wars of two navies and the navies themselves are fewer.

## 2. The rule tried (`rule.patch`, not committed)

ADR-683's option (c): a war on a nation with an armed fleet in a basin where the attacker has one weighs
NAVAL_RIVAL more (`navalRivals`, `warUtility`'s term `naval`). Unit case `tests/unit/navalRival1938.test.ts` in the
patch. A/B (1061–1065: 5 years from the year-10 saves, and year 1 from 1938; HEAD in a worktree beside):

| | late battles | year-1 battles | armed fleets late | pairs in one basin late | war pairs late |
|---|---|---|---|---|---|
| HEAD | 8.08 | 46.6 | 42.9 | 0.41 | 308 |
| NAVAL_RIVAL 0.3 | 10.28 (1.27 ×) | 45.4 | 34.2 | 0.70 | 343 |
| NAVAL_RIVAL 0.5 | 9.88 (1.22 ×) | 67.6 | 34.7 | 0.83 | 365 |

## 3. The AT (1077–1086 × 20 years, 0.3, HEAD beside)

| | year-1 battles | late battles a world-year | sinking nothing | armed fleets late | navies late | war pairs late |
|---|---|---|---|---|---|---|
| HEAD | 35.7 | 9.51 | 2.17 % | 42.0 | 10.3 | 315 |
| rule | 55.6 (1.56 ×) | 9.89 (**1.04 ×**, bar 1.3) | 1.48 % | 23.5 | 6.6 | 385 |

Missed. The rule brings the navies together sooner (year 1 × 1.56) and spends them: half the armed fleets
late, and no more battles. What bounds the late sea war is the navies' count (ADR-667 a's rebuild).

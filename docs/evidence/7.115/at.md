# PLAN 7.115: the threatened sectors manned one each before a second, with 7.110b's strike rule (ADR-693)

2026-10-24. HEAD `6589d576` (pin 1ef5c241). Both rules (`rule.patch`, not committed): ADR-692's `DISPERSED_STRIKE`
(a quarter of a strike's fire on a land formation out of contact), and in `operationalAi`'s allotment a pass before
"every sector gets one": a class's threatened sectors with none, the most threatened first, each take one from the
largest allotment of the threatened (the least threatened of those on a tie). The pin would move 1ef5c241 → cdca91eb.

## Why the larger army covered less (measured, `tools/diag/coverWhy.ts`)

`operationalAi`'s duel (seed 1938), Poland, day 30 (tick 696's plan):

| | land formations | engaged | on the retreat | free | cells stood on | largest stack | plan: free allotted, sectors manned, threatened |
|---|---|---|---|---|---|---|---|
| HEAD | 16 | 6 | 5 | 5 | 12 | 4 | 7 in 7, of 17 |
| the strike rule | 26 | 4 | 12 | 10 | 14 | 9 | 9 in 5, of 14 |

- **The allotment.** The threatened sectors share the free formations within their range by their threat (PLAN 7.79b,
  ADR-634). With the strike rule Germany's army also lives, the top threats are 235,000–318,000 men, and the shares of
  the northern sectors (12,000–44,000) floor to none: 2, 2, 2, 1, 2 in five sectors, nine threatened with none.
  "Every sector gets one" takes from the unthreatened alone, so nothing moves them.
- **The retreat** (`retreat.ts`, not the operational AI): 12 of 26 on the retreat, 9 on one cell, from one battle,
  making for the same safe cell. Named here; not touched.
- **The test's read is noisy on HEAD too.** Poland's coverage day by day (`cov_head_pol.txt`): under 0.6 on days 16
  (0.536), 17 (0.519) and 29 (0.556); 0.607 on day 30. With the strike rule (`cov_strike_pol.txt`) higher on days 8–22,
  lower on 24–33.

## The spread on its own terms

With both rules (`cov_both_pol.txt`, `cov_both_ger.txt`): Poland 0.857 on day 10, 0.870 on day 30, mean of days 10–30
0.801, no day under 0.6; Germany 0.741 and 0.905, mean 0.865, no day under 0.6. `operationalAi.test.ts` green (20 of
20): coverage day 10 0.93 / 0.86, day 30 0.95 / 0.87; Germany takes 1,095 cells, Poland none. The unit case
(`spreadHot1938.test.ts` in the patch: four German divisions, nine threatened sectors, half of Poland's army on one):
red on HEAD (two in one sector, threatened sectors with none), green with the rule.

## A/B from one saved state (180 days, the year-10 saves of 901–909, `ab180_both.json`)

| save | at war a war: strike → both | engaged a war: strike → both |
|---|---|---|
| 901 | 22.41 → 22.34 | 0.475 → 0.388 |
| 903 | 35.39 → 35.98 | 0.846 → 0.714 |
| 905 | 45.83 → 43.46 | 0.452 → 0.587 |
| 907 | 70.49 → 73.20 | 1.771 → 1.597 |
| 909 | 48.98 → 51.28 | 0.686 → 0.755 |

Pooled 43.37 → 43.90; engaged down on 3 of 5 (~0.83 → 0.79).

## The AT (971–980 × 20, `tools/diag/armyAtWarAt.ts`, `at_971-980.json`)

| seed | at war a war: HEAD | strike | both | engaged a war: HEAD | strike | both |
|---|---|---|---|---|---|---|
| 971 | 53.3 | 70.2 | 60.0 | 0.487 | 0.847 | 0.598 |
| 972 | 54.1 | 66.5 | 60.9 | 0.531 | 0.718 | 0.537 |
| 973 | 44.2 | 60.0 | 55.3 | 0.563 | 0.478 | 0.712 |
| 974 | 49.6 | 53.9 | 49.3 | 0.313 | 0.564 | 0.708 |
| 975 | 60.1 | 76.4 | 84.9 | 0.777 | 0.768 | 0.808 |
| 976 | 55.3 | 52.1 | 58.9 | 0.522 | 0.622 | 0.841 |
| 977 | 47.1 | 85.2 | 37.4 | 0.514 | 0.808 | 0.485 |
| 978 | 51.6 | 59.8 | 55.4 | 0.350 | 0.565 | 0.617 |
| 979 | 61.2 | 58.0 | 55.8 | 0.491 | 0.783 | 0.690 |
| 980 | 40.8 | 51.2 | 62.9 | 0.513 | 0.633 | 0.761 |

Pooled (ratio of sums): at war a war **51.38 / 62.54 / 56.77** (bar: not below the strike's 62.54: missed; × 1.105 of
HEAD); engaged a war **0.497 / 0.671 / 0.664** (bar 0.671: missed by 0.007; × 1.34 of HEAD). The seeds swing far
(977: 47.1 → 85.2 → 37.4; 975: 60.1 → 76.4 → 84.9).

## Tests the patch restates

- `wholeTanks`: the 48 hours from division 41's first hour with 9 or more volleys at its armour (found, not pinned):
  6 tanks lost with both rules.
- `nukeAlertStop1938` (PLAN 7.109a's scene): the spread moves France's strike from hour 49 to hour 73 (Poland's at
  25 as before; Germany's AI off moves nothing, France's own plan moves it). The patch takes the gap's bound from 24
  to 48 hours; the pause on each strike's tick stays exact. A number of a test loosened: in the options, not hidden.
- The gate green on the patch (`npm run check`, the related tests, the pin cdca91eb).

# PLAN 7.104: why the formations of a nation at war late are not in contact; two rules tried, the AT missed

2026-10-24, on HEAD `9616f965` (the sim code of the critic's run 13, `0c80db1e`). Saves: run 13's
(`critic/c13_seed{4877,7019}_y{10,20}.bin`, and for §5 the year-20 saves of 1129, 6421, 2081, 5861);
year 1 from 1938 (days 180 and 300). Tools (new): `tools/diag/contactGap.ts`, `armyTotals.ts`,
`nationFront.ts`, `planOf.ts`, `spareHot.ts`; `landStates.ts` (PLAN 7.49's). Read only: no rule, the pin
unchanged (f9d18365).

## 1. Nobody engaged, on every late save

`landStates.ts` (`states.json`), the day after the load, land formations of nations at war:

| save | formations | engaged | attack | hold | island | near | far | flips | of them walk-ins |
|---|---|---|---|---|---|---|---|---|---|
| 4877 year 10 | 342 | 0 | 49 | 89 | 96 | 15 | 83 | 111 | 100 |
| 4877 year 20 | 196 | 0 | 48 | 43 | 47 | 17 | 26 | 102 | 97 |
| 7019 year 10 | 546 | 0 | 71 | 353 | 28 | 45 | 28 | 165 | 155 |
| 7019 year 20 | 151 | 0 | 24 | 29 | 16 | 14 | 63 | 43 | 43 |

90–100 % of the cells taken are walk-ins (no formation of the holder's side within 6 cells): the war
late is armies walking into empty land, not armies meeting.

## 2. The two factors

Engaged per war = (land formations at war per war) × (share of them in contact). `armyTotals.ts`
(`totals.json`) and `contactGap.ts` (`gap.json`, `gap_y1.json`):

| | 4877 day 180 | 4877 y10 | 4877 y20 | 7019 day 180 | 7019 y10 | 7019 y20 |
|---|---|---|---|---|---|---|
| land formations of living nations | 926 | 536 | 491 | 670 | 586 | 558 |
| of nations at war | 529 | 342 | 196 | 503 | 546 | 151 |
| their men (M) | 3.62 | 2.44 | 1.36 | 3.97 | 4.02 | 0.84 |
| wars | 5 | 11 | 6 | 7 | 10 | 5 |
| within 12 cells of an enemy formation | 94 (18 %) | 49 (14 %) | 10 (5 %) | 166 (33 %) | 67 (12 %) | 0 |
| beyond 60 cells, or none on its landmass | 326 | 307 | 154 | 233 | 465 | 144 |

- The army at war a war falls 2.5–3 × by year 20, its share within 12 cells of an enemy 3 × or more.
  Together the 9 × of the critic's figure (5.16 → 0.57).
- The world's income is the same in every year (18,300–19,400); the 1938 armies are above what it
  keeps (6.9 M men → 3.3 M on 4877). The USA holds 1.23 M and 2.70 M men at year 20, at peace on both
  seeds: 37 % and 60 % of the world's. Not this task's cause (contact given war); noted.
- Of the warring pairs of nations, 352 of 451 (4877 y20) and 262 of 291 (7019 y20) have one side with
  no land formation at all (year 1: 92 of 311, 98 of 327). The AT counts wars (`wars.list`), not
  pairs, so this is the empty fronts' cause, not the figure's denominator.

## 3. The three cases the task names

- **Idle with no plan** (`nationFront.ts`, `plan_127_7019_y20.txt`): 7019 year 20, #127, 41 formations
  (292,396 men), 28 of them (203,440 men) standing at (1110, 300), 228 cells from any of its front cells
  and 191 from any enemy formation. Its fronts are in Africa (on Italy, Britain, South Africa); the
  plans see 29–30 empty sectors and 3–9 far formations a day, `reachedEmpty` 0, `farHot` 0: the far
  army's class reaches no sector of that front by land. A ferry case (PLAN 7.79c, 7.88–7.98), not the
  allotment's. Contact came on day 11 when enemies walked to the pile (10–20 engaged on days 18–24).
- **Planned to no threatened sector** (`plan_POL_4877_y20.txt`): 4877 year 20, Poland, 27 formations
  on 821 sectors (2,716 front cells on a Soviet Union of 6 formations), 20–22 threatened, 11–12 manned;
  most threatened sectors in range of a class and allotted nobody (the threat is split over the 3 × 3
  sectors of each Soviet division). Two Polish divisions hold 4 and 6 cells from Soviet ones: both
  sides hold (strength under OFFENSIVE_RATIO × threat) the front cell nearest their sector's centre, and
  contact is CONTACT_CELLS (1.5). Over 30 days Poland's engaged reads 0–1.
- **Sent hollow**: in the pairs of §2 a few formations of 27–216 men; not the lever. Formations under
  500 men at year 20: 60 (4877), 43 (7019).

## 4. What a rule could move

Standing far (beyond 60 cells of any enemy, with one on the landmass): 36 / 73 / 97 / 60 on the four
saves, 18–48 % of the army at war. The far march to a threatened sector beyond the range is PLAN 7.87
(dropped, ADR-635 b). Two rules that stay inside what the design has:

1. **Face the enemy**: a threatened sector holds (or attacks) at the front cell nearest the enemy
   formation its threat counts, not nearest its centre (Poland's 4–6 cells).
2. **To the threatened** (`spareHot.ts`, `spareHot_y20.json`, 10 days of each year-20 save): ADR-191's
   "to spare" reach (SPARE_RANGES × the range, 180 cells), now only for sectors with nobody, for a
   threatened sector short of OFFENSIVE_RATIO × its threat. A plan with such a sector has, of the
   planner's free formations:

| save | short sectors a plan | within the range of one | 60–180 cells, not attacking | beyond 180 |
|---|---|---|---|---|
| 4877 y20 | 30.9 | 1.93 | 0.92 | 5.94 |
| 7019 y20 | 5.1 | 2.99 | 0.44 | 11.05 |
| 1129 y20 | 49.9 | 3.33 | 7.53 | 6.83 |
| 6421 y20 | 81.4 | 4.34 | 4.07 | 7.98 |
| 2081 y20 | 37.2 | 2.98 | 3.28 | 7.28 |
| 5861 y20 | 10.3 | 1.11 | 1.87 | 10.50 |

  On 4 of 6 saves the spare range holds about as many again as are within the range of a short
  sector; on 4877 and 7019 few.

## 5. Rule 1 alone (A/B from one saved state)

`tools/diag/engagedWindow.ts`, both trees from the same saves, 60 days (late) and 120 days from 1938:

| window | HEAD per war | rule 1 | × | seeds up |
|---|---|---|---|---|
| year 10 saves (6) | 0.706 | 0.679 | 0.96 | 2 of 6 |
| year 20 saves (6) | 0.445 | 0.494 | 1.11 | 5 of 6 |
| year 1, days 1–120 (4877, 7019, 1129) | 12.30 | 12.75 | 1.04 | 2 of 3 |

Under the ×1.36 the AT needs from run 12's 0.11: not a rule for this task on its own. Formations under
500 men: 319 → 329 (y10), 403 → 401 (y20).

## 6. Rules 1 and 2 together

`rule.patch` (both rules, `ai/operational.ts`; not committed). A/B over 180 days (`ab180/`), both trees
from the same saves:

| saves | HEAD per war | both rules | × | seeds up | under 500 men, HEAD → rules |
|---|---|---|---|---|---|
| run 13's year 20 (4877, 7019, 1129, 6421, 2081, 5861) | 0.294 | 0.388 | 1.32 | 5 of 6 | 390 → 403 |
| HEAD's year 10 of 901–905 (the AT's worlds) | 0.459 | 0.382 | 0.83 | 1 of 5 | 205 → 189 |

## 7. The AT on 901–910 × 20 years

`tools/diag/contactAt.ts` (the critic's sampling, `landEngaged.ts`'s, and the formations under 500 men at
year 20), HEAD `9616f965` (worktree) and HEAD with `rule.patch`, 5 at a time. `at/head/`, `at/rule/`.
Pooled (sum of engaged over sum of wars):

| tree | year 1 per war | years 2–20 per war | of year 1 (bar 0.15) | under 500 men at year 20 (bar: not above HEAD's) |
|---|---|---|---|---|
| HEAD | 5.248 | 0.586 | **0.112** | 567 |
| both rules | 5.014 | 0.519 | **0.104** | 489 |

Per seed (of year 1), HEAD: 0.068 0.162 0.137 0.158 0.083 0.121 0.089 0.135 0.125 0.086 (3 of 10 at or over
0.15); both rules: 0.094 0.079 0.087 0.115 0.159 0.110 0.098 0.115 0.073 0.128 (1 of 10).

## 8. Verdict

The bar is missed, and the rules read under HEAD on fresh worlds: late engaged per war 0.586 → 0.519. On
the late saves they lift contact over a season (×1.32), where the armies already stand on long fronts;
from year 10 of a fresh world they take formations off quiet sectors that later become the front, and
the histories part. The code restored; the pin unchanged (f9d18365).

What is left is the structural half of §2, which no task has worked: the army at war a war is a third of
year 1's by year 20 (the 1938 armies stand above what the economy keeps: 6.9 M men → 3.3 M on 4877, the
world's income flat; the USA, at peace, holds 37–60 % of the world's men at year 20). The allotment's
half was 7.49, 7.79 (seven parts) and this task.

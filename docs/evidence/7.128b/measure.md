# PLAN 7.128b: the late land contact — measured, no rule (ADR-717, to the user)

Counted as the critic's run 15 counts (`tools/diag/contactYears.ts`): engaged land formations (not
fleets, wings or aboard) at hour 12 of each day, the year's mean; checkpoints at the ends of years 10
and 20 (7 days, 8 reads), "nobody in contact" when their mean is 0.

## The AT's seeds, 1121–1130 (`runs/`: `old_` = `311988d7` × 20 years, `head_` = HEAD `75237567` × 30)

| seed | 311988d y1 | HEAD y1 | 311988d y2-20 | HEAD y2-20 | HEAD y2-30 | 311988d empty ckpt | HEAD empty ckpt | 311988d <500 y20 | HEAD <500 y20 |
|---|---|---|---|---|---|---|---|---|---|
| 1121 | 36.65 | 33.27 | 5.03 | 4.92 | 4.61 | 0 | 0 | 111 | 1 |
| 1122 | 41.69 | 40.24 | 3.67 | 4.56 | 4.43 | 0 | 1 | 50 | 2 |
| 1123 | 34.97 | 33.75 | 4.38 | 3.18 | 3.10 | 0 | 0 | 49 | 1 |
| 1124 | 48.76 | 46.00 | 4.11 | 4.93 | 4.38 | 1 | 0 | 54 | 1 |
| 1125 | 43.05 | 42.87 | 6.70 | 5.13 | 4.68 | 1 | 0 | 62 | 0 |
| 1126 | 44.23 | 37.90 | 4.17 | 5.47 | 5.00 | 0 | 0 | 76 | 1 |
| 1127 | 64.50 | 56.27 | 3.81 | 4.31 | 4.42 | 1 | 0 | 161 | 0 |
| 1128 | 39.61 | 37.79 | 7.27 | 3.83 | 3.76 | 0 | 0 | 63 | 0 |
| 1129 | 45.24 | 38.14 | 6.34 | 5.38 | 4.87 | 0 | 0 | 89 | 3 |
| 1130 | 37.15 | 33.28 | 4.93 | 4.44 | 4.46 | 1 | 0 | 63 | 0 |
| **mean** | **43.59** | **39.95** | **5.04** | **4.61 (0.915 ×)** | **4.37** | **4 in all** | **1 in all** | **77.8** | **0.9** |

Against the bars:
- checkpoints with nobody in contact not above `311988d`'s: HEAD 1 of 20 against 4 of 20 — **met on
  HEAD's rules**;
- years 2–30 at least 1.15 × HEAD's: 1.15 × 4.37 = 5.03 a day, which is `311988d`'s level (years 2–20
  5.04) — **no rule, not met**;
- under 500 men at year 20 at most 2 a world: HEAD 0.9 — met.

## Where the late fall is: the same worlds under each commit's rules (`bisect/`, `tools/diag/lateContactAb.ts`)

The three commits to `src/` since `311988d7` that move the pin are ADR-701's fold (`1cbc0bf3`), ADR-703's
far-march wait (`c95202e7`) and ADR-711's lanes (`8267a3a1`). Each tree stepped the same 16 year-20 saves
90 days (seeds 1061 1129 1187 1307 2081 2417 2953 3359 3613 4219 4877 5309 5861 6421 7019 8167).

| saves | `311988d` | the fold `1cbc0bf3` | + the wait `8f6732e3` | HEAD |
|---|---|---|---|---|
| run 14's (`critic/c14_*_y20.bin`, `311988d`'s worlds, remnants in them) | 3.655 | 2.958 | 2.893 | 2.893 |
| run 15's (`critic/c15_*_y20.bin`, `7739a78`'s worlds, folded) | 4.060 | | | 4.077 |

- On a world with no remnants the rules of `311988d` and of HEAD fight the same (4.06 against 4.08 a
  day). The operational AI did not change how often an army comes to battle.
- On a world with them, HEAD folds them on its first day and the contact falls 19 %; the wait costs 2 %
  more and ADR-711 nothing.
- Of `311988d`'s 3.655 engaged a day on those saves, 0.32 are remnants themselves (under 500 men;
  `c14_311988d_hollow.json`); the rest of the fall is their enemies, engaged with them.

So the late gap to `311988d` is the remnants' fights: 685 hollow divisions at year 20 in ADR-701's run
(77.8 a world here) that the critic's run 14 named a defect (R14-B1) and ADR-701 (a) folded. Their
fights counted in the critic's figure; on these seeds they were about 9 % of years 2–20.

## What the late wars are (`lateWarFronts_7019_y20.json`, `tools/diag/lateWarFronts.ts`)

Seed 7019's year 20, the critic's case (6 wars, 0 in contact on 6 of 7 samples): every war but the
newest has a land front; the largest (war 265) is 20 nations against 14, 419 formations against 62,
328 and 57 of them within the deploy range of a frontier of 3,000–4,000 cells, the nearest pair 8–12
cells apart, nobody engaged in 20 days. The fronts are long and the armies thin on them (ADR-702's
"fronts 4 × longer, the same army a plan"), as on `311988d`.

## Why no rule

The bar (5.03) is `311988d`'s figure, and what `311988d` had more of is the remnants' fights. A rule to
win back 15 % would be a fourth operational-AI contact rule: ADR-679, ADR-693 and ADR-702 each read
about × 1.15 from saves and +0–5 % on fresh worlds, moving the wars running and the losses as much as
the contact (ADR-702 d: no rule, no task, the user's decision).

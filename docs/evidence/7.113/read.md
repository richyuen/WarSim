# PLAN 7.113: the air force at war late, the read first (2026-10-24)

HEAD `d1a69e1e` (the sim as `2b7f2474`, the pin c848f884). `tools/diag/airForce.ts` (new) on seeds 941 and
942 × 20 years from 1938 (`force_941.*`, `force_942.*`): wings of living nations, wings built and lost by
cause (from the hour before the loss), aircraft lost by wings that live on, and each month's start, for
each living AI nation at war with an income of POOR_INCOME or more, its air force's upkeep against
AIR_SHARE × its army's (`economicAi` step 3c) and, under it, the first gate that stops the wing.

## 1. Built and lost

| | 941 year 1 | 941 years 2–20, a year | 942 year 1 | 942 years 2–20, a year |
|---|---|---|---|---|
| wings (mean of the days) | 186.0 | 126.9 | 133.2 | 80.1 |
| built | 22 | 7.9 | 19 | 7.8 |
| lost | 88 | 10.5 | 145 | 7.6 |
| of them in the air (shot down or by AA) | 88 | 9.6 | 132 | 7.1 |
| aircraft of the living wings, of full strength | | 0.87 | | 0.81 |

The fall is year 1's: 88 and 145 wings shot down, 22 and 19 built. After it the losses (all but a few in
the air; a base taken 2 and 3, a carrier 14 and 6 in 19 years) and the builds about balance, ~8 a world-year:
the late air force is year 1's survivors. They fly at 81–87 % of their aircraft: a wing is never refilled
(`refillable` is the army's) — noted, not this part's.

## 2. Why so few are built (years 2–20, nation-months at war)

| | 941 | 942 |
|---|---|---|
| air force under its share | 2,519 | 3,639 |
| at or over it | 3,401 | 2,638 |
| under it, stopped by: a wing in training (one at a time) | 506 | 539 |
| — no airfield of its own with room | 362 | 666 |
| — gold under the price | 507 | 748 |
| — **the price held, not RESERVE_MONTHS of income more** | **1,020** | **1,521** |
| — the month's balance, or ordered | 124 | 162 |

The largest gate: the treasury holds the wing's price and not three months' income more. ADR-615 took that
reserve away from the army's orders at war (its army under its peacetime share) and kept it for the wings
as "rules of their own", with no reason given. `balance` is read after the gold here, so the figure is an
upper bound of what the rule frees (§3 reads what it does: nothing). Next gates, noted and not this
part's: one wing in training at a time, then no airfield with room.

## 3. Correction: the gold the read saw was the month's after its income (2026-10-24)

The A/B of 7.113a's rule (`reserve.patch`: a wing at war keeps the army's war reserve; `tools/diag/airAb.ts`,
90 days from run 13's six saves, `ab/head_*`, `ab/rule_*`) reads **the same on all six** as HEAD: the rule
never fires there. `airForce.ts` reads the treasury after the month's tick, with the month's income in it
(and with ADR-615's condition taken apart in `force2_*`: the army under its peacetime share in 950 and 1,427
of those months). Counted inside `economicAi` step 3c instead (an uncommitted counter, 941, with the rule on),
nation-months at war a year:

| year | poor (income < 20) | wing in training | air force at its share | no airfield | reach the gold test | ordered | gold under the price | under the price + reserve, army over its peacetime share |
|---|---|---|---|---|---|---|---|---|
| 1 | 167 | 73 | 50 | 8 | 113 | 17 | 43 | 19 |
| 2 | 262 | 86 | 153 | 22 | 73 | 15 | 26 | 26 |
| 3 | 268 | 80 | 214 | 19 | 40 | 12 | 12 | 16 |
| 4 | 299 | 51 | 310 | 23 | 36 | 8 | 23 | 5 |
| 5 | 286 | 39 | 292 | 0 | 43 | 6 | 36 | 1 |
| 6 | 282 | 40 | 296 | 3 | 37 | 7 | 30 | 0 |

The binding gate late is the share: the air force at AIR_SHARE (0.1) of its army's upkeep, 153–310 months a
year and growing, while those armies cost 5–7 % of the nation's income (year 4: air 915, army 4,427, income
65,888 summed over the months) and their treasuries hold ~5 wing prices. The reserve (7.113a's rule) stops
almost nothing once the army has ordered. At the 1938 start (`monthlyAccounts`, nations of income ≥ 20) the
world's air force is 1.56 % of income (0.066 of its army), the great powers' 3–4 % (Italy 3.4, Japan 3.6, the
Soviet Union 4.0); the nations at their share late spend ~1.4 %.

HEAD on 951–960 (`head/`, the AT's baseline): wings of living nations 165.5 a world in year 1, 90.8 in years
2–20; late air battles 171.0 a world-year; engaged per war 0.598.

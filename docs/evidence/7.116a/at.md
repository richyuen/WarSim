# PLAN 7.116a — the AT (2026-10-25)

Rule: `rule.patch` (not committed): daily, an AI nation's land formation under 500 men, out of contact, folded into the
nearest of its own with room on the same landmass within 50 km, or disbanded (half its men to the pool).

Run: `tools/diag/armyAtWarAt.ts <seed> 20` on seeds 991–1000, HEAD `a5867a5b` in `WarSim_chase` and the rule in the main
tree; `tools/diag/hollowAt.ts` reads both (land formations of living nations on land under 500 men in the `_y20.bin`;
engaged a war = Σ daily engaged ÷ Σ daily wars, years 2–20).

| seed | hollow y20 HEAD → rule | engaged a war y2–20 HEAD → rule | year 1 HEAD / rule |
|---|---|---|---|
| 991 | 88 → 0 | 0.747 → 0.556 | 8.636 / 6.304 |
| 992 | 67 → 0 | 0.789 → 0.563 | 5.007 / 6.217 |
| 993 | 110 → 0 | 0.898 → 0.720 | 6.109 / 6.876 |
| 994 | 68 → 0 | 0.560 → 0.614 | 6.447 / 6.310 |
| 995 | 47 → 0 | 0.552 → 0.443 | 7.146 / 7.438 |
| 996 | 122 → 0 | 0.456 → 0.431 | 8.369 / 7.030 |
| 997 | 73 → 1 | 0.721 → 0.516 | 5.807 / 5.193 |
| 998 | 37 → 0 | 0.543 → 0.529 | 5.234 / 4.757 |
| 999 | 56 → 0 | 0.578 → 0.771 | 5.106 / 4.528 |
| 1000 | 17 → 0 | 0.659 → 0.527 | 8.387 / 7.756 |
| **all** | **685 → 1 (0.001 ×, bar ≤ 0.5: met)** | **0.644 → 0.562 (0.874 ×, bar ≥ 0.95: missed)** | |

Per-seed ratios of the second clause 0.71–1.33, 7 of 10 down.

Years 2–20, means a world-year (the rows of the same runs): land formations 599.2 → 532.3 (−11 %), of nations at war
459.8 → 413.6 (−10 %), engaged 5.03 → 4.76 (−5 %), wars 7.81 → 8.47 (+8 %); raised 85.2 → 88.9, destroyed 100.9 → 106.9
a year.

Before the run, from the critic's year-20 saves (`tools/diag/hollowWhy.ts`, `hollowStep.ts`, HEAD's code): of 89–120
hollow a world, 0–2 engaged, 28–63 on land their nation does not control (never refilled), 39–60 within 25 km of one
of their own with room; with the rule, 0–3 a day through the next 30 days.

Unit test (`tests/unit/hollow1938.test.ts` in the patch): 3 cases red without the hook, green with it.

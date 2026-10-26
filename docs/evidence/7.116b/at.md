# PLAN 7.116b — the AT (2026-10-25)

Rule: `rule.patch` (not committed; measure.md §5, the third variant): a sector that attacks with an enemy land
formation in no battle (not engaged, not on the retreat) among those its threat counts marches on that formation's
cell, the one nearest its centre on the landmass of its hold cell and on an enemy's cell, not on the enemy cell by its
front nearest its centre. Unit case `tests/unit/pursuit1938.test.ts` in the patch: red on HEAD, green with it.

Run: `tools/diag/armyAtWarAt.ts <seed> 20` on seeds 1001–1010, HEAD `1cbc0bf3` in `WarSim_chase` (read first) and the
rule in the main tree, 7 at a time. The figure: engaged land formations a war, Σ daily engaged ÷ Σ daily wars, years
2–20 over year 1's.

| seed | HEAD: of year 1 (year 1 / late a war) | rule: of year 1 (year 1 / late a war) |
|---|---|---|
| 1001 | 0.092 (5.55 / 0.510) | 0.102 (6.48 / 0.661) |
| 1002 | 0.134 (5.84 / 0.784) | 0.128 (4.08 / 0.523) |
| 1003 | 0.142 (5.78 / 0.822) | 0.190 (4.35 / 0.825) |
| 1004 | 0.098 (7.70 / 0.757) | 0.073 (7.15 / 0.525) |
| 1005 | 0.099 (5.77 / 0.573) | 0.128 (5.04 / 0.644) |
| 1006 | 0.094 (7.32 / 0.685) | 0.079 (7.26 / 0.574) |
| 1007 | 0.108 (8.28 / 0.897) | 0.082 (6.42 / 0.527) |
| 1008 | 0.119 (4.32 / 0.514) | 0.150 (5.08 / 0.763) |
| 1009 | 0.108 (5.22 / 0.564) | 0.086 (6.41 / 0.553) |
| 1010 | 0.114 (5.30 / 0.605) | 0.172 (4.43 / 0.760) |
| **pooled** | **0.111 (6.004 / 0.666)** | **0.113 (5.590 / 0.632)** — bar 0.15: **missed** |

5 of 10 seeds up. Years 2–20, a world-year (means of the seeds):

| | HEAD | rule | × |
|---|---|---|---|
| wars running | 7.36 | 8.16 | 1.11 |
| land formations of nations at war, a war | 57.3 | 49.7 | 0.87 |
| of them engaged | 0.0119 | 0.0131 | 1.10 |
| land formations destroyed a year | 99.9 | 113.6 | 1.14 |
| raised a year | 84.9 | 93.3 | 1.10 |

The rule does what it is for on fresh worlds as on the saves (the share of the army at war in contact +10 %), and
the figure does not move: the wars it brings to battle cost more formations and run more wars, and the army a war is
13 % smaller. Year 1 reads 7 % lower. The same split as 7.104's rules (saves up, fresh worlds flat or down; ADR-679).

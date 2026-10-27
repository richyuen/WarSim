# PLAN 7.146's AT: the outnumbered on a land front save for no warship and have one order slot more (ADR-739)

Seeds 1274–1283 (unseen: none run by a task or the critic) × 30 years from 1938, `tools/diag/designBars.ts`, both arms
side by side seven at a time: HEAD before the rule (`49bf9d01`, from the `WarSim_base` worktree) and the rule
(`87fee701`, parts a and b). Raw output in `.cache/7146/at/` (not committed); summary by `tools/diag/designCompare.ts`.

Pooling, fixed before the runs: each figure is the mean over the ten seeds of the per-seed figure (as PLAN 7.138's and
7.140's ATs read `designBars.ts`); "engaged a day per war" is `fronts[3].per` (wars with a land front of 100 cells or
more that day, the engaged land formations of their members), year 1 alone and the mean of years 2–30.

## The bars

| clause | bar |
|---|---|
| engaged a day per war, years 2–30 | at least 1.15 × HEAD's |
| the same, year 1 | not below 0.95 × HEAD's |
| land changing hands each year 2–30 | at least 2 % of the land cells, every world |
| cells taken in front battles | some every year, every world |
| ADR-732: the five largest in order | at most 12 years running, every world, not worse than HEAD's |
| ADR-732: the five strongest | at most 12 years running in 9 of 10, not worse than HEAD's |
| ADR-732: a nation over a third of the land at year 30 | none, not worse than HEAD's |
| a unit test, red without | `navyBudget1938` (two cases, ADR-739) |
| the gate | green on both commits |

## Result: missed on two clauses

| clause | HEAD | rule | bar | |
|---|---|---|---|---|
| engaged a day per war, years 2–30 | 0.964 | 1.086 (1.127 ×) | ≥ 1.109 (1.15 ×) | missed |
| the same, year 1 | 9.55 | 9.63 (1.008 ×) | ≥ 9.07 | met |
| least land changing hands a year (worst world) | 2.52 % | 2.19 % | ≥ 2 % | met |
| least cells taken in front battles a year (worst world) | 339 | 404 | > 0 | met |
| longest run of the five largest in order (worst world) | 7 | 9 | ≤ 12 | met |
| worlds with the five strongest over 12 years | 0 | 0 | ≤ 1 | met |
| worlds with a nation over a third of the land at year 30 | 0 | 2 | ≤ HEAD's | missed |

Per seed, engaged years 2–30 (rule ÷ HEAD): 1274 1.31, 1275 1.84, 1276 0.95, 1277 1.37, 1278 0.77, 1279 1.12, 1280 0.74,
1281 0.93, 1282 1.16, 1283 1.66 (up on 6 of 10). Rule − HEAD, paired: +0.121 ± 0.097 (se of the mean of ten); the bar
+0.145: the miss is within one se, as is most of the gain.

The largest nation at year 30 (HEAD / rule): 1274 SOV 22.7 / USA 15.8 %; 1275 USA 21.1 / USA 16.1; 1276 USA 23.7 / USA
22.8; 1277 USA 14.7 / USA 25.2; 1278 SOV 16.4 / USA 14.5; 1279 ENG 20.0 / **USA 39.3**; 1280 SOV 16.6 / **USA 35.2**;
1281 SOV 17.9 / USA 19.8; 1282 SOV 23.6 / SOV 21.5; 1283 USA 28.3 / SOV 30.2. Mean 20.5 / 24.0 %; the United States the
largest in 4 of 10 on HEAD, 8 of 10 with the rule. On HEAD of 2026-10-27 on 1253–1263 but 1259
(`docs/evidence/7.140/design.md`) the United States was over a third in 2 of 10, and on the filter (1294–1303 × 20
years) HEAD had 1 world over a third and the rule none: two worlds of ten do not tell the rule from the seeds; the
United States largest in 8 of 10 against 4 is the stronger sign. The rule does not reach the United States itself: on
the HEAD saves of 1294, 1297, 1300, 1303 (`gates_y10.json`, `gates_y20.json`, `fronted_y*.json`) it has 6 order slots
(MAX_PARALLEL; income 5,600–11,800), no warship's saving (its price 0) and is on the strong side of every long-front war
it is in. Its larger share is of what the rule does to others (its enemies, or its rivals' wars), or of the seeds.

Against the filter (1294–1303 × 20 years: 1.26 ×), the late figure on fresh worlds over 30 years is half the gain.

Run time (side by side, not paired): HEAD 8,612 s for the ten runs, the rule 8,660 s.

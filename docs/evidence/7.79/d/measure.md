# PLAN 7.79d: the far army and the threatened sectors beyond the range (measured; no rule, ADR-635)

2026-10-22, on HEAD `7bcadb21` (PLAN 7.79b's rule). Saves: run 12's `critic/c12_seed{1129,2081,6421}_y20.bin`,
the three of `../measure.md` §2.1 where 88–98 % of the threatened sectors are beyond DEPLOY_RANGE_CELLS
of the planner's army. Window: the AT's, "after 30 days": days 21–30 after the load (`seed:bin:20`, 10
days), as `../b/d21_rule/`. Tools: `tools/diag/frontSpread.ts` (columns `threatenedNearAPlan`,
`farAFarPlan`, `farHotAFarPlan`, `farHotCells`, `farHotNearAFarPlan` added) reading `OP_PROBE.sectors`
(fields `inRange`, `empty.farHot`, `farHotCells`, `farHotNear` added: read only, in no save and no
hash, the pin unchanged); `tools/diag/marchSpeed.ts`.

## 1. HEAD's figure (the AT's bar)

`probe/late_*_y20.json`. HEAD's `inRangeThreatenedAPlan` reads the same as `../b/d21_rule/` (the same
code, the same window): the probe fields change nothing.

| save | threatened a plan | threatened in range of a class allotted (`inRangeThreatenedAPlan`) | of any formation of the planner (`threatenedNearAPlan`) | the bar (twice HEAD's) |
|---|---|---|---|---|
| 1129 year 20 | 9.25 | 1.27 | 1.51 | 2.54 |
| 2081 year 20 | 24.52 | 1.62 | 1.80 | 3.24 |
| 6421 year 20 | 28.24 | 5.58 | 5.58 | 11.16 |

## 2. What a far formation could serve

Per plan with far formations (the far are those standing on their day in MARCH_DAYS, so over the 10
days every far formation is read): the far formations, those whose class reaches a threatened sector
on its own landmass (`reached`, the landmass test of `emptyFor`; `reaches`' wide-ground join not
asked, so an upper bound), the straight distance to the nearest such sector's centre (a lower bound
on the way), and those within 110 cells of it (the range and 30 days of march).

| save | far a plan | of them reaching a threatened sector | share | cells to the nearest (mean) | within 110 cells |
|---|---|---|---|---|---|
| 1129 year 20 | 5.59 | 0.96 | 0.17 | 330 | **0** |
| 2081 year 20 | 1.29 | 0.15 | 0.11 | 353 | **0** |
| 6421 year 20 | 7.41 | 0.17 | 0.02 | 206 | **0** |

March speed (`marchSpeed.ts 6421 critic/c12_seed6421_y20.bin 5`, map 2048 × 1024): land formations on
the march cover 1.4 / 1.7 / 2.0 / 2.1 cells a day (p25 / p50 / p75 / p90), straight line. 30 days are
50–60 cells; a formation sent on its day in MARCH_DAYS has 22–30 of them.

## 3. Reading

No far formation that could serve a threatened sector is within the range plus a month's march of
one: those that reach one stand 206–353 cells off, 80–170 days of march before they are within the
range. The window is generous (straight lines, the wide-ground join not asked, 110 cells for at most
30 days). So the rule of 7.79d (a far formation marches to the nearest threatened sector short of its
threat's share) cannot raise `inRangeThreatenedAPlan` within 30 days on these saves, by any share:
the AT's bar is out of its reach, and the rule was not written (ADR-554: the bar missed, BLOCKERS).

Two figures beyond the bar:
- Most far formations reach no threatened sector at all on their landmass: 83 %, 89 % and 98 % of
  them (the overseas wars of 7.79a §3). That is PLAN 7.79c's (the ferry), the larger lever.
- Over a season the rule could serve the few that do (0.17, 0.15 and 0.17 a far plan); whether that is
  worth a march of four to seven months is ADR-635's question, the user's.

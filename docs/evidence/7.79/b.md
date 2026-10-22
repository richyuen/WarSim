# PLAN 7.79b: the threatened sectors first (ADR-634)

2026-10-22. Tool: `tools/diag/frontSpread.ts` (columns `canTake`, `filledOfCanTake`,
`keptColdOfCanTake`, `cellsChanged` added; `OP_PROBE.sectors` read only). Saves: run 12's
(`critic/c12_seed*_y{10,20}.bin`), the 7 late ones of `measure.md` §2.1; year 1 of 6421 and 7019.

- `head/`: HEAD's rule (`b5af8b75`), late saves days 1–10, year 1 from 1938 days 61–90.
- `rule/`: the rule as committed, the same reads.
- `d21_head/`, `d21_rule/`: the late saves, days 21–30 after the load (the marches the old rule
  had under way in the saves are over by then). `d21_rule_errand/`: a form of the rule set aside (§2).
- `ab/`: year 1, both rules from one day-60 save of HEAD's rule (`.cache/ab/`), 30 days.
- `planParts_30d.jsonl`: the plan's parts in ms over 30 days from 6421 and 2081 year 20, both rules.

## 1. HEAD first: the AT's figure already passed

`canTake` is, per class, the formations within DEPLOY_RANGE_CELLS of a threatened sector it is
allotted to (distinct formations; a formation is in the pool of every sector within the range of
it, so the sum of the pools overcounts). On HEAD `allottedThreatenedBefore / canTake` was
0.88–1.63 on 6 of the 7 saves and 0.455 on 7019 year 20: the counts overlap where pools do, so the
AT's figure passed on HEAD and cannot tell the rule. The figure that does is `filledOfCanTake`: of
`canTake`, those placed in a threatened sector after the fill. On HEAD late it was 0.37–0.46 (1129:
1.0, where almost nobody is within the range of a threat), in year 1 0.62–0.82.

Two causes in the allotment. The weights: the threatened sectors were outweighed by the length of
the empty front. And the marches kept by ADR-53: with the weights changed alone, `filledOfCanTake`
moved 0.37–0.46 → 0.37–0.48, because 0.52–0.63 of `canTake` were on a march, kept, into a sector
with no threat (`keptColdOfCanTake`).

## 2. The rule (ADR-634)

The threatened sectors share, by threat, as many formations as are within the range of one; the
other sectors share what is left by 1 + threat / THREAT_UNIT. "Every sector gets one" takes only
from the sectors with no threat. A march into a sector with no threat, by a formation within the
range of a threatened sector, yields to the threatened sectors' allotments and is kept when none
takes it. A march that began beyond the range of its sector (one from afar or to spare) does not
yield.

Two other guards were tried. Exempting every march "on an errand" (PLAN 3.10c1d2: into a sector
that would have nobody without it) left the late gain mostly undone (`d21_rule_errand/`: 2081
year 20 0.023, the same as HEAD), because late almost every march into the empty front is the only
one going there. "Yield only to a threatened sector nearer than the march's end" did not keep the
spare marches (`operationalAi.test.ts` "to spare"): a march to spare starts at the threatened end
with its end just within the range (59.9 cells against 2.5). The march's start (`originCell`)
tells them apart: the allotment sends nothing from beyond the range.

## 3. Late saves

| save | filled / canTake, days 1–10: HEAD → rule | days 21–30: HEAD → rule | share of the army in threatened sectors, days 1–10 | engaged a war, days 1–10 |
|---|---|---|---|---|
| 6421 year 10 | 0.410 → 0.735 | 0.680 → 0.808 | 0.079 → 0.132 | 0 → 0 |
| 6421 year 20 | 0.456 → 0.506 | 0.146 → 0.278 | 0.145 → 0.157 | 0.04 → 0.04 |
| 7019 year 10 | 0.437 → 0.794 | 0.370 → 0.866 | 0.069 → 0.123 | 0.098 → 0.127 |
| 7019 year 20 | 0.369 → 0.850 | 0.175 → 0.846 | 0.232 → 0.530 | 0 → 0.46 |
| 1129 year 10 | 1.032 → 1.254 | 0.622 → 1.000 | 0.039 → 0.047 | 0.06 → 0.06 |
| 1129 year 20 | 1.000 → 1.000 | 0.450 → 0.900 | 0.006 → 0.006 | 0.18 → 0.18 |
| 2081 year 20 | 0.366 → 0.659 | 0.023 → 0.545 | 0.053 → 0.097 | 0.10 → 0.10 |

The AT's figure, `allottedThreatenedBefore / canTake`, is 1.0 on all 7 (bar 0.5). The share of the
army in threatened sectors rises where the army is within the range of the threats; it stays small
where it is not (1129: 0.006–0.124 of the formations are within the range of a threatened sector at
all), which is PLAN 7.79d's. Engaged per war moves little on 10 days.

## 4. Year 1

From one day-60 save (`ab/`), 30 days:

| seed | share in threatened, HEAD → rule | filled / canTake | engaged a war | cells that changed hands |
|---|---|---|---|---|
| 6421 | 0.741 → 0.895 | 0.815 → 0.976 | 14.6 → 17.4 | 2,529 → 2,012 |
| 7019 | 0.578 → 0.857 | 0.622 → 0.919 | 10.5 → 12.1 | 4,773 → 3,299 |

From 1938 (days 61–90, `rule/`): 6421 0.741 → 0.691, 7019 0.578 → 0.762. On 6421 the share is
`canTake` × 0.98: what fell is the formations within the range of a threat (0.909 → 0.704) after 60
days in which the two rules made two wars. The year-1 clause is judged on the read from one save.
A fifth to a third fewer cells change hands in the 30 days: the empty front gets less of the army.
Which side's cells and why is not read here (PLAN 7.80 counts the late map's pieces).

## 5. Cost

One year from the same save, both bundles at once on separate P-cores, then swapped (`.cache/prof79b/`):
2081 year 20 mean tick 2.34 / 2.08 → 2.37 / 2.44 ms, operational AI 1.04 / 0.95 → 1.13 / 1.15 ms;
6421 year 20 3.88 / 3.51 → 3.82 / 4.06 ms, operational AI 1.85 / 1.71 → 2.02 / 2.13 ms. Supply,
movement and territory read the same, and so does the count of plans of 1 ms or more. The plan's
parts over 30 days (`planParts_30d.jsonl`): the allotment 382 → 498 ms on 6421 (asks 506 → 588,
another war by then), 41 → 37 ms on 2081. Seed 99, 5 years from 1938 against `9490fd78`, the same
way: mean tick 1.93 / 1.69 → 1.66 / 1.77 ms; year 1 2.53 / 2.21 → 2.32 / 2.57 ms (operational AI
0.43 / 0.35 → 0.39 / 0.45). (The rule's first form, without the `originCell` guard, read 1.83 / 1.70
→ 2.09 / 2.34: years 2–5 another world's.)

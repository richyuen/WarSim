# PLAN 7.45 — the dead's cost at a high doctrine (ADR-572)

## Measured first: every decision of 7.38e's 24 seeds at the candidate scales

`scales.cjs.txt` (run as a `.cjs` file over `docs/evidence/7.38/e-toll-*.json`; output
`scales.txt`) takes each decided strike's logged utility and weighs its dead again at each
candidate scale, at the yield the strike used and at fission (the higher of the two, as PLAN 7.44
chooses). 170 decisions; 2 MAD-capped first uses are left out. The candidates:

| Rule | Scale on DEAD_COST a million | First uses under the floor | Strikes back under it | Still under 0.1 at ≥ 1 M |
|---|---|---|---|---|
| now | 2 − doctrine | 1 (758 d9167, rounding) | 0 | 2 (756 d8216, 758 d9178) |
| **floor 1** | max(1, 2 − doctrine) | 4 | 0 | **0** |
| floor 0.8 | max(0.8, 2 − doctrine) | 3 | 0 | 1 (758 d9178, 0.034) |
| a million uneased | 2 − doctrine; max(1, ·) from 1 M | 3 | 0 | 0 |
| flat | 1 | 4 | 0 | 0 |

At floor 1 the two cases fall under NUKE_FLOOR (756 d8216 0.037 → −0.054; 758 d9178 0.060 →
0.007), and so do two near-floor strikes: 3613 d9440, Japan on the Soviet Union, 460,000 dead,
0.026 → 0.010; and 758 d9167 (0.025 either way, rounding). The strikes back at doctrine 1.2 to
1.4 (758's eighteen Soviet answers, 7583's and 6421's German ones, 753's) stay at least 0.30 over
the floor. 7.38c's three 4877 answers at doctrine 1.2, scale 1: 0.749 → 0.742, 0.286 → 0.237,
0.510 → 0.510.

Not "a million uneased": the cost would jump at 1 M (0.99 M weighed at 0.6, 1.0 M at 1). Not
"flat": it would drop 7.38c's extra weight on a low doctrine (the United States at 0.65 pays 1.35).

**A tool fix in this measure.** `tools/diag/nukeToll.ts` read the grievance after the hour of the
decision, when a strike back has spent it: `retaliating` was false on every row, and
`uRecomputed` was about 2 under the logged utility on every strike back. It now reads the
grievances as they stood before the hour. The scales above find a strike back by that gap
(logged − recomputed > 0.5) in 7.38e's rows; the new rows mark it at source.

## The cases, from the checkpoints, before and after the rule (HEAD with 7.44)

`toll-before_*.json` (HEAD `1e4ff0c`), `toll-after_*.json` (the rule), from 7.38e's checkpoints
`.cache/nukeToll_756_197184.bin` to year 23.5 and `_758_220272.bin` to year 26.2.

| Seed, day | Before | After |
|---|---|---|
| 756, 8216 (Germany → Belgium's capital, MAD, extreme) | a fission burst at 0.046, 140,183 dead (7.44's rule already: in 7.38e's read, hydrogen, 2,294,126 at 0.037) | a fission burst at 0.041, 140,183 dead |
| 758, 9178 (Germany → 17,112 massed Soviet men, MAD, extreme) | hydrogen at 0.060, 1,334,057 dead | not struck; day 9179 a Soviet place at 0.105, hydrogen, 722,738 dead |

measure-e's "a fission strike would not have been over the floor, so cause A does not reach these"
was wrong for 756: on HEAD, 7.44's choice by the utility takes the fission yield at Belgium's
capital (its fission value 0.915 on HEAD). The AT holds for both: neither strike is decided under 0.1
at a million dead.

What is decided after, in 758's run (24 decisions, 23.5 → 26.2 years; before, 20): every Soviet
strike back is decided (7, at 0.42 to 1.10). One first use is under 0.1 at a million: day 9493,
Germany, hydrogen, 2,001,992 dead at 0.072, in extreme desperation (2.0) under MAD. Its gain is
1.828 (value 0.653 hydrogen, 0.193 fission), its costs 1.749 with the dead's 0.198. It falls 23 days
after a German burst of the war 0.9 cells away (985,327 dead), and finds 29,102 men against the
28,582 that burst found: new value in ADR-569's sense, by 2 %. It is the next read's to count
(PLAN 7.45b).

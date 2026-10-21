# PLAN 7.50 — the read on 10 unseen seeds

HEAD `2dc4e1b` (7.50a, ADR-599; 7.50b, ADR-600), `tools/diag/nukeToll.ts <seed> 30 new`, each seed
from 1938 to year 30. Seeds 771–780: no sweep, report or tuning had used them (7.38e took 751–760,
7.45b 761–770; `docs/sweeps/` ends at 731–740). Rows: `read-toll-<seed>.json`.

Bars (PLAN 7.50's AT): no burst with a utility under 0.1 that kills a million; no place struck three
times in a year (`thriceInYear`: a burst with two others within a hydrogen bomb's blast radius in the
365 days before it, any striker). The other two columns are 7.38's, read.

| Seed | Decided | Bursts | Hydrogen | ≥ 1 M dead | Under 0.1, ≥ 1 M | Thrice in a year | Restruck in a war | Hydrogen where fission covers |
|---|---|---|---|---|---|---|---|---|
| 771 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 772 | 9 | 9 | 2 | 0 | 0 | 0 | 0 | 0 |
| 773 | 22 | 21 | 5 | 0 | 0 | 0 | 0 | 0 |
| 774 | 7 | 6 | 0 | 0 | 0 | 0 | 0 | 0 |
| 775 | 44 | 44 | 12 | 0 | 0 | 0 | 4 | 0 |
| 776 | 4 | 4 | 1 | 0 | 0 | 0 | 0 | 0 |
| 777 | 22 | 22 | 2 | 0 | 0 | 0 | 0 | 0 |
| 778 | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 |
| 779 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| 780 | 13 | 13 | 1 | 0 | 0 | 0 | 0 | 0 |
| **10 unseen** | 129 | 127 | 23 | 0 | **0** | **0** | 4 | 0 |

Most dead: 773 day 6806 Germany → founded#108, 953,790 at 0.629 (yield 2).
Bursts of 500,000 dead or more:
- 773 day 6806 Germany → founded#108: 953,790 at 0.629
- 777 day 5301 France → United Kingdom: 581,431 at 0.319

**Verdict: both bars hold on the 10 seeds.** 9 of the 10 worlds see a burst (all but 771).

## The four restrikes in a war (775)

Each a place struck by its side in that war before, as ADR-569 and ADR-600 allow:

| Day | Strike | Utility | Dead | Days since the war's burst there | Men then / now |
|---|---|---|---|---|---|
| 9863 | founded#112 → United Kingdom | 0.448 | 3,479 | 56 | 1,059 / 3,868 (over twice) |
| 10195 | United Kingdom → founded#112 | 0.330 | 310,222 | 396 | 12,460 / 24,728 |
| 10803 | United Kingdom → founded#112 | 0.106 | 160,030 | 366 | 12,460 / 24,536 |
| 10804 | founded#112 → United Kingdom | 1.042 | 78,770 | 967 | 22,775 / 99,680 |

Days 10195 and 10803 strike a city of founded#112 a year and a day or so after the last burst there
(each time two divisions of men, and the city's people), ADR-569's case past the year. Not a bar;
noted for the critic (the cross-war restrikes are ADR-566's, the user's).

## Against the critic's cases

- 1129's Greenock (critic's save, `a-toll-1129-rule.json`): day 5916 not decided; taken on day 5962
  at 0.101 for the same 1,105,514 (over the bar by 0.001).
- 2081's spot (`b-toll-2081-rule.json`): struck on days 9556 and 9741, not a third time.

# PLAN 7.44 — the yield chosen by the strike's utility (ADR-571)

Rule: `docs/evidence/7.44/yield-utility-rule.diff`. Runs: `tools/diag/nukeToll.ts <seed> <years>
<checkpoint>`, from the checkpoints PLAN 7.38e saved 48 hours before its two misses of this cause
(`.cache/nukeToll_2081_141673.bin`, `.cache/nukeToll_9437_154848.bin`, written on HEAD `7e65ab9`'s
rules), on HEAD `2e4c94c` without the rule (before) and with it (after). Rows: `toll-*.json`.

| Case | | Day | Place | Utility | Value (fission's) | People expected | Yield | Dead |
|---|---|---|---|---|---|---|---|---|
| 2081, Japan on the Soviet Union | before | 5903 | (1438.46, 487.77) | 0.091 | 0.828 (0.810) | 3,328,000 | hydrogen | 3,339,183 |
| | after | 5903 | (1438.46, 487.77) | **0.270** | 0.810 (0.810) | 190,000 | fission | **201,183** |
| 9437, Poland on the Soviet capital | before | 6452 | (1527.33, 466.67) | 0.060 | 0.806 (0.748) | 2,568,000 | hydrogen | 2,579,111 |
| | after | 6450 | (1526.46, 467.12) | **0.300** | 0.804 (0.804) | 172,000 | fission | **183,183** |

- 2081: the same place and day; the dead's cost × the chance through 0.216 → 0.012, the gain
  1.157 → 1.133 (value 0.828 → 0.810).
- 9437: a fission strike's utility (0.300) is over the hydrogen one's was (0.060), so Poland strikes
  two days sooner, about one cell from the place of day 6452 (the hydrogen bomb's people there
  3,120,000 against fission's 172,000).
- AT: neither strike a burst killing a million. Met.

## The daily decision's cost (PLAN 6.10)

Run 10's year-20 world of seed 8693 (`critic/c10_seed8693_y20.bin`), one year, `--profile`; esbuild
bundles of the runner before and after, run at the same time on 0x000F / 0x0F00 and swapped:

| Pair | Before | After |
|---|---|---|
| before 0x000F, after 0x0F00 | 0.1990 ms an hour | 0.2032 |
| after 0x000F, before 0x0F00 | 0.1937 | 0.1996 |

Within the pair's spread (the core pair moves a run by 3 % here); the same hash 45025297 after the
year (no strike in it). The score is one closure a war and a call a yield: no cost seen.

# PLAN 7.135: year 1's "other half" is noise; the fold is the whole fall (ADR-718)

7.128a read year 1 on 1111–1120 with no fold at 0.939 × `311988d7` (42.38 against 45.11 a day) and filed 7.135 to
find the other half in the commits to `src/` besides ADR-701's fold. On 10 seeds that gap was 1.2 standard errors
(paired per-seed sd about 7 a day). Read again here on the critic's 48 seeds, before any bisect.

## The run

Counted as the critic's run 15 counts (`tools/diag/contactYears.ts <seed> 1`): engaged land formations at hour 12
of each day, year 1's mean. Arms, each through that tool:

- `old`: `311988d7` (worktree at that commit).
- `none`: HEAD's `src/` (identical to `3d7bb72b`'s) with the fold off (`HV=none` in `ai/hollow.ts`, `none.patch`, 7.128a's scratch
  variant: `foldHollow` skips every remnant).
- HEAD itself: the critic's own run-15 figures (`critic/c15_headless_<seed>.json`), the same commit's rules. The tool
  agrees with the critic's count: `old` here 45.03, the critic's 45.05.

Files: `runs/old_<seed>.json`, `runs/none_<seed>.json`.

## Result (48 seeds)

| | year 1 a day | × `311988d` |
|---|---|---|
| `311988d7` | 45.03 | 1 |
| HEAD, fold off | **46.23** | **1.027** (+1.20 a day, se 0.64; lower on 21 of 48) |
| HEAD (critic run 15) | 40.01 | 0.888 |

The six other commits to `src/` (ADR-703's wait, ADR-708's refusal cache, ADR-710's load, ADR-711's gap and two
of the page) do not lower year 1: with the fold off HEAD reads at or a little above `311988d`. The fold costs
6.2 a day (46.23 → 40.01, 0.865 ×). 7.128a's 0.939 on 1111–1120 was the sample: of its 2.73 a day, 1117 alone
gave 17.3.

No bisect was needed and no rule is tried; the AT's seeds 1131–1140 are not spent. The AT's bar, year 1 at least
0.95 × `311988d` with the fold kept, asks the fold to cost under 5 %, which is ADR-716's question (the fold kept,
re-shaped or reverted), not a cause elsewhere.

## Per seed

| seed | `311988d` | HEAD, fold off | HEAD (critic) |
|---|---|---|---|
| 1061 | 39.3 | 39.3 | 35.6 |
| 1129 | 45.2 | 39.8 | 38.4 |
| 1187 | 46.7 | 55.0 | 43.9 |
| 1307 | 49.2 | 46.4 | 35.1 |
| 1523 | 56.5 | 55.8 | 44.5 |
| 2081 | 51.2 | 58.4 | 44.4 |
| 2347 | 41.8 | 50.4 | 43.5 |
| 2417 | 43.7 | 46.5 | 38.2 |
| 2539 | 45.2 | 46.8 | 40.1 |
| 2671 | 49.5 | 55.6 | 45.8 |
| 2953 | 48.0 | 51.4 | 40.2 |
| 3253 | 36.1 | 36.6 | 35.1 |
| 3359 | 61.4 | 60.6 | 43.2 |
| 3491 | 54.3 | 54.6 | 47.7 |
| 3613 | 36.0 | 37.1 | 37.0 |
| 3847 | 40.2 | 40.4 | 33.2 |
| 4219 | 41.8 | 47.4 | 37.0 |
| 4391 | 56.6 | 49.2 | 35.1 |
| 4513 | 51.5 | 57.4 | 45.9 |
| 4561 | 39.8 | 50.2 | 40.1 |
| 4673 | 46.5 | 45.9 | 40.9 |
| 4877 | 46.4 | 47.8 | 39.1 |
| 5147 | 37.0 | 37.0 | 41.2 |
| 5309 | 40.5 | 37.6 | 36.4 |
| 5521 | 36.8 | 42.2 | 38.4 |
| 5651 | 33.7 | 33.4 | 28.5 |
| 5683 | 44.0 | 43.2 | 50.0 |
| 5861 | 37.1 | 33.3 | 36.4 |
| 6151 | 31.8 | 31.9 | 48.8 |
| 6421 | 28.2 | 28.1 | 30.9 |
| 6737 | 39.3 | 38.2 | 38.5 |
| 6833 | 41.9 | 43.6 | 45.9 |
| 6967 | 53.7 | 55.3 | 54.6 |
| 7019 | 46.0 | 47.0 | 49.7 |
| 7247 | 48.0 | 46.9 | 40.7 |
| 7351 | 43.0 | 38.4 | 44.8 |
| 7411 | 57.8 | 49.1 | 41.2 |
| 7583 | 48.8 | 48.6 | 31.8 |
| 7901 | 50.9 | 65.7 | 37.1 |
| 8011 | 52.9 | 52.7 | 38.2 |
| 8167 | 52.5 | 50.9 | 35.9 |
| 8423 | 42.2 | 41.6 | 42.5 |
| 8539 | 47.4 | 48.6 | 38.0 |
| 8693 | 40.2 | 45.5 | 32.7 |
| 8849 | 51.6 | 54.0 | 48.8 |
| 9203 | 43.4 | 50.1 | 34.9 |
| 9437 | 45.5 | 43.2 | 35.3 |
| 9781 | 40.4 | 40.4 | 35.6 |

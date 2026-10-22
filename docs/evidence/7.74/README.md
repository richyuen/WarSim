# PLAN 7.74: an overrun holder's first strike on the enemy overrunning it — bar missed on HEAD

Read on `ce2e9630` (2026-10-22). The AT: on the critic's Poland of run 11 (`nukeCase.ts 9437 POL GER
10 65 bomber`), a first decision within 60 days whose place is the cell of, or within a blast's radius
of, a land formation of a nation on the other side of Poland's war; red with PLAN 7.18j's rule
(THEATRE_FLOOR) reverted; no rule change.

## What the run shows

`nukeOverrunAim1938.test.ts.txt` is the AT's test (copy it into `tests/unit/` as `.test.ts` to run it);
`probe-head.txt` its output on HEAD. It reads the place from the `NukeDecided` event, at the hour of the
decision.

- **Red on HEAD.** The first decision (day 35 by `nukeCase.ts`'s count, 34 by the test's from 0) is at
  (1100.2, 267.4): 0.0 km from Germany's capital. Berlin, on its output alone: output share 0.050, men
  share 0.0004, capital 0 (PLAN 7.62's rule holds), value 0.100, chance through 0.2, utility 0.028
  (NUKE_FLOOR 0.025), 334,000 people. The nearest army of any nation: a German one of 4,982 men, 91 km
  off; the blast's radius 25 km.
- **The same with THEATRE_FLOOR 0.** The theatre here is 940,950 men, over 0.25 × the side's 1,957,520:
  the floor binds nothing on this case, so it cannot be red with the rule reverted either.
  `nukeTheatre1938.test.ts` keeps the floor's arithmetic; no case left shows it changing a target.

## Every decision in 65 days

`pol9437.jsonl` (`nukeCase.ts` now prints each decision's real place and its parts as weighed, `decided`):

| Day | Place | Output share | Men share | Value | Through | People |
|---|---|---|---|---|---|---|
| 35 | (1100.2, 267.4), Berlin | 0.0498 | 0.0004 | 0.1005 | 0.2 | 334,000 |
| 51 | (1072.6, 290.4) | 0.0227 | 0.0076 | 0.0608 | 0.2 | 154,000 |
| 58, 59 | (1182.5, 240.5) | 0 | 0 | 0 | 0.2 | 0 |
| 60 | (1106.3, 285.8) | 0 | 0 | 0 | 0.36 | 134,000 |
| 61 | (1079.5, 419.5) | 0 | 0.047 | 0.282 | 0.6 | 0 |
| 62 | (1079.2, 419.2) | 0 | 0.039 | 0.232 | 0.6 | 0 |

The parts are read for the first war found with Poland in it; the value-0 rows (days 58–60) may be of
another war or weighed otherwise, not traced here. Poland's first decision on an army is day 61.

## Why 7.62 and 7.76 read "a Soviet army"

`docs/evidence/7.62/pol.py` printed, for a decision day, the previous day's `best`: the best place by
utility in reach or not. From day 30 that was a Soviet place at (1794.2, 391.2), out of reach every day
(gate `noReach`, men share 0.038). The decision itself goes to the best place in reach. So 7.62's "day
35, u 0.027: a Soviet place (men share 0.039)" and 7.76's "unchanged, day 35 at a Soviet army" were
that row, not the decision. Before 7.62's rule Poland struck Berlin on day 28 with the capital (0.3);
after it, on day 35 by Berlin's output. The critic's run-11 objection (Berlin, 334,000 civilians and
379 men) stands on HEAD, a week later.

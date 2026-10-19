# PLAN 7.27d — the late years' tick, and the full sweep on seeds 741–750

2026-10-19, code of `30dfd3c` (pin 94235073).

## 1. The late years' tick

Run: `npm run sim -- --scenario 1938 --seed 732 --years 50 --affinity 0xFFFF --profile --save
.cache/727d/s732-y50.bin --out .cache/727d/p732.json`, alone on the machine (no gate, no sweep).

- **Wall:** 921.7 s, mean tick 2.10 ms. The same seed in 7.27a's sweep (ten seeds side by side)
  took 34 min: 2.2 × the lone run. 7.24a's sweep (seeds 721–730) took 14–20 min a seed, 7.27a's
  30–34 min a seed, every seed alike, so the sweep's doubling is not one seed's late years. A lone
  run of the 7.24a code was not made; how much of the doubling is the machine's load on that day
  and how much is code between is not measured.
- **By years** (mean ms a tick, all systems): years 1–5 1.43, 6–25 1.88, 26–50 2.40. Years of 4 ms
  or more: 31 (5.13), 40 (4.20), 44 (4.55).
- **By system** (mean ms a tick over the years):

| system | 1–5 | 6–25 | 26–50 |
|---|---|---|---|
| operationalAi | 0.255 | 0.837 | 1.072 |
| airAi | 0.136 | 0.192 | 0.283 |
| movement | 0.204 | 0.156 | 0.173 |
| nuclear | 0.001 | 0.029 | 0.160 |
| supply | 0.103 | 0.112 | 0.116 |
| combat | 0.213 | 0.068 | 0.108 |
| navalCombat | 0.075 | 0.072 | 0.090 |
| territory | 0.093 | 0.088 | 0.085 |
| air | 0.099 | 0.068 | 0.067 |

  Of the late rise of ~1.0 ms, the operational AI is 0.82, the air AI 0.15 and the nuclear system
  0.16; the rest is flat or falls.
- **The operational AI** is its calls of 1 ms or more (`SLOW_CALL_MS`): 97–100 % of its cost from
  year 8. Their number a year stays 600–1,460, but their mean grows: about 2 ms a call in year 1
  (0.160 ms a tick × 8,760 ÷ 600), 10–35 ms from year 8 (year 31: 4.35 × 8,760 ÷ 1,080 = 35 ms), the
  longest 203 ms (year 44). Year 8 is the year of the run's largest war (85,583 cells flipped).
  Which planner, which nation and which part of a call is not measured here: PLAN 7.30.
- **Budget:** the tick's budget is set on seed 99's first five years (SPEC; 1.55 ms at 7.27a,
  over the 1.5 ms since Phase 3, PLAN 7.1). The late years have no budget; this is a cost of
  iteration (a 50-year sweep), not of the game's pace at its budgeted size.

## 2. The sweep

`npm run sweep -- --first 741 --tag 727d`, alone on the machine after §1's run:
`docs/sweeps/2026-10-19-sweep-727d.md` (and `.json`). ALL GREEN: limits, riser, faller, no stasis
and no break-up 10 of 10.

- **Wall:** 21.6 min, 16.7–21.6 a seed (7.24a's 14–20, 7.27a's 30–34). With §1's lone run, 7.27a's
  34 min was mostly the machine's load that day.
- **Stasis** (`npx tsx tools/sweep/stasis.ts docs/sweeps/2026-10-19-sweep-727d.json`): the longest
  one top five 6–19 years (mean 12.9; 7.27a's seeds 731–740 before ADR-521: 7 of 10, three of
  21–24 years). Near the bar of 20: 744 (19 years, 28–46: FRA ENG NED AST USA) and 748 (18, 23–40:
  GER SOV ITA AST USA). In the longest five of 10 seeds: USA 10, SOV 7, ITA 6, FRA 5, AST 5, GER 4.
- **Largest income:** 28.6–37.5 % (748), under the limit of 40 (`sweep:quick` at 7.27c: seed 8 at
  39.5 %).
- **Nuclear bursts** (7.27c's watch: `sweep:quick` 113–122 against 28 before the rule): 2–27 a seed,
  117 in all. The full sweeps before the rule: 7.18g's 701–710 307 (up to 118), 7.24a's 721–730 66,
  7.27a's 731–740 226. Not several times the old count: no measure before the tick.

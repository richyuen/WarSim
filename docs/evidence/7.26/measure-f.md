# PLAN 7.26f: which rule lowered the late air war (2026-10-18)

7.26e (`measure-e.md`): on seeds 1–10 × 30 years the late air war fell after ADR-511 (c3a), ADR-512
(c4), ADR-513 (c1b) and ADR-514 (c2b) (years 21–30 sorties aloft 9.8 → 7.3 on 8 of 10) while land
contact held. Here: 30-year runs from 1938 with one rule's old behaviour switched back on at a
time, against 7.26e's runs (all four rules on, `.cache/726e/`).

## The switches, checked first

Each rule's old behaviour behind a switch for these runs only (`globalThis.__RULE_OFF`, read by the
four AI files; never committed), run by `tools/diag/airWar.ts` through `.cache/tmp/ab726f.ts`.
Seed 1, 2 years: all four off gave 7.26d's state hashes (`f4c73de8`, `186f4c1b`, code `edd105e`),
all on 7.26e's (`c4c008b`, `1d710f0c`). The four rules are the only changes to `src/` between those
codes, so each switch restores its old rule exactly, and the runs below differ by that rule alone.

## Seeds 1, 5 and 7 (the largest falls): each rule off

Means of years 2–10 / 21–30 (`.cache/tmp/cmp726f.ts`). "c4 + old step": ADR-512 kept, and where its
chain gives no hop the old step (the base nearest the goal, if nearer than the wing's own) taken.

| | aloft | missions | rebased a day | out of range | land contact | air battles a year |
|---|---|---|---|---|---|---|
| 7.26d, all off | 15.66 / 10.57 | 15.59 / 10.53 | 0.92 / 1.69 | 41.6 / 69.0 | 2.98 / 1.19 | 314 / 119 |
| 7.26e, all on | 15.52 / 4.84 | 15.46 / 4.81 | 1.81 / 3.06 | 56.1 / 81.2 | 2.82 / 0.23 | 222 / 32 |
| c3a off | 16.79 / 5.86 | 16.73 / 5.84 | 1.58 / 2.67 | 49.0 / 74.5 | 2.62 / 0.38 | 232 / 67 |
| c4 off | 14.28 / **8.83** | 14.21 / 8.81 | 1.38 / **1.79** | 41.9 / 68.4 | 3.31 / **1.10** | 277 / 63 |
| c4 + old step | 15.59 / 5.88 | 15.51 / 5.86 | 1.88 / 2.99 | 58.2 / 92.7 | 2.93 / 0.45 | 228 / 73 |
| c1b off | 12.87 / 8.65 | 12.81 / 8.64 | 1.40 / 3.17 | 52.8 / 77.3 | 2.12 / 0.56 | 225 / 24 |
| c2b off | 14.07 / 6.79 | 14.01 / 6.74 | 2.03 / 2.81 | 70.6 / 87.7 | 2.48 / 0.44 | 223 / 63 |

Every switch read up on years 21–30 on all three seeds: they were picked as 7.26e's lowest, and
any change regresses toward the mean. The two largest (c4, c1b) were run on the other seven.

## Seeds 1–10: c4 off and c1b off

Years 21–30 sorties aloft (7.26e all on → one rule off):

| seed | 7.26d all off | all on | c4 off | c1b off |
|---|---|---|---|---|
| 1 | 8.3 | 4.4 | 6.5 | 6.7 |
| 2 | 12.9 | 9.0 | 12.0 | 10.6 |
| 3 | 10.2 | 7.8 | 9.8 | 8.7 |
| 4 | 11.1 | 9.9 | 9.7 | 6.5 |
| 5 | 11.0 | 5.3 | 12.7 | 9.5 |
| 6 | 6.7 | 8.6 | 8.6 | 4.5 |
| 7 | 12.4 | 4.9 | 7.3 | 9.8 |
| 8 | 7.3 | 10.4 | 12.0 | 3.0 |
| 9 | 12.0 | 7.3 | 11.2 | 6.8 |
| 10 | 6.4 | 4.9 | 5.5 | 10.1 |
| mean | 9.8 | 7.24 | **9.52** | 7.62 |

- **c4 off**: up on 8 of 10, level on 2 (4, 6), down on none; on the seven seeds not picked for
  their fall 5 up, 2 level. Air battles of years 21–30 up on 8 of 10 (7,524 → 10,207). Back to
  7.26d's level.
- **c1b off**: up on 6, down on 4; on the seven, 3 up and 4 down: noise.

c4 off against all on, the ten seeds' means by decade (`.cache/tmp/win726f.ts`):

| | years 2–10 | 11–20 | 21–30 |
|---|---|---|---|
| sorties aloft | 14.88 → 14.82 | 9.95 → 10.80 | 7.24 → 9.52 |
| wings of nations at war | 63.9 → 71.1 | 68.3 → 78.3 | 91.5 → 94.7 |
| wars | 5.92 → 5.75 | 5.10 → 5.46 | 5.13 → 5.72 |
| out of range | 39.7 → 46.2 | 51.3 → 59.7 | 74.7 → 77.9 |
| hollow wings | 4.9 → 5.5 | 5.6 → 4.8 | 7.4 → 6.1 |
| land formations in contact | 2.98 → 2.75 | 0.77 → 0.95 | 0.49 → 0.89 |

The gap opens in years 11–20. Without the rule more nations' wings are at war and the late land
contact nearly doubles: the rule changed the course of the wars, not only the air AI's day.

## From late states: no late mechanism

States of seeds 1 and 7 at days 7300 and 8030 (years 21 and 22, all rules on;
`.cache/tmp/saveAt.ts`), 120 days each, c4 on and off (`.cache/tmp/c4f.ts`): seed 7 bit for bit
alike on both states; seed 1 hops 5.17 against 5.10 a day, 3.32 against 2.85, missions alike.
Germany's many hops on seed 1 (about 11 a wing in 120 days, `.cache/tmp/hoptrace.ts`) are its wars
ending and starting (home in peace, toward Yugoslavia at war), on and off alike. So the rule's
cost builds over the decades through the course of the wars; no day's behaviour to mend.

## The verdict

ADR-512 (c4) lowered the late air war; the other three do not account for it. It is taken back
(ADR-515), the old step restored as it was before `5ae5b37`: a hop only to a base nearer the goal.
Its 17 of 23 sitters (3 % of the wings out of range) are accepted. Pin e1856b1b → c9f5962b. The
runs with c4 off (`.cache/726f/c4_*.json`, end hashes below) are the restored code's 30-year runs:
7.26g reads against them after c3b.

End hashes after year 30, c4 off: 1 `b3062ab`, 2 `8918af0a`, 3 `b9ccfb75`, 4 `f4566fe4`, 5 `23eff23b`,
6 `51eb84ba`, 7 `5ed303d7`, 8 `763cd092`, 9 `5e31229a`, 10 `978164dc`.

# PLAN 7.128a: year 1's land contact back — the AT missed (ADR-716)

Counted as the critic's run 15 counts (`tools/diag/contactYears.ts`): engaged land formations at hour 12
of each day, the year's mean; checkpoints at the ends of years 10 and 20 (7 days, 8 reads); under 500
men at the year-20 checkpoint.

## The rule tried (`wait.patch`, not committed)

A remnant (ADR-701's: under 500 men, out of contact, not retreating, on land) is folded only after
`HOLLOW_WAIT_DAYS` = 7 days so on end; `World.hollowSince` (id → the day first seen so, saved while
not empty). Its unit cases (`hollow1938.test.ts`: the wait, contact starting it again, save and load)
were red without it, 2 of 5.

## The AT on seeds 1111–1120 (`runs/`: `old_` = `311988d7` 1 year; `head_` = HEAD's rules, `change_` = the wait, 30 years; `none_` = no fold, 1 year)

| seed | 311988d y1 | HEAD y1 | wait y1 | no fold y1 | HEAD y2–30 | wait y2–30 | HEAD <500 y20 | wait <500 y20 | HEAD empty ckpt | wait empty ckpt |
|---|---|---|---|---|---|---|---|---|---|---|
| 1111 | 49.2 | 34.1 | 33.5 | 43.5 | 4.28 | 3.27 | 0 | 5 | 1 | 1 |
| 1112 | 30.5 | 32.7 | 32.0 | 32.4 | 4.96 | 5.27 | 0 | 2 | 0 | 0 |
| 1113 | 55.3 | 49.5 | 50.3 | 57.7 | 2.83 | 4.41 | 0 | 1 | 1 | 0 |
| 1114 | 42.7 | 39.2 | 47.0 | 43.1 | 4.68 | 3.79 | 1 | 5 | 1 | 0 |
| 1115 | 31.0 | 36.5 | 32.2 | 29.9 | 4.76 | 3.75 | 1 | 0 | 0 | 0 |
| 1116 | 49.5 | 45.2 | 37.9 | 43.6 | 4.28 | 3.98 | 0 | 1 | 0 | 1 |
| 1117 | 54.7 | 37.4 | 35.7 | 37.4 | 4.13 | 4.96 | 0 | 5 | 0 | 0 |
| 1118 | 57.0 | 40.4 | 40.3 | 45.9 | 4.68 | 4.68 | 1 | 5 | 0 | 0 |
| 1119 | 36.7 | 37.4 | 41.5 | 39.5 | 4.84 | 4.19 | 1 | 0 | 0 | 0 |
| 1120 | 44.5 | 50.8 | 50.8 | 50.7 | 4.63 | 4.29 | 0 | 3 | 0 | 0 |
| **mean** | **45.11** | **40.33 (0.894 ×)** | **40.12 (0.889 ×)** | **42.38 (0.939 ×)** | **4.407** | **4.258 (0.966 ×)** | **0.4** | **2.7** | **3** | **2** |

Bars: year 1 at least 0.98 × `311988d` (missed: 0.889); years 2–30 not below HEAD's (missed: 0.966);
under 500 men at year 20 at most 2 a world (missed: 2.7). The wait moves year 1 nowhere against HEAD
(−0.2 a day; per seed −7.3 … +7.9).

**No fold at all** reads 0.939 × `311988d` on these seeds: the fold is about half of year 1's fall here
(45.11 → 42.38 → 40.33). The bisect that called the fold the whole fall (7.128's split) was on the
critic's 8 seeds that fell most; on ordinary seeds something else fell too, in the 7 commits to `src/`
between `311988d7` and HEAD.

## The probes before (16 of the critic's seeds, year 1 against the critic's run-14 figures; scratch, `HV` variants)

| variant | year 1 × `311988d` |
|---|---|
| HEAD (critic run 15) | 0.948 |
| no fold | 1.059 |
| kept on own land | 0.965 |
| kept within 50 km of an enemy | 0.959 |
| both | 0.994 |
| wait 3 / 5 / 7 / 14 / 30 days | 0.979 / 0.964 / 1.008 / 1.008 / 1.034 |
| wait only on own land, 14 / 30 | 0.976 / 0.953 |
| wait 30, then kept near an enemy | 1.016 |

Per-seed paired spread: sd 4–6 a day, so a mean of 10 seeds reads to ±1.3–1.9 a day (the bar's margin
is 0.9). These 16 seeds read HEAD at 0.948, the critic's 48 at 0.888 and 1111–1120 at 0.894: a light
sample; the waits' "+2.5 a day over HEAD" did not hold on unseen seeds.

Year 20 (`tools/diag/hollowStep.ts` from run 14's pre-fold saves `critic/c14_seed{1061,2081,4219}_y20.bin`,
the remnants of days 35–60): "both" and "own land" keep 71 of 113 (never refilled); "near an enemy" 1;
waits of 7–30 days 0–9 between bursts, 9–18 just after one (2081's day 55: 13 of nation 82, all marching,
hit at once).

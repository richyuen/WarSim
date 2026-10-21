# PLAN 7.46c: the chase read with the navies rebuilt, the critic's 14 seeds × 30 years (ADR-580)

The chase is to be adopted, and lands after PLAN 7.48 (§6): with it, `nukeOverrun1938.test.ts` is
red. The whole change (the rule, its `seaWhy` mirror, SPEC, the two tests, the pin) is
`c-adopt.diff`, which applies to `ac0f20e`.

The chase is `docs/evidence/7.39/b-chase.diff` (and its mirror in `tools/diag/seaWhy.ts`,
`b-chase-seaWhy.diff`), tried in PLAN 7.39b and not adopted then (ADR-573): it emptied the far
stations but sank the navies, and the late battles reached 5.0 a world-year against the bar's 6.6.
PLAN 7.46b1, b2 and 7.47 (ADR-574, ADR-575, ADR-579) have since made a sunk navy build again. The
user's rule (ADR-573 a, ADR-576 a): the chase is adopted or not on 7.39b's two bars; the world's
armed power is a read.

## The runs

- **The chase at `ac0f20e`** (HEAD with ADR-574, 575, 579): the chase worktree reset to `ac0f20e`
  and the two diffs applied, nothing else (`git diff --stat`: `naval.ts`, `seaWhy.ts`). `npx tsx
  tools/diag/seaWars.ts <seed> 30` and `seaYears.ts <seed> 30` on the critic's 14 seeds, 14 at a
  time. JSON in `c/wars_<seed>.json`, `c/years_<seed>.json`.
- **HEAD `ac0f20e` without the chase**: `seaYears` alone on the same 14 seeds (`c/head/`). Its
  `seaWars` was not run, so HEAD's far station at `ac0f20e` is not read; the station rule has not
  changed since 7.39a's 886 at `63ba0e4`.
- Tables: `node docs/evidence/7.46/c/read.mjs` (`c/read.txt`: against 7.39a's run of HEAD and 7.39b's
  run of the chase, both at `63ba0e4`) and `node docs/evidence/7.46/c/head.mjs` (`c/head.txt`).

## 1. 7.39b's two bars, and 7.39's

| the critic's 14 seeds × 30 years | HEAD `63ba0e4` | the chase at `63ba0e4` | the chase at `ac0f20e` |
| --- | --- | --- | --- |
| sea battles, year 1 (a world) | 35.7 | 55.0 | 55.7 |
| **sea battles, years 2–30 (a world-year; 7.39b's bar 6.6)** | 4.3 | 5.0 | **14.7** |
| a quarter of year 1 (7.39's bar) | 8.9 | 13.8 | 13.9 |
| late battles sinking nothing (7.39's bar 5 %) | 2.6 % | 1.2 % | 1.7 % |
| **on station, the enemy fleet beyond reach, 2–30 (7.39b's bar under 443)** | 886.4 | 14.5 | **53.3** |
| on station at war with a navy, 2–30 | 901.0 | 18.8 | 70.9 |
| chasing, fleet-weeks a world-year, 2–30 | – | 8.6 | 37.4 |

Both of 7.39b's bars are met: 14.7 against 6.6, 53.3 against 443. 7.39's two bars read on the same
run are met too: 14.7 against a quarter of year 1's 13.9, and 1.7 % sinking nothing against 5 %.
7.39's AT also asks for the same two bars on 10 unseen seeds × 30 years: PLAN 7.39c.

Every seed passes, 11.6 to 18.0 late battles a world-year. Years 2–10 have 17.6, years 11–30 13.4
(at `63ba0e4` without the chase, 6.2 and 3.4). Each late battle sinks about 7.5 ships (HEAD at
`63ba0e4` 9–12). The pairs that fight most in years 2–30: Britain–USA 143, Britain–Germany 140,
Britain–Japan 111, Japan–Soviet Union 111, Japan–Netherlands 105, China–Japan 89 (summed over the 14).

## 2. Against HEAD `ac0f20e` without the chase

| the critic's 14 seeds × 30 years | HEAD `ac0f20e`, no chase | the chase at `ac0f20e` |
| --- | --- | --- |
| sea battles, year 1 (a world) | 37.6 | 55.7 |
| sea battles, years 2–30 (a world-year) | 12.6 | 14.7 |
| years 2–10 / 11–30 | 14.5 / 11.7 | 17.6 / 13.4 |
| per seed, years 2–30, lowest–highest | 9.2–18.2 | 11.6–18.0 |
| late battles sinking nothing | 0.9 % | 1.7 % |
| armed power (k) / fleets / navies, year 1 | 295.7 / 96.4 / 16.1 | 237.2 / 77.1 / 14.5 |
| year 2 | 249.7 / 83.7 / 13.3 | 133.5 / 44.5 / 9.7 |
| year 3 | 249.7 / 84.8 / 16.1 | 116.4 / 40.2 / 11.4 |
| year 5 | 253.6 / 92.2 / 21.1 | 124.1 / 48.3 / 16.6 |
| year 10 | 230.0 / 96.1 / 22.6 | 144.7 / 58.3 / 17.5 |
| year 20 | 267.2 / 109.7 / 22.2 | 199.2 / 76.4 / 18.9 |
| year 30 | 306.3 / 124.6 / 21.0 | 231.1 / 74.5 / 16.3 |

Most of the late battles came from the rebuilt navies, not from the chase: HEAD alone went from 4.3
at `63ba0e4` to 12.6, and already clears 7.39's quarter of its own year 1 (9.4) and 7.39b's 6.6.
The chase adds 2.1 a world-year (12.6 → 14.7) and is what empties the far stations (7.39b's first
bar, the critic's "fleets stand off ports"). Its price is the world's navy: 54 % of HEAD's at year
2, 47 % at year 3, 49 % at year 5, 63 % at year 10, 75 % at year 20 and at year 30, in 47–70 % of
the fleets. Its margin on 7.39's bar is small (14.7 against 13.9, 6 %), since it lifts year 1 to
55.7; HEAD alone clears its own by 34 %.

## 3. The world's armed power on 4 seeds × 10 years (ADR-576, a read)

The 4 × 10 with the chase and all three rules is PLAN 7.47's (`docs/evidence/7.47.md`): 46–51 % of
HEAD's (without the chase, before ADR-574) at years 3–5, 66–81 % at years 6–10. Not run again: this
code is that run's.

## 4. The decision

The user's rule decides: both of 7.39b's bars met, so the chase is to be adopted (ADR-580). It
would be reversible in one commit (the rule, its tests, the pin). The trade in §2 is written in
ADR-580 for the user. It is not committed yet: §6.

## 5. `--profile` (seed 99 × 5 years, before and after at once, `--affinity 0xFF` and `0xFF00`)

| year | navalAi mean ms, before → after | share of the tick | longest call (ms) |
| --- | --- | --- | --- |
| 1 | 0.048 → 0.061 | 2.0 → 2.6 % | 12.0 → 42.9 |
| 2 | 0.039 → 0.056 | 2.5 → 3.0 % | 6.7 → 46.4 |
| 3 | 0.051 → 0.039 | 2.5 → 2.2 % | 20.9 → 20.0 |
| 4 | 0.039 → 0.025 | 2.1 → 2.0 % | 12.0 → 5.6 |
| 5 | 0.040 → 0.023 | 2.6 → 2.6 % | 8.6 → 5.7 |

The worlds part from the first chase: years 3–5 have fewer fleets after. The mean tick over 5 years
1.88 → 1.64 ms. The pin with the chase: 3754b256 → fdd3a67c.

## 6. The gate: the critic's overrun France does not strike (PLAN 7.48)

With the chase, `nukeOverrun1938.test.ts` (PLAN 7.18, critic R8-B1's case: seed 7127, France given
10 warheads, Germany's war on it, 100 days) is red, in the related run and again alone: France makes
no decision. `npx tsx tools/diag/nukeCase.ts 7127 FRA GER 10 100`, before and after at once:

| day | HEAD: desperation, gate, best u | the chase: desperation, gate, best u |
| --- | --- | --- |
| 45 | 0.51, low, −0.148 | 0.51, low, −0.115 |
| 50 | 0.79, low, −0.094 | 0.54, low, −0.156 |
| 55 | 1.33 extreme, strike, 0.048 | 1.08 extreme, low, 0.017 |
| 60 | 1.36 extreme, paused (two launched) | 1.11 extreme, low, 0.019 |
| 65 | 1.39 extreme, noReach, 0.048 | 1.14 extreme, low, 0.020 |
| 70 | 1.42 extreme, paused | Paris fallen, no bomber, 0.91, low, −0.079 |

The parts of the utility on day 55 differ in the desperation alone (doctrine 0.8, taboo 1, outrage
0.1, the alliance's cost 0.15 on both). On HEAD a capital of France's side falls on day 48
(`capitalBonus` +25, the score 6 → 31); with the chase none falls before Paris on day 68. France
then stands at extreme desperation for 15 days with 10 warheads and its bomber, its best place
0.005–0.008 under `NUKE_FLOOR` (0.025), and loses the bomber with Paris. HEAD's strike rode a
colony's capital; the chase's world is the critic's R8-B1 shape. Not the chase's to fix (one cause
a commit), not the test's to loosen: PLAN 7.48.

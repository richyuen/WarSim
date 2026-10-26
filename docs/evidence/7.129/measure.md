# PLAN 7.129: the late tick (R15-B2) — measured, the two changes, the AT

2026-10-26. HEAD at the start `b04717b5` (the critic's run-15 rules). Timings `npm run sim -- --profile --affinity
0xFFFF` from the critic's saves, "alone": nothing else running. The budget: 5.5 ms a tick (ADR-709).

## 1. The cases on HEAD

| case | tick ms | operational AI | hash |
|---|---|---|---|
| 6421's year 28 (`critic/c15_seed6421_y27.bin`) | 7.99 (critic 7.88–7.98) | 5.39 | a9602269 |
| 1129's year 21 (`critic/c15_seed1129_y20.bin`) | critic 6.39–6.54 | — | 7fb02d06 |

`tools/diag/opCalls.ts` over 6421's year (the plans' parts, `OP_PROBE`): plans 48.9 s, of which the classes' reach
22.2 s (45 %), the reserve and threat 10.6 s, the sectors 6.1, the allotment 5.0; `groundOf` 11.75 M calls (19.2 s),
`wideJoined` 11.4 s (1,018 `joinWide` walks). Plans of 400+ sectors: 14,517 of 16,750; AEF, SOV, RAJ, CHI, PHI plan
over 1,500–3,200 sectors for 1–5 free formations. A CPU profile of 60 days (`tools/diag/spanProf.ts`, new):
`pocketOf` 3.6 s and `joinWide` 2.0 s of the plans' 8.4 s.

`tools/diag/joinWalks.ts` (120 days): 280 walks, none for the runs kept (`JOIN_RUNS_KEPT`); 163 after a province's
`open` or `shut` changed (130 with a new partition), 105 after flips (21 new). On the part-2 variant each walk
answered 3–4 pairs (58 walks in 60 days; 1–6 pairs), and 56 of 58 were set off by the reserve.

## 2. Part 1: `wideLinked` (ADR-719, `7be651ab`)

The plans' `reaches` asks `wideLinked`: the runs walked outwards from the two grounds' groups until joined or one
side is spent, each run once a passage. Exact: `wideLinked1938.test.ts`, 5,657 pairs on 14 passages (1,748 joined)
equal to `joinWideAfresh`; 6421's year-28 hash a9602269 kept. **7.99 → 7.32 ms.**

## 3. Part 2: reach asked where it is read (ADR-720, `9ef07384`)

Each (class, sector) asked by the reserve, the allotment, the marches and the diversions, kept for the plan.

- Logic: with every reach asked first in the old order (`WARM`, scratch only), `tools/diag/hashSteps.ts` gives
  HEAD's hash at each of 3,600 hours from 6421's save. Without it the walks of `pocketOf` that run differ, and 6421
  parts at hour 468; a reserve in two passes (the plainly reached first) changes nothing more (hash 28152503 at
  the year's end either way).
- Year 1 on the critic's 48 seeds (`tools/diag/yearScreen.ts <seed> 1`, eight at once): **all 48 hashes as
  HEAD's**; land contact 39.96 a day in both (the critic's HEAD 40.01); tick 3.505 ms in both.
- The seed-99 pin ac54bc2d unchanged; 1129's year 21 7fb02d06 unchanged.

| case | HEAD | part 1 | parts 1 + 2 |
|---|---|---|---|
| 6421's year 28 | 7.99 | 7.32 | **5.41, 5.42** (operational AI 2.89) |
| 1129's year 21 | 6.39–6.54 (critic) | — | **4.48** (operational AI 2.33) |

## 4. The AT (1141–1150 × 30 years)

Screen: `tools/diag/yearScreen.ts <seed> 30`, eight at once, one P-core each (≈ 1.13 × a read alone), each year
saved (`.cache/7129/screen/`, deleted after the AT). 300 world-years; over 5.5 only **1148's year 25 (5.70)**; next 4.59
(1148 y18), 4.56 (1146 y16), 4.38 (1148 y30). 1148's year 25 alone from its year-24 save: **5.07, 5.13 ms** (hash
a8bd9687, operational AI 2.80).

| clause | bar | read |
|---|---|---|
| 6421's year 28, alone | ≤ 5.5 | 5.41, 5.42 |
| 1129's year 21, alone | ≤ 5.5 | 4.48 |
| worst year of 1141–1150 × 30 | ≤ 5.5 | 5.13 (1148 y25) |
| the gate | green | green (`7be651ab`, `9ef07384`) |

**Met.** Years 2–30 against HEAD on these seeds were not run (no HEAD arm): ADR-720's change parts histories only
late and rarely (none of the 48 seeds in year 1).

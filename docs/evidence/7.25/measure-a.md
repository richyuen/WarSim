# PLAN 7.25a: a floor of utility (measure)

The rule (ADR-506): a strike is decided only above `NUKE_FLOOR` 0.025 (above 0 before).
`tools/diag/nukeGates.ts <seed> 30`, seeds 1–10 × 30 years; summary by
`measure725.mjs` (per world: the first warhead's year, decisions, bursts, the first burst's year, the
span from the first burst to the last, the longest gap between two, whether all fall within 2 days,
each decision's utility).

## Before (`7302970`, `.cache/r725a/before_<seed>.json`)

| Seed | First warhead, year | Decisions | Bursts | First burst, year | Span, days | Longest gap, days | All within 2 days | Utilities |
|---|---|---|---|---|---|---|---|---|
| 1 | 8.73 | 13 | 6 | 9.7 | 4136 | 2481 |  | 0.019 0.020 0.040 0.087 0.573 0.156 0.111 0.156 0.138 0.162 0.639 1.563 0.434 |
| 2 | 8.73 | 51 | 33 | 8.8 | 7189 | 2141 |  | 0.050 0.027 0.030 0.034 0.035 0.036 0.038 0.041 0.043 0.046 0.049 0.051 0.054 0.056 0.059 0.079 0.485 0.084 0.145 0.146 0.276 0.332 3.057 0.725 2.944 0.811 1.216 1.216 0.782 1.215 0.703 0.934 0.702 0.450 0.615 0.529 0.593 0.158 0.245 0.669 0.392 0.301 0.305 1.026 1.322 0.789 0.145 0.650 0.017 0.451 0.616 |
| 3 | 8.73 | 40 | 40 | 14.5 | 5064 | 2489 |  | 0.002 0.307 0.189 0.136 0.737 0.137 0.317 0.418 0.682 0.363 0.326 0.503 0.380 0.191 0.238 0.023 0.029 0.494 1.062 0.459 0.316 0.303 0.287 0.428 0.353 0.096 0.586 0.568 0.367 0.380 0.211 0.124 0.523 0.490 0.356 0.367 0.394 0.318 0.271 0.209 |
| 4 | 8.73 | 31 | 31 | 8.7 | 7712 | 2513 |  | 0.429 0.741 0.712 0.158 0.163 0.256 0.755 0.622 0.287 0.004 0.862 0.011 0.222 0.253 0.073 0.003 0.817 0.079 0.225 0.029 0.018 0.223 0.873 0.478 0.563 0.068 0.094 0.470 0.118 0.407 0.390 |
| 5 | 8.73 | 6 | 6 | 14.4 | 2749 | 1288 |  | 0.200 0.210 0.189 0.309 0.453 0.065 |
| 6 | 8.73 | 5 | 5 | 13.3 | 3191 | 1567 |  | 0.633 0.553 1.075 0.439 0.229 |
| 7 | 8.73 | 5 | 4 | 9.7 | 2 | 1 | YES | 0.185 0.188 0.264 0.919 0.265 |
| 8 | 8.73 | 4 | 4 | 18.2 | 3482 | 1669 |  | 0.578 0.040 0.561 0.779 |
| 9 | 8.73 | 1 | 1 | 13.3 | 0 |  | (one) | 0.410 |
| 10 | 8.73 | 16 | 16 | 18.8 | 3799 | 1031 |  | 1.110 1.047 0.166 0.004 0.116 0.002 1.394 0.579 0.600 0.605 0.607 0.632 0.864 1.213 0.535 0.175 |

Decision utilities (172): 0–0.01: 5, 0.01–0.02: 4, 0.02–0.05: 16, 0.05–0.1: 14, 0.1–0.25: 33, 0.25–0.5: 44, 0.5–1: 42, 1–99: 14
floor 0.02: decisions at or under it 10, worlds left with none 0
floor 0.05: decisions at or under it 26, worlds left with none 0
floor 0.1: decisions at or under it 39, worlds left with none 0

## After (the floor, `.cache/r725a/after_<seed>.json`)

| Seed | First warhead, year | Decisions | Bursts | First burst, year | Span, days | Longest gap, days | All within 2 days | Utilities |
|---|---|---|---|---|---|---|---|---|
| 1 | 8.73 | 10 | 4 | 9.7 | 5727 | 4433 |  | 0.029 0.030 0.041 0.232 0.091 0.154 0.052 0.221 0.025 0.271 |
| 2 | 8.73 | 50 | 32 | 8.8 | 6505 | 2141 |  | 0.050 0.027 0.030 0.034 0.035 0.036 0.038 0.041 0.043 0.046 0.049 0.051 0.054 0.056 0.059 0.079 0.485 0.084 0.145 0.146 0.276 0.332 3.057 0.725 2.944 0.811 1.216 1.216 0.782 1.215 0.703 0.934 0.702 0.450 0.615 0.529 0.593 0.158 0.245 0.669 0.392 0.301 0.305 1.026 1.322 0.789 0.145 0.650 0.044 0.452 |
| 3 | 8.73 | 12 | 12 | 14.5 | 3548 | 3066 |  | 0.030 0.337 0.029 0.166 0.271 0.032 0.066 0.078 0.079 0.142 0.145 0.782 |
| 4 | 8.73 | 18 | 18 | 8.7 | 7667 | 2795 |  | 0.429 0.741 0.712 0.158 0.163 0.256 0.755 0.622 0.287 0.033 0.670 0.056 0.063 0.620 0.117 0.703 1.887 0.485 |
| 5 | 8.73 | 6 | 6 | 14.4 | 2749 | 1288 |  | 0.200 0.210 0.189 0.309 0.453 0.065 |
| 6 | 8.73 | 5 | 5 | 13.3 | 3191 | 1567 |  | 0.633 0.553 1.075 0.439 0.229 |
| 7 | 8.73 | 5 | 4 | 9.7 | 2 | 1 | YES | 0.185 0.188 0.264 0.919 0.265 |
| 8 | 8.73 | 4 | 4 | 18.2 | 3482 | 1669 |  | 0.578 0.040 0.561 0.779 |
| 9 | 8.73 | 1 | 1 | 13.3 | 0 |  | (one) | 0.410 |
| 10 | 8.73 | 17 | 17 | 18.8 | 4058 | 1396 |  | 1.110 1.047 0.166 0.033 0.129 0.456 1.095 0.433 0.441 0.927 0.443 0.748 0.860 0.948 1.143 0.573 0.571 |

Decision utilities (128): 0–0.01: 0, 0.01–0.02: 0, 0.02–0.05: 21, 0.05–0.1: 15, 0.1–0.25: 22, 0.25–0.5: 25, 0.5–1: 32, 1–99: 13
floor 0.02: decisions at or under it 0, worlds left with none 0
floor 0.05: decisions at or under it 22, worlds left with none 0
floor 0.1: decisions at or under it 36, worlds left with none 0

## Reading

- Bursts on 10 of 10 worlds before and after; the first burst between years 8.7 and 18.8 in both
  (the first warhead in year 8.7 everywhere). Decisions 172 → 128, bursts 146 → 103; none at or under
  the floor (9 before, 5 of them at 0.01 or less). Seeds 5 to 9 the same worlds (no decision under
  the floor); seeds 1, 2, 3, 4 and 10 part at their first such decision.
- No world lost every decision at floors of 0.02, 0.05 or 0.1 (before). The critic's set-ups decide
  at 0.035 to 0.12 (`.cache/r725a/probe.ts`): Poland on seeds 5591, 7127, 3929; France on 7127, whose
  third decision (day 61, about 0) is gone (`nukeOverrun1938.test.ts`).
- Seed 7's four bursts all fall within 2 days, before and after (Germany on days 3555 to 3558, one a
  day, at 0.185 to 0.265; England's answer): PLAN 7.25b.

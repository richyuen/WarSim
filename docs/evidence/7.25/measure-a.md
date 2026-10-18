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

# PLAN 7.25b: the gap after a launch (measure)

The rule (ADR-507): a side that launched in a war weighs no first use in it for STRIKE_GAP_DAYS 7; a
strike back is not held. Same tool and seeds (`.cache/r725a/b_<seed>.json`, after 7.25a):

| Seed | First warhead, year | Decisions | Bursts | First burst, year | Span, days | Longest gap, days | All within 2 days | Utilities |
|---|---|---|---|---|---|---|---|---|
| 1 | 8.73 | 8 | 4 | 9.4 | 1048 | 924 |  | 0.029 0.036 0.095 0.131 0.335 0.158 0.474 2.051 |
| 2 | 8.73 | 42 | 23 | 8.8 | 5786 | 1824 |  | 0.050 0.027 0.042 0.060 0.069 0.081 0.094 0.107 0.116 0.123 0.128 0.129 0.133 0.129 0.129 0.170 0.148 0.201 0.125 0.124 0.124 0.254 0.257 2.931 0.721 2.858 0.872 1.218 0.904 1.027 0.594 0.782 0.701 0.577 0.698 0.575 0.035 0.202 0.824 0.921 1.000 0.040 |
| 3 | 8.73 | 30 | 30 | 14.5 | 5639 | 1780 |  | 0.030 0.028 1.510 0.671 0.468 0.569 0.599 0.612 0.609 0.339 0.307 0.281 0.127 0.936 0.923 0.134 0.275 0.164 0.365 0.093 0.119 0.059 0.166 0.807 0.378 0.043 0.247 0.613 0.126 0.246 |
| 4 | 8.73 | 49 | 47 | 8.7 | 7135 | 1331 |  | 0.429 0.741 0.158 0.026 0.260 0.235 0.642 0.053 0.405 0.132 0.173 0.551 0.317 0.691 0.865 0.897 0.941 0.300 0.318 0.235 0.266 0.786 0.524 0.587 0.722 0.151 0.181 0.228 0.945 0.979 1.285 1.324 1.359 0.469 0.192 0.202 0.202 0.208 0.214 0.214 0.214 0.214 0.214 0.214 0.214 0.214 0.214 0.214 1.107 |
| 5 | 8.73 | 6 | 6 | 14.4 | 2749 | 1288 |  | 0.200 0.210 0.189 0.309 0.453 0.065 |
| 6 | 8.73 | 5 | 5 | 13.3 | 3191 | 1567 |  | 0.633 0.553 1.075 0.439 0.229 |
| 7 | 8.73 | 15 | 12 | 9.8 | 7034 | 1886 |  | 0.185 0.346 0.213 0.939 0.071 0.094 0.046 0.203 0.085 0.244 0.496 0.288 0.194 0.099 0.424 |
| 8 | 8.73 | 4 | 4 | 18.2 | 3482 | 1669 |  | 0.578 0.040 0.561 0.779 |
| 9 | 8.73 | 1 | 1 | 13.3 | 0 |  | (one) | 0.410 |
| 10 | 8.73 | 15 | 15 | 18.8 | 2868 | 984 |  | 1.110 1.047 0.166 0.033 0.211 0.181 0.203 0.265 0.258 0.349 0.570 0.396 0.571 0.735 0.785 |

Decision utilities (175): 0–0.01: 0, 0.01–0.02: 0, 0.02–0.05: 13, 0.05–0.1: 14, 0.1–0.25: 60, 0.25–0.5: 31, 0.5–1: 43, 1–99: 14
floor 0.02: decisions at or under it 0, worlds left with none 0
floor 0.05: decisions at or under it 14, worlds left with none 0
floor 0.1: decisions at or under it 27, worlds left with none 0

## Reading

- No world's bursts all within 2 days (seed 7: 4 bursts in 2 days → 12 over 19 years, its first,
  Germany on France, day 3562, the next 7 days on and England's answer the day after). Bursts on 10
  of 10 worlds, the first in years 8.7 to 18.8 (seed 1's 9.7 → 9.4; the others as before).
- Bursts a day apart (a strike and an answer, or two sides' strikes): 19 pairs over the ten worlds.
  War-days held by the gap: 1 to 438 a world.
- Seed 4's Germany, losing a war against Iran, Syria, England and #110, struck every 7 days for 13
  weeks (days 8932 to 9023, 14 bursts, 20,573 to 204,764 dead, utility 0.19 to 0.21), until its
  warheads ran out: a drip, not a spasm. Bursts on seed 4: 18 → 47.
  Whether a desperate holder's weekly strikes read as credible is the critic's to judge (PLAN 7.5).
- The critic's set-ups: Poland strikes Germany on seeds 5591 (day 43), 7127 (78 and 85, burst day
  86), 3929 (63 and 70, burst day 71); France on 7127 on days 59, 66, 73, 85.

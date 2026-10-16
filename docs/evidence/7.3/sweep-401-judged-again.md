# Sweep 2026-10-16: seeds 401–410 × 50 years — FAILING (dynamism)

Judged again from `docs/sweeps/2026-10-16-sweep-b1-401.json` (no run).

Criteria (SPEC §10, tools/sweep/criteria.ts, ADR-54; land by area in km², ADR-52). Limits, every seed: land changing controller in the last 5 years ≥ 1.0%; largest nation < 35.0% of land and < 40.0% of income at the end; 20–250 nations alive every year; a war active in ≥ 80.0% of the years. Dynamism, by realm (a nation with no overlord, with its puppets' land), each in ≥ 80.0% of the seeds of runs of ≥ 50 years: a riser (a realm ending with ≥ 1.0% of the land and ≥ 1.5 × its land after year 1) and a faller (one of the ten largest realms after year 1 ending with ≤ 66.7% of its land then); no stasis (the five largest nations by land, as a set, the same in fewer than 20 yearly samples running); no break-up (the living nations never more than 1.1 × the most they were 20 years or more before; ADR-428). The last two columns are reported, not judged.

| Seed | Land moving (last 5 y) | Largest land | Largest income | Alive (min–max) | Years with war | Largest riser (realm, M km²) | Largest faller (realm, M km²) | One top five (longest) | Alive over the most 20 y before | New in top 10 | Leader share range |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 401 | 16.6% pass | 9.9% pass | 30.0% pass | 96–210 pass | 100.0% pass | ARG × 2.65 (2.78 → 7.37) yes | CHI × 0.00 (6.53 → 0.00) yes | 8 y yes | × 1.56 **no** | 3 | 9.8% |
| 402 | 14.8% pass | 9.2% pass | 33.1% pass | 98–210 pass | 100.0% pass | GER × 5.28 (0.92 → 4.86) yes | ENG × 0.17 (35.04 → 6.03) yes | 22 y **no** | × 1.60 **no** | 2 | 8.9% |
| 403 | 6.7% pass | 14.1% pass | 29.1% pass | 98–228 pass | 100.0% pass | ARG × 1.59 (2.78 → 4.43) yes | CHI × 0.00 (7.58 → 0.00) yes | 13 y yes | × 1.59 **no** | 5 | 14.1% |
| 404 | 7.2% pass | 7.6% pass | 29.0% pass | 97–211 pass | 100.0% pass | IRQ × 3.17 (0.43 → 1.38) yes | SOV × 0.04 (25.04 → 1.01) yes | 20 y **no** | × 1.56 **no** | 4 | 11.1% |
| 405 | 12.5% pass | 9.2% pass | 29.4% pass | 92–175 pass | 100.0% pass | NSP × 8.05 (0.83 → 6.69) yes | CHI × 0.00 (6.06 → 0.00) yes | 21 y **no** | × 1.61 **no** | 2 | 8.1% |
| 406 | 7.4% pass | 10.2% pass | 29.1% pass | 95–170 pass | 100.0% pass | ARG × 2.14 (2.78 → 5.94) yes | ITA × 0.00 (4.22 → 0.00) yes | 23 y **no** | × 1.55 **no** | 2 | 7.4% |
| 407 | 16.6% pass | 9.0% pass | 29.0% pass | 95–173 pass | 100.0% pass | JAP × 3.68 (0.67 → 2.46) yes | CHI × 0.00 (6.28 → 0.00) yes | 8 y yes | × 1.53 **no** | 4 | 8.6% |
| 408 | 8.8% pass | 11.0% pass | 28.4% pass | 95–170 pass | 100.0% pass | PRU × 1.44 (1.29 → 1.86) **no** | ITA × 0.28 (4.11 → 1.13) yes | 21 y **no** | × 1.63 **no** | 2 | 6.7% |
| 409 | 11.0% pass | 8.7% pass | 28.2% pass | 96–197 pass | 100.0% pass | IRQ × 4.75 (0.43 → 2.06) yes | CHI × 0.00 (7.66 → 0.00) yes | 18 y yes | × 1.49 **no** | 3 | 8.7% |
| 410 | 25.0% pass | 8.9% pass | 29.8% pass | 95–231 pass | 100.0% pass | JAP × 4.80 (0.67 → 3.21) yes | CHI × 0.10 (6.53 → 0.63) yes | 14 y yes | × 1.59 **no** | 3 | 14.8% |

Limits: 10 of 10 seeds. Riser: 9 of 10. Faller: 10 of 10. No stasis: 5 of 10. No break-up: 0 of 10. Needed: 8 of 10 each.

## Nuclear weapons (PLAN 6.8)

| Seed | First warhead | Warheads at the end (nations) | AI decisions | Bursts | Most land under fallout | Days of war under MAD |
|---|---|---|---|---|---|---|
| 401 | 1946 | 300 (3) | 28 | 28 | 0.17% | 6245 |
| 402 | 1946 | 377 (5) | 0 | 0 | 0.00% | 11917 |
| 403 | 1946 | 398 (5) | 8 | 8 | 0.14% | 8652 |
| 404 | 1946 | 449 (5) | 10 | 10 | 0.11% | 5974 |
| 405 | 1946 | 320 (5) | 20 | 20 | 0.23% | 1461 |
| 406 | 1946 | 401 (5) | 30 | 30 | 0.21% | 7564 |
| 407 | 1946 | 424 (6) | 14 | 14 | 0.18% | 1107 |
| 408 | 1946 | 311 (4) | 6 | 6 | 0.08% | 263 |
| 409 | 1946 | 423 (6) | 2 | 2 | 0.02% | 3157 |
| 410 | 1946 | 428 (6) | 30 | 30 | 0.11% | 7064 |

Nukes used in 9 of 10 seeds (at least 1: pass); the most land under fallout on a day 0.23% (at most 50.0%: pass).

Wall time 53.2 min (the report’s longest seed) with 10 processes (per seed: 401: 45.7 min, 402: 36.8 min, 403: 28.5 min, 404: 24.9 min, 405: 47.8 min, 406: 45.1 min, 407: 43.7 min, 408: 36.6 min, 409: 35.5 min, 410: 53.2 min).

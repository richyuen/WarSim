# Sweep 2026-10-14: seeds 1–10 × 50 years — FAILING (limits)

Criteria (SPEC §10, tools/sweep/criteria.ts, ADR-54; land by area in km², ADR-52). Limits, every seed: land changing controller in the last 5 years ≥ 1.0%; largest nation < 35.0% of land and < 40.0% of income at the end; 20–250 nations alive every year; a war active in ≥ 80.0% of the years. Dynamism, by realm (a nation with no overlord, with its puppets' land), each in ≥ 80.0% of the seeds of runs of ≥ 50 years: a riser (a realm ending with ≥ 1.0% of the land and ≥ 1.5 × its land after year 1) and a faller (one of the ten largest realms after year 1 ending with ≤ 66.7% of its land then). The last two columns are reported, not judged.

| Seed | Land moving (last 5 y) | Largest land | Largest income | Alive (min–max) | Years with war | Largest riser (realm, M km²) | Largest faller (realm, M km²) | New in top 10 | Leader share range |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 20.2% pass | 10.0% pass | 28.9% pass | 93–170 pass | 100.0% pass | PRU × 2.21 (1.29 → 2.86) yes | BCO × 0.18 (2.37 → 0.44) yes | 3 | 10.4% |
| 2 | 25.1% pass | 8.8% pass | 32.3% pass | 96–208 pass | 100.0% pass | CHI × 3.13 (7.66 → 23.97) yes | SOV × 0.00 (25.49 → 0.00) yes | 4 | 9.3% |
| 3 | 16.3% pass | 9.0% pass | 29.7% pass | 94–186 pass | 100.0% pass | POL × 34.80 (0.06 → 2.16) yes | ITA × 0.00 (4.28 → 0.00) yes | 3 | 10.0% |
| 4 | 40.9% pass | 10.6% pass | 30.7% pass | 96–214 pass | 100.0% pass | GER × 40.82 (0.72 → 29.36) yes | ENG × 0.00 (34.99 → 0.00) yes | 2 | 10.2% |
| 5 | 18.2% pass | 7.0% pass | 28.2% pass | 98–170 pass | 100.0% pass | ARG × 2.36 (2.78 → 6.57) yes | ENG × 0.18 (35.19 → 6.34) yes | 3 | 9.9% |
| 6 | 18.4% pass | 8.5% pass | 29.5% pass | 97–255 **FAIL** | 100.0% pass | GER × 4.51 (0.86 → 3.87) yes | ENG × 0.10 (34.79 → 3.62) yes | 3 | 8.0% |
| 7 | 32.0% pass | 10.5% pass | 13.5% pass | 93–253 **FAIL** | 100.0% pass | CHI × 3.30 (7.66 → 25.32) yes | ENG × 0.15 (35.04 → 5.08) yes | 3 | 9.4% |
| 8 | 35.4% pass | 8.5% pass | 28.9% pass | 96–219 pass | 100.0% pass | IRQ × 3.59 (0.43 → 1.56) yes | SOV × 0.00 (25.07 → 0.00) yes | 3 | 8.6% |
| 9 | 18.2% pass | 7.4% pass | 29.3% pass | 95–193 pass | 100.0% pass | JAP × 6.39 (0.67 → 4.28) yes | BRA × 0.00 (8.51 → 0.00) yes | 2 | 10.4% |
| 10 | 13.9% pass | 9.6% pass | 29.8% pass | 96–189 pass | 100.0% pass | GER × 15.84 (0.54 → 8.55) yes | CHI × 0.00 (7.28 → 0.00) yes | 2 | 8.5% |

Limits: 8 of 10 seeds. Riser: 10 of 10. Faller: 10 of 10. Needed: 8 of 10 each.

## Nuclear weapons (PLAN 6.8)

| Seed | First warhead | Warheads at the end (nations) | AI decisions | Bursts | Most land under fallout | Days of war under MAD |
|---|---|---|---|---|---|---|
| 1 | 1946 | 300 (5) | 84 | 84 | 0.41% | 3285 |
| 2 | 1946 | 373 (5) | 59 | 59 | 0.24% | 836 |
| 3 | 1946 | 393 (5) | 25 | 25 | 0.13% | 501 |
| 4 | 1946 | 110 (3) | 177 | 177 | 0.41% | 9204 |
| 5 | 1946 | 339 (5) | 4 | 4 | 0.07% | 2547 |
| 6 | 1946 | 360 (8) | 139 | 139 | 0.60% | 6464 |
| 7 | 1946 | 211 (6) | 130 | 130 | 0.63% | 9471 |
| 8 | 1946 | 448 (5) | 31 | 30 | 0.18% | 3593 |
| 9 | 1946 | 278 (5) | 94 | 94 | 0.39% | 3745 |
| 10 | 1946 | 219 (4) | 175 | 175 | 0.65% | 6585 |

Nukes used in 10 of 10 seeds (at least 1: pass); the most land under fallout on a day 0.65% (at most 50.0%: pass).

Wall time 112.6 min with 10 processes (per seed: 1: 84.4 min, 2: 88.8 min, 3: 81.7 min, 4: 100.4 min, 5: 53.7 min, 6: 97.7 min, 7: 112.6 min, 8: 69.5 min, 9: 82.5 min, 10: 87.0 min).

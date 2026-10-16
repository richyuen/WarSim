# Sweep 2026-10-15: seeds 1–10 × 50 years, map size S — ALL GREEN

Criteria (SPEC §10, tools/sweep/criteria.ts, ADR-54; land by area in km², ADR-52). Limits, every seed: land changing controller in the last 5 years ≥ 1.0%; largest nation < 35.0% of land and < 40.0% of income at the end; 20–250 nations alive every year; a war active in ≥ 80.0% of the years. Dynamism, by realm (a nation with no overlord, with its puppets' land), each in ≥ 80.0% of the seeds of runs of ≥ 50 years: a riser (a realm ending with ≥ 1.0% of the land and ≥ 1.5 × its land after year 1) and a faller (one of the ten largest realms after year 1 ending with ≤ 66.7% of its land then). The last two columns are reported, not judged.

| Seed | Land moving (last 5 y) | Largest land | Largest income | Alive (min–max) | Years with war | Largest riser (realm, M km²) | Largest faller (realm, M km²) | New in top 10 | Leader share range |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 7.8% pass | 8.5% pass | 28.6% pass | 95–208 pass | 100.0% pass | JAP × 3.23 (0.67 → 2.16) yes | CHI × 0.00 (7.40 → 0.00) yes | 3 | 11.0% |
| 2 | 22.5% pass | 8.0% pass | 28.7% pass | 98–190 pass | 100.0% pass | POL × 35.57 (0.05 → 1.75) yes | BRA × 0.00 (8.51 → 0.00) yes | 3 | 9.2% |
| 3 | 25.7% pass | 7.9% pass | 29.0% pass | 92–229 pass | 100.0% pass | ARG × 1.54 (2.78 → 4.27) yes | POR × 0.01 (2.20 → 0.02) yes | 3 | 15.1% |
| 4 | 23.5% pass | 7.0% pass | 28.4% pass | 96–185 pass | 100.0% pass | SIA × 8.53 (0.51 → 4.34) yes | CHI × 0.00 (7.68 → 0.00) yes | 4 | 10.1% |
| 5 | 15.8% pass | 14.2% pass | 28.7% pass | 93–214 pass | 100.0% pass | JAP × 4.93 (0.67 → 3.29) yes | ITA × 0.00 (4.35 → 0.00) yes | 2 | 10.8% |
| 6 | 9.3% pass | 9.5% pass | 28.9% pass | 97–167 pass | 100.0% pass | ARG × 1.25 (2.78 → 3.47) **no** | SOV × 0.00 (24.46 → 0.00) yes | 4 | 6.7% |
| 7 | 19.5% pass | 10.2% pass | 28.7% pass | 99–156 pass | 100.0% pass | USA × 1.34 (9.58 → 12.84) **no** | CHI × 0.00 (7.68 → 0.00) yes | 2 | 7.2% |
| 8 | 8.2% pass | 8.1% pass | 28.4% pass | 97–174 pass | 100.0% pass | GER × 7.35 (0.64 → 4.72) yes | CHI × 0.00 (6.55 → 0.00) yes | 2 | 8.5% |
| 9 | 10.8% pass | 7.5% pass | 28.4% pass | 93–225 pass | 100.0% pass | GER × 16.50 (0.63 → 10.34) yes | SOV × 0.00 (24.82 → 0.00) yes | 2 | 10.0% |
| 10 | 12.2% pass | 7.8% pass | 29.5% pass | 99–192 pass | 100.0% pass | BOL × 2.89 (1.09 → 3.13) yes | ITA × 0.00 (3.25 → 0.00) yes | 4 | 17.0% |

Limits: 10 of 10 seeds. Riser: 8 of 10. Faller: 10 of 10. Needed: 8 of 10 each.

## Nuclear weapons (PLAN 6.8)

| Seed | First warhead | Warheads at the end (nations) | AI decisions | Bursts | Most land under fallout | Days of war under MAD |
|---|---|---|---|---|---|---|
| 1 | 1946 | 437 (6) | 7 | 7 | 0.10% | 9843 |
| 2 | 1946 | 353 (4) | 3 | 3 | 0.05% | 1483 |
| 3 | 1946 | 490 (6) | 37 | 37 | 0.25% | 10621 |
| 4 | 1946 | 473 (6) | 7 | 7 | 0.04% | 677 |
| 5 | 1946 | 409 (7) | 39 | 39 | 0.16% | 11328 |
| 6 | 1946 | 394 (5) | 32 | 32 | 0.26% | 9102 |
| 7 | 1946 | 398 (5) | 3 | 3 | 0.04% | 4203 |
| 8 | 1946 | 402 (5) | 0 | 0 | 0.00% | 7575 |
| 9 | 1946 | 403 (6) | 0 | 0 | 0.00% | 8755 |
| 10 | 1946 | 349 (6) | 23 | 23 | 0.28% | 9419 |

Nukes used in 8 of 10 seeds (at least 1: pass); the most land under fallout on a day 0.28% (at most 50.0%: pass).

Wall time 14.1 min with 10 processes (per seed: 1: 14.1 min, 2: 13.8 min, 3: 12.6 min, 4: 12.2 min, 5: 13.8 min, 6: 12.7 min, 7: 13.5 min, 8: 12.3 min, 9: 13.4 min, 10: 13.0 min).

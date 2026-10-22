# PLAN 7.51b — the late air war, measured (bar missed)

2026-10-22, on `309f0d4e` (PLAN 7.75 and 7.76 in). Tool: `tools/diag/airLate.ts` (new), seeds
7401–7410 (PLAN 7.49's unseen seeds) × 20 years headless, five at a time (`b/air_<seed>.json`,
`.out`, `.log`). Per year: air battles (`AirBattle` events), mean sorties aloft an hour, mean wars,
wings, and land formations engaged (on land, `engaged` set, as `landEngaged.ts`) and per war.

## The AT's figure

Air battles a year in years 2–20 against year 1's (bar: at least a tenth):

| seed | year 1 | years 2–20, a year | share | engaged per war, year 1 → late |
| --- | --- | --- | --- | --- |
| 7401 | 2,957 | 172.5 | 0.058 | 4.82 → 0.26 |
| 7402 | 3,478 | 149.1 | 0.043 | 8.74 → 0.49 |
| 7403 | 2,625 | 153.7 | 0.059 | 5.79 → 0.21 |
| 7404 | 2,738 | 148.2 | 0.054 | 5.10 → 0.43 |
| 7405 | 2,133 | 312.0 | **0.146** | 5.83 → 0.28 |
| 7406 | 3,800 | 172.0 | 0.045 | 6.39 → 0.47 |
| 7407 | 3,502 | 227.7 | 0.065 | 8.05 → 0.45 |
| 7408 | 3,595 | 180.1 | 0.050 | 5.69 → 0.37 |
| 7409 | 3,373 | 201.8 | 0.060 | 6.69 → 0.28 |
| 7410 | 2,896 | 289.4 | **0.100** | 4.99 → 0.29 |
| pooled | 31,097 | 200.7 a seed | **0.065** | 6.11 → 0.35 (0.057) |

**Missed**: 0.065 pooled, bar 0.10; two seeds of ten at it on their own. Run 11's figures were
3,160 in year 1 and 120 a world-year after on 14 seeds (0.038).

## The measured cause: the air war follows the land war

By design (ADR-377) a nation at war flies at the enemy's land forces in range. Over the 190
seed-years 2–20:

- air battles a year against land formations engaged: correlation 0.448; against wars running:
  0.063;
- by quartile of engaged (0.75 / 1.37 / 2.32 / 4.44 a day): air battles 112 / 136 / 187 / 317 a
  year;
- engaged per war late is 0.057 of year 1's; the air battles 0.065 of theirs: the air war stands
  where the land war does;
- sorties aloft: 40–58 in year 1, 9.9–14.3 a year after (the critic's mean 8.1).

PLAN 7.26 (ADR-519, ADR-520) found the same: the air AI tasks 0.83 of the wings at war with an
enemy in range, late as in year 1; what falls is the number of wings with anything in range, and a
patrol over home meets nothing (ADR-520). The land war late is PLAN 7.49's, closed not done at its
budget (ADR-614): engaged per war 0.052 of year 1 there, against its bar of a quarter.

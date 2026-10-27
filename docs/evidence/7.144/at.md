# PLAN 7.144's AT: the k-th strike of a day on a land formation at 1 / (1 + k), on 1294–1303 × 20 years

2026-10-27. HEAD `4da68474` (from the worktree `WarSim_base`) against the rule (ADR-737) in the main tree,
`tools/diag/airWar.ts` seven runs at a time (about 35 minutes), files in `.cache/7144/at_head` and
`.cache/7144/at_rule`. The read that found the rule: `measure.md`.

| seed | 1294 | 1295 | 1296 | 1297 | 1298 | 1299 | 1300 | 1301 | 1302 | 1303 | mean |
|---|---|---|---|---|---|---|---|---|---|---|---|
| engaged a day, years 2–20, HEAD | 3.13 | 3.07 | 3.73 | 3.52 | 3.58 | 2.57 | 3.35 | 4.46 | 3.08 | 2.92 | 3.34 |
| engaged a day, years 2–20, rule | 4.93 | 5.49 | 5.83 | 5.62 | 5.73 | 4.73 | 4.48 | 5.87 | 4.99 | 6.19 | 5.39 |
| engaged a day, year 1, HEAD | 47.3 | 50.5 | 41.6 | 45.5 | 33.3 | 45.6 | 43.8 | 35.0 | 39.4 | 59.4 | 44.14 |
| engaged a day, year 1, rule | 34.5 | 37.6 | 39.6 | 49.2 | 31.8 | 35.2 | 42.0 | 32.9 | 33.8 | 41.8 | 37.84 |
| wings, years 2–20, HEAD | 120.1 | 110.7 | 119.3 | 120.2 | 120.8 | 115.3 | 122.0 | 109.3 | 128.1 | 100.4 | 116.62 |
| wings, years 2–20, rule | 135.1 | 133.6 | 112.3 | 112.1 | 105.3 | 133.6 | 132.9 | 108.1 | 104.2 | 104.0 | 118.09 |
| aloft an hour, years 2–20, HEAD | 27.5 | 25.4 | 25.4 | 29.1 | 28.7 | 28.4 | 26.4 | 28.6 | 29.1 | 29.4 | 27.79 |
| aloft an hour, years 2–20, rule | 38.2 | 36.8 | 36.3 | 40.2 | 37.5 | 36.1 | 34.6 | 41.0 | 31.5 | 31.2 | 36.33 |
| aloft an hour, year 1, HEAD | 49.7 | 63.2 | 52.4 | 47.4 | 38.2 | 58.3 | 59.1 | 55.1 | 59.8 | 49.5 | 53.27 |
| aloft an hour, year 1, rule | 57.0 | 65.3 | 53.9 | 53.3 | 40.3 | 65.5 | 68.5 | 60.4 | 65.2 | 53.3 | 58.27 |
| air battles a year, years 2–20, HEAD | 660 | 729 | 556 | 820 | 674 | 461 | 647 | 756 | 562 | 780 | 665 |
| air battles a year, years 2–20, rule | 540 | 624 | 679 | 717 | 720 | 437 | 567 | 764 | 718 | 593 | 636 |
| wars a day, years 2–20, HEAD | 6.50 | 7.99 | 6.27 | 8.49 | 7.24 | 8.30 | 5.67 | 5.78 | 8.01 | 7.24 | 7.15 |
| wars a day, years 2–20, rule | 6.93 | 6.64 | 6.52 | 8.39 | 6.45 | 6.17 | 5.63 | 5.92 | 6.88 | 8.09 | 6.76 |

- Engaged land formations a day in years 2–20 **1.61 ×** (bar 1.25 ×), higher on all ten: **met**.
- Wings in years 2–20 **1.01 ×**, sorties aloft **1.31 ×** (bar 0.9 ×): **met**. Year 1 aloft 1.09 ×.
- Engaged in year 1 **0.86 ×** (bar 0.95 ×), lower on nine: **missed**.
- Year 1's contact moves into year 2, it is not lost: years 1–3 44.1, 9.2, 6.7 → 37.8, 18.6, 9.8 (years 1 and 2
  together 53.3 → 56.4). Wars (7.02 → 7.22) and nations at war (50.0 → 50.3) in year 1 alike: the opening fights
  last longer when the air wears their armies down less. Air battles in years 2–20 0.96 ×.
- Seeds 1294–1303 spent.

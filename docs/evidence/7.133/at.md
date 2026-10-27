# PLAN 7.133's AT: the sea ferry on 1171–1180 × 20 years

2026-10-26. HEAD `5cba3b5b` (no ferry) against `cad3d3d5` (the ferry, ADR-723), `airWar.ts` five at a time, files in
`.cache/7133/head` and `.cache/7133/rule`.

## The AT

| seed | 1171 | 1172 | 1173 | 1174 | 1175 | 1176 | 1177 | 1178 | 1179 | 1180 | mean |
|---|---|---|---|---|---|---|---|---|---|---|---|
| year 1 aloft, HEAD | 46.4 | 59.0 | 54.4 | 57.3 | 44.7 | 59.7 | 58.5 | 56.8 | 48.8 | 58.4 | 54.40 |
| year 1 aloft, ferry | 53.9 | 57.3 | 58.1 | 57.1 | 47.9 | 53.0 | 52.1 | 58.3 | 38.7 | 57.9 | 53.43 |
| years 2–20 aloft, HEAD | 16.21 | 15.97 | 16.47 | 13.31 | 18.31 | 15.61 | 12.91 | 20.32 | 16.65 | 13.90 | 15.97 |
| years 2–20 aloft, ferry | 15.90 | 15.55 | 16.41 | 21.71 | 17.75 | 14.83 | 14.97 | 17.15 | 23.13 | 14.92 | 17.23 |

Late **1.08 ×** (bar 1.5 ×): **missed**. Year 1 0.98 × (bar 0.9 ×): held.

## What moved (years 2–20, means a world-year; `cols.cjs` in the session's scratchpad)

| | HEAD | ferry | × |
|---|---|---|---|
| air battles a year | 206 | 254 | 1.23 |
| sorties aloft an hour | 15.97 | 17.23 | 1.08 |
| wings | 94.5 | 69.7 | 0.74 |
| wings of nations at war | 68.6 | 43.8 | 0.64 |
| with a mission | 15.9 | 17.2 | 1.08 |
| of the wings at war, with a mission | 0.23 | 0.39 | 1.70 |
| out of range of every enemy | 47.6 | 21.0 | 0.44 |

By year (wings / sorties aloft): HEAD's air forces fall to 87 by year 7 and regrow to 100 by year 20; with the ferry
they fall to 67 by year 7 and stay there. The ferry puts a wing at war into the fight 1.7 × as often, and the air
forces that fight are a quarter smaller.

## Why the wings are fewer (`airForce.ts`, 1174 and 1177 × 6 years, both arms)

Lost in the air: 1174 years 3–6 84 (HEAD 49); 1177 year 1 143 (HEAD 92). Built about the same (10–24 a year in both).
The rebuild is held by gold in both arms (`gold` and `goldPriceHeld` the largest gates). The wings sent across the
sea meet the enemy's air and are shot down faster than the economic AI replaces them.

## Reading

The mechanism works (the wings at war out of range 47.6 → 21.0 a world, tasked 0.23 → 0.39 of them); the sky late is
held by the air forces' size, which the losses and the rebuild's gold set. The critic's saves gave 1.5–2.3 × from a
year-20 world over 120 days: too short for the attrition, and worlds the critic picked for an empty sky (the 7.130
gotcha). Seeds 1171–1180 spent; the next tasks 1181 on.

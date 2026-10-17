# PLAN 7.15: the late world keeps moving (measures, after PLAN 7.14)

Critic run 7 (dynamics 6): seed 3371 moved 0.72 % of its land in years 26–30; 8803 had 0 to 3 wars a year from year 18; Canada and Greenland stayed whole for 30 years on 3 of 4 seeds (`critic/c7_headless_*.json`). Measured at HEAD `2a57f75` (PLAN 7.14's rules: ADR-480, ADR-481).

## The critic's seeds

`npm run sweep -- --first <seed> --seeds 1 --years 30 --scratch` (reports beside this file):

- Seed 3371: land changing controller in years 26–30 17.6 %; wars at each year's end from year 18: 3, 3, 3, 5, 4, 4, 7, 4, 5, 8, 6, 3, 3.
- Seed 8803: land changing controller in years 26–30 12.3 %; wars at each year's end from year 18: 4, 3, 3, 7, 1, 7, 4, 3, 1, 1, 2, 2, 0.

## Canada and Greenland

`tools/diag/northAmerica.ts <seed> 30`, seeds 1–10: the share of Canada's 1938 land (77,523 cells) still Canada's at the end, the least share of Greenland's (33,861 cells, Denmark's) Denmark kept, and the landings on either.

| Seed | Canada's own at the end | Its owners at the end | Greenland's least kept by Denmark | Landings on Canada | on Greenland |
|---|---|---|---|---|---|
| 1 | 0.426 | CAN 33041, USA 44482 | 1.000 | 0 | 0 |
| 2 | 0.693 | CAN 53724, USA 23799 | 1.000 | 6 | 0 |
| 3 | 0.000 | USA 75317, FRA 2049, #105 99, DEN 29, EGY 29 | 1.000 | 9 | 0 |
| 4 | 0.494 | CAN 38329, USA 39194 | 0.590 | 8 | 2 |
| 5 | 0.447 | CAN 34666, USA 42857 | 1.000 | 0 | 2 |
| 6 | 0.340 | CAN 26327, USA 51196 | 1.000 | 0 | 2 |
| 7 | 0.443 | CAN 34321, USA 43202 | 0.809 | 6 | 1 |
| 8 | 0.461 | CAN 35719, USA 41804 | 1.000 | 0 | 0 |
| 9 | 0.707 | CAN 54799, USA 22724 | 1.000 | 0 | 0 |
| 10 | 0.413 | CAN 32014, ITA 4336, USA 41173 | 1.000 | 2 | 0 |

Canada loses land in every seed (most of it to the United States), and is landed on in 5 of 10 seeds; Greenland in 4 of 10 (by Italy, Germany, Canada, Cuba, Japan, Yugoslavia, the United States), and changes hands in 2.

## The 50-year sweep

`docs/sweeps/2026-10-17-sweep-714.md` (seeds 1–10 × 50 years, PLAN 7.14): land moving in the last 5 years 2.7 % to 30.8 % (the limit, every seed); riser 10 of 10, faller 10 of 10, no stasis 9 of 10, no break-up 10 of 10 (dynamism, at least 8 of 10 each).


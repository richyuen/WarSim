# PLAN 7.82's AT: emergent dynamics on unseen seeds (2026-10-23)

Bar: on 10 unseen seeds × 30 years no stasis over 15 years (the critic's measure: the five holding the
most cells by controller, yearly, as a set), and the share of cells changing hands by a front battle in
years 10–30 measured and at least HEAD's (1.96 % pooled on 831–840 at 7.82a, read before 7.97's rule).
HEAD `71c760ef`, seeds 841–850, `tools/diag/churnAt.ts`, 5 at a time (`at/*.out`).

| Seed | Longest | Years | The five (cells over the span; days at war a year; engaged, daily mean) | Battle % |
|---|---|---|---|---|
| 841 | 7 | 1–7 | SOV 171–201k 338 1.51; DEN 34–34k 87 0.00; AST 25–26k 106 0.09; CAN 78–78k 54 0.01; USA 46–46k 0 0.00 | 2.0 |
| 842 | 13 | 10–22 | SOV 179–202k 343 0.17; DEN 23–33k 129 0.01; AST 25–27k 242 0.03; CAN 58–66k 277 0.01; USA 76–128k 176 0.19 | 2.1 |
| 843 | 19 | 12–30 | SOV 98–150k 362 0.17; DEN 35–43k 315 0.08; JAP 38–71k 345 0.16; CAN 46–73k 337 0.01; USA 93–142k 251 0.46 | 1.9 |
| 844 | 17 | 13–29 | SOV 191–222k 309 0.50; FRA 28–35k 298 0.12; DEN 32–32k 29 0.00; CAN 31–76k 250 0.02; USA 65–119k 226 0.86 | 1.8 |
| 845 | 19 | 8–26 | SOV 201–213k 270 0.19; FRA 32–37k 268 0.03; DEN 34–34k 12 0.00; CAN 59–60k 24 0.00; USA 67–70k 24 0.01 | 1.9 |
| 846 | 15 | 14–28 | GER 21–31k 363 1.27; SOV 156–182k 357 0.27; DEN 25–35k 180 0.04; CAN 33–70k 357 0.03; USA 79–124k 223 1.54 | 3.1 |
| 847 | 8 | 18–25 | GER 53–79k 358 0.32; SOV 145–159k 337 0.04; JAP 24–30k 364 0.06; CAN 60–60k 26 0.00; USA 68–68k 2 0.00 | 1.1 |
| 848 | 9 | 18–26 | SOV 56–89k 346 0.07; ENG 33–83k 357 0.96; JAP 29–55k 347 0.15; CAN 69–76k 333 0.01; USA 85–117k 273 1.46 | 1.7 |
| 849 | 7 | 19–25 | GER 51–81k 281 0.34; SOV 75–113k 365 0.03; JAP 35–56k 352 0.20; CAN 73–74k 272 0.00; USA 106–115k 276 0.31 | 1.3 |
| 850 | 11 | 11–21 | SOV 185–202k 337 0.37; TUR 21–26k 355 0.01; AST 25–28k 285 0.03; CAN 66–72k 297 0.03; USA 86–102k 246 0.85 | 1.6 |
Pooled battle share in years 10–30: **1.82 %** (7.82a's 1.96 % on 831–840, before 7.97; 7.82b's HEAD
control 1.77 % on 834–835).

**Stasis over 15 years on 3 of 10 (843 19, 844 17, 845 19): the bar is missed.** 846 is at 15.

## What holds the three

- **843: a remnant at war, untouched.** Denmark at war 315 days a year, 0.08 engaged, its cells *rising*
  35k → 43k; fifth all 19 years, 9–20k over the sixth. The case 7.82b's read named, and the candidate
  rule (`b.patch`, ADR-664) was kept for.
- **844: a holder at peace.** Denmark at war 29 days a year at 32,251–32,371 cells for 17 years; the
  USA (65–119k) and Canada (31–76k) move, but stay in the five. The fifth place changes between France
  and Denmark, the sixth 17–28k.
- **845: three holders at peace.** Denmark 12 days at war a year, Canada 24, the USA 24, each within
  2 % of its cells for 19 years; France 32–37k, the Soviet Union 201–213k. Nobody fights the Americas
  or Greenland, so nothing moves the set.

Of the 3, one is the at-war remnant a landing rule reaches; two are nations at peace for a decade or
more, which no invasion rule reaches: who goes to war with whom is the strategic AI's.

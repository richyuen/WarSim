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

## The AT again on 851–860 (2026-10-23, after 7.82d; ADR-671)

HEAD `923c2950` (7.82d's rule, the pin 7c2e4700), seeds 851–860 × 30 years, `tools/diag/churnAt.ts`, 5 at a
time (`at851/*.out`, `at851/*.json`).

| Seed | Longest | Years | The five (cells over the span; days at war a year; engaged, daily mean) | Battle % |
|---|---|---|---|---|
| 851 | 7 | 14–20 | SOV 83–118k 365 0.02; FRA 46–70k 347 0.84; ENG 38–58k 301 0.56; DEN 31–31k 245 0.04; USA 120–144k 245 0.41 | 1.7 |
| 852 | 8 | 9–16 | SOV 163–175k 365 0.56; DEN 34–34k 0 0.00; JAP 25–33k 358 0.22; CAN 66–70k 356 0.00; USA 69–119k 324 0.95 | 1.9 |
| 853 | 11 | 20–30 | SOV 78–111k 341 0.04; JAP 37–65k 365 0.15; CAN 30–72k 331 0.02; USA 115–211k 347 0.89; BRA 25–28k 324 0.05 | 1.5 |
| 854 | 10 | 9–18 | SOV 58–97k 320 0.07; FRA 38–46k 204 0.61; JAP 35–60k 357 0.30; CAN 65–70k 240 0.00; USA 70–114k 157 0.54 | 1.8 |
| 855 | 11 | 20–30 | SOV 66–167k 364 0.08; DEN 34–34k 0 0.00; JAP 28–101k 365 0.13; CAN 71–78k 340 0.01; USA 66–89k 279 0.53 | 2.2 |
| 856 | 15 | 16–30 | SOV 68–186k 365 0.26; DEN 20–24k 357 0.01; AST 25–27k 363 0.06; CAN 29–88k 363 0.01; USA 87–223k 326 0.95 | 1.6 |
| 857 | 8 | 14–21 | GER 37–46k 365 0.91; SOV 170–175k 362 0.20; FRA 21–28k 357 0.13; CAN 21–59k 360 0.02; USA 76–113k 351 0.16 | 1.5 |
| 858 | 8 | 15–22 | SOV 50–140k 358 0.19; DEN 34–34k 23 0.04; AST 27–29k 359 0.04; CAN 27–72k 359 0.01; USA 124–223k 351 1.23 | 1.5 |
| 859 | 8 | 8–15 | GER 39–104k 361 0.23; SOV 93–132k 358 0.06; JAP 44–71k 357 0.07; CAN 40–78k 323 0.00; USA 62–123k 193 0.18 | 1.3 |
| 860 | 10 | 10–19 | GER 26–46k 361 1.32; SOV 80–168k 335 0.22; DEN 28–34k 363 0.00; CAN 51–72k 353 0.01; USA 98–167k 302 0.94 | 1.9 |

- **Stasis over 15 years on 0 of 10: the first clause is met.** 856 sits at the bar (15 years): Denmark
  20–24k at war 357 days a year with 0.01 engaged, the shape of 843 (the remnant at war, untouched; 7.82c
  closed not done, ADR-669 a).
- **Battle share in years 10–30 pooled 1.67 % (260,907 of 15.6M changes; 1.3–2.2 by seed), bar 1.96 %:
  the second clause is missed.** By cause: walk-in 57.1 %, revolt 30.3 %, peace 10.3 %, battle 1.67 %,
  capital 0.52 %, puppet 0.12 %, landing 0.02 %.
- **The bar's history.** 1.96 % is 7.82a's HEAD on 831–840, before 7.97's rule. HEAD after 7.97 read
  1.77 % on 834–835 (7.82b) and 1.82 % on 841–850 (the first AT read, missed then on stasis alone): the
  share was under the bar before 7.82d. 7.82d's same-seed reads (`d/at.md`): 845 battles 8,748 → 22,937
  with the share 1.9 → 1.4 %, 844 17,166 → 20,182 with 1.8 → 1.6 %: the battles rise, walk-ins and
  revolts rise more. (841–850 against 851–860 are different seeds and are not compared.)

**Verdict: missed on the share clause.** No rule; the pin unchanged (7c2e4700). ADR-671 to the user.

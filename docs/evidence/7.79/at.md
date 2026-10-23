# PLAN 7.79's AT: the land war after year 1, from 1938 (2026-10-23)

Run: `tools/diag/landAt.ts <seed> 20` on unseen seeds 821–830 (no earlier task used them), HEAD `fc95b3a1`
and the tree before 7.79's first rule (`b5af8b75`, the parent of 7.79b's `7bcadb21`), 5 at a time. The
sampling is `landEngaged.ts`'s (PLAN 7.49's AT, the source of the AT's 0.34 / 5.1): daily after each day's
24 hours, the land formations of living nations (not fleets, wings or off land) with `engaged` set, and the
wars running; per war = mean engaged over mean wars. A pile: 30 or more land formations of a living nation
at war on one cell; its longest run of consecutive days is read. Files: `at/head_<seed>.json|log`,
`at/base_<seed>.json|log`.

## 1. Engaged land formations a war (bar: years 2–20 at least a tenth of year 1)

Pooled over the 10 seeds (sum of engaged over sum of wars):

| tree | year 1 engaged | wars | per war | years 2–20 engaged | wars | per war | ratio |
|---|---|---|---|---|---|---|---|
| before 7.79 (`b5af8b75`) | 33.73 | 6.33 | 5.330 | 2.20 | 7.44 | 0.295 | 0.055 |
| HEAD (`fc95b3a1`) | 40.33 | 6.23 | 6.476 | 3.19 | 6.70 | 0.477 | **0.074** |

Per seed, HEAD: 0.074 0.116 0.040 0.057 0.075 0.106 0.045 0.116 0.065 0.081 (3 of 10 at or over 0.1);
before: 0.073 0.038 0.051 0.040 0.093 0.028 0.043 0.085 0.089 0.049. The bar is missed: 0.074 against 0.1.
Late engaged per war rose by 62 % (0.295 → 0.477), year 1's by 21 %, so the ratio by 35 %.

## 2. Piles of 30+ held 30 days running (bar: none)

HEAD: 32 such piles, on all 10 seeds; before 7.79: 29, on all 10. The bar is missed.

HEAD by nation: USA 18, Italy 4, Soviet Union 3, Germany 3, Britain 3, France 1. The largest is 107
American formations (822, year 20, 239 days). The longest are 548 days (825, two American piles to year 19).
One American cell, (585, 364), holds a pile of 34–80 on 5 of the 10 seeds (37–548 days). Before 7.79 the
USA had 11, Germany 10.

| seed | piles of 30+ held 30 days (nation (x, y) longest run, year it ended, most) |
|---|---|
| 821 | USA (411,454) 109 d y20 35; USA (585,364) 63 d y12 36 |
| 822 | USA (585,364) 288 d y6 38; USA (541,116) 239 d y20 107; ITA (1151,378) 141 d y2 49 |
| 823 | ITA (1109,373) 302 d y3 34; SOV (1307,387) 38 d y2 33 |
| 824 | USA (1616,588) 61 d y12 41; USA (585,364) 58 d y11 39; USA (1595,518) 54 d y20 50; USA (1589,553) 33 d y12 47; USA (1590,553) 32 d y12 61 |
| 825 | USA (585,364) 548 d y19 80; USA (476,486) 548 d y19 38; USA (729,169) 214 d y15 51; GER (1100,267) 173 d y6 36; ITA (1016,335) 65 d y2 40; GER (1018,336) 62 d y2 42; USA (488,197) 43 d y14 45; USA (83,167) 41 d y20 34 |
| 826 | GER (1089,249) 67 d y14 36; SOV (1169,221) 30 d y1 32 |
| 827 | FRA (1199,305) 84 d y11 40; ITA (1130,319) 38 d y1 43 |
| 828 | USA (1187,200) 144 d y20 49; ENG (995,360) 138 d y8 35; ENG (1298,421) 106 d y20 48 |
| 829 | SOV (1237,389) 413 d y5 35; USA (1267,432) 207 d y11 53 |
| 830 | USA (602,678) 141 d y19 30; ENG (1031,338) 63 d y19 31; USA (585,364) 37 d y8 34 |

## 3. Verdict

Both bars missed. 7.79's parts (7.79b's allotment by threat, 7.79c's ferry from a fronted landmass, and
7.88–7.91 after them) lifted late engaged per war by 62 % on fresh worlds, but not to a tenth of year 1,
and did not stop the piles: the USA's home army still stands in piles of 30–107 for months, as on run 12's
saves (7.89, 7.90), and the European powers hold piles in years 1–6 too. The unit tests of the rules are
7.79b's and 7.79c's (each red without). No rule in this read; the pin unchanged (7098dd29).

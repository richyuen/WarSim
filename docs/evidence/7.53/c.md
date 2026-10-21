# PLAN 7.53c: rivalry tried; armed wars flat (not landed; ADR-587 proposed, the user's)

2026-10-21, on `7525908` (7.53b in). `tools/diag/peers.ts`, the tuning seeds 3011, 3023, 3037, 3041 ×
20 years, means of the weekly samples of years 2–20 (4–20 for the gates). Figures in `c/`; the
candidate code (all of its forms' last) in `c-candidate.diff`, which applies to `7525908`.

| run | the rule | armed wars | great pairs at war | new wars between great powers a year | engaged worldwide |
|---|---|---|---|---|---|
| 7.53a (HEAD before b) | none | 0.57 | 1.57 | — | 1.51 |
| 7.53b | rivals apart | 0.60 | 1.16 | — | 1.67 |
| c1 | + rivalry, RIVAL 1 | 0.57 | 1.36 | — | 1.84 |
| c2 | RIVAL 2, a great power one war over MAX_WARS for a rival | 0.64 | 1.68 | 1.8 (c3's read) | 1.81 |
| c4 | + GREAT_FLOOR 0.25 (a great power has a quarter of the first's strength) | 0.54 | 1.93 | 1.09 | 1.67 |
| c0 | c4 with RIVAL 0 and no war over MAX_WARS (the floor alone) | 0.59 | 1.96 | 1.13 | 1.65 |

(Great pairs: of the 6 strongest, as in 7.53a, in every row.)

## What it says

1. **The gates of a declaration on a rival** (c1, declarations over DECLARE_AT, years 4–20, 3011
   and 3041): MAX_WARS 483, a weaker neighbour scoring higher 206, the weekly draw 214. With RIVAL
   2 and one war more for a rival (c2) MAX_WARS is gone (22 of 1,233) and the rest are the draw
   and the better target: the design.
2. **The wars between great powers have fronts, not armies at them** (c3): of the great pairs at
   war, 0.12–0.19 have no land front, 0.59–1.70 a front with one side under 5 land formations near
   it, 0.21–0.81 armed. The thin side's armies are elsewhere: 7.49b–e's causes (stranded at home,
   the strait cells, the purse).
3. **There are no peers late.** The sixth strongest has 1–6 % of the first's strength at years 10,
   15 and 20 on all four seeds. With a floor of a quarter of the first's strength, the great powers
   are 3–4 at year 5 and **2** from year 10 on every seed. Between those two the rivalry motive
   changes nothing measured (c4 against c0: new wars between great powers 1.09 and 1.13 a year,
   armed wars 0.54 and 0.59).

## The bar

7.53c's AT (armed wars in years 2–20 at least twice 7.53a's, 1.14) is missed on every form: 0.54
to 0.64. 7.53's AT (1.5 on 10 unseen seeds) is further. The strategic AI's choice of wars is not
what holds the figure: after year 10 the world has one or two powers of any size, they fight each
other about once a year already, and the armies of the weaker side do not stand at the front.
What moves armed wars is 7.49's parts, and the concentration of strength (from year 10 the third strongest under a quarter of the first)
is the long-run balance's. The options are ADR-587's.

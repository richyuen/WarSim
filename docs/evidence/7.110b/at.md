# PLAN 7.110b: a quarter of a strike's fire on a formation out of contact (ADR-692)

2026-10-24. HEAD `3c05e7d7` (pin 1ef5c241). The rule (`rule.patch`): `DISPERSED_STRIKE` = 0.25 of `STRIKE_FIRE` on
a land formation with `engaged` unset (`airCombat.ts`, `strikes`); the pin 1ef5c241 → 4347c49c.

## A/B from one saved state

`tools/diag/armyAtWarAb.ts`, 180 days from the year-10 saves of 7.110a's runs (`.cache/7110/head/`), HEAD in a
worktree of `3c05e7d7` and the rule in the tree:

| save | land formations at war a war | engaged a war | men at war (M) |
|---|---|---|---|
| 901 | 21.14 → 22.41 | 0.294 → 0.475 | 1.09 → 1.13 |
| 903 | 34.21 → 35.39 | 0.590 → 0.846 | 2.15 → 2.21 |
| 905 | 41.44 → 45.83 | 0.377 → 0.452 | 2.54 → 2.69 |
| 907 | 61.41 → 70.49 | 1.885 → 1.771 | 2.60 → 3.17 |
| 909 | 46.54 → 48.98 | 0.652 → 0.686 | 2.06 → 2.19 |

Pooled 39.73 → 43.37 (× 1.09 in half a year; the army rebuilds at ~90 formations a year, so it takes years to stand
where the new losses meet the orders).

## The air's rebuild and the sink (one seed)

Seed 901 × 20 on `188b773e` (before 7.113a, ADR-689) against HEAD: land formations at war a war in years 2–20
56.6 against 39.8; land formations destroyed in years 2–20 1,971 against 2,433, raised 1,669 against 1,865. The
histories part after year 1, so one seed tells little, but it agrees with 7.110a: the strikes are the sink, and
the rebuilt air forces strike more.

## The AT (971–980 × 20, `tools/diag/armyAtWarAt.ts`)

HEAD: 51.38 land formations of nations at war a war in years 2–20 (the bar, × 1.3: 66.8).

| seed | HEAD | rule | engaged a war, HEAD | rule |
|---|---|---|---|---|
| 971 | 53.3 | 70.2 | 0.487 | 0.847 |
| 972 | 54.1 | 66.5 | 0.531 | 0.718 |
| 973 | 44.2 | 60.0 | 0.563 | 0.478 |
| 974 | 49.6 | 53.9 | 0.313 | 0.564 |
| 975 | 60.1 | 76.4 | 0.777 | 0.768 |
| 976 | 55.3 | 52.1 | 0.522 | 0.622 |
| 977 | 47.1 | 85.2 | 0.514 | 0.808 |
| 978 | 51.6 | 59.8 | 0.350 | 0.565 |
| 979 | 61.2 | 58.0 | 0.491 | 0.783 |
| 980 | 40.8 | 51.2 | 0.513 | 0.633 |

Pooled (ratio of sums): land formations at war a war **51.38 → 62.54, × 1.217** (bar × 1.3: missed; up on 8 of 10);
engaged a war **0.497 → 0.671, × 1.35** (clause 2 met; up on 8 of 10). Data: `at_971-980.json`.

## Two unit tests red with the rule

Neither is of the rule's own code; both read a seeded 1938 history.

1. `operationalAi.test.ts` › "the larger nation advances, and both sides spread along the front": Poland's
   coverage on day 30 (the share of its front sectors with one of its formations within 2 sectors) 0.519, the bar
   0.6; HEAD 0.607. Day by day (`cov.ts.txt` here, run from `.cache/7110/`, days 20–36), HEAD and the rule:

   | day | HEAD: covered / sectors; near / formations | rule |
   |---|---|---|
   | 20 | 0.67: 20/30; 29 of 33 | 0.74: 25/34; 38 of 42 |
   | 24 | 0.81: 22/27; 29 of 31 | 0.61: 17/28; 27 of 31 |
   | 26 | 0.67: 18/27; 24 of 26 | 0.61: 17/28; 28 of 30 |
   | 28 | 0.65: 17/26; 18 of 20 | 0.56: 15/27; 26 of 28 |
   | 30 | 0.61: 17/28; 14 of 16 | 0.52: 14/27; 24 of 26 |
   | 32 | 0.63: 17/27; 7 of 8 | 0.56: 15/27; 23 of 25 |
   | 34 | 0.60: 15/25; 4 of 5 | 0.60: 15/25; 21 of 22 |

   The front is as long; with the rule Poland has 10 formations more near it and covers fewer of its sectors: the
   operational AI piles the formations the strikes no longer grind away. HEAD's point readings dip to 0.52 too
   (day 17), but the rule's days 24–34 are under HEAD's on every day but 34. Not restated: the test reads a
   weakness of the spread that the rule uncovers.
2. `wholeTanks.test.ts` (seed 3929, armoured division 41 loses whole tanks in contact in the 48 hours from hour
   231): with the rule the division is first fired at in hour 306 (HEAD: 237), a lighter fight (2–8 volleys an
   hour at its armour, HEAD 9–14), and loses no tank in the 48 hours from it. A restatement that finds the hour
   (in `rule.patch`) passes on HEAD (6 tanks) and not with the rule (0): the claim would need a longer window or
   another case.

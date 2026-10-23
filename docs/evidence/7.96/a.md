# PLAN 7.96a — which input of the decision doubled the rate (read only)

7.86 (`docs/evidence/7.86/measure.md`): `dd3b730`'s nuclear rule fires 1.93 × as often a holder-day at
war in HEAD's world as in its own. Here: the decision's inputs under that same rule, in both worlds.

## The run

`tools/diag/nukeRate.ts <seed> 10 20` (new, read only; only APIs both trees have): each day at 00:00 of
years 10–20, for each holder of warheads and each of its wars, `restraintOf` (the gate of the day's
decision): the reason it holds, the best place's utility and parts. A row is kept for each day whose
gain or utility is over NUKE_FLOOR, with the world's taboo (`world.nukeTaboo`) that day.

Trees: **old** `dd3b730`; **rule** HEAD `07c623c7` with `dd3b730`'s `nuclear.ts` (7.86's). Seeds 2953 and
3613, the two of 7.86's twelve with the cleanest rise in years 11–20: 0 → 13 bursts each, at fewer
holder-days at war (30.0 → 27.7 and 39.7 → 32.2 holder-years). The probe leaves the world alone: its
burst counts are `nukeVolume.ts`' (0, 0, 13, 13). Files: `a-<tree>-nr_<seed>.json` (rows cut to the
strike days), `a_attr.py`.

## The days

| | 2953 old | 2953 rule | 3613 old | 3613 rule |
|---|---|---|---|---|
| Holder-war-days | 23,466 | 20,849 | 28,508 | 23,785 |
| `noThreat` (no enemy threatens it) | 21,304 (91 %) | 14,202 (68 %) | 17,447 (61 %) | 8,056 (34 %) |
| A place weighed | 1,221 | 5,871 | 9,605 | 6,909 |
| Gain over the floor | 384 | 3,508 | 3,069 | 4,050 |
| Utility over the floor | 0 | 10 | 0 | 260 (196 `noMeans`, 51 `outOfRange`) |
| Strike days | 0 | 10 | 0 | 13 |
| Mean desperation, days weighed | 0.149 | 0.312 | 0.220 | 0.301 |
| Mean place value | 0.258 | 0.493 | 0.310 | 0.336 |
| Mean taboo cost | 0.512 | 0.280 | 0.479 | 0.290 |

In the old world the gain passes the floor on 384 and 3,069 days, and the costs hold every one: on
2953 the taboo alone (all 384 days `taboo`). In HEAD's world more holders are threatened, more
desperate, and weigh dearer places (the busier land war), and the taboo's cost is half.

## The strike days: what holds each without the broken taboo

The taboo (`world.nukeTaboo`) is 1, falls to TABOO_AFTER (0.3) on any burst anywhere, and recovers by
TABOO_RECOVERY (0.0005) a day: about four years to whole. Its cost is through × TABOO_WEIGHT (0.6) ×
taboo, halved in extreme desperation. Each of the 23 strike days, its utility with the world's taboo
whole (its extreme kept):

- **17 of 23 fall under the floor** (2953: 6 of 10; 3613: 11 of 13). They strike only because a burst,
  often their own, broke the taboo in the four years before.
- **6 stand with the taboo whole:** 3613 day 5145 (the world's first burst, taboo 1.0: Germany, gain 0.81 at
  desperation 0.61 and value 0.95), and on 2953 days 5971, 6287, 6288, 6320 and on 3613 day 6697 (gains
  1.09–1.40, desperation 0.91–1.33, or an answer, `n` 82 on day 6288).
- **Extreme desperation** (the taboo's halving) holds 1 (2953 day 6287).

The volleys are this: on 3613 Germany strikes on day 6690 with the taboo at 0.77 (recovering from day
5757), then on days 6697, 6780, 6787, 6805 and 6821 with it at 0.30–0.34, each over the floor by
0.04–0.82 and each under it with the taboo whole but one.

So the trigger is the busier war (a first strike that passes with the taboo whole, as 3613's day
5145; in the old world of these seeds none did in years 10–20). The amplifier, 17 of 23 strike days
(74 %), is the taboo the first burst breaks for every nation for about four years.

## What a shallower break would leave (first order)

The 23 strike days with TABOO_AFTER raised, the recovery as now (`a_attr.py`'s figures; first order,
each day read alone, so it does not see a world in which the first bursts did not happen):

| TABOO_AFTER | 0.3 (now) | 0.5 | 0.6 | 0.7 | 0.8 | 1.0 (never broken) |
|---|---|---|---|---|---|---|
| Strike days kept | 23 | 10 | 8 | 7 | 7 | 6 |

## The rule it points to (7.96b)

The taboo after a burst: TABOO_AFTER 0.3 lets one burst pay for the next ones of every nation for four
years. Candidates for 7.96b: TABOO_AFTER raised (0.6 keeps 8 of 23 first order), or the break limited to
the war of the burst. The bar is 7.96's (bursts a world and civilian bursts on 10 unseen seeds × 30
years not above `dd3b730`'s).

**Note (7.96b, `b.md`):** the live A/B does not bear out the TABOO_AFTER table above. On four seeds × 30
years, 0.6 cuts bursts 122 → 97 and 0.7 to 101, where the table's 8 of 23 would have cut about two
thirds. Each strike the taboo holds comes back later. Read the table as days read alone, not a forecast.

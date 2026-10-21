# PLAN 7.53a: wars between peers on HEAD (measured, no rule)

2026-10-21, HEAD `36aa263` with the declaration's utility moved into `warUtility` (`strategic.ts`;
the same sum in the same order: the pin unchanged). `tools/diag/peers.ts`, seeds 3011, 3023, 3037,
3041 (the tuning seeds: none of the critic's, of 7.39c's or of the AT's to come) × 20 years,
weekly samples, about 5 minutes a seed four at once. Figures in `a/`.

Great powers: the 6 strongest living nations that are no puppet, by `strengths` (men and the navy's
weight), each week. Of their 15 pairs: allied (one alliance), neighbours (`neighbourMap`), at war
with each other, and "open" (neighbours, neither allied nor at war: a war a rivalry motive could
start).

| seed | armed wars, year 1 | armed wars, years 2–20 | engaged, years 2–20 | great pairs allied | neighbours | at war | open |
|---|---|---|---|---|---|---|---|
| 3011 | 2.56 | 0.41 | 0.96 | 5.81 | 3.86 | 0.42 | 0.43 |
| 3023 | 2.54 | 0.41 | 0.97 | 1.36 | 3.11 | 1.25 | 1.18 |
| 3037 | 3.00 | 0.80 | 2.99 | 3.25 | 5.07 | 3.40 | 1.67 |
| 3041 | 2.81 | 0.67 | 1.12 | 4.79 | 4.16 | 1.21 | 1.16 |
| mean | 2.73 | **0.57** | 1.51 | 3.80 | 4.05 | 1.57 | 1.11 |

(Armed: each side 5 or more land formations within DEPLOY_RANGE_CELLS of the war's front. The
critic's saves gave 0.5 at years 10 and 20: the same.)

## What it says

- **One alliance holds the great powers.** Germany's alliance of 1938 (`a1`: Germany, Italy,
  Poland, Japan) is 3 to 5 of the 6 from year 2 on every seed; on 3011 from year 10 all of the
  last 20 years' great powers but the United States and Australia are in it ("allied 6": four
  members, six pairs). 3023 is the exception: its `a1` lost Japan and Poland, and its great pairs
  allied are 1–2.
- **Few pairs a rivalry could start.** Great powers that border each other are about 4 pairs of
  15 (the United States borders none of them most years); with the allied and the warring taken
  off, about 1 open pair a week, 0 for whole decades on 3011 and 3041. The best declaration of an
  open pair scores a median −0.3 to +0.7 (DECLARE_AT 0.5), its strength term near 0: even
  strength, no motive.
- **Where great powers fight, the land war has contact.** 3037's years 15–20 (Britain's alliance
  against Germany's, 7–8.5 great pairs at war): 2.06 armed wars and 8.5 engaged in year 20, the
  only late year of the four seeds near year 1's.

## For the parts

The split (ADR-585's option 4) first: with the great powers in one alliance a rivalry motive has
about one pair a week to act on. Then rivalry (option 2) on the pairs the split opens. PLAN 7.53b
and 7.53c are swapped so.

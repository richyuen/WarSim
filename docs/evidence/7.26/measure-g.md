# PLAN 7.26g: the 7.26 AT re-measured on 10 seeds × 30 years (2026-10-18)

Code: `6d1f727` (after 7.26f's restore of the chain rebase, ADR-515, and c3b's measure, ADR-516,
which built no rule). Seeds 1–10, as 7.26d and 7.26e; the before is 7.26e's run on `80bcc74`
(`.cache/726e/`), the after `.cache/726g/`. Measured by `tools/diag/airWar.ts <seed> 30`, ten side
by side, nothing else running (about 15 minutes), judged by `tools/diag/airAt.ts`; the definitions
are 7.26d's (`measure-d.md`). Per-seed table `.cache/tmp/tab726g.ts`, the short years' split
`.cache/tmp/split726d.ts`.

## The code check

The only `src/` change since 7.26f's runs (`4e95f84`) is ADR-515's `air.ts`. The ten runs' state
hashes equal 7.26f's c4-off runs (`.cache/726f/c4_*.json`) in every one of the 300 years: the
switch's off path was the old code, and those runs were the committed code's. So "against
`c4_*`" is an identity; the table below reads against 7.26e.

## The verdict

**0 of 10 seeds pass, as at 7.26d and 7.26e.** War-years at the bar, of 29: 0–3.

| seed | year 1 7.26e → now | years 2–10 mean | years 21–30 mean | at the bar (of 29) | air battles 1–10 → 21–30 now | end hash |
|---|---|---|---|---|---|---|
| 1 | 39.6 → 39.3 | 19.1 → 16.8 | 4.4 → 6.5 | 3 | 5,471 → 476 (0.09) | `b3062ab` |
| 2 | 43.0 → 43.1 | 14.5 → 14.2 | 9.0 → 12.0 | 1 | 4,459 → 727 (0.16) | `8918af0a` |
| 3 | 42.7 → 44.1 | 16.2 → 18.0 | 7.8 → 9.8 | 2 | 4,933 → 1,675 (0.34) | `b9ccfb75` |
| 4 | 56.2 → 56.2 | 15.3 → 14.8 | 9.9 → 9.7 | 0 | 6,334 → 2,611 (0.41) | `f4566fe4` |
| 5 | 52.9 → 48.2 | 14.7 → 13.8 | 5.3 → 12.7 | 3 | 3,693 → 662 (0.18) | `23eff23b` |
| 6 | 51.6 → 52.7 | 13.6 → 11.3 | 8.6 → 8.6 | 1 | 3,648 → 84 (0.02) | `51eb84ba` |
| 7 | 41.4 → 42.7 | 12.8 → 12.2 | 4.9 → 7.3 | 1 | 4,395 → 738 (0.17) | `5ed303d7` |
| 8 | 50.1 → 49.1 | 12.6 → 13.3 | 10.4 → 12.0 | 0 | 4,597 → 1,328 (0.29) | `763cd092` |
| 9 | 49.5 → 43.4 | 13.5 → 16.4 | 7.3 → 11.2 | 3 | 4,509 → 1,284 (0.28) | `5e31229a` |
| 10 | 47.1 → 46.9 | 16.6 → 17.3 | 4.9 → 5.5 | 2 | 6,220 → 622 (0.10) | `978164dc` |
| mean | 47.4 → 46.6 | 14.9 → 14.8 | 7.2 → 9.5 | | 21–30: 7,524 → 10,207 | |

Years 21–30 back to about 7.26d's (9.8); years 2–10 level; the bar (year 1) level. Years 2–30
mean: missions 10.5 → 11.6, land formations in contact 1.4 → 1.5 a day.

## The years with a front

7.26c's AT line: "defensive patrols over home only if the years with a front still fall short".
Counting a war-year as one with a front when its mean land formations in contact (`engaged`) is at
least N (year 1: 29.9 on the ten seeds' mean):

| N | war-years (of 290) | of them at the bar | median aloft ÷ year 1 | the others at the bar |
|---|---|---|---|---|
| 2 | 59 | 8 | 0.33 | 8 of 231 |
| 3 | 34 | 7 | 0.38 | 9 of 256 |
| 5 | 19 | 5 | 0.40 | 11 of 271 |
| 10 | 3 | 1 | 0.38 | 15 of 287 |
| 20 | 0 | – | – | 16 of 290 |

**The condition is met:** the years with land contact fall short too (at N = 5, 14 of 19), at a
median 0.38–0.40 of year 1. No late year has two-thirds of year 1's contact. More land contact
helps (26 % of N = 5 years at the bar against 4 % of the others), but the land war would have to
come back to year 1's to carry the air war there, and the rules of 7.26c moved it little (years
2–30, 1.42 a day at 7.26d, 1.5 now).

## The short war-years (274)

| | year 1 | short years, 7.26e | short years, now |
|---|---|---|---|
| wings | 169.4 | 143.8 | 144.9 |
| of nations at war | 100.3 | 74.0 | 81.3 |
| with a mission | 46.0 | 9.5 | 10.6 |
| without: every enemy land formation out of range | 39.6 | 55.9 | **62.4** |
| without: one in range | 9.4 | 1.9 | 2.8 |
| land formations in contact | 29.9 | 1.1 | **1.4** |
| rebased a day | 2.2 | 1.9 | 1.6 |

Of the out-of-range wings, sampled weekly (906,620 samples): **58 % no base of their side in range
of any enemy** (7.26e 63 %), 38 % such a base free, of those within one hop 7 %, 4 % all such
bases full. By nation: the United States 212 k, Japan 151 k, Britain 96 k, Germany 56 k, the
Netherlands 51 k, Italy 49 k, France 29 k.

## What is short, split

1. **The great powers' own transports** (the line under 7.26g, ADR-516): Germany, Britain and the
   Netherlands stopped at `noTransport` for whole years; they and the US and Japan hold most of the
   idle wings. Measured first where their transport groups are on those days (under way, on
   patrol, sunk, at a port lost), no rule: 7.26h.
2. **Defensive patrols over home** (7.26c's condition, met above): a wing of a nation at war with no
   enemy land formation in range flies a patrol over its own land within reach of the enemy's air
   or sea. Measured first how many of the idle wings stand where an enemy wing or fleet could come:
   7.26i.
3. c3b1 (a partner's transports sent to the nation's port) and c3c (the lift by sea to the own
   front) wait on 7.26h's evidence.

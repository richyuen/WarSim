# PLAN 7.26e: the 7.26 AT re-measured on 10 seeds × 30 years (2026-10-18)

Code: `80bcc74` (after 7.26c3a, c4, c1b, c2b's fix: ADR-511 to ADR-514). Seeds 1–10, as 7.26d; the
before is 7.26d's run on `edd105e` (`.cache/726d/`), the after `.cache/726e/`. Both measured by
`tools/diag/airWar.ts <seed> 30`, ten side by side, nothing else running (15 minutes), and judged by
`tools/diag/airAt.ts`; the definitions are 7.26d's (`measure-d.md`). Per-seed comparison
`.cache/tmp/cmp726e.ts`, the short years' split `.cache/tmp/split726d.ts` on the new files.

## The verdict

**0 of 10 seeds pass, as at 7.26d.** War-years at the bar, of 29: 0–3 (before 0–3).

| seed | year 1 before → after | years 2–10 mean | years 21–30 mean | at the bar (of 29) | air battles 1–10 → 21–30 after |
|---|---|---|---|---|---|
| 1 | 50.4 → 39.6 | 13.4 → 19.1 | 8.3 → 4.4 | 3 | 3,897 → 354 (0.09) |
| 2 | 51.2 → 43.0 | 15.1 → 14.5 | 12.9 → 9.0 | 3 | 4,794 → 1,613 (0.34) |
| 3 | 44.9 → 42.7 | 15.0 → 16.2 | 10.2 → 7.8 | 1 | 4,279 → 914 (0.21) |
| 4 | 38.8 → 56.2 | 18.4 → 15.3 | 11.1 → 9.9 | 0 | 4,789 → 740 (0.15) |
| 5 | 52.3 → 52.9 | 17.8 → 14.7 | 11.0 → 5.3 | 2 | 3,751 → 228 (0.06) |
| 6 | 49.9 → 51.6 | 14.8 → 13.6 | 6.7 → 8.6 | 1 | 5,137 → 1,737 (0.34) |
| 7 | 51.1 → 41.4 | 15.7 → 12.8 | 12.4 → 4.9 | 1 | 3,964 → 378 (0.10) |
| 8 | 52.3 → 50.1 | 13.1 → 12.6 | 7.3 → 10.4 | 1 | 4,208 → 613 (0.15) |
| 9 | 44.1 → 49.5 | 19.6 → 13.5 | 12.0 → 7.3 | 1 | 5,022 → 674 (0.13) |
| 10 | 52.1 → 47.1 | 14.7 → 16.6 | 6.4 → 4.9 | 2 | 4,388 → 273 (0.06) |
| mean | 48.7 → 47.4 | 15.8 → 14.9 | 9.8 → 7.3 | | 21–30: 14,664 → 7,524 |

Year 1 (the bar) barely moved (48.7 → 47.4). The late air war fell: years 2–10 on 7 of 10 seeds,
years 21–30 on 8 of 10 (mean 9.8 → 7.3), the air battles of years 21–30 about halved. Years 2–30,
the ten seeds' mean: sorties aloft 11.85 → 10.55, wings of nations at war 73.5 → 74.9, with a
mission 11.8 → 10.5, out of range 53.4 → 55.8, rebased a day 1.6 → 2.0.

End hashes after year 30: 1 `ab58de3e`, 2 `492aaa19`, 3 `1e9a2d65`, 4 `81260d82`, 5 `78feff55`,
6 `d611f456`, 7 `8d70c77c`, 8 `cf3c6d53`, 9 `6f1fc52b`, 10 `fa7d33bb`.

## The short war-years (275, against 7.26d's 273)

| | year 1 | short years, 7.26d | short years, now |
|---|---|---|---|
| wings | 169.1 | 139.7 | 143.8 |
| of nations at war | 101.1 | 73.1 | 74.0 |
| with a mission | 46.9 | 10.8 | 9.5 |
| without: no enemy land formation at all | 5.4 | 5.4 | 6.6 |
| without: every enemy land formation out of range | 38.8 | 54.1 | **55.9** |
| without: one in range | 10.0 | 2.8 | 1.9 |
| hollow | 3.4 | 5.3 | 6.0 |
| land formations in contact | 30.3 | 1.2 | **1.1** |
| wars | 6.0 | 5.3 | 5.3 |
| rebased a day | 2.3 | 1.6 | 1.9 |

Of the out-of-range wings, sampled weekly (815,296 samples): **63 % no base of their side in range
of any enemy** (7.26d: 59 %), 32 % such a base free (36 %), of those within one hop 9 % (a tenth),
5 % all such bases full. By nation: the United States 182 k, Japan 132 k, Germany 68 k, the
Netherlands 57 k, Italy 56 k, Britain 48 k, France 32 k: the order of 7.26d.

## The four readings the task named

1. **Against c4 (ADR-512): the ten seeds fell below 7.26d's** (years 21–30 9.8 → 7.3 on 8 of 10;
   years 2–10 15.8 → 14.9). The task's first question then: whether a wing on a chain should still
   take a base within a hop nearer its goal in km with more hops left; then c3a. More rebases
   (1.6 → 2.0 a day) and fewer missions (11.8 → 10.5) is the shape a step that moves wings without
   bringing them into range would leave.
2. **Against c2b (ADR-514): the contact did not fall** beyond a run's noise (years 2–30 1.42 →
   1.36 a day, up on 5 seeds and down on 5; the short years 1.2 → 1.1; years 2–10 up on 5 of 10).
   Its "test first" is not taken.
3. **Against c3a (ADR-511): the contact is not down on more seeds** (5 up, 5 down). The `send`
   path is not the first question.
4. **Against c1b (ADR-513): the AT is still short**, and the largest share is still the wings
   with no base of their side near any enemy (63 %): c3b's lift by sea before anything of c1b's.

## The split

The late air war fell while land contact held: what lowered it is in the air, not the land war.
Four rules came between (c3a, c4, c1b, c2b), one run each, diverging from year 1, so which of them
is not known from these runs.

1. **7.26f (new): which of the four lowered the late air war**, by 30-year runs from 1938 with
   each rule's old behaviour behind a switch, one off at a time (seeds 1, 5 and 7, the largest
   falls: 12 runs). Not from saved states: c4, c1b and c2b each read neutral from six saved states
   while the long runs fell. The rule found restored or changed, its own commit.
2. **7.26c3b, the colonies' and small members' landings**: the 63 % share, after 7.26f.
3. **7.26g (new): the AT re-measured** after 7.26f and c3b.

# PLAN 7.147's read: year 1's land contact under ADR-737, on HEAD

2026-10-27, HEAD `0f67ccb4`. The task (found by 7.144's AT, ADR-737 a): on 1294–1303 × 20, engaged land formations
a day in year 1 fell 44.1 → 37.8 (0.86 ×) with the k-th strike of a day at 1 / (1 + k). Its AT asks year 1 at least
1.1 × HEAD's on unseen seeds. The read asked which opening fights hold fewer formations under the falloff.

## The same tool, ten paired seeds (`tools/diag/airWar.ts`, 2 years)

7.144's arms are its AT's files (`.cache/7144/at_head`, `.cache/7144/at_rule`); HEAD's are `.cache/7147/aw`, run
now on the same seeds. Engaged land formations a day, sampled at each day's end:

| year 1 | 1294 | 1295 | 1296 | 1297 | 1298 | 1299 | 1300 | 1301 | 1302 | 1303 | mean |
|---|---|---|---|---|---|---|---|---|---|---|---|
| before ADR-737 (`4da68474`) | 47.3 | 50.5 | 41.6 | 45.5 | 33.3 | 45.6 | 43.8 | 35.0 | 39.4 | 59.4 | 44.14 |
| ADR-737 at its commit | 34.5 | 37.6 | 39.6 | 49.2 | 31.8 | 35.2 | 42.0 | 32.9 | 33.8 | 41.8 | 37.84 |
| HEAD `0f67ccb4` | 35.2 | 42.0 | 53.0 | 47.6 | 39.3 | 43.7 | 42.4 | 32.5 | 34.8 | 53.2 | 42.37 |

| year 2 | mean |
|---|---|
| before ADR-737 | 9.19 |
| ADR-737 at its commit | 18.57 |
| HEAD | 14.58 |

- HEAD against before ADR-737, year 1: **0.96 ×** (paired −1.8 ± 2.2 a day, higher on 3 of 10): within noise of
  no loss, and over 7.144's own year-1 floor (0.95 ×). Against ADR-737 at its commit: 1.12 ×.
- The AT's bar, 1.1 × HEAD's year 1, is 46.6 a day: 1.06 × the world before ADR-737.

## The falloff switched off on HEAD (`tools/diag/yearOneContact.ts`, 365 days, hour 12)

The exact arm: `strikeShare` returning 1 behind a temporary environment switch, removed after the read. Eight
spent seeds:

| seed | 1294 | 1295 | 1296 | 1297 | 1298 | 1299 | 1300 | 1303 | mean |
|---|---|---|---|---|---|---|---|---|---|
| HEAD | 34.3 | 42.0 | 53.4 | 47.7 | 37.7 | 43.4 | 41.7 | 53.7 | 44.23 |
| no falloff | 42.2 | 40.2 | 43.3 | 42.7 | 32.1 | 43.3 | 36.5 | 42.5 | 40.35 |

Paired, HEAD − no falloff +3.9 ± 2.1 a day. This excludes a falloff deficit of 7.144's size on HEAD (−6 a day would
lie some 5 standard errors away); it does not show that the falloff raises year 1. The tool's own arm (`FLAT=1`,
`formations.struck` zeroed after each tick, no change to the sim) leaves strikes arriving in the same hour dimmed;
on four seeds it read 43.4 against HEAD's 44.4, alike in sign.

By nation (HEAD / no falloff, engaged a day, the eight seeds): China 13.3 / 16.1, the Soviet Union 5.1 / 2.8, Italy
3.9 / 2.3, Germany 3.1 / 2.1, Japan 3.1 / 3.8, Nationalist Spain 2.6 / 2.2, Poland 1.4 / 0.7: which wars open, and
where, differs by seed and arm; no war loses its contact to the falloff on every seed.

## What moved it back

Between `4da68474`'s rule and HEAD: PLAN 7.145 (carriers strike ashore, ADR-738; Japan's naval bombers on China from
hour 3) and 7.146 (the outnumbered on a land front, ADR-739; its AT read year 1 at 1.008 × its base, which already
had ADR-737). 7.145 is the likely mover; not read further.

## Verdict

The cause the task was filed for is not on HEAD: year 1's contact is back to 0.96 × the world before ADR-737, and
the falloff switched off does not raise it. The AT's 1.1 × HEAD would ask year 1 for more contact than before the
rule, with no finding behind it. ADR-741, the user's decision. Seeds 1304–1313 unspent.

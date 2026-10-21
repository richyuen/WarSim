# PLAN 7.39c: 7.39's two bars on 10 unseen seeds × 30 years, with the chase (ADR-580)

## The run

- HEAD `f68f92d` (the chase landed, ADR-580; ADR-581's rule), no change to the code.
- `npx tsx tools/diag/seaYears.ts <seed> 30 docs/evidence/7.39/c/years_<seed>.json` on seeds 20011,
  20021, 20023, 20029, 20047, 20051, 20063, 20071, 20089, 20101, all ten at once (about 55 minutes).
- Unseen: no file name under `docs/`, `.cache/` or `critic/` carries one of them, and none appears in
  `docs/evidence/7.39`, `7.46`, `7.47*` or `critic/c10_summary.txt` (the critic's 14 seeds and the
  4 × 10 seeds of 7.46 and 7.47 are 1307 to 9437, 1129, 7127).
- Table: `node docs/evidence/7.39/c/read.mjs` (`c/read.txt`).

## 1. The two bars

| 10 unseen seeds × 30 years, HEAD `f68f92d` | |
| --- | --- |
| sea battles, year 1 (a world) | 55.4 |
| **sea battles, years 2–30 (a world-year)** | **13.91** (4,035 in 290 world-years) |
| a quarter of year 1 (7.39's bar) | 13.85 (554 / 40) |
| **late battles sinking nothing (bar 5 %)** | **0.7 %** |
| years 2–10 / 11–30 | 14.1 / 13.8 |

Both bars are met. The first one is met by 0.5 %: 13.91 against 13.85. On the critic's 14 seeds the
margin was 6 % (14.7 against 13.9, `docs/evidence/7.46/c.md`). The chase raises year 1 (55.4 here,
55.7 on the critic's seeds; 37.6 on HEAD without it), and with it the bar. The late figure itself is
close to the critic's seeds' (13.9 against 14.7), and is steady: 14.1 in years 2–10, 13.8 in 11–30.

Per seed, year 1 / years 2–30 a world-year: 20011 53 / 10.5; 20021 60 / 16.3; 20023 57 / 16.9;
20029 59 / 18.1; 20047 20 / 10.8; 20051 50 / 10.1; 20063 49 / 14.8; 20071 72 / 8.8; 20089 68 / 15.2;
20101 66 / 17.6. The bar is on the mean; 6 of the 10 clear a quarter of their own year 1, and 20047
(a quiet year 1) is the only seed whose late years beat its year 1 / 2.

## 2. Read, not a bar

| | |
| --- | --- |
| armed power (k) / fleets / navies, year 1 | 258.9 / 84.0 / 15.8 |
| year 2 | 145.6 / 48.9 / 11.3 |
| year 3 | 127.8 / 43.9 / 12.4 |
| year 5 | 129.3 / 48.8 / 16.3 |
| year 10 | 158.8 / 64.6 / 19.2 |
| year 20 | 201.9 / 75.8 / 17.7 |
| year 30 | 242.6 / 76.0 / 17.3 |
| year 10: seeds with no pair at war with a fleet each in one basin (day mean 0) | 0 of 10 |
| year 20: the same | 1 of 10 (20047) |

The world's navy falls to about half by year 2-3 and climbs back to 94 % of year 1's by year 30, the
shape of the critic's seeds with the chase (`c.md` §2 of 7.46). The critic's read (18 of 28 samples
with no war of two navies) is a sample of one day; this is a year's day mean, so the two are not the
same figure. Here, every seed but one has, on an average day of years 10 and 20, a pair at war with an
armed fleet each in one basin.

## 3. The verdict

7.39's AT: met on the critic's 14 seeds (7.46c) and on 10 unseen seeds (here). 7.39c and 7.39 are
ticked. The thin margin on the unseen seeds is recorded: a later rule that lifts year 1's battles more
than the late years' would put the bar out of reach on these seeds.

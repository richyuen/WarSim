# PLAN 7.173: what adds the living nations (bisect, 2026-10-31)

Tool: `tools/diag/birthsByYear.ts` (each year: living, born, died, history rows by kind).

## 1. HEAD (fc52107e) against 30dfd3c (the 2026-10-19 sweep 727d's code), 50 years

Seeds 1481, 1483, 1487, 1490 (break-up on all four in the 762u sweep). Sums over the four seeds
(`kinds-by-decade.txt`, the runs in `runs/`):

| Years | Revolts old | Revolts HEAD | Born old / died | Born HEAD / died | Eliminated old / HEAD | Land ceded old / HEAD |
|---|---|---|---|---|---|---|
| 1–10 | 84 | 155 | 64 / 149 | 110 / 157 | 157 / 186 | 599 / 1207 |
| 11–20 | 65 | 242 | 57 / 41 | 173 / 152 | 44 / 197 | 729 / 1729 |
| 21–30 | 34 | 288 | 31 / 46 | 225 / 225 | 49 / 273 | 601 / 2527 |
| 31–40 | 34 | 481 | 30 / 40 | 348 / 266 | 43 / 339 | 574 / 2565 |
| 41–50 | 38 | 483 | 30 / 38 | 340 / 347 | 42 / 444 | 521 / 2660 |

The births are revolts (`RevoltSpawned`); revivals and released puppets are near the old figures.
HEAD's world is a treadmill (revolts founded, conquered, founded again), and in years 31–40 the births
outrun the deaths: the break-up. Days of war under MAD are of the old order (762u 5,798–12,394 a seed;
727d 0–14,236): not the cause.

HEAD's living counts match the 762u sweep's year by year (1481: 97 97 100 99 …): the tool reads the
sweep's worlds.

## 2. Bisect on the revolts of years 1–15, seeds 1483 + 1487 + 1490

Commit index = position in `git rev-list --reverse 30dfd3c..fc52107e` (533 commits). Files in `probes/`.

| # | Commit | Revolts (1483, 1487, 1490) |
|---|---|---|
| 0 | 30dfd3c | 66 (27, 24, 15) |
| 89 | 06031ee2 | 52 (21, 14, 17) |
| 134 | 79bfa08b (7.46b1) | 52 (13, 15, 24) |
| 145 | f68f92d8 (7.46c, 7.39b: the chase lands) | 69 (20, 21, 28) |
| 147 | 4d5d2dea (7.43) | 69 (24, 18, 27) |
| 160 | 6c737129 (7.53a) | 69 (24, 18, 27) |
| 178 | 9b365805 (7.55) | 103 (30, 47, 26) |
| 206 | d15131c4 (7.65) | 95 (19, 48, 28) |
| 217 | 90015d7d (7.68) | 111 (39, 33, 39) |
| 219 | 91d596b8 (**7.69**, ADR-621: the landing on a coastal capital) | 165 (49, 60, 56) |
| 221 | 65bd907c (7.70a) | 163 (54, 42, 67) |
| 222 | 7e27d0a4 (7.70b) | 168 (36, 76, 56) |
| 267 | 0dad7d5f (7.90d) | 211 (61, 95, 55) |
| 533 | fc52107e (HEAD) | 174 (72, 45, 57) |

147 and 160 read alike to the revolt: the probe is deterministic where no rule touched the worlds.

The rise has no one commit. The largest step is 7.69 (commit 219, 111 → 165); on three other seeds
(1481, 1482, 1484) 7.68 → 7.69 reads 124 → 155. On HEAD with 7.69's capital target taken out
(`nocap`: the loop over the enemies' capitals in `planLanding` skipped), 174 → 135: 7.69 is about a
quarter of HEAD's rise over the old code (66), and the rest comes in steps over the landing work
7.46c–7.90d (145, 160–178, 217–222, 222–267), every one of them in the amphibious programme
(the chase lands, the transports go to the army, the landing's port, the ferry, supply over the beach).

## 3. Under what HEAD's revolts rise (year-30 saves of 1481 and 1483, a year on)

`revoltWhy.ts` from the year-30 saves: nations founded by revolt in year 31 on HEAD 10 (1481) and about 22
(1483), against 2 and 0 on 30dfd3c. On 1483 most are statelets of 1–16 cells on the Soviet Union's own
core land (`nonCore` false), the Union at 15 % of the land and at war with 6–8, not worn: the only
unrest on such land is the overextension's strain far from the capital.

`capitalFar.ts` on the same saves, each nation over OVEREXT_SHARE of the land:

| Save | Nation | Share | Far core cells | Of them garrisoned | Suppression | Gold | Income | Far core at unrest ≥ 50 |
|---|---|---|---|---|---|---|---|---|
| HEAD 1483 | SOV | 15.0 % | 127,838 | 19 | 0.50 | 2,308 | 1,073 | 1 |
| HEAD 1483 | USA | 9.7 % | 23,436 | 265 | 1.00 | 13,266 | 4,186 | 114 |
| HEAD 1483 | FRA, CHI, AST | 13.8, 7.0, 5.3 % | | | 0.50 | 755–2,832 | 256–4,056 | 0 |
| old 1483 | GER, ITA, ENG, USA | 4.6–11.9 % | | | 1.00 | 4,379–867,899 | 1,309–5,790 | 0 |
| old 1483 | SOV | 9.8 % | 97,544 | 0 | 0.00 | 1,753 | 479 | 1,266 |
| HEAD 1481 | SOV, FRA, ARG | 4.8–9.9 % | | | 0.50 | 453–1,890 | 314–751 | 462 (SOV), 32 (FRA) |
| old 1481 | GER, SOV, ITA, AST, USA | 5.1–14.4 % | | | 1.00 | 1,887–826,192 | 459–5,758 | 0 |

The garrisons do not tell the two apart (the old Soviet far core was as bare). The suppression does:
on 30dfd3c the great powers suppressed at the full level, on treasuries of months to years of income
(the USA 826,000–868,000 gold); on HEAD most suppress at the half level, their treasuries under the
full level's bar (ADR-436: a month of it over RESERVE_MONTHS, 3, of income). The rules since have put
the treasury to work (the warship's saving, the transports, the ferry's want, the reserve cut at war,
the levy), and none of them keeps the full suppression's bar: the rise comes in steps with them.

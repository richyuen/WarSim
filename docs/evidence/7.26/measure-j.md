# PLAN 7.26j: the 7.26 AT of ADR-519 on 10 seeds × 30 years (2026-10-18)

Code: `1f6aa2d` (after 7.26h1, ADR-517; 7.26h2, ADR-518; 7.26i, ADR-520, which built no rule).
Seeds 1–10, as 7.26d, e and g; the before is 7.26g's run on `6d1f727` (`.cache/726g/`), the
after `.cache/726j/`. Measured by `tools/diag/airWar.ts <seed> 30`, ten side by side, nothing else
running (about 17 minutes), judged by `tools/diag/airAt.ts` as changed by `e53cb1b` (ADR-519's AT).
One run a seed: 7.26h1 and h2 moved every hash from year 1, so a seed's change is the rules' and the
run's divergence together.

## The verdict: short, and 7.26 closes (ADR-519 §2)

| | 7.26g (before) | 7.26j (now) | bar |
|---|---|---|---|
| (a) share at half or more in every war-year, ADR-519's columns (`enemyNearTasked ÷ enemyNear`) | – (no such columns) | **4 of 10** | 8 of 10 |
| (a) the same, on the old share (`mission ÷ (mission + inRange)`) | 8 of 10 | 6 of 10 | |
| (b) mean sorties aloft 3 or more in every war-year | 5 of 10 | **7 of 10** | 8 of 10 |

Two rulers for (a). ADR-519 read "8 of 10, a hold" on the old share, the only one 7.26g's files
have; it counts in the numerator the missions of bombers and transports whose targets need no enemy
land formation in range, so it reads high. On the same files of today the true share reads 4 of 10
and the old one 6 of 10: two seeds of the drop from ADR-519's figure are the ruler, two (4 and 9:
old share 0.46 and 0.49) are the code or the run. The floor (b) is one ruler on both, and rose.

| seed | (a) lowest share (old) | war-years short of (a) | (b) lowest aloft | war-years under 3 | year 1 | air battles 1–10 → 21–30 |
|---|---|---|---|---|---|---|
| 1 | 0.63 (0.66) | – | 6.4 | – | 52.2 | 4,433 → 358 (0.08) |
| 2 | 0.51 (0.52) | – | 4.0 | – | 47.3 | 4,035 → 324 (0.08) |
| 3 | 0.48 (0.50) | 7 | 6.4 | – | 43.7 | 4,311 → 498 (0.12) |
| 4 | 0.40 (0.46) | 9, 13, 14, 15, 19 | 3.6 | – | 48.7 | 5,328 → 655 (0.12) |
| 5 | 0.51 (0.51) | – | 5.3 | – | 53.7 | 3,632 → 1,285 (0.35) |
| 6 | 0.35 (0.39) | 27, 29 | 0.9 | 19, 29 | 55.8 | 4,392 → 530 (0.12) |
| 7 | 0.69 (0.74) | – | 1.5 | 30 | 42.7 | 4,341 → 730 (0.17) |
| 8 | 0.42 (0.49) | 27 | 3.6 | – | 49.9 | 4,485 → 821 (0.18) |
| 9 | 0.44 (0.49) | 14 | 3.0 | – | 44.8 | 4,060 → 1,031 (0.25) |
| 10 | 0.45 (0.58) | 7, 8 | 0.2 | 13, 22, 23, 25, 26, 27, 29, 30 | 47.6 | 4,454 → 284 (0.06) |

Means of the ten (7.26g → now): year 1 aloft 46.6 → 48.6; years 2–10 14.8 → 14.4; years 21–30
9.5 → 8.5; missions a day, years 2–30, 11.6 → 11.1; land formations in contact, years 2–30, 1.49 →
1.45 a day. Air battles years 1–10 48,259 → 43,471, years 21–30 10,207 → 6,516 (0.21 → 0.15 of the
first decade). Against year 1 (the old AT, reported): 28 or 29 of 29 war-years under half on every
seed, the lowest 0.00–0.15 of year 1.

## What is short, for the critic's next run

**(a) the share, 12 war-years on 6 seeds.** In each, 2–23 wings a day at war have an enemy land
formation in range, and about half of them have no mission (`inRange` 1.4–12.4 a day against
`enemyNearTasked` 0.8–10.7). Seed 4 alone has five such years, with 14–23 wings in range: the most
wings in reach of any short year. Land contact in those years is 0.3–2.9 formations a day. Which
roles stand untasked is not in `airWar.ts`'s rows (no split of the untasked wings in range by
role; `inRange`'s note says strategic bombers and transports, whose targets need no land formation)
and was not measured: ADR-520's first question, open. If they are fighters and tactical bombers with
an enemy formation in range and none in contact, the air AI's tasking (ADR-377: missions over
fights) is the place; if bombers and transports, the share's denominator.

**(b) the floor, 11 war-years on 3 seeds (10, 6, 7).** In each, 18–92 wings at war, and 0.2–2.3 of
them with an enemy land formation in range; land contact 0.0–0.6 a day while 0.6–5.7 wars run.
Seed 10's years 22, 23, 26 and 29: 52–76 of its wings at war have no enemy land formation at all.
What is short there is reach (ADR-520: no patrol over home, it would meet nothing), which is PLAN
7.29's (the late land war's reach), not the air AI's.

**Against the "to read" lines of PLAN 7.26j.**
- 7.26h1 (ADR-517, transports home, sunk on the way): `airWar.ts` does not count landings; not read
  here. The land contact of years 2–30 held (1.49 → 1.45).
- 7.26h2 (ADR-518, the transport's want): likewise not read here; `landWar.ts`'s embarks and
  `noTransport` days are the measure, with 7.29.
- 7.26i (ADR-520, the share dips on HEAD): it does, on 6 of 10 seeds on ADR-519's columns,
  lowest 0.35–0.48. The roles, above.

No rule changed in 7.26j; the pin is unchanged (c3bd280a).

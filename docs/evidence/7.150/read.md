# PLAN 7.150: who is in the quiet late wars, and the levy (2026-10-28)

HEAD `d457d0fe` (the rules of the critic's run-17 `cfedb50a`). Saves: the critic's run-17 year-20 saves
(`critic/c17_seed*_y20.bin`). New tool `tools/diag/phantomWars.ts` (per war: land front, engaged
members, age, score, exhaustion, each side's land formations, cells and manpower; per world the
critic's seven 10-day samples). Raw output in `.cache/7150/` (not committed).

## 1. The quiet wars (61 days from each of 25 saves)

12 of 25 worlds show nobody in contact on more than two of the seven samples while a war has a land
front (7019: 0, 0, 0, 0, 2, 2, 0). The wars are young (most under 600 days; the stalemate peace is
not what holds them: their scores are 40–89 one way), and the defending side has almost no army:

| seed | war | front (cells) | engaged a day | land formations (attacker, defender) | defender's cells, manpower |
|---|---|---|---|---|---|
| 1061 | GER–FRA | 2,510 | 0 | 255, 5 | 28,242, 12.4 M |
| 1061 | GER–POR | 225 | 0.87 | 300, 0 | 5,517, 0.7 M |
| 1129 | SOV–RAJ | 1,057 | 0 | 44, 3 | 9,721, 7.8 M |
| 2539 | CHL–FRA | 1,153 | 0 | 86, 13 | 31,271, 5.9 M |
| 7019 | GER–SOV | 12,592 | 1.03 | 251, 9 | 111,951, 10.4 M |
| 7019 | #161–SOV | 988 | 0.39 | 4, 56 | 148,988, 43 M |

(The cells and manpower are the side's members', the formations theirs anywhere.)

Why they have no army (`tools/diag/armyGatesNow.ts`, two month starts of 7019 and 1061 y20): the
Soviet Union of 7019, 9 formations on 113,000 cells, 9.4 M men in its pool, 462 gold a month, its
army's order held by gold (a cadre division is 504); Italy 94 a month, 1.7 M men, no formation;
France 35 a month, 1.7 M men, none. The weak side's land is what the strong side has not taken,
without the industry: its men are there, its money is not.

## 2. The levy, read on the saves (181 days, the second half; 14 saves)

A prototype behind a temporary switch (removed): monthly, an AI nation at war holding a land front
where its side is outnumbered on land (`outnumberedOnLand`, ADR-739) queues cadre divisions from its
manpower and for no gold while its books carry the upkeep.

| arm | engaged a day | worlds with nobody in contact on > 2 of 7 samples |
|---|---|---|
| HEAD | 4.01 | 7 of 14 |
| one a month | 5.88 (1.47 ×) | 3 |
| two a month | 6.76 (1.69 ×) | 2 |
| one a month, trained in 30 days | 6.95 (1.73 ×) | 2 |
| two a month, only while over 1,000 cells a land formation | 5.50 (1.37 ×) | 4 |
| three a month, the same over 500 cells | 6.20 (1.55 ×) | 4 |

The save A/B reads *low* for this rule (levies pile up month after month; the 12-year runs below read
2.06 ×), the opposite of the save A/Bs of ADR-723 and ADR-728.

## 3. From 1938, 12 years (seeds 1294–1300, spent; `tools/diag/contactYears.ts`)

| arm | year 1 engaged a day | years 2–12 | ratio to year 1 | lowest seed's ratio |
|---|---|---|---|---|
| HEAD | 42.88 | 6.90 | 0.161 | 0.119 |
| two a month, queued (the rule) | 47.94 (1.12 ×) | 14.22 (2.06 ×) | 0.297 | 0.226 |
| two a month, over 1,000 cells a formation | 43.78 | 8.77 | 0.200 | 0.153 |
| three a month, over 500 cells | 43.38 | 11.17 | 0.257 | 0.172 |
| one a month, mustered at once | 52.88 | 11.82 | 0.224 | 0.175 |
| two a month, mustered at once | 54.49 | 17.17 | 0.315 | 0.150 |

The rule is the queued two a month: every seed over 0.2, year 1 within the AT's floor. Mustered at
once raises year 1 by a quarter.

Its cost: the levies in training stand in the order slots (`pending`), so a nation outnumbered with
the gold for a paid order buys fewer: paid land orders a year on 1294, 1296, 1298 × 8 years 106 → 79
(a quarter fewer), land formations at year 8 551 → 693. Accepted (ADR-745): the nations it reaches
are those the gold holds; a column to tell a levy from an order would be a new state section
(PLAN 7.152).

## 4. The AT's HEAD arm (seeds 1401–1410, year 1)

28.43, 36.15, 36.66, 34.49, 33.52, 36.56, 37.00, 33.56, 34.18, 29.41: mean 34.00.

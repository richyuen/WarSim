# PLAN 7.49e: the defenders' purse, measured (ADR-592 proposed)

The band: living nations at war whose month's gross income (`monthlyAccounts`, as the economic
AI reads it) is 150–500 on a save. The AT: the band's land formations after 180 days of each of
the 48 saves at least 1.5 × HEAD's same run. The rule measured: at war, while the army (with its
orders in training) is under its peacetime share, an army order keeps WAR_RESERVE_MONTHS of
income back instead of RESERVE_MONTHS (3) (`e/reserve-cut.diff`, at 0; also run at 1). Not landed.

## How

`tools/diag/purse.ts` (per band nation: land formations, aboard counted, on day 0 and the last day;
land orders placed at each month start; months ended in debt; formations disbanded; and per
month start the first gate of an army order: `slots`, `share`, `balance` with research's budget
taken, `gold` with the reserve, `manpower`, `ship(navalFoe)` the warship's saving as
`armyGates.ts`, `peace`; each with whether a land order was placed that month).
`sh docs/evidence/7.49/e/run.sh <label> <days>` (4 shards side by side; `PURSE_WAR_RESERVE=0` for
the rule's reserve in the gate read), `node docs/evidence/7.49/e/sum.mjs <label>`,
`node docs/evidence/7.49/e/purse.mjs <label>`. Labels: `head` (HEAD, 180 days), `r1` (reserve 1,
180 days, before the gate read was added), `r0` (reserve 0, 180 days), `heady` / `r0y` (365 days).
A ceiling run (reserve 0 and every nation MAX_PARALLEL slots, 180 days) is quoted for its
formations only.

## The AT's figure: the band's land formations after 180 days

| saves | band | day 0 | HEAD | reserve 1 | reserve 0 | ceiling | bar (1.5 × HEAD) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| year 10 | 126 | 551 | 564 | 596 | 616 | 632 | 846 |
| year 20 | 124 | 593 | 564 | 590 | 603 | 615 | 846 |

Land orders placed in the 180 days: HEAD 60 / 67, reserve 1 116 / 103, reserve 0 150 / 118,
ceiling 157 / 141. No band nation ended a month in debt or disbanded a formation in any run.
**Missed** by every variant, the ceiling with it: 616 / 603 is 1.09 × / 1.07 × HEAD's.

## Why: what stops the order (band-months, 180 days)

| gate | HEAD y10 | HEAD y20 | reserve 0 y10 | reserve 0 y20 |
| --- | --- | --- | --- | --- |
| gold, no order | 549 | 432 | 284 | 218 |
| slots (an order in training) | 90 | 129 | 210 | 264 |
| warship's saving, no order | 18 | 7 | 70 | 46 |
| at peace (left the war) | 30 | 99 | 31 | 94 |
| balance / share / manpower | 8 | 13 | 11 | 14 |
| none, ordered | 56 | 60 | 131 | 94 |

With no reserve, gold still stops 284 / 218 band-months: the division's 1,001 against an income
of 150–500 a month, most of it spent on upkeep. The slots come next: a nation under 400 a month
trains one order at a time, and an infantry division trains for 90 days, so in 180 days it raises
two at the most: 126 × 2 = 252 against a gap of 282 (846 − 564), before the war's losses (HEAD:
60 orders and 13 formations more at year 10, 67 orders and 29 fewer at year 20). The band's
whole gross income for six months and its gold at the save are 383 / 378 divisions' worth at
1,001, before any upkeep is paid. Third, the warship's saving (ADR-575, at war with a naval enemy
and more than FEW_FORMATIONS formations): 70 / 46 band-months once the reserve no longer stops them.

## A year (365 days)

| | HEAD y10 | reserve 0 y10 | HEAD y20 | reserve 0 y20 |
| --- | --- | --- | --- | --- |
| formations at the end | 575 | 639 | 526 | 599 |
| orders | 119 | 229 | 117 | 197 |
| nations in debt / disbanding | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

The cut doubles the band's orders over a year and leaves 11 % / 14 % more formations, with no debt:
it is safe, and small against the bar.

## Not done

No rule: the pin unchanged. Engaged land formations not read (no rule). The user's: ADR-592.

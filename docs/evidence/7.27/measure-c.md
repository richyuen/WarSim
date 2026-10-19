# PLAN 7.27c — what was measured before the rule

2026-10-19, code of `4117a2d` (pin c3bd280a). Tool: `tools/diag/warLost.ts` (from a checkpoint:
daily, each war of `--a` on `--d`, the defending side's `startMen`, its men by kind as `menOf`
counts them, `lost`, who joined or left the side; monthly, the first gate of the economic AI's army
orders for `--d` and `--watch`, as `tools/diag/armies.ts` reads it). Runs from `.cache/727/s732-y25.bin`:
`.cache/727/lost732.json` (to year 31.6, the Soviet Union alone watched), `lost732w.json` (to year
27, with Germany, the USA and Japan).

## (1) The second war's `lost` (war 389, years 31.03–31.46)

The Soviet side was the Soviet Union alone every day of the war: no nation joined or left it, and
its men at sea, aboard and in fleets and wings were 0 every day. `startMen` was 12,460, one
division. `lost` went 0 → 0.865 on days 153–158 as that division died on land (12,460 → 1,684);
on days 133–135 an earlier one went the same way (`lost` 0.22), and a second division raised by
day 148 put the side above `startMen`, so `lost` read 0 again. In the first war (324) `startMen`
was 12,460 too, and the side's men rose to 27,000 before the last division died on day 215.

So `startMen` read no men that left without being killed: 7.27b's "men the trace's land tally does
not hold" was wrong (its land tally was weekly; the loss fell between two of its rows). `lost`'s
measure is not the cause, and the second choice of `trace-b.md` loses its ground as a fix of a
broken measure. Noted, not changed here: `lost` falls back to 0 while new men stand above the
first day's (one division raised after the first assessment hides a later loss).

## (2) Why the Soviet army is a token one

The first gate of the army orders, monthly from year 25 to 31.5 (79 months): gold 59, an order
12, the slots full 8 (an order already in training); never the army's upkeep cap or the balance.
The army's upkeep stood at 1–30 gold against a cap of 96–336; manpower 5.76–6.02 M unused;
income 341–560; the month's balance (before research) 190–350; gold 860–2,800 against an
infantry division's 1,001 and RESERVE_MONTHS of income.

The gate only says when the next order comes; the rate is the surplus: 190–350 gold a month
against 1,001 a division is three to four divisions a year, whatever the reserve. Beside it, from
the same checkpoint (years 25–27, mean of the months):

| nation | income | balance | army upkeep / cap | gold | land men | formations | gates |
|---|---|---|---|---|---|---|---|
| SOV | 478 | 266 | 7 / 276 | 1,877 | 15,092 | 2 | gold 21, orders 3 |
| GER | 4,126 | 1,755 | 253 / 2,436 | 14,280 | 567,237 | 65 | orders 23, gold 1 |
| JAP | 996 | 426 | 52 / 574 | 3,964 | 118,816 | 10 | orders 10, gold 14 |
| USA | 5,703 | 1,939 | 1,174 / 2,333 | 765,285 | 1,908,254 | 168 | slots 10, cap 8, orders 6 |

A Soviet Union of 15.7 M km² has an income of about an eighth of Germany's (income is the industry
of the cells held, `economy.ts`), and about half of it goes before the army (the balance is 266 of
478 with a land army's upkeep of 7; the rest, fleets' and wings' upkeep, admin, which grows with
the km² held, suppression, is not split here). That is the token army's cause, and it is the economy's, not
the war's end: a part of its own (PLAN 7.27e), measured first (where the Soviet income went from
1938 to year 25; admin's share). It is not what 7.27's AT turns on: a Soviet Union that could
defend itself would hold its place in the top five more firmly.

## (3) The war's end under the rule (ADR-521)

`tools/diag/warTrace.ts` from `s732-y25.bin` with the rule (`.cache/727/trace732c.json`): war 324
runs 256 days (215 before). On day 215 the Soviet Union, its last division gone, is exhausted as
before, and Germany (exhaustion 21, gaining 11,000–20,000 km² a day) refuses. The war ends on day
256 when Germany takes the second Soviet capital, the score goes to 100 and the Soviet Union is
crushed: Germany annexes 4.17 M km² (26.6 % of 15.7 M; 3.38 M and 21.5 % before), under the
puppet share (30 %). Germany's exhaustion at the end: 25.6, under the bar of 40 it would have
reached about day 400.

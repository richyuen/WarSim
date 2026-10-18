# PLAN 7.26h2: the transport group that is never built

2026-10-18. Tool: `tools/diag/transports.ts` (its 7.26h2 columns `slot*`), seeds 2843 and 7919 ×
8 years, side by side; files `.cache/726h2/t_<seed>.json` (on `2894ccd`, the rule before) and
`.cache/726h2/after_<seed>.json` (ADR-518).

On each month's start (the economic AI's day; read at the end of the tick before it), for Germany,
Britain, the Netherlands, the US and Japan in a war in which they hold no land front and with no
transport group of their own: the fleet slot's conditions (`economic.ts` 3b and `pickFleet` as they
were), each that fails and the first in the code's order: a fleet in the yards, the navy's upkeep
at `NAVY_SHARE` (0.12) of income or more, income under `POOR_INCOME`, a land front in any war
(`hasFront`), gold under the price and `RESERVE_MONTHS` (3) of income, no shipyard; when none
fails, whether a transport order followed (`ordered`) or not (`balanceOrMen`).

## The conditions (8 years, months)

| seed | nation | months | first to fail | each that fails |
|---|---|---|---|---|
| 2843 | ENG | 45 | navy's share 37, ship in the yards 8 (cruiser squadron) | navy's share 45, front in any war 45, price 22, yards 8 |
| 2843 | NED | 82 | navy's share 77, yards 5 (destroyer flotilla) | navy's share 80, poor 80, no shipyard 29, front 4, price 2 |
| 7919 | ENG | 19 | navy's share 19 | navy's share 19, price 19, front in any war 17 |
| 7919 | NED | 79 | navy's share 78, `balanceOrMen` 1 | navy's share 78, poor 78, front 4 |

Germany, the US and Japan: no such month (Germany's one group, built in year 1, lives on both
seeds: 7.26h1's way home works there).

- **The conditions stack.** Britain's navy is over its share on every month (0.13 to 0.31 of its
  income), it has a land front in another war on 62 of 64 (`hasFront` is any war's; the landing is
  per war since ADR-511), and its gold is under the price and three months of income on 41 (430 to
  1,100 gold against an income near 1,000). Any one lifted alone orders nothing.
- **The Netherlands is a remnant** from year 2 (seed 7919, day 400: 385 cells, income 9.6, under
  `POOR_INCOME` 20), its navy's upkeep twice its income. A poor nation builds no fleet by design:
  not a cause.

## A/B from saved states

180 days from day 1,095 of seed 2843 and day 1,460 of 7919 (`.cache/726h2/ab.ts` with the switch in
`.cache/726h2/ab.diff`, since removed from the code), transport orders of the world:

| variant | 2843 | 7919 |
|---|---|---|
| as it was | 2 (AEF, LAT) | 3 (RAJ, GRE, AOF) |
| the front per war | the same hash | the same hash |
| per war, outside the navy's share | the same hash | the same hash |
| per war, its own step before research, a month of reserve (as 2b's bomber) | 6: Britain on day 32, France, China, Albania | 6: Egypt, Singapore, Yugoslavia and the three before; not Britain (gold under the price) |

Only the last orders Britain's. Without a want of its own it bought groups for small members with no
landing of theirs in sight, so the rule takes a want-gate: an enemy of the frontless war holds a port,
and a free land formation stands on a land with a port of the nation's own.

## The rule (ADR-518) and after

Step 2c, `wantsTransport`: the variant above with the want-gate; no other fleet while it wants one.

| seed | nation | `noTransport` days before → after | groups built / sunk before → after |
|---|---|---|---|
| 2843 | ENG | 1,383 → 513 | 4 / 4 → 6 / 6 |
| 2843 | JAP | 0 → 160 | 4 / 0 → 6 / 5 |
| 2843 | NED | 2,522 → 2,390 | 0 / 0 → 0 / 0 |
| 7919 | ENG | 551 → 208 | 4 / 4 → 6 / 6 |
| 7919 | NED | 2,375 → 2,244 | 0 / 0 → 0 / 0 |

Transport orders of the whole world in the 8 years (`.cache/726h2/orders.ts`): 20 → 21 (2843),
20 → 15 (7919); formation-days aboard 821 → 719 and 417 → 677. One run each: the runs diverge from
the first month the rule acts, so these are no verdict on the landings; 7.26j measures them on ten
seeds.

Britain's new groups are sunk too (6 of 6 on both seeds), as ADR-517 found of its groups sent home:
the way home weighs no enemy sea. 7.26j reads that first.

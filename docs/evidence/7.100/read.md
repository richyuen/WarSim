# PLAN 7.100's read: where the walk-ins of years 10–30 come from (2026-10-23)

HEAD `0adb46df` (the pin 7c2e4700), seeds 856 and 859 (of 7.82's AT on 851–860: 856 the stasis at
the bar, 859 the lowest battle share, 1.3 %), 30 years from 1938. `tools/diag/walkIns.ts` (new) wraps
`World.setController` on the instance and classes each walk-in (`FlipCause.walkIn`: a flip with no
formation of the holder's side pressing on the cell) at the end of its hour; its per-year counts are
7.82's `churnAt.ts` counts to the cell (856 year 1: walk-in 27,332, battle 6,706). Output `856.json`,
`859.json` (years 10–30), `x856.json`, `x859.json` (years 10–12 from the year-10 checkpoints, with
the cross-tables below).

## 1. Who is walked on, and where (years 10–30)

| | 856 | 859 |
|---|---|---|
| walk-ins | 910,178 | 930,298 |
| loser of the scenario (not a revolt's or a revival's) | 92.0 % | 93.0 % |
| of them puppets | 20.5 % | 11.7 % |
| loser holding 10k cells or more | 68.8 % | 69.9 % |
| the cell the loser's own land | 92.4 % | 93.2 % |
| the cell the taker's own, taken back | 7.3 % | 6.7 % |
| the cell's last change a revolt (any time before) | 39.4 % | 37.6 % |
| — of it within 30 days | 2.2 % | 1.0 % |
| the cell's last change a peace | 5.4 % | 9.3 % |
| the cell unchanged since 1938 | 26.0 % | 22.7 % |

Not statelets and not the revolts' fresh land: the land of big scenario nations, their own. Two of
five cells had a revolt in their history, nearly all more than a month before.

The pairs: 856 the USA on the Soviet Union 19.9 %, on Canada 14.2 %, on France 9.4 %; 859 Germany on
the Soviet Union 14.4 %, Japan on the Soviet Union 5.4 %, the USA on Canada 3.9 %.

## 2. Why no front holds them

The defence: the land formations of the loser's side (its bloc, or on its side in a war), aboard ones
left out.

| | 856 | 859 |
|---|---|---|
| no land formation on its side | 2.1 % | 2.4 % |
| none on the cell's landmass | 4.5 % | 11.7 % |
| the nearest 40 cells off or more | 66.4 % | 61.3 % |
| the nearest 15–40 | 13.4 % | 11.9 % |
| the nearest within 15 | 13.6 % | 12.8 % |

The nearest, when on the landmass, is on the march (to its own side's cell 31 %, on an enemy cell
22–27 %) or standing (16–18 %); engaged 3–4 %.

The loser's own land formations at the walk-in, years 10–12 from the year-10 checkpoints:

| loser's land formations | 856 | 859 |
|---|---|---|
| 0–4 | 65.2 % | 69.4 % |
| 5–19 | 24.4 % | 23.3 % |
| 20 or more | 10.4 % | 7.3 % |

and 96–97 % of walk-ins are on a loser at war with 4 nations or more. A thin army cannot be fronted by
moving it: the walked-on have nearly none. A redeployment rule would reach the 7–10 % with 20+.

## 3. Why they have no army: the price of a division

`tools/diag/armyGates.ts` on the year-10 checkpoints (both seeds, 112 nations at war): of the 101
with 0–4 land formations, **91 were stopped by gold**: at war with its army under its peacetime share
the reserve is none (ADR-615), so the gate is the price, 1,001 gold for the infantry division. Their
treasuries: France 880 (income 288, army upkeep 15 % of it), Canada 472 (189, 15 %), Australia 962
(268, 10 %), Brazil 654 (79), Britain 1,031 (303, 0 %). The upkeep has room (ARMY_SHARE_WAR); the
price does not, and the at-war refills spend each month's surplus (ADR-514), so gold never climbs to
it. An order the treasury cannot pay for falls to the infantry division (PLAN 1.42c) and no further:
the cadre division (504 gold, half the men) is the poor nations' alone (income under POOR_INCOME, 20).
Their manpower is large: France 1.27 M, Canada 411 k, China 9.3 M.

## 4. The rule

At war, an order the treasury cannot pay for falls to the cadre division where the treasury can pay for
that (`ai/economic.ts`, `armyOrders`). In peace nothing changes: the treasury saves for the division it
wants.

A/B from the year-10 checkpoints, years 10–12 (`x*.json` HEAD, `r*.json` the rule):

| | 856 HEAD | 856 rule | 859 HEAD | 859 rule |
|---|---|---|---|---|
| front battles | 2,865 | 3,727 | 1,453 | 2,914 |
| walk-ins | 96,051 | 106,737 | 176,784 | 129,729 |
| battle share of battle, walk-in, revolt and peace changes | 2.1 % | 2.4 % | 0.5 % | 1.2 % |

The AT is in `at.md`.

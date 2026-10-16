# PLAN 7.3e3: the treasury's reserve and the pool (probe, 2026-10-16)

Probes in `.cache/73e3/`: `months.ts` (a nation's books at each month start for a seed's first
years: gold, the reserve of RESERVE_MONTHS of income, balance less need, suppression, research,
pool, and its formations spawned), `disband.ts` and `bind.ts` (7.3e1's, `.cache/73e1/`: the
Soviet Union's formations by year, and its books at the month after year 9), `sov.ts` (the great
powers' books in a checkpoint).

HEAD `48eab14` (after ADR-436) was measured first.

## Seed 1: the Soviet Union raises nothing

`months-head-1.log`, every third month. Years 1–2 the army is over its cap and the treasury runs
down from 6,211 to 120; from month 30 the balance is over the need and the gold climbs to the
reserve by month 47. Then:

```
m57 gold 3162 reserve 2684 income 895 bal-need 414 supp 1 research 44
m69 gold 3134 reserve 2685 income 895 bal-need 386 supp 1 research 44
m81 gold 2907 reserve 2606 income 869 bal-need 244 supp 1 research 43
m117 gold 1758 reserve 1571 income 524 bal-need 141 supp 1 research 26
```

The gold stands 200 to 500 over the reserve while the month's surplus is 140 to 410: the refills
take what is over the reserve each month, and an order wants the reserve and its price (infantry
1,001): 2,685 + 1,001 = 3,686 against the most it held, 3,162. **Soviet formations spawned in
years 1–10: 0** (7.3e1's log before ADR-436: 8; before refills: 30).

## Seed 7321: the pool

| | SOV pool, end of year 10 | SOV gold, income | SOV builds by year 10 |
|---|---|---|---|
| HEAD `48eab14` | 12.09 M | 5,425, 1,668 a month | 7 |
| keep the order's price (ADR-437) | 12.40 M | 2,764, 834 a month | 22 |

The month after year 9 on HEAD (`head-bind-y9.log`): income 1,678, balance less need 596, army
upkeep 149 of a cap of 1,007, 5,614 gold with 580 over the reserve, 32 formations that may be
refilled 249k men short. The pool is not a measure of the reserve. At the infantry division's
0.080 gold a man, 7 M men (12.09 M to under 5 M) are 560,000 gold: 28 years of the Soviet
Union's whole income of year 10, and the reserve is a stock of three months (5,034). The pool
stands over its cap (3% of the population) from the men that disbanded formations give back
(DISBAND_MANPOWER), and the cap stops growth, it does not shrink a pool: men are cheap and gold
binds, as in AoC, where gold buys the soldiers.

## The rule (ADR-437)

With no army order in training and room for one (a slot, the army's upkeep under its cap), the
refills keep the price of the next order over the reserve: the infantry division's, a poor
nation's cadre one, or the cadre one without the infantry's techs.

| | Seed 1 × 10 y: SOV spawned | Seed 1: SOV months suppressing | Seed 1: months under 3.15 × income |
|---|---|---|---|
| HEAD | 0 | 68 of 119 | 38 |
| ADR-437 | 21 | 94 of 119 | 21 |

(`months-head-1.log`, `months-a-1.log`.) A new division and a refill cost the same gold a man:
the rule does not spend more, it lets the treasury reach an order once in a while, and the
refills take the rest while that order trains (90 days).

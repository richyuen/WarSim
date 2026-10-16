# PLAN 7.3e2: suppression paid from the treasury (probe, 2026-10-16)

Probes in `.cache/73e2/`: `probe.ts` and `who.ts` (by year: land given back by revolt, `LandCeded`
of every source as `.cache/73e/ceded.ts`; states founded on their holder's own core land,
`RevoltSpawned` whose new nation's `people` is the holder, 7.3d3's "holder core"; and who ceded
it, by the holder's suppression), `born.ts` (each holder-core birth with the holder's level, gold
in months of income and whether a war wore it, `wornNations` at 60), `check.ts` (the rule at each
month: a restless nation whose treasury before the AI met the full bar and was not at full).

HEAD `66ab9a5` (after ADR-435) was measured first. The AT's 396 and 582 of land given back on
seeds 1 and 3 are of `76f8662`, before 7.3e1 (`ceded-7.3e.md`).

## Land given back by revolt, and states founded on the holder's core

| | Rule | Seed 1 × 10 y | Seed 3 × 10 y | Seed 5 × 30 y | Seed 6 × 30 y |
|---|---|---|---|---|---|
| `76f8662` | (before 7.3e1) | ceded 396 | ceded 582 | | births 85 and 30 of 7.3d3 are before ADR-433 |
| HEAD `66ab9a5` | half level (0.5) from a surplus over 15% of income | ceded 635, births 9 | ceded 317, births 4 | ceded 691, births 8 | ceded 1,154, births 45 |
| A (rejected) | half level from a treasury over its reserve, or from the surplus | ceded 457, births 14 | ceded 339, births 10 | | |
| B (kept) | full level (1) from a treasury over its reserve; else half from the surplus | ceded 62, births 3 | ceded 196, births 0 | ceded 286, births 12 | ceded 313, births 10 |

On HEAD, four fifths of the land given back was ceded by holders that suppressed, at the half
level: seed 1 517 of 635, seed 3 274 of 317 (`who-1.log`, `who-3.log`). A treasury paying for
the same half level (A) gave back about as much; the full level (B) a tenth on seed 1 and two
thirds on seed 3.

## Seed 5: the births not met

B's 12 births on seed 5 against HEAD's 8 (`born-5.log`):

```
y9.42 SOV: suppression 1, gold 3.2 months of income, worn false
y12.92 FRA: suppression 1, gold 3.4 months of income, worn false   (× 2)
y15.26 SOV: suppression 0, gold 3.1 months of income, worn false
y23.26 LAT: suppression 0.5, gold 3.8 months of income, worn false
y30.52–30.85 ENG: suppression 0, gold 3.1–3.2 months of income, worn false   (× 7)
```

Seven are the United Kingdom's in year 30, with suppression 0: its treasury held 3.1 to 3.2
months of income, under the bar of 3.15 (the reserve of 3 and a month of the full level, 0.15),
and its balance had no 15% of surplus for the half. A treasury a hair over the reserve is where
the refills of 7.3e1 (ADR-435) and the orders leave it, as 7.3e3 found on seed 1 (not traced
month by month for the United Kingdom here); what the month's balance adds then is under the
price of a month of suppression. Whether a restless nation's refills keep a month of
suppression over the reserve is for 7.3e3 to decide. On HEAD the same seed's 8 were EGY 3, IRQ 2,
ITA, ENG, SOV, of which 7 in year 5.

## The rule as built

`check.ts` on seed 6, the restless set and the treasury taken just before the AI's tick: 2,173
nation-months in years 1–15 over the full bar, every one at full. (Taken after the tick, 618 of
2,225 in years 1–15 were not: provinces that crossed unrest 40 in the revolts' system of the same
tick, after the AI; the AI meets them a month later, as before the change.)

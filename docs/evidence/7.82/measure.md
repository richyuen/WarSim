# PLAN 7.82a: stasis and the land's changes by cause, on HEAD (2026-10-23)

Run: `npx tsx tools/diag/churnAt.ts <seed> 30 <out>` on unseen seeds 831–840 (none read by a task
before), HEAD `147fa7a1` plus the cause tally (`World.flipsBy`, derived, not state: the pin unchanged),
5 at a time, about an hour. Raw output in `.cache/churn82/` (not committed).

## Definitions

- **Stasis**, the critic's (`critic/scripts/c12_headless.ts`, `c12_summ.py`): at each year's end the five
  nations holding the most cells by controller (any cell with a controller), as a set; the longest run
  of years with the same set.
- **Changes by cause**: every change of a cell's controller through `World.setController`, by its call
  site (`FlipCause`). A front cell taken by territory pressure is a **battle** when the defence in its
  last hour was over the garrison (a formation of the defender's side pressed the cell), else a
  **walk-in**. Peace (`war.ts`), revolt (`revolts.ts`), revival, capital (capture and moves,
  `capitals.ts`), puppet, landing (`amphibious.ts`, `airLift.ts`). A cell that flips twice counts twice.

## Stasis

| Seed | Longest | Years | The five (cells min–max over the span; days at war a year; land formations engaged, daily mean) |
|---|---|---|---|
| 831 | 6 | 3–8 | SOV 180–192k 364 0.74; DEN 34k 242 0.03; CAN 43–56k 55 0; USA 69–85k 146 0.04; BRA 26–28k 134 0.03 |
| 832 | 12 | 19–30 | SOV 85–147k 363 0.09; ENG 38–86k 359 0.53; JAP 36–55k 294 0.17; CAN 39–62k 105 0; USA 69–95k 105 0.07 |
| 833 | 6 | 1–6 | SOV 174–185k 299 0.92; DEN 34k 154 0.01; AST 25k 102 0; CAN 78k 102 0.01; USA 46k 0 0 |
| **834** | **17** | **6–22** | SOV 93–202k 358 0.24; DEN 32–34k 269 0; JAP 26–75k 341 0.33; CAN 40–73k 332 0.02; USA 81–169k 303 1.35 |
| **835** | **18** | **12–29** | GER 44–64k 353 0.67; SOV 168–187k 348 0.24; DEN 25–26k 297 0.01; CAN 45–52k 44 0; USA 77k 5 0 |
| 836 | 10 | 14–23 | SOV 36–71k 319 0.06; ENG 47–67k 330 0.08; NED 39–86k 206 0.11; CAN 41–60k 16 0; USA 70–89k 16 0.01 |
| 837 | 11 | 8–18 | SOV 150–174k 363 0.5; FRA 41–59k 291 1.03; DEN 29–34k 187 0.01; CAN 62–69k 314 0.02; USA 58–95k 311 0.86 |
| 838 | 9 | 22–30 | GER 42–73k 358 1.66; SOV 59–115k 365 0.05; JAP 47–85k 365 0.12; CAN 72–74k 308 0.02; USA 65–76k 277 1.39 |
| 839 | 9 | 22–30 | GER 34–57k 365 0.69; SOV 63–102k 365 0.09; JAP 44–88k 365 0.13; CAN 75–82k 332 0.02; USA 90–107k 304 0.33 |
| 840 | 9 | 8–16 | SOV 153–194k 365 0.5; FRA 35–40k 304 0.05; DEN 33k 142 0.05; CAN 59–69k 188 0; USA 68–85k 188 0.17 |

Over 15 years: 2 of 10 (834, 835; the critic's 24 seeds of run 12: 7 over 15, longest 21). Canada and the
United States are in every seed's five; Denmark (Greenland) in 6.

**The cause the two long spans name:** the fifth place is held by land no front reaches. In 835 the
United States hold 77,534 cells for 18 years (77,380 for the first two), Canada 44,798 for 12, Denmark
25,496–25,928, and the sixth, Australia, 22,509–25,101: the set holds because four of the six largest
do not move, at war or not (Denmark 297 days at war a year, 0.01 formations engaged). The movers (SOV,
GER, JAP) change places within the first four. In 834 the fifth is Denmark at 31,811–33,517 for 17
years (at war 269 days a year, nothing engaged), the sixth Australia at 25–31k; Japan, the fourth or
fifth, swings 26–75k but never below Denmark's line long enough to leave.

## Changes by cause, years 10–30

Pooled over the 10 seeds, 13,293,818 changes:

| Cause | Share |
|---|---|
| Walk-in | 57.25 % |
| Revolt | 29.55 % |
| Peace | 10.44 % |
| **Battle** | **1.96 %** |
| Capital | 0.66 % |
| Puppet | 0.12 % |
| Landing | 0.02 % |
| Revival, other | 0.00 % |

Per seed the battle share is 1.3–2.5 % (831 2.1, 832 2.2, 833 2.1, 834 1.4, 835 2.2, 836 1.3, 837 2.5,
838 2.5, 839 1.6, 840 2.0). Year 1 of 831 for comparison: 13.6 % battle, 81.7 % walk-in (47,637
changes). Net cells changed a year (the critic's `flipped`) 35,648–69,183 by seed.

## What it names

1. **The stasis is the untouched overseas holders** (Canada, the United States, Denmark's Greenland,
   Australia): their land is not reached by any enemy front, and the landings that would reach it are
   0.02 % of the changes. This is PLAN 7.82b.
2. **The front battle is 2 % of the churn**: HEAD's bar for 7.82's second figure (at least 1.96 %
   pooled). The walk-ins (57 %) and revolts (30 %) are what the critic called statelets and walk-ins; a
   rule there is not needed for 7.82's AT, which asks only that the share not fall.

# PLAN 7.27e — the Soviet Union's token army: where its income went

2026-10-19, code of `a5732f3` (pin 94235073). Tool: `tools/diag/economySplit.ts` (from a checkpoint
or the 1938 start: each watched nation's month split term by term as `economyBreakdown` and
`budgetOf` take it, research, what is left; a daily ledger of what the accounts do not name,
orders by domain, refills, the warhead programme; and, against a fresh 1938 world of the seed, the
nation's 1938 industry by who holds it now and its cities by size). Runs: `.cache/727/econ732.json`,
`econ735.json`, `econ740.json` (six months from each 7.27a checkpoint), `econ732-1938.json` (the
start), `econ732-ledger.json` (seed 732 from 1938, ten years, monthly with the ledger).

## The split at the stasis checkpoints (first month after each load)

Gold a month. The checkpoints were written by the code before ADR-521 (pin c3bd280a); six months on
from them under this code is the same state as far as the economy reads it.

| | 732 y25 SOV | 735 y26 SOV | 740 y18 SOV | 732 y25 GER | 732 y25 JAP |
|---|---|---|---|---|---|
| at war | yes | no (yes from 26.27) | yes | yes | yes |
| own land | 552 | 670 | 809 | 3,868 | 940 |
| blockade, convoys, bombs, fallout | 0, 0, 0, 11 | 0 | 0, 5, 5, 0 | 12, 1, 6, 1 | 0, 0, 1, 0 |
| gross | 552 | 670 | 809 | 4,307 | 987 |
| army / navy / air upkeep | 2 / 16 / 1 | 40 / 21 / 4 | 8 / 74 / 7 | 269 / 13 / 3 | 30 / 145 / 17 |
| admin (cap not reached) | 80 | 69 | 122 | 55 | 7 |
| warheads | 0 | 0 | 80 | 450 | 0 |
| CE cost (war) | 110 (20 %) | 0 (137 at war) | 147 (18 %) | 1,100 (26 %) | 262 (27 %) |
| suppression | 83 (15 %, full) | 0 | 0 (121 from 18.1) | 646 (15 %) | 148 (15 %) |
| tribute | 0 | 0 | 0 | 0 | 0 |
| research | 28 | 34 | 40 | 122 | 49 |
| left for the army | 232 | 503 | 331 | 1,649 | 329 |

Nothing is singular to the Soviet Union. At war every nation pays CE cost (20 % of income at
efficiency 1, more when winning), full suppression (15 %) while a province of its is restless and
its treasury allows it, research (5 %). The admin of 15.7 M km² (80, 14 %) is the one term that
weighs more on it than on Germany (55 on 11.9 M km²; it grows superlinearly with land, ADR-57), and
it is under its cap (276). Fallout and bombs take 0–2 %. Of the month's income, the Soviet Union
keeps 42–75 % for the army, as Germany 38 % and Japan 33 %.

## Where its 1938 industry went

The Soviet Union of 1938 has 1,156 gold a month of industry on 21.2 M km² (Germany 1,980 on
0.47 M km² at the start, 2,213 on 0.64 M once Austria is in; industry is the cities', `cellWeight`: CITY_WEIGHT over LAND_WEIGHT). At the
checkpoints:

| | 732 y25 | 735 y26 | 740 y18 |
|---|---|---|---|
| km² held (of its 1938 land) | 15.7 M (15.3 M) | 13.8 M (13.7 M) | 20.8 M (18.4 M) |
| its 1938 industry it still holds | 542 (47 %) | 673 (58 %) | 704 (61 %) |
| its 1938 industry, by holder | POL 454, GER 73, JAP 65 | GER 352, JAP 72, IRN 56 | POL 228, ROM 221 |
| cities of size 1–5, now (1938) | 198 143 48 34 1 (357 241 78 39 3) | 184 139 42 19 2 | 266 203 71 41 3 |

The land it keeps is three quarters of its land; the industry it keeps is half, because what it
lost is the west, where the cities are (Ukraine, Belarus, the Baltic and Moscow's or Leningrad's
size-5 city). Germany on the same seed holds 3,865 of industry of its own, from 173 228 132 64 19
cities (19 22 10 6 1 in 1938). The income gap of 8 to 1 is the 1938 gap of 1.7 to 1 times the
cities taken from one and given to the other.

## How the army went (seed 732 from 1938, this code)

Monthly, with the ledger. `left` is the month's income after every charge of the accounts and
research; `resid` is the treasury's change less `left`; `unexpl` is `resid` with the ledger's
orders, refills and warheads added back.

| year | gross | left | treasury Δ | orders (land / air) | refills | unexpl | land men |
|---|---|---|---|---|---|---|---|
| 0.08 | 1,156 | −232 | −186 | 0 | 0 | 46 | 1,515,680 |
| 0.58 | 1,182 | −547 | −428 | 0 | 0 | 119 | 1,514,690 |
| 1.08 | 1,206 | 53 | 70 | 0 | 0 | 17 | 1,053,324 |
| 1.58 | 3,614 | 1,826 | 1,706 | 0 | 0 | −120 | 610,972 |
| 2.58 | 3,501 | 1,491 | −346 | 1,001 | 920 | 84 | 700,587 |
| 3.58 | 2,805 | 1,020 | −2,219 | 3,003 | 424 | 188 | 910,993 |
| 4.58 | 1,274 | 449 | −68 | 0 | 536 | 19 | 264,318 |
| 5.84 | 1,229 | 518 | −462 | 1,001 | 122 | 143 | 161,905 |
| 6.33 | 1,198 | 452 | −700 | 1,001 / 252 | 0 | 100 | 190,237 |
| 7.59 | 1,123 | 520 | −39 | 0 | 615 | 56 | 39,020 |
| 8.09 | 1,062 | 566 | −326 | 1,001 | 0 | 109 | 15,307 |
| 9.09 | 604 | 296 | −629 | 1,001 | 0 | 76 | 12,460 |

Years 0–10 summed: `left` 75,004; orders 55,055 (55 infantry divisions) and 756 (air); refills
34,263; the treasury −4,082; unexplained 10,988 (92 a month, the treasury gaining more than
`left` says; not split here). Germany: `left` 49,158, orders 43,883, refills 15,229, unexplained 1,154.

1. **The 1938 army costs 94 % of the income.** The scenario's 1.52 M men cost 1,085 a month on an
   income of 1,156 (Germany's 14 %, Japan's 24 %, the USA's 1 %): the balance is −232 before any
   war and −500 at war (CE cost 300). It runs the deficit on its 6,700 gold (step 1's runway), as
   designed for the start (PLAN 2.13).
2. **It was lost in wars, not disbanded and not starved.** Years 1 and 3–5: 1.52 M → 0.61 M and
   0.94 M → 0.11 M men, formations 162 → 133 and 143 → 16, while the treasury held 2,800–12,500.
   In years 1.3–3.6 a conquest raised its income to 3,600 (own land, annexed), and it rebuilt
   to 0.94 M; the land and its cities went back by year 4 (3,427 → 1,377 gross on 23.3 → 22.7 M
   km²: cities, not land).
3. **From year 5 it spends everything on the army, and loses it as fast.** Years 5–7: 100,000–
   230,000 men, a division bought every two or three months and refills of 500–760 a month.
   Years 7.8–9.3: a division (1,001) bought almost every month, 11 in 18 months, while its land
   men stand at one division (0–21,000): each new division is lost within weeks. The "gold" gate
   of 7.27c's measure is the saving between two orders.

The rate of the rebuild is bounded by the price, not by the upkeep cap: an infantry division costs
1,001, two hundred months of its upkeep (5), and at war the army's upkeep cap (60 % of income) is
331 against an upkeep of 2–30. A surplus of 230–560 buys one division every two to four months.

## Decision: no rule

The token army is not the economy's. The Soviet Union's income is small because its industry was
small for its land in 1938 and halved when its western cities were taken; what is taken before
the army is what every nation at war pays, at the same shares; and what is left goes to the army,
all of it. Its army is a token because the divisions it raises die as fast as it raises them. A
rule that made the Soviet Union richer, or its divisions cheaper, would give it a stronger army,
and 7.27c's measure already noted that a Soviet Union able to defend itself holds its place in the
top five more firmly: against 7.27's AT. No ADR, no pin change.

Left as observations, none Soviet-specific, none taken up here:

- **A division bought a month and lost within weeks** (years 7.8–9.3): where a lone new
  division goes, and whether it should stand back until there are enough to hold, is the land
  war's (`ai/operational.ts`), PLAN 7.29's ground if its measure or the critic finds the late land
  war short.
- **The scenario's Soviet army of 1938 costs 94 % of its income**; the only great power to start
  in deficit. Start data; it moves every seed's early years.
- **Full suppression and the next order want the same reserve.** `suppressionLevel` pays 15 % of
  income from a treasury of 3.15 months of income; the build gate opens at 1,001 + 3 months. Seed
  732 y25: 1,739 against 2,657, a band in which the nation pays the 15 % while it saves for a
  division (ADR-436's design).

## The run is not the sweep's run

Seed 732 from 1938 on this code (pin 94235073, ADR-521's rule) is not the run that wrote
`s732-y25.bin` (pin c3bd280a): the rule changed its first war it touched. By year 10 the Soviet
Union holds 15.1 M km² here (its 1938 industry held by FRA, RAJ, JAP, SYR besides itself), and
3.7 M km² by year 25 (`econ732-run.json`, the same run carried on without the ledger; its months
to year 10 are identical to the ledger run's). Whether 732's long span recurs on
this code is 7.27d's sweep to say, not this run. The economic mechanism above is the same on both.

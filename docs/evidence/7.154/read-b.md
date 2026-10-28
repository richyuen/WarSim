# PLAN 7.154b read: where the fleets at war that meet no enemy are (2026-10-28)

HEAD `87c93a6b` against critic run 16's `7b883084` (the critic's "before"), the same six spent seeds 1411–1416 × 20
years, `tools/diag/seaWars.ts` in each tree (the tool is the same in both). Counts are week-samples (a fleet-week, a
war-week), summed over the six seeds. The AT's seeds 1431–1440 are unspent.

## The sea battles

| | `7b883084` | HEAD | HEAD / before |
|---|---:|---:|---:|
| sea battles, year 1 | 229 | 153 | 0.67 |
| sea battles, years 2–20 | 986 | 870 | 0.88 |
| ships sunk in them, years 2–20 | 10,176 | 10,125 | 0.99 |
| war-weeks with a navy on both sides, year 1 | 265 | 235 | 0.89 |
| war-weeks with a navy on both sides, years 2–20 | 1,290 | 992 | 0.77 |
| battles per such war-week, years 2–20 | 0.76 | 0.88 | 1.15 |
| battles per such war-week, year 1 | 0.86 | 0.65 | 0.75 |

Even HEAD back at `7b883084`'s figures would be 1.13 × HEAD's late battles on these seeds; the AT asks 1.25 ×.

## Where the armed fleets at war stand (years 2–20, HEAD)

Of 120,700 armed fleet-weeks at war, 108,600 (90 %) are of nations at war with no enemy navy (`vsNone`), 80,821 of
them on station by an enemy port (the blockade). A battle needs two navies at war: 992 of 44,380 war-weeks have one
on each side. Of the 12,100 fleet-weeks at war with a navy: under way 3,479, on station 4,218, sailing to a target it
can win (`take`) 1,215, hunting or chasing 2,020, in a battle 163.

Of those on station at war with a navy, why the nearest enemy fleet is not hunted (`preyWhy`):

| | `7b883084` | HEAD |
|---|---:|---:|
| in other waters (another basin, or behind a passage shut to it) | 148 | 1,988 |
| beyond `SORTIE_KM` | 1,687 | 1,591 |
| … of those, a bloc port in reach of it (`farBase` `base`) | 700 | 403 |
| … its zone over the navy (`strong`) | 460 | 960 |
| under way | 302 | 186 |
| over the hunters (`strong`) | 177 | 294 |
| huntable | 157 | 159 |

"Other waters" is three worlds' history (1416 1,110, 1411 633, 1413 217; the rest under 20). None of the buckets
that grew is a fleet that could sail to a battle it can win and does not.

## The year-1 fall by commit

`npx tsx tools/headless/cli.ts --scenario 1938 --seed <s> --years 1` at each commit that changed `src/sim`, `SeaBattle`
events in year 1:

| commit | 1411 | 1412 | 1413 | 1414 | 1415 | 1416 | sum |
|---|---:|---:|---:|---:|---:|---:|---:|
| `7b883084` | 56 | 24 | 18 | 69 | 50 | 12 | 229 |
| `441d3465` 7.141 part 1 | 56 | 24 | 18 | 69 | 50 | 12 | 229 |
| `d4169744` 7.142 the war's reserve (ADR-736) | 42 | 15 | 15 | 65 | 47 | 13 | 197 |
| `52f71a5a` 7.144 strike falloff (ADR-737) | 44 | 22 | 50 | 14 | 40 | 16 | 186 |
| `60e008c6` 7.145 carriers ashore (ADR-738, ADR-742) | 29 | 50 | 46 | 14 | 36 | 26 | 201 |
| `e5e3d85a` 7.146a no warship for the outnumbered (ADR-739) | 43 | 30 | 45 | 11 | 36 | 15 | 180 |
| `87fee701` 7.146b | 43 | 25 | 46 | 11 | 44 | 12 | 181 |
| `02d1b1cd` 7.150 the levy (ADR-745) | 35 | 22 | 46 | 10 | 30 | 12 | 155 |
| `d47aa187` 7.151 decks re-manned (ADR-746) | 35 | 20 | 46 | 10 | 30 | 12 | 153 |

The fall comes in steps at four rules the user kept (ADR-736, 737, 739, 745), each 5–14 % on six seeds, and one
world's history (1414: a war of two navies in its first year at `7b883084`, 43 war-weeks, against 13 after
`52f71a5a`). No step is a fleet that stops meeting the enemy; per war-week of two navies HEAD fights more late.

## Beside it: the transports' refused sailings

Fleet orders `orderSail` refused for no sea way: years 2–20 10,202 → 30,082 (higher on 5 of 6), year 1 49 → 708.
`tools/diag/noSeaWay.ts` (new) on 1415 year 1 at HEAD: all 384 are transport groups, all from the invasion AI's
`sailToArmy` (176 by `sailToMost`, 208 by `ferryGroup`), 352 of them Canada's, two fleets, 19 fleet-days asked more
than once. A ferry defect, not a sea-battle lever: filed as PLAN 7.155.

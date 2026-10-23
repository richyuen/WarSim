# PLAN 7.84c: where the late sea battles fell (read only)

Critic run 12: late sea battles 13.29 → 9.30 a world-year (24 seeds, years 2–30, `dd3b730` against
`896ff779`), wars of two navies at years 10 and 20 1.14 → 0.29 (`critic/c12_fleets.json`). The question
was whether the fall is in wars between two navies (the land war's, 7.79) or in battles per naval war (a
naval rule).

## Runs

- `npx tsx tools/diag/seaYears.ts <seed> 20 docs/evidence/7.84/c/<ver>_<seed>.json` on 10 of the critic's
  seeds (1307, 2081, 2953, 3613, 4219, 4877, 5309, 5861, 6421, 7019), `head` = `2934cb33`, `old` =
  `dd3b730` (a worktree), 7 at a time. Daily at 01:00: armed fleets (`fleetPower` > 0), navies (nations
  with one), pairs at war, pairs at war with an armed fleet each in one basin (`seaPairs`), and their
  fleets under way; every `SeaBattle` row.
- `summary.py` (in `c/`) makes the table below; `critic_by_year.py` reads the critic's own per-year
  `sea.n` (`critic/c11_headless_*.json`, `c12_headless_*.json`).

## The critic's data by year (24 seeds)

Year 1 the same (51.8 / 51.4) and year 2 the same (21.0 / 22.5); from year 3 a step down that holds:
years 3–20 about 13–15 on `dd3b730` against 7.5–9.5 on `896ff779`, while wars running rose (5.0 → 8.2
at year 10). Years 2–20 13.89 → 9.20.

## The read (10 seeds, means a world-year; old | head)

| | year 1 | years 2–20 | years 10–20 |
|---|---|---|---|
| sea battles | 54.6 / 60.9 | **13.43 / 9.68** | 12.77 / 9.64 |
| pairs at war | 197 / 205 | 234 / 327 | 215 / 340 |
| pairs at war sharing a basin with an armed fleet each (a day) | 3.39 / 3.19 | **1.48 / 0.53** | 1.60 / 0.57 |
| battles per such pair-year | 16.1 / 19.1 | **9.1 / 18.4** | 8.0 / 17.0 |
| armed fleets | 75 / 83 | **65 / 49** | 74 / 51 |
| navies | 14.3 / 14.3 | **18.4 / 12.8** | 19.4 / 12.4 |
| fleet power | 229k / 248k | 171k / 144k | 194k / 155k |
| share of the paired fleets under way | 0.48 / 0.51 | 0.47 / 0.49 | 0.47 / 0.48 |
| share of battles sinking a ship | 0.98 / 0.98 | 0.993 / 0.954 | 0.994 / 0.947 |

Armed fleets / navies by year:

| year | 1 | 2 | 3 | 5 | 8 | 10 | 15 | 20 |
|---|---|---|---|---|---|---|---|---|
| `dd3b730` | 75 / 14.3 | 43 / 10.4 | 44 / 13.2 | 52 / 18.0 | 60 / 19.1 | 66 / 20.0 | 73 / 17.8 | 81 / 21.6 |
| HEAD | 83 / 14.3 | 46 / 9.2 | 42 / 9.7 | 45 / 14.3 | 48 / 15.2 | 52 / 15.1 | 52 / 11.8 | 49 / 11.8 |

Per seed (years 2–20, battles a year): HEAD lower on 8 of 10 (4219 and 7019 higher); battles per sea
pair higher on all 10.

## Verdict

- **Not battles per naval war.** Where two navies at war share a basin, HEAD fights twice as many battles
  (9.1 → 18.4 a pair-year) and as many of the fleets are under way. No naval combat or hunting rule
  lost battles.
- **Not the land war's count of wars.** HEAD has more wars (pairs at war 234 → 327).
- **The fall is in the navies.** Both commits lose half their armed fleets in year 1–2 (75–83 → 43–46).
  On `dd3b730` they are rebuilt (52 at year 5, 66 at year 10, 81 at year 20; navies 10 → 20); on HEAD
  they are not (45, 52, 49; navies 9 → 12–15). With a third fewer navies the pairs at war that share a
  basin fall to a third (1.48 → 0.53), and that more than cancels the doubled battles per pair.
- So the owner is the navies' rebuild after year 2, a naval-economic cause (which nations build warships
  again, and what HEAD's economic AI spends the money on instead: the transports the ferry asks for since
  7.49d3, 7.66, 7.90e are one candidate, unread). Filed as PLAN 7.84d with its own AT. The share of
  battles sinking nothing (0.7 % → 4.6 %, the critic's 1.0 → 3.7 %) is small beside it and stays a
  note.
- No rule; the pin unchanged (5161de24).

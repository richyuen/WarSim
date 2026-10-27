# ADR-731 and ADR-732's bars read on HEAD (2026-10-27)

Tool: `tools/diag/designBars.ts <seed> 30` (1938 on), HEAD `1b1b1f07` (the sim as `840342c1`). Shares are of the
627,843 land cells. Seeds 1223–1232 are HEAD's reference (read for 7.140 before); 1253–1263 are unseen, 1259 left
out (a critic seed). Raw output in `.cache/7140/bars/` (not committed).

## ADR-731: the late war (withdrawn on this read)

Engaged land formations a day per war with a land front, by the front's length (the cells of either side next to
the other's), year 1 against years 2–30:

| Seed | Wars with a front ≥ 100 cells, y1 → late | Engaged per such war, y1 → late | Late / y1 |
|---|---|---|---|
| 1223 | 4.3 → 5.2 | 8.12 → 0.73 | 9 % |
| 1224 | 4.1 → 4.7 | 8.43 → 1.10 | 13 % |
| 1225 | 3.6 → 4.4 | 11.45 → 0.90 | 8 % |
| 1226 | 4.8 → 4.6 | 10.55 → 0.61 | 6 % |
| 1227 | 4.4 → 5.0 | 9.90 → 0.58 | 6 % |
| 1228 | 5.5 → 6.3 | 6.81 → 0.51 | 7 % |
| 1229 | 5.1 → 6.8 | 7.20 → 0.84 | 12 % |
| 1230 | 4.5 → 3.6 | 8.86 → 0.78 | 9 % |
| 1231 | 5.1 → 5.7 | 7.55 → 0.77 | 10 % |
| 1232 | 4.2 → 5.7 | 5.99 → 0.79 | 13 % |
| 1253–1263 | 3.0–5.0 → 4.6–6.2 | 7.93–12.48 → 0.60–0.91 | 6–11 % |

At fronts of 1, 10 and 30 cells the ratios are the same (6–13 %). The late world has as many real fronts as the
first year and fights on them a tenth as hard. ADR-731's premise (the quiet is the wars with no front) is false;
by the user's rule for this case, PLAN 7.138 stays open as a defect.

Its floors, met on HEAD in 19 of 20 worlds: land changing hands at least 2 % of the land cells each year 2–30
(least 2.23–6.02 %; **1263 1.56 %**); cells taken in front battles every year (least 129–713).

## ADR-732: the long run's shape (accepted)

| Seed | Same five by area (set) | Same five in order | Same five strongest | Largest at y30 |
|---|---|---|---|---|
| 1223 | 7 | 5 | 5 | 32.2 % |
| 1224 | 14 | 6 | 4 | 19.3 % |
| 1225 | 6 | 5 | 7 | 30.4 % |
| 1226 | 6 | 2 | 6 | 25.5 % |
| 1227 | 7 | 5 | 6 | 30.2 % |
| 1228 | 8 | 3 | 7 | 23.5 % |
| 1229 | 5 | 4 | 3 | 21.4 % |
| 1230 | 12 | 5 | 12 | 24.8 % |
| 1231 | 7 | 3 | 6 | 31.1 % |
| 1232 | 9 | 6 | 4 | 17.9 % |
| **1253** | 6 | 6 | 3 | 31.3 % |
| **1254** | 9 | 3 | 4 | 22.6 % |
| **1255** | 10 | 3 | 5 | 18.6 % |
| **1256** | 12 | 5 | 3 | 24.5 % |
| **1257** | 6 | 4 | 2 | 31.3 % |
| **1258** | 9 | 3 | 7 | 32.1 % |
| **1260** | 4 | 3 | 6 | 32.0 % |
| **1261** | 7 | 4 | 8 | **39.4 %** (USA) |
| **1262** | 5 | 2 | 5 | 18.0 % |
| **1263** | 8 | 4 | 5 | **48.7 %** (USA) |

The bar on the unseen ten: the ordered five at most 12 years in every world (**met**, at most 6); the strongest
five at most 12 years in 9 of 10 (**met**, at most 8 in all); no nation over a third of the land at year 30
(**missed**, 2 of 10, both the United States: first from year 15 on 1261, from year 28 on 1263, growing at year
30). Five more of the twenty end between 31 % and 32.2 %, four of them the United States or the Soviet Union.
The miss is a late runaway, not the design: PLAN 7.143.

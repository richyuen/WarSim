# PLAN 7.140: the same five giants (2026-10-27)

Stasis as the critic reads it (`critic/scripts/c16_cmp.py`): at each year's end the five nations holding
the most cells by controller, as a set; the longest run of years with the same set. Shares are of the
627,843 land cells. Raw output in `.cache/7140/` (not committed).

## HEAD (`840342c1`) on the AT's seeds, 1223–1232 × 30 years (`tools/diag/churnAt.ts`)

| Seed | Longest | Years | The five, each one's share over the run and days at war a year | Largest at y30 |
|---|---|---|---|---|
| 1223 | 7 | 1–7 | SOV 27.4–30.4, DEN 4.2–4.7 (w128), AST 4.4–7.6, CAN 10.8–12.3 (w332), USA 7.3–11.8 | 32.2 % |
| 1224 | **14** | 16–29 | SOV 11.1–23.3, FRA 4.0–6.8, DEN 4.4–5.2 (w351), CAN 7.9–11.1 (w353), USA 15.0–31.3 | 19.3 % |
| 1225 | 6 | 12–17 | SOV 29.1–31.7, CHI 3.5–4.0, AST 3.7–4.0, CAN 11.2–11.4 (w278), USA 16.7–20.4 | 30.4 % |
| 1226 | 6 | 14–19 | SOV 5.3–12.6, DEN 5.4–5.5 (w217), JAP 9.9–12.8, CAN 11.1–11.1 (w355), USA 13.9–19.8 | 25.5 % |
| 1227 | 7 | 12–18 | SOV 19.8–27.6, FRA 4.3–6.5, ENG 4.8–8.1, DEN 5.8–6.0 (w312), USA 19.0–26.7 | 30.2 % |
| 1228 | 8 | 19–26 | GER 6.4–9.2, SOV 10.4–16.0, DEN 4.8–5.1 (w363), CAN 6.1–12.0 (w355), USA 17.8–27.0 | 23.5 % |
| 1229 | 5 | 9–13 | SOV 25.2–27.4, DEN 4.4–4.6 (w281), AST 4.1–4.5, CAN 11.0–11.9 (w312), USA 10.3–13.8 | 21.4 % |
| 1230 | 12 | 19–30 | SOV 10.4–14.6, FRA 9.8–13.7, ENG 5.7–8.5, CAN 9.3–9.6 (w255), USA 23.6–26.9 | 24.8 % |
| 1231 | 7 | 8–14 | SOV 7.9–19.7, ENG 6.6–8.6, CHI 6.0–18.6, CAN 5.2–10.2 (w359), USA 15.0–21.6 | 31.1 % |
| 1232 | 9 | 22–30 | SOV 4.7–18.9, DEN 9.1–11.3 (w358), AST 5.2–6.3, CAN 12.1–12.5 (w273), USA 15.9–33.8 | 17.9 % |

Longest **5–14**, mean **8.1**, over 12 years **1** (1224); no world over a third at year 30 (1223 at 32.2 %).
The AT would need 0 worlds over 12, a mean longest at most 6.5 and none past a third.

## The lock (the critic's 64 worlds and its saves)

Every one of the critic's 14 runs over 12 years (`critic/c16_headless_*.json`) holds Canada, the Soviet
Union and the United States; 12 hold Denmark; the fifth is Germany (6), Australia (6), France (2), Brazil,
Japan. The Soviet Union and the United States move a great deal inside those runs (4877: the USA 7 → 40 %,
the Soviet Union 29 → 9 %); Canada and Denmark do not. On HEAD's ten seeds Canada is in 9 of the longest
runs and Denmark in 7, each held to a point or less while at war 128–363 days a year.

`tools/diag/giants.ts` (new) on the critic's year-20 saves (4877, 7019, 6421, 1307):

- **Denmark** is Greenland: 81–84 % of its cells ice, 0–4 land formations, aggression 5, its capital still at
  Copenhagen. Its one land neighbour is Germany (`neighbourMap`): no crossing joins Greenland to Canada.
- **Canada** has 1–8 land formations and 3–8 M people over 9–12 % of the cells, a puppet (of England in
  1938, of the United States in 4877 and 7019) at autonomy 82–85.
- **Australia** has 1–3 land formations, at war with 7–26 nations; no enemy formation stands on any of the
  three in any of the four saves.

Why each mechanism in the sim leaves them so:

- **A land war:** Greenland has no land neighbour; Canada's only one is the United States (its overlord or
  its ally). `warUtility` weighs the strength ratio, a claim, the target's wars, never what the target holds.
- **A landing:** tried at PLAN 7.82b/c (ADR-664, ADR-669): orders at Denmark ×3, but 82–95 % of the plans
  ended with no transport group at hand, and landings on empty land took formations from the fronts
  (engaged per war 0.480 → 0.421).
- **A peace:** the terms keep what is occupied (ADR-51). A decisive winner annexes a losing leader under
  SMALL_STATE_KM2 (8,500 km²) or puppets one 30 % occupied by km² (`makePeace`); Greenland's ~2 M km² is in
  both figures, so nobody occupies 30 % of Denmark without walking the ice.
- **A revolt:** core land, nearly no people; OVEREXT_SHARE is read in km², and Greenland is 1.6 % of the
  world's km², Canada's strain about −0.9 unrest a month net of DECAY.
- **Integration:** a puppet integrates below INTEGRATE_BELOW (50) autonomy; Canada stays at 82–85.

## A treaty rule, read and dropped (`tools/diag/peaceOverseas.ts`, new)

The one lever not tried before: a decisive peace also gives the losers' undefended land on other
landmasses than their capital's to a winner within 64 cells holding under a quarter of the land. Read
from the critic's year-10 saves × 20 years, the trial applied at each peace on its own:

| World | Decisive peaces | With such land | Cells it would move | Five changed |
|---|---|---|---|---|
| 4877 | 226 | 150 | 141,435 | 2 |
| 7411 | 296 | 210 | 253,139 | 0 |
| 6737 | 194 | 133 | 226,266 | 0 |
| 4561 | 255 | 186 | 129,979 | 0 |

Denmark is never the loser of a decisive peace in the four; the land goes chiefly to Germany, the United
States and Japan (from the Soviet Union, the Netherlands, Canada's islands, France). It would move a
twentieth to a third of the world's land a decade among the nations already large, and break the set
twice in about 680 peaces. Not built.

## Verdict

No rule. The fixed members are held by geography and by tiny peaceful or allied holders that every
mechanism of the sim leaves alone; a rule on the fifth slot cannot cut the mean from 8.1 to 6.5 nor break
1224's 14 years (four giants and France). To the user: ADR-730.

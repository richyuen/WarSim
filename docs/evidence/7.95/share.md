# PLAN 7.95: the share, read first (2026-10-23)

The rule as filed (ADR-656 b): at war with no naval enemy, a nation with a shipyard and no armed fleet
saves for its cheapest warship while its army is at or over a share S of its peacetime share (today it
saves only at the whole share, `upkeep >= peace`). S was to be read first on seeds 3613 and 4219.

`tools/diag/navySave95.ts` (new; HEAD `31a97802`), years 1–10: each month such a nation (income at
POOR_INCOME or more, more than FEW_FORMATIONS land formations) is under the warship's line, its army's
upkeep on land and in training over `peaceShare` × income, by band; and the months its economic AI
placed a land order (the gold a saving would have kept).

| army / peacetime share | 3613 months | with a land order | 4219 months | with a land order |
|---|---|---|---|---|
| 0–0.25 | 47 | 24 | 106 | 31 |
| 0.25–0.5 | 103 | 48 | 136 | 62 |
| 0.5–0.6 | 12 | 5 | 8 | 3 |
| 0.6–0.7 | 12 | 4 | 6 | 2 |
| 0.7–0.8 | 20 | 6 | 3 | 1 |
| 0.8–0.9 | 15 | 0 | 8 | 1 |
| 0.9–1 | 6 | 1 | 5 | 0 |
| 1 and over | 68 | 0 | 41 | 0 |

**The months that order army instead of a warship are those of armies far under their share:** 72 of
88 (3613) and 93 of 100 (4219) under half. A share S of 0.5 or more changes 16 and 7 order-months in ten
years; to reach most of them S must be about 0.25, which is the army ADR-615 (PLAN 7.65, the user's
ADR-592 a) cut the reserve for: a defender far under its share. No S both keeps ADR-615's armies and
saves the gold the depleted navies lacked.

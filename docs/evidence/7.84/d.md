# PLAN 7.84d: why HEAD's navies are not rebuilt after year 2 (read, two A/Bs; no rule)

7.84c (`c.md`): on 10 of the critic's seeds both commits fall to 43–46 armed fleets by year 2.
`dd3b730` rebuilds them (66 at year 10, 81 at year 20) and HEAD does not (52, 49). The AT's bar:
armed fleets in years 10–20 at least 0.9 of `dd3b730`'s (73.7; HEAD 51.3), and late sea battles not
below its 13.43.

## Runs

Two seeds with the widest gap at years 5–10 (`c/`: 3613 30 against 67 at year 10, 4219 41 against 81).
Each was read over 10 years on HEAD (`875cf676`, sim as `2934cb33`) and on `dd3b730` (the
`WarSim_old` worktree).

- `navyRebuild.ts` (`d/{old,head}_rebuild_<seed>.json`, `rebuild_summary.py`). Per month, per living
  navy under 0.75 of its peak, it records the first test of the fleet step that stops a warship, and
  for `gold` months what the month's AI spent: the army's orders, the refills, the other orders. The
  HEAD runs used the reason chain from before this note's patch (below), so their
  `transportInTraining` months include a few where the ferry's transports stop no warship.
  `navySave.ts` reads those months anew.
- `navySave.ts` (new, `d/save_<seed>.json`), HEAD only. It covers the months a nation at war with a
  naval enemy has no armed fleet and its treasury is under the warship's line. For each it records
  the first input of `economic.ts`'s saving that turns it off, and the land orders the AI then placed.
- Two A/Bs of HEAD in a scratch worktree, `seaYears.ts` × 10 years (`d/reserve3_*`, `d/fleetres0_*`;
  patches `d/reserve3.patch`, `d/fleetres0.patch`).
- `navyRebuild.ts` patched: the ferry's transports in training stop no warship while it wants them
  (ADR-614), and `wantsTransport` reads a division's room (ADR-598), as `economic.ts` does.

## 1. What stops the warship (depleted navies, years 2–10, nation-months)

| | 3613 old | 3613 HEAD | 4219 old | 4219 HEAD |
|---|---|---|---|---|
| gold (treasury under the line) | 1,224 | **1,556** | 749 | **1,734** |
| warship in training | 352 | 187 | 346 | 164 |
| ordered (a warship that month) | 67 | 23 | 63 | 25 |
| poor (income < 20) | 179 | 306 | 49 | 206 |
| no shipyard | 201 | 151 | 456 | 190 |
| transport in training / wanted | 80 | 145 | 59 | 183 |

HEAD's navies are not rebuilt because their treasuries never reach the warship's line, the
cheapest warship of the nation's income and RESERVE_MONTHS of income.

## 2. Where the gold goes in the `gold` months (means a month)

| | 3613 old | 3613 HEAD | 4219 old | 4219 HEAD |
|---|---|---|---|---|
| treasury / line | 0.71 | **0.45** | 0.76 | **0.44** |
| the army's orders | 24 | **186** | 37 | **117** |
| refills | 53 | 4 | 45 | 5 |
| other orders (fleets, wings, transports) | 8 | 14 | 13 | 14 |

By the nation's war state:

| army's orders a month (months with one) | 3613 old | 3613 HEAD | 4219 old | 4219 HEAD |
|---|---|---|---|---|
| no armed fleet, at war with no naval enemy | 44 (14) | **326 (89)** | 69 (7) | **135 (58)** |
| armed, at war with no naval enemy | 81 (11) | **734 (77)** | 93 (15) | **916 (70)** |
| no armed fleet, at war with a naval enemy | 0 (0) | 85 (35) | 0 (0) | 40 (27) |
| at peace, no armed fleet | 0 | 0 | 0 | 0 |

- **The cause is ADR-615 (PLAN 7.65, ADR-592 a, the user's).** At war, while a nation's army is under
  its peacetime share, its orders keep no reserve (`WAR_RESERVE_MONTHS` 0, was RESERVE_MONTHS 3). A
  nation at war with no naval enemy does not save for a warship (ADR-557, ADR-575: "a war's army under
  it is not starved for a ship"). Its army now spends the treasury toward 0, and the fleet step, which
  keeps RESERVE_MONTHS, never has its price. The armies stand at 0.2–0.6 of their peacetime share, so
  the cut applies in nearly every month of a land war.
- **With a naval enemy** (`navySave.ts`, years 2–10): the saving holds in every month it is on (211
  and 231 `saving` months, no land order). The army orders in the months it is off: `FEW_FORMATIONS`
  (ADR-590) 960 / 1,102 months, 49 / 37 with an order, nearly all small nations (Romania, the Raj,
  the Indies, Norway); a warship already in training 30 / 62, half with an order, as the rule meant.
  Small, and as designed.
- **Not the price window.** A destroyer flotilla costs 1,120 and an infantry division 1,001. Under
  `dd3b730` the army's line (a division and three months) also sat 119 under the warship's. The old
  treasury got over it in the months the army stopped for its war share, the balance or men, and three
  months of income stayed in it.

## 3. The A/Bs (seaYears × 10 years; armed fleets by year, years 2–10 means)

| seed, rule | y1 | y2 | y3 | y5 | y8 | y10 | fleets y2–10 | battles y2–10 | navies y10 |
|---|---|---|---|---|---|---|---|---|---|
| 3613 `dd3b730` | 74.8 | 46.7 | 49.4 | 49.8 | 55.5 | 67.3 | 54.4 | 12.8 | 14.7 |
| 3613 HEAD | 86.0 | 42.0 | 15.1 | 24.5 | 27.2 | 30.3 | 26.7 | 7.9 | 12.8 |
| 3613 war reserve 3 | 83.2 | 41.7 | 31.1 | 43.6 | 43.6 | 40.9 | **40.8** | **16.0** | 15.7 |
| 3613 fleet step at the war reserve | = HEAD | | | | | | 26.7 | 7.9 | 12.8 |
| 4219 `dd3b730` | 80.2 | 64.0 | 53.4 | 52.4 | 68.7 | 80.7 | 62.5 | 12.7 | 26.0 |
| 4219 HEAD | 109.2 | 73.5 | 57.6 | 34.8 | 37.6 | 40.6 | 45.9 | 14.8 | 13.1 |
| 4219 war reserve 3 | 109.3 | 89.3 | 41.2 | 42.5 | 52.4 | 58.1 | **52.1** | **16.0** | 16.4 |
| 4219 fleet step at the war reserve | = HEAD | | | | | | 45.9 | 14.8 | 13.1 |

- **The war reserve back at 3** (`reserve3.patch`, ADR-615 undone) recovers about half the fleets'
  gap (3613 26.7 → 40.8 against 54.4; 4219 45.9 → 52.1 against 62.5). Late battles reach 16.0 on
  both, over `dd3b730`'s 12.7–12.8. The fleets bar (0.9 of `dd3b730`'s) is not met on either seed.
- **The fleet step keeping the war's reserve** (`fleetres0.patch`, the army's cut left alone, the
  fleet's 3 months dropped at war under the peacetime share) changes nothing: the same figures in every year. The army's
  orders come first and leave the treasury under a destroyer's 1,120 whatever the fleet's reserve.
- **The other half is losses** in HEAD's busier world. Ships sunk in years 2–10 are 910 (3613
  `dd3b730`) against 1,047 with the reserve restored. On 4219, year 2 sinks 47 under `dd3b730` and
  460–522 under HEAD's rules. Pairs at war are higher (c.md: 234 → 327). That is 7.79's and 7.82's land
  war, not the economic AI.

## Verdict

- The navies' rebuild stops because of ADR-615's war reserve. The user took that cut, and it amends a
  rule (ADR-557, 575) that does not save for a warship in a land war. No rule within this task's reach
  that keeps ADR-615 reaches the bar: the fleet's own reserve does nothing, and undoing the cut still
  misses the fleets bar on both seeds (it does clear the parent's battles bar on them).
- Closed not done: BLOCKERS 2026-10-23; ADR-656 proposed, the user's decision.
- No rule; the pin unchanged (5161de24).

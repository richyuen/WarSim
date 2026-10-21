# PLAN 7.49a: what holds the land war after year 1 (measured, no rule)

2026-10-21, on HEAD `391a60f` (the sim code is the critic's `dd3b730`: no file of `src/` or `data/`
changed since, so the critic's saves are this code's). The critic's 48 saves
(`critic/c11_seed*_y10.bin`, `_y20.bin`, 24 seeds) and, for year 1, fresh runs of seeds 1129,
2081, 6421, 7019 from 1938. Tools: `tools/diag/landStates.ts`, `warSides.ts`, `armyGates.ts`,
`noOnesCells.ts`, `stuckMarch.ts`, and `marches.ts`, `economySplit.ts`. The figures are in
`measure/`.

## 1. The two counts

| | engaged land formations, worldwide, mean of days | wars running | engaged per war | land formations of nations at war |
|---|---|---|---|---|
| Year 1 (6421, 7019; days 1–200 daily) | 54.2, 51.7 | 6.4, 6.7 | 8.5, 7.7 | 638, 649 |
| Year 10 (24 saves, 10 days each) | 0.34 | 4.96 | 0.07 | 271 |
| Year 20 (24 saves, 10 days each) | 0.57 | 4.15 | 0.14 | 315 |

(`measure/sides_y10.json`, `sides_y20.json`; year 1 `.cache` run of `warSides.ts`, as printed.)
The AT's bar, a quarter of year 1's per war, is about 2 engaged formations per war running; the
late figure is 0.07–0.14, 15 to 30 times under it. Both counts are given in every read after a
rule: a rule that ends a war on the unarmed raises the second and not the first.

## 2. What each formation of a nation at war is doing (`landStates.ts`)

Share of the land formations of living nations at war, on the day after each save (year 1: days
60, 150, 300 of 4 seeds, 12 reads). `island`: standing on a landmass where its nation has no front
cell in any of its wars; `near`/`far`: standing within / beyond DEPLOY_RANGE_CELLS of its front on
its landmass; `noFront`: its nation has no front at all.

| state | year 1 | year 10 | year 20 |
|---|---|---|---|
| engaged | 6.7 % | 0.2 % | 0.2 % |
| on the march, target an enemy cell (attack) | 18.8 % | 12.5 % | 9.7 % |
| on the march, target its own side's cell (hold) | 43.7 % | 36.1 % | 37.5 % |
| island | 3.3 % | **21.4 %** | **27.7 %** |
| far | 16.4 % | 17.4 % | 16.4 % |
| near | 6.5 % | 5.8 % | 4.2 % |
| noFront | 2.0 % | 2.0 % | 2.8 % |
| retreat, home, aboard, elsewhere | 2.7 % | 4.6 % | 1.3 % |
| formations at war per read | 609 | 276 | 303 |
| cells taken a day per read | 137 | 59 | 53 |
| of them with no formation of the loser's side within 6 cells (walk-ins) | 62 % | 95 % | 96 % |

`far` and `hold` are the same share early and late: not a late cause. What changes is `island`
(×7), the armies at war (halved), and the defenders: the late conquests are walk-ins.

## 3. The armed wars (`warSides.ts`)

A war is armed on a day when each side has 5 or more land formations within DEPLOY_RANGE_CELLS of
its front. Year 1: 3.1 and 4.1 a day on 6421 and 7019, 62 and 67 engaged in them. Years 10 and
20: 0.5 a world, and 0.2 engaged in them on average. The gap from each of their formations near
the front to the nearest enemy one (`measure/gap_*.json`): in year 1 a fifth to a half of them
within 15 cells; late, nearly all beyond 15 cells (2081 year 20 Germany–Switzerland's side: 72 and
68 near the front, 0 within 1.5 cells, 1 within 3, 115 of 140 beyond 15). The armies of the armed
wars do not stand face to face and wait: they are elsewhere.

Why so few armed wars: a declaration needs `aggression/100 × (min(3, ratio) − 1)` over
DECLARE_AT (0.5) with the allies at ALLY_WEIGHT (0.4), so about 1.5 times the target's strength
before OPPORTUNITY, CLAIM or RESTLESS (`strategic.ts`). Late wars are declared on the weak by
design; the 1938 start has peers at war because the scenario puts them there. Whether that design
should change is the user's (no part below: the bar may be out of reach of the parts, §6).

## 4. The causes, each a part

### 4.1 Strait crossings no one holds (7.49b)

Land cells of no province and no owner join the landmasses at the straits: Gibraltar (992,383),
Bab-el-Mandeb (1270,525), the Bosporus (1111,368), the Øresund (1087,245), the Palk Strait
(1473,543), by the 1938 world (`noOnesCells.ts`). Marches cross them; one whose way ahead closes
(a neutral beyond) stops there, and the formation is never ordered again: on 8011 year 10, 90
German and Italian divisions at 992,383, full strength, `moving` 0, their targets French and
Italian cells in North Africa 50–100 cells away, and no `askMove` of any of them in 8 days of plans
(`OP_PROBE.ask`). On the 48 saves 411 land formations of nations at war stand on such cells: 162 of
6421 year 10's 261 at war (145 German "on the march" at Gibraltar), 126 of 8011's 282, 30 on 5683
year 20, 27 on 8693 year 20. The critic's "Italy 46 of 55 (8011)" is this pile.

### 4.2 The warship's saving with no army left (7.49c)

6421 year 20: the Soviet Union at war with Germany, one division (then none), 2,407 gold, +199 a
month, 8.5 M manpower, buys nothing: its gold less the division's price (1,001) is under the
cheapest warship's price and RESERVE_MONTHS of income, and at war with a naval enemy the army's
orders keep the warship's price whatever the army's size (ADR-575, ADR-579). `armyGates.ts` (the
gates in the code's order, read at the month start, then the month run): on the 24 saves of year
10 and of year 20, 40 and 49 nations at war stopped there, 10 and 11 of them with 3 formations or
fewer and no order that month (`measure/gates_y*.json`, `gate` "ship(navalFoe)"). ADR-557's floor (the army under its
peacetime share is not starved for a warship) holds at war only against an enemy with no fleet
(ADR-578 a, the user's decision).

### 4.3 The sea powers' home armies (7.49d)

Island formations are 21–28 % late against 3 % in year 1, and most stand at a capital: Britain at
London (7019 year 10: 85 divisions, 79 of them over half strength, its one war against Japan 77
days old, two transport groups), Japan at Tokyo, the United States at Washington, Germany at London
once it holds Britain (2081 year 20: 46). New formations of a nation whose fronts are all overseas
are raised in the theatre (overseas muster, `production.ts`), but the army already at home stays:
the invasion AI's transports carry a few. The critic's London (7019) and Wick (1129) cases.

### 4.4 The defenders' purse (7.49e)

The armies at war halve after year 1, and late the small nations at war hold almost none: income
under 150 a month, 699–738 nations on 24 worlds, 0.6 formations each; income 150–500, 124–127
nations, 4.5–4.8 each. Of the second band 91–98 are stopped at the month start by the gold: the
division's price (1,001) and RESERVE_MONTHS (3) of income kept back, so a nation of 300 a month
with 1,500 gold, invaded, raises nothing. The 1938 start armed them; the economy does not rearm a
nation that lost its army. Measured first in the part: what a nation of the 150–500 band would
raise in a year with the reserve at war cut while its army is under its peacetime share.

## 5. Not causes

- `far` (16 %) and the marches to hold cells where the threat is 0 (~37 %): the same in year 1.
- The stand-off just out of contact (formations 2–4 cells apart): none (§3).
- Germany–Soviet Union on 6421 year 20 (the critic's case): the war is 63 days old; the Soviet army
  died in the war before, and it raises none since: §4.2.

## 6. The bar

Even with every part landed, contact needs both sides armed on one landmass, and late wars are
declared on the weak (§3). The parts are read against the critic's figure (engaged worldwide) and
the AT's (per war); if they leave the per-war figure far under the bar, the next step is the user's
(ADR-554): the bar, or the strategic AI's choice of wars.

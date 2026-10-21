# PLAN 7.49c: the warship's saving with no army left (ADR-590)

The rule (`src/sim/ai/economic.ts`, `saves`): at war with an enemy that has an armed fleet,
ADR-575 and ADR-579 kept the cheapest warship's price over the reserve from the army's orders and
refills whatever the nation's army. Now only with more than FEW_FORMATIONS (3) land formations on
land; with 3 or fewer the nation falls to ADR-557's floor (the army orders first while under its
peacetime share), as in a war with no naval enemy.

## The AT's figure: the 48 saves (`armyGates.ts`)

`npx tsx tools/diag/armyGates.ts <out> <seed:critic/c11_seed*_y10.bin ...>` (and `_y20`), on HEAD
(`gates_y*_before.json`) and with the rule (`gates_y*_after.json`); `node
docs/evidence/7.49/c/sum.mjs before|after`. The tool now mirrors the rule in `gate` and keeps the
old rule's gate as `was` where it differs, so the after reads the same nations the old rule
stopped; `landOrdered` is the land queue's growth over the month's tick.

Nations at war with 3 land formations or fewer (the tool's count includes formations aboard
transports; the rule counts those on land, never more, so every row the tool counts is in the rule's
case) stopped at the month start by the warship's saving at war with a naval enemy, and ordering
nothing that month (bar: 0):

| saves | stopped | no order, before | no order, after | land orders after |
| --- | --- | --- | --- | --- |
| year 10 (24) | 23 | 10 | **0** | 23 of 23 |
| year 20 (24) | 25 | 11 | **0** | 25 of 25 |

Met. The critic's case, 6421 year 20's Soviet Union (one division, 2,407 gold, income 379): no
order before, a division after. Of all 970 / 921 nations at war, 792 / 744 hold 3 land formations
or fewer; their land-or-other orders that month 23 → 33 and 22 → 33. The code's `ship(navalFoe)`
gate, any army: 40 → 17 and 49 → 24.

## Read: engaged land formations (`warSides.ts`, 30 days of each save)

| | b2 (HEAD) | 7.49c |
| --- | --- | --- |
| per war, year 10 | 0.115 | 0.120 |
| per war, year 20 | 0.144 | 0.143 |
| worldwide, year 10 | 0.55 | 0.575 |
| worldwide, year 20 | 0.58 | 0.575 |

Flat: a division bought by a nation of one or none does not make a front (`sides_after.json`).

## The guard: Britain's `spentArmy` months (`navyRebuild.ts`, 10 years) — missed

The AT reads Britain's `spentArmy` months on 7019 and 3613 "as 7.47's (4 / 12), no higher".

| seed | 7.47 (its code) | HEAD | 7.49c | by kind, 7.49c |
| --- | --- | --- | --- | --- |
| 7019 | 4 | 20 | 35 | armed/landFoe 29, armed/peace 5, armed/navalFoe 1 |
| 3613 | 12 | 8 | 16 | armed/landFoe 11, armed/peace 5 |

- 7.47's 4 / 12 were read on other code (the chase's worktree, before ADR-580's landing and
  ADR-582, 586, 588, 589): HEAD already stood at 20 on 7019 before this rule.
- The rule changes a month only for a nation at war with a naval enemy with 3 land formations or
  fewer; for Britain with an armed navy such a month is of the kind `armed/navalFoe`. That kind is
  0 → 1 on 7019 and 0 → 0 on 3613. The rise is in `landFoe` (19 → 29, 6 → 11) and `peace` (1 → 5,
  2 → 5), kinds where the rule reads the same before and after: the world diverged from year 1
  (the pin moved), and two seeds cannot tell a rule from that. `navyRebuild` does not record
  Britain's land formations a month, so the `navalFoe` kind is the proxy.
- Not re-run on more seeds (ADR-554): BLOCKERS, the user's to accept.

## Test and pin

- `tests/unit/navyBudget1938.test.ts`: Norway at war with Sweden (an armed fleet) with its three
  divisions of 1938, with none, and with none and a destroyer flotilla, orders a division and no
  warship (red without the rule). ADR-575's and ADR-579's cases give Norway four divisions bled to
  half (over FEW_FORMATIONS, under its peacetime share), green before and after.
- Pin: 191b0cd5 → da485175.

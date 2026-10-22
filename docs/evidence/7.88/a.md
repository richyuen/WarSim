# PLAN 7.88a: the ferry tries its transport groups until one acts

Run 12's saves (`critic/c12_seed*.bin`), HEAD `4202ac58` against the rule (ADR-638). Read with
`tools/diag/ferryTurns.ts` (`FERRY_PROBE`, read only), 30 days from each save, the USA.

## 1. The ferry turns

The USA's actor days in the invasion AI (once in STAGGER = 7 days): what took each, and for a
ferry turn the groups tried.

| save | | actor days skipped (someone aboard) | ferry turns | turns that gave an order | the groups tried |
|---|---|---|---|---|---|
| 1129 year 10 | HEAD | 0 | 4 | **0** | 126 at Nuuk, every turn |
| | rule | 1 | 3 | **3** | 126 and 138 at Nuuk (nothing), then 365 at Norfolk (an order), every turn |
| 6421 year 20 | HEAD | 0 | 4 | **0** | 61 at Port-of-Spain, then 15 at Roseau (the sail to the army refused) |
| | rule | 1 | 3 | **3** | 152 at Norfolk (an order), every turn |

Logs: `head_1129.log`, `head_6421.log`, `rule_1129.log`, `rule_6421.log` (the JSON beside each).
The day skipped with the rule is the one after an order put a division aboard: the invasion turn
is skipped while one of the nation's formations is aboard (as before).

**The AT's bar** (the USA's ferry turns in 30 days that give an order 0 → at least half): 0 of 4
→ 3 of 3 on both saves. Met.

On 1129 the groups at Nuuk come first still (Greenland has free formations: an army they would
carry); the loop passes over both. On 6421 Port-of-Spain's and Roseau's groups stand on islands
with no army of the USA's, so the order puts Norfolk's (on the mainland army's land) first.

## 2. The piles

Piles of 30 or more of a nation at war on one cell 30 days running (`piles.ts --days 30`):

| save | HEAD (`docs/evidence/7.79/piles.json`) | rule (`piles_rule.json`) |
|---|---|---|
| 1129 year 10 | USA 60 at 625163, 53 at 746057 | the same (60, 53) |
| 6421 year 20 | USA 77 at 746057 | USA 75 at 746057 |
| 7019 year 10 | none | none |

3 → 3. Norfolk's group sends the nearest free formations to its port, not the piles; one group a
turn (24,000 men) is PLAN 7.88b's cause (ADR-637, the user's).

## 3. The test

`tests/unit/strandedFerry1938.test.ts`, "the ferry tries its groups until one acts": on 7.79c's
case (Germany at war with Lithuania, a division at a home port that reaches no front cell) a
second German group of the same room; the lower id at Baku (handed to Germany: on Europe's
landmass, on the Caspian, so no target its waters reach) and the other at the division's port.
Red with one group a turn (the division not aboard), green with the rule.

## 4. The pin

e66bef2e → 083f2585. The refactor alone (the groups in HEAD's order, one tried) keeps e66bef2e.

## 5. Cost

Both bundles at once on separate P-cores, swapped (`.cache/prof88a/`), invasion AI by core: seed
99's year 1 0.090 / 0.075 → 0.097 / 0.077 ms; a year from 1129 year 10 0.260 / 0.254 → 0.256 /
0.242; from 6421 year 20 0.359 / 0.344 → 0.363 / 0.355. Within the noise.

## 6. A test restated: `warBattle`'s uneven battles

`warBattle.test.ts` (PLAN 2.14f5a, 60 days of seed 99): the answers with one side under a tenth of
the other, HEAD 74 of 762 (the bound a tenth, 76.2), the rule 77 of 746. Read with a scratch copy
of the test's loop (`.cache/prof88a/uneven.ts`, not kept), by war: Germany on Poland 27 → 32, the
others about the same. The state hash is equal on days 12–15 (Italy's two refused tries on day 13
write nothing); Japan's turn of day 16 takes its group at Hiroshima for HEAD's at Haiphong.

Of the uneven answers, those whose war had a battle with no side under a tenth to name: 31 (10 of
the named battle's leader rank) on HEAD, 16 (6) with the rule. The test now bounds those, under a
twentieth, and reports all (ADR-638).

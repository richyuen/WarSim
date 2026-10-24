# PLAN 7.112: the pockets as a rule, measured (2026-10-24)

HEAD `28029585` (pin unchanged). The world: critic run 13's year-20 save of seed 4877
(`critic/c13_seed4877_y20.bin`), a year from it (year 21; HEAD's hash dba7fdae). Read by
`npx tsx tools/diag/pocketWalks.ts critic/c13_seed4877_y20.bin 365 <out.json>` (`POCKET_PROBE` in
`pocketOf`: calls, walks, cells; engaged land formations of nations at war over wars, daily).

## The rule tried (`rule.patch`, not committed)

Each start's answer is its own walk: no walk ends on another walk's cells; a pocket's number is its
least cell + 1 (not the first asker's), so two cells of one pocket agree whoever asked first. The
walk is kept on the passage's node parts (`NodeParts.pockets`, carried while `open`, `shut` and the
log patch hold) and asked again only when a flip has touched a cell it walked or a neighbour of one
(`touchOf`: each flip stamps its count on its cell and its 8 neighbours, per world; any flip counts,
open or closed alike). Every cell of a pocket shares the pocket's walk. With the patch, the tool's
`POCKET_PROBE.keep = process.env.NOKEEP !== '1'` walks every start afresh: the keep's check.

## The figures

| run | cells a tick | walks a tick | cells a walk | calls | engaged a war | year's hash | s a year |
|---|---|---|---|---|---|---|---|
| HEAD (`head.json`) | **7,134** | 33.7 | 212 | 2,282,735 | 0.2647 | dba7fdae | 35 |
| own walks, no keep (`nokeep.json`) | 254,083 | 252 | 1,009 | 2,206,787 | 0.2528 | 086a4a82 | 120 |
| own walks, kept (`rule.json`) | **141,368** | 61 | 2,319 | 2,206,787 | **0.2528** | 086a4a82 | 86 |

The bar: cells a tick at most 0.5 × HEAD's = 3,567; engaged a war not below 0.2647. **Missed** on
both: 19.8 × HEAD's cells, and engaged 0.012 lower.

- **The keep is exact:** the year's hash is 086a4a82 with it and without it. It answers 76 % of the
  calls and cuts the cells by 44 %. The cost is the rule's, not the keep's.
- **Why:** HEAD's walks are short because they end on the cells of the walks before them in the tick
  (an answer taken from another walk's marks). Own walks are each walked out: by how they end, without
  the keep (`nokeep_ends.log`): to the 4,096-cell cap with no wide ground 287 k walks of 1,174 M cells
  (53 % of the cells, 13 % of the walks); pockets 1,322 k walks of 637 M (29 %; the keep shares a
  pocket's walk among its cells); to a wide ground 598 k walks of 414 M (19 %). ADR-680's sizing
  (0.2–0.3 ms) took the kept walks to be as short as HEAD's shared ones.
- **Not judged:** the round trip's test, a unit test and the gate were not run on the patch; the AT
  missed first.

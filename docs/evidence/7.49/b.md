# PLAN 7.49b: land formations on the crossings of straits

The 48 saves of run 11 (`critic/c11_seed*_y10.bin`, `_y20.bin`). The count: land formations of
nations at war on a cell no nation controls after 30 days of each save
(`tools/diag/noOnesCells.ts --days 30`). Bar (7.49b): under 41.

## The before (HEAD `3592ad0`)

398 of nations at war (409 in all). The piles: 6421 year 10 166 (162 at Gibraltar 992,383), 8011
year 10 126 (90 at Gibraltar standing, 35 at the Øresund 1087,245 on the march), 5683 year 20 30
and 8693 year 20 30 (Gibraltar), 5683 year 10 13 (the Bosporus 1111,368), 8011 year 20 17.

## The trace

Two kinds (a probe of each formation's next path cell, and the planner's view of the standing ones
with logging put in for the run and taken out):

1. **On the march, waiting** (about 280 of the 398). The next cell of the path is a cell of the
   enemy (6421: French Morocco's 992,384; 8011: a Danish cell 1088,244). A march waits before an
   enemy's cell until the territory system flips it, and a cell is contested only by a nation that
   holds a 4-neighbour of it (the connectivity rule). The crossing has no province and no holder,
   so a cell on the far shore has no attacker's neighbour, and the flip never comes. The shore
   behind them is their side's (6421 and 8693: Italy's; 5683: the Soviet Union's), at war with the
   holder ahead.
2. **Shut in** (8011 year 10: 90 at Gibraltar; 5683 year 10: 13 at the Bosporus). The crossing's
   4-neighbours on land are of nations not in the war (8011: Nationalist Spain to the north, #108 to
   the south); the diagonal to German Gibraltar (993,382) is not a step (993,383 is water: no
   corner is cut). The planner's class of the cell is a pocket of one cell (`pocketOf`), which
   reaches no sector: no order is asked (Italy's plans, 8 days: `asks 0`). Repatriation sends home
   an idle formation on a stranger's land only (`foreignTo` of holder 0 is false), so nothing moves
   them. German Gibraltar is itself a one-cell enclave of Nationalist Spain.

## b1: the front over a strait (ADR-588)

The shores of a crossing (land cells 8-adjacent to a body of crossing cells, `nav/crossings.ts`)
count as neighbours of each other in the territory system (`frontNeighbours`: the frontier, its
rebuild, the contest of a cell, the upkeep after a flip) and in the planner's `attackCell`.

- Count after 30 days: 398 → **116** (bar under 140). Left: 8011 year 10 91 (the shut-in 90),
  5683 year 10 13 (shut in), 12 others of 1–3.
- Engaged land formations (`warSides.ts`, 30 days of each save), HEAD → b1: worldwide 0.55 → 0.55
  (year 10), 0.54 → 0.58 (year 20); per war 0.115 → 0.115, 0.136 → 0.144. Only 8693 year 20 moved
  (3.6 → 4.4): the armies that crossed walk into land with no army of the enemy's.
- The pin: a1a50bcc → 191b0cd5. Test: `tests/unit/straitFront1938.test.ts` (3 of 4 red with
  HEAD's `territory.ts`).

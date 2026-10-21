# PLAN 7.49f: the landing's port (ADR-593)

2026-10-21, on HEAD `ee847ca` and the rule. Tool: `tools/diag/islandArmies.ts`, 60 days from each
of the 48 saves (`critic/c11_seed*_y10.bin`, `_y20.bin`); its copy of `planLanding`'s gate reads a
formation at the port as the rule does. Before: `d/island_y*.json` (7.49d's run, the same code but
the rule). After: `f/island_y*.json`. Sum: `node docs/evidence/7.49/f/sum.mjs <dir>`.

## 1. The rule

`planLanding` (`ai/invasion.ts`) sends its formations to the port's land cell, but took aboard only
those within AT_PORT_CELLS (3) of the port's water; `tryLanding` takes a formation within 3 of
either. Now the planner takes either too. At 19 of the 579 ports the water is 4–11 cells off the
land cell (Glasgow 4, London 7, Hamburg 9, Trondheim 11). Test: `landingPort1938.test.ts`, a British
division on Glasgow's cell with the transports at its water: red without (never aboard in 14 days),
aboard on the first planning day with.

## 2. The AT's figure

| | year 10 before | after | year 20 before | after |
| --- | --- | --- | --- | --- |
| watched nations on `send` 30+ of 60 days, none boarded | 5 | 5 | 5 | 4 |
| formations boarded by the watched nations in 60 days | 6 | 6 | 0 | 1 |
| island share after 60 days | 21.8 % | 21.8 % | 29.6 % | 29.6 % |

10 → 9, bar 0: **missed**. The one gone is the critic's named case, 2081 year 20, Germany's 56 on
Britain at Glasgow: one boards. Engaged land formations (`warSides.ts`, 30 days of each save, `f/sides_after.json`):
per war 0.120 / 0.143, worldwide 0.575 / 0.575, as 7.49c's to the third place.

## 3. Why the nine stay: 7.49d §4 mis-read them

7.49d §4 counted the ten stuck nations as held by the far water. Of the ports they plan from, only
Glasgow (2081) is one of the 19: Kotor, Annaba, Cartagena, Kiel, Warri, Miyazaki, Gold Coast and
Nouadhibou have their water within 3 cells. The rule's own cause on the saves: 1 → 0. Traced at the
first planning day of each (`orderMove` from each free formation on the port's land to its point,
nearest first; the probe leaves out the planner's `nearFront` test):

- **The march refused, the send ended** (PLAN 7.7's bound in `sendToPort`: the first refusal ends
  the send): 4513 Germany at Kotor (8 free on its land, all 8 refused), 7247 year 10 Germany at
  Annaba (143, all refused), 8693 Germany at Annaba (29, all), 1129 year 20 Britain at Warri (6,
  the nearest 3 refused, the fourth would go). Nobody is sent, every week. PLAN 7.54.
- **The transports' room under a division's** (`sendToPort` stops at the first formation over the
  room): 5683 year 20 Japan at Miyazaki, a group of 2,000 men; 7247 year 20 Germany at Nouadhibou,
  4,000; 4513 year 10 Latvia (`atPort` 60 days, 2,000; 7.49d's note). PLAN 7.55.
- **Untraced:** 8011 year 10 Germany at Cartagena (the nearest two marches go, the third is refused)
  and 6421 year 20 Australia at Gold Coast (every march goes): both have a front in another war, and
  the probe left out the `nearFront` filter, so its lists are not the planner's. 8167 year 10
  Lithuania at Kiel: its one free formation 649 cells off, its march allowed.

## 4. What is left

The bar (10 → 0) waits on 7.54 and 7.55 and on the two untraced cases. BLOCKERS, the user's:
(a) tick on the rule's own count (1 → 0), the AT read as mis-measured by 7.49d; (b) close not done,
the rule kept; (c) keep 7.49f open until 7.54 and 7.55 land and the count is read again.

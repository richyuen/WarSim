# PLAN 7.56b: the landing's target in the transports' waters (ADR-597); 7.56's AT read

2026-10-21, on `36c75e4` (7.56a) and the rule. Tools: `tools/diag/landingProbe.ts`,
`tools/diag/lakeTargets.ts` (the test's case), `tools/diag/islandArmies.ts` (its mirror of
`planLanding` reads the waters' key too; 60 days of each of the 48 saves, `b/island_y*.json`).
Sum: `node docs/evidence/7.49/f/sum.mjs docs/evidence/7.56/b` (before: `docs/evidence/7.54/b`).

## 1. The rule

The landing's target is the nearest enemy port (straight km) whose zone is open, not held by an
enemy, and has the transports' key of `waterKeys(world, n)`: the waters a ship of n sails between
(not a lake across land, not behind a passage shut to n), as `orderSail` routes. Before, 1129's
Britain at Adana aimed at Baku and Türkmenbaşy on the Caspian, `tryLanding` refused (`NoSeaWay`) and
the plan returned, every invasion day (a.md §4). Test: `landingOverSea1938.test.ts` (Britain at war
with the Soviet Union, its transports at Manama, whose nearest Soviet ports are on the Caspian: red
without, a division boards with).

## 2. 7.56's AT (the two cases board within 60 days of their save)

| case | before (7.54b) | after 7.56a + b |
| --- | --- | --- |
| 1129 y20 Britain | 0 boarded (335 re-ordered on day 35; then the Caspian target) | **1** |
| 8693 y10 Germany | 0 | **0** |

2 of 2: **missed**. 8693's cause is a.md §2: on day 10 183 of Germany's 190 formations on that land are
on the operational AI's marches; the 7 free stand 58–109 days of desert from every German port
(Antalya the quickest for each). No rule of the landing's routing reaches it.

## 3. The 48 saves, 60 days

| | 7.54b | after |
| --- | --- | --- |
| on `send` 30+ of 60 days, none boarded, year 10 | 3 (8011 GER, 8167 LIT, 8693 GER) | 3 (the same) |
| the same, year 20 | 4 (1129 ENG, 5683 JAP, 6421 AST, 7247 GER) | 3 (1129 ENG off) |
| total (7.54's bar 5) | 7 | **6** |
| boarded by the watched nations | 5 / 1 | 5 / 2 |
| island share after 60 days | 21.8 % / 29.5 % | 21.8 % / 29.5 % |

## 4. The guard

`npm run sim -- --load critic/c11_seed1129_y20.bin --years 1 --profile --affinity 0xFFFF`: the invasion
AI's longest call 23.0 ms (guard 50; 39.1 on 7.54b's code in the same run, a.md's `profile_1129_head.log`),
mean 0.026 ms a tick. Pin unchanged (63d0cfd9): seed 99's year has no such target.

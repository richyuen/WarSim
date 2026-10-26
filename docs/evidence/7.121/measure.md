# PLAN 7.121: the late air war — measured on HEAD

2026-10-26, HEAD `83ecc245` (sim code of `c95202e7`, pin 3a90f72d). Seeds 1066–1070 (measure seeds of 7.118).
Tools: `airWar.ts` and `airForce.ts` (20 years from 1938), new `airStuck.ts` (from a save or 1938: each day at
01:00, every wing of an AI nation at war whose role rebases — patrol, front, naval — with no mission, by why).

## 1. Year 1 against years 2–20 (`airWar.ts`, `airForce.ts`, means a world)

| | year 1 | late | late ÷ year 1 |
|---|---|---|---|
| air battles a year | 2,848 | 189 | 0.07 |
| sorties aloft an hour | 54.9 | 15.2 | 0.28 |
| wings | 155 | 89 | 0.57 |
| wings of nations at war | 106 | 63 | 0.60 |
| wings with a mission | 54.6 | 15.2 | 0.28 |
| wings with an enemy land formation in range | 59.3 | 17.0 | 0.29 |
| of those, tasked | 0.89 | 0.84 | — |
| land formations in contact | 46.2 | 4.6 | 0.10 |
| wars | 7.6 | 7.8 | 1.03 |
| wings built a year / lost a year | 20 / 114 | 11 / 12 | — |

Wings at war with an enemy in reach are tasked as in year 1; the fall is the wings with an enemy in reach.

## 2. Why a wing at war has nothing in reach (`airStuck.ts`, 5 worlds × 120 days)

Wing-days of rebasing roles at war, of AI nations:

| | from 1938 | from year 20 |
|---|---|---|
| all | 57,194 | 35,982 |
| with a mission | 36,698 (64 %) | 6,162 (17 %) |
| no mission, an enemy formation in range all the same | 370 | 88 |
| a hop (a base of its side with room, a ferry flight off, nearer the nearest enemy) | 894 | 6,315 |
| no hop, a chain of ferry flights reaches a base in range | 168 | 594 |
| **no chain of its side's bases reaches the enemy** (`island`) | 14,618 (26 %) | **22,442 (62 %)** |
| the enemy has no land formation | 4,446 | 381 |

Its side's bases are its bloc's and its co-belligerents' (`ofSide`). Late, most wings at war fight an enemy no
chain of their side's airbases reaches: wars across the oceans (the United States' wings: 1,182–1,797 of a
world's 120 days in the `hop` bucket alone, the hop to its coast). The air war late follows the wars a land air
force can reach and the land contact (0.10 ×, ADR-702 d), and the wings (0.57 ×).

## 3. Reading

No rule tried. The AI's tasking holds; what is missing late is an enemy in reach. A remedy is a new mechanic
(wings carried or ferried over the sea to a base of their side in reach) or a war choice weighing the air
force's reach (which, like ADR-706's naval rival, would move the war, not add to it).

# PLAN 7.26a: why the air war falls after year 1 (measured 2026-10-18 at `514341f`)

`npx tsx tools/diag/airWar.ts <seed> 6` on seeds 2843 and 7919 (two of the critic's run-8 seeds).
Means over each year's days (a day's count at its end); `aloft` is the critic's `meanSortiesAloft`
(`world.sorties.size` an hour).

| seed | year | aloft | wars | in contact | wings | at war | with a mission | out of range | in range, none | no enemy | out of range: no base near / full / free | free within a ferry | goal reachable | ranges off (median) | hollow |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2843 | 1 | 56.7 | 6.1 | 30.2 | 168.8 | 100.3 | 56 | 33.3 | 10.9 | 0 | 18 / 23 / 59 | 13 | 51 | 1.5 | 3 |
| 2843 | 2 | 19.5 | 7.9 | 2.8 | 150.6 | 104.3 | 19.4 | 78.2 | 4.7 | 1.9 | 30 / 11 / 59 | 6 | 26 | 1.8 | 5.8 |
| 2843 | 3 | 16.6 | 5.2 | 0.7 | 149.9 | 92.6 | 16.4 | 69.7 | 3.8 | 2.7 | 51 / 4 / 45 | 8 | 13 | 2.1 | 7 |
| 2843 | 4 | 12.4 | 6.1 | 1.2 | 142.4 | 92.6 | 12.3 | 78.6 | 1.4 | 0.3 | 86 / 3 / 12 | 3 | 7 | 2.7 | 8.9 |
| 2843 | 5 | 25.2 | 6.3 | 1.3 | 138.6 | 82.6 | 25.2 | 49 | 7.2 | 1.2 | 52 / 8 / 40 | 7 | 24 | 2.3 | 12.9 |
| 2843 | 6 | 17.1 | 4 | 2.5 | 135.4 | 70.5 | 17 | 47.3 | 5.9 | 0.3 | 39 / 7 / 54 | 8 | 22 | 2.7 | 15.5 |
| 7919 | 1 | 54.5 | 7.2 | 33.5 | 166.8 | 107.3 | 54 | 41 | 12.2 | 0 | 24 / 10 / 66 | 9 | 33 | 1.9 | 3.4 |
| 7919 | 2 | 27.9 | 8 | 6.2 | 130.6 | 88 | 27.8 | 49.7 | 10.3 | 0.2 | 31 / 4 / 65 | 8 | 36 | 2.4 | 2 |
| 7919 | 3 | 12.8 | 6.5 | 2.4 | 128.9 | 75.1 | 12.8 | 43.7 | 5.7 | 12.9 | 49 / 7 / 44 | 5 | 35 | 3.4 | 2.3 |
| 7919 | 4 | 16.2 | 5.9 | 1.3 | 132.1 | 69 | 16.2 | 43.9 | 3.7 | 5.3 | 24 / 1 / 76 | 21 | 13 | 1.7 | 2.8 |
| 7919 | 5 | 15.5 | 7.5 | 1.1 | 129.7 | 71.3 | 15.5 | 51.6 | 3.9 | 0.3 | 37 / 2 / 61 | 11 | 15 | 1.7 | 6.4 |
| 7919 | 6 | 14.6 | 7.6 | 1.4 | 129.8 | 62.7 | 14.5 | 31.9 | 4.7 | 11.5 | 53 / 1 / 46 | 8 | 14 | 2.1 | 3.6 |

Columns: *out of range*, a wing of a nation at war with no mission and every enemy land formation
beyond its range of its base; the split of those (sampled weekly, per cent): no airbase of its side
within its range of any enemy land formation / such bases, all full for it / one with room. *Free
within a ferry*: such a base with room within `FERRY_RANGE` ranges of its base. *Goal reachable*:
the formation `toward` aims at (the enemy's nearest the base) is within range of an airbase of its
side. *Hollow*: wings under a quarter of their aircraft.

## What it says

- **The force is there.** Wings hold at 130 to 170, under 10 % of them hollow; 63 to 104 are of
  nations at war in every year. The sortie count follows the wings with a mission one for one.
- **The wings at war sit out of range.** From year 2, 32 to 79 of them have every enemy land
  formation beyond their range, against 33 to 41 in year 1. The land war's contact falls with it:
  formations in contact 30 to 34 in year 1, 0.7 to 6 after, while 4 to 8 wars run.
- **The rebase does not bring them in.** For 40 to 76 % of them (12 % in one year) an airbase of
  their side with room lies within range of some enemy formation, but `toward` aims at the enemy
  formation nearest their base, and that one is within range of no airbase of their side for 64
  to 93 % of them (an enemy across the sea, or beyond the side's bases): the hop that goes nearer
  it stops at the coast or the last base. Only 3 to 21 % have a free base near an enemy within one
  ferry flight.
- **Not the lever:** the aircraft (hollow wings few), the bases' room (full for 1 to 23 %), the
  enemy gone (no enemy land formation: 0 to 13 wings).
- **Left out by any rebase:** 24 to 86 % have no base of their side near any enemy at all (wars
  across the sea): those are the land war's and the navy's to bring in reach.

## Next (PLAN 7.26b)

`toward`'s goal: the enemy formation nearest the base among those within range of an airbase of
the side with room for the wing, not the nearest of all; measured again with this tool.

# PLAN 7.26c2: land that nobody holds, measured (2026-10-18)

Code: `8399bd9` (after 7.26c1a) for the "before", the working tree of 7.26c2a for the "after".
Tools: `tools/diag/landWar.ts` (8 years, seeds 2843 and 7919), and probes in `.cache/tmp/`
(`c2probe.ts`: a war's armed side's formations day by day; `abOne.ts`: from one saved state, each
war with one side without a land formation for 30 days or more, and the armed side's score).

## 1. The wars of the plan's text are gone

The plan named seed 2843's Yemen against Saudi Arabia (day 2136 on) and seed 7919's Iraq against
Saudi Arabia (day 647 on). Since 7.26c1a (pin 00121505) the histories differ: 2843 has no war
between Yemen and Saudi Arabia, and Iraq's war with Saudi Arabia comes on day 752. The wars with
one side with no land formation in half of the weekly samples or more, `landWar.ts` on `8399bd9`:
15 ended on seed 2843 and 14 on seed 7919, 3 and 4 of them at a score under 15 for the armed side.
Two of those are the specimens here.

## 2. Seed 7919, Brazil against Paraguay (war 71, day 1310 to 2030, score 0 all through)

Brazil's land formations on day 1432 (`c2probe.ts`, from a state of day 1312):

| formation | men | where |
|---|---|---|
| #1016, #1019, #1020, #1022 | 707, 199, 167, 130 | on Brazil's cells beside Paraguay's, `moving` to a Paraguayan cell one away, path step 0 for 150 days and more |
| #937 | 12,460 | standing on Brazil's land, 69 cells from the nearest sector centre (the range is 60) |
| #313 | 2,711 | standing, 124 cells away, on ground of another class (it reaches no sector) |

- The four small ones never take a cell: the hold progress (`cells.flip`) of their target cells
  stays 0. A cell flips when the attacker's pressure over the terrain's defence beats the defender's
  bloc pressure plus `GARRISON` (1). A formation's pressure is men / 1000 × (0.5 + 0.5 supply) ×
  (1 − d / (R + 1)), R = 2: from the cell beside its target 707 men give 0.47, over marsh's 1.3
  0.36, under 1. Together, 0.6. They stand there for the rest of the war.
- The division that could take the ground is not sent. The planner's debug (day 1439, #937's day in
  `MARCH_DAYS`): five sectors; #937's class reaches three; those three are not "nobody's" (the
  marches from afar, ADR-190) because the small ones stand in them and march into them. The two
  sectors with nobody are of ground #937's class does not reach. So `far` = [313, 937] and no order.

**Cause:** a formation too small to take a cell mans a sector for the marches from afar.

## 3. Seed 2843, Iraq against Saudi Arabia (war 51, day 752 to 972, score 0 to 2)

Iraq's two formations (3,169 and 874 men) march south and take 30 Saudi cells by day 815. Then
the war of Britain's coalition against Saudi Arabia (war 53, 757 to 890) takes the Saudi land
between them: from day 845 Iraq's formations stand 9 to 17 cells from the nearest Saudi cell, with
no front (`frontless` 136 days in `landWar.ts`). Not land that nobody holds: a third party's
conquest ends the front (ADR-480 ends such a war after 365 days, and a peace of the other war came
first). Nothing for c2.

Seed 7919's nation #112 against Saudi Arabia (from the day-900 state, 281 days at score 0): four
full divisions (10,341 to 12,436 men) standing 27 to 37 cells from Saudi land. #112 touches only
#111, Turkey and Iraq: no front at all (`warsWithFront` false). A landing case (c3), not c2.

## 4. The fix (7.26c2a, ADR-510) and its measure

A formation of no more than `takeMen` (1,500 men at the default map size: from the cell beside it,
at full supply, its pressure beats `GARRISON` on plains) does not man a sector for the marches from
afar: neither standing in or beside it, nor marching into it, nor allotted to it; nor, for a
partner's sector, standing there.

From one saved state each, 365 days, old rule against new (`abOne.ts`): the wars one-sided for 30
days or more and the armed side's score at the end.

| state | old | new |
|---|---|---|
| 7919 day 1312 | Brazil v Paraguay 0 (open, 365 days); 8 others 64 to 100 | Brazil v Paraguay **35** (open); the 8 others the same |
| 7919 day 900 | 4 wars, mean 48.5 | the same 4, mean 48.8 |
| 2843 day 900 | 5 wars, mean 42.0 | 4 wars, mean 53.3 (one, Germany's v Switzerland and Denmark at 3, not one-sided 30 days) |
| 2843 day 400 | 2 wars | 1 war (the other not one-sided 30 days) |

In the run from day 1312, #937 sets out on its day (1432) and takes its first Paraguayan cells on
day 1515 (90 days across the marsh).

`landWar.ts` 8 years after (the histories part at once): one-sided wars ended 15 → 9 (2843) and
14 → 17 (7919), the armed side's mean score 60 → 65 and 58 → 50, under 15: 3 → 2 and 4 → 5. The
big wars' contact share by year: 2843 0.50/0.29/0.12/0.27/0.14/0.23/0.10/0.16 →
0.47/0.36/0.07/0.27/0.11/0.11/0.03/0.21; 7919 0.43/0.22/0.23/0.12/0.13/0.15/0.35/0.10 →
0.43/0.22/0.04/0.28/0.14/0.12/0.12/0.19. Within the chaos of two different histories: the
multi-year runs say nothing either way, the A/B from one state is the measure.

## 5. What is left (7.26c2b)

The after-run's one-sided wars at a score under 15 (`landWar.ts`):
- 2843: Brazil v Bolivia (war 87, 177 days, 0): Brazil's whole army is under `takeMen` (2,617 the
  largest; 38 to 1,346 the others) and is spent against Britain in Guiana; a formation of 612 men
  stands on Brazil's own land for 170 days and is not refilled. Bulgaria v Romania (12).
- 7919: Saudi Arabia v Yemen (one formation, 0, 32 days); Germany's bloc v Luxembourg, Portugal,
  Angola, Mozambique (0) and v Denmark (2); Japan's bloc v Saudi Arabia (0, frontless 50 days).

Their causes are another rule's: a whole army too small to take a cell (and not refilled), and
fronts across the sea. PLAN 7.26c2b measures the first before any change.

## 6. Cost

The operational AI from the same states, 60 days: no change where the rule sends nothing (2843 day
900: 937 → 902 ms, the same 1,063 orders); +36 % from 7919 day 900 (643 → 875 ms), with 61 more
orders, each a long march to search (675 → 736). Seed 99 five years, both rules run at once on
separate cores and swapped: 2.0910 / 2.1639 ms a tick (old) and 1.9834 / 2.0084 (new).

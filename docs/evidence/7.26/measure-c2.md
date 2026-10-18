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

## 7. PLAN 7.26c2b: a whole army under `takeMen`, measured (2026-10-18)

Code: `1abddbc` (after 7.26c2a, pin 59fea6f5). Probes in `.cache/tmp/`: `c2b.ts` (from a state of a
given day: monthly, just before the month's AI, the armed side's gold, reserve, income, balance,
pool, army upkeep and cap, orders in training, and each land formation's refill gate, `refillable`'s
first failing test or `ok`; after the month's step what each was refilled by; every 10 days each
land formation's place and state) and `c2bstuck.ts` (one formation's path and the ground round it).

The one-sided wars at a score under 15 in `landWar.ts` after 7.26c2a (§5): seed 2843's Brazil v
Bolivia (war 87) and Bulgaria v Romania (war 90). Seed 7919's are not probed: Saudi Arabia v Yemen
(one Saudi formation, 32 days); across the sea (c3's), Portugal, Angola and Mozambique (with
Luxembourg, Germany's bloc of 28 formations), Japan's bloc v Saudi Arabia (50 days frontless) and
the United States v Cuba, Siam and Burma (124 formations, a front of 3 cells). Germany's bloc v
Denmark (29 formations, a front of 12 cells, 61 days, score 2) and v Luxembourg (49 days, score 0)
are land fronts that a bloc of full divisions did not take, both ended exhausted while its war on
Romania ran: not an army too small, and their cause is not probed.

### Brazil v Bolivia (seed 2843, day 1660 to 1837, score 0 throughout)

| day | Brazil's land formations (men) | gold / reserve + a division (1,001) | pool | refilled |
|---|---|---|---|---|
| 1655 | 2,617, 1,346, 263, 243, 38, 612 | — | 1.21 M | — |
| 1673 | the same; 2,617 marches on British Guiana | 1,094 / 1,361 | 1.21 M | none |
| 1704 | 324 (supply 0), 110, 38, 612 | 1,118 / 1,350 | 1.21 M | none |
| 1765 | 47, 38, 612 | 1,173 / 1,344 | 1.21 M | none |
| 1826 | 38, 612 | 1,230 / 1,343 | 1.21 M | none |

- **The army went to the other war.** Brazil is at war with Britain too: on day 1665 four of its six
  formations march on British Guiana, and in 30 days 2,617 + 1,346 + 263 + 243 men are down to
  324 + 110. The 2,617-man division is encircled by day 1690 (every cell in two round it British or Venezuelan),
  at supply 0. Its march may not enter an enemy's cell before it flips (PLAN 1.14), and it cannot
  flip one, so it stands on cell 661,561 with `moving` 1 and path step 0 for 130 days, re-ordered
  to targets beyond the ring, until it is gone (by day 1825). A pocket, not a mover that fails.
- **What is left takes nothing.** 38 men walk to Bolivia's border and stand at a Bolivian cell from
  day 1745 to the war's end (pressure far under `GARRISON`); 612 men rest on Brazil's land for the
  whole war, never ordered; why is not probed (at 612 men it could flip no cell, as the 38 at
  the border show). Bolivia's land falls 1,844 → 1,360 cells to Argentina's war (91, from day 1733), not Brazil's.
- **No man is refilled in six months, and no division ordered.** The 612 and the 38 pass every test
  of `refillable` (on their own land, supply 1, not engaged) each month. Brazil's books: income 114
  to 120, balance +30 to +54 a month, army upkeep 0.3 to 2.1 against a war cap of 68 to 72, no
  order in training, one slot. So ADR-437 applies: the refills keep the next order's price, an
  infantry division's 1,001 gold, over the reserve of three months' income (343 to 360). Gold
  1,094 to 1,262 against 1,343 to 1,361: the refills' room by gold is negative every month, and the
  division's order fails the same gate (`gold < price + reserve`). The treasury gains about 28 a
  month (research takes the rest of the balance), so the division comes about nine months after
  the war began; the war ends exhausted at day 1837 before it. The pool, 1.21 M men, is untouched.

### Bulgaria v Romania (seed 2843, day 1703 to 1756, score 12, ended exhausted)

Six formations of 348 to 4,147 men (four over `takeMen`), all at supply 1 on Bulgaria's land when
the war begins; they march on Romania's border and take cells (Romania 788 → 721, score 0 → 12 in
46 days). The same gate: gold 957 to 1,048 against 1,001 + 226, no order in training: no man
refilled, no division ordered, while the formations stand at 3 to 33 % of their template's 12,460.
Not an army under `takeMen`: slow, short of men, and ended by exhaustion in 53 days.

### What it says

The task's case, a nation whose whole army is under `takeMen` and not refilled, is one of ADR-437's
`keep`: a nation of an income near 100 saves for a division for most of a year, refills nothing in
that time, and its army stands at a fraction of its strength through a war of six months. The
rule is as ADR-437 decided it (no defect). Whether to change it (refills at war not held for the next
order, or the keep only while the order is within a few months' saving) waits on the 7.26 AT
(7.26d): the c-parts are fixed only if it is still short. The encircled division is a pocket, as it
should be: Brazil's loss was a war it chose against Britain.

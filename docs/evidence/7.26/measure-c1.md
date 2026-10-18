# PLAN 7.26c1: where the big wars' armies march (measured 2026-10-18 at `b46cde0`)

Tools: `npx tsx tools/diag/landWar.ts <seed> 8` (its new column `bigWarContactShare`: of the wars with
a weekly sample of a side of 50 or more land formations, contact days ÷ front days, by year: the AT's
measure); `npx tsx tools/diag/marches.ts <seed> <state | day> <days>` (new). Seeds 2843 and 7919.
A cell of this map is 18.9 km; a sector (`SECTOR_CELLS`) 76 km; the allotment's range
(`DEPLOY_RANGE_CELLS`) 1,134 km.

## 1. The AT's measure before (HEAD, `landWar.ts`, 8 years)

| seed | year 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 2843 | 0.401 | 0.274 | 0.067 | 0.007 | 0.041 | 0.278 | 0.064 | 0.108 |
| 7919 | 0.477 | 0.157 | 0.103 | 0.051 | 0.141 | 0.166 | 0.062 | 0.056 |

## 2. Day 900, 60 days (`marches.ts` from a state saved at HEAD)

- Seed 2843, Italy's bloc against France's (war 42): Italy, Germany, Japan, Albania hold 164 land
  formations; 103 a day are moving, 97 % of them to a sector with no enemy in its 3 × 3 buckets,
  a median 1,550 km to go along the path, 28 days on the march (p90 49). The front: 1,112 cells,
  Italy's conquered Africa against French and British colonies. Of France's side's 50 formations,
  38 stand still a median 2,870 km from the front (India 14, Australia 5, the Indies 4, Indochina
  3); 13 weak ones are in Africa. The enemy's men within 1.5 sectors of the front: 19,000 of 295,000.
  Germany's 86 stand in Europe and march to North Africa; 134 of its attack orders were refused at
  about 1,100 km in 60 days (a temporary order log, not kept).
- Seed 7919, the Soviet Union against France's bloc (war 45): 180 Soviet formations against India's
  front in the Himalaya; India has 8 there, the rest of the coalition overseas or in Africa.
- Marches end on their target (90–100 %), seldom engaged (0–3 %). Few new orders: Italy gave 18 in
  60 days, its army on marches kept from long before (ADR-53).

## 3. Years 2–5 (`marches.ts 2843|7919 365 1460`, weekly samples of the big wars with a front)

| seed | year | enemy men within 1.5 sectors of the front | enemy men within the range | big side's men within the range |
|---|---|---|---|---|
| 2843 | 2 | 10.4 % | 42.2 % | 40.5 % |
| 2843 | 3 | 7.7 % | 39.6 % | 39.9 % |
| 2843 | 4 | 2.3 % | 19.5 % | 24.6 % |
| 2843 | 5 | 0.9 % | 21.7 % | 19.1 % |
| 7919 | 2 | 5.9 % | 22.5 % | 25.4 % |
| 7919 | 3 | 3.6 % | 15.8 % | 20.5 % |
| 7919 | 4 | 7.8 % | 21.5 % | 18.5 % |
| 7919 | 5 | 7.5 % | 22.4 % | 22.7 % |

Moving formations of the big sides: 52 % and 62 % of them; of those, 95 % and 96 % to sectors with
no enemy. Both sides keep 58 to 84 % of their men beyond the range of the war's front, where the
allotment does not reach.

Those beyond the range, by whether their nation holds a cell of this front, and what they do
(share of the side's men, all weekly samples of years 2–5):

| seed | side | no own front, standing | no own front, moving | own front, standing | own front, moving |
|---|---|---|---|---|---|
| 2843 | big side | 31.3 % | 10.9 % | 12.7 % | 13.2 % |
| 2843 | enemy | 31.6 % | 13.3 % | 9.9 % | 13.0 % |
| 7919 | big side | 22.1 % | 6.8 % | 8.9 % | 40.2 % |
| 7919 | enemy | 16.8 % | 10.5 % | 20.6 % | 31.0 % |

Engaged beyond the range: 0.0–0.1 %.

## 4. Tried and dropped: the allotment's weight

A pull on each sector by the enemy's men within 30 cells (to the nearest sector, less with the
distance), and the "one a sector" floor not taking a sector below its weight: from the day-900
states, 150 days, the big wars' contact share 2.6 → 2.4 % (seed 2843) and 19.6 → 19.3 % (7919).
Within the range the allotment is not what keeps the armies apart; reverted.

## Reading

The armies are not misallotted on the front; most of them are not on it. A nation with no front
cell of its own in a war (a partner: Germany and Japan on Italy's side, Australia, the Indies,
Canada on France's) never sends a formation that stands beyond the range: `operationalAi`'s
marches from afar and to spare go only to sectors of the planner's own front (`ownFront`, `s.own`,
ADR-190 and 191). That is 17 to 32 % of each side's men, standing. A nation with a front of its own
sends one formation a sector on its day in `MARCH_DAYS` (9 to 21 % standing). Taken first: the
partner's gate.

## 5. After PLAN 7.26c1a (ADR-509, at `0d3409c`): the same split, years 2–5

| seed | rule | big side: no own front, standing | no own front, moving | own front, standing | big side's men within the range | enemy: no own front, standing |
|---|---|---|---|---|---|---|
| 2843 | before | 31.3 % | 10.9 % | 12.7 % | 31.8 % | 31.6 % |
| 2843 | after | 9.3 % | 15.0 % | 16.0 % | 43.3 % | 8.5 % |
| 7919 | before | 22.1 % | 6.8 % | 8.9 % | 21.9 % | 16.8 % |
| 7919 | after | 8.2 % | 1.5 % | 16.3 % | 27.0 % | 25.8 % |

(Shares of all weekly samples' men; the wars themselves differ between the runs.) The partners'
garrisons now go: their men standing beyond the range fall to a third or less, and more of the big
side stands within the range of its front. The contact share moves less (ADR-509's Measured) because
the enemy is seldom on that front (section 3): what is left is the empty land (c2) and the own
front's far marches (c1b, 16 % of the men standing beyond the range).

## 6. PLAN 7.26c1b: why the own front's far formations stand (at `e92c622`, before ADR-513)

Probe (uncommitted, in `planNation`'s marches from afar; `.cache/tmp/c1bprobe.ts`) on the six states
of `measure-c4.md` (seeds 2843 days 760, 1100, 2450; 7919 days 560, 1100, 2450), 90 days each: of a
planner with a front cell of its own, each formation in `far` (beyond the range of every sector it
reaches, standing, its day in `MARCH_DAYS`) on each plan, weighed by its men, by what the rule finds
for it. 44.9 M man-plans in all.

| what the formation finds | share of the men | who |
|---|---|---|
| an own sector with nobody it reaches on its landmass (sent, or a nearer one took the sector) | 14 % | the Soviet Union, Germany |
| own sectors with nobody, none it reaches: across the sea (another landmass) | 16 % | Japan, Britain, France, the Indies |
| the same, on its landmass but not reached: another group of provinces (closed ground or the sea between: Soviet troops in Greece, the front in Libya; Italy to Ethiopia; the Raj) 20 %, a pocket of open ground 1.5 %, not split on two states 2.5 % | 24 % | Italy, the Soviet Union, the Raj, Britain |
| no own sector with nobody; a partner's with nobody of the side, on its landmass, that it reaches | 11 % | Germany (46 % of its at day 1100), the Soviet Union (24 % at 7919's day 1100) |
| no own sector with nobody; a partner's elsewhere | 1.5 % | |
| no sector with nobody at all | 33 % | the Soviet Union, the United States |

Of the last row, the sectors it reaches are nearly all strong enough to attack (allotted strength at
least `OFFENSIVE_RATIO` × threat in every one: 11.9 M of the row's 14.9 M man-plans, 80 %; one or
more too weak 11 %; none reached on its landmass 9 %): the front is held where the enemy is not, and men sent there would
stand at a quiet front. The plan's "one a sector a week" is the first row's competition only (and
refused ways: 7919's day 2450 had 82 of 131 far orders refused).

The rule with a mechanism the operational AI has is the partners' row (ADR-509 left a planner with
a front of its own out). The sea and the closed ground (40 %) want a lift by sea to the own front:
the invasion AI's (PLAN 7.26c3b, 7.26e).

### After ADR-513 (the same six states, 180 days, old → new)

| state | big-war contact share | sorties aloft | far marches to own / partners' sectors (new) |
|---|---|---|---|
| 2843 d760 | 3.9 → 4.0 % | 22.9 → 22.8 | 98 / 11 |
| 2843 d1100 | 17.8 → 17.6 % | 28.4 → 28.1 | 186 / 54 |
| 2843 d2450 | 21.0 → 21.7 % | 15.7 → 16.3 | 84 / 48 |
| 7919 d560 | 6.4 → 6.4 % (the same hash) | 12.2 → 12.2 | 256 / 0 |
| 7919 d1100 | 6.5 → 6.6 % | 9.4 → 9.7 | 66 / 9 |
| 7919 d2450 | 5.9 → 5.9 % | 15.4 → 15.4 | 192 / 8 |

The rule fires (130 marches to partners' sectors, 115 of them given) and moves the contact share by
less than a point: as section 3 found, the enemy is seldom on that front either.

# PLAN 7.35d: why the sea battles fall after year 1, measured

The critic (run 9, at `f0be88c`, `critic/c9_headless_*.json`): on its 14 headless seeds, 36.1
`SeaBattle` rows in year 1 against 13.1 a world-year in years 2 to 30 (median 2; the mean carried by
a few years of hundreds, the phantom battles of R9-B1, PLAN 7.31).

## 1. Before (7.35d1, at `10aecbe`)

`npx tsx tools/diag/seaYears.ts <seed> 30` on the critic's 14 seeds (1129, 1471, 2251, 2609, 3407,
3793, 4483, 4957, 5527, 6113, 6653, 7741, 8821, 9901), 30 years each from 1938 with no command; the
runs' JSON in `d1/before_<seed>.json`. Per year: the sea battles ended (all; those that sank a ship;
the ships sunk; the pairs with most), and each day at 01:00 the armed fleets (`fleetPower` > 0),
their power, the nations with one, the pairs at war, the pairs at war with an armed fleet each in
one basin (`basinAt`; "sea pairs"), those fleets and how many are under way. Daily figures are
means over the year.

| all 14 seeds, mean (median) | year 1 | years 2–30 | 2–5 | 6–10 | 11–30 |
| --- | --- | --- | --- | --- | --- |
| sea battles | 20 (22) | 1.9 (1) | 3.3 | 2.4 | 1.4 |
| that sank a ship | 19.4 (22) | 1.7 (1) | 3.1 | 2.3 | 1.3 |
| ships sunk | 193 (207) | 24.8 (12) | 42.1 | 28.6 | 20.3 |
| armed fleets | 106.8 | 99.6 | 96.5 | 97.2 | 100.8 |
| their power (hp) | 325,000 | 296,800 | 294,100 | 283,300 | 300,800 |
| nations with a navy | 19.3 | 17.3 | 16.3 | 17.5 | 17.5 |
| pairs at war | 172 | 214 | 306 | 284 | 178 |
| sea pairs | 9.1 | 7.7 | 9.9 | 9.4 | 6.8 |
| their fleets | 45.3 | 43.0 | 56.4 | 52.7 | 37.9 |
| their fleets' power (hp) | 139,100 | 129,600 | 173,800 | 160,700 | 113,000 |
| their fleets under way | 2.1 | 0.5 | 0.7 | 0.7 | 0.4 |

Per seed (sea battles; the critic's in its runs at `f0be88c`):

| seed | year 1 | sank a ship | years 2–30, mean | sank a ship | late years with none sinking (of 29) | critic year 1 | critic 2–30 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1129 | 23 | 22 | 1.6 | 1.6 | 11 | 68 | 64.5 |
| 1471 | 17 | 17 | 1.8 | 1.7 | 11 | 56 | 25 |
| 2251 | 31 | 28 | 1.5 | 1.4 | 11 | 122 | 1.4 |
| 2609 | 22 | 22 | 1.7 | 1.6 | 10 | 20 | 15.1 |
| 3407 | 6 | 6 | 2.2 | 2.2 | 6 | 9 | 2.7 |
| 3793 | 19 | 19 | 1.2 | 1.2 | 12 | 16 | 11.8 |
| 4483 | 26 | 26 | 4.1 | 3.0 | 5 | 36 | 3.8 |
| 4957 | 24 | 24 | 1.8 | 1.8 | 9 | 30 | 6.5 |
| 5527 | 16 | 14 | 2.0 | 1.9 | 10 | 22 | 4.6 |
| 6113 | 13 | 11 | 1.0 | 1.0 | 14 | 18 | 29.3 |
| 6653 | 29 | 29 | 2.1 | 2.1 | 9 | 43 | 11.6 |
| 7741 | 19 | 19 | 1.6 | 1.5 | 13 | 25 | 1.6 |
| 8821 | 6 | 6 | 1.9 | 1.9 | 9 | 16 | 2.3 |
| 9901 | 29 | 29 | 1.6 | 1.6 | 11 | 24 | 2.6 |

## 2. What it says

- **No phantoms left.** 97 % of year 1's battles and 89 % of the later ones sink a ship (the
  critic's late figure was mostly battles that sank nothing: R9-B1, fixed by PLAN 7.31). No late
  year has 50 battles or more (the critic's had 373, 294, 509). So the critic's 36 → 13 is now
  20 → 1.9: the fall is steeper, not gone.
- **Not the navies gone.** After year 1 the armed fleets keep 93 % of their number and 91 % of
  their power; the nations with a navy 19.3 → 17.3.
- **Not the wars.** Pairs at war rise (172 → 214). Pairs at war with a navy each in one basin hold
  (9.1 → 7.7 a day; 9.9 in years 2–5), with about as many fleets (45 → 43) and power. 362 of the
  406 late seed-years have such a pair on an average day; 123 of those see no battle that sinks a
  ship.
- **The navies at war stand in port.** Of the sea pairs' fleets, 4.6 % are under way on a day in
  year 1, 1.2 % after (2.1 → 0.5 fleets); battles that sink a ship per sea pair-year 2.1 → 0.2.
  Years 2–5 have more sea pairs and power than year 1 and a third of its fleets under way.

The fall is the third case: navies at war in one basin that do not sail. Which test of the naval
AI's `plan` holds them (no enemy port within `SORTIE_KM`, no forward base, the enemy's power in the
target's zone, the enemy's naval bombers over it, a fleet's own state) is PLAN 7.35d2's measure,
with the three holes 7.35b4 left (a line across land, a sortie's target in another basin, a
partner's port held by the enemy).

## 3. Which test holds them (7.35d2a, at `ac245c4`)

`npx tsx tools/diag/seaHold.ts <seed> 6` on the same 14 seeds, 6 years each; JSON in
`d2/hold_<seed>.json`. On each nation's naval AI day, read just before its tick, each of its warfleets
is put under the one test of `plan` that decides it (the tests read through `plan`'s exported parts).
Counted in fleet-days of nations at war; `sea` is a fleet whose nation is at war with a nation that
has an armed fleet in its basin (§1's sea pairs). The reads are checked against the tick: of the
fleets read as ordered, 3,275 of 3,284 in year 1 and 7,268 of 7,269 after are under way or refused
after it; of those read as held, 100 of 41,968 and 57 of 235,275 are under way.

| `sea` fleet-days | year 1 | years 2–6 |
| --- | --- | --- |
| all | 32,778 | 209,736 |
| **away from its bloc's ports, not sent home** | **90.3 %** | **96.0 %** |
| at an enemy-held port's water (on station) | 71.6 % | 53.9 % |
| at a port of a nation at war with neither side (`awayNeutralPort`) | 6.9 % | 29.7 % |
| at a partner's port (on its side of a war, not its bloc) | 9.5 % | 10.3 % |
| in open water | 1.8 % | 1.7 % |
| at a partner's port the enemy holds (the third hole) | 0.3 % | 0.4 % |
| at its bloc's port: sortie to a port with enemy ships | 0.6 % | 0.1 % |
| at its bloc's port: sortie to an empty port | 5.6 % | 2.4 % |
| at its bloc's port: stage | 0.6 % | 0.2 % |
| at its bloc's port: held (enemy too strong, bombed, no base, no enemy port) | 0.1 % | 0.4 % |
| under way, in a battle, sent home, at its target | 2.9 % | 0.8 % |

- **`plan` gives a fleet away no new order.** A warfleet away from its bloc's ports is only sent home
  (the enemy over `AVOID_RATIO` times its power, or empty water under naval bombers); else it
  stands. A sortie ends at the target port's water, and the fleet stands there until peace: 96 % of
  the late fleet-days. The tests the plan line named (the enemy's power, the bombers, no forward
  base, no enemy port) hold 0.4 %. 7.35d1's "stand in port" was "not moving": they stand on station.
- **Stale stations.** 29.7 % of the late fleet-days stand at a port of a nation now at war with
  neither side: by the rule, a port it sailed to as an enemy's whose holder has made its peace
  since, the fleet's nation still at war with another (not traced fleet by fleet). 10.3 % at a
  partner's port.
- **What a sortie from where they stand would find** (the sortie test from the fleet's place, its
  own power alone; years 2–6, 201,387 away fleet-days): a winnable target with enemy ships 17,236
  (8.6 %), only empty enemy ports 145,431 (72.2 %), none in reach 38,720 (19.2 %). A re-target alone
  sends most fleets to empty ports.
- **Where the enemy's fleets are** (those away fleet-days with no battle to seek, the nearest enemy
  warfleet of the basin): beyond `SORTIE_KM` 129,949 (70 %); within it but at no port of an enemy of
  the fleet's, so no target of the sortie test, 46,480 (25 %); at an enemy port, too strong for the
  fleet alone, 6,656 (4 %); under way 1,066. The sortie seeks ports, not fleets: an enemy fleet on
  station at its partner's port or a neutral's is no target.
- **Empty over defended.** Of the late sorties to an empty port, 793 of 5,508 had a winnable port
  with enemy ships in reach too, farther (the nearest that passes is taken; year 1: 639 of 1,966).
- **The holes 7.35b4 left.** A sortie's or a stage's target in another basin than the fleet's: 1,811
  late orders, and 2,124 of the 7,269 late orders refused (`MoveRejected`, `NoSeaWay`): the fleet
  stands in port and is sent again each week (29 %; year 1: 100 of 3,284). A way over 1.5 times the
  straight line and over `SORTIE_KM` (the line across land): 435 of the late orders (6 %), year 1
  445. A partner's port the enemy holds: 0.4 % of the fleet-days.

Causes, by the orders they decide, each a part of 7.35d2: (b) a warfleet away from its ports at war
gets no new order: it stands on station for good, at a port whose holder made peace among them
(96 % of the fleet-days; a re-target from where it stands finds a battle in 8.6 %); (c) the sortie's targets are
enemy ports only, so the 25 % of enemy fleets standing in reach elsewhere are never sought; (d) a
sortie's target in another basin, refused by `orderSail` (29 % of the late orders). Left without a
rule (re-measured after d): the way across land (6 % of the orders), a partner's port held by the
enemy (0.4 % of the fleet-days), and the enemy beyond `SORTIE_KM` (70 %: the basin is the world's
ocean, the fleets far apart).

## 4. A new order for a warfleet away (7.35d2b, ADR-549)

**The trace first.** `seaHold`'s `neutralWas`, at `a08927f` (the rule not yet in; JSON in
`d2b/before_<seed>.json`, its other figures bit for bit §3's): of the late `awayNeutralPort`
fleet-days, 55,981 of 62,362 (89.8 %) stand at a port whose holder was at war with the fleet's
nation on some day read earlier in the run. These are stations whose war ended, not refuges chosen as such.

**The rule** (`awayOrder` in `src/sim/ai/naval.ts`). On its AI day a warfleet away from its bloc's
ports, not sent home and not escorting, takes, in order:
1. from a zone with no enemy ship, a winnable battle in reach;
2. else its station by an enemy port (the blockade);
3. else a new station at an enemy port a sortie may take;
4. else home.

`seaHold` reads it as `plan` does (`awayBattle`, `awayStation`, `awayBack`; a fleet that stands is
noted under its place). JSON in `d2b/after_<seed>.json`. The same 14 seeds × 6 years, years 2–6,
`sea` fleet-days:

| | before | after |
| --- | --- | --- |
| all | 209,736 | 115,987 |
| away from its bloc's ports | 201,664 (96.2 %) | 107,532 (92.7 %) |
| at an enemy-held port's water (on station) | 113,130 (53.9 %) | 98,429 (84.9 %) |
| at a partner's port the enemy holds | 742 (0.4 %) | 5,692 (4.9 %) |
| **at a port of a nation at war with neither side** | **62,362 (29.7 %)** | **0** |
| at a partner's port | 21,570 (10.3 %) | 0 |
| in open water | 3,583 (1.7 %) | 0 |
| ordered from away: a battle | — | 1,749 (1.5 %) |
| ordered from away: a new station | — | 798 (0.7 %) |
| ordered from away: home | — | 324 (0.3 %) |
| sent home (outgunned, bombed) | 277 | 540 |
| at its bloc's port: sortie (enemy ships / empty) | 170 / 5,106 | 190 / 5,749 |

- A fleet no longer stands where its war ended. Each fleet-day that stood at a neutral's or a
  partner's port, or in open water, is now ordered. Those fleets go on to an enemy port and stand
  there on station.
- The first version sought a battle from any zone. On seed 1129 five British fleets then hopped
  every week, from year 3, between ports of one zone 3 to 5 cells apart. Each port's zone had enemy
  ships, but a battle begins by sight, and they never met them. That version had 26,558 late orders,
  4.7 % of the fleet-days a "battle" (its JSON and the probe's log not kept; the figures as printed
  then); the rule as built has 16,372 orders in all. Of these, 249 send
  a fleet back to the target it had two orders before, counted over the whole run with no time
  window, so returns after the war has moved on are among them.
- The tool's reads agree with the tick on 16,346 of 16,372 orders (16 `awayBattle`, 8 `sortie`, 2
  others missed: the state moved within the tick before the AI read it), and 130 of 179,734 held
  fleets are under way after it.
- The `sea` fleet-days fell by 45 %, from 209,736 to 115,987: fewer fleets of the sea pairs on their
  days. A first read with `seaYears` on 4 of the seeds (1129, 2251, 3407, 6113) × 6 years, after
  the rule (`d2b/years/after_<seed>.json`), against §1's runs (`d1/before_<seed>.json`, years 1–6;
  no rule changed between them and `a08927f`). The four seeds summed, the fleets and power a day's
  mean averaged over them:

  | year | battles d1 → after | ships sunk | armed fleets | power | sea pairs a day |
  | --- | --- | --- | --- | --- | --- |
  | 1 | 73 → 99 | 712 → 1,025 | 109 → 104 | 328k → 316k | 6.6 → 4.9 |
  | 2 | 14 → 38 | 104 → 393 | 105 → 93 | 316k → 285k | 12.6 → 4.2 |
  | 3 | 16 → 35 | 209 → 485 | 104 → 84 | 315k → 259k | 9.3 → 3.6 |
  | 4 | 9 → 11 | 129 → 86 | 102 → 82 | 308k → 253k | 5.7 → 2.4 |
  | 5 | 4 → 12 | 28 → 296 | 98 → 82 | 294k → 249k | 5.6 → 1.2 |
  | 6 | 15 → 13 | 143 → 92 | 100 → 79 | 305k → 244k | 6.3 → 0.5 |

  The navies are sunk in the new battles: years 2–6 have 109 battles against 58 and 1,352 ships sunk
  against 613. By year 6 the four seeds keep 80 % of d1's armed power, but the pairs at war with a
  navy each in one basin fall to 0.5 a day against 6.3. The late war at sea burns out by years 5–6.
  That bears on 7.35d2c (fewer enemy fleets to seek late) and on 7.35d2d's 14 × 30 "after" run.
  On seed 99's first year the `SeaBattle` rows are 20 against 8.
- A partner's port the enemy holds rose from 0.4 % to 4.9 %. The fleets keep station there as at
  any enemy port (the third hole, re-measured after d).

## 5. The sortie seeks enemy warfleets (7.35d2c, ADR-550)

**The rule** (`standingWarfleets`, `plan` and `awayOrder` in `src/sim/ai/naval.ts`). Each standing
enemy warfleet (power over 0, not under way, not in a battle, on an open zone) within `SORTIE_KM`, in
the fleet's basin, whose zone's enemy power the fleet's warfleets there together can win, is a target
at its cell. From port it is taken when it is the nearest target. From away it is a battle from any
zone, and a fleet by one stays. It is no station and no reason to stand rather than stage.

`seaHold` reads it as `plan` does (`hunt` from port, `awayHunt` from away, `awayBeside` by one).
`enemyAt` still asks whether the nearest enemy fleet stands by an enemy port, so `notTarget` is
the enemy fleets in reach at no enemy port that the fleet still did not seek. JSON in
`d2c/after_<seed>.json`. Before: §4's `d2b/after_<seed>.json` (no sim change between `5f3d6be` and
the rule). The same 14 seeds × 6 years, years 2–6, `sea` fleet-days:

| | before | after |
| --- | --- | --- |
| all | 115,987 | 113,639 |
| away, no battle to seek (entering `enemyAt`) | 103,275 | 104,075 |
| **the nearest enemy fleet in reach at no enemy port (`notTarget`)** | **9,306** | **491** |
| the nearest enemy fleet beyond `SORTIE_KM` (`far`) | 90,942 | 101,708 |
| the nearest at an enemy port, too strong (`targetStronger`) | 752 | 299 |
| the nearest under way | 2,275 | 1,577 |
| ordered from away: an enemy fleet / a port with enemy ships | — / 1,749 | 660 / 606 |
| ordered from away: a new station / home | 798 / 324 | 1,290 / 221 |
| ordered from port: an enemy fleet / a port with enemy ships / an empty port | — / 190 / 5,749 | 64 / 210 / 4,942 |
| tool against the tick (orders) | 16,346 of 16,372 | 15,987 of 16,018 |
| an order back to the target of two orders before | 249 | 243 |

- The 491 left are not traced one by one. What the tool's reads allow: the `away` test weighs the
  fleet's own power, not its fleets' together, so a zone too strong for it alone counts there; an
  enemy fleet in a sea battle is no prey (`engaged`) but is the nearest in `enemyAt`; and one within
  `AT_PORT_CELLS` of the fleet is passed over by the `away` test.
- The nearest enemy fleet is now beyond `SORTIE_KM` in 97.7 % of those fleet-days (88.1 %
  before): the enemy fleets in reach are fought or sunk, and the rest are far. That is §3's third
  cause left without a rule, re-measured after 7.35d2d.
- No chase between two fleets hunting each other shows: the returns to a target of two orders
  before are 243 against 249.

**What it did to the battles** (`seaYears` on 4 seeds × 6 years, `d2c/years/after_<seed>.json`,
against §4's `d2b/years/after_<seed>.json`; the four seeds summed, fleets and power a day's mean
averaged over them):

| year | battles | that sank a ship | ships sunk | armed fleets | power | sea pairs a day |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 99 → 119 | 96 → 113 | 1,025 → 1,189 | 104 → 101 | 316k → 305k | 4.9 → 3.9 |
| 2 | 38 → 33 | 37 → 33 | 393 → 311 | 93 → 92 | 285k → 279k | 4.2 → 3.5 |
| 3 | 35 → 17 | 35 → 17 | 485 → 340 | 84 → 87 | 259k → 267k | 3.6 → 2.4 |
| 4 | 11 → 12 | 10 → 12 | 86 → 111 | 82 → 86 | 253k → 265k | 2.4 → 0.7 |
| 5 | 12 → 19 | 12 → 17 | 296 → 167 | 82 → 84 | 249k → 260k | 1.2 → 1.0 |
| 6 | 13 → 11 | 13 → 11 | 92 → 86 | 79 → 88 | 244k → 273k | 0.5 → 1.3 |

More battles in year 1 (119 against 99), fewer in years 2–6 (92 against 109). The navies keep more
power late (273k against 244k by year 6), and the pairs at war with a navy each in one basin
still fall below 1.5 a day by years 4–6. Four seeds, and the worlds part after the first weeks,
so this is a read, not a verdict: the verdict is 7.35d2d's 14 × 30 run against d1's.
On seed 99's first year the `SeaBattle` events are 34 against 20, the first on day 13.4 against 45.2.

## 6. A sortie's target in its own basin (7.35d2d1, ADR-551)

**The rule** (`plan`, `awayOrder` and `forwardBases` in `src/sim/ai/naval.ts`). Each enemy port's
target carries its basin (`basinOf`, as a hunt's). A sortie from port and an away fleet's new order
take only a target of the fleet's basin (`basinAt`); a target in another basin is not in reach, so
a fleet whose enemy ports in reach are all across land stages. A forward base counts only the
targets of its own basin.

`seaHold` now splits `rejected` (orders refused by `orderSail`, `NoSeaWay`): `rejectedOther` (the
target in another basin than the fleet's), `rejectedShut` (same basin, a way found once no passage
is shut: a passage whose bank an enemy holds, PLAN 4.4e), `rejectedNoRoute` (same basin, no way even
so); `otherBasinAway` counts an away order's target in another basin; `shutWho` names the shut
refusals (the fleet's nation, the order, the port). The tool mirrors the rule. JSON in
`d2d/before_<seed>.json` (at `70391c4`, the tool split, the rule not yet in; its reads are d2c's
after-run's, 15,987 of 16,018 orders agreeing) and `d2d/after_<seed>.json`. The 14 seeds × 6 years,
years 2–6, `sea` fleet-days:

| | before | after |
| --- | --- | --- |
| all | 113,639 | 118,867 |
| a sortie's target from port in another basin (`otherBasin`) | 2,497 | 0 |
| an away order's target in another basin (`otherBasinAway`) | 120 | 0 |
| **orders refused (`rejected`)** | **3,299** | **2,977** |
| of them the target in another basin (`rejectedOther`) | 2,613 | 0 |
| of them same basin, a passage shut (`rejectedShut`) | 686 | 2,977 |
| of them same basin, no way at all (`rejectedNoRoute`) | 0 | 0 |
| the way over 1.5 × the line and over `SORTIE_KM` (`farWay`) | 609 | 567 |
| ordered from away: a battle / an enemy fleet / a new station / home | 606 / 660 / 1,290 / 221 | 968 / 769 / 3,762 / 294 |
| ordered from port: a port with enemy ships / an empty port / an enemy fleet / a stage | 210 / 4,942 / 64 / 394 | 123 / 5,529 / 44 / 421 |
| held in port, every target too strong (`heldStronger`) | 261 | 95 |
| tool against the tick (orders) | 15,987 of 16,018 | 19,627 of 19,658 |
| an order back to the target of two orders before | 243 | 2,471 |

- The refusals across land are gone (2,613 → 0), but `rejected` falls by 322, not by 2,613: the
  shut ones rise by 2,291. The same-basin rest is all a passage shut to the fleet (no refusal
  found no way at all). The worlds part after the rule's first order, so the rise is not the same
  fleets turned elsewhere: seed 1471 carries 2,304 of the 2,977 (it had none before, and 49
  across land). `shutWho` on that seed (`d2d/who_1471.json`): every one is a British fleet on
  station in the Aegean given a new station at Bursa, on the Sea of Marmara behind the
  Dardanelles, whose bank its enemy holds. Refused, it stands, and is sent again on its next AI
  day; those repeats are the rise of the orders back to an earlier target (2,257 of seed 1471's
  2,471). The others: seed 4957 312, 6653 248, 6113 52, 8821 54, 3407 7.
- A passage shut to the fleet is the next cause (PLAN 7.35d2d2): a target behind one is as out
  of reach as one across land.
- Pin unchanged (babcd48d): no fleet of seed 99's first year has its target across land. navalAi
  0.0457 ms a tick, 2.0 % (0.0434 at d2c; seed 99, one year, `--profile`, pinned; territory 0.1561
  against 0.1485, the run 5 % slower throughout).

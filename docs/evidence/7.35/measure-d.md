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

## 7. A target behind a passage shut to the fleet (7.35d2d2, ADR-552)

**The rule** (`waterKeys`, `keyAt` in `src/sim/ai/naval.ts`). Each sea zone has a key per nation:
the same for two zones a ship of that nation sails between. While no passage is shut to the nation
the keys are the basins; with one shut (its bank held by an enemy, PLAN 4.4e) they are the parts of
the lane graph with the shut passages left out, as `orderSail` routes. `plan`'s sortie, `awayOrder`,
`forwardBases` and `stageTo` compare keys where §6's rule compared basins. With Turkey at war with
Britain, the Aegean, the Sea of Marmara and the Black Sea are three keys for Britain's ships and one
basin for the others' (the unit test's probe).

`seaHold` mirrors the rule, and gains `noRouteWho` (the refusals with no way even with nothing shut:
who, which order, the port, the zones), `otherBasinWho`, and `check.targetMiss` (an ordered fleet
under way for another cell than the tool's read: `agree` counts any fleet under way). JSON in
`d2d2/after_<seed>.json`; before is §6's after-run (`d2d/after_<seed>.json`, the same code as this
task's start). The 14 seeds × 6 years, years 2–6, `sea` fleet-days:

| | before | after |
| --- | --- | --- |
| all | 118,867 | 112,739 |
| **orders refused (`rejected`)** | **2,977** | **29** |
| of them a passage shut (`rejectedShut`) | 2,977 | 0 |
| of them no way at all (`rejectedNoRoute`) | 0 | 29 |
| seed 1471's refusals | 2,304 | 0 |
| an order back to the target of two orders before | 2,471 | 180 |
| ordered from away: a battle / an enemy fleet / a new station / home | 968 / 769 / 3,762 / 294 | 881 / 633 / 1,183 / 289 |
| ordered from port: a port with enemy ships / an empty port / an enemy fleet / a stage | 123 / 5,529 / 44 / 421 | 60 / 3,300 / 25 / 381 |
| tool against the tick (orders; `agree`) | 19,627 of 19,658 | 13,110 of 13,160 |
| of those under way, for another cell than the read (`targetMiss`) | not measured | 419 (405 `sortieEmpty`) |

- The refusals through a shut passage are gone (2,977 → 0), and with them the repeats: orders back
  to an earlier target 2,471 → 180, new stations from away 3,762 → 1,183 (the Aegean fleets' daily
  Bursa). The worlds part after the first changed order, so the other rows are not the rule's.
- The 29 left are one cause, not this rule's: seed 8821 year 3, a French fleet in the Black Sea
  (zone 39) sent home (`sailHome`, `nearestOwnPort`) for Latakia (zone 193), through the Bosporus,
  shut to it. `nearestOwnPort` filters by basin alone (PLAN 7.35d2d3).
- The 4 orders across basins that d2d1's before-run counted and `orderSail` did not refuse (seed
  6113, year 3): replayed at `70391c4`, four Soviet fleets in the Aegean read by the tool as sent for
  Rasht on the Caspian were under way that tick for Valletta. Not a seam of `sailTarget`, nor a
  basin-0 zone: the tool's read and the tick's order differ, and `check` counted the fleet under way
  as agreeing. Hence `targetMiss`, which finds 419 such of the after-run's 13,160 orders: its cause is
  not traced (PLAN 7.35d2d3).
- Pin babcd48d → 11594612; seed 99's year 34 `SeaBattle` rows, the first on day 13.4, both as before.
  navalAi 0.0429 ms a tick, 2.0 % (0.0457 at d2d1; seed 99, one year, `--profile`, pinned; tick
  mean 2.13 ms).

## 8. A home port behind a passage shut to the fleet (7.35d2d3a, ADR-553)

**The rule** (`nearestOwnPort`, `src/sim/systems/navalCombat.ts`): a fleet's home port is one in its
waters' key (`waterKeys(world, nation)`, now in `navalCombat.ts` beside `basinAt`), not its basin.
A fleet with no home port it reaches gets no order home and stands, as it did when the order was
refused. `seaHold` reads the home goal through `nearestOwnPort`, so it follows unchanged. JSON in
`d2d3a/after_<seed>.json`; before is §7's after-run (`d2d2/after_<seed>.json`). The 14 seeds × 6
years, years 2–6, `sea` fleet-days:

| | before | after |
| --- | --- | --- |
| all | 112,739 | 115,277 |
| **orders refused (`rejected`)** | **29** (seed 8821) | **0** |
| tool against the tick (orders; `agree`) | 13,110 of 13,160 | 14,013 of 14,063 |
| of those under way, for another cell than the read (`targetMiss`) | 419 | 473 |
| an order back to the target of two orders before | 180 | 196 |

- No order of the sea pairs' fleets is refused now. The worlds part after seed 8821's first changed
  order (and seed 99's, the pin), so the other rows are not the rule's.
- `targetMiss` stays untraced (PLAN 7.35d2d3b).
- Pin 11594612 → 25c38def; seed 99's year 34 `SeaBattle` rows, the first on day 13.4, both as before.
  Seed 99, one year, `--profile`, pinned, HEAD's code timed after it on the same machine (a load
  that ran every system about 1.5 × slower than §7's): navalCombat 0.107–0.111 ms a tick against
  0.106, navalAi 0.066 against 0.063, territory (untouched) 0.229–0.235 against 0.225.

## 9. The tool: `seaMeet` on the fleet's waters, `targetMiss` named (7.35d2d3b, at `b9a507a`)

No rule: the pin unchanged. Two changes to the tools.

**`seaMeet`** passes `waterKeys(world, n)` to `forwardBases` and `stageTo`, and filters the sortie's
targets by the fleet's key (`keyAt`), as `plan` has since 7.35d2d2; before, it filtered by basin.
- `seaMeet 3407 JAP USA 40 new` with the old tool and the new: all 1,763 rows and the 15 battles the
  same (no passage is shut to Japan or the USA in those waters).
- `seaMeet 1471 ENG TUR 12 new` (Turkey holds both banks of the straits, so they are shut to
  Britain): 2 of 463 rows differ. A British fleet at Dubai on days 7 and 8: the old tool read its
  sortie as Trabzon (Black Sea, behind the straits: `orderSail` refuses it), the new one Adana; the
  fleet sails for Tarsus, Adana's water, on day 8.

**`targetMiss`** (fleets read as ordered that sail for another cell than the read) named per order
(`targetMissWho`: the read's port, the one sailed for, and what that one is). JSON in
`d2d3b/after_<seed>.json`; the 14 seeds × 6 years at `b9a507a` give §8's figures to the order
(115,277 `sea` fleet-days; 14,013 of 14,063 orders agree; 473 `targetMiss` in years 2–6, 196 back to
an earlier target, 0 refused), so the run is §8's after-run read again.

| sailed for | years 2–6 | year 1 |
| --- | --- | --- |
| a landing's water of the fleet's nation (`embarked`) | 459 | 11 |
| a port of a nation it was not at war with at the read (`newWar`) | 14 | 51 |
| its home port (`nearestOwnPort`) | 0 | 10 |
| none of these | 0 | 1 |

- The read comes before the tick; `strategicAi` and `invasionAi` run before `navalAi` in it
  (`sim.ts`). A landing `invasionAi` loads that tick becomes `plan`'s escort, which comes first
  (seed 1471 year 3: a US fleet read as sent for an empty British port in the Caribbean, Roseau,
  Castries, Kingstown, Saint George's, 25 AI days each, sails for a landing's water each time). A war
  `strategicAi` declares that tick adds targets (seed 4957 year 3: a French fleet read as staging to Djibouti
  sails for Barcelona, Germany's, 11 times; seed 2609 year 2: a Soviet fleet read as sent for
  Chatham sails for Oslo, 3). The year-1 orders home: by the same
  reading a peace made that tick (not checked); one order of year 1 (seed 9901) is not traced.
- So `targetMiss` is the tick's own changes before `navalAi`, not a read that differs from `plan`:
  the tool's figures may lean on `agree`. By seed (years 2–6, landing / new war): 1129 60/0, 1471
  138/0, 2251 2/0, 2609 12/3, 3407 55/0, 3793 56/0, 4957 0/11, 6653 80/0, 7741 56/0.
- Left for 7.35d2d3c: the same landing water taken up on AI day after AI day (seed 1471's 25 a port)
  says the landings there are loaded again and again; whether they sail is not measured here.

## 10. The run at `5acc4ca` against 7.35d1's, and the causes left (7.35d2d3c)

The rules of 7.35d2b to 7.35d2d3a (ADR-549 to ADR-553) against §1's. `npx tsx tools/diag/seaYears.ts
<seed> 30` on the same 14 seeds at `5acc4ca` (7 at a time); JSON in `d2d3c/years_<seed>.json`, before
is `d1/before_<seed>.json`. §1's figures, before → after:

| all 14 seeds, mean (median) | year 1 | years 2–30 | 2–5 | 6–10 | 11–30 |
| --- | --- | --- | --- | --- | --- |
| sea battles | 20 → 34.9 (37) | 1.9 → 2.5 (1) | 3.3 → 5.9 | 2.4 → 3.1 | 1.4 → 1.7 |
| that sank a ship | 19.4 → 33.6 (36) | 1.7 → 2.4 (1) | 3.1 → 5.5 | 2.3 → 3.0 | 1.3 → 1.7 |
| ships sunk | 193 → 350 (387) | 24.8 → 32.2 (12) | 42.1 → 77.1 | 28.6 → 46.6 | 20.3 → 19.6 |
| armed fleets | 106.8 → 99.3 | 99.6 → 74.6 | 96.5 → 79.9 | 97.2 → 75.0 | 100.8 → 73.5 |
| their power (hp) | 325,000 → 302,100 | 296,800 → 232,200 | 294,100 → 243,300 | 283,300 → 219,400 | 300,800 → 233,200 |
| nations with a navy | 19.3 → 16.3 | 17.3 → 11.4 | 16.3 → 10.8 | 17.5 → 11.9 | 17.5 → 11.5 |
| pairs at war | 172 → 172 | 214 → 214 | 306 → 315 | 284 → 256 | 178 → 183 |
| sea pairs | 9.1 → 5.0 | 7.7 → 1.3 | 9.9 → 2.4 | 9.4 → 1.5 | 6.8 → 1.1 |
| their fleets | 45.3 → 36.3 | 43.0 → 14.9 | 56.4 → 32.6 | 52.7 → 22.0 | 37.9 → 9.6 |
| their fleets' power (hp) | 139,100 → 109,700 | 129,600 → 42,800 | 173,800 → 100,700 | 160,700 → 64,400 | 113,000 → 25,900 |
| their fleets under way | 2.1 → 2.7 | 0.5 → 0.5 | 0.7 → 1.1 | 0.7 → 0.75 | 0.4 → 0.3 |

Per seed (sea battles), before → after:

| seed | year 1 | sank a ship | years 2–30, mean | sank a ship | late years with none sinking (of 29) |
| --- | --- | --- | --- | --- | --- |
| 1129 | 23 → 49 | 22 → 48 | 1.6 → 2.7 | 1.6 → 2.7 | 11 → 13 |
| 1471 | 17 → 24 | 17 → 24 | 1.8 → 2.8 | 1.7 → 2.8 | 11 → 11 |
| 2251 | 31 → 39 | 28 → 34 | 1.5 → 2.1 | 1.4 → 2.1 | 11 → 8 |
| 2609 | 22 → 43 | 22 → 41 | 1.7 → 1.6 | 1.6 → 1.6 | 10 → 13 |
| 3407 | 6 → 10 | 6 → 10 | 2.2 → 2.9 | 2.2 → 2.8 | 6 → 12 |
| 3793 | 19 → 37 | 19 → 36 | 1.2 → 2.4 | 1.2 → 2.3 | 12 → 9 |
| 4483 | 26 → 38 | 26 → 37 | 4.1 → 2.4 | 3.0 → 2.4 | 5 → 10 |
| 4957 | 24 → 36 | 24 → 36 | 1.8 → 2.1 | 1.8 → 2.0 | 9 → 12 |
| 5527 | 16 → 34 | 14 → 34 | 2.0 → 2.5 | 1.9 → 2.3 | 10 → 15 |
| 6113 | 13 → 28 | 11 → 28 | 1.0 → 2.7 | 1.0 → 2.6 | 14 → 8 |
| 6653 | 29 → 69 | 29 → 61 | 2.1 → 3.4 | 2.1 → 2.6 | 9 → 7 |
| 7741 | 19 → 29 | 19 → 29 | 1.6 → 2.6 | 1.5 → 2.5 | 13 → 9 |
| 8821 | 6 → 14 | 6 → 14 | 1.9 → 2.3 | 1.9 → 2.2 | 9 → 10 |
| 9901 | 29 → 39 | 29 → 39 | 1.6 → 3.0 | 1.6 → 2.9 | 11 → 9 |

Navies by year (means of the 14 seeds, before → after):

| year | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 15 | 20 | 25 | 30 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| armed fleets | 107 → 99 | 101 → 85 | 97 → 81 | 95 → 77 | 93 → 76 | 94 → 77 | 97 → 75 | 100 → 73 | 99 → 73 | 98 → 73 | 101 → 73 | 102 → 74 |
| power (k hp) | 325 → 302 | 307 → 261 | 301 → 248 | 291 → 237 | 277 → 227 | 284 → 229 | 283 → 221 | 283 → 209 | 285 → 213 | 289 → 233 | 303 → 240 | 321 → 259 |
| nations with a navy | 19.3 → 16.3 | 16.9 → 11.8 | 16.5 → 10.7 | 15.6 → 10.0 | 16.1 → 10.7 | 17.0 → 11.7 | 17.9 → 11.6 | 17.5 → 12.0 | 16.9 → 12.2 | 17.3 → 11.2 | 18.1 → 11.3 | 17.3 → 11.0 |
| sea pairs | 9.1 → 5.0 | 13.3 → 3.7 | 9.1 → 2.2 | 7.7 → 1.8 | 9.6 → 2.0 | 11.5 → 1.8 | 8.9 → 1.3 | 8.3 → 1.4 | 7.1 → 1.3 | 4.8 → 1.2 | 7.6 → 1.0 | 5.7 → 1.0 |
| battles that sank a ship | 19.4 → 33.6 | 5.3 → 11.9 | 3.4 → 4.4 | 1.9 → 2.9 | 1.9 → 2.8 | 3.0 → 3.1 | 2.6 → 2.9 | 1.1 → 1.6 | 1.5 → 1.9 | 1.0 → 0.8 | 0.7 → 1.8 | 1.7 → 1.9 |

**What it says.**
- **The navies at war now fight.** Battles that sink a ship per sea pair-year: year 1 2.1 → 6.7,
  years 2–30 0.23 → 1.8 (eight times). The sea pairs' fleets under way: year 1 4.6 % → 7.5 %, late
  1.2 % → 3.3 %. §2's cause (navies at war that do not sail) is answered by 7.35d2b–d2d3a.
- **The late fall has a new cause: few navies left to fight.** Year 1 sinks 350 ships (193 before);
  the armed fleets fall 99 → 77 by year 4 and stay at 73–77 for 26 years, the nations with a navy
  16.3 → 10–12. Their power comes back (227k by year 5, 259k by year 30) in fewer hands. Sea pairs
  (two navies at war in one basin) fall 7.7 → 1.3 a day; 195 of the 406 late seed-years have one on an
  average day (362 before), 54 of those see no battle that sinks a ship (123).
- **So battles per world-year late 1.9 → 2.5**, short of year 1's 35, and the mean is carried by busy
  years: the median late year is 1 before and after, the busiest 17 → 28, and the late years with no
  battle that sinks a ship are not fewer (141 → 146 of 406; seeds 3407 6 → 12, 4483 5 → 10, 5527
  10 → 15). The sea war late is not recovered. The navies the first year sinks are not built again in
  number: the next cause, measured first (PLAN 7.35d3).
- **Sea pairs fell more than the navies.** Year 2: nations with a navy 16.9 → 11.8 (× 0.7, so pairs
  of them about × 0.5), sea pairs 13.3 → 3.7 (× 0.28). Either the navies lost were those that made
  most pairs (small navies at war with each other), or the navies left stand in basins their enemies'
  do not: PLAN 7.35d3 measures both.

**The three causes 7.35d2a left, re-measured** (`seaHold` 14 seeds × 6 years at `5acc4ca`: JSON in
`d2d3c/hold_<seed>.json`, the same to the order as §9's `d2d3b/after_<seed>.json`, with the `far`
fleet-days split, below; years 2–6, the `sea` fleet-days, 115,277):
- **The way across land** (a route over 1.5 times the line and over `SORTIE_KM`, `farWay`): 493 of
  14,063 late orders (3.5 %; 435 of 7,269, 6 %, at `ac245c4`). None is refused (`rejected` 0, §8): the
  fleet sails and gets there later than the line says. A rule would cost a route search per target in
  `plan` (`seaKm` is the line) for 3.5 % of the orders, none of which fails. **The reason, no rule.**
- **A partner's port the enemy holds** (`awayLostPartner`): 3,128 fleet-days (2.7 %); `other` 1,820.
  Since 7.35d2b (ADR-549) such a port is an enemy-held port to `awayOrder`: a fleet by it keeps its
  station (it blockades the holder), and seeks a battle first; 97 of the 3,128 had one in reach. It is
  no longer a fleet that stands for nothing (ADR-545's hole: `atLostBase`, `navalCombat.ts`, which
  `rebaseFleets` reads daily, still counts only ports the fleet's own nation owns, so it does not send
  such a fleet home; on the nation's AI day `awayOrder` gives it its order).
  **The reason, no rule.**
- **The enemy beyond `SORTIE_KM`** (of the away fleet-days with no battle to seek, the nearest enemy
  warfleet of the basin): 103,704 of 106,381 (97.5 %). Split by its way off (`farBy`) and where it
  stands (`farWhere`), years 2–6 (year 1):

  | way off, in `SORTIE_KM` | 1–1.5 | 1.5–2 | 2–3 | over 3 |
  | --- | --- | --- | --- | --- |
  | fleet-days | 7,521 (7.3 %) | 10,877 (10.5 %) | 15,014 (14.5 %) | 70,292 (67.8 %) |
  | year 1 | 2,532 | 461 | 4,880 | 12,033 |

  | where it stands | a port of its own bloc | a port of the fleet's bloc (it blockades n's side) | elsewhere (a port of neither, or open water) |
  | --- | --- | --- | --- |
  | fleet-days | 3,210 (3.1 %) | 15,862 (15.3 %) | 84,632 (81.6 %) |

  Two-thirds stand over three times `SORTIE_KM` off, oceans apart; and 82 % are on station of their
  own at a third nation's port, not at home nor off the fleet's side. A rule that sent a fleet on
  station after an enemy fleet up to 1.5 × `SORTIE_KM` off would reach 7 % of these fleet-days, and
  would draw it off its blockade (ADR-549: an empty enemy port is a station worth keeping). With the
  sea pairs at 1.3 a day the cause that holds the late battles down is the navies' number, not this
  one. **The reason, no rule.**

**The landings `targetMiss` named** (§9: seed 1471's US fleets read for four Caribbean ports, 25 AI
days each, sail for a landing's water). A probe of seed 1471's year 3 (every `FormationEmbarked`,
`FormationLanded`, `LandingRepulsed` of the USA and each day what it has aboard): 9 embarkings and 9
landings, one formation at a time on one transport group, island by island down the Antilles (days
1,010 to 1,095; 0.5 to 4 days at sea each), none thrown back. The same landing water is taken up as
the next island's; the landings sail. No rule.

## 11. Why the navies sunk are not built again (7.35d3a, at `86fae1f`)

`npx tsx tools/diag/navyLoss.ts <seed> 30` on the 14 seeds (7 at a time; JSON in
`d3a/loss_<seed>.json`). Its runs are §10's to the day (ships sunk year 1 350.1, years 2–5 77.1, 6–10
46.6, 11–30 19.6; nations with a navy 16.3, 10.8, 11.8, 11.5). Per seed-year (means of the 14):

| | year 1 | 2–5 | 6–10 | 11–30 |
| --- | --- | --- | --- | --- |
| nations with a navy (a day) | 16.3 | 10.8 | 11.8 | 11.5 |
| nations that had one and have none, living (a day) | 6.6 | 12.0 | 14.2 | 16.3 |
| pairs at war with a navy each (a day) | 5.0 | 2.4 | 1.5 | 1.1 |
| of them, with one each in one basin | 5.0 | 2.4 | 1.5 | 1.1 |
| armed fleets gone: sunk | 21.4 | 5.0 | 3.5 | 1.4 |
| laid up | 0 | 0.1 | 0.3 | 0 |
| otherwise (bombs, a port taken, sunk in the hour) | 3.9 | 1.0 | 0.4 | 0.3 |
| the nation dead, handed over, disarmed | 0.2 | 0 | 0 | 0 |
| armed fleets built | 0.5 | 2.7 | 3.9 | 1.8 |

Of the 337 navies lost on the 14 seeds, 111 are built again (the first armed fleet a median of 2,236
days after, 830 to 3,886 the quartiles), 226 never; 55 of the nations die.

**Per nation-month of a lost navy**, the first test of the fleet step (`economic.ts` 3b) that stops a
warship's order (years 2–30, 86,031 nation-months; year 1, 1,055):

| first test | years 2–30 | of them at war | year 1 |
| --- | --- | --- | --- |
| gold: under a warship of its income's kinds + RESERVE_MONTHS of income | 45,664 (53.1 %) | 30,122 | 626 (59.3 %) |
| dead | 11,458 (13.3 %) | | 21 |
| no shipyard (`shipyard` −1) | 10,188 (11.8 %) | 5,043 | 65 |
| poor (income < POOR_INCOME) | 7,218 (8.4 %) | 5,265 | 99 |
| all passed, the month spent by the army's orders first | 4,987 (5.8 %) | 4,366 | 32 |
| the navy's share (transports, submarines) | 2,332 (2.7 %) | 1,942 | 27 |
| a transport wanted (2c) | 2,176 (2.5 %) | 2,176 | 105 |
| a warship in training | 1,035 (1.2 %) | 580 | 13 |
| a transport in training | 608 (0.7 %) | 579 | 60 |
| a warship ordered | 157 (0.2 %) | 59 | 4 |
| the balance; spent otherwise | 80; 128 | | 2; 1 |

`check`: of the 87,086 nation-months, 161 orders seen in the tick after, none in a month the reading
had stopped (`disagree` 0). The gold months by the treasury's share of what the test asks (in tenths,
years 2–30): 0–0.1 439, 0.1–0.2 2,574, then 4,461 to 5,260 a tenth up to 0.7, 0.8–0.9 7,400, 0.9–1
5,765. By income (living lost navies, years 2–30): destroyers only 35,994 nation-months, cruisers
12,702, battle squadrons 9,299, poor 16,447.

The 1938 prices (`TEMPLATES_1938`): a destroyer flotilla 1,120 gold, a cruiser squadron 1,960, a
battle squadron 6,720; an infantry division 1,001. The army's order asks gold ≥ its price + 3 months of
income too, and comes first each month (3, then 3a's refills, then 3b).

**What it says.**
- **The navies are sunk, not laid up nor stranded.** 21.4 armed fleets sunk a seed in year 1, 0.1 laid
  up in years 2–5. And every pair at war with a navy each has one each in one basin, every year: §10's
  "sea pairs fell more than the navies" is the navies lost (of year 1's sea pair-days, 35 % are of two
  nations that both still have a navy for half of year 4, 39 % of one, 26 % of neither). Placement is
  not the cause: PLAN 7.35d3's second branch is answered no.
- **The rebuild stops at the gold test.** Over half of a lost navy's months, living, have under the
  price of the cheapest warship of its income's kinds and three months of income, most of them at
  war; the treasury holds 0.2 to 1 of it, spread. One reading (to be traced, d3b): the army's order
  takes the same test with a lower price (an infantry division 1,001 against a destroyer flotilla's
  1,120 and a cruiser squadron's 1,960) and comes first each month, so a nation whose army is under
  its share spends down below the warship's line every month; the fleet buys only when the army is
  full. A further 5.8 % passed every test and the army's orders spent the month first.
- **No shipyard** 11.8 % (Greece 2,468 of its 4,596 months, Norway 1,443, Sweden 1,408, Yugoslavia
  1,360, Romania 1,164): living nations without a port that `shipyard` takes (all held by the enemy,
  bombed shut, or none on the world's seas). And **poor** 8.4 %, **dead** 13.3 %: no rule builds those.
- **So the next parts:** the gold (d3b, traced first: the month's gold before and after the army's
  orders, and whether a warship would have been paid for without them); no shipyard (d3c, traced:
  which ports, why none passes). No rule here: the pin unchanged (`pickFleet` exported, as it was).

## 12. The gold traced (7.35d3b, at `06031ee`)

`npx tsx tools/diag/navyLoss.ts <seed> 30` on the 14 seeds again, the economic AI wrapped in the tool
(the sim unchanged): each month's treasury before and after the AI, the gold of the orders it placed
by kind, and the refills as the rest (the AI spends gold on nothing else). JSON in `d3b/loss_<seed>.json`
(`nations[].gold`: per gold month [tick, treasury before the AI, shortfall, balance, the army's
orders, refills, treasury after, at war]); sums by `npx tsx tools/diag/navyLossGold.ts
docs/evidence/7.35/d3b`. The runs are d3a's to the month (the first tests' counts the same; 337
nations lost a navy, 111 built one again).

The gold test reads the treasury before the month's AI: a gold month is short before that month's
army orders or refills, so what stops it is the months before. Per gold month (years 2–30, 45,664),
by income band and war (means a month):

| | months | shortfall | balance | army's orders | refills | research | covered by the land spend: last month | last 12 | since lost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| destroyer, war | 16,563 | 699 | 36 | 21 | 10 | 4 | 0.6 % | 21 % | 79 % |
| destroyer, peace | 13,707 | 622 | 48 | 30 | 1 | 3 | 0.9 % | 28 % | 84 % |
| cruiser, war | 9,313 | 600 | 223 | 73 | 88 | 24 | 16 % | 89 % | 96 % |
| cruiser, peace | 1,556 | 536 | 265 | 97 | 42 | 22 | 24 % | 91 % | 97 % |
| battle, war | 4,246 | 519 | 607 | 146 | 292 | 74 | 53 % | 94 % | 95 % |
| battle, peace | 279 | 508 | 725 | 140 | 239 | 74 | 66 % | 94 % | 94 % |
| all | 45,664 | 632 | 143 | 49 | 52 | 15 | 9.9 % | 47 % | 86 % |

The balance would cover the shortfall within 3 months in 11,602 of them, within 12 in 13,441, later in
20,387, never (balance ≤ 0) in 234. The treasury the month's AI leaves over the reserve: under a
tenth of the warship's price in 11,465, under the reserve in 734, the rest spread over the tenths.
2,231 gold months had an army order in the month itself.

**The race** (Norway, seed 3407, at peace, income about 65, its navy lost in year 1; every month from
day 821): the treasury climbs by the balance, 920, 989, 1,057, 1,125, 1,193, 1,262, and on that month
the army's order takes an infantry division (1,001) and leaves 261; again 329 … 1,245, a division, 244;
between, a wing (3c) now and then (529 → 277, 598 → 220). The destroyer's line (1,120 + three months
of income, 1,315) is never reached: the army's line (1,001 + the same reserve) is 119 gold lower and
comes first in the month, so a nation whose army is under its share buys a division each time the
treasury nears a warship. Brazil (8821), Turkey (3793, 4483), Greece (3793), Romania (6113) and
Yugoslavia (2609) saw the same, 337 to 352 gold months each.

**What it says.**
- **The army's orders and refills take the gold the fleet waits for**, not the month's balance: in 86 %
  of the gold months the land spend since the navy was lost would have paid the shortfall; in 47 %
  that of the last 12 months. The poorer the nation the slower: a destroyer-band nation's balance of
  36 to 48 a month climbs to the line in 13 to 19 months, and its army's order, 119 gold cheaper, takes
  the climb a few months before (cover over 12 months 21–28 %, since lost 79–84 %). A richer one's
  refills and orders take it month by month (cruiser and battle bands, the last 12 months 89–94 %).
- **So the rule (d3b's second commit):** a nation without a navy saves for a warship, as one saves for
  its armour (PLAN 3.5d): the army's orders and the refills keep the warship's price over the reserve
  while the army stands at its peacetime share. The rest, 14 % (poorer than the line within the
  run, or the gold taken by wings and transports), is not the army's.

## 13. The rule: a nation without a navy saves for a warship (7.35d3b, ADR-557)

The same 14 seeds × 30 years with the rule (JSON in `d3b/after/`; `npx tsx tools/diag/navyLossGold.ts
docs/evidence/7.35/d3b/after`), against §12's:

| | before | after |
| --- | --- | --- |
| nations that lost a navy / built one again | 337 / 111 (33 %) | 463 / 290 (63 %) |
| navies lost / built again (episodes) | 473 / 182 | 1,031 / 702 |
| the first rebuild, median days after the loss | 2,236 | 1,123 |
| navies a day, years 2–30 (mean of seed-years) | 11.4 | 17.4 |
| armed fleets built / sunk, 30 years | 935 / 1,215 | 1,642 / 1,795 |
| ships sunk, years 2–30 | 13,077 | 20,311 |
| gold months, years 2–30 (of lost navies' months) | 45,664 of 86,031 | 41,607 of 92,087 |
| a warship in training | 1,035 | 3,654 |
| covered by the land spend since lost | 86 % | 73 % |

The gold months left are mostly at war with the army under its peacetime share (the floor:
destroyer band 20,012, the land spend since lost covering 72 %) and in peace slow balances (destroyer
band 8,547, the army's orders 0 a month: the treasury climbs to the line, 13 to 19 months on a
balance of 45). More nations lose a navy because more have one to lose. No shipyard is d3c's.

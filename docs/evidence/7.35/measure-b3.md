# PLAN 7.35b3: fleets sunk from the air alone at a sortie's target (critic R9, naval 6), measured

2026-10-19, code of `9cb3702` (with PLAN 7.35b2's staging). Tool: `tools/diag/seaAir.ts`. Every
day at 01:00 (an hour after the naval AI) each fleet with power under way gets its order's kind by
where it goes: `sortie` (an enemy-held port's water), `stage` (its bloc's port), `escort`, `other`;
with no order since it was seen, `none`. At a sortie's order and at each 01:00 it then stands at the
target: the enemy's land-based anti-ship fire over it (Σ squadron aircraft × hard ×
`NAVAL_STRIKE_FIRE` of the wings at war with it whose airbase is within their range of the point,
before armour and the air's factor), all wings (`air`) and those of the naval role (`navalAir`, the
`naval_bomber` wings, which the air AI sends at the nearest enemy fleet first, `src/sim/ai/air.ts`),
its hit points and the enemy's ships in its zone (`navalPower`). Each hour: a sea battle, a strike
of a land-based wing (`StrikeHit`, its wing's base an airbase) or a carrier's. An order's outcome:
`airAlone` (the fleet lost, land-based strikes, no sea battle, no carrier strike), `sea`, `mixed`,
`other`, or `kept`.

Runs: the 14 seeds of the critic's headless runs (`critic/c9_headless_*.json`), two years each as
the world runs; and the critic's two declared wars, 60 days (`npx tsx tools/diag/seaAir.ts <seed>
730`, `… 3407 60 JAP USA`, `… 2251 60 ITA ENG`). Output in `.cache/seaAir/`.

## 1. By seed (sortie orders; hit points the sortied fleets lost, by cause)

| case | days | sea battles | sorties | sunk by air alone | sunk in a sea battle | hp lost: sea | land air | carrier | other |
|---|---|---|---|---|---|---|---|---|---|
| 1129 | 730 | 34 | 310 | 0 | 3 | 29,150 | 1,200 | 0 | 20,950 |
| 1471 | 730 | 18 | 200 | 5 | 3 | 11,650 | 16,200 | 0 | 6,350 |
| 2251 | 730 | 21 | 207 | 16 | 2 | 26,550 | 46,250 | 0 | 8,900 |
| 2609 | 730 | 20 | 274 | 37 | 4 | 13,700 | 135,800 | 6,400 | 11,150 |
| 3407 | 730 | 16 | 263 | 1 | 5 | 6,750 | 1,550 | 0 | 6,050 |
| 3793 | 730 | 9 | 197 | 8 | 1 | 1,650 | 25,100 | 0 | 2,800 |
| 4483 | 730 | 31 | 232 | 5 | 5 | 17,250 | 41,850 | 2,800 | 8,200 |
| 4957 | 730 | 17 | 225 | 3 | 2 | 4,050 | 5,200 | 2,800 | 5,300 |
| 5527 | 730 | 16 | 303 | 12 | 2 | 17,400 | 27,900 | 2,800 | 12,400 |
| 6113 | 730 | 16 | 338 | 7 | 1 | 12,550 | 10,850 | 18,300 | 26,100 |
| 6653 | 730 | 33 | 230 | 4 | 4 | 12,100 | 22,600 | 5,200 | 15,400 |
| 7741 | 730 | 20 | 231 | 7 | 1 | 7,100 | 7,650 | 0 | 6,150 |
| 8821 | 730 | 11 | 216 | 8 | 0 | 3,750 | 25,800 | 0 | 1,250 |
| 9901 | 730 | 25 | 215 | 8 | 1 | 16,600 | 52,050 | 7,350 | 7,150 |
| **14 seeds** | | **287** | **3,441** | **121** | **34** | **180,250** | **420,000** | **45,650** | **138,150** |
| 3407 JAP→USA | 60 | 7 | 87 | 3 | 0 | 3,350 | 16,250 | 19,800 | 700 |
| 2251 ITA→ENG | 60 | 7 | 85 | 1 | 1 | 9,650 | 3,100 | 9,200 | 7,650 |

A fleet on a sortie is 3.6 times as likely to be sunk by land-based air alone as in a sea battle
(121 against 34; the total of this column read 30 until PLAN 7.35b3b, its rows sum to 34), and land-based air takes 2.3 times the hit points from sortied fleets that the
sea battles do. Of the 121: 71 destroyer flotillas, 33 cruiser squadrons, 10 battle squadrons, 7
carrier groups; 286,650 hit points. France's whole battle line at Genoa on seed 2251 (day 121, four
fleets, 16,600 hp, no Italian ship in the zone, Italy's air 2,501 per strike over the water).

## 2. Where they are lost: standing at an empty port, for weeks

- All 121 had **arrived** at the target's water; 114 of them at a port whose zone held no enemy
  ship when ordered.
- From the order to the loss (the 14 seeds, n = 121; recomputed in PLAN 7.35b3b, the first figures,
  33 days and 26 strikes, came from the 16 cases' first pass, n = 125): median 35.9 days (10th
  percentile 2.8, 90th 165); land-based strikes taken: median 28 (10th 2, 90th 76).
- Away from its ports, `plan` reads only the enemy's ships in the fleet's zone (`AVOID_RATIO`), and
  at the target the sortie test sees the same empty zone each turn: the fleet stands there,
  struck every few hours, until it is gone. The US Asiatic squadron at Takao (seed 3407, 4,000 hp,
  air 1,590 a strike) is the short case: four strikes in a day.

## 3. What would tell them apart

The sortie's order alone does not (the 16 cases; one group per nation, day and port: 1,086 groups):

| groups | n | air/hp at the order, q10 / q50 / q90 | with air 0 at the order |
|---|---|---|---|
| a fleet lost to air alone | 59 | 0.00 / 0.24 / 1.23 | 10 |
| fought a sea battle | 203 | 0.00 / 0.05 / 0.60 | 34 |
| neither, no loss | 824 | 0.00 / 0.00 / 0.32 | 385 |

A test at the order of "enemy ships + air > the fleets' hit points" stops 13 of the 59 lost groups
and 22 of the 203 that fought; with the air counted twice, 22 and 35. The wings come after the fleet
(ten lost groups had none in range at the order: the air AI rebases toward the enemy's forces,
PLAN 5.12a, 7.26b).

The air over the fleet where it stands does, by its kind: the stand-days at the target, a fleet
counted once if any of its stand-days passes (the 14 seeds; 121 lost, 3,146 others that stood):

| over the fleet, where its zone has no enemy ship | lost to air alone | others | of them fought a sea battle (of 436) |
|---|---|---|---|
| any land-based anti-ship air (`air` > 0) | 116 | 1,892 | 387 |
| `air` / hp > 0.25 | 94 | 608 | 144 |
| `air` / hp > 0.5 | 77 | 425 | 99 |
| any naval-role wing (`navalAir` > 0) | **115** | **182** | 74 |
| `navalAir` / hp > 0.1 | 98 | 111 | 55 |
| `navalAir` / hp > 0.25 | 69 | 64 | 36 |

Struck at all by a land-based wing: 121 lost, 146 others. Any naval bomber wing in range of a fleet
that stands at a target with no enemy ship to fight names 115 of the 121 losses and 182 of the
3,146 others (5.8 %): the naval bombers are the wings the air AI sends at the nearest enemy fleet.
Every wing that can bomb a ship (CAS, tactical bombers) is in range of most coasts and names a
fleet fighting a sea battle nine times in ten: it is not the measure.

## 4. What follows

- The cause the task named (the sortie's test blind to air) is the lesser part: the order-time air
  separates the lost poorly. The larger is the stand: a fleet at a target with no enemy ship in its
  zone stays under naval bombers until sunk, because neither the away test nor the sortie test
  reads air.
- A rule must sit at both seams, or the fleet sent home is sent back the next turn by the sortie
  test (no enemy ship ≤ together): PLAN 7.35b3b, with the naval-role air over the water as its
  quantity and the 14 seeds' figures (121 sunk by air alone, 287 sea battles) before and after.
- Left: the `other` column (138,150 hp lost by sortied fleets in hours with no sea battle and no
  strike seen: submarines, the anti-air, attrition) is not this task's.

## 5. After the rule (PLAN 7.35b3b, ADR-544)

The same 14 seeds × 2 years and the two wars, with the rule (a fleet away on empty water under the
enemy's naval bombers sails home; no sortie to such water; a landing's escort exempt). Output in
`.cache/seaAir_after/`.

| case | sea battles | sorties | sunk by air alone | sunk in a sea battle | hp lost: sea | land air | carrier | other |
|---|---|---|---|---|---|---|---|---|
| 1129 | 34 | 310 | 0 | 3 | 29,150 | 1,200 | 0 | 20,950 |
| 1471 | 21 | 201 | 0 | 1 | 11,100 | 1,000 | 0 | 8,650 |
| 2251 | 34 | 268 | 2 | 10 | 35,700 | 3,050 | 0 | 30,450 |
| 2609 | 23 | 244 | 2 | 7 | 11,350 | 5,050 | 2,800 | 24,850 |
| 3407 | 16 | 260 | 2 | 4 | 6,300 | 4,200 | 0 | 6,350 |
| 3793 | 20 | 277 | 3 | 0 | 7,700 | 14,200 | 6,700 | 3,100 |
| 4483 | 36 | 236 | 0 | 7 | 19,250 | 1,100 | 2,800 | 13,750 |
| 4957 | 19 | 247 | 2 | 2 | 4,200 | 2,350 | 150 | 5,650 |
| 5527 | 19 | 316 | 3 | 0 | 11,750 | 6,600 | 2,800 | 8,400 |
| 6113 | 12 | 349 | 2 | 7 | 15,950 | 3,550 | 2,800 | 3,900 |
| 6653 | 35 | 271 | 3 | 2 | 18,500 | 11,600 | 16,000 | 16,500 |
| 7741 | 18 | 232 | 0 | 2 | 5,550 | 300 | 0 | 4,700 |
| 8821 | 7 | 241 | 7 | 0 | 3,750 | 23,000 | 0 | 1,250 |
| 9901 | 24 | 276 | 1 | 7 | 8,950 | 8,100 | 2,800 | 8,150 |
| **14 seeds, after** | **318** | **3,728** | **27** | **52** | **189,200** | **85,300** | **36,850** | **156,650** |
| 14 seeds, before (§1) | 287 | 3,441 | 121 | 34 | 180,250 | 420,000 | 45,650 | 138,150 |
| 3407 JAP→USA, 60 days | 7 (7) | 86 (87) | 2 (3) | | 3,350 | 4,850 (16,250) | 19,800 | 700 |
| 2251 ITA→ENG, 60 days | 9 (7) | 93 (85) | 1 (1) | | 9,650 | 700 (3,100) | 9,200 | 7,650 |

- Sunk by land-based air alone 121 → 27; land air's take of sortied fleets 420,000 → 85,300 hp
  (−80 %). Sea battles 287 → 318, fleets sunk in them 34 → 52: the fleets kept from empty water fight
  elsewhere.
- The 27 left: a median 16 days and 5 strikes from the order (10th percentile 3.2 days and 2, 90th
  249 and 25). 23 had naval-role air over an empty zone at some stand-day and were sunk 0.3 to 6.0
  days after the first such day (median 1.9): inside a nation's turn of the naval AI (`STAGGER`, 7
  days), before it could read the air. 3 had enemy ships in the zone whenever such air was over it;
  1 was sunk before its first stand-day. Seed 8821's 7 are five Soviet fleets at Venice (naval air
  over them from day 674 or 683, sunk 4 to 6 days later) and a Republican Spanish and a Turkish
  fleet that stood 148 and 146 days unbombed, the naval air coming 0.3 and 2.8 days before the loss.
- The `other` column rose 138,150 → 156,650 hp with the more sorties (submarines, anti-air,
  attrition), not this task's.

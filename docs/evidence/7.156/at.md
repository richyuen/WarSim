# PLAN 7.156 — the AT: a fleet in a passage's jump keeps its way through a sea battle's closing (ADR-753)

Run: `tools/diag/seaWayAt.ts <seed> 20` on seeds 1451–1460, from 1938, HEAD `b1d56d92` (a worktree) against the
rule (the working tree, `navalCombat.ts` `closeOn`). Columns as in `docs/evidence/7.155/at.md`, and:
`refusedNoZone`, refusals of a fleet standing on a cell of no sea zone at the hour's end; `standNoZone`, fleet-hours
standing (not under way) on a cell of no sea zone.

```
seed | refused H/R | refusedNoZone H/R | standNoZone H/R | landed H/R | transports y20 H/R
1451 | 88/16 | 72/0 | 137/0 | 2156/2257 | 655/591
1452 | 0/0 | 0/0 | 0/0 | 2357/2357 | 719/719
1453 | 4903/114 | 4899/0 | 838366/0 | 2589/2727 | 692/595
1454 | 39/39 | 0/0 | 0/0 | 2481/2481 | 685/685
1455 | 0/0 | 0/0 | 0/0 | 2957/2957 | 828/828
1456 | 0/0 | 0/0 | 0/0 | 2342/2342 | 489/489
1457 | 110/110 | 0/0 | 0/0 | 3313/3313 | 608/608
1458 | 17909/56 | 17853/0 | 183328/0 | 2798/2876 | 640/560
1459 | 0/0 | 0/0 | 0/0 | 2517/2517 | 546/546
1460 | 12/12 | 0/0 | 0/0 | 2834/2834 | 561/561
refused: HEAD 2306.1 rule 34.7 a world, ratio 0.015
refusedNoZone: HEAD 2282.4 rule 0.0 a world, ratio 0.000
standNoZone: HEAD 102183.1 rule 0.0 a world, ratio 0.000
landed: HEAD 2634.4 rule 2666.1 a world, ratio 1.012
repulsed: HEAD 7.0 rule 7.2 a world, ratio 1.029
transports: HEAD 642.3 rule 618.2 a world, ratio 0.962
```

- Fleet-hours standing on a cell of no sea zone: 102,183 → **0** a world (bar 0): **met**. On HEAD three worlds:
  1453 seven British fleets at Suez from year 1 to year 15 (838,366), 1458 from year 15 on (183,328), 1451 137.
- Refusals for no sea way, years 1–20: 2,306 → 34.7 a world (**0.015 ×**; bar at most 0.5 ×): **met**. Those of a
  fleet on a no-zone cell 2,282 → 0; the 34.7 left are elsewhere (passages shut, as on HEAD: 1454, 1457, 1460 equal).
- Landings 1.01 ×; transports at year 20 0.96 × (not in this AT): the seven worlds with no such fleet are equal to
  the ship; the three that had one took another course (1451 655 → 591, 1453 692 → 595, 1458 640 → 560).
- Unit test: `tests/unit/closeCanal1938.test.ts` (2), both red without the rule.

## The cause, read

A tap at the first hour a fleet stood on a no-zone cell (1453, hour 8,367): seven British fleets under way in the
Suez canal's jump (step 191 of 868, 73 % through), in a sea battle, out of reach of the enemy: `closeOn` dropped
their way first (`moving = 0`, the path deleted) and then asked `orderSail` for one; with no step under way it
sails from the cell under the fleet, land of no sea zone, and refused (`NoSeaWay`). They stood there 13 years, every
order refused. The case filed from 7.155 (a closing that ends its hour inside a jump, Balboa on 1448) is the same
function's other half; the first arm of this run, with only that half mended, was equal to HEAD on all ten seeds.

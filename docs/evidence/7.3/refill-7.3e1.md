# PLAN 7.3e1: seed 7321, land formations in contact, with refills (`.cache/73e1/contact.ts`, 2026-10-16)

The probe of 7.3b (`.cache/7321/contact.ts`) with the Soviet pool, gold and life added. In the log of
the code before the change the pool and gold columns are stale (the probe held the nations' columns of
year 3; the table moved to new arrays as nations were founded): they are cut here. Its figures from the
checkpoints instead: year 9, the pool 6.58 M, gold 3,201, income 744; year 12, gold 2,702, income 755.

## Before the change (HEAD `bba24c9`)
```
year  1: at its start 0 in contact of 1054 land formations (9777k men; SOV 162; 7 nations at war); mean a day 41.0
year  2: at its start 8 in contact of 797 land formations (4955k men; SOV 162; 55 nations at war); mean a day 16.2
year  3: at its start 0 in contact of 693 land formations (4366k men; SOV 115; 43 nations at war); mean a day 6.0
year  4: at its start 20 in contact of 728 land formations (4653k men; SOV 118; 43 nations at war); mean a day 11.9
year  5: at its start 12 in contact of 743 land formations (4950k men; SOV 114; 55 nations at war); mean a day 1.1
year  6: at its start 15 in contact of 788 land formations (5623k men; SOV 111; 43 nations at war); mean a day 2.0
year  7: at its start 0 in contact of 806 land formations (5730k men; SOV 108; 25 nations at war); mean a day 15.1
year  8: at its start 21 in contact of 732 land formations (4644k men; SOV 67; 55 nations at war); mean a day 7.8
year  9: at its start 0 in contact of 643 land formations (4532k men; SOV 10; 44 nations at war); mean a day 1.5
year 10: at its start 0 in contact of 672 land formations (4403k men; SOV 1; 52 nations at war); mean a day 0.2
year 11: at its start 2 in contact of 696 land formations (5034k men; SOV 2; 39 nations at war); mean a day 0.8
year 12: at its start 2 in contact of 698 land formations (5087k men; SOV 0; 51 nations at war); mean a day 0.7
year 13: at its start 2 in contact of 665 land formations (4748k men; SOV 1; 54 nations at war); mean a day 0.4
year 14: at its start 0 in contact of 667 land formations (5024k men; SOV 1; 51 nations at war); mean a day 1.6
year 15: at its start 6 in contact of 591 land formations (4652k men; SOV 2; 56 nations at war); mean a day 0.9
year 16: at its start 0 in contact of 625 land formations (5125k men; SOV 4; 38 nations at war); mean a day 0.5
year 17: at its start 0 in contact of 635 land formations (5342k men; SOV 4; 56 nations at war); mean a day 0.4
year 18: at its start 0 in contact of 677 land formations (5814k men; SOV 7; 48 nations at war); mean a day 0.4
year 19: at its start 0 in contact of 679 land formations (5877k men; SOV 5; 55 nations at war); mean a day 0.4
year 20: at its start 0 in contact of 701 land formations (5519k men; SOV 5; 50 nations at war); mean a day 0.4
done
```

## Attempt 1 (not kept): a daily refill in the production system, 1% a day, a month of income kept
```
year  1: at its start 0 in contact of 1054 land formations (9777k men; SOV 162; 7 nations at war); mean a day 36.1; SOV pool 2865k gold 478 living 1
year  2: at its start 27 in contact of 665 land formations (4445k men; SOV 117; 48 nations at war); mean a day 11.0; SOV pool 4294k gold 1292 living 1
year  3: at its start 0 in contact of 556 land formations (3461k men; SOV 95; 42 nations at war); mean a day 5.0; SOV pool 5198k gold 1047 living 1
year  4: at its start 22 in contact of 588 land formations (4111k men; SOV 94; 45 nations at war); mean a day 3.7; SOV pool 5306k gold 1040 living 1
year  5: at its start 2 in contact of 587 land formations (4326k men; SOV 85; 48 nations at war); mean a day 2.5; SOV pool 5289k gold 1025 living 1
year  6: at its start 0 in contact of 566 land formations (4486k men; SOV 81; 50 nations at war); mean a day 3.6; SOV pool 5246k gold 920 living 1
year  7: at its start 2 in contact of 549 land formations (4454k men; SOV 13; 60 nations at war); mean a day 0.6; SOV pool 5230k gold 735 living 1
year  8: at its start 3 in contact of 528 land formations (4443k men; SOV 2; 55 nations at war); mean a day 0.9; SOV pool 5218k gold 1766 living 1
year  9: at its start 0 in contact of 564 land formations (4834k men; SOV 0; 56 nations at war); mean a day 2.1; SOV pool 5206k gold 3139 living 1
year 10: at its start 0 in contact of 571 land formations (4946k men; SOV 1; 46 nations at war); mean a day 1.6; SOV pool 5155k gold 2822 living 1
year 11: at its start 0 in contact of 576 land formations (5039k men; SOV 4; 39 nations at war); mean a day 0.9; SOV pool 5126k gold 3693 living 1
year 12: at its start 0 in contact of 599 land formations (5452k men; SOV 5; 37 nations at war); mean a day 0.8; SOV pool 5035k gold 813 living 1
year 13: at its start 2 in contact of 629 land formations (5329k men; SOV 3; 42 nations at war); mean a day 0.0; SOV pool 4996k gold 2900 living 1
year 14: at its start 0 in contact of 631 land formations (5598k men; SOV 4; 44 nations at war); mean a day 0.2; SOV pool 4933k gold 3472 living 1
year 15: at its start 0 in contact of 616 land formations (5541k men; SOV 10; 40 nations at war); mean a day 0.4; SOV pool 4871k gold 3176 living 1
year 16: at its start 0 in contact of 615 land formations (5633k men; SOV 15; 51 nations at war); mean a day 0.4; SOV pool 4828k gold 3623 living 1
year 17: at its start 0 in contact of 623 land formations (5914k men; SOV 18; 34 nations at war); mean a day 0.0; SOV pool 4765k gold 4023 living 1
year 18: at its start 0 in contact of 645 land formations (5987k men; SOV 23; 46 nations at war); mean a day 0.0; SOV pool 4703k gold 3861 living 1
year 19: at its start 0 in contact of 653 land formations (6151k men; SOV 28; 48 nations at war); mean a day 0.0; SOV pool 4650k gold 4212 living 1
year 20: at its start 0 in contact of 666 land formations (6392k men; SOV 32; 38 nations at war); mean a day 0.3; SOV pool 4591k gold 3499 living 1
done
```

## Attempt 2 (not kept): step 3a of the economic AI, monthly, 30% a month, under the bounds of a new order, before the orders
```
year  1: at its start 0 in contact of 1054 land formations (9777k men; SOV 162; 7 nations at war); mean a day 42.8; SOV pool 2714k gold 4552 living 1
year  2: at its start 12 in contact of 727 land formations (4447k men; SOV 162; 52 nations at war); mean a day 17.8; SOV pool 4767k gold 14052 living 1
year  3: at its start 0 in contact of 601 land formations (3704k men; SOV 171; 51 nations at war); mean a day 5.8; SOV pool 7349k gold 9914 living 1
year  4: at its start 32 in contact of 581 land formations (4163k men; SOV 172; 55 nations at war); mean a day 12.9; SOV pool 9172k gold 7565 living 1
year  5: at its start 0 in contact of 491 land formations (3639k men; SOV 123; 58 nations at war); mean a day 3.7; SOV pool 9016k gold 6781 living 1
year  6: at its start 0 in contact of 482 land formations (4231k men; SOV 85; 52 nations at war); mean a day 0.5; SOV pool 8910k gold 6038 living 1
year  7: at its start 0 in contact of 512 land formations (4848k men; SOV 80; 50 nations at war); mean a day 0.1; SOV pool 8874k gold 6480 living 1
year  8: at its start 0 in contact of 543 land formations (5198k men; SOV 80; 48 nations at war); mean a day 0.5; SOV pool 8789k gold 7474 living 1
year  9: at its start 6 in contact of 569 land formations (5260k men; SOV 81; 40 nations at war); mean a day 1.3; SOV pool 8695k gold 7822 living 1
year 10: at its start 0 in contact of 544 land formations (5215k men; SOV 73; 44 nations at war); mean a day 1.2; SOV pool 8579k gold 8089 living 1
year 11: at its start 0 in contact of 510 land formations (4949k men; SOV 74; 38 nations at war); mean a day 0.6; SOV pool 8449k gold 9247 living 1
year 12: at its start 0 in contact of 510 land formations (5080k men; SOV 53; 42 nations at war); mean a day 1.7; SOV pool 8277k gold 9397 living 1
year 13: at its start 2 in contact of 527 land formations (5223k men; SOV 62; 44 nations at war); mean a day 0.8; SOV pool 8120k gold 9011 living 1
year 14: at its start 0 in contact of 545 land formations (5389k men; SOV 73; 35 nations at war); mean a day 0.3; SOV pool 7995k gold 9317 living 1
year 15: at its start 2 in contact of 542 land formations (5389k men; SOV 83; 46 nations at war); mean a day 0.1; SOV pool 8185k gold 6158 living 1
year 16: at its start 0 in contact of 550 land formations (5372k men; SOV 95; 46 nations at war); mean a day 1.3; SOV pool 8125k gold 6666 living 1
year 17: at its start 0 in contact of 562 land formations (5680k men; SOV 82; 46 nations at war); mean a day 0.4; SOV pool 8027k gold 6933 living 1
year 18: at its start 0 in contact of 539 land formations (5644k men; SOV 63; 49 nations at war); mean a day 0.9; SOV pool 7950k gold 6673 living 1
year 19: at its start 0 in contact of 549 land formations (5610k men; SOV 60; 39 nations at war); mean a day 1.8; SOV pool 7892k gold 7717 living 1
year 20: at its start 0 in contact of 529 land formations (5377k men; SOV 50; 42 nations at war); mean a day 0.5; SOV pool 10504k gold 7054 living 1
done
```

## What binds the Soviet Union at the month after year 9, attempt 2 (`.cache/73e1/bind.ts`)
```
{
  tick: 78888,
  atWar: true,
  aggression: 70,
  income: 2281.82059963286,
  balance: 887.9398542290605,
  need: 114.09102998164302,
  research: 110.90203037955607,
  army: 425.68728331708394,
  training: 6.055,
  cap: 1369.0923597797162,
  gold: 7813.558772518634,
  goldSpare: 968.0969736200532,
  pool: 8695020.633333335,
  refillable: 3,
  missing: 1935,
  fail: { whole: 58, notOwnCell: 12 }
}
```

Attempt 2's quick sweep (seeds 1–10 × 30 years): `quick-7.3e1-attempt2.md`, no break-up 6 of 10.

## Seed 1, the Soviet Union's formations a year (`.cache/73e1/disband.ts`): why the orders go first
Books at each year's start; "destroyed" counts every formation that ended, "disbanded" those the
economic AI sent home.

### HEAD
```
seed 1 year 1: SOV land formations at start 162, spawned 0, destroyed 7 (of them disbanded 0); income 1156 balance-need -463 army 1085 cap 320 gold 3381 pool 2.69M atWar false
seed 1 year 2: SOV land formations at start 162, spawned 0, destroyed 63 (of them disbanded 54); income 1189 balance-need -381 army 1011 cap 713 gold 270 pool 4.20M atWar true
seed 1 year 3: SOV land formations at start 107, spawned 0, destroyed 16 (of them disbanded 2); income 1251 balance-need -59 army 734 cap 751 gold 780 pool 4.78M atWar true
seed 1 year 4: SOV land formations at start 100, spawned 0, destroyed 9 (of them disbanded 0); income 1598 balance-need 260 army 611 cap 442 gold 4199 pool 8.12M atWar false
seed 1 year 5: SOV land formations at start 98, spawned 2, destroyed 12 (of them disbanded 0); income 1373 balance-need 101 army 526 cap 824 gold 5070 pool 10.33M atWar true
seed 1 year 6: SOV land formations at start 89, spawned 6, destroyed 8 (of them disbanded 0); income 1539 balance-need 312 army 431 cap 924 gold 4459 pool 10.80M atWar true
seed 1 year 7: SOV land formations at start 86, spawned 5, destroyed 10 (of them disbanded 0); income 1430 balance-need 287 army 341 cap 858 gold 4976 pool 10.80M atWar true
seed 1 year 8: SOV land formations at start 79, spawned 7, destroyed 6 (of them disbanded 0); income 1434 balance-need 349 army 310 cap 860 gold 5300 pool 11.56M atWar true
seed 1 year 9: SOV land formations at start 78, spawned 6, destroyed 5 (of them disbanded 0); income 1341 balance-need 362 army 301 cap 805 gold 4366 pool 11.51M atWar true
seed 1 year 10: SOV land formations at start 78, spawned 4, destroyed 3 (of them disbanded 0); income 1296 balance-need 291 army 306 cap 777 gold 4730 pool 11.49M atWar true
done
```

### Attempt 2 (refills before the orders): no formation raised in ten years
```
seed 1 year 1: SOV land formations at start 162, spawned 0, destroyed 11 (of them disbanded 0); income 1156 balance-need -463 army 1085 cap 320 gold 3717 pool 2.68M atWar false
seed 1 year 2: SOV land formations at start 159, spawned 0, destroyed 8 (of them disbanded 0); income 1205 balance-need -303 army 935 cap 723 gold 2217 pool 3.97M atWar true
seed 1 year 3: SOV land formations at start 157, spawned 0, destroyed 20 (of them disbanded 18); income 1255 balance-need -203 army 914 cap 753 gold 297 pool 4.92M atWar true
seed 1 year 4: SOV land formations at start 138, spawned 0, destroyed 29 (of them disbanded 23); income 1374 balance-need -149 army 830 cap 824 gold 1761 pool 6.08M atWar true
seed 1 year 5: SOV land formations at start 111, spawned 0, destroyed 19 (of them disbanded 0); income 1234 balance-need 171 army 538 cap 740 gold 5197 pool 6.52M atWar true
seed 1 year 6: SOV land formations at start 93, spawned 0, destroyed 10 (of them disbanded 0); income 1673 balance-need 575 army 324 cap 1004 gold 4868 pool 7.97M atWar true
seed 1 year 7: SOV land formations at start 83, spawned 0, destroyed 26 (of them disbanded 0); income 1421 balance-need 469 army 260 cap 853 gold 3920 pool 7.90M atWar true
seed 1 year 8: SOV land formations at start 58, spawned 0, destroyed 47 (of them disbanded 0); income 1142 balance-need 352 army 229 cap 685 gold 2641 pool 7.84M atWar true
seed 1 year 9: SOV land formations at start 15, spawned 0, destroyed 12 (of them disbanded 0); income 761 balance-need 343 army 34 cap 456 gold 2672 pool 7.79M atWar true
seed 1 year 10: SOV land formations at start 9, spawned 3, destroyed 6 (of them disbanded 0); income 742 balance-need 404 army 25 cap 445 gold 3115 pool 7.76M atWar true
done
```

### Kept (attempt 3, refills after the orders)
```
seed 1 year 1: SOV land formations at start 162, spawned 0, destroyed 9 (of them disbanded 0); income 1156 balance-need -463 army 1085 cap 320 gold 3645 pool 2.69M atWar false
seed 1 year 2: SOV land formations at start 162, spawned 0, destroyed 54 (of them disbanded 53); income 1228 balance-need -346 army 1021 cap 737 gold 345 pool 4.14M atWar true
seed 1 year 3: SOV land formations at start 109, spawned 0, destroyed 27 (of them disbanded 16); income 1185 balance-need -146 army 771 cap 711 gold 938 pool 4.57M atWar true
seed 1 year 4: SOV land formations at start 88, spawned 0, destroyed 7 (of them disbanded 0); income 1169 balance-need 86 army 584 cap 702 gold 3337 pool 4.70M atWar true
seed 1 year 5: SOV land formations at start 81, spawned 0, destroyed 2 (of them disbanded 0); income 1216 balance-need 395 army 541 cap 336 gold 3771 pool 4.90M atWar false
seed 1 year 6: SOV land formations at start 81, spawned 0, destroyed 7 (of them disbanded 0); income 1200 balance-need 125 army 504 cap 720 gold 3845 pool 4.88M atWar true
seed 1 year 7: SOV land formations at start 74, spawned 2, destroyed 24 (of them disbanded 0); income 1199 balance-need 198 army 411 cap 720 gold 3906 pool 4.85M atWar true
seed 1 year 8: SOV land formations at start 52, spawned 2, destroyed 32 (of them disbanded 0); income 1196 balance-need 357 army 278 cap 718 gold 5988 pool 5.74M atWar true
seed 1 year 9: SOV land formations at start 29, spawned 3, destroyed 5 (of them disbanded 0); income 1679 balance-need 850 army 92 cap 1007 gold 5776 pool 6.23M atWar true
seed 1 year 10: SOV land formations at start 27, spawned 1, destroyed 1 (of them disbanded 0); income 1480 balance-need 641 army 112 cap 888 gold 6820 pool 6.78M atWar true
done
```
Still 8 raised in ten years against HEAD's 30: the refills of a month take the treasury down to
the reserve of a new order (RESERVE_MONTHS of income), and an order wants that and its price.
Left to PLAN 7.3e3 with the pool.

## Kept (attempt 3): step 3a after the army's orders
```
year  1: at its start 0 in contact of 1054 land formations (9777k men; SOV 162; 7 nations at war); mean a day 38.3; SOV pool 2714k gold 4426 living 1
year  2: at its start 2 in contact of 787 land formations (5061k men; SOV 162; 54 nations at war); mean a day 11.4; SOV pool 4028k gold 2996 living 1
year  3: at its start 35 in contact of 752 land formations (4367k men; SOV 160; 52 nations at war); mean a day 16.2; SOV pool 6220k gold 4643 living 1
year  4: at its start 34 in contact of 708 land formations (3998k men; SOV 155; 45 nations at war); mean a day 5.6; SOV pool 7628k gold 10113 living 1
year  5: at its start 0 in contact of 689 land formations (4380k men; SOV 133; 53 nations at war); mean a day 8.8; SOV pool 7465k gold 7224 living 1
year  6: at its start 8 in contact of 694 land formations (4706k men; SOV 128; 65 nations at war); mean a day 8.1; SOV pool 7629k gold 11161 living 1
year  7: at its start 11 in contact of 685 land formations (4693k men; SOV 122; 48 nations at war); mean a day 4.3; SOV pool 9876k gold 15669 living 1
year  8: at its start 0 in contact of 646 land formations (5023k men; SOV 129; 42 nations at war); mean a day 3.2; SOV pool 9710k gold 8000 living 1
year  9: at its start 0 in contact of 654 land formations (5316k men; SOV 124; 47 nations at war); mean a day 3.7; SOV pool 9532k gold 13645 living 1
year 10: at its start 19 in contact of 684 land formations (5535k men; SOV 126; 44 nations at war); mean a day 9.2; SOV pool 9245k gold 7293 living 1
year 11: at its start 0 in contact of 649 land formations (5355k men; SOV 108; 39 nations at war); mean a day 0.9; SOV pool 9153k gold 4296 living 1
year 12: at its start 2 in contact of 684 land formations (5944k men; SOV 109; 22 nations at war); mean a day 5.8; SOV pool 9119k gold 3442 living 1
year 13: at its start 0 in contact of 630 land formations (5167k men; SOV 63; 40 nations at war); mean a day 5.5; SOV pool 9078k gold 3405 living 1
year 14: at its start 0 in contact of 544 land formations (4842k men; SOV 0; 44 nations at war); mean a day 1.4; SOV pool 9027k gold 3282 living 1
year 15: at its start 3 in contact of 518 land formations (4924k men; SOV 1; 44 nations at war); mean a day 1.8; SOV pool 8967k gold 3559 living 1
year 16: at its start 0 in contact of 535 land formations (5115k men; SOV 2; 48 nations at war); mean a day 1.1; SOV pool 8901k gold 1222 living 1
year 17: at its start 0 in contact of 547 land formations (5228k men; SOV 1; 40 nations at war); mean a day 10.4; SOV pool 8888k gold 2537 living 1
year 18: at its start 0 in contact of 540 land formations (4869k men; SOV 1; 45 nations at war); mean a day 1.2; SOV pool 8863k gold 3107 living 1
year 19: at its start 0 in contact of 514 land formations (5134k men; SOV 2; 45 nations at war); mean a day 4.5; SOV pool 8849k gold 4190 living 1
year 20: at its start 0 in contact of 530 land formations (5137k men; SOV 1; 41 nations at war); mean a day 0.8; SOV pool 8811k gold 4285 living 1
done
```
The Soviet Union has 63 land formations at the start of year 13 and none at the start of year 14.
Land formations in contact a day, years 13–20: 5.5, 1.4, 1.8, 1.1, 10.4, 1.2, 4.5, 0.8 (mean 3.3,
median 1.6), against HEAD's 0.4, 1.6, 0.9, 0.5, 0.4, 0.4, 0.4, 0.4 (mean 0.6).

### What binds the Soviet Union at the month after year 9, kept rule
```
{
  tick: 78888,
  atWar: true,
  aggression: 70,
  income: 3844.447438727623,
  balance: 2161.9849643740345,
  need: 192.22237193638117,
  research: 120,
  army: 429.6132691199491,
  training: 15.015,
  cap: 2306.6684632365736,
  gold: 13635.66174524163,
  goldSpare: 2102.3194290587617,
  pool: 9531533.333333332,
  refillable: 88,
  missing: 489173,
  fail: { whole: 25, supply: 4, engaged: 4, notOwnCell: 7 }
}
```
88 formations may be refilled, 489k men short; the army's upkeep 430 of a cap of 2,307 and the
balance 2,162 over a need of 192: the treasury binds, 13,636 gold with 11,533 kept as the reserve
(3 × 3,844), 2,102 to spend at 0.1 gold a man (21k men). The pool of 9.5 M is held by gold, not by
the refills' rule (PLAN 7.3e3).

Quick sweep (seeds 1–10 × 30 years): `quick-7.3e1.md`.

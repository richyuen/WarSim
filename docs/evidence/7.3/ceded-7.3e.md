# PLAN 7.3e: land given back by revolt (`LandCeded`), seeds 1 and 3 × 10 years, HEAD `76f8662` (2026-10-16)

Probes `.cache/73e/ceded.ts` (by pair: the former holder -> the core nation) and `.cache/73e/where.ts` (where, and the core of the province in 1938). ADR-434.

```
seed 1, 10 years: LandCeded 396 (7 24 51 52 42 59 39 49 43 30 a year), RevoltSpawned 43
pairs 96; pairs with 3+ months running 12 (200 events)
  GER->FRA: 41 (longest run 4 months)
  SOV->RAJ: 40 (longest run 3 months)
  ITA->YUG: 20 (longest run 3 months)
  POL->LAT: 16 (longest run 4 months)
  SOV->INC: 15 (longest run 6 months)
  GER->HUN: 12 (longest run 3 months)
  ENG->ITA: 12 (longest run 3 months)
  SOV->FRA: 12 (longest run 3 months)
  POL->ROM: 11 (longest run 2 months)
  BEL->FRA: 10 (longest run 3 months)
  SOV->ROM: 9 (longest run 4 months)
  SOV->EGY: 9 (longest run 2 months)
  ITA->FRA: 8 (longest run 2 months)
  ALB->YUG: 7 (longest run 2 months)
  GER->SWI: 7 (longest run 1 months)
seed 3, 10 years: LandCeded 582 (6 33 48 68 46 60 69 48 90 114 a year), RevoltSpawned 39
pairs 94; pairs with 3+ months running 9 (383 events)
  SOV->FRA: 100 (longest run 11 months)
  SOV->ITA: 62 (longest run 5 months)
  SOV->YUG: 52 (longest run 6 months)
  SOV->#105: 39 (longest run 8 months)
  SOV->ENG: 35 (longest run 8 months)
  SOV->ROM: 31 (longest run 5 months)
  SOV->NSP: 31 (longest run 3 months)
  SOV->LAT: 24 (longest run 4 months)
  SOV->POL: 13 (longest run 2 months)
  JAP->FRA: 11 (longest run 2 months)
  SOV->SUD: 10 (longest run 1 months)
  SOV->TUR: 9 (longest run 2 months)
  CHI->JAP: 9 (longest run 3 months)
  SIN->RAJ: 7 (longest run 1 months)
  CHI->FRA: 7 (longest run 1 months)
```

## Seed 3: where

```
y1.33 SOV->YUG at 1114,315 province 1664: core in 1938 YUG, now YUG
y1.33 SOV->YUG at 1109,320 province 820: core in 1938 YUG, now YUG
y1.33 SOV->YUG at 1106,316 province 3385: core in 1938 YUG, now YUG
y1.92 SOV->FRA at 1061,298 province 4467: core in 1938 FRA, now FRA
y2.00 SOV->ITA at 1074,305 province 768: core in 1938 SWI, now ITA
y2.08 SOV->FRA at 1048,294 province 4464: core in 1938 FRA, now FRA
y2.25 SOV->FRA at 1058,287 province 197: core in 1938 LUX, now FRA
y2.50 SOV->ITA at 1077,306 province 3401: core in 1938 SWI, now ITA
y2.67 SOV->ITA at 1068,307 province 3231: core in 1938 SWI, now ITA
SOV->YUG: by 1938 core YUG 52
SOV->FRA: by 1938 core FRA 53, LUX 4, AEF 8, AOF 34, POR 1
SOV->ITA: by 1938 core SWI 9, ITA 53
```

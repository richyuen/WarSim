# PLAN 7.155 — the AT: the transports sail for no port on a lake (ADR-752)

Run: `tools/diag/seaWayAt.ts <seed> 20` on seeds 1441–1450, from 1938, HEAD `babbff71` (a worktree) against the
rule (the working tree, `invasion.ts` `sailToArmy`). `refused`: fleet sailings refused for no sea way; `landed`:
formations landed from the sea (`FormationLanded`); `repulsed`: landings thrown back; `transports`: transport ships
afloat at the year's end.

```
seed | refused y1-20 H/R | refused y1 H/R | landed y1-20 H/R | repulsed H/R | transports y20 H/R
1441 | 1657/92 | 0/0 | 2777/2644 | 5/2 | 620/534
1442 | 1198/4353 | 0/0 | 2889/2807 | 2/3 | 696/700
1443 | 610/16 | 0/0 | 1772/1772 | 13/13 | 566/566
1444 | 6868/0 | 1/0 | 2996/2125 | 4/1 | 924/622
1445 | 1982/0 | 0/0 | 2199/2834 | 8/2 | 441/718
1446 | 2158/0 | 0/0 | 3183/3075 | 7/1 | 624/628
1447 | 775/0 | 0/0 | 2383/2666 | 1/3 | 588/402
1448 | 201/37650 | 116/0 | 2004/2473 | 0/4 | 447/523
1449 | 7585/336 | 0/0 | 2756/2983 | 3/1 | 798/828
1450 | 6593/32 | 626/0 | 2364/2387 | 6/2 | 390/491
ref: HEAD 2962.7 rule 4247.9 a world, ratio 1.434
ref1: HEAD 74.3 rule 0 a world, ratio 0.000
land: HEAD 2532.3 rule 2576.6 a world, ratio 1.017
rep: HEAD 4.9 rule 3.2 a world, ratio 0.653
tr: HEAD 609.4 rule 601.2 a world, ratio 0.987
```

- Refusals for no sea way, years 1–20: 2,963 → 4,248 a world (**1.43 ×**; bar at most 0.5 ×): **missed**. Year 1
  74.3 → 0. Lower on 8 of 10 (to 0 on five); higher on 1448 (201 → 37,650) and 1442 (1,198 → 4,353).
- Landings, years 1–20: 2,532 → 2,577 (**1.02 ×**; bar not below): met.
- Transports at year 20: 609.4 → 601.2 (**0.99 ×**; bar not below): missed by a hair (lower on 4, higher on 5; 1444
  924 → 622 and 1447 588 → 402 against 1445 441 → 718: ten-seed spread).
- Unit test: `tests/unit/ferryLakePorts1938.test.ts`, red without the rule (64 refusals in 30 days).

## The refusals left: a fleet on a canal's crossing cells

Read with the same tap as `read.md` (`seaWayWhere`, by cause and caller), on 1448 years 1–9 with the rule: 8,370
refusals, 8,366 with the fleet's own cell in no sea zone ("origin no zone"), 8,255 of them from the sea battle's
closing step (`closeOn`, `navalCombat.ts`), 111 from the naval AI's `awayOrder`, 4 a passage shut (`raid`).

```
JAP origin no zone: from near Balboa (1) z0 → near Balboa (4) z47       6,569
JAP origin no zone: from near Balboa (1) z0 → near Balboa (20) z47        952
NED origin no zone: from near Suez (0) z0 → Suez z274                     462
JAP origin no zone: from near Balboa (1) z0 → near David (11) z77         267
JAP origin no zone: from near Balboa (1) z0 → Kingston z47                107
```

A Japanese fleet stands on the Panama canal's cells (a Dutch one on Suez's), with no sea zone under it, and every
order to it is refused, hour after hour, in a sea battle it closes in. No lake port, no `sailToArmy`: the rule is
not on this path (`closeOn`, `awayOrder`, `orderSail`); 1448's world took another course with it. Filed as
PLAN 7.156 (BLOCKERS).

1442 years 1–20 with the rule: 4,353 refusals, all "origin no zone", all at Balboa: the USA's fleets (and Britain's,
388) on the canal's cells, by `awayOrder` 1,722, `closeOn` 1,719, `sailHome` 692, `raid` 220. On HEAD's code 1448
years 1–9 reads 116 lake-port refusals (Canada, `sailToArmy`) and 10 a passage shut, no fleet on a canal: the canal
case is the worlds' course, not the rule.

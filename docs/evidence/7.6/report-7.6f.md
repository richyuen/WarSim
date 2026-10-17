# PLAN 7.6f: the AT's sweep (critic R7-B1)

## What was run

- `npm run sweep -- --seeds 10 --years 30 --scratch --tag 7.6f` on `0d7af5d` (7.6a to 7.6e): limits
  and the nuclear table below (`sweep-7.6f.md`, the report as written). Limits 10 of 10, riser and
  faller 10 of 10, break-up 10 of 10, stasis 9 of 10, as PLAN 7.3g's (`docs/evidence/7.3/quick-7.3g.md`).
  Nukes used in 4 of 10 seeds (32 decisions), against 4 of 10 (21) there and 2 of 10 (4) in the
  critic's and `gates-before.md`'s runs at `19e2341`.
- Every strike of the four seeds with strikes, on the final code (with 7.6f's two fixes, ADR-465's
  addendum): who, on whose land, and whether a capital. The fixes act only after a burst, so the six
  seeds without one are the sweep's runs unchanged.

## The strikes (final code)

**Seed 1** (5 decisions, as many bursts):
- day 4082 (1949): SOV on CHI's land, capital of CHI (1630.4, 424.1)
- day 4083 (1949): SOV on CHI's land (1561.1, 274.1)
- day 4827 (1951): SOV on #115's land, capital of #115 (1276.5, 400.3)
- day 10740 (1967): ENG on SWE's land (1098.5, 243.5)
- day 10741 (1967): GER on ENG's land, capital of ENG (1023.3, 275.2)

**Seed 3** (6 decisions, as many bursts):
- day 6341 (1955): GER on SOV's land (1131.5, 548.5)
- day 6342 (1955): SOV on GER's land, capital of GER (1080.9, 259.5)
- day 7001 (1957): GER on AUT's land, capital of AUT (1117.1, 299.6)
- day 7002 (1957): GER on CZS's land, capital of CZS (1127.8, 287.7)
- day 7162 (1957): GER on ENG's land, capital of ENG (1022.8, 565.6)
- day 7163 (1957): SOV on GER's land, capital of GER (1067.3, 271.6)

**Seed 5** (18 decisions, as many bursts):
- day 9035 (1962): SOV on JAP's land, capital of JAP (1794.6, 391.3)
- day 9036 (1962): SOV on JAP's land (1830.5, 272.5)
- day 9037 (1962): SOV on CHI's land, capital of CHI (1630.4, 424.1)
- day 9038 (1962): SOV on NEP's land, capital of NEP (1488.3, 433.4)
- day 9039 (1962): SOV on CHI's land (1608.1, 477.1)
- day 9040 (1962): SOV on NEP's land (1460.5, 511.7)
- day 9041 (1962): SOV on CHI's land (1670.9, 116.1)
- day 9067 (1962): SOV on CHI's land (1698.3, 174.5)
- day 9074 (1962): SOV on LAT's land, capital of LAT (1161.1, 232.5)
- day 9075 (1962): LAT on SOV's land, capital of SOV (1238.0, 242.1)
- day 9097 (1962): SOV on CHI's land (1400.4, 213.6)
- day 9098 (1962): SOV on CHI's land (1672.5, 115.5)
- day 9116 (1962): SOV on ENG's land, capital of ENG (1023.3, 275.2)
- day 9117 (1962): SOV on RAJ's land, capital of RAJ (1551.6, 530.6)
- day 9117 (1962): ENG on SOV's land (1253.5, 304.0)
- day 9118 (1962): SOV on ENG's land (1027.5, 274.5)
- day 9119 (1962): ENG on SOV's land (1791.9, 198.9)
- day 9211 (1963): SOV on CHI's land (1465.3, 348.3)

**Seed 6** (4 decisions, as many bursts):
- day 9156 (1963): #108 on ENG's land, capital of ENG (1023.3, 275.2)
- day 9157 (1963): SOV on #108's land, capital of #108 (1073.4, 285.7)
- day 9157 (1963): #108 on ENG's land (1031.5, 277.5)
- day 9158 (1963): SOV on #108's land (1073.3, 291.5)

## The AT

- **Strikes in at least 4 seeds, by more than one nation:** 4 seeds (1, 3, 5, 6); 33 decisions by 5
  nations: the Soviet Union, the United Kingdom, Germany, Latvia and one founded in play (#108).
- **No warhead on a place struck within a blast radius in the year before unless the enemy massed
  there again:** no burst within a blast radius of a burst on a capital of the year before, in any
  seed (before 7.6f's fix: Tokyo three times in 32 days, at formations Japan raised there). The
  places struck near London on the days after a strike there (seed 5, day 9118; seed 6, day 9157)
  are massed men outside its blast radius.
- **A nuclear power struck by a nation it is at war with answers it:** every strike on a nuclear
  power's realm is answered the next day: seed 3 Germany ↔ the Soviet Union, and the Soviet Union for
  its puppet the United Kingdom (day 7163); seed 5 the Soviet Union ↔ Latvia and ↔ the United Kingdom
  (two strikes, two answers); seed 6 the Soviet Union for the United Kingdom, twice; seed 1 Germany
  for Sweden. Unanswered: strikes on nations without a warhead (China, Japan, Nepal, Austria,
  Czechoslovakia, the British Raj).
- **A nuclear power losing a war for its life that struck once strikes again while it keeps
  losing:** the critic's France, `nukeStrikeAgain1938.test.ts` (days 39, 41, 90).
- **Unit tests of each rule:** `nukeDesperationMen1938`, `nukeDeliveryWing1938`, `nukeAimExtreme1938`,
  `nukeStrikeAgain1938`, `nukeWhereWhom1938` (red before each rule).

## Left

- Seed 5's Soviet Union decides 14 strikes in 1962, days 9035 to 9118, on 14 places of
  6 nations (CHI, ENG, JAP, LAT, NEP, RAJ): a nuclear war, each strike on a place not struck before.
  Not a rule broken; the critic's to judge.

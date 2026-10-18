# PLAN 7.26d: the 7.26 AT on 10 seeds × 30 years (2026-10-18)

Code: `edd105e` (after 7.26b, c1a, c2a). Seeds 1–10, unseen by 7.26's tuning; the critic's run 8
files of the same seeds (`critic/c8_headless_q<n>.json`, code `fd27e85`) are the before. Both judged
by one script, `tools/diag/airAt.ts`; the after measured by `tools/diag/airWar.ts <seed> 30`, ten
side by side, nothing else running.

## Definitions (fixed before the run)

- **Sorties aloft:** the mean of `world.sorties.size` over the year's hours, sampled every hour
  (the critic's `meanSortiesAloft`; `airWar.ts`'s `aloft`, the same sampling).
- **A year with a war:** a day of it ended with a war running (`airWar.ts`'s `warDays` > 0). The
  critic's files have only the year's last day (`wars` > 0). Every year 2–30 of every seed is one,
  on either code, so the two readings agree here.
- **The bar:** half of that seed's own year 1, years 2–30. A seed passes when every war-year
  reaches it; the AT wants 8 of 10.
- **Air battles:** `AirBattle` events of years 21–30 against years 1–10; no threshold is given, the
  ratio is reported.

## The verdict

**0 of 10 seeds pass, before and after.** War-years at the bar, of 29: before 0–3, after 0–3.

| seed | year 1 before → after | years 2–10 mean | years 21–30 mean | lowest of year 1 after | air battles 1–10 → 21–30 after |
|---|---|---|---|---|---|
| 1 | 34.1 → 50.4 | 7.0 → 13.4 | 9.8 → 8.3 | 0.12 | 4,629 → 426 (0.09) |
| 2 | 31.4 → 51.2 | 8.2 → 15.1 | 3.2 → 12.9 | 0.04 | 5,867 → 3,130 (0.53) |
| 3 | 31.4 → 44.9 | 5.1 → 15.0 | 5.9 → 10.2 | 0.09 | 4,716 → 3,570 (0.76) |
| 4 | 30.2 → 38.8 | 11.1 → 18.4 | 4.1 → 11.1 | 0.20 | 5,027 → 612 (0.12) |
| 5 | 39.3 → 52.3 | 6.0 → 17.8 | 4.8 → 11.0 | 0.07 | 5,151 → 1,478 (0.29) |
| 6 | 32.8 → 49.9 | 7.1 → 14.8 | 4.6 → 6.7 | 0.08 | 4,408 → 797 (0.18) |
| 7 | 33.1 → 51.1 | 7.9 → 15.7 | 5.9 → 12.4 | 0.11 | 6,030 → 1,677 (0.28) |
| 8 | 35.7 → 52.3 | 5.7 → 13.1 | 6.1 → 7.3 | 0.07 | 4,391 → 1,350 (0.31) |
| 9 | 28.6 → 44.1 | 6.4 → 19.6 | 3.8 → 12.0 | 0.17 | 4,925 → 1,007 (0.20) |
| 10 | 35.1 → 52.1 | 6.5 → 14.7 | 8.4 → 6.4 | 0.02 | 5,905 → 617 (0.10) |

The late air war about doubled in sorties (years 2–10: 5–11 → 13–20 aloft; years 21–30 on 8 of
10 seeds higher) and air battles rose about 7 × (before 548–979 in years 1–10), but year 1 rose by
the same measure (28.6–39.3 → 38.8–52.3: 7.24a0's sorties, ADR-502), and with it the bar: 19–26
aloft. The late years hold 0.2–0.4 of year 1 and the air battles of years 21–30 0.09–0.76 of
years 1–10.

End hashes after year 30: 1 `5fa27a9e`, 2 `8293ff0`, 3 `66266923`, 4 `7dd9b5cc`, 5 `36cdd7bf`,
6 `75086307`, 7 `c6abef7d`, 8 `702d862b`, 9 `62cf2e08`, 10 `38a17add`.

## What is short: the idle wings of the 273 short war-years

Means of the day counts (`airWar.ts`), year 1 of the 10 seeds against the 273 short war-years
(`.cache/tmp/split726d.ts`):

| | year 1 | short years |
|---|---|---|
| wings | 166.3 | 139.7 |
| of nations at war | 98.8 | 73.1 |
| with a mission | 48.2 | 10.8 |
| without: no enemy land formation at all | 6.3 | 5.4 |
| without: every enemy land formation out of range | 34.5 | **54.1** |
| without: one in range (no target for the role) | 9.8 | 2.8 |
| hollow (under a quarter of their aircraft) | 3.8 | 5.3 |
| land formations in contact | 32.1 | **1.2** |
| wars | 6.0 | 5.3 |
| wings rebased a day | 1.9 | 1.6 |

Three in four wings at war have no enemy land formation in reach, while the wars go on (5.3 a
day), and land contact falls 27 × (years 2–30 per seed 0.7–2.4 against 27–37 in year 1). Of the
out-of-range wings, sampled weekly (782,093 samples):

- **59 %: no airbase of their side within range of any enemy formation** (`noBaseNear`). By
  nation, the out-of-range samples: the United States 176 k, Japan 131 k, Germany 66 k, Italy 65 k,
  Britain 59 k, the Netherlands 35 k, France 30 k: the enemy across the sea, or a land front that
  no army stands on.
- **36 %: such a base with room exists** (`baseFree`), but within one ferry hop of the wing only
  for 3 % of the samples (`freeInFerry`), and with `toward`'s goal (7.26b) in its range for 18 %
  (`goalReach`). 1.6 wings rebase a day of 54 out of range.
- 5 %: such bases, all full (`baseFull`).
- Hollow wings (refills) and the roles with no target in range are small (5.3 and 2.8 a day).

## The order of what waits (the split)

1. **7.26c3, the landing per war** (59 % of the samples, mostly the overseas powers): an enemy
   reached by sea is an enemy whose land the wings never see until an army lands.
2. **A new part, the rebase over more than one hop** (7.26c4): 36 % have a base of their side
   within range of an enemy, 3 % of them within one hop. Measured first: whether a wing whose
   goal base lies beyond `FERRY_RANGE` moves toward it day by day or stays.
3. **7.26c1b, the own front's far marches**: the land contact (1.2 a day) is what the wings with a
   base in range would strike; after c3 and c4.
4. **7.26c2b's refill**: hollow wings are 5.3 a day; the land refills are as ADR-437 decided, not
   the air war's gate. Last, and only if the AT is short after the others.

The AT itself: its bar is year 1, which is the start's general war of the blocs (32 land formations
in contact a day). No part above restores that contact by the air AI alone; whether the bar is
right is the user's, not this measure's, and is not changed here.

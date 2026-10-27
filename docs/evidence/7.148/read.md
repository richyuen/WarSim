# PLAN 7.148's read: the sea battles under ADR-738 (carrier wings fly their own missions)

2026-10-27, HEAD `4fd8b91c`. The task (found by 7.145's AT, ADR-738 a): on 1284–1293 × 20 sea battles in years 2–20
fell 1,641 → 1,423 (0.867 ×) and ships sunk in them 16,043 → 14,811 (0.923 ×). Read first whether the carrier fleets
find fewer enemy fleets (a fleet sees and reaches only by its wings at home, `carrierWings`) or the air sinks ships
before a battle.

How real the loss was: 7.145's own per-seed battles (`docs/evidence/7.145/at.md`), rule − base paired, −21.8 ± 10.0 a
seed over 19 years (2.2 standard errors; lower on 7 of 10). A loss, but a noisy one.

## Arms

Two switches in the sim for this read only (removed after it): `NOCV=1`, no carrier wing takes a mission (`airAi`, as
before ADR-738); `CVSEE=1`, `findSeaBattles` counts a carrier's wings aloft as at home (its fleet sees and reaches by
them: the detection channel shut, the missions kept). Tool `tools/diag/seaChannels.ts`; a fleet's ships lost in an
hour are counted to the battle (the fleet in a sea battle that hour), to a carrier's wing (out of a battle, struck by
one), to a land-based wing, or to anything else. Files `.cache/7148/read/`.

## From 1938, 5 years, 1284–1293 (years 2–5, sums of ten seeds)

| arm | battles | ships sunk in them | lost to carrier wings | lost to land wings | warships afloat, year 5 |
|---|---|---|---|---|---|
| HEAD | 410 | 5,032 | 1,210 | 1,327 | 3,194 |
| missions off (`NOCV`) | 478 | 5,852 | 889 | 1,226 | 3,226 |
| sees by wings aloft (`CVSEE`) | 359 | 4,369 | 983 | 1,947 | 3,736 |

- HEAD against missions off: battles 0.858 ×, ships sunk in them 0.860 ×; paired over years 1–5 −11.7 ± 9.2 battles a
  seed (lower on 7 of 10). The loss is still on HEAD in direction and size, within noise of none at this run's size.
- **The detection channel is not it:** with the fleets seeing and reaching by their wings aloft, battles are 0.751 ×
  missions-off (0.876 × HEAD): no battle comes back.
- Ships lost to carrier wings out of a battle +321 (1.36 ×) while ships sunk in battles −820; warships afloat at year
  5 equal (0.99 ×). The air's sinkings are at most part of the battle loss.
- The worlds part within months (1284's warships at year 5: 41 HEAD, 440 missions off), so a five-year run cannot name
  the cause.

## From year-10 saves (1276, 1279, 1280 at `221e2164`), 3 years

39 / 40 / 39 battles (HEAD / missions off / sees aloft). At year 10 the carriers are mostly gone or at peace (carrier
wings' own strike-hours 2,069 in three world-years, all on 1280): the loss is in the first years.

## Saves stepped both ways: 60-day windows (`tools/diag/seaSaves.ts`, `tools/diag/seaWindow.ts`)

HEAD saves of 1284–1291 every 90 days from day 90 to day 1,080 (96 saves, `.cache/7148/saves/`, ~420 MB); from each,
60 days in each arm (`.cache/7148/win/`). The worlds stay paired over a window, so a difference is the rule's.

| arm | battles | ships sunk in them | lost to carrier wings out of a battle | lost to land wings out of a battle |
|---|---|---|---|---|
| HEAD | 319 | 4,105 | 1,111 | 765 |
| missions off (`NOCV`) | 338 | 4,720 | 572 | 829 |
| sees by wings aloft (`CVSEE`) | 326 | 4,237 | 1,179 | 751 |

- HEAD against missions off: battles **0.944 ×** (paired −0.20 ± 0.16 a window, 1.25 standard errors; lower in 13
  windows, higher in 5), ships sunk in them **0.870 ×**. By window start: the loss is in days 180–630 (HEAD 232,
  missions off 248); day 90 41 against 41; days 720–1,080 46 against 49.
- Ships sunk at sea by any means (battles, carrier wings, land-based wings): 5,981 against 6,121, **0.977 ×**. What the
  battles lose the carrier wings sink from the air: +539 out of a battle, −615 in one.
- Seeing by the wings aloft gives back 7 battles of 19 (0.964 × missions off), within noise of HEAD; the ships sunk in
  them stay HEAD's (4,237). The detection channel is not the cause.
- **The battles missing on HEAD:** 24 battles of the missions-off windows have none on HEAD sharing a fleet within a
  week (in 14 windows; 14 the other way). In 16 of the 24 (**67 %**) a fleet of the battle had been struck by a
  carrier's wing on HEAD before the battle's hour; it lost ships to them in all 16, and in 10 it was sunk by the
  window's end. Of the 251 battles found on both, 48 (**19 %**) had such a fleet. The carriers' own strikes reach the
  enemy's fleets first, and sink them or thin them out of the fight.
- Not covered: days 0–90, where year 1's carrier war is heavy (the five-year runs: carrier wings' own strike-hours
  110,345 in years 1–5, 47,094 of them in year 1).

## Verdict

The cause is the second channel the task named: a carrier's wings, on their own missions, strike the enemy's fleets
before the fleets meet (the enemy's fleet nearest in range is their first target, ADR-738), and the ships they sink are
not in the `SeaBattle` rows. Ships sunk at sea by any means are 0.98 × missions-off. The direct effect in 60 days is
0.944 × the battles; 7.145's 0.867 × over 19 years is that and the worlds parting on it (itself 2.2 standard errors).

A rule that gives the battles back must keep the carriers' wings off the enemy's fleets out of a battle: less of what
ADR-738 (a) kept. That is the user's decision (ADR-742), not a rule of this task. No code changed; the pin unchanged.
Seeds 1314–1323 unspent.

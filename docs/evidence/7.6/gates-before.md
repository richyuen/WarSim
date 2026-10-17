# PLAN 7.6: why the AI's nuclear powers do not strike (before)

Critic R7-B1 (report of 2026-10-17 on `19e2341`). Measured on `19e2341` + the weighing split into
`weighWar` (no rule changed: the pin and the 19 nuclear test files unchanged), with
`tools/diag/nukeGates.ts`: seeds 1 to 10 × 30 years, unaided. Each day, each nuclear power that
weighs strikes, each war it weighs: the gate that leaves it without a strike.

- **noAim**: no enemy that can threaten it (`threatens`, PLAN 6.12a): the war is with small nations.
- **noPlace**: an enemy in its aim, but no fair place (`nukeTargets`: on the enemy's own land it
  controls, within FRONT_KM of the striker's side, none struck in the last RESTRIKE_DAYS).
- **low**: the best place's utility at most 0 without the MAD cap.
- **mad**: positive but for the MAD cap. **noReach**: positive, out of reach of its missiles and
  bombers. **strike**: positive and in reach.

## Decisions, and the gates on the days it was losing (desperation at least 0.5)

| Seed | Decisions | noAim | noPlace | low | mad | noReach | strike | Extreme days |
|---|---|---|---|---|---|---|---|---|
| 1 | 0  | 1395 | 1488 | 2811 | 0 | 296 | 0 | 312 |
| 2 | 0  | 6 | 0 | 0 | 0 | 0 | 0 | 0 |
| 3 | 0  | 254 | 209 | 1067 | 0 | 0 | 0 | 0 |
| 4 | 2 (SOV) | 104 | 499 | 876 | 0 | 0 | 0 | 949 |
| 5 | 2 (SOV) | 313 | 867 | 5493 | 0 | 0 | 1 | 31 |
| 6 | 0  | 1684 | 0 | 1107 | 0 | 0 | 0 | 17 |
| 7 | 0  | 57 | 0 | 0 | 0 | 0 | 0 | 0 |
| 8 | 0  | 218 | 445 | 546 | 0 | 0 | 0 | 11 |
| 9 | 0  | 183 | 0 | 1047 | 0 | 0 | 0 | 0 |
| 10 | 0  | 1322 | 724 | 2567 | 0 | 0 | 0 | 16 |

All days: noAim 142786, noPlace 33531, low 89455, mad 0, noReach 296, strike 1.
Extreme days: noAim 0, noPlace 317, low 788, mad 0, noReach 231.

4 decisions in 2 seeds, all the Soviet Union's: as the critic's runs (2 of 10, 4). The day is weighed
after its 00:00 decisions, so a day it struck counts in the gate it was left in after.

## Why

1. **The MAD cap decides nothing**: no day in 300 world-years is positive but for it.
2. **On a losing day the utility is about 1 short.** The best place's parts, mean of the 15514
   losing days left low: gain (value × desperation × doctrine) 0.23 (value
   0.30, desperation 0.93, doctrine 0.97) against the
   taboo 0.57, the strike back weighed 0.59, outrage 0.11,
   alliance 0.05.
3. **Desperation does not count men lost.** The critic's God-set France (seed 2604, set up headless as
   `critic/scripts/c7_f_ainuke.mjs` does): its army 555k → 163k men in 40 days
   while its desperation stayed 0.50 to 0.61 (fighting to the death alone; no land lost); extreme
   only when the Germans came within 150 km of Paris (day 41, desperation 1.12): it struck Berlin.
   After: the next places are worth 0.42 to 0.43 (Berlin's industry out of work), and outrage 0.22
   and the taboo's 0.09 keep the utility at −0.01 to −0.12 for 30 days.
4. **No means of delivery.** The economic AI orders fighters and tactical bombers (ADR-344), never
   a strategic bomber: a nation delivers with the 1938 start's strategic wings or with missiles
   (`ballistic_missiles`, 1950 at the earliest). Seed 1: the Soviet Union's 3 wings are 2 in 1940,
   1 in 1942, none from 1948; in 1950, at war with China in extreme desperation, 7 warheads, its
   best place worth +0.22: 296 days out of reach.
5. **In extreme desperation, no fair place.** Seed 4: the Soviet Union at desperation 1.7 to 2 in
   its war with China and Tibet has them in its aim and no place to weigh (317 extreme days). The
   likely cause, to be confirmed in PLAN 7.6c: no place the enemy owns and controls within FRONT_KM
   of its formations or capital (land of its own the enemy occupies is never fair).
6. **A capital weighed again.** Seed 4's two strikes are on one point (1052, 268.7) 400 days
   apart: a capital is weighed whenever RESTRIKE_DAYS (7) are past.

## Why fewer than PLAN 7.3g's sweep

PLAN 7.3g's quick sweep (`docs/evidence/7.3/quick-7.3g.md`, on `23725fc`) had 21 decisions in 4
seeds. The rules of the decision have not changed since; the only sim changes are 7.4f31 and 7.4f32
(the 1938 start's ownership of islets), which moved seed 99's pin twice, and so every seed's world.
21 against 4 in 300 world-years of a rare event is the luck of different worlds: the gates above hold
in both.

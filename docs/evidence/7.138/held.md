# PLAN 7.138: fronts held and not fought — where the army of a long-front war stands (2026-10-27)

HEAD `a24f2aa7` (the rules of the critic's run-16 `7b883084`; 7.139 changed no answer). Saves: the critic's
run-16 saves (`critic/c16_seed*_y20.bin`, and 2633 y25, 3847 y26, 5683 y25, 9203 y28); year 1 from 1938 on
day 60 of seeds 1061, 4877, 7019. Raw output in `held/`.

## 1. Who stands where (`tools/diag/warArmy.ts`, 2 days a case, hour 12)

Each war with a land front of at least 100 cells; each land formation of a nation of either side, its side
weak or strong by the side's men on land. Buckets a war-day (19 late saves; year 1 three worlds):

| | engaged | near (≤ 10 cells of the war's front) | mid (≤ 60) | cut off, still / moving | far (reaches the front), still / moving | ally, front's land / away | away (own front elsewhere) |
|---|---|---|---|---|---|---|---|
| late, weak side | 0.35 | 4.00 | 2.95 | 0.53 / 0.04 | 0.45 / 1.28 | 2.22 / 1.41 | 3.28 |
| late, strong side | 0.52 | 15.09 | 13.23 | 6.22 / 2.06 | 7.15 / 17.26 | 15.60 / 8.02 | 22.68 |
| year 1, weak | 2.7–7.3 | 8.3–12.8 | 5.0–8.8 | 0–0.3 / 0 | 0 / 0.5–4.6 | 0–2.7 / 0 | 0.3–1 |
| year 1, strong | 21–45 | 29–40 | 9.5–13.7 | 0–4.5 / 0 | 1.1–17.7 / 22–50 | 0.5–16.7 / 0–23 | 0–19 |

Fronts a war: late 370–3,363 cells (mean ~1,700), year 1 239–312. The late weak side has some 16 formations
a war (year 1 25–30), 4 of them near a front six times longer; the strong side has 15 near, and two thirds of
its army far from the front (cut off, beyond the range, allies elsewhere, other landmasses).

Of the near formations not engaged, the straight cells to the nearest formation of the other side
(a war-day, late mean; year 1 in brackets):

| | ≤ 3 | 3–6 | 6–12 | 12–30 | 30–60 | > 60 |
|---|---|---|---|---|---|---|
| weak | 0.44 (4.0–8.9) | 0.46 (1.9–2.3) | 0.60 (0.3–0.5) | 0.48 (1.3–2.3) | 0.58 (0–0.5) | 1.45 (0) |
| strong | 0.78 (16–23) | 1.25 (2.9–9.1) | 1.05 (1.6–9.8) | 1.46 (1.5–2.4) | 1.97 (0–1) | 8.59 (0–0.5) |

Late, most of the strong side's near formations stand more than 60 cells from any enemy formation: they
man empty stretches of front and take empty cells. The pairs within 12 cells of each other and not
engaged (~1.5 weak, ~3 strong a war) are the "held and not fought" population; 0.87 a war are engaged.

## 2. The cut-off army (`tools/diag/groupSplit.ts`, `planWhy.ts`, `farStill.ts`)

Free land formations of a nation at war standing in a province group (`Passage.group`) with no front cell
of their own but on a landmass with one: 7019 y20 216 of 432 (the USA 198 of 282: its Africa and Middle
East, group 4, cut off by neutral land from its front with Japan in China, group 3); 4877 y20 64 of 136;
6421 y20 46 of 202. Day 60 of 1938: 21 of 455, 0 of 422. The operational AI's far march finds no empty
sector these reach (`reachedEmpty` 0; 7019's USA 1,498 "unreached" a day, by group and by landmass);
the ferry counts them as its own (`frontReach` false) and ships them as its transports allow (one turn
in 7 days). They would land on the front's empty sectors, not on the weak side's few formations, and a
march to a threatened sector is months (ADR-635): not this task's lever.

## 3. The near pairs that do not fight (`tools/diag/nearPairs.ts`, 4 days a case)

Each near formation of the weak side (within 10 cells of the war's front, not engaged) and the nearest
formation of the strong side within 12 straight cells, not engaged (8 late saves: 1129, 1187, 2347, 3467,
4877, 6421, 8167 y20 and 5683 y25; year 1: 4877 and 7019 on day 60). The gaps are straight (no looping
map); a pair across a strait with one on the retreat counts as a retreat. Pairs a war-day:

| | both still | strong to its own side's cell, ≤ 6 cells (its hold cell) | the same, a longer march | strong attacking | retreat |
|---|---|---|---|---|---|
| late | 0.01 | 0.61 (0.54 a sector bucket or two from the weak one; men 0.67–1.5 × in 0.27) | 0.65 (most 3+ buckets off) | 0.70 (most 3+ buckets off) | 0.27 |
| year 1 | 0.07 | 3.19 | 1.61 | 0.60 | 2.47 |

No near formation is left without an order; the pairs split three ways late: a standoff at a distance
(both hold, the hold cells a sector apart and 5–7 cells from each other, out of `CONTACT_CELLS`), a march
away to another sector (the allotment, ADR-634's ground), and an attack elsewhere (ADR-702's ground).

## 4. A standoff breaker read on the saves (`standoff.patch`, not committed; `tools/diag/heldAb.ts`)

A sector that holds (strength under OFFENSIVE_RATIO × its threat) with strength at least STANDOFF × its
threat marches on the nearest enemy formation its threat counts that is itself not attacking (standing,
or under way to a cell of its own side), on the sector's landmass, in no battle. From the 8 late saves
above × 60 days (`held/heldAb.json`), engaged land formations of the members of wars with a front of
100 cells or more, per such war (`designBars.ts`' `fronts[3].per`):

| | per war | land formations ended a day (weak side's) | wars running | cells taken in front battles a day |
|---|---|---|---|---|
| HEAD | 0.850 | 0.029 (0.025) | 6.82 | 4.6 |
| STANDOFF 1.0 | 0.799 (0.94 ×) | 0.021 (0.015) | 6.86 | 4.4 |
| STANDOFF 1.2 | 0.799 (0.94 ×) | 0.021 (0.019) | 6.89 | 4.4 |

At 1.0 down on four saves (1129 and 5683 by an eighth), up by at most 3 % on three, equal on one (6421:
the rule seldom finds a standing foe). The filter's bar was
1.5 × on saves (save A/Bs have read high before: ADR-723, ADR-728); the rule was not taken to the AT and
no unseen seed was spent (1274 on kept). Code restored; the pin unchanged.

## 5. What is left

The late long-front war is thin on both sides: some 16 weak-side formations a war, 4 of them near a front
of ~1,700 cells, against 25–30 and 8–13 near ~280 cells in year 1; the strong side has two thirds of its
army far from the front (cut off by neutral land, beyond the range, allies elsewhere, other landmasses).
The near pairs are a third each standoffs, marches away and attacks elsewhere; the standoff breaker, the
one of them no rule had tried, reads 0.94 × on the saves. Six operational-AI rules (ADR-679, ADR-693,
ADR-702, ADR-728's pursuit, 7.128b's read, this one) have read flat. The levers left are not the
operational AI's: the army's size late (ADR-679's 7.110 line), the strategic AI's wars, or the late front
by design.

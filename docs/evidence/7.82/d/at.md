# PLAN 7.82d: the holders at peace (2026-10-23)

Bar: on 845 × 30 years the longest stasis at most 15 years (19 on HEAD), wars on the United States,
Canada and Denmark in years 8–26 at least 60 days a year each on average; a unit test, red without;
the ADR (ADR-670); the pin's entry.

## 1. Read first: why none of them is picked (`tools/diag/warChoice.ts`, new)

Seed 845 on HEAD `eca2f3a2`, years 8–26, at each day's start for every actor of the day (the state
`strategicAi` reads), against each of the three: could it reach them (a land neighbour, the war
choice's only targets; or by sea, `planLanding`'s reach: a transport group at a port of its own on a
water where they hold a port), and the gate it fell at. `845_any.*`: a transport group anywhere
counts; `845_port.*`: only one at a port of its own, as the planner takes it (the figures below).

- **Canada is a puppet of the United States** (refused `Subject`): the two are one target, the USA's
  bloc.
- **Their land neighbours score under the bar.** Mexico (aggression 15) and Cuba at most 0.50 and
  0.36 on the USA (DECLARE_AT 0.5), in truce 104 turns; Denmark (Greenland) has no land neighbour
  until year 23. Of the land turns on the USA, 1 picked it.
- **The Soviet Union reaches all three by sea** on 13 of 19 years (its transports at its ports), at
  aggression 70 and 3.3 times the USA bloc's strength: utility 1.0–1.4 on the USA, 1.4–1.7 on
  Denmark; over the bar on 195 of its 520 turns that reach the USA, 388 on Denmark; with **no land
  target over the bar on 77 (USA) and 84 (Denmark)** of them. Japan would pick Denmark on 25 such turns.
- A war with no land front ends after FRONTLESS_DAYS (365), so a war that never lands meets the
  60-days clause alone; the stasis clause is the test.

Cause named: the war choice looks across no sea. Rule (the narrow form the counts support: dozens of
turns with no land target): with no land neighbour over DECLARE_AT, the nation takes the best over
the bar of those it could land on (`seaTargets`: a port of theirs on a water where a transport group
of its own stands at its own port, not a sea ice closes, not one an enemy holds). Land wars first.

## 2. The AT (`at/845.*`, from 1938 with the rule, `churnAt.ts`)

| | HEAD (`.cache/at82`, 7.82's AT run) | with the rule |
|---|---|---|
| 845 longest stasis | 19 (8–26) | **5** (1–5) |
| 845 days at war a year, years 8–26: USA / CAN / DEN | 24 / 24 / 12 | **310 / 358 / 122** |
| 845 cells year 7 → 26: USA / CAN / DEN | 45.8k → 70.0k / 77.5k → 59.9k / 33.9k → 34.5k | 88.9k → 170.0k / 77.8k → 20.6k / 34.2k → 35.0k |
| 845 front-battle changes, years 10–30 (share) | 8,748 (1.9 %) | 22,937 (1.4 %) |
| 844 longest stasis (for information) | 17 (13–29) | 4 (17–20) |
| 844 days at war, USA / CAN / DEN | 207 / 227 / 26 | 343 / 345 / 363 |
| 844 front-battle changes, years 10–30 (share) | 17,166 (1.8 %) | 20,182 (1.6 %) |

**The AT is met** (stasis 5 ≤ 15; 310, 358, 122 ≥ 60 days). The battles rise in number on both seeds,
but their share falls: all changes of hands rise 3.7× on 845 (459k → 1.68M) and 1.3× on 844, most of
them walk-ins and revolts. 7.82's own bar (battle share at least HEAD's) is read on 851–860 next.

## 3. The land war (`land/rule_*`, 821–830 × 20 years, `landAt.ts`; pooled as 7.97, years 2–20)

The clause 7.82c missed, read here though 7.82d's AT does not name it. HEAD's runs are
`../../7.97/at/rule_*` (the pin b9bff4bd, HEAD's code).

| Seed | HEAD | with the rule |
|---|---|---|
| 821 | 0.460 | 0.524 |
| 822 | 0.385 | 0.399 |
| 823 | 0.423 | 0.536 |
| 824 | 0.456 | 0.545 |
| 825 | 0.441 | 0.379 |
| 826 | 0.504 | 0.508 |
| 827 | 0.396 | 0.607 |
| 828 | 0.566 | 0.615 |
| 829 | 0.643 | 0.397 |
| 830 | 0.514 | 0.465 |
| **Pooled** | **0.480** | **0.493** |

Engaged per war 0.480 → 0.493, with more wars running (6.55 → 7.24 on a mean day).

## 4. Cost

`npm run sim -- --scenario 1938 --seed 99 --years 3 --profile --affinity 0xFFFF`: strategicAi 0.029–0.033
ms a tick (1.6–1.8 %), as before (0.025–0.031 in 7.83's logs). `seaTargets` runs only on a turn with no
land target over the bar.

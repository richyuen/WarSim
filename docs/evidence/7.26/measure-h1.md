# PLAN 7.26h1: transports home after a landing

2026-10-18. Rule (ADR-517, `src/sim/ai/naval.ts` `plan`): at war, a fleet with no power and no
submarine that has transports (`transportRoom` > 0), no formation aboard, standing (not under way,
in no sea battle) away from every port of its bloc, sails for its nation's nearest port
(`sailHome`), on its nation's day of the naval AI (every `STAGGER` days). Before, the naval AI moved
at war only fleets with power and submarines, so a group that had landed its men stood at the
landing's water until peace.

Measure: `tools/diag/transports.ts` on seeds 2843 and 7919 × 8 years, as 7.26h
(`.cache/726h/` before, `.cache/726h1/` after), totals of the 8 years.

## The rule's own effect: groups standing away with a port to go to (`awayHome` group-days)

| seed | nation | 7.26h | 7.26h1 |
|---|---|---|---|
| 2843 | GER | 380 | 0 |
| 2843 | JAP | 10 | 0 |
| 7919 | GER | 593 | 10 |
| 7919 | ENG | 5,240 | 0 |
| 7919 | JAP | 4 | 0 |
| both | all | 6,227 | 10 |

The 10 left (7919 Germany, year 5–6) stood 1–19 days: between two of its nation's turns.

## The course of the runs (one run each: not the rule's merit)

The runs diverge from the first landing on, so these figures are another war, not the same war
with the rule; 7.26j judges the air war on ten seeds.

| seed | nation | `noTransport` days | of them no group | groups built / sunk |
|---|---|---|---|---|
| 2843 | GER | 2,099 → 0 | 1,719 → 0 | 5 / 5 → 1 / 0 |
| 2843 | ENG | 1,005 → 1,383 | 1,005 → 1,383 | 7 / 6 → 4 / 4 |
| 2843 | NED | 2,406 → 2,522 | all | 0 / 0 |
| 7919 | GER | 980 → 13 | 387 → 0 | 2 / 1 → 1 / 0 |
| 7919 | ENG | 1,314 → 551 | 0 → 549 | 4 / 0 → 4 / 4 |
| 7919 | NED | 2,398 → 2,375 | all | 0 / 0 |
| 7919 | JAP | 1 → 0 | 0 | 4 / 0 → 4 / 2 |

The cost: on seed 7919 Britain's four 1938 groups, sent home in year 2 (`toOwn` 4, `atLost` 4),
are all sunk in year 3, and Japan loses two; before, they stood unharmed (and unused) at the
landing's water. `sailHome` takes the nearest own port in the basin and weighs no enemy sea on the
way (a warfleet turns home outgunned by `AVOID_RATIO`, a transport group has no such rule). Every
day after, Britain has no group and builds none: 7.26h2's cause (the build), which this raises.

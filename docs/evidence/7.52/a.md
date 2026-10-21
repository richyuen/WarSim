# PLAN 7.52a — the deterrent named answers (ADR-610)

Critic run 11 (`critic/c11_t_1129.json`, seed 1129, 28 December 1953): "Soviet Union is deterred by
Germany: a nuclear strike would bring its answer in kind", while Germany's own line read "is a puppet:
the use of its warheads is its overlord's to decide".

## Measured (2026-10-21, the critic's save `critic/c11_seed1129_y17s.bin`, tick 140160)

Holders: Germany 11 warheads, a puppet of Denmark (no warheads), can deliver; Soviet Union 20; United
Kingdom 25; United States 30. War 171: United Kingdom, …, Denmark, Germany, … against China, …, Soviet
Union, ….

A launch draws only the launcher's own stock (`launchNuke`), and a puppet weighs no strike
(`weighsStrikes`): no one ever launches Germany's 11. Yet `retaliationRisk` and the panel's
`deterrerOf` counted them: min(1, 11 / 5) × Germany's doctrine = 1.4, above Britain's 0.8.

| holder (war, side) | before | after |
|---|---|---|
| United Kingdom (171, 0) | notDesperate, risk 1.2 | notDesperate, risk 1.2 |
| Germany (171, 0) | puppet | puppet |
| Soviet Union (171, 1) | deterred by Germany, risk 1.4 | strikes, risk 0.8 (Britain) |
| Soviet Union (174, 0) | noThreat | noThreat |

The cost: on that day the Soviet Union's best place is over its floor once the phantom strike back
is gone. Under the old rule it struck within the month anyway (the critic's round 1, 27 January 1954:
"struck lately and waits for the answer").

## Test

`tests/unit/nukeRestraint1938.test.ts`: Germany losing to a Poland of 10 warheads and missiles, Poland
made a puppet of Bolivia: before, deterred by Poland; after, strikes (risk 0). With France (5
warheads and missiles) on Poland's side: before, deterred by Poland; after, deterred by France. Both
red without the rule ("expected 'deterred' to be 'strikes'"; "expected 4 to be 19").

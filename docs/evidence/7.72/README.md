# PLAN 7.72: the landing and the ferry board as a group (ADR-625)

2026-10-22. Before: HEAD `d0dbf7cf` (7.70c's rules). After: the rule. Tool: `tools/diag/newFronts.ts`
with three columns added for this task (`embarked`, `trips`, `grouped`): 180 days of each of the
critic's 48 saves, four runs of 12 (`before_y*.json`, `after_y*.json`, their `.log`s, in this
folder). The before read matches 7.70c's "after" (`docs/evidence/7.70/c.md`) in every other column,
so the new columns changed nothing else.

## The read

A trip: the formations a nation embarks in one hour (the invasion AI boards once a nation a day).

| 180 days of the 48 saves | embarked | trips | trips of 2+ | formations a trip | engaged per war-day | landings | far landings (held 30 d) | opened (fronted) of open | in debt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HEAD (before) | 634 | 565 | 53 | 1.12 | 0.2182 | 554 | 287 (249) | 101 (69) of 305 | none |
| the rule (after) | 689 | 555 | 90 | 1.24 | 0.2227 | 615 | 299 (262) | 99 (68) of 304 | none |

The AT's bar (engaged per war-day not below the before): 0.2182 → 0.2227, met. The column that
isolates the rule: trips of two or more 53 → 90 (the 53 before are 7.70b's Normandy groups, which
passed their transports already). Trips stay about as many, and each carries more: 55 more
formations ashore in the 180 days.

## The rule

`board` (`ai/invasion.ts`) passes its transport group to every `orderLanding`, not to a group's
alone: `tryLanding` takes a group under way when it carries a formation embarked on it, so the second
formation at the port boards the transports the first set sailing that hour. Before, the standing
test refused it, and the landing and the ferry carried one formation a trip, whatever the room.

Test: `groupBoarding1938.test.ts` (Britain at war with Germany, one transport group at Portsmouth,
two divisions there that fit together: a landing with no front, and the ferry to a beachhead, each
takes both on the one group). Red without: one aboard in each.

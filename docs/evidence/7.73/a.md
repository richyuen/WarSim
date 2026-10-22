# PLAN 7.73a: a Normandy's worth rises near the front's rear (ADR-626)

2026-10-22. Before: HEAD `c951cefe` (7.72's rules; this read matches 7.72's "after",
`docs/evidence/7.72/README.md`, in every column). After: the rule. Tool: `tools/diag/newFronts.ts`,
180 days of each of the critic's 48 saves (`critic/c11_seed*_y10.bin`, `_y20.bin`), four runs of 12
(`a/before_y*.json`, `a/after_y*.json`, their `.log`s).

## The read

| 180 days of the 48 saves | engaged per war-day | opened (fronted) of open | landings | far (held 30 d) | embarked in trips (2+) | in debt |
| --- | --- | --- | --- | --- | --- | --- |
| HEAD (before) | 0.2227 | 99 (68, 22.4 %) of 304 | 615 | 299 (262) | 689 in 555 (90) | none |
| the rule (after) | **0.2355** | 99 (67, 21.9 %) of 306 | 648 | 303 (274) | 717 in 584 (89) | none |

By batch, engaged per war-day: y10a 0.1165 → 0.1173, y10b 0.2573 → 0.2830, y20a 0.1583 → 0.1803,
y20b 0.3540 → 0.3562: up in each.

The part's bar (engaged above HEAD's): met. PLAN 7.73's (at least 0.238, the fronted share at least
a fifth): the share holds (21.9 %), engaged 0.2355 not yet; 7.73b and 7.73c are read for it next.

Seed 99's year (`--profile --affinity 0xFFFF`): invasion AI mean 0.054 ms, longest call 14.8 ms (bar
50); tick mean 2.490 ms. Pin 9c5fa3ba → ebdbf431.

## The rule

`planNormandy` (`ai/invasion.ts`): a target city's worth (3 a capital, 1 another) is multiplied by
DEPLOY_RANGE_CELLS over its straight distance to the nearest cell of the nation's front; the
division by one more than the enemy's land formations within 10 cells is kept. Before, the nearness
was not weighed, and of two cities alike the nearest by sea won.

Test: `normandyRear1938.test.ts` (Britain at war with Germany, its front overseas; two islands with
cities handed to Germany, one the nearest to that front of those with a rival, the rival nearer
Portsmouth and at least twice as far from the front). With the rule the group sails for the first;
red without (it sails for the rival, land 162 for 697).

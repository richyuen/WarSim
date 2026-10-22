# PLAN 7.73c: a front with nobody is not held (ADR-628)

2026-10-22. Before: HEAD `e980f91a` (7.73b's rules; this read matches 7.73b's "after",
`docs/evidence/7.73/b.md`, in every column). After: the rule. Tool: `tools/diag/newFronts.ts`,
180 days of each of the critic's 48 saves (`critic/c11_seed*_y10.bin`, `_y20.bin`), four runs of 12
(`c/before_y*.json`, `c/after_y*.json`, their `.log`s).

## The read

| 180 days of the 48 saves | engaged per war-day | opened (fronted) of open | landings | far (held 30 d) | embarked in trips (2+) | in debt |
| --- | --- | --- | --- | --- | --- | --- |
| HEAD (before) | 0.2372 | 102 (76, 24.8 %) of 306 | 671 | 324 (290) | 754 in 622 (91) | none |
| the rule (after) | **0.2400** | 103 (75, 24.4 %) of 308 | 672 | 326 (293) | 757 in 622 (93) | none |

By batch, engaged per war-day: y10a 0.1177 → 0.1177, y10b 0.2930 → 0.2930, y20a 0.1678 → 0.1828,
y20b 0.3596 → 0.3597: up in one, flat in three. The whole gain is y20a's: the case is rare (a
front with nobody of either side about it), and in three of the four batches it changed no
landing that the read counts.

PLAN 7.73's bar: engaged per war-day at least HEAD-before-7.70b's (0.2383, `docs/evidence/7.70/b.md`,
its before JSONs summed to four places), met at 0.2400; the fronted share at least a fifth, met at
24.4 %.

Seed 99's year (`--profile --affinity 0xFFFF`): invasion AI mean 0.053 ms, longest call 12.6 ms (bar
50); tick mean 2.468 ms. Pin unchanged, 2c4e2593 (no front with nobody in seed 99's first year).

## The rule

`frontHeld` (`ai/invasion.ts`): a front is held only when its nation's land formations' men about
it are more than none and at least those of the nations at war with it there. Before, none against
none was held, so a nation whose front stood empty sent its free army overseas on a Normandy
(PLAN 7.70b) rather than letting the ferry take it to that front.

Test: `normandy1938.test.ts` (Britain at war with Germany alone, its front a cell handed to Germany
in Africa). The fixture now takes Britain's land formations off the front's land and from within two
of `frontHeld`'s squares of it (1938's colonial garrisons stood near it). Guarded (a British
division on a front cell): 7.70b's assertions, kept, hold. Unguarded: the group goes aboard for the
front's land, not the island. Red without (the unguarded case: bound for the island).

Reproduce: four runs side by side, `npx tsx tools/diag/newFronts.ts <out.json> 180
<seed>:critic/c11_seed<seed>_<y10|y20>.bin ...`, seeds 1129–5683 (a) and 5861–9781 (b).

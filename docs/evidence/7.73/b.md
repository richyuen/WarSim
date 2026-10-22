# PLAN 7.73b: a Normandy's group waits for a march to its port within a week (ADR-627)

2026-10-22. Before: HEAD `aad43437` (7.73a's rules; this read matches 7.73a's "after",
`docs/evidence/7.73/a.md`, in every column). After: the rule. Tool: `tools/diag/newFronts.ts`,
180 days of each of the critic's 48 saves (`critic/c11_seed*_y10.bin`, `_y20.bin`), four runs of 12
(`b/before_y*.json`, `b/after_y*.json`, their `.log`s).

## The read

| 180 days of the 48 saves | engaged per war-day | opened (fronted) of open | landings | far (held 30 d) | embarked in trips (2+) | in debt |
| --- | --- | --- | --- | --- | --- | --- |
| HEAD (before) | 0.2355 | 99 (67, 21.9 %) of 306 | 648 | 303 (274) | 717 in 584 (89) | none |
| the rule (after) | **0.2372** | 102 (76, 24.8 %) of 306 | 671 | 324 (290) | 754 in 622 (91) | none |

By batch, engaged per war-day: y10a 0.1173 → 0.1177, y10b 0.2830 → 0.2930, y20a 0.1803 → 0.1678,
y20b 0.3562 → 0.3596: up in three, down in one.

PLAN 7.73's bar (at least 0.238, the fronted share at least a fifth): the share holds (24.8 %),
engaged 0.2372 not yet; 7.73c is read for it next.

Seed 99's year (`--profile --affinity 0xFFFF`): invasion AI mean 0.053 ms, longest call 11.1 ms (bar
50); tick mean 2.521 ms. Pin ebdbf431 → 2c4e2593.

## The rule

`board` (`ai/invasion.ts`): a Normandy's group under three quarters of its room waits for a march
of its nation to the port only while `marchHoursLeft` (`systems/movement.ts`) is at most
NORMANDY_WAIT_DAYS × 24 (7 days, the nation's next invasion turn): its path's steps left at its
pace of now, Infinity in a fight or with its next step on the ground of a nation at war with it.
With such a march only past the bound, the group at the port goes aboard as it is; with nobody at
the port, the turn is the ferry's. Before, any march to the port held the turn, with no bound.

Test: `groupWait1938.test.ts` (Britain at war with Germany as `normandy1938.test.ts`; one division
at Portsmouth, a second marching there: in a fight on the way, from the far north with 830 hours
left, or 4 to 6 cells off with 49 hours left). The first two board the one at the port; the third
waits. Red without (the first two: nobody aboard).

Reproduce: `bash read.sh <label>` as in 7.73a: `npx tsx tools/diag/newFronts.ts <out.json> 180
<seed>:critic/c11_seed<seed>_<y10|y20>.bin ...`, seeds 1129–5683 (a) and 5861–9781 (b).

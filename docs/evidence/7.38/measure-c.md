# PLAN 7.38c — the dead weighed (ADR-568)

Rule: `deadCost` = DEAD_COST (0.1) a million people the burst is expected to kill (`PlaceParts.people`,
anyone's, at the yield weighed, as `blast` counts them) × (2 − doctrine), a cost on a burst (× the
chance through) in `nuclearUtility`, strikes back too (RETALIATION_BONUS as it was).

Read on the critic's code (`bcbc99c`, worktree `C:/Git/WarSim_c10`) with both rules patched in
(`b-yield-rule.diff`, then `c-dead-rule.diff`; its `restraintOf` hunks do not apply there, as
`restraintOf` is younger than `bcbc99c`, and are not needed for a decision), from the checkpoints
48 hours before each named strike (`.cache/nukeToll_<seed>_<tick>-bcbc99c.bin`, PLAN 7.38a), by
`tools/diag/nukeToll.ts` (its rows now carry `utility.people` and `utility.dead`). Rows:
`c-toll-{4877,8693a,8693b,8693c}-rule.json`.

## The named cases

| seed | case (critic) | was | with 7.38b and 7.38c |
|---|---|---|---|
| 4877 | Germany → Shanghai, day 10434, 0.025 | 3,802,105 dead (hydrogen) | not struck: no German strike on China to year 30 |
| 8693 | United States → Paris (first), day 5891, 0.026 | 3,178,766 (hydrogen) | not Paris: day 5893, 0.027, a fission burst on massed French men at (1066.1, 331.1), about 30 cells south-east of Paris (1037.3, 294.8), 40,694 men expected; 63,634 dead (23,000 people expected; cost 0.003). Paris at fission was 0.026 before the cost; 183,000 people × 0.1 × 1.35 = 0.025 took it under the floor |
| 8693 | United States → Paris (second), day 6969, 0.073 | 1,404,231 (hydrogen) | day 6969, 0.063, fission, 89,159 (expected 78,000; cost 0.011) |
| 8693 | United States → Rome, day 9891, 0.091 | 3,720,550 (hydrogen) | day 9891, 0.068, fission, 183,363 (expected 172,000; cost 0.023) |

"Dead" is the history's (men and people); "expected" the people alone the decision weighed.
So no strike of the three at a yield killing a million. Paris's second and Rome are fission bursts
by 7.38b already (their fission value is 1 of 1); the case 7.38c alone changes is Shanghai, whose
fission value (0.370) was under its hydrogen one (0.402): the hydrogen bomb was still the one
weighed, and its 3.8 million dead now cost 0.228 at Germany's doctrine of 1.4 (utility −0.20).

## The strikes back

- 8693: the Soviet Union answers the United States the next day, both times: day 5894 at 0.775 (was
  day 5892, 0.776) and day 6970 at 0.687 (as before), each a hydrogen burst of 91,769 dead (was
  1,174,992 and 543,192). Their rows read `people` 0: the tool reads a strike back after the hour,
  its grievance spent, in the first war it finds (as measure-a's `uRecomputed`), not the decision's.
- 4877: the run diverges once Shanghai is not struck (day 10434), so the critic's three Soviet
  answers to Germany (days 10435, 10612, 10632) do not recur as they were. In the run with the rule
  Germany strikes the Soviet Union on day 10588 (1.045, 48,613 dead) and the Soviet answer is
  decided the next day (0.646, 425,008 dead); Germany then strikes a new nation twice (days 10623,
  10630; 0.314 and 0.218, 458,095 and 960,241 dead, the cost 0.026 and 0.057).
  The critic's answers read with the cost at their inputs and thermonuclear expected dead (measure-a's
  rows; doctrine 1.2, a factor of 0.8): day 10435 0.783 − 0.034 = 0.749; day 10612 0.484 − 0.198 =
  0.286; day 10632 0.512 − 0.002 = 0.510. Each over NUKE_FLOOR (`nukeDeadCost1938.test.ts` holds
  10612's and 8693's day-5892 case).

## Bars of the runs (`nukeToll.ts`)

4877 from day 10432 to year 30: 4 decisions, 0 under 0.1 with a million dead, 0 restruck in a war,
0 hydrogen bombs where fission covers. 8693's three windows: 2, 2, 1 decisions, 0 / 0 / 0 each.
The full bars on 14 + 10 seeds × 30 years are 7.38e's.

# PLAN 7.53b: rivals apart (ADR-586)

2026-10-21. `tools/diag/peers.ts` on the tuning seeds 3011, 3023, 3037, 3041 × 20 years, HEAD
(`a/`, 7.53a) against the rule (`b/`). Means of the weekly samples of years 2–20.

| seed | great pairs allied | armed wars | great pairs at war | wars | engaged worldwide |
|---|---|---|---|---|---|
| 3011 | 5.81 → 0.72 | 0.41 → 0.46 | 0.42 → 1.10 | 6.31 → 7.22 | 0.96 → 1.47 |
| 3023 | 1.36 → 0.24 | 0.41 → 0.38 | 1.25 → 1.02 | 7.46 → 6.86 | 0.97 → 1.37 |
| 3037 | 3.25 → 0.46 | 0.80 → 1.04 | 3.40 → 1.93 | 5.52 → 5.59 | 2.99 → 2.68 |
| 3041 | 4.79 → 0.65 | 0.67 → 0.53 | 1.21 → 0.57 | 5.79 → 7.04 | 1.12 → 1.14 |
| mean | **3.80 → 0.52** | 0.57 → 0.60 | 1.57 → 1.16 | 6.27 → 6.68 | 1.51 → 1.67 |

**AT:** great pairs allied halved (bar 1.90): 0.52, met. Years 2 and 3 are in the grace and count;
from year 4 the figure is near 0 on every seed. Year 1 is HEAD's on every seed (the rule waits
three years). Armed wars do not move: the great powers stand apart and do not yet fight each other
for it; rivalry (7.53c) is that part.

## How the rule came to its form (each on the same four seeds)

1. **Loyalty lost with no war in common** (any war on one side): allied 2.93 / 6.72 / 5.69 / 4.79,
   worse on two seeds, the same on 3041. An alliance draws its members into its wars, so they have
   a war in common most months, on small nations; and a great power that left joined another bloc.
2. **Only a war against a great power keeps them:** 0.64 / 0 / 3.15 / 5.17.
3. **And a great power joins no alliance that holds one** (the alliance against a threat, a
   coalition; founders one great power at most): 0.25 / 0 / 0.09 / 5.17. 3041 unchanged: Britain's
   alliance kept the Netherlands and Switzerland, great by their conquests, at a loyalty of 25 for
   years (`allianceSystem` pulls a loyalty of 0 to 25 at a unity of 100, and a member leaves only
   under 25).
4. **It leaves when the rule takes it under 25:** 0.03 / 0.05 / 0.06 / 0.06. But Italy and Japan
   left the Anti-Comintern pact in February 1938, before any war of theirs.
5. **Three years' grace from the scenario's start** (as adopted): the table above.

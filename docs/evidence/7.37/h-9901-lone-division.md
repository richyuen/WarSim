# PLAN 7.37h: seed 9901's three Soviet strikes on a lone Chinese division, against PLAN 7.38's rules

The cases (critic R9, `f0be88c` with ADR-528, `docs/evidence/7.32/chain-f0be88c-9901_rule.json`),
all in one war (the Soviet side against China's, war days 105 → 269):

| Day | Desperation | Utility | Value | Men weighed | Men killed | People killed | Yield |
|---|---|---|---|---|---|---|---|
| 5565 | 0.99 | 0.025 | 0.427 | 10,676 | 10,655 | 0 | fission |
| 5628 | 1.16 | 0.032 | 0.431 | 10,765 | 10,751 | 0 | fission |
| 5641 | 1.18 | 0.055 | 0.427 | 10,676 | 10,655 | 0 | fission |

Each found what it was weighed at, and none was in extreme desperation.

## PLAN 7.38's three rules on these strikes

- **7.38b, the yield by the target (ADR-567):** does not apply. Each was a fission burst; the Soviet
  Union had no `thermonuclear` until day 5977.
- **7.38c, the dead weighed (ADR-568):** the cost is DEAD_COST × the people the burst is expected to
  kill, counted from the cells' people as `blast` counts them. Each burst killed 0 people, so the
  cost is 0 and the utility unchanged. (The evidence file predates `PlaceParts.people`; the expected
  people are read from the people killed, the same count on the same cells.)
- **7.38d, no restrike in a war without new value (ADR-569):** excludes a place within a hydrogen
  bomb's blast radius (92.1 km) of an earlier burst of the side in the war. Measured with `seaKm` on
  seed 9901's 1938 world (`.cache/d737h.ts`, scratch): every earlier burst of the war is 427 to
  1,696 km from each of the three places.

| Strike | Earlier bursts of the war, km |
|---|---|
| 5565 | 5496: 447 |
| 5628 | 5496: 1,334; 5565: 973; 5572: 1,377; 5579: 1,540 |
| 5641 | 5496: 1,507; 5565: 1,241; 5572: 1,561; 5579: 1,696; 5628: 427 |

None is within the radius, so no PLAN 7.38 rule changes them.

## The cause

ADR-528 (accepted 2026-10-19) weighs a theatre's men at least 250,000, so a lone division of
10,655 men is worth 0.43. Its own text: "near NUKE_FLOOR at a desperation about 1". With the
Soviet Union's doctrine (1.2) and desperation 0.99 to 1.18, the gain is just over the costs, at
utilities 0.025 to 0.055 (NUKE_FLOOR 0.025). Each strike destroyed what was weighed, killed no
civilians, and fell far from the war's other bursts. The weighing worked as designed. The
question is whether a nation this desperate should spend a warhead on one division. That is the
bar ADR-528 set, so the decision is the user's (ADR-570).

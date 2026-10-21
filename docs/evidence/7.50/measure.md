# PLAN 7.50 — measured first (critic R11-B2)

Tool: `tools/diag/nukeToll.ts` (each AI strike's utility by its parts, the yield's people, the
toll, the earlier bursts near it); the task names `nukeCase.ts`, which sets up an editor war and
does not replay a save. `src/sim/systems/nuclear.ts` is unchanged between the critic's commit
`dd3b730` and HEAD `9b36580`, so a rule patched into a worktree of `dd3b730` is the rule on HEAD.

## 1. Seed 1129, Greenock (`toll-1129-dd3b730.json`, `toll-1129-head.json`)

From `critic/c11_seed1129_y17s.bin` (1 January 1954) to year 17. On `dd3b730` the replay is the
critic's: day 5916 (14 March 1954), the Soviet Union on the United Kingdom near Greenock, a
hydrogen bomb, 1,105,514 dead, utility 0.026. On HEAD (the 7.49–7.56 rules move the world) the same
place is struck on day 5938 at 0.070, the same 1,071,000 people expected.

| Part | dd3b730, day 5916 |
|---|---|
| value (thermonuclear) / (fission) | 1.000 (capped; share 0.118 × 10) / 0.645 |
| desperation × doctrine | 1.476 × 1.2 (extreme; MAD, so first use only in extreme desperation) |
| gain | 1.771 |
| costs | retaliation 1.4 × 0.8, alliance 0.025, outrage 0.397, taboo 0.317 × 0.5, dead 0.107: 1.744 |
| people expected, thermonuclear / fission | 1,071,000 / 1,000 |
| men expected, thermonuclear / fission | 34,612 / 20,184 |
| utility, thermonuclear / fission | 0.026 / −0.50 |

The Soviet Union's strikes of that year are all so: gains of 1.6–1.9 against costs of 1.5–1.7, the
utility the small difference of two large sums. The cost of the dead, 0.1 a million (DEAD_COST at
doctrine 1.2), is small beside either: the hydrogen bomb's 0.355 more value (14,000 more men, about
a division) is worth 0.63 of gain and its million dead cost 0.107.

A flat rise of DEAD_COST that closes that gap needs about 0.6 a million. That puts ADR-572's kept
case (the Soviet answer to Germany, 2.5 million dead at 0.484) far under the floor and moves every
row of 7.45b's 24-seed table. The rule must be of shape, not of scale: the floor a strike must pass
rises with its dead, so a strike that pays for its dead and no more does not go.

HEAD's year also has, its own: day 5999 a burst within a hydrogen bomb's blast of the war's earlier
one (more men there than the first found, ADR-569's new value), and day 6124 a decision read as
"fission covers" (expected 17,000) whose matched burst is a hydrogen one of 329,183 dead (the tool's
match of a bomber's late burst, or a yield choice; the unseen sweep counts the kind).

## 2. Seed 2081, one spot three times (`toll-2081-dd3b730.json`)

From 1938 on `dd3b730` (the critic's batch saves its year-20 world, and a replay from it lands on
the critic's year 21 and 22 hashes; HEAD from that save is a different world after year 22). War
265 (Germany against the Soviet Union, 853 days old at the first): Germany strikes [1219.5, 421.5]
on days 9556 (hydrogen, 8,179 dead, 5,181 men), 9679 (hydrogen, 4,879, 3,846 men) and 9863
(fission, 4,090 men), each a strike back (`retaliating`) at a value of 0.15–0.21, its utility of
0.48–0.54 nearly all the strike back's bonus (RETALIATION_BONUS × the chance through, 1).

The war's memory (`War.struck`, probed from a checkpoint 48 hours before day 9679,
`.cache/p50.ts` on the worktree): the first burst found 8,953 men within the blast; on day 9679,
11,073 Soviet men stand there again (two formations), so ADR-569's "new value" (more men than the
burst found) lets the place be weighed. The rule works as written: what fails is that a refill of a
few thousand men counts as new value within months.

## Causes, a part each

- **7.50a The dead's floor:** the floor a strike must pass rises with the people it is expected to
  kill, DEAD_FLOOR (0.1) × the millions, to 0.1 at a million (7.38's bar), never under NUKE_FLOOR;
  each yield weighed by its utility above its own floor. Greenock: floor 0.1 against 0.026, and
  fission's place −0.50: not struck. A floor of the dead's whole cost again would sink ADR-572's
  kept case (the Soviet answer to Germany, 2,474,000 at 0.237 with 7.38c's cost, floor 0.247), so
  the floor stops at a million and the cost in the utility goes on growing.
- **7.50b The year's restrike:** within a year of a burst there, a place of massed men struck by the
  side in the war is weighed only with twice the men the burst found (ADR-569 kept after the year).
  2081's day 9679: 11,073 against 17,906: not struck.

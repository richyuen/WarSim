# PLAN 7.32a: what each burst of the critic's chains destroyed, against its weighing

Critic R9-B2 (run 9, on `f0be88c`): "the Soviet Union strikes China every 7 days along one line, each
burst about 7 cells west of the last: 10,847 → 1,373 → 168 → 24 dead", and seed 9901's 18 strikes
on China in 2 years for about 10,000 each.

## How it was measured

`tools/diag/nukeChain.ts <seed> <years>`: for each AI strike, the parts of its place on the day it
was decided (`placeParts`: the enemy side's output and men in the blast as shares, the men those
shares stand for, the theatre and the side), and what its burst destroyed. The toll is read from a
snapshot of the formations within two blast radii before the hour of the burst and after it: men,
guns (artillery, anti-tank, anti-air), tanks, aircraft, ships, the people killed (the toll less the
men), and the industry put out of work.

HEAD (`456984c`, after 7.31's sea rule) no longer makes the critic's chains (seed 2609: 2 strikes in
17 years, both on London). The chains were measured on the critic's code, in a worktree at
`f0be88c` (`chain-f0be88c-2609.json`, `chain-f0be88c-9901.json`).

## What the bursts found

The weighing found what it expected every time: men expected in the blast against men lost,
22,428 / 22,366, 10,765 / 9,849, 10,855 / 10,847, 1,363 / 1,373, 167 / 168, 21 / 24 (bombers 0.1 to
4 hours in flight). Every "dead" of the chains was a soldier: 0 people killed in each of them. The
critic read the toll as civilian; the history says "dead" and does not say who (7.32b).

What was wrong was the scale. The men in the blast were weighed as a share of the enemy side's men
in the theatre (at least THEATRE_FLOOR, a quarter, of the side's), and TARGET_SCALE 10 makes a
tenth of that full value:

- Seed 2609, year 14.55: China's whole side held 12,829 men. The first burst killed 10,847 (value
  1). The second was weighed against a side of 1,934 men: its 1,363 men were 87 % of it (value 1).
  Then 167 of 561 (value 1), then 21 of 393 (value 1). The same again from year 14.88 (side 12,797
  → 357), and on Tibet in year 13.8 (side 12,696 → 1,090).
- Seed 9901, years 14.9 to 15.4: China's side held 60,000 to 260,000 men, its theatre 44,000 to
  77,000. A lone division of 10,655 men was 14 to 25 % of it, value 1. Struck nine times in 185 days
  at desperation 0.42 to 1.13; then seven more times in extreme desperation (1.67 to 2).

The doctrine of the Soviet Union is 1.2 (aggression 70); the costs on a burst were −0.58 to −0.64
(−0.49 in extreme desperation, the taboo halved). At value 1 every one of these places passed.

## The rule (ADR-528)

A theatre's men count for at least THEATRE_MEN_MIN = 250,000 men: a burst is worth TARGET_SCALE
× its men ÷ 250,000, whole at 25,000 men in the blast (two divisions massed). A lone division of
10,655 men is worth 0.43; a remnant of 1,363 men 0.05.

## The critic's two worlds, its code with the rule

| Seed | Strikes on China and Tibet, before | After |
|---|---|---|
| 2609, 16 years | 20 (12 under 5,000 dead) | 0 |
| 9901, 17 years | 18 | 14 |

(`chain-f0be88c-2609_rule.json`, `chain-f0be88c-9901_rule.json`)

On 9901 every one of the 14 found what it was weighed at. Eight came in extreme desperation (1.58
to 2), with 68,000 to 3,319,000 people killed. Of the other six, three were on 15,782 to 17,269 men
massed. Three were on a lone division (10,655 to 10,751 men) at desperation 0.99 to 1.18 and
utilities of 0.025 to 0.055, just over NUKE_FLOOR. Whether a nation
that desperate strikes a division is PLAN 7.37's question ("each case's decision").

## The 14 seeds × 30 years on HEAD, before and after

`critic/scripts/c9_headless.ts` (the critic's own runner), then `tools/diag/nukeChainCount.ts`
(`count-before.txt` on `456984c`, `count-after.txt` with the rule).

| | Before | After |
|---|---|---|
| Worlds with a burst | 12 of 14 | 10 of 14 |
| Bursts | 92 | 64 |
| Tolls under 5,000 dead | 2 | 0 |
| Chain links (same striker, same nation, within 14 days, smaller toll) | 6 | 2 |
| Bursts within 300 km and 90 days of the striker's earlier burst that found under 5,000 | 0 | 0 |

The worlds that lost their bursts: 3793 (Italy on the Soviet Union, 68,333 dead) and 5527 (Poland on
Canada 11,212; Germany on Mexico 5,355 and 75,702; Germany on Canada 5,000). The two chain links
left are seed 7741's Soviet Union on Italy, 210,554 → 90,685 → 34,309 dead, in a general nuclear war
of 21 bursts in 18 months.

"No strike near a place where the last strike found almost nothing": no rule of its own was added.
A burst finds what it was weighed at, and a place of almost nothing is now worth almost nothing.
The count is 0 before and after on HEAD. On the critic's code it was the chain itself: 1,373 after
10,847, 168 after 1,373, within 300 km.

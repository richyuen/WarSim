# PLAN 7.38d — a place struck in a war not struck again in it without new value (ADR-569)

Rule: each war remembers its bursts (`War.struck`: x, y, the enemy men within a blast of it at the
striker's largest yield when it fell, the striker's side). Within a hydrogen bomb's blast radius of
a burst of its side in the war (the radius `nukeToll.ts` counts a restrike by), `nukeTargets`
weighs no capital for the rest of the war, and a place of massed men only with more men massed
there than the burst found.

## The critic's case, the rule alone

On the critic's code (`bcbc99c`, worktree `C:/Git/WarSim_c10`) with the rule alone patched in
(`d-war-rule.diff`; 7.38b and 7.38c not), from `.cache/nukeToll_4877_250417-bcbc99c.bin` (day
10432) to year 30, by `92550bf`'s `nukeToll.ts` (HEAD's imports `deadCost`). Rows:
`d-toll-4877-rule.json`.

| day | strike | critic's run | with the rule |
|---|---|---|---|
| 10477 | Soviet Union → Switzerland, war 293 | (1083.2, 290.8), 0.090, 25,067 men, 667,994 dead | the same |
| 10489 | Soviet Union → founded#110, war 293 | 0.164, 2,546,000 dead | the same |
| 10497 | Soviet Union → Switzerland, war 293 | (1076.4, 290.6), 7 cells west, 0.132, 10,440 men (fewer than the burst found), 1,922,429 dead: within a blast radius of day 10477's | (1072.6, 305.6), 18 cells away, out of every blast radius of the war's bursts: 0.030, no men, 1,385,000 dead |

Bars of the run: 9 decisions, restruck in a war **0** (the critic's run 1), under 0.1 with a million
dead 3, hydrogen where fission covers 1 (those two are 7.38b's and 7.38c's, not patched here).

The sidestep of day 10497 is a city's worth (its output) at 0.030 for 1.4 million people: under
7.38c's cost (1.385 M × 0.1 × (2 − 1.2) = 0.111) it is not over NUKE_FLOOR. With 7.38b and 7.38c
the run diverges at day 10434 (no German strike on Shanghai) and war 293 sees no Swiss burst
(`c-toll-4877-rule.json`): the rule changes nothing there.

## The strikes back kept

No strike of the 7.38c runs (`c-toll-*-rule.json`: 8693's Soviet answers on days 5894 and 6970,
4877's on 10589) had an earlier burst of its war within a blast radius of its place
(`beforeSameWar` 0): the rule only takes places away, none of them the one chosen, so each is
decided as before.

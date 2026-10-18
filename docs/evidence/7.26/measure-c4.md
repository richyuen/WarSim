# PLAN 7.26c4: the rebase over more than one hop, measured (2026-10-18)

Code: `45eb4c3` for the "before" (the rebase a hop to the base nearest the goal, only where that
base is nearer the goal than the wing's own, ADR-376 and ADR-508), the working tree of 7.26c4 for
the "after" (ADR-512). States saved from `45eb4c3` (`.cache/tmp/saveAt.ts`): seed 2843 at days 760,
1100 and 2450, seed 7919 at days 560, 1100 and 2450. Probes in `.cache/tmp/`: `c4probe.ts` (the
wings the task names, why they stay, and 30 days of what they do), `abc4.ts` (old and new rule from
one state, 180 days), `c4shape.ts` (where on the 1938 map a chain of bases bends away from the
front first, for the unit test).

## 1. Who the task's wings are (`c4probe.ts`, day 1 of each state)

The wings counted: of nations at war, fighters, close support, tactical and naval bombers, with no
mission, every enemy land formation out of their range, a base of their side with room in range of
an enemy, and none such within one ferry hop (`FERRY_RANGE` ranges): the 33 % of 7.26d's
out-of-range wings that have a free base but not within a hop.

| state | wings | chain of free bases | chain, room not weighed | no chain | greedy step on day 1 | who |
|---|---|---|---|---|---|---|
| 2843 d760 | 39 | 6 (2 hops) | 6 | 33 | 0 | Soviet Union 13, Japan 11, Germany 6 |
| 2843 d1100 | 11 | 0 | 0 | 11 | 0 | Japan 11 |
| 2843 d2450 | 8 | 0 | 0 | 8 | 0 | Raj, Britain, colonies |
| 7919 d560 | 3 | 0 | 0 | 3 | 0 | Italy 3 |
| 7919 d1100 | 9 | 3 (5 hops) | 3 | 6 | 0 | colonies, Soviet Union |
| 7919 d2450 | 44 | 14 | 14 | 30 | 6 | United States 12, Japan 12 |
| **all** | **114** | **23** | **23** | **91** | **6** | |

- 91 of 114 (80 %) have no chain at all: the side's bases are more than a ferry hop apart
  somewhere between (Japan's home islands to Britain's front, French West Africa 2,130 km from its
  nearest base, Britain's bases to China). No rebase rule moves them; c3b (the landings) and the
  land war are what can.
- Room is not a cause: the chain counted over every base of the side, room not weighed, is the
  chain over the bases with room, in every state.
- 23 have a chain of 2 to 5 hops; for 17 of them no base within a hop is nearer the goal than their
  own (Germany's tactical bombers at day 760: the nearest base of the side 991 km off, farther from
  England than their own). The old rule moved none of them.
- Over the 30 days that followed, on the old rule, 7 of 39 moved on day 760 and 2 of 3 on 7919's
  day 560: the world changed (a goal or a base taken), not a step the rule found; on day 1 no base
  of theirs had one.

## 2. The rule (ADR-512)

Where a chain of ferry hops over the side's airbases (room not weighed) leads from the wing's base
to one with a formation of its front within range, the hop is to the base with room within a hop
that lowers (hops left, km to the goal): fewer hops left, or as many and nearer the goal. Every
base within a hop of the wing's is on the chain too (the field and the hop use the same reach), so
what the rule no longer takes is a base nearer the goal in km with more hops left. With no chain
from its base, the old step.

A first form took only fewer hops left (no lateral hop). From seed 2843's day 1100 it rebased less
than the old rule, 327 rebases (180 followed by a mission within 30 days) against 431 (261): two
nations' hops along a chain to a base as many hops off but nearer the goal had been useful. The
form adopted takes them: 555 (319).

## 3. Old and new rule from one state (`abc4.ts`, 180 days)

| state | sorties aloft, old → new | air battles | rebases a day | wings at war with a mission a day |
|---|---|---|---|---|
| 2843 d760 | 23.12 → 22.89 | 99 → 102 | 3.93 → 3.90 | 23.1 → 22.9 |
| 2843 d1100 | 28.88 → 28.43 | 514 → 393 | 3.06 → 3.62 | 28.8 → 28.4 |
| 2843 d2450 | 15.70 → 15.70 | 382 → 382 | 0.24 → 0.24 | 15.7 → 15.7 |
| 7919 d560 | 11.61 → 12.24 | 204 → 275 | 1.29 → 1.33 | 11.4 → 12.1 |
| 7919 d1100 | 8.76 → 9.38 | 165 → 273 | 0.59 → 0.72 | 8.7 → 9.3 |
| 7919 d2450 | 15.05 → 15.35 | 318 → 320 | 2.69 → 3.11 | 15.0 → 15.3 |
| **mean** | **17.19 → 17.33** | | | |

The rule bites as the probe said it would, on a small share: neutral to slightly up. The wings
followed from the probe's states over 30 days moved: seed 7919's day 2450, 26 of 44 (10 tasked at
the end), day 1100 3 of 9.

## 4. Eight years (`airWar.ts`, one run a seed, diverging from the first year)

| seed | years 2–8 mean sorties aloft, c3a → c4 | air battles years 2–8 | rebases a day | wings out of range a day |
|---|---|---|---|---|
| 2843 | 18.2 → 16.2 | 2,545 → 1,168 | 1.86 → 3.7 | 45.5 → 71.9 |
| 7919 | 15.0 → 12.8 | 2,325 → 2,099 | 1.43 → 0.71 | 37.4 → 32.5 |

Lower on both seeds; so was the first form's run (13.3 and 14.0). Such runs move by more than this
with any rule change (c3a's: 16.7 → 18.2 and 13.2 → 15.0); the rule is judged by §3, as c3a's was.
PLAN 7.26e's ten seeds are the check: if they come out lower than 7.26d's with the contact share
unchanged, this rule is questioned there.

## 5. Cost

Seed 99, three years, old and new at the same time on separate cores, then swapped (`--profile`):
`airAi` 0.15 / 0.17 → 0.19 / 0.19 ms a tick in year 1 (about 1.5 % of the tick); the year's tick
3.41 / 3.93 → 3.56 / 3.79 ms, within the pair's spread. Years 2 and 3 differ by `operationalAi`
(0.34 → 0.66 ms), the land war of a diverged world. The hop field looks only at the bases within
a reach's rows of a place (as `inReachOf`): same hashes, `airAi` 0.197 → 0.184 ms in year 1.

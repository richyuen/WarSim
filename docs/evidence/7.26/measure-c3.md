# PLAN 7.26c3a: the landing per war, measured (2026-10-18)

Code: `9eb329b` for the "before" (the old rule: a land front in any of a nation's wars bars a
landing in all), the working tree of 7.26c3a for the "after". Tools: `tools/diag/landWar.ts`
(8 years, seeds 2843 and 7919; its new `perWar` and `perEnemy` columns), `tools/diag/airWar.ts`
(8 years, the same seeds), and probes in `.cache/tmp/`: `abc3.ts` (from one saved state, 180 days:
the big wars' contact share, sorties aloft, embarks and landings), `c3send.ts` (from one saved
state, each land formation that sets out for a port of its own nation: its nation fronted or not,
its distance to its nation's nearest front cell, its fate: boarded, re-ordered elsewhere, gone,
still on the way), `saveAt.ts` (states saved by the old rule at given days).

## 1. What the old rule barred (`landWar.ts` on `9eb329b`)

For each nation-day stopped by `fronted` (a front in some war), the gate it would meet if the
front were judged per war (its wars in which it has no front; targets: their other side) and per
enemy (its enemies it has no front with). "load/send": the gates `atPort` and `send`, where the AI
puts formations aboard or sends them to a port. Measured with the tool's first form, `perWar` with
any free formation, before the far-army restriction; the committed tool counts `gates` and
`perWar` under the adopted rule (§2, variant 3), so a re-run on `9eb329b` gives other figures.

| seed | year | load/send, old rule | fronted | per war: load/send | per enemy: load/send | per war: who |
|---|---|---|---|---|---|---|
| 2843 | 1 | 194 | 6,471 | 528 | 999 | Italy, Japan, Germany, the Soviet Union |
| 2843 | 2–8 | 12–434 | 5,217–8,864 | 66–459 | 287–758 | Japan, Italy, Britain, Raj |
| 7919 | 1 | 193 | 5,995 | 522 | 1,274 | Britain, Japan, France, Raj, Italy |
| 7919 | 2–8 | 0–312 | 4,430–7,717 | 162–785 | 319–1,094 | Japan (atPort 157–272 a year), Britain, French Equatorial Africa |

Per war about doubles to triples the nation-days on which a landing could be planned; per enemy
doubles that again. The task's text is per war (a landing while a front with the same side is live
is what the old rule guarded against); per enemy was not tried.

## 2. Three variants of the rule

1. **Per war, any free formation** (`free` as before). From four states saved before 7.26c1a
   (`h*_d400`, `h*_d900`), 180 days: seed 7919's states bit for bit the same (the rule never
   bit there), seed 2843's one embark more. From five states saved by the old rule on `9eb329b`
   (seed 2843 days 400, 1100, 2600; seed 7919 days 1100, 2450), `c3send.ts`: of 30 formations of
   fronted nations sent to a port, 24 stood within `DEPLOY_RANGE_CELLS` (60) of their own front;
   one boarded; the rest were re-ordered elsewhere (the operational AI's) or were still marching.
   The rule pulled garrisons off the front to a port and the operational AI sent them back.
2. **Per war, the far army only**: a fronted nation's free formations beyond 60 cells of every
   cell of its own front. From the same five states: no embark more than the old rule; nine far
   formations sent from seed 2843's day 1100, none boarded (most still on the way after 30 days).
   `landWar.ts` 8 years: seed 7919's Japan, `atPort` 198 and 272 days in years 3 and 4 under
   variant 1, did not appear at all. Its home islands lie within 60 cells, as the crow flies, of its
   China front, but on another land: the army the rule was for.
3. **Per war, the far army, the front counted on the formation's own land** (`grid.component`):
   adopted. From states of the windows where variants 1 and 2 bit (seed 2843 days 760, 950; seed
   7919 days 400, 560) and the five above, 180 days each:

| state | contact share, old → new (%) | aloft, old → new | embarks, old → new | landings, old → new |
|---|---|---|---|---|
| 2843 d400 | 25.8 → 29.6 | 44.0 → 43.3 | 4 → 4 | 5 → 5 |
| 2843 d760 | 8.5 → 10.2 | 17.5 → 17.4 | 2 → 2 | 2 → 2 |
| 2843 d950 | 7.7 → 7.7 | 11.0 → 11.0 | 4 → 4 | 4 → 4 |
| 2843 d1100 | 32.9 → 32.8 | 22.7 → 22.7 | 3 → 3 | 3 → 3 |
| 2843 d2600 | 23.6 → 23.6 | 24.9 → 24.9 | 0 → 0 | 0 → 0 |
| 7919 d400 | 21.5 → 21.5 | 26.8 → 26.8 | 3 → 4 | 3 → 4 |
| 7919 d560 | 16.8 → 17.1 | 24.1 → 24.3 | 3 → 4 | 2 → 3 |
| 7919 d1100 | 20.4 → 16.0 | 12.2 → 15.9 | 0 → 2 | 0 → 2 |
| 7919 d2450 | 22.9 → 22.9 | 14.6 → 14.6 | 6 → 6 | 6 → 6 |

Embarks 25 → 29, landings 25 → 29; Japan's landing from seed 7919's day 1100 lifts sorties aloft
by 30 % there, and that state's contact share falls 4.4 points; the others hold or rise.

## 3. Eight years (`landWar.ts`, `airWar.ts`; one run each, within the chaos of a changed rule)

| seed | years 2–8 mean sorties aloft | air battles, years 2–8 | big wars' contact share, years 2–8 mean | aboard nation-days, 8 years |
|---|---|---|---|---|
| 2843 | 16.7 → 18.2 | 2,477 → 2,545 | 0.164 → 0.131 | 600 → 672 |
| 7919 | 13.2 → 15.0 | 2,265 → 2,325 | 0.158 → 0.084 | 243 → 430 |

Sorties aloft and nation-days aboard rise on both seeds; the big wars' land contact falls on both
(it fell on five of the six 8-year runs of the three variants). From the saved states the contact
share does not fall but on one state; the 8-year runs diverge from the first year, so this is
noted, not taken as the rule's effect. 7.26e re-measures the AT on 10 seeds.

## 4. Not changed here

- The colonies and small members with no transport group at a port of their own (60–90 % of the
  unfronted nation-days): PLAN 7.26c3b.
- An airbase taken with a port is its taker's (airbases follow the cell's controller,
  `systems/air.ts`), so a landing that takes one gives the side a base nearer the enemy.
- Seed 99 over three years (`--profile`): `invasionAi` 0.5 to 1.1 % of the tick, its longest call
  21.6 ms once.

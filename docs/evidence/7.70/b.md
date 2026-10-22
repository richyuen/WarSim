# PLAN 7.70b: a new front, the AI's landing behind or beside its held front (ADR-623)

2026-10-21. Before: HEAD `65bd907c` (7.70a's rule). After: the rule. Tool: `tools/diag/newFronts.ts`
(new): 180 days of each of the critic's 48 saves (`critic/c11_seed*_y10.bin`, `_y20.bin`), four runs
of 12 (`before_y*.json`, `after_y*.json`, their `.log`s, in this folder).

## 1. The read (the whole's AT, PLAN 7.70)

- **Open wars:** those in which, on some day, a side has a nation with a transport group of a
  division's room (12,460 men, the 1938 infantry division) and an enemy coast it reaches by sea (a
  cell of the other side's beside a zone not iced, in that group's waters, held by no enemy of it).
- **A new front:** a `FormationLanded` on one of the first 150 days, (1) within 3 cells of a cell of
  the other side's (an enemy's coast), (2) more than DEPLOY_RANGE_CELLS from every front cell of
  the lander's own (those within 3 cells of the landing left out: the beachhead's own front),
  (3) a cell within 3 cells of it, on its land, held by the lander's side 30 days on. Counted by war.
- **Fronted:** of those, the landings by a nation with a front cell of its own (beyond the
  beachhead's). The AT's text counts a lander with no front at all, whose distance to "every front
  cell of its own" is trivially over the range: that is the landing of a war with no front (PLAN
  4.6b), there before this task. The fronted count is a Normandy proper, beside or behind a front.
  On HEAD it holds `planLanding`'s far army landing in a war with no front while the nation has one
  in another war (ADR-511).
- **Engaged per war:** the land formations in a fight of nations at war, summed over the days,
  over the wars summed over the days (`warSides.ts`' engaged ÷ wars).

| 180 days of the 48 saves | open wars | a new front (AT as written) | by a side with a front | engaged per war-day | landings | in debt |
| --- | --- | --- | --- | --- | --- | --- |
| HEAD (before) | 310 | 88 (28.4 %) | 39 (12.6 %) | 0.238 | 638 | none |
| the rule (after) | 304 | 101 (33.2 %) | **70 (23.0 %)** | **0.219** | 555 | none |

Bars: at least a fifth: as written met before and after; by a side with a front met after (12.6 %
→ 23.0 %). Engaged per war not below HEAD's: **missed** (−8 %; lower in each batch: 0.118 → 0.108,
0.270 → 0.256, 0.189 → 0.164, 0.378 → 0.345). No lander's gold under 0 after its landing.

The fronted landings that held, by lander (`rows[].far`, `fronted && held`): HEAD 57 (Japan 17,
Germany 10, France 9, the Netherlands 7, the Soviet Union 3, Britain 3, 8 more one each); after 131
(Japan 39, Germany 19, Britain 15, the Netherlands 13, the United States 12, Australia 7, France 7,
the Soviet Union 4, China 4, Poland 3, Italy 3, five more one each).

The invasion AI on seed 99's year (`--profile --affinity 0xFFFF`, alone): mean 0.048 ms, longest
call 10.3 ms (bar 50), 174 calls of 1 ms or more. The tick mean 2.455 ms, in 7.70a's band
(2.44–2.48). The pin cd6ce5eb → b749e952.

## 2. The rule

`planNormandy` (`ai/invasion.ts`), after a landing that gave no order, before the ferry, when the
nation's front is held (`frontHeld`: its men about the front at least the enemy's). Target: an
enemy's coastal city far from that front, on a land where its bloc owns and controls no city, by a
zone its bloc's way from home reaches (`beachReach`, `seaSupply.ts`): a beachhead there is fed from
the beach (PLAN 7.70a). Worth (3 a capital, 1 a city) over one more than the enemy's formations
within 10 cells. The group boards together (`board`'s `group`, `tryLanding`'s `via`).

Test: `normandy1938.test.ts` (Britain, its front with Germany overseas and nobody near, an island
with a city handed to Germany: a group of three quarters of the room goes aboard for it). Red
without (the ferry takes one formation to the front).

## 3. Why the engaged figure falls (not measured further)

- The worth divides by the enemy's formations near, as the task asks: an army landed where nobody
  stands adds no engaged formation.
- The group holds the turn while its rest is sent or marches to the port, so the ferry, whose
  landings reach the fights, gets fewer turns: landings 638 → 555.
- `frontHeld` holds at none against none: a nation whose front has nobody of either side near
  sends its free army overseas rather than to that front.

Found beside it: the old landing and the ferry carry one formation a trip (the first's order sets
the transports sailing, and `tryLanding` takes only standing transports): PLAN 7.72.

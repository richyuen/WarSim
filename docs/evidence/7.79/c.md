# PLAN 7.79c: the ferry from a front's land the army cannot walk to its front

Run 12's saves (`critic/c12_seed*.bin`), HEAD `1d3c8afd` against the rule (ADR-636).

## 1. Read first: does a landing carry to a port on the boarders' own landmass?

Yes. `tryLanding` (`systems/amphibious.ts`) asks for a port of the nation's that the formation
stands at, transports there with room, and water near the target's land; nothing about the
target's landmass against the boarders'. So the rule is the ferry's `free` set, not a sea march of
its own.

## 2. The transports (`tools/diag/strandFerry.ts`)

| save | pile | men | US transport groups (24,000 men each) | at a port of its own, 30 of 30 days | aboard | `wantsFerry` |
|---|---|---|---|---|---|---|
| 1129 year 10 | 60 at 625163 | 714,480 | 12 | yes | 0 | true |
| 6421 year 20 | 74 at 746057 | 155,861 | 34 | yes | 0 | true |

Transports are not short: the USA has bought them (`wantsFerry`, ADR-614, for its island armies)
and they stand idle. Its nearest open port to the pile: Milwaukee 31 cells (1129, a lake), Baltimore
3 cells (6421). `wantsFerry` was not widened (both halves of ADR-614/624's pattern were not needed
here).

## 3. The rule and what it moved

`planFerry` (`ai/invasion.ts`): a standing land formation on a front's land whose class reaches no
front cell of the nation's on that land, nor of its side's beside its enemies (`frontReach`, by
`reachesOnLand`, the operational AI's reach of a class to a sector's cell, now one function in
`ai/operational.ts`), is the ferry's as one on a land with no front. A port takes the ferry only if
a front cell is reached from it.

The ferry's turn of the USA, first two turns from the save (a trace, removed):

| save | free for the ferry, HEAD | with the rule | the turn's transport group | its order |
|---|---|---|---|---|
| 1129 year 10 | 20 | 157 | 126 at Nuuk (Greenland) | none: Greenland's three formations, 120–236 cells from Nuuk, do not march to it |
| 6421 year 20 | 16 | 210 | 61 at Port-of-Spain, then 15 at Roseau | none: the sail to the army (cell 1032865) refused |

Piles of 30 or more of a nation at war on one cell 30 days running (`piles.ts --days 30`, 1129 year
10, 7019 year 10, 6421 year 20): HEAD 3 (60, 53; 0; 77), with the rule 3 (the same). **The AT's bar
(3 → 0) is missed.**

## 4. The cause the run found (PLAN 7.88)

`transportsAtPort` takes one group a turn, the most room and then the lowest id. On both saves that
group can never act, and the ferry's turn (once in STAGGER days) gives no order. Had it acted, one
group (24,000 men) a turn carries two of 1129's divisions (11,908 men each): eight in 30 days of the
60. So two causes: (a) a group that cannot act takes the turn; (b) one group a turn against an army
of hundreds of thousands. (b) is a change of design (more transports at sea, island garrisons drained
faster): ADR-637, the user's.

## 5. Cost

See the PROGRESS entry (seed 99's five years and the two late saves, both bundles at once on
separate P-cores, `.cache/prof79c/`).

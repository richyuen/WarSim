# PLAN 7.97: the American piles (2026-10-23)

Bar: on unseen seeds 821–830 × 20 years (`tools/diag/landAt.ts`), American piles of 30+ formations held
one cell 30 days running 18 → at most 4; engaged land formations per war in years 2–20 not below 0.477
(HEAD's, `docs/evidence/7.79/at.md`).

## 1. The cause, read (`tools/diag/pileWhy.ts`, new)

From saves of HEAD's runs (`npm run sim -- --save`), the US land formations by cell, the transport groups
at US ports, and the invasion AI's turns for the USA (`FERRY_PROBE`, `LANDING_PROBE`):

- **822 year 5** (`why_822_head.log`): 32–36 US divisions at Washington, (585,364), 6 cells from
  Baltimore, for 90 days. The USA's one war (with the British and French blocs) has no front, its
  allies none either: no ferry (`noFront` every turn). The landing's turn takes the group with the most
  room, which stands at Pearl Harbor; `board` finds nobody on Hawaii: `noArmy`, every week. The other
  groups stand at Pearl Harbor and St. John's.
- **825 year 17** (`why_825_head.log`): 74 at Washington, 34 at Veracruz, 19 at Arviat; 238 free
  formations, 166 of them in the Americas. The ferry's turn tries its 9–14 groups, nearly all at Tallinn,
  Bizerte and Djibouti, where a few free formations stand on the Eurasian landmass: every `board` there
  gives no order, week after week; the one group at Norfolk lifts one load a week.

Both: the lift is tried only from the ports where the groups happen to stand, and a group that gives no
order there stays. Not the cause PLAN 7.97 named (the army inland, far from ports with a group): the
Washington pile is 6 cells from Baltimore, and no group comes to Baltimore.

## 2. The rule tried (`patch`, not committed)

`sailToMost` (`ai/invasion.ts`): a transport group that gives no order at its port sails for the land
where most of the nation's free army stands by men (of the lands with a port of its), when that is not
its port's land, by the formations on the cell where most of them stand first (`sailToArmy`). The
landing's turn takes, of its groups at ports, the most room among those on a land with free army before
the most room overall. The ferry's turn does the same after a `board` with no order, within the turn's
route searches. Unit test `transportsToMost1938.test.ts`: the USA at war with Portugal, its one group
at Pearl Harbor, nobody on Hawaii: the group sails for a mainland US port (red without: no order).

On the saves (`why_822_rule.log`, `why_825_rule.log`, 90 days): the groups act (822: 5 orders against
0; 825: 37 against 5), Washington's pile on 825 74 → 67–72 (new divisions are raised there), on 822 32
→ 33.

## 3. The AT (821–830 × 20 years, 5 at a time)

| | engaged per war, year 1 | years 2–20 | ratio | piles 30+ held 30 days | American |
|---|---|---|---|---|---|
| HEAD (`7.79/at/head_*`) | 6.476 | 0.477 | 0.074 | 32 | **18** |
| the rule (`at/rule_*`) | 6.496 | **0.480** | 0.074 | 31 | **12** |

American per seed, HEAD → rule: 821 2 → 2, 822 2 → 0, 823 0 → 1, 824 5 → 2, 825 5 → 3, 826 0 → 0,
827 0 → 4, 828 1 → 0, 829 1 → 0, 830 2 → 0. Washington (585,364) now on 1 seed (821, 60 days; HEAD 5
seeds, up to 548 days). **The piles bar is missed (12 against 4)**; the engaged bar holds.

## 4. What is left

The 12: Alaska (827: 69 at Nome, a US port, 514 days), the North Atlantic coast (723,304 on 825 and 827,
up to 612 days; 680–681, 284–315), the west coast (323,291), Washington once, and US armies landed in
Africa (825, 821). 827 year 14 (`why_827_rule.log`, the rule in): the 69 stand at Nome, the port, with
the war's front across the Bering Strait in Kamchatka; the ferry's turns find 2 groups standing at ports
and both act. The limit there is the lift itself: the economic AI's ferry want (`wantsFerry`) keeps one
transport group in training at a time, whatever the army waiting (PLAN 7.49d3, ADR-614).

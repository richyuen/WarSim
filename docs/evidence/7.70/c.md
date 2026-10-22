# PLAN 7.70c: the ferry to a beachhead with no port (ADR-624)

2026-10-21. Before: HEAD `7e27d0a4` (7.70b's rule). After: the rule. Tool: `tools/diag/newFronts.ts`
with a column added for this task (`reinforced`): 180 days of each of the critic's 48 saves, four
runs of 12 (`c_before_y*.json`, `c_after_y*.json`, their `.log`s, in this folder). HEAD's read
matches 7.70b's "after" exactly (`b.md`), so the tool's new column changed nothing else.

## 1. The read

- **Far landings, 30-day hold** (the AT: at least half of 7.70b's landings): a far landing as in
  `b.md`; held when a cell within 3 cells of it on its land is held by the lander's side 30 days on.
- **Beachheads** (new): every far landing on any of the 180 days (one a nation a day within
  DEPLOY_RANGE_CELLS). **Reinforced**: a beachhead that a `FormationLanded` of the lander or its
  side reached on a later day, on its land within DEPLOY_RANGE_CELLS: what the rule is for.

| 180 days of the 48 saves | far landings | held 30 days | of them fronted, held | beachheads | reinforced | by landings | engaged per war-day | in debt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HEAD (before) | 287 | 249 (86.8 %) | 131 of 154 | 430 | 74 (17.2 %) | 76 | 0.219 | none |
| the rule (after) | 287 | 249 (86.8 %) | 131 of 154 | 424 | 70 (16.5 %) | 72 | 0.218 | none |

The AT's bar (at least half hold 30 days): met, before and after. The column that isolates the
rule: flat (noise). Seed 99's year: the pin unchanged (b749e952), the tick mean 2.471 ms (7.70a's
band, 2.44–2.48), the invasion AI's longest call 8.4 ms (bar 50).

## 2. Why the saves barely move (a probe, 90 days of 1129, 2081, 4219, 7019 year 10)

Embarkations of every kind (landings, Normandies and the ferry) 29: to a port 22, to a beach of the nation's own 1 (7019). A nation's front on a land with no open
port of its own or of an ally, sampled every 30 days: 2, 13, 1 and 1 such nation-lands on the four
saves. The case the rule serves is rare on the critic's saves. Why a beachhead so seldom stands as
a front on a portless land (taken whole, thrown back, or beside a port of its side) is not measured.

## 3. The rule

`planFerry` (`ai/invasion.ts`): on a front's land where no port of its own nor of a nation fighting
beside it passes the ferry's tests, a front cell of its own beside water whose zone passes them
(not iced, in the transports' waters, held by no enemy) stands as its port, on the front (its
distance to the front 0: before every port not on a front cell), the nearest the transports by sea
of such cells. `wantsFerry` (`ai/economic.ts`): a front cell of its own beside water not iced stands
as a landing port on that front's land.

Test: `beachFerry1938.test.ts` (Britain's only front a beachhead on an island with a German city and
no British port, a German division there, transports and a division at Portsmouth: the want stands
and the division goes aboard for a front cell of the beachhead). Red without: the want false
without `economic.ts`'s change; nobody aboard without `invasion.ts`'s.

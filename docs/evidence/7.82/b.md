# PLAN 7.82b: the overseas holders that hold still: the read

Seeds 834 (years 6–22) and 835 (12–29), HEAD `979bed0b` (sim as `b70466db`). Tools:
`tools/diag/overseasHold.ts` (the `LANDING_PROBE` in `ai/invasion.ts`; output `.cache/hold82/`), the
yearly ranks from 7.82a's `churnAt.ts` (`.cache/churn82/`), and a scratch dump of Denmark's cities,
ports and their nearest waters from the checkpoints (834 year 5, 835 year 11).

## Two causes, not one

**1. The United States and Canada on 835 are at peace.** The USA is at war 0 days in years 16–29 (61 and
22 days in 14–15), Canada 0 days in 17 and 19–29. No landing rule reaches a nation nobody fights: on 835
their part of the stasis is diplomacy's, not the invasion AI's. On 834 both are at war 187–365 days a
year and their cells move (USA 81k–169k, Canada 40k–73k); they are not what holds 834's set.

**2. Denmark's Greenland is at war and never landed on.** Denmark is in the five on both spans (834:
31,811–33,517 cells, at war 12–365 days a year, mostly over 250; 835: 25,496–25,928, at war 187–365 a
year in 13 of the 18), its land Greenland (835) or Greenland and Jutland (834), its enemies the great
blocs' members (ENG, SOV, FRA, JAP, USA, GER and their allies). Landings on Denmark's cells: 834, 5 in
year 6 and none after; 835, 0–2 a year. Australia, the sixth on both, is landed on when the water
allows (835: 5, 4, 1, 6 a year; 24.7k → 17.4k cells in years 22–27): the planner reaches an overseas
holder when it is the nearest.

## Why Greenland is not picked

Greenland's places (835 year 11: 11 cities, Denmark's capital Sisimiut among them; ports Sisimiut,
Upernavik, Qaanaaq, Narsarsuaq):

| Place | Nearest water (by the zones) |
|---|---|
| Sisimiut (capital, port), Qeqertasuaq | Disko Bay, open |
| Paamiut, Qaqortoq | Davis Strait, Labrador Sea, North Atlantic, open |
| Tasiilaq, Kulusuk, Timmiarmiut | North Atlantic, open |
| Ittoqqortoormiit | Greenland Sea, open |
| Upernavik, Qaanaaq, Nuussuaq, Kullorsuaq, Savissivik, Kangersuatsiaq, Tasiusaq | Baffin Bay or Melville Bay, ice (closed all year, `ice.json`) |
| Narsarsuaq (port) | none within the port's reach (`noWater`); the North Atlantic at 5 cells |
| Kangerlussuaq | none within 4 cells (inland) |

So the `ice` and `noWater` failures the probe counts are the northern towns and Narsarsuaq; half the
places pass every test, and lose on the score:

- **Landing** (`planLanding`): the nearest enemy port by sea km from the transports. Greenland's best
  5,000–15,000 km against the pick's 600–4,800: never the nearest.
- **Normandy** (`planNormandy`): worth = DEPLOY_RANGE / the city's distance from the planner's own
  front (PLAN 7.73a), over 1 + enemy formations near. Greenland's best 0.06–0.95 against the pick's
  0.5–2.8: far from every front, so always below a city behind one.

Both scores are built to put the landing where the planner's war is. A land of the enemy that holds
none of the enemy's army and touches no front is in neither's reach, however large.

## What it would take (the AT's sensitivity)

The stasis breaks when the five as a set change in a year. Denmark's margin over the sixth during the
span (`.cache/churn82/`):

- 834: 33.3k against 25.3k–31.1k (Australia, Japan); the margin 2k–8k cells.
- 835: 25.7k–25.9k against 22.4k–25.1k (Australia, Japan, the sixth after year 21); the margin
  0.6k–3.5k cells.

A landing that takes a few thousand of Greenland's cells in a middle year of either span (834's
years 10–18, 835's 16–24) splits it under 15 years. The USA and Canada's peace on 835 does not have
to move.

## The rule tried (`b.patch`, not committed)

`ai/invasion.ts`: a target on an *empty land* (the planner's enemies stand on it with at most
EMPTY_LAND_FORMATIONS = 2 land formations) counts its sea km over EMPTY_LAND_PULL = 3 in a landing, and
its worth times 3 in a Normandy. Unit test (`b/landingEmptyLand1938.test.ts.txt`): Britain at war with
Denmark's side lands on an empty land of theirs (Iceland's on that seed) before Copenhagen; red with the
rule off. Pin with it: b9bff4bd → ddbe13a2.

From the saves (`overseasHold.ts`, the rule against HEAD's run before 7.97): on 834 from year 6
Greenland is landed on (24 landings in year 6, 11 in year 7) and Denmark falls 33.3k → 21.5k cells by
year 10; on 835 from year 12 nothing changes for Denmark (the planners that can land have fronts, and
Greenland's Normandy score, tripled, still loses to the cities behind them).

## The AT (834 and 835 × 30 years from 1938; `b/rule/`, `b/ctl/`)

| | 834 longest stasis | 835 longest stasis | battle share, years 10–30, pooled |
|---|---|---|---|
| 7.82a (before 7.97's rule) | 17 | 18 | 1.68 % |
| HEAD `9f29c3f2` (7.97's rule), no rule here | **7** | **14** | **1.77 %** |
| HEAD with the rule | 9 | 13 | 1.84 % |
| Bar | ≤ 15 | ≤ 15 | ≥ 1.68 % |

**The bar is met on HEAD without the rule.** 7.97's rule (ADR-662 a) changed both histories from year
1, and the rule's own difference on these runs (9 against 7, 13 against 14, landings 365/272 against
328/275) is within what a 30-year run from 1938 cannot separate from chance. The 7.82a figures are
stale since 7.97. Denmark is still in 835's span on HEAD (SOV DEN YEM CAN USA, years 15–28), and the
USA and Canada with it: the two causes read above stand, but neither holds a span over 15 years here.

No rule (ADR-664). The patch is a candidate if 7.82's AT on unseen seeds finds a span held by a remnant
at war, judged then by what isolates it: landings on the holder's cells and the cells it loses, A/B from
a save, as 834's.

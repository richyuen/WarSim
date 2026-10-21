# PLAN 7.49d: the sea powers' home armies (measured; no rule)

2026-10-21, on HEAD `6e81825` (the critic's saves were written by `dd3b730`; the rules of 7.49b1,
b2 and c are in since: each save is read by this code from its day). Tool:
`tools/diag/islandArmies.ts`, 60 days from each of the 48 saves (`critic/c11_seed*_y10.bin`,
`_y20.bin`). Figures: `d/island_y10.json`, `d/island_y20.json`.

## 1. The AT's figure on HEAD

Island formations (standing on a landmass with none of their nation's front cells, while it has
one: `landStates.ts`'s class) of the land formations of nations at war:

| | day 1 | day 60 (the AT's read) |
|---|---|---|
| year-10 saves | 1,419 of 6,625, 21.4 % | 1,389 of 6,361, **21.8 %** |
| year-20 saves | 2,017 of 7,275, 27.7 % | 2,003 of 6,759, **29.6 %** |

The bar: under 10 % after 60 days. In 60 days the watched nations (5 island formations or more,
62 and 57 of them) board 6 and 0 formations, and land 8 and 0.

## 2. The invasion AI's gate for them (`planLanding`, read daily)

Island formations on day 1 by the gate their nation meets most days:

| gate | year 10 | year 20 | what it is |
|---|---|---|---|
| `fronted` | 854 (66 %) | 1,164 (62 %) | a land front in each of its wars, on another landmass |
| `noneFree` | 288 | 516 | its transports at a port on another land than the island army |
| `send` | 94 | 175 | formations sent to the port; none boards (§4) |
| `atPort`, `aboard`, `noTransport`, `noTarget` | 52 | 29 | |

`fronted` is the measure's §4.3: Britain on 7019 year 10 (117 island divisions at London, its war
with Japan fronted in Asia), the United States on 5683 and 8693 (135 and 127), Japan on 8167. The
invasion AI plans a landing only in a war with no front of the nation's (ADR-511), and the
operational AI orders only the formations on a front's landmass: no rule ships a home army to the
nation's own front overseas. Overseas muster (`production.ts`, `musterPoint`) raises its new
formations in the theatre (933 and 1,358 of the island formations are of nations whose muster is
there), but the army already at home stays.

## 3. What the transports could carry (the bar's reach)

The best a ferry could do, per watched nation (`carry` in the JSON): from its ports on its island
army's land to the nearest port it holds on a land of its front (or an enemy's port in a war with
no front), by straight km (`seaKm`, under the way by sea), at its transport groups' pace
(16.5 km/h), each round trip carrying all their room (24,000 men a group of 12), the first trip
after a week to load (the AI's STAGGER) and each after the same:

| | island formations, day 1 | carried at best | island share at best |
|---|---|---|---|
| year 10, a week to load | 1,419 | 544 | 13.2 % |
| year 10, a day to load | 1,419 | 707 | 10.7 % |
| year 20, a week to load | 2,017 | 481 | 21.1 % |
| year 20, a day to load | 2,017 | 740 | 17.6 % |

Island men 14.7 M at year 10 against 1.7 M of transport room, the watched nations' groups
together (8.5 ×). What holds the ferry: room (one or two groups of 24,000 a nation: 7019's Britain,
1.4 days from France, carries 25 of its 117 in 60 days), no own port on the front's land (217
island formations at year 20, the Soviet Union's 158 on 5309 among them), no transports (90 and
155). Even a perfect ferry loading daily over straight lines leaves the bar missed (10.7 %,
17.6 %): the transports cannot carry it (the AT's own escape: the bar is the user's, ADR-554).

## 4. A second cause: the port the army is sent to is not where it boards

Of the nations on `send`, 10 stand there 30–60 of the 60 days with 0 boarded (Germany on 2081
year 20: 56 island formations, `send` all 60 days). `planLanding` sends formations to its port's
land cell (`world.ports[port].cell`) but loads only those within AT_PORT_CELLS (3) of the port's
water; `tryLanding` takes either. Port 602 (999,241, Germany's on Britain): its water at 995,244,
4 cells off; formation 148 stands on the port's cell from day 7302, never loaded, and each week the
planner sends two more. Of the 579 ports with water, 19 have it more than 3 cells from the land
cell (4–11; London's 7.5 down the Thames, PLAN 4.9b). The island formations of the 10 nations held
there: 63 and 120 (4.4 % and 5.9 % of the island count). A defect, not balance: PLAN 7.49f.

Also seen, not a cause here: 4513 year 10, Latvia `atPort` 60 days, its transport group's room
2,000 men (one transport left) under a division's.

## 5. What is left

- The ferry (a fronted nation's island army shipped to its own port on its front's land): the
  user's, with the bar (ADR-591, proposed): it cannot reach 10 % on these saves.
- The send/load port: PLAN 7.49f.

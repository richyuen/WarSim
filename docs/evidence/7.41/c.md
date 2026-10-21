# PLAN 7.41c: the editor's fleets (ADR-603)

## The case

Critic run 11, editor 7 and naval 7: "the two navies placed face to face in the North Sea fight no
battle in 30 days (`marks[].sea` 0; run 10 saw 1 at day 3)" (`critic/c11_g_4877.json`, its script
`critic/scripts/c11_g_editor.mjs`). The critic placed two German battle squadrons (ids 1468, 1469)
and two British (1470, 1471) by the editor on seed 4877, exported the scenario
(`critic/c11_critic_standoff.warsim-scenario`), started it from the title, had Germany declare war
on Poland and then on Britain, and read `hud.seaBattles.value.length` at days 3, 10 and 30: the sea
battles standing at those three instants.

## The trace (`tools/diag/editorFleets.ts`)

The critic's file, loaded headless, its two declarations given at tick 0, stepped hour by hour for
30 days. The editor's fleets are each nation's last two by id; their stations load with the file
(`World.station`: 1468 at (1044.5, 250.5), 1469 (1042.5, 252.5), 1470 (1034.5, 248.5), 1471
(1036.5, 245.5)). All four are alive after the first hour: the month-start lay-up that 7.41b found
(33 of 102 small nations' squadrons gone at tick 0) does not touch Germany or Britain, which can
pay.

| | HEAD `f9656a3` | the critic's `dd3b730` |
|---|---|---|
| sea battles holding an editor fleet | 4 | 4 (the same) |
| the first | hour 34, 237 km off Newcastle: 1469 against six British fleets (1055–1070) | the same |
| Germany's 1468, 1469 | sunk at hours 101 and 100, off Wilhelmshaven, by French fleets | the same |
| Britain's 1470, 1471 | alive, on station, in no battle; nearest enemy fleet 88 and 91 km (1468, hour 51) | the same |
| sea battles between the two blocs in 30 days | 30 | 30 |
| sea battles standing at days 3, 10, 30 | 0, 0, 0 | 0, 0, 0 |

The case meets at sea on day 1.4, at HEAD and at the critic's own commit. A sea battle lasts hours
(the first 21, from hour 34 to 55; 1468's last from 85 to 100), so a reading of the battles standing
at three instants finds none: the critic's 0 is its probe's.

In the page (a scratch Playwright run on the critic's helpers, `c11_lib.mjs`, not kept): the file chosen on the title and
started, the same two declarations, stepped an hour at a time to 60 hours. The HUD has a
Germany–United Kingdom sea battle at every hour from 34 to 55; at hour 36 the ticker's row is "Fleets
closing: United Kingdom and Germany" (`c_northsea_h36_300m.png`: the four editor squadrons on their
stations at 300 m/px); at hour 60 the history holds "3 January 1938 United Kingdom and Germany fought
at sea: United Kingdom lost 52 ships, Germany 18" (`c_history_h60.png`: Britain's battle squadrons
1055, 1056, 1062 by Germany's 1469, down to 3.3k from 13.4k).

## Why Britain's pair never fights

A fleet the editor placed holds its place (PLAN 7.22c, `naval.ts` `navalAi`): no order of the naval
AI moves it, and it fights where it is seen. A battle squadron sees about 29 km (its destroyers'
`detection` of 30, less the enemy battleships' stealth of 2 %); the critic's stations are 107–120 km from the enemy's. The
two placed pairs can never see each other: Germany's met Britain's home fleet, which sortied from
port, and broke off (driven off, a placed fleet drops its station and sails home, `breakOff`).
Placed "face to face" at more than a sighting apart, two stationed navies stand until one of them
is found by the other's ships from port. That is 7.22c's rule as written; whether a placed fleet at
war should close on a placed enemy in reach is PLAN 7.59.

## Not traced

Britain's 52 ships lost to one German battle squadron in the first battle: German aircraft are over
that water in the shot (the battle is 237 km off Newcastle, in reach of Germany's North Sea
airfields). Not measured here.

## Leads filed

- PLAN 7.58: the editor's fleet that its nation cannot pay for is laid up at the next month start
  (7.41b's 33 of 102 at tick 0).
- PLAN 7.59: two placed navies at war beyond a sighting of each other never meet.

# PLAN 7.132: a sea battle seen close (ADR-722)

Critic run 15, naval 7: "a sea battle at 15–150 m/px is a few small hulls far apart" (seed 3613, Germany at
war with Poland and Britain from the start; a British transport group against a Nationalist Spanish cruiser
squadron, `critic/shots/c15e_3613_sea_01_row_live_1.png`, its row at 46.8 m/px).

## The cases

`npx tsx tools/diag/seaPairs.ts 3613 70 GER:POL,GER:ENG` (new): the game's battles with a ticker row, the
hour each row first stood two hours running, the pair's distance and kits. The critic's battle is there on
HEAD at hour 1268 (22 February), 20.4 km, British transports (12) against 2 CA, 2 CL, 4 DD. Four more rows
of the same game, each of another kind (the AT names rows, not seeds):

| hour | sides | what fights | pair |
|---|---|---|---|
| 45 | ENG/GER | destroyers against destroyers | 12 km |
| 172 | ENG/ITA | a battle fleet against submarines | 6 km |
| 1268 | ENG/NSP | the critic's: transports against a cruiser squadron | 20.4 km |
| 1424 | ENG/JAP | a battle fleet against destroyers | 12 km |
| 1477 | NSP/POR | a cruiser squadron against destroyers | 18 km |

Rows of four other games (1161–1166, `seaPairs`) stand 3–19 km apart, most 6–12.

## The measure

`tests/e2e/seaClose1938.spec.ts` (1600 × 900, the critic's view): each row pressed, after the camera's
flight; ship elements of both sides on the screen (on the canvas, not under a panel), the nearest two of
the two sides as a share of the view's width, and the least hull on the screen (`MapView.shipHullPx`: the
sprite's side by the shader's rule of the layer that draws it × the hull's share of its atlas frame,
`shipHullShare`).

| hour | m/px | ships on the screen | nearest of the two sides | least hull HEAD | least hull now |
|---|---|---|---|---|---|
| 45 | 69.1 | 4 and 29 | 15.4 % | 5.3 px | 13.0 px |
| 172 | 50.8 | 48 and 24 | 7.2 % | 7.2 px | 13.0 px |
| 1268 | 46.8 | 12 and 8 | 32.6 % | 7.8 px | 13.0 px |
| 1424 | 60.1 | 37 and 52 | 11.2 % | 6.1 px | 15.0 px |
| 1477 | 58.9 | 8 and 8 | 24.0 % | 6.2 px | 15.0 px |

Both sides on the screen and within a third of the width on HEAD already in all five (the critic's 32.6 %,
just inside): no change to the row's frame. Only the hulls missed the bar.

## The change

At T2 a ship was an element sprite of 0.026 cells (at least 5 px) like any other element. Now a ship
frame's element sprite is at least `SHIP_ELEMENT_MIN_HULL_PX / shipHullShare(frame)`: a 13-px hull for
every class (`render/units/ships.ts`). Render only: no `src/sim` change, the pin unchanged.

Tried first: T3's least sizes (`SHIP_FRAME_MIN_PX`, 26 px for a battleship) at T2. Hulls 15–26 px, but a
fleet's slots are 0.03 cells apart (13 px at 47 m/px, 9 at 69): the ships lay over each other bow to stern,
a column read as one long bar.

## Pictures

`row-<hour>-<a>-<b>.png`, each case from its row. The critic's case (`row-1268-ENG-NSP.png`): the transports
are hulls with bows, holds and bridge, touching at 46.8 m/px.

Left as it is (ADR-722, to the next critic report): a column under way at 60 m/px (slots 10 px apart) still touches end
to end, and the wake of a ship falls on the hull astern of it. Spacing a fleet's ships wider is the sim's
element layout (the pin).

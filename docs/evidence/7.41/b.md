# PLAN 7.41b: hulls against the sea at 20 m/px (ADR-602)

## The case

Critic run 11, naval 7: "at 20–40 m/px the enemy side reads as dark ovals (wrecks and submerged
boats) beside red British silhouettes" (`critic/shots/c11n_2081_GER_ENG_3_20m.png`), and at 7.35c
France's dark blue hulls read as the sea to `shipMarks1938`'s measure.

The dark ovals of the critic's shot are not hulls: a crop at 4× shows each an oil slick (`wrecks.ts`
`SLICK`) round a ship wreck with its rust edge (`FILL[Wreck.ship]`, `EDGE`), and the smoke of a
burning hull: the ships the British carrier strike sank. They are drawn as meant. What the AT names,
a living hull against the sea, was measured on its own.

## The measure (`tests/e2e/hullsSea1938.spec.ts`)

Seed 99, after the first hour (the month's start at tick 0 lays up the fleets a small nation cannot
pay for: 33 of the 102 editor squadrons placed before it were gone after it). A battle squadron
(battleships, cruisers, destroyers) of each of the 102 living nations, placed by the editor's
command on a grid 3 cells apart, at two seas: deep (38° W, 28° N) and the North Sea's shelf (3° E,
55.5° N). Each framed at 20 m/px; for each ship on the screen the pixel at its middle against the
commonest of 16 pixels on a ring 22 px about it (the sea there), summed RGB. 1,632 ships a sea.

The middle of a ship at 20 m/px is its marks (bridge, funnel, turrets; 7.10a), mixed with its fill
by the mipmaps. Tinted as every frame was, a mark of a blue nation was its colour's dark shade: the
deep sea's colour.

| | before (HEAD `44e399f`) | after |
|---|---|---|
| least, deep | 6 (Estonia's destroyer); France's destroyer 10 | 48 (the Republic's destroyer); France's 49 |
| least, shelf | 13 (France's battleship) | 48 (French West Africa's destroyer); France's 54 |
| nation-classes under 40, both seas | 95 | 0 |

`b-france-shelf-20m-before.png`, `b-france-shelf-20m.png`, `b-france-deep-20m-before.png`,
`b-france-deep-20m.png`: France's squadron, before and after.

With the marks grey alone (step 1 below) the deep sea passed (least 43) and the shelf did not: five
blue nations' battleships 24–38, their grey marks and dark blue fill mixed into the shelf's colour.
Step 2 closed it.

## The rule (view only)

1. `atlas.ts` `splitShipTint`: a ship's frame is drawn twice, its hull white and black; red holds
   what the white hull adds (the fill), green and blue the marks and outline. `ProxyRenderer`'s
   shader tints the red alone and adds the green as grey. Both parts are sums of what covers a
   pixel, so they stay apart through the mipmaps. The other frames are as before.
2. `tint.ts` `shipTint`: a ship of a hue within 25° of the sea's (215°) has a least lightness of
   0.6 (SPRITE_LIGHT 0.42), falling to SPRITE_LIGHT's at 50°; its hue and saturation kept. A grey
   and a hue far from the sea's are as their sprites' (Britain, the Soviet Union, Germany, Italy,
   Japan unchanged).

Specs by hand, all green: `hullsSea1938` (2), `shipMarks1938` (3: the marks' contrast at 15 m/px,
median 0.75, least 0.66, bars 0.6 and 0.25), `seaBattle1938`, `navalDemo1938`, `seaRow1938` (3),
`navalCounter1938`, `seaBattleSeen1938`, `spriteColours1938`, `tint1938`, `smallMark1938`.

# PLAN 7.51a — the planes at T3 (ADR-609)

The critic's run 11 (`critic/shots/c11c_7019_inf_0010m.png`): at 10 m/px over the 7019 front the
aircraft were three white glyphs the size of a squad.

Read by `tests/e2e/planesT3_1938.spec.ts`: seed 7019, Germany at war with Poland from hour 0, paused
at hour 73 (4 January 1938); a German sortie on its way over the front found at 1,500 m/px; the
camera at 10 m/px on it; each plane's middle read on the overlay; a man's figure LINE_CELLS ×
the map's scale × the zoom × the unit size.

| | middle (RGB) | Germany's tint | off (summed) | span | men's figures |
|---|---|---|---|---|---|
| before (`a-planes-t3-10m-before.png`) | 109,109,109 | 204,204,204 | 285 | 13.0 px | 1.48 |
| after (`a-planes-t3-10m.png`), 3 planes | 204,204,204 | 204,204,204 | 0 | 44.0 px | 5.00 |

Bars: off ≤ 40, span ≥ 4 men. A man's figure is 8.81 px at 10 m/px.

Causes: the white edge stroked over a fill some 1.5 px wide at the plane's middle; the map's colour
(Germany's #5d5d5d) where the men and tanks have the sprite tint (#cccccc, PLAN 7.9b).

Seen at 25 m/px (patrolsSeen's day-10 view) and T1 (sortiesSeen's): French planes blue, German light
grey over Germany's dark fill, as their men.

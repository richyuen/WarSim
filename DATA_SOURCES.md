# DATA SOURCES

Every data, art and font source used by WarSim, with its license. Status:
**in use** (shipped or used by a build step), **planned** (chosen, not yet
downloaded), **rejected** (evaluated and not used, with the reason).
`reference/` (private AoC material) is never a data source and is never shipped.

## Geography & map data

| Source | What | License | Status | Notes |
|---|---|---|---|---|
| Natural Earth 10m `land`, `admin_0_countries`, `admin_1_states_provinces`, `populated_places`, `geography_marine_polys` (naturalearthdata.com) | coastlines, modern country/province polygons for 1938 assignment, city names, sea names | Public domain | planned (PLAN 0.18) | sha256 recorded in `public/data/manifest.json` when downloaded |
| NOAA ETOPO 2022 (60 arc-second) | elevation/bathymetry → terrain classes, relief shading | Public domain (US Gov) | planned (PLAN 0.18) | downsampled into an elevation pyramid |
| 1938 border split polylines | interwar borders that cut modern admin-1 units | Our own work | planned (PLAN 1.3) | drawn by hand from public-domain historical knowledge |
| CShapes 2.0 | historical state borders | CC BY-NC-SA 4.0 | rejected | non-commercial clause (ADR-8) |
| aourednik/historical-basemaps | historical world borders | GPL-3.0 | rejected | copyleft would spread to project data (ADR-8) |

## Art

| Source | What | License | Status | Notes |
|---|---|---|---|---|
| Flags (SVG specs) | all nation flags + presets | Our own work | planned (PLAN 1.6) | Germany 1938 = black-white-red tricolour (ADR-10) |
| Unit/ship/plane sprites | proxy and close-tier sprites | Our own work (procedural/SVG) | planned (Phase 2) | |

## Fonts

| Source | What | License | Status | Notes |
|---|---|---|---|---|
| _TBD_ (OFL font for labels/MSDF) | map labels, UI | must be SIL OFL 1.1 or similar | planned (PLAN 1.29) | |

## Code dependencies (runtime-shipped)

| Package | License | Status |
|---|---|---|
| preact, @preact/signals | MIT | in use |
| twgl.js | MIT | in use (WebGL2 helpers, PLAN 0.14) |

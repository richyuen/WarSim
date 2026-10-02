# DATA SOURCES

Every data, art and font source used by WarSim, with its license. Status:
**in use** (shipped or used by a build step), **planned** (chosen, not yet
downloaded), **rejected** (evaluated and not used, with the reason).
`reference/` (private AoC material) is never a data source and is never shipped.

## Geography & map data

| Source | What | License | Status | Notes |
|---|---|---|---|---|
| Natural Earth 10m `land`, `admin_0_countries`, `admin_1_states_provinces`, `populated_places`, `geography_marine_polys` (naturalearthdata.com, GeoJSON from github.com/nvkelso/natural-earth-vector tag **v5.1.2**) | coastlines, modern country/province polygons for 1938 assignment, city names, sea names | Public domain | in use (`npm run data`, PLAN 0.18): land → `public/data/earth/landmask-16384x8192.bits.wsz`; admin-1 → `admin1-geometry.wsz` + `admin1-meta.json.wsz` (PLAN 0.19); others cached for 1.x | URLs + sha256 pinned in `tools/data/sources.json`, also in `public/data/earth/manifest.json` |
| NOAA NCEI ETOPO 2022 v1, 60 arc-second surface elevation GeoTIFF (ncei.noaa.gov) | elevation/bathymetry → terrain classes, relief shading | Public domain (US Government work) | in use: `public/data/earth/elev-{2048x1024,1024x512,512x256}.i16d.wsz` (ADR-13) | sha256 pinned; 4096×2048 level kept locally in `.cache/data/derived/` |
| Natural Earth I with land cover, large size (`NE1_HR_LC`, naturalearthdata.com v2.0.0, naciscdn.org) | land-cover colour → biome classes (PLAN 1.2) | Public domain (Natural Earth) | in use (build step only; extracted TIFF stays in `.cache/`) | sha256 pinned in `tools/data/sources.json`; only derived terrain classes ship |
| Natural Earth 10m `lakes` (GeoJSON, nvkelso/natural-earth-vector v5.1.2) | natural lakes cut from the land mask | Public domain | in use (`npm run data`) | scalerank ≤ 7, reservoirs excluded |
| Natural Earth 10m `geography_regions_polys` (same tag) | wetland + delta polygons → marsh | Public domain | in use (`npm run data`) | |
| Wetland outlines (`tools/data/wetlands.json`) | 10 major wetlands missing from NE | Our own work | in use | coarse outlines from public geographic knowledge |
| Straits list (`data/maps/earth/straits.json`) | 24 walkable crossings | Our own work | in use | shore points from public geography |
| 1938 ownership (`data/scenarios/1938/ownership.json`, `nations.json`) | admin-0/1 → 1938 owner, 25 interwar border polygons, occupation | Our own work | in use (PLAN 1.3) | drawn from public historical knowledge (ADR-8, ADR-16); approximate inside modern admin-1 units |
| CShapes 2.0 | historical state borders | CC BY-NC-SA 4.0 | rejected | non-commercial clause (ADR-8) |
| aourednik/historical-basemaps | historical world borders | GPL-3.0 | rejected | copyleft would spread to project data (ADR-8) |

## Game data

| Source | What | License | Status | Notes |
|---|---|---|---|---|
| Our own work | `data/terrain.json`, `data/units/*`, `data/tech/*`, `data/traits/*`, `data/buildings/*`, `data/maps/*/map.json`, `data/scenarios/*/scenario.json` (PLAN 1.1) | project license | in use | first-pass values from general military-history knowledge; no AoC data (ADR-14) |

## Art

| Source | What | License | Status | Notes |
|---|---|---|---|---|
| Flags (SVG specs) | all nation flags + presets | Our own work | planned (PLAN 1.6) | Germany 1938 = black-white-red tricolour (ADR-10) |
| Unit/ship/plane sprites | proxy and close-tier sprites | Our own work (procedural Canvas2D, `src/render/units/atlas.ts`) | in use (benchmarks); full atlas Phase 2 | |

## Fonts

| Source | What | License | Status | Notes |
|---|---|---|---|---|
| _TBD_ (OFL font for labels/MSDF) | map labels, UI | must be SIL OFL 1.1 or similar | planned (PLAN 1.29) | |

## Code dependencies (runtime-shipped)

| Package | License | Status |
|---|---|---|
| preact, @preact/signals | MIT | in use |
| twgl.js | MIT | in use (WebGL2 helpers, PLAN 0.14) |
| geotiff (devDependency) | MIT | data pipeline only (reads ETOPO), not shipped |
| pixi.js (devDependency) | MIT | benchmark page BP only, not shipped in the game bundle (ADR-4) |

# Critic report: WarSim @ bb1dd4f (PLAN 2.3 done, Phase 2 in progress)

Date: 2026-10-03. Machine: RTX 4070 Ti through ANGLE/D3D11 (`critic/s1.json` → `gpu`), viewport 1600×900,
production build (`vite build` + `vite preview`), driven by Playwright from `critic/scripts/`.

## How this was tested

| Session | Script | What it did | Output |
|---|---|---|---|
| s1 | `critic/scripts/s1_boot_zoom_run.mjs` | Opened the default URL, booted 1938 (seed 7), screenshotted 11 zoom levels over Europe and 4 over China, then ran **12 simulated years** at Max and took a screenshot every 2 years. | `critic/s1.json`, `critic/shots/s1_*` |
| s2 | `critic/scripts/s2_ui_god_editor.mjs` (tsx) | Zoomed with the mouse wheel and dragged; opened the nation panel, map modes, stats, history and settings; used God Mode to declare Germany→Poland war and ran 65 days; zoomed onto the front; used the editor; took control of a nation; saved and continued. | `critic/s2.json`, `critic/shots/s2_*` |
| s3 | `critic/scripts/s3_battle_closeup.mjs` | Ran 10 months, found the closest pair of enemy formations at war (France vs Nationalist Spain near Madrid) and zoomed 2→2048 on it, paused and live. | `critic/s3.json`, `critic/shots/s3_*` |
| s4 | `critic/scripts/s4_modes_editor_player.mjs` (tsx) | Cycled all 8 map modes; used the editor brush, bucket, undo and scenario export (the flag editor was not reached); used God revolt and kill; took control of Poland, selected a unit and ordered a move; played 16 months, then opened charts and history. | `critic/s4.json`, `critic/shots/s4_*`, `critic/critic.warsim-scenario` |
| s5 | `critic/scripts/s5_brush_probe.mjs` (tsx) | Isolated the brush: one click versus a drag. | `critic/s5.json`, `critic/shots/s5_*` |
| headless | `npm run sim -- --scenario 1938 --seed 99 --years 40` | 40 years on a seed nobody tuned for. | `critic/headless_seed99_40y.json`, `critic/headless.log` |

Reference: `reference/screens/steam-screenshot-00.jpg`, `-03.jpg` (AoC v4.x UI), plus the AoC text notes. `reference/NOTES.md`
does not exist, so judgements about "the user's taste" lean on the AoC screenshots alone. Confidence on feel is medium.

What could **not** be tested, because it does not exist at this commit: naval battles, tanks, air battles and AI nukes. PLAN
Phases 3–6 are all unchecked. Those differentiators score 0 and are listed as blocking below.

---

## Scores

| Dimension | Score | One-line reason |
|---|---|---|
| Map visuals & readability | 4 | Borders, curved labels and terrain are good at T0, but the Europe counter pile-up is unreadable, ghost counters appear, rebel flags are blank, and T2/T3 is an empty colour field. |
| Diplomacy / war / alliance / puppet / revolt depth | 5 | The mechanics fire (wars, peace, unions, puppets, capital capture, revolts), but revolts spam micro-states and none of it changes the big picture. |
| Emergent, watchable dynamics (long runs) | **2** | Top-10 land holders unchanged from year 9 to year 40. The map is frozen while fragmenting into "Free X" states. |
| God Mode | 6 | Broad and it works: rename, bonus, AI toggles, war, ally, puppet, buffs, revolt, breakthrough, territory, revive, kill. |
| Editor & scenarios | 4 | The brush does not paint on drag. Bucket, undo after a click and export work; the flag editor was not tested. |
| Stats & history | 5 | Ranking, charts and history with export exist. The default charts are flat lines because nothing changes. |
| UI/UX & polish | 3 | The default URL is a toy test world, there is no menu, the panels look like debug UI, and war banners and order arrows clutter the map. |
| Performance | 4 | 58 fps at T0 and 39 fps at Max speed on an RTX 4070 Ti at 1600×900. AoC's own screenshot shows 137 fps at 1080p. |
| Stability | 6 | Zero console errors and zero crashes across all sessions, and save/continue works. Visual bugs remain (ghosts, a black box at T3). |
| **Differentiator:** semantic zoom to unit level | 3 | T1 NATO counters are OK. T2 is dot grids and T3 is tiny icons in parade squares: no terrain, no fire, no motion seen. |
| **Differentiator:** naval warfare | 0 | Not implemented: no ships, ports or sea zones visible anywhere. |
| **Differentiator:** tanks | 0 | Armour appears in the production list but every armour entry is disabled. No tank was seen in any run. |
| **Differentiator:** aircraft | 0 | Not implemented. |
| **Differentiator:** AI nuclear use | 0 | Not implemented. |

No score is above 7, so there are no claims of superiority to defend.

---

## Per-dimension detail

### 1. Map visuals & readability: 4/10
**Tested:** T0 world view at boot and after 12 years, continent zoom, all 8 map modes, and 11 zoom levels over Europe and China.
**Evidence:** `critic/shots/s1_01_1938_boot.png`, `s1_01_crop_europe_counters.png`, `s1_103_zoom_eu_scale8.png`,
`s4_07_crop_ghost_counters.png`, `s1_4_after_eu.png`, `s4_00_mode_3.png`, `s1_105_zoom_eu_scale32.png`, `s1_106_zoom_eu_scale64.png`.

- **Good:** smooth anti-aliased borders and curved, size-scaled nation labels (`s1_103_zoom_eu_scale8.png`), and the terrain
  map mode is attractive (`s4_00_mode_3.png`).
- **Europe at world zoom is a wall of overlapping counters** (`s1_01_crop_europe_counters.png`). Values are cut off ("2…", "3…k")
  and flags sit on top of each other. AoC (`reference/screens/steam-screenshot-00.jpg`) shows small unobtrusive army dots and
  keeps the political map readable. Ours hides the map that is the point of the game.
- **Ghost counters:** translucent duplicate counters persist behind real ones when paused (`s4_07_crop_ghost_counters.png`,
  `s1_103_zoom_eu_scale8.png` near Finland and Latvia). This looks like the 2.2 split/merge animation stuck mid-fade.
- **Rebel nations have no flag**, only a flat coloured square (`s4_07_crop_ghost_counters.png`, brown square; `s1_4_after_eu.png`,
  dozens of blank squares over the former USSR).
- **Labels collide:** after 12 years, Eastern Europe is covered in overlapping labels and flags ("Free Moscow", "Free Vitebsk"…)
  that cannot be parsed (`s1_4_after_eu.png`). Map labels also show through the Ranking panel (`s1_01_1938_boot.png`, "Soviet Union").
- **Close zoom is empty:** from ~300 m/px down there is no terrain, relief, roads or towns, just flat nation colour
  (`s1_106_zoom_eu_scale64.png`, `s1_2_china_scale128.png`). Occupied land becomes full-screen diagonal moiré stripes
  (`s3_paused_scale0256.png`).

**What AoC does better:** readable armies at world zoom, flags for every nation, and a cohesive pixel-art style.
**Fix:** aggregate or declutter counters by screen space at T0 (hide below a pixel budget, prioritise by strength); kill
paused ghosts; generate flags for spawned nations; add label collision culling; scale the hatch with zoom.

### 2. Diplomacy / war / alliance / puppet / revolt depth: 5/10
**Tested:** watched the 12-year run's banners, the history log over 16 months, and the God-forced war.
**Evidence:** `critic/s4.json` (`historyRows`), `critic/shots/s4_14_history.png`, `s1_3_run_y12.png`, `s2_10_ger_pol_war_t3.png`.

- The history log shows varied, plausible events: the USSR picks off the Baltics and makes them puppets, unions form,
  and Peru captures Bolivia's capital and puppets it (`critic/s4.json`).
- **Revolt spam:** in the 40-year headless run, the nation count goes 100 → 258 (`critic/headless_seed99_40y.json`).
  On screen this shows as wars like "Free Ormož +17 ⚔ Free Lika-Senj +4" (`s1_3_run_y12.png`). Village-named rebel states
  with 18-member coalitions are noise, not drama.
- **Armies evaporate:** in 65 days of the God-forced Germany–Poland war, Germany fell from 460 899 to 170 484 men and Poland from 371 570 to 22 648,
  while the front moved about one province (`critic/s2.json`, first and second runs; `s2_11_front_scale40.png`). Polish land
  behind the front is empty of units yet Germany doesn't advance into it.
- **What AoC does better:** wars visibly end with big land changes; the diplomacy icons on the nation panel (ally, puppet,
  war, casualties) give state at a glance (`reference/screens/steam-screenshot-00.jpg`).
- **Fix:** cap rebel spawns per region and decade, merge rebels into existing claimants, and name rebels after
  regions/provinces, not villages. Audit casualty rates against territory gain.

### 3. Emergent, watchable world dynamics: 2/10 (blocking)
**Tested:** 12 years in the browser (seed 7) and 40 years headless (seed 99).
**Evidence:** `critic/s1.json` (`years`), `critic/shots/s1_3_run_y2.png` … `s1_3_run_y12.png`, `critic/headless_seed99_40y.json`.

- **Browser seed 7:** the top 5 by land at year 2.4 are SOV/CAN/USA/DEN/AST. At year 12.1 they are SOV/CAN/USA/FRA/DEN, with
  Canada and the USA at exactly the same cell counts as at boot (77 522 and 45 755). Japan has fought China for 12 years,
  and China is still at 17 212 cells, its start value, with the north merely hatched as occupied (`s1_4_after_asia.png`).
- **Headless seed 99, 40 years:** the **top-10 land holders are identical from year 9 to year 40** (0 new entries in 31 years).
  The leader holds 26.9% at year 1 and 27.2% at year 40. Cells flipped per year fall from 13 568 (year 1) to 300–3 800 in the
  last 20 years (`critic/headless.log`).
- Watching `s1_3_run_y2` → `y12` side by side, the world map is close to identical except for Eastern Europe fragmenting.
  AoC's whole appeal ("nations expand and conquer each other", PARITY row 1) is empires rising and collapsing. Here nothing big ever falls.
- **Fix:** large nations need real vulnerability: overextension, stability and revolt pressure that splits *big* empires into
  meaningful pieces, AI focus on achievable conquests, and occupation that converts to ownership at peace. Make the sweep
  criteria include top-10 churn and leader-share variance on unseen seeds.

### 4. God Mode: 6/10
**Tested:** opened the God tab and used rename/war/peace controls, the revolt tool on Yugoslavia and kill (two-click confirm).
**Evidence:** `critic/shots/s2_08_god_panel.png`, `s2_09_god_war_declared.png`, `s4_06_god_revolt.png` (Yugoslavia ⚔ Free Moravica
appears), `s4_07_god_kill.png`, `critic/s2.json` (`godButtons`).

- Works and is broad. War declared through the UI took effect at once.
- The **Kill/Revive target is a separate dropdown pre-set to "Ethiopia"** while the panel shows Yugoslavia
  (`s4_07_god_kill.png`). It is unclear which nation dies, which invites mistakes.
- **What AoC does better:** God actions are one click on the map with clear icons. Ours is a form.
- **Fix:** make Kill/Revive act on the selected nation, or label the target explicitly.

### 5. Editor & scenarios: 4/10
**Evidence:** `critic/s5.json`, `critic/shots/s5_brush_click_then_drag.png`, `s4_01_editor_brush_france.png`, `s4_02_editor_bucket.png`,
`critic/critic.warsim-scenario`, `critic/s4.json` (`scenarioExport`).

- **The brush does not paint while dragging** (blocking for an editor). One click painted 49 cells (2626 → 2675, Undo 1). A 300 px drag
  with the button held painted **nothing** (still 2675, Undo 1) because the drag pans the camera (`critic/s5.json`;
  no pointermove handling in the editor; `src/app/input/CameraController.ts:57` owns pointermove).
- Bucket fill and scenario export (`Exported “critic”.`) work. The flag editor was not reached (the script stopped at the disabled Undo), so it is untested.
- **What AoC does better:** click-and-drag painting, the core gesture of any map editor.
- **Fix:** in editor brush/line mode, left-drag paints and pan moves to right or middle drag. Add an e2e test that *drags*.

### 6. Stats & history: 5/10
**Evidence:** `critic/shots/s4_12_charts.png`, `s4_14_history.png`, `s2_05_stats.png`, `critic/s4.json` (`historyCount`: 116 events in 16 months).
- History is useful, filterable and exportable.
- The charts default to the top 6 by land, which are **six flat horizontal lines** (`s4_12_charts.png`). That is a direct symptom of §3.
- The ranking list is static for decades (same top 15 in `s1_01_1938_boot.png` and `s1_3_run_y12.png`).
- **AoC better:** ranking with flags per row and more per-nation statistics in the nation panel (`steam-screenshot-00.jpg`).

### 7. UI/UX & polish: 3/10
**Evidence:** `critic/shots/s1_00_default_url.png`, `s2_02_nation_panel_overview.png`, `s1_3_run_y12.png`, `s3_paused_scale0016.png`.

- **The default URL (`/`) opens a two-colour toy test world** with fake nations and "300" counters (`s1_00_default_url.png`).
  There is no main menu, scenario picker or title screen. A new player has to know `?scenario=1938`.
- The panels are plain dark rectangles with system dropdowns. The nation panel has only Overview/Economy (+God/Actions)
  and few numbers (`s2_02_nation_panel_overview.png`). AoC has ornate framed panels, flag art, icons and stats tiles
  (`reference/screens/steam-screenshot-00.jpg`).
- War banners stack into 3 rows plus "+17" over the bottom of the map (`s1_3_run_y12.png`).
- Order arrows: dozens of dashed lines run across the whole screen from off-screen formations (`s3_paused_scale0016.png`,
  `s1_2_china_scale32.png`).
- **Fix:** a title/menu screen with scenario select and `/` defaulting to it; cap war banners (1 row + "+N"); show order arrows
  only for selected or nearby units; give the UI frames a visual identity pass.

### 8. Performance: 4/10
**Evidence:** `critic/s1.json` (`fpsWorld` 58.3, `fpsWorldRunningMax` 39.0, 12 years in 338 s wall), `critic/s3.json` (`fpsT2` 53.0),
`critic/headless.log` (40 years in 354 s, mean tick 0.6–2.4 ms, p95 up to 9 ms in year 1).
- On a high-end GPU at 1600×900 the world view falls to **39 fps at Max speed**. `reference/screens/steam-screenshot-03.jpg` shows
  AoC at **137 fps** (top-right counter) at 1080p.
- At Max speed a year takes ~28 s of wall time in the browser. Watching a 50-year arc takes ~25 minutes.
- The tick p95 of 5–9 ms in early years exceeds the 1.5 ms budget in PLAN 7.1.
- Confidence on the AoC comparison is medium: one screenshot, unknown hardware.

### 9. Stability: 6/10
**Evidence:** `errors: []` in `critic/s1.json`, `s2.json`, `s3.json`, `s4.json`; save → `?continue=1` reload works (`critic/shots/s2_21_continue.png`).
- No crashes or console errors across ~1 hour of driving.
- **Render artefact:** at max zoom (scale 2048, 9.6 m/px), a large blurred black rectangle appears on the left
  (`critic/shots/s3_paused_scale2048.png`).
- Ghost counters (§1) and the brush no-op (§5) are functional bugs.

### 10. Differentiator: semantic zoom to unit level: 3/10 (needs 8)
**Evidence:** `critic/shots/s3_paused_scale0016.png` (T1), `s3_paused_scale0064.png`, `s3_paused_scale0256.png` (T2),
`s3_paused_scale1024.png` (T3), `s3_live_scale256_0..3.png`, `s3_paused_scale2048.png`, `s3_wheelout_*.png`.
- T1 operational markers (NATO symbol, flag, strength) are clear and consistent: decent.
- **T2 is a few 10×10 grids of white dots** on a moiré-hatched field (`s3_paused_scale0256.png`). They don't read as soldiers.
- **T3 is tiny identical round icons in perfect parade squares** (`s3_paused_scale1024.png`). There is no terrain, no
  trees or buildings, no fire, tracers or casualties, and no visible movement across 4 live frames at speed 1 (`s3_live_scale256_0..3.png`).
  The "closest enemy pair" was 1.4 cells apart, yet nothing in the frame says "battle".
- Zoom is continuous (wheel strip `s3_wheelout_*.png`), but zooming in reveals **less** information, not more. That is the opposite of the pitch.
- **Fix:** PLAN 2.4–2.9 (fire visuals, T3, detail tiles, hillshade) are prerequisites. Until they land, this differentiator scores ≤ 3.

### 11–14. Differentiators: naval / tanks / aircraft / AI nukes: 0/10 each
- No ships, sea zones, ports, planes, airbases or nukes anywhere in any session. The sea is empty at every tier (`s1_01_1938_boot.png`, `s1_105_zoom_eu_scale32.png`).
- Tanks: the production list offers Armoured division, Tank brigade, Tank corps and Light mechanised, **all disabled** (`critic/shots/s4_12_charts.png`, left panel).
  A player sees tanks advertised and cannot build them.
- PLAN Phases 3–6 are unchecked, so this is expected, but it is the product's stated reason to exist.

---

## BLOCKING issues (prioritised)

1. **B1: The world is static over decades.** Top-10 is unchanged years 9–40 (seed 99), the leader share is fixed at 27.2%, and China survives
   a 12-year Japanese war at its start size. Evidence: `critic/headless_seed99_40y.json`, `critic/s1.json`, `critic/shots/s1_3_run_y12.png`, `s1_4_after_asia.png`.
2. **B2: Semantic zoom shows nothing at close range.** T2/T3 are dot and icon grids on flat colour, with no terrain, combat or motion.
   It contradicts the "zoom to unit level" pitch. Evidence: `critic/shots/s3_paused_scale0256.png`, `s3_paused_scale1024.png`, `s3_live_scale256_3.png`.
3. **B3: The differentiators don't exist.** Naval, aircraft and nukes are absent, and tanks are listed but unbuildable. Evidence: `critic/shots/s4_12_charts.png`, all `s1_*` sea areas.
4. **B4: Revolt fragmentation spam.** Nations go 100 → 258, with flagless "Free <village>" states and 18-nation rebel coalitions burying Europe.
   Evidence: `critic/headless_seed99_40y.json`, `critic/shots/s1_4_after_eu.png`, `s1_3_run_y12.png`.
5. **B5: No game entry point.** `/` opens a toy test world and there is no menu or scenario select. Evidence: `critic/shots/s1_00_default_url.png`.
6. **B6: The editor brush doesn't paint on drag.** A drag pans the camera. Evidence: `critic/s5.json`, `critic/shots/s5_brush_click_then_drag.png`.
7. **B7: Europe is unreadable at world zoom.** Counters overlap and ghost duplicates appear. Evidence: `critic/shots/s1_01_crop_europe_counters.png`, `s4_07_crop_ghost_counters.png`.

## Non-blocking issues

- N1: Armies lose 60–95% of their men in ~65 days of war with little territorial result (`critic/s2.json`).
- N2: 39 fps at Max speed at T0 on an RTX 4070 Ti; ~28 s per simulated year (`critic/s1.json`).
- N3: A large black blurred rectangle at max zoom (`critic/shots/s3_paused_scale2048.png`).
- N4: Order arrows from off-screen units clutter the map (`critic/shots/s3_paused_scale0016.png`, `s1_2_china_scale32.png`).
- N5: War banners stack 3 rows deep over the map (`critic/shots/s1_3_run_y12.png`).
- N6: Map labels show through the Ranking panel (`critic/shots/s1_01_1938_boot.png`).
- N7: The God Kill/Revive target dropdown is decoupled from the selected nation, defaulting to "Ethiopia" (`critic/shots/s4_07_god_kill.png`).
- N8: The default charts are flat lines (`critic/shots/s4_12_charts.png`).
- N9: Occupation hatching becomes full-screen moiré at T2/T3 (`critic/shots/s3_paused_scale0256.png`).
- N10: The UI lacks a visual identity: system dropdowns and plain panels (`critic/shots/s2_02_nation_panel_overview.png`).

## Real strengths (brief)

- T0 political map rendering: crisp smooth borders and curved labels that scale with nation size (`critic/shots/s1_103_zoom_eu_scale8.png`).
- Robustness: zero console errors and no crashes in five scripted sessions plus a 40-year headless run, and save/continue works (`critic/shots/s2_21_continue.png`).

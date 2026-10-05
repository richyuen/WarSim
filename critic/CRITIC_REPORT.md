# Critic report: WarSim @ 3d6a2b2 (Phase 2 review ticked; Phases 3–7 open)

Date: 2026-10-05. Commit `3d6a2b22a1a66a35920582b6b8f95f20bec2b8c1`. Machine: RTX 4070 Ti through ANGLE/D3D11
(`critic/c2_a.json` → `gpu`), 24 logical cores. Production build (`vite build` into a scratch folder, `vite preview` on
port 5299), driven by Playwright from `critic/scripts/c2_*`. All files of this run are named `c2…`; the `s1…s5` files in
`critic/` belong to the previous report and are not cited here.

Verdict in one paragraph: the world map is now a decent thing to look at and the shell does not crash, but the game is
still clearly worse than Ages of Conflict as something to watch, and three of its five reasons to exist are not in it.
Nothing scores 7. The new close-zoom tiers render, but they show a parade-ground diagram, not a battle. And one thing
the documents state as fact is false on a seed nobody tuned for: a loaded game does not go on as the game that was
saved, in the browser and in the project's own headless tool.

## How this was tested

| Session | Script | What it did | Output |
|---|---|---|---|
| A | `c2_a_entry_longrun.mjs` | `/` → title screen → 1938 with seed 2718 through the form; 14.2 years at Max through the real speed button and Space; shots every 2 years; the world afterwards by continent; ranking, charts, history, nation panel; autosave → Main menu → Continue. | `critic/c2_a.json`, `shots/c2a_*` |
| B | `c2_b_battle_zoom.mjs` | God Mode UI: Germany declares war on Poland; 60 days; a 15-stop zoom ladder 12 km/px → 1 m/px; live frames at T1/T2/T3 with pixel diffs; real mouse wheel in to the limit and out; pans; the ground at 10 places. | `critic/c2_b.json`, `shots/c2b_*` |
| C | `c2_c_god_editor_player.mjs` | Every map mode; F-keys, camera keys, Escape; every God control on France; revolt, breakthrough and territory tools; Kill and Revive; editor brush/line/bucket/undo/terrain/city/gold/flag editor; scenario export → start from the file on the title screen; a broken file; player control of Poland; settings; three window sizes. | `critic/c2_c.json`, `shots/c2c_*` |
| D | `c2_d_determinism.mjs` | Seed 31337: worker vs Node at year 1, save/load, a year in real time at Max with the camera moving, Continue, two tabs. | `critic/c2_d.json` |
| E | `c2_e_t3_tanks.mjs` | A panzer division at rest from 1200 to 1.5 m/px; a division that is firing, paused and live at seven zooms; a division on the march. | `critic/c2_e.json`, `shots/c2e_*` |
| F, H, I | `c2_f_continue_hash.mjs`, `c2_h_save_perturbs.mjs`, `c2_i_bisect_node.ts`, `c2_i_bisect_page.mjs` | Seed 2718: Continue at years 1–14; whether a save moves the page; day-by-day hashes of year 9 in Node and in the page; monthly save → load → 30 days in Node. | `critic/c2_f.json`, `c2_h.json`, `c2_i_node.json`, `c2_i_page.json` |
| G | `c2_g_misc.mjs` | Germany builds an armoured division; counters while running; clicks on units, cities, sea, banners; the date line; a stress minute; a game loaded at year 10 against the unsaved one for two years. | `critic/c2_g.json`, `shots/c2g_*` |
| J, K | `c2_j_tank_battle.mjs`, `c2_k_sov_armour.mjs`, `c2_k2_sov_armour_why.mjs` | An armour formation in contact at T1–T3; every word on screen searched for naval, air and nuclear; a British division ordered to Calais; what happens to the armour in the first hour. | `critic/c2_j.json`, `c2_k.json`, `c2_k2.json`, `shots/c2j_*` |
| P | `c2_p_perf.mjs` | Alone on the machine, 1920×1080, vsync and frame limit off: frame times with the camera moving at eight zooms, paused, at ×5 and at Max, at the start and after 10 years; zoom sweeps; sim throughput. | `critic/c2_p.json` |
| headless | `npm run sim` (seed 31337, 40 years; seed 2718, 10 and 11 years, `--save`/`--load`) | Long run on an unseen seed; the project's own checkpoint claim. | `critic/c2_headless_seed31337_40y.json`, `c2_headless.log`, `c2_saveload_node.log` |

Reference used: `reference/screens/steam-screenshot-00.jpg` and `-03.jpg` (AoC nation panel, economy panel, war list,
statistics, 137 fps), `reference/frames/scene_013.png` (AoC world, 144 fps), `scene_016.png` (AoC God Mode panel), and
`reference/text/AOC_TEXT_NOTES.md`. `reference/NOTES.md` does not exist, so there is no written statement of the user's
taste; where a judgement rests on AoC text alone it says so.

Could not be triggered because they do not exist: naval battles, air battles, AI nukes. The attempts are in §11–14.

## Status of the previous report's blocking issues

| Old id | Then | Now, as seen in this run |
|---|---|---|
| B1 static world | top ten frozen for 31 years | Partly. Europe moves; the majors and every other continent still do not (R2-B5). |
| B2 empty close zoom | flat colour, no fire | Partly. Ground, fire and figures draw; what they show is not a battle (R2-B2). |
| B3 differentiators absent | naval, air, nukes 0; tanks unbuildable | Open. Tanks can be built; the scenario deletes most of them in the first hour (R2-B1, R2-B3). |
| B4 revolt spam | 100 → 258 nations | Reduced in a plain run (101 → 136 in 40 years), not in God Kill or in the names (R2-B6). |
| B5 no entry point | toy world at `/` | Fixed. `shots/c2a_00_title.png`, `c2a_01_title_1938_chosen.png`. |
| B6 brush does not paint on drag | 0 cells | Fixed. One drag painted 968 cells as one undo step (`c2_c.json` → `editor.brushDragCells`). |
| B7 Europe unreadable | counter wall, ghosts | Fixed at rest. `shots/c2a_03_boot_europe_4000m.png`, `c2g_22_paused_europe.png`. |

## Scores

| Dimension | Score | One-line reason |
|---|---|---|
| Map visuals and readability | 6 | T0 at the start is clean and sharp; after ten years it is a patchwork of hatching, blank rebel flags and enclaves, and T1 in a war is a web of arrows. |
| Diplomacy / war / alliance / puppet / revolt depth | 5 | Sixteen kinds of event fire, but coalitions are absurd, occupation never resolves, armies evaporate and seven alliances are all called "Defensive Pact". |
| Emergent, watchable dynamics | 4 | Europe changes in 14 years; the top five by land are the same five for 33 years on the unseen seed, and Britain sits on 3.4 M idle men. |
| God Mode | 5 | Most controls act at once; three of them fail or do the wrong thing without a word, Kill makes 36 nations and 40 wars, and AoC's world settings are missing. |
| Editor and scenarios | 5 | Painting, undo, cities, flags and the export → title round trip work. There is one scenario, one map and no random world. |
| Stats and history | 5 | Ranking, five charts and a filterable, exportable log exist; the log is a third "broke away", alliances appear as "#24", rows have no flags. |
| UI/UX and polish | 4 | A real title screen now. No tooltips, no unit or city info, Escape and mode keys do nothing, the bottom bar leaves the screen at 1024 px, no sound. |
| Performance | 6 | 116–900 fps unthrottled on a 4070 Ti, but a 2.9 s freeze in a zoom sweep, stutter at Max, and a year takes 10–12 s at the fastest speed. |
| Stability | 5 | No crash and no console error in 11 sessions. A loaded game plays out differently from the saved one, the worker's state hash leaves Node's, and a fifth of the units vanish at tick 1. |
| **Differentiator:** semantic zoom to unit level | 5 (needs 8) | Continuous from 24.7 km/px to 1 m/px with fire at T2/T3, but the close tiers are grey grids on tinted noise with no opponent in view and no way to ask what a unit is. |
| **Differentiator:** naval warfare | 0 | Nothing. A British division ordered to Calais walks to Kent and stops. |
| **Differentiator:** tanks | 2 | Tank elements exist, fight by armour and piercing and can be built, but 39 of 72 armour formations are deleted in the first tick and a "tank battle" is a parked grid. |
| **Differentiator:** aircraft | 0 | Nothing. |
| **Differentiator:** AI nuclear use | 0 | Nothing. |

No score is above 7, so no claim of parity or superiority has to be defended.

---

## Per-dimension detail

### 1. Map visuals and readability: 6/10

**Tested.** T0 at boot and after 14 years, world and six regions; all eight map modes; T1 on a front; the counters while
the game runs at ×7 and at Max and after a pause.

**Evidence.** `shots/c2a_02_boot_world.png`, `c2a_03_boot_europe_4000m.png`, `c2a_20_after_world.png`,
`c2a_21_after_europe_4000m.png`, `c2x_crop_rebel_flags_1952.png`, `c2a_21_after_namerica_6000m.png`,
`c2b_10_ladder_01500m.png`, `c2x_crop_t1_arrows_1500m.png`, `c2x_crop_t1_markers_warsaw.png`, `c2c_00_mode_*.png`,
`c2g_21_running_max_europe_1.png`, `c2g_22_paused_europe.png`.

- At the 1938 start Europe is readable: smooth borders and coast, curved names, counters that do not overlap, city
  names clear of them (`c2a_03_boot_europe_4000m.png`). This is the one place where the game looks better than AoC's
  blocky tiles (`reference/screens/steam-screenshot-00.jpg`). Small nations pay for it: the counters stand on the
  letters of "Germany", "Czechoslovakia", "Lithuania" and "Estonia" in the same picture.
- Fourteen years later the same view is a mess (`c2a_21_after_europe_4000m.png`): hatched occupied land over half of
  central Europe that never becomes anyone's, green Italian blobs scattered through France, and rebel states whose
  flag is a **blank coloured square** on the capital and on every counter (`c2x_crop_rebel_flags_1952.png`: "Free
  Manche"; the same crop shows a black smear under a counter by Bern). North America is diagonal bands of hatching
  along the routes American divisions walked (`c2a_21_after_namerica_6000m.png`).
- T1 during a war is unreadable: dozens of dashed order arrows cross the whole view from formations that are not in
  it (`c2b_10_ladder_01500m.png`, crop `c2x_crop_t1_arrows_1500m.png`).
- T1 markers still stand on each other at the start, at rest and paused: around Warsaw at 1200 m/px several boxes are
  half under their neighbours and one is under the capital's flag (`c2x_crop_t1_markers_warsaw.png`). PLAN 2.7s says
  they do not.
- Map names and counters show through the Ranking panel ("Moscow" in `c2a_03_boot_europe_4000m.png`).
- The wars mode paints every belligerent one red (`c2c_00_mode_4_wars.png`); AoC gives each war a colour (text).

**AoC does better.** Every nation has a flag, including new ones; occupation is integrated or reclaimed, so the map
stays clean; one cohesive pixel-art look with a frame (`reference/frames/scene_013.png`).
**Fix.** Flags for spawned nations. Resolve occupation at peace. Order arrows only for selected formations or the
nation under the cursor. Finish the T1 declutter for the same-nation case at a capital. Make the ranking panel opaque.

### 2. Diplomacy / war / alliance / puppet / revolt depth: 5/10

**Tested.** The history of 14.2 years (1,226 events), the banners and panels in every session, a God-declared war
followed for 60 days.

**Evidence.** `critic/c2_a.json` (`historyByKind`, `historyRows`, `alliancesAfter`, `warsAfter`),
`shots/c2a_32_history.png`, `critic/c2_b.json` (`before`, `warCourse`, `after`), `shots/c2g_31_click_marker.png`,
`shots/c2b_40_ground_china_occupied_0250m.png` (banner row), `shots/c2c_17_after_kill_3000m.png`.

- The breadth is real: in one run 244 wars declared, 225 peaces, 98 capitals captured, 31 nations destroyed, 61
  alliance joinings, 13 leavings, 12 unions, 25 puppets made, 10 released, 10 integrated, 39 major battles, 11
  annexations, 1 revival, and 396 revolts.
- **Coalitions are nonsense.** Ten weeks into a game "United Kingdom +33 ⚔ Angola" is on screen (seed 4242,
  15 March 1938, banner row in `c2b_40_ground_china_occupied_0250m.png`). Five months into another, Poland's only
  enemy is Xinjiang (`c2g_31_click_marker.png`). A God-declared Germany–Poland war became "Germany +5 ⚔ Poland +9" and
  the war count went from 3 to 9 in 60 days (`c2_b.json`).
- **Armies evaporate for almost nothing.** In those 60 days Germany (by then at war with ten nations) went from
  564,100 men to 222,285 (−61%) and Poland from 419,020 to 53,815 (−87%), 44 formations to 12
  (`c2_b.json` → `after`). On the map Germany holds a hatched strip along the border, and Poland holds a piece of
  Silesia (`shots/c2b_02_war_day60_2500m.png`). The previous report's N1, unchanged.
- **Occupation never resolves.** Wars end (225 peaces) and the hatching stays for years (`c2a_21_after_europe_4000m.png`).
- **Names.** Of 14 alliances after the run, seven are "alliance.defensive" (shown as "Defensive Pact"); the history
  calls a dissolved one "#24" ("Netherlands left #24", "#24 dissolved", `c2a_32_history.png`). Revolts that hand land
  back to a living nation read "France broke away from Italy", "Mexico broke away from United States".
- Not in the game at all (searched in the panels and God tab): donations to allies, core purchases, integration of
  occupied land for gold, per-city revolt progress.

**AoC does better.** A war has two sides you can read in a war list with flags (`steam-screenshot-00.jpg`, bottom
right); generated alliance names (text); occupation that the occupier integrates for gold (text and the "Integrate
Occupations" button in the same screenshot).
**Fix.** Cap who joins a war by adjacency or reach. Give alliances distinct generated names and use them in the log.
Turn occupation into ownership or hand it back at peace. Bring losses and ground gained into proportion.

### 3. Emergent, watchable world dynamics: 4/10

**Tested.** 14.2 years in the browser (seed 2718), 40 years headless (seed 31337). Neither seed appears in the
repository's sweeps or pins.

**Evidence.** `critic/c2_a.json` (`years`), `shots/c2a_10_run_y*.png`, `c2a_20_after_world.png`,
`c2a_31_charts_default.png`, `c2a_31_charts_men.png`, `critic/c2_headless_seed31337_40y.json`, `c2_headless.log`.

- **Browser, 14 years.** Europe changes and it shows (Germany over Poland and northern France). Outside Europe almost
  nothing does. Brazil is at 6.38–6.39% and Australia at 6.11% of the world's land in every yearly sample. The leader's
  share stays between 15.9% and 16.8%. The top ten gained one new member, the United Kingdom, by integrating its own
  colonies (ten "Puppet integrated" events in the log). France's jump from under 2.6% to 8.7% in year 8 looks like the same
  thing: one vertical step on the land chart, and French West Africa leaves the list in that year
  (`c2a_31_charts_default.png`).
- **Headless, 40 years.** The top five by cells are the Soviet Union, Canada, the United States, Denmark (Greenland)
  and France in every year from 8 to 40. Australia holds exactly 25,987 cells from year 5 to year 40, Denmark 35,641
  from year 18, the United States 52,691 from year 24, Canada 67,415 from year 31. The Soviet share is 26.5–28.3% for
  33 years; only in the last seven does anything large happen (it falls from 26.6% to 17.8%). A viewer has to sit
  through 33 years for it, which is six minutes at the fastest speed.
- **Armies grow and stand still.** Total men go from 4.76 M to 9.74 M. The United Kingdom ends with 3,390,436 men in
  317 formations and has held 16,982–17,044 cells for twenty years: it cannot leave its island (§11).
- Nations: 101 → 136 living, 180 ever created. Better than the 258 of the last report; still a slow slide into
  statelets, never a consolidation.
- **Pace.** The fastest speed is 33–37 days per second (`c2_p.json` → `throughputStart`, `throughputLate`): 10–12 s
  a year. AoC's text gives one month per 0.5 s at 1× and a 5× top speed, so AoC's *normal* speed is about twice
  WarSim's maximum (text only; medium confidence). "Watch empires rise and fall" needs either more happening per year
  or far more years per minute. WarSim has neither.

**AoC does better.** Nations conquer each other outright; the developer's pitch is a world that "can continue to
change for thousands of years" (text). `reference/screens/steam-screenshot-03.jpg` is a 2025 start in the year 2096:
"Mali States" covers West Africa and a "Saudi Arabia Republic" reaches into Egypt and Sudan. Nothing of that kind
happened outside Europe in 40 WarSim years.
**Fix.** Sea transport, so that maritime powers can fight (Phase 4 is the blocker for this dimension too). Wars that
end in annexation. A faster top speed that skips element-level work when nothing is watched. Sweep criteria that
fail a run whose top five are the same for 20 years.

### 4. God Mode: 5/10

**Tested.** Through the UI on France: rename, income bonus, nation AI, buff, puppet, ally, war, peace; the revolt,
breakthrough and territory tools; Kill; Revive.

**Evidence.** `critic/c2_c.json` (`god`), `shots/c2c_10_god_tab_france.png` … `c2c_19b_god_revive.png`,
`c2x_crop_dead_gaul_still_on_map.png`, `c2x_crop_kill_war_banners.png`.

- Works at once: rename (map label and panel follow), bonus, AI off, buff, Make puppet (Belgium), Declare war, Peace,
  Revolt ("Free Gers"), Breakthrough (a corridor is made).
- **Ally does nothing and says nothing** when the target is in another alliance: France (Anglo-French) + Italy
  (Anti-Comintern), click, both unchanged, no message (`god.allyItaly`).
- **The Territory brush does not give the nation territory.** A 250 px drag from France across the Alps left a hatched
  band; the nation's cell count rose by 0 (`god.brushCellsGained`, `c2c_14_god_brush_drag.png`). The hint says "paint
  territory for this nation". The editor's brush, by contrast, changes the count.
- **A killed nation stays on the map.** After Kill, France (renamed "Gaul") is dead (`god.franceLivingAfterKill:
  false`) and its name still stands on that band 30 days later, with Italian counters on it
  (`c2x_crop_dead_gaul_still_on_map.png`).
- **Kill is a fragmentation bomb.** One click: 103 → 139 living nations, among them "Free Clipperton Island", "Free
  Kerguelen Islands", "Free Saint Barthélemy" and one the game could not name, "Free state 128" (`god.newNationNames`,
  `god.reviveOptions`). At once the banner area is three rows deep plus "+32", row after row of "United Kingdom
  +20 ⚔ Free …" (`c2x_crop_kill_war_banners.png`); a month later there are 43 wars.
- **Revive did nothing** 30 days after the Kill, with no message (`god.revived: 0`). If a cooldown forbids it, the UI
  does not say so and still offers the button.
- Missing against AoC's panel (`reference/frames/scene_016.png`, text §6): the World AI settings (one global AI
  checkbox stands for about fifteen toggles), spawn nation with a size, spawn or remove cities in game, edit gold, CE,
  colour, unity, loyalty, autonomy from the God tab, donate, and the nuke.

**Fix.** Every command that is refused says why. The brush paints owner and controller as the editor's does. A dead
nation holds and labels nothing. Kill hands land to neighbours and claimants before it founds anything.

### 5. Editor and scenarios: 5/10

**Tested.** Brush drag, line, bucket, undo/redo by button and Ctrl+Z/Y, terrain layer, place city, set gold, flag
editor, export, start from the exported file on the title screen, a file that is not a scenario.

**Evidence.** `critic/c2_c.json` (`editor`), `shots/c2c_20_editor_open.png` … `c2c_32_title_broken_file.png`,
`critic/c2_critic2.warsim-scenario`, `shots/c2a_00_title.png`.

- Works: a drag paints 968 cells as one undo step; line 1,427; bucket 7,253; undo and redo return the exact counts;
  a city is placed; gold is set; the exported file starts a game from the title screen with the painted stripe in it
  (`c2c_31_loaded_scenario_sahara.png`); a bad file gives "Could not load: not a WarSim scenario file".
- **One scenario.** The title screen lists "World, 1938" and nothing else (`c2a_00_title.png`, `c2_a.json` →
  `title.scenarios`). No other year, no other map, no random world with a nation count. AoC ships world scenarios for
  1914, 1938, 1956 and today, regional maps, and a random simulation mode that is its default way to play (text; the
  scenario screen is in `reference/frames/scene_006.png`).
- **Terrain is painted blind.** Choosing the terrain layer leaves the map in the political mode
  (`editor.modeAfterTerrainLayer`); the stroke changed 508 cells and nothing on screen
  (`c2c_24_editor_terrain_brush.png`). AoC switches to the terrain view (text).
- The flag editor has a pencil, a bucket and a picker, eleven presets, no undo, no line or circle
  (`c2c_28_flag_editor_drawn.png`). AoC has all three and a 20-step undo (text).
- The panel is a column of native selects with a hundred nations each, no search, no picking a nation from the map.
- Not tested: image import.

**Fix.** More scenarios and a random-world start before more editor features. Auto-switch to terrain view. Undo in
the flag editor.

### 6. Stats and history: 5/10

**Evidence.** `shots/c2a_30_ranking_*.png`, `c2a_31_charts_*.png`, `c2a_32_history.png`, `c2a_33_panel_*.png`,
`critic/c2_a.json` (`rankMetrics`, `chartMetrics`, `historyByKind`, `panelText`).

- Ranking: five metrics, fifteen rows, a colour square per row. AoC: nine lists, a flag per row, dead nations marked
  (`steam-screenshot-03.jpg`, text).
- Charts: five series as bare lines, one number on the y axis, no grid, no value under the cursor
  (`c2a_31_charts_men.png`).
- History: 1,226 events in 14 years, 16 type filters, nation and year filters, CSV and JSON export. 396 of them (32%)
  are revolts, so the unfiltered log is mostly "X broke away from Y" (`c2a_32_history.png`). No text search, no
  grouping by year, alliances shown as "#24".
- Nation panel: land, share, army, CE, alliance, puppets, enemies; economy is six numbers
  (`c2a_33_panel_tab-economy.png`). No age, no wars fought, no kills, no previous lives, no list of income lines.
  AoC's panel has all of these (`steam-screenshot-00.jpg`).

**Fix.** Flags in rows, more metrics (age, wars, kills, cities), chart axes and hover, alliance names in the log, a
default history filter that hides returns of land.

### 7. UI/UX and polish: 4/10

**Evidence.** `shots/c2a_00_title.png`, `c2c_57_viewport_1024x600.png`, `c2c_57_viewport_phone_390x844.png`,
`c2g_30_hover_marker.png`, `c2g_31_click_marker.png`, `c2g_32_click_berlin.png`, `critic/c2_c.json` (`fkeys`, `keys`,
`escClosesNationPanel`, `dblclickZoom`), `critic/c2_g.json` (`observer`).

- The title screen is real and clear, with a map of the scenario, and the game starts from it in 1.5 s. It is also
  plain: one card, a form of selects.
- **Nothing on the map explains itself.** No tooltip anywhere (`observer.tooltipOnHover: []`). Clicking a division
  opens its nation's panel; there is no unit panel, so a player can never read a formation's name, type or
  composition. Clicking a city opens the nation's panel; there is no city view. A right click does nothing.
- **Keys.** Escape closes neither the nation panel nor the history. F1–F6 and the number keys do not change the map
  mode; the only way is one button that cycles through eight modes. A double click does not zoom.
- **Small windows.** At 1024×600, while playing a nation, the bottom bar runs off both edges: the pause button is not
  on screen and the date is cut (`c2c_57_viewport_1024x600.png`). At phone width the ranking lies on top of the nation panel
  (`c2c_57_viewport_phone_390x844.png`). AoC runs on phones and on the Steam Deck (text).
- War banners still stack three rows deep over the bottom of the map (every screenshot of a running game).
- No sound of any kind. One language. AoC has music, a war trumpet and 15 languages (text).
- The panels are dark rectangles with system controls; next to AoC's framed, iconed panels
  (`steam-screenshot-00.jpg`) it reads as a developer tool.

**Fix.** Tooltips and a formation panel first: the zoom tiers are pointless without them. Escape, mode hotkeys, a
mode menu. A bottom bar that wraps. One row of banners.

### 8. Performance: 6/10

**Evidence.** `critic/c2_p.json`, `c2_p.log`, `critic/c2_a.json` (`fpsRunningMaxEarly`, `fpsRunningMaxLate`, `years`),
`critic/c2_g.json` (`stress`), `critic/c2_headless.log`.

- With vsync on, every session held 60 fps, also at Max speed and after 14 years (`c2_a.json`). The previous
  report's 39 fps at Max is gone.
- Unthrottled at 1920×1080: T0 116–144 fps (a frame of 7–8.5 ms, a draw of 4.4–5.7 ms), T1 165–545 fps when the
  game is not at Max speed (see the hitches below), T2 and T3 560–920 fps. AoC's own screenshots show 137 and 144 fps at 1080p on unknown hardware
  (`steam-screenshot-03.jpg`, `scene_013.png`). On this GPU that is parity at T0, no more. T0 is the heaviest view and
  the one a player sits in; a 5 ms draw on a 4070 Ti is not a small number for a flat map. AoC's minimum is a GTX 560
  (text). I could not test a weak GPU; treat low-end performance as unknown, not as fine.
- **Hitches.** One continuous zoom from the world to 1 m/px froze for **2,878 ms** (`zoomSweepIn.worstMs`). At Max
  speed with the camera at 400 m/px the frame gap had a p95 of 113 ms and a worst of 452 ms, 14 frames over 100 ms in
  four seconds (`runs` → "start, Max running" / "T1 400 m/px"). At ×5 the close tiers drop a frame of 124–146 ms every
  few seconds. The stress minute had three gaps over 100 ms.
- **Sim speed.** 885 ticks/s at the start, 794 after ten years: 10–12 s per year. See §3 for why that matters more
  here than the frame rate.
- Headless: mean tick 1.14 ms over 40 years, p95 up to 8.6 ms. The project's own budget is a 1.5 ms mean; the
  spikes are what the page feels at Max.

**Fix.** Find the 2.9 s stall on zoom-in (it is after every tier has been visited, so it is not a first-use compile).
Decouple snapshot work from the frame at Max.

### 9. Stability: 5/10

**Evidence.** `errors: []` in every `critic/c2_*.json`; `critic/c2_g.json` (`stress`); `critic/c2_d.json`;
`critic/c2_f.json`, `c2_h.json`, `c2_i_node.json`, `c2_i_node.log`, `c2_i_page.json`, `c2_saveload_node.log`,
`critic/c2_g.json` (`loadDivergence`), `critic/c2_k2.json`.

- No crash, no page error and no console error in eleven scripted sessions, including a minute of random camera
  jumps, speed changes, mode changes, panel toggles and window resizes at Max speed.
- On seed 31337 everything the documents claim holds for the first year: the worker equals Node, save → load keeps the
  hash, a year played in real time with the camera moving equals a year stepped, Continue equals the save
  (`c2_d.json`). The same checks on the pinned seed are in the repository's tests. On another seed, later, they fail:
- **A loaded game does not go on as the game that was saved.** PLAN 2.11j says it does; the header of
  `tools/headless/cli.ts` says "years 11–20 from a year-10 checkpoint equal years 11–20 of a 20-year run".
  - Node, the project's own tool, seed 2718: `npm run sim -- --years 10 --save`, then `--load … --years 1`, ends
    year 11 at hash `931f19ad` with 694 formations, 5,865,965 men and 110 living nations. Eleven years straight end
    at `33ca7b81` with 695 formations, 5,872,955 men, 109 living nations, one more war declared and one annexation
    the loaded run never has (`c2_saveload_node.log`, `c2_seed2718_11y.json`, `c2_seed2718_loaded_plus1.json`).
  - Browser, same seed: Continue reproduces the save at years 1 to 8. At years 10, 12 and 14 the loaded world has
    another state hash from its first moment and another again 30 days on (`c2_f.json`). Played side by side for two
    years, the loaded game has 5,865,965 men after one year against 5,872,955 (Node's two figures exactly) and 105
    living nations after two against 106 (`c2_g.json` → `loadDivergence`).
  - Checked monthly through year 9 in Node, every save loaded with the same hash, and one of eleven (day 150) had a
    different hash 30 days later (`c2_i_node.log`). That script loads every save into one second sim that it reuses,
    so by day 150 that sim had been loaded and stepped five times: the row shows that a `load` leaves something of
    the old game in place, not what a fresh sim does. The fresh-sim cases are the two above. In all of them
    something that steers the sim is in neither the save nor the hash, and it bites rarely. That is why seed 99 at
    year 1 passes.
- **The worker's state hash leaves Node's.** Seed 2718, no saves involved: equal through tick 70,128, different from
  tick 70,152 (2 January 1946, the first step after nation 128 is created) and never equal again
  (`c2_i_node.json`, `c2_i_page.json`, `c2_h.json`). Formation count, total strength and nation count stay identical
  on every one of the following 363 days, and the men are equal at year 10, so I saw no difference in the world, only
  in the hash. It still breaks the invariant the project states (Node == worker), and whatever differs is state.
- **228 of 1,054 formations are disbanded in the first tick of every 1938 game** (seeds 1212 and 4242; `c2_k.json`,
  `c2_k2.json`), with no event: the world a player inspects while the new game is paused is not the one that plays.
  The economic AI disbands idle formations while a budget is short (`src/sim/ai/economic.ts`, header), and the 1938
  budgets are short from the first hour (Soviet Union: income 1,156, expenses 1,210).
- Visual bugs listed in §1 and §4 (dead nation on the map, blank flags, black smear).
- Low severity: the worker accepted seven commands of made-up kinds and the state hash changed
  (`c2_j.json` → `unknownCommandsChangedTheWorld`). Only the test API can send them.

**Fix.** Make the checkpoint test a sweep over unseen seeds and late years, not seed 99 at year 1: save at every
year-end of a 15-year run, load into a fresh sim, run a year, compare hash and outcome. Compare Node and a real
browser worker the same way. Then find what steers the sim and is not in `world.parts()`, and what is hashed and
differs between engines.

### 10. Differentiator: semantic zoom to unit level: 5/10 (needs 8)

There is nothing like this in AoC (its unit visuals are cosmetic sprites along fronts, text v4.5.0), so the measure is
the pitch: zoom from the world to the men, the same battle at every level, without a seam.

**Tested.** A 15-stop ladder on a front; a real mouse wheel from 24.7 km/px to the limit; live frames with pixel diffs
at 150, 50, 20, 10, 8, 3 m/px on a firing division and on a marching one; a panzer division at rest and in contact;
the ground at Berlin, Paris, the Alps, Finland, Norway's coast, the Sahara, occupied China, Dover, New York, mid-ocean.

**Evidence.** `critic/c2_b.json` (`ladder`, `wheelIn`, `minMpp`, `live*`), `critic/c2_e.json` (`liveFire`,
`liveMarch`, `fireLadder`, `wrecks`), `shots/c2b_10_ladder_*.png`, `c2e_live_fire_120m_l2_3.png`,
`c2x_crop_t2_both_sides_grey.png`, `c2e_live_fire_020m_l0_1.png`, `c2e_live_fire_008m_l0_2.png`,
`c2e_live_fire_003m_l0_3.png`, `c2x_crop_t3_figures.png`, `c2x_crop_t3_tank_1m.png`,
`c2x_crop_t3_tanks_in_contact.png`, `c2b_10_ladder_00040m.png`, `c2b_10_ladder_00020m.png`,
`c2b_40_ground_berlin_0020m.png`, `c2b_40_ground_alps_0100m.png`, `c2b_31_closest_zoom.png`,
`c2b_40_ground_dover_0150m.png`.

What is there, verified:
- One wheel goes from 24,738 m/px to 1.0 m/px in about twenty steps with no jump and no flash; the tier shares
  cross-fade (`wheelIn`, `shots/c2b_30_wheel_in_*.png`).
- At T2 a firing division shows tracers and flashes, and both sides are in the frame at 120 m/px
  (`c2e_live_fire_120m_l2_3.png`); 2,900–3,600 px change between frames 0.7 s apart at ×1. 28 wrecks were on screen.
  The figures of a marching division animate with no fire in view (2,400–2,900 px per 0.7 s at 20 m/px,
  `liveMarch`).
- At T3 a battalion is a block of figures whose number follows its strength (1,404 figures falling to 767 as the
  division fought, `liveFire`), and a tank element is ten tank icons (`c2x_crop_t3_tank_1m.png`).
- The ground has relief, grain, trees, rocks and buildings, and the coast is fine (`c2b_40_ground_dover_0150m.png`).

Why it is a 5 and not an 8:
- **You cannot tell who is who.** At T2 and T3 the marker boxes are gone and nothing replaces them: no flag, no
  number, no name. German and Polish elements are the same grey dots (`c2x_crop_t2_both_sides_grey.png`). Clicking one
  opens a nation panel. The closer you look, the less you can find out, which was the last report's complaint about
  this feature and still holds.
- **There is no battle at T3.** Enemy formations stand a cell or more apart, and a cell is 19.6 km: the closest pair
  I found after 60 days of war was 1.46 cells, 29 km, apart (`c2_b.json` → `pair`). At 20 m/px the view is 32 km by
  18 km, and centred between that pair it shows a border line and trees, no unit of either side
  (`c2b_10_ladder_00020m.png`); both are in one frame only at 40 m/px, in T2, as two specks
  (`c2b_10_ladder_00040m.png`). So the close view is one side's battalions standing in ruled rectangles, firing
  dashes off the screen in several directions (`c2e_live_fire_020m_l0_1.png`, `c2e_live_fire_008m_l0_2.png`). In
  every frame I took of a formation in contact the figures stand in their grid, all facing one way; nothing but the
  dashes tells a battalion under fire from one at rest (`c2x_crop_t3_figures.png`).
- **The ground is a nation-coloured carpet.** Berlin at 20 m/px is grey noise with red and white specks, no streets,
  no river, no blocks (`c2b_40_ground_berlin_0020m.png`). The Alps are salmon pink because they are Swiss
  (`c2b_40_ground_alps_0100m.png`). Chad at 1 m/px (15° E, 15° N) is sky blue with pebbles because it is French
  Equatorial Africa; by its colour it could be shallow sea (`c2b_31_closest_zoom.png`).
- **Almost everywhere there is nothing.** At T2 a division is a 30 px grid in a 1,600 px view; at T3 most views are
  empty ground (`ladder`: 0 elements at 10, 5, 2 and 1 m/px on the midpoint between the two closest enemies). There is
  no "go to this battle" from a banner, a marker or the history.
- **Stalls** on the way in (§8).

**Fix.** Flag, strength and name on the formation at T2 and T3, and a formation panel. Put the two sides of an
engagement within one T3 view (draw the engaged elements at the cell edge they fight across). Posture and facing for
figures in contact. Terrain colour from terrain at T2 and T3, with the nation as a border tint. A jump-to-battle from
the war banner.

### 11. Differentiator: naval warfare: 0/10

**Tested.** Searched every visible string in God Mode and in the player's Actions tab for fleet, ship, navy, naval,
convoy: none (`critic/c2_j.json` → `differentiators.wordsOnScreen`). All 15 buildable templates are land formations
(`differentiators.templates`). Took control of the United Kingdom and ordered the division nearest London to Calais:
30 days later it stood on the coast of Kent, 3.5 cells from Calais, not marching (`differentiators.after30days`,
`shots/c2j_22_uk_after_30_days.png`). The Channel at 300 m/px is empty water (`shots/c2j_23_channel_300m.png`). A
read-only search of `src/` finds no fleet, sea-zone or convoy module. PLAN 4.1–4.8 are unticked; here that claim is
true.

The absence costs more than one feature: Britain, Japan's home army, the United States against anything overseas and
every colony are out of every war for ever (§3).

### 12. Differentiator: tanks: 2/10

**Tested.** Counted armour formations at the start and hour by hour; looked at a panzer division from 1200 m/px to
1.5 m/px; built one as Germany; found an armour formation in contact and filmed it at T2 and T3.

**Evidence.** `critic/c2_e.json` (`formationsByTemplate`, `armourByNation`, `tankLadder`), `critic/c2_k.json`,
`critic/c2_k2.json`, `critic/c2_g.json` (`tankBuild`), `critic/c2_j.json` (`armourInContact`, `live`),
`shots/c2e_tank_0060m.png`, `c2e_tank_0010m.png`, `c2e_tank_0004m.png`, `c2x_crop_t3_tank_1m.png`,
`c2j_11_tank_paused_*.png`, `c2j_12_tank_live_025m_2.png`, `c2j_12_tank_live_006m_2.png`,
`c2x_crop_t3_tanks_in_contact.png`.

- Exists: light and medium tank elements with hard and soft attack, armour and piercing used by the combat code
  (read in `src/sim/systems/combat.ts`); 72 armour formations in the 1938 order of battle; an armour symbol at T1; a
  tank icon per vehicle at T3; Germany built an armoured division in 225 days (6 → 7 armour formations).
- **The scenario deletes most of them before the player can press anything twice.** At tick 0 there are 1,054
  formations, 72 of them armour, 34 of those Soviet. At tick 1 there are 826 formations and 33 armour formations, and
  the Soviet Union has **none**: its army falls by exactly the 74,400 men of its 30 tank brigades and 4 tank corps,
  its monthly expenses from 1,210 to 853. Poland's three tank brigades go the same way. No line in the history.
  The same on two seeds (`c2_k2.json` → `hours`, `c2_k.json`). The largest tank arm of 1938 does not survive the
  first hour of a game about that war. The cause is in the open: the economic AI disbands idle formations while its
  budget is short (`src/sim/ai/economic.ts`, header comment), and the Soviet budget is short at tick 0.
- What survives is not a tank arm to look at. At T2 a panzer division is a grey dot grid like any other
  (`c2e_tank_0060m.png`). At T3 it is rows of identical white boxes with a circle and a bar, all pointing east
  (`c2x_crop_t3_tank_1m.png`), the same white as Polish riflemen (`c2x_crop_t3_figures.png`). In contact
  (`c2x_crop_t3_tanks_in_contact.png`, from `c2j_12_tank_live_006m_2.png`) the tanks stand in their grid, with other
  formations' figures drawn through them, while a few dashes leave the block. No turret turns, nothing drives,
  nothing burns.
- Nothing seen of fuel, breakdown, tracked terrain effects, combined arms or armoured spearheads (PLAN 3.1–3.7
  unticked).

**Fix.** Give the 1938 nations budgets that carry their historical armies, or keep the economic AI from disbanding
below a floor and never in the first months; say so in the history when a formation is disbanded. Then Phase 3.

### 13. Differentiator: aircraft: 0/10

No air, plane, bomber, fighter or airbase string on any screen (`c2_j.json` → `wordsOnScreen`), no air template, no
air module under `src/` beyond data schemas and unit looks. Nothing flies in any of 344 screenshots.

### 14. Differentiator: AI nuclear use: 0/10

No nuke, nuclear, atomic or missile string on any screen, no God Mode nuke (AoC has one, text §5), no nuclear module
under `src/`. Seven made-up command kinds, `launchNuke` among them, produced no effect on the map.

---

## BLOCKING issues (prioritised)

1. **R2-B1: Naval, air and nuclear systems do not exist.** Three of the five differentiators score 0, and the lack of
   sea transport freezes the maritime powers (United Kingdom: 3.39 M men, the same 17,000 cells for 20 years).
   Evidence: `critic/c2_j.json`, `shots/c2j_22_uk_after_30_days.png`, `shots/c2j_23_channel_300m.png`,
   `critic/c2_headless_seed31337_40y.json`.
2. **R2-B2: The close zoom shows a diagram, not a battle** (5, needs 8). No flag, strength or name at T2/T3, both
   sides the same grey and white, no unit panel, the enemy outside any T3 view, figures that stand in a grid under
   fire, ground coloured by nation. Evidence: `shots/c2x_crop_t2_both_sides_grey.png`,
   `shots/c2b_10_ladder_00020m.png`, `shots/c2e_live_fire_020m_l0_1.png`, `shots/c2e_live_fire_008m_l0_2.png`,
   `shots/c2x_crop_t3_figures.png`, `shots/c2b_40_ground_berlin_0020m.png`, `shots/c2b_31_closest_zoom.png`,
   `critic/c2_g.json`.
3. **R2-B3: 228 of 1,054 formations, all 34 Soviet armour formations among them, are disbanded in the first tick of
   every 1938 game; the tanks that remain have no tank behaviour and no tank picture beyond an icon.** Evidence:
   `critic/c2_k2.json`, `critic/c2_k.json`, `shots/c2x_crop_t3_tank_1m.png`,
   `shots/c2x_crop_t3_tanks_in_contact.png`.
4. **R2-B4: A loaded game does not go on as the game that was saved.** Seed 2718: Node's own `--save`/`--load` at
   year 10 gives another year 11 (694 against 695 formations, 110 against 109 nations, an annexation missing); in the
   browser Continue differs from the save from year 10 and the two games part. Also the worker's state hash leaves
   Node's on 2 January 1946, without a difference in the world that I could see. Contradicts PLAN 2.11j, the CLI's
   header and PARITY's "bit-identical save/load". Evidence: `critic/c2_saveload_node.log`,
   `critic/c2_seed2718_11y.json`, `critic/c2_seed2718_loaded_plus1.json`, `critic/c2_f.json`, `critic/c2_g.json`,
   `critic/c2_i_node.log`, `critic/c2_i_node.json`, `critic/c2_i_page.json`, `critic/c2_h.json`.
5. **R2-B5: Outside Europe the world does not change for decades, and the fastest speed is 10–12 s a year.** Top five
   by land identical from year 8 to year 40 on seed 31337; Brazil and Australia unchanged for 14 years on seed 2718.
   Evidence: `critic/c2_headless_seed31337_40y.json`, `critic/c2_headless.log`, `critic/c2_a.json`,
   `shots/c2a_31_charts_default.png`, `critic/c2_p.json`.
6. **R2-B6: Statelet spam.** God Kill turns one nation into 36 "Free X" nations (one of them "Free state 128") and 43
   wars; after 14 years 25 of 109 living nations are "Free <province>", all with blank flags; 32% of the history is
   "broke away". Evidence: `critic/c2_c.json`, `shots/c2c_17_after_kill_3000m.png`,
   `shots/c2x_crop_kill_war_banners.png`, `shots/c2x_crop_rebel_flags_1952.png`, `critic/c2_a.json`.
7. **R2-B7: One scenario, one map, no random world.** Evidence: `shots/c2a_00_title.png`, `critic/c2_a.json`
   (`title.scenarios`).
8. **R2-B8: God Mode actions that fail silently or do something else.** Ally does nothing when the target is allied
   elsewhere; Revive does nothing after a Kill; the Territory brush adds no cells and leaves hatched land; a killed
   nation's name stays on that land. Evidence: `critic/c2_c.json` (`god`), `shots/c2c_14_god_brush_drag.png`,
   `shots/c2x_crop_dead_gaul_still_on_map.png`, `shots/c2c_19b_god_revive.png`.

## Non-blocking issues

- N1: Armies lose 61% and 87% of their men in 60 days of a war that moves the front by a border strip
  (`critic/c2_b.json`, `shots/c2b_02_war_day60_2500m.png`).
- N2: Wars drag in half the world: "United Kingdom +33 ⚔ Angola", Poland against Xinjiang
  (`shots/c2b_40_ground_china_occupied_0250m.png`, `shots/c2g_31_click_marker.png`).
- N3: Occupied land stays hatched for years after peace (`shots/c2a_21_after_europe_4000m.png`).
- N4: T1 in a war is covered in order arrows from off-screen formations (`shots/c2x_crop_t1_arrows_1500m.png`).
- N5: T1 markers overlap around Warsaw at the start; one is under the capital flag
  (`shots/c2x_crop_t1_markers_warsaw.png`).
- N6: No tooltips, no formation panel, no city panel (`critic/c2_g.json` → `observer`).
- N7: Escape closes nothing; F1–F6 and number keys do not switch map modes; eight modes behind one cycling button
  (`critic/c2_c.json`).
- N8: At 1024×600 the pause button and the date are off screen; at phone width the panels cover each other
  (`shots/c2c_57_viewport_1024x600.png`, `shots/c2c_57_viewport_phone_390x844.png`).
- N9: A 2.9 s freeze in a continuous zoom-in; frame gaps up to 452 ms at Max speed at 400 m/px (`critic/c2_p.json`).
- N10: Seven alliances named "Defensive Pact"; the history shows "#24" for an alliance
  (`critic/c2_a.json`, `shots/c2a_32_history.png`).
- N11: "France broke away from Italy": land returned to a living nation is logged as a revolt
  (`shots/c2a_32_history.png`).
- N12: Editing terrain does not switch to the terrain view; the stroke is invisible
  (`shots/c2c_24_editor_terrain_brush.png`).
- N13: The flag editor has no undo, line or circle (`shots/c2c_28_flag_editor_drawn.png`).
- N14: Ranking rows have no flags; charts have no axis ticks or hover; the economy tab is six numbers
  (`shots/c2a_30_ranking_land.png`, `shots/c2a_31_charts_men.png`, `shots/c2a_33_panel_tab-economy.png`).
- N15: Map names and counters show through the Ranking panel (`shots/c2a_03_boot_europe_4000m.png`).
- N16: War banners three rows deep over the map (`shots/c2a_20_after_world.png`).
- N17: A black smear under a counter near Bern in 1952 (`shots/c2x_crop_rebel_flags_1952.png`).
- N18: No sound; English only.
- N19: Sim tick p95 up to 8.6 ms in the 40-year run (`critic/c2_headless.log`).
- N20: The worker takes commands of unknown kinds into its state (`critic/c2_j.json`).
- N21: While the game runs, half-faded counters are on screen all the time as the clusters regroup
  (`shots/c2b_02_war_day60_2500m.png`: "432", "29.6k", "11.9k", "21.4k" at part opacity).

## Real strengths (brief)

- The T0 political map at the start of a game: smooth borders and coast, curved names and counters that keep clear
  of each other, sharper than AoC's tiles at the same scale (`shots/c2a_03_boot_europe_4000m.png` against
  `reference/screens/steam-screenshot-00.jpg`).
- The shell holds: no crash or console error in eleven sessions including a stress minute, a 1.5 s start from the
  title screen, 60 fps under vsync everywhere, and the editor's export → title → play round trip works first time
  (`critic/c2_g.json` → `stress`, `critic/c2_a.json`, `shots/c2c_31_loaded_scenario_sahara.png`).

# Critic report, run 3

- Commit: `a6f63ef7e4f04a1b929a5364ef2260435901b0f7` (Phase 3, armour, ticked).
- Date: 2026-10-07. Build: `npm run build`, exit 0 (`critic/c3_build.log`), served with `vite preview` on port 5299.
- Machine: RTX 4070 Ti, Chromium through Playwright, 1600 × 900 unless stated.
- Every path below was produced in this run (prefix `c3`). Scripts: `critic/scripts/c3_*.mjs`.
- `reference/NOTES.md` is still missing, so the user's taste is known only from `reference/screens/` and the
  trailer frames. AoC behaviour I cite is from those pictures and from the text sources in `docs/PARITY.md`;
  where it is text only I say so. Confidence in the comparisons is medium.

## Verdict

Three of the five differentiators (naval, air, nuclear) still do not exist, so the game cannot be better than
AoC yet. Of the eight blocking issues of run 2, four are fixed (save/load, the vanishing order of battle, one
scenario only, silent God actions), two are partly fixed (the close zoom, the frozen world) and two stand
(no navy, statelet spam, which is worse over a long run). Armour moved from an icon to a working unit
type, but nothing at the close zoom yet looks like a tank battle.

## Scores

| Dimension | Run 2 | Run 3 |
|---|---|---|
| Map visuals and readability | 6 | 6 |
| Diplomacy, war, alliance, puppet, revolt depth | 5 | 5 |
| Emergent world dynamics over long runs | 4 | 4 |
| God Mode | 5 | 6 |
| Editor and scenarios | 5 | 6 |
| Stats and history | 5 | 5 |
| UI/UX and polish | 4 | 5 |
| Performance | 6 | 5 |
| Stability | 5 | 7 |
| Semantic zoom to unit level (needs 8) | 5 | 6 |
| Naval warfare (needs 8) | 0 | 0 |
| Tanks (needs 8) | 2 | 5 |
| Aircraft (needs 8) | 0 | 0 |
| AI nuclear use (needs 8) | 0 | 0 |

No score is above 7.

## What happened to the run 2 blockers

| Run 2 id | Now | Evidence of this run |
|---|---|---|
| R2-B1 no navy, air, nukes | Not fixed | `critic/c3_j.json` (`wordsOnScreen`, seven unknown command kinds refused), `critic/shots/c3j_22_uk_after_30_days.png` |
| R2-B2 close zoom is a diagram | Partly | Tags, a formation panel, terrain ground and a jump from the war banner exist. What is left is R3-B3. |
| R2-B3 228 formations disbanded in tick 1 | Fixed | 1,054 formations and 34 Soviet armour formations at tick 0, tick 1 and day 30 (`critic/c3_k.json`, `oob`) |
| R2-B4 a loaded game diverges | Fixed | Node, seed 8128: 8 years straight and 7 years + save + load + 1 year both end on hash `55467e82` (`critic/c3_sl_straight.log`, `critic/c3_sl_load.log`). Browser, seed 5150: Continue equals the saved game at years 1, 3, 5, 8, 11 and 30 days after each (`critic/c3_f.json`). The worker's year 11 hash equals Node's, `e14cf54a` (`critic/c3_node5150.log`). Seed 7411: a game loaded at year 10 is the same two years on (`critic/c3_g.json`, `loadDivergence`). |
| R2-B5 world frozen outside Europe, slow | Partly | Eurasia and Africa now change. The Americas do not, and Max is slower. See R3-B1 and R3-B5. |
| R2-B6 statelet spam | Kill is fixed, the long run is worse | Kill France now leaves 4 successors, not 36 (`critic/c3_c.json`, `livingBeforeAfterKill` 103 to 107). The long run is R3-B2. |
| R2-B7 one scenario | Fixed | "Random world" on the title screen, 2 to 200 nations (`critic/shots/c3l_30_title_random.png`, `critic/shots/c3l_31_random_start_world.png`) |
| R2-B8 silent God actions | Fixed | "Not done: one of them is in an alliance already", "Not done: one is the other's puppet", "Not done: the nation died less than two years ago" (`critic/c3_l.json`, `god`; `critic/shots/c3c_19b_god_revive.png`). The Territory brush added 745 cells (`critic/c3_c.json`). |

## Dimensions

### Map visuals and readability: 6

- Tested: boot, Europe and Asia at 4,000 m/px, a 15-stop zoom ladder, the world after 14 years, eight map modes.
- Evidence: `critic/shots/c3a_02_boot_world.png`, `critic/shots/c3a_03_boot_europe_4000m.png`,
  `critic/shots/c3a_20_after_world.png`, `critic/shots/c3a_21_after_europe_4000m.png`,
  `critic/shots/c3b_10_ladder_00400m.png`, `critic/shots/c3c_00_mode_*.png`.
- The 1938 start is clean and readable: curved names, flags, counters.
- After 14 years the Soviet Union is a field of thin stripes and rail-like lines of other nations' colours, and
  Europe is a patchwork of "Free X" slivers. It reads as noise (`c3a_20_after_world.png`).
- At 400 m/px every formation's order line is drawn for an observer: dozens of dashed yellow lines cross the
  whole view (`c3b_10_ladder_00400m.png`).
- At the close tiers occupied land is washed in the occupier's colour. French-occupied Germany is a blue field
  that reads as a lake (`critic/shots/c3m_10_form40_20m_at_position.png`).
- AoC does better: its fronts are visible as lines of units along a border (`reference/screens/steam-screenshot-01.jpg`);
  ours are scattered counters. Its long-run maps stay in large, legible blocks (`reference/screens/community-dominated-world-a.png`).
- Fix: hide order lines unless a formation or nation is selected; merge slivers; a hatch, not a full wash, for occupied ground.

### Diplomacy, war, alliance, puppet, revolt depth: 5

- Tested: God-declared wars on seeds 4242 and 1212, a declaration refused between allies on seed 3301, alliance and puppet commands, 90 days of wars logged.
- Evidence: `critic/c3_l.json`, `critic/c3_k2.json`, `critic/shots/c3k2_11_front_day90_1500m.png`, `critic/shots/c3k_10_front_day60_2500m.png`.
- Wars happen inside one realm. On seed 3301 the United Kingdom declared war on French West Africa on
  6 March 1938 while leading the Anglo-French Entente, and seven French puppets (French Equatorial Africa,
  Madagascar, Morocco, Tunisia, Syria, Lebanon, Indochina) were at war with French West Africa, which has
  the same overlord (`c3_l.json`, `friendlyWars` and `historyHead`; banner "United Kingdom +32 × French West
  Africa" in `c3k_10_front_day60_2500m.png`).
- An alliance of 30 goes to war with a one-province rebel: "Belgium +29 × Free Gers" (`critic/shots/c3c_19b_god_revive.png`).
- Germany against Poland, seed 4242: in 90 days Germany lost 304,000 of 564,000 men and Poland 373,000 of
  418,000, and not one cell changed owner; land is only hatched as occupied until peace (`c3_k2.json`, `course`).
- AoC does better (text): land changes hands as it is taken, wars end in annexation or puppets within the war.
- Fix: no war between nations with one overlord or one alliance; a rebel's war is its parent's, not the
  whole alliance's; hand over land during a war once it is held for a time.

### Emergent world dynamics over long runs: 4

- Tested: 40 years headless on seed 4242, 14 years in the browser on seed 6021, 15 years of a random world.
- Evidence: `critic/c3_seed4242_40y.json`, `critic/c3_headless40.log`, `critic/c3_a.json`,
  `critic/shots/c3a_31_charts_land.png`, `critic/c3_random613_15y.json`.
- Better than run 2: on seed 6021 France rises to first by land, the Soviet Union falls from 15.9 % to 5.5 %,
  Germany takes central Europe.
- The fall is one cliff, not a story: the Soviet line drops by two thirds in one step (`c3a_31_charts_land.png`),
  to a rebel named "Free Herat", which is then the sixth largest country on earth with 260 men (`c3_a.json`, year 9).
- The world fragments and never consolidates. Seed 4242: 97 nations alive in year 1, 170 in year 40, and 430
  nations created in all. Seed 6021: 59 of the 137 nations alive in 1952 are "Free <province>" (`c3_a.json`, `afterNames`).
- The Americas do not move. Seed 4242: Canada holds 12.1 % of cells and the United States 7.7 % in every year
  from 15 to 40, Denmark (Greenland) 5.4 to 5.5 % for all 40 (`c3_seed4242_40y.json`).
- AoC does better: its long runs end in a few empires (`reference/screens/community-dominated-world-b.png`).
- Fix: see R3-B2 and R3-B1.

### God Mode: 6

- Tested: every control on France, tools (revolt, breakthrough, territory), kill and revive, refusals.
- Evidence: `critic/c3_c.json` (`god`), `critic/c3_l.json` (`god`), `critic/shots/c3c_12_god_after_actions.png`,
  `critic/shots/c3c_17_after_kill_3000m.png`, `critic/shots/c3l_10_god_ally_italy.png`.
- Works: rename, income bonus, AI off, buffs, puppet, war, peace, revolt, breakthrough, brush, kill. Refusals say why.
- Missing against AoC's panel (`reference/screens/steam-screenshot-01.jpg`): Nuke, Annex, Fight to the Death,
  Donate, Recolor. Map modes have no hotkeys (`c3_c.json`, `fkeys`).
- Fix: add annex, recolor and fight-to-the-death to the God tab; nuke with Phase 6.

### Editor and scenarios: 6

- Tested: brush, line, bucket, undo and redo, terrain, city, gold, annex, flag editor, export, load from the
  title screen, a broken file, the random world.
- Evidence: `critic/c3_c.json` (`editor`), `critic/shots/c3c_21_editor_brush_drag.png`,
  `critic/shots/c3c_27_flag_editor.png`, `critic/shots/c3c_31_loaded_scenario_sahara.png`,
  `critic/shots/c3l_31_random_start_world.png`, `critic/shots/c3l_34_random_3y_europe_4000m.png`.
- All of it worked. An exported scenario loaded with the same 4,067 German cells.
- The random world names its nations after provinces ("Magellan and the Chilean Antarctic", "Seine-Maritime")
  and paints half of them purple or magenta. After three years one of them owns western and central Europe.
- AoC does better (text): several maps and start years, a scenario browser, Workshop sharing.
- Fix: a second start year; generated nation names; a palette with more hue distance.

### Stats and history: 5

- Tested: five ranking metrics, five chart metrics, history filters, exports.
- Evidence: `critic/shots/c3a_30_ranking_land.png`, `critic/shots/c3a_31_charts_land.png`,
  `critic/shots/c3a_32_history.png`, `critic/c3_a.json` (`historyByKind`).
- The history is a flood: 2,395 events in 14 years, of which 453 are war declarations, 450 are "Land of X went over to Y", 423 are
  peaces and 237 are revolts. Rows such as "#43 dissolved", "Denmark left #43" and "Turkey broke away from
  Free Bursa" leak an id or say the reverse of what happened (`c3a_32_history.png`).
- Nothing tells a watcher that something happened while it happens: no ticker, no popup (`critic/c3_q.json`,
  `liveRegions` empty; `critic/shots/c3q_00_running_max_world.png`). AoC has a ticker line
  (`reference/screens/steam-screenshot-01.jpg`, bottom left) and war popups (text).
- Fix: a live ticker of major events only; name alliances in every row; fold land handovers into one row per peace.

### UI/UX and polish: 5

- Tested: title screen, panels, formation panel, war banners, settings, three window sizes, second locale.
- Evidence: `critic/shots/c3a_00_title.png`, `critic/shots/c3k_21_formation_panel.png`,
  `critic/shots/c3k_30_after_banner_click.png`, `critic/shots/c3c_57_viewport_phone_390x844.png`, `critic/c3_g.json`.
- New and working: a formation panel (men, supply, org, fuel, elements) and a war banner that flies to a battle.
- No sound at all (`grep AudioContext src` is empty; PARITY row 79 "Audio" has no evidence). AoC has music and a war trumpet (text).
- No hover tooltip on anything (`c3_g.json`, `tooltipOnHover` empty). Escape closes no panel (`c3_c.json`).
- The date label wraps to a second line when "· Paused" does not fit and the bar jumps
  (`c3k_21_formation_panel.png`, `c3l_34_random_3y_europe_4000m.png`).
- War banners are drawn over the bottom rows of the History panel (`c3a_32_history.png`).
- At 390 × 844 the ranking, the nation panel and the top bar lie on each other (`c3c_57_viewport_phone_390x844.png`). AoC ships on phones.
- Fix: sound; tooltips; Escape; a fixed-width date; panels above banners; a narrow layout.

### Performance: 5

- Tested alone, nothing else running: tick time pinned, Max speed in the browser, frame rate uncapped at every tier.
- Evidence: `critic/c3_perf_node.log`, `critic/c3_perf_node_late.log`, `critic/c3_q.json`, `critic/c3_p.json`.
- Rendering is fast: 115 to 860 frames a second uncapped at 1920 × 1080 across all tiers (`c3_p.json`). Hitches
  of 100 to 157 ms occur at T3 while the sim runs.
- The sim is the limit. Seed 4242, pinned to `0xFFFF`: mean tick 2.27 ms over three years (2.42, 2.42, 1.96),
  against the repo's own budget of 1.5 ms. Years 8 and 9 of seed 8128: 2.59 and 1.80 ms.
- Max speed is 15 to 28 seconds a simulated year in the browser, alone, at the world view (`c3_q.json`; the bar
  reads "Speed Max" in `critic/shots/c3q_00_running_max_world.png`, the `label` in the JSON was read before the bar redrew).
  The same 14-year script as run 2 took 16 to 61 seconds a year this time (`critic/c3_a.json`, with other runs
  beside it) against 8 to 19, median 12, then (`critic/c2_a.json`, kept from run 2). Fifty
  years is about 17 minutes of watching. The 40-year headless run took 19.9 minutes (with other runs beside it).
- AoC does better (text): decades pass in a few minutes at its top speed.
- Fix: a coarse sim path when no close tier is watched; find why years vary 2.5 × in tick time.

### Stability: 7

- Tested: twelve browser sessions and seven headless runs; a stress minute of random camera jumps, speed
  changes, modes and panels at Max.
- Evidence: `errors` is empty in `critic/c3_a.json`, `c3_b.json`, `c3_c.json`, `c3_g.json`, `c3_k.json`,
  `c3_k2.json`, `c3_l.json`, `c3_m.json`, `c3_q.json`; `critic/c3_f.json`; `critic/c3_g.json` (`stress`: 3,374
  frames, worst 367 ms, none over 500 ms).
- No page error, crash or console error in any session. Save, load and Continue are bit-identical at every
  checkpoint I tried on seeds the builder did not use. The worker matches Node at year 11.
- That is parity with a shipped game, not better: the layout bugs above and the unknown-command warnings are still there.

### Semantic zoom to unit level: 6 (needs 8)

- Tested: ladder from 12,000 to 1 m/px on a fight, live shots at T1, T2, T3, the mouse wheel both ways, six
  German armour formations at four scales, the biggest fight of day 21 watched for 230 sim hours.
- Evidence: `critic/c3_b.json`, `critic/shots/c3b_10_ladder_*.png`, `critic/c3_m.json`,
  `critic/shots/c3m_10_form40_06m_at_position.png`, `critic/shots/c3m_11_form40_02m_at_centroid.png`,
  `critic/shots/c3m_21_fight_040m_live.png`, `critic/shots/c3j_12_tank_live_025m_2.png`.
- Better than run 2: formations carry a flag, strength and name at T2 and T3; a click opens a panel; the
  ground is terrain; tracers and impacts show at 25 m/px (`c3j_12_tank_live_025m_2.png`).
- A formation in contact is not where its tag is. For three of six German armour formations the elements stand
  12.8 to 12.9 km from the formation's position. Centre the view there at 6 or 2 m/px and the snapshot holds
  0 elements and 0 figures: a tag over an empty field with one stray white glyph
  (`c3_m.json`, `at6`, `at2`; `critic/shots/c3k2_22_armour_live_006m_a.png`).
  It is the engaged ones only (flags 3; the three not engaged are 0.2 km off), and 12.9 km is two thirds of a
  cell: the elements are drawn at the cell edge they fight across, which is what run 2 asked for. The defect is
  that the tag, the formation's position and the panel still point at the cell centre, where nothing is.
- "The biggest fight" (16 engaged formations within 3 cells) at 40 m/px is one infantry division standing
  alone; no enemy is in a 64 km view (`c3m_21_fight_040m_live.png`).
- Units in contact stand in a parade lattice, all facing one way; five tank formations share one cell as
  interleaved diamonds (`critic/shots/c3j_11_tank_paused_0040m.png`, `critic/shots/c3j_11_tank_paused_0004m.png`).
- Fix: see R3-B3.

### Naval warfare: 0 (needs 8)

- No fleet, ship, port use or sea transport exists. Unit data for ships is in `data/units/sea.json` and nothing
  reads it in play. A British division ordered to Calais stops on the English coast, 3.5 cells short
  (`critic/c3_j.json`, `differentiators`; `critic/shots/c3j_22_uk_after_30_days.png`, `critic/shots/c3j_23_channel_300m.png`).

### Tanks: 5 (needs 8)

- Tested: Soviet armour against Poland (seed 1212), German armour against Poland for 90 days (seed 4242), the
  formation panel, the build list, wrecks.
- Evidence: `critic/c3_j.json`, `critic/c3_k2.json`, `critic/c3_m.json`, `critic/shots/c3j_11_tank_paused_01.5m.png`,
  `critic/shots/c3j_12_tank_live_002m_2.png`, `critic/shots/c3k_21_formation_panel.png`.
- Real: 72 armour formations survive the start; tank sprites with a hull and a turret that turns between
  frames; a panel with fuel use and org; armoured, mechanised and tank templates, the later ones behind research.
- Armour does lead: over the 90 days German armour averaged 1 to 27 cells east of its start, the other 44
  formations -3 to 5 (`c3_k2.json`, `course`, `meanEast`). This is one seed.
- No wreck was ever drawn. In 230 sim hours of the largest fight `wrecks` and `shown` stayed 0 with 100 to
  230 shots in the air (`c3_m.json`, `wreckSamples`), and none shows in any of this run's pictures. The
  claimed burning wrecks are unseen by a player. Medium confidence: an element must die whole to leave one.
- Tanks in contact do not manoeuvre; they sit in the lattice (`c3j_12_tank_live_002m_2.png`). No tank fights a
  tank in any picture.
- Soviet tanks are tinted pink, close to Poland's own pink, so the two sides are hard to tell apart at T3
  (`critic/shots/c3j_12_tank_live_006m_2.png`).
- Fix: movement and facing in contact; wrecks from strength lost, not only from a dead element; a darker,
  truer nation tint.

### Aircraft: 0 (needs 8)

- Nothing exists beyond `data/units/air.json`. No air word appears on screen (`critic/c3_j.json`, `wordsOnScreen`).

### AI nuclear use: 0 (needs 8)

- Nothing exists. `launchNuke`, `nuke` and `nuclearStrike` are refused as unknown commands (`critic/c3_j.json`, `errors`).

## Blocking issues, in priority order

1. **R3-B1. Naval, air and nuclear systems do not exist; armies cannot cross water, and the Americas stand
   still for 25 years.** Evidence: `critic/c3_j.json`, `critic/shots/c3j_22_uk_after_30_days.png`,
   `critic/c3_seed4242_40y.json`. Fix: Phases 4 to 6, sea transport first.
2. **R3-B2. The world shatters into rebel statelets and never consolidates.** 59 of 137 living nations are
   "Free <province>" after 14 years; "Free Herat" is the sixth largest country; 430 nations are created in 40
   years and the living count climbs from 97 to 170. Evidence: `critic/c3_a.json`,
   `critic/shots/c3a_20_after_world.png`, `critic/shots/c3a_21_after_europe_4000m.png`,
   `critic/shots/c3a_31_charts_land.png`, `critic/c3_seed4242_40y.json`. Fix: a revolt returns land to a
   core owner or a neighbour before it founds a nation; cap a rebel's land at its province and its region;
   let weak statelets be annexed in one war; fail a sweep whose living count rises for 20 years.
3. **R3-B3. The close zoom still does not show a battle.** A formation in contact has its elements 12.9 km
   from its position, so zooming to it shows an empty field; the largest fight on the map is one division
   alone in view; units stand in a lattice; no wreck appears. Evidence: `critic/c3_m.json`,
   `critic/shots/c3k2_22_armour_live_006m_a.png`, `critic/shots/c3m_10_form40_06m_at_position.png`,
   `critic/shots/c3m_21_fight_040m_live.png`, `critic/shots/c3j_11_tank_paused_0040m.png`. Fix: keep the elements at the
   cell edge, and move the tag, the click target and the camera target to where they are; place both sides of an engagement within one T3 view;
   break the lattice when engaged; draw losses.
4. **R3-B4. Wars inside one realm and one alliance.** The United Kingdom and seven French puppets fight
   French West Africa, France's own puppet; 30 nations go to war with one rebel province. Evidence:
   `critic/c3_l.json` (`friendlyWars`, `historyHead`), `critic/shots/c3k_10_front_day60_2500m.png`,
   `critic/shots/c3c_19b_god_revive.png`. Fix: refuse a declaration between nations that share an overlord
   or an alliance; scope a rebel's war to its parent.
5. **R3-B5. Max speed is 15 to 28 seconds a year, slower than in run 2, and the tick is half again over its
   budget.** Evidence: `critic/c3_q.json`, `critic/shots/c3q_00_running_max_world.png`, `critic/c3_a.json`, `critic/c3_perf_node.log`, `critic/c3_perf_node_late.log`. Fix: a
   coarse path for unwatched fronts; profile the 2.4 ms years.
6. **R3-B6. A watcher is told nothing: no sound, no event ticker, no popup.** Evidence: `critic/c3_q.json`,
   `critic/shots/c3q_00_running_max_world.png`, against `reference/screens/steam-screenshot-01.jpg`. Fix: a
   ticker for wars, peaces, capitals and deaths; a click on a row flies there; basic sound.

## Non-blocking issues

- Order lines of every formation drawn for an observer at 400 m/px (`critic/shots/c3b_10_ladder_00400m.png`).
- Occupied ground washed in the occupier's colour reads as water (`critic/shots/c3m_10_form40_20m_at_position.png`).
- History rows with raw ids and reversed sense: "#43 dissolved", "Turkey broke away from Free Bursa" (`critic/shots/c3a_32_history.png`).
- War banners over the History panel (`critic/shots/c3a_32_history.png`).
- The date label wraps and the bottom bar jumps (`critic/shots/c3k_21_formation_panel.png`).
- No hotkeys for map modes; Escape closes nothing; no tooltips (`critic/c3_c.json`, `critic/c3_g.json`).
- Phone-width layout unusable (`critic/shots/c3c_57_viewport_phone_390x844.png`).
- No land changes owner during a war that kills two thirds of both armies (`critic/c3_k2.json`).
- Kill leaves successors in near-identical greys (`critic/shots/c3c_17_after_kill_3000m.png`).
- Random world: province names as nation names, a purple-heavy palette (`critic/shots/c3l_31_random_start_world.png`).
- Soviet tank tint close to Poland's pink at T3 (`critic/shots/c3j_12_tank_live_006m_2.png`).
- God Mode lacks annex, recolor, fight-to-the-death, donate (`critic/shots/c3c_12_god_after_actions.png`).
- Frame hitches of 100 to 157 ms at T3 while running (`critic/c3_p.json`).
- One of my own steps failed on an ambiguous selector (`critic/c3_g.json`, step 1), so a player building an
  armoured division was not re-tested in this run.
- In session K my God command on seed 3301 was refused because Germany and Poland were already allies;
  that session's "war" data is void and I did not use it. Session K2 is the valid one.

## Strengths, verified

- Save, load and Continue are exact, and the browser worker matches Node, on seeds the builder had not used
  (`critic/c3_f.json`, `critic/c3_sl_load.log`, `critic/c3_node5150.log`).
- Rendering holds 115 frames a second or more uncapped at every tier with a thousand formations on the map (`critic/c3_p.json`).

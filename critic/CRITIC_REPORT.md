# Critic report, run 7

- Commit: `19e2341632afaba7f7241e4eebab021b39ddf0d2` (PLAN 7.4 done; PLAN 7.5 asks for this run).
- Date: 2026-10-17. Build: `npm run build`, exit 0 (`critic/c7_build.log`). Served with `vite preview` on port 5299.
- Machine: the user's Windows machine with its GPU. Chromium through Playwright, headless, 1600 × 900 unless stated.
  Pinned tick figures (`--affinity 0xFFFF`) were taken with nothing else of mine running. Browser years at Max
  marked "unpinned" ran beside other work of mine, so they corroborate and do not measure.
- Every path below was made in this run (prefix `c7`). Scripts are `critic/scripts/c7_*.mjs` and `critic/scripts/c7_*.ts`.
- Seeds were my own: 3371, 8803, 1207, 5527, 4419, 7781, 9043, 2604, 3119, 6203, 8217, 5150. I also ran some of the
  builder's seeds to compare with its own figures: 6619 (PLAN 6.12) and seeds 1 to 10 (its PLAN 7.3g sweep). Seed 99
  only for the budget and the pin.
- Reference: there is no `reference/NOTES.md`. I used `reference/text/AOC_TEXT_NOTES.md`,
  `reference/screens/steam-screenshot-01.jpg` and `-03.jpg`. AoC's nuke and God tools are known only from text, so
  confidence is lower there.
- A self-inflicted error: session A logged 3,587 `n is not a function`. I caused them by passing a ranking list that
  does not exist (`population`) to `hud.setRankMetric`. The persisted value is checked against `RANK_LISTS`
  (`src/app/hud.ts:240-241`), so a player cannot reach this. A replay of the player's steps had 0 errors
  (`critic/c7_b_5527.json`). I did not count it as a finding.

## Verdict

The look and the tools caught up. The early game now looks like AoC:
- spaced capital names in the land's own shade;
- a ranking with flags and coloured bars;
- framed panels;
- no arrow web at T1.

God Mode has most of AoC's panel. The statelets are gone. Determinism is excellent: the browser and the headless
runner agree hash for hash for 12 years.

Two things stand between this and the DONE condition:

1. **AI nuclear use is too rare to be seen, and still not credible.**
   - 14 unaided worlds ran 30 years each: seeds 1 to 10, 3371, 8803, 6619 and 1207.
   - Only 2 of them saw a strike, 4 in all in 420 world-years, while 4 to 6 nations held 132 to 156 warheads and the
     missiles to deliver them.
   - All 4 strikes were by the Soviet Union: twice on the same point in the Netherlands, a year apart (734,042 and
     566,582 dead), and twice on South Africa.
   - On seeds 1 to 10 the builder's own PLAN 7.3g sweep had strikes in 4 of 10 seeds, 21 decisions; at HEAD it is 2
     of 10, 4 decisions.
   - France, God-set to be overrun and fighting to the death with 6 warheads, struck once when given missiles, then
     sat on 5 warheads for 49 days.
2. **The late game stalls.** The invasion AI takes 0.7 to 0.84 s at a time, about 50 times a year. A late year at Max
   takes 45 s in the browser at 20 to 30 fps. The same world's next year, without those calls, takes 8 s at 55 fps.

The late world is also quiet on some seeds (one of 14 moves less than the builder's own limit), but most seeds keep
moving. That is non-blocking.

## Scores

| Dimension | Run 6 | Run 7 |
|---|---|---|
| Map visuals and readability | 6 | 7 |
| Diplomacy, war, alliance, puppet, revolt depth | 6 | 6 |
| Emergent world dynamics over long runs | 5 | 6 |
| God Mode | 6 | 7 |
| Editor and scenarios | 6 | 6 |
| Stats and history | 6 | 7 |
| UI/UX and polish | 6 | 7 |
| Performance | 4 | 5 |
| Stability | 7 | 7 |
| Semantic zoom to unit level (needs 8) | 6 | 6 |
| Naval warfare (needs 8) | 6 | 5 |
| Tanks (needs 8) | 5 | 5 |
| Aircraft (needs 8) | 5 | 5 |
| AI nuclear use (needs 8) | 4 | 3 |

No score is above 7. Stability came closest: 12 of 12 yearly hashes match between browser and headless, and no page
error occurred in any session. It stays at 7 because I have no evidence that AoC is less stable (see its section).

## What happened to the run 6 blockers

| Run 6 id | Now | Evidence of this run |
|---|---|---|
| R6-B1: the nuclear age makes the game crawl | **Not shown fixed.** The strikes are now so rare (4 in 420 world-years) that the nuclear system's late cost was not reached; on seed 3371 it is not among the top costs. A new stall replaces it (R7-B2) | `critic/c7_perf_3371_y15_30_solo.log` |
| R6-B2: AI nuclear use not credible | **Stands, and the use is now rare** (R7-B1) | `critic/c7_headless_q4.json`, `critic/c7_headless_q5.json`, `critic/c7_headless_q*.json` |
| R6-B3: statelets | **Fixed.** 71 to 100 nations alive across 14 30-year runs, against 154 in run 6. At year 30, 3 to 14 of them were founded in play | `critic/c7_headless_*.json` (`living`, `founded`) |

## Dimensions

### Map visuals and readability: 7

- **Tested:**
  - Boot.
  - Berlin at 6,000, 2,500, 900, 300, 80 and 20 m/px.
  - Europe after 4 years at Max.
  - A 1967 world loaded from a checkpoint.
  - The L map at the same ladder.
  - The air and fallout modes.
- **Evidence:** `critic/shots/c7a_5527_02_boot.png`, `c7a_5527_12_click_nation.png`, `c7k_8217_07_t1_noselect.png`,
  `c7j_3371_2_year2.png`, `c7j_3371_3_world_end.png`, `c7g_L_3119_2_year1.png`, `c7k_8217_05_air_mode.png`.
- **At par with AoC** (`reference/screens/steam-screenshot-01.jpg`, `-03.jpg`):
  - Large spaced capital names in a darker shade of the land.
  - Flags on counters.
  - The ranking with flags and coloured bars.
  - Framed panels.
- **Better than run 6:**
  - At T1 the order arrows are gone unless something is selected (`c7k_8217_07_t1_noselect.png`).
  - The 1967 world reads as large blocks (`c7j_3371_3_world_end.png`).
- **Problems:**
  - A city that lost 1,025,202 people looks the same at 150 m/px ten days later: no scorch or ruin
    (`c7k_8217_00_berlin_150_before.png` against `c7k_8217_03_berlin_150_day10.png`). AoC has an optional wasteland
    (AOC_TEXT_NOTES).
  - The air mode hatches Poland, the Baltic states and Ukraine as "held by Yugoslavia" on day 10 of Germany's war on
    Poland (`critic/c7_m_8217.json`, `hovers`; `c7k_8217_05_air_mode.png`).
  - The legend says "Germany: 1 zones".
  - The alert banner stays over the map ten days after the strike (`c7k_8217_03_berlin_150_day10.png`).
- **AoC does better:** an optional nuke wasteland (AOC_TEXT_NOTES lines 414 to 418).
- **Fix:** mark struck cities; give the air zone to someone fighting there; plural "1 zone".

### Diplomacy, war, alliance, puppet, revolt depth: 6

- **Tested:**
  - Four 30-year AI worlds.
  - God wars: Germany on Poland, France and the United Kingdom.
  - Fight to the death.
  - Annex and Donate.
  - Spawn nation.
- **Evidence:** `critic/c7_headless_*.json`, `critic/c7_c2_4419.json`, `critic/c7_l_5150.json`,
  `critic/shots/c7c2_4419_03_polfront_800m.png`.
- **Works:**
  - Allies join at once: France attacks into Germany near Karlsruhe on day 3 of the war on Poland
    (`c7d_7781_arm_0080m.png`).
  - Banners show the allies' count ("United Kingdom +29").
  - A revolt now goes to its core nation, and the statelet count is fixed.
- **Weak:**
  - In the late game wars are few and endless. In 1967 Poland (+20 allies) and Denmark are the only war on the map
    for two years (`c7j_3371_2_year2.png`).
  - On seed 3371, years 26 to 30 have 0, 1, 1, 2 and 2 wars (`critic/c7_headless_3371.json`).
- **AoC does better:** wars are decisive and the map keeps changing (text, frames).
- **Fix:** end long wars with no land front by a peace; give the late game new causes of war.

### Emergent world dynamics over long runs: 6

- **Tested:** 30 years headless on 14 seeds (1 to 10, 3371, 8803, 6619, 1207), unpinned, run side by side.
- **Evidence:** `critic/c7_headless_{3371,8803,6619,1207}.json`, `critic/c7_headless_q1.json` to `critic/c7_headless_q10.json`,
  their `.log` files, `critic/shots/c7j_3371_3_world_end.png`.
- **Good:**
  - No break-up: 71 to 100 nations alive.
  - Real risers and fallers:
    - The Soviet Union falls from 27 % to 9 to 17 % on every seed.
    - Poland reaches 21.8 % (3371).
    - Germany reaches 35.5 % (1207).
    - Switzerland reaches 10.6 % (8803).
    - China rises to about 20 % and falls again.
  - Seeds 1 to 10 change 4 to 41 % of their land in their last 5 years (counted in cells).
- **Bad (non-blocking):**
  - **3371 freezes.** In years 26 to 30 the cells that change hands are 1,240, 279, 2,396, 0 and 609, which is
    0.72 % of the land in 5 years. The builder's own `moving` limit is 1 % (`tools/sweep/criteria.ts`; my count is
    cells, not km², so medium confidence).
  - **8803 is near-still.** Years 18 to 30 have 0 to 3 wars and 1.4k to 6k cells change hands a year.
  - **1207 ends at about the land limit.** Germany holds 35.5 % of the held cells in years 29 and 30. The limit
    (`MAX_LAND`) is 35 % of owned km² for a realm with its puppets; my figure is cells for one nation, so this is
    approximate.
  - **Static giants.** Canada holds 11.0 to 12.3 % for 30 years on 3 of my 4 seeds, and Denmark 5.4 % (Greenland).
  - **Quiet late wars.** Seeds 2, 4 and 7 have one war a year in years 27 to 30.
  - **Two seeds near 33 %.** The Soviet Union ends at 32.3 % (seed 3) and 32.8 % (seed 6), near the 35 % limit.
- **AoC does better:** its world keeps changing for centuries (text, frames).
- **Fix:** add late-game pressure and make Canada and Greenland reachable; judge with the 50-year sweep.

### God Mode: 7

- **Tested** by clicks: the God tab of Germany's panel and every tool listed below.
- **Evidence:** `critic/c7_c_4419.json`, `critic/c7_c2_4419.json`, `critic/c7_l_5150.json`,
  `critic/shots/c7c_4419_02_god_tab.png`, `c7c2_4419_01_war_declared.png`, `c7c2_4419_08_spawn_nation.png`,
  `c7c2_4419_10_nuke_warsaw.png`, `c7l_5150_00_spawned.png`.
- **At par with AoC's panel** (AOC_TEXT_NOTES lines 414 to 449, `steam-screenshot-01.jpg`). Everything below was
  present and responded:
  - Rename, Treasury, Recolor.
  - Income bonus, combat efficiency (with Lock), alliance unity.
  - The nation's AI and the world's AI.
  - Nuclear toggles and warheads +1.
  - Winner takes all, the revolt and CE modes.
  - Declare war, Ally, Make puppet, Leave alliance, Annex.
  - Donate gold.
  - Peace and Fight to the death for each war.
  - Buffs.
  - Revolt, Spawn nation, Breakthrough, Territory, Nuke, Found and Raze city.
  - Revive and Kill.
- **Verified effects:**
  - Annex took Czechoslovakia ("16 January 1938 Czechoslovakia was annexed by Germany").
  - Spawn nation founded "Free Loiret" (living 102 to 103).
  - Recolor turned Germany magenta.
  - The Nuke killed 556,000 at Warsaw.
- **Short of AoC:**
  - The nuke has no size. `hud.ts:552` still sends `thermonuclear: false`.
  - The tools are hidden. Pressing "God Mode" changes nothing on screen (`c7c_4419_00_godmode_on.png`). They sit in a
    "God" tab of a nation's panel, and at 1600 × 900 the map tools are below the fold: Kill sits at y = 864, and the
    panel scrolls (scrollHeight 836, clientHeight 708; `c7_c2_4419.json`, `panelScroll`).
- **Fix:** a nuke size (thermonuclear) in the God tool; show the tools when God Mode is pressed.

### Editor and scenarios: 6

- **Tested:**
  - Brushed Germany over the Sahara.
  - Placed "Critiqueville".
  - Exported a `.warsim-scenario`.
  - Loaded it on the title screen in a fresh browser.
- **Evidence:** `critic/c7_i_6203.json`, `critic/c7_i2.json`, `critic/c7_critic.warsim-scenario`,
  `critic/shots/c7i_6203_01_brush_sahara.png`, `c7i_6203_02_city.png`, `c7i2_01_started.png`.
- **Works:** the loaded game has the edited rasters, hash for hash (`owner 452345419`, `controller 2622025874`), and
  the new city.
- **Unchanged:**
  - A file starts the game at once, with no confirmation (`c7i2_00_title_with_file.png`).
  - Warheads, fleets, airbases and wings still cannot be placed, so a scenario cannot set up a nuclear standoff or a
    navy (`editorText`).
- **AoC does better:** its editor and scenario sharing are the same scope; nothing here goes beyond it (text).
- **Fix:** place warheads, fleets and wings in the editor; confirm before a chosen file starts.

### Stats and history: 7

- **Tested:** the ranking lists, the charts' options, the nation panel after a war and a strike, and the ticker.
- **Evidence:** `critic/c7_k_8217.json` (`chartOptions`, `germanyPanel`), `critic/shots/c7a_5527_02_boot.png`,
  `c7k_8217_09_charts.png`, `c7k_8217_11_history.png`.
- **At par:**
  - 12 ranking lists: land, army, income, treasury, manpower, enemies, puppets, aircraft and warheads, plus age, wars
    fought and revolts suffered, which cover the dead nations.
  - Flags and bars in the ranking, as AoC's.
  - The air war has its own block in the nation panel.
- **Missing:**
  - Germany's panel after a 1,025,202-dead bomb on Berlin shows no warheads, nuclear dead or fallout
    (`germanyPanel`).
  - The charts have no warhead or nuclear series.
- **AoC does better:** nothing measurable here; its Statistics panel is matched (`steam-screenshot-01.jpg`).
- **Fix:** add warheads, nuclear dead and fallout to the panel and the charts.

### UI/UX and polish: 7

- **Tested:**
  - Escape.
  - The keys 1 to 9.
  - The tooltip.
  - Settings.
  - Phone width (390 × 844).
  - The title screen and its new-game options.
- **Evidence:** `critic/c7_a_5527.json` (`modes`, `afterEscapeSelected`), `critic/shots/c7a_5527_11_hover_tooltip.png`,
  `c7a_5527_00_title.png`, `c7k_8217_12_phone.png`, `c7k_8217_10_settings.png`.
- **Fixed since run 6:**
  - Escape clears the selection (selected 0).
  - Keys 1 to 9 switch political, alliances, puppets, terrain, wars, diplomacy, income, revolts and sea control.
  - The tooltip names the city and nation ("Berlin · capital, Germany, Unrest 0").
  - The phone has no horizontal scroll (scrollWidth 390).
  - The title has map size, seed and rule choices.
- **Problems:**
  - "Pseudo-locale (i18n test)" is still in the player's language list (`titleButtons`).
  - On the phone the nuke alert covers the nation panel, and the bottom bar is cut at "Stati…"
    (`c7k_8217_12_phone.png`).
  - A played nation still cannot launch its own warheads: no UI sends `launchNuke` (grep `src/ui`, `src/app`).
  - God tools are hidden (see God Mode).
- **AoC does better:** its Actions panel is visible as soon as a nation is picked, with no extra tab
  (`steam-screenshot-01.jpg`).
- **Fix:** take the test locale out of release builds; keep the alert from covering panels on a phone; show the God
  tools when God Mode is pressed.

### Performance: 5

- **Tested:**
  - Seed 99, 5 years, pinned and alone.
  - Seed 3371 years 15 to 30 from my year-14 save, pinned, alone, `--profile`.
  - The browser at Max from my year-27 save (alone).
  - The L map in the browser.
- **Evidence:** `critic/c7_perf_seed99_5y_solo.log`, `critic/c7_perf_3371_y15_30_solo.log`, `critic/c7_j_3371.json`,
  `critic/c7_g_L_3119.json`, `critic/c7_a_5527.json`.
- **Within budget:**
  - Seed 99: year 1 2.14 ms (budget 2.4), five years 1.20 ms (budget 1.5).
  - The hash `b2dc23b4` equals the pin.
  - The L map (4096 × 2048) boots in 6.0 s and runs its first year at Max in 28 s at 58 fps (unpinned).
  - Early browser years at Max take 10 to 21 s (unpinned), against 20 to 53 s in run 6.
- **The late game, R7-B2** (`critic/c7_perf_3371_y15_30_solo.log`, pinned and alone):
  - `invasionAi` takes 0.4 to 4.0 ms of the mean tick in years 19 to 22 and 24 to 29, and 86 % in years 28 and 29.
  - About 50 calls a year last over 1 ms. The longest are 300 to 772 ms.
  - The tick in years 28 and 29 is 4.7 and 4.5 ms mean. The 95th percentile is 1.3 ms, so the stalls are the cost.
  - In years 15 to 18 it costs 0.005 to 0.008 ms.
- **In the browser** (`critic/c7_j_3371.json`, alone):
  - Years 28 and 29 at Max take 46 and 45 s. The date stops 52 and 51 times for over 0.5 s (720 to 840 ms) and the
    frame rate falls to 29.5 and 20.1 fps.
  - Year 30, with 2 such stalls, takes 8 s at 55 fps.
- **AoC does better:** it runs smoothly for centuries (text, frames).
- **Fix:** see R7-B2.

### Stability: 7

- **Tested:**
  - 13 browser sessions (A to M, I2).
  - Four 30-year headless runs.
  - Two checkpoint continuations.
  - The browser against headless on seed 1207 for 12 years.
  - A save and load twin.
  - A headless year-27 save loaded into the page.
- **Evidence:**
  - `critic/c7_h_1207.json`: 12 of 12 year-end hashes are the same in the browser and the headless runner
    (562f076b … 2961ecfe). The save and load twin is the same 30 days on (3156891156 both).
  - `critic/c7_j_3371.json` (`loaded.hash` 2989195952 = b22b82b0, the headless year-27 hash).
  - `critic/c7_perf_3371_y15_30_solo.log` against `critic/c7_headless_3371.json`: a run continued from the year-14
    save gives the straight run's hash in each of years 15 to 30.
  - `errors` in every `critic/c7_*.json`: 0 page errors and 0 console errors or warnings in the player's own steps.
- **Why 7 and not 8:**
  - No crash, freeze or desync in about 4 hours of play and 120 simulated years, and replay is bit-exact across
    runtimes and loads. That is strong evidence of parity.
  - I have nothing showing that AoC is less stable (text only), so I cannot claim better.
  - This run found two bugs: the air zone over Warsaw "held by Yugoslavia" and the 0.7 to 0.8 s stalls of R7-B2.
  - A save is 39.4 to 40.0 MB (`c7_h_1207.json` `twin.bytes`; `critic/c7_seed3371_y27.bin`).
- **Fix:** the bugs above; a smaller save.

### Semantic zoom to unit level: 6 (needs 8)

- **Tested:**
  - Germany against Poland and France on seed 7781: an infantry fight and an armoured division in contact, at 3,000,
    900, 250, 80, 25 and 10 m/px, live.
  - Berlin before and after a bomb.
  - The L map's ladder.
- **Evidence:** `critic/c7_d_7781.json` (`views`), `critic/shots/c7d_7781_inf_0250m.png`, `c7d_7781_inf_0025m.png`,
  `c7d_7781_inf_0010m.png`, `c7d_7781_arm_0080m.png`, `c7d_7781_arm_15m_live_1.png`, `c7d_7781_arm_0010m_crop.png`,
  `c7g_L_3119_1_berlin_0100m.png`.
- **Good:**
  - The hand-over is continuous: 516 elements at 250 m/px, then 3,146 men at 25 m/px.
  - Men stand in files, tanks as top-down hulls, with tracer lines between the sides.
- **Bad:**
  - At 10 to 25 m/px the two sides are clumps of tiny sprites that run into one another. The front line between them
    cannot be read (`c7d_7781_arm_15m_live_1.png`).
  - A city nuked for a million dead is unchanged at T2 and T3 (`c7k_8217_03_berlin_150_day10.png`).
  - Ships at 15 m/px are flat coloured bars (`c7e_9043_1_0015m.png`).
- **AoC has no counterpart.** To reach 8, a fight at T3 must read as two sides with a line between them, and a struck
  city must show it.

### Naval warfare: 5 (needs 8)

- **Tested:** Germany on the United Kingdom (seed 9043). The ticker's "Sea battle" row was clicked, then the battle
  point was viewed at 2,500, 600, 150, 40 and 15 m/px, live.
- **Evidence:** `critic/c7_e_9043.json` (`seaBattles`, `views`), `critic/shots/c7e_9043_01_row_live.png`,
  `c7e_9043_1_0150m.png`, `c7e_9043_1_0015m.png`.
- **What I saw:**
  - The row frames the North Sea at 668 m/px with a dashed circle 24 cells in radius, and fleets as counters.
  - At the battle's own point only the British "Carrier group 1063" is present at 150 and 15 m/px. The nearest
    German ships, a submarine flotilla and a cruiser squadron, are far off the screen's centre, and no gunfire shows.
  - The ships are 8 flat red bars.
- **Missing:** SLBMs deliver nothing, and the editor cannot place fleets.
- **AoC has no navy.** To reach 8, a sea battle's row must land on both fleets firing, and ships at T3 must look like
  ships.

### Tanks: 5 (needs 8)

- **Tested:** German armoured divisions in contact on day 3 (seed 7781) at every tier, live.
- **Evidence:** `critic/c7_d_7781.json` (`picks.arm`), `critic/shots/c7d_7781_arm_0010m.png`,
  `c7d_7781_arm_0010m_crop.png`, `c7d_7781_arm_15m_live_1.png`.
- **Good:** the hulls are distinct from men in a 3× crop, and the AI uses armour in the first days of a war.
- **Bad:**
  - At 10 m/px a tank is about 8 px, all the same grey, set out in a loose grid with no formation or facing.
  - `wrecks` read `null` at every tier, so I saw no wreck.
  - Nothing tells armour from infantry at T2 except the counter's text.
- **AoC has no tanks.** To reach 8, tanks must be larger and read as a formation with a facing, tinted by side, and
  leave wrecks.

### Aircraft: 5 (needs 8)

- **Tested:**
  - Sorties drawn at each tier during the war on Poland.
  - The air mode and its hover on day 10.
  - Four 30-year runs.
- **Evidence:** `critic/c7_d_7781.json` (`views`), `critic/c7_m_8217.json`, `critic/shots/c7k_8217_05_air_mode.png`,
  `critic/c7_headless_*.json` (`meanSortiesAloft`).
- **Seen:** 37 to 45 sorties are drawn at 3,000 m/px, 9 to 10 at 900, and 0 to 2 at 10 to 25 m/px.
- **Bad:**
  - The air war fades on every seed: 32 to 38 aloft in year 1, then 0 to 20 from year 8 on (user-accepted, R5-B2).
  - The air zone over Warsaw and Kiev is "held by Yugoslavia" during Germany's invasion of Poland, and Germany holds
    "1 zones".
  - No warhead was carried by air in 420 AI world-years: all 4 AI strikes were by missile (`critic/c7_headless_q4.json`,
    `critic/c7_headless_q5.json`, `nukeLog`).
- **AoC has no air war.** To reach 8, the air zone's holder must be someone fighting there, and the air war must last
  beyond year 1.

### AI nuclear use: 3 (needs 8)

- **Tested:**
  - 14 unaided 30-year worlds: seeds 1 to 10 (the builder's PLAN 7.3g sweep seeds), 3371, 8803, 1207, and 6619 (the
    builder's PLAN 6.12 seed).
  - The nuclear techs of each nation at year 14 of 3371.
  - A God-set case, France with 6 warheads fighting to the death against a buffed Germany, run 150 days and again for
    90 days with its aircraft recorded.
  - The same case with ballistic missiles granted, run 90 days.
- **Evidence:**
  - `critic/c7_headless_q1.json` to `critic/c7_headless_q10.json` and `critic/c7_headless_{3371,8803,6619,1207}.json`
    (`ev.NukeDecided`, `nukeLog`, `warheads`).
  - `critic/c7_techs_3371_y14.log` (from `critic/scripts/c7_techs.ts`).
  - `critic/c7_f_2604.json`, `critic/c7_f_2604_air.json`, `critic/c7_f_2604_m.json`.
  - `critic/shots/c7f_2604_day150.png`, `critic/shots/c7f_2604_m_day90.png`.
  - The builder's `docs/evidence/7.3/quick-7.3g.md` for comparison.
- **Unaided:**
  - Strikes in 2 of 14 worlds, 4 decisions and 4 bursts in 420 world-years.
  - At the end the worlds hold 132 to 156 warheads among 4 to 6 nations.
  - At year 14 of 3371, Germany, Italy, the United Kingdom and the United States know atomic bombs, rocketry and
    ballistic missiles.
  - On seeds 1 to 10 the builder's own sweep at PLAN 7.3g (ADR-439) had strikes in 4 of 10 seeds and 21 decisions
    (seeds 4, 5, 7, 9). At HEAD the same seeds give 2 of 10 and 4 decisions (seeds 4 and 5). The pin has moved since
    (7.3e and 7.4f31/f32), so these are not the same worlds, but the rate has halved. Seed 6619 had 5 decisions at
    PLAN 6.12 and has 0 at HEAD, again in a world changed since.
- **The strikes that happen are still not credible** (`nukeLog`):
  - Seed 4: the Soviet Union strikes the same point in the Netherlands (cell 1052, 269) in year 14 (734,042 dead) and
    again in year 15 (566,582). No one answers.
  - Seed 5: the Soviet Union strikes South Africa twice in year 26 (11,183 and 20,678 dead).
  - All 4 strikes in 14 worlds are by the Soviet Union, and none is answered.
- **God-set case without missiles:**
  - Every metropolitan city of France is under German occupation by day 150 (`c7f_2604_day150.png`).
  - France fights to the death with 6 warheads and its army falls from 582k to 96k. It never strikes.
  - Its air force falls from 315 aircraft to 50 by day 10 and 0 by day 40 (`c7_f_2604_air.json`). After that it has
    no bomber to deliver with, which is correct. While it had aircraft it did not strike either.
- **The same case with missiles:** one strike, on Berlin at day 41 (`alerts`). Then nothing for 49 days, with 5
  warheads left, fighting to the death, the country occupied.
- **Why 3:** a player will see an AI strike in about one game in seven, two strikes in 30 years, and those make no
  sense of escalation or retaliation. AoC has no AI nukes, but this dimension needs 8 and the feature must be seen and
  believed.
- **Fix:** see R7-B1.

## Blocking issues, in priority order

1. **R7-B1. AI nuclear use is too rare to be seen, and still not credible.**
   - Strikes in 2 of 14 unaided 30-year worlds, 4 in 420 world-years, while 4 to 6 nations hold 132 to 156 warheads
     and ballistic missiles.
   - On seeds 1 to 10 the builder's PLAN 7.3g sweep had 4 of 10 seeds and 21 decisions; at HEAD it is 2 of 10 and 4.
   - All 4 strikes are by the Soviet Union: on the same Dutch point a year apart (734,042 and 566,582 dead) and twice
     on South Africa. None is answered.
   - God-set to the extreme case (France overrun, fighting to the death, 6 warheads, missiles), France strikes once
     and then holds 5 warheads for 49 days.
   - Evidence: `critic/c7_headless_q1.json` to `critic/c7_headless_q10.json`, `critic/c7_headless_q4.json`,
     `critic/c7_headless_q5.json`, `critic/c7_headless_3371.json`, `critic/c7_headless_8803.json`,
     `critic/c7_headless_6619.json`, `critic/c7_headless_1207.json`, `critic/c7_f_2604_m.json`,
     `critic/c7_f_2604_air.json`, `docs/evidence/7.3/quick-7.3g.md`.
   - **Fix:**
     - Find why the rate halved since 7.3g. Check the stockpile cap, the threat test 6.12a/f, and desperation in real
       wars.
     - Make a nuclear power losing a war for its life reach for the bomb in a visible share of games.
     - Aim at the enemy at the front or its core, not twice at one Dutch city a year apart or at South Africa.
     - Let the struck answer.
     - Let a nation that struck once and keeps losing strike again.
2. **R7-B2. Late-game stalls in the invasion AI.**
   - The system is `invasionAi` (`src/sim/ai/invasion.ts`): the daily landing plan of a nation at war with no land
     front. In 1967 the only war on the map is Poland against Denmark, a war with no land front
     (`c7j_3371_2_year2.png`).
   - Seed 3371 from its year-14 save, pinned and alone: `invasionAi` costs 86 % of the tick in years 28 and 29.
     That is about 50 calls a year of 300 to 772 ms, and a mean tick of 4.7 ms against a 95th percentile of 1.3 ms.
   - In the browser at Max those years take 45 to 46 s, with about 52 stops of 0.72 to 0.84 s and 20 to 30 fps. The
     next year, without them, takes 8 s at 55 fps.
   - It also shows in 1207 (max ticks of 317 to 330 ms in years 23 and 24) while 1 to 3 wars run.
   - Evidence: `critic/c7_perf_3371_y15_30_solo.log`, `critic/c7_j_3371.json`, `critic/shots/c7j_3371_2_year2.png`,
     `critic/c7_headless_1207.json`.
   - **Fix:**
     - Profile the slow `invasionAi` calls in a war with no land front (Poland against Denmark in 1967 here). Their
       cost grows with the years and with the formations: 1,070 at year 15, 1,459 at year 30.
     - Cache or bound the landing search.
     - Hold the late-game tick to budget, not only seed 99's year 1.

## Non-blocking issues

- **The late world is quiet on some seeds.** Seed 3371 changes 0.72 % of its land (by cells) in its last 5 years,
  under the builder's 1 % `moving` limit, with 0 to 2 wars. Seeds 2, 4 and 7 have one war a year at the end. Germany
  holds 35.5 % of the held cells at the end of 1207, about the 35 % limit (approximate). The other 13 seeds move 2.5 to
  41 % (`critic/c7_headless_3371.json`, `critic/c7_headless_q*.json`).
- **Static giants.** Canada and Denmark (Greenland) hold the same land for 30 years on most seeds.
- **A nuked city leaves no mark.** Berlin is unchanged at 150 and 20 m/px ten days after 1,025,202 dead
  (`critic/shots/c7k_8217_03_berlin_150_day10.png`).
- **The God nuke is atomic only, with no size.** `hud.ts:552` sends `thermonuclear: false`.
- **A played nation cannot launch its warheads.** No UI sends `launchNuke`.
- **No nuclear line in the nation panel or the charts** (`critic/c7_k_8217.json`).
- **God tools are hidden.** They sit behind the nation panel's "God" tab, and the map tools are below the fold at
  1600 × 900 (`critic/c7_c2_4419.json`, `panelScroll`; `critic/shots/c7c_4419_00_godmode_on.png`).
- **A sea battle's point shows one side.** Only one British carrier group is there, and ships are flat bars at
  15 m/px (`critic/shots/c7e_9043_1_0015m.png`).
- **The air mode gives Poland's air to Yugoslavia.** It says "held by Yugoslavia" over Warsaw and Kiev during
  Germany's invasion. The legend also says "1 zones" (`critic/c7_m_8217.json`).
- **The AI's air war fades after year 1** (user-accepted).
- **"Pseudo-locale (i18n test)" in the language list.**
- **The phone's nuke alert** covers the panel, and the bottom bar is cut (`critic/shots/c7k_8217_12_phone.png`).
- **The nuke alert stays up for 10 days of play.**
- **One atomic bomb kills about a million.** Berlin 1,025,202; Warsaw 556,000.
- **A save is about 40 MB.**
- **The editor cannot place warheads, fleets or wings.**
- **A scenario file starts at once.** Choosing it on the title starts the game with no confirmation.
- **Tanks and men are tiny and intermixed at T3.** No wrecks were seen (`critic/shots/c7d_7781_arm_15m_live_1.png`).
- **The builder's open questions** (ADR-460):
  - I did not see the "Soviet stripes" in my 1967 world (`critic/shots/c7j_3371_3_world_end.png`).
  - I did not see N17, the black smear under a counter.

## Strengths, verified

- **Determinism.**
  - The browser game and the headless runner agree at every year's end for 12 years.
  - A save and load twin matches.
  - A headless year-27 save loads into the page on the right hash.
  - The pin `b2dc23b4` holds (`critic/c7_h_1207.json`, `critic/c7_perf_seed99_5y_solo.log`).
- **The early game now looks and handles like AoC.**
  - Names, flags, a ranking with bars and framed panels.
  - Escape and the number keys work.
  - God Mode has Recolor, Donate, Annex, Fight to the death, Spawn nation and Kill.
  - Evidence: `critic/shots/c7a_5527_02_boot.png`, `critic/shots/c7c_4419_02_god_tab.png`.

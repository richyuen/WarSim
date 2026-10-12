# Critic report, run 4

- Commit: `5e91a569bd867bf6e3fcaa105e8fcb9406467e44` (Phase 4, naval, ticked by PLAN 4.8).
- Date: 2026-10-12. Build: `npm run build`, exit 0 (`critic/c4_build.log`); served with `vite preview` on port 5299.
- Machine: this container, 4 cores, 15 GB, **no GPU**. Chromium 141 through Playwright with SwiftShader (CPU WebGL),
  1600 × 900 unless stated. Frame rates and browser speeds measured here are not those of a player's machine; I
  give them with low confidence and lean on the headless Node measurements, which match the builder's own
  numbers for this container (seed 99, year 1: 10.44 ms a tick here, `critic/c4_perf_seed99_solo.log`; the
  builder logged 9.96 to 11.06 ms).
- Every path below was made in this run (prefix `c4`). Scripts: `critic/scripts/c4_*.mjs` and `critic/scripts/c4_*.ts`.
  The scripts, JSON and logs are committed with this report; the 41 MB of screenshots in `critic/shots/` are not
  (as in runs 2 and 3) and stay in the working tree of this run's container.
- Seeds I chose, none in the builder's seen list: 6131, 2207, 3889, 5303, 9157, 5150. Seed 4604 only to rerun the
  builder's own naval demo.
- `reference/` is not in this container at all (no frames, no NOTES.md). Every AoC comparison is from the text
  sources summarised in `docs/PARITY.md` and from my previous runs' reading of the frames. Confidence in
  comparisons: medium to low.

## Verdict

Phase 4 turned naval warfare from nothing into a working system: 190 fleets at the start, sea battles from the
first days of a war, sea control, convoy raids, a build list with fleets, fleet orders by the mouse, and AI
landings. That is real and moves naval from 0 to 4. It is not yet something a player watches or uses: at the
strategic zoom a fleet is an army counter, a sea battle at the close zoom is a few pills on blue water, the
player's own invasion fails without a word, and after year 8 the AI almost stops landing anywhere (87 landings
in 30 years on seed 5303; Australia and Brazil hold exactly the same land for all 30). Air and nuclear still do
not exist, so two of the five differentiators are 0 and the game cannot be better than AoC. Of the six run 3
blockers, two are fixed (wars within one realm; a watcher told nothing), two are partly fixed (navy; the close
zoom) and two stand or are worse (statelet spam; the tick).

## Scores

| Dimension | Run 3 | Run 4 |
|---|---|---|
| Map visuals and readability | 6 | 6 |
| Diplomacy, war, alliance, puppet, revolt depth | 5 | 6 |
| Emergent world dynamics over long runs | 4 | 5 |
| God Mode | 6 | 6 |
| Editor and scenarios | 6 | 6 |
| Stats and history | 5 | 5 |
| UI/UX and polish | 5 | 5 |
| Performance | 5 | 4 |
| Stability | 7 | 7 |
| Semantic zoom to unit level (needs 8) | 6 | 6 |
| Naval warfare (needs 8) | 0 | 4 |
| Tanks (needs 8) | 5 | 5 |
| Aircraft (needs 8) | 0 | 0 |
| AI nuclear use (needs 8) | 0 | 0 |

No score is above 7.

## What happened to the run 3 blockers

| Run 3 id | Now | Evidence of this run |
|---|---|---|
| R3-B1 no navy, air, nukes; Americas still | Navy exists; air and nukes do not; the Americas, Australia and Brazil still barely move | `critic/c4_headless_5303.json` (190 to 314 fleets, 193 sea battles, 87 landings in 30 years; Australia 4.03 % of cells in all 30 years, Brazil 3.71 to 3.88 %); `critic/c4_e_9157.json` (`nuke`, `launchNuke`, `nuclearStrike`, `airStrike`, `spawnAirWing` refused as unknown kinds) |
| R3-B2 statelet spam | Not fixed, worse | Seed 5303: 94 nations alive in year 1, 183 in year 30; 112 of the 183 are nations founded in play; 245 founded in all (`critic/c4_headless_5303.json`). Browser seed 3889: 28 "Free X" nations alive after 8 years (`critic/c4_d_3889.json`) |
| R3-B3 the close zoom shows no battle | Partly fixed on land | Both sides now stand in one T3 view: at 8 m/px on three engaged German formations, 28/22, 28/28 and 52/48 German/Polish elements in view (`critic/c4_e_9157.json`, `zoom`; `critic/shots/c4e_10_landfight_f4_8m.png`). At sea the same complaint holds (see Naval) |
| R3-B4 wars within a realm | Fixed | 0 wars between allies or between nations with one overlord, checked in every one of 30 years on seed 5303 (`critic/c4_headless_5303.json`, `friendlyCount`) |
| R3-B5 slow Max, tick over budget | Worse | See Performance |
| R3-B6 a watcher told nothing | Fixed | A ticker of major events (403 rows over 8 years, `critic/c4_d_3889.json`, `ticker`) and sound cues (308 sounded, `sound`); visible in `critic/shots/c4d_50_europe_end.png` |

## Dimensions

### Map visuals and readability: 6

- Tested: boot, the world, a ladder of nine scales over the Home Fleet at Scapa Flow, all nine map modes, the sea
  control mode in two theatres during a war, the map after 8 and 30 years.
- Evidence: `critic/shots/c4a_01_boot.png`, `critic/shots/c4a_10_ladder_home_*.png`, `critic/shots/c4a_20_mode_*.png`,
  `critic/shots/c4b_50_northsea_seacontrol_day75.png`, `critic/shots/c4b_52_pacific_seacontrol_day75.png`,
  `critic/shots/c4d_50_europe_end.png`, `critic/shots/c4a_11_crop_scapa_counter_4000m.png`,
  `critic/shots/c4a_12_crop_army_counter_4000m.png`.
- The 1938 start is still clean: curved names, flags, counters.
- At the strategic zoom a fleet cannot be told from an army. The Home Fleet at Scapa Flow is a counter with a
  Union Jack and "45.1k", the same box as the army counter "12.5k" in Scotland (`c4a_11`, `c4a_12`). The ship
  marker appears only from about 1,500 m/px.
- The sea control mode paints whole zones in flat blocks with stair-step cell edges; the colours sit next to the
  land's political colours, so a brown or maroon zone in the North Sea cannot be read as any one navy, and the
  legend names no nation (`c4b_50`, `c4b_52`).
- After 8 years Spain, the Balkans and central Europe are a quilt of "Free X" slivers again (`c4d_50`).
- AoC does better (text and run 3 frames): its long runs end in large blocks; its map has no sea layer to misread.
- Fix: a ship glyph on naval counters at T0, and men or ships counted apart; a navy's colour key in the sea mode,
  smoothed zone edges.

### Diplomacy, war, alliance, puppet, revolt depth: 6

- Tested: God-declared wars on seeds 6131, 2207, 9157 and 4604, an AI world for 30 years (seed 5303) and 8 years
  in the browser (seed 3889).
- Evidence: `critic/c4_headless_5303.json`, `critic/c4_b_6131.json` (`warsDay`), `critic/c4_c_2207.json` (`history`),
  `critic/shots/c4c0_20_fleet_order.png`.
- Better than run 3: no war inside one alliance or realm in 30 years (R3-B4). A declaration pulls in alliances
  sensibly (Germany on the UK brings in Italy and Japan; the UK brings 29). Navies add blockades and convoy raids
  (1,618 raids in 30 years).
- Worse or unchanged: a war of 6 against 30 still ends in a flood of statelets; 480 revolts in 30 years.
- The history repeats one fight as many: "A major battle began near Geneva" / "was won by Italy" nine times in
  three weeks (`c4_c_2207.json`, `history`); "China captured Mengjiang's capital" three times in a month
  (`c4_d_3889.json`, `ticker`).
- AoC does better (text): fewer, decisive wars that end in annexation.
- Fix: see R4-B3.

### Emergent world dynamics over long runs: 5

- Tested: 30 years headless on seed 5303; 8 years in the browser at Max on seed 3889.
- Evidence: `critic/c4_headless_5303.json`, `critic/c4_headless_5303.log`, `critic/c4_d_3889.json`,
  `critic/shots/c4d_102_world_year2.png` to `c4d_108_world_year8.png`.
- Better than run 3: there are now risers and fallers. Seed 5303: Japan rises from 0.3 % of cells to 9.0 % by
  year 20 (it takes China, which falls from 4.5 % to 0.7 %); France from 1.7 % to 8.0 %; Germany is dead by
  year 10; the Soviet Union falls from 27.7 % to 9.3 % and comes back to 11.6 %. Seed 3889: France reaches 12.2
  million km², second on earth, by taking North Africa (`c4d_108_world_year8.png`).
- Against that: Australia holds 4.03 % of cells in every one of 30 years, Brazil 3.71 to 3.88 %, Denmark
  (Greenland) 5.4 %; on seed 3889 the United States and Canada hold 7.0 % and 6.8 % of the land in every one of 8
  years. The navies grow from 190 fleets to 314 and land fewer and fewer armies: 12, 9, 5, 8, 4, 7, 10 landings in
  years 1 to 7, then 0 to 4 a year, 13 in the last 22 years together.
- 245 nations are founded in 30 years; 183 are alive at the end against 94 at the start (R3-B2, worse).
- The AI's movement orders are refused 97,165 times in 30 years (`MoveRejected`, 3,200 a year), a sign of AI
  orders that cannot be carried out.
- AoC does better (run 3 frames, text): a few empires by the end.

### God Mode: 6

- Tested: the God tab on France, its buttons, commands for a nuke and an air strike.
- Evidence: `critic/c4_f.json` (`godButtons`), `critic/shots/c4f_00_god_tab.png`, `critic/c4_e_9157.json` (`errors`).
- Rename, income, AI off, world AI, war, ally, puppet, leave alliance, buffs, revolt, breakthrough, territory,
  revive, kill. Nothing was added for Phase 4: no fleet, no sea control, no blockade tool.
- Missing against AoC (text, run 3 frames): Nuke, Annex (only in the editor), Recolor, Fight to the death (the
  sim has `setWarFightToDeath`; the tab has no button), Donate.

### Editor and scenarios: 6

- Tested: the editor opens with brush, line, bucket, nation and terrain layers (`critic/shots/c4e_30_editor.png`,
  `critic/c4_e_9157.json`, `editorText`); the title screen (`critic/shots/c4a_00_title.png`).
- Not re-tested in depth this run; run 3 found it working. Still one map, one start year, no naval editing (ports,
  fleets). The scenario file sets `"nukesEnabled": true` (`data/scenarios/1938/scenario.json`) for a game with no
  nuclear weapons, and the title screen offers no such toggle.

### Stats and history: 5

- Tested: the ranking at boot and later, history after 1 to 8 years, the ticker, chart button.
- Evidence: `critic/shots/c4a_01_boot.png`, `critic/shots/c4c0_20_fleet_order.png`, `critic/c4_e_9157.json`
  (`god.panelText`, the DOM of the ranking), `critic/shots/c4c0_30_history.png`, `critic/shots/c4d_62_history.png`.
- The ranking shows the wrong number beside a name from row 11 down, on every screen from boot. Row 11 "French
  Equatorial Africa" is long enough to push its float-right value to the next line, so each value below is drawn
  one row low and two numbers collide in row 13: "Argentina 2,778,7282,806,758", and a 16th line holds a bare
  number. The ranking says the United Kingdom has 2,917,557 km²; the United Kingdom's own panel says 2,806,758
  (`c4c0_20_fleet_order.png`, both on screen). The DOM order is right (`c4_e_9157.json`); the drawing is not. The
  builder's own evidence picture shows it (`docs/evidence/4.7/naval-demo-t3.png`). See R4-B6.
- New and good: a ticker of major events, clickable, as asked in run 3.
- Sea battles read "United Kingdom lost 1 ships"; 1,690 events in 8 years, a third of the newest of them convoy
  raids by four navies on "Free Valencia" (`c4_d_3889.json`, `historyHead`).
- AoC does better (text): a smaller history of major events.

### UI/UX and polish: 5

- Tested: player control of the United Kingdom by the mouse, the Actions tab, keys (F2, M, Escape), hover, a
  phone-width window.
- Evidence: `critic/c4_a.json`, `critic/c4_c_2207.json`, `critic/c4_c_2207_land.json`, `critic/shots/c4c0_00_actions_tab.png`,
  `critic/shots/c4f_10_phone_390.png`.
- New: sound cues (war, peace, capital, death); a build list with fleets, priced and gated by port.
- A move order that the sim refuses is silent. `MoveRejected` is emitted by the sim and read by nothing in
  `src/app` or `src/ui` (grep). A player who clicks the sea or an unreachable coast sees nothing happen
  (`c4_c_2207.json`, `afterOrder`, `refusalText` empty). See R4-B2.
- Escape still closes no panel; F2 and M change no map mode (`c4_a.json`, `panelAfterEsc`, `afterF2`, `afterM`).
  Hover tooltips exist only on war banners (`titleAttrs`).
- At 390 × 844 the nation panel, the ranking and the top bar overlap and the bottom bar runs off the screen
  (`c4f_10_phone_390.png`).
- A war banner jump to Spain at 474 m/px shows about 30 dashed order lines crossing the view
  (`critic/shots/c4e_20_after_banner_click.png`).

### Performance: 4

- Tested: headless ticks alone (seed 99 year 1; seed 5303 24 years, see below), the same with a browser beside
  it, Max speed in the browser for 40 minutes.
- Evidence: `critic/c4_perf_seed99_solo.log`, `critic/c4_perf_5303_24y_solo.log`, `critic/c4_headless_5303.log`,
  `critic/c4_perf_profile_7717.log`, `critic/c4_d_3889.json`.
- The tick is over its budget and has grown with Phase 4. The builder's own measurement here: 7.30 and 6.72 ms
  against 5.85 ms before Phase 4 and an allowance of 6.53 ms (PROGRESS, PLAN 4.8i). My seed 99, year 1, alone:
  10.44 ms (the builder: 9.96 to 11.06).
- The tick grows with the game's age. Seed 5303 alone, nothing else running: 5.34 ms a tick in year 5, 11.1 in
  year 8, 16.1 in year 9, 17.6 in year 20, 21.2 in year 21 and 21.8 in year 23; the 95th percentile from 21 ms
  to 140 ms (`critic/c4_perf_5303_24y_solo.log`; I stopped it during year 24). Four times the year-5 cost by year 21, three times the
  container's allowance of 6.53 ms. A simulated year that takes 47 s here in year 5 takes 191 s in year 23.
  Nothing in this rises the way the tick does: formations are 1,170 in year 5 and 972 in year 23; nations 134 and
  167; fleets 228 and about 290 (`critic/c4_headless_5303.json`).
- Determinism held: my own script and `npm run sim` reach the same hash in years 1, 10, 20 and 23 of seed 5303
  (`23caf0a9` ... `893d9036`; `critic/c4_headless_5303.json` against `critic/c4_perf_5303_24y_solo.log`).
- The profile of seed 7717's first year: combat 37 %, the operational AI 15 %, movement 13 %; the naval
  systems together about 0.8 ms of 11.0 (`c4_perf_profile_7717.log`). The operational AI's longest call is 221 ms
  in year 2: a stall in the browser at Max.
- In the browser at Max (no GPU, SwiftShader, with a headless run beside it): 230 to 335 s a simulated year,
  8 years in 40 minutes (`c4_d_3889.json`). Low confidence: a GPU machine is faster; run 3 measured 15 to 28 s
  on one.
- AoC does better (text): decades in minutes.

### Stability: 7

- Tested: eight browser sessions (A to F, B2, B3), four headless runs, a 30-year run.
- Evidence: `errors` in `critic/c4_a.json`, `c4_b_6131.json`, `c4_b3_4604.json`, `c4_b3_6131.json`, `c4_c_2207.json`,
  `c4_c_2207_land.json`, `c4_d_3889.json`, `c4_e_9157.json`, `c4_f.json`.
- No page error, crash or console error in any session, only SwiftShader's "GPU stall due to ReadPixels" and the
  unknown-command warnings I provoked.
- Two of my own scripts timed out on the bottom bar while the page was busy at speed (B2's pause button), which
  says the UI thread is starved at speed on this machine, not that the game broke.

### Semantic zoom to unit level: 6 (needs 8)

- Tested: the ladder over a fleet at rest (4,000 to 2 m/px); land fights at 300, 40 and 8 m/px on three engaged
  German formations; sea battles at 40, 15, 12 and 4 m/px on four seeds; a sea battle watched running at speed ×1.
- Evidence: `critic/shots/c4a_10_ladder_home_*.png`, `critic/c4_e_9157.json`, `critic/shots/c4e_10_landfight_f4_8m.png`,
  `critic/shots/c4e_12_landfight_f15_40m.png`, `critic/c4_b_6131.json`, `critic/c4_b3_4604.json`,
  `critic/shots/c4b3_s4604_15m_best.png`, `critic/shots/c4b2_1_live_best_60m.png`.
- Better on land: both armies in one view at 8 m/px, lines of infantry facing each other across the border
  (`c4e_10_landfight_f4_8m.png`). Still a parade lattice of identical blocks.
- At sea the close zoom is thin. A battle squadron of 13.4k men at 15 m/px is twelve pills 5 to 15 px long in a
  three-column lattice (`c4a_10_ladder_home_00015m.png`). The builder's own demo battle at its best moment (17
  shots, flashes and splashes in the frame) is five ships and two dark ovals in an empty sea
  (`c4b3_s4604_15m_best.png`; the same as `docs/evidence/4.7/naval-demo-t3.png`). In the battle my own war started
  (Germany on Britain, Japan on the United States, seed 6131) the camera on the engaged fleet's position showed
  nothing firing in 14 sampled hours, and at hours 2, 8 and 11 no ship at all (`c4_b_6131.json`, `battles`:
  `fx` 0 throughout, `el` 0 at 4 and 12 m/px). Watched running at speed ×1, the tags stood 300 to 600 px from
  the ships they name and nothing fired for 32 sim hours (`c4b2_1_live_best_60m.png`, `critic/c4_b2_6131.json`).
- Fix: see R4-B4.

### Naval warfare: 4 (needs 8)

- Tested: 197 fleets at start; wars at sea on seeds 6131, 2207, 4604; sea control; the build list; the player's
  fleet order by the mouse; the player's invasion by the mouse and by two orders; 30 years of the AI.
- Evidence: `critic/c4_a.json` (`fleetCount` 197), `critic/c4_b_6131.json`, `critic/c4_c_2207.json`,
  `critic/c4_c_2207_land.json`, `critic/c4_landing.log`, `critic/c4_headless_5303.json`,
  `critic/shots/c4b_11_battle_T1_1000m.png`, `critic/shots/c4c0_20_fleet_order.png`, `critic/shots/c4c0_30_history.png`.
- Real: fleets of seven ship types at named bases; sea battles start within two days of a war; sunk ships in the
  history; sea control per zone; convoy raids; fleets built in the Actions tab ("no port" for Switzerland). A fleet
  ordered by the mouse sails along a drawn way and engages: Battle squadron 1062 from Portsmouth reached the
  Heligoland Bight in 24 h and fought (`c4_c_2207.json`, `fleetTrack`).
- The player cannot invade. A UK division selected at Southampton and ordered by a click onto German land at
  Bremerhaven, with two transport groups 6.5 cells away at Portsmouth, does nothing for 20 days and says nothing
  (`c4_c_2207_land.json`, `track`, `refusalText` empty). The rule is that the division must first stand within 3
  cells of its port's water; nothing on screen says so. Given the two orders in Node it embarked, sailed to the
  German coast and back, and after 5 days landed in Kent, its own country, again without a message
  (`critic/c4_landing.log`). See R4-B2.
- The AI's invasions dry up: 87 landings in 30 years, 12 in year 1 and 0 to 4 a year after year 7; Australia,
  Brazil and Greenland never change hands (`c4_headless_5303.json`).
- Fleets are never laid up for want of money (0 `FleetsLaidUp` in 30 years) and grow from 190 to 314.
- Outcomes are odd for 1938: in the first three weeks of Germany's war on Britain (seed 2207) the Royal Navy lost
  19 ships to Germany's 14 and France lost 11 to Italy's 0 in one battle (`c4_c_2207.json`, `history`); over 30
  years of seed 5303 Italy sank 165 ships and lost 97, the most of any navy. A carrier has no weapon in a sea
  battle (ADR-256, by design until Phase 5).
- At the strategic zoom a fleet looks like an army (Map visuals), and at the close zoom like a few pills (Zoom).
- AoC has no navy (text: its armies cross water on painted crossings), so any working navy is an addition; the
  bar is 8, "clearly better", and a player cannot yet use or enjoy this one.

### Tanks: 5 (needs 8)

- Not the focus of this run. German and Polish armour on seed 9157: tank brigades drawn as hull sprites in the
  same block lattice (`critic/shots/c4e_12_landfight_f15_40m.png`); no wreck counted in 4 views (`c4_e_9157.json`,
  `wrecks` 0). Unchanged from run 3.

### Aircraft: 0 (needs 8)

- Nothing exists. `airStrike` and `spawnAirWing` are refused as unknown kinds (`critic/c4_e_9157.json`). Nations
  still research the nine air techs of `data/tech/air.json` and pay for them; the trait "Air-minded" tells the
  player "Air forces attack and defend better" (`src/ui/i18n/en.json`) when there are no air forces.

### AI nuclear use: 0 (needs 8)

- Nothing exists. `nuke`, `launchNuke` and `nuclearStrike` are refused (`critic/c4_e_9157.json`); the nuclear
  techs are held out of research (`src/sim/systems/research.ts`, `HELD_CATEGORIES`).

## Blocking issues, in priority order

1. **R4-B1. Aircraft and nuclear weapons do not exist: two of the five differentiators are 0.** Evidence:
   `critic/c4_e_9157.json` (`errors`: five air and nuclear commands refused as unknown). Fix: Phases 5 and 6.
2. **R4-B2. A player cannot carry out an invasion, and no refused order is ever shown.** A division ordered by a
   click across the sea does nothing and says nothing; the two-step order that works in Node ends with the
   division landed back in England without a message. `MoveRejected` reaches no UI code. Evidence:
   `critic/c4_c_2207.json`, `critic/c4_c_2207_land.json`, `critic/c4_landing.log`,
   `critic/shots/c4c_11_order_to_germany.png`, `critic/shots/c4c_12_after_20_days.png`. Fix: an order over water
   from anywhere marches to the nearest port with transports, embarks and sails; a refused order says why on screen
   (no transports, no port, sea held by the enemy); a landing that turns back says so in the ticker.
3. **R4-B3. The world still shatters into statelets, more than in run 3.** Seed 5303: 94 nations in year 1, 183 in
   year 30, 112 of them founded in play, 245 founded in all; seed 3889 has 28 "Free X" nations alive after 8 years.
   Evidence: `critic/c4_headless_5303.json`, `critic/c4_d_3889.json`, `critic/shots/c4d_50_europe_end.png`.
   Fix: as run 3 asked (R3-B2): revolts return land to a core owner or neighbour first, weak statelets are
   absorbed, and a run whose living count rises for 20 years fails.
4. **R4-B4. Naval warfare cannot be seen: an army counter at T0, a few pills at T3, often no fire at all.**
   Evidence: `critic/shots/c4a_11_crop_scapa_counter_4000m.png`, `critic/shots/c4a_12_crop_army_counter_4000m.png`,
   `critic/shots/c4b3_s4604_15m_best.png`, `critic/c4_b_6131.json` (`battles`, `fx` 0 in 14 hours),
   `critic/shots/c4b2_1_live_best_60m.png`, `critic/shots/c4b_50_northsea_seacontrol_day75.png`. Fix: a ship glyph
   on naval counters; place both fleets of an engagement inside one T2 view with their tags on their ships; draw
   the guns' arcs, splashes and burning ships large enough to read at 40 m/px; a sea-control legend by navy.
5. **R4-B5. The tick is over its budget and grows with the game.** Seed 5303 alone: 5.34 ms a tick in year 5, 21.2 ms in
   year 21 and 21.8 in year 23, against an allowance here of 6.53 ms (the builder's 1.5 ms on the reference
   machine); p95 from 21 to 140 ms. Phase 4 added 15 to 25 % (the builder's own measure). Evidence:
   `critic/c4_perf_seed99_solo.log`, `critic/c4_perf_5303_24y_solo.log`, `critic/c4_headless_5303.log`,
   `critic/c4_perf_profile_7717.log`, PROGRESS (PLAN 4.8i). Fix: find what grows with age (fleets, nations, the
   AI's 3,200 refused orders a year) and cap or coarsen it; break up the operational AI's 100 to 220 ms calls.
6. **R4-B6. The ranking draws values against the wrong names.** From row 11 down every value sits one row low;
   row 13 shows two numbers run together. It is on screen from the first frame of every game. Evidence:
   `critic/shots/c4a_01_boot.png`, `critic/shots/c4c0_20_fleet_order.png` (ranking UK 2,917,557, UK panel
   2,806,758), `critic/c4_e_9157.json` (`god.panelText`: the DOM is right), `docs/evidence/4.7/naval-demo-t3.png`.
   Fix: `.rank-value` must not float onto the next line: a flex row with the name truncated by ellipsis.

## Non-blocking issues

- Escape closes no panel; F2 and M change no map mode; tooltips only on war banners (`critic/c4_a.json`).
- Phone-width layout overlaps (`critic/shots/c4f_10_phone_390.png`).
- Sea control zones drawn as stair-stepped blocks in colours that collide with land colours (`critic/shots/c4b_52_pacific_seacontrol_day75.png`).
- "lost 1 ships"; one major battle near Geneva logged nine times in three weeks (`critic/c4_c_2207.json`).
- Navies never laid up and grow 190 to 314 fleets in 30 years (`critic/c4_headless_5303.json`).
- Nations research and pay for air techs that do nothing; "Air-minded" promises air forces (`data/tech/air.json`, `src/ui/i18n/en.json`).
- `"nukesEnabled": true` in the 1938 scenario of a game with no nukes (`data/scenarios/1938/scenario.json`).
- 97,165 refused AI move orders in 30 years (`critic/c4_headless_5303.json`, summed `MoveRejected`).
- Order lines of a selected nation clutter the view after a banner jump (`critic/shots/c4e_20_after_banner_click.png`).
- Land at the close zoom is still a lattice of identical blocks; no wreck seen (`critic/shots/c4e_10_landfight_f4_8m.png`).
- My first invasion test aimed at water (cell 1062, 259.5); I reran it at Bremerhaven's land (`c4_c_2207_land.json`). The
  first run's pictures are kept as `critic/shots/c4c0_*.png`; that the click on water was also silent is itself part of R4-B2.

## Strengths, verified

- Naval combat is real and starts on its own: in three runs on two seeds the first sea battle came within 36 to 41 hours of a
  declaration, and a fleet ordered by the mouse sailed a drawn way and fought within a day
  (`critic/c4_b_6131.json`, `critic/c4_b3_4604.json`, `critic/c4_c_2207.json`, `fleetTrack`).
- No war between allies or between one overlord's subjects in 30 simulated years, and no page error in eight browser
  sessions (`critic/c4_headless_5303.json`, `friendlyCount`; the sessions' `errors`).

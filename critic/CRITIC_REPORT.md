# Critic report, run 5

- Commit: `c8503460bdd30f9234a48860de889015ee1177ec` (Phase 5, air, ticked by PLAN 5.8).
- Date: 2026-10-14. Build: `npm run build`, exit 0 (`critic/c5_build.log`); served with `vite preview` on port 5299.
- Machine: the user's Windows machine, 24 threads, NVIDIA GeForce RTX 4070 Ti (ANGLE / D3D11, read from the page's
  WebGL context, `critic/c5_a.json`, `renderer`). Chromium through Playwright, headless, 1600 × 900 unless stated.
  Unlike run 4 (a container with SwiftShader) the browser here has a real GPU, so frame and speed figures are
  a player's, with medium-high confidence. Headless tick figures are pinned with `--affinity 0xFFFF` and run with
  nothing else of mine running; whether this is the exact machine the 1.5 ms budget was set on I infer from
  PROGRESS (2026-10-03, "back on the machine that set the budget") and from seed 99's figures matching that
  machine's order of magnitude: medium confidence.
- Every path below was made in this run (prefix `c5`). Scripts: `critic/scripts/c5_*.mjs`, `critic/scripts/c5_*.ts`,
  `critic/scripts/c5_crop.py`.
- Seeds I chose, none in the builder's seen list: 8317, 7321, 5519, 3307, 4471. Seeds 2207, 6131 and 5303 only to
  re-run run 4's blocker cases under the same conditions.
- `reference/` is present this time: 39 frames, 33 screens and `reference/text/AOC_TEXT_NOTES.md`. AoC comparisons
  below cite them. AoC has no navy and no air war (AOC_TEXT_NOTES lines 419, 680); it does have a nuke as a God
  tool (lines 414 to 418, 449).

## Verdict

Phase 5 added a real air war: 132 wings at the start, sorties that fly along drawn paths, dogfights with tracers,
flak and bomb bursts at T0 to T2, strategic bombing that damages industry, a player's wing orders with a refusal
when out of range, and an air superiority map mode. It moves aircraft from 0 to 4. It does not reach the bar of 8
because a player cannot see it where they look closest, cannot read it on the map, cannot find it in any record,
and because the AI almost stops flying after the first year (mean sorties aloft 19.1 in year 1, 0.2 to 1.8 in
years 13 to 25, while wings grow from 132 to 236). Nuclear weapons still do not exist, so one differentiator is 0
and the game cannot be better than AoC, which has a nuke. Of the six run 4 blockers, two are fixed (refused orders
are told; the ranking), one is half fixed (naval visibility: the sea legend and the fleet counter are good, the
sea battle a player is sent to still shows one side), one improved enough to leave the blocking list (the tick no
longer quadruples with age: × 1.49 from the first five years to the last five) and two stand (statelets; air and
nukes, now nukes only).

## Scores

| Dimension | Run 4 | Run 5 |
|---|---|---|
| Map visuals and readability | 6 | 6 |
| Diplomacy, war, alliance, puppet, revolt depth | 6 | 6 |
| Emergent world dynamics over long runs | 5 | 5 |
| God Mode | 6 | 5 |
| Editor and scenarios | 6 | 6 |
| Stats and history | 5 | 5 |
| UI/UX and polish | 5 | 6 |
| Performance | 4 | 6 |
| Stability | 7 | 7 |
| Semantic zoom to unit level (needs 8) | 6 | 6 |
| Naval warfare (needs 8) | 4 | 5 |
| Tanks (needs 8) | 5 | 5 |
| Aircraft (needs 8) | 0 | 4 |
| AI nuclear use (needs 8) | 0 | 0 |

No score is above 7. God Mode drops a point: the game gained a whole air arm and God Mode gained nothing for it,
and AoC's God tools include the nuke that WarSim still lacks. Performance rises two points, partly because this
run had a GPU (run 4 had none), partly because the tick's growth with age is mostly gone.

## What happened to the run 4 blockers

| Run 4 id | Now | Evidence of this run |
|---|---|---|
| R4-B1 no air, no nukes | Air exists; nukes do not | Air: `critic/c5_b_8317.json`, `critic/c5_headless_7321.json`. Nukes: God tab buttons have no nuke (`critic/c5_f_4471.json`, `godButtons`); `data/scenarios/1938/scenario.json` still says `"nukesEnabled": true` |
| R4-B2 invasion fails silently | Fixed as asked: the outcome is told | The same order as run 4 (seed 2207, a division at Southampton, one click on Bremen): it embarked, sailed to the Weser, turned back and came ashore in Kent, and the ticker said "Infantry division 272: its transports broke off; it came ashore away from its target" (`critic/c5_c_2207.json`, `track`, `newsAfterPatrol`; `critic/shots/c5c_2207_12_day7.png`). A wing ordered beyond range is refused on screen: "Fighter group: not done: it is beyond the range of its aircraft from their base" (`newsAfterFar`) |
| R4-B3 statelets | Not fixed (deferred by ADR-58) | Seed 7321, 25 years: 93 nations alive in year 1, 149 in year 25, 78 of them founded in play, 180 founded in all (`critic/c5_headless_7321.json`). Browser seed 5519: 54 nations with generated names alive after 12 years, "Free Inner Mongolia III" at war (`critic/c5_g_5519.json`, `critic/shots/c5g_5519_50_europe_end.png`) |
| R4-B4 naval cannot be seen | Half fixed | Fixed: the T0 fleet counter has its own frame, a blue border and a hull bar (`critic/shots/c5a_05_crop_scapa_vs_army.png`); the sea control legend names navies with their zone counts (`critic/shots/c5d_2207_30_seacontrol_northsea.png`). Not fixed: see R5-B4 |
| R4-B5 tick grows with age | Much improved; over budget | Seed 5303 pinned, alone: first five years 2.18 ms mean, last five 3.24 ms (× 1.49, PLAN's AT asks ≤ × 1.5); run 4 had × 4 on the same seed. Still 2.86 ms over 25 years against 1.5 (`critic/c5_perf_seed5303_25y_solo.log`) |
| R4-B6 ranking misdrawn | Fixed | Rows 11 to 15 hold their names and values; "French Equatorial Afri…" ellipsised (`critic/shots/c5a_01_boot.png`) |

## Dimensions

### Map visuals and readability: 6

- Tested: boot, the world, Europe and Britain at 4,000 m/px, five map modes, a front at T1 during a war, the map
  after 12 years in the browser.
- Evidence: `critic/shots/c5a_01_boot.png`, `critic/shots/c5a_04_britain_4000m.png`, `critic/shots/c5a_05_crop_scapa_vs_army.png`,
  `critic/shots/c5a_20_mode_airControl.png`, `critic/shots/c5b_8317_10_tier_1000m.png`, `critic/shots/c5b_8317_20_live_l0_1000m_best.png`,
  `critic/shots/c5h_8317_day20_aircontrol.png`, `critic/shots/c5g_5519_50_europe_end.png`.
- Better: the fleet counter at T0 is now distinct from an army's.
- At T1 over the German–Polish front, about 60 dashed yellow order arrows cross the view, many from far outside it,
  and bury the planes, the counters and the border (`c5b_8317_10_tier_1000m.png`, `c5b_8317_20_live_l0_1000m_best.png`).
  Run 4 noted the same after a banner jump; it is now the normal look of any front.
- The air superiority mode is close to blank in a war: on day 20 of Germany's war on Poland, 2 of 515 air zones are
  held by Germany, 0 by Poland, 1 contested (`critic/c5_h_8317.json`, `samples`). Germany's colour is grey, so the
  zones it holds are grey on a grey country and cannot be seen at all (`c5h_8317_day20_aircontrol.png`). The legend
  names no air force (unlike the sea control legend, which now does).
- After 12 years the Balkans and the Baltic are again a quilt of "Free X" slivers (`c5g_5519_50_europe_end.png`).
- AoC does better (reference/screens/steam-screenshot-03.jpg, community-dominated-world-a.png): large blocks with large
  names, no arrows over the map.
- Fix: draw order arrows only for the selected formation or nation; give the air mode a per-nation legend and a tint
  that does not vanish on its own country's colour (hatching or outline).

### Diplomacy, war, alliance, puppet, revolt depth: 6

- Tested: God-declared wars on seeds 8317, 2207, 6131, 3307, 4471; 25 years headless on 7321; 12 years in the
  browser on 5519.
- Evidence: `critic/c5_b_8317.json` (`ticker`), `critic/shots/c5b_8317_10_tier_1000m.png`, `critic/c5_g_5519.json` (`history`),
  `critic/c5_c_2207.json` (`historyTail`), `docs/evidence/5.7/air-demo-t1.png` (the builder's own picture).
- Wars are joined by alliances sensibly; no war between friends (run 4's fix holds).
- Implausible openings: on day 2 of seed 8317 the United Kingdom (+31) declares war on Portugal; Nationalist Spain
  follows on day 6 (`c5b_8317_10_tier_1000m.png`, ticker). The builder's own demo shows "2 January 1938 United Kingdom
  declared war on Netherlands" (`docs/evidence/5.7/air-demo-t1.png`). Switzerland joins the Anglo-French Entente at
  war on day 16 of seed 2207 (`c5_c_2207.json`, `historyTail`, tick 384).
- Revolts dominate the late history: of the 40 newest rows of seed 5519's twelve years (January to March 1950), 11 are
  "rose and joined Free X", "rose and went back to" or "broke away", and four are Free statelets disbanding unpaid
  armies (`c5_g_5519.json`, `history`).
- AoC does better (text, frames): fewer, decisive wars ending in annexation.

### Emergent world dynamics over long runs: 5

- Tested: 25 years headless (seed 7321), 25 years pinned (seed 5303), 12 years at Max in the browser (seed 5519).
- Evidence: `critic/c5_headless_7321.json`, `critic/c5_headless_7321.log`, `critic/c5_g_5519.json`,
  `critic/shots/c5g_5519_101_world_year1.png` to `c5g_5519_112_world_year12.png`, `critic/shots/c5g_5519_61_charts.png`.
- There are risers: France takes Iberia, Italy and Finland by 1950 on seed 5519 (12.9 million km², second on earth);
  the Netherlands holds Berlin (`c5g_5519_50_europe_end.png`). Japan rises to 10.6 % of land by year 16 on seed 7321.
- Statics: Australia holds 4.03 % of cells in all 25 years of seed 7321, Brazil 3.71 to 3.81 %, Canada 11.7 % from
  year 7 to 25, the United States 8.0 % from year 10 to 25. In the browser chart the land lines of Canada, Brazil and
  the United States are flat for 12 years but for one step (`c5g_5519_61_charts.png`).
- Statelets: 93 alive in year 1, 149 in year 25 (`c5_headless_7321.json`). See R5-B3.
- The new air war fades with time (R5-B2), so years 10 onward look like the pre-air game.
- AoC does better (reference/screens/community-dominated-world-a.png, -b.png): a few empires by the end.

### God Mode: 5

- Tested: the God tab on France opened and its inventory read; not exercised beyond that this run (run 3 exercised
  the same buttons). The score carries on an unchanged inventory against a game that grew.
- Evidence: `critic/c5_f_4471.json` (`godButtons`), `critic/shots/c5f_4471_00_god_tab.png`.
- The buttons are the run 4 set exactly: Rename, income ±10, Declare war, Ally, Make puppet, Leave alliance, Grant,
  Revolt, Breakthrough, Territory, Revive, Kill. Nothing for the air (no wing spawn, no air superiority, no bombing)
  or the sea added in two phases.
- Missing against AoC (AOC_TEXT_NOTES lines 414 to 418 and 449): Nuke, Spawn Major Battle; and (text, run 3 frames)
  Recolor, Fight to the death (the sim has `setWarFightToDeath`; no button), Donate.

### Editor and scenarios: 6

- Tested: the editor's panel opened and its inventory read (`critic/shots/c5f_4471_10_editor.png`, `critic/c5_f_4471.json`,
  `editorText`), the title screen (`critic/shots/c5a_00_title.png`). Not exercised beyond that this run; run 3 found
  painting, cities, import and export working. The score carries on an unchanged inventory.
- Unchanged: territory, terrain, cities, gold, annex, flags, import, scenario export. No airbases, ports or fleets
  can be placed, so a custom scenario cannot have its own air or sea order of battle. One map, one start year.

### Stats and history: 5

- Tested: ranking at boot, history after 21 days and after 12 years, the ticker, the charts.
- Evidence: `critic/shots/c5a_01_boot.png`, `critic/c5_b_8317.json` (`historyLen`, `historyAir`), `critic/c5_g_5519.json`
  (`history`), `critic/shots/c5g_5519_60_history.png`, `critic/shots/c5g_5519_61_charts.png`.
- Fixed: the ranking (R4-B6).
- The air war leaves no trace in any record. After 20 days of Germany's war on Poland, with 345 air fights a year
  going on in this world (`c5_headless_7321.json`, year 1), the history has 27 rows and none about the air
  (`c5_b_8317.json`, `historyAir` empty); after 12 years on seed 5519 none of the history rows is about the air.
  `src/shared/statSeries.ts`, `src/shared/ranking.ts`, `src/ui/StatsChart.tsx`, `src/ui/NationPanel.tsx` and
  `src/ui/historyText.ts` contain no word "air" or "aircraft" (grep): no aircraft count, no losses, no bombing damage
  anywhere a player can read.
- The history is padded by convoy raids ("Soviet Union's submarines raided the convoys of United Kingdom" twice on
  the same day, every month) (`c5_g_5519.json`).

### UI/UX and polish: 6

- Tested: player control of the United Kingdom by the mouse; the Actions tab's air force; keys; phone width.
- Evidence: `critic/c5_c_2207.json`, `critic/shots/c5c_2207_00_actions_tab_war.png`, `critic/shots/c5c_2207_20_actions_wings.png`,
  `critic/shots/c5c_2207_12_day7.png`, `critic/c5_a.json`, `critic/shots/c5a_40_phone_390.png`.
- Better: a refused or failed order is now told in the ticker with its reason (R4-B2). Arming a wing order says
  "Click the map: patrol over a place. Esc to cancel."
- The air force list is 23 identical rows "Fighter group at an airbase · no mission" with Patrol, Strike and Rebase
  buttons (`c5c_2207_20_actions_wings.png`). No row says which airbase, where it is, its range, or its aircraft; a
  player cannot choose the right wing or find it on the map (wings are not drawn at their base). There is no way to
  order several wings at once. A wing of the player's nation has no mission until ordered: after 20 days of war all
  23 UK wings still had none (`c5_c_2207.json`, `wings`).
- Escape still closes no nation panel; F2 and M still change no map mode (`c5_a.json`: `esc`, `afterF2`, `afterM`).
  AoC has F1 to F6 for its modes (AOC_TEXT_NOTES line 667).
- At 390 × 844 the nation panel covers the ranking and the title bar (`c5a_40_phone_390.png`).

### Performance: 6

- Tested: seed 99 for 1 and 5 years pinned; seed 5303 for 25 years pinned (run 4's growth case); 12 years at Max in
  the browser on the RTX 4070 Ti.
- Evidence: `critic/c5_perf_seed99.log` (profiled, with a headless run beside it), `critic/c5_perf_seed99_5y_solo.log`,
  `critic/c5_perf_seed5303_25y_solo.log`, `critic/c5_g_5519.json` (`years`), `critic/c5_headless_7321.log`.
- Browser at Max: 12 simulated years in 334 s, 15 to 37 s a year (`c5_g_5519.json`). That is decades in minutes,
  on a par with AoC's pace by text.
- The tick is over its budget: seed 99 alone, 2.83 ms in year 1 (budget 2.4) and 1.87 ms over five years (budget 1.5),
  the pin hash 76983901 matches; seed 5303, 25 years, 2.86 ms mean. The air systems take 13.7 % of year 1 (`air`
  9.9 %, `airAi` 3.8 %, `c5_perf_seed99.log`). p95 4.7 to 21 ms; single calls of 41 ms (operational AI), 49 ms (air
  AI) and 141 ms (capitals) in year 1: stalls at Max.
- Growth with age, R4-B5: year 1 to 5 mean 2.18 ms, years 21 to 25 3.24 ms, × 1.49, peak year 12 4.06 ms. Run 4 had × 4
  on the same seed. No longer blocking.
- AoC does better: its fps counter reads 137 in `reference/screens/steam-screenshot-03.jpg`; I did not measure WarSim's
  fps.

### Stability: 7

- Tested: ten browser sessions (A, B, C, D on two seeds, E, F, G, H, I), three headless runs (two of 25 years).
- Evidence: `errors` in `critic/c5_a.json`, `c5_b_8317.json`, `c5_c_2207.json`, `c5_d_6131.json`, `c5_d_2207.json`,
  `c5_e_6131.json`, `c5_f_4471.json`, `c5_g_5519.json`, `c5_h_8317.json`, `c5_i_3307.json`: 0 page errors and 0
  console errors or warnings in all ten.
- Save and load in a war with sorties in the air (Italy on France, tick 30, 4 sorties aloft): the loaded game and the
  straight one reach the same hash 72 hours on (`c5_f_4471.json`, `twin`). Seed 99's pinned run matches the builder's
  pin (76983901).
- Odd: seeds 6131 and 2207 (the page's `inspect().seed` says 6131 and 2207) give the same first sea battle at the same
  hour and place, every British and German fleet in the same place 41 hours in, and the same element counts frame by
  frame (`c5_j.json`; `c5_d_6131.json`, `c5_d_2207.json`, `live`). The seed does not reach the first two days at sea;
  cause not investigated.
- A save is 38.8 MB (`c5_f_4471.json`, `saved.bytes`).

### Semantic zoom to unit level: 6 (needs 8)

- Tested: one air fight held at 4,000, 1,000, 300, 150, 40, 15 and 5 m/px; the same front watched live at 1,000, 150
  and 20 m/px; a tank fight at 150, 40, 12 and 4 m/px; a sea battle at 60 and 20 m/px live; a wheel zoom out and in.
- Evidence: `critic/c5_b_8317.json` (`tiers`, `live`), `critic/shots/c5b_8317_10_tier_*.png`, `critic/shots/c5i_3307_41_012m.png`,
  `critic/shots/c5i_3307_43_150m.png`, `critic/shots/c5e_6131_30_wheel_out_04.png`, `critic/shots/c5e_6131_31_wheel_in_*.png`.
- The land at T3 is as good as run 4: thousands of individuals, tracers across a front (`c5i_3307_41_012m.png`).
- The air vanishes at the unit level. Over the air fight of hour 25, sorties drawn: 30 at 4,000 m, 29 at 1,000 m, 19 at
  300 m, 12 at 150 m, 10 at 40 m, 0 at 15 m and 0 at 5 m; the air's marks 0 from 40 m in. Watched live at 20 m/px for
  17 sim hours over that front: 0 planes, 0 bombs, 0 flak in every sample (`c5_b_8317.json`, `live`, `m: 20`). The
  code says so: "T0 to T2" (`src/render/units/sorties.ts`, `src/render/fx/air.ts`). A player who zooms to watch the men
  of a battle never sees the planes that strafe them or the bombs that kill them. See R5-B1.
- Sea: see R5-B4.

### Naval warfare: 5 (needs 8)

- Tested: wars at sea on seeds 6131 and 2207; the ticker's sea battle clicked; the player's invasion again; 25 years.
- Evidence: `critic/c5_d_6131.json`, `critic/c5_d_2207.json`, `critic/c5_e_6131.json`, `critic/shots/c5d_6131_10_battle_0300m.png`,
  `critic/shots/c5d_6131_20_live_60m_3.png`, `critic/shots/c5d_6131_20_live_20m_3.png`, `critic/shots/c5e_6131_11_sea_live_3.png`,
  `critic/c5_c_2207.json`, `critic/c5_headless_7321.json`.
- Better: the fleet counter, the sea legend by navy, invasion outcomes told.
- The sea battle a player is sent to shows one side. The ticker's "Sea battle: United Kingdom against Germany" clicked
  leads to 250 m/px over the North Sea: British carrier, battle squadron, destroyer and cruiser tags and Dutch ships, no
  German ship, no shot, no plane in 8 live seconds (`c5e_6131_11_sea_live_3.png`; `c5_e_6131.json`, `sea`: sorties 0
  or 1, air marks 0). The view's battle circle there has a radius of 23.7 cells (`c5_d_6131.json`, `battle`): the British
  carrier at its centre, the engaged German battle squadron and destroyers at its edge, off the screen (`c5_j.json`). At 20
  m/px the British carrier group is seven red pills of 5 to 15 px and two dark ovals (`c5d_6131_20_live_20m_3.png`).
- A carrier group in that battle launched nothing a player could see: 0 sorties drawn in 24 live samples at 60 and
  20 m (`c5_d_6131.json`, `live`), although PLAN 5.4 claims carrier air groups in fleet battles.
- AI landings stay rare: 135 in 25 years on seed 7321, 0 to 6 a year after year 9 but for one year of 15
  (`c5_headless_7321.json`); fleets grow from 178 to 288.
- AoC has no navy (AOC_TEXT_NOTES line 419), so anything working is an addition; the bar is 8 and a player still
  cannot watch a sea battle.

### Tanks: 5 (needs 8)

- Tested: German Armoured division 41 and Light mechanised division 43 in contact on day 4 of seed 3307, at 150, 40, 12
  and 4 m/px, speed × 1.
- Evidence: `critic/c5_i_3307.json`, `critic/shots/c5i_3307_41_012m.png`, `critic/shots/c5i_3307_43_150m.png`.
- Unchanged from run 4: hull sprites in a lattice with tracers; nothing in this phase for armour. Air strikes on armour
  are not drawn at T3 (above).

### Aircraft: 4 (needs 8)

- Tested: an air war watched from its first hour (seed 8317); 25 years of the AI (seed 7321); a player's wings by the
  mouse (seed 2207); the air superiority mode on days 1, 7, 20 and 60; a save and load with sorties aloft.
- Evidence: `critic/c5_b_8317.json`, `critic/shots/c5b_8317_10_tier_1000m.png`, `critic/shots/c5b_8317_11_crop_planes_1000m.png`,
  `critic/shots/c5b_8317_10_tier_0150m.png`, `critic/shots/c5b_8317_20_live_l4_1000m_best.png`, `critic/c5_headless_7321.json`,
  `critic/c5_c_2207.json`, `critic/shots/c5c_2207_20_actions_wings.png`, `critic/c5_h_8317.json`,
  `critic/shots/c5h_8317_day20_aircontrol.png`, `critic/c5_f_4471.json`.
- Real, verified: 132 wings at the start of seed 7321; in the first hour of Germany's war on Poland 30 sorties are drawn
  at T0, planes in vees with their nation's colour, a fight with tracers, 11 bomb bursts and 13 flak puffs on screen
  at once (`c5_b_8317.json`, `tiers`); at the default speed the marks pile up to 185 bombs and 193 flak puffs in one
  frame at T1 (`live`, level 4). Strategic bombing damages industry in 1,231 cells in year 1. A player's patrol order
  flew the next hour; a strike beyond range was refused on screen. Save and load keep sorties in flight exactly.
- The AI's air war fades: mean sorties aloft 19.1 in year 1, 3.6 to 11.7 in years 2 to 9, 0.2 to 1.8 in every year from 13
  to 25, while wings grow from 132 to 236; air fights 345 in year 1, 111 in years 13 to 25 together (`c5_headless_7321.json`). See R5-B2.
- Not seen where a player looks closest (T3), not in the air mode (Germany's held zones invisible, 2 of 515 held on
  day 20), not in history, ticker or statistics (R5-B1).
- The planes are small white or grey silhouettes 13 to 19 px wide; Germany's are white on a grey country and stand out
  only by shape (`c5b_8317_11_crop_planes_1000m.png`). At the default speed the drawn sorties flicker between 0 and 21
  from one second to the next (`c5_b_8317.json`, `live`, level 4: 0, 21, 0, 12, 1, 20, 0, 0, 1, 18 …).
- Air in 1938 may be too strong: in year 1 of seed 7321, 16,729 air strikes took 812,668 men, guns and vehicles
  (`c5_headless_7321.json`, `strikeMen`, the sum of `AirStrike`'s b). I did not compare it with land losses: low
  confidence.
- AoC has no air war (AOC_TEXT_NOTES lines 419, 680). An addition, but the bar is 8.

### AI nuclear use: 0 (needs 8)

- Nothing exists. No nuke in God Mode (`c5_f_4471.json`, `godButtons`), no nuclear event kind (`src/shared/events.ts`
  ends at `FlakFired`, 49), `"nukesEnabled": true` in `data/scenarios/1938/scenario.json`. AoC has a nuke (AOC_TEXT_NOTES
  lines 414 to 418).

## Blocking issues, in priority order

1. **R5-B1. The air war cannot be seen where a player watches or read anywhere afterwards.** No plane, bomb or flak is
   drawn at T3: over an air fight 10 sorties at 40 m/px, 0 at 15 and 5 m/px; 0 of everything in 17 live hours at 20 m/px
   (`critic/c5_b_8317.json`, `tiers`, `live`; `critic/shots/c5b_8317_10_tier_0015m.png`). This is by design ("T0 to T2"
   in `src/render/units/sorties.ts` and `src/render/fx/air.ts`), not a bug: a gap in what was built. The air superiority mode shows 2
   of 515 zones held on day 20 of Germany's war on Poland, Germany's in grey on grey, with no nation in its legend
   (`critic/c5_h_8317.json`, `critic/shots/c5h_8317_day20_aircontrol.png`). No air event reaches the history, the
   ticker, the charts, the ranking or the nation panel (`critic/c5_b_8317.json`, `historyAir` empty; `critic/c5_g_5519.json`,
   `history`). Fix: draw sorties and their bombs and strafing at T3 over the men they hit; a per-nation legend and a
   visible tint or hatching in the air mode; air battles and bombing raids in the history and ticker; aircraft, losses
   and bomb damage in the nation panel and charts.
2. **R5-B2. The AI's air war fades out over the game.** Seed 7321: mean sorties aloft 19.1 in year 1, still 11.7 in
   year 5, then 0.2 to 1.8 in every year from 13 to 25, while wings grow from 132 to 236; 345 air fights in year 1, 101
   in year 6, 111 in years 13 to 25 together and 0 in five of those years (`critic/c5_headless_7321.json`,
   `critic/c5_headless_7321.log`). The builder may answer that late wars are revolts of statelets with no wings; I did
   not part the wars by who has wings, so that is open, but there are 8 to 12 wars in most of those years and 200+
   wings. Fix: first look at the air AI's tasking (0 to 16 wings with a mission at a year's end, `missions`); keep the
   wings of nations at war flying; lay up or disband wings no one flies.
3. **R5-B3. The world still shatters into statelets** (R4-B3, deferred). Seed 7321: 93 alive in year 1, 149 in year 25,
   180 founded in all; seed 5519 in the browser: 54 generated-name nations after 12 years, "Free Inner Mongolia III"
   (`critic/c5_headless_7321.json`, `critic/c5_g_5519.json`, `critic/shots/c5g_5519_50_europe_end.png`). Fix: as run 4.
4. **R5-B4. A sea battle still shows one side.** ADR-303 says the ticker's row "flies to a T2 view of both fleets". The
   row "Sea battle: United Kingdom against Germany" (seed 6131, hour 41) flies to 250 m/px over British carrier group
   1063, the battle's centre; the engaged German fleets (battle squadron 1199, destroyer flotilla 1200) are 23.7 cells
   away in the Heligoland Bight, off the screen (`critic/c5_j.json`). On screen: British and Dutch ships, no German ship,
   no fire and no carrier planes over 8 live seconds; at 20 m/px the carrier group is seven pills
   (`critic/c5_e_6131.json`, `critic/shots/c5e_6131_11_sea_live_3.png`, `critic/c5_d_6131.json`, `critic/c5_d_2207.json`,
   `critic/shots/c5d_6131_20_live_20m_3.png`). The carrier is "engaged" at 23.7 cells, so the fight is a carrier strike
   that draws nothing between the two. Fix: frame both sides (zoom out to the span when it exceeds T2, or centre on
   the enemy); draw a carrier's strike as sorties flying to its target; ships large enough to read at 20 m/px.
5. **R5-B5. Nuclear weapons do not exist** (Phase 6). AI nuclear use is 0 and AoC has a nuke in its God tools
   (`critic/c5_f_4471.json`, `godButtons`; `reference/text/AOC_TEXT_NOTES.md` lines 414 to 418). Fix: Phase 6, and a God
   Mode nuke as in AoC.

## Non-blocking issues

- About 60 order arrows across any front at T1 (`critic/shots/c5b_8317_10_tier_1000m.png`).
- The player's 23 wings are identical rows with no base, place or range; no group order; the player's wings fly nothing
  unless ordered one by one (`critic/shots/c5c_2207_20_actions_wings.png`, `critic/c5_c_2207.json`).
- The player's invasion of Germany on seed 2207 was thrown back to Kent again; it is now told, but the message does not
  say why (the German navy) or where it came ashore (`critic/c5_c_2207.json`, `track`).
- Drawn sorties flicker between 0 and 21 a second at the default speed (`critic/c5_b_8317.json`, `live`).
- Tick over budget: 1.87 ms over five years against 1.5, 2.83 ms in year 1 against 2.4; stalls of 41 to 141 ms
  (`critic/c5_perf_seed99_5y_solo.log`, `critic/c5_perf_seed99.log`).
- UK declares war on Portugal (seed 8317) and on the Netherlands (the builder's own demo) on day 2.
- God Mode has nothing for air or sea; no nuke, recolor, fight to the death or donate.
- The editor places no airbases, ports or fleets.
- Escape closes no panel; F2 and M do nothing; phone width overlaps (`critic/c5_a.json`, `critic/shots/c5a_40_phone_390.png`).
- Convoy raids pad the history twice a month (`critic/c5_g_5519.json`).
- Seeds 6131 and 2207 play their first sea battle identically (`critic/c5_d_6131.json`, `critic/c5_d_2207.json`).
- A save is 38.8 MB (`critic/c5_f_4471.json`).
- `"nukesEnabled": true` in a game without nukes (`data/scenarios/1938/scenario.json`).

## Strengths, verified

- The browser plays decades in minutes on a GPU machine: 12 simulated years in 334 s at Max, with no page error in ten
  sessions (`critic/c5_g_5519.json`; the sessions' `errors`).
- Save and load are exact in an air war with sorties aloft (`critic/c5_f_4471.json`, `twin`), and a refused order now
  says why on screen (`critic/c5_c_2207.json`, `newsAfterFar`).

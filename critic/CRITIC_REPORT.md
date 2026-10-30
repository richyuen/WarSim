# Critic report, run 20

- **Commit:** `a3edf009a35b51d3ea09b466590bbd3ccf05d3e6` (HEAD at the start). Run 19 was on `c689c2e4`; 15 commits since.
  **No file under `src/sim/` changed.** What changed is all UI and naming: the map-mode menu fixed for phones
  (PLAN 7.159, R19-B1); a phone layout with compact news, folded legend and ranking, and a touch "✕ Cancel" (ADR-760);
  the rename to Warism, with old scenario files and stored keys kept (ADR-761); the whole UI restyled as "glossy
  gunmetal plates" (ADR-762/764); no language picker and a reordered bottom bar (ADR-763); unit icons in the Actions tab
  (ADR-765); a wing's name or icon selects it, the camera follows it and a mark shows it on the map (ADR-766/767); the
  nation's allies on its overview (ADR-768). The worker sends wing positions and alliance members (`src/worker/server.ts`).
- **Date:** 2026-10-30.
- **Build:** `vite build --outDir critic/c20_dist`, exit 0 (`critic/c20_build.log`), served by `vite preview` on
  127.0.0.1:**5349**, stopped at the end. Chromium through Playwright, headless: 1600 × 900, 1280 × 720, eight widths
  for the map menu, 390 × 844 and 844 × 390 with touch (`isMobile`, `hasTouch`).
- **Runs:** two of run 19's seeds (1213, 3301) × 30 years headless as an identity check; run 19's page suite re-run
  (`c20_suite1.sh`); the late-game page timing on run 19's case (3301 year 27 checkpoint at Max); new probes for every
  new UI feature (U, W, PH, SX, OS below).
- **Reference:** `reference/screens/`, `reference/text/AOC_TEXT_NOTES.md`. AoC has no player-commanded units, unit
  panels or phone layout. What I say about those in AoC comes from text only.
- **Prefix:** every path below was made in this run (`c20`). Scripts are in `critic/scripts/c20_*`.

## Verdict

**The world is run 19's world, hash for hash (60 of 60 world-years). This build is a UI pass, and mostly a good one:
the phone map modes are back, the phone news no longer covers the map, and the new style is consistent and readable in
every panel I opened. The run's worst finding is old, not new: when a player clicks their own division in a mixed
stack at the front, the gold frame selects it but the panel describes whichever formation is on top: another formation
on 7 of 12 clicks (counted by formation id), another nation's division on 5 of them (3 enemy, 2 allied). New and smaller: the wing mark follows an hourly point, so close in it points at
empty ground.**

- **R19-B1 resolved:** at 390 × 844, 11 of 11 map-mode options are hit-testable, and a tap on Terrain sets Terrain
  (`critic/c20_p2_phone_menu.json`). The same holds at all eight widths tried (`critic/c20_p3_widths.json`).
- **Identity:** seeds 1213 and 3301 × 30 years give run 19's yearly hashes on **60 of 60** world-years
  (`critic/c20_ident.json`). No count over seeds can have moved, and no dynamics score moves.
- **New blocking (pre-existing code, first found this run):** R20-B1, the formation panel is not the selected
  formation (below).

## Scores

| Dimension | Run 19 | Run 20 |
|---|---|---|
| Map visuals and readability | 7 | 7 |
| Diplomacy, war, alliance, puppet, revolt depth | 7 | 7 |
| Emergent world dynamics over long runs | 7 | 7 |
| God Mode | 7 | 7 |
| Editor and scenarios | 7 | 7 |
| Stats and history | 7 | 7 |
| UI/UX and polish | 7 | 7 |
| Performance | 7 | 7 |
| Stability | 7 | 7 |
| Semantic zoom to unit level (needs 8) | 8 | 8 |
| Naval warfare (needs 8) | 8 | 8 |
| Tanks (needs 8) | 8 | 8 |
| Aircraft (needs 8) | 8 | 8 |
| AI nuclear use (needs 8) | 8 | 8 |

No score moved. The sim is unchanged (identity). The UI gains are real, but they do not yet earn an 8 against AoC
while a click at the front shows the wrong division and the phone bar still hides half its buttons (UI/UX below).

## Run 19's cases re-run

| Run 19 case | On HEAD | Evidence |
|---|---|---|
| **R19-B1:** phone map menu clipped, 0 of 11 options hit | **Resolved.** 11 of 11 hit; the tap on Terrain lands; `modeAfter: terrain`. The menu now opens at 209–386 × 560–802 px, inside the window. | `critic/c20_p2_phone_menu.json`, `critic/shots/c20p2_phone_mapmenu_open.png`, `critic/shots/c20p2_phone_after_tap.png` |
| Map menu at 1600–768 px widths | Still 11 of 11 at every width. | `critic/c20_p3_widths.json`, `critic/shots/c20p3_mapmenu_*.png` |
| Seeds' yearly hashes (sim identity) | 1213 and 3301 × 30 years: 60 of 60 equal to run 19 (for example 3301 y30 `d569de48` on both). | `critic/c20_ident.json`, `critic/c20_headless_1213.json`, `critic/c20_headless_3301.json` |
| Slowest year at Max in the page (3301 y27 → y28, 56.4 s, 59.6 fps, longest gap 360 ms) | Same checkpoint and loaded hash 4133771521: **56.4 s, 59.6 fps, longest gap 338 ms**, none over 500 ms. The restyle costs nothing measurable. | `critic/c20_l_3301.json`, `critic/c20_l_3301.log` |
| Breakthrough silent at peace (2203) | Unchanged: the JSON is byte-identical to run 19's. | `critic/c20_k_2203.json` |
| God revolt told as a declared war (6421) | Unchanged (byte-identical JSON). | `critic/c20_q_6421.json` |
| Offer peace (6011) | Same outcome as run 19; only the panel's heading case differs ("ELEMENTS"). | `critic/c20_pl_6011.json` |
| Phone: God tools clipped, bar scrolls | **Unchanged.** Revolt, Spawn nation, Breakthrough, Territory, Nuke, Found city and Raze city are still clipped ("Revol", "Breakthr"…). The portrait bar still scrolls sideways (scrollWidth 814 in 366 px). "Map: Politic…" is cut and Statistics, History, Editor and Settings are off screen, with no sign that the bar scrolls. | `critic/c20_p.json`, `critic/shots/c20p_phone_01_world.png`, `critic/shots/c20p_phone_03_god.png` |
| Touch: tap, pan, long-press box, order | Holds: 1 selected by a tap, the pan ends the follow, the long press selects 41, the tap orders. A long press on a foreign nation still opens nothing (war only from the Actions tab on touch). | `critic/c20_pt_touch.json` |
| History export a/b raw | **Unchanged:** `SeaBattle,458771,France,524312,Spanish Republic`. a/b are still encoded side ids beside the names. | `critic/c20_dl_7019.csv` |
| Land "To its fight" off its own formation (5381 d21) | Unchanged: self off screen on 6 of 8 presses. | `critic/c20_ft_5381_d21.json` |
| Fleet "To its fight" (4877) | Holds. | `critic/c20_fp2_4877.json` |
| Broken format-1 save offered again (c10) | Unchanged: refused with the plain message, offered again on the next visit. | `critic/c20_os_c10fmt1.json` |
| `cfa73219` save through Continue | Loads whole (27 December 1957). | `critic/c20_os_c18fmt1.json` |
| Editor fleets, the refusal on land, export and title load (4877) | Placement and the refusal hold. The day marks after loading differ from run 19 (sea 0 vs 1 at day 1): the probe pauses at Max by wall clock, so its marks depend on load, and they are not compared. | `critic/c20_g_4877.json` |
| History panel (7019 y20) | 4,154 events, opened in 112 ms (run 19: 115). | `critic/c20_hi_7019.json` |
| God nukes (4219), zoom (5861), armour close up (7019) | Same results. | `critic/c20_a_4219.json`, `critic/c20_z_5861.json`, `critic/shots/c20c_7019_arm_0025m.png` |
| Identical carrier strike rows, a mass order flooding the ticker, no order line at T0, rings over counters, allies of a declared war not told | Code paths unchanged. "Germany +5 × Poland +9" from one player declaration is still told only as "Germany declared war on Poland". | `critic/shots/c20u_1600_12_day40.png`, `critic/c20_w_5557.json` (`war`) |

## New in this run

| Case | What happened | Evidence |
|---|---|---|
| U: the restyle at 1600 × 900 (seed 5557) | Every panel I opened is the same family of plates: top and bottom bars, nation panel, ranking, legend, ticker rows, war banners, History, Settings, the map menu and the title screen. Brass titles and dark wells read clearly, and select options are light on dark (`rgb(242,244,247)` on `rgb(26,30,37)`). No page errors. (A first contrast census flagged the brass tabs at 1.08:1. That was my probe reading `background-color` under a gradient, not a defect: the screenshots show dark text on brass.) | `critic/c20_u_1600_5557.json`, `critic/shots/c20u_1600_01_world.png`, `…_02_germany_overview.png`, `…_09_history.png`, `…_11_settings.png`, `critic/shots/c20os_title.png` |
| Allies on the overview (ADR-768) | Germany: "ANTI-COMINTERN PACT · Alliance unity 55 · ALLIES Italy, Japan". A chip opens Italy, whose allies read Germany, Japan. | `critic/c20_u_1600_5557.json`, `critic/shots/c20u_1600_02_germany_overview.png`, `critic/shots/c20u_1600_03_ally_panel.png` |
| Unit icons (ADR-765/767) | 59 icons in the Actions tab, 28 of them buttons (the wings). In God Mode, a placing icon arms that template: the row lights, "✕ Cancel" appears first in the bar, and Cancel disarms it. **But** Germany's 28 air wings are 28 identical rows, "Fighter group at an airbase · no mission", each wrapped to four lines beside the icon and three buttons. No base or place is named, so the only way to tell two wings apart is to click one and watch the camera. | `critic/shots/c20u_1600_05b_actions_panel.png`, `critic/shots/c20u_1600_05c_actions_air.png`, `critic/shots/c20u_1600_06_place_armed.png` |
| W: a wing followed in flight (ADR-766/767, seed 5557) | Germany at war with Poland. The strike ordered on Warsaw for the westernmost fighter group was refused ("Fighter group: not done: it is beyond the range of…"), and the AI's air layer then sent the wing on patrol. I followed that patrol by its name. At 3,000 m/px the mark was a median **32 px** (p90 88) from the nearest drawn German sortie: usable. At **250 m/px** the median was **212 px**, p90 714, max 1,245, and in **20 of 56** samples no German plane was on screen at all. The ring sits over empty Westphalian fields while the planes fly elsewhere. The cause: the mark and the camera ride the stats' hourly point, while the planes are drawn per frame. ADR-766 lists this as "Not done" for the camera. ADR-767's mark inherits it. The row also reads "at an airbase · patrolling · in the air", which contradicts itself. | `critic/c20_w_5557.json`, `critic/shots/c20w_5557_x1_250_1.png`, `critic/shots/c20w_5557_x1_250_2.png`, `critic/shots/c20w_5557_x1_3000_1.png` |
| Follow with another panel open | Opening Italy's panel while following a German wing keeps the follow and the mark. | `critic/c20_w_5557.json` (`other panel open`) |
| PH: phone portrait after 60 days of war (seed 4441) | Two ticker rows, two war banners and "+4". The "+4" opens to six banners and "−" folds them. The legend and ranking fold to their titles and open on a tap. The panels covered 18 % of the screen with everything folded (run 19's phone had the ticker, banners and legend stacked over the lower map). A tapped formation shows "✕ Cancel" first in the bar, and a tap on it empties the selection (1 → 0). | `critic/c20_ph.json`, `critic/shots/c20ph_portrait_03_day60.png`, `critic/shots/c20ph_portrait_05_map-legend.png`, `critic/shots/c20ph_portrait_06_selected.png`, `critic/shots/c20ph_portrait_07_after_cancel.png` |
| PH: phone on its side (844 × 390) | The bar fits (no scroll) and wraps the "Playing Germany" label to a second line. The ticker is two rows. The Actions panel is 176 px tall, about five rows of content. The ranking, when opened, runs down over the bar's right end and hides the date and Settings until it is folded again. | `critic/shots/c20ph_landscape_03_day60.png`, `critic/shots/c20ph_landscape_02_actions.png`, `critic/shots/c20ph_landscape_05_stats-ranking.png` |
| OS: old scenario files (ADR-761) | A `.warsim-scenario` written by `c689c2e4` (magic `WARSIM-SCENARIO`) is offered on HEAD's title screen (accept `.warism-scenario,.warsim-scenario`) and starts. Files exported on HEAD carry `WARISM-SCENARIO`. | `critic/c20_os_scen.json`, `critic/shots/c20os_old_scenario_loaded.png` |
| **SX: a click on one's own division at the front (seed 4441, Germany at war with Poland for 60 days)** | 12 clicks, each centred on a German formation. Each time the click selected a German formation (gold frame, "Playing Germany · 1 selected"), but the formation panel showed **a Polish division 3 times, an Italian division twice**, and a different German formation on 2 more clicks: 7 of 12 not the selected one, counted by the panel's `data-formation` id against the selection. Example: German id 4 selected, panel "Infantry division 562 · Poland · 6,164 of 12,460 · In contact · ⚔ To its fight". The same happens on the phone (`c20ph_portrait_06_selected.png`). | `critic/c20_sx_4441.json`, `critic/shots/c20sx_4441_1.png`, `critic/shots/c20sx_4441_3.png`, `critic/shots/c20sx_4441_4.png` |

## Dimensions

### Map visuals and readability: 7 (unchanged)

- **Tested:** the world and Europe at country zoom with the new plates around them, a war after 40 days, the phone in
  both orientations.
- **Evidence:** `critic/shots/c20u_1600_12_day40.png`, `critic/shots/c20sx_4441_3.png`,
  `critic/shots/c20ph_portrait_05_map-legend.png`.
- **What changed:** the map itself is unchanged. The frame around it is more coherent, and on a phone far less of the map is
  covered. **What AoC does better:** contiguous, readable country blobs and names
  (`reference/screens/steam-screenshot-03.jpg`). Fronts at country zoom are still a dense mass of counters, dashed
  lines and plane glyphs (`c20sx_4441_3.png`).

### Diplomacy, war, alliance, puppet, revolt depth: 7 (unchanged)

- Same worlds as run 19 (identity). **New:** the allies listed with clickable chips (`c20u_1600_02_germany_overview.png`).
  **Weak:** one player declaration pulled 14 nations into "Germany +5 × Poland +9", told as a single row.
  The Actions tab's diplomacy select opens on "Afghanistan", one click from "Declare war".

### Emergent world dynamics over long runs: 7 (unchanged)

- 60 of 60 world-years identical to run 19 (`critic/c20_ident.json`). Run 19's reasons stand.

### God Mode: 7 (unchanged)

- **Better:** a placing template is armed by its icon, and "✕ Cancel" in the bar ends it (`c20u_1600_06_place_armed.png`).
- **Not more:** Breakthrough silent at peace and the revolt told as a war (both byte-identical to run 19). God tools
  are still clipped on a phone (`c20p_phone_03_god.png`).

### Editor and scenarios: 7 (unchanged)

- Old scenario files still load after the rename (`c20_os_scen.json`). Placement and the refusal on land hold
  (`c20_g_4877.json`). The restyled title screen is clear (`c20os_title.png`).

### Stats and history: 7 (unchanged)

- History 4,154 events in 112 ms (`c20_hi_7019.json`). The export's a/b are still raw side ids (`c20_dl_7019.csv`). The
  carrier rows are still identical.

### UI/UX and polish: 7 (unchanged)

- **Better (verified):** phone map modes work again (R19-B1). The phone news is compact and foldable in both
  orientations. Cancel on touch works. The style is consistent across every panel and the title screen, with readable
  selects. The allies are listed. Wings can be found from their rows. Old files are kept through the rename.
- **Worse or still wrong:** **R20-B1**: at the front, the panel after a click describes another formation, often an
  enemy, on 7 of 12 clicks. The wing mark points at empty ground close in (`c20_w_5557.json`). The air list is 28
  identical, unnamed four-line rows. The portrait bar still hides Statistics, History, Editor and Settings off its
  right edge, and God tools are clipped. In landscape the opened ranking covers Settings. Land "To its fight" is still
  off its own formation (6 of 8).
- **Why not 8:** AoC's UI is simpler, but nothing in it shows you the wrong unit. A player of this build at war reads
  enemy strength as their own on about half of the clicks at a front. With that and the phone bar, I cannot defend an
  8 over AoC, even though this is the best-looking build so far.

### Performance: 7 (unchanged)

- **Tested:** the same late case as run 19 at Max in the page: 56.4 s for the year, 59.6 fps, longest gap 338 ms
  (run 19: 56.4 s, 59.6 fps, 360 ms; `critic/c20_l_3301.json`). The headless runs are contended (two at once beside page
  probes) and serve as a trend only: late tick 2.8–3.1 ms at y17–18 (`critic/c20_headless_*.log`). The sim is
  unchanged, so run 19's paired figures stand.
- **Why not up:** nothing in the sim changed. The restyle neither costs nor saves frame time.

### Stability: 7 (unchanged)

- **Held:** 60 of 60 world-years deterministic. No page error in any probe, apart from the expected warning of the
  refused old save (`c20_os_c10fmt1.json`). Old saves and old scenario files load.
- **Not more:** the broken format-1 save is still offered again.

### Semantic zoom to unit level: 8 (unchanged)

- Zoom series and armour close up as in run 19 (`c20_z_5861.json`, `critic/shots/c20c_7019_arm_0025m.png`). **New and weak:** a
  followed wing's mark is right at country zoom but wrong at T2/T3, where the planes are drawn (`c20w_5557_x1_250_1.png`).

### Naval warfare: 8 (unchanged)

- Same worlds. Fleet "To its fight" holds (`c20_fp2_4877.json`).

### Tanks: 8 (unchanged)

- `critic/shots/c20c_7019_arm_0025m.png`. Code unchanged.

### Aircraft: 8 (unchanged)

- Same worlds. **New:** wings can be selected, followed and marked. The mark is usable at country zoom and off
  the planes close in. A strike beyond range is refused in words (`c20_w_5557.json`).

### AI nuclear use: 8 (unchanged)

- Same worlds as run 19. God nukes unchanged (`c20_a_4219.json`).

## Blocking issues, in priority order

R19-B1 is resolved. One blocking issue, newly found (the code is unchanged since `c689c2e4`: `game.tsx`'s `onPick` and
`MapView`'s two pickers are untouched by this build's diff):

1. **R20-B1. The formation panel is not the formation the click selected: at a front, a player's click on their own
   division shows an enemy's or an ally's panel.**
   - `game.tsx` `view.onPick` opens the panel with `view.formationPick(sx, sy)` (any nation, the top of the stack),
     then `PlayerControl.click` selects with `view.formationAt(sx, sy, n)` (the played nation only). Two pickers with
     two rules, on the same click. Playing Germany 60 days into a war with Poland (seed 4441), 12 clicks centred on
     German formations each selected a German formation, but the panel showed a **Polish division on 3, an Italian
     on 2, and another German formation on 2** (7 of 12). Example: "Playing Germany · 1 selected" with the gold frame on
     a German counter, beside the panel "Infantry division 562 · Poland · 6,164 of 12,460 · In contact · ⚔ To its
     fight". The same happens on touch. A player reads the enemy's men, supply and status as their own unit's and orders it on that basis.
     This contradicts the player-control feature exactly where it matters, in contact.
   - **Evidence:** `critic/c20_sx_4441.json`, `critic/shots/c20sx_4441_1.png`, `critic/shots/c20sx_4441_3.png`,
     `critic/shots/c20sx_4441_4.png`, `critic/shots/c20ph_portrait_06_selected.png`.
   - **Fix and bar:** while playing, when the click selects a formation, open that formation's panel (or let both
     pickers share one rule, own formations first). Bar: on `c20_sx`'s case, 12 of 12 panels are the selected
     formation's.

## Non-blocking issues

1. **The wing mark and camera ride an hourly point:** at 250 m/px the mark is a median 212 px from the nearest German plane (max
   1,245), with no German plane on screen in 20 of 56 samples. Fix: place the mark and the follow at the sortie's
   drawn position (`sortieMarks`) while the wing flies (`c20_w_5557.json`).
2. **28 identical air rows:** "Fighter group at an airbase · no mission", four lines each, no base named. The row of
   a flying wing reads "at an airbase · patrolling · in the air" (`c20u_1600_05c_actions_air.png`).
3. **Phone bar:** portrait still scrolls sideways with half its buttons hidden; God tools are clipped (`c20p_phone_01_world.png`,
   `c20p_phone_03_god.png`). In landscape, the opened ranking covers Settings (`c20ph_landscape_05_stats-ranking.png`).
4. **The diplomacy select defaults to Afghanistan**, one click from "Declare war".
5. **Unchanged from run 19:** no order lines at T0; a mass order floods the ticker; rings hide counters; allies of a
   declared war not told; identical carrier rows; worn wings counted as manned decks; Breakthrough silent; God revolt
   as a declared war; export a/b raw; land "To its fight" off its own formation; the broken format-1 save offered
   again; no war from the map on touch.

## Design objections (none blocking, no score lowered)

- **The camera follows a wing by hourly stats (ADR-766 "Not done")**: a follow that jumps an hour of flight at a time
  is a design shortcut that the close zooms expose. It deserves a frame-rate position, not a note.
- **The AI takes God-placed units at once, and a march that meets the enemy is cancelled (ADR-759):** run 19's
  objections stand.
- **Gunmetal plates with rivets (ADR-762):** well made, and the user's taste decides. They are heavier than AoC's thin
  frames. ADR-762 kept every outer box, and the 1280 × 720 view shows the same layout (`critic/shots/c20p_laptop_01_world.png`). Not a defect.

## Notes

- No worktree this run. The sim is unchanged by diff and by 60 hashes, and every UI case was compared against run 19's
  JSON directly.
- Preview on port 5349 and every browser were stopped at the end.

## Strengths, verified

- **The phone is now playable to read:** the map shows, the news is two rows, the legend and ranking fold, map modes
  work and Cancel replaces Escape (`c20ph_portrait_03_day60.png`, `c20_p2_phone_menu.json`).
- **A UI pass that broke nothing:** 60 of 60 world-years identical, the late year at Max as fast as before, and old saves
  and scenario files still load after a rename.

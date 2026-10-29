# Critic report, run 19

- **Commit:** `c689c2e44a729ece30117f3878b6279c99b59e7c` (HEAD at the start). Run 18 was on `cfa73219`; 15 commits since.
  What touches the game: two speed-ups of the operational AI (PLAN 7.157/7.158, `14a1b285`, `d551fc60`, claimed pure);
  the tick budget raised from 5.5 to **6.5 ms** in any year by the user (ADR-757); and a run of the user's own requests
  for playing a nation: control leaves the AI on, layer by layer, with the player's direct orders left alone until done
  (ADR-759, a new `playerOrderSystem`); God Mode places any unit of the played nation (ADR-758); a right-click menu on
  a nation's ground (war, peace, alliance); the selection framed at every zoom and followed by the camera; box select
  (Shift-drag, Ctrl+Shift-drag, Ctrl+A, long press on touch); order arrows at T2/T3; map modes from a menu.
- **Date:** 2026-10-29.
- **Build:** `vite build --outDir critic/c19_dist`, exit 0 (`critic/c19_build.log`), served by `vite preview` on
  127.0.0.1:**5339**. `cfa73219` in a worktree (`critic/wt`, `node_modules` a junction) for paired timing only.
  Chromium through Playwright, headless, 1600 × 900 (390 × 844 phone with touch, 1280 × 720, and five other widths for
  the map-mode menu).
- **The machine was shared.** From about 14:24 another session's loop (a Playwright capture job and `vite build` of
  another repo) used up to ~16 cores at intervals. Run 18's method (pinned reads alone) could not be kept: I timed
  HEAD and `cfa73219` **at the same time on two cores, swapped** (`c19_pair.sh`, the ratio is the comparison), and took
  0xFFFF-pinned reads only when a 3-s sample of all other processes was quiet, with the load sampled during each read
  (`c19_perf_quiet.sh`, `critic/c19_perfq.log`). The batch figures below are contended and are trend only.
- **Runs:**
  - Unaided 1938 worlds × 30 years on HEAD (`c19_batch.sh`, `c19_headless.ts` = run 18's script): **four of run 18's
    seeds** (6599, 2539, 1307, 7019) as an identity check, and **four new seeds** (1213, 2617, 3301, 4441). A second wave
    of four new seeds was stopped to free the machine for timing (no partial file is used).
  - Paired timing, HEAD against `cfa73219`, nine late seed-years and seed 99 × 5 years (`critic/c19_pair_summary.json`).
  - In the page: every new player feature (sessions PA, PB, PF, PS, PT, P2, P3 below) and run 18's probes re-run
    (`c19_suite1.sh`: God tools, Breakthrough, playing Poland and Offer peace, the editor, "To its fight" on land and at
    sea, the two old-save cases, history export, the history panel, God nukes, zoom, armour close up, a new seed's two
    years in Europe).
- **Reference:** `reference/screens/`, `reference/text/AOC_TEXT_NOTES.md`. AoC's unit control does not exist (AoC has
  no player-commanded units); its God tools, save/load and performance are known from text only.
- **Prefix:** every path below was made in this run (`c19`). Scripts in `critic/scripts/c19_*`.

## Verdict

**The world is run 18's world, hash for hash, a few per cent faster, and now judged against a 6.5 ms budget it meets.
The new work is all on the player's side: playing a nation is far better than it was (fronts no longer freeze when
taken, orders are kept, refusals told, war from the map, God placement), and it works as specified on every case I
tried. Its rough edges are UI: on a phone the new map-mode menu cannot be opened at all, the order arrows vanish at the
zoom where mass orders are given, and a mass order floods the ticker with three-line refusals.**

- **Identity:** four of run 18's seeds × 30 years on HEAD give run 18's yearly hashes on **120 of 120** world-years
  (`critic/c19_ident.json`). Every count over seeds in run 18 (contact, sea battles, decks, nukes, idle fronts) is
  therefore unchanged by construction; I did not re-count them, and no dynamics score moves.
- **R18-B1 resolved, by the user's decision and by measurement:** the budget is now 6.5 ms (ADR-757). Paired with
  `cfa73219` at the same time, HEAD is **faster on all nine late seed-years, by 0.3–8 %** (same hashes); the quiet pinned
  reads are all under 6.5 ms (see Performance). The raised budget is a design objection, not a defect.
- **New, blocking:** the map-mode menu (`c689c2e4`) is drawn inside the bottom bar, whose `overflow: auto` clips it on
  a phone: no mode can be chosen there (the old button cycled modes on a tap).

## Scores

| Dimension | Run 18 | Run 19 |
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

No score moved. The sim did not change (identity), and the new player features are offset by the regressions and
rough edges they brought (each dimension below says which).

## Run 18's cases re-run

| Run 18 case | On HEAD | Evidence |
|---|---|---|
| R18-B1: pinned 6599 y17 5.76, 2539 y28 5.84, 1307 y30 5.55 ms (budget 5.5) | Same checkpoints, same hashes. Paired with `cfa73219` at the same time on two cores, swapped: HEAD/old **0.923, 0.940, 0.964** (3727 y25 0.966, 8011 y26 0.970); run 18's pinned × ratio = **5.32, 5.49, 5.35 ms**. Quiet pinned reads (0xFFFF): 6599 y17 **5.53 / 5.64**, 2539 y28 **5.80 / 5.95**, 1307 y30 **5.78**. All under the 6.5 ms budget now in SPEC (ADR-757); all three are still over the old 5.5. (The pinned 2539 reads sit a little above run 18's 5.67/5.84 while the same-time pair says 6 % faster: absolute reads on this shared machine carry ±3 %.) | `critic/c19_pair_summary.json`, `critic/c19_pair_6599_y17_*_*.log`, `critic/c19_perf_summary.json`, `critic/c19_perfq.log`, `critic/c19_perfq_*.log` |
| Seed 99 × 5 years 2.56 ms pinned | Paired HEAD/old 0.989 (level); hash b22bcdd1 at year 1 and 80a8e77d at year 5 on both. | `critic/c19_pair_seed99_5y_*.log` |
| Late contact, sea battles, decks, nukes (37 worlds) | Unchanged by construction: 4 of run 18's seeds identical for 30 years. New seeds (not compared): engaged formations a day late 11.6–15.4 (run 18: 13.75), sea battles late 5.4–9.4 a world-year (6.96), bursts 11–49 a world over 30 years. | `critic/c19_ident.json`, `critic/c19_headless_1213.json`, `…_2617.json`, `…_3301.json`, `…_4441.json` |
| Identical carrier strike rows | Unchanged: three "⚓ Carrier strike ashore: Japan on China" rows at once (seed 5557 day 12; seed 3301 December 1939). | `critic/shots/c19pa_5557_07_ctrlA_48h.png`, `critic/shots/c19ww_3301_d720_europe.png` |
| Breakthrough at peace silent (2203) | Unchanged: counts identical before and after, no row. | `critic/c19_k_2203.json` |
| God revolt told as a declared war (6421) | Unchanged: "1 January 1938 Germany declared war on Free Saxony". | `critic/c19_q_6421.json` |
| Offer peace unanswered (6011) | **Changed, not proven:** Poland offers Lithuania peace on day 20 and "21 January 1938 Poland made peace with Lithuania" follows in the same hour. With ADR-759 Poland's own diplomacy layer runs while played, so the row cannot tell an accepted offer from a peace Poland's AI made itself; the offer still has no answer of its own (accepted or refused). | `critic/c19_pl_6011.json` |
| Phone: God tools clipped, bar cut | Unchanged: "Revolt" … "Raze city" all clipped (`scrollWidth > clientWidth`); the bar ends at "Stati". | `critic/c19_p.json`, `critic/shots/c19p_phone_03_god.png`, `critic/shots/c19p_phone_01_world.png` |
| History export a/b raw | Unchanged: "SeaBattle,458771,France,524312,…". | `critic/c19_dl_7019.csv` |
| Land "To its fight" frames blocks with the formation itself off screen (5381 d21) | Unchanged: self off screen on 6 of 8 presses, identical to run 18. | `critic/c19_ft_5381_d21.json` |
| Fleet "To its fight" (4877) | Holds: the British carrier group framed at 448 m/px, its wings "with its fleet, in the air". | `critic/c19_fp2_4877.json` |
| A broken format-1 save offered again after its refusal | Unchanged: refused with the plain message, and Continue offered again on the next visit. | `critic/c19_os_c10fmt1.json` |
| A `cfa73219` save through Continue | Loads whole (27 December 1957, its ticker). | `critic/c19_os_c18fmt1.json` |
| Editor fleets and the refusal on land (4877) | Holds: fleets placed, "Not done: no water of a sea is near the place." for Berlin; fleet counts by day equal to run 18's. The probe's 120-day wait timed out under the shared machine's load, twice (not a game fault). | `critic/c19_g_4877.json` |
| Nukes by God (4219) | Unchanged: Paris H-bomb 3,329,000 civilians, "Go to" alert. | `critic/shots/c19a_4219_14_paris_h_2h.png`, `critic/c19_a_4219.json` |
| History panel (7019 y20) | 4,154 events, opened in 115 ms. | `critic/c19_hi_7019.json` |
| Armour close up (7019) | Unchanged: armour ranks and tracers at 25 m/px. | `critic/shots/c19c_7019_arm_0025m.png` |
| Slowest year at Max (59.4 s, 6599 y17) | This run's slowest seed-year, 3301 y28, at Max in the page: **56.4 s**, 59.6 fps, longest gap 360 ms, none over 500 ms; two automatic pauses (nuclear alerts) resumed by the probe. | `critic/c19_l_3301.json`, `critic/c19_l_3301.log` |
| Not re-run | Year-20 page probes (decks, raids, late fronts): the worlds are identical (hashes), and their code paths unchanged. | — |

## New in this run: playing a nation (ADR-758, ADR-759)

| Case | What happened | Evidence |
|---|---|---|
| PA: Germany taken, war on Poland from the right-click menu (seed 5557) | Menu "Poland / Declare war / Propose alliance"; war on; ticker row. 4 German formations in contact on day 4. | `critic/c19_pa_5557.json`, `critic/shots/c19pa_5557_00_menu.png` |
| A formation in contact ordered 8 cells back | Selected by a click (camera follows it), marched 2.7 cells west in 24 h, out of contact from hour 4. As specified (a fighting withdrawal until first out of contact). | `critic/c19_pa_5557.json` (`withdraw`), `critic/shots/c19pa_5557_02_withdraw_day1.png` |
| A rear formation ordered 25 cells into Poland | Met the enemy at hour 24: stopped, and told: "Infantry division 8: not done: it met the enemy and stopped to fight. A new order pulls it back or pushes on, fighting as it goes." Stood in contact to hour 80, then the AI took it back west (as specified: "may undo at once"). | `critic/c19_pa_5557.json` (`rearRun`) |
| Order arrows at 3,000 / 250 / 25 m/px | 250 and 25 m/px: a dashed line with a dark edge to the target. **3,000 m/px: no arrow at all** for the selected, ordered formation (T0 draws none; the commit added T2/T3 only). | `critic/shots/c19pa_5557_03_rear_arrow_3000m_crop.png`, `…_250m.png`, `…_25m.png` |
| Ctrl+A (50 of Germany's formations) and a click on Warsaw at 3,000 m/px | 50 selected, the camera stays; 41 marched within 48 h. No arrows at that zoom; gold rings cover the German counters' numbers; **four three-line refusal rows fill the ticker** in 48 h ("…stopped to fight. A new order pulls it back or pushes on…" × 4). | `critic/c19_pa_5557.json` (`ctrlA`), `critic/shots/c19pa_5557_06_ctrlA_ordered.png`, `critic/shots/c19pa_5557_07_ctrlA_48h.png` |
| Army box unticked | Unordered formations moving: 3 (box on) → 0 (box off) over 3 days. The box works. | `critic/c19_pa_5557.json` (`movedArmyOn5d`, `movedArmyOff5d`) |
| PB: God placement, 30 armoured divisions of Poland's dropped in Berlin at peace (seed 6673) | 30 placed in 30 clicks, no gold, "Click the map to place: Armoured division. Esc to stop."; at 120 m/px a grid of blocks with tags. At peace they marched home east (14 cells in 10 days), Berlin untouched, no war. Then war declared from Germany's menu: Poland and 1 ally against Germany and 5 (Italy, Japan…), told only as "Poland declared war on Germany". Five days later the 30 divisions, 173k men beside Berlin, had not taken it. | `critic/c19_pb_6673.json`, `critic/shots/c19pb_6673_04_placed_berlin_120m.png`, `critic/shots/c19pb_6673_06_war_day5.png` |
| Right-click menu edges | No player: no menu. On the sea: no menu. At the window's right edge (Soviet ground at x 1590): the menu kept inside (1396–1574 px). | `critic/c19_pb_6673.json`, `critic/shots/c19pb_6673_00_menu_edge.png` |
| Map-mode menu, desktop | Eleven modes with their keys (Fallout has none); Escape closes it. Every option hit-testable at 1600, 1366, 1280, 1180, 1024, 820 and 768 px wide. | `critic/c19_p3_widths.json`, `critic/shots/c19pb_6673_07_mapmode_menu.png` |
| **Map-mode menu, phone (390 × 844)** | The menu opens (11 options, `display: flex`) but is **clipped by the bottom bar** (`.bottombar { overflow: auto }`): `elementFromPoint` at every option's centre hits the canvas or the legend, 0 of 11; a tap on "Terrain" times out; the mode stays Political. Before `c689c2e4` the button cycled the mode on a tap. | `critic/c19_p2_phone_menu.json`, `critic/shots/c19p2_phone_mapmenu_open.png`, `critic/c19_p3_widths.json` |
| PF: follow (seed 4441) | A click selects and follows; the formation marched 4.6 cells in 48 h and the camera kept it centred; wheel in and out keep the follow; a pan ends it (PT). | `critic/c19_pf_4441.json`, `critic/c19_pt_touch.json` |
| PS: save and load with a player's order and the navy box unticked (seed 1213) | Saved 2 h after the order; 72 h run (A) and 72 h after loading the save (B): **f5a1a6f2 both**. Boxes after the load as before; the selection is dropped (designed). | `critic/c19_ps_1213.json` |
| PT: touch on the phone | Tap selects; a short drag pans and ends the follow; a long press and drag box-selects 41; a tap on ground orders them. A long press on a foreign nation opens nothing: on a phone, war is declared only from the Actions tab. The formation panel covers the top 290 px of 844. | `critic/c19_pt_touch.json`, `critic/shots/c19pt_01_box_drawn.png`, `critic/shots/c19pt_02_box_done.png` |

## Dimensions

### Map visuals and readability: 7 (unchanged)

- **Tested:** Europe every 60 days for two years (3301); the selection and order lines at 3,000, 250, 25 m/px; 30
  placed divisions at 120 m/px.
- **Evidence:** `critic/shots/c19ww_3301_d720_europe.png`, `critic/shots/c19pa_5557_05_ctrlA.png`,
  `critic/shots/c19pa_5557_03_rear_arrow_250m.png`, `critic/shots/c19pb_6673_04_placed_berlin_120m.png`.
- **Better:** order lines close in are clear (dark edge, large head). **Worse:** at country zoom a large selection is a
  blob of gold rings over the counters, and no order line is drawn there. **AoC does better:** contiguous, readable blobs
  and names (`reference/screens/steam-screenshot-03.jpg`); late Iberia and Scandinavia are still patchworks (3301 day
  720: Italy holding Norway's north and Sweden's west).

### Diplomacy, war, alliance, puppet, revolt depth: 7 (unchanged)

- **Same worlds as run 18** (identity). **New:** war, peace and alliance from a right-click on the map; a peace now follows
  the offer in run 18's case, though nothing says the offer was answered (the AI may have made it). **Weak:** the allies pulled into a war the player declares are not told (Poland +1
  against Germany +5 shown only as one row, `c19_pb_6673.json`); the God revolt still told as a declared war.

### Emergent world dynamics over long runs: 7 (unchanged)

- **Same worlds as run 18**, 120 of 120 world-years equal. New seeds (not compared) sit in run 18's range. The reasons
  run 18 gave for not 8 stand.

### God Mode: 7 (unchanged)

- **Better:** any unit of the played nation placed at once, researched or not, refusal told at sea
  (`c19_pb_6673.json`, `critic/shots/c19pb_6673_02_place_tab.png`).
- **Not more:** Breakthrough silent at peace (`c19_k_2203.json`); revolt told as a declared war (`c19_q_6421.json`);
  God tools clipped on the phone (`c19_p.json`). A placed tank army of 173,000 men beside Berlin, at war, does nothing
  with it for five days (`critic/shots/c19pb_6673_06_war_day5.png`): the AI takes the placed units at once, so the God
  Mode player cannot make that army attack except by ordering it, unit by unit or by box.

### Editor and scenarios: 7 (unchanged)

- Fleets and a bomber group placed, the refusal on land (`c19_g_4877.json`). Unchanged code.

### Stats and history: 7 (unchanged)

- 4,154 events in 115 ms (`c19_hi_7019.json`); export a/b raw (`c19_dl_7019.csv`); identical carrier rows.

### UI/UX and polish: 7 (unchanged)

- **Better (verified):** playing a nation works as specified in every case tried (table above): selection by click,
  box, long press and Ctrl+A; the camera follow; orders kept until done; refusals told in words; war from the map; the
  menu kept inside the window; the AI boxes do what they say; save/load keeps it all.
- **Worse:** the phone's map modes are gone (blocking R19-B1); a mass order floods the ticker with identical three-line
  refusal rows (`c19pa_5557_07_ctrlA_48h.png`); no order lines at the zoom where mass orders are given; a long press on
  a foreign nation does nothing on touch. **Unchanged:** phone bar cut, God tools clipped, "To its fight" on land off its
  own formation, identical carrier rows.
- **Why not up:** the gains are real but each new piece came with a visible rough edge, and one regression.

### Performance: 7 (unchanged)

- **Tested:** HEAD against `cfa73219` at the same time on two cores, swapped, nine late seed-years and seed 99 × 5
  years (`critic/c19_pair_summary.json`); 0xFFFF-pinned reads started in quiet moments with the load sampled during
  each (`critic/c19_perf_summary.json`, `critic/c19_perfq.log`); the slowest seed-year at Max in the page
  (`critic/c19_l_3301.json`).
- **Same worlds, faster:** HEAD/old 0.923 (6599 y17), 0.940 (2539 y28), 0.946 (2617 y27), 0.964 (1307 y30), 0.966
  (3727 y25), 0.970 (8011 y26), 0.974 (1213 y26), 0.976 (4441 y26), 0.997 (3301 y28); seed 99 × 5 years 0.989. Hashes
  equal on every pair.
- **Against SPEC's 6.5 ms (ADR-757):** quiet pinned reads 6599 y17 5.53/5.64, 2539 y28 5.80/**5.95**, 1307 y30 5.78,
  3301 y28 (the slowest contended year of the new seeds, 9.14 ms in the batch) 5.38/5.43, 1213 y26 4.99, 2617 y27
  4.96 (4441 y26 5.55 was contended, ~12 cores in use by another session); seed 99 × 5 years 2.64 (b22bcdd1 at year 1,
  the pin). Every read under 6.5; the worst leaves 0.55 ms. Against the old 5.5, five of the ten clean reads are still over (and the contended 4441 read).
- **For the player:** 3301's year 28 at Max took 56.4 s with no gap over 360 ms (run 18's slowest year 59.4 s).
- **Why not up:** the gain is a few per cent and the budget was moved to meet the cost rather than the cost cut; late
  years still run at twice seed 99's early-year tick. **AoC:** text only.

### Stability: 7 (unchanged)

- **Held:** the world is deterministic and equal to run 18's (120 world-years); save and load with player orders and
  non-default AI boxes give the same hash after 72 h (`c19_ps_1213.json`); no page error in 24 page probes but the
  expected warning of the refused save (`c19_os_c10fmt1.json`); 8 headless worlds × 30 years without a throw.
- **Not more:** the broken format-1 save is still offered again on the next visit (`c19_os_c10fmt1.json`).

### Semantic zoom to unit level: 8 (unchanged)

- **Evidence:** `critic/shots/c19c_7019_arm_0025m.png`, `critic/c19_z_5861.json`, `critic/shots/c19pa_5557_03_rear_arrow_25m.png`.
- **Better:** the selection is framed at every zoom and the order line is drawn at T2/T3. **Not more:** land "To its
  fight" off its own formation on 6 of 8 (`c19_ft_5381_d21.json`); T0 has no order line.

### Naval warfare: 8 (unchanged)

- Same worlds; fleet "To its fight" and the carrier panel hold (`c19_fp2_4877.json`). Identical raid rows unchanged.

### Tanks: 8 (unchanged)

- `critic/shots/c19c_7019_arm_0025m.png`; 30 placed armoured divisions drawn as blocks with tags (`c19pb_6673_04_placed_berlin_120m.png`).

### Aircraft: 8 (unchanged)

- Same worlds as run 18; no air code changed but the AI's hands-off for a player's wing (not tested by a wing order).

### AI nuclear use: 8 (unchanged)

- Same worlds as run 18; God nukes unchanged (`c19_a_4219.json`). Nuclear strikes are a box of their own, unticked when
  a nation is taken (`c19_pa_5557.json` `boxes`), as ADR-759 says.

## Blocking issues, in priority order

R18-B1 is resolved (above). One new:

1. **R19-B1. On a phone the map modes cannot be chosen: the new map-mode menu is clipped by the bottom bar.**
   - `c689c2e4` replaced the map button's cycle-on-tap with a menu. The menu is a child of `.bottombar`, which has
     `overflow: auto` and on a phone scrolls sideways (scrollWidth 839 in 366 px). At 390 × 844 the menu opens
     (247–434 px × 560–802 px, 11 options) but is clipped: 0 of 11 options are hit by `elementFromPoint`, a tap on
     "Terrain" times out, the mode stays Political. Every desktop and tablet width tried (768–1600 px) is fine. The
     phone has no keys 1–0, so there is no other way: a claimed feature (map modes, SPEC's touch support) lost for every
     phone player by the latest commit.
   - **Evidence:** `critic/c19_p2_phone_menu.json`, `critic/shots/c19p2_phone_mapmenu_open.png`,
     `critic/shots/c19p2_phone_after_tap.png`, `critic/c19_p3_widths.json`.
   - **Fix and bar:** render the menu outside the scrolling bar (a portal or `position: fixed` at the button's rect),
     or let the button cycle on touch; bar: at 390 × 844 every option hit-testable and a tap changes the mode.

## Non-blocking issues

1. **No order lines at country zoom (T0, above 2,000 m/px)**, where a Ctrl+A order is most likely given: 50 divisions
   sent to Warsaw show nothing but gold rings (`c19pa_5557_06_ctrlA_ordered.png`, `c19pa_5557_03_rear_arrow_3000m_crop.png`).
2. **A mass order floods the ticker** with identical three-line refusals, one per formation that meets the enemy (four
   in 48 h for one Ctrl+A order, `c19pa_5557_07_ctrlA_48h.png`). Fix: one row per order ("4 of 50 stopped to fight").
3. **Selection rings hide the counters' numbers** at country zoom (`c19pa_5557_05_ctrlA.png`).
4. **Allies drawn into a war the player declares are not told** (`c19_pb_6673.json`).
5. **No war from the map on touch** (a long press on a foreign nation does nothing; `c19_pt_touch.json`).
6. **Unchanged from run 18:** identical carrier strike rows; worn wings count as manned decks; hollow levies on late
   fronts; 6421's idle front; the broken format-1 save offered again; Breakthrough silent; God revolt as a declared war;
   phone God tools clipped and bar cut; export a/b raw; land "To its fight" off its own formation; editor carriers empty.

## Design objections (none blocking, no score lowered)

- **The budget raised instead of the cost cut (ADR-757):** the late tick is now measured against 6.5 ms. HEAD does meet
  it, and is a few per cent faster than run 18's build, but the late years still cost twice seed 99's early years, and
  the room is only the margin of the quiet reads.
- **The AI takes God-placed units at once (ADR-759):** a God Mode player who drops an army to see what it does sees it
  marched home (`c19_pb_6673.json`); a "placed units hold until ordered" option would serve that player.
- **A player's march that meets the enemy is cancelled (ADR-759):** a broad-front push by box or Ctrl+A turns into a line
  of halted divisions and refusal rows, each to be ordered again.

## Notes

- The machine was shared with another session's capture/build loop from about 14:24; contended batch timings are a trend.
  Paired same-time ratios and quiet-gated pinned reads are what the Performance verdict rests on.
- `cfa73219` worktree at `critic/wt` for timing; its `node_modules` junction unlinked before `git worktree remove`.
- Port 5339 stopped at the end.

## Strengths, verified

- **Playing a nation finally feels like playing:** the fronts keep fighting when taken, orders are kept until done and
  refused in plain words, war is a right-click away, and all of it survives a save and load to the same hash.
- **The world is stable to the bit:** 120 of 120 world-years equal to run 18's build, a few per cent faster.

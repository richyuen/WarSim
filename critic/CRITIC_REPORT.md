# Critic report, run 13

- **Commit:** `0c80db1ef2224a8ad3813d68d5c085e83159a106`. Run 12 was on `896ff77`; 92 commits since (the threatened
  sectors first, 7.79b; capitals to the safest city, 7.81b; the treaty's pockets, 7.80b; the ferry's turn and lift,
  7.88–7.90; a carrier's wing drawn over its target, 7.84b; the war across the sea, 7.82d; the cadre division at war,
  7.100; the tank's flash and the sea-side file, 7.102–7.103; several tasks closed not done by the user's decisions).
- **Date:** 2026-10-24.
- **Build:** `vite build --outDir critic/c13_dist`, exit 0 (`critic/c13_build.log`), served with `vite preview` on
  port **5313**. For same-session page timing, `896ff77` built from a worktree (`critic/wt`) into `critic/c13_olddist`
  and served on **5314**. Chromium through Playwright, headless, 1600 × 900 (also 390 × 844 and 1280 × 720).
- **Runs:**
  - 40 unaided headless worlds × 30 years (`critic/scripts/c13_batch.sh`, `c13_headless.ts`, same script as run 12):
    **run 12's 32 seeds for a same-seed comparison** (`c12_*` files are `896ff77`, `c13_*` are HEAD) and 8 new seeds
    (1061, 2417, 3253, 4561, 5521, 6833, 7351, 8423). Comparison: `critic/c13_cmp_all.txt` / `critic/c13_cmp.json`
    (`c13_cmp.py`). Checkpoints at years 10 and 20 (engaged land formations over 7 days, small pieces and enclaves,
    hollow divisions), each commit's saves read by its own code: `critic/c13_cmp_checkpoints.json` (`c13_cmp2.py`).
  - Performance: seed 99 and seed 4219 × 5 years pinned, alone, on both commits; year 21 of 4877 from each commit's own
    year-20 save, profiled; 10 years at Max in the page (3301) and the 3 late years at Max (4877, from year 20) on both
    builds in the same session, one at a time.
  - In the page: four late worlds watched 60 days each (1129 y10, 4877/6421/7019 y20), the AI's nuclear exchange
    (1129 year 15), the pause on a nuclear strike, God tools, the editor, phone and laptop widths, sea battles and a
    carrier strike, a continuous wheel zoom, tank fights at 25 m/px, the random world.
- **Reference:** `reference/text/AOC_TEXT_NOTES.md`, `reference/screens/`. AoC's nukes, God tools and performance are
  known from text only; my confidence is lower there.
- **Prefix:** every path below was made in this run (prefix `c13`, `c13o` = the old build). Scripts are in
  `critic/scripts/c13_*`.

## Verdict

**Both of run 12's blockers moved the right way on the same 32 seeds; one is still blocking, and the late game now
runs at half speed.**

- **Land war after year 1 (R12-B1):** engaged land formations per war after year 1 0.34 → **0.57** a day (year 1:
  5.16); at the year-10/20 checkpoints 1.50 → **4.09** engaged, checkpoints with nobody in contact 24 → 10 of 64.
  A player can now find a real late front (1129, year 10: 13–51 engaged a sample, Germany against the US across Italy
  with a contact line). But contact after year 1 is still **11 % of year 1's**, and three of the four late worlds I
  watched in the page show 0–4 engaged for most of 60 days while 6–11 wars run.
- **The late map (R12-B2):** small pieces at year 20 1,174 → **1,035** a world (lower on 28 of 32 seeds); enclaves at
  peace 362 → 210. Still 1,051 against `dd3b730`'s 837 on run 11's 24 seeds (above on 23 of 24). The remainder is the
  reserve cut's price by the user's decision (ADR-639), so it is no longer a blocker. 7247's Russia, run 12's worst
  case, now reads as blocks instead of confetti.
- **New, measured on both builds in one session:** the late game at Max takes **46–59 s a game year** on HEAD
  against **23–32 s** on `896ff77` (4877 from year 20). Headless, year 21 of 4877 ticks 4.42 ms against 1.82 ms,
  with the operational AI at 2.04 ms against 0.54. Over 30 years on 32 same seeds the mean tick is slower on **32
  of 32**, and +57 % at year 20. The cost per cell changing hands is not higher (the operational AI 2.3e-5 ms a tick
  per cell flipped in the year, against 2.6e-5): it is the busier world, whose cost the user accepted (ADR-654 a), so
  it is not a blocker; the user sent the felt speed to this report (ADR-666 a), and the performance score takes it.
- **Also new:** hollow divisions. Land formations under 500 men at year 20 are 36 → **64** a world (more on 28 of 32
  seeds). A "Heavy armoured division" of 2 men and an "Infantry division" of 66 stand on the late fronts.

**Fixed and verified:** the stale map tooltip (seventh run: no stale text in any of three probes); a carrier strike's
row now frames the carrier and the struck ships with the strike's planes over them. **Improved:** capital moves per
capture 2.12 → 1.33, still above the user's bar of 1.25 (ADR-639).

## Scores

| Dimension | Run 12 | Run 13 |
|---|---|---|
| Map visuals and readability | 6 | **7** |
| Diplomacy, war, alliance, puppet, revolt depth | 7 | 7 |
| Emergent world dynamics over long runs | 6 | 6 |
| God Mode | 7 | 7 |
| Editor and scenarios | 7 | 7 |
| Stats and history | 7 | 7 |
| UI/UX and polish | 7 | 7 |
| Performance | 6 | **5** |
| Stability | 7 | 7 |
| Semantic zoom to unit level (needs 8) | 8 | 8 |
| Naval warfare (needs 8) | 7 | 7 |
| Tanks (needs 8) | 8 | 8 |
| Aircraft (needs 8) | 7 | 7 |
| AI nuclear use (needs 8) | 7 | 7 |

## Run 12's cases re-run

| Run 12 case | On HEAD | Evidence |
|---|---|---|
| R12-B1: 1.52 engaged at the y10/y20 checkpoints (24 seeds); 0.34 a war a day after year 1 against 5.1 in year 1 | Same script, run 12's 32 seeds, both commits: checkpoints **1.50 → 4.09** engaged (43 of 64 higher, 15 lower), zero-contact checkpoints 24 → 10, wars 6.9 → 8.0. Daily, after year 1: **0.34 → 0.57** a war (year 1: 5.10 → 5.16); all engaged after year 1 2.11 → 4.15 against 33.7 → 40.3 in year 1 (ratio 6.3 % → 10.3 %). New seeds: 0.71 a war at the checkpoints, 3.92 daily after year 1. | `critic/c13_cmp_checkpoints.json`, `critic/c13_cmp_all.txt`, `critic/c13_engaged_w1.json`…`w5.json`, `critic/c13_old_engaged_new8.json` |
| R12-B1 in the page: 6421 year-21 Germany–Soviet war, 0–2 engaged over 60 days | 6421's year 20 on HEAD is another world (the US holds Russia's south): 14, 16, 21, 6, 4, 3, 2 engaged at 10-day marks. 1129 year 10: 2, 15, 31, **51**, 50, 15, 13 (Germany against the US in Italy). 4877 year 20: 0, 4, 3, 0, 0, 2, 0 with 7 wars. 7019 year 20: 0, 0, 16, 3, 0, 0, 2 with 6 wars. | `critic/c13_y2_6421_y20.json`, `critic/c13_y2_1129_y10.json`, `critic/c13_y2_4877_y20.json`, `critic/c13_y2_7019_y20.json`, `critic/shots/c13y2_1129_y10_d30_250m.png`, `critic/shots/c13y2_4877_y20_d30_3000m.png` |
| R12-B1: 60 idle US divisions at war in one place (1129, y10) | Same seed and year: the largest idle pile is 15 US divisions (was 60); over 8 seeds idle land formations 52 % → 45 %. Still 40 US divisions (367,096 men) idle at war on 8693. | `critic/c13_stacks_y10_w1.json`, `critic/c12_stacks_y10_w1.json` |
| R12-B2: pieces of 2–400 cells at year 20, 1,174 a world | Same 32 seeds, each save read by its own commit's code: **1,174 → 1,035** (higher on 4 of 32); enclaves (rim one other holder) 417 → 259; **at peace 362 → 210**; at war 55 → 49. Against `dd3b730` on run 11's 24 seeds: 837 → 1,051 (above on 23 of 24). New seeds: 981. | `critic/c13_cmp_checkpoints.json` (`frag2`, `frag_vs_dd3b730`), `critic/c13_frag2_w*.json`, `critic/c13_old_frag2_w*.json` |
| R12-B2 in the page: 7247 Russia confetti, 6421 red islands in orange | 7247 year 20: Russia is solid Soviet red with block-shaped neighbours; the German-grey mottling and the blue pockets are gone. 6421 year 20 (another world): Russia still mixes Soviet red, German grey and US blue in large blocks. | `critic/shots/c13x_7247_y20_eurasia.png` against `critic/shots/c12x_7247_y20_eurasia.png`; `critic/shots/c13x_6421_y20_eurasia.png` |
| Seed 99 tick 1.785 / 1.790 ms (budget 1.5) | **2.542 / 2.577 ms** on HEAD, 1.790 ms on `896ff77` in the same session (hash 09167f24, run 12's figure reproduced); year 4 3.55 ms, p95 17.6 ms; operational AI 1.58 ms of it. Seed 4219: 2.071 against 2.091 ms (no change). | `critic/c13_perf_seed99_5y_head1.log`, `…_head2.log`, `critic/c13_perf_seed99_5y_896ff77.log`, `critic/c13_perf_seed4219_5y_*.log` |
| Late page at Max, 4877 from year 20: 23.2, 32.2, 27.1 s a year | Same session, one build at a time: HEAD **46.3, 59.4, 59.4 s**; `896ff77` 23.2, 32.2, 28.1 s (run 12's figures reproduced). 59.7–60 fps both. | `critic/c13_l_4877_alone.json`, `critic/c13o_l_4877.json` |
| 10 years of 3301 at Max | Same session: HEAD 276 s, `896ff77` 211 s; years 7–10 29–33 s against 16–21 s. Year-end engaged on HEAD 38, 4, 0, 3, 2, 0, 7, 0, 2, 0. | `critic/c13_w_3301.json`, `critic/c13o_w_3301.json` |
| Stale map tooltip (sixth run) | **Fixed.** After a wheel-out to 24,738 m/px the tip names French West Africa, which is under the mouse (`tip1`); after razing Prague under the mouse the tip reads "Czechoslovakia / Occupied by Germany", no city named; no tip floats over Paris after a Go to. | `critic/c13_h_1307.json`, `critic/shots/c13h_1307_01_tip_after_wheel_out.png`, `critic/c13_s_6421.json`, `critic/shots/c13a_4219_20_paris_150m_day10.png` |
| Carrier strike shows no aircraft when its row is clicked (8693) | **Fixed.** "⚓ Carrier strike: Japan on United States's ships" clicked frames the Japanese carrier group and the two US destroyer flotillas, three planes over them (`sorties` 2); 4 s later one flotilla is down to 250 men under a burst. | `critic/c13_n4.log`, `critic/shots/c13n4_8693_rowless_clicked.png`, `critic/shots/c13n4_8693_rowless_live4s.png` |
| Every sea battle has a ticker row (8693, 20 days) | Holds: 80 samples, never a battle the view knows without a DOM row. | `critic/c13_n_8693_JAP_USA.json` |
| Moving capital captured again and again; 919 moves a world | Same seeds: moves per capture **2.12 → 1.33** (894.8 / 421.2 → 662.9 / 497.6), above the user's 1.25 bar (ADR-639). Still seen: "Germany captured Spanish Republic's capital" on 17 and 19 January 1948 (1129). | `critic/c13_cmp_all.txt` (`eventsPerWorld`), `critic/shots/c13y2_1129_y10_d30_3000m.png` |
| Breakthrough at peace does nothing visible (2203) | Unchanged: no ticker row, no refusal, Germany "At peace", the border unmoved on day 7 (the engaged count that rises is Japan–China). | `critic/c13_k_2203.json`, `critic/shots/c13k_2203_01_day7_1500m.png`, `critic/shots/c13k_2203_02_engaged_80m.png` |
| God revolt told as a declared war | Unchanged: "1 January 1938 Germany declared war on Free Saxony". | `critic/c13_q_6421.json` |
| Phone: God tools clipped | Unchanged: "Revo", "Spawn n", "Breakthr", "Territo", "Found c", "Raze c"; war chips under the legend. | `critic/shots/c13p_phone_02_GodMode.png`, `critic/shots/c13p_phone_03_played.png` |
| Title's Cancel / file input unstyled | Unchanged (seventh run). | `critic/shots/c13g_4877_10_title_pending.png` |
| Editor North Sea standoff (4877) | Unchanged and working: "Germany and United Kingdom fought at sea: Germany lost 20 ships, United Kingdom 16" on day 2. | `critic/c13_g4.log`, `critic/c13_g_4877.json` |
| Editor-armed Poland bombs Berlin (9437) | Berlin on 2 February, 334,000 civilians and 392 men; then "Poland lost its last means to deliver its warheads: Germany took its airbase near Warsaw" (no Mannheim or Prague this time). ADR-632 b. | `critic/c13_g2_9437_POL.json` |
| Restraint lines (1129, year 20) | Consistent: the UK "is a puppet: its warheads stay in store…", Japan "is deterred by Germany", Germany and the US "see no target worth a warhead". | `critic/c13_t_1129.json` |
| Stasis 21 years (24 seeds) | Same 32 seeds: worlds with a top-5 stasis over 20 years 3 → 1, but the longest 22 → **25** (3491). New seeds: 15 at most. | `critic/c13_cmp_all.txt` |
| Browser = headless | 3 of 3 year hashes equal on 1307 (f9af6f16, c766dcce, 750f4ff3); save/load twin equal (3.91 MB). | `critic/c13_h_1307.json` |
| History noise (4877, 3 late years) | 5,282 rows (4,317): "Land handed over" 1,075, "Air raids" 797; **"Major battle" 102 (27)**. | `critic/c13_l_4877.json` (`historyTypes`), `critic/c12_l_4877.json` |
| Aircraft at 3 m/px fill the screen | Unchanged: three plane silhouettes about 140 px wide over the infantry at the end of the wheel zoom. | `critic/shots/c13z_5861_17.png` |

## Dimensions

### Map visuals and readability: 7 (up from 6)

- **Tested:** small pieces and enclaves at year 20 on 32 same seeds (each commit's own saves and code) and 8 new;
  the year-20 world and Eurasia in the page on 7247, 6421, 4877, 1129; a decade of 3301 at 3,000 and 12,000 m/px.
- **Evidence:** `critic/c13_cmp_checkpoints.json`, `critic/shots/c13x_7247_y20_eurasia.png`,
  `critic/shots/c12x_7247_y20_eurasia.png`, `critic/shots/c13x_6421_y20_eurasia.png`,
  `critic/shots/c13x_1129_y20_eurasia.png`, `critic/shots/c13x_4877_y20_world.png`,
  `critic/shots/c13w_3301_y10_europe.png`.
- **Why up (same seeds, both commits):** pieces 1,174 → 1,035, lower on 28 of 32; enclaves at peace 362 → 210. Run
  12's worst case, 7247's Russia, was German grey and Soviet red mottled over thousands of kilometres; it is now one
  red mass with block-shaped neighbours. 1129's Europe at year 20 is large blobs. What remains above `dd3b730` is the
  reserve cut's price (ADR-639), so I judge the map as it is, not the count.
- **Still weak:** 6421 year 20 mixes Soviet red, German grey and US blue in large interlocked blocks; 3301's Britain
  at year 10 is UK pink and US blue patches during the war. Late Eurasia uses three or four near-identical reds side
  by side (7247: Soviet red, maroon, pink), hard to tell apart without hovering. Hollow divisions clutter late fronts
  (see Semantic zoom).
- **AoC does better:** late worlds as contiguous blobs (`reference/screens/community-dominated-world-a.png`).

### Diplomacy, war, alliance, puppet, revolt depth: 7 (unchanged)

- **Tested:** event counts of 32 worlds × 30 years on both commits; history types over 3 late years.
- **Evidence:** `critic/c13_cmp_all.txt` (`eventsPerWorld`), `critic/c13_l_4877.json`.
- **Same seeds:** wars declared 431 → 521 a world; revolts 125 → 195; annexations 40 → 59; revivals 35 → 46;
  puppets 72 → 73. World-years after year 10 with at most one war 22 → 1.
- **Not more:** the added volume is revolts and statelets (founded nations alive at year 30 23 → 37), the same churn
  run 12 called noise.

### Emergent world dynamics over long runs: 6 (unchanged)

- **Tested:** 40 worlds × 30 years; the same 32 seeds on both commits; four late wars watched in the page.
- **Evidence:** `critic/c13_cmp_all.txt`, `critic/c13_cmp_checkpoints.json`, `critic/c13_y2_*.json`.
- **Better:** a war is running in nearly every late world-year (≤ 1 war: 22 → 1); the last five years move 24–70 %
  of the land (9–59 %); worlds stuck over 20 years 3 → 1; contact per war after year 1 0.34 → 0.57.
- **Not higher, because:** contact is still 11 % of year 1's (R13-B1); the churn grew in statelets (revolts +56 %,
  founded nations alive at year 30 +58 %); the longest stasis on the same seeds rose to 25 years (3491). The cadre rule
  was committed by the user's override of its stasis condition (ADR-673), so the stasis figure is noted under Design
  objections and does not lower this score.

### God Mode: 7 (unchanged)

- **Tested by clicks:** Revolt, Spawn nation, Found city, Raze city (6421); H-bomb on Paris, A-bomb on London (4219);
  Breakthrough from Berlin to Warsaw at peace (2203).
- **Evidence:** `critic/c13_q_6421.json`, `critic/c13_a_4219.json`, `critic/c13_k_2203.json`,
  `critic/shots/c13a_4219_13_paris_h_strike.png`, `critic/shots/c13k_2203_01_day7_1500m.png`.
- **Works:** each act told in the ticker; the H-bomb on Paris, 3,329,000 civilians, with its ruin.
- **Weak (unchanged):** Breakthrough at peace silently does nothing; the God revolt is told as "Germany declared war on
  Free Saxony". **AoC does better:** its Spawn Major Battle needs no war already running.

### Editor and scenarios: 7 (unchanged)

- **Tested:** fleets for Germany and Britain in the North Sea, a bomber group and warheads for Poland, export, the
  title's Cancel and Start, play; the random world.
- **Evidence:** `critic/c13_g_4877.json`, `critic/c13_g4.log`, `critic/c13_g2_9437_POL.json`,
  `critic/shots/c13g_4877_10_title_pending.png`, `critic/shots/c13r_02_year1.png`.
- **Works:** placed navies fight on day 2; the editor now has a Terrain brush (the brush list reads "Nation, Terrain").
- **Weak:** the title's Cancel button and file input are browser defaults (seventh run).

### Stats and history: 7 (unchanged)

- **Tested:** the history's filter over 3 late years, charts after a decade, the nuclear charts, restraint lines.
- **Evidence:** `critic/c13_l_4877.json`, `critic/shots/c13w_3301_z_charts.png`,
  `critic/shots/c13f_1129_82_chart_nukedead.png`, `critic/c13_t_1129.json`.
- **Better:** "Major battle" rows in the 3 late years 27 → 102, so the log now records late fighting.
- **Weak:** louder again, 5,282 rows in 3 years (4,317); "Land handed over" 1,075 and "Air raids" 797 of them.

### UI/UX and polish: 7 (unchanged)

- **Tested:** keys, settings, a nation panel, phone and laptop widths with every bottom-bar panel, the tooltip in three
  probes, the nuclear alert and its pause at Max.
- **Evidence:** `critic/c13_m.json`, `critic/c13_p.json`, `critic/shots/c13p_phone_02_GodMode.png`,
  `critic/c13_h_1307.json`, `critic/c13_np_1129.json`, `critic/shots/c13np_1129_paused.png`.
- **Better:** the stale tooltip is gone.
- **Worse (new, HEAD only, not compared):** of two AI strikes a day apart (the UK near Molepolole on 25 October 1952,
  the US on London on 26 October), only the second ever gets an alert banner, and at Max the game stops with the
  bottom bar reading 1 November, a week past the strikes. In-page probe at 10 ms: no alert until tick 130045; the
  strikes were at ticks 129866 and 129890 (155 and 179 game hours earlier, about a second of wall time at Max). Both
  mushroom clouds are still on the map when it pauses.
- **Weak (unchanged):** phone God tools clipped; war chips under the legend on a phone.

### Performance: 5 (down from 6)

- **Tested:** seed 99 and seed 4219 × 5 years, pinned, alone, each on both commits; year 21 of 4877 profiled from each
  commit's own year-20 save; 3 late years at Max and 10 years at Max in the page on both builds, same session, one at a
  time; the mean tick over 30 years on the same 32 seeds (both batches 8 at a time).
- **Evidence:** `critic/c13_perf_seed99_5y_head1.log`, `critic/c13_perf_seed99_5y_head2.log`,
  `critic/c13_perf_seed99_5y_896ff77.log`, `critic/c13_perf_seed4219_5y_head.log`,
  `critic/c13_perf_seed4219_5y_896ff77.log`, `critic/c13_perf_4877_y21_head.log`,
  `critic/c13_perf_4877_y21_896ff77.log`, `critic/c13_l_4877_alone.json`, `critic/c13o_l_4877.json`,
  `critic/c13_w_3301.json`, `critic/c13o_w_3301.json`, the `tickMs` rows of `critic/c13_headless_*.json` and
  `critic/c12_headless_*.json`.
- **Why down (same seeds, both commits, same session):**
  - The late game in the page at Max: **46–59 s a game year** against 23–32 s (4877 from year 20). Ten years of 3301:
    276 s against 211 s, years 7–10 29–33 s against 16–21 s.
  - Headless, year 21 of 4877: 4.42 ms a tick against 1.82 (p95 26.2 against 12.6 ms). The operational AI is 2.04 ms
    of it (0.54), the invasion AI 0.36 (0.09). That world flips 89,542 cells in the year against 20,708.
  - Seed 99: 2.54–2.58 ms against 1.79 (+43 %), year 4 3.55 ms. Seed 4219 is unchanged (2.07 against 2.09).
  - 30 years × 32 same seeds: mean tick 2.87 → 3.88 ms, slower on 32 of 32; year 20 2.90 → 4.55, year 30 3.09 → 4.91.
  - Frame rate holds at 59.6–60 fps, longest tick gaps 160–334 ms.
- **Attribution:** it is the busier late world (the war run 12 asked for), not dearer code: the operational AI costs
  2.3e-5 ms a tick per cell flipped in year 21 against 2.6e-5 on `896ff77`, and seed 4219, as busy on both, is flat.
  The user accepted that the budget counts the rules' cost, not the war's size (ADR-654 a), so the slowdown is not a
  blocker (Design objections). The score is how well the busier world is run: the user closed 7.94 not done and sent
  performance to this report (ADR-666 a), and the player now waits about a minute at Max for a late game year.
- **AoC:** known from text only (it advertises repeated performance work).

### Stability: 7 (unchanged)

- **Evidence:** `critic/c13_h_1307.json` (3/3 hashes, twin equal); `errors` empty in every `critic/c13_*.json` from the
  page (the one `fatal`, `c13_g_4877.json`, is my script waiting at Max while the nuclear pause had stopped the game,
  as in run 12). No crash, desync or console error in any session; 40 headless worlds ran 30 years without a throw.

### Semantic zoom to unit level: 8 (unchanged)

- **Tested:** Germany–Poland at 3,000 to 10 m/px (7019); a continuous wheel zoom 6,000 → 3 m/px (5861); late fronts
  at 3,000, 250 and 25 m/px (6421 y20, 1129 y10).
- **Evidence:** `critic/c13_c_7019.json`, `critic/shots/c13c_7019_arm_0025m.png`, `critic/shots/c13c_7019_arm_15m_live_1.png`,
  `critic/shots/c13z_5861_13.png`, `critic/shots/c13z_5861_17.png`, `critic/c13_u_6421.json`,
  `critic/shots/c13u_6421_f0_0025m.png`, `critic/shots/c13u_6421_f1_0025m.png`, `critic/shots/c13y2_1129_y10_d30_250m.png`,
  `critic/shots/c13y2_6421_y20_d00_250m.png`, `critic/c13_cmp_checkpoints.json` (`hollow`).
- **Why 8:** ranks of tanks and men, tracers, flashes and a contact line at 25 m/px in year 1; a late front that can be
  zoomed into exists now (1129's Italy at 250 m/px). Nothing like it in AoC.
- **Not more:** late fronts are often remnants. At 6421's year-20 Lake Van front the labels read 2, 31, 66, 76, 121,
  325 men ("Heavy armoured division 708: 2"); at 25 m/px a 460-man Tibetan cadre faces US divisions of 654 and 421
  and almost nothing is drawn. Divisions under 500 men at year 20: 36 → 64 a world (28 of 32 seeds), mean division
  8,928 → 6,755 men. The wheel zoom still ends on three plane silhouettes larger than a company.

### Naval warfare: 7 (unchanged)

- **Tested:** sea battles over 40 × 30 years; Japan–USA 20 days with DOM rows (8693); a carrier strike's row clicked;
  the editor standoff.
- **Evidence:** `critic/c13_cmp_all.txt`, `critic/c13_n_8693_JAP_USA.json`, `critic/shots/c13n4_8693_rowless_clicked.png`,
  `critic/shots/c13n4_8693_rowless_live4s.png`.
- **Better:** the carrier strike is now drawn and framed (run 12's "no aircraft" fixed).
- **Same seeds:** late sea battles 9.04 → 9.37 a world-year; battles sinking nothing 3.6 % → 7.2 %.
- **Why not 8:** the late sea war is still a fraction of year 1's (57.6 battles in year 1, 9.4 a year after), and a
  carrier strike is three silhouettes over two counters on open sea. **AoC has no navy.**

### Tanks: 8 (unchanged)

- **Tested:** German armour against Polish infantry (7019, 3613) at 25, 15 and 80 m/px, live.
- **Evidence:** `critic/shots/c13c_7019_arm_0025m.png`, `critic/shots/c13c_7019_arm_15m_live_1.png`,
  `critic/shots/c13e_3613_arm_lvl0_25m_4.png`, `critic/c13_e.log`.
- **Why 8:** tank ranks against Polish blocks with tracers, burning hulls and a contact line. **Remaining:** late
  armour is often hollow (a heavy armoured division of 2 men) and late contact is thin (R13-B1).

### Aircraft: 7 (unchanged)

- **Tested:** sorties per tier (7019, 6421 y20); air battles per year on 40 worlds; planes at 3 m/px.
- **Evidence:** `critic/c13_c_7019.json`, `critic/c13_u_6421.json`, `critic/c13_cmp_all.txt`.
- **Same seeds:** air battles in year 1 2,868 → 2,599; after year 1 155 → **121** a world-year (−22 %); sorties aloft
  after year 1 10.9 both. The user closed 7.99 and 7.101 not done (ADR-672, ADR-674). **AoC has no air war.**

### AI nuclear use: 7 (unchanged)

- **Tested:** 962 bursts on 40 worlds; the AI's exchange in the page (1129 year 15: the UK on the US army near
  Molepolole, the US on London a day later); the restraint lines; Poland armed in the editor.
- **Evidence:** `critic/c13_cmp_all.txt`, `critic/c13_cmp.json`, `critic/c13_f_1129.json`,
  `critic/shots/c13f_1129_11_goto.png`, `critic/shots/c13f_1129_11_ruin_200m.png`, `critic/c13_t_1129.json`.
- **Same seeds:** bursts 642 → 783 (32 of 32 worlds see one); bursts killing a million civilians or more 11 → 6; no
  burst under utility 0.1 kills a million (both); one spot struck twice within a year 1 → 2.
- **Why not 8:** an answer in kind on the capital: the UK kills 67,951 US soldiers in Bechuanaland and the US answers
  on London, 248,000 civilians and 160 men, the next day. The page tells it plainly, ruin and all, but the pause and
  alert at Max come a week late (UI). The largest burst: the Spanish Republic on Britain, 3,125,000 civilians for
  2,032 men (7583, year 26). Inside SPEC §6.4 as the user decided it (Design objections). **AoC's nukes are God-only.**

## Blocking issues, in priority order

1. **R13-B1. The land war after year 1 is still thin (R12-B1, improved, not fixed).**
   - Same 32 seeds, both commits: engaged per war a day after year 1 0.34 → 0.57, against 5.16 in year 1 (11 %);
     all engaged after year 1 2.11 → 4.15 a day against 40.3 in year 1; checkpoints 1.50 → 4.09, 10 of 64 with
     nobody in contact (24).
   - In the page: 4877 year 20, 0–4 engaged over 60 days with 7 wars; 7019 year 20, 0 in 5 of 7 samples with 6 wars;
     3301's year ends 0–7. The good case exists (1129 year 10, up to 51 engaged in Italy), but a player cannot count
     on finding one.
   - **Evidence:** `critic/c13_cmp_checkpoints.json`, `critic/c13_cmp_all.txt`, `critic/c13_y2_4877_y20.json`,
     `critic/c13_y2_7019_y20.json`, `critic/c13_y2_1129_y10.json`, `critic/shots/c13y2_4877_y20_d30_3000m.png`,
     `critic/c13_w_3301.json`.
   - **Fix:** keep raising contact per war after year 1 toward a real fraction of year 1's, on unseen seeds, with a bar.
     The armies are there (439 land formations of nations at war per checkpoint) but stand idle or arrive hollow.

## Non-blocking issues

- **The late game at half speed** (see Performance and Design objections): 4877's years 21–23 at Max 46–59 s against
  23–32 s on `896ff77`, same session (`c13_l_4877_alone.json`, `c13o_l_4877.json`).
- **Hollow divisions:** land formations under 500 men at year 20 36 → 64 a world (28 of 32 same seeds); "Heavy
  armoured division 708: 2 men" on the map (`c13y2_6421_y20_d00_250m.png`, `c13_cmp_checkpoints.json`).
- **Nuclear pause and alert late at Max:** the pause comes 155 game hours after the strike; of two strikes a day
  apart, only the second gets a banner (`c13_np_1129.json`, `c13np_1129_paused.png`).
- **Late air war down 22 %** on the same seeds (155 → 121 air battles a world-year).
- **Sea battles that sink nothing** 3.6 % → 7.2 %.
- **Breakthrough at peace silently does nothing** (`c13_k_2203.json`).
- **God revolt told as a declared war** (`c13_q_6421.json`).
- **Phone: God tools clipped**; war chips under the legend (`c13p_phone_02_GodMode.png`).
- **A moving capital still taken twice in days** ("Germany captured Spanish Republic's capital", 17 and 19 January 1948).
- **History noise:** 5,282 rows in 3 years, 1,075 "Land handed over".
- **Late Eurasia's reds:** Soviet red, maroon and pink nations side by side (`c13x_7247_y20_eurasia.png`).
- **Title's Cancel and file input unstyled** (`c13g_4877_10_title_pending.png`).
- **Aircraft at 3 m/px larger than a company** (`c13z_5861_17.png`).

## Design objections (none blocking, no score lowered)

- **The busier world's cost** (ADR-654 a, ADR-666 a): the same seed's late years at Max take 46.3, 59.4 and 59.4 s on
  HEAD against 23.2, 32.2 and 28.1 s on `896ff77`; headless year 21 of 4877 4.42 against 1.82 ms a tick; the mean
  tick over 30 years slower on 32 of 32 same seeds (+57 % at year 20). Per cell changing hands the cost is not higher,
  so this is the price of the war the user chose to pay for. I think a minute per late game year at Max is more than
  a player watching 30 years will sit through; the Performance score reflects how well the busier world is run, not
  this choice.
- **The late map's count** (ADR-639 b): what 7.80b leaves above `dd3b730` (1,051 against 837 small pieces at year 20)
  is the user's price for the reserve cut's war. The map reads better; I still think AoC's blobs are the look players
  expect.
- **The cadre rule against the stasis condition** (ADR-673): on run 12's 32 seeds the longest stasis rose 22 → 25
  years (3491) while worlds over 20 years fell 3 → 1. The user took the share over the stasis; noted, not scored.
- **Nuclear volume and cities** (SPEC §6.4, ADR-632 b, ADR-660 a): bursts 642 → 783 on the same seeds; the largest,
  the Spanish Republic's H-bombs on Britain, 3,125,000 and 1,114,000 civilians for 2,032 and 16,783 men (7583). An
  answer in kind lands on a capital (1129: London for an army in Bechuanaland). A player will read these as massacres.

## Notes

- Seed 99's slowdown is the busier world, not a seed accident: its years 4–5 flip 92k–103k cells on HEAD against
  47k–64k. Seed 4219, as busy on both commits, is unchanged. The 32-seed batch figures ran 8 at a time on each commit
  in different sessions. The page and pinned figures are same-session.
- `founded#127` on 1307 is a puppet with 14 warheads and full tech from year 19; it fires H-bombs on France, the UK,
  the Soviet Union, Turkey and the US in years 25–28 (`c13_headless_1307.json`, `critic/scripts/c13_who.ts`).
- Ports: 5313 (HEAD) and 5314 (`896ff77`), both stopped at the end; the worktree's `node_modules` junction was
  unlinked before `git worktree remove`.

## Strengths, verified

- **A late front worth zooming into now exists:** 1129's Germany–US war in Italy, 51 engaged formations and a contact
  line at 250 m/px in year 10 (`c13y2_1129_y10_d30_250m.png`).
- **The carrier strike reads:** its row frames the carrier and its target with the strike's planes overhead
  (`c13n4_8693_rowless_clicked.png`).
- **Determinism:** browser equals headless year by year on 1307, and run 12's seed-99 figure reproduces on `896ff77`
  to the hash.

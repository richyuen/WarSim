# Critic report, run 16

- **Commit:** `7b883084ca5b5bb43d8fc5c868dc0a2bb35410f6` (HEAD at the start, `critic/c16_commit.txt`). Run 15 was on
  `7739a78`; 22 commits since. The ones that touch the game: a fleet's panel gets a way to its sea battle (ADR-714);
  the operational AI's reach asked pair by pair and where it is read (ADR-719, ADR-720: the late tick); a ship's hull at
  T2 at least 13 px (ADR-722); wings sail over the sea to a base in reach of the front (ADR-723, the user's decision;
  pin `ac54bc2d` → `2b4bc96e`); a carrier group is delivered with its air groups and the AI keeps carriers afloat
  (ADR-725, ADR-726). Closed with no rule, by the user's decisions: year 1's contact (ADR-716 a, ADR-718 a: the fold's
  cost), the late contact (ADR-717 a, "to the next critic report, which judges it"), the stasis of the top five
  (ADR-721 a, the same), the Polish light-theatre strikes (ADR-715 a); the ferry's and the carriers' missed ATs
  (ADR-724 a, ADR-727 a, "the read to the next critic report").
- **Date:** 2026-10-27.
- **Build:** `vite build --outDir critic/c16_dist`, exit 0 (`critic/c16_build.log`), served with `vite preview` on port
  **5326**. `7739a78` built from a worktree (`critic/wt`, `node_modules` junction unlinked before removal) into
  `critic/c16o_dist`, served on **5327**, for same-session page timing. Chromium through Playwright, headless,
  1600 × 900 (390 × 844 phone, 1280 × 720 laptop).
- **Runs:**
  - 64 unaided headless worlds × 30 years on HEAD (`critic/scripts/c16_batch.sh`, `c16_headless.ts` = run 15's script):
    **run 15's 56 seeds**, compared with run 15's `c15_*` files (`7739a78`), and **8 new seeds** (1259, 2789, 3571,
    4801, 5653, 6703, 7789, 8933) run on **both** commits (`c16o_*` = `7739a78` in the worktree). Paired per-seed
    comparison with the standard error of the mean difference: `critic/c16_cmp_y30.json` (`c16_cmp.py`).
    Checkpoints at years 10 and 20, each commit's saves read by its own code (engaged 7 days, pieces, hollow
    divisions, a **navy census**: carriers, carriers with a wing aboard, ships by class, fleets in training):
    `critic/c16_cmp_checkpoints.json` (`c16_cmp2.py`).
  - **Carriers (new):** carrier strike hours in year 21 on 8 worlds, both commits (`c16_cvworld.ts`); two AI-built
    carrier groups found at delivery (`c16_cvwatch.ts`) and followed a year hour by hour (`c16_cvfollow.ts`).
  - Performance, pinned (`--affinity 0xFFFF`), alone, one run at a time, after every batch: seed 99 × 5 years on both
    commits; run 15's two breaches on run 15's own saves (the builder's cases) twice each; HEAD's 6421 and 1129 years
    21–30; **HEAD's four slowest batch world-years** re-read twice each from HEAD's saves stepped to the year's start.
    In the page, one build at a time: 6421's year 28 at Max on both builds; 4877 years 21–23 at Max on both builds
    (each its own commit's save); 10 years of 3301 at Max on both builds; HEAD's slowest year (3847 y27) at Max.
  - In the page: the run-15 probes re-run (armour at 3,000–10 m/px, God tools, Breakthrough at peace and at war,
    the editor's standoff and armed Poland, phone and laptop, playing Poland, the carrier strike row, the sea row of
    3613, the wheel zoom, tags in a dense fight, History and its downloads, the nuclear pause, restraint lines, late
    fronts, the Large map, browser = headless, Continue). **New:** a fleet's "To its fight" pressed 8 times; carriers
    at the start, placed in the editor and late; fleet columns under way at 120, 60, 47 m/px; a new seed (3389)
    watched two years.
- **Reference:** `reference/screens/`, `reference/text/AOC_TEXT_NOTES.md`. AoC's nukes, God tools, save/load and
  performance are known from text only; my confidence there is lower.
- **Prefix:** every path below was made in this run (`c16`; `c16o` = `7739a78`). Scripts in `critic/scripts/c16_*`.

## Verdict

**The late game is faster and run 15's two worst years are gone, the fleet panel finds its fight, and the carriers
are back on the sea; but the late world is no livelier: land contact a tenth of year 1's and 5 % lower again, the
same five largest nations for more than 12 years in more worlds than before, and the carriers built mostly sit in
port.**

- **Performance (R15-B2) mostly fixed:** run 15's breaches, pinned, on run 15's own saves: **6421 year 28 7.9 →
  5.18 / 5.15 ms**, **1129 year 21 6.4–6.5 → 4.35 / 4.33 ms**; 6421's year 28 at Max in the page **80.5 → 54.4 s**
  (same session, each build). Batch world-years over 5.5 ms (contended) 53 of 1,680 → 4 of 1,920. **But two of
  those four stay over the budget pinned and alone: 3847 year 27 6.14 / 6.19 ms, 5683 year 26 6.02 / 5.82 ms**
  (R16-B2); 3847's year 27 takes 60.4 s at Max.
- **Late land war (R16-B1):** same 56 seeds, `7739a78` → HEAD: engaged a day after year 1 **4.36 → 4.13** (−5.5 %,
  2.3 se, lower on 34 of 56), per war 0.638 → 0.602; new seeds on both commits 4.42 → 4.02. Year 1 itself is level
  (39.72 → 40.67, +1.4 se): its run-15 fall is now the fold's cost by the user's decision (ADR-718 a), a design
  objection, not a defect. In the page: 7019 y20, 559 land formations at war, engaged 4, 5, 0, 3, 0, 0, 0 over 60 days.
- **Stasis worse:** the same five largest nations for more than 12 years in **13 of 56 worlds (8 on `7739a78`)**, the
  longest **19 → 23 years** (4877: the United States, the Soviet Union, France, Canada, Denmark from year 8 to 30).
- **Carriers:** afloat with a wing aboard at year 20 **0.98 → 3.13 a world** (new seeds 0 → 2.75); carrier strikes in
  the air in year 21, 8 worlds: **0 → 30 hours** in all. Of two AI-built groups followed a year, one flew 11 hours of
  strikes, the other none while its nation fought 1–4 wars.
- **Fixed:** "To its fight" on a fleet's panel (PLAN 7.126): 8 of 8 presses framed the fleet with 1–6 enemy fleets on
  the screen. Hulls at T2 now read as ships (13 px).
- **Unchanged after many runs:** Breakthrough gives no feedback; the God revolt is told as a declared war; God tools
  clipped on a phone; the title's Cancel and file input are browser defaults (tenth run); Offer peace gets no answer;
  the History export's `a`/`b` columns.

## Scores

| Dimension | Run 15 | Run 16 |
|---|---|---|
| Map visuals and readability | 7 | 7 |
| Diplomacy, war, alliance, puppet, revolt depth | 7 | 7 |
| Emergent world dynamics over long runs | 6 | 6 |
| God Mode | 7 | 7 |
| Editor and scenarios | 7 | 7 |
| Stats and history | 7 | 7 |
| UI/UX and polish | 7 | 7 |
| Performance | 6 | **7** |
| Stability | 7 | 7 |
| Semantic zoom to unit level (needs 8) | 8 | 8 |
| Naval warfare (needs 8) | 7 | 7 |
| Tanks (needs 8) | 8 | 8 |
| Aircraft (needs 8) | 7 | 7 |
| AI nuclear use (needs 8) | 8 | 8 |

## Run 15's cases re-run

| Run 15 case | On HEAD | Evidence |
|---|---|---|
| R15-B1, year 1: 45.05 → 40.01 a day (`311988d` → `7739a78`) | Same 56 seeds `7739a78` → HEAD: **39.72 → 40.67** (+0.95, se 0.67): no further fall. The run-15 fall is the fold's, kept by the user (ADR-718 a): moved to Design objections. | `critic/c16_cmp_y30.json` (`same.eng1`) |
| R15-B1, late: years 2–30 5.11 → 4.35, per war 0.732 → 0.636 | Same 56 seeds: **4.36 → 4.13** (−0.24, se 0.105, lower on 34), per war 0.638 → 0.602 (se 0.025); a share of land formations at war level (1.067 → 1.063 %). New seeds both commits: 4.42 → 4.02, per war 0.612 → 0.555 (lower on 7 of 8). | `critic/c16_cmp_y30.json` |
| Checkpoints with nobody in contact 17 of 96 | Same 56 seeds × y10/y20: mean 4.27 → 3.54 (se 0.66, not significant); **nobody in contact 21 → 10 of 112** (better). New seeds 0 → 3 of 16. | `critic/c16_cmp_checkpoints.json` (`engaged`) |
| In the page: 7019 y20 0 engaged on 6 of 7 samples | HEAD's own saves: 7019 y20 **4, 5, 0, 3, 0, 0, 0** (559 at war); 4877 y20 4, 3, 5, 5, 0, 0, 0; 6421 y20 8, 4, 0, 2, 0, 0, 0; 1129 y10 2, 2, 0, 4, 0, 0, 2. | `critic/c16_y2_7019_y20.json`, `critic/c16_y2_4877_y20.json`, `critic/c16_y2_6421_y20.json`, `critic/c16_y2_1129_y10.json`, `critic/shots/c16y2_7019_y20_d20_3000m.png` |
| R15-B2: 6421 y28 7.88–7.98 ms pinned | Same save (`c15_seed6421_y27.bin`), HEAD's code: **5.18, 5.15 ms** (operational AI no longer the bulk). | `critic/c16_perf_6421c15_y28_read1.log`, `critic/c16_perf_6421c15_y28_read2.log` |
| R15-B2: 1129 y21 6.39–6.54 ms | Same save: **4.35, 4.33 ms**. HEAD's own 1129 years 21–30: 2.22–4.02; 6421 years 21–28: 2.32–4.07. | `critic/c16_perf_1129c15_y21_read1.log`, `critic/c16_perf_1129_y21_30_head.log`, `critic/c16_perf_6421_y21_30_head.log` |
| 6421 y28 81.5 s at Max in the page | Same session, same save: HEAD **54.4 s**, `7739a78` 80.5 s (run 15 reproduced). No stall over 500 ms. | `critic/c16_l_6421.json`, `critic/c16o_l_6421.json` |
| 4877 years 21–23 at Max 35.2, 36.2, 40.3 s | Each build its own save, same session: HEAD 33.2, 36.2, 43.3 s (112.7); `7739a78` 35.2, 36.2, 40.2 s (111.6). Level. | `critic/c16_l_4877.json`, `critic/c16o_l_4877.json` |
| 10 years of 3301 at Max 249.7 s | HEAD **230.4 s**, `7739a78` 251.2 s. | `critic/c16_w_3301.json`, `critic/c16o_w_3301.json` |
| Seed 99 2.08 ms (pin ac54bc2d) | Pinned, same session: HEAD 2.14 ms over 5 years, year 1 2.30 (hash **2b4bc96e**, ADR-723's pin); `7739a78` 2.06, year 1 2.22 (ac54bc2d). | `critic/c16_perf_seed99_5y_head.log`, `critic/c16_perf_seed99_5y_7739a78.log` |
| Hollow divisions 0.4 a world | Same seeds: under 500 men at y20 0.41 → 0.25; under 1,000 26.3 → 20.5; mean men 7,779 → 8,183. | `critic/c16_cmp_checkpoints.json` (`hollow`) |
| Stasis longest 19, least land moved last five years 25.2 % | Same seeds: longest **19 → 23**, over 12 years **8 → 13 of 56** worlds, mean 8.9 → 9.7 (se 0.72); least land moved 25.2 → 22.4 %, mean 47.5 → 51.3 %. New seeds: longest 23 → 13. | `critic/c16_cmp_y30.json` (`stasis`, `stasisOver12`) |
| Late sea war a fifth of year 1's | Same seeds: late battles 8.54 → **8.20** a world-year (se 0.23, lower on 33), ships sunk late 87.2 → **81.3** (se 2.2); year 1 40.2 → 41.2. Sinking nothing 2.47 → 2.68 %. | `critic/c16_cmp_y30.json` |
| Late air war 7 % of year 1's; 2 sorties aloft at 6421 y20 | Same seeds: late air battles **186 → 234** a world-year (+26 %, se 8), sorties aloft late 15.3 → 18.2 (higher on 50 of 56); **wings late 95.4 → 68.8 (lower on 56 of 56)**. Page, HEAD's 6421 y20: **2 sorties aloft** in the world; 4877 y20: 1. | `critic/c16_cmp_y30.json`, `critic/c16_u_6421.json`, `critic/c16_u_4877.json`, `critic/shots/c16u_6421_f0_0250m.png` |
| A fleet's panel has no way to its sea battle | **Fixed:** "In contact ⚔ To its fight"; pressed 8 times (5381, 4877): the view frames the fleet and 1–6 enemy fleets at 59–448 m/px. | `critic/c16_fp2_5381.json`, `critic/c16_fp2_4877.json`, `critic/shots/c16fp2_5381_fleet_1199_fight.png`, `critic/shots/c16fp_4877_fleet_1238.png` |
| Sea row of 3613: small hulls far apart | Hulls now 13 px and read as ships; the two squadrons still ~550 px apart at 46.8 m/px, nothing between them. | `critic/shots/c16crop_c16_3613_row.png`, `critic/shots/c16crop_c15_3613_row.png`, `critic/shots/c16e_3613_sea_01_row_live_1.png` |
| Late pieces 1,040 a world | Same seeds **1,047 → 1,015** (se 17), enclaves 276 → 253 (se 7.5). | `critic/c16_cmp_checkpoints.json` (`frag2`) |
| Bursts over a million civilians 9 (8 on `311988d`) | Same seeds `7739a78` → HEAD: **11 → 9**; civilian-heavy (10 × men) 2.07 → 2.27 a world. Worst on HEAD: **5147 y23, a Soviet H-bomb on London, 4,763,000 dead, 0 men** (decided at 0.229; the third Soviet first strike on Britain in 60-day steps; Britain holding 25 warheads, struck none). | `critic/c16_headless_5147.json` (`nukeLog`, tick 197978), `critic/c16_cmp_y30.json` |
| Moving capital 1.29 moves a capture | Same seeds 1.285 → 1.298. | `critic/c16_cmp_y30.json` |
| Nuclear pause and alert | Holds: 4877 from year 20 at Max: pauses at ticks **177866, 183890, 188954**, the headless burst ticks; banners with the toll. | `critic/c16_np2_4877.json`, `critic/shots/c16np_4877_paused_2.png`, `critic/c16_headless_4877.json` |
| Breakthrough at peace does nothing (2203) | Unchanged: counts identical before and after, no row. At war (7019) the corridor appears in state, no row. | `critic/c16_k_2203.json`, `critic/c16_k3_7019.json`, `critic/shots/c16k_2203_01_day7_1500m.png` |
| God revolt told as a declared war | Unchanged: "1 January 1938 Germany declared war on Free Saxony". | `critic/c16_q_6421.json` |
| Phone: God tools clipped | Unchanged: "Revo", "Spawn n", "Breakthr", "Territo", "Found c", "Raze c"; the map legend over the war chips. | `critic/shots/c16p_phone_02_GodMode.png` |
| Title's Cancel / file input unstyled | Unchanged (tenth run). | `critic/shots/c16g_4877_10_title_pending.png` |
| Offer peace: no answer | Unchanged: Poland offers Lithuania peace; no row, the war listed. | `critic/c16_pl_6011.json` |
| History export a/b raw words | Unchanged: SeaBattle a = 65559, b = 524312; AirRaids b = 1658585112; NukeCasualties b = 14242873363; MajorBattleStarted a = 1 named "Wuhu". Also "lost 1 ships". | `critic/c16_dl_4877.csv` |
| Dense fight at T2: a wall of tags | Unchanged: day 21, 250 m/px, 61 inputs, 51 tags, 5 left out; at 120 m/px 44 / 36 / 5 (`c16tg_7019_d21_120m.png`). | `critic/c16_tg_7019.json`, `critic/shots/c16tg_7019_d21_120m.png` |
| Editor North Sea standoff (4877) | Holds: "Germany and United Kingdom fought at sea: Germany lost 25 ships, United Kingdom 17", 2 January. | `critic/c16_g4.log` |
| Editor-armed Poland (9437) | Holds: Berlin 8 February (334,000 civilians, 363 men), Prague 4 March (134,000), Moscow decided 7 and 10 March. | `critic/c16_g2.log` |
| Carrier strike row (8693) | Holds: "⚓ Carrier strike: Japan on United States's ships", 2 sorties drawn. | `critic/c16_n4.log`, `critic/shots/c16n4_8693_rowless_clicked.png` |
| Restraint lines (1129 y20) | Consistent over 60 days: "deterred", "noPlace", "notDesperate". | `critic/c16_t_1129.json` |
| Browser = headless | 3 of 3 year hashes equal on 1307 (4fda327c, e3cbb083, 8f479044); save/load twin equal (4.06 MB). Continue: same tick and hash (5754fe2e) in 4.3 s. | `critic/c16_h_1307.json`, `critic/c16_vC.log` |

## Dimensions

### Map visuals and readability: 7 (unchanged)

- **Tested:** the late world (7019 y20 at 6,000 and 3,000 m/px), a new seed's Europe every 60 days for two years
  (3389), a dense China–Japan fight at 250–30 m/px, ships at T2.
- **Evidence:** `critic/shots/c16x_7019_7019y20_eurasia.png`, `critic/shots/c16y2_7019_y20_d20_3000m.png`,
  `critic/shots/c16ww_3389_d720_europe.png`, `critic/shots/c16tg_7019_d21_120m.png`,
  `critic/shots/c16col_5381_1055_60m_crop.png`.
- **Better:** hulls at T2 read as ships (13 px).
- **Weak:** the late United States in navy (42, 77, 143) holds Germany, Benelux, Scandinavia and Poland beside the sea's
  (29, 53, 87): at 3,000 m/px the North Sea and Germany are one dark field and the coasts vanish
  (`c16y2_7019_y20_d20_3000m.png`). At 120 m/px a dense fight is still ~35 tags over faint elements. A battle squadron
  under way at 60 m/px reads as four bars of two hulls bow to stern (`c16col_5381_1055_60m_crop.png`, ADR-722's
  "Left").
- **AoC does better:** contiguous blobs with readable names and contrasting colours
  (`reference/screens/steam-screenshot-03.jpg`).

### Diplomacy, war, alliance, puppet, revolt depth: 7 (unchanged)

- **Tested:** event counts on 64 worlds × 30 years, both commits; playing Poland.
- **Same seeds:** wars declared 460 → 483 a world, revolts 177 → 194 (se 8.9), annexations 64.7 → 70.5 (se 2.9),
  puppets 79 → 81, peaces 443 → 464.
- **Weak:** bloc wars of 30+ members ("Soviet Union +5 ⚔ France +35", 3389 d720); Offer peace unanswered.

### Emergent world dynamics over long runs: 6 (unchanged)

- **Tested:** 64 worlds × 30 years, 56 against run 15's files and 8 new on both commits; four late worlds 60 days in
  the page; a new seed's first two years.
- **Better:** nobody in contact at a checkpoint 21 → 10 of 112; enclaves 276 → 253 a world (se 7.5); air battles late +26 %.
- **Worse:** land contact after year 1 −5.5 % (2.3 se), now 10.1 % of year 1's; stasis over 12 years 8 → 13 worlds,
  the longest 23 years (4877).
- **What the 6 rests on, the decided fold cost set aside:** the late world, the decade a player watches after year
  1, has single-digit fights over 500–800 land formations at war (`c16_y2_*`), and in a fifth of worlds the same five
  giants for 13–23 years.

### God Mode: 7 (unchanged)

- **Tested by clicks:** Revolt, Spawn nation, Found city, Raze city (6421); H-bomb on Paris, A-bomb on London (4219);
  Breakthrough at peace (2203) and at war (7019, with a control).
- **Evidence:** `critic/c16_q_6421.json`, `critic/c16_a_4219.json`, `critic/c16_k_2203.json`, `critic/c16_k3_7019.json`.
- **Weak (unchanged code):** Breakthrough silent; the revolt is "Germany declared war on Free Saxony". **AoC does
  better:** its Spawn Major Battle is an event the player sees.

### Editor and scenarios: 7 (unchanged)

- **Tested:** fleets and a bomber group placed, warheads granted, the refusal on land, export, the title's file card,
  play; **new:** a carrier group placed for the United States; the Large map.
- **Evidence:** `critic/c16_g_4877.json`, `critic/c16_g4.log`, `critic/c16_g2.log`, `critic/c16cv_4877.json`,
  `critic/shots/c16cv_4877_editor_placed_panel.png`, `critic/c16_v2L_b.log`.
- **New weakness:** the editor's carrier group sails with **empty decks** (US wings 21 → 21 after placing it; ADR-725
  leaves `spawnFleet` so), and its panel is identical to a manned start carrier's: no line anywhere says what is
  aboard. A player who builds a carrier scenario cannot tell it carries nothing.
- **Weak:** the title's Cancel and file input are browser defaults (tenth run).

### Stats and history: 7 (unchanged)

- **Evidence:** `critic/c16_hi_4877.json`, `critic/c16_dl_4877.csv`, `critic/c16_dl_4877.json`.
- **Works:** both downloads hold all 3,850 rows. **Weak:** the export's `a`/`b` columns are raw event words for sea
  battles, air war, air raids, nuclear tolls and major battles.

### UI/UX and polish: 7 (unchanged)

- **Tested:** the nuclear pause at Max, keys and modes, phone and laptop, playing a nation, Continue, the fleet panel.
- **Evidence:** `critic/c16_np2_4877.json`, `critic/c16_m.log`, `critic/shots/c16p_phone_02_GodMode.png`,
  `critic/c16_vC.log`, `critic/c16_fp2_5381.json`.
- **Better:** the fleet panel's "To its fight". **Weak:** phone God tools clipped; Offer peace and Breakthrough give no
  feedback; a wing ferried over the sea (ADR-723, AI wings only) has no ticker row, no map mark and no panel state
  (wings are drawn only as sorties): the player cannot see the ferry happen.

### Performance: 7 (up from 6)

- **Tested:** see Runs. Every pinned figure and every page timing compared across builds was taken alone. The batch's
  tick figures ran 8 at a time and only located the slow years.
- **Evidence:** `critic/c16_perf_seed99_5y_head.log`, `critic/c16_perf_seed99_5y_7739a78.log`,
  `critic/c16_perf_6421c15_y28_read1.log`, `critic/c16_perf_6421c15_y28_read2.log`,
  `critic/c16_perf_1129c15_y21_read1.log`, `critic/c16_perf_1129c15_y21_read2.log`,
  `critic/c16_perf_6421_y21_30_head.log`, `critic/c16_perf_1129_y21_30_head.log`,
  `critic/c16_perf_3847_y27_read1.log`, `critic/c16_perf_3847_y27_read2.log`, `critic/c16_perf_5683_y26_read1.log`,
  `critic/c16_perf_5683_y26_read2.log`, `critic/c16_perf_9203_y29_read1.log`, `critic/c16_perf_2633_y26_read1.log`,
  `critic/c16_l_6421.json`, `critic/c16o_l_6421.json`, `critic/c16_l_4877.json`, `critic/c16o_l_4877.json`,
  `critic/c16_w_3301.json`, `critic/c16o_w_3301.json`, `critic/c16_l_3847.json`.
- **Why up:** both of run 15's breaches are under 5.5 ms on the same saves (7.9 → 5.2, 6.5 → 4.3 ms); the year the
  player waited 81 s for takes 54 s (same session, 80.5 on the old build); 3301's decade 251 → 230 s; same seeds, late
  tick −12.5 % and each world's worst year −21 % (5.58 → 4.40 ms, lower on 50 of 56, contended alike); world-years
  over 5.5 contended 53 → 4.
- **Why not more:** ADR-709's 5.5 ms "in any year" still fails pinned: 3847 y27 **6.14, 6.19 ms**, 5683 y26 **6.02,
  5.82 ms** (operational AI 3.0–3.2 ms of it); 2633 y26 5.44 / 5.56 and 9203 y29 5.42 / 5.44 at the line. 3847's
  year 27 is **60.4 s** at Max. 4877's late years at Max are level (112.7 against 111.6 s). **AoC:** known from text
  only.

### Stability: 7 (unchanged)

- **Evidence:** `critic/c16_h_1307.json` (3/3 hashes, twin equal), `critic/c16_vC.log` (Continue: same hash);
  `errors` empty in every page JSON of HEAD's play; 72 headless worlds ran 30 years without a throw; seed 99 hits
  ADR-723's pin 2b4bc96e. Two page loads failed with `ERR_CONNECTION_REFUSED` against my own preview server (it
  listens on `::1` only) and passed on a re-run (`critic/c16_v2L.log` → `critic/c16_v2L_b.log`; 3847's page
  timing likewise): my harness, not the game.

### Semantic zoom to unit level: 8 (unchanged)

- **Evidence:** `critic/shots/c16c_7019_arm_0025m.png`, `critic/shots/c16c_7019_arm_15m_live_1.png`,
  `critic/c16_z.log` (6,000 → 3 m/px, infantry figures at 3 m/px), `critic/c16_v2L_b.log` (Large map 742 elements
  at 250 m/px).
- **Not more:** a dense fight at T2 is a wall of tags (`c16tg_7019_d21_120m.png`).

### Naval warfare: 7 (unchanged)

- **Evidence:** `critic/c16_cmp_y30.json`, `critic/c16_cmp_checkpoints.json` (`navy`), `critic/c16_cvworld_*.json`,
  `critic/c16o_cvworld_*.json`, `critic/c16_cvfollow_6421_353.json`, `critic/c16_cvfollow_7019_18.json`,
  `critic/c16_fp2_5381.json`, `critic/shots/c16crop_c16_3613_row.png`, `critic/shots/c16cv_8167_save_fleet1096_60m.png`.
- **Better:** carriers with a wing aboard at year 20 0.98 → 3.13 a world (new seeds 0 → 2.75); carrier strike hours
  in year 21 over 8 worlds 0 → 30; the fleet panel finds its fight; hulls readable at T2.
- **Why not 8:** the late sea war got no bigger: battles 8.54 → 8.20 a world-year, ships sunk late −7 % (2.7 se),
  transports at year 20 548 → 498 (−9 %, 2.1 se), battleships 32 → 27; still a fifth of year 1. The carriers built
  mostly wait: 7019's US group built in year 21 sat in port a year, 0 strikes, at war in 1–4 wars
  (`c16_cvfollow_7019_18.json`); 8167's three US groups at year 20 hold Las Palmas with the whole US fleet
  (`c16cv_8167_save_fleet1096_60m.png`). 30 strike-hours in 8 world-years is about 4 hours a world-year in which a
  carrier strike is in the air. **AoC has no navy.**

### Tanks: 8 (unchanged)

- **Evidence:** `critic/shots/c16c_7019_arm_0025m.png`, `critic/shots/c16c_7019_arm_15m_live_1.png`,
  `critic/shots/c16c_7019_week2_0025m.png`, `critic/c16_c.log`.
- **Why 8:** German tank ranks in contact with Polish blocks, tracers, the contact line, planes overhead. Late armour
  rarely fights (R16-B1).

### Aircraft: 7 (unchanged)

- **Evidence:** `critic/c16_cmp_y30.json`, `critic/c16_u_6421.json`, `critic/c16_u_4877.json`,
  `critic/shots/c16u_6421_f0_0250m.png`.
- **Better:** late air battles +26 % and sorties aloft +19 % a world (same seeds, 6–9 se) from the sea ferry.
- **Why not 8:** the whole world's sky late holds ~18 sorties on the mean hour; in the page HEAD's 6421 y20 has 2
  aloft, 4877 y20 1. The air forces shrank by a third (wings late 95 → 69, lower on every one of 56 worlds): the
  ferried wings are lost faster than rebuilt (as ADR-724 measured). **AoC has no air war.**

### AI nuclear use: 8 (unchanged)

- **Tested:** 1,257 bursts on 56 HEAD worlds against `7739a78`; three AI strikes from the player's seat with the
  pause (4877 y21–22); restraint lines; Poland armed in the editor.
- **Evidence:** `critic/c16_np2_4877.json`, `critic/shots/c16np_4877_paused_2.png`, `critic/c16_t_1129.json`,
  `critic/c16_g2.log`, `critic/c16_headless_5147.json`.
- **Holds:** the pause on each strike's own hour; strikes on armies (110,520 and 105,094 men). Bursts over a million
  civilians flat (11 → 9).
- **But:** the worst civilian toll of sixteen runs: 5147 year 23, a Soviet **H-bomb on London, 4,763,000 dead and no
  soldier**, at utility 0.229, the Soviets' third first strike on Britain in 60-day steps while Britain (25 warheads)
  never answered; a week later 519,055 more. One world, a flat count: not scored down, but a player who sees it reads
  a massacre, not a war aim.

## Blocking issues, in priority order

1. **R16-B1. The late world stays still: land contact a tenth of year 1's and 5 % lower again; the same five giants
   for over 12 years in 13 of 56 worlds (R15-B1's late half, not fixed; ADR-717 a and ADR-721 a sent it here to judge).**
   - Same 56 seeds, `7739a78` → HEAD: engaged land formations a day, years 2–30, **4.36 → 4.13** (se 0.105, lower on
     34), per war 0.638 → 0.602; **10.1 %** of year 1's. New seeds on both commits: 4.42 → 4.02 (per war lower on 7
     of 8).
   - The top five unchanged for more than 12 years: **8 → 13 of 56** worlds; longest **19 → 23** (4877, years 8–30).
   - In the page, HEAD's late worlds: 7019 y20 4, 5, 0, 3, 0, 0, 0 engaged of 559 at war; 4877 y20 4, 3, 5, 5, 0, 0,
     0; 6421 y20 8, 4, 0, 2, 0, 0, 0.
   - **Evidence:** `critic/c16_cmp_y30.json`, `critic/c16_cmp_checkpoints.json`, `critic/c16_y2_7019_y20.json`,
     `critic/c16_y2_4877_y20.json`, `critic/shots/c16y2_7019_y20_d20_3000m.png`, `critic/c16_headless_4877.json`.
   - **Fix:** a late contact rule judged on unseen seeds against HEAD with years 2–30 and a stasis bar in the same AT
     (ADR-717 b's long thin fronts and ADR-721 c's members that cannot reach their enemy are the two causes already
     found).
2. **R16-B2. The 5.5 ms budget (ADR-709, "any year") still fails pinned on two late years (R15-B2's cases fixed).**
   - Pinned, alone, from HEAD's own saves: **3847 year 27 6.14, 6.19 ms**; **5683 year 26 6.02, 5.82 ms**; 2633 y26
     5.44 / 5.56 and 9203 y29 5.42 / 5.44 at the line. 3847's year 27 at Max in the page: **60.4 s**.
   - PLAN 7.129 is ticked done on "the late tick under 5.5 ms" read on 10 seeds × 30 years; on 64 seeds × 30 years 2
     world-years of 1,920 break it.
   - **Evidence:** `critic/c16_perf_3847_y27_read1.log`, `critic/c16_perf_3847_y27_read2.log`,
     `critic/c16_perf_5683_y26_read1.log`, `critic/c16_perf_5683_y26_read2.log`, `critic/c16_l_3847.json`; saves
     `critic/c16_seed3847_y26.bin`, `critic/c16_seed5683_y25.bin`.
   - **Fix:** profile those two years (operational AI 3.0–3.2 ms, invasion AI 0.46 ms in 5683) and cut them under 5.5;
     read the budget on more than ten seeds.

## Non-blocking issues

- **AI-built carriers mostly wait in port** (7019: a year at war, 0 strikes; 30 strike-hours in 8 world-years).
- **Editor carrier groups have empty decks, and no panel shows what a carrier carries** (`c16cv_4877.json`).
- **The air force a third smaller late** (wings 95 → 69, all 56 worlds lower); ferried wings are invisible (no row,
  no mark, no panel state).
- **Transports −9 % and ships sunk late −7 %** on the same seeds (not bisected; ADR-726's carrier group in training,
  which holds a nation's other warships 800 days, is the likely cause).
- **5147 y23: 4.76 million civilians by a Soviet H-bomb on London**, no soldier in the blast.
- **Late map colours:** the US's navy beside the sea's, coasts lost at 3,000 m/px (`c16y2_7019_y20_d20_3000m.png`).
- **Dense fights at T2 are a wall of tags** (`c16tg_7019_d21_120m.png`); fleet columns at 60 m/px read as bars.
- **Breakthrough gives no feedback; the God revolt is told as a declared war; Offer peace gives no answer.**
- **History export's a/b columns** raw; "lost 1 ships".
- **Phone: God tools clipped; the title's Cancel and file input unstyled.**

## Design objections (none blocking, no score lowered)

- **Year 1's contact is the fold's price** (ADR-718 a): on run 15's 48 seeds, 46.2 a day with no fold against 40.0
  with it; on my 56 seeds year 1 is now level with `7739a78`. A remnant-free front cost an eighth of year 1's fights.
- **The budget's level** (ADR-709, 5.5 ms): ~50–60 s a late year at Max; a player watching 30 years waits ~20–30
  minutes. Scored only where it breaks.
- **Late wars closed with no rule** (ADR-702 d, ADR-706 a, ADR-707 a, ADR-717 a): judged above as R16-B1, since
  ADR-717 a asked me to.
- **Save games:** one autosave slot and Continue (SPEC §2.5); AoC's full version has save/load (text only).

## Notes

- Run 15's figures reproduce on `7739a78` in this session: seed 99 ac54bc2d at 2.06 ms, 6421 y28 80.5 s at Max
  (81.5), 3301's decade 251 s (250).
- The batch ran 8 worlds at a time beside browsers on both commits; a pinned re-read came out at 0.93–1.0 × its
  contended figure this run (5683 y26 6.26 contended, 5.82–6.02 pinned).
- The page decade timings count my script's pauses between years on both builds alike.
- The four slowest years re-read pinned are the batch's own worlds: the stepped saves end the year on the batch's
  hashes (3847 y27 653f4785, 5683 y26 72d1b001). No headless log of the 72 worlds holds an error.
- PLAN 7.131's 4877 years 21–23 at Max in 99.6 s does not reproduce here: 112.7 s on HEAD and 111.6 s on `7739a78`,
  one session, one build at a time (its 6421 year 28 under 60 s does: 54.4 s).
- Ports 5326 and 5327 stopped at the end; the worktree's `node_modules` junction was unlinked before
  `git worktree remove`.

## Strengths, verified

- **The late game is faster where the player waits:** 6421's year 28 at Max 80.5 → 54.4 s on the same save, same
  session; run 15's 7.9 ms year at 5.2.
- **The fleet panel now leads to the fight:** 8 of 8 presses framed both sides (`c16fp2_5381_fleet_1199_fight.png`).
- **Determinism and resume:** browser equals headless year by year on 1307; Continue restores the same hash.

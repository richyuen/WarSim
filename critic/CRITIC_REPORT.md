# Critic report, run 15

- **Commit:** `7739a78fdbd99e85a42aea6d652aab6d1f57bb5d` (HEAD at the start, `critic/c15_commit.txt`). Run 14 was on
  `311988d`; 18 commits since. The ones that touch the game: hollow divisions folded into their neighbours (ADR-701,
  the user's decision); a refused march from afar waits 40 days (ADR-703); refused searches not made again (ADR-708);
  the tick budget raised to **5.5 ms in any year** (ADR-709, the user's decision); a load's first ticks (ADR-710); stack
  lanes (ADR-711); tags with no clear place left out (ADR-713). Late contact (ADR-702 d), the late sea war (ADR-706 a),
  the late air war (ADR-707 a) and the quiet late worlds (ADR-704 a) were closed with no rule, by the user's decisions.
  ADR-702 d sends R14-B1's late contact to this report.
- **Date:** 2026-10-26.
- **Build:** `vite build --outDir critic/c15_dist`, exit 0 (`critic/c15_build.log`), served with `vite preview` on port
  **5316**. `311988d` built from a worktree (`critic/wt`, `node_modules` junction unlinked before removal) into
  `critic/c15o_dist`, served on **5317**, for same-session page timing. Chromium through Playwright, headless,
  1600 × 900 (390 × 844 for the phone).
- **Runs:**
  - 56 unaided headless worlds × 30 years on HEAD (`critic/scripts/c15_batch.sh`, `c15_headless.ts` = run 14's script).
    **Run 14's 48 seeds**, compared with run 14's `c14_*` files (`311988d`), and **8 new seeds** (1213, 2633, 3467,
    4789, 5531, 6659, 7723, 8861) run on **both** commits (`c15o_*` = `311988d` in the worktree). Comparisons:
    `critic/c15_cmp_all.txt` and `critic/c15_cmp.json` (`c15_cmp.py`); checkpoints at years 10 and 20, each commit's
    saves read by its own code: `critic/c15_cmp_checkpoints.json` (`c15_cmp2.py`); civilian-heavy bursts:
    `critic/c15_nukeciv.json`.
  - Performance, pinned (`--affinity 0xFFFF`), alone, one run at a time: seed 99 × 5 years on both commits; run 14's
    8167 years 11–20 and 4877 year 21 on HEAD's own saves; HEAD's slowest batch years (6421 years 21–30, 1129 years
    11–21), the two worst re-read twice more from their own saves. In the page, one build at a time: 4877 years 21–23
    and 10 years of 3301 at Max on both builds; 8167 year 19 and 6421 year 28 at Max on HEAD.
  - In the page: four late worlds watched 60 days; three AI strikes with the pause (8167 y21); God tools, including
    **Breakthrough at war** (new); the editor's North Sea standoff and its armed Poland; phone; playing Poland; the
    carrier strike row; a wheel zoom 6,000 → 3 m/px; tank fights at 25 and 15 m/px. **New:** tags left out in a dense
    fight (ADR-713), a fleet's panel in a sea battle (PLAN 7.126), the History panel's CSV and JSON downloads, a new seed
    (2711) watched two years.
- **Reference:** `reference/screens/`, `reference/text/AOC_TEXT_NOTES.md`. AoC's nukes, God tools, save/load and
  performance are known from text only; my confidence there is lower.
- **Prefix:** every path below was made in this run (`c15`; `c15o` = `311988d`). Scripts in `critic/scripts/c15_*`.

## Verdict

**The remnant divisions are gone and the late game runs faster, but the land war is thinner than on run 14, in year 1
and after it, and the raised 5.5 ms budget still breaks in the late game.**

- **Hollow divisions fixed:** under 500 men at year 20, same 48 seeds, **72.4 → 0.4** a world (new seeds both commits
  78.8 → 0.2). Late fronts now show full-strength counters (`critic/shots/c15y2_4877_y20_d60_250m.png`).
- **The land war got thinner (R15-B1, was R14-B1):** same 48 seeds, engaged land formations a day **year 1 45.05 →
  40.01** (lower on 35 of 48), **years 2–30 5.11 → 4.35** (lower on 42 of 48); per war after year 1 0.732 → 0.636.
  Checkpoints (y10/y20, 7 days each) with **nobody in contact 4 → 17 of 96**. New seeds on both commits agree (year 1
  43.7 → 38.0, late 4.93 → 4.47, empty checkpoints 1 → 4 of 16). ADR-701 predicted the late figure's fall; the year-1
  fall was not measured by its AT (years 2–20 only).
- **Performance better, budget still broken (R15-B2, was R14-B2):** run 14's worst case is gone (8167 year 19 13.3 →
  1.9 ms; in the page 142 s with 40 stalls → **25 s with none**). Seed 99 2.25 → 2.08 ms; 4877 year 21 5.26 → 3.17 ms;
  4877's late years at Max 141 → 112 s. But pinned and alone, **6421 year 28 reads 7.88, 7.92, 7.98 ms** (year 29 7.14,
  30 5.89, 25 5.51) and **1129 year 21 6.39, 6.54, 6.53 ms** (year 20 5.77): six world-years of 31 measured over
  ADR-709's 5.5 ms, two of them inside the 25 years the builder's AT reads. In the page 6421's year 28 at Max takes
  **81.5 s** (no stalls).
- **Unchanged after many runs:** Breakthrough gives no feedback (at peace it does nothing; at war it makes a corridor
  with no ticker row and nothing drawn at 1,200 m/px); the God revolt is told as a declared war; God tools clipped on a phone; the title's
  Cancel and file input are browser defaults (ninth run); Offer peace gets no answer.

## Scores

| Dimension | Run 14 | Run 15 |
|---|---|---|
| Map visuals and readability | 7 | 7 |
| Diplomacy, war, alliance, puppet, revolt depth | 7 | 7 |
| Emergent world dynamics over long runs | 6 | 6 |
| God Mode | 7 | 7 |
| Editor and scenarios | 7 | 7 |
| Stats and history | 7 | 7 |
| UI/UX and polish | 7 | 7 |
| Performance | 5 | **6** |
| Stability | 7 | 7 |
| Semantic zoom to unit level (needs 8) | 8 | 8 |
| Naval warfare (needs 8) | 7 | 7 |
| Tanks (needs 8) | 8 | 8 |
| Aircraft (needs 8) | 7 | 7 |
| AI nuclear use (needs 8) | 8 | 8 |

## Run 14's cases re-run

| Run 14 case | On HEAD | Evidence |
|---|---|---|
| R14-B1: engaged a war a day after year 1 0.722 (`311988d`, 40 seeds); 11.4 % of year 1 | Same 48 seeds, both commits: **0.732 → 0.636** a war (year 1 6.25 → 5.22); all engaged after year 1 5.11 → 4.35, **10.9 %** of year 1's (11.4 %). Year 1 itself 45.05 → 40.01. New seeds both commits: 0.717 → 0.650. | `critic/c15_cmp_checkpoints.json` (`perWar`), `critic/c15_cmp_all.txt` |
| Checkpoints 5.34 engaged, 4 of 80 with nobody in contact | Same 48 seeds × y10/y20: **5.64 → 4.49**, lower at 61 of 96; nobody in contact **4 → 17** of 96. New seeds: 4.61 → 2.91, 1 → 4 of 16. | `critic/c15_cmp_checkpoints.json` (`engaged`) |
| Hollow divisions: 76 a world under 500 men at year 20 | **Fixed.** Same 48 seeds 72.4 → **0.4**; under 1,000 men 97.9 → 26.0; mean men a land formation 6,662 → 7,818. New seeds 78.8 → 0.2. | `critic/c15_cmp_checkpoints.json` (`hollow`) |
| In the page: 5147 y20 21–50 engaged; 6421 y20 0–8; 1129 y10 0–2 | HEAD's own saves (other worlds than run 14's): 4877 y20 **0, 10, 2, 0, 6, 0, 8**; 7019 y20 **0, 0, 0, 0, 0, 2, 0** (6 wars, 422 land formations at war); 1129 y10 3, 10, 3, 7, 0, 2, 2; 6421 y20 4, 6, 0, 0, 4, 4, 6. HEAD's best checkpoint (9781 y10) peaks at 46. | `critic/c15_y2_7019_y20.json`, `critic/c15_y2_4877_y20.json`, `critic/c15_y2_1129_y10.json`, `critic/c15_y2_6421_y20.json`, `critic/shots/c15y2_7019_y20_d20_3000m.png` |
| R14-B2: 8167 year 19 13.3 ms pinned, 142 s at Max with 40 stalls | **Gone on HEAD's world:** pinned, HEAD's own y10 save, years 11–20 1.46–2.67 ms (year 19 1.89). Page, year 19 at Max: **25.2 s, 0 stalls** over 500 ms (longest 284 ms). | `critic/c15_perf_8167_y11_20_head.log`, `critic/c15_l_8167.json` |
| 4877 year 21 5.26 ms | HEAD's own y20 save: **3.17 ms**. | `critic/c15_perf_4877_y21_head.log` |
| Seed 99 2.28 ms | Same session, pinned: HEAD **2.08 ms** (hash ac54bc2d, the pin), `311988d` 2.25 ms (2ead5b7e, run 14's pin reproduced). | `critic/c15_perf_seed99_5y_head.log`, `critic/c15_perf_seed99_5y_311988d.log` |
| Late page at Max, 4877 years 21–23: 58, 47, 38 s | Same session, each build its own commit's save: HEAD **35.2, 36.2, 40.3 s**; `311988d` 57.4, 46.3, 37.2 s. No stall over 500 ms on either. | `critic/c15_l_4877.json`, `critic/c15o_l_4877.json` |
| 10 years of 3301 at Max: 279 s | Same session: HEAD **249.7 s**, `311988d` 278.1 s (run 14's 279 reproduced). | `critic/c15_w_3301.json`, `critic/c15o_w_3301.json` |
| Worst batch years (contended, 8 at a time) | 48 seeds × 30 years, same conditions: world-years over 5.5 ms **185 → 48**, over 7 ms 37 → 6, mean 4.01 → 3.20 ms, worst 16.5 → 8.2. Used only to find years to re-read pinned. | `critic/c15_batch_ticks.txt` |
| Nuclear pause and alert | Holds: 8167 from year 20 at Max, pause on: pauses at ticks **175784, 175802, 177218**, the headless burst ticks; banners Liverpool and Fusan stacked, oldest on top, each with Go to. | `critic/c15_np2_8167.json`, `critic/shots/c15np_8167_paused_2.png`, `critic/c15_headless_8167.json` |
| Sea battles that sink nothing 3.4 % | Same seeds 3.4 → **2.6 %**; new seeds 1.9 → 2.0 %. | `critic/c15_cmp_all.txt` |
| Late sea war a fifth of year 1's | Unchanged: late battles a world-year 8.59 → 8.58 (year 1 43.0 → 41.2). New seeds 8.19 → 8.29. | `critic/c15_cmp_all.txt` |
| Late air war 7 % of year 1's | Unchanged: 179 → 181 a world-year (year 1 2,484 → 2,429). New seeds 179 → 217. | `critic/c15_cmp_all.txt` |
| Moving capital 1.30 moves a capture (bar 1.25) | Same seeds 1.30 → 1.29; new seeds 1.34 → 1.25. | `critic/c15_cmp.json` (`eventsPerWorld`) |
| Late pieces 1,046 a world at year 20 | Same 48 seeds 1,043 → 1,040; new seeds 1,013 → 1,086. Against `dd3b730` (24 seeds) 837 → 1,051. No change. | `critic/c15_cmp_checkpoints.json` (`frag2`, `frag_vs_dd3b730`) |
| Stasis (longest 21 years); least land moved in the last five years 13.1 % | Same seeds: longest **21 → 19**, worlds over 20 years 1 → 0; least land moved **13.1 → 25.2 %**. | `critic/c15_cmp_all.txt` |
| A first strike on Paris, 3,052,000 civilians (6737 y30) | 6737's world differs on HEAD. Bursts killing over a million civilians: same seeds 8 → 9, with 0 men 24 → 17; new seeds 3 → 2. Worst on HEAD: 7583 y20, Soviet H-bomb near Paris, 2,156,000 civilians, 6,340 men. | `critic/c15_nukeciv.json` |
| Breakthrough at peace does nothing (2203) | Unchanged: Germany selected, Berlin → Warsaw: no row, no refusal, the counts unchanged. | `critic/c15_k_2203.json`, `critic/shots/c15k_2203_01_day7_1500m.png` |
| God revolt told as a declared war | Unchanged: "1 January 1938 Germany declared war on Free Saxony". | `critic/c15_q_6421.json` |
| Phone: God tools clipped | Unchanged: "Revo", "Spawn n", "Breakthr", "Territo", "Found c", "Raze c". | `critic/shots/c15p_phone_02_GodMode.png` |
| Title's Cancel / file input unstyled | Unchanged (ninth run). | `critic/shots/c15g_4877_10_title_pending.png` |
| Offer peace: no answer | Unchanged: Poland offers Lithuania peace; 48 hours later no row, the war still listed. | `critic/c15_pl_6011.json`, `critic/shots/c15pl_6011_02_after_peace.png` |
| Editor North Sea standoff (4877) | Holds: "Germany and United Kingdom fought at sea: Germany lost 25 ships, United Kingdom 17" on day 2. | `critic/c15_g4.log` |
| Editor-armed Poland (9437) | Berlin 8 February (334,000 civilians, 363 men), Prague 3 March (134,000), Moscow 14 March (47,000; 13,236 men). | `critic/c15_g2.log` |
| Carrier strike row (8693) | Holds: the row frames the carrier group and the US destroyers, 2 sorties drawn. | `critic/c15_n4.log`, `critic/shots/c15n4_8693_rowless_clicked.png` |
| Restraint lines (1129 y20) | Consistent over 60 days: "noThreat", "deterred". | `critic/c15_t_1129.json` |
| Browser = headless | 3 of 3 year hashes equal on 1307 (dba275c4, 5b55171a, e0c0c43e); save/load twin equal (4.24 MB). Continue from the title: same tick and hash (c6b28ed3). | `critic/c15_h_1307.json`, `critic/c15_vC.log` |
| History noise: 4,816 rows by year 23 (4877) | Same session: HEAD 4,500, `311988d` 4,816; "Land handed over" 881 against 1,031. | `critic/c15_l_4877.json`, `critic/c15o_l_4877.json` (`historyTypes`) |
| Aircraft at 3 m/px | Still fixed: infantry figures and guns at the wheel zoom's last step. | `critic/shots/c15z_5861_17.png` |

## Dimensions

### Map visuals and readability: 7 (unchanged)

- **Tested:** the late world (7019 y20, Eurasia and Europe), late fronts at 3,000 and 250 m/px, a new seed's Europe
  every 60 days for two years (2711), a dense China–Japan fight at 250, 120, 60 and 30 m/px (new probe of ADR-713).
- **Evidence:** `critic/shots/c15x_7019_7019y20_eurasia.png`, `critic/shots/c15y2_7019_y20_d20_3000m.png`,
  `critic/shots/c15ww_2711_d360_europe.png`, `critic/shots/c15ww_2711_d720_europe.png`,
  `critic/shots/c15tg_7019_d21_120m.png`, `critic/shots/c15tg_7019_d12_120m.png`, `critic/c15_tg_7019.json`.
- **Better:** late fronts no longer carry 19–64-man counters (hollow divisions folded).
- **Weak:** at 120 m/px the dense fight is about 35 tags with leader lines up to ~300 px over elements that are faint
  specks: the fight itself cannot be seen behind its labels (`c15tg_7019_d21_120m.png`). ADR-713's dropped tags are few
  (0–5 per view, at most 5 of 61 at 250 m/px). The late world's colours: the US (42, 77, 143) holds Scandinavia, much
  of Poland and Russia in a navy beside the sea's (29, 53, 87) and France's blue, with no name on it in the Europe
  view (`c15y2_7019_y20_d20_3000m.png`). Pieces unchanged (1,040 a world).
- **AoC does better:** late worlds as contiguous blobs with readable names (`reference/screens/steam-screenshot-03.jpg`).

### Diplomacy, war, alliance, puppet, revolt depth: 7 (unchanged)

- **Tested:** event counts on 56 worlds × 30 years, both commits; 26 History kinds at year 20 (4877); playing Poland.
- **Evidence:** `critic/c15_cmp_all.txt`, `critic/c15_hi_4877.json`, `critic/c15_pl_6011.json`.
- **Same seeds:** wars declared 461 → 462 a world, revolts 178 → 178, puppets 77 → 79, annexations 68 → 65.
- **Weak:** wars of very large blocs ("France +35 ⚔ Nationalist Spain", "Germany +8 ⚔ Iraq +21" in 2711's first two
  years, `c15ww_2711_d360_europe.png`, `c15ww_2711_d720_europe.png`); Offer peace unanswered.

### Emergent world dynamics over long runs: 6 (unchanged)

- **Tested:** 56 worlds × 30 years on HEAD, 48 against run 14's files and 8 new on both commits; four late worlds and a
  new seed's first two years in the page.
- **Better:** stasis longest 21 → 19 years; the least land moved in a world's last five years 13.1 → 25.2 %; hollow
  divisions 72 → 0.4 a world.
- **Worse:** engaged after year 1 5.11 → 4.35 (−15 %, lower on 42 of 48), per war 0.732 → 0.636; checkpoints with
  nobody in contact 4 → 17 of 96; year 1 −11 %. New seeds on both commits show the same fall.
- **Why not moved:** the gains are in how the map moves, the losses in how much fighting there is to watch; they
  roughly cancel. 7019's year 20 in the page: 6 wars, 422 land formations at war, 0 in contact on 6 of 7 samples.

### God Mode: 7 (unchanged)

- **Tested by clicks:** Revolt, Spawn nation, Found city, Raze city (6421); H-bomb on Paris, A-bomb on London (4219);
  Breakthrough at peace (2203) and, **new**, at war (7019, Japan against China, day 4, with a control run).
- **Evidence:** `critic/c15_q_6421.json`, `critic/c15_a_4219.json`, `critic/shots/c15a_4219_20_paris_600m_day10.png`,
  `critic/c15_k_2203.json`, `critic/c15_k3_7019.json`, `critic/shots/c15k3_tool_00.png`.
- **Works:** each act told; the H-bomb on Paris (3,329,000 civilians, 47,440 men).
- **Weak:** Breakthrough at war makes a corridor (the sim's state holds 1 against 0 in the control for the first three
  days; the control grows its own by day 7) but no ticker row and no mark on the map at 1,200 m/px (I did not
  open History or look at the strategic tier); the player cannot tell it worked. At peace it does nothing,
  silently. The revolt is told as "Germany declared war on Free Saxony". **AoC does better:** its Spawn Major Battle
  is an event the player sees.

### Editor and scenarios: 7 (unchanged)

- **Tested:** fleets and a bomber group placed, warheads granted, the refusal on land, export, the title's file card,
  play; the random world (200 nations); the Large map.
- **Evidence:** `critic/c15_g_4877.json`, `critic/c15_g4.log`, `critic/c15_g2.log`, `critic/c15_vB.log`,
  `critic/c15_vA.log`, `critic/c15_v2L.log`.
- **Works:** placed navies fight on day 2; the refusal "Not done: no water of a sea is near the place."; 200 random
  nations boot in 3.7 s and run 762 game days in 60 s at Max; the Large map boots in 6.9 s and ran 390 game days in
  60 s at Max (beside the batch: an upper bound).
- **Weak:** the title's Cancel button and file input are browser defaults (ninth run).

### Stats and history: 7 (unchanged)

- **Tested:** the History panel at year 20 (open time, 26 filters), charts, and, **new**, the CSV and JSON downloads.
- **Evidence:** `critic/c15_hi_4877.json`, `critic/shots/c15hi_4877_charts.png`, `critic/c15_dl_4877.json`,
  `critic/c15_dl_4877.csv`.
- **Works:** the panel opens in 178 ms over 3,810 rows, each filter under 200 ms; both downloads work and hold all
  3,810 rows with date, tick, type, names and text.
- **Weak:** the export's `a`/`b` columns are the event's raw words for several kinds: SeaBattle b = 524312, AirRaids
  b = 1658585112, NukeCasualties b = 5826478099, MajorBattleStarted a = 1 named "Wuhu" (`c15_dl_4877.csv`). Anyone
  analysing the export by nation id gets wrong joins for those rows.

### UI/UX and polish: 7 (unchanged)

- **Tested:** the nuclear pause at Max, keys and settings, a phone width, playing a nation, autosave and Continue, a
  fleet's panel in a sea battle (new).
- **Evidence:** `critic/c15_np2_8167.json`, `critic/c15_m.log`, `critic/shots/c15p_phone_02_GodMode.png`,
  `critic/c15_vC.log`, `critic/c15_fp_4877.json`, `critic/shots/c15fp_4877_fleet_1238.png`.
- **Works:** Continue restores the same tick and hash in 3.2 s; the strike pause and banners.
- **Weak:** a fleet in a sea battle reads "Status In contact" with no button to its fight (the builder filed PLAN
  7.126); phone God tools clipped; Offer peace and Breakthrough give no feedback.

### Performance: 6 (up from 5)

- **Tested:** see Runs. Every pinned figure and every page timing compared across builds was taken alone on a quiet
  machine. The batch's own tick figures ran 8 at a time beside browsers and are used only to find the slow years.
- **Evidence:** `critic/c15_perf_seed99_5y_head.log`, `critic/c15_perf_seed99_5y_311988d.log`,
  `critic/c15_perf_8167_y11_20_head.log`, `critic/c15_perf_4877_y21_head.log`, `critic/c15_perf_6421_y21_30_head.log`,
  `critic/c15_perf_6421_y28_read1.log`, `critic/c15_perf_6421_y28_read2.log`, `critic/c15_perf_1129_y11_21_head.log`,
  `critic/c15_perf_1129_y21_read1.log`, `critic/c15_perf_1129_y21_read2.log`, `critic/c15_l_4877.json`,
  `critic/c15o_l_4877.json`, `critic/c15_l_8167.json`, `critic/c15_l_6421.json`, `critic/c15_w_3301.json`,
  `critic/c15o_w_3301.json`, `critic/c15_batch_ticks.txt`.
- **Why up:** what the player waits for fell on every case run on both builds: 4877's three late years at Max 141 →
  112 s, 3301's decade 278 → 250 s, seed 99 2.25 → 2.08 ms; run 14's worst case is gone on HEAD's world (8167 year 19
  1.9 ms, 25 s at Max, no stall); the batch's slow world-years over 5.5 ms 185 → 48 under the same conditions.
- **Why not 7:** ADR-709's 5.5 ms for any year fails pinned on two of four late seeds I re-read: 6421 year 28 **7.9 ms**
  (three reads, operational AI 5.3–5.4 ms of it), years 29 and 30 7.14 and 5.89, year 25 5.51; 1129 year 21 6.4–6.5 ms
  (three reads), year 20 5.77. 6421's year 28 is **81.5 s** at Max in the page, past ADR-698's 45–60 s a late year.
- **AoC:** known from text only.

### Stability: 7 (unchanged)

- **Evidence:** `critic/c15_h_1307.json` (3/3 hashes, twin equal), `critic/c15_vC.log` (Continue: same hash); `errors`
  empty in every page JSON of this run (the one `fatal`, `c15_g_4877.json`, is my script waiting at Max while Poland's
  strike paused the game, as in run 14). 64 headless worlds ran 30 years without a throw. Seed 99 hits the pin
  ac54bc2d.

### Semantic zoom to unit level: 8 (unchanged)

- **Tested:** Germany–Poland at 3,000 to 10 m/px and 15 m/px live (7019); a wheel zoom 6,000 → 3 m/px (5861); the
  Large map at 3,000–25 m/px (3001); late fronts at 250 m/px; a dense China–Japan fight at 250–30 m/px.
- **Evidence:** `critic/shots/c15c_7019_arm_0025m.png`, `critic/shots/c15c_7019_arm_15m_live_1.png`,
  `critic/shots/c15c_7019_arm_0250m.png`, `critic/shots/c15z_5861_17.png`, `critic/c15_v2L.log`,
  `critic/shots/c15tg_7019_d21_120m.png`.
- **Why 8:** tank ranks, tracers and the contact line at 25 m/px; infantry figures at 3 m/px; the Large map draws the
  same (742 elements at 250 m/px).
- **Not more:** at T2 (120 m/px) a dense fight is a wall of tags over invisible elements.

### Naval warfare: 7 (unchanged)

- **Evidence:** `critic/c15_cmp_all.txt`, `critic/c15_g4.log`, `critic/shots/c15n4_8693_rowless_clicked.png`,
  `critic/shots/c15e_3613_sea_01_row_live_1.png`, `critic/c15_fp_4877.json`.
- **Same as run 14:** late battles 8.59 → 8.58 a world-year (ADR-706 a: no rule); battles sinking nothing 3.4 → 2.6 %.
- **Why not 8:** the late sea war is a fifth of year 1's; a sea battle at 15–150 m/px is a few small hulls far apart
  (a Spanish cruiser squadron against a British transport group of 300, `c15e_3613_sea_01_row_live_1.png`); a fleet's
  panel has no way to its battle. **AoC has no navy.**

### Tanks: 8 (unchanged)

- **Evidence:** `critic/shots/c15c_7019_arm_0025m.png`, `critic/shots/c15c_7019_arm_15m_live_1.png`,
  `critic/shots/c15c_7019_week2_0025m.png`, `critic/c15_c.log`.
- **Why 8:** year-1 armour against Polish blocks still reads as a battle: German tank ranks in contact with Polish
  infantry blocks, tracers, the contact line, planes overhead.
- **But:** year 1 engages 11 % fewer land formations than on `311988d` (same seeds), and late armour still rarely
  fights; the one late heavy armoured division in view on a late front (4877 y20, `c15y2_4877_y20_d60_250m.png`) stood
  on a front of a few divisions.

### Aircraft: 7 (unchanged)

- **Evidence:** `critic/c15_cmp_all.txt`, `critic/c15_u_6421.json`, `critic/shots/c15u_6421_f0_0250m.png`.
- **Same as run 14:** late air battles 179 → 181 a world-year (ADR-707 a: no rule); at 6421's year 20, 2 sorties aloft
  in the whole world on the sampled hour. **AoC has no air war.**

### AI nuclear use: 8 (unchanged)

- **Tested:** 1,197 bursts over 56 HEAD worlds against `311988d`; three AI strikes from the player's seat with the
  pause (8167 year 21); restraint lines; Poland armed in the editor.
- **Evidence:** `critic/c15_nukeciv.json`, `critic/c15_cmp_all.txt`, `critic/c15_np2_8167.json`,
  `critic/shots/c15np_8167_paused_2.png`, `critic/c15_t_1129.json`, `critic/c15_g2.log`.
- **Holds:** the pause stops the game on each strike's own hour; the banners stack with Go to; strikes I watched hit
  armies (43,920, 34,552 and 41,718 men; 0, 19,000 and 56,000 civilians). Civilian-heavy bursts flat (over a million civilians 8 → 9 on the same seeds,
  2 of 145 on new seeds).

## Blocking issues, in priority order

1. **R15-B1. The land war got thinner: year 1 −11 %, after year 1 −15 %, and a sixth of checkpoints have nobody in
   contact (R14-B1 not fixed).**
   - Same 48 seeds, `311988d` → HEAD: engaged a day in year 1 45.05 → 40.01 (lower on 35 of 48), years 2–30 5.11 → 4.35
     (lower on 42 of 48), 10.9 % of year 1's; per war 0.732 → 0.636. Checkpoints y10/y20: 5.64 → 4.49, nobody in
     contact at **17 of 96** (4). New seeds, both commits: year 1 43.7 → 38.0, late 4.93 → 4.47, empty checkpoints 1 → 4
     of 16.
   - In the page: 7019 year 20, 6 wars and 422 land formations at war, 0 in contact on 6 of 7 samples over 60 days.
   - The hollow-division half of R14-B1 is fixed (72.4 → 0.4 a world); the fold cost contact, as ADR-701 measured for
     years 2–20; the year-1 fall was outside its AT.
   - **Evidence:** `critic/c15_cmp_checkpoints.json`, `critic/c15_cmp_all.txt`, `critic/c15_y2_7019_y20.json`,
     `critic/shots/c15y2_7019_y20_d20_3000m.png`.
   - **Fix:** measure year 1 too in any contact AT; get year 1 back to `311988d`'s level on the same seeds, then raise
     the late per-war figure, on unseen seeds with a bar.
2. **R15-B2. The 5.5 ms tick budget (ADR-709) fails in the late game: 7.9 ms pinned (R14-B2 improved, not fixed).**
   - Pinned, alone: 6421 year 28 7.88, 7.92, 7.98 ms (operational AI 5.3–5.4 ms), year 29 7.14, year 30 5.89, year 25
     5.51; 1129 year 21 6.39, 6.54, 6.53 ms, year 20 5.77. Six world-years over the budget of the 31 I read pinned; 1129's
     two are inside the 25 years PLAN 7.124's AT reads. In the page, 6421's year 28 takes 81.5 s at Max.
   - Run 14's case is gone (8167 year 19 13.3 → 1.9 ms); the batch's slow years fell 185 → 48.
   - **Evidence:** `critic/c15_perf_6421_y21_30_head.log`, `critic/c15_perf_6421_y28_read1.log`,
     `critic/c15_perf_6421_y28_read2.log`, `critic/c15_perf_1129_y11_21_head.log`, `critic/c15_perf_1129_y21_read1.log`,
     `critic/c15_perf_1129_y21_read2.log`, `critic/c15_l_6421.json`; saves `critic/c15_seed6421_y27.bin`,
     `critic/c15_seed1129_y20.bin`.
   - **Fix:** profile the operational AI on 6421's year 28 (from `c15_seed6421_y27.bin`) and 1129's year 21; read the
     budget on seeds run to 30 years, not 25.

## Non-blocking issues

- **Dense fights at T2 are a wall of tags** over near-invisible elements (`c15tg_7019_d21_120m.png`).
- **Breakthrough gives no feedback**, at peace or at war (`c15_k_2203.json`, `c15_k3_7019.json`).
- **God revolt told as a declared war** (`c15_q_6421.json`).
- **Offer peace gives no answer** (`c15_pl_6011.json`).
- **A fleet's panel has no way to its sea battle** (`c15_fp_4877.json`; PLAN 7.126 filed).
- **History export's a/b columns** are raw event words for sea battles, air war, air raids, convoys, nuclear tolls and
  major battles (`c15_dl_4877.csv`).
- **Phone: God tools clipped** (`c15p_phone_02_GodMode.png`).
- **Late map colours:** the US's navy beside the sea and France's blue (`c15y2_7019_y20_d20_3000m.png`).
- **Title's Cancel and file input unstyled** (`c15g_4877_10_title_pending.png`).

## Design objections (none blocking, no score lowered)

- **The budget's level** (ADR-709, 5.5 ms): about 50 s a late year at Max at the budget, 81 s where it breaks. A
  player watching 30 years waits 20–40 minutes. Scored only where it is broken.
- **Late wars closed with no rule** (ADR-702 d, ADR-706 a, ADR-707 a): the late land, sea and air wars are each a tenth
  to a fifth of year 1's, and three decisions in a row accept that. I still think the late game is the weakest thing to
  watch. Scored only on the measured fall (R15-B1).
- **Save games:** one autosave slot and Continue (SPEC §2.5); AoC's full version has save/load (known from text,
  `AOC_TEXT_NOTES.md` line 569).
- **The late map's count** (ADR-639 b): 1,051 small pieces against `dd3b730`'s 837 on the same 24 seeds.

## Notes

- Run 14's figures reproduce on `311988d` in this session: seed 99 hash 2ead5b7e at 2.25 ms (2.28), 3301's decade
  278 s (279).
- The batch's tick figures ran 8 at a time beside browsers; a contended year read about 1.0–1.25 × its pinned figure
  (6421 y28 8.23 against 7.9).
- The page's decade timings count my script's own pauses between years (one gap of 1–5 s a year, and a few more after
  the slow-speed front views in years 3 and 6) on both builds alike; they are not stalls.
- Ports 5316 (HEAD) and 5317 (`311988d`) stopped at the end; the worktree's `node_modules` junction was unlinked before
  `git worktree remove`.

## Strengths, verified

- **The remnants are gone:** under-500-man divisions 72 → 0.4 a world; late fronts show full divisions
  (`c15y2_4877_y20_d60_250m.png`).
- **The late game is faster where the player waits:** 8167's year 19 at Max 142 s → 25 s with no stall; 4877's late
  years 141 → 112 s.
- **Determinism and resume:** browser equals headless year by year on 1307; Continue restores the same tick and hash.

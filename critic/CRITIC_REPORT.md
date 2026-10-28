# Critic report, run 17

- **Commit:** `cfedb50a062a70dc6c8731ff7ca31c16bb25c253` (HEAD at the start, `critic/c17_commit.txt`). Run 16 was on
  `7b883084`; 37 commits since. The ones that touch the game: the operational AI's late plans made cheaper (ADR-729);
  at war the wing rebuild keeps the war's reserve (ADR-736); the k-th strike of a day on a land formation at 1/(1+k)
  (ADR-737, `formations.struck`); a carrier group in training holds back no other warship (ADR-734); a carrier's
  wings strike ashore and at range from the deck (ADR-738); the outnumbered side of a land front saves for no warship
  and gets one more order slot (ADR-739); a wing at sea says so on the player's Actions row (`6f5b2c83`); a fight
  T3 cannot hold goes out past T3 (ADR-743). Decided by the user since run 16: the set of the five largest by area may
  stand (ADR-732), no bar on the largest nation's share (ADR-740), year 1's contact read closed (ADR-741), the
  carriers' wings may sink fleets before they meet (ADR-742).
- **Date:** 2026-10-28.
- **Build:** `vite build --outDir critic/c17_dist`, exit 0 (`critic/c17_build.log`), served with `vite preview` on
  127.0.0.1:**5336**. `7b883084` from a worktree (`critic/wt`) into `critic/c17o_dist`, on **5337**, for the old-save
  comparison. Chromium through Playwright, headless, 1600 × 900 (390 × 844 phone, 1280 × 720 laptop).
- **Runs:**
  - 72 unaided headless worlds × 30 years on HEAD (`critic/scripts/c17_batch.sh`, `c17_headless.ts` = run 16's script
    plus the strongest five, carrier air hours and a year-end navy census): **run 16's 64 seeds**, compared with run 16's
    `c16_*` files (`7b883084`), and **8 new seeds** (1607, 2213, 3727, 4493, 5419, 6301, 7129, 8273) on **both**
    commits (`c17o_*` = `7b883084`). Paired per-seed comparison with the standard error of the mean difference:
    `critic/c17_cmp_y30.json` (`c17_cmp.py`), navy census `critic/c17_navycmp.json`, checkpoint reads on HEAD's
    y10/y20 saves `critic/c17_engaged_w*.json`, `critic/c17_navy_w*.json` against run 16's.
  - Performance, after the batch, pinned (`--affinity 0xFFFF`), alone: seed 99 × 5 years on both commits; HEAD's
    five slowest batch world-years and HEAD's own 3847 y27 and 5683 y26, each twice from HEAD's saves stepped to the
    year's start (`c17_perf.sh`). The slowest year at Max in the page.
  - In the page: run 16's probes re-run (God tools, nukes by God, Breakthrough at peace and at war, phone/laptop,
    armour at 3,000–10 m/px, wheel zoom, dense-fight tags, playing Poland, editor fleets and armed Poland, the
    North Sea standoff, the carrier strike row, a fleet's "To its fight", late worlds 7019/4877/6421 y20 for 60 days,
    late air, the nuclear pause, restraint lines, History and its downloads, browser = headless). **New:** a carrier's
    strike ashore (seed 99); the fight camera past T3 (5381 day 21, formation 29, ADR-743's own case); a new seed
    (1607) watched two years; **an autosave from an older build pressed through Continue, on HEAD and on
    `7b883084`**; a pure browser-vs-headless check with each input on its own.
- **Reference:** `reference/screens/`, `reference/text/AOC_TEXT_NOTES.md`. AoC's nukes, God tools, save/load and
  performance are known from text only; confidence there is lower.
- **Prefix:** every path below was made in this run (`c17`; `c17o` = `7b883084`). Scripts in `critic/scripts/c17_*`.

## Verdict

**The late land war and the sky are clearly livelier than in run 16, but the sea war shrank by a third, the
carriers built late sail with empty decks, and a returning player's Continue now opens a corrupted half-1938,
half-1960s world without a word.**

- **New, blocking (R17-B1):** every autosave made before ADR-737 fails to load on HEAD (`missing section
  formations.struck`), and Continue does not refuse it: the save's map, date and tick come in, the 1938 start's 1,467
  formations and its two wars stay ("Nationalist Spain ⚔ ?"), and the game runs on that chimera. The same c10 save
  loads whole on `7b883084` (636 formations, its own wars). Pages deploys every push.
- **Late land war up a quarter (R16-B1 partly met):** same 64 seeds, engaged land formations a day in years 2–30
  **4.11 → 5.11** (+24 %, 8.3 se, higher on 56); new seeds on both commits 3.94 → 5.49 (higher on 7 of 8). Still
  **13 %** of year 1 (39.0), and HEAD's 7019 y20 in the page: 0, 0, 0, 0, 2, 2, 0 engaged of ~620 at war.
- **The sky doubled:** sorties aloft late **18.2 → 39.5** a world-hour, air battles late 237 → 671 a world-year, wings
  late 69 → 103, higher on **64 of 64**.
- **The sea war fell:** sea battles late **8.16 → 5.32** a world-year (−35 %, lower on 61 of 64), ships sunk in them
  80.8 → 59.7, year 1's sea battles 41.9 → 35.5; carriers with a wing aboard at year 20 **3.08 → 1.30** a world
  (R17-B3). Surface warships afloat at year 20 278 → 306: the fleets are there, they fight less.
- **Performance:** one pinned breach of the 5.5 ms budget left (9781 y24 **5.85 / 5.82 ms**), down from two at
  6.0–6.2; no longer blocking.

## Scores

| Dimension | Run 16 | Run 17 |
|---|---|---|
| Map visuals and readability | 7 | 7 |
| Diplomacy, war, alliance, puppet, revolt depth | 7 | 7 |
| Emergent world dynamics over long runs | 6 | 6 |
| God Mode | 7 | 7 |
| Editor and scenarios | 7 | 7 |
| Stats and history | 7 | 7 |
| UI/UX and polish | 7 | 7 |
| Performance | 7 | 7 |
| Stability | 7 | **5** |
| Semantic zoom to unit level (needs 8) | 8 | 8 |
| Naval warfare (needs 8) | 7 | **6** |
| Tanks (needs 8) | 8 | 8 |
| Aircraft (needs 8) | 7 | **8** |
| AI nuclear use (needs 8) | 8 | 8 |

## Run 16's cases re-run

| Run 16 case | On HEAD | Evidence |
|---|---|---|
| R16-B1, late contact 4.36 → 4.13 (`7739a78` → `7b88308`) | Same 64 seeds `7b88308` → HEAD: **4.11 → 5.11** (+0.995, se 0.12, higher on 56); per war 0.596 → 0.777; per land formation at war 1.06 → 1.10 % (n.s.). New seeds, both commits: 3.94 → 5.49 (se 0.38). Year 1 40.4 → 39.0 (−1.4, se 0.88, n.s.). By year: y2 9.3 → 14.0, y5 5.4 → 6.7, y10 4.2 → 5.0, y20 2.9 → 3.8, y30 3.9 → 4.2: the gain is largest early. | `critic/c17_cmp_y30.json`, `critic/c17_cmp_y30.txt` |
| R16-B1, stasis: same five over 12 years 13 of 56 | Same 64 seeds: the **set** over 12 years **14 → 5**, longest 23 → 19. Now a design (ADR-732): judged by the ordered five and the strongest five. **Ordered five over 12 years: 1 → 2 of 64** (5521 18 years, 7901 14), against ADR-732's own bar "at most 12 in every world"; strongest five at most 12 on all 72 HEAD worlds (met). | `critic/c17_cmp_y30.txt` (`headOnly`), `critic/c17_headless_5521.json` |
| Checkpoints with nobody in contact 10 of 112 | Same 64 seeds × y10/y20 (7 days each): mean 3.50 → 4.22 (se 0.57, n.s.); **nobody in contact 13 → 17 of 128** (n.s.). | `critic/c17_engaged_w*.json`, `critic/c16_engaged_w*.json` |
| In the page, late worlds (7019 y20 4, 5, 0, 3, 0, 0, 0) | HEAD's own saves, 60 days: **7019 y20 0, 0, 0, 0, 2, 2, 0** of ~620; 4877 y20 0, 0, 0, 2, 3, 9, 16; 6421 y20 0, 8, 5, 8, 6, 2, 0; new 1607 y20 38, 15, 26, 4, 17, 14, 24; new 5419 y20 2, 3, 6, 0, 0, 0, 0. Different worlds from run 16's (the rules moved them); no better on these cases. | `critic/c17_y2_7019_y20.json`, `critic/c17_y2_4877_y20.json`, `critic/c17_y2_6421_y20.json`, `critic/c17_y2_1607_y20.json`, `critic/c17_y2_5419_y20.json` |
| R16-B2: 3847 y27 6.14/6.19, 5683 y26 6.02/5.82 ms | **Run 16's saves no longer load on HEAD** (`missing section formations.struck`, `critic/scripts/c17_loadtest.ts`): the builder's figures on them cannot be re-read (same root as R17-B1). HEAD's own worlds: 3847 y27 3.17/3.16 ms, 5683 y26 1.82/1.83 (other worlds). HEAD's slowest batch years pinned: **9781 y24 5.85 / 5.82**, 8011 y19 5.18/5.17, 7129 y28 4.84/4.84, 7019 y15 4.51/4.50, 4493 y14 4.24/4.26. Pinned read 0.70–0.85 × contended this run, so the sixth contended (5.96) reads under the line. Batch hashes reproduced on every re-read. | `critic/c17_perf_9781_y24_read1.log`, `critic/c17_perf_9781_y24_read2.log`, `critic/c17_perf_*_read*.log` |
| 3847's year 27 at Max 60.4 s | HEAD's slowest year (9781 y24) at Max: **60.4 s**, no gap over 500 ms, 59.6 fps. | `critic/c17_l_9781.log` |
| Seed 99 2.14 ms, pin 2b4bc96e | Pinned: HEAD **2.11 ms** over 5 years, hash **2283b28a** (the pin, ADR-739); `7b88308` 2.10 ms, 2b4bc96e. Level. | `critic/c17_perf_seed99_5y_head.log`, `critic/c17_perf_seed99_5y_7b88.log` |
| Carriers with a wing aboard y20 3.13 a world | Same 64 seeds: **3.08 → 1.30** at year 20 (se 0.36, lower on 35, higher on 8); y10 4.55 → 2.08. In five HEAD y20 saves 12 of 15 carrier groups at war hold no wing. | `critic/c17_navycmp.json`, `critic/c17_cvread_y20.txt` |
| Carrier strike hours year 21, 0 → 30 on 8 worlds | Now flown out of battle too: carrier-wing strike hours a world-year (new seeds, both commits) **5 → 857** late; by year on HEAD 5,004 (y1), 1,598 (y10), 708 (y20), 805 (y30) as the decks empty. | `critic/c17_cmp_y30.json` (`new.cvAirLate`) |
| Transports y20 548 → 498 | Same seeds y20 **495 → 456** (se 24), y10 403 → 359 (se 17): ADR-734's slot did not bring them back. | `critic/c17_navycmp.json` |
| Late sea war 8.54 → 8.20 battles | **8.16 → 5.32** (se 0.21, lower on 61); sunk in battles 80.8 → 59.7 (lower on 58). | `critic/c17_cmp_y30.json` |
| Late air 2 sorties aloft (6421 y20) | HEAD's 6421 y20: **14** aloft in the world, 1607 y20 27. Headless 18.2 → 39.5 (64 of 64). Fronts at 250 m/px still mostly empty skies (6421: 2, 1, 0). | `critic/c17_u_6421.json`, `critic/c17_u_1607.json`, `critic/shots/c17u_1607_f3_0250m.png` |
| Wings late 95 → 69 | **69 → 103** (64 of 64). Fixed (ADR-736). | `critic/c17_cmp_y30.json` |
| Ferried wings invisible | A player's wing at sea now reads "at sea to its new base, N days" (code, `6f5b2c83`); the AI's ferries still have no mark on the map (no ferry drawing in `src/app`). Not re-driven in the page. | `src/ui/ActionsTab.tsx:105` |
| Breakthrough at peace does nothing (2203) | Unchanged: counts identical before and after, no row. At war (7019) a corridor in state, no row. | `critic/c17_k_2203.json`, `critic/c17_k3_7019.json` |
| God revolt told as a declared war | Unchanged: "1 January 1938 Germany declared war on Free Saxony". | `critic/c17_q_6421.json` |
| Phone: God tools clipped | Unchanged: "Revo", "Spawn n", "Breakthr", "Territo", "Found c", "Raze c". | `critic/shots/c17p_phone_02_GodMode.png` |
| Offer peace: no answer | Unchanged: Poland offers Lithuania peace; no row. | `critic/c17_pl_6011.json` |
| History export a/b raw | Unchanged: SeaBattle a = 131092, b = 458780. | `critic/c17_dl_3727.csv` |
| Dense fight tags | Day 35 at 250 m/px: 65 inputs, 45 placed, 3 left out (run 16: 61 / 51 / 5). | `critic/c17_tg_7019.json` |
| Editor North Sea standoff (4877) | Holds: "Germany and United Kingdom fought at sea: Germany lost 21 ships, United Kingdom 13", 2 January. | `critic/c17_g4_standoff_track_4877.log` |
| Editor-armed Poland (9437) | The case moved, the claim holds: Poland strikes Germany near Würzburg on day 48 (12,000 civilians, 65,396 men), Moscow day 92. | `critic/c17_g2_poland_9437.log` |
| Carrier strike row (8693) | Holds: "⚓ Carrier strike: Japan on United States's ships". | `critic/c17_n4_rowless_8693.log`, `critic/shots/c17n4_8693_rowless_clicked.png` |
| Fleet panel "To its fight" | Holds: 8 of 8 presses frame the fleet with 1–5 enemy fleets (60–478 m/px). | `critic/c17_fp2_5381.json`, `critic/c17_fp2_4877.json` |
| Nuclear pause (4877) | Holds from HEAD's y20: three pauses on strike hours with the toll in the banner. | `critic/c17_np2_4877.json`, `critic/shots/c17np_4877_paused_1.png` |
| Restraint lines | Consistent over 60 days on 2213 y20 (noPlace, notDesperate, noThreat, puppet). | `critic/c17_t_2213.json` |
| Browser = headless (1307) | Year hashes equal with no input (seeds 99 and 1307), and with each input of the probe alone and together; the run-16 probe matched on 3 of 4 runs. **One run gave other hashes from year 1** (4c6b44a9 against a6febaa8), not reproduced in 3 re-runs, one under 20 busy cores. | `critic/c17_h_misc_1307_3.log`, `critic/c17_det_1307_8760.json`, `critic/c17_det2_1307_*.json` |
| Bursts over a million civilians 11 → 9 | Same seeds 12 → 19 (n.s., se 8); worst on HEAD: 2539 y21, a Soviet H-bomb on Japan, 3,857,000 civilians, 5,278 men. | `critic/c17_headless_2539.json` |
| Not re-read this run | Hollow divisions, enclaves and pieces, 3613's sea row, the Large map, 3301's decade at Max, the editor's carrier decks (code unchanged: `git diff --stat 7b883084 HEAD -- src` touches no editor or spawn code). | — |

## Dimensions

### Map visuals and readability: 7 (unchanged)

- **Tested:** late worlds at 3,000 and 250 m/px (1607, 7019, 4877, 6421 y20), a new seed's Europe every 60 days for two
  years, dense China–Japan and German–Polish fights.
- **Evidence:** `critic/shots/c17y2_1607_y20_d00_3000m.png`, `critic/shots/c17ww_1607_d480_europe.png`,
  `critic/shots/c17c_7019_arm_0025m.png`, `critic/c17_tg_7019.json`.
- **Weak, unchanged:** the late United States' blue beside the sea's navy in North Africa (`c17y2_1607_y20_d00_3000m.png`);
  ~45 tags at 250 m/px in the densest fight. No drawing code changed but ADR-743's camera.
- **AoC does better:** contiguous blobs with readable names and contrasting colours (`reference/screens/steam-screenshot-03.jpg`).

### Diplomacy, war, alliance, puppet, revolt depth: 7 (unchanged)

- **Same 64 seeds:** wars declared 480 → 451 a world (se 11, lower on 45), peaces 461 → 431, major battles 109 → 143
  (se 6), revolts, puppets, annexations level.
- **Weak (unchanged UI):** bloc wars of 30+ members ("Germany +28 ⚔ Denmark +5", 1607 y20); Offer peace unanswered.

### Emergent world dynamics over long runs: 6 (unchanged)

- **Tested:** 72 worlds × 30 years (64 against run 16's files, 8 new on both commits); five late worlds 60 days in the page; a new seed's first two years.
- **Better:** late contact +24 % (8.3 se) on the same seeds and +39 % on new seeds; the set of the five largest over 12 years 14 → 5.
- **Why still 6:** late contact is 13 % of year 1 and the gain thins with the years (y20 3.8 a day across ~7 wars); in the page 7019 y20 has 2 formations in contact on 2 of 7 samples of ~620 at war, 5419 y20 none on 4 of 7; nobody in contact at a checkpoint 13 → 17 of 128 (n.s.); ADR-732's own ordered-five bar fails in 2 of 64 (5521 18 years).

### God Mode: 7 (unchanged)

- **Tested by clicks:** Revolt, Spawn nation, Found city, Raze city (6421); H-bomb on Paris, A-bomb on London (4219: 3,329,000 and 314,000 civilians in the ticker); Breakthrough at peace (2203) and at war (7019).
- **Evidence:** `critic/c17_q_6421.json`, `critic/c17_a_4219.json`, `critic/c17_k_2203.json`, `critic/c17_k3_7019.json`.
- **Weak (unchanged code):** Breakthrough silent; the revolt told as a declared war.

### Editor and scenarios: 7 (unchanged)

- **Tested:** fleets and a bomber group placed, the refusal on land, the standoff, armed Poland.
- **Evidence:** `critic/c17_g_4877.json`, `critic/c17_g4_standoff_track_4877.log`, `critic/c17_g2_poland_9437.log`.
- **Weak, unchanged code:** editor carrier groups with empty decks and no panel line for what is aboard; the title's Cancel and file input browser defaults.

### Stats and history: 7 (unchanged)

- **Evidence:** `critic/c17_hi_3727.json` (4,600 events, 27 types, opened in 183 ms), `critic/c17_dl_3727.csv` (4,601 lines).
- **Weak:** the export's `a`/`b` columns are raw event words for sea battles and air war.

### UI/UX and polish: 7 (unchanged)

- **Tested:** phone and laptop, playing Poland, keys and modes, the fleet and formation panels, the nuclear pause.
- **Evidence:** `critic/shots/c17p_phone_02_GodMode.png`, `critic/c17_pl_6011.json`, `critic/c17_m.json`, `critic/c17_np2_4877.json`.
- **New weakness:** "To its fight" on a land formation in contact can frame blocks 20+ km apart with no contact line between them (5381 day 21, Germany's 29 at 45 m/px, the French cavalry ~400 px away, `critic/shots/c17ft_5381_d21_29.png`; Poland's 555 in 1607, `critic/shots/c17ft_1607_d40_555.png`, whose framed fight is Italy's against France): the panel says "In contact", the screen shows no fight.

### Performance: 7 (unchanged)

- **Evidence:** `critic/c17_perf_seed99_5y_head.log`, `critic/c17_perf_seed99_5y_7b88.log`, `critic/c17_perf_*_y*_read*.log`, `critic/c17_l_9781.log`.
- **Better:** pinned breaches of the 5.5 ms budget 2 → 1, the worst 6.19 → 5.85 ms; seed 99 level (2.11 against 2.10).
- **Why not more:** ADR-709's "any year" still fails once (9781 y24 5.85 / 5.82 ms, operational AI 2.85 ms of it); the worst year is 60.4 s at Max, as in run 16; late mean tick contended 2.83 → 3.00 ms (se 0.05, higher on 42 of 64) and contended world-years over 5.5 ms 4 → 17 (conditions differ between runs; a trend, not a verdict). **AoC:** text only.

### Stability: 5 (down from 7)

- **Evidence:** `critic/c17_os_c10.json`, `critic/shots/c17os_00_title.png`, `critic/shots/c17os_01_after_continue.png` (HEAD); `critic/c17o_os.json`, `critic/shots/c17oos_01_after_continue.png` (`7b883084`); `critic/c17_os.json` (run 16's own 3847 save on HEAD); `critic/scripts/c17_loadtest.ts`.
- **Why down (same case, both builds):** an autosave from `8f6732e3` (run 10's 4219 year 10) put in the page's autosave slot and pressed through the title's Continue. On `7b883084` it loads whole: 636 formations, its wars, 30 December 1947. On HEAD the load throws (`missing section formations.struck`, ADR-737's new column) after the map, tick and date are in: the screen shows Germany across Siberia beside the 1938 start's armies ("1.39M" in Berlin, 1,467 formations, "Infantry division 1" at Berlin) and the 1938 war chips ("Nationalist Spain ⚔ ?"), no message, no console error; Resume runs it on ("5 January 1948 Peru declared war on Chile"). Run 16's 3847 year-26 save does the same (`c17_os.json`). Every save made before ADR-737 (`52f71a5a`) now opens this way, and each new column will do it again.
- **Also:** one unreproduced browser/headless hash mismatch (`c17_h_misc_1307_3.log`, 1 of 4 runs of the same probe); 72 headless worlds 30 years without a throw; `errors` empty in every page JSON of HEAD's play.

### Semantic zoom to unit level: 8 (unchanged)

- **Evidence:** `critic/shots/c17c_7019_arm_0025m.png`, `critic/shots/c17c_7019_inf_0010m.png`, `critic/c17_z_5861.json`, `critic/c17_c_7019.json`.
- **Holds:** German armour ranks against Polish blocks with tracers, the contact line, planes overhead at 25 m/px; infantry figures at 10 m/px. **Not more:** dense fights a wall of tags; fights framed past T3 can show two blocks apart and nothing between (UI/UX above).

### Naval warfare: 6 (down from 7)

- **Evidence:** `critic/c17_cmp_y30.json`, `critic/c17_navycmp.json`, `critic/c17_navy_w*.json`, `critic/c17_cv_99.json`, `critic/shots/c17cv_99_0_framed.png`, `critic/shots/c17cv_99_0_target_t2.png`, `critic/c17cv_6301_save.json`, `critic/c17_fp2_4877.json`.
- **Why down (same 64 seeds):** sea battles late 8.16 → 5.32 a world-year (−35 %, lower on 61), year 1 41.9 → 35.5 (3.5 se); ships sunk in battles late 80.8 → 59.7; carriers with a wing aboard at year 20 3.08 → 1.30 (run 16's reason for holding 7 was carriers back on the sea and manned); transports y20 495 → 456. Surface warships afloat at y20 278 → 306: the fleets are there and fight less.
- **Decided, set apart:** ADR-742 accepts that carrier wings sink fleets before battles. My runs count no ship sunk from the air; the builder's 0.98 × "by any means" is unverified here (Design objections). What is scored is the undecided rest and what the player sees.
- **What the player sees:** a carrier's strike ashore (seed 99, hour 3) is drawn as land-based planes over the coast with no row in the ticker; the carrier group's panel reads "Status Holding" and lists its ships, no wings and no mission (`c17_cv_99.json`). Late US carrier groups at war (6301 y20: two at one spot, 0 wings aboard) read the same as manned ones.
- **AoC has no navy.**

### Tanks: 8 (unchanged)

- **Evidence:** `critic/shots/c17c_7019_arm_0025m.png`, `critic/shots/c17c_7019_arm_0080m.png`, `critic/c17_c_7019.json`.

### Aircraft: 8 (up from 7)

- **Evidence:** `critic/c17_cmp_y30.json`, `critic/c17_u_6421.json`, `critic/c17_u_1607.json`, `critic/shots/c17c_7019_inf_0010m.png`, `critic/shots/c17cv_99_0_target_t2.png`.
- **Why up (same 64 seeds, `7b88308` → HEAD):** sorties aloft late 18.2 → **39.5** a world-hour, air battles late 237 → **671** a world-year, wings late 69 → 103, each higher on all 64; year 1 aloft 54.5 → 66.7. In the page, HEAD's 6421 y20 holds 14 sorties aloft (run 16's 6421 y20, a different world: 2), 1607 y20 27. Carrier wings now fly from the deck at land targets (seed 99). **AoC has no air war.**
- **Not more:** a late front at 250 m/px is often an empty sky (6421 fronts 2, 1, 0 sorties); ADR-737 cut the air's damage to land by about 63 % (its read), so more planes do less; carrier sorties are not told apart from land ones.

### AI nuclear use: 8 (unchanged)

- **Evidence:** `critic/c17_np2_4877.json`, `critic/shots/c17np_4877_paused_1.png`, `critic/c17_t_2213.json`, `critic/c17_g2_poland_9437.log`, `critic/c17_headless_2539.json`.
- **Holds:** the pause on each strike's hour with the toll; strikes on armies (Germany on Denmark near Sisimiut, 89,036 men; 19,000 civilians). Bursts per world 22.2 → 24.2 (n.s.); over a million civilians 12 → 19 on the same seeds (n.s.), the worst 3,857,000 (2539 y21, the Soviet Union on Japan).

## Blocking issues, in priority order

1. **R17-B1. Continue opens an older autosave as a corrupted world, silently.**
   - An autosave from before ADR-737 fails to load (`missing section formations.struck`) after the map, date and tick
     are replaced; the 1938 start's formations and wars remain and the game runs on. The title offers it as a normal
     "Saved game … Continue". The same save loads whole on `7b883084`.
   - **Evidence:** `critic/c17_os_c10.json`, `critic/shots/c17os_01_after_continue.png`, `critic/c17o_os.json`,
     `critic/shots/c17oos_01_after_continue.png`, `critic/c17_os.json`, `critic/scripts/c17_oldsave.mjs`.
   - **Fix:** load into a scratch world and swap only on success (or check a stored format version on the record
     before offering Continue); on failure say so on the title and start nothing half-loaded. Keep a test that loads
     a save lacking a column and asserts a refusal, not a mixed state.
2. **R17-B2. The late world is still mostly still (R16-B1 carried; improved a quarter).**
   - Same 64 seeds: engaged a day years 2–30 4.11 → 5.11 (+24 %), 13 % of year 1's 39.0; y20 3.8. HEAD's 7019 y20 in
     the page: 0, 0, 0, 0, 2, 2, 0 of ~620 at war; 5419 y20 0 on 4 of 7 samples. Nobody in contact at a checkpoint 13 →
     17 of 128.
   - **Evidence:** `critic/c17_cmp_y30.json`, `critic/c17_y2_7019_y20.json`, `critic/c17_y2_5419_y20.json`,
     `critic/c17_engaged_w1.json`.
   - **Fix and the bar I would accept:** on unseen seeds × 30 years, engaged land formations a day in years 2–30 at
     least a fifth of year 1's (≈ 8 a day at today's year 1), and no late world with a war on land showing nobody in
     contact on more than two of seven 10-day samples in the page.
3. **R17-B3. AI carriers sail with empty decks: run 16's manned carriers, and ADR-738's "the carriers now fight", undone by year 20.**
   - Same 64 seeds: carriers with a wing aboard at year 20 3.08 → 1.30 a world (5 se), year 10 4.55 → 2.08; HEAD's
     y20 saves of 1607, 2213, 3727, 4493, 6301: 12 of 15 carrier groups at war hold no wing. Inferred, not measured: the wings are spent on ADR-738's missions
     (carrier air hours fall 5,004 → 708 a world-year from year 1 to 20) and not re-manned; the panel shows neither.
   - **Evidence:** `critic/c17_navycmp.json`, `critic/c17_navy_w*.json`, `critic/c17cv_6301_save.json`, `critic/c17_cvread_y20.txt`.
   - **Fix:** rebuild or reassign wings to carriers at war (the rebuild of ADR-736 counts deck wings), and show a
     carrier's wings and their mission on its panel.

## Non-blocking issues

- **The 5.5 ms budget fails once:** 9781 y24 5.85 / 5.82 ms pinned (operational AI 2.85 ms); 60.4 s at Max. Demoted
  from blocking: one year 6 % over in 2,160 world-years does not make a player quit; PLAN 7.139's claim is still not
  met on every year.
- **Sea battles −35 % late and −15 % in year 1** on the same seeds (part decided by ADR-742; see objections).
- **Carrier strikes are unattributed:** no ticker row for a strike ashore, no wing or mission on the carrier's panel.
- **"To its fight" frames blocks 20+ km apart with nothing between** (`c17ft_5381_d21_29.png`, ADR-743's own case).
- **ADR-732's ordered-five bar fails in 2 of 64 worlds** (5521 18 years, 7901 14).
- **One browser/headless mismatch**, unreproduced (`c17_h_misc_1307_3.log`).
- **Unchanged UI:** Breakthrough silent; God revolt told as a declared war; Offer peace unanswered; phone God tools
  clipped; export a/b raw; the title's Cancel and file input unstyled; editor carriers empty; AI ferries unmarked.

## Design objections (none blocking, no score lowered)

- **Sea battles traded for carrier strikes (ADR-742):** the user accepted the fall in battles as sinkings moved to the
  air. On my runs the visible sea war fell a third with fleets as large as before; the "by any means" 0.98 × is not
  measured here. A sea war told through unattributed planes is harder to watch than battles with rows.
- **The set of the five largest may stand (ADR-732):** 5 of 64 worlds over 12 years on HEAD. No ranking by ADR-732's `strengths` (an overlord with its puppets, army and navy together)
  is shown to the player (the Ranking has Land, Army, Income and others), so "change at the top by power" cannot be seen in the game.
- **No bar on the largest nation (ADR-740):** 10 of 72 HEAD worlds end with one nation over a third of the land (1307
  38.9 %, 4673 38.6 %).
- **No save kept across versions** (DECISIONS' standing note): the policy is decided; its execution is R17-B1.

## Notes

- The batch ran 8 worlds at a time beside page probes on both commits; every pinned figure was taken alone after it.
- `c17_headless.ts`'s extra reads do not move the world: its 1307 year-1 hash equals `npm run sim` (a6febaa8).
- The title card's date in `c17os_00_title.png` is the probe's own tick written into the record, not the save's.
- Ports 5336 and 5337 stopped at the end; the worktree's `node_modules` junction was unlinked before `git worktree remove`.

## Strengths, verified

- **The sky is alive:** twice the sorties and nearly three times the air battles late on every one of 64 worlds.
- **Late land contact up a quarter** on the same seeds (8 se), the largest move of any run so far.
- **Determinism with no input:** seeds 99 and 1307 hash alike in the browser and headless, and seed 99 hits its pin.

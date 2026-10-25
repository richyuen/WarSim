# Critic report, run 14

- **Commit:** `311988d78a325ac696980ac9534a73c85d421edd` (HEAD at the start, `critic/c14_commit.txt`). Run 13 was on
  `0c80db1`; 48 commits since: every AI strike its own banner and the pause on the strike's hour (7.109a, ADR-690);
  statelets of one people join (7.106, ADR-681); a fleet that breaks off carries no wound away (7.107, ADR-682); the
  air force rebuilt to its start (7.113a, ADR-689); a plane gives way to itself close in (7.108a, ADR-684); a strike
  out of contact, the threatened sectors one each (7.110b, 7.115, ADR-692/693); the answer to a strike on forces only
  at places of forces (7.114, ADR-697); the tick's budget set to **5.0 ms in any year** (ADR-698); a stack's files and
  the fight view (ADR-699, ADR-700). Several tasks closed not done by the user's decisions.
- **Date:** 2026-10-25.
- **Build:** `vite build --outDir critic/c14_dist`, exit 0 (`critic/c14_build.log`), served with `vite preview` on port
  **5314**. `0c80db1` built from a worktree (`critic/wt`, junction unlinked before removal) into `critic/c14_olddist`,
  served on **5315**, for same-session page timing. Chromium through Playwright, headless, 1600 × 900 (390 × 844 for
  the phone).
- **Runs:**
  - 48 unaided headless worlds × 30 years on HEAD (`critic/scripts/c14_batch.sh`, `c14_headless.ts`, run 13's script):
    **run 13's 40 seeds** for a same-seed comparison against run 13's `c13_*` files (`0c80db1`), and **8 new seeds**
    (1187, 2539, 3359, 4673, 5651, 6967, 7411, 8539) run on **both** commits (`c14o_*` = `0c80db1` in the worktree).
    Comparisons: `critic/c14_cmp_all.txt`, `critic/c14_cmp.json` (`c14_cmp.py`); checkpoints at years 10 and 20
    (engaged over 7 days, small pieces, hollow divisions), each commit's saves read by its own code:
    `critic/c14_cmp_checkpoints.json` (`c14_cmp2.py`).
  - Performance, pinned (`--affinity 0xFFFF`), alone, one at a time: seed 99 × 5 years and year 21 of 4877 (each
    commit's own year-20 save) on both commits; HEAD's slowest batch years (8167 years 11–23, 6151 years 21–22) and
    `0c80db1`'s (9437 years 21–27), profiled. In the page, same session, one build at a time: 4877's years 21–23 at Max
    and 10 years of 3301 at Max on both builds; 8167's year 19 at Max on HEAD.
  - In the page: five late worlds watched 60 days (4877/6421/7019/5147 y20, 1129 y10); three AI strikes with the new
    pause (7019 y21); God tools; the editor, its North Sea standoff and its armed Poland; phone; the carrier strike row;
    sea battles; a wheel zoom 6,000 → 3 m/px; tank fights at 25 m/px in year 1 and year 11; **new:** the Large map
    (size=L), the random world with 200 nations, autosave and Continue, playing Poland (Take control, Actions), the
    History panel at year 20.
- **Reference:** `reference/screens/`, `reference/text/AOC_TEXT_NOTES.md`. AoC's nukes, God tools, save/load and
  performance are known from text only; my confidence there is lower.
- **Prefix:** every path below was made in this run (`c14`, and `c14o` = `0c80db1`). Scripts in `critic/scripts/c14_*`.

## Verdict

**The land war after year 1 is denser on the same seeds but still about a ninth of year 1's; the nuclear alert is
fixed; and the user's new 5.0 ms tick budget does not hold in the late game on either commit.**

- **Land war after year 1 (R13-B1):** same 40 seeds, both commits: engaged per war a day after year 1 **0.564 →
  0.722** (year 1 5.06 → 6.11); all engaged after year 1 4.11 → 5.04 a day against 39.8 → 44.3 in year 1, i.e.
  **10.3 % → 11.4 %** of year 1. Checkpoints (y10/y20) 4.36 → 5.34 engaged, checkpoints with nobody in contact
  **12 → 4** of 80. New seeds, both commits: 0.558 → 0.780 a war. HEAD has a late front worth watching (5147 year 20:
  44, 32, 50, 21, 44, 27, 25 engaged at 10-day marks, Germany against the US across eastern France), but 1129's year-10
  front, run 13's showcase, is now 2–8 engaged a sample. Still blocking (R14-B1).
- **The 5.0 ms budget (ADR-698), new blocker R14-B2:** pinned and alone, **8167's year 19 ticks 13.3 ms** (operational
  AI 11.5 ms, 86 %), year 23 11.2 ms, 6151's year 22 7.9 ms, 4877's year 21 **5.26 ms** (0c80db1 on its own save: 4.50).
  In the page 8167's year 19 at Max takes **142 s**, with **40 stalls over 500 ms**. ADR-698 sets 5.0 ms for *any*
  year and calls going over it a defect. Its named case still roughly holds (4877 y21 on `0c80db1` 4.50 ms), but the
  any-year bound does not. `0c80db1` breaks it too (9437 years 24–27 at 6.1–8.6 ms pinned), so this is not a
  regression; it is the budget the user just set failing in its first test. Average speed is unchanged or better
  (seed 99 2.28 against 2.62 ms; 4877's three late years at Max 144 s against 171 s; 3301's decade 279 s against 277 s).
- **Fixed and verified:** the nuclear alert and pause (7019, year 21: each of three AI strikes pauses the game on its
  own hour, 182186, 182599, 182618, with its own banner, oldest on top); aircraft at 3 m/px no longer fill the screen;
  sea battles that sink nothing 7.1 % → 3.4 % (new seeds 8.1 → 3.6 %). Better on the same seeds only: founded statelets
  alive at year 30 36.8 → 28.1 a world (new seeds 31.4 → 30.4).
- **Unchanged after many runs:** Breakthrough at peace silently does nothing; the God revolt is told as a declared war;
  God tools clipped on a phone; the title's Cancel and file input are browser defaults.

## Scores

| Dimension | Run 13 | Run 14 |
|---|---|---|
| Map visuals and readability | 7 | 7 |
| Diplomacy, war, alliance, puppet, revolt depth | 7 | 7 |
| Emergent world dynamics over long runs | 6 | 6 |
| God Mode | 7 | 7 |
| Editor and scenarios | 7 | 7 |
| Stats and history | 7 | 7 |
| UI/UX and polish | 7 | 7 |
| Performance | 5 | 5 |
| Stability | 7 | 7 |
| Semantic zoom to unit level (needs 8) | 8 | 8 |
| Naval warfare (needs 8) | 7 | 7 |
| Tanks (needs 8) | 8 | 8 |
| Aircraft (needs 8) | 7 | 7 |
| AI nuclear use (needs 8) | 7 | **8** |

## Run 13's cases re-run

| Run 13 case | On HEAD | Evidence |
|---|---|---|
| R13-B1: 0.57 engaged a war a day after year 1 (5.16 in year 1); checkpoints 4.09, 10 of 64 with nobody in contact | Same script, run 13's 40 seeds, both commits: **0.564 → 0.722** a war (year 1 5.06 → 6.11); after year 1 10.3 % → 11.4 % of year 1's engaged. Checkpoints 4.36 → **5.34** (46 of 80 higher, 32 lower), nobody in contact **12 → 4**. New seeds both commits: 0.558 → 0.780; checkpoints 4.41 → 7.16. | `critic/c14_cmp_checkpoints.json` (`perWar`, `engaged`), `critic/c14_cmp_all.txt` |
| In the page: 4877 y20 0–4 engaged over 60 days; 7019 y20 0 in 5 of 7 samples | HEAD's own year-20 saves (other worlds than run 13's): 4877 **8, 2, 8, 4, 6, 9, 8**; 7019 7, 5, 11, 8, 0, 6, 5; 6421 8, 0, 5, 1, 2, 5, 0. | `critic/c14_y2_4877_y20.json`, `critic/c14_y2_7019_y20.json`, `critic/c14_y2_6421_y20.json`, `critic/shots/c14y2_4877_y20_d50_3000m.png` |
| The good case: 1129 y10, up to 51 engaged in Italy | 1129's year 10 on HEAD is another world: 2, 2, 0, 0, 2, 0, 0. HEAD's best checkpoint, 5147 y20: 44, 32, **50**, 21, 44, 27, 25 (Germany against the US in eastern France). | `critic/c14_y2_1129_y10.json`, `critic/c14_y2_5147_y20.json`, `critic/shots/c14y2_5147_y20_d20_3000m.png`, `critic/shots/c14y2_5147_y20_d30_250m.png` |
| Hollow divisions: under 500 men at year 20 36 → 64 a world | Same 40 seeds, each save by its own code: **63.5 → 76.3** (more on 25 of 40); at war 57.8 → 67.0. New seeds both commits: 54.2 → 52.9. Late armour: 11 of 25 tracked divisions under 500 men in 4877 y20. | `critic/c14_cmp_checkpoints.json` (`hollow`), `critic/c14_latetanks_w1.json` |
| Late pieces: 1,035 small pieces at year 20; 1,051 against `dd3b730`'s 837 | Same 40 seeds: 1,024 → 1,046 (higher on 21 of 40); enclaves at peace 206 → 222. New seeds both commits: 1,042 → 1,028. Against `dd3b730` (24 seeds): 837 → 1,041. No change. | `critic/c14_cmp_checkpoints.json` (`frag2`, `frag_vs_dd3b730`) |
| Nuclear pause and alert a week late; only the second of two strikes gets a banner | **Fixed.** 7019 from year 20 at Max, pause setting on: pauses at ticks **182186, 182599, 182618**, the headless strike ticks; after the third, three banners (Japan near Madaoua, Soviet Union near Kirkwall, Germany near Boyarka), oldest on top. | `critic/c14_np2_7019.json`, `critic/shots/c14np_7019_paused_3.png`, `critic/c14_headless_7019.json` (`nukeLog`) |
| Seed 99 2.54 ms (budget then 1.5) | Pinned, same session: HEAD **2.28 ms** (hash 2ead5b7e, the pin), `0c80db1` 2.62 ms (run 13's dc2d6d0a reproduced). | `critic/c14_perf_seed99_5y_head.log`, `critic/c14_perf_seed99_5y_0c80db1.log` |
| Year 21 of 4877 at 4.42 ms | Pinned, each commit's own year-20 save: HEAD **5.26 ms** (operational AI 2.90), `0c80db1` 4.50 ms (run 13's hash 6d6103a7 reproduced). | `critic/c14_perf_4877_y21_head.log`, `critic/c14_perf_4877_y21_0c80db1.log` |
| Late page at Max, 4877 years 21–23: 46–59 s a year | Same session: HEAD **58.4, 47.3, 38.3 s**; `0c80db1` 49.3, 61.4, 60.3 s. 59.6–60 fps both. | `critic/c14_l_4877.json`, `critic/c14o_l_4877.json` |
| 10 years of 3301 at Max: 276 s | Same session: HEAD 279 s, `0c80db1` 277 s. | `critic/c14_w_3301.json`, `critic/c14o_w_3301.json` |
| Late air war down 22 % | Same 40 seeds: air battles after year 1 **123 → 183** a world-year, sorties aloft 10.9 → 15.8. New seeds both commits: 154 → 161 only. | `critic/c14_cmp_all.txt` |
| Sea battles that sink nothing 3.6 → 7.2 % | **Fixed:** same seeds 7.1 % → **3.4 %**; new seeds 8.1 → 3.6 %. | `critic/c14_cmp_all.txt` |
| Moving capital: 1.33 moves a capture, bar 1.25 | Same seeds 1.34 → 1.30; new seeds 1.30 → 1.31. Not met. | `critic/c14_cmp_all.txt` (`eventsPerWorld`) |
| Breakthrough at peace does nothing (2203) | Unchanged: no ticker row, no refusal, Germany "At peace", the border unmoved on day 7. | `critic/c14_k_2203.json`, `critic/shots/c14k_2203_01_day7_1500m.png` |
| God revolt told as a declared war | Unchanged: "1 January 1938 Germany declared war on Free Saxony". | `critic/c14_q_6421.json` |
| Phone: God tools clipped | Unchanged: "Revo", "Spawn n", "Breakthr", "Territo", "Found c", "Raze c". | `critic/shots/c14p_phone_02_GodMode.png`, `critic/shots/c14p_phone_03_played.png` |
| Title's Cancel / file input unstyled | Unchanged (eighth run): white "Cancel", "Choose File / No file chosen". | `critic/shots/c14g_4877_10_title_pending.png` |
| Editor North Sea standoff (4877) | Holds: "Germany and United Kingdom fought at sea: Germany lost 25 ships, United Kingdom 17" on day 2. | `critic/c14_g4_standoff.json`, `critic/c14_g4.log` |
| Editor-armed Poland (9437) | Berlin 2 February (334,000 civilians, 410 men), Prague 28 February (134,000), Moscow 5 March (52,000); then "Poland lost its last means to deliver its warheads". | `critic/c14_g2_9437_POL.json` |
| Carrier strike row (8693) | Holds: the row frames the carrier group and the US ships, 2 sorties drawn. Every sea battle has a DOM row (80 samples). | `critic/c14_n4_8693.json`, `critic/shots/c14n4_8693_rowless_clicked.png`, `critic/c14_n_8693_JAP_USA.json` |
| Restraint lines (1129 y20) | Consistent over 60 days: "noThreat", "taboo", "deterred". | `critic/c14_t_1129.json` |
| Stasis (longest 25 years) | Same seeds: longest 25 → 21, worlds over 20 years 1 → 1. New seeds: 23 → 18. | `critic/c14_cmp_all.txt` |
| Browser = headless | 3 of 3 year hashes equal on 1307; save/load twin equal (4.10 MB). | `critic/c14_h_1307.json` |
| History noise: 5,282 rows by year 23 (4877) | Same session, year 23: HEAD 4,816, `0c80db1` 5,282; "Land handed over" 1,031 against 1,075. | `critic/c14_l_4877.json`, `critic/c14o_l_4877.json` (`historyTypes`) |
| Aircraft at 3 m/px larger than a company | **Fixed:** the wheel zoom's last step (3 m/px) shows infantry figures; planes at 25 m/px are about 40 px. | `critic/shots/c14z_5861_17.png`, `critic/shots/c14v2_M_3001_25m.png` |

## Dimensions

### Map visuals and readability: 7 (unchanged)

- **Tested:** small pieces at year 20 on 48 seeds, both commits; the year-20 world and Eurasia (7019); late fronts at
  3,000 and 250 m/px (5147, 4877, 7019); the Large map at 3,000 and 25 m/px.
- **Evidence:** `critic/c14_cmp_checkpoints.json`, `critic/shots/c14x_7019_7019y20_world.png`,
  `critic/shots/c14x_7019_7019y20_eurasia.png`, `critic/shots/c14y2_7019_y20_d20_3000m.png`,
  `critic/shots/c14y2_5147_y20_d30_250m.png`, `critic/shots/c14v_A_large_eng_3000m.png`.
- **No change:** pieces 1,024 → 1,046 on the same seeds, 1,042 → 1,028 on new ones.
- **Weak:** 7019's Africa at year 20 is a quilt of interlocked French, German, Italian and British pieces, and four
  near-identical blues (US, France, two founded states) sit side by side across Russia and Scandinavia. The best late
  front (5147, 250 m/px) is about 70 counter labels overlapping each other and their leader lines. Many read 19, 30,
  49 or 64 men.
- **AoC does better:** late worlds as contiguous blobs with readable names (`reference/screens/steam-screenshot-03.jpg`).

### Diplomacy, war, alliance, puppet, revolt depth: 7 (unchanged)

- **Tested:** event counts on 48 worlds × 30 years, both commits; the History panel's 26 kinds at year 20 (4877);
  playing Poland.
- **Evidence:** `critic/c14_cmp_all.txt`, `critic/c14_hi_4877.json`, `critic/c14_pl_6011.json`.
- **Same seeds:** wars declared 516 → 456 a world, revolts 193 → 176, annexations 59 → 67 (the kin unions of ADR-681),
  puppets 73 → 78. Taking control of Poland works: Declare war, Propose alliance, Offer peace, wing orders and a build
  list in the Actions tab.
- **Weak:** "Offer peace" to Lithuania at −4 gets no answer in the ticker or the panel 48 hours later
  (`c14_pl_6011.json`).

### Emergent world dynamics over long runs: 6 (unchanged)

- **Tested:** 48 worlds × 30 years, both commits; five late worlds watched in the page.
- **Better (same seeds):** contact per war after year 1 +28 %; checkpoints with nobody in contact 12 → 4 of 80; founded
  statelets alive at year 30 36.8 → 28.1; the longest stasis 25 → 21 years.
- **Not higher, because:** after year 1 the land war is still **11.4 %** of year 1's (R14-B1), and hollow divisions
  grew 63.5 → 76.3 a world. One world moved only 13 % of its land in its last five years (24 % at least on
  `0c80db1`). New seeds confirm the contact gain (0.558 → 0.780) but not the statelets (31.4 → 30.4).

### God Mode: 7 (unchanged)

- **Tested by clicks:** Revolt, Spawn nation, Found city, Raze city (6421); H-bomb on Paris, A-bomb on London (4219);
  Breakthrough at peace (2203).
- **Evidence:** `critic/c14_q_6421.json`, `critic/c14_a_4219.json`, `critic/shots/c14a_4219_13_paris_h_strike.png`,
  `critic/c14_k_2203.json`.
- **Works:** each act told; the H-bomb on Paris (3,329,000 civilians) with its ruin at 600 m/px ten days on.
- **Weak (unchanged):** Breakthrough at peace silently does nothing; the revolt is told as "Germany declared war on
  Free Saxony". **AoC does better:** its Spawn Major Battle needs no running war.

### Editor and scenarios: 7 (unchanged)

- **Tested:** fleets and a bomber group placed, warheads granted, the refusal on land, export, the title's file card,
  play; the random world (60 and 200 nations); the Large map.
- **Evidence:** `critic/c14_g_4877.json`, `critic/c14_g4_standoff.json`, `critic/c14_g2_9437_POL.json`,
  `critic/c14_v_B.json`, `critic/shots/c14v_B_random200_after60s.png`, `critic/c14_v_A.json`.
- **Works:** placed navies fight on day 2; the refusal "Not done: no water of a sea is near the place."; 200 random
  nations boot in 3.5 s and run 557 game days in 60 s at Max; the Large map boots in 10.3 s (both measured beside
  the 8-world batch, so slower than on a quiet machine).
- **Weak:** the title's Cancel button and file input are browser defaults (eighth run).

### Stats and history: 7 (unchanged)

- **Tested:** the History panel at year 20 (open time, each of 26 filters), charts, the nuclear charts.
- **Evidence:** `critic/c14_hi_4877.json`, `critic/shots/c14hi_4877_history.png`, `critic/shots/c14hi_4877_charts.png`,
  `critic/shots/c14f_7019_82_chart_nukedead.png`.
- **Works:** the panel opens in 154 ms over 4,128 rows; each filter answers in under 200 ms; CSV and JSON export
  buttons are there (I did not test the downloads).
- **Quieter:** 4,816 rows by year 23 against 5,282, same session. Still a fifth "Land handed over" and a sixth
  "Air raids".

### UI/UX and polish: 7 (unchanged)

- **Tested:** the nuclear pause at Max, keys and settings, a phone width, playing a nation, autosave and Continue.
- **Evidence:** `critic/c14_np2_7019.json`, `critic/shots/c14np_7019_paused_3.png`, `critic/c14_m.json`,
  `critic/shots/c14p_phone_02_GodMode.png`, `critic/c14_v_C.json`, `critic/shots/c14v_C_title.png`,
  `critic/shots/c14pl_6011_02_after_peace.png`.
- **Better:** run 13's alert defect is fixed. Continue from the title restores the game to the same tick and hash
  (10195, a7128002) in 4.5 s.
- **Why not 8:** phone God tools still clipped; the title's file card unstyled; Offer peace and Breakthrough at peace
  give no feedback.

### Performance: 5 (unchanged)

- **Tested:** see Runs. Every pinned figure and every page timing compared across builds was taken alone on a quiet
  machine (the Large-map figure was not). The batch's own tick figures ran 8 at a time
  beside browsers and are used only to find the slow years.
- **Evidence:** `critic/c14_perf_seed99_5y_head.log`, `critic/c14_perf_seed99_5y_0c80db1.log`,
  `critic/c14_perf_4877_y21_head.log`, `critic/c14_perf_4877_y21_0c80db1.log`, `critic/c14_perf_8167_y11_20_head.log`,
  `critic/c14_perf_8167_y19_head.log`, `critic/c14_perf_8167_y21_23_head.log`, `critic/c14_perf_6151_y21_22_head.log`,
  `critic/c14_perf_9437_y21_27_0c80db1.log`, `critic/c14_l_8167.json`, `critic/c14_l_4877.json`,
  `critic/c14o_l_4877.json`, `critic/c14_w_3301.json`, `critic/c14o_w_3301.json`, `critic/c14_v_A.json`.
- **Judged against ADR-698** (at most 5.0 ms a tick in any year; a late game year at Max of 45–60 s is the design):
  - **Over budget on HEAD:** 8167 year 19 **13.3 ms** (p95 49.9, longest 611 ms; operational AI 11.5 ms), year 23
    11.2 ms; 6151 year 22 7.9 ms; 4877 year 21 5.26 ms. In the page 8167's year 19 at Max is **142 s with 40 stalls
    over 500 ms** (frame rate 58 fps), during a year of 5 wars and 2.7 engaged formations a day.
  - **Over budget on `0c80db1` too:** 9437 years 24–27 at 7.5, 8.1, 6.1, 8.6 ms. The batch shows a similar spread on
    both commits (world-years over 6 ms on the batch's figures: 91 against 94 of 1,200), so I do not call it a
    regression; HEAD's worst year is the worst seen.
  - **Average flat or better:** seed 99 2.62 → 2.28 ms; 4877's three late years at Max 171 → 144 s; 3301's decade
    277 → 279 s.
  - **The Large map** ran 142 game days in 60 s at Max early in 1938 (about 2.5 min a game year), measured beside
    the 8-world batch: an upper bound, not a quiet figure.
- **Why still 5:** what the player waits for at Max is unchanged on the same cases, and the new budget is broken by
  more than double in the worst year (R14-B2).
- **AoC:** known from text only.

### Stability: 7 (unchanged)

- **Evidence:** `critic/c14_h_1307.json` (3/3 hashes, twin equal), `critic/c14_v_C.json` (Continue: same hash);
  `errors` empty in all 38 page JSONs this run, both builds (the one `fatal`, `c14_g_4877.json`, is my script waiting at Max while
  Poland's strike paused the game). 56 headless worlds ran 30 years without a throw. Seed 99 hits the pinned hash
  2ead5b7e.

### Semantic zoom to unit level: 8 (unchanged)

- **Tested:** Germany–Poland at 3,000 to 10 m/px (7019); a wheel zoom 6,000 → 3 m/px (5861); the Large map against
  the Medium at 3,000–25 m/px (3001); late fronts at 250 and 25 m/px (5147 y20, 1129 y11).
- **Evidence:** `critic/shots/c14c_7019_arm_0025m.png`, `critic/shots/c14c_7019_arm_0250m.png`,
  `critic/shots/c14z_5861_17.png`, `critic/c14_v2_L_3001.json`, `critic/shots/c14v2_L_3001_25m.png`,
  `critic/shots/c14y2_5147_y20_d30_250m.png`, `critic/shots/c14lt_1129_14_25m_live.png`.
- **Why 8:** tank ranks, tracers and a contact line at 25 m/px; the Large map draws the same (742 elements at 250
  m/px against 697 on Medium). The wheel zoom's plane silhouettes no longer swamp the last steps.
- **Not more:** the best late front at 250 m/px is a wall of overlapping labels; hollow divisions (19–64 men) crowd it.

### Naval warfare: 7 (unchanged)

- **Evidence:** `critic/c14_cmp_all.txt`, `critic/c14_g4_standoff.json`, `critic/shots/c14n4_8693_rowless_clicked.png`.
- **Better:** battles sinking nothing 7.1 → 3.4 % (new seeds 8.1 → 3.6 %).
- **Mixed:** same seeds, year-1 battles 56.7 → 42.0 a world (ships sunk 16,378 → 14,210 over 24 seeds) and late
  battles 9.32 → 8.58; new seeds show year 1 up (41 → 48), so I do not score it.
- **Why not 8:** the late sea war is about a fifth of year 1's battles. **AoC has no navy.**

### Tanks: 8 (unchanged)

- **Evidence:** `critic/shots/c14c_7019_arm_0025m.png`, `critic/shots/c14c_7019_arm_15m_live_1.png`,
  `critic/c14_latetanks_w1.json`, `critic/shots/c14lt_1129_14_25m_live.png`, `critic/shots/c14lt_1129_14_250m.png`.
- **Why 8:** year-1 armour against Polish blocks is still the best thing in the game.
- **Remaining:** late armour rarely fights. Over 30 days on five HEAD saves, 29 tracked-division days in contact; the
  one I watched (1129, year 11) is a US heavy armoured division of 5,500 against a British cadre of 200 men.

### Aircraft: 7 (unchanged)

- **Evidence:** `critic/c14_cmp_all.txt`, `critic/shots/c14y2_5147_y20_d20_3000m.png`, `critic/c14_u_6421.json`.
- **Better on the same seeds:** air battles after year 1 123 → 183 a world-year, sorties aloft 10.9 → 15.8 (ADR-689).
- **Not 8:** new seeds on both commits move only 154 → 161, and the late air war is still 7 % of year 1's (2,415).
  **AoC has no air war.**

### AI nuclear use: 8 (up from 7)

- **Tested:** 987 bursts over 48 worlds on HEAD, against `0c80db1`; three AI strikes from the player's seat with the
  new pause (7019 year 21); restraint lines; Poland armed in the editor.
- **Evidence:** `critic/c14_cmp_all.txt`, `critic/c14_cmp.json`, `critic/c14_np2_7019.json`,
  `critic/c14_f_7019.json`, `critic/shots/c14f_7019_12_goto.png`, `critic/shots/c14f_7019_12_ruin_200m.png`,
  `critic/c14_t_1129.json`.
- **Why up (same seeds, both commits):** bursts killing over ten times more civilians than men **162 → 73** (new seeds
  52 → 22); bursts 962 → 777; one spot struck twice in a year 2 → 0. In the page each strike now stops the game on its
  hour with its own banner and Go to. The three I watched hit armies (15,572, 31,971 and 3,596 men, 0 civilians), and
  Go to frames the Orkney strike with the remnant divisions labelled. Run 13's two reasons for not 8, the late alert and
  London answered in kind, are gone from what I re-ran. **AoC's nukes are God-only.**
- **Still seen:** 6737 year 30, a Soviet H-bomb on Paris at utility 0.876 with no strike in the 120 days before:
  **3,052,000 civilians, 0 men**, against a France holding 4–7 warheads. Within SPEC as an industry strike (see Design
  objections), so it lowers no score, but it is the worst burst of the run.

## Blocking issues, in priority order

1. **R14-B1. The land war after year 1 is still about a ninth of year 1's (R13-B1 improved, not fixed).**
   - Same 40 seeds, both commits: engaged per war a day after year 1 0.564 → 0.722 (year 1 5.06 → 6.11); all engaged
     after year 1 10.3 % → 11.4 % of year 1's. Checkpoints 4.36 → 5.34, nobody in contact at 4 of 80 (12). New seeds:
     0.558 → 0.780.
   - In the page: HEAD's best late front (5147 y20) holds 21–50 engaged; 6421 y20 0–8, 1129 y10 0–2.
   - Hollow divisions grew: under 500 men at year 20 63.5 → 76.3 a world.
   - **Evidence:** `critic/c14_cmp_checkpoints.json`, `critic/c14_cmp_all.txt`, `critic/c14_y2_5147_y20.json`,
     `critic/c14_y2_6421_y20.json`, `critic/c14_y2_1129_y10.json`, `critic/shots/c14y2_5147_y20_d30_250m.png`.
   - **Fix:** keep raising late contact per war toward a real fraction of year 1's, on unseen seeds with a bar, and
     merge or disband sub-500-man divisions instead of fielding them.
2. **R14-B2. The 5.0 ms tick budget (ADR-698) fails in the late game: up to 13.3 ms pinned.**
   - Pinned, alone: 8167 year 19 13.3 ms (operational AI 11.5 ms, longest tick 611 ms), year 23 11.2 ms; 6151 year 22
     7.9 ms; 4877 year 21 5.26 ms. In the page 8167's year 19 at Max takes 142 s with 40 stalls over 500 ms.
   - `0c80db1` also exceeds it (9437 years 24–27, 6.1–8.6 ms), so this is the budget's first test, not a regression.
     ADR-698's named case is near the line (4877 y21: 5.26 ms on HEAD's own save, 4.50 on `0c80db1`'s); its
     any-year bound fails by more than double.
   - **Evidence:** `critic/c14_perf_8167_y19_head.log`, `critic/c14_perf_8167_y21_23_head.log`,
     `critic/c14_perf_6151_y21_22_head.log`, `critic/c14_perf_4877_y21_head.log`,
     `critic/c14_perf_9437_y21_27_0c80db1.log`, `critic/c14_l_8167.json`; saves `critic/c14_seed8167_y18.bin`,
     `critic/c14_seed8167_y20.bin`.
   - **Fix:** profile the operational AI on 8167's year 19 (from `c14_seed8167_y18.bin`) and cap its work per tick
     (time-slice or amortise across hours) so that no year goes over 5.0 ms. Measure the worst year over unseen seeds,
     not seed 99 or 4877 alone.

## Non-blocking issues

- **Hollow divisions** (see R14-B1): 76 a world under 500 men at year 20; late armour of 19–367 men on the 5147 front.
- **Late fronts at 250 m/px are a wall of labels** (`c14y2_5147_y20_d30_250m.png`).
- **Offer peace gives no answer** (`c14_pl_6011.json`).
- **Breakthrough at peace silently does nothing** (`c14_k_2203.json`).
- **God revolt told as a declared war** (`c14_q_6421.json`).
- **Phone: God tools clipped** (`c14p_phone_02_GodMode.png`).
- **A moving capital:** 1.30 moves a capture against the user's 1.25.
- **Late map colours:** four near-identical blues side by side across Russia and Scandinavia (7019 y20).
- **Title's Cancel and file input unstyled** (`c14g_4877_10_title_pending.png`).

## Design objections (none blocking, no score lowered)

- **A first strike on a city full of civilians:** 6737 year 30, the Soviet Union's H-bomb on Paris, 3,052,000
  civilians and 0 men, utility 0.876, no nuclear strike in the 120 days before (`critic/c14_headless_6737.json`,
  `nukeLog`). France held 4–7 warheads in years 29–30, so the resolve rule ("places anywhere", only against enemies
  that cannot strike back) does not apply. SPEC §6.4 bars an empty *capital* as a first-strike target but lists
  *industry* as a target with no such bar, so as an industry strike it is within the design. I could not tell from the
  log which value the AI weighed (low confidence). A player will read it as a massacre either way.
- **The budget's level** (ADR-698): 5.0 ms means about 45–60 s per late game year at Max. I still think that is more
  than a player watching 30 years will sit through. Scored only where it is broken.
- **Save games:** only one autosave slot and Continue (SPEC §2.5); AoC's full version has save/load (known from text,
  `AOC_TEXT_NOTES.md` line 569). A player cannot keep two games or go back to an earlier year.
- **The late map's count** (ADR-639 b): 1,041 small pieces against `dd3b730`'s 837 on the same 24 seeds.

## Notes

- Run 13's figures reproduce on `0c80db1` in this session: seed 99 hash dc2d6d0a at 2.62 ms (2.54), 4877 year 21
  hash 6d6103a7 at 4.50 ms (4.42), 4877's late years at Max 49–61 s (46–59), 3301's decade 277 s (276).
- The batch's tick figures ran 8 at a time beside browsers; contended years read about 1.25 × their pinned figure
  (8167 y19 16.5 against 13.3).
- Ports 5314 (HEAD) and 5315 (`0c80db1`) stopped at the end; the worktree's `node_modules` junction was unlinked
  before `git worktree remove`.

## Strengths, verified

- **The nuclear alert now works as a player needs it:** three AI strikes, three pauses on the strike's own hour,
  three banners, each with Go to (`c14_np2_7019.json`, `c14np_7019_paused_3.png`).
- **A real late front exists:** 5147 year 20, Germany against the US across eastern France, 21–50 engaged over 60 days
  (`c14y2_5147_y20_d20_3000m.png`).
- **Determinism and resume:** browser equals headless year by year on 1307; Continue restores the same tick and hash.

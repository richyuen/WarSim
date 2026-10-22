# Critic report, run 12

- **Commit:** `896ff7799d1cefa7f891091bc249423fa0c2998a`. Run 11 was on `dd3b730`; 94 commits since (the ferry and
  landing AI, PLAN 7.49d–7.73; supply over the beach, 7.70a/7.75; capitals that move, 7.68; the nuclear floor and
  restrike rules, 7.50; puppets' warheads, 7.52a; sea-battle rows, 7.41a; editor fleets, 7.58/7.59; planes in tint,
  7.51a; 7.51b, 7.62, 7.74 closed by the user's decisions).
- **Date:** 2026-10-22.
- **Build:** `vite build --outDir critic/c12_dist`, exit 0 (`critic/c12_build.log`). Served with `vite preview` on
  port **5312**. Port 5311 was held by a stale dev server (PID 82544, `vite --port 5311`, started 2026-10-21), not
  mine; left alone. Chromium through Playwright, headless, 1600 × 900 (also 390 × 844 and 1280 × 720).
- **Runs:**
  - 32 unaided headless worlds × 30 years (`critic/scripts/c12_batch.sh`, `c12_headless.ts`, now also sampling the
    engaged land formations every day): **run 11's 24 seeds for a same-seed comparison** (`c11_*` files are
    `dd3b730`, `c12_*` are HEAD) and 8 new seeds (1523, 2671, 3847, 4391, 5147, 6737, 7901, 9203).
    Comparison: `critic/c12_cmp_all.txt` / `critic/c12_cmp.json` (`c12_cmp.py`); checkpoint counts (engaged,
    fragmentation) `critic/c12_cmp_checkpoints.json` (`c12_cmp2.py`). Bursts: `critic/c12_summary_all.txt`.
  - Performance: seed 99 × 5 years pinned, alone, twice on HEAD, and once on `dd3b730` in a worktree (`critic/wt`,
    node_modules junction unlinked first, removed after) in the same session.
  - In the page: a fresh world watched 10 years at Max (seed 3301), a year-21 war watched 60 days (6421), the AI's
    H-bomb on Rome's coast (2081), God tools, the editor's fleets, phone and laptop widths, sea battles on three seeds.
- **Reference:** `reference/text/AOC_TEXT_NOTES.md`, `reference/screens/`. AoC's nukes, God tools and performance are
  known from text only; my confidence is lower there.
- **Prefix:** every path below was made in this run (prefix `c12`). Scripts are in `critic/scripts/c12_*`.

## Verdict

**Run 11's nuclear blocker is answered on its own terms; its land-war blocker is not.** On the same 24 seeds no
burst under utility 0.1 kills a million (was 1: Greenock), and one spot is struck twice within a year (was 3). The
land war after year 1 still has almost nobody in contact: 1.52 engaged formations a checkpoint (was 0.50) while 7.3
wars run (was 4.6), against 34 a day in year 1.

**Three things got measurably worse on the same seeds:**

- **The late map shreds more.** Pieces of 2–400 cells of one holder at year 20: 1,174 on HEAD against 837 on
  `dd3b730`, **worse on 24 of 24 seeds** (469 at the 1938 start). Founded statelets at year 20: 20.7 a world (was 6.6).
- **The tick is 29 % slower.** Seed 99, pinned, same session: 1.785 / 1.790 ms on HEAD, 1.388 ms on `dd3b730`
  (budget 1.5); p95 6.8–8.5 ms against 3.3–5.9.
- **The AI fires 2.6 times as many nuclear weapons** (188 → 497 bursts on the same 24 worlds; 23 of 24 worlds see
  one, was 14), and the bursts that kill a million civilians double (4 → 8), among them an H-bomb on the Low
  Countries for 3,090,000 civilians and 337 soldiers. The rules that allow it are the user's (SPEC §6.4, ADR-632 b),
  so this is a design objection, not a blocker; but it is why AI nuclear use does not rise.

**Fixed and verified:** every sea battle now has a ticker row (counted in the DOM, two seeds); the editor's North Sea
standoff fights on day 2; the restraint line no longer names a puppet as the deterrent.

## Scores

| Dimension | Run 11 | Run 12 |
|---|---|---|
| Map visuals and readability | 7 | **6** |
| Diplomacy, war, alliance, puppet, revolt depth | 7 | 7 |
| Emergent world dynamics over long runs | 6 | 6 |
| God Mode | 7 | 7 |
| Editor and scenarios | 7 | 7 |
| Stats and history | 7 | 7 |
| UI/UX and polish | 7 | 7 |
| Performance | 7 | **6** |
| Stability | 7 | 7 |
| Semantic zoom to unit level (needs 8) | 8 | 8 |
| Naval warfare (needs 8) | 7 | 7 |
| Tanks (needs 8) | 8 | 8 |
| Aircraft (needs 8) | 7 | 7 |
| AI nuclear use (needs 8) | 7 | 7 |

## Run 11's cases re-run

| Run 11 case | On HEAD | Evidence |
|---|---|---|
| R11-B1: engaged land formations 0.3–0.7 at years 10/20 on 24 worlds; 6421 year 21 none in 25 samples | Same 48 checkpoints, same script: **1.52** engaged (was 0.50), with 7.3 wars (was 4.6) and 358 land formations of nations at war (was 295); 18 of 48 checkpoints with none (was 28). Per day over 30 years on 32 HEAD worlds: 33.7 in year 1, **2.11** after (0.34 a war, against 5.1 a war in year 1). 6421's year-21 Germany–Soviet war in the page: 0, 0, 0, 2, 2, 2, 0 engaged at 10-day marks over 60 days. Piles at year 10: United States 60 idle divisions (714,480 men) in one place **at war** (1129); about half of all land formations idle on both commits. | `critic/c12_cmp_checkpoints.json`, `critic/c12_engaged_w1.json`…`w3.json`, `critic/c12_cmp_all.txt`, `critic/c12_y_6421_gersov.json`, `critic/shots/c12y_6421_gersov_d30.png`, `critic/c12_stacks_y10_w1.json` |
| R11-B2: Greenock, H-bomb, 1,105,514 dead at utility 0.026 (1129); 2081 one spot struck 3 times in 184 days | Same 24 seeds: **no burst under 0.1 kills a million** (was 1); under 0.1 and half a million: 1 (3613, 777,000 at 0.085, inside ADR-599's floor). One spot struck twice within a year (was 3). 1129's world no longer reaches Greenock. | `critic/c12_cmp_all.txt` (`lowUtilMillionCiv`, `sameSpotWithinYear`) |
| R10-B2 / naval volume: 13.17 sea battles a world-year after year 1 | **9.30** on the same 24 seeds (13.29 on `dd3b730` by the same script), 8.28 on the new 8; battles sinking nothing 3.7 % (was 1.0 %). Armed fleets at year 20, 14 seeds: 60 (was 82); navies 14.3 (was 20.5); wars of two navies 0.29 (was 1.14). | `critic/c12_cmp_all.txt`, `critic/c12_fleets.json`, `critic/c11_fleets.json` |
| Sea battles with no ticker row: Japan–USA 9 of 9 (8693), Germany–UK 7 of 11 (2081) | **Fixed.** With the rows counted in the DOM, every battle the view knows has a row in every sample (8693: 13 samples; 7771: 13). The far ones are told for what they are: "⚓ Carrier strike: Japan on United States's ships". | `critic/c12_n_8693_JAP_USA.json` (`domRows`), `critic/c12_n_7771_ITA_ENG.json`, `critic/c12_n4_8693.json`, `critic/shots/c12n4_8693_rowless_clicked.png` |
| Stale map tooltip (fifth run) | **Sixth run.** "London · capital … Unrest 0" after a wheel-out to 24,738 m/px (1307); "London · capital, United Kingdom, Unrest 40" floating over **Paris** at 150 m/px (4219, after a Go to); "Prague · capital … Unrest 0" a day after Prague is razed (6421). | `critic/c12_h_1307.json` (`tip1`), `critic/shots/c12a_4219_20_paris_150m_day10.png`, `critic/c12_s_6421.json` |
| Editor fleets face to face fight nothing in 30 days (4877) | **Fixed.** Loaded from the title, Germany's two placed squadrons are engaged from hour 30 to 42; the history reads "Germany and United Kingdom fought at sea: Germany lost 20 ships, United Kingdom 16"; the survivors run east. (The two placed fleets 10 cells apart sit still for the first 24 hours of the war.) | `critic/c12_g4_standoff.json`, `critic/shots/c12g4_01_h48_1500m.png` |
| Restraint line names a puppet as the deterrent (1129) | **Fixed.** Year 20 of 1129: Germany, Romania, France, United Kingdom each read "is a puppet: its warheads stay in store and answer no strike while it has an overlord"; no line names a puppet. | `critic/c12_t_1129.json` |
| Editor-armed Czechoslovakia (5309) | Unchanged and correct: "lost its last means to deliver its warheads: Germany took its airbase near Prague". | `critic/c12_g2_5309_CZS.json` |
| Editor-armed Poland bombs Berlin, Rome, Prague (9437) | Berlin identical to the man (334,000 civilians, 379 men, day 34), Mannheim day 53, Prague day 61; ADR-632 b keeps it. Design objection. | `critic/c12_g2_9437_POL.json`, `critic/shots/c12g2_9437_POL_11_alert.png` |
| Stasis 22 years (3613) | Same 24 seeds: longest top-5 stasis 21 (was 22); two worlds over 20 (was one). New seeds: max 22. | `critic/c12_cmp_all.txt` |
| Seed 99 tick 1.388 / 1.409 ms | **1.785 / 1.790 ms** on HEAD; 1.388 ms on `dd3b730` in the same session (hash 3e4dfd1e, run 11's to the bit). | `critic/c12_perf_seed99_5y_solo.log`, `…_solo2.log`, `critic/c12_perf_seed99_5y_dd3b730.log` |
| Late page at Max, 4877 from year 20 | 23.2, 32.2, 27.1 s a year (run 11: 21.1–24.2 s), 59.6–60 fps, longest gap 226 ms. | `critic/c12_l_4877.json` |
| Title's Cancel / file input unstyled | Unchanged. | `critic/shots/c12g_4877_10_title_pending.png` |
| Browser = headless | 3 of 3 year hashes equal on 1307 (9e4ff54a, d46cedf3, 69ba492f); save/load twin equal (3.92 MB). | `critic/c12_h_1307.json` |
| Air-raid rows 23 % of the history (4877) | 794 of 4,317 rows in 3 late years (18 %); "Land handed over" is now 935 rows (22 %, was 180). | `critic/c12_l_4877.json` (`historyTypes`) |
| Aircraft at T3 white glyphs the size of a squad | Changed as ADR-609 says: drawn in the sprite tint (Germany's pale grey) and larger. At 3 m/px a continuous wheel zoom ends on three silhouettes 130 px wide in an empty field; the division it zoomed on has walked out of frame. | `critic/shots/c12c_7019_inf_0010m.png`, `critic/shots/c12z_5861_17.png`, `critic/c12_z_5861.json` |
| God revolt told as a war | Unchanged: "Germany declared war on Free Saxony". | `critic/c12_q_6421.json` |
| Glasgow's marker untouched beside the Greenock ruin | Same pattern: "Japan struck Netherlands with a hydrogen bomb near Civitavecchia: 1,122,000 civilians killed"; Rome, 60 km off, stands unruined, its city size unchanged (5), and no city near the ruin is big. | `critic/shots/c12f_2081_11_ruin_200m.png`, `critic/c12_f_2081.json`, `critic/scripts/c12_city2.ts` |

## Dimensions

### Map visuals and readability: 6 (down from 7)

- **Tested:** the year-20 political map of 24 seeds counted for pieces; 7247's year-20 world and Eurasia in the
  page; 6421's year-21 war over 60 days; a decade of 3301 at 3,000 and 12,000 m/px; a continuous wheel zoom (5861).
- **Evidence:** `critic/c12_cmp_checkpoints.json` (`frag`), `critic/c12_frag_head_w12.json`,
  `critic/c12_frag_head_w3.json`, `critic/c11_frag_head.json`, `critic/shots/c12x_7247_y20_eurasia.png`,
  `critic/shots/c12x_7247_y20_world.png`, `critic/shots/c12y_6421_gersov_d60.png`,
  `critic/shots/c12w_3301_y03_europe.png`, `critic/shots/c12w_3301_y09_europe.png`.
- **Why down (same seeds, both commits):** pieces of 2–400 cells of one holder at year 20 rose from 837 to 1,174 a
  world, on 24 of 24 seeds. In 7247's 1957 Russia, German grey and Soviet red are mottled together over thousands of
  kilometres with Czechoslovak blue pockets inside; Africa is grey, yellow and blue shards
  (`c12x_7247_y20_*.png`). In 6421 Hungary holds Soviet land as an orange sea full of red islands
  (`c12y_6421_gersov_d60.png`). AoC's late worlds are contiguous blobs
  (`reference/screens/community-dominated-world-a.png`, `steam-screenshot-02.jpg`).
- **Still good:** the early and middle years read like AoC at its best: names, flags, counters, cities
  (`c12w_3301_y03_europe.png`); the random world (`c12r_02_year1.png`).
- **Fix:** see R12-B2.

### Diplomacy, war, alliance, puppet, revolt depth: 7 (unchanged)

- **Tested:** event counts of 24 worlds × 30 years on both commits; the history's type filter over 3 late years.
- **Evidence:** `critic/c12_cmp_all.txt` (`eventsPerWorld`), `critic/c12_l_4877.json`.
- **More of everything, same seeds:** wars declared 280 → 434 a world; revolts 42 → 126; capitals captured
  222 → 435; revivals 19 → 37; unions 11 → 18; annexations 15 → 39. World-years with at most one war 46 → 18.
- **Not better to watch:** the volume is noise as much as depth. A capital that moves after its fall is taken again
  within days: "Australia captured Turkey's capital" on 2, 13 and 28 December 1947 (`c12w_3301_z_history.png`); in
  year 11 of 6421 the Netherlands' capital moves 26 times and the United States takes one statelet's capital three
  times in 9 days (`c12_caps.ts` output in this report's notes below). Capital moves are 919 a world (405).
- **AoC does better:** nothing measured (text only).

### Emergent world dynamics over long runs: 6 (unchanged)

- **Tested:** 32 worlds × 30 years; the same 24 seeds on both commits.
- **Evidence:** `critic/c12_cmp_all.txt`, `critic/c12_summary_all.txt`.
- **Livelier:** the last five years move 9.1–59.0 % of the land (was 3.3–33.9 %); nations living at year 30 77–112
  (68–84); founded 10–39 (1–15).
- **Not higher, because:** the churn is statelets and walk-ins, not fronts (R12-B1); the longest stasis is still 21
  years with two worlds over 20 (was one); and the map it leaves is confetti (R12-B2).

### God Mode: 7 (unchanged)

- **Tested by clicks:** Revolt, Spawn nation, Found city, Raze city (6421); H-bomb on Paris, A-bomb on London
  (4219); Breakthrough from Berlin to Warsaw with Germany at peace (2203).
- **Evidence:** `critic/c12_q_6421.json`, `critic/c12_a_4219.json`, `critic/c12_k_2203.json`,
  `critic/shots/c12k_2203_01_day7_1500m.png`, `critic/shots/c12a_4219_13_paris_h_strike.png`.
- **Works:** each act told in the ticker; the H-bomb on Paris, 3,329,000 civilians, with its ruin.
- **Weak:** Breakthrough at peace does nothing the player can see: no ticker row, no refusal, no corridor drawn,
  and 7 days later the border is where it was (the code logs a battle to the history, `tick.ts`
  `forceBreakthrough`; I did not open the History panel here). The God revolt is still told as a war declared.
- **AoC does better:** Edit Terrain (notes line 449); its Spawn Major Battle makes a battle where WarSim's
  Breakthrough needs a war already running.

### Editor and scenarios: 7 (unchanged)

- **Tested:** fleets for Germany and Britain in the North Sea, a bomber group and warheads for Poland, the refusal
  inland, export, title Cancel and Start, play.
- **Evidence:** `critic/c12_g_4877.json`, `critic/c12_g4_standoff.json`, `critic/shots/c12g_4877_03_refusal.png`,
  `critic/shots/c12g_4877_10_title_pending.png`.
- **Better:** the placed navies now fight (day 2, 20 and 16 ships lost).
- **Weak:** the title's Cancel button (white) and file input are browser defaults (sixth run).

### Stats and history: 7 (unchanged)

- **Tested:** the history's filter over 3 late years (4,317 rows), the charts after a decade, the restraint lines.
- **Evidence:** `critic/c12_l_4877.json`, `critic/shots/c12w_3301_z_charts.png`, `critic/shots/c12w_3301_z_history.png`,
  `critic/c12_t_1129.json`.
- **Better:** the restraint line is now consistent about puppets.
- **Weak:** the log is louder: 4,317 rows in 3 years (2,535), of which "Land handed over" 935 and "Air raids" 794;
  repeated captures of one moving capital.

### UI/UX and polish: 7 (unchanged)

- **Tested:** keys (Space, 1–0 for the ten map modes, Escape, F2), settings, a nation clicked on the map, the toy
  world, phone (390 × 844) and laptop (1280 × 720) widths with every bottom-bar panel opened by its button.
- **Evidence:** `critic/c12_m.json`, `critic/c12_p.json`, `critic/shots/c12p_phone_02_GodMode.png`,
  `critic/shots/c12p_laptop_02_GodMode.png`, `critic/shots/c12m_03_settings.png`.
- **Works:** every key does what it says; F2 saves `warsim-1938-01-01.png`; the laptop width has no control off
  screen; the bottom bar scrolls on a phone.
- **Weak:** the stale tooltip (sixth run, now naming London over Paris). On a phone God Mode's seven tool buttons
  are clipped to "Revo", "Spawn n", "Breakthr", "Territo", "Found c", "Raze c" (it was so in run 11 too,
  `c11a_phone_01_god.png`; run 11's "seven tools fit the phone" was wrong). War chips sit under the legend box on a
  phone.

### Performance: 6 (down from 7)

- **Tested:** seed 99 × 5 years, pinned, alone, twice on HEAD and once on `dd3b730` in the same session; 3 late
  years in the page at Max (4877); 10 years at Max in the page (3301).
- **Evidence:** `critic/c12_perf_seed99_5y_solo.log`, `critic/c12_perf_seed99_5y_solo2.log`,
  `critic/c12_perf_seed99_5y_dd3b730.log`, `critic/c12_l_4877.json`, `critic/c12_w_3301.json`.
- **Why down (same seed, both commits, same session):** mean tick 1.785 and 1.790 ms against 1.388 ms (+29 %), above
  the project's 1.5 ms budget; year 1 2.45 ms (budget 2.4); p95 6.8–8.5 ms against 3.3–5.9. The page's late years
  take 23–32 s at Max (run 11: 21–24 s). Part of the cost is more work, not slower code: HEAD's seed-99 world is
  busier (year 5: 64,120 cells flipped against 19,531; 98 nations against 91). The player pays it either way, and
  the same seed now runs over the project's own budget. Frame rate holds at 59.6–60 fps and no tick gap passes 230 ms in the 3 late years.
- **AoC:** known from text only (it advertises repeated performance work, notes lines 638–644).

### Stability: 7 (unchanged)

- **Evidence:** `critic/c12_h_1307.json` (3/3 hashes, twin equal), `errors` empty in every `critic/c12_*.json` from the
  page. No crash, desync or console error in any session.

### Semantic zoom to unit level: 8 (unchanged)

- **Tested:** Germany–Poland at 3,000 to 10 m/px (7019); a continuous wheel zoom 6,000 → 3 m/px (5861); a year-21
  front (6421).
- **Evidence:** `critic/c12_c_7019.json`, `critic/shots/c12c_7019_inf_0025m.png`, `critic/shots/c12c_7019_arm_0025m.png`,
  `critic/c12_z_5861.json`, `critic/shots/c12z_5861_17.png`, `critic/c12_u_6421.json`, `critic/shots/c12u_6421_f0_0250m.png`.
- **Why 8:** ranks of men, tanks against French blocks with tracers and a contact line at 25 m/px; nothing like it in
  AoC.
- **Not more:** after year 1 there is little to zoom into (R12-B1): on 6421's year-21 war the page finds two
  engaged formations in the world; at that front a 3,400-man German division faces Soviet divisions of 143 and 217
  men (`c12u_6421_f0_0250m.png`). A live wheel zoom ends with the
  chosen division gone from frame and three plane silhouettes filling the screen (`c12z_5861_17.png`).

### Naval warfare: 7 (unchanged)

- **Tested:** 32 × 30 years of sea battles; Japan–USA 20 days (8693), Germany–UK (2081), Italy–UK on a new seed
  (7771), each row counted in the DOM; a carrier strike's row clicked.
- **Evidence:** `critic/c12_cmp_all.txt`, `critic/c12_fleets.json`, `critic/c12_n_8693_JAP_USA.json`,
  `critic/c12_n_7771_ITA_ENG.json`, `critic/c12_n4_8693.json`, `critic/shots/c12n_2081_GER_ENG_0_live.png`,
  `critic/shots/c12n_8693_JAP_USA_0_live.png`, `critic/shots/c12n4_8693_rowless_live4s.png`.
- **Better:** every battle has a row; a carrier strike is named as one.
- **Worse (same seeds):** late sea battles 13.29 → 9.30 a world-year; armed fleets at year 20 82 → 60, wars of two
  navies 1.14 → 0.29. Still 3.5 × run 10's late sea war, so not a score move.
- **Why not 8:** the carrier strike, clicked, shows two US destroyer counters and no aircraft (`sorties` 0 at
  84 m/px); 4 s later one blows up with the attackers a speck (`c12n4_8693_rowless_live4s.png`). In the
  Japan–USA battle at 85 m/px the American side is a pale ring and nothing else (`c12n_8693_JAP_USA_0_live.png`).
- **AoC has no navy.**

### Tanks: 8 (unchanged)

- **Tested:** Armoured division 41 against French infantry (3613) at 25 and 80 m/px, x1 and x2.
- **Evidence:** `critic/c12_e_3613.json` (`wreckWatch`, identical in shape to run 11's), `critic/shots/c12c_7019_arm_0025m.png`.
- **Why 8:** German tank ranks against French blocks with tracers and a contact line; burnt hulls rise to 9 shown at
  x1, 18 at x2. **Remaining:** tanks fight almost only in year 1 (R12-B1).

### Aircraft: 7 (unchanged)

- **Tested:** sorties per tier (7019); air battles per year on 32 worlds; planes at 3 m/px.
- **Evidence:** `critic/c12_c_7019.json`, `critic/c12_cmp_all.txt`, `critic/c12_h_1307.json` (`airHolders`).
- **Same seeds:** air battles in year 1 2,979 → 2,853; after year 1 138 → 153 a world-year; sorties aloft after
  year 1 8.2 → 11.0. The user closed 7.51b not done. **AoC has no air war.**

### AI nuclear use: 7 (unchanged)

- **Tested:** 642 bursts on 32 worlds; the AI's H-bomb on the coast by Rome in the page (2081); the restraint lines
  at year 20 (1129); Poland and Czechoslovakia armed in the editor.
- **Evidence:** `critic/c12_cmp_all.txt`, `critic/c12_summary_all.txt`, `critic/c12_f_2081.json`,
  `critic/shots/c12f_2081_11_alert.png`, `critic/shots/c12f_2081_11_goto.png`, `critic/c12_t_1129.json`.
- **Better (same seeds):** R11-B2's failures do not recur: no million under the floor, restrikes 3 → 1.
- **Why not 8:** bursts 188 → 497 (20.7 a world); bursts killing over ten times more civilians than soldiers
  61 → 109; a million or more civilians 4 → 8, among them Germany on the Low Countries, 3,090,000 civilians for 337
  men (5861, utility 0.164), and Germany on the Netherlands then Denmark within 7 days, 2,284,000 and 1,340,000
  civilians for 0 and 473 men (2347, utilities 2.04 and 1.83). The page says it plainly ("Japan struck Netherlands
  with a hydrogen bomb near Civitavecchia: 1,122,000 civilians killed"), but a world where 31 of 32 games see
  bombs and city-killing H-bombs come in volleys reads less like a doctrine than like a habit. All of it is inside
  SPEC §6.4 as the user decided it (see Design objections).
- **AoC's nukes are God-only** (notes lines 414–418).

## Blocking issues, in priority order

1. **R12-B1. After year 1 the land war still has almost no battles (R11-B1, not fixed).**
   - Same 48 checkpoints (years 10 and 20, 24 seeds), same script: 1.52 engaged land formations (was 0.50) of 358
     belonging to nations at war, with 7.3 wars running (was 4.6). Daily over 30 years on 32 HEAD worlds: 33.7 in
     year 1, 2.11 after; 5.1 a war in year 1, 0.34 a war after.
   - In the page: 10 years of 3301 at Max end each year with 0–2 engaged (`c12_w_3301.json`); 60 days of 6421's
     Germany–Soviet war, 0–2 (`c12_y_6421_gersov.json`). Piles: 60 idle US divisions (714,480 men) in one place at
     war (1129, year 10).
   - The ferry, landing, supply-over-the-beach and reserve rules since run 11 tripled a near-zero figure; contact is
     still about 6 % of year 1's.
   - **Evidence:** `critic/c12_cmp_checkpoints.json`, `critic/c12_cmp_all.txt`, `critic/c12_y_6421_gersov.json`,
     `critic/shots/c12y_6421_gersov_d30.png`, `critic/c12_w_3301.json`, `critic/c12_stacks_y10_w1.json`,
     `critic/c12_u_6421.json`.
   - **Fix:** a nation at war sends its standing army to its fronts and the AI holds a front line it fights for,
     so that contact per war after year 1 is a real fraction of year 1's. Measure engaged formations per war after
     year 1 on unseen seeds, with a bar.
2. **R12-B2. The late map shreds, and worse than run 11 on every seed.**
   - Pieces of 2–400 cells of one holder at year 20: 1,174 a world on HEAD against 837 on `dd3b730`, worse on 24 of
     24 same seeds (start: 469). Founded statelets at year 20: 20.7 a world (6.6); tiny nations 30.0 (22.8).
   - What a player sees: Russia as grey-and-red confetti with blue pockets (`c12x_7247_y20_eurasia.png`); Soviet
     land as red islands in Hungarian orange (`c12y_6421_gersov_d60.png`); West Africa in shards
     (`c12x_7247_y20_world.png`). This is the map the player watches for decades, and the AoC look it is measured
     against is contiguous blobs.
   - **Evidence:** `critic/c12_cmp_checkpoints.json`, `critic/c12_frag_head_w12.json`, `critic/c12_frag_head_w3.json`,
     `critic/c11_frag_head.json`, `critic/c12_cmp_all.txt` (`livingFoundedTinyMean`), the three screenshots above.
   - **Fix:** measure which of this run's changes cuts the map (walk-in occupation without fronts, revolts and
     statelets ×3, capitals that move, beach-fed coastal pockets). Pockets that hold on a supplied beach are the
     user's (ADR-630); if they are the main cause, put the count to the user as the price of that rule. Otherwise
     make conquest follow fronts so that occupation does not leave confetti, and bar the pieces count at year 20 on
     unseen seeds against `dd3b730`.

## Non-blocking issues

- **Tick 29 % slower on the same seed** (1.79 against 1.39 ms, budget 1.5; `c12_perf_*`).
- **Late sea war down 30 %** on the same seeds (13.29 → 9.30 a world-year; armed fleets at year 20 82 → 60).
- **Stale map tooltip**, sixth run, now "London" over Paris (`c12a_4219_20_paris_150m_day10.png`).
- **A moving capital captured again and again**: "Australia captured Turkey's capital" three times in December 1947;
  a capital moved 26 times in a year (6421, Netherlands); capitals moved 919 times a world in 30 years.
- **Breakthrough at peace silently does nothing** (`c12_k_2203.json`).
- **God revolt told as a declared war** (`c12_q_6421.json`).
- **Phone: God tools clipped** to "Revo", "Spawn n" … (`c12p_phone_02_GodMode.png`).
- **A million dead and no city ruined**: Civitavecchia's H-bomb leaves Rome 60 km off whole (`c12f_2081_11_ruin_200m.png`).
- **A carrier strike shows no aircraft when its row is clicked** (`c12n4_8693_rowless_clicked.png`).
- **History noise**: "Land handed over" 935 and "Air raids" 794 of 4,317 rows in 3 years.
- **Title's Cancel and file input unstyled** (`c12g_4877_10_title_pending.png`).
- **Editor fleets placed 10 cells apart wait a day at war before they close** (`c12_g4_standoff.json`).

## Design objections (none blocking, no score lowered)

- **Nuclear volume and cities.** Within SPEC §6.4 as the user decided it (an enemy's output is a first-strike target,
  ADR-632 b; a winner "resolves to end the war" at desperation 2, ADR-488–490), the AI now fires 2.6 times as often
  as at run 11 on the same worlds, and its largest bursts are H-bombs on full cities with almost no soldiers:
  3,090,000 civilians for 337 men (5861), 2,284,000 for none (2347), then Copenhagen's 1,340,000 a week later. A
  dead's weight of 0.1 a million cannot hold any of these back. I think the player will read them as massacres with
  no military reason; that is the user's call.
- **Cities as targets with no soldiers in them** (Poland's editor case, 9437): Berlin 334,000 civilians and 379 men
  on day 34, unchanged. ADR-632 b.

## Notes

- `c12_caps.ts` (year 11 from the year-10 saves): 6421 Netherlands capital moved 26 times, "United States took
  founded#104" ×3 on days 3844, 3849, 3853; 1129 Palestine 15 moves; 8693 12 captures, one capital taken twice in
  13 days.
- Every browser session's console was empty (`errors: []`).

## Strengths, verified

- **The sea war is legible now:** each battle the view tracks has its row, carrier strikes named as such
  (`c12_n_*` `domRows`).
- **Determinism:** browser equals headless year by year on 1307, and run 11's seed-99 hash reproduces to the bit
  on `dd3b730` (`c12_perf_seed99_5y_dd3b730.log`).

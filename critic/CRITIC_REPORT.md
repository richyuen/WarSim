# Critic report, run 18

- **Commit:** `cfa73219698918700a3a6b0a8758b3315d6bc0fa` (HEAD at the start). Run 17 was on `cfedb50a`; 22 commits since.
  The ones that touch the game: a save that does not fit is refused whole (ADR-744); a save's state format on the
  autosave record, read by the title (ADR-747); the levy, two cadre divisions a month for an outnumbered nation at war
  (ADR-745, the user's decision); a carrier's lost wing re-manned and the wings listed on its panel (ADR-746); a
  carrier's strike out of a sea battle has a ticker row, carrier sinkings counted (PLAN 7.154a); transports sail only for
  ports in their own waters (ADR-752); a fleet inside a canal keeps its way (ADR-753); the ticker's room beside a panel
  (ADR-754). Decided by the user since run 17: a stable top is a valid world (ADR-750), the sea battles' fall kept
  (ADR-751), 7.153 closed with "the next critic report judges" (ADR-749), 7.155 closed (ADR-755).
- **Date:** 2026-10-28.
- **Build:** `vite build --outDir critic/c18_dist`, exit 0 (`critic/c18_build.log`), served by `vite preview` on
  127.0.0.1:**5338**. `cfedb50a` in a worktree (`critic/wt`, `node_modules` a junction) for headless runs only.
  Chromium through Playwright, headless, 1600 × 900 (390 × 844 phone, 1280 × 720 laptop).
- **Runs:**
  - Unaided 1938 worlds × 30 years on HEAD (`critic/scripts/c18_batch.sh`, `c18_headless.ts` = run 17's script plus the
    `CarrierSunk` ships): **29 of run 17's seeds**, paired against run 17's `c17_*` files (`cfedb50a`), and **8 new
    seeds** (1801, 2441, 3109, 3923, 5003, 6599, 7451, 8761) on **both** commits (`c18o_*` = `cfedb50a`), run
    side by side. The batch was planned for 47 of run 17's seeds; I stopped it after wave 5 (29 complete) to free the
    machine for pinned timing. Partial files of wave 6 (`c18_headless_3491.json` and its wave) are under 30 years and
    excluded. Paired comparison with the standard error of the mean difference: `critic/c18_cmp_y30.json`,
    `critic/c18_cmp_y30.txt` (`c18_cmp.py`).
  - Year-20 saves read on their own commit, 61 days each (`c18_engmen.ts`: engaged land formations and their men, the
    seven 10-day samples of R17-B2's bar; `c18_decks.ts`: carriers, wings aboard and aircraft): `critic/c18_y20_reads.json`
    (from `c18_engmen_*`/`c18_decks_*` files). Old saves stepped in `critic/wt`.
  - Pinned timing after the batch, alone (`c18_perf.sh`, `--affinity 0xFFFF`): seed 99 × 5 years on both commits; HEAD's
    six slowest contended world-years and four seed-years of the new seeds on both commits, each twice.
    `critic/c18_perf_summary.json`.
  - In the page: R17-B1's old-save case three ways; run 17's probes re-run (God tools, nukes by God, Breakthrough at
    peace and at war, phone/laptop, playing Poland, editor fleets and armed Poland, the North Sea standoff, the
    rowless carrier strike, a fleet's and a formation's "To its fight", dense-fight tags, zoom, armour 3,000–10 m/px,
    keys and modes, a new seed's two years, history, export, restraint lines, determinism, the slowest year at Max).
    **New:** carrier strike rows and the carrier panel (seed 99, late 4877, 3923, 7019), the ticker beside a panel at
    three sizes (ADR-754), late worlds 60 days (7019, 4877, 2441, 1801), fleets stranded on canal cells (ADR-753).
- **Reference:** `reference/screens/`, `reference/text/AOC_TEXT_NOTES.md`. AoC's nukes, God tools, save/load and
  performance are known from text only; confidence there is lower.
- **Prefix:** every path below was made in this run (`c18`; `c18o` = `cfedb50a`). Scripts in `critic/scripts/c18_*`.

## Verdict

**The best run yet. All three of run 17's blocking issues are fixed on their own cases: a stale autosave is refused
with a clear message, the late land war is three times as busy, and the carriers fly with manned decks and are told in
the ticker. The cost is the sim's speed: the late tick is a third slower and the 5.5 ms budget now fails in three
measured years.**

- **R17-B1 fixed:** run 17's c10 save on HEAD returns to the title with "This saved game could not be loaded…" and starts
  nothing; a save without a format shows "from an older version… cannot be continued", no Continue.
- **R17-B2 met on its bar, with one world short:** same 29 seeds, engaged land formations a day in years 2–30
  **5.2 → 13.75** (higher on 29 of 29, se 0.28), **0.14 → 0.32 of year 1** (bar: a fifth); new seeds 5.0 → 12.9 (8 of 8).
  Year-20 worlds with nobody in contact on more than two of seven 10-day samples **15 → 2 of 29**, new seeds **5 → 0 of 8**.
  7019 y20, run 17's worst case, in the page: 0, 0, 0, 0, 2, 2, 0 → **10, 9, 8, 35, 38, 24, 39**.
- **R17-B3 fixed:** year-20 carrier groups at war with no wing aboard **31 of 35 → 0 of 36** (same seeds) and 4 of 8 → 0
  of 12 (new seeds); the panel lists the wings, their aircraft and mission; strikes ashore have a ticker row.
- **The sea came back:** sea battles late 5.37 → 6.96 a world-year (higher on 25 of 29), ships sunk in them 60 → 71, plus
  ~25 a world-year now sunk by carrier wings (counted for the first time).
- **Slower:** pinned seed 99 × 5 years **2.10 → 2.56 ms** (+22 %); 6599's year 17 2.82 → **5.76 ms** on the same seed;
  three of HEAD's eight measured slow years over the 5.5 ms budget (run 17: one). The player does not see it yet: the
  slowest year at Max takes 59.4 s, as in run 17 (60.4 s).

## Scores

| Dimension | Run 17 | Run 18 |
|---|---|---|
| Map visuals and readability | 7 | 7 |
| Diplomacy, war, alliance, puppet, revolt depth | 7 | 7 |
| Emergent world dynamics over long runs | 6 | **7** |
| God Mode | 7 | 7 |
| Editor and scenarios | 7 | 7 |
| Stats and history | 7 | 7 |
| UI/UX and polish | 7 | 7 |
| Performance | 7 | 7 |
| Stability | 5 | **7** |
| Semantic zoom to unit level (needs 8) | 8 | 8 |
| Naval warfare (needs 8) | 6 | **8** |
| Tanks (needs 8) | 8 | 8 |
| Aircraft (needs 8) | 8 | 8 |
| AI nuclear use (needs 8) | 8 | 8 |

## Run 17's cases re-run

| Run 17 case | On HEAD | Evidence |
|---|---|---|
| R17-B1: c10's 4219 y10 save through Continue opens a chimera | Record with format 1 (bytes that do not fit): Continue → `?failed=save`, the title says the saved game could not be loaded, no Continue, nothing started. Record without a format (every autosave made before ADR-747): "from an older version of WarSim and cannot be continued", no Continue. | `critic/c18_os_c10fmt1.json`, `critic/shots/c18os_c10fmt1_01_after_continue.png`, `critic/c18_os_nofmt.json`, `critic/shots/c18os_nofmt_00_title.png` |
| (side effect) | A `cfedb50a` save (7019 y20) given format 1 **loads whole** on HEAD (27 December 1957, its wars and ranking); without the field it is refused. Every player's compatible save on Pages is refused once (ADR-747 accepts this). | `critic/c18_os_fmt1.json`, `critic/shots/c18os_fmt1_01_after_continue.png` |
| (new, minor) | After the refusal, a fresh visit to `/` offers **Continue** for the same broken format-1 save again. | `critic/c18_os_c10fmt1.json` (step "title again") |
| R17-B2: late contact 5.11 a day, 13 % of year 1 | Same 29 seeds `cfedb50a` → HEAD: **5.22 → 13.75** (se 0.28, higher on 29); 0.141 → **0.318** of year 1; y20 3.7 → 13.1; per war 0.79 → 1.86; land formations at war late 465 → 629. Year 1 37.8 → 44.5 (higher on 26). New seeds, both commits: 5.03 → 12.91 (8 of 8), 0.131 → 0.275. | `critic/c18_cmp_y30.json`, `critic/c18_cmp_y30.txt` |
| R17-B2: 7019 y20 in the page 0, 0, 0, 0, 2, 2, 0 | HEAD's own 7019 y20: **10, 9, 8, 35, 38, 24, 39** of ~870 land formations (run 17's save on `cfedb50a`, headless: 0, 0, 0, 0, 2, 2, 0, matching run 17's page). 4877 y20 25, 36, 37, 21, 46, 15, 26 (run 17 0, 0, 0, 2, 3, 9, 16); new 2441 4, 13, 14, 16, 14, 12, 16; 1801 25, 25, 28, 19, 13, 18, 2. | `critic/c18_y2_7019_y20.json`, `critic/c18_y2_4877_y20.json`, `critic/c18_y2_2441_y20.json`, `critic/c18_y2_1801_y20.json`, `critic/c18_engmen_test_old.json`, `critic/shots/c18y2_7019_y20_d30_250m.png` |
| R17-B2: nobody in contact >2 of 7 samples | Same 29 y20 saves: **15 → 2** worlds (2789, 6421), empty samples 73 → 14 of 203; new seeds **5 → 0** of 8 (27 → 1). 6421 y20 has land fronts (Soviet Union against Tannu Tuva, 748 cells, 237 formations against 4; Latvia against Argentina, 310 cells) and nobody in contact on 4 of 7. Engaged men a day 24,200 → 65,200. | `critic/c18_y20_reads.json`, `critic/c18_phantom_6421.json` |
| R17-B3: carriers with a wing aboard y20 1.30 a world | Same seeds **0.86 → 2.72** at y20 (higher on 17, lower on 5); y10 2.48 → 4.48. Year-20 saves: wings aboard 25 of 83 carriers → **79 of 79**; carrier groups at war with none 31 of 35 → **0 of 36**. New seeds 12 of 29 → 34 of 34. But only **31 of 79** decks hold a whole wing (20+ of 24 aircraft): 1,260 aircraft on 79 decks. | `critic/c18_cmp_y30.json`, `critic/c18_y20_reads.json`, `critic/c18_decks_c18_y20_a.json` |
| Carrier panel shows no wings | Seed 99's group 1145: "Air groups aboard (2 of 2) / 24× Naval bombers striking, in the air"; late 3923 US groups "6× / 3× Naval bombers striking". Fixed. | `critic/c18_cv_99.json`, `critic/c18_rr_3923.json`, `critic/shots/c18rr_3923_cvpanel.png` |
| Carrier strike ashore has no row (seed 99) | Row "⚓ Carrier strike ashore: Japan on China" from hour 3; its click frames the planes over the Yellow Sea at ~1,200 m/px. Fixed. **But** several groups of one nation striking one enemy give **identical rows**: two "Japan on China" (seed 99 h77, 7019 day 4), three "United States on Iceland" (7019 y20). | `critic/c18_tk_99_1600.json`, `critic/shots/c18tk_99_1600_02_raidclick.png`, `critic/shots/c18cv_99_1_framed.png`, `critic/shots/c18y2_7019_y20_d30_3000m.png`, `critic/shots/c18c_7019_arm_0025m.png` |
| Sea battles late 5.32 | Same seeds **5.37 → 6.96** (se 0.23, higher on 25); sunk in them 60.0 → 71.0; year 1 38.5 → 38.2 (level); carrier sinkings 0 counted → **763 ships a world** over 30 years. Transports y20 416 → 601, landings 2,517 → 4,086 a world. | `critic/c18_cmp_y30.json` |
| Ticker beside a panel (ADR-754) | Seed 99 at 1600 × 900, 1280 × 720, 390 × 844: panel and ticker do not overlap (0 px²). On the phone the war chips cover the raid row. | `critic/c18_tk_99_1600.json`, `critic/c18_tk_99_1280.json`, `critic/c18_tk_99_390.json`, `critic/shots/c18tk_99_390_01_panel.png` |
| Late raid rows flooding the ticker | No: 4877 y20 (no carriers left) 0 rows; 3923 y20 0–1 rows over 10 days. | `critic/c18_rr_4877.json`, `critic/c18_rr_3923.json` |
| Performance: 9781 y24 5.85 ms pinned | HEAD's slowest contended years, pinned twice: **6599 y17 5.76 / 5.75**, **2539 y28 5.67 / 5.84**, **1307 y30 5.33 / 5.55**, 3727 y25 5.14/5.16, 8011 y26 4.87/4.86, 7451 y24 4.77/4.73. Same seed-years on `cfedb50a` (other worlds): 6599 y17 2.83, 7451 y24 2.44, 7451 y28 4.26 (HEAD 3.89), 5003 y29 4.80 (HEAD 3.27). Operational AI 1.03 → 2.57 ms in 6599 y17 (formations 817 → 1,061). Contended world-years over 5.5 ms 17 of 2,160 (run 17) → 136 of 1,110; late mean contended 3.26 → 4.34 ms (higher on 29 of 29). Seed 99 pinned 2.10 → **2.56 ms**, hash b22bcdd1 at year 1 (the pin). | `critic/c18_perf_summary.json`, `critic/c18_perf_6599_y17_read1.log`, `critic/c18o_perf_6599_y17_read1.log`, `critic/c18_perf_seed99_5y_head.log`, `critic/c18_perf_seed99_5y_cfed.log` |
| Slowest year at Max 60.4 s | 6599's year 17 at Max in the page: **59.4 s**, 59.6 fps, longest gap 330 ms. Unchanged for the player. | `critic/c18_l_6599.log` |
| Browser = headless (1307 mismatch once) | 1307 with no input, year 1: f9a6a2d6 both; with the probe's inputs, years 1–3 equal (f9a6a2d6, 3d48c6a6, fc8880f2); save/load twin equal. Seed 99 year 1 b22bcdd1 in the page. Not reproduced. | `critic/c18_det_1307_8760.json`, `critic/c18_h_misc_1307.log`, `critic/c18_det_99_8760.json` |
| Ordered five 2 of 64 over 12 years | Now a design (ADR-750). HEAD 0 of 37 over 12 years (max 8); set of five over 12 years 3 of 37 (6301 21). | `critic/c18_cmp_y30.txt` (`headOnly`) |
| Breakthrough at peace silent (2203) | Unchanged: counts identical before and after, no row. At war (7019) a corridor in state, no row. | `critic/c18_k_2203.json`, `critic/c18_k3_7019.json` |
| God revolt told as a declared war | Unchanged: "1 January 1938 Germany declared war on Free Saxony". | `critic/c18_q_6421.json` |
| Nukes by God (4219) | Unchanged: Paris H-bomb 3,329,000 civilians; London A-bomb 314,000. | `critic/c18_a_4219.json` |
| Phone: God tools clipped | Unchanged: "Revo", "Spawn n", "Breakthr", "Territo", "Found c", "Raze c"; the bottom bar ends at "Stati". | `critic/shots/c18p_phone_02_GodMode.png`, `critic/shots/c18p_phone_01_world.png` |
| Offer peace: no answer | Unchanged: Poland offers Lithuania peace; no row. | `critic/c18_pl_6011.json` |
| History export a/b raw | Unchanged: "SeaBattle,458771,France,524312,…". | `critic/c18_dl_7019.csv` |
| Dense fight tags (7019 day 35, 250 m/px) | 65 inputs, 45 placed, 3 left out, 12 names unplaced: identical to run 17 (the start's first weeks are unchanged by this run's rules). | `critic/c18_tg_7019.json` |
| Editor North Sea standoff (4877) | Holds: "Germany and United Kingdom fought at sea: Germany lost 21 ships, United Kingdom 13", 2 January. | `critic/c18_g4_standoff.json`, `critic/c18_g_4877.json` |
| Editor-armed Poland (9437) | Holds and moved: Poland strikes Germany near Coburg on day 52 (62,620 men, 0 civilians), Moscow day 91, **Prague** day 107 (134,000 civilians, 299 men). | `critic/c18_g2_9437_POL.json` |
| Rowless carrier strike (8693) | Holds: "⚓ Carrier strike: Japan on United States's ships", framed at 225 m/px. | `critic/c18_n4_8693.json` |
| Fleet "To its fight" | Holds (5381 destroyers at 60 m/px; 4877's British carrier group at 448 m/px, its wings "with its fleet, in the air"). | `critic/c18_fp2_5381.json`, `critic/c18_fp2_4877.json` |
| Formation "To its fight" frames blocks apart (5381 d21) | Identical results to run 17 (same eight formations, same zooms, self off screen on 6 of 8). Unchanged. | `critic/c18_ft_5381_d21.json` |
| Restraint lines | Consistent over 60 days on 7019 y20 (puppet, deterred, noThreat, taboo). | `critic/c18_t_7019.json` |
| History panel | 7019 y20: 4,154 events, filters 163–170 ms, charts 1.5 s. | `critic/c18_hi_7019.json` |
| Fleets stranded on canal cells (ADR-753) | Five HEAD y20 saves × 30 days: 0 fleet-hours on a cell of no sea zone. | `critic/c18_nozone_new.json` |
| Not re-read | The nuclear pause from a save before a strike (run 17's save of 1129 is another world now), the Large map, editor carrier decks (code unchanged). | — |

## Dimensions

### Map visuals and readability: 7 (unchanged)

- **Tested:** a new seed's Europe every 60 days for two years (2441); late worlds at 3,000 and 250 m/px (7019, 4877, 2441,
  1801 y20); phone and laptop.
- **Evidence:** `critic/shots/c18ww_2441_d300_europe.png`, `critic/shots/c18y2_7019_y20_d30_3000m.png`,
  `critic/shots/c18y2_2441_y20_d30_3000m.png`, `critic/shots/c18p_phone_01_world.png`.
- **Weak:** late Iberia a patchwork of five colours under occupation hatching (7019 y20); the war chips run under the map
  mode's legend box ("Peru +3" cut, `c18ww_2441_d300_europe.png`); the phone's legend covers the chips.
- **AoC does better:** contiguous blobs with readable names and contrasting colours (`reference/screens/steam-screenshot-03.jpg`).
  No drawing code changed but the ticker's rows.

### Diplomacy, war, alliance, puppet, revolt depth: 7 (unchanged)

- **Same 29 seeds:** wars declared 444 → 444, peaces 423 → 421, puppets, annexations, revolts level; major battles
  146 → 180 (se 9).
- **Weak (unchanged UI):** Offer peace unanswered (`critic/c18_pl_6011.json`); the God revolt told as a declared war.

### Emergent world dynamics over long runs: 7 (up from 6)

- **Tested:** 37 worlds × 30 years (29 paired with run 17, 8 new on both commits); 37 year-20 saves × 61 days on their own
  commits; four late worlds 60 days in the page; a new seed's first two years in the page.
- **Why up (same seeds, same cases):** run 17 held 6 because late contact was 13 % of year 1 and half the late worlds
  showed nobody in contact. Now late contact is 2.6× (0.32 of year 1, higher on all 37 worlds); worlds with nobody in
  contact on more than two of seven samples 15 → 2 of 29, 5 → 0 of 8 new; 7019 y20 went from an empty front to 24–39
  formations in contact (`c18y2_7019_y20_d30_250m.png`: French and Australian divisions in the Pyrenees). Sea battles
  late +30 %, air battles late +44 % (687 → 987, higher on 29), landings +62 %.
- **Why not 8:** a quarter of the engaged formations are under 2,000 men (0.18 → 0.26): the levy's "Cadre infantry
  division" tags of 365–1,300 men fill the late fronts (`c18y2_7019_y20_d30_250m.png`); 6421 y20 still has a 748-cell
  Soviet front against Tannu Tuva with nobody in contact on 4 of 7 samples; late contact is a third of year 1. No
  evidence yet that the long run is clearly better than AoC's.

### God Mode: 7 (unchanged)

- **Tested by clicks:** Revolt, Spawn nation, Found city, Raze city (6421); H-bomb on Paris and A-bomb on London (4219);
  Breakthrough at peace (2203) and at war (7019). `critic/c18_q_6421.json`, `critic/c18_a_4219.json`, `critic/c18_k_2203.json`, `critic/c18_k3_7019.json`.
- **Weak (unchanged code):** Breakthrough silent; the revolt told as a declared war.

### Editor and scenarios: 7 (unchanged)

- **Tested:** fleets and a bomber group placed, the refusal on land ("no water of a sea is near the place"), the
  standoff loaded from its export, armed Poland. `critic/c18_g_4877.json`, `critic/c18_g4_standoff.json`, `critic/c18_g2_9437_POL.json`.
- **Weak, unchanged code:** editor carrier groups with empty decks; the title's file input a browser default ("Choose File").

### Stats and history: 7 (unchanged)

- **Evidence:** `critic/c18_hi_7019.json` (4,154 events), `critic/c18_dl_7019.csv`, `critic/c18_dl_7019.json`, `critic/c18_l_6599.log` (3,388 events, 24 types).
- **Weak:** the export's `a`/`b` columns are raw words for sea battles; the carrier sinkings (`CarrierSunk`) are counted
  but not in the history (the headless report sums them).

### UI/UX and polish: 7 (unchanged)

- **Better:** the title's two save messages are plain and placed where Continue was (`c18os_nofmt_00_title.png`,
  `c18os_c10fmt1_01_after_continue.png`); the carrier panel's deck rows; the ticker clears the panel at three sizes.
- **New weakness:** identical carrier strike rows ("Carrier strike ashore: United States on Iceland" three times,
  `c18y2_7019_y20_d30_3000m.png`), with no fleet or target name to tell them apart.
- **Unchanged:** phone bar cut ("Stati"), God tools clipped, chips under the legend; "To its fight" on land frames
  blocks with the formation itself off screen on 6 of 8 presses (`c18_ft_5381_d21.json`).

### Performance: 7 (unchanged)

- **Evidence:** `critic/c18_perf_summary.json`, `critic/c18_perf_*_read*.log`, `critic/c18o_perf_*_read*.log`,
  `critic/c18_l_6599.log`.
- **Worse in the sim, not yet for the player:** pinned seed 99 2.10 → 2.56 ms (+22 %, same seed, both commits); same
  seed-year 6599 y17 2.82 → 5.76 ms (the levy's armies: 817 → 1,061 formations, operational AI 1.03 → 2.57 ms); three of
  eight measured years over ADR-709's 5.5 ms (5.84 the worst; run 17: one at 5.85). Late mean contended +33 % on 29 of 29
  worlds. ADR-745's own cost line ("run time 1.065×, worst year 4.75 ms") is not what these worlds show.
- **Why not down (but R18-B1):** the worst year is no worse than run 17's (5.84 against 5.85), and the slowest year at Max is 59.4 s
  with no gap over 330 ms (run 17: 60.4 s). **AoC:** text only.

### Stability: 7 (up from 5)

- **Why up (same case, both builds):** run 17's c10 save on HEAD is refused whole, the title says so, nothing starts
  (`c18os_c10fmt1_01_after_continue.png`; run 17: the chimera in `c17os_01_after_continue.png`). Pre-format saves are
  refused before load (`c18_os_nofmt.json`). Browser and headless equal on seeds 99 and 1307 (years 1–3, with inputs);
  `errors` empty in every page JSON of this run but the expected warning of the refused save
  ("the autosave could not be loaded: missing section formations.struck", `c18_os_c10fmt1.json`); 37 headless worlds 30 years without a throw.
- **Not more:** the broken format-1 save is offered again on the next visit (`c18_os_c10fmt1.json`); a save that would
  load is refused for lacking a field (designed, ADR-747).

### Semantic zoom to unit level: 8 (unchanged)

- **Evidence:** `critic/shots/c18c_7019_arm_0025m.png`, `critic/shots/c18c_7019_inf_0010m.png`, `critic/c18_z_5861.json`,
  `critic/shots/c18y2_7019_y20_d30_250m.png`.
- **Holds:** German armour ranks against Polish blocks with tracers, the contact line and planes at 25 m/px; late fronts
  now show blocks in contact at 250 m/px. **Not more:** the formation camera off its own formation (above).

### Naval warfare: 8 (up from 6)

- **Evidence:** `critic/c18_cmp_y30.json`, `critic/c18_y20_reads.json`, `critic/c18_cv_99.json`, `critic/c18_rr_3923.json`,
  `critic/shots/c18rr_3923_cvpanel.png`, `critic/shots/c18tk_99_1600_02_raidclick.png`, `critic/c18_n4_8693.json`,
  `critic/c18_g4_standoff.json`, `critic/c18_fp2_4877.json`.
- **Why up (same 29 seeds, `cfedb50a` → HEAD):** run 17 dropped naval for fewer battles and empty decks. Sea battles late
  5.37 → 6.96 (higher on 25 of 29), ships sunk in them 60 → 71, and carrier wings now sink ~25 ships a world-year that
  are counted; carrier groups at war with no wing 31 of 35 → 0 of 36; carrier strikes ashore and out of battle have rows
  and a framed click; the panel shows each wing and whether it is striking. Transports and landings up (601 at y20,
  landings +62 %). Fleets on canal cells: none. **AoC has no navy.**
- **Against run 16's 7 (8.16 late battles, manned carriers):** HEAD fights fewer surface battles (6.96), but adds what
  run 16 lacked: ~25 ships a world-year sunk by carrier wings and counted, a ticker row and a framed click for every
  carrier strike, the deck panel, landings up and no fleet stranded. Ships sunk at sea late (battles 71 + carriers ~25)
  exceed run 16's 80.8 in battles. That, not the battle count, is the 8.
- **Not more:** 48 of 79 decks hold a worn wing (6 or 3 of 24 aircraft in 3923's US groups), as "manned"; raid rows of one
  nation are indistinguishable; surface warships y20 297 → 279 (n.s.).

### Tanks: 8 (unchanged)

- **Evidence:** `critic/shots/c18c_7019_arm_0025m.png`, `critic/shots/c18c_7019_arm_0080m.png`, `critic/c18_c_7019.json`.

### Aircraft: 8 (unchanged)

- **Evidence:** `critic/c18_cmp_y30.json`, `critic/c18_u_4877.json`, `critic/shots/c18c_7019_arm_0025m.png`.
- **Holds and better:** air battles late 687 → 987 a world-year, sorties aloft late 40.7 → 50.3 (higher on 27 of 29);
  carrier air hours late 730 → 2,331. **Not more:** a late front at 250 m/px is often an empty sky (4877 y20: 0, 1, 1
  sorties over three fronts at 250 m/px, `c18_u_4877.json`); carrier sorties drawn as land planes. **AoC has no air war.**

### AI nuclear use: 8 (unchanged)

- **Evidence:** `critic/c18_g2_9437_POL.json`, `critic/c18_t_7019.json`, `critic/c18_a_4219.json`, `critic/c18_cmp_y30.json`.
- **Holds:** editor-armed Poland strikes three times in 107 days, the "means lost" line when its airbase falls; restraint
  lines consistent; bursts a world 22.8 → 25.0 (n.s.). **New to note:** Poland's third strike, on Prague, killed 134,000
  civilians and 299 men: a city strike against a near-empty target.

## Blocking issues, in priority order

Each of run 17's three is fixed on its own case (above). One new:

1. **R18-B1. The tick budget fails on late years after the levy (contradicts SPEC's "≤ 5.5 ms in any year", ADR-709).**
   - Pinned, alone, twice: 6599 y17 **5.76 / 5.75 ms**, 2539 y28 **5.67 / 5.84**, 1307 y30 5.33 / **5.55**: three of the
     eight slowest measured years over the budget (run 17: one of seven, 5.85). Same seed-year 6599 y17 on `cfedb50a`
     2.82 ms (817 formations, operational AI 1.03 ms) against HEAD's 5.76 (1,061, 2.57 ms). Seed 99 × 5 years 2.10 →
     2.56 ms. Contended world-years over 5.5 ms 17 of 2,160 → 136 of 1,110; late mean higher on 29 of 29. ADR-745's
     cost line ("1.065 ×, the worst year 4.75 ms") is not what these worlds show.
   - Run 17 demoted one breach of 6 % in 2,160 world-years; that premise is gone. The player does not feel it yet (the
     slowest year at Max 59.4 s), which is why Performance holds 7.
   - **Evidence:** `critic/c18_perf_summary.json`, `critic/c18_perf_6599_y17_read1.log`, `critic/c18o_perf_6599_y17_read1.log`,
     `critic/c18_perf_2539_y28_read2.log`, `critic/c18_perf_seed99_5y_head.log`, `critic/c18_perf_seed99_5y_cfed.log`, `critic/c18_cmp_y30.txt`.
   - **Fix and bar:** make the levy's armies cheaper to plan (fold or cap cadres per front, or a cheaper operational AI
     per formation); pinned ≤ 5.5 ms on the five slowest years of ten unseen 30-year seeds.

## Non-blocking issues

1. **Identical carrier strike rows** for several groups of one nation on one enemy (`c18y2_7019_y20_d30_3000m.png`). Fix:
   one row a nation pair with a count, or name the group and the target.
2. **Worn wings count as manned decks:** 31 of 79 decks hold a whole wing (20+ of 24 aircraft); the rest fewer (`c18_decks_c18_y20_a.json`).
   Fix: refill deck wings as land wings are refilled, or re-man below a threshold.
3. **Hollow levies fill the late fronts:** engaged formations under 2,000 men 18 → 26 %; "Cadre infantry division" tags of
   365–1,300 men (`c18y2_7019_y20_d30_250m.png`). Fix: merge cadres in contact, or show them as one block.
4. **One late world still idle on a large front:** 6421 y20, Soviet Union against Tannu Tuva, 748 cells, 237 formations
   against 4, nobody in contact on 4 of 7 samples (`c18_phantom_6421.json`).
5. **A broken save with the current format is offered again** after its refusal, on the next visit (`c18_os_c10fmt1.json`).
6. **Unchanged UI:** Breakthrough silent; God revolt told as a declared war; Offer peace unanswered; phone God tools
   clipped and bar cut; export a/b raw; land "To its fight" off its own formation; editor carriers empty.

## Design objections (none blocking, no score lowered)

- **Every compatible autosave refused once (ADR-747):** a `cfedb50a` save loads whole on HEAD when the record claims the
  format (`c18_os_fmt1.json`), but without the field it is refused. A trial load with ADR-744's rollback would have kept
  these games; the user accepted the loss.
- **The levy for no gold (ADR-745):** it fixes the stillness by numbers of small formations, and its cost lands on the
  tick budget (R18-B1). Fronts of cadres look thin at 250 m/px.
- **The sea battles' fall kept (ADR-751):** now moot on these seeds (late battles +30 % since run 17), though still under
  run 16's 8.16 a world-year.
- **A stable top is a valid world (ADR-750):** fine on these runs: the ordered five never held over 8 years on HEAD.

## Notes

- The batch ran nine worlds at a time beside page probes; pinned figures were taken alone after it was stopped.
  `c18_headless.ts`'s 1307 year-1 hash equals the page's (f9a6a2d6).
- Contended timing ratios between runs are a trend; the verdicts above rest on pinned pairs.
- The title card's date in the old-save shots is the probe's tick written into the record.
- Port 5338 stopped at the end; the worktree's `node_modules` junction was unlinked before `git worktree remove`.

## Strengths, verified

- **Run 17's three blocking issues fixed on their own cases**, each with a same-case before/after.
- **Late fronts are alive:** 7019's year 20 from 0 to 39 formations in contact; worlds with idle fronts 15 → 2 of 29.
- **Determinism:** browser and headless equal on 99 and 1307 with inputs, the seed-99 pin met in the page.

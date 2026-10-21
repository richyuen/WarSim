# Critic report, run 11

- **Commit:** `dd3b730a2b7521286d7c9ae276c80aa050240ed8`. Run 10 was on `bcbc99c`; 67 commits since (PLAN 7.35–7.48, 7.36,
  7.37, 7.38, 7.39, 7.43 ticked; 7.29 and 7.42 closed not done by the user, ADR-577).
- **Date:** 2026-10-21.
- **Build:** `vite build --outDir critic/c11_dist`, exit 0 (`critic/c11_build.log`). Served with `vite preview` on port
  **5311** (5299 was held by a stale preview from 2026-10-20, PID 50044, serving `dist/`, not mine; left alone).
  Chromium through Playwright, headless, 1600 × 900.
- **Runs:**
  - 24 unaided headless worlds × 30 years (`critic/scripts/c11_batch.sh`, `c11_headless.ts`): run 10's 14 seeds
    (1307 … 9437) **for a same-seed comparison**, and 10 new seeds (1129, 2347, 3491, 4513, 5683, 6151, 7247, 8011,
    8849, 9781). Year-10 and year-20 saves.
  - Comparison of the same 14 seeds on both commits: `critic/c11_cmp.json` (`critic/scripts/c11_cmp.py`; `c10_*` files
    are `bcbc99c`, `c11_*` are HEAD). Full burst list: `critic/c11_summary_all.txt`.
  - Run 10's checkpoints re-read at `bcbc99c` in a worktree (`critic/wt`, removed after; node_modules junction unlinked
    first) for every new count: engagement, piles, fragmentation.
- **Reference:** `reference/text/AOC_TEXT_NOTES.md`, `reference/screens/`. AoC's nukes, God tools and performance are
  known from text only; my confidence is lower there.
- **Prefix:** every path below was made in this run (prefix `c11`). Scripts are in `critic/scripts/c11_*`.

## Verdict

**Run 10's three blockers are answered as filed**, on the same seeds:

- **R10-B2 (sea war over after year 1): fixed.** Same 14 seeds: 13.17 sea battles a world-year in years 2–30, against
  2.68 on `bcbc99c`; 0.6 % sink nothing. The 10 new seeds give 13.45.
- **R10-B1 (nukes blind to the dead): mostly fixed.** On the same 14 seeds, bursts under utility 0.1 that kill a
  million civilians go from 5 to 0. But on a new seed the same failure recurs (Greenock, below), and the AI now fires
  far more: 93 bursts against 58 on the same seeds.
- **R10-B3 (air war): two of three parts fixed.** Sorties are now drawn at 25 and 10 m/px over the 7019 front (1–3,
  was 0); the air map no longer has one German zone from London to Kiev. The third part, the late air war, is unchanged:
  120 air battles a world-year after year 1 against 122.

**What I newly measured is worse than anything run 10 named: after year 1 the land war has no battles (R11-B1).**
Across 48 checkpoints (years 10 and 20, 24 worlds) a mean of 0.3 to 0.7 land formations are in contact, worldwide,
while about 300 formations belong to nations at war and thousands of cells change hands each fortnight. In year 1 the
same count is 55 to 107. It is the same on `bcbc99c` (1.1 and 0.3), so it is not a regression and moves no score; it is
the read ADR-577 deferred to this report ("the next critic report says whether the late land war is still short"). It
is: armies stand in piles of 30 to 85 divisions at home while their nations are at war, and the conquests that happen
are walk-ins that leave the map in ribbons.

## Scores

| Dimension | Run 10 | Run 11 |
|---|---|---|
| Map visuals and readability | 7 | 7 |
| Diplomacy, war, alliance, puppet, revolt depth | 7 | 7 |
| Emergent world dynamics over long runs | 6 | 6 |
| God Mode | 7 | 7 |
| Editor and scenarios | 7 | 7 |
| Stats and history | 7 | 7 |
| UI/UX and polish | 7 | 7 |
| Performance | 7 | 7 |
| Stability | 7 | 7 |
| Semantic zoom to unit level (needs 8) | 8 | 8 |
| Naval warfare (needs 8) | 6 | **7** |
| Tanks (needs 8) | 8 | 8 |
| Aircraft (needs 8) | 6 | **7** |
| AI nuclear use (needs 8) | 7 | 7 |

## Run 10's cases re-run

| Run 10 case | On HEAD | Evidence |
|---|---|---|
| R10-B1: Shanghai 3.8 M at 0.025 (4877), Paris ×3 and Rome (8693), Tashkent/Banda Aceh ×6 (9437), 25 of 58 bursts >10× civilians | Same 14 seeds: no burst under 0.1 kills 500,000 civilians (was 7, of which 5 over a million). 8693 has no burst at all in 30 years; 4877's 44 bursts and 9437's 8 hit no named city twice in a year. **But** 29 of 93 bursts still kill >10× more civilians than soldiers (a read, not a bar: the user's decision in PLAN 7.38), and on new seed 1129 a hydrogen bomb kills 1,105,514 at utility 0.026 (R11-B2). | `critic/c11_cmp.json`, `critic/c11_summary_all.txt` |
| R10-B2: sea battles 2.7 a world-year after year 1, 18 of 28 samples with no naval war | 13.17 a world-year (same seeds); spread evenly over years 2–30 (665 to 995 per 5-year bucket in the logs). Samples with no war of two navies: 14 of 28 against 15 of 28 by the same script on `bcbc99c` (run 10's "18" was a different count). | `critic/c11_cmp.json`, `critic/c11_fleets.json`, `critic/c10_fleets.json` |
| R10-B3: 0 sorties at 25/10 m/px (7019); one German air zone London–Kiev (8217); air battles 2,537 → 122 | 1 sortie at 25 and 10 m/px on infantry, 3 on armour, 2 at 15 m/px live (`c11_c_7019.json`). 8217 day 10: Germany holds 2 zones (Germany, Poland, the Baltic coast), Czechoslovakia, Italy, France each hold their own, Kiev reads "no one flies there". Air battles: 3,160 in year 1, 120 a year after (same seeds). | `critic/c11_c_7019.json`, `critic/shots/c11c_7019_inf_0010m.png`, `critic/shots/c11h_8217_air_hover.png`, `critic/c11_h_1307.json` |
| Japan–USA naval, 20 days (8693) | 9 battles between them, **9 of 9 with no ticker row** (run 10: 9 and 9). Unchanged. | `critic/c11_n_8693_JAP_USA.json` |
| Germany–UK sea rows (2081) | 11 battles seen, 7 without a row (run 10: 14 and 9). Rows frame both fleets; up to 58 shots drawn. | `critic/c11_n_2081_GER_ENG.json`, `critic/shots/c11n_2081_GER_ENG_3_20m.png` |
| Stale map tooltip | **Fifth run running.** "Prague · capital … Unrest 0" a day after Prague is razed; "London · capital" after a wheel-out to 24,738 m/px. Corrects only on a mouse move. | `critic/c11_s_6421.json`, `critic/c11_h_1307.json`, `critic/shots/c11q_6421_raze_prague_1day.png` |
| Editor-armed Czechoslovakia dies holding 10 warheads, unexplained | **Fixed in what it tells:** the editor now says "delivers them by its strategic bomber group at Prague", and the history reads "11 January 1938 Czechoslovakia lost its last means to deliver its warheads: Germany took its airbase near Prague". | `critic/c11_g2_5309_CZS.json` |
| Editor-armed Poland bombs Rome and Prague for almost no soldiers | Unchanged to the man: Berlin 334,000 civilians / 379 men, Rome 172,000 / 90, Prague 134,000 / 390. Under SPEC §6.4 (a city is a target): see Design objections. | `critic/c11_g2_9437_POL.json`, `critic/shots/c11g2_9437_POL_11_alert.png` |
| Stasis 21–22 years (7019, 8693) | Same seeds: longest top-5 stasis 22 years (3613), one seed over 20 (run 10: two). New seeds: max 20. Not changed. | `critic/c11_cmp.json` |
| Seed 99 tick 1.67–1.69 ms (budget 1.5) | 1.388 and 1.409 ms, alone and pinned; year 1 2.24 ms (budget 2.4). | `critic/c11_perf_seed99_5y_solo.log`, `..._solo2.log` |
| Title's Cancel / file input unstyled | Unchanged. | `critic/shots/c11g_4877_10_title_pending.png` |
| Browser = headless | 3 of 3 year hashes equal on 1307 (f4aaf3da, 42f4596c, 0e68f495); save/load twin equal (3.77 MB). A headless replay of 1129 from year 10 to 16 lands on the batch's hash (8ea1eabe). | `critic/c11_h_1307.json`, `critic/scripts/c11_ck.ts` |

## Dimensions

### Map visuals and readability: 7 (unchanged)

- **Tested:** a continuous wheel zoom 6,000 → 3 m/px (5861); the 1953 and 1958 worlds from saves (1129, 6421); the
  Germany–Soviet border of a year-21 war at 6,000 and 1,500 m/px; ruins of God and AI bombs.
- **Evidence:** `critic/shots/c11z_5861_sheet.png`, `c11v_6421_ger_sov_6000m.png`, `c11v_6421_ger_sov_1500m.png`,
  `c11f_1129_14_goto.png`, `c11t_1129_r0_n10.png`; `critic/c11_frag_head.json`, `critic/c11_frag_c10.json`.
- **Works:** the T1→T2 blend holds; the 1953 Europe (`c11t_1129_r0_n10.png`) reads as AoC's does, labels and flags on
  every nation.
- **Weak (new finding, present on both commits):** late maps are shredded. In year 21 of 6421, Soviet land inside the
  German conquest is hundreds of red ribbons, parallelograms and triangles with straight edges
  (`c11v_6421_ger_sov_6000m.png`). Pieces of 2–400 cells of one holder: 469 at the 1938 start; 604–1,039 at year 20 on
  HEAD and 658–1,018 on `bcbc99c` (same 14 seeds); the Soviet Union alone 94–287 pieces. AoC's late worlds are
  contiguous blobs (`reference/screens/community-dominated-world-a.png`, steam-screenshot-02). Not a change, so not a
  score move; it is a reason the score is not higher.
- **Also:** the Greenock blast leaves the Glasgow city marker untouched beside a 1,071,000-dead ruin
  (`c11f_1129_14_goto.png`).

### Diplomacy, war, alliance, puppet, revolt depth: 7 (unchanged)

- **Tested:** 24 × 30-year worlds; 3 late years of 4877 in the page, counted by the history's type filter.
- **Evidence:** `critic/c11_l_4877.json` (`historyTypes`), `critic/c11_cmp.json`.
- **Works:** 3 years from 1958 on 4877: 204 wars declared, 201 peaces, 63 alliances joined, 51 puppets made, 30
  revolts, 16 revivals, 12 unions. Same-seed late wars a year 4.33 (was 4.08).
- **Weak:** wars are declared and made peace in volume, but see R11-B1: they are fought by almost no one.
- **AoC does better:** nothing measured (text only).

### Emergent world dynamics over long runs: 6 (unchanged)

- **Tested:** 24 seeds × 30 years; engagement, piles and fragmentation counted on 48 checkpoints of HEAD and 28 of
  `bcbc99c`.
- **Evidence:** `critic/c11_cmp.json`, `critic/c11_engaged_head.json`, `critic/c11_engaged_c10.json`,
  `critic/c11_engaged_year21.log`, `critic/c11_engaged_y1_6421.log`, `critic/c11_stacks_y10.json`,
  `critic/c11_stacks_c10_y10.json`.
- **Not better:** stasis max 22 on the same seeds (one over 20, was two); the new seeds max 20. 68–83 nations living at
  year 30, 1–13 founded; 3.3–33.6 % of land changes hands in the last 5 years.
- **Why not higher (R11-B1, on both commits):** the long-run world is a map of wars with no fighting. Seed 6421, year
  21: 9 wars, 49 nations at war, 0 land formations in contact at every one of 25 fortnightly samples, while 309 to
  7,179 cells change hands each fortnight. Seed 99 shows the armies themselves shrinking: 917 formations in year 1, 610
  by year 5 (`c11_perf_seed99_5y_solo.log`; run 10's log: 810 → 823).

### God Mode: 7 (unchanged)

- **Tested** by clicks: Revolt, Spawn nation, Found city, Raze city, H-bomb on Paris, A-bomb on London, the phone.
- **Evidence:** `critic/c11_q_6421.json`, `critic/shots/c11q_6421_*`, `critic/c11_a_4219.json`, `critic/shots/c11a_*`.
- **Works:** each act is told in the ticker ("Free Silesian Voivodeship was set up on land of Poland", "Prague in
  Czechoslovakia was razed"). Seven tools fit the phone.
- **Weak:** the stale tooltip over the razed Prague. The revolt in Bavaria is told only as "Germany declared war on Free
  Saxony", not as a revolt.
- **AoC does better:** Edit Terrain, Spawn Major Battle, Kill (notes lines 260, 449).

### Editor and scenarios: 7 (unchanged)

- **Tested:** fleets placed in the North Sea for Germany and Britain; a fleet on Berlin (refused: "no water of a sea is
  near the place"); a bomber group and 10 warheads for Poland (9437) and Czechoslovakia (5309); export, title
  Cancel/Start, play.
- **Evidence:** `critic/c11_g_4877.json`, `critic/c11_g2_9437_POL.json`, `critic/c11_g2_5309_CZS.json`,
  `critic/shots/c11g_4877_20_northsea_day3_300m.png`.
- **Better:** the editor names a holder's means of delivery; play tells when they are lost.
- **Weak:** the two navies placed face to face in the North Sea fight no battle in 30 days (`marks[].sea` 0; run 10
  saw 1 at day 3). The title's Cancel and file input are still browser-default controls.

### Stats and history: 7 (unchanged)

- **Tested:** the history's filter over 3 late years (2,535 rows); the nuclear charts; the nation panel.
- **Evidence:** `critic/c11_l_4877.json`, `critic/shots/c11a_4219_33_chart_*.png`, `critic/c11_t_1129.json`.
- **New and working:** "New nuclear power" rows (6 in 3 years); the nation panel's line on why a holder at war does not
  strike ("Soviet Union is deterred by Germany: a nuclear strike would bring its answer in kind",
  `c11t_1129_r0_n10.png`).
- **Weak:** "Air raids" are 587 of 2,535 rows (23 %). The restraint line can name a deterrent that is itself a puppet
  (Germany, whose own line reads "is a puppet: the use of its warheads is its overlord's"), which reads as a
  contradiction.

### UI/UX and polish: 7 (unchanged)

- **Evidence:** `critic/c11_s_6421.json`, `critic/c11_h_1307.json`, `critic/shots/c11g_4877_10_title_pending.png`,
  `critic/shots/c11f_1129_14_alert.png`.
- The nuclear alert, Go to and the restraint lines work. The stale tooltip (fifth run) and the unstyled title controls
  remain.

### Performance: 7 (unchanged)

- **Tested:** seed 99 × 5 years, pinned, alone, twice; the page at Max for 3 years from a 1957 save (4877); the Random
  world.
- **Evidence:** `critic/c11_perf_seed99_5y_solo.log`, `critic/c11_perf_seed99_5y_solo2.log`, `critic/c11_l_4877.json`,
  `critic/c11_r_random.json`.
- **Better on the same measure:** 1.388 / 1.409 ms mean (run 10: 1.67 / 1.69; budget 1.5); part of it is fewer
  formations (610 at year 5, was 823). Page: 21–24 s a late year at 59.4–60 fps; longest gap 281 ms, none over 500.
  Random world: 60 nations, boot 2.5 s, a year in 17 s.
- **Why still 7:** AoC's performance is known from text only; I have nothing to show WarSim better.

### Stability: 7 (unchanged)

- **Evidence:** `critic/c11_h_1307.json` (3/3 hashes equal, twin equal), the 1129 replay hash, `errors` and `fatal`
  empty in every `critic/c11_*.json` except my own script's click timeout in `c11_o_6421.json`.
- No crash, desync or console error in any session.

### Semantic zoom to unit level: 8 (unchanged)

- **Tested:** Germany–Poland at 3,000 to 10 m/px live (7019); a continuous wheel zoom (5861).
- **Evidence:** `critic/c11_c_7019.json`, `critic/shots/c11c_7019_inf_0025m.png`, `c11c_7019_inf_0010m.png`,
  `c11z_5861_sheet.png`.
- **Why 8:** men in ranks with tracers and a contact line at 25 m/px, a pointer to the enemy off frame, and now
  aircraft over the front at T3. Nothing like it exists in AoC (its units are a cosmetic line of sprites, notes lines
  398, 411).
- **What keeps it from more (R11-B1):** after year 1 there is almost nothing to zoom into. On a year-21 save the page
  finds 0 engaged formations to look at (`critic/c11_u_6421.json`). Aircraft at 10 m/px are the size of a squad.

### Naval warfare: 7 (up from 6)

- **Tested:** 24 × 30 years of sea battles; Germany–UK sea rows clicked (2081); Japan–USA 20 days (8693); a year-21
  Italy–UK battle from a save (6421); a sea row at 150/40/15 m/px (3613).
- **Evidence:** `critic/c11_cmp.json`, `critic/c11_n_2081_GER_ENG.json`, `critic/c11_n_8693_JAP_USA.json`,
  `critic/c11_o_6421.json`, `critic/shots/c11n_2081_GER_ENG_3_20m.png`, `c11e_3613_sea_00_row_clicked.png`,
  `c11e_3613_sea_1_0040m.png`, `c11o_6421_00b_battle_area_1500m.png`.
- **Why up (same seeds, both commits):** the sea war now runs all 30 years: 13.17 battles a world-year after year 1
  (2.68 on `bcbc99c`); the late battles are between the great navies (Japan–USSR 178, Germany–UK 133, Japan–UK 124 in
  the logs), 0.6 % sink nothing.
- **Why not 8:**
  - 9 of 9 Japan–USA battles and 7 of 11 Germany–UK battles have no ticker row: the player cannot find them.
  - A late battle is two single destroyer flotillas, two overlapping counters at 1,500 m/px (`c11o_6421_*`); the row
    is gone within days.
  - At 20–40 m/px the enemy side reads as dark ovals (wrecks and submerged boats) beside red British silhouettes.
- **AoC has no navy.**

### Tanks: 8 (unchanged)

- **Tested:** Armoured division 41 against French infantry at 25 m/px (x1, x2) and 80 m/px (3613); armour at every
  tier (7019).
- **Evidence:** `critic/c11_e_3613.json` (`wreckWatch`), `critic/shots/c11e_3613_arm_lvl0_25m_4.png`,
  `c11c_7019_arm_0010m.png`.
- **Why 8:** German tank ranks against French blocks with tracers and a contact line; burnt hulls rise to 9 shown at x1
  and 18 at x2 (`hullsShown`). Nothing comparable in AoC.
- **Remaining:** hulls leave the view within seconds once the fight moves (`c11e_3613_arm_lvl0_25m_8.png` is empty
  grass); and tanks fight almost only in year 1 (R11-B1).

### Aircraft: 7 (up from 6)

- **Tested:** sorties per tier (7019); the air map on day 10 (8217); air battles per year on 24 worlds.
- **Evidence:** `critic/c11_c_7019.json`, `critic/shots/c11c_7019_inf_0010m.png`, `critic/shots/c11h_8217_air_hover.png`,
  `critic/c11_h_1307.json` (`airHolders`, `hovers`), `critic/c11_cmp.json`.
- **Why up (same cases, both builds):** 0 → 1–3 sorties drawn at 25 and 10 m/px over the 7019 front; the 8217 air map
  splits Europe into fronts (Germany 2 zones, its own and Poland's; Czechoslovakia, Italy, France their own; Kiev "no
  one flies there") where run 10 had one German zone from London to Kiev.
- **Why not 8:** the late air war is unchanged: 3,160 air battles in year 1, 120 a year after (122 on `bcbc99c`); mean
  sorties aloft after year 1 8.1. The aircraft drawn at T3 are three white glyphs the size of a squad, not in a nation
  colour.
- **AoC has no air war.**

### AI nuclear use: 7 (unchanged)

- **Tested:** 24 × 30 years, 188 bursts with utility and toll; the 1954 Soviet–British exchange of 1129 in the page
  from a year-17 save (13 alerts, Go to, ruins); the restraint panel on 1129 and 6151; Poland and Czechoslovakia armed
  in the editor.
- **Evidence:** `critic/c11_cmp.json`, `critic/c11_summary_all.txt`, `critic/c11_f_1129.json`,
  `critic/shots/c11f_1129_14_alert.png`, `c11f_1129_14_goto.png`, `c11f_1129_11_goto.png`, `critic/c11_t_1129.json`,
  `critic/c11_t_6151.json`.
- **Better (verified on the same seeds):** no burst under 0.1 that kills half a million civilians on run 10's 14 seeds
  (was 7). The panel says why a holder holds back (puppet, deterred, paused, out of range, not desperate, no threat);
  the game says when means are lost and when a nation goes nuclear.
- **Why not 8 (R11-B2):**
  - New seed 1129: "Soviet Union struck United Kingdom with a hydrogen bomb near Greenock: 1,071,000 civilians killed;
    34,514 men" at utility 0.026, the floor, with a hydrogen bomb against three counters of 1.3k–7.5k men in view. This is exactly the bar
    PLAN 7.38 ticked as met on 10 unseen seeds.
  - Seed 2081: Germany strikes one spot [1219.5, 421.5] three times in 184 days (hydrogen, hydrogen, atomic) for 5,179,
    3,879 and 4,090 men, at utilities 0.48–0.54.
- **Reads (not bars):** bursts on the same 14 seeds 58 → 93, concentrated in 7 worlds (was 11). 1129 has 46 bursts and
  11.7 M dead; 4877 44 bursts and 6.9 M. 29 of 93 bursts kill over ten times more civilians than soldiers.
- **AoC's nukes are God-only** (notes lines 414–418).

## Blocking issues, in priority order

1. **R11-B1. After year 1 the land war has no battles: armies stand in piles at home while land changes hands without
   contact.**
   - **The numbers:** engaged land formations, worldwide, mean of 8 daily samples: years 10 and 20 on 24 worlds 0.3–0.7
     (of about 300 belonging to nations at war). Year 1 of 6421: 55–107 every 15 days. Seed 6421 year 21: 0 at every
     one of 25 fortnightly samples with 7–9 wars running and 309–7,179 cells flipping per fortnight; 2081 and 9437:
     0–4.
   - **The piles (at war):** United Kingdom 85 of 160 divisions (953,109 men) at London (7019, year 10); 61 at London
     (6151); Soviet Union 53 in one place (5309); Italy 46 of 55 (8011); Japan 33 of 35 (8167). Seed 1129: 60 British
     divisions (740,840 men) stand still at Wick for the whole month before the Soviet strike that kills 665,160 of them
     (`c11f_1129_11_goto.png`: a "×60 75.5k" counter on the Caithness coast). SPEC gives the AI amphibious invasions
     ("Amphibious invasion"; "Invasions", PLAN 4.6b), so this is an execution failure, not an uncovered gap. The Germany–Soviet war of 6421 has a
     4,795-edge land border and still no contact, so it is not only an overseas problem.
   - **What a player sees:** wars in the chips, land changing colour in ribbons, and nothing to zoom into. The tanks,
     the men in ranks and the aircraft at T3 are a year-1 show. The late air war (120 battles a year against 3,160) is
     the same fact seen from the air.
   - **Both commits:** `bcbc99c` gives 1.1 and 0.3 engaged at years 10 and 20 on the same seeds, and the same capital
     piles (`c11_stacks_c10_y10.json`). Newly measured, not a regression; it moves no score. It is the read ADR-577
     asked of this report.
   - **Evidence:** `critic/c11_engaged_head.json`, `critic/c11_engaged_c10.json`, `critic/c11_engaged_year21.log`,
     `critic/c11_engaged_y1_6421.log`, `critic/c11_stacks_y10.json`, `critic/c11_stacks_c10_y10.json`,
     `critic/c11_wick_1129.json`, `critic/c11_u_6421.json`, `critic/shots/c11f_1129_11_goto.png`,
     `critic/shots/c11v_6421_ger_sov_6000m.png`.
   - **Fix:** make a nation at war send its standing armies to its fronts and over the sea to its enemies (the
     invasion AI with the idle piles as its pool), so that contact after year 1 is in proportion to the wars running.
     Measure engaged formations per war per year after year 1 against year 1, on unseen seeds.
2. **R11-B2. The AI still H-bombs a city of a million at the utility floor, and spends warheads on the same few
   thousand men again and again; PLAN 7.38's bar fails on an unseen seed.**
   - Seed 1129, 14 March 1954: Soviet Union on Greenock, hydrogen bomb, 1,105,514 dead (1,071,000 civilians, 34,514
     men), utility 0.026. PLAN 7.38's AT: "no burst with a utility under 0.1 that kills a million", reported met on 10
     unseen seeds.
   - Seed 2081, years 27–28: Germany strikes [1219.5, 421.5] three times in 184 days for 5,179, 3,879 and 4,090 men.
   - **Evidence:** `critic/c11_headless_1129.json`, `critic/c11_f_1129.json`, `critic/shots/c11f_1129_14_alert.png`,
     `critic/shots/c11f_1129_14_goto.png`, `critic/c11_headless_2081.json`, `critic/c11_cmp.json`.
   - **Fix:** weigh the dead so that a floor-value strike cannot pay for a city (DEAD_COST 0.1 a million lets 0.13 of
     value buy a million dead); choose fission where the target is a few divisions; extend ADR-569's "no restrike
     without new value" to a spot struck within the war's last year. Measure on seeds the rule was not tuned on.

## Non-blocking issues

- **Shredded late maps** (both commits): Soviet land in 94–287 pieces at year 20; straight-edged ribbons in year 21 of
  6421 (`c11v_6421_ger_sov_6000m.png`, `c11_frag_head.json`, `c11_frag_c10.json`).
- **Stale map tooltip**, fifth run (`c11_s_6421.json`).
- **Sea battles without a ticker row:** 9 of 9 Japan–USA (8693), 7 of 11 (2081).
- **Editor fleets face to face fight nothing in 30 days** (`c11_g_4877.json`).
- **Restraint line names a puppet as the deterrent** (`c11_t_1129.json`).
- **Air-raid rows 23 % of the history** (`c11_l_4877.json`).
- **Aircraft at T3 are white glyphs the size of a squad** (`c11c_7019_inf_0010m.png`).
- **The title's Cancel button and file input are unstyled** (`c11g_4877_10_title_pending.png`).
- **A God revolt is told as "Germany declared war on Free Saxony", not as a revolt** (`c11_q_6421.json`).
- **Glasgow's marker untouched beside the Greenock ruin** (`c11f_1129_14_goto.png`).

## Design objections (none blocking, no score lowered)

- **Cities as nuclear targets with no soldiers in them.** SPEC §6.4 makes a city a target and the user decided there is
  no bar on the civilians' share (PLAN 7.38). The editor-armed Poland still bombs Berlin (334,000 civilians, 379 men),
  Rome (172,000, 90) and Prague (134,000, 390) in its first 60 days, identical to run 10. With DEAD_COST at 0.1 a
  million, the weight of the dead is too small to change any of them. I think a player will read these as atrocities
  without a reason, and that the weight should be larger; that is the user's call.
- **The volume of nuclear war.** 46 bursts in 13 years on 1129 is a full exchange every few months. Within the design,
  but it makes the nuclear taboo look thin.

## Strengths, verified

- **The sea war now lasts the whole game** on the same seeds: 2.68 → 13.17 battles a world-year after year 1
  (`c11_cmp.json`).
- **Determinism:** browser equals headless year by year; a year-10 save replayed headless to year 16 lands on the
  batch's hash (`c11_h_1307.json`, `c11_ck.ts`).

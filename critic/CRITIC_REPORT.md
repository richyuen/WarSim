# Critic report, run 9

- Commit: `f0be88cf49ef5d75802abfb5cb8bf8941a7f029a` (PLAN 7.18 to 7.28 done since run 8; 7.29 and 7.30 open).
- Date: 2026-10-19. Build: `npm run build`, exit 0 (`critic/c9_build.log`). Served with `vite preview` on port 5299.
- Machine: the user's Windows machine; Chromium through Playwright, headless, 1600 × 900 unless stated.
- Every path below was made in this run (prefix `c9`). Scripts: `critic/scripts/c9_*`.
- Seeds, all new to this repo: 1129, 1471, 2251, 2609, 3407, 3793, 4483, 4957, 5527, 6113, 6653, 7741, 8821, 9901.
  The builder's own regression cases (5591, 6047, 3929, 4711) were used only to check that run 8's blockers were fixed.
- The 14 headless 30-year worlds (`critic/scripts/c9_batch.sh`) ran side by side. Their `maxMs` figures (390 to 762 ms)
  are therefore contended, not timings. The pinned tick figures were taken alone, after every browser and server
  of mine had stopped.
- Reference: `reference/text/AOC_TEXT_NOTES.md` (cited by line) and `reference/screens/steam-screenshot-*.jpg`.
  AoC's nukes, God tools and performance are known only from text, so confidence is lower there.
  A new fact since run 8: AoC v4.5.0 (2026-07-20) added unit visuals. They are a line of sprites along the fronts,
  "purely visual, with no health or stats" (notes line 411; "no unit movement layer", line 398).
- Method artefacts, not findings:
  - Two of my scripts stalled because a strike pauses the game by default (the setting, as in run 8): `c9_g_5527`
    at day 30 and `c9_i_3407` at day 30. I replaced both with `c9_g2_*`, which resumes the game after each alert.
  - `c9_f_4483` stopped after its third alert, because of the same script bug.
  - The alert still up 10 days after a God bomb (`c9a_9901_20_*`) came from stepping a paused game. The alert stays
    up while the game is paused by design.

## Verdict

All three of run 8's blockers are fixed, and the AI's nuclear use has moved a long way:

- A hydrogen bomb kills 11 to 17 times as many as an atomic one.
- A sea battle's ticker row now lands on both fleets firing.
- 11 of 14 unaided worlds see a burst, 10 of them before year 20.
- Holders armed in the editor strike: Poland and France both did.

Two things still keep the differentiators below 8:

1. **Most late-game sea battles are phantoms.** In the late game, 95 % of sea battles sink nothing. A battle with no
   row and no fire writes "X and Y fought at sea: X lost 0 ships, Y 0" to the history every day for months. On one
   seed the same Mongolia–Japan pair does this 524 times in ten years.
2. **AI strikes still fall where nothing is.** A weekly chain of bombs follows a retreating army across empty
   steppe: 10,847, then 1,373, then 168, then 24 dead. Utilities stay above the floor, and the player is told only
   the civilian toll.

## Scores

| Dimension | Run 8 | Run 9 |
|---|---|---|
| Map visuals and readability | 7 | 7 |
| Diplomacy, war, alliance, puppet, revolt depth | 7 | 7 |
| Emergent world dynamics over long runs | 7 | 7 |
| God Mode | 7 | 7 |
| Editor and scenarios | 7 | 7 |
| Stats and history | 7 | 6 |
| UI/UX and polish | 7 | 7 |
| Performance | 7 | 7 |
| Stability | 7 | 7 |
| Semantic zoom to unit level (needs 8) | 7 | 7 |
| Naval warfare (needs 8) | 6 | 6 |
| Tanks (needs 8) | 7 | 8 |
| Aircraft (needs 8) | 6 | 6 |
| AI nuclear use (needs 8) | 6 | 7 |

## What happened to the run 8 blockers

| Run 8 id | Now | Evidence |
|---|---|---|
| R8-B1: AI nuclear use unseen in half the games; holders armed in the editor never strike | **Mostly fixed.** Bursts in 11 of 14 unseen worlds (138 bursts), 10 of 14 before year 20. Poland, given a bomber at Warsaw and 10 warheads, strikes Berlin on day 52 (334,362 dead). France strikes Berlin on day 43. Credibility is what remains (R9-B2) | `critic/c9_headless_*.json`, `critic/c9_g2_5527_POL.json`, `critic/c9_g2_3407_FRA.json` |
| R8-B2: the sea row landed on dry land | **Fixed.** Rows on seeds 5591 and 2251 land on water, with ships of both sides on screen and 19 to 24 shots drawn within 1 s at Speed x1 | `critic/c9_j2_5591.json`, `critic/c9_n_2251_ITA_ENG.json`, `critic/shots/c9n_2251_ITA_ENG_1_live.png` |
| R8-B3: the hydrogen bomb was cosmetic | **Fixed.** Atomic against hydrogen: Paris 192,827 against 3,203,070; London 250,186 against 4,913,410; Berlin 350,202 against 5,300,524; Moscow 62,530 against 1,009,562. The ruins are clearly different at 300 m/px | `critic/c9_b_4711.json`, `critic/shots/c9b_berlin_A_300m.png`, `c9b_berlin_H_300m.png` |

## Dimensions

### Map visuals and readability: 7

- **Tested:**
  - The 1938 boot.
  - Europe at 6,000 to 3 m/px in one continuous wheel zoom on a live front.
  - Bomb ruins at 600, 300 and 200 m/px.
  - A 1958 world loaded from a headless save.
  - The Random world.
- **Evidence:** `critic/shots/c9z_6113_sheet.png`, `c9z_6113_06_07_pair.png`, `c9b_berlin_H_300m.png`,
  `c9f_2609_11_alert.png`, `c9f_2609_11_ruin_200m.png`, `c9r_02_year1.png`, `c9a_9901_20_paris_600m_day10.png`.
- **Good:**
  - A London H-bomb ruin at 200 m/px is a wide scorched disc with rubble.
  - At 2,500 m/px a struck city shows a mushroom mark.
  - The 1958 world reads as named blocks with flags.
- **Problems:**
  - One wheel notch between 412 and 264 m/px cuts from flat political fill with counters to terrain with soft border
    bands and name labels (`c9z_6113_06_07_pair.png`). It is a hard switch, not a blend.
  - Stale tooltip, still (see UI).
- **AoC does better:** its map is one consistent flat style at every zoom (`reference/screens/steam-screenshot-00.jpg`).
  Nothing measured beyond that.

### Diplomacy, war, alliance, puppet, revolt depth: 7

- **Tested:** 14 unaided 30-year worlds; God wars; the history of two late browser games.
- **Evidence:** `critic/c9_headless_*.json` (`wars`, `ev`), `critic/c9_l_7741.json` (`historyTypes`).
- **Works:**
  - In years 21 to 30, 11 of 14 seeds have 2 to 11 wars at every year's end.
  - Over 3 late years of seed 7741: 271 declarations, 257 peaces, 117 alliances joined, 47 puppets made, 32 released,
    80 revolts and 14 nations revived.
- **Weak:**
  - Seeds 2251, 5527 and 8821 are quiet late: 0 to 4 wars, with years of 0.
  - Wars balloon into blocs. Italy declaring on Britain becomes "Italy +5 × United Kingdom +29" on day 1
    (`c9n_2251_ITA_ENG_1_live.png`).
- **AoC does better:** nothing measured (AoC's rules are known from text only, notes lines 254 to 346).

### Emergent world dynamics over long runs: 7

- **Tested:** 14 seeds × 30 years headless.
- **Evidence:** `critic/c9_headless_*.json`, `critic/scripts/c9_summ.py`.
- **Good:**
  - No stasis within the 30-year horizon. The longest unchanged top five lasts 8 to 18 years, against 7.27's
    criterion of 20 or more over 50 years.
  - In the last 5 years, 2.8 to 26.6 % of the land changes hands.
  - 68 to 87 nations are alive at year 30, 4 to 12 of them founded in play.
- **Weak (non-blocking):**
  - The United States and the Soviet Union are in the top five of all 14 worlds at year 30.
  - The Soviet Union ends at 30.9 to 33.1 % on 3 seeds, against the 35 % cap.
  - Seeds 2251, 5527 and 8821 hold 145 to 160 warheads in 4 to 6 nations unused for 30 years, with 2.8 to 9 %
    of the land moving late.
- **AoC does better:** "the world can continue to change for thousands of years" (notes line 230). Not testable here.

### God Mode: 7

- **Tested** by clicks: the tool row; Revolt (Saxony); Spawn nation (east of Berlin, 5 provinces); Found city;
  Raze city (Prague); Nuke at both sizes (Paris, London); the phone at 390 × 844.
- **Evidence:** `critic/c9_q_6653.json`, `critic/shots/c9q_6653_*`, `critic/c9_a_9901.json` (`phone`),
  `critic/shots/c9a_9901_02_godmode_on.png`.
- **Fixed since run 8:**
  - The bomb sizes now differ in toll and ruin.
  - On the phone all seven tools fit inside 390 px.
- **Works:**
  - The revolt makes "Free Saxony" and a war.
  - The spawned nation appears.
  - "New Town" is founded.
  - Prague's label is gone after the raze.
- **Weak:**
  - Spawn nation, Found city and Raze city leave no ticker or history row.
  - After the raze, the tooltip still reads "Prague · capital" (`c9q_6653_raze_prague_1day.png`).
- **AoC does better:** it has a wider set: Edit Terrain, Spawn Major Battle, Kill, To Death (notes lines 260 and 449).

### Editor and scenarios: 7

- **Tested** by clicks:
  - Four fleets in the North Sea.
  - A Polish strategic bomber group at Warsaw.
  - 10 warheads for Poland, France and Czechoslovakia.
  - A scenario exported and chosen on the title (Cancel, then Start).
  - Germany attacking each armed holder for 120 to 150 days.
  - The title's Random world started, with a year played.
- **Evidence:** `critic/c9_g_5527.json`, `critic/c9_g2_5527_POL.json`, `critic/c9_g2_3407_FRA.json`,
  `critic/c9_g2_1471_CZS.json`, `critic/c9_g2_2251_CZS.json`, `critic/c9_g2_3793_CZS.json`,
  `critic/shots/c9g_5527_10_title_pending.png`, `critic/c9_r_random.json`, `critic/shots/c9r_02_year1.png`.
- **Fixed since run 8:**
  - The bomber group at Warsaw is placed.
  - Poland strikes Berlin on day 52 (334,362 dead), then Moscow and Messina.
  - France strikes Berlin on day 43 (334,060).
- **Weak:**
  - Czechoslovakia, given a strategic bomber group at Prague and 10 warheads, never strikes on three seeds. Its 6 wings
    are gone by day 10, and on 1471 it dies holding all 10. The editor said only "Czechoslovakia has 10 warheads". It
    gave no warning that the bombers are its only means, nor any word in play when they were lost. I did not trace what
    destroyed the wings.
  - The Cancel button on the title's file card is an unstyled white browser button (`c9g_5527_10_title_pending.png`).
- **AoC does better:** its scenario editor has terrain and flag painting (notes lines 42, 84 and 498). In scope it is
  matched, not beaten.

### Stats and history: 6 (down from 7)

- **Tested:**
  - The history of two late browser games, counted by type through its filter.
  - The nuclear charts.
  - France's panel.
- **Evidence:** `critic/c9_l_7741.json` (`historyTypes`), `critic/shots/c9l_7741_4_history.png`,
  `critic/shots/c9f_2609_83_history.png`, `critic/c9_sea_2609_y21.json`, `critic/c9_a_9901.json` (`francePanel`,
  `chartOptions`).
- **Fixed since run 8:** the history tells a decision in words ("after long hesitation"), not as a utility.
- **Why down:** the log is flooded with non-events.
  - On seed 2609 in October 1958 every visible row is "Norway and United Kingdom fought at sea: Norway lost 0 ships,
    United Kingdom 0", or the same for Sweden, twice a day (`c9f_2609_83_history.png`). See R9-B1.
  - On seed 7741, 1,937 of 4,681 rows (41 %) are "X's submarines raided the convoys of Y". These rows have no
    figure in them.
- **AoC does better:** nothing measured (AoC's Statistics panel, `steam-screenshot-01.jpg`).

### UI/UX and polish: 7

- **Tested:**
  - The tooltip after a wheel zoom and after a camera jump, with the mouse still.
  - The phone with God Mode on.
  - The title's language list.
- **Evidence:** `critic/c9_h_1129.json` (`tip0`, `tip1`), `critic/shots/c9h_1129_01_tip_after_wheel_out.png`,
  `critic/shots/c9a_9901_20_paris_600m_day10.png`, `critic/c9_a_9901.json`.
- **Fixed:** the phone's God tool labels.
- **Still broken (third run running): the stale tooltip.**
  - Hovering London and wheeling out to 24,738 m/px leaves "London · capital, United Kingdom" over West Africa.
  - After a camera jump to Paris the tooltip reads "London … Unrest 40" over the Paris ruin.
- **AoC does better:** its UI is simpler. Nothing measured.

### Performance: 7

- **Tested:**
  - Seed 99 for 5 years, pinned and alone.
  - Seed 7741 years 21 to 25 from my year-20 save, pinned, alone, `--profile`.
  - The browser at Max for 3 years from 1958 (seed 7741).
  - The Random world for a year.
- **Evidence:** `critic/c9_perf_seed99_5y_solo.log`, `critic/c9_perf_7741_y21_25_solo.log`,
  `critic/c9_l_7741.json`, `critic/c9_r_random.json`.
- **Seed 99:**
  - Year 1 is 2.10 ms (budget 2.4).
  - The 5-year mean is 1.55 ms, just over the 1.5 ms budget (run 8: 1.35).
  - A contended first try read 1.89 ms (`critic/c9_perf_seed99_5y.log`), so these numbers are noisy.
- **Late game:**
  - Mean tick 1.80 to 2.41 ms.
  - The longest single call is 192 ms (`operationalAi`, years 21 to 25).
- **Browser at Max:** 18 to 24 s per year at 59 to 60 fps. The longest gap between ticks is 321 ms, and there is none
  over 500 ms.
- **Random world:** 60 nations, boot in 2.3 s, a year in 14.6 s.
- **AoC does better:** unknown (text only). At parity on the evidence. The budget is now marginally missed.

### Stability: 7

- **Tested:**
  - Browser against headless for 3 years (seed 1129).
  - A save/load twin.
  - Headless year-20 saves loaded in the page (2609, 7741).
  - The year-20 save continued headless for 5 years against the straight run.
  - Errors in every browser session.
- **Evidence:**
  - `critic/c9_h_1129.json`: 3 of 3 year hashes equal (3c06a1e5, 6baa4603, bc8a2ac4). The twin is equal, and the
    save is 3.87 MB.
  - `critic/c9_f_2609.json`: loaded hash 8d8b958a, the same as headless.
  - `critic/c9_l_7741.json`: 5d6198c3, the same as headless.
  - `critic/c9_perf_7741_y21_25_solo.log`: 5 of 5 yearly hashes equal `critic/c9_headless_7741.json`.
  - `errors` in every `critic/c9_*.json`: none.
- **Why 7:** no crash, desync or error. I have nothing that shows AoC less stable.

### Semantic zoom to unit level: 7 (needs 8)

- **Tested:** Germany on Poland and France (seeds 4483 and 6113): infantry and armour at 3,000, 900, 250, 80, 25 and
  10 m/px live, and one continuous wheel zoom from 6,000 to 3 m/px.
- **Evidence:** `critic/c9_c_4483.json`, `critic/shots/c9c_4483_inf_0010m.png`, `c9c_4483_inf_0010m_top_crop2x.png`,
  `c9c_4483_arm_0900m.png`, `c9c_4483_arm_0080m.png`, `c9z_6113_sheet.png`, `c9z_6113_06_07_pair.png`,
  `c9z_6113_16.png`.
- **Better:**
  - At 4.8 m/px men and guns are individual figures.
  - Contact lines and tracers show from 250 to 10 m/px.
- **Short of 8:**
  - The T1 to T2 switch is a hard cut (see Map).
  - At 900 m/px the screen still shows only counters, although `elementCount` is 3,536.
  - At 10 m/px on German infantry division 11 the enemy is off screen. The screen is all grey German figures, with
    tanks overlapping in piles (`c9c_4483_inf_0010m_top_crop2x.png`).
- **AoC:** v4.5.0 has cosmetic front sprites (notes line 411). WarSim's zoom goes far deeper, but the seams are visible.

### Naval warfare: 6 (needs 8)

- **Tested:**
  - Sea-battle rows clicked on seeds 5591 (Germany–UK) and 2251 (Italy–UK), each watched 4 s at x1 and at 20 m/px.
  - Japan–USA for 12 days (seed 3407).
  - Every sea battle of seed 2609 year 21 and of seed 6113 years 21 to 30, tallied by ships lost.
  - The zero-loss battle viewed in the page.
- **Evidence:** `critic/c9_n_2251_ITA_ENG.json`, `critic/c9_n_3407_JAP_USA.json`, `critic/c9_j2_5591.json`,
  `critic/c9_sea_2609_y21.json`, `critic/c9_sea_6113_y21_30.json`, `critic/c9_o_2609.json`,
  `critic/shots/c9n_2251_ITA_ENG_1_live.png`, `c9n_2251_ships_20m_crop4x.png`, `c9o_2609_00b_battle_area_1500m.png`,
  `c9f_2609_83_history.png`.
- **Fixed:** the row frames two fleets firing on water.
- **Bad:**
  - **R9-B1, phantom sea battles.**
  - The war at sea is mostly invisible from the ticker:
    - Italy–UK: 25 six-hour samples with a live Italy–UK battle on days 6 to 12, none with a row.
    - Japan–USA: no battle at all in 12 days.
    - After year 1, sea battles average 13 per world-year, against 36 in year 1.
  - At 20 m/px at 1×, destroyers are about 10 × 3 px and submarines about 5 px (`c9n_2251_ships_20m_crop4x.png`).
- **AoC has no navy.** To reach 8, the battles a player is told about must be real fights.

### Tanks: 8 (needs 8)

- **Tested:** armoured division 41 against French infantry (seed 6653), watched 45 s at x1 and x2 at 25 m/px and at 80
  m/px; armour at every tier (seed 4483).
- **Evidence:** `critic/c9_e_6653.json` (`wreckWatch`), `critic/shots/c9e_6653_arm_lvl0_25m_4.png`,
  `c9e_6653_arm_25m_4_crop3x.png`, `c9c_4483_inf_0010m_top_crop2x.png`, `c9c_4483_arm_0080m.png`.
- **Fixed since run 8:**
  - `hullsShown` (tanks alone) rises from 0 to 7 in 35 s at x1 on a live fight.
  - Dark burnt hulls with fires show among the grey German tank pills facing the blue French blocks, with tracers
    and a contact line (`c9e_6653_arm_25m_4_crop3x.png`).
  - At 10 m/px tanks are turreted hulls in ranks.
- **Why 8:** a watched armour battle now reads as tanks fighting and dying. AoC has no tanks; its units are cosmetic
  sprites (notes lines 398 and 411).
- **Remaining:**
  - `wrecks.count` stays 0.
  - Tanks overlap in piles at 10 m/px.
  - Hulls are gone from the count within about 15 s of wall time at x2 once the division moves on. I did not check the
    hold's length.

### Aircraft: 6 (needs 8)

- **Tested:**
  - Sorties drawn per tier on day 4 (seed 4483).
  - The air mode over Poland on day 10 (seed 8217).
  - 14 headless worlds' sorties and air battles per year.
- **Evidence:** `critic/c9_c_4483.json` (`sorties`), `critic/shots/c9c_4483_arm_0080m.png`, `c9h_8217_air_hover.png`,
  `critic/c9_h_1129.json` (`airHolders`), `critic/c9_headless_*.json`.
- **Better:**
  - 44 sorties drawn at 3,000 m/px, 4 to 8 at 250 to 80 m/px.
  - Plane silhouettes in flights over the front.
- **Bad:**
  - The air war still collapses after year 1. Air battles fall from 925 to 4,302 in year 1 to a mean of 47 to 147 a
    year in years 2 to 30. Mean sorties aloft fall from 36 to 63 to 6 to 15. On 3 seeds most later years have under 5
    aloft (8821: 18 of 29).
  - At 25 and 10 m/px, 0 sorties are drawn in every probe.
  - The air map on day 10 of Germany–Poland hatches one German zone over all of Europe, from London and Paris to Kiev
    and Stockholm. Every hover reads "held by Germany" (`c9h_8217_air_hover.png`).
- **AoC has no air war.**

### AI nuclear use: 7 (needs 8)

- **Tested:**
  - 14 unaided 30-year worlds (`nukeLog`).
  - Two AI exchanges watched in the page from year-20 saves (2609 and 4483): the alert, Go to, the ruin at 200 m/px,
    the chart and the history.
  - Editor-armed Poland, France and Czechoslovakia.
- **Evidence:** `critic/c9_headless_*.json`, `critic/scripts/c9_nukes.py`, `critic/c9_f_2609.json`,
  `critic/c9_f_4483.json`, `critic/shots/c9f_2609_11_alert.png`, `c9f_2609_11_ruin_200m.png`,
  `c9f_4483_13_alert.png`, `critic/c9_g2_*.json`.
- **Better (verified):**
  - Bursts in 11 of 14 worlds (138 in all). First bursts in years 8.7 to 19.8 on 10 seeds, and only in year 29 on
    one (6653).
  - Exchanges are answered within a day: Germany on Cuba and the United States on Berlin (5,495,787 dead), and the
    Soviet Union and Germany on 6113.
  - The page tells it well: alert, Go to, a 200 m/px ruin, the history in words.
- **Short of 8:**
  - **R9-B2**: weekly chains of strikes on near-empty ground, told with the civilian toll alone.
  - Single bombs on small states: Nepal (1,656,090 dead, 2609), Afghanistan (3,328,000, 2609), Sweden (1,050,000,
    1129).
  - Germany strikes the same Canadian point 90 days apart for 5,620 and then 439 dead (4483, utility 0.98). This is
    allowed by `RESTRIKE_DAYS` = 7 for places that are not capitals (`src/sim/systems/nuclear.ts:943`).
  - 3 of 14 worlds never see a burst, while 4 to 6 nations hold 145 to 160 warheads.
- **AoC's nukes are God-only** (notes lines 414 to 418). The AI side is WarSim's own, so it must be believed.

## Blocking issues, in priority order

1. **R9-B1. Phantom sea battles flood the history.**
   - **What happens:** a "battle" in which nothing can fire, with no row and no fire drawn, writes "X and Y fought at
     sea: X lost 0 ships, Y 0" to the log every day, for months.
   - **Seed 2609, year 21:** 288 of 294 sea battles lose no ship. 145 of them are Norway or Sweden against the
     United Kingdom at one point over 144 days.
   - **Seed 6113, years 21 to 30:** 687 of 722 battles lose no ship. Mongolia against Japan accounts for 524 of them
     at one point over about 5 years, and Germany against the UK for 148.
   - **In the page** (`c9_o_2609.json`, `c9o_2609_00b_battle_area_1500m.png`):
     - The battle's circle holds one 720-man Norwegian transport group in Oslofjord and 22 British fleets stacked on
       one cell in the Skagerrak, 17 cells away.
     - `pair` is null, and the British never close.
     - This contradicts PLAN 7.19a ("a fleet out of reach of every enemy fleet of its battle closes on the nearest it
       can hit").
   - **What the player sees:** the history is wall-to-wall "lost 0 ships" (`c9f_2609_83_history.png`).
   - Evidence: `critic/c9_sea_2609_y21.json`, `critic/c9_sea_6113_y21_30.json`, `critic/c9_o_2609.json`,
     `critic/shots/c9o_2609_00b_battle_area_1500m.png`, `critic/shots/c9f_2609_83_history.png`.
   - **Fix:** either the fleets close and fight, or no battle exists. Do not log a battle in which no weapon could
     reach; and do not let a battle re-form daily at the same point with zero losses.
2. **R9-B2. AI nuclear strikes on empty ground, in weekly chains, told only by civilian dead.**
   - **The worst case:** seed 2609, year 15. The Soviet Union strikes China every 7 days along one line (y = 402.5),
     each strike about 7 cells west of the last:
     - 10,847 → 1,373 → 168 → 24 dead.
     - Then 10,862 → 1,334 → 120 → 1,749 → 204 → 22 dead.
     - Tibet: 10,838 → 18,190 → 120 → 24.
   - **Elsewhere:** seed 9901's Soviet Union strikes China 18 times in 2 years for about 10,000 each.
   - **These pass the floor:** utilities were 0.22 to 0.83, and 0.98 for Germany's 439-dead strike on Canada. The
     problem is not the floor; it is where the bombs fall.
   - **What the player is told:** "Soviet Union struck China with an atomic bomb near …: 24 dead". No string tells
     soldiers lost (`src/ui/i18n/en.json:593`).
   - Evidence: `critic/c9_headless_2609.json`, `critic/c9_headless_9901.json`, `critic/c9_headless_4483.json`
     (`nukeLog`), `critic/scripts/c9_nukes.py`.
   - **Fix:** do not chase a retreating army with a bomb a week. Weigh a target by what a burst there destroys,
     and refuse places where the last strike near it found almost nothing. Tell the player the men, guns and vehicles
     a strike destroyed beside the civilian dead.

## Non-blocking issues

- **Stale map tooltip**, third run running (`c9h_1129_01_tip_after_wheel_out.png`, `c9a_9901_20_paris_600m_day10.png`,
  `c9q_6653_raze_prague_1day.png`).
- **A hard cut between T1 and T2** at about 300 m/px (`c9z_6113_06_07_pair.png`).
- **The air war collapses after year 1**, about 95 % fewer air battles. One continental air zone reads "held by
  Germany" over London and Kiev (`c9h_8217_air_hover.png`).
- **No sorties drawn at 25 m/px and below** (`c9_c_4483.json`).
- **Convoy-raid rows are 41 % of the history**, with no figures in them (`c9_l_7741.json`).
- **Czechoslovakia armed in the editor dies holding 10 warheads**, its bombers lost by day 10, with no word to the
  player (`c9_g2_*_CZS.json`).
- **Most early sea battles have no row** (Italy–UK days 6 to 12); a Japan–USA war has no sea battle in 12 days.
- **Small ships are specks at T3** (`c9n_2251_ships_20m_crop4x.png`).
- **Seed 99's 5-year tick mean is 1.55 ms**, just over the 1.5 ms budget (`c9_perf_seed99_5y_solo.log`).
- **Spawn, Found and Raze leave no ticker or history row.**
- **Quiet worlds:** 2251, 5527 and 8821 have 0 to 4 wars late.
- **The title's Cancel button is unstyled.**

## Strengths, verified

- **Determinism and saves.**
  - Browser equals headless year by year.
  - Year-20 saves load in the page on the headless hash.
  - A loaded save continues headless for 5 years on the straight run's hashes (`c9_h_1129.json`, `c9_f_2609.json`,
    `c9_perf_7741_y21_25_solo.log`).
- **Run 8's three blockers were fixed and hold on seeds the builder never used.**
  - Bomb sizes: `c9_b_4711.json`.
  - Sea rows: `c9_n_2251_ITA_ENG.json`.
  - Editor-armed holders strike: `c9_g2_5527_POL.json`, `c9_g2_3407_FRA.json`.

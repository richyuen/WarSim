# Critic report, run 8

- Commit: `fd27e854ec7e6c0c3ac0bba36152c68b540d128f` (PLAN 7.6 to 7.17 done since run 7; PLAN 7.5 asks for this run).
- Date: 2026-10-17. Build: `npm run build`, exit 0 (`critic/c8_build.log`). Served with `vite preview` on port 5299.
- Machine: the user's Windows machine with its GPU; Chromium through Playwright, headless, 1600 × 900 unless stated.
  Pinned tick figures (`--affinity 0xFFFF`) were taken with nothing else of mine running. The 17 headless 30-year
  worlds ran side by side, so their `maxMs` figures are contended and not timings.
- Every path below was made in this run (prefix `c8`). Scripts: `critic/scripts/c8_*.mjs`, `c8_headless.ts`,
  `c8_batch.sh`, `c8_perf.sh`, `c8_saves.sh`, `c8_summ.py`.
- Seeds of my own: 4093, 6271, 7919, 2843, 5381, 9137, 4711, 6047, 3929, 5591, 7127. The builder's seeds 1 to 10 and
  run 7's 3371 for comparison; seed 99 for the budget and the pin only.
- Reference: there is no `reference/NOTES.md`. I used `reference/text/AOC_TEXT_NOTES.md` and the Steam screenshots.
  AoC's nukes, God tools and performance are known only from text; confidence is lower there.
- A self-inflicted false alarm: my first late-game browser run "stalled" for 20 minutes. The cause was the nuclear
  alert's pause setting (`src/app/game.tsx:147`), which stopped my unattended game at the first strike. With an
  auto-resume the same two years take 16 s each (`critic/c8_l_6271.json`). Not a finding.

## Verdict

Run 7's two blockers moved. The invasion-AI stall is gone: pinned and alone, no system call in 46 profiled years
exceeds 154 ms, and two late browser years with a nuclear exchange run at Max in 16 s at 59 to 60 fps with no stop
over 160 ms. AI nuclear use went from 4 bursts in 420 world-years to 55 in 510, and strikes are now answered.

What still stops the differentiators reaching 8:

1. **AI nuclear use is still not seen in half the games, and a player cannot provoke it.** 9 of 17 unaided worlds
   never see a burst in 30 years; only 3 of 17 see one before year 20. France and Poland, given 10 warheads each in
   the editor and overrun, never strike.
2. **Two claimed features do not do what they claim.** A sea battle's ticker row centres on dry land between two
   distant fleets (7.10b). The Nuke tool's "Hydrogen bomb" kills 3 to 11 % more than the atomic one and looks the same
   (7.16a).

## Scores

| Dimension | Run 7 | Run 8 |
|---|---|---|
| Map visuals and readability | 7 | 7 |
| Diplomacy, war, alliance, puppet, revolt depth | 6 | 7 |
| Emergent world dynamics over long runs | 6 | 7 |
| God Mode | 7 | 7 |
| Editor and scenarios | 6 | 7 |
| Stats and history | 7 | 7 |
| UI/UX and polish | 7 | 7 |
| Performance | 5 | 7 |
| Stability | 7 | 7 |
| Semantic zoom to unit level (needs 8) | 6 | 7 |
| Naval warfare (needs 8) | 5 | 6 |
| Tanks (needs 8) | 5 | 7 |
| Aircraft (needs 8) | 5 | 6 |
| AI nuclear use (needs 8) | 3 | 6 |

No score is above 7. For performance and stability I now have strong evidence of good behaviour, but nothing that
shows AoC doing worse (its side is text only), so I cannot score better than parity.

## What happened to the run 7 blockers

| Run 7 id | Now | Evidence |
|---|---|---|
| R7-B1: AI nuclear use too rare and not credible | **Improved, not fixed** (R8-B1). 8 of 17 worlds, 55 bursts; most strikes answered within a day; still none in 9 of 17 worlds, a few absurd targets | `critic/c8_headless_*.json` (`nukeLog`) |
| R7-B2: late-game stalls in the invasion AI | **Fixed.** Seed 3371 years 15 to 30 from my year-14 save, pinned: `invasionAi` 0.3 to 1.1 % of the tick, max 16.9 ms (was 86 %, 772 ms). Browser years 23 and 24 of seed 6271 at Max: 16.1 s each, 59.1 and 60 fps, longest stop 159 ms | `critic/c8_perf_3371_y15_30_solo.log`, `critic/c8_l_6271.json` |

## Dimensions

### Map visuals and readability: 7

- **Tested:** the 1938 boot; Europe at 2,500 to 30 m/px; Paris and London 10 days after God bombs at 3,000, 600, 150
  and 30 m/px; a 1962 world loaded from a headless save; two AI strikes in the browser.
- **Evidence:** `critic/shots/c8a_4711_01_boot.png`, `c8a_4711_20_paris_150m_day10.png`,
  `c8a_4711_20_london_150m_day10.png`, `c8a_4711_20_paris_600m_day10.png`, `c8l_6271_3_world_end.png`,
  `c8f_1_11_alert.png`.
- **Better than run 7:** a struck city now shows a scorched disc with rubble at 150 m/px, and a mushroom mark with a
  ring at 2,500 m/px; the 1962 world reads as large named blocks with flags.
- **Problems:**
  - At 600 m/px the Paris ruin is only a faint dark smudge behind the flag (`c8a_4711_20_paris_600m_day10.png`).
  - A hydrogen and an atomic ruin are the same size (`c8b_berlin_A_vs_H_300m.png`; R8-B3).
  - The nuke alert is still up after 10 days of play (`c8a_4711_20_*_day10.png`).
- **AoC does better:** nothing measurable; its nuke wasteland is an optional terrain change (text, lines 414 to 418).
- **Fix:** keep the ruin legible at T1 and T2; make the bomb sizes look different; let the alert expire.

### Diplomacy, war, alliance, puppet, revolt depth: 7

- **Tested:** 17 unaided 30-year worlds; God wars (Germany on Poland, Britain and France); the ticker and history
  over two nuclear exchanges.
- **Evidence:** `critic/c8_headless_*.json` (`wars`, `ev`), `critic/c8_f_1.json`, `critic/shots/c8f_1_83_history.png`.
- **Works:**
  - Late wars no longer die out. In years 21 to 30, 15 of 17 seeds have 1 to 14 wars running at every year's end (2843 and 4093 have years with 0).
    Seed 3371, frozen in run 7 (0 to 2 wars), now has 3 to 8.
  - Allies join: Poland +9 and Britain +20 to +29 on day 1 of a God war (`c8g_5591_21_northsea_day3_30m.png`).
  - Wars end around the strikes: the day after Germany's bomb on Moscow, the Soviet Union makes peace with
    Britain (`c8f_1_11_alert.png`, ticker; cause not shown).
- **Weak:** seed 4093 has 0 to 3 wars in years 21 to 30, with 0 in four of those years.
- **AoC does better:** nothing measured; AoC's peace and alliance rules are known from text only.

### Emergent world dynamics over long runs: 7

- **Tested:** 30 years headless on 17 seeds (1 to 10, 3371, 2843, 4093, 5381, 6271, 7919, 9137).
- **Evidence:** `critic/c8_headless_*.json` and `.log`; summary from `critic/scripts/c8_summ.py`.
- **Good:**
  - Land changes hands late. In the last 5 years, 16 of 17 seeds move 5.3 to 40.8 % of the land (counted in cells).
    Seed 3371 moves 17.5 %, against run 7's 0.72 %.
  - 72 to 86 nations alive at year 30, 0 to 12 of them founded in play.
  - Real risers: Germany leads on seed 7 (17.9 %), the United States leads seeds 1 and 6, and France holds Africa in
    1962 on seed 6271.
- **Bad (non-blocking):**
  - Seed 4093 moves 2.8 %.
  - On seed 2843 the Soviet Union sits at 33.8 to 36.3 % from year 8 to year 30, pressed against the 35 % land cap
    for two decades (`c8_headless_2843.json`, `top`). 5 of 17 seeds end with the Soviet Union at 31.7 to 34.1 %.
- **AoC does better:** its world changes for centuries (text); not testable here.

### God Mode: 7

- **Tested** by clicks: the God Mode button, the new tool row, the Nuke tool with both sizes on Paris and London,
  and the phone (390 × 844).
- **Evidence:** `critic/c8_a_4711.json`, `critic/c8_b_4711.json`, `critic/shots/c8a_4711_02_godmode_on.png`,
  `c8a_4711_13_paris_h_strike.png`, `c8a_phone_01_god.png`.
- **Fixed since run 7:** pressing God Mode now shows a "Map tools" row on the bottom bar: Revolt, Spawn nation,
  Breakthrough, Territory, Nuke, Found city, Raze city. The Nuke tool offers Atomic and Hydrogen, with a hint.
- **Short of AoC:**
  - The size does almost nothing (R8-B3). AoC has a nuke size setting (v4.3.5, text).
  - On the phone the tool labels are cut off: "Revo", "Breakthr", "Territo", "Found c", "Raze c"
    (`c8a_phone_01_god.png`).
- **Fix:** R8-B3; let the phone's tool row wrap or scroll.

### Editor and scenarios: 7

- **Tested** by clicks:
  - Two German and two British battle squadrons placed in the North Sea.
  - A Polish strategic bomber group placed at Warsaw.
  - 10 warheads given to Poland, then 10 to France.
  - A German fleet placed at Berlin.
  - The scenario exported; chosen on the title, cancelled, chosen again, started.
  - Germany against Poland and Britain played for 120 days, and against France for 150 days.
- **Evidence:** `critic/c8_g_5591.json`, `critic/c8_i_7127.json`, `critic/c8_critic_standoff.warsim-scenario`,
  `critic/shots/c8g_5591_01_after_places.png`, `c8g_5591_03_refusal.png`, `c8g_5591_10_title_pending.png`,
  `c8g_5591_11_title_cancelled.png`, `c8g_5591_12_loaded.png`, `c8i_7127_day150.png`.
- **Works:**
  - All four fleets were placed.
  - The fleet at Berlin is refused with "no water of a sea is near the place".
  - The title shows the file's name and date with Start and Cancel. Cancel leaves you on the title; Start loads the
    game with the same forces and warheads.
- **Weak:**
  - The Warsaw bomber group was refused ("no airbase of its with room is near the place"), so the editor could not
    give Poland a delivery means.
  - Poland held its 10 warheads while its forces fell from 49 to 0 in 120 days.
  - France, with 15 wings, held its 10 while Germany took Paris on 16 March and its forces fell from 93 to 30.
  - Nothing in the editor says the warheads will not be used (R8-B1).
  - Placed fleets wander away at once: the North Sea point was empty on day 3 (`c8g_5591_21_northsea_day3_30m.png`).
- **AoC does better:** nothing measurable; its scenario editor (v3.3.0) is matched in scope here.

### Stats and history: 7

- **Tested:** the nation panel after a bomb; the charts' metrics; the history panel after AI strikes.
- **Evidence:** `critic/c8_a_4711.json` (`francePanel`, `chartOptions`), `critic/shots/c8f_1_82_chart_nukedead.png`,
  `c8f_1_83_history.png`.
- **Fixed since run 7:**
  - France's panel shows "Nuclear strikes on its land: Dead 705,954, Land under fallout 157".
  - The charts have Warheads, Nuclear dead and Land under fallout; the nuclear-dead chart shows Germany's and Japan's
    jumps in 1951.
  - History has filters and CSV/JSON export.
- **Problems:**
  - The history shows engine numbers to the player: "decided on a nuclear strike: its utility 33 in a thousand".
  - The alert banner covers the top of the History and Charts panels (`c8f_1_83_history.png`).
- **AoC does better:** nothing measured (its Statistics panel, text and `steam-screenshot-01.jpg`).

### UI/UX and polish: 7

- **Tested:**
  - The title's language list.
  - The tooltip after a wheel zoom with the mouse held still.
  - The phone with God Mode on.
  - The alert's placement over panels.
- **Evidence:** `critic/c8_a_4711.json` (`langOptions`), `critic/c8_h_5381.json` (`tip0`, `tip1`),
  `critic/shots/c8h_5381_01_tip_after_wheel_out.png`, `c8a_phone_01_god.png`, `c8f_1_83_history.png`.
- **Fixed since run 7:** "Pseudo-locale (i18n test)" is gone from the language list.
- **Problems:**
  - **Stale tooltip.** I hovered London, then wheeled out to 24,738 m/px without moving the mouse. The cursor is now
    over West Africa and the tooltip still reads "London · capital, United Kingdom, Unrest 0"
    (`c8h_5381_01_tip_after_wheel_out.png`). The same happens after the camera jumps (`c8a_4711_20_paris_150m_day10.png`).
  - The phone's God tool labels are clipped.
  - The alert overlaps the History and Charts headers.
  - By default a strike pauses the game. That surprised me, but it is a setting.
- **AoC does better:** its UI is simpler; nothing measured.

### Performance: 7

- **Tested:**
  - Seed 99, 5 years, pinned and alone.
  - Seed 3371 years 15 to 30 from my year-14 save, pinned, alone, `--profile`.
  - Seed 2843, 30 years, pinned, alone, `--profile`.
  - The browser at Max for 2 years from a 1960 save (seed 6271) through a nuclear exchange.
- **Evidence:** `critic/c8_perf_seed99_5y_solo.log`, `critic/c8_perf_3371_y15_30_solo.log`,
  `critic/c8_perf_2843_30y_solo.log`, `critic/c8_l_6271.json`, `critic/shots/c8l_6271_2_year1.png`.
- **Within budget:**
  - Seed 99: year 1 at 2.20 ms (budget 2.4) and 5 years at 1.35 ms (budget 1.5).
  - The hash `ea691c94` equals the pin of ADR-481.
- **Late game:**
  - Seed 3371: mean tick 0.62 to 1.62 ms, p95 1.7 to 9.3 ms, `invasionAi` at most 16.9 ms.
  - Seed 2843: the worst single call in 30 years is 154 ms (`operationalAi`, year 1). Typical yearly maxima are 70 to
    81 ms, in `capitals`.
- **Browser:** 16.1 s per year at 59 to 60 fps. The longest gap between ticks is 159 ms.
- **AoC does better:** nothing measured; its smoothness is known from text. At parity at best on the evidence.
- **Residual:** the `capitals` system's ~75 ms call appears in most years (2843). It is a visible hitch at Max but not a
  stall.

### Stability: 7

- **Tested:**
  - The browser against headless for 3 years (seed 5381).
  - A save and load twin.
  - The year-14 save continued for 16 years against the straight run.
  - A headless 1960 save loaded in the page.
  - Errors in 11 browser sessions.
- **Evidence:**
  - `critic/c8_h_5381.json`: 3 of 3 year hashes equal (a58ec400, 0d3b1c65, bf10d2bd). The twin is equal 30 days on
    (1074531816).
  - `critic/c8_perf_3371_y15_30_solo.log` against `critic/c8_headless_3371.json`: 16 of 16 yearly hashes equal.
  - `critic/c8_l_6271.json`: loaded hash 2016344975 = 0x782efb8f, the headless year-22 hash.
  - `errors` in every `critic/c8_*.json`: 0 page errors and 0 console errors.
- **Save size:** 3.77 MB in the browser and 4.4 to 4.9 MB headless, against 40 MB in run 7 (PLAN 7.17 verified).
- **Why 7:** no crash, desync or error in this run. I have nothing showing AoC is less stable.

### Semantic zoom to unit level: 7 (needs 8)

- **Tested:** Germany on Poland and France (seeds 6047 and 3929). Infantry and armour in contact at 3,000, 900, 250,
  80, 25 and 10 m/px live; armour watched for 45 s at Speed x1 and x2 at 25 m/px; a week later at 250 to 25 m/px.
- **Evidence:** `critic/c8_c_6047.json`, `critic/c8_e_3929.json` (`ww`), `critic/shots/c8c_6047_arm_0250m.png`,
  `c8c_6047_arm_0080m.png`, `c8c_6047_arm_0025m.png`, `c8c_6047_arm_0010m.png`, `c8c_6047_inf_0010m.png`,
  `c8c_6047_week2_0025m.png`.
- **Better than run 7:**
  - A line of contact, each half in its side's tint, is drawn between the engaged blocks at 250 down to 10 m/px
    (`contact` 1 to 2 in every T2 and T3 probe).
  - German tanks are large grey hulls in ranks facing the French infantry (`c8c_6047_arm_0010m.png`).
  - A struck city shows its ruin.
- **Still short of 8:**
  - Infantry at 10 m/px are shapeless clumps of figures, the two sides near one colour on the grass
    (`c8c_6047_inf_0010m.png`).
  - At 900 m/px nothing of the units shows but counters (element count 0).
  - No wreck in any probe (`wrecks.count` 0 throughout); see Tanks.

### Naval warfare: 6 (needs 8)

- **Tested:** seed 5591, Germany against Britain. The ticker's first "Sea battle" row (hour 42) was clicked and
  watched for 6 s at Speed x1, then viewed at 150, 40 and 15 m/px. The fleets were viewed at 30 and 15 m/px. Fleets
  were placed by the editor.
- **Evidence:** `critic/c8_j_5591.json`, `critic/c8_k_ships.json`, `critic/shots/c8j_5591_00_row.png`,
  `c8j_5591_01_row_live_1.png`, `c8j_5591_1_0150m.png`, `c8k_ships_15m_crop4x.png`, `c8k_ship_1199_15m.png`,
  `c8k_ship_1063_15m.png`.
- **Better:** ships have bows, turrets and a carrier's deck. The 4× crop tells a battleship from a destroyer and a
  carrier, and German grey from British red.
- **Bad:**
  - **R8-B2**, confirmed with the battle live. The battle's pair spans 23 cells across the Dutch coast. The row centres on dry Groningen at 364 m/px. The fleets are at the frame's edges, about 1,000 px
    apart, and no gunfire is drawn.
  - At 1× a ship is about 20 to 30 px long at 15 m/px.
  - Fleets placed by the editor do not hold their place.
  - No SLBMs (decided out, ADR-479).
- **AoC has no navy.** To reach 8, the sea battle must be seen from its row, with fire between both fleets.

### Tanks: 7 (needs 8)

- **Tested:** German armoured divisions in contact on day 3 (seeds 6047 and 3929) at every tier, live; 45 s watches at
  T3.
- **Evidence:** `critic/c8_c_6047.json`, `critic/c8_e_3929.json`, `critic/shots/c8c_6047_arm_0010m.png`,
  `c8c_6047_arm_0025m.png`, `c8c_6047_arm_0250m.png`, `c8e_3929_arm_lvl0_25m_4.png`.
- **Fixed since run 7:**
  - Tanks at 10 m/px are about 15 px, in ranks facing the enemy.
  - Light grey for Germany against French blue.
  - At T2 the armoured division reads as a larger slab than infantry.
- **Not yet 8:**
  - In 45 s at Speed x1 and 25 m/px on a live armour fight, `hulls.shown` stayed at 0 and `wrecks.count` at 0. At x2,
    0 to 6 hulls were shown.
  - `hulls.count` rose from 50 to 374, but it counts the fallen-infantry marks too (`src/render/fx/hulls.ts:272`), so
    the tanks' losses a player sees are very few.
  - I saw no burning tank in any screenshot.
- **Fix:** let armour fights a player watches leave visible burning hulls.

### Aircraft: 6 (needs 8)

- **Tested:** sorties drawn at each tier during the war on Poland and France; the air mode's hover over Poland on day
  10; the 17 headless worlds.
- **Evidence:** `critic/c8_c_6047.json` (`sorties`), `critic/c8_h_5381.json` (`hovers`, `airHolders`),
  `critic/c8_headless_*.json` (`meanSortiesAloft`), `critic/shots/c8h_8217_air_hover.png`.
- **Fixed since run 7:**
  - Warsaw's and Kiev's air zones are "held by Poland", not Yugoslavia.
  - The legend says "1 zone".
  - 5 of the 57 AI nuclear launches were by bomber, against 0 in run 7.
- **Bad:**
  - The air war still fades on every seed: 28 to 39 aloft in year 1, then 0.5 to 14 (user-accepted, R5-B2).
  - At 900 m/px 0 to 1 sorties are drawn, and at 25 m/px none.

### AI nuclear use: 6 (needs 8)

- **Tested:**
  - 17 unaided 30-year worlds.
  - An AI exchange watched in the browser from a 1950 save (seed 1): the alert, Go to, the ruin, the nuclear-dead
    chart and the history.
  - Two late years with an exchange (seed 6271).
  - Editor-given warheads for Poland (120 days) and France (150 days), both being overrun.
- **Evidence:** `critic/c8_headless_*.json` (`nukeLog`), `critic/c8_f_1.json`,
  `critic/shots/c8f_1_11_alert.png`, `c8f_1_11_goto.png`, `c8f_1_11_ruin_200m.png`, `c8f_1_82_chart_nukedead.png`,
  `c8l_6271_3_world_end.png`, `critic/c8_g_5591.json`, `critic/c8_i_7127.json`.
- **Better (verified):**
  - Bursts in 8 of 17 worlds, 55 in all.
  - Exchanges are answered. On seed 1 the Soviet Union strikes Berlin (2,175,301 dead) and Germany answers on Moscow
    the next day (141,000). On seed 7919 China strikes London and Britain answers twice. On seed 9137 Germany and the
    Soviet Union trade strikes in years 25, 28 and 30.
  - In the browser the alert, Go to, ruins at Berlin and Moscow, the ticker and the chart all show it.
- **Still short:**
  - 9 of 17 worlds never see a burst. The first bursts come in years 14, 14, 19, 23, 23, 29, 30 and 30, so a player
    watching 20 years sees one in 3 of 17 games.
  - Warheads given by the editor are never used (R8-B1).
  - Some targets are absurd:
    - The Soviet Union strikes Nepal (1,000 dead) and Siam (45,000) in a war with China (seed 1).
    - China strikes one Xinjiang point four times in 4 days: 641,568, 18,088, 1,554 and 566 dead (seed 7919).
    - France strikes Argentina for 16,751 (seed 9137).
    - Strikes go ahead at utilities of 0.001 to 0.01.
  - A world's whole nuclear history is often one day's spasm after 20 silent years: all 6 of seed 5 come in year 30,
    and all 4 of seed 6271 within 48 hours.
- **AoC has no AI nukes.** The dimension needs 8: the feature must be seen in most games and believed.

## Blocking issues, in priority order

1. **R8-B1. AI nuclear use is still unseen in half the games, and inert where a player sets it up.**
   - Bursts in 8 of 17 unaided 30-year worlds (55 in 510 world-years), but in only 3 of 17 before year 20, and in 9
     never. Meanwhile 3 to 6 nations hold 118 to 163 warheads.
   - France and Poland, given 10 warheads each in the editor and overrun with their capitals taken, never strike in 120
     to 150 days.
   - Some strikes hit near-empty or third-party places: Nepal, 1,000 dead; one Xinjiang point four times in 4 days.
   - Evidence: `critic/c8_headless_q1.json`, `critic/c8_headless_7919.json`, `critic/c8_headless_9137.json`,
     `critic/c8_headless_4093.json`, `critic/c8_g_5591.json`, `critic/c8_i_7127.json`,
     `critic/shots/c8i_7127_day150.png`, `critic/shots/c8f_1_11_alert.png`.
   - `nukesAllowed` is only the settings (`src/sim/systems/nuclear.ts:150`), so for an overrun holder in 1938 the
     utility itself never turns positive.
   - **Fix:** a nuclear power losing a war for its life strikes in a visible share of games and earlier. Warheads from
     the editor or God Mode are usable by a desperate holder, or the editor says why not (no delivery, the taboo). No
     re-striking a point struck days before, and no strikes on small third parties for a thousand dead.
2. **R8-B2. A sea battle's ticker row does not land on the fight (contradicts PLAN 7.10b).**
   - Checked with the battle live: `view.seaBattles()` non-empty when the row was clicked at hour 41.
   - The row centres on dry land at Groningen at 364 m/px, with the fleets about 1,000 px apart at the edges. The
     battle's own pair spans 23.3 cells, with the fleets on either side of the Dutch coast (`critic/c8_j2_5591.json`,
     `live`).
   - No fire was drawn in 6 s at Speed x1. At 150, 40 and 15 m/px the centre has no ship.
   - Evidence: `critic/c8_j2_5591.json`, `critic/shots/c8j2_5591_01_row_live_0.png`, `critic/c8_j_5591.json`,
     `critic/shots/c8j_5591_00_row.png`, `c8j_5591_01_row_live_1.png`,
     `c8j_5591_1_0150m.png`.
   - **Fix:** frame the engagement point with both fleets firing near the centre, never land.
3. **R8-B3. The Nuke tool's size is cosmetic (contradicts PLAN 7.16a).**
   - A hydrogen bomb kills 3 to 11 % more than an atomic one at the same point: Paris 554,827 against 588,117, London
     751,186 against 790,283, Berlin 1,025,202 against 1,063,051, Moscow 161,530 against 179,694.
   - The two ruins look the same at 300 m/px.
   - The code: `detonate` gets yieldN 2 against 1, so the radius grows ×1.26 (`src/sim/systems/nuclear.ts:301`,
     `src/sim/tick.ts:190`).
   - Evidence: `critic/c8_b_4711.json`, `critic/shots/c8b_berlin_A_vs_H_300m.png`.
   - **Fix:** a thermonuclear yield tens to hundreds of times a fission one, visibly larger in toll, fallout and ruin.

## Non-blocking issues

- **Stale map tooltip** after a wheel zoom or a camera jump with the mouse still: "London" over West Africa
  (`critic/shots/c8h_5381_01_tip_after_wheel_out.png`).
- **The phone's God tool labels are clipped** (`critic/shots/c8a_phone_01_god.png`).
- **The nuke alert covers the History and Charts headers**, and it stays up 10 days (`critic/shots/c8f_1_83_history.png`).
- **The history shows engine utilities to the player** ("its utility 33 in a thousand").
- **Fleets placed in the editor wander off at once**, and a bomber group cannot be placed at Warsaw.
- **The Soviet Union pressed against the 35 % land cap** for 22 years on seed 2843; 5 of 17 seeds end at 31.7 to 34.1 %.
- **Seed 4093's late world is quiet:** 2.8 % moving, 0 to 3 wars.
- **Few tank hulls and no wrecks** where a player watches an armour fight (`critic/c8_e_3929.json`).
- **The air war fades after year 1** (user-accepted).
- **Strikes at near-zero utility**, and one-day nuclear spasms after decades of silence.
- **A ~75 ms `capitals` call** in most years (`critic/c8_perf_2843_30y_solo.log`).

## Strengths, verified

- **Determinism and saves.**
  - Browser equals headless year by year.
  - A year-14 save continued equals the straight run for 16 years.
  - A 1960 headless save loads in the page on the right hash.
  - A save is 3.8 to 4.9 MB, down from 40 MB (`critic/c8_h_5381.json`, `critic/c8_perf_3371_y15_30_solo.log`,
    `critic/c8_l_6271.json`).
- **The late game is now smooth.** Two 1960s years with a nuclear exchange run at Max in 16 s each at 60 fps, and the
  invasion-AI stall is gone (`critic/c8_l_6271.json`, `critic/c8_perf_3371_y15_30_solo.log`).

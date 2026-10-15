# Critic report, run 6

- Commit: `228d08356ceec2b3f0d728769e2be18785f7a32e` (Phase 6, nuclear weapons, ticked by PLAN 6.9).
- Date: 2026-10-15. Build: `npm run build`, exit 0 (`critic/c6_build.log`); served with `vite preview` on port 5299.
- Machine: the user's Windows machine with its GPU, Chromium through Playwright, headless, 1600 × 900 unless stated.
  Pinned tick figures (`--affinity 0xFFFF`) were taken with nothing else of mine running.
- Every path below was made in this run (prefix `c6`). Scripts: `critic/scripts/c6_*.mjs`, `critic/scripts/c6_*.ts`.
- Seeds I chose: 4127, 5861, 7043, 6619, 2953. Seed 99 only for the budget figure. None was taken from the builder's
  demos. The builder's AI-strike demo (PLAN 6.7) is staged: it gives France a warhead and missiles, starts the war,
  places six German divisions at Reims, and pushes a burst into the effects layer by hand if none is there
  (`tests/e2e/nukeDemo1938.spec.ts`). I did not use it as evidence. I watched the AI arrive at nuclear war unaided.
- `reference/text/AOC_TEXT_NOTES.md` lines 414 to 418: AoC's nuke is a God tool. It lowers CE by 2 and takes 10 % of
  gold, has a size setting, and can leave wasteland. AoC has no AI nuclear use. AoC's nuke behaviour is known only
  from text, so my confidence on that comparison is lower.

## Verdict

Phase 6 is real. Without help from me, two AI worlds went nuclear in 1949 and 1952 (seeds 6619 and 2953). The same
strikes happened in the browser as headless: the browser's `history()` lists the headless strike ticks one for one
(`critic/c6_f_6619.json`), and the first alert (Free Van, 13,600 dead) came within a day of the headless toll. The game pauses, a banner names striker, victim and dead, "Go to" flies the camera there, a mushroom cloud with
a shockwave ring plays at every tier, fallout drifts downwind in its own map mode, and God Mode has a Nuke tool. That
moves AI nuclear use from 0 to 4 and God Mode up a point.

It does not reach the 8 a differentiator needs, for three reasons:

1. **Cost.** From the first strikes on, the nuclear system eats the game: 69 to 79 % of every tick in years 13 to
   19, a 170 to 240 ms stall every game day, and still 58 to 61 % in years 20 and 21. A year at Max goes from about
   22 s to 129 to 216 s.
2. **Behaviour.** The AI's choices read as random, not as escalation. The first nuclear use in history is the Soviet
   Union, the largest nation on earth, bombing the revolt statelet "Free Van" three times. Later warheads fall one a
   day on Paramaribo, Aden, Malabo, Odense (three times) and land no one owns.
3. **Aftermath.** A city that lost 1.18 million people looks exactly as it did, at every zoom, ten days later.

Of run 5's five blockers:
- Two are fixed: the air war is seen and recorded, and nuclear weapons exist.
- One is half fixed: both fleets of a sea battle are now framed.
- One is left by the user's decision: the air war still fades.
- One stands and has grown: statelets.

## Scores

| Dimension | Run 5 | Run 6 |
|---|---|---|
| Map visuals and readability | 6 | 6 |
| Diplomacy, war, alliance, puppet, revolt depth | 6 | 6 |
| Emergent world dynamics over long runs | 5 | 5 |
| God Mode | 5 | 6 |
| Editor and scenarios | 6 | 6 |
| Stats and history | 5 | 6 |
| UI/UX and polish | 6 | 6 |
| Performance | 6 | 4 |
| Stability | 7 | 7 |
| Semantic zoom to unit level (needs 8) | 6 | 6 |
| Naval warfare (needs 8) | 5 | 6 |
| Tanks (needs 8) | 5 | 5 |
| Aircraft (needs 8) | 4 | 5 |
| AI nuclear use (needs 8) | 0 | 4 |

No score is above 7. Performance drops two points: the nuclear years run 6 to 10 times slower than the early game,
and seed 99's year 1 is slower than in run 5.

## What happened to the run 5 blockers

| Run 5 id | Now | Evidence of this run |
|---|---|---|
| R5-B1: air not seen at T3, not recorded | **Mostly fixed** | At T3, 2 sorties are drawn at 15 m/px over Germany's first air fight on Poland, and planes pass the screen live at 20 m/px (`critic/c6_d_5861.json`, `tiers`; `critic/shots/c6d_5861_20_live_20m_best.png`). History: 13 air rows after 40 days, e.g. "Germany and France fought in the air this month: Germany lost 108 aircraft, France 140" (`historyAir`). The nation panel has an "Air war" block (aircraft, lost, lost to air strikes) and the charts have Aircraft and Aircraft lost (`germanyPanel`, `chartOptions`; `critic/shots/c6d_5861_51_germany_panel.png`). The air mode hatches zones and names air forces with zone counts (`critic/shots/c6d_5861_40_aircontrol_day20.png`). Left: on day 20 of its war on Poland, Germany holds 1 zone ("Germany: 1 zones") |
| R5-B2: AI air war fades | **Stands; accepted by the user (PLAN 5.12)** | Mean sorties aloft 34.4 in year 1, then 2.1 to 12 in years 8 to 30 on seed 6619, while wings grow from 118 to 171 and 11 to 19 wars run (`critic/c6_headless_6619.json`). Same shape on 2953. Moved to non-blocking because the user accepted it |
| R5-B3: statelets | **Worse** | See R6-B3 |
| R5-B4: sea battle shows one side | **Half fixed** | The ticker's "Sea battle: United Kingdom against Germany" now frames both fleets at 376 m/px: British and Dutch at left, the German 13.4k squadron and destroyers at right, carrier planes flying between them (`critic/c6_d_5861.json`, `fleetsNear`, `seaCam`; `critic/shots/c6d_5861_30_sea_row_clicked.png`, `critic/shots/c6d_5861_31_sea_live_7.png`). Still at counter level: no ship, no gunfire, and order arrows lie across the view |
| R5-B5: no nukes | **Fixed (they exist)** | See the AI nuclear use section |

## Dimensions

### Map visuals and readability: 6

- **Tested:**
  - Boot.
  - God nukes at 4,000, 1,000, 150 and 20 m/px.
  - The fallout mode 10 days and 30 days after a strike.
  - The air mode on day 20.
  - Europe after 16 years in the browser.
- **Evidence:** `critic/shots/c6a_4127_1_berlin_4000m_2000.png`, `c6a_4127_31_fallout_day10.png`, `c6a_4127_32_fallout_berlin_800m.png`,
  `c6d_5861_40_aircontrol_day20.png`, `c6c_6619_92_europe_end.png`, `c6d_5861_30_sea_row_clicked.png`.
- **Better than run 5:**
  - The air mode hatches zones and has a legend.
  - Fallout is a clear yellow-green fan downwind of a burst, with a legend that says what it does
    (`c6a_4127_32_fallout_berlin_800m.png`).
- **Problems:**
  - In the political mode a nuked city leaves no mark: no crater, scorch or ruin (see Semantic zoom).
  - Order arrows still lie across any view with movement (`c6d_5861_30_sea_row_clicked.png`).
  - Europe in 1953 is a quilt. "Free Liège II" holds Berlin, and statelet names overlap capitals
    (`c6c_6619_92_europe_end.png`).
  - The air legend's grey "Germany" swatch is hard to tell from the grey of Germany's own land
    (`c6d_5861_40_aircontrol_day20.png`).
- **AoC does better:** large blocks and readable names (reference/screens). AoC also has an optional nuke wasteland,
  which this game lacks (AOC_TEXT_NOTES line 417).

### Diplomacy, war, alliance, puppet, revolt depth: 6

- **Tested:** God-declared wars on 5861 and 7043. Two 30-year AI worlds headless (6619, 2953). 16 years of 6619 in
  the browser.
- **Evidence:** `critic/c6_headless_6619.json` (`ev`, `outrage`), `critic/c6_c_6619.json`,
  `critic/shots/c6d_5861_40_aircontrol_day20.png` (ticker).
- **New:**
  - Nuclear outrage is state: "Soviet Union 78.35" after its first strikes (`c6_headless_6619.json`, year 12, `outrage`).
  - The taboo drops to 0.33 and recovers to 1.0 over about 10 years.
- **Odd:**
  - On seed 5861 the Soviet Union declares war on Romania on day 5 and on Lithuania on day 12, unprompted
    (`c6d_5861_40_aircontrol_day20.png`, ticker).
  - The United Kingdom, hit at London by the Soviet Union for 1,371,914 dead, never strikes back at the Soviet Union;
    its one bomb, a day later, goes to Chungking at utility 0.72
    (`critic/c6_f_6619.json`, pauses 8 and 9; `critic/shots/c6f_6619_pause_08.png`). The war bar shows the UK at
    war with China and the Soviet Union at war with China at the same time. The cause is unclear: medium confidence
    that the retaliation is misdirected.
- **AoC does better:** fewer, more decisive wars (text, frames).

### Emergent world dynamics over long runs: 5

- **Tested:** 30 years headless on 6619 and 2953 (unpinned, alongside each other); 16 years in the browser on 6619.
- **Evidence:** `critic/c6_headless_6619.json`, `critic/c6_headless_2953.json`, their `.log` files,
  `critic/c6_c_6619.json`, `critic/shots/c6c_6619_90_world_end.png`, `critic/shots/c6c_6619_92_europe_end.png`.
- **Good:**
  - There is a nuclear age with a beginning (1946 warheads, 1949 first use), a peak (20 bursts in 1951) and a decay
    (taboo back to 1.0 by 1961).
  - The Soviet Union falls from 26.9 % to 7.3 % of land, and China rises to 14 % (6619).
- **Bad:**
  - Static giants: Canada holds 12.3 % of land in every one of 30 years and the United States 7.3 % (6619). The
    United States holds 9.5 % for 30 years (2953).
  - Statelets: 154 and 153 nations alive in year 30, 77 and 75 of them founded in play (R6-B3).
  - The air war is near idle after year 8 (R5-B2).

### God Mode: 6

- **Tested:** the God tab inventory; the Nuke tool four times while the game ran (Berlin, Warsaw, Paris, London); the
  alert, the auto-pause and "Go to"; the nation's nuclear toggles.
- **Evidence:** `critic/c6_a_4127.json` (`godTabText`, `strikes`), `critic/shots/c6a_4127_01_godtab.png`,
  `critic/shots/c6a_4127_1_*`.
- **Works:**
  - Nuke: one click, a burst, an alert ("A bomb fell from the heavens on Germany: an atomic bomb, 1,179,205 dead")
    and a pause.
  - Per-nation "Nuclear weapons allowed", "Nuclear warheads 0 +1", and a world toggle.
- **Missing against AoC:**
  - A nuke size: the God tool is atomic only, and thermonuclear cannot be reached from the UI. `hud.ts` sends
    `thermonuclear: false`.
  - Spawn Major Battle, Recolor, Fight to the death and Donate (AOC_TEXT_NOTES lines 414 to 449).
  - Still nothing for the air or the sea.
- **Odd:** one atomic bomb on Berlin in 1938 kills 1,179,205 (27 % of the city). Low confidence that this is a
  design choice, but it is far beyond Hiroshima's toll.

### Editor and scenarios: 6

- **Tested:** the editor's inventory (`critic/c6_e_7043.json`, `editorText`; `critic/shots/c6e_7043_11_editor.png`) and the
  title screen (`critic/shots/c6e_7043_00_title.png`).
- **Unchanged since run 5.** No warheads, airbases, ports or fleets can be placed, so a custom scenario cannot set a
  nuclear power.

### Stats and history: 6

- **Tested:** history, ticker, nation panel and charts after an air war and after strikes.
- **Evidence:** `critic/c6_d_5861.json` (`historyAir`, `germanyPanel`, `chartOptions`), `critic/c6_a_4127.json` (`history`,
  `germanyPanel`), `critic/shots/c6d_5861_50_history_day40.png`, `critic/shots/c6a_4127_20_history.png`.
- **Better:**
  - The air war is in the history and the charts, and the panel has an Air war block.
  - Strikes are history rows with yield and dead.
- **Missing:**
  - Germany's panel after a 1.18-million-dead strike says nothing of it: no warheads, nuclear dead or fallout, and
    "Army 578,017" (`c6_a_4127.json`, `germanyPanel`).
  - No chart has warheads or nuclear dead.
- **Doubtful:** the air figures. "Germany's air force struck Poland this month: 108,646 men, guns and vehicles
  lost" in January 1938 (`historyAir`), and Germany's army fell from 578k to 341k in 40 days. Low confidence that air
  is too strong.

### UI/UX and polish: 6

- **Tested:** keys, the language list, settings, the alert at Max, phone width.
- **Evidence:** `critic/c6_e_7043.json`, `critic/c6_f_6619.json`, `critic/shots/c6e_7043_30_phone.png`,
  `critic/shots/c6c_6619_a1_0_as_it_lands.png`.
- **Good:**
  - The nuclear alert is clear and its "Go to" works (`c6c_6619_a1_1_goto_1200.png`).
  - "Pause on a nuclear strike" is a setting.
- **Problems:**
  - The language list shows "Pseudo-locale (i18n test)" to players (`c6_e_7043.json`, `languages`).
  - Escape still closes no panel. F2, F3, M and 2 change no map mode (`keys`).
  - At Max the alert merges strikes. From the year-12 checkpoint there were 20 strikes and 11 pauses and banners
    (`critic/c6_f_6619.json`: `strikes` against `pauses`). The pause lands about a day late: the banner says
    23 October and the clock says 24 October (`c6c_6619_a1_0_as_it_lands.png`). Tokyo's second strike and Kagoshima's
    never had a banner of their own.
  - A played nation that owns warheads has no way to use them. No UI sends `launchNuke` (grep `src/ui`, `src/app`).

### Performance: 4

- **Tested:**
  - Seed 99, 5 years, pinned and alone.
  - Seed 6619 years 13 to 21 from my own year-12 checkpoint, pinned, alone, with `--profile`.
  - Browser years at Max on 6619.
- **Evidence:** `critic/c6_perf_seed99_5y_solo.log`, `critic/c6_perf_6619_y13_21_solo.log`, `critic/c6_perf_6619_y13_15_solo.log`,
  `critic/c6_c_6619.json` (`years`).
- **Seed 99:**
  - Year 1 mean 3.77 ms against a budget of 2.4. Five years 2.67 ms against 1.5. Run 5 measured 2.83 and 1.87.
  - The pin hash 45df324d matches the builder's.
- **The nuclear age, R6-B1** (`critic/c6_perf_6619_y13_21_solo.log`, pinned and alone):
  - Years 13 to 19: 9.7 to 12.8 ms mean, of which `nuclear` 7.0 to 10.1 ms (69 to 79 %), one call a day of about
    170 to 240 ms, max 436 ms. It costs as much in years 16 and 17, which had no strike, as in the strike years.
  - Years 20 and 21: 5.6 and 5.8 ms, `nuclear` 3.4 ms (58 to 61 %).
  - Before any strike (years 9 to 11, warheads held) the whole tick was 3.0 to 4.0 ms.
  - In the browser at Max (that session ran alongside my two headless 30-year runs, so these are corroboration, not
    the measure): years 1 to 11 take 20 to 53 s each; year 13 takes 216 s and years 14 to 16 take 129 to
    165 s (`c6_c_6619.json`, `years` wallS).
  - The late game is where a player would watch a nuclear war, and it plays in slow motion with a quarter-second
    hitch every game day.
- **AoC does better:** it runs smoothly for centuries (text, frames).

### Stability: 7

- **Tested:** six browser sessions (A, B, C, D, E, F) and three headless runs. A save and load with fallout on the
  ground and a war on. A headless checkpoint loaded into the browser.
- **Evidence:** `errors` in `critic/c6_a_4127.json`, `c6_b_4127.json`, `c6_c_6619.json`, `c6_d_5861.json`, `c6_e_7043.json`,
  `c6_f_6619.json`: 0 page errors and 0 console errors or warnings in all six.
- **Save and load:** the twin with a God burst's fallout reaches the same hash 96 hours on (`c6_e_7043.json`, `twin`).
- **Determinism:** the browser and the headless runner agree. The browser met the same first strike, Free Van at
  13,600 dead, as the headless run of the same seed (`c6_c_6619.json` against `c6_headless_6619.json`). The headless
  year-12 save loaded into the page and replayed the same strikes (`c6_f_6619.json`).
- **Save size:** still 38.8 MB (`c6_e_7043.json`, `saved.bytes`).

### Semantic zoom to unit level: 6 (needs 8)

- **Tested:** a God burst at 4,000, 1,000, 150 and 20 m/px, 6 frames each from 0.15 to 6 s. Berlin at 20 m/px before
  the strike, 1 hour after and 10 days after. An air fight at 1,000, 150, 40 and 15 m/px.
- **Evidence:**
  - Bursts: `critic/shots/c6a_4127_1_berlin_4000m_500.png`, `c6a_4127_1_warsaw_1000m_1000.png`,
    `c6a_4127_1_paris_150m_1000.png`, `c6a_4127_1_london_20m_1000.png`, `c6a_4127_1_london_20m_6000.png`.
  - Berlin: `critic/shots/c6b_4127_00_berlin_20m_before.png`, `c6b_4127_01_berlin_20m_after1h.png`,
    `c6a_4127_33_berlin_150m_day10.png`, `c6a_4127_34_berlin_20m_day10.png`.
  - Data: `critic/c6_b_4127.json`.
- **Good:**
  - The cloud scales with the zoom. At T0 to T2 it reads as a mushroom with a ring (`c6a_4127_1_paris_150m_1000.png`).
  - The infantry division at ground zero visibly thins from full blocks to scattered men (12,460 to 3,801 men,
    `c6_b_4127.json`).
- **Bad:**
  - At 20 m/px the burst is a screen-filling flat orange trapezoid with no shape. Six seconds later it is a
    brown-grey slab over London (`c6a_4127_1_london_20m_1000.png`, `_6000.png`).
  - Ten days after 1.18 million died, Berlin at 150 and 20 m/px looks as it did before: the same houses, fields and
    trees, with no crater, fire, rubble or scorch (`c6a_4127_33_berlin_150m_day10.png`, `c6a_4127_34_berlin_20m_day10.png`).
  - Air at T3 is now drawn, but thinly: 2 sorties at 15 m/px against 29 at 1,000 (`c6_d_5861.json`, `tiers`).

### Naval warfare: 6 (needs 8)

- **Tested:** the ticker's sea battle row on seed 5861 (Germany against the United Kingdom), live for 8 s.
- **Evidence:** `critic/c6_d_5861.json` (`fleetsNear`, `seaCam`), `critic/shots/c6d_5861_30_sea_row_clicked.png`,
  `critic/shots/c6d_5861_31_sea_live_7.png`.
- **Better (R5-B4):** both sides are now on screen, and the carrier's planes are drawn flying.
- **Still:** the framing is a 376 m/px counter view with order arrows across it. No ship or gunfire is seen. I did
  not re-test ships at 20 m/px (PLAN 4.12c), so that is unverified this run.
- **Missing:** SLBMs deliver nothing (the builder's own PLAN 6.9 note), so the navy plays no nuclear role.
- AoC has no navy (AOC_TEXT_NOTES line 419).

### Tanks: 5 (needs 8)

- **Not re-tested.** No armour or tank render file changed since run 5 (`git diff --stat c8503460..HEAD -- src/render`),
  so run 5's finding carries.

### Aircraft: 5 (needs 8)

- **Tested:** Germany's first air fight over Poland on seed 5861 at four tiers and live at 20 m/px, the air mode on
  day 20, the history, panel and charts after 40 days, and 30 years headless on two seeds.
- **Evidence:** `critic/c6_d_5861.json`, `critic/shots/c6d_5861_10_tier_1000m.png`, `critic/shots/c6d_5861_20_live_20m_best.png`,
  `critic/shots/c6d_5861_40_aircontrol_day20.png`, `critic/shots/c6d_5861_51_germany_panel.png`, `critic/c6_headless_6619.json`.
- **Up a point:** the air is now seen at T3 and readable in the history, panel and charts (R5-B1).
- **Still:**
  - The AI's air war fades after year 1 (R5-B2).
  - On day 20 the air mode gives Germany 1 zone.
  - Strategic bombers barely count for nukes. No warhead was intercepted in 55 headless bursts over 30 years on two
    seeds (`intercepted` 0 in every year), so air defence plays no part in the nuclear war.

### AI nuclear use: 4 (needs 8)

- **Tested:**
  - Two AI worlds for 30 years headless (6619, 2953).
  - 6619 in the browser at Max to 1953, every alert caught.
  - The year-12 checkpoint replayed in the browser, every pause logged.
  - The nearest city of every strike (`critic/scripts/c6_where.ts`).
- **Evidence:** `critic/c6_headless_6619.json` (`nukeLog`), `critic/c6_headless_2953.json`, `critic/c6_nuke_where.json`,
  `critic/c6_c_6619.json` (`alerts`), `critic/c6_f_6619.json`, `critic/shots/c6c_6619_a1_0_as_it_lands.png`,
  `critic/shots/c6c_6619_a1_1_goto_1200.png`, `critic/shots/c6c_6619_a1_3_fallout.png`, `critic/shots/c6f_6619_pause_*.png`.
- **What exists, verified:**
  - Warheads appear in 1946 (year 9) for three or four powers, without help.
  - The AI strikes on its own decision, logged with its utility: 23 strikes in 6619, 13 in 2953 by year 16; 34 and 21 by year 30.
  - Each strike has an alert, a history row, a mushroom, fallout, outrage and a taboo that drops and recovers.
- **Why it is not 8 (R6-B2):**
  - **First use is absurd.** The first strike of seed 6619 is the Soviet Union (22.5 million km², the largest
    nation) on "Free Van", a revolt statelet near Kars, at utility 0.01. It strikes twice more in the next two days,
    at the same place (`nukeLog`, year 12; `c6c_6619_a1_1_goto_1200.png` shows one small formation there).
  - **Volley cadence.** In 1951 the Soviet Union launches one warhead every 24 hours: Tokyo, Kagoshima, Tokyo again,
    then Pinsk, Kovel and Pinsk, then Chungking, Osaka, Poronaysk. Then "Free Liège II" twice and the Netherlands
    twice in four days. 20 bursts that year (`c6_nuke_where.json`).
  - **Pointless targets.** Germany (2953) strikes Paramaribo, Aden, Malabo and Algiers, and Odense three times. The
    Soviet Union strikes Las Palmas. 7 of 36 bursts strike "where no nation holds the land".
  - **No deterrence logic a player can see.** The United States builds up to 87 warheads and never uses one; France
    (83) uses one, on a statelet, in year 20. Meanwhile the revolt statelet "Free Liège II" (founded #138, the one
    holding Berlin) builds warheads and makes 11 strike decisions in years 18 and 19, on Germany, France, the
    Netherlands, British India and other statelets (`c6_headless_6619.json`, `nukeLog`). The United Kingdom, struck at London, never hits back at the Soviet Union; its one bomb goes to Chungking
    (whether that is a misdirected reprisal or a separate decision cannot be read from the page).
  - **Cost.** The nuclear system costs 69 to 79 % of the tick for years after the strikes (R6-B1).
- AoC has no AI nuclear use, only a God nuke. An AI that uses nukes at all is an addition, but the bar is 8 and the
  use must be believable to be better.

## Blocking issues, in priority order

1. **R6-B1. The nuclear age makes the game crawl.**
   - Seed 6619 from its year-12 save, pinned and alone, years 13 to 21 (`critic/c6_perf_6619_y13_21_solo.log`;
     years 13 to 15 again in `critic/c6_perf_6619_y13_15_solo.log`):
     - Years 13 to 19: 9.7 to 12.8 ms a tick, of which `nuclear` is 7.0 to 10.1 ms (69 to 79 %). That is one call a
       day of about 170 to 240 ms, max 436 ms.
     - Years 20 and 21: 5.6 and 5.8 ms, `nuclear` still 3.4 ms (58 to 61 %).
     - Years 9 to 11 had warheads but no strike and ran 3.0 to 4.0 ms (unpinned, `critic/c6_headless_6619.json`).
       So the cost comes with the strikes, not with the warheads, and only halves by year 20.
   - In the browser at Max a year takes 20 to 53 s before 1949 and 129 to 216 s after (`critic/c6_c_6619.json`, run
     beside my headless runs, so corroboration only).
   - Seed 99's year 1 is also over its budget: 3.77 ms against 2.4 (`critic/c6_perf_seed99_5y_solo.log`).
   - **Fix:** profile which part of the daily `nuclear` call costs 170 to 240 ms after strikes. Look at state the
     strikes create and that decays (fallout, outrage, shock, grievance, taboo) or the target scoring they feed. Then
     hold the late-game tick to the budget.
2. **R6-B2. The AI's nuclear use is not credible.**
   - First use: the Soviet Union on the statelet Free Van, three bombs in two days, utilities 0.01 to 0.39.
   - Warheads then fall one a day: three in a row on Pinsk and Kovel; Odense three times; Paramaribo, Aden, Malabo,
     Las Palmas; 7 of 36 on land no one holds.
   - Struck at London (1.37 million dead), the UK never hits back at the Soviet Union; its one bomb goes to Chungking. The US stockpiles 87 warheads for decades and never uses one,
     while the revolt statelet "Free Liège II" (founded #138) builds warheads and makes 11 strike decisions in
     1955 and 1956, on Germany, France, the Netherlands and British India.
   - Evidence: `critic/c6_headless_6619.json`, `critic/c6_headless_2953.json`, `critic/c6_nuke_where.json`,
     `critic/c6_c_6619.json`, `critic/shots/c6c_6619_a1_1_goto_1200.png`, `critic/shots/c6f_6619_pause_08.png`.
   - **Fix:**
     - No first use on a nation that cannot threaten the striker.
     - No second warhead on a spot already struck.
     - Targets at the front or the enemy's core, not far colonies.
     - Retaliation aimed at the nation that struck.
     - No bursts on land no one holds.
3. **R6-B3. The world still shatters into statelets** (runs 4 and 5, deferred).
   - 154 nations alive in year 30 on seed 6619 (77 founded in play), 153 on 2953.
   - "Free Liège II" holds Berlin in 1953.
   - The builder's own nuclear sweep fails the nations-alive limit on 2 of 10 seeds (255, 253).
   - Evidence: `critic/c6_headless_6619.json`, `critic/c6_headless_2953.json`, `critic/shots/c6c_6619_92_europe_end.png`,
     `docs/sweeps/2026-10-14-sweep-nukes.md`.
   - **Fix:** as before. The nuclear AI's favourite targets are these statelets, so this blocker feeds R6-B2.

## Non-blocking issues

- **Struck cities leave no mark.** A city nuked for 1.18 million dead looks unchanged at T2 and T3 ten days on.
  AoC's optional wasteland is the bar (`critic/shots/c6a_4127_33_berlin_150m_day10.png`, `c6a_4127_34_berlin_20m_day10.png`).
- **The T3 burst has no shape.** At 20 m/px it is a flat orange trapezoid filling the screen
  (`critic/shots/c6a_4127_1_london_20m_1000.png`).
- **The alert merges strikes at Max.** 20 strikes gave 11 banners, and each pause lands about a day late
  (`critic/c6_f_6619.json`).
- **The God nuke is atomic only.** It has no size setting, while AoC has one.
- **No nuclear line in the panel or charts.** The nation panel and charts show nothing nuclear: no warheads, nuclear
  dead or fallout (`critic/c6_a_4127.json`, `germanyPanel`).
- **A played nation cannot launch its own warheads.** No UI sends `launchNuke`.
- **No warhead was ever intercepted** in 55 AI bursts over 30 years on two seeds (`intercepted` 0 in both runs).
- **One atomic bomb kills over a million** (Berlin 1,179,205; London 1,371,914).
- **The AI's air war fades** (R5-B2, accepted by the user).
- **Huge air losses in 1938.** "108,646 men, guns and vehicles lost" to Germany's air force in Poland in one month
  of 1938 (`critic/c6_d_5861.json`).
- **"Pseudo-locale (i18n test)" in the player's language list** (`critic/c6_e_7043.json`).
- **Keys do nothing.** Escape closes no panel, and F2, F3, M and 2 change no map mode (`critic/c6_e_7043.json`).
- **Order arrows lie across sea and land views** (`critic/shots/c6d_5861_30_sea_row_clicked.png`).
- **The air legend's grammar** reads "Germany: 1 zones" (`critic/c6_d_5861.json`, `legend`).
- **Static giants.** Canada and the United States hold the same share of land for 30 years (`critic/c6_headless_6619.json`).
- **A save is 38.8 MB** (`critic/c6_e_7043.json`).
- **The editor cannot place warheads, airbases, ports or fleets.**

## Strengths, verified

- **Determinism holds across runtimes.** A headless checkpoint loads into the browser and replays the same nuclear war
  hour for hour. A save and load with fallout down reaches the same hash. All six browser sessions had no error
  (`critic/c6_f_6619.json`, `critic/c6_e_7043.json`).
- **The strike itself is well presented.** The banner names striker, victim and toll, "Go to" lands on the burst, and
  fallout reads clearly as a downwind fan in its own mode (`critic/shots/c6c_6619_a1_1_goto_1200.png`,
  `critic/shots/c6a_4127_32_fallout_berlin_800m.png`).

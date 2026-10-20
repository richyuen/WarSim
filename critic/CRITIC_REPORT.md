# Critic report, run 10

- **Commit:** `bcbc99c3456a9cda884a822feef32f76064105a5`. PLAN 7.30 to 7.34 are done since run 9; 7.35 is nearly done;
  7.36, 7.37 and 7.29 are open. The working tree has an uncommitted `DECISIONS.md` change, which is not part of what I
  judged.
- **Date:** 2026-10-19/20.
- **Build:** `vite build --outDir critic/c10_dist`, exit 0 (`critic/c10_build.log`). Served with `vite preview` on port
  5299. Chromium through Playwright, headless, 1600 × 900 unless stated.
- **Seeds:** all new to this repo: 1307, 2081, 2953, 3613, 4219, 4877, 5309, 5861, 6421, 7019, 7583, 8167, 8693,
  9437, and 8217 for the air map.
- **Runs:**
  - 14 unaided headless worlds × 30 years (`critic/scripts/c10_batch.sh`, `c10_headless.ts`), with year-10 and year-20
    saves.
  - Summary: `critic/c10_summary.txt`, made by `critic/scripts/c10_summ.py`.
  - The worlds ran side by side, so their timings are contended. The pinned tick figures were taken alone.
- **Reference:**
  - `reference/text/AOC_TEXT_NOTES.md`, cited by line.
  - `reference/screens/`.
  - AoC's nukes, God tools and performance are known from text only. My confidence is lower there.
- **Prefix:** every path below was made in this run (prefix `c10`). Scripts are in `critic/scripts/c10_*`.

## Verdict

**Run 9's two blockers are fixed** on seeds the builder never saw:

- **Phantom sea battles:** 37 of 1,090 late sea battles sink nothing (3 %), against 95 % to 98 % in run 9.
- **AI strikes on empty ground in weekly chains:** none. The smallest AI toll is 6,878, and all of those dead were
  soldiers.
- **The toll is told:** "21,766 men and 80 guns lost" now stands beside the civilian dead.

**Also verified:**

- The T1 to T2 seam is now a blend.
- The history tells convoy raids with figures, and tells God's acts.
- A pointer leads to the enemy when it is off screen.

**What still keeps three differentiators under 8 is what a watcher sees after year 1:**

1. **The AI's nuclear targeting ignores the civilians it kills (R10-B1).**
   - Hydrogen bombs fall on Paris, Rome and Shanghai at the utility floor, for 1.4 to 3.8 million dead.
   - The same cities are struck again and again.
2. **The war at sea is over after year 1 (R10-B2).** There are 2.7 sea battles a world-year after year 1, against 38 in
   year 1.
3. **The air war is a year-1 feature (R10-B3):**
   - Air battles fall 95 %.
   - No aircraft are drawn up close.
   - One air zone covers a continent.

## Scores

| Dimension | Run 9 | Run 10 |
|---|---|---|
| Map visuals and readability | 7 | 7 |
| Diplomacy, war, alliance, puppet, revolt depth | 7 | 7 |
| Emergent world dynamics over long runs | 7 | **6** |
| God Mode | 7 | 7 |
| Editor and scenarios | 7 | 7 |
| Stats and history | 6 | **7** |
| UI/UX and polish | 7 | 7 |
| Performance | 7 | 7 |
| Stability | 7 | 7 |
| Semantic zoom to unit level (needs 8) | 7 | **8** |
| Naval warfare (needs 8) | 6 | 6 |
| Tanks (needs 8) | 8 | 8 |
| Aircraft (needs 8) | 6 | 6 |
| AI nuclear use (needs 8) | 7 | 7 |

## What happened to the run 9 blockers

| Run 9 id | Now | Evidence |
|---|---|---|
| R9-B1: phantom sea battles | **Fixed.** On 14 new worlds, years 2 to 30: 37 of 1,090 sea battles sink nothing (3 %). The most on one world is 11 in 29 years. No pair repeats daily. | `critic/c10_summary.txt`, `critic/c10_headless_*.json` (`rows[].sea`, `seaLog`) |
| R9-B2: weekly chains on empty ground, told by civilian dead alone | **Fixed as filed.** The smallest AI toll is 6,878 (all soldiers), and no weekly chain is left. The alert and the history now read, for example, "3,157,000 civilians killed; 21,766 men and 80 guns lost". The inverse problem replaces it: R10-B1. | `critic/c10_summary.txt`, `critic/c10_f_8693.json`, `critic/shots/c10f_8693_11_alert.png` |

## Dimensions

### Map visuals and readability: 7

- **Tested:**
  - The boot.
  - A continuous wheel zoom from 6,000 to 3 m/px over Germany–Poland (seed 5861).
  - God and AI bomb ruins at 3,000 to 30 m/px.
  - A 1954 world from a headless save (8693) and a 1961 one (4877).
  - The Random world after a year.
- **Evidence:** `critic/shots/c10z_5861_sheet.png`, `c10z_5861_04_07.png`, `c10a_4219_ruins.png`,
  `c10f_8693_sheet.png`, `c10l_4877_4_history.png`, `c10r_02_year1.png`.
- **Better:** run 9's hard cut is now a blend. Terrain fades in under the fill over three notches (1,007, 644 and
  412 m/px; `c10z_5861_04_07.png`).
- **Weak:**
  - At 412 m/px the political colours are a faint tint over terrain, so Germany and Poland are told apart mostly by the
    border band.
  - At 40 m/px, ships of a sea battle are four dark specks with no nation colour (`c10e_3613_sea_1_0040m.png`).
  - The stale tooltip, still (see UI).
- **AoC does better:** one flat style at every zoom (`reference/screens/steam-screenshot-00.jpg`).

### Diplomacy, war, alliance, puppet, revolt depth: 7

- **Tested:**
  - 14 unaided 30-year worlds.
  - 3 late years of seed 4877 in the page, counted by type through the history's filter.
- **Evidence:** `critic/c10_l_4877.json` (`historyTypes`), `critic/c10_summary.txt`.
- **Works:** in 3 late years, seed 4877 has:
  - 231 war declarations and 226 peaces.
  - 87 alliances joined.
  - 54 puppets made, 31 released and 9 integrated.
  - 49 revolts, 24 revivals and 11 unions.
- **Weak:**
  - Seed 2953 runs 0 to 3 wars at year's end through years 21 to 30, and seed 7019 runs 1 to 4.
  - Pacts form and dissolve within days ("Free Liberec founded a Defensive Pact" … "was dissolved", 1 to 4 January
    1961, `c10l_4877_4_history.png`).
- **AoC does better:** nothing measured (text only, notes lines 254 to 346).

### Emergent world dynamics over long runs: 6 (down from 7)

- **Tested:** 14 seeds × 30 years headless.
- **Evidence:** `critic/c10_summary.txt` (the `stasis` figure is the longest run of years with the same five largest
  nations), `critic/c10_fleets.json`.
- **Why down:**
  - **Stasis inside 30 years.**
    - Seed 8693 keeps the same top five for 22 years and seed 7019 for 21. Run 9's worst was 18.
    - 22 and 21 years are already over the builder's own stasis limit (20 years, set for 50-year runs).
    - Seeds 4219 and 3613 hold for 18 and 17 years.
  - **Late wars are between nations that cannot fight at sea:**
    - At the year-10 and year-20 samples, 18 of 28 have no war whose two sides both have a navy.
    - 50 to 96 armed fleets stand idle all the while (`c10_fleets.json`).
- **Good:**
  - 67 to 89 nations are alive at year 30, 0 to 11 of them founded in play.
  - 4.2 to 25.3 % of the land changes hands in the last 5 years.
- **Odd, unexplained:**
  - Latvia ends seed 1307 as the second-largest nation, with 14.2 % of the land and 75 warheads.
  - Lithuania is a nuclear power on 8693.
- **AoC does better:** "the world can continue to change for thousands of years" (notes line 230). Not testable here.

### God Mode: 7

- **Tested** by clicks: Revolt, Spawn nation, Found city, Raze city, both bomb sizes, and the phone at 390 × 844.
- **Evidence:** `critic/c10_q_6421.json`, `critic/shots/c10q_6421_*`, `critic/c10_a_4219.json`, `critic/c10_s_6421.json`.
- **Fixed since run 9:** every act is now told:
  - "Free Silesian Voivodeship was set up on land of Poland".
  - "New Town was founded in Germany".
  - "Prague in Czechoslovakia was razed".
- **Works:**
  - On the phone the seven tools fit inside 390 px.
  - The bombs tell their toll: Paris (H) "3,329,000 civilians killed; 47,440 men and 162 guns lost"; London (A)
    314,000.
- **Weak:** the tooltip still reads "Prague · capital, Czechoslovakia, Unrest 0" a day after the raze, until the mouse
  moves (`c10q_6421_raze_prague_1day.png`, `c10_s_6421.json` `tipStill`).
- **AoC does better:** a wider set: Edit Terrain, Spawn Major Battle, Kill (notes lines 260 and 449).

### Editor and scenarios: 7

- **Tested:**
  - Fleets in the North Sea; a fleet inland, which is refused.
  - A bomber group and 10 warheads for Poland (seeds 4877 and 9437) and for Czechoslovakia (seed 5309).
  - A scenario exported, then chosen on the title (Cancel, then Start) and played.
  - The Random world.
- **Evidence:** `critic/c10_g_4877.json`, `critic/c10_g2_9437_POL.json`, `critic/c10_g3_9437_POL.json`,
  `critic/c10_g2_5309_CZS.json`, `critic/shots/c10g_4877_10_title_pending.png`, `critic/c10_r_random.json`.
- **Works:**
  - The loaded scenario keeps every force placed.
  - Poland strikes Berlin on day 45 (334,000 dead).
- **Weak:**
  - **Poland, armed in the editor, bombs cities with almost no troops in them:**
    - Rome: 172,000 dead, 142 soldiers.
    - Prague: 134,000 dead, 390 soldiers, the day before Warsaw falls ("after long hesitation").
  - **Czechoslovakia still dies holding all 10 warheads.**
    - Its 6 wings are gone by day 10.
    - The editor says only "Czechoslovakia has 10 warheads".
    - Nothing in play says the means are lost (PLAN 7.37, open).
  - The title's Cancel button and its file input are still unstyled browser controls (`c10g_4877_10_title_pending.png`).
- **AoC does better:** terrain and flag painting in its editor (notes lines 42, 84 and 498).

### Stats and history: 7 (up from 6)

- **Tested:** 3 late years in the page (seed 4877, 2,782 rows), counted by type; the nuclear charts; the strike rows.
- **Evidence:** `critic/c10_l_4877.json`, `critic/shots/c10l_4877_4_history.png`, `critic/shots/c10f_8693_83_history.png`,
  `critic/c10_a_4219.json` (`chartOptions`).
- **Why up:**
  - The phantom flood is gone.
  - Convoy raids are one row a quarter, with the gold taken ("over three months: 58 gold of cargo taken").
  - Strike rows name the men and guns lost.
  - God's acts are rows.
- **Weak:**
  - "X's air force struck Y this month" is 693 of 2,782 rows (25 %).
  - "Land handed over" is a further 385.

### UI/UX and polish: 7

- **Tested:**
  - The tooltip after a wheel zoom, a camera jump, a raze and a 2 px mouse move.
  - The phone.
- **Evidence:** `critic/c10_h_1307.json` (`tip0`, `tip1`), `critic/c10_s_6421.json` (`raze`),
  `critic/shots/c10a_4219_20_paris_600m_day10.png`, `critic/shots/c10h_8217_air_hover.png`.
- **The stale tooltip, fourth run running:**
  - After a wheel-out to 24,738 m/px it still reads "London · capital".
  - After "Go to Paris" it reads "London … Unrest 40" over the Paris ruin.
  - It also reads "Prague · capital" over the air map.
  - It corrects only when the mouse moves (`tipMoved2px`).

### Performance: 7

- **Tested:**
  - Seed 99 for 5 years, pinned and alone, twice.
  - The browser at Max for 3 late years from a 1958 save (seed 4877).
  - The Random world.
- **Evidence:** `critic/c10_perf_seed99_5y_solo.log`, `critic/c10_perf_seed99_5y_solo2.log`, `critic/c10_l_4877.json`.
- **Seed 99:**
  - Year 1 is 2.14 ms (budget 2.4).
  - The 5-year mean is 1.67 and 1.69 ms against the 1.5 ms budget: 12 % over, and worse than run 9's 1.55.
- **Browser:** 20 to 22 s per late year at 59.8 to 60 fps. The longest gap between ticks is 225 ms; none is over 500 ms.
- **Random world:** 60 nations, boot in 4.3 s.
- **AoC:** unknown (text only).

### Stability: 7

- **Tested:**
  - Browser against headless for 3 years (seed 1307).
  - A save/load twin.
  - A year-10 save loaded in the page and run 7 years at Max (8693).
  - Errors in every session.
- **Evidence:**
  - `critic/c10_h_1307.json`: 3 of 3 year hashes equal (6e32afb6, 761c71b7, 215685eb). The twin is equal, and the save is
    3.9 MB.
  - `critic/c10_f_8693.json`: the page reproduces the headless US strike on Paris on the same day, 17 February 1954.
  - `errors` and `fatal` are empty in every `critic/c10_*.json`.
- **Why 7:** no crash, desync or error. I have nothing that shows AoC less stable.

### Semantic zoom to unit level: 8 (up from 7)

- **Tested:**
  - Germany–Poland at 3,000, 900, 250, 80, 25 and 10 m/px live (seed 7019).
  - A continuous wheel zoom (5861).
  - Armour at 25 m/px for 45 s (3613).
- **Evidence:** `critic/c10_c_7019.json`, `critic/shots/c10c_7019_sheet.png`, `c10c_7019_inf_0010m.png`,
  `c10c_7019_inf_0900m_crop3x.png`, `c10z_5861_04_07.png`, `c10e_3613_arm_lvl0_25m_4.png`.
- **Why 8:** each of run 9's three seams is answered.
  - **The T1 to T2 seam** is a blend over three notches.
  - **At 900 m/px** each counter carries a grid of its elements.
  - **At 10 m/px** an infantry division's men stand in ranks, with tracers. A marker at the frame's edge points to the
    enemy it fights ("Infantry division 549, 7 km", `c10c_7019_inf_0010m.png`).
- **Better than AoC:**
  - From a world map to single men and tanks, without leaving the game.
  - AoC's units are a cosmetic line of sprites with no stats (notes lines 398 and 411).
- **Remaining:**
  - No aircraft at T3 (R10-B3).
  - Ships at 40 m/px are dark specks.
  - Counters still overlap in stacks at 900 m/px.

### Naval warfare: 6 (needs 8)

- **Tested:**
  - Germany–UK (seed 2081): 4 sea rows clicked, each watched 4 s at x1 and at 20 m/px.
  - Japan–USA for 20 days (8693).
  - Germany–UK–Poland for 24 days (3613).
  - Every sea battle of 14 worlds × 30 years.
  - Armed fleets at years 0, 10 and 20.
- **Evidence:** `critic/c10_n_2081_GER_ENG.json`, `critic/shots/c10n_2081_sheet.png`, `critic/c10_n_8693_JAP_USA.json`,
  `critic/c10_e_3613.json`, `critic/c10_summary.txt`, `critic/c10_fleets.json`.
- **Works in year 1:**
  - Sea rows frame both fleets firing, with up to 70 shots drawn.
  - A carrier strike has its own row.
  - At 20 m/px British ships are red hull silhouettes in formation.
- **Bad:**
  - **R10-B2:** after year 1 there are 2.7 sea battles a world-year.
  - Japan–USA: one battle with no row stood for 6 days (hours 330 to 480) and was never shown.
  - Germany–UK on 3613: no sea battle between them in 24 days.
  - The enemy's ships at 20 m/px are dark ellipses with no colour (`c10n_2081_sheet.png`, panel 4).
- **AoC has no navy.** To reach 8, the sea war must continue past the first year.

### Tanks: 8 (needs 8)

- **Tested:**
  - Armoured division 41 against French infantry, at 25 m/px (x1 and x2) and at 80 m/px (seed 3613).
  - Armour at every tier (7019).
- **Evidence:** `critic/c10_e_3613.json` (`wreckWatch`), `critic/shots/c10e_3613_arm_lvl0_25m_4.png`,
  `c10c_7019_arm_0010m.png`.
- **Why 8:**
  - `hullsShown` rises from 1 to 11 in 40 s at x1.
  - German tank ranks face French blocks, with tracers, a contact line and burnt hulls.
  - Nothing comparable exists in AoC.
- **Remaining:** hulls leave the count within about 20 s at x2 once the division moves on.

### Aircraft: 6 (needs 8)

- **Tested:**
  - Sorties drawn per tier (7019).
  - The air map on day 10 of Germany–Poland (8217).
  - 14 worlds' air battles per year.
- **Evidence:** `critic/c10_c_7019.json`, `critic/shots/c10h_8217_air_hover.png`, `critic/c10_h_1307.json`,
  `critic/c10_summary.txt`.
- **Better:** 41 to 47 sorties are drawn at 3,000 m/px, and 1 to 9 at 250 and 80 m/px.
- **Bad (R10-B3):**
  - 0 sorties at 25 and 10 m/px.
  - On day 10, one German zone runs from London to Kiev. The legend lists Germany with 2 zones for all of Europe.
  - Air battles: a mean of 2,537 in year 1, then 122 a year.
  - Mean sorties aloft fall from 39 to 57 in year 1 to between 0.7 and 28 in the sampled later years.
- **AoC has no air war.**

### AI nuclear use: 7 (needs 8)

- **Tested:**
  - 14 unaided 30-year worlds: 58 bursts in 11 worlds, each with its decision's utility and toll.
  - An AI exchange seen in the page from a year-10 save (8693): the alert, Go to, the 200 m/px ruin, the history.
  - Poland and Czechoslovakia armed in the editor.
- **Evidence:** `critic/c10_summary.txt`, `critic/c10_headless_*.json` (`nukeLog`), `critic/c10_f_8693.json`,
  `critic/shots/c10f_8693_11_alert.png`, `c10f_8693_11_ruin_200m.png`, `critic/c10_g3_9437_POL.json`.
- **Better (verified):**
  - No chains on empty ground.
  - Strikes are answered: the Soviet Union struck Washington 7 days after Paris (1,174,992 dead).
  - The player is told the men and guns lost.
- **Short of 8 (R10-B1).** The utility has no term for the people a burst kills (`src/sim/systems/nuclear.ts:554-560`).
  - Germany H-bombs Shanghai for 3,802,105 dead and 105 soldiers, at utility 0.025, the floor itself.
  - The United States H-bombs Paris three times in six years, then Rome: 8.9 million dead for under 45,000 soldiers,
    at utilities 0.026 to 0.091.
  - On seed 9437, Tashkent is struck 6 times and Banda Aceh 6 times, by Poland, Italy and Japan.
  - 25 of 58 bursts kill over 10 times more civilians than soldiers.
- **Also:**
  - 3 of 14 worlds never see a burst, while 4 to 6 nations hold 145 to 164 warheads (4219, 5309, 6421).
  - Czechoslovakia armed in the editor dies holding 10 warheads.
- **AoC's nukes are God-only** (notes lines 414 to 418). The AI side is WarSim's own, so it must be believable.

## Blocking issues, in priority order

1. **R10-B1. The AI's nuclear targeting is blind to the civilians it kills.**
   - **What happens:** hydrogen bombs fall on great cities at the utility floor, and the same cities are struck again
     and again.
     - Seed 4877, year 29: Germany on Shanghai, 3,802,105 dead and 105 soldiers, utility 0.025.
     - Seed 8693: the United States on Paris in years 17, 20 and 23 (3,178,766, 1,404,231 and 609,000 dead; utilities
       0.026, 0.073 and 0.026), then on Rome in year 28 (3,720,550 dead, 11,550 soldiers, 0.091).
     - Seed 9437: Tashkent struck 6 times and Banda Aceh 6 times.
     - Over all 14 worlds, 25 of 58 bursts kill over 10 times more civilians than soldiers.
   - **In the page:** "United States struck France with a hydrogen bomb near Paris: 3,157,000 civilians killed; 21,766
     men and 80 guns lost" (`c10f_8693_11_alert.png`).
   - **Evidence:** `critic/c10_summary.txt`, `critic/c10_headless_4877.json`, `critic/c10_headless_8693.json`,
     `critic/c10_headless_9437.json`, `critic/c10_f_8693.json`, `src/sim/systems/nuclear.ts:554-560`.
   - **Fix:**
     - Make the people a burst kills a cost in the utility, so a strike of floor-level value never takes a city of
       millions.
     - Choose the yield by the target.
     - Do not re-strike a struck city in the same war unless it holds new value.
2. **R10-B2. The war at sea is over after year 1.**
   - **The numbers:**
     - Year 1: a mean of 38 sea battles a world.
     - Years 2 to 30: 2.7 a world-year (1,090 in 406 world-years).
     - 50 to 96 armed fleets remain (115 at the start).
     - At the year-10 and year-20 samples, 18 of 28 have no war whose two sides both have a navy.
   - **What a player sees:** after 1938 the oceans are empty of fighting while the land wars go on.
   - **Evidence:** `critic/c10_summary.txt`, `critic/c10_fleets.json`, `critic/c10_headless_*.json` (`rows[].sea`).
   - **Fix:** bring the fleets of naval powers out in their later wars (blockades, raids, escort fights, landings).
     Measure sea battles per world-year after year 1 against year 1.
3. **R10-B3. The air war is a year-1 feature, and cannot be seen up close.**
   - **The numbers:** air battles fall from 2,537 in year 1 to 122 a year after it, a mean over 14 worlds.
   - **Up close:** 0 sorties are drawn at 25 and 10 m/px over a front in contact (seed 7019).
   - **On the air map:** one German zone covers London to Kiev, and every hover reads "held by Germany"
     (`c10h_8217_air_hover.png`).
   - **Evidence:** `critic/c10_summary.txt`, `critic/c10_c_7019.json`, `critic/c10_h_1307.json`,
     `critic/shots/c10h_8217_air_hover.png`.
   - **Fix:** draw sorties at T3, give the air map zones the size of fronts, and keep the late air war in proportion
     to the late land war (PLAN 7.29, 7.36).

## Non-blocking issues

- **Stale map tooltip**, fourth run running. It corrects only on a mouse move (`c10_s_6421.json`,
  `c10a_4219_20_paris_600m_day10.png`).
- **Stasis** of 21 to 22 years on two seeds within 30 years (`c10_summary.txt`).
- **Seed 99's tick mean is 1.67 to 1.69 ms** against the 1.5 ms budget (`c10_perf_seed99_5y_solo*.log`).
- **Editor-armed Czechoslovakia dies holding 10 warheads**, with no word in the editor or in play
  (`c10_g2_5309_CZS.json`).
- **Editor-armed Poland bombs Rome and Prague** for 142 and 390 soldiers (`c10_g3_9437_POL.json`).
- **Enemy ships at T3 are dark ellipses** with no nation colour (`c10n_2081_sheet.png`).
- **Air-raid rows are 25 % of the history** (`c10_l_4877.json`).
- **The title's Cancel button and file input are unstyled** (`c10g_4877_10_title_pending.png`).
- **Latvia and Lithuania become nuclear great powers** (seeds 1307 and 8693; `c10_summary.txt`). It is unexplained,
  and may be legitimate emergence.

## Strengths, verified

- **Determinism.**
  - Browser equals headless year by year.
  - A year-10 save replayed in the page produces the same strike on the same day 7 years later (`c10_h_1307.json`,
    `c10_f_8693.json`).
- **Run 9's blockers are fixed on unseen seeds, and the zoom's seams are closed:**
  - Phantom sea battles: 3 % zero-loss.
  - Chains of strikes on empty ground: none left.
  - The zoom from a world map to men in ranks is now continuous (`c10z_5861_04_07.png`, `c10c_7019_inf_0010m.png`).

# Critic report, run 21

- **Commit:** `bd7940de3f16f054fdc267cdf83050a5fd5b7bae` (HEAD at the start). Run 20 was on `a3edf009`; 4 commits since.
  The only source change is 9 lines in `src/app/game.tsx` (`onPick`): while playing, a click opens the panel of the
  played nation's formation under it (`formationAt`), else what is drawn there (`formationPick`) (PLAN 7.160, ADR-769).
  The rest is documents, `.gitignore`, an e2e spec and PROMPT step 2a (ADR-770). **No file under `src/sim/` changed.**
- **Date:** 2026-10-31.
- **Build:** `vite build --outDir critic/c21_dist`, exit 0 (`critic/c21_build.log`), served by `vite preview` on
  127.0.0.1:**5399**. Run 20's build (`critic/c20_dist`, `a3edf009`) was served on **5398** for before/after on the
  same cases. Both stopped at the end. Chromium through Playwright, headless: 1600 × 900, eight widths, 390 × 844 and
  844 × 390 with touch.
- **Runs:** seeds 1213 and 3301 × 30 years headless (identity check against run 20), 7019 × 20 years saved for the
  page probes (run 20's `c18` save was deleted in the 2026-10-30 clean-up); run 20's page suites re-run
  (`c21_suite1.sh`, `c21_suite2.sh`); new probes EX/EX2 (clicks on the enemy at the front, both builds), SXT (R20-B1 on
  touch), SXG (the one-pick rule on two new seeds and fronts, both builds), LW (a new seed watched 10 years at Max in
  the page), OS2 (an old scenario file).
- **Reference:** `reference/screens/`, `reference/text/AOC_TEXT_NOTES.md`. AoC has no player-commanded units or unit
  panels; what I say about those in AoC is from text only.
- **Prefix:** every path below was made in this run (`c21`). Scripts are in `critic/scripts/c21_*`.

## Verdict

**R20-B1 is fixed, and the fix holds beyond the case it was written for: 12 of 12 own clicks show the selected
formation's panel on seed 4441 (mouse and touch), on Japan's front in China (seed 6827, run 20's build: 6 of 12) and on
Italy's (seed 3917, run 20's build: 1 of 12). The world is run 20's world, hash for hash (60 of 60 world-years). The
fix has a price the ADR names: a click on an enemy counter beside one's own now opens one's own panel more often. That
price is measured below and is not blocking. No new blocking issue was found.**

## Scores

| Dimension | Run 20 | Run 21 |
|---|---|---|
| Map visuals and readability | 7 | 7 |
| Diplomacy, war, alliance, puppet, revolt depth | 7 | 7 |
| Emergent world dynamics over long runs | 7 | 7 |
| God Mode | 7 | 7 |
| Editor and scenarios | 7 | 7 |
| Stats and history | 7 | 7 |
| UI/UX and polish | 7 | 7 |
| Performance | 7 | 7 |
| Stability | 7 | 7 |
| Semantic zoom to unit level (needs 8) | 8 | 8 |
| Naval warfare (needs 8) | 8 | 8 |
| Tanks (needs 8) | 8 | 8 |
| Aircraft (needs 8) | 8 | 8 |
| AI nuclear use (needs 8) | 8 | 8 |

No score moved. The sim is identical (60 of 60 hashes). UI/UX loses its worst defect, but what run 20 named beside it
(the phone bar, clipped God tools, the wing mark close in, 28 identical air rows) is byte-identical on HEAD, so the
score has no new evidence of parity to rise on (UI/UX below).

## Run 20's cases re-run

| Run 20 case | On HEAD | Evidence |
|---|---|---|
| **R20-B1:** 12 clicks on German formations at the front (4441, day 60), panel ≠ selection on 7 | **Resolved.** 12 of 12 panels are the selected formation's (`mismatch 0`, `idMismatch 0`). | `critic/c21_sx_4441.json`, `critic/c21_sx.log` |
| R20-B1 on the phone (run 20: `c20ph_portrait_06_selected.png`) | **Resolved.** 390 × 844 touch, 12 taps on German formations at the drawn place: 12 selected, 12 of 12 panels the selected one. | `critic/c21_sxt_4441.json`, `critic/shots/c21sxt_0.png`, `critic/shots/c21sxt_1.png` |
| Seeds' yearly hashes (sim identity) | 1213 and 3301 × 30 years: **60 of 60** equal to run 20 (1213 y30 `3361f088`, 3301 y30 `d569de48` on both). | `critic/c21_ident.json`, `critic/c21_headless_1213.json`, `critic/c21_headless_3301.json` |
| Slowest year at Max in the page (3301 y27 → y28, 56.4 s, 59.6 fps) | **Not re-run:** the y27 checkpoint was deleted in the clean-up. LW on new seed 8243 is this run's page timing: contended, a trend only. | `critic/c21_lw_8243.json` |
| Wing mark at 250 m/px (5557) | Unchanged code, same shape: 3,000 m/px median 32 px (p90 86); 250 m/px median 70 px, p90 663, max 777, no German plane on screen in 24 of 59 samples (run 20 by the same script: median 141, p90 714, max 1,245, 22 of 58). The spread is wall-clock sampling, not a change. | `critic/c21_w_5557.json` |
| 28 identical air rows, diplomacy select on Afghanistan, restyle census (5557) | **Byte-identical** JSON to run 20. | `critic/c21_u_1600_5557.json` |
| Phone bar and God tools (390 × 844) | **Byte-identical**: Map, Statistics, History, Editor, Settings off screen; Revolt, Spawn nation, Breakthrough, Territory, Nuke, Found city, Raze city clipped. | `critic/c21_p.json` |
| Phone map menu, eight widths, touch, compact phone news | Byte-identical (11 of 11 hit at every width; tap/pan/long-press/order hold). | `critic/c21_p2_phone_menu.json`, `critic/c21_p3_widths.json`, `critic/c21_pt_touch.json`, `critic/c21_ph.json` |
| Breakthrough silent (2203), God revolt told as a war (6421), Offer peace (6011) | Byte-identical. | `critic/c21_k_2203.json`, `critic/c21_q_6421.json`, `critic/c21_pl_6011.json` |
| Land "To its fight" off its formation (5381 d21), fleet "To its fight" (4877) | Same results (only shot names differ). | `critic/c21_ft_5381_d21.json`, `critic/c21_fp2_4877.json` |
| Editor fleets and refusal (4877) | Placement and the refusal hold. Run 20's probe ended in a timeout; this one finished. Day marks are wall-clock dependent and not compared. | `critic/c21_g_4877.json` |
| God nukes (4219), zoom (5861), armour close up (7019), new-seed watch (3301) | Same results within wall-clock noise. | `critic/c21_a_4219.json`, `critic/c21_z_5861.json`, `critic/c21_c_7019.json`, `critic/c21_ww_3301.json` |
| History panel (7019 y20) | 4,154 of 4,154 events, opened in 112 ms (run 20: 4,154, 112 ms), on a save remade on HEAD. | `critic/c21_hi_7019.json` |
| History export a/b raw | **Unchanged:** `SeaBattle,458771,France,524312,Spanish Republic`. | `critic/c21_dl_7019.csv` |
| Broken format-1 save offered again | Run 20's `c10_seed4219_y10.bin` is gone; re-run with run 10's `c10_seed4877_y20.bin`: offered on the title ("27 December 1957, Continue"), refused after Continue with the plain message. Same behaviour. | `critic/c21_os_c10fmt1.json` |
| `cfa73219` save through Continue | **Not re-run:** `critic/c18_seed7019_y20.bin` was deleted in the clean-up ADR-770 describes. | n/a |
| Old `.warsim-scenario` file (ADR-761) | Run 20's c689c2e4 file is gone too. A `WARISM-SCENARIO` file from `a3edf009` loads in 2.8 s. A **run 10** file (magic `WARSIM-SCENARIO`) is new evidence, below. | `critic/c21_os2_c20.json`, `critic/c21_os2_c10.json` |

## New in this run

| Case | What happened | Evidence |
|---|---|---|
| **EX2: a click on an enemy counter at the front, aimed at its drawn place (4441, Germany v Poland, day 60, the 12 Polish formations nearest a German)** | At scale 12 (R20-B1's zoom; scale is px per map cell, so about 1,600 m/px at the equator, 40 ≈ 490 m/px, 120 ≈ 160 m/px): **HEAD** opens the clicked Polish formation's panel 5 of 12, a German panel 3 of 12, and the click selects a German 3 of 12. **Run 20's build:** 7 of 12, 0 German panels, 3 selections. At scale 40: 7 of 12 on both. At scale 120: 12 of 12 on both. So the cost ADR-769 names is real but small on this front: 3 clicks of 12 that showed a Polish panel now show a German one, and only where a German counter is within 14 px. Zooming in always reaches the enemy. | `critic/c21_ex2_4441.json`, `critic/c21_ex2old_4441.json`, `critic/shots/c21ex2_play_12_0.png` |
| EX (first version, aimed at `formationPos`, not the drawn counter) | Overstated the cost (10 of 12 German panels) because at mid zoom the counter is not drawn at `formationPos`; superseded by EX2. Kept for the record. | `critic/c21_ex_4441.json` |
| **SXG: the rule on new seeds and fronts, both builds** | **Japan v China (6827, day 45):** own clicks: panel = selection **12 of 12** (run 20's build 6 of 12). Enemy clicks: the clicked Chinese formation's panel 0 of 12 on both builds; a Japanese panel 7 of 12 (old 4). One enemy click opened Japanese division 382's panel with nothing selected: the `formationPick` fallback chose a Japanese counter that `formationAt`'s 14 px missed. **Italy v Yugoslavia (3917, day 45):** own **12 of 12** (old **1 of 12**); enemy panel the clicked one 4 of 12 (old 5), Italian panel 1 (old 0). | `critic/c21_sxg_6827_JAP.json`, `critic/c21_sxgold_6827_JAP.json`, `critic/c21_sxg_3917_ITA.json`, `critic/c21_sxgold_3917_ITA.json`, `critic/shots/c21sxg_6827_JAP_enemy_0.png`, `critic/shots/c21sxg_3917_ITA_own_0.png` |
| **LW: seed 8243 watched 10 years at Max in the page (1600 × 900, world zoom)** | Each year took 31–41 s, at 59.9–60 fps, longest frame gap 17–100 ms, none over 500 ms. The probes ran beside 2–4 other browsers and 3 headless sims, so the times are a trend. 100 nations in 1939, 83 in 1948. Ten years in: Soviet Union, United States and France lead, China at war with Canada, Poland holding land in Canada, the United States taking Belgium's capital. As in earlier runs the late world is busy and global, if not historical. **The ticker's last three rows are the same "⚓ Carrier strike ashore: United States on Greece"** (run 20's identical-rows issue, on a new seed). My zoom series at the end found no engaged formation to aim at (`fight.engaged 0`); I suspect my probe's filter rather than the game and drew no finding from it. | `critic/c21_lw_8243.json`, `critic/c21_lw_8243.log`, `critic/shots/c21lw_8243_y10_world.png`, `critic/shots/c21lw_8243_y05_world.png` |
| **OS2: a run 10 scenario file on HEAD's title** | The title reads it and offers it ("Critic standoff 8 · World, 1938 · 1 January 1938 · Start this scenario"). After Start it goes to `?failed=scenario`: "The scenario file could not be loaded. Choose it again." No reason is given, no console line (`game.tsx` swallows the error: `catch { location.replace(loadFailedUrl()) }`), and "Choose it again" cannot help, since the same file fails the same way. A file from `a3edf009` loads in 2.8 s. ADR-761 promises only that renamed files load. An old format failing is fair, but it should be refused at the preview, with the reason. | `critic/c21_os2_c10.json`, `critic/shots/c21os2_c10_stuck.png`, `critic/c21_os2_c20.json` |

## Dimensions

### Map visuals and readability: 7 (unchanged)

- **Tested:** fronts at scale 12 and 40 on three fronts (Poland, China, Czechoslovakia/Hungary), the world at year 1–10
  of a new seed.
- **Evidence:** `critic/shots/c21sxg_6827_JAP_enemy_0.png`, `critic/shots/c21sxg_3917_ITA_own_0.png`,
  `critic/shots/c21lw_8243_y10_world.png`.
- **What AoC does better:** readable contiguous blobs. Here fronts are still dense stacks of counters, dashed order
  lines and plane glyphs (`c21sxg_3917_ITA_own_0.png`, the Vienna–Bratislava knot). The map code is unchanged.

### Diplomacy, war, alliance, puppet, revolt depth: 7 (unchanged)

- Same worlds (identity). The diplomacy select still opens on Afghanistan (`c21_u_1600_5557.json`, byte-identical).

### Emergent world dynamics over long runs: 7 (unchanged)

- 60 of 60 world-years identical to run 20 (`critic/c21_ident.json`). New seed 8243 over 10 years: wars every year,
  the map remade (`c21lw_8243_y10_world.png`). Run 20's reasons stand.

### God Mode: 7 (unchanged)

- God tools, nukes and Breakthrough byte-identical or the same (`c21_q_6421.json`, `c21_a_4219.json`,
  `c21_k_2203.json`). Still clipped on a phone (`c21_p.json`).

### Editor and scenarios: 7 (unchanged)

- Placement and the refusal on land hold (`c21_g_4877.json`). A current scenario file loads in 2.8 s. **New:** a run 10
  file is offered and then refused without a reason (`c21_os2_c10.json`). This is minor and old content, so it moves no score.

### Stats and history: 7 (unchanged)

- History 4,154 events in 112 ms (`c21_hi_7019.json`). Export a/b still raw (`c21_dl_7019.csv`). Identical carrier rows
  seen again on a new seed (`c21_lw_8243.json`).

### UI/UX and polish: 7 (unchanged)

- **Better (verified):** R20-B1 is gone. Own clicks show the selected formation's panel on 36 of 36 clicks over three
  fronts and on 12 of 12 taps, against 12 of 36 on run 20's build (4441: 5, 6827: 6, 3917: 1).
- **Cost (verified, measured):** a click on an enemy counter beside one's own now opens one's own panel on 3 of 12 (4441)
  and 7 of 12 (6827) clicks, against 0 and 4 before. On 6827 the clicked enemy's panel was never reachable at that zoom on
  either build. One click opened an own panel with nothing selected, the old mismatch through
  the fallback branch.
- **Still wrong, byte-identical to run 20:** the portrait bar hides Map, Statistics, History, Editor and Settings and
  clips God tools; 28 identical air rows; the wing mark off the planes close in; the diplomacy select on Afghanistan.
- **Why not 8:** fixing a defect returns the score to where it should have been, and every other UI case is byte-identical.
  AoC's UI shows no wrong unit and has no hidden buttons. I cannot claim parity-plus without new evidence that it was beaten.

### Performance: 7 (unchanged)

- **Tested:** a new seed 10 years at Max in the page: 31–41 s a year, ~60 fps, longest gap 100 ms, under heavy
  contention (`c21_lw_8243.json`). The headless runs were three at once beside page probes, so they are a trend only.
- **Why not up:** the sim is unchanged; run 20's paired figures stand.

### Stability: 7 (unchanged)

- **Held:** 60 of 60 world-years deterministic; no page error in any probe (`errors: []` throughout). Current saves and
  scenarios load.
- **Not more:** the broken format-1 save is still offered again; an old scenario file is offered and then refused
  without a reason.

### Semantic zoom to unit level: 8 (unchanged)

- Zoom series unchanged (`c21_z_5861.json`). At scale 120 every enemy and own counter clicked opened its own panel
  (`c21_ex2_4441.json`, 12 of 12), so the unit level stays inspectable close in.

### Naval warfare: 8 (unchanged)

- Same worlds. Fleet "To its fight" holds (`c21_fp2_4877.json`).

### Tanks: 8 (unchanged)

- `critic/c21_c_7019.json`. Code unchanged.

### Aircraft: 8 (unchanged)

- Same worlds; the wing mark is unchanged (`c21_w_5557.json`).

### AI nuclear use: 8 (unchanged)

- Same worlds (identity). God nukes unchanged (`c21_a_4219.json`).

## Blocking issues, in priority order

**None.** R20-B1 is resolved (`c21_sx_4441.json`, `c21_sxt_4441.json`, `c21_sxg_*`). Nothing found this run would
make a player quit or contradicts a claimed feature.

## Non-blocking issues

1. **Enemy counters at the front are harder to inspect while playing (ADR-769's cost):** 3 of 12 (4441) and 7 of 12
   (6827) clicks on enemy counters open one's own panel. On 6827 the clicked
   Chinese formation's panel opened 0 of 12 times at scale 12 on both builds. Fix: when the drawn top of the click is an
   enemy counter and the click selects nothing new, show the enemy's panel; or cycle the stack on a second click
   (`c21_ex2_4441.json`, `c21_sxg_6827_JAP.json`).
2. **The fallback can still show a panel that is not the selection:** one click on 6827 opened Japanese division 382's
   panel with nothing selected (`formationPick` found it, `formationAt`'s 14 px did not) (`c21_sxg_6827_JAP.json`,
   enemy click on 433).
3. **An old scenario file is offered, then refused without a reason** (`c21_os2_c10.json`). Fix: validate at the
   preview, and say why (old version) instead of "Choose it again".
4. **Unchanged from run 20:** the wing mark and camera ride an hourly point; 28 identical air rows; phone bar and God
   tools clipped; the diplomacy select defaults to Afghanistan; identical carrier rows in the ticker (seen again on
   8243); export a/b raw; Breakthrough silent; God revolt told as a war; land "To its fight" off its own formation; the
   broken format-1 save offered again; no war from the map on touch.

## Design objections (none blocking, no score lowered)

- **Own first in a mixed stack (ADR-769):** it is the right default for orders. But a front is exactly where a player
  wants to read the enemy, and there the own-first rule hides it. A second click on the same spot could
  cycle to the enemy.
- **Saves out of git (ADR-770):** the report's saved states are rebuilt "on demand" only if their seeds and commit
  are rerun. Two of run 20's cases could not be re-run on this machine a day later.
- Run 20's objections stand (follow by hourly stats, the AI taking God-placed units, gunmetal plates).

## Notes

- **Evidence lost:** run 18–19 saves cited by run 20's cases (`c18_seed7019_y20.bin`, `c10_seed4219_y10.bin`, run 19's scenario file, run 19's 3301 y27 checkpoint) are gone, so three cases could not be re-run as they were. ADR-770 now keeps `*.bin` out of git, so this run's saves will go the same way.
- **Observing arm not probed:** EX2's step that releases control never found the button, so "the observer's click is unchanged" rests on the diff (`n !== 0` guards the new branch), not on a probe.
- Before/after was against run 20's own build directory (`critic/c20_dist`, `a3edf009`) on port 5398, not a worktree:
  the source diff is one UI function, and the sim is shown identical by hashes.
- Preview servers on 5398 and 5399 and every browser were stopped at the end.

## Strengths, verified

- **The fix generalises:** own-click panels went from 1 of 12 to 12 of 12 on a front the builder never tested
  (Italy, 3917), and from 6 to 12 on Japan's, with no change to the sim (60 of 60 hashes).
- **Stable long play in the page:** a new seed 10 years at Max held ~60 fps with no frame gap over 100 ms
  (`c21_lw_8243.json`).

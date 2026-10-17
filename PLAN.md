# WarSim — Phased Plan

Rules: each task is small and verifiable. `AT:` is the acceptance test that must
pass before ticking. Work top-down, and split a task if it grows past one iteration.
"Gate" = the full suite (tsc, eslint, vitest, build, parity) passes.
Balance sweeps are suspended until phases 2–6 are complete (ADR-58, PROMPT "KEEPING ITERATIONS
SHORT"): no sweep after a rule change. Each of those phases ends with a review that runs one
quick sweep as a smoke test.

## Phase 0 — Foundations & benchmarks

## Phase 1 — Baseline parity

### 1A Data & scenario

### 1B Core sim

### 1C Presentation & tools

## Phase 2 — Semantic zoom

## Phase 3 — Armour

## Phase 4 — Naval

## Phase 5 — Air

## Phase 6 — Nuclear AI

## Phase 7 — Balance, polish, soak

- [ ] 7.4 Visual polish vs reference (borders, labels, UI frames, flags, fonts).
  From PLAN 7.3e1 (2026-10-16, ADR-435): a flank file of a block held back at DEPLOY_REACH,
  against an enemy deployed away from it, can stand past contact reach from that enemy's block:
  seed 99 with Germany at war with Poland, tick 1317, Manchukuo's formation 959 (1678.50, 354.40)
  1.519 cells from the block of Chinese formation 445, 1.487 cells from it, whose block faces 964
  (`.cache/73e1/gap.ts`). `deploy.test.ts` empties the pools to keep the world its bound of 1.5
  was taken on. To decide whether such a file folds back.
  From PLAN 4.1c (2026-10-09, ADR-244): Switzerland holds a cell in the Po delta (1094, 323
  at M, by Ferrara). The communes of Liechtenstein are each smaller than a cell and were
  placed there, one on land and others as cells of the Adriatic with a province
  (`src/sim/data/provinces.ts`, the placing of a province under a cell).
  `tests/unit/ports.test.ts` names SWI as the one nation with a coast and no port.
  AT: side-by-side screenshots vs reference frames logged in PROGRESS.
  Split when taken up (2026-10-16): the headline's five, each a part with its pictures beside
  AoC's; the groups below it, a part each when taken up. `reference/NOTES.md` (the user's taste
  notes) is missing: every choice of taste is low confidence, logged in DECISIONS.
  Pictures: `.cache/74/shots.ts <tag> [save]` (1920 × 1080: Europe at 2000 m/px, Africa at 4000,
  the Balkans at 800, the world; seed 99 three years in), into `docs/evidence/7.4/`.
  - [x] 7.4a Nation names as AoC draws them: capitals, spaced, in a darker shade of the nation's […]
  - [x] 7.4b Order lines at T1 for what is selected and the player's own only (the critic of […]
  - [x] 7.4c Ranking rows with the nation's flag and a bar in its colour, as AoC's Statistics […]
  - [x] 7.4d UI frames: the panels and the bottom bar beside AoC's framed panels (taste: low […]
  - [x] 7.4e Borders and fonts: the border's darkness and width at T0 and the UI's font beside […]
  - [ ] 7.4f The groups below, a part each when taken up, or a line in an ADR for what is left.
    - [x] 7.4f1 The keys and the mouse of the critic's N7: Escape closes one panel a press (the
      nearest first), the number keys 1–9 and 0 set the map mode, a double click zooms in about
      the place clicked. AT: an e2e spec of each; the specs that press Escape green.
    - [x] 7.4f2 A phone's width (the critic's N8): the top bar, the ranking and a nation's panel
      apart and in view at 390 × 844, every button of the bottom bar in reach. AT: an e2e spec;
      the layout specs green.
    - [x] 7.4f3 The legend at T2 and T3: occupied land is a tint there (PLAN 2.11f), and the
      legend says so where the ground is the most of the picture. AT: an e2e spec.
    - [x] 7.4f4 The critic's N10: the nation panel tells one Defensive Pact (or Coalition) from
      another by its founder, as the history does ("Defensive Pact of Sweden"). AT: a unit test
      of the title; an e2e spec of two pacts in the panel.
    - [x] 7.4f5 The critic's N12: the editor's terrain layer shows the terrain map mode, and the
      nation layer the mode before. AT: `editor1938` reads the mode at each switch.
    - [x] 7.4f6 The critic's N15, N16: the panels opaque; at most two rows of war banners at
      1400 px and wider (6, the rest "+N"). AT: an e2e spec at 1400 and 1920 with nine wars.
    - [x] 7.4f7 The critic's "no tooltip on hover": a mouse on land names the nation by the
      cursor, and its occupier where another holds it. AT: an e2e spec.
    - [x] 7.4f8 The critic's N13: the flag editor's line and circle (a disc), and an undo of 20
      steps. AT: unit tests of the line and the disc; `flags1938` draws and undoes each.
    - [x] 7.4f9 A Kill's successors in greys (the critic, 2026-10-07): a spawned nation's colour
      by hue, saturation 0.5–0.8, lightness 0.40–0.62. AT: a unit test of 300 colours, none grey.
    - [x] 7.4f10 The random world's names (the critic; the sixth read, PLAN 2.16Ra): the
      province's name without its kind ("Bauchi State" → "Bauchi"), the capital's where it is a
      direction ("Central") or taken; every name its own. AT: unit tests; `randomWorld.test.ts`
      asks for 60 names of 60 nations on its seeds. (The colours of the same finding: six hue
      sectors met evenly on seeds 1, 7 and 42, so no change; the hegemon: PLAN 1.42.)
    - [x] 7.4f11 The critic's N14, the lists: nine ranking lists as AoC's (enemies at war,
      puppets, aircraft and warheads besides land, army, income, treasury and manpower). AT:
      `ranking.test.ts`; `ranking1938` sorts every list.
    - [x] 7.4f12 The critic's N14, the charts: gridlines at the quarters of the value axis, five
      dates on the time axis, and under the cursor the month and each line's value. AT:
      `charts1938` reads the ticks and the values under the cursor against the sim's series.
    - [x] 7.4f13 The critic's N6 ("no city panel"): over a city's dot the tooltip names the
      city, "capital" when it is one, and its province's unrest. Lines of the list already
      settled taken off (the order lines at 400 m/px and N4's arrows: 7.4b; N18's sound: 3.12d).
      AT: `mapTooltip1938` at Berlin.
    - [x] 7.4f14 Occupied land at T2 and T3 read as water (the critic of 2026-10-07: French-held
      Germany a blue field like a lake): the occupier's cast on it 0.42 → 0.3, the terrain the most
      of it. AT: pictures; `occupiedGround1938`, `occupation1938`, `groundColour1938` green.
    - [x] 7.4f15 AoC's God panel, the commands the sim had: the treasury set, Annex (the chosen
      nation into this one), Fight to the Death (this nation's side of each of its wars, a toggle).
      AT: an e2e spec of each.
    - [x] 7.4f16 AoC's God panel, Recolor and Donate: two commands (`recolorNation`,
      `donateGold`: no more than the giver has, not to itself, in range) and their controls. AT:
      unit tests of both against a twin that gives nothing; `godPanelMore1938`.
    - [x] 7.4f17 The God tab edits combat efficiency (±10 %, a lock) and the alliance's unity
      (±10), by the commands the sim had; the stats carry the lock. AT: `godPanelMore1938`.
    - [x] 7.4f18 Cities made and razed in the game: two God map tools, Found city (a town at the
      click, for its holder) and Raze city (the city within two cells), by the editor's commands.
      AT: `godPanelMore1938` founds a town in Hesse and razes it.
    - [x] 7.4f19 The world's rules in the game: the God tab sets Winner takes all, the revolt
      mode and the CE mode (beside the AI and nuclear weapons); the stats carry them. AT:
      `godPanelMore1938`.
    - [x] 7.4f20 A formation in a stack of T1 markers picked by a click: a click on the stack
      whose formation is open opens the next of it, round to the lead. AT: `stackPick1938`.
    - [x] 7.4f21 Tags under the page's boxes: a tag gives way to the top bar, the legend, a
      nation's or formation's panel, the ranking, a top-centre panel and the ticker's rows, as to
      the banners and the bar. AT: `tags1938` (a block under the nation panel; red before).
    - [x] 7.4f22 A city's dot and name are wanted at their bound, as the tiers are (at exactly
      2000 m/px the names of size 4 were off with the T1 markers on). AT: `cities.test.ts`.
    - [x] 7.4f23 The player's selection of a formation whose id another of the same nation has
      taken: the snapshot carries each id's generation, and the selection drops a formation made
      since. AT: `player1938` (a Polish division removed and one raised with its id; red before).
    - [x] 7.4f24 A formation with a dead one's id is a T1 marker new to the view: no fade, stack
      or box move of the dead one's. AT: `markerStacks.test.ts` (both ways; red before).
    - [x] 7.4f25 The critic's N8 at 1024 × 600: the played nation's label onto a line of its own
      in the bar, whole, and what stands above the bar on its top (ADR-451). AT: `barNarrow1938`.
    - [x] 7.4f26 AoC's Spawn Nations with its initial size: a God map tool and a command
      (`spawnNation`: the province clicked and the nearest of its holder's, 1 to 24, at peace). AT:
      `godMode.test.ts`; `godPanelMore1938`.
    - [x] 7.4f27 The God tab's checkboxes: a box's words wrap beside it (Winner takes all's went
      under its box, seen in 7.4f26's picture). AT: `godPanelMore1938` (red before).
    - [x] 7.4f28 The critic's N14, the dead: three lists of a life (age, wars fought, revolts
      suffered) with the dead in them, marked (ADR-452). AT: `lives.test.ts`; `ranking1938`.
    - [x] 7.4f29 The names in a zoom from the world to T1 (ADR-414 g): their glyphs drawn once
      into an atlas and then as pieces of it (ADR-453). AT: no frame over 17 ms in a zoom (11 to
      17 before); `nationLabelLayout.test.ts`; the label specs green.
    - [x] 7.4f30 A capital's name reaches 1.6 times as far past the markers round its dot (Warsaw's
      left out at 1000 m/px at the start). AT: `cities.test.ts`; the city name specs green.
    - [x] 7.4f31 No land of the start nobody's but Antarctica's: the Spratly Islands France's, and
      an islet no province covers the nearest owned land's (ADR-454; the pin moved).
      AT: `ownership.test.ts`.
  From the Phase 2 review (PLAN 2.11c, 2026-10-05). Each group is one look at one thing; split
  when taken up.
  - **Tanks of two elements of a deployed block drawn in one another** (measured
    2026-10-08, PLAN 3.11f2, ADR-204's addition): about one tank in fifteen at T3 (45 pairs
    under 0.7 of a figure's side among 1,346 tanks, seed 5381, Germany on Poland, day 21).
    The scatter of an element (180 m) against the room its figures leave in a slot (60 m).
  - **The tags of formations in contact at T2** (seen 2026-10-07, PLAN 3.5g,
    `docs/evidence/2.10/stop-5-battle.png`): at 150 m/px the tags of three divisions in one
    battle lie on each other and on the sprites, one name half covered. Whether the tags
    are parted at all at T2 was not looked at.
  - **A neighbour's tag over a block** (seen 2026-10-07, PLAN 3.10c1b,
    `docs/evidence/3.10/c1b-turrets.png`, after ADR-188): at 60 m/px the tag of "Light
    infantry division 410" stands over the column of Tank brigade 395, whose own tag is
    below it with a line. The line says whose the tanks are; the other tag is still the one
    above them. A tag a gap clear of other formations' elements was not tried.
  - **A tag far from its block at T3** (seen 2026-10-07, PLAN 3.7f,
    `docs/evidence/2.10/stop-7-battalions.png`, after ADR-168): at 12 m/px the tag of
    "Motorised division 47" stands at the view's right edge and its line runs 480 px back
    across the fight to the middle of its elements, with open ground much nearer its block.
    Which of the blocks in the picture are that division's was not read; a division whose
    elements span the view has its box's side far from their middle.
  - **Two marching formations at one place drawn in one another** (seen 2026-10-14, PLAN 6.9,
    `stackBlocks1938.spec.ts` on seed 1212, day 6): Soviet formations 52 and 57, one template,
    both on the march from the same point, have their columns' elements at the same places.
    The blocks of a stack in contact stand clear of each other (PLAN 3.11c1); columns do not.
  - **The seam of the looping map** (the 180° meridian in 1938). What is drawn knows the seam
    one layer at a time, and most layers do not:
    - `wrapOffsets` has no margin: a counter, marker, flag or name within its own half-width
      of the seam is drawn only once the view's edge has crossed the seam, and half of it
      (about 24 px of a counter) then appears at once;
    - counters either side of the seam are not folded into each other, and T1 markers there
      are neither stacked nor moved apart;
    - the two copies of a city share one name switch and one place (what is in the way of one
      copy moves both; with both laid out, a view 6,570 px wide, the layer never rests);
    - a nation name's copy that alone is in a larger name's way goes out in one frame;
    - a capital flag's rise is cut short at the seam (its state is kept by wrap offset);
    - a city's buildings reach to the seam and not across it;
    - figures drawn through a wrap offset are 2,047 cells from the origin of their f32
      offsets, where a step is 2.4 m.
  - **The declutter in a crowd and in flight.**
    - From the Phase 3 review (PLAN 3.7c): the markers' second way of parting (ADR-157) was
      found on one scene, and how many scenes the two ways still leave that 6 px could part
      was not counted. A zoom in can still show fewer counters within a level; the landing
      of a split takes its hold a frame later; a trembling zoom was not measured (ADR-158).
    - Counters: an eased zoom can end with other counters than a stepped one (62 of 192 cases
      of made-up frame spacings), and at 200 ms a frame at another cluster level; in flight
      some counters turn twice (56 of 7,394 on a wheel notch in); the second frame of a
      counter layer newly shown turns 1.3% of them (the frame after a merge lands, and the
      second frame of T1 → T0).
    - Within one level of clusters a larger scale can fold a counter into another neighbour
      than a smaller one did (a year into seed 1938 over central Europe, 6 to 8 px a cell:
      12.1k of one nation's go from a counter of its own to another nation's, and a counter
      takes in a nation it had not). Seen in the gate of PLAN 2.11i.
    - T1 markers: parting one pair can push a box onto a neighbour and leave it there (44 of
      5,249 made-up clusters of four); in 1.2 to 1.6% of clusters of 3 to 5 more than the 8
      rounds would part every pair; "no box more than a quarter under another" is about area,
      and at 1800 m/px on Spain's front some numbers are partly under a neighbour's box; the
      first frame of the zoom into T2 starts a move of a few px.
  - **Names and arrows at T1.**
    - Capitals whose names are left out because garrisons stand on every place by the dot: of
      Europe's at the start in 15 views from 1800 to 400 m/px (`.cache/74f32/caps.ts`), Prague
      at 1800 m/px only since PLAN 7.4f30 (12 markers within 120 px of its dot).
    - Order arrows are not kept clear of, by decision; in a war they are many (two months
      into seed 1938 the picture over Austria is mostly arrows). Whether every marker's
      arrow should show at T1 has not been asked.
    - T2 → T1: names give way from the first frame to markers that show at 2%. T1 → T2: a
      name can take a place under a number that still shows.
  - **The ground's look.**
    - No roads near cities (SPEC's tier table had them; not built in PLAN 2.8); buildings
      stand along two directions from a hash, with no streets, and know of their city's
      coast and river only "not on water".
    - Shading and texture take one cell size for the whole map: away from the equator a cell
      is fewer km wide than high.
    - Every ground is the fill's colour: at T3 a forest floor, a field and a street differ by
      roughness and a few hundredths of brightness (now in PLAN 2.14, critic R2-B2). The
      instances keep their natural colours in every map mode.
  - **What T3 shows of a battle.** Shots fly 30 to 60 km (the range is in cells) and a view at
    T3 is 4 to 17 km wide: one tracer in the demo's picture at 12 m/px, none at 3 (now in
    PLAN 2.14, critic R2-B2). A battalion
    at a third of its men is a scatter over its footprint, not a smaller block (ADR-69's
    order of losses). A stack's lead at T1 shows the strongest formation's kind only.
  - **What T2 and T3 show of armour** (the Phase 3 review, PLAN 3.7c, 2026-10-07; each seen
    in the pictures of `docs/evidence/3.6/` or noted by its task):
    - The tanks of an element turn their turrets by one angle, not each on its bearing (the
      tongue and the tracer of a tank at the edge of its element differ by up to about 20
      degrees for a near target: ADR-161). A gun's tongue is along its formation's facing.
      A shooter outside the view's box fires from its slot.
    - Figures drive over a hull, and a tank can stand against its own burning hull (1.5
      m/px). An element's end at T3 is still the T2 wreck mark. A lost tank leaves nothing
      at T2. A hull can burn under the page's war banners.
    - The small mark of a pale nation on pale ground has less against the ground than the
      dark blob had (Germany's grey on Austria's hatched land at 100 m/px). Guns, half-tracks
      and rifles have no small frame: a motorised division is a rifle division's block. The
      band of the handover ends at 8 px for the turrets, not where a hull first reads.
    - A retreat is a march like any other on the page (`FormationRetreated` is not drawn
      and not in the history).
    - Not in any picture: a full company (the demo's brigade is at 54 tanks of 200, two or
      three to an element); a hull that burns after a pan to it; a turn of a turret, a
      muzzle's tongue or a flight filmed in a running game.
    - The blocks of formations in contact can stand elsewhere for the hour after a load or a
      command than in the game that ran on (the sixth read: 975 formation-hours in 2,500
      ticks, 1.4 cells at most; a picture only, the hashes equal).
  - **From the fifth independent read (PLAN 2.11b):**
    - Back from T2 with the camera still zooming (the only way a wheel leaves T2), the T1
      boxes take the rest places of the first frame's zoom and keep them for the morph: up to
      6 px off, then an ease of 150 ms. PLAN 2.7z holds for a camera that has stopped.
    - Cities by the fine mask: 140 of 5,757 are in a water pixel of it and 387 not on sure
      land (Gibraltar, Kalemie, Geneva, Amoy, Buffalo, Cochin; one capital in water, four not
      on sure land). At T2 and T3 their dots stand in the drawn sea and no building stands at
      their middle.
    - Nine land cells have no land pixel in the mask (atolls, e.g. 169.5°W 16.7°N): a
      formation there keeps a middle on the mask's water and T2 draws no island.
    - The T1 order arrow ends at the target cell's middle; the formation will stand at the
      cell's land point, up to 0.6 cells from it on a coastal cell.
  - **A worn element at T2** is a paler sprite (PLAN 2.11g). On a light nation colour over a
    light fill (Japan's on China's) a sprite at 0.55 and one at 1 are close to the eye.
  - **Flags by scenario.** Done in PLAN 2.16b (ADR-109) for the worlds without a nation
    table. Left: a second table (another year) brings its own flags file; the worker and
    `ScenarioInfo.nationTags` know only that of 1938.
  - **From the pictures of PLAN 2.14, shot again (2.14f6, 2026-10-05)** (the tags under the
    top bar and the panels: PLAN 7.4f21): figures at 20 m/px are faint on a plain
    (`to-battle-front.png`); a war banner without a battle differs from one with a battle by
    its swords and frame only (`to-battle-banners.png`).
  - **Two nations of one name** (PLAN 2.15b, ADR-100, 2026-10-05). Founded nations of one
    province name are numbered since PLAN 3.12Rh3 ("Free Damascus II", `foundedNth`). Left: the
    seven provinces without a name give their country's, so "Free Colombia" can stand beside
    Colombia. Not seen in a game yet.
  - **Land painted on the mask's water** (PLAN 2.15e2b, ADR-105, 2026-10-05). The editor can
    paint land on a cell the fine mask has no land pixel for: the map draws sea there and a
    formation raised on it stands off sure land, as the eight atolls did. The world's build
    gives an islet to the cells of the scenario only.
  From the critic's report of 2026-10-05, not blocking and in no task above (its numbers):
  - N4, N5 (the arrows: PLAN 7.4b): markers overlap round Warsaw at the start, one under the
    capital's flag.
  - N14 (left of it after PLAN 7.4c, 7.4f11, 7.4f12 and 7.4f28): the economy tab is six numbers;
    no list of kills (the log names no killer).
  - N17: a black smear under a counter near Bern in 1952 of seed 2718.
  - N18 (sound since PLAN 3.12d): one language.
  - N21: while the game runs, half-faded counters are on screen all the time as the clusters
    regroup ("432", "29.6k" at part opacity, 60 days into a war at 2500 m/px). Measured
    2026-10-17 (`.cache/74f30/n21.ts`, `why.ts`; seed 1938, day 60, ×5, 2500 m/px): in 90 % of
    frames over Spain and Europe some counter is mid-fade, 3.7 of 84 to 101 at a time; some 50
    folds and unfolds a second, of which a quarter are a lead swap within a nation (a formation
    crosses into the next cluster of the grid and makes it the stronger), 28 % undo a turn of the
    same counter within a second, the rest are centroids that jump as clusters change members. A
    shown counter held as the lead until the other is 1.5 × as strong cut the swaps by 40 % and
    the counters mid-fade by 3 %: not kept. What is left is the grid clusters' membership; a
    remedy is a clustering whose members stay while the armies move.
  - Against AoC's God panel: the World AI settings beyond the five the sim has (AI, nuclear weapons, winner takes all,
    revolts, CE mode: PLAN 7.4f19; AoC has about fifteen, the rest no rule here). (The treasury,
    colour, donations, CE, unity, cities made and razed and a nation spawned with a size: PLAN
    7.4f15–18, 7.4f26.)
  From the critic's report of 2026-10-07, not blocking and in no task above:
  - After 14 years the Soviet Union is a field of thin stripes of other nations' colours (the
    critic of 2026-10-07; the lake of the same line: PLAN 7.4f14).
  - The critic did not test a player building an armoured division (a step of its own
    script failed on a selector).
- [ ] 7.5 Run the critic (`CRITIC_PROMPT.md`), fix blocking issues, repeat until the DONE condition.
  AT: `critic/CRITIC_REPORT.json` for HEAD: parity dims ≥ 7, differentiators ≥ 8, zero blocking.

---

## Cross-reference: PROMPT.md requirement → SPEC § / PLAN task

| Requirement | SPEC | PLAN |
|---|---|---|
| AI free-for-all: expand, war, peace, ally, unions (unity), puppets (autonomy), revolt, collapse | §3.5, §4, §7 | 1.16–1.20, 1.24 |
| Cores, revolts per province/region, revival (finite, cooldown), suppression, winner-takes-all, occupation layers | §4 | 1.15, 1.19, 1.20 |
| Sue for peace when broke/exhausted, fight to the death, aggression/traits, income bonus | §3.4, §7 | 1.9, 1.16, 1.24 |
| Economy tick | §3.7, §7 | 1.9, 1.10, 1.26 |
| Terrain types, cities/capitals | §3.2, §3.3 | 1.2, 1.5, 1.11 |
| Major Battles, efficiency modes, buffs | §5.3, §5.4, §3.5 | 1.21–1.23 |
| Long-run dynamism | §7, §10 | 1.40, 7.3 |
| God Mode (all tools) | §9 | 1.32, 1.33, 6.1 |
| Editor (paint, undo, mask, cities, costs, alliances, puppets, annex, revolts, import, flags, files) | §9, §2.7 | 1.35–1.38 |
| Map modes | §9 | 1.30 |
| Stats + history log (filter, export) | §9 | 1.34 |
| QoL (pan/zoom/touch, speeds, autosave, screenshot, UI size, i18n, looping, map sizes, unit size, polish) | §9, §8 | 0.17, 0.21, 1.27–1.31, 1.39 |
| Seeded deterministic runs, randomisation | §2.6, §9 | 0.10–0.13, 1.39 |
| 1938 scenario, data-driven | §3, §2.7 | 1.1–1.7 |
| Semantic zoom (4 tiers, one truth, no popping) | §8, §3.6 | 0.14–0.17, 2.1–2.10 |
| Naval | §6.2 | 4.1–4.7 |
| Armour | §6.1 | 3.1–3.6 |
| Aircraft | §6.3 | 5.1–5.7 |
| AI nukes | §6.4 | 6.1–6.8 |
| Worker sim, fixed timestep, spatial index, perf budget, bit-identical save, tooling | §2, §8, §10 | 0.2–0.4, 0.12–0.13, 1.27, 7.1 |
| Iteration files (PROGRESS, BLOCKERS, DECISIONS, DATA_SOURCES, PARITY, parity script) | — | 0.5, 0.7, 0.8 |
| Soak, sweep, scripted demos, critic | §10 | 2.10, 3.6, 4.7, 5.7, 6.7, 7.2–7.5 |

## Done: the first lines

Not read at the start of an iteration. The gate and `npm run critic:due` read these ticks; the text of each task is in `docs/PLAN_DONE.md`. Written by `npm run plan:archive`: do not edit.

- [x] 0.1 git repo + `.gitignore` (reference/, .cache/, build outputs). […]
- [x] 0.2 Vite + TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) + Preact; `npm run dev/build/preview`. […]
- [x] 0.3 ESLint flat config incl. sim purity rules (§2.1 SPEC) and module-boundary rule (local `warsim/module-boundaries`, see ADR-12). […]
- [x] 0.4 vitest + Playwright installed; `npm test`, `npm run e2e`, `npm run check` (= tsc + eslint + vitest + build + parity). […]
- [x] 0.5 Iteration docs: PROGRESS.md, BLOCKERS.md, DATA_SOURCES.md (stub entries), note in PROGRESS that `reference/NOTES.md` is missing. […]
- [x] 0.6 Extract trailer frames: `ffmpeg -i reference/video/*.mp4 -vf fps=0.5 reference/frames/%04d.png` (+ scene-change frames `scene_%03d.png`, since the only clip is 42 s); view a sample and record observations. […]
- [x] 0.7 Fetch itch page, devlog index + all posts, Steam page; write `docs/PARITY.md` Table 1 (numbered AoC rows, TEXT/VISUAL source, all `not started`) + Table 2 (our additions). […]
- [x] 0.8 `npm run parity` (tools/parity): parse the tables, compute the score, check evidence paths for `verified` rows, compare against the header score. […]
- [x] 0.9 `sim/core/dmath`: sin, cos, atan2, exp, log, pow via tables + polynomials. […]
- [x] 0.10 `sim/core/rng` (PCG32 + streams) and `hash32/xxhash32`. […]
- [x] 0.11 `sim/core/tables`: SoA growable tables with free lists, id-ordered iteration, serialize/deserialize to sections, `stateHash()`. […]
- [x] 0.12 Toy world + tick loop (grid 256×128, two nations, random-walk formations) running in Node and in the worker. […]
- [x] 0.13 Worker protocol: commands, subscribe, rAF-acked snapshots, buffer pool, coalescing of dirty tiles + event ring cursor. […]
- [x] 0.14 Render benchmark A: raw WebGL2 (twgl) id-map renderer with smooth-border shader at 2048×1024, 150 nations. […]
- [x] 0.15 Render benchmark B: instanced proxies with GPU interpolation, 10k / 30k sprites; same scene in PixiJS v8. […]
- [x] 0.16 Camera-relative precision test at close zoom (1 m/px) at lon 179°. […]
- [x] 0.17 Camera controller: wheel/drag/keyboard/touch pinch, continuous z, looping-x wrap rendering. […]
- [x] 0.18 Data pipeline v0 (`tools/data`): download NE 10m land, admin-0, admin-1, populated places, marine polys, and ETOPO into `.cache/`; produce the fine land mask, elevation pyramid and `manifest.json` with sha256; DATA_SOURCES updated. […]
- [x] 0.19 Load-time vector rasterizer (admin-1 → province raster) at S/M sizes in the worker. […]
- [x] 0.20 Headless runner `npm run sim` (Node) with per-year metrics JSON. […]
- [x] 0.21 i18n skeleton: `t()`, `en.json`, locale picker, ESLint no-literal-string on `src/ui`. […]
- [x] 0.22 Phase 0 review: re-read SPEC for drift, update DECISIONS with the benchmark outcomes. […]
- [x] 1.1 zod schemas for terrain, unit types, tech, traits, buildings, scenario, map meta; validate all `data/**`. […]
- [x] 1.2 Terrain derivation (elevation + latitude/biome from NE raster) → terrain classes; CROSSING lanes data (straits list). […]
- [x] 1.3 1938 ownership: admin-1 → nation table + split polylines for interwar borders; colonies; mandates. […]
- [x] 1.4 Nations data (≥ 100 incl. colonies/dominions as puppets): colours, names, traits, aggression, cores, capitals, alliances (Axis-precursor, Allied guarantees, Comintern), puppets. […]
- [x] 1.5 Cities (NE populated places, filtered and named) with capitals. […]
- [x] 1.6 Flags: SVG flag spec + preset renderer; 1938 flags for all nations (own designs); flag atlas generation. […]
- [x] 1.7 Starting OOB per nation (formations of unit templates at historical-ish locations, scaled). […]
- [x] 1.8 Calendar/time (1938-01-01, hourly ticks), scheduler (speed, pause, max). […]
- [x] 1.9a Boot the 1938 scenario as sim state (split out of 1.9: the economy needs the real world): cells incl. province layer, nations, cities, OOB formations; worker loads the map assets; `?scenario=1938` in the app. […]
- [x] 1.9 Economy: per-cell income weight × terrain × development, monthly tick, gold, expenses (upkeep, admin cost superlinear), incomeBonus −100..100, bankruptcy. […]
- [x] 1.10 Production & recruitment queue; manpower. […]
- [x] 1.11 Land movement: coarse nav graph (province adjacency + CROSSING) + cell-level A*, mobility × terrain costs, slotted poses. […]
- [x] 1.12 Supply v1: from capital/cities through the controlled network; attrition when cut. […]
- [x] 1.13 Engagement + element combat v1 (§5.2) for inf/art/AT/AA. […]
- [x] 1.14 Territory pressure + frontier-set flips + connectivity rule. […]
- [x] 1.15 Occupation vs owner, capital capture/relocation, winner-takes-all option. […]
- [x] 1.16 Wars: declaration, war score, exhaustion, peace settlement, broke/exhausted sue for peace, fightToDeath. […]
- [x] 1.17 Alliances/unions with unity & loyalty; join/leave/dissolve. […]
- [x] 1.18 Puppets with autonomy: create/release/integrate/revolt. […]
- [x] 1.19 Revolts (per province/per region setting), suppression spending, rebel nation spawn. […]
- [x] 1.20 Collapse & revival (finite, cooldown) from cores. […]
- [x] 1.21 Buffs/debuffs with timers. […]
- [x] 1.22 Combat-efficiency modes (dynamic/progressive/static/locked/random). […]
- [x] 1.23 Major Battles + breakthrough corridor. […]
- [x] 1.24 Strategic AI v1 (war/peace/alliance/puppets/coalitions), traits/aggression. […]
- [x] 1.25 Operational AI v1 (front allocation, offensives, reserves). […]
- [x] 1.26 Economic AI v1 (budget split, build mix). […]
- [x] 1.27 Save/load full state + command log, gzip; autosave to IndexedDB. […]
- [x] 1.28a T0 renderer: borders without artefacts (analytic border gradient), occupation hatch, […]
- [x] 1.28b T0 renderer: coastline from the fine land-mask pyramid; terrain map mode. […]
- [x] 1.29 Curved nation labels (worker derive + MSDF). […]
- [x] 1.30a Map modes political, terrain, wars, diplomacy, alliances, puppets, income + legends, […]
- [x] 1.30b Revolts map mode (per-province unrest choropleth: province raster + unrest texture). […]
- [x] 1.31a Nation panel (Overview and Economy tabs; chips select nations); worker `nationStats`. […]
- [x] 1.31b Statistics ranking (right panel, metric dropdown) and war banners strip. […]
- [x] 1.32a God Mode commands in SPEC §9 (rename, war, peace, alliance, collapse, spawn […]
- [x] 1.32b God Mode UI: a God panel (bottom bar toggle) issuing those commands on the selected […]
- [x] 1.33a Take control of a nation; select own formations; move/attack orders by map clicks. […]
- [x] 1.33b Player Actions tab for the controlled nation: diplomacy (declare war, offer peace, […]
- [x] 1.34a History log (saved), History panel with filters + CSV/JSON export. […]
- [x] 1.34b Statistics: per-nation series (land, income, gold, military size by domain, […]
- [x] 1.35 Editor: brush/bucket/line, undo/redo, target mask. […]
- [x] 1.36 Editor: cities, gold & core costs, alliances, puppets, annex, preset revolts. […]
- [x] 1.37a Editor: map import (image → terrain/owner palette mapping). (Split from 1.37, 2026-10-03.) […]
- [x] 1.37b Flag editor with presets. […]
- [x] 1.38 Scenario files save/load (shareable `.warsim-scenario`). […]
- [x] 1.39a Settings panel: UI size, unit size, screenshot key (F2), seed + new game; speed/pause […]
- [x] 1.39b1 New-game options: looping map, randomisation (aggression, traits, starting gold, […]
- [x] 1.40 Dynamism tuning: `npm run sweep` (10 seeds × 50 years) passes the SPEC §10 criteria. […]
- [x] 1.41 Phase 1 review + PARITY rows updated with evidence. […]
- [x] 1.42a Tick time back under control before the next full sweep (ADR-48). Profile of year 1, […]
- [x] 1.42b Critic B1: coalition armies fight on their partners' fronts (ADR-50). Seed 109 […]
- [x] 1.42c Critic B1: the build queue of a rich nation at war no longer waits for months for a […]
- [x] 1.42d Critic B1: land is measured by true area, not by cell count (ADR-52; the user's […]
- [x] 1.42d2 Critic B1: the monthly statistics series records land in km² (the land chart). […]
- [x] 1.42f Tick time is over budget again after ADR-50 and ADR-51: seed 99 × 5 years, mean […]
- [x] 1.42e Critic B1: sim rules that count land in cells count area instead (overextension […]
- [x] 1.42e1 The land rules of a war count km² (ADR-57): score, true share, capitulation, puppet […]
- [x] 1.42e2 Overextension counts km²: a holder's share of the world's owned land […]
- [x] 1.42e3 The admin cost counts km² held (`economy.ts`): `adminCost` per 212,000 km² (1,000 […]
- [x] 1.43a Critic B5: a way into the game. `/` opens a title screen, not the two-nation toy […]
- [x] 1.43b The title screen loads a game: Continue (the autosave, with the seed and options of […]
- [x] 1.43c The title screen shows the chosen scenario: a political map of its start and its […]
- [x] 1.44 Critic B6: the editor's brush and line paint on a left-drag. While a paint tool is […]
- [x] 1.44b The God Mode territory brush paints on a left-drag too (it is click-only, and a […]
- [x] 1.45a Critic B7, the ghost counters: no half-faded unit layer is left standing. (1.45 was […]
- [x] 1.45b Critic B7, the wall of counters: Europe readable at world zoom. T0 counters are […]
- [x] 1.45c Capital flags do not hide unit counters. The flags are drawn above the unit layers […]
- [x] 2.1 T1 operational markers (symbol, flag chip, strength bar + number, order arrows, battle markers). […]
- [x] 2.2 T0 aggregated counters with stable multi-level clustering + split/merge animation. […]
- [x] 2.3 Element snapshot path (interest-managed) + GPU-interpolated element sprites at T2 (facing, walk/drive anim). […]
- [x] 2.4a FireEvent visuals: tracers, muzzle flashes, impacts (ADR-66; first answer to critic B2). […]
- [x] 2.4b Casualty removal and wrecks (ADR-67; split from 2.4, as it needs an event of its own): an […]
- [x] 2.5 Casualty consistency across tiers (ADR-68: `spawnFormation` takes a template, so that […]
- [x] 2.6 T3 close expansion (vehicles exact, infantry ≤ 64 sprites, count = strength). […]
- [x] 2.7a Slots stay: an element keeps its place in its formation's block when others die (ADR-70; split […]
- [x] 2.7b Fade curves & hysteresis for all layers: T1 ↔ T2 and T2 ↔ T3 are states with hysteresis and a […]
- [x] 2.7c The marker → elements morph: the box shrinks into the group and fades, the strength bar lingers (ADR-72). […]
- [x] 2.7d The layers that are not units (ADR-73): the capital flags switch at 3 px per cell in one frame, and the […]
- [x] 2.7e The curved nation names (ADR-73, addendum): a name appears in one frame when its size reaches 9 px or a […]
- [x] 2.7f The counters' cluster level comes to rest (ADR-74, finding 1). `CounterLayer.layout` judges the […]
- [x] 2.7g A destroyed nation's capital flag goes with it (ADR-74, finding 2). The view only ever adds to […]
- [x] 2.7h The sprites keep their clock when a snapshot repeats a tick (ADR-74, finding 3). A new subscription […]
- [x] 2.7i Sprites and figures wear the nation's own colour in every map mode, as the markers and counters do […]
- [x] 2.7j Figures that fade out are of the snapshot in hand (ADR-74, finding 5). Leaving T3, a tick that […]
- [x] 2.7k A nation's name keeps its state when the camera crosses the seam of a looping map (ADR-74, finding 6). […]
- [x] 2.7l What the counters show at rest does not depend on the frames drawn on the way there. Seen […]
- [x] 2.7m The view draws again after a frame that started an animation, however late the next frame […]
- [x] 2.7n At the closest zooms the figures of a formation are there wherever the camera looks at it […]
- [x] 2.7o A formation that takes the id of one destroyed in the same step does not arrive from where […]
- [x] 2.7p A pan at T3 from empty ground onto a formation shows its figures, not its T2 sprites first […]
- [x] 2.7q A world loaded into a running game takes the place of everything of the old one in the view […]
- [x] 2.7r City names stay readable among the T0 counters and the capital flags. The counters are drawn […]
- [x] 2.7s T1 markers of a dense group do not stand on each other. Seen in PLAN 1.45a and left without a […]
- [x] 2.7t A city's name is readable where a nation's name crosses it. The curved nation names are drawn […]
- [x] 2.7v The T1 markers come to rest (ADR-74, third read, finding 1; a defect of PLAN 2.7s2). `nudgeApart` […]
- [x] 2.7w A marker that goes into a stack fades where it stands (ADR-74, third read, finding 3; a defect of […]
- [x] 2.7x A table loaded larger than it was still tells its rows apart (ADR-74, third read, finding 2; a […]
- [x] 2.7y Decide what a pause in mid-tick does to the sprites, and make it so (ADR-74, third read, […]
- [x] 2.7u City names keep clear of the T1 markers, as they do of the T0 counters (PLAN 2.7r left it; it […]
- [x] 2.7z On the way back from T2 the T1 markers stand where they will rest (ADR-74, fourth read, finding 1). […]
- [x] 2.8 Procedural detail tiles (ground texture, trees, rocks, buildings near cities) by world-seeded noise, plus hillshade from the elevation pyramid. […]
- [x] 2.9 Coastline from the fine mask at T2/T3; elements never rendered on water. […]
- [x] 2.10 Scripted seamless zoom demo (world → close on an active battle), 8 stops, screenshots. […]
- [x] 2.11 Phase 2 review: re-read SPEC for drift, PARITY rows updated with evidence, and the […]
- [x] 2.12 Critic R2-B4 (report of 2026-10-05 on `3d6a2b2`): a loaded game goes on as the game […]
- [x] 2.13 Critic R2-B3, the first part: the 1938 order of battle is still there after the […]
- [x] 2.14 Critic R2-B2: the close zoom shows a battle, and says who is in it. The […]
- [x] 2.15 Critic R2-B6, the part that is not balance: a nation's end does not found dozens of […]
- [x] 2.16 Critic R2-B7: more than one way to start. The title screen lists "World, 1938" and […]
- [x] 2.16R Review pass (PROMPT step 9) over PLAN 2.12 to 2.16: refactor debt, dead code, […]
- [x] 2.17 Critic R2-B8: a God Mode action does what it says, or says why not. Seen through […]
- [x] 3.1 Armour unit types L/M/H + mech/mot, tech generations, production cost/time, upkeep. […]
- [x] 3.2 Fuel/supply consumption and breakdown effects. […]
- [x] 3.3 Terrain modifiers for tracked mobility and combat. […]
- [x] 3.4 Combined arms (inf + art + armour bonus; AT vs armour; armour vs infantry in the open). […]
- [x] 3.4R Review pass (PROMPT step 9) over PLAN 2.17 and 3.1 to 3.4: refactor debt, dead […]
- [x] 3.5 AI uses armour as spearheads; the economic AI adapts the mix. […]
- [x] 3.6 Tank visuals: sprites, turret facing, muzzle flash, burning wrecks at T2/T3. […]
- [x] 3.7 Phase 3 review: re-read SPEC for drift, PARITY rows updated with evidence, and the […]
- [x] 3.8 Critic R3-B4 (report of 2026-10-07 on `a6f63ef`): no war inside one realm or one […]
- [x] 3.9 *Done 2026-10-07 (ADR-186):* a revolting region is at most `REGION_KM2` = […]
- [x] 3.10 *Done 2026-10-08 (the AT of five years holds; the critic's years 8 and 9 of seed […]
- [x] 3.11 *Done 2026-10-08 (its parts 3.11a to 3.11f, ADR-198 to ADR-207; the AT on seed […]
- [x] 3.12 Critic R3-B6: a watcher is told what happens as it happens, and the history can […]
- [x] 3.12R Review pass (PROMPT step 9) over PLAN 3.8 to 3.12, the five numbered tasks since […]
- [x] 4.1 Sea zones (Voronoi + named seas) + lane graph + straits/crossings; ports & naval bases. […]
- [x] 4.2 Fleets & ship element types (DD, CL, CA, BB, CV, SS, TP) + movement along lanes. […]
- [x] 4.3 Detection + fleet battles at ship-element level (gunnery ranges, torpedoes, screening). […]
- [x] 4.4 Sea control per zone; sea supply; convoys; blockade; submarine raiding. […]
- [x] 4.5 Amphibious invasion (embark, escort, land, penalties, bombardment). […]
- [x] 4.6 Naval AI (sea control, escort, raiding, invasion planning). […]
- [x] 4.7 Naval visuals: ship sprites, wakes, gunfire, torpedo tracks, sinking; sea-control map mode. […]
- [x] 4.8 Phase 4 review, the phase's one review pass (PROMPT step 9, ADR-266): refactor debt, dead code […]
- [x] 4.9 Critic R4-B2 (report of 2026-10-12 on `5e91a56`): a player can invade, and a refused […]
- [x] 4.10 Critic R4-B4: naval warfare can be seen. Seen by the critic: at T0 a fleet's counter […]
- [x] 4.11 Critic R4-B6: the ranking's rows hold their names and values. From row 11 down a […]
- [x] 5.1 Air wings, airbases, carriers, range; air zones. […]
- [x] 5.2 Mission scheduler + sorties as derived kinematics. […]
- [x] 5.3 Air combat, interception, AA; air superiority per zone. […]
- [x] 5.4 CAS + tactical bombing effects on ground battles; naval strike; carrier air groups in fleet battles. […]
- [x] 5.5 Strategic bombing of industry, ports and cities (income/production damage, repair). […]
- [x] 5.6 Air AI tasking. […]
- [x] 5.7 Air visuals: planes along sortie paths, dogfight tracers, flak, bomb impacts; air superiority map mode. […]
- [x] 5.8 Phase 5 review, the phase's one review pass (PROMPT step 9, ADR-266): refactor debt, dead code […]
- [x] 4.12 Critic R5-B4 (report of 2026-10-14 on `c850346`): a sea battle shows both sides. The […]
- [x] 5.9 Critic R5-B1 (report of 2026-10-14 on `c850346`), first of three: the air war seen at […]
- [x] 5.10 Critic R5-B1, second: the air-superiority mode is read. On day 20 of a war it shows 2 […]
- [x] 5.11 Critic R5-B1, third: the air war in what is read afterwards. No air event reaches the […]
- [x] 5.12 Critic R5-B2: the AI's air war keeps flying. Seed 7321: mean sorties aloft 19.1 in […]
- [x] 6.1 Nuclear tech chain, warhead production, stockpile, upkeep; global and per-nation toggles. […]
- [x] 6.2 Delivery: bombers (interceptable) and missiles (later tech). […]
- [x] 6.3 Blast + fallout (deterministic wind drift, decay) on cells, elements, cities. […]
- [x] 6.4 Nuclear decision utility (target value, desperation, retaliation incl. allies, taboo, MAD, doctrine). […]
- [x] 6.5 Consequences: relations, alliance unity, outrage, economic shock, peace/retaliation responses. […]
- [x] 6.6 Nuke FX at every tier (flash, shockwave, mushroom cloud, fallout overlay), alert banner, auto-pause option, go-to button. […]
- [x] 6.7 Scripted AI nuclear strike demo (seeded scenario where the AI *decides* to strike, not God Mode). […]
- [x] 6.8 Multi-decade sweep with nukes on: no runaway extinction; MAD dynamics observed. […]
- [x] 6.9 Phase 6 review, the phase's one review pass (PROMPT step 9, ADR-266): refactor debt, dead code […]
- [x] 6.10 Critic R6-B1 (report of 2026-10-15 on `228d083`): the nuclear years make the game crawl. […]
- [x] 6.11 Critic R6-B2 (report of 2026-10-15 on `228d083`), first of two: where the AI's warheads […]
- [x] 6.12 Critic R6-B2, second: who strikes whom. The first use in history is the Soviet Union […]
- [x] 7.1 Performance pass against all budgets (T0 60 fps, T2 30 fps @10k, tick ≤ 1.5 ms). […]
- [x] 7.1b Map sizes S–XL (ADR-43): convert the audited cell constants to km (identical at M, […]
- [x] 1.42 **Moved here from Phase 1 on 2026-10-03 (ADR-58, the user's decision): balance is […]
- [x] 7.2 30-minute soak with save/load twin comparison. […]
- [x] 7.3 Final multi-decade sweep (≥ 10 seeds) — borders moving, no hegemon. […]

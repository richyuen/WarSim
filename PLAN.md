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

- [ ] 4.4 Sea control per zone; sea supply; convoys; blockade; submarine raiding.
  From PLAN 4.1c (2026-10-09, ADR-244): the ports are data of the scenario (`world.ports`),
  not state. What builds, damages or blockades a port makes its levels state (the pin moves
  then). A reader takes `laneOf(world).portNode`: 36 of 615 ports have no node (water with
  no zone). 43 ports stand in held land with no province (New York, Sydney), so a port's
  province is not always known. A city placed in the editor gets no port.
  From PLAN 4.1d2 (2026-10-09, ADR-246): of the 36 ports with no node, those of 20 provinces
  are their province's only ones: 19 read by their names as on a lake or a river, and
  Narsarsuaq (Greenland) on the coast; Juneau and Valdez the same, in no province. Why the
  water of these three has no zone was not looked into. A port is to take water that has a
  zone where its reach has any.
  From PLAN 4.2b (2026-10-09, ADR-248): the supply system leaves a fleet alone, so its
  supply is 1 for ever. A fleet stands at a base its nation has lost (the land taken in a
  war, handed over in a peace, risen in a revolt): nothing sends it away, takes it or
  reads it. `portWater` (the fleets' water, by the terrain) and the lane graph's port node
  (by zoned water) are two rules for one cell: the same for the 61 bases with fleets, not
  looked at for the other 554 ports.
  From PLAN 4.2c (2026-10-09, ADR-250): a fleet sails any water and any passage, whoever
  holds its banks (Suez, Panama, Kiel, the Bosporus) and whoever it is at war with. Its
  supply is 1 however far it sails, and it burns no fuel under way.
  A fleet in a passage's step is over the canal's land cells for those hours (6 in the
  Suez canal), and a map import of terrain removes every fleet whose cell is land
  (`strandedToLand`, whatever the import changed): a fleet in a canal is gone by it. Read,
  not tried. The step's two cells are in its path: a fleet on such a step is to be left.
  From PLAN 4.2d (2026-10-10, ADR-251): ice is all the year (`data/maps/earth/ice.json`, 21
  seas closed): the map has no seasons, and the Baltic, the Gulf of Bothnia and the White
  Sea are open in winter. 16 ports have their water in the ice and keep a node with no edge
  (Tiksi, Dikson, Resolute, Qaanaaq): a port no ship reaches. A fleet of a scenario placed in
  the ice would have no way out (none of 1938 is: tested).
  AT: a blockaded port's income drops by the expected factor; an overseas formation loses supply when the lane is cut.
  Split 2026-10-10 (one cause to a commit):
  - [x] 4.4a Sea control per zone: who holds each zone, by the warships in it, contested by […]
  - [x] 4.4b Blockade: a port whose zone an enemy of its holder holds pays less. […]
  - [x] 4.4c Supply over sea: a bloc's network takes its ports that a way over zones no […]
  - [ ] 4.4d Convoys and submarine raiding: income of overseas land by sea; sinkings logged.
    From PLAN 4.4c (2026-10-10, ADR-259): `seaLinkedAll` (`src/sim/systems/seaSupply.ts`)
    gives each bloc's lands joined to home by sea; its ways are zone to zone, not the lanes'
    cells, and a land where the bloc has no port is not cut. Malta is cut from the first day
    of a war with Italy (Italy's fleets hold the zones about it).
    AT: a submarine flotilla in a convoy's zone cuts the income it carries (test).
  - [ ] 4.4e A fleet's loose ends: a base its nation has lost, a passage whose banks an
    enemy holds, a fleet in a canal under a map import, its supply and fuel at sea.
    AT: a fleet at a base taken by an enemy sails for another of its nation's ports; a
    fleet is refused a passage whose bank an enemy holds (test).
- [ ] 4.5 Amphibious invasion (embark, escort, land, penalties, bombardment).
  From the critic's report of 2026-10-05 (R2-B1: naval, air and nuclear scored 0; Phases 4,
  5 and 6 are their tasks): without transport by sea the sea powers are out of every war.
  The United Kingdom had 3,390,436 men in 317 formations and the same 17,000 cells for 20
  years of seed 31337. A British division ordered to Calais walked to the coast of Kent and
  stood there. The same holds for Japan's home army, for the United States and for every
  colony. All 15 templates that can be built are land formations.
  From the critic's report of 2026-10-07 (R3-B1, its first blocking issue again; the three
  differentiators still score 0): on seed 4242, 40 years headless, Canada holds 12.1 % of
  the cells and the United States 7.7 % in every year from 15 to 40, and Denmark
  (Greenland) 5.4 to 5.5 % in all 40. The division ordered to Calais stops 3.5 cells short,
  on the English coast. `data/units/sea.json` and `data/units/air.json` are read by nothing
  in play. The critic: "sea transport first, as it also unfreezes the maritime powers".
  AT: a scripted invasion lands and takes the coastal cells; it fails without sea control (test).
- [ ] 4.6 Naval AI (sea control, escort, raiding, invasion planning).
  AT: headless 1938 run: ≥ 1 fleet battle and ≥ 1 amphibious landing per 10 years on 3/3 seeds.
  From the Phase 3 review (PLAN 3.7c, 2026-10-07): a war between two nations with no land
  way between them has no front (France and Portugal with Spain at peace; ADR-149, ADR-152),
  and a formation that reaches no front stands where it is. How many wars of a game have no
  front, and how they end, was never counted: count it here first, then plan the landing
  for such a war.
  From PLAN 4.1d1 (2026-10-09, ADR-245): two formations in contact with water between
  them (an inlet, a river of the mask) stand so for 14 days and more, neither moving (seed
  99 with Germany against Poland by command, formations 386 and 439, hours 702 to 1,044 at
  least). Whether such a contact ever ends, and how many there are, was not counted.
  From PLAN 4.2b (2026-10-09, ADR-248): a navy is never cut. The economic AI sends no fleet
  home and desertion takes no ship, so a nation short of money by its navy cuts its army
  (the Soviet Union with an empty treasury sends home 79 of 162 formations where it sent
  67; Italy has 7 a month left against a margin of 33). Which ships a nation lays up, and
  when, is to be decided here. A fleet's upkeep is no part of the share of the income the
  AI lets an army take, and has no share of its own. The strategic AI's strengths and the
  men of a war's sides count no fleet: a navy weighs nothing in a declaration or a peace.
  From PLAN 4.2c (2026-10-09, ADR-250): only a player orders a fleet (`orderSail`, by the
  `moveFormation` command). A way costs about 2 ms and the lane graph 0.4 to 0.7 s at its
  first use in a game: count what a day of the AI's orders costs before it gives them.
  From PLAN 4.3 (2026-10-10, ADR-256): a fleet in a sea battle fights until it is under half
  the ships it came in with (or has no weapon against an armed enemy), then breaks off for
  its nearest port for 24 hours; a fleet with guns and no destroyer under a submarine
  flotilla's torpedoes cannot hit back and loses half before it leaves. Whether to seek or
  avoid a battle is the AI's.
  From PLAN 4.2e (2026-10-10, ADR-252): a nation with a shipyard can build a fleet, and
  the economic AI's build mix has no ship: which fleets it builds, and with what share of
  its income, is to be decided here (a battle squadron is 6,720 gold, 2.8 months of the
  United Kingdom's income, and 900 days).
- [ ] 4.7 Naval visuals: ship sprites, wakes, gunfire, torpedo tracks, sinking; sea-control map mode.
  From the Phase 2 review (PLAN 2.11c, 2026-10-05): the sea is one flat colour at T2 and T3,
  though the elevation carries the sea floor (quantised to 10 m for this). A lake that the
  fine mask has and the coarser coverage has not is drawn at T2 and T3 and not at T1.
  From PLAN 4.1d2 (2026-10-09, ADR-246): the mask has rivers, and a march crosses one on
  the straight line (4,645 steps of the map are not clear of water and have no way over
  land; 275 of 775,801 formation-hours in 90 days of seed 99). At T2 and T3 a formation is
  then drawn on the river. A way round a bay is walked in the step's time, up to 7.7 times
  as quick over the ground (485 ways are over three times their line). The line of a march
  drawn in the game is straight from cell to cell, not the way. None was looked at in the
  game. A formation on a way can be in a cell beside its step's two (104 of 4,358
  formation-hours on a way in the 90 days; 2 of them in an enemy's cell): what the rules
  that read a formation's cell make of it was not looked at.
  From PLAN 4.2b (2026-10-09, ADR-248; seven pictures looked at, `.cache/fleets/`): a fleet
  is drawn by what draws the land's formations. At T1 its marker is a land box with a hull
  for its symbol and its crews for its number (13.4k a battle squadron, 400 a submarine
  flotilla); the fleets of a base stack as one marker ("×4"). Far out, a counter folds a
  fleet's crews into its nation's men under the army's symbol (45.1k at Scapa Flow, where
  no division stands). At T2 and T3 the ships stand in a land block's rows, each the one
  ship sprite in its nation's colour, bows to the east, the tag "Battle squadron 1055" over
  them. Not looked at: the formation panel of a fleet, a marker stack of a fleet and a
  division, the ships at T3's closest, the ranking and charts (the men are the army's).
  From PLAN 4.2c (2026-10-09, ADR-250; three pictures looked at, `.cache/sail/`): a fleet
  under way is drawn as one that stands, its ships in their rows facing along its course.
  The dashed line of its order goes straight to its target, over Sicily from the west of
  it to Alexandria: not its way. Its way is 8-way steps between cells' water points, so on
  a leg that is neither it turns by 45° from cell to cell. A step can clip a shore of the
  fine mask (346 of 493,400 places on 90 ways between ten bases; none from Gibraltar to
  Suez), and in a passage the fleet is drawn over the land. `World.seaPoint` asks the mask
  each hour for a cell by a coast: not timed with many fleets under way.
  AT: naval battle demo e2e + screenshots at T1/T2/T3 viewed.
- [ ] 4.8 Phase 4 review: re-read SPEC for drift, PARITY rows updated with evidence, and the
  smoke run of ADR-58: one `npm run sweep:quick`, not a balance verdict.
  AT: the five limits of the quick sweep are in PROGRESS; a limit that fails is in BLOCKERS,
  or fixed if a defect of this phase's feature caused it. No constant is tuned for it.

## Phase 5 — Air

- [ ] 5.1 Air wings, airbases, carriers, range; air zones.
  AT: a wing cannot be assigned a mission outside its range (test).
- [ ] 5.2 Mission scheduler + sorties as derived kinematics.
  AT: the sortie position function is pure (same inputs → same output, property test) and matches the sim's interception points.
- [ ] 5.3 Air combat, interception, AA; air superiority per zone.
  AT: outcome tests (fighters beat bombers; AA attrition rate).
- [ ] 5.4 CAS + tactical bombing effects on ground battles; naval strike; carrier air groups in fleet battles.
  From PLAN 4.3 (2026-10-10, ADR-254): a battleship sees 18 km by the units' data, so a
  battle line sees a cruiser at 17 km and its 32 km guns hold a stand-off only where the
  enemy sees it first: spotting aircraft (a cruiser's or a carrier's) are to give a fleet
  its detection. A carrier has no weapon in a sea battle and breaks off at once (ADR-256).
  AT: a battle with air superiority has a better outcome by the expected margin.
- [ ] 5.5 Strategic bombing of industry, ports and cities (income/production damage, repair).
  AT: bombed industry produces less until repaired (test).
- [ ] 5.6 Air AI tasking.
  AT: headless run: air superiority contested over active fronts; strategic bombing appears when superiority is high.
- [ ] 5.7 Air visuals: planes along sortie paths, dogfight tracers, flak, bomb impacts; air superiority map mode.
  AT: air battle demo e2e + screenshots viewed.
- [ ] 5.8 Phase 5 review: re-read SPEC for drift, PARITY rows updated with evidence, and the
  smoke run of ADR-58: one `npm run sweep:quick`, not a balance verdict.
  AT: the five limits of the quick sweep are in PROGRESS; a limit that fails is in BLOCKERS,
  or fixed if a defect of this phase's feature caused it. No constant is tuned for it.

## Phase 6 — Nuclear AI

- [ ] 6.1 Nuclear tech chain, warhead production, stockpile, upkeep; global and per-nation toggles.
  AT: with nukes disabled, the warhead count is always 0; enabled, a test nation builds warheads.
- [ ] 6.2 Delivery: bombers (interceptable) and missiles (later tech).
  AT: bomber strikes are intercepted at the expected rate under air superiority.
- [ ] 6.3 Blast + fallout (deterministic wind drift, decay) on cells, elements, cities.
  AT: unit tests on casualty falloff and fallout decay half-life; fallout map mode screenshot.
- [ ] 6.4 Nuclear decision utility (target value, desperation, retaliation incl. allies, taboo, MAD, doctrine).
  AT: table-driven tests: MAD pair → no first use; desperate fightToDeath nation vs non-nuclear enemy → use; post-first-use taboo drop raises others' propensity.
- [ ] 6.5 Consequences: relations, alliance unity, outrage, economic shock, peace/retaliation responses.
  AT: tests per consequence; the history log has a nuke entry with yield and casualties.
- [ ] 6.6 Nuke FX at every tier (flash, shockwave, mushroom cloud, fallout overlay), alert banner, auto-pause option, go-to button.
  AT: screenshots at T0/T1/T2 viewed.
- [ ] 6.7 Scripted AI nuclear strike demo (seeded scenario where the AI *decides* to strike, not God Mode).
  AT: e2e passes and asserts that the decision record came from AI utility.
- [ ] 6.8 Multi-decade sweep with nukes on: no runaway extinction; MAD dynamics observed.
  AT: sweep report: in ≥ 1 seed nukes are used; in no seed does > 50% of land carry fallout.
- [ ] 6.9 Phase 6 review: re-read SPEC for drift, PARITY rows updated with evidence. The sweep
  of 6.8 is this phase's smoke run (ADR-58); the features are in, so sweeps judge again from
  here.
  AT: the five limits of the 6.8 sweep are in PROGRESS, with what fails listed for Phase 7.

## Phase 7 — Balance, polish, soak

- [ ] 7.1 Performance pass against all budgets (T0 60 fps, T2 30 fps @10k, tick ≤ 1.5 ms).
  AT: `docs/bench/` report green on the reference machine.
  From the Phase 2 review (PLAN 2.11c, 2026-10-05), to settle in this pass:
  - The ground's instances are capped at 12,000. A view of forest has up to 10,900 at
    1920 × 1080, so a larger view passes the cap, and what is cut is the finest level, row by
    row from the top: the trees thin out below a line. The cap by the view's size; beyond
    what a frame affords, an even thinning. (The tests look at 1400 × 800.)
  - The page holds the land mask twice (16.8 MB for the scatter, as much on the GPU) and the
    worker once.
  - A GPU that takes no texture of 8192 px (WebGL2 promises 2048) draws the coarse coast at
    T2 and T3, where the fine mask's land can be sea, and nothing says so.
  - Fractional device pixel ratios (Windows at 125% and 150%): a marker's box picture is
    rounded up and drawn into the unrounded rectangle (38 px into 37.5 at 1.25). Not traced;
    no layer has been looked at at such a ratio.
  - What the ground costs a frame where there is no GPU (the tests' rasteriser: readings
    varied by a quarter).
  - From PLAN 2.11j (ADR-81): a supply refresh of some blocs is done again in full when a lane
    one of them held is not its own afterwards, also when a lower bloc refreshed with it took
    the lane, where the first result was right. How often a refresh goes full was not
    counted; the tick rose by 0.036 ms.
  From PLAN 3.4Rm (2026-10-06): the tick of seed 99 over five years is 1.81 ms (budget
  1.5), year 1 2.49 (budget 2.4). What two years cost, of 39 s, and what was not cut:
  - Long routes found: 4,604 at 0.82 ms, 3.8 s. The search fills its corridor; the heap's
    two sift lines are 4.9 % of the tick. A faster heap must keep the order of (key,
    sequence), or routes change with the ties.
  - Orders refused after a search: 1,283 long ones at 1.5 ms and 312 short ones at 3.3 ms,
    3.0 s. 45,987 of 58,232 orders were refused (38,978 by the provinces, at no cost): the
    AI allots formations to fronts they cannot reach and asks every day (PLAN 3.5). An AI
    that does not ask is a rule, and moves the pin.
  - `passageOf`: 10,993 at 0.085 ms, 0.9 s, once for each plan that orders.
  - `planNation` before its orders: 5.6 s before the cut of 3.4Rm (the frontier's cells by
    sector 1.4 s, 1,228 cells and 300 sectors a plan; the threat 1.5 s; the allotment
    1.5 s). Each planner of a coalition builds the sectors of all its partners' fronts.
  - Not the AI: `refreshSupplyNetwork` 12 %, `findBattles` 8 % (half of it one line, the
    lookup of a bucket's neighbours).
  From PLAN 3.5b (2026-10-07, ADR-152): the tick of seed 99 over five years is 2.23 ms,
  year 1 3.04 (1.86 and 2.46 before the rule: formations that stood idle march and fight).
  What year 1 costs, of 28.7 s: `combatSystem` 8.2 s, `planNation` 8.3 s (its orders 3.7,
  the sectors 1.0, the enemy scan 0.75, the passage and the reach 1.2, the nearest and the
  threat 0.66, the allotment 0.57), `supplySystem` 4.0, `territorySystem` 2.7. Not cut:
  - `passageOf` is made for every plan with a formation in range (0.9 s; planners with the
    same open holders share one). It was made for the plans that ordered.
  - The sectors and the threat are built for every class's allotment from one list; a
    nation with formations on many islands has a class for each.
  From PLAN 3.5e (2026-10-07): with the spearheads and the mix (3.5c, 3.5d) the tick of
  seed 99 over five years is 1.67 ms (budget 1.5), year 1 2.44 (budget 2.4); year 5 is 1.94
  (949 formations, 25,528 cells flipped). No profile was taken of this game: the parts
  above are of 3.5b's.
  From the Phase 3 review (PLAN 3.7c, 2026-10-07):
  - The frame with hulls was timed with 5 of them, the script's part, in a browser that
    draws on the CPU (0.58 ms, PLAN 3.6e4). Up to 2,000 are held: time a frame with many,
    flames on, on a GPU. The same for the second sample of the small mark at T2 (3.6e3b)
    and the turrets' pass (3.6b).
  - What of year 1's rise from 2.06 ms is whose (the rules of Phase 3, the formations of
    PLAN 3.1c, or the wars the pin's moves chose) was not taken apart (3.4Rm).
  - The operational AI's own refused orders: 476 and 1,082 in a year (seed 99, seed 7),
    where the provinces let a route through and the search finds none (3.5b).
  From the critic's report of 2026-10-05 (the pace in R2-B5; its N9 and N19):
  - **The top speed.** At Max the game makes 885 ticks a second at the start and 794 after
    ten years: 33 to 37 days a second, 10 to 12 s a year. AoC's text gives a month in 0.5 s
    at 1× and 5× at most, so its usual speed is about twice this game's fastest (text only).
    A tick of 1.5 ms, the budget, allows no more on one thread: a faster top speed needs
    another budget or another way (the critic: leave out element-level work where nothing is
    watched). It is here and not before Phase 3 because each of Phases 3 to 6 adds to the
    tick (ADR-83).
  - One zoom without a stop from the world to 1 m/px froze for 2,878 ms, after every tier
    had been seen once (so not a first compile). At Max with the camera at 400 m/px the
    frame gaps were 113 ms at p95 and 452 ms at worst, 14 over 100 ms in four seconds; at ×5
    the close tiers drop a frame of 124 to 146 ms every few seconds.
  - Headless, 40 years of seed 31337: a mean tick of 1.14 ms, p95 up to 8.6 ms.
  - T0 unthrottled at 1920 × 1080 on an RTX 4070 Ti: 116 to 144 fps (a draw of 4.4 to 5.7
    ms). No weak GPU has been measured.
  From the Phase 3 review (PLAN 3.7e, 2026-10-07): the quick sweep (10 seeds × 20 years, ten
  processes) took 14.2 min where Phase 2's took 4.9 (8.4 to 14.2 min a seed). Five years of
  seed 99 alone, pinned, the same hour: 1.521 ms a tick (1.466 at PLAN 3.4Rd), which is 4.4
  min for 20 years. Not looked into: whether years 6 to 20 are slower than the first five
  (95 to 171 nations alive, against 96 to 139), or ten processes side by side are (memory,
  the cores), or the machine was busy. A 20-year run of one seed alone, with its tick by
  year, tells the first from the rest.
  From the critic's report of 2026-10-07 (R3-B5; the tick over its budget is PLAN 3.10):
  - **The top speed, again.** At Max, alone, at the world view: 15 to 28 s a simulated year
    (10 to 12 s in the last report). The 14-year script of run 2 took 16 to 61 s a year,
    with other runs beside it, against 8 to 19 then. Fifty years are about 17 minutes of
    watching. The critic's fix: a coarse path of the sim for fronts that no close tier
    watches.
  - Hitches of 100 to 157 ms at T3 while the sim runs; otherwise 115 to 860 frames a second
    uncapped at 1920 × 1080 on every tier (an RTX 4070 Ti).
  - From PLAN 3.10 (2026-10-08, `00c2e68`; pinned, `--profile`), what its AT of five years
    did not ask for:
    - The first year: 1.98, 1.67 and 2.24 ms on seeds 99, 4242 and 8128, combat 0.90, 0.70
      and 1.00 of it in 2,787, 1,419 and 3,781 calls of 1 ms or more (0.21 to 0.50 in the
      years after).
    - A long war: seed 8128's years 7, 8 and 9 are 2.06, 2.26 and 1.59 ms (ten years:
      1.557). The operational AI is 0.92, 1.02 and 0.79 of it and every one of its 1,460
      calls a year takes 1 ms or more; territory is 0.40, 0.51 and 0.30 (0.14 to 0.27 in
      the first five years); 53,540 to 77,033 cells change hands a year. The critic read
      2.59 and 1.80 for years 8 and 9.
    - One call of the operational AI of 361.7 ms, year 4 of seed 4242 (the next longest of
      25 years: 43.3). Not looked at.
    - Not looked at in 3.10: the quick sweep of 3.7e (14.2 min against 4.9) and 40 years of
      seed 4242 headless (19.9 min, other runs beside it). Twenty years of 4242 were 1.847
      ms at 3.10b and were not run again.
- [ ] 7.1b Map sizes S–XL (ADR-43): convert the audited cell constants to km (identical at M,
  hash-checked); per-km territory hold rates and garrisons; L/XL terrain assets (revisit
  ADR-13); per-game geometry instead of SIZE_1938; a size picker in the new-game options.
  The shares of land are km² since PLAN 1.42e (ADR-57: a war's shares, overextension, the
  admin cost). Left in cells for this task: `OVEREXT_CELLS`,
  `MILITIA_PER_CELLS`, the largest fragment of a collapse (`revival.ts`).
  AT: S and L games start from the picker; the sweep criteria hold at S and L; XL meets its
  tick and memory budgets.
- [ ] 1.42 **Moved here from Phase 1 on 2026-10-03 (ADR-58, the user's decision): balance is
  judged when the features are in. Blocked after three attempts before that (BLOCKERS.md);
  its prerequisites 1.42d, 1.42e and 1.42f are done. Judged by area, on seeds from 401.**
  Critic B1 (static world), continued: every seed passes the two criteria added on
  2026-10-03 (≥ 2 new nations in the top ten by land; leader share range ≥ 3 points). State after
  ADR-47: 9 of 10 unseen seeds green (`docs/sweeps/2026-10-03-sweep-b1.md`); seed 109 fails
  the leader-share range (2.7 points). Do not move the thresholds. (The tick time that
  ADR-47 raised is back under budget since PLAN 1.42a.)
  Second attempt, 2026-10-03, after 1.42b and 1.42c: seeds 201–210, **7 of 10 green**
  (`docs/sweeps/2026-10-03-sweep-b1c.md`, FAILING): 204 and 208 have one newcomer in the top
  ten, 208 and 209 a leader-share range of 2.4 and 2.6 points. Seeds 201–210 are now seen.
  The leader is the Soviet Union in every year of all 24 runs to date and it only shrinks, by
  an amount that depends on the seed's luck with revolts: the next attempt needs a mechanism
  that acts on every seed (see PROGRESS 2026-10-03 for candidates), not more tuning. A third
  failed attempt goes to BLOCKERS (PROMPT step 8).
  Third attempt, 2026-10-03 (ADR-51): the winner of a peace keeps all the land it occupies.
  Scratch sweep on the seen seeds 101–110: 10 of 10 (leader range 4.1–16.1, 2–4 newcomers).
  Unseen seeds 301–310: **8 of 10** (`docs/sweeps/2026-10-03-sweep-b1d.md`, FAILING): 304 and
  306 fail the leader-share range (2.6 and 1.6 points); every seed has 2–3 newcomers.
  **Criteria changed 2026-10-03 (ADR-54, the user's decision), before any 50-year run by
  area:** the two criteria above are reported and no longer judged. A sweep passes when every
  seed keeps the five limits and at least 8 of 10 seeds have a riser and at least 8 of 10 a
  faller, both measured on realms (SPEC §10). The three FAILING reports stand as they are and are not re-judged; only
  seeds from 401 judge this task. The quick sweep (10 seeds × 20 years) comes first: run
  the deciding sweep when it shows risers and fallers on most seeds, not to find out.
  From the critic's report of 2026-10-05 (R2-B5, and the rate in R2-B6; deferred by ADR-58,
  not disputed, logged once in PROGRESS):
  - Seed 31337, 40 years headless: the top five by cells are the Soviet Union, Canada, the
    United States, Denmark (Greenland) and France in every year from 8 to 40. Australia has
    25,987 cells from year 5 to year 40. The Soviet share is 26.5 to 28.3% for 33 years and
    falls to 17.8% in the last seven. Men 4.76 M → 9.74 M. Nations 101 → 136 living, 180
    ever founded.
  - Seed 2718, 14 years in the browser: Europe changes; Brazil has 6.38 to 6.39% and
    Australia 6.11% of the land in every yearly sample; the leader 15.9 to 16.8%.
  - Land breaks away often: 396 of 1,226 events in those 14 years (32%) are "broke away".
  - Of the same kind and not blocking: armies lose 61% and 87% of their men in 60 days of a
    war that moves the front by a border strip (N1); a war takes in half the world ("United
    Kingdom +33 ⚔ Angola", Poland against Xinjiang; N2).
  - What the critic asks of the sweep: a run whose top five are the same for 20 years fails.
  From the critic's report of 2026-10-07 (R3-B2, the long run; deferred by ADR-58, not
  disputed, logged once in PROGRESS; the one event of seed 6021 is PLAN 3.9):
  - Seed 4242, 40 years headless: 97 nations alive in year 1 and 170 in year 40; 430
    founded in all. Seed 6021, 14 years in the browser: 97 → 136 alive, 207 ever founded;
    59 of the 137 alive in 1952 are "Free <province>". The world breaks up and does not
    come together again; AoC's long runs end in a few empires (pictures).
  - Better than the last report: on seed 6021 France rises to first by land, the Soviet
    Union falls from 15.6 % to about 5 %, Germany takes central Europe. The Americas do not
    move (PLAN 4.5).
  - Of the same kind and not blocking: Germany against Poland, 90 days of seed 4242:
    Germany loses 304,000 of 564,000 men, Poland 373,000 of 418,000, and no cell changes
    owner before the peace (the rule of ADR-51: land is held, then kept at the peace). AoC
    hands land over as it is taken (text). Whether held land should go over during a war
    is for this task to decide.
  - Left by PLAN 3.9 (ADR-186): a rebel state grows without end by the revolts that join it
    (`risingNeighbour`), each now at most a million km²: "Free Herat" of seed 6021 had 2.66 %
    of the world in 48 provinces of three former holders before the revolt that made it
    5.97 %. An area also joins rebels of another people (Soviet core land, a Korean state).
    To decide here: rebels take in only risings against the holder they are at war with, or
    stop at a size.
  - What the critic asks: weak statelets annexed in one war; a sweep whose count of living
    nations rises for 20 years fails.
  From the Phase 3 review (PLAN 3.7c, 2026-10-07), what the rules of armour left open. None
  is tuned before the sweeps are back (ADR-58):
  - The retreat (ADR-150): wars kill a third of the formations they did. Whether they still
    end was not looked at. Nothing fires on the retreating, the encircled do not surrender,
    and a formation with no supply retreats from every contact (51 times in a year).
  - The spearheads (ADR-153): one attack in eleven comes to contact (261 of 2,900 and 226 of
    2,690 a year), and why the others end was not counted (a new order to another cell, a
    sector that stops attacking, the cell taken by another). The rest are not sent after
    the armour in the same plan; infantry on the march at the enemy's cell keeps its order
    (a quarter of those sent to an armour's attack); no armour moves between sectors.
  - The mix (ADR-154): Italy, the Soviet Union and Japan stay under the share they want
    (they save and their treasuries do not grow); a nation with nothing in training buys
    the best it can pay, the division of 1938 after 1941 too; one at war that saves raises
    one infantry division at a time.
  - The allotment (ADR-152): a sector allotted more of a class than stand near it takes
    them from afar.
  - The march home (ADR-169, ADR-222) is unfed (ADR-143) and has no longest way: to the
    nearest cell of its nation within 80 cells, else to the spawn point on foot, and since
    ADR-222 round the ground of its nation's enemies. Seed 77, three years: 15 of 358
    marches home last 30 days or more and 4 last 90 or more, none of them standing: 20,661
    men at the mark, 8,099 at the end; three Japanese formations walk 153 days and arrive
    with 5, 49 and 48 men of 785, 2,654 and 2,585. An Italian division in Madrid with
    France the enemy is sent by Gibraltar and the Levant, 556 cells. Whether a way home has
    a longest length (and the formation then stands, or is disbanded into the pool), and
    whether a march home is fed by the nation it crosses.
  From the review pass 3.12R (PLAN 3.12Rj, 2026-10-09), left by PLAN 3.12b2 (ADR-210). Not
  tuned before the sweeps are back (ADR-58):
  - Land rises and goes back to its core nation month after month (`defect` called by
    `revolt`, the one `LandCeded` whose former holder lives): about 22 history rows a year
    (190 in the ten years of seed 1, a tenth of its rows), and the same two nations in
    months running (the Soviet Union's land to Italy in five months of seed 3, ticks
    29,184 to 32,136). Why Italy has cores there was not looked into. To decide here:
    whether a holder keeps so little of what it took that it loses it an area a month
    (the suppression spending, the unrest of land with another's core), and whether the
    cores of the data are right where it happens. The rows are not the log's to drop.
  AT: `npm run sweep -- --first 401 --tag <name>` (seeds no tuning has seen) all green.
- [ ] 7.2 30-minute soak with save/load twin comparison.
  AT: `npm run soak` passes with no crash and no desync.
  From the Phase 3 review (PLAN 3.7c, 2026-10-07):
  - Nothing stops an `undefined` or a NaN out of arithmetic from being written to the
    history or a table (ADR-155 found one by the page's hash leaving Node's). The soak
    looks for one in every float section of the state, each day.
  - Commands the page never sends are applied with numbers that are finite and out of range
    (the seventh and sixth reads: a strength of -5, a place at 1e9, a member twice, a side 5,
    a province 1.5, a line of `editPaint` to 1e9 that takes 13 s). Only a worker message or
    the page's test API can send them. Refuse them where a scenario file or a script could.
- [ ] 7.3 Final multi-decade sweep (≥ 10 seeds) — borders moving, no hegemon.
  AT: sweep report green.
- [ ] 7.4 Visual polish vs reference (borders, labels, UI frames, flags, fonts).
  From PLAN 4.1c (2026-10-09, ADR-244): Switzerland holds a cell in the Po delta (1094, 323
  at M, by Ferrara). The communes of Liechtenstein are each smaller than a cell and were
  placed there, one on land and others as cells of the Adriatic with a province
  (`src/sim/data/provinces.ts`, the placing of a province under a cell).
  `tests/unit/ports.test.ts` names SWI as the one nation with a coast and no port.
  AT: side-by-side screenshots vs reference frames logged in PROGRESS.
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
  - **Tags under the page's boxes** (seen 2026-10-07, PLAN 3.10c1b,
    `docs/evidence/3.10/c1b-tanks.png` and the tank battle demo's stops 5 and 6): the tag of
    "Light infantry division 418" lies under the map mode's legend at the bottom right, and
    at the two closest stops the brigade's tag stands at the top edge, half under the title
    bar. The tags give way to the war banners and the bottom bar only (PLAN 2.14f2).
  - **A tag far from its block at T3** (seen 2026-10-07, PLAN 3.7f,
    `docs/evidence/2.10/stop-7-battalions.png`, after ADR-168): at 12 m/px the tag of
    "Motorised division 47" stands at the view's right edge and its line runs 480 px back
    across the fight to the middle of its elements, with open ground much nearer its block.
    Which of the blocks in the picture are that division's was not read; a division whose
    elements span the view has its box's side far from their middle.
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
    - Capitals whose names are left out because garrisons stand on every place by the dot:
      Prague at 1800 m/px, Warsaw at 1000, with Turin, Kiev and Kraków, at the 1938 start.
      The places are eleven fixed ones.
    - Order arrows are not kept clear of, by decision; in a war they are many (two months
      into seed 1938 the picture over Austria is mostly arrows). Whether every marker's
      arrow should show at T1 has not been asked.
    - T2 → T1: names give way from the first frame to markers that show at 2%. T1 → T2: a
      name can take a place under a number that still shows.
    - `cityLabels` `wanted` is exclusive where the tiers are inclusive: at exactly 2000 m/px
      the names of size 4 are off while the T1 markers are on.
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
  - **Picking.** A marker in a stack cannot be picked by a click on the map (the lead is what
    is there). A selection ring stays on an id that a new formation has taken, and such a
    formation takes the dead one's place in a stack for one fade.
  - **A worn element at T2** is a paler sprite (PLAN 2.11g). On a light nation colour over a
    light fill (Japan's on China's) a sprite at 0.55 and one at 1 are close to the eye.
  - **The legend at T2 and T3.** It says "Hatched: occupied land" at every zoom; since PLAN
    2.11f occupied land is a tint with an eighth of the hatching there.
  - **Flags by scenario.** Done in PLAN 2.16b (ADR-109) for the worlds without a nation
    table. Left: a second table (another year) brings its own flags file; the worker and
    `ScenarioInfo.nationTags` know only that of 1938.
  - **From the pictures of PLAN 2.14, shot again (2.14f6, 2026-10-05):** a tag at the view's
    top edge stands under the top bar (`contact-5m.png`; the nation, formation and ranking
    panels are no obstacles to a tag either); figures at 20 m/px are faint on a plain
    (`to-battle-front.png`); a war banner without a battle differs from one with a battle by
    its swords and frame only (`to-battle-banners.png`).
  - **The random world's names** (the sixth read, PLAN 2.16Ra, 2026-10-05): with 150 and 200
    nations most seeds have several of one name (seed 7 with 200: four called "Eastern";
    seed 1 three "Central"); none seen at 60 or fewer on ten seeds. One capital to a
    province, but the provinces' names repeat across countries. With the line below.
  - **Two nations of one name** (PLAN 2.15b, ADR-100, 2026-10-05). A founded nation is
    "Free <province>", and 114 names are held by more than one province ("Valmiera" 21,
    "Central" 10, "Northern" 8, "Saint George" 7); a province without a name gives its
    country's, so "Free Colombia" can stand beside Colombia. Not seen in a game yet.
  - **Land painted on the mask's water** (PLAN 2.15e2b, ADR-105, 2026-10-05). The editor can
    paint land on a cell the fine mask has no land pixel for: the map draws sea there and a
    formation raised on it stands off sure land, as the eight atolls did. The world's build
    gives an islet to the cells of the scenario only.
  - **The Spratly Islands are nobody's in 1938** (PLAN 2.15e2b): unowned land in the
    scenario's data (France and Japan both claimed them). Not looked into.
  From the critic's report of 2026-10-05, not blocking and in no task above (its numbers):
  - N3: occupied land stays hatched for years after a peace (Europe after 14 years of seed
    2718). A rule to look at, not a look: what a peace does with land that is held.
  - N4, N5: T1 in a war is a web of order arrows from formations off the screen; markers
    overlap round Warsaw at the start, one under the capital's flag.
  - N6: no city panel (the formation panel and the tooltips are PLAN 2.14).
  - N7: Escape closes neither the nation panel nor the history; F1 to F6 and the number keys
    do not change the map mode (eight modes behind one button that cycles); a double click
    does not zoom.
  - N8: at 1024 × 600, playing a nation, the pause button and the date are off the screen;
    at a phone's width the ranking lies on the nation panel.
  - N10: seven alliances are all named "Defensive Pact"; the history shows "#24" for one.
  - N12, N13: choosing the editor's terrain layer leaves the map in the political mode (a
    stroke changed 508 cells and nothing on screen); the flag editor has no undo, line or
    circle.
  - N14: ranking rows have no flags and five metrics (AoC: nine lists, the dead marked);
    charts have no axis ticks and no value under the cursor; the economy tab is six numbers.
  - N15, N16: map names and counters show through the Ranking panel; war banners stand three
    rows deep over the map.
  - N17: a black smear under a counter near Bern in 1952 of seed 2718.
  - N18: no sound; one language.
  - N21: while the game runs, half-faded counters are on screen all the time as the clusters
    regroup ("432", "29.6k" at part opacity, 60 days into a war at 2500 m/px).
  - Against AoC's God panel: the World AI settings (one checkbox stands for about fifteen),
    a nation spawned with a size, cities made and removed in the game, gold, CE, colour and
    unity edited from the God tab, donations (PARITY has the rows).
  From the critic's report of 2026-10-07, not blocking and in no task above:
  - At 400 m/px the order line of every formation is drawn for an observer: dozens of
    dashed yellow lines across the view. The critic: only for what is selected.
  - Occupied land at the close tiers is washed in the occupier's colour: French-held
    Germany is a blue field that reads as a lake. After 14 years the Soviet Union is a field
    of thin stripes of other nations' colours.
  - War banners are drawn over the bottom rows of the History panel. The date label wraps
    when "· Paused" does not fit, and the bar jumps.
  - Still there from the last report: Escape closes no panel, no hotkeys for the map modes,
    no tooltip on hover, the layout at 390 × 844 (panels on each other).
  - A Kill leaves successors in greys that are nearly one colour. The random world names
    nations after provinces ("Seine-Maritime") and paints half of them purple or magenta;
    after three years one of them owns western and central Europe (that part: PLAN 1.42).
  - Against AoC's God panel: Annex, Recolor, Fight to the Death, Donate (Nuke: Phase 6).
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

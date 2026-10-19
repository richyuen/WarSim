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

Run 8's blocking issues and its dimensions under the DONE condition's bar (report of 2026-10-17 on
`fd27e85`, its "Fix" lines and evidence; R8-B1 to R8-B3 are PLAN 7.18 to 7.20, the dimensions 7.21
to 7.25; PROMPT 2a, ADR-486). A task each, split when taken up:

Run 9's (report of 2026-10-19 on `f0be88c`, `critic/CRITIC_REPORT.md`; run 8's three blockers
fixed): R9-B1 and R9-B2 are PLAN 7.31 and 7.32, the dimensions under the bar 7.33 to 7.37 (stats 6,
semantic zoom 7, naval 6, aircraft 6, AI nuclear use 7; tanks reached 8). The late air war's fall
is 7.29's matter (ADR-519), taken up with 7.36. A task each, split when taken up:

- [ ] 7.35 The war at sea seen and fought (naval 6, needs 8): beyond 7.31, the war at sea mostly
  invisible: Italy–UK (seed 2251) 25 six-hour samples with a live battle on days 6 to 12, none with
  a ticker row (`c9_n_2251_ITA_ENG.json`); Japan–USA (seed 3407) no sea battle in 12 days
  (`c9_n_3407_JAP_USA.json`); after year 1 13 sea battles a world-year against year 1's 36
  (`c9_headless_*.json`); at 20 m/px destroyers about 10 × 3 px and submarines 5 px
  (`c9n_2251_ships_20m_crop4x.png`). Measured first: why a live battle gets no row, and why the
  Pacific's two fleets do not meet. AT: every live sea battle that sinks a ship has its row;
  Japan–USA on seed 3407 meets at sea within its first weeks, or the reason is a measured one;
  ships at 20 m/px drawn at a size their class reads (counted in px); the late battles per
  world-year on the critic's seeds, before and after. A part each:
    - [x] 7.35a A carrier's battle has its row. Measured (`tools/diag/seaRows.ts`, seed 2251 at
      `951b1c6`, Italy on Britain at once, 12 days; `docs/evidence/7.35/measure.md`): 6 battles,
      each with a row some hours; 114 of their 159 hours with none, and 74 of the 207 ships sunk
      in those hours, all by British carrier groups' wings from 220 to 280 km (no ship's weapon
      reaches then: ADR-494 gave such a battle no row). A battle whose carriers' wings reach an
      enemy surface fleet has a row of its own kind (a carrier strike), framing the struck fleet
      at a zoom where the strike is drawn. AT: `seaRows` on 2251, ships sunk in hours with no row
      0 (was 74); every hour with a live battle in which a weapon reaches has a row (the hours
      with none counted, and why); the strike row clicked in the page,
      the struck ships and the strike seen (a screenshot, viewed); the specs that take a battle's
      row take a ship's-reach one; render only, the pin unchanged.
    - [ ] 7.35b Japan–USA on seed 3407 meets at sea within its first weeks, or the reason is a
      measured one (where each side's fleets go, and why). In three parts:
      - [x] 7.35b1 Measured (`tools/diag/seaMeet.ts`, `docs/evidence/7.35/measure-b.md`): the US
        Pacific Fleet (51,000 power at San Diego and Pearl Harbor) has no Japanese port within
        `SORTIE_KM` (nearest 5,926 km) and stands in port all 60 days measured; no US port
        between Hawaii and Guam in the data (hops 4,230, 6,152, 2,567 km); Japan's fleets go to
        China's ports and take Guam and Davao unopposed; the Asiatic squadron sails to Takao, finds
        no ship and is sunk by Formosa's wings (hours 100 to 124). Least gap 279 km, no battle.
      - [x] 7.35b2 A warfleet at war with no enemy port within `SORTIE_KM` stages: it sails to
        the port of its bloc nearest an enemy port, when that port has one within `SORTIE_KM`
        and is nearer one than the fleet is (a transit, not bounded by `SORTIE_KM`); the sortie
        test then runs from there. AT: a unit test (stages; stays with no nearer base; a fleet
        with a port in reach it cannot win does not stage); `seaMeet 3407 JAP USA` 30 days: the
        Pacific Fleet leaves San Diego and a Japan–USA sea battle, with its row (`seaRows`), or
        the measured reason; Italy and Germany against the US stand as before; the pin's entry.
      - [x] 7.35b3 A sortie's test of its target zone counts no land-based air: the Asiatic
        squadron sails into Takao and is sunk by wings on Formosa with no sea battle. Measured
        (how often a fleet is sunk at a sortie's target by air alone, on the critic's seeds),
        then a rule with an ADR, or the reason. In two parts:
        - [x] 7.35b3a Measured (`tools/diag/seaAir.ts`, `docs/evidence/7.35/measure-b3.md`; the
          critic's 14 headless seeds × 2 years): 121 sortied fleets sunk by land-based air alone
          against 30 in sea battles (287 sea battles); land air took 420,000 hp of sortied fleets,
          the sea battles 180,250. All 121 had arrived, 114 at a port with no enemy ship; median
          33 days and 26 strikes from the order to the loss. The order-time air separates them
          poorly (13 of 59 lost groups, 22 of 203 that fought); a naval-role wing in range of the
          fleet where it stands with no enemy ship names 115 of the 121 and 182 of 3,146 others.
        - [x] 7.35b3b The rule at both seams (`plan`): a warfleet away from its ports, no enemy ship
          in its zone, with an enemy naval-role wing (`naval_bomber`) based within its range of
          the fleet sails home; the sortie test passes over an enemy port's water such air covers
          while its zone has no enemy ship to fight (else the fleet sent home is sent back). One
          list of the enemy's naval wings per `plan` call (navalAi 0.039 ms a tick). AT: a unit
          test each (home from an empty port under naval bombers, red without the rule; stays
          with none; the sortie takes another port); `seaAir` on the 14 seeds × 2 years, sunk by
          air alone 121 → fewer and sea battles 287 not fewer (else the reason); `--profile`; the
          pin's entry and an ADR. Decide in the ADR whether a fleet escorting a landing (within
          `AT_PORT_CELLS` of an `embarked` water) is exempt, and test it. In the same commit, the
          doc's §2 medians (33 days, 26 strikes) recomputed on the 14 seeds: they came from the
          16 cases' first pass (n = 125).
      - [ ] 7.35b4 A fleet at a lost base sails for its nation's nearest port, not its bloc's
        (`atLostBase`, `sailHome`, ADR-261): on seed 3407 with 7.35b2 the US fleets stage to
        Guam, Japan takes it on day 6, and they turn for Pago Pago (4,300 km) rather than the
        Philippines (2,000 km); the first Japan–US battle comes on day 39.5. Also in its code:
        `forwardBases` (7.35b2) has no basin filter as `nearestOwnPort` has (`basinOf`): a bloc
        port on a lake or another basin may be the nearest, `orderSail` refuses it every turn and
        the next nearest is never tried; and `seaMeet`'s `why` column does not tell a staging
        order (mirror `forwardBases` before the "before" run). And from 7.35b3b (ADR-544):
        `forwardBases` reads the unfiltered `targets`, so a fleet may stage to a base whose every
        port in reach is empty water under the enemy's naval bombers, and stand there. AT: measured on
        `seaMeet 3407 JAP USA 40`, before and after; a unit test; the pin's entry.
    - [ ] 7.35c Ships at 20 m/px drawn at a size their class reads (destroyers about 10 × 3 px,
      submarines 5 px in `c9n_2251_ships_20m_crop4x.png`), counted in px. `shipMarks1938`'s T3
      test is red at `951b1c6` (a destroyer's median 17 px at 15 m/px, its bar 18.5; PLAN 7.22b):
      found in 7.35a's runs, the same with 7.35a's change stashed.
      Left by 7.35a, in the same commit: a strike row's tooltip says "Show both fleets" (a
      `ticker.toCarrierStrike` string); the headers of `seaRow1938` and `seaBattleSeen1938` (line
      39) say a carrier's battle has no row; 7.35a's PROGRESS entry has no `Perf:` line
      (`strikeTarget` sorts `wingBase` once per battle with no pair, per snapshot).
    - [ ] 7.35d The late sea battles per world-year on the critic's seeds (13 after year 1 against
      year 1's 36, `c9_headless_*.json`), measured, before and after.
- [ ] 7.36 Aircraft seen up close and the air map read (aircraft 6, needs 8): 0 sorties drawn at 25
  and 10 m/px in every probe (`c9_c_4483.json` `sorties`); the air map on day 10 of Germany–Poland
  hatches one German zone over all of Europe, every hover "held by Germany" from London to Kiev
  (`c9h_8217_air_hover.png`, seed 8217). The air war's fall after year 1 (air battles 925–4,302 in
  year 1, 47–147 later; sorties aloft 36–63, then 6–15; seed 8821 under 5 aloft in 18 of 29 years)
  follows the land war (ADR-519): PLAN 7.29, whose condition this run meets. AT: sorties drawn at 25
  and 10 m/px over a front in contact with wings tasked on it (counted, the critic's 4483 case);
  the air map's zones where each side's fighters hold the air, not one zone a continent (the
  critic's 8217 hover read at London, Paris, Warsaw, Kiev).
- [ ] 7.37 AI nuclear use believed, beyond the chains (AI nuclear use 7, needs 8): single bombs on
  small states (Nepal 1,656,090 dead and Afghanistan 3,328,000 on seed 2609, Sweden 1,050,000 on
  1129); Germany strikes one Canadian point twice 90 days apart for 5,620 then 439 (seed 4483,
  utility 0.98; `RESTRIKE_DAYS` = 7 off capitals, `src/sim/systems/nuclear.ts:943`); 3 of 14 worlds
  never see a burst while 4 to 6 nations hold 145 to 160 warheads (2251, 5527, 8821); Czechoslovakia
  armed in the editor with a bomber group at Prague and 10 warheads loses its 6 wings by day 10 and
  dies holding all 10, the editor saying only "10 warheads", no word in play when its means are lost
  (`c9_g2_*_CZS.json`; what destroyed the wings untraced). Left by 7.32a (ADR-528): seed 9901 on the
  critic's code, the Soviet Union strikes a lone Chinese division of 10,655 to 10,751 men three times
  at desperation 0.99 to 1.18, utilities 0.025 to 0.055, just over NUKE_FLOOR
  (`docs/evidence/7.32/chain-f0be88c-9901_rule.json`). Measured first: each case's decision
  (who, why, the utility's parts). AT: per case, the decision explained or changed by a rule with an
  ADR; the editor says a holder's means and the game says when the last is lost; the critic's
  14 seeds' bursts before and after; a unit test for each rule; the pin's entry.
- [ ] 7.29 The late land war's reach (from PLAN 7.26c3, ADR-519, 2026-10-18): after year 1 the land
  war runs at 1.4 formations in contact a day against year 1's 30 while 1 to 14 wars run
  (`docs/evidence/7.26/measure-g.md`), and the measures under 7.26c found the men who cannot get
  to the war: a partner's transports stand at a port with room while a colony or small member has
  none (`measure-c3.md` §5, ADR-516), and 40 % of an own-front planner's far men stand for want of
  a way (`measure-c1.md` §6: 16 % across the sea, Japan, Britain, France; 24 % behind closed
  ground or the sea on their landmass). Not an air-war task: the air AI tasks 0.83 of the wings
  with an enemy in range, late as in year 1. Taken after 7.27 and 7.28, and only if 7.27's
  measure or the critic's next run finds the late land war short (met 2026-10-19: run 9 finds the
  late air war still fallen, 95 % fewer air battles, which ADR-519 traces to the land war's contact;
  taken after 7.31 to 7.37, as 7.36's late part); its AT is the land war's
  (`landWar.ts`'s contact share of the big wars' front days, `armies.ts`), not the air's. A part
  each:
    - [ ] 7.29a A partner's transports sent to the nation's port (7.26c3b1): a transport group of
      a partner standing idle at a port, with net room for a nation's smallest free formation,
      sails to that nation's port and loads it, rather than the men marching to the partner's
      (ADR-516: a formation of the nation stood at the partner's port on 2 days in 16 seed-years;
      every other case is a march of a median 42–347 cells). Measured first from a checkpoint:
      the groups that would sail, the distance, the enemy sea on the way (ADR-517's groups sent
      home were sunk). AT: a unit test; `landWar.ts`'s `partner` columns and embarks on seeds 2843
      and 7919 × 8 years; the pin's entry.
    - [ ] 7.29b The lift by sea to a nation's own front (7.26c3c): a formation of an own-front
      planner that cannot reach its front by land is carried from a port of its nation's on its
      land to a port of its nation's on the front's land. Measured first: from a checkpoint, for
      each such formation, such a port with transports and such a port on the front's land. AT:
      the measure; the rule only if the share of far men standing for want of a way falls with
      it; a unit test; the pin's entry.
    - [ ] 7.29c A lone new division fed to a front and lost within weeks (from PLAN 7.27e,
      `docs/evidence/7.27/measure-e.md`): seed 732's Soviet Union, years 7.8–9.3, bought 11
      divisions in 18 months while its land army stood at one. Measured first, if 7.29 is taken
      up: where such a division goes from where it is raised and how long it stands before contact.
      AT: the measure; a rule only if it is one; a unit test and the pin's entry if it moves.
- [ ] 7.30 The operational AI's late calls (from PLAN 7.27d, `docs/evidence/7.27/measure-d.md` §1):
  seed 732 alone, pinned, × 50 years: the tick 1.43 ms in years 1–5 and 2.40 in years 26–50, of the
  rise 0.82 ms the operational AI's; its calls of 1 ms or more stay 600–1,460 a year but grow from
  about 2 ms a call in year 1 to 10–35 ms from year 8 (the longest 203 ms), and a 50-year sweep
  seed takes 15 min alone. Measured first from `.cache/727d/` checkpoints of this code: which
  planner and nation the long calls are, and which part of a call (A* to the front, the sectors,
  the marches from afar) grows with what (the front's length, the formations, the wars). Then the
  cause fixed if it is one, behaviour unchanged where the rule is not the cause. AT: the measure;
  the late years' operational AI per tick at most half of 7.27d's on seed 732, pinned; the pin
  unchanged, or its entry if a rule moves it. A part each:
    - [x] 7.30a The measure (`docs/evidence/7.30/measure-a.md`, `tools/diag/opCalls.ts`, `OP_PROBE`):
      the heavy years (31, 44) are refusals searched again after a flip anywhere; year 9's is
      `joinWide` walked by each plan of a coalition; the late years' broad cost is `pocketOf`.
    - [x] 7.30b A refusal kept by its corridor: `askMove`'s refusal of a search in a corridor of
      provinces holds while no cell of the corridor's provinces has gone from an open holder to
      a closed one or back and the provinces' `open` and `shut` are the same; other refusals as
      now. AT: a unit test (a flip outside the corridor keeps it, one inside undoes it); the pin
      unchanged; `opCalls.ts` from `.cache/730/s732-y30.bin` and `s732-y43.bin`: the asks refused
      again after a flip down by most. Done as ADR-523's rule: only a cell of the corridor gone
      from a closed holder to an open one undoes it (a cell lost to a closed one gives no way).
    - [x] 7.30c `joinWide` walked again by each plan of a coalition (years 9, 44): measured first
      (which flips undo it, and whether a flip's cell outside the provinces it walks can change
      it); the fix only if exact. AT: the measure; the pin unchanged. A part each:
        - [x] 7.30c1 The measure (`docs/evidence/7.30/measure-c.md`, `tools/diag/joinWalks.ts`,
          `JOIN_PROBE`): 808 of year 9's 884 walks and 383 of year 44's 392 are the same set's walk
          again after flips in mixed nodes that left the partition as it was; no walk repeats
          another plan's in its tick; a rule by the flipped cell's node class keeps nothing.
        - [x] 7.30c2 `joined` kept across a flip that cannot change it (measure-c §2.3): kept with
          the parts, each open cell of a mixed node at the walk with its class and whether its run
          met two groups; a flip in a node that is not mixed, the closing of a cell of a run that
          met two groups or of a cell opened since, or an opening whose open neighbours are of two
          classes with groups, undoes it; an opening merges its neighbours' classes. The cells
          opened or closed since the walk and the classes merged are kept on the parts with
          `flips` (`passageWith` judges only the flips after it), and dropped with `joined` when
          the log rolls over. The run data only on the parts that have asked `wideJoined`, the cap
          decided up front in the ADR. The bound is 811 of year 9's walks (the 3 after the log
          rolled changed nothing too), not measure-c's 808. Measured first
          by a check mode that walks again at each answer kept and compares partitions (the least
          node by class), one year from `.cache/730/s732-y8.bin` and `s732-y43.bin`: no difference,
          at every answer kept, not only the first after a walk, and the walks kept; the memory kept by the parts weighed (NODE_PARTS_KEPT sets). AT: a
          unit test (a closing in a run that met one group keeps it, in one that met two undoes
          it; an opening between two classes undoes it); `joinWalks.ts`'s walks down by most;
          seed 732's hashes after years 9 and 44 equal 7.27d's; the pin unchanged.
          Done as ADR-524's rule: a closing in a set that met two groups also holds when the cell
          touches no clear ground and its open neighbours are joined round it, and 'met two' is kept
          by root as the openings join the sets (by the walk's run alone, 884 -> 833 walks).
    - [x] 7.30d The AT: seed 732 × 50 years alone, pinned, `--profile`, against 7.27d's; if short
      of half, what is left by year and part (`opCalls.ts`), and `pocketOf` (§3.3 of measure-a)
      weighed as a rule with an ADR or the bar put to the user (ADR-486's way). Every year's hash
      against `p732.json`'s `yearly`, not the last alone (7.30b and 7.30c2 are exact by argument and
      by one-year checks; a year that differs is bisected from `.cache/730/`); and the process's
      memory by year, or said to be unmeasured (ADR-524's runs grow between walks).
      Done (`docs/evidence/7.30/measure-d.md`): every year's hash equal to 7.27d's; years 26–50
      0.753 ms (0.785 by load) against the bar 0.536; what is left is every year's cost, and the
      bar put to the user (ADR-525, BLOCKERS): 7.30 is not ticked until the user decides.
    - [x] 7.30e Year 47's 'long' orders and year 44's refusals for another cell (measure-d §3):
      France's orders ~32 cells off answered 'long' and searched in full, 9.4 ms each (2,537 asks,
      86 % of year 47's plan time), none kept; year 44's refusals kept for one cell alone (503 asks
      for another). Measured first from `.cache/730/s732-y43.bin` and `.cache/730d/s732-y46.bin`:
      whether the formations asked are on the move (no answer is kept for them), and whether a
      'long' can be held by its corridor as ADR-523 holds a refusal (a closing in the corridor can
      turn 'long' into 'refused', which changes the divert). The fix only if exact. Does not reach
      7.30's bar alone (about 0.65 on the band at most). AT: the measure; a unit test if a rule is
      made; `opCalls.ts` from those checkpoints: the asks down by most; the pin unchanged.
      Done as a measure, no rule (`docs/evidence/7.30/measure-e.md`): 63 % of year 47's 'long'
      asks are of formations on the move (no start to keep an answer by), the standing ones are
      first asks of new cells, and every repeat had flips near its ends; year 44's refusals the
      same (23 of 317 repeats keepable). Less of it is a rule (ADR-525 b's kind).
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
- [x] 7.4 Visual polish vs reference (borders, labels, UI frames, flags, fonts). […]
- [x] 7.6 Critic R7-B1 (report of 2026-10-17 on `19e2341`): AI nuclear use too rare to be seen, […]
- [x] 7.7 Critic R7-B2 (report of 2026-10-17 on `19e2341`): late-game stalls in the invasion AI. […]
- [x] 7.8 The air zone's holder is someone fighting there (aircraft 5, needs 8): on day 10 of […]
- [x] 7.9 Tanks read as armour at T3 (tanks 5, needs 8): at 10 m/px a tank is about 8 px, all one […]
- [x] 7.10 Ships look like ships, and a sea battle is seen (naval 5, needs 8): at 15 m/px ships are […]
- [x] 7.11 A fight at T3 reads as two sides with a line between them, and a struck city shows it […]
- [x] 7.12 The nuclear age in the statistics (stats 7): warheads, the nuclear dead and fallout in the […]
- [x] 7.13 The editor places warheads, fleets and wings, and asks before a chosen file starts […]
- [x] 7.14 Long wars with no land front end in a peace, and the late game has new causes of war […]
- [x] 7.15 The late world keeps moving (dynamics 6): seed 3371 moves 0.72 % of its land in years 26 […]
- [x] 7.16 God Mode and the UI's small things (God Mode 7, UI 7): a nuke's size (thermonuclear) in […]
- [x] 7.17 A smaller save (stability 7): 39.4 to 40.0 MB at year 12 to 27 […]
- [x] 7.18 AI nuclear use seen and credible (critic R8-B1, run 8 on `fd27e85`): 8 of 17 unaided 30-year […]
- [x] 7.19 A sea battle's ticker row lands on the fight (critic R8-B2, contradicts 7.10b): seed 5591, […]
- [x] 7.20 A hydrogen bomb is a hydrogen bomb (critic R8-B3, contradicts 7.16a): it kills 3 to 11 % more […]
- [x] 7.21 Infantry and the middle tier read at zoom (semantic zoom 7, needs 8): at 10 m/px infantry […]
- [x] 7.22 A sea battle seen firing, and fleets that hold their place (naval 6, needs 8): beyond […]
- [x] 7.23 A watched armour fight leaves burning hulls (tanks 7, needs 8): in 45 s at Speed x1 at […]
- [x] 7.24 Aircraft seen at every tier (aircraft 6, needs 8): at 900 m/px 0 to 1 sorties drawn, at […]
- [x] 7.25 AI nuclear use believed (AI nuclear use 6, needs 8): beyond 7.18's frequency, a world's […]
- [x] 7.26 The air war keeps flying after year 1 (aircraft 6, needs 8; the user's decision of […]
- [x] 7.27 No stasis on 8 of 10 unseen seeds (the sweep of 7.18g, `docs/sweeps/2026-10-18-sweep-718g.md`): […]
- [x] 7.28 A launch shot down and the gap after it (found 2026-10-18 by PLAN 7.26b, ADR-508): the […]
- [x] 7.31 Phantom sea battles (critic R9-B1, contradicts 7.19a): a battle in which no weapon can […]
- [x] 7.32 AI nuclear strikes on empty ground, in weekly chains, told by civilian dead alone (critic […]
- [x] 7.33 The history reads as events (stats and history 6, needs 7): beyond 7.31's phantom rows, […]
- [x] 7.34 Semantic zoom's seams (semantic zoom 7, needs 8): one wheel notch between 412 and 264 m/px […]

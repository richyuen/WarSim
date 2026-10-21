# WarSim — Phased Plan

Rules: each task is small and verifiable. `AT:` is the acceptance test that must
pass before ticking; it names a number and a stop (a figure, its bar, the run that reads it;
ADR-554). Work top-down, and split a task if it grows past one iteration, at most twice (7.35a,
7.35a1, no deeper); a dimension task has 20 commits (PROMPT "KEEPING ITERATIONS SHORT").
"Gate" = the full suite (tsc, eslint, vitest, build, parity) passes.
Balance sweeps were suspended while phases 2–6 were built (ADR-58); in Phase 7 they run again
(PROMPT "KEEPING ITERATIONS SHORT": tune on `sweep:quick`, one full sweep per task on unseen seeds).

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

Run 11's (report of 2026-10-21 on `dd3b730`, `critic/CRITIC_REPORT.md`; run 10's R10-B2 fixed,
R10-B1 and R10-B3 mostly; naval 6 → 7, aircraft 6 → 7): R11-B1 and R11-B2 are PLAN 7.49 and 7.50.
The dimensions under the bar: emergent 6 is 7.49's (ADR-583; 7.40 closed), naval 7 is 7.41 (moved
here, ADR-577), aircraft 7 is 7.51, AI nuclear use 7 beyond R11-B2 is 7.52. A task each, split
when taken up:

- [ ] 7.49 The land war after year 1 (R11-B1; carries emergent 6, needs 7, ADR-583): engaged land
  formations worldwide, mean of daily samples, 0.3–0.7 at years 10 and 20 on the critic's 24 worlds
  (of about 300 of nations at war), against 55–107 in year 1; the same on `bcbc99c` (1.1 and 0.3).
  Seed 6421 year 21: 9 wars, 0 in contact at 25 fortnightly samples while 309–7,179 cells change
  hands a fortnight; the Germany–Soviet war there has a 4,795-edge land border. Piles at war: the
  United Kingdom 85 of 160 divisions at London (7019, year 10), the Soviet Union 53 in one place
  (5309), Italy 46 of 55 (8011), Japan 33 of 35 (8167); 60 British divisions still at Wick for a
  month (1129). Seed 99's formations 917 in year 1, 610 by year 5. Evidence:
  `critic/c11_engaged_head.json`, `c11_engaged_c10.json`, `c11_engaged_year21.log`,
  `c11_stacks_y10.json`, `c11_wick_1129.json`, `c11_u_6421.json`. Measured first, from the critic's
  year-10 and year-20 saves (`critic/c11_seed*_y10.bin`): for the formations of nations at war, what
  holds each (the order it has or none, the AI step that passes it over), and how cells change hands
  with no contact. Then a rule a cause, each with an ADR. AT: engaged land formations per war
  running, mean of daily samples in years 2–20, at least a quarter of year 1's (7.39's bar for the
  sea), on 10 unseen seeds × 20 years; seed 6421's year 21 from the critic's save read (was 0 of 25
  samples), not a bar; a unit test per rule (red without); the pin's entry; `--profile`. Stop: two
  full re-measures flat, the bar is the user's (ADR-554).
  In parts (each read on the critic's 48 saves, `critic/c11_seed*_y10.bin` and `_y20.bin`, for its
  own figure, and for engaged land formations worldwide and per war, `tools/diag/warSides.ts`):
    - [x] 7.49a Measured (`docs/evidence/7.49/measure.md`; `tools/diag/landStates.ts`,
      `warSides.ts`, `armyGates.ts`, `noOnesCells.ts`, `stuckMarch.ts`): engaged per war 8.5 / 7.7 in
      year 1 (6421, 7019), 0.07 at year 10 and 0.14 at year 20 (worldwide 0.34, 0.57); of the land
      formations at war, engaged 6.7 % → 0.2 %, stranded on a landmass with no front of their
      nation 3 % → 21–28 %, walk-ins 62 % → 95 % of the cells taken; armed wars (5 a side near the
      front) 3–4 a world in year 1, 0.5 late. Four causes, b to e. No rule: the pin unchanged.
    - [x] 7.49b Strait crossings (measure §4.1): a land formation standing on a cell no nation
      controls (Gibraltar, Bab-el-Mandeb, the Bosporus, the Øresund, the Palk Strait: no province)
      is never ordered again (8011 year 10: 90 divisions at Gibraltar, no ask in 8 days). Traced
      first: why its plan asks nothing (its class, the reach, the march that stopped). AT: land
      formations of nations at war on such cells after 30 days of each of the 48 saves under 41
      (411 at the saves; `noOnesCells.ts --days 30` on HEAD first, the before); a unit test (red
      without); engaged worldwide and per war read; the ADR; the pin's entry; `--profile`.
      Traced (`docs/evidence/7.49/b.md`): two causes, a part each; the bar read after both.
      - [x] 7.49b1 The front over a strait: a march over a crossing waits before the far shore's
        enemy cell for a flip that no held cell next to it can make (the connectivity rule; 6421
        year 10: 162 at Gibraltar, Italy's shore behind them). The shores of a crossing count as
        neighbours for the fronts. AT: `noOnesCells.ts --days 30` on the 48 saves under 140 (398 on
        HEAD, about 280 of them on the march); a unit test (red without); engaged read; ADR-588; the pin.
      - [x] 7.49b2 Shut in on a crossing: a formation on a crossing whose shores are all closed to
        it (8011 year 10: 90 at Gibraltar between Nationalist Spain and #108, a pocket of one cell
        that reaches no sector) is never ordered and never sent home. It marches home as from a
        stranger's land. AT: the 48 saves' count after 30 days under 41 (7.49b's bar); a unit test
        (red without); engaged read; the ADR; the pin; `--profile`.
    - [ ] 7.49c The warship's saving with no army left (measure §4.2; ADR-575, ADR-579): at war
      with a naval enemy, a nation with an army under its peacetime share saves for a warship
      whatever its army (6421 year 20: the Soviet Union, one division, 2,407 gold, buys nothing
      while Germany walks in). The rule's case is narrower than ADR-557's floor, which ADR-575 set
      aside for Britain's 33 divisions (7.46b2): a few formations or none, or an enemy on its land
      with nothing to meet it. AT: on the 48 saves, nations at war with 3 formations or fewer
      stopped at the month start by the warship's saving (`armyGates.ts`, "ship(navalFoe)" with no
      order) 0 (10 and 11 at years 10 and 20); Britain's `spentArmy` months on 7019 and 3613 read
      again as 7.47's (4 / 12), no higher; a unit test on the case (red without); the ADR (amends
      ADR-575; ADR-578 a, the user's, kept: the floor against an enemy with no fleet; proposed as
      the user's if it reopens 578 a's reasoning); the pin's entry.
      Rule in (ADR-590, `docs/evidence/7.49/c.md`): the bar met (10 / 11 → 0 / 0); Britain's
      guard missed on the world's drift (HEAD 20 / 8 → 35 / 16, the rule's own kind 0 → 1 / 0):
      BLOCKERS, the user's (tick, close, or keep open).
    - [ ] 7.49d The sea powers' home armies (measure §4.3): of the land formations at war, those
      on a landmass with no front of their nation 21–28 % late against 3 % in year 1, most at a
      capital (7019 year 10: Britain 85 divisions at London, an overseas war, two transport
      groups; Japan at Tokyo, the United States at Washington). Measured first: per such nation,
      the invasion AI's gate each day (`planLanding`'s), its transports' room and how many it
      lands a month, and the decisions in this ground first (overseas muster, ADR-518). AT: the
      island share on the 48 saves after 60 days under 10 % (21.4 %, 27.7 % at the saves; a bar
      set, not measured: the measured-first step may show the transports cannot carry it, then
      the user's, ADR-554); a unit test (red without); engaged worldwide and per war read; the ADR; the
      pin's entry; `--profile`.
      Measured (`docs/evidence/7.49/d.md`, `tools/diag/islandArmies.ts`): 21.8 % / 29.6 % after 60
      days on HEAD; 62–66 % of them of nations fronted in each war overseas, which no rule ships; a
      perfect ferry leaves 13.2 % / 21.1 % (10.7 % / 17.6 % loading daily): the transports cannot
      carry it. BLOCKERS, the user's (ADR-591 proposed: the ferry with the bar under 20 % of the 48
      saves together, recommended; the ferry and transports bought, the bar kept; closed not done).
    - [ ] 7.49e The defenders' purse (measure §4.4): late, nations at war of income 150–500 hold
      4.5–4.8 formations, 91–98 of 124–127 stopped by the price (1,001) and RESERVE_MONTHS (3) of
      income kept back. Measured first: what such a nation raises in a year with the reserve at war
      cut while its army is under its peacetime share. AT: the land formations of the band at war
      after 180 days of each of the 48 saves at least 1.5 × those of HEAD's same run; a unit test
      (red without); the ADR; the pin's entry.
      Measured (`docs/evidence/7.49/e.md`, `tools/diag/purse.ts`): 564 / 564 on HEAD, bar 846; the
      reserve cut 616 / 603 (none kept), 596 / 590 (a month); no reserve and no slot limit 632 / 615:
      the price, one slot under 400 a month and the warship's saving bound it. BLOCKERS, the user's
      (ADR-592 proposed: the cut with the bar at 1.05 ×, recommended; the cut and the cadre division,
      the bar kept; closed not done).
    - [ ] 7.49f The landing's port (found at 7.49d, `docs/evidence/7.49/d.md` §4): `planLanding`
      sends formations to its port's land cell but loads only those within AT_PORT_CELLS of the
      port's water (`tryLanding` takes either); at 19 of the 579 ports the water is 4–11 cells off,
      so the army stands at the port and is never loaded (2081 year 20: Germany's port 602 on
      Britain, 56 island formations on `send` all 60 days, none aboard). AT: on the 48 saves, the
      nations on `send` 30 days or more of 60 with none boarded (`islandArmies.ts`) 10 → 0; formations
      boarded by the island nations in 60 days read (6 / 0 on HEAD); a unit test (red without:
      formations at a port whose water is beyond AT_PORT_CELLS go aboard); engaged read; the ADR;
      the pin's entry.
      Rule in (ADR-593, `docs/evidence/7.49/f.md`): the rule's own case 1 → 0 (2081's Germany boards
      at Glasgow); the AT's count 10 → 9, bar missed: 7.49d §4 mis-read the nine, which plan from
      ports with their water near (causes: PLAN 7.54, 7.55; two untraced). BLOCKERS, the user's (a
      tick, b close, c keep open).
- [ ] 7.54 The landing's send ends at the first refused march (found at 7.49f, emergent 6,
  `docs/evidence/7.49/f.md` §3): `sendToPort` stops at the first formation whose march to the port
  is refused (PLAN 7.7's bound, set against seed 3371's 0.7–1.1 s calls), and when the nearest is
  refused nobody is sent, every week: 4513 year 10 Germany at Kotor (8 of 8 refused), 7247 year 10
  and 8693 year 10 Germany at Annaba (143 and 29, all), 1129 year 20 Britain at Warri (the nearest
  3 refused, the fourth allowed). Traced first: why each march is refused (ADR-422's bound, a
  nation not in the war across the way, no way), and whether another port of the nation on that
  land has its army in reach. AT: on the 48 saves, the four cases board a formation within 60 days
  of their save; the nations on `send` 30+ of 60 days with none boarded (`islandArmies.ts`) 9 → 5 or
  fewer; no call of the invasion AI over 50 ms on those runs (`--profile` or the tool's timing; 7.7's
  guard); a unit test (red without); the ADR; the pin's entry.
  Traced (`docs/evidence/7.54/trace.json`, `tools/diag/sendTrace.ts`): every refusal is a neutral
  nation's ground between, none the long way; in 4513, 7247 and 8693 no candidate reaches the port
  (the transports in an exclave: Kotor, Annaba) and 5–145 reach other ports of the nation on that
  land, none with transports; in 1129 the fourth's march is open. Two causes, a part each; the AT
  read after both.
    - [x] 7.54a The send passes over a march refused on the port's land (ADR-594); the send ends
      at one on another land (7.7's case) or at the third refusal that was a search. AT: 1129's
      Britain sends its fourth; a unit test (red without); the pin's entry.
    - [ ] 7.54b The transports go to the army: when the nearest free formation's march to the
      transports' port is refused, the group sails to the nation's port on that land that the
      formation reaches, nearest it, with a way by sea; no formation is sent that day. AT: 7.54's.
      Rule in (ADR-595, `docs/evidence/7.54/b.md`; of the 4 nearest formations, the 4 ports nearest
      each): 7.54's count 9 → 7, bar 5: missed; the four cases 2 of 4 board (4513, 7247); 8693 and
      1129 have their transports by the army, its marches over desert (PLAN 7.56); longest call
      34.5 ms. BLOCKERS, the user's (a tick, b close, c keep open).
- [ ] 7.56 The landing's army marches over desert to its port (found at 7.54b, emergent 6,
  `docs/evidence/7.54/b.md` §2): sent to the port the transports reached, the formations of 8693
  year 10 Germany (to Antalya) and 1129 year 20 Britain (to Adana, before to Warri) cross desert at
  about 1.2 cells a day (DRY_SPEED): 65 to 240 days, so none boards in 60. Measured first: per case,
  the march days from the nearest free formations to each port of the nation on that land, and
  whether a port nearer by march time had a way by sea for the transports. AT: on the 48 saves, the
  two cases board a formation within 60 days of their save; a unit test (red without); the ADR; the
  pin's entry.
  Measured (`docs/evidence/7.56/a.md`, `tools/diag/portMarch.ts`): `sailToArmy`'s pick is quick in
  both (8693: 6.4 days' sail, 5 days' march to Antalya; 1129: 27 + 19 to Adana); the slow ones are on
  foot (desert's cost, not DRY_SPEED). 8693: at day 10, 183 of 190 on the operational AI's marches,
  the 7 free 58+ days from every port. 1129: two causes, a part each; 8693 read after both.
    - [x] 7.56a The operational AI re-takes the landing's march: a formation sent to the transports'
      port is re-ordered within days to a sector of an ally's front (PLAN 1.42b), which the invasion
      AI's "far from the front" does not count (1129: 335 on day 35, 18 steps off Adana; 445 on day
      40). It is no free formation of the plan while on the march to a port where its nation's
      transports stand. AT: 1129's 335 reaches Adana; a unit test (red without); ADR-596; the pin.
    - [x] 7.56b The landing's target over no sea: `planLanding` takes the enemy port nearest the
      transports by straight km (1129 at Adana: Baku, then Türkmenbaşy, on the Caspian), `tryLanding`
      refuses it (`NoSeaWay`) every invasion day, and the army at the port never boards. The target
      is the nearest the transports have a way by sea to. AT: 7.56's (1129 boards within 60 days);
      a unit test (red without); the ADR; the pin; `--profile`.
  Rules in (ADR-596, ADR-597; `docs/evidence/7.56/b.md`): 1129 boards (0 → 1); 8693 does not (no free
  formation within 58 days of a port, its near army on the operational AI's marches): the AT, 2 of 2,
  missed. 7.54's count 7 → 6. BLOCKERS, the user's (a tick, b close, c the landing takes from the
  operational AI's army, a design change).

- [ ] 7.60 A carrier's strike sinks a whole fleet at once (found at 7.57, naval 7,
  `docs/evidence/7.57/a.md` §4): the strike spreads its damage by hit points over a fleet's ships,
  mostly alike, so each takes the same wound and all reach a whole ship in the same strike: two or
  three strikes with nothing lost, then the fleet gone in one hour (594 of the 853 ships carriers
  sank on 4 seeds × 1 year; 8693's war 64 of 64), while gunfire sinks ship by ship. AT: on 8693's
  war (`carrierSink.ts 8693 JAP USA 20`) no carrier strike sinks more than half the ships of a fleet
  it strikes with none of them lost before (8 such strikes on HEAD), and the ships carriers sink there within 25 % of HEAD's 64; on
  the 4 seeds × 1 year, the ships sunk with their whole fleet in one strike under a quarter of the
  carriers' (594 of 853 on HEAD); a unit test (red without); the ADR; the pin's entry.
- [ ] 7.58 The editor's fleet laid up at the month start (found at 7.41b, editor 7,
  `docs/evidence/7.41/b.md`, ADR-602): a fleet the editor places at tick 0 is destroyed in that
  hour by the navy budget (`economic.ts`, step 1: "the fleets that stand … are laid up") when its
  nation's navy is over its share of income: 33 of the 102 living nations' battle squadrons gone
  after the first hour of seed 99. The player's placement vanishes with one history line. AT: of a
  battle squadron placed by the editor for each of the 102 living nations at tick 0 of seed 99, none
  laid up in the first month (33 on HEAD); a nation's own fleets still laid up as before (a unit
  test on each, the first red without); the ADR; the pin's entry.
- [ ] 7.59 Two placed navies out of sight never meet (found at 7.41c, editor 7, naval 7,
  `docs/evidence/7.41/c.md`, ADR-603): a fleet the editor placed holds its place (PLAN 7.22c) and
  sees about 29 km, so the critic's British pair, 107–120 km from Germany's placed squadrons, fights
  nothing in 30 days at war. Measured first: on the critic's scenario (`editorFleets.ts`), each
  placed fleet's nearest standing enemy warfleet each day and whether `awayOrder`'s battle test
  (its zone's enemy no more than its fleets there together) would take it. AT: on the critic's
  scenario both pairs of placed fleets are in a sea battle within 30 days (Britain's 0 on HEAD); a
  placed fleet at peace still holds its place; a unit test (red without); the ADR (amends 7.22c's
  "holds its place"); the pin's entry.
- [ ] 7.51 Aircraft (aircraft 7, needs 8, beyond 7.49): the late air war unchanged, 3,160 air
  battles in year 1 and 120 a world-year after on the same 14 seeds (122 on `bcbc99c`), sorties
  aloft after year 1 a mean of 8.1 (`critic/c11_cmp.json`, `c11_h_1307.json`); the critic reads it as
  R11-B1 seen from the air, so it is read after 7.49. The aircraft drawn at T3 are three white glyphs
  the size of a squad, not in a nation's colour (`critic/shots/c11c_7019_inf_0010m.png`). AT: at 10
  m/px on the critic's 7019 front every drawn aircraft's middle within 40 (summed RGB) of its
  nation's tint, and its span at least 4 × a man's figure there (a spec, red before); air battles in
  years 2–20 after 7.49, on its 10 unseen seeds, at least a tenth of year 1's, or a BLOCKERS entry
  with the measured cause, the user's to accept. Stop: two full re-measures flat, the bar is the
  user's (ADR-554).
- [ ] 7.52 AI nuclear use (aiNukes 7, needs 8, beyond R11-B2): the restraint line names a deterrent
  that is itself a puppet ("Soviet Union is deterred by Germany" while Germany's own line reads "is
  a puppet: the use of its warheads is its overlord's"; `critic/c11_t_1129.json`); bursts on the
  same 14 seeds 58 → 93, in 7 worlds (1129: 46 in 13 years, 11.7 M dead; 4877: 44); 29 of 93 kill
  over ten times more civilians than soldiers (a read, the user's, PLAN 7.38). The critic's design
  objection (cities with no soldiers struck: Berlin 334,000 civilians and 379 men by the
  editor-armed Poland, `c11_g2_9437_POL.json`; the weight of the dead too small) is the user's: an
  ADR proposed when taken up. AT: the deterrent named is the nation whose answer is feared (the
  overlord for a puppet), a unit test on the 1129 case (red before); bursts a world on 10 unseen
  seeds × 30 years read against run 11's 93 on 14, not a bar; the ADR. Stop: two full re-measures
  flat, the bar is the user's (ADR-554).

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
- [x] 7.30 The operational AI's late calls (from PLAN 7.27d, `docs/evidence/7.27/measure-d.md` §1): […]
- [x] 7.35 The war at sea seen and fought (naval 6, needs 8): beyond 7.31, the war at sea mostly […]
- [x] 7.36 Aircraft seen up close and the air map read (aircraft 6, needs 8): 0 sorties drawn at 25 […]
- [x] 7.37 AI nuclear use believed, beyond the chains (AI nuclear use 7, needs 8): single bombs on […]
- [x] 7.44 The yield chosen by the strike's utility, the dead's cost in it (from PLAN 7.38e, ADR-568's […]
- [x] 7.38 R10-B1: the AI's nuclear choice weighs the people a burst kills (AI nuclear use 7, needs […]
- [x] 7.45 The dead's cost at a high doctrine in extreme desperation (from PLAN 7.38e; AI nuclear use […]
- [x] 7.42 A block held back stands within contact reach of its enemy's block on every front (from […]
- [x] 7.29 The late land war's reach (from PLAN 7.26c3, ADR-519, 2026-10-18): after year 1 the land […]
- [x] 7.47 A navy rebuilt to a ship or two saves for the next at war with a naval enemy (from PLAN […]
- [x] 7.48 The critic's overrun France strikes before it loses its last bomber, with the chase (AI […]
- [x] 7.39 R10-B2: the war at sea goes on after year 1 (naval 6, needs 8; blocking). Year 1 a mean […]
- [x] 7.43 A cell taken goes to the side's nation whose own formations press it (from PLAN 7.37g): […]
- [x] 7.40 Emergent world dynamics (emergent 6, needs 7): stasis inside 30 years on the critic's […]
- [x] 7.46 A navy sunk in a decisive war at sea is built again (from PLAN 7.39b, ADR-573): with the […]
- [x] 7.53 Wars between peers (ADR-585, the user's decision, 2026-10-21: options 2 and 4 of the […]
- [x] 7.55 A transport group with room under a division's (found at 7.49f, emergent 6, […]
- [x] 7.50 The H-bomb at the floor on a city of a million, and the spot struck again (R11-B2): seed […]
- [x] 7.41 The war at sea seen (naval 7, needs 8, beyond 7.39; moved before 7.5 by ADR-577): the […]
- [x] 7.57 A carrier's strike sinks nothing (found at 7.41, naval 7, `docs/evidence/7.41/a.md` […]

# WarSim — Phased Plan

Rules: each task is small and verifiable. `AT:` is the acceptance test that must
pass before ticking; it names a number and a stop (a figure, its bar, the run that reads it;
ADR-554). Work top-down, and split a task if it grows past one iteration, at most twice (7.35a,
7.35a1, no deeper); a dimension task has 20 commits (PROMPT "KEEPING ITERATIONS SHORT").
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

Run 10's (report of 2026-10-19 on `bcbc99c`, `critic/CRITIC_REPORT.md`; run 9's two blockers
fixed; stats 7 and semantic zoom 8 reached the bar, emergent 7 → 6): R10-B1 and R10-B2 are PLAN
7.38 and 7.39, after 7.35's last parts; R10-B3 is 7.36 (its sight and the air map) and 7.29 (the
late air war's fall), which take run 10's cases. The dimensions under the bar: emergent 6 is 7.40,
naval 6 beyond R10-B2 is 7.41, aircraft 6 is 7.36, AI nuclear use 7 beyond R10-B1 is 7.37. A task
each, split when taken up:

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
  (who, why, the utility's parts). AT: per case, the decision changed by a rule with an ADR, or,
  where no rule changes it, a BLOCKERS entry with the measured cause, the user's to accept; the
  editor says a holder's means and the game says when the last is lost (each a spec, red without);
  a world where 4 or more nations hold 100 or more warheads and at war sees no burst in 30 years is
  not a miss (restraint is believable; the user's, 2026-10-20): for each such world on the critic's
  14 seeds, the measured reason (each holder's best strike's utility and what held it under
  NUKE_FLOOR: deterrence, no target, doctrine), and the game tells the player why a holder at war
  does not strike (a spec, red without); an unexplained case is a BLOCKERS entry. No rule may raise
  the bursts to meet this. A unit test for each rule; the pin's entry. Stop: two full re-measures
  flat, the bar is the user's (ADR-554).
  Run 10 (AI nuclear use 7; the toll is 7.38's): 3 of 14 worlds never see a burst while 4 to 6
  nations hold 145 to 164 warheads (seeds 4219, 5309, 6421, `critic/c10_summary.txt`);
  Czechoslovakia armed in the editor still dies holding its 10 warheads; Latvia (seed 1307, 75
  warheads) and Lithuania (8693) nuclear powers, unexplained. Each case's decision measured with the
  cases above, the same AT.
  Read on the way (ADR-561, `tools/diag/nukeCase.ts`): the critic's France (seed 7127, 10
  warheads) on the zones before ADR-560 with its bomber kept home: overrun and extreme from day 75,
  its bomber in reach, its best strike −0.009 (value 0.348, desperation 1.38) and under NUKE_FLOOR
  for the 25 days left; a case of "a holder at war does not strike", its reason to measure. A part
  each:
    - [x] 7.37a A holder of warheads keeps a strategic bomber group for them (ADR-561; one commit
      with 7.36b1, ADR-560, neither green alone): while a nation holds a warhead it may use and no
      missiles, its strategic bomber group of the lowest id gets no raid. AT: France on seed 7127
      on ADR-560's zones keeps its group and strikes before day 75 (was lost raiding Italy on day
      24, no strike in 100 days), `nukeOverrun1938` green; `nuclearReserve1938.test.ts` red
      without; the pin unchanged by it. Met: decisions on days 55 (shot down), 56, 68; the test
      red without; cc11ee7d is ADR-560's. 7.37's commits: 1 of 20.
    - [ ] 7.37b Czechoslovakia armed in the editor (seed 5309, `c10_g2_5309_CZS.json`): its wings
      lost by day 10, its 10 warheads held to its death, the editor saying only "10 warheads".
      A part each:
        - [x] 7.37b1 Its decision measured (`tools/diag/wingsLost.ts`, `nukeCase.ts … bomber`,
          `docs/evidence/7.37/`): fighters lost in air combat days 0.9–4.4; the strategic and
          tactical groups lost with Prague's airbase, its only one, on day 10.8; its strike under
          NUKE_FLOOR until then (utility −0.11 to −0.07, desperation 0.51 to 0.70), over it from
          day 19 with no means. AT: the measured cause in BLOCKERS and ADR-563 (proposed, the
          user's: a. restraint, then means lost, recommended; b. "use it or lose it"; c. a fallen
          capital counted in the desperation). Met.
        - [ ] 7.37b2 The editor says a holder's means: its strategic bomber groups with a base (and
          the nearest's base) or its missiles, beside "N warheads". AT: a spec on the editor,
          Czechoslovakia given 10 warheads and a strategic bomber group at Prague, the line names
          the group and Prague (red without: "has 10 warheads" alone).
        - [ ] 7.37b3 The game says when a holder's last means is lost: an event and a history row
          the day `canDeliver` turns false while it holds a warhead it may use, with the cause
          (its last airbase taken, its group shot down). AT: a unit test on seed 5309's case, the
          row on day 10–11 naming Prague's airbase (red without: no row); a spec of the row in the
          history; the pin unchanged.
- [ ] 7.38 R10-B1: the AI's nuclear choice weighs the people a burst kills (AI nuclear use 7, needs
  8; blocking). `nuclearUtility` has no term for the dead (`src/sim/systems/nuclear.ts:554-560`):
  Germany H-bombs Shanghai for 3,802,105 dead and 105 soldiers at utility 0.025, NUKE_FLOOR itself
  (seed 4877); the United States H-bombs Paris three times in six years (3,178,766, 1,404,231 and
  609,000 dead; utilities 0.026, 0.073, 0.026), then Rome (3,720,550 dead, 11,550 soldiers, 0.091;
  seed 8693); Tashkent and Banda Aceh struck 6 times each by Poland, Italy and Japan (seed 9437);
  25 of 58 bursts on the critic's 14 worlds kill over 10 times more civilians than soldiers
  (`critic/c10_summary.txt`, `c10_headless_{4877,8693,9437}.json` `nukeLog`, `c10_f_8693.json`).
  Measured first: each case's utility by its parts, the yield against the target, and the earlier
  strikes on the same city in the war. Then a rule with an ADR (the critic's "Fix": the dead a
  cost scaled by doctrine and outrage; the yield by the target; a city struck in the war not again
  without new value). No bar on the share of civilians among the dead (the user's, 2026-10-20: a
  city is a target in SPEC §6.4; the critic's 25 of 58 is read, not a bar). AT: on the critic's 14
  seeds × 30 years, no burst with a utility under 0.1 that kills a million (was Shanghai, Paris
  twice, Rome); no city struck twice in one war (was Paris 3, Tashkent 6, Banda Aceh 6); no
  hydrogen bomb where a fission bomb's blast covers the target's value (the formations or the city
  it was chosen for); then the same three bars on 10 unseen seeds × 30 years (the user's,
  2026-10-20: the rule is tuned on the critic's); each named case changed, or a BLOCKERS entry
  with its measured cause, the user's to accept; a unit test (red without); the pin's entry. Stop:
  two full re-measures flat, the bar is the user's (ADR-554).
- [ ] 7.39 R10-B2: the war at sea goes on after year 1 (naval 6, needs 8; blocking). Year 1 a mean
  of 38 sea battles a world; years 2 to 30 2.7 a world-year (1,090 in 406 world-years) while 50 to
  96 armed fleets stay afloat (115 at the start); at the year-10 and year-20 samples 18 of 28 have
  no war whose two sides both have a navy (`critic/c10_summary.txt`, `c10_fleets.json`,
  `c10_headless_*.json` `rows[].sea`). Taken after 7.35d3 (why the sunk navies are not built
  again) and on its "after" run. Measured first, on the critic's 14 seeds: the late wars' sides by
  navy, and for the naval powers' wars with each other or a coastal enemy, why their fleets stay
  in port (no target in reach, orders refused, held home). Then rules with ADRs (the critic's
  "Fix": blockades, raids, escort fights, landings). AT: sea battles per world-year in years 2–30
  at least a quarter of year 1's on the critic's 14 seeds (was 2.7 against 38), and of them at
  most 5 % sinking nothing (R9-B1's, now 3 %); then the same two bars on 10 unseen seeds × 30
  years. Read, not a bar (the user's, 2026-10-20: which nations go to war is diplomacy's): the
  year-10 and year-20 samples with no war whose two sides both have a navy (was 18 of 28). A unit
  test per rule; the pin's entry. Stop: two full re-measures flat, the bar is the user's (ADR-554).
- [ ] 7.40 Emergent world dynamics (emergent 6, needs 7): stasis inside 30 years on the critic's
  seeds: the same top five 22 years on seed 8693 and 21 on 7019, over the 20-year limit (4219 and
  3613: 18 and 17; run 9's worst 18; `critic/c10_summary.txt` `stasis`); late wars between
  nations that cannot fight at sea (7.39's); Latvia the second-largest nation on seed 1307 at year
  30 (14.2 % of the land, 75 warheads), unexplained. Not a regression (measured 2026-10-20, the top
  five by controlled land each year, 30 years): run 9's 14 seeds mean 11.4 years at `f0be88c` and at
  `bcbc99c`, none over 20; run 10's 14 seeds mean 11.1 at `0b0d5a2` (before 7.35's naval rules, one
  over 20: 5309, 23) and 12.4 at `bcbc99c` (two: 8693, 7019); a long top five is a seed's, about 1
  in 14 on either code. Measured first: on 8693 and 7019, what holds
  the top five (no war among them, the wars they win, their revolts), and Latvia's rise year by
  year. AT (the user's, 2026-10-20): `npm run sweep` on 10 unseen seeds × 50 years: no stasis on
  8 of 10 (7.27's bar: one unchanged world's sweeps end at 7 to 9, `tools/sweep/criteria.ts`) and
  ADR-54's limits, riser and faller green; the critic's 14 seeds × 30 years read for each rule, not
  a bar (a top five over 20 years is about 1 seed in 14 on any code, above); Latvia's rise changed
  by a rule with an ADR, or a BLOCKERS entry
  with its measured cause, the user's to accept; the pin's entry. Stop: two full re-measures flat,
  the bar is the user's (ADR-554).
- [ ] 7.41 The war at sea seen (naval 6, needs 8, beyond 7.39): Japan–USA (seed 8693) one battle
  stood with no row for 6 days (hours 330 to 480) and was never shown (`critic/c10_n_8693_JAP_USA
  .json`); Germany–UK on 3613 no sea battle between them in 24 days (`c10_e_3613.json`); at 20 m/px
  the enemy's ships are dark ellipses with no colour (`c10n_2081_sheet.png` panel 4; seen at
  7.35c's check:review: France's dark blue hulls read as the sea, `shipMarks1938`'s measure took
  them for it). Measured first: the 8693 battle's hours (why no row: its kind, its reach), the 3613
  fleets' orders. AT: every hour of a live sea battle on the critic's 8693 case has its row (was
  150 hours with none); Germany–UK on 3613 meets at sea within 24 days, or a BLOCKERS entry with the
  measured cause, the user's to accept; at 20 m/px the middle of every nation's hull at least 40
  (summed RGB) from the sea's colour there, every nation of the 1938 world counted (a spec, red on
  France's before). Stop: two full re-measures flat, the bar is the user's (ADR-554).
- [ ] 7.42 A block held back stands within contact reach of its enemy's block on every front (from
  PLAN 7.36b1, ADR-560; ADR-435's question): `deploy.test.ts`'s 60 days of Germany against Poland
  (seed 99), Nationalist Spain's block 749 held at DEPLOY_REACH stood 1.518 cells from the
  Republic's 798, deployed toward another (ticks 435–440; ADR-435's Manchukuo case 1.519). The
  test holds 1.5 on Germany's and Poland's contacts. AT: world-wide in those 60 days no held-back
  block over 1.5 cells from its enemy's block (red now, 1.518), a rule with an ADR and the pin's
  entry; or a BLOCKERS entry with the measured cause, the user's to accept.
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
  taken after 7.31 to 7.37, as 7.36's late part; run 10, R10-B3: air battles 2,537 in year 1 and
  122 a year after, the critic's 14 seeds, `critic/c10_summary.txt`); its AT is the land war's
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

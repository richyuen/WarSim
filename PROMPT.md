# MISSION

Build a browser-based grand-strategy *world war simulator* that matches or
beats "Ages of Conflict: World War Simulator" (AoC) in capability and feel
(https://jokupelle.itch.io/ages-of-conflict), starting with a standard 1938
world map, plus five major differentiators listed below. Write ALL code, art
and data yourself or from permissively licensed sources. Do not copy AoC's
assets or code.

You are running in an autonomous loop with max effort. Each iteration starts
with NO memory except the files in this repo. Files are your memory.

# PARITY PHILOSOPHY

Match or beat AoC's capabilities and feel, not its implementation. Choose the
best visual style and territory model yourself (per-pixel raster, vector
provinces, hybrid, or something else) as long as zoom reaches unit level with
real, increasing detail. Zooming into a fixed-resolution map until it is
blocky is a failure: detail must be generated or loaded as you zoom. Any
deliberate deviation from AoC must be logged in DECISIONS.md with a reason.
The feature list below is the minimum capability set, not a spec of how to
build it.

# REFERENCE MATERIAL

- Fetch and read: the itch.io page, the full devlog index and posts
  (https://jokupelle.itch.io/ages-of-conflict/devlog), the Steam page
  (https://store.steampowered.com/app/2186320/).
- `reference/` (user-provided, private; never commit, publish or ship it):
  - `screens/`: AoC screenshots. View them.
  - `video/`: gameplay clips. Extract frames with ffmpeg into
    `reference/frames/` at about 1 frame per 2 seconds, then view them.
  - `NOTES.md`: the user's own taste notes. Highest priority.
- Observe behaviour only. Never decompile, extract or copy AoC assets, code
  or data.
- If `reference/` is missing, say so in PROGRESS.md, rely on text sources,
  and mark every visual/feel claim as low confidence.

# BASELINE CAPABILITIES (must all be present and good)

World simulation:
- Mostly-AI-driven free-for-all: nations expand, declare war, make peace,
  ally, form and leave alliances/unions (with a unity value), create and
  release puppets (with autonomy), revolt and collapse.
- Cores/rightful owners, per-province or per-region revolts, revival of dead
  nations from their core territory (finite, with cooldown), revolt-
  suppression spending, optional winner-takes-all annexation on capital
  capture, occupation vs rightful-territory layers.
- Broke or exhausted nations sue for peace; "fight to the death" stance;
  per-nation aggression/traits and income bonus (-100..100).
- Economy (gold, income, expenses, production) on a regular economic tick.
- Terrain types (water, mountains, forest, grassland, tundra, desert, etc.)
  affecting movement and combat. Cities and capitals with names.
- Major Battles that pierce frontlines; combat-efficiency modes (dynamic,
  progressive, static, locked, random); temporary buffs/debuffs with timers.
- Long-run dynamism: with sensible settings, the world keeps changing for
  many simulated decades without freezing or a runaway hegemon.

Player tools:
- Observer-first play, plus God Mode: rename; force war/peace/alliance/
  collapse; spawn nation/revolt/battle; grant buffs; take control of a nation;
  disable AI globally or per nation.
- Scenario/map editor: paint tools (brush, bucket, line), undo/redo, target
  mask, cities, gold and core costs, alliances, puppets, annex, preset
  revolts, map import. Flag editor with presets. Scenarios save/load as
  shareable files.
- Map modes: political, terrain, wars, diplomacy, alliances, puppets, income,
  revolts.
- Statistics (incl. military size) and a history log (wars, battles, cities,
  revolts, nukes) that is filterable and exportable.
- Quality of life: pan/zoom with keyboard, drag and touch; speeds up to max
  plus pause (persisted); autosave; in-game screenshot key; UI-size setting;
  i18n from day one (English first); looping-map option; selectable map sizes
  up to very large; unit-size setting; good visual polish (flags, curved or
  well-placed nation names, readable borders).
- Seeded, deterministic runs and randomisation options.

Start scenario: standard 1938 world with historically plausible nations,
borders, alliances and starting forces. Design data so other maps/years can be
added without code changes.

# THE FIVE DIFFERENTIATORS (must all be excellent)

1. TRUE SEMANTIC ZOOM. Zooming adds information and detail, not just scale.
   Define at least 4 LOD tiers: strategic (nation colours, fronts), operational
   (army/fleet/air-wing markers with strength), tactical (formations broken
   into unit proxies, e.g. one sprite = N soldiers/tanks/ships/planes, with
   real positions, facing, movement, firing, casualties), close (individual
   units where feasible, otherwise the finest proxy). The same simulation state
   must drive every tier: no fake per-zoom animation that disagrees with the
   sim. Casualties seen at tactical zoom change the strength shown at strategic
   zoom. Smooth LOD transitions, no popping.
2. NAVAL WARFARE. Sea zones/lanes, ports and naval bases, fleets with ship
   classes (destroyers, cruisers, battleships, carriers, submarines,
   transports), fleet-vs-fleet battles, blockades, convoy/supply lines,
   amphibious invasions, sea control affecting supply and movement.
3. TANKS / ARMOR. Light/medium/heavy armour, production and upkeep, terrain and
   supply effects, combined-arms interaction with infantry, artillery and air.
4. AIRCRAFT. Fighters, bombers, ground attack, transports as needed; airbases,
   range, air superiority, interception, strategic bombing of industry and
   ports, air support for ground and naval battles, carrier air groups.
5. AI NUCLEAR WEAPONS. AI nations can research, build, stockpile and USE
   nuclear weapons. AI decisions consider capability, doctrine/aggression, war
   state, retaliation risk, alliances, target value and escalation. Include
   delivery (bombers/missiles), blast and fallout effects on territory and
   units, diplomatic and economic consequences, and mutual-destruction
   dynamics. God Mode can toggle nuclear availability globally and per nation.
   Nukes are a visible, dramatic, logged event.

# TECH CONSTRAINTS

- TypeScript + Vite, no server required, runs from static hosting.
- Rendering: WebGL or a WebGL-backed library (e.g. PixiJS), or highly
  optimised Canvas2D with instancing/culling. Choose after a quick prototype
  benchmark in phase 0.
- Simulation is a pure, deterministic, seeded engine separate from rendering,
  run in a Web Worker. Fixed timestep, adjustable speed, pause.
- Spatial indexing (quadtree/spatial hash) for unit queries.
- Performance budget: >= 60 fps at strategic zoom with 100+ nations; >= 30 fps
  at tactical zoom with 10,000+ visible unit proxies on a mid-range laptop.
- Save/load full state, bit-identical round trip.
- vitest for sim logic, Playwright for browser smoke and visual checks,
  ESLint + tsc strict. All must pass before any commit.

# FILES YOU MAINTAIN (create on iteration 1)

- `SPEC.md`: spec, architecture, data schemas, LOD design, combat model, AI
  design. Update when decisions change.
- `PLAN.md`: phased checklist of small verifiable tasks (`- [ ]` / `- [x]`),
  each with an acceptance test. Phases: 0 foundations and benchmarks;
  1 baseline parity; 2 semantic zoom; 3 armor; 4 naval; 5 air; 6 nuclear AI;
  7 balance, polish, soak tests.
- `PROGRESS.md`: append-only log: what you did, learned, gotchas.
- `BLOCKERS.md`: what you're stuck on and what you tried.
- `DECISIONS.md`: key technical and design decisions and why, including every
  deliberate deviation from AoC.
- `DATA_SOURCES.md`: every data/art/font source with its license.
- `docs/PARITY.md`: created on iteration 1 from the reference material.
  Table 1 "AoC parity rows" (scored), columns:
  `# | feature | AoC behaviour | our behaviour | status | evidence | notes`,
  where status is verified / partial / not started. Table 2 "Our additions"
  (unscored). Rows stay numbered and in order. Every row records whether AoC
  behaviour is known from TEXT or VISUAL reference. A row is verified only
  with a dated observation note of AoC's behaviour or intent AND our own
  test/screenshot whose evidence paths exist.
- `npm run parity`: script that computes the parity score, checks that every
  verified row's evidence paths exist, and fails if the PARITY.md header
  disagrees with the table. Never hand-edit the score.

# EVERY ITERATION

1. Read SPEC.md, PLAN.md, the tail of PROGRESS.md, BLOCKERS.md, and
   `critic/CRITIC_REPORT.md` if it exists.
2. Run the full test/lint/typecheck/build suite. If anything is broken,
   fixing it is this iteration's only task.
2a. Critic run. If `critic/CRITIC_REPORT.json` is missing, or a phase review
    has been ticked in PLAN.md since the report (`npm run critic:due` checks
    these two), or you believe the DONE CONDITION is otherwise met, then
    running the critic is this iteration's only task: commit any pending
    work first, spawn the `critic` subagent (Agent tool, subagent_type
    `critic`) with no hints about what to look at, wait for it to finish,
    and check that `critic/CRITIC_REPORT.json` now names HEAD. Append one
    line to PROGRESS.md with the scores and blocking count. Then add a
    PLAN.md task for every blocking issue that has none, placed before the
    next feature task unless a later phase already covers it (a finding that
    step 2b defers gets a line under PLAN 1.42 instead): no finding may
    depend on the report staying recent. Then end the iteration. Never act
    as the critic yourself.
    One run per phase (changed 2026-10-03, ADR-59, the user's decision). The
    critic no longer returns every 5 commits, and the "Critic " prefix on
    commit subjects no longer counts for anything. The user may ask for a
    run at any time.
2b. If `critic/CRITIC_REPORT.json` exists and its `commit` is not older than
    the last 10 commits, fix its blocking issues first, highest severity
    first. Critic findings override your own priorities. You may dispute a
    finding only by writing evidence in DECISIONS.md. Never edit anything in
    `critic/`.
    Deferred to PLAN Phase 7 (added 2026-10-03, ADR-58, the user's decision):
    findings about long-run balance and dynamics (a static world, the
    leader's share of the land, risers and fallers, how many nations rise or
    die). The balance will move with every feature of phases 2-6, so tuning
    it now is wasted work. Log such a finding once per report in PROGRESS.md,
    do not dispute it, do not fix it, and take the next blocking issue. A
    crash, a desync or a mechanism that plainly does not work is not balance:
    fix it.
3. Pick the first unchecked PLAN.md task (or split it if too large).
4. Implement it fully. No stubs, no TODO placeholders, no faked features.
5. Verify for real: run tests; start the dev server; use Playwright to load
   the game, exercise the feature, take screenshots at multiple zoom levels,
   and LOOK at them (view the image files). Compare against `reference/`
   frames where relevant. Fix visible problems.
6. Check performance against the budget when touching rendering or sim.
7. Commit with a clear message; tick the task; append to PROGRESS.md; run
   `npm run parity` and update PARITY.md rows you touched.
8. If a task fails 3 attempts, write it to BLOCKERS.md with details and move
   on.
9. Every ~5 numbered PLAN tasks (2.7, 2.8, 2.9, ...) do a review pass:
   refactor debt, delete dead code, re-read SPEC.md for drift, add missing
   tests.
   Counted by numbered tasks, not by the parts a task is split into
   (clarified 2026-10-04, ADR-74, the user's decision): 2.8a, 2.8b and
   2.8c1 are one task, counted once.

# KEEPING ITERATIONS SHORT

Added 2026-10-03 after an iteration that took three hours, most of it waiting
on simulation runs (DECISIONS ADR-48).

- Balance sweeps are suspended until phases 2-6 are complete (added
  2026-10-03, ADR-58, the user's decision). No `npm run sweep` and no
  `npm run sweep:quick` after a rule change: the balance will change with
  every feature, so a verdict on it now is wasted. What stays:
  - the 10-year tests in the gate (`tests/sweep/`): the pinned hash, save and
    load, allies never at war, no bankruptcy in peace. They test correctness,
    not balance;
  - one `npm run sweep:quick` at each phase review (PLAN 2.11, 3.7, 4.8, 5.8,
    6.9), as a smoke test. Report its five limits in PROGRESS.md. A limit
    that fails is logged in BLOCKERS.md and waits for Phase 7, unless its
    cause is a defect of the phase's feature (a crash, a desync, a mechanism
    that does not work). Do not tune constants in answer to it.
  The bullets below about tuning and the full sweep apply again from PLAN 6.8
  (the sweep with nukes on) and in Phase 7.
- One cause per commit. When a task or a critic finding has several causes,
  split it in PLAN.md and fix, gate and commit them one at a time.
- Tune on small runs. `npm run sweep:quick` (10 seeds × 20 years, report in
  `.cache/`; seeds run side by side, and three seeds cannot tell a rule from
  noise) while changing rules or constants. It is judged by the limits only
  and reports the riser and faller numbers (ADR-54). Do not run the full
  sweep to find out whether a mechanism works: run it once the quick sweep
  shows the mechanism working with room to spare. The full sweep
  (`npm run sweep -- --first <unseen> --tag <name>`) runs once per task, on
  the final code, on seeds no tuning has seen.
- Gate before the final sweep, never after. A gate failure changes the code,
  and a sweep of code that then changes is wasted.
- Diagnose from checkpoints. `npm run sim -- --save` / `--load` and
  `npm run diag -- --load` start from a saved year instead of 1938. Save a
  checkpoint once and reuse it for every question about later years. A
  checkpoint is only valid for the code that wrote it: after changing sim
  rules, rewrite it.
- `npm run check` sizes the gate to what changed since HEAD: only
  `npm run parity` for a commit of documents alone (Markdown, `docs/`), and
  no 10-year sweep tests when nothing they depend on changed. On a clean
  tree that the gate has already passed it runs nothing, so step 2 of an
  iteration that starts on a gated commit costs seconds (ADR-55).
  `npm run check:full` always runs everything: use it for the DONE CONDITION
  and whenever the working tree was not gated commit by commit (after a pull
  or a rebase).
- No hand-run hashes. `tests/sweep/baselineHash.test.ts` pins the state hash
  of seed 99 after one year. A change meant to leave behaviour alone is
  proved by that test in the gate. A change of rules moves the pin in the
  same commit, with the old and new hash and the reason in DECISIONS.md
  (ADR-55).
- Simulation speed is iteration speed. A change that makes the tick slower
  is logged with numbers in PROGRESS.md, and a tick over budget is fixed
  before the next task that needs a full sweep.

# RULES

- Correctness over speed; never mark a task done unless verified.
- Never weaken or delete a test to make it pass.
- Keep the game always runnable on main.
- Data-driven design (JSON for units, nations, maps, tech).
- Use a real 1938 border dataset if you can find a permissively licensed one
  (check the license); otherwise build the map procedurally from public-
  domain geography and hand-assign 1938 ownership. Record sources in
  DATA_SOURCES.md.
- Never commit `reference/` or anything derived from AoC assets.
- Ask no questions; make the best decision and record it in DECISIONS.md.

# DONE CONDITION

Only when ALL are true:
- `critic/CRITIC_REPORT.json` exists for the current HEAD commit, every parity
  dimension scores >= 7, every differentiator dimension scores >= 8, and it
  lists zero blocking issues;
- every PLAN.md item is checked or has a documented blocker;
- tests, lint, typecheck, build and `npm run parity` pass;
- a headless 30-minute soak run of the 1938 scenario completes without crashes
  or desyncs, and a seeded multi-decade sweep over 10+ seeds shows borders
  still moving at the end and no hegemon;
- a scripted Playwright run demonstrates seamless zoom from world view to
  unit/proxy level, a naval battle, a tank battle, an air battle, and an AI
  nuclear strike;
- performance budgets are met.

Then output exactly:
<promise>WORLD_WAR_SIM_COMPLETE</promise>
Do not output that string until it is fully true.
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

Run 12's (report of 2026-10-22 on `896ff779`, `critic/CRITIC_REPORT.md`; R11-B2 closed; map visuals
and performance 7 → 6): R12-B1 and R12-B2 are PLAN 7.79 and 7.80; the dimensions under the bar, beyond
them, are 7.81–7.86. A task each, split when taken up:

Found by `npm run check:review` before critic run 13 (2026-10-24; ADR-675, ADR-676): two browser tests
green here at `896ff779` and red at `9ffb0274` on what they claim, taken off `tools/gate/knownRed.json`
(BLOCKERS). The critic waits on them (PROMPT step 2a):

Run 13's (report of 2026-10-24 on `0c80db1e`, `critic/CRITIC_REPORT.md`; R12-B2 no longer blocking by
ADR-639; map visuals 6 → 7, performance 6 → 5): R13-B1 is PLAN 7.104; the dimensions under the bar,
beyond it, are 7.105–7.109. A task each, split when taken up. Unseen seeds: 901 on, ten a task, none
reused:

Run 14's (report of 2026-10-25 on `311988d7`, `critic/CRITIC_REPORT.md`; R13-B1 improved, not fixed;
aiNukes 7 → 8): R14-B1 and R14-B2 are PLAN 7.116 and 7.117; the dimensions under the bar, beyond them,
are 7.118–7.121. A task each, split when taken up. Unseen seeds: 991 on, ten a task, none reused:

Found by `npm run check:review` before critic run 15 (2026-10-26; ADR-711, ADR-712):

- [ ] 7.127 The critic's Poland: a first burst off Germany on fewer than `MASSED_MEN`. `nukePoland1938`'s set-up (10
  warheads and a strategic bomber group at Warsaw, Germany's war on Poland) on seeds 4001–4020: the first burst falls
  off Germany on fewer than 50,000 men (ADR-651 a's bar) on 4 (4009, 4010, 4012, 4016; nation 15 or 10, 17–21k men),
  2 before ADR-711 (4009, 4020) (`tools/diag/nukePolandGates.ts … summary`). AT: on 4001–4020, such bursts 0 of 20;
  Poland's strikes before its bomber is gone not fewer than 15; `nukePoland1938` green; the gate green.
  Missed (2026-10-26, `docs/evidence/7.127/measure.md`): the half theatre floor 4 → 1 and civilian-heavy bursts 3 → 10
  in ordinary worlds; not committed; waits on the user (ADR-715, BLOCKERS). Seeds 1101–1110 spent; the next tasks 1111 on.

Run 15's (report of 2026-10-26 on `7739a78f`, `critic/CRITIC_REPORT.md`; R14-B1's hollow divisions fixed, 72.4 → 0.4 a
world; performance 5 → 6): R15-B1 and R15-B2 are PLAN 7.128 and 7.129; the dimensions under the bar, beyond them, are
7.130–7.133 (naval's panel is 7.126). A task each, split when taken up. Unseen seeds: 1101 on, ten a task, none reused,
none a seed the critic has run (`critic/c*_seed*`):

- [ ] 7.128 R15-B1: the land war got thinner. Same 48 seeds `311988d` → HEAD: engaged land formations a day in year 1
  45.05 → 40.01 (lower on 35 of 48), years 2–30 5.11 → 4.35, per war 0.732 → 0.636; checkpoints (y10/y20, 7 days) with
  nobody in contact 4 → 17 of 96; 7019's year 20, 422 land formations at war, 0 in contact on 6 of 7 samples
  (`critic/c15_cmp_all.txt`, `c15_cmp_checkpoints.json`, `c15_y2_7019_y20.json`). AT: on 10 unseen seeds × 30 years,
  `311988d`'s rules and HEAD's read on the same seeds: engaged a day in year 1 at least 0.98 × `311988d`'s; years 2–30
  at least 1.15 × HEAD's; checkpoints with nobody in contact not above `311988d`'s count; land formations under 500 men
  at year 20 at most 2 a world; a unit test, red without; the gate green.
  - [ ] 7.128a Year 1 back: ADR-701's fold is the whole fall. Year 1 on the critic's 8 seeds that fell most
    (`tools/diag/contactYears.ts`, counted as the critic counts): `311988d` (2 read: 61.40, 56.64, the critic's 61.08,
    56.21) → the fold's commit `1cbc0bf3` 39.74 a day; ADR-703's wait and ADR-711's gap move nothing; HEAD 37.33. In
    year 1 before the fold 45–50 remnants a day stood, 16–18 % of them in contact (the army 7 %), and the army's
    others were in contact more too (`tools/diag/hollowContact.ts`, 3359: 53.5 of 824 → 42.4 of 856). AT: on seeds
    1111–1120 × 30 years, `311988d`'s rules and the change's read on the same seeds: engaged a day in year 1 at least
    0.98 × `311988d`'s; land formations under 500 men at year 20 at most 2 a world; years 2–30 not below HEAD's; a
    unit test, red without; the gate green.
  - [ ] 7.128b The late contact: years 2–30 at least 1.15 × HEAD's and checkpoints with nobody in contact not above
    `311988d`'s count, on seeds 1121–1130, against 7.128a's rules.
- [ ] 7.129 R15-B2: the 5.5 ms budget (ADR-709) fails late. Pinned and alone, 6421's year 28 7.88–7.98 ms (operational
  AI 5.3–5.4), years 29 and 30 7.14 and 5.89; 1129's year 21 6.39–6.54 ms, year 20 5.77 (`critic/c15_perf_*`; saves
  `critic/c15_seed6421_y27.bin`, `c15_seed1129_y20.bin`). AT: pinned and alone, 6421's year 28 and 1129's year 21 at
  most 5.5 ms a tick, from those saves; the worst year of 10 unseen seeds × 30 years at most 5.5 ms; the gate green.
- [ ] 7.130 Emergent dynamics 6: the top five stand still. Beyond 7.128's contact: the longest run of years with the same
  top five nations 19 in 56 worlds × 30 years (`critic/scripts/c15_cmp.py`, `stasisMax`; 21 on run 14); the least
  land moved in a world's last five years 25.2 %. AT: on 10 unseen seeds × 30 years, read as the critic's script
  reads it against HEAD on the same seeds: the longest stasis at most 12 years, the mean not above HEAD's; the least
  land moved in the last five years not below 20 %; a unit test, red without; the gate green.
- [ ] 7.131 Performance 6: a late year at Max in the page. Beyond 7.129's tick: 6421's year 28 is 81.5 s at Max in the
  page (`critic/c15_l_6421.json`), past ADR-698's 45–60 s a late year. AT: in the page from `critic/c15_seed6421_y27.bin`,
  year 28 at Max at most 60 s, alone, two reads; no stall over 500 ms; 4877's late years at Max not above run 15's 112 s;
  the gate green.
- [ ] 7.132 Naval 7: a sea battle seen close. A sea battle at 15–150 m/px is a few small hulls far apart (3613's
  Spanish cruiser squadron against a British transport group of 300, `critic/shots/c15e_3613_sea_01_row_live_1.png`);
  the late sea war is a fifth of year 1's (ADR-706 a: no rule for it). AT: on that case and 4 more sea battles from the
  history's rows, the row's press ends with ship elements of both sides on the screen, the nearest enemy hulls within
  a third of the view's width, each hull at least 12 px long; `seaBattleSeen1938` and `seaRow1938` green; the gate green.
- [ ] 7.133 Aircraft 7: an empty sky late. At 6421's year 20, 2 sorties aloft in the whole world on the sampled hour;
  late air battles 181 a world-year, unchanged (ADR-707 a: no rule for reach) (`critic/c15_u_6421.json`,
  `critic/shots/c15u_6421_f0_0250m.png`). AT: on 10 unseen seeds × 20 years against HEAD on the same seeds, mean sorties
  aloft a world-hour in years 2–20 at least 1.5 × HEAD's, year 1 not below 0.9 ×; a unit test, red without; the gate
  green.

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
- [x] 7.61 A land-based wing's strike sinks a whole fleet at once (found at 7.60, naval 7, […]
- [x] 7.58 The editor's fleet laid up at the month start (found at 7.41b, editor 7, […]
- [x] 7.59 Two placed navies out of sight never meet (found at 7.41c, editor 7, naval 7, […]
- [x] 7.52 AI nuclear use (aiNukes 7, needs 8, beyond R11-B2): the restraint line names a deterrent […]
- [x] 7.54 The landing's send ends at the first refused march (found at 7.49f, emergent 6, […]
- [x] 7.56 The landing's army marches over desert to its port (found at 7.54b, emergent 6, […]
- [x] 7.60 A carrier's strike sinks a whole fleet at once (found at 7.57, naval 7, […]
- [x] 7.49 The land war after year 1 (R11-B1; carries emergent 6, needs 7, ADR-583): engaged land […]
- [x] 7.65 The reserve cut (7.49e1, moved at 7.49's budget; ADR-592 a, the user's; carries emergent 6 […]
- [x] 7.63 The ferry's port nearest the front (found at 7.49d1, `docs/evidence/7.49/d1.md` §3; carries […]
- [x] 7.64 The ferry for a nation fronted through an ally alone (found at 7.49d2, […]
- [x] 7.66 Transports bought for a nation fronted through an ally alone (found at 7.64, […]
- [x] 7.68 A capital moves to the land its nation holds most of (the user's, 2026-10-21; found at […]
- [x] 7.67 New divisions of a nation fronted through an ally alone raised toward that front (the […]
- [x] 7.69 The AI's landing on a coast with no port: an enemy capital (the user's, 2026-10-21; found […]
- [x] 7.71 The landing takes a portless enemy capital before a nearer port (found at 7.69, […]
- [x] 7.72 The landing and the ferry board as a group (found at 7.70b, ADR-623): the first […]
- [x] 7.73 The Normandy without a loss of fight (7.70b's bar, ADR-623): with the rule, engaged land […]
- [x] 7.70 The AI's invasions open new fronts (the user's, 2026-10-21; a Normandy: a landing on […]
- [x] 7.62 An empty capital is no first-strike target (ADR-611 b, the user's decision, 2026-10-21; […]
- [x] 7.76 A capital taken counts in the desperation (found at 7.75; the user's decision, 2026-10-22; […]
- [x] 7.75 Supply over the beach on any land (ADR-622's scope b, the user's decision, 2026-10-22; […]
- [x] 7.77 The late land war under the air war (found at 7.51b; emergent 6, aircraft 7; R11-B1 as […]
- [x] 7.51 Aircraft (aircraft 7, needs 8, beyond 7.49): the late air war unchanged, 3,160 air […]
- [x] 7.74 An overrun holder's first strike is on the enemy overrunning it (found at 7.62; PLAN […]
- [x] 7.78 On a first strike a place's output counts only with an army in the blast (found at 7.74; […]
- [x] 7.81 Map visuals (mapVisuals 6, needs 7, beyond R12-B2): the map tooltip is stale, sixth run […]
- [x] 7.87 The far march to a threatened sector, over a season (found at 7.79d; R12-B1; waits on the […]
- [x] 7.88 The ferry's transport groups (found at 7.79c; R12-B1): `transportsAtPort` gives the ferry one group a […]
- [x] 7.89 The invasion turn held by one formation aboard (found at 7.88b; R12-B1): `invasionAi` skips a […]
- [x] 7.80 The late map shreds (R12-B2; carries map visuals 6): pieces of 2–400 cells of one holder at […]
- [x] 7.92 A far army of the enemy side weighed as the one overrunning the striker (found at 7.91, […]
- [x] 7.83 Performance (performance 6, needs 7): seed 99's mean tick 1.785–1.790 ms pinned on HEAD […]
- [x] 7.91 Blocks stacked on one enemy out of its view (found at 7.90g, `docs/evidence/7.90/g.md` "The gate"): […]
- [x] 7.90 The ferry's lift short of the army (found at 7.89; R12-B1): on critic run 12's 1129 year 10 the […]
- [x] 7.86 AI nuclear use (aiNukes 7, needs 8, beyond R11-B2): bursts on the same 24 seeds 188 → 497 […]
- [x] 7.96 The nuclear rate in the busier war (found at 7.86; aiNukes 7, needs 8; ADR-657 b, the user's […]
- [x] 7.79 The land war after year 1, again (R12-B1; R11-B1 not fixed by 7.49): on the critic's same 48 […]
- [x] 7.97 The American piles (found at 7.79's AT; R12-B1; ADR-661 a, as ADR-653's (b)): on unseen seeds […]
- [x] 7.98 The lift's size (found at 7.97's AT; R12-B1; ADR-662 a): with 7.97's rule in, 12 American […]
- [x] 7.94 The operational AI's cost on the busier world (found at 7.83's AT; performance 6, needs 7; […]
- [x] 7.84 Naval (naval 7, needs 8): a carrier strike's row, clicked, shows two US destroyer counters and […]
- [x] 7.95 A warship's saving in a land war (found at 7.84d; naval 7, needs 8; ADR-656 b, the user's […]
- [x] 7.85 Aircraft (aircraft 7, needs 8): air battles after year 1 153 a world-year against 2,853 in year 1 […]
- [x] 7.82 Emergent dynamics (emergent 6, needs 7, beyond R12-B1 and R12-B2): the longest stasis 21 […]
- [x] 7.99 An air war beyond the land war (found at 7.85; aircraft 7, needs 8; ADR-668 b, 7.51b's (c)): […]
- [x] 7.100 Fronts, not walk-ins (found at 7.82; emergent 6, needs 7; ADR-671 b): on 851–860 × 30 years […]
- [x] 7.101 A defence that rises against a raid (found at 7.99; aircraft 7, needs 8; ADR-672 b): after year 1 […]
- [x] 7.102 A block no further than 20 km from the block it faces (`formationFight1938`, seed 4242, Germany on […]
- [x] 7.103 A tank's flash at its own muzzle (`tankBattle1938`, seed 1, stop 5): the flash of element 1112 […]
- [x] 7.104 The land war after year 1, a third time (R13-B1; R12-B1 improved by 7.79, not fixed; carries […]
- [x] 7.105 Performance (performance 5, needs 7): the late game at Max 46.3, 59.4, 59.4 s a game year […]
- [x] 7.106 Emergent dynamics (emergent 6, needs 7, beyond R13-B1): on the same 32 seeds the churn grew […]
- [x] 7.107 Naval (naval 7, needs 8): the late sea war is a sixth of year 1's (57.6 battles in year 1, […]
- [x] 7.108 Aircraft (aircraft 7, needs 8): air battles after year 1 155 → 121 a world-year on the same […]
- [x] 7.113 The air force at war late (found at 7.108b; aircraft 7, needs 8; ADR-685 b, the user's decision): the […]
- [x] 7.109 AI nuclear use (aiNukes 7, needs 8): of two AI strikes a day apart (1129 year 15: the UK on a […]
- [x] 7.110 The army at war late (found at 7.104; R13-B1; ADR-679 a, the user's decision): by year 20 the land army of nations at war a war is a third of year 1's (4877: 529 → 196 […]
- [x] 7.115 The operational AI spreads a larger army over its front (found at 7.110b; R13-B1; ADR-692 b, the user's […]
- [x] 7.111 The late tick's exact remainder (found at 7.105; performance 5; ADR-680 b, the user's decision): `snapTarget`'s kept answers by landmass and then cell (its time is the lookup of one […]
- [x] 7.112 The pockets as a rule (found at 7.105; performance 5; ADR-680 b, the user's decision): `pocketOf` answers each start by its own walk (no answer taken from another walk's marks), and […]
- [x] 7.114 The answer weighed by its own toll (found at 7.109b; aiNukes 7; ADR-691 a, the user's decision; on 7.109b's […]
- [x] 7.122 A fold that keeps the counter (from 7.116a, ADR-701; dropped by ADR-701 a, the user's decision): […]
- [x] 7.116 The land war after year 1, a fourth time (closed not done, ADR-702 d, the user's decision; R14-B1; R13-B1 improved by 7.110 and ADR-693 b, […]
- [x] 7.123 Contact that costs the army (from 7.116b, ADR-702; dropped by ADR-702 d, the user's decision): on […]
- [x] 7.117 The late tick over its budget (closed not done, ADR-703 a, the user's decision; R14-B2; carries performance 5): ADR-698's budget is at most […]
- [x] 7.118 Emergent dynamics (closed not done, ADR-704 a, the user's decision; emergent 6, needs 7, beyond R14-B1): on run 13's 40 seeds the land […]
- [x] 7.119 Performance (done, ADR-705 a, the user's decision; performance 5, needs 7, beyond R14-B2's mean tick): the stalls the player […]
- [x] 7.120 Naval (closed not done, ADR-706 a, the user's decision; naval 7, needs 8): the late sea war is about a fifth of year 1's battles: on the same […]
- [x] 7.121 Aircraft (closed not done, ADR-707 a, the user's decision; aircraft 7, needs 8): on the same 40 seeds air battles after year 1 123 → 183 a […]
- [x] 7.124 The orders' refused searches (done under ADR-709's 5.5 ms, ADR-708 a, the user's decision; from 7.117, ADR-703 a, the user's decision): on the […]
- [x] 7.125 A load's first ticks (from 7.119, ADR-705 a, the user's decision): from 8167's year-18 save, the first tick […]
- [x] 7.126 A fleet in a sea battle: its panel's way to the battle. The panel of a fleet in contact reads "In contact" […]

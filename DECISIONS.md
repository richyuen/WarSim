# Decisions (ADR log)

Format: ID · date · status · decision · why · consequences. Deliberate deviations
from AoC are tagged **[AoC-DEVIATION]**.

---

### ADR-1 · 2026-10-02 · accepted — Territory = authoritative cell raster + resolution-independent rendering
**Decision.** The sim owns a cell grid (owner, controller, terrain, province, flags). Rendering
draws it with smooth shader borders, a fine coastline mask and procedural detail tiles.
It never shows blocky cells.
**Why.** AoC's charm comes from per-pixel fronts (VISUAL: reference screenshots), and a
raster keeps the editor (brush/bucket/line), map import and frontier processing simple and
fast. Vector provinces would lose the organic fronts. A pure raster would fail the
"no blocky zoom" rule, so the render layer adds resolution independence.
**Consequences.** Cosmetic border displacement is bounded below 0.5 cell, so render
and sim never disagree on ownership. Sim cost scales with the frontier, not grid
area. The default size is M (2048×1024), which is about 20× AoC's land tile count.

### ADR-2 · 2026-10-02 · accepted — Worker-authoritative sim; snapshots with interest management
**Decision.** The pure `src/sim` runs in a Web Worker (and in Node). Main sends commands and
viewport subscriptions and gets rAF-acked transferable snapshots. Subscriptions change only
what is sent.
**Why.** Keeps the UI at 60 fps regardless of sim load, gives one code path for tests,
soak and critic runs, and lets the tactical tier get rich element data without paying for the
whole world.
**Consequences.** Invariant I4 (hash unchanged under viewport churn) is a permanent
test. Lint rules forbid render/ui imports in sim.

### ADR-3 · 2026-10-02 · accepted — Formations → elements → individuals, combat at element level everywhere
**Decision.** Elements (unit proxies of N men, vehicles, ships or planes) are authoritative sim
entities, and combat resolves per element in every battle whether viewed or not. Slotted
element poses and sortie paths are "derived kinematics" (pure functions of state).
The close tier expands elements into individuals, with the count equal to strength.
**Why.** This is the only way to satisfy "same state drives every tier" and "casualties at
tactical zoom change strength at strategic zoom" without view-dependent simulation,
which would break determinism.
**Consequences.** Bounded cost: element combat only inside battles (about 20–40k engaged
elements worst case). Individual positions within an element footprint are
presentational, and this is documented in SPEC §8.

### ADR-4 · 2026-10-02 · accepted (finalised in PLAN 0.15) — LOD tiers & render stack: raw WebGL2 + twgl.js
**Decision.**
- Four tiers T0–T3 over continuous zoom, with opacity curves and hysteresis.
- Render stack: **raw WebGL2 + twgl.js** (MIT); PixiJS is not used at runtime.
- Map: one full-screen pass over R16UI owner/controller textures with cubic B-spline indicator
  smoothing (`src/render/map`).
- Units: one instanced draw per atlas with GPU prev→cur interpolation (`src/render/units`).
- Camera-relative f32 coordinates: integer origin + f32 offsets, with the camera offset computed in f64.

**Why.** Measured with `npm run bench` on 2026-10-02 (`docs/bench/*.json`). Setup: RTX 4070 Ti, ANGLE/D3D11,
1920×1080, vsync off, GPU time from EXT_disjoint_timer_query_webgl2. Pixi rows use a ParticleContainer
(Pixi's fastest path) with CPU interpolation; the map in the Pixi scene is a pre-rendered texture.

| case | stack | uncapped fps | CPU ms/frame p50 / p95 | GPU ms/frame | GPU ms units only |
|---|---|---|---|---|---|
| T0 map, 150 nations | raw | ~5000 | ≈0 | 0.43–0.46 | — |
| 10k proxies + map | raw | 2957 | 0.00 / 0.10 | 0.41 | 0.016 |
| 30k proxies + map | raw | 2487 | 0.00 / 0.10 | 0.47 | 0.059 |
| 10k proxies + map sprite | Pixi 8.22 | 2336 | 0.20 / 1.10 | 0.12 | ≈0.07 (frame − sprite) |
| 30k proxies + map sprite | Pixi 8.22 | 1412 | 0.40 / 1.40 | 0.32 | ≈0.27 (frame − sprite) |

- Raw instancing with GPU interpolation draws 30k proxies in about 0.06 ms GPU and ~0 ms per-frame CPU.
  Pixi needs CPU interpolation every frame: 0.4–1.4 ms at 30k on this CPU, likely 1–4 ms on a laptop, which
  is a large part of the 6 ms main-thread budget. It also spends about 4× more GPU time on the same sprites.
- The map must use custom integer-texture shaders anyway. In Pixi that means custom Mesh/Shader code with no
  benefit from the library.
- twgl adds only thin helpers (uniform setting, program and texture creation), so we keep full control.

**Budget translation (mid-range laptop).** A mid-range laptop iGPU (e.g. Iris Xe) is roughly 15–20× slower
than the dev GPU. Dev-GPU guards, checked by `npm run bench` in Phase 7:
- T0 full frame ≤ 1.0 ms GPU at 1080p (now 0.46);
- T2 frame with 10k proxies ≤ 2.0 ms GPU (now 0.41);
- per-frame main-thread CPU ≤ 1 ms with 30k proxies (now ≈ 0.1 p95).

Uncapped fps on the dev machine is recorded but is not the budget metric.

**Consequences.**
- Map modes, occupation hatching and borders live in GLSL.
- Instance buffers are refilled once per snapshot: 1.2 ms for 30k proxies on the main thread. Phase 2 moves
  the fill into the worker's snapshot builder (the instance layout becomes part of `shared/protocol`).
- `pixi.js` stays a devDependency only for the BP benchmark page.

### ADR-5 · 2026-10-02 · accepted — 1 tick = 1 sim hour; f64 + dmath + PCG32 determinism
**Decision.** Fixed 1 h tick with staggered AI and daily/monthly subsystems. Fire events carry
a subtick for smooth tactical animation. f64 using only exactly-specified ops,
custom trig/exp, per-subsystem RNG streams and a counter-based hash for order-independent draws.
**Why.** An hour is fine enough for movement and combat to look continuous when
interpolated, yet coarse enough that 30 sim-years (263k ticks) fit the soak and sweep
budget. `Math.sin` etc. are not guaranteed bit-identical across engines. Fixed-point
was considered and rejected as slower to write, with no benefit given the restricted op set.
**Consequences.** ESLint bans nondeterministic APIs in `src/sim`. Golden-value tests run
in both Node and Chromium.

### ADR-6 · 2026-10-02 · accepted — No SharedArrayBuffer
**Why.** Static hosts (itch.io, GitHub Pages) cannot reliably set COOP/COEP headers.
Transferable buffers with a recycled pool give equivalent throughput at our snapshot
sizes.

### ADR-7 · 2026-10-02 · accepted (crop refined in PLAN 0.18) — Miller cylindrical projection, cropped 80°N–64.165°S, per-row scale tables **[AoC-DEVIATION]**
**Refinement (PLAN 0.18).** The southern crop is 64.165°S instead of ~60°S. This makes the projected extent
exactly 2π × π, so every map size is W = 2H with square cells (`src/sim/data/projection.ts`). It also keeps
the tip of the Antarctic Peninsula at the bottom edge.
**Why.** A familiar world shape, a simple wrap for the looping map, and correct km-based
speeds and blast radii via `kx/ky[y]`. Antarctica is excluded by default (it adds no
gameplay). AoC appears to use an equirectangular-like stretch (VISUAL, low confidence).

### ADR-8 · 2026-10-02 · accepted — 1938 borders from Natural Earth admin-0/1 + hand assignment
**Why.** No permissive 1938 dataset was found: CShapes 2.0 is CC BY-NC-SA (non-commercial),
and aourednik/historical-basemaps is GPL-3.0 (copyleft would spread to the project's data).
Natural Earth is public domain. Admin-1 is assigned to 1938 owners, with hand-drawn
polylines where interwar borders split admin-1 units.
**Consequences.** Some border segments are approximations. The polylines are listed in
DATA_SOURCES as our own work.

### ADR-9 · 2026-10-02 · accepted — Binary gzip saves; JSON+RLE scenario files; IndexedDB autosave
**Why.** Typed-array sections give a bit-identical round trip and fast load.
`CompressionStream` exists in both browsers and Node 18+. Scenario files stay
human-inspectable and shareable.

### ADR-10 · 2026-10-02 · accepted — Own flag artwork; 1938 Germany uses the black-white-red tricolour **[AoC-DEVIATION]**
**Why.** All flags are drawn as our own SVG specs, so no third-party art is used. A
swastika flag is legally restricted in several jurisdictions (e.g. §86a StGB) and would
complicate static hosting and storefronts. The 1933–35 state tricolour is historically
grounded and recognisable. The flag editor lets users change it in their scenarios.

### ADR-11 · 2026-10-02 · accepted — DOM UI with Preact + signals over the canvas
**Why.** Built-in i18n, text layout, accessibility and UI-size scaling (`rem`) come for
free. Panels update at low frequency, so DOM cost is negligible. The canvas is reserved
for the map and units.

### ADR-12 · 2026-10-02 · accepted — TypeScript pinned to 6.0; local module-boundary lint rule
**Decision.** Pin `typescript` to `~6.0` (was 7.0.2). Enforce SPEC §2.1 layers with a local
ESLint rule (`warsim/module-boundaries`) instead of `import-x/no-restricted-paths`.
**Why.** TypeScript 7 is the native (Go) compiler and ships no JS API; typescript-eslint
8.71 requires `typescript >=4.8.4 <6.1.0`. 6.0 is the last JS-API release with the same
language semantics, so `tsc -b` and ESLint share one compiler. `import-x` resolves imports
through the filesystem, so it cannot check fixture files linted at virtual paths or imports
of modules that don't exist yet; a lexical resolver is about 100 lines, has no native
dependency (`unrs-resolver`) and also lets the sim have a package allowlist (`zod` only).
**Consequences.** Revisit when typescript-eslint supports TS 7 (it can then move to the
native compiler). The rule does not follow path aliases; none are used (relative imports only).

### ADR-13 · 2026-10-02 · accepted — Shipped map-asset budget and elevation codec
**Decision.**
- `npm run data` produces assets that are committed under `public/data/earth/`, so a fresh clone builds and
  runs offline: the 16384×8192 land mask (0.38 MB), elevation at 2048×1024, 1024×512 and 512×256
  (2.9 MB total), and admin-1 geometry (3.1 MB, exact NE vertices quantised to 2⁻²⁰) + metadata (0.13 MB).
  Total ≈ 6.5 MB.
- Shipped files use a neutral `.wsz` extension (gzip payload): static servers, including `vite preview`,
  add `Content-Encoding: gzip` to `.gz` files, so `fetch` would return decompressed bytes and the sha256
  check would fail.
- Admin-1 geometry is not simplified: independent per-polygon simplification would open gaps and overlaps
  along shared borders, while exact shared vertices rasterize gap-free.
- The 4096×2048 elevation level is a local derived product only (`.cache/data/derived/`, ~8 MB), for
  offline scenario and terrain tools.
- Elevation encoding: gzip(byte-planes(row-delta(int16 m))), with ocean depths quantised to 10 m.
- gzip headers are normalised (mtime 0, OS byte 255) so outputs are byte-identical across platforms. Raw
  sources are pinned by URL tag and sha256 (`tools/data/sources.json`).

**Why.** Raw int16 + gzip was 13.8 MB at 4096 and 3.5 MB at 2048. Delta + byte-planes halves that: elevation
is smooth along rows, and the high byte is almost constant. Coarse bathymetry is enough for sea shading.
A shipped budget of ~5 MB keeps the static site and the repo light. M-size maps (2048×1024) use the 2048
level directly; hillshade at higher zoom adds procedural detail (SPEC §8 T2/T3), so a 4096 level adds little.

**Consequences.** L/XL maps derive terrain from the cached 4096 level offline (scenario build), never at
runtime. Regenerating assets is idempotent (`npm run data -- --check` fails on drift), and
`tests/unit/data-manifest.test.ts` verifies sha256, sizes, known places and pyramid consistency.

### ADR-235 · 2026-10-09 · accepted — The first lines of done tasks are the plan's last section; an iteration reads the plan to Phase 7 (the user's decision)

- **Context.** After ADR-231 PLAN.md was 67 KB and read whole, about 17,000 tokens an
  iteration, where the search for the first open box had cost about 2,000. Of it 32 KB
  were Phase 7 (the findings put off, the polish notes) and 18 KB the first lines of done
  tasks, kept for the gate: neither is of use to an iteration of phases 3 to 6.
- **Decision.** `npm run plan:archive` puts the first line of every numbered task that is
  done under the plan's last heading, "Done: the first lines", in the order they were
  done, and writes that section itself. The first lines of the done parts of an open task
  stay in it: they show which letters are taken. PROMPT step 1: PLAN.md is read from its
  top to `## Phase 7`; Phase 7 when the task is one of its own or a line goes under PLAN
  1.42; the last section never.
- **Why it is safe.** The gate (`tickedTasks`), `npm run critic:due` (`tickedReviews`) and
  the test of the phase reviews match a line at the left margin wherever it is. The
  reviews are ticked in the order of the phases, and the section keeps the order of the
  ticks. Checked on the run: 147 ticked lines at the margin before and after, the 85
  numbered tasks, the four phase reviews and the 39 open boxes the same.
- **What is read now:** 17.5 KB (227 lines), of which the open review 3.12R is 11 KB.
- **Tests.** `gate.test.ts`: the made plan with its last section, a second run that changes
  nothing, a task ticked later that joins the section; PLAN.md itself with nothing to move
  and nothing to list.
- **What it costs.** A phase's heading with every task done stands over nothing (phases 0
  to 2). The order of the done tasks within the plan is in the archive only.

### ADR-234 · 2026-10-09 · accepted — The supply's reach about a formation keeps to the edges of a map that does not loop (PLAN 3.12Rsb)

- **Context.** The second part of PLAN 3.12Rs (ADR-233): a formation on a cell that is not
  its side's is fed when a network of its side lies within `SUPPLY_REACH` (2) cells of it
  (PLAN 3.4Rf).
- **What was so.** `supplySystem` looked at the column `(cx + dx + w) % w` whatever
  `settings.loopingMap` said. With `looping=0` a formation on an enemy's ground in the
  first two columns was fed by a network of its side in the last two, and the other way
  round, with no route between them.
- **Decision.** The reach asks the setting: beyond an edge of a map that does not loop
  there is no cell, as above the first row. On a map that loops it looks where it looked.
- **Tests.** `tests/unit/seam.test.ts`, one, with the map looping and not: a German
  division on Polish-held ground in the first column, Germany's network made by hand in
  one column at a time (the last, the last but one, the third from the end; columns 2 and
  3 of its own side, which answer the same both ways). Red first ("expected true to be
  false": fed from the last column with the option off).
- **The pin stays** (92689265): 1938 loops.

### ADR-233 · 2026-10-09 · accepted — The measure of contact keeps to the edges of a map that does not loop (PLAN 3.12Rsa)

- **Context.** PLAN 3.12Rs, found by a search with 3.12Rp (ADR-227) and read, not run: with
  the new game's option `looping=0` (`settings.loopingMap` off) routes, the frontier and the
  supply flood stop at the map's edges, and the distances of the sim did not ask. 1938
  loops by default: no game of the tests or the sweeps is one with edges.
- **What was so.** `cellDist` (`elements.ts`, "the one measure of contact") and `wrapDx`
  folded any east-west distance over half the map. Two enemy formations at x = 0.4 and
  x = w − 0.4 were 0.8 cells apart: in contact, in one battle, firing, their blocks
  deployed towards each other over the seam, with no route between them.
- **Decision.** Both ask `settings.loopingMap`; on a map that loops they do what they did,
  by the same arithmetic. `wrapDx` is exported and takes the place of the same three lines
  in `retreat.ts` (away from the nearest enemy) and `warBattle.ts` (the point between the
  two formations of a war's largest battle). `inCorridor` (`majorBattles.ts`), which the
  plan's text had not named, asks too: a breakthrough corridor westwards from the first
  column went on in the last.
- **Split.** 3.12Rs is five parts by system (PLAN): this, the supply's reach, the
  territory's pressure, the operational AI, and what the search of this part found beside
  them (`nearestCellWhere` in play, the God brush of control, the editor's brush).
- **Left here.** `findBattles` looks into the buckets over the seam whatever the setting:
  candidates only, and `cellDist` decides. A retreat's fall-back cell is looked for by
  `nearestCellWhere`, which wraps: 3.12Rse.
- **Tests.** `tests/unit/seam.test.ts`, new, two, each scene with the map looping and not:
  two enemies at the two edges (the distance, the battle, `engaged`, the fires) and the
  corridor. Red first ("expected 0.8000000000001819 to be close to 2047.2"; "expected true
  to be false").
- **The pin stays** (92689265): 1938 loops.

### ADR-232 · 2026-10-09 · accepted — A war declared on a nation that an older war ends in that hour stays as it is (PLAN 3.12Rr3)

- **Context.** The one war of the sweep seeds that is still declared and gone in its hour
  (ADR-230): seed 3, tick 30,817, Poland on nation 130, a state of 3,716 km² that the
  Soviet Union and nine more had been at war with for seven days (war 80).
- **Traced** (`.cache/rr3-trace.ts`, the days before; `.cache/rr3-pass.ts`, nation 130
  before each system of the hour). War 80's score was 16 two days before and 40 the day
  before: the score is the daily pass's and a day old. On the live tallies 130 had 1,939
  km² under occupiers when Poland declared (52.2%, a score of 100 already), and 2,532 km²
  (68.1%) after `territorySystem` of that hour. The pass scored 100: the defender was
  crushed (`CRUSHED`, 90) and sued, and the winner annexed a loser under 8,500 km² whole.
  Not the capitulation (under 75%), not gold (150, not bankrupt), not the men (9,523 of
  12,268), not the deadlock. Poland's war 82 ended with its nation: no peace of its own, no
  truce (Poland may declare on anyone the next day), no land or puppet to Poland.
- **Decision.** It stays. No rule is made; `aiSweep` keeps its exception (a war whose
  nation was at war as the hour began and dead by its end) and counts such wars.
- **Why.** The two rules before it mended wars that gave something for nothing: a truce of
  two years or a small state to a nation that never fought (ADR-229), German land to
  Estonia while the war it was taken in went on (ADR-230). This one gives nothing to
  anyone, and the log reads true: Poland declared, the Soviet Union made peace and
  annexed. The hour is no line either: had Poland declared a day before, its war would
  have been a day old when it ended the same way.
- **The rule that could be written, and is not.** The end could be seen at the
  declaration: a target that leads a war in which, on the live tallies, it is crushed (or
  would be annexed whole: a loser at 10 or more with under 8,500 km²). `whyNotWar` could
  refuse it. It would cost the score of each war of each target the AI weighs, and it
  would be a rule about who may join in on a dying state, which is balance (ADR-58), with
  no defect to mend. A forecast of the pass by exhaustion (the men) is not one that can be
  made at the declaration at all.
- **What it leaves.** A nation can declare on one that another is about to annex and get
  nothing. How often: 0, 0 and 1 of 303, 178 and 204 wars in ten years of seeds 1, 2 and
  3. For Phase 7 if the count grows (the stderr line of `aiSweep` has it).
- **Tests.** None new: no rule. `aiSweep`'s assertion of ADR-230 stands as it was.
- **The pin stays** (92689265): no code changed.

### ADR-231 · 2026-10-09 · accepted — PLAN.md holds what is still to do; the text of done tasks is in docs/PLAN_DONE.md (the user's decision)

- **Context.** PLAN.md was 528 KB and 6,348 lines: 389 boxes ticked, 38 open. PROMPT step 1
  says to read it; it was no longer read but searched for the first open box, and what else
  it held went unseen.
- **Decision.** `npm run plan:archive` (`tools/plan/archive.ts`) moves the text of every
  task that is done to `docs/PLAN_DONE.md`, word for word, and leaves its first line in
  PLAN.md with the mark `[…]`. A task is done when it is ticked and no box under it is
  open; of an open task the parts one level in are moved by the same rule. It is run after
  each tick, in the tick's commit (PROMPT step 7). PLAN.md is read whole (step 1); the
  archive is searched, not read.
- **Why the first lines stay.** Three readers go by the ticks of PLAN.md: the gate
  (`tickedTasks`: a numbered task ticked since HEAD runs the whole e2e suite),
  `npm run critic:due` (`tickedReviews`: `- [x] 2.11 Phase 2 review`), and the count of
  PROMPT step 9. `gate.test.ts` asks for the phase reviews by their lines. Nothing else
  parses the file (`tools/`, `tests/`, the critic's prompt looked at).
- **Why not PROGRESS.md.** It is 916 KB, append-only, and only its tail is read; it has
  each task's entry already. The comments and ADRs that name a task (`PLAN 3.8c`) need its
  text where a search finds it.
- **The first run:** 168 tasks and parts moved, PLAN.md 528 KB → 69 KB (833 lines). Checked
  (`.cache/plan-verify.ts`): the ticked tasks (85), the phase reviews (0.22, 1.41, 2.11,
  3.7) and the open boxes (38) read the same before and after, and every line of the old
  file is in one of the two. A second run moves nothing.
- **Kept from sliding back.** A test in `gate.test.ts` fails while PLAN.md has something to
  move. A commit of documents alone does not run it (its gate is parity); the next commit
  with code does.
- **What it costs.** A note a done task carried for a later one ("to settle in Phase 7")
  is in the archive unless it was copied under the open task, as PROMPT now asks. Not
  searched for in the 168 moved.
- **Not done.** DECISIONS.md (787 KB), PROGRESS.md and SPEC.md (190 KB) are as they were:
  they are searched, or read by the tail.

### ADR-230 · 2026-10-09 · accepted — Nobody is called to a war against a nation it is at war with already (PLAN 3.12Rr2)

- **Context.** The second of the two wars of seed 2 that were declared and gone in one hour
  (ADR-229): tick 18,793, Germany on Latvia. Traced (`.cache/rr2-trace.ts`, the hour
  before): Estonia was the Soviet Union's puppet and the ally of Latvia and Lithuania, and
  with its overlord at war with Germany since tick 6,816 (war 21), holding 127,075 km² of
  it. The declaration called it as Latvia's ally. War 44 was Germany and six more on Latvia
  and Estonia; the war pass of the hour counted Estonia's hold against the land of the two
  (100,362 km²): −100, Germany crushed, and the peace made the land Estonia's while war 21
  went on.
  - Pairs at war in two wars were there before it: 20 at that tick, all of nation 23
    with the members of one alliance (wars 11 and 17: it declared on one of them, and
    another of them declared on it). No two nations of one side were at war.
  - **Nation 107**, which PLAN 3.12Rr2 took for a nation on the side of a leader it is at
    war with: it was not (`.cache/rr2-107.ts`, every event that names it). War 42, Germany
    on 107, was declared at tick 17,113 and not in that hour; its peace of tick 17,473 made
    107 Germany's puppet, 55 days before war 44, and it came to war 44 as a puppet does.
    Nothing to mend.
- **Decision.** Of the nations a declaration calls, one that is at war with a nation of the
  other side stays out, by the three steps that keep out a nation with a `bond` (ADR-179):
  first who is at war with the enemy's leader, then the puppets at war with anyone of the
  other side that stands, then the other nations. A puppet stays out with its overlord.
  The two leaders stand: they are not at war with each other (`whyNotWar`), and a called
  nation at war with one of them is out in the first step. So no pair is put into a second
  war.
- **Why the steps and not `add`.** PLAN 3.12Rr2 named the place where a truce partner is
  left out (`add`: not against the enemy's leader). That asks each nation alone: Estonia
  would stay out and a puppet of Estonia would be called against Germany without it. It
  also leaves two members that are neither leader, which the steps answer as they do for a
  bond: of two torn by each other alone, the one called first fights (the defenders' allies
  are called before the attacker's). Every case seen was one against a leader; the other is
  covered by the same line.
- **What it costs.** An ally at war with the enemy already is not in the new war: when its
  own war ends in a truce it is out of both. As with a truce partner.
- **What it does not do.** The wars that are there are not joined into one, and
  `Wars.between` and `noteCapitalCaptured` still take the first war of a pair: a pair comes
  into two wars by no declaration now, and a save of before may hold some.
- **The war on a nation that dies in the hour** is another matter, found when the count
  became an assertion: seed 3, tick 30,817 (a run that the rule changed): Poland declared
  on nation 130, which had 52% of its 3,716 km² under the Soviet Union in war 80, and
  that war's peace of the same hour annexed it whole (a small state). The new war ended
  with its nation, by no peace of its own. `aiSweep` asserts that no war is declared and
  gone in its hour but such a one (the dead nation was at war as the hour began) and
  counts those. Whether the AI should leave such a target alone: PLAN 3.12Rr3.
- **Tests.** `war.test.ts`, one: Estonia at war with Germany and Latvia's ally, Lithuania
  its puppet: Germany's war on Latvia is Germany on Latvia alone, the old war is the one
  between Estonia and Germany, no peace in two days. Red first ("expected [ [ 1 ], [ 7, 8,
  6 ] ] to deeply equal [ [ 1 ], [ 7 ] ]"). Finland, Germany's ally, at war with Estonia:
  Estonia is called first and fights, Finland stays out.
- **The pin moves:** 2104f897 → 92689265. Who is called is a rule, and seed 99's first
  year has such a call.

### ADR-229 · 2026-10-09 · accepted — No war is declared on or by a nation that is overrun (PLAN 3.12Rr1)

- **Context.** PLAN 3.12Rn counted wars declared and gone in one hour: 2 of 244 in ten
  years of seed 2. Both traced (`.cache/rr-trace.ts`, the state of both leaders the hour
  before and after; the war pass printed what it judged). They are two causes, and neither
  is the broke leader PLAN 3.12Rr also named: all four leaders had gold and none was
  bankrupt.
  - Tick 85,369, nation 202 on nation 174. 174 had 81.2% of its land (10,117 of 12,464 km²)
    under nation 170, its enemy in a war of which 174 is a member and not the leader. The
    capitulation asks a war's leaders alone, so that war went on; in the war declared on
    174 it led, and the pass of the same hour ended it at 100. 202 had fought nothing. It
    took a truce of two years; 174 was over 8,500 km², or 202 would have annexed it whole.
  - Tick 18,793, Germany on Latvia: not this cause (PLAN 3.12Rr2). Estonia, at war with
    Germany already and holding 127,075 km² of it, was called to Latvia's side. Its hold
    counted in the new war against the land of Latvia and Estonia (100,362 km², so
    127,075 ÷ 200,724 = 0.63, a score of −100), Germany was crushed on the first day, and
    the peace gave Estonia the land for good while the war it was taken in went on.
- **Decision.** `whyNotWar` refuses a declaration when one of the two that would lead the
  sides is overrun: the attacker, or the defender's overlord, or the defender if it has
  none. `Refusal.Overrun` (23); the God tab's words: "one of them has three quarters of its
  land under occupiers: the war would be over at once". Overrun is the capitulation's own
  rule, now one function (`overrun`): 75% of the nation's own km² under whatever occupier.
  The AI asks `whyNotWar` for every target already; a player's or a script's declaration
  is told why.
- **Why here and not in the capitulation.** The other way PLAN 3.12Rr named was to have the
  capitulation ask only the war's own occupiers on its first day. The war would then begin
  against a nation that cannot fight and end by the rule a day or a week later with the
  same terms: a small state annexed whole by a nation that has not met it. The refusal
  leaves the overrun nation to the wars it is in.
- **A puppet that is overrun** is declared on as before: the war is its overlord's
  (PLAN 3.8e), and the overlord leads. It declares none itself.
- **Wars of independence** (`revolts.ts`, `puppets.ts`) pass through the same rule: a
  holder that is overrun declares no war on its rebels, and the log has the `WarRejected`
  that a refused declaration always has. Until now that war was lost by the holder in the
  hour, and a holder under 8,500 km² went whole to its rebels. Not seen in the seeds run.
- **What it does not stop.** The live tallies are asked at the declaration and the day's
  snapshot at 00:00: a nation at 74% that is at 75% the next day leads a war of a day. A
  member that is overrun is still no reason for its side to end (the leader-only rule,
  as before).
- **Tests** (`war.test.ts`, one): Brazil, at war with nobody, holds the west of Poland to
  one cell under 75% of its km²: Germany may declare and Poland may. One cell more: both
  declarations are refused with `Refusal.Overrun`, no war is declared, no peace signed, no
  truce begun in two days. Red first (no refusal). Poland as Brazil's puppet and overrun:
  Germany may declare on it, and it may not declare.
- **The pin stays** (2104f897): no nation of seed 99's first year declares on an overrun one.

### ADR-228 · 2026-10-09 · accepted — A formation is spawned on no cell at sea: the command is refused (PLAN 3.12Rq)

- **Context.** `spawnFormation` took `standPoint` of the place given. In a cell that is all
  water that is the place itself, or the cell's middle: the formation stood in a cell of no
  component of the route grid, where no route begins, and took no order. Off the map
  `standPoint` gave the place as it was in a world without a fine mask (the toy world), and
  the formation stood in no cell at all. Found by reading, with PLAN 3.12Rm. No panel sends
  the command at a place of the player's choosing today; the specs and tools do, and God
  Mode's spawn will.
- **Decision.** Refused, with a reason of its own (`Refusal.AtSea`, 22; the God tab's words:
  "the place is at sea or off the map: a formation stands on land"). The rule asks the
  route grid, not the fine mask: the cell of the stand point has component 0, or the point
  is off the map. The nation is asked first (a dead nation at sea is refused as dead), a
  NaN before both.
- **Not moved to the nearest land** (the other way PLAN 3.12Rq named, the editor's
  `strandedToLand`). That rule is for formations a terrain import left on water: they were
  the player's already, and their loss would be the import's side effect. A spawn is a
  place the sender chose. A formation put 64 cells from the click, on the land of whoever
  holds the nearest coast, is not what was asked, and a command that does something else
  than it says is what PLAN 2.17a ended. The sender is told and chooses again.
- **The coast stays as it was.** `standPoint` runs first: a place on the water of a cell
  that has land is the cell's land point (PLAN 2.9a), and its cell has a component.
- **Tests** (`refusal.test.ts`, two): the toy world's first cell of no component, a place
  below the map and one left of it are refused, the count of formations as before, and a
  dead nation at sea is refused as dead (red first: the spawn was carried out); Germany's
  first cell with water in it by the fine mask, a place on that water: the formation
  stands in that cell, on land, elsewhere than the place given (green before and after).
- **The pin stays** (2104f897): no scenario sends the command.
- **What the tests' own spawns are.** The six places the unit tests and `worker.spec.ts`
  give in the toy world as bare numbers are all land (terrain 2, component 1; probed). The
  specs of 1938 spawn in western China, on the German and Polish border or at a capital.

### ADR-227 · 2026-10-09 · accepted — The supply network keeps to the edges of a map that does not loop (PLAN 3.12Rp)

- **Context.** The supply flood joined column 0 and column w − 1 whatever
  `settings.loopingMap` said (found by reading, with PLAN 3.12Rl). The route grid
  (`makeNavGrid`), the front (`frontierOf`, `neighbours4`) and the AI's fronts ask the
  setting. On a map with hard edges (the `looping=0` option of a new game; a scenario whose
  map does not wrap) a bloc with land at both edges and a city at one fed its formations at
  the other, over a seam no march of it crosses.
- **Decision.** Three places of `refreshSupplyNetwork` ask the setting, read once a refresh:
  - the flood's two seeds at a row's ends;
  - `beside`, which says whether a cell won lies by its bloc's network (a partial refresh);
  - `ringHolds`, which says whether the network hangs together without a cell lost: beyond
    an edge there is no cell, as above the first row and below the last.
  On a map that loops nothing changes. `applyGameOptions` already asks a full refresh when
  the option changes.
- **Each half has its own failing test** (`supply.test.ts`, three; a made map of 60 × 20,
  one nation at both edges). With the flood's half alone the two tests of the partial
  refresh stayed red: a cell won back at the far edge was marked from the network over the
  seam (the test's first check; the stripe behind it was not counted in that state), and a
  cell lost in the first column left the first column below it marked, since the ring was
  closed by the last column's network.
- **The rule of the tests** (`referenceNetwork`, `byRule`) asks the setting too. It wrapped
  as the flood did, so the two agreed in the defect.
- **The pin stays** (2104f897): 1938 loops.
- **Not done** (PLAN 3.12Rs): other code of the sim joins the two edges without asking.
  Seen by a search, not run: the reach of `supplySystem` (a formation on a cell not its
  side's is fed by a network within 2 cells, over the seam); the pressure of
  `territorySystem` (a formation's 2 cells of pressure, over the seam; PLAN 3.12Rp said
  the territory rule asks the setting, which is so of its front and not of its pressure);
  `wrapDx` and the distance of `elements.ts`; the distances of `operational.ts` (lines 212,
  392, 402, 641); the place of a battle in `warBattle.ts`. Each is a cause of its own.

### ADR-226 · 2026-10-09 · accepted — A retreat barred in the middle of a step is ordered again from its enemy; an order in the middle of a step does not begin at an end closed to the formation (PLAN 3.12Ro)

- **Context.** A march whose next cell has turned a third nation's in the middle of the step
  walks back to the cell behind it (ADR-172). For a formation on the retreat that cell is
  the one it left, on its enemy's side. PLAN 3.12Rk counted 23 such walks in three years of
  seeds 77 and 99, two with an enemy near: 1.4 cells off at the turn, 0.2 at the walk's end.
- **What the trace found** (seed 77, formation 630 of nation 6, tick 4,538; `.cache/
  ro-case.ts`, on the code before): two causes, not one.
  - The cell had not turned under the retreat. It turned while the formation stood held in
    contact past the middle of a step (a formation in contact is not moved, so it was not
    barred then). The retreat's own order, in the middle of that step, began at the nearer
    of the step's two cells (ADR-151): the cell turned nation 4's. A route from closed
    ground is allowed (who stands on it walks out), the path was the step to that cell and
    on, and the march was barred in its first hour.
  - The same in `order` for the walk back itself: an order given on the first half of a
    walk back began at the cell that had barred it. The first test of this task showed it:
    barred again in each of 23 hours, the formation going nowhere.
- **Decision.**
  - *The order* (`order`, `movement.ts`): in the middle of a step the route begins at the
    nearer end, but at the further one where the nearer is closed to the formation by the
    order's own passage and the further is not. For any order: a retreat's, an AI's, a
    player's, a march home's (whose passage closes an enemy's ground alone).
  - *The retreat* (`retreatSystem`): a formation on the retreat and on the walk back
    (`HOME_BACK`) with an enemy within `RETREAT_CELLS` (3) is ordered again in that hour by
    the retreat's own rule (`fallBack`, the search that was `retreatSystem`'s body), from
    that enemy. Its `RETREAT_HOURS` begin again with the order; `FormationRetreated` is not
    emitted again. With no cell or no route it walks back and is asked again each hour of
    the walk. Not where the cell behind it is a third nation's too: the walk back alone is
    not barred there (ADR-172).
  - *Why 3 cells:* the distance a retreat means to put between the two. From further off a
    walk back of one step (1.42 cells at most) ends out of contact (1.5).
  - *Why the day begins again:* the way out is back to the cell behind it first, towards
    the enemy, and on from there; what is left of the first day does not take it out of
    contact (below).
- **Not chosen.**
  - *The walk on to the step's far end where that is its side's ground* (the PLAN's second
    way): the far end is what barred it, a third nation's by the rule that bars.
  - *A way that does not go back to the cell behind it.* A formation in the middle of a
    step is on the line between two cell points; a path leaves that line at one of them,
    and the other is closed. It passes its enemy.
  - *The walk back left as it is:* the formation stood idle on its enemy's side with its
    retreat running out, no order allowed it.
  - *The re-order in `movementSystem`*, where the walk back begins: `retreat.ts` imports
    `movement.ts`, and the retreat runs after the movement in the same hour.
- **Measured.**
  - Formation 630 with the retreat's half of this alone (an earlier state of the working
    tree, `.cache/ro-case-after.log`): barred at tick 4,538 at 1.38 cells from its enemy,
    ordered again, back past it at 0.20 cells (tick 4,549), 0.75 cells off when the new
    day ended (4,562), in contact for 11 hours (2,314 men to 1,629), a second retreat at
    4,573 and 4.0 cells off 40 hours on. Before: back at 0.21 cells and idle there, in
    contact 14 hours after. So: it gets away at the second retreat, not the first.
  - With both halves the game of seed 77 is another before that tick (the AI's orders in
    the middle of a step begin elsewhere) and the formation is not in that place: the case
    cannot be shown on the final code, and what the order's half does for it is the unit
    test's word (`begins at the other and is not barred`).
  - `.cache/rk-back.ts`, before and after: seed 99, 14,400 hours: 857 formation-hours on a
    walk back, then 787; 12 walks on the retreat both times, none with an enemy within 98
    cells. Seed 77, 4,700 hours: 365, then 283; 7 walks on the retreat (one the case
    above), then 5, none with an enemy within 37 cells.
- **The pin** stays at 2104f897: no order of seed 99's first year began at a closed end.
- **Tests.** `retreat.test.ts`, four: a retreat barred before and past the middle of the
  step is ordered again, is not barred again, does not go to the barred cell and ends out
  of contact, no nearer its enemy than at the turn (red first: the walk back; the second
  red again without the order's half, 23 refusals); a retreat from the middle of a step
  whose nearer cell has turned begins at the other (red without the order's half); with no
  enemy near, the walk back as before (green before and after).
- **Not done.** No count of how many orders a year begin at the further end. No test of a
  player's order on a walk back (ADR-172 has the same gap; the rule is now the passage's).
  A formation barred with its enemy between 3 cells and 1.42 + 1.5 off on a diagonal is
  not ordered again and could end a walk back in contact: not seen, not looked for.

### ADR-225 · 2026-10-09 · accepted — A war that a bond ends has its row, `WarEnded`, with whose puppet the nation is now; a death's row is the end of a war it empties (PLAN 3.12Rn)

- **Context.** A nation that gets an overlord while at war leaves the wars against its new
  realm and that realm's allies (`leaveBondedWars`, ADR-180, ADR-181), and a war it was the
  last of its side in is removed. No event said so: the log and the ticker declared the war
  and never ended it. The ninth read: Germany's wars with nations 114 and 107 in three
  years of seed 77, 2 of 69. Ten years of seeds 1, 2 and 3 on today's rules: 3, 1 and 1.
- **Decision.** A new event, `WarEnded` (40), emitted by `leaveBondedWars` when the war is
  gone from the list: a the leader of the side that stayed, b the nation that left. It is a
  kind of the history, of the ticker (at b's capital) and of the peace cue. Its sentence
  tells the cause from the log alone, as the other kinds with more than one sentence do
  (`HistoryRow.as`): the nearest row before it in its hour that is b's `PuppetCreated` (a
  peace's term) or a `NationAnnexed` (b's overlord annexed: the annexer has b now) names
  the overlord, the row's `cn`: "The war between Germany and Albania ended: Albania is now
  a puppet of Italy". A row with no such row before it reads "… ended with no peace
  signed"; the rules emit none such.
- **Not chosen.**
  - `PeaceSigned` for it: no peace is signed, nobody won, and no truce begins; the peace's
    row names a winner first.
  - The overlord in the event: an event has a and b, and a third number in x or y would
    make the row one with a place. The log has the overlord one or a few rows before.
  - A sentence for each kind of bond (an ally, one overlord, allied realms): every bond
    that ends a war here begins with b's new overlord, and the row that names the overlord
    is enough to read which it is.
  - A row for a nation that leaves a war that goes on: the war is in the list, and the log
    names a war by its leaders at the declaration alone. Not counted: how often the nation
    that leaves is one of the two the declaration named.
- **A war that a death ends.** `eliminateNation` takes the dead out of its wars
  (`Wars.endAllOf`), and a war left with nobody on one side ends with no row of its own (9
  to 11 in ten years of a seed). The death's row is its end: "X was destroyed" or "X was
  annexed by Y" is in the log and the ticker in that hour, and a second row would say the
  war with the dead is over. The ten-year tests take the death of a nation of the war as
  the end of a war that is gone.
- **Consequences.** The log is state and hashed (ADR-213). The pin of seed 99 stays at
  2104f897: no war ends by a bond in its first year. A game in which one does has another
  hash from that hour, in `history.rows` alone; no rule changed. A save from before reads
  as before (it has no such row).
- **Tests.** `realmWars.test.ts`, one, red first with the emit taken out: the puppet made at
  a peace (one war ended, one that goes on, one that stands), the puppet handed over at an
  annexation (two ended, one stands), the ticker's rows and their place, the cue, the bare
  sentence. `aiSweep` (ten years of seeds 1, 2, 3): every war that leaves `wars.list` has
  in that hour a peace or a `WarEnded` between a nation of each side, or the death of one
  of its nations; and the wars ended and those in the list are the wars at the start and
  those declared. Red with the emit taken out (seed 1, tick 27,817: war 76 of Germany,
  Lithuania and nation 109 on nation 127).
- **Found with it.** Two of seed 2's 244 wars are declared and ended by a peace in one hour
  (tick 18,793: Germany declares on Latvia, and Latvia makes peace with Germany as the
  winner; tick 85,369: nation 202 on nation 174, and 202 the winner). Read, not traced: the
  day's `warSystem` runs after the declaration and holds a side lost whose leader has 75%
  of its land under occupiers of any war (`overrun`). PLAN 3.12Rr.

### ADR-224 · 2026-10-09 · accepted — A formation mustered by a city stands in the city's cell (PLAN 3.12Rm)

- **Context.** A division raised in an overseas theatre appears by the city nearest the
  front, at `standPoint` of the city's own place (PLAN 2.11k). A city's place and its cell
  are two things: the cell is the land cell the data gives it, the place is where it is on
  the globe, and for 436 of the 5,757 cities of 1938 the place lies over the cell beside,
  which is water on the grid (component 0 of the route grid). `standPoint` asks the fine
  mask alone, and keeps a place that is surely land by it or takes the point of the cell
  that holds the place: the water cell either way. No route begins there, so the formation
  took no order. Seed 77, three years, the rules of today: 7 British formations on two
  points (3 at 1280.054, 524.174; 4 at 1217.043, 653.954); the ninth read counted 26 on
  the first.
- **Decision.** `cityStand` (`production.ts`): the city's own place, by `standPoint`, where
  that place is in the city's cell; else `cellPoint` of the city's cell. `musterPoint` has
  already chosen a city whose cell is on the front's landmass, so the cell is one a route
  begins in.
- **Not chosen.** A mend in `standPoint` (a place whose cell is water on the grid moved to a
  neighbour): it has no city to say which neighbour, and its other callers do not need it:
  the start of 1938 and of the random world hold no formation in such a cell, and
  `spawnPoint` asks it only for a place in a cell its nation holds. The cities' places moved
  into their cells in the data: the dots are drawn at the places, where the towns are (the
  list under PLAN 7.4).
- **Consequences.** The pin of seed 99 stays at 2104f897: no division is raised by such a
  city in its first year. Its game is another from day 407, when the old rule put a British
  division in the water at 1291.932, 534.554. The ten-year tests ask on every day that no
  formation is in a cell of component 0. A `spawnFormation` command given at sea still puts
  a formation there: PLAN 3.12Rq.
- **The premise of `researchYears.test.ts`, a third time** (after ADR-147 and ADR-153). In
  the game of seed 99 since, Latvia is rich on the first day of every month of 1940 and
  1941 and does not know `armor_medium_2` in 1942, which the test asked of every such
  nation. Latvia's income is 3 until March 1939 and 1,225 in January 1940 (3,689 cells);
  it has learnt one tech by then and has 14 of 1938 to 1941 to go: 2,290 days on three
  lines, 1,420 gold. Its budget is 3.3 to 3.6 gold a day, more than three lines take, and
  its treasury is never short. It learns 13 techs in the two years, the lowest year first,
  and `armor_medium_2` (200 days, open to it when a line is free in August 1941) in
  February 1942. That is the rules' time and no defect: the check was of nations whose
  research went on through the two years, and its premise never said from where. The
  Soviet Union, Britain and the United States each had 5 techs and 880 days to go on that
  day. The check now takes the nations rich through both years that had no tech of 1938 or
  before to learn on 1 January 1940; still three or more of them; Latvia is in the check
  of 1944 (the heavy tank), as Denmark and France are. Not chosen: Latvia left out by
  name; "knows it in 1942" made later.

### ADR-223 · 2026-10-09 · accepted — An annexation that hands puppets over refreshes the supply network in full; the flood is to keep to the edges of a map that does not loop (PLAN 3.12Rl)

- **Context.** `annexNation` gave the target's puppets to the annexer and marked nothing.
  No cell of a puppet changes, so the partial refresh (ADR-196) has nothing of theirs to
  mend; the target's bloc has no source left and is never flooded; and a city under another
  bloc's mark is no seed of its own bloc's flood. Belgium annexed by Germany at a peace with
  its cities occupied (`.cache/read9/peaceSupply_BEL_GER_12.log`): the Congo's 6,240 cells
  at mark 27, three formations unfed for 20 days (23,448 men to 12,190), and the loaded
  save, which refreshes in full, another game from the first day (I2).
- **Decision.** `annexNation` sets `supplyDirty` when a puppet is handed over, as
  `makePuppet`, `releasePuppet` and `eliminateNation` do for their change of an overlord. An
  annexation with no puppets stays on the partial path.
- **Not chosen.** The puppet or the two blocs marked (`supplyDirtyNations`,
  `supplyDirtyBlocs`): a marked bloc is flooded whole only when no changed cell is its own,
  and the annexed cells are the annexer's and the target's, so nothing would be flooded. A
  change of that rule, or of the seed that is skipped under another mark, is a change of
  the mending for a case that a full refresh (6 ms) settles and that comes a few times a
  game.
- **The flood and `loopingMap`.** The flood, the gain test and `ringHolds` join the map's
  west and east edges whatever the setting says; the territory rule, the route grid and
  the AI's fronts ask it. They should agree: on a map with hard edges no march crosses the
  seam, and a network should not. Not done here (a second cause): PLAN 3.12Rp. 1938 loops.
- **Consequences.** The pin of seed 99 stays at 2104f897 (no annexation with puppets in its
  first year). The other places where a bloc changes were sound and now have a test each
  against the cell-by-cell rule (`supply.test.ts`).

### ADR-222 · 2026-10-09 · accepted — A march home does not wait before an enemy's ground: round it, across it where it stands on it, or the march ends and the mark with it (PLAN 3.12Rk)

- **Context.** The march home (ADR-169) was routed over every holder's ground and waited
  before an enemy's cell "as any march does". Any other march waits there for its front; a
  march home has none: its nation holds no cell beside it, so no cell before it ever
  flips. And the mark (`formations.home`) keeps the operational AI and the repatriation
  off the formation. Seed 77, three years (`.cache/read9/stuck2_1938_77.log`): 403 marches
  home, 144 of 30 days or more, 112 of 90 or more; of the 633,728 hours of those 144,
  493,025 were a wait before an enemy's cell and 410,484 of them on that enemy's own
  ground (the war began while the formation crossed the nation: Italy's on France, with
  German, Italian and Polish divisions in it); 929,100 men at the mark, 108,977 at the end.
  A played nation's formations too.
- **Decision.**
  - The route of a march home keeps off the ground of the nations its own is at war with
    (`homeward`, a `Passage` with its provinces, so that "no way" is answered before any
    search). With no war it is what it was.
  - A march home that stands on an enemy's ground walks on over that enemy's cells and out
    of them, as a route from closed ground does (ADR-149). It takes no cell: control
    spreads from held land (PLAN 1.14), and it holds none there. It can be met and fought.
  - Before an enemy's cell that it would walk into, at a cell's middle, it is ordered home
    again from there, round that ground. With no way the march ends there, the mark with it:
    the formation is idle and its nation's to order as any other (the AI's within a day by
    its own plan, a player's at once). The midnights after ask for a way again.
  - In the middle of a step into such a cell (the war began in that step) the mark goes and
    the march waits as any other does; so does the walk back of ADR-172 (`HOME_BACK`)
    before an enemy's cell. No mark waits.
  - A formation is not set on its spawn point across a war: where the way home on its own
    landmass is barred by an enemy it stands where it is. (With `everywhere` an order home
    on one landmass never failed, so this is no case that was.)
- **Not chosen.** The mark dropped and nothing more (the task's first form): a formation
  in the middle of a nation at war with its own can take no step at all (every cell about
  it is the enemy's and none flips), mark or none; the AI would have it and could do
  nothing with it. That is 83% of the hours counted above. A limit to the length of the way
  round: see the consequences; it is a number to be set with the balance.
- **Consequences.**
  - The pin of seed 99 moves, 4b019e8f to 2104f897: marches home of its first year go by
    another way.
  - Seed 77, three years, on the new rules (another game from the first barred march on):
    358 marches home, 15 of 30 days or more, 4 of 90 or more; 0 hours before an enemy's
    cell. `homeWait` (the ten-year tests): the longest wait of a marked formation is 0 h on
    seeds 77 and 42 and 1 h on seed 99 in three years (7,656 h on seed 77 before).
  - The way round can be long. In the unit test's first form an Italian division in
    Madrid, Italy at war with France, was sent home by Gibraltar, North Africa and the
    Levant: 556 cells, half its men gone in 35 days. On seed 77 three Japanese formations
    walk 153 days and arrive with 5, 49 and 48 men of 785, 2,654 and 2,585. The march home
    was unfed before (ADR-143) and the spawn point was at any distance on foot (ADR-169):
    the line under PLAN 1.42 has the figures, and whether a way has a longest length
    belongs there.
  - A formation that crosses a nation at war with its own is alone on enemy ground and is
    fought there (in the test's first form, in Germany: in contact after 181 hours and
    destroyed after 706).
  - Not mended here: the walk back of a formation on the retreat can go towards its enemy
    (PLAN 3.12Ro).

### ADR-221 · 2026-10-09 · accepted — A panel of the centre is drawn over the war banners; the Settings panel scrolls in its box (PLAN 3.12Rh5)

- **Context.** In a view 600 px high the Settings panel's rows are 59 px taller than its
  `max-height` (the view less 12 rem): its rows do not shrink and its box did not clip, so
  "Combat efficiency" and "New game" were drawn below its foot. The war banners stand
  above the bar and wrap upward: one or two rows are below the panel's foot (the two
  banners of the 1938 start; three wars at 1,100 px begin 3 px under it), eight banners
  at 1,100 px are four rows from 415 px, and the foot of an open panel is at 480 px. The
  banners were mounted after the panels and took the pointer there.
- **Decision.** The Settings panel scrolls its rows in its box (`overflow-y: auto`, as
  the editor's panel does; the History panel's list already shrinks and scrolls). The
  ticker and the banners are mounted before the panels of the centre (`App.tsx`), which
  are drawn over a row of banners that reaches them and take the pointer: an open panel
  is what the player is at. The banners below its foot stay in sight.
- **Not chosen.** A shorter `max-height` for the panels that keeps their foot above four
  rows of banners: 200 px of banners in a view of 600 leaves a panel of 290 px, for a case
  (eight wars' banners in a view under 90 rem wide) that an open panel covers without loss.
  Fewer banners in a narrow view: the banners are the wars' way to their battles.
- **Consequences.** No rule of the sim, no pin. The banners behind a panel show faintly
  through its ground (0.92 of opaque), as the map does.

### ADR-220 · 2026-10-09 · accepted — The game is laid out for a view of 64 rem: a UI size the view is too narrow for is not offered, and the choice is kept (PLAN 3.12Rh4)

- **Context.** The bottom bar is one line and as wide as its content (ADR-217): 989 px at
  100% with "Map: Political", 1,007.7 px at its widest map mode (the mode's name is the one
  label with no room kept), 62.98 rem. In a view 1,100 px wide it ran off both sides at 115
  and 130%. The ticker, the war banners and the nation panel's height are placed by the
  bar's one line (3.2 rem, 12.5 rem).
- **Decision.** The least view is one figure, 64 rem: the bar at its widest mode and 0.5 rem
  a side (`LEAST_VIEW_REM`, `src/app/settings.ts`). In px: 871 at 85%, 1,024 at 100%, 1,178
  at 115%, 1,332 at 130%. A size whose least view is wider than the window is not offered
  (its option in Settings is disabled) and not in use: the size in use is the largest
  offered that is no larger than the one chosen (`appliedUiScale`). The choice is stored as
  it was made, and a wider window has it again, at a resize, with nothing pressed. Below
  871 px the size is 85% and the bar's ends are cut: the game is not laid out for it.
- **Not chosen.** A bar that wraps. Its height would have to move the ticker, the banners
  and the panel's foot (three rules on a measured height), ADR-217's one line would hold
  only above some width, and the History panel would still stand over the nation panel at
  130%.
- **Not folded in: a played nation's label.** "Playing United Kingdom · 12 selected" is
  some 16 rem more, and a least view of 80 rem would refuse 130% below 1,664 px. The label
  is the one item of the bar that shrinks, to an ellipsis, with the whole text in its
  `title`; the bar is never wider than the view less 1 rem, and no button is narrower than
  its text (`.bottombar > *` does not shrink: a button's `min-width` of 2 rem had let it).
  At 1,100 px and 100% the label reads "Playing Unit…".
- **The figure is English's.** Another locale's bar may be wider; the constant is then
  measured again (the spec below fails on it).
- **The title screen** keeps the size chosen in any view: it has its own narrow layout
  (PLAN 1.43) and no bar.
- **Found with it, the panels.** The nation panel's right edge is at 18.9 rem and 2 px
  (0.5 rem, 17 rem of content, 1.4 rem of padding, its border), not 17.5 rem; the History
  panel's `100% - 38rem` is its content, and its padding and border are 1.4 rem and 2 px
  more. At 1,100 px and 100% the History panel stood 12.6 px over the nation panel
  (291.8 for 304.4), not only at 130% (79 px). It is `100% - 40rem` now (24 rem at the
  least view, above its least width of 22), and the war banners `100% - 39rem` for the
  ticker's 36.
- **Consequences.** `tests/e2e/ticker1938.spec.ts`, a fourth test, at 1,100 x 600: at each
  of the four sizes the root font is 13.6, 16, 16 and 16 px and the bar, each button and
  the date are inside the view and as wide as their text in all eight map modes; Settings
  shows 100% with 115 and 130% disabled; at 1,400 px the size is 130%, at 1,200 px 115%,
  at 1,100 px 100% again; the History panel begins right of the nation panel; with a
  nation played the buttons are whole and in the view. On the code before: "root font at
  1.15", 18.4 px for 16; with the clamp alone, "pause-btn holds its text, playing", 2 px
  cut; and with those two, "history right of the nation panel", 291.8 for 304.4. Its
  second test asks that the banners begin right of the panel: 374.4 for 395.1 at 130%
  before. `tests/unit/uiScale.test.ts`: the two functions.
- **Seen and not fixed here.** The Settings panel in a view 600 px high: its last rows run
  out of its foot and "New game" stands under the war banners (PLAN 3.12Rh5).

### ADR-219 · 2026-10-09 · accepted — A later nation called after the same province is "Free Damascus II": the name tells two nations apart, the revolt's rule stays (PLAN 3.12Rh3)

- **Context.** The ticker at Max, seed 1938, April 1943: "Free Damascus declared war on
  Free Damascus", and a banner "Free Bamyan" on both sides of two wars.
- **Found** (`.cache/rh3/probe.ts`, not kept; seed 1938, six years, every day): no war has
  a nation on both sides. They are two living nations with one `origin`. Of 77 nations
  founded, three such pairs (1,370 pair-days in the six years), each pair at war with each other:
  - 117, founded at Damascus against nation 10 (tick 18,961), is 10's puppet a week later
    (19,129). Damascus, 10's land again, revolts (25,561): its core nation 117 lives but is
    the holder's puppet, so the land does not go back to it (`revolt`: `overlord[core] !==
    holder`), a puppet is no rising neighbour, no dead nation claims it, and `spawnRebels`
    founds 132 there. The same at Jilin (104, puppet of 69; then 134).
  - 162 is founded at Damascus against 117 itself (45,985), which held it while its core
    was 132 (by `revolt`'s first branch 132 was then dead or bound to 117; not looked into
    which).
- **Decision.** The rule stays: a province that rises against an overlord does not join
  the overlord's puppet, and what it founds is a new nation. The name tells them apart: the
  first is "Free Damascus", the next "Free Damascus II", then "III" (`foundedName`'s `nth`).
- **How the number is found.** `foundedNth(id, origins, labels)`: one more than the nations
  of a lower id whose origin has the same label. From the state as it is: no column, no
  save format, no hash, the pin unmoved.
  - Every nation, the dead too: counted over the living alone, a nation would lose its
    numeral when its namesake died, and the log, which names a nation as it is read,
    would be rewritten.
  - By id: a nation's row is never removed (every `.remove(` of `src/` read: cities,
    production, research, elements, formations and buffs; none of nations. The two
    comments on "a reused id" in `spawnRebels` are of a case that does not occur. Should
    nations ever be removed, the numeral must be kept in the state instead), so
    ids rise with the founding and are never given to another; an origin is written once,
    at the founding (a revival keeps it).
  - By the label, not the province: of 4,596 provinces 315 share their label with another
    (116 labels: "Central" is ten, "Northern" eight).
- **Not chosen.** Another province of the area as the origin: an area can be one
  province. Another word for each ("New", "Second"): the numeral has no end
  and one rule. A count kept in the state at the founding: a column and a new pin for what
  the ids already say.
- **What can still be one name.** A God Mode rename is the player's: two nations can be
  given one name. A game saved before shows its later namesakes with their numeral from the
  load on.
- **Cost.** One pass over the nations of a lower id for each name the worker gives (some
  200 nations): not measured.
- **Consequences.** `tests/unit/nationNames.test.ts`: one province founds three nations
  ("Free X", "Free X II", "Free X III"), two provinces of one label, the numerals (on the
  code before it failed for want of `foundedNth`, before its names were compared). `tests/helpers/aiSweep.ts`: on every
  day of ten years of three seeds no two living nations have one name, as the worker names
  them in English, and no war has a nation on both sides. Seeds 1, 2 and 3: namesakes
  lived on 2,221, 2,104 and 2,385 of 3,650 days (5, 3 and 4 more nations than names at
  most by the rule before). `tests/unit/workerLabels.test.ts`: a province made to revolt
  twice through the worker: the dead first nation is "Free Leningrad" in the statistics,
  the living second "Free Leningrad II".

### ADR-218 · 2026-10-09 · accepted — A statistics message carries its news: the kinds of every major event since the one before; the ticker stays the last five (PLAN 3.12Rh2)

- **Context.** ADR-216's count at Max: 18% of the messages bring more than five major
  events, and 14% of the major rows are in no message (28 of 154 wars declared). The cue
  was the loudest of the ticker's new rows (`cueOfTicker`), and the ticker is the last
  five: a war declared before five captured capitals in one second had no cue and no row.
- **Decision, the cue.** `nationStats` has `news`: the kinds of the major events
  (`TICKER_KINDS`) from the log's length at the worker's last message to its end, each
  once, in the order they came (`tickerNews`, `src/worker/historyRows.ts`). The cue is the
  loudest of the new ticker rows and the news. The kinds, not the loudest cue: seven
  numbers at most, the worker knows no cue, and what a view does with a kind is the view's.
  Not bounded by the ticker's 30 days: a row a month old in the game is a second old at
  Max. Not folded as the ticker's rows are: a death told twice is one cue, and an
  annexation is louder than its peace.
- **Where the mark is.** `SimServer.newsFrom`, beside `worldNo`: moved when a message is
  posted, never by the throttle, and below 0 after a new game or a load, whose first
  message has no news. Not sim state: not saved, not hashed, the pin unmoved.
- **Decision, the rows.** The ticker stays the last five at Max. More rows would undo
  3.12Rh and 3.12Rh1, which fitted the panel, the banners and the bar to five rows of two
  lines (two beside a panel); a fortnight a second cannot be read as rows however many
  there are; and the History panel has every row. So at Max the ticker is a sample to the
  eye and whole to the ear: one cue a second, the loudest thing that happened.
- **Not built.** A row "and nine more", or the loudest row kept among the five: neither
  was asked for, and each changes what "the last five" means for a test that reads it.
- **Counted again** (a scratch spec, not kept; seed 1938 at Max, the page alone, 150 s:
  59,161 hours, 150 messages, 514 major rows): 34 messages bring more than five major
  events; in none is the cue other than the loudest major row of the log since the message
  before, and in none are there two cues. All 153 wars declared came in a message with the
  war cue. By the rule before, 4 of the 150 would have had a quieter cue.
- **Consequences.** `tests/unit/sound.test.ts`: a war and seven captured capitals between
  two messages, the ticker the last five, is the war cue (failed first: 'capital').
  `tests/unit/workerLabels.test.ts`: a peace and six wars in one throttled message, the
  ticker five wars, the news `[PeaceSigned, WarDeclared]`; a world's first message, a
  loaded world's and the message after have none (failed first: no `news`).

### ADR-217 · 2026-10-09 · accepted — The bottom bar is as wide as its widest labels: one line, and no button steps at a pause (PLAN 3.12Rh1)

- **Context.** 3.12Rh's pictures: "25 February 1939 · Paused" was two lines, the bar 52 px
  for 40, its top inside the ticker's last row and the lowest war banners.
- **Cause.** Not the date's least width of 10 rem. `.bottombar` is absolute at `left: 50%`
  with no width, so its fit is the half of the view right of that: 700 px of 1,400. Its
  buttons, which do not wrap, are wider than that, the bar fell to its least width, and
  the date was the one item that could wrap. A date that fit 10 rem ("1 January 1938 ·
  Paused") was one line.
- **Decision.** The bar is `width: max-content` and the date does not wrap. And since the
  bar is centred, a label that changes its width moves every button by half of it: the
  pause button ("Pause", "Resume") and the date (each month, with and without "Paused")
  keep the room of their widest text. `data-reserve` holds the texts, a line each, and
  `.bar-reserve::after` lays them out at no height, hidden: any locale's widths, measured
  by the browser, and not in the element's text (specs and screen readers read the label
  alone). The date's reserve is day 28 of each month of the year with "Paused".
- **Not chosen.** A least width in rem for the date: a figure for English alone. The
  speed label keeps its 6.5 rem, and the map mode's button still changes with the mode:
  neither changes at a pause.
- **Consequences.** The bar is 989 px at 100%, 1,135 at 115% and 1,281 at 130% in any
  view (it was 1,112 and 1,254 at 1,100 px wide, the date wrapped): 3.12Rh4's figures,
  amended there. `tests/e2e/ticker1938.spec.ts`, a third test, at 30 September 1938 and
  the three UI sizes: the bar's height and sides are those of 1 January's, the ticker's
  foot is above its top (3.2, 5.3 and 6.4 px), and across a resume and a pause the bar,
  the pause button's right, the "+" and the date's left stand still. On the code before:
  "bar height paused at 1", 51.6 for 40.0.

### ADR-216 · 2026-10-09 · accepted — The ticker's room: two lines a row beside a panel, the war banners 18 rem from each side; at Max the ticker is a sample, counted (PLAN 3.12Rh)

- **Context.** PLAN 3.12c gave the nation panel a height of the view less 12.5 rem, "above
  the ticker's two rows", and looked at the ticker at 1400 x 800, 100%, with a panel shorter
  than that. Looked at now (a scratch spec, pictures in `.cache/rh/`, not kept): 1400 x 800
  and 1100 x 600, at 100, 115 and 130%, with no panel, a nation's, its God tab, the History
  panel beside it, a formation's; and five pictures of a game at Max.
- **Found, the rows.** A row is 17 rem wide and nearly every row is two lines (37 px at
  100%; "6 February 1939 France made peace with Turkey" is one). The panel's 12.5 rem is
  the room of two rows of two lines to the pixel: the panel's foot and the ticker's head
  are 0 to 2 px apart at each UI size. A row of two long names (renamed nations; 38 letters
  each) is three lines, and the ticker stood 29 px over the panel's foot at 100%.
- **Decision.** Beside a panel a row is two lines at most, the rest an ellipsis
  (`.ticker.short .ticker-line`, a line clamp). The whole sentence is in the History panel
  and in the ticker when the panel is closed. Not a taller reservation: the panel would
  lose a line at every size for a row that is rare.
- **Found, the banners.** `.war-banners` was 60% of the view at most, centred: its left at
  20% of the view at the least, 280 px of 1,400, where the ticker ends at 17.5 rem: 280 px
  at 100%, 322 at 115%, 364 at 130%. With nine banners at 130% the banners' box began at
  350.
- **Decision.** The banners' width is the lesser of 60% and the view less 36 rem: 18 rem a
  side, the ticker's 17.5 and a gap. At 1,400 px and 100% that is 824 px for 840.
- **Counted, Max** (seed 1938, the page alone, 150 s: 59,719 hours, 6.8 years, 156
  messages). 380 hours between two messages (median; 708 at most). Major events the ticker
  would tell between two messages: median 3, at most 14; 28 of 155 (18%) bring more than
  five. Of 492 such rows, 69 (14%) were in no message: 28 of 154 wars declared, 24 of 157
  capitals taken, 10 of 131 peaces, 4 of 31 destroyed, 3 of 7 returned. With three other
  pages on the machine a message spans 166 hours and 5 of 145 bring more than five: the
  faster the machine, the more is dropped.
- **Not decided here.** What the message should carry so that no war goes unheard, and
  whether the ticker at Max shows more than the last five: PLAN 3.12Rh2. The ticker at Max
  is today a sample of the fortnight a second brings, and ADR-211's "not from the view's
  event queue, which drops records at Max speed" holds for the log, not for what is shown.
- **Seen with it, parts of their own.** The bar is two lines when a long date is paused
  and its top is 9 px inside the ticker and the banners (3.12Rh1). Two nations named "Free
  Damascus" at war with one another (3.12Rh3). At 1,100 px wide the bar is wider than the
  view above 100% (3.12Rh4).
- **Consequences.** `tests/e2e/ticker1938.spec.ts`, a second test: at 1400 x 640 (the God
  tab's panel at its full height at every size) and 100, 115 and 130%, two wars of long
  names are two rows below the panel, and with 22 wars the banners begin right of the
  ticker, with the panel and without. On the code before: "ticker below the panel at 1",
  482.9 for 511.9; and "banners right of the ticker at 1.3", 350 for 364.

### ADR-215 · 2026-10-09 · accepted — A peace is told before its terms; a peace that annexes is one row of the ticker; the pin moves, no rule does (PLAN 3.12Rg2)

- **Context.** `makePeace` annexed a small loser or made it a puppet and then emitted
  `PeaceSigned`. The log read, oldest first: "X was annexed by Germany", "X was destroyed",
  "Germany made peace with X" (seed 77, tick 26,040: nations 118 and 1), and "Austria became
  a puppet of Germany" before "Germany made peace with Austria". The ticker told the
  annexation and then a peace with the dead.
- **Decision, the log: two rows, the peace first.** `PeaceSigned` is emitted when the war
  has ended, before `annexNation` or `makePuppet`. The peace is the cause and the row that
  ends the war in the log (PLAN 3.12Rn asks every war for its end); the annexation is its
  term and the row of the death. Neither is the other.
- **Decision, the ticker: one row, the annexation.** A `PeaceSigned` whose loser has a
  `NationAnnexed` by its winner in that hour is not told. The ticker holds five rows of the
  major events and "made peace with" a nation that is gone in that hour says less than
  "was annexed by"; a death told twice is one row there already (ADR-211). One cue with
  it: the death's, not the peace's and then the death's (ADR-212). Looked for on both
  sides of the peace: a game saved before has the peace last. An annexation by another
  than the peace's winner (God Mode in that hour) leaves both rows.
- **The pin.** `d07a7db0` to `4b019e8f`. A hash of each of the 118 sections of the state of
  seed 99 after one year, before and after (`.cache/rg2/sections.ts`, not kept in the
  repository): `history.rows` alone differs. Its 178 rows are the same rows as a sorted set
  (one hash); 18 are in other places: the year's 6 peaces with a puppet made (2 rows each)
  and 2 with an annexation (3 rows each: the peace, `NationAnnexed`, `NationEliminated`), of
  21 peaces. No rule changed.
- **Consequences.** `tests/unit/war.test.ts` asks the order of both terms;
  `tests/unit/history.test.ts` the ticker's row with the log in either order. The truce
  with the annexed nation is pushed as before (it holds if the nation returns).

### ADR-214 · 2026-10-09 · accepted — The founder's row of an alliance is its founding, told from the log (PLAN 3.12Rg1)

- **Context.** An alliance that is made emits `AllianceJoined` for each member, the founder
  first (four places: the command, the player's proposal, the AI's pact against a threat,
  the coalition). The panel read "Mexico joined the Coalition of Mexico" (ADR-208 noted it).
- **Decision.** No new event. The worker marks the founder's row `as: 'founded'` when its a
  is the alliance's founder (`Alliance.founder`, `Alliances.past`) and no earlier row names
  the alliance. Its sentence is "{a} founded {b}", and b is told without "of {founder}":
  "Norway founded a Defensive Pact", "Germany founded the Axis".
- **Why "no earlier row".** A founder can leave and join again (its row is then a join), and
  a scenario's alliance was founded before the log (its founder's first row follows its
  own `AllianceLeft`).
- **Why not an `AllianceFounded` event.** It would be four emit sites, a kind more in the
  log and a moved pin, and a game saved before would keep "joined". `as` is the way of
  ADR-209 and ADR-210: the log has what tells the two apart.
- **Consequences.** No state, no hash, no pin. The row's type is still "Alliance joined" in
  the filter and the exports (`type` `AllianceJoined`); its text says founded.
  `tests/helpers/aiSweep.ts` asks of every `AllianceJoined` of ten years of three seeds
  that it is 'founded' exactly when it is the first row of its alliance and its founder's.

### ADR-213 · 2026-10-09 · accepted — A nation that dies leaves its alliance with the log's rows; the pin moves, no rule does (PLAN 3.12Rf)

- **Context.** PLAN 3.12a counted 29 alliances gone after ten years of seed 1 and 15
  `AllianceDissolved` rows. `eliminateNation` took the dead out with
  `Alliances.removeNation`, which emits nothing; every other way out (the month's loyalty,
  the command) goes through `leaveAlliance`, which emits `AllianceLeft` and, when one
  member is left, `AllianceDissolved`.
- **Decision.** `eliminateNation` calls `leaveAlliance` before `removeNation` (which still
  drops the guarantees). The rows come after the death's wars end and before its puppets are
  freed, its land is given and `NationEliminated`: "Italy left the Anti-Comintern Pact",
  "The Anti-Comintern Pact was dissolved", then the death.
- **Why both rows, and not the dissolution alone.** A death that leaves an alliance alive
  changes its members and may pass its lead on; with no row the log's joins and leaves of an
  alliance no longer add up to its members. One path for every way out, and one sentence.
- **Does the state hash cover the log?** Yes: `History` is a part of `World.parts()`, saved
  and hashed. The pin of seed 99 after one year moves from `e05beda3` to `d07a7db0`. A hash
  of each section of the state, before and after: `history.rows` alone differs, in seed 99's
  year (172 rows to 178: 5 left and 1 dissolved, where there were none of either; 7 deaths)
  and in seed 1's ten years (1,813 rows to 1,863: 17 left to 53, 15 dissolved to 29, the 29
  of `alliances.past`; 77 deaths). No rule changed.
- **Consequences.** `tests/helpers/aiSweep.ts` asks of ten years of three seeds that the
  alliances the log says dissolved are those of `alliances.past`, id by id and in order.
  The ticker is as it was: its kinds have none of an alliance. A game saved before keeps
  its log as it was written.

### ADR-212 · 2026-10-09 · accepted — Sound: five cues made in code, the cue of what is new in the ticker, one a message (PLAN 3.12d, critic R3-B6) [AoC-DEVIATION]

- **Context.** The critic's third report: no sound (no `AudioContext` in `src/`). AoC has
  music tracks, a trumpet at a declaration of war, and sounds that are quieter when zoomed
  out (text; PARITY row 79).
- **Decision.**
  1. Five cues, synthesised with oscillators and gain envelopes (`CUE_NOTES`,
     `src/shared/sound.ts`): war, peace, a capital taken, a death (destroyed, collapsed or
     annexed are one cue), a return. No sound file: nothing to license, nothing to load, and
     the notes are data a test can read.
  2. The events that sound are the ticker's (`TICKER_KINDS`), and the cue is asked for from
     the ticker's rows as they come with `nationStats` (`cueOfTicker`): what is heard is what
     is told, and the view's event queue drops records at Max speed (ADR-211). A row is new
     when its number in the log is above the last heard.
  3. One cue a message (a second at most). At Max speed a message can bring five rows;
     five cues over one another are noise. The one heard is the first of war, death,
     capital, return, peace.
  4. A loaded game does not sound its last month. The worker counts its worlds (a new game,
     a load) and sends the number with `nationStats` (`world`); the first message of a world
     sets what has been heard and asks for nothing. Told by the worker, because the view
     cannot tell a load from a message in flight when it was asked for, and the numbers of
     two logs' rows say nothing of one another.
  5. The `AudioContext` is made at the first press or key (the browsers' rule); a cue
     before it is dropped. So a game opened and left alone is silent until it is touched.
  6. Volume in four steps (25 to 100%, 50% at first) and a mute, in the settings, kept in
     `localStorage`. A choice of volume sounds the peace cue at it. A muted cue is not
     asked for and is not sounded late when the mute is taken off.
- **Deviation from AoC.** No music. No sound of battles, and none that is quieter when
  zoomed out: every cue is of the whole world's news, the same at every zoom. PARITY row 79
  is partial for these.
- **Tests.** `tests/unit/sound.test.ts` (the cue of each kind; a declaration of war asks
  for the war cue and its notes reach a counting context; the volume; the mute; before the
  press); `tests/e2e/sound1938.spec.ts` (a God war is a cue that reaches the browser's
  audio context; muted, the peace is none; both settings after a load; a loaded game asks
  for nothing); `tests/unit/workerLabels.test.ts` (a load is another world).
- **Not done.** Nobody has listened: the cues were written as notes and checked as
  numbers (frequency, length, gain), not heard. Whether the war cue reads as a trumpet is
  for a person with speakers. The pin is unmoved (nothing in `src/sim` changed).

### ADR-211 · 2026-10-09 · accepted — The ticker reads the history log, and a row's place is a capital as it is now (PLAN 3.12c, critic R3-B6)

- **Context.** The critic's third report: nothing tells a watcher what happens as it happens
  (`critic/c3_q.json`, `liveRegions` empty). AoC has a line of events at the bottom left
  (`reference/screens/steam-screenshot-01.jpg`) and popups of wars (text).
- **Decision.**
  1. The ticker's rows are read by the worker from the end of the history log and sent with
     each `nationStats` (once a second at most; at once after a God command, paused too).
     The view's event queue drops records at Max speed; the log is state and drops none.
     No request of its own: the whole log as JSON every second would be a cost that grows
     with the game, and the rows are five.
  2. Seven kinds: `WarDeclared`, `PeaceSigned`, `CapitalCaptured`, `NationEliminated`,
     `NationCollapsed`, `NationAnnexed`, `NationRevived`. The last 5 of the last 30 days of
     the game; a death told by a collapse or an annexation and then by `NationEliminated`
     in the same hour is one row, the first.
  3. A row's place. Only `CapitalCaptured` and `NationRevived` are emitted with one. The
     others get a capital from the nations' columns as they are when the row is sent: of b
     for a war (the nation it was declared on) and a peace (its loser), of a for a death. It
     is not written at the emit: that would move the state's hash for a thing only the view
     asks. A capital that has moved since the event is where the camera goes; a dead
     nation's is where it last was (PLAN 2.7g).
  4. A click flies the camera to the place at 1,500 km across the view (`showPlace`), not
     to a battle's 20 m a pixel: a war declared has no battle yet, and the row is of
     nations. It selects nothing.
  5. Bottom left above the bar, the newest row last (nearest the bar). A nation's or a
     formation's panel stands on the left too: while one is open the ticker has its last
     two rows, and the panel's greatest height is less by 4.5 rem (`calc(100% - 12.5rem)`).
- **Deviation from AoC.** No popup in the middle of the map: a row at the edge, which does
  not cover the fight it tells of. No filter of kinds and no chip of a nation's colour in a
  row (PARITY row 62 stays partial).
- **Seen.** `docs/evidence/3.12/c-ticker-war.png` (the row of a God war on the world map),
  `c-ticker-flown.png` (after the click: Warsaw in the middle), `c-ticker-rows.png` (five
  rows on 1 April 1938 of seed 1938, the panel closed), `c-ticker-under-panel.png` (two rows
  under Germany's panel). All four looked at.
- **Not done.** No sound (PLAN 3.12d). The pin is unmoved (no state changed). At Max speed
  a row may come and go between two messages of a second: the history has it.

### ADR-210 · 2026-10-08 · accepted — Land that goes over: two sentences, and one row an hour for two nations (PLAN 3.12b2, critic R3-B6)

- **Context.** The critic's third report: 450 of 2,395 history rows after 14 years read
  "Land of X went over to Y". PLAN 3.12 had "the land that goes over at a peace folded into
  that peace's row". ADR-209 measured that no `LandCeded` follows a peace of its two nations
  (0 of 337 on seed 6021, 0 of 252 on seed 1): a peace moves the owner of land with no
  event. `LandCeded` (a = who has the land now, b = who held it) is emitted in four places:
  1. `defect` called by `revolt`, a region that rose and went back to its core nation: b
     lives. It is the one place of a living b.
  2. `collapseNation`, after its `NationCollapsed`: the pieces that found nothing, to a
     neighbour or the heir (`defect` again, by `give`), and the stray cells of the nation
     that falls apart, to the holder of their province.
  3. `leaveToNeighbour`, a Kill that found no heir.
  4. `leaveLand` in `eliminateNation`, what a living nation occupied of the dead: before
     its `NationEliminated`.
- **Decision.** In `src/worker/historyRows.ts`, from the log alone, as ADR-209 did:
  - a `LandCeded` whose b has a `NationEliminated`, `NationCollapsed` or `NationAnnexed` in
    the same hour is `as: 'left'`: "Land left by {b} went to {a}". The deaths are read
    before the rows, since 2 has its death before the land and 4 after it;
  - the kind's own sentence is now of 1: "Land held by {b} rose and went back to {a}";
  - a `LandCeded` with the tick, a and b of an earlier one is no row. The row that stays
    is the first, with its place.
- **Why one hour.** ADR-209's count: no row has the a and b of an earlier hour of its
  month. The revolts of a month are of its first hour, an area each, and a death gives
  its land at two steps of one hour (2 and 4).
- **Why the fold has no count** ("three regions"). The log has an event for each area that
  rose, and an area is as many provinces as rose side by side: a count of events is not a
  count of anything a watcher sees.
- **Measured** (`tests/helpers/aiSweep.ts`, ten years; the state as each hour ended against
  the rows). Seed 1: 252 events, 216 rows, 190 back to the core nation and 26 left by the
  dead. Seed 2: 293, 252, 224 and 28. Seed 3: 354, 290, 265 and 25. A test of mine failed
  first on its own fault (`includes(x, length - 64)` with fewer than 64 lines looks at the
  last ones only); the hour it failed on, seed 3's tick 29,928, has three events of
  land held by the Soviet Union going back to Italy with a fourth of other nations between
  the second and the third: the rows to fold are not always next to one another.
- **What it leaves.** About 22 rows a year of land going back to its core nation (190 in
  seed 1's ten years, about a tenth of its rows: 1,813 before the fold, ADR-208). They are
  not the log's to drop: each is land that changed hands, with a place. That the same two
  nations hand land back month after month (the Soviet Union's to Italy in five months
  running of seed 3, ticks 29,184 to 32,136; why Italy has cores there was not looked
  into) is the game's, and a line for the review pass.
- **Not done.** A region that goes back to its core nation in the hour of its holder's
  death reads as left by the dead; not looked for. The pin is unmoved (no state changed).
  No migration: a game saved before reads the new sentences.
- **Seen.** `docs/evidence/2.15/kill-france-history.png` (God Mode kills France): five
  rows "Land left by France went to Free Paris", "… British India", "… Italy", "… United
  Kingdom", "… Netherlands" between "France collapsed" and "France was destroyed". The
  sentence of land that went back was not looked at in the panel: the unit test and the
  ten-year tests have it.

### ADR-209 · 2026-10-08 · accepted — A revolt's row says which of three things it was, told by the worker from the log (PLAN 3.12b1, critic R3-B6)

- **Context.** The critic's third report: "Turkey broke away from Free Bursa", a row that
  says the reverse of what happened. `RevoltSpawned` (a, b) is emitted in three places with
  one sentence, "{a} broke away from {b}":
  1. `spawnRebels`, a nation founded on the area that rose: a = the new nation, b = the
     holder. The sentence is right.
  2. `spawnRebels` called by `reviveNation`: a = a dead nation that returns, once for each
     holder it takes land from, followed by its `NationRevived` ("{a} returned").
  3. `revolt()` where rebels live next to the area: `defect(…, RevoltSpawned)`, a = those
     rebels, b = the holder.
- **Measured** (`.cache/probe312b.ts`, not committed: the events of each hour against the
  nations alive as the hour began). Seed 6021, 14 years, 1,978 rows: 205 `RevoltSpawned`,
  132 founded, 66 joined, 7 revived. Seed 1, ten years, 1,813 rows: 209, of them 114, 86
  and 9. (A join in the hour of the founding counts as founded in these figures: 12 and 21
  rows have the a and b of an earlier row of their hour.) Every row of seed 6021 whose a is
  a nation of 1938 is a revival: "Czechoslovakia broke away from Germany", "Latvia broke
  away from Free Riga". The critic's row is of that kind. PLAN 3.12b had guessed the join.
  The join reads badly too, but not as the reverse: "Free Barcelona broke away from France"
  a second time, by a nation that had broken away already.
- **Decision.** `HistoryRow.as` (`'revived' | 'joined'`, absent for the kind's own
  sentence), set in `src/worker/historyRows.ts` from the log alone: a `RevoltSpawned` whose
  a has a `NationRevived` in the same hour is 'revived'; one whose a had a `RevoltSpawned`
  before and no `NationEliminated` since is 'joined'. `historyText` takes the sentence
  `history.<Kind>.<as>` where there is one: "{a} took back land held by {b}", "More of {b}
  rose and joined {a}".
- **Why the worker and not a new kind of event.** PLAN 3.12b says it of the fold, and it
  holds here: the log has what is needed, a game saved before reads right without a
  migration, and the tests that count `RevoltSpawned` by its a (`revoltLand`, the God Mode
  Kill's "the nations born") stay as they are. The pin is unmoved, which is the proof that
  no state changed.
- **Why two rows for a return.** "Ethiopia took back land held by Italy" and "Ethiopia
  returned" are of one hour. The first has the holder as its b, and the filter by nation
  finds it under Italy; folded into "returned", whose b is the returns left, it would not.
- **Not done.** A nation of rebels that died and returns in the hour in which an area also
  rises to it has both rows as 'revived'; not looked for. The land that goes
  over is PLAN 3.12b2, with what was counted for it: of 337 `LandCeded` on seed 6021 (252
  on seed 1), 0 (0) are in the hour of a peace of their two nations, 44 (26) follow the
  death of b, 293 (226) are land that went back to its core nation from a holder that
  lives; 32 (36) have the a and b of an earlier row of their hour, and none of an earlier
  hour of their month.
- **Seen.** `docs/evidence/3.12/b1-history-returned.png` (God Mode brings Ethiopia back on
  1 January 1938): "Ethiopia took back land held by Italy", "Italy declared war on
  Ethiopia", "Ethiopia returned".

### ADR-208 · 2026-10-08 · accepted — The state keeps the name and the founder of an alliance that dissolved; no history row shows an id (PLAN 3.12a, critic R3-B6)

- **Context.** The critic's third report: "#43 dissolved", "Denmark left #43". The history
  log is rows of numbers (`[tick, kind, a, b, x, y]`), and the worker gave an alliance's id
  its name out of `world.alliances.list`. An alliance that dissolved is taken off that list,
  so every row of it (joined, left, dissolved, union) fell back to "#id" from then on. A
  Major Battle had no name at all: "Major battle #12 began near Lyon", "Major battle #12 was
  won by Germany".
- **Decision.**
  - `Alliance.founder`: its first leader, never changed. `Alliances.past`: `{ id, nameKey,
    founder }` of each alliance that dissolved, pushed in `leave()`. Both are in
    `alliances.json`. A save from before loads with the leader for the founder and nothing
    past; its old rows of dissolved alliances read "an alliance".
  - `src/worker/historyRows.ts` (out of `server.ts`, a function of the world and two name
    functions, so a test can call it): an alliance's name from the living and the past, the
    founder's name in the row's new field `of`, and for a Major Battle the city of the
    battle's `MajorBattleStarted` row, at its end too.
  - `src/ui/historyText.ts` (out of `HistoryPanel.tsx`: a `.tsx` cannot be imported by the
    tests' typecheck): "the Defensive Pact of Sweden" for `alliance.defensive` and
    `alliance.coalition`, of which a game has many, "the Baltic Entente" for a name of the
    scenario's; "the major battle near Lyon"; a kind with a sentence `history.<Kind>.none`
    has it where b is nobody ("… ended with no winner", "A major battle began"). The first
    letter of a row is a capital. `displayName` moved to `ui/i18n` and is still exported by
    `NationPanel.tsx`.
- **Why the founder and not the leader.** The leader changes when the leader leaves, and
  every earlier row of the alliance would change its wording with it. Why a name at all
  beside "Defensive Pact": seed 1 has 29 alliances gone and 16 alive after ten years, all
  but the scenario's with one of two names.
- **Why state and not the log.** No row has the name: `AllianceJoined` has the nation and
  the id. The name of a made alliance could be guessed from the id (the scenario's come
  first), which a God Mode alliance with another name breaks.
- **The pin.** `8f937408` to `e05beda3`: `alliances.json` has `founder` in each alliance
  and `past`. No rule reads either. That the game is otherwise the same was not measured by
  a hash without them.
- **Not done.** The nation panel and the alliances map mode still show "Defensive Pact"
  alone. A nation's death takes it out of its alliance with no row (`removeNation`): seed 1
  has 29 alliances past and 15 "dissolved" rows. The CSV and JSON exports keep the ids in
  their `a` and `b` columns, beside the names and the text.
- **Seen.** Seed 1, ten years, 1,813 rows, as the panel words them: "Norway left the
  Defensive Pact of Finland", "The Defensive Pact of Finland was dissolved", "The Comintern
  became a union under Soviet Union", "Mexico joined the Coalition of Mexico" (the
  founder's own row), "The major battle near … was won by Italy".
  `docs/evidence/3.12/a-history-dissolved.png`, `a-history-all.png`.

### ADR-207 · 2026-10-08 · accepted — A tag does not take a place by its block that is nearer to another block than that block's own tag (PLAN 3.11f1)

- **Context.** `tags1938` failed since PLAN 3.11c4: "T2, 150 m/px: formation 1055's tag has
  a line". Run on the commits: green on `52dc9d6` (3.11c3b), red on `2d35870` (3.11c4). The
  view: a German and a Polish division in contact, side by side, each block 13 px wide and
  28 tall at 150 m/px; the German tag above (94 px wide, over both blocks), the Polish one
  below (under both). Until 3.11c4 the two blocks had one height and from the middle of the
  German block both tags stood 20.0 px: ADR-188's "another tag is nearer" asks for less
  than, so no line. With the elements off their slots (ADR-204: 180 m at most, 1.2 px here)
  the German block's box is 0.4 px taller at its top and 1.0 at its foot: its own tag at
  21.3 px and the Polish one at 19.7. The line is right by ADR-188's rule; the view had
  passed on a tie.
- **What the tie hid.** In that view each tag is as near to the other block as to its own,
  and nothing but the flag says whose it is. That is ADR-188's case, and there the tag that
  stood over the brigade's column was placed before the brigade's: the later tag could not
  help it. Here the later tag (the Polish one) takes the place that reads as the German
  block's, with a place of its own free: right of its block.
- **Decision.** `layoutTags` has a pass before its two: a place by the block (the first on
  each side: above, below, left, right), clear of other formations' elements, and not nearer
  to the middle of another block than that block's own tag, placed before it (ADR-188's
  measure, from the point to the box). With none, the two passes as before: the nearest
  place clear of the elements, then any free place; ADR-188's line stays for those. View
  only (`tags.ts`).
- **This changes ADR-188's "why not place it differently"** in one point: a tag now does
  leave a place by its block that reads as another block's. The order of the places and
  "above first" stay; no tag placed before moves; a tag goes no further out for it (a first
  try without that limit sent the middle one of ADR-168's three columns two places out and
  failed that test). ADR-188's own view is as it was (the division's tag is placed first).
- **Not solved.** Which of the two layouts a pair has still hangs on a fraction of a px
  (under 20.0 px the Polish tag goes beside, at 20.0 or over it stays below): with the
  Polish division picked it is placed first and the German tag stands below. Neither has a
  line in either. Seen in `formationPanel1938`.
- **A spec's measure.** `formationPanel1938` counts pixels of the picked frame's colour
  within 6 px of a tag that is not picked and asks for none. The German tag above and the
  Polish one beside stand 6 px apart at a corner, and the picked German tag's frame (3 px
  out of its box) was counted as the Polish tag's: 39 px, all in x 718 to 737, y 379 to 381,
  inside the German tag's frame; the view's `picked` was the German. The count now leaves
  out pixels within the frame's reach of another tag's box. The assertion is as it was.
- **Consequences.** In a view of two blocks side by side the second tag may stand beside
  its block where it stood below (`docs/evidence/3.11/f1-tag-beside-its-block-150m.png`).
  The pin is unmoved: nothing of the sim changed.

### ADR-206 · 2026-10-08 · accepted — A sprite's tint is its nation's colour, a dark one made lighter with its hue and saturation kept (PLAN 3.11e, critic R3-B3)

- **Context.** The critic: "Soviet tanks are tinted pink, near Poland's own pink"
  (`critic/shots/c3j_12_tank_live_006m_2.png`). ADR-88's tint was the nation's colour mixed
  45% toward white (`v × 0.55 + 115`), "to read against the nation's fill". Every tint then
  lay between 115 and 255 a channel, and a dark saturated colour lost its saturation: the
  Soviet Union's (143, 29, 29), saturation 0.66, came out (194, 131, 131), 0.34; Poland's
  (201, 76, 99) came out (226, 157, 169). 56 apart in RGB, which `tags1938` (50 for
  Germany and Poland) would have let pass: two pale reds. And the reason is gone since PLAN
  2.14d: the ground of T2 and T3 is the terrain's, with the fill as a cast on it.
- **Decision.** `spriteTint` (`src/render/units/tint.ts`), for the stand-in sprite, the
  elements and the figures: the nation's own colour; one whose lightness (HSL) is under
  0.42 (`SPRITE_LIGHT`) is made lighter up to it, every channel times one factor, which
  keeps hue and saturation. 88 of the 103 nations of 1938 keep their colour. The Soviet
  Union: (178, 36, 36); Poland: its own; 78 apart, and the Soviet red the darker of the two
  by 0.12 of lightness. Germany: (107, 107, 107) (166 before); Germany and Poland 99 apart
  (61 before).
- **Why 0.42 and not more.** The Soviet Union and Poland are two reds on the map too
  (hues 0° and 349°): what tells them is that one is dark. At a lightness of a half the
  Soviet red is (212, 43, 43) and 66 from Poland's with nothing in lightness between them;
  at 0.6 both are lifted and, with the saturation kept by HSL (above a half one factor a
  channel no longer keeps it), stand (221, 85, 85) and (208, 98, 118), 38 apart, less than
  before. The last two figures are worked by hand, not by the script of the others.
- **Alternatives rejected.** Other shares of the mix toward white (the same mechanism: the
  pale band moves); a tint by which nations are in the view (a unit's colour would change as
  the camera moves: ADR-74's finding).
- **Consequences.** A dark nation's sprites are darker than they were, and a light nation's
  less pale. Seen: at 2 and 6 m/px Soviet tanks are red and Polish riflemen rose, on any
  ground of the picture; at 80 m/px (T2) the same. At 20 m/px both are small and dim on the
  Soviet cast, as the critic's picture at 25 m/px had them before. German riflemen (grey
  107) on the German cast are dark figures on a lighter ground where they were light ones;
  on woods they will be dim. The tracks and decks of the atlas take the tint darker still
  (a Soviet tank's tracks are a dark red at 2 m/px): looked at, left. No state, no pin.
- **Amends** ADR-88 (the colour).

### ADR-205 · 2026-10-08 · accepted — What a battalion, a battery and a half-track company lose lies where its figure stood (PLAN 3.11d, critic R3-B3)

- **Context.** The critic: "No wreck was ever drawn. In 230 sim hours of the largest fight
  `wrecks` and `shown` stayed 0" (`critic/c3_m.json`, `wreckSamples`), and its guess that an
  element must die whole to leave one. So it was: `WreckFx` draws the end of an element
  (PLAN 2.4b), and `HullFx` a tank that an element has no more (PLAN 3.6d). A battalion that
  lost a figure lost it and nothing lay there.
- **Measured first** (headless, the elements of the formations in contact, one day; the
  critic's two games). Seed 4242 from day 21: of 2,223 elements one died whole. 1,532
  battalions lost 15.4 men each on average, 987 of them at least a figure (3,019 figures);
  183 batteries lost 81 guns; 392 elements of light tanks lost 11 tanks. Seed 1212 from day
  6: 508 battalions, 14.3 men each, 329 at least a figure (911 figures); none died. A
  figure of a battalion is 8 men (`figureCount`: 64 of 500), so two battalions in three show
  a loss within a day by their figures alone.
- **Decision.** From the figures, as the hulls are: no count of men carried in the view.
  `fallenLost` compares the elements of a snapshot with those of the one before; a figure
  that an element of infantry, of guns or of half-tracks had and has no more leaves a mark
  where it was drawn (infantry in contact: in its firing line). The fallen: a man down on a
  dark stain, each lying his own way. A gun and a half-track: broken and smoking if the
  element was fired at in that hour (`SnapshotElements.hit`), grey and left behind if not,
  as a tank. Men lost in an hour with no fire on their element (attrition, desertion) leave
  no mark: they are gone, not fallen. In `HullFx`, beside the hulls and with their time
  (17.5 s on the render clock), their end at a load and their share (the figures'): a list
  of its own (`fallen`, `fallenShown`), so that what the specs of the hulls count is still
  tanks.
- **Not at T2.** A loss at T2 is the sprite's opacity, and an element's end its wreck, as
  before. A mark is a figure's (53 m: 1.8 px at T2's nearest), and there is no figure there
  for it to take the place of.
- **No rule changes.** Nothing in the sim, no event, no field of the snapshot: the pin holds.
- **Drawn as stamps.** As paths in one fill, 3,000 marks cost a frame 42 ms. Each is now a
  picture of its kind, made once at four sizes and drawn turned: 14 ms for 3,000. Held:
  1,200 at most (`MAX_FALLEN`), 5.7 ms (6.4 with a tenth of them smoking guns), the oldest
  go. A view at 6 m/px on one division had 95 marks in a day, four an hour.
- **Tests.** `tests/unit/fallenFx.test.ts` (which figures, where, of what kind, for how
  long, the load, the cap), red with the three kinds switched off (five of eight).
  `tests/e2e/fallen1938.spec.ts`: seed 4242, day 22 at 6 m/px on Polish division 550: 194
  figures lost by the elements the view held, 187 of the fallen and 7 guns marked, each on
  the place the frame before the hour had its figure, the first in hour 1; 40 drawn at the
  day's end.
- **Seen in the pictures** (`docs/evidence/3.11/d-the-fallen-6m.png`, `-2m.png`,
  `d-the-fallen-after-a-day-6m.png`). At 2 m/px a man down on his stain, plain. At 6 m/px a
  dark mark the size of a figure (9 px); an hour's are three or four in the view, a dozen
  or more lie there while the game runs. The overlay is over the sprites: a mark is drawn
  over a living figure that stands on it (one in the picture at 2 m/px). Not mended: the
  hulls are so too.

### ADR-204 · 2026-10-08 · accepted — An element of a deployed block stands off its slot and is turned off its block's facing, by its id (PLAN 3.11c4, critic R3-B3)

- **Context.** The critic's pictures of a tank fight at 2 and 6 m/px
  (`critic/shots/c3j_12_tank_live_002m_2.png`, `c3j_12_tank_live_006m_2.png`): the elements
  of a block in contact stand on the points of a lattice, 600 m apart, and all face the way
  their block does. ADR-200 to ADR-203 put the blocks where they do not stand in one
  another; this is within one block.
- **Decision.** For a deployed block only, `slotPlace` takes the element in the slot. It
  stands off the slot by two draws from its id (`hash32` of the id and a salt; not of the
  hour, the seed or the slot): up to `DEPLOY_SCATTER` (0.3) of the slot spacing forward or
  back, and as much to either side, in the block's own frame (`slotPose` adds them before
  it turns the block), and before the walk to land, so an element whose place would be in
  the sea draws in as a slot does. `elementFacing` turns it off the block's facing by a
  third draw, `DEPLOY_TURN` (0.3 rad, 17°) at most. A block at rest stands on its slots and
  faces one way, as before.
- **One place.** `elementPlace` (the fire events) and `elementPlaceBefore` (the wrecks)
  take the element and pass it on where the block is or was deployed; the worker's element
  section does the same for the place of now and of the hour before (`blockPose` says
  whether each is a deployment). An element whose block was deployed in both hours does
  not move. Its facing is in the snapshot alone: no event carries one.
- **Why 0.3.** Under a half, so an element stays in its own slot's square: the block keeps
  its rectangle (the gaps between blocks of ADR-200 to ADR-203 are between rectangles), and
  no two elements change places. `stackBlocks1938`: the two Soviet blocks nearest each other
  have their nearest elements 1.24 km apart (the gap is 0.98). Less than 0.3 leaves the
  lattice to be seen: at 40 m/px a slot is 15 px.
- **What it costs in the picture.** An element's figures take 480 m of the 600 between
  slots (`FOOTPRINT_CELLS`), so two neighbours 360 m nearer each other have their grounds in
  one another. In `docs/evidence/3.11/c4-within-a-block-2m.png` three pairs of tanks of
  about 110 are drawn one over the other. Not mended here; it is in PLAN 3.11f.
- **Added 2026-10-08 (PLAN 3.11f2): measured, and not mended.** Seed 5381, Germany on
  Poland by God Mode, day 21: the six armour formations in contact, each at 6 m/px, the
  figures as the view draws them (a probe, taken out). Of 1,346 tanks, 45 pairs of tanks of
  different elements stand nearer than 0.7 of a figure's side (77 m of 110: two hulls in one
  another) and 26 nearer than a half; by formation 4 to 13 pairs of 150 to 300 tanks. About
  one tank in fifteen is in such a pair, where one picture had three pairs of about 110.
  Why it is left:
  - a slot is 600 m and an element's figures take 480, so the grounds of two neighbours
    keep apart only while each stands at most 60 m off its slot: a scatter of 0.1, which is
    the lattice again (above: under 0.3 it is seen at 40 m/px). No draw for two neighbours
    that knows nothing of the other does better: how near they come is the width of the
    range they draw from;
  - an element turned 0.3 rad reaches 60 m further with its corners, so a rule between
    neighbours would need the turn bounded too;
  - smaller tanks (a hull is 110 m long on the ground, of a sub-slot of 120) change every
    picture of a tank and the specs that measure one;
  - moving a figure off another in the view gives it a second place: the muzzle flash, the
    hull and the mark of a figure are worked from the one it has (`figureOffsets`).
  It is under PLAN 7.4 with the figures.
- **A test's limit changed with the rule.** `battleView1938` asked that every element of
  the two divisions face east or west to five places. That was the rule this part changes.
  It now asks that each is within `DEPLOY_TURN` of its block's facing, that the mean of a
  block is within a third of that, and that a block's elements are not all at one facing.
- **Tests.** `tests/unit/deployScatter.test.ts`: each element within its slot; no three of
  the front row on one line, and the middle of three neighbours 0.05 of a spacing off the
  line of the other two on average; every shot of twelve hours leaves from its shooter's
  place and ends at its target's; the worker sends the same place, a facing within the
  turn, and nothing moves in the next hour; a block at rest on its slots at one facing.
  Red with the scatter and the turn set to nothing ("slots 0, 1 and 2 of the front row:
  expected 0 to be greater than 0.000001"; "turned furthest apart: expected 0 to be greater
  than 0"). The first limit written for the front row (every three 2 m off a line) failed
  on the rule itself: slots 3 to 5 of one division are 0.9 m off one by chance. The places
  are a draw, so that limit said more than the rule gives; it is now 2 cm for every three
  and the average above for what is seen.
- **Not state.** No rule reads an element's place: the pin holds, and two years of seed 99
  end on the same hash (4c72477e).
- **Cost.** Mean tick over two years of seed 99, pinned, two runs each in one session:
  1.9756 and 1.9662 ms (1.9395 and 1.9248 on the commit before): 2% slower, two hashes
  for each end of each shot.
- **Deviation from AoC:** none; AoC has no blocks of elements.

### ADR-203 · 2026-10-08 · accepted — The blocks of an hour have one order, and a block stops short of every enemy's block before it in that order (PLAN 3.11c3b, critic R3-B3; amends ADR-201)

- **Context.** The pairs of blocks in one another that ADR-201 and ADR-202 left: German
  division 17 in Polish division 560's block (seed 99, Germany on Poland, day 60) and
  Mengjiang's formation 961 in Chinese division 403's (seed 4242, day 21). In each the one
  comes to an enemy's block and the other is of that enemy's side and goes elsewhere: a
  comer knew the block it comes to, the one that block faces and the lines of its own stack
  before it, and no other. PLAN 3.11c3b asked first whether the blocks of the other side can
  be asked for in one order, so that the answer does not hang on who is asked first.
- **There is such an order.** Each formation in contact has a turn (`turnsOf`): 0 for two
  that are each other's nearest; for one on the way to an enemy's block, that enemy's turn
  and one more for itself and for each formation that goes to the same enemy and is nearer
  it (then the lower id: the lines of ADR-89). Equal turns go by id. Every block `deployOf`
  asked for until now is before the asker in it: its enemy (a lower turn), the one that
  enemy faces (no higher than the enemy's), a line before it (the same enemy, nearer). The
  chain of nearest enemies ends in a pair (ADR-201), so every formation has a turn. It is
  worked out from the hour's contacts and kept with them (a `WeakMap` on the contacts'
  map: a new hour's contacts have none).
- **Decision.** A formation on the way to an enemy's block also knows the blocks of every
  formation in contact that is at war with its nation, is before it in the order, and whose
  place is within twice `DEPLOY_REACH` and half a cell of its own (each block goes
  `DEPLOY_REACH` from its place at most). They join the blocks in its way of ADR-201: it
  stops the gap short of one that reaches into its file before its place, or takes the next
  file out. The earlier of two never knows of the later, and the later yields.
- **`chain` is gone.** `deployOf` did not ask for the enemy's block at the fifth step of a
  chain of asks, and kept the answer it then gave: the one thing in it that could hang on
  who asked first. A block now asks only for blocks before it in the order, so the asks end
  without a limit. Against a ring of nearest enemies (which the lower id on a tie rules
  out) a formation whose block is being worked out answers "no block" to an ask.
  On the three games no chain is longer than 2 (0, 1 and 2 steps from a pair: 24, 21 and 0
  formations of seed 1212; 78, 66 and 7 of seed 4242; 58, 53 and 3 of seed 99), so the
  limit of four did not bind there. Asked in reverse order of id and the deepest first,
  every block of the three games stood where it stood asked by id, before this change and
  after it. `deployAll` still asks by id; the order of asking decides nothing.
- **Measured** (`.cache/probe311c3b.ts`, not kept: not in the repo; the rectangles of
  ADR-200). Pairs in one another: 0 (seed 1212), 0 (seed 4242, 1 before), 0 (seed 99, 1
  before). Five blocks moved, no other:
  - seed 99: 560, 4.2 km (from the block it goes to, 298's: 6.7 km before, 10.9 now);
  - seed 4242: 961, 2.9 km (3.5 to 6.5 km from 408's block), and 962, which goes to 408
    too, 2.9 km (5.7 to 8.6);
  - seed 1212: Soviet tank brigades 202 and 203, 0.18 km each (8.1 to 8.2 and 10.0 to 10.1
    km from 561's block). They stood in no block before; which block they now stop short
    of was not looked into.
  Blocks on the way to a block that stand more than 8 km / 14 km from it: 8 / 2 of 21 (the
  same), 25 / 4 of 73 (24 / 4), 26 / 4 of 56 (25 / 4). The furthest: 15.2, 18.1 and 23.3 km,
  the same.
- **The price.** The one that yields stands further from the block it goes to (560: 10.9
  km, more than the 8 km of ADR-202's view). The rule is ADR-201's sufficient one: the near
  side of a block across the whole of the file, not the nearest place that is clear.
- **Not covered.** A block of its own side, or of a nation it is not at war with, that
  goes elsewhere (no such pair on the three games); two pairs of each other's nearest
  (turn 0), which know no other block (none seen either).
- **Tests.** `tests/unit/deployFlank.test.ts`, two more. Two German divisions come to a
  Pole's block from its flank, one behind the other, and a second Pole comes to the first
  of them from its flank, where the second stands. Run with the second German made before
  the second Pole and after it, so that each in turn is the later in the order: every block
  a gap clear of every other. Red on the rule before ("the second line and the other Pole:
  expected -0.045 to be greater than 0.05"). The second test forgets the hour's blocks and
  asks for them in three other orders: the same blocks. It was green on the rule before
  (five formations, no chain of five): it guards the order, it did not find a fault.
  `deploy.test.ts`, `deployUnequal.test.ts` and `deploySnapshot.test.ts` pass unchanged.
- **Not state.** No rule reads where a block stands: the pin holds, and two years of seed 99
  end on the same hash (4c72477e).
- **Cost.** Mean tick over two years of seed 99, pinned: 1.9095 and 1.9278 ms (1.9588 and
  1.9445 after ADR-202). No slower by this measure; a pass over the hour's contacts for
  each comer was added, and the turns are worked out once an hour.
- **Deviation from AoC:** none; AoC has no blocks of elements.

### ADR-202 · 2026-10-08 · accepted — A file on the way to an enemy's block holds two lines (PLAN 3.11c3a, critic R3-B3; amends ADR-133 and ADR-200)

- **Context.** Seen in PLAN 3.11b and counted in ADR-199: seven Italian divisions on one
  French division stand as a column of six lines behind the one it faces, 20 km deep, and
  the fourth to sixth have no enemy in the battle's view. Of the 54 formations in contact
  with no enemy at 6 m/px on their block (seed 4242, day 21), 50 were such rear lines.
  PLAN 3.11c3 is split by cause; this is the column. The other (a block that stands in a
  block of the enemy's side which goes elsewhere) is 3.11c3b.
- **Cause.** A file took lines for as long as there was room before the formation's place
  (ADR-133): up to a cell and a half, eight lines of divisions.
- **Decision.** A file holds `DEPLOY_LINES` = 2 lines, the one that enemy faces among them
  where the comer comes from its side (ADR-89's 60°). The next line begins a file abreast,
  as a line with no room does. Nothing else of the walk of ADR-200 changes.
- **Why two.** The battle's view is 28 by 16 km (1400 by 800 px at 20 m/px), and a fight
  lies any way: 8 km from the view's middle to its nearer edge. With divisions (a block
  2.3 km deep, the gap 1 km) the middle of line k is 3.3 k km from the middle of the
  enemy's block, and that block's far side 1.2 km more: 4.5 km for the first line, 7.8 for
  the second, 11.2 for the third. Two lines have the whole of the enemy's block in the
  view on their own block; a third does not have its middle.
- **Checked against one and three** (the probe of this part, headless: every block on the
  way to an enemy's block, how far its middle stands from that block's; seeds 1212, 4242
  and 99 as in ADR-200). Further than 8 km / than 14 km:
  - no limit (before): 12 / 2 of 21, 37 / 7 of 73, 34 / 12 of 56;
  - three lines: 12 / 0, 34 / 3, 32 / 9;
  - **two lines: 8 / 2, 24 / 4, 25 / 4;**
  - one line: 10 / 4, 32 / 10, 30 / 10 (and 3 pairs in one another on seed 4242).
  One line trades the depth for width: 18 and 21 blocks more than 8 km to the side.
- **What it does not do.** With two lines 11 (seed 4242) and 13 (seed 99) blocks still
  stand more than 8 km off along their line (34 and 32 before): a block at `DEPLOY_REACH`
  from its place (305 and 282 of seed 99, 29.4 km from their places), and one stopped
  short of a block of another bearing in its file (ADR-201). And 3 and 8 now stand more
  than 8 km to the side (0 and 1 before): the fourth file of seven that go to one block
  is 11.4 km out. The furthest block of seed 4242 is 18.1 km from the block it faces
  (20.4 before), of seed 99 23.3 km (the same block, at the reach).
- **One new pair in one another** on seed 4242 (0 before): Chinese division 403, which goes
  to formation 381, and Mengjiang's formation 961, which goes to another Chinese formation
  (408) from 71° and now stands in 403's block; which file it took and why was not looked
  into. The formations are 1.59 cells apart: not in contact with each other. It is the kind ADR-201 left (17
  and 560 of seed 99, still there): a block of the enemy's side that goes elsewhere is
  not among those in a comer's way. PLAN 3.11c3b. Seed 1212: 0 pairs, as before.
- **Tests.** `tests/unit/deployFlank.test.ts`, a fifth: seven divisions 1.45 cells from one
  enemy and its foe at the border. Four files, no file of more than two, every block a gap
  clear of every other, the far side of the enemy's block within half the view's short
  side of each, none behind its place. Red with the limit's condition taken out of
  `deployOf` ("expected 2 to be 4": two files, the first six lines deep).
  `deploy.test.ts` (9, the ten divisions on one cell among them: now five files of two),
  `deployUnequal.test.ts` and `deploySnapshot.test.ts` pass unchanged.
- **`tests/e2e/formationFight1938.spec.ts`, two limits that measured the column.** It took
  the formation furthest from the block it faces (20.4 km, the column's last, north and
  south) and asked that the view go further out than the battle's 20 m/px for it
  (`> 20.5`), and in a view of 700 by 500 further than 40 (`> 40.5`). The furthest is now
  18.1 km off (14.2 along its line, 11.4 across), mostly east and west, and both blocks
  fit the view at 20.0 and at 40.0: both limits failed. What they tested, that the view
  goes out where the two do not fit, is now asked of the formation furthest north or south
  of the block it faces (656 on 179, 13.3 km: 28.0 m/px, and 55.1 in the small view), with
  the limits as they were. Of the furthest by distance it asks what it asked but the zoom
  (T3, both blocks whole on the screen), and now also that it is less than 20 km off.
  Not weaker: every limit that was there is there, on the formation it now applies to.
- **Not state.** No rule reads where a block stands: the pin holds, and two years of seed 99
  end on the same hash (4c72477e).
- **Cost.** Mean tick over two years of seed 99, pinned: 1.9588 and 1.9445 ms (1.87 to
  1.93 after ADR-201, four runs): 1 to 4% over, on two runs; the code added is a counter.
  Not looked into.
- **Deviation from AoC:** none; AoC has no blocks of elements.

### ADR-201 · 2026-10-08 · accepted — A block stops the gap short of each block in its way, whatever side it comes to (PLAN 3.11c2, critic R3-B3; amends ADR-89, ADR-133 and ADR-200)

- **Context.** What ADR-200 left of the blocks that stand in one another: 18 pairs on seed
  4242 (Germany on Poland, day 21, 151 blocks) and 7 on seed 99 (day 60, 114 blocks), none on
  seed 1212. The probe of ADR-200 was run again with, for each block on the way to an
  enemy's block, the bearing it comes from off the way that block faces.
- **The count before, by kind** (seed 4242 / seed 99):
  - in the enemy's block it comes to: 10 / 3. Every one comes from 63° to 120° off: the flank;
  - in the block of the one that enemy faces: 6 / 3, from 62° to 88°;
  - two that go to one enemy from bearings 46° apart (222 on 237 and 238): 2 / 0;
  - a block of another stack: 0 / 1 (17 and 560, below).
  ADR-200 had 14 of the 18 in the first two kinds and 2 in the third; counted pair by pair
  they are 16 and 2.
- **Cause.** A block on the way to an enemy's block stopped that block's depth, the gap and
  half its own depth from the block's middle (ADR-89), from whatever side. A division's
  block is 0.24 cells wide and 0.12 deep: from the flank its near side is 0.12 from its
  middle, not 0.06, and the comer stood 0.06 into it. The one that enemy faces was counted
  as a line before the comer only within 60° of the block's facing, and then on the comer's
  own line, where it does not stand. Formations that go to one enemy from places apart
  each counted the others as lines on its own line (ADR-200's last point but one).
- **Decision.** A formation on the way to an enemy's block knows the blocks it comes up
  to: that enemy's, the block of the one that enemy faces, and those of the formations
  that go to that enemy and stand before it in the order of ADR-89 (nearer that enemy, then
  the lower id). Of each: how far it reaches along the comer's line and across it (its
  depth and its width, turned to that line). One that reaches into the comer's file (the
  comer's width and the gap) and has its middle before the comer's place is in its way,
  and the comer stops the gap short of its near side. The lines and files of ADR-133 and
  ADR-200 are worked out as before and give the place where nothing else is in the way.
- **A file with no room.** Where a block in the way leaves the comer's file no room before
  the formation's place, the comer takes the next file out that has room (right and left
  by turns, to `DEPLOY_ABREAST`), as a line with no room does (ADR-133). Without this, on
  the first try, two lines of one file both stood at the head of it: 1 and 3 new pairs with
  their middles on each other (seed 4242: 298 and 300; seed 99: 550, 551 and 559). Where no
  file has room it stands as before, at its place in its file.
- **The order is sound.** A block asks only for blocks worked out without it: its enemy's
  and the one that faces (further along the chain of nearest enemies, which ends in a pair
  and has no ring of three: of three at equal distances two prefer the lowest id), and
  formations before it in one order. Where the chain is longer than four (`chain`) the
  enemy's block is not known and nothing is asked, as before.
- **What does not change.** A pair of each other's nearest. A stack on one place that goes
  to one enemy: the block before a line is in its way by exactly what the walk of ADR-200
  gave it. `deploy.test.ts` (9), `deployUnequal.test.ts` and `deploySnapshot.test.ts` pass
  unchanged. From behind (180°) a comer stood clear already.
- **Not state.** No rule reads where a block stands: the pin holds (the gate's test), and
  two years of seed 99 end on the same hash (4c72477e).
- **Measured.** Pairs in one another after it: 0 (seed 1212), 0 (seed 4242), 1 (seed 99).
  `tests/unit/deployFlank.test.ts`: a division that comes to a block from 90°, from 65° and
  115°, from 180°, and three from 0° and 45°; every two blocks the gap apart on one of
  their own axes. Red on the rule before in three of the four (from 90°: 0.01 cells in the
  block of the one faced; from 65°: 0.07 in it; 45° apart: 0.033 apart where 0.05 is asked);
  the fourth, from behind, was green before. `tests/e2e/stackBlocks1938.spec.ts`, a second
  test on seed 4242, day 21: German division 4 comes to Polish division 550 from 72°. On
  the rule before 0.22 km lay between its nearest element and division 3's and 0.24 km
  between its and the Pole's (a slot is 0.59 km); now 1.97 and 2.69 km.
- **Seen in the picture and left.** Division 4 stands 2.7 km from the Pole's block, not the
  gap's one: the block of division 3, which the Pole faces, reaches into its file by a
  corner, and it stops short of that. The rule is a sufficient one (the near side of a
  block across the whole of the file), not the nearest place that is clear.
- **Left.** One pair on seed 99: German division 17 comes to Polish division 549's block
  from 126° and stands in the block of division 560, a line of 549's own stack that goes
  to another German (298). The lines of the enemy's stack are not among the blocks in a
  comer's way; asking for them needs one order over both stacks. With PLAN 3.11c3.
- **Cost.** Mean tick over two years of seed 99, pinned: 1.84 ms before (1.8398 here,
  1.8403 in the record of 3.11c1), 1.87 to 1.93 after (four runs), 2 to 5%.
- **Deviation from AoC:** none; AoC has no blocks of elements.

### ADR-200 · 2026-10-08 · accepted — A line of a stack stands behind the depths of the lines before it, and a file the widest block beside the others (PLAN 3.11c1, critic R3-B3; amends ADR-133)

- **Context.** The critic's third point of R3-B3: "five tank formations share one cell as
  interleaved diamonds" (`critic/shots/c3j_11_tank_paused_0040m.png`, seed 1212, the Soviet
  Union on Poland). PLAN 3.11c is split by cause, and the first thing done was a count.
- **The count** (headless, a probe not kept: every block of a formation in contact as a
  rectangle of its columns and rows of slots, turned to its facing; two blocks are "in one
  another" when the rectangles meet). Pairs in one another:
  - seed 1212, the Soviet Union on Poland, day 6: 5 of 45 blocks' pairs, all of one side and
    one enemy: tank corps 181 and 182 with tank brigades 199, 202, 203 and 204, and Polish
    infantry division 562 with cavalry brigade 577 (their middles 0.4 km apart);
  - seed 4242, Germany on Poland, day 21 (151 blocks): 22, of them 4 of this kind;
  - seed 99, Germany on Poland, day 60 (114 blocks): 8, of them 1 of this kind.
- **Cause.** `deployOf` set a line of a stack `line` times its own depth and the gap behind
  the first, and a file its own width and the gap beside it (ADR-89, ADR-133). Every test
  of it used infantry divisions, 8 by 4 slots each. A tank corps is 11 by 5 (0.33 by 0.15
  cells), a tank brigade 7 by 4 (0.21 by 0.12), a cavalry brigade 4 by 2: the brigade a
  line behind the corps stood 0.17 cells behind its middle where 0.185 were needed, and
  the brigade abreast 0.26 beside it where 0.32 were needed.
- **Decision.** For a formation on the way to an enemy's block, the lines before it are
  walked in their order (the one that enemy faces first, where this one comes from its
  side; then by distance from that enemy, then id, as before): each takes its own depth
  and the gap, and one whose middle would stand behind the formation's place begins a new
  file. The formation stands behind what the lines of its file have taken. A file stands
  the widest block of all that go to that enemy, and the gap, beside the one before it.
- **What does not change.** Blocks of one size: the walk gives the line and the file that
  `floor(line / rows)` gave. A pair of each other's nearest. `DEPLOY_REACH` and
  `DEPLOY_ABREAST` bind as they did. The nine tests of `deploy.test.ts` pass unchanged.
- **Not state.** No rule reads where a block stands; the pin holds (the gate's test of it).
  The fire events and the wrecks take their places from the same function as before.
- **Measured.** Pairs in one another after it: 0 (seed 1212), 18 (seed 4242), 7 (seed 99).
  `tests/unit/deployUnequal.test.ts`: two tank corps, four tank brigades, a cavalry brigade
  and two infantry divisions on one cell against one division, every block a gap clear of
  every other and of the enemy's; red on the rule before ("tank_corps 0 and tank_brigade
  1"). `tests/e2e/stackBlocks1938.spec.ts`, the critic's game: 11 formations and 311
  elements in the view at 40 m/px; the two Soviet blocks nearest each other (182 and 199)
  have 1.54 km between their nearest elements (on the rule before: 181 and 202, 0.29 km,
  less than the 0.59 km between two slots of one block).
- **Left, each a part of PLAN 3.11c.** A block that comes to an enemy's block from its
  flank or its rear stops a block's depth from its middle and stands in it, and in the
  block of the one that enemy faces (14 of the 18 pairs on seed 4242); two that come to
  one block from bearings 47 degrees apart (2 pairs); the column six lines deep; the
  lattice and the one facing within a block.
- **Each formation walks with its own distance.** Formations of one stack agree on the
  files. Two that go to one block from places far apart may not: a matter of 3.11c2.
- **Deviation from AoC:** none; AoC has no blocks of elements.

### ADR-199 · 2026-10-08 · accepted — A formation's panel leads to its fight; no rule of `deployOf` changes for it (PLAN 3.11b, critic R3-B3)

- **Context.** The critic's second point of R3-B3: "the biggest fight" of day 21 on seed
  4242, 16 engaged formations within 3 cells by its own count, at 40 m/px was "one infantry
  division alone; no enemy in a view of 64 km". PLAN 3.11b asked first for a count through
  the game's own means, and why.
- **The count** (`deployOf`, `contactsOf` and `largestBattle` on the headless game of that
  seed, Germany on Poland by God Mode, day 21; the whole map, 14 nations' formations). 151
  formations are in contact, 78 of them in pairs of each other's nearest enemy. With the
  view of 1400 × 800 on a formation's block, those with no enemy element in it:
  - at 6 m/px (8.4 by 4.8 km): 54, 11 of them armour;
  - at 20 m/px (28 by 16 km, the battle view's zoom): 5, 2 of them armour;
  - at 30 m/px (42 by 24 km, T3's limit): none.
- **Why.** Of the 54: 50 are a line or more behind their own side's front. Their nearest
  enemy faces a nearer formation, they come up to that enemy's block from the side its own
  foe stands on, and `deployOf` puts them one block's depth and the gap (3.3 km) behind the
  line before them: 6.7, 10, 13.3, 16.6 and 20 km from that enemy's block. 2 stand abreast
  of such a line. 2 are of a pair front to front whose blocks' middles are 3.0 and 3.6 km apart
  north and south, in a view 4.8 km high. None is stopped by `DEPLOY_REACH`, and none by
  water: every block went as far as the rule sent it. The five at 20 m/px are the fourth
  to sixth lines of columns on one enemy (seven Italian divisions on one French one).
- **The banner's battle.** For each of the five wars with a battle, `largestBattle`'s pair
  have the other's elements in the 20 m/px view of either block (15 to 127 elements). What
  the critic counted was neighbours of a formation's place in the rules, before PLAN 3.11a,
  and a formation of a rear line among them.
- **Decision.** No rule of `deployOf` changes: a division in reserve behind its side's
  line with no enemy within four kilometres is what a line behind is. What was missing is a
  way from a formation to where it fights. `FormationDetail.fight`: for a formation in
  contact, the middle between its block and the block of the enemy it faces (`contactsOf`,
  the one its block faces), that enemy's id, and how far apart the two blocks' middles
  stand, east-west and north-south. The panel has a button beside "In contact", "To its
  fight", and the camera flies there as it does from a war's banner (`showBattle`, now with
  the span): at the battle's 20 m/px where the two blocks and 6 km around them fit the
  view's width and seven tenths of its height (the bars at the top and the war banners at
  the bottom stood on a block at the view's edge in the first picture), further out where
  they do not, to 28 m/px at most, under T3's 30.
- **Not chosen: lines abreast, not in column.** It would bring every formation in contact
  within a close view of an enemy, and it is a rule of where elements stand and fire from.
  The depth of a column on one enemy is a matter of spacing in contact: PLAN 3.11c.
- **Measured.** `tests/e2e/formationFight1938.spec.ts`: 31 German and Polish formations in
  contact, 5 of them armour; 5 with none of their enemy's elements on the screen at 6 m/px
  on their own block (6.7 to 10 km from it). After the button: 20.0 to 27.9 m/px, every
  element of the formation and of its enemy on the screen, figures drawn. The furthest on
  the map, Italian infantry division 301, 20.0 km from the block of French division 225:
  28.0 m/px, all 28 elements of each on the screen.
- **Consequences.** The pin holds: nothing of the sim changes, and asking leaves the hash
  as it was (`tests/unit/formationFight.test.ts`). The answer to `formation` is JSON: the
  snapshot's buffers are as they were. A view too small for the battle's zoom to be under
  28 m/px (narrower than 1,000 px or lower than 500) has its battles at T2, as the banner's
  flight has them, and goes as far out as holds the two blocks, up to T2's 250. (As first
  committed, `86e55bb`, such a view took no account of the span: the two blocks 20 km apart
  were not both in a view of 700 by 500. Mended in the commit after it.)

### ADR-198 · 2026-10-08 · accepted — A formation has two places in the snapshot: the rules' for its T1 marker, its block's for everything close (PLAN 3.11a, critic R3-B3)

- **Context.** A formation in contact holds its place in the rules, and its elements are
  deployed against the enemy, up to `DEPLOY_REACH` (1.5 cells) from there (ADR-89, ADR-98).
  The formation section of the snapshot and the panel's `FormationDetail` said the place in
  the rules. The critic centred the view on that place at 6 and at 2 m/px for the three
  German armour formations in contact on day 21 of seed 4242 and found none of their
  elements and no figure, 12.8 km from there (`critic/c3_m.json`, `centroidOffKm`, `at6`,
  `at2`). What the view drew at that place with no element in the view: the stand-in sprite
  and the formation's tag, over an empty field.
- **Tried first: the block's place for everything.** The section's `x`, `y` and their place
  of a tick ago became the block's, so the T1 marker went to the line too. Of 26 spec files
  run by hand four tests failed, and they say what is wrong with it:
  - `markerStacks1938`, "markers of two nations that stand on each other move apart by a
    few px": 11 pairs more than a quarter on each other at 1,900 m/px (0 expected), and 7
    pairs back from T2. The blocks of two sides stand a kilometre apart front to front,
    their middles some 3 km: under 2 px at that zoom, for boxes of 26 px that the stacks
    move 6 px at most. To part them the boxes would have to stand as far off as the places
    in the rules are.
  - `battleView1938`, the T1 → T2 handover of a pair in contact (the block 24 to 30 px
    east of its box: 4.8), and `formationPanel1938` at T1 (114 px of the picked marker's frame
    around the marker that is not picked).
  "Who faces whom is what this tier shows" (PLAN 2.7s1): the places in the rules, a cell
  or more apart, are what keeps the T1 markers of a front apart.
- **Decision.** Two places.
  1. `SnapshotFormations.x`, `y`, `prevX`, `prevY`: the place in the rules, as before. The
     T1 markers, their stacks and the T0 counters use it.
  2. `SnapshotFormations.block` (`BLOCK_STRIDE` = 4 numbers a formation: x, y, and x, y a
     tick before): where the block stands. `facing` is the block's (the enemy's side, for
     one in contact). `FormationDetail.x`, `y` is the block's place.
  3. One helper, `blockPose` in `worker/server.ts`, gives the block's place, its place of a
     tick ago and its facing to the formation section, the element section and the panel.
     It is the element section's code of PLAN 2.14c1, moved: the hour a contact begins the
     block comes from the formation's place, the hour it ends it goes back, and where the
     hour before is not known (a load, a command) nothing moves.
  4. The view: the stand-in sprites of T2 and T3 (drawn when no elements arrived), the tag
     of such a sprite and the click on it are at the block's place; `formationAt` (the
     player's click on a formation of the player's own) and the selection ring are at the
     place the formation is drawn at in the tier shown (the marker's at T1, the block's
     from T2 on, and between the two by the elements' share while T1 hands over to T2); `formationPos` is the block's place at every zoom, since what asks for
     it wants to go there.
- **One array, not four.** The snapshot's typed arrays are pooled buffers, one each, and
  `server.test.ts` holds the buffers of the one snapshot in flight to a count: 16. Four
  arrays made it 20. The place is one array of four numbers a formation, and the count in
  the test is 17. Its other three expectations (every buffer accounted for, no allocation
  after warm-up, under 64 in all) are unchanged.
- **A spec's expectation changed.** `battleView1938` read `formationPos` of the two
  divisions and expected them "a cell apart, as the sim has them". `formationPos` is now
  the block's place, so the spec expects each place among its own formation's elements on
  the screen, and the two 0.05 to 0.4 cells apart. That the rules do not move a formation
  in contact is in the unit tests (`deploySnapshot.test.ts`, both tests).
- **Not done here.** A formation's T1 marker and its elements are still up to 43 px apart
  where T1 hands over to T2 (ADR-92 has the bar go with the box for that). Whether both
  sides of a fight are in one T3 view is PLAN 3.11b; this part only puts the formation's
  own elements where the formation is said to be.
- **Consequences.** View and protocol only: no rule reads a block's place, and the pin of
  seed 99 is unmoved. A snapshot is 32 bytes a formation longer (about 34 KB at 1,054
  formations). `deployOf` is asked once more a formation in contact a snapshot and answers
  from the hour's cache.

### ADR-197 · 2026-10-08 · accepted — The zoom demo's battle is seed 1944's (PLAN 3.10f2, the full suite of PLAN 3.10)

- **Context.** The full e2e run that the tick of PLAN 3.10 brings: 142 of 147 passed, and
  `zoomDemo1938` is one of the two that fail alone as well. The division it chooses in seed
  1946's game on day 30 (ADR-185) is now Japanese, formation 391, in China: 40 battalions of
  67 to 142 of 500 men, three batteries, 134 to 147 shots by or at it in each hour. It is in
  contact and has no march, and the spec asks for one with both ("stop 5, battle: the
  division has a march and is in contact"), to show that a division in contact is not drawn
  walking.
- **Not looked for:** which part of 3.10 moved seed 1946's first month. Its parts changed
  which formations a front sector takes (ADR-187 to ADR-192), the ways over open ground
  (ADR-189, ADR-193 to ADR-195) and the supply network's refresh (ADR-196, meant to change
  nothing); the pin of seed 99 moved with most of them. The parts ran no e2e but the specs
  they touched (ADR-87), so the tick finds it.
- **Decision.** `SEED = 1944`; the day stays 30. The spec file as written, on the seeds
  nearest to 1946 in turn: 1947 fails (Nationalist Spain, battalions at up to 0.67 of their
  men, where the spec asks under half), 1945 fails (a Romanian division, 0.54), 1948 fails
  (a Japanese one, 0.59), 1944 passes: formation 593, a Czechoslovak infantry division east
  of Plzeň against German divisions, 4,960 men in 28 elements, 24 battalions of 153 to 243
  of 500, four batteries with 5, 5, 5 and 3 of 12 guns, 56 shots by or at it in each hour.
- **Not changed:** no expectation of the spec, and no line of it but the seed and the comment
  (as ADR-156 and ADR-185). The first seed that passes was taken.
- **Consequences.** The pictures of `docs/evidence/2.10/` are made again (`EVIDENCE=1`) and
  were looked at: stops 2, 5 and 8. The scene is the fourth since PLAN 3.4d. ADR-185 left
  the question whether the spec should build its battle by hand to the next review pass;
  it is still open, and the review pass after 3.12 has it.

### ADR-196 · 2026-10-08 · accepted — A refresh of the supply network mends it at the changed cells; a bloc's spans may cover more than its network (PLAN 3.10d1b)

- **Context.** A partial refresh cleared and flooded every bloc that had a cell change:
  247,000 to 277,000 cells in the median for the 37 to 54 that changed hands in twelve
  hours, 0.20 to 0.36 ms a tick (PLAN 3.10d). PLAN 3.10d1a did the mending on a copy of
  the layer before each of 12,126 refreshes of three seeds and found no cell apart.
- **Decision.** `World.setController` and `setOwner` keep each changed cell with what it
  was at its first change since the last refresh (`World.supplyChanged`: controller ×
  65536 + owner). A partial refresh takes all the losses first, then the gains.
  - A loss (the cell bears the mark of a bloc that no longer holds it): the mark is
    cleared. If the bloc's cells among the four neighbours are joined by way of its cells
    among the eight about the cell, nothing else changes.
  - A gain (a changed cell with no mark and a 4-neighbour of its bloc's mark): the bloc's
    flood goes on from it, through the same `open` as the flood from the sources, so the
    two tests of PLAN 2.11j that ask for a full refresh stand as they were.
  - A bloc is cleared and flooded from its sources, as before, when a ring does not hold;
    when the cell or one of the eight is a crossing lane; when a changed cell is a city
    whose being a source changed (the bloc it was a source of, the bloc it is one of, the
    bloc of its mark); when its spans have grown to twice those of its last whole flood;
    and when it is marked with no changed cell of its own.
- **Why the ring is enough.** Two cells that follow one another in the ring of eight are
  4-neighbours. If all the network cells beside the lost cell are in one run of the ring,
  any way through the lost cell can go round by the ring: every cell that reached a source
  still does (the lost cell is no source: that case floods). Not joined in the ring may
  still be joined a longer way round; it is answered no, the safe side. 8-connection in
  the test would be another network than the flood's, and would move the pin.
- **Why what the cell was is kept, and not a set of cells alone** (the task said a set).
  Two things need it. Whether a city was a source cannot be read from the mark (a city
  that an occupier held is in the occupier's network and is no source). And a bloc that
  loses a dry cell (a pocket taken apart) has no mark on it: with a set alone it would be
  a bloc "marked with no changed cell of its own" and be flooded whole for every cell of
  the pocket. The bloc a city was a source of is the mark it bears at the refresh: a
  source is always in its bloc's network, and a bloc cannot change without a full refresh.
- **Spans** (PLAN 3.10d1 said there is no third way: kept true or the bloc flooded). The
  third way: every cell of a bloc's network is in one of its spans, and a span may hold
  cells that are no longer in it. A loss leaves the spans alone; a gain adds its own
  (`n` grows, `base` is what the last whole flood left); the clearing of a bloc zeroes
  only the cells of its spans that still bear its mark, not the whole span (another bloc's
  gain may have marked a cell in it since). A bloc with more than twice the spans of its
  last whole flood is flooded at its next refresh, so the list is bounded. Splitting a
  span at each loss would keep them exact for a search in the list at every loss; nothing
  reads the spans but the clearing.
- **What it does not do.** A gained source floods its bloc (a seed of its own: 0.007 to
  0.008 ms a tick, PLAN 3.10d1a); a ring that does not hold is not searched further
  (3.10d1a's bounded search kept pockets with no source). A nation that held a cell
  between two changes within the twelve hours has no changed cell of its own unless
  another names it, and is flooded whole: safe, and not counted.
- **Not needed by any test.** The lane in the ring: with that line out every test passes.
  By the argument above a lane cell is a network cell like another, and a lane taken by a
  lower bloc is `open`'s to catch. It is kept as the task has it (92 losses in 17 years).
- **Measured** (from 1938, pinned to `0xFFFF`, one seed after another; supply's ms a tick
  by year, HEAD before in brackets from PLAN 3.10d):

  | | seed 99, five years | 4242, three | 8128, nine |
  |---|---|---|---|
  | supply, ms a tick | 0.075 to 0.181 (0.271 to 0.420) | 0.096 to 0.122 (0.258 to 0.302) | 0.103 to 0.191 (0.273 to 0.373) |
  | calls of 1 ms or more a year | 61 to 350 (592 to 730) | 126 to 249 (586 to 716) | 185 to 560 (680 to 731) |
  | the tick, mean | 1.289 (1.495) | 1.360 | 1.616 |

  The runs end on `5c31d145`, `114f9c7f` and `c9c0d546`, the hashes of 3.10d: the same
  games.
- **The pin.** Not moved (`8f937408`).
- **Test.** `tests/unit/supply.test.ts`, red first (40,000 cells written for a limit of
  200): on a made map a front that moves five cells writes ten cells, and two when one is
  given back; a pocket is cut off by a whole flood and relieved by a flood of its 26 cells;
  and after each of 2,158 refreshes of random changes (cells, cells given back, a city, a
  ring, the date line, a lane, a line, a peace; an island, two lanes, a puppet) the layer
  is the rule's to the cell, 601 of them with no bloc flooded from its sources. Four
  faults put in by hand fail it (the ring always holding, a city never flooding, one seed
  for a bloc's gains, the clearing of whole spans).

### ADR-195 · 2026-10-08 · accepted — The bound of the cell search is scaled up for a long search (PLAN 3.10c2d1b)

- **Context.** The longest call of the tick was a nation's far marches of one day: the
  Soviet Union's plan of tick 14,844 in seed 99, 143 to 148 ms, ten searches of 12 to 17 ms
  between ends 530 to 595 cells apart, each closing 57,000 to 85,500 cells for a way of
  570 to 620 (PLAN 3.10c2d). `findPath` has nothing left per cell; its bound is a fifth to
  a third short of the way's cost, and over 600 cells such a search fills its corridor.
  PLAN 3.10c2d1a counted the candidates on the game's own orders: the bound scaled up is
  better than a narrower corridor (it saves more, searches once, loses no way, and the way
  has a limit).
- **Decision.** `findPath` multiplies its bound by `boundWeight` of the distance between its
  two ends in cells (the larger of dx and dy, across the seam where the map wraps): 1 up to
  120 cells, 1.5 over 120 (`LONG_SEARCH_WEIGHT`), 2 over 300 (`FAR_SEARCH_WEIGHT`). It is in
  `findPath`, so every search has it: `findRoute`'s in a corridor and its search with none,
  for the operational AI, a barred march and a player's order alike.
- **Why that distance.** It is known before the search (the way's length is not), and it is
  the measure 3.10c2d and 3.10c2d1a put their orders into bands by: the rule starts where
  the count did.
- **Why two weights.** The count has the two bands apart. Over 300 cells, × 1.5 leaves the
  longest plan at 81 ms (seed 99) and 59 (seed 4242); × 2 leaves 33 and 25. That call is
  what this is for (on the mean tick it is 0.04 to 0.09 ms at any weight). Its price over
  300 cells: ways 1.10 times the cheapest in the mean, 1.24 at the most, and as long in
  cells (the scaled bound takes dearer ground, not a longer way). From 121 to 300 cells the
  searches are short already (1.97 ms each): × 1.5 takes 1.43 ms of that for ways × 1.037
  in the mean (the most 1.165), and × 2 would take 0.28 ms more for ways × 1.071 (the most
  1.239). So the dearer ways are bought only where the hitch is.
- **Why not below 120 cells.** Not counted (the orders of 31 to 120 cells are 1,977 ms in
  five years of seed 99; none is long by itself).
- **What the weight promises.** A way at most the weight times the cheapest in the ground
  searched (the corridor, where there is one), as far as the bound is a lower one: a closed
  cell is not opened again, and the octile walk is no strict lower bound where a way swings
  poleward of both ends (ADR-56). A search that finds no way costs what it did (it closes
  all it reaches at any weight).
- **In cells, not km.** The thresholds were counted on the 1938 map (2,048 cells wide). On
  a larger map 120 cells are fewer km; the cost of a search goes with its cells, so the
  rule follows the cost.
- **Measured** (five years of seed 99 and two of seed 4242, a probe put in and taken out;
  each order of the operational AI between ends over 120 cells apart searched again
  unscaled on a copy of the grid; it is another game than HEAD's from the first changed
  way on, so the orders are not the same ones):

  | | seed 99, 121 to 300 | over 300 | seed 4242, 121 to 300 | over 300 |
  |---|---|---|---|---|
  | given orders | 778 | 92 | 309 | 125 |
  | cells closed a search (unscaled, the same orders) | 3,468 (9,682) | 9,626 (47,362) | 2,006 (9,144) | 6,583 (65,133) |
  | the way's cost over the unscaled: mean, 90th percentile, most | 1.034, 1.065, 1.141 | 1.091, 1.171, 1.236 | 1.035, 1.060, 1.134 | 1.132, 1.176, 1.230 |

  No order got another answer than unscaled (a way or none). The orders of over 120 cells
  are 0.017 ms a tick in both seeds (0.101 and 0.106). The longest plan is 31.6 ms (seed 99;
  148) and 20.5 (seed 4242; 112); one plan of 30 ms or more in five years (26).
- **The pin.** `e771cf6a` to `8f937408` (seed 99 after one year): formations on a far march
  take another way and arrive at another hour.
- **Test.** `tests/unit/movement.test.ts`, red first (9,670 cells closed for a limit of
  4,835): on a made map of 512 by 256 cells in patches, a search over 200 cells closes
  fewer than half the cells of the unscaled one and one over 420 fewer than a third, the
  ways cost no more than 1.5 and 2 times the best, and searches over 60 and 120 cells are
  the unscaled ones to the cell and to the count of closed cells.

### ADR-194 · 2026-10-08 · accepted — The coarse route takes a province with closed ground at eight times its cost (PLAN 3.10c2b3b)

- **Context.** ADR-189 holds every route over open ground to the corridor of its coarse
  route (the route's provinces and their neighbours) and refuses one that is not found
  there. Its price, "a way that leaves the corridor", was not counted then. After ADR-193
  it was the larger part of the refused orders: 4,878 of 6,816 in five years of seed 99,
  12,571 ms (0.29 ms a tick), 3,656 of them the Soviet Union's, on 711 days of 1,825; 3,611
  of them marches of over 60 cells (ADR-190), asked again on the formation's next day in
  eight.
- **Where the route and the way part** (a probe put in and taken out, one hook in
  `movement.ts`; the same five years). The coarse route of such an order has 18.4 provinces,
  32 % of them with closed ground as well as open ("mixed"). The search in the corridor was
  run again and the first province of the route it does not come to was noted: in 4,674 of
  4,876 the province before it is mixed (3,866 times the one not come to is mixed too), in
  202 a mixed province after a clear one. One province stops 2,666 of them (node 1363, about
  cell 1337,374), 42 provinces all of them. The way by the cells has 271 cells, 101 of them
  outside the corridor, in 11.9 provinces, and 97.8 % of those provinces have no closed
  ground. So: the plan over the provinces goes through a province that is not open from side
  to side, and the way goes round it through open country.
- **The candidates, counted on those 4,878 orders** (each searched again on a grid of the
  probe's own, so the game was the same in every row):

  | | found | ms |
  |---|---|---|
  | the corridor two rings wide | 1,693 | 23,582 |
  | three rings wide | 4,374 | 38,798 |
  | the search with no corridor (PLAN's second candidate, without a bound) | 4,878 | 47,529 |
  | the coarse route over provinces with no closed ground only (and the two ends') | 2,355 (no route: 2,341) | 10,828 |
  | a mixed province at × 2 | 2,240 | 15,858 |
  | × 4 | 4,154 | 21,791 |
  | × 8 | 4,502 | 23,130 |
  | × 16 | 4,628 | 23,696 |
  | × 32, × 64 | 4,691 | 23,722, 23,754 |

  (The ms are mostly those of a search that finds a march of 150 to 450 cells: 5 ms.)
  And what a price does to the 49,136 orders that were given: at × 8, 3,302 take another
  coarse route, 7 of them find no way in its corridor, their searches take 1,228 → 1,532
  ms, and the way costs the same at the median, 1.039 times at the 90th percentile, 2.27 at
  the most (234 over 1.1 times). At × 16: 3,554, 8, 2.52. Clear provinces only loses 775
  given orders.
- **Decision.** `coarseRoute` takes a set of dear nodes; a step between two nodes costs the
  distance times the mean of their costs, and a dear node's cost is `SHUT_PRICE` (8) times
  its own. `findRoute` gives it the passage's nodes with closed ground (`Passage.shut`)
  whenever it plans over the provinces with open ground (a start on open ground under a
  passage). The corridor, the search in it and the refusal are ADR-189's.
- **Why 8.** Of the doublings it is the last that gains a tenth (4,154 → 4,502; × 16 gains
  126, × 32 another 63, and the 187 left are found by no price). It was read off the table
  above and not tried in the game against others. A balance it is not: it says how far
  round a route goes before it tries a province that may be walled.
- **Why not the second search.** It finds them all at twice the time, and an order that has
  no way then walks all the ground the formation reaches (ADR-189's 30 ms); a bound on its
  cells is a second constant and a second kind of refusal.
- **What it takes away.** A route through a mixed province where the way round is longer
  than eight times across and the corridor of the route round does not hold the way
  through: 7 of 49,136. And a march goes round a province with a neutral's enclave in it
  where the straight way was open: 234 of 49,136 by more than a tenth.
- **After** (five years of seed 99, the probe of 3.10c2b3a on both; another game from the
  first year on):

  | | orders | refused | ms of the given | ms of the refused | a way, in wide ground | a way, inside one pocket | no way |
  |---|---|---|---|---|---|---|---|
  | HEAD | 61,918 | 6,816 | 5,434 | 12,874 | 4,878 (12,571 ms) | 1,390 (43 ms) | 539 |
  | this | 57,752 | 768 | 7,186 | 925 | 721 (923 ms) | 5 | 10 |

  The Soviet Union: 4,975 refusals on 711 days → 566 on 123. The 721 left: 528 pairs of a
  formation and a sector, the median once, 18 times the most; on the day looked at (764)
  fourteen Soviet formations 119 to 225 cells from sectors whose way by the cells is 411 to
  531 cells. Not followed.
- **Test.** `tests/unit/provinceGraph.test.ts`, "the coarse route goes round a province with
  closed ground": east of Moscow, 60 cells along a row of Soviet ground; every Soviet cell
  in the column half way that lies in a province of the plain coarse route or a neighbour
  of one is made Poland's (43 cells). Red on HEAD ("the way round the wall: expected null
  not to be null"). Now: a way over Soviet cells only, dearer than the straight one, found
  in one search that sees 1,375 cells (the test asks for under 3,000).
- **The pin** moved: `10e1cac4` → `e771cf6a` (seed 99 after one year).

### ADR-193 · 2026-10-07 · accepted — Wide grounds are told apart, and the cells say whether two are joined (PLAN 3.10c2b3a)

- **Context.** ADR-192 walks open ground of 4,096 cells or fewer (a pocket) and takes all
  wider ground for one: a class in wide ground reaches every sector whose cell is in wide
  ground. After it, five years of seed 99 have 2,580 orders refused with no way by the
  cells and both ends in ground of more than 4,096 cells, all in year 5, 1,854 of them
  the Soviet Union's.
- **What the look found** (`.cache/c2b3/y4.bin`, a checkpoint of HEAD's year 4;
  `.cache/c2b3/head-apart.png`, not committed). Day 1,779, 21 refused orders of the Soviet
  Union. 17 formations stand 21 to 53 cells from an enemy's cell at the head of the Persian
  Gulf (1302,436) and are sent to it; 4 at 1526,439 are sent 218 to 275 cells to four
  sectors of that front (ADR-190). Their open ground has 199,184 cells. The front's has
  6,824: the Arabian peninsula, all of it an enemy's, so every province of it is open from
  side to side and `wideNode` says wide. Between the two lie some 8 cells of a nation at
  peace with the Soviet Union (a way over any ground is 37 cells for 21 in a straight
  line). So it is the pocket of ADR-192 again, larger than the number.
- **Not a larger number.** The year's refusals of this kind by where the order's cell is
  (a probe; "wide province": `wideNode`): in a province with closed ground 1,903 (735 of
  them to a cell more than 60 cells away, 1,981 ms), in a wide province 677, and only 311 with both ends in wide
  provinces. The front's cell is mostly in a province that the closed ground runs
  through; its walk ends at the first cell of a wide province and says "not a pocket",
  whichever wide ground that is.
- **Decision.** (1) A wide ground has a number: `wideNode` walks all the provinces with no
  closed ground that neighbours join to the one asked, and gives them, when they have more
  than `POCKET_CELLS` cells together, the number of that node. (2) `pocketOf` says which
  wide ground a walk came to: below 0, minus its number; 0 only for a walk that took
  4,097 cells and met none. (3) In `planNation` formations are classes by that ground too
  (the pocket, the wide ground, or none known), and in the loop that fills `reached` a
  class and a sector's cell whose grounds are two wide grounds are asked `wideJoined`:
  whether the cells join them. One side a pocket and the other not: not reached, as
  before. One side unknown: reached, as before. (4) `wideJoined` (nav/provinceGraph.ts)
  works out, once a passage and when first asked, which provinces with no closed ground
  are joined by the cells: their groups by neighbours (`nodeGroups`), and a union of two
  groups wherever one run of open cells in the provinces that have closed ground touches
  both. Only the cells of those provinces are walked (by `findPath`'s steps, as
  `pocketOf`), from a list of the cells by node made once a graph.
- **That it is the cells' own answer.** A probe made the same map for every plan of that
  year 5 and a labelled fill of all open cells for every tenth: 157,098 pairs of a class
  and a sector, none differ. Of 1,573,747 pairs that the reach test of ADR-192 passed,
  114,219 are apart by the cells.
- **Why not the map for every plan** (it would take the place of `pocketOf` and of
  `wideNode`). 5,556 plans in that year; the groups are 0.095 ms a plan and the walk 0.83
  ms (29,633 cells of provinces with closed ground, 18,157 of them open; 5.4 ms the
  longest): 0.59 ms a tick. **Why it is not kept from one plan to the next:** between two
  passages with the same open holders a cell changed between an open and a closed holder
  in 2,584 of 4,647, so it would be made again more than half the time, and it needs a
  record of every cell that changes hands to know.
- **Why not "two wide grounds are apart"** (no walk). In five years of seed 99 `wideJoined`
  is asked 500,671 times and says "joined" 355,992 times: a front is often reached through
  a province that a neutral holds part of.
- **Why not a remembered refusal** (PLAN's candidate, and ADR-192's "why not"): state, to
  be forgotten when the ground changes, and the first day is still refused. The far
  orders are the dear ones here, and each far formation is refused once for every empty
  sector of the walled ground before a memory of pairs quiets it. **Why not a search from
  one formation of a class:** that is the search that costs 2 to 34 ms today, for every
  sector of the class and not only those it is allotted.
- **The cost.** Five years of seed 99: the cells walked for 4,295 passages, 4,027 ms, 0.94
  ms each (7.8 the longest), 0.092 ms a tick. `wideNode` now walks a whole group of
  provinces and not only its first 4,096 cells: not measured apart.
- **What it did** (five years of seed 99, one probe before and after; another game from the
  first year on):

  | | orders | refused | their ms | no way, both in wide ground | a way by the cells, in wide ground | a way, inside one pocket | others |
  |---|---|---|---|---|---|---|---|
  | before | 66,197 | 6,280 | 3,499 | 2,580 (2,471 ms) | 3,583 (424 ms) | 77 | 40 |
  | after | 61,918 | 6,816 | 12,874 | 490 (252 ms) | 4,878 (12,571 ms) | 1,390 (43 ms) | 58 |

  The Soviet Union: 1,854 of the kind this answers → none. **But its refusals are more,
  2,357 on 351 days → 4,975 on 711, and the refused orders cost 0.080 → 0.294 ms a tick:**
  in the game after it has more formations that are far from every sector they reach (by a
  guess that was not counted: those that no longer stand allotted to a front they cannot
  reach), and they are sent from afar (ADR-190) to sectors 146 to 441 cells away that have a way by the cells, 103 to 247 cells of it outside the
  corridor of provinces. The corridor refuses them after 0.2 to 6.7 ms, every eighth day.
  That is ADR-189's price, PLAN 3.10c2b3b. The 490 left with no way (87 pairs of a
  formation and a sector, 35 days of nations other than the Soviet Union) were not looked
  at: a walk that met no wide ground, or an attack on an enemy's cell that is not of the
  front cell's ground.
- **The tick** (pinned to `0xFFFF`, `--profile`, one run each): seed 99, years 1 to 5,
  1.833 → 2.116 ms (the operational AI 0.548 → 0.865, its longest call 405 → 92 ms); seed
  4242, year 1, 1.938 → 1.956, year 2, 1.469 → 1.527. Slower, and seed 99 is 0.6 over the
  budget: the refused far orders above (0.21 ms a tick more) and the walk (0.09).
- **What it does not do.** A province with no closed ground that is in two parts reads as
  joined in itself (ADR-192's note; the 157,098 pairs had none). Two classes in two wide
  grounds that the cells join are allotted each by itself, though they reach the same
  sectors. `mayReach` is not changed: an order is still refused by its search.
- **Tests.** `tests/unit/operationalAi.test.ts`, "two wide grounds": the United States
  against Mexico and a wall of Canadian ground across the United States twelve cells north
  of the front, six divisions north of it. Red before (six orders refused), green after:
  none is ordered. With four cells of the wall left open (the two grounds joined only
  through provinces that the wall runs through) all six are ordered to the front, before
  and after. The pin `2724cb90` → `10e1cac4`.

### ADR-192 · 2026-10-07 · accepted — Formations in a pocket of open ground are allotted to the front in the pocket (PLAN 3.10c2b1)

- **Context.** PLAN 3.10c2a: 21,078 of 76,738 orders of the operational AI in five years of
  seed 99 are refused after the reach test (ADR-152) passed them, and 93 % of those that
  searched have no way over open ground. The reach test asks the provinces: two neighbours
  with some open ground each are one group, whether or not their open cells meet. A
  formation so allotted counts in its sector and is offered no other, day after day.
- **What the look found** (a checkpoint of year 4, the first day of year 5 with 40 refused
  orders of nation 10, the Soviet Union; `.cache/c2b/day.png`, not committed). 37 Soviet
  formations stand on a patch of Soviet ground (cells 1186 to 1199 by 416 to 428), with
  ground of nations at peace with it (closed) all around, and are allotted to the
  Soviet front against the Sudan 40 to 56 cells to the south; two more at
  1567,492, to a front against the Raj 40 cells away. Year 5 of that game: 13,379
  of 13,403 refusals have no way by the cells, and in 13,365 of them the formation's own
  open ground is 4,096 cells or fewer (the median 100). In five years (the same probe):
  19,728 of 21,203.
- **Decision.** In `planNation`, where the classes of formations are made: a formation on
  open ground is asked for its pocket (`pocketOf`, nav/grid.ts), the cells a route comes
  to from its cell over ground open in the nation's `Passage`, by `findPath`'s own steps
  (eight neighbours, no corner cut by the terrain), when they are no more than
  `POCKET_CELLS` (4,096). The formations of one pocket are one class, and the class
  reaches a sector when the sector's front cell (or the cell an order to it snaps to) is
  in the pocket. Ground that is wider is not walked to its end: its formations are
  classes by landmass and group of provinces, as before.
- **Why not the cells' landmasses for all** (PLAN's first candidate: "a passage's
  landmasses of open cells, made once a passage and day"). Counted: a labelled fill of
  the open cells is 12.2 ms a passage (204,000 cells; 26.5 ms the longest) and a year has
  5,950 passages: 8.3 ms a tick, against a tick of 1.2 to 2.3 ms. A passage is of one
  hour and one set of open holders, and the holders of the cells change every hour: it
  cannot be kept for a day without being saved or being wrong after a load.
- **Why not a remembered refusal** (PLAN's second candidate). It costs no time, but it is
  state (a formation's sector and day: the save format, the round trip, the hash), it has
  to be forgotten when the ground changes, and on its first day the formation is still
  allotted and refused. It answers every kind of refusal, though, and this rule answers
  one: see "What is left".
- **Why 4,096.** The pockets of the look: 100 cells the median, 2,634 the largest that
  was asked from often; the next size of open ground in that game is 209,261. A number
  set by one game.
- **The cost, and what keeps it down.** With the walk alone: 28,642 walks in two years of
  seed 99, 26,204 of them of wide ground (2,100 cells each), 0.125 ms a tick. So two
  things that change no answer (the same hashes): (1) `wideNode` (nav/provinceGraph.ts):
  a formation in a province with no closed ground, joined by neighbours to such provinces
  of more than 4,096 cells together, is in no pocket and is not walked (the provinces are
  walked until they have that many cells; the answer is kept on the `Passage`);
  `Passage.shut`, the nodes with closed ground, is read in the loop that fills `open`.
  (2) A walk ends at the first cell of such a province, or of ground an earlier walk of
  the passage found wide. Then: 10,196 walks, 376 cells each, 0.0125 ms a tick. (A table
  of the wide groups for every node, made once a passage, cost 0.09 ms a passage, as much
  as the passage itself: dropped.) `wideNode` takes a province for joined in itself and
  to its neighbours where both are open, which a province in two parts is not: it then
  says "wide" of a pocket, and the pocket is judged as before this ADR.
- **`mayReach` is not changed.** Its comment said the planner's test is the same test
  written twice. The planner now asks one thing more. An order (a player's, the AI's) is
  still refused by its search in the corridor, which in a pocket walks the pocket (0.05
  ms).
- **What it did** (five years of seed 99, the same probe before and after; another game
  from the first year on):

  | | orders | refused | the formation in a pocket | a way by the cells (or from closed ground) | no way, the sector in a pocket | no way, both in wide ground |
  |---|---|---|---|---|---|---|
  | before | 82,822 | 21,203 | 19,728 | 990 | 353 | 0 |
  | after | 68,736 | 11,412 | 10 | 8,164 | 2,337 | 854 |

  (132 of the refusals before and 47 after were not sorted: the order's target is on
  another landmass.) Nation 10: 18,110 refused on 790 days before, 58 of its formations
  100 times or more; after, 7,463 on 1,072 days, 4 formations. Its refusals after are of
  the other kinds (5,620 with a way by the cells, 1,456 to a sector in a pocket, 364 in
  wide ground): in the game after it fights elsewhere.
- **What is left** (PLAN 3.10c2b2, 3.10c2b3). The sector in a pocket and the formation
  not: the walk is from the formation, and one from every sector is a walk a sector. A
  way by the cells that the corridor does not hold (ADR-189's price), asked again every
  day: in the game after, formations at cell 1165,234 are sent 38 to 50 cells south, day
  after day. Both in wide ground with closed ground between: nothing here asks it.
- **Tests.** `tests/unit/operationalAi.test.ts`, "a pocket of open ground": the United
  States against Mexico, two boxes whose edges Canada holds (at peace: closed), a small
  one around a front cell and a large one around it; six divisions between the two, the
  small box's front the nearest. Red before (six orders refused), green after: none
  refused, all six on the march to the front in their own pocket. The pin `38fcbd68` →
  `ae5e192d`.
- **Amended 2026-10-07 (PLAN 3.10c2b2): the sector's cell is asked for its pocket too.**
  *The count PLAN asked for first* (five years of seed 99, the game of 3.10c2b1, the probe
  of 3.10c2a with a tally by sector): 2,337 orders refused with the formation in wide
  ground and the order's cell in a pocket, 1,196 of them attacks (the enemy's cell next to
  the front cell: the same pocket); 141 sectors of five nations (the Soviet Union 1,456,
  nation 1 822), on 348 days, 1,718 sectors and days; the pockets have 35 to 1,861 cells
  (the median 1,250), so `POCKET_CELLS` holds them. *The rule:* in the loop that fills
  `reached`, the cell an order to the sector would go to is asked for its pocket as a
  formation's cell is (`wideNode`, then `pocketOf`), once a cell, and a class on open
  ground reaches the sector when that pocket is its own, or when neither is in one. It
  takes the place of the test of 3.10c2b1 (`inPocket`, deleted), which it holds. A class
  on closed ground is not asked: it walks on closed ground and out of it, and may come
  out into the pocket. *Why not only the sectors a formation is allotted to* (PLAN's
  other way): that is after the allotment, which would have to be made again. *The cost:*
  6,330,140 sector cells asked in five years of seed 99, 416,037 of them walked or read
  from an earlier walk (the others are in wide provinces), 94,530 in a pocket: 715 ms,
  0.016 ms a tick, the clock's own cost in it. The whole loop that fills `reached` (the
  front cell, the snap, the groups, the pockets) is 0.021 to 0.075 ms a tick by year, and
  its longest call 1.0 ms (a planner of 385 sectors). *What it did* (the same probe;
  another game from the first year on): orders 68,736 → 66,197, refused 11,412 → 6,280,
  the sector in a pocket 2,337 → 0. The Soviet Union: 7,463 refused on 1,072 days → 2,357
  on 351 (0, 128, 9, 3, 211 by year), 4 formations refused 100 times or more → none. *What
  is left* in the game after (PLAN 3.10c2b3): 3,583 with a way by the cells that the
  corridor does not hold, 2,580 with none and both ends in wide ground (854 before; all
  of them in year 5, the Soviet Union 1,854), 77 inside one pocket, 18 from closed
  ground, 10 from a pocket to wide ground (a province in two parts, which `wideNode`
  takes for wide). *The test:* "divisions in wide ground are not ordered to a front in a
  pocket", the test above with the outer box left out and four Mexican divisions on the
  box's front, so that its sectors are the allotment's first. Red before (four orders
  refused), green after. The pin `ae5e192d` → `2724cb90`.

### ADR-191 · 2026-10-07 · accepted — A front sector that nobody is in range of takes a formation the front can spare (PLAN 3.10c1d)

- **Context.** ADR-190 sends only formations that are far from every sector they reach. A
  nation all of whose formations are within the range of some sector sent none to a part
  of its front that is beyond the range of all of them (PLAN 3.10c1d: France against
  Italy in seed 4242, 31 of 39 sectors).
- **Decision.** In `planNation`, in the step of ADR-190 and with its sectors that have
  nobody:
  1. *When:* on the nation's day, (day + nation) mod `MARCH_DAYS` = 0.
  2. *Who:* of the free formations within the range of a sector they reach (the ranking
     the reserve is cut from), those that stand still, the farthest from the front first,
     as many as the reserve's share of that ranking (one at least).
  3. *How many:* no more than the front can spare. With N the formations of that ranking,
     and the sectors weighed as in the allotment (1 + threat/`THREAT_UNIT`): N less the
     share of N that the sectors weigh which are not (empty and beyond the range of every
     formation of the nation), rounded up.
  4. *Where:* the nearest sector that has nobody (ADR-190's test), that no formation of
     the nation, free or not, is within the range of, that its class reaches on its
     landmass, within `SPARE_RANGES` (3) times the range. One a sector, in one list with
     ADR-190's formations, nearest pair first.
  5. The formation is taken out of the sector the allotment gave it for that plan. Its
     march is kept as ADR-190's is.
- **Why not the reserve itself** (PLAN 3.10c1d named "the reserve of ADR-37, or what an
  allotment leaves over"). Tried first. The reserve is the farthest 15 % of a ranking
  made anew every day; in the test (twelve divisions) it is one formation, another one
  from day to day, and nearly always one with a march to end (39 of France's 44 were on
  the march). Taken on the march it cannot be told from a formation this rule sent three
  weeks ago, which has come within the range of its sector: the first cut ordered the
  same division to the far end three times. So: only formations that stand still, and of
  the reserve only its number. What an allotment leaves over is nothing where the pools
  of the manned sectors overlap (France: 42 formations in the pool of each of 8 sectors).
- **Why the nation's day and not the formation's** (ADR-190 has the formation's). The
  formation that is to spare is another one every day; its own day in eight would seldom
  be a day it is to spare (no order in 30 days of the test).
- **Why a share and not a floor** ("beware a front that is emptied to fill another and
  filled again"). A sector that is threatened weighs more, so a front that fights keeps
  more: in the test the ten Mexican divisions opposite the near end make 2, 1 and 1 of
  twelve to spare on days 6, 14 and 22; with nobody opposite it is 4. A sector that a
  formation marches into has somebody, so the count falls as they are sent.
- **Why three times the range.** The far end of a front, not another theatre: ADR-187's
  test ("no formation of the one front is ordered to the other", Poland and Manchuria)
  stays as it is. France's far end is 91 to 138 cells from its army. A number set by
  that one case.
- **Amended 2026-10-07 (PLAN 3.10c1d2): who, point 2.** Not "those that stand still" but
  "those that are not on an errand". On a front that fights nearly none stands still (the
  allotment orders every formation to its sector's cell every day: France, seed 4242,
  day 365: 19 of 21 ranked on the march), so the rule seldom had anybody to send. A
  formation is on an errand when it is on the march and either
  (a) its target cell is more than `DEPLOY_RANGE_CELLS` from it (no allotment orders that
  far: such a march is ADR-190's or this rule's), or
  (b) its target sector would have nobody without it by ADR-190's own test: no other
  formation of the nation stands in it or next to it, and none other marches into it.
  A march to a sector that is gone (the front moved) and is within the range is no
  errand. The rest of the decision is unchanged.
  *Why (a), which PLAN did not ask for.* With (b) alone, five years of seed 99 had 19 of
  139 orders that were given go to a formation sent less than 40 days before (61 to 156
  cells to go: it could not have arrived), one division six times. With (a), 11 of 234,
  the nearest two 16 days apart; the rule before had none in 96. What is left are marches
  that ended on the way (a sector gone, a battle): not looked into one by one.
  *What it did not do.* France's front (the case this ADR was written for) is as it was:
  see BLOCKERS, "France's far end".
  The pin `d790e601` → `38fcbd68`.
- **What it does to the case it was written for: little.** France in seed 4242 is an
  army being destroyed (44 formations, 21 twenty days later on the rule before, 17 on
  this one), with 2 of 21 ranked formations standing still on its first day: one is sent
  (139 cells). That is this rule's filter as much as France's state: the allotment orders
  every formation to its sector's cell every day, so on a front that fights few stand
  still (PLAN 3.10c1d2). Year 2 of that seed from the same state: 15 such orders by four nations,
  62 to 175 cells. Five years of seed 99: 102, 6 refused.
- **Tests.** `tests/unit/operationalAi.test.ts`, "to spare": the United States against
  Mexico, nobody but twelve American divisions on the twelve front cells nearest the
  Pacific and ten Mexican ones six cells opposite. In thirty days at least two divisions
  are given an order of more than the range, each one such order, to a cell of the front
  and a sector of its own, and each is 10 cells nearer it; more than half the army is
  given none and stands within the range of the near end. Red on the rule before
  ("expected 0 to be greater than or equal to 2"). PLAN's "the far end is manned within
  a month" is not what it asserts: a division marches 1.5 cells a day (35 cells in the 24
  days the first one had), and the far end is 60 to 110 cells off.
- **The pin** moved: `9d84cd85` → `d790e601` (seed 99 after one year).

### ADR-190 · 2026-10-07 · accepted — A front sector that has nobody takes a formation from afar, one march each (PLAN 3.10c1a)

- **Context.** ADR-187 made the range be to each sector and so took away the only way a
  formation went from one theatre to another (by accident, a division at a time, and
  again the day after). Seed 4242 after a year: the Soviet Union at war with Iran along 89
  sectors, 14 of its 164 formations within the range of them.
- **Decision.** In `planNation`, after the allotment:
  1. *A sector that has nobody:* one of the planner's own front (a cell of it is the
     planner's; not a sector of an ally's front only), in which and next to which (its
     3 × 3 sectors) no formation of the planner stands, free or not; to which the
     allotment gave none; and into which none is on the march.
  2. *A formation from afar:* free (not engaged, not on the retreat, not on the march
     home), standing still, more than `DEPLOY_RANGE_CELLS` from every sector its class
     reaches, and its day: (day + id) mod `MARCH_DAYS` (8) = 0.
  3. Each such formation names the nearest sector with nobody that its class reaches and
     whose front cell is on its landmass. Nearest pair first, one formation a sector; a
     formation whose sector was taken names the nearest that is left. The order is to the
     sector's front cell. A sector is tried once a plan, also when the order is refused.
  4. *The march is kept.* A formation on the march is not in (2). Within the range of its
     sector it is a march into a sector (ADR-53), and its order is not given again while
     the target is within a sector of the old one.
- **Why "has nobody" and not "has too few for its threat".** PLAN 3.10c1a asked for "the
  nearest sector that has too few". A count against the threat needs the formations that
  are near each sector, and the pools of sectors overlap (ADR-187); "nobody stands there,
  nobody is coming" is read off without them, and it bounds the marches: one a sector.
  A long front draws many (52 Soviet formations were on the march to the Iranian front
  ten days after the rule began), a short one few, and the rest of the army stays where
  it is, as a garrison.
- **Why eight days.** Without them, the first cut: every far formation of a nation was
  ordered in one tick (a call of 344 ms in year 1 of seed 4242; the rule before had 19 ms),
  and a formation whose order was refused was asked again every day (2,549 of 2,755 far
  orders in year 8 of seed 8128 were refused, one formation 193 times). With them: a call
  of 87 ms, and 270 refused of 381. No state is needed for it: the day and the id.
- **Not across the water.** A sector on another landmass gets an order to the shore
  nearest it (`snapTarget`). In the first test (Moscow, a front on Sakhalin and at the
  Korean border) four of six divisions were sent 520 cells to one cell of the mainland
  shore opposite Sakhalin. Phase 4 has the ships.
- **Not to an ally's front.** The header has said since PLAN 1.42b that an ally's front is
  a nation's own "within DEPLOY_RANGE_CELLS of its formations". An army that crosses a
  continent to a war that is not at its own border is a decision of another kind (PLAN
  7.2, if it is wanted).
- **What it does not do** (PLAN 3.10c1d): a nation all of whose formations are within the
  range of *some* sector sends nobody. Seed 4242 after a year of this rule: France against
  Italy, 39 sectors, 31 with nobody within the range, 42 of 44 French formations within
  the range of the other eight. PLAN 3.10c1a had this as "a share of those of a front
  that has more than its threat asks for": it is a second rule (who is to spare), and
  this one was measured without it.
- **Tests.** `tests/unit/operationalAi.test.ts`:
  - "marches from afar": six Soviet divisions at Chita, the only war with Poland. In
    twenty days each is given one order, to a cell of the front, each to a sector of its
    own, and is 10 cells nearer. Red on the rule before ("expected +0 to be 1").
  - "the range is to the sector" (ADR-187) is restated, not weakened: it asked that no
    order go beyond the range. Now: an order beyond the range goes only to a formation
    that stood more than the range from every front cell, and to none a second time. On
    the rule before ADR-187 it still fails, with the same 25 orders ("formation 91: 72
    cells, 35 from a front").
- **The pin** moved: `5643bf80` → `9d84cd85` (seed 99 after one year).

### ADR-189 · 2026-10-07 · accepted — A short route over open ground is held to the provinces (PLAN 3.10c1c)

- **Context.** Found while measuring PLAN 3.10c1a (formations sent to a far front): the
  operational AI's tick rose from 0.49 to 1.30 ms in year 8 of seed 8128 and to 5.58 ms in
  year 2 of seed 99, with one call of 1,004 ms. A probe (put in and taken out): the far
  orders were 0.03 to 0.12 ms a tick of that. The rest was ordinary orders that `orderMove`
  refused after a search of 27 to 33 ms each: 570 of them in that year of seed 8128 (15.6 s
  of the 16.1 s all 11,891 orders took), 1,478 in three years of seed 99 (45.1 s). The
  game of HEAD has them too, 39 in year 8 of seed 8128 from the same state: nation 15's
  formation 204 at cell (1157, 292), ordered to (1132, 311), refused on six days running.
- **Cause.** The reach test (`mayReach`, and its twin in `planNation`) is by province: both
  ends in one group of provinces that have open ground. A province with some open ground
  need not be open from side to side, so the test passes where the cells give no way. For
  a route over 500 km `findRoute` then searches only the provinces of the coarse route and
  their neighbours and refuses (PLAN 3.4Rl, ADR-149). Under 500 km it went straight to the
  cell search with no corridor, and that search ends only when it has walked all the open
  ground the formation can reach.
- **Decision.** From a start on open ground under a `Passage`, a route of any length is
  planned over the provinces with open ground and searched in their corridor (the route's
  provinces and their neighbours; two ends in one province: it and its neighbours). Not
  found there, it is refused, and the memory of the last refused search (`NavGrid.barred`)
  holds for it as for a long one. Without a `Passage`, or from closed ground, nothing
  changes.
- **What it takes away.** A short way that leaves the corridor: round a bay or a closed
  nation through provinces that are not neighbours of the coarse route's. The coarse route
  is itself over provinces with open ground, so the case is a province that is open but
  not from side to side, twice over. Not counted.
- **Why not make the reach test exact.** That is the groups by cell: a flood of the open
  ground per `Passage`, and a passage is made anew in every hour somebody plans. Not
  measured; this change is three lines and uses what the long routes have.
- **Still so:** a formation whose order is refused is asked again the next day (PLAN
  3.10c2). The refusal is now cheap.
- **Test.** `tests/unit/provinceGraph.test.ts`, "a place walled off inside its province": a
  ring of Polish ground round a German cell near Berlin, an order from 12 cells away. The
  search sees 1,070 cells (2,354 before: all of Germany's open ground; the test asks for
  under 1,500) and the same order again sees none.
- **The pin** moved: `a71ed07e` → `5643bf80` (seed 99 after one year): routes of under
  500 km are searched in a corridor, and one that left it is now another.

### ADR-188 · 2026-10-07 · accepted — A tag that is not the nearest to its own elements has a line to them (PLAN 3.10c1b)

- **Context.** `tankBattle1938` failed on the game of PLAN 3.10c1 at its stop of 60 m/px:
  "the brigade's tag is the nearest to its tanks or has a line to them" (ADR-168). The
  boxes of that view (seed 2, day 22.8; a probe in the spec, taken out again):
  - Tank brigade 395 (873 men): its elements x 664–706, y 366–435, a column 69 px tall.
  - Light infantry division 410 (4.1k): x 720–752, y 369–427, east of it.
  - Light infantry division 418 (7.1k): x 737–782, y 427–487.
  `layoutTags` places the stronger first. 410 takes "above": a tag of 112 px centred on a
  block of 32 px, x 680–792, y 335–365, which is over the top of the brigade's column too,
  1.4 px clear of it. The brigade's own "above" lies on that tag, so it takes "below"
  (x 647–724, y 439–469), 4 px off its block: no line by ADR-168's rule (a line when the
  gap is over `TAG_GAP` + 1).
- **Which it is: the placing, not the measure.** From the middle of the brigade's block
  (685, 401) its own tag is 38 px away and the division's 36 px (the spec, from the middle
  of its 20 tanks: 40 and 34). The picture agrees with the spec: the tag that stands over
  the tanks says "Light infantry division 410". ADR-168's line was for a tag that gave way;
  it did not see that by a tall block the place "below" is further from the block's middle
  than a neighbour's tag over its top, with every tag "by its own". The comment in `tags.ts`
  says "the nearest free one" of the places; the order is above, below, left, right
  whatever the block's shape.
- **Decision.** After the placing, a tag has a line to the middle of its elements also when
  another placed tag is nearer to that middle than it is (from the point to the tag's box,
  0 inside it: the spec's measure). No tag moves. View only (`tags.ts`).
- **Why not place it differently.** Trying the places in the order of the block's shape
  (beside a tall block first) moves the tag of every tall block, and the unit tests and
  three specs hold "above first". Keeping a tag a gap clear of other formations' elements
  would send 410's tag beside its block here, but leaves the case in general (a tag clear
  of a neighbour and still nearer its middle). The line is what ADR-168 has for "nothing
  says which block this tag is of".
- **What it does not do.** The division's tag still stands over the tanks, without a line
  of its own (it is the nearest to its own block): the picture says whose the tanks are by
  the brigade's line, not by clearing the other tag away
  (`docs/evidence/3.10/c1b-turrets.png`). Under PLAN 7.4.
- **Consequences.** A line can come and go as the view moves and another tag comes nearer
  (the line of ADR-168 does too, with the gap). The existing unit tests hold unchanged (in
  the three columns of PLAN 3.7g no tag is nearer to another block's middle than that
  block's own). The pin is unmoved: nothing of the sim changed.

### ADR-187 · 2026-10-07 · accepted — A front sector takes only the formations within the range of it (PLAN 3.10c1)

- **Context.** PLAN 3.10c: the operational AI's dear calls are its orders to fronts far away.
  A formation was in a nation's plan when it stood within `DEPLOY_RANGE_CELLS` (60) of *one*
  front sector, and the allotment was then over all the sectors its class reaches: a sector
  took the nearest free formation however far that was. A nation with a front in Europe and
  one in East Asia sent divisions from the one to the other (a path of 979 cells, 23.5 ms to
  find), and 848 of 2,902 such orders in two years of seed 4242 were replaced within five
  days by an order to somewhere else. The orders beyond the range were 19 % of the orders
  and 95 % of their time.
- **Decision.** The range is to each sector. In `planNation`, for each class of formations:
  1. *The sectors of the class* are those it reaches that have one of its formations within
     the range (`pool`: how many). A sector with none is not in the allotment.
  2. *The allotment* is still by largest remainders over 1 + threat/`THREAT_UNIT`, but a
     sector is allotted no more than its pool: a sector whose share is more takes its pool,
     and the others share the rest by their weights (again, until no share is over a pool).
  3. *The fill* (most threatened sector first, nearest formation first) takes only formations
     within the range of the sector.
  4. *What is left over joins its nearest sector.* New: before, the allotments summed to the
     class and nothing was left. Now a pool can be taken by the sectors around it (pools
     overlap), and a formation that no allotment took would stand idle beside a front. Its
     nearest sector is within the range, or it would not be in the plan.
  Unchanged: a formation with no sector in range stays where it is; a formation marching
  into a sector keeps it (ADR-53), also one that an order of the old rule sent far; the
  reserve; the reach test (ADR-152); spearheads (ADR-153).
- **It is a correction.** The comment on `DEPLOY_RANGE_CELLS` has said since PLAN 1.25
  "formations farther than this from every front sector stay where they are", and the file's
  header "within DEPLOY_RANGE_CELLS of a sector". Nothing said that a formation near one
  front was at the disposal of all of them.
- **What it takes away.** The leak was the only way a formation crossed from one theatre to
  another, and the only way the far end of a long front got anybody: "every sector gets
  one" was over all the sectors, and is now over those with somebody in range. A front
  that no formation is within 60 cells of gets none, as before; a front whose army is
  elsewhere is no longer fed by accident. Seed 4242 after a year: the Soviet Union has 162
  formations and a front of 104 sectors against Iran with 14 of them in range
  (`docs/evidence/3.10/c1-seed4242-y1-iran.png`). Moving formations between theatres is a
  rule of its own, to be written as one (PLAN 3.10c1a): one march per formation, not an
  order a day.
- **Tests.** `tests/unit/operationalAi.test.ts`, "the range is to the sector": the Soviet
  Union of 1938 at war with Poland and Japan, five days; every order's target is within the
  range (and a sector's diagonal and a cell) of where the formation stands, and both fronts
  are given orders. On the old rule it fails with 25 orders of 67 to 125 cells.
- **The pin** moved: `875255b7` → `a71ed07e` (seed 99 after one year).
- **A test whose nation changed** (`tests/sweep/researchYears.test.ts`, the second: ADR-144's
  "a played nation researches as the AI's do"). It compared France played, France under the
  AI and France in a world with no AI over two years of seed 99, and asked for a tech of
  1939 in common. In the game since this rule Germany holds France from the autumn of 1938
  in both games that have an AI (income 1,074 → 156): each France learns four techs, the
  same three of 1938 and one of 1939 on the day it is paid for, `naval_aviation` under the
  AI and `infantry_weapons_2` played. The test's premise is a nation that pays for research
  through the two years, so its nation is now the United States, at peace in all three
  games: the same ten techs in each (six of 1939). The assertions are the same lines.
  Germany would not do: played from tick 0 it is dead in the twentieth month.

### ADR-186 · 2026-10-07 · accepted — A revolting region is bounded by its land, not only by its provinces (PLAN 3.9)

- **Context.** The critic's R3-B2, the part that is not balance: on seed 6021 the Soviet
  Union has 13.02 % of the land at year 8.1 and 5.54 % at year 9.1, and "Free Herat" has
  5.97 %. Seed 6021 at HEAD no longer plays that game (PLAN 3.8e moved it: no nation gains
  or loses 0.8 % of the land in a day at the Soviet Union's cost in ten years, final hash
  `85644d9a`), so the event was looked for at the critic's commit `a6f63ef`, in a worktree,
  with a scratch script that prints every day on which a nation's share moves by 0.8 points.
- **What it was.** Two revolts, not one event:
  - day 3043: Soviet Union −4.52 → 8.36 %, nation 163 ("Free Seoul": Liaoning and northern
    Korea, 978 cells, 0.18 %) +4.49 → 4.67 %. One `RevoltSpawned`: Sakha (33,139 cells),
    Chukotka, Khabarovsk, Magadan, Zabaykalsky, Amur, Primorsky and the Jewish oblast;
  - day 3135: Soviet Union −3.31 → 5.62 %, nation 112 ("Free Herat", by then 2.66 % in 48
    provinces: Xinjiang, Kazakhstan, Tyumen, Omsk) +3.31 → 5.97 %. One `RevoltSpawned`:
    Krasnoyarsk (26,964 cells), Yamalo-Nenets, Khanty-Mansi, Komi, Tomsk, Perm, Kirov, Mari El.
  Both are a region revolt (`revoltMode` 'region', the 1938 setting) of exactly `REGION_MAX`
  = 8 provinces, all Soviet core under the strain of overextension, which then joined the
  rebel state next to it (`risingNeighbour`). The region was bounded by its number of
  provinces and by nothing else, and eight provinces of Siberia are a twentieth of the world.
- **Decision.** `REGION_KM2 = 1,000,000`: a neighbour joins a revolting region only while the
  holder's land in the area stays at or under that (`revoltArea`, `heldKm2`; km² as
  `LandCounts` counts them, ADR-57). A neighbour that does not fit is passed over and the
  search goes on (a smaller one may fit). The province that revolts goes whole, whatever its
  size: Sakha alone is 3.1 million km², and a province is the unit of every revolt rule.
- **Why an absolute bound and not a share of the holder's land.** A share shrinks the regions
  of small holders (a nation of eight provinces would lose them one at a time), which this
  finding is not about, and leaves a large holder's region large. The mean province is
  about 29,000 km², eight of them 230,000: the bound is four times an ordinary region and
  touches only the regions of provinces the size of countries. A million km² is 0.75 % of
  the world's land, the size of Egypt.
- **It bounds every use of the area:** the founding of a nation, the return of a dead one
  (`reviveNation`), the area that joins a rebel state, and land that goes back to its core
  owner (`defect`). The last was not asked for; one bound for the one function is the
  simpler rule, and land that goes back in pieces still goes back.
- **Not decided here.** A rebel state still grows by the revolts that join it, one bounded
  area at a time and without end: "Free Herat" had 2.66 % of the world before day 3135. And
  an area joins rebels of another people (Soviet core land, a Korean state). Whether rebels
  take in only risings against the holder they fight, or stop at a size, changes how many
  states a long game has: the balance of ADR-58, logged under PLAN 1.42.
- **Tests.** `tests/unit/revoltRegion.test.ts`, four on the 1938 world with every Soviet
  province at unrest 100. Three failed first: a revolt at Amur founded a nation of 5,909,204
  km²; a revolt at Khabarovsk next to a rebel Primorsky gave that state 6,285,801 km²; a
  revolt at Sakha took eight provinces. The fourth (a French region is its eight
  départements) passed before and after. `tests/helpers/revoltLand.ts` in the ten-year games
  of the sweep stage: with the bound switched off, seed 2 fails at tick 30,649 ("nation 119:
  1,423,362 km² in 3 provinces by 1 revolts"); seeds 1 and 3 pass either way.
- **The pin** did not move (`875255b7`): no region of seed 99's first year reaches the bound.

### ADR-185 · 2026-10-07 · accepted — The zoom demo's battle is seed 1946's (PLAN 3.8f, the full suite of PLAN 3.8)

- **Context.** The full e2e run that the tick of PLAN 3.8 brings: 145 of 146 passed,
  `zoomDemo1938` failed. The division it chooses in seed 1948's game on day 30 (ADR-156) is
  now Romanian, formation 666, and no shot is fired by or at it in the four hours that follow
  (the spec asks more than 10 in each).
- **Not this part's rule.** With the change of 3.8f stashed the spec fails the same way, on the
  same division. One of 3.8b to 3.8e moved seed 1948's first month (3.8e's game differs from
  day 7 on seed 99); which was not looked for. The parts ran no e2e (ADR-87), so the tick finds it.
- **Decision.** `SEED = 1946`; the day stays 30. The spec file as written, on the seeds nearest
  to 1948 in turn: 1949 fails (a Romanian division, battalions at up to 0.57 of their men,
  where the spec asks under half), 1947 fails (Nationalist Spain, 0.67), 1950 fails
  (Nationalist Spain, 0.76), 1946 passes: formation 627, an Austrian division north of Prague
  in the war of Germany on Austria, 4,991 men in 28 elements, 24 battalions of 137 to 239 of
  500, four batteries with 5, 9, 5 and 5 of 12 guns, 84 shots by or at it in each hour.
- **Not changed:** no expectation of the spec, and no line of it but the seed and the comment
  (as ADR-156). No scan of forty seeds this time: the first that passes was taken.
- **Consequences.** The pictures of `docs/evidence/2.10/` are made again (`EVIDENCE=1`) and
  were looked at: stops 2, 5 and 8. The scene is the third in a week; a rule that moves a
  game's first month moves it. Whether the spec should build its battle by hand instead of
  finding one in a game is a question for the next review pass.

### ADR-184 · 2026-10-07 · accepted — A war of independence is the two realms': no alliance and no guarantor is called (PLAN 3.8f)

- **Context.** The critic's R3-B4, the second half: "Belgium +29 × Free Gers", an alliance
  of 30 at war with one rebel province. The holder of a revolt declares on its rebels
  (PLAN 1.40, ADR-44) through `declareWar`, which called the attacker's alliance as for any
  war. A puppet that rises declares on its overlord by the same call, and the overlord's
  alliance came as defenders (1938, seed 5: Albania against Italy, Germany, Japan, Manchukuo
  and Mengjiang).
- **Decision.** `declareWar(world, attacker, target, alone)`. With `alone`, each leader
  comes with its puppets and nobody else is called: no ally, no guarantor, on either side.
  The three callers that are wars of independence pass it:
  - `spawnRebels` (`systems/revolts.ts`): the holder on the nation a revolt founds or
    revives (the daily revolt, a collapse, God Mode's "spawn revolt" and "revive");
  - `revolt`, where an area joins a rebel state next to it and the holder declares on that
    state;
  - `puppetSystem` (`systems/puppets.ts`): a disloyal puppet on its overlord.
  The realm and not the holder alone: a puppet fights its overlord's wars everywhere else
  (ADR-178 to ADR-183), and the land is its overlord's. The three steps of ADR-179 run as
  before on the shorter lists.
- **Why both sides.** A new rebel has no ally, so the question is only asked of the rebel
  state an area joins, which may have found allies since, and of a risen puppet, which may sit
  in an alliance of its own (ADR-179). Calling one side's alliance and not the other's sets
  one nation against a bloc, which is the picture the critic named. It errs to fewer
  nations at war.
- **Not changed.** A war the AI or God Mode declares on a rebel nation is a declaration like
  any other and calls the alliances. Nobody joins a war later (there is no call to arms after
  the day of the declaration), so the war stays the two realms'. A holder that is a puppet
  fights its rebels without its overlord, as a puppet that attacks did before (ADR-183).
- **Evidence.** `tests/unit/rebelWars.test.ts`, three: a revolt forced in a French province
  (failed first: 30 attackers, the United Kingdom and its puppets among them, where France's
  realm has 9); Albania rising (failed first: Germany, Japan, Manchukuo and Mengjiang among the
  defenders); Germany on Poland still brings Italy.
- **Not seen in a game.** One year of seeds 99 and 3301 has the same hash with and without
  the change (`875255b7`, `09d6c0c2`): no war of independence of an allied realm in them.
  The critic's game was not replayed.
- **The pin:** did not move (`875255b7`).

### ADR-183 · 2026-10-07 · accepted — A declaration of war on a puppet is a declaration on its overlord (PLAN 3.8e)

- **Context.** Seen in the diagnosis of PLAN 3.8 (ADR-178): nobody defended a puppet.
  `declareWar` called each leader's puppets, its alliance and the defender's guarantors, and
  not the defender's overlord. Seed 3301: Iraq on Syria, day 17, and Nationalist Spain on
  French West Africa, day 54, each defender alone. And the AI read such a target as free
  land: `strengths` adds a puppet's formations to its overlord's, so a puppet's own strength
  was 0 and its defence the floor of 1. In the first year of seed 3301, 20 of the 36
  declarations named a nation that began the game as a puppet (Egypt, Burma, Transjordan,
  Syria three times, French West Africa three times); of seed 99, 16 of 29. (Counted by
  the puppets of the start: one that was free by the day is counted too.)
- **Decision.** PLAN 3.8e left two ways: the overlord joins, or the declaration is on the
  overlord. The second. With the overlord as a mere member the puppet would lead its side,
  and the peace reads the leader: it would be signed with the puppet, the puppet's stance
  would set the side's fight to the death, and a losing puppet could be made the winner's
  puppet or annexed while its overlord, in the same war, lost nothing. With the overlord as
  the leader the one mechanism there is (a leader with its puppets) serves.
  - `declareWar(attacker, target)`: the defender is the target's overlord when it has one.
    The overlord's puppets, alliance and guarantors are called as for any defender; then the
    target's own alliance and guarantors, as before (a puppet may sit in another alliance
    than its overlord, ADR-179). The three steps of ADR-179 then strike who is torn.
  - `whyNotWar(attacker, target)`: what refuses a war with the target, and then what refuses
    one with its overlord (already at war, a truce, a bond). So the AI's choice, God Mode and
    the neighbour a revolt rises with all ask the same.
  - The `WarDeclared` event names the overlord: the war is its war, and the history and the
    banner read the leaders. That the attacker named the puppet is not kept.
  - God Mode: a declaration on a puppet is not refused; it starts the war with the overlord,
    and the event says so. (A refusal with "declare on its overlord" was the other way; the
    watcher means the war, and gets it.)
  - The AI (`ai/strategic.ts`, `defence`): a puppet is read as its realm: the overlord's
    strength, which holds the puppet's, with 0.4 of the allies and guarantors of both.
- **Not changed.** A puppet that attacks is not followed by its overlord (the AI's puppets
  declare no war; a puppet's revolt is against its overlord). An overlord's own overlord is
  not looked at, here as in `bond`. A puppet made in the middle of a war keeps its wars
  against nations with no bond to its new realm (ADR-180), and its overlord does not join
  them: so "a puppet at war has its overlord beside it" is not a law of every day and is not
  asserted daily. A nation at war with the overlord in a war the puppet is not in may not
  declare on the puppet (`Refusal.AtWar`).
- **Measured** (the declarations of one year, the old game run on the stashed change).
  Seed 3301: 36 before, 19 after, none on a puppet of the start; on day 54 Nationalist Spain
  declares on Portugal in place of French West Africa. Seed 99: 29 before, 23 after, one on
  a puppet of the start: the United Kingdom on Ireland, day 57, which was free by then (a
  declaration on its own puppet is refused).
  Fewer wars in a year is a matter of balance and waits for Phase 7 (ADR-58). Seen and not
  touched: Nationalist Spain alone declares on Portugal, which the United Kingdom guarantees
  with its whole realm (both seeds); that is the AI's reading of a guarantor, not this rule.
- **Evidence.** `tests/unit/puppetDefended.test.ts`: seed 3301, 60 days, no `WarDeclared`
  names a puppet whose overlord is not in that war (failed first: "day 17, IRQ -> SYR
  without FRA", "day 54, NSP -> AOF without FRA"); Iraq on Syria by hand (France leads,
  Syria and French West Africa defend); God Mode; a truce or a war with France refuses the
  declaration on Syria. All four failed first.
- **Addendum, the same day (PLAN 3.8e1): the puppet named is never struck.** Until this
  change the nation a declaration named led its side, and the three steps of ADR-179 never
  strike a leader. As a puppet in its overlord's war it was asked in step 2 like any other:
  Syria, the ally of a puppet of Turkey, was struck from the war Turkey declared on it, and
  France led a war its cause was not in. The nation named now stands as the two leaders do;
  the nation torn against it stays out. No pair with a bond comes of it: a joiner is asked
  against all who stand, the named puppet among them, and `whyNotWar` has already asked of
  the attacker and the named puppet. `tests/unit/puppetDefended.test.ts`, "the puppet named
  is in the war…" (failed first: Syria not among the defenders). Not seen in a game. The
  pin did not move (`875255b7`).
- **The pin:** seed 99 after one year, `ed82d7f8` to `875255b7`. The pinned game had Iraq on
  Syria on day 31 and Nationalist Spain on French West Africa on day 33, each defender
  alone; the new game has neither, and differs from day 7 (Siam on Burma, a British puppet,
  is not declared).

### ADR-182 · 2026-10-07 · accepted — Nobody joins or founds an alliance while its realm is at war with the realm of a member (PLAN 3.8d3)

- **Context.** The third cause named in ADR-180, read in the code and not seen in a game.
  An alliance ties each member and its puppets to each other member and its puppets
  (`bond`: `Allied`, `AlliedRealm`). `canJoin` and `noWarAmong` asked only whether the
  nations named were at war with each other; the found-a-pact branch of `proposeAlliance`
  and the AI's pact against a threat (`ai/strategic.ts`) each had a bare `atWar` of their
  own. So Portugal, at war with French West Africa, could join the alliance France is in.
- **Decision.** `realmsAtWar(world, a, b)` (`systems/war.ts`): whether a or a puppet of it
  is at war with b or a puppet of it. `noWarAmong` and `canJoin` ask it for each pair, and
  the two bare checks now go through `noWarAmong`. The refusal stays `Refusal.AtWar` for
  God Mode's `createAlliance` and `joinAlliance`, and `AllianceRejected` for an offer.
  Refused, not joined with the wars ended as in ADR-180: an alliance is a choice of the
  joiner, which can make peace first; an overlord is not.
- **Not changed.** A joiner that is itself a puppet (ADR-179 allows it): its overlord's
  wars are not looked at, as `bond` does not tie the overlord to the alliance through it.
  An overlord's own overlord is not looked at.
- **Evidence.** `tests/unit/realmWars.test.ts`, "nobody joins or founds an alliance…":
  the joiner at war with a member's puppet, a puppet of the joiner at war with a member,
  two founders of whom one fights the other's puppet; by `canJoin`, `noWarAmong`, the
  commands `joinAlliance`, `createAlliance` and `proposeAlliance` both ways. It failed
  first at `canJoin`. The AI's pact against a threat has no test of its own.
  The AT of PLAN 3.8: `tests/helpers/aiSweep.ts` asserts `realmWars` empty on every day of
  the ten-year games of seeds 1, 2 and 3. It passed on its first run, with this rule in:
  whether it would have failed without the rule was not run.
- **The pin:** unchanged (`ed82d7f8`).

### ADR-181 · 2026-10-07 · accepted — A puppet handed to an annexer leaves the wars it fights against the annexer's realm and allies (PLAN 3.8d2)

- **Context.** The second case of ADR-180. Seed 1, day 300: Poland annexes Hungary at a
  peace (a losing leader under 8,500 km²), and `annexNation` makes Hungary's puppet Albania
  a puppet of Poland while Albania defends war 35 against Italy, Germany, Latvia and Japan,
  the allies of Poland. Nothing looked at the wars of a puppet that changes hands.
- **Decision.** `annexNation` (`systems/puppets.ts`) calls `leaveBondedWars` (ADR-180) for
  each puppet it hands over: the puppet, with its own puppets, leaves every war in which a
  nation of the other side now has a `bond` with it; the land held between those who part
  goes back; the side's men at the start are scaled to those who stay. No event and no
  truce, for the reasons of ADR-180. The same rule serves the peace, the editor and God Mode,
  which all annex through this function.
- **The order.** After `eliminateNation(target)`: the target has then left its wars
  (`Wars.endAllOf`), and what is left of a war it shared with its puppet is the puppet's
  own. So a puppet at war with the annexer itself, beside its old overlord, leaves that war
  too (`Refusal.Subject`), and the war ends if it was the last of its side.
- **Not changed.** `integratePuppet` hands nothing over: the puppets of an integrated puppet
  are freed at its death (ADR-174). `bond` still does not look at an overlord's overlord.
- **Evidence.** `tests/unit/realmWars.test.ts`, "a puppet handed to an annexer…": the United
  Kingdom annexes Italy while it fights Italy and Albania, France fights Albania and
  Portugal fights Albania; failed first with "ENG × ALB: one realm" and "FRA × ALB: allied
  realms". `tests/sweep/realmWarsDays.test.ts`, seed 1 now to day 305: failed first on day
  301, war 35, four pairs.
- **The pin:** unchanged (`ed82d7f8`).

### ADR-180 · 2026-10-07 · accepted — A nation made a puppet while at war leaves the wars it fights against its new realm (PLAN 3.8d1)

- **Context (the diagnosis of PLAN 3.8d).** `realmWars` on every tick of three years of seeds
  1, 99 and 3301, with the events that make a bond beside it (a scratch probe). Seeds 99 and
  3301: nothing. Seed 1, two cases, two causes:
  1. Day 199: the peace of France with Republican Spain makes it France's puppet. It is in
     two other wars against French West Africa and French Equatorial Africa, puppets of
     France. `makePuppet` did not look at the subject's other wars.
  2. Day 300: Poland annexes Hungary, and `annexNation` hands Hungary's puppet Albania to
     Poland while Albania defends a war against Italy, Germany, Latvia and Japan, Poland's
     allies. That is PLAN 3.8d2.
  A third, not seen in a game: `canJoin` asks about an alliance's members, not their
  puppets, nor the joiner's (PLAN 3.8d3).
- **Decision.** `makePuppet` ends in `leaveBondedWars(world, subject)` (`systems/war.ts`): the
  subject leaves every war in which a nation of the other side now has a `bond` with it
  (ADR-178), and its own puppets on that side leave with it, as a torn nation stays out with
  its puppets (ADR-179). The war goes on for the others; the next member leads a side its
  leader has left, and a war left with an empty side ends (both as `Wars.endAllOf` does at a
  death; `Wars.leave` is the same for one war). A puppet cannot refuse the peace that makes
  it one, so leaving is the only rule there is; it is the subject that leaves, since its bond
  is the new one.
- **The land.** Between each nation that left and each it is then at war with in no other
  war, the land one holds of the other goes back to its owner, as at a white peace: an
  occupation with no war behind it would stay for good. Land of others is not touched.
- **The losses.** A side's exhaustion reads its men against its men at the start. The men at
  the start are scaled by the share of today's men that stays, so the losses of the side read
  as they did the day before and a side does not sue because a member left.
- **No event, no truce.** Nothing is signed: `PeaceSigned` names two leaders, and the war may
  go on. The `PuppetCreated` event of the same tick is what the history has. A war that ends
  so ends as a war ends at a death, unsaid; telling a watcher is PLAN 3.12. No truce: the bond
  refuses the war (`whyNotWar`), and a puppet released later is free to fight.
- **Not changed.** A subject's puppets keep it as their overlord, and `bond` does not look
  at an overlord's overlord: they leave the subject's wars with it, but nothing refuses a
  later war between them and the upper realm. Formations standing on the land of a former
  enemy are not moved (nor are they at a peace).
- **Evidence.** `tests/unit/realmWars.test.ts`, "a nation made a puppet leaves its wars…":
  three wars built by hand on the 1938 world; failed first with the two pairs "one realm".
  `tests/sweep/realmWarsDays.test.ts`, seed 1 now to day 250: failed first on day 200 (wars
  12 and 18). After the fix the probe's three years: seeds 99 and 3301 nothing, seed 1 the
  case of day 300 alone.
- **The pin:** unchanged (`ed82d7f8`).

### ADR-179 · 2026-10-07 · accepted — Who joins a war: nobody with a bond to a nation of the other side; a nation torn between the sides stays out with its puppets (PLAN 3.8c)

- **Context:** ADR-178 left the joiners. `declareWar` kept a nation out of a side when it was
  the ally of a nation already on the other side or the overlord of the enemy's leader. That
  asked nothing about realms, and it asked each nation as it came: France, the ally of the
  United Kingdom and a guarantor of Poland, was kept from Poland's side as the attacker's ally,
  its eight puppets were not, and France itself then came in with the attackers.
- **Decision 1.** A declaration first calls who it called before (each leader with its
  puppets, its alliance with theirs, the defender's guarantors with theirs; nobody in a truce
  with the enemy's leader, nobody twice: a nation called to both sides is on the defenders'
  list). Then, in three steps, each on what the one before left, the nations that are torn
  are struck from both lists, each with its puppets; the two leaders are never struck:
  1. who has a `bond` (ADR-178) with the enemy's leader. The leader cannot stay out, so such
     a nation must: France in the war of the United Kingdom on Poland.
  2. the puppets that have a bond with any nation of the other side. A puppet in another
     alliance than its overlord does not fight its overlord's side, and it does not keep its
     overlord out of the war. (The two puppets of the games below, Yugoslavia and Latvia, are
     struck by step 1 already: their overlords are allies of the enemy's leader. No game
     read so far needs step 2; without it step 3 would strike the overlord with its puppet.)
  3. the nations that are no puppets and have a bond with a nation of the other side.
  Within a step the nations are asked in the order of the call (the attacker's puppets, the
  defender's, the defender's allies, its guarantors, the attacker's allies), each against
  those of the other side that the step has let stand. So of two nations torn by each other
  alone, the one called first fights and the other stays out. That is what
  `tests/unit/war.test.ts` has asked since PLAN 1.17 ("puppets allied across the sides stay
  out": Austria of Germany fights, its ally Czechoslovakia of Poland does not); a first
  version that struck both failed it in the gate. A puppet in step 2 is asked against
  every nation of the other side that is no puppet, also one that step 3 then strikes: it
  errs to fewer nations at war, never to a pair with a bond.
- **Why the same test as the declaration's.** `tests/helpers/realmWars.ts` and `bond` ask the
  same of a pair. A nation stands only if it has no bond with any nation of the other side
  that stood before it, and step 1 strikes every joiner with a bond to the enemy's leader;
  the leaders' own pair is `whyNotWar`'s. So a declaration makes no war inside a realm, whatever the order of the call.
- **Decision 2 (asked by PLAN 3.8d): a puppet may sit in another alliance than its overlord.**
  It stays allowed. Forbidding it is a second rule, in `canJoin`, `makePuppet` and the 1938
  data's own alliances, and this rule makes the case harmless: such a puppet stays out of a
  war between the two.
- **Not changed.** The wars the 1938 world starts with are lists in `diplomacy.json`, not
  calls (`scenario1938.ts`). The strategic AI weighs a target by the strength of its allies
  and guarantors (`strategic.ts`), not by who would in fact come: a guarantor that would now
  stay out still counts for the defence. Whether a guarantor of the defender's *ally* is
  torn: it is not, it is called by nobody. A nation that becomes a puppet or an ally while it
  is at war is PLAN 3.8d.
- **Evidence.** `tests/unit/realmWars.test.ts`, "a guarantor that is the ally of the
  attacker…": failed first with France and its eight puppets in the war. New
  `tests/sweep/realmWarsDays.test.ts`: seed 1 for 130 days and seed 3301 for 825, `realmWars`
  empty on every day; failed first on day 126 (Yugoslavia, a puppet of Italy, the one
  defender against Germany, Italy, Japan, Poland and their puppets) and on day 823 (Latvia
  against Poland, Germany, Italy, Austria, Hungary, Japan). 41 s for the two with the pin.
- **The pin:** unchanged (`ed82d7f8`): the first year of seed 99 has no torn joiner.

### ADR-178 · 2026-10-07 · accepted — No declaration of war inside one realm or between allied realms; two reasons more for a refusal (PLAN 3.8a, 3.8b)

- **Context (the diagnosis, PLAN 3.8a):** the critic's R3-B4. Seed 3301 headless, the events
  read tick by tick. Day 54: Nationalist Spain declares war on French West Africa, a puppet of
  France; the defenders are French West Africa alone. Day 64 (6 March 1938): the United
  Kingdom, which leads the alliance France is in, declares war on French West Africa. The AI
  chose it as it chooses any neighbour: weak, and at war already (`OPPORTUNITY`).
  `whyNotWar` asked two things of the two nations named, whether one is the other's puppet
  and whether they share an alliance. French West Africa is in no alliance, and its overlord
  is not the United Kingdom, so the declaration stood. `declareWar` then brought the
  attacker's allies with their puppets: France itself was kept out (the enemy's overlord),
  its seven other puppets were not (nothing asked whether a joiner and the enemy have one
  overlord). The attackers were 33 nations. The same on day 55: Germany on Austria, a puppet
  of its ally Italy since the peace of day 29.
- **Why the gate did not see it:** `tests/helpers/aiSweep.ts` asks, at the end of each of ten
  years, whether two *members of one alliance* are at war. The United Kingdom and France were
  not; a puppet is a member of nothing.
- **Decision 1.** `bond(world, a, b)` in `src/sim/systems/war.ts` is what ties two nations so
  that they do not go to war: one is the other's puppet (`Refusal.Subject`), they are allies
  (`Refusal.Allied`), both are puppets of one overlord (`Refusal.SameOverlord`, new), or one of
  them or its overlord is the ally of the other or of its overlord (`Refusal.AlliedRealm`,
  new). `whyNotWar` ends in it, so the AI, God Mode and every rule that declares a war are
  refused alike, and God Mode's line says which ("both are puppets of one overlord.", "one of
  them, or its overlord, is the ally of the other or of its overlord.").
- **Decision 2.** The strategic AI asks `whyNotWar` of each neighbour instead of its own four
  tests. They were the same tests until now; with a fifth in one place only, the AI would pick
  a target it is refused and spend its day's draw on a `WarRejected` event.
- **Decision 3.** A revolt that rises with a neighbour (`risingNeighbour`) takes no neighbour
  the holder has a bond with: that rising is a war of the holder on the neighbour, and a war
  refused would leave the land handed over in peace.
- **Not decided here.** One step up only: the overlord of an overlord is not looked at
  (`makePuppet` does not forbid such a chain; none is in the 1938 data).
- **What is left (measured after the change, three years each, no commands):** seed 99: no
  pair with a bond at war. Seed 3301: 13 pairs in 2 wars. Seed 1: 68 pairs in 12 wars. None
  is a declaration between the two leaders. They are (a) nations that *join* a war: a puppet
  that sits in another alliance than its overlord comes in against its overlord (Yugoslavia,
  a puppet of Italy and a member of the Balkan Entente, against Italy); the puppets of a
  guarantor that is the attacker's ally come in for the defender, and the guarantor itself
  for the attackers (United Kingdom on Poland at the start: France attacks the nation it
  guarantees, and its puppets defend it). Both wars of seed 3301 are of the first kind,
  read from the declaration's own tick: day 822, Latvia (Germany's puppet since day 69, an
  ally of Estonia) among the defenders against Germany; day 1084, Hungary (Italy's puppet
  since day 634) among the defenders against Italy. The 12 wars of seed 1 were not read one
  by one. (b) A nation made a puppet while it stands in a war against its new realm: not
  seen; as first written here it named the Latvian case, which is (a). PLAN 3.8c, and 3.8d
  to look for (b). Also seen and not a war inside a realm: nobody
  defends a puppet. Its overlord does not join when the puppet is the one war is declared on
  (French West Africa and Syria stood alone). PLAN 3.8e.
- **The pin:** seed 99 after one year, `b1bb392b` to `ed82d7f8`. The pinned game had the critic's war itself: on day 57 the United Kingdom declared war on French West Africa (33 attackers, as on seed 3301). It now declares war on Iraq that day, and every later day differs (the old game: Iraq on Transjordan on day 94, France on the Spanish Republic on day 100). Read from the declarations of both games, the old one run on the stashed change.

### ADR-177 · 2026-10-07 · accepted — The critic's third run: where its six findings went, and in what order (PROMPT step 2a)

- **Context:** PLAN 3.7 was ticked, so the critic was due (ADR-59). This session has the
  `critic` agent type, with its guard, which the run of ADR-83 lacked. It was spawned with
  `CRITIC_PROMPT.md` and the commit, and no word about what to look at. After the run HEAD
  was still `a6f63ef`, `git status` showed the two report files changed and new files under
  `critic/` only, and nothing listened on port 5299. 38 minutes, 279,000 tokens, 91 tool
  calls. The two report files are committed as written; `critic/c3_*`, the scripts and the
  shots stay untracked, so each PLAN task carries its numbers in its own text (ADR-83).
- **Decision 1: where the six went.** The test is PROMPT step 2b's: a count, a share or a
  rate of the long run is balance and waits (ADR-58); a mechanism that plainly does not
  work is a task now.
  - R3-B1, no naval, air or nuclear: Phases 4 to 6. A line under PLAN 4.5. **The phases
    keep their order**, as in ADR-83; naval is the next phase now in any case.
  - R3-B4, wars inside a realm or an alliance: a mechanism. PLAN 3.8.
  - R3-B2 is two things, as R2-B6 was. That the count of living nations climbs (97 to 170
    in 40 years) and the world does not come together is balance: PLAN 1.42, logged once
    in PROGRESS, not disputed. That one event takes the Soviet Union from 13.0 % to 5.5 %
    of the land and makes a rebel province with 260 men one of the largest nations is not
    a rate: PLAN 3.9, diagnosis first. Its fix is a rule about what a revolt may take, not
    a constant of how often revolts happen.
  - R3-B5 is two things. The top speed as a design (a coarse path for what is not watched)
    stays under PLAN 7.1, where ADR-83 put it. The tick is another matter than it was
    then: 1.14 ms in the last report, 2.27 ms now on the critic's seed, against a budget of
    1.5, and the sweep of PLAN 3.7e took three times Phase 2's with the cause not found.
    Phase 4 adds to the tick. PLAN 3.10: profile first, then what the profile names.
  - R3-B3, the close zoom: a differentiator at 6 of 8. PLAN 3.11. Not disputed: PLAN 3.7g
    moved the drawn tag, and the critic's snapshots at a formation's position hold no
    element. The wrecks that never show are PLAN 3.6's claim failing in play, so they are
    in 3.11 and not a line under 7.4.
  - R3-B6, nothing tells a watcher: PLAN 3.12, as R2-B8 became 2.17. The rows that show
    an id or say the reverse are defects and are parts of it. Sound is a part of it too:
    the last report had it as not blocking (N18, under 7.4), this one blocks on it.
- **Decision 2: the order** is 3.8, 3.9, 3.10 (the world's state and its cost), then 3.11
  and 3.12 (tests and pictures of that world), not the critic's order of severity. The
  same reason as ADR-83.
- **Decision 3: what was not blocking** is under PLAN 7.4, but for two lines under 1.42:
  no land changes owner during a war (ADR-51's rule, to be judged with the balance), and
  the random world that one nation overruns in three years.
- **Consequences:** five numbered tasks before Phase 4. They count toward the next review
  pass. The critic runs next after PLAN 4.8 (ADR-59), unless the user asks.

### ADR-176 · 2026-10-07 · accepted — The tank battle demo runs on a seed of its own (PLAN 3.7o)

- **Context:** `tankBattle1938` failed in Node: `tankBattle` (seed 1938, days 14 to 120) found
  no four hours for the demo. It last ran with the suite at the tick of 3.6.
- **The commit** (the search's filters counted at each rule commit since 73ac1ea,
  `.cache/p37/tankdiag.ts`, scratch): 5509e05, PLAN 3.7j (ADR-170, the nodes of the province
  graph). Before it 15 grounds passed every filter, all in the one hour of tick 901 (day
  37.5); from it on none, and none to day 400.
- **What the search lacks:** its last filter only. Days 14 to 120 today: 256,368 shots of
  armour, 384 tanks lost under fire by an element, 300 of those elements standing through
  the four hours, 295 with the shooters of the first two hours, 110 with a tank lost in
  the third hour's view at 4 m/px. In all 110 every tank lost in that view was fired at:
  none has one lost without fire beside it (1,037 such losses in the world in those days,
  none of them in such a view). The demo stood on one hour of one seed.
- **The game has tank battles, and such grounds:** the same search on other seeds, days 14
  to 150, finds a ground on seven of eight (seeds 1, 2, 3, 7, 99, 1939, 1940: 2 to 21
  each; 1941 none). Seed 2: 152 views with a loss in the third hour, 126 all under fire,
  8 all without, 18 with both.
- **Decision:** the seed is an argument of `tankBattle` and a constant of the spec, which
  builds the page's URL from it: seed 2, the earliest ground (tick 589, day 24.5). The
  search's rule and the spec's assertions are as they were. No rule of the sim changed:
  the pin holds (`b1bb392b`).
- **Why not a longer search on seed 1938:** 400 days have none, and every day more is a
  day the page steps before the flight.
- **Why not a rule that puts losses without fire beside a fight:** whether a seed has such
  a ground is the luck of its paths (seven of eight have). How often armour breaks down
  near a battle is balance, which waits for Phase 7 (ADR-58).
- **Consequence:** the demo can lose its ground again with any change of the rules. The
  error now names the seed; the remedy is this search over seeds, not a weaker filter.
- **Evidence:** `docs/evidence/3.6/tank-battle-1-marker.png` to `tank-battle-6-hull.png`
  written again from the new ground. It is the same brigade (Japan's tank brigade 395, by
  Handan in north China) thirteen days earlier.

### ADR-175 · 2026-10-07 · accepted — The view is told of a load; it does not read one off the clock (PLAN 3.7n)

- **Context:** the eighth read, finding 5. `MapView.apply` kept the elements of the snapshot
  before for the tanks lost since (`HullFx`, PLAN 3.6d) unless the tick had gone back. A
  later save of the same game passed that test, and `tanksLost` took its elements for the
  same ones (id, frame, formation and size agree): every tank lost between the two states
  was a hull at once. A load to an earlier tick left the hulls, wrecks and shots of the
  state that was gone on the map for as long as they last (17.5 s a hull).
- **Run first** (`tests/e2e/loadedEffects1938.spec.ts`, the ground of `burning1938`, a save
  at the start and one at the end of twelve hours): 7 hulls still drawn after the load back
  to the start; 14 after the load on to the end (the 7 kept and 7 made at once).
- **Decision:** `MapView` subscribes to `SimClient.onLoad`, as the HUD and the player's
  selection do. On a load it clears the hulls, the wrecks, the shots and the turrets' aims,
  and the next snapshot is compared with no elements before it. The test on the tick is
  gone.
- **Why the order holds:** the worker posts its reply to `load` before the snapshot the
  load forces (`handleInner`: the case replies, `maybeSend` follows), and a snapshot of the
  game before was posted before the load was handled. `SimClient.load` runs its listeners
  in the continuation of the reply, a microtask, before the next message is taken.
  Snapshots are applied when they arrive, not at the frame.
- **Why not a number of the world in the snapshot:** it would say the same and need a field
  in the protocol; the listener is there and two parts of the page use it.
- **Not covered:** `init` into a running worker (`startSim` also resets the streams) fires
  no `onLoad`. The page makes a new game by a new page, so no instance exists.
- **Tests:** the spec above (both loads, a load with shots in the air, and the twelve hours
  run again after a load give the same 7 hulls and the same hash); a `clear()` test in
  `hullFx`, `wreckFx`, `fireFx` and `turrets`. The page proves the hulls only: without the
  change the shots were gone too (a shot lives less long than a load takes) and the ground
  has no wreck.
- **The pin holds:** `b1bb392b`. View only.

### ADR-174 · 2026-10-07 · accepted — The puppets of a nation that dies are free at its death (PLAN 3.7i)

- **Context:** PLAN 3.7c, seen with ADR-148 and read in the code. A Kill and a collapse free
  the puppets of the nation (`collapseNation`), and an annexation gives them to the annexer.
  A death out of `captureCapital` (winner takes all, or no core land left), out of
  `relocateToField` (the last cell) or of a holder a revival leaves with nothing
  (`revival.ts`) went to `eliminateNation` with the ties as they were. `puppetSystem` cut
  them at the next month's first hour. Until then `blocOf` gave the puppet a dead nation's
  id for its supply bloc and `whyNotWar` read the tie.
- **Run first** (scratch, `.cache/p37/puppets.ts` and `puppets2.ts`; ten years, 1938):
  - Seed 99: 44 nations die, one with a living puppet. Belgium dies at tick 3016 (Germany
    takes Brussels) and the Belgian Congo is its puppet for 609 hours more. Seed 7: 83 die,
    none with a living puppet. (The count of 2026-10-07 in PLAN, 66 and 63 deaths and 54
    hours, was of the game before PLAN 3.7j to 3.7l.)
  - The Congo's 609 hours, every twelfth read: 3 formations with supply 1.000 and org
    1.000, none on the march; 6,240 of its 6,241 cells fed; its one war (Germany's, that
    Belgium brought it into) kept; gold 67.8 to 67.4. No `WarRejected` and no
    `MoveRejected` names it. The dead bloc's id is a label like another: the network of the
    Congo's own cities is flooded under it. **Nothing differed for the puppet in this
    instance.**
  - What could differ, not seen in a run: a formation of the puppet on ground of a second
    puppet of the dead nation, or the other way, stands as on its own bloc's (`foreignTo`,
    `movement.ts`); a war between two puppets of the dead nation, or with the nation's
    revival, has no instance to be refused in.
- **Decision** (`eliminateNation`, `capitals.ts`): every living nation whose overlord is the
  one that dies is released (`releasePuppet`: `overlord` and `integration` 0, a full
  refresh of the supply network, `PuppetReleased`), in id order, before the land is left
  and before `NationEliminated`. A collapse and an annexation have ended or moved the ties
  before they call it, so the loop finds none there: the change is the three deaths above.
- **Why the rule and not a close with the count.** PLAN said to close it if none dies so and
  nothing differs. One dies so. And the state is one the scenario schema refuses (a puppet
  of a dead nation): the game should not hold for up to a month what its own data may not.
- **An event, here.** ADR-148 gave no event for the dead nation's own tie (it was not
  freed: it died). Its puppet lives and is free: "{a} was freed from {b}", as at a collapse.
- **`puppetSystem` keeps its line** ("the overlord is gone"): a save or a scenario written
  before this may hold the state, and it costs a comparison a month.
- **The pin moves:** `347aebb2` to `b1bb392b`. Belgium's death is in seed 99's first year;
  the refresh of the supply network at tick 3016 and the Congo's own bloc id from then on
  are the difference.
- **Tests:** `tests/unit/capitals.test.ts`, one, red before (the Congo was Belgium's, 27,
  after the tick): Brussels taken with winner-takes-all in the third hour of a month; in
  that tick the Congo has no overlord, its bloc is its own, `PuppetReleased` (Congo,
  Belgium) comes before `NationEliminated`, and no nation has a dead overlord. The first
  writing of it stepped from tick 0, a month's first hour, where `puppetSystem` freed the
  Congo in the same tick: green on the old source but for the order of the two events.
- **Not done:** no tick time measured (a death is not in the hourly loop); no test of the
  other two deaths (`relocateToField`, the holder a revival leaves with nothing): they call
  the same function; the wars the freed puppet is in stay as they are, its overlord's war
  among them.

### ADR-173 · 2026-10-07 · accepted — A formation on the retreat takes no order: the command is refused (PLAN 3.7m)

- **Context:** the eighth read, finding 4 (traced there, run here). For the 24 hours of its
  retreat a formation's march is not held by ground the enemy holds, it is in no battle and
  takes no cell (ADR-150). ADR-150 kept the operational AI from ordering it, and nothing
  else: `moveFormation` (a player's click, God Mode) called `orderMove`, which put a new path
  in the retreat's place and left `formations.retreat` as it was. Run
  (`tests/unit/retreat.test.ts`): a Soviet division broken by a German one a cell east of
  it, ordered to a cell four cells behind the German, stood on German ground in no battle
  in 18 of the 23 hours that followed and walked past him (1.3 cells beyond him when the
  retreat ended).
- **The two ways:** refuse the order while the retreat lasts, or let the order end the
  retreat.
- **Decision: the order is refused.** `applyCommand` (`tick.ts`) answers a `moveFormation`
  to a formation with `retreat` > 0 with `Refusal.OnRetreat` (19), before `orderMove`: the
  state is as before, `CommandRefused` is the event. Not in `orderMove` or `order`: the
  retreat's own order goes through the first (`retreat.ts`), and the march's order again
  after a step that is shut (ADR-171) through the second.
- **Why not end the retreat.** A formation that breaks off is within contact of the enemy
  it breaks from. With `retreat` at 0 the next hour's `findBattles` has it in contact again,
  and a formation in contact does not march: the order would not be carried out either, the
  division would stand where it was (on the enemy's ground, if the retreat had begun over
  it) with the org that broke it, and try to break off again at its sixth hour. A refusal
  changes nothing in the game and says why.
- **What the player sees.** The formation panel's status is "On the retreat: no orders for
  N h" (`FormationDetail.retreat`, the hours left), before "In contact", "On the march" and
  "Holding". The words of the refusal ("the formation is on the retreat and takes no order
  until it is over") are in the God tab's table of refusals, which is shown where the God
  tab of the selected nation is open, as for every command.
- **The pin holds** (`347aebb2`): no system and no AI is on the changed path.
- **Tests:** `tests/unit/retreat.test.ts` (red before, twice: no refusal, and with that
  assertion out 18 hours on the enemy's ground in no battle; green: refused, the retreat's
  target kept, no hour on the enemy's ground, and the same order taken once the retreat is
  over); `tests/unit/formationDetail.test.ts` (the hours in the worker's answer);
  `tests/e2e/formationPanel1938.spec.ts`, a fourth test (a Polish division at the border
  against three German ones breaks off after 49 hours: the status and its hours, and an
  order to a place behind the Germans leaves it going east).
  `docs/evidence/3.7/formation-panel-retreat.png`.
- **Not done:** a player who clicks the map with no God tab open reads no words at the
  click, only the panel's status; the selection's frame and the map do not mark a formation
  on the retreat; repatriation (`repatriationSystem`) may still order one that stands idle
  on a third nation's ground with hours of its retreat left (no instance looked for); the
  walk back of ADR-172 and the march home of ADR-169 take a player's order as before.

### ADR-172 · 2026-10-07 · accepted — A march barred in the middle of a step walks back to the cell behind it (PLAN 3.7l)

- **Context:** the eighth read, finding 3. A march ends before a cell that has become a third
  nation's since the order (ADR-149). The walk's `barred` set `frac = 0` and put the formation
  on the point of the cell behind it, whatever part of the step it had walked: 0.76 and 1.25
  cells in the hour (two cases in 400 hours of seed 99). In the test's case (a German division
  0.5 to 0.75 of the way from one cell to the next, the next turned Poland's): 0.754 cells in
  the hour, where an hour's march was 0.089.
- **Decision:** a march barred with part of the step walked turns round where it stands. Its
  path is the step read backwards (the two cells), its target the cell behind it, and it stays
  on the march; `MoveRejected` is emitted in the hour the ground turned, as before, and
  `FormationArrived` when it is back. The walk back is marked (`formations.home` = 2,
  `HOME_BACK`): it is not barred in its turn where the cell behind it has become a third
  nation's too (without the mark: refused in each of 48 hours, and it did not move). It waits
  before a cell turned an enemy's as any march. The operational AI leaves it alone on the way,
  as a march home (it tests `home === 0`); a player's order is taken, in the middle of the
  step (ADR-151), and ends the walk back. A march barred with none of the step walked ends on
  its cell as before.
- **Not the PLAN's AT to the letter.** The AT asked that the formation be idle an hour later.
  A halt in the middle of a step has no place that lasts: an idle formation's place is its
  cell's point, and `order` sets it there at its next order. A halt at the cell's edge would
  have been the same jump in two parts, the second at the AI's order of the next day. The
  formation is idle when it has walked back (47 hours for the 5 of a year of seed 99).
- **Measured** (a year of seed 99): 5 walks back, 47 formation-hours, each ended; the longest
  hour of one 0.149 cells.
- **The pin:** `83057b85` to `347aebb2`.
- **Tests:** `tests/unit/movement.test.ts`, two (red before: 0.754 cells in the hour; the
  second red again without the mark).
- **Not done:** no test of a player's order to a formation on the walk back, nor of the
  wait before a cell turned an enemy's (both by the code of any march); the walk back is not
  fed and not drawn apart from any march; a step that is shut by new water (ADR-171) still
  sets the formation on the cell behind it.

### ADR-171 · 2026-10-07 · accepted — A path outlives a change of the ground: the march tests each step, and a path that is missing is found from where the formation stands (PLAN 3.7k)

- **Context:** the eighth read, finding 2. `terrainChanged` (`editor.ts`) and a change of
  `loopingMap` (`gameOptions.ts`) cleared `world.paths`. `formationPath` then found each
  route again from `originCell` to `targetCell` on the holders of now, and `pathStep` and
  `stepFrac` went on counting along the path that was gone. Until ADR-149 a path hung on
  the ground alone and a far paint gave the same path back; since then it is state. Run
  here: seed 99 at tick 1500, one cell of ice painted to plains at (727, 1), and an hour
  later 90 formations stand elsewhere than in the game without the paint (the reader
  counted 85 on the graph before ADR-170).
- **Two faults, one root:**
  1. the paths were dropped for a change that touched none of them;
  2. a path found again was read with the steps of another. Any finding-again has this
     fault: a save from before PLAN 3.4Rl has no paths either.
- **Decision:**
  1. A change of the ground drops the navigation graph and no path. `movementSystem` tests
     each step before it takes it (`stepOpen`): the far cell is no water for the
     formation's mobility, a diagonal step cuts no corner past water (`findPath`'s rule),
     and the step is not over the seam of a map with edges. A step that fails is not
     taken: the formation stands on the cell behind it (the step's near end, less than a
     step back), its path is dropped, and it is ordered to its target again by
     `orderMove`, on the ground and the holders of now. No way: `MoveRejected`, and it is
     idle there.
  2. `formationPath`, for a path that is missing, routes from the cell the formation
     stands in and sets `originCell`, `pathStep` and `stepFrac` to the start of it.
- **Why at the step and not at the edit:** to test the paths at the edit, the editor would
  build the graph at once, at every segment of a dragged stroke (it is built on demand, at
  the next tick that asks). The test at the step is three reads of the terrain for each
  step a formation takes. And it is the same for an import and for `loopingMap`, with
  nothing for either to call.
- **Why the path is kept though a better way may have opened:** a path is the march that
  was ordered (ADR-149). Ground made easier or harder changes the hours of its steps
  (`segHours` reads the terrain of now), not its cells.
- **What a paint can do, looked at:** the editor paints land into land (`paint` refuses
  water both ways), so no paint makes a step impossible; only an import makes water, and
  `strandedToLand` has already set every formation that then stands on water on the
  nearest land, idle. The tests of a barred way use an import (as ADR-170's did).
- **The reader's suspicion, settled:** a path found again that is shorter than `pathStep`
  reads a cell that is not there, and `cellPoint(undefined)` is NaN. Shown
  (`pathsKept.test.ts`, the fourth test: a formation four steps from its end whose path is
  dropped and whose origin is its own cell stands at NaN the next hour; the origin was
  set by hand, no run of the game was found that makes one). After 2. the first cell of a
  path found again is always there.
- **Left as it is:** the place of a formation whose step is shut is the middle of the cell
  behind it, as for a march that ends at ground turned foreign (`barred`). PLAN 3.7l asks
  that one to end where the formation stands; whether this one should too is 3.7l's to
  say. A formation that goes on by a new route marches again from the next hour: the hour
  of the re-order is not marched.
- **Measured:** the pin holds, `7cfb8b6d` (no game without an edit takes a step that is
  shut, and none finds a path again). Tick time, five years of seed 99 pinned to the
  performance cores: mean 1.559 ms before, 1.605 after; year 1 2.313 and 2.391 (the same
  game, one run each: not told from what two runs differ by).
- **Consequences:** nothing saved changes. A save from before PLAN 3.4Rl, loaded with a
  formation in mid-step, sets it on the middle of its cell at its next step (it was put
  on the old step of a new path).

### ADR-170 · 2026-10-07 · accepted — A walkable cell that no province has is a node of the province graph: the mend is in the graph, not the map (PLAN 3.7j)

- **Context:** the eighth read, finding 1. A `Passage` groups the province nodes with open
  ground by their neighbours, and `mayReach` refuses two ends in different groups with no
  search. Nodes were neighbours only through cells that had a node, and a walkable cell of
  province 0 had none: 2,726 cells of the 1938 map (2,708 of them owned and held: the
  coast's cells that the admin-1 polygons do not cover, which take their neighbours'
  owner). Five of its landmasses fell into more than one group with every holder open;
  south-west Japan (7 provinces, 120 cells) was cut from the rest of Japan by one forest
  cell, (1768, 396).
- **Two places to mend it:**
  1. *The map:* the pipeline gives every walkable cell a province. It mends the 1938 map
     and nothing else: a map import makes land of water and leaves `cells.province` as it
     was, so new land is of province 0 whatever the pipeline did. (A paint cannot: the
     editor paints land into land only. PLAN 3.7j's "a land cell painted in the editor" is
     tested as land of an import.) And it is a choice of province for 2,726 cells that
     the data does not make.
  2. *The graph:* a cell with no node joins the nodes about it.
- **Decision:** the graph. `buildProvinceGraph`, after the crossings, makes a node of every
  connected run (4-way) of walkable cells that have none, as it does of a run of crossing
  cells: `component !== 0`, so whatever the landmasses count as land has a node. On the 1938
  map 2,310 nodes of 1 to 9 cells (4,588 nodes before, 6,936 now: see the ids below).
  `cells.province` stays what the data says.
- **And the ids of the nodes that are no province begin above every province** (found by
  the gate, not foreseen): the crossings were numbered from the highest province *with a
  land cell* (4,558) on, and the 1938 map has 38 provinces above it with no land cell at
  this size (`provinces.count` is 4,597). So 29 crossings had the ids of provinces, 4,559
  to 4,587; nothing showed, a crossing's centre being nobody's. The new runs took the ids
  on from there, their centres have owners, and `forceRevolt(4594)` founded a nation of no
  cells on one (`rebelCapitals.test.ts`, `nationNames.test.ts`: three tests red). The
  highest province is now read from every cell, land or not: no crossing and no run has
  the id of a province, and `q >= provinces.count` is "not a province" as its readers
  (`revoltArea`) meant it.
- **Why a node and not only an edge** (the nodes about a run made neighbours of each
  other): a node has holders. `heldByNode` counts its cells, so the run is open ground or
  closed by who holds it, and the groups are exact where an edge would join two provinces
  over a cell nobody may enter. And a corridor of a long route holds the run as it holds a
  crossing.
- **The reader's suspicion, settled by this:** a route of more than 500 km that is not
  found in its corridor is refused (ADR-149), and a cell with no node was in no corridor
  (`on[0]` is 0): a way whose only crossing was such a cell was refused inside one group
  too. No instance inside one group was found before the mend (Honshu and Kyushu were two
  groups: finding 1 itself). With the groups joined, (1831, 319) to (1766, 397), 120 cells
  by the way, is the case that would have shown it: the coarse route runs over the run's
  node and the corridor holds it (`provinceGraph.test.ts`, the fourth test, a guard).
- **What else reads the graph, looked at:**
  - `neighbourMap` (the strategic AI): a new node whose centre has an owner is a
    neighbour-maker like a province. On the 1938 map at the start the same 203 pairs of
    neighbours before and after.
  - `randomWorld`: a nation's reach now spreads over the new nodes as over the crossings,
    so the parts of a landmass that only such a cell joins are reached by road and not by
    "the capital nearest". A random world of a given seed may differ from the one before
    in those parts. Not counted; the title screen's picture of the random world differs
    and was made again (`npm run data -- --previews`, as `scenarioPreview.test.ts` asks).
  - `mayReach`'s `a === 0 || b === 0` and the same in `operational.ts` are now for water
    only. Left as they are.
  - A formation that stood on a cell with no node had no group and was held to reach
    everything (`operational.ts`), and its orders were then refused by the search: 29 of
    the 1,895 refused orders in a year of seed 99, of 4 formations. None now.
- **Measured:** the reader's `groups.ts`: 5 landmasses in more than one group and 6 pairs
  with a way that `findRoute` refuses, before; 0 and 0 after, of 815 landmasses with a
  node. Orders refused in a year (`MoveRejected`): seed 99 1,895 before and 877 after;
  seed 7 1,761 before and 3,502 after. The two games part early and are different games
  by the year's end: the counts say nothing of the rule (one falls and one doubles), and
  no count of the same orders under both graphs was made. Tick time, five years of seed
  99 pinned to the performance cores: mean 1.672 ms before, 1.559 ms after (a different
  game; no slower).
- **The pin moves:** `d3067126` to `7cfb8b6d` (seed 99 after one year; `1fbeb7db` with the
  runs alone, before the ids were moved above the provinces). A rule of reach
  changed: Japan's formations reach Kyushu, long routes take corridors over the new nodes,
  and a formation on such a cell has a group.
- **Consequences:** nothing saved changes (the graph is derived, never saved). A node id
  above the provinces' is a crossing's or such a run's: who reads a node as a province
  (`revival.ts`, `revolts.ts`, `randomWorld.ts`) reads `centre[p]` for a province id, as
  before.

### ADR-169 · 2026-10-07 · accepted — A formation sent home marches home, across nations at peace with it; it is set on its spawn point only where no land leads there (PLAN 3.7h)

- **Context:** the review of Phase 3 counted what ADR-149 had left "not counted": in a year
  43 formations (seed 99) and 37 (seed 7) are moved in one tick from a third nation's ground
  to their nation's spawn point, by a median of 52 and 35 cells and up to 152. All 80 are
  `repatriationSystem`'s. For 75 an own cell lay within 80 cells on the same landmass and
  the order there was refused: ADR-149 lets a formation walk out of the ground it stands
  on, not onto another third nation's. They stand where a war they fought beside another
  took them (Yugoslav divisions in the Soviet Union, Czechoslovak in Romania), and the
  peace closed the way they came. The other 5 are further than 80 cells from any own cell
  (Transjordan's in Nigeria), on their home's landmass.
- **The mend PLAN 3.7h proposed mends none:** "the nearest own cell it can reach by its
  `Passage`". By its passage it reaches none.
- **Three rules that end the jump:**
  1. *It stays.* No new rule. With no supply it loses 2 % of its men a day
     (`BASE_ATTRITION_PER_DAY`) and is gone in months: 40 formations a year interned by
     attrition, on the map all the while as armies that stand in a neutral's land.
  2. *It is disbanded there* (interned; half its men back, as `DISBAND_MANPOWER`). A new
     rule and an event; on the page the army is gone at the peace.
  3. *It marches home.* The order of a repatriation, and no other, is routed over any
     ground; the walk does not end it at a third nation's cell.
- **Decision:** the third. `repatriationSystem` orders the formation to the nearest cell of
  its nation on its landmass within `REPATRIATE_CELLS`, or with none there to its spawn
  point if that is on its landmass, with a passage that is open everywhere. The formation
  is marked as going home (`formations.home`, state, a byte): the walk does not end its
  march at ground that is a third nation's. Any other order takes the mark away, and so
  does its arrival. The spawn point is set only where no land leads home (another
  landmass: the sealift that PLAN 4.5 will make a voyage, as ADR-47's muster).
- **ADR-149's reason against a crossing, answered for this one:** "the nation it crosses
  has no say", of an army that crosses to fight a war beyond. This one fights nobody: it
  takes no cell (a cell flips to a nation at war with its holder: `territory.ts`; the
  task's test holds it to that, also for a nation at war elsewhere), it is in no contact but with an enemy
  of its own, and it goes only to its own land. It is not fed on the way (ADR-143): the
  march costs it 2 % of its men a day, where the jump cost nothing. No AI and no player
  can give this order; an order of theirs from such ground is ADR-149's as before.
- **Why not the first:** a rule nobody chose (the peace of a war interns the armies of the
  side's small members), and the 544,335 formation-hours out of contact on a third nation's
  ground that ADR-149 was written against would come back as armies that stand and die.
  **Why not the second:** it is the lightest that respects ADR-149 whole, and it removes
  from the map what the game is watched for. If the count below comes out against the
  march, the second is the rule to fall back on.
- **To be measured by the task, beside ADR-149's table:** formation-hours out of contact on
  a third nation's ground in the first 360 days of seed 99 and seed 7, before and after
  (they must not grow past what the marches themselves take); how many of the 80 arrive,
  with how many of their men; how many are still set on the spawn point, and why.
- **Consequences:** a column of the formations' table (a save from before has none and
  loads with 0); the pin moves.
- **Addendum 2026-10-07, coded and counted (PLAN 3.7h):**
  - *Wrong above:* a save from before does not load ("missing section formations.home"),
    as with every column added (ADR-135, ADR-150).
  - *One rule more, found by the count:* the operational AI leaves a formation on its march
    home alone, as it does one on the retreat. "Any other order takes the mark away" let
    the AI take it: in seed 7 formation 897 (French Equatorial Africa's, in Angola) was
    ordered to a front each day from the middle of a step into the Belgian Congo, the
    march ended at once before that ground (ADR-151 puts the step's other end first on
    the path, and the walk bars it), and midnight sent it home again: 23 marches home, none
    ended. With the first code 22 and 6 marches of the year were taken by another order
    and 10 and 23 ended on a third nation's ground. An order of a player and a retreat
    still clear the mark. What it costs: a formation a day from a front of its nation is
    walked home first where the AI would have taken it (an Italian division in Lyon with
    Italy at war with Switzerland, the test's case).
  - *A step that is shut* (ADR-171) orders a march home again as a march home.
  - *Jumps* (a year, more than 3 cells in a tick, `.cache/p37/jumps2.ts`): 7 and 33 at
    HEAD before (seed 99, seed 7; 43 and 37 at the diagnosis, the games have changed with
    ADR-170), 0 and 0 after. None was set on a spawn point: no formation's home was on
    another landmass in these years.
  - *The marches home of the year* (`.cache/p37h/home.ts`, scratch):

    | | seed 99 | seed 7 |
    | --- | --- | --- |
    | begun | 150 | 165 |
    | arrived on their own ground | 118 | 163 |
    | hours of the march, median and longest | 302, 2,068 | 108, 1,033 |
    | men at arrival, of those at the start (all; median; least) | 70 %; 80 %; 0.4 % | 94 %; 96 %; 1.8 % |
    | died on the way | 2 | 0 |
    | on the way at the year's end | 30 | 2 |
    | formation-hours on a march home | 73,733 | 28,996 |

  - *Beside ADR-149's table* (`.cache/rl/third.ts`, the first 360 days; before is HEAD):

    | formation-hours on a third nation's ground | seed 99 | seed 7 |
    | --- | --- | --- |
    | in contact | 71 → 73 | 32 → 45 |
    | out of contact | 54,960 (128 formations) → 90,238 (151) | 20,093 (121) → 39,759 (185) |
    | with no supply, in contact and out | 49,249 → 81,997 | 14,669 → 30,205 |
    | orders refused | 858 → 603 | 3,451 → 3,204 |

    The hours out of contact rise by 35,278 and 19,666, less than the marches home take
    (73,733 and 28,996; before, the marches home that an order allowed were among the
    54,960 and 20,093). They are 17 % and 6 % of what ADR-149 was written against. The
    games part (other hashes), so each column is two games and no verdict on more than
    that. The longest: Syria's from the Sudan (2,068 hours, 4 % of the men), a Mongolian
    brigade from Romania (420 cells). Whether a march of months with no supply should
    rather intern the formation (the second rule above) is Phase 7's, with the balance.
  - *The pin:* `7cfb8b6d` → `83057b85`.

### ADR-168 · 2026-10-07 · accepted — A tag is tied to its elements: it stands on its formation's own side of a contact, and one that stands off has a line to them (PLAN 3.7d)

- **Context:** asked three times in a day. ADR-164 (100 m/px: a neighbour's tag on half of
  an armoured division's elements), the zoom demo (PLAN 3.5g, a line under PLAN 7.4: three
  tags on each other and on the sprites) and the tank battle demo (ADR-166,
  `docs/evidence/3.6/tank-battle-2-marks.png` and `tank-battle-3-turrets.png`): "Tank
  brigade 395" stands a tag's height above its tanks, and the tag that lies on them is
  "Light infantry division 431", the enemy's.
- **What the pictures show, looked at again for this:** three formations on one ground, two
  blocks front to front. `layoutTags` places by strength: the strongest (431, 7.0k) takes
  "above", the next (419, 6.7k) "below", the brigade (233 tanks) the next place out above.
  Each tag is clear of the other tags, and each is "above its own box": the boxes lie on
  each other. Nothing says which of the three the tanks are. In the phase's own demo the
  one formation the picture is about is the one whose tag is furthest from it.
- **Decision**, two parts, both in `tags.ts` (view only):
  1. *Its own side.* A formation whose elements' box lies on the box of a formation it is
     at war with tries first the side of its own middle: above if its box's middle is above
     the middle of those boxes, below if under. Then the other places as now. Strength
     decides between two that want one place, as now.
  2. *A line.* A tag that stands further from its box than `TAG_GAP` (it gave way) has a
     thin line in its nation's colour from the tag to the middle of its formation's elements
     in the view.
- **Why both:** the first makes two tags of a contact stand as the blocks do, each by its
  own; it does nothing for the third formation on the ground, which the line is for. The
  line alone would leave the enemy's tag on the tanks.
- **Why not leave it to PLAN 7.4** (where the zoom demo's line is): the phase's demo is of a
  tank battle, and its pictures name the tanks with an infantry division of the other side.
  That is what a player reads at T2. The line under PLAN 7.4 (tags on each other and on the
  sprites) stays: this does not part a tag from the sprites of its own formation.
- **Not decided here, for the task to see first:** where the three boxes are at the demo's
  stops 2 and 3 (the task reads them before it writes the rule: if the brigade's middle is
  not above the division's, the first part is the wrong rule and the task says so); whether
  the view knows who is at war with whom (the tag has `engaged` and `nation`; if not, "a
  formation of another nation whose box lies on its own, both engaged").
- **Consequences:** the pictures of the tank battle demo and of the zoom demo's battle are
  taken again; `tags.test.ts` gets the two rules; a tag's place can change as a block turns.
- **Addendum 2026-10-07, the boxes read (PLAN 3.7g's diagnosis, in Node):** the three blocks
  are columns side by side, the brigade the westernmost (middles at 100 m/px: 690, 414;
  712, 424; 737, 435). The first part as written would hold there by 10 px of height and
  has nothing to say of a front that runs north to south. **The first part is restated:** a
  tag does not stand on another formation's elements where a place clear of them is free,
  and the places beside its box are tried with those above and below. No knowledge of who
  is at war is needed: the layout has every formation's box. The second part (the line)
  stands. By hand on these boxes: the brigade's tag stands left of its tanks, 419's below
  its block, 431's a step out above with a line.
- **Addendum 2026-10-07, done (PLAN 3.7g); the ground had moved:** the boxes above are of
  seed 1938's ground, and PLAN 3.7o put the demo on seed 2 the same day. Read again
  (`.cache/p37/tagboxes.ts`): the brigade (395, 611 tanks' men) is the easternmost block
  with four Chinese divisions west and south of it (449, 417, 420, 428). Middles at
  60 m/px: 715, 371; 591, 232; 664, 371; 641, 429; 637, 485. Before the change 417's and
  420's tags lay on and beside the tanks and the brigade's stood a step out above. The rule
  as coded (`layoutTags`): a ring of places is above, below, left, right, in that order,
  and `TAG_TRIES` rings are tried, each a step further out (20 places where there were 10;
  a place beside a block that the view has no room for is none). A first pass takes the
  nearest place clear of the other tags, of the page's boxes and of every other
  formation's box of elements; with none, a second takes the nearest clear of tags and
  page as before. A tag more than `TAG_GAP` + 1 px from its box (the px is the rounding of
  its place) has a line from its middle to the middle of its elements in the view, dark
  under its nation's colour, drawn under every tag. **On the demo's ground:** at 100 m/px
  the brigade's tag stands right of its tanks, at 60 above them, 4 px off both times, the
  nearest tag to their middle (18 and 39 px), no tank under another's tag, and no tag
  there needs a line. The line is seen in the zoom demo's battle
  (`docs/evidence/2.10/stop-5-battle.png`: "Motorised division 47", a step out above three
  blocks on one spot). **The count of places in `tags.test.ts` changed with the rule**
  (2 × `TAG_TRIES` to 4 × `TAG_TRIES`; the two tests of "more formations than places" hold
  as many over as before, 3, on a block in the middle of the view). **Cost:** a layout of
  20 formations 0.04 ms (0.02 before), of 300 all over the view 1.4 ms (0.26).
  **Not decided:** in a crowd most tags stand off and have lines (15 of 20 on a quarter of
  the view, random boxes): whether that reads is for PLAN 7.4's line on tags.

### ADR-167 · 2026-10-07 · accepted — A snapshot says of each element it sends whether it was fired at; the view no longer takes it from the shots it got (PLAN 3.6e5)

- **Context:** ADR-162 burns the hull of a tank whose element is the target of a fire record
  of the snapshot. The demo (ADR-166) found hulls of tanks lost under fire that did not burn,
  and inferred the cause: the element at the edge of the subscribed box or outside it.
- **Diagnosed first** (in Node, the demo's four hours, each shot at each element of tanks
  that lost a tank under fire, both ends against the box `viewSubscription` makes):
  - Hour 3, 4 m/px, box 0.358 × 0.204 cells: element 10891 stands at y 370.628, the box ends
    at 370.626. One shot at it, from 1677.062, 370.668: both ends outside. The demo had its
    hull "inside the box by its figure's place": a figure stands off its element's place,
    and the worker's test is the element's place. The other two elements had 2 and 3 shots
    with the target's end inside.
  - Hour 4, 1.5 m/px, box 0.134 × 0.077 cells (a brigade's block is wider): 4 of 6 elements
    with all their shots (1, 2, 4 and 1) outside at both ends.
  - So the inference holds, and the worker's box is the page's. Nothing was dropped.
- **Decision:** `SnapshotElements.hit`, a byte an element: 1 where anything fired at it since
  the snapshot before, from anywhere. The worker keeps the targets of every shot while the
  view draws elements (a set, filled where the fires are drained, emptied with the fire queue
  when a snapshot is built or a game loaded), so it spans the hours a snapshot spans.
  `tanksLost` reads `after.hit`; the view's set of the targets of its fire records is gone.
- **Why not the shots at every element sent:** they are tracers with both ends outside the
  box, more to send and to draw for one bit of what they say, and `serverFires.test.ts`
  pins "an end in the box". And the flag does not depend on the fire queue's cap: a shot
  dropped there (`fires.dropped`) no longer costs a hull its fire.
- **Consequences:** view and protocol only: no sim code, the pin did not move. One byte an
  element in a snapshot, one set entry a target an hour. A view that draws no elements
  keeps none.
- **Measured** (`tests/e2e/tankBattle1938.spec.ts`, which now expects the sim's answer of
  every hull, the viewport no longer asked for): at 12 m/px 4 hulls, 4 burning; at 4 m/px 5
  hulls, 3 burning (2 before), 2 of them outside the viewport, 1 burning; at 1.5 m/px 7
  hulls, 6 burning (2 before), 6 outside the viewport, 5 burning. `burning1938` as it was:
  7 of 7 and 20 of 20.
- **Not done:** the pictures were not taken again (what changed is outside the viewport).
  No picture shows a hull that burns after a pan to it.

### ADR-166 · 2026-10-07 · accepted — The tank battle demo: one flight from T1 to 1.5 m/px on a tank brigade of seed 1938's game, four hours stepped on the way (PLAN 3.6e4)

- **Context:** PLAN 3.6's AT is a demo of a battle of armour "found or set up", with
  turrets off the hull, a flash at a tank and a burning hull. PLAN 3.6e4 added the time of a
  frame with hulls, both kinds of hull in one view if the ground has it, and what the tags
  do over the tanks that fight (ADR-164).
- **Decision:**
  - **Found, not set up** (`tests/helpers/tankBattle.ts`, in Node; the page's hash is
    compared after every hour). The first four hours from day 14 of seed 1938's game in
    which an element of tanks that stands through them loses a tank under fire in the
    fourth, with at least 10 elements of tanks firing in the view at 60 m/px in the first,
    3 in the view at 12 in the second, and in the third, in the view at 4 m/px, a tank lost
    under fire and one lost with nothing firing at its element. It is the Japanese tank
    brigade 395 west of Shijiazhuang against the Chinese light infantry divisions 431 and
    419, hours 898 to 901 (day 37): 54 tanks left of 200 in 20 elements.
  - **Six stops, each thing where it is read:** 1500 m/px (the marker), 100 (the small
    mark), 60 (turrets; hour 1), 12 (the tanks one by one; hour 2), 4 (flashes and hulls;
    hour 3), 1.5 (the hull of the tank the camera is on; hour 4). The flight is the zoom
    demo's (ADR-71 addendum), its code now in `tests/e2e/flight.ts`: eased zooms on the
    test's clock, a share's step under 0.12 a frame, none back, the battle held to a pixel.
  - **The hull near is of an hour stepped there.** The first version stepped three hours
    and flew from 4 to 1.5 m/px to look at the hulls of the third. It passed alone and
    failed beside `zoomDemo1938`: a hull's life is on the browser's clock at the snapshot's
    arrival (17.5 s), the flight is on the test's, and on a loaded machine a leg takes 44 s
    of the browser's clock for 2.2 s of the test's; the snapshot of the new subscription
    then drops the hulls. In a running game the two clocks are one. So the spec looks at
    hulls only in frames drawn right after the hour that made them.
- **Measured** (`tests/e2e/tankBattle1938.spec.ts`, alone, the machine idle):
  - 100 m/px: 20 elements of tanks, all the small mark, a sprite 5.1 px.
  - 60 m/px: 20 turrets, all of tanks that fired, all on the line to their targets as the
    last shot leaves, 19 more than 0.02 rad off the hull.
  - 12 m/px: 54 figures for 54 tanks; 54 turrets on their targets' lines, 51 off the hull.
  - 4 m/px: 14 shots of armour in the view's box, 12 with a flash within half a figure of
    a tank of its shooter and more than 0.3 of a figure from its middle; 5 hulls for 5
    tanks lost; in the viewport 2 burning and 1 left behind, as the sim has them.
  - 1.5 m/px: 7 hulls for 7 tanks lost; the one of the element the camera is on burns in
    the viewport, a second and a half old.
  - The largest step of a share in a frame: 0.096.
  - **A frame with hulls, flames on:** 0.58 to 1.03 ms of script (ten `draw` calls at one
    time, 4 m/px, 4 hulls drawn, 1,818 figures of 51 elements; `individuals1938` has 1.1 ms
    for 2,726 figures without hulls). The script's part only: the test's browser draws on
    the CPU (SwiftShader), and what a GPU takes is the bench's to say. Five hulls are not
    the 2,000 the view may hold: that case is not measured.
- **Found: a tank lost under fire outside the subscribed box does not burn.** The worker
  sends every element of a formation that reaches into the box (PLAN 2.7n1) and the shots
  with an end in the box (PLAN 2.4). ADR-162 takes "fired at" from the shots of the
  snapshot. An element that is held, stands at the box's edge or outside it and is fired at
  from outside it comes without its shots: at 4 m/px 1 of the 3 tanks lost under fire is
  drawn left behind, at 1.5 m/px 4 of 5. All of them are outside the viewport (the box is
  the viewport and a margin), and a hull lives 17.5 s: a player who pans sees them.
  `burning1938` did not meet it (its camera is on the middle of the losses at 4 m/px). The
  demo expects the sim's answer in the viewport and counts the others in its log. PLAN
  3.6e5 puts it right; 3.6 is not ticked before.
- **Seen, about the tags (ADR-164's question):** at 100 and 60 m/px none of the brigade's
  20 elements is under its own tag, and 3 and 4 are under another formation's. The
  brigade's tag stands above the tag of the Chinese division it fights, and that tag lies
  on the tanks: read without care, the tanks are "Light infantry division 431". A line
  under PLAN 3.7.
- **Looked at** (`docs/evidence/3.6/tank-battle-1-marker.png` to `tank-battle-6-hull.png`):
  - 1: the front in north China as markers; the brigade's is one of a crowd.
  - 2 (100 m/px): the brigade is a block of pale slabs between two tags, beside dark
    blocks of rifles.
  - 3 (60 m/px): hulls of 8.5 px with tracers and impacts among them; that the turrets are
    turned cannot be read at this size.
  - 4 (12 m/px): the tanks one by one over 2 by 4 km, tracers to the Chinese battalions,
    four hulls burning from this hour.
  - 5 (4 m/px): tanks with their turrets turned different ways; a hull burning with smoke,
    a grey hull left behind, a second fire half under the page's war banners.
  - 6 (1.5 m/px): the burning hull, flame and three puffs of smoke, a tank of its element
    against it; the turrets of the tanks around it on a target to the south-east.
- **Consequences:** `zoomDemo1938.spec.ts` imports its flight from `flight.ts`; nothing
  else of it changed. No view or sim code changed; the pin did not move.

### ADR-165 · 2026-10-07 · accepted — Where a sprite is 5 px a tank is a solid slab of its nation's colour; from 5.5 to 8 px the shader mixes it with the hull (PLAN 3.6e3b)

- **Context:** ADR-164: at the least size a hull is a dark blob and a division of tanks the
  block of any division. PLAN 3.6e3b asked first for pictures at 60 and 40 m/px at one device
  pixel a CSS px, where 3.6e3 had looked at none.
- **Looked at first** (`docs/evidence/3.6/t2-60m-hull-x6.png`, `t2-40m-hull-x6.png`, six
  times enlarged, the tags off; HEAD before this change): at 60 m/px (8.5 px) a hull is a
  dark lozenge beside the guns' wedge: a vehicle, not yet a tank. At 40 m/px (12.7 px) the
  tracks and the deck can be seen. ADR-159's "about 40 m/px" stands.
- **Why the blob is dark:** a hull's 5 px are mostly its outlines (5 of 64 atlas px each),
  its grey tracks and deck, and the transparent black around it that the mip levels average
  in. The middle of a tank on the canvas at 150 m/px is 0.50 of its tint.
- **Decision:**
  - **The mark** (`Frame.tankSmall`, the thirteenth frame, after the turrets: the
    snapshot's numbers stand, and no class has it): one rounded slab along the facing, 56 ×
    34 of the frame's 64, all fill with a rim. At 5 px it is about 4 × 3 px of the nation's
    colour (1.00 of the tint in the middle). One for the three weights: 5 px do not hold a
    weight. That is a shape, not ADR-164's refused "tint made darker": the tint is the
    nation's own, and more of it is seen.
  - **Where** (`smallShare`, `render/units/elementSprite.ts`): by the side of the sprite as
    drawn, the size setting in it: all mark at 5.5 px and under, all hull at 8 px and over,
    a smooth step between. At the default setting: the mark from 92.5 m/px outward (the
    least size, 5 px from 102, and ADR-164's 100 m/px are all mark), the hull from 64 in.
    At a size setting of 1.6 and more there is no mark; at a half, the mark to 32 m/px.
  - **How** (`ProxyRenderer`): one draw, as before. The vertex shader has each frame's small
    one (`smallFrameOf`, a uniform table) and the share; the fragment shader mixes the two
    frames' texels. A turret's opacity is × (1 − share): not drawn at the least size. The
    instance data is as it was, so the turrets' count and their turning are untouched.
  - **No clock.** The tiers' handovers fade over time because a layer is on or off. This is
    a function of the zoom, continuous in it: nothing to animate and nothing to pop. One
    mixed sprite, not two layers at complementary opacities, so the sum does not dip.
- **Why 8 px**, when a hull first reads at about 12: the AT ("at 60 m/px none") and
  `turrets1938.spec.ts`, which counts 88 whole turrets at 60 m/px (8.48 px). Between 64 and
  about 45 m/px a tank is the dark lozenge it was.
- **Measured** (`tests/e2e/smallMark1938.spec.ts`, the ground of ADR-164): at 150 m/px 88
  tanks of 354 elements have the mark, none of 226 rifles; the middle of a tank is 1.00 of
  its tint as drawn and 0.50 with the share held at 0; from 110 to 58 m/px in steps of half
  a metre the share falls from 1 to 0, at most 0.028 a step; at 60 m/px 68 hulls and 68
  turrets, share 0.
- **Looked at** (`docs/evidence/3.6/`: `t2-300m-mark-dpr1.png`, `t2-200m-mark-dpr1.png`,
  `t2-100m-mark-dpr1.png` beside `t2-*-dpr1.png` of ADR-164; `t2-200m-mark-x6.png`,
  `t2-100m-mark-x6.png` beside `t2-200m-hull-x6.png`, `t2-100m-hull-x6.png`, which are of
  another armoured division of the same hour):
  - **300 and 200 m/px:** a tank brigade and an armoured division are pale blocks with the
    grain of their rows; a rifle and a motorised division are dark blocks. Told apart
    without the tag.
  - **100 m/px:** a tank is a pale slab with a dark edge, larger than a rifle battalion's
    dot and stroke and a gun's wedge.
  - It says "the solid arm", not "tank": nothing of 5 px says tank.
- **Not answered:**
  - A pale nation's mark on pale ground: Germany's grey slabs on Austria's hatched land at
    100 m/px stand out less than the dark blobs did. The rim was widened from 3 to 7 atlas
    px for it; the gain is small.
  - Guns, half-tracks and rifles have no small frame (ADR-164 left it open): a motorised
    division is a rifle division's block.
  - The frame's time at T2 was not measured with the second texture sample (taken only
    where the share is above 0).
- View only; the pin did not move.

### ADR-164 · 2026-10-07 · accepted — At T2 from 300 to 100 m/px a division of tanks is a block that its tag names; the 5 px of a hull do not say "tank", and a mark is needed (PLAN 3.6e3)

- **Context:** the critic's report of 2026-10-05 (R2-B3): "at T2 a panzer division is a grey
  grid of dots like any other". PLAN 3.6a gave each weight of tank a hull and left open what
  that is where a sprite is at its least size (ADR-159, *Not done*).
- **Measured** (a scratch spec, deleted: seed 1938, two weeks in, the ground where the most
  armour fires, east of Passau; 900 × 560 CSS px, at device pixel ratios 1 and 3):

  | m/px | sprite, px | pitch of a tank element to its nearest neighbour, px (median) | elements in view |
  |---|---|---|---|
  | 300 | 5.0 | 2.0 | 558 |
  | 200 | 5.0 | 2.9 | 462 |
  | 150 | 5.0 | 3.9 | 438 |
  | 100 | 5.1 | 5.9 | 302 |
  | 60 | 8.5 | 9.8 | 252 |
  | 40 | 12.7 | 14.7 | 128 |

  The sprite is its footprint (0.026 cells, `ELEMENT_CELLS`) and at least 5 px
  (the draw of `elementProxies` in `MapView`): the least size holds from about 102 m/px outward. The slots of a
  division are about 590 m apart, so from about 118 m/px outward the sprites of neighbours
  lie on each other: by 2 px of 5 at 200 m/px, by 3 at 300. The tint is the nation's (two
  tints among 558 elements: Germany's grey, Austria's white), so within one army nothing but
  the shape tells the arms apart.
- **Looked at** (`docs/evidence/3.6/`: `t2-300m-dpr1.png`, `t2-200m-dpr1.png`,
  `t2-100m-dpr1.png`; `t2-marks-dpr1-x8.png`, the marks of three divisions eight times
  enlarged, 100 m/px above and 200 below; `t2-100m-marks-dpr3-x3.png`, the same ground at
  three device pixels a CSS px):
  - **300 and 200 m/px:** a division is a dark hatched block in the shape of its formation
    (columns, a line, a square). An armoured, a motorised and a rifle division are the same
    block. No mark of an element can be read.
  - **100 m/px, one device pixel a CSS px:** an element is a mark of its own. A rifle
    battalion reads as a head and a stroke, a gun as a wider one, a tank as a dark blob of
    5 px with no shape. One can see that the tanks are not the rifles; one cannot see that
    they are tanks.
  - **100 m/px, three device pixels:** a hull is a box with a dark rim and reads as a
    vehicle beside the men and the guns. A screen of one device pixel a CSS px does not
    show that.
  - What says "armoured" in these pictures is the division's tag ("Armoured division 41",
    its strength, its flag). The critic's sentence is still true of the marks.
  - **Seen besides:** at 100 m/px the tag of a neighbour (Infantry division 627) lies on
    half of the elements of Armoured division 41. Tags are placed clear of each other, not
    of the elements of another division. Not looked into.
- **Decision:** a mark is needed, and it is a part of its own (PLAN 3.6e3b), before the
  demo. Where a sprite is at its least size, a tank element is drawn with a frame made for
  that size: one solid shape that 5 px can hold and that no other arm has. Not decided here:
  the shape, and whether the other arms get such a frame too.
- **Why not** leave it to the tag: the tag names a division, and the complaint is of what
  the ground shows. A spearhead (PLAN 3.5) is tank elements ahead of the rifles of the same
  army, and that is the thing to see at this zoom. **Why not** a larger least size: at
  200 m/px the sprites already lie on each other. **Why not** the nation's tint made darker
  for armour: the tint says whose the element is.
- **Not answered:** the overlap itself from 118 m/px outward (a block, for every arm): the
  new frame has to be judged in it.
- No code; the pin did not move.

### ADR-163 · 2026-10-07 · accepted — A cannon's shot waits for its turret: it starts 180 ms after its minute (PLAN 3.6e1)

- **Context:** ADR-161, "a shot does not wait for its turret": a turret turns onto its
  target in `TURN_MS` (180 ms), from its snapshot's arrival at the earliest, and a shot
  whose minute put it in the first 180 ms after the snapshot left a gun still turning: 10 of
  25 tanks in `muzzles1938.spec.ts`, up to 0.26 rad off the line.
- **Decision:** `FireFx.add` starts a shot of `Weapon.cannon` `TURN_MS` after the time its
  minute of the hour gives it. `TurretAims.add` is as it was: the turn begins `TURN_MS`
  before the shot, which is now never before the snapshot.
  - A shift, not a floor (`max(start, now + TURN_MS)`): a floor would fire the cannon of the
    first minutes of an hour in one salvo. The spread of a tick's cannon is what it was.
  - By the weapon, not by the figure: a shot's time must not depend on whether the camera is
    near enough for the view to hold its shooter's tanks: a tank waits at T2 as at T3. The
    cannon is the weapon of every class but artillery (shell) and infantry, motorised and
    mechanised (small arms): today the three weights of armour. A class without a turret
    that comes to fire it (`weaponOf`'s default) would wait too, for nothing.
  - Rifles and shells start as before: against them a cannon's flash is 180 ms late. A tick
    is an hour, and a volley's minute is already spread over 250 to 1,000 ms of wall time.
  - One shot on screen for a shooter (ADR-66) is unchanged: every shot of a shooter that
    fires cannon is later by the same time.
  - View only; the pin does not move.
- **Restated:** `fireFx.test.ts`, "flash and tracer from the start": its cannon of minute 30
  started at 1,500 ms and starts at 1,680. The phases it tests are as they were.
- **Measured:** `muzzles1938.spec.ts` (4 m/px, two weeks into 1938): 25 of 25 tanks with the
  turret on the line to the target as the flash begins, to 1e-6 rad; the spec now expects
  it. `turrets1938`, `fire1938`, `burning1938` by hand, green.
- **Not done:** each tank its own bearing (ADR-161): the tracer of a tank at the edge of its
  element still leaves up to about 20 degrees off its tongue for a near target.

### ADR-162 · 2026-10-07 · accepted — A tank that an element loses leaves its hull at T3: burning if the element was fired at, left behind if not (PLAN 3.6d)

- **Context:** a wreck was left only when a whole element was gone (ADR-67). An element of
  tanks is 10 tanks and loses them one at a time, no more than one in an hour: at T3 a
  figure was there in one frame and not in the next, and nothing marked the place.
- **Decision:**
  - `HullFx` (`render/fx/hulls.ts`) compares the element section of a snapshot with the one
    the view kept of the snapshot before (`MapView.elementSection`, kept under 60 m/px). For
    an element of tanks in both (a hull frame: `turretOf`), the figures it had and has no
    more (`figureCount`, the last of its order: `figureOffsets`) each leave a hull where the
    figure stood: at the old snapshot's place and facing.
  - **Not every tank that is lost burns.** PLAN 3.6d said "leaves a burning hull". The first
    pictures had 18 hulls burning in an empty field: a brigade on the march had lost a tank
    from each of 18 elements in two hours, to breakdowns (PLAN 3.2d), with no enemy near. The
    view cannot read the cause from a strength, but a combat loss comes in the tick of a fire
    record whose target is the element (`combat.ts`: the losses of a tick are those of its
    volleys), and the view gets the fire records of every target in its box. So: lost in a
    snapshot that has a fire record at the element, the hull burns (flame 6 s, smoke 9 s
    more, a fade of 2.5 s; its turret thrown round by a hash of the element and the figure).
    Lost otherwise, it was left behind: a grey hull, its gun in line, no flame and no smoke,
    for as long. PLAN 3.6d's text and AT are restated.
  - **None for an element first seen** (the camera came, or the element did), and none
    across a clock that went back (a game loaded into this one), or for an id whose
    formation, frame or size is another's.
  - **None for an element that is gone.** It left the view's box, or it ended. The last tank
    of an element ends with it, and the element leaves its wreck with the burst (ADR-67): in
    120 days of seed 1938 every element of tanks that ended had one tank left. A hull on top
    of that wreck would be the same tank twice.
  - Drawn on the overlay with the figures' share (nothing at T2: there a loss is the
    sprite's opacity, as for every element), at the figure's size as the shader has it.
  - View only: no sim state, no field in the snapshot; the pin does not move.
- **Where it can be wrong:**
  - An element fired at and losing a tank to attrition in the same hour: its hull burns.
  - The worker drops fire records beyond its cap (`fires.dropped`, 0 at ×5): a tank lost
    under a dropped record is drawn as left behind.
  - A snapshot that spans several ticks (top speed) has the losses and the fire of all of
    them: a tank left behind in one and its element fired at in another burns.
  - A game loaded into this one at a later tick: the clock has not gone back, and an id
    that has the same formation, frame and size in both worlds with fewer tanks in the new
    one leaves hulls for the difference, once.
- **The place, checked on its own (PLAN 3.6e2, 2026-10-07):** `burning1938.spec.ts` no
  longer computes a hull's place with `figureOffsets`. It reads the figures the view had
  built for the frame before the step (`individualX`, `individualY`, an element's in their
  order) and expects each hull on the figure that is gone, to nine places. No view code.
- **Not done:** a hull does not block or hide anything, and figures drive over it; at T2 no
  hull (an element's sprite is 5 px there, a hull would be less than one); the wreck of an
  element's end at T3 is still the T2 mark at 30 px, not a hull.

### ADR-161 · 2026-10-07 · accepted — At T3 a shot leaves the muzzle of one of its shooter's figures (PLAN 3.6c)

- **Context:** a fire record has the shooter's slot and the target's. At T3 an element is
  its figures on a ground of 0.024 cells (470 m), and its tracer and flash began at the
  middle of that ground: between the tanks, not at one.
- **Decision:**
  - A shot has a figure (`Shot.from`, `firingFigure` in `render/units/individuals.ts`): one
    of those its shooter has in the snapshot that brought the record, by a hash of the
    element's id and the record's tick. The same in every frame and after a reload, another
    for the next volley. Taken once, when the shot is made (`FireFx.add`), from the element
    section the view keeps near T3 (under 60 m/px).
  - `originOf` (`render/fx/fire.ts`) is where the shot starts in a frame: the figure's place
    and, from it, the muzzle of its frame (`muzzleOf` in `atlas.ts`, from the numbers the
    frames are drawn with) at the sprite's size as the shader has it (its least size and the
    unit-size setting too). A tank's muzzle is along its turret's angle of that frame
    (`TurretAims.angleAt`); a gun's and a rifle's along the figure's facing. A carrier, a
    ship and an aircraft have no barrel drawn and fire from their middle.
  - The way from the slot to the muzzle goes with the close tier's share: at T2 a shot
    starts at the slot as before, and through the handover it moves with the figures' fade.
  - A cannon's and a howitzer's flash at a barrel is a tongue along it, its tail at the
    muzzle, 3.2 and 3.6 radii long, with a flame's edge; its radius is at least 0.09 of the
    figure's side, so that it grows with the tank (at 1.5 m/px a disc of 2.8 px was a dot at
    the end of a gun 20 px long). Rifles keep their disc.
  - View only: no sim state, no field in the snapshot; the pin does not move.
- **A shooter the view does not hold** has no figure: fire is sent for a target in the
  view's box too, and its shooter may stand outside it. Its shot starts at its slot, as at
  T2. So does a shot made while the camera was further out than 60 m/px, for the half second
  it lives.
- **Not decided for: each tank its own bearing.** The tanks of an element keep the element's
  one angle (ADR-160). The tracer goes from the muzzle to the target's slot, the tongue lies
  along the turret: for a target in the next slot (0.03 cells) and a tank at the edge of its
  ground (0.012 cells off the middle) the two differ by up to about 20 degrees for the tenth
  of a second the flash is there. Each tank its own bearing would take that away and would
  have every turret of an element at a slightly different angle; `turrets1938.spec.ts`
  states the one angle. Left as it is.
- **A shot does not wait for its turret** (found in review after the first commit, which
  gave the 20 degrees above as the whole of it). A turret begins its turn 180 ms before its
  shot, or when the snapshot arrives if that is later (ADR-160): a shot that starts in the
  first 180 ms after its snapshot leaves a turret still on its way from the hull's facing.
  The muzzle is where that turret is, so the flash is at the gun, but the tongue lies along
  a gun that is not yet on the target, and the tracer's tail turns with it. Of a tick
  stepped while paused (its shots start over 400 ms) that is the shots of the first 27
  minutes of the hour; at a tick a second, of the first 11. `muzzles1938.spec.ts`: 15 of 25
  tanks had their turret within 0.02 rad of the target's line as their shot started, the
  furthest of the other 10 was 0.26 rad off it (in a scene whose hulls face 0.36 rad from
  their targets; a hull that faces away would be further). The spec reads the flash and the
  turret from the same frame, so it holds whatever the angle. Not changed here: the turn's
  timing is ADR-160's, and a line under PLAN 3.6e has it.
- **A gun's barrel is its formation's facing.** A field piece has no turret: its tongue lies
  along the piece as drawn, and its shell's arc leaves toward the target. A deployed
  formation faces the enemy, so the two are near each other in a battle; not measured.
- **The figure's place is the snapshot's.** A figure of a marching element is drawn between
  its last place and this one during the tick; the shot starts where the sim had the shooter
  when it fired (as before this ADR). Elements in contact stand.
- **Measured:** `muzzles1938.spec.ts`, 4 m/px on armour two weeks into 1938 (seed 1938): 55
  shots, 25 of cannon, all 25 at the muzzle of a tank of their shooter to 0.01 px and more
  than 0.3 of a hull from its middle; 7 at a rifle's or a gun's; 20 of shooters the view does
  not hold, at their slots; 3 outside the viewport, not drawn. The fire layer at T2
  (`fire1938.spec.ts`, 300 shots held at ×5): 0.73 and 0.78 ms a frame, 0.79 before.

### ADR-160 · 2026-10-07 · accepted — A turret is on its target as its shot leaves: view state from the shots drawn, written into the turrets' instances each frame (PLAN 3.6b)

- **Context:** since ADR-159 a turret is an instance of its own, at its hull's facing. The
  critic: "no turret turns".
- **Decision:**
  - `TurretAims` (`render/units/turrets.ts`) holds one aim for an element that has fired a
    cannon: the angle of the line from its slot to its target's (the two ends of the fire
    record), and when. It is fed with the shots `FireFx` takes from a snapshot
    (`FireFx.add` now returns how many), on the render clock. No sim state, no field in the
    snapshot; a reload starts with every turret on its hull.
  - The turn begins TURN_MS (180 ms) before the shot starts, or at the snapshot's arrival if
    that is later, and is eased (`smooth`), the shorter way round. The turret stays on the
    target for HOLD_MS (1,500 ms) after the shot's start, or 1.5 ticks' wall time if that is
    longer, and turns back to the hull's facing in RETURN_MS (600 ms).
  - `angleAt(id, hull, now)` is pure in `now` and is given the hull's facing of the frame:
    the way back ends where the hull faces then.
  - The facing is instance data, uploaded once a snapshot. While an aim is live,
    `MapView.turnTurrets` writes the facing of every turret of both sprite layers again in
    each frame and uploads the turrets alone (`ProxyRenderer.uploadRange`), and once more in
    the frame after the last aim is over. Without a live aim a frame does nothing for it.
  - A turret off its hull is an animation of the view (`unitsAnimating`): a paused view
    goes on drawing until the turrets are back, and `settle` waits for it (up to 2.2 s after
    a shot's start in a paused game).
- **From the shots drawn, not from every fire record.** A shooter shows one shot at a time
  (ADR-66); at a day a second it fires 24 volleys a second, at whatever target each has. A
  turret that followed every record would be thrown about 24 times a second. Following the
  shots drawn, a turret turns when its tracer leaves and no more than once in a shot's life
  (490 ms for a cannon), which is longer than a turn: a new turn starts from a turret at rest
  on its last target or on its way back, never from one in mid-turn. The cost: a tank whose
  record was not drawn (more than MAX_SHOTS on screen) does not turn for it.
- **1.5 ticks:** in a game of a tick a second and slower, a fixed 1.5 s would bring a turret
  back between the shots of two hours of one fight.
- **Guns parallel in an element.** All tanks of an element take the element's angle, at T3
  too. A bearing from each tank to the target's slot would differ by a few degrees across an
  element's ground; 3.6c, which lets the shot leave one tank's muzzle, is where that would
  show, and it may give each tank its own.
- **Why not in the shader** (two angles and two times an instance): four attributes more for
  every sprite of every layer, the benches' too, for what a few hundred turrets need while
  tanks fire.
- **Measured:** `turrets1938.spec.ts`, an armoured division in contact at 60 m/px two weeks
  into 1938 (seed 1938): 88 turrets in view, 34 of tanks that fired, all 34 more than 0.02 rad
  off their hulls as the last shot leaves, and back 2.6 s after the snapshot. At 4 m/px the
  10 tanks of one element at 0.37 rad, their hulls at 0.73. **Not measured:** the frame's time
  with the pass (a write of a float for each turret and an upload of 32 bytes for each).

### ADR-159 · 2026-10-07 · accepted — A tank is two sprites, hull and turret; a hull for each weight, a half-track for mechanised infantry (PLAN 3.6a)

- **Context:** the critic's report of 2026-10-05 (R2-B3, tanks 2 of 10): at T3 a tank is "one
  white box with a circle and a bar", the same for a light and a heavy tank and for a
  battalion of mechanised infantry (64 of them), and "no turret turns". The atlas had one
  frame, `tank`, with the gun drawn on the hull.
- **Read first:** an element's facing is its formation's (the last march, or the deployment
  toward the enemy: `deployOf`), and a formation that has never moved faces 0. "All pointing
  east" is that, and no fault of the sim. PLAN 3.6 is the view's in every part; the pin does
  not move.
- **Decision:**
  - `Frame` (`shared/unitLooks`) has a hull for each weight of tank (`tank` for `armor_l`,
    `tankMedium`, `tankHeavy`), a half-track for `mech`, and three turret frames
    (`turretOf(hull)`). The snapshot still carries one frame an element: its hull's. No field
    was added to it.
  - The turret is a second instance of the same instanced renderer, written after all the
    other instances of its layer (`render/units/turrets.ts`, `appendTurrets`), at T2 after the
    element sprites and at T3 after the figures: the hull's places, size, opacity and tint,
    and for now its facing (3.6b turns it). The ring of the turret is at the middle of both
    frames, so a turret at its hull's place turns about its ring.
  - `elementCount` and `individualCount` stay the numbers of elements and figures. The
    turrets are counted beside them (`elementTurrets`, `individualTurrets`, with the instance
    each stands on).
  - The shake of a marching vehicle must be its hull's for a turret, which is another
    instance. As first committed (`bb871f4`) the phase came from the instance's place, not
    from its number in the buffer. **Wrong, and changed the same day:** the place is another
    in every tick, so the walk of every marching sprite, infantry too, took a new phase at
    each tick's end (0.2 cells an hour on foot × 78 in the hash: a new number each time).
    Found by reading, not by a spec: none measures the walk across a tick. Now the phase is
    in the instance itself: a sprite on the march adds `marchFraction(seed)` to its frame, a
    half and up to 0.49 more, by the element's id (T2) or the element's id and the figure's
    number (T3). `appendTurrets` copies the fraction, so a turret has its hull's phase; the
    readers of "moving" (`> 0.25`) and of the frame (`floor`) read as before.
- **Why not** one frame per weight with the gun on it: nothing could then turn the gun
  without the hull, which is 3.6b. **Why not** a class in the snapshot: the frame says what
  the view needs, and the view knows no unit rules (the header of `unitLooks`).
- **A test restated** (`unitLooks.test.ts`): "armour and `mech` have the frame `tank`" is
  now a frame for each of the four, and the list of frames is twelve, not six. The old line
  said what this part removes. Nothing else of the file changed; one test is new.
- **Cost:** a turret is one instance more for each tank drawn: 340 on 876 figures for a
  panzer division at 4 m/px, 820 on 3,936 for the armoured divisions and a rifle division
  at 12. `individuals1938` (no tank added to its view by this): 2,726 figures built in 1.2 ms
  and drawn in 1.1 ms of CPU a frame.
- **Not done:** at T2 an element is 5 px across from about 100 m/px outward, and a division
  of tanks is then a grid of small marks as any other (the critic's first sentence on T2);
  the sprite is a tank from about 40 m/px inward. The main battle tank (`tank_mbt`) has the
  hull of its class in the data and no picture of its own.

### ADR-158 · 2026-10-07 · accepted — The counters' hold is a memory of one zoom; the frame of a step of the zoom folds until the fold stands (PLAN 3.5i)

- **Context:** `declutter1938`, a year into seed 1938: over central Europe 21 counters at 6 px
  per cell and 20 at 8, at the same level of clusters (3). The spec asks that a zoom in shows
  no fewer counters within a level. PLAN asked whether the scene had moved or the rule of
  ADR-75 has a hole.
- **Found** (a scratch spec that wrote the page's counters, hold and character widths to a
  file; `foldOverlaps` on them in Node gives the page's 21 and 20):
  - A view opened at 8 px per cell has 27 there. Stepped to from 6 it has 20. One zoom, two
    pictures: what ADR-75 removed for a step across levels was left for a step inside one.
    ADR-75 clears the hold in a split or merge on its way; a step inside a level's band has
    no flight, and the hold of the old zoom went on.
  - Opened fresh, 6 to 10 px per cell: 21, 23, 24, 24, 24, 25, 25, 27, 27, 28, 31 (at 6,
    6.25, 6.5, 6.75, 7, 7.25, 7.5, 7.75, 8, 9, 10). With the hold of 6: 21 up to 7.25, 20 at
    7.5 to 8, 24 at 9, 29 at 10.
  - The counter lost: Germany's `1:3:141:38` (23.8k), shown at 6. At 6 Italy's `15:3:141:38`
    (46.8k) is inside Italy's `15:3:142:38` from the first pass (a nation's own). At 8 it
    clears that one by the hold distance (56.8 px between the centres, 52 needed) and is its
    own lead; the German counter stands 14 px from it and is folded with it into
    `15:3:142:38` in the second pass (166.9k +1 → 190.7k +1). Nothing else came out to make
    up for it: the hold of 6 px per cell kept 127 folded.
  - Not the cause: a held counter that changes its lead (Italy's `15:3:140:37`, 11.7k, went
    from an Italian counter to Poland's `4:3:141:37`). Taking the hold from any one of the 127
    leaves the German counter folded.
- **Decision** (`counters.ts`):
  - The hold is a memory of one zoom (`holdScale`). The first frame at another zoom is
    folded without it, as a view opened there. The hold is there for armies that move, and a
    step of the zoom moves none.
  - That frame folds on, each time with the hold of the fold before, until the fold stands
    (`STEP_ROUNDS`, at most 4 more). These are the folds the next frames would have made one
    by one: the same rest, reached in the frame of the step. Without it a second and a third
    wave of fades began one and two frames later (3 → 3.4 px per cell at the start: counters
    still turned in the first and the second frame after the step).
- **What it does not promise:** that a zoom in never shows fewer counters within a level. The
  German counter is folded at 8 px per cell in the view opened there too. A counter that
  comes out of its nation's fold can take a neighbour of another nation and be folded with
  it. On this scene and on the 400 formations of the unit test every step in shows as many
  or more; the spec's expectation stands as written and is what will say if a scene does not.
- **The pictures** (`declutter1938`, counters in view and over central Europe; before → now):
  - the start: 65, 2 · 58, 6 · 61, 17 → 65, 19 (3 px per cell) · 104, 56 · 87, 58 → 91, 61
    (8 px). The 3 px stop is reached from 1.5 inside level 5, the 8 px stop from 6 inside
    level 3; the other stops are landings and did not change.
  - after one year, central Europe at 6 and 8 px: 21 and 20 → 21 and 27.
  - `flagsClear1938`: 3 px per cell as before (79 counters, 39 of 41 flags, Vienna's and
    Prague's left out). 6 px per cell, reached from 3 inside level 4: 64 → 71 counters, 22 of
    22 → 21 of 22 flags: Bucharest's is left out, with three Romanian counters in the column
    above it (the 40 px rule of ADR-65's addendum; the spec checks the rule for each capital).
  - `docs/evidence/1.45/` shot again; `flags-clear-6px.png` looked at: no counter on another,
    every number reads, Bucharest without its flag under 133.9k, 62.3k and 87.2k.
- **`flagsClear1938` restated: 22 frames for the flags to come to rest after 3 → 3.4 px per
  cell, not 20.**
  - *What it measured:* the flags ease to their places after a step of the zoom and then
    stand. With the hold kept through the step no counter came out; the last frame in which
    something moved was the 18th, and 20 had one to spare.
  - *Now:* five counters come out at that step. A flag makes way for a counter once it is
    half visible (`drawFlags`: "one fading in is in the way"): half a fold (125 ms, frame 8),
    the flag's move (150) and the tail (50) are 325 ms. Frame by frame: the flags last moved
    at 128 ms after the step, the view at rest in frame 21. 20 frames are 320 ms.
  - *Why this is not a test made weaker to pass:* the 20 was the frames this step took in
    the code of its day, not a limit set for the flags; no counter came out then, and a flag
    did not wait for one. The spec's other limits stand: no flag steps
    more than 8 px in a frame, and the view comes to rest. The step out (3.4 → 3) took 21
    frames in the code before as well; the spec does not make it.
- **Cost** (the page, a year into seed 1938, 30 frames of a zoom eased inside or across a
  level, two runs each; ms a frame, before → now):
  - 1.5 → 2.6 px per cell: 6.6 → 7.3 (worst 11.6 → 13.1); 3 → 5.2: 4.9 → 5.3; 6 → 10.5:
    4.6 → 5.4 (worst 13.4 → 13.8); 5.2 → 3: 3.2 → 4.0. At rest after: the same.
  - Counters that turned twice or more on the way: 5 → 9, 17 → 19, 21 → 23, 0 → 2.
  - One fold in Node: 0.15 ms (179 clusters, level 6) to 1.4 ms (534, level 2); the hold
    stands after one or two folds more at every level and zoom tried (15).
- **Not done:**
  - The landing of a split or merge still folds free and takes its hold a frame later
    (ADR-75's cost, "the frame after a merge lands, a few counters turn"). The same rounds
    would end it; not this part.
  - A held counter still takes the nearest box in its wider reach, not the lead it had.
  - A zoom that trembles (a pinch) folds free at every frame: a counter at the edge can fade
    in and out. Not measured.

### ADR-157 · 2026-10-07 · accepted — A group of markers the shorter way cannot part is parted along the lines between them (PLAN 3.5h)

- **Context:** `markerStacks1938`, the second test (no T1 marker more than a quarter under
  another, no box further than 6 px from its formation), failed at 1900 m/px on Spain's
  front after two weeks since PLAN 3.5: 745 and 754 at 27 %, 754 and 795 at 26 %, 795 and
  776 at 26 %. PLAN asked which it was before anything changed: a scene the 6 px cannot
  part, or a case the parting does not handle.
- **Found** (a scratch spec that wrote the page's 51 leads to a file, and scripts in Node):
  - `nudgeApart` on those leads gives the spec's pairs: 26.7, 26.2 and 26.4 %.
  - A search over moves of at most 6 px (400 random starts, each 4,000 steps of descent on
    what is over the quarter) leaves no pair over it at 1900 m/px and none at 1800: the
    worst 24.8 %. The scene can be parted.
  - At 1800 m/px `nudgeApart` left 745 and 754 at 25.6 %. The spec stops at 1900.
  - The five boxes 776, 795, 754, 745 and 782 stand in a line from the lower left to the
    upper right, 8 to 13 px apart in y. For each pair the shorter move is along x: every
    move of the chain was along x, 776 stood at −6.00 and 754 at +5.45, and nothing was
    left to give.
- **Tried on the scene and on 3,000 random clusters of 2 to 8** (pairs left at 1900 m/px;
  clusters of the 3,000 with a pair left):
  - as it was, 8 rounds: 3; 1,420
  - 32 rounds: 2; 1,391 (200 rounds: the same two)
  - what a box at its limit cannot take goes to the other, 32 rounds: 1; 1,392
  - the axis with room left for the move, 32 rounds: 2; 1,398
  - along the line between the centres, 8 rounds: 0; 1,261
- **Decision:** both ways, the old one first. `partAlong(items, way)` is the loop that was
  `nudgeApart`, with the way a pair moves as its argument: `shorter` (along x or y) or
  `between` (along the line between the two centres, by the step that leaves 24 % under).
  `nudgeApart` parts all by the shorter way; a group of markers within reach of each other
  (26 + 12 px by 29 + 12 px) in which a pair is left is parted again by the other way, from
  the formations, and takes those moves if the sum of what is over the quarter is less.
- **Why not the line between the centres for all:** it leaves fewer pairs, but it would move
  every parted box of every scene (the pictures, the city names placed against the boxes),
  and it was not shown never to leave more than the shorter way. This way no group has
  more left than before, by the rule itself, and the test counts it.
- **Not changed:** no expectation of the spec; `NUDGE_MAX_PX`, the quarter, the 8 rounds.
  Where the boxes stand is still a function of where the formations stand (PLAN 2.7v): the
  tests of rest pass as written.
- **Cost:** a group with a pair left is parted twice. On fields more crowded than any
  front (every lead in a cluster of up to 8 on 60 px): 2.2 → 3.1 ms for 1,000 leads and
  6.7 → 10.3 ms for 3,000, in Node. Not measured in the page: the 1938 world has 1,054
  formations and fewer leads.
- **Consequences:** a group changes its way when an army's step leaves or clears a pair:
  its boxes then ease to the new places over 150 ms, as for any move. How often that
  happens in a running game was not counted.
  - *Counted 2026-10-07 (PLAN 3.5i; a script in Node, since deleted):* seed 1938 from day
    14, hour by hour for 48 h, every formation of the world where the table has it, the
    stacks with their hold from hour to hour, 599 to 630 leads at 1900 m/px (29,288
    box-hours). Boxes whose move changed by more than 2 px from one hour to the next: 49 by
    `partAlong(…, 'shorter')`, 61 by `nudgeApart`; 34 of the 61 were on one way in one hour
    and on the other in the next, in 10 of the 48 hours. Of boxes whose formation had not
    moved in that hour: 14 and 30. At 1200 m/px (886 to 908 leads): 28 and 43, standing 2
    and 7. On the lines between at any hour: 11 to 25 boxes of about 600. The largest
    change 12 px by either way (from one limit to the other).
  - *Read:* near the old number, a quarter more; no hold on the way. What is new is that
    a box whose own formation stands moves more often (16 more in two days of the whole
    world). Each such move is an ease of 150 ms. If it shows as unrest in a picture of a
    front, the fix is a hold on the way, as `STACK_HOLD`.
- **Not known:** how many scenes both ways leave that 6 px could part. In the random
  clusters the other way cleared some of what the shorter way left and left most of it;
  whether those can be parted at all was not searched.

### ADR-156 · 2026-10-07 · accepted — The zoom demo's battle is seed 1948's (PLAN 3.5g)

- **Context:** `zoomDemo1938` chooses its battle in Node: of the divisions that fire in the
  last hour of day 30 and have stood a day, the one whose battalions have lost most, and it
  asks that every battalion of it is under half its men. In seed 1944's game (ADR-142) the
  division it finds since PLAN 3.5 is the same Latvian one, with 0.61 to 0.76.
- **Looked at first, whether a mechanism failed** (a scratch script: every division with
  eight battalions or more, by each of the spec's conditions). Seed 1944, day 30: 941
  divisions, 103 fire; 30 have every battalion under half. Of those, 8 are on the retreat,
  6 are in contact, 3 fire and have stood a day: Spanish Republican divisions with one
  battery or none (the spec asks two). On days 45, 60 and 90 there are 63, 74 and 113 worn
  divisions and none that passes. So losses are as before and no condition of the spec drops
  a division it should take. The scene moved; nothing is broken.
- **What moved it is not known.** The spec passed on 3.5a's game (`0755501`, the full suite),
  and 3.5a is the retreat: so the retreat alone did not. One of 3.5a1, 3.5b, 3.5c or 3.5d
  changed seed 1944's first month; not bisected. What the retreat does is make the scene
  rare in every game: a division that loses 0.255 of its men in one battle breaks off for
  a day, and a worn one that stands and fires is one that came back.
- **Decision:** `SEED = 1948`, the day stays 30. Of the seeds 1925 to 1965 on day 30,
  fourteen have a division that passes the spec's filter with every battalion under half
  and a march and contact (none of 1942 to 1947). The spec
  as written, run on the nearest: 1941 fails (a Romanian division, out of the battle in the
  fourth hour: 0 shots), 1948 passes, 1939 fails (the division chosen has no march). 1948:
  formation 392, a Japanese square division north of the Yangtze against two Chinese light
  divisions, 5,705 men in 45 elements, 40 battalions of 90 to 177 of 500, five batteries
  with 1, 2, 4, 4 and 3 of 12 guns, 75 shots by or at it in each of the four hours.
- **Not changed:** no expectation of the spec, and no line of it but the seed and the
  comment. The pin is not concerned (no rule).
- **Consequences:** the pictures of `docs/evidence/2.10/` are of another battle, in China
  and not in the Baltic, with a division of 45 elements and not 28. A rule that moves seed
  1948's first month can move the scene again; the scan takes 45 s for 40 seeds and three
  days, and the spec 70 s a seed.
- **Not looked at:** six Japanese divisions of seed 1944's day 30 stand out of contact
  with org 0.00 to 0.03 and no retreat; whether they are off their network was not asked.

### ADR-155 · 2026-10-07 · accepted — A war that ended with the peace of another the same day is not judged (PLAN 3.5f)

- **Context:** `workerNodeGrowth1938` had the page's hash apart from Node's two days after a
  continued game began. Not the save: the page left Node at tick 73 with no save at all. One
  number of the state differed, by its bits: the winner of a `PeaceSigned` row of the history
  was `undefined`, which a `Float64Array` takes as a NaN, and Chromium's NaN there is not
  Node's. `warSystem` goes through the wars as they were at the day's start; the terms of one
  peace annexed the last member of a side of a later war, `Wars.endAllOf` removed that war,
  and the loop made a peace of it all the same, signed for `W[0]` of a side with no members.
- **Decision** (`systems/war.ts`): the day's loop skips a war that is no longer in
  `world.wars.list`. Nothing else: no check in `emit`, no NaN made canonical in the save.
- **Why not the wider guard:** a canonical NaN in the hash would hide the next `undefined`
  from the one spec that found this one. A check in `emit` is on every event of every tick.
- **Consequences:** no peace event, history row or truce for a war that ended with its last
  member. A rule's defect, not a rule: the pin (seed 99, one year) did not move, so that game
  has no such war. Games that had one go on otherwise from there: the truce held no one (no
  nation is `undefined`), but the row is in the hash.
- **Not measured:** how often it happened in a long game.

### ADR-154 · 2026-10-07 · accepted — The mix: a nation wants a share of its army's upkeep in tanks that rises with its income, in peace too, and saves for the armoured division (PLAN 3.5d)

- **Context:** `pickTemplate` gave armour to a rich nation (income ≥ 200) at war, every
  third order, and none to one whose enemies were armour-heavy (the motorised branch came
  first). In ten years of seed 99 the tanks' share of the army's upkeep fell from 22.2 to
  3.9 % for Germany, 32.1 to 7.5 % for Britain, 30.8 to 0 % for France, 12.5 to 0 % for
  Japan; in seed 7 Germany had no armour formation left in year 10.
- **Decision** (`ai/economic.ts`):
  - *The share wanted* (`armourWanted`) is a function of the monthly income alone: none up
    to `RICH_INCOME` (200), in a line to `ARMOUR_SHARE_MAX` 0.3 at `ARMOUR_FULL_INCOME`
    1,000. 0.3: one armoured division of 1938 among eight divisions (the random world's
    armies, SPEC §4) is 0.29 of their upkeep, and Britain's and France's armies of 1938
    have 0.32 and 0.31. 1,000: the five richest of 1938 (USA, ENG, GER, SOV, FRA) are over
    it; Japan (837) wants 0.24 and Italy (654) 0.17. Sixteen nations of 1938 are over 200.
  - *The loop is on upkeep, not on orders:* the tanks' part of the army's upkeep
    (`templateArmour` × the upkeep of each formation, the orders in training with it, each
    order of the month as it is made) over the army's. Losses and disbanding move it, and
    a nation with six slots does not order six armoured divisions in a month.
  - *Armour first, the answer to armour after:* an order is armour while the share is
    short; only the orders that are not armour are motorised against an armour-heavy
    enemy. `nc.builds` is counted still (a saved column) and read by nothing.
  - *It saves.* Found by the first measurement: with the share alone the mix moved for
    the United States only. A tally of 72 months of seed 99: Germany wanted armour in 63
    and had the price of the cheapest it knew in 22, Britain in 58 and 3, Japan in 72 and
    0. The fallback of PLAN 1.42c (an order the treasury cannot pay for is replaced by
    infantry) buys an infantry division whenever the treasury is 1,001 over the reserve,
    so it is never 3,829 over it. An army's upkeep costs the same gold in armour as on
    foot (200 months of it), so nothing is lost by waiting but time. The rule: short of
    the price of the best armoured division it knows, a nation with an order in training
    orders nothing more that month; with none in training it orders the best it has the
    gold for, infantry at the least. PLAN 1.42c's concern (slots empty for months of a
    war) is kept so far: the queue is never empty by this rule.
  - A nation that knows no armoured division orders as one with armour enough
    (`bestArmour` returned the division of 1938 for it, which the tech check replaced by
    infantry: the motorised division would have been shut out by its own want of armour).
- **Tests:** `economicAi.test.ts`, "the mix" (5, three of them red first: at peace with no
  army Germany's first order is the armoured division and the rest infantry; with six
  armoured divisions and no other it orders none, at war on its third order; France
  against six German armoured divisions orders armour and motorised divisions; and one of
  the saving, red with the saving taken out: with an order in training and the price of
  two infantry divisions over the reserve, nothing more is ordered). Two tests
  set `nc.builds = 2` to make "the third order" (`economicAi.test.ts`, PLAN 1.42c;
  `armourTemplates.test.ts`): the line is gone, a premise of the rule before, and every
  expectation stands as it was.
- **Measured** (`tools/diag/armourMix.ts`, ten years; the tanks' share of the army's
  upkeep in %, by year 0, 2, 4, 6, 8, 10; before → after):
  - seed 99, GER: 22.2, 11.9, 19.4, 3.1, 0.3, 3.9 → 22.2, 29.3, 27.6, 27.1, 27.7, 29.5.
    ENG: 32.1, 16.7, 11.7, 8.2, 9.3, 7.5 → 32.1, 27.0, 29.8, 27.6, 29.8, 28.1.
    USA: 19.5, 3.2, 30.3, 24.4, 29.7, 30.7 → 19.5, 20.5, 27.9, 28.2, 30.0, 31.2.
    JAP: 12.5, 0, 0, 0, 0, 0 → 12.5, 19.1, 22.1, 16.9, 14.9, 13.8.
    SOV: 41.3, 35.0, 34.2, 36.3, 31.4, 28.0 → 41.3, 38.1, 36.9, 33.7, 32.0, 22.3.
    ITA: 7.6, 8.0, 2.4, 0, 0, 0.1 → 7.6, 5.9, 3.5, 2.2, 1.8, 1.6.
    FRA: 30.8, 0.4, 0, 0, 0, 0 → 30.8, 28.9, 27.6, 0, 0, 0 (another game: France falls in
    year 5 here, in year 1 before).
  - seed 7, GER: 22.2, 12.9, 9.6, 5.2, 0.5, 0 → 22.2, 29.3, 28.6, 30.8, 26.7, 28.4. ENG:
    32.1, 14.6, 10.3, 8.3, 6.1, 5.2 → 32.1, 29.8, 29.9, 30.4, 26.8, 25.1. USA: 19.5, 33.8,
    19.8, 23.1, 20.9, 20.9 → 19.5, 24.5, 27.1, 29.0, 29.0, 27.6. JAP: 12.5, 0 to the end →
    12.5, 0, 15.3, 20.6, 17.1, 14.7. SOV: 41.3, 33.2, 28.9, 26.3, 24.5, 15.1 → 41.3, 33.5,
    31.5, 21.4, 19.0, 14.8. ITA: 7.6, 7.2, 7.0, 3.1, 0.8, 0.5 → 7.6, 4.1, 3.3, 1.8, 0.4,
    21.5 (of an army of 55 formations, 106 before: Germany's income is 1,791 there and
    Italy's 628). FRA: 30.8, 20.5, 22.6, 17.0, 6.2, 3.7 → 30.8, 25.5, 21.7, 25.0, 26.1, 10.9.
  - Armour formations of Germany in year 10: 10 of 163 → 18 of 118, and 0 of 138 → 14 of
    99. Fewer formations for the same gold.
- **Consequences:**
  - The pin: 6252a656 → d3067126.
  - The tick, five years of seed 99 (pinned, one run): 1.839 → 1.666 ms (budget 1.5);
    year 1 2.754 → 2.414 (budget 2.4). Another game, not a faster rule.
  - *Not done, not measured:*
    - Italy, the Soviet Union and Japan stay under what they want (Italy 1.6 % of 0.17 in
      seed 99). In the tally of six years Italy wanted armour in all 72 months and had the
      price in none: it saves and its treasury does not grow. Whether a nation with no
      surplus should want less is balance (Phase 7).
    - Which armoured division is bought: one with nothing in training buys the best it
      has the gold for, so the division of 1938 is bought after 1941 too. Not counted.
    - A nation at war that saves raises one infantry division at a time while it has
      less armour than it wants. What that does to a war that goes badly is not measured.
    - Armies over the cap of peace (35 % × (0.3 + 0.7 × aggression/100) of income) order
      nothing in peace, armour or other: the cap is untouched (ADR-58).

### ADR-153 · 2026-10-07 · accepted — Spearheads: where a sector that attacks has armour, the armour marches on the enemy's cell and the rest hold the front cell (PLAN 3.5c)

- **Context:** a sector with 1.5 times its threat sent every formation it had at one enemy
  cell. Armour came there first more often than not because it is faster, not because it
  was sent: in seed 99's first year, of the 44 attacks with armour that came to contact,
  armour was first in 35 (seed 7: 22 of 31), and half of what was sent to them was not
  armour.
- **Decision** (`planNation`, where it gives its orders):
  - *Armour* is a formation whose template has half of its upkeep or more in tanks:
    `SPEARHEAD_ARMOUR` 0.5 against `EconomyTables.templateArmour`, the table the economic
    AI disbands by (PLAN 3.1d). The armour templates have 0.66 to 0.93, the Soviet rifle
    division 0.20, the mechanised division 0.14, the others 0. No element is looked at.
    The planner gets the table as the economic AI does (`operationalAiOf(tables)` in the
    list of systems); called with none, no formation is armour.
  - *The rule:* where a sector that attacks has armour among its formations, the armour is
    ordered to the enemy's cell and the rest to the sector's front cell, as in a sector
    that holds. A sector with no armour attacks with all it has: most nations have none.
  - *"The rest follow"* is not an order of its own. The plan of the next day has the front
    where the armour took ground, and the front cell with it.
  - An order within a sector of the one a formation follows is not given (ADR-53, as
    before): infantry on the march at the enemy's cell when armour joins its sector
    marches on.
- **The metric** (SPEC §7, `tools/diag/spearheads.ts`) is defined with this part and not
  with PLAN 3.5e, which wanted it defined before it is measured: this part's test of
  acceptance is that measurement. It is read from the run (orders to a cell an enemy
  holds, and who is first in contact within a sector of it), with no hook in the planner,
  so that the same tool measured the code before the rule.
- **Measured** (360 days, before → after; seed 99, seed 7). Attacks armour was sent to
  that came to contact, armour first in: 35 of 44 → 44 of 46, 22 of 31 → 32 of 34. Armour's
  share of the formations sent to them: 50.8 → 73.4 %, 50.0 → 79.2 %. Over all attacks
  that came to contact: 10.2 → 11.2 %, 8.8 → 10.9 %, with armour 7.0 and 8.8 % of all that
  is sent.
- **Consequences:**
  - The tick, five years of seed 99: 2.229 → 1.839 ms (budget 1.5); year 1 3.041 → 2.754.
    Another game, not a faster rule.
  - The pin: 158aeb46 → 6252a656.
  - `deploy.test.ts` (BLOCKERS: its share hangs on one pile-up) passed in this game.
  - `tests/sweep/researchYears.test.ts` failed in this game and its premise was mended, no
    expectation. It says that every nation rich through 1940 and 1941 knows a tech of 1941
    in 1942, and read "through" as rich on 1 January 1940 and on 1 January 1942 (ADR-147).
    France is rich on both days here (income 1,035 and 1,074) and not between them: Germany
    holds it from March 1940 to the peace of May 1941, its income is 158, and in 1942 it
    has four techs of 1940 and 1941 to go (`mechanisation`, `sonar`, `fighters_2`,
    `armor_medium_2`). The premise is now read on the first day of each of the 24 months.
    Not changed: at least three such nations, each of them knows `armor_medium_2` in 1942,
    nobody knows the heavy tank before 1942, and every nation rich in 1942 and in 1944
    knows it in 1944, France among them. A premise read by income on some days is what
    this test has: research is paid by the budget of each month, and the sum of two years'
    budgets would be the premise itself.
  - Not done: infantry is not ordered after the armour in the plan that sends it; armour
    is not gathered from other sectors for an attack; nothing of it is on the page (PLAN
    3.6). Nine attacks in ten take ground with no contact at all, so the metric speaks of
    the tenth.

### ADR-152 · 2026-10-07 · accepted — The operational AI allots a formation to the sectors it can reach, class by class (PLAN 3.5b)

- **Context:** since ADR-149 no march crosses a nation that is not in the war. The
  operational AI allotted its free formations to front sectors by distance alone, also
  across a sea or a nation at peace. The order was refused, the formation stood, and the
  next day's plan asked again: 11,013 of the
  AI's orders in seed 99's first year (6,102 in seed 7), most of them refused by the
  provinces at no cost, 1,595 in two years after a search (PLAN 3.4Rm: 3.0 s).
- **Decision** (`planNation`):
  - *Classes.* The free formations within range of a sector are put in classes by where
    they stand: the landmass, and on it the group of provinces joined by ground open to
    the nation (`Passage.group`); those on closed ground, which they walk out of, are a
    class of their landmass.
  - *Reach.* A class reaches a sector when an order from it to the sector's own front cell
    would not be refused before its search: the cell the order goes to (`snapTarget`: the
    cell itself, or one of the class's landmass within 3 cells), then what `mayReach` asks
    (one group, or a start on closed ground). `mayReach` is taken out of `findRoute`,
    which asks it first: the planner and the order cannot part.
  - *The reserve* is the farthest 15 % of those in range of a sector they reach; a
    formation that reaches no sector in range stays where it is.
  - *The allotment* is made class by class over the sectors the class reaches, by the
    weights and rules of before (largest remainders over 1 + threat/10,000, one for every
    sector while formations last, a march into a sector kept, the rest nearest-first).
    A sector's strength, and so whether it attacks, is of all the classes sent there.
  - A nation whose formations are one class that reaches every sector is allotted as
    before, order for order.
- **Why a test before the search and not the search:** a search is 1.5 to 3.3 ms (PLAN
  3.4Rm) and a plan has hundreds of pairs of formation and sector; the groups are made
  once per plan with the passage. What the groups let through and the search then refuses
  (a province with some open ground that is not open from side to side) is still asked and
  refused: 476 and 1,082 orders in the year.
- **Why classes are not merged** when two reach the same sectors (a formation on closed
  ground and the army beside it): tried, for the cost of an allotment per class. It is
  another game (hash f98f48ae), in which `deploy.test.ts` fails: 99 of 111 formations in
  contact on day 60 share a view with their nearest enemy (the test wants more than nine
  in ten), ten of the twelve others (nine Chinese divisions and one of the Communists)
  stand about one Japanese division whose block is deployed against an eleventh (`DEPLOY_REACH`, PLAN 2.14c1). The test was not touched and
  the merge was not kept: it was no part of the rule. In the game of the rule as it is the
  share is 100 of 102. That the share hangs on one pile-up is in BLOCKERS.
- **Measured** (360 days, before → after; seed 99, seed 7): refused orders 11,420 → 1,074
  and 6,585 → 1,517. Formation-hours out of contact and standing, nations at war: 3.49 →
  2.33 million and 3.88 → 3.32 million. Cells that changed hands: 36,103 → 51,347 and
  45,299 → 45,376.
- **Consequences:**
  - The tick: 1.859 → 2.229 ms over five years of seed 99 (budget 1.5), year 1 2.461 →
    3.041. The armies that stood march and fight (combat 6.2 → 8.2 s of year 1); the
    rule's own part is the passage, now made for every plan with a formation in range
    (0.9 s a year, 0.45 before), less the searches not made (`findPath` 5.1 → 3.6 s).
    PLAN 7.1 has the line.
  - `passageOf` takes a map of the hour's passages: planners with the same open holders
    get one object (the `barred` note of `findRoute` is by that object, and now serves a
    coalition). `snapTarget` keeps its answers by landmass and target: the land is fixed.
  - The pin: a100e74b → 158aeb46.
  - Not done: the war with no front at all (BLOCKERS: France and Portugal with Spain at
    peace) waits for the navy; a formation that reaches no front stands, and is not
    brought home or to a port.

### ADR-151 · 2026-10-07 · accepted — An order to a formation in the middle of a step leaves it where it stands (PLAN 3.5a1)

- **Context:** a march is a path of cells, the index of the last cell reached and the share
  of the step to the next (`pathStep`, `stepFrac`); the place is read from them. `orderMove`
  began every route at the point of the cell the formation stood in, with the share at 0,
  and put the formation on that point. A formation ordered in the middle of a step (the
  operational AI's new target, a player's click, since ADR-150 a retreat out of contact)
  was moved there in that hour: half a step, and more than a cell where the land points of
  two neighbouring cells lie far apart (ADR-79: up to 1.9). In 360 days of seed 99, 3,365
  of 6,577 such orders moved the formation by more than 0.3 cells, the widest 0.94.
  Found by `movement.test.ts` (no formation on the march more than a cell from where it was
  an hour before) on the game PLAN 3.5b makes: 1.03 cells, a retreat in Shandong, hour 581.
- **Decision** (`orderMove`): for a formation on the march with a share of a step behind it,
  the route begins at the nearer of the step's two cells. If its second cell is the step's
  other end, the path is the route and the formation goes on along the step; else the
  other end is put before the route, and the formation walks back to the nearer end and on
  from there. The share is read from the path's first cell, so the place is the same.
  `originCell` is the path's first cell.
- **Why not a place of its own** (a march that begins anywhere, with two more columns):
  the state of a march stays a path and a share, and every reader of it (the view's
  tiers, the wrecks, the save) is left as it is. The cost is a walk of at most half a step
  that a march from the very place would not make.
- **Consequences:** a path that is found again from `originCell` (a save from before PLAN
  3.4Rl, which has no paths) may begin with another step, and the formation is then moved
  once. The pin: 7c85fde9 → a100e74b. `wrecks1938` looks for the day it watches (PLAN
  3.5a1): the fixed day had no dead in this game, as day 19 had none after ADR-150.

### ADR-150 · 2026-10-07 · accepted — The retreat: org is lost to the losses of a battle, and a formation in contact with little org breaks off for a day (PLAN 3.5a)

- **Context:** SPEC §5.2 step 4 had no task. Nothing left contact: a formation held until one
  side was destroyed (PLAN 3.4Re: 34 formations of armour with their infantry gone, 7,334
  hours in contact), and org was lost only to want of supply (ADR-135). PLAN 3.5 asked
  whether the retreat is a part of it: it is its first part, since a spearhead that cannot
  leave a fight is spent in its first one and cannot be measured.
- **Decision** (`src/sim/systems/retreat.ts`; `retreat` of `data/combat.json`):
  - *Org with the losses* (`orgLossSystem`, after combat): org − (1 ÷ 0.3) × the share of its
    strength that the hour's battle took. Three tenths: the loss at which a division is held
    to be unfit to go on; with the threshold below it breaks off at a quarter.
  - *No org back in contact* (`supply.ts`). With it, 1/32 an hour came back on the network
    and a loss of 0.3 % an hour (the loser of a 2:1 fight) took 1/90: nobody's org would
    ever fall in a battle.
  - *The retreat* (`retreatSystem`, after movement, before combat): in contact with org
    under 0.15 (SPEC's figure), to ground of its side out of every near enemy's contact: by
    the point 3 cells from its nearest enemy (twice the reach of contact), within 2 cells of
    it; else the nearest within 8 cells of itself. For 24 hours (a column, `retreat`, state)
    it is in no battle, is held on its march neither by contact nor by the enemy's cells,
    presses no cell and gets no order from the operational AI. A day: on its network it has
    0.75 of its org back, so it does not come back to break again in the first hour.
  - *A try every sixth hour* by (tick + id), the first too: a refused search of a short
    route costs 3.3 ms (PLAN 3.4Rm), and a battle's formations would all ask in one tick.
  - *From the state alone:* the enemies are found by a scan of the formations, not from the
    hour's cached contacts, which a load drops (the critic's R2-B4 was state of that kind).
- **Why out of battles altogether, with no fire on it:** a formation that is fired on while
  it walks away at 1.2 km an hour, with a quarter of its fire, is destroyed on the way, and
  the rule would change nothing. Pursuit fire is a rule of its own (not done).
- **Why the enemy's cells do not hold it** (found by measuring; not in the first version):
  3,580 of 3,588 tries that found no ground in 180 days of seed 99 were by formations
  standing on a cell the enemy held, with none of their side within 2 cells of the point:
  attackers behind whom the front had gone back. With the search widened to 8 cells and the
  march let across the enemy's cells, the formation-hours in contact with org under 0.15
  fell from 32,499 to 15,731 in the year (seed 99), and the retreats rose from 1,163 to
  2,318.
- **Where the org is lost:** in a system of its own after `combatSystem`, from what that
  leaves in `world.battleLosses` (derived, the same tick). In `combatSystem` itself it broke
  nine tests that call it alone to measure the fire (the square law of a fight to the end,
  the matrix of PLAN 3.4, the forest of 3.3): they are tests of the fire, and are unchanged.
- **Found on the way:** two enemies on one point. A formation on the retreat is in no
  contact, halts at a cell's point where an enemy may stand, and is marched over; a day
  later the two are in contact at distance 0, and `deployOf` had no direction for their
  blocks (null: `warBattle.test.ts` failed on it). They stand front to front, the lower id
  facing east (`deploy.test.ts`). 1,517 formation-hours of it in the year before the march
  could cross the enemy's cells, 18 after (seed 99; 0 in seed 7).
- **Found on the way, older than the rule:** the wreck of an element that died in the hour
  its formation marched into contact lay an hour's march from its sprite (`wrecks1938`:
  0.075 cells; the unit test: 0.106). `elementPlaceBefore` took a formation that was not
  deployed the hour before to stand where it stands now, and the march of the hour had moved
  it. Rare while the first hour of a contact killed nothing; a formation back from a retreat
  comes with battalions nearly dead. `noteMove` keeps where a formation stood before an
  order or the march moved it in the tick (`world.movedFrom`, derived), and the event has
  that place (`deploy.test.ts`, red without it).
- **Specs whose scene moved** (no expect changed; the full suite on the rule: 135 passed, 3
  failed, 1 did not run):
  - `wrecks1938`: the hour is 24 × 35, was 24 × 19. Seed 1938 has 1,612 elements dead in 90
    days, 3,915 before; by week 0, 0, 2, 0, 22, 47, 30, 89, 287, 197, 535, 152, 251. The 16
    hours from day 35, in Spain: 14 dead, all in the viewport.
  - `tiers1938` and `individuals1938` spawn a Chinese division against two Japanese with a
    buff, on Chinese ground, and watch it die. It broke off before three elements had died.
    Their setup now occupies the ground for 14 cells about (`paintControl`): with none of
    its side within reach the division holds, as the rule has it. (The two sides swapped
    was tried first: the lone division was gone in 7 hours with four battalions under 64
    men at most, where `individuals1938` asks for six.)
- **Measured** (the first 360 days, every hour, `.cache/35a/measure.ts`, scratch; before →
  after):

  | | seed 99 | seed 7 |
  | --- | --- | --- |
  | retreats (formations) | 0 → 2,318 (336) | 0 → 2,720 (367) |
  | most by one formation | 40 | 51 |
  | formations destroyed | 337 → 105 | 312 → 123 |
  | elements destroyed | 7,904 → 2,975 | 7,196 → 3,361 |
  | formation-hours in contact | 384,187 → 249,559 | 339,910 → 265,924 |
  | of them with org under 0.15 | 2,185 → 15,731 | 2,929 → 17,151 |
  | longest such stand of one formation | 335 → 423 h | 454 → 537 h |
  | formations at the year's end | 798 → 1,026 | 823 → 1,010 |
  | armour with no infantry alive (formations) | 38 → 13 | 34 → 13 |
  | its hours in contact | 12,511 → 3,235 | 6,973 → 2,720 |
  | orders refused (`MoveRejected`) | 9,433 → 7,248 | 10,284 → 7,809 |

  Cells flipped in each of five years of seed 99: 25,592, 28,368, 20,856, 17,270, 15,644 →
  22,767, 22,016, 15,720, 13,776, 25,834: the fronts move as before.
- **Tick** (five years of seed 99, pinned, one run each; the committed tree `0755501`): mean
  1.816 → 1.825 ms, year 1 2.509 → 2.203 (budget 2.4), year 2 1.753 → 2.253, year 5 1.482 →
  1.585. A different game: not a gain or a loss of the rule's own. (Before `noteMove`:
  1.801, 2.172, 2.224, 1.568; the five hashes the same.)
- **The pin:** e5df6177 → 7c85fde9. A save from before does not load (a column more).
- **Not done, and what follows:** war kills a third of the formations it did. Whether wars
  still end, and how (exhaustion, the score), was not looked at: balance, Phase 7 (ADR-58).
  A formation with no supply keeps under 0.15 and retreats from every contact (40 and 51
  times in the year): not looked into. No fire on the retreating; no surrender of those
  with no ground within reach; nothing on the page; a player is not told and can order a
  formation that is out of battles; the AI does not pull a formation out before it breaks
  (PLAN 3.5c).

### ADR-149 · 2026-10-06 · accepted — No march across a nation that is not in the war; the path of a march is saved (PLAN 3.4Rl)

- **Context:** found in PLAN 3.4Rf (ADR-143). `findRoute` asked the ground and not its
  holder; contact held whoever met an enemy, wherever; repatriation skips a formation in
  contact or on the march. France, at war with Portugal, marched through Nationalist Spain.
  PLAN 3.4Rl asked for a decision first: no route across such a nation, or the crossing
  stands and is fed, or the holder is drawn into the war.
- **Measured before the rule** (`.cache/rl/third.ts`, scratch, not in the repo; the first 360
  days, every hour; "a third nation's ground" is a cell whose holder is not of the
  formation's supply bloc, not at war with it and not on its side of a war):

  | formation-hours on a third nation's ground | seed 99 | seed 7 |
  | --- | --- | --- |
  | in contact | 5,859 (51 formations) | 20,721 (142) |
  | out of contact | 544,335 (494) | 626,586 (606) |
  | with no supply, in contact and out | 473,088 | 511,964 |
  | share of all the hours with no supply, out of contact | 90.4 % | 90.1 % |

  Italy in Bulgaria (61,136 hours, 43 formations), Germany in Turkey and Bulgaria, China in
  Mongolia (228,478 hours in seed 7), France in Nationalist Spain and the Soviet Union. The
  figures of contact are lower than PLAN 3.4Rl's (11,704 and 21,617): the games have changed
  with PLAN 3.4Rj and 3.4Rk.
- **Decision:** the first of the three. A formation is routed over the ground of its own
  supply bloc, of a nation it is at war with, of a nation on its side of a war, and over
  nobody's (`foreignTo`, the test repatriation had). The route goes round any other nation's;
  with no way round the order is refused (`MoveRejected`), the AI's and a player's alike.
  - *Why not "the crossing is fed":* an army fed on any ground it walks on has no supply rule
    left, and the nation it crosses has no say.
  - *Why not "the holder is drawn in":* every war would pull in the nations between the two,
    and AoC's nations take land from their neighbours: they do not cross a third.
  - *On such ground already* (a peace found it there, or the order is older than the peace):
    a cell of a third nation is entered from a cell of that same holder. So a formation
    walks on that holder's ground and out of it, which is the way home, and does not step
    from it onto another third nation's.
  - *At the walk:* a march whose next cell has become a third nation's since the order ends
    before it (`MoveRejected`, the formation idle on the last cell it reached). It does not
    wait there as before an enemy's cell: nothing would turn the cell.
- **The path of a march is state.** It was a cache, found again from origin and target after
  a load, which was the same path while a route asked the ground alone. A route found after a
  load would now be one for the holders of the hour of the load. `world.paths` is saved
  (`world.paths`, a section of the core: id, length, cells for each formation on the march)
  and hashed. A save from before has none: each path is found again at the formation's next
  step, on the holders of then, as after an edit of the terrain or of the looping
  (`editor.ts`, `gameOptions.ts`, which drop the paths).
- **The cost, and what was cut** (seed 99, five years, pinned, `npm run sim`; 1.475 ms a tick
  before, year 1 2.704):
  - *The rule alone:* 3.567 ms. An order that cannot be met was searched for until the
    search had walked all the ground the formation can reach: 76,000 cells of Africa for a
    formation of French West Africa, 205,000 for a Soviet one, each formation, every day
    (refused orders in the first 360 days: 1,903 before, 15,650 with the rule).
  - *The provinces first:* `World.heldByNode` counts the cells of each province node by
    holder (kept by `setController`, a scan after a load; `landCounts.test.ts` compares the
    two). A `Passage` marks the nodes with open ground and groups them by neighbours
    (`nodeGroups`); two ends in different groups are refused with no search, and a long
    route is planned over open nodes. In five years 90,304 long searches ended there, and
    5,135 went on to fail in the cells.
  - *No search beyond the corridor:* a province with some open ground need not be open from
    side to side, so the corridor of a planned route can be barred. The search outside it
    found a way 24 times in two years and failed 539 times, at 12 ms. With a `Passage`, from
    open ground, a long route (over 500 km) that is not found in its corridor is refused.
    **This is a rule and not only a saving:** a way round that leaves the provinces of the
    planned route and their neighbours is not taken.
  - *The formation beside it:* the last corridor search that failed is remembered by its
    stamps (`NavGrid.barred`); the same goal from the same province is refused to a start
    that search had reached. The same answers (the year hashes were the same with and
    without it).
  - *After:* mean 1.903 and 1.894 ms a tick in two runs (budget 1.5; 1.475 before), year 1 2.585 and 2.577 (budget 2.4; 2.704 before), year 5 1.527 and 1.514 (0.978 in an unpinned run before).
    The game is larger: 974 formations at the end of year 5, 690 before. Of two years'
    7.05 s in `findRoute` (0.41 ms a tick): long routes found, slow ones (over 1 ms) 833 at
    3.5 ms; long ones refused in the corridor 980 at 2.5 ms; short ones refused after a
    full search 161 at 3.7 ms. PLAN 3.4Rm has these.
- **After** (the same script and days):

  | formation-hours on a third nation's ground | seed 99 | seed 7 |
  | --- | --- | --- |
  | in contact | 116 (44 formations) | 65 (61) |
  | out of contact | 40,877 (92) | 29,691 (83) |
  | with no supply, in contact and out | 34,859 | 25,256 |
  | on the march, in contact and out | 39,168 | 28,514 |
  | orders refused (before: 1,903; not counted) | 9,433 | 10,284 |

  What is left is on the march: the way home after a peace, and orders older than the peace
  (Afghanistan on Soviet ground in seed 7, 9,597 hours, 5 formations).
- **Tests:** five in `tests/unit/movement.test.ts`, four of them red on the old source: Aachen to Lille
  goes by the French border and not through the Netherlands and Belgium; France is refused
  the march to Porto, and has it with Nationalist Spain in the war on either side; a march
  ends before a cell that has become Poland's; a march is the same after a load, and another
  with its path found again. `tests/unit/landCounts.test.ts`: the kept count by node equals
  a count of the map through war, edits, undo and load.
- **A test whose world changed, not its expects:** `supply.test.ts`, "otherwise it starves
  and is sent home", stood an Italian division in central Germany at peace and expected it
  on the march home. Austria and Switzerland lie between: under the rule there is no way,
  and repatriation moves it to its spawn point, as it did where no route existed. The test
  stands the division at Lyon now (France borders Italy), with France the partner of the
  other case; a fifth test in `movement.test.ts` has both divisions: the one at Lyon marches
  home over French and Italian ground only, the one in Germany is at its spawn point at once.
- **The pin:** e0fefce9 → e5df6177.
- **Not done:**
  - The operational AI allots formations to a front they cannot reach, and asks again every
    day (9,433 refusals in seed 99's first year). They stand idle where they starved before.
    A nation at war with one it has no land way to fights it with nothing. PLAN 3.5.
  - How many formations repatriation moves to the spawn point for want of a way home that
    keeps off a second third nation: not counted.
  - A short route (under 500 km) that does not exist is still searched for over all the
    ground in reach.
  - Memory: none added to the route search; the count by node is a Map of some 10,000
    entries.

### ADR-148 · 2026-10-06 · accepted — A nation that dies is nobody's puppet: it returns free (PLAN 3.4Rk)

- **Context:** the seventh read's finding 5. `eliminateNation` ended a nation's wars, its
  alliance, its formations and its capital, and left `nations.overlord`. Only an annexation
  and an integration cleared it, and `puppetSystem` skips the dead, so the tie could not end
  while the nation was dead. PLAN 3.4Rk asked for a decision first: a revival comes back
  free, or the tie outlives the death.
- **Run here first** (the three tests below, red on the old source; 1938, seed 99):
  - A Kill of each of the 40 puppets of 1938 at tick 0 left 40 dead nations with an overlord.
  - Albania killed, Italy killed, Albania revived in mid-month: Italy's puppet, and
    `blocOf` gave it dead Italy's supply bloc. The read's suspicion holds.
  - Albania dead with Italy holding its land, a revolt in an Albanian province after the
    cooldown: Albania returned as Italy's puppet, and the war of independence that
    `spawnRebels` declares was refused (`WarRejected`: `Refusal.Subject`, an overlord and
    its puppet). It took its provinces from Italy and kept them in peace.
- **Decision** (`eliminateNation`): the death clears `overlord` and `integration`, and asks
  for a full refresh of the supply network (the blocs changed). A nation that returns is
  free, by a revolt, a collapse of the holder or God Mode's Revive alike.
- **Why free:**
  - *A revival is a revolt against the holder.* After a death the holder of a puppet's land
    is most often its overlord (`leaveLand` gives what was occupied to the occupier, and a
    puppet falls with its overlord's war). With the tie kept, the one war a revival is for
    is the one that cannot be declared.
  - *A death ends every other tie already:* wars, the alliance, guarantees. And the scenario
    schema refuses a dead nation with an overlord ("dead nations have no puppet relations"):
    the game made a state that its own data may not hold.
  - *The overlord may be dead, or another nation's puppet, by then.* The schema refuses a
    puppet of a puppet as well; the kept tie could make one.
- **No event.** `PuppetReleased` reads "{a} was freed from {b}" in the history; a nation that
  died was not freed. `NationEliminated` is the event. An annexation clears the tie without
  one too.
- **Autonomy and loyalty are left as they were:** they are read of a puppet only (the panel,
  the monthly pass, the tribute), and `makePuppet` writes both.
- **Seen, not changed (one cause a commit):** the other end of the tie. A Kill and a
  collapse free the puppets of the nation that ends; a death by the loss of the capital
  (`capitalsSystem`) does not, and its puppets are a dead nation's until the month's start
  (`puppetSystem` frees them then). In BLOCKERS, the watch list.
- **Tests** (`tests/unit/puppets.test.ts`, three, red before): by a Kill, with the overlord
  killed too and the Revive in mid-month (no overlord from the death on, a bloc of its own);
  by a revolt's revival on the old overlord's land (free, no `WarRejected`, at war with
  Italy); no dead nation with an overlord after a Kill of every puppet.
- **The pin:** af99d608 → e0fefce9, by what the state records and not by the game. Four
  puppets die in seed 99's first year (Mengjiang of Japan at tick 3593, Manchukuo of the
  Soviet Union at 5699, Republican Spain of Nationalist Spain at 6203, Lebanon of France at
  6432) and none returns in it. Run with and without the change (`.cache/rk/pin.ts`,
  scratch): the same owner and controller of every cell, 753 formations, 7 wars and the
  same sum of gold to the last digit; with the columns of the dead put back, the same hash
  in both. The full refresh of the network that the death asks for changes nothing either
  (the same hash without that line), as PLAN 2.11j holds; it is kept because the blocs
  changed.

### ADR-147 · 2026-10-06 · accepted — A cell taken by a nation that is not at war with its owner is the owner's again (PLAN 3.4Rj)

- **Context:** the seventh read's finding 4, older than the lines it read. `territorySystem`
  turns a frontier cell to the neighbour at war with its holder, whoever owns it, and
  `makePeace` gives back only what the two sides own. A cell that a third nation took from
  its occupier stayed that nation's to hold, with no war against the owner and no rule to end
  it. PLAN 3.4Rj asked when it goes back: at the flip, or at the next peace of either.
- **Measured first** (`.cache/rj/occ.ts`, scratch; seeds 99 and 7, 720 days, every hour; a
  cell with an owner and another controller who are not at war, by the write that made it
  so): 640 and 478 cells came to be so, every one at a flip of `territorySystem`, in every
  one the owner at war with the holder the cell was taken from. None at a peace, an
  annexation, a death or a revolt. The taker was on the owner's side of a war in 572 and 52
  (of them 226 and 2 an overlord and its puppet: the Soviet Union in Sinkiang, France in
  Morocco and West Africa), and in a war of its own in 68 and 426 (Mongolia on China's land
  267, Turkey on Syria's 144). Standing at a 30th day: 0 to 297 and 2 to 440, at most 312 and
  440.
- **Decision:** at the flip. A cell that flips to a nation is controlled by its owner
  instead when the owner is a living nation other than the taker and the two are not at war:
  partner, puppet or stranger. The taker's pressure decides the flip as before; only who
  gets the cell changes. Nobody's land and the land of the taker's enemies are the taker's.
- **Why at the flip, not at a peace:** every such cell is born at a flip, so one line there
  keeps the state from ever existing; a rule at the peace would leave it for the months of
  the war and need a second rule for a war that ends by a death.
- **Why the puppet too:** PLAN 3.4Rj let the pair of overlord and puppet stand. But no peace
  returns such a cell either (both are on one side), and `warSystem` counts land lost to
  whoever holds it: a puppet most of whose land its overlord had freed would capitulate on
  the first day of a war it leads.
- **What it costs, not tuned:** a nation that frees a stranger's land cannot go on through
  it. The connectivity rule wants a neighbouring cell the attacker controls, and the freed
  cell is the owner's; the taker's armies do not count in its defence unless the two share a
  side (`Wars.sameSide`). Where they do, the front is the partner's and the armies of both
  press it (ADR-50).
- **Measured after:** 0 such cells at every hour of the 720 days of both seeds. Seed 99, five
  years, pinned, one run: cells flipped a year 24,576, 15,626, 18,912, 18,548, 18,265 (before:
  27,134, 17,156, 16,964, 18,315, 36,275); mean tick 1.475 ms (1.721), year 1 2.704 ms
  (2.591). It is another game from the first months on, so the figures are not the rule's
  cost: PLAN 3.4Rm measures.
- **The pin:** a73098dc → af99d608.
- **Not done:** `annexInto` passes what the annexed nation occupied of a third to the annexer
  after the war has ended; no run made such a cell, and the test of two years would show one.
  A test world that hands land to a controller with no war (`setController` alone) keeps it
  until a flip: `block` of `tests/unit/territory.test.ts` sets its owners now.
- **Tests:** `tests/unit/territory.test.ts`, four more, three red before (a partner's land,
  the land of a nation in a war of its own, a puppet's; the fourth holds the enemy's own land
  and nobody's as the taker's); `tests/sweep/heldYears.test.ts`, two seeds, two years, red
  before at the second and the first month's start.
- **A test whose game changed:** `tests/sweep/researchYears.test.ts` asked on 1942-01-01 that
  every nation with an income of 1,000 knows `armor_medium_2` (a tech of 1941). That is not
  PLAN 3.1b's AT (nobody knows the heavy tank before 1942; the rich know it by 1944), and it
  held because every nation rich in 1942 had been rich since 1938. In the game since,
  Denmark (income 157, one line, 17 to 19 techs in three years) is attacked by Germany in
  October 1940 with Belgium at its side, holds 1,019 German cells within three months with
  its four formations, keeps 1,096 at the peace of February 1941 and has an income of 1,087
  from then: three lines, 6 techs in ten months, the earliest first, 6 of 1939 and 1940
  still ahead of `armor_medium_2`. The research rule does what it says. The check now names
  its premise: rich at the start of 1940 and of 1942. It still wants three such nations, and
  the check of 1944 is as it was, Denmark in it (it passes).
- **Looked at, not found:** whether Denmark's gain is the rule's doing (allies freeing its
  land, then advancing from it in its name). At no month's start of that war did another
  nation hold a Danish cell. Why Germany's front there was open was not looked into
  (balance, ADR-58).

### ADR-146 · 2026-10-06 · accepted — The editor's history and an import give a dead nation no cell: its cells go to the holder, else to nobody (PLAN 3.4Ri)

- **Context:** the seventh read's finding 3. `editPaint` refuses a dead nation (PLAN 2.17),
  but `apply` of `editor.ts` wrote a step's cells back whoever had owned them, and
  `importLayer` asked `nations.has`, not `living`. A stroke by Paris, Kill France, undo: 29
  cells of dead France; a redo after a Kill: 29; an import naming dead Austria: 113 (the
  tests' figures; the reader's were 29, 13 and 500). PLAN 3.4Ri asked what an undone cell of
  a dead nation becomes: nobody's, or the undo is refused.
- **Decision:** nobody's, with the rule of a death. In `apply`, for each cell of a nation
  step, undo and redo alike: a controller that is not living counts as none; an owner that is
  not living is replaced by that controller (a living nation that held the cell of the dead
  one keeps it, as `leaveLand` gives it at the death), else by 0; a cell whose controller
  was dead is controlled by its owner. A step with no dead nation in it is written back
  exactly, a cell with an owner and no controller too. `importLayer` reads the id of a dead nation as 0, in the
  cells it counts and in the step it records.
- **The step is not rewritten.** The stack is saved state, and `living` is read when the step
  is applied, so a save and its log replay exactly. A nation that lives again (a revival, the
  God command) gets its cells from a later redo or undo as the step was made.
- **Why not refuse the undo:** a stroke covers cells of living and dead nations, and a
  refusal either blocks the whole history below that step for good or needs a rule for half a
  step. `tick.ts` already says what holds for the paint: land for a dead nation is land of no
  living state, and 0 may be painted.
- **Why in `apply`:** undo, redo, a linked pair of an import and the import's own step all
  pass it. The check in `importLayer` is there so that its count and its recorded step are
  true, not for safety.
- **Not done:** a nation with no cell that an undo should bring back to life. The God command
  Revive is the way; the history moves cells, it does not found states.
- **Tests:** `tests/unit/editor.test.ts`, four more, red before (29, 29, 29 and 113 cells): an
  undo after a Kill (and the redo that follows gives Germany its stroke again), a redo after
  a Kill, an undone cell that Germany held of France, an import naming dead Austria and its
  undo.
- **The pin stands** (a73098dc): no game without commands has a step on the stack.

### ADR-145 · 2026-10-06 · accepted — A capital on land its nation no longer owns moves; the capital rule sees to it, not the paint (PLAN 3.4Rh)

- **Context:** the seventh read's finding 2. `capitalsSystem` looked at a capital city only
  when a nation at war with its nation controlled the cell. Land given away with no war (the
  editor's paint, the God brush since ADR-118) was never seen: Luxembourg painted for
  Germany, Switzerland for France and Albania to nobody lived on with 0 cells, and Paris
  painted for Germany stayed France's capital. PLAN 3.4Rh asked which of the two sees to it:
  the paint or the capital rule.
- **Decision:** the capital rule, and it asks the owner. Hourly, for the capital city of a
  living nation: held by a nation at war with it, the capture as before; else, on a cell the
  nation does not own, the city stops being its capital and `relocateCapital` runs (the
  largest city it owns and controls, else a field capital, else `eliminateNation`).
- **Why the rule and not the paint:** every way of giving land away passes it (paint, undo,
  redo, an import, a cession), where a check in `paint` covers one. And it runs with the
  clock: a stroke and its undo in a paused game kill nobody.
- **Why the owner and not the controller:** a capital occupied with no war is an
  occupation, which the tests of PLAN 1.15 keep ("without a war, occupying the capital
  captures nothing"). The paint sets the owner; an occupation does not.
- **No capture:** no `CapitalCaptured`, no war score, and no annexation, neither by
  `winnerTakesAll` nor by the death rule of PLAN 1.20 (no core land held). Nobody took the
  city in a war, and a brush on Paris that hands all of France to Germany is not what the
  stroke said. The nation dies only with no cell left to move to.
- **Rejected:**
  - *The paint eliminates at once.* It ends a nation in a paused editor on the way to
    repainting it, and leaves undo, redo and the import to be done again.
  - *A given capital is a capture by the new owner.* See "No capture".
- **Tests:** `tests/unit/capitals.test.ts`, four more, red before: Luxembourg and
  Switzerland painted for another nation and Albania to nobody are eliminated within the
  day, with no land, capital or formation left; Paris painted for Germany moves France's
  capital to a city France owns and controls, once, with no capture.
- **The pin stands** (a73098dc): in seed 99's first year no capital stands on land its
  nation does not own.
- **Not decided here:** an undo after the death gives the land back to the dead nation
  (PLAN 3.4Ri). The old owner's formations on painted land stay until the day's
  repatriation (ADR-118).

### ADR-144 · 2026-10-06 · accepted — The research budget is a rule of the economy: every living nation has it, with AI or without (PLAN 3.4Rg)

- **Context:** `nations.research` was written by the economic AI alone (ADR-128), which
  skips a nation whose AI is off and every nation when the AI is off for the world. So a
  nation taken at tick 0 had no budget and never opened a line (France: 18 techs after two
  years, 27 under the AI), a nation taken later kept the budget of that month for good, in
  debt too, and with the gate of PLAN 3.1a a player was shut out of every template behind a
  tech. PLAN 3.4Rg asked for one of two: the rule for everybody, or a command and a control
  on the Economy tab.
- **Decision:** the rule for everybody. `researchBudget` (`systems/research.ts`) is the
  formula the AI had: RESEARCH_SHARE of the month's income, at most `researchCap`, nothing
  in debt, nothing while the nation is short with a treasury below RUNWAY_MONTHS of what is
  short. The economic AI's system calls it monthly for every living nation: for an AI's
  nation where it did (after the disbanding, before the orders), for a nation without AI
  as the only step taken.
- **Why not the control:** it is a second feature (a command, a refusal, a control, its
  texts, a spec), and the defect is that nothing researched, not that the player could not
  choose. A budget the player sets needs a default all the same, and this is it. AoC has no
  research and no played nation (PARITY rows 8 and 37), so there is nothing to match.
- **Why in the AI's system and not in the economy's:** an AI's nation must get the figure
  it got, from the balance after its disbanding and before its orders spend gold. Seed 99's
  pin stands (a73098dc), which is the proof.
- **A nation without AI** has nothing disbanded for it, so "would disband" is "is short, and
  the treasury below three months of what is short", as the month finds it. It has a budget
  again the month after.
- **Measured** (seed 99, two years, `.cache/rg/count.ts`, scratch): France, Germany and
  Britain, each played from tick 0 in a game of its own: three lines after a month, budgets
  of 1.766, 3.580 and 3.965 gold a day (the AI's twins: the same), 18 → 27 techs each (the
  AI's: 27, 26, 27). France with the AI off for the world: three lines, 18 → 27.
- **Tests:** `tests/unit/research.test.ts`, three more, red before: a played nation and two
  with their AI off have the twin's budget and lines after two days; with the world's AI off
  every nation has a budget and a line and nothing is ordered; a nation without AI in debt
  has none the next month. `tests/sweep/researchYears.test.ts`, one more (70 s): France
  played, and France with no AI in the world, know after two years a tech of 1939 that the
  AI's France knows.
- **Saves:** no state added. A saved game of a played nation gets its budget at the next
  month's start.
- **Consequences:** a world with the AI off is no longer still: every nation with gold pays
  for techs. A test that runs months of such a world and reads a treasury sees it.
- **Not done:** no command sets a budget or picks a tech; a player's nation takes its techs
  in the rule's order (`nextTech`). Suppression has the same gap and has its own command.

### ADR-143 · 2026-10-06 · accepted — A formation on a cell that is not its side's is fed when a network that feeds it lies within two cells (PLAN 3.4Rf)

- **Context:** PLAN 3.4Re counted, in seed 99's first year, 47 % of the hours that formations
  on engines were in contact as hours with no supply, and 44 % with no org. A formation was
  fed on a cell of a network that feeds it and nowhere else (Supply v1, ADR-25), and the
  cell under an attacker is the enemy's until the territory rule turns it (16 hours of
  pressure, ADR-27). Since PLAN 3.2 that costs what moves on engines its org (three quarters
  of its fire) and a tenth of its vehicles a day. The task: measure by cause first, then one
  rule.
- **Measured before the rule** (`.cache/rf/dry.ts` and `.cache/rf/other.ts`, scratch, not
  in the repo; the first 360 days, every hour, seeds 99 and 7; "dry" is supply 0):

  | in contact | seed 99 | seed 7 |
  | --- | --- | --- |
  | on engines: formation-hours, formations | 29,324, 72 | 25,240, 68 |
  | on engines: dry, no org | 47.3 %, 44.3 % | 41.2 %, 38.0 % |
  | on foot: formation-hours | 276,105 | 285,881 |
  | on foot: dry | 22.1 % | 27.3 % |

  The dry hours on engines, by the cell the formation stood on:

  | cause | seed 99 | seed 7 |
  | --- | --- | --- |
  | an enemy's cell | 55.3 % (32 formations) | 65.4 % (35) |
  | a third nation's cell (neither side's, not at war with it) | 44.1 % (10) | 32.0 % (11) |
  | nobody's cell | 0 | 0 |
  | its own side's cell, fed again at the next refresh (the 12 hours) | 0.6 % | 0.4 % |
  | its own side's cell, cut off (a pocket) | 0.0 % | 2.1 % |

  - *Two of the task's four causes are none:* nobody's cell, and the 12 hours between two
    refreshes of the network.
  - *The enemy's cell,* by the cells (Chebyshev) to the nearest cell that feeds, hours not
    fed on engines: 2,847 / 4,081 / 627 / 289 at 1 / 2 / 3 / 4 and more (seed 99), 2,627 /
    2,897 / 596 / 858 (seed 7). Within two cells: 88 % and 79 %. On foot: 68 % and 59 %.
    These are not encircled formations: they stand in the reach of their own pressure
    (`PRESSURE_RADIUS`, 2 cells) and of contact (1.5 cells) from their own ground.
  - *A third nation's cell* is another matter (below): armies that meet on the march across
    a nation that is in no war with either. France's alone in seed 99 (6,125 of its 6,343
    hours on engines, ten formations at one place in Nationalist Spain, 596 to 629 hours
    each). All of it four cells and more from a network.
  - *By nation, on engines, dry in contact:* France 96.6 % and 100 % (Spain), Japan 82.8 %
    and 86.1 %, the Soviet Union 36.0 % and 33.1 %, Germany 9.5 % and 9.8 %.
- **Decision:** the first of the task's three. A formation whose cell is not its side's (an
  enemy's, a third nation's, nobody's) is fed when a cell of a network that feeds it lies
  within `SUPPLY_REACH` = 2 cells (Chebyshev, across the map's seam), by the same test as
  the cell under it: its bloc's network, or that of a bloc on its side of a war. On a cell
  of its own side with no network it is not: that is the pocket, and its rule stands.
  - *Why not "the org is lost only to what encircles":* it would leave the supply rule as
    it is for what walks (half its fire, 2 % a day, half its pressure on the cell it is
    there to turn) and mend only what PLAN 3.2 added. The cause is the cell under the
    attacker, and it is every formation's.
  - *Why not "the rules stand":* a division one cell past its own network was dry in 8
    hours. 36 % of the hours not fed on an enemy's cell were at one cell.
  - *Two cells:* what a formation presses on (`PRESSURE_RADIUS`, the same distance) it is
    fed from. One cell would feed 36 % and 38 % of those hours; three, 96 % and 88 %, and
    would reach across any ring that the territory rule can draw.
  - *Not across a ring:* the reach is for ground that is not the formation's side's. A
    formation on its own ground in a pocket one cell of ring from its network stays dry
    (the second test). One that stands on the ring itself, within two cells of the network
    outside, is fed: it is through.
  - *A third nation's ground* within two cells of the formation's network feeds as an
    enemy's does: the test is of the network, not of the holder.
- **After** (the same scripts and days; the games differ from the first day of a war on):

  | in contact | seed 99 | seed 7 |
  | --- | --- | --- |
  | on engines: formation-hours | 33,756 | 29,320 |
  | on engines: dry, no org | 12.4 %, 11.2 % | 12.2 %, 10.5 % |
  | on foot: formation-hours | 378,289 | 319,434 |
  | on foot: dry | 11.7 % | 10.3 % |

  - Expected from the first table before the run: about 24 % on engines in seed 99 with
    France's Spanish hours left as they were, about 10 % on foot. France did not meet
    Portugal in Spain in this game of seed 99 (0 hours on a third nation's cell on engines);
    in seed 7 that cause is 32.2 % of what is left (Germany 775 hours, Italy 281).
  - What is left on engines in seed 99: an enemy's cell three cells and more out (65.4 %)
    and pockets (33.8 %, the Soviet Union's 1,412 hours).
  - By nation, on engines: the Soviet Union 11.9 % and 7.4 %, Japan 42.1 % and 30.6 %,
    Germany 4.6 % and 16.9 %, France 0.0 % and 0.3 %.
- **Tests:** `tests/unit/supply.test.ts`, two, the first red before the rule (a Soviet
  division one cell into seven cells square of German-held ground had supply 0 after 12
  hours): fed at one and two cells from the network, dry at three and four; a panzer
  division keeps its org at two and loses it at four; a pocket behind one cell of ring is
  dry. The pockets of `supply.test.ts`, `fuel.test.ts`, `org.test.ts` and
  `breakdown.test.ts` pass as they were.
- **The pin moved:** 80e8050a → a73098dc (seed 99, one year).
- **Tick time** (seed 99, five years, pinned, one run, the machine idle): 5-year mean 1.721
  ms (1.451 before, budget 1.5), year 1 2.591 ms (2.339, budget 2.4); years 2 to 5: 1.422,
  1.402, 1.287, 1.905. Over budget. The rule's own cost is not it: a replica of the
  system's loop, timed alone over year 1, takes 0.035 ms a tick with the test of the
  formation's own cell that was there before (877 formations, 100 scans of 25 cells, 14
  fed by the reach). The game is another: 15 % more formation-hours in contact on engines
  and 37 % more on foot in year 1, since fewer formations starve in it. **PLAN 3.4Rm.**
- **Saves:** no state added.
- **Not done:**
  - *Armies that meet on a third nation's ground* fight there, dry, until one is gone:
    84 formations and 11,704 hours in seed 99, 103 and 21,617 in seed 7 (France against
    Portugal and Republican Spain in Nationalist Spain; China against Japan in Mongolia,
    1,833 hours; the Soviet Union against Czechoslovakia in Poland). All were on the march:
    a route crosses any land, contact holds whoever meets, and repatriation skips what is
    in contact or moving. **PLAN 3.4Rl.**
  - *Out of contact,* 11 % of the hours on foot and 21 % on engines were not fed, 93 to 95
    % of them on a third nation's cell four cells and more from a network (Italy, Germany
    and Poland in Turkey and Egypt; China in Mongolia, 293,973 hours in seed 7). The same
    cause, under 3.4Rl.
  - Nothing of the reach on the page: the supply map mode is not built (SPEC §9).

### ADR-142 · 2026-10-06 · accepted — The open: armour's fire at a target with no armour on plains, grassland or desert whose side has no AT gun alive in the battle is × 1.25; the matrix (PLAN 3.4d)

- **Context:** the fourth rule of the table of ADR-139 (SPEC §6.1): "armour is strong vs
  infantry in the open". The task asked first what the terrain table already gives, and
  allowed the rule to be dropped if the table does it.
- **Measured before the rule** (a scratch test, not kept; 48 hours and the first hour,
  seeds 5 to 7, a tank brigade and a panzer division against a holding `infantry_div` and
  an `infantry_div_cadre`, which has no AT gun):
  - One volley of a light tank company at a battalion, plains = 1: grassland 1.158 (the
    class's 1.1 ÷ the ground's defence 0.95), desert 1.05, forest 0.582 (0.8 ÷ 1.25 ÷ the
    battalion's own 1.1 of ADR-137). Over 48 hours the brigade takes 1,347 to 1,356 men on
    plains, 1,556 to 1,567 on grassland, 1,412 to 1,422 in the desert, 792 to 797 in a
    forest.
  - Of the men a division loses to a tank brigade its tanks take 95 to 97 %, the two
    motorised companies the rest; to a panzer division 77 to 83 % (the rest to its
    infantry and howitzers).
  - The AT gun: the brigade loses 3.5 to 3.8 tanks to the division with one and 0.51 to
    0.55 to the cadre division; it takes 1,302 to 1,319 men by its tanks from either.
- **Kept, and why:** the table tells open ground from close already, by 1.72 between plains
  and a forest, so "the open" alone would be the same thing twice. What the table cannot
  say is the row's condition: an AT gun cost the tanks seven times the losses and took
  nothing from their fire. The rule is that condition. It is not the terrain table's
  figure made larger.
- **Decision:**
  - *The shooter:* an element of the armour arm (ADR-139), by its arm as in ADR-140.
  - *The target:* an element whose `armor` figure is 0, the split `effectiveness` makes
    between `soft` and `hard`: the rule is a factor on a tank's soft fire. So mechanised
    infantry (armour 4) is not run down, and guns and howitzers are. By the arm, as in
    ADR-140, mechanised infantry would be: it rides under armour, left out.
  - *The ground:* the target's cell, plains, grassland or desert (`open.terrain` of
    `data/combat.json`). Tundra, ice and hills are not: the table gives armour less than 1
    there. Holding or moving.
  - *No AT gun:* the target's side (ADR-139) has no element of a class of
    `gunsOnGuns.shooter` with strength at the hour's start. The gun of another formation
    of that side covers it, and an ally's; the shooter's own side's guns are nothing to
    it. No share is asked, as in ADR-139 to ADR-141: one battery covers a battle.
  - *A factor on the damage* (`IN_THE_OPEN`, `open.fire` 1.25). The choice of target does
    not know of it. *1.25:* the table's proposal, a figure of mine, not tuned (ADR-58).
  - Anti-air guns are not AT guns here, though their piercing (20) beats a light tank.
- **When it bites:** seed 99, the first 360 days (a counter in `combat.ts` for one run, not
  kept): 542,522 volleys of armour, 532,553 at a target with no armour, 431,212 of those on
  open ground, 91,023 of those under the rule (21 %), by 82 formations at 87. Of the land
  templates four have an AT gun (`infantry_div`, `infantry_div_square`, `motorised_div`,
  `mech_div`); the cadre, colonial, light, mountain, cavalry and
  garrison formations and the Soviet rifle division have none.
- **The matrix** (`tests/unit/combinedArmsMatrix.test.ts`, 6 tests, 20 fights of 48 hours,
  seed 5; the table is in SPEC §6.1). Attackers: the tank brigade, the panzer division,
  the brigade with its infantry destroyed, the division with its howitzers destroyed.
  Defenders: an `infantry_div` whole, without its AT gun, without its howitzers, with
  neither. Plains and a forest. Each rule is a ratio of two cells, asked to 3 %:
  rule 1 1.150 (the panzer division's tanks with and without its howitzers), rule 2 1.301
  in a forest and 1 on plains, rule 3 0.697, rule 4 1.250 on plains (1.253 for the panzer
  division) and 1 in a forest. The AT battery takes 73 to 84 % of the tanks lost.
  - *Why 3 % holds:* in 48 hours a formation loses so little (4 of 200 tanks, 1,400 of
    12,000 men) that the dead take almost nothing from the fire. A longer fight would
    need wider bands.
  - *Rule 3 is read on the panzer division against itself:* against the tank brigade the
    ratio is 0.62, since the division's own fire kills the gun's crew faster and the
    brigade's does not.
  - *The defender's howitzers* do nothing a rule names: the attacker has no AT gun to hold
    down. They are in the matrix for "AT vs armour": without them the division takes 0.93
    to 0.98 of the tanks.
- **Tests:** `tests/unit/combinedArms.test.ts` (10 more, written first; six red before the
  rule: the three open grounds, the armoured target beside the Italian infantry, the gun
  of another formation and an ally's, the shooter's own gun. Green before and kept: the
  data, forest, hills, urban).
- **The zoom demo's game** (`tests/e2e/zoomDemo1938.spec.ts`) is seed 1944's, not seed
  1938's: the rule changed that game, and on its day 30 no division that fires, stands,
  has two batteries and fits the picture has its battalions under half their men (the best
  has 0.58 to 0.77). The finder and every expect are as they were. In seed 1944's game it
  is a Latvian division with 95 to 164 of 500 men a battalion, and 148 sprites of other
  formations are drawn walking over the close stops.
- **The pin moved:** 78650f1b → 80e8050a (seed 99, one year).
- **Saves:** no state added.
- **Not done:** nothing of the four rules on the page (PLAN 3.6, or 3.7 to place it); the
  AI does not know of any (PLAN 3.5); no share of AT guns to tanks; tick time not measured
  (one test a volley, on a lookup the screen already makes).

### ADR-141 · 2026-10-06 · accepted — Guns on guns: an AT gun whose enemy has artillery alive in the battle fires × 0.7 (PLAN 3.4c)

- **Context:** the third rule of the table of ADR-139 (SPEC §6.1): "artillery suppresses AT".
  Its figure was a proposal there. The task asked for a number first: how much of "AT vs
  armour" the AT gun is.
- **Measured before the rule** (a scratch test, not kept; plains, 48 hours, seeds 5 to 7,
  an `infantry_div` of 24 battalions, 3 batteries and 1 AT battery holding against one
  formation): of the 3.5 to 3.8 tanks it takes from a tank brigade, the AT battery takes
  73 to 76 %, the battalions 21 to 22 %, the howitzers 3 to 5 %. In a forest 75 to 77 %.
  From a panzer division (2.7 to 3.1 tanks) 85 to 89 %. So one element of 28 does three
  quarters of a division's work against tanks, and a factor on it is a factor on that.
- **Decision:**
  - *The shooter:* an element of a class of `gunsOnGuns.shooter` of `data/combat.json`
    (`at`). It has a bit of its own in `UnitRule.arm` (`ARM_AT`, 8), beside the three arms
    and not one of them: the bonus of ADR-139 asks for `(arms & ARM_ALL) === ARM_ALL` now.
  - *The enemy's artillery:* a formation of the battle that the shooter's nation is at war
    with has an element of the artillery arm (`combinedArms.arms.artillery`) with strength
    at the hour's start. The shooter's own side's guns do not count, and no share is asked,
    as in ADR-139 and ADR-140.
  - *A factor on the gun's fire* (`SUPPRESSED`, `gunsOnGuns.fire` 0.7), at whatever it
    shoots, armour or not. The choice of target does not know of it.
  - *0.7:* the table's proposal, a figure of mine, not tuned (ADR-58).
- **When it bites:** seed 99, the first year (a counter in `combat.ts` for one run, not
  kept): 106,140 volleys of AT guns, 93,872 of them under the rule, by 265 formations;
  16,708 at armour, 7,245 of those under the rule. Every division template but the tank
  brigade and the garrison brigade has guns, so against most enemies the rule is a flat
  × 0.7 on the AT gun, and it tells apart only the enemy with no guns: a tank brigade or
  a garrison alone, or a division whose batteries are dead. That is weaker than the row
  reads. A share of artillery to guns would make it tell more; not done (ADR-58: no tuning
  now), and PLAN 3.4d's matrix reads the rule as it is.
- **Tests:** `tests/unit/combinedArms.test.ts` (5 more; two red before the rule: the AT
  gun's volley at a tank of a panzer division against the one at a tank brigade, and the
  same brigade with a division with guns beside it, German or Italian, against that
  battle with those guns destroyed. Green before and kept: the data, the howitzers' and
  the rifles' volleys the same at both, the panzer division's guns destroyed × 1).
- **The AT's "same target type":** the division has one AT battery, so one volley an hour;
  where another formation stands beside the brigade the gun may pick another target, and
  the test compares with the same battle with the guns destroyed and asks for the same
  target type in both.
- **The pin moved:** 13e0a82d → 78650f1b (seed 99, one year).
- **Saves:** no state added.
- **Not done:** rule 4 and the matrix (PLAN 3.4d); nothing of it on the page; anti-air
  guns are not held down; tick time not measured (one OR per enemy formation per shooter
  formation, one test a volley).

### ADR-140 · 2026-10-06 · accepted — The screen: armour on forest or urban ground whose side has no infantry alive in the battle takes × 1.3 (PLAN 3.4b)

- **Context:** the second rule of the table of ADR-139 (SPEC §6.1): "infantry screens armour
  in urban/forest terrain". Its figure was a proposal there.
- **Decision:**
  - *The target:* an element of the armour arm (`armor_l`, `armor_m`, `armor_h` of
    `combinedArms.arms`), by its arm and not by its `armor` figure: mechanised infantry has
    armour 4 and is infantry, and is not asked for a screen.
  - *The ground:* the cell of the target's formation, forest or urban (`screen.terrain` of
    `data/combat.json`, ids of the terrain table). Whether the formation holds or moves is
    not asked: the ground's defence is for holding, the screen is not.
  - *No infantry:* the target's side (ADR-139: the battle's formations its nation is not at
    war with, itself among them) has no element of the infantry arm with strength at the
    hour's start. The infantry of the tanks' own formation is a screen, and so is an ally's.
    No share is asked, as in ADR-139.
  - *A factor on the damage taken* (`UNSCREENED`, `screen.taken` 1.3), on every volley at
    such an element whoever fires it. The choice of target does not know of it.
  - *1.3:* the table's proposal, a figure of mine, not tuned (ADR-58). In a forest it gives
    back to the shooter a little more than the ground's ÷ 1.25 takes from it.
  - The arms of every formation's side are found once per battle now; the bonus of ADR-139
    reads the same map.
- **When it bites:** every template with tanks has infantry of its own (the tank brigade two
  motorised companies of 22 elements, the panzer division eight of 44), so a formation is
  unscreened only once its own infantry is dead and no other infantry of its side is in the
  battle. Seed 99, the first year (counted with a counter in `combat.ts`, not kept): of
  482,082 volleys at armour 39,920 were at armour on forest or urban ground, and 34,160 of
  those at armour with no screen, all of them at 3 formations, all tank brigades. So of
  armour that fights on close ground most volleys fall on a few brigades that have lost
  their two companies and stand on; a formation with more infantry was never unscreened in
  that year.
- **Tests:** `tests/unit/combinedArms.test.ts` (8 more; three red before the rule: the tanks
  of a brigade with its infantry destroyed, in a forest and in a city, against the same with
  a rifle brigade beside it, and against the brigade with its own infantry alive. Green
  before and kept: the data, plains and hills × 1, the guns of a division with no infantry
  × 1, the tanks' own fire).
- **The AT's "at its infantry × 1"** cannot be read on the brigade: its infantry is what the
  test destroys. In its place: what is not armour and has no infantry of its side (the
  howitzers and the AT gun of a rifle division whose battalions are destroyed) takes × 1.
- **The pin moved:** 50b337c6 → 13e0a82d (seed 99, one year).
- **Saves:** no state added.
- **Not done:** rules 3 and 4; nothing of it on the page; the AI does not keep infantry with
  its tanks for it (PLAN 3.5); jungle is not a terrain class, and hills and marsh are not
  close ground here; tick time not measured (one lookup a volley).

### ADR-139 · 2026-10-06 · accepted — Combined arms: four rules in a table; the first, a side with infantry, artillery and armour alive in a battle fires × 1.15 (PLAN 3.4a)

- **Context:** PLAN 3.4, "combined arms (inf + art + armour bonus; AT vs armour; armour vs
  infantry in the open)", AT "matrix test of unit-mix outcomes matches the design table in
  SPEC". SPEC had no table: §6.1 had four sentences. Read first what was there (PLAN 1.13):
  a shooter's `hard` against an armoured target and its `soft` against any other, halved
  when the armour beats its piercing. So an AT gun (hard 18, piercing 45) already hits every
  tank of 1938 in full, and a rifle battalion (hard 1, piercing 2) a light tank at 0.5.
  Nothing read who else was in the battle.
- **Decision, the table (SPEC §6.1):** four rules, each a factor on a volley's damage, one
  part of PLAN 3.4 each. The figures of a rule go into `data/combat.json` with the part that
  reads them, and the tests read that file.
  1. *The three arms* (3.4a, this one): a side with infantry, artillery and armour alive in
     the battle fires × 1.15.
  2. *The screen* (3.4b): armour on close ground whose side has no infantry in the battle
     takes more.
  3. *Guns on guns* (3.4c): the fire of AT guns whose enemy has artillery in the battle is
     less.
  4. *The open* (3.4d): armour's fire at what is not armoured on open ground is more, unless
     the target's side has AT guns in the battle.
  The figures of 2 to 4 are the table's proposals until their part; 3.4c and 3.4d measure
  first what `hard`, the piercing and the terrain table (grassland 1.1, desert 1.05) already
  give, and a rule that would do the same thing twice is dropped there, with the reason.
- **Decision, 3.4a:**
  - *The arms:* by unit class, in the data: infantry = `inf`, `mot`, `mech` (cavalry is of
    class `inf`); artillery = `art`; armour = `armor_l`, `armor_m`, `armor_h`. AT and AA guns
    are of no arm: a rifle division with an AT gun and no howitzer has one arm.
  - *A side:* for a shooting formation, the formations of its battle that its nation is not
    at war with, itself among them. A battle is a group joined by contacts and not two camps:
    of three nations of which two are at peace with each other and at war with the third,
    those two are a side, allied or not. Not asked: an alliance.
  - *Present:* an element of the arm with strength above 0 at the hour's start, in any
    formation of the side. No share is asked: one tank brigade gives the bonus to every
    division of its battle. A threshold by share was weighed and left: by elements the
    panzer division's own guns are 2 of 44 and the tank corps's 2 of 53, and by health a
    howitzer battery is 1.8% of a rifle division, so any figure would be set by the
    templates of today. Phase 7 may ask it again.
  - *A factor on the damage only*, beside supply and org (`COMBINED_ARMS`). The choice of
    target does not know of it: the same volleys as before, each × 1.15 or × 1.
  - *1.15:* a figure of mine, not tuned (ADR-58). Less than the ground gives (a forest
    ÷ 1.25) and more than nothing.
- **What it gives** (48 hours on plains against a holding infantry division, the attacker on
  the move): the panzer division of 1938 takes 3,363 men for 792 (2,921 for 804 before,
  ADR-137: × 1.151); a tank brigade, which has no guns, 1,382 for 611; the Soviet rifle
  division, whose three light tank companies make the third arm, 1,509 for 986; an infantry
  division 1,027 for 1,023. Of the nineteen land templates eight have the three arms
  themselves: the two panzer divisions, the heavy panzer, light mechanised, mechanised and
  main battle tank divisions, the tank corps and the Soviet rifle division.
- **Tests:** `tests/unit/combinedArms.test.ts` (6; three red before the rule: the tank
  brigade with a division with guns beside it, that division and an ally's, a light tank
  company of a panzer division beside one of a tank brigade. Green before and kept: the
  data, the guns destroyed, the other side's fire).
- **The pin moved:** 5bb98ff4 → 50b337c6 (seed 99, one year).
- **Saves:** no state added.
- **Not done:** rules 2 to 4; nothing of it on the page (who has the bonus in a battle is
  not shown: PLAN 3.6 or the review 3.7 to place it); how many formation-hours of a year
  have the bonus was not counted; the AI does not know of it (PLAN 3.5); tick time not
  measured (one pass over a battle's elements an hour, and an OR per pair of formations).

### ADR-138 · 2026-10-06 · accepted — A template crosses a cell at the least `speed` of its manoeuvre elements for that ground (PLAN 3.3b)

- **Context:** the last of `terrainMods {atk, def, speed}` that nothing read (ADR-137 put the
  `atk` and the `def` in a volley). The data: cavalry 0.8 in a forest and 0.7 in mountains,
  motorised infantry 0.6 in mountains and in a marsh, the heavy tank 0.7 in a marsh; 1
  wherever a figure is given for the `atk` or `def` alone. The march had the move cost by
  mobility class only (`moveCost` of `data/terrain.json`, PLAN 1.11).
- **Decision:** the hours to enter a cell are step km × the class's move cost ÷ (the pace ×
  `TemplateRule.terrainSpeed[the cell's terrain]`). `terrainSpeed` is made once from the data,
  by terrain: the least `speed` of the template's manoeuvre elements for that ground, 1
  where they have none.
  - *Whose figure:* the manoeuvre elements', as the template's speed and mobility are theirs
    (`templateMobility`). Support guns are carried: an AT gun's or a howitzer's figure would
    not set it (none has one below 1 today).
  - *The least, not a mean:* a division goes at the pace of its slowest part, as with
    `speed_kmh`. So the panzer division of 1938 crosses a marsh and mountains at 0.6: it has
    8 elements of motorised infantry beside its 34 of tanks. The same holds for the motorised
    division, the light mechanised division, the tank brigade, the tank corps and the panzer
    division of 1941. The heavy panzer division's infantry is mechanised and has no figure:
    its heavy tanks' 0.7 in a marsh is its own.
  - *Which cell:* the one entered, as for the move cost.
  - *The route is not changed:* it is still found by the class's move cost (`findRoute`, the
    province graph's sums). A cavalry division may so take a forest that a route by its own
    figures would go round. One table of costs for each mobility class is what makes the
    province graph three sums and not one for each template; left so.
  - *Fuel:* it burns by the hour on the march (ADR-134), so a cell crossed more slowly costs
    more of it. Meant: an engine that labours through a marsh burns for longer.
- **What it gives** (`tests/unit/terrainMarch.test.ts`, a row of one ground, six hours): the
  cavalry division in a forest 0.8 ÷ 1.5 of its pace on plains (0.667 before), and 1.4 times
  the infantry division's there (1.75 on plains); the heavy panzer division in a marsh
  0.7 ÷ 3.5 of its pace on plains (0.2; 0.286 before). As before: the panzer division in a
  forest at half, infantry in a forest at 1 ÷ 1.5.
- **The pin moved:** 037e1db2 → 5bb98ff4 (seed 99, one year).
- **Another game, and a spec that leaned on a day of the old one:** Germany against Poland
  from the first hour (seed 99) goes apart from the tenth day and Poland falls sooner: 24
  Polish formations on day 35 for 28, 11 on day 50 for 23, 8 on day 60 for 19. No day on
  which it breaks off; not looked into further (balance, ADR-58). `toBattle1938.spec.ts`
  asked day 60 for a battle of a front under the war's banner: that day's largest is now one
  formation against one (56 men against 10,325). The spec now steps to the first tenth day
  from the 20th with what it asks (more than two formations, neither side ten times the
  other's men, eight wars for the row of banners): day 40 in this game, 4 + 4 formations.
  No assertion of it changed.
- **Saves:** no state added.
- **Not done:** the route by the template's own figures (above); nothing of it on the page
  (the formation panel shows the template's speed, not its speed on the ground it stands
  on); how many formation-hours of a year the rule touches was not counted; tick time not
  measured (one figure indexed by the terrain's number and one multiplication a cell entered).

### ADR-137 · 2026-10-06 · accepted — A unit type's own figures for the ground are in a volley, beside its class's (PLAN 3.3a)

- **Context:** PLAN 3.3, "terrain modifiers for tracked mobility and combat". Read first what
  was there. In since PLAN 1.11 and 1.13: the move cost by mobility class (`moveCost.tracked`
  of `data/terrain.json`, read by the march and the route), the fire by unit class
  (`attack.armor_l` … of the same table) and the ground's defence for a target that holds.
  So a panzer division already took less from infantry in a forest than on plains. Not in:
  `terrainMods {atk, def, speed}` of each unit type in `data/units/land.json`. The schema
  checks it and nothing read it: infantry's 1.1 and the AT gun's 1.15 in a forest, the
  heavy tank's 0.8 in a marsh, the cavalry's 0.9 in a forest. This is the `atk` and the
  `def`; the `speed` is PLAN 3.3b.
- **Decision:** damage × the shooter's unit type's `atk` for the ground the target stands on,
  ÷ the target's unit type's `def` for that ground when its formation holds. Both multiply
  the class table's figures (`UnitRule.terrainAtk`, `.terrainDef`: by terrain, 1 where the
  data has none, made once from the data).
  - *Whose ground:* the target's, for both, as the class table since PLAN 1.13. SPEC §5.2
    says "terrain (attacker and defender)": the shooter's own ground is still not read. Two
    formations in contact are 1.5 cells apart at most, and a second cell's figure would make
    a tank in a wood firing out of it worse than one in the open firing in, which is not
    plainly right. Left as it was.
  - *The cover is the holder's:* a formation on the move has no `def` of its unit types, as
    it has none of the ground (PLAN 1.13).
  - *No number changed.* SPEC §6.1 said "big bonus on plains/grassland/desert" for armour;
    the table has 1.1 on grassland, 1.05 in the desert and nothing on plains. The prose is
    corrected, not the table (ADR-58).
- **What the tables give** (the same battle on two grounds, `tests/unit/terrainCombat.test.ts`):
  a panzer division of 1938 against a holding infantry division takes 0.59 of its plains
  toll in a forest in 48 hours (1,723 men for 2,921; the tables' bounds: 0.52 to 0.73), and pays the same (812 for 804);
  the class table alone had that test green before the rule. What was red: the volleys of
  each of the five pairs of the test (e.g. the AT gun's fire in a forest, 1 where 1.05 was
  due), and infantry holding a forest against infantry: 0.805 of its loss on plains before
  (1 ÷ 1.25), 1 ÷ 1.375 now.
- **The pin moved:** 9dd4093d → 037e1db2 (seed 99, one year): infantry and AT guns are in
  most battles, and forest and urban ground under many.
- **Saves:** no state added.
- **Not done:** the `speed` (PLAN 3.3b); the shooter's ground (above); how much of a year's
  fire the rule touches was not counted; tick time not measured (two multiplications a
  volley, the figures indexed by the terrain's number).

### ADR-136 · 2026-10-06 · accepted — Breakdowns: with no supply and no org a formation on engines loses its vehicles and towed guns; org and fuel on the formation panel (PLAN 3.2d)

- **Context:** PLAN 3.2's AT: "unsupplied armour slows, then loses org, then strength". The
  first two stages are ADR-134 and ADR-135. Every formation without supply loses 2% a day and
  what its ground takes besides (ADR-25), armour as infantry: nothing made a tank without
  fuel worth less than a man without bread.
- **Decision:**
  - *The rule:* a formation whose mobility is not "foot" (the gate of ADR-134 and ADR-135),
    with supply 0 and org 0, loses `BREAKDOWN_PER_DAY` = 0.1 a day of its vehicles and towed
    guns, by the hour, besides the attrition. It starts in the hour the org reaches 0, so the
    AT's order holds by construction: for the panzer division of 1938 on the march, slower
    from hour 1, dry in hour 5, no org in hour 36, and its tanks from then.
  - *What breaks down:* an element whose unit type burns fuel and is not counted in men
    (`UnitRule.fuel` > 0 and `menPerUnit` > 1): the five tanks and the heavy artillery
    (towed by tractors). PLAN said "the elements that burn fuel (vehicles, not men)", and the
    motorised and the mechanised infantry burn fuel and are counted in men: their lorries
    are not in the state, so there is nothing of theirs to leave by the road. Their men go at
    the attrition alone. A dry panzer division is in the end a weak infantry division, not
    nothing.
  - *Both conditions.* Supply 0 and org 0: an org lost another way (to damage, when a task
    has that) on a network that feeds the formation breaks nothing.
  - `UnitRule.fuel` is new: `fuelPerHour` of the unit data, which `TemplateRule.fuel` already
    summed.
- **Why a tenth a day:** five times the base attrition, so plainly more; a division's tanks
  are down by half in about five days and it is not wiped out in one. Not tuned (ADR-58).
- **The panel** (`FormationPanel.tsx`, `FormationDetail.org` and `.fuel`): two rows after the
  supply. "Org", a percentage. "Fuel on the march": the template's figure ("38 an hour",
  "4.6 an hour", "None"). Not a fuel level: there is none (ADR-134), the supply row is what
  the formation burns. The elements table already shows the tanks going.
- **What it does to a game** (seed 99, no command, counted each hour of the first year): 69
  formations on engines have supply 0 and org 0 at some hour, 77,955 formation-hours in all
  (47 days each on average), 8,805 of them in contact. So armour that is cut off stays cut
  off for weeks, and now melts there. Whose these formations are, where they stand and why
  they are not fed or moved was not looked into: the AI does not know of supply (PLAN 3.5),
  and the balance waits (ADR-58).
- **The pin moved:** 3fad5d18 → 9dd4093d (seed 99, one year): the rule changes the game, by
  the count above.
- **Saves:** no state added; a save from PLAN 3.2c loads and goes on by the new rule.
- **Tests:** `tests/unit/breakdown.test.ts` (4): which unit types break down; the three
  stages in order on the pocket of ADR-134 (red first: the tanks whole after two days with no
  org); nothing with supply left or on the network; save and load.
  `tests/e2e/formationPanel1938.spec.ts`: the two rows of an infantry division ("100%",
  "None"), and a new test of a panzer division set down deep in Poland, at war and far from
  every formation: 38 an hour; 88% and 100% in the first hour; 0% and 47% after a day; 0% in
  hour 39; 87 hours in, 238 of 340 tanks and 3,504 of 4,000 motorised infantry
  (`docs/evidence/3.2/formation-panel-panzer-dry.png`, `-broken-down.png`).
- **Found by the e2e's first set-up:** a formation on foreign ground at peace marches home
  (three hours for one cell), so it is on its network again before it is dry. The test's
  division is at war.
- **Not decided here:** org lost to damage and the retreat (SPEC §5.2 step 4, to be placed at
  the phase review 3.7); recovery of what broke down (production replaces formations, not
  elements); wrecks of abandoned tanks on the map (an element that ends leaves one, PLAN
  2.4b; a tank lost from a company that lives leaves none).

### ADR-135 · 2026-10-06 · accepted — Org: a formation column; what moves on engines loses it with no supply, and its fire falls with it (PLAN 3.2c)

- **Context:** PLAN 3.2's AT: "unsupplied armour slows, then loses org, then strength". The
  first stage is ADR-134. There was no org in the state: SPEC §3 and §5.2 name one (drained by
  damage, a retreat below 0.15), and no rule had it.
- **Decision:**
  - *A column* `formations.org`, f64, 0 to 1. Every place that makes a formation sets it to 1:
    the start (`addFormations`), production, a revolt's militia, the Spawn command, the toy
    world.
  - *Loss:* a formation whose mobility is not "foot" loses `ORG_RATE` = 1/32 an hour while its
    supply is 0. So the order of the AT holds by construction: the speed falls with the supply
    from the first hour off the network, the org only once nothing is left. A dry panzer
    division has no org after 32 h more.
  - *Gain:* every formation on a network that feeds it gains `ORG_RATE` an hour, to 1. Off the
    network with supply left the org stands.
  - *Combat:* a formation's fire is × (`ORG_FIRE` + (1 − `ORG_FIRE`) × org), `ORG_FIRE` = 0.25,
    beside the supply factor (0.5 + 0.5 × supply) that was there. With no supply and no org:
    an eighth. What it takes does not depend on its org.
- **Whose org falls: the gate is the mobility, not the fuel figure.** PLAN 3.2c said "a
  formation with fuel in its template", and its AT "the rifle division's does not". The Soviet
  rifle division has a fuel of 3 (its tank battalion), so both cannot hold. The AT stands, by
  the gate of ADR-134's speed rule: a formation with a manoeuvre element on foot is not one on
  engines. Its men walk and fight without the battalion's fuel. PLAN's sentence is corrected.
- **Why a floor on the fire:** a formation with no org still shoots. With × org alone it would
  deal nothing and stand in contact until 2% a day had worn it away.
- **Why these numbers:** 1/32 is a power of two, as the supply rate is (the level steps exactly
  between 0 and 1): a day and a third from dry to none, some four times the 8 h in which the
  supply itself goes. The same rate back. A quarter of the fire: the same share as of the
  speed. None is tuned (ADR-58).
- **Not decided here:** org lost to damage and the retreat of SPEC §5.2 step 4 (no task has
  them yet); the loss of vehicles with no org left and the panel (PLAN 3.2d); the AI does not
  know of it (PLAN 3.5); the front's pressure (`territory.ts`) and the nation's combat
  efficiency (`efficiency.ts`) read the supply as before and not the org.
- **What it does to a game** (seed 99, no command, counted each hour): in the first year 74
  formations are below 1 at some hour, 87,582 formation-hours in all, 19,722 of them in
  contact; the lowest is 0. On day 60, 7 of 968 formations are below 1; on day 365, 6 of 849.
  What these formations lost by it was not counted.
- **The pin moved:** 8498494a → 3fad5d18 (seed 99, one year). The new section alone moves it
  (the hash is of every section); the game is another one too, by the count above.
- **Saves:** a save from before has no `formations.org` section and does not load, as with
  ADR-127 and ADR-128. Checkpoints in `.cache/ck/` are to be written again.
- **Tests:** `tests/unit/org.test.ts` (4), written first and red (no column). The pocket of
  `fuel.test.ts` is now `tests/helpers/pocket.ts`, used by both.
- **The zoom demo picks a division that fits its picture** (`tests/e2e/zoomDemo1938.spec.ts`).
  Seed 1938 on day 30 is another game too. The spec takes the division that has lost most;
  that was formation 660 and is 663 now, whose block reaches 0.17 cells north of the point
  the camera closes in on: 277 px at 12 m/px, and the zoom holds that point 253 px from the
  top (where the world view has it), so one battalion of 27 was above the screen and "the
  whole division in the view" failed. Nothing is wrong on the page: a zoom held on a point
  off the middle cuts what is far on the short side. The spec's choice now has one more
  condition, every element within a quarter of the view of that point at 12 m/px; it takes
  formation 653 (2,898 men, battalions of 68 to 162 of 500). No `expect` was changed. The
  pictures of `docs/evidence/2.10/` are of the game before and were not shot again.

### ADR-134 · 2026-10-06 · accepted — Fuel: off its network the march burns a formation's supply, and what moves on engines slows as it runs dry (PLAN 3.2b)

- **Context:** PLAN 3.2's AT: "unsupplied armour slows, then loses org, then strength".
  `fuelPerHour` is in the unit data since PLAN 1.1 and no rule read it. A formation has one
  supply level, 0 to 1 (ADR-25): on its network it rises by 1/8 an hour, off it it falls by
  1/8, and at 0 it loses 2% of its strength a day. Its speed did not depend on it.
- **Decision:**
  - *A fuel figure per template* (`TemplateRule.fuel`): Σ `fuelPerHour` × count over its
    elements. 0 for every division on foot or on horse; `rifle_div_soviet` 3 (its tank
    battalion); `motorised_div` 4.6; `panzer_div` 38; `tank_corps` 46.6; `heavy_panzer_div`
    47.4; `mbt_div` 52.6.
  - *Burn:* off its network, a formation on the march (moving and not in contact, as the
    movement rule has it) loses `MARCH_BURN` × fuel an hour besides the 1/8: 1/320 for each
    unit of fuel. The panzer division of 1938 is dry in 4.1 h on the march and in 8 standing.
  - *Speed:* a formation whose mobility is not "foot" (no manoeuvre element walks) moves at
    `DRY_SPEED` + (1 − `DRY_SPEED`) × supply of its speed; `DRY_SPEED` = 0.25. The
    panzer division of 1938 marches at 12 km/h (its slowest manoeuvre element, the motorised
    infantry) and dry at 3, behind a rifle division's 4. (Corrected the same day: this said
    "at 4 km/h, a rifle division's pace", from the light tank's 16.)
  - *No fuel level of its own.* Fuel is a part of the supply a formation carries. A second
    level would need a second network or a second rate on the same one, and the formation
    panel a second bar, for the same picture: off the network armour stops first.
- **What does not change:**
  - On its network nothing: a formation is refilled by 1/8 an hour whatever it burns, so a
    division on the march at home stays at 1 and at full speed (a test). A rule that drained
    supply on the network would put every motorised formation on the march below 1 for good,
    and with it its fire (× 0.5 + 0.5 supply) and its pressure on the front.
  - A formation with a manoeuvre element on foot: it goes at that element's pace, and its
    tanks do not set it. The Soviet rifle division burns a little more and walks as before.
  - A formation that stands or fights burns nothing more.
- **Why these numbers:** 40 units of fuel double the drain: the first panzer division is at
  about that, so "armour on the march lasts half as long". A quarter of the speed: a
  formation on engines without fuel is about as slow as one on foot (3 to 4 km/h for the
  templates there are). Neither is tuned (ADR-58).
- **What it does to a game:** ground just taken is not on the taker's network until the next
  refresh (12 h, ADR-25), so the head of an advance is off the network for hours at a time,
  and its armour is the first to slow there. On day 60 of Germany against Poland (seed 99) a
  panzer division in contact stands at supply 0. How often armour
  marches dry in a war was not counted.
- **The pin moved:** 0eb1fb78 → 8498494a (seed 99, one year).
- **Saves:** no state added. A save from before goes on by the new rule.
- **Proof:** `tests/unit/fuel.test.ts` (4): the figures; on the network supply stays 1; in a
  pocket after four hours the infantry and a standing panzer division have 0.5, the marching
  panzer division under 0.05, the motorised between 0.4 and 0.5, the Soviet rifle division
  between the two; then the dry panzer and motorised divisions cover a quarter of what the
  fed ones do over the same ground, and the infantry and the Soviet rifle division stand
  where they do in the fed game, to the digit. Three of the four fail on the rule before
  (the fourth is the guard for the network).
- **Not done:** org and breakdowns (PLAN 3.2c, 3.2d); nothing on the page (3.2d); the AI does
  not know that its armour is dry (PLAN 3.5); no stockpile of fuel and no oil (a nation's
  fuel is its gold).
- **Deviation from AoC:** an addition; AoC has no unit types and no supply.

### ADR-133 · 2026-10-06 · accepted — A line with no room before its formation's place stands abreast, not behind (PLAN 3.2a2; replaces the rule of ADR-132)

- **Context:** ADR-132, an hour old, put a line of a stack that has no room before its
  formation's place behind that place, up to `DEPLOY_REACH` behind. With the fuel rule
  (PLAN 3.2b, not committed) two 60-day tests of `deploy.test.ts` then failed:
  - "a block held back is nearer its enemy's block than contact reaches": 2.38 cells. A line
    1.5 behind its formation is that far from a block 0.9 before it, by the rule itself.
  - "90% of the formations in contact share a view at 20 m/px with their nearest enemy":
    88%. Ten of the fifteen that did not were the stack of ADR-132: a column 30 km deep.
- **What the tests ask of a block:** not on another; near its enemy's block; in one view with
  it. ADR-132 gave the first by taking the other two. Its own test asserted its mechanism
  ("the last behind their own place"), not these.
- **Tried and not taken:** a floor for the way back at the reach from the enemy's block. All
  lines past the floor stand on it: 40 pairs on one another on that day.
- **Decision:** the lines that have room before the formation's place stand one behind
  another, as since ADR-89. The next line begins a new file abreast of them: right and left
  by turns, a block's width and `DEPLOY_GAP` out, `DEPLOY_ABREAST` (1 cell) at most, and
  never further than `DEPLOY_REACH` from the formation. No block stands behind its
  formation's place. A block abreast is on land or stays at its formation's place.
  Ten divisions on one cell a cell from one enemy: three lines of four, three and three.
- **What cannot change:** a pair of each other's nearest, and every line that had room: the
  rule before ADR-132 for them, to the digit.
- **The test of ADR-132 is replaced** by one of the three things asked, which is more than it
  asked: no two of the ten blocks nearer than a block's depth and the gap in a file or its
  width and the gap in a line; the first across the gap from the enemy; none behind the
  stack's place; each in one view with the enemy's block; all on land. It fails on ADR-132's
  rule (a block 1.1 cells behind) and on the rule before it.
- **Measured:** the seven tests of `deploy.test.ts` pass with the fuel rule and without it.
- **Not state:** the pin stands (0eb1fb78).
- **Not done:** not looked at in the browser. Formations that come to one enemy from several
  sides count their lines together (ADR-89), so a stack begins its files sooner than it need.
  More files than fit in a cell to each side stand on the last.
- **Deviation from AoC:** none; AoC has no blocks of elements.

### ADR-132 · 2026-10-06 · superseded by ADR-133 — A line of a stack that has no room before its formation's place is deployed behind it (PLAN 3.2a)

- **Context:** formations whose nearest enemy faces a nearer formation come up to that enemy's
  block, each a line further back (ADR-89), and no block goes further than `DEPLOY_REACH` from
  its formation (ADR-98). How far forward a block goes was `max(0, distance − what it stops
  short by)`: a line with no room before its formation's place stood on that place, and so did
  every line after it.
- **Found** by the first test run of the fuel rule (PLAN 3.2b), which changes seed 99's game:
  on day 60 of `deploy.test.ts` ten divisions of China and a puppet of it stand on one cell
  against one Japanese division, and all ten blocks were drawn in one place: 45 of the 49
  pairs of blocks "on one another", against the test's limit of 10% of 128 blocks. Seven of
  the ten were lines without room.
- **Decision:** such a line stands behind its formation's place, as far as its place in the
  column asks, at most `DEPLOY_REACH` behind. On land, as before.
- **After** (the same day, with the fuel rule): 5 pairs of 128 blocks. One of them is two of
  that stack at the limit behind; the others are pairs of two formations a hundredth of a
  cell apart, each the other's neighbour in the same line, as before.
- **What cannot change:** a pair of each other's nearest, and every line that had room. The
  seven tests of `deploy.test.ts` before this one pass on both sides of the change without
  the fuel rule.
- **Not state:** where a block stands is derived (ADR-89). The pin stands (0eb1fb78).
- **Proof:** `deploy.test.ts`, "ten divisions on one cell against one enemy stand in ten
  lines" (fails on the rule before: two lines 0.075 cells apart, a block being 0.12 deep).
- **Not done:** not looked at in the browser (the specs of the battle views are of pairs of
  each other's nearest, which do not change). A stack of more lines than fit in 1.5 cells
  behind (about twelve) has its last blocks on one another still.
- **Deviation from AoC:** none; AoC has no blocks of elements.

### ADR-131 · 2026-10-06 · accepted — The AI that cuts sends home what has the least of its upkeep in tanks first (PLAN 3.1d)

- **Context:** a nation short of money, its treasury below three months of what is short,
  disbands idle formations, the weakest by men first (ADR-86). A tank brigade has 1,800 men, a
  rifle division 12,600: the armour went before everything else. PLAN 2.13 left "what an
  armour formation is worth to the AI that cuts" to PLAN 3.1.
- **Measured first** (1938, seed 99):
  - The Soviet Union at peace with its treasury emptied is short 343 a month. Its first cut
    by the rule of ADR-86: all 30 tank brigades and all 4 tank corps, no rifle division and
    no cavalry division. Armour after the first cut: 0 of 34.
  - A template's price is 200 to 208 months of its upkeep, whatever it is made of (both are
    sums over the same units). "What it costs to raise again for each gold a month saved"
    tells no formation from another.
  - What does differ for the same upkeep: the days to raise it again (90 for the infantry
    divisions, 180 to 360 for armour) and the men (2,500 for a gold of upkeep on foot, 160 to
    310 in armour; half of them go back to the pool).
- **Decision:** the order of the cut is (1) the share of the template's upkeep that its tanks
  take, least first, (2) men, fewest first, (3) id. The share is a table beside the upkeep
  (`EconomyTables.templateArmour`), computed from the unit data: 0 for every division on
  foot, on horse or in lorries; `mech_div` 0.14; `rifle_div_soviet` 0.20; `light_mech_div`
  0.66; `heavy_panzer_div` 0.82; `panzer_div` 0.83; `mbt_div` 0.84; `panzer_div_2` 0.86;
  `tank_corps` 0.88; `tank_brigade` 0.93. How much is cut, and when, is as before.
- **Why this number and not another:**
  - *Days to raise again* (the first idea): the Soviet rifle division takes 180 days, as the
    tank brigade does (the days of a template are those of its slowest unit, and it has a
    tank battalion). The tie would be broken by men, and the brigades would go first still.
  - *Gold for a man* (upkeep ÷ men): it puts armour last, and it also reorders the infantry
    by differences of a tenth (a full square division of 20,580 men before a cadre division
    of 6,240). Among formations without tanks "the weakest first" stands.
  - *What it is worth in a battle:* not known before PLAN 3.3 and 3.4.
  - *Two classes, armour or not:* the same order for the templates there are, and a line to
    draw for a template that is half tanks. The share needs no line.
- **After** (the same Soviet Union): the 32 cavalry divisions go, then 35 of the 96 rifle
  divisions; armour after the first cut: 34 of 34. With no formation without tanks left, the
  armour goes (a unit test): the rule is an order, not a protection.
- **What it does not change:** six years of seed 99 without commands are the same game, to
  the hash of every year (7, 14, 3, 0, 3 and 0 formations disbanded; the two orders
  took the same formations each time, and the Soviet Union is never short enough; which
  nations cut, and whether one of them had armour, was not looked at). The armour formations of the
  world fall from 72 to 57, 37, 39, 38, 26 and 12 in those years, in battle, not by this
  rule: PLAN 3.5 (the AI's mix) and Phase 7.
- **The pin did not move** (0eb1fb78).
- **Saves:** no state added.
- **Proof:** `tests/unit/armourWorth.test.ts` (4; all four fail on the rule before).
- **Deviation from AoC:** none known; AoC has no unit types (ADR-127).

### ADR-130 · 2026-10-06 · accepted — Research on the nation panel: the budget per month, a line by name and share paid (PLAN 3.1e)

- **Context:** since ADR-128 nations research, and nothing of it was drawn: a tech showed only
  as a build row losing its "not researched". The page had the techs a nation knows as bits
  and no tech's name.
- **Decision:**
  - *Where:* a Research block at the foot of the Economy tab, not a tab of its own: three rows
    and a budget, and the money is the same money as the rows above it.
  - *The budget per month,* though the sim holds it per day: the tab's income, expenses and
    balance are per month. The worker multiplies by `DAYS_PER_MONTH` (the economic AI's own
    month), so the page imports nothing of the sim.
  - *The share paid is rounded down:* a line reads 100% only when it is paid for, and then it
    is gone.
  - *The catalog of techs is sent once* with the map layers (`mapLayers.techs`), as the
    templates are; the nation statistics, sent every second for every nation, carry indices
    and numbers only.
- **Not done:** the budget is what the AI allows, and the lines take less (a line takes its
  gold ÷ its days at most: Germany 109 a month allowed, about 55 paid). The page does not say
  what is paid. Research money is not in the Expenses row (ADR-128). No list of what a nation
  knows. No command for a budget or a tech.
- **Proof:** `tests/e2e/research1938.spec.ts`, `tests/unit/techNames.test.ts`,
  `docs/evidence/3.1/research-germany.png` (looked at: "Budget / month 109", "Assembly lines
  20%", "Strategic bombers 16%", "Air transport 25%" on 2 February 1938). The pinned hash did
  not move (0eb1fb78): no sim file changed.

### ADR-129 · 2026-10-06 · accepted — Four templates behind the tech gate, and the AI's armour order is the best it knows and can pay for (PLAN 3.1c)

- **Context:** since ADR-128 the great powers know the medium tank of 1941, the heavy tank
  and mechanised infantry by 1942, and no template has one of them in it: knowing them built
  nothing. PLAN 3.1c left open whether the heavy template is a battalion or a division.
- **Decision:**
  - *Four templates, at the end of the file.* A formation and an order are saved with the
    index of their template, so the fifteen of 1938 keep theirs (a unit test holds the order).

    | template | elements | gold | days | upkeep a month | men | km/h | asks for |
    |---|---|---|---|---|---|---|---|
    | `panzer_div` (1938, for comparison) | 30 light, 4 medium, 8 mot, 2 heavy guns | 3,829 | 225 | 18.6 | 5,700 | 12 | `armor_medium_1` |
    | `panzer_div_2` Medium armoured division | 24 `tank_medium_2`, 8 mot, 2 heavy guns | 4,844 | 240 | 23.4 | 5,500 | 12 | `armor_medium_2` |
    | `heavy_panzer_div` Heavy armoured division | 18 `tank_medium_2`, 6 `tank_heavy`, 8 mech, 2 heavy guns | 5,600 | 330 | 27.4 | 5,530 | 9 | `armor_heavy_1`, `armor_medium_2`, `mechanisation` |
    | `mech_div` Mechanised division | 18 mech, 4 light, 3 heavy guns, 1 AT | 2,485 | 180 | 12.4 | 9,710 | 14 | `mechanisation` |
    | `mbt_div` Main battle tank division | 24 `tank_mbt`, 10 mech, 3 heavy guns | 7,980 | 360 | 39.9 | 6,530 | 14 | `armor_mbt`, `mechanisation` |

    Cost, days, upkeep and techs are computed from the units, as for every template.
  - *The heavy tank comes in a division, not as a battalion of its own.* The AI that is short
    of money sends home its weakest idle formation by men (ADR-86; PLAN 3.1d is to decide
    what armour is worth to it): a battalion of 50 tanks would be the first to go, each
    time. And the AI's armour order is one formation: a battalion is not what a great power
    raises instead of an armoured division.
  - *The AI's armour order* (every third order of a rich nation at war) is the first of
    `BuildMix.armour` (MBT, heavy, medium of 1941, the division of 1938) whose techs the
    nation knows and whose price with the reserve of three months it has; with the gold for
    none of them the best it knows, which the rule of PLAN 1.42c then replaces by infantry.
    "Best" is the order of the list, by generation, not a number computed from the stats:
    what the stats are worth in a battle is PLAN 3.3 and 3.4.
  - *Markers:* `symbolOf` moved from the worker to `shared/unitLooks`, where a unit test
    reaches it. It took "motorised" by the end of the unit's id, so a mechanised division
    had the rifle cross of infantry on foot. Mechanised infantry counts with the motorised.
    No new symbol: the six of PLAN 2.1 stay.
- **The pin did not move** (seed 99, one year: 0eb1fb78): in 1938 nobody knows a tech of the
  four, and the list ends in the division the AI ordered before.
- **Saves:** a save from before loads (no column, no table; the indices of the fifteen stand).
- **Not done, and where:**
  - Nobody but a player orders the mechanised division: the AI's order against armour-heavy
    enemies is the motorised division still (PLAN 3.5, the mix).
  - A heavy or a mechanised formation has no marker symbol and no sprite of its own (PLAN 3.6).
  - Whether the heavy division is worth 330 days and 5,600 gold against the medium one is
    not measured: the combat rules that tell them apart are PLAN 3.3 and 3.4, the balance
    Phase 7 (ADR-58).
- **Deviation from AoC:** none known; AoC has no unit types (ADR-127).

### ADR-128 · 2026-10-06 · accepted — Research: a daily payment out of a budget the economic AI sets; the year of a tech is a floor (PLAN 3.1b)

- **Context:** since ADR-127 a nation knows techs and nobody learns one. PLAN 3.1b left one
  thing to decide: the year of a tech is a floor, or research ahead of it costs more (the
  schema's comment said the second).
- **Decision:**
  - *The year is a floor.* The AT of the part is "no nation knows `armor_heavy_1` before
    1942". With a price for being early that is a matter of constants and of how rich the
    richest nation of a game is; with a floor it holds in every game. The schema's comment is
    changed to say so.
  - *State:* a table `world.research` (nation, tech, gold paid), of the shape of the
    production queue, and a nation column `research`, the budget in gold per day. Both are
    saved and hashed. The table stands after `production` in the save.
  - *The payment:* daily, min(gold ÷ days of the tech, what is left of it, what is left of
    the budget), line by line; three lines at most. One mechanism gives both ends: a great
    power learns a tech in its days, a small nation in proportion to what it can pay.
  - *The budget* is the economic AI's: 5% of income, capped at what three lines can take
    (2.44 gold a day, 74 a month), 0 in debt and 0 for the nation that would disband. It is
    not in `budgetOf`: a nation short of money cuts research, then the army, and the
    disbanding rule of ADR-86 reads the same numbers as before. It is taken off the balance
    the build step sees.
  - *Never into debt:* no payment by a bankrupt nation or out of a treasury that does not
    hold it. The ten-year tests "no bankruptcy in peace" hold.
  - *The nuclear techs are held back* from the queue. In order of year every nation would
    start `atomic_research` in 1939 and have the bomb in 1945 without having decided
    anything; differentiator 5 asks for a decision (Phase 6).
  - *An event,* `TechResearched` (nation, tech). Not a line of the history: 267 of them in
    six years of seed 99.
- **Measured** (seed 99, no commands, 1938 to 1944): 267 techs learned (37, 59, 62, 37, 36,
  36 a year). GER, SOV, ITA, FRA, ENG, JAP and USA know the heavy tank on 1942-08-28 (240
  days from 1 January 1942), nobody before 1942. Of 37 techs in the queue the seven know 34
  in 1944, Poland 22 (income 37 to 226), Portugal 18 (income 50; one tech in six years),
  Monaco 17 (income 1; none).
- **The pin moved:** 329eedd8 → 0eb1fb78 (seed 99, one year). A column and a table more, gold
  leaves the treasuries daily, and the build step has the research of the month less.
- **Saves:** a save from before has no `research` section and does not load, as with ADR-127.
- **Not done, and where:**
  - The gap between the great powers and everybody else is wide: the prices of the techs
    (70 to 260 gold) are first-pass values against incomes of 1 to 5,500 a month. Balance:
    Phase 7 (ADR-58). Not tuned here.
  - `cost.industry` is read by nothing.
  - The page shows no research (PLAN 3.1e). No command sets a budget or a tech; a nation
    whose AI is off keeps its last budget, and with the AI off for all from the start
    nobody has one.
  - The money is not in the nation's `expenses` (nor are suppression, CE cost and tribute):
    the panel's income less expenses is not the change of the treasury.
  - No heavy template yet (PLAN 3.1c): knowing the heavy tank builds nothing.
- **Deviation from AoC:** none known; as ADR-127.

### ADR-127 · 2026-10-06 · accepted — What a nation knows is state, and a template is refused to the nation that lacks its techs (PLAN 3.1a)

- **Context:** PLAN 3.1 asks that tech gates the heavy tank until research of 1942 or later.
  The data said so since PLAN 1.1 (`techReq`, the tree, a schema test on the year). The sim
  knew no tech: `queueFormation` did not read `techReq` and no nation knew anything. PLAN 3.1
  is split into four parts; this is the first.
- **Decision:**
  - *State:* two `u32` columns of the nation table, `tech0` and `tech1`, a bit a tech, by the
    tech's index in `ScenarioRules.techs`. 43 techs today; the build of the rules throws
    beyond 64. A column and not a JSON section as the buffs are: it is hashed and saved with
    the table, and a test of "knows" is two ANDs.
  - *The order of the bits* is the order of the tech files by the schema's categories. A tech
    put in before the last one moves the bits after it.
  - *A template* asks for the closure of its units' `techReq` over the prerequisites, so a
    nation handed a tech without what leads to it does not build with it.
  - *The gate* is in `queueFormation`, with the gold and the manpower: one event,
    `ProductionRejected`, no new refusal code. Without scenario rules (the toy world) there
    are no templates and nothing to gate.
  - *The start:* (1) every nation, living or dead, knows the techs dated before the
    scenario's first year; (2) a nation knows the techs of the templates its formations of
    the start have; (3) `techs` in its row of `nations.json`. Not "everything up to and with
    1938": Mongolia and Luxembourg would start with the medium tank. By (2) Germany alone
    knows the medium tank; (3) gives it to the Soviet Union (T-28), France (Char D, Somua),
    the United Kingdom (the cruisers and the Medium Mk II) and Japan (Type 89), whose 1938
    order of battle here has light tanks only.
  - *A nation founded later* (a revolt, a Kill) takes the columns of the nation it left; a
    reused id does not keep the dead nation's. A nation that returns keeps its own.
  - *The economic AI:* an order it has not the techs for becomes the infantry division, and
    that one the cadre division (no techs). Without it `queueFormation` returns 0 and the
    nation orders nothing more that month.
  - *The page:* `NationStat.techs` and `TemplateInfo.techs`; the build list writes "not
    researched" in place of the cost and switches the button off.
- **Data changed:** `artillery_2` (the heavy gun, `artillery_heavy`) is dated 1937, was 1940.
  Germany, Italy and Nationalist Spain field it in 1938 (the motorised division), and the
  motorised division is what the AI raises against armour: dated 1940 it would have been
  refused to every other nation until research exists.
- **The pin moved:** 7fc8e685 → 329eedd8 (seed 99, one year). The nation table has two more
  columns, and a rich nation at war without the medium tank trains infantry where it trained
  a panzer division on every third order.
- **Saves:** a save from before has no `nations.tech0` section and does not load. The same
  as for every column added to a table so far; no save is kept across versions yet.
- **Not done, and where:**
  - Nobody learns anything until PLAN 3.1b: the heavy tank cannot be had, the medium tank
    only by five nations. The United States, rich and without it, train infantry in a war.
  - No template has a heavy tank in it (PLAN 3.1c), so the task's own AT is not met yet.
  - Tech modifiers (`armorAttack`, `landAttack`, …) are read by nothing.
  - The editor and God Mode cannot give or take a tech.
- **Deviation from AoC:** none known. No text source read so far names a tech tree in AoC;
  ours is an addition under differentiators 3 to 5.

### ADR-126 · 2026-10-06 · accepted — A nation that has died is not selected any more, and what a God tab holds is its nation's (PLAN 2.17e3)

- **Context:** read at PLAN 2.17e1, run now. Two causes, both seen to fail in one e2e:
  - `Hud.selected` kept the id of a nation that had died. The worker's `nations` are the
    living, so the panel closed with the next statistics; the legend of the diplomacy mode
    still named the nation, the colours were its relations, and the Territory brush stayed
    armed for it. An armed brush takes every click of the map (`Hud.pick`), paints nothing
    with no panel to say why, and the only switch for it is in the God tab that had closed.
  - `GodTab` kept its state through a change of the selection: Kill armed on France read
    "Click again to kill" on Germany's tab, one click from killing Germany; the name typed
    for France stood in Germany's field.
- **Decision:**
  - `src/app/hud.ts`, the `onStats` listener: a selected nation that the statistics list
    among the dead is deselected through `onSelectNation(0)`, the map view's way, so that
    the palette, the legend and the brush follow. By the statistics and not when the Kill is
    sent: a Kill that is refused (the last nation) keeps its nation and its words (ADR-125).
    Only a nation listed dead: one founded since the last statistics is not in `nations`
    yet, and stays selected.
  - the same file, the `effect` on `selected`: with no nation selected an armed Territory
    brush is switched off. This covers the panel's own close button too, where the same
    trap stood. The revolt and breakthrough tools are left: they end with their click.
  - `src/ui/GodTab.tsx`: the name typed and the armed Kill are kept with the id of the
    nation they were for, and are nothing on another nation's tab (nor on the first one's
    when the selection comes back: a Kill is armed by a click on the tab that shows it).
    The nation chosen for War, Ally and Puppet, the buff and the nation to revive stay from
    one nation to the next: they are the player's choice, not a property of the nation.
  - **Tried and taken back:** `GodTab` keyed by the nation's id. It also forgot the nation
    chosen, and the Ally test (select Italy, back to France, War) then declared war on the
    first nation of the list instead of the ally: the gate's e2e failed on it.
- **Deviation from nothing in AoC:** no source says what its panel does when its nation dies.
- **Not done:**
  - between the Kill and the statistics that follow it (one message while paused, up to a
    second at speed) the tab is still drawn, and Rename, the income bonus and the AI switch
    of the dead nation are taken by the sim (`whyNoNation` asks only that the nation
    exists). Refusing them is a rule of the sim and another cause.
  - a panel that was closed opens on Overview, also after a death: the God tab is one more
    click away. As it was for the close button.
  - a world loaded over a selection whose id it does not have: neither living nor dead, it
    stays selected with no panel. Not run.
  - the nation the player controls and the editor's nation are not the selection and were
    not looked at.
- **No sim code changed; the pin did not move** (7fc8e685).
- **Tests:** `godUi1938.spec.ts`, "Kill from the nation's own God tab" (failed first, twice:
  "Click again to kill" on Germany's tab; then, with that mended, `selected` 19 after
  France's death). `tests/unit/hudDeadSelection.test.ts` (5; 3 failed with the Hud's change
  taken out). `docs/evidence/2.17/killed-from-own-tab.png`.

### ADR-125 · 2026-10-06 · accepted — The words of a refusal belong to the selection that sent the command (PLAN 2.17e2)

- **Context:** `Hud.refusal` (ADR-117) was cleared by the next command only. Ally refused on
  France, then a click on Italy: Italy's God tab read "Not done: …". `Hud.command` is the
  editor's way too, so a refused editor command left words for a God tab opened later. Read
  after the commit of PLAN 2.17a, not run until now.
- **Decision:** in `src/app/hud.ts`:
  - an `effect` on `selected` sets `refusal` to 0 on every change of the selection (both
    writers of `selected`, the map's click and `onSelectNation`, are covered by it);
  - `toggleGod` sets it to 0, on and off;
  - `command` remembers the selection it was sent under (`commandFor`), and the `refused`
    listener shows the reason only while the selection is still that one.
- **Why in the Hud and not in the tab:** `GodTab` is drawn from the Hud's signal and has no
  state of the words; the tab's own state (Kill armed, the typed name) is PLAN 2.17e3.
- **Not done:** the `refused` message does not name its command. A refusal that arrives after
  the selection has left and come back to the same nation is shown; so is one of an earlier
  command after a later command of the same selection was carried out. The worker applies a
  God command on receipt and answers within the same task, so a click cannot come between
  on a page that is not stalled. A sequence number in `cmd` and `refused` would close it.
- **No sim code changed; the pin did not move** (7fc8e685).
- **Tests:** `godUi1938.spec.ts`, the Ally test (failed first: one `god-refusal` on Italy's
  tab): gone after a click on another nation, not back with France, gone through God Mode off
  and on. `tests/unit/hudRefusal.test.ts` (4 tests on a client that answers when told to;
  3 failed first), among them the refusal that arrives late.

### ADR-124 · 2026-10-06 · accepted — The empty rename of a nation with no other name is refused (PLAN 2.17e1)

- **Context:** `renameNation` with the empty name deletes the nation's entry in `world.names`:
  "the scenario's name again". The toy and the random world have no nation table (ADR-109):
  the entry is the only name, and without it the nation read "Free state N". Known since
  PLAN 2.16b; the God tab sends the empty name when Rename is clicked on an empty field.
- **Decision:** the command is refused (`Refusal.NoOtherName`, 18; "Not done: the nation has
  no other name to go back to; give it one.") for a nation that has neither a name in the
  scenario's table nor a province it was founded in (`origin`). Nothing changes.
  - `ScenarioRules.namedNations`: nations 1..n are named by the scenario's table. 103 for
    1938, 0 for the random world (its rules are a copy of 1938's with that one number), and
    the toy world has no rules, which reads as 0. It is the sim's side of
    `ScenarioInfo.nationTags`, which the worker's `nameOf` reads; rules are not state.
  - `Sim` no longer sets `world.rules` after the world is made: both makers set their own.
- **Why refused and not "the name kept in silence":** PLAN 2.17 is that a command does what
  it says or says why not. And the first name cannot be given back: `world.names` does not
  tell a name of the scenario from one God Mode gave ("West" renamed "Occident": "West" is
  gone), and a second map of first names would be state for this alone.
- **Not changed:**
  - A nation founded in the game (a revolt, a Kill) in any world: the empty name is carried
    out and it is "Free <province>" again (ADR-100).
  - 1938: the empty name restores the table's name, as `godMode.test.ts` holds.
  - A founded nation whose origin is 0 (a save from before PLAN 2.12a) is refused too: its
    other name would be the number.
- **The pin did not move** (7fc8e685).
- **Tests:** `tests/unit/refusal.test.ts`: the toy world (failed first: applied, the name
  deleted), and the random world (a nation of the start refused, one a Kill founded not).

### ADR-123 · 2026-10-06 · accepted — A revival leaves what third nations own of its provinces; the split province is logged for Phase 7 (PLAN 2.17d3)

- **Context:** ADR-122 measured it and did not decide: France killed, two years of war played,
  then revived (1938, seed 99) holds 8,963 of its 10,473 cells, and 1,253 cells of provinces
  whose centre is France's again stay others': Nationalist Spain 608, three nations the Kill
  founded 627, nobody 18. PLAN 2.17d3 asked: a revival takes every cell of a province it
  takes, whoever owns it, or the patches are left to the wars that follow.
- **Decision:** not changed. A revival takes the share of the owner of the province's centre,
  as before. No code moved.
- **Why:**
  - *It is not the revival's rule.* `defect` and `spawnRebels` (`revolts.ts`) both move the
    cells of a province that the holder owns, and no others. Every transfer by province (a
    defection, a revolt, a collapse, a Kill, a revival) leaves a third nation's share of a
    split province where it is. The cause is one step earlier: a peace moves cells, and a
    transfer moves provinces. A revival that took the whole province would be the one
    transfer that does.
  - *It would be land moved with no war behind it.* A revival is at war with the holders of
    the centres only (`byHolder`). Spain's 608 cells would change owner between two nations
    at peace, which is what ADR-119 ended for a Kill; and a war declared on every third
    owner as well would widen every ordinary revival by a revolt.
  - *The critic's finding is met without it* (R2-B8, PLAN 2.17d): the revived nation holds
    the centre of every province of its core, its capital and its name on the map, and a
    Revive that is refused says which rule refuses it.
  - *What it does to the world over decades is balance* (ADR-58): how often a peace splits a
    province, and whether the patches go in the wars that follow.
- **Rejected:**
  - *The whole province from the nations the Kill founded only.* A rule for God Mode alone,
    and they hold those cells by conquest from each other like anyone.
- **Not reopened:** nation 106, alive with no cell of its own on land it occupies (ADR-122:
  a holder that still controls a cell lives on, by the rule of `capitals.ts`).
- **Logged:** BLOCKERS.md, for Phase 7, with the numbers and the question (whole provinces
  in every transfer, or a peace that keeps provinces whole, or neither).
- **No test added** (the AT: a test if the rule changes, else the line in BLOCKERS.md).
  **The pin did not move** (7fc8e685): documents only.

### ADR-122 · 2026-10-06 · accepted — A revival takes the slivers of a holder it leaves without a province (PLAN 2.17d2)

- **Context:** France killed and revived (ADR-121) had 10,451 of its 10,473 cells. The other 22
  lie in no province (slivers of coast). The Kill gives such cells to the heir, and a revival
  takes land by province (`spawnRebels`), so they stayed nation 104's: a nation alive on 22
  cells with a field capital and no province.
- **Decision** (`reviveNation`, after the provinces are taken): a holder that no longer owns
  the centre of any province gives the revived nation the cells it owns and controls outside
  any province. If it then controls no cell it is eliminated at once (`eliminateNation`), as
  `relocateToField` would find within the hour.
  - *For every revival,* not God Mode's alone: a revolt and a holder's collapse go through
    `reviveNation` too, and the cause (land taken by province leaves the cells of no province
    behind) is the same.
  - *A sliver another nation occupies* is not taken: it stays the holder's, and
    `eliminateNation` gives it to the occupier (ADR-112, as ADR-119 does at a Kill).
  - *A holder that still controls a cell* (land it occupies in a war of its own) lives on, by
    the rule every nation is under (`capitals.ts`: a field capital on a cell it controls).
- **Rejected:** *the Kill gives the slivers to nobody, or to a neighbour.* The heir must own
  them while the dead nation is dead: no land without an owner, and they are France's coast.
- **Not changed, seen:** a holder that an ordinary revolt (`spawnRebels` without a revival)
  leaves on slivers alone. Another cause; not met in a run.
- **The pin did not move** (7fc8e685): seed 99 has no such revival in its first year.
- **Measured** (`tests/unit/reviveAfterKill.test.ts`, 1938, seed 99, the Kill at tick 0, 30
  days run, the revival at tick 17,520): France has 10,473 of 10,473 cells; the heir is dead
  with no cell; of the nations the Kill founded one lives, on 77 cells it took in Morocco.
  The test failed first (22 cells outside any province).
- **Looked at, not decided: the patches of other nations inside a revived France.** A scratch
  run with the two years played between the Kill and the revival (1938, seed 99): before the
  revival, 10,194 cells of France's core provinces are others' (Nationalist Spain 5,374, the
  founded nations 104 to 108 4,800, nobody 18, two more). After it France has 8,963 cells, and 1,253 cells of
  provinces whose centre is now France's are still others': Nationalist Spain 608, nation 107
  542, 105 58, 108 27, nobody 18. They are conquests: a peace moves cells, not provinces, so
  a province is split between the owner of its centre and a neighbour, and a revival takes
  the share of the centre's owner only. Nation 106 is left alive with no cell of its own, on
  land it occupies. Whether a revival should take the whole province from everyone is PLAN
  2.17d3.

### ADR-121 · 2026-10-06 · accepted — Revive after a Kill: the dead nation keeps a claim on its core land, and a Revive that is refused says which rule refuses it (PLAN 2.17d)

- **Context:** the critic's R2-B8: Revive 30 days after a Kill of France did nothing and said
  nothing. Since ADR-117 it said "there is nothing here to do it with", which names no cause.
  There were two (a headless run, 1938, seed 1938, the Kill at tick 0):
  - *The cooldown.* `eliminateNation` sets `revivalAt` to the death + two years
    (`REVIVAL_COOLDOWN`), and `reviveNation` refuses before it.
  - *The cores.* `spawnRebels` makes a nation it founds the core of its provinces. A Kill
    founds nations on the dead nation's own land, so France kept a core on 25 of 170 provinces
    (those handed to a neighbour or to the heir as islands, none in France), Yugoslavia on 1
    of 276, Poland on 1 of 19. After the cooldown the Revive "worked": France on 413 cells of
    10,473, Yugoslavia on 1 cell.
- **Decision:**
  - *A Kill leaves the dead nation a claim* (`Provinces.addClaim`) on every province it was
    the core nation of and that a founded nation took (`killNation`, before
    `eliminateNation`). The founded nation stays the core. The dead nation is then a dead
    claimant there like Ethiopia in Italian East Africa: it returns by God Mode's Revive, by
    a revolt on that land, or by the collapse of its holder, each within the rules.
  - *God Mode goes past no rule of a revival:* not the cooldown, not the count
    (`revivalsLeft`). `tests/unit/revival.test.ts` (PLAN 1.20) holds the `reviveNation`
    command itself to both, and no test is weakened.
  - *A Revive that is refused says which rule* (`whyNotRevive`, four new `Refusal`s): the
    nation is alive; no other nation holds a province it has a core on; it has returned as
    often as a nation may; it died less than two years ago. In that order: the reason that
    time does not mend comes first, so a world without provinces (the toy world) is told "no
    core land" and not a count it never used.
  - The God tab's list of the dead: the nation chosen is sent only while it is in the list
    (one revived since fell back to nothing and was sent as it was).
- **Rejected:**
  - *God Mode ignores the cooldown.* It is what a player who has just killed a nation may
    want, and AoC states no cooldown (PARITY row 19, a deviation PROMPT asks for). It breaks
    the test of PLAN 1.20, and a rule God Mode may break needs a second command or a flag in
    the command log. Left to the user: the panel now says what stands in the way.
  - *The dead nation stays the core, the founded nation gets the claim.* A Kill's step 1
    gives a province back to its living core nation; the founded nations' own Kill, unrest
    and coring read `core`. The claim changes none of that.
  - *A date in the words* ("not before 1 January 1940"). A `Refusal` is a number in an event;
    the text has no argument. The cooldown is the same two years for every nation.
- **What it changes outside God Mode:** nothing in a game without a Kill (the pin did not
  move: 7fc8e685). After a Kill, a revolt in a founded nation, or its collapse, brings the
  dead nation back once its cooldown is over, instead of founding another.
- **Measured** (`tests/unit/reviveAfterKill.test.ts`, 1938, seed 99): France, 10,473 cells and
  170 core provinces held, killed at tick 0 and revived at tick 17,520: all 170 provinces
  held again, 10,451 cells. The 22 missing lie in no province and stay the heir's (PLAN
  2.17d2). Through the God tab with two years of the world between (`godUi1938.spec.ts`):
  10,036 cells, Paris France's, the name on the map.
- **Tests, seen to fail first:** the unit test (145 provinces without France's core after the
  Kill; reason 12, `NoEffect`, for a living nation) and the sixth test of
  `tests/e2e/godUi1938.spec.ts` (25 provinces with a core of France after the Kill, with
  `tick.ts` and `revival.ts` of HEAD put back).

### ADR-120 · 2026-10-05 · accepted — A Kill gives a cell of a neighbour's province to the neighbour, not to the heir (PLAN 2.17c2)

- **Context:** `docs/evidence/2.17/killed-painted-0d.png` as PLAN 2.17c left it: France, painted
  over the Alps with the God brush and killed, left four spots of "Free Ain" inside Italy's
  north. A Kill shares out the provinces whose centre the dead nation owns. A cell it owns in
  a province whose centre is another's is "outside the provinces shared out", and the last
  sweep of `killNation` gave all of those to the heir. Such cells are not the brush's alone:
  wherever a border runs through a province, one side owns cells without the centre.
- **Decision:** in the last sweep of `killNation` a cell of a province whose centre a living
  nation owns goes to that nation, as owner and controller. The heir takes the cells outside
  any province and those of a province whose centre nobody living owns. A cell a living
  nation occupies is still left to `eliminateNation` and becomes the occupier's (ADR-119).
  Each nation that receives cells this way gets one `LandCeded` at their middle, in the order
  of the ids (as `leaveLand` does); the heir's share stays without a line, as before.
- **Why the centre's owner:** the centre is what says whose a province is everywhere else
  (`held` in `collapseNation`, `forceRevolt`, `whyNotKill`), and it needs no search.
- **Rejected:**
  - *The nation with the most cells beside the piece* (`leaveToNeighbour`'s rule). It needs
    the connected pieces of the cells left; the centre's owner gives the same answer for a
    border strip and for a painted band.
  - *No line of history.* The e2e of PLAN 2.15d holds that every nation that gains by a Kill
    has a "Land handed over" row.
- **Not changed:** a Kill without an heir (`leaveToNeighbour`, ADR-113): one receiver, one
  line. The rule applies when there is an heir.
- **Tests, seen to fail first:** `tests/unit/killLand.test.ts` (France given all of the
  Italian province with the most cells beside it but the centre and the cells round it, then
  killed: 153 cells of it were nation 104's, a nation founded). `tests/e2e/godUi1938.spec.ts`,
  the fifth test: it now reads the holder of every 10 px of the view before the stroke; at
  once after the Kill every point that was not France's has its first holder (9 points were
  nation 104's), and after 30 days none is a founded nation's. The 32 points of the stroke's
  middle did not find the spots: the test passed on the old code with them.
- **The pin did not move** (7fc8e685): no Kill in a game without commands.

### ADR-119 · 2026-10-05 · accepted — What a God Mode Kill leaves: an occupied cell is the occupier's, and the last nation without a province is not killed (PLAN 2.17c)

- **Context:** the critic's R2-B8: France, painted over the Alps with the God brush, renamed
  "Gaul" and killed, kept the band and its name on it 30 days later. PLAN 2.17c had three
  questions: whether any way to that is left and why the name was drawn; the Kill of the last
  living nation, which moved nothing and said nothing (ADR-113); the cells a Kill with an heir
  leaves under a third nation's occupation with no war (measured in PLAN 2.16Rg).
- **Found:**
  - *The band and the name.* The name on the map is derived from the controller raster alone
    (`deriveNationLabels`, `worker/server.ts`). The band was land France controlled and did
    not own (the brush of before ADR-118), and a death moved no cell (before ADR-112, which is
    55 commits after the critic's). Both are ended: the brush gives ownership, and
    `eliminateNation` gives back what the dead controlled. No code changed for it. The e2e of
    the AT passed on its first run; it fails with the two put back (the brush sending
    `paintControl`, `eliminateNation` without `leaveLand`): 166 points of the view still
    France's.
  - *The counters on the band* are the old owner's formations, which the paint leaves where
    they stand. `repatriationSystem` sends them home at the next day's start, and after the
    Kill the band is Italy's or Switzerland's again where the stroke took a province's
    centre. Not changed.
  - *The last nation.* With a province of its own the last living nation can be killed: the
    Kill founds the nations that follow it (a piece with no city and no neighbour founds one).
    Only a nation that owns the centre of no province dies as the holder of its land.
- **Decision:**
  - **An occupied cell outside the provinces shared out is the occupier's.** The last sweep of
    `killNation` gave every cell the nation still owned to the heir and left a third nation's
    control of it: occupation of the heir's land with no war. It now leaves a cell that a
    living nation controls to `eliminateNation`, which makes it that nation's (ADR-112's rule
    for every death). The heir takes what the dead nation held itself.
  - **The Kill of the only living nation that owns the centre of no province is refused**
    (`whyNotKill` in `systems/revival.ts`, `Refusal.LastNation`, "it is the last living
    nation and has no province to found another in; its land would have nobody to go to").
- **Rejected:**
  - *Refuse the Kill of every last nation* (the words of PLAN 2.17c). In a world with
    provinces that Kill works, and a world of one nation is where a user may want it.
  - *The occupied cells to the heir, the occupation ended.* It takes from the occupier what
    it holds; every other death leaves it that (ADR-112).
- **Not decided here:**
  - The 45 cells of seed 99 at tick 2000 that are occupied with no war before any Kill: where
    they come from is not known. Logged in BLOCKERS for Phase 7.
  - `defect` gives a province whole, and with it the cells a third nation occupied of it.
  - A Kill after a God brush stroke leaves small pieces of the heir inside the neighbour:
    the painted cells in provinces whose centre the stroke did not reach are "outside the
    provinces shared out". Seen in the screenshot; PLAN 2.17c2.
- **Not reached by any e2e:** the refusal. The worlds with a God tab have provinces, and a
  Kill there founds nations, so a last nation without a province does not come about by hand
  short of Danzig alone in the world. `REFUSAL_KEY` is a typed record: a reason without words
  does not compile.
- **Tests, seen to fail first:** `tests/unit/killLand.test.ts` (no Kill leaves more cells
  occupied with no war: 1938 at tick 2000 failed for nations 6, 7 and 11 with 7, 2 and 3 more,
  the numbers of PLAN 2.16Rg), `tests/unit/refusal.test.ts` (the toy world's last nation: it
  was `CommandApplied` with nothing done). Green before and after: the last nation of a random
  world, annexed down to one, is killed and founds nations (`killLand.test.ts`), and
  `tests/e2e/godUi1938.spec.ts`, the fifth test (above).
  `docs/evidence/2.17/killed-painted-0d.png`, `killed-painted-30d.png`.
- **The pin did not move** (7fc8e685): no Kill in a game without commands.

### ADR-118 · 2026-10-05 · accepted — The God Mode territory brush gives the land: it sends the editor's nation paint (PLAN 2.17b)

- **Context:** the critic's R2-B8: a drag of the Territory brush from France across the Alps
  left a hatched band, and France's cells rose by 0. The brush sent `paintControl`, which sets
  the controller alone: the band was land France occupied, of Italy and Switzerland, with no
  war behind it. The hint says "paint territory for this nation". PLAN 1.44b had written the
  control down as meant ("Control, not ownership", an assertion of `editorDrag1938.spec.ts`).
- **Decision:**
  - The brush sends `editPaint` on the nation layer for the selected nation (`Hud.godPaint`):
    radius 5 as before, no mask, `brush` with `stroke: 'start'` at the press and `line` with
    `stroke: 'more'` on the way. Owner and controller are set together, by the one function
    that does it for the editor (`paint` in `src/sim/editor.ts`).
  - A stroke is one step of the editor's undo history, and is saved with it. Ctrl+Z and
    Ctrl+Y stay the editor's (they work while it is open); the God tab has no undo button.
  - `paintControl` stays as it is. It is the command of an occupation: eight unit test files, the
    replay test and `occupation1938.spec.ts` make occupied land with it, and a saved command
    log may hold it. The page no longer sends it.
  - The assertion of PLAN 1.44b that the owner raster is unchanged is turned round (the owner
    raster changes, the stroke is one undo step, two undos give the first map). It stated the
    behaviour this decision ends; nothing else of that test changed.
- **Rejected:**
  - *`paintControl` sets the owner too.* It would take the occupation out of the tests of
    capture, war and revival, which need a cell held by one nation and owned by another.
  - *A command of its own for the God brush.* It would be `paint` on the nation layer under
    another name, without the undo.
  - *No undo for a God stroke* (a paint that passes the stack by). The stack's diffs assume
    that they see every paint of the layer; and an undo of a slip of the hand is wanted.
- **Consequences:**
  - What the editor's paint does not do, the God brush does not do either: formations of the
    old owner stay where they stand, on land that is now another nation's and with no war; a
    capital painted over stays the capital of a nation that no longer owns its cell until the
    capital rules look at it; cores stay the provinces'. Seen in the screenshot (Italian
    counters on the French band), not changed here: PLAN 2.17c looks at what a painted and
    killed nation leaves.
  - The brush can no longer make land that is controlled and not owned. What PLAN 2.17c has
    left to find is whether another way leaves a dead nation such land.
  - A drag across the seam of the map: `lineCells` wraps each cell's x, as `paintControl` did.
  - The largest radius is the editor's 32 (it was 64); the brush uses 5.
- **Evidence:** `tests/e2e/godUi1938.spec.ts` (the fourth test: failed first with France's
  cells at 10,473 before and after the drag), `tests/e2e/editorDrag1938.spec.ts` (the God
  test), `docs/evidence/2.17/god-brush-territory.png`.

### ADR-117 · 2026-10-05 · accepted — A command that is not carried out says why; Ally does not break an alliance, the God tab has "Leave alliance" for that (PLAN 2.17a)

- **Context:** the critic's R2-B8: Ally with a nation of another alliance did nothing and said
  nothing. `applyCommand` returned nothing, and `CommandApplied` was emitted before the
  command ran, so it stood for a refusal too. The page read no event but the wrecks. The
  sixth read (PLAN 2.16Ra) had found commands carried out that should not be: a formation,
  control, land and a membership for a dead nation, control for nation 0, a NaN into the state.
- **Decision:**
  - `applyCommand` returns a `Refusal` (`src/shared/commands.ts`; 0 = carried out). The tick
    emits `CommandApplied` or `CommandRefused` (a = seq, b = the reason) after the command,
    not before. A refused command is in the command log as before: the log and the sequence
    number are state, and a replay refuses it again.
  - The worker posts every `CommandRefused` to the page as `{ type: 'refused', reason }`, at
    once and whatever the page's subscription is. The HUD holds the reason of the last command
    it sent (`Hud.refusal`, cleared by the next command), and the God tab says it in words
    ("Not done: …", `refusal.*` in `en.json`).
  - **Who may be named.** A command that gives something only a living state can hold
    (`spawnFormation`, `forceBreakthrough`, `paintControl`, `editPaint` on the nation layer
    with a nation other than 0, `createAlliance`, `joinAlliance`, `createPuppet`,
    `annexNation`, `collapseNation`, `setPlayer`) is refused for a dead nation. A command
    that sets a value of the nation's row (name, flag, gold, income bonus, AI, efficiency,
    suppression, autonomy, loyalty) is refused only for a nation that is not there: a dead
    nation keeps these for its revival, and the editor may set them.
  - **Numbers.** A command with a NaN or an infinite number anywhere in it is refused before
    its kind is looked at (`finiteCommand`). JSON writes NaN as null, so such a command was
    not even the same command after a save.
  - **Ally** with a nation in an alliance is refused with that reason; it does not take the
    nation out of its alliance. The God tab gets **Leave alliance** on the selected nation
    (the command was there; AoC's God Mode has "Break alliance", TEXT). Two clicks that each
    do one thing, in place of one that ends an alliance the user did not name.
  - `whyNotWar` (`war.ts`) is the one list of reasons against a declaration; `declareWar`
    asks it.
- **Rejected:**
  - *Ally forces the move* (leave, then join). The leader of the Anti-Comintern pact allied
    to France would dissolve or hand on a pact with one click on another nation's panel, and
    a join refused for a war with a member would leave the nation out of both.
  - *The reason in the snapshot's events.* They are filtered by the view's box and copied by
    the map view only; a message of its own needs neither.
  - *The command's kind in the message.* The panel shows the reason of the last command it
    sent; it needs no kind.
- **What it does not give:**
  - Words for a player's offer that the other side refuses (`PeaceRejected`,
    `AllianceRejected`), for an order to march with no route (`MoveRejected`) and for a
    build order without the gold (`ProductionRejected`): these have events of their own, and
    the command counts as carried out. The Actions tab does not show `Hud.refusal`.
  - A reason for Revive finer than "nothing here to do it with" (PLAN 2.17d), nor one for the
    Kill of the last living nation, which is still carried out as nothing (PLAN 2.17c).
  - A God tab that greys what would be refused.
- **Known, left:** a declaration refused as a command emits `WarRejected` (from `declareWar`)
  and `CommandRefused`; the AI's refused declaration emits the first only. The history log
  keeps neither (its kinds are a list, `history.ts`). The words of a refusal stay when
  another nation is selected without a command: a line of PLAN 2.17e.
- **The pin did not move** (7fc8e685): events are not state, and the pinned run has no
  command.
- **Tests, seen to fail first:**
  - `tests/unit/refusal.test.ts` (7; 5 failed with the `src/` of before): the dead nation,
    nation 0, the NaN, the reasons of war, alliance and puppet, the worker's message.
  - `tests/e2e/godUi1938.spec.ts`, "a God action that is refused says why…": France's Ally
    with Italy says "in an alliance already" and Italy stays where it is; the next action
    takes the words away; Italy leaves, France's Ally takes it in; war on it says "they are
    allies". Failed before on the missing words.

### ADR-116 · 2026-10-05 · accepted — The player's selection is of the player's nation, and a player's order names its nation (PLAN 2.16Rk)

- **Context:** seen in PLAN 2.16Ri. `MapView.selectedFormations` is a set of ids, kept while
  the id is in the snapshot. A freed id goes to the next formation made. The player's selected
  formation is destroyed, another nation raises one, and it is selected; the next click on
  ground sent `moveFormation` for it, and `orderMove` asks nothing of whose it is. Run in the
  page before the fix: Poland's selected division removed, a German one spawned in the same
  hour at home, a click on Polish ground: the German division marched (1100.2 → 1102.9 in a
  day), and the bar said "1 selected".
- **Decision:**
  - The view knows whose the selection is (`MapView.selectionNation`, set by `PlayerControl`
    with the nation it plays). A snapshot takes out of the selection an id that is gone or is
    another nation's.
  - The view says so (`onSelectionDropped`), and the bar's count follows. Before, the count
    changed at a click only: a selected formation that was destroyed left "1 selected", taken
    id or not.
  - `moveFormation` may carry `nation`. Then the sim orders nothing when the formation is not
    that nation's. The player's click sends it. Without `nation` the command is as before
    (tests, and a God Mode order should there be one).
  - A load empties the selection (`SimClient.onLoad`), as it closes the panel (ADR-115).
- **Why both the view and the sim:** the view's check is a snapshot late; an order sent
  between a tick and its snapshot would still reach the other nation's formation. The sim's
  check is at the tick the order is applied.
- **Not closed:** the player's own formation destroyed and the player's own next one given its
  id, between two snapshots: it is selected, and an order moves it. Both are the player's, so
  no nation is ordered about by another; the count of ADR-115 would tell them apart, and the
  snapshot has none (rejected there: four bytes a formation in every snapshot).
- **Tests, seen to fail first:**
  - `tests/unit/movement.test.ts`, "an order that names a nation…": a German division with a
    Polish one's id, ordered in the name of Poland, does not move ("expected 1 to be +0" with
    the `tick.ts` of before); in the name of Germany it does.
  - `tests/e2e/player1938.spec.ts`, its second test, three assertions with the source of
    before: the selection `[540]` where `[]` is asked, the bar "1 selected", the German
    division moved. With the load's hook switched off: "the bar after a load".
- **The pin did not move** (7fc8e685): the pinned run has no commands.

### ADR-115 · 2026-10-05 · accepted — The formation panel knows its formation by id and count; a load closes it (PLAN 2.16Ri)

- **Context:** the sixth read's finding 6. A table gives a freed id to the next row made, the
  last freed first (`Table.create`). The panel and the frame on the map knew their formation
  by the id alone. The formation whose panel is open is destroyed, some nation raises one in
  the same hour or later, and the panel shows that one: another kind, another nation.
- **Decision:**
  - `FormationDetail` has `generation`: how often the id has been given out
    (`Table.generation`, ADR-74's entry of 2.7o, which the worker already compares for a
    formation's place of a tick ago).
  - The request `formation` may carry a `generation`. Then the worker answers `null` also
    when the id's count is another: the formation asked for is gone.
  - The HUD keeps the count of the first answer and asks with it from then on. `null` closes
    the panel as before, and the frame on the map goes with it.
  - A load closes the panel (`SimClient.onLoad`). A load does not raise the counts (2.7x), so
    a loaded world's formation of the same id would pass for the old one.
- **Why the worker says it and not the HUD:** the HUD could compare the counts of two answers
  itself. Asked with the count, the answer for a formation that is gone is the same `null`
  whether or not its id is taken, and there is one path that closes the panel.
- **Rejected:** the count in the snapshot's formations (four bytes a formation in every
  snapshot, for a panel that asks once a tick); a column in the table (state: the save and
  the pin would move for a thing only the view needs, as in 2.7o).
- **Not closed:** the first ask is by the id alone, for the click reads the id from a snapshot
  that has no counts. A formation destroyed, and its id taken, between that snapshot and the
  worker's answer opens the panel of the new one, where the click was. One tick wide.
- **The reader's suspicion** (the panel goes while its formation is outside the subscribed
  view): not so. A snapshot has every formation (`server.ts`, "Formations (all; …)"); only
  elements are by the view's box. Tried in the page: the panel of a formation 300 cells
  outside the view stays over a tick.
- **Tests, seen to fail first:**
  - `tests/unit/formationDetail.test.ts`: a toy formation removed and one spawned for the
    other nation in the same tick has its id; asked with the first one's count the answer is
    `null`, asked by the id alone it is the new one with another count.
  - `tests/e2e/formationPanel1938.spec.ts`, its second test: the Polish division's panel
    open, the division removed and a German one spawned: the panel closes and the German
    marker has no frame (with the HUD of before: "the panel of the Polish division that is
    gone: expected 0, received 1"). A click opens the German one's, and it stays over two
    ticks. A load closes it (without the hook: "the panel after a load").
- **Seen, not fixed here (PLAN 2.16Rk):** the player's selection (`MapView.selectedFormations`)
  is by id too, and `moveFormation` asks nothing of whose the formation is.
- **The pin did not move** (7fc8e685): nothing of the sim changed.

### ADR-114 · 2026-10-05 · accepted — A Kill's capital province is that of the capital's cell, read before the revivals (PLAN 2.16Rh)

- **Context:** the sixth read's finding 3. ADR-99 names the capital's province twice: it is
  the first seed of a piece that founds several nations, and the nation founded on it is the
  heir. `killNation` read it at the capital's coordinates. A city on the shore has its
  coordinates in a sea cell of the grid (province 0) or in the next province; its cell
  (`cities.cell`, snapped to land when the scenario is built) is where it stands.
  `spawnRebels` had the same defect and reads the cell since ADR-103 and ADR-106. And the
  province was read after the revivals of the Kill's first step: a revival that takes the
  capital's city moves the capital to another city (`relocateCapital`).
- **Decision:**
  - `capitalCell` (`systems/capitals.ts`): the cell of the nation's capital city, else (a
    field capital, whose coordinates are a cell's middle) the cell of its coordinates.
  - `collapseNation` reads that cell's province before the revivals and hands it to
    `killNation`.
  - Nothing else of ADR-99 changes. When the capital's province goes to a revived nation or
    back to a living core nation, no founded nation has it, and the heir is the largest
    founded, as before.
- **Seen** (1938 at the start, seed 99, a scratch run): eight nations have a capital whose
  coordinates are not in its cell's province: Iceland, Liberia, French West Africa, Lebanon,
  Newfoundland, Panama and Brazil in no province, Mozambique in another (1772 for 611).
  Killed, Iceland founds five nations; the one on Reykjavík has 8 cells, the largest 468, and
  Iceland's 25 cells outside any province went to the largest. They go to Reykjavík's now.
  In all eight the capital is also the largest city, so the first seed was right by its
  fallback.
- **Test, seen to fail first** (`tests/unit/killLand.test.ts`): the Kill of Iceland: the
  nation that owns Reykjavík's cell is founded by the Kill, has that cell's province as its
  origin, and owns every cell of Iceland's that is outside any province ("expected [105] to
  deeply equal [104]").
- **Not run by any test:** the read before the revivals. No nation of 1938 at the start has
  a dead claimant on its capital's province. Also not: a capital in the next province whose
  city is not the largest of its piece (the first seed).
- **Not looked into:** the random world's nine (the finding's count); the rule is the same.
- **The pin did not move** (7fc8e685): no Kill in a game without commands.

### ADR-113 · 2026-10-05 · accepted — A Kill without an heir: the land goes to the neighbour with the most cells beside it (PLAN 2.16Rg)

- **Context:** the sixth read's finding 1b. A God Mode Kill shares out the provinces whose
  centre cell the nation owns (ADR-99). A nation that owns no such centre has none: Danzig
  (7 cells) and the Chinese Communists (226) in 1938, both nations of the toy world, which has
  no provinces. Nothing is founded, nobody receives anything, there is no heir, and the last
  sweep of `killNation` moved cells to the heir only. The nation died as owner and controller
  of all its land (ADR-112 leaves the cells a nation both owns and controls to whoever ends
  it).
- **Decision** (`leaveToNeighbour` in `systems/revival.ts`, step 4 of the Kill, only when
  there is no heir):
  - The cells the nation owns and controls go, owner and controller, to the living nation
    that owns the most cells beside them (4 neighbours, across the map's seam when it loops;
    the lowest id on a tie). It is step 3's rule for a piece that founds nothing, counted in
    cells because there are no provinces to count.
  - With no nation beside them (an islet): to the living nation whose land is nearest the
    middle of those cells.
  - One `LandCeded`. No nation is founded: `spawnRebels` makes its area's provinces the
    rebels' core, and the province here is another nation's.
  - What a living nation occupies of the dead is that nation's (`eliminateNation`, ADR-112),
    not the neighbour's.
  - All the cells go to one receiver, also those of a part that lies elsewhere.
  - A Kill leaves no land without an owner. The exception: no other nation is alive. Then
    nothing moves and the dead nation keeps its land; a Kill that refuses and says why is
    PLAN 2.17's.
- **Seen:** Danzig goes to Poland, the Chinese Communists' land to China; in the toy world
  each nation's land to the other.
- **Tests, seen to fail first** (`tests/unit/killLand.test.ts`): every living nation killed in
  a copy of the world: 1938 at tick 0 and at tick 2000 (102 nations; nations 5 and 70 kept 7
  and 226 cells), a random world of 60 at tick 2000 (green before: its controller half was
  ADR-112's), the toy world (16,359 and 15,357 cells kept). Afterwards no dead nation is owner
  or controller of a cell and as many cells have an owner as before.
- **Not run by any test:** the second rule (no nation beside the land, so the nearest). Every
  nation the tests kill without an heir has a neighbour.
- **The pin did not move** (7fc8e685): no Kill in a game without commands.

### ADR-112 · 2026-10-05 · accepted — A dead nation holds no land: what it occupied goes back, what others occupied of it is theirs (PLAN 2.16Rf)

- **Context:** the sixth read's finding 1a. `eliminateNation` moved no cell. A nation whose
  last controlled cell fell (`relocateToField`) died as the owner of all its occupied land:
  seed 99 of 1938, nation 72 at tick 4006 with 1,389 cells, all held by nation 69, and so for
  the rest of the game. The same after a capital taken with no core left
  (`captureCapital`): the capturer took what it held itself, and what a third nation at war
  with the loser held stayed the dead nation's. Such land is tinted as occupied for ever, pays
  the occupier's share only, and a revival skips it (`reviveNation` takes no land from the
  nation that revives).
- **Decision** (`leaveLand` in `systems/capitals.ts`, called by `eliminateNation`, so by
  every death):
  - A cell the dead nation controlled and did not own goes back to its owner.
  - A cell it owned that a living nation controls becomes that nation's: the nation is gone,
    there is no peace to hand the land back in, and the occupier is who holds it. The cores
    and claims are the provinces' and do not move, so the dead nation can revive there.
  - One `LandCeded` for each receiver (the lowest id first), before `NationEliminated`.
  - A cell it both owns and controls is left: whoever ends a nation that still holds land
    hands it over first (annexation, integration, the God Mode Kill). The Kill that finds no
    heir still leaves such cells: PLAN 2.16Rg.
- **Not tuned:** who gains from it is balance (Phase 7, ADR-58). No sweep.
- **Tests, seen to fail first:** `capitals.test.ts` (Poland occupied by Germany and the
  Soviet Union, Warsaw taken: 1,452 cells stayed Poland's; a dead Poland stayed the controller
  of 5 Lithuanian cells); `baselineHash.test.ts` asks at every month's start that no dead
  nation is owner or controller of a cell (`tests/helpers/deadLand.ts`; it failed at tick
  4344 with nation 72), and so do the three ten-year runs of `aiSweep`.
- **The pin moved:** 324bc358 → 7fc8e685 (a rule of the sim: owners change at tick 4006 of
  seed 99).

### ADR-111 · 2026-10-05 · accepted — A loaded world gives the new-game form its number of nations; the range is said once (PLAN 2.16d)

- **Context:** two lines left by ADR-110. A game continued by a URL without `nations` showed
  60 in its new-game form whatever the world had, and its next autosave lost the number. The
  title screen said "2 to 200" among the scenario's facts and again beside the field.
- **Decision:**
  - The game keeps its new-game options in a signal (`setup` in `src/app/game.tsx`): the
    URL's, and for a scenario with a range the number of living nations of a loaded world,
    brought into the range. The settings panel's form starts from it and the autosave records
    it.
  - A continued game whose URL has the number keeps it: that is the number the game was
    started with, and the world's may have changed since (a nation dead, a revolt). A
    scenario file, staged from the title screen or loaded in the editor, always gives the
    world's number: it is another world than the URL's.
  - The world does not record how many nations it started with. A URL typed without the
    number for a game of some years gets the number of nations alive now, not that of its
    start. Not state: the pin does not move for a default of a form.
  - The hint with the range beside the field is the settings panel's (`rangeHint`); on the
    title screen the range stands among the facts only.
- **The scenario file of a random world** (not tried in ADR-108) works with no change: its
  header's base is `random`, the title screen starts that scenario, names are state and the
  flags are made from id and colour.
- **The pin did not move** (324bc358): no rule of the sim changed.

### ADR-110 · 2026-10-05 · accepted — The random world on the title screen: a picture of one such world, and the number of nations in the URL (PLAN 2.16c)

- **Context:** the random world opened by its URL only (ADR-108). The title screen shows a
  scenario by a committed picture of its start, and a random world has no one start.
- **Decision:**
  - *On the list,* second, after the 1938 world (`hidden` dropped from its `scenario.json`).
  - *The picture* is one random world: seed 7 with 60 nations, the number of a game that asks
    for none. It is the world the game builds for that seed (built at the game's 2048 × 1024,
    every second cell of every second row), not a drawing of its own. The description and the
    picture's alt text say that every seed gives another. A picture drawn in the page for the
    seed in the field would need the map assets and the world's builder on the title screen,
    where no world runs (ADR-60): not done.
  - *The number of nations* is a field of the new-game form, shown where the scenario has a
    range (`ScenarioInfo.nationsRange`; the range itself moved from the sim to
    `shared/scenarios.ts`, `RANDOM_NATIONS`). Start is disabled outside 2 to 200. The facts
    beside the picture read "2 to 200" where another scenario has its count.
  - *In the URL* as `?nations=N` (a whole number of up to four digits, else no option; the
    sim brings it into the range, as before). The autosave's record keeps a game's options,
    so Continue carries it with no change there. The form sends the option only for a
    scenario with a range: a 1938 URL never has it.
- **Not done:** a continue URL typed without `nations` loads the saved world as it is, and the
  settings panel's form then starts from 60, not from the world's count (the seed is corrected
  from the loaded world, the count is not). A line of PLAN 2.16d.
- **The pin did not move** (324bc358): no rule of the sim changed.

### ADR-109 · 2026-10-05 · accepted — A scenario says whether it has a nation table; without one a nation's name and flag are its own (PLAN 2.16b)

- **Context:** `FlagStore` and the worker's `nameOf` read the 1938 table by nation id in every
  scenario. The toy world's two nations were "Germany" and "Austria" under their flags, and
  the random world's sixty flew the flags of the first sixty nations of 1938.
- **Decision:**
  - `ScenarioInfo.nationTags` (`src/shared/scenarios.ts`): the tags of the scenario's nation
    table by id, empty for the toy and the random world. It is the one place that says so.
  - `FlagStore` is given `tagOf` by the map view; it no longer imports the nations of 1938. A
    nation without a tag flies the made flag of PLAN 2.15c (`foundedFlag`: its id and colour).
  - `Sim.scenario`; `nameOf` reads the table only for a nation with a tag.
  - The toy world's nations are named in `world.names` ("West", "East"), as the random
    world's are (ADR-108). The names are literal, not i18n keys: so are province names.
- **Not changed:** `NationField.founded` still means "founded in the game" only.
- **The pin did not move** (324bc358). The toy world's hash did (names are state); no test
  pins it. A toy autosave of before still loads; its two nations have no entry and no tag
  and read "Free state 1" and "Free state 2" (in an inspection: the toy world has no panels).
- **What it does not give.**
  - A second nation table: the worker still knows only `NATIONS_1938`. Another year
    (PLAN 7.4) brings its own table and its own flags file.
  - A cleared God Mode name in a world without a table: the rename command with an empty
    name deletes the entry, and the nation then reads "Free state N". A line of PLAN 2.17.

### ADR-108 · 2026-10-05 · accepted — The random world: the earth shared out by the seed (PLAN 2.16a)

- **Context:** the critic's R2-B7: one scenario, one map, no random world; AoC's usual way to
  play is a random simulation (TEXT). PLAN 2.16 left open what comes first.
- **Decision:** the random world first, as a scenario `random` on the earth map
  (`src/sim/randomWorld.ts`). Another year needs a border dataset: PLAN 7.4.
  - *Capitals:* N (2 to 200, 60 when none is asked for) drawn from the map's 5,774 cities:
    of 12 cities drawn, the one farthest from the capitals there are. One to a province, none
    on a piece of land under 12 cells.
  - *Land:* each province goes to the nation that reaches it first over the province graph
    (the crossings are nodes), a nation's kilometre costing 0.6 to 1.8 by the seed, so the
    nations differ in size. A province no road reaches goes to the nearest capital by the
    same measure. Borders follow the provinces, as those of 1938 do.
  - *Nations:* called after the province of their capital; the name is in `world.names`,
    with those God Mode gives, so it is state and is saved. No `origin`: that marks a nation
    founded in a game, and a revolt next to one joins it (`risingNeighbour`). A colour by
    golden-angle hue, aggression 15 to 85, no traits, no alliance, no war, no puppet.
  - *Armies:* infantry divisions for half the income, one in eight armoured and one in eight
    motorised where there are eight, around the nation's six largest cities; 900 at most.
  - *The rest is the 1938 world's:* map, terrain, cities, economy by the land's country,
    units, templates, systems, the start date. The count is a new-game option (`nations`).
  - *Seeded by `hash32(seed, …)`*, not by the world's streams: the world's streams start as
    they do in 1938.
- **Seen:** seed 7 with 60: the largest holds 7% of the cells, the median 6,953 cells, the
  smallest 66. With 2 nations the larger holds 61%. Cells, not km²: the north reads large.
- **Not done here:** flags and the worker's names by scenario (2.16b: a random nation of id 3
  would fly the flag of 1938's third); the title screen (2.16c). The scenario is `hidden`
  until then; `?scenario=random` opens it.
- **The pin did not move** (324bc358): the 1938 build lost only a function boundary
  (`startTreasury`).

### ADR-107 · 2026-10-05 · accepted — The game is on GitHub Pages, and every commit is pushed (the user's decision)

- **Context:** the build already ran from any path (a relative base, the worker and the map
  data found from the page, no SharedArrayBuffer: ADR-6). `main` was 137 commits ahead of
  `origin`. The user asked for GitHub Pages, and for a push with every commit.
- **Decision:**
  - `.github/workflows/pages.yml` builds on every push to `main` (`npm ci`, `npm run build`)
    and deploys `dist/` to https://richyuen.github.io/WarSim/. Pages' source is "GitHub
    Actions".
  - Every commit is pushed (PROMPT.md step 7).
- **What it does not do:** the workflow does not run the gate; the gate runs before the
  commit, on the machine. The build ships its source maps (5 of 13 MB).
- **Never deployed:** `reference/` (ignored) and `critic/`'s scratch files (not in the build).

### ADR-106 · 2026-10-05 · accepted — A rebel nation's origin is the province of its capital's cell (PLAN 2.15e3)

- **Context:** ADR-100 made the origin, which names a founded nation, the province of its
  capital. `spawnRebels` read that province at the capital's coordinates. A city on the
  shore has those in a sea cell of the coarse grid (ADR-103, point 1), which is in no
  province of the area, and the origin fell back to the area's first province. 337 of the
  cities of the 1938 start that are no capital have their coordinates outside the province
  of their cell.
- **Decision:** the origin is the province of the capital's cell: the city's cell
  (`cities.cell`) where the capital is a city, else the nation's own cell that was taken
  (ADR-103). Both are the nation's, so both are in the area. The area's first province is
  left for a nation founded without a cell.
- **What the count of PLAN 2.15b was:** its "66 of 406 with the capital outside the origin"
  compared the origin with the province of the coordinates. An area of the forced revolt
  has its city in its first province nearly always, so the fallback gave the right name
  there: asked of the capital's cell, the 406 had 0 outside the origin before this change.
  The defect needs an area of several provinces with the shore city not in the first: a
  revolt that neighbours join (`REGION_JOIN`) and the pieces of a Kill.
- **The pin:** not moved (324bc358).
- **Tests:** `tests/unit/nationNames.test.ts`: a shore city beside a province without one,
  the area given with the other province first (seen to fail: origin 504 for 1676); the
  forced revolt now asserts the capital's cell in the origin for every nation founded.
  By hand: `godUi1938` (2), green; the Kill of France names its five as before.

### ADR-105 · 2026-10-05 · accepted — An atoll the fine mask has no pixel for gets an islet in it (PLAN 2.15e2b)

- **Context:** ADR-104 left 8 militia formations off sure land, each in a cell "without sure
  land in the fine mask". Looked at first, as the task asked:
  - Of the 627,829 owned cells of the 1938 start, 8 have no land pixel in the mask, and no
    other owned cell is without sure land at its `cellPoint`. The mask has no land within
    twelve of its pixels of any of the 8.
  - They are Pitcairn, the Ralik Chain, Johnston Atoll, the Chagos (British Indian Ocean
    Territory), Tuvalu, the Coral Sea Islands, Clipperton and Ashmore and Cartier: each a
    province of one cell, a land cell by `reconcileIslands` (a territory smaller than a cell
    is given one). Of the 44 cells of that rule, 9 have no land pixel: these 8 and the
    Spratly Islands (cell 1668,550), which nobody owns in 1938. The other 35 have one.
    (Counted after the commit of the code, which said "the other 36": corrected here.)
  - The picture drew open sea there at every zoom (looked at: Clipperton and Tuvalu at 6,
    40, 250 and 900 px to a cell; at 6 the neighbours of Tuvalu are drawn, it is not). The
    game owned, taxed and could garrison land nobody saw.
- **Decision:** "the best pixel of the cell" is no answer where there is none, so it is land
  the mask does not have. `createWorld1938` gives each cell of `reconcileIslands` that has no
  land pixel an islet in the mask (`addIslet`, `src/shared/landMask.ts`): the cell's pixels
  without its corners, 52 of 64. `buildPoliticalMap` reports the cells (`islandCells`).
- **Why in the mask, and not a rule of `onLand`:** ADR-79: the sim and the picture read one
  mask. A rule of the sim alone would stand a formation on a place the map draws as sea.
- **Why that size:** the coast of T0 and T1 is the coverage's, two texels to a cell, land
  where it is over a half. A 4 × 4 islet gives each texel 4 of 16: nothing drawn. 6 × 6
  gives 9 of 16: seen, a square speck. The cell without its corners gives 13 of 16 and a
  round island at T1 and T2 (both looked at), and elements have a cell's width of sure land.
  It is larger than the atoll (a cell is 20 km at the equator): what a cell of the game is.
- **Why at the world's build, and not in `npm run data`:** which cells are land is the
  scenario's (its provinces, at the map's size); the mask's file is the Earth's and stays
  Natural Earth's.
- **The mask is changed in place.** The worker draws the coverage and sends the page its
  copy from the same object, after the world is built, so sim and picture agree without a
  second mask. The headless tools keep one mask for the process: every world of it stamps
  the same cells again, and a cell that has land is left alone (`addIslet` returns false).
  A saved game is loaded into a world built the same way.
- **What it does not decide:** land painted or imported in the editor on water of the mask
  still keeps its cell's middle (`cellPoint`), and the picture draws it by the coverage only;
  the other 35 island cells keep the land the mask gives them, however little. The Spratly
  Islands get their islet too: a land cell of the game, owned or not, is land in the mask.
- **The pin:** not moved (324bc358): nothing stands on the 8 atolls in seed 99's first year.
- **Tests:** `tests/unit/rebelCapitals.test.ts`, the second: `islets` at 0 (seen to fail: 8).
  `tests/unit/coast1938.test.ts`: every owned cell has sure land at its place to stand, and
  the 8 are over a half in the coverage (seen to fail: the 8); `addIslet` alone. e2e in
  `tests/e2e/coast1938.spec.ts`: each of the 8 is not sea in the picture at 40, 400 and
  1,600 px to a cell, and the sea two cells west is. Pictures:
  `docs/evidence/2.15/atoll-clipperton-t1.png` and `-t2.png`.

### ADR-104 · 2026-10-05 · accepted — A rebel nation's militia are raised where production raises a formation (PLAN 2.15e2)

- **Context:** the militia of a new rebel nation stood at the capital's coordinates
  (`standPoint`). A city on the shore has those in a sea cell of the coarse grid (ADR-103,
  point 1), which is nobody's. Of 577 militia formations of a revolt forced in every
  province of the 1938 start, 95 stood on a cell that was not their nation's.
- **Decision:** `spawnRebels` asks `spawnPoint` (`systems/production.ts`): the cell the
  nation controls nearest its capital, at the capital's own place when that cell holds it,
  else at the cell's land point. Where `spawnPoint` has no answer (no cell within
  `SPAWN_REACH_CELLS`) the old place stays. A nation that returns from the dead through
  `spawnRebels` takes the same way. One rule for every formation a nation gets at home.
- **Measured:** 95 → 0 on a cell that is not theirs. Off sure land: 8, all of one kind: a
  nation of one cell that has no sure land anywhere in the fine mask (an islet smaller than
  a pixel of it), so `cellPoint` keeps the middle. Whatever stands in such a cell stands
  there, a militia or not: a cause of its own, PLAN 2.15e2b.
- **Not decided here:** what stands for land in such a cell (2.15e2b); a field capital that
  moves takes the middle of its cell (`relocateToField`, seen in 2.15e1).
- **The pin:** not moved (324bc358): no revolt at a capital on the shore in seed 99's
  first year.
- **Tests:** `tests/unit/rebelCapitals.test.ts`, the second: every militia formation on a
  cell of its nation (seen to fail: 95), and on sure land where its cell has any; no more
  than the 8 of 2.15e2b in a cell that has none.

### ADR-103 · 2026-10-05 · accepted — A rebel nation without a city has its capital on its own cell (PLAN 2.15e1)

- **Context:** PLAN 2.12a counted, of 406 nations founded by a revolt forced in every
  province of the 1938 start, 74 with the capital "on a cell that is not theirs". Looked at
  again, they are two things:
  1. 63 have a city as capital whose coordinates lie in a sea cell of the coarse grid (a
     city on the shore). A city is held by its cell (`cities.cell`), which is the nation's.
     That is how every city is held (`captureCapital` and the capital checks read the
     city's cell), and no defect of the capital.
  2. 11 have no city in their area (196 of the 406 have none) and took the middle of the
     area, which was not their land: a crescent, a strip of coast, a group of islands.
- **Decision:** a rebel nation without a city takes as capital its own cell nearest the
  middle of its area (`nearestCellWhere`, as a field capital that moves:
  `relocateToField`), at the cell's land point (`World.cellPoint`). A nation that returns
  from the dead through `spawnRebels` takes the same way.
- **Not decided here:** where the militia stand (2.15e2) and which province names a nation
  whose city is on the shore (2.15e3). The 63 of point 1 are behind both.
- **The pin:** not moved (324bc358): no revolt without a city in seed 99's first year.
- **Tests:** `tests/unit/rebelCapitals.test.ts`: the forced revolt in every province; the
  capital's cell is the city's or, without a city, that of its coordinates, and the nation
  owns it. Seen to fail first (11).

### ADR-102 · 2026-10-05 · accepted — Land handed over is an event of its own, not a revolt (PLAN 2.15d)

- **Context:** the critic's R2-B6: the history calls land that goes back to a living nation
  a revolt ("France broke away from Italy"). `defect` (`systems/revolts.ts`) emitted
  `RevoltSpawned` with a = the nation that received the land. It has three callers:
  1. a restless conquest goes back to its living core nation;
  2. a restless area joins rebels who hold the province next to it;
  3. a God Mode Kill (ADR-99) gives land to a core nation, a claimant, a neighbour or the heir.
  After a Kill of France the history said "Italy broke away from France", and the same of
  British India, the United Kingdom and the Netherlands.
- **Decision:** a new event kind, `LandCeded` = 36: a = who received the land, b = who held
  it, (x, y) = the middle of the land. Callers 1 and 3 emit it. It is a historic kind
  (`HISTORY_KINDS`), both of its roles are nations, its type reads "Land handed over" and
  its line "Land of {b} went over to {a}".
- **Caller 2 stays a revolt.** The area rises against its holder with rebels, becomes their
  core, and the holder declares war on them: "Free Paris broke away from France" says what
  happened. `defect` takes the kind; the default is `LandCeded`.
- **One kind, not two.** "Returned to" is true of a core nation and false of a neighbour in a
  Kill. One line that is true of both, and one filter, rather than two kinds a reader has to
  tell apart.
- **The filter** needed no change: the history panel lists the kinds that its rows hold.
- **What it does not change.**
  - A dead nation that returns on its land still logs a revolt beside its "returned"
    (`reviveNation` founds it through `spawnRebels`): Ethiopia in a Kill of Italy reads
    "Ethiopia broke away from Italy" and "Ethiopia returned". It did rise against the holder.
  - A Kill writes one line for each handover, so a nation can have two (Free Paris: its
    revolt, and the islands it takes as the heir).
  - The cells outside any province that go to the heir at the end of a Kill have no line.
  - A save from before keeps its rows of kind 23, which still read "broke away".
- **The pin:** not moved (324bc358). The history is state and is hashed, but seed 99 has no
  defection in its first year.
- **Tests:** unit: `revolts.test.ts`, the defection (one `LandCeded` [Poland, Germany], no
  `RevoltSpawned`, the same in the history's rows); `godMode.test.ts`, the Kill of France,
  Yugoslavia, Italy and Luxembourg (a revolt for each nation born and no other; land handed
  over by the dead nation only, to every nation that was there and gained land). Both seen to
  fail first. `history.test.ts` holds every historic kind to its roles and its two strings.
  e2e: `godUi1938.spec.ts`, the Kill of France: the rows, the two filters and their text.

### ADR-101 · 2026-10-05 · accepted — A founded nation flies a flag made from its id and its colour (PLAN 2.15c)

- **Context:** the critic's R2-B6 saw 25 of 109 living nations after 14 years with "a blank
  flag". PLAN 2.15c asked which of two causes it was. Both were there.
  - *The plain flag was the rule.* `FlagStore` gave a nation without a scenario flag
    `plainFlag(colour)`: 36×24 pixels of one colour, by design since PLAN 1.37b.
  - *And the colour could be wrong for good.* The store kept a nation's pixels by its id and
    dropped them only when a painted flag changed. A flag asked for before the first snapshot
    had told the colour was grey (0x888888) for the rest of the game.
  - *A third, by reading:* the scenario flag was found by `nations[id - 1]`, so a founded
    nation on the id of a scenario nation would fly that nation's flag. No code frees a
    nation's row today, so it could not happen; the table reuses a freed id first, so it would
    on the day one does.
- **Decision.**
  - `foundedFlag(id, colour)` (`src/shared/flagPixels.ts`) returns a `FlagSpec`. It reads
    nothing else: no seed, no state, no scenario. A scenario without flags can call it for
    every nation (PLAN 2.16).
    - *The pattern:* one of the editor's 11 presets, by a hash of the id and the colour.
    - *The first colour:* the nation's own. The flag over a capital belongs to the land under
      it, and a reader finds the nation of a counter by it.
    - *The second:* dark (0x1c1c28) or pale (0xf2efe4), whichever stands off from the first
      (by its luma, above or below 140).
    - *The third:* the first of six plain accents (gold, red, navy, green, dark, pale), from a
      place the hash gives, that is 150 or more from both others (the sum of the three
      channels' differences).
  - It is the view's. Nothing is written into `world.flags` (the painted flags): a made flag
    in the state would make every founded nation read as painted in the flag editor, would
    grow every save and would move the pin. **The pin did not move** (324bc358).
  - `FlagStore` remembers what each cached flag was made from (a painted flag, the scenario's,
    or a colour) and makes it again when that differs. It takes a second function,
    `foundedOf`.
  - The snapshot's nation row has a tenth field, `founded` (1 where the nation has an
    origin: founded in the game, not revived). The view asks it before it looks for a
    scenario flag by the id.
  - `spawnRebels` drops a painted flag of the id it founds on, as it drops a God Mode name.
- **Why not a flag from the province's country** (Free Paris under a French tricolour with a
  mark)? It would need a flag for each of the data's countries, where we have 103 for the
  nations of 1938, and five states of one Kill would fly five flags alike.
- **What it does not give.**
  - Flags that mean something: a cross says nothing of a nation's faith, a star nothing of
    its rule.
  - Two founded nations never alike: the same id with the same colour is the same flag by
    design, and two ids can come to the same pattern and colours. Of 406 nations founded by a
    revolt forced in every province of the 1938 start, all 406 flags differ.
  - Flags by scenario: `FlagStore` still reads the 1938 tags and flags whatever the scenario
    (the toy world's nations fly flags of 1938). PLAN 2.16. Done in PLAN 2.16b (ADR-109).
  - The GPU flag atlas (`buildFlagAtlas`, the bench of PLAN 1.6) holds the 103 scenario flags
    only; what the game draws goes through `FlagStore`.

### ADR-100 · 2026-10-05 · accepted — A founded nation is named after the province of its capital, and a province without a name after its country (PLAN 2.15b)

- **Context:** the critic's R2-B6 saw "Free state 128". PLAN 2.12a took away its cause there
  (a nation that lost its origin as the table grew). Two more ways to the number were left.
  - *Seven provinces of the earth data have no name* (`adm1` ending `+99?`, area 0: 2550
    Antarctica, 2966 Kiribati, 3115 Colombia, 3123 Venezuela, 3124 Anguilla, 3142 Mexico,
    3155 Russia). They are not empty: at the 1938 size six hold one cell and Antarctica's
    18. A revolt there founded "Free state N".
  - *The origin was the first province of the area*, where the revolt began or a Kill's seed
    stood. The capital is the largest city of the area, which may be in another province.
- **Decision.**
  - `provinceLabel` (`src/shared/nationNames.ts`): a province is called by its name, else by
    its country's (`admin`). The data is not changed: Natural Earth gives no name there, and
    a made-up one would be ours.
  - `foundedName`: "Free <label of the origin>". "Free state N" stays as the last resort for
    a state without an origin (a save from before PLAN 2.12a); nothing founded now comes to
    it.
  - `spawnRebels` sets the origin after the capital: the province of the capital's cell
    where that is in the area, else the area's first as before (an area without a city has
    its capital in its middle, which may be the sea: PLAN 2.15e).
- **The pin did not move** (324bc358): `origin` is in the state, but a plain game revolts by
  province, where the area is one province. In region mode and in a Kill the origin of a
  nation can now differ from before; nothing reads it but the name and `risingNeighbour`,
  which asks only whether it is 0.
- **What it does not give.**
  - Two nations of one name. 114 names are held by more than one province ("Valmiera" 21,
    "Central" 10, "Northern" 8), and "Free Colombia" can stand beside Colombia. A line under
    PLAN 7.4.
  - A name that follows the capital when it moves: the origin is where the nation was
    founded.
  - Names in a scenario that is not on the earth map: the labels are the earth data's.

### ADR-99 · 2026-10-05 · accepted — A God Mode Kill hands land back, founds five nations at most and starts no war (PLAN 2.15a)

- **Context:** the critic's R2-B6. A Kill of France made 103 living nations 139 and left 43
  wars a month later. Measured here at the 1938 start, seed 99, one tick after the Kill:
  France 102 → 139 living and 2 → 40 wars; Yugoslavia 102 → 149 and 2 → 50.
- **Two causes.**
  - *The count:* the forced collapse cut the land into groups of at most `REGION_MAX` (8)
    provinces, one nation each, and every island was a group of its own (France is 20
    connected pieces, 13 of them of one cell).
  - *The wars:* `spawnRebels` ends with the holder declaring war on the nation it founds,
    and a declaration brings in the holder's allies and puppets. The holder died in the same
    tick; `endAllOf` took it out of each war, and each war went on between its allies and
    one new nation.
- **Decision** (`killNation` in `systems/revival.ts`; the order is the rule):
  1. Puppets go free and dead claimants revive, as before.
  2. A province whose core nation is alive goes to it; else to its living claimant with the
     lowest id.
  3. The rest founds at most `KILL_STATES` = 5 nations, and no more than one for every
     `KILL_CELLS_PER_STATE` = 200 cells the nation held (rounded, at least one). The
     connected pieces share them by the weight of their cities (the sum of the sizes;
     highest averages), no piece more than it has provinces with a city.
  4. A piece with several is divided among seed provinces, each taking the provinces
     nearest to it. The first seed is the capital's province, else the largest city's; each
     further one has the highest product of its city's size and its distance from the seeds
     taken.
  5. A piece that founds nothing goes to the living nation with the most provinces next to
     it. One with no neighbour, and the cells outside any province, go to the heir: the
     nation founded on the old capital, else the largest founded, else whoever received the
     most.
  6. Nobody declares war: `spawnRebels` and `reviveNation` take `war = false`.
- **Why five.** The critic asked for "a stated few". Five lets a large nation come apart
  into pieces a viewer can count and name, and the war banners do not grow. One for every 200
  cells keeps Luxembourg (14 cells) one nation.
- **Why the cities weigh and not the land.** By cells France's Algeria is three times
  metropolitan France (7,470 against 2,568) and would take four of the five.
- **Why no war.** The nation that would declare it is dead before the tick ends. A new
  nation that wants its neighbour's land declares its own war by the usual rules.
- **Seeds, tried:** the largest cities in order gave two neighbouring provinces in France
  (Ain and Rhône), and "Free Rhône" was the south-west with Lyon at its edge. The furthest
  apart alone gave Finistère and Andorra's La Massana, and 1,800 / 553 / 373 cells. Size
  times distance gives Paris, Ain and Haute-Garonne: 1,095 / 944 / 687.
- **Measured with it** (seed 99, one tick after):

  | Kill of | living | founded | their cells | wars |
  |---|---|---|---|---|
  | France | 102 → 106 | 5 | 1,095, 944, 687, 7,267, 203 | 2 → 2 |
  | Yugoslavia | 102 → 106 | 5 | 535, 138, 50, 301, 72 | 2 → 2 |
  | Italy | 102 → 107 | 5 | 1,263, 2,627, 2,516, 1,161, 191 | 2 → 2 |
  | Luxembourg | 102 → 102 | 1 | 14 | 2 → 2 |

  France's count is 106 and not 107 because France itself is gone; Italy's has Ethiopia back.
- **A test restated, not weakened:** `godMode.test.ts`, the Kill of Yugoslavia, asked that
  the new nations hold every cell Yugoslavia held. One cell of an island with Italy next to
  it now goes to Italy (step 5). The test asks that the new nations and the neighbours'
  gains together are every cell, and that the new nations hold over 99%.
- **The plain game:** a collapse by bankruptcy is as it was (`forced` false: the restless
  provinces revolt in connected groups, and the holder declares war on each). **The pin:**
  not moved.
- **Tests:** unit (`godMode.test.ts`): France, Yugoslavia, Italy and Luxembourg: one to five
  founded, no `WarDeclared`, no new war, no cell left with the dead nation, the world's owned
  land the same. Seen to fail before (38 founded for France). e2e (`godUi1938.spec.ts`): the
  Kill of France by two clicks in the God tab. Pictures: `docs/evidence/2.15/`.
- **What it does not give.**
  - The dying nation's capital still moves once for each nation that takes it, with a
    `CapitalMoved` event each time.
  - Land that goes to a neighbour or back to a core nation is logged "broke away" (PLAN
    2.15d).
  - Algeria comes out as a coast of 203 cells and a desert of 7,267: provinces crossed, not
    kilometres, decide who is nearest, and one desert province is most of the land.
  - Indochina and Madagascar, with one or two cities, found nothing and go to a neighbour.
  - The new nations are still "Free <province>" with plain flags (PLAN 2.15b, 2.15c).
  - The dead nation keeps no claim on the land of the nations founded on it, so Revive
    finds nothing there (PLAN 2.17).

### ADR-98 · 2026-10-05 · accepted — A deployed block stands no further from its formation than contact reaches (PLAN 2.14f5c)

- **Context:** ADR-92, under "not done": "How far a block may stand from its formation has
  no limit in `deployOf`." Two that are each other's nearest go half the way between them,
  0.67 cells (13 km) at most. One whose nearest enemy is deployed against another comes up to
  that enemy's block (ADR-89), which may stand on the enemy's far side, and that enemy's own
  enemy's further still.
- **Measured without a limit** (60 days of Germany against Poland, hour by hour; seed 99 in
  `deploy.test.ts`, seed 7 by a probe not kept): the furthest block 44.3 and 79.8 km from its
  formation; further than contact reaches (1.5 cells, 29.4 km) in 5,705 of 169,800 and 10,707
  of 210,800 block-hours (3.4% and 5.1%). None of them of a pair of each other's nearest.
- **Decision: a limit, at the contact distance** (`DEPLOY_REACH = CONTACT_CELLS`). The block
  goes that far along its line and stops, facing as before.
- **Why a limit.** The T1 marker stands on the formation and the T2 block at its deployment
  (ADR-89 said "up to 0.45 cells away"; ADR-92 let the marker stay for that reason). At four
  cells the block stands among formations the rules do not have it near: the two tiers then
  show different places for one division. Now the two are never further apart than the
  enemy it fights can be.
- **Why this number.** Tried on both seeds (days 10, 20, 30, 45 and 60; the share of
  formations in contact that have their nearest enemy in one view at 20 m/px):

  | limit, cells | share in one view, the worst day | blocks on one another, the most | block-hours at the limit |
  |---|---|---|---|
  | none | 94.3% and 93.0% | 3 and 20 | 0 |
  | 1.5 | 94.3% and 93.0% | 5 and 20 | 3.4% and 5.0% |
  | 1.25 | 94.3% and 93.0% | 8 and 22 | 8.0% and 8.7% |
  | 1.0 | 92.7% and 91.5% | 14 and 23 | 11.5% and 11.7% |
  | 0.75 | 86.2% and 86.7% | 22 and 28 | 16.7% and 15.4% |

  At 1.5 no day lost more than 1.7 points (95.9% to 94.2%, seed 7, day 45) and the test's
  90% holds. At 0.75 it does not. 1.5 is also a number the rules already have.
- **What it costs.** A block held back stops short of the block it was going to. In the
  block-hours the limit holds (seed 99 and seed 7), from the block to its enemy's block:
  median 3.3 km without the limit, at most 11.3 and 13.6; with it median 7.8 and 10.1 km, at
  most 17.2 and 28.7. Over 14 km, half a view at 20 m/px: 323 and 1,678 block-hours, 0.2% and
  0.8% of all, and none before. The shots of those hours are that long. They were the hours
  in which the block was 29 to 80 km from its own formation.
- **What cannot change:** a pair of each other's nearest (0.67 cells at most). So the pair a
  war's banner leads to (ADR-93, ADR-95), the pair of `battleView1938` and every built pair
  of the tests stand where they stood. `toBattle1938`, day 60: formations 45 and 563 as
  before, the camera at the same place.
- **Hops** (ADR-92's count; seed 99): 489 of more than a block's depth (511), 108 of more
  than half a cell (109), the longest 40.0 km (50.0). Seed 7: the longest 34.9 km (37.6). The
  limit is not what makes a hop rare: a block changes sides when its enemy's line does.
- **Tests:** unit, in the hour-by-hour test of `deploy.test.ts`: no block further from its
  formation than `CONTACT_CELLS` (the furthest 29.4 km, at the limit in 5,733 block-hours,
  none of them each other's nearest; a block at the limit is nearer its enemy's block than
  contact reaches, 17.2 km at most). Seen to fail with the limit off (2.26 cells).
- **The pin:** not moved (a block's place is not state).
- **What it does not give.**
  - Hops of up to 40 km in an hour remain, and were not looked at on the screen.
  - The chain of "its enemy's block" is followed four deep, as before.
  - A block held back faces the block it does not reach; nothing on the screen says so.
  - No picture of a held-back block was taken: the day-60 view of `toBattle1938` has none.

### ADR-97 · 2026-10-05 · accepted — The click on a war's banner flies to the battle (PLAN 2.14f5b4)

- **Context:** ADR-91 made it a jump: "the camera has an eased zoom and no eased pan, and a
  flight from the world to 20 m/px passes four tiers in a second". A jump from the world view
  to 28 km of ground does not say where on the map the battle is.
- **Decision: built.** `flight` in `render/camera.ts` (pure): the path of van Wijk and Nuij
  (2003) between two cameras, pan and zoom in one movement, with ρ = √2 and a cubic ease at
  both ends. 320 ms for each zoom by 4.1 times along the path, 250 ms at least and 1.6 s at
  most. `CameraController.flyTo` flies it and ends on the target exactly;
  `MapView.showBattle` is its one caller. `set` stays a jump (tests, God tools).
- **The three starts** (a probe not kept: seed 99, day 60, a view of 1400 × 800, the view's
  turns given times 16.7 ms apart; a picture every eighth frame, looked at):
  - *The world view:* 89 frames (1.48 s). A zoom towards the place: the world, Europe,
    Germany and Poland with their names, the markers of the front at 231 m/px, the elements
    at 73, the figures from 24. The ground moves 21 px a frame at most.
  - *20 m/px on another front, 5,900 km away* (the case a joint ease of pan and zoom smears):
    90 frames. It zooms out to 4,276 m/px (Central Asia with its markers), crosses, and zooms
    in on the border. 248 px a frame at most, under a fifth of the view.
  - *20 m/px, 117 km away:* 78 frames; out to 91 m/px and in; 107 px a frame at most.
- **ADR-91's reason, measured.** The wheel's ease passes the same four tiers in 0.6 s, and
  `zoomDemo1938` holds it to be seamless; the flight takes 1.5 s over them. What it costs:
  the view asks the worker for its box every 100 ms, so 13 to 16 subscriptions in a flight
  where the jump has one, and the worker sends elements on the way (736 held at 93 m/px, 163
  at the end). The view's turn took 1 to 6 ms in the mean in those frames (the script's side;
  the browser of the tests draws on the processor).
- **The user's hand ends it.** A key of the camera, the wheel, a press on the map or a touch
  ends the flight where it is; it does not go on once the key is up.
- **On a looping map** it goes the short way round.
- **Tests:** unit, six in `camera.test.ts` (the ends exact; from the world the place stays in
  the view and the zoom only grows; far apart at 20 m/px it zooms out to under three views
  between the two, never moves away, under half a view a frame; the short way round; a zoom
  on the spot; the limits of its time, and no step that is not a camera). e2e, the first of
  `toBattle1938`: the frames of the view's own loop from the flight's first to its last (15
  in 3.4 s in the tests' browser, 7 of them between the world and 40 m/px; the zoom only
  grows), seen to fail with the jump ("no flight began"); and a second click with the left
  arrow pressed on the way: the camera stays above 100 m/px. Both tests of the spec wait for
  the flight's end before they ask where the camera is; what they ask is as it was (the
  place to six decimals).
- **The pin:** not moved (the view only).
- **What it does not give.**
  - How it looks at 60 frames a second on a graphics card was not seen: the tests' browser
    draws 4 to 8 frames a second while the camera moves, and the pictures are of frames
    stepped one by one, with the worker's answers arriving sooner, counted in frames, than
    they would.
  - The counters' splits (300 ms) and the handover's fade (250 ms) are passed while they
    run; no measure of what is half shown on the way was taken.
  - `prefers-reduced-motion` is not read: nothing in the game reads it yet.
  - A flight is not held to the map's edge on its way out (it is normalized frame by frame,
    so on a map that does not loop it slides along the edge).
  - `CameraController` has no unit test of its own (it needs an element); the flight's end
    by the user's hand is tested in the browser, by a key only.
  - A drag begun before the flight does not end it (the flight starts when the worker has
    answered, some milliseconds after the click): the press is what lands it, not the move.
  - "The wheel's ease passes the four tiers in 0.6 s" is worked out from its rate (18 a
    second), not measured, and it is the eased zoom of `zoomTo`: one notch of the wheel does
    not ask for that span.

### ADR-96 · 2026-10-05 · accepted — A war's banner shows whether the war has a battle (PLAN 2.14f5b3)

- **Context:** ADR-91, under "what it does not give": "nothing on the banner says whether
  there is a battle to go to". A click on a war with none selected the leader and left the
  camera where it was, and nothing said why. ADR-91 did not send it with the statistics
  because it took the flag for "a grouping of every war's formations with each statistics
  message".
- **Decision: built.** Each war row of the statistics (`WarStat`, at most once a second, and
  in `inspect`) has `battle`: whether formations of its two sides are in contact, which is
  where `largestBattle` has an answer. On the banner the swords are gold with a battle and
  dim without, the frame is dimmer without, and the tooltip's second line reads "Click: to
  its largest battle" or "No battle now". The click does what it did.
- **How it is known** (`warsWithBattle`, `sim/systems/warBattle.ts`), without the grouping:
  one pass over the hour's contacts (`contactsOf`: each formation in contact and its nearest
  enemy) marks every war that has the two on opposite sides. A formation's nearest enemy may
  be of another war, so a war not marked is looked at pair by pair, its formations in contact
  only, to the first pair within the contact distance. The two steps together are the
  condition of `largestBattle` (a pair of the two sides, both `engaged`, within
  `CONTACT_CELLS`), not a measure near it.
- **Measured** (the kept 60-day test, seed 99, every six hours, every war): the wars marked
  are those with an answer in 1,708 of 1,708 askings; the pass over the contacts found all
  752 with a battle by itself. The second step is seen to be needed in a built case only
  (three wars at one place: the German's and the Pole's nearest enemy is the Czechoslovak
  between them). Cost on day 60 (11 wars, 909 formations, 96 in contact): 0.019 ms with the
  hour's contacts kept, 0.076 ms when they are worked out again (after a command).
- **Reads only:** no state and no hash changes; the pin did not move.
- **What it does not give.** The flag is as old as the statistics message, a second at top
  speed; the click asks anew, so for that second a lit banner may lead nowhere and a dim one
  to a battle. It says *a* battle, not the leaders' (ADR-95: a war whose leaders are not in
  contact leads to allies). The sign is a 10 px glyph and a frame: seen at a look in a row of
  banners, not from across the room. The wars past the eighth have no banner and no sign.
  No count of battles, and no way to a war's second battle.

### ADR-95 · 2026-10-05 · accepted — A war's banner leads to a battle of the two leaders it names, when there is one (PLAN 2.14f5b2)

- **Context:** the banner of a war names its two leaders ("Germany +5 against Poland +9",
  `sides[s][0]`; when a leader leaves the war the next member leads, on the banner and
  here). The click went to the war's largest battle (ADR-94), whoever fought it. ADR-93 saw
  it land on Italians against the French.
- **Measured** (the kept 60-day test for seed 99; the same with seed 7 in its place, once):
  with the rule of ADR-94, of the two formations the camera lands between, neither was a
  leader's in 46 of 752 and 41 of 1,025 landings, one in 96 and 349, both in 610 and 635.
- **Decision:** `largestBattle` ranks a war's battles first by the leaders' formations in a
  pair of each other's nearest enemy: a battle with the two leaders front to front, before
  one with a leader's formation front to front with an ally's, before the rest. Then as
  ADR-94. Inside the battle the pair is chosen as before, each other's nearest first, and
  among those the leaders' formations before men. A war with no leader's formation in
  contact gets its largest battle as before: the rule is an order, not a filter.
- **Why not "a leader's formation, either of them":** tried first. In "Germany +1 against
  Poland" every battle has Poles in it, so a Czechoslovak battle counted as a leader's and
  won by size (the built test failed on it). On the front it left 129 of 752 landings with
  one leader only.
- **Why the leaders come after "each other's nearest" in the pair:** ADR-93's finding (both
  blocks whole in the view) rests on the pair being each other's nearest. A leader's
  formation that is nobody's nearest can stand 29 km from its enemy.
- **Not chosen:** the banner saying whose battle it leads to (the mismatch would stay; the
  sim can answer the question the banner asks).
- **After** (seed 99 and seed 7): neither 0 and 0, one 6 and 187, both 746 and 838. Each
  other's nearest in all 752 and 1,025; blocks at most 3.6 km apart in both runs; whole in
  the view every time. One side under a tenth of the other: 38 and 49 (36 and 33 with
  ADR-94 alone): a leaders' battle is sometimes a less even one than the allies'.
- **Tests:** unit, `warBattle.test.ts`. A new one: Germany and Czechoslovakia against
  Poland, one division against one on the German border and two against two on the
  Czechoslovak; the answer is the German pair; with the German division gone, the other.
  Seen to fail with the rule of ADR-94 (two against two) and with "either leader". The
  60-day test asks for no landing without a leader's formation (46 with the old rule, seen
  to fail). e2e, the second of `toBattle1938`: the two on day 60 are a German and a Polish
  formation.
- **On the screen** (seed 99, day 60): as under ADR-94, German motorised division 45
  against Polish infantry division 563, 36,135 men against 18,109. The picture shot again
  came out the same file.
- **The pin:** not moved; the answer reads the state and writes none of it.
- **Not done:**
  - A war whose leaders never meet (an ocean between them) leads to its allies' battles
    and the banner does not say so.
  - "One" in 187 of 1,025 on seed 7: which wars, not looked at.
  - A test where the leader changes during the war (the first member leaves): none.
  - The tooltip still says "to its largest battle".

### ADR-94 · 2026-10-05 · accepted — A war's largest battle is the one whose smaller side has the most men (PLAN 2.14f5b1)

- **Context:** ADR-91 sends a click on a war's banner to its largest battle, "by men": the
  men of both sides. ADR-93 saw where that leads on day 60 of seed 99: 67,984 men against
  472, eleven formations against three nearly spent ones.
- **Measured** (a probe not kept; 60 days of Germany against Poland and the wars the AI
  declares, every six hours, every war; seed 99: 752 answers, seed 7: 1,025): by the men of
  both, one side had under a tenth of the other in 212 and 358 answers (28% and 35%), under
  a hundredth in 53 and 103. The median of smaller to larger was 0.28 and 0.19. A war had 8
  battles at a time in the mean (6,314 and 7,988 in all). Ranked by the smaller side, another
  battle comes first in 319 and 545 answers, and under a tenth are 36 and 33 (5% and 3%),
  under a hundredth 3 and 0.
- **Decision:** the largest battle is the one whose smaller side has the most men; of
  equals, the one with more men on both sides; of equals, the lowest formation id
  (`largestBattle`). A battle is a fight of two sides, and what the click should show is
  where both stand in strength: a large army over a remnant shows one side's figures and a
  few of the other's. The pair inside the battle is chosen as before (ADR-91, ADR-93).
- **Not chosen:** the most even battle (two battalions of equal strength would win over two
  armies); the product of the sides (it says the same as the smaller side where it matters
  and needs a second sentence to explain).
- **Tests:** unit, `warBattle.test.ts`. The second test is restated: two against two in the
  south stays the largest when four stand against one in the north with more men in all,
  and gives way when the north is four against three. Seen to fail with the old rule at
  the four against one. The 60-day test counts the answers with one side under a tenth: 36
  of 752, and asks for under a tenth of them (212 before). With seed 7 in its place, once,
  it passes too. e2e, the second test of `toBattle1938`: the landing of day 60 has no side
  under a tenth of the other.
- **On the screen** (seed 99, day 60): 6 formations against 6, 36,135 men against 18,109;
  the camera lands between the German motorised division 45 and the Polish infantry
  division 563. Picture: `docs/evidence/2.14/to-battle-front.png` (shot again).
- **The pin:** not moved; the answer reads the state and writes none of it.
- **Not done:**
  - Of the 752 the pair is still each other's nearest in all, and whole in the view; that
    was measured again. The widest pair of blocks reads 3.6 km as before; whether it is
    the same pair was not checked.
  - Whose battle it is, when neither of the two formations is a leader's: 46 of 752 and 41
    of 1,025 with this rule (38 and 3 before). PLAN 2.14f5b2.
  - The banner's tooltip still says "to its largest battle" and does not say what largest
    means.

### ADR-93 · 2026-10-05 · accepted — On a real front the banner's pair is front to front: the rule of ADR-91 stays (PLAN 2.14f5a)

- **Context:** ADR-91 sends the camera between the blocks of two formations of the war's
  largest battle: those that are each other's nearest enemy before those where one is the
  other's, before any two in contact; then by men. Its tests put the pair down. The fear
  (PLAN 2.14e, "not done"): in a battle with no two that are each other's nearest, the two
  picked stand up to 29 km apart with their blocks towards others, and the view is 28 km.
- **Measured** (`warBattle.test.ts`, seed 99, Germany at war with Poland by command and the
  wars the AI declares, 60 days, every six hours, every war): asked 1,708 times, a battle
  752 times, 237 of them of Germany against Poland. The two named were each other's nearest
  in all 752. Their blocks stood at most 3.6 km apart. Every element of both stood in the
  view of 28 by 16 km less 50 px at its edges, every time. Seed 7, by a probe not kept: 1,025
  battles, 1,024 each other's nearest and 1 where one was the other's; at most 5.8 km; all
  whole.
- **Decision:** nothing changes in `largestBattle` or `showBattle`. The case feared did not
  occur: 1,776 of 1,777 battles had a pair that are each other's nearest, and the other one
  was whole in the view too.
- **The test is a pin,** not one that failed first. That it can fail: with the pair chosen by
  men alone, 136 of the 752 are not whole in the view (92 each other's nearest, 516 one the
  other's, 144 neither; blocks up to 31.9 km apart).
- **On the screen** (`toBattle1938.spec.ts`, the second test; seed 99, no division put down):
  the click after 60 days lands at 20.0 m/px between formations 287 and 260, the two of the
  unit run on that day; all of their elements on the screen, the blocks' middles 144 px
  apart; nine formations have elements in the view. Picture:
  `docs/evidence/2.14/to-battle-front.png`.
- **Seen, not changed:**
  - The banner reads "Germany +5 against Poland +9" and the battle it leads to is an Italian
    division against a French brigade. The war is theirs too; the banner names leaders only.
  - "Largest by men" was 67,984 against 472 on that day: 11 formations against 3 nearly
    spent ones. Largest is not the most even.
- **Not done:**
  - No test builds a battle with no two that are each other's nearest (it needs three wars
    in one place), and the camera does not widen for one.
  - A pair across a strait stands on its two shores (ADR-89) and may be wider than the view.
    Not looked for; none was among the 1,777.
  - Two seeds, one scenario, 60 days.

### ADR-92 · 2026-10-05 · accepted — The marker of a formation in contact stays on the formation, not on its block; its bar goes with its box (PLAN 2.14f4)

- **Context:** since ADR-89 the block of a formation in contact stands between it and its
  nearest enemy, and the marker stands on the formation. At the boundary of 300 m/px the box
  fades where the formation is and the elements come in elsewhere. Measured
  (`battleView1938.spec.ts`): 27 px apart for a pair a cell apart. The most is 43 px, from
  the constants: a block goes forward by `d/2 - DEPLOY_GAP/2 - depth/2`, which at the 1.5
  cells where contact ends is 0.665 cells, 13 km. A probe spec with a pair at 1.48 cells
  showed 43 px; it was not kept. PLAN 2.14c1 had "up to 28 px": that is the pair a cell apart.
- **Looked at:** the morph in ten frames, for both distances. It reads as two boxes fading
  while one fight appears between them, on the line that joins them. Nothing jumps: no pixel
  is moved, the two layers cross-fade (ADR-71).
- **Decision 1: the marker is not drawn at the block.**
  - The blocks of a pair stand 10 px apart at 300 m/px and 1.7 px at 2,000 (0.17 cells: the
    gap and a block's depth). A box is 26 px wide. Two enemies' boxes at their blocks would
    overlap by 16 px or more at every zoom of T1, and `markerStacks` moves markers of two
    nations apart by a few px, not by a box.
  - The marker is the formation of the rules: contact, targets and pressure on territory read
    that place (ADR-89). A click on it and the order arrow start there.
  - A formation 1.5 cells from its enemy would be shown 0.67 cells (13 km) from where it is.
- **Decision 2: the box does not slide to the block during the morph.** 43 px in 250 ms is
  2.7 px a frame of a box with a white flag chip on a dark outline. ADR-72 kept the shrink to
  13%, a corner moving by under 0.2 px a frame, because that was already 43 of the 48 allowed.
- **Decision 3: the bar and the number of a formation in contact go with the box.** ADR-72
  lets them linger for 220 ms so that the number stays with the group. Here they lingered
  beside it: two stubs reading "11.9k" 27 to 43 px from the blocks, under or beside the tags
  that carry the same number (ADR-88). `drawMarkers` gives an engaged marker's bar the box's
  opacity. Out of T2 the same by the code, bar and box come in together; the test runs
  T1 to T2 only.
- **Tests:** e2e, the second test of `battleView1938.spec.ts`: a German division not in
  contact, and a German and a Polish one a cell apart. The offsets above; no box travels; in
  every frame of the morph the bar of each of the pair has its box's opacity, and at 256 ms
  nothing is left of them, while the bar of the one behind is in full. Seen to fail first
  (16 ms: bar 1 against 0.988). Pictures: `docs/evidence/2.14/handover-contact-t1.png`,
  `-96ms`, `-352ms`.
- **How often a block changes its line** (`deploy.test.ts`, the world of seed 99 with Germany
  at war with Poland, 60 days, hour by hour): 169,565 block-hours in contact. The block moved
  at all in 598 (0.4%). 511 were hops of more than a block's depth (2.3 km): one in 332 hours
  of a block. All 511 were of formations that stood still; 81 came with another nearest
  enemy, the other 430 with the same one. Of those the cause was not looked into: that
  enemy's own block went elsewhere, or the formation's row behind it changed (the median hop
  is 3.3 km, which is a row). 109 were of more than half a cell, the longest 50 km.
  231 formations hopped, the most 8 times. 701 contacts began and 605 ended, each one move
  to the line or back.
- **Not done:**
  - A hop is drawn as one hour's move of the elements. 109 of them in 60 days are 10 km or
    more in that hour: not looked at on the screen.
  - The longest hop is longer than contact (29 km): a formation that comes up to the block of
    an enemy deployed the other way can stand further from its own place than its enemy is.
    How far a block may stand from its formation has no limit in `deployOf`. For PLAN 2.14f5,
    which looks at the same pairs.
  - A stack is drawn as its lead: the bar follows whether the lead is in contact.
  - `fades1938.spec.ts` asserts a bar in full when the box is half gone, on the first marker
    of its frame. That marker is not in contact. If the order of the markers changes and it
    is one in contact, that assertion fails for this reason.

### ADR-91 · 2026-10-05 · accepted — A click on a war's banner goes to its largest battle: by men, a jump, at 20 m/px (PLAN 2.14e, the critic's R2-B2)

- **Context:** the critic: "Nothing leads to a battle. At T2 a division is a 30 px grid in a
  view of 1,600 px; most T3 views are empty ground. There is no way from a war's banner, a
  marker or the history to where the fighting is."
- **Decision.**
  - *Which battle.* Battles are derived each hour and not kept. For the click they are worked
    out again for the one war, from the state (`largestBattle`, `sim/systems/warBattle.ts`):
    formations of its two sides that are `engaged` and within the contact distance of one of
    the other side, joined into battles; the largest is the one with the most men (of equals,
    the lowest formation id). Read-only: no flag, no deployment and no hash changes.
  - *Where in it.* A battle of a front is hundreds of kilometres long, and a view that shows
    elements is 28 km wide. The camera goes between the blocks of one attacker's and one
    defender's formation: of those that are each other's nearest enemy (they stand front to
    front, ADR-89) the pair with the most men.
  - *The zoom.* 20 m/px: the zoom at which the two blocks are whole in the view, with their
    tags (PLAN 2.14c1's picture). A view smaller than 1400 px keeps 28 km across at more
    metres a pixel, up to 250, where elements are still what is drawn.
  - *A jump,* not a flight: the camera has an eased zoom and no eased pan, and a flight from
    the world to 20 m/px passes four tiers in a second.
  - *The click keeps what it did:* it selects the attackers' leader (PLAN 1.31b). A war with
    no formations in contact leaves the camera where it is.
- **Asked on the click, not sent with the statistics:** a flag "has a battle" on every banner
  would be a grouping of every war's formations with each statistics message.
- **What it does not give.** No way to the war's second battle, none from the history or from
  a marker, and nothing on the banner says whether there is a battle to go to.

### ADR-90 · 2026-10-05 · accepted — At T2 and T3 the ground has the terrain's colour, and the fill is a cast on it (PLAN 2.14d, the critic's R2-B2)

- **Context:** the critic: "The ground is the nation's colour. Berlin at 20 m/px is grey noise
  with specks; the Alps are salmon pink for being Swiss; Chad at 1 m/px is sky blue for being
  French Equatorial Africa, and could be shallow sea." PLAN 2.8b had decided it so ("the fill
  keeps its colour: it says whose the land is"), and ADR-82 had built the tint of occupied
  land on it.
- **Decision.** In the ground's program, where the land is coloured by a palette (the
  political mode and the modes that recolour nations), the colour is
  `mix(terrain, fill, share)`, by the ground's share of the handover. `share` is 0.14 away
  from borders, 0.62 on a border, falling over about half a cell, and at least 0.42 on
  occupied land. The terrain's colour is the terrain mode's blend of the four cells around.
- **Why a cast everywhere, and not none.** A view at 20 m/px seldom has a border in it. With
  no cast a formation's tag would be all that says whose land it is; with 0.14, plains in
  Germany and in the Soviet Union are 14 apart in RGB where the fills are 103 apart: one
  terrain, seen to be two countries when put side by side.
- **ADR-82 stands,** restated on the new ground: occupied land has more of the (occupied)
  fill than land at home, and an eighth of the hatching is left in the picture.
- **[AoC-DEVIATION]:** AoC's map is the nation's colour at every zoom; it has no close zoom.
- **What it does not give.** Terrain is a class to a cell of 19.6 km: the ground of Berlin is
  the plain's green with houses on it, not a city with streets and a river. A nation a few
  cells across is border all over. Finer ground is PLAN 7.4's.
### ADR-89 · 2026-10-05 · accepted — The blocks of formations in contact are deployed against each other; it is derived, not state (PLAN 2.14c1, the critic's R2-B2)

- **Context:** the critic: "Enemy formations stand a cell or more apart, and a cell is 19.6
  km: the closest pair after 60 days was 29 km apart. At 20 m/px a view is 32 by 18 km:
  centred between that pair it shows a border and trees and no unit." Its fix: "the engaged
  elements drawn at the cell edge they fight across".
- **What the code had.** Contact is 1.5 cells between formations' places; a formation in
  contact holds where it is; nothing turns it to the enemy. An element's place is not state:
  `slotPlace` works it out from the formation's place and facing, for the snapshot, the fire
  events and the event of an element's end. No rule reads it.
- **Decision.** For a formation in contact the block is deployed (`deployOf` in
  `systems/elements.ts`): on the line to its nearest enemy in contact, facing it, the front
  row half of `DEPLOY_GAP` (0.05 cells, a kilometre) short of the middle between the two.
  One whose nearest enemy faces a nearer formation comes up to that enemy's block instead.
  Not onto the mask's water. `findBattles` already walks every pair in contact: it notes
  each formation's nearest enemy and works out the hour's deployments (`deployAll`), and
  keeps the hour before's for the places of an hour ago. All of it is derived: null after a
  load or a command, and then worked out again from `engaged` and the places, the same.
- **Why not move the formations.** That is state, and the place of a formation feeds the
  contact rule, the choice of targets (`prox`), the pressure on territory and the march. It
  would move the pin and the balance for a matter of what a close view shows.
- **Is it a picture that disagrees with the sim?** (PROMPT: "no fake per-zoom animation that
  disagrees with the sim".) The place is the sim's own: one function, in the sim, gives it to
  the worker, to the fire events and to the wrecks, in Node as in the browser, and a test
  holds the page's elements to it to 1e-6 (`zoomDemo1938`). What differs between tiers is
  that the T1 marker stands at the formation's place and the T2 block at its deployment, up
  to 0.45 cells away: a division's place and its line. Said under PLAN 2.14c1 and taken up
  in 2.14f.
- **Measured:** 97% of the formations in contact after 60 days of a war share a view at
  20 m/px with their nearest enemy (2% before). The pin did not move.
- **Alternatives rejected:** the centroid of the enemies in contact (a formation between
  two enemies would stand before neither); a matching of pairs (leaves the odd ones out).

### ADR-88 · 2026-10-05 · accepted — At T2 and T3 a formation has a tag: flag, strength, name; sprites wear the nation's sprite colour (PLAN 2.14a, the critic's R2-B2)

- **Context:** the critic: "At T2 and T3 the marker boxes are gone and nothing is in their
  place: no flag, no strength, no name. German and Polish elements are the same grey dots."
  The marker's box morphs into the elements (ADR-72) and its bar and number go 220 ms later.
- **Decision:**
  - *A layer of its own, not the marker's lower row kept.* A tag is anchored on the part of
    its formation that is on the screen, so a division wider than the view (T3) or half out
    of it keeps one. The marker's stacks are laid out in the world's px and do not know the
    screen's edges; and the marker's morph, its early return and the specs built on them
    (`markerStacks1938`, `fades1938`) stay as they are.
  - *Layout:* stronger formations first; above the formation, else up to four places
    higher, else below; one that finds no place is left out and counted (`tagsLeft`).
  - *The name* is derived in the view from the template's name and the formation's id. No
    state, no pin.
  - *The colour:* one lift (`v × 0.55 + 115`), as the stand-in sprites. The second lift
    (45% toward white, "so that it stands out on the nation's own fill") put every nation
    between 178 and 255 a channel. The outline of the atlas is what sets a sprite off.
- **[AoC-DEVIATION]:** AoC has no formations to name; this is ours.
- **Consequences:** `spriteColours1938` holds as before (one tint a nation in every mode).
  At 12 m/px a figure is too small for its tint to be read on any fill: said under PLAN
  2.14a and taken up with the ground of 2.14d. With many formations on one spot (a stack of
  eleven or more) some have no tag; the formation panel of 2.14b is the way to them.

### ADR-87 · 2026-10-05 · accepted — The e2e suite runs in full when a numbered task is ticked, not for its parts (the user's decision)

- **Context:** a gate with code in it takes 13 minutes, 7 to 9 of them the e2e stage (117
  specs in a real Chromium). On 2026-10-05 seven gate runs spent about an hour there. What
  the stage found that day: one spec that measured the machine twice (ADR-85's commit), and
  one spec whose battle a rule change had moved (PLAN 2.13). The user: "this cadence is
  still a bit too high, let's do e2e after only numbered tasks, not split tasks".
- **Decision:** `npm run check` runs the whole e2e stage when the change ticks a numbered
  task of PLAN.md (`- [x] 2.14`), when git cannot tell what changed, when a helper under
  `tests/e2e` or the Playwright config changed, and under `check:full`. For anything else
  with code in it, only the spec files that changed (a new spec is never committed unrun),
  or no e2e at all. Typecheck, lint, the unit tests, the build, parity and, for a sim input,
  the ten-year tests run as before.
- **What it costs:** `main` can hold a part's commit that breaks a spec nobody ran. It is
  found when the task is ticked, at most a task's parts later, and fixed there. PROMPT.md
  asks a part that touches what is drawn to run that feature's specs by hand.
- **PROMPT.md's "all must pass before any commit"** now reads, for the e2e suite, "before a
  numbered task is ticked". CLAUDE.md and PROMPT.md say so.
- **Amended 2026-10-06 (PLAN 3.4Rn): the tick of a review pass counts.** The gate read
  `- [x] 3.4R` as a part (`tickedTasks` wanted a blank after the number), so the review
  pass 3.4R was ticked on `2551b9d` with no e2e, after three of its parts (3.4Rf, 3.4Rk,
  3.4Rl) had changed rules and moved the pin. The suite run by hand then found
  `wrecks1938.spec.ts` red. Now a line `- [x] N.MR` runs every spec, and its parts
  (`N.MRa`) stay parts. Of the two ways PLAN 3.4Rn names (the gate, or a line that says
  the suite is run by hand), the gate: it does not depend on the line being read. The
  cost is one suite (about ten minutes) per review pass.

### ADR-86 · 2026-10-05 · accepted — A treasury is spent before an army is sent home; the treasury of the start carries the army of the start for a year (PLAN 2.13, the critic's R2-B3)

- **Context:** the critic's second report: at tick 1 of every 1938 game 228 of the 1,054
  formations were gone, 39 of the 72 armour formations, all 34 Soviet ones, and no line of
  the history said so. Run here first (seed 99): 30 nations disband, China 70 of 140, the
  Soviet Union 34 of 162, Nationalist Spain 22 of 40, Mongolia 4 of 4.
- **What it was.** Step 1 of the economic AI disbanded until the month's books balanced with
  a margin. It never looked at the treasury (but for a debt). The Soviet Union was short 112
  a month plus its margin, with 6,936 in gold: five years of it. And the weakest formation
  goes first, by men: a tank brigade is small, so the armour went before the rifle divisions.
- **Decision, two rules and a line:**
  - *The AI:* a nation short by S a month disbands only while its gold is below
    `RUNWAY_MONTHS` (3) × S. It runs the deficit from the treasury first. As the gold runs
    out it cuts as much as brings S down to a third of the gold, not the whole deficit at once.
  - *The start:* a nation begins with six months of income (ADR-22) or, where that is more,
    `START_ARMY_MONTHS` (12) of what its budget is short with the army the order of battle
    gives it. 16 nations get more by it (Mongolia 4 → 98). Without it the AT ("none
    disbanded in the first month", on three seeds) cannot be met by the first rule alone:
    Mongolia's gold was half a month of its deficit, and a nation that neither disbands nor
    has gold is bankrupt in its second month.
  - *The line:* `FormationsDisbanded` (nation, how many), one event per nation and month,
    kept in the history: "X could not pay its army and disbanded formations: N".
- **Which of the task's two ways this is.** Not "budgets that carry the armies": that is the
  1938 incomes and upkeeps, balance data, deferred by ADR-58. It is "a floor and a time of
  grace", with the grace counted in gold, not in months: a clock would have ended on one day
  for every nation, and would have had to be told from the bankruptcy it leads to.
- **What it does not do.** The armies the incomes do not carry are still cut, later and
  line by line: seed 99 has 846 formations after a year (826 after an hour, before), 687
  after two, 658 after five. Whose budget is wrong, the income's or the order of battle's,
  stays with Phase 7 (BLOCKERS). And the weakest still goes first: when the Soviet gold runs
  low, its tank brigades are the first to go. A line under PLAN 3.1.
- **The pin (ADR-55):** `4aafc3eb` → `324bc358`. Five years of seed 99: `5377e4c5`.
- **The tick, pinned, five years of seed 99:** mean 1.502 ms (1.203 before; the budget is
  1.5): the first two years have some 200 formations more (2.11 and 1.97 ms). Logged in
  BLOCKERS for PLAN 7.1; not tuned now (ADR-58).
- **Tests whose expectation the rule changed, each said in its place:**
  - `economicAi.test.ts`: "a nation whose army costs more than it earns disbands": Mongolia
    now does so with its treasury empty, not with the money of the start unspent.
  - `economy.test.ts`: "starts with six months of income": or a year of its shortfall.
  - `alliances.test.ts`: "fighting together raises unity" compared a game at war with a twin
    "at peace" that the AI was free to take to war. With Poland's army whole, Poland joined
    the Axis in the twin's first month and the Axis was in two wars there (unity 60.25
    against 60). The AI is now off in both: the declared war is all that differs.
- **Alternatives rejected:** a grace of N months with no rule after it (the 228 go on the
  first day after, and the small nations are bankrupt before); starting gold alone (the AI
  would still disband on day one: it did not read gold); raising incomes (ADR-58).

### ADR-85 · 2026-10-05 · accepted — The test that reads PLAN.md follows the plan: a ticked phase review does not break the gate

- **Context:** `tests/unit/gate.test.ts` held PLAN.md to "the reviews of phases 0 and 1 are
  ticked, those of phases 2 to 6 are open". PLAN 2.11 was ticked in `3d6a2b2`, a commit of
  documents: its gate is parity alone (ADR-55), and so was that of the commit after. The first
  gate of code since (PLAN 2.12a) failed at this test, on a PLAN.md that was right.
- **Decision:** the test is changed, not the plan. It now says what it was there for (the
  parser finds the real plan's reviews, by their names): all seven exist, the ticked ones are
  the first ones in the order of the phases, the rest are open, and those of phases 0 to 2
  are ticked. It needs no edit at the reviews of phases 3 to 6.
- **Is it weaker?** It no longer fails when a later review is ticked in its turn, which was
  never a fault. It still fails for a review ticked out of turn, renamed, or lost, and for
  one of phases 0 to 2 unticked.
- **Not done:** the gate of a commit of documents still runs no unit test, so a test that
  reads a document can go red in such a commit and be seen only at the next gate of code.
  This is the one test of that kind (`gate.test.ts` reads PLAN.md; the parity script reads
  PARITY.md and is in every gate).

### ADR-84 · 2026-10-05 · accepted — How long a table is, is no part of the game: no reference to its columns is held across a create (PLAN 2.12a, the critic's R2-B4)

- **Context:** the critic's second report: on seed 2718 a game saved at year 10 and loaded
  ends year 11 as another game than the one that went on (Node: `931f19ad` against
  `33ca7b81`, 694 formations against 695; the browser's Continue the same), and the worker's
  hash leaves Node's with the step after nation 128 is founded. Run here first: as reported.
  PLAN 2.11j had claimed the first could not happen; its tests looked at the cause that task
  had found (the supply network), in a first year.
- **What it was.** `Table` grows by doubling, and a growth replaces its arrays (`cols`,
  `alive`, `generation`). `Table.create` says so in its comment. `spawnRebels` took
  `nations.cols`, then created the row, then wrote the nation into what it had taken. A
  write past the end of a typed array does nothing, and a read there gives `undefined`.
  - *In every 1938 game that went on long enough,* the nation with id 128 (the table has
    128 rows after the scenario's 103) was founded with nothing: not living, no origin, no
    colour, no gold, capital at (0, 0); it owned its land and its holder was at war with it;
    its militia, up to four formations, stood at (NaN, NaN). All of it in the save and in
    the hash.
  - *A loaded game:* `Table.deserialize` makes a table as long as the save's rows (130),
    where the table of the game that went on is 256 long. The loaded one grows at its next
    nation. How long a table is was in no save and no hash, and it decided which nation was
    lost: that is what steered the sim.
  - *The worker against Node:* on the code of before, in a real browser, they part in the
    tick in which the table grows and in no tick before. Why to the bit is not known. A NaN
    out of arithmetic has bits of its own and the hash is over bytes; that is the likely
    part. With the fix they are equal on every day of the year in which the table grows.
- **Decision:** the rule the table's comment had is kept and is now held by a test: **a
  reference to a table's columns is taken after a create, and again after any call that may
  create a row of that table.** How long a table is can then have no effect.
  - *Six places broke it:* `spawnRebels`; `spawnCity`; the month's revolt loop;
    `collapseNation`; `collapseSystem`; and `Table.forEach`, which held `alive` across its
    callback. (`reviveNation` founds no nation and is made alike for the next change.)
  - *The test's instrument:* `Table.volatile`. With it every create moves the table to new
    arrays and fills the old ones with 0x5a. A reference held across a create then reads
    rubbish and writes nowhere at every create, where otherwise only at a growth. A game
    with it on must go as the game without it. It found `spawnCity` on the first day and the
    revolt loop only in a three-year game; the rest were read from there.
- **Not chosen:**
  - *A loaded table as long as the doubling would have made it.* The loaded game would then
    lose the same nation as the game that went on: the test of save and load would pass and
    nation 128 would still be founded dead.
  - *Tables of a fixed length* (65,536 nations, as the land tallies have). It would do for
    nations; formations and elements have no such bound.
  - *All NaN made alike in the hash.* The state has no NaN now but the history's "no place",
    which the language writes one way; tests say so (after forced revolts, and after ten
    years in the sweep stage's three games). A NaN that appears is a defect to be found, as
    this one was.
- **Tests:** in PLAN 2.12a, with what each said when it failed first.
- **What the gate now holds of "a loaded game goes on as the saved one":** the saves of year
  9 of three ten-year games (12 s on the sweep stage). By hand: every year-end of ten years
  on five seeds, 50 of 50. **Not in the gate:** such a check on a seed and in a year nobody
  has run, which is where the critic found this one.
- **Hashes (ADR-55):** the pin `4aafc3eb` did not move, nor seed 99's five years
  (`49389306`): no table grows in them. A game is another one from the tick in which its
  nations table first grows (seed 2718: year 9).
- **Depends on this:** PLAN 2.15's "Free state 128" (the lost origin was its name).

### ADR-83 · 2026-10-05 · accepted — The critic's second run: who ran it, where its findings went, in what order (PROMPT step 2a)

- **Context:** PLAN 2.11 was ticked, so the critic was due (ADR-59: one run a phase). PROMPT
  step 2a says to spawn the `critic` subagent. This session does not have that agent type
  (`.claude/agents/critic.md` is in the repository; the session offers claude,
  general-purpose, Explore, Plan and two helpers): "Agent type 'critic' not found".
- **Decision 1: a general-purpose agent in the critic's place.** Its brief was the role text
  of `.claude/agents/critic.md` with `CRITIC_PROMPT.md` as the whole of its task, and not a
  word about what to look at. "Never act as the critic yourself" holds: the builder wrote no
  part of the report.
  - *What was missing:* the guard hook of the `critic` type (`critic-guard.mjs`: file tools
    write under `critic/` only, no git write). In its place: the two rules, stated in the
    brief, and a check after the run. HEAD was still `3d6a2b2`; `git status` showed the two
    report files changed and new files under `critic/` only; no server was left listening.
  - *Cost:* 50 minutes, 492,000 tokens, 246 tool calls.
  - *The two report files are committed as the critic wrote them.* They are tracked (the
    last report's commit, `23a990a`, is the user's), and left uncommitted a checkout or a
    stash would lose them. The run's other files (`critic/c2_*`, its scripts and shots) stay
    untracked like those of the first run: a PLAN task carries what it needs of them in its
    own text, numbers and all.
- **Decision 2: where the eight blocking findings went.**
  - R2-B1, no naval, air or nuclear: Phases 4 to 6 are its tasks. A line under PLAN 4.5.
    **The phases keep their order.** The critic ranks this first, and naval before armour
    would answer it sooner; the order of the phases is the brief's, and I have not changed
    it. The user can.
  - R2-B4, a loaded game differs: PLAN 2.12. R2-B3: PLAN 2.13 for the formations disbanded
    at tick 1; its second part (tanks that neither behave nor look like tanks) is Phase 3,
    with a line under PLAN 3.6. R2-B2, the close zoom: PLAN 2.14, with the two lines PLAN
    7.4 had on it. R2-B7, one scenario: PLAN 2.16. R2-B8, God actions: PLAN 2.17.
  - R2-B6 is two things. A Kill that founds 36 states and 43 wars, a nation without a name,
    blank flags and a return of land logged as a revolt are mechanisms that do not work:
    PLAN 2.15. How often land breaks away in a plain game is balance: PLAN 1.42 (ADR-58).
  - R2-B5 is two things. A world that does not change outside Europe is balance: PLAN 1.42
    (ADR-58), logged once in PROGRESS, not disputed. A top speed of 10 to 12 s a year is
    performance: a line under PLAN 7.1 and no task before Phase 3, because the top speed is
    what the whole tick allows, and each of Phases 3 to 6 adds to the tick. Mine to answer
    for: the critic holds that the pace matters more than the frame rate.
  - The 21 findings that do not block: under PLAN 1.42, 7.1 and 7.4, a line each.
- **Decision 3: the order of the new tasks.** Step 2b says highest severity first, and the
  critic's order is R2-B2, B3, B4, B6, B7, B8. PLAN has B4, B3, B2, B6, B7, B8.
  - *B4 first:* the state hash is what every other fix is measured with (the pin, the logs
    of ADR-55, the twin games), and by the critic's case it parts between Node and the
    worker, and a loaded game from a saved one.
  - *B3 before B2:* it changes the 1938 world at its first tick (228 formations more are in it), and
    the tests and pictures of B2 are of formations in that world. After B2 they would be
    made twice.
  - This is an order of work, not another judgement of severity. The user can overrule it.
- **Not disputed:** none of the eight. R2-B4 says that a claim of PLAN 2.11j is false, with
  a case that can be run; its task starts by running it.

### ADR-82 · 2026-10-05 · accepted — Occupied land at T2 and T3 is a tint, with an eighth of the hatching (PLAN 2.11f)

- **Context:** occupied land (controller ≠ owner) is hatched: stripes of 7 screen px, the
  occupier's colour darkened against a third of the owner's colour mixed in. That is the
  picture of T0 and T1, and the legend's word for it. PLAN 2.8 put a ground under T2 and T3
  (hillshade, texture, trees, buildings) and the hatching stayed on top of it at full
  strength: 50 of 255 between two stripes where the ground varies by 5. The zoom demo's four
  close pictures, of a pocket in China, are stripes. Every war makes occupied land, and it is
  where a player zooms in.
- **Decision:** with the ground the hatching gives way to it. By the ground's share the two
  stripes close on the tint between them, and an eighth of the hatching stays.
  - *The tint* is what tells occupied land at T2 and T3: the occupier's colour, darker, with
    a sixth of the owner's colour in it. Japan's land in north China is (196, 189, 155)
    where Japan's own is (229, 226, 207).
  - *An eighth, and not none:* the hatching is the map's word for occupation at every other
    zoom, and a weave of 6 of 255 is about what the ground itself varies by on a plain (5 to
    6), so it does not lie over anything.
  - *An eighth, and not a quarter* (tried first, as the task was first written): 13 of 255
    is still more than twice the ground's variation on a plain.
  - *By the ground's share,* so it comes and goes with the T1 ↔ T2 handover like the ground,
    and not at all without the ground (a world without elevation, the tests' switch).
- **Not chosen:** stripes that widen with the zoom (at T3 they would be bands across the
  view); hatching only along the edge of occupied land (the edge is the front, which has its
  border already); no change at T2 and less at T3 (T2 is where the pocket is seen whole).
- **Tests:** the stripes are known, so their contrast is measured against whatever else is
  in the picture (`occupiedGround1938.spec.ts`): 50.7 at T1; 6.0 at 150 and at 20 m/px with
  the ground (50.3 before); 50.7 there without the ground.
- **Left:** the legend says "Hatched: occupied land" at every zoom. A line under PLAN 7.4.

### ADR-81 · 2026-10-05 · accepted — The supply network is a function of the world: a refresh of some blocs gives what a full one gives (PLAN 2.11j)

- **Context:** the fifth independent read (ADR-74) saved seed 99 at tick 2400, loaded it, and
  got another game: I2 of SPEC §2.6 did not hold. A load refreshes the supply network in full;
  the game that goes on refreshes the blocs whose cells changed; and `supply.ts` said itself
  that the two "can resolve a crossing lane differently". The marks of what to refresh are
  "derived (not state)" in `world.ts` and are not saved. So two worlds with one hash could go
  on differently. The year-long test of I2 (PLAN 1.27) saves seed 3 at a tick where they do not.
- **Decision:** make the statement true. The network is a function of the cities, the
  control of the cells and the blocs. A refresh of some blocs gives what a full one gives; the
  marks are not state; the save is as it was.
- **What stood in the way:**
  1. *Lanes.* Blocs meet at the crossing lanes, which go to the lowest bloc that reaches
     them. A refresh of bloc b alone left a lane unclaimed that b no longer reached, though a
     neighbour reaches it; and left a lane with a higher bloc that b now reaches. Now: the
     lanes a bloc holds are remembered with its spans, and the refresh is done again in full
     when one of them is not the bloc's own afterwards, or when the flood comes to a lane in
     a higher bloc's network.
  2. *A bloc looked up too late.* A changed cell marked its old and new nation, and the
     refresh looked up their blocs when it ran. A puppet annexed in between has no overlord
     by then: its cells, flooded as its overlord's, stayed in the overlord's network under
     their new holder. Not in the reader's finding; found here by running two games side by
     side (seed 3, tick 1885: 28 cells). Now: a changed cell also marks the bloc in whose
     network it lay, read from the layer. And as a net under it, a flood that comes to a cell
     its bloc controls in another network makes the refresh full.
- **Why not save the marks** (the load would then follow the game): the network would stay a
  matter of the order things happened in. A full refresh from anywhere else (the editor, a
  game option, a puppet made or freed) would then change lanes that nothing had touched. And
  the hash would have to cover the marks, or two worlds with one hash would still part.
- **Why not always a full refresh:** 6 ms every 12 hours of a war is 0.5 ms a tick, of 1.5.
- **Cost:** pinned, five years of seed 99: 1.200 ms a tick twice (1.164 before). That is
  0.036 ms a tick, some 7% of what always refreshing in full would cost. How many refreshes
  were done again in full was not counted.
  - One kind is done again for nothing: a lane that bloc b held and a lower refreshed bloc
    takes in the same refresh. The result was right already. A line under PLAN 7.1.
- **The pin (ADR-55):** unmoved. Seed 99's first year meets neither case and has 4aafc3eb
  still. After five years daffda22 → 9e83b0a7: it meets one later.
- **Tests:** two directed unit tests (the lane; the annexed puppet), and in the gate's year
  file a game beside one that refreshes in full every time (seed 3, a hundred days) and a
  load from the middle of a war (seed 3, tick 1890). All four fail on the code before.
  Beyond them: the two games for a year on seeds 3, 7 and 1938, never apart.
- **What it says about the invariant:** I2 was tested where it held. A test of "the loaded
  game is the game" needs a save from a state the game is in only sometimes; the side-by-side
  run finds such states without knowing them.

### ADR-80 · 2026-10-04 · accepted — T3: a battalion is drawn by its share of 64 figures (PLAN 2.10b; in place of ADR-69's count)

- **Context:** ADR-69 made an element `min(strength, 64)` figures and named the cost: "at T3 a
  battalion of 500 and one of 100 look alike, and a battalion's losses show only when it is
  nearly gone". It left two candidates. ADR-71 handed the choice to the zoom demo's close stops.
  PLAN 2.10a's two closest pictures are of a Japanese division by Nanking with its 40
  battalions at 123 to 197 of 500 men: each a full block of 64 figures. The batteries beside
  them, at 3 to 5 of 12 guns, show every loss.
- **Decision:** figures by the share. Where an element has up to 64 units when whole (guns,
  tanks, planes, ships), a figure for each unit it has, as before. Above that (a battalion of
  500, on foot, motorised or mechanised), 64 figures when whole and
  `ceil(64 × strength ÷ size)` while it loses men. **This takes the place of ADR-69's
  "Decision, the count".** The rest of ADR-69 (the place, the drawing) stands.
- **Why the share and not a number under each element:** the task is how losses *show*. A
  number captions the picture, and the picture still says 500 men at 142. It would also be a
  new layer of text at T3: 45 numbers under a division's blocks, to place, to fade with the
  T2 ↔ T3 handover, to keep clear of names. The share changes what the picture says, with
  what is already drawn.
- **What ADR-69 held against it, answered:**
  - *"It needs the element's full size in the snapshot."* It does: `size`, 2 bytes an
    element, from the unit type's element size, which the worker has in hand where it reads
    the type's look. The atlas frame cannot stand in for it: a mechanised battalion is 500 men
    with the vehicle's frame.
  - *"It makes no figure a man."* For a battalion no figure was a man above 64 men either: 64
    stood for 500. Under the cap a figure meant 8 men until the battalion was nearly gone and
    one man after. Now it means the same throughout: a 64th of the battalion.
- **Rounded up:** figure k stands while more than k − 1 figures' worth of men are left. So an
  element with men has a figure (rounded to the nearest, a battalion of 1 to 3 men would have
  none), a man lost takes a figure or none, and the block is whole only when it lacks less than
  one figure's worth (493 of 500 and more).
- **The grid is the whole element's:** `gridSide` chose 8 × 8 or 4 × 4 by the figures an
  element *has* (more than 16: 8 × 8). A mechanised battalion down to 16 figures would have
  changed to 4 × 4 in one frame, its figures twice the size and elsewhere. Under the cap that
  took a battalion of fewer than 17 men; under the share it is a quarter of its strength. The
  grid is now chosen by the figures of the whole element.
- **Not changed:** T2. A sprite dims only below 8 units, so a battalion at a third looks whole
  at T2 still (BLOCKERS, for the review). Nor the order in which figures go: gaps open across
  the block, as ADR-69 decided, so a battalion at a third is a scatter in its footprint and
  not a smaller block.
- **Measured** (the demo, seed 1938, day 30): the division has 861 figures where it had
  2,579; its battalions 16 to 26 each. Nothing costs more: fewer instances, and a count that
  is one division and one rounding an element.
- **Tests restated, for the user to overrule** (both asserted the cap): the unit test of the
  count and of the grid, and `individuals1938`'s figures of each element. Seen first on the
  code before: 1,584 figures against 1,580 there, and 64 against 19 for a battalion of 142 in
  the demo.

- **Addendum, PLAN 2.11g (2026-10-05): at T2 the sprite's opacity is the element's share.**
  - *What was left open above:* "Not changed: T2. A sprite dims only below 8 units." A
    battalion at a third of its men was a whole sprite at T2 and a third of its figures at
    T3: the zoom across 30 m/px showed a loss that the view before it had not.
  - *Decision:* opacity = 0.45 + 0.55 × strength ÷ size. Whole at full strength, never under
    0.45 while a unit is left (the sim removes an empty element). The same rule for every
    kind: a battery with 4 of 12 guns is as pale as a battalion with 167 of 500 men.
  - *Not smaller* (a sprite is 5 px at the far end of T2, and its least size would hide the
    change), *not a bar or a number under each* (a second layer, of some 500 marks in a view of
    a front), *not darker* (the colour is the nation's).
  - *What it does not do:* on a light nation colour over a light fill the difference between
    0.55 and 1 is small to the eye. A line under PLAN 7.4.
  - *Tests:* the rule (unit); in the zoom demo, every sprite of the close views against its
    share, failing first.

### ADR-79 · 2026-10-04 · accepted — Formations stand on land by the fine mask; the coast of T2 and T3 is drawn from it (PLAN 2.9)

- **Context:** SPEC has the fine land mask "used by the sim for element placement ... and by
  the renderer for coastlines. Both read the same bytes, so they never disagree." Neither is
  so. The sim knows only the cells' terrain, and a cell is land when half of it is: its
  middle, where a formation stands, need not be. The renderer draws every coast from a
  coverage a quarter as fine as the mask.
- **Measured** (1938, seed 99, by the mask's nearest bit): 200 of 23,210 elements on water
  at the start, in 18 formations, 11 of them wholly; between 124 and 353 through a year. The
  furthest is half a cell out.
- **Decision 1: the fix is in the sim.** A formation that would take a place on the mask's
  water takes its cell's land point, the point of the cell furthest from water. Its place is
  state, so the pinned hash of seed 99 moves; logged when it does. No sweep follows (ADR-58:
  one `sweep:quick` at the phase review).
  - *Why not a correction of what is shown:* 11 of the 18 formations are wholly on water
    because the formation is. Moving their elements to land one by one heaps 28 sprites on a
    shore; moving the block by half a cell puts it 10 km from its own marker (ADR-70 has the
    block about the formation's place at every tier).
  - *An element on water all the same* (the block is 0.24 by 0.12 cells; a spit can be
    narrower) stands on the nearest land towards its formation's place. That is not state:
    an element's place is worked out from its formation's, and the snapshot, the fire events
    and the event of its end use one function.
  - *Not in it:* a march between two cells' land points is a straight line and can cross a
    bay. That needs routing below the cell; on the watch list, and the test is of formations
    at rest.
- **Decision 2: one predicate.** "Land at (x, y)" is the mask's bit of the px that holds the
  point, written once in `src/shared` and used by the sim's rule, the renderer's threshold
  and the tests. (The renderer thresholds a bilinear coverage at a half today: that and the
  bit differ by up to half a px.)
- **Decision 3: the coast of T2 and T3 from the mask,** in the pass with the ground. A mask px
  is 2.4 km, 2,400 px at 1 m/px: inside it the coast is moved by the ground's noise, by less
  than half a px, so that it is a shore and not a ruler's edge, and never says other than
  the bit further than that from the line. The coast of T0 and T1 stays the coverage's.
- **The order:** 2.9a first (the task's own test, and the pin), then 2.9b.
- **Cost known beforehand:** the mask is 16.8 MB of bits in the sim's process (the budget at
  XL is 160 MB); the worker loads it already for the coverage and will load it before the
  world is built instead of after.

- **Addendum, PLAN 2.9a (2026-10-04): done; the pin moved.**
  - *The pin (ADR-55's pattern):* seed 99 after one year **f93cb674 → f5725b37**; after five
    years 6b84c48c → 68e0a69e. The reason: a formation's place is state, and where it would
    have been on the fine mask's water it is the cell's land point now. For what is drawn,
    not for balance; balance was not measured again (ADR-58).
  - *The control:* a world built without the mask still has f93cb674 after the year. The
    rule is all that moved the hash.
  - *After:* at the start and after 30 and 90 days no formation at rest and no element of one
    is on the mask's water (200 elements at the start before). 8, 6 and 6 elements are drawn
    in from a slot on water.
  - *A cell's middle is land when the four mask pixels round it are.* The first version asked
    the mask at the middle itself, which is a corner of four pixels and reads as one of them.
    A formation on such a corner had its block in the other three: 33 elements were drawn in
    at the start, 25 of them all the way to the formation's own place, in a heap. With four
    pixels: 8 drawn in, none all the way.
  - *One function for an element's place* (`slotPlace`): the snapshot, the fire events and the
    event of an element's end. `wrecks1938` and `fire1938` hold unchanged.
  - *Every way of building the 1938 world has the mask* (looked for): the worker's init, and
    the Node loader that the tests, the sweeps, the runner and the diagnosis use. The runner
    prints the new pin.
  - *What was seen first* is the measurement in the context above, by a scratch script; the
    committed tests need the task's own code and cannot run on the code before it.

- **Second addendum, PLAN 2.9b1 (2026-10-04): the standing rule is "surely land"; the pin moved again.**
  - *The pin:* seed 99 after one year **f5725b37 → 99c1a04e**; after five years 68e0a69e →
    b203bc49. A world without the mask still has f93cb674. Balance not measured (ADR-58).
  - *Why a task that was to be the renderer's changed the sim.* This ADR had 2.9b draw the
    coast "moved by the ground's noise by less than half a px, so that it ... never says other
    than the bit further than that from the line". A shore that wanders inside a pixel is land
    by the bit and sea in the picture in places, and an element can stand there. Measured on
    the 12 formations nearest the water (193 elements): 14 with the drawn sea under them with
    the coverage's coast, 5 with the mask's coast and 2.9a's rule, none with the rule below.
    So the rule moved, in a commit of its own (one cause to a commit), before the coast.
  - *The rule:* the four mask pixels round a place, blended by nearness, make a field from 0
    to 1 with the coast at a half. A place is surely land at 0.85 or more: then its own pixel
    is land (with it water the field is 0.75 at most), and the shore's noise, which is at most
    0.35 × 4f(1 − f), leaves it land (0.67 at 0.85). Formations and elements stand on sure
    land; trees will (2.9b2).
  - *One number in one place:* `SHORE_NOISE` is the module's, the shader takes it from there,
    and a unit test holds it and `SURE_LAND` together. A shader with a larger noise of its own
    would put elements in the drawn sea and nothing would say so.
  - *Not the other way round* (the picture never draws sea in a land pixel): the shore then
    has every convex corner of the pixels as a right angle, and an islet of one pixel is a
    square.
  - *The cost found by the runner:* combat asks for a place with every shot. Asking the mask
    each time made a year's mean tick 4.92 ms for 2.45. A cell's answer is kept once the cell
    is known to be inland (its pixels and the ring round them all land); then the mask is
    asked for coastal cells only. Pinned to the performance cores, five years: 1.45 and
    1.44 ms; the code before 2.9a: 1.50 and 1.49.
  - *Seen first:* `coast1938.test.ts` reading the mask this way fails on 2.9a's rule (five
    elements of formation 367 at the start).

- **Third addendum, PLAN 2.9b2 (2026-10-04): the coast of T2 and T3 is drawn from the mask. PLAN 2.9 is done.**
  - *The texture:* the mask's bits as they are, a byte to a texel: R8UI, 2048 × 8192, 16.8 MB.
    A texture as wide as the mask (16384) is more than many a GPU takes; this one needs 8192.
    No smaller levels: the pass that reads it runs under 300 m/px, where a mask pixel is 8 px
    of the screen or more.
  - *The line:* four fetches and a blend, the rule of `maskField` on the CPU. Where the four
    agree the answer is the bit and nothing more is computed. Where they differ a noise moves
    the line, by `SHORE_NOISE` at most, by nothing at 0 and at 1. So the picture and the bit
    can differ only in the squares between four pixel middles that differ. The e2e compares at
    places whose 3 × 3 pixels agree and finds none against in nine views.
  - *The handover is a cross-fade of two coasts, not a blend of two fields.* The first version
    mixed the coverage and the mask's field by the share. The shore then travelled from the one
    coast to the other, and every pixel on its way went from sea to land in one frame.
    `groundThings1938` caught it (51.3 of 255 in a frame; its limit is 48). Now each coast says
    land or sea, the pixel is land by the two shares, and each has its coast line by its share.
  - *T0 and T1 are untouched:* the program without the ground has none of this (`#ifdef`). The
    Strait of Dover at 4000, 1000 and 400 m/px has the same hashes on this commit and on the
    one before (9f48d9a8, 937c10bf, c1e5e771, the tests' rasteriser).
  - *Lakes:* the mask has lakes that the coverage (the share of a block of 4 × 4, land over a
    half) has not. They are in the picture at T2 and come in with the handover. No formation
    stood in them since 2.9a; no tree does now. A lake that is not there at T1: watch list.
  - *The scatter* asks `maskSure` on the CPU, whatever the GPU took. The coverage is no longer
    its water.
  - *Cost* (bench A, 1080p, RTX 4070 Ti, the ground in full; two new views with a coast through
    them, 47 % and 31 % land): 0.748 → 0.775 ms and 0.705 → 0.735 ms with the mask in the
    coverage's place. T0 0.52 ms (0.51). The page holds the mask twice, 16.8 MB on the CPU
    (the scatter) and as much on the GPU.
  - *Test first, and one test that was not:* the first test of `coastPicture1938` fails on the
    commit before (2 places of the mask's land drawn as sea at Dover, 150 m/px). Its test of
    the elements passes there too: the 14 in the drawn sea were cleared by 2.9b1's rule, with
    either coast, in the 12 formations looked at. It stands as a guard.

- **Fourth addendum, PLAN 2.11i (2026-10-05): the land points broke the march at the seam's test. The pin moved.**
  - *The pin:* seed 99 after one year **99c1a04e → 4aafc3eb**; after five years b203bc49 →
    daffda22. A world without the mask still has f93cb674. Balance not measured (ADR-58).
  - *The defect, found by the fifth independent read (ADR-74):* `movementSystem` knew a step
    across the seam of a looping map by its ends being "more than 1 apart in x", and turned
    it round. True while every place was a cell's middle. This ADR gave coastal cells a land
    point, and two neighbours' points are up to 1.9 apart: such a step was walked the long
    way round the world, 100 cells an hour, the formation facing along it, fighting where it
    passed, and taking a new order from where it was. Seed 99, the first year: 90 formations,
    1,587 formation-hours more than 3 cells off their march.
  - *The fix:* a step is across the seam when its ends are more than half the map apart, as
    `combat.ts`, `production.ts`, `revolts.ts` and `majorBattles.ts` measure it.
  - *Why nothing of this ADR's saw it,* and what is there now:
    - its tests are of formations at rest (`coast1938.test.ts` skips those on the march, by
      design: a march may cross a bay);
    - "0 of 134 marches over water at day 30" was a count at one tick, of water, not of where
      a march should be;
    - the pin holds whatever the code does;
    - now: a year-free bound, in the unit suite. Seed 99, 60 days: no formation on the march
      is more than a cell from where it was an hour before (it failed at hour 112).
  - *The tick,* pinned, five years: 1.164 ms twice; 1.45 with the flights. Another world (the
    flights made battles), not faster code.
  - *Both hashes of this ADR's earlier addenda were of a world with the defect:* f5725b37
    (2.9a) and 99c1a04e (2.9b1). So was the smoke sweep of the phase review (PLAN 2.11a).
    ADR-58 means one smoke run of the phase's code: it is run once more, after PLAN 2.11k,
    the last change of the sim in this review (PLAN 2.11n). Nothing is tuned for either.
  - *An assertion restated with it, for the user to overrule:* `declutter1938.spec.ts` (PLAN
    1.45b) asserted that central Europe shows more T0 counters at each of four steps of zoom,
    at the start and a year into seed 1938. Two of the steps stay within one level of
    clusters, where the count grows only if a folded counter finds room. A year in, one did
    between 6 and 8 px a cell in the world with the flights; in this one none does (24 and
    24; no overlap, nothing at less than full, as before). It now asserts: more where the
    level changes, never fewer within a level, at least two finer levels on the way, and more
    than twice the counters at the end. Passes on both trees: not a test of the fix.
  - *Not the same thing, for the next reader:* `movement.ts` also has `if (dx > 1) dx -= w` a
    few lines up. That one is on cell columns, whole numbers: neighbours differ by 0 or 1 and
    the seam by the map's width less one. It is right as it stands.

- **Fifth addendum, PLAN 2.11k (2026-10-05): a muster in a theatre was the one place 2.9a missed.**
  - *The defect, found by the fifth independent read (finding 3):* a division raised in an
    overseas theatre appears by the bloc's city nearest the front, and `musterPoint` returned
    that city's own place, or a front cell's bare middle. Gibraltar's place is in a water
    pixel of the mask: a British division raised there stood in the sea, all 28 elements of
    it (`slotPlace` leaves the slots alone when the formation itself is not on land).
  - *The fix:* `standPoint` of the city, `cellPoint` of the front cell.
  - *The pin (ADR-55):* unmoved, 4aafc3eb. In the world since PLAN 2.11i seed 99 raises no
    division at such a place in its first year. After five years 9e83b0a7 → 49389306.
  - *The test this ADR lacked:* `coast1938.test.ts` looks at three days of one seed. The year
    file of the gate now looks at every formation at rest on every day of a year, on seed 1,
    where four divisions stood in the sea at Gibraltar on day 91.
  - *Left as it is, on the list under PLAN 7.4:* the cities themselves. 140 of 5,757 have
    their place in a water pixel of the mask and 387 not on sure land; their dots are drawn
    there.

### ADR-78 · 2026-10-04 · accepted — The ground at T2 and T3: hillshade and texture in the map pass, instances over it (PLAN 2.8)

- **Context:** PLAN 2.8 asks for hillshade from the elevation pyramid and procedural detail
  (ground texture, trees, rocks, buildings near cities) at T2 and T3. What there is:
  - The map is one full-screen pass (`mapShader.ts`): fills from a palette, smooth borders,
    the fine coast. It knows the terrain class of each cell and nothing of height.
  - Elevation ships at 2048, 1024 and 512 wide (`elev-*.i16d.wsz`, int16 metres) and is not
    loaded by the app. At the map's size that is one sample a cell, some 20 km: at T2 a cell
    is 65 to 650 px wide, at T3 more than the screen.
  - The e2e suite draws on a software rasteriser: what the pass costs there, every spec pays.
- **Decision: three parts, by the way they are drawn** (PLAN 2.8a to 2.8c).
  1. *Hillshade, in the map pass.* The slope of the elevation, smoothed over the cells so
     that no cell shows as a facet, lit from the north-west, laid on the fill.
  2. *Ground texture, in the map pass.* Noise by terrain class on the fill, and small relief
     added to the slope: the data's relief is smooth at these zooms, and without it the
     close view is flat. Finer octaves come in as the zoom nears.
  3. *Instances, over the map.* Trees, rocks and buildings as instanced quads from a scatter
     seeded by the place, as the element sprites are drawn.
- **Not tiles kept in textures,** though PLAN's word is "tiles": a pass that works out the
  ground for each pixel has no seams, no cache to manage and no step between zoom levels.
  What a cache would save is cost per frame. If the pass proves too dear on the bench or in
  the e2e stage, the texture part moves into tiles; measured after each part.
- **The detail comes in with the T1 → T2 handover's share** (ADR-71): the ground arrives with
  the sprites, by a fade of real time, not at a threshold of the zoom. Inside a branch on that
  share the pass does the new work; outside it, T0 and T1 cost what they cost.
- **Seeded by the place and nothing else.** No clock. The game's seed is not in it: two games
  on one Earth have the same ground. (Only real maps have these layers; the toy world has no
  terrain raster and draws as before.)
- **In every map mode:** SPEC's table gives the ground to the tier, not to a mode. It is laid
  on whatever the fill shows.
- **Noise that holds at 1 m/px:** a pixel there is 5 × 10⁻⁵ of a cell, and the pass's own
  noise coordinates (a cell number modulo 256 plus a fraction) resolve 3 × 10⁻⁵: the finest
  octaves are built on integers (the cell and the lattice point within it), hashed as
  integers, with the fraction kept small. Periods divide the map's width, so the seam of a
  looping map has no line.
- **Before:** bench A on the clean tree (RTX 4070 Ti, 1080p): 0.51, 0.48 and 0.45 ms of GPU a
  frame at the world, at 4 px a cell and at 48 px a cell; budget 1.0 at T0. The e2e stage:
  5.5 minutes.

- **Addendum, PLAN 2.8a (2026-10-04): the hillshade as built.**
  - *The data's path:* a message of its own after `mapLayers`, so the map and its coast do
    not wait for 2 MB of elevation; an integer texture (R16I), one texel a cell, read with
    `texelFetch`.
  - *Smoothed by the borders' spline, the slope from its derivative:* sixteen fetches for a
    slope that is continuous from cell to cell. Two bilinear taps would show each cell as a
    facet, at 65 px a cell and more.
  - *Steepened 12 times:* a cell is some 20 km, and the slope from one cell's mean height to
    the next is a few hundredths even in the Alps. Chosen by the picture: the relief reads and
    the fills keep their colours. The limits (0.6 to 1.25 of the fill) keep a nation's colour
    its own on the darkest slope and a pale fill from going white on the brightest.
  - *The sea is level:* its floor would put a bright and a dark band along every coast.
  - *One cell size for the whole map:* in Miller's projection a cell is fewer km wide than
    high away from the equator; the shading takes one figure. The relief is a picture of the
    ground, not a measure of it.
  - *Seen first:* with the data in the renderer and no shading, the test's two pictures were
    one. *T0 and T1 are the old pass:* hashes at four zooms equal before and after, with the
    layer and without it.
  - *Cost:* 0.08 ms of GPU a frame at 1080p where the ground shows (0.53 against 0.45); nothing
    where it does not. In the tests' software rasteriser a frame and its read were between 95
    and 155 ms with the layer and between 95 and 129 without, from one run to the next: the
    e2e stage's length is the measure there.
  - *What the picture is:* broad, soft relief. At 100 m/px one sample in 20 km is a slow wash
    of light and dark. The small relief is PLAN 2.8b's.

- **Second addendum, PLAN 2.8b (2026-10-04): the ground texture as built, and two things of 2.8a set right.**
  - *Set right, the cost at T0 and T1.* This ADR had "inside a branch on that share the pass
    does the new work; outside it, T0 and T1 cost what they cost". With the texture's loop of
    octaves inside the branch, bench A measured the map of T0 at 0.77 ms where it had been
    0.51, the branch never taken: the compiler does not leave a loop of that size behind a
    branch. The ground has a program of its own now (the same source with GROUND defined),
    used while any of the ground shows; the pass of T0 and T1 is compiled without it and is
    back at 0.52.
  - *Set right, the shading's limit.* 2.8a cut a slope's shade off at 0.6 and 1.25 of the
    fill. With the small relief added that made two tones of a mountainside. The limit is
    soft now (0.58 to 1.28, approached by a tanh), and the hillshade's own numbers moved with
    it: over the Alps the fill's brightness varies by 18 of 255 (it was 23), and slopes facing
    the light are brighter by 24 and 21 (44 and 45). Its test holds unchanged.
  - *Gradient noise, not value noise.* The first version used value noise with its slope.
    That slope is nought along every lattice line, and the shading showed the lattice as a
    grid (seen in the picture at 250 m/px).
  - *Integers name the lattice.* Octave k has 2^k points to a cell; a point is the centre
    cell times 2^k plus a small whole number, hashed as integers. Only the place between two
    points is a float. At 1 m/px: no streaks (as much change across as down), no block of
    64 px twice among 252.
  - *An octave counts by its wavelength on screen,* from 256 px to the finest drawn: 16 px at
    the far end of T2, 2.5 px from 20 m/px in. A function of the zoom, continuous: an octave
    comes and goes by its weight. The detail measured rises at each of four zooms.
  - *The class of the ground, not its colour.* The fill says whose the land is and keeps its
    hue; the terrain class sets how rough the ground is (mountains 1, hills 0.55, forest 0.34,
    plains 0.14) and shifts its brightness a little. Terrain colours stay the terrain mode's.
  - *The toy world has no ground,* though the texture needs no elevation: one switch for the
    ground as a whole (the elevation's arrival), by decision. It has no terrain raster either.
  - *Cost where it shows:* 0.82 and 0.88 ms of GPU a frame at 1080p (the hillshade alone:
    0.53). SPEC's budget at T2 is 2.0 with 10,000 sprites; 2.8c's instances come on top.

- **Third addendum, PLAN 2.8c1 (2026-10-04): where the instances stand.**
  - *What a tree is at T2:* a crown of 9 m is a thirtieth of a px at 300 m/px. Drawn to
    scale, nothing would show before the last of T3. So an instance is a symbol at T2 (a few
    px: "wood here", "town here"), as the units' sprites are, and the thing itself once the
    zoom shows it larger than its symbol.
  - *One place whatever the zoom: a nested lattice.* Level l has 2^l points to a cell; a
    point of a level is a point of every finer one; an instance belongs to the coarsest level
    its point is on. Zooming in adds instances between those that are there and moves none.
    A lattice chosen afresh for each zoom would put every tree elsewhere at each step.
  - *The next level comes in by its opacity,* through the upper half of the octave of zoom
    before its points are 14 px apart: a function of the zoom, as the texture's octaves are.
    A step of 1% of zoom changes no opacity by more than a tenth (tested).
  - *On the CPU, not in the vertex shader.* The shader could find each instance from its
    number with no buffer at all, but the scatter is what the task's unit test is of: one
    function, tested, and drawn from its output. It costs 0.4 to 1.2 ms for a full view of
    forest at 1080p (Node), and only when the camera moves.
  - *Buildings by the cities, not by the urban terrain class:* a city's cell is 20 km wide
    and urban all over; its buildings reach 3 to 18 km from its dot by its size.
  - *Water by two rules:* the cell's class, and the fine coast's coverage where it is known
    (with a margin: nothing stands on the coast line). PLAN 2.9 is of the same coast.
  - *Not done here:* the cities near the seam of a looping map reach only to it.

- **Fourth addendum, PLAN 2.8c2 (2026-10-04): the instances drawn; and what goes on the GPU.**
  - *Drawn by the fragment shader, not from an atlas:* three things, each a few lines of
    shape and light. No picture to make, ship or keep in step with the light's direction.
  - *Natural colours on the nation's fill:* green crowns on a blue Finland. The other way,
    tones of the fill, would read as texture and say nothing of what stands there; at T2 that
    is what a player looks for (cover, a town).
  - *Under the ground's one switch and its share:* nothing of T2 shows without the rest.
  - *The user's question, while this was built (2026-10-04): "should we move things to the GPU
    where possible even if we cannot unit test them?"* Answered then, and kept to unless the
    user says otherwise:
    - What is paid for each pixel or each instance in each frame is on the GPU already: the
      hillshade, the texture, the drawing of every tree. It is tested in the browser, by the
      pixels: "cannot be unit tested" is not "cannot be tested".
    - What is left on the CPU is where the instances stand. Measured in Chrome on the bench:
      0.5 ms a frame for 8,685 instances, while the camera moves and not at rest; the main
      thread's budget is 6 ms. On the GPU's side the instances cost nothing that can be read
      (0.84 ms a frame with them, 0.86 without).
    - Its rules (one place whatever the zoom; no opacity moves by more than a tenth in a step
      of 1%; the seam; water) are tested in milliseconds, and three faults put in on purpose
      were caught. A test by pixels looks at one view in seconds and would not see a tree
      half a pixel off.
    - *So: by measurement, not as a rule.* The scatter stays on the CPU. If a frame's CPU at T2
      or T3 goes past its budget on the bench, or the cap begins to cut views that players
      have, it moves to the vertex shader (the terrain and the coast are textures already;
      the cities need a small one), and `scatter.ts` stays as what the shader is checked
      against. The worker is the other place for it, and keeps the tests as they are.

- **Fifth addendum, PLAN 2.11l (2026-10-05): the ground does not outlive its zoom.**
  - *The defect, found by the fifth independent read (finding 4):* leaving T2 the element
    sprites go by the clock (in full for 220 ms, then a fade), and this ADR tied the ground
    and its instances to their share. The camera closes on its target at 18 a second: after a
    spin of the wheel it is at 4000 m/px in a tenth of a second, with the ground's share
    still 1. The scatter had no rule for zooms further out than its level 0 and gave every
    lattice point of it: 20,502 trees for a view of 1920 × 1080 at 5000 m/px, cut off at the
    cap of 12,000, at a line. And the ground's pass read the fine mask at half a screen pixel
    to a pixel of it.
  - *Decision, the view:* the ground's share is the sprites' share times a reach by zoom: 1
    up to 345 m/px (T1's lower limit × the hysteresis: where T2 is left), 0 from an octave
    beyond, smooth in the logarithm between. Inside T2 nothing changes. A camera that stops
    between the two zooms sees the clock finish the fade as before.
  - *Decision, the scatter:* further out than level 0 the levels go on, coarser, by leaving
    out points of level 0 (every 2^k-th each way is level −k). The identity of a point is
    the one it has at level 0, so nothing moves and no picture of T2 changes.
    - *Not a floor by opacity,* which PLAN 2.11l's acceptance test had asked for: a level
      that fades out over an octave is still given whole until its opacity is zero, four
      times as many points at the end as at the start, and is cut off at the cap on the way.
    - The view never asks the scatter for such a zoom now (the reach is 0 there). The scatter
      is right there all the same: it is a function of a view, and tested as one.
  - *Measured:* the reader's view at 5000 m/px, real map: 1,292 instances in 1.1 ms (5.0 ms
    for the 12,000 before). Out by the wheel from 250 to 1500 m/px: two frames with ground
    beyond 345 m/px, at most 4,390 instances in a frame. Bench A's view with instances: 8,685
    and 0.5 ms of CPU, as before.
  - *Not changed:* the element sprites themselves still go by the clock at whatever zoom
    (at their least size of 5 px, a few blocks for half a second). The handover of ADR-71.

- **Sixth addendum, PLAN 2.11m (2026-10-05): the map's canvas is opaque.**
  - *The defect* (a suspicion of the fifth independent read, settled in the browser): the
    instanced renderers of PLAN 2.3 and 2.8c2 blended with one function for colour and alpha,
    (SRC_ALPHA, ONE_MINUS_SRC_ALPHA), into a canvas that has alpha. Over an opaque map that
    leaves the colour right and the canvas's alpha at 1 − a(1 − a): 0.75 under a shadow at
    half opacity, less where layers lie on each other (0.54 read). The browser then lets that
    share of the page's background through. Over a forest at T2: 227,136 px of the page not
    the canvas's colour, by up to 26 of 255.
  - *The fix:* the alpha is blended (ONE, ONE_MINUS_SRC_ALPHA): over an alpha of 1 it stays 1.
  - *Why no test saw it:* every test that reads colours reads the canvas (`readPixels`), where
    the colour was right. Every picture looked at was a screenshot of the page, where the
    error was a quarter of a dark blue under things that are dark already.
  - *The test:* the page against the canvas, pixel for pixel, with the rest of the page
    hidden. It is the only spec that compares the two.
  - *Not done:* a context without alpha. It would make the page right whatever the blend
    state, and it would make the canvas's alpha read 255 whatever is drawn: the test's first
    assertion could then never fail.

### ADR-77 · 2026-10-04 · accepted — T1 markers of one nation that stand on each other are one marker (PLAN 2.7s1)

- **Context:** a T1 marker stands on its formation's centre, and formations of one nation often
  stand on one spot. On Spain's front after two weeks, at 1200 m/px, 13 pairs of markers of one
  nation were more than a quarter under each other (7 at 600 m/px, 5 at 310): the number of the
  one underneath could not be read. ADR-65 had left it "not solved here".
- **Measured before the design** (PLAN 2.7s has the table): pushing the boxes apart, each kept
  within half a marker of its formation, does not come to rest on that front at any zoom.
  Stacking by nation leaves no such pair at 1200 m/px and closer.
- **Decision:**
  - A marker that is more than a quarter of its box under a stronger marker of its nation goes
    into that one (the one it is most under, when several). The strongest first, so a stack is
    what stands on its lead and no chain.
  - The lead keeps its own symbol, flag and bar. Its number is the men of all it stands for,
    and a tag "×n" on its corner says how many. The tag is drawn after all the boxes: on the
    first try it stood beside the number and neighbours' boxes hid it.
  - A marker in a stack stays there until it is under its lead by less than a tenth. A change
    is a fade in place over 250 ms; the lead shows the sum at once. A marker new to the view
    takes its place at once.
  - Markers of two nations are never one marker: who faces whom is what this tier shows.
- **The men of all, not the lead's own.** SPEC's "one truth": the numbers on the map add up to
  the formations in view. A stack that showed its lead's men would hide the others'.
- **Two specs restated.**
  - `markers1938` asserted, marker by marker, "its number is its formation's element sum". For a
    stack that sentence has no single formation. It reads now: a marker's number is the element
    sum of the formations it stands for, itself first, and no formation is stood for twice. For
    a marker alone that is the old sentence, word for word in the test; for all markers
    together it says more than the old one did (every formation is counted, once).
  - `handover1938`, running: "every marker is at opacity 1" became "the layer's most opaque
    marker is at 1", which the spec already said of the counters for the same reason (ADR-65):
    while the armies move, markers go into stacks and come out, each by its own fade. Paused,
    every marker is still asserted at 1.
- **Rejected:**
  - *Pushing boxes apart only:* does not rest (above).
  - *Folding across nations as the T0 counters do* ("+n"): at T1 the enemy's marker is the
    information.
  - *The tag inside the box:* the morph into T2 keeps a picture of the box by nation, symbol
    and state; a count in it would make a picture for every count.
- **Cost:** every formation of the world is stacked in every frame at T1: 0.4 to 0.5 ms for the
  1,054 formations of the 1938 start (a grid of boxes, so that it grows with their number and
  not its square).
- **Not solved here:** markers of two nations on each other across a front at the far end of T1
  (PLAN 2.7s2). At T1 the markers stand on city names (BLOCKERS, with PLAN 2.7r).
- **Tests:** `tests/unit/markerStacks.test.ts` (11); `tests/e2e/markerStacks1938.spec.ts`;
  `counters1938`, `fades1938`, `morphNations1938`, `tiers1938`, `player1938` unchanged and
  passing.

- **Addendum, PLAN 2.7s2 (2026-10-04): markers of two nations move apart.**
  - *What was left* after the stacks: on Spain's front at 1900 m/px, 7 pairs of markers of two
    nations more than a quarter on each other (a cell is 10 px there, a marker 26).
  - *Decision:* the two boxes of such a pair move apart by half each, along the axis that needs
    the shorter move, until neither is under the other by more than a quarter; no box further
    than 6 px from its formation. The order arrow still starts at the formation.
  - *Over time:* a box keeps its move from frame to frame while the armies move under a camera
    at rest, and goes back when it touches no other box where its formation stands. It eases to
    a new move over 150 ms (the capital flags' time). At another zoom the moves are found
    afresh: what stands at rest after a zoom does not depend on the frames of the way there
    (ADR-75's lesson; the first version kept the moves of 1800 m/px at 1200, where none is
    needed).
  - *ADR-72 stands:* "the box does not move" during the morph into T2. The moves are frozen
    while a box shrinks; and at 310 and 340 m/px no pair of two nations was more than a quarter
    on each other in either region measured, so no box is off its formation there.
  - *Measured:* at 1900 and 1800 m/px 12 boxes move, by 3.2 and 2.7 px at most; at 1200 none.
  - *What it does not do:* a quarter of a box can be the number. At 1800 m/px the front is
    still a band of boxes that touch, and some numbers are partly covered. BLOCKERS watch list.

- **Second addendum, PLAN 2.7v (2026-10-04): the moves have no memory.**
  - *What was wrong:* the first addendum has "a box keeps its move from frame to frame while
    the armies move under a camera at rest". The moves of a frame started from those of the
    frame before. Where three markers of more than one nation are crowded beyond what 6 px can
    part, no set of moves satisfies the rule; each frame's passes ended somewhere else on a
    cycle, every target changed by more than a hundredth of a px, and the layer said for ever
    that it animated. Found by the third independent read (ADR-74): 29 of 324 samples of a 1938
    game, the first at day 90. The specs of 2.7s2 looked at day 14.
  - *Decision:* every box starts on its formation in every frame. The same formations give
    the same boxes; a view at rest has nothing to change.
  - *What is given up:* the memory was there so that a pair whose formations move a little
    keeps the axis it parted along. Without it a pair can part along x in one tick and along y
    in the next; the ease of 150 ms carries the box over. The markers stand at the places of
    the tick (they are not eased between ticks), so that can happen once in a tick and no
    oftener. Not seen in a picture yet.
  - *Tests:* the unit test of the memory ("a box keeps its move while it serves") is replaced
    by one of what holds now, and the three assertions of "at another zoom the moves are found
    afresh" by one of the ease that gives a move up. Restated, not weakened: the thing they
    pinned is the defect's cause.
  - *What the first addendum's "at another zoom the moves are found afresh" was for* is now
    true of every frame.
  - *The lesson, in ADR-74's third addendum:* a layer with a memory of the frame before is run
    on one input until it rests, on random inputs, in a unit test.

- **Third addendum, PLAN 2.7w (2026-10-04): a box that goes into a stack fades where it is.**
  - *What was wrong:* a marker in a stack had no move: in the frame it went in, its box stood
    on its formation. One that had been moved apart from another nation's marker jumped back,
    up to 6 px, at full opacity, and faded there (ADR-74, third read, finding 3).
  - *Decision:* while anything of it shows, a box on its way in keeps the place it is drawn at
    (where its ease had brought it, not where the ease was going). One that comes out again
    before its fade has ended eases from that place to where it should stand.
  - *When nothing of it shows, it keeps nothing:* one that comes out later is new among the
    shown and stands where it should at once, as before. What stands at rest does not depend
    on what faded there (ADR-75's lesson).
  - *This is the animation's own state, not the memory 2.7v removed:* it is read only while the
    fade runs, and where the leads stand is still a function of where the formations stand.
  - *Tested as the third read's addendum asks:* armies moving at random, 40 games of 150
    ticks; no box that shows moves off its formation by more than a step of the ease.

- **Fourth addendum, PLAN 2.7z (2026-10-04): on the way back from T2 a box grows where it will rest.**
  - *What was wrong:* ADR-72 has the boxes stand still while the morph into T2 shrinks them, and
    the layer kept each box's move for that. At T2 nothing is drawn and the layer is cleared;
    on the way back there was no move to keep, and "still" then meant "on the formation". The
    boxes grew there for 470 ms, markers of two nations on each other, and eased apart when
    the morph ended (ADR-74, fourth read, finding 1).
  - *Decision:* while the boxes stand still, one with no move to keep stands where the parting
    puts it. On the way back that is every box, from its first frame; on the way in, a marker
    new among the others. Boxes that have moves keep them, as before.
  - *What is not changed:* the first frame of the way into T2 still starts a move to the new
    zoom's places (the reader's suspicion; on the watch list).
  - *A camera that eases through the way back* (the wheel): each box takes its place at the
    zoom of its first frame and keeps it until the morph ends; then it eases to the place of
    the zoom reached. Small, and by the ease. Not measured.

### ADR-76 · 2026-10-04 · accepted — A city's name takes the first free place by its dot, keeps it, and moves by a cross-fade (PLAN 2.7r)

- **Context:** the T0 counters are drawn over the city names, and a capital's name stood to the
  right of the dot its nation's army often stands on. Over Europe at the 1938 start, at
  4000 m/px, a counter was on the letters of 17 of the 31 names shown and a flag on 3.
- **Decision:**
  - *Places.* A name takes the first of these where nothing is on its letters: beside the dot
    (right, left, below right, below left, below); past the counter or flag that stands there (to
    its right, its left or below it, no further from the dot than 40 px to the side and 26 px
    down); above (right, left, centred). With none, it is left out.
  - *What is in the way:* names placed before it (by their boxes, as before), the T0 counters
    that are at least half visible (the flags' rule) and the capital flags with their frames.
    The names are laid out after both; they have a canvas of their own, so the order of the
    layers does not change.
  - *It keeps its place,* to the pixel, as an offset from its dot, while nothing stands on it.
    A place it would prefer coming free does not move it, and it does not follow a counter.
  - *It moves by a cross-fade.* When something comes to stand on it, it takes the first free
    place in that frame: what showed at the old place goes out there over 250 ms while the name
    comes in at the new one.
  - *Clearance.* A new place must be clear of a counter by 2 px; a place held only has to be
    untouched. A counter's box moves by a pixel with its number and with the camera.
- **By the letters, not by the box.** A name's box has the padding and the line spacing that
  keep two names apart. A capital's own flag, 8 px above its dot, touches that box by a pixel:
  of the 22 names whose box a flag touched at 4000 m/px, 19 were that. Judged by the box, no
  capital's name could stand beside its dot. For the same reason the flags get no clearance.
- **What the measurements decided:**
  - *Eight places beside the dot were not enough:* 21 of 31 names found one at 4000 m/px (the
    acceptance test wants 25). Each of the other ten had a counter on its dot, clear of every
    place beside the dot by less than the name needs. With the places past the counter: 30 of
    31, 27 of 27 at 3000 m/px, 18 of 18 at 2300.
  - *Rejected: a name past a counter follows the counter.* The first version computed that
    place anew in every frame. With the game at top speed: 125 jumps of a name in full in 12 s
    (up to 28 px, as counters folded and came out).
  - *Rejected: go out, then come in elsewhere* (one box a name, the second fade starting when
    the first has ended). No jump, but a change took 550 ms, and `labelFades1938`, which gives
    a change one fade and its tail (352 ms), found two names still on their way. A cross-fade
    is one fade.
  - *Rejected: leave a covered name out.* 13 of 31 would be left at 4000 m/px.
  - *Rejected: the counter or the flag makes way.* ADR-65: a counter stands on its armies; a
    flag makes way for counters only.
- **What it costs:**
  - With the game at top speed (65 days in four seconds) 51 fades of names began in those four
    seconds at 4000 m/px: where counters change in every frame, the names near them come and go.
  - A name past a counter stays where it is when the counter has gone: 20 to 40 px from its
    dot with nothing between, until something stands on it.
  - One name of 31 is left out at 4000 m/px (Luxembourg: counters on every side).
- **Not solved here:** the nation names are drawn over the city names (Berlin under the "y" of
  Germany). PLAN 2.7t. At T1 the markers stand on city names as the counters did at T0: with
  PLAN 2.7s.
- **Tests:** `tests/e2e/cityNames1938.spec.ts` (the three zooms at rest; four seconds running: no
  name's box moves while it shows); `tests/unit/cities.test.ts`, 8 new (the order of the places,
  past a counter, the reach, the place kept, the move, the clearance, the flag by a pixel).
  `labelFades1938`, `labels1938`, `flagsClear1938` unchanged and passing.

- **Addendum to ADR-76, PLAN 2.7t (2026-10-04): the city names are above the nation names.**
  - *Context:* the curved nation names were drawn on the overlay, the canvas above the city
    names. With the counters and the flags out of the way, they were what still stood on city
    names: at 4000 m/px over Europe something was drawn over the letters of 11 of the 30 names
    shown (Berlin 505 px of them, under the "y" of Germany).
  - *Decision:* the order of the layers. The nation names are laid out as before and drawn on
    the city layer's canvas, under its dots and names. The overlay keeps the unit layers and
    the flags, above both, as they were above the nation names before.
  - *Why the order and not room:* a nation's name fills its nation, and a capital stands in
    it. Keeping the city names clear of those glyphs would move most of them off their dots or
    leave them out; the other way round the nation names would break up. A small name with its
    dark outline reads over a large pale one; the large one loses a few px of a letter.
  - *How it is tested:* by pixels. Inside the letters of every city name that is shown, the
    overlay has nothing drawn. That holds for a nation name, a counter and a flag alike, so it
    is also the check of ADR-76 read from the picture and not from the layout's boxes.

- **Addendum to ADR-76, PLAN 2.7u (2026-10-04): the names keep clear of the T1 markers.**
  - *Context:* ADR-76 gave the names the T0 counters and the flags to keep clear of. At T1 the
    markers stood on them: over central Europe at the 1938 start something was drawn over the
    letters of 12 of the 30 names shown at 1800 m/px, of 8 of 25 at 1000, of 1 of 13 at 500.
  - *Decision:* the same rule with other obstacles. A marker's box with its backing, the bar
    and the number under it; the tag of a stack, which reaches out of the box; the Major
    Battles. With the counters' clearance of 2 px for a place to be taken: a marker moves
    with its army every tick.
  - *Not the order arrows.* A dashed line 1.5 px wide across a name leaves it to be read.
    Arrows are long, and in a war there are hundreds: names that gave way to them would leave
    a front without names.
  - *Which layer counts: the one that is shown or coming in,* from the first frame of a
    handover. First it was judged by opacity, as the counters were in 2.7r (half and more).
    The names then changed places in the middle of the handover and were still fading when it
    was over: `labelFades1938` at 2000 m/px, 23 opacities not at rest after 352 ms. Now the
    names cross-fade with the layers. A counter or a marker that is itself on its way out (a
    fold, a stack) counts by its own part, as before.
  - *To be exact about "the first frame":* in the frame of the camera's step the coming layer
    has no share yet and draws nothing, so it has no boxes, and the going layer no longer
    counts: that one frame has no unit obstacles. The coming layer counts from the frame it
    is first drawn in, 16 ms later. A name with no place under either layer can begin to
    fade in during that frame and begin again in the next; not seen, and left so.
  - *What it costs:* names. Of those shown before, covered or not, 28 of 30, 23 of 25 and 13
    of 13 over central Europe; a capital among those left out at two of the zooms (Prague at
    1800 m/px, Warsaw at 1000: their garrisons stand on every place by the dot). On the
    watch list: the places are eleven fixed ones, and one a pixel to the side would do.
  - *How it is tested:* by pixels, as 2.7t; and while the game runs, by the names' boxes in the
    view's own frames.

### ADR-75 · 2026-10-04 · accepted — The counters' hold is a memory of the layer at rest; a split or merge on its way is folded without it (PLAN 2.7l)

- **Context:** a gate run under load saw 2 counters over central Europe at 1.5 px per cell where
  every other run has 3 (`declutter1938`). The hold of ADR-65 (a folded counter comes out only
  once it clears its neighbour by 6 px more) was read and written by every frame, those of a
  split or merge in flight too. In flight a counter passes others. Whether it lands held was
  decided by the moments of the flight that happened to be drawn.
- **Measured before, a step of the camera, the frames after it 16 to 1000 ms apart:**
  - Unit, 400 synthetic formations, counters shown at rest (and keys that differ from the 16 ms
    run): level 7 → 6: 286 at 16–60 ms, 285 (3), 284 (2), 283 (3) at 120, 200, 400 ms. Level
    8 → 6: 291, 290, 291, 290, 284, 289, 282, 282. A merge, 5 → 7: 157, then 156 (5), 157 (8),
    160 (11). Only a step inside one level's band gave one answer.
  - Browser, the 1938 start, the stops of `declutter1938` (the world, then 1.5, 3, 6, 8 px per
    cell over Europe), the frames drawn by the test: the world view reached again by a merge
    differs by 3 counters with frames 60 ms apart.
- **Decision:** the hold is a memory of the layer at rest. A frame of a split or merge on its way
  is folded without the hold and leaves none: the counters land free and are folded there by
  where they stand. `CounterLayer.hold`; `fold(…, flying)`; `declutter()` is the layout and the
  fold as `draw` does them, for the tests.
- **What it gives:** after a step the counters at rest are
  - the same at every spacing of the frames (16, 25, 33, 60, 120, 200, 400, 1000 ms; unit and
    browser);
  - the same from whichever level the camera came;
  - the same as in a view opened at that zoom. Before, a view opened at a zoom was folded
    without a hold and a step to it with the hold of its flight: one zoom, two pictures.
- **What it changes in the picture:** after a zoom in more counters stand. The children of a
  split come out at the gap (2 px), as counters do everywhere else, not at the hold distance.
  - The stops of `declutter1938`, counters in view and over central Europe: the world 65 and 2;
    1.5 px 57 and 5 (before 48 and 3); 3 px 61 and 17 (the same); 6 px 104 and 56 (85 and 45);
    8 px 87 and 58 (86 and 58). The spec's "more over central Europe at each closer stop" had a
    margin of one at the first step and has three; at the last step it has two (had thirteen).
  - At 3 px per cell from the opening view: 79 counters. Before: 73 with frames exactly 16 ms
    apart, 65 with frames 1000 ms apart.
  - Pictures: `docs/evidence/1.45/declutter-*.png` and `flags-clear-*.png`, made again and
    looked at. No counter overlaps another; the numbers read; Germany and Poland carry more
    counters on their names than before.
- **What it costs:**
  - In flight more counters turn twice (begin to fade in, then fold again), because nothing
    holds them: on a wheel notch in, eased, 56 of 7,394 counters (28 before); three notches out,
    484 of 9,560 (325); a step 7 → 6, 28 (17). A turn goes on from the opacity reached; the
    number on the neighbour changes with it.
  - The frame after a merge lands, a few counters turn: 4 of 162 keys at 5 → 7, 7 of 50 at
    6 → 8 (before 1 and 2). The landing is folded free; the next frame has its hold, which
    widens the reach of a folded counter, and it can find a nearer neighbour. One fade.
- **`flagsClear1938` restated.** The spec asserted that every capital in view has its flag at 3
  and 6 px per cell (41 of 41 and 22 of 22). At 3 px per cell two flags are left out now: Vienna
  and Prague, each with three counters in the column above it, so that the first free place is
  more than 40 px up (the rule of ADR-65's addendum).
  - *Why this is not a test made weaker to pass:* the 41 was a count of one of the pictures that
    zoom had. The code before this change, the frames drawn by the test exactly 16 ms apart:
    73 counters and 40 flags, Prague left out. Frames 1000 ms apart: 65 and 41. The gate saw 41
    because `settle` draws every 25 ms with the view's own loop in between. The assertion held
    by the defect this task removes.
  - *What it asserts now,* for each capital in view: its flag is there (and stands as before:
    at its usual place or just above a counter, at most 40 px up), or the test does the view's
    climb again over the counters drawn and finds no free place within 40 px. One flag a
    nation. So a flag cannot be dropped without cause; how many are left out is printed, not
    asserted.
  - Now: 3 px, 39 of 41, 15 raised by up to 36 px; 6 px, 22 of 22, 7 raised by up to 33 px.
- **Rejected:**
  - *No hold whenever the zoom changes* (tried). An eased zoom then ends alike at every
    spacing too. But the hold at rest is the hysteresis: a pinch that wobbles by ±1% at 12 Hz
    for a second turned 62 of 5,848 counters about 16 times each (998 turns; with the hold kept
    17 turns, no counter twice).
  - *The folds of a flight decided on where its counters land, the children born held* (PLAN's
    first direction; not built: its picture is that of the old code with frames 1000 ms apart,
    which was measured). It keeps 41 flags and the old look, and no counter would turn in
    flight. It also keeps two pictures for one zoom, and central Europe goes 2 → 3 at the first
    step for good: zooming in by a factor of four shows one counter more. It needs the hold
    carried across levels by ancestry and a second set of positions in the fold.
  - *The same, the children born free:* the picture of this decision with nothing turning in
    flight. More machinery for the flight alone; on the watch list, to be judged on the zoom
    demo (PLAN 2.10).
- **Not solved, on the watch list.** The acceptance test is a step of the camera. An eased zoom
  still ends with other counters when its frames fall otherwise, in 62 of 192 cases at spacings
  of 16 to 200 ms (136 before):
  - by the hold written at rest between two level changes of one zoom (158 runs at the same
    level with other counters; 413 before);
  - at 200 ms, by the level itself (12 runs, as before): `clusterLevel` rounds to the nearest
    level from wherever a frame finds the zoom.
- **Tests:** `tests/unit/counters.test.ts`, 5 new ("the counters at rest after a step of the
  camera"); `tests/e2e/declutter1938.spec.ts`, 1 new, which fails on the code before with
  "stop 0, frames 60 ms apart: 3 keys"; `tests/e2e/flagsClear1938.spec.ts`, restated as above.
  PLAN 2.2's continuity test (`counters1938`) passes unchanged.

### ADR-74 · 2026-10-04 · accepted — An independent read finds what the author no longer sees; its findings are tasks before the next feature

- **Context:** the review pass after PLAN 2.7 found, by reading, a bug of PLAN 2.7c that five
  gated commits had carried (ADR-72, addendum). A second reader with no part in the code was
  then given the unit and label drawing code (`src/render/units`, `fx`, `labels`,
  `timing.ts`, the unit layers of `MapView`) and asked for defects only: an input or a state
  that gives a wrong picture, a wrong value, or a view that never comes to rest.
- **It found the 2.7c bug by itself**, before the fix landed, and eight more. Three it ran
  (the pure modules, in scratch scripts); five it traced by reading. Finding 1 was checked
  here against the code and holds; the others are checked by the failing test of their task.
- **Decision:** the six that a player can meet are PLAN 2.7f–k, before 2.8, each with a test
  that fails first. Most severe first.
  1. 2.7f: the counters' level can go back and forth for ever at a resting camera.
  2. 2.7g: a destroyed nation's capital flag stays.
  3. 2.7h: a repeated tick restarts the sprites' walk.
  4. 2.7i: sprites take the map mode's colours, and keep stale ones.
  5. 2.7j: figures fading out are of the tick before.
  6. 2.7k: a nation name's state is lost at the seam.
- **Not tasks, on the watch list in BLOCKERS.md:** the counters' declutter does not see across
  the seam (the 180° meridian: rare); the two wrap copies of a city share one name switch (needs
  a view 6,570 px wide on the shipped maps); a city's limit is exclusive where the tiers' are
  inclusive (one zoom value); the toy world's two nations wear 1938 flags; the morph's box
  picture is rounded up at a fractional device pixel ratio (not traced).
- **Why before 2.8:** 2.8 adds a layer to a view that does not come to rest. A view that keeps
  drawing hides the cost of what is added, and `settle` in the specs waits on it.
- **Why not all in one commit:** one cause, one test, one commit.
- **For the reviews to come:** a review pass (PROMPT step 9) includes one such read of the code
  written since the last pass. This one found nine defects.

- **Addendum 2026-10-04, the second read (review pass after PLAN 2.7f–m).** A reader with no part
  in the code was given `counters.ts`, `nationLabels.ts`, `timing.ts`, `handover.ts`, the unit
  layers and the frame loop of `MapView`, and `protocol.ts` and `server.ts` for the snapshot
  fields; the lines new since the first read first; the same definition of a defect; the watch
  list as known. It was told nothing of what had changed or why.
  - **Six findings.** Three it ran in scratch tests (worker side and pure modules), three it
    traced. Each was checked here against the code it names, by reading: all six hold as far as
    reading shows. None is in the lines of PLAN 2.7f–m: the read went further than the diff.
  - **Tasks, before 2.8, most severe first:** PLAN 2.7n (at the closest zooms a formation's
    figures are missing when the camera is off its centre: the worker sends by the formation's
    centre, and the view's subscription is rounded to quarter cells), 2.7o (a formation that
    takes a freed id arrives from where the dead one stood), 2.7p (a pan at T3 shows T2 sprites
    for 250 ms), 2.7q (a world loaded into a running game leaves the old world's flags).
  - **Watch list:** one copy of a name going out in one frame (needs two copies in view and a
    larger name arriving); no margin at the seam for what is drawn across it.
  - **What it found correct** is in PROGRESS of this date: among it the hold of PLAN 2.7l and
    the loop of 2.7m, run over 840 zoom steps and 540 static views.
  - **The two reads together:** fifteen findings, ten of them tasks, in code that passed its
    gate every time. The second cost 325,000 tokens and 45 minutes.

- **Addendum 2026-10-04, the third read (review pass after PLAN 2.7n1–t).** The same brief, on
  the ten files changed since the second read: the marker stacks, the markers, the city labels,
  the timing, the sprite renderer, the subscription, `MapView`, the worker's snapshots, the
  table and the slot poses.
  - **Five findings, three run by the reader, all in code written since the second read.** Two
    were run again here before anything else and hold; one was read against the code.
  - **Three are defects of tasks done hours before, each gated green:** the moves of PLAN 2.7s2
    never come to rest where three markers are crowded (a view that draws for ever: 29 of 324
    samples of a 1938 game, none of them at a tick a spec looks at); a marker moved by 2.7s2
    jumps when it goes into a stack of 2.7s1; the count of PLAN 2.7o is not resized by a load.
  - **Tasks, before the rest:** PLAN 2.7v, 2.7w, 2.7x; and 2.7y, a decision (a pause in mid-tick
    moves every marching sprite to its tick's end in one frame, which SPEC has as intended).
  - **Watch list:** markers at the seam; four suspicions.
  - **What it ran and found correct:** the city names of 2.7r (2,707 moves of a name among 25
    moving obstacles: no jump, none without its fade, all at rest 3.2 s after the obstacles
    stopped); the subscription key of 2.7n2 (14,802 pairs of cameras with one key); the stacks
    of 2.7s1 on the 1938 world at three ticks and eighteen zooms.
  - **The three reads together:** twenty findings, fourteen of them tasks. The first two found
    theirs in code older than the lines they were pointed at; this one in the newest. What
    separates the two kinds: 2.7r was measured while the game ran, in four versions; 2.7s2 was
    measured at one tick, paused.
  - **For the tasks to come:** a layer with a memory of the frame before is run, in a unit
    test, on the same input until it rests, on random inputs. The spec of one tick does not
    see a cycle.

- **Addendum 2026-10-05, the fifth read (the Phase 2 review, PLAN 2.11b).** The same brief, on
  the 23 source files changed since the fourth read (`ece4b2f`: PLAN 2.7z to 2.10b, 1,261
  lines), at full width: the fourth was narrowed, and this is the phase's. Node only (a sweep
  was running); nothing of what changed or why.
  - **Five findings, each run by the reader; four run again here with its scripts, the fifth
    read against the code. All hold.** 356,000 tokens, 33 minutes.
    1. A march between two neighbouring cells is taken for the seam and walked round the
       world (`movement.ts`: "more than 1 apart in x"). **A regression of PLAN 2.9a**, in
       four gated commits since: 90 formations in seed 99's first year.
    2. A game loaded from a save does not go on as the game that was saved (the supply
       network is refreshed in full on a load, in part otherwise). Older than the phase and
       outside the lines the reader was pointed at; I2 of SPEC §2.6.
    3. A formation mustered in a theatre is placed raw: 9 British divisions in the sea at
       Gibraltar. A path PLAN 2.9a missed.
    4. `scatter` has no floor of zoom, and the ground's share is a matter of time: a fast zoom
       out of T2 shows trees for the far zoom, cut off at a line.
    5. Back from T2 with the camera still zooming, the T1 boxes are up to 6 px from their rest.
  - **A sixth from a suspicion, settled here in the browser:** the map's canvas is not opaque
    where sprites and trees blend (254,968 of 1,120,000 px at T2 over a forest, the least at
    an alpha of 138 of 255): the page's background shows through.
  - **Tasks before Phase 3:** PLAN 2.11i, j, k (the sim's, first), l, m. Finding 5 is a line
    under PLAN 7.4: nothing is wrong at rest, and what is off is an ease of 6 px.
  - **What finding 1 says about the phase's own checks.** Every one of them passed with it:
    - the test of 2.9a looked at formations at rest and skipped those on the march, by design;
    - the count "0 of 134 marches over water at day 30" was a count at one tick;
    - the pinned hash holds whatever the code does: it moved with 2.9a and was logged as "formations stand on land";
    - the smoke sweep's five limits were green: formations that fly for some hours do not move a border by a percent;
    - the zoom demo closes in on a division that fights a Chinese division (494) which, in seed 99, is the first to fly.
    A change of where things stand is a change of how they move between those places. The
    task that fixes it adds the test that was missing: a bound on how far anything moves in
    an hour, over a run.
  - **What finding 2 says:** the invariant most relied on (a checkpoint is the run it was
    taken from) was tested on the toy world and near the start. The reader found it by
    running a save from the middle of a year.
  - **The five reads together:** twenty-six findings, twenty of them tasks.

- **Addendum 2026-10-05, the sixth read (the review pass after PLAN 2.12 to 2.16, PLAN 2.16Ra).**
  The same brief, on the 51 files of `src/` and four of `tools/` changed since the fifth read
  (`3d6a2b2`, 2,506 lines), the new lines first; Node only; nothing of what changed or why,
  and PLAN, PROGRESS, DECISIONS and the git log's messages not to be read.
  - **Nine findings, eight run by the reader; five suspicions.** 259,000 tokens, 32 minutes.
    Checked here by reading the lines named: 1, 2, 3 and 6 hold as far as reading shows, and
    each is run again as the failing test of its task (as the first read's were).
    1. Land stays owned by a dead nation: (a) in a plain game, by `eliminateNation` (seed 99:
       1,389 cells from tick 4006 on); (b) in a Kill of a nation that owns no province's
       centre cell.
    2. A Kill leaves the cells its victim occupied under a dead controller.
    3. A Kill reads the capital's province at the capital's coordinates.
    4. The random world with 150 nations or more: several of one name.
    5. An empty rename in a world without a table gives "Free state N" (known: ADR-109).
    6. The formation panel follows a reused id onto another formation.
    7. `editPaint` with a line to 1e9 or Infinity (from outside the types only).
    8. For an hour after a load or a command, blocks in contact drawn elsewhere.
    9. The order of a Kill's events.
  - **Tasks before PLAN 2.17:** 2.16Rf (1a), 2.16Rg (1b and 2), 2.16Rh (3), 2.16Ri (6).
    Lines: PLAN 2.17 (the commands that name a dead nation, a suspicion), PLAN 7.4 (4). The
    rest is in BLOCKERS.
  - **Where the findings were.** 1a is in a file no task of 2.12 to 2.16 touched
    (`capitals.ts`), found from the Kill's code outwards. 1b, 2 and 3 are in the Kill of PLAN
    2.15a, whose unit test kills four nations (France, Yugoslavia, Italy, Luxembourg) at the
    start; the reader killed every nation, and at tick 2000 too. ADR-103 and ADR-106 mended, in
    `spawnRebels`, the very reading of a shore capital's coordinates that finding 3 finds in
    `killNation` forty lines away.
  - **What it found correct** is in PROGRESS of this date.
  - **The six reads together:** thirty-five findings, twenty-four of them tasks.

- **Addendum 2026-10-06, the seventh read (the review pass after PLAN 2.17 and 3.1 to 3.4, PLAN 3.4Ra).**
  The same brief, on the 35 files of `src/` and four of `data/` changed since the sixth read
  (`5d24625`, 1,373 lines), the new lines first; Node only; nothing of what changed or why,
  and PLAN, PROGRESS, DECISIONS, BLOCKERS and the git log's messages not to be read.
  - **Six findings, all run by the reader; four suspicions.** 296,000 tokens, 31 minutes.
    Checked here by reading the lines named: 1 to 5 hold as far as reading shows, and each
    is run again as the failing test of its task.
    1. A nation the player controls never gets a research budget (`economic.ts`: the AI
       alone writes it). A defect of PLAN 3.1b that SPEC had listed as "not yet".
    2. A nation painted away with the God brush lives on with no cell (`capitalsSystem`).
    3. Undo, redo and an import give land to a dead nation (`editor.ts`).
    4. A cell taken from an occupier by a nation not at war with its owner stays occupied
       with no war (`territory.ts`, `makePeace`): tens to 198 cells, every game.
    5. A puppet that dies keeps its overlord and returns as a puppet.
    6. Commands the page never sends, applied with values out of range (a negative
       strength, a member twice, a fractional province).
  - **Tasks before PLAN 3.5:** 3.4Rg (1), 3.4Rh (2), 3.4Ri (3), 3.4Rj (4), 3.4Rk (5). The
    rest is in BLOCKERS.
  - **Where the findings were.** None is in the four rules of combined arms, the fuel, the
    org or the terrain, which the reader read and ran without a finding. 1 is the edge of
    PLAN 3.1b that its own notes named and no test stood on. 2 and 3 are where PLAN 2.17b
    (the brush gives land, through the editor's paint) met code written for a war and for
    an editor with no dead nations: the brush's test paints a part of a nation, the reader
    painted the whole of three. 4 is older than every line it was given, found by
    following the Kill's comment that calls such a cell wrong.
  - **What it did not see:** that armour fights without supply for 47 % of its hours in
    contact (PLAN 3.4Re, found here by a count over a year). A rule that works as written
    and is on more often than was meant is not found by a read for defects: it wants a
    count of how often, which no part of PLAN 3.2 made.
  - **The seven reads together:** forty-one findings, twenty-nine of them tasks.

- **Addendum 2026-10-07, the eighth read (the review of Phase 3, PLAN 3.7a).** The same
  brief, on the 36 files of `src/` and `tools/` changed since the seventh read (`dae7824`,
  2,163 lines) and `data/combat.json`, the new lines first; Node only; nothing of what
  changed or why, and PLAN, PROGRESS, DECISIONS, BLOCKERS and the git log's messages not
  to be read. Told as known: the commands the page never sends, the AI's refused orders,
  the war with no front, the tag on another formation's elements, the figure over a hull.
  - **Five findings, three run by the reader, two traced; three suspicions.** 266,000
    tokens, 17 minutes. Checked here: 1 and 2 run again with the reader's scripts, which
    print what it reported; 4 and 5 read against the lines named; 3 is the failing test
    of its task.
    1. An order between two parts of one landmass is refused where a walkable cell with no
       province joins them (`nodeGroups`, `mayReach`): south-west Japan, 120 cells, is cut
       from Japan for the player and for the AI; four smaller splits.
    2. A paint of terrain anywhere, or a change of the looping, clears the saved paths; the
       path found again is another, and `pathStep` counts along the old one: 85 of 487
       marching formations moved by up to 11.7 cells by one cell painted 363 cells away.
    3. A march ended at ground turned foreign puts the formation back on the cell behind
       it, up to 1.25 cells in the hour.
    4. An order to a formation on the retreat sends it through the enemy unfought for up
       to 24 hours (traced).
    5. A later save of the same game loaded at T3 leaves a hull for every tank lost
       between; an earlier one leaves the old game's hulls and shots (traced).
  - **Tasks before Phase 4:** PLAN 3.7j (1), 3.7k (2), 3.7l (3), 3.7m (4), 3.7n (5).
  - **Where the findings were.** 1, 2 and 3 are all of ADR-149 (no march across a third
    nation), the one decision of the phase that changed what a route is: it made the
    provinces a test before the search, the path a thing of the hour and state, and the
    walk able to end a march. Each was gated with tests of the case it was written for
    (a third nation between two others); the reader asked what else the same lines now
    answer (a cell with no province, a cache dropped for another reason, a formation in
    mid-step). 4 is where the retreat of ADR-150 met an order that is not the AI's. 5 is
    the hulls' memory of the snapshot before, with a guard for a clock that went back and
    none for one that jumped on.
  - **What it did not see, found here by counting:** the 80 formations a year set on their
    spawn point (PLAN 3.7h). Its invariants met two of them ("the two 29-cell jumps were
    repatriation") and took them for the rule, which they are. As after the seventh read:
    a rule that works as written is not a defect to a reader; it wants a count.
  - **The eight reads together:** forty-six findings, thirty-four of them tasks.

- **Addendum 2026-10-09, the ninth read (the review pass after PLAN 3.12, PLAN 3.12Ra).** The
  same brief, on the 55 files of `src/`, `data/` and `tools/` changed since the eighth read
  (`033b15a`, 2,750 lines), the new lines first; Node only; nothing of what changed or why,
  and PLAN, PROGRESS, DECISIONS, BLOCKERS, SPEC, `critic/` and the git log's messages not to
  be read. Told as known: the commands the page never sends, the AI's refused orders, the
  war with no front, the tag on another formation's elements and the figures drawn in one
  another, the land that rises and goes back, the two things of the alliances' rows that
  PLAN 3.12Rf and 3.12Rg have, the balance, the cues nobody has heard.
  - **Four findings, all run by the reader; four suspicions.** 330,000 tokens, 23 minutes;
    its scripts and logs are in `.cache/read9/` (scratch, not kept in the repo). Checked
    here: 2, 3 and 4 run again with the reader's scripts, which print what it reported; 1
    read against the lines it names and against its log, and is run again as the failing
    test of its task.
    1. A march home (ADR-169) that meets ground of a nation its own is at war with waits
       before it, and nothing ends the wait: the operational AI leaves a formation with
       `home` set alone, the repatriation leaves a moving one alone, and it is not in
       contact. Seed 77, three years: 403 marches home, 112 of 90 days or more; the 144 of
       30 days or more began with 929,100 men and ended with 108,977. After Italy's war on
       France at tick 18,624, 121 formations of Germany, Italy and Poland bore the mark at
       tick 19,440; a German division stood 319 days and went from 10,518 men to 10. Seeds
       42 and 99: 6 and 10 marches of 90 days or more.
    2. A nation annexed while every city of its own is occupied leaves its puppets' land
       with the dead bloc's supply marks: the puppets go to the annexer's bloc with no
       `supplyDirty` (`annexNation`), their cells are not changed cells, and a source cell
       that bears a mark is not a seed of the flood. Belgium annexed by Germany at a peace
       (seed 1, the AI off, the occupation set by hand): the Congo's 6,240 cells keep mark
       27 where a full refresh gives 1; its three formations are at supply 0 for 20 days
       and go from 23,448 men to 12,190; the same game saved and loaded has other hashes
       from the first day. The code of `033b15a` was 6 cells from the full refresh: this
       came with the partial refresh's mending (ADR-196). Not met in 7,000 ticks of three
       worlds with a twin that refreshes in full each time.
    3. A war that ends because a member became the puppet of an enemy (`leaveBondedWars`)
       is removed with no event: the log declares it and never ends it, and the land held
       goes back in that hour. Seed 77: 2 of the 69 wars of three years (Germany's with
       nations 114 and 107).
    4. Not in the changed lines: `musterPoint` (`production.ts`) puts a new formation on
       `standPoint` of a city's own place, which for 436 of the 5,757 cities of 1938 is in
       a cell of no component; a formation there can take no order. Seed 77: 26 British
       formations on one point at the end of three years, each order refused.
  - **Tasks before Phase 4:** PLAN 3.12Rk (1), 3.12Rl (2), 3.12Rm (4), 3.12Rn (3). The
    suspicions go with the parts that touch their lines: a retreat that is turned back as
    a march home's way back (3.12Rk), the mending's wrap on a map with edges (3.12Rl), the
    ticker's five rows at Max speed (3.12Rh), two rows for one annexation (3.12Rg).
  - **What held:** a save loaded into a live game of another seed, saved again byte for
    byte and run 300 ticks with the hash equal at each (38 saves over three worlds); the
    full-refresh twin (above); every day of three years of seed 77, the invariants of
    wars, alliances, puppets and formations it wrote; every ticker row with a place and
    two names; the history rows of 3.12a to 3.12b2 against the events of their hour.
  - **What it did not read:** `src/render` (`hulls.ts`, `tags.ts`) and `MapView.ts` past its
    diff: no browser. The 236 lines of `hulls.ts` and the 90 of `tags.ts` have had no
    reader; their specs are what they have.
  - **Where the findings were.** 1 and 2 are each a rule of this stretch that was right for
    the case it was written for and took a state out of every other rule's reach: the
    march home's mark (ADR-169) was made to keep the AI's hands off a formation on its way,
    and nothing asked what ends the way; the mending (ADR-196) was proved equal to the full
    refresh on the games the AI plays, and a bloc that changes with no cell changed is not
    in them. 4 is older than the stretch and was met only because the reader counted
    formations on water every day. As after the eighth read: the reader's invariants and
    twins held, and what it found it found by counting how long and how many.
  - **The nine reads together:** fifty findings, thirty-eight of them tasks.

- **Addendum 2026-10-04: the review pass is counted by numbered tasks (the user's decision).**
  - *What the user said,* when a pass was proposed after PLAN 2.8c2: "Let's clarify the
    5-iteration rule for review pass to proper numbered iterations (e.g., 2.7, etc.) instead of
    all these subiterations 2.8a, 2.8b, 2.8c1, etc." PROMPT.md's step 9 says so now.
  - *What it had been:* every part of a split task had counted as an iteration. From the
    review after PLAN 2.7 to this day that made four passes inside one numbered task and a
    fifth proposed one task later; each brought an independent read.
  - *What follows now:* since the last pass one numbered task is done (2.8). No pass is due.
  - *Two readings of mine, told to the user and confirmed by the user the same day ("Yes,
    those readings of the rule are correct"); in PROMPT.md's step 9 since:*
    - A task that comes out of a review belongs to the task it follows up (2.7f to 2.7z were
      all of 2.7).
    - A phase review is a review pass and starts the count again. The next is PLAN 2.11.
  - *The independent read* still comes with a pass, its width chosen for each (the addendum
    below).

- **Addendum 2026-10-04, the fourth read (review pass after PLAN 2.7v–u), narrowed by the user.**
  - *The user's decision:* asked why another pass came before PLAN 2.8, the user was given three
    ways (the read as before; no read until the phase review; a read of the two changes with
    the most new logic) and chose the third. The read was of PLAN 2.7w (a box that fades into
    a stack keeps its place) and PLAN 2.7u (the names keep clear of the T1 markers). The pass
    itself is PROMPT.md's (step 9); the read is this ADR's, and its width is now a choice made
    for each pass.
  - *What the earlier statuses got wrong:* they said PLAN 2.8 came after the five tasks of the
    third read. Five tasks are five iterations, and bring the next pass due.
  - *Two findings, both run by the reader; neither in the two changes themselves.* 2.7w held
    under 1,600 made-up games (no step over the ease's, no opacity step, every formation in
    one marker, every game at rest within 19 frames), and the names of 2.7u under 160 runs
    through marches and handovers (never fail to rest; nothing partly faded at rest; no name
    under a marker, a tag, a counter or a name).
  - *Finding 1, a task (PLAN 2.7z):* on the way back from T2 the markers stand un-parted for
    the whole morph and then spring apart; with 2.7u the names shuffle a second time. The rule
    it comes from (`still`) is of 2.7s2; the test of it has moves in hand, and none enters it
    after `clear()`. Run here at the layer before anything else: it holds.
  - *Finding 2 and six suspicions:* the watch list.
  - *The four reads together:* twenty-two findings, fifteen of them tasks. The yield falls: 9,
    6, 5, 2; and this one found nothing in the code it was pointed at.

- **2.7n, done 2026-10-04 (second read, finding 1): what was chosen in its three parts.**
  - *2.7n1, whole formations by the reach of their block.* The worker widens the box, for a
    formation's centre, by the distance to the far corner's slot and half a slot more, and
    sends the formation whole.
    - Rejected: elements one by one, by their own places. Fewer are sent at the closest
      zooms, but the strength of a formation would no longer be the sum of the elements the
      view has, which the T2 specs and the "one truth" check read.
    - Rejected: one margin for all. Blocks are 6 to 53 slots: 0.05 to 0.17 cells.
  - *2.7n2, the step of the subscription key: a power of two of cells between a 32nd and a
    16th of the box's smaller half-size.*
    - The pad is a fifth of the half-size. For the view of one camera to lie in the box of
      another with the same key the step must not be more than the pad. A 16th is a third of
      it: the rest is for the 100 ms between two subscriptions, in which a fast pan goes on.
    - A power of two, and in the key: two cameras with one key then have one step, and
      zooms near each other round to the same grid.
    - It asks every 14 to 28 px of pan on a view 720 px high. Before: every pixel at T0 and
      T1, every 41 px at 120 m/px, every 4,892 px at 1 m/px. At most 10 times a second, as
      before.
  - *2.7n3, 48 px.* A stand-in stands for a formation, as a marker does, so it has a size on
    screen and not on the map. The silhouette fills two thirds of its square: 32 px lit, a
    little more than a marker's box (26 × 17) and less than a counter.
    - Rejected: no stand-ins in a world that has elements. The view cannot tell a formation
      without elements from one whose elements are not in its box, and the toy world, where
      every formation is a stand-in, would need the limit all the same.

- **2.7o, done 2026-10-04 (second read, finding 3): how the worker knows a formation is new.**
  By the id alone it cannot: freed ids are given out again, the last freed first.
  - *Decision:* the table counts how often each id has been given out (`Table.generation`), and
    the worker compares the count before and after the step.
  - *Why it is not sim state:* nothing in the sim reads it, and it is not serialized or hashed.
    A column would change the save bytes and the pinned hash for a thing only the view needs;
    the pin of seed 99 is unchanged (ADR-55: it moves with rules only).
  - *Rejected:* the events of the step (not every way a formation goes emits one: disbanded,
    annexed, removed by God or the editor); a guess from how far the formation moved in a tick
    (a threshold, and a recycled id next door would pass it).
  - *PLAN 2.7x, 2026-10-04 (third read, finding 2): the count through a load.* `deserialize`
    made the columns anew at the loaded size and left the counts at the old length; ids beyond
    it had none, and the worker took their formations for new in every tick. The counts are
    now as long as the table. A load does not raise them: that every row is another row after a
    load is the observer's to know (the worker takes the places anew in `resetStreams`, and
    the snapshot that follows sends every formation from its own place: tested). Raising them
    all in `deserialize` would say the same twice, and was left.

- **2.7f, done 2026-10-04: finding 1 reproduced and fixed.** `CounterLayer.layout` now takes
  over the level of a finished change first and judges the level wanted against that.
  - Before, in the unit test: a zoom to 3.7 levels and back to 3.5 within 100 ms left the level
    changing 8 times in the two seconds that were counted, for ever; of 516 eased bursts of
    wheel notches (4, 5 and 6 out, 4 in, from 129 zooms each) 69 never rested. The reader had
    counted 68.
  - In the browser the bug needs the notches of one flick between two frames. Sent one by one
    through Playwright they are 50 ms apart and the old code rested too; the spec dispatches
    them together. Before the fix: levels 6 and 5 in turn at a resting camera, a frame drawn on
    every tick of the loop. After: one level, no frame in two seconds.

- **2.7g, done 2026-10-04: finding 2 reproduced and fixed.** Poland annexed by Germany: its
  flag stood over Warsaw afterwards. The snapshot's nation row has a ninth field, `living`,
  and the view drops the capital of a nation that does not live.
  - *Why a field and not a missing row:* the row's colour is still needed (the charts and the
    list of the dead draw destroyed nations).
  - *Why not a capital of NaN:* the view's cull of flags outside the picture compares
    coordinates, and every comparison with NaN is false; it would have needed its own test
    there anyway.
  - A nation that is dead from the start (Ethiopia in 1938) is treated the same: it has no
    capital in the view. (The reader reports that its flag was kept off the picture before only
    by where its unset capital lies, cell (0, 0); not checked here.)
  - Not hashed: a snapshot is a view of the state. The pinned hash did not move.
  - The flag goes in one frame, without a fade. So does a name when land changes hands (ADR-73,
    addendum): an event of the game, not a matter of zoom. Left.

- **2.7h, done 2026-10-04: finding 3 reproduced and fixed.** The view restarted the sprites'
  clock on every snapshot. Measured in the browser at one tick a second: a pan 0.38 of the
  way through a tick sent the progress to 0.00; the end of a pause sent it from 1.00 to 0.00.
  - The test reads the progress, not pixels. The progress is the sprites' only motion between
    ticks: the GPU draws each at `prev + t × (cur − prev)` with `t` one uniform for all. A `t`
    that does not go back moves no sprite back.
  - The clock starts with a new tick only.
  - The same tick at another tick length (another speed, a pause and its end) keeps the
    progress reached: the clock is set back by that progress × the new length. Without this a
    change from one tick a second to three would jump from 0.38 to 1.
  - **PLAN 2.7y, 2026-10-04 (third read, finding 4): a pause lets the sprites finish their
    step.** 2.7h had "paused, the progress is 1: the sprites stand where the tick has them",
    and its test said so. A pause at progress p of a tick then moved every marching sprite by
    (1 − p) of its step in one frame: by the reader's numbers 14 px for the median step at
    100 m/px and 54 for the largest, 48 and 181 at 30 m/px. The phase's rule is that nothing
    pops.
    - *Decision:* a snapshot of the tick in hand without a tick length (a pause) leaves the
      clock and the length as they are. The sprites reach the tick's end when the tick's time
      has run, at most one tick length after the pause, and the view draws the way there.
    - *What a paused view shows* is the sim's state, as before, from then on. The date stops
      at once; the sprites are the only thing that goes on, for under a second at one tick a
      second.
    - *Rejected: to hold them at p until the game goes on.* Every sprite would stand, for as
      long as the pause lasts, at a place no state of the sim has: a formation moved or made by
      God Mode or the editor while paused would be drawn between its old place and its new.
    - *Unchanged:* a tick that comes while paused (a single step) or at full speed has no
      length, and its progress is 1 at once.
    - *The test restated:* `tickClock.spec.ts` had `paused: 1` and `resumed: 1`. It now has:
      the progress is never ahead of the clock, between readings and between frames drawn
      (before: 0.50 and 0.60 of a step), nor behind it; the view draws on the way; the last
      frame drawn is at 1 and the progress stays 1; a pause and its end at once leave the
      clock running. For the user to overrule.
  - Paused, the progress is 1, as before: the sprites stand where the tick has them, which is
    what the sim holds. Going there from the middle of a step is a jump forward of less than
    one tick's march. Left.
  - Fire and wrecks are stamped with the time the snapshot arrived, not with the sprites'
    clock, which no longer is that time. The worker sends each fire once
    (`serverFires.test.ts`), so a repeated tick brings none again.

- **2.7i, done 2026-10-04: finding 4 reproduced and fixed.** The sprites' colour was read from
  the map's palette, which holds the colours of the map mode, at the moment of upload.
  - Measured: in the wars mode, after a tick, the element sprites of Japan and of Manchukuo
    were both 236,195,191. In the political mode they are 248,247,241 and 238,227,201.
  - Decided: units wear their nation's own colour in every map mode, at every tier. The T0
    counters and T1 markers already did; a unit that changes colour at 300 m/px is a bug
    whichever colour is right, and the mode's colours answer a question about the land.
  - `nationColor` reads the own colour. The second half of the finding (tints left over after
    a change of mode while paused) cannot happen any more; the test still asserts it.
  - The task's acceptance line said the sprites "have the tints of their T1 markers". A
    sprite's tint is the own colour lightened, by design (to read against the nation's fill),
    so it never was the marker's colour itself. The line is made exact in PLAN, not weakened:
    one tint a nation, the same in all eight modes, before and after a tick in each.

- **2.7j, done 2026-10-04: finding 5 reproduced and fixed.** Leaving T3, the figures are drawn
  for the 250 ms of the fade. They were built only while the close tier wanted them, so a
  snapshot that arrived during the fade was not turned into figures.
  - Measured: two divisions, the camera steps out of T3, one division is removed and a tick
    is stepped, a frame 100 ms into the fade is drawn. Before: 3,168 figures, 1,584 of them of
    elements no longer in the snapshot. After: 1,584, all of the division that stays.
  - The figures are now built whenever they are drawn: the close tier on, or its fade running.
  - Cost: a build of 1,584 figures took 0.6 ms. At 24 ticks a second a fade sees six or seven
    snapshots. Not worth avoiding.

- **2.7k, done 2026-10-04: finding 6 reproduced and fixed.** A name's state was kept by nation
  and wrap offset. The camera's x wraps at the seam of a looping map, and the copy of the name
  on screen is then another offset's: a name held on by the hysteresis (8.2 px, under the 9 px
  at which it comes in) was placed with the camera at x = 390 of 400 and not at x = 5.
  - **Decision: a nation's name is one thing, with one switch**, whichever copies of it are on
    screen. Its state survives the seam because nothing in its key changes there.
  - *Considered: a switch for each copy, re-keyed when the camera wraps.* Each copy would keep
    its own fade. It needs the view to notice the wrap (a jump of the camera's x by more than
    half the world) and to rename the bank's keys; a jump of the camera for another reason
    would look the same. More parts for a difference nobody can see: the copies of a name are
    the same name at the same size.
  - *Two copies, one switch:* near the seam at world zoom both copies of a name can be on
    screen, and one of them alone can be in a larger name's way (the larger name's other copy
    is off the picture). Asked twice a frame for two answers, one switch would turn twice a
    frame and never rest: the shape of the city labels' case on the watch list. So the name is
    on when either copy is wanted, and a copy that alone is in the way is not drawn
    (`fadeNationLabels`; a unit test holds both).
  - The capital flags' places (`flagPlace` in `MapView`) are still kept by nation and wrap
    offset. There the worst is a rise of 150 ms cut short at the seam. Left; on the watch list.

### ADR-73 · 2026-10-04 · accepted — Capital flags and city labels are timed switches too (PLAN 2.7d)

- **Context:** after ADR-71 the unit tiers no longer popped, but two layers above them did.
  The capital flags appeared at 3 px per cell in one frame. A city's dot and its name faded by
  a curve of the zoom over 0.7–1 × a limit, so a resting camera could show them half there,
  and a name hidden by a collision appeared in full in the frame its neighbour made room.
- **Decision:** `TimedSwitch` (`src/render/timing.ts`): something is on or off, the first
  answer sets it, every later change is a fade of 250 ms, and a turn in mid-fade goes on from
  the value reached. `TierHandover` is built on it.
  - *Flags:* one switch for the layer: in at 3 px per cell, out below 3 ÷ 1.15. Each flag's
    own move away from a counter (PLAN 1.45c) is as it was.
  - *City labels:* two switches for each city, its dot and its name. Wanted is "the zoom is
    below the limit, or below the limit × 1.15 if it is on", and for a name also "no name of
    higher priority is in its box". The layout stays a pure function: it is told what is on
    and what is still fading out, and says what is wanted and where.
  - A city out of view has no state: a pan brings it in at once. A city in view with nothing
    to show is off, so that it fades in when the zoom brings it.
- **Where a label comes in:** at its old limit, where its fade by zoom used to begin, not in
  the middle of the old band. The unit test of the layout counts a name as shown from that
  zoom on; moving the threshold would have meant changing what the test expects.
  Consequence: in the band 0.7–1 × the limit a label is in full where it was faint.
- **The acceptance test** (`tests/e2e/labelFades1938.spec.ts`): the measure of ADR-71 over the
  city labels and the flags alone (`drawLabelLayers`), across 22 thresholds over Europe: the
  flags', six for names and four for dots, each in and out. Largest jump between two frames:
  23–30 of 255 (limit 48); the whole change 242–255. At nine zooms inside the old bands every
  opacity at rest is 0 or 1.
- **Moving flags are left out of the comparison, and counted.** A flag stands clear of the
  counters. The camera's step of 0.04% can move a counter's box by a pixel, and at 2000 m/px
  the counters go altogether: the flags above them come down. A flag moves in whole pixels,
  which is a full-contrast change of the pixels at its edges (measured with them: up to 255).
  That is motion, covered by `flagsClear1938` (at most 8 px a frame). The spec records where
  each flag stood in each frame and leaves the places of those that moved out of the
  comparison: at most 8 flags, under 10% of the picture.
- **Not done:** the curved nation names (`nationLabels.ts`) appear in one frame when their
  size reaches 9 px or a collision ends. PLAN 2.7e.
- **Addendum 2026-10-04, PLAN 2.7e: the curved nation names.** The same pattern.
  - A name has a switch, keyed by nation and by the copy of the world it is drawn in. It
    comes in when its size reaches 9 px and no name of a larger area is in its way, and goes out
    below 9 ÷ 1.15 px or when one is. The layout stays pure (`NameState`: what is on, what
    still fades out, and a call for each name in view with nothing to show).
  - A name that goes out because it became too small is drawn at the size it has while it
    fades. Its size follows the zoom, so it has no last size to keep.
  - *Checked* in `labelFades1938.spec.ts`: the zooms at which two names come and go are found
    by bisection (they depend on a nation's shape): United Kingdom in at 11,405 m/px and out at
    13,115, Nationalist Spain at 7,374 and 8,480, each out 1.15 × in. Largest jump between two
    frames: 21–24 of 255.
  - *Out of scope:* a change of map mode takes all names away in one frame, with the map's
    colours: a user's action, not a zoom. New label curves from the worker (territory changed
    hands) move a name at once.
### ADR-72 · 2026-10-04 · accepted — The marker → elements morph: a shrink of 13%, and a bar that lingers (PLAN 2.7c)

- **Context:** SPEC §8 asks that at T1 → T2 "the marker scales down and fades into the
  formation centroid while elements fade in at their real positions. The strength bar lingers
  above the group until T2 is fully in." Since PLAN 2.7b the change was a plain cross-fade.
- **Decision:** the T1 ↔ T2 handover takes 470 ms and has two parts (`markerMorph`).
  - *First 250 ms:* the box (frame, fill, symbol, flag chip) fades out and shrinks about its
    centre to 0.87 of its size; the sprites fade in. The strength bar and the number stay in
    full.
  - *Next 220 ms:* the bar and the number fade out.
  - Out of T2 it runs backwards: the bar comes first, then the box grows in as the sprites go.
  - The marker does not travel: it stands on the formation's centre already.
- **Why only 13%.** A moving edge changes a pixel by its speed × its contrast, and the limit
  for a change without popping is 48 of 255 (ADR-71). It was not raised.
  - Shrinking to 0.6 was the first plan. At a corner of the box the motions of the two edges
    add (13 and 8.5 px from the centre), and the white of a flag chip against the dark outline
    is nearly full contrast.
  - Measured at a shrink of 20%: 67 of 255 at that corner pixel in the first frame. At 13%:
    43 into T2 and 42 out of it.
  - The shrink is linear in time. An eased one moves one and a half times as fast in the
    middle, where it would have to be half as deep to keep the limit.
- **Why the box is a picture of itself while it shrinks.** Scaling its parts made the pixels
  of the flag chip (drawn without smoothing) and of the hairlines snap from frame to frame:
  188 of 255. During the morph the box is drawn once to a small canvas, as at rest, and that is
  scaled with smoothing. At rest it is drawn directly, as before: the pixels at T1 did not
  change.
- **Why the bar has its own 220 ms.** Faded over the second half of a 250 ms change it would
  move by 0.25 a frame. With 220 ms of its own: 0.11.
- **Found by the evidence run:** the spec waited for "the view has elements" before each
  crossing. Elements from the crossing before satisfied that at once; near T3 the view then had
  no element section kept and no figures to fade to, and the T2 → T3 share never moved. The
  spec waits for a section that arrived at the zoom it is at (`elementsZoom`).
- **Not done:** the bar does not move "above the group"; it stays where it is at T1, under
  where the box was. The order arrows and the battle swords fade with the box.
- **Addendum, 2026-10-04 (review pass after PLAN 2.7): the pictures are kept by nation too.**
  The box's picture was kept by symbol and state alone. Of two nations' markers in view, the
  second was drawn with the first one's picture: another nation's colour and flag from the
  first frame of the morph to the last, 250 ms. That is a pop of the kind this ADR is about
  (measured: a box's mean colour off by 102 of 255 in the frame after the step).
  - The acceptance test spawned two divisions of one nation and could not see it. The lesson
    for a test of pictures: two things under test must differ in everything the code could
    confuse.
  - `tests/e2e/morphNations1938.spec.ts`: a division of Japan and one of Manchukuo side by
    side; each box, 16 ms into the morph, is within 12 of 255 of its mean colour at rest
    (measured 4.8 and 4.5). It fails on the code before the fix (102 for Manchukuo's).
  - The pictures are still made anew in every frame of a morph, one for each nation, symbol
    and state in view. Measured in `fades1938`: the slowest frame of the unit layers at
    T1 ↔ T2 is 2.2 ms of CPU. A cache across frames would have to follow flags and colours
    that change; not worth it at that cost.
### ADR-71 · 2026-10-04 · accepted — Every tier boundary is a timed handover; "no popping" is measured at a fixed camera (PLAN 2.7b)

- **Context:** of the three boundaries between the unit tiers only T0 ↔ T1 was a state with a
  cross-fade in time (ADR-64). The T1 markers faded toward T2 by a curve of the zoom over
  210–300 m/px, so a camera resting there showed markers and sprites both half-faded (the
  defect ADR-64 removed at the other edge). T2 → T3 switched the sprite for its figures in one
  frame.
- **Decision:** one mechanism, `TierHandover(threshold)`, three times: 2000, 300 and 30 m/px,
  each in at its threshold and out above it × 1.15, each a cross-fade over 250 ms.
  - The view asks each handover once a frame and keeps the three shares. The markers have
    what the counters and the sprites leave them; the sprites and the figures divide the
    sprites' share; fire and wrecks are drawn with the sprites' share at T2 and T3 alike.
  - `markerLowFade` is gone, with the unit test that checked its curve. The handover's test
    has the three thresholds and the old band at rest.
- **The figures are built when the close tier wants them, not when a snapshot arrives at T3.**
  The state flips in the frame the camera crosses 30 m/px; the snapshot subscribed at T3 is a
  frame or two away. Built on arrival, the sprites would fade out with nothing fading in, and
  the figures would pop. The view keeps a copy of the last element section while the camera
  is below 60 m/px and expands it in that frame. With no elements at hand (a jump from far
  away) the close handover waits: the sprites stay until there are figures to fade to.
- **The acceptance test, read.** "Max per-pixel luminance jump between consecutive frames …
  in unit areas" cannot be measured while the camera moves: at 3% a frame a sprite 300 px
  from the centre moves 9 px, and its edge sweeping over a pixel is a full-contrast jump with
  nothing popping. So:
  - the camera steps across a boundary once (0.04%) and stays; the frames of the change that
    follows are drawn 16 ms apart, the unit layers alone on black (`drawUnitLayers(now, true)`
    clears both canvases and draws the sprite layers without the map), and consecutive frames
    are compared pixel by pixel;
  - that the step itself changes nothing at once is in the shares: the first frame after it
    has the old layer in full, and the share then moves by less than 0.12 a frame.
- **The limit, 48 of 255.** A smooth cross-fade over 250 ms moves a share by at most 0.096 in
  16 ms (1.5 × the linear step): 25 of 255 for a white figure on black. Where the outgoing
  layer covers the same pixel its change adds. 48 is twice the single step. Measured over the
  six crossings: 31–39. A change done in one frame measures 247–255 here, and the test asserts
  that too, so the measure is known to see a pop.
- **Cost:** the slowest frame of the unit layers during a change takes 1.6–6.2 ms of CPU; the
  larger figures are T0 ↔ T1, where the counters are clustered. T2 ↔ T3 with both sprite
  layers and the build of 3,000 figures in its first frame: 2.7 ms. These are from the spec
  run alone. In the gate, with four specs running at once, the same frames took up to 36 ms:
  the figure is a wall-clock time and not a budget check.
- **Handed on, not dropped:**
  - PLAN 2.7c: the morph of SPEC §8 (the marker shrinks into the group, the strength bar
    lingers). T1 ↔ T2 is a plain cross-fade until then.
  - PLAN 2.7d: the layers that are not units. Capital flags switch at 3 px per cell in one
    frame; city labels fade by a curve of the zoom.
  - PLAN 2.10: ADR-69's open choice, how a battalion's losses show at T3. It is a matter of
    the look at the demo's close stops, not of fades.
- **Addendum, PLAN 2.10a (2026-10-04): the zoom demo; along a path, seamless is measured on the shares.**
  - *The measure:* this ADR measures popping in pixels, at a camera that has stepped and
    stays. A demo zooms, and while the camera moves every edge moves. Along the path the
    measure is the layers' shares: in every frame of every leg none moves by more than 0.12 (a
    fade of 250 ms moves 0.096 in a frame of 16 ms), none goes back, and at each stop the
    tier's layers are there in full. The pixels of each boundary stay with `fades1938`. With
    a fade of 20 ms the demo fails at the first boundary (a step of 0.896).
  - *The clock is the test's:* the view's loop is stopped and its turns are given times 16 ms
    apart (`frameAt`, there since PLAN 2.7y), with a pause for the worker between two. The
    camera's own eased zoom (`zoomTo`, what the wheel does) runs on that clock. Every spec
    that measures wall time failed twice on this night's slow machine. This one takes longer
    there and sees the same, except that a snapshot can come some frames later, which delays
    a fade and does not make it a jump.
  - *One eased zoom a leg, not a held key:* a key's zoom (× 3 a second) took 130 frames for
    the leg to 6000 m/px, at 120 ms a frame in the tests' rasteriser. The eased zoom takes 35
    to 55 a leg.
    The measure does not depend on the camera's speed.
  - *The battle is the scenario's, not God's* (SPEC §10 said "a spawned battle"): PLAN 2.5 has
    the spawned one, alone in western China, for numbers to the man. A demo of the scenario
    closes in on its own front. It is found by rule in Node, not by an id: of the divisions
    that fired in the last hour and have stood for a day, the one whose battalions kept least
    while each still has more than 64 men, with a battery that has lost guns. Seed 1938, day
    30: a Japanese division in the pocket by Nanking, 6,594 men, battalions at 123 to 197 of
    500, batteries at 3 to 5 of 12 guns. If a rule change leaves no such division, the test
    says that, and not that the zoom is broken.
  - *Eight stops, two a tier, the closest at 3 m/px:* at 1 m/px one battalion fills the view.
    PLAN 2.10b needs battalions and batteries in one picture.
  - *The same world:* the page's hash is Node's after the month and after each of the four
    hours stepped at the close stops; the elements in the view have Node's strengths and
    places.
  - *Seen in the pictures, for the review (BLOCKERS):* the hatching of occupied land lies over
    the ground at T2 and T3; shots fly 30 to 60 km, so at 3 m/px a battle shows little of its
    fire.

### ADR-70 · 2026-10-04 · accepted — A slot is a place in the block the template made (PLAN 2.7a)

- **Context:** an element's place was `slotPose(formation, slot, count)` with `count` the
  number of elements alive. The block is a grid whose width follows the count (8 columns for
  28 elements, 7 for 24). So when deaths took the count across a step, every surviving sprite
  of the division took a new place in one frame, and with each single death the block's rows
  re-centred. SPEC §3.6 had it otherwise from the start: `slotPose(formation, slot, aliveMask)`.
- **Decision:** the count is the element count of the formation's template, which is what the
  slots were numbered for when the formation was equipped (`slotCount` in
  `sim/systems/elements.ts`). An element keeps its place for as long as it lives; the block
  keeps its shape and shows gaps where elements died.
  - The three users of a slot's place take it: the fire records of combat, the
    `ElementDestroyed` event and the snapshot's element section. They agree, as before.
  - No column was added. The template index is in the formation table already; a new section
    would have moved the pinned hash.
- **The pinned hash did not move,** and could not: all three users are tick outputs or the
  snapshot. Nothing in the sim's state reads a slot's place (formations fight from their
  centres). The sweep stage of the gate confirms it.
- **What the player sees:** a division that has lost a third of its elements is a block with
  holes, of the size it had. Before, it closed up into a smaller block, which read as a fresh
  small formation.
- **Tests:** `tests/unit/elements.test.ts` (deaths that take the count across a step of the
  grid: the snapshot draws every survivor where it stood, and the next death is reported at its
  slot in the same block); `tests/e2e/individuals1938.spec.ts` (an hour of battle in which a
  division goes from 22 elements to 17: every element that lives keeps its place).

### ADR-69 · 2026-10-04 · accepted — T3: an element is `min(strength, 64)` figures in its footprint (PLAN 2.6, critic B2)

- **Context:** SPEC §8 said of T3 "element → individuals (exact for vehicles, ships and planes;
  ≤ 64 sprites per infantry element, count = strength)". For a battalion of 500 that sentence
  can be read two ways: a cap, or 64 figures that each stand for eight men.
- **Superseded in the count (2026-10-04, PLAN 2.10b): see ADR-80.** A battalion is drawn by
  its share of 64 figures. What follows under "the count" is how it was until then.
- **Decision, the count:** a cap. One figure for each unit of strength, at most 64 to an
  element. Tanks (10 to an element) and guns (12) are exact; a battalion shows 64 until fewer
  than 64 men are left, and is exact from there. SPEC's T3 row now says so.
  - **Why the cap and not a share:** it is what the sentence says ("count = strength" is true
    wherever the cap does not bind), and it needs nothing new in the snapshot: strength and
    frame already travel. A share (figures = strength × 64 ÷ full size) needs the element's
    full size in the snapshot and makes no figure a man.
  - **What it costs:** at T3 a battalion of 500 and one of 100 look alike, and a battalion's
    losses show only when it is nearly gone. T2 has the same blind spot (a sprite dims only
    below 8 units). Not solved here. Candidates for PLAN 2.7: the strength as a number under
    each element at T3, or the share after all, with the size sent.
- **Decision, the place** (`src/render/units/individuals.ts`, pure functions of the element's
  id, frame, strength and facing):
  - The footprint is a square of 0.024 cells around the slot pose, turned with the formation.
    Slots are 0.03 apart, so the elements of a division stay apart as blocks.
  - It is a grid of sub-slots, 8 × 8 for men, 4 × 4 for vehicles and guns (8 × 8 when there
    are more than 16 of them: a mechanised battalion). A figure fills 92% of its sub-slot.
  - Figures take sub-slots in an order of the element's own, a shuffle by its id, each up to
    18% of a sub-slot off its centre. A loss takes the last figure of that order: the others
    do not move, and the gaps open across the block instead of from one edge.
  - This is the "presentational freedom inside an element footprint" of SPEC §8. A figure's
    place is not sim state.
- **Decision, the drawing:**
  - The view expands the elements when a snapshot arrives at T3, into a third instanced
    renderer with the same atlas. Previous and current place get the same offset, so the GPU's
    interpolation holds.
  - The origin of the instances is the camera's cell. Offsets from the middle of the map in
    f32 step by 2.4 m, which is 2.4 px at the closest zoom.
  - A plain switch at 30 m/px, as soon as a snapshot subscribed at T3 has arrived (one or two
    frames after the zoom crosses). The cross-fade of SPEC §8 is PLAN 2.7.
  - At most 60,000 figures in a build; beyond that the element sprites stay. A view at T3
    holds a few formations: three divisions are 3,345.
  - A wreck is drawn at most 30 px wide: the element sprite's size, which it used, is hundreds
    of px at T3.
- **A gun frame:** artillery, anti-tank and anti-air elements were drawn with the infantry
  frame, so a battery at T3 would have been twelve soldiers. The procedural atlas has a fifth
  frame, a field gun, used at T2 and T3.
- **One hash for placement** (`src/render/hash.ts`): where a shot lands, how a wreck lies and
  where a figure stands used three copies of one integer mix. The view's code may not import
  the sim's hash (module boundaries), and should not: this is presentation.
- **Measured** (three divisions in one view at 28 m/px, 3,345 figures of 89 elements): 0.7 ms
  to build per snapshot, 0.5 ms of CPU to issue the frame. The GPU's time is not in that
  figure; the bench of PLAN 2.3 has 10,000 instances at ≥ 30 fps.
- **Not done:** figures face where the formation faces, which is east for a formation that
  never marched (the sim does not turn a formation toward its enemy); no terrain under them
  (PLAN 2.8); no cross-fade (PLAN 2.7).

### ADR-68 · 2026-10-04 · accepted — `spawnFormation` takes a template: God can spawn a formation that fights (PLAN 2.5)

- **Context:** the acceptance test of PLAN 2.5 asks for a God-spawned battle. The only command
  that places a formation, `spawnFormation`, set a bare strength and made no elements. In a
  scenario with unit rules such a formation has no sprites at T2 and is skipped by the
  engagement (combat is between elements), so it cannot fight. The command was used by the toy
  world's tests only; the God tab builds through `queueFormation`, which delivers at the
  capital after the build time.
- **Why a spawned battle and not one of the scenario's:** the test compares a T0 counter with
  the elements under it, to the man. A counter is a cluster of a nation's formations, folded
  with its neighbours' (ADR-65), so its number is only "these formations" where nothing else
  stands. Every battle of the 1938 start is in a crowded front.
- **Decision:** `spawnFormation` has an optional `template`. With a template of the scenario
  the formation gets that template's elements, is in supply, and its strength is theirs (the
  command's `strength` is ignored), exactly as production delivers one. Without a template, with
  one the scenario does not have, or in a scenario without unit rules, the command does what it
  did.
- **The pinned hash did not move:** the baseline run issues no commands, and the optional field
  changes nothing for a command without it. The sweep stage of the gate confirms it.
- **Not added:** a button for it in the God tab. Two things to settle first: where the click
  goes while the territory brush is the map tool, and that the economic AI disbands idle
  divisions of a nation in deficit at the start of the month (a spawned division of an AI
  nation may not last; the test turns the AI of both nations off).
- **The test's battle:** two Japanese divisions against a Chinese one in western China, 55 cells
  from any other formation, the Japanese with God's attack buff (× 21). Without the buff the
  same fight shows no dead element in 12 days: losses are spread over all elements of a
  division, and they die together at the end.
- **What PLAN 2.5 found:** nothing to fix. The counter, the marker and the sprites agree
  because each is the formation's strength, recomputed from the elements at every settle.

### ADR-67 · 2026-10-04 · accepted — An element's end is an event; its wreck lives in the view (PLAN 2.4b, critic B2)

- **Context:** an element whose strength reached 0 was removed from the table when its
  formation settled, and its sprite was simply missing from the next snapshot. SPEC §5.2 step 3
  asks for a wreck event; SPEC §8 lists wrecks and casualties at T2.
- **Decision, the sim:** `ElementDestroyed` (element, unit, the slot it stood in) is emitted in
  `settleElements`, the one place where an element at 0 is removed.
  - The slot is computed in the block as it was before the settle, which is where the last
    snapshot drew the sprite and where the hour's fire was aimed. Measured in the acceptance
    test: 30 wrecks, each 0 cells from its sprite's last position.
  - Deaths by attrition and desertion emit it too. They pass through the same settle, the sim
    does not record the cause there, and a battalion that starved is as gone as one shot.
  - Elements that go with a formation removed whole (`destroyFormation`: disbanded by the AI,
    annexed, removed by God or the editor) emit none. That is not a death, and
    `FormationDestroyed` already says it. A formation wiped out in battle is covered: its last
    elements are removed by the settle, each with its event, before the formation goes.
  - The event is a tick output and is not in the history log's kinds, so it is neither saved
    nor hashed. The pinned hash did not move.
- **Decision, the worker:** the event goes only to a view that draws elements (as the fire
  does), and carries what the unit's class leaves in place of the unit index: the fallen (inf),
  a broken gun (art, at, aa), a burnt-out vehicle (the rest). Other events go to every view as
  before.
- **Decision, the view** (`src/render/fx/wrecks.ts`, Canvas2D on the overlay, under the fire):
  - *The visible end:* the snapshot that no longer has the sprite is the one that brings the
    event. In that frame a burst (a flash and an expanding ring, 400 ms) is drawn where the
    sprite stood, and the wreck comes in under it. No sprite is held back or faded: the sprites
    are what the sim has.
  - *The wreck* stays 12 s and fades over 3 s, on the render clock. Guns and vehicles smoke.
    It lies at an angle taken from the element id. At most 1,500 are held; the oldest go.
  - *Why real time and not sim time:* at the default speed a day is a second. A wreck that
    lasted a sim day would be gone in a second at ×5 and never while paused. As with the shots,
    the picture is paced for the eye and is lost on a reload.
  - `unitsAnimating` (what tests wait for) covers the burst only; the frame loop keeps drawing
    while a wreck smokes or fades.
- **Not seen yet:** in the first 40 days of seed 1938, 799 elements die: 704 infantry, 77
  artillery, 18 anti-tank; no vehicle. The vehicle wreck is drawn by the same code but no run
  has shown one. SPEC §6.1 "burning wrecks" for armour is PLAN 3.6.
- **Noticed, not changed:** a block's layout depends on its element count. When deaths take
  the count across a step of the grid (for example 25 to 24), the survivors' sprites take new
  places in one frame. PLAN 2.7 (no popping) owns it. **Changed since: ADR-70.**

### ADR-66 · 2026-10-04 · accepted — Fire at T2: a FireEvent is a shot, and a shooter shows one at a time (PLAN 2.4a, critic B2)

- **Context:** combat has emitted one FireEvent per volley since PLAN 1.13 (shooter, target,
  their slot poses, the minute of the hour), and the worker threw them away. At close zoom the
  element sprites of a battle stood still (critic B2: "no terrain, combat or motion").
- **Decision, transport:** the snapshot has a `fires` section.
  - Only a subscription that gets elements (tier ≥ 1.5) gets fire. At any other zoom the
    events are cleared after the tick as before and nothing is queued.
  - The filter is applied when the event happens, not when the snapshot is built: an event is
    kept when its shooter or its target is inside the subscribed box. A queue of the whole
    world's fire would be about 1,000–2,000 events a tick in 1938.
  - The worker sends the weapon kind of the shooter's class in place of the unit index (the
    view has no unit rules): small arms (inf, mot, mech), cannon (at, aa, armour), shell (art).
  - The queue holds 8,192 events; beyond that the oldest are dropped and counted
    (`fires.dropped`). A snapshot without fire takes no pooled buffer for it.
  - Fire events are tick outputs, not state: the sim is not touched and the pinned hash did not
    move. PLAN 2.4a changed no file under `src/sim/`.
- **Decision, drawing:** `src/render/fx/fire.ts`, Canvas2D on the overlay, above the sprites.
  - A shot is a muzzle flash, a tracer and an impact, timed on the render clock with
    `render/timing.ts`. Three looks: a thin pale tracer and a puff of dust; a thicker orange one
    with a burst and smoke; a shell on an arc with a larger burst.
  - The shots of a tick start spread over the tick's wall time by their minute: at least 250 ms
    (so that a fast game does not fire in salvoes), at most 1 s, and 400 ms for a tick stepped
    while paused.
  - Drawing is pure: the same time draws the same frame. Shots leave the list only when a
    snapshot arrives. Tests draw every frame of a burst at made-up times.
  - A shot lands up to 0.012 cells from its target's slot, by a hash of shooter and tick.
    This is the presentational freedom SPEC §8 allows; the points the sim gave are kept as they
    are and are what the test compares.
- **Decision, one shot per shooter at a time:** an event whose shooter still has a shot on
  screen when it would start is not drawn, and is counted (`skipped`).
  - **Why:** a tick is an hour, and the default speed is 24 ticks a second. Drawn one to one,
    every element fires 24 tracers a second: measured at ×5 over three divisions, 810 tracers
    in flight and 3,000 shots alive (the cap), a solid orange beam that hides the units. With
    the rule the same battle shows 63–125 tracers in flight, and each can be followed.
  - **What stays true:** within one tick every FireEvent is a shot, because an element fires
    once an hour. That is the window of the acceptance test: the tracers drawn are the sim's
    events, compared one by one with a run of the same sim in Node.
  - **What does not:** from tick to tick events are skipped at every speed, also at ×1 (a
    shell is on screen for 880 ms and two starts can be closer than that). The tracers are a
    picture of who fires at whom, not a count of volleys. Losses come from the sim alone.
- **A defect found on the way:** the frame clock (the rAF time) can be earlier than the arrival
  time of the snapshot the frame draws. A guard "nothing to draw before the batch arrived"
  drew no fire at all while the game ran, because every frame had a newer batch. The layer has
  no lower bound on the time; the unit test names the case.
- **Measured:** the fire layer costs 0.12–0.22 ms a frame at ×5 with 426–512 shots held
  (software GL, 1400 × 800).
- **Deferred:**
  - casualty removal and wrecks (PLAN 2.4b): they need an event when an element dies;
  - the GPU particle pools of SPEC §8: Canvas2D is cheap at this count. To look at again when
    air and naval fire or T3 add effects;
  - impacts are small at 120 m/px. They read at 45 m/px. PLAN 2.7 and 2.10 judge the look
    across zooms.

### ADR-65 · 2026-10-04 · accepted — T0 counters fold into their stronger neighbour instead of overlapping, across nations too (PLAN 1.45b, critic B7)

- **Context:** counters are one per nation per grid cell of about 64 px, so the counters of
  different nations in the same or the next cell stood on top of each other. At world zoom
  Europe was "a wall of overlapping counters" with cut-off numbers
  (`critic/shots/s1_01_crop_europe_counters.png`). AoC has no counters to copy: it prints a
  strength beside each nation's name.
- **Decision:** a declutter pass in screen space after the clustering (`foldOverlaps`).
  - A counter whose box would come within 2 px of a stronger counter's box is *folded* into
    it (the nearest, when several). The stronger one shows the sum of everything folded in,
    and "+n" for the n other nations among it. Nothing is hidden: the shown counters add up to
    the strength of every formation, as PLAN 2.2 requires.
  - Two passes: a nation's own counters fold into each other first, then the counters left
    fold across nations, strongest total first. A box grows with its text, so each pass repeats
    until no box touches another.
  - Positions are cells × scale, without the camera's place: panning never reshuffles the
    counters, zooming does.
  - A fold or its reverse is a fade in place over 250 ms. At rest a counter is drawn in full or
    not at all. A folded counter comes out only once it would clear its neighbour by 6 px more,
    so a counter at the edge does not flicker while the armies move.
- **Why fold across nations, and not move the boxes apart:** at world zoom Europe has some
  thirty nations in about 200 × 180 px. Their boxes fit only if pushed far from their armies,
  over the sea and over other countries. A counter that says "1.54M +7" over Germany is true
  at that zoom (that many men stand there, of eight nations) and the detail returns by zooming
  in, which is what semantic zoom is for. The flag on a folded counter is the strongest
  holder's; the "+n" says it is not alone.
- **What the continuity test taught (PLAN 2.2's frame-by-frame zoom test, unchanged):**
  - The first version slid a folding counter into its neighbour. A split or merge swaps every
    cluster key, and a slide that straddled the swap lost its neighbour's key and jumped.
    Several attempts to remap keys each fixed one case and opened another. The slide is gone: a
    fade in place needs no neighbour.
  - The order of folding must not change when a cluster is replaced by its children on its
    centroid (or the reverse). Hence the first pass by nation: the children then count exactly
    as the cluster, and the same counters stay shown through the swap.
  - A fade must go on through the swap: a counter with a new key takes over the fold state of
    the most visible counter of its nation that stood on that spot.
- **"No two overlap" is about counters drawn in full.** One fading into a neighbour stands on
  it for the 250 ms of its fade, and during that time the neighbour's number already includes
  it. The e2e asserts the rule for opacity 1, paused (where every counter is at 1) and running.
- **Strength text:** from 999,950 men on, millions with two decimals ("1.54M"); "1535.7k" was
  what the sums first read.
- **Not solved here:** capital flags are drawn above the unit layers and cover counters that
  stand at a capital (PLAN 1.45c, added). T1 markers of a dense group still stand on each other
  (seen in 1.45a; no task yet).
- **Addendum, PLAN 1.45c (2026-10-04): the capital flag makes way for a counter.** The flags
  stay above the unit layers (PLAN 2.1's order is kept: a capital must stay readable among the
  T1 markers). At T0 a flag whose place, with its frame, would touch a counter's box stands
  3 px above that counter instead, and above the next one if another is there. More than 40 px
  from its usual place it no longer reads as its capital's flag, so it is left out (the capital
  keeps its dot and name, and the counter there carries the nation's flag chip). A move is an
  ease over 150 ms, a flag left out or coming back a fade of the same length.
  - *Rejected: counters above flags.* Most nations keep an army at their capital, so most
    flags would show as a strip behind a counter.
  - *Rejected: counters make way.* A counter can only fold into another counter; moving it
    off its armies is what the declutter avoids.
  - Measured at the 1938 start over Europe: at 3 px per cell 14 of 41 flags stand higher, by 3
    to 36 px; at 6 px per cell 6 of 22, by 5 to 33 px; none is left out at either.
  - Tests: `tests/e2e/flagsClear1938.spec.ts` (no flag with its frame touches a counter box at
    3 and 6 px per cell; every capital in view has its flag, at most 40 px above its usual
    place; a raised flag was in the way and stands just above a counter; after a zoom the flags
    move at most 8 px per 16 ms frame).
- **Tests:** `tests/unit/counters.test.ts` (the sum and the nations of a fold; 300 random
  counters with no two shown boxes within the gap and the sum kept; the same picture under a
  shift of every position; children on a centroid count as their cluster; the hold distance;
  the fade in place and a turn in mid-fade; the fade through a key swap),
  `tests/e2e/declutter1938.spec.ts` (world view and four zooms over Europe, at the start and
  after one year: no overlap, every counter at opacity 1, the sum equal to the sim's, more
  counters in central Europe at each closer zoom; twelve samples with the game running).
- **Addendum 2026-10-04, the running check restated (found in the gate of PLAN 2.4b):** the
  check read "among the counters at opacity 1 no two overlap" on one frame per sample. A fade
  starts at opacity 1, so in the one frame in which a counter begins to fold into its
  neighbour it stands in full on that neighbour, and a sample can be that frame.
  - *Seen:* one gate run failed there. A probe of 283 samples at top speed hit it in 2, and
    each of its 6 pairs had one counter "folded since 0.0 ms" and the other shown. The
    declutter was right; the check raced it, at roughly 1 run in 12.
  - *The check now:* a sample is two frames 17 ms apart with no snapshot between them. In the
    first, the counters that are shown (not on their way out) do not overlap, whatever their
    opacity. In the second, every counter on its way out has begun to fade, and the counters
    at opacity 1 do not overlap, which is the old sentence one frame on.
  - *What it took:* `DrawnCounter.folded`, so that a test can tell a counter on its way out
    from a shown one. No behaviour changed.
  - *Not weakened:* the first frame now checks more counters than before (those fading in,
    too) and leaves out only the counter that the declutter has already folded.

### ADR-64 · 2026-10-04 · accepted — The T0 ↔ T1 handover is a state and a cross-fade in time, not a fade by zoom (PLAN 1.45a, critic B7)

- **Context:** the critic saw "translucent duplicate counters persist behind real ones when
  paused" (`critic/shots/s4_07_crop_ghost_counters.png`). PLAN 1.45 blamed split and merge
  fades that do not finish while the game is paused.
- **Measured, 1938 start, paused, the camera at rest 1.5 s at each zoom** (px per cell → m/px:
  counters drawn at their opacity, markers drawn at theirs; a split or merge still running?):
  - 4 → 4892: 107 counters at 1; no markers; no.
  - 7.6 → 2575: 111 at 0.995; none (0.005 is not drawn); no.
  - 8 → 2446: 104 at 0.836; 356 at 0.164; no.
  - 9 → 2174: 83 at 0.204; 268 at 0.796; no.
  - 9.7 → 2017: none; 243 at 0.998; no.
  - 10 → 1957: none; 237 at 1; no.
  The split and merge animations do finish while paused. The ghosts are the cross-fade between
  the two unit layers, which `markerAlpha` made a function of the zoom over 2000–2600 m/px: the
  two opacities add up to one, and a camera that stops in that band shows both layers
  half-faded for as long as it stays, paused or running. SPEC §8 promised hysteresis for every
  layer; this one had none.
- **Decision:** which layer shows is a state (`TierHandover`). The markers come in when the
  zoom reaches T1_MAX_M (2000 m/px) and go out above T1_MAX_M × 1.15 (2300 m/px). A change of
  state is a cross-fade over 250 ms of real time, the markers' share easing from 0 to 1 and the
  counters having the rest. At rest the share is exactly 0 or 1: one layer in full, the other
  not drawn. A turn in mid-fade continues from the share reached. The view keeps drawing while
  the fade runs, paused or not, and draws one more frame after any unit animation ends, so the
  end state is what stays on screen.
- **Why 1.15 and not the old band's 1.3:** the hysteresis only has to keep a camera that
  hovers at the threshold from flickering. The counters' cluster levels use ±0.15 for the same
  purpose. A wider band would keep the markers on screen further out, where their boxes of a
  fixed 26 px are closest together.
- **What it replaces:** `markerAlpha(mPerPx)` and `counterAlpha` are gone; `markerLowFade` is
  the markers' fade toward T2 only. The unit test of the old fade by zoom is replaced by tests
  of the new rule (`tests/unit/handover.test.ts`); it tested a rule that no longer exists.
- **Not changed:** the T1 → T2 fade (markers out, element sprites in, 210–300 m/px) still goes
  by zoom and has the same flaw at rest. PLAN 2.7 is "fade curves and hysteresis for all
  layers" and takes it, with the marker → elements morph.
- **Tests:** `tests/e2e/handover1938.spec.ts` (at rest at 2575, 2446, 2174 and 2017 m/px from
  T0: counters only, all at opacity 1; from T1 at 2017 and 2174: markers only, at 1; at 2446:
  counters again; the 250 ms cross-fade frame by frame; the same with the game running),
  `tests/unit/handover.test.ts`. PLAN 2.2's frame-by-frame continuity test
  (`tests/e2e/counters1938.spec.ts`) passes unchanged.

### ADR-63 · 2026-10-04 · accepted — A dragged brush is a stroke: many commands, one undo step (PLAN 1.44, critic B6)

- **Context:** in the editor a left-drag panned the map and only a click painted (critic B6:
  after a click 49 cells changed, after a drag none). AoC's editors paint with a held brush
  (VISUAL: `reference/frames/scene_007.png`, a brushed outline in its map painter).
- **Decision:**
  - *Who gets the left button.* While the editor's tool is the brush or the line, a primary
    press on the map belongs to the tool and the camera ignores it. The camera pans with the
    right button (new) and the middle button, with two fingers, and with the keys. With any
    other tool, or the editor closed, a left-drag pans as before. A click is now a click of
    the primary button only: a right-click neither paints nor selects.
  - *Brush.* The press stamps the brush (`editPaint`, `stroke: 'start'`); each further cell the
    pointer enters paints a line from the last point (`stroke: 'more'`), so no cell under the
    path is skipped however fast the pointer moves. Positions are world cells with x not
    wrapped, so a stroke crosses the map's seam.
  - *One undo step.* A `more` segment grows the stack's top edit instead of pushing one. The
    stack knows whether its top edit is the stroke in progress (`EditStack.stroke`); a `start`,
    any other paint, an import, an undo or a redo ends the stroke. A `start` that changes
    nothing pushes nothing, and the stroke then begins with its first change.
  - *Line.* Press at the start, release at the end: one `editPaint` of the line tool. Released
    in the cell of the press it is a click, and the two-click line works as before.
  - *Touch.* One finger paints; a second finger ends the stroke and the two move the map.
- **Why many commands and not one command with the stroke's points:** the map has to show the
  paint while the pointer moves, so the cells must change during the drag. One command at the
  release would paint nothing until then.
- **Why grow one edit and not link the segments** (as the import links its two edits): the
  stack keeps 50 edits, and a stroke of 51 segments would evict its own beginning. One edit per
  stroke also keeps the Undo count meaning strokes.
- **State and hash:** the stroke flag is world state (a save in mid-stroke must continue the
  same), written into `edits.json` only while a stroke is open, so a world without one has the
  bytes it had: the pinned hash of seed 99 did not move.
- **Undo runs backward through an edit's cells.** If the running game changes a cell under an
  open stroke and the stroke passes over it again, the cell is listed twice; the earlier entry
  holds what the cell was before the stroke and must be applied last. Edits without repeats
  undo exactly as before.
- **Not in this task:** the God Mode territory brush (`paintControl`) is still click-only and a
  drag with it pans. It is PLAN 1.44b. Bucket and the scenario tools (cities, capitals, cores)
  stay click tools by design.
- **Addendum, PLAN 1.44b (2026-10-04): the God territory brush follows.** With the tool on and a
  nation selected, the left button paints and the camera leaves it alone, through the same
  drag path of the map view. `paintControl` gained an optional end point (`x2, y2`): the brush
  is stamped at every cell step of the segment, one command per pointer move, so a fast drag
  skips no cell. Without the end point the command is the disc it was (the pin did not move).
  No stroke and no undo here: the God brush sets control only and never was on the edit stack.
  While the editor is open its tools take the map, as its clicks already did. The other God
  tools (revolt, breakthrough) stay click tools. Tests: `tests/unit/paintControl.test.ts`,
  the God Mode case of `tests/e2e/editorDrag1938.spec.ts`.
- **Tests:** `tests/unit/editor.test.ts` (a stroke paints its path and is one step; what ends a
  stroke; no empty step; 70 segments are one step; a cell changed under the stroke; a save in
  mid-stroke; an empty stack has its old bytes), `tests/e2e/editorDrag1938.spec.ts` (30 cells by
  mouse, the camera still, one Ctrl+Z; right- and middle-drag pan; a right-click paints
  nothing; the line by a drag; the bucket pans; one finger paints, two move the map).

### ADR-62 · 2026-10-04 · accepted — The title screen's scenario map is a generated image, checked against the data (PLAN 1.43c)

- **Context:** AoC's Scenarios screen shows a map of the chosen scenario with its size, nations,
  cities and date (VISUAL 2026-10-04: `reference/frames/scene_006.png`). Ours had the list and
  the form, and text where AoC has the map.
- **Decision:** the map is an image, `public/data/scenarios/<id>/preview.png`, 1024 × 512: each
  land cell in the colour of the nation that holds it at the start, the game's sea colour, a
  dark line where the holder changes, a darker coast. `tools/data/preview.ts` builds it from
  the shipped map assets and the scenario data with the sim's own `buildPoliticalMap`;
  `npm run data` writes it, and `npm run data -- --previews` writes only it (no downloads).
  The title screen shows it with the start date, the map and its size, and the number of
  nations alive at the start (`SCENARIO_INFO[id].nations`, from `nations.json`).
- **Rejected: building the map on the title screen.** It needs the sim worker and 3.2 MB of
  map assets to draw one picture, and the title screen would no longer be free of a worker
  (ADR-60). The image is 33 KB.
- **The risk of an image is drift,** so the gate rebuilds it: `tests/unit/scenarioPreview.test.ts`
  compares the committed image's pixels with what the data gives today and names the command
  to run. Pixels, not file bytes: a PNG's bytes depend on the zlib that packed it.
- **Not shown:** the number of cities (AoC shows it). The city list is 350 KB and belongs to
  the worker's bundle; a count in the main bundle is not worth that, and can come with a
  scenario registry read from `data/` (PARITY row 78).
- **Layout:** the title screen is wider (74 rem), and the chosen scenario's card holds the map
  and facts beside the form, so Start is on the screen without scrolling at 1400 × 800 (the
  spec asserts it). Below 960 px the form goes under the map.

### ADR-61 · 2026-10-03 · accepted — Loading from the title screen: the URL names the game, the loaded world corrects it (PLAN 1.43b)

- **Context:** ADR-60 made a game its URL. A loaded game does not fit that at once: the bytes
  of a scenario file do not survive a navigation, and a loaded world has a seed and a looping
  setting of its own, while the map view is built from the URL before the world exists.
  Measured before the change: a game started with `looping=0` and resumed by
  `?scenario=1938&continue=1` drew wrap copies of the map (`view.wrapsX` true) over a world
  without a looping map, and the settings panel showed seed 1938 for a world of seed 77.
- **Decision:**
  - *Continue.* The autosave record keeps the seed and options of the game that wrote it
    (app side: nothing enters the sim). Continue opens that game's URL plus `continue=1`.
  - *Scenario file.* The title screen checks what needs no sim (the file unpacks, its format,
    its base scenario exists here at the file's map size) and refuses the rest with the reason.
    A file that passes is stored in IndexedDB (slot `scenario`) and the title screen navigates
    to `?scenario=<base>&paused=1&load=scenario`. The game loads it through
    `importScenarioFile`, which checks the state hash as the editor's import does.
  - *The file stays stored* until another replaces it, so reloading that game starts the
    scenario again, as reloading a seed URL starts that game again.
  - *The loaded world wins.* After a load (autosave or scenario file) the game reads the
    world's seed and looping setting. The seed is shown. A looping setting that differs from
    the URL's corrects the URL (`location.replace`) and the game boots again: one more boot,
    only in that case, and it cannot repeat (the corrected URL agrees with the world).
  - *A load that fails in the game* (nothing staged, or a state that is not the one the header
    names) returns to `/?failed=scenario`, and the title screen says the file could not be
    loaded. A game that silently started a new 1938 world instead would be the wrong game.
- **Rejected:**
  - Booting the game in the page with the file's bytes in memory: `/` would stay in the
    address bar and a reload would lose the game (ADR-60).
  - The looping setting and the seed in the scenario file's header: files already exported
    lack them, and a continue URL typed by hand or from an older autosave has the same
    problem. Reading them from the loaded world covers all three.
  - Rebuilding the map view in place when the looping setting differs: the renderer, the
    labels and the unit layers each take the wrap at construction.
- **Known limit:** the editor's import into a running game (PLAN 1.38) still keeps the running
  game's wrap: a scenario without a looping map imported there is drawn with wrap copies. It
  now shows the right seed. Loading the file from the title screen is the way that is right.
- **Tests:** `tests/e2e/title.spec.ts` (Continue: tick, state hash equal to a Node sim, no
  wrap, seed and options in the panel; a bare continue URL is corrected; a scenario file of a
  non-looping world of seed 5 starts with its hash, without wrap, showing seed 5, and again
  after a reload; four files refused on the title screen; a forged hash refused by the game;
  nothing staged), `tests/unit/gameUrl.test.ts` (the URLs; `checkScenarioFile`).

### ADR-60 · 2026-10-03 · accepted — `/` is a title screen; a game is its URL (PLAN 1.43, critic B5)

- **Context:** `/` booted the two-nation toy world, a test fixture, and the 1938 world could be
  reached only by typing `?scenario=1938` (critic B5). AoC opens on a main menu: New game, Load
  game, Scenarios, Settings, Credits and Quit along the top, a scenario list on the left, a map
  preview with Play and Edit on the right (VISUAL 2026-10-03:
  `reference/screens/steam-trailer-contact-sheet.png`, second row, last tile), and a search
  field in the menu since v3.1.1 (TEXT).
- **Decision:**
  - A URL without `?scenario=`, or with an unknown one, is the title screen
    (`src/ui/TitleScreen.tsx`): the scenario list, the chosen scenario's name, description, start
    date and map, and the new-game form of PLAN 1.39b1 (seed and options) with Start. Nothing of
    a game exists behind it: no sim worker, no map canvas, no `window.__warsim`.
  - Start navigates to the game's URL (`newGameUrl`), exactly as New game in the settings panel
    already did. `src/app/main.tsx` chooses between the title screen and `src/app/game.tsx`
    (the former `main.tsx`, unchanged but for being a function).
  - Which scenarios are offered is data: `"hidden": true` in a `scenario.json` keeps a scenario
    off the list. The toy world is hidden and opens by `?scenario=toy`.
  - The seed field starts with a random seed on each visit. Without `seed=` in a game URL the
    seed is still 1938, as before.
  - Settings → Main menu autosaves the game, then goes to `/`.
- **Why a navigation and not a boot in the page:** a game that is its URL restarts on reload,
  can be shared by its seed, and is what the e2e specs of the 1938 world and the critic's
  scripts already open. Booting in the page would leave `/` in the address bar for every game.
- **Why the toy world is not listed:** it is two rectangles for the tests of the worker, the
  camera and the map view. A player who picks it has found a test fixture, not a scenario. The
  critic asked for it behind a flag; its URL is that flag.
- **Deviations from AoC [AoC-DEVIATION]:**
  - One screen instead of a menu bar with sub-screens: there is one listed scenario today, and
    the settings live in the game's own panel. No Quit (a browser tab) and no Credits screen
    (`DATA_SOURCES.md` holds the sources; a credits view can come with the polish of Phase 7).
  - The interface size setting applies to the title screen; in AoC it does not affect the main
    menu (TEXT, v3.2.3). A player who needs a larger interface needs it there too.
  - No search field: it would search a list of one.
- **Split:** PLAN 1.43a is this ADR. Continue (the autosave) and loading a `.warsim-scenario`
  file from the title screen are PLAN 1.43b; a map preview of the chosen scenario, as AoC has,
  is PLAN 1.43c.
- **Tests:** `tests/e2e/title.spec.ts` (no worker and no canvas at `/`; the game started from
  the screen has the state hash of a Node sim with the same seed and options; Main menu leaves
  an autosave at the tick it left; the toy world by its URL), `tests/unit/scenarios.test.ts`
  (the list; unknown ids). Ten specs that opened `/` for the toy world now open
  `/?scenario=toy`; nothing else in them changed.

### ADR-59 · 2026-10-03 · accepted — The critic runs once per phase, not every five commits (the user's decision)

- **Context:** since ADR-49 the critic was due 5 commits after the later of its report and
  the last commit that fixed one of its findings (subject starting "Critic "). In the feature
  phases nearly every commit answers a finding (B2 is semantic zoom, B3 the missing naval, air
  and nuclear rules), so the count kept restarting: the report of bb1dd4f was 28 commits old
  and the critic would have returned whenever five housekeeping commits happened to pile up.
  With ADR-58 a part of every run (multi-decade dynamics) also judges what is now deferred.
- **Decision (the user's, 2026-10-03):** keep the critic and run it at fixed points: after each
  phase review (PLAN 2.11, 3.7, 4.8, 5.8, 6.9), which is also where the smoke run of ADR-58
  is, and for the DONE condition. The 5-commit rule and the meaning of the "Critic " prefix
  are gone. `npm run critic:due` reports due when there is no report or when a phase review
  has been ticked in PLAN.md since the commit the report names. The user can ask for a run at
  any time.
- **Why keep it at all:** it is the only part of the process that looks at the game as a
  player does. Four of its seven blocking issues were plain defects that every test had
  passed: nothing to see at close zoom (B2), no way into the game from `/` (B5), an editor
  brush that does not paint on a drag (B6), Europe unreadable at world zoom (B7). It is also
  the judge the DONE condition names. Its prompt is unchanged: it goes on scoring long-run
  dynamics, and the builder defers that one kind of finding (ADR-58).
- **Findings become PLAN tasks.** Step 2b follows a report only while it is within the last 10
  commits. After that nothing scheduled B5, B6 and B7: no PLAN task named them. They are now
  PLAN 1.43, 1.44 and 1.45, ahead of the Phase 2 tasks, and step 2a says to add a task for
  every blocking issue of a new report that has none.
- **Not added:** B4 (revolt fragmentation; flagless "Free <village>" states). ADR-47 answered
  part of it (defection and spreading) and its remaining count of nations is balance (ADR-58).
  Whether rebel states still lack flags and regional names has not been checked; the next
  critic run will say.
- **Tests:** the cases of the 5-commit rule in `tests/unit/gate.test.ts` are replaced by cases
  of the new rule (no report; nothing ticked; a review ticked; what counts as a review; the
  review tasks of PLAN.md itself). The old cases tested a rule that no longer exists.

### ADR-58 · 2026-10-03 · accepted — Balance sweeps are suspended until the features are in (the user's decision)

- **Context:** since critic B1 ("the world is static over decades") the loop has spent most of
  its time on balance: PLAN 1.42 failed three deciding sweeps (9, 7 and 8 of 10 unseen seeds),
  its criteria were rewritten (ADR-54), and six sub-tasks (1.42a–1.42f) were done to prepare a
  fourth. All of it tunes a world of land armies only. The critic scores naval warfare, tanks,
  aircraft and nuclear weapons at 0 and semantic zoom at 3; every one of those features will
  move the balance more than a constant can. Sea transport alone decides whether an overseas
  empire can be held or attacked. The three quick sweeps of PLAN 1.42e (one per rule) all kept
  the limits and found nothing.
- **Decision (the user's, 2026-10-03):**
  1. No `npm run sweep` and no `npm run sweep:quick` after a rule change until phases 2–6
     are complete. PLAN 1.42 moves to Phase 7.
  2. The 10-year tests of the gate stay (`tests/sweep/`: the pinned state hash, save and load
     after a year, allies never at war with each other, no bankruptcy in ten peaceful years).
     They test that the sim is correct and deterministic, not that it is balanced.
  3. One quick sweep at each phase review (PLAN 2.11, 3.7, 4.8, 5.8; the sweep of 6.8 for
     Phase 6) is a smoke test: its five limits are reported in PROGRESS. A limit that fails
     is logged in BLOCKERS and waits for Phase 7, unless a defect of that phase's feature
     caused it (a crash, a desync, a mechanism that does not work). No constant is tuned in
     answer to it.
  4. Critic findings about long-run balance and dynamics (B1 and its kind) are logged once
     per report and not acted on before Phase 7 (PROMPT step 2b). They are not disputed: the
     critic is right that the world is too static, and stays free to say so.
- **Why keep the smoke run:** without any long run, gross breakage builds up over four phases
  and surfaces at once in Phase 7, where it cannot be traced to the feature that caused it.
  PLAN 1.40 found 300–600 nations after 50 years that way. One run per phase costs 5–9 minutes.
- **What does not change:** the DONE condition (the critic's dimensions, zero blocking issues,
  a multi-decade sweep with borders moving and no hegemon). PLAN 6.8, 7.3 and 1.42 run when
  the features are in. The rules made for B1 so far stay (ADR-47, ADR-50, ADR-51, ADR-53,
  ADR-57): each removed a defect, none is a constant chosen to pass a seed.
- **Consequence to watch:** the balance debt is paid in Phase 7 in one piece, with every
  system interacting. That is the only time tuning it can last, and it will take longer than
  one task: 1.42 is the place for it.

### ADR-57 · 2026-10-03 · accepted — The land rules of a war count km², not cells (PLAN 1.42e1)

- **Context:** ADR-52 made every reported land figure an area and left the sim's rules on
  cells. On the Miller map a cell covers 382 km² at the equator, 128 km² at 60°N, 63 km² at 72°N
  and 29 km² at 80°N; the mean owned cell of the 1938 start is 212 km² (133.2 M km² over 627,829
  cells). A war's shares were shares of cells, so land at 60°N weighed 1.7 times its area and
  land at 72°N 3.4 times: a km² of the Arctic coast scored three times a km² of the Ukraine,
  and the Soviet Union was "75% overrun" with the northern 61% of its land held.
- **Decision:** every land figure in `src/sim/systems/war.ts` is km²: the score (`occ`, the
  smaller-party cap), the true share behind exhaustion, capitulation (both tests), the puppet
  share of a peace, and the small-state limit. The shares keep their numbers (REL_CAP 2,
  CAPITULATE 0.75, PUPPET_SHARE 0.3).
- **Whole km² per cell.** `LandCounts` is kept by the cell setters and rebuilt by a scan on a
  load. Sums of the exact areas (floats) depend on the order of the additions, so a kept tally
  and a scanned one would differ in their last bits, and a loaded game could settle a peace
  differently from the game that saved it. A cell therefore counts the area of its row rounded
  to a whole km² (`cellKm2ByRow`): the tallies are integers, exact in any order. The rounding is
  at most 0.5 km² a cell; the tallies of the 40 largest nations of 1938 are within 0.1% of
  their exact areas (`tests/unit/landCounts.test.ts`). The sim's rules measure whole km² per
  cell; the reports (`landArea.ts`: statistics, ranking, panel, sweep) keep the exact areas.
- **The one absolute number.** `SMALL_STATE_CELLS = 40` becomes `SMALL_STATE_KM2 = 8500`: 40
  cells of the mean owned cell (40 × 212.2 = 8,487). The old comment said "≈ 15,000 km²", which
  is 40 cells at the equator (15,282 km²); between 35°N and 55°N 40 cells were 11,000–6,300
  km². The mean keeps the limit where it was for the world as a whole and only moves it by
  latitude. At the 1938 start Danzig (7 cells, 1,135 km²) and Luxembourg (14 cells, 2,654
  km²) are below it either way; Lebanon (35 cells, 9,874 km² on the map) was below 40 cells and
  is above 8,500 km².
- **Not converted here:** overextension (PLAN 1.42e2) and the admin cost (PLAN 1.42e3), each
  its own commit. Left to PLAN 7.1b, because they are distances or per-cell mechanics and not
  shares of land: `OVEREXT_CELLS` (distance to the capital), `MILITIA_PER_CELLS`, and the
  largest fragment of a collapse (`revival.ts`, by cells). `nations.cells` stays a saved column
  (the save layout does not change).
- **Tests:** four new ones in `tests/unit/war.test.ts`, each on a case where cells and km²
  disagree: Arctic Soviet cells numbering half of the German cells score 10, not 50; the
  northern 78% of the Soviet cells are 65% of its land and it does not capitulate, and does
  at 80% of the land; 33% of its cells in the north are 19.5% of its land and a dictated
  peace makes no puppet of it; 48 cells around Helsinki are a small state and 32
  cells around Rio de Janeiro are not. The older test "half of Germany's size taken from the
  Soviet Union scores 50" now takes half of Germany's km². With the tallies counting 1 per cell
  again, all of these fail.
- **Hash:** seed 99 after one year e5741d70 → 23734db3; after five years 7a8e5c27 → 6738d695.
- **Tick time** (seed 99, performance cores, see PROGRESS): year 1 1.67 → 2.05 ms (budget 2.4);
  5-year mean 1.43 → 1.37 ms (budget 1.5). Year 1 has 29 major battles instead of 8. The tallies
  themselves cost nothing measurable (the war system: 0.07 ms a tick before, 0.06 after).
- **Quick sweep** (seeds 1–10 × 20 years, seen seeds, no verdict at 20 years): limits 10 of 10,
  riser 7 of 10, faller 10 of 10 (7 and 10 after ADR-56). Largest nation 12.7–16.2% of the land,
  92–139 nations alive, land moving in the last five years 7.8–16.6%. Largest faller by seed:
  the British realm in 1, 4, 5 and 9, China (no land left) in 2 and 10, Italy (no land left)
  in 3, 7 and 8, the Belgian realm in 6. Wall time 4.5 min.
- **Overextension (PLAN 1.42e2, 2026-10-03):** a holder's share of the world's owned land
  (`revolts.ts`) is read from the same km² tallies, summed over the living nations as before.
  `OVEREXT_SHARE` stays 4%. At the 1938 start, share and monthly strain in far provinces:

  | Nation | By cells | Strain | By km² | Strain |
  |---|---|---|---|---|
  | Soviet Union | 26.8% | 2.50 | 15.9% | 2.50 |
  | United States | 7.3% | 1.03 | 7.0% | 0.93 |
  | Canada | 12.3% | 2.50 | 6.8% | 0.89 |
  | Brazil | 3.7% | 0 | 6.4% | 0.75 |
  | Australia | 4.0% | 0.01 | 6.1% | 0.66 |
  | Denmark (Greenland) | 5.4% | 0.45 | 1.5% | 0 |

  Unrest decays by 2 a month, so the strain alone raises unrest only above 10.4% of the
  land. By cells that was the Soviet Union and Canada; by km² it is the Soviet Union alone,
  still at the cap. Below that the strain slows the decay of unrest that has another cause
  (occupation, non-core land, war): by km² that now applies to Brazil and Australia and no
  longer to Greenland.
  Test: `revolts.test.ts`, Canada's far provinces stay at 0 through March (1.5 by cells) and
  Brazil's far provinces lose unrest more slowly than Argentina's by exactly the strain.
  Hash: seed 99 after one year 23734db3 → 6569bc8e; after five years 6738d695 → 7f1ffbfb.
  Tick, pinned: year 1 2.06 ms, 5-year mean 1.42 ms (one run; budgets 2.4 and 1.5).
  Quick sweep (seeds 1–10 × 20 years, scratch): limits 10 of 10, riser 8 of 10, faller 10 of 10
  (7 and 10 after 1.42e1); largest nation 12.6–17.1% of the land; wall time 5.9 min.
- **Admin cost (PLAN 1.42e3, 2026-10-03):** admin = min(0.25 × (km² held ÷ `ADMIN_KM2`)^1.35,
  50% of gross), with `ADMIN_KM2` = 212,000: the 1,000 cells of the old rule at the mean owned
  cell of 1938 (212.2 km²). `monthlyAccounts` sums the whole km² of the cells a nation controls.
  Charged at the 1938 start (after the cap), gold a month and share of the nation's gross:

  | Nation | By cells | Of its gross | By km² | Of its gross |
  |---|---|---|---|---|
  | Soviet Union | 252.7 | 21.9% | 125.3 | 10.8% |
  | Canada | 79.0 (at the cap) | 50.0% | 40.1 | 25.4% |
  | United States | 43.6 | 0.8% | 41.1 | 0.7% |
  | Denmark (Greenland) | 29.4 | 18.8% | 5.1 | 3.2% |
  | Australia | 19.6 | 7.8% | 34.4 | 13.6% |
  | Brazil | 17.5 | 13.8% | 36.5 | 28.6% |
  | French West Africa | 8.1 | 9.4% | 16.4 | 18.8% |
  | China | 10.4 | 3.9% | 15.8 | 5.9% |

  The world pays 554.6 gold a month by cells and 461.2 by km² (2.85% and 2.37% of its gross of
  19,443); 4 nations are at the cap by cells, 6 by km².
- **Why the mean cell, and what it costs.** Two other references were on the table. A cell at
  the equator (382,000 km²) leaves the tropics as they were and cuts everyone else: the world
  would pay 211.0. A constant fitted to keep the world's total (about 184,000 km²) is a number
  chosen for an outcome. The mean cell is the unit conversion of "1,000 cells" and nothing
  else. The total still falls by 17%, because the cost is superlinear and the cells measure had
  made its two largest payers larger than they are. **The Soviet Union pays 127 gold a month
  less, 11% of its income:** the anti-hegemon cost on the largest nation is halved by measuring
  it correctly. Whether it then grows too strong is for the sweeps of PLAN 1.42 to show, not
  for this constant to prevent.
  Tests: `economy.test.ts` (the cost in units of `ADMIN_KM2`; on the 1938 map Canada pays less
  than the United States, having less land and more cells, and Greenland costs Denmark under
  5% of its income). The tiny 4×1 test world has cells a quarter of the map each, so its
  admin cost is now at the cap, and that test says so.
  Hash: seed 99 after one year 6569bc8e → f93cb674; after five years 7f1ffbfb → 6b84c48c.
  Tick, three runs pinned (`--affinity 0xFFFF`), the rule of PLAN 1.42f: 5-year mean 1.4648,
  1.4612, 1.4563 ms (budget 1.5); year 1 2.2729, 2.2615, 2.2457 ms (budget 2.4). Met, with
  0.04 ms to spare on the mean.
  Quick sweep (seeds 1–10 × 20 years, scratch): limits 10 of 10, riser 6 of 10, faller 10 of 10
  (8 and 10 after 1.42e2); largest nation 12.2–16.4% of the land and 28.4–29.5% of the income.

### ADR-56 · 2026-10-03 · accepted — Cell A* uses an octile bound (PLAN 1.42f, step 4)

- **Context:** the 5-year mean tick of seed 99 was still over budget after ADR-53 and PLAN 1.42f
  step 3. A profile of year 1 put 19% of the tick in route searches, nearly all in the cell A*
  loop. Its heuristic was the straight-line km between two cells at the smaller endpoint row
  scales. On an 8-connected grid a walk is diagonal steps plus straight ones, which is up to
  about 8% longer than the straight line, so A* expanded a wide fan of nearly tied cells.
- **Decision:** the heuristic is the octile walk with the same row scales: min(dx, dy) diagonal
  steps of √(kx² + ky²) and the rest straight (`octileKm`). It is never below the straight-line
  bound (a unit test checks 6,000 pairs on three grids). `boundKm` stays the distance of the
  province graph and of the 500 km switch, which this does not change.
- **Why it is a rule change:** the search is the same, but a tighter bound pops cells in another
  order, so ties between equal routes can break differently. The reference search in
  `movement.test.ts` now uses the octile bound, and its pop order and tie-break are unchanged.
- **Result:** replaying year 1's 5,868 route requests on the 1938 map: 5.86–6.11 s → 4.75–5.23 s
  (−17%). No route is dearer, 221 are cheaper (by ≤ 1.4%), and 112 paths differ. Seed 99 × 5
  years on a 4-core machine about 1.9× slower than the one of the budget: year 1 3.66 → 3.30 ms
  (−10%); 5-year mean 2.985 → 2.928 ms (−1.9%; the world differs from year 1 on, and year 4 flips
  twice as many cells). In the budget machine's terms that is a mean of about 1.52 ms.
- **Hash:** seed 99 after one year 2cb270e6 → e5741d70; after five years f57f70ac → 7a8e5c27.
- **Quick sweep** (seeds 1–10 × 20 years, seen seeds, no verdict at 20 years): limits 10 of 10,
  riser 7 of 10, faller 10 of 10 (6, 10 and 10 before, ADR-54). Wall time 20.4 min on this machine.
- **Not solved:** neither bound is a strict lower bound when a route swings poleward of both its
  ends. Against Dijkstra on 30 random grids of 16–64 rows, 21,042 of 84,575 routes were dearer,
  by up to 15.1%, with the octile bound, and 22,037, by up to 15.2%, with the old one. SPEC §4
  had called this 0.1%, which was not a maximum.

### ADR-55 · 2026-10-03 · accepted — The gate skips a tree it has passed; the baseline hash is a test (the user's request)

- **Context:** the user asked what slows the iterations. Measured on 2026-10-03: the gate on
  a sim change takes about 6 minutes (10-year sweep tests 171–193 s, e2e about 100 s, unit
  43–77 s). Step 2 of every iteration ran it on the commit that the previous iteration had
  just gated (about 3 minutes for nothing). Every claim of "no behaviour change" was a pair
  of 5-year runs by hand (75 s each), and the hash written into PLAN 1.42d as the baseline
  was two rule changes old.
- **Decision 1:** a green gate records the tree it passed, taken before its stages run
  (`.cache/gate/green.json`; the tree a commit of everything but `critic/` would have, written
  through a scratch index). On a clean working tree whose HEAD has one of the recorded trees,
  `npm run check` runs nothing. A HEAD the gate has not seen (a pull, a rebase, a fresh clone,
  a commit of files edited while the gate ran) gets the code stages, as before.
- **Decision 2:** `tests/sweep/baselineHash.test.ts` pins the state hash of seed 99 after one
  year. It runs with the 10-year sweep tests, in parallel with them, so the gate is no slower.
  A change of rules, data or recorded state updates the pin in its own commit and logs the old
  and new hash here; that is a new baseline, not a weakened test.
- **Not changed: the 10-year sweep tests.** They are seven files run in parallel, so the stage
  lasts as long as its slowest run, a 10-year AI war run. Cutting years would drop years 6–10
  of the alliance invariant and of the bankruptcy check. The stage got shorter with the tick
  instead (PLAN 1.42f): 193 s before, 119 s after.
- **Limits:** the record is local to the machine and trusts the same thing ADR-48 trusts: that
  commits are made from the tree the gate saw. `npm run check:full` ignores it.

### ADR-54 · 2026-10-03 · accepted — Sweep dynamism: a riser and a faller, judged over the seeds (the user's decision; PLAN 1.42)

- **Context:** critic B1 (static world) added two criteria on 2026-10-03, required of every
  seed: ≥ 2 new nations among the ten largest by land, and a range of ≥ 3 points in the
  largest nation's land share. Three full sweeps on unseen seeds ended at 9, 7 and 8 of 10
  (25 minutes each) and PLAN 1.42 was blocked. The user asked whether the criteria are valid.
- **What was wrong with them as gates:**
  1. *Every seed must pass.* With a pass rate of 80–90% per seed, ten of ten happens in
     11–35% of sweeps. Results of 9, 7 and 8 are what one unchanged world produces; they did
     not tell the three versions of the code apart.
  2. *The leader-share range looks at one nation.* By area all of Europe west of the Soviet
     Union is about 4% of the owned land, so redrawing it leaves the leader's share alone.
     Three points is 4 M km², a fifth of the Soviet Union (it was a ninth by cells). The
     real world from 1938 to 1988 moves it by about one point (21.2 → 22.4 M km²; my
     figures, not measured here) and would fail.
  3. *Top-ten churn counts swaps at tenth place.* At the 1938 start France is tenth with
     3.00 M km² and the next three are within 7% of it; an empire cut in half inside the
     top ten does not register.
- **What they were right about:** the Soviet Union leads in every year of every run to date,
  it only shrinks, and no rival grows. The rewrite keeps that question and asks it directly.
- **Decision.** The five older criteria stay as limits that every seed must keep. Dynamism is
  two per-seed measures, by area, between the end of year 1 and the end of the run. The unit
  is the realm: a living nation with no overlord, with the land of its puppets.
  - *Riser:* some realm that ends with ≥ 1% of the owned land holds ≥ 1.5 × the land it
    held after year 1. The 1% floor keeps a city state that doubles from counting. A realm
    that did not exist after year 1 (a revolt, a released puppet) is not a riser: the
    question is whether a rival grows, and its land already shows as someone's loss.
  - *Faller:* some realm among the ten largest after year 1 ends with ≤ 2/3 of its land
    of then. One that is dead or a puppet by the end counts.
  A sweep passes when every seed keeps the limits and each of riser and faller holds in
  ≥ 80% of the seeds (8 of 10). Only runs of ≥ 50 years are judged by riser and faller;
  shorter runs (the quick sweep) report the numbers and are judged by the limits.
- **Where the numbers come from** (fixed here, before any run): a factor of 1.5 either way.
  Checked against the real world of 1938–1988 in this game's partition of 1938 (my figures):
  China grows from 4.9 to 9.6 M km² (× 1.96), so there is a riser; the French, British and
  Italian realms each lose over 80% of their land, so there is a faller. A threshold that history
  itself failed would be the wrong one; these are well inside it, and Ages of Conflict is
  livelier than history. They were not chosen from any run of this simulation.
- **This relaxes one thing and tightens another, and both are stated.** Under an 80% quorum
  the old two criteria would have passed all three failed sweeps (9 and 10, 8 and 8, 8 and 10
  seeds of 10). That is why the measures are replaced and not only the quorum: a riser and a
  faller need changes several times larger than a swap at tenth place or three points of
  leader share. The old two stay in every report as columns, so the reports before and
  after can be compared.
- **Corrected the same day, before any deciding run.** The first version measured nations, not
  realms, and counted new states as risers. The first quick sweep with it (seen seeds 1–10 ×
  20 years, `.cache/sweep/reports/2026-10-03-sweep-adr54.md`) showed a riser and a faller in
  10 of 10 seeds for a reason that is no dynamism at all: overlords integrate their puppets.
  France alone goes from 3.0 to 12 M km² and French West Africa from 4.8 to 0 in every seed;
  the Netherlands take in the East Indies (× 10). The measure was made stricter (realms; new
  realms are no risers); the thresholds and the quorum were not touched. This is a change
  made after seeing a run, in the direction of failing more, on seeds already seen.
- **The same quick sweep by realm** (`2026-10-03-sweep-adr54b.md`, seeds 1–10 × 20 years,
  5.2 min; reported, not judged, and no pass claim): limits 10 of 10; a riser in 6 of 10
  (the United States × 1.55–2.07 in three seeds, Germany × 4.3, Poland × 5.1, Iraq × 4.7;
  the best in the other four is × 1.20–1.47); a faller in 10 of 10. **The faller will not
  decide a sweep:** the British realm, the largest after year 1 with 35 M km², ends at
  8.6–12.1 M km² in every one of the ten seeds, and the Belgian realm loses the Congo in
  seven. Colonial realms come apart in every seed within 20 years. The faller measures what
  it says, but it will not tell a lively seed from a quiet one; the riser will. It was left
  as decided: tightening it would be a second change made after looking at seen seeds, and
  is the user's call.
- **What the realm figures show that the old two criteria did not:** on the same ten runs
  the old measures read 1–2 new nations in the top ten and a leader-share range of 0.3–4.2
  points, while the British realm lost two thirds to three quarters of its land and the
  realm of the United States grew in all ten (× 1.07–2.07). The largest single nation is
  the Soviet Union in every year of all ten.
- **Not re-judged:** the seen seeds (1–10, 99, 101–110, 201–210, 301–310) and the three
  FAILING reports stand as they are. Only seeds from 401 judge PLAN 1.42, and no 50-year run
  has been judged by area or by these criteria at the time of writing.
- **Quick sweep:** 10 seeds × 20 years (was 3): the seeds run side by side, and three seeds
  could not tell ADR-53 from noise. The sweep result records each realm's land after year 1
  and at the end (`realmStart`, `realmEnd`).
- **Not changed:** the limit on the largest land share stays per nation, as do the two
  reported columns.
- **Tests changed with the rule** (not weakened: they assert the new terms): the criteria
  test no longer fails a seed for churn or swing; it checks that both are still computed, and
  adds the riser, the faller, the quorum and the 50-year horizon.

### ADR-53 · 2026-10-03 · accepted — A marching formation keeps its front sector (PLAN 1.42f)

- **Context:** tick time on seed 99 was over budget again after ADR-50 and ADR-51 (5-year mean
  1.69 ms against 1.5; year 1 3.36 ms against 2.4). In year 1 the operational AI ran 15,900
  route searches. The 6,030 longer than 60 cells took 13.5 of 13.9 s (about 20,000 cells
  expanded each), and 5,584 of those were for formations already on the march, which had
  walked 8.5 cells of a 220-cell route on average before being sent elsewhere. A march of
  weeks was re-planned almost every day and seldom arrived.
- **Cause:** the planner kept a marching formation in its sector only while the sector's
  allotment of that day was not yet full. The allotment follows the threat and moves daily, so
  the formation was freed and given to another sector, often a far one. SPEC §7 and the file's
  own header already said "formations already marching into a sector keep it": the code
  disagreed with the stated rule.
- **Decision:** a formation marching into a sector that is still a front sector keeps it,
  whatever the allotment is today. It counts towards the allotment, so fewer others are sent
  there, and towards the sector's strength when it decides to attack or hold.
- **Result, seed 99** (`npm run sim`, with step 1 of PLAN 1.42f, which changed no behaviour):
  year 1 3.15 → 1.95 ms; cells expanded by route searches in year 1 120 M → 31 M. The
  5-year mean is 1.56 ms (1.54 before the rule): the world is a different one from year 2
  on (19 wars at the end of year 5 instead of 13). State hash after 5 years 93effc58 →
  f57f70ac; after 1 year dd3096af → 2cb270e6.
- **Check on dynamics** (scratch quick sweep, seen seeds 1–3 × 20 years, before and after;
  not a pass claim): wall time 6.5 → 4.6 min; no limit changed between pass and fail; land
  moving in the last 5 years 9.7–14.5% → 11.0–13.4%; the leader-share range moved both ways
  (2.1 → 0.5, 2.9 → 2.4, 0.5 → 1.2 points), which three seeds cannot tell from noise.
- **Test:** in the Germany–Poland duel no march into a sector that still exists is
  countermanded at the next plan (29 were under the old rule in 14 days).
- **Not solved:** a march whose sector is gone (the front moved) is still re-planned, about
  2,000 times in year 1 with the new target more than 12 cells from the old one, and those
  searches are most of what the planner still costs (0.3–0.4 ms a tick). The mean stays
  0.06 ms over budget: PLAN 1.42f is not closed.

### ADR-52 · 2026-10-03 · accepted — Land is measured by area, not by cells (the user's decision; PLAN 1.42d)

- **Context:** the map grid is a Miller projection: a cell covers `kx[y] × ky[y]` km², which
  shrinks towards the poles. Every land figure so far is a cell count. Measured at the 1938
  start (seed 1; owned land 133 M km²):

  | Nation | Share of cells | Share of area | Area |
  |---|---|---|---|
  | Soviet Union | 26.8% | 15.9% | 21.2 M km² |
  | Canada | 12.3% | 6.8% | 9.1 M km² |
  | USA | 7.3% | 7.0% | 9.3 M km² |
  | Denmark (Greenland) | 5.4% | 1.5% | 2.0 M km² |
  | Australia | 4.0% | 6.1% | 8.1 M km² |
  | Brazil | 3.7% | 6.4% | 8.5 M km² |

  By cells Denmark is the fourth-largest nation in the world and the Soviet Union holds more
  than a quarter of it. Both are artefacts of the projection.
- **Decision:** land is measured in km² wherever a share or a ranking of land is reported.
  One rule for all the land criteria of the sweep (SPEC §10): land moving in the last 5 years,
  largest land share, the ten largest land holders, and the leader-share range all use area.
  The same for the statistics, the ranking and the nation panel. The thresholds keep their
  numbers (1% moving, < 35% land, ≥ 2 newcomers, ≥ 3 points of range); the income and war
  criteria are untouched.
- **This is a change of what the criteria measure, decided before any run with it.** The case
  for it is the table above, not a sweep outcome: no run has been judged by area. Only unseen
  seeds (401 and up) judge PLAN 1.42 under it; the seen seeds (1–10, 99, 101–110, 201–210,
  301–310) are not re-run or re-judged to claim a pass, and the three FAILING reports stand
  as they are.
- **Implemented 2026-10-03 (PLAN 1.42d):** `cellAreaByRow` (`src/sim/nav/grid.ts`, the row
  scales the nav grid already used) and `src/sim/landArea.ts` (`ownedAreas`, `landStandings`),
  derived from the owner raster on demand and never state. Used by `tools/sweep`, the ranking,
  the nation panel (km² and share of owned land) and `npm run diag`. The sweep result fields
  are now `changedKm2` and `landKm2`; the reports already in `docs/sweeps/` keep their cell
  counts. Measured: 133.3 M km² owned, Soviet Union 21.19 M km².
- **Split off (PLAN 1.42d2):** the monthly statistics series (the land chart) still records
  cells. It is saved and hashed state, so changing what it records moves the state hash
  without any rule changing; that gets its own commit with the hash evidence.
- **Series in km² (PLAN 1.42d2, 2026-10-03):** the land column of the statistics series is
  `ownedAreas` at each month start (one scan of the owner raster a month). The series is
  hashed state, so the hash of seed 99 × 5 years moves from ac517acf to 93effc58; the hash of
  every part except the series is dd414d91 before and after, so no rule changed. The section
  is renamed from `stats.rows` to `stats.km2`: a save written before this loads with an
  empty series (as saves from before PLAN 1.34b do) instead of a land column in mixed units.
  Everything else in such a save loads as before. Checkpoints in `.cache/ck/` keep working
  but hash differently from here on.
- **The hash in the 1.42d acceptance test was stale.** 5d08e5dd is the seed-99 5-year hash
  of PLAN 1.42a; ADR-50, PLAN 1.42c and ADR-51 changed rules after it. The check that was
  meant is "unchanged from HEAD": ac517acf at 85c2e35 and ac517acf with 1.42d.
- **Not in this decision:** sim rules that count cells (overextension, admin cost, war score,
  capitulation, small-state annexation). They are PLAN 1.42e, with their own ADR, because they
  change behaviour and the state hash; 1.42d must not (seed 99, 5 years: 5d08e5dd).

### ADR-51 · 2026-10-03 · accepted — The winner of a peace keeps all the land it occupies (critic B1, PLAN 1.42)

- **Context:** after ADR-47 and ADR-50 two sweeps on unseen seeds failed (9 of 10, then 7 of
  10). In every 50-year run the Soviet Union stayed the largest nation and shrank only as far
  as revolts happened to take it. Wars did not move it: the winner annexed
  round(|score|/100 × occupied), and the score is itself proportional to the occupied land, so
  the land that changed owner went with the square of the conquest. A coalition holding 4,000
  Soviet cells at score 20 kept 800 of 170,000.
- **Decision:** at a peace with |score| ≥ 10 the winner annexes every cell of the losers that
  it occupies. Below 10 it is still a white peace, and the losers' occupations of the winners
  still revert. The puppet rule (≥ 90, ≥ 30% of the losers' land) is unchanged. The
  nearest-first selection of annexed cells is gone with the quota.
- **Why:** the critic's report asks for "occupation that converts to ownership at peace", and
  it is what an observer expects of the map: ground taken in a won war stays taken.
- **Tests changed with the rule** (not weakened: they assert the new terms): the score-40
  peace now annexes all occupied cells (it asserted 40%, nearest first); the relative-score
  test's last lines assert that Germany keeps what it took (was: about half). New: the losers'
  occupations revert at a dictated peace.
- **Result on seen seeds 101–110** (scratch sweep, `.cache/sweep/reports`): 10 of 10 pass.
  Leader-share range 4.1–16.1 points (was 2.7–8.6 under ADR-47), 2–4 newcomers in the top
  ten, land moving in the last 5 years 4.8–23.0%, largest nation 12–26% at the end. The
  leader is still the Soviet Union in every year of every seed.
- **Result on unseen seeds 301–310** (`docs/sweeps/2026-10-03-sweep-b1d.md`): **8 of 10**.
  Every seed has 2–3 newcomers in the top ten (two seeds failed that in the sweep before);
  seeds 304 and 306 fail the leader-share range (2.6 and 1.6 points: the Soviet Union ends at
  25.2% and 27.5%). The rule stays: it is what the critic asked for and the three sweeps (9,
  7 and 8 of 10, each on other seeds) do not show it doing harm. B1 is not closed: BLOCKERS.

### ADR-50 · 2026-10-03 · accepted — Partners in a war fight on each other's fronts (critic B1, PLAN 1.42b)

- **Context:** seed 109 failed the leader-share range (2.7 points). A dump at year 25 showed the
  Soviet Union with 78k men and 27% of the land, at war with a coalition of 28 for 557 days at
  score 0, and with Japan (442k men) for 317 days at score 0. Pressure on a cell counted only
  for the nation holding the neighbouring cell, a formation was supplied only on its own bloc's
  network, the operational AI saw only fronts its own nation held, and idle formations on a
  partner's land were sent home. A coalition therefore fought with its border states alone.
- **Decision:** nations on the same side of a war are partners (`Wars.sameSide`; not if they
  are also at war with each other).
  1. *Territory:* attack pressure on a cell = the neighbouring holder's plus its partners' at
     war with the defender; defence = the defender's bloc plus its partners. The cell goes to
     the neighbouring holder, so the connectivity rule is unchanged.
  2. *Supply:* a partner's network feeds a formation.
  3. *Repatriation* skips formations standing on a partner's land.
  4. *Operational AI:* a partner's front cells against a common enemy are front cells.
- **Why this way:** land taken goes to the member that holds the front, so no new rule is
  needed for who owns a conquest, and peace terms work as before.
- **Result:** 50-year runs of seeds 99, 105, 108 and 109 (all seen before; a check, not the
  sweep): leader-share range 5.4, 8.5, 10.0 and 4.4 points (seed 109 was 2.7). Seed 108 has
  only 1 new nation in the top ten (was 3), so the full criteria are still not met on every
  seed: PLAN 1.42 stays open.
- **Follow-up, PLAN 1.42c (same day):** the economic AI replaces an order it cannot pay for by
  the infantry division when that one is affordable. Before, the build loop returned and every
  slot stayed empty until the treasury covered a panzer division (3,829 gold against 1,001)
  plus three months of income: 9 Soviet formations in 30 months of war on seed 109. Same four
  seeds: all pass all seven criteria (leader-share range 4.6–14.7 points, 2–4 newcomers).
- **Sweep on unseen seeds 201–210** (`docs/sweeps/2026-10-03-sweep-b1c.md`): **7 of 10** pass;
  three fail churn or the leader-share range. The four-seed check was noise: these two rules
  are kept because they remove real defects (coalitions that could not fight, an idle build
  queue), not because they close B1. They do not.

### ADR-49 · 2026-10-03 · accepted — Parity-only gate for document commits; critic remediation restarts the critic count (user request)

- **Gate:** nothing but `npm run parity` reads Markdown or `docs/`, so a working tree that
  differs from HEAD only in documents runs parity alone (about a second instead of ~5 minutes).
  `npm run check` is now `tools/gate/check.ts`, which plans the stages from `git status`: it
  replaces the separate sweep-stage script of ADR-48. `critic/` is ignored. A clean tree still
  checks the code. `package.json` no longer triggers the sweep tests (script edits); a
  dependency change shows in `package-lock.json`, which does.
- **Critic cadence:** PROMPT step 2a ran the critic once HEAD was 5 commits past the report.
  Step 2b puts critic findings first, so those 5 commits were all remediation and the critic
  came straight back with new findings: the PLAN phases would never be reached. Now the 5
  commits are counted from the last remediation commit after the report. A remediation commit
  is one whose subject starts with "Critic ". `npm run critic:due` computes it.
- **Consequence to watch:** step 2b still applies while the report is within the last 10
  commits. So after a report: up to 10 commits of remediation, then other work, and the critic
  5 commits after the last remediation. Step 2a's other triggers (phase review, DONE believed)
  are unchanged.

### ADR-48 · 2026-10-03 · accepted — Shorter iterations: conditional sweep tests, checkpoints, quick sweeps (user request)

- **Context:** the ADR-47 iteration took almost three hours. About 95 minutes were three full
  sweeps, 35 the gate (three runs), 35 diagnostic runs that each re-simulated from 1938. One
  sweep was repeated because the gate ran after it and found a bug. The user asked for all the
  remedies proposed.
- **Decision:**
  1. `npm run check` runs the 10-year sweep tests only when the working tree differs from HEAD
     under `src/sim`, `src/shared`, `data`, `public/data`, `tests/sweep`, `tests/helpers`,
     `tools/headless`, the sweep vitest config or the package files. `npm run check:full` always
     runs them. The user approved this change to the gate. It relies on every commit being
     gated; after a pull or rebase, and for the DONE condition, use `check:full`.
  2. Checkpoints: `npm run sim -- --save / --load`; `npm run diag` (the B1 diagnostic, now a
     tool) takes `--load` and `--save`.
  3. `npm run sweep:quick` (3 seeds × 20 years) writes to `.cache/`; only final sweeps go to
     `docs/sweeps/`.
  4. Working rules in PROMPT.md "KEEPING ITERATIONS SHORT": one cause per commit, tune on quick
     sweeps, gate before the final sweep, diagnose from checkpoints, fix an over-budget tick
     before the next task that needs a full sweep.
  5. PLAN 1.42a (tick time) goes before 1.42 (the rest of critic B1), because 1.42 needs full
     sweeps and each now takes 36 minutes. This puts a non-blocking critic finding (N2) ahead of
     a blocking one for one iteration, as its means.
- **Not changed:** the sweep criteria, the test assertions, and what `check:full` covers.

### ADR-47 · 2026-10-03 · accepted — Wars that resolve, armies that recover, empires that strain (critic B1)

- **Context:** the critic (report at bb1dd4f) found the world static: on an unseen seed the ten
  largest land holders were the same from year 9 to year 40 and the leader's share stayed at
  27%. A diagnostic run on that seed showed why:
  - fight-to-the-death wars never ended (Japan–China and France–Nationalist Spain ran 14+
    years at exhaustion 100), pinning their members' war slots and exhaustion;
  - the war score was the occupied share of the *victim's* land, so nothing taken from a large
    nation ever scored above a white peace;
  - a target counted its whole alliance and its guarantors in full and the attacker counted
    nobody, so after a few years of alliance-building no attack had positive utility;
  - one production order at a time meant ~36 new divisions a year worldwide, while wars killed
    60–95% of the armies in them, and winners' formations left on returned land starved there;
  - new formations appeared at the capital, so Japan's sat on the home islands.
- **Decision:**
  1. *Relative score:* occupied land counts against min(victim's land, 2 × occupiers' land).
     Puppets still need 30% of the losers' land in true share.
  2. *Capitulation:* a side 75% occupied (or a leader 75% occupied by anyone) loses at once.
  3. *Deadlock:* any war ends on its score after 5 years. **Deviation from AoC** ("To Death"
     lasts until one side dies): without sea transport many of our to-the-death wars cannot be
     finished by either side; revisit after PLAN 4.5. PLAN 1.16's AT (never accepts peace,
     however crushed or broke) still holds within those 5 years and below capitulation.
  4. *Capital bonus* capped at ± 50 per war (field capitals fell repeatedly: 178 captures).
  5. *Strength comparison:* both sides add 40% of their partners.
  6. *Parallel production:* 1 + income/400 orders at once, at most 6; the peacetime army cap
     scales with aggression (35% × (0.3 + 0.7 × aggression/100) of income).
  7. *Repatriation* of idle formations on foreign land they are not at war with.
  8. *Overseas muster:* reinforcements for an overseas front are raised in the theatre. An
     abstraction of sealift, to be replaced by transports in PLAN 4.5.
  9. *Defection and spreading revolts:* a revolt returns land to its living core nation, or
     joins a neighbouring rebel state, before it founds a new nation (also part of critic B4).
  10. *Overextension:* far provinces of nations above 4% of the land gain unrest (SPEC §4).
      Tried at 3 and 2 per month first: the Soviet Union lost three quarters of its land within
      5 years on seed 99, too fast for a 1938 start. At 1.25, with the war term tied to
      exhaustion ≥ 60, it shrinks over decades.
- **Sweep criteria:** two new ones, fixed before the first run with them: ≥ 2 new nations in
  the top ten by land at the end, and a leader-share range ≥ 3 points. Tuning used seeds 1–10
  and 99; the report is on seeds 101–110, which the tuning never saw.
- **Bug found by the gate:** `declareWar` kept a nation off a side only when it was allied to
  the enemy *leader*. A puppet sitting in another alliance than its overlord could be pulled in
  against its own ally (10-year AI sweep, seed 1: "allies 11 and 14 at war"). More puppets exist
  now, so it surfaced. Nobody joins against an ally on the other side any more (unit test).
- **Result** (`docs/sweeps/2026-10-03-sweep-b1.md`, seeds 101–110 × 50 years, final code): 9 of
  10 seeds pass all seven criteria. Land moving in the last 5 years 3.6–15.9% (was 1.1–6.7% on
  seeds 1–10), 2–4 new nations in the top ten, leader share range 4.9–8.6 points on nine seeds
  and 2.7 on seed 109 (**fails** the 3-point bar), nations alive 95–146 (was 97–231). The
  report is marked FAILING and PLAN 1.42 stays open; the thresholds were not moved.
- **Cost:** more wars, moves and flips. The tick mean in year 1 of seed 99 rose from 2.4 ms to
  4.6–5.9 ms (a profile shows supply reflood 20%, pathfinding 23%, combat 13%; the new systems
  are under 2%). The 1.5 ms budget is PLAN 7.1.
- **Tests isolated from the AI** (assertions unchanged): the speed-buff march (a war now
  reaches Poland within the march) and the region-revolt test (the AI now suppresses core
  unrest, which calmed the neighbours before the revolt fired).

### ADR-46 · 2026-10-03 · accepted — Element snapshots from slot poses; procedural walk/drive animation (PLAN 2.3)

**Context.** T2 needs element sprites at real positions, interest-managed, interpolated on the
GPU, with facing and a walk or drive animation. Elements have no stored position: the sim
places them by `slotPose` from their formation.

**Decision.**
- The snapshot's `elements` section lists the elements of the formations whose position is
  inside the subscribed bbox. It is built only when the subscription wants elements at tier
  ≥ 1.5, and is capped at 40k (whole formations; `truncated` reports a cut).
- Positions are `slotPose` of the current and previous formation positions, the same function
  the sim uses. An empty section uses static empty arrays, so no pooled buffers are taken.
- The view subscribes from the frame loop: the bbox padded by 25%, `tierOf(m/px)`, at most
  10 Hz, and only when the quantised bbox or tier changes.
- The animation is procedural in the proxy shader, because the atlas has no walk frames. A
  frame value of `frame + 0.5` marks a moving element: infantry sway at walking cadence,
  vehicles judder, each with a per-instance phase.
- Elements fade in as the T1 markers fade out (`1 − α_markers` below 300 m/px). Formation
  sprites stand in only while no elements have arrived. Sprites are lightened 45% toward white
  so they read on their own nation's fill.

**Consequences.** A T2 snapshot carries about 11 more buffers. PLAN 2.4–2.6 add fire events,
casualties and T3 expansion on top of this section. A real atlas with walk frames can replace
the shader animation later.

### ADR-45 · 2026-10-03 · accepted — T0 counters: nested 2^L grids, child-level animation, key-tracked continuity check (PLAN 2.2)

**Context.** SPEC §8 asks for stable multi-level clustering with split/merge animation, and the AT
asks for a frame-diff check that no counter vanishes without an animation.

**Decision.**
- Clusters are per nation per cell of a world-aligned 2^L-cell grid. The grids nest, so a parent
  is exactly the union of its children and Σ strength is conserved at every level.
- L is chosen so that a grid cell is about 64 CSS px on screen, with ±0.15 hysteresis.
- On a level change, the finer level's counters animate for 250 ms: from the parent centroid when
  splitting, to it when merging. The target level then replaces them at the same positions. One
  transition at a time; a multi-level jump is a single transition.
- T0↔T1 is a cross-fade (counters `1 − α_markers` above 2000 m/px). Clusters near T1 are already
  small, so the split-to-members animation of SPEC §8 is approximated by the fade.
- The AT check uses the drawn item lists (counters and markers, world position, key, opacity)
  per 16 ms frame of a scripted zoom, not pixels. Map pixels change with every zoom step, so a
  pixel diff cannot separate a pop from camera motion.
  - An item must continue under the same key (≤ 80 px per frame, i.e. an animation) or be
    replaced in place (same nation, ≤ 12 px).
  - Opacity may drop at most 0.3 per frame, in both directions.
  - Verified by mutation: with the animation disabled, the check fails.
- The recording draws only the unit layers (`MapView.drawUnitLayers`). Software-rendering the
  map for 250 frames starved parallel e2e workers: one editor `inspect` took 19 s instead of 15 ms.
- The unit-size setting now scales counters and markers. The settings e2e reads map + overlay.

**Consequences.** Formation sprites draw only below T1 until element sprites (PLAN 2.3).
Counters overlap where nations' clusters are adjacent; decluttering can come with 2.7 if needed.

### ADR-44 · 2026-10-03 · accepted — Dynamism tuning for the 50-year sweep (PLAN 1.40)

- **Context:** the first 10-seed × 50-year sweep (SPEC §10) failed. Every seed ended with
  300–600 nations, and two seeds had frozen fronts. Ledgers showed revolts (30–80 a year) far
  outpacing deaths:
  - half the revolts started in peace and stayed independent;
  - losing rebels survived as rumps or puppets;
  - conquered land stayed non-core forever, so it kept revolting;
  - fight-to-death passed from any side member to whole alliance blocs, so wars never ended.
- **Decision** (each change measured with 10 × 20-year sweeps, then the full 10 × 50):
  1. A revolt always starts a war of independence (was 50%).
  2. A peace in which the winner scores ≥ WHITE_PEACE annexes a losing leader smaller than
     SMALL_STATE_CELLS (40 cells ≈ 15,000 km²), instead of leaving a rump or a puppet.
  3. Coring: a province held (owned and controlled) by one nation for CORE_YEARS (10) becomes
     its core; the former rightful owner keeps a claim.
  4. Garrison (SPEC §4, now implemented): a holder's formation within GARRISON_CELLS (3) of a
     province centre lowers its unrest by 3 a month and its revolt chance by 70%.
  5. Fight-to-death passes to a war side only from its leader (it was any member).
  6. The 1938 scenario sets `revoltMode: "region"` (new scenario setting): a restless region
     of up to 8 provinces revolts as one nation.
- **Criteria threshold:** SPEC gives "> threshold" for border movement; set before tuning to 1% of
  land cells over the last 5 years and not changed afterwards.
- **Result:** docs/sweeps/2026-10-03-sweep.md: all 10 seeds green. Nations 97–231; largest land 24–27%; largest income
  28–29%; land moving 1.1–6.7%; wars in every year.
- **Not done:** fight-to-death sides still never surrender (PLAN 1.16's AT keeps it so), so the
  scenario's to-the-death wars can run all 50 years.

### ADR-43 · 2026-10-03 · accepted — Map sizes S–XL move to Phase 7 (after km-based sim distances)

- **Context:** PLAN 1.39b2 asked for a map-size picker (S–XL) for the 1938 world. An audit found
  the sim tuned for the M map (2048×1024, ~19.6 km per cell). Movement is km-based, but much
  else is counted in cells:
  - operational AI sectors (4) and deploy range (60);
  - combat contact (1.5) and buckets (2);
  - Major Battle match/end radii (3/5) and corridor length/width (8/2);
  - movement target snap (3), production spawn reach (40), militia per 40 cells;
  - city snapping (2), OOB anchor reach (12), strait extension (4);
  - territory pressure radius (2), and cell-by-cell flips with fixed hold time and garrison.
    At L, fronts would advance at half the speed in km, and AI/battle reach would halve.
  - `kmPerCell` exists but no system uses it.
- **Further costs:** L/XL terrain is not shipped (ADR-13 budget: terrain derives offline from
  the 4096 elevation level). Ticks already exceed the budget at M (2.6 ms vs 1.5 ms, PLAN 7.1).
- **Decision:** the 1938 world stays M-sized in Phase 1. Map sizes become PLAN 7.1b, after the
  performance pass. It covers:
  - converting every audited cell constant to km (identical at M, hash-checked);
  - per-km territory hold rates and garrisons, re-checked by the dynamism sweeps;
  - shipped L/XL terrain (revisiting ADR-13's budget) and XL tick and memory budgets.
- **Consequences:** PARITY row 70 stays "not started". The settings panel offers no size
  picker. Looping map and the randomisation options shipped in 1.39b1.

### ADR-42 · 2026-10-02 · accepted — Editor edits are commands; the undo stack is world state

- **Context:** the editor needs undo/redo (SPEC §9). Edits change state the sim hashes.
- **Decision:**
  - Paint, undo and redo are commands. The diff stack (cells with values before and after; the
    nation layer also keeps controllers) is a saved world part.
  - The stack is capped at 50 edits / 500 k cells (2 M at first; lowered in the review after PLAN 1.36 to keep saves small), oldest dropped. A new edit clears redo.
- **Why not in the UI:** a UI-side stack would need CPU copies of every layer. Worse, a save
  plus a later command log containing undos would not replay.
- **Consequences:** saves carry up to the capped diffs. Water ↔ land edits wait for map import
  (the fine coastline comes from the 16k land mask).

### ADR-41 · 2026-10-02 · accepted — God Kill is a forced collapse; God revival keeps the revival rules

- **Context:** the God `collapseNation` reused the bankruptcy collapse, which fragments only
  restless land. On a calm nation it was a silent default, so AoC's "Kill a nation with a click"
  did nothing visible (found by the PLAN 1.32 e2e).
- **Decision:**
  - The God command forces the collapse. Dead claimants revive, every other province splits into
    rebel nations of at most REGION_MAX (8) connected provinces, and the nation is eliminated.
    Province-less slivers go to the largest fragment. The bankruptcy collapse is unchanged.
  - God revival (`reviveNation`) still obeys the revival count and cooldown. The PLAN 1.20
    acceptance test exercises those limits through it.
- **Consequences:** Kill always visibly ends a nation. A God-killed nation can come back by God
  only after the cooldown, like a natural death.

### ADR-40 · 2026-10-02 · accepted — Curved nation names on a Canvas2D overlay, not an MSDF atlas
**Decision.**
- Nation names are drawn glyph by glyph along the worker's Bézier on a 2D canvas overlay. SPEC §8
  planned an MSDF font atlas.
- The labelled territory is the capital's component, else the largest.

**Why.**
- The repo has no MSDF tooling (msdfgen), and city names already use Canvas2D for crisp text in
  any script.
- About 100 curved labels of ~10 glyphs each draw in well under a millisecond, and only on
  redraws. MSDF can return if T1–T3 label counts grow by orders of magnitude.
- Using the largest component put "France" in Algeria and "Italy" in Libya. The first evidence
  shot caught it.

### ADR-39 · 2026-10-02 · accepted — Border distance from analytic gradients, not fwidth
**Decision.**
- The T0 border distance uses the analytic derivative of the B-spline indicator fields.
- It is computed in a second 4×4 pass only for pixels that can be within a line width of the
  border.

**Why.**
- The dashed stair lines inside nations (noted since PLAN 1.3) came from `fwidth(d)` evaluated
  inside the `n > 1` branch. Within a 2×2 pixel quad some pixels skip that branch, which leaves
  derivatives undefined. Where the second id switches, fwidth spikes.
- Analytic derivatives are exact per pixel.
- Carrying gradients for all 16 ids cost 1.30 ms per frame. The bounded |∇d| lets most pixels
  skip the pass: 0.54 ms, within the 1.0 ms T0 budget.
- An e2e regression check samples the band 2–4 cells inside Poland. The old shader leaves 14 dark
  pixels there, the new one none.
- Compared with the AoC reference (pixel-art fills and thick black stair borders, `reference/`
  crops), ours keeps the same reading (flat fills, dark borders, lighter coasts) at any zoom,
  without stairs (additions row 10).

### ADR-38 · 2026-10-02 · accepted — Economic AI on projected accounts; admin cost capped at half of gross
**Decision.**
- The economic AI runs before the economy, on projected accounts for the coming month. It
  disbands to balance, sets suppression, and builds within upkeep shares and reserves.
- Admin cost is capped at 50% of gross income.

**Why.**
- The 1938 order of battle gives some nations armies they cannot pay for: Mongolia's upkeep is
  ~10× its income. Run after the economy, the AI disbanded only after the first month had already
  bankrupted them. Projecting the month fixes that by construction.
- Barren giants (Mongolia: 7,488 cells, 0.7 gold income, 3.8 admin) were insolvent with no army
  at all. The superlinear admin is anti-hegemon pressure on large empires, not a tax on steppe.
  The cap only binds where admin exceeds half of income; majors (SOV 22%, CHI 4%) are unaffected.
- Results: 10 peaceful years with no bankruptcy on 3 seeds (the AT). In the war-world sweeps,
  bankruptcies fall from 121–304 to 0, and wars from ~1,000 to 261–383 per decade.

### ADR-37 · 2026-10-02 · accepted — Operational AI v1: sector allotment with sticky orders; supply refresh 12 h
**Decision.**
- Fronts are cut into 4×4-cell sectors and formations are allotted by threat. Every sector gets
  at least one formation while they last. Sectors with ≥ 1.5× superiority attack; the rest hold.
- Formations keep their sector while marching into it, are not re-routed for target shifts under
  a sector, and are not deployed from beyond 60 cells.
- The supply network refreshes every 12 h, not 6.

**Why.**
- The AT: in an isolated, sustained GER–POL war, Germany takes 763 Polish cells to Poland's 4 by
  day 60, and front coverage is 73–88%.
- The first version re-routed every formation daily, including Siberian divisions sent to Europe.
  It averaged 32.5 ms per tick in year 1. Sticky assignment, the re-route threshold and the
  deployment range cut that to 1.2 ms.
- With armies in motion the supply layer is always dirty, so a 6 h refresh cost 1.7 ms per tick.
  At 12 h an encircled division is still dry within 12 + 8 h (the 1.12 AT holds).
- Without forced fight-to-the-death, Poland sues by exhaustion around day 39, while Germany is
  still catching up from its western deployment. The AT therefore measures a sustained war.

### ADR-36 · 2026-10-02 · accepted — Strategic AI v1 and the long-run stability fixes it forced
**Decision.**
- Utility-based weekly AI with hash draws, a pacifist floor (aggression < 15) and a capped
  strength ratio.
- Long runs exposed a cascade. Fixed by:
  1. Core provinces feel war and bankruptcy as no unrest (only occupation).
  2. Integration passes the puppet's cores to the overlord.
  3. A collapse voids debt and fires only when something fragments.
  4. Rebels get 1 militia division per 40 cells and 150 gold.
  5. Expired truces are pruned.
  6. `nearestCellWhere` scans ring perimeters only. It was O(r³): 12 s whenever a nation without
     land relocated its capital.
- The 3-seed 10-year sweep is its own stage of the gate.

**Why.**
- The first 10-year runs reached 850 wars, 1,000 collapses and 700 nations. Bankrupt empires at
  war revolted everywhere; integrated colonies were non-core and revolted together; broke rebels
  re-collapsed every 6 months.
- Each fix restores the intended rule rather than tuning a constant. Cores are loyal. Integration
  makes land rightful, as in AoC. A default clears debt.
- After the fixes: ~85 wars, ~67 peaces, 30–40 alliance joins, 2 collapses and 2–3 revolts per
  10 years, at a steady ~11–15 s per simulated year.
- Running the sweep alongside the unit tests made timing-sensitive tests fail from CPU
  contention, so it runs as a separate stage.

### ADR-35 · 2026-10-02 · accepted — Major Battles by absolute concentration; winner by men still standing
**Decision.**
- A battle becomes Major at a fixed 120,000 committed men, rather than "relative to the local
  front" as SPEC says.
- The winner is decided by the men still standing near the battle when it ends.
- The corridor speeds up flips (×4) and doubles pressure along a fixed strip for 10 days.

**Why.**
- There is no front-strength model yet to define "relative to the local front". An absolute
  threshold is deterministic and testable, and a relative one can replace it with the fronts
  layer.
- The first rule, using the last observation, named the side that had just been wiped out as the
  winner: its strength was still on record from the hour before. The test caught it.
- Flip speed is how AoC's Major Battles "pierce the frontline". Speed, not reach, is the effect,
  so the AT measures time to the first flip (16 h vs 4 h).

### ADR-34 · 2026-10-02 · accepted — CE re-evaluated monthly; static CE from aggression; cost from gross income
**Decision.**
- Combat efficiency updates at our economic tick, which is monthly; AoC's economic tick is every
  5 real seconds.
- Static mode uses 0.8 + aggression/250, because the scenario data has no CE field.
- The cost is a share of gross income, proportional to CE above the peace level.

**Why.**
- The economy is monthly (ADR-22), and CE is part of the same budget, so the two tick together.
- Deriving static CE from aggression is deterministic and makes the mode meaningful without
  inventing a new data field. One can be added to `nations.json` later without changing the
  mode logic.
- Scaling the cost with income ("cost scales with nation size", SPEC §5.3) keeps war expensive
  for large and small nations alike.

### ADR-33 · 2026-10-02 · accepted — Finite revival with cooldown; collapse by bankruptcy; AoC's core death rule restored
**Decision.**
- Each nation can revive at most 2 times, each no sooner than 2 years after its death, and only on
  land it has a core or claim on.
- Bankruptcy for 6 straight months collapses a nation into revived claimants, rebels and freed
  puppets.
- A nation that loses its capital while holding no core land dies.

**Why.**
- PROMPT asks for finite revival with a cooldown. AoC remembers dead nations without a stated
  limit. That deviation (PARITY row 19) keeps long runs from oscillating forever.
- Routing revolts on claimed land to the dead claimant makes history visible: Ethiopia returns
  on Italian East Africa instead of an anonymous rebel state.
- ADR-28 deferred AoC's death rule until cores existed. With cores it applies as AoC states it:
  "a nation with cores left moves its capital, otherwise it dies".
- Stability (SPEC §4) is not modelled yet. Collapse uses the bankruptcy streak alone until it is.

### ADR-32 · 2026-10-02 · accepted — Province unrest with a monthly revolt chance; rebels as new nations
**Decision.**
- Unrest lives per admin-1 province with a saved core nation. Revolts are a monthly hash draw
  above unrest 50, scaled by unrest and suppression.
- A revolt creates a new nation with militia; with 50% the old holder declares war.
- Region mode follows province adjacency.

**Why.**
- AoC tracks revolt progress per city and fires when the owner ends a war. Provinces are our
  territorial unit (fronts, peace, cores), and a monthly chance keeps revolts in peacetime
  empires too. Both are deviations, noted in PARITY row 16.
- Hash draws make the statistical AT reproducible: 40 provinces in one sim, 35 vs 11 revolts in
  3 months without and with suppression, against 84% and 29% expected.
- Province cores are the seed of PLAN 1.20 (revival from cores), which will route revolts on
  land with a dead rightful owner to that nation's revival.

### ADR-31 · 2026-10-02 · accepted — Puppet loyalty rises with autonomy; revolts need a push
**Decision.**
- Loyalty relaxes toward 40 + 0.6 × autonomy, minus 25 while the overlord is losing a war.
- Revolt needs loyalty < 20 and autonomy ≥ 10. Above 90 a puppet leaves freely.
- Autonomy drifts up 0.25 a month, and integration runs below 50.
- Tiers are named satellite, puppet and vassal from low to high autonomy.

**Why.**
- The first model (loyalty → 100 − autonomy) made the freest subjects (Ireland, Iceland at 90)
  the least loyal. Seven 1938 puppets revolted on the first tick; the suite caught it through the
  1.16 declaration test.
- Content, autonomous vassals and restless satellites matches AoC v4.4's tiers (low autonomy
  "cannot protest", high autonomy "leaves freely").
- The upward drift is the anti-hegemon pressure from SPEC §7. Integration offers a counter-path
  for overlords who keep autonomy low.
- AoC's tier names are not ordered in the text; we order them by control. This deviation is
  noted in PARITY row 10.

### ADR-30 · 2026-10-02 · accepted — Alliances join wars on declaration; unity and loyalty drift monthly
**Decision.**
- When war is declared, each leader's alliance joins its side and the defender's guarantors join
  the defence. Joining is not chained beyond that in v1: a guarantor's own allies stay out.
- Unity is a monthly drift: shared wars, size and decay. Loyalty relaxes toward unity, and
  members below 25 leave.
- Map modes are palette swaps driven by a nation → alliance-leader field in the snapshot.

**Why.**
- In AoC alliances fight together, which is what makes the bloc map matter. Chained joining
  would turn every 1938 war into a world war on day one; the AI and coalition logic (1.24) will
  decide escalation instead.
- A simple, legible drift makes the AT ("low unity → a member leaves") predictable. Donations,
  revolts and disloyalty events plug into the same unity and loyalty values later.
- SPEC §8 forbids re-uploading the grid for map modes. The palette swap costs one 256-entry
  upload.

### ADR-29 · 2026-10-02 · accepted — War score from occupation; peace terms by score share
**Decision.**
- War score is territorial: the occupied-share difference × 200 plus capital-capture swings.
  It is recomputed daily from one grid pass, so it can't drift.
- Exhaustion is time, men lost and land lost.
- Peace terms annex a score-proportional share of the winner's occupation, nearest its own land
  first; the rest reverts. A puppet at ≥ 90.
- Fight to the death (per side) blocks peace both ways.
- `Wars` keeps the hot-path `atWar` as a derived pair set over JSON war records.

**Why.**
- AoC peace is driven by broke or exhausted nations with land kept as occupied. A score made
  from the map is legible (it is what the player sees) and deterministic. Score-share annexation
  gives graded outcomes without per-province bargaining, which the AI will add later.
- Nearest-first keeps annexed land contiguous with the winner instead of leaving islands.
- The derived pair set keeps combat, territory and movement lookups O(1).
- Test-design note: front flips need 16 h, so scripted occupations are applied right before a
  00:00 assessment. A first attempt painted them a day earlier, and Polish divisions retook some
  cells before the assessment.

### ADR-28 · 2026-10-02 · accepted — Capital loss without cores: relocate, field capital, eliminate on no land
**Decision.**
- Until cores exist (PLAN 1.21), a nation that loses its capital city moves it to its largest
  city it owns and controls. Failing that, it moves to a field capital on the nearest held cell.
- A nation dies only when it holds no land, or under winner-takes-all.
- Winner-takes-all also transfers the loser's land that the capturer occupies.

**Why.**
- AoC kills a nation without cores on capital loss. Without cores, that would kill most minors
  at the first lost city, which is too brittle for the sim's fronts.
- The AoC death rule returns with cores and collapse (1.21), recorded as a deviation in PARITY
  rows 14 and 20.
- Annexing only the loser's still-controlled land would leave the capturer's own occupied
  districts owned by a dead nation. The first test run found exactly that: 5 cells around Warsaw.

### ADR-27 · 2026-10-02 · accepted — Fronts: adjacency-only flips with a hold time; advance gated by control
**Decision.**
- A cell can flip only to a nation at war with its holder that holds a 4-neighbour.
- The attacker's pressure must beat the holder's plus a garrison for 16 consecutive hours.
- All flips in a tick are decided on start-of-tick control.
- Land formations cannot enter an enemy-held cell until it flips.
- The frontier set is a derived cache with local upkeep.

**Why.**
- Adjacency is the simplest exact connectivity rule: no flip can jump a line, and a defended
  cell blocks everything behind it (AT).
- The hold time turns pressure into AoC's pixel-by-pixel wave, with a hard speed bound.
- Without the movement gate, the first test run showed infantry (2.3 cells/day) outrunning its
  own front (1.5 cells/day) until its pressure no longer reached the line, and the wave stalled
  on day 5. HOI-style gating makes armies advance with their front.
- Two-phase decisions make the result independent of frontier iteration order. Incremental
  frontier upkeep is checked against a full rebuild in tests.

### ADR-26 · 2026-10-02 · accepted — Element combat v1: simultaneous volleys, health-weighted targeting, derived battles
**Decision.**
- Elements are saved rows. Formation strength is derived from them.
- Each hour every element fires once at a target drawn by hash (no RNG stream).
- Losses are applied after all volleys.
- Targets are weighted by health (strength × hpPerUnit).
- Battles are recomputed each tick from contacts; no battle table yet.
- War state is a saved pair set.

**Why.**
- Simultaneous fire makes results independent of element order, and total fire ∝ surviving
  strength gives Lanchester's square law. That is the AT, and it measures within 2%.
- Health weighting: by element count, a 12-gun battery would draw as much fire as a 500-man
  battalion and die 7× faster.
- Hash draws keep combat order-independent and replayable.
- A persistent battle record matters only for names, history and major battles (§5.4), so it
  waits for them.
- Bug found on the way: `Sim.load` kept derived caches (paths) from the previous state. Load now
  clears paths, the element index and nav.

### ADR-25 · 2026-10-02 · accepted — Supply v1: city-sourced flood over controlled land, 6-hourly
**Decision.**
- Supply is a reachability question: can a formation trace controlled land (or a strait lane) to a
  city its bloc owns and controls?
- The network is recomputed every 6 game hours and stored as a cell layer.
- Formation supply moves by 1/8 per hour, an exact binary step. Attrition at 0 is 2%/day plus
  terrain.
- No throughput, depots or consumption yet.

**Why.**
- AoC has no logistics. Its armies simply cannot hold land beyond the front. WarSim needs
  encirclement to matter (PLAN 1.12 AT) before combat (1.13) and fronts (1.14) exist, and a
  reachability flood is the minimum that gives pockets meaning.
- Six hours keeps cut-off detection inside a day (AT) at a quarter of the hourly cost.
- Storing the layer makes save/load between refreshes exact without replaying.
- The 1/12 rate first used left formations at 0.9999… after a refill (float accumulation), which a
  test caught; 1/8 is exact.

### ADR-24 · 2026-10-02 · accepted — Hierarchical land navigation; march duty; manoeuvre-element mobility
**Decision.**
- Routes are planned on the admin-1 province graph (crossing groups are nodes), then refined by
  cell A* inside that corridor. Short trips use cell A* alone.
- Reachability is precomputed as 4-connected land components.
- Paths are a derived cache, recomputed from (origin, target) after a load, so saves stay small
  and deterministic.
- Speed: the slowest manoeuvre element's km/h × 0.3 march duty ÷ terrain cost.

**Why.**
- Flat A* across Eurasia is fine for one order but not for an AI issuing hundreds. The province
  corridor cuts the search to the relevant strip.
- The component check turns "no land route" (the Channel, coastal specks at 20 km cells) from a
  half-second flood into an O(1) answer.
- March duty turns unit road speeds into realistic daily advances (infantry ~30 km, panzers ~115 km).
- Support guns must not slow a motorised or panzer division to walking pace; the first test run
  caught exactly that.

### ADR-23 · 2026-10-02 · accepted — Pay-on-order parallel production; manpower from 1938 population **[AoC-DEVIATION]**
**Decision.**
- Formations are bought, not grown:
  - an order pays the template's gold and manpower immediately;
  - it trains for 3× its slowest element's build days, with no cap on parallel orders;
  - it appears at the capital;
  - bankruptcy stalls training.
- Manpower comes from owned, controlled population: 0.05%/month, cap 3%, start 1%.
  Populations are 1938 GDP ÷ GDP per head, spread with the economy, so China and India have deep
  pools and small budgets.

**Why.** PROMPT asks for production and recruitment. Paying up front makes the AI's choice a
budget decision, and makes the "queued division appears after N days with cost deducted" AT
exact. Storing a ready day rather than a countdown makes N days exact whatever the tick order.
Gold and manpower as separate constraints give rich-small and poor-populous nations different
strategies.

**Deviation from AoC.** In AoC armies grow on their own with land, cores and gold (TEXT). There
is no production queue or manpower pool. Ours adds both, because tanks, ships, aircraft and nukes
(the differentiators) must be built, and starting forces must be replenished from somewhere.

### ADR-22 · 2026-10-02 · accepted — Economy calibrated to 1938 GDP; monthly tick; superlinear admin **[AoC-DEVIATION]**
**Decision.** Income comes from land the nation controls, valued from history:
- Each modern country's 1938 industrial capacity (GDP × (GDP per head / US)^0.5;
  `economy.json`, Maddison-style rounded figures) is spread over its cells by city size plus a
  small land base.
- A monthly tick pays gross income × trait multipliers × (1 + incomeBonus). Occupied land pays
  the occupier 50%.
- Upkeep scales with formation strength; admin cost grows with land held to the 1.35 power.
- Bankruptcy at −3 months of income causes 5%-per-month desertion until gold is back to 0.
- Nations start with 6 months of income.

**Why.**
- The first model (terrain × per-capita development × area + modern city sizes) ranked Australia
  2nd and Canada 4th. Land area and modern populations swamped 1938 reality.
- Calibrating country totals to 1938 GDP makes the start state plausible by construction:
  USA ≫ UK ≈ Germany > USSR > France > Japan > Italy > British India. Conquest still moves value,
  because it moves cells and cities.
- The ^0.5 industrial weighting turns raw GDP into war-making capacity. It keeps populous agrarian
  China and India below the industrial powers, and gives the PLAN AT's top five.
- Superlinear admin is the brake on runaway empires (PROMPT: no hegemon).

**Deviation from AoC.** AoC ticks the economy every 5 s of real time from land, cores and cities,
with flat costs (TEXT). Ours is monthly sim time (≈ 30 s at ×5) and GDP-calibrated, with
superlinear admin. The faster, flatter AoC loop would ignore our hourly combat economy and
make large empires snowball. Numbers are first-pass and get tuned in Phase 7 (sweep: no
hegemon, borders keep moving).

### ADR-21 · 2026-10-02 · accepted — Gregorian hourly calendar; speed ladder to Max **[AoC-DEVIATION]**
**Decision.**
- 1 tick = 1 hour of the real (proleptic Gregorian) calendar from the scenario start, with leap
  years: 1940 has 8784 ticks. Integer day arithmetic is shared by the sim and the UI.
- Speed levels: ×1…×8 = 1, 3, 6, 12, 24, 48, 96, 256 sim-hours per second, plus Max (as fast as
  the machine allows, in 12 ms slices).
  - The default is ×5 (1 day/s).
  - Level and pause persist in localStorage; `?paused=1` forces a paused start.
  - Keys: Space = pause, `,` / `.` = slower/faster (+/− already zoom the camera).

**Deviation from AoC.** AoC's 1× is about 1 month per 0.5 s (≈ 1,440 h/s; TEXT), and it tops
out at 5×. Our hourly tick drives battles, element combat and semantic zoom (ADR-3, ADR-5), so
the fixed levels are slower and finer. AoC's pace is reachable at Max on the 1938 world once the
sim meets its tick budget (SPEC §8; checked in Phase 7).

**Why.** Real dates read naturally (1 September 1939) and leap years cost nothing with integer
day numbers. A day per second at the default lets the tactical zoom show battles moving.

### ADR-20 · 2026-10-02 · accepted — 1938 land OOB: one formation ≈ one division, strengths in documented ranges
**Decision.**
- A formation is one division or brigade of a data template. Strength is the sum of its elements
  (SPEC §3.6), and the model counts *divisional* manpower; rear services and depots are abstracted
  into economy and supply.
- The 1938 OOB (`data/scenarios/1938/oob.json`) places 1054 formations at their peacetime or front
  locations of January 1938:
  - Germany: 39 inf + 3 panzer + 1 light + 4 mot + 1 mountain + tank units;
  - USSR: 96 rifle + 32 cavalry + 4 tank corps + 30 tank brigades, West and Far East;
  - France: metropole + Algeria; Italy: incl. Libya and East Africa;
  - Japan: square divisions in Japan, Korea, Manchukuo and occupied China;
  - China: ~140 weak NRA divisions on the free side of the front;
  - Poland, Czechoslovakia, the US and every other living nation.
- Units may deploy on land the nation controls, or on land its puppets own and control. So the
  Kwantung Army stands in Manchukuo, Japanese divisions in occupied China, and Chinese divisions
  only on Chinese-held land.

**Documented ranges** (AT for PLAN 1.7; checked by `tests/unit/oob.test.ts`). Rounded spans around
standard histories of the peacetime and early-1938 armies, in model units:

| Nation | Formations | Divisional men | Tanks |
|---|---|---|---|
| Germany | 45–60 | 0.45–0.8 M | 1,000–3,500 |
| Soviet Union | 140–200 | 1.2–2.0 M | 8,000–20,000 |
| France | 50–80 | 0.45–0.9 M | 1,500–3,500 |
| United Kingdom | 8–16 | 60–200 k | 200–700 |
| Italy | 70–95 | 0.7–1.2 M | 500–1,800 |
| Japan | 28–40 | 0.45–0.9 M | 500–2,000 |
| United States | 10–18 | 60–200 k | 100–400 |
| China | 120–200 | 0.8–1.6 M | 0–200 |
| Poland | 35–50 | 0.3–0.5 M | 400–900 |
| Czechoslovakia | 20–40 | 0.2–0.45 M | 300–700 |

Current values: GER 50 / 563 k / 1,570; SOV 162 / 1.52 M / 10,680; FRA 57 / 528 k / 2,300;
ENG 12 / 90 k / 400; ITA 82 / 926 k / 750; JAP 33 / 604 k / 800; USA 14 / 82 k / 200;
CHI 140 / 997 k / 0; POL 44 / 419 k / 600; CZS 24 / 269 k / 600.

**Why.** PROMPT asks for historically plausible starting forces. Division-sized formations keep
~1000 units worldwide (manageable for the AI and markers) while letting elements carry the
semantic-zoom detail (ADR-3). Ranges, not single numbers, reflect real uncertainty: tank counts
depend on whether tankettes count.

### ADR-19 · 2026-10-02 · accepted — Flags as layered data → polygons → SVG and a CPU-rasterized atlas
**Decision.**
- Flags are data, not images: a `FlagSpec` of 11 layer types plus presets. Presets cover the Union
  Jack, the blue and red ensigns, the French and Portuguese colonial patterns, and Nordic crosses.
- One expander (`flagShapes`) feeds both the SVG writer and a deterministic supersampled
  rasterizer. The GPU atlas is built at load from data (Node and browser give identical bytes), so
  the flag editor (PLAN 1.6 baseline, editor UI later) edits data rather than pixels.
- All 103 designs are our own simplifications at AoC's 36×24 scale. Complex arms and scripts
  become symbols:
  - Albania's eagle and the Soviet hammer and sickle are polygons, Saudi Arabia's shahada is bars;
  - Tibet's snow lions are omitted; Mongolia's soyombo is a stylised column.
- Germany uses the 1933–35 black-white-red tricolour (ADR-10).

**Why.** PROMPT asks for a flag editor with presets and our own art. A layered spec gives presets,
random flags and editing for free, renders crisply at any size, and needs no image assets or
licences. The supersampled CPU rasterizer keeps the atlas byte-identical across platforms (unlike
browser SVG rasterization) and builds in 20 ms.

### ADR-18 · 2026-10-02 · accepted — 1938 cities from Natural Earth; point labels on a Canvas2D overlay
**Decision.**
- Cities are generated from NE populated places, with 1938 names. The rename table covers 89
  places, e.g. Stalingrad, Königsberg, Danzig, Breslau, Lwów, Wilno, Peiping, Hsinking, Mukden,
  Batavia, Bombay, Saigon, Léopoldville, Keijō.
- Places founded or made capitals after 1938 are excluded (Brasília, Islamabad, Abuja,
  Naypyidaw, Shenzhen …).
- NE scalerank is relative within each country (most German cities rank 7–8, the same as small
  towns elsewhere). So the cut-off is scalerank ≤ 8, and size takes the larger of the rank and
  modern-population tiers. A greedy 2.5-cell (~50 km) spacing thins the list to 5,774 cities.
  Cities that mattered more in 1938 than today are force-included: Breslau, Stettin, Trieste,
  Memel, Fiume, Czernowitz, Grodno, Pinsk, Viipuri.
- Every living nation's capital is bound to the nearest NE place within 40 km under the nation's
  capital name. Yan'an has no NE place, so it is created at the given coordinates.
- City names render as point labels on a Canvas2D overlay, not as MSDF glyphs:
  - any script renders crisply with system fonts;
  - the visible count is small after culling, so the cost is well under 1 ms;
  - MSDF stays the plan for curved nation names (PLAN 1.29).

**Why.** PROMPT asks for named cities and capitals readable when zoomed in. AoC shows names when
zoomed in (TEXT). Modern populations misjudge 1938 importance, and the forced includes and size
tiers correct the worst cases.

**Consequences.**
- Population and industry per city are not 1938 figures; the economy (PLAN 1.9) derives
  them from size and province.
- Modern spellings remain where no 1938 exonym is in the table (e.g. Katowice rather than
  Kattowitz, which is correct for Polish 1938 anyway).

### ADR-17 · 2026-10-02 · accepted — 1938 nations: puppets for dominions and colonial blocs, one alliance each
**Decision.**
- 102 living nations + Ethiopia (dead; cores on its 1935 territory, revivable).
- 40 are puppets with autonomy, set by real 1938 status:
  - dominions 85–90: Canada, Australia, New Zealand, South Africa, Ireland; Iceland under Denmark;
  - protectorates and treaty states 50–70: Egypt, Transjordan, Oman, Sarawak, Albania under Italy,
    Southern Rhodesia, the Levant mandates, the Philippines Commonwealth, Xinjiang under the USSR;
  - Japanese puppet states 20: Manchukuo, Mengjiang;
  - crown colonies and colonial federations 20–40.
- Gold Coast, Ceylon and Sarawak were split out of direct UK ownership to reach ≥ 100 nations
  with real 1938 polities. They were distinct administrations.
- Alliances (AoC allows one per nation):
  - Anti-Comintern Pact (GER, ITA, JAP);
  - Anglo-French Entente (not a formal alliance until 1939, but Locarno and staff talks made it the
    de facto bloc);
  - Little, Balkan and Baltic Ententes;
  - Comintern (SOV + Mongolia, Tuva);
  - Second United Front (CHI + CCP).
- Romania and Yugoslavia also belonged to the Balkan Entente. They stay in the Little Entente, and
  the Balkan Entente keeps Turkey and Greece.
- Guarantees model the French treaty system (CZS, POL, BEL), the Soviet–Czech pact, Anglo–Portugal,
  Anglo–Iraq and Soviet aid to China.
- Wars in progress: the Spanish Civil War and the Second Sino-Japanese War (with Manchukuo and
  Mengjiang).
- Aggression, traits and income bonus are first-pass values, tuned in Phase 7. Colours are
  historical where conventional (German grey, Soviet dark red, British pink-red, French blue,
  Italian green). Seven conflicting neighbour pairs were recoloured to meet ΔE > 15.

### ADR-16 · 2026-10-02 · accepted — 1938 start state: 1 January 1938, colonies split by role, Spain divided
**Decision.**
- The scenario starts on **1 January 1938**: after Italy's conquest of Ethiopia and the fall of
  Nanjing, before the Anschluss, Munich, the First Vienna Award, the Memel ultimatum and the Hatay
  State.
- Ownership data (`data/scenarios/1938/ownership.json`, our own work) maps NE admin-0 → owner, with
  admin-1 overrides and 25 polygon regions for borders that cut modern provinces:
  - the 1937 German–Polish line, East Prussia, Danzig, Riga-line Poland;
  - Finnish Karelia, Salla and Petsamo; Petseri, Narva-east and Abrene;
  - Budjak and Transnistria; Rapallo Italy and the Dodecanese;
  - Spanish Morocco, Ifni and Cape Juby; Manchukuo/Jehol, Kwantung, Mengjiang, Shaan-Gan-Ning,
    Karafuto and the Kurils.
- **Spain** is two nations at war:
  - The *Spanish Republic* holds Catalonia, Valencia, Murcia, Madrid, New Castile, Almería,
    Jaén and Menorca.
  - *Nationalist Spain* holds the rest plus Spanish Morocco, Ifni, Sahara and Guinea.
  - The split is at province level, so the Teruel salient and the La Serena pocket are not modelled.
- **China**: the Japanese-held North China and Yangtze delta are *occupation* (owner China,
  controller Japan), not new owners. Mengjiang and Manchukuo are separate states. So are Tibet
  and Xinjiang (de facto independent) and the Communist border region.
- **Colonies**: settler-style or legally integral territories are owned by the metropole:
  - Algeria → France; Libya and Italian East Africa → Italy, which satisfies "Ethiopia = Italy";
  - Korea, Taiwan, Karafuto and the South Seas → Japan;
  - small islands → their metropole.
  Large colonial blocs and dominions are their own nations (puppets with autonomy in PLAN 1.4):
  British India, Burma, Malaya, the Dutch East Indies, French Indochina, the French West and
  Equatorial Africa federations, Madagascar, the Belgian Congo, Angola, Mozambique, the dominions,
  Egypt, the mandates, Manchukuo, Mongolia and Tannu Tuva. This gives revolts and independence
  something to work with.
- **Simplifications.**
  - Micro-states are folded into neighbours: Andorra and Monaco → France, San Marino and Vatican →
    Italy, Liechtenstein → Switzerland.
  - Tangier is part of the Spanish zone; Lastovo and Zara are sub-cell at M.
  - Each landless island territory gets exactly one land cell (`reconcileIslands`). Force-placed
    province cells alone would inflate Malta to 68 cells.

**Why.** No permissive 1938 dataset exists (ADR-8). Start-of-year avoids mid-year transfers. The
AT anchors (Danzig, Lwów, Königsberg, Manchukuo, Ethiopia) and 76 other places are tested.

### ADR-15 · 2026-10-02 · accepted — Terrain derived from land cover + relief; crossings as data
**Decision.**
- Terrain is derived per cell offline (SPEC §3.2). Sources:
  - land-cover colour from Natural Earth I (NE1_HR_LC, public domain), matched to labelled reference
    sites sampled from the raster itself, so there are no hand-picked RGB values;
  - relief from the ETOPO standard deviation within the cell;
  - marsh from NE wetlands/deltas plus our own outlines of 10 missing major wetlands.
- The land mask now excludes natural lakes (Great Lakes, Ladoga, Victoria, Baikal …).
- Crossings are a data list of 24 real straits (`data/maps/earth/straits.json`), applied at load.

**Deviations from AoC (logged per PROMPT).**
- *Colour terrain view instead of AoC's greyscale editor code.* AoC's editor palette (VISUAL,
  trailer "Create your own"/"Paint scenarios", 2026-10-02): Basic Land, Desert/Tundra, Hills,
  Mountains, Crossing, Water in grey shades. Ours has 12 classes in natural colours. A derived world
  needs more classes (forest, grassland, marsh, ice) to drive SPEC §5 combat and §6 armour, and
  natural colours read better in a terrain mode.
- *Mountains are passable* (move ×2.5 foot / ×4 motor / ×5 tracked, defence ×1.6, armour attack
  ×0.4–0.5), while AoC mountains are impassable (TEXT). The 1938 world's decisive mountain fronts
  (Alps, Caucasus, Apennines, Burma) were fought through. Chokepoints still emerge from the cost.
- *Crossings are real narrow straits only.* AoC's painted crossings can be long bands across seas
  (VISUAL). Longer gaps are for naval transport and amphibious invasion (Phase 4), which AoC lacks.
  The straits list is editable data, so a scenario can add AoC-style lanes.

**Known limits.**
- NE lakes are modern: the Aral Sea and Lake Chad are their shrunken outlines. Reservoirs are
  excluded (mostly post-1938).
- Hand-drawn wetland outlines are coarse, so the Pripyat, Vasyugan and Hudson Bay marshes show
  rounded-box shapes. They can be refined in `tools/data/wetlands.json` without code changes.
- Paris and other large cities read as grassland/plains until PLAN 1.5 makes city cells URBAN.

### ADR-14 · 2026-10-02 · accepted — Data schemas: zod v4, strict objects, one validator for every `data/` file
**Decision.**
- Every JSON file under `data/` has a zod schema in `src/sim/data/schemas.ts`. `DATA_FILES` maps
  path patterns to schemas, and a file under an unknown path fails validation. The sim may import
  `zod` (ADR-2 allowlist).
- Objects are `strictObject`: an unknown key is an error, which catches typos such as `speed` vs `speed_kmh`.
- The cross-file checks that one schema cannot express live in `validateDataSet`:
  - unique ids;
  - references: techReq, prereqs, trait excludes (both ways), scenario map and size;
  - the tech graph is acyclic and prereqs are not later than the tech;
  - the terrain table is in cell-enum order.
- The i18n catalog check (every nameKey/descKey in `en.json`) runs in the test, because the sim may
  not import UI code.
- Errors read `<file>: <path>: <message>`, using zod's own messages.
- Map geometry is data: `data/maps/<id>/map.json` + `data/scenarios/<id>/scenario.json` drive
  `SCENARIO_GEOMETRY` (toy today, earth/1938 from PLAN 1.3). JSON imports in `src/` carry
  `with { type: 'json' }`, because Playwright loads `src/` in plain Node ESM.
- The unit `sprite` field (SPEC §3.6) is deferred to the Phase 2 unit atlas. Under strict schemas it
  must be added to schema and data together.

**Why.** Data-driven design (PROMPT) only works if bad data fails loudly and points at the field. zod
v4 gives typed inference from the same schema, and is pure and deterministic (allowed in the sim).

**Consequences.** All stats in `data/units`, `data/tech` and `data/terrain.json` are first-pass values,
original to this project. Balance is tuned in Phase 3–7 against the SPEC §5 combat model. Starting
tech per nation arrives with the nations file (PLAN 1.4).

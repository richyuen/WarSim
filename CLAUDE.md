# WarSim

Follow `PROMPT.md`. It is the standing brief for this repo. Unless the user asks for something
else, a request like "continue", "next" or "go" means: do one iteration of the EVERY ITERATION steps in
`PROMPT.md`, which is the first unchecked task in `PLAN.md`.

Exception: if asked to act as the critic, follow `CRITIC_PROMPT.md` instead. The critic is read-only
on source and writes only to `critic/`.

## State lives in files

There is no memory between sessions. Read these files:
- `SPEC.md`: the design.
- `PLAN.md`: tasks and acceptance tests, those still to do. Read it from the top to
  `## Phase 7`; Phase 7 only when working there or adding a line under PLAN 1.42; its last
  section ("Done: the first lines", the ticks the gate reads) never. The text of a done task is
  in `docs/PLAN_DONE.md`, which is searched, not read (ADR-231, ADR-235).
- `PROGRESS.md`: the log; read the tail.
- `BLOCKERS.md`.
- `DECISIONS.md`.
- `docs/PARITY.md`.
- `critic/CRITIC_REPORT.json`, if present.

## Commands

- `npm run check`: the gate, sized to what changed since HEAD. It must pass before every commit.
  - Clean tree that the gate has already passed: nothing.
  - Documents only (Markdown, `docs/`): parity.
  - Code: typecheck, lint, unit, build, parity, plus the pinned hash of seed 99 when a sim
    input changed. Every 10-year sweep test (`tests/sweep/`) runs only when the change ticks a
    phase review (`- [x] 4.8 Phase 4 review`), and in `npm run check:full` (ADR-278).
  - Unit tests: in full only when the change ticks a phase review (`- [x] 4.8 Phase 4 review`),
    when something they all stand on changed (`vitest.config.ts`, `tests/helpers/`, `data/`,
    `public/data/`, `tools/headless/`, the lock file), and in `check:full`; otherwise only the
    test files whose imports reach a changed file (`vitest related`, ADR-280). A commit that
    ticks a numbered task is a commit as any other (ADR-293). Run the whole unit suite by hand
    (`npm test`) when in doubt that the import graph covers a change.
  - e2e (hours in a container without a GPU): in full only when the change ticks a phase review
    (ADR-87, ADR-293), or a helper or the config every spec stands on changed. Otherwise only the
    spec files that changed, or none. While
    working on a part, run the specs of what you touch by hand (`npx playwright test <file>`; a
    perf spec with `--project=perf --no-deps`, or it runs every test first). They include the pinned state hash of seed 99 after one year
    (`tests/sweep/baselineHash.test.ts`): a rule change updates the pin and logs it in DECISIONS.
- Unit tests make each 1938 world after a file's first from its template, and load pure runs
  from `.cache/checkpoints/` (`tests/helpers/checkpoint.ts`; ADR-279). `NOTEMPLATES=1` builds
  every world.
- `npm run check:full`: every stage, whatever changed.
- `npm run check:review`: a phase review's full run, before its tick (ADR-297): every stage on
  its own, a failed test again alone, resumable (run it again after a cut-off); green when every
  test red twice is on `tools/gate/knownRed.json`. The tick's commit then runs parity alone. A
  test goes on that list only with a BLOCKERS entry for it. Also run before each critic run
  (PROMPT step 2a, ADR-554): Phase 7 has no phase review.
- `npm run typecheck`: `src/`, `tools/` and `tests/` (a bare `tsc --noEmit -p .` skips `tests/`; a
  type error in a spec then shows only as Playwright's "webServer was not able to start").
- `npm run plan:archive`: after a tick, moves the done tasks and parts of `PLAN.md` to
  `docs/PLAN_DONE.md` and a done task's first line to the plan's last section, in the same
  commit. A unit test fails while something is left to move.
- `npm run critic:due`: whether a critic run is due (PROMPT.md step 2a): no report yet, or a
  phase review ticked in PLAN.md since the report. One run per phase (ADR-59).
- `npm run dev`: title screen at `/`; the 1938 world at `/?scenario=1938`, the toy world at
  `/?scenario=toy`; benches at `/bench.html?b=A|P|R`.
- `npm run sim -- --scenario 1938 --seed 99 --years 5 --affinity 0xFFFF`: a tick-time
  measurement. `--affinity` pins the run to the performance cores of the machine the budget was
  set on; unpinned, the same code reads up to 1.65 × slower there. `--profile` adds each year's tick by
  system (mean ms, share, longest call, calls of 1 ms or more).
- `npm run sim -- --scenario toy --seed 7 --years 10`: headless runner (`--save` / `--load` a
  checkpoint).
- `npm run sim -- --scenario random --nations 60 --seed 7 --years 1`: the random world (ADR-108).
- `npm run diag -- --seed 99 --at 5,12,20`: wars and great-power state dumps (`--load` a checkpoint).
- `npm run sweep` (10 seeds × 50 years, report in `docs/sweeps/`; `--first`, `--tag`) and
  `npm run sweep:quick` (10 × 20, report in `.cache/`; limits only, riser and faller reported).
  **Suspended until phases 2–6 are complete (ADR-58):** no sweep after a rule change. Only one
  `sweep:quick` at each phase review, as a smoke test, not a balance verdict.
- See "KEEPING ITERATIONS SHORT" in `PROMPT.md` for when to use which.
- `npm run data` / `npm run data -- --check`: data pipeline. `npm run data -- --previews`: only
  the title screen's scenario map images (no downloads, seconds); run it after a change of the
  1938 ownership, nation colours or map assets.
- `npm run bench`.
- `npm run parity`.

## Hard rules

- Never commit `reference/` or anything derived from AoC assets.
- Never weaken or delete a test to make it pass.
- Keep `main` runnable.
- Push every commit (`git push`, ADR-107). A push to `main` deploys the build to GitHub Pages
  (`.github/workflows/pages.yml`): https://richyuen.github.io/WarSim/

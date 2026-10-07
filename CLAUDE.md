# WarSim

Follow `PROMPT.md`. It is the standing brief for this repo. Unless the user asks for something
else, a request like "continue", "next" or "go" means: do one iteration of the EVERY ITERATION steps in
`PROMPT.md`, which is the first unchecked task in `PLAN.md`.

Exception: if asked to act as the critic, follow `CRITIC_PROMPT.md` instead. The critic is read-only
on source and writes only to `critic/`.

## State lives in files

There is no memory between sessions. Read these files:
- `SPEC.md`: the design.
- `PLAN.md`: tasks and acceptance tests.
- `PROGRESS.md`: the log; read the tail.
- `BLOCKERS.md`.
- `DECISIONS.md`.
- `docs/PARITY.md`.
- `critic/CRITIC_REPORT.json`, if present.

## Commands

- `npm run check`: the gate, sized to what changed since HEAD. It must pass before every commit.
  - Clean tree that the gate has already passed: nothing.
  - Documents only (Markdown, `docs/`): parity.
  - Code: typecheck, lint, unit, build, parity, plus the 10-year sweep tests when a sim
    input changed.
  - e2e (7 to 9 minutes): in full only when the change ticks a numbered PLAN task (2.14, not
    its part 2.14a) or the review pass after one (3.4R, not its part 3.4Ra) (ADR-87). For a part, only the spec files that changed, or none. While
    working on a part, run the specs of what you touch by hand (`npx playwright test <file>`). They include the pinned state hash of seed 99 after one year
    (`tests/sweep/baselineHash.test.ts`): a rule change updates the pin and logs it in DECISIONS.
- `npm run check:full`: every stage, whatever changed.
- `npm run typecheck`: `src/`, `tools/` and `tests/` (a bare `tsc --noEmit -p .` skips `tests/`; a
  type error in a spec then shows only as Playwright's "webServer was not able to start").
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

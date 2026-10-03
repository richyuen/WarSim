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
  - Documents only (Markdown, `docs/`): parity.
  - Code: typecheck, lint, unit, build, e2e, parity, plus the 10-year sweep tests when a sim
    input changed.
- `npm run check:full`: every stage, whatever changed.
- `npm run critic:due`: whether the critic's commit rule (PROMPT.md step 2a) calls for a run.
  Commits that fix a critic finding start their subject with "Critic "; they restart the count.
- `npm run dev`: toy world at `/`; benches at `/bench.html?b=A|P|R`.
- `npm run sim -- --scenario toy --seed 7 --years 10`: headless runner (`--save` / `--load` a
  checkpoint).
- `npm run diag -- --seed 99 --at 5,12,20`: wars and great-power state dumps (`--load` a checkpoint).
- `npm run sweep` (10 seeds × 50 years, report in `docs/sweeps/`; `--first`, `--tag`) and
  `npm run sweep:quick` (10 × 20, report in `.cache/`; limits only, riser and faller reported).
- See "KEEPING ITERATIONS SHORT" in `PROMPT.md` for when to use which.
- `npm run data` / `npm run data -- --check`: data pipeline.
- `npm run bench`.
- `npm run parity`.

## Hard rules

- Never commit `reference/` or anything derived from AoC assets.
- Never weaken or delete a test to make it pass.
- Keep `main` runnable.

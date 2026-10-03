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

- `npm run check`: the full gate (typecheck, lint, unit, build, e2e, parity). It must pass before
  every commit.
- `npm run dev`: toy world at `/`; benches at `/bench.html?b=A|P|R`.
- `npm run sim -- --scenario toy --seed 7 --years 10`: headless runner.
- `npm run data` / `npm run data -- --check`: data pipeline.
- `npm run bench`.
- `npm run parity`.

## Hard rules

- Never commit `reference/` or anything derived from AoC assets.
- Never weaken or delete a test to make it pass.
- Keep `main` runnable.

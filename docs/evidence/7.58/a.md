# PLAN 7.58 — the editor's fleet laid up at the month start (ADR-607)

## The case (found at 7.41b, `docs/evidence/7.41/b.md`)

Seed 99, tick 0 (a month's start, so the economic AI runs in the first hour). A battle squadron of
each of the 102 living nations placed by the editor (`placeFleet`, as the `spawnFleet` command) on
7.41b's grid: 11 a row, 3 cells apart, about 38° W 28° N. Step 1 of the economic AI (PLAN 4.6e1)
lays up the fleets that stand, the dearest first, while a nation's navy is over NAVY_SHARE of its
income and it is short of money: a placed battle squadron is a small nation's whole navy over its
share at once.

## The read (`tests/unit/navyBudget1938.test.ts`, "a fleet the editor placed is not laid up")

| | placed | gone after the first hour | nations with a `FleetsLaidUp` line |
|---|---|---|---|
| before (`29acd5a7`) | 102 | 33 | 33 |
| after | 102 | 0 | 0 |

The bar: none laid up in the first month (its one month start is tick 0's). Met.

A nation's own fleets as before: Japan in debt (−100,000 gold, as the 4.6e1 test) with a battle
squadron placed at its port keeps the placed one (laid up first before: the dearest, the highest
id on a tie) and lays up its own battle squadrons until its own navy is within its share. The 4.6e1
test (Japan without a placed fleet) is unchanged and passes.

## The pin

Seed 99's start has no placed fleet (`World.station` empty), so the pin is unchanged (a2ae195b).

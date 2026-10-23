# PLAN 7.83d: the capitals system, cut without changing an outcome (bar met)

2026-10-23, HEAD `670c7345` (pin 5161de24). The world: HEAD's year-4 save of seed 99 (`.cache/prof83/h0_y4.bin`,
as 7.83a–c), a year from it (year-5 hash f278491d). Bundles of the headless CLI (`d/hd.sh`, 7.83c's `hc.sh`
writing to `d/`): `d0` HEAD, `d1` the hourly loop, `d2` with the relocation cuts, `d3` the final code.

## Method

- `node --cpu-prof --cpu-prof-interval 200` on a year from the save; `b/cpusub.mjs … capitalsSystem` sums
  the samples under the system by function (`d/cpu_d0.txt`).
- A probe bundle (counters in `capitals.ts`, not committed) for the year's moves and the nations' sizes.
- After each cut: the bundle's year from the save, its hash against f278491d.
- The AT's figure: `a/pair.sh`, `d0` and `d3` at once on separate P-cores (0x000F, 0x0F00), then swapped,
  three times (`d/q*_d0*.log`, `d/q*_d3*.log`), `--profile`; capitals' mean a tick, operationalAi beside it
  as the quietness check.

## Where the year went (HEAD, profiled: 647 ms, 0.074 ms a tick)

| part | ms |
|---|---|
| the hourly loop: a call of `forEach`'s callback for every city to find the ~88 capitals | ~190 |
| `enemyDistance` (a breadth-first pass over all 2,097,152 cells, two arrays of 8 MB made and filled each time) | 236 |
| `relocateCapital`'s own (the `held` pass over the grid, a `Map` per landmass) | 99 |
| `farthestFieldCell` (two passes over the grid) | 80 |
| `leaveLand`, the rest | ~40 |

The year has 12 moves to a field capital (nations of 0–367 cells; median 29) and 17 calls of
`relocateCapital`, which asked a city's safety 338 times: a few dozen grid passes and searches for
29 rare events, about 15 ms each.

## The cuts (each: hash f278491d after it)

1. **The hourly loop** (`d1`): a `for` over the city ids in ascending order, reading `alive` for each as
   `forEach` does, and skipping the cities that are no capital before anything else. 0.073 → 0.059 ms.
2. **The field capital's search** (`enemyDistance`): the targets are the cells the nation controls on the
   landmass it picks from (collected in the one pass that also counts the landmasses), and the search
   stops once every target has its steps. The queue is in order of steps, so a cell's steps are final
   when it is reached: the values are those of the full pass. Its two arrays are kept between calls (a
   new pair when the grid's size differs) and put back from the queue's prefix. The returned steps are
   a new array of the targets' length, so no caller holds the buffers (`relocateCapital`'s safety no
   longer calls it).
3. **The capital's safety** (`enemyWithin`): the steps of the search over an open grid (no cell blocks it)
   are |dx| + |dy|, dx the short way round on a looping map, so the capped search from all the enemy's
   cells is, at a city, the first ring of the diamond around it that holds an enemy cell, up to the cap
   (CAPITAL_SAFE_STEPS at the map's size, 20 at 1938's): at most 841 cells a city, where the capped pass
   seeded the queue with every enemy cell.
4. **`held`** (`relocateCapital`): the free cities are gathered first; the cells held on each landmass
   only weigh between landmasses (the first comparisons), so with the cities on one landmass (or none)
   the pass is not made.

`d2`: 0.027 ms. Hash f278491d; seed 7 × 3 years from 1938 14ce18f9 (`d/s7_d*.log`), the random world
(seed 7, 60 nations, a year) 4d199771 and the toy world (seed 7, 10 years) 399f837f, on `d0` and `d2`
alike. `capitalsDistance.test.ts`: the stopped search and the diamond scan against the old full pass
on 24 random worlds, open and looping, and the buffers put back.

## The AT's figure (capitals, ms a tick, `--profile`, from the save)

| pair | round 1 (`d0` on 0x000F) | round 2 (`d0` on 0x0F00) |
|---|---|---|
| q1 | 0.0724 / 0.0260 | 0.0733 / 0.0268 |
| q2 | 0.0756 / 0.0254 | 0.0715 / 0.0292 |
| q3 | 0.0755 / 0.0250 | 0.0707 / 0.0293 |
| mean | | **0.0732 → 0.0270 (−63 %)** |

operationalAi 0.569–0.674 on either side, as the pairs' cores fall (the same). Every run's hash f278491d.
The longest call 25.5–26.7 → 16.2–24.3 ms and the calls of 1 ms or more 28–30 → 16–22 a year (the
rare events' remaining passes: annexation's, `leaveLand`'s, the search when the enemy is large).

**Bar:** at most 0.035 (HEAD 0.075 in 7.83a; `dd3b730`'s rules 0.027). **Met** (0.027).

No rule changed: no ADR; the pin unchanged (5161de24). 7.83's AT is read again next (alone, 0xFFFF, twice).

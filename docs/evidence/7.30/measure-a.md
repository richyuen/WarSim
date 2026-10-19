# PLAN 7.30a: the operational AI's late calls, taken apart (measure)

2026-10-19, HEAD `836d4ac` and the probe of this commit (pin 94235073).

## 0. The run measured, and why new checkpoints

`.cache/727d/` holds only seed 732's year-50 state. Checkpoints of years 8, 20, 30, 31 and 43 were
made on HEAD (`npm run sim -- --scenario 1938 --seed 732 --years N [--load] --save
.cache/730/s732-yN.bin`). Their yearly hashes equal 7.27d's run (`.cache/727d/p732.json`) in every
year 1–43: HEAD's seed 732 is 7.27d's (ADR-522, PLAN 7.28's rule, does not fire on it), so 7.27d's
per-year numbers stay the baseline of the AT.

Tools:
- `OP_PROBE` (`src/sim/ai/operational.ts`): with a clock set, each plan (`planNation`) is timed by
  its parts and its `askMove` calls handed out one by one. Not set (the game, the tests, the gate),
  nothing is timed: the pin proves it changes nothing.
- `tools/diag/opCalls.ts <seed> <state> [days]`: from a checkpoint, the plans by part, by nation,
  by the size of the front; the asks by answer and by why the refusal kept for them (`askMove`,
  PLAN 1.42g) did not answer; `joinWide`'s walks.
- Node's `--cpu-prof` on one year from a checkpoint, summed by function under `operationalAi`.

The probe's ms are of runs beside other runs (the checkpoints were being made): read as shares
within a run, not as the tick.

## 1. The late mean is a few years

7.27d's operational AI by year (ms a tick, `p732.json`): years 26–50 sum 26.8 ms, mean 1.072.
Years 30, 31, 40, 41, 44, 46, 47 and 49 (1.16–4.38 each) are 16.4 of it; the other 17 years
average 0.61. So flattening the heavy years alone leaves a mean near 0.6: the AT (0.536) needs the
heavy years' cause fixed and about a sixth off the cost of every year.

| year | ms a tick | calls ≥ 1 ms | ms a slow call |
|---|---|---|---|
| 9 | 1.815 | 1,450 | 11 |
| 31 | 4.376 | 1,080 | 35 |
| 44 | 2.838 | 1,413 | 18 |
| 51 (from y50) | 1.095 | 1,448 | 6.6 |

## 2. What each year's cost is

`opCalls.ts`, a whole year from the checkpoint before it.

**Year 31** (from y30; 6.69 ms a tick under the probe): 95 % in the marches from afar, and of all
plan time 81 % in one kind of ask: a far formation sent to a sector with nobody about 660 cells
away, **refused for want of a way**, asked again on its day in MARCH_DAYS, and searched again
because a cell somewhere changed hands between an open and a closed holder since the refusal
(5,088 calls, 47.5 s of 58.6 s, 9.3 ms each; median 42 such flips between the two asks). The
planners: nation 106 (99 free formations, none within the range of a sector; 70.6 ms a plan) and
France (65 free; 51.4 ms), then the Netherlands and the Raj.

| asks, year 31 | calls | ms | ms each | cells apart |
|---|---|---|---|---|
| afar, refused, kept refusal undone by a flip | 5,088 | 47,530 | 9.34 | 661 |
| afar, refused, other holders open | 325 | 3,151 | 9.69 | 668 |
| afar, refused, first ask | 262 | 2,652 | 10.12 | 667 |
| afar, refused, another cell asked | 181 | 1,437 | 7.94 | 701 |
| orders, ok | 627 | 36 | 0.06 | 13 |

**Year 44** (from y43; 3.96 ms a tick under the probe): the same, in the orders too. The USA (269
free formations; 50.8 ms a plan, half the year's plan time) gives orders to its sectors ~43 cells
off that are refused and searched again after a flip (3,338 calls, 12.6 s), and far marches the
same (1,038 calls, 3.6 s): 16.1 s of 34.7. Besides: `wideJoined` 4.4 s (392 walks of `joinWide`,
11 ms each), `groundOf` 3.6 s.

**Year 9** (from y8; 3.10 ms a tick under the probe; a war of the whole world, 1,319 sectors to a
side): `wideJoined` 7.9 s of 27.1 (884 walks of `joinWide`, 2.4 a day: every plan of the big
coalition walks it again, since any flip between an open and a closed holder undoes it); orders
whose way is long, searched to the end before LONG_WAY judges them (465 first asks, 6.0 s, 12.8 ms
each); `groundOf` 3.5 s; refusals undone by a flip only 1.2 s (0.26 ms each: short searches).

**Year 51** (from y50; 0.93 ms a tick): no repeated refusal (one call). The cost is spread over
every plan: 10,617 plans, each of a side's ~330 sectors; the classes and `reached` 49 % (`groundOf`
2.16 M calls, 3.2 s of 8.1).

CPU profiles under `operationalAi` (self time): year 9 `findPath` 32 %, `joinWide` 31 %,
`pocketOf` 11 %; year 51 `pocketOf` 38 %, `findPath` 16 %, `planNation` 15 %, `snapTarget` 3.5 %.

## 3. The causes

1. **A refusal kept too briefly** (years 31, 44; the heavy years' signature: few calls of 10–35 ms).
   `askMove` keeps a refusal while "no cell has gone from an open holder to a closed one or back
   since" (`lastMixed`): any such cell anywhere on the map. A refusal of a search over open ground
   is that of the cell search in the corridor of the provinces' route (`searchRoute`), and that
   search reads the cells of the corridor's provinces alone, on a route that is of the provinces'
   `open` and `shut` alone (kept by `NodeParts`). A flip outside the corridor cannot change it.
   Fix (7.30b): keep the corridor with the refusal, and let only a flip of a cell in it, or a
   change of `open` or `shut`, undo the refusal. Exact: the same answers, the pin unchanged.
2. **`joinWide` walked again by each plan of a big coalition in a moving war** (years 9, 44): the
   same rule for the whole map (PLAN 7.1i's `passageWith`). 7.30c, measured first.
3. **`pocketOf` walked again each tick** (the late years' broad cost): its answers depend on the
   order of the walks of a passage (1,781 walks a day in year 51, 94 % of them ending on the marks
   of an earlier one; ADR-192's numbers), so they cannot be kept between ticks as they are. A
   change would be a change of the rule (an answer that does not depend on the order): not taken
   on this evidence. Left for after 7.30b and c are measured.
4. **Long ways searched to the end** (year 9's orders): `findDirectRoute` returns 'long' only after
   a search that found a way, when the coarse route was within COARSE_SLACK of the limit.

# PLAN 7.105: the late game's tick, measured on HEAD (2026-10-24)

HEAD `9f1a70d4` (pin f9d18365). The world: critic run 13's year-20 save of seed 4877
(`critic/c13_seed4877_y20.bin`, written at `0c80db1e`; the sim's rules unchanged since, the pin the
same), a year from it: year 21, hash **6d6103a7**, 104 nations, 743 formations, 89,542 cells flipped.

## The figure

`npm run sim -- --scenario 1938 --load critic/c13_seed4877_y20.bin --years 1 --affinity 0xFFFF
--profile` (`head_profile.log`): **4.50 ms** a tick (the critic's 4.42), p95 26.8. By system:
operationalAi 2.09 (46 %), invasionAi 0.38, movement 0.29, nuclear 0.27, territory 0.26, supply 0.26,
airAi 0.18, war 0.12, combat 0.11, air 0.10. The bar: 3.0, twice. It needs 1.3–1.5 ms.

The runners differ: the esbuild bundle of the CLI under `--cpu-prof` read 4.22, and two bundles run at
once on separate P-cores read 4.47–5.27 (`pair.sh`; the cores 0x000F about 12 % slower than 0x0F00 in
this session). The AT is read with `npm run sim`, alone; the work's before and after with `pair.sh`.

## Where it goes

`node --cpu-prof --cpu-prof-interval 200` on the year (`cpu_head_inclusive.txt`, `top.mjs`; 36.1 s of
steps). Inclusive, over every system that calls it:

| where | s a year | ms a tick |
|---|---|---|
| operationalAi | 17.5 | 2.00 |
| `pocketOf` (operational and invasion AI) | 4.18 | 0.48 |
| `joinWide` (`wideJoined`) | 3.86 | 0.44 |
| invasionAi | 2.72 | 0.31 |
| `sectorShape` | 2.32 | 0.26 |
| nuclear (`nukeDecisions` → `weighWar` 1.73) | 2.19 | 0.25 |
| supply (`refreshBeaches` 0.64, `refreshSupplyNetwork` 0.55) | 1.99 | 0.23 |
| territory | 1.84 | 0.21 |
| movement | 1.74 | 0.20 |
| `snapTarget` | 1.47 | 0.17 |
| airAi (`industry` 0.61, `missions`) | 1.39 | 0.16 |
| `findPath` (every caller) | 1.32 | 0.15 |

Within operationalAi (`cpu_head_operationalAi.txt`): `groundOf` → `pocketOf` 23 %, `reaches` →
`joinWide` 20 %, `sectorShape` 13 %, `snapTarget` 8.4 %, the orders' searches (`askMove` →
`findPath`) 6.6 %. This is not 7.94's year (seed 99's fifth, `docs/evidence/7.94/measure.md`), where
the searches were 34 % and `findPath` alone 30 %: ADR-666 (b)'s fewer searches, the AT's candidate,
reaches about 6 % here.

## The walks (a probe in `pocketOf` and `wideJoined`, 30 days from the save, not committed)

- **`pocketOf`:** 72,600 calls, 17,147 walks of 2.44 M cells, but only 1,655 starts (passage and cell)
  walked. Walks again in one tick: 120 (0.7 % of the cells). So the repetition is across ticks: each
  tick's passage is a new object, and its marks go with it. Of the walks, 936 are pockets (465 k cells),
  16,211 come to a wide ground (1.97 M cells), and 236 of those walked POCKET_CELLS and came to none
  (538 k cells, from 62 starts; one start 67 times). Of 15,492 walks of a start walked before, 12,684
  (1.41 M cells, 58 % of all the cells) walked the very cells of the last walk.
  A walk's answer depends on the walks before it in its tick (it ends on their marks), and a wide
  ground's number on the node first asked: marks kept across ticks are not certain to give the answer
  a fresh walk gives. That is a rule's question (its own ADR), not a cache's.
- **`joinWide`:** 27 walks in 30 days (6 sets of open holders; 49 passages kept `joined` across flips),
  about 11 ms each, each answering 1 or 2 pairs of wide grounds before a flip undid it. Half of a walk
  (`cpu_head_lines.txt`) was the sort of the walked cells as packed float numbers.

## Cut 1: the walked cells sorted by digits (`sortCells`)

Each cell is walked once, so the runs' cells are sorted by cell alone: a sort by digits of 11 bits of an
Int32Array, the run read back from a scratch array by cell. The same cells and runs in the same order:
the year's hash 6d6103a7. `pair.sh` (`p1_*.log`; h0 HEAD, h1 the cut):

| cores | h0 | h1 |
|---|---|---|
| 0x0F00 | 4.692 | 4.472 |
| 0x000F | 5.274 | 5.152 |

About −0.17 ms (−3.5 %); operationalAi 2.22/2.38 → 2.04/2.21.

## The AT read on cut 1

`npm run sim -- --scenario 1938 --load critic/c13_seed4877_y20.bin --years 1 --affinity 0xFFFF`, alone:
**4.224** (`head_3y.log`, year 21 of three) and **4.256** (`at_cut1_read2.log`). The bar, 3.0 twice:
missed. Engaged per war in the year: the same as HEAD's (the same hash, 6d6103a7).

## Why the tick is 2.4 × the critic's 896ff77

The critic ran both commits in one session (`critic/c13_perf_4877_y21_896ff77.log`, on that commit's
own year-20 save of 4877, another world): 1.82 ms a tick, 20,708 cells flipped, operationalAi 0.54;
HEAD 4.42, 89,542, 2.04. The world is 4.3 × as churned; the reach tests grow with it (the mixed nodes,
whose open cells the far walks and `joinWide` walk). ADR-654 (a) took the cost of a busier world as
the rules'. The page: 23–32 s a game year at Max there against 46–59 s here, × 2.0 against the
headless × 2.4: the page's share did not grow, so the drop is the sim's.

## The page against the headless year (same years, 21–23)

| year | page at Max (`critic/c13_l_4877_alone.json`) | its pauses resumed | headless, cut 1 (`head_3y.log`) | × |
|---|---|---|---|---|
| 21 | 46.3 s | 6 | 37.1 s | 1.25 |
| 22 | 59.4 s | 13 | 40.1 s | 1.48 |
| 23 | 59.4 s | 16 | 42.9 s | 1.38 |

The pauses at Max are the game's own (an AI strike pauses it; PLAN 7.109a wants that pause prompter),
so a felt-speed bar that counts them works against 7.109.

## What is left, sized (none reaches 3.0)

- **Exact cuts** (the same answers): `snapTarget`'s Map by landmass and cell (~0.1 ms; the lookup is
  the function's time, 30 % of its keys past the small integers), `sectorShape`'s sort and holders
  (~0.05), `industryHeld` (~0.03): about 0.3 together, to about 3.9.
- **The pockets as a rule** (~0.2–0.3 more, to about 3.6): each start's own walk, no answer taken from
  another walk's marks, then kept across ticks while no flip between an open and a closed holder of the
  set touches a walked cell or its neighbour and the node parts hold. Not a cache of today's walk
  (7.94's option c's kind): a walk ends on the marks of the walks before it in its tick, so a mark kept
  from an earlier tick gives an answer a fresh walk need not give, and a loaded world (no marks) would
  step otherwise than the one saved: the round trip's test. Only an answer that is the start's own is
  kept exactly, and that changes today's answers: a rule, the pin moved.
- **The operational AI's cadence** (each nation's turn every other day, not daily): about 1.0 ms, the
  only lever of the bar's size, and against R13-B1 (7.104, 7.110: the land war late).

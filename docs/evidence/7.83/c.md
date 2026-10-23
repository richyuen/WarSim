# PLAN 7.83c: supply's beach layer, cut without changing an outcome (bar missed)

2026-10-23, HEAD `1e890b8e` (pin 5161de24). The world: HEAD's year-4 save of seed 99 (`.cache/prof83/h0_y4.bin`,
as 7.83a and 7.83b), a year from it (year-5 hash f278491d). Bundles of the headless CLI (`c/hc.sh`): `c0`
HEAD, `c1` the layer as an array, `c2` the final code; `base` is `dd3b730` (7.83a's `build.sh`).

## Method

- `node --cpu-prof --cpu-prof-interval 200` on a year from the save; `b/cpusub.mjs … supplySystem` sums
  the samples under supply by function (`c/cpu_c0.txt`, `c/cpu_c1.txt`, and `c/cpu_base.txt` for `dd3b730`
  on the same save); `c/lt.cjs.txt` gives a function's line ticks.
- After each change: the bundle's year from the save, its hash against f278491d (`c/hc.sh`).
- The AT's figure: `a/pair.sh`, `c0` and `c2` at once on separate P-cores (0x000F, 0x0F00), then swapped,
  three times (`c/q*_c0*.log`, `c/q*_c2*.log`), `--profile`; supply's mean a tick, operationalAi beside it
  as the quietness check.

## Where supply's year went (profiled, ms)

| part | `dd3b730` | HEAD (`c0`) | `c1` |
|---|---|---|---|
| supplySystem | 1,050 | 1,800 | 1,772 |
| refreshSupplyNetwork (the network) | 460 | 551 | 656 |
| markSeaLinks (`seaReach`) | 259 | 193 | 184 |
| refreshBeaches | — | 558 | 389 |
| of it: `beachesOf` (the coast scan, `seaWay`) | — | 342 | 290 |
| of it: the flood's own (`layer.set`, marks) | — | 191 | ~80 |
| the per-formation loop's own | 279 | 442 | 365 |

(The network's refresh and `seaReach` are the same code on HEAD and `c1`; their spread between runs is
±100 ms.) HEAD's beach layer was a `Map` of 2,000–15,000 cells (`c/size.ts.txt` over 60 days; the coast counted by `c/coast.ts.txt`),
made again every 12 hours, and asked by every formation out of its network in a 5 × 5 window each hour.

## The change (hash f278491d after it)

`World.supplyBeach` is a `SparseLayer` (`src/sim/core/sparseLayer.ts`): an array of 16-bit values by cell
and the list of cells set, answering as the `Map` did (`get`, `size`, iteration in the order set), so
the save's section (sorted pairs) and `beachPocket1938.test.ts`'s reads are the same. The flood sets a
cell in the layer as it queues it, and the layer is the flood's mark (`beachSeen` and its reset gone);
the per-formation lookups are an index. The values are blocs (nation ids, 1–65,535): `set` refuses
anything else. Seed 99's pin, the save's year, the random world (seed 7, 60 nations, a year: 4d199771)
and the toy world are the same on HEAD and after; `saveYear.test.ts` green.

## The AT's figure (supply, ms a tick, `--profile`, from the save)

| pair | round 1 (`c0` on 0x000F) | round 2 (`c0` on 0x0F00) |
|---|---|---|
| q1 | 0.2232 / 0.1827 | 0.1974 / 0.1962 |
| q2 | 0.2026 / 0.1807 | 0.1989 / 0.1924 |
| q3 | 0.2016 / 0.1836 | 0.1887 / 0.1916 |
| mean | | **0.202 → 0.188 (−7 %)** |

operationalAi 0.579 (`c0`) against 0.585 (`c2`): the same. Every run's hash f278491d.

**Bar:** `dd3b730`'s rules + 0.03 (7.83a: 0.138 + 0.03 = 0.168 on HEAD's save; against this session's
own `c0`, 0.202 − 0.049 = 0.153). **Missed** (0.188).

## What is left, and why it is not waste

- The coast scan in `beachesOf`, about 210 ms a year: each refresh hour every one of the map's 27,619
  coast cells is asked its network (`cells.supply`) and, for the 4,074 out of one, its controller. The
  reads are scattered over the 2,048 × 1,024 grid, so their cost is the memory's, about 10 ns a cell.
  Asking only last hour's 4,074 holds only while the network is unchanged, and at none of 240 refresh
  hours over 120 days was it (`c/skip.ts.txt`). Less needs the coast cells whose network changed, kept
  by the network's refresh: a change of how the refresh is kept, not of a rule, and larger than this part.
- `seaWay` for the blocs `reach` did not search, about 78 ms: each answers where the bloc's convoys reach
  this hour (wars, the zones held, the passages shut), which the beach's sources need.
- The flood itself, about 80 ms: 2,000–15,000 cells a refresh.

Together about 0.04 ms a tick, the rule's own work as written. 7.83's AT is read again after 7.83d.

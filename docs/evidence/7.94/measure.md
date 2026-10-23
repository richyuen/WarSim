# PLAN 7.94: the operational AI's cost, measured on HEAD (2026-10-23)

HEAD `87263bc9` (pin b9bff4bd). The world: HEAD's own year-4 save of seed 99 (`--years 4 --save`, year-4
hash b0dfdba2), a year from it (year-5 hash **ca1b3d47**; the task's f278491d and 5161de24 were HEAD's
at 7.83, before 7.90g–7.97 moved the pin). Bundle of the headless CLI as 7.83b's (`hcheck.sh`,
`pair.sh` there).

## The figure

`--profile`, `h0` against itself on separate P-cores, swapped: operationalAi **0.794 and 0.770 ms** a
tick (36.6 % of the tick). The bar: 0.40.

## Where it goes

`node --cpu-prof --cpu-prof-interval 200` on the year (`cpu_h0.txt`; inclusive, of 7,037 ms sampled):

| where | share |
|---|---|
| orders (`askMove` → `orderMove` → `findDirectRoute` → `findPath`) | 34 % (findPath self 30 %) |
| the reach test (`reaches` → `wideJoined` → `joinWide`) | 16 % |
| `sectorShape`, `groundOf` | 8.8 %, 8.5 % |
| `pocketOf` | 7.5 % |
| `passageOf`, `frontPart`, `coarseRoute`, `nodeParts`, … | under 4 % each |

`tools/diag/opCalls.ts`, 60 days from the save (`opCalls.txt`): 1,040 plans, 866 ms; by part fromAfar
26 %, orders 20 %, sectors 13 %, classes 12 %, reserveThreat 11 %; 1,577 asks 320 ms.

## What a cache could take (outcome-free: the same searches answered from memory)

- **`joinWide`'s walks** (`tools/diag/joinWalks.ts`, `joinWalks.txt`): 15 in 60 days of 3 sets of open
  holders; 3 the first, 12 after a node's open or shut changed, 10 of them with a changed answer. **2
  walks** could be spared.
- **The orders asked again** (`longAsk.ts.txt`, `longAsk.txt`; the key the formation, its cell, its
  step's ends and their open or shut, the target; a repeat judged as `asked()` judges a refusal: the
  same open holders and no flip between an open and a closed holder since): 'long' answers to moving
  formations 134 repeats, of them **42 (36 ms in 60 days, about 3 % of the system)** with nothing
  changed; the rest after such a flip (86) or a change of the open holders (6). First asks: 'refused'
  standing 55 (102 ms), 'ok' moving 1,366 (90 ms): searches, each the first of its kind.
- **`findPath`** itself is the tuned search of PLAN 1.25, 1.42f (typed scratch, stamps, the bound
  inlined): no further cut found on reading it that keeps its order of expansion and its ties.

So a cache takes about 5 % at most; the rest is searches that are each asked for the first time, in a
tuned search. **Half (0.40 ms) is not reachable without changing what the plan asks** (fewer
searches: a rule, which moves the pin).

# PLAN 7.30c1: why `joinWide` is walked again (measure)

2026-10-19, HEAD `0787b97` and the probe of this commit (pin 94235073).

## 0. The run

`tools/diag/joinWalks.ts <seed> <state> [days]`, one year from `.cache/730/s732-y8.bin` and
`s732-y43.bin` (7.30a's checkpoints; their hashes equal 7.27d's). `JOIN_PROBE`
(`src/sim/nav/provinceGraph.ts`) is told of each walk of `joinWide`; unset (the game, the tests,
the gate) nothing is told, and the pin proves it. Each walk is set against the last walk of the
same set of open holders (`Passage.ok`): why that answer was not kept, the flips between an open
and a closed holder since it by the class of their cell's node (mixed: open and closed ground;
clear: open only; shut: closed only; none: no node), and whether the walk's partition of the nodes
is that of the last. The partitions are compared by the least node of each class, not by the
numbers: those are union-find roots and depend on the order of the merges. Output:
`.cache/730/joinWalks_732_y9.{txt,json}`, `joinWalks_732_y44.{txt,json}`.

## 1. The walks

| why walked again | year 9: walks | partition changed | year 44: walks | partition changed |
|---|---|---|---|---|
| first walk of the set | 10 | (none to compare) | 4 | (none to compare) |
| `open` or `shut` changed (parts made again) | 59 | 49 | 3 | 2 |
| the flip log rolled over | 3 | 0 | 2 | 0 |
| a flip between an open and a closed holder | **812** | **4** | **383** | **0** |
| all | 884 (10 sets) | | 392 (4 sets) | |

After flips, by the classes of the flips since the last walk:

| flips since the last walk | year 9: walks | changed | flips | year 44: walks | changed | flips |
|---|---|---|---|---|---|---|
| mixed, open → closed only | 738 | 4 | 7,509 | 369 | 0 | 10,456 |
| mixed, both ways | 57 | 0 | 456 | 12 | 0 | 1,370 |
| mixed, closed → open only | 17 | 0 | 62 | — | — | — |
| clear and mixed | — | — | — | 2 | 0 | 97 |

- No land cell of the 1938 map is of no node (0 cells), so none flips.
- Ticks with two walks or more: 135 in year 9 (270 walks), 21 in year 44 (42); in none does a walk
  give the partition of another walk of that tick. Two sets of open holders walked in one tick are
  two answers: no walk is the same answer asked by another plan of the coalition.

## 2. What follows

1. The waste is the same set's walk again after flips that left its answer as it was: 808 of
   year 9's 884 walks, 383 of year 44's 392 (91 % and 98 %). Not the plans of a coalition each
   walking the same answer (§1's last line).
2. **A rule by the class of the flipped cell's node keeps nothing.** While `open` and `shut` are
   the same, an open/closed flip in a clear node would make it shut, and one in a shut node would
   make it open: `nodeParts` makes the parts again for either. So the flips that undo `joined` are
   of cells of mixed nodes, the very cells `joinWide` walks, and all of §1's are.
3. **An exact rule by the flip itself** (7.30c2): `joinWide` unions the groups of clear nodes
   through runs of open cells in mixed nodes. A flip changes the partition only if
   - open → closed: the cell's run met two groups or more (a run that met one or none, split,
     joins nothing it did not); or the cell was opened since the walk;
   - closed → open: the cell's open neighbours (by `findPath`'s steps) are of two classes or more
     that hold groups.
   Any flip in a node that is not mixed undoes the answer, as now (the clear and shut nodes'
   cells are then the walk's, whatever the order). That needs, kept with the parts, the class and
   "met two groups" of each open cell of the mixed nodes at the walk (year 5: ~18,000 cells), and,
   since it, the cells opened or closed and the classes merged by those opened. Checked against a
   walk at each answer kept, from the same checkpoints, before it is the rule.
4. Bound: with every needless walk kept, year 9's `wideJoined` (7.9 s of 16.3 under the probe after
   7.30b, measure-a §4) falls by up to ~90 %, year 44's (4.4 s of 12.7) by up to ~98 %, less the
   checks of the flips (~10 a walk in year 9, ~28 in year 44, each a look at 8 neighbours).

## 3. After 7.30c2 (ADR-524: each flip judged by the walk's runs)

`joinWalks.ts` again, one year from the same checkpoints, with its check: at each passage whose
`joined` was kept across judged flips (`JOIN_PROBE.kept`), the cells walked afresh and the
partitions compared by the least node of each class. Output `.cache/730/joinWalksC2_732_y9.*` and
`joinWalksC2_732_y44.*`.

| | year 9 | year 44 |
|---|---|---|
| walks, before → after | 884 → 156 | 392 → 48 |
| of them after flips | 812 → 84 (4 changed the partition) | 383 → 39 (none) |
| `open` or `shut` changed; log rolled; first | 59; 3; 10 (as before) | 3; 2; 4 (as before) |
| answers kept across judged flips | 1,073 | 946 |
| of them wrong against a walk afresh | **0** | **0** |
| most bytes held by the live runs at a walk | 6.2 MB (10 sets) | 2.4 MB (4 sets) |

- The rule of §2.3 as written (a closing undone in any run that met two groups) kept too little:
  884 → 833 and 392 → 283 walks, none wrong. The runs that meet two groups are the long ones along
  the fronts, where the flips are. The rule kept is §2.3's with one more case: a closing in such a
  set holds when the cell touches no clear ground and its open neighbours are joined by steps among
  themselves (every way through it goes round it); and the sets' "met two groups" is kept by root
  as the openings join them, not by the walk's run, so that it stays true of a set that grew.
- Of the 812 walks after flips in year 9, 84 are left; 80 of them changed nothing (the bound was
  811). Which flip undid each is not taken apart here (7.30d weighs what is left by part).
- Seed 732's hashes after years 9 and 44 equal 7.27d's (e8fee30d, d481b109); pin unchanged.

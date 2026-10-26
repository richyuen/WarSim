# PLAN 7.118: land moved late — measured on HEAD

2026-10-26, HEAD `c95202e7` (pin 3a90f72d: ADR-701's fold and ADR-703's far-march wait). The critic's figure
(run 14, `late5flip`): cells whose controller differs from the year before, summed over a world's last five
year-ends, over the land cells. Tool `tools/diag/lateMoves.ts` (the same figure, with wars, nations at war, the
largest share and the events that move land without a war; saves at years 20 and 25).

## 1. The critic's cases on HEAD's rules

The critic's two worlds under 20 % (of 48, on `311988d7`): 9203 13.1 % and 2081 19.2 %. On HEAD, 30 years each:
**9203 73.6 %**, **2081 47.0 %**. Like 7.117's 8167, the case is of the rules before ADR-701 and ADR-703.

## 2. Fresh worlds on HEAD

| seeds | worlds | least | mean | founded at year 30 (mean) |
|---|---|---|---|---|
| 1041–1050, 1061–1076 (measure) | 26 | 24.9 (1046) | 53.8 | 28.7 |
| 1051–1060 (the AT's, HEAD's column only) | 10 | **18.4 (1052)** | 46.6 | 29.4 |

One world of 38 read on HEAD (with the critic's two) is under 20 %: 1052, an AT seed (not looked into).

## 3. What a quiet world is (measure seeds only)

`tools/diag/warMoves.ts` and `tools/diag/lateGates.ts`, one year from the year-25 saves of 1046 (the quietest,
24.9 %) and 1043 (72.7 %):

- Land moved in the year: 1046 35,498 cells (11,763 in no war), 1043 84,127 (37,831). 85 % / 83 % of the land is
  held by nations at war in both: the quiet world is not a world at peace.
- 1046's wars are a bloc against a minor: the Soviet bloc (the Soviet Union and about 30 partners and subjects)
  against Iraq, Paraguay, Denmark, Australia; the US–Italy–France bloc against Japan's and Mexico's. They are short
  (Iraq 174 days, 1,647 cells). The two blocs fight no war with each other. The Soviet Union is at MAX_WARS on 50
  of its 52 turns; 774 of 2,225 turns are pacifist; 865 fall under DECLARE_AT, the best target's strength term
  −0.20 (a target defended by a bloc). 1043's land moves in bloc-against-bloc wars (US against Germany's bloc:
  13,505 cells in 81 days).
- Over the 26 measure worlds the land moved goes with the wars standing at a year's end (3.4–4.2 in the three
  quietest, 7–11 in the busiest), less with declarations (12 a year against 14–17): the quiet worlds' wars are
  as many begun but shorter.

## 4. Reading

The critic's finding is gone on HEAD's rules; a quiet tail is left, about one world in 38 under the bar, of the
shape in §3 (no war between the blocs). The AT's clause "the least of 10 seeds at least 20 %" fails on HEAD by
that tail (1052). No rule was written: a rule against the tail would be designed on one world in 38, and the AT's
other clauses (the mean not below HEAD's, founded not above) are HEAD's own.

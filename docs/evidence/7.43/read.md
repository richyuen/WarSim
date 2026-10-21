# PLAN 7.43: a cell taken goes to the side's nation whose own formations press it (ADR-582)

`tools/diag/nukeProgramme.ts <seed> 2 <TAG> 30 new`, from 1938, every 30 days, at `60ac86b`
(`head-*.json`) and at `60ac86b` with the rule (`rule-*.json`, `docs/evidence/7.37/g-tiebreak-candidate.diff`),
the four at once. `node read.mjs *.json > read.txt`: per sample `day:held/men` (`*` no overlord).

| run | 1938 land | most held over it | most held over it, 0 men | end |
|---|---|---|---|---|
| HEAD, 1307 Latvia | 448 | 0 | 0 | dead by day 270 |
| rule, 1307 Latvia | 448 | 0 | −31 | lives, 139 cells at day 720 |
| HEAD, 8693 Lithuania | 352 | 0 | −271 | 81 cells from day 60 |
| rule, 8693 Lithuania | 352 | 0 | −271 | the same |

AT bar (under 500 cells more than its 1938 land at every sample while it has no land formation):
met on both, with and without the rule. On HEAD the critic's case (`bcbc99c`: Latvia 131 → 4,787
cells in days 450–660, Lithuania 88 → 1,921) no longer arises within two years, so this read is a
guard (the rule makes nothing worse there), not the proof. The proof on the case is 7.37g's replay
at the critic's commit (`docs/evidence/7.37/g-programme-*-2y-bcbc99c-tiebreak.json`: Latvia
359–402, Lithuania 88) and the unit test (`tests/unit/territory.test.ts`, PLAN 7.43: red without,
Latvia's id 7 under the Soviet Union's 10).

With the rule Latvia lives on seed 1307 (a divergence: the Soviet Union takes the cells beside it
that its divisions press, and the line it holds runs elsewhere), holding under its 1938 land.

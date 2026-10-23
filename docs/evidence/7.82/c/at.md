# PLAN 7.82c: the remnant at war: the AT (2026-10-23)

The rule: ADR-664's candidate (`../b.patch`, a target on a land where the planner's enemies stand with
at most 2 land formations pulled ×3), applied to HEAD `ed282f0b`; its unit test
(`../b/landingEmptyLand1938.test.ts.txt`) red on HEAD, green with the rule, and red with the empty-land
test turned off (the division goes for Copenhagen's land).

## 1. Seed 843, years 11–20, from one save

HEAD's save of 843 at the end of year 10 (`overseasHold.ts` in a HEAD worktree, `.cache/hold82/843_y10.bin`,
copied to the rule's tree byte for byte), then 10 years each way (`843_ctl.*`, `843_rule.*`).
`churnAt.ts` has no `--load`, so Denmark's cells are `overseasHold.ts`'s, at each year's end.

| Year | without: cells | at war (days) | landed on | with: cells | at war (days) | landed on |
|---|---|---|---|---|---|---|
| 11 | 35,318 | 206 | 0 | 35,051 | 206 | 0 |
| 12 | 35,513 | 215 | 0 | 35,319 | 248 | 0 |
| 13 | 34,908 | 305 | 10 | 34,873 | 365 | 11 |
| 14 | 36,037 | 325 | 4 | 34,468 | 22 | 0 |
| 15 | 36,410 | 137 | 0 | 34,754 | 68 | 0 |
| 16 | 37,603 | 363 | 0 | 34,774 | 291 | 8 |
| 17 | 38,366 | 362 | 0 | 32,751 | 320 | 1 |
| 18 | 38,439 | 330 | 1 | 32,751 | 0 | 0 |
| 19 | 37,900 | 365 | 7 | 32,751 | 0 | 0 |
| 20 | 39,305 | 347 | 0 | 32,751 | 0 | 0 |
| **Years 11–20** | **+4.0k** | | **22** | **−2.3k** | | **20** |

The plans of Denmark's enemies that looked at its places (`plans`, `H`):

| | plans | ordered | no transports | no army |
|---|---|---|---|---|
| without | 2,289 | 19 | 2,172 (95 %) | 97 |
| with | 2,159 | 65 | 1,762 (82 %) | 332 |

- **Bars:** landed on at least 10 times: met (20), but HEAD from the same save is landed on 22 times.
  Loses at least 10,000 cells: **missed** (about 2,300). Without, under 2,000 lost: met (it gains 4,000).
- The rule turns more of the plans into orders (19 → 65), not into landings: what holds the remnant is
  the lift. 82–95 % of the plans that look at Denmark end with no transport group at hand.
- Denmark's cells with the rule fall in year 17 and then hold: it is at peace from year 18 (the
  histories split in year 14, where it is at war 22 days against 325). The difference is the war's
  course, not the landings.

## 2. Engaged per war, 821–830 × 20 years (`land/rule_*`; pooled as 7.97: engaged summed over wars summed)

| Seed | HEAD (`../../7.97/at/rule_*`) | with the rule |
|---|---|---|
| 821 | 0.460 | 0.268 |
| 822 | 0.385 | 0.488 |
| 823 | 0.423 | 0.325 |
| 824 | 0.456 | 0.424 |
| 825 | 0.441 | 0.446 |
| 826 | 0.504 | 0.336 |
| 827 | 0.396 | 0.375 |
| 828 | 0.566 | 0.568 |
| 829 | 0.643 | 0.437 |
| 830 | 0.514 | 0.585 |
| **Pooled** | **0.480** | **0.421** |

**Bar 0.480: missed** (0.421; 6 seeds of 10 lower). Landings sent to empty lands take formations from
the fronts.

## Verdict

Two of the AT's clauses missed (Denmark's loss 2,300 against 10,000; engaged 0.421 against 0.480). No
rule committed: the patch stays a candidate in `../b.patch`. ADR-669 to the user.

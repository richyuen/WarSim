# PLAN 7.38e — the AT's three bars read on HEAD (first read)

HEAD `7e65ab9` (7.38b, c and d on it), `tools/diag/nukeToll.ts <seed> 30 new`, each seed from 1938 to
year 30. The critic's 14 seeds (run 10's), then 10 unseen ones, 751–760: no sweep, report or tuning
had used them (`docs/sweeps/` ends at 741–750). Rows: `e-toll-<seed>.json`.

Bars (PLAN 7.38's AT): no burst with a utility under 0.1 that kills a million; no city struck
twice in one war (the tool counts every decided burst within a hydrogen bomb's blast radius of an
earlier burst of its war); no hydrogen bomb where a fission bomb's place is worth as much.

| Seed | Decided | Bursts | ≥ 1 M dead | Under 0.1, ≥ 1 M | Restruck in a war | Hydrogen where fission covers |
|---|---|---|---|---|---|---|
| 1307 | 14 | 14 | 0 | 0 | 0 | 0 |
| 2081 | 2 | 2 | 1 | **1** | 0 | 0 |
| 2953 | 2 | 2 | 1 | 0 | 0 | 0 |
| 3613 | 6 | 6 | 1 | 0 | 0 | 0 |
| 4219 | 0 | 0 | 0 | 0 | 0 | 0 |
| 4877 | 1 | 1 | 0 | 0 | 0 | 0 |
| 5309 | 0 | 0 | 0 | 0 | 0 | 0 |
| 5861 | 5 | 5 | 0 | 0 | 0 | 0 |
| 6421 | 8 | 8 | 2 | 0 | 0 | 0 |
| 7019 | 6 | 5 | 1 | 0 | 0 | 0 |
| 7583 | 20 | 20 | 3 | 0 | 0 | 0 |
| 8167 | 1 | 1 | 0 | 0 | 0 | 0 |
| 8693 | 3 | 3 | 0 | 0 | 0 | 0 |
| 9437 | 5 | 5 | 2 | **1** | 0 | 0 |
| **critic's 14** | 73 | 72 | 11 | **2** | 0 | 0 |
| 751 | 2 | 2 | 0 | 0 | 0 | 0 (1 read rounded, see below) |
| 752 | 0 | 0 | 0 | 0 | 0 | 0 |
| 753 | 8 | 8 | 1 | 0 | 0 | 0 |
| 754 | 13 | 13 | 1 | 0 | 0 | 0 |
| 755 | 0 | 0 | 0 | 0 | 0 | 0 |
| 756 | 16 | 14 | 2 | **1** | 0 | 0 |
| 757 | 3 | 3 | 0 | 0 | 0 | 0 |
| 758 | 59 | 59 | 5 | **1** | 5 (each with more men, ADR-569) | 0 (1 read rounded) |
| 759 | 1 | 1 | 0 | 0 | 0 | 0 |
| 760 | 3 | 3 | 0 | 0 | 0 | 0 |
| **unseen 10** | 105 | 105 | 9 | **2** | 5, none a leak | 0 |

The critic's named places are not struck on HEAD (the runs diverge from the critic's after the
first rule change): no German strike on Shanghai (4877), no United States strike on France's Paris
or Rome (8693: its three strikes are Soviet, on days 3290 to 3368), none on Tashkent (1418, 348)
nor Banda Aceh (9437: all five on the Soviet Union);
Switzerland's restrike in war 293 is 7.38d's case. 4877 and 8693 have no burst under 0.1 of a
million dead.

**Across wars (ADR-566, undecided, so 7.38d left it as it was):** seed 9437's Soviet capital at
(1526.5, 467.1) is struck in three wars, each a year or more after the last (CAPITAL_RESTRIKE_DAYS):
day 6452 by Poland, war 218 (2,579,111 dead, 0.060, cause A below), day 7181 by Italy, war 236
(1,695,135 dead, 0.252), day 7850 by Poland, war 251 (769,159 dead, 0.066). It is the critic's
pattern for Paris and Tashkent; the one-war bar does not count it (ADR-566 a), b or c would.

**Verdict, first read:** the bar on the dead is missed (4 bursts on 4 of 24 seeds), the other two
hold. Two causes, below.

## Cause A — the yield is chosen by the place's value alone (ADR-567, ADR-568's last line)

| Seed, day | Strike | Value hydrogen / fission | People expected hydrogen / fission | Utility as struck | At fission (by its parts) |
|---|---|---|---|---|---|
| 2081, 5903 | Japan → Soviet Union, war 177, resolve, doctrine 1.35 | 0.828 / 0.810 | 3,328,000 / 190,000 | 0.091, 3,339,183 dead | about 0.27 |
| 9437, 6452 | Poland → Soviet Union, war 218, doctrine 0.95, desperation 1.73 | 0.806 / 0.748 | 2,568,000 / 32,000 | 0.060, 2,579,111 dead | about 0.23 |

`partsIn` takes the larger yield wherever its value is higher at all; 7.38c's cost of the dead
then comes off that yield's utility (0.216 and 0.270). The fission strike at the same place would
have had the higher utility, killing 190,000 and 32,000. (At fission: the gain at the fission value,
the same other costs, the dead cost of the fission toll.) ADR-568 named this: "if 7.38e's bars trip
on it, a numbered task": PLAN 7.44.

## Cause B — the dead weigh little at doctrine 1.4 in extreme desperation

| Seed, day | Strike | Value hydrogen / fission | People expected | Utility | Dead cost |
|---|---|---|---|---|---|
| 756, 8216 | Germany → Belgium's capital, MAD, extreme (desperation 1.02) | 1 / 0.522 | 2,277,000 | 0.037, 2,294,126 dead | 0.137 |
| 758, 9178 | Germany → 17,112 massed Soviet men, MAD, extreme (desperation 1.72) | 0.72 / 0.341 | 1,317,000 | 0.060, 1,334,057 dead | 0.079 |

DEAD_COST 0.1 a million × (2 − 1.4) is 0.06 a million: 2.3 million dead cost what the alliance's
price does. A fission strike would not have been over the floor (its value under half), so cause A
does not reach these; both are Germany at doctrine 1.4, in extreme desperation under MAD. PLAN 7.45.

## The restrikes in a war (seed 758): new value, as ADR-569 allows

Re-run with the tool reading `War.struck` (`warStruck`: the most men an earlier burst of the side
found within a hydrogen bomb's blast of the place; the enemy men within the striker's blast now):

| Day | Strike | Men then / now | People | Dead |
|---|---|---|---|---|
| 9114 | Soviet Union → Germany | 12,484 / 14,929 | 112,000 | 130,014 |
| 9167 | Germany → Iran | 37,428 / 37,618 | 23,000 | 39,783 |
| 9380 | Germany → Soviet Union | 35,351 / 40,973 | 108,000 | 124,556 |
| 9424 | Germany → Soviet Union | 48,502 / 135,873 | 21,000 | 90,175 |
| 10063 | Germany → founded#121 | 12,335 / 20,787 | 551,000 | 564,053 |

None is a capital and each has more men than the burst before found: no leak of ADR-569's rule.
The bar's word is "city": day 10063 is a place of 551,000 people struck 8 days after a burst 3 cells
away killed 455,938, for 8,452 more men. ADR-569 weighs it as massed men; whether such a place
counts as a city struck twice is the user's reading (BLOCKERS).

## Tool corrections in this read

- **Rounding.** The hydrogen-where-fission-covers bar compared values rounded to 3 decimals. Seed
  751's day 7896 (Japan → British India, a strike of resolve on massed men) read 0.908 against
  0.908; at full precision 0.90786 against 0.90776, 3,000 people expected: the rule's strict `>` as
  written. The bar now compares unrounded (`fissionCovers`); 751 and 758 were re-run with it (both
  0; 758's first read had 1 so, day 9067). Rounding can only make a strict `>` look like a tie, never
  hide one, so the other 22 seeds' zeros stand as read.
- **`warStruck`** added (the 758 re-run above). Every other figure of the re-runs is as in the first
  read (the runs are deterministic: 59 and 2 decisions, the same bars on the dead).

Checkpoints 48 hours before each of the four misses, on this code, for 7.44's and 7.45's A/B:
`.cache/nukeToll_2081_141673.bin`, `_9437_154848`, `_756_197184`, `_758_220272` (and `_758_218736`
before the restrike of day 9114).

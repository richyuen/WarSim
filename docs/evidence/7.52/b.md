# PLAN 7.52b — the bursts read on 10 unseen seeds × 30 years

HEAD `ec1ac280` (7.52a, ADR-610, in), `tools/diag/nukeToll.ts <seed> 30 new`, each seed from 1938 to
year 30. Seeds 781–790: no sweep, report or tuning had used them (7.38e took 751–760, 7.45b 761–770,
7.50 771–780; PROGRESS's other hits on "781" are a call count, a commit hash and seed 7781). Rows:
`b-toll-<seed>.json`. A measure, not a bar (PLAN 7.52's AT).

The tool now reads each burst's `NukeToll` (the men it killed) into its toll's `men`, and counts
`civOver10x` as the critic does (`critic/scripts/c11_cmp.py`): civilians = dead − men; a burst counts
when its civilians are over ten times its men, or it killed civilians and no men.

| Seed | Decided | Bursts | Hydrogen | ≥ 1 M dead | Under 0.1, ≥ 1 M | Thrice in a year | Civilians > 10 × men | Dead | Men among them |
|---|---|---|---|---|---|---|---|---|---|
| 781 | 10 | 8 | 0 | 0 | 0 | 0 | 3 | 469,141 | 151,141 |
| 782 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 321,825 | 92,825 |
| 783 | 5 | 4 | 0 | 0 | 0 | 0 | 1 | 385,527 | 40,527 |
| 784 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 10,655 | 10,655 |
| 785 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 786 | 9 | 9 | 0 | 0 | 0 | 0 | 2 | 1,956,948 | 1,181,948 |
| 787 | 4 | 3 | 0 | 0 | 0 | 0 | 0 | 111,098 | 67,098 |
| 788 | 19 | 19 | 6 | 1 | 0 | 0 | 11 | 3,542,053 | 169,053 |
| 789 | 19 | 18 | 2 | 0 | 0 | 0 | 4 | 1,953,881 | 1,397,881 |
| 790 | 11 | 9 | 2 | 0 | 0 | 0 | 0 | 534,828 | 254,828 |
| **10 unseen** | 80 | 73 | 10 | 1 | **0** | **0** | **21 (29 %)** | 9,285,956 | 3,365,956 (36 %) |

Decided and not burst (7): intercepted. 789 has one burst restruck in its war (7.38's column; ADR-569
allows it for more men).

## Against run 11 (the critic's, 14 seeds × 30 years, before 7.52a)

| | Run 11, 14 seeds | 7.52b, 10 unseen |
|---|---|---|
| Bursts | 93 | 73 |
| Bursts per world | 6.6 | 7.3 |
| Worlds with a burst | 7 of 14 | 9 of 10 |
| Most in one world | 46 (1129) | 19 (788) |
| Civilians > 10 × men | 29 (31 %) | 21 (29 %) |
| Dead | 11.7 M in 1129 alone | 9.3 M in all ten |

Per world the bursts are about as many (7.3 against 6.6), spread over more worlds and with no world
of 40 or more. The share of bursts that kill mostly civilians is unchanged (29 % against 31 %): 7.52a
changes who is named as the deterrent and lets a holder strike that a puppet's phantom stock had held
back; it has no term on whom a burst kills. That share is PLAN 7.52c's question (the user's, an ADR).

Bursts of 500,000 dead or more:
- 786 day 10876 Soviet Union: 823,136 dead, 615,136 men, utility 0.594
- 788 day 9225 Germany: 507,706 dead, 10,706 men, utility 0.194
- 788 day 9253 Germany: 1,075,549 dead, 11,549 men, utility 0.795 (the only one of a million)
- 789 day 8301 Hungary: 585,975 dead, 337,975 men, utility 0.332

788's two German bursts 28 days apart are 7.52c's shape: a city's people, few men, a high utility
(the place's value, not its men).

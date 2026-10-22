# PLAN 7.76 — a capital taken counts in the desperation (ADR-631)

2026-10-22. Before: HEAD `bb3aab03`; its nuclear rules are PLAN 7.62's after, so the before files
here are copies of `docs/evidence/7.62/after-toll-*.json`. After: the rule. `python cmp.py before-
after-` (from this folder), `python pol.py after-pol9437.jsonl`.

## The rule

`desperationOf` (`src/sim/systems/nuclear.ts`): DESPERATION_CAPITAL (0.5) with an enemy land
formation within CAPITAL_THREAT_KM of the capital, or the capital taken in this war
(`War.capitalsLost`). Before, the second counted only for the extreme.

## Why (found at PLAN 7.75)

The critic's France (seed 7127) at war with Germany, no warheads, desperation every 5 days (a probe):

| | before the fall (day 70) | after the fall (days 75–90) | day 100 |
| --- | --- | --- | --- |
| HEAD | 1.210 | 0.981–1.030 | 1.228 (score 56) |
| PLAN 7.75's beach supply | 1.146 | 0.919–0.995 | 0.924 (score 29) |

The test held on HEAD on a later German gain; with the French coastal pockets fed from the sea it
does not come, and France, its capital taken, was never extreme again.

## Tests

`tests/unit/nukeCapitalFallen1938.test.ts`: seed 7, Germany at war with France, no German within
CAPITAL_THREAT_KM of Paris: France's desperation 0 → 0.5 with its capital taken (without: 0 → 0).
`tests/unit/nukeOverrun1938.test.ts` with PLAN 7.75's source applied as well: 3 of 3 green.

## The critic's cases

- Poland (`nukeCase.ts 9437 POL GER 10 65 bomber`, `after-pol9437.jsonl`): the same decisions as
  7.62's after: day 35 at a Soviet army (men 0.039), days 42, 59, 60.
- France with warheads (`nukeCase.ts 7127 FRA GER 10 100`, `after-fra7127.jsonl`): no burst.

## Seeds 781–790 × 30 years (`nukeToll.ts <seed> 30 new`)

| | decided | bursts | civilians > 10 × men | strikes back | dead | men |
| --- | --- | --- | --- | --- | --- | --- |
| HEAD | 133 | 132 | 21 | 23 | 13,560,586 | 4,333,586 |
| the rule | 169 | 168 | 26 | 39 | 20,541,024 | 5,994,024 |

Seeds 783, 784, 785, 786 and 788 are the same runs. In 781, 782, 787, 789 and 790 a nation whose
capital fell strikes sooner or more, and the worlds part from there (781: Japan on day 6,349 at a
new nation's army, 50,828 dead, all men, before day 6,444 at Germany; 790: Poland on day 6,112 at
Germany, before the United States on day 6,196). No bar was set before this read; the user accepted
it as measured.

## Correction (PLAN 7.74, 2026-10-22)

Poland's "day 35 … a Soviet place / army" above is `pol.py`'s previous-day best place (by utility, out of
reach), not where the decision fell. The day-35 decision is Berlin on its output alone (output share
0.050, men share 0.0004, capital 0, u 0.028, 334,000 people): `docs/evidence/7.74/README.md`.

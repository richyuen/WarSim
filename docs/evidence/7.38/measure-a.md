# PLAN 7.38a — the critic's named strikes measured (run 10, `bcbc99c`)

Tool: `tools/diag/nukeToll.ts`, run in a worktree at the critic's commit `bcbc99c` from its
checkpoints (`critic/c10_seed4877_y20.bin`, `c10_seed8693_y10.bin`, `c10_seed9437_y10.bin`) to year
30. Every decision's utility matches the critic's `nukeLog` (`c10_headless_{4877,8693,9437}.json`).
Rows: `a-toll-{4877,8693,9437}-bcbc99c.json`. `uRecomputed` differs from `u` on strikes back (the
grievance is spent by the decision before the row is read) and by a few thousandths where the hour
moved the place's men.

Utility = value × desperation × doctrine − (retaliation weighed, alliance, outrage, taboo).
"People T / F": the people the blast was expected to kill at the thermonuclear / a fission yield.
"Fission value": the place's value at a fission yield's radius.

## Bar 1: utility under 0.1, a million dead or more

| seed | day | striker → place | u | value | desp. (resolve) | doctrine | gain | costs | people T / F | fission value | dead |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 4877 | 10434 | Germany → Shanghai (China) | 0.025 | 0.402 | 1.067 | 1.4 | 0.600 | 0.575 (alliance 0.15, outrage 0.1, taboo 0.54) | 3,802,000 / 191,000 | 0.370 | 3,802,105 (105 soldiers) |
| 8693 | 5891 | United States → Paris | 0.026 | 1 | 1.348 (resolve) | 0.65 | 0.876 | 0.85 (taboo 1) | 3,157,000 / 183,000 | 1 | 3,178,766 |
| 8693 | 6969 | United States → Paris | 0.073 | 1 | 1.255 (resolve) | 0.65 | 0.816 | 0.74 (taboo 0.84) | 1,393,000 / 78,000 | 1 | 1,404,231 |
| 8693 | 9891 | United States → Rome (France) | 0.091 | 1 | 1.463 (resolve) | 0.65 | 0.951 | 0.86 (taboo 1) | 3,709,000 / 172,000 | 1 | 3,720,550 |

Also under 0.1, under a million: Paris's third (day 8130, 0.026, 609,000; fission value 0.783 of
0.91). Each was a near-tie of gain and costs: nothing in the utility weighed the 1.4 to 3.8
million dead. Each place's value is the capital's 0.3 and its output (6 to 7.5 % of the side's);
Shanghai's 105 soldiers were none of it.

## Bar 2: a city struck twice in one war

The critic's named cases are not in one war:
- Paris: wars 144, 168, 181 (and Rome 207), each a strike of the United States' resolve in a new
  war with France a year or more after the last (CAPITAL_RESTRIKE_DAYS keeps a struck capital off
  for 365 days).
- Tashkent (1418.2, 348.0): wars 182, 191, 206, 214, 286, by Poland, Italy and Japan.
- Banda Aceh (1566.3, 565.7): wars 173, 199, 207, 211, 216, 240, by Poland, Italy and Japan.

The one strike within a blast radius of a burst of the same war: seed 4877, the Soviet Union on
Switzerland, days 10477 (667,994 dead) and 10497 (1,922,429; 7 cells west, war 293), each a place
of massed men (value 1 and 0.81).

## Bar 3: a hydrogen bomb where a fission bomb's blast covers the value

8 of 37 decisions: 6 of 7 on seed 8693 (each Paris and Rome strike: fission value 1 = its value,
people 172,000 to 183,000 against 3.2 to 3.7 million), 1 on 4877 (the Soviet strike back at
Germany, day 10435, value 1 both), 1 on 9437. The yield is chosen in `detonate` by `thermonuclear`
alone, and the places weighed at its radius; a fission yield is never weighed.

## The strikes back to keep

Seed 4877's Soviet answers to Germany (days 10435, 10612, 10632; utilities 0.78, 0.48, 0.51 with
RETALIATION_BONUS; 452,654, 2,474,318 and 41,608 dead) and seed 8693's to the United States (0.78,
0.69; 1,174,992 and 543,192): a cost of the dead must leave these over NUKE_FLOOR (critic R7-B1:
an unanswered strike).

## Checkpoints for the rules' A/B

48 hours before each named strike, on the critic's code: `.cache/nukeToll_<seed>_<tick>-bcbc99c.bin`
(4877: 250417; 8693: 141385, 167257, 195121, 237385; 9437: 146833, 159193, 161953). Not committed.

# PLAN 7.109b — an answer in kind weighed against the strike it answers: the AT (2026-10-24)

**Bar:** on 10 unseen seeds × 30 years, bursts killing over ten times more civilians than men at most 0.75 × HEAD's
on the same seeds (36 → 27 or fewer); a unit test, red without; the gate green.

**Result: missed.** 36 → 34 (0.94 ×). The rule is not committed: `rule.patch` (the rule and its unit test,
`tests/unit/nukeAnswerInKind1938.test.ts`, red on HEAD in 2 of its 4 cases, green with the rule). The pin unchanged.

## The rule tried (`rule.patch`)

- A grievance remembers whether the burst that gave it struck forces (`army`: men killed, and civilians at most
  `ARMY_STRIKE_CIVILIANS` = 10 times them); saved in a section of its own (`world.nukeGrievanceArmy`).
- Retaliating for such a strike, a nation weighs only the places with an army in the blast (`CAPITAL_MEN_MIN` of the
  theatre's men), a capital among them not whole, when one of them is over its floor and in reach (`forcesWorth`);
  else every place, a capital whole, as before.

## The runs

`tools/diag/nukeVolume.ts <seed> 30` (now tags each burst `back`, a strike back), HEAD `99e796c1` in a worktree and
the rule on the same commit; seeds 961–970, from 1938.

| seed | bursts HEAD | rule | strikes back HEAD | rule | civ > 10 × men HEAD | rule | of them strikes back HEAD | rule |
|---|---|---|---|---|---|---|---|---|
| 961 | 13 | 13 | 0 | 0 | 2 | 2 | 0 | 0 |
| 962 | 40 | 38 | 14 | 14 | 4 | 3 | 2 | 1 |
| 963 | 34 | 28 | 12 | 11 | 6 | 3 | 2 | 1 |
| 964 | 5 | 5 | 2 | 2 | 1 | 1 | 1 | 1 |
| 965 | 12 | 12 | 3 | 3 | 3 | 3 | 1 | 1 |
| 966 | 14 | 14 | 5 | 5 | 1 | 1 | 1 | 1 |
| 967 | 32 | 40 | 10 | 12 | 4 | 5 | 2 | 2 |
| 968 | 35 | 35 | 11 | 11 | 4 | 4 | 3 | 3 |
| 969 | 46 | 48 | 14 | 14 | 7 | 4 | 2 | 1 |
| 970 | 47 | 44 | 18 | 14 | 4 | 8 | 3 | 3 |
| **all** | **278** | **277** | **89** | **86** | **36** | **34** | **17** | **14** |

- On HEAD 17 of the 36 are strikes back, 16 of them answering a burst on forces (the burst on the answerer before it
  that killed men and at most ten times as many civilians). The other 19 are first strikes: no rule of the answer
  reaches them, so the bar needs 9 of the 17 answers gone with none added elsewhere.
- With the rule 13 answers to a strike on forces still kill over ten times more civilians than men.

## Why (seeds 964, 965, 968 replayed with the rule, `forcesWorth` logged each day it weighed)

- **Reach.** 964, year 13.5 (nation 82 answering 75): on 65 days the places of forces were each worth ~0.68 against
  a floor of 0.025, and none in reach of its bombers or missiles; the fallback weighed every place, and it struck a
  city in reach: 86,000 dead, no men. 965, year 16.1: the one place weighed was a city (no enemy formation within
  its front's reach): 47,000 dead, no men.
- **A garrison as an army.** 968, year 17.6 (10 answering 75): the one place of forces in reach held 0.0124 of the
  theatre's men, over `CAPITAL_MEN_MIN` (0.01), with 97,000 people expected dead: 96,000 civilians and no men.

## What is left

The answer is weighed by what is in reach: a city in reach is struck for an army out of it, and a place counts as
forces with a hundredth of the theatre's men in it. See BLOCKERS (ADR-691) for the options.

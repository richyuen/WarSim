# PLAN 7.114 — the answer weighed by its own toll: the AT (2026-10-25)

**Bar:** on the next 10 unseen seeds × 30 years against HEAD on them, strikes back killing over ten times more
civilians than men at most 0.25 × HEAD's, and all bursts so at most 0.75 × HEAD's; a unit test, red without; the gate
green.

**Result: missed by one burst.** Strikes back so 8 → **0** (bar 2: met); all bursts so 32 → **25** (bar 24: missed).
The rule is not committed: `rule.patch` (the rule and its unit cases). Its gate was green on `8b30eda3` (1,353 related
unit tests, the pin unchanged).

## The rule (`rule.patch`)

Answering a strike on forces (a grievance's `army`, PLAN 7.109b), a nation weighs only the places of forces: an army
in the blast (`CAPITAL_MEN_MIN` of the theatre's men), whose burst is expected to kill at most
`ARMY_STRIKE_CIVILIANS` (10) civilians for each man (`PlaceParts.men`: the men of either side in the blast at that
yield), and in reach. With none it weighs no place: the answer waits within the grievance's days, or lapses. Before,
with no such place worth its warhead and in reach, it fell back on every place, a capital whole.

Unit (`tests/unit/nukeAnswerInKind1938.test.ts`, in the patch): "no French force left: no place, the answer waits"
(restated from "Paris, whole", the fallback this rule removes) and "a garrison in Paris is no place of forces" (one
division at Paris: men share 0.045, 11,214 men against 231,000 people expected); both red on HEAD, green with the rule.

## The runs

`tools/diag/nukeVolume.ts <seed> 30`, HEAD `b912a78a` in a worktree and the rule on it; seeds 981–990, from 1938.

| seed | bursts HEAD | rule | strikes back HEAD | rule | civ > 10 × men HEAD | rule | of them strikes back HEAD | rule |
|---|---|---|---|---|---|---|---|---|
| 981 | 39 | 35 | 13 | 9 | 6 | 7 | 1 | 0 |
| 982 | 39 | 39 | 6 | 6 | 2 | 2 | 0 | 0 |
| 983 | 18 | 18 | 5 | 5 | 1 | 1 | 0 | 0 |
| 984 | 33 | 44 | 8 | 14 | 7 | 6 | 2 | 0 |
| 985 | 8 | 18 | 1 | 3 | 1 | 1 | 1 | 0 |
| 986 | 3 | 3 | 1 | 1 | 1 | 1 | 0 | 0 |
| 987 | 26 | 45 | 8 | 10 | 3 | 3 | 1 | 0 |
| 988 | 1 | 1 | 0 | 0 | 1 | 1 | 0 | 0 |
| 989 | 45 | 18 | 16 | 7 | 7 | 1 | 2 | 0 |
| 990 | 30 | 28 | 6 | 4 | 3 | 2 | 1 | 0 |
| **all** | **242** | **249** | **64** | **59** | **32** | **25** | **8** | **0** |

- The answers: no strike back kills over ten times more civilians than men with the rule (8 on HEAD).
- The 25 left are first strikes (the bursts so less the strikes back so): 24 on HEAD, 25 with the rule. No rule of the
  answer reaches them; the worlds part after the first answer changed, so a seed's first strikes move either way (989:
  45 → 18 bursts; 987: 26 → 45).
- The bar of all bursts asks the answer's rule to take 8 of 32 out with first strikes unchanged (24 left): it takes all
  8, and the first strikes rose by one.

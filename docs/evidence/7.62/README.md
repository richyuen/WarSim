# PLAN 7.62 — an empty capital is no first-strike target (ADR-629)

The rule (ADR-611 b, the user's decision): an enemy capital's TARGET_CAPITAL (0.3) counts on a first
strike only with CAPITAL_MEN_MIN (0.01) of the theatre's men in the blast, at the yield weighed; on a
strike back it counts as before (`partsIn`, `src/sim/systems/nuclear.ts`).

Before: HEAD `1ad0c127`. After: the same with the rule. Same tools, same seeds, run side by side.

**Status: in** (2026-10-22, the user's decision b, ADR-629): `rule.patch` applied on `main`, and
`tests/unit/nukeOverrun1938.test.ts`'s first case amended to what the rule makes (an empty Berlin
weighs no capital; France holds fire in 100 days). Before that decision: **not in.** With the rule, the critic's France of R8-B1 (§4) never strikes, and
`tests/unit/nukeOverrun1938.test.ts` ("France struck") goes red; a test is not weakened, so the rule
waits in `rule.patch` (the code, SPEC §6.4's line and the unit test; `git apply` from the repo's
root) for the user's decision (BLOCKERS, ADR-629).

## 1. The critic's Poland (`nukeCase.ts 9437 POL GER 10 65 bomber`)

`before-pol9437.jsonl`, `after-pol9437.jsonl`; `python pol.py <file>` lists each decision with the best
place of the day before.

| | Before | After |
|---|---|---|
| First decision | day 28, u 0.074: Berlin (capital 0.3, men share 0, 334,000 people) | day 35, u 0.027: a Soviet place (capital 0, men share 0.039) |
| Decisions in 60 days | 6 (days 28, 35, 45, 46, 53, 60) | 4 (days 35, 42, 59, 60) |
| A capital with men share under 0.01 | Berlin, day 28 | none |

R8-B1 held: the editor-armed holder at war still strikes within 60 days (day 35), at an army. Its
day-60 place before (capital 0.3, men 0.021) is the kind the rule keeps.

## 2. Seeds 781–790 × 30 years (`nukeToll.ts <seed> 30 new`)

`before-toll-<seed>.json`, `after-toll-<seed>.json`; `python cmp.py before- after-`. Civilians over 10
× men as 7.52b counts them (a burst's dead less its men over ten times its men, or civilians and no men).

| | Before (HEAD) | After | AT's bar |
|---|---|---|---|
| Decisions / bursts | 111 / 110 | 133 / 132 | — |
| Civilians > 10 × men | 20 | 21 | at most 13 (21 − 8, from `ec1ac280`) |
| Strikes back (bursts) | 21 | 23 | unchanged |
| First strikes on an empty capital (decided; the isolating column) | 6 | 0 | — |
| Dead / men among them | 11,949,004 / 3,668,004 (31 %) | 13,560,586 / 4,333,586 (32 %) | — |

The two bars are missed. The isolating column goes to 0, as the rule makes it.

### Why: the worlds part at the first changed decision

Seeds 783, 784, 786, 788 and 789 had no empty-capital first strike and are identical before and
after (the same decisions, places and tolls). The five others part at the first decision the rule
removes; what was struck in its place:

| Seed | Before | After (the striker's next decision) |
|---|---|---|
| 781 | Japan on a Soviet capital, men share 0: 42,000 dead, 0 men | Japan on a German army (men 0.169), 121 days later: 60,890 dead, 56,890 men |
| 782 | Japan on South Africa's capital, men 0.001: 11,135 dead, 135 men | Japan on a South African army (men 0.044), 5 days later: 10,934 dead, all men |
| 785 | Britain on Sweden's capital, men 0: 180,000 dead (H-bomb), 0 men | Britain on Italy's capital with an army (men 0.045), 710 days later: 75,230 dead, 11,230 men |
| 787 | Poland on Nationalist Spain's capital, men 0: 1,005,000 dead (H-bomb), 0 men | Poland on a Spanish army (men 0.044), 23 days later: 11,655 dead, 10,655 men |
| 790 | the Soviet Union on Berlin, men 0 (intercepted) | the Soviet Union on Berlin, 6 days later, with an army there (men 0.179; intercepted) |

Each removed strike is replaced by one on an army. The dead of the four that burst fall from
1,238,135 (135 men) to 158,709 (89,709 men). After those first decisions the worlds differ, and the
30-year counts are of other wars: in 790 the Soviet Union decides 22 strikes against 8 before, three of them on
places of output with no men (555,142 dead), which the rule does not cover.

### What the bar of 13 assumed

The bar came from 7.52c's first-order read on `ec1ac280`: 21 civilian bursts, 8 of them removed by
the rule. On HEAD the same seeds give 20 civilian bursts, and only 5 of them (plus 2 told without
their parts) are first strikes on an empty capital. Even if the rule removed every one and nothing took
their place, the count would be 13 to 15. The other 15 are strikes back (7, which the rule leaves
alone by design), first strikes on a capital with an army in it (2), first strikes on places with no
capital (4), and 2 told without their parts.

## 3. Test

In `rule.patch`: `tests/unit/nukeEmptyCapital1938.test.ts` (seed 7, Germany with missiles against France): Paris with
every French formation within two blast radii taken off, a first strike: capital 0 (red without: 0.3);
the same Paris on a strike back (a grievance against France): 0.3; with three divisions in Paris
(men share 0.067), a first strike: 0.3.

## 4. The critic's France of R8-B1 (`nukeCase.ts 7127 FRA GER 10 100`)

`before-fra7127.jsonl`, `after-fra7127.jsonl` (a row each 5 days). PLAN 7.18's test
(`nukeOverrun1938.test.ts`, "the critic's France: it strikes before it loses its last bomber",
`expect(decided.length, 'France struck').toBeGreaterThan(0)`) is red with the rule, in the gate's
related run and again alone.

| | Before | After |
|---|---|---|
| Decisions in 100 days | days 59, 60: both Berlin, capital 0.3, men share 0, 334,000 people, u 0.034–0.035 | none |
| Berlin's value (through 0.2) | 0.154–0.164 | 0.085–0.104 (the capital's 0.3 gone) |
| Best place in reach, days 60–75 (extreme desperation) | — | enemy armies (men share 0.055–0.059), u 0.005–0.019 against the floor 0.025 |

France's only strike before is on an empty Berlin, the kind of strike the rule removes. Two critic
findings meet on this case: run 8's R8-B1 ("France and Poland, given 10 warheads in the editor and
overrun, never strike") and run 11's objection (Berlin with no men struck for its civilians). Any
variant of the rule that lets France strike an empty Berlin lets Poland do the same: Poland's Berlin
(day 28) was in extreme desperation too (1.03).

## Correction (PLAN 7.74, 2026-10-22)

Poland's "day 35 … a Soviet place / army" above is `pol.py`'s previous-day best place (by utility, out of
reach), not where the decision fell. The day-35 decision is Berlin on its output alone (output share
0.050, men share 0.0004, capital 0, u 0.028, 334,000 people): `docs/evidence/7.74/README.md`.

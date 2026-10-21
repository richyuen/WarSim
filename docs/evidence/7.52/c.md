# PLAN 7.52c — cities with no soldiers struck: what carries them, and what each rule would remove

The critic's design objection (run 11, "Design objections"): the editor-armed Poland of seed 9437
bombs Berlin (334,000 civilians, 379 men), Rome (172,000, 90) and Prague (134,000, 390) in its first
60 days (`critic/c11_g2_9437_POL.json`); "with DEAD_COST at 0.1 a million, the weight of the dead is
too small to change any of them". The user's, an ADR proposed (ADR-611); no rule here.

## 1. Poland's Berlin, headless (`c-pol9437.jsonl`)

`npx tsx tools/diag/nukeCase.ts 9437 POL GER 10 65 bomber` on HEAD `25de5b25`: the critic's set-up
(10 warheads, a strategic bomber group at Warsaw, Germany declares war), a row a day. Here Poland
strikes Berlin on day 27, in the critic's browser run on day 43; the place and the people (334,000)
are the same. The later strikes of this run do not match the critic's places one for one (the day
before's best place is not always the one decided), so Rome and Prague are cited from the critic's
alerts, not from this log.

Day 27, the first strike: utility 0.074 against a floor of 0.025.

| Part | Figure |
|---|---|
| The place's value | 0.168 = (10 × output share 0.053 + capital 0.3) × the chance through 0.201 |
| Men in the blast | 0 (men share 0) |
| Gain | 0.168 × desperation 1.009 × doctrine 0.95 = 0.161 |
| Costs, × through | 0.201 × (outrage 0.1 + taboo 0.6 × 0.5 in extreme desperation + dead 0.035) = 0.087 |
| The dead's share of the utility | 0.007 (0.1 × 0.334 × 1.05 × 0.201) |

- **DEAD_COST:** Berlin falls under the floor only at about 8 × today's (0.8 a million). The dead's
  cost is × the chance through, as the place's value is: a bomber with a fifth's chance weighs a
  fifth of the dead.
- **The capital:** of the value before the chance through (0.83), 0.3 is the capital's and 0.53 the
  output's. Without the capital the utility is 0.015, under the floor.

## 2. The 7.52b bursts, first order (`c_counterfactual.py`, `c-counterfactual.txt`)

Seeds 781–790 × 30 years (7.52b's rows, HEAD `ec1ac280`): 66 of the 73 bursts have their decision's
utility parts (the 7 others are told without them). 15 of the 66 kill over ten times more civilians
than men; of those 15, 13 are on a place with an enemy capital (TARGET_CAPITAL 0.3), 9 have no men in
the blast, 1 is a strike back.

Each rule is read first order: a burst's utility is recomputed under the rule and it counts as
removed when that falls under its floor (`strikeFloor`). This is an upper bound on what a rule
removes: it does not model the striker taking its next place, or the same place a few days later as
its desperation climbs (Poland's rose about 0.02 a day).

**a. DEAD_COST × k** (the critic's ask):

| DEAD_COST | Removed | of them civilians > 10 × men | others | dead | civilians |
|---|---|---|---|---|---|
| 0.1 (now) | 0 | 0 | 0 | 0 | 0 |
| 0.2 | 3 | 2 | 1 | 351,579 | 330,000 |
| 0.5 | 5 | 3 | 2 | 1,137,744 | 1,035,000 |
| 1.0 | 9 | 7 | 2 | 3,287,352 | 3,146,000 |
| 2.0 | 17 | 12 | 5 | 5,190,221 | 4,505,000 |

None of these seeds' 10 strikes back falls under the floor at any k up to 1.0. ADR-572's case does: a
strike back weighs the dead too (PLAN 7.38c), and the Soviet answer of 2.5 million dead at 0.237
(seed 4877, `strikeFloor`'s comment) is under its floor of 0.1 from DEAD_COST 0.2.

**b1. A capital's 0.3 on a strike back only** (a first strike weighs a place by its output and men):
24 first strikes on a capital; 13 under the floor without it, 11 of the 15 civilian bursts and 2
others; 2,990,080 dead, 56,080 of them men.

**b2. A capital's 0.3 on a first strike only with an army in the blast** (men share at least 0.01 of
the theatre's men; on a strike back as now): 8 under the floor, all 8 of them civilian bursts;
1,083,240 dead, 240 of them men. 788's Germany on Belgium's capital with 11,549 and 5,785 men in it
(1,075,549 and 418,785 dead) is not removed.

## 3. What each leaves open

- **a** removes the fewest civilian bursts for the largest change, and reopens ADR-572 (a strike back
  sunk by its dead) unless strikes back are exempted, which ADR-568 and PLAN 7.45 chose against.
- **b1** removes the most, and costs 2 bursts on men (11,183 each, 787 and 788) and the capital as a
  first-strike target. It bears on R8-B1 (run 8: the editor-armed France and Poland never struck): the
  capital is what let Poland strike first at all; without it Poland strikes later, at a men place, or
  not in 60 days: not measured.
- **b2** removes only the empty-capital bursts and keeps a capital with an army in it a target.
  R8-B1's tension as b1's for an empty capital. Amends SPEC §6.4's "a city is a target" for a first
  strike.
- **No rule:** SPEC §6.4 and PLAN 7.38's "no bar on the civilians' share" (the user's) stand.

In ADR-611 the options are a (DEAD_COST), b (b2, recommended), c (b1) and d (no rule).

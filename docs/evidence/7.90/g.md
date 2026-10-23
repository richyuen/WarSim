# PLAN 7.90g: a port's army split over its groups

## The read: whose the trips of one are

`tools/diag/ferrySplit.ts` (new, read only): at the end of each ferry turn of the USA, each transport
group that took men aboard on that turn, how many it carries, and, for a trip of one, the formations
of the turn's free army (free at its start) at the same port that the group had room left for: still
standing, or aboard another group (one tried after it in the turn, one tried before it, or one the
turn never tried). Commands: `npx tsx tools/diag/ferrySplit.ts <out.json> 90 1129
critic/c12_seed1129_y10.bin USA` and `… 90 6421 critic/c12_seed6421_y20.bin USA`. Logs:
`g_split_head_*.log` (HEAD, 5161de24), `g_split_*.log` (the rule).

On both saves the trips of one come from one rule: `board` orders the port's formations aboard its
group one by one, `orderLanding(…, via = fleet)`, until one is refused; and `tryLanding` took `via` as
one more group it might use, searching the groups of the nation standing at the port with room, the
lowest id first. With `fleet` full, the next formation went on another group standing there, and its
order set that group sailing with it alone; the loop went on to the next.

- **1129 year 10, day 3712, Norfolk:** group 365's try took 368 and 369 (full), then 388 went on 568
  and 532 on 571, each sailing with one. 568's and 571's own tries later in the turn found nobody at
  the port and sent others there (the "sends" 7.90d saw).
- **6421 year 20, day 7324, Norfolk:** one try took 152's and 172's room, then sent 21 more groups to
  sea with one division each (196, 311, 330, … 1432). Two more at St. John's on day 7373.

## The AT

Trips of one that left at their port a free formation the group had room for. Loose: aboard any
group. Strict: standing, or aboard a group tried after it or untried (one aboard a group tried before
it filled that group first, in the turn's order, which is right).

| 90 days | HEAD loose | HEAD strict | rule loose | rule strict | trips (HEAD → rule) | trips of one |
|---|---|---|---|---|---|---|
| 1129 year 10 | 2 | 1 | **0** | **0** | 24 → 23 | 2 → 0 |
| 6421 year 20 | 23 | 21 | 1 | **0** | 31 → 18 | 27 → 4 |

The one left on 6421 (day 7387, 196 at Norfolk): 188, tried before it, took 287 (5,530) and 675
(12,412) and had 7,258 left; 196's one division (12,412) had no partner that fit, and the two it
"left" are on 188. Right, so not counted.

## Every nation's landings (A/B from one save)

`tools/diag/landingsAb.ts` (new): every nation's embarkations, trips (a group and the hour it took
men) and landings over 90 days, on each rule from the same save (`g_landings_head.log`,
`g_landings_rule.log`). `board` is also the landing's and Normandy's way aboard, so a landing that
spilled over a port's groups now loads its one.

| 90 days | trips | trips of one | a trip | landed | men landed |
|---|---|---|---|---|---|
| 1129 y10 HEAD → rule | 31 → 29 | 7 → 4 | 1.87 → 1.90 | 35 → 35 | 391,201 → 391,201 |
| 6421 y20 HEAD → rule | 52 → 30 | 43 → 11 | 2.13 → 3.60 | 104 → 102 | 460,589 → 459,853 |
| 7019 y10 HEAD → rule | 19 → 19 | 12 → 12 | 1.47 → 1.47 | 26 → 26 | 244,057 → 244,057 |

The same men land with fewer groups at sea; no nation's landing other than the USA's moved (6421:
Mexico, Japan, Germany, the Soviet Union the same). 7019's trips of one are not this rule's.

## The test

`amphibious1938.test.ts`, "a formation ordered on a full group is refused, and Portsmouth's other
group stays": three British divisions at Portsmouth, two aboard one group, the third ordered on it is
refused and no second group sails; named, the other group takes it. Red without (the third went on
Portsmouth's other group, which sailed).

## The pin

5161de24 → f9344f0e (ADR-649).

## The gate: red for a deploy cause, so not committed

The gate's related run with the rule: `deploy.test.ts` "after 60 days of Germany against Poland most
formations in contact have their enemy's elements in one view at 20 m/px" red, 86 of 97 (0.887)
against its bar of 0.9; on HEAD 69 of 70. The rule changes seed 99's history (the pin moves), and the
day-60 world has more formations in contact. `tools/diag/deployView.ts` (new) lists the pairs that
fail (`g_deploy_seed99_rule.log`, `g_deploy_seed99_head.log`): all 11 are Chinese blocks against two
Japanese formations, three stacked on one cell against 393 (whose block faces another) and seven from
four cells against 366, which landed on day 12.9. HEAD has one such pair (410 against 393): the
weakness is the deploy layout's (ADR-89, ADR-133), as at ADR-132, which a history change found the
same way. The test is not narrowed. The rule, its test, ADR-649, the pin's entry, SPEC and PARITY
are kept as `g.patch` (`git apply docs/evidence/7.90/g.patch` on 5161de24's tree) and committed once
PLAN 7.91 mends the deploy case.

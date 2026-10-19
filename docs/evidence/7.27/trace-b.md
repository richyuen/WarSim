# PLAN 7.27b — Germany's wars with the Soviet Union, traced

2026-10-19, code of `f29a94a` (pin c3bd280a, no sim change since 7.27a's checkpoints). Tools:
`tools/diag/warTrace.ts` (one war from a checkpoint to its end and the years after it; `--nth`
for a later war of the same two) and `tools/sweep/stasis.ts` (the five of each seed's longest
span). Runs: `.cache/727/trace732.json` (from `s732-y25.bin` to year 33), `trace732b.json` (the
second war of the same run, `--nth 2`), `trace735.json` (from `s735-y26.bin` to year 40).

The checkpoint reproduces 7.27a's diag: war 324, GER v SOV, declared in year 25.51, is 181 days
old at year 26.00 with score 35, exhaustion 18/29 in the trace's daily rows as in
`.cache/727/diag732.txt`.

## The five of each seed's longest span

`npx tsx tools/sweep/stasis.ts` on the three unseen sweeps (`.cache/727/stasis.txt`) gives 7.27a's
table for 731–740 line for line, and for 701–730: of 30 seeds, the longest five hold the USA on
30, the Soviet Union on 27, France 18, Australia 13, Italy 11, Germany 9. The failing spans (20
years or more): 702, 704, 706 (FRA ENG RAJ AST USA; SOV FRA ENG RAJ USA twice), 732, 735, 740.

## Seed 732, the first war (war 324, years 25.51–26.10, 215 days)

**How it ended.** On day 215 the Soviet Union's exhaustion went from 34.1 to 100 in a day and it
sued (`warSystem`: exhaustion ≥ EXHAUSTED). No one offered peace: the AI offers none
(`offerPeace` is the player's); a side that is broke, exhausted or crushed is given the peace on
the day's score, and the winner has no say. Score 43, Germany's exhaustion 21.5. The terms:
Germany annexed what it held, 3.38 M km² of 15.7 M (21.5 %); Germany 12.1 → 15.1 M km², the Soviet
Union → 11.9 M (Japan's war with it, 51 days old, ended the same day). Truce 729 days.

**The Soviet exhaustion, split** (`war.ts`: 0.1·days + 80·lost + 60·share): on day 214, 21.4 +
0 + 12.9 = 34.1; on day 215, 21.5 + 65.4 + 12.9 = 99.8. `lost` is measured against the side's men
on the war's first day (`startMen`): the Soviet Union had one land formation, 12,000 men, on
15.7 M km². It raised one or two more (25,000–27,000 men by day 68, so `lost` stayed 0), they were
destroyed in weeks 28–31 (27k → 15k → 13k → 2k), and the last went on day 215: 82 % of 12,000
lost. A side with a token army is exhausted the day it loses it, whatever the land.

**Who was winning, and the front.** Germany had 500,000–565,000 men in land formations; the
Soviet side 1–3 formations. The front did not stall: of Germany's men, 49 % on average stood
within PRESSURE_RADIUS + 1 cells of this war's front (pressing, where the ground flips), up to
43 formations and 368,000 men, and most of the rest marched within DEPLOY_RANGE_CELLS of it
(`nearMoving`); 0–11 % stood far and still. The land held rose every day: 11,800 km² a day in the
first half, 19,800 in the second, 11,000–17,000 on the war's last ten days. The war was cut short
while the attacker was gaining fastest.

**After it.** The truce ran to year 28.1. Germany then sat in 3–4 wars at once until year 31.0
(its own with England and Iran, and Italy's with Yemen and #127 by the alliance); `MAX_WARS` (2)
counts every war a nation is on a side of, so it declared on no one. Its next war on the Soviet
Union came in year 31.03.

## Seed 732, the second war (war 389, years 31.03–31.46, 158 days)

The same end: the Soviet side sued at exhaustion 93.4 (15.8 + 69.2 lost + 8.4 share), score 53,
Germany's exhaustion 15.9. Germany took 1.75 M km² of 11.2 M (14–16 %); truce 729 days. The
Soviet land formations were one or two, 10,000–13,000 men throughout, so the loss that wore it
down (lost 0 → 0.87 over days 130–158) was of men the trace's land tally does not hold (`menOf`
counts fleets' crews, PLAN 4.6e2, and formations at sea). Here Germany fought France at the same
time: of its 1.14 M men, 2–8 % pressed the Soviet front, and from day 89 45–71 formations stood
near France's front;
the side (17 nations) 13 %. The land held still rose 10,000–12,000 km² a day.

## Seed 735 (war 317, GER v FIN SOV NOR, years 32.93–33.45, 190 days)

The defending side (Finland leading, the Soviet Union and Norway) sued at exhaustion 80.1 (19 +
55.4 lost + 5.6 share): its land men fell 142,000 → 44,000 by day 146, and from then exhaustion
crept up by the days alone to 80 on day 190. Score 16, Germany's exhaustion 19.5; 1.33 M km² held,
9.4 % of the side's land. Germany pressed with 19 % of its men on average (37 formations, 402,000
men at most); 15–22 formations stood far and still all war, 15 of its partners' (209,000 men) on
another landmass. Then on 735 Germany fought the Soviet Union in years 34.75–35.35, 37.38–37.89
and 39.91–39.99 (16 days): the same short wars.

## The fork (for 7.27c)

The war is ended by a rule while the attacker wins: the defender's exhaustion reaches EXHAUSTED
from `80·lost` on a small army (12,000 men on 15.7 M km²; 142,000 on 735), and the suit is
granted on the day's score, with 9–22 % of the land taken and the attacker at exhaustion 16–22
and gaining ground at its fastest. Then a 729-day truce, and `MAX_WARS` held by allied wars.
That is the war's end, the strategic AI's and the war system's, and stays 7.27's.

The land front is not what stops it: on 732's first war half of Germany's men pressed the front
and the ground taken rose every day to the end. 732's second war and 735 had most of Germany's
men elsewhere (France, far and still), yet the land taken still rose daily, and the war ended by
the same suit. A new part of PLAN 7.29 is not called for by this trace.

The rule for 7.27c, one cause, to choose among (measured on `sweep:quick`):
- the suit granted only when the winner wants it: a side that sues while the other gains ground
  and is not itself worn (its exhaustion under a bar) fights on, to capitulation or its own
  exhaustion; or
- `lost` weighed by the army a side could have (its men against the men its land and income
  keep), so that losing a token army is not losing the war; or
- the terms: a suit by exhaustion gives the winner more than it holds (the land its armies stand
  near), which leaves the war's length alone.
The first is closest to the trace (the war ends while the winner gains); the truce and
`MAX_WARS` stay as they are unless the sweep shows them next.

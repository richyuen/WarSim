# PLAN 7.18j: a place's men weighed against a theatre of weight (measure)

The rule (ADR-492, `d923d43`): a place's enemy men are a share of max(the enemy side's men within
FRONT_KM of it, THEATRE_FLOOR 0.25 × all the side's men), so a lone garrison is not the whole of
its theatre.

## Before

`tools/diag/nukeResolve.ts <seed> 30` at `07c7e49` (`.cache/r718i/after_<seed>.json`; 7.18i's
after): 15 tolls under 5,000, at places of theatres of 74 to 5,229 men read after the burst, each a
garrison weighed as the whole of its theatre: seed 4's Britain on Japanese garrisons (2,267 and
5,229 men, 935 and 2,305 dead), seed 1's Britain on #114's (456 to 1,380 men, 168 to 2,875 dead)
and China's (74 to 126 men, 8 to 1,044 dead), seed 2's Netherlands on a Japanese one (1,504 dead).

## After

The same tool at `d923d43` (`.cache/r718j/after_<seed>.json`, now with `theatreMen`):

| Seed | Decisions (7.18i → 7.18j) | Bursts | First burst, year | Tolls under 5,000 | Same decisions until |
|---|---|---|---|---|---|
| 1 | 34 → 22 | 22 | 13.3 | 12 → 1 | the 4th (day 4,937) |
| 2 | 3 → 3 | 3 | 19.0 | 1 → 0 | the 3rd (day 7,124) |
| 3 | 1 → 1 | 1 | 30.0 | 0 | all |
| 4 | 4 → 4 | 4 | 14.0 | 2 → 0 | the 3rd (day 9,423) |
| 5 | 4 → 4 | 4 | 14.8 | 0 | all |
| 6 | 0 | 0 | | 0 | |
| 7 | 7 → 7 | 7 | 12.8 | 0 | all |
| 8 | 7 → 7 | 7 | 13.5 | 0 | all |
| 9 | 0 | 0 | | 0 | |
| 10 | 6 → 2 | 2 | 9.2 | 0 | the 1st (day 3,361 → 3,363) |

Bursts on 8 of 10 seeds, 7 before year 20, as before. Tolls under 5,000: 15 → 1. Resolve strikes on
nations under 10 % of the side's output: 1 → 0. No interception; no decision at a chance through
under 0.5.

- **Where the garrison strikes went.** Seed 2's Netherlands, 1,504 dead on a Japanese garrison of a
  theatre of 12,632 men, now strikes China's capital (614,183 dead). Seed 4's Britain, 2,305 and 935
  dead on Japanese garrisons, now strikes a force of 21,763 men in its theatre (62,183 dead) and,
  at a utility near 0, a place of 5,003 dead. Seed 1's Britain no longer strikes #114's and China's
  garrisons (12 decisions fewer); its world parts from day 4,937.
- **The one left.** Seed 1, day 5,008: the Soviet Union on China, 3,842 dead, a theatre of 4,666
  men after the burst (79,833 by the floor, of a side of 319,332), at a utility of 0.053. A force
  near 2.5 % of its side keeps its value under the floor (TARGET_SCALE 10: a blast of 2.5 % of the
  side's men is worth the chance through). A strike at a utility of 0.05 is 7.25's (no strike under
  a floor of utility).
- **Seed 10** parts at its first decision (the Soviet Union on the Raj, day 3,361 → 3,363) and is
  another world from there: 2 decisions, Germany's on Britain by its resolve (844,540 dead).

## The critic's set-ups

Unchanged, and now asserted on Germany (`nukePoland1938.test.ts`, `nukeOverrun1938.test.ts`):
Poland strikes Germany on seeds 5591 (day 40, 1,003,354 dead), 7127 (day 88, 442,030) and 3929
(day 65, 443,014); France (7127) decides on day 62, its first burst on Germany. The German masses at
Warsaw are theatres of 450,000 men and more of a side of 1.7 million, above the floor.

## The test

`nukeTheatre1938.test.ts` (seed 7, Britain on Japan, year 1): a Japanese formation of 1,800 men set a
theatre away from the rest is weighed against 175,126 (a quarter of 700,505), a men share of 0.009
and a value of 0.056, where before it was the whole of its theatre; the most massed place (41,160
men within 30 km, a theatre of 455,585) is weighed against its theatre, as before.

# PLAN 7.18i: a warhead's costs weighed as its gain is (measure)

The rule (ADR-491, `7d9fa18`): U = targetValue × desperation × doctrine + through × (the strike
back's bonus − the costs), where targetValue is already × through, the chance the warhead gets
there (1 by missile, 1 − the bomber's interception chance). So U is through × the utility of a
burst. Before it, the costs were weighed whole against a gain × through.

## Before: how often the chance through keeps a utility under 0

`tools/diag/nukeGates.ts <seed> 30` (`held`: war-days whose best place is at most 0, no MAD cap,
while a place's utility if its warhead got there is above 0), at `41e8788`, seeds 1–10 × 30 years
(`.cache/r718i/before_<seed>.json`):

| Seed | War-days weighed with a place | Best at most 0 | Held by the chance through | Of them losing | Extreme |
|---|---|---|---|---|---|
| 1 | 20,003 | 19,833 | 9 | 9 | 6 |
| 2 | 1,736 | 1,733 | 64 | 0 | 0 |
| 3 | 10,263 | 10,229 | 176 | 0 | 0 |
| 4 | 3,754 | 3,565 | 0 | 0 | 0 |
| 5 | 465 | 461 | 147 | 0 | 0 |
| 6 | 9,570 | 9,529 | 0 | 0 | 0 |
| 7 | 12,231 | 12,042 | 0 | 0 | 0 |
| 8 | 5,140 | 5,115 | 82 | 82 | 5 |
| 9 | 13,957 | 13,519 | 0 | 0 | 0 |
| 10 | 18,966 | 18,677 | 357 | 350 | 0 |
| all | 96,085 | 94,703 | 835 | 441 | 11 |

On 6 of 10 seeds. In the critic's set-ups it was the whole story: Poland (10 warheads, a strategic
group at Warsaw, Germany's war) struck nothing on seeds 7127 and 3929 before its bomber was lost.

## After

The same tool at `7d9fa18` on the six seeds with held days (`.cache/r718i/gatesAfter_<seed>.json`):
`held` is 0 on each, and on the five whose world is unchanged each of those war-days is now
`noReach` (positive, but no bomber of the holder's reaches the place): seed 1, 135 → 144; seed 2,
0 → 64; seed 3, 33 → 209; seed 5, 0 → 147; seed 8, 1 → 83, each up by its held days (seed 10's
world parts, below: 281 → 508). Unaided, the places held back by the chance through were out of the holder's reach, so the
rule adds no strike in a world without the editor's help.

`tools/diag/nukeResolve.ts <seed> 30` (now counting `NukeIntercepted`), against 7.18h's after
(`.cache/r718h/after_<seed>.json`, the same rules but this one):

| Seed | Decisions (7.18h → 7.18i) | Bursts | First burst, year | Tolls under 5,000 | Resolve strikes on nations under 10 % | Intercepted |
|---|---|---|---|---|---|---|
| 1 | 34 → 34 | 34 | 13.3 | 12 → 12 | 1 → 1 | 0 |
| 2 | 3 → 3 | 3 | 19.0 | 1 → 1 | 0 | 0 |
| 3 | 1 → 1 | 1 | 30.0 | 0 | 0 | 0 |
| 4 | 4 → 4 | 4 | 14.0 | 2 → 2 | 0 | 0 |
| 5 | 4 → 4 | 4 | 14.8 | 0 | 0 | 0 |
| 6 | 0 | 0 | | 0 | 0 | 0 |
| 7 | 7 → 7 | 7 | 12.8 | 0 | 0 | 0 |
| 8 | 7 → 7 | 7 | 13.5 | 0 | 0 | 0 |
| 9 | 0 | 0 | | 0 | 0 | 0 |
| 10 | 9 → 6 | 6 | 9.2 | 1 → 0 | 1 → 0 | 0 |

Seeds 1–9: the same decisions, day for day. Seed 10 parts at day 3,361 (the Soviet Union's strike
on the Raj, 7 days earlier, u 0.035 against 0.021: the place's chance through under 1 at its
decision) and is another world from there: Germany on Britain in year 11.4, Britain on Italy,
Italy's three on the Soviet Union in year 25.9; Britain's strike on Greece (0.5 % of its side) is
not in it. Bursts on 8 of 10 seeds, 7 before year 20, as before. **Not more strikes on poor
places**: tolls under 5,000 16 → 15, light nations 2 → 1; no decision at a place with a chance
through under 0.5, as before.

## The critic's set-ups

| Set-up | Before | After |
|---|---|---|
| Poland, seed 5591 | decided day 64, burst day 65 (Italy, near Rome) | decided day 39, burst day 40 on Germany (1,003,354 dead) |
| Poland, seed 7127 | no strike before the bomber was lost | days 86, 87 (stopped short), 88: burst on Germany (442,030) |
| Poland, seed 3929 | no strike before the bomber was lost | days 63, 64 (stopped short), 65: burst on Germany (443,014) |
| France, seed 7127 | decided day 67 (Italy, near Rome) | day 62 stopped short, day 63 burst on Germany (Berlin, 1,003,000); Germany sues for peace on day 66 |

(`tests/unit/nukePoland1938.test.ts`, `tests/unit/nukeOverrun1938.test.ts`;
`.cache/r718i/probe/france.ts`.) With the chance through weighing the costs too, the strikes fall on
the Germans who are overrunning them, which 7.18j's theatre floor needs (its AT:
`nukePoland1938` and `nukeOverrun1938` green with their strikes on the Germans).

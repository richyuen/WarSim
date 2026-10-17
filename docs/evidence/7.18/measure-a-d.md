# PLAN 7.18: AI nuclear use (measures, parts a–d)

Critic R8-B1 (run 8 on `fd27e85`): 8 of 17 unaided 30-year worlds see a burst, 3 before year 20; France
and Poland given 10 warheads in the editor and overrun never strike; a point struck again days after, a
small third party for a thousand dead.

## The critic's France (`tools/diag/nukeCase.ts 7127 FRA GER 10 150`)

Before: the best place's utility −0.30 at its most desperate (days 65–70: extreme, in reach, no
retaliation, no MAD), its gain 0.25 against its costs 0.55 (alliance 0.15, outrage 0.10, taboo 0.6 × 0.5).
Its targets: the German armies before Paris, 7,000 to 18,000 men in a blast, each counted against the
whole enemy side's 1.55 million (Japan's and Manchukuo's armies among them), about 1 %, × 0.32 for the
bomber's chance through German air: 0.02 to 0.05. On day 75 Paris fell, the capital moved, no German was
near the new one, and France was no longer in extreme desperation. From day 80 it held no airbase: no
bomber, and none could be ordered.

After a (a capital taken in the war is extreme), c (men against the side's within FRONT_KM of the place)
and d: France strikes on day 68–69, with its last bomber (`nukeOverrun1938.test.ts`); after the fall it
stays extreme (utility −0.09 to −0.23 with no means to deliver).

## Nuclear powers' days by gate (`tools/diag/nukeGates.ts`, seeds 1–5 × 30 years)

Before (`b18ec62`, the rules of 7.17):

| Seed | Decisions (years) | Days losing, best below 0 | Days extreme, below 0 / striking | No enemy that threatens it (all days) |
|---|---|---|---|---|
| 1 | 14 (14, 15) | 5619 | 6 / 8 | 21663 |
| 2 | 0 (—) | 131 | 0 / 0 | 17877 |
| 3 | 0 (—) | 1864 | 43 / 0 | 7530 |
| 4 | 0 (—) | 1246 | 0 / 0 | 25292 |
| 5 | 6 (30) | 356 | 33 / 1 | 14661 |

20 decisions in 2 of 5 seeds.

After a, c, d:

| Seed | Decisions (years) | Days losing, best below 0 | Days extreme, below 0 / striking | No enemy that threatens it (all days) |
|---|---|---|---|---|
| 1 | 29 (14, 15, 16) | 5126 | 6 / 5 | 20631 |
| 2 | 0 (—) | 131 | 0 / 0 | 17877 |
| 3 | 0 (—) | 1915 | 360 / 0 | 7530 |
| 4 | 0 (—) | 1246 | 0 / 0 | 25292 |
| 5 | 14 (27, 28) | 281 | 7 / 2 | 14804 |

43 decisions in 2 of 5 seeds.

Where none strike (seeds 2–4): the losing holders are losing far wars to nations that cannot threaten
them (seed 4: France, Britain, the Netherlands and Switzerland against Romania, Siam and Burma; no aim),
or are deterred by an enemy's second strike (seed 3: Britain against the Soviet Union, the retaliation
risk 0.8 of its utility's costs). Bursts in most seeds would take a cause of use that is not a war for
one's life, a winning power ending a long war against a foe that cannot answer: the next part of 7.18.

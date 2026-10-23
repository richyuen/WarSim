# PLAN 7.92: the far army of the enemy side, measured

Probe: `tools/diag/nukeTheatre.ts <seed> 120`, `nukePoland1938.test.ts`'s set-up as the test makes it
(a strategic bomber group at Warsaw, 10 warheads, Germany's war on Poland). Each day to the first
burst: Poland's three best places in reach by utility over the strike floor; each place's parts
(`placeParts`); the enemy side's men in its blast by nation; for each such nation the nearest land
formation at war with it (whose, how far, and whether of Poland's side in this war), and its other wars.

Runs: HEAD `46b39276` (`head_<seed>.log`) and HEAD with `docs/evidence/7.91/patch` applied
(`rule_<seed>.log`), seeds 5591, 7127 and 3929. `days.txt` is every day in one line a place:
`<controller><u over floor> v<value> m<menShare> e<econShare> th<theatre men> [<nation><men>><faces><km>]`.

## The table

| run | seed | days weighed | best ITA | best GER | first decision | burst on |
|---|---|---|---|---|---|---|
| HEAD | 5591 | 24 | 15 | 9 | day 24, the German city (1100.2, 267.4) | GER, 343,924 dead |
| HEAD | 7127 | 28 | 14 | 14 | day 28, the same city | GER, 334,383 |
| HEAD | 3929 | 28 | 13 | 15 | day 28, the same city | GER, 334,409 |
| 7.91 | 5591 | 22 | 13 | 9 | day 22, Italian ground (1063.1, 316.1) | ITA, 64,445 |
| 7.91 | 7127 | 28 | 14 | 14 | day 28, the German city | GER, 334,384 |
| 7.91 | 3929 | 28 | 11 | 17 | day 28, the German city | GER, 334,409 |

## What it shows

1. **The Italian army is on a front of this war, not a third party's.** Every Italian mass among the
   best places (100,000 to 232,000 men in a blast) faces France, 25–90 km off, and France is on
   Poland's side of Germany's war on it (`facesOwnSide: true`). On 5591 Italy has no other war; on 7127
   and 3929 it is also at war with Yugoslavia, Czechoslovakia and Romania, and a few lighter Italian
   places (25,000–37,000 men) face Yugoslavia 210–355 km off, never the best. PLAN 7.91's "Italy's war
   on France" was this war.
2. **It is not a light theatre.** ADR-492's case (PLAN 7.18h) was an Italian army near Rome in a
   theatre of 92,000–106,000 men, 6 % of the side: the floor was for that. Here every candidate's
   theatre is 0.97–1.36 million men (the German army in Poland is within FRONT_KM of the Alps), about half
   of the side. THEATRE_FLOOR does not bind because the theatre is heavy, as the rule means.
3. **There is no massed army overrunning Poland to prefer.** The German places in reach that hold men
   facing Poland hold 12,000 to 72,000 (at most 0.04 of the theatre); the German army in Poland stands
   spread. The German place that wins on HEAD on every seed is a city by its output: econShare
   0.051–0.055, menShare 0.0004 (about 10,000 men), 334,000 dead. A rule preferring "the army
   overrunning the striker" would on these seeds send the bomb to that city, not to an army.
4. **"On Germany" held by history, not by a rule.** 5591 on HEAD: day 22 the Italian army at 0.000
   over the floor and the city at −0.029; day 23 the city −0.024 against the Italians −0.030; the
   decision on day 24 fell on the city. Over the 24 to 28 days weighed the best place is Italian on
   13 to 15 of them on either rule. 7.91's deploy rule moves 5591's history by a day and the decision
   falls on an Italian day.

By the rules as written (`nukeTargets`, PLAN 6.11a: where enemy men are most massed, within FRONT_KM
of the striker's side, its allies' formations among them; `partsIn`: men a share of the theatre's)
the Italian army before France is a fair target: the side's densest army, on a front of this war, in
a heavy theatre. The AT's other branch (a rule, with a unit test of a dense army elsewhere against
the army overrunning the striker) has no case on these seeds: the overrunning army is never massed.

So the choice goes to the user (ADR-651); the test stands as it is; no rule; the pin unchanged.

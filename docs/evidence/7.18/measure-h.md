# PLAN 7.18h: what a strike to end a war falls on (measure)

`tools/diag/nukeResolve.ts <seed> 30`, seeds 1–10: every strike decided, the war whose side
remembers it (`War.lastStrike`), whether the resolve to end a long war drove it (the side not in
extreme desperation and its own desperation under its resolve, with the 90 days' gap), the place's
parts (`placeParts`: the enemy side's output and men in the blast, the men of the theatre within
FRONT_KM, the capital's bonus, the chance through), the nation whose land it is and its share of
the enemy side's output, and the burst's toll. The parts are read at the end of the decision's
day (the decision at its start): `u` and the resolve are the decision's, the parts approximate.

## Before (`790100e`, the rules of 7.18e)

| Seed | Decisions | By the resolve | Tolls under 5,000 | Resolve strikes on nations under 10 % | Most resolve strikes in one war |
|---|---|---|---|---|---|
| 1 | 41 | 14 | 12 | 4 | 10 |
| 2 | 4 | 4 | 0 | 1 | 4 |
| 3 | 1 | 1 | 0 | 0 | 1 |
| 4 | 7 | 7 | 3 | 0 | 4 |
| 5 | 4 | 4 | 0 | 0 | 4 |
| 6 | 0 | 0 | 0 | 0 | 0 |
| 7 | 7 | 6 | 0 | 0 | 3 |
| 8 | 7 | 4 | 0 | 0 | 2 |
| 9 | 0 | 0 | 0 | 0 | 0 |
| 10 | 11 | 6 | 1 | 2 | 3 |
| all | 82 | 46 | 16 | 7 | |

Seeds with a burst: 8 of 10; with one before year 20: 7. ("In one war" here: the striker against
the enemy side's leader, as the baseline's records have no war id; seed 5's four are the United
States' in four wars on Britain years apart. The diagnostic records the war's id since.)

- **The resolve's strikes on light nations:** seed 1's Italy on #114 (0.4 % of the side's output,
  64,391 dead), Mengjiang (2.1 %, 121,183), Mongolia (0 %, 18,705); seed 2's Netherlands on
  Manchukuo (0.5 %, 140,600); seed 10's Britain on Greece (0.5 to 0.6 %, 24,820 and 24,600).
- **Many in one war:** seed 1's Italy ten times in 2.5 years, one each 90 days, on the Soviet
  Union, China, Mengjiang, Mongolia, Nepal and #114.
- **Tolls under 5,000:** at places in theatres of 74 to 5,229 men, each a lone garrison weighed as
  the whole of its theatre (7.18c): seed 4's Britain and Switzerland on Japanese garrisons of 2,264
  to 5,229 men (939 to 2,305 dead); seed 1's Britain on #114's garrisons of 456 to 1,380 (168 to
  2,875 dead) and China's of 74 to 126 (8 to 1,044), at desperation 1 and more, not the resolve.
- **Nepal (seed 1, Italy, 17,443 dead):** 22 % of the side's output, a theatre of 11,355 men: a
  nation of weight, a poor theatre. The theatre's floor.

## The floor tried, and left to 7.18j

A place's men as a share of at least 0.25 of the enemy side's men (`sideMen`): the critic's Poland
(seed 5591) and France (seed 7127) then strike nothing (`nukePoland1938`, `nukeOverrun1938` red).
At `790100e` both struck an Italian army near Rome (`.cache/r718h/probeExact.ts`, the parts at the
decision's tick):

| Striker | Day | u | Owner | Theatre's men | Side's men | Men share | Through | Value |
|---|---|---|---|---|---|---|---|---|
| Poland (5591) | 64 | 0.432 | Italy | 106,230 | 1,721,254 | 0.100 | 0.60 | 0.600 |
| France (7127) | 67 | 0.105 | Italy | 92,322 | 1,629,893 | 0.147 | 0.60 | 0.600 |

An army, not a garrison, but 6 % of a side whose bulk is Germany's (and Japan's, Manchukuo's and
Mengjiang's far off). The German masses at Warsaw (450,000 to 820,000 men in the theatre) are worth
0.03 to 0.10 under German air superiority (the chance through 0.2): any floor that takes Rome away
leaves Poland nothing above 0, which is 7.18i's cause (the costs weighed whole, the gain × the
chance through). PLAN 7.18j: the floor, after 7.18i.

## After (`b03f62d`: RESOLVE_STRIKES 3, ADR-489; RESOLVE_WEIGHT 0.1, ADR-490)

| Seed | Decisions | By the resolve | Tolls under 5,000 | Resolve strikes on nations under 10 % | Most resolve strikes in one war |
|---|---|---|---|---|---|
| 1 | 34 | 7 | 12 | 1 | 3 |
| 2 | 3 | 3 | 1 | 0 | 3 |
| 3 | 1 | 1 | 0 | 0 | 1 |
| 4 | 4 | 4 | 2 | 0 | 3 |
| 5 | 4 | 4 | 0 | 0 | 1 |
| 6 | 0 | 0 | 0 | 0 | 0 |
| 7 | 7 | 6 | 0 | 0 | 2 |
| 8 | 7 | 4 | 0 | 0 | 1 |
| 9 | 0 | 0 | 0 | 0 | 0 |
| 10 | 9 | 5 | 1 | 1 | 2 |
| all | 69 | 34 | 16 | 2 | |

Seeds with a burst: 8 of 10; with one before year 20: 7 (as before). In one war: by the war's id.

- **Many in one war:** at most 3 (10 before). Seed 1's Italy: China, Nepal, the Soviet Union
  (339,412 dead at its capital), then no more by its resolve.
- **Light nations:** the two left, Britain's on #114 (seed 1, day 4,937) and on Greece (seed 10, day
  4,688), are the same decisions as before the rules, in worlds the same up to them (the decision
  lists of `base_<seed>` and `after_<seed>` match to the day, place and utility up to them): at their
  decision the rule did not apply (the side in extreme desperation, or without the resolve, at that
  tick; the diagnostic reads at the day's end, at desperations 0.90 and 1.22).
- **Tolls under 5,000:** 16, as before: the lone garrisons, PLAN 7.18j (after 7.18i). Seed 1's
  Britain on Chinese garrisons of 126 men and fewer is at desperation 1.2, the desperate path.
- Intermediate files: `.cache/r718h/{base,after}_<seed>.json`.

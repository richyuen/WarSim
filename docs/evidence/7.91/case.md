# PLAN 7.91: blocks stacked on one enemy out of its view

Read on 2026-10-22 on `f7a029db` (pin 5161de24), with `docs/evidence/7.90/g.patch`'s source applied
(`git apply --include='src/*'`) and without. Probe: the day-60 world of `deploy.test.ts` (seed 99,
Germany declares war on Poland, 60 days), saved once and loaded, each formation in contact whose
block and its nearest enemy's do not share a view at 20 m/px, as the test measures it
(`tools/diag/deployView.ts`, and a scratch copy printing `deployOf`'s file, side and shift).

## The cause

A block coming up to an enemy's block (its nearest enemy faces a nearer formation) stands a line
behind those nearer that enemy, two lines a file (ADR-202), then a file abreast, right and left by
turns, a block's width and the gap out, up to `DEPLOY_ABREAST` (1 cell, ADR-133). The lines before it
were all the formations nearer that enemy that go to it, from whatever side: ADR-133's "not done"
("formations that come to one enemy from several sides count their lines together, so a stack begins
its files sooner than it need").

With g.patch, 22 Chinese divisions go to Japan's 393 (its block faces 477). Six from the south-west
(1696.46, 387.5), nearer it, took files 0 to 5; the ten from the south-east (1698.56, 387.56) were
counted after them and took files 5 to 10, 0.69 to 1 cell to the side of their line, which runs
west-north-west, so the side is north–south, across the view's short axis (0.82 cells):

| block | file before | side before | dy to 393's block | file after | side after |
|---|---|---|---|---|---|
| 416 | 10 | −1.00 | 1.35 | 6 | −0.69 |
| 427 | 8 | −0.92 | 1.17 | 4 | −0.46 |
| 436 | 6 | −0.69 | 0.93 | in view | |
| 489 | 8 | −0.92 | 1.22 | 4 | −0.46 |

Seven more on Japan's 366 (18 Chinese divisions from four cells) the same way. The fails on the
saved world: 11 of 97 → 6 of 97 (share 0.887 → 0.938); those left are of the stacks' far files, held
back by the blocks of the other side in their way (ADR-201).

## The rule (ADR-650), held in `patch`

`deployOf` counts a block's lines and files with those nearer the enemy that come from within 60° of
its own bearing from the enemy's block; the one that enemy faces stays in the count where it did
(ADR-89's 60°). Blocks of another side in its way still stop it (ADR-201).

| `deploy.test.ts` day 60 | in contact | sharing a view | share |
|---|---|---|---|
| HEAD | 70 | 69 | 0.986 |
| HEAD + rule | 99 | 96 | 0.970 |
| g.patch | 97 | 86 | 0.887 |
| g.patch + rule | 75 | 72 | 0.960 |

Every test of `deploy*.test.ts` green both ways (21 of 21 with the rule on HEAD; 9 of 9 of
`deploy.test.ts` with g.patch). The new test, "a stack that comes to an enemy from another side than
a nearer one counts its own files", is red without the rule (the last of the four 0.87 cells to the
side, against 0.72) and green with it. Pin 5161de24 → 41d60509 (the blocks are read by the air AI's
patrols, `ai/air.ts`, and the fires' places, so the history moves).

## Why not committed: `nukePoland1938.test.ts`, seed 5591

The whole unit suite with the rule on HEAD: 1870 of 1871. Red: "seed 5591: given 10 warheads and a
strategic bomber group at Warsaw, it strikes in Germany's war on it before its bomber is gone", on its
last assertion, the first burst on Germany (PLAN 7.18j's AT). `tools/diag/nukePoland5591.ts` (the
test's set-up), `nukePoland_5591_head.log` and `nukePoland_5591_rule.log`:

| | decided | at | utility | burst on | dead | of them men |
|---|---|---|---|---|---|---|
| HEAD | day 23 | (1100.2, 267.4), a German city | 0.081 | Germany | 343,924 | 9,924 |
| rule | day 21 | (1063.1, 316.1), Italian ground | 0.027 | Italy | 64,445 | 64,445 |

Within 3 cells of the Italian place: 226,237 Italian men and 4,373 French, the Alps front of Italy's
war on France, about 1,000 km from Warsaw. Every gate passes as written. `nukeCase.ts 5591 POL GER 10
26 bomber` on both rules (`nukeCase_5591_head.log`, `…_rule.log`; the probe's set-up gives a slightly
other history than the test's): on HEAD too the Italian army is Poland's best place on days 12–21
(u −0.101 to −0.045), the German city on days 6–11; HEAD's decision on day 25 fell on the city at a men
share of 0.0099. The test's "on Germany" was on a knife's edge: which place is best on the day the
decision comes.

The cause is the weighing's, not the deploy's: a place's men are weighed against its theatre, the
enemy side's men within FRONT_KM (1,000 km) of the place (PLAN 7.18c), and here that theatre takes in
the German army in Poland (1.08 million), so THEATRE_FLOOR (0.25 of the side, ADR-492) never binds: an
army on another front of the side, beyond the reach of the war on the striker, earns as much a man as
the army overrunning it, and one with none of the striker's own men about it more. ADR-492's case was
the same Italian army near Rome on this seed. PLAN 7.92 has it; 7.86 (AI nuclear use, the critic's
design objection) is the same area.

## Held

`patch` (`git apply docs/evidence/7.91/patch` on `f7a029db`'s tree): `src/sim/systems/elements.ts`,
`tests/unit/deploy.test.ts`, `tests/sweep/baselineHash.test.ts` (41d60509), ADR-650 in
`DECISIONS.md`, the SPEC clause. Both held pins are stale by construction: 41d60509 is HEAD's history
with this rule alone, f9344f0e (g.patch) was 5161de24's. Whichever lands after PLAN 7.92 re-reads its
pin, and `deploy.test.ts`'s day-60 share is read again on that history.

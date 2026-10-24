# PLAN 7.106 — the statelets that live (emergent 6)

Seeds 911–920 (unseen; PLAN 7.107 starts at 921), 1938, 30 years. Figures:

- **Founded nations alive** at year 30: living nations with `origin ≠ 0` (a revolt's, a collapse's,
  God Mode's, or one of those revived), as the critic's `founded`.
- **Land moved in the last five years:** the share of land cells whose **owner** (not controller) at
  year 30 is not the owner at year 25.

Tools: `tools/diag/foundedAt.ts` (the AT: births, deaths, causes; saves at years 10, 20, 25, 30),
`foundedFrom.ts` (the A/B from one save), `movedBy.ts` (moved land touching founded nations),
`rebelPeace.ts` (how founded nations' wars end), `revoltWhy.ts` (under what a founding revolt rose).

## HEAD (5770d532)

| seed | founded alive | of living | founded ever | moved, last 5 years |
|---|---|---|---|---|
| 911 | 54 | 119 | 119 | 16.0 % |
| 912 | 26 | 91 | 87 | 27.6 % |
| 913 | 34 | 103 | 117 | 28.5 % |
| 914 | 41 | 107 | 165 | 20.3 % |
| 915 | 50 | 109 | 156 | 30.8 % |
| 916 | 43 | 106 | 120 | 16.2 % |
| 917 | 35 | 96 | 116 | 28.9 % |
| 918 | 46 | 119 | 94 | 17.1 % |
| 919 | 24 | 88 | 97 | 16.6 % |
| 920 | 73 | 135 | 195 | 22.4 % |
| **mean** | **42.6** | 107.3 | 126.6 | **22.4 %** |

## What founds the statelets that live

- **All by revolt.** Every founded nation alive at year 30 on the ten seeds was founded by a revolt
  (no collapse, revival or God Mode among them). Of those founded, 840 died (433 annexed, 407 eliminated),
  median life 2.0 years; the living ones' median age is 6.5 years, median 228 cells.
- **Under what they rose** (`revoltWhy.ts`, saves of 911–915 at year 20, two years, 82 founding revolts):
  69 on land not the holder's core while the holder was at war elsewhere; 7 on the holder's own core.
  None with the holder bankrupt.
- **Whose land** (the area's people, its core nation before the revolt): 32 of a dead nation of the start
  in its revival cooldown (22 of them live on, free or a puppet); 22 of a dead founded nation with no
  revival left (10 live); 19 of a living people (all died); 7 the holder's own (all live).
- **Moved land that touches founded nations** (`movedBy.ts`, years 25–30): 6–29 % of the land moved
  (911 29 %, 912 6 %, 913 11 %, 914 10 %, 915 15 %).

## Why they last

- **Their wars** (`rebelPeace.ts`, founding wars only, 911–915 years 20–22): 31 won, 9 white peace, 17
  lost. The wins are a score tripwire: the rebels' militia walk into as much of the holder's empty land
  as they own (held ≈ 0.9 × own) and the score, relative to the smaller party (REL_CAP), reads −90 for
  the holder in 3–30 days at an exhaustion of 1–3; the holder sues as crushed. The holder's nearest army is far.
- **After:** at year 30, 204 of the 426 founded nations alive have a living people (`nations.people`),
  most beside it, at war with it in 20; 78 are of a dead nation of the start whose cooldown is over.

## Rule 1, tried and dropped: the holder does not sue on the score alone (`suit.patch`)

Against its own rising (`War.rising`), a holder not worn (exhaustion ≤ PEACE_ACCEPT_EXHAUSTION) does not
sue as crushed. A/B from the year-25 saves of 911–915, 5 years: founded alive 209 against HEAD's 205,
moved up 1–5 points. The suit only came later: the holder's army never came, exhaustion grew 0.1 a day,
and the rebels won more walk-in land. Not committed; the code restored (`risingSuit.test.ts.txt`).

## Rule 2: statelets of one people come together again (ADR-681)

At a month's start a founded nation, free, whose people (or the people of its dead founded people) is
another living nation, free, that its land borders, with no war and no truce between them, joins that
nation (`kinUnion`, `annexNation`). Not one risen on its people's own land against it, nor one God
Mode set down (`world.unionBarred`). A/B from the year-25 saves of 911–915, 5 years: founded alive
205 → 172 (0.84), moved 24.6 → 25.1 % (1.02).

## The AT (911–920 × 30 years, `foundedAt.ts`, rule 2 against HEAD)

| seed | founded alive, HEAD | rule | moved, HEAD | rule |
|---|---|---|---|---|
| 911 | 54 | 37 | 16.0 % | 26.1 % |
| 912 | 26 | 11 | 27.6 % | 27.3 % |
| 913 | 34 | 22 | 28.5 % | 27.8 % |
| 914 | 41 | 34 | 20.3 % | 28.2 % |
| 915 | 50 | 53 | 30.8 % | 31.0 % |
| 916 | 43 | 23 | 16.2 % | 13.6 % |
| 917 | 35 | 28 | 28.9 % | 29.9 % |
| 918 | 46 | 31 | 17.1 % | 23.1 % |
| 919 | 24 | 21 | 16.6 % | 21.2 % |
| 920 | 73 | 22 | 22.4 % | 22.9 % |
| **mean** | **42.6** | **28.2** (0.662; bar 0.75) | **22.4 %** | **25.1 %** (1.118; bar 0.9) |

Met. Founded nations ever 126.6 → 119.1 a world; annexations 54.9 → 66.2 (the unions among them).

# PLAN 7.133: an empty sky late, measured on HEAD

2026-10-26, HEAD `b3ccee95` (pin unchanged). The AT: on 10 unseen seeds × 20 years against HEAD, mean sorties aloft a
world-hour in years 2–20 at least 1.5 × HEAD's, year 1 not below 0.9 ×. ADR-707 (option a, the user's decision of
today) ruled out a rule for reach: no ferry over the sea, no war choice weighing the air force's reach. This read
asks what else could give the idle wings a mission that meets the enemy (ADR-520: not flying for the count).

Tools: `airWhy.ts` (PLAN 7.108b; new columns: bombers' industry in range by its air zone, nations at war with no
wing, the carriers' wings at war), new `airNoWings.ts` (the nations at war with no wing, by the first gate of the
economic AI's wing order). From the critic's run-15 year-20 saves of 6421 (its named case), 1129 and 4877, 60 days.

## 1. The wings at war, a day (`airWhy.ts`)

| | 6421 | 1129 | 4877 |
|---|---|---|---|
| sorties aloft an hour | 8.1 | 16.1 | 7.0 |
| fighters: with a mission / idle | 3.2 / 6.9 | 2.0 / 22.1 | 1.1 / 43.9 |
| close support, tactical: with a mission / idle | 5.0 / 11.0 | 10.5 / 14.1 | 4.9 / 43.1 |
| idle fighters and strikers, a base of the side in range of the enemy past a ferry flight (`baseFar`) | 17.5 | 29.7 | 49.5 |
| of them, no chain of ferry flights over the side's bases to it (sampled) | 99 % | 100 % | 100 % |
| idle, no base of the side in range at all (`beyondBases`) | 0 | 6.3 | 37.5 |
| idle, a base in range within a ferry flight (`baseInFerry`) | 0.4 | 0.1 | 0.0 |
| strategic bombers idle, enemy industry in range | 3.0 | 2.0 | 3.6 |
| of them, the zone flown in and not held | 3.0 | 0 | 1.1 |
| of them, the zone flown in by nobody | 0 | 2.0 | 2.5 |
| carriers' wings at war | 0 | 0 | 0 |
| AI nations at war / of them with no wing | 64.1 / 51.1 | 56.4 / 45.4 | 73.0 / 47.0 |

The idle fighters and strikers are the reach of ADR-707: the enemy is over the sea from every chain of their side's
airbases (the sea hop's goal 16,000–57,000 km summed a day, 1–9 cases). Nothing short of moving them over the sea
gives them a target.

## 2. The nations at war with no wing (`airNoWings.ts`, every 10th day, means a read)

| | 6421 | 1129 | 4877 |
|---|---|---|---|
| AI nations at war | 64.0 | 55.7 | 72.8 |
| with wings (wings) | 17.0 (38) | 12.5 (64) | 31.0 (112) |
| no wing, poor (income under POOR_INCOME; mean income) | 32.0 (6.6) | 24.2 (4.1) | 28.8 (6.2) |
| no wing, no airbase of its own | 10.0 | 3.3 | 6.0 |
| no wing, could order one | 5.0 | 15.7 | 7.0 |
| of those, an enemy land formation within 600 km of one of its airbases | 1.3 | 4.7 | 0.8 |

Most belligerents with no air force are fragments with an income of 4–7 gold a month; an air force there would not
be a nation's choice. The ones that could build and have an enemy near are 1–5 a world.

## 3. Reading

What a rule outside reach could add late, at most, if every such wing flew all day: the bombers of unflown zones
(~1.5 wings a day) and a wing for each nation that could build one with an enemy near (~2.3 a day): about 4 wings
against 8–16 sorties aloft an hour, some +25–45 % on these saves before losses and the time to build — under the
AT's 1.5 ×. Unescorted bombing over contested zones (6421's 3 a day) would meet fighters the gate is there to avoid
(PLAN 5.3c). The 1.5 × is in the reach ADR-707 closed.

## 4. The carriers (`carriers.ts`)

| | start | year 10 | year 20 |
|---|---|---|---|
| 6421 | 18 (ENG, USA, JAP 6 each) | 12 | 0 |
| 1129 | 18 | 6 | 0 |
| 4877 | 18 | 4 | 0 |

No carrier group in training on any save: the AI's fleet mix has none (PLAN 7.137).

## 5. The decision

The user's (ADR-723): build the sea ferry (ADR-707's option b). HEAD's arm of the AT on 1171–1180 × 20 (`airWar.ts`)
is in `.cache/7133/head` (five at a time, ~1 h):

| seed | 1171 | 1172 | 1173 | 1174 | 1175 | 1176 | 1177 | 1178 | 1179 | 1180 | mean |
|---|---|---|---|---|---|---|---|---|---|---|---|
| year 1 aloft | 46.4 | 59.0 | 54.4 | 57.3 | 44.7 | 59.7 | 58.5 | 56.8 | 48.8 | 58.4 | **54.40** |
| years 2–20 aloft | 16.21 | 15.97 | 16.47 | 13.31 | 18.31 | 15.61 | 12.91 | 20.32 | 16.65 | 13.90 | **15.97** |

The bars: years 2–20 at least **23.96**, year 1 at least **48.96**.

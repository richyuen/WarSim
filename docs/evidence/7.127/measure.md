# PLAN 7.127: the critic's Poland, a first burst off Germany on fewer than 50,000 men (ADR-715)

HEAD `d2a3e223`. Tools: `tools/diag/nukePolandGates.ts <seed> 120 summary` (each seed's first burst),
`tools/diag/nukeDecisionHour.ts <seed> <day> [enemy]` (new: the decision hour by hour),
`tools/diag/nukeVolume.ts <seed> 20` (bursts in an ordinary world). The rule tried is
`change.patch` (THEATRE_FLOOR 0.25 → 0.5, its unit case, SPEC); not committed.

## 1. The four seeds (4001–4020, `gates.txt`)

HEAD: the first burst off Germany on fewer than 50,000 men killed on 4 of 20 (4009, 4010, 4012 on
Italy, 17,279–20,921 men; 4016 on the Soviet Union, 16,998); bursts before the bomber is gone 15 of 20.

The decision hour (`nukeDecisionHour.ts`), the place decided against the best place on Germany:

| seed | place decided | men in blast | killed | theatre / side | through | Poland's side nearest | best on Germany |
|---|---|---|---|---|---|---|---|
| 4009 (day 102) | Italy, south of Rome | 37,380 ITA | 17,594 | 355,323 / 1,426,076 (the floor) | 0.6 | Tunisia, 776 km | 76,264 GER + 90,907 ITA, theatre 894,908, through 0.2, u 0.119 vs 0.205 |
| 4012 (day 86) | the same | 37,380 ITA | 17,594 | 402,308 / 1,613,821 (the floor) | 0.6 | France, 865 km | 24,242 GER + 31,328 ITA, through 0.874, u 0.045 vs 0.135 |
| 4010 (day 48) | Sicily | 24,238 ITA | 20,721 | 441,677 / 1,775,451 (the floor) | 0.6 | France (Tunisia), 84 km | Berlin, through 0.2, u 0.020 vs 0.097 |
| 4016 (day 52) | by a Soviet city, in Poland's **Soviet** war | 37,800 SOV | 17,125 | 682,738 / 1,587,816 (its own) | 0.2 | Poland, 911 km | none above the floor (u −0.066 best) |

Two causes:
- 4009, 4010, 4012: an Italian army in a light theatre, weighed against the floor (a quarter of the
  side), at through 0.6, counts twice the same men on the Polish front (theatre 55–75 % of the side)
  at through 0.2. In 4009 and 4012 it faces none of Poland's side within 776 km; in 4010 it faces
  French Tunisia, ADR-651's "army before an ally".
- 4016: a strike in another war (the Soviet Union's on Poland), on a theatre of its own men, at
  through 0.2. No theatre floor reaches it; the AT counts it because it reads the first burst in
  any war.

## 2. The rule tried: THEATRE_FLOOR 0.5 (`change.patch`)

On 4001–4020: 4009 on Germany 60,768 men, 4010 Berlin 452, 4012 Germany 25,399; 4016 unchanged (on
the Soviet Union, 16,998). Such bursts 4 → 1 of 20 (bar 0: missed); bursts 15 → 15 (bar 15: met);
4007 no longer decides (it burst on neither). Nuclear unit tests (54 files, 164 tests): green. Its unit
case (`nukeTheatre1938.test.ts`: the 37,380 Italian men south of Rome, the rest of the side at
Warsaw) red without (weighed against 389,166), green with (778,333).

In ordinary worlds (1101–1110 × 20 years, `nukeVolume.ts`, HEAD against the rule; the histories
part after the first burst, so seed by seed this is noisy):

| | bursts | decided | strikes back | civilians over 10 × men |
|---|---|---|---|---|
| HEAD | 74 | 79 | 21 | 3 |
| floor 0.5 | 60 | 64 | 13 | 10 |

The bursts of over ten times more civilians than men (the critic's measure):
- HEAD: 1110 y16.7 154,135 dead / 135 men; y18.7 159,135 / 11,135; y19.4 599,503 / 13,503.
- 0.5: 1102 y17.5 81,336 / 5,336; 1103 y19.3 373,039 / 11,039; y19.6 654,619 / 3,619; 1105 y19.6
  88,889 / 6,889; y19.8 270,083 / 83; 1110 y16.4 961,119 / 2,119; y17.2 159,750 / 5,750; y19.6
  121,000 / 0; y19.7 2,871,528 / 5,528; y19.9 964,276 / 7,276.

The mechanism, not only noise: a place's value is TARGET_SCALE × (econ share + men share), and the
floor halves the men share in every floor-bound theatre while the output share keeps its own
denominator, so cities gain on armies wherever the side's armies stand apart.

## 3. A narrower rule (ADR-651 b, not built)

Men facing none of the striker's side (no land formation of it within some distance) weighed down:
on the decision hours that reaches 4009 (776 km) and 4012 (865 km), not 4010 (84 km) nor 4016 (another
war): 2 of 20 at best. It lowers armies against cities too, so it would need the A/B of §2 before it
could be judged.

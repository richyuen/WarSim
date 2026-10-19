# PLAN 7.35b: why Japan's and the United States' fleets do not meet (critic R9, naval 6), measured

2026-10-19, code of `7405df0`. Tool: `tools/diag/seaMeet.ts` (from 1938, `A` declares war on `D`
at once as the critic's script did; every day at 01:00, an hour after the naval AI acts, each
armed fleet of the two sides: its nearest port, under way to where, and what `plan` in
`src/sim/ai/naval.ts` sees from there: at a port its bloc holds, the enemy ports within
`SORTIE_KM` and the win test `enemyIn(zone) ≤ together`; away from one, the `AVOID_RATIO` test).
`npx tsx tools/diag/seaMeet.ts 3407 JAP USA 12` (and `60`). The diag does not model `STAGGER`
(each nation's AI acts on one day of `STAGGER`), so a row's "home" may wait a few days.

The critic's case (`critic/c9_n_3407_JAP_USA.json`): Japan declares on the United States on day
0 of seed 3407; 32 six-hour samples, no sea battle of either.

## 1. Where each side's fleets stand and why

| | power | where | what `plan` sees |
|---|---|---|---|
| US Pacific Fleet | 45,700 + 3,500 | San Diego, Oceanside | nearest Japanese port 8,650 km (Yuzhno-Sakhalinsk): **none within 2,500 km**; stands in port |
| US Hawaiian squadron | 5,200 | Pearl Harbor | nearest Japanese port 5,926 km (Kushiro): none within 2,500 km; stands |
| US Atlantic Fleet | 20,100 + 1,200 | Norfolk, New York | nearest enemy port Bremen 6,800 km: none; stands (until Germany lands at Boston, day 37) |
| US Asiatic squadron | 4,000 | Cavite (Philippines) | Takao (Formosa) 907 km, its zone's enemy 2,800 ≤ 4,000: sails day 2 |
| Japan's fleets | 53,300 | Yokosuka, Kure, Sasebo, Maizuru, Ryojun, Takao | at war with China since the start: the nearest enemy ports are China's (Ningbo, Rizhao, Quanzhou, enemy 0); Yokosuka's battle group takes Guam (day 6), then Palau → Davao (days 9 to 20) |

No port of the United States or the Philippines stands between Hawaii and Guam in the data (no
Midway, no Wake): the hops are San Diego → Pearl Harbor 4,230 km, Pearl Harbor → Guam 6,152 km,
Guam → Cavite 2,567 km. Each is beyond `SORTIE_KM`, so a fleet that sorties only to an enemy port
within it never leaves the American coast: 51,000 of the US Navy's power stands at San Diego and
Pearl Harbor for all 60 days measured, while Guam (day 6), Davao and General Santos fall to Japan
unopposed.

## 2. The one sortie: the Asiatic squadron, sunk from the air

The cruiser squadron 1126 and destroyer flotilla 1127 leave Cavite on day 2 for Takao, Japan's
nearest port, whose zone's enemy power (2,800) they outweigh together (4,000). Japan's only ship
there, cruiser squadron 1156, has left on day 2 for Quanzhou (China), 279 km away (the least gap
between the two sides' fleets in 60 days, day 5). The squadron arrives at Takao at hours 78 and
82 and stands off it with no enemy ship in reach (away from its ports, the zone's enemy 2,800 is
not over 1.5 × its power: it stays). Japan's wings 1375 and 1376 on Formosa strike it at hours
100, 108, 116 and 124; both fleets are gone at hour 124 (`FormationDestroyed`, `StrikeHit` from
the same wings). No sea battle: no surface fleet of Japan's was in reach.

The test that sent it counts only the enemy's ships in the target's zone (`navalPower`), not the
land-based air over it. A second cause, kept apart from the first (PLAN 7.35b3).

## 3. After 60 days

One battle between the two sides in 60 days: the US Atlantic Fleet against Italy's ships off
Providence on day 53, after Germany's landing at Boston. In the Pacific, none. The least gap between
a Japanese and an American fleet over the 60 days is 279 km (day 5).

## 4. What follows

- **7.35b2, the rule:** a warfleet at war with no enemy port within `SORTIE_KM` and no landing to
  escort has no move at all (`plan` takes no target), however far its war is. It should stage:
  sail to the port of its bloc nearest an enemy port, when that port has an enemy port within
  `SORTIE_KM` and is nearer one than the fleet is; the sortie test then runs from there.
- **7.35b3:** a sortie's test of the target zone counts no land-based air (the Asiatic squadron's
  loss); measured, and a rule or a reason.

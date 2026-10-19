# PLAN 7.35b4: where the US fleets go on seed 3407 after 7.35b2 and 7.35b3b, measured

`npx tsx tools/diag/seaMeet.ts 3407 JAP USA 40` (Japan declares war on the US on day 0, as the
critic did; a row per fleet with power each day at 01:00). Since 7.35b4a the tool's `take` column
names a staging order (`stage <port> <km>`, from `forwardBases` itself, exported from
`src/sim/ai/naval.ts`), and a target that is empty water under the enemy's naval bombers is no
target (`plan`'s test since 7.35b3b), with its reason in `why`.

## 1. Before (7.35b4a, at `d602508` plus the tool)

- **The sides.** Japan, Manchukuo, Mengjiang, Germany, Italy, Albania against the US and the
  Philippines (`PHI`, of the US bloc: `blocOf`; its ports among them Cavite, Cebu and Laoag).
- **Day 1.** Every US warfleet with no Japanese port within `SORTIE_KM` stages to Guam (San Diego
  10,250 km, Pearl Harbor 6,160 km, Norfolk 14,210 km by Panama). The Asiatic squadron at Cavite
  takes Takao (926 km, enemy 2,800 ≤ 4,000). Italy's and Germany's fleets: no enemy port within
  2,500 km and no forward base, they stand.
- **Guam lost.** Japan's battle squadron stands at Guam on day 6. The fleets under way to it keep
  their order until they arrive; then `rebaseFleets` (`atLostBase`, ADR-261) sends each to its
  nation's nearest port, `nearestOwnPort`, which reads ports of the nation only: Pago Pago. US
  fleets' destinations by day: day 10, 22 to Guam; day 15, 15 to Guam and 7 to Pago Pago; day 20,
  15 to Pago Pago and 7 to Guam; day 30, 8 to General Santos, 7 at Cagayan de Oro, 6 to Pago Pago;
  day 39, 6 of the Atlantic Fleet off Suva to Cebu.
- **The Philippines' ports** (Cavite, Cebu, General Santos) are of the US bloc, about 2,000 km from
  Guam against Pago Pago's 4,300: the naval AI's home (`plan`'s `atOwnPort`) is a port of the bloc,
  the sail home (`sailHome`) is the nation's.
- **Battles.** One Japan–US sea battle in 40 days, day 39.5 at General Santos. Least gap between a
  Japanese and an American fleet: 279 km on day 5 (the Asiatic squadron off Takao).

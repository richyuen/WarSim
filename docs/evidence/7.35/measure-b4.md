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

## 2. After (7.35b4b, 7.35b4c1, 7.35b4c2)

The three rules: a fleet sent home sails for its bloc's nearest port, a transport group for its
nation's (ADR-545); a fleet stages only to a forward base in its own basin (ADR-546); a forward
base is one with an enemy port in reach that is not empty water under the enemy's naval bombers
(ADR-547). Same run, `seaMeet 3407 JAP USA 40`.

- **Day 1 to 10** as before: every US warfleet stages to Guam; Japan stands at Guam on day 6.
- **Guam lost.** The fleets arriving there sail for Davao (the Philippines', of the US bloc), not
  Pago Pago: US fleets' destinations by day: day 15, 15 to Guam and 5 to or at Davao; day 20, 7 to
  Guam and 7 to or at Davao, none to Pago Pago; day 39, 9 at Davao and 3 at Cagayan de Oro (12 US
  fleets with power left on day 39 of 24 on day 1, before 22; Japan's side 25 of 30).
- **Battles.** Ten Japan–US sea battles in 40 days (before one), the first on day 13.6 at Davao
  (before day 39.5), the rest on days 14.8 to 23.5, all off Davao. Least gap between the two
  sides' fleets 65 km (day 23; before 279 km).
- **Rows.** `seaRows 3407 JAP USA 40`: the ten Japan–US battles, 138 hours, 22 ships sunk; 0 hours
  with no row and 0 ships sunk with no row (every hour a carrier strike's row: no pair in a ship's
  reach in any of them).
- **A partner's lost base.** Davao is Japan's by day 30; on day 39 the 9 US fleets there stand at
  it. `atLostBase` reads a lost port as one the fleet's nation owns (ADR-264), and Davao is the
  Philippines': no rebase. A line under PLAN 7.35d.

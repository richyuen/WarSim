# PLAN 7.75 — supply over the beach on any land (ADR-630)

2026-10-22. The user's decision (ADR-622's scope b): a held coast cell the bloc's cities' network
does not reach is a beach source on any land, not only on a land where the bloc owns and controls
no city. Before: HEAD (`bb3aab03` for seed 99's year; `fd340e20`, with PLAN 7.76, for the 48 saves,
whose read on `bb3aab03` was the same in every column). After: the rule. Run side by side.

## The rule

`seaBeaches` (`src/sim/systems/seaSupply.ts`): the coast cells a bloc controls with no network's
mark, beside a zone not iced that its way from home reaches. `refreshBeaches`
(`src/sim/systems/supply.ts`), at each refresh hour after the network's refresh: the layer
`World.supplyBeach` made whole, each bloc in ascending order flooding from them over the cells it
controls that are in no network. A formation no network feeds is fed by it at BEACH_RATE to
BEACH_SUPPLY. The network is the cities' alone (from 7.70a to here the beaches were its sources).

## The test

`tests/unit/beachPocket1938.test.ts` (seed 7701, the AI off): a British division put ashore on an
enemy coast with no port within 4 cells, no formation within 8, and no cell of Britain's bloc within
8, on a land where the bloc holds a city (Eurasia, by India). 30 days: least 0.750, most 0.750 from
a day on; a British formation in the network on that land least 1.000. A full refresh gives the same
network and layer; a save loaded, the same hash and layer. The enemy holding the zones beside the
beach: dry for over 29 of the 30 days. Without the layer (`refreshBeaches` not called): least 0.000.
`beachSupply1938.test.ts` (7.70a's case, a land with no British city) holds as before.

## Seed 99's year (`npm run sim -- --scenario 1938 --seed 99 --years 1 --profile`)

Side by side, HEAD on 0x00FF and the rule on 0xFF00, then swapped:

| | HEAD | the rule |
| --- | --- | --- |
| supply, mean ms | 0.3096 / 0.2938 | 0.2343 / 0.2425 |
| tick mean ms | 2.7518 / 2.6596 | 2.6714 / 2.7172 |
| invasion AI longest call | 11.6 / 12.8 ms | 16.1 / 16.0 ms |
| cells flipped in the year | 38,160 | 27,311 |
| hash | 2c4e2593 | a4ff4661 |

Supply is cheaper: the network no longer floods whole a bloc with a beach at each change on its
land. The tick as a whole is within the pair's spread; the world goes otherwise.

## The critic's 48 saves, 180 days (`tools/diag/newFronts.ts`)

`before_*.json` (HEAD, a worktree), `after_*.json`, four batches of 12 each side (seeds 1129–5683 a,
5861–9781 b; `node docs/evidence/7.75/sum.mjs`). HEAD's read matches 7.73c's after in every column.

| | engaged per war-day | opened (fronted) of open | landings | far (held 30 d) | embarked in trips (2+) | in debt |
| --- | --- | --- | --- | --- | --- | --- |
| HEAD | 0.2400 | 103 (75, 24.4 %) of 308 | 672 | 326 (293) | 757 in 622 (93) | none |
| the rule | **0.2505** | 106 (80, 25.6 %) of 312 | 692 | 356 (321) | 788 in 631 (102) | none |

By batch: y10a 0.1177 → 0.1292, y10b 0.2930 → 0.3199, y20a 0.1828 → 0.1909, y20b 0.3597 → 0.3561.
The bars (PLAN 7.75): engaged per war-day not below 0.2383, met; fronted at least a fifth, met.

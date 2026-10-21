# PLAN 7.54a: the send passes over a refused march (ADR-594)

2026-10-21, on HEAD `b62c48f`. Tool: `tools/diag/sendTrace.ts` (the four cases of 7.49f §3, the
first day each nation's landing plan would send formations to its port, `planLanding`'s lists with
its `nearFront` filter, which 7.49f's probe left out). Out: `trace.json`.

## 1. Why each march is refused

| case | port | candidates | reach the port | refused by | other ports of its own on that land the army reaches |
| --- | --- | --- | --- | --- | --- |
| 4513 y10 Germany | Kotor | 8 | 0 | neutral ground (Hungary, Yugoslavia, Romania, ...) | 5 (Vigo, Le Havre, Brest, ...), no transports there |
| 7247 y10 Germany | Annaba | 145 | 0 | neutral ground (Nationalist Spain, French Morocco, France) | 39 (122–145 reach each), none with transports |
| 8693 y10 Germany | Annaba | 29 | 0 | neutral ground (the United States' Africa, Egypt, ...) | 20 (all 29 reach each), none with transports |
| 1129 y20 Britain | Warri | 7 | 1 (the fourth) | Turkey's ground (the nearest three) | 37 |

None is ADR-422's long way, none has no way at all (a free way exists for each). Kotor and Annaba
are German exclaves: `sailHome` brought the transports to the nearest port of their own after a
landing, and the army cannot walk there. The refused marches' cost (`ms`): 1–60 µs where the start
and the port are in two groups of the passage (`mayReach`, no search); Britain's 0.5 ms, searches.

## 2. The rule and its case

`sendToPort` passes over a refusal on the port's land (ADR-594). 1129 year 20 (`a/follow_1129.json`,
`FOLLOW=1`; `tools/diag/followFormation.ts` on id 920): Britain's fourth (Kuwait City) is sent on
day 2 and marches; its path is 317 steps, mostly desert (terrain 7), about 1.3 cells a day: some
240 days to Warri. On `islandArmies.ts` (`a/island_1129.json`) Britain stays on `send` all 60 days
with none boarded. The transports going to the army is 7.54b.

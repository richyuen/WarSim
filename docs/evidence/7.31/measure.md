# PLAN 7.31: phantom sea battles (critic R9-B1), measured

2026-10-19, code of `cea6bf8` (before; pin 94235073) and of the commit that adds this file
(after; pin c900e399, ADR-526). Tool: `tools/diag/seaPhantom.ts` (each `SeaBattle` row with the
fleets that broke off in its hour, each with its template, whether it has a weapon, the nearest
fleet at war with it, km and basin; rows by pair and place; battles that stood over a day).
Checkpoints: the critic's `critic/c9_seed2609_y20.bin` and `critic/c9_seed6113_y20.bin` (year 20,
uncommitted; made again by `npm run sim -- --scenario 1938 --seed <s> --years 20 --save <bin>`).

## 1. Why the battle forms, why the fleets do not close, why it re-forms daily

Before (old rule), seed 2609, 300 days from year 20: 291 rows, 285 with nothing sunk, all 285 of
one kind: a transport group (no weapon) broke off in the row's hour.

| place | rows | nothing sunk | the fleet that broke off | nearest enemy |
|---|---|---|---|---|
| Norway / UK, Oslofjord (1084.5, 215.5) | 143 | 142 | NOR `transport_group`, no weapon | British fleets 142–187 km, armed, same basin |
| Sweden / UK (1091.5, 227.5) | 142 | 142 | SWE `transport_group`, no weapon | 169–235 km |

Seed 6113, year 26 (`.cache/sp6113_y26.bin`, from the year-20 checkpoint), 365 days: 166 rows,
160 with nothing sunk, all 160 a transport that broke off; Mongolia / Japan at one point 157 of
them (the Japanese carrier groups' wings see 188 km; the squadrons sail past at 29–230 km).

The chain: an armed fleet sees the transport (its detection, a carrier's wings' 188 km) beyond its
reach; the battle forms; at the end of its first hour the transport breaks off by "no weapon
against an enemy that has one"; the closing starts in a battle's second hour (PLAN 7.19a), so no
enemy closes; the battle has one side left and ends with a row, 0 and 0; the transport, at its
port, sails for it, sits out BREAK_HOURS (24) and is seen again: a row every 24 ticks.

## 2. The fix, in three parts (ADR-526)

1. A fleet with no weapon breaks off once under fire (a volley or carrier strike on it that hour).
   With that alone (seed 6113, ten years): 722 → 49 rows, 18 with nothing sunk, and two battles
   that stood with nothing sunk: South Africa / Portugal 7,164 hours, Soviet Union / Austria 803.
2. The first of those: four South African destroyer flotillas 12.00000000000062 km from a
   Portuguese transport, reach 12: closed to the reach by a sum of floats, a hair beyond it, no
   shot, each hour. `inReach`: within a reach with 1e-9 km over it. After it: no battle over a
   day; 67 rows, 24 with nothing sunk, of them 12 Norway / Soviet Union and 7 Bulgaria / Soviet
   Union at one point a day: a transport at its own port, hit, no whole ship lost, broke off for
   the port it stood at, and was found again.
3. No fleet breaks off at the port it would sail for (`atOwnPort`), by either clause.

## 3. Before and after, the critic's windows

| seed, window | rows before | nothing sunk before | rows after | nothing sunk after | most rows at one place, after | battles over a day, after |
|---|---|---|---|---|---|---|
| 2609, year 20 + 1 year | 294 | 288 (98 %) | 4 | 0 | 1 | 0 |
| 6113, year 20 + 10 years | 722 | 687 (95 %) | 30 | 2 (7 %) | 2 | 0 |
| 99, the first year | 10 | 1 | 9 | 0 | 1 | 0 (before 1) |

Before for 2609 and 6113 is the critic's own count on the same code (`critic/c9_sea_2609_y21.json`,
`critic/c9_sea_6113_y21_30.json`). The two rows left on 6113 (Soviet Union / Austria tick 203714,
Soviet Union / Finland 215916) are transports hit at sea that lost no whole ship and escaped,
each once. In the critic's case the British fleets now close on the Norwegian transport in
Oslofjord and sink it: one row with its losses.

The late sea battles per world-year fall with the phantoms (2609: 294 → 4 in the year); what is
left is fought. PLAN 7.35 takes the war at sea's frequency up.

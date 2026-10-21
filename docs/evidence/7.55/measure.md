# PLAN 7.55: a transport group with room under a division's (ADR-598)

2026-10-21, on `55a31ee` and the rule. Tools: `tools/diag/smallGroup.ts` (the three cases, 60 days
from the save: `measure.json` before, `after.json` with the rule), `tools/diag/transportWant.ts`
(the 48 saves as saved, `want.json`), `tools/diag/islandArmies.ts` (60 days of each of the 48 saves,
`island/`; sum: `node docs/evidence/7.49/f/sum.mjs docs/evidence/7.55/island`).

## 1. Measured: the three cases (`measure.json`)

| case | groups (room) | at port | land formations (min / median men) | `wantsTransport` | gold / income | shipyard | ordered in 60 days |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5683 y20 Japan | 1 (2,000) | Miyazaki | 36 (12,460 / 12,460) | false | 3,185 / 938 | yes | 0 |
| 7247 y20 Germany | 1 (4,000) | Nouadhibou | 213 (9 / 10,259) | false | 17,305 / 5,209 | yes | 0 |
| 4513 y10 Latvia | 1 (2,000) | Glasgow | 37 (288 / 12,460) | false | 13,115 / 3,814 | yes | 0 |

One cause, the same in all three: ADR-518's order (`economic.ts` 2c) is barred by a group of the
nation's afloat whatever its room, and a fleet is never refilled (`refillable` is the land's). Not
poor, not short of gold (DELIVERY_RESERVE_MONTHS is 1), a shipyard each, no transport in training.
A division (`infantry_div`) is 12,460 men; `sendToPort` stops at the first formation over the room,
`orderLanding` refuses one. 7247's smallest formation on the port's land is 9 men: a threshold
read off the formations there would leave Germany barred, so the rule reads the template.

## 2. The rule and the AT (`after.json`)

A group counts only with room for the infantry division's men (`wantsTransport(..., division)`).

| case | ordered a transport group in 60 days | boarded |
| --- | --- | --- |
| 5683 y20 Japan | 0 → **1** | 0 |
| 7247 y20 Germany | 0 → **1** | 0 |
| 4513 y10 Latvia | 0 → **1** | 0 |

The AT (board a formation or order a transport within 60 days): **3 of 3, met**. None boards in
60 days: a group trains 90.

## 3. Reach (`want.json`)

On the 48 saves as saved, the nations at war for which `wantsTransport` holds: 116 → 125. The nine:
the three cases, 2953 y10 Brazil (2,000), 5309 y10 and y20 Romania (10,000), 5309 y20 Latvia (6,000),
5683 y20 Canada (8,000), 9781 y20 France (12,000, 460 men under the division). While they want one
they order no warship (ADR-518).

## 4. The 48 saves, 60 days

| | 7.56b | after |
| --- | --- | --- |
| on `send` 30+ of 60 days, none boarded (7.54's count, bar 5) | 6 | **6** (the same six) |
| boarded by the watched nations | 5 / 2 | 5 / 2 |
| island share after 60 days | 21.8 % / 29.5 % | 21.8 % / 29.5 % |

Flat, as it must be in 60 days: the new groups train 90. 5683 Japan and 7247 Germany stay on `send`
(their new groups in training), 4513 Latvia on `atPort`. The count is read again on a longer run
when the next report's saves come.

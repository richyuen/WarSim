# PLAN 7.54b: the transports go to the army (ADR-595); 7.54's AT read

2026-10-21, on `7d90236` (7.54a) and the rule. Tools: `tools/diag/sendTrace.ts` (`FOLLOW=1`: the
transport groups day by day, `b/follow_*.json`), `tools/diag/followFormation.ts`,
`tools/diag/islandArmies.ts` (60 days of each of the 48 saves, `b/island_y*.json`; before:
`docs/evidence/7.49/f/`). Sum: `node docs/evidence/7.49/f/sum.mjs docs/evidence/7.54/b`.

## 1. The rule

When the nearest free formation on the transports' port's land cannot march to the port (7.54a §1:
the transports in an exclave), the group sails for a port of its nation on that land that one of
the SAIL_TRIES (4) nearest formations can march to, of the 4 ports nearest it, the first with a way
by sea; nobody is sent that day. The first version tried the nearest formation alone: in 4513 it is
one of the three cut off from every port, and the sail was refused each week. Test:
`transportsToArmy1938.test.ts` (Germany's group at Königsberg, beyond the Polish corridor: red
without; with, it sails for a port of the Reich and a division boards).

## 2. The four cases (60 days)

| case | the transports | boarded | why not sooner |
| --- | --- | --- | --- |
| 4513 y10 Germany | Kotor → a port of the army's | 1 | |
| 7247 y10 Germany | Annaba → a port of the army's | 1 (landed 1) | |
| 8693 y10 Germany | Annaba → Antalya by day 10 | 0 | sent weekly from day 7; their march 80 steps over desert (terrain 7), about 1.2 cells a day: some 65 days (`followFormation.ts`, id 87) |
| 1129 y20 Britain | Warri → Adana by day 30 | 0 | as 7.54a's: the army's marches cross desert |

## 3. The AT

| | before (7.49f) | after |
| --- | --- | --- |
| nations on `send` 30+ of 60 days with none boarded, year 10 | 5 | 3 (8011 GER, 8167 LIT, 8693 GER) |
| the same, year 20 | 4 | 4 (1129 ENG 60 → 33 days, 5683 JAP, 6421 AST, 7247 GER) |
| total, bar 5 or fewer | 9 | **7: missed** |
| formations boarded by the watched nations | 6 / 1 | 5 / 1 |
| island share after 60 days | 21.8 % / 29.6 % | 21.8 % / 29.5 % |

The four cases: 2 of 4 board (bar 4). Left: 5683 Japan and 7247 year 20 Germany (the transports'
room, PLAN 7.55), 8011 Germany and 6421 Australia (untraced, 7.49f §3), 8167 Lithuania (one
formation 649 cells off), 8693 and 1129 (the march over desert, PLAN 7.56).

## 4. The guard

`npm run sim -- --load <save> --years 1 --profile`, the invasion AI's longest call: 4513 3.4 ms,
7247 27.7, 8693 11.9, 1129 62.2 with the four runs side by side; 1129 alone and pinned
(`--affinity 0xFFFF`) 34.5 ms, on 7.54a's code 36.6 ms. Under 50 ms.

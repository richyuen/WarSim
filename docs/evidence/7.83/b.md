# PLAN 7.83b: the invasion AI's turn, cut without changing an outcome (bar missed)

2026-10-23, HEAD `048d251c` (pin 5161de24). The world: HEAD's own year-4 save of seed 99
(`--years 4 --save`, year-4 hash c9bb34b2, as 7.83a), a year from it (year-5 hash f278491d).
Bundles of the headless CLI (`b/hcheck.sh`): `h0` HEAD, `h1`–`h10` the working tree after each cut.

## Method

- `node --cpu-prof --cpu-prof-interval 200` on a year from the save; `b/cpusub.mjs` sums the
  samples under `invasionAi` by function (inclusive and self); `b/children.mjs`, `b/callers.mjs`,
  `b/pt.mjs` (line ticks) for the hot callbacks. HEAD: `b/cpu_h0.txt`; after the first eight cuts:
  `b/cpu_h8.txt`.
- After each cut: the bundle's year from the save, its hash against f278491d (`b/hcheck.sh`).
- The AT's figure: `docs/evidence/7.83/a/pair.sh`, `h0` and the cut bundle at once on separate
  P-cores (0x000F, 0x0F00), then swapped, `--profile`; invasionAi's mean a tick; operationalAi
  beside it as the quietness check.
- `b/walks.ts.txt` (run as `.cache/prof83/walks.ts` with tsx): `JOIN_PROBE.walk` counted by caller over
  the year.

## What HEAD's turn spent (`b/cpu_h0.txt`, 1,811 ms in the year's invasionAi)

| where | inclusive | note |
|---|---|---|
| planFerry | 876 | of it the reach test (`frontReach`'s `any`) 497, `joinWide` 251 |
| planNormandy | 481 | `toFront2` 272 self: every front cell measured for every enemy city |
| invasionAi's own loops | 184 self | the allies' front: `sameSide` per frontier cell per bare actor |
| route searches | ~160 | `findRoute` / `findPath` (marches, sends, sails) |
| pocketOf | 126 | pockets walked again: `board` made a fresh passage per call |

## The cuts (each hash f278491d after it)

| bundle | cut |
|---|---|
| h1 | Normandy: the shore's water looked for before the front's distance |
| h2 | Normandy: `nearestSq`, the front by row, searched outward from the city's row, stopped once the rows alone are farther than the best (exact) |
| h3 | Ferry: no transports at a port, the turn ends before the army is scanned |
| h4 | `frontReach`: every cell asked without a walk first (`reachOnLand`, new in `operational.ts`), the walk only when none answered |
| h5 | Ferry `pick`: ports nearest the front first, none past the nearest open one (the same pick: least d2, then km, then index); `ported` asked per land, to the first port that passes |
| h6 | Beach: a land's ports asked only once one of its front cells has usable water |
| h7 | Allies' front: the bare actors on a holder's side asked once a holder |
| h8 | `sailToArmy`: the nation's ports by land once a call, not a scan of all ports per formation |
| h9 | Scans: the nation tested before the template; a frontier cell's neighbours once, not once per ally |
| h10 | One passage per ferry turn handed to `board` (`keep` is the by-key parts, so no route search counts differently); the transport groups at port asked once an actor turn (`transportsAtPort` is their first) |

A second seed: seed 7 × 3 years from 1938, HEAD and h10: a731d38c, 6adf267b, 14ce18f9 on both
(`b/s7_h0.log`, `b/s7_h10.log`).

## The AT's figure (invasionAi, ms a tick, `--profile`, from the save)

| pair | round 1 (h0 on 0x000F) | round 2 (h0 on 0x0F00) | mean |
|---|---|---|---|
| b1: h0 / h8 | 0.2544 / 0.1926 | 0.2193 / 0.1596 | 0.237 → 0.176 |
| b2: h0 / h9 | 0.2495 / 0.1842 | 0.2203 / 0.1485 | 0.235 → 0.166 |
| b3: h0 / h10 | 0.2618 / 0.1770 | 0.2140 / 0.1427 | **0.238 → 0.160 (−33 %)** |

(The cut bundle ran on the other core in each round; per core in b3: 0x000F 0.2618 → 0.1770,
0x0F00 0.2140 → 0.1427, −32 % and −33 %.) Share of the tick 11.2 % → 7.9 %; calls of 1 ms or more
340 → 270 a year. operationalAi in b3: 0.682 / 0.564 (h0) against 0.568 / 0.648 (h10), the same.

**Bar:** half of the pair's own h0, ≤ 0.119 ms. **Missed** (0.160).

## What is left, and why it is not waste

- `joinWide` walks: 40 a year from the invasion AI on HEAD, 37 after (`walks.ts`; the operational
  AI's 148). Each answers a reach that the ferry's port pick or army scan needs; cuts h4–h6
  moved them between callers and did not remove them. About 150–250 ms a year.
- The route searches of marches, sends and sails (`findRoute`, `sailRoute`, `laneRoute`): their
  number is the rule's (the turn ends at FERRY_SEARCHES, a send at SEND_SEARCHES). About 220 ms.
- `seaReach` (Normandy's `beachReach`): kept for the hour and read by supply after it, so the
  invasion AI pays it as the first caller. 50–110 ms.

Together about 0.05–0.06 ms a tick; what else is left is spread across many small callbacks. Cutting
more needs a rule change (fewer searches or walks a turn), which this part may not make. 7.83's AT is
read again after 7.83c and 7.83d.

# PLAN 7.158's AT (2026-10-29, code `d551fc60`)

The change (pure, no rule): the plans' range scans read only the buckets' columns within the range, the allotment
counts from each formation's window, one order by threat a shape, the orders read only the sectors given a formation,
flat arrays of formations by bucket and the threat by columns of three, `walkGroup` and `findPath` take inner cells'
neighbours by offset. Hashes held: seed 99's pin; 2539's month-1 save 10 days `6952d181`, 20 days `5dc705e1`; the
pinned years below end on the hashes of 7.157's reads (2539 y28 `25c4b526`, 1307 y30 `d62420cd`).

## Clause 1: the operational AI on 2539 y28's month-1 save, paired

Save: `--load critic/c18_ck_seed2539_y27.bin` and 730 hours (`.cache/7157/c2539_m1.bin`). HEAD (`83def07d`, a worktree)
and the change at once, four logical CPUs each (0xF0, 0xF00), then swapped; 20 days.

| run | HEAD ms a tick | new ms a tick | ratio | territory (untouched) new / HEAD |
|---|---|---|---|---|
| HEAD 0xF0, new 0xF00 | 3.684 | 3.044 | 0.826 | 0.93 |
| HEAD 0xF00, new 0xF0 | 3.655 | 3.105 | 0.850 | 0.96 |

Bar ≤ 0.75: missed (0.83–0.85; the untouched system reads 4–7 % lower on the new arm too).

## Clause 2: pinned, one at a time (`npm run sim -- --load <save> --years 1 --profile --affinity 0xFFFF`)

| case | mean tick ms | before (7.157's AT) | operational AI ms | before |
|---|---|---|---|---|
| 1461 y29 | 6.0502 | 5.9924 | 2.8473 | 2.8738 |
| 2539 y28 | 5.9086 | 5.9253 | 2.1327 | 2.3004 |
| 1307 y30 | 5.7688 | 5.6266 | 2.1625 | 2.1595 |
| 1468 y25 | 5.5738 | 5.5799 | 2.3866 | 2.5090 |
| 1468 y26 | 5.5960 | 5.5421 | 2.4916 | 2.5610 |

Bar ≤ 5.5: missed on all five. Over the whole year the operational AI fell 0–7 %, within the ±0.2–0.3 ms drift of
sequential reads; the month-1 save's gain is not the year's.

## What is left

The plans' own loops are no longer the cost. In a CPU profile of the month-1 save after the change: the reach walks
`pocketOf` 11 % and `walkGroup` 11 %, the route searches (`findPath`, its heap) 10 %, the shapes (`sectorShape`,
`frontPart`) 8 %, `passageOf` 5 %. The pocket marks are dropped at each new passage (every planning hour, and between
coalitions within one), and `pocketOf`'s answers depend on the order of the asks (`POCKET_CELLS`), so keeping them is a
rule change. Tried and dropped: shapes kept from hour to hour while each holder's part is the same (7 kept of 66 in 3
days: on a 38-holder front some part changes every hour).

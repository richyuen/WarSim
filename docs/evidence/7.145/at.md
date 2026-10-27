# PLAN 7.145 — AT: carriers strike ashore (ADR-738)

Run 2026-10-27. `tools/diag/carrierAt.ts <seed> 20` on seeds 1284–1293 (unseen; none a critic seed), HEAD before the
rule (`57a00adb`, from the `WarSim_base` worktree with this tool) against the rule (`60e008c6`), six at a time, about
50 minutes. Figures are sums over years 2–20 per seed; `air` is `cvAirH` (hours with a carrier wing's strike in the
air, in a sea battle or on its own mission: the AT's figure), `own` the hours of its own missions, `battleStrike` the
hours of strikes in a sea battle (`carrierStrikes`), `battles` and `sunk` the sea battles fought and ships sunk in them
(`SeaBattle` rows).

```
1284 | base: air 248 own 0 battleStrike 248 battles 163 sunk 1925 (y1 air 74) | rule: air 8592 own 8381 battleStrike 242 battles 182 sunk 1737 (y1 air 6661)
1285 | base: air 90 own 0 battleStrike 90 battles 182 sunk 1748 (y1 air 176) | rule: air 6315 own 6290 battleStrike 26 battles 117 sunk 1332 (y1 air 3907)
1286 | base: air 231 own 0 battleStrike 231 battles 199 sunk 1957 (y1 air 83) | rule: air 14606 own 14604 battleStrike 2 battles 117 sunk 1003 (y1 air 4542)
1287 | base: air 143 own 0 battleStrike 143 battles 154 sunk 1413 (y1 air 189) | rule: air 32047 own 31446 battleStrike 664 battles 128 sunk 1799 (y1 air 2557)
1288 | base: air 136 own 0 battleStrike 136 battles 171 sunk 1861 (y1 air 157) | rule: air 25887 own 25777 battleStrike 114 battles 131 sunk 1336 (y1 air 4511)
1289 | base: air 123 own 0 battleStrike 123 battles 177 sunk 1562 (y1 air 458) | rule: air 8816 own 8758 battleStrike 58 battles 171 sunk 1801 (y1 air 3884)
1290 | base: air 143 own 0 battleStrike 143 battles 121 sunk 1114 (y1 air 58) | rule: air 6819 own 6819 battleStrike 0 battles 120 sunk 1158 (y1 air 5292)
1291 | base: air 149 own 0 battleStrike 149 battles 179 sunk 1569 (y1 air 124) | rule: air 8926 own 8668 battleStrike 289 battles 171 sunk 1776 (y1 air 4966)
1292 | base: air 138 own 0 battleStrike 138 battles 165 sunk 1554 (y1 air 202) | rule: air 23958 own 23634 battleStrike 539 battles 154 sunk 1475 (y1 air 4229)
1293 | base: air 43 own 0 battleStrike 43 battles 130 sunk 1340 (y1 air 160) | rule: air 16178 own 15979 battleStrike 205 battles 132 sunk 1394 (y1 air 4531)
totals years 2-20:
  cvAirH: 1444 -> 152144 (105.363 x)
  cvOwnH: 0 -> 150356 (Infinity x)
  strikeH: 1444 -> 2139 (1.481 x)
  battles: 1641 -> 1423 (0.867 x)
  sunk: 16043 -> 14811 (0.923 x)
  cvBattleH: 1675 -> 2766 (1.651 x)
```

## Verdict

- Carrier strike-hours in years 2–20: 1,444 → 152,144 (**105 ×**, bar 2 ×): **met**, higher on all ten. Strikes in a
  sea battle alone 1.48 ×; carrier fleets' hours in a sea battle 1.65 ×.
- Sea battles in years 2–20: 1,641 → 1,423 (**0.867 ×**, bar 0.95 ×): **missed**; lower on 7 of 10 (1286: 199 → 117).
- Ships sunk in sea battles in years 2–20: 16,043 → 14,811 (**0.923 ×**, bar 0.95 ×): **missed**; lower on 5 of 10
  (1286: 1,957 → 1,003, 1288 1,861 → 1,336), higher on 5.
- Seen in the page: `a-carrier-strike-ashore-99.png` (24 px a cell over the Chinese coast, seed 99 hour 3: Japan's naval
  bombers inbound to a Chinese division one hour out), `b-carrier-to-shore-99.png` (7 px a cell, the fleets off Kyushu
  and the flights to the coast of China); `tests/e2e/carrierStrikeAshore1938.spec.ts`. Met.
- Unit test `carrierAshore1938.test.ts`, red without: met. Gate green.

## Not read (the cause, filed as PLAN 7.148)

Two channels are open; neither is read on this run. (1) Detection: a fleet's detection counts only the carrier wings at
home (`carrierWings` drops a wing aloft), so a carrier group whose wings are out on a land strike most hours finds
fewer enemy fleets; on this rule the carriers' wings are aloft on their own missions 150,356 of the hours. (2) Ships
sunk outside sea battles: the carrier wings now strike enemy fleets out of battle as land-based naval bombers do; those
losses are not in the `SeaBattle` rows, and fewer ships afloat make fewer battles. The run did not count ships sunk
from the air.

Tick: seed 1284, 20 years, base 518 s, rule 542 s (both arms side by side, six at a time; not a timing pair).
Seeds 1284–1293 spent.

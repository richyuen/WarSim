# PLAN 7.143's read: the late American runaway (closed by ADR-740)

Tool: `tools/diag/runaway.ts <seed> 30 <out> USA --saves 10,15,20,25`, HEAD `221e2164` (the sim of `87fee701`, ADR-739).
Seeds 1279 and 1280 (the United States over a third at year 30 in 7.146's AT) and 1276 (22.8 %, a control). Raw output
and saves in `.cache/7143/read/` (not committed). The revolt-event count of this run read 0 by a bug since fixed; the
land lost to revolts below is from the cells' changes (`FlipCause.revolt`), which it read right.

| Seed | US share y1 → y10 → y20 → y30 | US share of world income | coalition's strength ÷ the US's | gained by walking in, years 25–30 | lost to revolts a year, late |
|---|---|---|---|---|---|
| 1279 | 7.3 → 14.7 → 25 → **39.3 %** | 0.29 → 0.46 | 0.08–0.42 | 30,000–58,000 cells a year | 12,000–35,000 |
| 1280 | 7.5 → 12.6 → 18 → **35.2 %** | 0.29 → 0.59 | 0.01–0.16 | 7,000–47,000 | 200–29,000 |
| 1276 | 7.3 → 10.9 → 15 → 22.8 % | 0.29 → 0.35 | 0.10–1.34 | 19,000–35,000 | 22,000–28,000 |

- **The coalition:** the United States is over HEGEMON_SHARE (25 %) of world income every month from 1938 in all three.
  The coalition forms at once, but of its unaligned neighbours alone (Mexico, Cuba, later Canada, Latin America, new
  small states, the Soviet Union in some years), at a tenth to two fifths of its strength; joining declares nothing.
- **What it takes:** mostly land walked into (`walkIn`), from the Soviet Union and Canada first, later France, China,
  Britain; peace terms second; land taken in battle a few hundred to 1,500 cells a year.
- **What stops it:** revolts on its far land (unrest of its far provinces 20–35 late, suppression on) take back less
  than it gains; overextension's strain stops growing at 12 % of the land (OVEREXT_MAX).
- **HEAD on the AT's seeds** (1264–1273 × 30, `designBars.ts`): the largest at year 30 15.1–29.9 %, none over 30 %.

The user's decision (ADR-740): no bar on the largest nation's share; 7.143 closed with no rule.

# PLAN 7.57: a carrier's strike sinks nothing (found at 7.41a §3)

HEAD `d28679e3`. No rule: the finding was the builder's own tool's miss (ADR-604).

## 1. The case, traced

`tools/diag/carrierSink.ts 8693 JAP USA 20` (new; from 1938, Japan declares war on the United States
at once, every hour): each fleet struck by a carrier's wings that hour (one strike a fleet an hour,
whatever the number of wings), its ships before, the ships it lost and the wound taken; and the war's
`SeaBattle` history lines, the losses the page shows.

- 28 carrier strikes on 11 American fleets; **64 ships sunk** (8 destroyer and cruiser flotillas of 8).
- 6 Japan–United States sea battles (the AT's six); their history lines record **64 ships lost**.
- The arithmetic of 7.41a §3 holds: Japan's group 1130's two wings (3 elements of 8 naval bombers
  each) put 0.4 of a ship on each of 16 ships a strike. The wound is carried (`applyLoss`): 0.4, 0.8,
  then 1.2 at the third strike, when all 8 ships of a flotilla sink in the one hour.

`war-8693.json`.

## 2. Why 7.41a read 0

`tools/diag/seaRows.ts` counted a battle's ships sunk in the hours the battle stood at the hour's
end. The hour a flotilla is sunk whole is the hour its battle ends (`endBattle` removes it), so that
hour's losses were never read, although its comment said they were. Every one of 8693's sinkings was
such an hour. Fixed: the record's count at its end is added (`sunkRowGone` when it had a row at the
hour's start). 8693 JAP → USA, 20 days: sunk 0 → **64** (all `sunkRowGone`). Earlier reads of
`seaRows`' `sunk` had the same miss in the last hour of a battle; `sunkNoRow` is unlikely to move
(a battle's last hour almost always starts with its row), and was not re-read.

## 3. Ships sunk per strike, 4 seeds × 1 year

`carrierSink.ts <seed> - - 365` (no declared war). "Land" is a land-based wing's strike on a fleet
(`strikes`, PLAN 5.4c), the same formula (`shipEffectiveness × NAVAL_STRIKE_FIRE`, spread by hit
points). Ships lost in the struck hour by any fire (a carrier's battle may have guns in reach too).
With no rule, before = after.

| seed | carrier strikes | ships sunk | per strike | land strikes on fleets | sunk | per strike | sea battles | ships lost in them |
|---|---|---|---|---|---|---|---|---|
| 1129 | 154 | 95 | 0.62 | 987 | 75 | 0.08 | 57 | 619 |
| 2081 | 392 | 364 | 0.93 | 1,778 | 167 | 0.09 | 59 | 822 |
| 7019 | 242 | 232 | 0.96 | 184 | 134 | 0.73 | 37 | 664 |
| 8693 | 93 | 162 | 1.74 | 858 | 199 | 0.23 | 60 | 735 |

`y1-<seed>.json`. A carrier's strike out-sinks a land-based one per strike on every seed (it strikes
with a group's whole air, the land's wings one by one).

## 4. Found: whole fleets sunk in one hour (PLAN 7.60)

The strike spreads by hit points over a fleet's ships, which are mostly alike, so each takes the same
wound and they all reach a whole ship in the same strike: two or three strikes of nothing seen, then
the fleet gone at once. Of the carrier strikes that sank a ship, those that sank the whole fleet
struck: 1129 6 of 40 (26 of 95 ships), 2081 37 of 71 (237 of 364), 7019 26 of 50 (195 of 232), 8693
22 of 33 (136 of 162); the 8693 war 8 of 8 (64 of 64). 594 of 853 ships so. Gunfire picks its target
ship by ship (`pick`) and sinks them one by one.

# PLAN 7.138 (R16-B1): the late world stays still — measured; a pursuit rule tried, the AT missed (ADR-728)

2026-10-27, HEAD `4da64a8f` (rules of the critic's `7b883084`). Saves: the critic's run-16 year-10 and
year-20 saves (`critic/c16_seed*_y*.bin`). New tools: `tools/diag/stillAt.ts` (the AT: engaged a day at
hour 12 and the top five from one run), `farArmy.ts`, `warBalance.ts`, `warGaps.ts`.

## 1. Where the late army stands

`frontSpread.json` (10 days each; year 20 of 7019, 4877, 6421 against day 60 of 7019, 4877):

| | formations allotted a plan | share in threatened sectors | threatened sectors manned | engaged a war |
|---|---|---|---|---|
| year 20 | 1.5–6.2 | 0.29–0.41 | 0.02–0.05 | 0.5–1.3 |
| day 60 | 8.6–11.4 | 0.67–0.93 | 0.17–0.26 | 9.7–12.6 |

`farArmy.json`: land formations of nations at war standing on a landmass with no enemy-held cell are
10–29 % late and 23–25 % on day 60: the far alliance members are **not** what changed. Of those within
60 cells of an enemy-held cell, engaged 0–6 % late against 15–17 % on day 60.

`warGaps.json` (5 days each), the distance from each land formation of a war to the nearest one of the
other side on its landmass:

| | < 3 | 3–12 | 12–30 | 30–60 | 60–120 | > 120 | none on its landmass |
|---|---|---|---|---|---|---|---|
| year 10–20 (5 saves) | 1–3 % | 1–7 % | 0–13 % | 1–12 % | 4–38 % | 21–53 % | 18–39 % |
| day 60 (2 worlds) | 21–22 % | 9–11 % | 7–11 % | 5–13 % | 12–20 % | 21–29 % | 2–17 % |

`warBalance.json`: late wars are as lopsided as year 1's (the weaker side's land formations 63–119 a
world late, 54–133 on day 60); year 1's contact is mostly two wars of large neighbouring armies (Japan
and China: 98–109 formations within 3 cells; Germany's). Late, even even wars stand apart (2081 y10, the
Soviet side 76 against Poland and Germany's 97: 11 within 3 cells).

`lossBySystem_y20.json` (60 days, 5 year-20 saves): formations ended — economic AI (the fold) 50, combat
15, air 5, amphibious 5; men lost — combat 255,000, supply 203,000, air 172,000. The army's size late is
not the main factor: the share of it in contact is ~10 × lower, the army ~2 × smaller.

## 2. Why the formations near an enemy do not close

`huntStats.ts.txt`, with the hunt below on (HUNT=60, 10 days from each save): of the free formations
standing after the day's orders (490–1,778), those with a beatable enemy formation (its strength ×
OFFENSIVE_RATIO at most theirs, not engaged, not on the retreat) within 60 cells: 1–36 %. That enemy
stands, counted per sighting:

| save | another landmass | a neutral's cell | its own side's cell | an enemy's cell, same landmass | orders to it: ok / refused |
|---|---|---|---|---|---|
| 1061 y10 | 432 | 3 | 0 | 4 | 4 / 0 |
| 4513 y10 | 102 | 181 | 20 | 46 | 2 / 40 |
| 5521 y10 | 1,780 | 43 | 20 | 332 | 0 / 88 |
| 2789 y10 | 1 | 0 | 0 | 1 | 0 / 0 |

The enemies near a standing army late are across the water or behind a neutral's land; where one is on
enemy ground of the same landmass, the march to it is refused for want of a way (neutral land between).
No order of the operational AI reaches them.

## 3. The rule tried (`rule.patch`, not committed)

(a) An attacking sector marches on the nearest beatable enemy formation within PURSUIT sector buckets
(ADR-702's rule from 3 × 3 to (2P+1)², with a strength test); (b) a free formation still standing after
the orders marches on the nearest beatable enemy formation within HUNT cells on its landmass.

A/B from 8 year-10 saves × 60 days (`ab/`): HEAD 2.290 a day; PURSUIT 3 2.169, 6 2.464; HUNT 30 2.277,
60 2.341, 120 2.296 (several saves equal to HEAD to the digit: the hunt seldom finds a foe it can reach).

## 4. The AT (`runs/`, `at_summary.txt`): 1201–1206, 1208–1211 × 30 years, PURSUIT 6 + HUNT 60

| | HEAD | rule | bar |
|---|---|---|---|
| engaged a day, years 2–30 | 4.042 | 3.937 (0.974 ×, paired se 0.36) | ≥ 1.15 × HEAD (4.65) |
| year 1 | 40.82 | 40.75 (0.998 ×) | ≥ 0.95 × |
| worlds with the same top five > 12 years | 1 | 2 | ≤ HEAD's |
| mean longest run | 8.3 | 9.8 | |
| land formations at war a day, late | 395.7 | 400.0 | |
| wars running, late | 7.53 | 7.20 | |

Missed. Seeds 1201–1206 and 1208–1211 are spent.

## 5. What is left

The late contact is held by the map of the wars, not by the operational AI's orders: the enemies near an
army are across the sea or past a neutral. The levers left are the strategic AI's (wars between nations
whose armies can meet by land) and the invasion AI's (landings on the coast an army faces). Five
operational-AI rules (ADR-679, ADR-693, ADR-702, this one, and 7.128b's read, ADR-717) have each read flat on
fresh worlds.

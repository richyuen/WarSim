# PLAN 7.41a: the sea battles with no row (critic run 11, naval 7)

HEAD `51b2b62` for the measure; the rule on top of it.

## 1. The critic's count

`critic/scripts/c11_n_seabattles.mjs` steps 6 hours at a time after `declareWar` and counts a battle
of the pair "rowless" when `b.pair === null` (`out.rowless += mine.filter((b) => b.pair === null)`).
It never reads `b.strike`, the carrier strike that has had its own row since ADR-542 (PLAN 7.35a).

`tools/diag/seaRows.ts`, now with the critic's six-hour samples (`samples` in its output), from 1938
with the same war:

| seed, war | the critic's samples | pair | carrier strike | none |
|---|---|---|---|---|
| 8693 JAP → USA, 20 days | 9 (h 330–480), all "rowless" | 0 | 9 | 0 |
| 2081 GER → ENG, to h 66 | 6 (h 42–66) | 2 | 3 | 1 (h 42) |

The 8693 samples match the critic's hour for hour (330, 336, 360, 402, 426, 432, 450, 480 twice).
2081's match to h 42, the critic's first click: its script then runs the sim 4 s at Speed x1
after each click (`setSpeedLevel(0)` and 8 × 500 ms), so its later samples are of later hours.

In the page (`vite preview` of HEAD, the probe below without the rule's kind), 8693 at h 330:
the ticker lists "⚓ Carrier strike: Japan on United States's ships"; its click frames the two
American destroyer flotillas (`a-strike-row-8693.png`). So all 9 of 8693's "rowless" samples had a
row. The critic's figure is its probe's, not the page's.

## 2. What has no row

A battle in which no weapon reaches yet: fleets that see each other (a carrier's detection, 313 km
with the air over it) while no gun, torpedo or carrier wing (250 km) reaches. ADR-542 kept such a
battle without a row. On 2081, h 42: Britain's carrier group 1063 264 km from Germany's battle
squadron 1199, engaged both, closing. `seaRows` over 7 days: 11 of 86 battle-hours of the two wars'
battles with no row (8693: 3 of 73, none of the pair's).

Rule (view only, ADR-601): the snapshot's sea battle carries its nearest two fleets at war whatever
their distance (`closing`, SEA_STRIDE 16 → 20); a battle with neither a pair nor a strike is listed
after the strikes, "Fleets closing: {a} and {b}", and its click frames those two with the pair's
margin.

## AT (the page, the critic's samples, `vite preview` of the rule)

| seed, war | samples of the war's battles | with a row | by kind | all battles = rows, every sample |
|---|---|---|---|---|
| 8693 JAP → USA, 20 days | 9 | 9 | strike 9 | yes (12 battle-samples) |
| 2081 GER → ENG, 7 days | 15 | 15 (was 14) | pair 3, strike 11, closing 1 | yes (16) |

`a-rows-8693.json`, `a-rows-2081.json`. The spec `tests/e2e/seaClosingRow1938.spec.ts` (red before:
no battle has `closing`, no "Fleets closing" row): 2081 at hour 41, "⚓ Fleets closing: United
Kingdom and Germany", 2 battles and 2 rows; its fleets 1063 and 1199 23.7 cells apart, from the
row at 429 m/px with 10 and 16 of their ships on the screen (`a-closing-row-2081.png`).

## 3. Found: a carrier's strike sinks nothing (PLAN 7.57)

8693's six USA–JAP battles (49 hours) are Japan's carrier group 1130 (two wings of 24 aircraft
aboard) striking American destroyer flotillas 144–245 km off every 4 hours. Each strike lands
(`navalCombatSystem`, traced): spread over the 16 destroyers in reach by hit points, 0.0667 of a
ship from each of the six wing elements, 0.4 a destroyer a strike; the fleets part after about
three strikes, and every target stays at 8.000 ships. 0 sunk in 20 days.

## Probe

`.cache/probe741a_rows.mjs <seed> <A id> <D id> <days>` (not kept in the repo; Playwright against
`vite preview --port 5311`): `declareWar`, then every 6 hours `sim.step(6)`, waits for the view's
tick, and reads `view.seaBattles()` (the kind: pair, strike, closing, none) and the
`[data-testid=sea-battle-row]` texts.

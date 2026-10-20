# PLAN 7.46a: why a navy the chase sinks is not built again (from PLAN 7.39b, ADR-573)

At HEAD `8c64c3c`, from 1938. No rule: the pin is unchanged.

- `npx tsx tools/diag/navyRebuild.ts <seed> 10` (new): per day each nation's armed power
  (`fleetPower`) and its peak since 1938; the world's power lost in sea battles and built (new armed
  fleets). On each month's start, per living nation whose armed power is under 75 % of its peak (a
  "depleted" navy; at 0 a lost one), the first test of the economic AI's fleet step (`economic.ts`
  3b) that stops a warship's order, in the code's order (`navyLoss.ts`'s), weighted by the power it is
  short of its peak; a month that passes every test and orders no warship is `spentArmy` (the
  army's orders took it) or `spentOther`.
- 4 seeds (1307, 3613, 8693, 7019) × 10 years, before (HEAD) and after (HEAD with
  `docs/evidence/7.39/b-chase.diff`), the eight runs at once. JSON in `a/`, tables
  `node docs/evidence/7.46/a/sum.mjs`.
- Determinism check: both sides give 7.39b's `seaYears` A/B power to the thousand (291, 259, 253, …
  and 217, 128, 129, …), so this is the run the AT is read on.

## 1. The world's armed power, the chase against HEAD (the AT's figure)

Mean of the 4 seeds, the day's mean over the year:

| year | HEAD (k) | the chase (k) | ratio (bar 80 %) | lost in battle, chase (k) | built, chase (k) |
| --- | --- | --- | --- | --- | --- |
| 1 | 291 | 217 | 74 % | 179 | 3.3 |
| 2 | 259 | 128 | 49 % | 15 | 6.4 |
| 3 | 253 | 129 | 51 % | 5 | 15.8 |
| 4 | 258 | 127 | 49 % | 25 | 3.6 |
| 5 | 240 | 114 | 47 % | 2 | 18.2 |
| 6 | 196 | 127 | 65 % | 6 | 8.4 |
| 7 | 184 | 127 | 69 % | 3 | 7.2 |
| 8 | 186 | 132 | 71 % | 7 | 19.0 |
| 9 | 185 | 138 | 74 % | 4 | 6.8 |
| 10 | 176 | 139 | 79 % | 3 | 15.9 |

HEAD's own power falls 291k → 176k, so the bar moves: 202k at year 3, 141k at year 10. The chase
sinks 179k in year 1 (HEAD 77k). The world builds 3.3k to 19k a year on either side (HEAD 3.6k to
18.4k): the chase does not slow the building, and nothing speeds it up when more is sunk.

## 2. What stops the warship's order (depleted navies, years 3–10)

| first test that stops it | HEAD: months (share of the power-months short) | the chase |
| --- | --- | --- |
| gold (`pickFleet`: no warship of its kinds with RESERVE_MONTHS of income) | 3,463 (36 %) | 4,522 (40 %) |
| passed every test; the army's orders spent the month first (`spentArmy`) | 566 (29 %) | 720 (27 %) |
| the navy's share (its upkeep ≥ NAVY_SHARE of income) | 269 (11 %) | 352 (13 %) |
| a warship in training (one at a time) | 476 (12 %) | 493 (10 %) |
| no shipyard / poor / a transport (in training or wanted) | 1,572 (8 %) | 1,702 (10 %) |
| ordered | 76 (1 %) | 83 (1 %) |

The same four causes in the same order on both sides. The rebuild's shortfall is the economy's; the
chase sinks more and sooner. The months short are mostly lost navies (power 0): 3,664 of the
chase's 4,522 gold months, 535 of its 720 `spentArmy`, 262 of its 352 share months.

## 3. The named cases (the chase; most of the power short)

- **Britain** (peak 86.5k, sunk to 0 on all four seeds, in days 90–243): seeds 7019 and 3613
  pass every test and spend the month on the army 87 and 66 months; the first warship ordered
  2,283 and 1,096 days after the navy fell under 75 %. ADR-557's saving keeps a warship's price
  over the reserve only in peace, or at war with the army at its peacetime share. Britain at war
  holds an army under that share, so the army's orders take the gold first every month.
- **Japan** (peak 53.3k, 0 on all four): `gold` 88, 65, 76 and 48 months, with `spentArmy` 15 to 40;
  on three seeds no warship ordered in the run.
- **France** (peak 35.6k, 0 on all four): `navyShare` 90, 55, 33 and 49 months. On seed 3613 at
  years 2, 3 and 5 France holds nine submarine flotillas and no other fleet: armed power 0, upkeep
  25.2. `economic.ts` sums the upkeep of every fleet (`isFleet`) against NAVY_SHARE, submarines and
  transports with the warships, and ADR-557's saving is gated on the same share. A navy of
  submarines alone keeps France from any surface warship: no battle line, and no power to read.
  (The share months are at 12–41 % of income on the chase's side.)

## 4. The ceiling of a rule that builds one warship at a time

The armed power of a full template (a 1938 fleet's), its price and its days in the yard:

| template | power | gold | days | power a year in the yard |
| --- | --- | --- | --- | --- |
| battle squadron | 11,400 | 6,720 | 900 | 4,600 |
| cruiser squadron | 2,800 | 1,960 | 400 | 2,600 |
| destroyer flotilla | 1,200 | 1,120 | 180 | 2,400 |

A nation builds one warship at a time (`shipsPending === 0`). If Britain, Japan and France each
had a warship of their kinds in the yard every day from the end of year 1 (no gold, army or share
stop at all), they would add about 4.6k + 4.6k + 2.6k ≈ 12k a year: by year 3 about 24k more,
153k against the bar's 202k (60 % of HEAD); by year 5 about 48k more, 162k against 192k (68 %). The
AT's 80 % at years 3–5 is out of reach of any rule that keeps one warship at a time, whatever it
does about the gold, the army and the share. It needs warships ordered in parallel by a navy
that was sunk, or cheaper and faster warships. That is a question of how fast a sunk navy should
come back, so it is the user's (ADR-554), and is written under PLAN 7.46.

## 5. What 7.46b takes

One cause a part, each with a unit test red without, the pin's entry and the 4 × 10 read:

- b1, the share: a navy's share counts what is armed. Submarines and transports have their own
  rules (a transport is 2c's, outside the share); a nation with no armed fleet is not stopped by
  them.
- b2, the army first at war: the saving of ADR-557 also at war when the enemy has a navy.
- b3, the gold: traced first with `navyLoss.ts` on the chase (Japan's months).

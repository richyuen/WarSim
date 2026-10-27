# PLAN 7.144's read: what the larger air forces change on the ground

2026-10-27, HEAD `4da68474`. Saves of HEAD at years 8 and 14 of the spent seeds 1243, 1246, 1249 and 1252
(`npm run sim -- --save`, `.cache/7144/sv/`), each stepped 60 days per arm by `tools/diag/airGround.ts`
(hour 12 of each day; aloft hourly), six at a time. The arms were temporary switches in the sim, read
from the environment and removed before the rule was written.

## The 20-year gap (7.142's AT files, `.cache/7142/at_*`, means of 1243–1252)

Land formations engaged a day by year, HEAD before ADR-736 against the rule: 37.3 / 36.2, 10.0 / 10.4,
6.2 / 3.7, 4.6 / 5.6, 5.2 / 5.0, 5.2 / 4.4, 4.0 / 3.4, 5.7 / 3.9, 4.5 / 2.5, … 2.7 / 2.1 at year 20: the gap
opens in year 3 and holds near 0.7 ×. Wars (7.3–8.8 a day) and nations at war (51–64) alike in both.

## The arms (8 saves × 60 days)

| arm | engaged a day | × HEAD | aloft an hour | strikes that hit a day | land struck in / out of contact | units struck a day |
|---|---|---|---|---|---|---|
| HEAD | 3.17 | 1.00 | 24.7 | 45.2 | 16.1 / 87.1 | 990 |
| the reserve flipped back (`RESERVE_MONTHS` in the rebuild) | 3.17 | 1.00 | — | 45.2 | 16.1 / 87.1 | 990 |
| each nation keeps 60 % of its wings, reserve flipped back | 3.71 | 1.17 | — | 31.0 | 5.3 / 51.0 | 666 |
| air's factor on fire off | 3.20 | 1.01 | — | 45.9 | 17.5 / 87.8 | 1,010 |
| air's factor on supply off | 3.16 | 1.00 | — | 44.7 | 16.0 / 86.5 | 974 |
| **strikes off** (land and fleets) | **4.33** | **1.37** | — | 0 | 0 / 0 | 0 |
| strike fire out of contact 0 (`DISPERSED_STRIKE` 0.25 → 0) | 3.78 | 1.19 | 32.2 | 5.5 | 15.7 / 0.3 | 308 |
| … 0.1 | 3.61 | 1.14 | 28.3 | 42.0 | 13.8 / 94.9 | 632 |
| … 0.05 | 3.64 | 1.15 | 30.2 | 37.8 | 13.9 / 99.7 | 494 |
| **the k-th strike a day on a land formation at 1 / (1 + k)** | **4.12** | **1.30** | 32.2 | 39.1 | 29.9 / 102.7 | 363 |
| … out of contact only | 3.62 | 1.14 | 30.8 | 34.8 | 12.6 / 104.2 | 548 |
| … at 1 / √(1 + k) | 3.73 | 1.18 | 29.7 | 45.2 | 20.2 / 98.3 | 585 |

Per save, engaged a day (1243 y8, y14, 1246 y8, y14, 1249 y8, y14, 1252 y8, y14):
HEAD 3.43 5.03 0.12 4.27 5.02 0.70 4.12 2.68; 1 / (1 + k) 3.23 5.27 1.32 6.57 5.25 1.75 6.18 3.40;
strikes off 3.57 5.50 2.78 7.52 4.70 1.40 5.65 3.52.

- **The channel is the strikes.** The air's factors on fire and on supply move nothing. Strikes off
  lifts contact 1.37 × in 60 days, about the 20-year gap of ADR-736 (1 / 0.76 = 1.32 ×): the effect
  is not built up over years, a short read predicts the long one. Half of it is the strikes on
  formations out of contact (their fire at 0: 1.19 ×), half the strikes in contact.
- **The reserve flipped back reads the same to the last digit** on all eight saves: in 60 days it
  changed no order (wings, men, every column alike). The air force a save holds is what the rule built
  over years; one save stepped two ways cannot show the rebuild, so the wings were cut instead.
- **The pile** (`tools/diag/strikeTrace.ts`, 1246 year 8, HEAD): a nation at war with Japan has 4 land
  formations, 24k men, out of contact, struck 44–59 times a day; by day 19 one formation of 1k men is
  left. Another, of 6k men alone, is struck 26 times a day and gone on day 9. With strikes off those
  formations live and meet Japan's (engaged 0.12 → 2.78). A strike wing on a mission flies sortie after
  sortie (`TURNAROUND_HOURS`), and the AI spreads its wings over the enemy formations in range
  (PLAN 7.24a): with few of them and 1.7 × the wings, each takes many strikes a day.
- **Aloft rises with weaker strikes** (24.7 → 32.2): the formations struck live on, so the wings keep
  a target in range and their mission, where on HEAD they lose it when the target is gone. Strikes
  that hit rise too (hits on land 103 → 133 a day under 1 / (1 + k)).
- `strikes off` silenced naval strikes too; the rules below touch the land's targets alone.

## The rule read for the AT

The k-th strike in a day on a land formation (k strikes on it already that day, by any wing) fires at
1 / (1 + k): 1.30 × on the saves, aloft 1.30 ×; the air's damage to the land 990 → 363 units a day,
the strikes flown and hitting more. The softer curve (1 / √(1 + k), 1.18 ×) and the rule out of contact
alone (1.14 ×) are under the AT's 1.25 ×.

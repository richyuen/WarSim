# PLAN 7.26c0: the land war after year 1 (measured 2026-10-18 at `7b34062`)

Three measures: the critic's run-8 headless files (`critic/c8_headless_*.json`, 30 years, at
`fd27e85`); `npx tsx tools/diag/landWar.ts <seed> 8` and `npx tsx tools/diag/armies.ts <seed> 8` on
seeds 2843 and 7919 (two of the critic's seeds), at HEAD.

## 1. The land fire falls with the air war (critic files)

| seed | year | wars | aloft | StrikeHit (k) | FormationDestroyed | MajorBattleStarted | FormationArrived | flipped cells |
|---|---|---|---|---|---|---|---|---|
| 2843 | 1 | 9 | 34.6 | 97.1 | 564 | 22 | 9,979 | 28,880 |
| 2843 | 2 | 6 | 16.5 | 73.3 | 289 | 8 | 4,527 | 12,768 |
| 2843 | 3 | 4 | 14.4 | 49.7 | 108 | 0 | 3,720 | 26,534 |
| 2843 | 4 | 5 | 4.5 | 6.4 | 57 | 0 | 2,833 | 14,110 |
| 2843 | 5–30 | 0–10 | 1.4–10.6 | 1.2–28.9 | 10–181 | 0–7 | | |
| 7919 | 1 | 6 | 39.5 | 113.9 | 662 | 30 | 10,219 | 26,705 |
| 7919 | 2 | 6 | 11.0 | 83.2 | 229 | 1 | 4,410 | 16,463 |
| 7919 | 3 | 6 | 5.7 | 15.4 | 63 | 0 | 1,272 | 9,368 |
| 7919 | 4–30 | 1–10 | 1.4–11.7 | 0.4–182 | 22–145 | 0–9 | | |

Land fire (shots that hit) falls 10 to 20 times from year 1 to year 4 on both seeds, and major
battles to none, while 4 to 10 wars run; marches still end (1,300 to 6,500 arrivals a year) and
land still changes hands (9,000 to 80,000 cells a year). The armies walk; they seldom meet.

## 2. Wars with a front and nobody at it (`landWar.ts`)

Per year, the war-days of each kind: no land front (`warsWithFront`), a front and contact (an
engaged land formation of each side within 1.5 × `CONTACT_CELLS`), a front and none.

| seed | year | war-days | frontless | front, contact | front, none | contact share of front days | engaged a day |
|---|---|---|---|---|---|---|---|
| 2843 | 1 | 2,124 | 10 | 770 | 1,344 | 36 % | 28.9 |
| 2843 | 2 | 2,233 | 277 | 285 | 1,671 | 15 % | 4.1 |
| 2843 | 3 | 2,062 | 110 | 107 | 1,845 | 5 % | 1.0 |
| 2843 | 4 | 2,648 | 318 | 65 | 2,265 | 3 % | 0.4 |
| 2843 | 5 | 2,386 | 359 | 51 | 1,976 | 3 % | 0.4 |
| 2843 | 6 | 1,051 | 249 | 189 | 613 | 24 % | 2.6 |
| 2843 | 7 | 1,032 | 92 | 37 | 903 | 4 % | 0.8 |
| 2843 | 8 | 1,171 | 0 | 94 | 1,077 | 8 % | 1.9 |
| 7919 | 1 | 2,467 | 145 | 999 | 1,323 | 43 % | 40.0 |
| 7919 | 2 | 2,527 | 328 | 303 | 1,896 | 14 % | 5.9 |
| 7919 | 3 | 2,315 | 590 | 210 | 1,515 | 12 % | 1.8 |
| 7919 | 4 | 2,855 | 712 | 100 | 2,043 | 5 % | 0.8 |
| 7919 | 5 | 2,689 | 610 | 208 | 1,871 | 10 % | 1.9 |
| 7919 | 6 | 1,976 | 301 | 149 | 1,526 | 9 % | 1.3 |
| 7919 | 7 | 2,260 | 695 | 106 | 1,459 | 7 % | 0.9 |
| 7919 | 8 | 1,941 | 0 | 158 | 1,783 | 8 % | 1.1 |

- **Frontless wars are few**: 0 to 31 % of war-days (ADR-480 holds: 2 and 5 wars of 110 and 113
  ended on FRONTLESS_DAYS, none ran past it).
- **The gap is the wars with a front**: from year 2, 85 to 97 % of their days have no contact.

The weekly samples of those wars (`nearestKm`: the nearest pair of their sides' land formations):

| seed | war | samples | one side with no land formation | nearest ≤ 150 km | 150–1,000 km | over 1,000 km | of the formations, moving |
|---|---|---|---|---|---|---|---|
| 2843 | small (each side under 50) | 788 | 39 % | 24 % | 22 % | 15 % | 84 % |
| 2843 | big (a side with 50 or more) | 1,133 | 13 % | 32 % | 14 % | 41 % | 47 % |
| 7919 | small | 1,006 | 45 % | 18 % | 22 % | 15 % | 52 % |
| 7919 | big | 1,261 | 4 % | 43 % | 33 % | 20 % | 61 % |

Two kinds of war leave the wings nothing:

- **One side with no army, and its land not taken.** 39 to 45 % of the small wars' samples. Seed
  2843: Yemen (1 formation) against Saudi Arabia (none) 720 days at score 0, to the stalemate peace
  (`STALEMATE_DAYS`, exhaustions 72); the Soviet Union (73 formations) against China (none) 869 days
  before China capitulated; Brazil, Chile against Bolivia (none) 125 to 178 days. Seed 7919: Iraq
  against Saudi Arabia (none) 400 and 618 days, scores 75 and 64, each to exhaustion; Argentina
  against Brazil (none) 291 days. Nothing defends that land, and it is taken slowly or not at all.
- **Great alliances whose armies stand far apart.** Seed 2843: Italy's bloc (161 land formations,
  126 of them moving on an average sample) against France's (55), a front of 2,222 cells, the
  nearest pair 1,291 km, 40 days of contact in 686; Britain's bloc against Mexico, Cuba and Canada,
  nearest 1,379 km, 5 days in 736; Italy against South Africa's bloc 1,136 km, 25 in 715. Seed
  7919: France's bloc against Italy's, 3,448 cells, 2,376 km, no contact in 383 days. The front is
  the sum of the members' borders across the world (colonies, puppets), and the armies are not
  on the part of it the enemy holds with troops.

## 3. Why no landing (`landWar.ts`, the invasion AI's gates for every nation at war, daily)

| seed | years | fronted | aboard | no transport at an own port | no enemy port open | at port (would load) | would send to a port | none free |
|---|---|---|---|---|---|---|---|---|
| 2843 | 1 | 6,485 | 43 | 9,354 | 0 | 32 | 77 | 108 |
| 2843 | 2–8 | 3,500–7,731 | 26–105 | 5,329–10,651 | 0–52 | 10–116 | 111–454 | 192–1,717 |
| 7919 | 1 | 6,985 | 132 | 10,180 | 0 | 76 | 137 | 146 |
| 7919 | 2–8 | 4,356–7,645 | 13–192 | 5,753–12,624 | 0–84 | 7–116 | 34–999 | 185–1,409 |

- A nation with a land front in any of its wars plans no landing in any (`fronted` is per
  nation): 30 to 50 % of nation-days.
- Of the rest, 60 to 90 % have no transport group standing at a port of their own: the colonies
  and small members of the blocs (seed 2843's Burma, Ceylon, Malaya, Palestine…, 300 to 365 days
  each), and late Germany (307 days of year 7).
- "None free": a free formation on neither the port nor its land (Japan 324 to 365 days of years
  7–8, Egypt, Albania): 600 to 1,700 nation-days from year 4.
- The landing is the wars' lesser lever: under 5 % of nation-days could load or send at all.

## 4. The land armies (`armies.ts`)

| seed | year | land formations | men | manpower pools | land orders | destroyed |
|---|---|---|---|---|---|---|
| 2843 | 1 | 598 | 4.68 M | 34.4 M | 81 | 664 |
| 2843 | 2 | 482 | 3.75 M | 47.5 M | 82 | 231 |
| 2843 | 3–8 | 475–523 | 3.98–4.93 M | 57.8–73.2 M | 57–87 | 80–128 |
| 7919 | 1 | 572 | 3.68 M | 33.9 M | 80 | 692 |
| 7919 | 2 | 523 | 3.61 M | 46.1 M | 73 | 168 |
| 7919 | 3–8 | 518–590 | 3.89–5.69 M | 57.4–72.3 M | 57–83 | 59–103 |

The army halves in year 1 (1,054 land formations and 9.78 M men at the start) and then holds, 4 to 6 M men,
while the pools double unused. Each month, of the nations at war, the economic AI's first gate for
an infantry division: gold short of the price and RESERVE_MONTHS of income for 195 to 309
nation-months a year (most of the small ones), the balance 116 to 246, the share of income
(`ARMY_SHARE_WAR`) 0 to 46, slots full 9 to 36; 30 to 47 order (15 to 23 M of the men at war).
Manpower stops none. The army is smaller than in year 1 and steady; it is not what parts the
fronts: the big wars' sides hold 50 to 200 formations each and stand 1,000 km apart.

## Causes, in the order taken (PLAN 7.26c1 to c3)

1. **Land that nobody holds is not taken** (c1): a side whose enemy has no land formation on the
   front takes its cells slowly or not at all (Yemen and Saudi Arabia 720 days at 0). Measured first:
   the operational AI's sectors and orders of the side with the army in those wars.
2. **The blocs' armies are not where the enemy is** (c2): a front of thousands of cells over the
   world, the formations allotted by sectors and a march of 1,000 km; 47 to 84 % of them moving.
   Measured first: where the moving formations of the big sides march to, and how long.
3. **The landing's gate per nation** (c3, the least): a nation with a front in one war lands in no
   other; colonies without transports.

# PLAN 7.110a: why the land army at war is smaller after year 1

2026-10-24, on HEAD `88e46041` (pin unchanged since c848f884). Seeds 901–910 × 20 years from 1938
(`tools/diag/armyAtWarAt.ts`, new; `head_901-910.json`), and their year-10 and year-20 saves
(`.cache/7110/head/`, not committed). Tools (new): `armyAtWarAt.ts`, `armyGatesNow.ts`,
`armyLosses.ts`, `armyLossBySystem.ts`. Read only: no rule.

## 1. The figure on HEAD

Land formations of living nations at war (not fleets, wings or aboard), daily, over the wars running
(a ratio of sums over the days, not a mean of daily ratios). Ten seeds pooled:

| year | per war | wars | nations at war | formations | men (M) | their income a month | raised | destroyed |
|---|---|---|---|---|---|---|---|---|
| 1 | 75.8 | 6.9 | 46 | 525 | 4.09 | 10,457 | 78 | 442 |
| 2 | 58.5 | 7.9 | 56 | 465 | 3.19 | 14,301 | 96 | 233 |
| 3 | 54.9 | 7.5 | 58 | 410 | 2.51 | 15,473 | 99 | 187 |
| 5 | 41.8 | 7.6 | 58 | 318 | 2.00 | 14,623 | 103 | 137 |
| 10 | 43.2 | 7.6 | 53 | 326 | 2.40 | 14,383 | 89 | 110 |
| 15 | 51.2 | 7.1 | 56 | 363 | 2.57 | 15,596 | 90 | 112 |
| 20 | 48.9 | 6.9 | 58 | 336 | 2.35 | 15,851 | 87 | 102 |

(raised and destroyed: land formations a year, all nations; every `FormationDestroyed`, the disbanded
among them, which are 0–34 a year.)

- Years 2–20 pooled: **48.50** a war against 75.8 in year 1 (0.64; per seed 0.49–0.79). Engaged a war
  0.488 (year 1: 3.2–7.4). The 7.110 AT's base on these seeds; its own run is on unseen ones.
- The wars and the nations at war hold steady; the income of nations at war rises by half after year 1.
  The army falls while the world raises a steady ~90–100 formations a year: it settles where its losses
  fall to that rate (years 6–20: destroyed 81–121, raised 82–92).

## 2. Upkeep against income, and what the money buys

`armyGatesNow.ts` (`gates.json`): at 6 month starts from each of the 20 saves, every living AI nation at war
(6,779 nation-months). Shares of the income of nations at war:

| combat efficiency (CE cost) | suppression | land army upkeep | refills | research | navy | air | other expenses | left |
|---|---|---|---|---|---|---|---|---|
| 0.193–0.203 | 0.095–0.109 | 0.076–0.083 | 0.066–0.126 | 0.034–0.035 | 0.022–0.024 | 0.006 | 0.067–0.069 | 0.45–0.48 |

"Left" (the month's balance after research and the orders in training) pays for the new orders' price
(a division's 1,001 gold is 200 months of its 5 a month upkeep) and the refills: gold stands at a median 1.3–6
months of income by band. The army's upkeep share (0.6 at war, ARMY_SHARE_WAR) never binds a nation with
money. The first gate of the next army order, by monthly income:

| income | nation-months | share of income | slots / share / balance / gold / manpower / ship / other | land orders a month | army upkeep ÷ income | refills ÷ income | orders |
|---|---|---|---|---|---|---|---|
| 0–20 | 3029 | 0.01 | 66 / 232 / 1560 / 1149 / 0 / 0 / 22 | 0.01 | 0.142 | 0.116 | cadre 20 |
| 20–100 | 1811 | 0.05 | 138 / 18 / 42 / 1527 / 0 / 24 / 62 | 0.04 | 0.070 | 0.098 | cadre 57, infantry 1 |
| 100–400 | 1321 | 0.15 | 507 / 0 / 25 / 438 / 0 / 156 / 195 | 0.16 | 0.062 | 0.043 | cadre 168, infantry 27, armour 3 |
| 400–1000 | 251 | 0.08 | 79 / 0 / 0 / 19 / 0 / 55 / 98 | 0.43 | 0.040 | 0.010 | cadre 56, infantry 37 |
| 1000+ | 367 | 0.71 | 93 / 0 / 0 / 14 / 0 / 70 / 190 | 0.90 | 0.088 | 0.118 | cadre 44, infantry 247, armour 29 |

- The cadre rule (ADR-673) is the order of most nations at war under 1,000 a month: 301 of 393 orders
  there; over 1,000, 44 of 320.
- Under 100 a month nations order nothing for gold (a cadre's 504 gold is 5–25 months of income, and the
  refills spend the treasury to its reserve first). 100–400: one slot, and the slot is full in 507 of
  1,321 months. Over 1,000 (0.71 of the income at war): 0.9 orders a month; the slots, the warship's saving
  (70 of 367) and armour (27 % of the orders in training, 225–360 days a slot) are their gates.
- The air force costs under 1 % of income: its rebuild (ADR-689) does not take the army's money.

## 3. Where the men go

`armyLossBySystem.ts` (`lossBySystem_y10.json`): each system of the tick wrapped (as `Sim.profile` does),
the strength of each land formation of a nation at war read before and after it; 60 days from five
year-10 saves. Men lost (of formations engaged before the system + not engaged) and formations gone:

| save | air | combat | supply |
|---|---|---|---|
| 901 | 4,360 + 87,252; 0 + 14 gone | 28,276 + 879; 3 + 0 | 16 + 16,865; 0 + 1 |
| 903 | 38,815 + 122,371; 1 + 25 | 57,708 + 1,053; 5 + 0 | 2,502 + 23,734; 0 + 6 |
| 905 | 1,078 + 158,204; 0 + 26 | 50,808 + 2,234; 2 + 0 | 6,305 + 62,592; 0 + 0 |
| 907 | 19,184 + 95,111; 0 + 10 | 351,216 + 14,394; 29 + 6 | 4,826 + 94,871; 0 + 1 |
| 909 | 15,738 + 105,455; 4 + 15 | 27,657 + 1,641; 16 + 2 | 1,947 + 17,808; 0 + 12 |

- The air's strikes (`strikes`, PLAN 5.4b) take more of the land army than combat on 4 of 5 saves, and
  88 % of what they take is of formations in no contact; they end 95 formations in the 60 days against
  combat's 63. Five saves × 60 days: 648,000 men to the air, 536,000 to combat, 231,000 to supply.
- `armyLosses.ts` (`losses_y10.json`, 120 days, the same saves, by the hour): men lost by formations not
  engaged and in supply ("other") 113,000–269,000 a save, combat 75,000–409,000; formations gone not
  engaged 24–48 a save, engaged 5–30. Nothing is disbanded and no nation dies with its army to speak of.

## 4. What this says for a rule

The army at war is held by its losses as much as by its orders: at ~90–100 raised a year, the army stands
where its losses match them, and the air's strikes on formations out of contact are the largest single
loss. Two kinds of rule follow: (a) strikes spent on armies out of contact (where the AI aims them, or
what a strike takes of a formation that is not fighting); (b) more orders at war (the slot of the
100–400 band, the warship's saving, armour's slot time). (a) takes no gold and touches the air war
(aircraft 7); (b) moves the treasury, which is near spent below 1,000 a month.
